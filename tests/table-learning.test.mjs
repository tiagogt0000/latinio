import test from 'node:test';
import assert from 'node:assert/strict';
import { PREFIXES, selectTableItems } from '../app/table-content.js';
import {
  createLearning, learningStep, learningResult, learningAnswer,
  learningPlace, learningCheck, learningNext, restoreLearning,
} from '../app/table-learning.js';

const forms = selectTableItems('relative', { cases: ['nom', 'acc'], numbers: ['sg'] });
const make = (items = forms, options = {}) => createLearning(items, { random: () => 0.999, ...options });
const snapshot = session => JSON.parse(JSON.stringify(session));
const fillMatch = (session, items) => items.forEach(item => learningPlace(session, item.id, item.id));
function toWrite(session, items) {
  learningNext(session, items);
  fillMatch(session, items);
  learningCheck(session, items);
  learningNext(session, items);
}
function fillWrite(session, items) {
  const byId = new Map(items.map(item => [item.id, item]));
  learningStep(session).blankIds.forEach(id => learningAnswer(session, id, byId.get(id).answer));
}

test('creation starts with all solutions and shuffles an independent order', () => {
  const original = forms.map(item => item.id);
  const session = make(forms, { random: () => 0 });
  assert.deepEqual(session.itemIds, original);
  assert.deepEqual(forms.map(item => item.id), original);
  assert.notDeepEqual(session.order, original);
  assert.deepEqual([...session.order].sort(), [...original].sort());
  assert.equal(session.version, 1);
  assert.equal(session.prefix, false);
  assert.equal(session.step, 0);
  assert.deepEqual(learningStep(session), { kind: 'study', label: 'Erst anschauen', blankIds: [], number: 1, total: 5 });
  assert.deepEqual(learningResult(session, forms), { correct: 0, total: 0, wrongIds: [], passed: true });
  assert.equal(learningAnswer(session, original[0], 'quī'), false);
  assert.equal(learningPlace(session, original[0], original[0]), false);
  assert.equal(learningCheck(session, forms), false);
});

test('a complete successful session follows study, matching, growing blanks and done', () => {
  const session = make();
  assert.equal(learningNext(session, forms), true);
  assert.equal(learningStep(session).kind, 'match');
  assert.equal(learningStep(session).number, 2);
  assert.deepEqual(learningStep(session).blankIds, session.order);
  assert.equal(learningNext(session, forms), false);
  fillMatch(session, forms);
  assert.deepEqual(learningResult(session, forms), { correct: 6, total: 6, wrongIds: [], passed: true });
  assert.equal(learningCheck(session, forms), true);
  assert.equal(learningNext(session, forms), true);
  let previous = [];
  for (const count of [3, 5, 6]) {
    const current = learningStep(session);
    assert.equal(current.kind, 'write');
    assert.equal(current.blankIds.length, count);
    assert.deepEqual(current.blankIds.slice(0, previous.length), previous);
    assert.equal(Object.keys(session.answers).length, 0);
    assert.equal(Object.keys(session.placements).length, 0);
    assert.equal(session.checked, false);
    fillWrite(session, forms);
    assert.equal(learningResult(session, forms).passed, true);
    assert.equal(learningCheck(session, forms), true);
    assert.equal(learningNext(session, forms), true);
    previous = current.blankIds;
  }
  assert.equal(learningStep(session).kind, 'done');
  assert.equal(learningStep(session).number, learningStep(session).total);
  assert.equal(learningNext(session, forms), false);
  assert.equal(learningCheck(session, forms), false);
  assert.equal(learningAnswer(session, forms[0].id, 'quī'), false);
  assert.equal(learningPlace(session, forms[0].id, forms[0].id), false);
});

test('small selections deduplicate writing rounds and empty selections are immediately done', () => {
  for (const [count, expected] of [[1, [1]], [2, [1, 2]], [3, [2, 3]], [4, [2, 3, 4]]]) {
    const items = forms.slice(0, count);
    const session = make(items);
    assert.equal(learningStep(session).total, expected.length + 2);
    toWrite(session, items);
    for (const blanks of expected) {
      assert.equal(learningStep(session).blankIds.length, blanks);
      fillWrite(session, items);
      learningCheck(session, items);
      learningNext(session, items);
    }
    assert.equal(learningStep(session).kind, 'done');
  }
  assert.deepEqual(learningStep(make([])), { kind: 'done', label: 'Geschafft!', blankIds: [], number: 0, total: 0 });
  assert.equal(learningNext(make([]), []), false);
});

test('identical answers can exchange tokens without being marked incorrect', () => {
  const items = selectTableItems('relative', { cases: ['dat'], numbers: ['sg'] });
  const session = make(items);
  learningNext(session, items);
  items.forEach((item, index) => learningPlace(session, item.id, items[(index + 1) % items.length].id));
  assert.deepEqual(learningResult(session, items), { correct: 3, total: 3, wrongIds: [], passed: true });
  learningCheck(session, items);
  assert.equal(learningNext(session, items), true);
  assert.equal(learningStep(session).kind, 'write');
});

test('tokens move, swap or return to the bank and cannot be placed twice', () => {
  const session = make();
  learningNext(session, forms);
  const [a, b, c] = forms.map(item => item.id);
  assert.equal(learningPlace(session, a, a), true);
  assert.equal(learningPlace(session, a, a), false);
  assert.equal(learningPlace(session, b, a), true);
  assert.equal(session.placements[a], undefined);
  assert.equal(session.placements[b], a);
  learningPlace(session, a, b);
  learningPlace(session, a, a);
  assert.equal(session.placements[a], a);
  assert.equal(session.placements[b], b);
  learningPlace(session, a, c);
  assert.equal(session.placements[a], c);
  assert.equal(Object.values(session.placements).includes(a), false);
  assert.equal(learningPlace(session, a, null), true);
  assert.equal(learningPlace(session, a, null), false);
  assert.equal(learningPlace(session, 'missing', b), false);
  assert.equal(learningPlace(session, a, 'missing'), false);
  assert.equal(new Set(Object.values(session.placements)).size, Object.keys(session.placements).length);
});

test('failed matching must show solutions and retry the same round', () => {
  const session = make();
  learningNext(session, forms);
  learningPlace(session, forms[0].id, forms[1].id);
  assert.equal(learningResult(session, forms).passed, false);
  assert.equal(learningCheck(session, forms), true);
  assert.equal(learningCheck(session, forms), false);
  assert.equal(learningPlace(session, forms[0].id, forms[0].id), false);
  const failedStep = session.step;
  assert.equal(learningNext(session, forms), true);
  assert.equal(session.reviewing, true);
  assert.equal(session.step, failedStep);
  assert.equal(learningPlace(session, forms[0].id, null), false);
  assert.equal(learningNext(session, forms), true);
  assert.equal(session.step, failedStep);
  assert.equal(session.reviewing, false);
  assert.equal(session.checked, false);
  assert.deepEqual(Object.keys(session.placements), []);
  assert.equal(learningNext(session, forms), false);
});

test('failed writing locks editing and retries exactly the same growing blank set', () => {
  const session = make();
  toWrite(session, forms);
  const blankIds = learningStep(session).blankIds;
  const visibleId = forms.find(item => !blankIds.includes(item.id)).id;
  assert.equal(learningAnswer(session, visibleId, 'quae'), false);
  assert.equal(learningAnswer(session, blankIds[0], 42), false);
  assert.equal(learningAnswer(session, blankIds[0], 'wrong'), true);
  assert.equal(learningAnswer(session, blankIds[0], 'wrong'), false);
  assert.equal(learningPlace(session, blankIds[0], blankIds[0]), false);
  assert.equal(learningResult(session, forms).wrongIds.length, blankIds.length);
  learningCheck(session, forms);
  assert.equal(learningAnswer(session, blankIds[0], 'quī'), false);
  learningNext(session, forms);
  assert.equal(session.reviewing, true);
  learningNext(session, forms);
  assert.deepEqual(learningStep(session).blankIds, blankIds);
  assert.deepEqual(Object.keys(session.answers), []);
});

test('writing uses canonical alternatives, optional macrons and prefix meanings', () => {
  const latin = selectTableItems('is', { cases: ['nom'], numbers: ['pl'], genders: ['m'] });
  const session = make(latin);
  toWrite(session, latin);
  learningAnswer(session, latin[0].id, 'EI');
  assert.equal(learningResult(session, latin).passed, true);
  learningAnswer(session, latin[0].id, 'ei / wrong');
  assert.equal(learningResult(session, latin).passed, false);
  const prefixes = PREFIXES.filter(item => item.id === 're');
  const prefixSession = make(prefixes, { prefix: true });
  toWrite(prefixSession, prefixes);
  learningAnswer(prefixSession, 're', 'ZURUECK-');
  assert.equal(learningResult(prefixSession, prefixes).passed, true);
  learningAnswer(prefixSession, 're', 'wieder / falsch');
  assert.equal(learningResult(prefixSession, prefixes).passed, false);
});

test('saving and restoring preserves an in-progress round and a failed review', () => {
  const session = make();
  toWrite(session, forms);
  const first = learningStep(session).blankIds[0];
  learningAnswer(session, first, 'quī');
  let restored = restoreLearning(snapshot(session), forms);
  assert.deepEqual(snapshot(restored), snapshot(session));
  assert.notEqual(restored, session);
  learningCheck(restored, forms);
  learningNext(restored, forms);
  restored = restoreLearning(snapshot(restored), forms);
  assert.equal(restored.reviewing, true);
  assert.equal(restored.checked, true);
  const step = restored.step;
  learningNext(restored, forms);
  assert.equal(restored.step, step);
  assert.equal(restored.checked, false);
  assert.deepEqual(Object.keys(restored.answers), []);
});

test('restore rejects foreign selections, versions and exercise modes', () => {
  const raw = snapshot(make());
  for (const invalid of [null, [], {}, { ...raw, version: 2 }, { ...raw, prefix: true }, { ...raw, itemIds: [forms[0].id] }, { ...raw, itemIds: raw.itemIds.map(() => forms[0].id) }, { ...raw, itemIds: [...raw.itemIds.slice(1), 'foreign'] }]) {
    assert.equal(restoreLearning(invalid, forms), null);
  }
  assert.equal(restoreLearning(raw, forms, { prefix: true }), null);
  assert.ok(restoreLearning(raw, [...forms].reverse()));
});

test('restore repairs corrupt order and index and removes duplicated or foreign tokens', () => {
  const raw = snapshot(make());
  const [a, b, c] = raw.itemIds;
  Object.assign(raw, {
    step: 1, order: ['foreign', c, c, a],
    placements: { [a]: a, [b]: a, [c]: 'foreign', foreign: b },
    answers: { [a]: 'forged' }, checked: 'true', reviewing: true,
  });
  const restored = restoreLearning(raw, forms);
  assert.deepEqual(restored.order, [c, a, ...raw.itemIds.filter(id => id !== c && id !== a)]);
  assert.deepEqual(Object.entries(restored.placements), [[a, a]]);
  assert.deepEqual(Object.keys(restored.answers), []);
  assert.equal(restored.checked, false);
  assert.equal(restored.reviewing, false);
  for (const step of [-1, NaN, Infinity, '2']) {
    assert.equal(restoreLearning({ ...raw, step }, forms).step, 0);
  }
  assert.equal(learningStep(restoreLearning({ ...raw, step: 999 }, forms)).kind, 'done');
  assert.equal(restoreLearning({ ...raw, step: 2.8 }, forms).step, 2);
});

test('restored answers are limited to actual blanks and 300 characters', () => {
  const session = make();
  toWrite(session, forms);
  const [first, second] = learningStep(session).blankIds;
  const visibleId = forms.find(item => !learningStep(session).blankIds.includes(item.id)).id;
  learningAnswer(session, first, 'a'.repeat(400));
  assert.equal(session.answers[first].length, 300);
  const raw = snapshot(session);
  raw.answers = { [first]: 'b'.repeat(700), [second]: 123, [visibleId]: 'forged', foreign: 'forged' };
  const restored = restoreLearning(raw, forms);
  assert.equal(restored.answers[first].length, 300);
  assert.deepEqual(Object.keys(restored.answers), [first]);
  raw.answers = [];
  assert.deepEqual(Object.keys(restoreLearning(raw, forms).answers), []);
});

test('canonical answers grade restored tokens and duplicate placement corruption never passes', () => {
  const items = selectTableItems('relative', { cases: ['dat'], numbers: ['sg'] });
  const session = make(items);
  learningNext(session, items);
  fillMatch(session, items);
  session.placements[items[1].id] = items[0].id;
  assert.equal(learningResult(session, items).passed, false);
  const raw = snapshot(session);
  raw.items = items.map(item => ({ ...item, answer: 'fake', accepted: ['fake'] }));
  const restored = restoreLearning(raw, items);
  assert.equal(Object.keys(restored.placements).length, 2);
  assert.equal(learningResult(restored, items).passed, false);
  assert.equal(learningResult(restored, []).correct, 0);
});

test('study and completed restores discard stale attempt state', () => {
  const session = make(forms.slice(0, 1));
  const raw = snapshot(session);
  raw.answers = { [session.itemIds[0]]: 'wrong' };
  raw.placements = { [session.itemIds[0]]: session.itemIds[0] };
  raw.checked = true;
  raw.reviewing = true;
  for (const step of [0, learningStep(session).total]) {
    const restored = restoreLearning({ ...raw, step }, forms.slice(0, 1));
    assert.equal(restored.checked, false);
    assert.equal(restored.reviewing, false);
    assert.deepEqual(Object.keys(restored.answers), []);
    assert.deepEqual(Object.keys(restored.placements), []);
  }
});
