import test from 'node:test';
import assert from 'node:assert/strict';
import {streakDemo,mountStreakDemo} from '../app/streak-demo.js';

function fixture(options={}){
 class Element extends EventTarget{
  constructor(){super();this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.attrs={};this.dataset={};}
  setAttribute(key,value){this.attrs[key]=value;}
  removeAttribute(key){delete this.attrs[key];}
  focus(){this.focused=true;}
  blur(){this.focused=false;}
 }
 const selectors=['[data-streak-form]','#streak-test-answer','#streak-answer-error','.streak-question','.streak-celebration','.streak-finish-controls','[data-streak-status]','.streak-caption'];
 const elements=Object.fromEntries(selectors.map(selector=>[selector,new Element()]));
 const stage=new Element();stage.dataset={phase:'question',day:'30'};stage.querySelector=selector=>elements[selector];
 const form=elements['[data-streak-form]'],input=elements['#streak-test-answer'],submit=new Element();
 form.querySelector=()=>submit;
 const controls=elements['.streak-finish-controls'],celebration=elements['.streak-celebration'];
 controls.hidden=true;celebration.hidden=true;const buttons=[new Element(),new Element()];buttons.forEach(button=>button.disabled=true);controls.querySelectorAll=()=>buttons;
 elements['.streak-caption'].textContent='Dein Feuer wächst.';
 let time=0,id=0,started=0;const timers=new Map();
 const dispose=mountStreakDemo(stage,{schedule:(fn,delay)=>{timers.set(++id,{at:time+delay,fn});return id;},cancel:id=>timers.delete(id),onStart:()=>started++,...options});
 function tick(ms){const end=time+ms;for(;;){const next=[...timers].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;}
 function answer(value){input.value=value;const event=new Event('submit',{bubbles:true,cancelable:true});form.dispatchEvent(event);assert.equal(event.defaultPrevented,true);}
 return {stage,elements,form,input,submit,controls,celebration,buttons,timers,dispose,tick,answer,get started(){return started;}};
}

test('empty or wrong demo answers keep the question visible and do not schedule a celebration',()=>{
 const demo=fixture();demo.answer('');demo.answer('wrong');demo.tick(10000);
 assert.equal(demo.stage.dataset.phase,'question');assert.equal(demo.celebration.hidden,true);assert.equal(demo.timers.size,0);
 assert.equal(demo.input.attrs['aria-invalid'],'true');assert.match(demo.elements['#streak-answer-error'].textContent,/Test/);
 demo.input.dispatchEvent(new Event('input'));assert.equal(demo.input.attrs['aria-invalid'],undefined);demo.dispose();
});

test('Test dismisses input, exits in stages, leaves an empty frame, then reveals and enables replay',()=>{
 const demo=fixture();demo.answer(' Test ');
 assert.equal(demo.stage.dataset.phase,'leaving');assert.equal(demo.input.focused,false);assert.equal(demo.submit.disabled,true);assert.equal(demo.started,1);
 demo.answer('Test');assert.equal(demo.started,1,'double submit cannot start a second timeline');
 demo.tick(919);assert.equal(demo.elements['.streak-question'].hidden,false);assert.equal(demo.celebration.hidden,true);
 demo.tick(1);assert.equal(demo.stage.dataset.phase,'blank');assert.equal(demo.elements['.streak-question'].hidden,true);assert.equal(demo.celebration.hidden,true);
 demo.tick(280);assert.equal(demo.stage.dataset.phase,'celebrate');assert.equal(demo.celebration.hidden,false);assert.equal(demo.controls.hidden,true);
 demo.tick(4200);assert.equal(demo.controls.hidden,false);assert.ok(demo.buttons.every(button=>!button.disabled));
 assert.match(demo.elements['[data-streak-status]'].textContent,/Tag 30/);assert.equal(demo.timers.size,0);demo.dispose();
});

test('closing during either exit or celebration cancels all callbacks and detaches submission',()=>{
 for(const elapsed of [0,500,1000,2000]){
  const demo=fixture();demo.answer('Test');demo.tick(elapsed);const phase=demo.stage.dataset.phase;
  demo.dispose();demo.dispose();assert.equal(demo.timers.size,0);demo.tick(10000);
  assert.equal(demo.stage.dataset.phase,phase);assert.equal(demo.controls.hidden,true);
  const event=new Event('submit',{cancelable:true});demo.form.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
 }
});

test('replaying has its own question and old timers cannot change the new preview',()=>{
 const first=fixture();first.answer('Test');first.tick(1300);first.dispose();
 const replay=fixture();first.tick(10000);assert.equal(replay.stage.dataset.phase,'question');assert.equal(replay.input.disabled,false);
 replay.answer('test');replay.tick(5400);assert.equal(replay.controls.hidden,false);replay.dispose();
});

test('reduced motion preserves the same interaction without the long animated wait',()=>{
 const demo=fixture({reducedMotion:true});assert.equal(demo.stage.dataset.reducedMotion,'true');demo.answer('Test');demo.tick(100);
 assert.equal(demo.stage.dataset.phase,'blank');demo.tick(120);assert.equal(demo.stage.dataset.phase,'celebrate');demo.tick(100);
 assert.equal(demo.controls.hidden,false);demo.dispose();
});

test('all demo combinations start at a question; theme and day values cannot inject markup',()=>{
 for(const day of [1,2,3,7,30,100])for(const variant of ['orbit','wave','impact'])for(const theme of ['auto','light','dark']){
  const html=streakDemo(day,variant,theme);
  assert.match(html,/data-phase="question"/);assert.match(html,/data-streak-form novalidate/);
  assert.ok(html.includes(`data-theme="${theme}"`));assert.ok(html.includes(`data-day="${day}"`));
  assert.match(html,/class="streak-celebration" hidden aria-hidden="true"/);
 }
 const html=streakDemo('<script>','<script>','<script>');assert.ok(!html.includes('<script>'));assert.match(html,/data-day="1"/);assert.match(html,/data-variant="orbit"/);assert.match(html,/data-theme="auto"/);
});
