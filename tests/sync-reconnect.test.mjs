import test from 'node:test';
import assert from 'node:assert/strict';
import {Sync,GoogleBridge,needsFullSync,FULL_SYNC_INTERVAL} from '../app/sync.js';
globalThis.window={addEventListener(){}};
test('Unknown administrative actions retry once through a fresh bridge',async()=>{
 const store={doc:{config:{url:'https://example.test',token:'test'}}};const sync=new Sync(store);let destroyed=0,calls=0;
 sync.bridge={url:store.doc.config.url,token:'test',request:async()=>{throw Error('Unbekannte Aktion.');},destroy(){destroyed++;}};
 const original=GoogleBridge.prototype.request;GoogleBridge.prototype.request=async function(action,payload){calls++;assert.equal(action,'shareRevoke');assert.equal(payload.shareId,'share');return {ok:true};};
 try{assert.deepEqual(await sync.request('shareRevoke',{shareId:'share'}),{ok:true});assert.equal(destroyed,1);assert.equal(calls,1);}finally{GoogleBridge.prototype.request=original;}
});
test('Network and authorization failures are not retried as administrative mutations',async()=>{
 const sync=new Sync({doc:{config:{url:'https://example.test',token:'test'}}});let calls=0;
 sync.bridge={url:'https://example.test',token:'test',request:async()=>{calls++;throw Error('Nur für das Admin-Profil.');},destroy(){throw Error('Unexpected reconnect');}};
 await assert.rejects(sync.request('shareRevoke'),/Admin/);assert.equal(calls,1);
});
test('Persisted full reconciliation lets ordinary app openings use only the version check',()=>{
 const now=10*FULL_SYNC_INTERVAL,store={doc:{lastFullSync:now-FULL_SYNC_INTERVAL/2,config:{url:'https://example.test',token:'test'}}};
 assert.equal(needsFullSync(store.doc,now),false);assert.equal(needsFullSync({lastFullSync:now-FULL_SYNC_INTERVAL-1},now),true);assert.equal(needsFullSync({},now),true);
 assert.equal(new Sync(store).lastFullSync,store.doc.lastFullSync);
});
test('English refuses old deployments before a check or upload, including after offline work',async()=>{
 const store={subject:'english',doc:{config:{url:'https://example.test',token:'test'}}},sync=new Sync(store),actions=[];
 sync.bridge={url:store.doc.config.url,token:'test',request:async action=>{actions.push(action);return {apiVersion:2};},destroy(){}};
 await assert.rejects(sync.request('push',{base:0,ops:[]}),/aktualisierte Google-Skript/);
 assert.deepEqual(actions,['whoami']);
});
test('English verifies support once per bridge, then passes its subject on every request',async()=>{
 const store={subject:'english',doc:{config:{url:'https://example.test',token:'test'}}},sync=new Sync(store),requests=[];
 sync.bridge={url:store.doc.config.url,token:'test',request:async(action,payload)=>{requests.push([action,payload]);return action==='whoami'?{apiVersion:3,subjects:['latin','english']}:{version:0};},destroy(){}};
 await sync.request('check');await sync.request('pull',{since:0});
 assert.deepEqual(requests.map(x=>x[0]),['whoami','check','pull']);assert.ok(requests.every(x=>x[1].subject==='english'));
});

test('Expired and revoked sessions request a fresh login; network and subject errors do not',async()=>{
 for(const [message,expected]of [['Bitte erneut anmelden.',1],['Bitte melde dich mit deinem Zugangscode neu an.',1],['Dieses Profil ist nicht freigeschaltet.',1],['Dieses Lernfach ist nicht freigeschaltet.',0],['Load failed',0]]){
  const sync=new Sync({doc:{config:{url:'https://example.test/api',token:'fixture'}}});let logins=0;
  sync.addEventListener('authentication-required',()=>logins++);
  sync.bridge={url:'https://example.test/api',token:'fixture',request:async()=>{throw Error(message);},destroy(){}};
  await assert.rejects(sync.request('check'),{message});assert.equal(logins,expected,message);
 }
});

test('Background sync verifies cached identity before cloud access, including admins with a recent full sync',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 let writes=0;
 const store={profileId:'admin',doc:{config:{url:'https://example.test/api',token:'fixture'},profile:{id:'admin',name:'Old'},lastFullSync:Date.now(),base:0,pending:[]},async update(change){writes++;this.doc=change(structuredClone(this.doc));}};
 const sync=new Sync(store),actions=[],profiles=[];
 sync.addEventListener('profile-updated',event=>profiles.push(event.profile));
 sync.bridge={url:store.doc.config.url,token:'fixture',request:async action=>{actions.push(action);return action==='whoami'?{profile:{id:'admin',name:'New'}}:{version:0};},destroy(){}};
 await sync.run();assert.deepEqual(actions,['whoami','check']);assert.equal(sync.status,'synced');
 assert.equal(store.doc.profile.name,'New');assert.deepEqual(profiles,[{id:'admin',name:'New'}]);assert.equal(writes,2);
 actions.length=0;await sync.run();assert.deepEqual(actions,['check']);
 const reopened=new Sync(store);reopened.bridge=sync.bridge;writes=0;actions.length=0;
 await reopened.run();assert.deepEqual(actions,['whoami','check']);assert.equal(writes,1,'an unchanged verified profile does not rewrite IndexedDB');
});

test('A cached identity mismatch cannot read or upload another profile journal',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 const pending=[{id:'local',entity:'reviews',key:'answer',value:{grade:'full'}}];
 const store={profileId:'student',doc:{config:{url:'https://example.test/api',token:'fixture'},lastFullSync:Date.now(),base:12,pending}};
 const sync=new Sync(store),actions=[];let logins=0;
 sync.addEventListener('authentication-required',()=>logins++);
 sync.bridge={url:store.doc.config.url,token:'fixture',request:async action=>{actions.push(action);return {profile:{id:'another-student'}};},destroy(){}};
 await sync.run();assert.deepEqual(actions,['whoami']);assert.equal(sync.status,'error');assert.equal(logins,1);
 assert.equal(store.doc.pending,pending);assert.equal(store.doc.base,12);
});

test('Concurrent English startup and reminders share one identity request before any account access',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 const store={profileId:'student',subject:'english',doc:{profile:{id:'student'},config:{url:'https://example.test/api',token:'fixture'},lastFullSync:Date.now(),base:0,pending:[]},async update(change){this.doc=change(structuredClone(this.doc));}};
 const sync=new Sync(store),actions=[];let release;
 const identity=new Promise(resolve=>release=resolve);
 sync.bridge={...store.doc.config,request:async(action,payload)=>{actions.push([action,payload.subject]);return action==='whoami'?identity:{version:0};},destroy(){}};
 const reminders=sync.request('notificationStatus'),startup=sync.run();
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(actions,[['whoami','english']]);
 release({profile:{id:'student'},apiVersion:7,subjects:['latin','english']});
 await Promise.all([reminders,startup]);
 assert.deepEqual(actions.map(([action])=>action).sort(),['check','notificationStatus','whoami']);
 assert.equal(sync.status,'synced');
 await sync.request('notificationSubscribe',{subscription:{endpoint:'fixture'}});
 assert.equal(actions.filter(([action])=>action==='whoami').length,1,'the verified identity is reused for ordinary requests');
 await sync.request('whoami');assert.equal(actions.filter(([action])=>action==='whoami').length,2,'an explicit later check remains fresh');
});

test('Direct startup mutations cannot use a token belonging to another cached profile',async()=>{
 const store={profileId:'student',doc:{config:{url:'https://example.test/api',token:'fixture'}}},sync=new Sync(store),actions=[];
 sync.bridge={...store.doc.config,request:async action=>{actions.push(action);return {profile:{id:'another-student'}};},destroy(){}};
 await assert.rejects(sync.request('notificationSubscribe',{subscription:{endpoint:'fixture'}}),/anderen Profil/);
 assert.deepEqual(actions,['whoami']);
});

test('Failed identity checks are released for retry and capability checks still prevent access',async()=>{
 const store={profileId:'student',subject:'english',doc:{config:{url:'https://example.test/api',token:'fixture'}}},sync=new Sync(store),actions=[];let attempt=0;
 sync.bridge={...store.doc.config,request:async action=>{actions.push(action);if(action!=='whoami')return {};if(!attempt++)throw Error('Offline');return {profile:{id:'student'},apiVersion:2,subjects:['latin']};},destroy(){}};
 await assert.rejects(sync.request('notificationStatus'),/Offline/);
 await assert.rejects(sync.request('notificationStatus'),/aktualisierte Google-Skript/);
 assert.deepEqual(actions,['whoami','whoami']);
});

test('Replacing credentials while identity is pending cannot send the old action through the new bridge',async()=>{
 const store={profileId:'student',doc:{config:{url:'https://example.test/api',token:'old'}}},sync=new Sync(store),actions=[];let release;
 const identity=new Promise(resolve=>release=resolve);
 sync.bridge={...store.doc.config,request:async action=>{actions.push(action);return identity;},destroy(){}};
 const pending=sync.request('notificationSubscribe',{subscription:{endpoint:'fixture'}});
 await new Promise(resolve=>setImmediate(resolve));
 store.doc.config.token='new';release({profile:{id:'student'},apiVersion:7});
 await assert.rejects(pending,/Verbindung wurde geändert/);assert.deepEqual(actions,['whoami']);
});

test('Profile administration checks fresh API capabilities while concurrent callers share the check',async()=>{
 const store={profileId:'admin',subject:'english',doc:{config:{url:'https://example.test/api',token:'fixture'}}},sync=new Sync(store),actions=[];
 sync.bridge={...store.doc.config,request:async action=>{actions.push(action);return action==='whoami'?{profile:{id:'admin'},apiVersion:7,subjects:['latin','english']}:{ok:true};},destroy(){}};
 await Promise.all([sync.request('profileUpdate',{profileId:'student',name:'One'}),sync.request('profileUpdateSubjects',{profileId:'student',allowedSubjects:['latin']})]);
 assert.equal(actions.filter(action=>action==='whoami').length,1);
 await sync.request('profileUpdate',{profileId:'student',name:'Two'});assert.equal(actions.filter(action=>action==='whoami').length,2);
});
