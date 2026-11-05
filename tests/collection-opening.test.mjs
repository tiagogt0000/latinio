import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionOpener} from '../app/collection-opening.js';

function button(){
 const classes=new Set(),attrs=new Map();
 return {innerHTML:'<svg>pencil</svg>',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
  getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
}
test('Pencil shows loading before expensive local work and restores its content afterwards',async()=>{
 let paint,opened=0;const target=button();
 const opener=createCollectionOpener({waitForPaint:()=>new Promise(resolve=>paint=resolve)});
 const task=opener.open(target,()=>opened++);
 assert.match(target.innerHTML,/Sammlung wird geöffnet/);assert.equal(target.getAttribute('aria-busy'),'true');assert.equal(opened,0);
 paint();assert.equal(await task,true);assert.equal(opened,1);assert.equal(target.innerHTML,'<svg>pencil</svg>');assert.equal(target.getAttribute('aria-busy'),null);
});
test('Another collection, navigation away and a changed profile cancel stale openings',async()=>{
 const paints=[],seen=[],opener=createCollectionOpener({waitForPaint:()=>new Promise(resolve=>paints.push(resolve))});
 const first=button(),second=button();
 const a=opener.open(first,()=>seen.push('first')),b=opener.open(second,()=>seen.push('second'));
 paints[0]();paints[1]();assert.equal(await a,false);assert.equal(await b,true);assert.deepEqual(seen,['second']);
 const c=opener.open(first,()=>seen.push('cancelled'));opener.cancel();paints[2]();assert.equal(await c,false);
 const d=opener.open(first,()=>seen.push('old profile'),()=>false);paints[3]();assert.equal(await d,false);
 assert.deepEqual(seen,['second']);assert.equal(first.getAttribute('aria-busy'),null);
});
test('Double taps do not open twice or leave a permanent spinner; errors clean up',async()=>{
 let paint,opened=0;const target=button(),opener=createCollectionOpener({waitForPaint:()=>new Promise(resolve=>paint=resolve)});
 const a=opener.open(target,()=>opened++);assert.equal(await opener.open(target,()=>opened++),false);
 assert.match(target.innerHTML,/button-loading/);paint();await a;assert.equal(opened,1);assert.equal(target.innerHTML,'<svg>pencil</svg>');
 const b=opener.open(target,()=>{throw Error('render failed');});paint();await assert.rejects(b,/render failed/);
 assert.equal(target.getAttribute('aria-busy'),null);assert.equal(target.classList.contains('opening-collection'),false);
});
