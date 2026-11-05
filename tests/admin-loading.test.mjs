import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationsUI} from '../app/notifications.js';
function fixture(){
 let resolve,reject,current='people',target=null;const views=[];
 const document={querySelector:()=>target,createElement:()=>({dataset:{}})};
 const ui=notificationsUI({sync:{request:()=>new Promise((a,b)=>{resolve=a;reject=b;})},profile:{role:'admin'},h:String,showModal(){},showAdmin(html,tab){if(target)target.isConnected=false;current=tab;target={isConnected:true,textContent:'',append(value){this.retry=value;}};views.push({html,tab});},isAdminView:tab=>current===tab,notify(){},render(){}});
 return {ui,document,views,get target(){return target;},resolve:value=>resolve(value),reject:error=>reject(error),leave(){current='shares';target.isConnected=false;}};
}
test('Reminder management shows loading immediately and cannot reopen after navigation',async()=>{
 const old=globalThis.document,t=fixture();globalThis.document=t.document;
 try{const task=t.ui.handle({dataset:{action:'notification-admin'}});assert.equal(t.views.length,1);assert.match(t.views[0].html,/werden geladen/);t.leave();t.resolve({catalog:{messages:[]},history:[]});await task;assert.equal(t.views.length,1);}finally{globalThis.document=old;}
});
test('Reminder loading errors provide a visible retry without throwing away navigation',async()=>{
 const old=globalThis.document,t=fixture();globalThis.document=t.document;
 try{const task=t.ui.handle({dataset:{action:'notification-admin'}});t.reject(Error('offline'));await task;assert.match(t.target.textContent,/offline/);assert.equal(t.target.retry.dataset.action,'notification-admin');}finally{globalThis.document=old;}
});
