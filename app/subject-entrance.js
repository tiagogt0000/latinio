export const subjectChoices=[
  {id:'latin',label:'Latein',logo:'./icon.svg'},
  {id:'english',label:'Englisch',logo:'./icon-english.svg'}
];

export function entranceMarkup(){
  return `<main class="subject-entrance" aria-labelledby="entrance-title"><div class="entrance-content"><p class="entrance-eyebrow">LATINIO</p><h1 id="entrance-title">Was möchtest du lernen?</h1><div class="entrance-choices">${subjectChoices.map(choice=>`<button type="button" class="entrance-choice" data-enter-subject="${choice.id}"><img src="${choice.logo}" alt="" width="72" height="72"><span>${choice.label}</span><span class="entrance-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div></main>`;
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
