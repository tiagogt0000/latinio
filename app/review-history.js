// At equal timestamps, a session's numeric cursor still determines answer order.
export function compareReviews(a,b){
 const time=Number(a.at)-Number(b.at);
 if(time)return time;
 const left=String(a.id).match(/^(.*)-(\d+)$/),right=String(b.id).match(/^(.*)-(\d+)$/);
 if(left&&right&&left[1]===right[1])return Number(left[2])-Number(right[2]);
 return String(a.id).localeCompare(String(b.id));
}

// A successful correction practices a revealed answer; a mistake is still
// evidence that the word needs learning. Explicit grading corrections replace
// the original review, and manual "known" decisions retain their own meaning.
export function successfulRetry(review){
 return review.grade==='full'&&!review.manualKnown&&
  !!(review.repeat||review.mode==='errors'||review.retryStage>1);
}
