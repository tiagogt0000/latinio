import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,evaluateSession,progressFor,chooseWords} from '../app/core.js';
import {englishTasks} from '../app/english.js';
import {createErrorRetry,failedTasks} from '../app/error-retry.js';
import {rateRefresh} from '../app/refresh-cards.js';
import {pendingMembers,saveDeck} from '../app/refresh-decks.js';
import {completionRoot,roundStats} from '../app/round-completion.js';
import {forgottenWords} from '../app/collection-learning.js';

function fixture(){
 const data=emptyData();
 data.collections.lesson={id:'lesson',name:'Lektion'};
 data.words.word={id:'word',collectionId:'lesson',latin:'dicere',meanings:[['sprechen'],['sagen']]};
 for(let i=0;i<3;i++)data.reviews['old-'+i]={id:'old-'+i,wordId:'word',grade:'full',at:100+i,mode:'all'};
 return data;
}
function review(data,id,grade,at,extra={}){
 data.reviews[id]={id,wordId:'word',grade,at,...extra};
 return data.reviews[id];
}
function apply(data,transition){for(const [entity,id,value] of transition.ops)data[entity][id]=value;return transition.session;}

test('Every wrong or partial assessment returns a secure lesson word to learning, including repeats',()=>{
 for(const mode of ['smart','all','refresh','inactive-practice','inactive-check']){
  for(const grade of ['wrong','partial'])for(const repeat of [false,true]){
   const data=fixture();
   assert.equal(progressFor('word',data.reviews).level,'known');
   assert.deepEqual(chooseWords(data,['lesson'],1,'all'),['word']);
   review(data,'round-0',grade,200,{mode,repeat});
   const progress=progressFor('word',data.reviews);
   assert.equal(progress.level,'learning',`${mode}, ${grade}, repeat=${repeat}`);
   assert.equal(progress.streak,0);
   assert.equal(progress.lastReviewedAt,200);
   assert.deepEqual(chooseWords(data,['lesson'],1,'learning'),['word']);
   assert.deepEqual(chooseWords(data,['lesson'],1,'refresh'),[]);
  }
 }
});

test('A correct answer in all-words mode keeps an already secure word secure',()=>{
 const data=fixture(),session={id:'all',mode:'all',sourceIds:['lesson'],queue:[{wordId:'word'}]};
 session.completionRoot=completionRoot(session,data);
 review(data,'all-0','full',200,{mode:'all'});
 assert.equal(progressFor('word',data.reviews).level,'known');
 assert.deepEqual(chooseWords(data,['lesson'],1,'refresh'),['word']);
 assert.deepEqual(roundStats(session,data),{correct:1,wrong:0,newlyKnown:0,total:1});
});

test('One required meaning relaxes missing meanings, but never accepts an actual wrong addition',()=>{
 const data=fixture(),word=data.words.word,session={meaningRequirement:'any'};
 assert.equal(evaluateSession(word,['sprechen'],false,{},session).grade,'full');
 assert.equal(evaluateSession(word,['sprechen',''],false,{},session).grade,'full');
 assert.equal(evaluateSession(word,['sprechen','falsch'],false,{},session).grade,'wrong');
 assert.equal(evaluateSession(word,['sprechen','sagen'],false,{1:'wrong'},session).grade,'wrong');
 assert.equal(evaluateSession(word,['sprechen','falsch'],false,{1:1},session).grade,'full');
 const result=evaluateSession(word,['sprechen','falsch'],false,{},session);
 review(data,'all-0',result.grade,200,{mode:'all',meaningRequirement:'any'});
 assert.equal(progressFor('word',data.reviews).level,'learning');
});

test('Successful error retries cannot restore security; three independent assessments can',()=>{
 for(const retry of [{repeat:true,mode:'all'},{mode:'errors'},{mode:'inactive-check',retryStage:2}]){
  const data=fixture();
  review(data,'all-0','wrong',200,{mode:'all'});
  for(let i=0;i<3;i++)review(data,'retry-'+i,'full',300+i,retry);
  assert.equal(progressFor('word',data.reviews).level,'learning');
  assert.equal(progressFor('word',data.reviews).streak,0);
  assert.equal(progressFor('word',data.reviews).lastReviewedAt,200);
  for(let i=0;i<3;i++){
   review(data,'fresh-'+i,'full',400+i,{mode:'all'});
   assert.equal(progressFor('word',data.reviews).level,i===2?'known':'learning');
  }
 }
});

test('Initial self-assessment and imported manual-known history remain valid; a later failure revokes either',()=>{
 for(const initial of [{mode:'inactive-check'},{mode:'inactive-practice'},{manualKnown:true}]){
  const data=fixture();data.reviews={};
  review(data,'imported','full',100,initial);
  const before=structuredClone(data.reviews);
  assert.equal(progressFor('word',data.reviews).level,'known');
  assert.deepEqual(data.reviews,before);
  review(data,'all-0','partial',200,{mode:'all'});
  assert.equal(progressFor('word',data.reviews).level,'learning');
  review(data,'fresh-0','full',300,{mode:'inactive-check'});
  assert.equal(progressFor('word',data.reviews).level,'learning');
  review(data,'manual','full',400,{manualKnown:true});
  assert.equal(progressFor('word',data.reviews).level,'known');
  review(data,'later-0','wrong',500,{mode:'all'});
  assert.equal(progressFor('word',data.reviews).level,'learning');
 }
});

test('Explicit grading correction replaces the original evidence without deleting history',()=>{
 const data=fixture();review(data,'all-0','wrong',200,{mode:'all'});
 review(data,'retry-0','full',300,{mode:'errors'});
 assert.equal(progressFor('word',data.reviews).level,'learning');
 data.reviews['all-0']={...data.reviews['all-0'],grade:'full'};
 assert.equal(progressFor('word',data.reviews).level,'known');
 assert.equal(progressFor('word',data.reviews).streak,4);
 assert.equal(Object.keys(data.reviews).length,5);
});

test('Chronological replay and numeric session order are independent of object insertion order',()=>{
 const data=fixture();
 review(data,'round-10','wrong',200,{mode:'all'});
 review(data,'round-2','full',200,{mode:'all'});
 const reversed=Object.fromEntries(Object.entries(data.reviews).reverse());
 assert.equal(progressFor('word',reversed).level,'learning');
 assert.equal(progressFor('word',reversed).streak,0);
 data.reviews['round-2'].grade='wrong';data.reviews['round-10'].grade='full';
 assert.equal(progressFor('word',data.reviews).streak,1);
 review(data,'late-sync-old','full',99,{manualKnown:true});
 assert.equal(progressFor('word',data.reviews).level,'learning');
});

test('A failed English direction does not demote the other direction',()=>{
 const data=fixture();data.reviews={};
 for(const direction of ['en-de','de-en'])for(let i=0;i<3;i++)review(data,direction+i,'full',100+i,{direction});
 review(data,'all-0','wrong',200,{direction:'en-de',mode:'all'});
 assert.equal(progressFor('word',data.reviews,'en-de').level,'learning');
 assert.equal(progressFor('word',data.reviews,'de-en').level,'known');
 assert.deepEqual(englishTasks(data,['lesson'],'learning',10,'both'),[{wordId:'word',direction:'en-de'}]);
 assert.deepEqual(englishTasks(data,['lesson'],'refresh',10,'both'),[{wordId:'word',direction:'de-en'}]);
});

test('Refresher completion reopens for a failure and is not cleared by a successful correction',()=>{
 const data=fixture(),deck=saveDeck(data,null,'deck','Auffrischen',['word'],1);
 data.settings.deck=deck;
 assert.equal(pendingMembers(data,deck).length,0);
 review(data,'all-0','wrong',200,{repeat:true,mode:'all'});
 assert.equal(pendingMembers(data,deck).length,1);
 for(const [index,extra] of [{repeat:true},{mode:'errors'},{mode:'inactive-check',retryStage:2}].entries()){
  review(data,'retry-'+index,'full',300+index,extra);
  assert.equal(pendingMembers(data,deck).length,1);
  assert.deepEqual(chooseWords(data,['deck'],1,'learning'),['word']);
 }
 review(data,'fresh-0','full',400,{mode:'all'});
 assert.equal(pendingMembers(data,deck).length,0);
 // Finishing the deck's assessment is distinct from long-term word security.
 assert.equal(progressFor('word',data.reviews).level,'learning');
});

test('Flashcard error retries retain their stage and cannot immediately re-promote a failed word',()=>{
 const data=fixture();
 const original={id:'cards',mode:'inactive-check',sourceIds:['lesson'],queue:[{wordId:'word'}],cursor:0,originalLength:1,cardFlipped:true,retryStage:1};
 const ended=apply(data,rateRefresh(data,original,false,200));
 assert.equal(progressFor('word',data.reviews).level,'learning');
 const retry=createErrorRetry(ended,failedTasks(ended,data.reviews),'retry',300);
 retry.cardFlipped=true;
 const endedRetry=apply(data,rateRefresh(data,retry,true,400));
 assert.equal(data.reviews['retry-0'].retryStage,2);
 assert.equal(progressFor('word',data.reviews).level,'learning');
 assert.equal(pendingMembers(data,data.settings[endedRetry.refreshTarget]).length,1);
});

test('All-round statistics preserve the first error after a successful error retry',()=>{
 const data=fixture(),original={id:'all',mode:'all',sourceIds:['lesson'],queue:[{wordId:'word'}]};
 original.completionRoot=completionRoot(original,data);
 review(data,'all-0','partial',200,{mode:'all'});
 const retry=createErrorRetry(original,failedTasks(original,data.reviews),'retry',300);
 review(data,'retry-0','full',400,{mode:retry.mode,retryStage:retry.retryStage});
 assert.deepEqual(roundStats(retry,data),{correct:0,wrong:1,newlyKnown:0,total:1});
 assert.equal(progressFor('word',data.reviews).level,'learning');
});

test('Inactive practice retains a failed word after successful flashcard retries',()=>{
 const data=fixture();data.settings['collection-active_lesson']={active:false};
 review(data,'check-2','full',200,{mode:'inactive-check'});
 review(data,'check-10','wrong',200,{mode:'inactive-check',repeat:true});
 review(data,'retry-0','full',300,{mode:'inactive-check',retryStage:2});
 assert.deepEqual(forgottenWords(data).map(word=>word.id),['word']);
 review(data,'fresh-0','full',400,{mode:'inactive-practice'});
 assert.deepEqual(forgottenWords(data),[]);
 assert.equal(progressFor('word',data.reviews).level,'learning');
});
