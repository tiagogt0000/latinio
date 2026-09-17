import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingUI} from '../app/sharing-ui.js';
function setup(){
 const nodes=new Map();const requests=[];const views=[];
 globalThis.document={querySelector:key=>{if(!nodes.has(key))nodes.set(key,{isConnected:true,textContent:'',innerHTML:''});return nodes.get(key);}};
 const store=new EventTarget();store.doc={};store.data={settings:{},collections:{}};store.update=async fn=>{store.doc=fn(store.doc);};
 const sync={request(action){return new Promise((resolve,reject)=>requests.push({action,resolve,reject}));}};
 const ui=sharingUI({store,sync,profile:{role:'admin'},h:s=>String(s??''),showModal:s=>views.push(s),notify(){},render(){}});
 return {ui,requests,views,nodes};
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
