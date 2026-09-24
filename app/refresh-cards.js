import {saveDeck,checkResultWords} from './refresh-decks.js';

export function finishRefresh(data,session,now=Date.now()){
 const ids=checkResultWords(data,session);
 const target=session.refreshTarget||'refresh_'+session.id;
 const existing=data.settings[target];
 const name=existing?.name||('Auffrischen '+(session.sourceIds||[]).map(id=>data.collections[id]?.name||'').filter(Boolean).join(', ')).slice(0,100)||'Auffrischen';
 const deck=saveDeck(data,existing,target,name,[...(existing?.members||[]).map(m=>m.wordId),...ids],now);
 session.refreshTarget=target;session.refreshSavedCount=ids.length;
 return ['settings',target,deck];
}

// Review, cursor and final collection are committed together, including offline.
export function rateRefresh(data,saved,known,now=Date.now()){
 if(saved?.mode!=='inactive-check'||saved.finished)return null;
 const session=JSON.parse(JSON.stringify(saved)),item=session.queue[session.cursor];
 if(!item)return null;
 const word=data.words[item.wordId],ops=[];
 if(word){
  if(!session.cardFlipped)return null;
  const review={id:session.id+'-'+session.cursor,wordId:word.id,grade:known?'full':'wrong',at:now,repeat:false,mode:'inactive-check',selfAssessed:true};
  ops.push(['reviews',review.id,review]);
 }
 session.cursor++;session.cardFlipped=false;session.feedback=null;session.answers=[''];session.overrides={};
 if(session.cursor>=session.queue.length){
  session.finished=true;
  const reviews={...data.reviews};for(const [entity,id,value] of ops)if(entity==='reviews')reviews[id]=value;
  ops.push(finishRefresh({...data,reviews},session,now),['sessions',session.id,{id:session.id,at:now,count:session.originalLength}]);
 }
 return {session,ops};
}

export function refreshCardView(session,word,h,icon){
 const flipped=!!session.cardFlipped;
 return `<main class="test-shell"><header class="test-top"><button class="icon-button" data-action="pause" aria-label="Runde abbrechen">${icon('close')}</button><div class="test-progress"><div style="width:${Math.round(session.cursor/session.queue.length*100)}%"></div></div><span class="small muted">${session.cursor+1} / ${session.queue.length}</span></header><div class="test-content"><div class="eyebrow">AUFFRISCHTEST · KARTEIKARTEN</div><h1>Gewusst?</h1><p class="muted">Umdrehen und selbst entscheiden.</p><button type="button" class="refresh-card ${flipped?'is-flipped':''}" data-action="refresh-card-flip" aria-label="${flipped?'Latein anzeigen':'Bedeutungen anzeigen'}"><span class="latin-word" lang="la">${h(word.latin)}</span>${flipped?`<span class="refresh-card-meanings">${h(word.meanings.map(g=>g.join(' / ')).join(', '))}</span>`:'<span class="muted">Tippen zum Umdrehen</span>'}</button><p class="small muted">← Nicht gewusst · Gewusst →</p><div class="refresh-card-actions"><button class="button secondary" data-action="refresh-card-wrong" data-cursor="${session.cursor}" ${!flipped?'disabled':''}>← Nicht gewusst</button><button class="button primary" data-action="refresh-card-known" data-cursor="${session.cursor}" ${!flipped?'disabled':''}>Gewusst →</button></div><p class="small muted">Nicht gewusste Wörter werden am Ende automatisch gespeichert.</p></div></main>`;
}

export function bindRefreshSwipe(card,onRate){
 let start=null,moved=false;
 card.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;start={id:e.pointerId,x:e.clientX,y:e.clientY};moved=false;card.setPointerCapture?.(e.pointerId);});
 card.addEventListener('pointermove',e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>12)moved=true;if(card.classList.contains('is-flipped')&&Math.abs(dx)>Math.abs(dy))card.style.transform=`translateX(${dx*.65}px) rotate(${dx/30}deg)`;});
 card.addEventListener('pointerup',e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;card.style.transform='';if(card.classList.contains('is-flipped')&&Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.3){moved=true;onRate(dx>0);}});
 card.addEventListener('pointercancel',()=>{start=null;moved=true;card.style.transform='';});
 card.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);
}
