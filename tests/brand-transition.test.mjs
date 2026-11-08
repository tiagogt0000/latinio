import test from 'node:test';
import assert from 'node:assert/strict';
import {beginSubjectTransition,SUBJECTS,subjectInfo,brandWord} from '../app/subjects.js';

function fixture({broken=false}={}){
 const calls=[],overlays=[],timers=new Map(),listeners=new Set();let now=0,nextId=0;
 const preference={matches:false,addEventListener(_type,listener){listeners.add(listener);},removeEventListener(_type,listener){listeners.delete(listener);}};
 const view={matchMedia:()=>preference,setTimeout(callback,delay){timers.set(++nextId,{callback,at:now+delay});return nextId;},clearTimeout:id=>timers.delete(id)};
 function element(name){
  return {name,animate(frames,options){
   if(broken)throw new TypeError('Animation not available');
   let finish,reject;
   const animation={cancelled:false,finished:new Promise((yes,no)=>{finish=yes;reject=no;}),finish(){finish();},cancel(){this.cancelled=true;reject();}};
   calls.push({element:this,frames,options,animation});return animation;
  }};
 }
 const doc={defaultView:view,body:{append:overlay=>overlays.push(overlay)},createElement(){
  const source=element('source'),target=element('target');
  return {...element('overlay'),attributes:new Map(),removed:false,setAttribute(name,value){this.attributes.set(name,value);},querySelector:selector=>selector==='.is-from'?source:target,remove(){this.removed=true;}};
 }};
 const root={ownerDocument:doc};
 function advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}}
 function reduce(){preference.matches=true;for(const listener of listeners)listener({matches:true});}
 return {root,calls,overlays,timers,listeners,advance,reduce};
}

test('Offered subjects contain only Latin and English; legacy metadata resolves to Latin',()=>{
 assert.deepEqual(SUBJECTS.map(subject=>subject.id),['latin','english']);
 assert.equal(subjectInfo('french').id,'latin');assert.equal(brandWord('french'),'latinio<span>✦</span>');
});

test('Switching immediately shows both logo assets and moves green left while red arrives from the right',async()=>{
 const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english');
 const overlay=f.overlays[0];assert.equal(f.overlays.length,1);assert.equal(overlay.removed,false);
 assert.equal(overlay.attributes.get('role'),'status');assert.equal(overlay.attributes.get('aria-busy'),'true');
 assert.match(overlay.innerHTML,/icon\.svg\?v=/);assert.match(overlay.innerHTML,/icon-english\.svg\?v=/);assert.match(overlay.innerHTML,/Englisch wird geladen/);
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].frames[1].transform,'translateX(-96px) scale(.94)');assert.equal(f.calls[1].frames[0].transform,'translateX(96px) scale(.94)');
 assert.ok(f.calls.every(call=>call.options.duration===220));
 let entered=false;void transition.entered.then(()=>entered=true);await Promise.resolve();assert.equal(entered,false);
 f.calls[0].animation.finish();await Promise.resolve();assert.equal(entered,false);
 f.calls[1].animation.finish();await transition.entered;assert.equal(overlay.removed,false);assert.equal(f.timers.size,0);
 transition.finish();assert.equal(f.calls.at(-1).options.duration,200);assert.equal(overlay.removed,false);
 f.calls.at(-1).animation.finish();await Promise.resolve();assert.equal(overlay.removed,true);assert.equal(f.timers.size,0);
});

test('Returning to Latin reverses the same logo path',async()=>{
 const f=fixture(),transition=beginSubjectTransition(f.root,'english','latin');
 assert.equal(f.calls[0].frames[1].transform,'translateX(96px) scale(.94)');assert.equal(f.calls[1].frames[0].transform,'translateX(-96px) scale(.94)');
 assert.match(f.overlays[0].innerHTML,/Latein wird geladen/);
 transition.dispose();await transition.entered;assert.ok(f.calls.every(call=>call.animation.cancelled));
});

test('Keyboard, reduced motion and reload-resume do not replay the logo swap or wait',async()=>{
 for(const options of [{keyboard:true},{reducedMotion:true},{resume:true}]){
  const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english',options);
  await transition.entered;assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);assert.equal(f.overlays[0].removed,false);
  transition.finish();
  if(options.resume){assert.equal(f.calls.length,1);f.calls[0].animation.finish();await Promise.resolve();}
  assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);
 }
});

test('Ready can finish before the logo movement; failures and replacement release every handle',async()=>{
 const f=fixture(),first=beginSubjectTransition(f.root,'latin','english');
 first.finish();f.calls.at(-1).animation.finish();await first.entered;
 assert.equal(f.overlays[0].removed,true);assert.ok(f.calls.slice(0,2).every(call=>call.animation.cancelled));
 const second=beginSubjectTransition(f.root,'english','latin'),third=beginSubjectTransition(f.root,'latin','english');
 await second.entered;assert.equal(f.overlays[1].removed,true);assert.equal(f.overlays[2].removed,false);
 third.fail();third.dispose();third.finish();await third.entered;
 assert.equal(f.overlays[2].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);
});

test('Switching reduced motion on cancels travel and removes the final fade immediately',async()=>{
 const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english');
 f.reduce();await transition.entered;assert.ok(f.calls.every(call=>call.animation.cancelled));assert.equal(f.overlays[0].removed,false);
 transition.finish();assert.equal(f.overlays[0].removed,true);assert.equal(f.calls.length,2);assert.equal(f.timers.size,0);
});

test('Unavailable animation APIs cannot hold loading or leave an overlay after finish',async()=>{
 const f=fixture({broken:true}),transition=beginSubjectTransition(f.root,'latin','english');
 await transition.entered;assert.equal(f.timers.size,0);transition.finish();
 assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);
});

test('A stuck animation fails open after its short bound and cleanup cannot wait forever',async()=>{
 const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english');
 f.advance(320);await transition.entered;assert.equal(f.timers.size,0);
 transition.finish();f.advance(300);assert.equal(f.overlays[0].removed,true);
 assert.ok(f.calls.every(call=>call.animation.cancelled));assert.equal(f.timers.size,0);assert.equal(f.listeners.size,0);
});
