import test from 'node:test';
import assert from 'node:assert/strict';
import {settleSync,incomingChanges} from '../app/multiuser-sync.js';
import {emptyData,applyOps} from '../app/core.js';
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
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
