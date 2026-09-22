import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {emptyData,normalize,progressFor} from '../app/core.js';
import {saveDeck,pendingMembers,deckMembers,sortedCollections,refreshDecks} from '../app/refresh-decks.js';
import {refreshCreate,checkPicker,refreshMethod,refreshEditor} from '../app/refresh-ui.js';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
function harness(){
 const d=emptyData();d.collections.a={id:'a',name:'Lektion 1'};d.collections.b={id:'b',name:'Lektion 2'};
 d.words.x={id:'x',collectionId:'a',latin:'vox',meanings:[['Stimme']]};d.words.y={id:'y',collectionId:'b',latin:'rex',meanings:[['König']]};
 const listeners={},state={html:'',messages:[],started:null};
 class FormData{constructor(form){this.values=form.values;}get(k){return this.values[k]??null;}getAll(k){const v=this.values[k];return v===undefined?[]:Array.isArray(v)?v:[v];}}
 const ctx=vm.createContext({console,FormData,ready:true,working:false,cloudWait:{blocked:false},refreshFlow:null,collectionTab:'refresh',collectionFilter:'all',screen:'collections',search:'',data:()=>d,saveDeck,pendingMembers,deckMembers,sortedCollections,refreshDecks,refreshCreate,checkPicker,refreshMethod,refreshEditor,normalize,progressFor,allWords:()=>Object.values(d.words),icon:()=>'',h:x=>String(x??''),uid:()=> 'new',store:{doc:{},async commit(ops){for(const [entity,id,value] of ops){if(value===null)delete d[entity][id];else d[entity][id]=value;}}},sync:{schedule(){}},sharing:{handle:async()=>false,submit:async()=>false,afterAction(){}},confusions:{handle:async()=>false},showModal:html=>state.html=html,closeModal:()=>state.html='',render(){},notify:m=>state.messages.push(m),autoUpdate(){},confirm:()=>true,document:{addEventListener:(type,fn)=>listeners[type]=fn},start:async(...args)=>state.started=args});
 vm.runInContext(source.slice(source.indexOf('async function actions('),source.indexOf("document.addEventListener('click',actions);")),ctx);
 vm.runInContext(source.slice(source.indexOf("document.addEventListener('submit',"),source.indexOf('async function loadCloud(')),ctx);
 vm.runInContext(source.split('\n').filter(l=>l.startsWith('function collectionDetailView(')||l.startsWith('function wordRows(')).join('\n'),ctx);
 const submit=async(id,values={},dataset={})=>listeners.submit({preventDefault(){},target:{id,values,dataset,querySelectorAll:()=>[]}});
 const action=async(action,id)=>ctx.actions({preventDefault(){},target:{closest:()=>({dataset:{action,id}})}});
 return {d,ctx,state,submit,action};
}
test('Create, pick lessons, select words, rename and remove preserve source vocabulary and progress',async()=>{
 const t=harness();await t.submit('refresh-create-form',{name:'Meine Wiederholung'});const deck=t.d.settings.refresh_new;
 assert.ok(deck);assert.match(t.state.html,/Lektionen auswählen/);assert.doesNotMatch(t.state.html,/Testmodus/);
 await t.submit('check-picker-form',{lesson:[]},{target:deck.id});assert.match(t.state.messages.at(-1),/mindestens/);
 await t.submit('check-picker-form',{lesson:['a']},{target:deck.id});assert.match(t.state.html,/Testmodus/);assert.match(t.state.html,/Testmodus erklären/);
 await t.action('refresh-select-manual');assert.match(t.state.html,/vox/);assert.doesNotMatch(t.state.html,/rex/);
 await t.submit('refresh-form',{word:['x'],name:deck.name},{id:deck.id,merge:'true'});assert.equal(t.ctx.screen,'collection-detail');
 let html=vm.runInContext('collectionDetailView()',t.ctx);assert.match(html,/id="search"/);assert.match(html,/Neu · Offen/);assert.match(html,/refresh-remove-word/);assert.doesNotMatch(html,/Gesammelte Wörter üben|Alle erneut üben/);
 await t.submit('collection-form',{name:'Neuer Name'},{id:deck.id});assert.equal(t.d.settings[deck.id].name,'Neuer Name');assert.equal(t.d.settings[deck.id].members.length,1);assert.equal(Object.keys(t.d.collections).length,2);
 await t.action('refresh-remove-word','x');assert.equal(t.d.settings[deck.id].members.length,0);assert.equal(t.d.words.x.latin,'vox');
});
test('Adding with test mode retains the exact target and selected lessons',async()=>{
 const t=harness();t.d.settings.r=saveDeck(t.d,null,'r','Wiederholung',['y'],1);
 await t.action('check-picker','r');await t.submit('check-picker-form',{lesson:['a','b']},{target:'r'});
 await t.action('refresh-select-test');assert.deepEqual(JSON.parse(JSON.stringify(t.state.started)),['inactive-check',['a','b'],'r']);
 await t.action('refresh-select-back');assert.match(t.state.html,/value="a" checked/);assert.match(t.state.html,/value="b" checked/);
 await t.submit('refresh-form',{word:['x'],name:'Wiederholung'},{id:'r',merge:'true'});assert.deepEqual(t.d.settings.r.members.map(m=>m.wordId),['y','x']);
});
test('Automatic update waits for live work, but not a saved paused session',()=>{
 let applied=0;const ctx=vm.createContext({ready:true,updates:{state:'available',apply:()=>applied++},working:false,cloudWait:{blocked:false},modalRoot:{children:[]},screen:'learn',sync:{busy:false},sharing:{busy:false},store:{doc:{pending:[],session:{finished:false},matchRound:null}}});
 vm.runInContext(source.split('\n').find(l=>l.startsWith('function autoUpdate(')),ctx);
 ctx.autoUpdate();assert.equal(applied,1);
 ctx.screen='test';ctx.autoUpdate();assert.equal(applied,1);
 ctx.screen='collection-detail';ctx.modalRoot.children=[{}];ctx.autoUpdate();assert.equal(applied,1);
 ctx.modalRoot.children=[];ctx.store.doc.pending=[{}];ctx.autoUpdate();assert.equal(applied,1);
});
test('Starting a selected refresher never silently resumes an unrelated paused test',async()=>{
 const d=emptyData();d.words.x={id:'x',collectionId:'a'};d.collections.a={id:'a'};
 const ctx=vm.createContext({backgroundSync:async()=>{},sync:{schedule(){}},store:{doc:{session:{finished:false,mode:'inactive-check'}},async update(fn){this.doc=fn(this.doc);}},data:()=>d,cloudWait:{run:async()=>{}},prefs:()=>({daily:10}),confirm:()=>true,notify(){},inactiveQueue:()=>['x'],uid:()=> 'new-session',closeModal(){},render(){},screen:'learn',Date});
 vm.runInContext(source.slice(source.indexOf("async function start("),source.indexOf('function current(')),ctx);
 await ctx.start('inactive-check',['a'],'refresh_target');assert.equal(ctx.store.doc.session.refreshTarget,'refresh_target');assert.equal(ctx.store.doc.session.id,'new-session');assert.equal(ctx.store.doc.session.cardFlipped,false);

});
