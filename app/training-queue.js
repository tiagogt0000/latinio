export function enqueueFailedWord(session,item){
 if(session?.feedback?.grade==='full'||session?.mode==='inactive-check')return false;
 session.queue.push({...item,repeat:true});
 return true;
}
