async function playExit(element,frames,options){
 const view=element?.ownerDocument?.defaultView||globalThis;
 let animation,timer;
 const cancel=()=>{try{animation?.cancel?.();}catch{}};
 try{
  animation=element?.animate?.(frames,options);
  if(!animation)return;
  const finished=animation.finished;
  if(typeof finished?.then!=='function'){cancel();return;}
  await Promise.race([
   Promise.resolve(finished).catch(()=>{}),
   new Promise(resolve=>{timer=view.setTimeout(()=>{cancel();resolve();},options.duration+(options.delay||0)+100);})
  ]);
 }catch{cancel();}
 finally{view.clearTimeout(timer);}
}

export async function fadeRound(root,reducedMotion=false){
 root.querySelector('input:focus')?.blur();
 if(reducedMotion)return;
 const groups=[
  ['.test-top,.test-content>.eyebrow,.test-title,.test-content>h1,.latin-word:not(.translation-card)',0],
  ['#answers,#predicate-answer-form,.test-feedback,.feedback,.test-help,.translation-card,.refresh-card-meanings',140],
  ['.test-footer,.test-content>[data-action="predicate-next"],.refresh-card-actions,.test-content>.small',280]
 ];
 const candidates=groups.flatMap(([selector,delay])=>[...root.querySelectorAll(selector)].map(element=>({element,delay})));
 const seen=new Set();
 // A moving parent carries its children; animating both doubles their fade and travel.
 const targets=candidates.filter(({element})=>{
  if(seen.has(element))return false;
  seen.add(element);
  return !candidates.some(candidate=>candidate.element!==element&&candidate.element.contains?.(element));
 });
 await Promise.all(targets.map(({element,delay})=>playExit(element,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:400,delay,easing:'ease',fill:'forwards'})));
}
export async function fadeDialog(element,reducedMotion=false){
 if(reducedMotion||!element?.animate)return;
 await playExit(element,[{opacity:1},{opacity:0}],{duration:250,easing:'ease',fill:'forwards'});
}
