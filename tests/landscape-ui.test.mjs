import test from 'node:test';
import assert from 'node:assert/strict';
import {sentenceTiles, missingSentencePunctuation, stableShuffle, canMatchWords, landscapeUI} from '../app/landscape-ui.js';
import {swipeDecision} from '../app/landscape-motion.js';
import {buildRound, emptyLandscape, advanceRound} from '../app/landscape-engine.js';

const data = {
  collections: {one: {id: 'one', name: 'Lektion 1'}},
  words: {a: {id: 'a', collectionId: 'one', latin: 'dominus', meanings: [['Herr']]}, b: {id: 'b', collectionId: 'one', latin: 'domina', meanings: [['Herrin']]}},
  reviews: {}, settings: {},
};
function modelFor(round = null) {
  const state = {...emptyLandscape(), rounds: round ? {[round.id]: round} : {}, activeRoundId: round?.id || null};
  return {state, get activeRound() { return state.rounds[state.activeRoundId] || null; }, load: async () => {}, recommendations: () => [{kind: 'write', collectionId: 'one', label: 'Lektion 1', estimatedCount: 2}], addEventListener() {}, removeEventListener() {}, destroy() {}};
}

test('sentence tiles provide every valid translation, including duplicate words and alternate wording', () => {
  const sentence = {id: 'duplicate', translations: [['der', 'Herr', 'und', 'der', 'Senator'], ['der', 'Senator', 'und', 'der', 'Herr'], ['ein', 'Herr', 'und', 'ein', 'Senator']], distractors: ['die', 'der']};
  const tiles = sentenceTiles(sentence);
  assert.equal(new Set(tiles.map(tile => tile.id)).size, tiles.length);
  assert.equal(tiles.filter(tile => tile.text === 'der').length, 2);
  assert.equal(tiles.filter(tile => tile.text === 'ein').length, 2);
  for (const translation of sentence.translations) {
    const remaining = [...tiles];
    for (const token of translation) { const index = remaining.findIndex(tile => tile.text === token); assert.ok(index >= 0, `missing ${token}`); remaining.splice(index, 1); }
  }
  assert.deepEqual(sentenceTiles(sentence), tiles, 'rerendering must not shuffle the tile identities');
});

test('shuffle preserves its input and is stable for a saved task', () => {
  const source = ['a', 'b', 'c', 'd', 'e'];
  const first = stableShuffle(source, 'round-1');
  assert.deepEqual(source, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(stableShuffle(source, 'round-1'), first);
  assert.deepEqual([...first].sort(), source);
});

test('sentence rendering retains terminal punctuation without duplicating token punctuation', () => {
  assert.equal(missingSentencePunctuation({latin: 'Ubi est dominus?', tokens: [{text: 'Ubi'}, {text: 'est'}, {text: 'dominus'}]}), '?');
  assert.equal(missingSentencePunctuation({latin: 'Ubi est dominus?', tokens: [{text: 'Ubi'}, {text: 'est'}, {text: 'dominus?'}]}), '');
  assert.equal(missingSentencePunctuation({latin: 'Dominus venit.', tokens: [{text: 'Dominus'}, {text: 'venit'}]}), '.');
  assert.equal(missingSentencePunctuation({latin: 'Dominus venit.'}), '');
});

test('a card cannot be marked known before it is revealed or during vertical scrolling', () => {
  assert.equal(swipeDecision({dx: 200, dy: 0, velocity: 1, revealed: false}), 0);
  assert.equal(swipeDecision({dx: 85, dy: 160, velocity: 1, revealed: true}), 0);
  assert.equal(swipeDecision({dx: 20, dy: 0, velocity: 2, revealed: true}), 0);
});

test('revealed cards settle on short drags and commit clear directional gestures', () => {
  assert.equal(swipeDecision({dx: 40, dy: 2, velocity: .1, width: 320, revealed: true}), 0);
  assert.equal(swipeDecision({dx: 110, dy: 2, width: 320, revealed: true}), 1);
  assert.equal(swipeDecision({dx: -110, dy: 2, width: 320, revealed: true}), -1);
  assert.equal(swipeDecision({dx: 40, dy: 2, velocity: .8, width: 320, revealed: true}), 1);
  assert.equal(swipeDecision({dx: 40, dy: 2, velocity: -.8, width: 320, revealed: true}), 0, 'reversing direction should settle instead of fling');
});

test('matching treats a valid shared meaning as a valid pair', () => {
  assert.equal(canMatchWords({id: 'one', meanings: [['Gefährte', 'Begleiter']]}, {id: 'two', meanings: [['Begleiter']]}), true);
  assert.equal(canMatchWords({id: 'one', meanings: [['Gefährte']]}, {id: 'two', meanings: [['Herrin']]}), false);
  assert.equal(canMatchWords({id: 'same', meanings: [['(zurück)bleiben']]}, {id: 'same', meanings: [['(zurück)bleiben']]}), true);
});

test('landscape overview labels collection once and exposes the exercise type', async () => {
  const ui = landscapeUI({profile: {id: 'admin', role: 'admin'}, model: modelFor(), getData: () => data});
  await ui.readyPromise;
  const html = ui.view();
  assert.match(html, /<strong>Lektion 1<\/strong><span>Schreiben<\/span>/);
  assert.match(html, /Endungen sicher lernen/);
  assert.doesNotMatch(html, /Die Endungen sitzen/);
  ui.destroy();
});

test('noun study renders two number columns and a non-editable third-declension nominative', async () => {
  const round = buildRound({data, state: emptyLandscape(), kind: 'grammar', caseId: 'nom', roundId: 'grammar-test'});
  const model = modelFor(round), ui = landscapeUI({profile: {id: 'admin', role: 'admin'}, model, getData: () => data});
  await ui.readyPromise;
  const study = ui.view();
  assert.match(study, /role="columnheader">Singular/);
  assert.match(study, /role="columnheader">Plural/);
  assert.equal((study.match(/class="ls-ending-row"/g) || []).length, 4);
  assert.match(study, /Grundform/);
  assert.doesNotMatch(study, /name="ending-nom-third-sg"/);
  model.state.rounds[round.id] = advanceRound(round);
  assert.equal((ui.view().match(/data-field="ending"/g) || []).length, 2);
  ui.destroy();
});

test('all paused rounds remain discoverable when another round was started', async () => {
  const first = buildRound({data, kind: 'cards', collectionId: 'one', roundId: 'old'}); first.paused = true;
  const second = buildRound({data, kind: 'write', collectionId: 'one', roundId: 'new'}); second.paused = true;
  const model = modelFor(second); model.state.rounds[first.id] = first;
  const ui = landscapeUI({profile: {id: 'admin', role: 'admin'}, model, getData: () => data}); await ui.readyPromise;
  assert.equal((ui.view().match(/<strong>Hier geht es weiter<\/strong>/g) || []).length, 2);
  ui.destroy();
});
