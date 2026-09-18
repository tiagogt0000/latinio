import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupWords,classroomResults} from '../app/classroom.js';
const data={collections:{c:{name:'Lektion 1'}},words:{a:{id:'a',collectionId:'c',latin:'vox, vōcis',meanings:[['Stimme'],['Laut']]},b:{id:'b',collectionId:'c',latin:'laudare',meanings:[['loben']]},c:{id:'c',collectionId:'deleted',latin:'vox',meanings:[['veraltet']]}}};
test('Classroom lookup finds stored Latin forms and German meanings, ignoring punctuation and macrons',()=>{
 for(const query of ['VOCIS!','vox','Stimme'])assert.equal(lookupWords(data,query)[0].id,'a');
 assert.equal(lookupWords(data,'loben')[0].id,'b');assert.equal(lookupWords(data,'vo').length,1);
 assert.equal(lookupWords(data,'').length,0);assert.equal(lookupWords(data,'unbekannt').length,0);
});
test('Lookup does not change vocabulary or learning history and displays escaped results',()=>{
 const before=JSON.stringify(data);const escape=s=>String(s).replace(/</g,'&lt;');
 const result=classroomResults(data,'vocis',escape);assert.match(result,/Stimme, Laut/);assert.equal(JSON.stringify(data),before);
 const x=structuredClone(data);x.words.a.latin='<img>vox';assert.ok(!classroomResults(x,'vox',escape).includes('<img>'));
});
