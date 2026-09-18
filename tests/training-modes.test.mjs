import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,chooseWords,progressFor} from '../app/core.js';
const now=new Date(2026,8,17,12).getTime(),day=86400000;
function fixture(){
 const d=emptyData();d.collections.c={id:'c'};
 for(const id of ['new','learning','secure','recent'])d.words[id]={id,collectionId:'c'};
 const review=(id,n,grade,at)=>d.reviews[id+n]={id:id+n,wordId:id,grade,at,repeat:false};
 review('learning',0,'partial',now-1000);
 for(const id of ['secure','recent'])for(let i=0;i<3;i++)review(id,i,'full',now-(id==='secure'?2:1)*day-(2-i)*1000);
 return d;
}
test('Learning stays available before due dates and excludes secure words',()=>{
 const d=fixture();assert.deepEqual(new Set(chooseWords(d,['c'],10,'learning',now)),new Set(['new','learning']));
 for(let i=0;i<3;i++)assert.ok(chooseWords(d,['c'],10,'learning',now).includes('learning'));
});
test('Refresh is unlimited, includes only secure words and rotates by last review',()=>{
 const d=fixture();assert.deepEqual(chooseWords(d,['c'],10,'refresh',now),['secure','recent']);
 d.reviews.latest={id:'latest',wordId:'secure',grade:'full',at:now,repeat:false};
 assert.equal(progressFor('secure',d.reviews).lastReviewedAt,now);
 assert.deepEqual(chooseWords(d,['c'],10,'refresh',now),['recent','secure']);
 d.reviews.failed={id:'failed',wordId:'recent',grade:'wrong',at:now,repeat:false};
 assert.ok(!chooseWords(d,['c'],10,'refresh',now).includes('recent'));
 assert.ok(chooseWords(d,['c'],10,'learning',now).includes('recent'));
});
test('Smart training remains available after the daily target and rotates mastered words',()=>{
 const d=fixture();delete d.words.new;delete d.words.learning;
 assert.deepEqual(chooseWords(d,['c'],1,'smart',now),['secure']);
 d.reviews.today={id:'today',wordId:'secure',grade:'full',at:now,repeat:false};
 assert.deepEqual(chooseWords(d,['c'],1,'smart',now),['recent']);
 d.reviews.again={id:'again',wordId:'recent',grade:'full',at:now+1,repeat:false};
 assert.equal(chooseWords(d,['c'],10,'smart',now+2).length,2);
});
test('Smart rounds mix learning with spaced refreshers and defer freshly reviewed secure words',()=>{
 const d=emptyData();d.collections.c={id:'c'};
 for(let i=0;i<30;i++)d.words['n'+i]={id:'n'+i,collectionId:'c'};
 for(let i=0;i<10;i++){
  const id='k'+i;d.words[id]={id,collectionId:'c'};
  for(let j=0;j<3;j++)d.reviews[id+j]={id:id+j,wordId:id,grade:'full',at:now-10*day+j*1000,repeat:false};
 }
 const first=chooseWords(d,['c'],20,'smart',now);
 assert.equal(first.length,20);assert.equal(new Set(first).size,20);assert.equal(first.filter(id=>id.startsWith('k')).length,4);
 first.forEach(id=>{d.reviews['today'+id]={id:'today'+id,wordId:id,grade:'full',at:now,repeat:false};});
 const second=chooseWords(d,['c'],20,'smart',now+1);
 assert.equal(second.length,20);assert.ok(second.filter(id=>id.startsWith('k')).every(id=>!first.includes(id)));
 assert.equal(second.filter(id=>id.startsWith('n')&&!first.includes(id)).length,14);
});
test('Scheduled secure reviews still return and all modes respect selected collections',()=>{
 const d=fixture();assert.ok(chooseWords(d,['c'],10,'smart',now+10*day).includes('secure'));
 for(const mode of ['smart','learning','refresh','all'])assert.deepEqual(chooseWords(d,[],10,mode,now),[]);
 assert.equal(chooseWords(d,['c'],1,'smart',now).length,1);
});
