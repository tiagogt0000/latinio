import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate} from '../app/core.js';
import {answerFeedback} from '../app/feedback.js';
import {AppUpdates,waitForInstallation} from '../app/updates.js';

test('Feedback renders correct, wrong and missing meanings exactly once and escapes input',()=>{
  const result=evaluate({meanings:[['führen'],['tragen'],['ausführen']]},['führen','<script>'],false);
  const html=answerFeedback(result);
  assert.equal((html.match(/graded-answer correct/g)||[]).length,1);
  assert.equal((html.match(/graded-answer incorrect/g)||[]).length,2);
  assert.match(html,/<s>&lt;script&gt;<\/s>/);
  assert.match(html,/Mögliche Lösung:<\/span> tragen/);
  assert.match(html,/ausführen<\/span><span class="missing-label">Fehlte/);
  assert.match(html,/data-index="1"/);
});
test('Accepted typos need no individual explanation; blank answer reveals all missing meanings',()=>{
  const word={meanings:[['tragen'],['führen']]};
  const html=answerFeedback(evaluate(word,['trgaen','führen']));
  assert.equal((html.match(/graded-answer correct/g)||[]).length,2);
  assert.doesNotMatch(html,/Tippfehler|reject-typo|incorrect/);
  assert.equal((answerFeedback(evaluate(word,[''])).match(/missing-label/g)||[]).length,2);
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
