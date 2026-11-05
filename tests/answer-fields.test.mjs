import test from 'node:test';
import assert from 'node:assert/strict';
import {appendAnswerField,hasAnswerContent} from '../app/answer-fields.js';

test('answer-field button appends and focuses a field synchronously without blurring by default',()=>{
 const calls=[],field={querySelector:()=>({focus:options=>calls.push(options)})},answers={children:[{},{}],insertAdjacentHTML:(position,html)=>calls.push([position,html]),get lastElementChild(){return field;}},root={querySelector:selector=>selector==='#answers'?answers:null};
 assert.equal(appendAnswerField(root,(value,index,disabled)=>`${value}:${index}:${disabled}`),true);
 assert.deepEqual(calls,[['beforeend',':2:false'],{preventScroll:true}]);
 assert.equal(appendAnswerField({querySelector:()=>null},()=>''),false);
});
test('answer content rejects empty and whitespace-only sets while keeping partial answers',()=>{
 for(const answers of [[],[''],['  ','\t\n','\u00a0'],null,undefined,['',null,undefined]])assert.equal(hasAnswerContent(answers),false);
 for(const answers of [['Antwort'],['  Antwort  ',''],['','zweite Bedeutung']])assert.equal(hasAnswerContent(answers),true);
});
test('appended answer fields reveal the clipped edge after receiving focus',()=>{
 const calls=[],view={innerHeight:500,scrollBy:options=>calls.push(['scroll',options])};
 const input={ownerDocument:{defaultView:view},isConnected:true,focus:options=>calls.push(['focus',options]),getBoundingClientRect:()=>({top:490,bottom:545}),scrollIntoView:options=>calls.push(['nearest',options])};
 const answers={children:[{}],insertAdjacentHTML(){},lastElementChild:{querySelector:()=>input}};
 assert.equal(appendAnswerField({querySelector:()=>answers},()=>'<input>'),true);
 assert.deepEqual(calls,[['focus',{preventScroll:true}],['nearest',{block:'nearest',inline:'nearest',behavior:'instant'}],['scroll',{top:61,left:0,behavior:'instant'}]]);
});
