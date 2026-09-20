import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingUI} from '../app/sharing-ui.js';
function setup(){
 const nodes=new Map();const requests=[];const views=[];
 globalThis.document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,{isConnected:true,textContent:'',innerHTML:''});return nodes.get(key);}};
 const store=new EventTarget();store.doc={};store.data={settings:{},collections:{}};store.update=async fn=>{store.doc=fn(store.doc);};
 const sync={request(action,args){return new Promise((resolve,reject)=>requests.push({action,args,resolve,reject}));}};
 const ui=sharingUI({store,sync,profile:{role:'admin'},h:s=>String(s??''),showModal:s=>views.push(s),notify(){},render(){}});
 return {ui,requests,views,nodes,store,sync};
}
test('Profiles open before slow Google request completes; closing prevents stale DOM updates',async()=>{
 const {ui,requests,views,nodes}=setup();const result=await ui.handle({dataset:{action:'account-profiles'}});
 assert.equal(result,true);assert.match(views[0],/Profile verwalten/);assert.equal(requests.length,1);
 const list=nodes.get('.profile-list');list.isConnected=false;requests[0].resolve({profiles:[{id:'p',name:'Felix',email:'test@example.org'}]});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(list.innerHTML,'');assert.equal(views.length,1);
});
test('Sharing opens immediately and reports network failures inside the open window',async()=>{
 const {ui,requests,views,nodes}=setup();await ui.handle({dataset:{action:'share-panel'}});
 assert.match(views[0],/Sammlungen teilen/);assert.equal(requests.length,2);requests[0].reject(Error('Offline'));requests[1].resolve({shares:[]});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(nodes.get('[data-directory-status]').textContent,'Offline');
});

Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
test('Selected lessons are submitted together in one sharing request',async()=>{
 const t=setup();t.store.doc.pending=[];t.sync.status='synced';t.sync.run=async()=>{};
 const Previous=globalThis.FormData;globalThis.FormData=class{get(k){return k==='profileId'?'felix':null;}getAll(k){return k==='collectionId'?['c1','c2','c10']:[];}};
 const message={isConnected:true,textContent:''},button={isConnected:true,disabled:false};
 const form={id:'share-create',dataset:{},isConnected:false,querySelector:s=>s==='[data-save-status]'?message:button};
 try{
 await t.ui.submit(form);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.requests.length,1);assert.equal(t.requests[0].action,'shareCreateMany');assert.deepEqual(t.requests[0].args,{profileId:'felix',collectionIds:['c1','c2','c10']});
 t.requests[0].resolve({results:[{share:{id:'s1',sourceId:'c1',profileId:'felix'}},{share:{id:'s2',sourceId:'c2',profileId:'felix'}}]});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(t.store.doc.adminDirectory.shares.length,2);assert.equal(t.ui.busy,false);
 }finally{globalThis.FormData=Previous;}
});
