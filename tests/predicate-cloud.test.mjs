import test from 'node:test';
import assert from 'node:assert/strict';
import {predicateCloudKey,predicateCloudItems,predicateChanges,migrateLocalPredicates} from '../app/predicates.js';
import {harness} from './google-harness.mjs';

test('predicate keys are stable across macrons, case, and import order',async()=>{
 assert.equal(await predicateCloudKey('AMĀRE'),await predicateCloudKey('amare'));
 assert.match(await predicateCloudKey('excedere'),/^[a-zA-Z0-9_-]{1,160}$/);
});

test('existing Google API syncs predicate entries and results separately from vocabulary',async()=>{
 const h=harness(),changes=await predicateChanges([{grundform:'amare',praedikate:['amavi']},{grundform:'monere',praedikate:['monui']}]);
 const ops=changes.map(([entity,key,value],i)=>({id:'op_'+i,device:'device_A',seq:i+1,at:Date.now(),entity,key,value}));
 ops.push({id:'result_op',device:'device_A',seq:3,at:Date.now(),entity:'settings',key:'predicate_review_1',value:{kind:'predicateReview',grundform:'amare',correct:true,at:Date.now()}});
 const result=h.request({action:'push',base:0,ops,subject:'latin'});
 assert.equal(result.version,3,JSON.stringify(result));
 const pulled=h.request({action:'pull',since:0,subject:'latin'});
 const snapshot=pulled.data;
 assert.equal(Object.keys(snapshot.settings).length,3);
 assert.equal(Object.keys(snapshot.words).length,0);
 assert.equal(Object.keys(snapshot.collections).length,0);
 assert.equal(predicateCloudItems(snapshot).length,2);
 assert.equal(snapshot.settings.predicate_review_1.correct,true);
 assert.equal(Object.keys(h.request({action:'pull',since:0,subject:'english'}).data.settings).length,0);
});

test('local migration is once per profile, keeps newer cloud entries and retries after failure',async()=>{
 const [cloud]=await predicateChanges([{grundform:'amare',praedikate:['cloud answer']}]);
 const store={subject:'latin',doc:{},data:{settings:{[cloud[1]]:cloud[2]}},commits:[],async commit(changes){this.commits.push(changes);for(const [,id,item]of changes)this.data.settings[id]=item;},async update(fn){this.doc=fn(this.doc);}};
 const local=[{grundform:'amare',praedikate:['old answer']},{grundform:'monere',praedikate:['monui']}];
 await migrateLocalPredicates(store,local);await migrateLocalPredicates(store,local);
 assert.equal(store.commits.length,1);
 assert.equal(store.commits[0].length,1);
 assert.equal(store.data.settings[cloud[1]].praedikate[0],'cloud answer');
 assert.equal(predicateCloudItems(store.data).length,2);
 const english={...store,subject:'english',doc:{},commits:[]};
 await migrateLocalPredicates(english,local);assert.equal(english.commits.length,0);
});
