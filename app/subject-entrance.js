import {SUBJECTS} from './subjects.js';
export const subjectChoices=SUBJECTS;

export function entranceMarkup(){
  return `<main class="subject-entrance" aria-labelledby="entrance-title"><div class="entrance-content"><div class="entrance-wordmark brand">latinio<span>✦</span></div><p class="entrance-eyebrow">ZEIT FÜR EINE KLEINE RUNDE</p><h1 id="entrance-title">Was möchtest du heute lernen?</h1><p class="entrance-subtitle">Latein und Englisch. In deinem Tempo.</p><div class="entrance-choices" role="group" aria-label="Lernfach wählen">${subjectChoices.map(choice=>`<button type="button" class="entrance-choice" data-subject="${choice.id}" data-enter-subject="${choice.id}"><img src="${choice.logo}" alt="" width="72" height="72"><span class="entrance-choice-copy"><strong class="entrance-choice-title">${choice.label}</strong><small class="entrance-choice-description">${choice.id==='latin'?'Vokabeln und Formen festigen.':'Deinen Wortschatz erweitern.'}</small></span><span class="entrance-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div></main>`;
}

export function chooseSubject(root,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}={}){
  root.innerHTML=entranceMarkup();
  return new Promise(resolve=>{
    let selected=false;
    root.querySelectorAll('[data-enter-subject]').forEach(button=>{
      button.addEventListener('click',async event=>{
        if(selected)return;selected=true;
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

export function arrive(root){
  root.classList.add('app-arriving');
  setTimeout(()=>root.classList.remove('app-arriving'),900);
}

export const SUBJECT_SWITCH_KEY='latinio-direct-subject-switch';
export function consumeSubjectSwitch(storage){let value;try{value=storage.getItem(SUBJECT_SWITCH_KEY);storage.removeItem(SUBJECT_SWITCH_KEY);}catch{}return value==='french'?'latin':['latin','english'].includes(value)?value:null;}
