import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,statSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../server/database.mjs';
import {apiServer} from '../server/http.mjs';
import {createGrammar,ENDPOINT,MODEL} from '../server/grammar.mjs';
import {TOPIC,CORE_PROMPT,makePlan,learningStats,validateTasks,validateResults,gradingMessages,GENERATION_SCHEMA} from '../server/grammar-content.mjs';
import {harness} from './google-harness.mjs';
const admin={id:'admin',role:'admin'},token='a'.repeat(64);
const secret='only-on-server-test-secret';
const solutions={'do-present':'Does he play football?','do-past':'Why did he play football?','be':'Why is he playing football?','modal':'Why can he play football?','question-order':'Why does he want to play football?','statement':'Although he played football yesterday, he is tired today.'};
function outputFor(request,serial){
 const data=JSON.parse(request.messages[1].content);
 return data.plan?{schemaVersion:1,topicId:TOPIC.id,tasks:data.plan.slots.map((s,i)=>({id:s.id,goalId:s.goalId,promptDe:`Warum spielt dein Bruder am Tag ${serial} beim Training ${i+1}?`,vocabularyHint:'football = Fußball',solution:solutions[s.goalId],alternatives:[],targetEvidence:'Das gewählte Hilfsverb passt zum angegebenen Lernziel.'}))}:
 {schemaVersion:1,topicId:TOPIC.id,results:data.tasks.map(t=>({id:t.id,target:'correct',otherGrammar:'correct',vocabulary:'correct',content:'correct',confidence:'clear',correction:t.solution,explanationDe:'Das Hilfsverb und die Wortstellung passen.',ruleDe:'Nach dem Hilfsverb folgt hier die Grundform.',example:'Does it fit?',possibleMisconceptionDe:'',supportingFocus:'none'}))};
}
function fixture(t,{file=':memory:',...options}={}){
 const database=openDatabase(file);const h=harness();database.importSnapshot({format:'latinio-pi-migration',schema:1,properties:h.props,sheets:[...h.sheets].map(([name,s])=>({name,rows:s.rows}))});
 let calls=0,clock=Date.parse('2026-10-20T12:00:00Z'),mutator=x=>x,transportError=null,hold=null,storedKey=secret;const requests=[];
 const fetchImpl=async(url,options)=>{
  assert.equal(url,ENDPOINT);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+storedKey);
  calls++;const request=JSON.parse(options.body);requests.push(request);assert.equal(request.model,MODEL);assert.equal(request.response_format.type,'json_schema');
  if(hold)await hold;if(transportError)throw transportError;
  return new Response(JSON.stringify(mutator({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outputFor(request,calls))}}],usage:{prompt_tokens:600,completion_tokens:400}})),{status:200});
 };
 const service=createGrammar(database,{fetchImpl,envKey:'',keyStore:{get:()=>storedKey,set:v=>storedKey=v},now:()=>clock,...options});
 t.after(()=>database.close());
 return {database,service,requests,get calls(){return calls;},setMutator:fn=>mutator=fn,setError:e=>transportError=e,setHold:p=>hold=p,setTime:n=>clock=n,key:()=>storedKey};
}
const generate=(f,count=3,requestId=randomUUID())=>f.service.request({action:'grammarGenerate',topicId:TOPIC.id,count,requestId},admin);
const answered=r=>({...r,answers:Object.fromEntries(r.tasks.map(t=>[t.id,'Does he play football?']))});
const grade=(f,r,requestId=randomUUID())=>f.service.request({action:'grammarGrade',roundId:r.id,revision:r.revision,answers:answered(r).answers,requestId},admin);

for(const count of [3,5,10])test(`${count} tasks, batch grading and persisted separate dimensions; no solutions before submission`,async t=>{
 const f=fixture(t),created=await generate(f,count);assert.equal(created.round.tasks.length,count);assert.ok(created.round.tasks.every(t=>!('solution'in t)&&!('alternatives'in t)&&!('targetEvidence'in t)));
 assert.equal(f.requests[0].temperature,.4);assert.ok(f.requests[0].max_tokens>=count*420);assert.equal(f.requests[0].messages[0].role,'system');
 const result=await grade(f,created.round);assert.equal(result.round.evaluations.length,1);assert.equal(result.round.evaluations[0].results.length,count);assert.equal(f.requests[1].temperature,0);assert.ok(f.requests[1].max_tokens>=count*650);
 assert.equal(result.state.stats.reduce((n,s)=>n+s.correct,0),count);assert.equal(result.state.usage.calls,2);assert.equal(result.state.usage.reserved_tokens,0);
 const copy=await f.service.request({action:'grammarRound',roundId:created.round.id},admin);assert.deepEqual(copy.round.answers,answered(created.round).answers);assert.equal(f.calls,2);
});
test('A pending/replayed generation is charged once, including an identical concurrent request',async t=>{
 const f=fixture(t);let resume;f.setHold(new Promise(r=>resume=r));const requestId=randomUUID();const first=generate(f,3,requestId),second=generate(f,3,requestId);await new Promise(r=>setImmediate(r));assert.equal(f.calls,1);
 await assert.rejects(generate(f),/läuft bereits/);resume();const [a,b]=await Promise.all([first,second]);assert.equal(a.round.id,b.round.id);
 const replay=await generate(f,3,requestId);assert.equal(replay.round.id,a.round.id);assert.equal(f.calls,1);
 await assert.rejects(generate(f,5,requestId),/andere Daten/);
});
test('Rejected/truncated grading preserves exact answers and explicit retry does not duplicate progress',async t=>{
 const f=fixture(t),created=await generate(f);f.setMutator(b=>({...b,choices:[{...b.choices[0],finish_reason:'length'}]}));
 const requestId=randomUUID();await assert.rejects(grade(f,created.round,requestId),/nicht vollständig/);
 const saved=(await f.service.request({action:'grammarRound',roundId:created.round.id},admin)).round;assert.deepEqual(saved.answers,answered(created.round).answers);assert.equal(saved.evaluations.length,0);
 f.setMutator(b=>b);const result=await grade(f,created.round,requestId);const replay=await grade(f,created.round,requestId);
 assert.equal(result.round.evaluations.length,1);assert.equal(replay.round.evaluations.length,1);assert.equal(f.calls,3);
 assert.equal(result.state.stats.reduce((n,s)=>n+s.correct,0),3);
});
test('The client cannot change task text, solutions, topic, owner or grading decisions',async t=>{
 const f=fixture(t);await assert.rejects(generate(f,4),/3, 5 oder 10/);await assert.rejects(f.service.request({action:'grammarGenerate',topicId:'other',count:3,requestId:randomUUID()},admin),/Hilfsverb/);
 const created=await generate(f);const r=created.round;
 const result=await f.service.request({action:'grammarGrade',roundId:r.id,revision:r.revision,answers:answered(r).answers,requestId:randomUUID(),tasks:[{solution:'hacked'}],profile:{id:'other'}},admin);
 assert.equal(result.round.tasks.length,3);assert.ok(!JSON.stringify(f.requests.at(-1)).includes('hacked'));
 await assert.rejects(f.service.request({action:'grammarRound',roundId:r.id},{id:'other',role:'admin'}),/nicht gefunden/);
 await assert.rejects(f.service.request({action:'grammarStatus'},{id:'student',role:'student'}),/Admin/);
});
test('Concurrent device saves reject stale revisions without losing either submitted answer set',async t=>{
 const f=fixture(t),r=(await generate(f)).round;const a=answered(r).answers;
 const saved=await f.service.request({action:'grammarSave',roundId:r.id,revision:0,answers:a},admin);assert.equal(saved.round.revision,1);
 await assert.rejects(f.service.request({action:'grammarSave',roundId:r.id,revision:0,answers:{...a,q1:'my second device'}},admin),/anderen Gerät/);
 assert.deepEqual((await f.service.request({action:'grammarRound',roundId:r.id},admin)).round.answers,a);
});
test('Independent recheck preserves original results and excludes conflicting judgments from the learning profile',async t=>{
 const f=fixture(t),r=(await generate(f)).round;await grade(f,r);
 f.setMutator(body=>{const v=JSON.parse(body.choices[0].message.content);v.results[0].target='incorrect';body.choices[0].message.content=JSON.stringify(v);return body;});
 const requestId=randomUUID(),result=await f.service.request({action:'grammarReview',requestId,roundId:r.id},admin);
 assert.equal(result.round.evaluations.length,2);assert.equal(result.round.evaluations[0].results[0].target,'correct');assert.equal(result.round.evaluations[1].results[0].status,'uncertain');
 assert.equal(result.state.stats.reduce((n,s)=>n+s.correct+s.incorrect,0),2);
 const replay=await f.service.request({action:'grammarReview',requestId,roundId:r.id},admin);assert.equal(replay.round.evaluations.length,2);
 f.setMutator(b=>b);const third=await f.service.request({action:'grammarReview',requestId:randomUUID(),roundId:r.id},admin);assert.equal(third.round.evaluations[2].results[0].status,'uncertain');assert.equal(third.state.stats.reduce((n,s)=>n+s.correct+s.incorrect,0),2);
});
test('Daily request/token budgets and unknown consumption survive errors, and secrets never appear in status/errors',async t=>{
 const f=fixture(t);await f.service.request({action:'grammarConfigure',limits:{dailyCalls:2,dailyTokens:200000}},admin);
 f.setError(Error(secret));await assert.rejects(generate(f),e=>!e.message.includes(secret)&&/Verbindung/.test(e.message));f.setError(null);await generate(f);
 await assert.rejects(generate(f),/tägliches KI-Limit/);const status=await f.service.request({action:'grammarStatus'},admin);assert.equal(status.usage.calls,2);assert.ok(status.usage.reserved_tokens>0);assert.ok(!JSON.stringify(status).includes(secret));
 f.setTime(Date.parse('2026-10-20T22:01:00Z'));assert.equal((await f.service.request({action:'grammarStatus'},admin)).usage.calls,0);
 await assert.rejects(f.service.request({action:'grammarConfigure',limits:{dailyCalls:10000,dailyTokens:10}},admin),/2–200/);
});
test('Provider timeouts and invalid/missing result IDs never create a grade',async t=>{
 const f=fixture(t),r=(await generate(f)).round;
 f.setMutator(body=>{const v=JSON.parse(body.choices[0].message.content);v.results[0].id='other';body.choices[0].message.content=JSON.stringify(v);return body;});
 await assert.rejects(grade(f,r),/unvollständig/);assert.equal((await f.service.request({action:'grammarRound',roundId:r.id},admin)).round.evaluations.length,0);
 const timeoutService=createGrammar(f.database,{envKey:secret,timeout:5,fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('abort')),{once:true}))});
 await assert.rejects(timeoutService.request({action:'grammarGenerate',topicId:TOPIC.id,count:3,requestId:randomUUID()},admin),/zu lange/);
});
test('Round IDs, results, usage, deduplication and unfinished operations survive a backend restart',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'latinio-grammar-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'state.sqlite');const f=fixture(t,{file:path}),requestId=randomUUID(),r=(await generate(f,3,requestId)).round;await grade(f,r);
 const db=openDatabase(path);t.after(()=>db.close());let attempted=false;const restarted=createGrammar(db,{envKey:secret,fetchImpl:async()=>{attempted=true;throw Error('must not call');},now:()=>Date.parse('2026-10-20T12:00:00Z')});
 const replay=await restarted.request({action:'grammarGenerate',topicId:TOPIC.id,count:3,requestId},admin);assert.equal(replay.round.evaluations.length,1);assert.equal(attempted,false);assert.equal(replay.state.usage.calls,2);
});
test('API key is a restricted file, cannot be read through the API and rejects symlinks',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'latinio-secret-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const f=fixture(t),path=join(dir,'ovh.key');const service=createGrammar(f.database,{keyPath:path,envKey:''});
 assert.equal((await service.request({action:'grammarStatus'},admin)).configured,false);
 const data=await service.request({action:'grammarConfigure',apiKey:secret,limits:{dailyCalls:20,dailyTokens:200000}},admin);
 assert.equal(readFileSync(path,'utf8'),secret);assert.equal(statSync(path).mode&0o777,0o600);assert.ok(!JSON.stringify(data).includes(secret));
 const link=join(dir,'link');symlinkSync(path,link);const linked=createGrammar(f.database,{keyPath:link,envKey:''});await assert.rejects(linked.request({action:'grammarConfigure',apiKey:secret+'changed',limits:{dailyCalls:20,dailyTokens:200000}},admin),/sicher/);
 assert.equal(readFileSync(path,'utf8'),secret);
});
test('Every grammar HTTP action requires a real admin session, not a client role flag',async t=>{
 const f=fixture(t),server=apiServer(f.database,undefined,null,f.service);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url='http://127.0.0.1:'+server.address().port+'/api',headers={Origin:'https://tiagogt0000.github.io','Content-Type':'application/json'};
 const student=f.database.request({action:'profileCreate',name:'Test',email:'test@example.org',token}).profile;
 const login=f.database.request({action:'login',email:student.email});
 for(const action of ['grammarStatus','grammarConfigure','grammarGenerate','grammarGrade','grammarRound','grammarHistory','grammarOperation','grammarSave','grammarReview']){
  const denied=await fetch(url,{method:'POST',headers:{...headers,Authorization:'Bearer '+login.token},body:JSON.stringify({action,role:'admin',profile:admin})});assert.equal(denied.status,403,action);
 }
 const anonymous=await fetch(url,{method:'POST',headers,body:JSON.stringify({action:'grammarStatus',token})});assert.equal(anonymous.status,400);
 const response=await fetch(url,{method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:JSON.stringify({action:'grammarStatus'})});assert.equal(response.status,200);assert.ok(!JSON.stringify(await response.json()).includes(secret));
});
test('Twenty adaptive rounds keep the auxiliary curriculum, varied review and supporting errors in bounds',()=>{
 const rounds=[];const seen=new Set();
 for(let sequence=0;sequence<20;sequence++){
  const plan=makePlan(5,rounds,sequence);assert.equal(plan.slots.length,5);assert.equal(plan.slots.filter(s=>s.purpose==='gemischte Wiederholung').length,2);
  plan.slots.forEach(s=>{assert.ok(TOPIC.goals.some(g=>g.id===s.goalId));seen.add(s.goalId);});
  rounds.unshift({tasks:plan.slots,evaluations:[{results:plan.slots.map(s=>({id:s.id,target:s.goalId==='modal'?'incorrect':'correct',otherGrammar:'incorrect',status:'incorrect',supportingFocus:'verb-pattern'}))}]});
  if(sequence>0)assert.ok(plan.supportingPractice.includes('verb-pattern'));
 }
 assert.equal(seen.size,6);assert.equal(makePlan(5,[],0).difficulty,1);
});
test('Fairness contract distinguishes vocabulary from target grammar, blanks from mistakes and valid alternative constructions',()=>{
 for(const fragment of ['like swimming UND like to swim','did play ist betont zulässig, did played ist falsch','Today allein','handy statt phone','Groß-/Kleinschreibung','untrusted Daten','Nicht beantwortete und abgebrochene']){
  assert.ok(CORE_PROMPT.includes(fragment),fragment);
 }
 const plan=makePlan(3,[],0),generated=outputFor({messages:[{}, {content:JSON.stringify({plan})}]},1),round={tasks:generated.tasks,answers:{q1:'Does your handy work?',q2:'',q3:'perhaps'}};
 const out=outputFor({messages:[{}, {content:JSON.stringify({tasks:round.tasks})}]},1);out.results[0].vocabulary='incorrect';out.results[2].confidence='uncertain';
 const results=validateResults(out,round);assert.equal(results[0].target,'correct');assert.equal(results[0].status,'incorrect');assert.equal(results[1].status,'not_answered');assert.equal(results[2].status,'uncertain');
 const stats=learningStats([{...round,evaluations:[{results}]}]);assert.equal(stats.reduce((n,s)=>n+s.correct,0),1);assert.equal(stats.reduce((n,s)=>n+s.incorrect,0),0);
 assert.ok(!JSON.stringify(gradingMessages(round)).includes(secret));
});
test('Generated tasks reject changed goals, duplicate text and missing auxiliary evidence',()=>{
 const plan=makePlan(3,[],0),generated=outputFor({messages:[{}, {content:JSON.stringify({plan})}]},1);
 assert.equal(validateTasks(generated,plan).length,3);
 assert.throws(()=>validateTasks(generated,plan,[generated.tasks[0].promptDe]),/wiederholt/);
 const changed=structuredClone(generated);changed.tasks[0].goalId='modal';assert.throws(()=>validateTasks(changed,plan),/Hilfsverb/);
 changed.tasks[0].goalId=plan.slots[0].goalId;changed.tasks[0].solution='Playing played.';assert.throws(()=>validateTasks(changed,plan),/Hilfsverb/);
 assert.equal(GENERATION_SCHEMA.additionalProperties,false);
});
