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
  const review={id:session.id+'-'+session.cursor,wordId:word.id,direction:item.direction,grade:known?'full':'wrong',at:now,repeat:!!item.repeat,mode:'inactive-check',retryStage:session.retryStage||1,selfAssessed:true};
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

export function refreshCardView(session,word,h,icon,subject='english'){
 const flipped=!!session.cardFlipped;
 const reverse=session.queue[session.cursor]?.direction==='de-en',front=reverse?word.meanings.map(g=>g.join(' / ')).join(' · '):word.latin,back=reverse?word.latin:word.meanings.map(g=>g.join(' / ')).join(', ');
 return `<main class="test-shell"><header class="test-top"><button class="icon-button" data-action="pause" aria-label="Runde abbrechen">${icon('close')}</button><div class="test-progress"><div style="width:${Math.round(session.cursor/session.queue.length*100)}%"></div></div><span class="small muted">${session.cursor+1} / ${session.queue.length}</span></header><div class="test-content"><div class="eyebrow">AUFFRISCHTEST · KARTEIKARTEN${reverse?(subject==='french'?' · DEUTSCH → FRANZÖSISCH':' · DEUTSCH → ENGLISCH'):''}</div><h1>Gewusst?</h1><p class="muted">Umdrehen und selbst entscheiden.</p><button type="button" class="refresh-card ${flipped?'is-flipped':''}" data-action="refresh-card-flip" aria-label="Karte umdrehen"><span class="latin-word" lang="${reverse?'de':session.queue[session.cursor]?.direction?(subject==='french'?'fr':'en'):'la'}">${h(front)}</span>${flipped?`<span class="refresh-card-meanings">${h(back)}</span>`:'<span class="muted">Tippen zum Umdrehen</span>'}</button><p class="small muted">← Nicht gewusst · Gewusst →</p><div class="refresh-card-actions"><button class="button secondary" data-action="refresh-card-wrong" data-cursor="${session.cursor}" ${!flipped?'disabled':''}>← Nicht gewusst</button><button class="button primary" data-action="refresh-card-known" data-cursor="${session.cursor}" ${!flipped?'disabled':''}>Gewusst →</button></div><p class="small muted">Nicht gewusste Wörter werden am Ende automatisch gespeichert.</p></div></main>`;
}

export function bindRefreshSwipe(card,onRate,{view=card.ownerDocument?.defaultView||globalThis}={}){
 let start=null,moved=false,position=0,frame=null;
 const requestFrame=view.requestAnimationFrame?.bind(view),cancelFrame=view.cancelAnimationFrame?.bind(view);
 const now=()=>view.performance?.now?.()??Date.now();
 const reduced=()=>view.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
 const write=value=>{position=value;card.style.transform=value?`translateX(${value}px)`:'';};
 const stop=()=>{if(frame!==null)cancelFrame?.(frame);frame=null;};
 // One critically damped return (response 0.4s). Its presentation value stays
 // in position, so another pointer can catch it without snapping to its target.
 function settle(velocity=0){
  stop();card.classList.remove('is-dragging');
  if(card.isConnected===false){position=0;return;}
  if(!position||!requestFrame||!cancelFrame||reduced()){write(0);return;}
  const origin=position,started=now(),omega=2*Math.PI/.4,coefficient=velocity+omega*origin;
  const tick=()=>{
   frame=null;
   if(card.isConnected===false){position=0;return;}
   if(reduced()){write(0);return;}
   const elapsed=Math.max(0,(now()-started)/1000),decay=Math.exp(-omega*elapsed);
   const next=(origin+coefficient*elapsed)*decay,speed=(velocity-omega*coefficient*elapsed)*decay;
   if(elapsed>=1||Math.abs(next)<.25&&Math.abs(speed)<5){write(0);return;}
   write(next);frame=requestFrame(tick);
  };
  frame=requestFrame(tick);
 }
 function track(event){
  const dx=event.clientX-start.x,dy=event.clientY-start.y;
  if(!start.axis&&Math.hypot(dx,dy)>=10)start.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
  if(Math.abs(dx)>12||start.axis==='y')moved=true;
  if(start.axis==='x'&&card.classList.contains('is-flipped')){
   card.classList.add('is-dragging');write(start.offset+dx);
   const at=now();start.samples=start.samples.filter(sample=>at-sample.at<=80);
   if(start.samples.at(-1)?.x!==position)start.samples.push({x:position,at});
  }
  return {dx,dy};
 }
 function releaseVelocity(){
  const samples=start.samples,first=samples[0],last=samples.at(-1),elapsed=last.at-first.at;
  return now()-last.at<=80&&elapsed>=8?(last.x-first.x)*1000/elapsed:0;
 }
 const cancel=event=>{if(!start||start.id!==event.pointerId)return;start=null;moved=true;settle();};
 const handlers={
  pointerdown:event=>{
   if(start||!event.isPrimary||event.button!==0)return;
   stop();start={id:event.pointerId,x:event.clientX,y:event.clientY,offset:position,axis:null,samples:[{x:position,at:now()}]};moved=false;
   card.setPointerCapture?.(event.pointerId);
  },
  pointermove:event=>{if(start?.id===event.pointerId)track(event);},
  pointerup:event=>{
   if(start?.id!==event.pointerId)return;
   const {dx,dy}=track(event),velocity=releaseVelocity();
   // Carried position and release velocity never count as learning answers.
   const rate=start.axis!=='y'&&card.classList.contains('is-flipped')&&Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.3;
   start=null;settle(velocity);if(rate){moved=true;onRate(dx>0);}
  },
  pointercancel:cancel,lostpointercapture:cancel,
  click:event=>{
   if(event.detail===0){moved=false;stop();write(0);return;}
   if(moved){moved=false;event.preventDefault();event.stopPropagation();}
  }
 };
 for(const [name,handler] of Object.entries(handlers))card.addEventListener(name,handler,name==='click');
 return ()=>{stop();start=null;card.classList.remove('is-dragging');write(0);for(const [name,handler] of Object.entries(handlers))card.removeEventListener(name,handler,name==='click');};
}
