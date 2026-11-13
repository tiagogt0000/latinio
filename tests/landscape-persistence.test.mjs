import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createLandscape} from '../server/landscape.mjs';
import {createLandscapeStore,mergeLandscapeResponse} from '../app/landscape-store.js';
import {buildRound,currentTask,submitAnswer,emptyLandscape,validateExam,DAY} from '../app/landscape-engine.js';

const T=Date.parse('2026-11-13T12:00:00Z'),admin={id:'admin',role:'admin'};
const data=()=>({collections:{one:{id:'one',name:'Eine Lektion'}},words:{w1:{id:'w1',collectionId:'one',latin:'servus',meanings:[['Sklave']]},w2:{id:'w2',collectionId:'one',latin:'dominus',meanings:[['Herr']]}},reviews:{old:{id:'old',wordId:'w1',grade:'full',at:T-DAY}},settings:{keep:{kind:'legacy',value:1}}});
function fixture(){const db=new DatabaseSync(':memory:');return {db,service:createLandscape(db,{now:()=>T+DAY})};}
function round(mutationId='m1',baseVersion=0){return {...buildRound({data:data(),kind:'write',collectionId:'one',roundId:'round1',now:T}),mutationId,baseVersion,deviceId:'device1'};}
const syncBody=extra=>({action:'landscapeSync',cursor:0,events:[],rounds:[],exams:[],...extra});

test('all landscape actions require an authenticated admin, including content',()=>{
  const {db,service}=fixture();
  for(const action of ['landscapePull','landscapeSync','landscapeCatalogue','landscapeSentences'])for(const identity of [null,{id:'student',role:'student'},{id:'admin',role:'student'}])assert.throws(()=>service.request({action,collectionId:'one'},identity),/nur für den Admin/);
  assert.deepEqual(service.request({action:'landscapePull'},admin).events,[]);db.close();
});
test('events are immutable and idempotent; conflicting replay rolls back its entire batch',()=>{
  const {db,service}=fixture(),r=round(),event=submitAnswer(r,['falsch'],{now:T,eventId:'event1'}).event;
  const payload=syncBody({events:[event],rounds:[r]});
  const first=service.request(payload,admin),second=service.request(payload,admin);
  assert.equal(first.events.length,1);assert.equal(second.events.length,1);assert.equal(second.rounds[0].serverVersion,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM landscape_events').get().n,1);
  assert.throws(()=>service.request(syncBody({events:[{...event,id:'new-event'},{...event,correct:true}]}),admin),/bereits zu einer anderen Bewertung/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM landscape_events').get().n,1);db.close();
});
test('snapshot optimistic concurrency preserves both device drafts with a resumable branch',()=>{
  const {db,service}=fixture();let first=service.request(syncBody({rounds:[round()]}),admin);
  const a={...round('deviceA-edit',1),draft:{answers:['Sklave']},revision:1,updatedAt:T+1000};
  const b={...round('deviceB-edit',1),deviceId:'device2',draft:{answers:['Herr']},revision:1,updatedAt:T+1000};
  service.request(syncBody({rounds:[a],cursor:first.cursor}),admin);
  const result=service.request(syncBody({rounds:[b],cursor:first.cursor}),admin);
  assert.equal(result.conflicts.length,1);const branch=result.acceptedRounds[0].id;assert.notEqual(branch,'round1');
  const pulled=service.request({action:'landscapePull',cursor:0},admin);
  assert.equal(pulled.rounds.length,2);assert.deepEqual(pulled.rounds.find(r=>r.id==='round1').draft,{answers:['Sklave']});assert.deepEqual(pulled.rounds.find(r=>r.id===branch).draft,{answers:['Herr']});
  const repeated=service.request(syncBody({rounds:[b],cursor:result.cursor}),admin);assert.equal(repeated.acceptedRounds[0].id,branch);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM landscape_rounds').get().n,2);db.close();
});
test('draft idempotency receipts do not duplicate task and vocabulary payloads',()=>{
  const {db,service}=fixture();service.request(syncBody({rounds:[round()]}),admin);
  const changed={...round('second-draft',1),draft:{answers:['Eine neue Eingabe']},revision:1};service.request(syncBody({rounds:[changed]}),admin);
  const receipts=db.prepare('SELECT hash,value,result FROM landscape_snapshots').all();
  assert.equal(receipts.length,2);assert(receipts.every(row=>row.value==='{}' && row.hash.length===64 && !row.result.includes('tasks') && !row.result.includes('meanings')));
  const restored=service.request({action:'landscapePull',cursor:0},admin);assert.deepEqual(restored.rounds[0].draft.answers,['Eine neue Eingabe']);
  const replay=service.request(syncBody({rounds:[round()]}),admin);assert.equal(replay.acceptedRounds[0].serverVersion,1);assert.equal(db.prepare('SELECT version FROM landscape_rounds').get().version,2);db.close();
});
test('client conflict merge keeps the active local branch and any draft typed during the request',()=>{
  const state={...emptyLandscape(),pendingEvents:[],dirtyRounds:{round1:{mutationId:'new-draft',baseVersion:1}},dirtyExams:{},rounds:{round1:{...round(),draft:{answers:['latest typed']}}},activeRoundId:'round1'};
  const merged=mergeLandscapeResponse(state,{acceptedRounds:[{localId:'round1',id:'branch1',mutationId:'old-draft',serverVersion:1}],rounds:[{...round(),serverVersion:2,draft:{answers:['other device']}}],events:[],exams:[],cursor:10});
  assert.equal(merged.activeRoundId,'branch1');assert.deepEqual(merged.rounds.branch1.draft.answers,['latest typed']);assert.equal(merged.dirtyRounds.branch1.mutationId,'new-draft');assert.equal(merged.dirtyRounds.branch1.baseVersion,1);assert.deepEqual(merged.rounds.round1.draft.answers,['other device']);
});
test('a late acknowledgement cannot roll a newer local server revision backwards',()=>{
  const state={...emptyLandscape(),pendingEvents:[],dirtyRounds:{round1:{mutationId:'newest',baseVersion:3}},dirtyExams:{},rounds:{round1:{...round(),serverVersion:3,draft:{answers:['Newest']}}},activeRoundId:'round1'};
  const merged=mergeLandscapeResponse(state,{acceptedRounds:[{localId:'round1',id:'round1',mutationId:'old-request',serverVersion:1}],rounds:[],events:[],exams:[],cursor:1});
  assert.equal(merged.rounds.round1.serverVersion,3);assert.equal(merged.dirtyRounds.round1.baseVersion,3);assert.deepEqual(merged.rounds.round1.draft.answers,['Newest']);
});
test('ended exam is not revived by an older offline copy and profile data remains isolated',()=>{
  const {db,service}=fixture();const exam={...validateExam({id:'exam',date:'2026-11-16',collectionIds:['one']},{now:T}),mutationId:'exam-start',deviceId:'d1'};
  service.request(syncBody({exams:[exam]}),admin);
  service.request(syncBody({exams:[{...exam,endedAt:T+1000,updatedAt:T+1000,mutationId:'exam-end'}]}),admin);
  const stale=service.request(syncBody({exams:[{...exam,mutationId:'old-offline'}]}),admin);
  assert.equal(stale.exams[0].endedAt,T+1000);
  assert.equal(service.request({action:'landscapePull'}, {id:'other-admin',role:'admin'}).exams.length,0);db.close();
});
test('validation rejects malformed ids and oversized/unknown mutations before writing',()=>{
  const {db,service}=fixture();
  assert.throws(()=>service.request(syncBody({rounds:[{...round(),id:'__proto__'}]}),admin),/Ungültig/);
  assert.throws(()=>service.request(syncBody({rounds:[{...round(),queue:['not-a-task']}]}),admin),/warteschlange/);
  assert.throws(()=>service.request({action:'landscapeUnknown'},admin),/Unbekannte/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM landscape_rounds').get().n,0);db.close();
});
test('shared inventory distinguishes existing lessons from future uploads on a second device',()=>{
  const {db,service}=fixture();
  const first=service.request(syncBody({inventory:[{id:'old',wordIds:['old-word'],firstSeenAt:T}]}),admin);
  assert.equal(first.inventory.old.new,false);
  const second=service.request(syncBody({inventory:[{id:'old',wordIds:['old-word'],firstSeenAt:T},{id:'new',wordIds:['new-word'],firstSeenAt:T+1}],cursor:first.cursor}),admin);
  assert.equal(second.inventory.new.new,true);
  const replica=mergeLandscapeResponse({...emptyLandscape(),pendingEvents:[],dirtyRounds:{},dirtyExams:{}},service.request({action:'landscapePull',cursor:0},admin));
  assert.equal(replica.inventory.old.new,false);assert.equal(replica.inventory.new.new,true);assert.equal(replica.inventoryInitialized,true);
  const changed=service.request(syncBody({inventory:[{id:'old',wordIds:['old-word','added-word'],firstSeenAt:T}],cursor:second.cursor}),admin);
  assert.equal(changed.inventory.old.new,true);db.close();
});

class LocalStore extends EventTarget {
  constructor(device='local'){super();this.profileId='admin';this.subject='latin';this.doc={device,seq:0,pending:[],shadow:data(),config:{url:'https://example.test/api',token:'test-token'},profile:admin};this.queue=Promise.resolve();}
  get data(){return this.doc.shadow;}
  update(fn){const promise=this.queue.then(()=>{this.doc=fn(structuredClone(this.doc));this.dispatchEvent(new Event('change'));return this.doc;});this.queue=promise.catch(()=>{});return promise;}
}
test('offline events, feedback and drafts survive reload, sync once, and preserve classic history',async()=>{
  const {db,service}=fixture(),store=new LocalStore();let online=false;
  const sync={configured:true,request:async(action,payload)=>{if(!online)throw Error('offline');return service.request({action,...payload},admin);},schedule(){}};
  const original=structuredClone(store.data);
  let client=createLandscapeStore({store,sync,profile:admin,now:()=>T});await client.load();
  await client.start({kind:'write',collectionId:'one'});await client.updateDraft({answers:['Meine Eingabe'],flipped:true});
  const roundId=client.activeRound.id;await client.flush();assert.equal(client.activeRound.draft.answers[0],'Meine Eingabe');
  const answer=currentTask(client.activeRound).word.meanings[0][0];await client.answer([answer]);await client.pause();await client.flush();client.destroy();
  client=createLandscapeStore({store,sync,profile:admin,now:()=>T});await client.load();
  assert.equal(client.activeRound.id,roundId);assert.equal(client.activeRound.phase,'feedback');assert.equal(client.activeRound.paused,true);assert.equal(client.state.pendingEvents.length,1);
  online=true;await client.flush();assert.equal(client.state.pendingEvents.length,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM landscape_events').get().n,1);
  await client.flush();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM landscape_events').get().n,1);assert.deepEqual(store.data,original);client.destroy();db.close();
});
test('round completion creates ordinary streak settings without false classic review evidence',async()=>{
  const store=new LocalStore(),client=createLandscapeStore({store,sync:{configured:false},profile:admin,now:()=>T});await client.load();
  await client.start({kind:'cards',collectionId:'one'});
  while(client.activeRound.phase!=='complete'){if(client.activeRound.phase==='feedback')await client.next();else await client.answer(true);}
  assert.equal(store.doc.pending.filter(op=>op.value?.kind==='streakDay').length,1);assert.deepEqual(Object.keys(store.data.reviews),['old']);
  await client.start({kind:'cards',collectionId:'one'});
  while(client.activeRound.phase!=='complete'){if(client.activeRound.phase==='feedback')await client.next();else await client.answer(true);}
  assert.equal(store.doc.pending.filter(op=>op.value?.kind==='streakDay').length,1);client.destroy();
});
test('local serialized draft edits cannot overwrite answer feedback; non-admin has no local access',async()=>{
  const store=new LocalStore(),client=createLandscapeStore({store,sync:{configured:false},profile:admin,now:()=>T});await client.load();await client.start({kind:'write',collectionId:'one'});
  const word=currentTask(client.activeRound).word;
  await Promise.all([client.updateDraft({answers:['Draft']}),client.answer([word.meanings[0][0]])]);
  assert.equal(client.activeRound.phase,'feedback');assert.equal(client.state.events.length,1);client.destroy();
  const blocked=createLandscapeStore({store,sync:{configured:false},profile:{id:'student',role:'student'}});await assert.rejects(()=>blocked.load(),/nur für den Admin/);blocked.destroy();
});
test('wrong matching taps persist before completing the set and are not counted twice',async()=>{
  const store=new LocalStore(),client=createLandscapeStore({store,sync:{configured:false},profile:admin,now:()=>T});await client.load();await client.start({kind:'matching',collectionId:'one'});
  const task=currentTask(client.activeRound),mistakes=[{wordId:task.words[0].id,meaningWordId:task.words[1].id}];
  await client.updateDraft({mistakes});assert.equal(client.state.events.length,1);assert.equal(client.state.events[0].correct,false);
  await client.pause();assert.equal(client.state.pendingEvents.length,1);
  await client.resume();await client.answer({pairs:task.words.map(w=>({wordId:w.id,meaningWordId:w.id})),mistakes});
  assert.equal(client.state.events.length,2);assert.equal(client.state.events.filter(e=>!e.correct).length,1);client.destroy();
});
test('new sentence rounds revalidate online; active snapshots stay frozen and offline rounds use cache',async()=>{
  const store=new LocalStore();let fail=false,calls=0;
  const makeSentence=(id,latin)=>({id,collectionId:'one',latin,tokens:[{text:'Servus',wordId:'w1'}],translations:[['der Sklave','ist da']],distractors:['morgen','nicht'],focusWordIds:['w1'],tense:'present',difficulty:1});
  let corpus=[makeSentence('sentence-v1','Servus adest.')];
  const sync={configured:true,request:async(action)=>{
    if(action==='landscapeSentences'){calls++;if(fail)throw Error('offline');return {sentences:structuredClone(corpus)};}
    return {events:[],rounds:[],exams:[],inventory:{},cursor:0,ackEventIds:[],acceptedRounds:[],acceptedExams:[]};
  }};
  const client=createLandscapeStore({store,sync,profile:admin,now:()=>T});await client.load();
  await client.start({kind:'sentence',collectionId:'one'});const firstRound=client.activeRound.id;
  assert.equal(currentTask(client.activeRound).sentence.id,'sentence-v1');
  corpus=[makeSentence('sentence-v2','Servus hic adest.')];
  const refreshed=await client.sentences('one');assert.equal(refreshed[0].id,'sentence-v2');
  assert.equal(currentTask(client.activeRound).sentence.id,'sentence-v1');
  await client.start({kind:'sentence',collectionId:'one'});assert.equal(currentTask(client.activeRound).sentence.id,'sentence-v2');
  assert.equal(currentTask(client.state.rounds[firstRound]).sentence.id,'sentence-v1');assert.equal(calls,3);
  fail=true;await client.start({kind:'sentence',collectionId:'one'});assert.equal(currentTask(client.activeRound).sentence.id,'sentence-v2');
  assert.match(client.state.contentError,/offline/);client.destroy();
});
