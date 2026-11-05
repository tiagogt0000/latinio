import test from 'node:test';
import assert from 'node:assert/strict';
import {captureViewState,restoreViewState} from '../app/view-state.js';
function node(tag,attrs={},top=0,left=0){return {tagName:tag,attributes:Object.entries(attrs).map(([name,value])=>({name,value})),getAttribute:name=>attrs[name]??null,scrollTop:top,scrollLeft:left,focus(options){this.focusOptions=options;},setSelectionRange(a,b){this.selection=[a,b];}};}
test('Same-view replacement restores nested list position, horizontal tabs, focused control and page position',()=>{
 let controls=[node('INPUT',{'data-activity':'lesson4'})],areas=[node('DIV',{},350),node('DIV',{},0,86)];
 const win={scrollX:0,scrollY:620,scrollTo(position){this.position=position;}};
 const root={style:{minHeight:''},scrollHeight:1800,getBoundingClientRect:()=>({height:1800}),ownerDocument:{activeElement:controls[0]},contains:n=>controls.includes(n),querySelectorAll:selector=>selector==='input'?controls:selector==='div'?areas:areas};
 const snapshot=captureViewState(root,win);assert.equal(root.style.minHeight,'1800px');
 controls=[node('INPUT',{'data-activity':'lesson4'})];areas=[node('DIV'),node('DIV')];
 restoreViewState(root,snapshot);
 assert.equal(areas[0].scrollTop,350);assert.equal(areas[1].scrollLeft,86);
 assert.deepEqual(controls[0].focusOptions,{preventScroll:true});assert.deepEqual(win.position,{left:0,top:620,behavior:'instant'});assert.equal(root.style.minHeight,'');
});
test('New screens release layout protection without restoring old focus or scroll',()=>{
 const win={scrollX:0,scrollY:500,scrollTo(){throw Error('old position restored');}};
 const root={style:{minHeight:'30px'},scrollHeight:800,querySelectorAll:()=>[],contains:()=>false};
 const state=captureViewState(root,win);restoreViewState(root,state,{preserve:false});assert.equal(root.style.minHeight,'30px');
});
