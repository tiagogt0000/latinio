import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,progressFor} from '../app/core.js';
import {collectionWords} from '../app/collection-words.js';

function fixture(){
 const d=emptyData();d.collections.c={id:'c',name:'Lektion'};
 for(let i=0;i<80;i++){
  const id='word'+i;d.words[id]={id,collectionId:'c',latin:'vox'+i,meanings:[['Stimme '+i]]};
  for(let j=0;j<4;j++){const rid=id+'-'+j;d.reviews[rid]={id:rid,wordId:id,direction:'en-de',at:j+1,grade:i%2&&j===3?'wrong':'full'};}
 }
 return d;
}
test('Collection history is traversed once, and displayed levels match the learning engine',()=>{
 const d=fixture();let scans=0,reads=0;
 d.reviews=new Proxy(d.reviews,{ownKeys(target){scans++;return Reflect.ownKeys(target);},get(target,key){reads++;return target[key];}});
 const rows=collectionWords(d,{filter:'c'});
 assert.equal(rows.length,80);assert.equal(scans,1);assert.equal(reads,320);
 for(const {word,level} of rows)assert.equal(level,progressFor(word.id,d.reviews).level);
});
test('Search, removed lessons and directions retain their exact selection semantics',()=>{
 const d=fixture();d.words.orphan={id:'orphan',collectionId:'gone',latin:'vox orphan',meanings:[['Stimme']]};
 assert.equal(collectionWords(d,{query:'STIMME 79'})[0].word.id,'word79');
 assert.equal(collectionWords(d,{filter:'gone'}).length,0);
 assert.equal(collectionWords(d,{query:'vox0',directions:['en-de']})[0].level,'known');
 assert.equal(collectionWords(d,{query:'vox0',directions:['en-de','de-en']})[0].level,'learning');
 assert.equal(collectionWords(d,{query:'vox0',directions:['de-en']})[0].level,'new');
});
test('Fresh reviews immediately demote secure words without stale caches; deck completion is separate',()=>{
 const d=fixture();d.settings.deck={kind:'refreshDeck',members:[{wordId:'word0',addedAt:0}]};
 assert.equal(collectionWords(d,{filter:'deck'})[0].level,'known');
 d.reviews.failed={id:'failed',wordId:'word0',at:10,grade:'wrong'};
 let row=collectionWords(d,{filter:'deck'})[0];assert.equal(row.level,'learning');assert.equal(row.pending,true);
 d.reviews.good={id:'good',wordId:'word0',at:11,grade:'full'};
 row=collectionWords(d,{filter:'deck'})[0];assert.equal(row.level,'learning');assert.equal(row.pending,false);assert.equal(row.inRefreshDeck,true);
});
