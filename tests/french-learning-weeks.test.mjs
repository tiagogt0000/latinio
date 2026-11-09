import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyData,applyOps,parseImport,evaluateSession,progressFor} from '../app/core.js';
import {englishImport,englishTasks,answerWord,promptFor} from '../app/english.js';
import {translationCard} from '../app/feedback.js';
import {planCollectionImport} from '../server/import-collections.mjs';
import {harness} from './google-harness.mjs';
const folder=new URL('../data/french-2026/',import.meta.url);
const collections=fs.readdirSync(folder).filter(file=>file.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(new URL(file,folder),'utf8')));
const all=collections.flatMap(collection=>collection.words),find=word=>all.find(entry=>entry.latin===word);

test('Learning weeks contain 231 unique entries in eleven explicitly assigned collections and no repeat-only weeks',()=>{
 assert.equal(collections.length,11);assert.equal(all.length,231);
 assert.deepEqual(collections.map(c=>c.name).sort(),['Lernwoche 1','Lernwoche 1 bis 4','Lernwoche 3','Lernwoche 5','Lernwoche 6','Lernwoche 7','Lernwoche 9','Lernwoche 10','Lernwoche 11','Lernwoche 12','Lernwoche 13'].sort());
 assert.equal(new Set(all.map(word=>word.latin)).size,231);assert.equal(new Set(all.map(word=>word.id)).size,231);
 for(const input of collections){const parsed=parseImport(input,emptyData());assert.equal(parsed.words.length,input.words.length);assert.equal(parsed.skipped,0);for(let i=0;i<input.words.length;i++)assert.deepEqual(parsed.words[i].answerVariants,input.words[i].answerVariants);}
 for(const phrase of ['participer en cours','poser une question (à qn)','réviser (qc)','mettre la pression à qn','une excuse'])assert.equal(collections.find(c=>c.words.some(w=>w.latin===phrase)).name,'Lernwoche 1');
});

test('French imports and both practice directions reuse the English trainer with independent progress',()=>{
 const imported=parseImport(englishImport({format:'latinio-collection',schema:1,name:'Test',words:[{french:'la planète',german:'der Planet'}]},'french'),emptyData());
 assert.equal(imported.words[0].latin,'la planète');
 const plan=planCollectionImport(emptyData(),collections),d=applyOps(emptyData(),plan.changes.map(([entity,key,value])=>({entity,key,value})));
 const word=find('la planète'),ids=[d.words[word.id].collectionId];
 assert.equal(englishTasks(d,ids,'all').length,Object.values(d.words).filter(w=>ids.includes(w.collectionId)).length*2);
 for(let i=0;i<4;i++)d.reviews['r'+i]={id:'r'+i,wordId:word.id,direction:'en-de',grade:'full',at:100+i};
 assert.equal(progressFor(word.id,d.reviews,'en-de').level,'known');assert.equal(progressFor(word.id,d.reviews,'de-en').level,'new');
 assert.equal(promptFor(word,'en-de'),'la planète');assert.match(promptFor(word,'de-en'),/Planet/);
 assert.match(translationCard(answerWord(word,'de-en'),{grade:'full'},'fr'),/Französische Übersetzung/);
});

test('Dictionary gender and inflected alternatives are valid individual answers, without weakening French spelling',()=>{
 for(const [entry,answers] of [['le médiateur / la médiatrice',['le médiateur','la médiatrice']],['seul/seule',['seul','seule']],['un/une intello (fam.)',['un intello','une intello']],['normal/normale/normaux/normales',['normal','normale','normaux','normales']],['vieux/vieil/vieille/vieux/vieilles',['vieux','vieil','vieille','vieilles']],['le carton (jaune/rouge)',['le carton','le carton jaune','le carton rouge']]]){
  for(const answer of answers)assert.equal(evaluateSession(answerWord(find(entry),'de-en'),[answer],false).grade,'full',entry+' / '+answer);
 }
 assert.equal(evaluateSession(answerWord(find('la planète'),'de-en'),['la planete'],false).grade,'wrong');
 for(const answer of ['Vermittler','Vermittlerin','der Vermittler','die Vermittlerin'])assert.equal(evaluateSession(find('le médiateur / la médiatrice'),[answer],false).grade,'full');
 assert.equal(evaluateSession(find('demander si'),['fragen, ob'],false).grade,'full');
 assert.equal(evaluateSession(find('voir qn/qc'),['jemanden sehen'],false).grade,'full');
});

test('A repeated import adds nothing, preserves unrelated words and reviews, and stops on edited ID collisions',()=>{
 const data=emptyData();data.words.other={id:'other',collectionId:'old',latin:'bonjour',meanings:[['hallo']]};data.reviews.review={id:'review',wordId:'other',grade:'full'};
 const before=structuredClone(data),plan=planCollectionImport(data,collections);
 assert.deepEqual(data,before);assert.equal(plan.changes.length,242);
 const imported=applyOps(data,plan.changes.map(([entity,key,value])=>({entity,key,value})));
 assert.deepEqual(planCollectionImport(imported,collections).changes,[]);assert.deepEqual(imported.reviews,before.reviews);assert.deepEqual(imported.words.other,before.words.other);
 imported.words[all[0].id].latin='An edited entry';assert.throws(()=>planCollectionImport(imported,collections),/wurde geändert/);
 const duplicate=emptyData();duplicate.words.planet={...find('la planète'),id:'planet',collectionId:'old'};
 const withDuplicate=planCollectionImport(duplicate,collections);assert.equal(withDuplicate.skipped.filter(s=>s.reason==='existing-word').length,1);assert.equal(withDuplicate.changes.filter(c=>c[0]==='words').length,230);
});

test('The authenticated French import shares answer alternatives without changing Latin, English or personal progress',()=>{
 const h=harness();h.ctx.AUTOMATIC_SHARING_ENABLED=true;
 const person=h.request({action:'profileCreate',name:'Camille',email:'camille@example.org',allowedSubjects:['french']}).profile;
 const user=h.request({action:'login',email:person.email}),plan=planCollectionImport(emptyData(),collections);
 const ops=plan.changes.map(([entity,key,value],i)=>({id:'french_import_'+i,entity,key,value,device:'french-import-test',seq:i+1,at:100+i}));
 for(let i=0;i<ops.length;i+=200)h.request({action:'push',subject:'french',base:h.request({action:'check',subject:'french'}).version,ops:ops.slice(i,i+200)});
 const own=h.request({action:'pull',subject:'french',since:0}).data,target=h.request({action:'pull',subject:'french',since:0,token:user.token}).data;
 assert.equal(Object.keys(own.collections).length,11);assert.equal(Object.keys(own.words).length,231);assert.equal(Object.keys(target.words).length,231);
 const alternative=Object.values(target.words).find(word=>word.latin==='seul/seule');assert.deepEqual(Array.from(alternative.answerVariants),['seul','seule']);
 for(const subject of ['latin','english'])assert.equal(h.request({action:'check',subject}).version,0);
 assert.equal(Object.keys(target.reviews).length,0);assert.equal(h.request({action:'profiles'}).profiles[0].simplifiedMode,false);
});
