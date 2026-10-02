import {shuffleQueue} from './core.js';
export function enqueueFailedWord(session,item){
 if(session?.feedback?.grade==='full'||session?.mode==='inactive-check')return false;
 session.queue.push({...item,repeat:true});
 const split=(Number.isInteger(session.cursor)?session.cursor:0)+1;
 session.queue.splice(split,session.queue.length-split,...shuffleQueue(session.queue.slice(split)));
 return true;
}
