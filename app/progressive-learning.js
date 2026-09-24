export function progressivePassResult(wordIds){
 const failed=[...new Set(wordIds)];
 return {failed,action:failed.length===0?'complete':failed.length>=3?'next-stage':'repeat-in-stage'};
}
