import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {arrive,settleArrival} from '../app/subject-entrance.js';

function fixture(){
 const calls=[],listeners=new Map(),windowListeners=new Map(),changes=new Set(),timers=new Map();let timerId=0;
 const preference={matches:false,addEventListener(_type,fn){changes.add(fn);},removeEventListener(_type,fn){changes.delete(fn);}};
 function events(map){return {addEventListener(type,fn){map.set(type,fn);},removeEventListener(type,fn){assert.equal(map.get(type),fn);map.delete(type);}};}
 const view={...events(windowListeners),matchMedia:()=>preference,setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}};
 const doc={...events(listeners),defaultView:view,hidden:false};
 function surface(name){return {name,isConnected:true,animate(frames,options){
  let finish,reject;const animation={cancelled:false,finished:new Promise((yes,no)=>{finish=yes;reject=no;}),cancel(){this.cancelled=true;reject();},finish(){finish();}};
  calls.push({element:this,frames,options,animation});return animation;
 }};}
 const topbar=surface('topbar'),sidebar=surface('sidebar'),heading=surface('heading'),nav=surface('inner nav'),content=surface('content');
 const cards=Array.from({length:8},(_,i)=>surface('card'+i));
 const root={ownerDocument:doc,classList:{remove(){}},querySelectorAll(selector){return selector==='.topbar, .sidebar'?[topbar,sidebar]:cards;},querySelector(selector){return selector==='.home-heading'?heading:selector==='.mobile-nav > nav'?nav:content;}};
 return {root,doc,calls,listeners,windowListeners,changes,timers,preference,cards,nav,content,topbar,
  reduce(){preference.matches=true;for(const change of [...changes])change();},
  timeout(){for(const fn of [...timers.values()])fn();}
 };
}

test('Subject arrival leaves background first, then overlapping top-to-bottom surfaces within 300 ms',()=>{
 const f=fixture();arrive(f.root);
 assert.deepEqual(f.calls.map(call=>call.options.delay),[15,15,45,75,105,120,125,125,125,125,125,125]);
 assert.ok(f.calls.every(call=>call.options.duration+call.options.delay<300));
 assert.ok(f.calls.every(call=>call.options.fill==='backwards'&&call.frames.at(-1).transform==='none'));
 assert.ok(f.calls.every(call=>!call.frames.some(frame=>'filter' in frame||'backdropFilter' in frame)));
 assert.equal(f.calls.at(-1).element,f.nav,'the inner lens enters while its fixed wrapper stays still');
 assert.ok(f.calls.every(call=>call.element!==f.content),'no parent and child entrance layers');
 settleArrival(f.root);assert.ok(f.calls.every(call=>call.animation.cancelled));
});

test('A repeated arrival cancels the previous wave; render cleanup releases all effects and listeners',()=>{
 const f=fixture();arrive(f.root);const first=[...f.calls];arrive(f.root);
 assert.ok(first.every(call=>call.animation.cancelled));
 assert.ok(f.calls.slice(first.length).every(call=>!call.animation.cancelled));
 settleArrival(f.root);
 assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);assert.equal(f.windowListeners.size,0);assert.equal(f.changes.size,0);
});

test('Background, restored pages, typing and a stalled completion all settle the whole arrival',()=>{
 for(const event of ['visibilitychange','keydown','pagehide','pageshow','timeout']){
  const f=fixture();arrive(f.root);
  if(event==='timeout')f.timeout();else (f.listeners.get(event)||f.windowListeners.get(event))();
  assert.ok(f.calls.every(call=>call.animation.cancelled),event);
  assert.equal(f.listeners.size,0);assert.equal(f.windowListeners.size,0);assert.equal(f.timers.size,0);
 }
});

test('Reduced motion removes movement and sequencing, including a preference change mid-wave',()=>{
 const f=fixture();f.preference.matches=true;arrive(f.root);
 assert.ok(f.calls.every(call=>call.options.delay===0&&call.options.duration===160));
 assert.ok(f.calls.every(call=>call.frames.every(frame=>!('transform' in frame))));
 settleArrival(f.root);f.preference.matches=false;arrive(f.root);f.reduce();
 assert.ok(f.calls.every(call=>call.animation.cancelled));assert.equal(f.changes.size,0);
});

test('Keyboard, hidden documents and missing animation support never delay or hide the screen',()=>{
 const f=fixture();arrive(f.root,{keyboard:true});assert.equal(f.calls.length,0);
 f.doc.hidden=true;arrive(f.root);assert.equal(f.calls.length,0);
 f.doc.hidden=false;f.topbar.animate=()=>{throw Error('Unavailable');};arrive(f.root);
 assert.ok(f.calls.length>0);settleArrival(f.root);
 const absent=fixture();absent.root.querySelectorAll=()=>[];absent.root.querySelector=()=>null;
 arrive(absent.root);assert.equal(absent.timers.size,0);assert.equal(absent.listeners.size,0);
});

test('Natural completion releases the arrival and its fallback timer without keeping transform effects',async()=>{
 const f=fixture();arrive(f.root);f.calls.forEach(call=>call.animation.finish());await Promise.resolve();
 assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);assert.equal(f.windowListeners.size,0);
 assert.ok(f.calls.every(call=>!call.animation.cancelled));
});

test('The bottom navigation wrapper has an explicit viewport anchor and no retained motion or filter layer',()=>{
 const css=fs.readFileSync(new URL('../app/apple-motion.css',import.meta.url),'utf8');
 const block=css.match(/#app > \.mobile-nav\s*\{([^}]+)\}/)?.[1];
 assert.match(block,/position:fixed/);assert.match(block,/inset:auto 0 var\(--mobile-nav-bottom,0px\)/);
 assert.match(block,/transform:none/);assert.match(block,/filter:none/);assert.match(block,/animation:none/);
 const legacy=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.doesNotMatch(legacy,/app-arriving|@keyframes entry-rise/);
});
