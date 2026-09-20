import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
import {unreadShareNotices,noticeCollections,acknowledgeShareNotices} from '../app/multiuser-sync.js';
let seq=0;
function push(h,entity,key,value,token){return h.request({action:'push',...(token?{token}:{}),base:h.request({action:'check',...(token?{token}:{})}).version,ops:[{id:'notice-test-'+(++seq),entity,key,value,at:Date.now(),seq,device:'test'}]});}
function fixture(){const h=harness();const {profile}=h.request({action:'profileCreate',name:'Felix',email:'f@example.org'});const {token}=h.request({action:'login',email:'f@example.org'});for(let i=1;i<=10;i++){push(h,'collections','c'+i,{id:'c'+i,name:'Lektion '+i});push(h,'words','w'+i,{id:'w'+i,collectionId:'c'+i,latin:'vox'+i,meanings:[['Stimme']]});}return {h,profile,token,pull:()=>h.request({action:'pull',since:0,token}).data};}
test('Ten lessons are shared in a bounded number of writes and retries never duplicate copies or notices',()=>{
 const {h,profile,token,pull}=fixture(),ids=Array.from({length:10},(_,i)=>'c'+(i+1));
 const before=h.metrics.writes;const result=h.request({action:'shareCreateMany',profileId:profile.id,collectionIds:ids});
 assert.equal(result.results.length,10);assert.ok(h.metrics.writes-before<=7);let d=pull();assert.equal(Object.keys(d.collections).length,10);assert.equal(Object.keys(d.words).length,10);assert.equal(unreadShareNotices(d).length,10);
 const word=Object.values(d.words)[0];push(h,'words',word.id,{...word,latin:'Eigene Änderung'},token);
 const version=h.request({action:'check',token}).version;h.request({action:'shareCreateMany',profileId:profile.id,collectionIds:ids});
 assert.equal(h.request({action:'check',token}).version,version);assert.equal(pull().words[word.id].latin,'Eigene Änderung');
});
test('Read receipts persist across logins; an explicit resend creates a fresh notice without new vocabulary',async()=>{
 const {h,profile,token,pull}=fixture();const result=h.request({action:'shareCreateMany',profileId:profile.id,collectionIds:['c1','c2']});
 const store={data:pull(),doc:{pending:[]},async commit(edits){for(const [e,k,v] of edits)push(h,e,k,v,token);this.data=pull();}};
 const sync={status:'synced',run:async()=>{store.data=pull();}};
 await acknowledgeShareNotices(store,sync,unreadShareNotices(store.data));assert.equal(unreadShareNotices(pull()).length,0);
 const otherLogin=h.request({action:'login',email:'f@example.org'});assert.equal(unreadShareNotices(h.request({action:'pull',since:0,token:otherLogin.token}).data).length,0);
 const request={action:'shareNotify',profileId:profile.id,shareIds:result.results.map(r=>r.share.id),requestId:'resend-123456'};
 h.request(request);h.request(request);const d=pull();assert.equal(unreadShareNotices(d).length,1);assert.equal(noticeCollections(unreadShareNotices(d)).length,2);assert.equal(Object.keys(d.collections).length,2);assert.equal(Object.keys(d.words).length,2);
});
test('Invalid batches do not partially share and recipients cannot send notices',()=>{
 const {h,profile,token,pull}=fixture();assert.throws(()=>h.request({action:'shareCreateMany',profileId:profile.id,collectionIds:['c1','missing']}),/hochladen/);assert.equal(Object.keys(pull().collections).length,0);
 for(const action of ['shareCreateMany','shareNotify'])assert.throws(()=>h.request({action,token,profileId:profile.id,collectionIds:['c1']}),/Admin/);
 const r=h.request({action:'shareCreateMany',profileId:profile.id,collectionIds:['c1']});h.request({action:'shareRevoke',shareId:r.results[0].share.id});assert.throws(()=>h.request({action:'shareNotify',profileId:profile.id,shareIds:[r.results[0].share.id],requestId:'request-123'}),/beendet/);
});
test('A failed acknowledgement upload is not reported as success',async()=>{
 let committed=0;const store={doc:{pending:[]},data:{settings:{}},async commit(){committed++;this.doc.pending.push(1);}};
 await assert.rejects(acknowledgeShareNotices(store,{run:async()=>{},status:'error',message:'Upload fehlgeschlagen'},[{id:'n'}]),/Upload fehlgeschlagen/);assert.equal(committed,1);assert.equal(store.doc.pending.length,1);
});
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
