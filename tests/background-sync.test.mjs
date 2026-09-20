import test from 'node:test';
import assert from 'node:assert/strict';
import {settleSync,incomingChanges,cloudGate} from '../app/multiuser-sync.js';
import {emptyData,applyOps} from '../app/core.js';
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
test('Concurrent automatic sync callers share one download and preserve local choices',async()=>{
 const store={doc:{pending:[]},data:emptyData()};let release,accepted=0,runs=0;
 const sync={status:'newer',remote:{},run:async()=>{runs++;if(runs===1)await new Promise(resolve=>release=resolve);else sync.status='synced';},compare:()=>({conflicts:[{key:'edited-word'}]}),accept:async choices=>{assert.equal(choices['edited-word'],'local');accepted++;sync.remote=null;}};
 const a=settleSync(sync,store),b=settleSync(sync,store);assert.equal(a,b);release();await Promise.all([a,b]);assert.equal(accepted,1);assert.equal(runs,2);
});
function gateFixture(name){
 const nodes=new Map(),dialog={open:false,innerHTML:'',onclick:null,classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},querySelector(key){if(!nodes.has(key))nodes.set(key,{textContent:''});return nodes.get(key);},showModal(){this.open=true;},close(){this.open=false;}};
 globalThis.document={createElement:()=>dialog,body:{append(){}}};
 const store={doc:{pending:[]},data:emptyData()},sync=new EventTarget();sync.status='synced';sync.run=async()=>{};
 return {dialog,nodes,store,sync,gate:cloudGate({sync,store,name})};
}
test('Full-screen greeting works for both admin and student names',async()=>{
 for(const name of ['Tiago','Felix']){const x=gateFixture(name);const run=x.gate.run();assert.equal(x.gate.blocked,true);await run;assert.equal(x.nodes.get('h1').textContent,'Hallo '+name);assert.equal(x.gate.blocked,false);assert.equal(x.dialog.open,false);assert.match(x.dialog.innerHTML,/cloud-welcome/);}
});
test('Offline startup never opens a blocking greeting and can retry later',async()=>{
 const x=gateFixture('Tiago');navigator.onLine=false;await x.gate.run();assert.equal(x.dialog.open,false);assert.equal(x.gate.blocked,false);navigator.onLine=true;await x.gate.run();assert.equal(x.nodes.get('h1').textContent,'Hallo Tiago');
});
test('Failed online sync offers Offline fortfahren without erasing pending work',async()=>{
 const x=gateFixture('Felix');x.store.doc.pending=[{id:'local-change'}];x.sync.status='error';x.sync.message='Nicht erreichbar';
 const run=x.gate.run();await new Promise(resolve=>setImmediate(resolve));assert.match(x.dialog.innerHTML,/Offline fortfahren/);assert.equal(x.gate.blocked,true);x.dialog.onclick({target:{closest:()=>({dataset:{choice:'offline'}})}});await run;assert.equal(x.store.doc.pending.length,1);assert.equal(x.gate.blocked,false);
});
test('Student sync loads cloud before uploading local work and applying shared vocabulary',async()=>{
 const data=emptyData();data.collections.c={id:'c',name:'Latein'};
 data.settings.i={kind:'incomingShare',id:'i',entity:'words',key:'w',collectionId:'c',previous:null,value:{id:'w',collectionId:'c',latin:'vox',meanings:[['Stimme']]},at:1};
 const store={doc:{pending:[1]},data,async commit(changes){this.data=applyOps(this.data,changes.map(([entity,key,value])=>({entity,key,value})));this.doc.pending.push(2);}};
 const events=[];const sync={status:'newer',remote:{},async run(){events.push('run');if(!this.remote){store.doc.pending=[];this.status='synced';}},compare:()=>({conflicts:[{key:'word'}]}),async accept(choices){assert.equal(choices.word,'local');events.push('accept');this.remote=null;}};
 await settleSync(sync,store);assert.equal(store.data.words.w.latin,'vox');assert.equal(store.data.settings.i,undefined);assert.deepEqual(events,['run','accept','run','run']);
});
test('Offline and failed uploads cannot be reported as completed',async()=>{
 navigator.onLine=false;await assert.rejects(settleSync({},{}),/offline/);navigator.onLine=true;
 await assert.rejects(settleSync({run:async()=>{},status:'error',message:'Upload failed'},{}),/Upload failed/);
});
test('Personal changes survive incoming edits and nonempty collection deletion requires a decision',()=>{
 const d=emptyData();d.collections.c={id:'c',name:'Latein'};d.words.w={id:'w',collectionId:'c',latin:'mein Wort',meanings:[['meins']]};
 d.settings.i={kind:'incomingShare',id:'i',entity:'words',key:'w',collectionId:'c',previous:{latin:'alt'},value:{latin:'neu'},at:1};
 d.settings.j={kind:'incomingShare',id:'j',entity:'collections',key:'c',previous:d.collections.c,value:null,at:2};
 const r=incomingChanges(d);assert.equal(r.changes.length,0);assert.equal(r.conflicts.length,2);assert.equal(d.words.w.latin,'mein Wort');
});
