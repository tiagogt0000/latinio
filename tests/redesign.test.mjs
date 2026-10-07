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
  accountCard:()=>'<section class="settings-section profile-settings">Profil</section>',updateView:()=>'<p>Update</p>',syncDetails:()=>'<p>Cloud</p>',sync:{configured:true},adminContent:'Nutzerliste',adminTab:'people'});
}
function balanced(html){
 const stack=[],voids=new Set(['input','br','hr']);
 for(const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  const [,closing,name]=match;if(voids.has(name))continue;
  if(closing)assert.equal(stack.pop(),name,'Unbalanced '+match[0]);else stack.push(name);
 }
 assert.deepEqual(stack,[]);
}
test('home keeps all training actions without a progress section, and isolates Latin-only forms',()=>{
 for(const english of [false,true]){
  const context=viewContext(english);
  vm.runInContext(section('function learnView()','function startPredicatePractice()'),context);
  const html=vm.runInContext('learnView()',context);balanced(html);
  assert.match(html,/data-action="start"/);assert.match(html,/data-action="training-options"/);
  assert.doesNotMatch(html,/Lernfortschritt|Schon sicher|Im Training/);
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
test('settings are a flat scrolling list with no accordion or card boxes',()=>{
 const context=viewContext();
 vm.runInContext(section('function settingsView()','function showModal('),context);
 const html=vm.runInContext('settingsView()',context);balanced(html);
 assert.match(html,/class="settings-list"/);
 assert.doesNotMatch(html,/<details|class="card|data-panel=/);
 for(const item of ['Training','App-Updates','Vokabeln & Installation','Cloud & Versionen'])assert.ok(html.includes(item));
 assert.ok(!html.includes('announcement-'));
});
test('shared buttons have breathing room and equal space inside action rows',()=>{
 const css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.match(css,/\.button,\.text-button,\.chip,\.correction,\.icon-button\{[\s\S]*?padding:12px 18px/);
 assert.match(css,/\.button-row>\.button,\.word-tools>\.button[^{]*\{flex:1 1 210px;min-width:0\}/);
 assert.match(css,/align-items:stretch;column-gap:14px;row-gap:12px/);
 assert.match(css,/\.button \.icon,\.text-button \.icon,\.chip \.icon\{flex:none\}/);
});
test('refresh collections do not duplicate the JSON import action and collection search is centered',()=>{
 const refresh=fs.readFileSync(new URL('../app/refresh-ui.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.doesNotMatch(refresh,/Auffrisch-JSON importieren/);
 assert.match(css,/\.collection-search input\{text-align:center\}/);
 assert.match(css,/\.collection-list-toolbar \.text-button[^}]*border:0/);
});
test('predicate card controls use a compact grid and cannot collapse into narrow letter columns',()=>{
 const css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.match(css,/\.home-practice-grid \.predicate-practice>\.button-row\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.home-practice-grid \.predicate-practice>\.button-row>\.button\.primary\{grid-column:1\/-1\}/);
 assert.match(css,/\.home-practice-grid \.predicate-practice>\.button-row>\.button,\.home-practice-grid \.predicate-practice>\.button-row>\.text-button\{[^}]*overflow-wrap:anywhere/);
});
