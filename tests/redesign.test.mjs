import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function viewContext(english=false,admin=true){
 const word={id:'w',collectionId:'c'},deck={id:'c',name:'Lektion 1',active:true};
 const data={words:{w:word},collections:{c:deck},settings:{},reviews:{}};
 return vm.createContext({english,profile:{name:'Testnutzer'},screen:'learn',isAdmin:()=>admin,h:s=>String(s??''),icon:()=>'',APP_VERSION:'2.0.0',
  prefs:()=>({direction:'mixed',daily:10}),data:()=>data,activeWords:()=>[word],progressFor:()=>({level:'new',seen:false}),directionsFor:()=>['en-de','de-en'],
  todayCount:()=>2,trainingDecks:()=>[deck],wordsForDecks:()=>[word],directionLabel:()=>'',selected:[],predicateItems:[{grundform:'amare'}],
  accountCard:()=>'<section class="card">Profil</section>',updateView:()=>'<p>Update</p>',syncDetails:()=>'<p>Cloud</p>',sync:{configured:true},adminContent:'Nutzerliste',adminTab:'people'});
}
function balanced(html){
 const stack=[],voids=new Set(['input','br','hr']);
 for(const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  const [,closing,name]=match;if(voids.has(name))continue;
  if(closing)assert.equal(stack.pop(),name,'Unbalanced '+match[0]);else stack.push(name);
 }
 assert.deepEqual(stack,[]);
}
test('home keeps all training actions, folds progress, and isolates Latin-only forms',()=>{
 for(const english of [false,true]){
  const context=viewContext(english);
  vm.runInContext(section('function learnView()','function startPredicatePractice()'),context);
  const html=vm.runInContext('learnView()',context);balanced(html);
  assert.match(html,/data-action="start"/);assert.match(html,/data-action="training-options"/);
  assert.match(html,/<details class="progress-section card">/);
  assert.equal(html.includes('predicate-import'),!english);
  assert.equal(html.includes('id="direction"'),english);
 }
});
test('admin has dedicated navigation; students do not get management controls',()=>{
 for(const admin of [false,true]){
  const context=viewContext(false,admin);
  vm.runInContext(section('function nav()','function todayCount()'),context);
  const html=vm.runInContext('nav()',context);balanced(html);
  assert.equal(html.includes('data-screen="admin"'),admin);
 }
});
test('settings preserve updates and training but no longer duplicate messaging',()=>{
 const context=viewContext();
 vm.runInContext(section('function settingsView()','function showModal('),context);
 const html=vm.runInContext('settingsView()',context);balanced(html);
 for(const item of ['updates','appearance','import','cloud'])assert.ok(html.includes('data-panel="'+item+'"'));
 assert.ok(!html.includes('announcement-'));
});
