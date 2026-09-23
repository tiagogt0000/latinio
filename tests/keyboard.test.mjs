import test from 'node:test';
import assert from 'node:assert/strict';
import {installKeyboardSupport} from '../app/keyboard.js';

function harness(){
 const listeners={},calls=[],fields=[];let isActive=true,current={feedback:null},hasAdd=true;
 const root={addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){},querySelectorAll:()=>fields,querySelector:selector=>selector.includes('add-answer')&&hasAdd?{}:null};
 const dispose=installKeyboardSupport({root,active:()=>isActive,session:()=>current,submit:()=>calls.push('submit'),next:()=>calls.push('next'),addField:()=>{calls.push('add');fields.push({name:'answer',focus(){calls.push('focus-new');}});}});
 const fire=(key,target=fields[0],extra={})=>{let prevented=false;listeners.keydown({key,target,defaultPrevented:false,altKey:false,ctrlKey:false,metaKey:false,preventDefault(){prevented=true;},...extra});return prevented;};
 const first={name:'answer',closest:()=>true,focus(){calls.push('focus-first');}},second={name:'answer',closest:()=>true,focus(){calls.push('focus-second');}};fields.push(first,second);
 return {calls,fields,fire,first,second,set active(x){isActive=x;},set session(x){current=x;},set addAvailable(x){hasAdd=x;},dispose};
}
test('ArrowDown advances answer fields; at the last field it adds and focuses another',async()=>{
 const h=harness();assert.equal(h.fire('ArrowDown',h.first),true);assert.deepEqual(h.calls,['focus-second']);h.calls.length=0;
 assert.equal(h.fire('ArrowDown',h.second),true);assert.deepEqual(h.calls,['add']);await new Promise(r=>setImmediate(r));assert.deepEqual(h.calls,['add','focus-new']);
});
test('Enter submits answers then advances feedback; refresh cards and non-test views are untouched',()=>{
 const h=harness();assert.equal(h.fire('Enter'),true);assert.deepEqual(h.calls,['submit']);h.session={feedback:{grade:'wrong'}};assert.equal(h.fire('Enter'),true);assert.deepEqual(h.calls,['submit','next']);
 h.active=false;assert.equal(h.fire('Enter'),false);h.active=true;h.session={feedback:null};assert.equal(h.fire('ArrowDown',h.first,{ctrlKey:true}),false);assert.deepEqual(h.calls,['submit','next']);h.dispose();
});
