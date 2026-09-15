import test from 'node:test';
import assert from 'node:assert/strict';
import {StartupGate} from '../app/startup-gate.js';
import {Sync} from '../app/sync.js';

const windowMock=new EventTarget();
globalThis.window=windowMock;
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
function harness(request){
  const store={doc:{config:{url:'test',token:'test'},base:47,pending:[]},async update(fn){this.doc=fn(this.doc);}};
  const sync=new Sync(store);sync.request=request;
  const gate=new StartupGate(sync);
  return {store,sync,gate};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('Startup blocks access until an actual cloud response; returning requires a fresh check',async()=>{
  let reply;
  const {gate}=harness(()=>new Promise(resolve=>reply=resolve));
  gate.begin();assert.equal(gate.state,'checking');
  gate.continueOffline();assert.equal(gate.blocked,true);
  reply({version:47});await settle();assert.equal(gate.blocked,false);
  gate.begin();assert.equal(gate.blocked,true);
  reply({version:47});await settle();assert.equal(gate.blocked,false);
});

test('An already running background check keeps startup blocked until completion',async()=>{
  let reply;
  const {sync,gate}=harness(()=>new Promise(resolve=>reply=resolve));
  const check=sync.run();gate.begin();assert.equal(gate.blocked,true);
  reply({version:47});await check;assert.equal(gate.blocked,false);
});

test('Newer cloud data requires acceptance and cannot be bypassed as offline',async()=>{
  const {sync,gate}=harness(async action=>action==='check'?{version:48}:{version:48,data:{},ops:[]});
  gate.begin();await settle();assert.equal(gate.state,'newer');
  gate.continueOffline();assert.equal(gate.state,'newer');
  sync.set('loading','Loading');assert.equal(gate.state,'loading');
  sync.remote=null;sync.set('synced','Loaded');assert.equal(gate.blocked,false);
});

test('Connection failure stays blocked until explicit offline choice or successful retry',async()=>{
  const {sync,gate}=harness(async()=>{throw Error('Timeout');});
  gate.begin();await settle();assert.equal(gate.state,'error');assert.equal(gate.message,'Timeout');
  gate.continueOffline();assert.equal(gate.blocked,false);
  gate.begin();await settle();assert.equal(gate.state,'error');
  sync.request=async()=>({version:47});gate.begin();await settle();assert.equal(gate.blocked,false);
});

test('Offline launch offers a deliberate choice; initial cloud setup remains accessible',()=>{
  navigator.onLine=false;
  try{
    const {gate,sync}=harness(()=>assert.fail('No network call expected'));
    gate.begin();assert.equal(gate.state,'error');gate.continueOffline();assert.equal(gate.blocked,false);
    sync.store.doc.config={};gate.begin();assert.equal(gate.blocked,false);
  }finally{navigator.onLine=true;}
});
