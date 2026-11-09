import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSubject,arrive,subjectChoiceUsesKeyboard} from '../app/subject-entrance.js';

test('Subject entrance ignores repeated clicks and completes its exit animation before selection',async()=>{
  let finish;const listeners=[];
  const buttons=['latin','english'].map(id=>({dataset:{enterSubject:id},addEventListener:(_name,fn)=>listeners.push(fn)}));
  const content={animate:()=>({finished:new Promise(resolve=>{finish=resolve;})})};
  const root={querySelectorAll:()=>buttons,querySelector:()=>content};
  assert.equal(subjectChoiceUsesKeyboard(root),false,'an unselected picker has no keyboard navigation override');
  let selected=false;const result=chooseSubject(root,{reducedMotion:false}).then(x=>{selected=x;return x;});
  const first=listeners[0]({detail:1});await listeners[1]({detail:0});assert.equal(selected,false);assert.equal(buttons.every(b=>b.disabled),true);
  assert.equal(subjectChoiceUsesKeyboard(root),false,'a repeated keyboard click cannot change the original pointer selection');
  finish();await first;assert.equal(await result,'latin');
});
test('Reduced motion enters the requested subject without animation',async()=>{
  let click;const button={dataset:{enterSubject:'english'},addEventListener:(_name,fn)=>{click=fn;}};
  const root={querySelectorAll:()=>[button],querySelector:()=>({animate:()=>{throw Error('Animation must be skipped');}})};
  const result=chooseSubject(root,{reducedMotion:true});await click({detail:1});assert.equal(await result,'english');
  assert.equal(subjectChoiceUsesKeyboard(root),false,'reduced motion does not misclassify pointer input');
});

test('Keyboard subject selection has no animation or waiting period',async()=>{
 let click;const button={dataset:{enterSubject:'latin'},addEventListener:(_name,fn)=>{click=fn;}};
 const root={querySelectorAll:()=>[button],querySelector:()=>({animate:()=>{throw Error('Keyboard selection must be immediate');}})};
 const result=chooseSubject(root,{reducedMotion:false});await click({detail:0});assert.equal(await result,'latin');
 assert.equal(subjectChoiceUsesKeyboard(root),true,'the written intro receives the same immediate keyboard choice');
 assert.doesNotThrow(()=>arrive(root),'the resulting screen retains immediate keyboard navigation');
});

test('A browser animation exception cannot leave the subject selection disabled forever',async()=>{
 let click;const button={dataset:{enterSubject:'english'},addEventListener:(_name,fn)=>{click=fn;}};
 const root={querySelectorAll:()=>[button],querySelector:()=>({animate(){throw Error('Unavailable animation implementation');}})};
 const result=chooseSubject(root,{reducedMotion:false});await click({detail:1});assert.equal(await result,'english');
});
function exitFixture(){
 const events=new Map(),windowEvents=new Map(),changes=new Map(),timers=new Map(),calls=[];let click,finish,reject,timerId=0;
 const handlers=map=>({addEventListener(type,fn){map.set(type,fn);},removeEventListener(type,fn){assert.equal(map.get(type),fn);map.delete(type);}});
 const preference={matches:false,...handlers(changes)};
 const view={...handlers(windowEvents),matchMedia:()=>preference,setTimeout(fn,ms){calls.push({timeout:ms});timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}};
 const doc={hidden:false,defaultView:view,...handlers(events)};
 const animation={cancelled:false,finished:new Promise((resolve,no)=>{finish=resolve;reject=no;}),cancel(){this.cancelled=true;reject();}};
 const content={style:{},animate(frames,options){calls.push({frames,options});return animation;}};
 const button={dataset:{enterSubject:'french'},addEventListener(_type,fn){click=fn;}};
 const root={ownerDocument:doc,querySelectorAll:()=>[button],querySelector:()=>content};
 return {root,content,doc,calls,timers,events,windowEvents,changes,animation,finish,click:event=>click(event)};
}
test('The picker has a perceptible soft exit and remains invisible until the next screen renders',async()=>{
 const f=exitFixture();const result=chooseSubject(f.root);const selection=f.click({detail:1});
 const motion=f.calls.find(call=>call.frames);
 assert.equal(motion.options.duration,440);assert.equal(motion.options.fill,'forwards');
 assert.equal(f.calls.find(call=>call.timeout).timeout,560);
 assert.equal(motion.options.easing,'cubic-bezier(0.32,0.72,0,1)');
 assert.equal(motion.frames[0].opacity,1);assert.equal(motion.frames.at(-1).opacity,0);
 assert.ok(motion.frames.every(frame=>!('filter' in frame)&&!('backdropFilter' in frame)));
 assert.equal(f.content.style.opacity,'1');assert.equal(f.content.style.animation,'none');
 f.finish();await selection;assert.equal(await result,'french');
 assert.equal(f.content.style.opacity,'0','outgoing choices cannot flash while account data opens');
 assert.equal(f.animation.cancelled,true,'the hidden picker retains no animated transform');
 assert.equal(f.events.size,0);assert.equal(f.windowEvents.size,0);assert.equal(f.changes.size,0);assert.equal(f.timers.size,0);
});
test('A quick selection continues from the partially visible CSS entrance and cannot reveal it again',async()=>{
 const f=exitFixture(),currentTransform='matrix(0.985, 0, 0, 0.985, 0, 5)';
 f.doc.defaultView.getComputedStyle=element=>element===f.content?{opacity:'0.42',transform:currentTransform}:{getPropertyValue:()=>''};
 const animate=f.content.animate;
 f.content.animate=function(frames,options){
  assert.equal(this.style.animation,'none','the CSS entrance is disabled before the exit starts');
  assert.equal(this.style.opacity,'0.42');assert.equal(this.style.transform,currentTransform);
  return animate(frames,options);
 };
 const result=chooseSubject(f.root);const selection=f.click({detail:1});
 assert.deepEqual(f.calls.find(call=>call.frames).frames[0],{opacity:0.42,transform:currentTransform});
 f.finish();await selection;assert.equal(await result,'french');
 assert.equal(f.content.style.opacity,'0');assert.equal(f.content.style.transform,'');
 assert.equal(f.content.style.animation,'none','the previous CSS effect cannot override the invisible state');
 assert.equal(f.animation.cancelled,true);assert.equal(f.timers.size,0);
});
test('Picker exit survives backgrounding, typing, motion preference changes and a suspended animation',async()=>{
 for(const event of ['visibilitychange','keydown','pagehide','pageshow','change','timeout']){
  const f=exitFixture();const result=chooseSubject(f.root);const selection=f.click({detail:1});
  if(event==='timeout'){for(const fn of [...f.timers.values()])fn();}
  else (f.events.get(event)||f.windowEvents.get(event)||f.changes.get(event))();
  await selection;assert.equal(await result,'french',event);assert.equal(f.content.style.opacity,'0',event);
  assert.equal(f.events.size,0);assert.equal(f.windowEvents.size,0);assert.equal(f.changes.size,0);assert.equal(f.timers.size,0);
 }
});
test('A hidden document skips the picker exit instead of waiting for a suspended animation',async()=>{
 const f=exitFixture();f.doc.hidden=true;const result=chooseSubject(f.root);await f.click({detail:1});
 assert.equal(await result,'french');assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);
});
