import {SUBJECTS} from './subjects.js';
export const subjectChoices=SUBJECTS;

export function entranceMarkup(){
  return `<main class="subject-entrance" aria-labelledby="entrance-title"><div class="entrance-content"><div class="entrance-wordmark brand">latinio<span>✦</span></div><p class="entrance-eyebrow">DEIN TÄGLICHER MOMENT</p><h1 id="entrance-title">Womit geht’s heute weiter?</h1><p class="entrance-subtitle">Drei Sprachen. Ein gemeinsamer Lernweg.</p><div class="entrance-choices">${subjectChoices.map(choice=>`<button type="button" class="entrance-choice" data-subject="${choice.id}" data-enter-subject="${choice.id}"><img src="${choice.logo}" alt="" width="72" height="72"><span><small class="entrance-app-name">${choice.brand}</small>${choice.label}<small class="entrance-flag" aria-hidden="true">${choice.flag}</small></span><span class="entrance-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div></main>`;
}

export function chooseSubject(root,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}={}){
  root.innerHTML=entranceMarkup();
  return new Promise(resolve=>{
    let selected=false;
    root.querySelectorAll('[data-enter-subject]').forEach(button=>{
      button.addEventListener('click',async()=>{
        if(selected)return;selected=true;
        const subject=button.dataset.enterSubject;
        root.querySelectorAll('[data-enter-subject]').forEach(el=>{el.disabled=true;});
        const content=root.querySelector('.entrance-content');
        if(!reducedMotion&&content.animate){
          const animation=content.animate([{opacity:1,transform:'translateY(0)',filter:'blur(0)'},{opacity:0,transform:'translateY(18px)',filter:'blur(6px)'}],{duration:380,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
          await animation.finished.catch(()=>{});
        }
        resolve(subject);
      });
    });
  });
}

export function arrive(root){
  root.classList.add('app-arriving');
  setTimeout(()=>root.classList.remove('app-arriving'),900);
}

export const SUBJECT_SWITCH_KEY='latinio-direct-subject-switch';
export function consumeSubjectSwitch(storage){const value=storage.getItem(SUBJECT_SWITCH_KEY);storage.removeItem(SUBJECT_SWITCH_KEY);return ['latin','english','french'].includes(value)?value:null;}
