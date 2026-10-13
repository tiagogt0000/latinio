import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSubject} from '../app/subject-entrance.js';

test('Subject entrance ignores repeated clicks and completes its exit animation before selection',async()=>{
  let finish;const listeners=[];
  const buttons=['latin','english'].map(id=>({dataset:{enterSubject:id},addEventListener:(_name,fn)=>listeners.push(fn)}));
  const content={animate:()=>({finished:new Promise(resolve=>{finish=resolve;})})};
  const root={querySelectorAll:()=>buttons,querySelector:()=>content};
  let selected=false;const result=chooseSubject(root,{reducedMotion:false}).then(x=>{selected=x;return x;});
  const first=listeners[0]();await listeners[1]();assert.equal(selected,false);assert.equal(buttons.every(b=>b.disabled),true);
  finish();await first;assert.equal(await result,'latin');
});
test('Reduced motion enters the requested subject without animation',async()=>{
  let click;const button={dataset:{enterSubject:'english'},addEventListener:(_name,fn)=>{click=fn;}};
  const root={querySelectorAll:()=>[button],querySelector:()=>({animate:()=>{throw Error('Animation must be skipped');}})};
  const result=chooseSubject(root,{reducedMotion:true});await click();assert.equal(await result,'english');
});
