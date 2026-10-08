import {progressFor} from './core.js';
import {selectedDeckPending} from './refresh-decks.js';

// A direction is a separate learning task in English. Refresh-deck security uses
// the same rules as the collection view, including a deck's own review history.
export function taskKey(item){return item.wordId+'|'+(item.direction||'');}
export function taskKnown(data,item,sourceIds=[]){
 const pending=selectedDeckPending(data,item.wordId,sourceIds,item.direction||null);
 return pending===null?progressFor(item.wordId,data.reviews,item.direction||null).level==='known':!pending;
}
export function completionRoot(session,data){
 return {id:session.id,queue:session.queue.map(item=>({...item})),sourceIds:[...(session.sourceIds||[])],known:Object.fromEntries(session.queue.map(item=>[taskKey(item),taskKnown(data,item,session.sourceIds)]))};
}
export function roundStats(session,data){
 const root=session.completionRoot||{id:session.id,queue:session.queue,sourceIds:session.sourceIds,known:{}};
 let correct=0,wrong=0;const answered=[];
 root.queue.forEach((item,index)=>{const review=data.reviews[`${root.id}-${index}`];if(!review||review.repeat)return;answered.push(item);if(review.grade==='full')correct++;else wrong++;});
 const unique=[...new Map(answered.map(item=>[taskKey(item),item])).values()];
 const newlyKnown=unique.filter(item=>root.known[taskKey(item)]===false&&taskKnown(data,item,root.sourceIds)).length;
 return {correct,wrong,newlyKnown,total:correct+wrong};
}
