import test from 'node:test';
import assert from 'node:assert/strict';
import {settleSync,incomingChanges,cloudGate,waitForInitialSync} from '../app/multiuser-sync.js';
import {emptyData,applyOps} from '../app/core.js';
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
test('Concurrent automatic sync callers share one download and preserve local choices',async()=>{
 const store={doc:{pending:[]},data:emptyData()};let release,accepted=0,runs=0;
 const sync={status:'newer',remote:{},run:async()=>{runs++;if(runs===1)await new Promise(resolve=>release=resolve);else sync.status='synced';},compare:()=>({conflicts:[{key:'edited-word'}]}),accept:async choices=>{assert.equal(choices['edited-word'],'local');accepted++;sync.remote=null;}};
 const a=settleSync(sync,store),b=settleSync(sync,store);assert.equal(a,b);release();await Promise.all([a,b]);assert.equal(accepted,1);assert.equal(runs,2);
});
function gateFixture(){
 globalThis.document={createElement(){throw Error('Startup must not create a loading screen');}};
 const store={doc:{pending:[]},data:emptyData()},sync=new EventTarget(),errors=[];sync.status='synced';sync.run=async()=>{};
 return {store,sync,errors,gate:cloudGate({sync,store,onError:error=>errors.push(error.message)})};
}
test('Startup runs once without creating a dialog and concurrent learning waits join it',async()=>{
 const x=gateFixture();let release,calls=0;x.sync.run=()=>{calls++;return new Promise(resolve=>release=resolve);};
 const run=x.gate.run();assert.equal(x.gate.blocked,true);assert.equal(run,x.gate.run());
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
 let started=false;const wait=x.gate.wait().then(()=>started=true);assert.equal(started,false);
 release();await Promise.all([run,wait]);assert.equal(started,true);assert.equal(x.gate.blocked,false);await x.gate.run();assert.equal(calls,1);
});
test('Offline startup releases local learning immediately without a loading screen',async()=>{
 const x=gateFixture();navigator.onLine=false;let calls=0;x.sync.run=async()=>calls++;
 try{await x.gate.run();assert.equal(calls,0);assert.equal(x.gate.blocked,false);}finally{navigator.onLine=true;}
});
test('Failed initial sync releases learning and preserves pending work',async()=>{
 const x=gateFixture();x.store.doc.pending=[{id:'local-change'}];x.sync.status='error';x.sync.message='Nicht erreichbar';
 await x.gate.run();assert.deepEqual(x.errors,['Nicht erreichbar']);assert.equal(x.store.doc.pending.length,1);assert.equal(x.gate.blocked,false);
});
test('Only the clicked start button displays three dots and its original accessible state is restored',async()=>{
 const x=gateFixture();let release;x.sync.run=()=>new Promise(resolve=>release=resolve);x.gate.run();
 const attrs=new Map(),button={innerHTML:'Smart lernen',disabled:false,getAttribute:k=>attrs.get(k)??null,setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const wait=waitForInitialSync(x.gate,button);assert.equal((button.innerHTML.match(/<i>/g)||[]).length,3);assert.equal(button.disabled,true);assert.equal(attrs.get('aria-busy'),'true');
 await new Promise(resolve=>setImmediate(resolve));release();await wait;assert.equal(button.innerHTML,'Smart lernen');assert.equal(button.disabled,false);assert.equal(attrs.size,0);
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

test('Unread share notices survive initial sync without delaying learning',async()=>{
 const x=gateFixture();x.store.data.settings.n={id:'n',kind:'shareNotice',at:1,collections:[{id:'c',name:'Lektion 1'}]};
 await x.gate.run();assert.equal(x.gate.blocked,false);assert.equal(x.store.data.settings.n.kind,'shareNotice');assert.equal(x.store.data.settings.read_n,undefined);
});
