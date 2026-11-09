import {settleArrival} from './subject-entrance.js';
const PAGE_ORDER=['learn','collections','classroom','admin','settings'];
const pageGroup=screen=>['collection-detail','predicate-detail'].includes(screen)?'collections':['tables','grammar'].includes(screen)?'learn':screen;

// Presentation only: native controls, routing, focus and learning never wait for motion.
export function createInterfaceMotion({root=globalThis.document}={}){
 const view=root.defaultView||globalThis;
 const preference=view.matchMedia?.('(prefers-reduced-motion: reduce)');
 const style=view.getComputedStyle?.(root.documentElement);
 const easing=style?.getPropertyValue('--ease-out').trim()||'cubic-bezier(0.23,1,0.32,1)';
 const drawer=style?.getPropertyValue('--ease-drawer').trim()||'cubic-bezier(0.32,0.72,0,1)';
 const enter=parseFloat(style?.getPropertyValue('--apple-enter'))||220;
 const fast=parseFloat(style?.getPropertyValue('--apple-fast'))||160;
 const active=new Set(),detailsIntent=new WeakMap();
 const viewport=view.visualViewport;
 let pointerActivation=false,viewportFrame=null,lastNav,lastInset;
 function syncViewport(){
  if(root.hidden)return;
  const nav=root.querySelector?.('#app > .mobile-nav');
  if(!nav?.style)return;
  // WebKit may restore a visual viewport that differs from the layout viewport
  // after a keyboard or app switch. Anchor the bar to its visible bottom edge.
  const inset=viewport&&(!viewport.scale||viewport.scale===1)
   ?Math.max(0,(view.innerHeight||0)-viewport.height-viewport.offsetTop):0;
  const value=`${Number.isFinite(inset)?Math.round(inset):0}px`;
  if(lastNav!==nav||lastInset!==value){nav.style.setProperty('--mobile-nav-bottom',value);lastNav=nav;lastInset=value;}
 }
 function scheduleViewport(){
  if(root.hidden||viewportFrame!==null)return;
  if(view.requestAnimationFrame)viewportFrame=view.requestAnimationFrame(()=>{viewportFrame=null;syncViewport();});else syncViewport();
 }
 function cancelViewport(){
  if(viewportFrame!==null)view.cancelAnimationFrame?.(viewportFrame);
  viewportFrame=null;
 }

 function stop(item){
  active.delete(item);
  if(item.timer!==undefined)view.clearTimeout(item.timer);
  try{item.animation.cancel();}catch{/* Optional motion must never block an interaction. */}
 }
 function cancel(kind){
  for(const item of active){
   if(kind&&item.kind!==kind)continue;
   stop(item);
  }
 }
 function animate(element,frames,{kind,duration=enter,delay=0,curve=easing,bounded=false}={}){
  if(!element?.animate||element.isConnected===false||!pointerActivation||preference?.matches)return;
  let item;
  try{
   const animation=element.animate(frames,{duration,delay,easing:curve,fill:'backwards'});
   item={animation,element,kind};active.add(item);
   const release=()=>{active.delete(item);if(item.timer!==undefined)view.clearTimeout(item.timer);};
   animation.finished.then(release,release);
   if(bounded)item.timer=view.setTimeout(()=>stop(item),delay+duration+120);
  }catch{if(item)stop(item);}
 }
 function trainingEntrance(container){
  const shell=container.querySelector('.test-shell');
  if(!shell||root.hidden)return;
  const reveal=(selector,delay,duration=400,distance=6)=>{
   shell.querySelectorAll(selector).forEach(element=>animate(element,distance===null?[{opacity:0},{opacity:1}]:[
    {opacity:0,transform:`translateY(${distance}px) scale(.98)`},
    {opacity:1,transform:'none'}
   ],{kind:'training',delay,duration,curve:drawer,bounded:true}));
  };
  // One wave on round entry; the shell, form and footer positioning never move.
  reveal(':scope > .test-top',0,500,8);
  reveal('.test-content > .eyebrow, .test-content > .test-title, .test-content > h1',60,520,8);
  reveal('.test-content > h1 + p',90);
  reveal('.test-content > .latin-word',120);
  // The card's transform belongs to its swipe interaction.
  reveal('.test-content > .refresh-card',120,400,null);
  reveal('.test-content > .test-help',150);
  reveal('#answer-form > #answers, .refresh-card + p',180);
  reveal('#answer-form > .add-answer, .refresh-card-actions > button',210);
  reveal('.test-footer > button, .refresh-card-actions + p',240,400,4);
 }
 function pointerDown(){cancel('training');}
 function click(event){
  pointerActivation=event.detail>0;
  if(!pointerActivation)cancel();
  const summary=event.target.closest?.('summary');
  const details=summary?.parentElement;
  if(!details?.matches('.subject-dropdown, .deck-picker'))return;
  detailsIntent.set(details,pointerActivation&&!details.open);
  for(const item of active)if(details.contains(item.element))stop(item);
 }
 function keyboard(){pointerActivation=false;cancel();}
 function toggle(event){
  const details=event.target,requested=detailsIntent.get(details);
  detailsIntent.delete(details);
  if(!requested||!details.open||!details.isConnected)return;
  const menu=details.matches('.subject-dropdown');
  const surface=details.querySelector(menu?':scope > .subject-options':':scope > .bounded-list');
  animate(surface,[
   {opacity:0,transform:menu?'translateY(-4px) scale(.96)':'translateY(-4px)'},
   {opacity:1,transform:'none'}
  ],{kind:'details',duration:menu?enter:fast});
 }
 function preferenceChanged(){if(preference.matches){pointerActivation=false;cancel();}}
 function suspend(){
  pointerActivation=false;cancel();cancelViewport();
  settleArrival(root.getElementById?.('app'));
 }
 function resume(){suspend();lastNav=null;scheduleViewport();}
 function visibilityChanged(){suspend();if(!root.hidden)scheduleViewport();}
 root.addEventListener('click',click,true);
 root.addEventListener('pointerdown',pointerDown,true);
 root.addEventListener('keydown',keyboard,true);
 root.addEventListener('toggle',toggle,true);
 root.addEventListener('visibilitychange',visibilityChanged);
 view.addEventListener?.('pagehide',suspend);
 view.addEventListener?.('pageshow',resume);
 view.addEventListener?.('resize',scheduleViewport);
 view.addEventListener?.('scroll',scheduleViewport,{passive:true});
 viewport?.addEventListener?.('resize',scheduleViewport);
 viewport?.addEventListener?.('scroll',scheduleViewport);
 preference?.addEventListener?.('change',preferenceChanged);

 return {
  beforeRender(){cancel('page');cancel('details');cancel('training');settleArrival(root.getElementById?.('app'));},
  screen(container,{from,to}){
   syncViewport();
   if(from===null||from===to||!pointerActivation||preference?.matches)return;
   if(to==='test'){trainingEntrance(container);return;}
   const content=container.querySelector('.content');
   if(!content)return;
   if(to==='learn'){
    // Reading order is a short overlapping wave; chrome and the heading stay still.
    const delays=[0,35,60,75];
    content.querySelectorAll('.home-practice-grid > .training-card').forEach((card,index)=>{
     animate(card,[{opacity:index ? .7 : .55,transform:`translateY(${index?6:10}px)`},{opacity:1,transform:'none'}],{kind:'page',delay:delays[Math.min(index,delays.length-1)]});
    });
    return;
   }
   const start=PAGE_ORDER.indexOf(pageGroup(from)),end=PAGE_ORDER.indexOf(pageGroup(to));
   const direction=(start>=0&&end>=0?Math.sign(end-start):0)||(to.endsWith('-detail')?1:from.endsWith('-detail')?-1:0);
   const transform=direction?`translateX(${direction*10}px)`:`translateY(${to.endsWith('-detail')?8:5}px)`;
   animate(content,[{opacity:.5,transform},{opacity:1,transform:'none'}],{kind:'page'});
  },
  openModal(container){
   cancel('modal');
   if(container.querySelector('.streak-stage'))return;
   animate(container.querySelector('.modal'),[{opacity:0,transform:'translateY(8px) scale(.97)'},{opacity:1,transform:'none'}],{kind:'modal'});
  },
  closeModal(){cancel('modal');},
  dispose(){
   suspend();root.querySelector?.('#app > .mobile-nav')?.style?.removeProperty('--mobile-nav-bottom');
   cancel();root.removeEventListener('click',click,true);root.removeEventListener('pointerdown',pointerDown,true);root.removeEventListener('keydown',keyboard,true);root.removeEventListener('toggle',toggle,true);
   root.removeEventListener('visibilitychange',visibilityChanged);
   view.removeEventListener?.('pagehide',suspend);view.removeEventListener?.('pageshow',resume);view.removeEventListener?.('resize',scheduleViewport);view.removeEventListener?.('scroll',scheduleViewport);
   viewport?.removeEventListener?.('resize',scheduleViewport);viewport?.removeEventListener?.('scroll',scheduleViewport);
   preference?.removeEventListener?.('change',preferenceChanged);
  }
 };
}
