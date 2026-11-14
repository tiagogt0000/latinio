import test from 'node:test';
import assert from 'node:assert/strict';
import {sentenceTiles, missingSentencePunctuation, stableShuffle, canMatchWords, landscapeUI} from '../app/landscape-ui.js';
import {swipeDecision} from '../app/landscape-motion.js';
import {buildRound, emptyLandscape, advanceRound} from '../app/landscape-engine.js';
import {evaluateSession} from '../app/core.js';
import {writePracticeView,writeAnswerInput} from '../app/write-practice.js';

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

const englishWord = {id:'english-word',collectionId:'one',latin:'to leave',meanings:[['verlassen'],['abfahren']],answerVariants:['to leave','leave']};
const englishData = {...data,words:{[englishWord.id]:englishWord}};
function singleTask(kind,extra={}) {
 const task={id:'task',kind,word:englishWord,...extra};
 return {id:'round',kind,label:'Lektion 1',phase:'task',tasks:[task],queue:[task.id],originalCount:1,completedTaskIds:[],draft:{},collectionIds:['one']};
}
test('English overview offers exam preparation and excludes Latin grammar',async()=>{
 const ui=landscapeUI({subject:'english',profile:{role:'admin'},model:modelFor(),getData:()=>englishData});
 await ui.readyPromise;
 const html=ui.view();assert.match(html,/Prüfung vorbereiten/);assert.doesNotMatch(html,/Endungen|Kasusfragen|lateinischen/);
 ui.destroy();
});
test('ordinary landscape writing uses the complete shared classic form in both directions',async()=>{
 for (const [subject,direction] of [['latin',undefined],['english','en-de'],['english','de-en']]) {
  const round=singleTask('write',{direction}),ui=landscapeUI({subject,profile:{role:'admin'},model:modelFor(round),getData:()=>englishData});
  await ui.readyPromise;
  const html=ui.view();
  assert.equal(ui.classicWriting,true);
  assert.match(html,/<main class="test-shell ls-classic-writing landscape-shell/);
  assert.ok(html.includes(writePracticeView({word:englishWord,subject,direction,actionPrefix:'landscape-'})));
  assert.equal((html.match(/name="answer"/g)||[]).length,1,'additional meanings use the same dynamic fields as classic');
  assert.match(html,/landscape-add-answer/);assert.match(html,/landscape-dont-know/);
  assert.doesNotMatch(html,/ls-writing-inputs|ls-word-card|ls-feedback/);
  ui.destroy();
 }
});
test('writing feedback retains classic per-field correction, translation card and unscored retry',async()=>{
 const round=singleTask('write',{direction:'en-de'});
 round.phase='feedback';round.feedback=evaluateSession(englishWord,['verlassen','Unsinn'],false,{},{});
 round.draft={answers:['verlassen','Unsinn'],correctionMode:true,correctionAnswers:['abfahren'],correctionResult:null};
 const ui=landscapeUI({subject:'english',profile:{role:'admin'},model:modelFor(round),getData:()=>englishData});await ui.readyPromise;
 const html=ui.view();
 assert.match(html,/class="graded-answer correct"/);assert.match(html,/<s>Unsinn<\/s>/);
 assert.match(html,/landscape-correct-evaluation/);assert.match(html,/translation-card/);
 assert.match(html,/Noch nicht ganz/);assert.match(html,/Noch einmal üben · ohne Wertung/);
 assert.match(html,/id="practice-answers"/);assert.match(html,/landscape-retry-submit/);
 ui.destroy();
});
test('shared write fields preserve foreign-language keyboard settings including French',()=>{
 for(const [subject,code,label] of [['english','en','Englisch'],['french','fr','Französisch']]){
  const field=writeAnswerInput('test',1,false,{subject,direction:'de-en'});
  assert.match(field,new RegExp(`Antwort auf ${label} 2`));assert.match(field,new RegExp(`lang="${code}"`));
  assert.match(field,/autocorrect="off" autocapitalize="none" spellcheck="false"/);
 }
 assert.match(writeAnswerInput('',0,false,{subject:'english',direction:'en-de'}),/lang="de".*autocorrect="on"/);
});
test('English cards, matching and quick prompts follow the concrete direction without changing quick form',async()=>{
 for(const kind of ['cards','matching','quick'])for(const direction of ['en-de','de-en']){
  const round=singleTask(kind,{direction,words:[englishWord]}),ui=landscapeUI({subject:'english',profile:{role:'admin'},model:modelFor(round),getData:()=>englishData});await ui.readyPromise;
  const html=ui.view();assert.equal(ui.classicWriting,false);assert.doesNotMatch(html,/LATEIN|>Latein</);
  if(kind==='cards')assert.ok(html.includes(direction==='de-en'?'<strong lang="de">verlassen · abfahren</strong>':'<strong lang="en">to leave</strong>'));
  if(kind==='matching')assert.match(html,direction==='de-en'?/<span>Deutsch<\/span><span>Englisch<\/span>/:/<span>Englisch<\/span><span>Deutsch<\/span>/);
  if(kind==='quick'){assert.match(html,/data-quick-card/);assert.equal((html.match(/data-field="answer"/g)||[]).length,1);assert.doesNotMatch(html,/id="answer-form"/);}
  ui.destroy();
 }
});
test('English sentence prompts stay German, tiles English and glue words have no word-help button',async()=>{
 const sentence={id:'sentence',prompt:'Wir verlassen das Haus.',latin:'Wir verlassen das Haus.',promptLanguage:'de',answerLanguage:'en',direction:'de-en',tokens:[{text:'Wir',wordId:null,kind:'glue'},{text:'verlassen',wordId:englishWord.id},{text:'das Haus',wordId:null,kind:'glue'}],translations:[['We','leave','the house']],distractors:['left']};
 const round=singleTask('sentence',{direction:'de-en',sentence}),ui=landscapeUI({subject:'english',profile:{role:'admin'},model:modelFor(round),getData:()=>englishData});await ui.readyPromise;
 const html=ui.view();assert.match(html,/ls-latin-sentence" lang="de"/);assert.match(html,/Deine englische Übersetzung/);
 assert.match(html,/aria-label="Englische Wortbausteine" lang="en"/);assert.equal((html.match(/data-action="landscape-word-help"/g)||[]).length,1);assert.match(html,/<span>Wir<\/span>/);
 ui.destroy();
});
