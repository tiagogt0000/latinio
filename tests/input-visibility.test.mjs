import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureInputVisible,focusInput,installInputVisibility} from '../app/input-visibility.js';

function eventTarget(){
 const listeners=new Map();
 return {
  addEventListener(name,listener){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(listener);},
  removeEventListener(name,listener){listeners.get(name)?.delete(listener);},
  fire(name,event={}){for(const listener of listeners.get(name)||[])listener(event);},
  listenerCount(){return [...listeners.values()].reduce((count,set)=>count+set.size,0);},
 };
}
function harness({height=800,offsetTop=0,top=650,bottom=705,initialInset='',visual=true}={}){
 const calls=[],frames=new Map(),timers=new Map(),properties=new Map();let nextId=0,enabled=true;
 if(initialInset)properties.set('--answer-keyboard-inset',initialInset);
 const style={getPropertyValue:key=>properties.get(key)||'',getPropertyPriority:()=>'',setProperty:(key,value)=>properties.set(key,value),removeProperty:key=>properties.delete(key)};
 const viewport=Object.assign(eventTarget(),{height,offsetTop});
 const view=Object.assign(eventTarget(),{
  innerHeight:800,...(visual?{visualViewport:viewport}:{}),
  requestAnimationFrame:callback=>{const id=++nextId;frames.set(id,callback);return id;},
  cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:callback=>{const id=++nextId;timers.set(id,callback);return id;},
  clearTimeout:id=>timers.delete(id),
  scrollBy(options){calls.push(['scroll',options]);input.rect.top-=options.top;input.rect.bottom-=options.top;},
 });
 const root=Object.assign(eventTarget(),{defaultView:view,documentElement:{style},activeElement:null});
 const input={ownerDocument:root,isConnected:true,rect:{top,bottom},getBoundingClientRect(){return {...this.rect};},matches:selector=>selector.includes('input[name="answer"]'),scrollIntoView:options=>calls.push(['nearest',options]),focus(options){root.activeElement=this;calls.push(['focus',options]);root.fire('focusin',{target:this});}};
 const dispose=installInputVisibility({root,active:()=>enabled});
 const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback());};
 return {root,view,viewport,input,calls,frames,timers,properties,dispose,flush,set active(value){enabled=value;},settle(){const pending=[...timers.values()];timers.clear();pending.forEach(callback=>callback());flush();}};
}

test('already visible fields do not scroll and focus uses preventScroll',()=>{
 const h=harness({top:250,bottom:305});
 assert.equal(ensureInputVisible(h.input),false);
 assert.equal(focusInput(h.input),true);h.flush();
 assert.deepEqual(h.calls,[['focus',{preventScroll:true}]]);
 assert.equal(focusInput(null),false);h.dispose();
});
test('visualViewport keyboard overlap scrolls only the missing distance',()=>{
 const h=harness({height:450,offsetTop:50});
 focusInput(h.input);h.flush();
 assert.deepEqual(h.calls.filter(call=>call[0]==='scroll'),[['scroll',{top:221,left:0,behavior:'instant'}]]);
 assert.equal(h.input.rect.bottom,484);
 assert.equal(h.properties.get('--answer-keyboard-inset'),'300px');
 h.dispose();assert.equal(h.properties.has('--answer-keyboard-inset'),false);
});
test('fields clipped above the visual viewport move down without jumping to page top',()=>{
 const h=harness({height:450,offsetTop:120,top:80,bottom:135});
 assert.equal(ensureInputVisible(h.input),true);
 assert.deepEqual(h.calls.at(-1),['scroll',{top:-56,left:0,behavior:'instant'}]);
 assert.equal(h.input.rect.top,136);h.dispose();
});
test('keyboard resize and viewport scrolling recheck the focused field',()=>{
 const h=harness();focusInput(h.input);h.flush();assert.equal(h.calls.some(call=>call[0]==='scroll'),false);
 h.viewport.height=420;h.viewport.fire('resize');h.flush();
 assert.equal(h.input.rect.bottom,404);assert.equal(h.properties.get('--answer-keyboard-inset'),'380px');
 h.input.rect={top:350,bottom:405};h.viewport.offsetTop=30;h.viewport.fire('scroll');h.flush();
 assert.equal(h.calls.filter(call=>call[0]==='scroll').length,1);
 h.input.rect={top:510,bottom:565};h.root.fire('input',{target:h.input});h.flush();
 assert.equal(h.input.rect.bottom,434);assert.equal(h.calls.filter(call=>call[0]==='scroll').length,2);
 h.dispose();
});
test('window resize works without visualViewport and concurrent events share one frame',()=>{
 const h=harness({visual:false});focusInput(h.input);h.flush();
 h.view.innerHeight=400;h.view.fire('resize');h.root.fire('input',{target:h.input});h.view.fire('resize');
 assert.equal(h.frames.size,1);h.flush();assert.equal(h.input.rect.bottom,384);
 assert.equal(h.properties.get('--answer-keyboard-inset'),'0px');h.dispose();
});
test('the settling recheck handles a keyboard that animates without resize events',()=>{
 const h=harness();focusInput(h.input);h.flush();h.viewport.height=500;
 h.settle();assert.equal(h.input.rect.bottom,484);assert.equal(h.timers.size,0);h.dispose();
});
test('focusout cancels pending work and restores any pre-existing keyboard inset',()=>{
 const h=harness({height:500,initialInset:'7px'});focusInput(h.input);h.flush();
 assert.equal(h.properties.get('--answer-keyboard-inset'),'300px');
 h.root.fire('input',{target:h.input});h.root.activeElement=null;h.root.fire('focusout',{target:h.input});
 assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.properties.get('--answer-keyboard-inset'),'7px');
 const count=h.calls.length;h.settle();h.flush();assert.equal(h.calls.length,count);h.dispose();
});
test('removed fields and inactive screens are never scrolled by delayed events',()=>{
 const h=harness();focusInput(h.input);h.input.isConnected=false;h.viewport.height=300;h.flush();h.settle();
 assert.equal(h.calls.some(call=>call[0]==='scroll'),false);
 h.input.isConnected=true;h.active=false;h.viewport.fire('resize');h.flush();
 assert.equal(h.calls.some(call=>call[0]==='scroll'),false);h.dispose();
});
test('disposal removes all delegated and viewport listeners and cancels timers',()=>{
 const h=harness();focusInput(h.input);assert.equal(h.frames.size,1);assert.equal(h.timers.size,1);
 h.dispose();h.dispose();
 assert.equal(h.root.listenerCount(),0);assert.equal(h.view.listenerCount(),0);assert.equal(h.viewport.listenerCount(),0);
 assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});
test('unrelated inputs are ignored and invalid geometry cannot cause scrolling',()=>{
 const h=harness();const other={matches:()=>false};h.root.activeElement=other;h.root.fire('focusin',{target:other});h.root.fire('input',{target:other});
 assert.equal(h.frames.size,0);h.input.rect={top:NaN,bottom:NaN};assert.equal(ensureInputVisible(h.input),false);
 h.input.rect={top:0,bottom:900};assert.equal(ensureInputVisible(h.input),false);h.dispose();
});
