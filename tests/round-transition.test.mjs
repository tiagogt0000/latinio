import test from 'node:test';
import assert from 'node:assert/strict';
import {fadeRound,fadeDialog} from '../app/round-transition.js';

function element(name,children=[],finished=Promise.resolve()){
 const calls=[];
 return {name,calls,contains(other){return children.includes(other)||children.some(child=>child.contains(other));},animate(frames,options){calls.push({frames,options});return {finished};}};
}
function rootFor(groups){
 let index=0,blurred=false;
 return {querySelector:()=>({blur(){blurred=true;}}),querySelectorAll:()=>groups[index++],get blurred(){return blurred;}};
}

test('round exit animates each visual group once, including nested feedback and duplicate matches',async()=>{
 const feedback=element('feedback'),wrapper=element('test-feedback',[feedback]),title=element('title'),footer=element('footer');
 const root=rootFor([[title],[feedback,wrapper,feedback],[footer]]);
 await fadeRound(root);
 assert.equal(root.blurred,true);assert.equal(feedback.calls.length,0);
 assert.equal(wrapper.calls.length,1);assert.equal(title.calls.length,1);assert.equal(footer.calls.length,1);
 assert.deepEqual([title,wrapper,footer].map(node=>node.calls[0].options.delay),[0,140,280]);
 assert.ok([title,wrapper,footer].every(node=>node.calls[0].options.duration===400));
});

test('a later selected parent carries an earlier matched child',async()=>{
 const child=element('child'),parent=element('parent',[child]);
 await fadeRound(rootFor([[child],[parent],[]]));
 assert.equal(child.calls.length,0);assert.equal(parent.calls.length,1);
});

test('round completion waits for all exits and tolerates cancellation',async()=>{
 let finish,cancel;
 const first=element('first',[],new Promise(resolve=>finish=resolve));
 const second=element('second',[],new Promise((_resolve,reject)=>cancel=reject));
 let completed=false;
 const pending=fadeRound(rootFor([[first],[second],[]])).then(()=>completed=true);
 finish();await Promise.resolve();assert.equal(completed,false);
 cancel(new Error('Animation cancelled'));await pending;assert.equal(completed,true);
});

test('reduced motion dismisses the keyboard without starting exit animations',async()=>{
 const root=rootFor([]);root.querySelectorAll=()=>{throw Error('Reduced motion must not build a timeline');};
 await fadeRound(root,true);assert.equal(root.blurred,true);
 const dialog=element('dialog');await fadeDialog(dialog,true);assert.equal(dialog.calls.length,0);
 await fadeDialog(null);
});
