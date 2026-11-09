import test from 'node:test';
import assert from 'node:assert/strict';
import {openAccount} from '../app/accounts.js';
import {Store} from '../app/store.js';
import {CLOUD_URL} from '../app/cloud-config.js';
import {RestBridge} from '../app/rest-bridge.js';

function fixture(t,{profile,token='saved-session',online=true,identity,identityError}={}){
 const originalOpen=Store.prototype.open,originalFetch=globalThis.fetch,originalFormData=globalThis.FormData;
 const originalDestroy=RestBridge.prototype.destroy;
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const saved=new Map(profile?[['latinio-account-v2',JSON.stringify(profile)],['latinio-account-migrated-v2','1']]:[]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:online}});
 let reads=0,requests=0,updates=0,shown=0,closed=0,destroyed=0,html='';const actions=[];
 Store.prototype.open=async function(id){
  reads++;this.profileId=id;this.doc={config:{url:CLOUD_URL,token:profile?.id===id?token:''},profile:profile?.id===id?profile:null};
  this.update=async change=>{updates++;return this.doc=change(this.doc);};this.close=()=>closed++;return this;
 };
 const button={disabled:false},status={textContent:''},toggle={},form={querySelector:()=>button};
 const root={get innerHTML(){return html;},set innerHTML(value){html=value;shown++;},querySelector:selector=>selector==='#login-toggle'?toggle:selector==='#login-status'?status:form};
 globalThis.FormData=class{get(){return '1234';}};
 globalThis.fetch=async(_url,options)=>{requests++;const {action}=JSON.parse(options.body);actions.push(action);if(action==='whoami'){if(identityError instanceof Error)throw identityError;return {ok:!identityError,json:async()=>identityError?{error:identityError}:{result:{profile:identity}}};}return {ok:true,json:async()=>({result:{profile:{id:'new',role:'student',codeAuthVersion:'v1'},token:'new-session'}})};};
 RestBridge.prototype.destroy=function(){destroyed++;return originalDestroy.call(this);};
 t.after(()=>{
  Store.prototype.open=originalOpen;RestBridge.prototype.destroy=originalDestroy;globalThis.fetch=originalFetch;globalThis.FormData=originalFormData;
  for(const [key,old]of [['localStorage',oldStorage],['navigator',oldNavigator]])if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];
 });
 return {root,form,button,status,actions,saved,get requests(){return requests;},get updates(){return updates;},get shown(){return shown;},get reads(){return reads;},get closed(){return closed;},get destroyed(){return destroyed;}};
}

test('Previously verified student and admin accounts open their local store without awaiting a network request',async t=>{
 for(const profile of [{id:'student',role:'student',codeAuthVersion:'v1'},{id:'student',role:'student',codeAuthVersion:'v1',allowedSubjects:['latin']},{id:'student',role:'student',codeAuthVersion:'v1',allowedSubjects:['english']},{id:'admin',role:'admin',allowedSubjects:[]}])await t.test(profile.role,async t=>{
  const f=fixture(t,{profile});let login=0;
  const result=await openAccount(f.root,{onLogin(){login++;}});
  assert.equal(result.profile.id,profile.id);assert.equal(f.requests,0);assert.equal(f.updates,0);
  assert.equal(f.shown,0);assert.equal(login,0);result.store.close();
 });
});

test('A student with no current cached subject can pick up a newly granted subject before boot checks access',async t=>{
 for(const allowedSubjects of [[],['retired-subject']])await t.test(JSON.stringify(allowedSubjects),async t=>{
  const profile={id:'student',name:'Cached',role:'student',codeAuthVersion:'v1',allowedSubjects},identity={...profile,name:'Verified',allowedSubjects:['english']};
  const f=fixture(t,{profile,identity});let login=0;
  const result=await openAccount(f.root,{onLogin(){login++;}});
  assert.deepEqual(result.profile,identity);assert.deepEqual(result.store.doc.profile,identity);
  assert.deepEqual(JSON.parse(f.saved.get('latinio-account-v2')),identity);
  assert.deepEqual(f.actions,['whoami']);assert.equal(f.updates,1);assert.equal(f.destroyed,1);assert.equal(login,0);assert.equal(f.shown,0);
 });
});

test('Offline or unavailable identity lookup keeps the restricted cached profile for the retry screen',async t=>{
 const profile={id:'student',role:'student',codeAuthVersion:'v1',allowedSubjects:['retired-subject']};
 for(const options of [{online:false},{identityError:new TypeError('Load failed')}])await t.test(options.online===false?'offline':'network error',async t=>{
  const f=fixture(t,{profile,...options});const result=await openAccount(f.root);
  assert.deepEqual(result.profile,profile);assert.equal(f.updates,0);assert.equal(f.shown,0);
  assert.deepEqual(f.actions,options.online===false?[]:['whoami']);assert.equal(f.destroyed,options.online===false?0:1);
 });
});

test('Mismatched or revoked restricted accounts require login without replacing their saved profile',async t=>{
 const profile={id:'student',role:'student',codeAuthVersion:'v1',allowedSubjects:[]};
 for(const response of [{identity:{...profile,id:'other',allowedSubjects:['latin']}},{identityError:'Bitte erneut anmelden.'},{identityError:'Dieses Profil ist nicht freigeschaltet.'}])await t.test(response.identityError||'wrong profile',async t=>{
  const f=fixture(t,{profile,...response});let login=0;
  const result=openAccount(f.root,{onLogin(){assert.equal(f.shown,0);login++;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(login,1);assert.match(f.root.innerHTML,/account-login/);assert.equal(f.updates,0);
  assert.equal(f.saved.has('latinio-account-v2'),false);assert.equal(f.destroyed,1);assert.equal(f.closed,2);
  assert.deepEqual(f.actions,['whoami']);
  await f.form.onsubmit({preventDefault(){},stopPropagation(){},currentTarget:f.form});
  assert.equal((await result).profile.id,'new');assert.deepEqual(f.actions,['whoami','login']);
 });
});

test('Missing tokens and old unverified student accounts show login before making any network request',async t=>{
 for(const entry of [{profile:{id:'student',role:'student',codeAuthVersion:'v1'},token:''},{profile:{id:'student',role:'student'},token:'legacy'}])await t.test(entry.token||'no token',async t=>{
  const f=fixture(t,entry);let login=0;
  const result=openAccount(f.root,{onLogin(){assert.equal(f.shown,0);login++;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(login,1);assert.match(f.root.innerHTML,/account-login/);assert.equal(f.requests,0);
  await f.form.onsubmit({preventDefault(){},stopPropagation(){},currentTarget:f.form});
  assert.equal((await result).profile.id,'new');assert.equal(f.requests,1);
 });
});
