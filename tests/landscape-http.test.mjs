import test from 'node:test';
import assert from 'node:assert/strict';
import {apiServer} from '../server/http.mjs';

async function fixture(t,{role='admin',authenticated=true,landscape=true}={}){
  const calls=[];
  const db={ready:()=>true,request(body){
    if(body.action==='whoami'){
      if(!authenticated||body.token!=='a'.repeat(40))throw Error('Bitte erneut anmelden.');
      return {profile:{id:'fixture-profile',role}};
    }
    return {classic:true};
  }};
  const service={async request(body,identity){calls.push({body,identity});return {ok:true};}};
  const server=apiServer(db,undefined,null,null,landscape?service:null);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  return {calls,async call(action,extra={}){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api`,{
      method:'POST',headers:{Origin:'https://tiagogt0000.github.io','Content-Type':'application/json',Authorization:`Bearer ${'a'.repeat(40)}`},
      body:JSON.stringify({action,...extra})
    });
    return {status:response.status,body:await response.json()};
  }};
}

test('landscape routes use verified admin identity, ignoring body role',async t=>{
  const {call,calls}=await fixture(t);
  const result=await call('landscapePull',{profile:{id:'forged',role:'student'}});
  assert.equal(result.status,200);
  assert.deepEqual(calls[0].identity,{id:'fixture-profile',role:'admin'});
});

test('student direct API calls are rejected before accessing state or sentences',async t=>{
  const {call,calls}=await fixture(t,{role:'student'});
  for(const action of ['landscapePull','landscapeSync','landscapeCatalogue','landscapeSentences']){
    assert.equal((await call(action,{profile:{role:'admin'}})).status,403);
  }
  assert.equal(calls.length,0);
  assert.deepEqual((await call('pull')).body,{result:{classic:true}});
});

test('expired authentication cannot read landscape data',async t=>{
  const {call,calls}=await fixture(t,{authenticated:false});
  assert.equal((await call('landscapePull')).status,400);
  assert.equal(calls.length,0);
});

test('old backend configuration reports missing landscape without affecting classic requests',async t=>{
  const {call}=await fixture(t,{landscape:false});
  const result=await call('landscapePull');
  assert.equal(result.status,400);
  assert.match(result.body.error,/Pi-Backend/);
  assert.equal((await call('pull')).status,200);
});
