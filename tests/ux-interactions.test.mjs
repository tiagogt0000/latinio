import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {hasAnswerContent} from '../app/answer-fields.js';
const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
test('Empty normal vocabulary submissions never grade; explicit skip still records a wrong answer',async()=>{
 let values=['','  '],graded=0,commits=0;const session={id:'s',cursor:0};
 const ctx=vm.createContext({current:()=>({session,word:{id:'w'},item:{}}),readAnswers:()=>values,hasAnswerContent,evaluateSession:()=>{graded++;return {grade:'wrong'};},reviewKey:()=>'r',english:false,prefs:()=>({typos:true}),store:{async commit(){commits++;}},sync:{schedule(){}},render(){}});
 vm.runInContext(source.split('\n').find(x=>x.startsWith('async function checkAnswer(')),ctx);
 await ctx.checkAnswer();assert.equal(graded,0);assert.equal(commits,0);assert.equal(session.feedback,undefined);
 await ctx.checkAnswer(true);assert.equal(graded,1);assert.equal(commits,1);
 delete session.feedback;values=['richtig'];await ctx.checkAnswer();assert.equal(graded,2);
});
test('Collection navigation renders immediately while an unrelated operation is busy',async()=>{
 const ctx=vm.createContext({ready:true,working:true,screen:'collections',collectionFilter:'all',search:'old',collectionTab:'lessons',closeModal(){},render(){},sharing:{handle(){throw Error('navigation waited for sharing');}},notify(){throw Error('navigation blocked');}});
 vm.runInContext(source.slice(source.indexOf('async function actions('),source.indexOf("document.addEventListener('click',event=>")),ctx);
 const task=ctx.actions({preventDefault(){},target:{closest:()=>({dataset:{action:'collection-open',id:'lesson9'}})}});
 assert.equal(ctx.screen,'collection-detail');assert.equal(ctx.collectionFilter,'lesson9');assert.equal(ctx.search,'');assert.equal(ctx.working,true);await task;
});
test('Modal replacement, tab trapping and Escape never restore focus with scrolling',()=>{
 const focusCalls=[],listeners=new Map();let rootHtml='';
 const opener={isConnected:true,focus:opts=>focusCalls.push(['opener',opts])};
 const first={focus:opts=>focusCalls.push(['first',opts])},last={focus:opts=>focusCalls.push(['last',opts])};
 const root={get children(){return rootHtml?[{}]:[];},set innerHTML(value){rootHtml=value;},querySelector:()=>first,querySelectorAll:()=>[first,last],contains:el=>[first,last].includes(el)};
 const document={activeElement:opener,addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:type=>listeners.delete(type)};
 const ctx=vm.createContext({document,modalRoot:root,modalCleanup:null,modalReturnFocus:null,icon:()=>''});
 vm.runInContext(source.slice(source.indexOf('function showModal('),source.indexOf('function showStreakDemo(')),ctx);
 ctx.showModal('<h2 id="modal-title">One</h2>');document.activeElement=last;
 listeners.get('keydown')({key:'Tab',preventDefault(){}});assert.equal(focusCalls.at(-1)[0],'first');
 ctx.showModal('<h2 id="modal-title">Two</h2>');assert.equal(focusCalls.filter(c=>c[0]==='opener').length,0);
 listeners.get('keydown')({key:'Escape',preventDefault(){}});assert.equal(rootHtml,'');assert.equal(focusCalls.at(-1)[0],'opener');
 assert.ok(focusCalls.every(([,options])=>options.preventScroll===true));assert.equal(listeners.size,0);
});
