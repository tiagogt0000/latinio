import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
function startHarness(admin){
 const d={collections:{lesson:{id:'lesson',name:'Lektion 1'}},settings:{},words:{a:{id:'a',collectionId:'lesson'},b:{id:'b',collectionId:'lesson'},c:{id:'c',collectionId:'lesson'},d:{id:'d',collectionId:'lesson'}},reviews:{}};
 const state={messages:[],mode:null,selected:null};
 const ctx=vm.createContext({backgroundSync:async()=>{},sync:{schedule(){}},store:{doc:{session:null,matchRound:null},async update(fn){this.doc=fn(this.doc);},async recordActivity(){}},data:()=>d,isAdmin:()=>admin,chooseWords(_data,ids,limit,mode){state.mode=mode;state.limit=limit;return Object.values(d.words).filter(w=>ids.includes(w.collectionId)).map(w=>w.id);},inactiveQueue:()=>[],prefs:()=>({daily:5}),uid:()=> 'progressive-session',notify:m=>state.messages.push(m),closeModal(){},render(){},screen:'learn'});
 vm.runInContext(source.slice(source.indexOf('async function start('),source.indexOf('function current(')),ctx);
 return {ctx,state};
}

test('Progressive learning starts every word in the selected decks independent of daily target',async()=>{
 const {ctx,state}=startHarness(true);await ctx.start('progressive',['lesson']);
 assert.equal(state.mode,'all');assert.equal(state.limit,0);assert.equal(ctx.store.doc.session.mode,'progressive');
 assert.equal(ctx.store.doc.session.originalLength,4);assert.equal(ctx.store.doc.session.stage,1);
});

test('A student cannot start the admin-only progressive mode',async()=>{
 const {ctx,state}=startHarness(false);await ctx.start('progressive',['lesson']);
 assert.equal(ctx.store.doc.session,null);assert.match(state.messages[0],/nur für den Admin/);
});
