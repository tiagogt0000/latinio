import test from 'node:test';
import assert from 'node:assert/strict';
import {enqueueFailedWord} from '../app/training-queue.js';

test('failed repeats keep returning until an answer is fully correct',()=>{
 const session={mode:'smart',queue:[{wordId:'w1'}],feedback:{grade:'wrong'}};
 assert.equal(enqueueFailedWord(session,session.queue[0]),true);
 session.cursor=1;session.feedback={grade:'partial'};
 assert.equal(enqueueFailedWord(session,session.queue[session.cursor]),true);
 assert.deepEqual(session.queue,[{wordId:'w1'},{wordId:'w1',repeat:true},{wordId:'w1',repeat:true}]);
 session.feedback={grade:'full'};
 assert.equal(enqueueFailedWord(session,session.queue[session.cursor]),false);
 assert.equal(session.queue.length,3);
});

test('the repetition rule does not change refresher-card assessments',()=>{
 const session={mode:'inactive-check',queue:[],feedback:{grade:'wrong'}};
 assert.equal(enqueueFailedWord(session,{wordId:'w1'}),false);
 assert.deepEqual(session.queue,[]);
});
