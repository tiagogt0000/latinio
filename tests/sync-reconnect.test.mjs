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
