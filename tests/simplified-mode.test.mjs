import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness} from './google-harness.mjs';
import {emptyData} from '../app/core.js';
import {Sync} from '../app/sync.js';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));

test('Simplified mode defaults off and only an administrator can change the persisted user choice',()=>{
 const h=harness(),p=h.request({action:'profileCreate',name:'Camille',email:'camille@example.org'}).profile;
 const user=h.request({action:'login',email:p.email});
 assert.equal(p.simplifiedMode,false);assert.equal(user.profile.simplifiedMode,false);
 const edit={action:'profileUpdate',profileId:p.id,name:p.name,email:p.email,allowedSubjects:['french'],simplifiedMode:true};
 assert.throws(()=>h.request({...edit,token:user.token}),/Admin/);
 assert.equal(h.request(edit).profile.simplifiedMode,true);
 assert.equal(h.request({action:'whoami',token:user.token,subject:'french'}).profile.simplifiedMode,true);
 assert.equal(h.request({action:'check',token:user.token,subject:'french'}).simplifiedMode,true);
 assert.equal(h.request({action:'login',email:p.email}).profile.simplifiedMode,true);
 assert.equal(h.request({...edit,simplifiedMode:false}).profile.simplifiedMode,false);
 assert.equal(h.request({action:'check',token:user.token,subject:'french'}).version,0,'profile changes must not create learning journal entries');
});

test('Old profile clients preserve the mode, subject changes preserve it, and invalid flags cannot alter a profile',()=>{
 const h=harness(),p=h.request({action:'profileCreate',name:'Camille',email:'camille@example.org',simplifiedMode:true}).profile;
 assert.equal(h.request({action:'profileUpdate',profileId:p.id,name:p.name,email:p.email}).profile.simplifiedMode,true);
 assert.equal(h.request({action:'profileUpdateSubjects',profileId:p.id,allowedSubjects:['french']}).profile.simplifiedMode,true);
 for(const simplifiedMode of ['false',1,null])assert.throws(()=>h.request({action:'profileUpdate',profileId:p.id,name:'Changed',email:p.email,simplifiedMode}),/Vereinfachter Modus/);
 const saved=h.request({action:'profiles'}).profiles[0];assert.equal(saved.name,p.name);assert.equal(saved.simplifiedMode,true);
 assert.throws(()=>h.request({action:'profileCreate',name:'Invalid',email:'invalid@example.org',simplifiedMode:'true'}),/Vereinfachter Modus/);
});

function ui(profile={id:'student',role:'student',simplifiedMode:true}){
 const d=emptyData();d.collections.lesson={id:'lesson',name:'Lernwoche 1'};
 const calls={renders:0,words:[]};
 const ctx=vm.createContext({profile,ready:true,subjectTransition:null,screen:'learn',collectionTab:'lessons',collectionFilter:'lesson',collectionsSearchOpen:true,search:'old hidden search',english:true,
  isAdmin:()=>ctx.profile.role==='admin',h:String,icon:name=>`<svg data-icon="${name}"></svg>`,data:()=>d,store:{doc:{deletedCollections:[]}},
  collectionLearningView:()=>'<p>Lernwoche 1</p>',sharing:{toolbar:()=>''},legacyRefreshCount:()=>0,wordRows:(id,query)=>{calls.words.push(query);return '<p>la planète</p>';},
  collectionOpener:{cancel(){}},closeModal(){},render(){calls.renders++;},cloudNotice:null,pendingCloudRender:false,working:false,waitingStart:false,modalRoot:{children:[]}});
 vm.runInContext(source.split('\n').find(line=>line.startsWith('const simpleMode=')),ctx);
 vm.runInContext(section('function nav()','function todayCount()'),ctx);
 vm.runInContext(source.split('\n').filter(line=>line.startsWith('function collectionsView(')||line.startsWith('function collectionDetailView(')).join('\n'),ctx);
 vm.runInContext(section('async function actions(',"document.addEventListener('click',event=>"),ctx);
 return {ctx,calls,click:dataset=>ctx.actions({preventDefault(){},target:{closest:()=>({dataset})}})};
}

test('Simplified profiles see only home and collections, with no search controls or hidden search filtering',()=>{
 const f=ui();const html=f.ctx.nav();
 assert.deepEqual([...html.matchAll(/data-screen="([^"]+)"/g)].map(m=>m[1]),['learn','collections']);
 assert.match(html,/data-simple-mode/);
 assert.doesNotMatch(f.ctx.collectionsView(),/collection-search-toggle|id="search"|collection-search-results/);
 assert.doesNotMatch(f.ctx.collectionDetailView(),/id="search"/);assert.deepEqual(f.calls.words,['']);
 f.ctx.profile.simplifiedMode=false;
 assert.match(f.ctx.nav(),/data-screen="settings"/);assert.match(f.ctx.collectionsView(),/collection-search-toggle/);
 assert.match(f.ctx.collectionDetailView(),/id="search"/);
});

test('Hidden settings and search cannot be opened by stale controls, while collection navigation stays usable',async()=>{
 const f=ui();
 for(const dataset of [{action:'nav',screen:'settings'},{action:'nav',screen:'classroom'},{action:'collection-search-toggle'}])await f.click(dataset);
 assert.equal(f.ctx.screen,'learn');assert.equal(f.calls.renders,0);
 await f.click({action:'nav',screen:'collections'});assert.equal(f.ctx.screen,'collections');assert.equal(f.calls.renders,1);
 const admin=ui({id:'admin',role:'admin',simplifiedMode:true});assert.match(admin.ctx.nav(),/data-screen="admin"/);assert.match(admin.ctx.nav(),/data-screen="settings"/);
});

test('A mode change received during a lesson defers its screen refresh until the lesson is left',()=>{
 const f=ui({id:'student',role:'student',simplifiedMode:false}),handlers={};
 f.ctx.sync={addEventListener:(type,fn)=>handlers[type]=fn};f.ctx.updateActiveProfile=()=>{};
 vm.runInContext(section('function flushCloudRender(','const prefs='),f.ctx);
 vm.runInContext(source.split('\n').find(line=>line.includes("sync.addEventListener('profile-updated'")),f.ctx);
 f.ctx.screen='test';handlers['profile-updated']({profile:{simplifiedMode:true}});
 assert.equal(f.ctx.screen,'test');assert.equal(f.calls.renders,0);assert.equal(f.ctx.pendingCloudRender,true);
 assert.equal(f.ctx.search,'');assert.equal(f.ctx.collectionsSearchOpen,false);
 f.ctx.screen='learn';f.ctx.flushCloudRender();assert.equal(f.calls.renders,1);assert.match(f.ctx.nav(),/data-simple-mode/);
});

test('A warm sync picks up the mode from its ordinary version check without another identity or journal download',async t=>{
 const oldWindow=globalThis.window,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 globalThis.window={addEventListener(){}};Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 t.after(()=>{globalThis.window=oldWindow;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;});
 const config={url:'https://example.test/api',token:'fixture'},store={profileId:'student',subject:'french',doc:{config,profile:{id:'student',role:'student',allowedSubjects:['french'],simplifiedMode:false},lastFullSync:Date.now(),base:0,pending:[],conflicts:[]},async update(fn){this.doc=fn(structuredClone(this.doc));}};
 const sync=new Sync(store),requests=[],updates=[];sync.verifiedIdentity={...config,profileId:'student'};
 sync.request=async action=>{requests.push(action);assert.equal(action,'check');return {version:0,allowedSubjects:['french'],simplifiedMode:true};};
 sync.addEventListener('profile-updated',event=>updates.push(event.profile));
 await sync.run();assert.equal(sync.status,'synced');assert.deepEqual(requests,['check']);assert.equal(store.doc.profile.simplifiedMode,true);assert.equal(updates.length,1);
});
