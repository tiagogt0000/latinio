import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tablePracticeUI,tablePracticeCard,prefixPracticeCard} from '../app/table-practice.js';

const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function fixture({id='learner',values=new Map(),storageOverride}={}){
 const storage=storageOverride||{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const calls={renders:0,go:[],notices:[]};
 const options={profile:{id,role:'student'},storage,h,go:target=>calls.go.push(target),render:()=>calls.renders++,notify:message=>calls.notices.push(message)};
 const ui=tablePracticeUI(options);
 return {ui,options,values,calls,button:(action,extra={})=>ui.handle({dataset:{action,...extra}}),filter:(dimension,value,checked)=>ui.change({dataset:{tableFilter:dimension},value,checked}),answer:(id,value)=>ui.input({dataset:{tableAnswer:id},value})};
}
function basicRound(f){
 assert.equal(f.button('tables-open'),true);
 assert.equal(f.button('tables-case-basic'),true);
 f.filter('numbers','pl',false);f.filter('genders','f',false);f.filter('genders','n',false);
 assert.equal(f.button('tables-start'),true);
 return f.ui.draft.tableRound;
}
test('Case selection creates only nominative and accusative singular masculine tasks',()=>{
 const f=fixture(),round=basicRound(f);
 assert.equal(f.ui.draft.tableMode,'worksheet');
 assert.deepEqual(round.filters.cases,['nom','acc']);assert.deepEqual(round.filters.numbers,['sg']);assert.deepEqual(round.filters.genders,['m']);
 assert.equal(round.itemIds.length,2);assert.equal(new Set(round.itemIds).size,2);assert.equal(round.checked,false);
 assert.match(f.ui.view(),/Nominativ/);assert.match(f.ui.view(),/Akkusativ/);
 f.answer(round.itemIds[0],'magnus');f.answer(round.itemIds[1],'magnum');f.ui.submit({id:'table-practice-form'});
 assert.match(f.ui.view(),/2 von 2 richtig/);assert.doesNotMatch(f.ui.view(),/Nur Fehler wiederholen/);
});
test('An empty case selection cannot start; selecting all restores a complete table',()=>{
 const f=fixture();f.button('tables-open');f.button('tables-filter-all',{dimension:'cases'});
 assert.deepEqual(f.ui.draft.filters.adjectives.cases,[]);f.button('tables-start');
 assert.equal(f.ui.draft.tableRound,null);assert.equal(f.ui.draft.tableMode,'setup');
 f.button('tables-filter-all',{dimension:'cases'});f.button('tables-start');
 assert.equal(f.ui.draft.tableRound.itemIds.length,30);
});
test('Answers and filters survive reopening and are isolated by profile',()=>{
 const values=new Map(),f=fixture({values});const round=basicRound(f),id=round.itemIds[0],before=f.calls.renders;
 f.answer(id,'magnus');assert.equal(f.calls.renders,before,'typing must not replace the focused input');
 const reopened=fixture({values});assert.deepEqual(reopened.ui.draft.tableRound,f.ui.draft.tableRound);
 assert.equal(reopened.ui.draft.tableRound.answers[id],'magnus');assert.deepEqual(reopened.ui.draft.filters,f.ui.draft.filters);
 const other=fixture({id:'other-learner',values});assert.equal(other.ui.draft.tableRound,null);assert.equal(other.ui.draft.prefixRound,null);
 other.button('prefixes-open');other.answer(other.ui.draft.prefixRound.itemIds[0],'ab');
 assert.equal(fixture({values}).ui.draft.tableRound.answers[id],'magnus');assert.equal(fixture({values}).ui.draft.prefixRound,null);
});
test('Switching between prefixes and tables preserves each unfinished worksheet',()=>{
 const f=fixture(),table=basicRound(f);f.answer(table.itemIds[0],'magnus');f.button('prefixes-open');
 const prefix=f.ui.draft.prefixRound;assert.equal(prefix.itemIds.length,11);f.answer(prefix.itemIds[0],'weg');f.button('tables-open');
 assert.equal(f.ui.draft.tableRound.answers[table.itemIds[0]],'magnus');f.button('prefixes-open');
 assert.equal(f.ui.draft.prefixRound.answers[prefix.itemIds[0]],'weg');
});
test('Prefix batch grading includes blank answers; error retry starts with empty fields',()=>{
 const f=fixture();f.button('prefixes-open');const ids=[...f.ui.draft.prefixRound.itemIds];
 assert.equal(ids.length,11);assert.ok(Object.values(f.ui.draft.prefixRound.answers).every(value=>!value));
 assert.equal((f.ui.view().match(/data-table-answer=/g)||[]).length,11);
 f.answer(ids[0],'weg');f.answer(ids[1],'bestimmt falsch');assert.equal(f.ui.draft.prefixRound.checked,false);
 assert.equal(f.ui.submit({id:'table-practice-form',querySelectorAll:()=>[]}),true);assert.equal(f.ui.draft.prefixRound.checked,true);
 assert.match(f.ui.view(),/1 von 11 richtig/);assert.match(f.ui.view(),/Nicht beantwortet/);
 const reopened=fixture({values:f.values});assert.equal(reopened.ui.draft.prefixRound.checked,true);reopened.button('tables-repeat-wrong');
 const retry=reopened.ui.draft.prefixRound;assert.equal(retry.checked,false);assert.deepEqual(retry.itemIds,ids.slice(1));
 assert.ok(Object.values(retry.answers).every(value=>!value));
 reopened.ui.submit({id:'table-practice-form',querySelectorAll:()=>[]});reopened.button('tables-repeat-wrong');
 assert.deepEqual(reopened.ui.draft.prefixRound.itemIds,ids.slice(1));
});
test('Submit captures the latest DOM value even when no input event fired',()=>{
 const f=fixture();f.button('prefixes-open');const ids=f.ui.draft.prefixRound.itemIds;
 assert.equal(f.ui.submit({id:'table-practice-form',querySelectorAll:()=>[{dataset:{tableAnswer:ids[0]},value:'weg'}]}),true);
 assert.equal(f.ui.draft.prefixRound.answers[ids[0]],'weg');f.button('tables-repeat-wrong');
 assert.equal(f.ui.draft.prefixRound.itemIds.length,10);assert.ok(!f.ui.draft.prefixRound.itemIds.includes(ids[0]));
});
test('User-entered HTML stays escaped in restored worksheets',()=>{
 const f=fixture(),round=basicRound(f),answer='"><img src=x onerror=alert(1)>';
 f.answer(round.itemIds[0],answer);const reopened=fixture({values:f.values});
 assert.equal(reopened.ui.draft.tableRound.answers[round.itemIds[0]],answer);
 assert.ok(!reopened.ui.view().includes('<img src=x'));assert.match(reopened.ui.view(),/&lt;img/);
});
test('Unrelated events pass through synchronously without altering table state',()=>{
 const f=fixture(),before=f.ui.draft;
 assert.equal(f.button('nav'),false);assert.equal(f.ui.input({dataset:{},value:'unrelated'}),false);
 assert.equal(f.ui.change({dataset:{},value:'unrelated'}),false);assert.equal(f.ui.submit({id:'word-form'}),false);
 assert.deepEqual(f.ui.draft,before);assert.match(tablePracticeCard(),/data-action="tables-open"/);assert.match(prefixPracticeCard(),/data-action="prefixes-open"/);
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const file of ['table-content.js','table-practice.js','table-practice.css'])assert.ok(sw.includes('./app/'+file));
});
test('Corrupt or unavailable storage does not prevent practice and failed saves are visible',()=>{
 const f=fixture({values:new Map([['latinio-tables-v1:learner','{bad json']])});assert.equal(basicRound(f).itemIds.length,2);
 const denied=fixture({storageOverride:{getItem(){throw Error('denied');},setItem(){throw Error('full');}}});
 denied.button('prefixes-open');assert.equal(denied.ui.draft.prefixRound.itemIds.length,11);assert.match(denied.ui.view(),/nicht gespeichert/);
});
test('Each table offers only applicable dimensions and preserves its own case selection',()=>{
 const f=fixture();f.button('tables-case-basic');
 f.ui.change({dataset:{tableChoice:''},value:'personal'});assert.match(f.ui.view(),/data-table-filter="persons"/);assert.doesNotMatch(f.ui.view(),/data-table-filter="genders"/);
 f.ui.change({dataset:{tableChoice:''},value:'perfect'});assert.match(f.ui.view(),/data-table-filter="targets"/);assert.doesNotMatch(f.ui.view(),/data-table-filter="cases"/);
 f.button('tables-start');assert.equal(f.ui.draft.tableRound.itemIds.length,9);
 f.button('tables-config');f.ui.change({dataset:{tableChoice:''},value:'adjectives'});assert.deepEqual(f.ui.draft.filters.adjectives.cases,['nom','acc']);
});
