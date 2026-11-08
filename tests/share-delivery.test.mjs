import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
import {Sync} from '../app/sync.js';
import {emptyData,applyOps} from '../app/core.js';
import {settleSync,cloudGate} from '../app/multiuser-sync.js';
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});globalThis.window={addEventListener(){}};
let seq=0;
function push(h,e,k,v,token){return h.request({action:'push',...(token?{token}:{}),base:h.request({action:'check',...(token?{token}:{})}).version,ops:[{id:'delivery-'+(++seq),entity:e,key:k,value:v,at:Date.now(),seq,device:'test'}]});}
function fixture(){const h=harness();const {profile}=h.request({action:'profileCreate',name:'Felix',email:'felix@example.org'}),{token}=h.request({action:'login',email:'felix@example.org'});push(h,'collections','c',{id:'c',name:'Lektion 1'});push(h,'words','w',{id:'w',collectionId:'c',latin:'vox',meanings:[['Stimme']]});const {share}=h.request({action:'shareCreate',profileId:profile.id,collectionId:'c'});return {h,profile,token,share,pull:()=>h.request({action:'pull',since:0,token}).data};}
test('A stored share with a missing recipient copy is detected and restored by explicit re-sharing',()=>{
 const {h,profile,token,share,pull}=fixture(),word=Object.values(pull().words)[0];
 push(h,'reviews','r',{id:'r',wordId:word.id,grade:'full',at:1},token);push(h,'collections',share.targetId,null,token);push(h,'words',word.id,null,token);
 assert.equal(h.request({action:'shareList'}).shares[0].delivery.present,false);
 const result=h.request({action:'shareCreateMany',collectionIds:['c'],profileId:profile.id});assert.equal(result.results[0].share.delivery.present,true);assert.equal(pull().words[word.id].latin,'vox');assert.equal(pull().reviews.r.grade,'full');
 const version=h.request({action:'check',token}).version;h.request({action:'shareCreateMany',collectionIds:['c'],profileId:profile.id});assert.equal(h.request({action:'check',token}).version,version);
});
test('Repair complements missing entries but preserves edited names, words and learning records',()=>{
 const {h,token,share,pull}=fixture(),word=Object.values(pull().words)[0];push(h,'collections',share.targetId,{id:share.targetId,name:'Eigener Name'},token);push(h,'words',word.id,{...word,latin:'Eigene Fassung'},token);
 const result=h.request({action:'shareRepair',shareId:share.id});assert.equal(result.repaired,0);assert.equal(pull().words[word.id].latin,'Eigene Fassung');assert.equal(pull().collections[share.targetId].name,'Eigener Name');
 push(h,'words',word.id,null,token);assert.equal(h.request({action:'shareList'}).shares[0].delivery.missingWords,1);assert.equal(h.request({action:'shareRepair',shareId:share.id}).repaired,1);assert.equal(pull().words[word.id].latin,'vox');assert.equal(pull().collections[share.targetId].name,'Eigener Name');
 assert.throws(()=>h.request({action:'shareRepair',shareId:share.id,token}),/Admin/);h.request({action:'shareRevoke',shareId:share.id});assert.throws(()=>h.request({action:'shareRepair',shareId:share.id}),/beendet/);
});
test('Incomplete metadata remains visible and explicit repair completes the recipient copy',()=>{
 const {h,token,share,pull}=fixture(),word=Object.values(pull().words)[0];push(h,'collections',share.targetId,null,token);push(h,'words',word.id,null,token);
 h.ctx.saveRecord_('_LatinioShares',share.id,{...share,ready:false});assert.equal(h.request({action:'shareList'}).shares.length,1);
 assert.equal(h.request({action:'shareRepair',shareId:share.id}).delivery.present,true);assert.equal(pull().words[word.id].latin,'vox');
});
function localStore(profileId,token,base=0){return {profileId,doc:{config:{url:'test',token},base,shadow:emptyData(),pending:[]},get data(){return applyOps(this.doc.shadow,this.doc.pending);},async update(fn){this.doc=fn(this.doc);},async commit(changes){for(const [entity,key,value] of changes)this.doc.pending.push({id:'local-'+(++seq),entity,key,value,device:'phone',seq,at:Date.now()});}};}
test('Startup full pull repairs a stale snapshot despite equal version counters and preserves pending work',async()=>{
 const {h,profile,token,share}=fixture(),base=h.request({action:'check',token}).version,store=localStore(profile.id,token,base),sync=new Sync(store);
 store.doc.pending=[{id:'pending',entity:'collections',key:'own',value:{id:'own',name:'Eigene'},device:'phone',seq:1,at:1}];
 const calls=[];sync.request=async(action,payload)=>{calls.push({action,payload});return h.request({action,...payload,token});};
 try{await settleSync(sync,store);assert.equal(store.data.collections[share.targetId].name,'Lektion 1');assert.equal(store.data.collections.own.name,'Eigene');assert.equal(store.doc.pending.length,0);assert.equal(calls.find(c=>c.action==='pull').payload.since,0);assert.ok(sync.lastFullSync>0);}finally{clearTimeout(sync.timer);}
});
test('Profile mismatch blocks downloading and uploading another account journal',async()=>{
 const {h,token}=fixture(),store=localStore('wrong-profile',token),sync=new Sync(store),calls=[];
 sync.request=async(action,payload)=>{calls.push(action);return h.request({action,...payload,token});};await sync.run();assert.equal(sync.status,'error');assert.match(sync.message,/anderen Profil/);assert.deepEqual(calls,['whoami']);assert.equal(Object.keys(store.data.collections).length,0);
});

test('Cached learning during the initial pull preserves new answers and a remote event joins the same reconciliation',async()=>{
 const {h,profile,token,pull}=fixture(),store=localStore(profile.id,token),sync=new Sync(store),calls=[];
 store.doc.shadow=pull();store.doc.session={id:'current-round',answers:['Stimme']};
 let releasePull,pullStarted;
 const started=new Promise(resolve=>pullStarted=resolve),waiting=new Promise(resolve=>releasePull=resolve);
 sync.bridge={url:'test',token,async request(action,payload){calls.push(action);if(action==='pull'){pullStarted();await waiting;}return h.request({action,...payload,token});},destroy(){}};
 const gate=cloudGate({sync,store,shouldBlock:()=>false}),joined=[];
 sync.addEventListener('remote',()=>{if(!gate.blocked)joined.push(settleSync(sync,store));});
 try{
  const startup=gate.run();await started;assert.equal(gate.blocked,false);
  const review={id:'new-answer',wordId:Object.keys(store.data.words)[0],grade:'full',at:Date.now()};
  await store.commit([['reviews',review.id,review]]);releasePull();await startup;await Promise.all(joined);
  assert.equal(calls.filter(action=>action==='pull').length,1);
  assert.equal(calls.filter(action=>action==='push').length,1);
  assert.equal(store.doc.pending.length,0);assert.deepEqual(store.data.reviews[review.id],review);
  assert.deepEqual(store.doc.session,{id:'current-round',answers:['Stimme']});
  assert.equal(pull().reviews[review.id].grade,'full');
 }finally{clearTimeout(sync.timer);}
});

test('A lost upload reply leaves saved answers queued and retry acknowledges each operation only once',async()=>{
 const {h,profile,token}=fixture(),store=localStore(profile.id,token),sync=new Sync(store);
 const review={id:'new-answer',wordId:'fixture',grade:'full',at:Date.now()};await store.commit([['reviews',review.id,review]]);
 let loseReply=true;
 sync.bridge={url:'test',token,async request(action,payload){const result=h.request({action,...payload,token});if(action==='push'&&loseReply){loseReply=false;throw Error('Connection closed during subject switch');}return result;},destroy(){}};
 try{
  await assert.rejects(settleSync(sync,store),/Connection closed/);
  assert.equal(store.doc.pending.length,1);assert.deepEqual(store.data.reviews[review.id],review);
  await settleSync(sync,store);assert.equal(store.doc.pending.length,0);
  const remote=h.request({action:'pull',token,since:0});
  assert.equal(remote.ops.filter(op=>op.entity==='reviews'&&op.key===review.id).length,1);
  assert.equal(remote.data.reviews[review.id].grade,'full');
 }finally{clearTimeout(sync.timer);}
});
