import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
import {openDatabase} from '../server/database.mjs';
import {needsCodeLogin} from '../app/accounts.js';
import {apiServer} from '../server/http.mjs';

function setup(){
  const h=harness();
  const p=h.request({action:'profileCreate',name:'Felix',email:'felix@example.org'}).profile;
  const legacy=h.request({action:'login',email:p.email});
  h.ctx.STUDENT_CODES_REQUIRED=true;
  return {h,p,legacy};
}
test('All students, including existing sessions, require codes; admin credentials remain unchanged',()=>{
  const {h,p,legacy}=setup(),pin=h.props.ADMIN_PIN_HASH;
  assert.throws(()=>h.request({action:'login',email:p.email}),/Zugangscode/);
  assert.throws(()=>h.request({action:'check',token:legacy.token}),/Zugangscode neu an/);
  assert.throws(()=>h.request({action:'push',token:legacy.token,base:0,ops:[]}),/Zugangscode neu an/);
  const generated=h.request({action:'profileCodeGenerate',profileId:p.id});
  assert.match(generated.code,/^\d{4}$/);assert.equal(generated.profile.loginCodeHash,undefined);
  const logged=h.request({action:'login',code:generated.code});
  assert.equal(logged.profile.id,p.id);assert.ok(logged.profile.codeAuthVersion);
  assert.equal(h.request({action:'whoami',token:logged.token}).profile.id,p.id);
  assert.equal(h.props.ADMIN_PIN_HASH,pin);
  assert.equal(h.request({action:'login',admin:true,pin:'1234'}).profile.role,'admin');
  assert.equal(h.request({action:'check'}).version,0);
});
test('Code reset revokes previous devices and old codes, preserves journals and never reveals hashes',()=>{
  const {h,p}=setup();const first=h.request({action:'profileCodeGenerate',profileId:p.id});
  const logged=h.request({action:'login',code:first.code});
  const op={id:'learned',entity:'reviews',key:'learned',value:{id:'learned',wordId:'w',grade:'full',at:1},device:'test',seq:1,at:1};
  h.request({action:'push',token:logged.token,base:0,ops:[op]});
  assert.throws(()=>h.request({action:'profileCodeGenerate',token:logged.token,profileId:p.id}),/Admin/);
  const second=h.request({action:'profileCodeGenerate',profileId:p.id});assert.notEqual(second.code,first.code);
  assert.throws(()=>h.request({action:'whoami',token:logged.token}),/Zugangscode neu an/);
  assert.throws(()=>h.request({action:'login',code:first.code}),/stimmt nicht/);
  const newSession=h.request({action:'login',code:second.code});
  assert.equal(h.request({action:'pull',token:newSession.token,since:0}).data.reviews.learned.grade,'full');
  for(const response of [h.request({action:'profiles'}),h.request({action:'profileUpdateSubjects',profileId:p.id,allowedSubjects:['latin']}),newSession]){
    assert.doesNotMatch(JSON.stringify(response),/loginCodeHash|loginCodeSalt/);
  }
});
test('Leading-zero codes work, duplicate and admin codes are excluded, deleted users cannot log in',()=>{
  const {h,p}=setup();
  const original=h.ctx.Utilities.getUuid;let first=true;
  h.ctx.Utilities.getUuid=()=>{if(first){first=false;return '00000000-0000-4000-8000-000000000001';}return original();};
  const a=h.request({action:'profileCodeGenerate',profileId:p.id});assert.equal(a.code,'0001');
  const other=h.request({action:'profileCreate',name:'Other',email:'other@example.org'}).profile;
  const b=h.request({action:'profileCodeGenerate',profileId:other.id});assert.notEqual(b.code,a.code);assert.notEqual(b.code,'1234');
  assert.equal(h.request({action:'login',code:a.code}).profile.id,p.id);
  h.request({action:'profileDelete',profileId:p.id});assert.throws(()=>h.request({action:'login',code:a.code}),/stimmt nicht/);
});
test('SQLite persists failed code attempts across requests and isolates admin PIN lockout',t=>{
  const {h,p}=setup();const snapshot={format:'latinio-pi-migration',schema:1,properties:h.props,sheets:[...h.sheets].map(([name,s])=>({name,rows:structuredClone(s.rows)}))};
  const db=openDatabase(':memory:',{requireStudentCodes:true});t.after(()=>db.close());db.importSnapshot(snapshot);
  const admin='a'.repeat(64),a=db.request({action:'profileCodeGenerate',token:admin,profileId:p.id});
  for(let i=0;i<5;i++)assert.throws(()=>db.request({action:'login',code:'invalid'}),/stimmt nicht/);
  assert.throws(()=>db.request({action:'login',code:a.code}),/fünf Minuten/);
  assert.equal(db.request({action:'login',admin:true,pin:'1234'}).profile.role,'admin');
});
test('Only code-authenticated cached students or admin accounts can be restored locally',()=>{
  assert.equal(needsCodeLogin({id:'existing',role:'student'}),true);
  assert.equal(needsCodeLogin({id:'existing',role:'student',codeAuthVersion:'verified'}),false);
  assert.equal(needsCodeLogin({id:'admin',role:'admin'}),false);
});
test('Production HTTP policy rejects email and legacy tokens and accepts the generated code',async t=>{
  const {h,p,legacy}=setup();
  const snapshot={format:'latinio-pi-migration',schema:1,properties:h.props,sheets:[...h.sheets].map(([name,s])=>({name,rows:structuredClone(s.rows)}))};
  const db=openDatabase(':memory:',{requireStudentCodes:true});db.importSnapshot(snapshot);
  const server=apiServer(db);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});
  const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await (await fetch(base+'/health')).json()).studentCodesRequired,true);
  const request=(payload,token='')=>fetch(base+'/api',{method:'POST',headers:{Origin:'https://tiagogt0000.github.io','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(payload)});
  assert.equal((await request({action:'login',email:p.email})).status,400);
  assert.equal((await request({action:'check'},legacy.token)).status,400);
  const created=await (await request({action:'profileCodeGenerate',profileId:p.id},'a'.repeat(64))).json();
  const login=await (await request({action:'login',code:created.result.code})).json();
  assert.equal(login.result.profile.id,p.id);
  assert.equal((await request({action:'check'},login.result.token)).status,200);
});
