import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,applyOps} from '../app/core.js';
import {predicateChanges,predicateDecks,predicateCloudItems,predicateDeckChanges,importPredicateCollection,predicateQueue,parsePredicateFile} from '../app/predicates.js';
import {harness} from './google-harness.mjs';
const apply=(d,changes)=>applyOps(d,changes.map(([entity,key,value])=>({entity,key,value})));
const file=(name,answer='amavi')=>parsePredicateFile({format:'latinio-predicates',schema:1,name,predicates:[{grundform:'amare',praedikat:answer}]});

test('Legacy named groups become collections without changing item keys or reviews',async()=>{
 let d=apply(emptyData(),[...await predicateChanges(file('Lektion 2').items,'Lektion 2'),...await predicateChanges([{grundform:'monere',praedikate:['monui']}],'Lektion 10')]);
 const before=structuredClone(d),decks=predicateDecks(d);
 assert.deepEqual(decks.map(d=>d.name),['Lektion 2','Lektion 10']);assert.deepEqual(d,before);
 const renamed={...decks[0],name:'Neue Bezeichnung',active:false};d=apply(d,predicateDeckChanges(d,renamed));
 assert.equal(predicateDecks(d).length,2);assert.equal(predicateDecks(d).find(x=>x.id===renamed.id).active,false);
 assert.equal(predicateCloudItems(d).find(x=>x.grundform==='amare').name,'Neue Bezeichnung');
 assert.deepEqual(predicateCloudItems(d).map(x=>x.id).sort(),predicateCloudItems(before).map(x=>x.id).sort());
});
test('Same lemma can have different answers in different collections; reimport preserves IDs and reviews',async()=>{
 let d=emptyData();d=apply(d,(await importPredicateCollection(d,file('A','amavi'),'deck_a')).changes);d=apply(d,(await importPredicateCollection(d,file('B','amo, amare, amavi, amatum'),'deck_b')).changes);
 const a=predicateCloudItems(d).find(x=>x.deckId==='deck_a');d.settings.r={kind:'predicateReview',itemId:a.id,correct:true,at:10};
 d=apply(d,(await importPredicateCollection(d,file('A','amāvī'),'unused_new_id')).changes);
 assert.equal(predicateDecks(d).length,2);assert.equal(predicateCloudItems(d).length,2);assert.equal(predicateCloudItems(d).find(x=>x.deckId==='deck_a').id,a.id);
 assert.equal(predicateQueue(d,['deck_a'],'refresh').length,1);assert.equal(predicateQueue(d,['deck_b'],'learning').length,1);assert.equal(d.settings.r.itemId,a.id);
 assert.equal(Object.keys(d.words).length,0);assert.equal(Object.keys(d.collections).length,0);
});
test('Reimport updates legacy items in place and empty collections remain manageable',async()=>{
 let d=apply(emptyData(),await predicateChanges(file('Alt').items,'Alt'));const before=predicateCloudItems(d)[0];
 const imported=await importPredicateCollection(d,file('Alt','amāvī'),'new');d=apply(d,imported.changes);
 assert.equal(predicateCloudItems(d)[0].id,before.id);assert.equal(predicateCloudItems(d).length,1);
 d=apply(d,[['settings',before.id,null]]);assert.equal(predicateDecks(d).length,1);assert.equal(predicateCloudItems(d).length,0);
 d=apply(d,[['settings',imported.deck.id,null]]);assert.equal(predicateDecks(d).length,0);
});
test('Smart selection prioritizes unseen and incorrect forms, obeys selection and has unlimited alternative modes',async()=>{
 let d=emptyData();const parsed={name:'A',items:Array.from({length:15},(_,i)=>({grundform:'verb'+i,praedikate:['perfect'+i]}))};
 d=apply(d,(await importPredicateCollection(d,parsed,'a')).changes);d=apply(d,(await importPredicateCollection(d,file('B'),'b')).changes);
 const items=predicateCloudItems(d).filter(i=>i.deckId==='a');items.forEach((item,i)=>d.settings['r'+i]={kind:'predicateReview',itemId:item.id,correct:i>1,at:i+1});
 assert.equal(predicateQueue(d,['a'],'smart',5).length,5);assert.ok(predicateQueue(d,['a'],'smart',2).every(i=>[items[0].id,items[1].id].includes(i.id)));
 assert.equal(predicateQueue(d,['a'],'learning').length,2);assert.equal(predicateQueue(d,['a'],'refresh').length,13);assert.equal(predicateQueue(d,['a'],'all',5).length,15);
 assert.deepEqual(predicateQueue(d,[]),[]);assert.ok(predicateQueue(d,['a'],'all').every(i=>i.deckId==='a'));
});
test('Existing Google journal and predicate sharing preserve collection grouping without a backend change',async()=>{
 const h=harness(),{profile}=h.request({action:'profileCreate',name:'Test',email:'collection-test@example.org'}),{token}=h.request({action:'login',email:'collection-test@example.org'});
 let d=emptyData(),changes=[];
 for(const [id,name] of [['a','Sammlung A'],['b','Sammlung B']]){const imported=await importPredicateCollection(d,file(name),id);changes.push(...imported.changes);d=apply(d,imported.changes);}
 const ops=changes.map(([entity,key,value],i)=>({entity,key,value,id:'collection-op-'+i,device:'test',seq:i+1,at:Date.now()}));
 h.request({action:'push',base:0,ops});h.request({action:'predicateShareSet',profileId:profile.id,enabled:true});
 const received=h.request({action:'pull',since:0,token}).data;
 assert.deepEqual(predicateDecks(received).map(d=>d.name),['Sammlung A','Sammlung B']);assert.equal(predicateQueue(received,['a'],'all').length,1);assert.equal(predicateQueue(received,['b'],'all').length,1);
 assert.equal(Object.keys(received.words).length,0);assert.equal(Object.keys(received.collections).length,0);
});
