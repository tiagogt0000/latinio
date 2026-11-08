import test from 'node:test';
import assert from 'node:assert/strict';
import {predicateCloudItems,predicateProgress,predicateProgressIndex,predicateQueue,shufflePredicates} from '../app/predicates.js';

const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function originalQueue(data,deckIds,mode,limit,seed){
 const items=shufflePredicates(predicateCloudItems(data).filter(item=>deckIds.includes(item.deckId)),random(seed));
 if(mode==='learning')return items.filter(item=>!predicateProgress(data,item).known);
 if(mode==='refresh')return items.filter(item=>predicateProgress(data,item).known);
 if(mode==='all')return items;
 return items.sort((a,b)=>{const x=predicateProgress(data,a),y=predicateProgress(data,b);return Number(x.known)-Number(y.known)||x.at-y.at;}).slice(0,limit);
}
function corpus(){
 const settings={irrelevant:{kind:'general'}};
 for(let i=0;i<24;i++)settings['p'+i]={kind:'predicateItem',deckId:i%2?'a':'b',grundform:i%3===0?'AMĀRE':'verb'+i,praedikate:['answer'+i]};
 for(let i=0;i<120;i++)settings['r'+i]={kind:'predicateReview',...(i%4?{itemId:'p'+i%23}:{grundform:i%8?'amare':'verb'+i%24}),at:100+Math.floor(i/7),correct:i%3===0};
 settings.unrelated={kind:'predicateReview',itemId:'missing',grundform:'amare',at:999,correct:true};
 settings.old={kind:'predicateReview',grundform:'amare',at:1,correct:false};
 return {settings};
}

test('The indexed queue exactly preserves all modes, shuffle order and limits from the original progress rules',()=>{
 const data=corpus(),before=structuredClone(data),items=predicateCloudItems(data);
 const index=predicateProgressIndex(data,items);
 for(const item of items)assert.deepEqual(index.get(item.id),predicateProgress(data,item),item.id);
 for(const decks of [[],['a'],['b'],['a','b']])for(const mode of ['smart','learning','refresh','all','legacy-mode'])for(const limit of [0,1,10,Infinity])for(const seed of [1,3]){
  assert.deepEqual(predicateQueue(data,decks,mode,limit,random(seed)),originalQueue(data,decks,mode,limit,seed),JSON.stringify({decks,mode,limit,seed}));
 }
 assert.deepEqual(data,before);
});

test('Equal-time ID and normalized legacy reviews retain original record order in either direction',()=>{
 for(const legacyFirst of [true,false]){
  const direct={kind:'predicateReview',itemId:'one',at:200,correct:true},legacy={kind:'predicateReview',grundform:'  AMĀRE ',at:200,correct:false};
  const data={settings:{first:legacyFirst?legacy:direct,second:legacyFirst?direct:legacy,third:{...direct,correct:false}}};
  const item={id:'one',grundform:'amare'},index=predicateProgressIndex(data,[item]);
  assert.deepEqual(index.get('one'),predicateProgress(data,item));assert.equal(index.get('one').known,!legacyFirst);
 }
 const item={id:'one',grundform:'amare'},data={settings:{z:{kind:'predicateReview',itemId:'one',at:200,correct:true},7:{kind:'predicateReview',grundform:'amare',at:200,correct:false}}};
 assert.deepEqual(predicateProgressIndex(data,[item]).get('one'),{seen:true,known:false,at:200});
});

test('Unseen items, falsey legacy IDs, numeric strings and malformed old timestamps retain exact progress',()=>{
 const items=[{id:'one',grundform:'amāre'},{id:'two',grundform:'amare'},{id:'new',grundform:'novus'}];
 for(const times of [[5,undefined,10],[undefined,10,5],[5,'broken',10],[null,'20','100'],[0,-1,0],[Infinity,5,Infinity]]){
  const data={settings:{a:{kind:'predicateReview',itemId:'one',at:times[0],correct:true},b:{kind:'predicateReview',itemId:0,grundform:'AMARE',at:times[1],correct:false},c:{kind:'predicateReview',itemId:'one',at:times[2],correct:false}}};
  const index=predicateProgressIndex(data,items);
  for(const item of items)assert.deepEqual(index.get(item.id),predicateProgress(data,item),JSON.stringify({times,item}));
 }
});

test('Large queues traverse settings only twice and a new review invalidates progress immediately',()=>{
 const raw={};
 for(let i=0;i<1500;i++)raw['p'+i]={kind:'predicateItem',deckId:'large',grundform:'verb'+i,praedikate:['answer']};
 for(let i=0;i<45000;i++)raw['r'+i]={kind:'predicateReview',itemId:'p'+i%1500,at:i,correct:i%3!==0};
 let scans=0;
 const data={settings:new Proxy(raw,{ownKeys(target){assert.ok(++scans<=2,'The full settings history must not be rescanned per item or comparison');return Reflect.ownKeys(target);}})};
 const queue=predicateQueue(data,['large'],'smart',10,random(7));
 assert.equal(queue.length,10);assert.equal(scans,2);assert.ok(queue.every(item=>Number(item.id.slice(1))%3===0));
 const item=queue[0];scans=0;assert.equal(predicateProgressIndex(data,[item]).get(item.id).known,false);assert.equal(scans,1);
 raw.latest={kind:'predicateReview',itemId:item.id,at:999999,correct:true};
 scans=0;assert.equal(predicateProgressIndex(data,[item]).get(item.id).known,true);assert.equal(scans,1);
});
