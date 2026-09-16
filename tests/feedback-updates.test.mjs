import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../app/core.js';
import fs from 'node:fs';
import {answerFeedback,translationCard} from '../app/feedback.js';
import {AppUpdates,waitForInstallation} from '../app/updates.js';

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

Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
test('Update check distinguishes available, current and failed network checks',async()=>{
  const registration={waiting:null,installing:null,async update(){}};
  const manager=new AppUpdates({getRegistration:async()=>registration});
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
