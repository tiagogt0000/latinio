import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingUI} from '../app/sharing-ui.js';
function setup(){
 const nodes=new Map();const requests=[];const views=[];
 globalThis.document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,{isConnected:true,textContent:'',innerHTML:''});return nodes.get(key);}};
 const store=new EventTarget();store.doc={};store.data={settings:{},collections:{}};store.update=async fn=>{store.doc=fn(store.doc);};
 const sync={request(action,args){return new Promise((resolve,reject)=>requests.push({action,args,resolve,reject}));}};
 const ui=sharingUI({store,sync,profile:{role:'admin'},h:s=>String(s??''),showModal:s=>views.push(s),showAdmin:s=>views.push(s),notify(){},render(){}});
 return {ui,requests,views,nodes,store,sync};
}
test('Profiles open before slow Google request completes; closing prevents stale DOM updates',async()=>{
 const {ui,requests,views,nodes}=setup();const result=await ui.handle({dataset:{action:'account-profiles'}});
 assert.equal(result,true);assert.match(views[0],/Deine Nutzer/);assert.match(views[0],/name="allowedSubject" value="latin" checked/);assert.match(views[0],/name="allowedSubject" value="english" checked/);assert.equal(requests.length,1);
 const list=nodes.get('.profile-list');requests[0].resolve({profiles:[{id:'p',name:'Felix',email:'test@example.org',allowedSubjects:['english']}]});
 await new Promise(resolve=>setImmediate(resolve));assert.match(list.innerHTML,/Englisch/);assert.match(list.innerHTML,/data-action="admin-person"/);assert.equal(views.length,1);await ui.handle({dataset:{action:'admin-person',id:'p'}});assert.match(views[1],/data-action="profile-subjects"/);
});
test('Sharing opens immediately and reports network failures inside the open window',async()=>{
 const {ui,requests,views,nodes}=setup();await ui.handle({dataset:{action:'share-panel'}});
 assert.match(views[0],/Sammlungen freigeben/);assert.equal(requests.length,2);requests[0].reject(Error('Offline'));requests[1].resolve({shares:[]});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(nodes.get('[data-directory-status]').textContent,'Offline');
});

Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
test('freigaben only render the selected user and collections start collapsed',async()=>{
 const t=setup();
 const people=[{id:'p1',name:'One',email:'one@example.invalid'},{id:'p2',name:'Two',email:'two@example.invalid'}];
 t.store.doc.adminDirectory={people,shares:people.flatMap(p=>Array.from({length:18},(_,i)=>({id:p.id+'s'+i,profileId:p.id,profileName:p.name,collection:{name:p.id+' Lektion '+i}})))};
 const ui=sharingUI({store:t.store,sync:t.sync,profile:{role:'admin'},h:s=>String(s??''),showAdmin:s=>t.views.push(s),showModal:s=>t.views.push(s),notify(){},render(){}});
 await ui.handle({dataset:{action:'share-panel'}});
 assert.ok(!t.views[0].includes('p1 Lektion'));
 assert.ok(!t.views[0].includes('p2 Lektion'));
 ui.change({name:'profileId',value:'p1',closest:()=>true});
 const html=t.nodes.get('[data-share-list]').innerHTML;
 assert.equal((html.match(/class="share-entry"/g)||[]).length,18);
 assert.ok(!html.includes('p2 Lektion'));
 assert.ok(!html.includes('<details open'));
});

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
