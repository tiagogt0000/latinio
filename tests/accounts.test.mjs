import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
import {incomingChanges} from '../app/multiuser-sync.js';
import {applyOps} from '../app/core.js';
let seq=0;
function push(h,entity,key,value,token){const base=h.request({action:'check',...(token?{token}:{})}).version;return h.request({action:'push',base,ops:[{id:'op_'+(++seq),entity,key,value,at:Date.now(),seq,device:'test'}],...(token?{token}:{})});}
function friend(h,email='felix@schule.de'){const {profile}=h.request({action:'profileCreate',name:'Felix',email});return {...h.request({action:'login',email}),id:profile.id};}
function setup(){const h=harness(),f=friend(h);push(h,'collections','c',{id:'c',name:'Lektion 1'});push(h,'words','w',{id:'w',collectionId:'c',latin:'vox, vocis',meanings:[['Stimme']]});return {h,f};}
test('Email login is allowlisted, case insensitive; PIN is validated and throttled server side',()=>{
 const h=harness();assert.throws(()=>h.request({action:'login',email:'unknown@schule.de'}),/freigeschaltet/);friend(h);
 assert.equal(h.request({action:'login',email:' FELIX@SCHULE.DE '}).profile.role,'student');
 assert.equal(h.request({action:'login',admin:true,pin:'1234'}).profile.role,'admin');
 for(let i=0;i<5;i++)assert.throws(()=>h.request({action:'login',admin:true,pin:'0000'}),/stimmt nicht/);
 assert.throws(()=>h.request({action:'login',admin:true,pin:'1234'}),/fünf Minuten/);
});
test('Sessions isolate journals and cannot obtain admin rights through request fields',()=>{
 const {h,f}=setup(),other=friend(h,'andere@schule.de');
 assert.equal(h.request({action:'check',token:f.token,profileId:'admin',role:'admin'}).version,0);
 assert.throws(()=>h.request({action:'profileCreate',token:f.token,role:'admin',name:'X',email:'x@s.de'}),/Admin/);
 push(h,'collections','mine',{id:'mine',name:'Meine'},f.token);
 assert.equal(h.request({action:'check',token:other.token,profileId:f.id}).version,0);
 assert.equal(h.request({action:'pull',since:0}).data.collections.mine,undefined);
 assert.equal(h.request({action:'pull',since:0}).data.words.w.latin,'vox, vocis');
});
test('Sharing is explicit, idempotent, independent and excludes learning progress',()=>{
 const {h,f}=setup();push(h,'reviews','r',{id:'r',wordId:'w',grade:'full',at:10});
 assert.equal(h.request({action:'check',token:f.token}).version,0);
 const {share}=h.request({action:'shareCreate',profileId:f.id,collectionId:'c'});
 assert.equal(h.request({action:'shareCreate',profileId:f.id,collectionId:'c'}).already,true);
 const result=h.request({action:'pull',since:0,token:f.token});assert.equal(result.version,2);assert.equal(Object.keys(result.data.reviews).length,0);
 const word=Object.values(result.data.words)[0];assert.notEqual(word.id,'w');assert.equal(word.collectionId,share.targetId);
 push(h,'words',word.id,{...word,latin:'Felix'},f.token);assert.equal(h.request({action:'pull',since:0}).data.words.w.latin,'vox, vocis');
 push(h,'words','w',{id:'w',collectionId:'c',latin:'Admin',meanings:[['Stimme']]});assert.equal(h.request({action:'pull',since:0,token:f.token}).data.words[word.id].latin,'Felix');
});
test('Only selected changes are sent and personal edits remain a decision for the recipient',()=>{
 const {h,f}=setup();const {share}=h.request({action:'shareCreate',profileId:f.id,collectionId:'c'});
 const word=Object.values(h.request({action:'pull',since:0,token:f.token}).data.words)[0];push(h,'words',word.id,{...word,latin:'Meine Fassung'},f.token);
 push(h,'collections','c',{id:'c',name:'Privater Name'});push(h,'words','w',{id:'w',collectionId:'c',latin:'vox',meanings:[['Laut']]});
 assert.equal(h.request({action:'shareChanges',shareId:share.id}).changes.length,2);
 assert.equal(h.request({action:'shareSend',shareId:share.id,keys:['w']}).sent,1);
 assert.equal(h.request({action:'shareChanges',shareId:share.id}).changes[0].key,'collection');
 assert.equal(h.request({action:'shareSend',shareId:share.id,keys:['w']}).sent,0);
 const data=h.request({action:'pull',since:0,token:f.token}).data;assert.equal(data.words[word.id].latin,'Meine Fassung');assert.equal(incomingChanges(data).conflicts.length,1);assert.equal(data.collections[share.targetId].name,'Lektion 1');
});
test('Repeated A to B changes get unique deliveries and safe edits apply automatically',()=>{
 const {h,f}=setup();const {share}=h.request({action:'shareCreate',profileId:f.id,collectionId:'c'});
 for(const latin of ['B','vox, vocis','B']){push(h,'words','w',{id:'w',collectionId:'c',latin,meanings:[['Stimme']]});h.request({action:'shareSend',shareId:share.id,keys:['w']});}
 const d=h.request({action:'pull',since:0,token:f.token}).data;assert.equal(Object.keys(d.settings).length,3);
 // Real deliveries are ordered by server journal sequence, even within the same millisecond.
 let data=d;for(let i=0;i<3;i++){const r=incomingChanges(data);data=applyOps(data,r.changes.map(([entity,key,value])=>({entity,key,value})));}
 assert.equal(Object.values(data.words)[0].latin,'B');assert.equal(Object.keys(data.settings).length,0);
});
