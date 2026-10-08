import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
import {predicateDecks,predicateCloudItems,predicateChanges} from '../app/predicates.js';
import {shareResources,resourceRecipients,accessOverview} from '../app/share-access.js';
let seq=0;
function push(h,entity,key,value,token,subject='latin'){
 return h.request({action:'push',...(token?{token}:{}),subject,base:h.request({action:'check',...(token?{token}:{}),subject}).version,ops:[{id:'access-test-'+(++seq),device:'test',seq,at:Date.now(),entity,key,value}]});
}
function fixture(){const h=harness(),{profile}=h.request({action:'profileCreate',name:'Felix',email:'access@example.org'}),{token}=h.request({action:'login',email:'access@example.org'});return {h,profile,token,pull:(subject='latin')=>h.request({action:'pull',since:0,token,subject}).data,set:(kind,id,enabled=true,subject='latin')=>h.request({action:'collectionAccessSet',profileId:profile.id,resourceKind:kind,sourceId:id,enabled,subject})};}
function seed(t){for(const id of ['a','b']){push(t.h,'settings',id,{id,kind:'predicateDeck',name:'Prädikate '+id});push(t.h,'settings','p'+id,{id:'p'+id,kind:'predicateItem',deckId:id,name:'Prädikate '+id,grundform:'verb'+id,praedikate:['answer'+id]});}}

test('One selected predicate deck shares no items from any other deck; repeating is idempotent',()=>{
 const t=fixture();seed(t);t.set('predicates','a');const first=t.pull(),version=t.h.request({action:'check',token:t.token}).version;
 assert.deepEqual(predicateCloudItems(first).map(x=>x.grundform),['verba']);assert.equal(predicateDecks(first).length,1);assert.equal(Object.keys(first.collections).length,0);
 t.set('predicates','a');assert.equal(t.h.request({action:'check',token:t.token}).version,version);
 t.set('predicates','b');assert.equal(predicateDecks(t.pull()).length,2);
 t.set('predicates','a',false);const list=t.h.request({action:'shareList'});assert.equal(list.accessSchema,2);assert.deepEqual(Array.from(list.resourceShares,s=>s.sourceId),['b']);assert.equal(predicateCloudItems(t.pull()).length,2);
});
test('Legacy all-predicate shares split on first edit without duplicating items or losing review IDs',()=>{
 const t=fixture();seed(t);t.h.request({action:'predicateShareSet',profileId:t.profile.id,enabled:true});
 const before=predicateCloudItems(t.pull());push(t.h,'settings','review',{kind:'predicateReview',itemId:before[0].id,grundform:before[0].grundform,correct:true,at:10},t.token);
 const old=t.h.request({action:'shareList'});assert.deepEqual(Array.from(old.predicateShares[0].sourceIds).sort(),['a','b']);
 t.set('predicates','a',false);let list=t.h.request({action:'shareList'});assert.equal(list.predicateShares.length,0);assert.deepEqual(Array.from(list.resourceShares,s=>s.sourceId),['b']);
 t.set('predicates','b');t.set('predicates','a');
 const after=t.pull();assert.deepEqual(predicateCloudItems(after).map(x=>x.id).sort(),before.map(x=>x.id).sort());assert.equal(after.settings.review.itemId,before[0].id);
 assert.equal(predicateCloudItems(after).length,2);
});
test('Legacy collection IDs match the frontend including umlauts, accented letters and long titles',async()=>{
 const t=fixture();const name='Prädikate ÄÖÜ é Lektion 17';for(const [entity,id,value] of await predicateChanges([{grundform:'amare',praedikate:['amavi']}],name))push(t.h,entity,id,value);
 const source=t.h.request({action:'pull',since:0}).data,id=predicateDecks(source)[0].id;
 t.h.request({action:'predicateShareSet',profileId:t.profile.id,enabled:true});assert.equal(t.h.request({action:'shareList'}).predicateShares[0].sourceIds[0],id);
 t.set('predicates',id);assert.equal(predicateCloudItems(t.pull()).length,1);assert.equal(predicateDecks(t.pull()).length,1);
});
test('New resource shares keep recipient edits and review data when sending changed source forms',()=>{
 const t=fixture();seed(t);t.set('predicates','a');const item=predicateCloudItems(t.pull())[0];
 push(t.h,'settings',item.id,{...item,praedikate:['meine Antwort']},t.token);push(t.h,'settings','review',{kind:'predicateReview',itemId:item.id,correct:true,at:1},t.token);
 push(t.h,'settings','pa',{id:'pa',kind:'predicateItem',deckId:'a',name:'Prädikate a',grundform:'verba',praedikate:['neue Antwort']});t.set('predicates','a');
 const d=t.pull();assert.deepEqual(Array.from(d.settings[item.id].praedikate),['meine Antwort']);assert.equal(d.settings.review.correct,true);
 const incoming=Object.values(d.settings).filter(x=>x.kind==='incomingShare');assert.equal(incoming.length,1);assert.equal(incoming[0].key,item.id);assert.equal(incoming[0].value.praedikate[0],'neue Antwort');
 const version=t.h.request({action:'check',token:t.token}).version;t.set('predicates','a');assert.equal(t.h.request({action:'check',token:t.token}).version,version);
});
test('Refreshers share only their member words, stay refreshers, and do not copy learning progress',()=>{
 const t=fixture();push(t.h,'collections','c',{id:'c',name:'Lektion'});
 for(const id of ['w1','w2'])push(t.h,'words',id,{id,collectionId:'c',latin:id,meanings:[['Bedeutung']]});
 push(t.h,'settings','r',{id:'r',kind:'refreshDeck',name:'Auffrischen',members:[{wordId:'w1',addedAt:1}]});
 t.set('refresh','r');let d=t.pull();assert.deepEqual(Object.values(d.words).map(x=>x.latin),['w1']);assert.equal(Object.values(d.collections)[0].refreshSource,true);assert.equal(Object.values(d.settings).filter(x=>x.kind==='refreshDeck').length,1);assert.equal(Object.keys(d.reviews).length,0);
 const version=t.h.request({action:'check',token:t.token}).version;t.set('refresh','r');assert.equal(t.h.request({action:'check',token:t.token}).version,version);
 t.set('refresh','r',false);assert.equal(Object.values(t.pull().words).length,1);
});
test('Normal lessons retain existing sharing and new access is scoped and admin-only',()=>{
 const t=fixture();seed(t);push(t.h,'collections','c',{id:'c',name:'Lektion'});t.set('lesson','c');assert.equal(Object.keys(t.pull().collections).length,1);t.set('lesson','c',false);assert.equal(t.h.request({action:'shareList'}).shares.length,0);
 assert.throws(()=>t.h.request({action:'collectionAccessSet',resourceKind:'predicates',sourceId:'a',profileId:t.profile.id,enabled:true,token:t.token}),/Admin/);
 assert.throws(()=>t.set('predicates','a',true,'english'),/Latein/);assert.throws(()=>t.set('predicates','missing'),/Sammlung nicht gefunden/);
 t.h.request({action:'profileUpdateSubjects',profileId:t.profile.id,allowedSubjects:['english']});assert.throws(()=>t.set('predicates','a'),/Lernfach/);
});
test('Profile deletion retires scoped shares and retains archived content',()=>{
 const t=fixture();seed(t);t.set('predicates','a');t.h.request({action:'profileDelete',profileId:t.profile.id});assert.equal(t.h.request({action:'shareList'}).resourceShares.length,0);
 assert.throws(()=>t.set('predicates','a'),/Profil/);
});
test('Overview presents all types with visible names, not disclosure widgets',()=>{
 const d={collections:{c:{id:'c',name:'Lektion 1'}},words:{w:{id:'w',collectionId:'c'}},settings:{r:{id:'r',kind:'refreshDeck',name:'Auffrischen',members:[{wordId:'w'}]},p:{id:'p',kind:'predicateDeck',name:'Prädikate'}}};
 const resources=shareResources(d),people=[{id:'p1',name:'Felix'}],state={shares:[{sourceId:'c',profileId:'p1'}],resourceShares:[{sourceId:'p',resourceKind:'predicates',profileId:'p1'}]};
 assert.equal(resources.length,3);assert.equal(resourceRecipients(resources.find(x=>x.id==='p'),state,people).length,1);
 const html=accessOverview(resources,state,people,s=>String(s));assert.doesNotMatch(html,/<details|<summary/);assert.match(html,/Felix/);assert.match(html,/Nicht geteilt/);assert.match(html,/data-access-select/);assert.equal(shareResources(d,'english').length,2);
});
