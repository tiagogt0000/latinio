import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(){
 let html='',visible=[],renders=0;
 const data={collections:{}},focusable={focus(){}},listeners=new Map();
 const modalRoot={get children(){return html?[{}]:[];},set innerHTML(value){html=value;},querySelector:()=>focusable,querySelectorAll:()=>[],contains:()=>false};
 const ctx=vm.createContext({
  queueMicrotask,setTimeout,clearTimeout,pendingCloudRender:false,ready:true,working:false,waitingStart:false,screen:'collections',subjectTransition:null,
  cloudWait:{blocked:false},store:{doc:{pending:[]},data,recordActivity:async()=>{}},sync:{schedule(){}},modalRoot,modalCleanup:null,modalReturnFocus:null,
  document:{activeElement:focusable,addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:type=>listeners.delete(type)},
  icon:()=>'',interfaceMotion:{closeModal(){},openModal(){}},settleSync:async()=>{},refreshStreak:async()=>{},updateStatus(){},checkShareNotices(){},checkAnnouncements:async()=>{},reportAppVersion:async()=>{},autoUpdate(){},
  render(){renders++;visible=Object.values(data.collections).map(collection=>collection.name);},notify(message){throw Error(message);},
  collectionOpener:{cancel(){}},subject:'latin',tablePractice:null,grammar:null,reminders:null,sharing:{handle:async()=>false,afterAction(){}},confusions:{handle:async()=>false},
 });
 vm.runInContext(section('function flushCloudRender(','const prefs='),ctx);
 vm.runInContext(section('function showModal(','function showStreakDemo('),ctx);
 vm.runInContext(section('async function actions(',"document.addEventListener('click',event=>"),ctx);
 return {ctx,data,listeners,get html(){return html;},get visible(){return visible;},get renders(){return renders;},download(){data.collections.lesson={id:'lesson',name:'Neue Lektion'};}};
}

test('Downloaded collections appear immediately after closing a dialog, without another sync',async()=>{
 const f=fixture();f.ctx.showModal('<h2 id="modal-title">Mehr Optionen</h2>');f.download();
 await f.ctx.backgroundSync();await f.ctx.backgroundSync();
 assert.deepEqual(f.visible,[]);assert.equal(f.renders,0);
 assert.match(f.html,/Mehr Optionen/);
 f.ctx.closeModal();await tick();
 assert.deepEqual(f.visible,['Neue Lektion']);assert.equal(f.renders,1);
 f.ctx.closeModal();await tick();assert.equal(f.renders,1,'one refresh consumes the pending download');
});

test('Initial download also refreshes a formerly empty screen after Escape closes its dialog',async()=>{
 const f=fixture();f.ctx.showModal('<h2 id="modal-title">Lernfach wechseln</h2>');f.download();f.ctx.startup=Promise.resolve();
 vm.runInContext(source.split('\n').find(line=>line.trim().startsWith('void startup.then(')),f.ctx);
 await tick();assert.equal(f.renders,0);
 f.listeners.get('keydown')({key:'Escape',preventDefault(){}});await tick();
 assert.deepEqual(f.visible,['Neue Lektion']);assert.equal(f.renders,1);
});

test('Replacing a dialog keeps its controls intact and postpones the pending screen refresh',async()=>{
 const f=fixture();f.ctx.showModal('First');f.download();await f.ctx.backgroundSync();
 f.ctx.closeModal();f.ctx.showModal('Replacement');await tick();
 assert.match(f.html,/Replacement/);assert.equal(f.renders,0);
 f.ctx.closeModal();await tick();assert.deepEqual(f.visible,['Neue Lektion']);
});

test('Closing a dialog inside an unfinished action refreshes only after the action completes',async()=>{
 const f=fixture();let finish;
 f.ctx.reminders={handle:async()=>{f.ctx.closeModal();await new Promise(resolve=>finish=resolve);return true;}};
 f.ctx.showModal('Reminder');f.download();await f.ctx.backgroundSync();
 const button={dataset:{action:'notification-later'},isConnected:true,removeAttribute(){}};
 const action=f.ctx.actions({preventDefault(){},target:{closest:()=>button}});
 await tick();assert.equal(f.ctx.working,true);assert.equal(f.renders,0);
 finish();await action;assert.equal(f.ctx.working,false);assert.deepEqual(f.visible,['Neue Lektion']);assert.equal(f.renders,1);
});

test('Deferred downloads do not replace a live exercise, result, worksheet or admin screen',async()=>{
 for(const screen of ['test','match','predicate-test','round-end','tables','grammar','admin']){
  const f=fixture();f.ctx.showModal('Options');f.download();await f.ctx.backgroundSync();
  f.ctx.screen=screen;f.ctx.closeModal();await tick();f.ctx.flushCloudRender();
  assert.equal(f.renders,0,screen);
 }
 const f=fixture();f.ctx.showModal('Options');f.download();await f.ctx.backgroundSync();f.ctx.ready=false;
 f.ctx.closeModal();await tick();assert.equal(f.renders,0,'a restricted or signed-out app must not be reopened');
});
