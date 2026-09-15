const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function answerFeedback(feedback){
  const missing=[...feedback.missing];
  const rows=feedback.rows.filter(row=>row.kind!=='empty').map(row=>{
    const wrong=row.kind==='wrong';
    const correction=wrong?missing.shift():null;
    return `<div class="graded-answer ${wrong?'incorrect':'correct'}"><div class="graded-content"><span class="answer-mark" aria-label="${wrong?'Falsch':'Richtig'}">${wrong?'✕':'✓'}</span><span>${wrong?`<s>${escape(row.answer)}</s>`:escape(row.answer)}</span>${correction?`<span class="answer-solution"><span class="small">Mögliche Lösung:</span> ${escape(correction.label)}</span>`:''}</div>${wrong?`<button type="button" class="typo-link" data-action="accept-typo" data-index="${row.index}">Das war ein Tippfehler</button>`:''}</div>`;
  });
  rows.push(...missing.map(item=>`<div class="graded-answer incorrect"><div class="graded-content"><span class="answer-mark" aria-hidden="true">＋</span><span>${escape(item.label)}</span><span class="missing-label">Fehlte</span></div></div>`));
  return rows.join('');
}
