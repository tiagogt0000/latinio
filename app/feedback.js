const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function answerFeedback(feedback){
  const rows=feedback.rows.filter(row=>row.kind!=='empty').map(row=>{
    const wrong=row.kind==='wrong';
    return `<div class="graded-answer ${wrong?'incorrect':'correct'}"><div class="graded-content"><span class="answer-mark" aria-label="${wrong?'Falsch':'Richtig'}">${wrong?'✕':'✓'}</span><span>${wrong?`<s>${escape(row.answer)}</s>`:escape(row.answer)}</span></div>${wrong?`<button type="button" class="typo-link" data-action="accept-typo" data-index="${row.index}">Das war ein Tippfehler</button>`:''}</div>`;
  });
  return rows.join('');
}

export function translationCard(word,feedback){
  if(!feedback)return '';
  return `<div class="latin-word translation-card" lang="de" aria-label="Deutsche Übersetzung" aria-live="polite">${word.meanings.flat().map(escape).join(', ')}</div>`;
}
