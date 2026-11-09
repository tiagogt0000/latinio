import {tablePracticeCard,prefixPracticeCard} from '../app/table-practice.js';
import {grammarCard} from '../app/grammar.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {predicateDecks,predicateCloudItems} from '../app/predicates.js';
import {streakState,streakDays} from '../app/streak.js';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function viewContext(english=false,admin=true,subject=english?'english':'latin'){
 const word={id:'w',collectionId:'c'},deck={id:'c',name:'Lektion 1',active:true};
 const data={words:{w:word},collections:{c:deck},settings:{},reviews:{}};
 return vm.createContext({simpleMode:()=>false,tablePracticeCard,prefixPracticeCard,grammarCard,grammar:null,reminders:null,subject,languageName:()=>english?'Englisch':'Latein',learningStatus:()=>'',english,profile:{name:'Testnutzer'},screen:'learn',isAdmin:()=>admin,h:s=>String(s??''),icon:()=>'',APP_VERSION:'2.0.0',
  cloudWait:{blocked:false},predicateSelected:null,predicateDecks,predicateCloudItems,prefs:()=>({direction:'mixed',daily:10}),data:()=>data,activeWords:()=>[word],progressFor:()=>({level:'new',seen:false}),directionsFor:()=>['en-de','de-en'],
  streakLedger:null,streakState,streakDays,streakBadgeFlame:()=>'<svg></svg>',todayCount:()=>2,trainingDecks:()=>[deck],wordsForDecks:()=>[word],directionLabel:()=>'',selected:[],predicateItems:[{grundform:'amare'}],
  accountCard:()=>'<section class="settings-section profile-settings">Profil</section>',updateView:()=>'<p>Update</p>',syncDetails:()=>'<p>Cloud</p>',sync:{configured:true},adminContent:'Nutzerliste',adminTab:'people'});
}
function balanced(html){
 const stack=[],voids=new Set(['input','br','hr','img']);
 for(const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)){
  const [,closing,name]=match;if(voids.has(name))continue;
  if(closing)assert.equal(stack.pop(),name,'Unbalanced '+match[0]);else stack.push(name);
 }
 assert.deepEqual(stack,[]);
}
test('home keeps all training actions without a progress section, and isolates Latin-only forms',()=>{
 for(const english of [false,true]){
  const context=viewContext(english);
  vm.runInContext(section('function learnView()','function startPredicatePractice('),context);
  const html=vm.runInContext('learnView()',context);balanced(html);
  assert.match(html,/data-action="start"/);assert.match(html,/data-action="training-options"/);
  assert.doesNotMatch(html,/Lernfortschritt|Schon sicher|Im Training/);
  assert.doesNotMatch(html,/predicate-import|JSON importieren/);assert.equal(html.includes('Perfektform lernen'),!english);assert.equal((html.match(/class="training-card"/g)||[]).length,english?1:2);
  assert.equal(html.includes('id="direction"'),english);
  for(const action of ['tables-open','prefixes-open'])assert.equal(html.includes('data-action="'+action+'"'),!english);
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
test('French has the vocabulary-only English layout and both directions, even for the administrator',()=>{
 for(const admin of [false,true]){
  const context=viewContext(true,admin,'french');context.languageName=()=>'Französisch';
  vm.runInContext(section('function learnView()','function startPredicatePractice('),context);
  const html=vm.runInContext('learnView()',context);balanced(html);
  assert.equal((html.match(/class="training-card"/g)||[]).length,1);
  assert.match(html,/Französisch → Deutsch/);assert.match(html,/Deutsch → Französisch/);
  assert.match(html,/data-action="start"/);assert.match(html,/data-action="training-options"/);
  assert.doesNotMatch(html,/tables-open|prefixes-open|predicate-start|grammar-open|Vocabify/);
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
test('both home cards use the same controls and subject menu items remain flat inside the floating menu',()=>{
 const css=fs.readFileSync(new URL('../app/style.css',import.meta.url),'utf8');
 assert.match(css,/\.home-practice-grid \.word-tools>\.button\{[^}]*min-height:52px[^}]*padding:14px 18px/);
 assert.match(css,/\.subject-options>button,\.subject-options>button:active\{box-shadow:none!important;transform:none!important/);
});

test('Options remain available when no active words exist, with collection selection still reachable',()=>{
 const context=viewContext(false);context.activeWords=()=>[];context.trainingDecks=()=>[];
 vm.runInContext(section('function learnView()','function startPredicatePractice('),context);
 const html=vm.runInContext('learnView()',context);balanced(html);
 assert.match(html,/data-action="training-options">/);assert.match(html,/data-action="predicate-options">/);
 assert.match(html,/Keine aktive Sammlung/);
});
