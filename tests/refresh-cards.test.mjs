import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,progressFor} from '../app/core.js';
import {rateRefresh,refreshCardView,bindRefreshSwipe} from '../app/refresh-cards.js';
function fixture(){const data=emptyData();data.collections.a={id:'a',name:'Lektion 1'};for(const id of ['x','y','z'])data.words[id]={id,collectionId:'a',latin:id,meanings:[['eins','one'],['zwei']]};data.settings.r={id:'r',kind:'refreshDeck',name:'Meine Runde',members:[{wordId:'z',addedAt:1}]};return {data,session:{id:'s',mode:'inactive-check',refreshTarget:'r',sourceIds:['a'],queue:[{wordId:'x'},{wordId:'y'}],cursor:0,originalLength:2,cardFlipped:true}};}
function apply(data,result){for(const [entity,id,value] of result.ops)data[entity][id]=value;return result.session;}
test('Cards require flipping and record a secure self-assessment without typing',()=>{const {data,session}=fixture();assert.equal(rateRefresh(data,{...session,cardFlipped:false},true),null);const result=rateRefresh(data,session,true,10);assert.equal(session.cursor,0);assert.equal(result.session.cursor,1);assert.equal(result.session.cardFlipped,false);apply(data,result);assert.equal(progressFor('x',data.reviews).level,'known');assert.equal(data.settings.r.members.length,1);});
test('Last card automatically merges only unknown words into exact target in one commit',()=>{const {data,session}=fixture();const next=apply(data,rateRefresh(data,session,true,10));next.cardFlipped=true;const result=rateRefresh(data,JSON.parse(JSON.stringify(next)),false,20);assert.equal(result.session.finished,true);assert.equal(result.session.refreshSavedCount,1);assert.deepEqual(result.ops.map(o=>o[0]),['reviews','settings','sessions']);apply(data,result);assert.deepEqual(data.settings.r.members.map(m=>m.wordId),['z','y']);assert.equal(rateRefresh(data,result.session,false),null);});
test('All known preserves existing members; missing target is recreated; deleted words are skipped',()=>{const {data,session}=fixture();session.queue=[{wordId:'x'}];session.originalLength=1;let result=rateRefresh(data,session,true,10);assert.equal(result.session.refreshSavedCount,0);assert.deepEqual(result.ops.find(o=>o[0]==='settings')[2].members.map(m=>m.wordId),['z']);delete data.settings.r;result=rateRefresh(data,session,false,20);assert.equal(result.ops.find(o=>o[0]==='settings')[1],'r');assert.equal(result.session.refreshSavedCount,1);delete data.words.x;result=rateRefresh(data,{...session,cardFlipped:false},false);assert.equal(result.session.finished,true);assert.equal(result.session.refreshSavedCount,0);});
test('Card front hides translations; back shows every meaning and alternative',()=>{const {data,session}=fixture();const h=x=>x;const front=refreshCardView({...session,cardFlipped:false},data.words.x,h,()=> '');assert.doesNotMatch(front,/eins|one|zwei/);assert.match(front,/disabled/);const back=refreshCardView(session,data.words.x,h,()=> '');assert.match(back,/eins \/ one, zwei/);assert.doesNotMatch(back,/disabled/);assert.doesNotMatch(back,/answer-form|meaningRequirement/);});
function swipeFixture(){
 const listeners={},ratings=[],classes=new Set(['is-flipped']);
 const card={style:{},classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)},addEventListener:(name,listener)=>listeners[name]=listener,setPointerCapture(){}};
 bindRefreshSwipe(card,known=>ratings.push(known));
 const pointer=(name,x=100,y=100,id=1)=>listeners[name]({isPrimary:true,button:0,pointerId:id,clientX:x,clientY:y});
 const click=(detail=1)=>{let prevented=false,stopped=false;listeners.click({detail,preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});return {prevented,stopped};};
 return {card,classes,ratings,pointer,click};
}
test('Swipe direction, threshold, vertical scroll and cancellation are guarded',()=>{
 const f=swipeFixture(),down=()=>f.pointer('pointerdown'),up=(x,y)=>f.pointer('pointerup',x,y);
 down();up(180);down();up(20);down();up(120);down();up(180,250);
 f.classes.delete('is-flipped');down();up(180);f.classes.add('is-flipped');
 down();f.pointer('pointercancel');up(180);assert.deepEqual(f.ratings,[true,false]);
});
test('A flipped card follows horizontal dragging directly and restores its return transition on release',()=>{
 const f=swipeFixture();f.pointer('pointerdown');assert.equal(f.classes.has('is-dragging'),false);
 f.pointer('pointermove',130);assert.equal(f.classes.has('is-dragging'),true);assert.match(f.card.style.transform,/translateX\(19\.5px\)/);
 f.pointer('pointermove',140);assert.match(f.card.style.transform,/translateX\(26px\)/);
 f.pointer('pointerup',140);assert.equal(f.classes.has('is-dragging'),false);assert.equal(f.card.style.transform,'');assert.deepEqual(f.ratings,[]);
 assert.deepEqual(f.click(),{prevented:true,stopped:true},'a drag must not also flip the card');
});
test('Cancellation and lost capture restore the card without rating; another pointer cannot interrupt a drag',()=>{
 for(const ending of ['pointercancel','lostpointercapture']){
  const f=swipeFixture();f.pointer('pointerdown');f.pointer('pointermove',180);
  f.pointer(ending,180,100,2);assert.equal(f.classes.has('is-dragging'),true);
  f.pointer(ending);assert.equal(f.classes.has('is-dragging'),false);assert.equal(f.card.style.transform,'');
  f.pointer('pointerup',180);assert.deepEqual(f.ratings,[]);assert.deepEqual(f.click(),{prevented:true,stopped:true});
  f.pointer('pointerdown');f.pointer('pointermove',20);f.pointer('pointerup',20);assert.deepEqual(f.ratings,[false]);
 }
});
test('Vertical scrolling and unflipped cards never enter horizontal drag mode',()=>{
 const f=swipeFixture();f.pointer('pointerdown');f.pointer('pointermove',110,160);
 assert.equal(f.classes.has('is-dragging'),false);assert.equal(f.card.style.transform,undefined);f.pointer('pointercancel');
 f.classes.delete('is-flipped');f.pointer('pointerdown');f.pointer('pointermove',180);
 assert.equal(f.classes.has('is-dragging'),false);assert.equal(f.card.style.transform,'');f.pointer('pointerup',180);assert.deepEqual(f.ratings,[]);
});
test('Ordinary taps and keyboard clicks remain available, including capture loss after pointerup',()=>{
 const f=swipeFixture();f.classes.delete('is-flipped');f.pointer('pointerdown');f.pointer('pointerup');f.pointer('lostpointercapture');
 assert.deepEqual(f.click(),{prevented:false,stopped:false});assert.deepEqual(f.click(0),{prevented:false,stopped:false});
 f.classes.add('is-flipped');f.pointer('pointerdown');f.pointer('pointermove',140);f.pointer('pointercancel');
 assert.deepEqual(f.click(0),{prevented:false,stopped:false},'a cancelled swipe must not swallow a later keyboard activation');
 assert.deepEqual(f.ratings,[]);
});
