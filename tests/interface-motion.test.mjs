import test from 'node:test';
import assert from 'node:assert/strict';
import {createInterfaceMotion} from '../app/interface-motion.js';

function fixture(){
 const listeners=new Map(),changes=new Set(),calls=[],windowListeners=new Map(),viewportListeners=new Map(),frames=new Map(),navStyles=new Map(),timers=new Map();
 let frameId=0,timerId=0,now=0;
 const viewport={height:760,offsetTop:0,scale:1,addEventListener(type,fn){viewportListeners.set(type,fn);},removeEventListener(type){viewportListeners.delete(type);}};
 const nav={style:{setProperty(name,value){navStyles.set(name,value);},removeProperty(name){navStyles.delete(name);}}};
 const preference={matches:false,addEventListener(_type,listener){changes.add(listener);},removeEventListener(_type,listener){changes.delete(listener);}};
 const root={
  hidden:false,querySelector:()=>nav,getElementById:()=>app,
  defaultView:{innerHeight:800,visualViewport:viewport,matchMedia:()=>preference,
   setTimeout(callback,delay){timers.set(++timerId,{callback,at:now+delay});return timerId;},clearTimeout:id=>timers.delete(id),
   addEventListener(type,fn){windowListeners.set(type,fn);},removeEventListener(type){windowListeners.delete(type);},
   requestAnimationFrame(fn){frames.set(++frameId,fn);return frameId;},cancelAnimationFrame(id){frames.delete(id);}},
  addEventListener(type,listener){listeners.set(type,listener);},
  removeEventListener(type,listener){assert.equal(listeners.get(type),listener);listeners.delete(type);}
 };
 function element(name){
  return {name,isConnected:true,animate(frames,options){
   let finish,reject;
   const animation={cancelled:false,finished:new Promise((yes,no)=>{finish=yes;reject=no;}),cancel(){this.cancelled=true;reject();},finish(){finish();}};
   calls.push({element:this,frames,options,animation});return animation;
  }};
 }
 const cards=Array.from({length:5},(_,i)=>element('card'+i));
 const content={...element('content'),querySelectorAll:()=>cards};
 const app={querySelector:()=>content};
 const modal=element('modal'),overlay=element('overlay');
 let streak=false;
 const modalRoot={querySelector:selector=>selector==='.streak-stage'?(streak?{}:null):selector==='.modal'?modal:overlay};
 const motion=createInterfaceMotion({root});
 const click=(detail=1,target={})=>listeners.get('click')({detail,target});
 const toggle=target=>listeners.get('toggle')({target});
 const key=()=>listeners.get('keydown')({key:'Enter'});
 const reduce=value=>{preference.matches=value;for(const listener of changes)listener();};
 return {motion,calls,click,toggle,key,reduce,element,cards,content,app,modalRoot,streak(value){streak=value;},listeners,changes,viewport,navStyles,frames,windowListeners,viewportListeners,timers,
  pointerDown(){listeners.get('pointerdown')();},
  advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}},
  visibility(hidden){root.hidden=hidden;listeners.get('visibilitychange')();},
  frame(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());}
 };
}

test('Only a pointer-driven real page change moves, with direction matching navigation',()=>{
 const f=fixture();
 f.motion.screen(f.app,{from:'learn',to:'collections'});
 f.click();f.motion.screen(f.app,{from:null,to:'learn'});
 f.motion.screen(f.app,{from:'collections',to:'collections'});
 assert.equal(f.calls.length,0);
 f.motion.screen(f.app,{from:'learn',to:'collections'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].frames[0].transform,'translateX(10px)');
 f.motion.beforeRender();assert.equal(f.calls[0].animation.cancelled,true);
 f.motion.screen(f.app,{from:'settings',to:'collections'});
 assert.equal(f.calls[1].frames[0].transform,'translateX(-10px)');
 f.motion.beforeRender();f.click(0);f.motion.screen(f.app,{from:'collections',to:'settings'});
 assert.equal(f.calls.length,2);f.motion.dispose();
});

test('Collection detail enters from the collection and goes back in the opposite direction',()=>{
 const f=fixture();f.click();
 f.motion.screen(f.app,{from:'collections',to:'collection-detail'});
 f.motion.beforeRender();f.motion.screen(f.app,{from:'collection-detail',to:'collections'});
 assert.equal(f.calls[0].frames[0].transform,'translateX(10px)');
 assert.equal(f.calls[1].frames[0].transform,'translateX(-10px)');f.motion.dispose();
});

test('Home uses one compressed card wave, keeps the parent still and never replays on refetch',()=>{
 const f=fixture();f.click();f.motion.screen(f.app,{from:'collections',to:'learn'});
 assert.equal(f.calls.length,5);assert.deepEqual(f.calls.map(call=>call.options.delay),[0,35,60,75,75]);
 assert.ok(f.calls.every(call=>call.element!==f.content&&call.frames[0].opacity>0));
 assert.ok(f.calls.every(call=>call.options.delay+call.options.duration<300));
 f.motion.beforeRender();f.motion.screen(f.app,{from:'learn',to:'learn'});
 assert.equal(f.calls.length,5);assert.ok(f.calls.every(call=>call.animation.cancelled));f.motion.dispose();
});

test('Typing settles active entrances and prevents delayed actions from moving the next view',()=>{
 const f=fixture();f.click();f.motion.screen(f.app,{from:'collections',to:'learn'});
 f.key();assert.ok(f.calls.every(call=>call.animation.cancelled));
 f.motion.screen(f.app,{from:'learn',to:'settings'});f.motion.openModal(f.modalRoot);
 assert.equal(f.calls.length,5);f.motion.dispose();
});

function details(f,menu=false){
 const surface=f.element('details surface');
 const panel={open:false,isConnected:true,matches:selector=>selector.includes(',')||menu,querySelector:()=>surface,contains:el=>el===surface};
 const target={closest:()=>({parentElement:panel})};
 return {panel,target,surface};
}

test('Restored details stay still; native pointer opening reveals the content and closing cancels it',()=>{
 const f=fixture(),d=details(f);
 d.panel.open=true;f.toggle(d.panel);assert.equal(f.calls.length,0);
 d.panel.open=false;f.click(1,d.target);d.panel.open=true;f.toggle(d.panel);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].element,d.surface);assert.equal(f.calls[0].options.duration,160);
 f.click(1,d.target);d.panel.open=false;f.toggle(d.panel);
 assert.equal(f.calls[0].animation.cancelled,true);assert.equal(f.calls.length,1);
 f.click(0,d.target);d.panel.open=true;f.toggle(d.panel);assert.equal(f.calls.length,1);f.motion.dispose();
});

test('The subject menu enters together from its trigger and a removed menu never animates',()=>{
 const f=fixture(),d=details(f,true);
 f.click(1,d.target);d.panel.open=true;f.toggle(d.panel);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].frames[0].transform,'translateY(-4px) scale(.96)');
 f.motion.beforeRender();d.panel.open=false;f.click(1,d.target);d.panel.open=true;d.panel.isConnected=false;f.toggle(d.panel);
 assert.equal(f.calls.length,1);f.motion.dispose();
});

test('A dialog has one moving surface, closes immediately and never animates the streak stage',()=>{
 const f=fixture();f.click();f.motion.openModal(f.modalRoot);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].element.name,'modal');
 f.motion.openModal(f.modalRoot);assert.equal(f.calls[0].animation.cancelled,true);
 f.motion.closeModal();assert.equal(f.calls[1].animation.cancelled,true);
 f.streak(true);f.motion.openModal(f.modalRoot);assert.equal(f.calls.length,2);
 f.streak(false);f.click(0);f.motion.openModal(f.modalRoot);assert.equal(f.calls.length,2);f.motion.dispose();
});

test('Reduced motion is static, including when changed mid-animation; disposing removes all listeners',()=>{
 const f=fixture();f.reduce(true);f.click();f.motion.screen(f.app,{from:'settings',to:'learn'});f.motion.openModal(f.modalRoot);
 const d=details(f,true);f.click(1,d.target);d.panel.open=true;f.toggle(d.panel);assert.equal(f.calls.length,0);
 f.reduce(false);f.click();f.motion.screen(f.app,{from:'learn',to:'settings'});assert.equal(f.calls.length,1);
 f.reduce(true);assert.equal(f.calls[0].animation.cancelled,true);
 f.motion.dispose();assert.equal(f.listeners.size,0);assert.equal(f.changes.size,0);
});

test('Completed animation handles are released instead of being cancelled on every subsequent render',async()=>{
 const f=fixture();f.click();f.motion.screen(f.app,{from:'learn',to:'collections'});
 f.calls[0].animation.finish();await Promise.resolve();f.motion.beforeRender();
 assert.equal(f.calls[0].animation.cancelled,false);f.motion.dispose();
});

test('An animation API failure cannot stop rendering, modal opening or cleanup',()=>{
 const f=fixture();f.click();
 f.content.animate=()=>{throw new TypeError('Animation unavailable');};
 assert.doesNotThrow(()=>f.motion.screen(f.app,{from:'learn',to:'collections'}));
 const modal=f.modalRoot.querySelector('.modal');modal.animate=f.content.animate;
 assert.doesNotThrow(()=>f.motion.openModal(f.modalRoot));
 f.motion.screen(f.app,{from:'collections',to:'learn'});
 for(const call of f.calls)call.animation.cancel=()=>{throw new Error('Already disposed');};
 assert.doesNotThrow(()=>f.motion.beforeRender());assert.doesNotThrow(()=>f.motion.dispose());
});
test('Restoring a backgrounded app settles suspended motion and anchors navigation to the visible viewport',()=>{
 const f=fixture();f.click();f.motion.screen(f.app,{from:'learn',to:'collections'});
 assert.equal(f.navStyles.get('--mobile-nav-bottom'),'40px');
 f.viewport.height=620;f.viewport.offsetTop=25;
 f.viewportListeners.get('resize')();f.viewportListeners.get('scroll')();
 assert.equal(f.frames.size,1,'viewport events are coalesced');
 f.visibility(true);
 assert.equal(f.frames.size,0);assert.equal(f.calls[0].animation.cancelled,true);
 f.viewport.height=740;f.viewport.offsetTop=0;
 f.visibility(false);f.windowListeners.get('pageshow')({persisted:true});f.frame();
 assert.equal(f.navStyles.get('--mobile-nav-bottom'),'60px');
 f.motion.screen(f.app,{from:'collections',to:'settings'});
 assert.equal(f.calls.length,1,'resume cannot replay the last pointer action');
 f.viewport.height=780;f.viewportListeners.get('scroll')();f.frame();
 assert.equal(f.navStyles.get('--mobile-nav-bottom'),'20px');
 f.motion.dispose();assert.equal(f.navStyles.size,0);assert.equal(f.windowListeners.size,0);assert.equal(f.viewportListeners.size,0);
});
test('Page hide cancels pending viewport work; pinch zoom and overscroll never push navigation off screen',()=>{
 const f=fixture();f.windowListeners.get('resize')();assert.equal(f.frames.size,1);
 f.windowListeners.get('pagehide')();assert.equal(f.frames.size,0);
 f.viewport.scale=2;f.windowListeners.get('pageshow')();f.frame();
 assert.equal(f.navStyles.get('--mobile-nav-bottom'),'0px');
 f.viewport.scale=1;f.viewport.height=850;f.viewportListeners.get('resize')();f.frame();
 assert.equal(f.navStyles.get('--mobile-nav-bottom'),'0px');f.motion.dispose();
});

function training(f,{refresh=false}={}){
 const elements=new Map(),surfaces=new Map();
 const surface=(selector,...names)=>surfaces.set(selector,names.map(name=>{const element=f.element(name);elements.set(name,element);return element;}));
 surface(':scope > .test-top','top');surface('.test-content > .eyebrow','eyebrow');
 if(refresh){
  surface('.test-content > h1','title');surface('.test-content > h1 + p','intro');surface('.test-content > .refresh-card','refresh-card');
  surface('.refresh-card + p','swipe-hint');surface('.refresh-card-actions > button','wrong','known');surface('.refresh-card-actions + p','note');
 }else{
  surface('.test-content > .test-title','title');surface('.test-content > .latin-word','prompt');surface('.test-content > .test-help','hint');
  surface('#answer-form > #answers','answers');surface('#answer-form > .add-answer','add-answer');surface('.test-footer > button','dont-know','submit');
 }
 const shell={name:'test-shell',querySelectorAll:selector=>selector.split(', ').flatMap(part=>surfaces.get(part)||[])};
 const container={querySelector:selector=>selector==='.test-shell'?shell:null};
 return {container,elements};
}
test('Entering a vocabulary round reveals separate surfaces in reading order within 640 ms',()=>{
 const f=fixture(),view=training(f);f.click();f.motion.screen(view.container,{from:'learn',to:'test'});
 assert.deepEqual(f.calls.map(call=>call.element.name),['top','eyebrow','title','prompt','hint','answers','add-answer','dont-know','submit']);
 assert.deepEqual(f.calls.map(call=>call.options.delay),[0,60,60,120,150,180,210,240,240]);
 assert.equal(Math.max(...f.calls.map(call=>call.options.duration+call.options.delay)),640);
 assert.ok(f.calls.every(call=>call.frames[0].opacity===0&&call.frames[1].opacity===1));
 assert.ok(f.calls.every(call=>call.frames[0].transform.includes('scale(.98)')&&call.frames[1].transform==='none'));
 assert.ok(f.calls.every(call=>call.options.easing==='cubic-bezier(0.32,0.72,0,1)'&&call.options.fill==='backwards'));
 assert.equal(f.navStyles.get('--mobile-nav-bottom'),'40px');
 f.motion.dispose();assert.equal(f.timers.size,0);
});
test('Answer checking, next words and cloud renders never replay the vocabulary entry wave',()=>{
 const f=fixture(),view=training(f);f.click();f.motion.screen(view.container,{from:'learn',to:'test'});
 const count=f.calls.length;f.motion.beforeRender();f.click();
 for(let i=0;i<3;i++)f.motion.screen(view.container,{from:'test',to:'test'});
 assert.equal(f.calls.length,count);assert.ok(f.calls.every(call=>call.animation.cancelled));assert.equal(f.timers.size,0);f.motion.dispose();
});
test('Refresh round entry fades the swipable card without taking ownership of its transform',()=>{
 const f=fixture(),view=training(f,{refresh:true});f.click();f.motion.screen(view.container,{from:'learn',to:'test'});
 assert.deepEqual(f.calls.map(call=>call.element.name),['top','eyebrow','title','intro','refresh-card','swipe-hint','wrong','known','note']);
 const card=f.calls.find(call=>call.element.name==='refresh-card');assert.deepEqual(card.frames,[{opacity:0},{opacity:1}]);
 assert.equal(f.calls.filter(call=>call.element===card.element).length,1,'the nested prompt must not receive a second entry effect');
 f.pointerDown();assert.ok(f.calls.every(call=>call.animation.cancelled));assert.equal(f.timers.size,0,'touching the card immediately releases all entry effects');
 f.motion.dispose();
});
test('Training starts remain static for keyboard input, reduced motion, hidden pages and initial render',()=>{
 for(const mode of ['keyboard','reduced','hidden','initial']){
  const f=fixture(),view=training(f);f.click(mode==='keyboard'?0:1);
  if(mode==='reduced')f.reduce(true);if(mode==='hidden')f.visibility(true);
  f.motion.screen(view.container,{from:mode==='initial'?null:'learn',to:'test'});
  assert.equal(f.calls.length,0,mode);assert.equal(f.timers.size,0);f.motion.dispose();
 }
});
test('Typing and lifecycle changes immediately settle training without waiting for the wave',()=>{
 for(const event of ['keyboard','hidden','pagehide','pageshow','reduced']){
  const f=fixture(),view=training(f);f.click();f.motion.screen(view.container,{from:'learn',to:'test'});
  if(event==='keyboard')f.key();else if(event==='hidden')f.visibility(true);else if(event==='reduced')f.reduce(true);else f.windowListeners.get(event)({persisted:true});
  assert.ok(f.calls.every(call=>call.animation.cancelled),event);assert.equal(f.timers.size,0,event);f.motion.dispose();
 }
});
test('Training completion clears finite fallbacks; suspended or failing animations cannot remain active',async()=>{
 const f=fixture(),view=training(f);f.click();f.motion.screen(view.container,{from:'learn',to:'test'});
 assert.equal(f.timers.size,f.calls.length);
 f.calls.forEach(call=>call.animation.finish());await Promise.resolve();assert.equal(f.timers.size,0);
 f.motion.beforeRender();assert.ok(f.calls.every(call=>!call.animation.cancelled),'normally completed effects are released once');f.motion.dispose();
 const stalled=fixture(),stalledView=training(stalled);stalled.click();stalled.motion.screen(stalledView.container,{from:'learn',to:'test'});
 stalled.advance(760);assert.ok(stalled.calls.every(call=>call.animation.cancelled));assert.equal(stalled.timers.size,0);stalled.motion.dispose();
 const broken=fixture(),brokenView=training(broken);for(const element of brokenView.elements.values())element.animate=()=>{throw Error('Unavailable');};broken.click();
 assert.doesNotThrow(()=>broken.motion.screen(brokenView.container,{from:'learn',to:'test'}));assert.equal(broken.timers.size,0);broken.motion.dispose();
});
