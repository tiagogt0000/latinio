import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BOOK_CASES,DECLENSION_GROUPS,CASE_QUESTIONS,endingCells,checkEnding} from '../app/landscape-curriculum.js';
import {readSentenceCatalogue,getSentenceCatalogue,getCollectionSentences,validateSentenceCatalogue} from '../server/landscape-content.mjs';

const vocabulary=JSON.parse(readFileSync(new URL('../server/content/landscape-vocabulary.json',import.meta.url),'utf8'));
test('book endings preserve four rows, two numbers and the exceptional nominative',()=>{
  assert.deepEqual(BOOK_CASES.map(c=>c.id),['nom','acc','gen','dat','abl']);
  assert.equal(BOOK_CASES.find(c=>c.id==='abl').ordinal,6);
  assert.equal(DECLENSION_GROUPS.length,4);
  assert.deepEqual(endingCells('gen').map(c=>c.answer),['-ae','-ārum','-ī','-ōrum','-ī','-ōrum','-is','-um']);
  assert.deepEqual(endingCells('dat').map(c=>c.answer),['-ae','-īs','-ō','-īs','-ō','-īs','-ī','-ibus']);
  assert.deepEqual(endingCells('acc').map(c=>c.answer),['-am','-ās','-um','-ōs','-um','-a','-em','-ēs']);
  assert.deepEqual(endingCells('abl').map(c=>c.answer),['-ā','-īs','-ō','-īs','-ō','-īs','-e','-ibus']);
  const nom=endingCells('nom');assert.equal(nom.filter(c=>c.editable).length,7);
  assert.equal(nom[6].answer,'Grundform – keine feste Endung');assert.equal(nom[6].editable,false);
  assert.equal(checkEnding('or',nom[6]),false);assert.deepEqual(endingCells('voc'),[]);
  assert.equal(CASE_QUESTIONS.abl,'Womit? · Wodurch? · Woher?');
});
test('ending input accepts the book macron and optional hyphen without fuzzy suffix matching',()=>{
  const cell=endingCells('gen')[1];
  for(const value of ['-ārum','ārum','arum',' -arum '])assert.equal(checkEnding(value,cell),true,value);
  for(const value of ['orum','arumx','ā','árum','',null])assert.equal(checkEnding(value,cell),false,String(value));
});
test('all current canonical lessons have a real vocabulary-linked sentence reserve',()=>{
  const c=readSentenceCatalogue(),result=validateSentenceCatalogue(c,vocabulary,{minimumPerCollection:100});
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.equal(result.stats.collections.length,19);assert.equal(result.stats.total,1900);
  const lesson=id=>Number(vocabulary.collections[id].name.match(/\d+$/)?.[0]);
  for(const sentence of c.sentences){
    for(const token of sentence.tokens)assert.ok(lesson(vocabulary.words[token.wordId].collectionId)<=lesson(sentence.collectionId),sentence.id+' uses future vocabulary');
  }
});
test('catalogue reports missing new collections without blocking their vocabulary',()=>{
  const report=getSentenceCatalogue([{id:'future-import',name:'Neue Lektion'}]);
  assert.deepEqual(report.collections,[{id:'future-import',name:'Neue Lektion',count:0,status:'missing'}]);
  assert.deepEqual(getCollectionSentences('future-import'),[]);
  const current=getSentenceCatalogue().collections[0];
  const sentences=getCollectionSentences(current.id);assert.equal(sentences.length,100);
  sentences[0].latin='mutated';assert.notEqual(getCollectionSentences(current.id)[0].latin,'mutated');
});
test('content validation rejects false focus mappings and impossible tile alternatives',()=>{
  const catalogue=readSentenceCatalogue(),first=catalogue.sentences[0];
  const single={...catalogue,sentences:[structuredClone(first)]};
  single.sentences[0].tokens[0].wordId='missing-word';
  single.sentences[0].translations.push(['a completely different solution','unknown']);
  single.sentences[0].focusWordIds.push('foreign-word');
  const result=validateSentenceCatalogue(single,vocabulary);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(e=>e.includes('Vokabel-ID')));
  assert.ok(result.errors.some(e=>e.includes('andere Bausteine')));
  assert.ok(result.errors.some(e=>e.includes('Schwerpunktzuordnung')));
  assert.equal(validateSentenceCatalogue({schema:1,collections:[],sentences:[null]},vocabulary).ok,false);
});
test('reviewed linguistic regressions and ordinary German object fronting remain correct',()=>{
  const sentences=readSentenceCatalogue().sentences;
  for(const sentence of sentences){
    for(const answer of sentence.translations){
      if(/\b(adfuit|desperavit)\b/.test(sentence.latin))assert.ok(answer.includes('ist'),sentence.latin);
      if(/\bconstitit\b/.test(sentence.latin))assert.ok(answer.includes('hat'),sentence.latin);
      assert.ok(!/\bin (der Mauer|dem Forum)\b/.test(answer.join(' ')),sentence.latin);
    }
    if(sentence.latin.startsWith('Ubi frater'))assert.ok(sentence.latin.includes('venit,')&&sentence.latin.endsWith('.'),sentence.latin);
    if(sentence.sourceFrame==='coordinated')assert.ok(!/\b(Ubi|ubi|Ave|ave|Salve|salve|Quis|quis)\b/.test(sentence.latin),sentence.latin);
    assert.ok(!/\b(Bestia|Sinistra|Copia) (ferus|magnus|pulcher|novus) est\b/.test(sentence.latin),sentence.latin);
  }
  const dative=sentences.find(s=>s.latin==='Domina servam laborare iubet.');
  assert.ok(dative?.translations.some(a=>a.join('|')==='der Sklavin|befiehlt|die Herrin|zu arbeiten'));
  const possessive=sentences.find(s=>s.latin==='Pater filium suum laudat.');
  assert.ok(possessive?.translations.some(a=>a.join('|')==='seinen Sohn|lobt|der Vater'));
});
