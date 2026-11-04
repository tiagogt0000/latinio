import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES,NUMBERS,GENDERS,PERSONS,TARGETS,TABLES,PREFIXES,selectTableItems,checkAnswer} from '../app/table-content.js';
const item=id=>TABLES.flatMap(table=>table.items).find(entry=>entry.id===id);
const prefix=id=>PREFIXES.find(entry=>entry.id===id);
test('Photograph corpus contains 110 case cells, nine perfect targets and eleven prefixes',()=>{
 assert.deepEqual(TABLES.map(table=>[table.id,table.items.length]),[['adjectives',30],['personal',20],['relative',30],['is',30],['perfect',9]]);
 assert.equal(PREFIXES.length,11);assert.equal(TARGETS.length,3);assert.deepEqual(CASES.map(entry=>entry.id),['nom','gen','dat','acc','abl']);
 const entries=[...TABLES.flatMap(table=>table.items),...PREFIXES];assert.equal(new Set(entries.map(entry=>entry.id)).size,entries.length);assert.ok(entries.every(entry=>entry.prompt&&entry.answer&&entry.accepted.length));
});
test('Every displayed solution and each documented alternative passes',()=>{
 for(const table of TABLES)for(const entry of table.items)for(const answer of [entry.answer,...entry.accepted])assert.equal(checkAnswer(answer,entry),true,entry.id+': '+answer);
 for(const entry of PREFIXES)for(const answer of [entry.answer,...entry.accepted])assert.equal(checkAnswer(answer,entry,{prefix:true}),true,entry.id+': '+answer);
});
test('Every grammatical combination exists once and arbitrary case filters work',()=>{
 for(const table of TABLES.filter(entry=>entry.id!=='perfect')){
  const dimension=table.id==='personal'?'persons':'genders',choices=table.id==='personal'?PERSONS:GENDERS;
  for(const grammaticalCase of CASES)for(const number of NUMBERS)for(const choice of choices)assert.equal(selectTableItems(table.id,{cases:[grammaticalCase.id],numbers:[number.id],[dimension]:[choice.id]}).length,1);
 }
 assert.equal(selectTableItems('adjectives',{cases:['nom','acc']}).length,12);
 assert.deepEqual(selectTableItems('relative',{cases:['nom','acc'],numbers:['sg'],genders:['f']}).map(entry=>entry.answer),['quae','quam']);
 assert.deepEqual(selectTableItems('personal',{cases:['dat','abl'],numbers:['pl'],persons:['2']}).map(entry=>entry.answer),['vōbīs','ā vōbīs / vōbīscum']);
});
test('Empty or invalid active filters cannot silently broaden a round',()=>{
 assert.equal(selectTableItems('adjectives').length,30);assert.equal(selectTableItems('adjectives',null).length,30);
 for(const [id,filters] of [['missing',{}],['adjectives',{cases:[]}],['personal',{persons:[]}],['is',{genders:[]}],['perfect',{targets:[]}],['is',{numbers:['dual']}],['is',{cases:'nom'}]])assert.deepEqual(selectTableItems(id,filters),[]);
 assert.equal(selectTableItems('personal',{genders:[]}).length,20);assert.equal(selectTableItems('perfect',{cases:[]}).length,9);
 const filters={cases:['acc','nom'],genders:['n']},before=JSON.stringify(filters);selectTableItems('adjectives',filters).pop();assert.equal(TABLES[0].items.length,30);assert.equal(JSON.stringify(filters),before);
});
test('Gender, case and number remain meaningful despite optional macrons and hyphens',()=>{
 assert.equal(item('adjectives-gen-pl-f').answer,'magnārum');assert.equal(item('adjectives-acc-pl-n').answer,'magna');
 assert.equal(checkAnswer('magnorum',item('adjectives-gen-pl-f')),false);assert.equal(checkAnswer('magnae',item('adjectives-acc-pl-n')),false);assert.equal(checkAnswer('us',item('adjectives-nom-sg-m')),false);
 for(const answer of ['magnarum','MAGNĀRUM','  magn-ārum  ','magn–arum','magna\u0304rum'])assert.equal(checkAnswer(answer,item('adjectives-gen-pl-f')),true,answer);
 assert.equal(item('relative-nom-pl-n').answer,'quae');assert.equal(item('relative-acc-pl-n').answer,'quae');assert.equal(item('relative-gen-sg-f').answer,'cuius');assert.equal(item('relative-abl-sg-f').answer,'quā');
 assert.equal(checkAnswer('qua',item('relative-acc-pl-n')),false);assert.equal(checkAnswer('quorum',item('relative-gen-pl-f')),false);
});
test('is accepts both variants individually or combined, but rejects wrong additions',()=>{
 for(const answer of ['ii','ei','iī / eī','ei, ii','ii;ei','ii oder ei'])assert.equal(checkAnswer(answer,item('is-nom-pl-m')),true,answer);
 for(const grammaticalCase of ['dat','abl'])for(const gender of ['m','f','n']){
  const entry=item(`is-${grammaticalCase}-pl-${gender}`);for(const answer of ['iis','eis','eis / iis'])assert.equal(checkAnswer(answer,entry),true);assert.equal(checkAnswer('is',entry),false);
 }
 assert.equal(checkAnswer('i',item('is-nom-pl-m')),false);assert.equal(checkAnswer('ii / eae',item('is-nom-pl-m')),false);
});
test('Personal ablatives allow phrases and bare forms; genitive alternatives are accepted',()=>{
 for(const [id,answers,wrong] of [
  ['personal-abl-sg-1',['a me','mecum','me','a me / mecum','mecum, a me'],'a te'],
  ['personal-abl-sg-2',['a te','tecum','te'],'mecum'],
  ['personal-abl-pl-1',['a nobis','nobiscum','nobis'],'a vobis'],
  ['personal-abl-pl-2',['a vobis','vobiscum','vobis'],'nobis']
 ]){for(const answer of answers)assert.equal(checkAnswer(answer,item(id)),true,id+': '+answer);assert.equal(checkAnswer(wrong,item(id)),false,id);}
 assert.equal(checkAnswer('nostrum',item('personal-gen-pl-1')),true);assert.equal(checkAnswer('vestrum',item('personal-gen-pl-2')),true);assert.equal(checkAnswer('nostrum',item('personal-gen-pl-2')),false);
});
test('Perfect filters select all three verbs and distinguish stems from forms',()=>{
 assert.deepEqual(selectTableItems('perfect',{targets:['presentStem']}).map(entry=>entry.answer),['vide-','veni-','capi-']);
 assert.deepEqual(selectTableItems('perfect',{targets:['perfectStem']}).map(entry=>entry.answer),['vīd-','vēn-','cēp-']);
 assert.deepEqual(selectTableItems('perfect',{targets:['perfectFirst']}).map(entry=>entry.answer),['vīd-ī','vēn-ī','cēp-ī']);
 assert.equal(selectTableItems('perfect',{targets:['perfectStem','perfectFirst']}).length,6);
 assert.equal(checkAnswer('cepi',item('perfect-capere-perfectFirst')),true);assert.equal(checkAnswer('capi',item('perfect-capere-perfectFirst')),false);assert.equal(checkAnswer('veni',item('perfect-venire-perfectFirst')),true);assert.equal(checkAnswer('vide',item('perfect-videre-perfectStem')),false);
});
test('Prefixes accept one meaning and punctuation but reject unknown meanings',()=>{
 for(const answer of ['weg','ab','WEG-','weg-, ab-','ab / weg','ab; weg','weg und ab'])assert.equal(checkAnswer(answer,prefix('ab'),{prefix:true}),true,answer);
 assert.equal(checkAnswer('weg / vor',prefix('ab'),{prefix:true}),false);
 for(const answer of ['durch','hindurch','(hin)durch','(hin)durch-'])assert.equal(checkAnswer(answer,prefix('per'),{prefix:true}),true);
 for(const answer of ['zurück','zurueck','ZURÜCK-','wieder / zurueck','zuru\u0308ck'])assert.equal(checkAnswer(answer,prefix('re'),{prefix:true}),true);
 assert.equal(checkAnswer('wider',prefix('re'),{prefix:true}),false);assert.equal(checkAnswer('hin',prefix('per'),{prefix:true}),false);assert.equal(checkAnswer('zusammen',prefix('circum'),{prefix:true}),false);
});
test('Blanks, empty alternatives and mixed guesses are rejected',()=>{
 for(const answer of ['', '   ','-','/',',;',null,undefined,4,{},'ii / falsch','falsch, ei','ii;','ii//ei'])assert.equal(checkAnswer(answer,item('is-nom-pl-m')),false,String(answer));
 assert.equal(checkAnswer('ii',null),false);assert.equal(checkAnswer('ii',{accepted:[]}),false);assert.equal(checkAnswer('ii',{answer:'ii'}),true);
});
