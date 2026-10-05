import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {failedTasks,createErrorRetry} from '../app/error-retry.js';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');

test('progressive training is replaced by a retry option on the result screen',()=>{
 assert.doesNotMatch(source,/data-action="start-progressive"|progressive-summary|progressive-next-stage/);
 assert.match(source,/data-action="retry-errors"/);
});

test('retry sessions include only mistakes from the previous round and advance the stage',()=>{
 const original={id:'round-1',mode:'all',sourceIds:['lesson'],meaningRequirement:'any',retryStage:1,queue:[{wordId:'known'},{wordId:'missed'}]};
 const tasks=failedTasks(original,{'round-1-0':{grade:'full'},'round-1-1':{grade:'wrong'}});
 const retry=createErrorRetry(original,tasks,'round-2',123);
 assert.deepEqual(retry.queue,[{wordId:'missed',repeat:false}]);
 assert.equal(retry.retryStage,2);assert.equal(retry.meaningRequirement,'any');assert.equal(retry.startedAt,123);
});

test('flashcard retries remain flashcards and exclude cards marked known',()=>{
 const original={id:'refresh-1',mode:'inactive-check',sourceIds:['lesson'],refreshTarget:'deck',retryStage:2,queue:[{wordId:'a'},{wordId:'b'}]};
 const tasks=failedTasks(original,{'refresh-1-0':{grade:'full'},'refresh-1-1':{grade:'wrong'}});
 const retry=createErrorRetry(original,tasks,'refresh-2');
 assert.equal(retry.mode,'inactive-check');assert.equal(retry.retryStage,3);assert.equal(retry.queue[0].wordId,'b');
});
