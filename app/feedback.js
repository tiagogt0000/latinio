const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function answerFeedback(feedback,{correctAction='correct-evaluation'}={}){
  const rows=feedback.rows.filter(row=>row.kind!=='empty').map(row=>{
    const wrong=row.kind==='wrong';
    const correctable=wrong||row.kind==='manual';
    return `<div class="graded-answer ${wrong?'incorrect':'correct'}"><div class="graded-content"><span class="answer-mark" aria-label="${wrong?'Falsch':'Richtig'}">${wrong?'✕':'✓'}</span><span>${wrong?`<s>${escape(row.answer)}</s>`:escape(row.answer)}</span></div>${correctable?`<button type="button" class="typo-link" data-action="${escape(correctAction)}" data-index="${row.index}">Auswertungsfehler korrigieren</button>`:''}</div>`;
  });
  return rows.join('');
}

export function evaluationCorrection(word,index,selected=[],{titleId='modal-title',formId='evaluation-correction-form'}={}){
 const checked=new Set(Array.isArray(selected)?selected:Number.isInteger(selected)?[selected]:[]);
 return `<h2 id="${escape(titleId)}">Auswertungsfehler korrigieren</h2><p class="muted">Wähle alle Bedeutungen aus, die du in dieses Antwortfeld geschrieben hast.</p><form id="${escape(formId)}" data-index="${index}"><div class="bounded-list">${word.meanings.map((g,i)=>`<label class="collection-check"><input type="checkbox" name="group" value="${i}" ${checked.has(i)?'checked':''}><span>${escape(g.join(' / '))}</span></label>`).join('')}</div><button type="submit" class="button primary wide">Auswahl übernehmen</button></form>`;
}

export function translationCard(word,feedback,language='de'){
 if(!feedback)return '';
 return `<div class="latin-word translation-card" lang="${language}" aria-label="${language==='fr'?'Französische':language==='en'?'Englische':'Deutsche'} Übersetzung" aria-live="polite">${word.meanings.flat().map(escape).join(', ')}</div>`;
}
