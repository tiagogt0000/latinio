import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../app/core.js';
import fs from 'node:fs';
import {answerFeedback,translationCard} from '../app/feedback.js';
import {accountCard} from '../app/accounts.js';
import {AppUpdates,APP_VERSION,waitForInstallation,workerVersion} from '../app/updates.js';

test('Feedback marks only submitted answers and escapes input',()=>{
  const result=evaluate({meanings:[['führen'],['tragen'],['ausführen']]},['führen','<script>'],false);
  const html=answerFeedback(result);
  assert.equal((html.match(/graded-answer correct/g)||[]).length,1);
  assert.equal((html.match(/graded-answer incorrect/g)||[]).length,1);
  assert.match(html,/<s>&lt;script&gt;<\/s>/);
  assert.doesNotMatch(html,/Mögliche Lösung|tragen|ausführen|missing-label/);
  assert.match(html,/data-index="1"/);
});
test('Accepted typos need no explanation; blank answers do not create solution fields',()=>{
  const word={meanings:[['tragen'],['führen']]};
  const html=answerFeedback(evaluate(word,['trgaen','führen']));
  assert.equal((html.match(/graded-answer correct/g)||[]).length,2);
  assert.doesNotMatch(html,/Tippfehler|reject-typo|incorrect/);
  assert.equal(answerFeedback(evaluate(word,[''])), '');
});
test('Incorrect evaluations offer a general correction action while combined meanings pass automatically',()=>{
 const wrong=answerFeedback(evaluate({meanings:[['tragen'],['führen']]},['unbekannt']));
 assert.match(wrong,/Auswertungsfehler korrigieren/);assert.match(wrong,/data-action="correct-evaluation"/);
 const combined=answerFeedback(evaluate({meanings:[['tragen'],['führen']]},['führen tragen']));
 assert.match(combined,/class="graded-answer correct"/);assert.doesNotMatch(combined,/Auswertungsfehler korrigieren/);
});
test('Student-facing profile copy does not disclose the teacher activity log',()=>{
 assert.doesNotMatch(accountCard({role:'student',name:'Felix',email:'felix@example.test'}),/Aktivitätsprotokoll|Lehrkraft sieht/);
 const main=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 assert.doesNotMatch(main,/Aktivitätsprotokoll für deine Lehrkraft aktiv/);
});

Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
test('Update check distinguishes available, current and failed network checks',async()=>{
  const registration={waiting:null,installing:null,async update(){}};
  const manager=new AppUpdates({getRegistration:async()=>registration},async()=>APP_VERSION);
  await manager.check();assert.equal(manager.state,'current');
  registration.waiting={};await manager.check();assert.equal(manager.state,'available');
  registration.waiting=null;registration.update=async()=>{throw Error('Keine Verbindung');};
  await manager.check();assert.equal(manager.state,'error');
  assert.equal(manager.message,'Keine Verbindung');
});
test('Update download waits for installation and reports failed or stalled workers',async()=>{
  const worker=new EventTarget();worker.state='installing';
  const ready=waitForInstallation(worker);worker.state='installed';worker.dispatchEvent(new Event('statechange'));await ready;
  worker.state='redundant';await assert.rejects(waitForInstallation(worker),/nicht geladen/);
  worker.state='installing';await assert.rejects(waitForInstallation(worker,5),/dauert zu lange/);
});
test('Explicit activation sends skip-waiting message and reloads after controller changes',async()=>{
  const serviceWorker=new EventTarget();let reloads=0;
  globalThis.location={reload:()=>reloads++};
  const manager=new AppUpdates(serviceWorker);
  manager.registration={waiting:{postMessage(message){assert.deepEqual(message,{type:'ACTIVATE_UPDATE'});queueMicrotask(()=>serviceWorker.dispatchEvent(new Event('controllerchange')));}}};
  await manager.apply();assert.equal(reloads,1);
});

test('The complete translation is hidden before grading and appears for every outcome',()=>{
 const word={meanings:[['tragen'],['bringen']]};
 assert.equal(translationCard(word,null),'');
 for(const answers of [['tragen','bringen'],['tragen'],['falsch'],['']]){
   const html=translationCard(word,evaluate(word,answers));
   assert.match(html,/class="latin-word translation-card"/);
   assert.match(html,/>tragen, bringen<\/div>/);
 }
 assert.match(translationCard({meanings:[['<Text>']]},{}),/&lt;Text&gt;/);
});
test('German answer inputs allow keyboard correction for initial and added fields',()=>{
 const main=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 const input=main.slice(main.indexOf('function answerInput('),main.indexOf('function feedbackView('));
 assert.match(input,/lang="de"/);assert.match(input,/autocorrect="on"/);assert.match(input,/spellcheck="true"/);
 assert.match(input,/autocomplete="on"/);assert.doesNotMatch(input,/autocorrect="off"|spellcheck="false"/);
 assert.match(main,/translationCard\(word,feedback\)/);
});

test('Deployment mismatch is not reported as current',async()=>{
 const registration={update:async()=>{},active:null};
 const manager=new AppUpdates({getRegistration:async()=>registration},async()=> '99.0.0');
 await manager.check();assert.equal(manager.state,'error');assert.match(manager.message,/bereitgestellt/);
});
test('Already activated update in another tab requires reloading the stale page',async()=>{
 const registration={update:async()=>{},active:{postMessage(message,ports){assert.equal(message.type,'GET_VERSION');ports[0].postMessage({version:'99.0.0'});}}};
 const manager=new AppUpdates({getRegistration:async()=>registration},async()=> '99.0.0');
 await manager.check();assert.equal(manager.state,'available');assert.equal(manager.reloadReady,true);
 let reloads=0;globalThis.location={reload:()=>reloads++};await manager.apply();assert.equal(reloads,1);
});
test('Downloaded updates remain available offline and updatefound detects installation',async()=>{
 navigator.onLine=false;
 const registration=new EventTarget();registration.waiting={};
 const manager=new AppUpdates({getRegistration:async()=>registration},async()=>{throw Error('should not fetch');});
 await manager.check();assert.equal(manager.state,'available');navigator.onLine=true;
 registration.waiting=null;const worker=new EventTarget();worker.state='installing';registration.installing=worker;
 manager.set('current','');registration.dispatchEvent(new Event('updatefound'));
 worker.state='installed';registration.waiting=worker;worker.dispatchEvent(new Event('statechange'));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(manager.state,'available');
});
test('Old workers without version support time out safely',async()=>{
 assert.equal(await workerVersion({postMessage(){}},5),null);
});
