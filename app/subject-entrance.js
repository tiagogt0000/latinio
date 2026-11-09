import {SUBJECTS} from './subjects.js';
export const subjectChoices=SUBJECTS;
const arrivals=new WeakMap(),keyboardChoices=new WeakMap();

export function entranceMarkup(){
  return `<main class="subject-entrance" aria-labelledby="entrance-title"><div class="entrance-content"><div class="entrance-wordmark brand">latinio<span>✦</span></div><p class="entrance-eyebrow">ZEIT FÜR EINE KLEINE RUNDE</p><h1 id="entrance-title">Was möchtest du heute lernen?</h1><p class="entrance-subtitle">Latein, Englisch und Französisch. In deinem Tempo.</p><div class="entrance-choices" role="group" aria-label="Lernfach wählen">${subjectChoices.map(choice=>`<button type="button" class="entrance-choice" data-subject="${choice.id}" data-enter-subject="${choice.id}"><img src="${choice.logo}" alt="" width="72" height="72"><span class="entrance-choice-copy"><strong class="entrance-choice-title">${choice.label}</strong><small class="entrance-choice-description">${choice.id==='latin'?'Vokabeln und Formen festigen.':'Deinen Wortschatz erweitern.'}</small></span><span class="entrance-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div></main>`;
}

export function chooseSubject(root,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}={}){
  root.innerHTML=entranceMarkup();
  return new Promise(resolve=>{
    let selected=false;
    root.querySelectorAll('[data-enter-subject]').forEach(button=>{
      button.addEventListener('click',async event=>{
        if(selected)return;selected=true;
        keyboardChoices.set(root,event.detail===0);
        const subject=button.dataset.enterSubject;
        root.querySelectorAll('[data-enter-subject]').forEach(el=>{el.disabled=true;});
        const content=root.querySelector('.entrance-content');
        if(event.detail>0&&!reducedMotion&&content?.animate){
          let timer;try{
          const animation=content.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(8px)'}],{duration:220,easing:'cubic-bezier(0.23,1,0.32,1)',fill:'forwards'});
          await Promise.race([animation.finished,new Promise(resolve=>{timer=setTimeout(resolve,350);})]);
          }catch{/* Optional motion must never trap the subject selection. */}finally{clearTimeout(timer);}
        }
        resolve(subject);
      });
    });
  });
}

export function settleArrival(root){arrivals.get(root)?.();}
export function arrive(root,{keyboard=keyboardChoices.get(root)||false}={}){
  settleArrival(root);
  root.classList?.remove('app-arriving');
  const doc=root.ownerDocument||globalThis.document,view=doc?.defaultView||globalThis;
  if(keyboard||doc?.hidden)return;
  const preference=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const style=view.getComputedStyle?.(doc?.documentElement);
  const easing=style?.getPropertyValue('--ease-out').trim()||'cubic-bezier(0.23,1,0.32,1)';
  const fast=parseFloat(style?.getPropertyValue('--apple-fast'))||160;
  const animations=new Set();let timer,settled=false;
  function settle(){
    if(settled)return;settled=true;
    for(const animation of animations){try{animation.cancel();}catch{}}
    animations.clear();view.clearTimeout(timer);
    doc?.removeEventListener?.('visibilitychange',settle);
    doc?.removeEventListener?.('keydown',settle,true);
    view.removeEventListener?.('pagehide',settle);
    view.removeEventListener?.('pageshow',settle);
    preference?.removeEventListener?.('change',settle);
    if(arrivals.get(root)===settle)arrivals.delete(root);
  }
  function reveal(element,delay,duration,distance){
    if(!element?.animate||element.isConnected===false)return;
    try{
      // Only surfaces move. Their containers and the fixed nav wrapper stay still.
      const frames=preference?.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:`translateY(${distance}px) scale(.98)`},{opacity:1,transform:'none'}];
      const animation=element.animate(frames,{duration:preference?.matches?fast:duration,delay:preference?.matches?0:delay,easing,fill:'backwards'});
      animations.add(animation);
      animation.finished.then(()=>{animations.delete(animation);if(!animations.size)settle();},()=>{animations.delete(animation);if(!animations.size)settle();});
    }catch{/* The complete, usable screen is already rendered underneath. */}
  }
  // Background first, then a single overlapping reading-order wave (285 ms total).
  root.querySelectorAll('.topbar, .sidebar').forEach(element=>reveal(element,15,180,8));
  reveal(root.querySelector('.home-heading'),45,200,6);
  root.querySelectorAll('.home-practice-grid > .training-card').forEach((element,index)=>reveal(element,[75,105,120,125][Math.min(index,3)],fast,index?4:6));
  reveal(root.querySelector('.mobile-nav > nav'),125,fast,4);
  if(!root.querySelector('.home-heading'))reveal(root.querySelector('.content, .login-shell'),45,200,6);
  if(!animations.size)return;
  arrivals.set(root,settle);
  doc?.addEventListener?.('visibilitychange',settle);
  doc?.addEventListener?.('keydown',settle,true);
  view.addEventListener?.('pagehide',settle);
  view.addEventListener?.('pageshow',settle);
  preference?.addEventListener?.('change',settle);
  // iOS can suspend completion events while backgrounded; never retain effects.
  timer=view.setTimeout(settle,350);
}

export const SUBJECT_SWITCH_KEY='latinio-direct-subject-switch';
export function consumeSubjectSwitch(storage){let value;try{value=storage.getItem(SUBJECT_SWITCH_KEY);storage.removeItem(SUBJECT_SWITCH_KEY);}catch{}return SUBJECTS.some(subject=>subject.id===value)?value:null;}
