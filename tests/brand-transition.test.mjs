import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {brandTransition} from '../app/subjects.js';
import {chooseSubject} from '../app/subject-entrance.js';
import {frenchHome} from '../app/french.js';
import {emptyData} from '../app/core.js';

test('Wordmark solo phases use measured centers; the blurred entrance retains its original layout and background',async t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');t.after(()=>original?Object.defineProperty(globalThis,'document',original):delete globalThis.document);
 const properties={},attrs=new Set();let removed=false,finish;
 const veil={setAttribute:name=>attrs.add(name),removeAttribute:name=>attrs.delete(name),style:{setProperty:(name,value)=>properties[name]=value},querySelector:selector=>({getBoundingClientRect:()=>selector==='i'?{left:300,width:1}:selector==='.partnership-first'?{left:190,width:90}:{left:321,width:140}}),animate:()=>({finished:new Promise(resolve=>finish=resolve)}),remove:()=>removed=true};
 Object.defineProperty(globalThis,'document',{value:{createElement:()=>veil,body:{append(){}}},configurable:true});
 const root={classList:{add(){throw Error('Filtering the root would move its fixed entrance');},remove(){}}};
 const operation=brandTransition(root,'latin','french',{reducedMotion:false});assert.equal(properties['--first-center'],'65.5px');assert.equal(properties['--second-center'],'-90.5px');assert.ok(!attrs.has('data-measuring'));assert.equal(removed,false);finish();await operation;assert.equal(removed,true);
 const css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.match(css,/\.brand-transition\{[^}]*background:transparent;[^}]*backdrop-filter:blur\(22px\)/);
 assert.match(css,/\.brand-partnership\{[^}]*grid-template-columns:minmax\(0,1fr\) 1px minmax\(0,1fr\)/);
 assert.match(css,/\.partnership-first\{[^}]*justify-self:end/);assert.match(css,/\.partnership-second\{[^}]*justify-self:start/);
});
test('Entering French keeps the start menu visible for the blur instead of fading its objects away first',async()=>{
 let click;const button={dataset:{enterSubject:'french'},addEventListener:(_name,fn)=>click=fn};const root={querySelectorAll:()=>[button],querySelector:()=>({animate(){throw Error('The start menu must remain underneath');}})};
 const result=chooseSubject(root,{reducedMotion:false});await click();assert.equal(await result,'french');
});
test('Vocabify learning home omits the decorative app icon',()=>{
 assert.doesNotMatch(frenchHome(emptyData(),0,10,String),/<img/);
});
