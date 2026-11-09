import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {canManageVocabulary,vocabularyAdmin,vocabularyFields} from '../app/vocab-admin.js';
import {emptyData} from '../app/core.js';
import {Sync} from '../app/sync.js';
Object.defineProperty(globalThis,'window',{value:{addEventListener(){}},configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const original={id:'w',collectionId:'c',latin:'la planète',meanings:[['der Planet']],forms:[],answerVariants:['la planète']};
function fixture(options={}){
 let profile={role:'student',allowedSubjects:['latin','english','french'],vocabAdminSubjects:['french'],...options.profile},html='',buttons=[],closed=0;
 const requests=[],events=[],saved=[],notifications=[],status={textContent:''},store={data:emptyData(),doc:{pending:[]}};
 store.data.collections.c={id:'c',name:'Lernwoche 1'};store.data.words.w=structuredClone(original);
 store.commit=async changes=>{events.push('commit');for(const [entity,key,value] of changes)value===null?delete store.data[entity][key]:store.data[entity][key]=value;};
 const sync={status:'synced',message:'',remote:null,schedule(){events.push('schedule');},async run(){events.push('sync');await options.onSync?.({store,sync});},async request(action,payload,subject){requests.push({action,payload:structuredClone(payload),subject});events.push(action);if(options.request)return options.request(action,payload,subject);if(action==='vocabAdminWord')return {eligible:true,revision:'revision-1',localBefore:structuredClone(original)};if(action==='vocabAdminHistory')return {changes:[],nextBefore:null};return {ok:true};}};
 const modalRoot={querySelector(selector){if(selector==='[data-vocab-status]')return html.includes('data-vocab-status')?status:null;const key=selector.slice(1,-1);return html.includes(key)?{}:null;},querySelectorAll(){return buttons;}};
 const ui=vocabularyAdmin({store,sync,getProfile:()=>profile,subject:options.subject||'french',h:escape,modalRoot,
  showModal(markup){html=markup;buttons=[...markup.matchAll(/<button\b([^>]*)>/g)].map(([,attrs])=>({disabled:/\bdisabled\b/.test(attrs)}));},closeModal(){closed++;html='';},notify(text){notifications.push(text);},
  async saveLocal(word){events.push('private');await options.saveLocal?.(word);saved.push(structuredClone(word));await store.commit([['words',word.id,word]]);closed++;html='';},async onPublished(id){events.push('published:'+id);await options.onPublished?.(id);}});
 return {ui,store,sync,requests,events,saved,notifications,status,get profile(){return profile;},set profile(value){profile=value;},get html(){return html;},get buttons(){return buttons;},get closed(){return closed;},handle(action,subject){return ui.handle({dataset:{action,...(subject?{subject}:{})}});},draft(overrides={}){return {...structuredClone(original),meanings:[['der Himmelskörper']],...overrides};}};
}

test('Vocabulary grants require both subject access and an explicit subject grant; primary admins keep their separate workflow',()=>{
 for(const profile of [undefined,{}, {role:'student',allowedSubjects:['french']},{role:'student',allowedSubjects:['latin'],vocabAdminSubjects:['french']},{role:'admin',allowedSubjects:['french'],vocabAdminSubjects:['french']}])assert.equal(canManageVocabulary(profile,'french'),false);
 assert.equal(canManageVocabulary({role:'student',allowedSubjects:['french'],vocabAdminSubjects:['french']},'french'),true);
 const f=fixture({profile:{vocabAdminSubjects:[]}});f.ui.prepare(original);assert.equal(f.ui.offer(f.draft()),false);assert.equal(f.requests.length,0);
 const allowed=fixture();allowed.ui.prepare(undefined);assert.equal(allowed.ui.offer(allowed.draft({id:'new'})),false);assert.equal(allowed.requests.length,0);
});

test('Submitting a changed existing word shows an immediate choice while metadata is loading without saving anything',async()=>{
 const gate=deferred(),f=fixture({request:()=>gate.promise});f.ui.prepare(original);
 assert.equal(f.ui.offer(f.draft()),true);assert.match(f.html,/Änderung für alle übernehmen/);assert.match(f.html,/Berechtigung wird geprüft/);
 assert.equal(f.buttons[0].disabled,true);assert.equal(f.buttons[1].disabled,false);assert.deepEqual(f.events,['vocabAdminWord']);assert.deepEqual(f.saved,[]);assert.deepEqual(f.store.data.words.w,original);
 gate.resolve({eligible:true,revision:'rev',localBefore:structuredClone(original)});await tick();assert.equal(f.buttons[0].disabled,false);
});

test('Declining publication saves only the private draft and never publishes',async()=>{
 const f=fixture();f.ui.prepare(original);await tick();const draft=f.draft();assert.equal(f.ui.offer(draft),true);
 await f.handle('vocab-private-save');assert.deepEqual(f.saved,[draft]);assert.deepEqual(f.store.data.words.w,draft);assert.equal(f.requests.filter(r=>r.action==='vocabAdminPublish').length,0);
 assert.equal(f.ui.busy,false);assert.equal(f.closed,1);
});

test('Confirming publishes first with the captured revision and fields, then refreshes without a private commit',async()=>{
 const gate=deferred(),f=fixture({request:async(action,payload)=>action==='vocabAdminWord'?{eligible:true,revision:'captured',localBefore:structuredClone(original)}:gate.promise});
 f.ui.prepare(original);await tick();const draft=f.draft();f.ui.offer(draft);const publish=f.handle('vocab-publish');await tick();
 assert.equal(f.ui.busy,true);assert.deepEqual(f.events,['vocabAdminWord','vocabAdminPublish']);assert.deepEqual(f.saved,[]);assert.deepEqual(f.store.data.words.w,original);
 const request=f.requests[1];assert.equal(request.payload.confirmed,true);assert.equal(request.payload.revision,'captured');assert.equal(request.payload.wordId,'w');assert.deepEqual(request.payload.word,vocabularyFields(draft));assert.ok(request.payload.requestId);
 await f.handle('vocab-publish');assert.equal(f.requests.length,2,'double taps must not create another publication');
 gate.resolve({ok:true});await publish;assert.deepEqual(f.events,['vocabAdminWord','vocabAdminPublish','sync','published:w']);assert.equal(f.saved.length,0);assert.equal(f.closed,1);
});

test('An uncertain publication is retried with the same operation ID and never silently saved privately',async()=>{
 let attempts=0;const f=fixture({request:async action=>{if(action==='vocabAdminWord')return {eligible:true,revision:'rev',localBefore:structuredClone(original)};if(++attempts===1)throw Error('Verbindung unterbrochen');return {ok:true};}});
 f.ui.prepare(original);await tick();f.ui.offer(f.draft());await assert.rejects(f.handle('vocab-publish'),/Verbindung unterbrochen/);
 assert.equal(f.ui.busy,false);assert.equal(f.buttons[0].disabled,false);assert.equal(f.saved.length,0);assert.equal(f.closed,0);assert.match(f.status.textContent,/Verbindung unterbrochen/);
 await f.handle('vocab-publish');const attemptsSent=f.requests.filter(r=>r.action==='vocabAdminPublish');assert.equal(attemptsSent.length,2);assert.deepEqual(attemptsSent[0].payload,attemptsSent[1].payload);assert.equal(f.saved.length,0);
});

test('A confirmed publication remains confirmed when refresh fails and cannot be submitted again',async()=>{
 const f=fixture({onSync(){throw Error('Download fehlgeschlagen');}});f.ui.prepare(original);await tick();f.ui.offer(f.draft());await f.handle('vocab-publish');await f.handle('vocab-publish');
 assert.equal(f.requests.filter(r=>r.action==='vocabAdminPublish').length,1);assert.equal(f.saved.length,0);assert.equal(f.closed,1);assert.match(f.notifications.at(-1),/Änderung für alle übernommen/);
});

test('Metadata errors keep publication disabled and permit an explicit retry or private choice',async()=>{
 let attempts=0;const f=fixture({request:async()=>{if(++attempts===1)throw Error('Keine Verbindung');return {eligible:true,revision:'retry-rev',localBefore:structuredClone(original)};}});
 f.ui.prepare(original);await tick();assert.equal(f.ui.offer(f.draft()),true);assert.match(f.html,/Keine Verbindung/);assert.equal(f.buttons[0].disabled,true);assert.equal(f.saved.length,0);
 await assert.rejects(f.handle('vocab-publish'),/Berechtigung/);assert.equal(f.requests.length,1);
 await f.handle('vocab-prepare-retry');await tick();assert.equal(f.buttons[0].disabled,false);assert.equal(f.requests.length,2);
});

test('An unmapped personal word never offers global publication and unchanged words stay private',async()=>{
 const f=fixture({request:async()=>({eligible:false})});f.ui.prepare(original);await tick();assert.equal(f.ui.offer(f.draft()),false);assert.equal(f.html,'');assert.equal(f.saved.length,0);
 const unchanged=fixture();unchanged.ui.prepare(original);await tick();assert.equal(unchanged.ui.offer(structuredClone(original)),false);
});

test('Revoked access is checked again at confirmation and cannot publish',async()=>{
 for(const changes of [{vocabAdminSubjects:[]},{allowedSubjects:['latin']}]){
  const f=fixture();f.ui.prepare(original);await tick();f.ui.offer(f.draft());f.profile={...f.profile,...changes};
  await assert.rejects(f.handle('vocab-publish'),/nicht mehr/);assert.equal(f.requests.filter(r=>r.action==='vocabAdminPublish').length,0);assert.equal(f.saved.length,0);
 }
});

test('A mismatched server snapshot or changed current word prevents stale publication',async()=>{
 const stale=fixture({request:async()=>({eligible:true,revision:'rev',localBefore:{...original,meanings:[['eine andere Bedeutung']]}})});stale.ui.prepare(original);await tick();stale.ui.offer(stale.draft());assert.match(stale.html,/inzwischen geändert/);assert.equal(stale.buttons[0].disabled,true);
 await assert.rejects(stale.handle('vocab-publish'),/Berechtigung/);assert.equal(stale.requests.length,1);
 for(const mutate of [store=>store.data.words.w.meanings=[['anders']],store=>delete store.data.words.w]){
  const f=fixture();f.ui.prepare(original);await tick();f.ui.offer(f.draft());mutate(f.store);await assert.rejects(f.handle('vocab-publish'),/inzwischen geändert/);assert.equal(f.requests.length,1);assert.equal(f.saved.length,0);
 }
});

test('A word moved to a different collection after opening cannot be published from a stale editor',async()=>{
 const f=fixture();f.ui.prepare(original);await tick();f.ui.offer(f.draft());f.store.data.words.w.collectionId='moved';
 await assert.rejects(f.handle('vocab-publish'),/geändert|Sammlung/);assert.equal(f.requests.length,1);assert.equal(f.saved.length,0);
});

test('Private save errors leave the draft and choice usable for an explicit retry',async()=>{
 let attempts=0;const f=fixture({saveLocal:async()=>{if(++attempts===1)throw Error('Speichern fehlgeschlagen');}});f.ui.prepare(original);await tick();f.ui.offer(f.draft());
 await assert.rejects(f.handle('vocab-private-save'),/Speichern fehlgeschlagen/);assert.equal(f.ui.busy,false);assert.equal(f.buttons[1].disabled,false);assert.match(f.status.textContent,/Speichern fehlgeschlagen/);assert.equal(f.closed,0);assert.equal(f.saved.length,0);
 await f.handle('vocab-private-save');assert.equal(f.saved.length,1);assert.equal(f.requests.filter(r=>r.action==='vocabAdminPublish').length,0);
});

test('Only the primary admin can open or switch audit history',async()=>{
 const f=fixture();for(const action of ['vocab-history','vocab-history-subject','vocab-history-more'])assert.equal(await f.handle(action,'latin'),true);
 assert.equal(f.requests.length,0);assert.equal(f.html,'');
 const admin=fixture({profile:{role:'admin'}});await admin.handle('vocab-history');assert.equal(admin.requests[0].action,'vocabAdminHistory');assert.equal(admin.requests[0].subject,'french');assert.match(admin.html,/Noch keine Änderungen/);
 await admin.handle('vocab-history-subject','english');assert.equal(admin.requests[1].subject,'english');assert.match(admin.html,/data-subject="english" aria-pressed="true"/);
});

test('Audit pagination deduplicates changes, escapes content and does not overwrite a newer subject with a stale response',async()=>{
 const french=deferred(),calls=[];
 const change={id:'change-1',actorName:'<script>bad</script>',at:1,before:{latin:'old',meanings:[['canonical before']]},editorBefore:{latin:'old',meanings:[['editor before']]},after:{latin:'<img src=x>',meanings:[['after']]},collectionName:'<Unsafe>',users:3};
 const f=fixture({profile:{role:'admin'},request:async(action,payload,subject)=>{calls.push({payload,subject});return subject==='french'?french.promise:{changes:[change],nextBefore:payload.before?null:123};}});
 const pending=f.handle('vocab-history');await f.handle('vocab-history-subject','english');assert.match(f.html,/&lt;script&gt;bad/);assert.doesNotMatch(f.html,/<script>|<img src=x>/);assert.match(f.html,/editor before/);assert.doesNotMatch(f.html,/canonical before/);assert.match(f.html,/after/);
 french.resolve({changes:[{...change,id:'french-change',after:{latin:'ancien'}}],nextBefore:null});await pending;assert.doesNotMatch(f.html,/ancien/);
 await f.handle('vocab-history-more');assert.equal(calls.at(-1).payload.before,123);assert.equal((f.html.match(/vocab-audit-entry/g)||[]).length,1);assert.doesNotMatch(f.html,/Weitere Änderungen/);
});

test('Cross-subject audit transport rejects delegates before sending any request',async()=>{
 for(const action of ['vocabAdminHistory','vocabAdminPublish']){
  const store={profileId:'student-id',subject:'french',doc:{config:{url:'https://example.test',token:'token'}}};const sync=new Sync(store);sync.subject='french';
  await assert.rejects(sync.request(action,{},'english'),/Fachübergreifend/);
 }
});

test('Queued changes to the edited word or its collection block publication until they have synced, then the same confirmation can retry',async()=>{
 for(const op of [
  {id:'noop-word',entity:'words',key:'w',value:structuredClone(original)},
  {id:'delete-word',entity:'words',key:'w',value:null},
  {id:'collection-name',entity:'collections',key:'c',value:{id:'c',name:'Neuer Name'}},
 ]){
  const f=fixture();f.store.doc.pending=[structuredClone(op)];f.ui.prepare(original);await tick();const draft=f.draft();f.ui.offer(draft);
  await assert.rejects(f.handle('vocab-publish'),/synchron|abgeglichen|Abgleich|übertragen|geladen|gespeichert/i,op.id);
  assert.deepEqual(f.requests.map(request=>request.action),['vocabAdminWord'],op.id+' must not reach the publication endpoint');
  assert.ok(f.events.includes('schedule'),'the pending operation needs a sync retry');assert.equal(f.ui.busy,false);assert.equal(f.buttons[0].disabled,false);
  assert.equal(f.closed,0);assert.match(f.html,/Änderung für alle übernehmen/);assert.equal(f.saved.length,0);assert.deepEqual(f.store.doc.pending,[op]);assert.deepEqual(f.store.data.words.w,original);
  f.store.doc.pending=[];
  await f.handle('vocab-publish');
  const publication=f.requests.find(request=>request.action==='vocabAdminPublish');assert.ok(publication,op.id+' retries after reconciliation');
  assert.equal(publication.payload.revision,'revision-1');assert.deepEqual(publication.payload.word,vocabularyFields(draft));assert.equal(publication.payload.confirmed,true);
  assert.equal(f.requests.filter(request=>request.action==='vocabAdminWord').length,1,'the valid draft and captured revision remain available');
  assert.equal(f.saved.length,0);assert.equal(f.closed,1);
 }
});

test('Pending reviews and unrelated word or collection edits do not block a vocabulary publication',async()=>{
 const pending=[
  {id:'review',entity:'reviews',key:'w',value:{wordId:'w',grade:'full'}},
  {id:'different-word',entity:'words',key:'other',value:{...original,id:'other'}},
  {id:'different-collection',entity:'collections',key:'other',value:{id:'other',name:'Andere Sammlung'}},
 ];
 const f=fixture({onSync({store}){assert.deepEqual(store.doc.pending,pending,'unrelated pending work is retained until the normal sync');store.doc.pending=[];}});
 f.store.doc.pending=structuredClone(pending);f.ui.prepare(original);await tick();f.ui.offer(f.draft());await f.handle('vocab-publish');
 assert.deepEqual(f.events,['vocabAdminWord','vocabAdminPublish','sync','published:w']);assert.equal(f.saved.length,0);assert.equal(f.closed,1);
 assert.equal(f.requests.filter(request=>request.action==='vocabAdminPublish').length,1);
});
