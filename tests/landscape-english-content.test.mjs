import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {getSentenceCatalogue,getCollectionSentences,readSentenceCatalogue,validateSentenceCatalogue,SENTENCE_CATALOGUE_PATHS} from '../server/landscape-content.mjs';
import {evaluateSentence} from '../app/landscape-engine.js';

const vocabulary=JSON.parse(readFileSync(new URL('../server/content/landscape-english-vocabulary.json',import.meta.url),'utf8'));
test('English and Latin catalogues are isolated and old calls still use unchanged Latin content',()=>{
  assert.equal(getSentenceCatalogue().total,1900);
  const english=getSentenceCatalogue(null,'english');
  assert.equal(english.subject,'english');assert.equal(english.collections.length,8);assert.equal(english.total,193);
  assert.equal(getSentenceCatalogue(null,'latin').total,1900);
  const englishId=english.collections[0].id,latinId=getSentenceCatalogue().collections[0].id;
  assert.equal(getCollectionSentences(englishId,'english').length,24);
  assert.deepEqual(getCollectionSentences(englishId),[]);
  assert.deepEqual(getCollectionSentences(latinId,'english'),[]);
  assert.throws(()=>readSentenceCatalogue('french'),RangeError);
  assert.throws(()=>getSentenceCatalogue(null,'__proto__'),RangeError);
  const sha=createHash('sha256').update(readFileSync(SENTENCE_CATALOGUE_PATHS.latin)).digest('hex');
  assert.equal(sha,'66fcc1cfeb3f990b5ac8cd06c95afe019f3a2ed6a24ffc98952745e69b139eec');
});
test('current English collections have modest complete application coverage and no account state',()=>{
  assert.equal(Object.keys(vocabulary.words).length,189);
  assert.deepEqual(Object.keys(vocabulary).sort(),['collections','words']);
  for(const c of Object.values(vocabulary.collections))assert.deepEqual(Object.keys(c).sort(),['id','name']);
  for(const w of Object.values(vocabulary.words))assert.deepEqual(Object.keys(w).sort(),['collectionId','id','latin','meanings']);
  const catalogue=readSentenceCatalogue('english');
  const result=validateSentenceCatalogue(catalogue,vocabulary,{subject:'english',minimumPerCollection:20});
  assert.equal(result.ok,true,result.errors.join('\n'));assert.deepEqual(result.warnings,[]);
  assert.equal(result.stats.collections.reduce((sum,c)=>sum+c.coveredWords,0),189);
  assert.ok(result.stats.collections.every(c=>c.count>=20&&c.count<=30));
  for(const s of catalogue.sentences){
    assert.equal(s.direction,'de-en');assert.equal(s.usage,'occasional-application');
    assert.equal(s.prompt,s.latin);assert.equal(s.promptLanguage,'de');assert.equal(s.answerLanguage,'en');
    assert.match(s.prompt,/^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]+$/u);
    for(const t of s.tokens)if(t.wordId===null)assert.equal(t.kind,'glue');else assert.ok(vocabulary.words[t.wordId]);
  }
});
test('every accepted English tile order works and distractor substitutions do not',()=>{
  for(const sentence of readSentenceCatalogue('english').sentences){
    for(const answer of sentence.translations)assert.equal(evaluateSentence(sentence,answer).correct,true,sentence.id);
    for(const distractor of sentence.distractors){
      for(let index=0;index<sentence.translations[0].length;index++){
        const answer=[...sentence.translations[0]];answer[index]=distractor;
        assert.equal(evaluateSentence(sentence,answer).correct,false,sentence.id+' accepted '+distractor);
      }
    }
  }
});
test('English validation rejects subject leaks and wrong hint/direction metadata',()=>{
  const catalogue=readSentenceCatalogue('english');catalogue.sentences=catalogue.sentences.slice(0,1);
  const first=catalogue.sentences[0];
  first.tokens.find(t=>t.wordId===null).wordId='foreign-word-id';
  first.direction='la-de';first.promptLanguage='la';
  const result=validateSentenceCatalogue(catalogue,vocabulary,{subject:'english'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(e=>e.includes('Vokabel-ID')));
  assert.ok(result.errors.some(e=>e.includes('Satzrichtung')));
  assert.equal(validateSentenceCatalogue(readSentenceCatalogue('english'),vocabulary).ok,false);
});
test('a future English upload reports missing sentence content without Latin fallback',()=>{
  assert.deepEqual(getSentenceCatalogue([{id:'new-english-import',name:'Neue Sammlung'}],'english').collections,[
    {id:'new-english-import',name:'Neue Sammlung',count:0,status:'missing'},
  ]);
  assert.deepEqual(getCollectionSentences('new-english-import','english'),[]);
  const a=readSentenceCatalogue('english');a.sentences[0].prompt='edited copy';
  assert.notEqual(readSentenceCatalogue('english').sentences[0].prompt,'edited copy');
});
