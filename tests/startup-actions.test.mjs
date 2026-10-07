import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cloudGate,waitForInitialSync} from '../app/multiuser-sync.js';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
function fixture(){
 let release,starts=0;const buttons=[],attrs=new Map();
 const d={settings:{},words:{},collections:{}},store={doc:{pending:[]},data:d};
 const sync={status:'synced',run:()=>new Promise(resolve=>release=resolve)};
 const gate=cloudGate({store,sync});const task=gate.run();
 const ctx=vm.createContext({ready:true,working:false,waitingStart:false,cloudWait:gate,waitForInitialSync,data:()=>d,trainingDecks:()=>Object.values(d.collections),selected:[],screen:'learn',collectionFilter:'all',search:'',store,sync,sharing:{handle:async()=>false,afterAction(){}},confusions:{handle:async()=>false},start:async()=>starts++,startPredicatePractice:()=>starts++,checkShareNotices(){},autoUpdate(){},closeModal(){},render(){buttons.forEach(b=>b.isConnected=false);},notify:m=>{throw Error(m);}});
 vm.runInContext(source.slice(source.indexOf('async function actions('),source.indexOf("document.addEventListener('click',event=>")),ctx);
 function action(name){const button={dataset:{action:name,screen:'collections'},innerHTML:'Smart lernen',disabled:false,isConnected:true,getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};buttons.push(button);return {button,promise:ctx.actions({preventDefault(){},target:{closest:()=>button}})};}
 return {ctx,d,action,task,get starts(){return starts;},release(){release();}};
}
test('A start clicked before initial download uses downloaded decks, without a duplicate start',async()=>{
 const t=fixture();await new Promise(resolve=>setImmediate(resolve));const click=t.action('start');assert.match(click.button.innerHTML,/button-loading/);assert.equal(t.ctx.working,false);
 await t.action('start').promise;assert.equal(t.starts,0);t.d.collections.downloaded={id:'downloaded',active:true};t.release();await click.promise;
 assert.equal(t.starts,1);assert.deepEqual(Array.from(t.ctx.selected),['downloaded']);assert.equal(t.ctx.waitingStart,false);
});
test('Navigation stays available during the first sync and cancels a now hidden learning start',async()=>{
 const t=fixture();await new Promise(resolve=>setImmediate(resolve));const click=t.action('predicate-start');await t.action('nav').promise;assert.equal(t.ctx.screen,'collections');
 t.release();await click.promise;assert.equal(t.starts,0);assert.equal(t.ctx.waitingStart,false);
});
