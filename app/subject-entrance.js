import {SUBJECTS} from './subjects.js';
export const subjectChoices=SUBJECTS;
const arrivals=new WeakMap(),keyboardChoices=new WeakMap();

export function entranceMarkup(){
  return `<main class="subject-entrance" aria-labelledby="entrance-title"><div class="entrance-content"><div class="entrance-wordmark brand">latinio<span>✦</span></div><p class="entrance-eyebrow">ZEIT FÜR EINE KLEINE RUNDE</p><h1 id="entrance-title">Was möchtest du heute lernen?</h1><p class="entrance-subtitle">Latein, Englisch und Französisch. In deinem Tempo.</p><div class="entrance-choices" role="group" aria-label="Lernfach wählen">${subjectChoices.map(choice=>`<button type="button" class="entrance-choice" data-subject="${choice.id}" data-enter-subject="${choice.id}"><img src="${choice.logo}" alt="" width="72" height="72"><span class="entrance-choice-copy"><strong class="entrance-choice-title">${choice.label}</strong><small class="entrance-choice-description">${choice.id==='latin'?'Vokabeln und Formen festigen.':'Deinen Wortschatz erweitern.'}</small></span><span class="entrance-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div></main>`;
}

export function chooseSubject(root,{reducedMotion}={}){
  const doc=root.ownerDocument||globalThis.document,view=doc?.defaultView||globalThis;
  const preference=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const easing=view.getComputedStyle?.(doc?.documentElement)?.getPropertyValue('--ease-drawer').trim()||'cubic-bezier(0.32,0.72,0,1)';
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
        if(event.detail>0&&!(reducedMotion??preference?.matches)&&!doc?.hidden&&content?.animate){
          // A quick tap can interrupt the picker's own CSS entrance. Read its
          // presentation values before disabling that animation, so it neither
          // jumps to full opacity nor reappears after the exit effect is removed.
          const presentation=view.getComputedStyle?.(content);
          const opacity=parseFloat(presentation?.opacity);
          const initial={opacity:Number.isFinite(opacity)?opacity:1,transform:presentation?.transform||'none'};
          if(content.style){
            content.style.animation='none';
            content.style.opacity=String(initial.opacity);
            content.style.transform=initial.transform;
          }
          await new Promise(finish=>{
            let animation,timer,settled=false;
            function settle(){
              if(settled)return;settled=true;
              // Keep the outgoing picker invisible while the selected screen opens,
              // without retaining a transform or a finished animation effect.
              if(content.style){content.style.opacity='0';content.style.transform='';}
              try{animation?.cancel?.();}catch{}
              view.clearTimeout(timer);
              doc?.removeEventListener?.('visibilitychange',settle);
              doc?.removeEventListener?.('keydown',settle,true);
              view.removeEventListener?.('pagehide',settle);
              view.removeEventListener?.('pageshow',settle);
              preference?.removeEventListener?.('change',settle);
              finish();
            }
            doc?.addEventListener?.('visibilitychange',settle);
            doc?.addEventListener?.('keydown',settle,true);
            view.addEventListener?.('pagehide',settle);
            view.addEventListener?.('pageshow',settle);
            preference?.addEventListener?.('change',settle);
            timer=view.setTimeout(settle,560);
            try{
              animation=content.animate([initial,{opacity:0,transform:'translateY(8px) scale(.985)'}],{duration:440,easing,fill:'forwards'});
              Promise.resolve(animation.finished).then(settle,settle);
            }catch{settle();/* Optional motion must never trap the subject selection. */}
          });
        }
        resolve(subject);
      });
    });
  });
}

export function settleArrival(root){arrivals.get(root)?.();}
export function arrive(root,{keyboard=keyboardChoices.get(root)||false,delay=0}={}){
  settleArrival(root);
  root.classList?.remove('app-arriving');
  const doc=root.ownerDocument||globalThis.document,view=doc?.defaultView||globalThis;
  if(keyboard||doc?.hidden)return Promise.resolve();
  const preference=view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const style=view.getComputedStyle?.(doc?.documentElement);
  const easing=style?.getPropertyValue('--ease-drawer').trim()||'cubic-bezier(0.32,0.72,0,1)';
  const fast=parseFloat(style?.getPropertyValue('--apple-fast'))||160;
  const startDelay=Number.isFinite(delay)?Math.max(0,delay):0;
  const animations=new Set();let timer,settled=false,resolveFinished,endTime=0;
  const finished=new Promise(resolve=>{resolveFinished=resolve;});
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
    resolveFinished();
  }
  function reveal(element,delay,duration,distance){
    if(!element?.animate||element.isConnected===false)return;
    try{
      // Only surfaces move. Their containers and the fixed nav wrapper stay still.
      const frames=preference?.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:`translateY(${distance}px) scale(.98)`},{opacity:1,transform:'none'}];
      const options={duration:preference?.matches?fast:duration,delay:preference?.matches?0:startDelay+delay,easing,fill:'backwards'};
      const animation=element.animate(frames,options);
      endTime=Math.max(endTime,options.duration+options.delay);
      animations.add(animation);
      animation.finished.then(()=>{animations.delete(animation);if(!animations.size)settle();},()=>{animations.delete(animation);if(!animations.size)settle();});
    }catch{/* The complete, usable screen is already rendered underneath. */}
  }
  // A deliberate, calmer subject entrance: one overlapping wave, 640 ms total.
  // Regular interactions keep their existing fast timing.
  root.querySelectorAll('.topbar, .sidebar').forEach(element=>reveal(element,0,500,8));
  reveal(root.querySelector('.home-heading'),60,520,8);
  root.querySelectorAll('.home-practice-grid > .training-card').forEach((element,index)=>reveal(element,[120,180,220,240][Math.min(index,3)],400,index?4:6));
  reveal(root.querySelector('.mobile-nav > nav'),240,400,4);
  if(!root.querySelector('.home-heading'))reveal(root.querySelector('.content, .login-shell'),60,520,6);
  if(!animations.size){resolveFinished();return finished;}
  arrivals.set(root,settle);
  doc?.addEventListener?.('visibilitychange',settle);
  doc?.addEventListener?.('keydown',settle,true);
  view.addEventListener?.('pagehide',settle);
  view.addEventListener?.('pageshow',settle);
  preference?.addEventListener?.('change',settle);
  // iOS can suspend completion events while backgrounded; never retain effects.
  timer=view.setTimeout(settle,endTime+120);
  return finished;
}

export const SUBJECT_SWITCH_KEY='latinio-direct-subject-switch';
export function consumeSubjectSwitch(storage){let value;try{value=storage.getItem(SUBJECT_SWITCH_KEY);storage.removeItem(SUBJECT_SWITCH_KEY);}catch{}return SUBJECTS.some(subject=>subject.id===value)?value:null;}
