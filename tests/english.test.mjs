import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,evaluateSession,progressFor} from '../app/core.js';
import {englishTasks,englishImport,answerWord,promptFor} from '../app/english.js';
import {saveDeck} from '../app/refresh-decks.js';
import {rateRefresh} from '../app/refresh-cards.js';
import {harness} from './google-harness.mjs';

function data(){const d=emptyData();d.collections.lesson={id:'lesson',name:'Unit 1'};d.words.hello={id:'hello',collectionId:'lesson',latin:'hello',meanings:[['hallo']]};return d;}
test('English progress and due tasks are independent in each direction',()=>{
 const d=data();d.reviews.a={id:'a',wordId:'hello',direction:'en-de',grade:'full',at:100};d.reviews.b={id:'b',wordId:'hello',direction:'en-de',grade:'full',at:200};d.reviews.c={id:'c',wordId:'hello',direction:'en-de',grade:'full',at:300};
 assert.equal(progressFor('hello',d.reviews,'en-de').level,'known');assert.equal(progressFor('hello',d.reviews,'de-en').level,'new');
 assert.deepEqual(englishTasks(d,['lesson'],'learning',10,'mixed'),[{wordId:'hello',direction:'de-en'}]);
 assert.deepEqual(englishTasks(d,['lesson'],'all',10,'mixed').map(x=>x.direction).sort(),['de-en','en-de']);
 assert.equal(englishTasks(d,['lesson'],'smart',1,'mixed')[0].direction,'de-en');
});
test('Refresh decks can explicitly cover one direction or both',()=>{
 const d=data();d.settings.refresh={...saveDeck(d,null,'refresh','Practice',['hello']),direction:'de-en'};
 assert.deepEqual(englishTasks(d,['refresh'],'all',10,'mixed'),[{wordId:'hello',direction:'de-en'}]);
 const session={id:'r',mode:'inactive-check',queue:[{wordId:'hello',direction:'de-en'}],cursor:0,cardFlipped:true,sourceIds:['lesson'],refreshTarget:'refresh',originalLength:1};
 const result=rateRefresh(d,session,false,500);assert.equal(result.ops[0][2].direction,'de-en');assert.equal(result.ops.at(-2)[2].members[0].wordId,'hello');
});
test('English reverse spelling is strict; German typo tolerance remains available',()=>{
 const w=data().words.hello;
 assert.equal(promptFor(w,'de-en'),'hallo');assert.deepEqual(answerWord(w,'de-en').meanings,[['hello']]);
 assert.equal(evaluateSession(answerWord(w,'de-en'),['helo'],false).grade,'wrong');
 assert.equal(evaluateSession(w,['halloo'],true).grade,'full');
 const parsed=englishImport({format:'latinio-collection',schema:1,name:'Unit',words:[{english:'hello',german:['hallo']}]});
 assert.equal(parsed.words[0].latin,'hello');assert.deepEqual(parsed.words[0].meanings,[['hallo']]);
});
test('Google journals, versions, and shares stay separate for English',()=>{
 const h=harness(),op=(id,key)=>({id,entity:'collections',key,value:{id:key,name:key},device:'test',seq:1,at:100});
 assert.equal(h.request({action:'push',subject:'english',base:0,ops:[op('english-op','unit')]}).version,1);
 assert.equal(h.request({action:'check'}).version,0);assert.equal(h.request({action:'check',subject:'english'}).version,1);
 assert.equal(h.request({action:'pull',since:0}).data.collections.unit,undefined);
 assert.equal(h.request({action:'whoami'}).apiVersion,3);
 const profile=h.request({action:'profileCreate',name:'Schüler',email:'student@example.org'}).profile;
 assert.equal(h.request({action:'shareCreateMany',subject:'english',profileId:profile.id,collectionIds:['unit']}).results.length,1);
 assert.equal(h.request({action:'shareList'}).shares.length,0);
 assert.equal(h.request({action:'shareList',subject:'english'}).shares.length,1);
 assert.equal(h.ctx.readState_(profile.id,true,'latin').version,0);
 assert.ok(h.ctx.readState_(profile.id,true,'english').data.collections);
});
