import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {emptyData,applyOps,progressFor} from '../app/core.js';
import {englishTasks} from '../app/english.js';
import {wordsForDecks,selectedDeckPending} from '../app/refresh-decks.js';
import {predicateDecks,predicateCloudItems,predicateQueue,predicateProgress,predicateProgressIndex} from '../app/predicates.js';
import {trainingOptionCounts} from '../app/training-options.js';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function corpus(count=12){
 const d=emptyData();
 d.collections.a={id:'a',name:'Lektion 1'};d.collections.b={id:'b',name:'Lektion 2'};
 for(let i=0;i<count;i++){
  const id='w'+i;d.words[id]={id,collectionId:i%2?'b':'a',latin:'vox'+i,meanings:[['Stimme '+i]]};
  for(const direction of ['en-de','de-en'])for(let j=0;j<4;j++){
   const rid=id+'_'+direction+'-'+j;
   d.reviews[rid]={id:rid,wordId:id,direction,at:100+j,grade:i%4===0||direction==='de-en'&&i%4===1?'full':j===3?'wrong':'full'};
  }
 }
 d.settings.r1={id:'r1',kind:'refreshDeck',active:true,direction:'en-de',name:'Vorwärts',members:[{wordId:'w0',addedAt:50},{wordId:'w1',addedAt:150},{wordId:'w2',addedAt:50}]};
 d.settings.r2={id:'r2',kind:'refreshDeck',active:true,direction:'both',name:'Beide',members:[{wordId:'w0',addedAt:150},{wordId:'w1',addedAt:50},{wordId:'w3',addedAt:50}]};
 d.settings.off={id:'off',kind:'refreshDeck',active:false,name:'Inaktiv',members:[{wordId:'w4',addedAt:0}]};
 d.reviews.retry={id:'s-11',wordId:'w2',direction:'en-de',at:103,grade:'full',repeat:true};
 d.reviews.failure={id:'s-10',wordId:'w2',direction:'en-de',at:103,grade:'wrong'};
 d.reviews.assessed={id:'manual',wordId:'w3',direction:'de-en',at:200,grade:'full',manualKnown:true};
 return d;
}
function expectedCounts(d,ids,direction){
 if(direction!==null){
  const learning=englishTasks(d,ids,'learning',Infinity,direction).length,known=englishTasks(d,ids,'refresh',Infinity,direction).length;
  return {learning,known,total:learning+known};
 }
 const words=wordsForDecks(d,ids),learning=words.filter(word=>{
  const pending=selectedDeckPending(d,word.id,ids);
  return pending===null?progressFor(word.id,d.reviews).level!=='known':pending;
 }).length;
 return {learning,known:words.length-learning,total:words.length};
}

test('Option counts match existing selection, direction and refresher rules without changing learning data',()=>{
 const d=corpus(),choices=['a','b','r1','r2','off'];
 for(const inactive of [false,true]){
  d.settings['collection-active_a']={active:!inactive};
  const before=structuredClone(d);
  for(let mask=0;mask<2**choices.length;mask++){
   const ids=choices.filter((_,i)=>mask&(1<<i));
   for(const direction of [null,'mixed','en-de','de-en'])assert.deepEqual(trainingOptionCounts(d,ids,{direction}),expectedCounts(d,ids,direction),JSON.stringify({inactive,ids,direction}));
  }
  assert.deepEqual(d,before);
 }
});

test('Large selections traverse the full review history once and never cache stale progress',()=>{
 const d=corpus(300);let scans=0;
 d.reviews=new Proxy(d.reviews,{ownKeys(target){scans++;return Reflect.ownKeys(target);}});
 const first=trainingOptionCounts(d,['a','b'],{direction:'mixed'});
 assert.equal(first.total,600);assert.equal(scans,1);
 d.reviews.newFailure={id:'later',wordId:'w0',direction:'en-de',at:999,grade:'wrong'};
 const second=trainingOptionCounts(d,['a','b'],{direction:'mixed'});
 assert.equal(second.known,first.known-1);assert.equal(second.learning,first.learning+1);assert.equal(scans,2);
});

function actionFixture(subject='latin'){
 const d=corpus(),calls={reads:0,renders:0,notices:[],activities:[],schedules:0},listeners=new Map();
 d.settings.general={direction:'mixed',daily:10};
 d.settings.p={id:'p',kind:'predicateDeck',name:'Perfekt',active:true};
 d.settings.pi={kind:'predicateItem',deckId:'p',grundform:'amare',praedikate:['amavi']};
 d.settings.pj={kind:'predicateItem',deckId:'p',grundform:'monere',praedikate:['monui']};
 d.settings.pr={kind:'predicateReview',itemId:'pi',at:100,correct:true};
 let html='';
 const focusable={focus(){}};
 const modalRoot={get children(){return html?[{}]:[];},set innerHTML(value){html=value;},querySelector:()=>focusable,querySelectorAll:()=>[focusable],contains:()=>false};
 const document={activeElement:focusable,addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:type=>listeners.delete(type),querySelector:()=>null};
 const store={doc:{pending:[]},recordActivity:async kind=>calls.activities.push(kind)};
 const context=vm.createContext({
  queueMicrotask,pendingCloudRender:false,document,modalRoot,modalReturnFocus:null,modalCleanup:null,interfaceMotion:{closeModal(){},openModal(){}},store,subject,english:subject!=='latin',
  data:()=>{calls.reads++;return applyOps(d,[]);},prefs:()=>({...d.settings.general}),selected:['a','b'],predicateSelected:null,
  subjectTransition:null,ready:true,working:false,waitingStart:false,cloudWait:{blocked:false},screen:'learn',pendingStart:null,
  tablePractice:null,grammar:null,reminders:null,sharing:{handle:async()=>false,afterAction(){}},confusions:{handle:async()=>false},
  collectionOpener:{cancel(){}},setTimeout,clearTimeout,icon:()=>'',h:String,directionLabel:value=>value,
  trainingOptionCounts,predicateDecks,predicateCloudItems,predicateQueue,predicateProgress,predicateProgressIndex,
  uid:()=> 'test-round',sync:{schedule(){calls.schedules++;}},
  notify:message=>calls.notices.push(message),render(){calls.renders++;},checkShareNotices(){},autoUpdate(){},updateStatus(){},refreshStreak:async()=>{},settleSync:async()=>{},
  predicateRun:[],predicateRoot:null,predicateResults:[],predicateRoundId:'',roundEnd:null,predicateCursor:0,predicateAnswer:'',predicateFeedback:null,
 });
 for(const code of [section('function flushCloudRender(','const prefs='),section('function learningStatus(','function render('),section('function selectedPredicateDecks(','function renderPredicateTest('),section('function trainingOptions(','function current('),section('function showModal(','function showStreakDemo('),section('async function actions(',"document.addEventListener('click',event=>"),source.split('\n').find(line=>line.startsWith('async function backgroundSync('))])vm.runInContext(code,context);
 const click=(action,id)=>context.actions({preventDefault(){},target:{closest:()=>({dataset:{action,id},isConnected:true,removeAttribute(){}})}});
 return {context,d,calls,click,get html(){return html;}};
}

test('Actual More Options and Smart clicks open usable dialogs in Latin and English',async()=>{
 for(const subject of ['latin','english']){
  const f=actionFixture(subject);
  await f.click('training-options');
  assert.match(f.html,/role="dialog"/);assert.match(f.html,/>Mehr Optionen</);
  assert.equal(f.calls.reads,1,'one coherent store snapshot per options dialog');
  for(const action of ['start-refresh','start-learning','start-all'])assert.ok(f.html.includes('data-action="'+action+'"'));
  assert.doesNotMatch(f.html,/data-action="french-mode"/);
  assert.equal(f.context.working,false);assert.deepEqual(f.calls.notices,[]);
  await f.click('start-learning');assert.equal(f.context.pendingStart.mode,'learning');assert.match(f.html,/>Vor der Runde</);
  await f.click('close-modal');assert.equal(f.html,'');
  await f.click('start');assert.equal(f.context.pendingStart.mode,'smart');assert.match(f.html,/data-action="confirm-start"/);
  assert.equal(f.calls.activities.length,0,'opening either dialog must not record learning');
  assert.equal(f.calls.schedules,0);assert.equal(f.calls.renders,0);
 }
});

test('Predicate More Options uses one snapshot and Smart still starts its selected local queue',async()=>{
 const f=actionFixture();
 await f.click('predicate-options');assert.match(f.html,/>Mehr Optionen</);assert.equal(f.calls.reads,1);
 assert.match(f.html,/Auffrischen · 1/);assert.match(f.html,/Noch unsichere Formen üben · 1/);assert.match(f.html,/Alle ausgewählten Formen üben · 2/);
 await f.click('predicate-mode','learning');assert.equal(f.context.screen,'predicate-test');assert.equal(f.context.predicateRun.length,1);assert.equal(f.context.predicateRun[0].id,'pj');
 f.context.screen='learn';await f.click('predicate-start');
 assert.equal(f.context.screen,'predicate-test');assert.equal(f.context.predicateRun.length,2);assert.deepEqual(f.calls.notices,[]);
});

test('Both More Options actions remain usable while initial sync is blocked',async()=>{
 for(const action of ['training-options','predicate-options']){
  const f=actionFixture();f.context.cloudWait.blocked=true;
  f.context.waitForInitialSync=()=>{throw Error('Opening options must not wait for a download');};
  await f.click(action);
  assert.match(f.html,/>Mehr Optionen</);assert.match(f.html,/role="dialog"/);
  assert.equal(f.context.waitingStart,false);assert.equal(f.context.working,false);assert.deepEqual(f.calls.notices,[]);
 }
});

test('An empty vocabulary options dialog explains pending download and offers collection navigation',async()=>{
 const f=actionFixture();f.d.collections={};f.d.words={};f.d.settings={};f.context.selected=[];
 f.context.cloudWait.blocked=true;f.context.sync.busy=true;
 f.context.waitForInitialSync=()=>{throw Error('Empty options should open immediately');};
 await f.click('training-options');
 assert.match(f.html,/Sammlungen werden geladen/);assert.match(f.html,/data-screen="collections"/);
 assert.match(f.html,/data-action="start-all" disabled/);assert.equal(f.context.working,false);
 assert.deepEqual(f.calls.notices,[]);assert.equal(f.calls.schedules,0);assert.equal(f.calls.activities.length,0);
});

test('Background sync cannot remove or replace an open More Options or Smart dialog',async()=>{
 for(const action of ['training-options','predicate-options','start']){
  const f=actionFixture();let finish;
  f.context.settleSync=()=>new Promise(resolve=>{finish=resolve;});
  const syncing=f.context.backgroundSync();await f.click(action);const opened=f.html;
  finish();await syncing;assert.equal(f.html,opened);assert.equal(f.calls.renders,0);assert.equal(f.context.working,false);
 }
});
