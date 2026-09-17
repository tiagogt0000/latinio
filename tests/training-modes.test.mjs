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
test('Smart training adds one daily refresher, remembers it and eventually finishes',()=>{
 const d=fixture();delete d.words.new;delete d.words.learning;
 assert.deepEqual(chooseWords(d,['c'],10,'smart',now),['secure']);
 d.reviews.today={id:'today',wordId:'secure',grade:'full',at:now,repeat:false};
 assert.deepEqual(chooseWords(d,['c'],10,'smart',now),[]);
 assert.deepEqual(chooseWords(d,['c'],10,'smart',now+day),['recent']);
});
test('Scheduled secure reviews still return and all modes respect selected collections',()=>{
 const d=fixture();assert.ok(chooseWords(d,['c'],10,'smart',now+10*day).includes('secure'));
 for(const mode of ['smart','learning','refresh','all'])assert.deepEqual(chooseWords(d,[],10,mode,now),[]);
 assert.equal(chooseWords(d,['c'],1,'smart',now).length,1);
});
