export function enqueueFailedWord(session,item){
 if(session?.feedback?.grade==='full'||session?.mode==='inactive-check')return false;
 session.queue.push({wordId:item.wordId,repeat:true});
 return true;
}
