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
function swipeFixture({animated=false}={}){
 const listeners={},ratings=[],classes=new Set(['is-flipped']),frames=new Map();let time=0,id=0,reduced=false;
 const card={isConnected:true,style:{},classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)},addEventListener:(name,listener)=>listeners[name]=listener,removeEventListener:name=>delete listeners[name],setPointerCapture(){}};
 const view={performance:{now:()=>time},matchMedia:()=>({matches:reduced}),...(animated?{requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)}:{})};
 const dispose=bindRefreshSwipe(card,known=>ratings.push(known),{view});
 const pointer=(name,x=100,y=100,id=1)=>listeners[name]({isPrimary:true,button:0,pointerId:id,clientX:x,clientY:y});
 const click=(detail=1)=>{let prevented=false,stopped=false;listeners.click({detail,preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});return {prevented,stopped};};
 const advance=ms=>{time+=ms;const batch=[...frames];frames.clear();for(const [,callback] of batch)callback(time);};
 const position=()=>Number(card.style.transform?.match(/translateX\(([-\d.e]+)px\)/)?.[1]||0);
 return {card,classes,ratings,pointer,click,advance,position,frames,dispose,reduce:()=>{reduced=true;},listeners};
}
test('Swipe direction, threshold, vertical scroll and cancellation are guarded',()=>{
 const f=swipeFixture(),down=()=>f.pointer('pointerdown'),up=(x,y)=>f.pointer('pointerup',x,y);
 down();up(180);down();up(20);down();up(120);down();up(180,250);
 f.classes.delete('is-flipped');down();up(180);f.classes.add('is-flipped');
 down();f.pointer('pointercancel');up(180);assert.deepEqual(f.ratings,[true,false]);
});
test('A flipped card follows horizontal dragging directly and restores its return transition on release',()=>{
 const f=swipeFixture();f.pointer('pointerdown');assert.equal(f.classes.has('is-dragging'),false);
 f.pointer('pointermove',130);assert.equal(f.classes.has('is-dragging'),true);assert.equal(f.position(),30);
 f.pointer('pointermove',140);assert.equal(f.position(),40);assert.doesNotMatch(f.card.style.transform,/rotate/);
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
test('A returning card can be caught at its visible position; carried distance never rates the next gesture',()=>{
 const f=swipeFixture({animated:true});f.pointer('pointerdown');f.advance(16);f.pointer('pointermove',145);f.advance(100);f.pointer('pointerup',145);
 f.advance(80);const caught=f.position();assert.ok(caught>0&&caught<45);assert.equal(f.frames.size,1);
 f.pointer('pointerdown');assert.equal(f.position(),caught);assert.equal(f.frames.size,0);f.advance(32);assert.equal(f.position(),caught);
 f.pointer('pointermove',145);assert.equal(f.position(),caught+45);f.pointer('pointerup',145);
 assert.deepEqual(f.ratings,[],'only the new 45px drag counts, even with a carried offset');
 for(let i=0;i<70;i++)f.advance(16);
 assert.equal(f.position(),0);assert.equal(f.frames.size,0);f.dispose();
});
test('Return physics uses elapsed time and settles without oscillation after a paused drag',()=>{
 const fixtures=Array.from({length:2},()=>swipeFixture({animated:true}));
 for(const f of fixtures){f.pointer('pointerdown');f.advance(16);f.pointer('pointermove',140);f.advance(100);f.pointer('pointerup',140);}
 fixtures[0].advance(96);for(let i=0;i<6;i++)fixtures[1].advance(16);
 assert.ok(Math.abs(fixtures[0].position()-fixtures[1].position())<1e-8,'frame count must not change the motion');
 const f=fixtures[0];let previous=f.position();
 for(let i=0;i<70;i++){f.advance(16);assert.ok(f.position()>=0&&f.position()<=previous);previous=f.position();}
 assert.equal(f.position(),0);assert.equal(f.frames.size,0);fixtures.forEach(item=>item.dispose());
});
test('Release carries recent velocity, while holding still clears stale momentum',()=>{
 const quick=swipeFixture({animated:true}),held=swipeFixture({animated:true});
 for(const f of [quick,held]){f.pointer('pointerdown');f.advance(16);f.pointer('pointermove',120);}
 quick.pointer('pointerup',120);held.advance(100);held.pointer('pointerup',120);
 quick.advance(16);held.advance(16);
 assert.ok(quick.position()>20,'recent outward movement continues briefly');assert.ok(held.position()<20,'a held card returns without an outward fling');
 assert.deepEqual(quick.ratings,[]);assert.deepEqual(held.ratings,[]);quick.dispose();held.dispose();
});
test('Vertical intent cannot become a rating after a diagonal scroll ends sideways',()=>{
 const f=swipeFixture({animated:true});f.pointer('pointerdown');f.pointer('pointermove',105,130);f.pointer('pointerup',180,130);
 assert.deepEqual(f.ratings,[]);assert.equal(f.position(),0);assert.equal(f.frames.size,0);assert.deepEqual(f.click(),{prevented:true,stopped:true});f.dispose();
});
test('Reduced motion keeps direct tracking but skips return momentum, including a preference change mid-return',()=>{
 const f=swipeFixture({animated:true});f.reduce();f.pointer('pointerdown');f.advance(16);f.pointer('pointermove',140);assert.equal(f.position(),40);f.pointer('pointerup',140);
 assert.equal(f.position(),0);assert.equal(f.frames.size,0);f.dispose();
 const changing=swipeFixture({animated:true});changing.pointer('pointerdown');changing.advance(16);changing.pointer('pointermove',140);changing.pointer('pointerup',140);assert.equal(changing.frames.size,1);
 changing.reduce();changing.advance(16);assert.equal(changing.position(),0);assert.equal(changing.frames.size,0);changing.dispose();
});
test('Detached cards, disposal, and keyboard activation stop pending returns',()=>{
 for(const ending of ['detach','dispose','keyboard']){
  const f=swipeFixture({animated:true});f.pointer('pointerdown');f.advance(16);f.pointer('pointermove',140);f.pointer('pointerup',140);assert.equal(f.frames.size,1);
  if(ending==='detach'){const previous=f.card.style.transform;f.card.isConnected=false;f.advance(16);assert.equal(f.card.style.transform,previous,'animation must not write to a removed card');}
  if(ending==='dispose'){f.dispose();assert.deepEqual(Object.keys(f.listeners),[]);}
  if(ending==='keyboard')assert.deepEqual(f.click(0),{prevented:false,stopped:false});
  assert.equal(f.frames.size,0);if(ending!=='detach')assert.equal(f.position(),0);assert.deepEqual(f.ratings,[]);f.dispose();
 }
});
