import test from 'node:test';
import assert from 'node:assert/strict';
import {Sync} from '../app/sync.js';
import {RestBridge} from '../app/rest-bridge.js';
import {emptyData,applyOps,rebase} from '../app/core.js';
import {settleSync} from '../app/multiuser-sync.js';
import {harness} from './google-harness.mjs';
import {openDatabase} from '../server/database.mjs';
import {apiServer} from '../server/http.mjs';

globalThis.window={addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});

const operation=(id,key,value,device='phone',entity='words')=>({id,entity,key,value,device,seq:1,at:1});
function fixture(t,{compact=true,pending=[],base=0,remote}={}){
 const requests=[];
 const store={profileId:'student',subject:'latin',doc:{profile:{id:'student'},config:{url:'https://example.test/api',token:'fixture'},shadow:emptyData(),pending,base},
  get data(){return applyOps(this.doc.shadow,this.doc.pending);},
  async update(change){this.doc=change(structuredClone(this.doc));}
 };
 const sync=new Sync(store);
 sync.bridge={...store.doc.config,request:async(action,payload)=>{
  requests.push({action,payload});
  if(action==='whoami')return {profile:{id:'student'},apiVersion:7,subjects:['latin','english','french'],...(compact?{compactSync:true,streakSummary:true}:{})};
  if(action==='pull')return typeof remote==='function'?remote():structuredClone(remote);
  return {version:0};
 },destroy(){}};
 t.after(()=>clearTimeout(sync.timer));
 return {store,sync,requests};
}

test('Compact reconciliation acknowledges overwritten uploads, reconstructs deletions and retains conflict choices',async t=>{
 const data=emptyData();data.words.changed={latin:'cloud'};data.words.equal={latin:'same'};
 const uploaded=operation('already-uploaded','changed',{latin:'earlier'});
 const pending=[uploaded,operation('edit','changed',{latin:'local'}),operation('deleted-edit','deleted',{latin:'keep'}),operation('equal-edit','equal',{latin:'same'})];
 const remote={version:8,data,changes:[
  {id:'last-cloud','device':'other',entity:'words',key:'changed',version:6},
  {id:'deletion','device':'other',entity:'words',key:'deleted',version:7},
  {id:'same-value','device':'other',entity:'words',key:'equal',version:8}
 ],acknowledged:['already-uploaded'],hasHistory:true};
 const f=fixture(t,{pending,remote});await f.sync.request('whoami');await f.sync.fetchRemote();
 const comparison=f.sync.compare();
 assert.deepEqual(comparison.pending.map(op=>op.id),['edit','deleted-edit','equal-edit']);
 assert.deepEqual(comparison.conflicts.map(item=>item.key),['words:changed','words:deleted']);
 assert.equal(comparison.conflicts[1].remote.value,null);
 const choices={'words:changed':'local','words:deleted':'cloud'};
 const legacy=[uploaded,operation('last-cloud','changed',data.words.changed,'other'),operation('deletion','deleted',null,'other'),operation('same-value','equal',data.words.equal,'other')];
 assert.deepEqual(f.sync.compare(choices),rebase(data,legacy,pending,choices));
 await f.sync.accept(choices);
 assert.deepEqual(f.store.data.words.changed,{latin:'local'});assert.equal(f.store.data.words.deleted,undefined);
 assert.deepEqual(f.store.doc.pending.map(op=>op.id),['edit','equal-edit']);assert.equal(f.store.doc.base,8);
});

test('Compact pull sends all pending IDs and a full reconciliation still starts at zero',async t=>{
 const pending=Array.from({length:251},(_,index)=>operation('offline-'+index,'word-'+index,{latin:'fixture'}));
 const f=fixture(t,{base:27,pending,remote:{version:27,data:emptyData(),changes:[],acknowledged:[],hasHistory:true}});
 await f.sync.request('whoami');await f.sync.fetchRemote(true);
 const pull=f.requests.find(request=>request.action==='pull');
 assert.equal(pull.payload.since,0);assert.equal(pull.payload.compact,1);
 assert.deepEqual(pull.payload.pendingIds,pending.map(op=>op.id));
 assert.equal(f.sync.compare().pending.length,251);
});

test('Server history removes obsolete bootstrap even when the compact delta and snapshot are empty',async t=>{
 const bootstrap={...operation('seed','seed',{id:'seed',name:'Starter'},'phone','collections'),bootstrap:true};
 const answer=operation('answer','review',{id:'review',grade:'full'},'phone','reviews');
 const f=fixture(t,{pending:[bootstrap,answer],remote:{version:5,data:emptyData(),changes:[],acknowledged:[],hasHistory:true}});
 await f.sync.request('whoami');await f.sync.fetchRemote();await f.sync.accept();
 assert.deepEqual(f.store.doc.pending,[answer]);assert.deepEqual(f.store.data.collections,{});
 assert.equal(f.store.data.reviews.review.grade,'full');
 const fresh=rebase(emptyData(),[],[bootstrap],{},{acknowledged:[],hasHistory:false});
 assert.deepEqual(fresh.pending,[bootstrap],'an untouched server must still receive the initial seed');
});

test('A deleted last cloud collection is not resurrected by the local starter collection',async t=>{
 const bootstrap={...operation('seed','seed',{id:'seed',name:'Starter'},'phone','collections'),bootstrap:true};
 const f=fixture(t,{pending:[bootstrap],remote:{version:2,data:emptyData(),changes:[{id:'delete-last',entity:'collections',key:'seed',device:'other',version:2}],acknowledged:[],hasHistory:true}});
 await f.sync.request('whoami');await f.sync.fetchRemote(true);await f.sync.accept();
 assert.equal(f.store.doc.pending.length,0);assert.deepEqual(f.store.data.collections,{});assert.equal(f.store.doc.base,2);
});

test('An edit added during the download is compared against every remotely changed key',async t=>{
 let release;const response=new Promise(resolve=>release=resolve),f=fixture(t,{remote:()=>response});
 await f.sync.request('whoami');const download=f.sync.fetchRemote();
 const newlyEdited=operation('new-local','new-key',{latin:'local'});f.store.doc.pending.push(newlyEdited);
 const data=emptyData();data.words['new-key']={latin:'remote'};
 release({version:1,data,changes:[{id:'remote','device':'other',entity:'words',key:'new-key',version:1}],acknowledged:[],hasHistory:true});
 await download;
 assert.deepEqual(f.requests.find(request=>request.action==='pull').payload.pendingIds,[]);
 assert.equal(f.sync.compare().conflicts[0].local.id,'new-local');
 await f.sync.accept({'words:new-key':'local'});assert.deepEqual(f.store.doc.pending,[newlyEdited]);
 assert.equal(f.store.data.words['new-key'].latin,'local');
});

test('An edit arriving after comparison but before the storage transaction is never overwritten',async t=>{
 const data=emptyData();data.words.w={latin:'remote'};
 const f=fixture(t,{remote:{version:1,data,changes:[{id:'remote',device:'other',entity:'words',key:'w',version:1}],acknowledged:[],hasHistory:true}});
 await f.sync.request('whoami');await f.sync.fetchRemote();
 const answer=operation('late-local','w',{latin:'late answer'}),update=f.store.update.bind(f.store);
 f.store.update=async change=>{f.store.doc.pending.push(answer);return update(change);};
 await assert.rejects(f.sync.accept(),/weitere lokale Änderungen/);
 assert.equal(f.store.doc.base,0);assert.deepEqual(f.store.doc.pending,[answer]);
 assert.equal(f.store.data.words.w.latin,'late answer');
});

test('Older servers keep the legacy pull request and reconciliation behavior',async t=>{
 const data=emptyData(),remoteOp=operation('cloud','w',{latin:'cloud'},'other');data.words.w=remoteOp.value;
 const f=fixture(t,{compact:false,base:2,remote:{version:3,data,ops:[remoteOp]}});
 await f.sync.request('whoami');assert.equal(f.sync.compactSync,false);assert.equal(f.sync.streakSummary,false);
 await f.sync.fetchRemote();assert.deepEqual(f.requests.at(-1).payload,{since:2,subject:'latin'});
 await f.sync.accept();assert.equal(f.store.data.words.w.latin,'cloud');assert.equal(f.store.doc.base,3);
});

test('Malformed compact replies cannot be accepted as an empty history or replace local data',async t=>{
 const valid={version:1,data:emptyData(),changes:[],acknowledged:[],hasHistory:true};
 for(const overrides of [{version:undefined},{changes:null},{data:undefined},{data:{}},{acknowledged:undefined},{changes:[{id:'bad'}]}]){
  const f=fixture(t,{pending:[operation('local','w',{latin:'saved'})],remote:{...valid,...overrides}}),before=structuredClone(f.store.doc);
  await f.sync.request('whoami');await assert.rejects(f.sync.fetchRemote(),/keinen gültigen Lernstand/);
  assert.equal(f.sync.remote,null);assert.deepEqual(f.store.doc,before);
 }
});

test('Summary capabilities belong to the verified connection and cross-subject streak remains read-only',async t=>{
 const f=fixture(t);assert.equal(f.sync.compactSync,false);assert.equal(f.sync.streakSummary,false);
 await f.sync.request('whoami');assert.equal(f.sync.compactSync,true);assert.equal(f.sync.streakSummary,true);
 assert.equal(f.store.doc.profile.compactSync,undefined);assert.equal(f.store.doc.profile.streakSummary,undefined);
 await f.sync.request('streak',{},'english');assert.equal(f.requests.at(-1).payload.subject,'english');
 await assert.rejects(f.sync.request('push',{base:0,ops:[]},'english'),/nur das Lesen/);
 await assert.rejects(f.sync.request('streak',{},'unknown'),/nur das Lesen/);
 f.store.doc.config.token='changed';assert.equal(f.sync.compactSync,false);assert.equal(f.sync.streakSummary,false);
});

test('Complete Pi HTTP sync preserves overwritten upload acknowledgments and matches the legacy snapshot in both subjects',async t=>{
 const seed=harness(),database=openDatabase(':memory:',{requireStudentCodes:true,enableAutoSharing:true}),admin='a'.repeat(64);
 database.importSnapshot({format:'latinio-pi-migration',schema:1,properties:seed.props,sheets:[...seed.sheets].map(([name,sheet])=>({name,rows:structuredClone(sheet.rows)}))});
 const profile=database.request({action:'profileCreate',token:admin,name:'Fixture',email:'fixture@example.test',allowedSubjects:['latin','english']}).profile;
 const {code}=database.request({action:'profileCodeGenerate',token:admin,profileId:profile.id});
 const {token}=database.request({action:'login',code});
 const server=apiServer(database);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));database.close();});
 const url='http://127.0.0.1:'+server.address().port+'/api';
 for(const subject of ['latin','english']){
  database.request({action:'push',token:admin,subject,base:0,ops:[operation(subject+'-collection','c',{id:'c',name:'Lesson'},'admin-device','collections'),operation(subject+'-word','w',{id:'w',collectionId:'c',latin:'vox',meanings:[['Stimme']]},'admin-device')]});
  const uploaded=operation(subject+'-uploaded','review',{id:'review',wordId:'w',grade:'full',at:1},'phone','reviews');
  let base=database.request({action:'check',subject,token}).version;
  database.request({action:'push',subject,token,base,ops:[uploaded]});
  base=database.request({action:'check',subject,token}).version;
  database.request({action:'push',subject,token,base,ops:[operation(subject+'-later','review',{id:'review',wordId:'w',grade:'partial',at:2},'other','reviews')]});
  const unsent=operation(subject+'-unsent','new-review',{id:'new-review',wordId:'w',grade:'full',at:3},'phone','reviews');
  const f=fixture(t,{pending:[uploaded,unsent]});f.store.profileId=profile.id;f.store.subject=subject;f.store.doc.profile={id:profile.id};f.store.doc.config.token=token;f.sync.subject=subject;
  const requests=[];
  f.sync.bridge=new RestBridge(f.store.doc.config.url,token,{fetchImpl:(_url,options)=>{requests.push(JSON.parse(options.body));return fetch(url,{...options,headers:{...options.headers,Origin:'https://tiagogt0000.github.io','Accept-Encoding':'gzip'}});}});
  await settleSync(f.sync,f.store);
  assert.equal(f.sync.status,'synced');assert.equal(f.sync.streakSummary,true);
  assert.equal(f.store.doc.pending.length,0);assert.equal(Object.keys(f.store.data.collections).length,1);
  assert.equal(f.store.data.reviews.review.grade,'partial','an acknowledged older upload cannot overwrite the later remote answer');
  assert.equal(f.store.data.reviews['new-review'].grade,'full');
  const pull=requests.find(request=>request.action==='pull');assert.equal(pull.compact,1);assert.deepEqual(pull.pendingIds,[uploaded.id,unsent.id]);
  assert.equal(requests.filter(request=>request.action==='whoami').length,1);
  assert.deepEqual(requests.find(request=>request.action==='push').ops.map(op=>op.id),[unsent.id]);
  const legacy=database.request({action:'pull',subject,token,since:0});assert.deepEqual(f.store.data,legacy.data);
  assert.equal(legacy.ops.filter(op=>op.id===uploaded.id).length,1);assert.equal(legacy.ops.filter(op=>op.id===unsent.id).length,1);
 }
});
