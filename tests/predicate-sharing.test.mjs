import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';

let sequence=0;
function push(h,entity,key,value,token){const check=h.request({action:'check',...(token?{token}:{})});return h.request({action:'push',...(token?{token}:{}),base:check.version,ops:[{id:'predicate-share-test-'+(++sequence),entity,key,value,at:Date.now(),seq:sequence,device:'test'}]});}
function fixture(){const h=harness(),{profile}=h.request({action:'profileCreate',name:'Felix',email:'felix-predicates@example.org'}),{token}=h.request({action:'login',email:'felix-predicates@example.org'});push(h,'settings','pred-amare',{kind:'predicateItem',id:'pred-amare',grundform:'amare',praedikate:['amo, amavi']});push(h,'settings','pred-monere',{kind:'predicateItem',id:'pred-monere',grundform:'monere',praedikate:['moneo, monui']});return {h,profile,token,pull:()=>h.request({action:'pull',since:0,token}).data};}

test('Admin shares cloud predicates separately from lesson collections and words',()=>{
 const {h,profile,pull}=fixture();const result=h.request({action:'predicateShareSet',profileId:profile.id,enabled:true});assert.equal(result.enabled,true);assert.equal(result.changed,3);
 const received=pull(),items=Object.values(received.settings).filter(row=>row?.kind==='predicateItem');assert.deepEqual(items.map(row=>row.grundform).sort(),['amare','monere']);assert.equal(Object.keys(received.collections).length,0);assert.equal(Object.keys(received.words).length,0);
 const listed=h.request({action:'shareList'});assert.equal(listed.predicateShares.length,1);assert.equal(listed.predicateShares[0].profileId,profile.id);assert.equal(listed.shares.length,0);
});

test('Saving an active predicate share refreshes changed predicates and removes deleted ones',()=>{
 const {h,profile,pull}=fixture();h.request({action:'predicateShareSet',profileId:profile.id,enabled:true});push(h,'settings','pred-amare',{kind:'predicateItem',id:'pred-amare',grundform:'amare',praedikate:['amo, amavi, amatum']});push(h,'settings','pred-monere',null);
 const update=h.request({action:'predicateShareSet',profileId:profile.id,enabled:true}),items=Object.values(pull().settings).filter(row=>row?.kind==='predicateItem');assert.equal(update.changed,2);assert.deepEqual(items.map(row=>[row.grundform,row.praedikate[0]]),[['amare','amo, amavi, amatum']]);
});

test('Predicate access can be ended without deleting data already delivered to a learner',()=>{
 const {h,profile,token,pull}=fixture();h.request({action:'predicateShareSet',profileId:profile.id,enabled:true});assert.equal(h.request({action:'predicateShareSet',profileId:profile.id,enabled:false}).enabled,false);assert.equal(h.request({action:'shareList'}).predicateShares.length,0);assert.equal(Object.values(pull().settings).filter(row=>row?.kind==='predicateItem').length,2);
 assert.throws(()=>h.request({action:'predicateShareSet',profileId:profile.id,enabled:true,token}),/Admin/);
});
