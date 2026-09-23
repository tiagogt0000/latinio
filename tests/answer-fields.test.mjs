import test from 'node:test';
import assert from 'node:assert/strict';
import {appendAnswerField} from '../app/answer-fields.js';

test('answer-field button appends and focuses a field synchronously without blurring by default',()=>{
 const calls=[],field={querySelector:()=>({focus:options=>calls.push(options)})},answers={children:[{},{}],insertAdjacentHTML:(position,html)=>calls.push([position,html]),get lastElementChild(){return field;}},root={querySelector:selector=>selector==='#answers'?answers:null};
 assert.equal(appendAnswerField(root,(value,index,disabled)=>`${value}:${index}:${disabled}`),true);
 assert.deepEqual(calls,[['beforeend',':2:false'],{preventScroll:true}]);
 assert.equal(appendAnswerField({querySelector:()=>null},()=>''),false);
});
