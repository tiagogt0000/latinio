export async function fadeRound(root,reducedMotion=false){
 root.querySelector('input:focus')?.blur();
 if(reducedMotion)return;
 const groups=[
  ['.test-top,.test-content>.eyebrow,.test-title,.test-content>h1,.latin-word:not(.translation-card)',0],
  ['#answers,#predicate-answer-form,.test-feedback,.feedback,.test-help,.translation-card,.refresh-card-meanings',140],
  ['.test-footer,.test-content>[data-action="predicate-next"],.refresh-card-actions,.test-content>.small',280]
 ];
 const animations=groups.flatMap(([selector,delay])=>[...root.querySelectorAll(selector)].map(element=>element.animate?.([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-5px)'}],{duration:400,delay,easing:'ease',fill:'forwards'})).filter(Boolean));
 await Promise.all(animations.map(animation=>animation.finished.catch(()=>{})));
}
export async function fadeDialog(element,reducedMotion=false){
 if(reducedMotion||!element?.animate)return;
 const animation=element.animate([{opacity:1},{opacity:0}],{duration:250,easing:'ease',fill:'forwards'});
 await animation.finished.catch(()=>{});
}
