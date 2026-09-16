import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,evaluate,applyOps,rebase} from '../app/core.js';
import {pairId,pairs,suggestions,pairDue,makeRound,matchRound} from '../app/confusions.js';
import {confusionUI} from '../app/confusion-ui.js';
function data(){const d=emptyData();d.collections.c={id:'c',name:'Lektion'};for(const [id,latin,meanings] of [['a','portare',[['tragen'],['bringen']]],['b','mittere',[['(los)lassen'],['schicken'],['werfen']]],['c','remanere',[['(zurück)bleiben']]],['d','velle',[['wollen']]]])d.words[id]={id,latin,meanings,collectionId:'c'};return d;}
function add(d,a,b){const id=pairId(a,b);return d.settings[id]={id,kind:'confusion',wordIds:[a,b],createdAt:1};}
test('A single wrong meaning alongside a correct one suggests only matching other words',()=>{
 const d=data(),f=evaluate(d.words.a,['tragen','schicken']);
 assert.deepEqual(suggestions(d.words.a,f,d).map(x=>x.word.id),['b']);
 assert.equal(suggestions(d.words.a,evaluate(d.words.a,['tragen','bringen']),d).length,0);
 assert.equal(suggestions(d.words.a,evaluate(d.words.a,['Unbekannt']),d).length,0);
});
test('Optional parentheses, case and whitespace match; confirmed pairs and deleted collections are excluded',()=>{
 const d=data(),f=evaluate(d.words.a,['  LASSEN  ']);
 assert.equal(suggestions(d.words.a,f,d)[0].word.id,'b');
 add(d,'b','a');assert.equal(suggestions(d.words.a,f,d).length,0);
 assert.equal(pairId('a','b'),pairId('b','a'));
 delete d.collections.c;assert.equal(pairs(d).length,0);
});
test('Matching rounds contain complete confusion pairs, at most four words, and respect due dates',()=>{
 const d=data(),p=add(d,'a','b');add(d,'c','d');
 const r=makeRound(d,['a']);assert.equal(r.words.length,2);assert.deepEqual(new Set(r.left),new Set(r.right));
 assert.equal(makeRound(d,null,true).words.length,4);
 d.settings.review={id:'review',kind:'confusionReview',pairId:p.id,at:100,correct:true};
 assert.equal(makeRound(d,['a'],false,101),null);assert.ok(makeRound(d,['a'],true,101));
});
test('Correct matching consumes one card per side; failures do not consume cards or become successes',()=>{
 const r=makeRound(dataWithPair(),null,true);r.selected='a';
 const failed=matchRound(r,'b');assert.equal(failed.errors,1);assert.equal(failed.doneLeft.length,0);
 failed.selected='a';const passed=matchRound(failed,'a');assert.equal(passed.errors,1);assert.deepEqual(passed.doneLeft,['a']);
 passed.selected='a';assert.equal(matchRound(passed,'b').doneRight.length,1);
});
function dataWithPair(){const d=data();add(d,'a','b');return d;}
test('In-test confusion manager preselects the current word and preserves the ongoing answer',async()=>{
 const store={data:data(),doc:{session:{cursor:3,answers:['schicken'],feedback:{grade:'wrong'}}},async commit(changes){this.data=applyOps(this.data,changes.map(([entity,key,value])=>({entity,key,value})));}};
 const before=structuredClone(store.doc.session);let html='',navigation=0;
 const ui=confusionUI({store,sync:{schedule:()=>{}},h:String,showModal:s=>html=s,closeModal:()=>{},notify:()=>{},go:()=>navigation++,render:()=>{}});
 await ui.handle({dataset:{action:'confusion-manage',id:'a'}});
 assert.match(html,/id="confusion-a" disabled/);assert.match(html,/<option value="a">portare<\/option>/);
 assert.doesNotMatch(html,/data-action="confusion-practice"/);
 const original=globalThis.document;globalThis.document={querySelector:selector=>({value:selector==='#confusion-a'?'a':'b'})};
 try{await ui.handle({dataset:{action:'confusion-manual'}});}finally{globalThis.document=original;}
 assert.equal(pairs(store.data).length,1);assert.deepEqual(store.doc.session,before);assert.equal(navigation,0);
 assert.match(html,/id="confusion-a" disabled/);assert.match(html,/mittere/);
});
test('UI confirmation persists pairs; matching saves a separate result; skipping does not grade',async()=>{
 const store={data:data(),doc:{session:{cursor:0}},async commit(changes){this.data=applyOps(this.data,changes.map(([entity,key,value])=>({entity,key,value})));},async update(fn){this.doc=fn(this.doc);}};
 let screen='',scheduled=0;
 const ui=confusionUI({store,sync:{schedule:()=>scheduled++},h:String,showModal:()=>{},closeModal:()=>{},notify:()=>{},go:value=>screen=value,render:()=>{}});
 const f=evaluate(store.data.words.a,['schicken']);assert.match(ui.prompt(store.data.words.a,f,store.doc.session),/confusion-add/);assert.equal(pairs(store.data).length,0);
 await ui.handle({dataset:{action:'confusion-add',a:'a',b:'b'}});assert.equal(pairs(store.data).length,1);
 assert.equal(await ui.offer(['a']),true);assert.equal(screen,'match');assert.match(ui.view(),/Was gehört zusammen/);
 for(const id of ['a','b']){await ui.handle({dataset:{action:'confusion-card',side:'left',id}});await ui.handle({dataset:{action:'confusion-card',side:'right',id}});}
 await ui.handle({dataset:{action:'confusion-complete'}});assert.equal(screen,'result');assert.equal(store.doc.matchRound,null);
 assert.equal(Object.values(store.data.settings).filter(x=>x.kind==='confusionReview').length,1);assert.ok(scheduled>=2);
 await ui.offer(null,'collections',true);await ui.handle({dataset:{action:'confusion-leave'}});
 assert.equal(screen,'collections');assert.equal(Object.values(store.data.settings).filter(x=>x.kind==='confusionReview').length,1);
});
test('Identical meaning cards can be interchanged without a false error',()=>{
 const d=dataWithPair();d.words.b.meanings=d.words.a.meanings;const r=makeRound(d,null,true);r.selected='a';
 const next=matchRound(r,'b');assert.equal(next.errors,0);assert.deepEqual(next.doneRight,['b']);
});
test('Success spaces practice and an error shortens the interval without changing normal vocabulary reviews',()=>{
 const d=dataWithPair(),p=pairs(d)[0];
 d.settings.r1={id:'r1',kind:'confusionReview',pairId:p.id,at:100,correct:true};
 d.settings.r2={id:'r2',kind:'confusionReview',pairId:p.id,at:200,correct:true};
 assert.equal(pairDue(p,d),200+3*86400000);
 d.settings.r3={id:'r3',kind:'confusionReview',pairId:p.id,at:300,correct:false};
 assert.equal(pairDue(p,d),300+43200000);assert.deepEqual(d.reviews,{});
});
test('Pairs and training history replay and rebase through the existing cloud data format',()=>{
 const d=data(),p=add(d,'a','b'),op={id:'op1',entity:'settings',key:p.id,value:p,device:'iphone'};
 const cloud=applyOps(data(),[op]);assert.equal(pairs(cloud).length,1);
 const local={id:'op2',entity:'settings',key:'result1',device:'ipad',value:{id:'result1',kind:'confusionReview',pairId:p.id,correct:true,at:100}};
 const merged=rebase(cloud,[op],[local]);assert.equal(merged.conflicts.length,0);assert.equal(pairDue(p,merged.data),100+86400000);
});
