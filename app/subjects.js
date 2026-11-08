export const SUBJECTS=[
 {id:'latin',label:'Latein',flag:'🇻🇦',code:'la',logo:'./icon.svg?v=2.14.0',brand:'latinio'},
 {id:'english',label:'Englisch',flag:'🇺🇸',code:'en',logo:'./icon-english.svg?v=2.14.0',brand:'latinio'}
];
export const subjectInfo=id=>SUBJECTS.find(s=>s.id===id)||SUBJECTS[0];
export const brandWord=()=> 'latinio<span>✦</span>';
export const TRANSITION_KEY='latinio-brand-transition';
const transitions=new WeakMap();

// Loading starts immediately. Navigation owns readiness; motion never delays it.
export function beginSubjectTransition(root,from,to,{keyboard=false,reducedMotion,resume=false}={}){
 transitions.get(root)?.dispose();
 const doc=root.ownerDocument||globalThis.document,view=doc.defaultView||globalThis;
 const preference=view.matchMedia?.('(prefers-reduced-motion: reduce)');
 reducedMotion??=!!preference?.matches;
 const source=subjectInfo(from),target=subjectInfo(to);
 const style=view.getComputedStyle?.(doc.documentElement);
 const easing=style?.getPropertyValue('--ease-out').trim()||'cubic-bezier(0.23,1,0.32,1)';
 const duration=parseFloat(style?.getPropertyValue('--apple-enter'))||220;
 const veil=doc.createElement('div');veil.className='subject-transition';
 veil.setAttribute('role','status');veil.setAttribute('aria-live','polite');veil.setAttribute('aria-busy','true');
 veil.innerHTML=`<div class="subject-transition-content"><div class="subject-transition-icons" aria-hidden="true"><img class="subject-transition-logo is-from" src="${source.logo}" alt="" width="104" height="104"><img class="subject-transition-logo is-to" src="${target.logo}" alt="" width="104" height="104"></div><p>${target.label} wird geladen …</p></div>`;
 doc.body.append(veil);
 const animations=new Set();let state='loading',completeEntry=()=>{},finishTimer=null;
 function play(element,frames,options,done){
  let animation;
  try{
   if(!element?.animate){done?.();return Promise.resolve();}
   animation=element.animate(frames,{easing,...options});animations.add(animation);
   return animation.finished.then(()=>{animations.delete(animation);done?.();},()=>{animations.delete(animation);done?.();});
  }catch{
   if(animation){animations.delete(animation);try{animation.cancel();}catch{}}
   done?.();return Promise.resolve();
  }
 }
 function cancelAnimations(){
  for(const animation of animations){try{animation.cancel();}catch{}}
  animations.clear();
 }
 function dispose(){
  if(state==='disposed')return;state='disposed';
  cancelAnimations();completeEntry();view.clearTimeout(finishTimer);preference?.removeEventListener?.('change',preferenceChanged);veil.remove();
  if(transitions.get(root)===controller)transitions.delete(root);
 }
 function preferenceChanged(event){
  reducedMotion=event.matches;
  if(!reducedMotion)return;
  if(state==='closing')dispose();else{cancelAnimations();completeEntry();}
 }
 const controller={
  entered:Promise.resolve(),
  finish(){
   if(state!=='loading')return;state='closing';
   if(keyboard||reducedMotion){dispose();return;}
   finishTimer=view.setTimeout(dispose,300);
   play(veil,[{opacity:1},{opacity:0}],{duration:200,fill:'forwards'},dispose);
  },
  fail:dispose,
  dispose
 };
 transitions.set(root,controller);preference?.addEventListener?.('change',preferenceChanged);
 if(!keyboard&&!reducedMotion&&!resume&&source.id!==target.id){
  const direction=target.id==='english'?1:-1;
  const entering=[
   play(veil.querySelector('.is-from'),[{opacity:1,transform:'translateX(0) scale(1)'},{opacity:0,transform:`translateX(${-direction*96}px) scale(.94)`}],{duration,fill:'backwards'}),
   play(veil.querySelector('.is-to'),[{opacity:0,transform:`translateX(${direction*96}px) scale(.94)`},{opacity:1,transform:'translateX(0) scale(1)'}],{duration,fill:'backwards'})
  ];
  // A stalled browser animation cannot hold navigation indefinitely.
  controller.entered=new Promise(resolve=>{
   const timer=view.setTimeout(()=>completeEntry(),duration+100);
   completeEntry=()=>{view.clearTimeout(timer);resolve();};
   Promise.all(entering).then(completeEntry);
  });
 }
 return controller;
}

// Retained for older callers during an app update; no fixed-duration wait.
export async function brandTransition(root,from,to,options){if(from!==to){const transition=beginSubjectTransition(root,from,to,options);await transition.entered;transition.finish();}}
