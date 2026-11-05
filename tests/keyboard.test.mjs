import test from 'node:test';
import assert from 'node:assert/strict';
import {installKeyboardSupport} from '../app/keyboard.js';

function harness(){
 const listeners={},calls=[],fields=[];let isActive=true,current={feedback:null},hasAdd=true;
 const root={addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){},querySelectorAll:()=>fields,querySelector:selector=>selector.includes('add-answer')&&hasAdd?{}:null};
 const dispose=installKeyboardSupport({root,active:()=>isActive,session:()=>current,submit:()=>calls.push('submit'),next:()=>calls.push('next'),rateCard:known=>calls.push(known?'known':'wrong'),beginCorrection:key=>calls.push('begin:'+key),submitCorrection:()=>calls.push('retry-submit'),addField:()=>{calls.push('add');fields.push({name:'answer',focus(){calls.push('focus-new');}});}});
 const fire=(key,target=fields[0],extra={})=>{let prevented=false;listeners.keydown({key,target,defaultPrevented:false,altKey:false,ctrlKey:false,metaKey:false,preventDefault(){prevented=true;},...extra});return prevented;};
 const first={name:'answer',value:'Antwort',closest:()=>true,focus(){calls.push('focus-first');}},second={name:'answer',value:'',closest:()=>true,focus(){calls.push('focus-second');}};fields.push(first,second);
 return {calls,fields,fire,first,second,set active(x){isActive=x;},set session(x){current=x;},set addAvailable(x){hasAdd=x;},dispose};
}
test('ArrowDown advances answer fields; at the last field it adds and focuses another',async()=>{
 const h=harness();assert.equal(h.fire('ArrowDown',h.first),true);assert.deepEqual(h.calls,['focus-second']);h.calls.length=0;
 assert.equal(h.fire('ArrowDown',h.second),true);assert.deepEqual(h.calls,['add']);await new Promise(r=>setImmediate(r));assert.deepEqual(h.calls,['add','focus-new']);
});
test('Enter submits answers and advances feedback, including when no answer field is focused',()=>{
 const h=harness();assert.equal(h.fire('Enter',{}),true);assert.deepEqual(h.calls,['submit']);h.session={feedback:{grade:'wrong'}};assert.equal(h.fire('Enter',{}),true);assert.deepEqual(h.calls,['submit','next']);
 h.active=false;assert.equal(h.fire('Enter'),false);h.active=true;h.session={feedback:null};assert.equal(h.fire('ArrowDown',h.first,{ctrlKey:true}),false);assert.deepEqual(h.calls,['submit','next']);h.dispose();
});
test('A typed hardware key opens an unscored retry; Enter checks until correct, then advances',()=>{
 const h=harness();h.session={feedback:{grade:'wrong'}};
 assert.equal(h.fire('f',{}),true);assert.deepEqual(h.calls,['begin:f']);
 h.session={feedback:{grade:'wrong'},correctionMode:true,correctionResult:{grade:'wrong'}};
 assert.equal(h.fire('Enter',{}),true);assert.deepEqual(h.calls,['begin:f','retry-submit']);
 h.session={feedback:{grade:'wrong'},correctionMode:true,correctionResult:{grade:'full'}};
 assert.equal(h.fire('Enter',{}),true);assert.deepEqual(h.calls,['begin:f','retry-submit','next']);h.dispose();
});
test('left and right arrows rate flipped refresh cards like swiping',()=>{
 const h=harness();h.session={mode:'inactive-check',cardFlipped:false};assert.equal(h.fire('ArrowRight',{}),false);h.session={mode:'inactive-check',cardFlipped:true};assert.equal(h.fire('ArrowLeft',{}),true);assert.equal(h.fire('ArrowRight',{}),true);assert.deepEqual(h.calls,['wrong','known']);h.dispose();
});
test('Enter in an empty or whitespace answer never submits another filled answer',()=>{
 const h=harness();
 for(const value of ['', '  ', '\t\n', '\u00a0']){
  h.second.value=value;assert.equal(h.fire('Enter',h.second),true);
 }
 assert.deepEqual(h.calls,[]);
 h.second.value='zweite Bedeutung';assert.equal(h.fire('Enter',h.second),true);
 assert.deepEqual(h.calls,['submit']);h.dispose();
});
test('all-empty answers cannot be submitted with Enter outside a field',()=>{
 const h=harness();h.first.value=' ';h.second.value='';
 assert.equal(h.fire('Enter',{}),true);assert.deepEqual(h.calls,[]);
 h.first.value='Antwort';assert.equal(h.fire('Enter',{}),true);assert.deepEqual(h.calls,['submit']);h.dispose();
});
test('empty correction input is guarded while feedback Enter still advances',()=>{
 const h=harness();h.session={feedback:{grade:'wrong'},correctionMode:true};
 assert.equal(h.fire('Enter',h.second),true);assert.deepEqual(h.calls,[]);
 h.first.value=' ';assert.equal(h.fire('Enter',{}),true);assert.deepEqual(h.calls,[]);
 h.first.value='Antwort';assert.equal(h.fire('Enter',h.first),true);assert.deepEqual(h.calls,['retry-submit']);
 h.session={feedback:{grade:'wrong'}};assert.equal(h.fire('Enter',h.second),true);
 h.session={feedback:{grade:'wrong'},correctionMode:true,correctionResult:{grade:'full'}};
 assert.equal(h.fire('Enter',h.second),true);assert.deepEqual(h.calls,['retry-submit','next','next']);h.dispose();
});
test('IME composition keys never submit, navigate or start a correction',()=>{
 const h=harness();assert.equal(h.fire('Enter',h.first,{isComposing:true}),false);
 assert.equal(h.fire('Enter',h.first,{keyCode:229}),false);
 assert.equal(h.fire('ArrowDown',h.first,{isComposing:true}),false);
 h.session={feedback:{grade:'wrong'}};assert.equal(h.fire('a',h.first,{isComposing:true}),false);
 assert.deepEqual(h.calls,[]);h.dispose();
});
test('a pending added-field focus is cancelled when keyboard support is disposed',async()=>{
 const h=harness();h.fire('ArrowDown',h.second);h.dispose();
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.calls,['add']);
});
