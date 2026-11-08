import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createCloudNotice} from '../app/cloud-notice.js';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(){
 let html='',visible=[],renders=0;
 const data={collections:{}},focusable={focus(){}},listeners=new Map();
 const modalRoot={get children(){return html?[{}]:[];},set innerHTML(value){html=value;},querySelector:selector=>selector==='[data-cloud-connection-notice]'?(html.includes('data-cloud-connection-notice')?focusable:null):focusable,querySelectorAll:()=>[],contains:()=>false};
 const ctx=vm.createContext({
  queueMicrotask,setTimeout,clearTimeout,pendingCloudRender:false,ready:true,working:false,waitingStart:false,screen:'collections',subjectTransition:null,
  cloudNotice:null,cloudWait:{blocked:false},store:{doc:{pending:[]},data,recordActivity:async()=>{}},sync:{schedule(){}},modalRoot,modalCleanup:null,modalReturnFocus:null,
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

function connectionFixture(){
 const f=fixture(),ctx=f.ctx;
 Object.assign(ctx,{data:()=>f.data,predicateDecks:()=>[],navigator:{onLine:true},updateWaitingOptions(){}});
 Object.assign(ctx.document,{hidden:false,querySelectorAll:()=>[],querySelector:()=>null});
 ctx.createCloudNotice=options=>createCloudNotice({...options,online:()=>ctx.navigator.onLine});
 ctx.sync.status='checking';
 vm.runInContext(source.split('\n').filter(line=>line.startsWith('function updateStatus(')||line.startsWith('async function loadCloud(')||line.includes('cloudNotice=createCloudNotice(')).join('\n'),ctx);
 f.status=value=>{ctx.sync.status=value;ctx.updateStatus();};
 f.click=action=>ctx.actions({preventDefault(){},target:{closest:()=>({dataset:{action},isConnected:true,removeAttribute(){}})}});
 return f;
}

test('Real cloud status and dismissal actions keep routine sync silent and report an outage once',async()=>{
 const f=connectionFixture();f.download();
 for(const status of ['checking','loading','uploading','synced']){f.status(status);assert.equal(f.html,'');}
 f.ctx.settleSync=async()=>{f.status('error');throw Error('Connection failed');};
 await f.ctx.backgroundSync();assert.match(f.html,/data-cloud-connection-notice/);assert.match(f.html,/offline weiterlernen/);
 await f.click('cloud-dismiss');await tick();assert.equal(f.html,'');
 await f.ctx.backgroundSync();assert.equal(f.html,'','periodic retries must not reopen a dismissed outage');
 f.status('synced');f.status('error');assert.match(f.html,/data-cloud-connection-notice/);
 f.ctx.closeModal();await tick();
});

test('Connection failures wait until a live exercise, subject transition or first download has finished',async()=>{
 for(const blocked of ['exercise','transition','download','action','hidden']){
  const f=connectionFixture();
  if(blocked==='exercise')f.ctx.screen='test';
  if(blocked==='transition')f.ctx.subjectTransition={};
  if(blocked==='download')f.ctx.cloudWait.blocked=true;
  if(blocked==='action')f.ctx.working=true;
  if(blocked==='hidden')f.ctx.document.hidden=true;
  f.status('error');assert.equal(f.html,'',blocked);
  f.ctx.screen='learn';f.ctx.subjectTransition=null;f.ctx.cloudWait.blocked=false;f.ctx.working=false;f.ctx.document.hidden=false;
  f.ctx.flushCloudRender();assert.match(f.html,/data-cloud-connection-notice/,blocked);
  f.ctx.closeModal();await tick();
 }
});

test('A connection notice waits for existing options and its retry action downloads collections',async()=>{
 const f=connectionFixture();f.ctx.showModal('Mehr Optionen');f.status('error');
 assert.match(f.html,/Mehr Optionen/);assert.doesNotMatch(f.html,/data-cloud-connection-notice/);
 f.ctx.closeModal();await tick();assert.match(f.html,/data-cloud-connection-notice/);
 let downloads=0;
 f.ctx.settleSync=async()=>{downloads++;f.status('loading');await tick();f.download();f.status('synced');};
 await f.click('cloud-retry');await tick();await tick();
 assert.equal(downloads,1);assert.equal(f.html,'');assert.deepEqual(f.visible,['Neue Lektion']);
});

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
