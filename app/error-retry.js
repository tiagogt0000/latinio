export function failedTasks(session,reviews){
 if(!session||!Array.isArray(session.queue))return [];
 return session.queue.flatMap((item,index)=>{
  const review=reviews?.[`${session.id}-${index}`];
  return review&&!review.repeat&&review.grade!=='full'?[{...item,repeat:false}]:[];
 });
}

export function createErrorRetry(previous,tasks,id,now=Date.now()){
 if(!previous||!tasks?.length)return null;
 return {
  id,mode:previous.mode==='inactive-check'?'inactive-check':'errors',
  sourceIds:[...(previous.sourceIds||[])],refreshTarget:previous.refreshTarget,
  meaningRequirement:previous.meaningRequirement||'all',cardFlipped:false,
  queue:tasks.map(item=>({...item,repeat:false})),cursor:0,originalLength:tasks.length,
  answers:[''],feedback:null,overrides:{},startedAt:now,finished:false,
  retryStage:(previous.retryStage||1)+1,
  completionRoot:previous.completionRoot,
  allWordIds:tasks.map(item=>item.wordId),
 };
}
