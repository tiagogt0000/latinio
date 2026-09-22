import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
test('Only initial app opening invokes the blocking cloud gate',()=>{
 assert.equal((source.match(/cloudWait\.run\(/g)||[]).length,1);
 assert.match(source.slice(source.indexOf('async function boot(')),/await cloudWait\.run/);
});
test('Results appear before cloud completion and late sync cannot reopen results',async()=>{
 let release,renders=[],updates=0;
 const ctx=vm.createContext({ready:true,working:false,cloudWait:{blocked:false},store:{doc:{session:{mode:'smart',finished:true}}},sync:{},modalRoot:{children:[]},screen:'test',render(){renders.push(ctx.screen);},updateStatus(){updates++;},settleSync:()=>new Promise(r=>release=r)});
 vm.runInContext(source.split('\n').filter(l=>l.startsWith('async function showResult(')||l.startsWith('async function backgroundSync(')).join('\n'),ctx);
 await ctx.showResult();assert.equal(ctx.screen,'result');assert.deepEqual(renders,['result']);
 ctx.screen='learn';release();await new Promise(r=>setImmediate(r));assert.equal(ctx.screen,'learn');assert.deepEqual(renders,['result','learn']);assert.equal(updates,1);
});
test('Cloud return during a test never rerenders or reads away typed answers',async()=>{
 let rendered=0,checked=0;
 const ctx=vm.createContext({ready:true,working:false,cloudWait:{blocked:false},screen:'test',sync:{lastFullSync:123},store:{doc:{session:{answers:['already saved']}}},modalRoot:{children:[]},render(){rendered++;},updateStatus(){},settleSync:async()=>checked++});
 vm.runInContext(source.split('\n').filter(l=>l.startsWith('async function loadCloud(')||l.startsWith('async function backgroundSync(')).join('\n'),ctx);
 await ctx.loadCloud();assert.equal(checked,1);assert.equal(rendered,0);assert.equal(ctx.sync.lastFullSync,0);assert.deepEqual(ctx.store.doc.session.answers,['already saved']);
});
test('Offline background failure leaves result actions available',async()=>{
 const ctx=vm.createContext({ready:true,working:false,cloudWait:{blocked:false},screen:'result',sync:{},store:{},modalRoot:{children:[]},render(){},updateStatus(){},settleSync:async()=>{throw Error('offline');}});
 vm.runInContext(source.split('\n').find(l=>l.startsWith('async function backgroundSync(')),ctx);
 await ctx.backgroundSync();assert.equal(ctx.working,false);assert.equal(ctx.cloudWait.blocked,false);assert.equal(ctx.screen,'result');
});
