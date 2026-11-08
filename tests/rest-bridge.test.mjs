import test from 'node:test';
import assert from 'node:assert/strict';
import {RestBridge} from '../app/rest-bridge.js';

test('Safari load failures explain the unavailable cloud without retrying a mutation',async()=>{
 let calls=0;
 const cause=new TypeError('Load failed');
 const bridge=new RestBridge('https://example.test/api','fixture',{fetchImpl:async()=>{calls++;throw cause;}});
 await assert.rejects(bridge.request('push',{base:1,ops:[]}),error=>error.code==='network'&&error.cause===cause&&/lokaler Lernstand bleibt erhalten/.test(error.message));
 assert.equal(calls,1);assert.equal(bridge.controllers.size,0);
});

test('Timeout and disposal release pending requests with distinct errors',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const waitForAbort=(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
 const bridge=new RestBridge('https://example.test/api','fixture',{fetchImpl:waitForAbort});
 const timed=bridge.request('check');
 const timeoutResult=assert.rejects(timed,error=>error.code==='timeout'&&/zu langsam/.test(error.message));
 t.mock.timers.tick(30000);await timeoutResult;
 assert.equal(bridge.controllers.size,0);
 const cancelled=bridge.request('check');
 const cancellationResult=assert.rejects(cancelled,error=>error.code==='cancelled'&&/geändert/.test(error.message));
 bridge.destroy();await cancellationResult;
 assert.equal(bridge.controllers.size,0);
});

test('Grammar retains its longer deadline and never invents a result on timeout',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let aborted=false;
 const bridge=new RestBridge('https://example.test/api','fixture',{fetchImpl:(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'));},{once:true}))});
 const result=assert.rejects(bridge.request('grammarGrade'),error=>error.code==='timeout');
 t.mock.timers.tick(30000);assert.equal(aborted,false);
 t.mock.timers.tick(70000);await result;assert.equal(aborted,true);
});

test('A truncated or non-JSON cloud reply is reported without leaking parser details',async()=>{
 for(const json of [async()=>{throw new SyntaxError('Unexpected token < in private reverse proxy response');},async()=>null]){
  const bridge=new RestBridge('https://example.test/api','fixture',{fetchImpl:async()=>({ok:false,json})});
  await assert.rejects(bridge.request('check'),error=>error.code==='invalid-response'&&/keine gültige Antwort/.test(error.message)&&!error.message.includes('private'));
  assert.equal(bridge.controllers.size,0);
 }
});

test('Explicit server authentication errors retain their meaning for the session handler',async()=>{
 const bridge=new RestBridge('https://example.test/api','fixture',{fetchImpl:async()=>({ok:false,json:async()=>({error:'Bitte erneut anmelden.'})})});
 await assert.rejects(bridge.request('whoami'),{message:'Bitte erneut anmelden.'});
});
