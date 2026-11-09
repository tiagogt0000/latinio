import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSubject,arrive} from '../app/subject-entrance.js';

test('Subject entrance ignores repeated clicks and completes its exit animation before selection',async()=>{
  let finish;const listeners=[];
  const buttons=['latin','english'].map(id=>({dataset:{enterSubject:id},addEventListener:(_name,fn)=>listeners.push(fn)}));
  const content={animate:()=>({finished:new Promise(resolve=>{finish=resolve;})})};
  const root={querySelectorAll:()=>buttons,querySelector:()=>content};
  let selected=false;const result=chooseSubject(root,{reducedMotion:false}).then(x=>{selected=x;return x;});
  const first=listeners[0]({detail:1});await listeners[1]({detail:1});assert.equal(selected,false);assert.equal(buttons.every(b=>b.disabled),true);
  finish();await first;assert.equal(await result,'latin');
});
test('Reduced motion enters the requested subject without animation',async()=>{
  let click;const button={dataset:{enterSubject:'english'},addEventListener:(_name,fn)=>{click=fn;}};
  const root={querySelectorAll:()=>[button],querySelector:()=>({animate:()=>{throw Error('Animation must be skipped');}})};
  const result=chooseSubject(root,{reducedMotion:true});await click({detail:1});assert.equal(await result,'english');
});

test('Keyboard subject selection has no animation or waiting period',async()=>{
 let click;const button={dataset:{enterSubject:'latin'},addEventListener:(_name,fn)=>{click=fn;}};
 const root={querySelectorAll:()=>[button],querySelector:()=>({animate:()=>{throw Error('Keyboard selection must be immediate');}})};
 const result=chooseSubject(root,{reducedMotion:false});await click({detail:0});assert.equal(await result,'latin');
 assert.doesNotThrow(()=>arrive(root),'the resulting screen retains immediate keyboard navigation');
});

test('A browser animation exception cannot leave the subject selection disabled forever',async()=>{
 let click;const button={dataset:{enterSubject:'english'},addEventListener:(_name,fn)=>{click=fn;}};
 const root={querySelectorAll:()=>[button],querySelector:()=>({animate(){throw Error('Unavailable animation implementation');}})};
 const result=chooseSubject(root,{reducedMotion:false});await click({detail:1});assert.equal(await result,'english');
});
