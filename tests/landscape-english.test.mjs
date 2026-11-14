import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {emptyLandscape,buildRound,currentTask,submitAnswer,correctRoundEvaluation,advanceRound,evaluateWord,learningModel,planNext,recommendations,updateInventory,chooseDirection,wordKey,DAY} from '../app/landscape-engine.js';
import {createLandscapeStore,mergeLandscapeResponse} from '../app/landscape-store.js';
import {createLandscape} from '../server/landscape.mjs';

const T=Date.parse('2026-11-14T12:00:00Z'),admin={id:'admin',role:'admin'};
function data(count=4){return {collections:{lesson:{id:'lesson',name:'Learning Week 2'}},words:Object.fromEntries(Array.from({length:count},(_,i)=>[`w${i}`,{id:`w${i}`,collectionId:'lesson',latin:i?'to look after '+i:'responsible',answerVariants:i?['look after '+i,'to look after '+i]:['responsible'],meanings:i?[[`betreuen ${i}`]]:[['verantwortlich'],['zuständig']]}])),reviews:{},settings:{}};}
const makeRound=(d,options={})=>buildRound({data:d,state:emptyLandscape('english'),subject:'english',kind:'write',collectionId:'lesson',roundId:'r',now:T,...options});
const answer=task=>task.direction==='de-en'?task.word.answerVariants[0]:task.word.meanings.map(g=>g[0]);
const body=extra=>({action:'landscapeSync',subject:'english',cursor:0,events:[],rounds:[],exams:[],inventory:[],...extra});
const upload=(round,mutationId='m',baseVersion=0)=>({...round,mutationId,baseVersion,deviceId:'device'});

test('English directions use the existing answer variants and strict English spelling',()=>{
  const word=data(1).words.w0;
  assert.equal(evaluateWord(word,['verantwortlch','zuständig'],{direction:'en-de'}).correct,true);
  assert.equal(evaluateWord(word,['responsble'],{direction:'de-en',allowTypos:true}).correct,false);
  assert.equal(evaluateWord(word,['responsible'],{direction:'de-en'}).correct,true);
  assert.equal(evaluateWord(data(2).words.w1,['look after 1'],{direction:'de-en'}).correct,true);
  assert.equal(evaluateWord(word,['verantwortlich'],{direction:'en-de'}).correct,false);
  assert.equal(evaluateWord(word,['verantwortlich'],{direction:'en-de',quick:true}).grade,'full');
  assert.equal(evaluateWord(word,['verantwortlich','falsch'],{direction:'en-de',quick:true}).correct,false);
});
test('English forward and reverse memory stay separate for every word and meaning',()=>{
  const d=data(1),state=emptyLandscape('english');
  for(let day=0;day<2;day++){
    const round=makeRound(d,{direction:'en-de',roundId:'forward'+day});
    state.events.push(submitAnswer(round,['verantwortlich','zuständig'],{now:T+day*DAY,eventId:'e'+day}).event);
  }
  let model=learningModel({data:d,state,now:T+DAY});
  assert.equal(model.words.w0.directions['en-de'].meanings[0].stage,2);assert.equal(model.words.w0.directions['de-en'].meanings[0].stage,0);assert.equal(model.words.w0.safe,false);
  assert.equal(chooseDirection('w0',model,{now:T+DAY}),'de-en');
  const reverse=makeRound(d,{direction:'de-en',roundId:'reverse'});state.events.push(submitAnswer(reverse,['responsible'],{now:T+DAY,eventId:'reverse-e'}).event);
  model=learningModel({data:d,state,now:T+DAY});assert.equal(model.words.w0.directions['de-en'].meanings[0].stage,1);assert.equal(model.words.w0.directions['en-de'].meanings[0].stage,2);
  assert(model.fields[wordKey('w0',0,'de-en')]);assert(model.fields[wordKey('w0',1,'en-de')]);assert(!model.fields['word:w0:0']);
});
test('English legacy reviews inform only their recorded direction; Latin reviews do not leak',()=>{
  const d=data(1);d.reviews={a:{id:'a',wordId:'w0',direction:'de-en',grade:'full',at:T,meaningRequirement:'all'},b:{id:'b',wordId:'w0',direction:'la-de',grade:'full',at:T,meaningRequirement:'all'},c:{id:'c',wordId:'w0',grade:'full',at:T,meaningRequirement:'all'}};
  const model=learningModel({data:d,state:emptyLandscape('english'),now:T});
  assert.equal(model.words.w0.directions['de-en'].meanings[0].stage,1);assert.equal(model.words.w0.directions['en-de'].meanings[0].stage,0);
});
test('cards, writing, quick and matching retain concrete English task directions',()=>{
  const d=data(8);
  for(const kind of ['cards','write','quick','matching'])for(const direction of ['en-de','de-en']){
    const round=makeRound(d,{kind,direction,roundId:`${kind}-${direction}`});
    assert(round.tasks.every(task=>task.subject==='english' && task.direction===direction));
    const task=currentTask(round),value=kind==='cards'?true:kind==='matching'?{pairs:task.words.map(w=>({wordId:w.id,meaningWordId:w.id}))}:answer(task);
    const event=submitAnswer(round,value,{now:T,eventId:`e-${kind}-${direction}`}).event;
    assert.equal(event.direction,direction);assert.equal(event.correct,true);assert(event.results.every(r=>r.key.includes(`:${direction}:`)));
  }
  const mixed=makeRound(d,{roundId:'mixed-directions'});assert.equal(new Set(mixed.tasks.map(t=>t.direction)).size,2);
});
test('English never schedules Latin grammar and introduces sentences only occasionally',()=>{
  const d=data(),state=emptyLandscape('english');updateInventory(state,d,T);
  for(let i=0;i<7;i++){
    assert.equal(planNext({data:d,state,now:T+i}).kind,'write');
    state.rounds['v'+i]={id:'v'+i,subject:'english',kind:'write',phase:'complete',collectionIds:['lesson'],createdAt:T+i,updatedAt:T+i,completedAt:T+i};
  }
  assert.equal(planNext({data:d,state,now:T+10}).kind,'sentence');
  state.rounds.s={id:'s',subject:'english',kind:'sentence',phase:'complete',collectionIds:['lesson'],createdAt:T+11,updatedAt:T+11,completedAt:T+11};
  assert.equal(planNext({data:d,state,now:T+12}).kind,'write');
  assert(recommendations({data:d,state,now:T+12}).every(r=>!['grammar','case-match'].includes(r.kind)));
  assert.equal(recommendations({data:{},state:emptyLandscape('english')}).length,0);
  for(const kind of ['grammar','case-match'])assert.throws(()=>makeRound(d,{kind}),/nicht zur englischen/);
});
test('English sentence tasks use German prompts and English answer tiles without cross-language content',()=>{
  const sentence={id:'en-s',subject:'english',direction:'de-en',collectionId:'lesson',prompt:'Er ist verantwortlich.',latin:'Er ist verantwortlich.',tokens:[{text:'Er',wordId:null},{text:'verantwortlich',wordId:'w0'}],translations:[['He','is','responsible']],focusWordIds:['w0']};
  const round=makeRound(data(),{kind:'sentence',sentences:[sentence,{...sentence,id:'latin-s',subject:'latin'}]});
  assert.equal(round.tasks.length,1);assert.equal(currentTask(round).direction,'de-en');
  const event=submitAnswer(round,['He','is','responsible'],{now:T,eventId:'sentence-e'}).event;assert.equal(event.subject,'english');assert.equal(event.direction,'de-en');assert.equal(event.correct,true);
});
test('manual corrections replace one effective attempt and preserve original immutable events',()=>{
  const d=data(1),state=emptyLandscape('english');let round=makeRound(d,{direction:'de-en'});
  const first=submitAnswer(round,['','a valid classroom synonym'],{now:T,eventId:'original'});round=first.round;state.events.push(first.event);
  assert.equal(round.feedback.rows[1].index,1);
  const corrected=correctRoundEvaluation(round,{1:[0]},{now:T+DAY,eventId:'corrected'});state.events.push(corrected.event);round=corrected.round;
  assert.equal(round.feedback.correct,true);assert.equal(round.feedback.attempt,1);assert.equal(state.events[0].correct,false);
  let field=learningModel({data:d,state,now:T+DAY}).fields[wordKey('w0',0,'de-en')];assert.equal(field.attempts,1);assert.equal(field.firstErrors,0);assert.equal(field.stage,1);assert.equal(field.lastIndependentAt,T);
  const again=correctRoundEvaluation(round,{}, {now:T+DAY,eventId:'aaa-later-correction'});state.events.push(again.event);
  field=learningModel({data:d,state,now:T+DAY}).fields[wordKey('w0',0,'de-en')];assert.equal(field.attempts,1);assert.equal(field.firstErrors,1);assert.equal(field.stage,0);
});
test('corrected evaluations also remove unnecessary whole-collection repair recommendations',()=>{
  const d=data(4),state=emptyLandscape('english');updateInventory(state,d,T);
  let round=makeRound(d,{direction:'de-en'});
  while(round.phase!=='complete'){
    if(round.phase==='checkpoint'){round=advanceRound(round,{now:T});continue;}
    const wrong=submitAnswer(round,['accepted synonym'],{now:T,eventId:'wrong-'+currentTask(round).id});state.events.push(wrong.event);
    const corrected=correctRoundEvaluation(wrong.round,{0:[0]},{now:T,eventId:'corrected-'+currentTask(round).id});state.events.push(corrected.event);
    round=advanceRound(corrected.round,{now:T});
  }
  state.rounds[round.id]=round;
  assert.equal(planNext({data:d,state,now:T+1}).kind,'write');
  assert.equal(state.events.filter(e=>!e.correct).length,4);
});
test('a completely failed quick recall reduces only the tested direction of memory',()=>{
  const d=data(1),state=emptyLandscape('english');
  state.events.push(submitAnswer(makeRound(d,{direction:'de-en'}),['responsible'],{now:T,eventId:'known'}).event);
  const failed=submitAnswer(makeRound(d,{kind:'quick',direction:'de-en',roundId:'quick'}),['unknown'],{now:T+DAY,eventId:'forgotten'}).event;state.events.push(failed);
  assert.equal(failed.results.length,1);assert.equal(failed.results[0].correct,false);
  const model=learningModel({data:d,state,now:T+DAY});
  assert.equal(model.words.w0.directions['de-en'].meanings[0].firstErrors,1);assert.equal(model.words.w0.directions['de-en'].meanings[0].stage,0);
  assert.equal(model.words.w0.directions['en-de'].meanings[0].attempts,0);
});
test('server partitions every event, session, exam, cursor and inventory by subject',()=>{
  const db=new DatabaseSync(':memory:'),service=createLandscape(db,{now:()=>T+DAY}),d=data(1);
  const english=makeRound(d,{direction:'de-en'}),latin=buildRound({data:d,kind:'write',collectionId:'lesson',roundId:'r',now:T});
  const enEvent=submitAnswer(english,['responsible'],{now:T,eventId:'same-event'}).event,laEvent=submitAnswer(latin,['verantwortlich','zuständig'],{now:T,eventId:'same-event'}).event;
  const exam={id:'same-exam',name:'Exam',date:'2026-11-20',collectionIds:['lesson'],createdAt:T,updatedAt:T,mutationId:'same-exam-m',deviceId:'device'};
  service.request(body({events:[enEvent],rounds:[upload(english)],exams:[exam],inventory:[{id:'lesson',wordIds:['english-only'],firstSeenAt:T}]}),admin);
  service.request(body({subject:'latin',events:[laEvent],rounds:[upload(latin)],exams:[{...exam,name:'Latein'}],inventory:[{id:'lesson',wordIds:['latin-only'],firstSeenAt:T}]}),admin);
  const en=service.request({action:'landscapePull',subject:'english'},admin),la=service.request({action:'landscapePull'},admin);
  assert.equal(en.events.length,1);assert.equal(en.events[0].direction,'de-en');assert.equal(la.events.length,1);assert.equal(la.events[0].direction,'la-de');
  assert.equal(en.rounds[0].subject,'english');assert.equal(la.rounds[0].subject,'latin');assert.equal(en.exams[0].name,'Exam');assert.equal(la.exams[0].name,'Latein');
  assert.deepEqual(en.inventory.lesson.wordIds,['english-only']);assert.deepEqual(la.inventory.lesson.wordIds,['latin-only']);
  assert.throws(()=>service.request(body({events:[laEvent]}),admin),/anderen Fach/);
  assert.throws(()=>service.request(body(),{id:'student',role:'student'}),/nur für den Admin/);
  assert.throws(()=>service.request(body({subject:'french'}),admin),/keine Lernlandschaft/);
  assert.throws(()=>mergeLandscapeResponse(emptyLandscape('latin'),en),/anderen Lernfach/);db.close();
});
test('server verifies correction ownership, direction and idempotency',()=>{
  const db=new DatabaseSync(':memory:'),service=createLandscape(db,{now:()=>T+DAY});const original=submitAnswer(makeRound(data(1),{direction:'de-en'}),['synonym'],{now:T,eventId:'o'});
  const corrected=correctRoundEvaluation(original.round,{0:[0]},{now:T+1,eventId:'c'});
  const result=service.request(body({events:[original.event,corrected.event]}),admin);assert.equal(result.events.length,2);
  service.request(body({events:[corrected.event]}),admin);assert.equal(db.prepare('SELECT count(*) n FROM landscape_events').get().n,2);
  assert.throws(()=>service.request(body({events:[{...corrected.event,id:'wrong-dir',direction:'en-de',results:[]}]}),admin),/nicht zu diesem bewerteten Versuch/);
  assert.throws(()=>service.request(body({events:[{...corrected.event,id:'missing',corrects:'missing'}]}),admin),/Ungültige Auswertungskorrektur/);db.close();
});
test('installed Latin replay hashes and rows stay valid without subject metadata',()=>{
  const db=new DatabaseSync(':memory:'),service=createLandscape(db,{now:()=>T+DAY});
  const event={id:'old-event',roundId:'old-round',taskId:'old-task',at:T,modality:'write',attempt:1,retry:false,hinted:false,correct:true,results:[{key:'word:w0:0',correct:true,wordId:'w0',meaningIndex:0}],wordId:'w0',sentenceId:null,caseId:null,hintedWordIds:[],errorType:null};
  const value=JSON.stringify(event),hash=createHash('sha256').update(value).digest('hex');
  db.prepare('INSERT INTO landscape_events VALUES(?,?,?,?,?)').run('admin',event.id,T,hash,value);db.prepare('INSERT INTO landscape_changes(profile,entity,item_id) VALUES(?,?,?)').run('admin','event',event.id);
  const result=service.request(body({subject:'latin',events:[event]}),admin);assert.equal(result.events.length,1);assert.equal(db.prepare('SELECT hash FROM landscape_events').get().hash,hash);
  assert.equal(service.request({action:'landscapePull',subject:'english'},admin).events.length,0);db.close();
});

class LocalStore extends EventTarget{
  constructor(subject='english'){super();this.subject=subject;this.profileId='admin';this.doc={device:'test-device',seq:0,pending:[],shadow:data(1),profile:admin,config:{url:'https://example.test/api',token:'token'}};this.queue=Promise.resolve();}
  get data(){return this.doc.shadow;}
  update(fn){const pending=this.queue.then(()=>{this.doc=fn(structuredClone(this.doc));return this.doc;});this.queue=pending.catch(()=>{});return pending;}
}
test('English offline store sends subject, restores direction and syncs a corrected attempt once',async()=>{
  const db=new DatabaseSync(':memory:'),service=createLandscape(db,{now:()=>T+DAY}),store=new LocalStore();let online=false;const sent=[];
  const sync={configured:true,request:async(action,payload)=>{sent.push(payload.subject);if(!online)throw Error('offline');return service.request({action,...payload},admin);}};
  let client=createLandscapeStore({store,sync,profile:admin,now:()=>T});await client.load();await client.start({kind:'write',collectionId:'lesson',direction:'de-en'});await client.answer(['classroom synonym']);await client.correctEvaluation({0:[0]});await client.pause();await client.flush();client.destroy();
  client=createLandscapeStore({store,sync,profile:admin,now:()=>T});await client.load();assert.equal(client.activeRound.subject,'english');assert.equal(currentTask(client.activeRound).direction,'de-en');assert.equal(client.activeRound.feedback.correct,true);
  online=true;await client.flush();assert(sent.every(subject=>subject==='english'));assert.equal(client.state.pendingEvents.length,0);
  const result=service.request({action:'landscapePull',subject:'english'},admin);assert.equal(result.events.length,2);assert.equal(service.request({action:'landscapePull'},admin).events.length,0);
  assert.equal(learningModel({data:store.data,state:client.state,now:T}).fields[wordKey('w0',0,'de-en')].attempts,1);client.destroy();db.close();
});
test('editing the current vocabulary re-evaluates its existing attempt and retains draft',async()=>{
  const store=new LocalStore(),client=createLandscapeStore({store,sync:{configured:false},profile:admin,now:()=>T});await client.load();await client.start({kind:'write',collectionId:'lesson',direction:'de-en'});await client.updateDraft({answers:['dependable']});await client.answer(['dependable']);assert.equal(client.activeRound.feedback.correct,false);
  await store.update(doc=>{doc.shadow.words.w0.answerVariants.push('dependable');return doc;});await client.refreshVocabulary('w0');
  assert.equal(client.activeRound.feedback.correct,true);assert.deepEqual(client.activeRound.draft.answers,['dependable']);assert.equal(client.activeRound.feedback.attempt,1);assert.equal(client.state.events.length,2);
  assert.equal(learningModel({data:store.data,state:client.state,now:T}).fields[wordKey('w0',0,'de-en')].firstErrors,0);client.destroy();
});
test('a mismatched local subject is rejected without overwriting existing Latin history',async()=>{
  const store=new LocalStore();store.doc.landscape={...emptyLandscape(),events:[{id:'keep'}]};const before=structuredClone(store.doc);
  const client=createLandscapeStore({store,sync:{configured:false},profile:admin});await assert.rejects(()=>client.load(),/anderen Fach/);assert.deepEqual(store.doc,before);client.destroy();
});
