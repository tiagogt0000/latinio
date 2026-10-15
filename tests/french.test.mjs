import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {frenchImport,frenchTextImport,frenchTasks,frenchHome,seedFrenchStarter} from '../app/french.js';
import {parseImport,emptyData} from '../app/core.js';
import {currentSubject,rememberSubject} from '../app/subject-preference.js';
import {entranceMarkup,consumeSubjectSwitch,SUBJECT_SWITCH_KEY} from '../app/subject-entrance.js';
import {classroomView} from '../app/classroom.js';
import {harness} from './google-harness.mjs';
const h=x=>String(x).replaceAll('<','&lt;');
const disk=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('French Vocabify text and JSON imports split German meanings and refuse foreign languages',()=>{
 const input=frenchTextImport('# Vocabify-Abschnitt\n# Name: Unité 2\n# Sprache: fr\nla mère ; die Mutter\naimer ; lieben, mögen / gernhaben','test.vocab.txt');
 const parsed=parseImport(input,emptyData());assert.equal(parsed.collection.name,'Unité 2');assert.deepEqual(parsed.words[1].meanings,[['lieben'],['mögen'],['gernhaben']]);
 assert.equal(parseImport(frenchImport({name:'Test',lang:'fr',vocab:[{f:'la sœur',d:'die Schwester'}]}),emptyData()).words[0].latin,'la sœur');
 assert.throws(()=>frenchImport({lang:'en',vocab:[]}),/französische/);assert.throws(()=>frenchTextImport('# Sprache: la\nvox ; Stimme'),/nicht zu Französisch/);
});
test('French has an explicit third entrance, remembered preference and a single-use direct switch',()=>{
 const storage=disk();rememberSubject('french',storage);assert.equal(currentSubject('',storage),'french');
 assert.equal(currentSubject('?subject=french',storage),'french');assert.match(entranceMarkup(),/data-enter-subject="french"/);assert.match(entranceMarkup(),/Vocabify/i);
 storage.setItem(SUBJECT_SWITCH_KEY,'french');assert.equal(consumeSubjectSwitch(storage),'french');assert.equal(consumeSubjectSwitch(storage),null);
});
test('French modes use both directions, preserve reviews and filter older, unseen and incorrect words',()=>{
 const d=emptyData(),now=Date.now();d.collections.c={id:'c',name:'Unité 1'};
 for(const id of ['old','new','wrong'])d.words[id]={id,collectionId:'c',latin:id,meanings:[[id]]};
 d.reviews.a={id:'a',wordId:'old',grade:'full',direction:'en-de',at:now-8*86400000};d.reviews.b={id:'b',wordId:'wrong',grade:'wrong',direction:'de-en',at:now-1000};
 const before=JSON.stringify(d.reviews);
 assert.deepEqual(new Set(frenchTasks(d,['c'],'older',10,'mixed',now).map(t=>t.wordId)),new Set(['old']));
 assert.deepEqual(new Set(frenchTasks(d,['c'],'newest',10,'mixed',now).map(t=>t.wordId)),new Set(['new']));
 assert.deepEqual(new Set(frenchTasks(d,['c'],'errors',10,'mixed',now).map(t=>t.wordId)),new Set(['wrong']));
 assert.equal(frenchTasks(d,['c'],'all',10,'mixed',now).length,6);assert.equal(JSON.stringify(d.reviews),before);assert.match(frenchHome(d,3,10,h),/Vocabify/i);
});
test('French classroom inputs disable correction and use French language markup',()=>{
 const d=emptyData();d.collections.c={id:'c',name:'FR'};d.words.w={id:'w',collectionId:'c',latin:'la maison',meanings:[['das Haus']]};
 const html=classroomView(d,'maison',h,true,'french');assert.match(html,/autocorrect="off"/);assert.match(html,/lang="fr"/);assert.doesNotMatch(html,/Mögliche gebeugte Form/);
});
test('French journals, automatic shares and checker preserve Latin and English and enforce subject permissions',()=>{
 const h=harness();h.ctx.AUTOMATIC_SHARING_ENABLED=true;
 const p=h.request({action:'profileCreate',name:'Camille',email:'camille@example.org',allowedSubjects:['french']}).profile;
 const user=h.request({action:'login',email:p.email});let seq=0;
 const push=(entity,key,value)=>h.request({action:'push',subject:'french',base:h.request({action:'check',subject:'french'}).version,ops:[{id:'fr'+(++seq),entity,key,value,device:'test',seq,at:Date.now()}]});
 push('collections','unite',{id:'unite',name:'Unité 1'});push('words','maison',{id:'maison',collectionId:'unite',latin:'la maison',meanings:[['das Haus']]});
 const target=h.request({action:'pull',token:user.token,subject:'french',since:0}).data;
 assert.equal(Object.values(target.words)[0].latin,'la maison');assert.equal(h.request({action:'check'}).version,0);assert.equal(h.request({action:'check',subject:'english'}).version,0);
 assert.equal(h.request({action:'autoShareCheck',profileIds:[p.id]}).differences.length,0);
 assert.throws(()=>h.request({action:'pull',subject:'latin',token:user.token}),/nicht freigeschaltet/);
 assert.equal(h.request({action:'shareList',subject:'french'}).shares[0].automatic,true);
});
test('Vocabify runtime never loads the attachment’s independent Firebase authentication',()=>{
 const main=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');assert.doesNotMatch(main,/firebase|gstatic/);assert.match(main,/new Store\(\)\.open\(profile.id,subject\)/);
 const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');for(const name of ['french.js','notifications.js','subjects.js','icon-vocabify.svg'])assert.ok(sw.includes(name));
});
test('The French starter imports only the eight French demo words, once, without sample users or progress',async()=>{
 const data=emptyData();let commits=0;const store={data,subject:'french',profileId:'admin',async commit(changes){commits++;for(const [entity,key,value] of changes)data[entity][key]=value;}};
 await seedFrenchStarter(store);await seedFrenchStarter(store);assert.equal(commits,1);assert.equal(Object.keys(data.words).length,8);assert.deepEqual(data.reviews,{});assert.deepEqual(data.sessions,{});assert.equal(Object.keys(data.collections).length,1);
 const student={...store,profileId:'student',data:emptyData()};await seedFrenchStarter(student);assert.deepEqual(student.data.collections,{});
});
