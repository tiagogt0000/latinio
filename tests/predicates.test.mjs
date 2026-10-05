import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePredicateFile,mergePredicateFiles,readPredicateStore,writePredicateStore,predicateMatches,shufflePredicates,predicateStorageKey} from '../app/predicates.js';

const input={format:'latinio-predicates',schema:1,name:'Prädikate',predicates:[{grundform:'amare',praedikat:'amo, amare, amavi, amatum'},{grundform:'monere',praedikat:['moneo, monere, monui, monitum']}]};

test('predicate JSON is validated and normalized without entering vocabulary structures',()=>{
 const parsed=parsePredicateFile(input);assert.equal(parsed.items.length,2);assert.deepEqual(parsed.items[0],{grundform:'amare',praedikate:['amo, amare, amavi, amatum']});
 assert.throws(()=>parsePredicateFile({...input,predicates:[{grundform:'',praedikat:''}]}),/Grundform und Prädikat/);
 assert.throws(()=>parsePredicateFile({...input,format:'latinio-collection'}),/Prädikatdatei/);
});

test('import merges by normalized base form and updates an existing predicate',()=>{
 const old=[{grundform:'AMARE',praedikate:['old']}];const merged=mergePredicateFiles(old,parsePredicateFile({...input,predicates:[{grundform:'amare',praedikat:'amo'},{grundform:'monere',praedikat:'moneo'}]}));
 assert.equal(merged.length,2);assert.deepEqual(merged[0].praedikate,['amo']);
});

test('predicate list persists in a profile-scoped local store only',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};const key=predicateStorageKey('student-a');
 writePredicateStore(storage,[{grundform:'amare',praedikate:['amo']}],key);
 assert.equal(readPredicateStore(storage,key).length,1);assert.deepEqual(readPredicateStore(storage,predicateStorageKey('student-b')),[]);
});

test('answers ignore case, diacritics and trailing sentence punctuation; rounds can shuffle',()=>{
 assert.equal(predicateMatches(['amāre'],'AMARE.'),true);assert.equal(predicateMatches(['amare'],'amo'),false);
 const shuffled=shufflePredicates([{id:1},{id:2},{id:3}],()=>0);assert.deepEqual(shuffled.map(x=>x.id),[2,3,1]);
});

test('the predicate trainer is shown only in the Latin home page and uses a separate screen',()=>{
 const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 assert.match(source,/\$\{!english\?predicatePracticeCard\(\):''\}/);assert.match(source,/predicate-test/);assert.doesNotMatch(source,/predicateItems\.map\([^\n]*wordRows/);
});
