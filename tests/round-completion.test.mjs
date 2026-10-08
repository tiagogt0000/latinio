import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {emptyData,evaluateSession} from '../app/core.js';
import {completionRoot,roundStats} from '../app/round-completion.js';
import {failedTasks,createErrorRetry} from '../app/error-retry.js';
import {predicateProgress} from '../app/predicates.js';
import {streakDemo,mountStreakFinish} from '../app/streak-demo.js';
import {Sync} from '../app/sync.js';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');

function fixture(){
 const d=emptyData(),session={id:'root',mode:'smart',sourceIds:[],queue:[{wordId:'a'},{wordId:'b'},{wordId:'c'}],originalLength:3};
 for(const id of ['a','b','c'])d.words[id]={id};
 for(let i=0;i<2;i++)d.reviews['old'+i]={id:'old'+i,wordId:'a',grade:'full',at:i};
 session.completionRoot=completionRoot(session,d);
 ['full','wrong','partial'].forEach((grade,index)=>d.reviews['root-'+index]={id:'root-'+index,wordId:session.queue[index].wordId,grade,at:100+index});
 return {d,session};
}
test('first-attempt statistics include partial failures and only newly secure tasks',()=>{
 const {d,session}=fixture();assert.deepEqual(roundStats(session,d),{correct:1,wrong:2,newlyKnown:1,total:3});
});
test('retries preserve the original counts while genuinely improving security',()=>{
 const {d,session}=fixture();let previous=session;
 for(let n=1;n<=3;n++){
  const retry=createErrorRetry(previous,failedTasks(previous,d.reviews),'retry'+n);
  // In a later manual retry, repeat the original missed tasks to reach secure.
  const current=retry||createErrorRetry(previous,[{wordId:'b'},{wordId:'c'}],'retry'+n);
  current.queue.forEach((item,index)=>d.reviews[current.id+'-'+index]={id:current.id+'-'+index,wordId:item.wordId,grade:'full',at:200+n*10+index});previous=current;
 }
 assert.equal(previous.completionRoot.id,'root');assert.deepEqual(roundStats(previous,d),{correct:1,wrong:2,newlyKnown:3,total:3});
});
test('English direction progress is not confused with progress in the other direction',()=>{
 const d=emptyData(),s={id:'r',queue:[{wordId:'x',direction:'en-de'},{wordId:'x',direction:'de-en'}]};
 for(let i=0;i<2;i++)d.reviews['old'+i]={id:'old'+i,wordId:'x',direction:'en-de',grade:'full',at:i};
 s.completionRoot=completionRoot(s,d);
 s.queue.forEach((item,index)=>d.reviews['r-'+index]={...item,id:'r-'+index,grade:'full',at:100+index});
 assert.equal(roundStats(s,d).newlyKnown,1);
});
function flow(){
 const {d,session}=fixture();session.finished=true;
 const calls={claims:0,dialogs:[],renders:[],mounts:[],fades:0};
 const store={doc:{session},async update(fn){this.doc=fn(this.doc);},async recordActivity(){},async commit(changes){for(const [entity,id,value]of changes)d[entity][id]=value;}};
 const context=vm.createContext({roundEnd:null,predicateRoot:null,predicateRun:[],predicateResults:[],predicateRoundId:'p',predicateCursor:0,predicateAnswer:'',predicateFeedback:null,screen:'test',store,data:()=>d,failedTasks,createErrorRetry,predicateProgress,uid:()=> 'retry',h:String,document:{activeElement:{blur(){}},body:{style:{overflow:''}},querySelector:()=>null},matchMedia:()=>({matches:false}),modalRoot:{querySelector:()=>({})},modalCleanup:()=>{},app:{},sync:{schedule(){}},streakLedger:{async claim(){calls.claims++;return {count:1,variant:'orbit',celebrate:calls.claims===1};}},fadeDialog:async()=>{},fadeRound:async()=>{calls.fades++;},showModal:(html,closable)=>calls.dialogs.push({html,closable}),closeModal(){},streakDemo,mountStreakFinish:(stage,options)=>{calls.mounts.push(options);return ()=>{};},backgroundSync:async()=>{},render(){calls.renders.push(context.screen);}});
 const start=source.indexOf('async function offerRoundEnd('),end=source.indexOf('function announcementView(',start);
 vm.runInContext(source.slice(start,end),context);return {context,calls,store,d,session};
}
test('errors open the decision dialog before any claim; retry stays in learning',async()=>{
 const f=flow();await f.context.offerRoundEnd({kind:'vocab',id:'root',stats:roundStats(f.session,f.d),errors:failedTasks(f.session,f.d.reviews)});
 assert.equal(f.calls.claims,0);assert.match(f.calls.dialogs[0].html,/Fehler wiederholen/);assert.equal(f.calls.dialogs[0].closable,false);
 await f.context.retryRoundErrors();assert.equal(f.context.screen,'test');assert.equal(f.calls.claims,0);assert.equal(f.store.doc.session.queue.length,2);assert.equal(f.store.doc.session.completionRoot.id,'root');
});
test('choosing finish claims once and displays the three stats; continue clears the round',async()=>{
 const f=flow();await f.context.offerRoundEnd({kind:'vocab',id:'root',stats:roundStats(f.session,f.d),errors:[{wordId:'b'}]});
 await f.context.acceptRoundEnd();await f.context.acceptRoundEnd();
 assert.equal(f.calls.claims,1);assert.equal(f.calls.fades,1);assert.equal(f.calls.mounts[0].celebrate,true);
 assert.match(f.calls.dialogs.at(-1).html,/Neu sicher/);assert.doesNotMatch(f.calls.dialogs.at(-1).html,/data-streak-form|admin-tests/);
 await f.context.returnFromRound();assert.equal(f.context.screen,'learn');assert.equal(f.store.doc.session,null);assert.equal(f.context.roundEnd,null);
});
test('a flawless round proceeds immediately and later same-day rounds do not replay the celebration',async()=>{
 const f=flow();await f.context.offerRoundEnd({kind:'vocab',id:'a',stats:{correct:1,wrong:0,newlyKnown:0,total:1},errors:[]});
 assert.equal(f.calls.dialogs.length,1);assert.equal(f.calls.mounts[0].celebrate,true);
 await f.context.returnFromRound();await f.context.offerRoundEnd({kind:'vocab',id:'b',stats:{correct:1,wrong:0,newlyKnown:0,total:1},errors:[]});
 assert.equal(f.calls.mounts[1].celebrate,false);
});
test('save errors leave a usable retry action and do not mark the completion accepted',async()=>{
 const f=flow();f.context.streakLedger.claim=async()=>{throw Error('Speicher voll');};
 await f.context.offerRoundEnd({kind:'vocab',id:'a',stats:{total:1},errors:[]});
 assert.equal(f.context.roundEnd.accepted,false);assert.match(f.calls.dialogs.at(-1).html,/Erneut versuchen/);assert.equal(f.calls.mounts.length,0);
});
test('predicate retries retain the first answer and do not earn a streak before ending',async()=>{
 const f=flow(),item={id:'verb',grundform:'amare'};
 f.context.predicateRoot={items:[item],known:{verb:false},first:{verb:false}};f.context.predicateRun=[item];f.context.predicateResults=[false];
 await f.context.finishPredicateRound();assert.equal(f.calls.claims,0);assert.equal(f.context.roundEnd.errors.length,1);
 await f.context.retryRoundErrors();assert.equal(f.context.screen,'predicate-test');assert.equal(f.context.predicateRoot.first.verb,false);
 f.context.predicateResults=[true];f.d.settings.review={kind:'predicateReview',itemId:'verb',correct:true,at:1};
 await f.context.finishPredicateRound();assert.equal(f.calls.claims,1);assert.equal(f.context.roundEnd.stats.correct,0);assert.equal(f.context.roundEnd.stats.wrong,1);assert.equal(f.context.roundEnd.stats.newlyKnown,1);
});
test('the last typed answer finishes automatically; earlier answers still show feedback',async()=>{
 for(const cursor of [0,1]){
  let nexts=0;const session={id:'r',cursor,queue:[{wordId:'x'},{wordId:'x'}]},word={id:'x',meanings:[['Stimme']]};
  const ctx=vm.createContext({current:()=>({session,word,item:session.queue[cursor]}),readAnswers:()=>['Stimme'],english:false,prefs:()=>({typos:true}),evaluateSession,reviewKey:()=> 'r-'+cursor,store:{async commit(){}},sync:{schedule(){}},render(){},next:async()=>nexts++});
  vm.runInContext(source.split('\n').find(line=>line.startsWith('async function checkAnswer(')),ctx);await ctx.checkAnswer();assert.equal(nexts,cursor===1?1:0);
 }
});
test('live renderer supports arbitrary days and never includes the admin test question',()=>{
 const html=streakDemo(42,'impact','auto',{live:true,celebrate:true,stats:{correct:5,wrong:2,newlyKnown:1}});
 assert.match(html,/data-day="42"/);assert.doesNotMatch(html,/data-streak-form|data-action="admin-tests"/);assert.match(html,/data-action="round-home"/);
});
test('cross-subject synchronization permits reads but rejects writes into another subject',async()=>{
 const received=[],sync=Object.create(Sync.prototype);sync.subject='latin';sync.store={doc:{config:{url:'url',token:'token'}}};
 sync.bridge={url:'url',token:'token',englishVerified:true,async request(action,payload){received.push({action,payload});return {version:1};}};
 await sync.request('check',{},'english');await sync.request('pull',{since:0},'english');
 assert.ok(received.every(row=>row.payload.subject==='english'));await assert.rejects(sync.request('push',{ops:[]},'english'),/nur das Lesen/);
});

function animationFixture(options={}){
 let clock=0,id=0;const tasks=new Map();
 const button={disabled:true,focused:false,focus(){this.focused=true;}},controls={hidden:true,querySelector:()=>button};
 const scene={hidden:true,setAttribute(){}},status={textContent:''};
 const stage={dataset:{day:'42'},querySelector:selector=>({'.streak-celebration':scene,'.streak-finish-controls':controls,'[data-streak-status]':status}[selector])};
 const cleanup=mountStreakFinish(stage,{schedule:(fn,delay)=>{tasks.set(++id,{fn,at:clock+delay});return id;},cancel:id=>tasks.delete(id),...options});
 const tick=ms=>{const end=clock+ms;for(;;){const next=[...tasks].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;tasks.delete(next[0]);next[1].fn();}clock=end;};
 return {stage,button,controls,scene,status,cleanup,tick,tasks};
}
test('real celebration reveals the result footer after its choreography and focuses Continue',()=>{
 const f=animationFixture();f.tick(240);assert.equal(f.stage.dataset.phase,'celebrate');assert.equal(f.controls.hidden,true);
 f.tick(3600);assert.equal(f.controls.hidden,false);assert.equal(f.button.disabled,false);assert.equal(f.button.focused,true);assert.match(f.status.textContent,/Tag 42/);f.cleanup();
});
test('later rounds and reduced motion have no long wait, and disposal cancels pending reveals',()=>{
 for(const options of [{celebrate:false},{reducedMotion:true}]){
  const f=animationFixture(options);f.tick(340);assert.equal(f.controls.hidden,false);if(options.celebrate===false)assert.equal(f.stage.dataset.phase,'settled');f.cleanup();
 }
 const f=animationFixture();f.tick(240);f.cleanup();f.tick(10000);assert.equal(f.controls.hidden,true);assert.equal(f.tasks.size,0);
});
