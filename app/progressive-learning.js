export function progressivePassResult(wordIds,stageTotal=Infinity){
 const failed=[...new Set(wordIds)];
 const action=failed.length===0?'complete':stageTotal<=4?'repeat-in-stage':failed.length>=3?'next-stage':'repeat-in-stage';
 return {failed,action};
}
