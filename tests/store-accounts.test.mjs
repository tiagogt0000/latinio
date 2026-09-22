import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../app/store.js';
import {emptyData} from '../app/core.js';
function databaseMock(){
 const databases=new Map();
 return {databases,open(name){const request={};queueMicrotask(()=>{const fresh=!databases.has(name);if(fresh)databases.set(name,new Map());const values=databases.get(name);request.result={close(){},createObjectStore(){},transaction(){const tx={};tx.objectStore=()=>({get(key){const r={};queueMicrotask(()=>{r.result=structuredClone(values.get(key));r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return r;},put(value,key){values.set(key,structuredClone(value));}});return tx;}};if(fresh)request.onupgradeneeded?.();request.onsuccess?.();});return request;}};
}
test('Student activity persists offline, throttles duplicate opens and contains no word data',async()=>{
 globalThis.indexedDB=databaseMock();const student=await new Store().open('activity-student');
 await student.recordActivity('opened');await student.recordActivity('opened');
 await student.commit([['words','w',{id:'w',collectionId:'c',latin:'secret',meanings:[['hidden']]}]]);
 const events=Object.values(student.data.settings).filter(x=>x.kind==='activityEvent');
 assert.deepEqual(events.map(e=>e.action),['opened','words']);assert.doesNotMatch(JSON.stringify(events),/secret|hidden/);
 student.close();const again=await new Store().open('activity-student');assert.equal(Object.values(again.data.settings).length,2);again.close();
 const admin=await new Store().open('admin');await admin.recordActivity('opened');assert.equal(admin.doc.pending.length,0);admin.close();
});
test('Existing admin database is retained; student seed and edits cannot alter it',async()=>{
 globalThis.indexedDB=databaseMock();
 const shadow=emptyData();shadow.collections.old={id:'old',name:'Mein alter Stand'};shadow.reviews.r={id:'r',wordId:'w',grade:'full',at:10};
 indexedDB.databases.set('latinio-v1',new Map([['main',{schema:1,device:'old',seq:47,base:47,shadow,pending:[],session:null,config:{url:'old-url',token:'legacy'},seeded:true}]]));
 const admin=await new Store().open('admin'),felix=await new Store().open('felix');
 await admin.seed();await felix.seed();assert.equal(Object.keys(felix.data.words).length,0);assert.equal(Object.keys(felix.data.collections).length,0);
 await felix.commit([['collections','own',{id:'own',name:'Felix'}]]);assert.equal(admin.doc.base,47);assert.equal(admin.doc.config.token,'legacy');assert.equal(admin.data.reviews.r.grade,'full');assert.equal(admin.data.collections.own,undefined);
 felix.close();const reopened=await new Store().open('felix');assert.equal(reopened.data.collections.own.name,'Felix');admin.close();reopened.close();
});
