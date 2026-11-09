export const SUBJECTS=[
 {id:'latin',label:'Latein',flag:'🇻🇦',code:'la',logo:'./icon.svg?v=2.14.0',brand:'latinio'},
 {id:'english',label:'Englisch',flag:'🇺🇸',code:'en',logo:'./icon-english.svg?v=2.14.0',brand:'latinio'},
 {id:'french',label:'Französisch',flag:'🇫🇷',code:'fr',logo:'./icon-french.svg?v=2.16.0',brand:'latinio'}
];
export const subjectInfo=id=>SUBJECTS.find(s=>s.id===id)||SUBJECTS[0];
export const brandWord=()=> 'latinio<span>✦</span>';
export const TRANSITION_KEY='latinio-brand-transition';
const transitions=new WeakMap();

// Deliberate subject changes use a single wordmark story. Data loading stays
// independent; the destination adopts the final frame before its first paint.
export function beginSubjectTransition(root,from,to,{keyboard=false,reducedMotion,resume=false}={}){
 transitions.get(root)?.dispose();
 const doc=root.ownerDocument||globalThis.document,view=doc.defaultView||globalThis;
 const preference=view.matchMedia?.('(prefers-reduced-motion: reduce)');
 reducedMotion??=!!preference?.matches;
 const source=subjectInfo(from),target=subjectInfo(to);
 const style=view.getComputedStyle?.(doc.documentElement);
 const token=(name,fallback)=>style?.getPropertyValue(name).trim()||fallback;
 const drawer=token('--ease-drawer','cubic-bezier(0.32,0.72,0,1)'),morph=token('--ease-in-out','cubic-bezier(0.77,0,0.175,1)');
 const blurIn=parseFloat(token('--subject-blur-in','360'))||360;
 const move=parseFloat(token('--subject-wordmark-move','720'))||720;
 const blurOut=parseFloat(token('--subject-blur-out','600'))||600;
 const lead=300,total=lead+move;
 const handoff=doc.getElementById?.('subject-transition-handoff');
 const adopted=resume&&handoff?.getAttribute('data-from')===source.id&&handoff?.getAttribute('data-to')===target.id;
 if(handoff&&!adopted)handoff.remove();
 const veil=adopted?handoff:doc.createElement('div');veil.className='subject-transition';
 veil.setAttribute('role','status');veil.setAttribute('aria-live','polite');veil.setAttribute('aria-busy','true');
 if(!adopted){
  veil.innerHTML=`<div class="subject-transition-backdrop" aria-hidden="true"></div><div class="subject-transition-content"><div class="subject-transition-wordmarks" aria-hidden="true"><div class="brand subject-transition-wordmark is-from" data-subject="${source.id}">${brandWord(source.id)}</div><div class="brand subject-transition-wordmark is-to" data-subject="${target.id}">${brandWord(target.id)}</div></div><p>${target.label} wird geladen …</p></div>`;
  doc.body.append(veil);
 }
 const backdrop=veil.querySelector('.subject-transition-backdrop'),content=veil.querySelector('.subject-transition-content');
 const animations=new Set();let state='loading',entryTimer,finishTimer,statusTimer,completeEntry=()=>{},completeFinish=()=>{},finishPromise=null;
 function play(element,frames,options){
  try{
   if(!element?.animate)return Promise.resolve();
   const animation=element.animate(frames,{easing:drawer,...options});animations.add(animation);
   return animation.finished.then(()=>{if(options.fill!=='forwards'){animations.delete(animation);try{animation.cancel();}catch{}}},()=>{animations.delete(animation);});
  }catch{return Promise.resolve();}
 }
 function cancelAnimations(){for(const animation of animations){try{animation.cancel();}catch{}}animations.clear();}
 function dispose(){
  if(state==='disposed')return;state='disposed';
  cancelAnimations();completeEntry();completeFinish();
  view.clearTimeout(entryTimer);view.clearTimeout(finishTimer);view.clearTimeout(statusTimer);
  preference?.removeEventListener?.('change',preferenceChanged);
  doc.removeEventListener?.('visibilitychange',visibilityChanged);
  view.removeEventListener?.('pagehide',dispose);view.removeEventListener?.('pageshow',restored);
  veil.remove();root.removeAttribute?.('data-subject-handoff');
  if(transitions.get(root)===controller)transitions.delete(root);
 }
 function preferenceChanged(event){if(event.matches){reducedMotion=true;dispose();}}
 function visibilityChanged(){if(doc.hidden)dispose();}
 function restored(event){if(event.persisted)dispose();}
 const controller={
  entered:Promise.resolve(),
  get closing(){return state==='closing';},
  get disposed(){return state==='disposed';},
  finish(){
   if(finishPromise)return finishPromise;
   if(state==='disposed')return Promise.resolve();
   state='closing';view.clearTimeout(statusTimer);veil.setAttribute('aria-busy','false');
   finishPromise=new Promise(resolve=>{completeFinish=resolve;});
   if(keyboard||reducedMotion||doc.hidden){dispose();return finishPromise;}
   // Stop a partially completed entry before revealing the usable destination.
   cancelAnimations();completeEntry();
   finishTimer=view.setTimeout(dispose,blurOut+160);
   Promise.all([
    play(content,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.025)'}],{duration:400,fill:'forwards'}),
    play(backdrop,[{opacity:1},{opacity:0}],{duration:blurOut,easing:morph,fill:'forwards'})
   ]).then(dispose);
   return finishPromise;
  },
  fail:dispose,
  dispose
 };
 transitions.set(root,controller);
 preference?.addEventListener?.('change',preferenceChanged);
 doc.addEventListener?.('visibilitychange',visibilityChanged);
 view.addEventListener?.('pagehide',dispose);view.addEventListener?.('pageshow',restored);
 if(keyboard||reducedMotion||doc.hidden){dispose();return controller;}
 statusTimer=view.setTimeout(()=>{if(state==='loading')veil.classList?.add('is-waiting');},1800);
 if(!resume&&source.id!==target.id){
  // The old name leaves left and gets smaller; the new name arrives from the
  // right and grows to take its place, regardless of the subject ordering.
  const entering=[
   play(backdrop,[{opacity:0},{opacity:1}],{duration:blurIn,fill:'backwards'}),
   play(veil.querySelector('.is-from'),[
    {opacity:0,transform:'translateX(0) scale(.96)',offset:0,easing:'linear'},
    {opacity:0,transform:'translateX(0) scale(.96)',offset:.1,easing:drawer},
    {opacity:1,transform:'translateX(0) scale(1)',offset:lead/total,easing:morph},
    {opacity:0,transform:'translateX(-130%) scale(.68)',offset:1}
   ],{duration:total,easing:'linear',fill:'backwards'}),
   play(veil.querySelector('.is-to'),[
    {opacity:0,transform:'translateX(130%) scale(.76)'},
    {opacity:1,transform:'translateX(0) scale(1)'}
   ],{delay:lead,duration:move,easing:morph,fill:'backwards'})
  ];
  controller.entered=new Promise(resolve=>{
   let settled=false;
   completeEntry=()=>{if(settled)return;settled=true;view.clearTimeout(entryTimer);resolve();};
   entryTimer=view.setTimeout(()=>{cancelAnimations();completeEntry();},total+160);
   Promise.all(entering).then(completeEntry);
  });
 }
 return controller;
}
export async function brandTransition(root,from,to,options){if(from!==to){const transition=beginSubjectTransition(root,from,to,options);await transition.entered;await transition.finish();}}
