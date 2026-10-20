import test from 'node:test';
import assert from 'node:assert/strict';
import {grammarUI,grammarCard} from '../app/grammar.js';
import {readFileSync} from 'node:fs';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=x=>structuredClone(x),cacheKey='latinio-grammar-v1:admin';
const baseRound=()=>({id:'round-123456789012345',topicId:'english-auxiliaries-v1',revision:0,created:Date.now(),tasks:[1,2,3].map(n=>({id:'q'+n,goalId:'modal',promptDe:'Kann dein Bruder schwimmen? '+n,vocabularyHint:'swim = schwimmen'})),answers:{q1:'',q2:'',q3:''},evaluations:[]});
function fixture(t,{role='admin',initial=null,offline=false}={}){
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{value:{querySelector:()=>null},configurable:true});t.after(()=>original?Object.defineProperty(globalThis,'document',original):delete globalThis.document);
 const values=new Map(initial?[[cacheKey,JSON.stringify(initial)]]:[]),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 let round=baseRound(),isOnline=!offline,fail='',generationCount=0,requestId=0,opStatus=null;const calls=[];
 const state=()=>({configured:true,topic:{goals:[]},stats:[],limits:{dailyCalls:40,dailyTokens:200000},usage:{calls:generationCount,input_tokens:0,output_tokens:0,reserved_tokens:0},roundCount:1,rounds:[{id:round.id,created:round.created,count:3,evaluated:!!round.evaluations.length,correct:0}],latest:copy(round)});
 const sync={async request(action,payload={}){
  calls.push({action,payload:copy(payload)});if(fail)throw Error(fail);
  if(action==='grammarStatus')return state();
  if(action==='grammarRound')return {round:copy(round)};
  if(action==='grammarOperation')return copy(opStatus||{status:'unknown'});
  if(action==='grammarSave'){if(payload.revision!==round.revision)throw Error('Auf einem anderen Gerät geändert');round.answers=copy(payload.answers);round.revision++;return {round:copy(round)};}
  if(action==='grammarGenerate'){generationCount++;round=baseRound();round.id='generated-round-'+generationCount;return {round:copy(round),state:state()};}
  if(action==='grammarGrade'||action==='grammarReview'){
   round.answers=copy(payload.answers||round.answers);round.evaluations.push({at:Date.now(),results:round.tasks.map(task=>({id:task.id,status:'correct',target:'correct',otherGrammar:'correct',vocabulary:'correct',content:'correct',correction:'Can your brother swim?',explanationDe:'Das passt.',ruleDe:'Nach can folgt die Grundform.',example:'Can she swim?',possibleMisconceptionDe:''}))});round.revision++;return {round:copy(round),state:state()};
  }
  if(action==='grammarHistory')return {rounds:[]};
  return state();
 }};
 const options={profile:{id:'admin',role},sync,h,go(){},render(){},isVisible:()=>true,notify(){},storage,online:()=>isOnline,id:()=>('request-'+(++requestId)).padEnd(20,'0'),confirm:()=>true};
 const ui=grammarUI(options);
 return {ui,options,values,calls,storage,round:()=>round,setRound:r=>round=copy(r),setFailure:x=>fail=x,setOnline:v=>isOnline=v,setOp:v=>opStatus=v,button:(action,id)=>ui.handle({dataset:{action,id}})};
}
async function settle(ui){for(let n=0;n<30;n++){await new Promise(r=>setImmediate(r));if(!ui.busy)return;}throw Error('UI did not settle');}
test('One-at-a-time answers, explicit final review, one batch request and results with all dimensions',async t=>{
 const f=fixture(t);await f.ui.refresh();f.button('grammar-generate');await settle(f.ui);assert.equal(f.calls.filter(x=>x.action==='grammarGenerate').length,1);
 for(let n=1;n<=3;n++){
  assert.match(f.ui.view(),new RegExp('Aufgabe '+n+' von 3'));
  f.ui.input({dataset:{grammarAnswer:'q'+n},value:'Can your brother swim?'});
  f.ui.submit({id:'grammar-answer-form'});await f.ui.flush();
  assert.equal(f.calls.filter(x=>x.action==='grammarGrade').length,0);
 }
 assert.match(f.ui.view(),/Bereit zur Kontrolle/);assert.equal(f.ui.draft.mode,'review');
 f.button('grammar-grade');f.button('grammar-grade');assert.match(f.ui.view(),/Wird kontrolliert/);await settle(f.ui);
 assert.equal(f.calls.filter(x=>x.action==='grammarGrade').length,1);assert.match(f.ui.view(),/3 von 3 richtig/);
 for(const label of ['Hilfsverben','Weitere Grammatik','Wortwahl','Inhalt','Neue Aufgaben','Bewertung erneut prüfen'])assert.ok(f.ui.view().includes(label));
});
test('Offline drafts including punctuation survive reopen; no API call until connected',async t=>{
 const round=baseRound(),f=fixture(t,{offline:true,initial:{count:3,mode:'question',index:0,round,dirty:false,pending:null}});
 const answer='Why can’t <my brother> go swimming?';f.ui.input({dataset:{grammarAnswer:'q1'},value:answer});
 const reopened=grammarUI(f.options);assert.equal(reopened.draft.round.answers.q1,answer);assert.match(reopened.view(),/Offline/);assert.ok(reopened.view().includes('&lt;my brother&gt;'));assert.equal(f.calls.length,0);
 await assert.rejects(reopened.flush(),/offline/);f.setOnline(true);await reopened.flush();assert.equal(f.round().answers.q1,answer);
});
test('Failed grading keeps answers and an explicit retry reuses the same immutable operation ID',async t=>{
 const f=fixture(t);await f.ui.refresh();f.button('grammar-resume');f.ui.input({dataset:{grammarAnswer:'q1'},value:'Can he swim?'});await f.ui.flush();
 f.setFailure('OVHcloud ist momentan ausgelastet.');f.button('grammar-grade');await settle(f.ui);
 const pending=copy(f.ui.draft.pending);assert.equal(f.ui.draft.round.answers.q1,'Can he swim?');assert.match(f.ui.view(),/Erneut versuchen/);
 f.setFailure('');f.button('grammar-retry');await settle(f.ui);const calls=f.calls.filter(x=>x.action==='grammarGrade');assert.equal(calls.length,2);assert.equal(calls[1].payload.requestId,pending.payload.requestId);assert.equal(calls[0].payload.requestId,calls[1].payload.requestId);assert.equal(f.ui.draft.pending,null);
});
test('A restarted UI retrieves a completed operation without starting another paid request',async t=>{
 const round=baseRound(),f=fixture(t,{initial:{count:3,mode:'intro',round:null,dirty:false,pending:{action:'grammarGenerate',payload:{requestId:'pending-operation-12345'}}}});
 f.setOp({status:'done',round});await f.ui.refresh();assert.equal(f.ui.draft.round.id,round.id);assert.equal(f.ui.draft.pending,null);assert.equal(f.calls.filter(x=>x.action==='grammarGenerate').length,0);
});
test('The password field is cleared immediately and the API key never enters browser persistence or rendered state',async t=>{
 const f=fixture(t),original=globalThis.FormData,secret='a-private-test-ovh-key',field={value:secret,setAttribute(){}};
 globalThis.FormData=class{get(name){return {apiKey:secret,dailyCalls:'40',dailyTokens:'200000'}[name];}};t.after(()=>{globalThis.FormData=original;});
 const form={id:'grammar-config',querySelector:()=>field};f.ui.submit(form);assert.equal(field.value,'');await settle(f.ui);
 const call=f.calls.find(x=>x.action==='grammarConfigure');assert.equal(call.payload.apiKey,secret);assert.ok(![...f.values.values()].join('').includes(secret));assert.ok(!f.ui.view().includes(secret));
});
test('Changed Pi revisions require a comparison and keep the local answer copy before resolving',async t=>{
 const round=baseRound();round.answers.q1='my local draft';const f=fixture(t,{initial:{count:3,mode:'question',index:0,round,dirty:true,pending:null}});
 const remote=baseRound();remote.revision=2;remote.answers.q1='my other device';f.setRound(remote);await f.ui.refresh();assert.match(f.ui.view(),/Zwei Entwürfe vergleichen/);assert.match(f.ui.view(),/my local draft/);assert.match(f.ui.view(),/my other device/);
 f.button('grammar-use-local');await f.ui.flush();assert.equal(f.round().answers.q1,'my local draft');assert.ok([...f.values.keys()].some(k=>k.startsWith(cacheKey+':sicherung:')));
});
test('Admin guard, escaped task HTML, disabled autocorrect and offline shell files',async t=>{
 const f=fixture(t,{role:'student'});f.button('grammar-open');assert.equal(f.ui.view(),'');assert.equal(f.calls.length,0);
 const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(main,/isAdmin\(\)&&subject==='english'\?grammarCard\(\)/);assert.match(main,/screen==='grammar'&&isAdmin\(\)&&subject==='english'/);
 assert.match(grammarCard(),/Grammatik lernen/);for(const file of ['grammar.js','grammar.css'])assert.ok(sw.includes('./app/'+file));
 const round=baseRound();round.tasks[0].promptDe='<script>attack()</script>';const adminUi=grammarUI({...f.options,profile:{id:'admin',role:'admin'},storage:{getItem:()=>JSON.stringify({count:3,mode:'question',index:0,round}),setItem(){}}});
 const html=adminUi.view();assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/autocorrect="off"/);assert.match(html,/autocapitalize="none"/);assert.match(html,/spellcheck="false"/);
});
