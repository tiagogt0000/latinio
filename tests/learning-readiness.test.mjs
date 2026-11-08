import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {emptyData} from '../app/core.js';
import {trainingDecks} from '../app/refresh-decks.js';
import {trainingOptionCounts} from '../app/training-options.js';
import {predicateDecks,predicateQueue} from '../app/predicates.js';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));

for(const kind of ['vocab','predicates'])test(`An empty ${kind} options dialog becomes usable after download without closing or losing focus`,()=>{
 const d=emptyData();let removed=false,dialogs=0;
 const empty={remove(){removed=true;}},hint={textContent:''};
 const node={dataset:{waitingOptions:kind},innerHTML:'disabled options',removeAttribute(){delete this.dataset.waitingOptions;},closest:()=>({querySelector:()=>empty})};
 const context=vm.createContext({cloudWait:{blocked:true},data:()=>d,selected:[],english:false,predicateSelected:null,trainingDecks,trainingOptionCounts,predicateDecks,predicateQueue,
  document:{activeElement:null},modalRoot:{querySelector:selector=>selector==='[data-options-empty] p'?hint:node},showModal(){dialogs++;}});
 vm.runInContext(section('function selectedPredicateDecks(','function predicatePracticeCard('),context);
 vm.runInContext(section('function predicateOptionButtons(','function renderPredicateTest('),context);
 vm.runInContext(section('function trainingOptions(','function startOptionsView('),context);
 context.updateWaitingOptions();assert.equal(node.innerHTML,'disabled options');assert.equal(removed,false);
 assert.match(hint.textContent,/Sammlungen werden geladen/);context.cloudWait.blocked=false;
 context.updateWaitingOptions();assert.doesNotMatch(hint.textContent,/werden geladen/);
 if(kind==='vocab'){
  d.collections.c={id:'c',name:'Lektion'};d.words.w={id:'w',collectionId:'c',latin:'vox',meanings:[['Stimme']]};
 }else{
  d.settings.p={id:'p',kind:'predicateDeck',name:'Perfekt',active:true};
  d.settings.i={id:'i',kind:'predicateItem',deckId:'p',grundform:'amare',praedikate:['amavi']};
 }
 context.updateWaitingOptions();assert.equal(node.dataset.waitingOptions,undefined);assert.equal(removed,true);
 assert.match(node.innerHTML,kind==='vocab'?/data-action="start-all" >Alle ausgewählten Vokabeln üben · 1/:/data-id="all" >Alle ausgewählten Formen üben · 1/);
 assert.equal(dialogs,0,'do not replace the modal or move its focus when options arrive');
});

test('A page render shares one snapshot and releases it on completion or an exception',()=>{
 let reads=0,revision=0;
 const ctx=vm.createContext({store:{get data(){reads++;return {revision};}},viewSnapshot:null,screen:'match',renderedScreen:null,
  interfaceMotion:{beforeRender(){}},theme(){for(let i=0;i<10;i++)ctx.data();},confusions:{view(){for(let i=0;i<10;i++)ctx.data();return 'matching';}},app:{innerHTML:''}});
 vm.runInContext('const data=()=>viewSnapshot||store.data;this.data=data;',ctx);
 vm.runInContext(section('function render(){','function adminView()'),ctx);
 ctx.render();assert.equal(reads,1);assert.equal(ctx.viewSnapshot,null);assert.equal(ctx.app.innerHTML,'matching');
 revision=2;assert.equal(ctx.data().revision,2,'an action after paint receives current data');
 ctx.confusions.view=()=>{ctx.data();throw Error('broken view');};assert.throws(()=>ctx.render(),/broken view/);
 assert.equal(reads,3);assert.equal(ctx.viewSnapshot,null,'a failed view must not retain an old snapshot');
});
