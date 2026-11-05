import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {tablePracticeUI,tablePracticeCard,prefixPracticeCard} from '../app/table-practice.js';
import {TABLES,PREFIXES,selectTableItems} from '../app/table-content.js';
import {learningStep,learningResult} from '../app/table-learning.js';

const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clone=value=>JSON.parse(JSON.stringify(value));
const cacheKey=id=>'latinio-tables-v1:'+id;
function fixture({id='learner',values=new Map(),storageOverride}={}){
 const storage=storageOverride||{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const calls={renders:0,go:[],notices:[]};
 const options={profile:{id,role:'student'},storage,h,go:target=>calls.go.push(target),render:()=>calls.renders++,notify:message=>calls.notices.push(message)};
 const ui=tablePracticeUI(options);
 return {
  ui,options,values,calls,
  button:(action,extra={})=>ui.handle({dataset:{action,...extra}}),
  filter:(dimension,value,checked)=>ui.change({dataset:{tableFilter:dimension},value,checked}),
  answer:(id,value)=>ui.input({dataset:{tableAnswer:id},value}),
  submit:(learning=false,fields=[])=>ui.submit({id:learning?'table-learning-form':'table-practice-form',querySelectorAll:()=>fields}),
 };
}
function select(f,tableId='adjectives'){
 assert.equal(f.button('tables-open'),true);
 assert.equal(f.button('tables-select',{tableId}),true);
}
function basicRound(f){
 select(f);
 f.button('tables-case-basic');
 f.filter('numbers','pl',false);f.filter('genders','f',false);f.filter('genders','n',false);
 assert.equal(f.button('tables-start'),true);
 return f.ui.draft.tableRound;
}
function prefixes(f,learning=false){
 f.button('prefixes-open');
 f.button(learning?'prefixes-learn':'prefixes-start');
 return learning?f.ui.draft.prefixLearning:f.ui.draft.prefixRound;
}
function dativeCourse(f){
 select(f,'relative');
 f.button('tables-filter-all',{dimension:'cases'});
 f.filter('cases','dat',true);
 assert.equal(f.button('tables-learn'),true);
 return f.ui.draft.tableLearning;
}
const courseOf=f=>f.ui.draft.kind==='prefixes'?f.ui.draft.prefixLearning:f.ui.draft.tableLearning;
const itemsOf=course=>course.tableId?selectTableItems(course.tableId,course.filters):PREFIXES;
const stepOf=f=>learningStep(courseOf(f).session);
function place(f,targetId,tokenId=targetId){
 assert.equal(f.button('tables-token',{tokenId}),true);
 assert.equal(f.button('tables-place',{targetId}),true);
}
function matchAll(f){
 for(const item of itemsOf(courseOf(f)))place(f,item.id);
 f.submit(true);
 assert.equal(learningResult(courseOf(f).session,itemsOf(courseOf(f))).passed,true);
 f.button('tables-learning-next');
}
function fillBlanks(f){
 const byId=new Map(itemsOf(courseOf(f)).map(item=>[item.id,item]));
 for(const id of stepOf(f).blankIds)f.answer(id,byId.get(id).accepted[0]);
}
function toWriting(f){
 f.button('tables-learning-next');
 assert.equal(stepOf(f).kind,'match');
 matchAll(f);
 assert.equal(stepOf(f).kind,'write');
}
function inputTags(html){return html.match(/<input\b[^>]*data-table-answer="[^"]+"[^>]*>/g)||[];}
function fakeNode(dataset={},textContent=''){
 return {dataset,textContent,disabled:false,classList:{add(){},remove(){}},closest(selector){return selector==='[data-token-id]'&&this.dataset.tokenId?this:selector==='[data-target-id]'&&this.dataset.targetId?this:null;}};
}
function dragEvent(type,target,extra={}){
 const values=new Map();
 return {type,target,prevented:false,preventDefault(){this.prevented=true;},dataTransfer:{setData:(key,value)=>values.set(key,value),getData:key=>values.get(key)||''},values,...extra};
}

test('The catalogue presents all five tables before filters and offers practice or direct testing',()=>{
 const f=fixture();
 assert.equal(f.button('tables-open'),true);
 assert.equal(f.ui.draft.tableMode,'catalog');
 const catalog=f.ui.view();
 assert.equal((catalog.match(/data-action="tables-select"/g)||[]).length,5);
 for(const table of TABLES)assert.ok(catalog.includes('data-table-id="'+table.id+'"'));
 assert.doesNotMatch(catalog,/data-table-filter=/);
 f.button('tables-select',{tableId:'relative'});
 assert.equal(f.ui.draft.tableMode,'setup');
 assert.equal(f.ui.draft.tableId,'relative');
 assert.match(f.ui.view(),/data-action="tables-learn"/);
 assert.match(f.ui.view(),/data-action="tables-start"/);
 assert.match(f.ui.view(),/>Üben</);
 assert.match(f.ui.view(),/>Abfragen</);
 f.button('prefixes-open');
 assert.equal(f.ui.draft.prefixMode,'setup');
 assert.equal(f.ui.draft.prefixRound,null);
 assert.equal(f.ui.draft.prefixLearning,null);
 assert.match(f.ui.view(),/data-action="prefixes-learn"/);
 assert.match(f.ui.view(),/data-action="prefixes-start"/);
 assert.equal(inputTags(f.ui.view()).length,0);
});

test('Classic case selection grades only nominative and accusative singular masculine forms',()=>{
 const f=fixture(),round=basicRound(f);
 assert.equal(f.ui.draft.tableMode,'worksheet');
 assert.deepEqual(round.filters,{cases:['nom','acc'],numbers:['sg'],genders:['m']});
 assert.equal(round.itemIds.length,2);
 assert.equal(round.checked,false);
 assert.match(f.ui.view(),/Nominativ/);assert.match(f.ui.view(),/Akkusativ/);
 f.answer(round.itemIds[0],'magnus');f.answer(round.itemIds[1],'magnum');f.submit();
 assert.match(f.ui.view(),/2 von 2 richtig/);assert.doesNotMatch(f.ui.view(),/Nur Fehler wiederholen/);
});

test('An empty selection blocks both learning modes and each table keeps its applicable dimensions',()=>{
 const f=fixture();select(f);
 f.button('tables-case-basic');
 f.button('tables-select',{tableId:'personal'});
 assert.match(f.ui.view(),/data-table-filter="persons"/);
 assert.doesNotMatch(f.ui.view(),/data-table-filter="genders"/);
 f.button('tables-select',{tableId:'perfect'});
 assert.match(f.ui.view(),/data-table-filter="targets"/);
 assert.doesNotMatch(f.ui.view(),/data-table-filter="cases"/);
 f.button('tables-start');assert.equal(f.ui.draft.tableRound.itemIds.length,9);
 f.button('tables-select',{tableId:'adjectives'});
 assert.deepEqual(f.ui.draft.filters.adjectives.cases,['nom','acc']);
 f.button('tables-filter-all',{dimension:'cases'});
 f.button('tables-filter-all',{dimension:'cases'});
 assert.deepEqual(f.ui.draft.filters.adjectives.cases,[]);
 for(const action of ['tables-start','tables-learn']){
  f.button(action);
  assert.equal(f.ui.draft.tableMode,'setup');
  assert.equal(f.ui.draft.tableLearning,null);
  assert.equal(f.ui.draft.tableRound.tableId,'perfect','invalid selection must not replace a saved round');
 }
 assert.equal(f.calls.notices.length,2);
 f.button('tables-filter-all',{dimension:'cases'});f.button('tables-start');
 assert.equal(f.ui.draft.tableRound.itemIds.length,30);
});

test('Classic table and prefix drafts survive catalogue navigation, resume, and profile changes',()=>{
 const values=new Map(),f=fixture({values}),round=basicRound(f),id=round.itemIds[0],renders=f.calls.renders;
 f.answer(id,'magnus');assert.equal(f.calls.renders,renders,'typing must not replace the focused input');
 f.button('tables-open');assert.equal(f.ui.draft.tableMode,'catalog');
 assert.equal(f.ui.draft.tableRound.answers[id],'magnus');
 f.button('tables-resume');assert.equal(f.ui.draft.tableMode,'worksheet');
 const prefix=prefixes(f);f.answer(prefix.itemIds[0],'weg');
 f.button('prefixes-open');assert.equal(f.ui.draft.prefixMode,'setup');
 f.button('prefixes-resume');assert.equal(f.ui.draft.prefixMode,'worksheet');
 const reopened=fixture({values});
 assert.deepEqual(reopened.ui.draft.tableRound,f.ui.draft.tableRound);
 assert.deepEqual(reopened.ui.draft.prefixRound,f.ui.draft.prefixRound);
 assert.deepEqual(reopened.ui.draft.filters,f.ui.draft.filters);
 const other=fixture({id:'other-learner',values});
 assert.equal(other.ui.draft.tableRound,null);assert.equal(other.ui.draft.prefixRound,null);
 prefixes(other);other.answer('ab','ab');
 assert.equal(fixture({values}).ui.draft.prefixRound.answers.ab,'weg');
});

test('Classic prefix grading includes unanswered fields and retries only errors with empty answers',()=>{
 const f=fixture(),ids=prefixes(f).itemIds;
 assert.equal(ids.length,11);assert.equal(inputTags(f.ui.view()).length,11);
 f.answer(ids[0],'weg');f.answer(ids[1],'bestimmt falsch');
 assert.equal(f.ui.draft.prefixRound.checked,false);
 assert.equal(f.submit(),true);assert.match(f.ui.view(),/1 von 11 richtig/);
 assert.match(f.ui.view(),/Nicht beantwortet/);
 const reopened=fixture({values:f.values});
 assert.equal(reopened.ui.draft.prefixRound.checked,true);
 reopened.button('tables-repeat-wrong');
 assert.deepEqual(reopened.ui.draft.prefixRound.itemIds,ids.slice(1));
 assert.ok(Object.values(reopened.ui.draft.prefixRound.answers).every(value=>!value));
 reopened.submit();reopened.button('tables-repeat-wrong');
 assert.deepEqual(reopened.ui.draft.prefixRound.itemIds,ids.slice(1));
});

test('Classic submit captures the current DOM value without an earlier input event',()=>{
 const f=fixture(),ids=prefixes(f).itemIds;
 assert.equal(f.submit(false,[{dataset:{tableAnswer:ids[0]},value:'weg'}]),true);
 assert.equal(f.ui.draft.prefixRound.answers[ids[0]],'weg');
 f.button('tables-repeat-wrong');
 assert.equal(f.ui.draft.prefixRound.itemIds.length,10);
 assert.ok(!f.ui.draft.prefixRound.itemIds.includes(ids[0]));
});

test('A complete Dativ course progresses from study through matching to 3, 5, then 6 written forms',()=>{
 const f=fixture(),course=dativeCourse(f);
 assert.equal(course.session.itemIds.length,6);
 assert.equal(f.ui.draft.tableRound,null);
 assert.equal(stepOf(f).kind,'study');assert.equal(inputTags(f.ui.view()).length,0);
 assert.match(f.ui.view(),/cui/);assert.match(f.ui.view(),/quibus/);
 f.button('tables-learning-next');
 assert.equal(stepOf(f).kind,'match');
 assert.equal((f.ui.view().match(/data-action="tables-token"/g)||[]).length,6);
 assert.equal((f.ui.view().match(/data-target-id=/g)||[]).length,6);
 const items=itemsOf(course);
 for(const number of ['sg','pl']){
  const group=items.filter(item=>item.number===number);
  group.forEach((item,index)=>place(f,item.id,group[(index+1)%group.length].id));
 }
 f.submit(true);
 assert.match(f.ui.view(),/6 von 6 richtig/,'equal forms must be interchangeable');
 f.button('tables-learning-next');
 let previous=[];
 for(const count of [3,5,6]){
  const step=stepOf(f),html=f.ui.view(),inputs=inputTags(html);
  assert.equal(step.kind,'write');assert.equal(step.blankIds.length,count);
  assert.deepEqual(step.blankIds.slice(0,previous.length),previous);
  assert.equal(inputs.length,count);
  assert.ok(inputs.every(tag=>/value=""/.test(tag)&&!/readonly|data-answer=/.test(tag)));
  assert.equal((html.match(/class="table-study-value /g)||[]).length,6-count);
  assert.doesNotMatch(html,/Lösung:|Richtig ist|table-cell-feedback/);
  const before=f.calls.renders;fillBlanks(f);
  assert.equal(f.calls.renders,before,'writing must not replace focused inputs');
  f.submit(true);assert.match(f.ui.view(),new RegExp(count+' von '+count+' richtig'));
  assert.ok(inputTags(f.ui.view()).every(tag=>/readonly/.test(tag)));
  previous=step.blankIds;
  f.button('tables-learning-next');
 }
 assert.equal(stepOf(f).kind,'done');
 assert.match(f.ui.view(),/Du hast alles selbst ausgefüllt/);
 f.button('tables-course-test');
 assert.equal(f.ui.draft.tableMode,'worksheet');
 assert.equal(inputTags(f.ui.view()).length,6);
 assert.ok(Object.values(f.ui.draft.tableRound.answers).every(value=>!value));
});

test('A failed match locks placements, reviews solutions, and retries the same stage without advancing',()=>{
 const f=fixture(),course=dativeCourse(f),items=itemsOf(course);
 f.button('tables-learning-next');
 const singular=items.find(item=>item.number==='sg'),plural=items.find(item=>item.number==='pl');
 place(f,singular.id,plural.id);
 f.submit(true);
 assert.equal(courseOf(f).session.checked,true);assert.match(f.ui.view(),/Noch nicht richtig/);
 const before=clone(courseOf(f).session.placements);
 place(f,singular.id,singular.id);
 assert.deepEqual(clone(courseOf(f).session.placements),before);
 f.button('tables-learning-next');
 assert.equal(stepOf(f).kind,'match');assert.equal(courseOf(f).session.reviewing,true);
 assert.match(f.ui.view(),/Noch einmal anschauen/);
 assert.doesNotMatch(f.ui.view(),/data-action="tables-token"/);
 const reopened=fixture({values:f.values});
 assert.equal(courseOf(reopened).session.reviewing,true);
 reopened.button('tables-learning-next');
 assert.equal(stepOf(reopened).kind,'match');
 assert.equal(courseOf(reopened).session.checked,false);
 assert.deepEqual(Object.keys(courseOf(reopened).session.placements),[]);
 assert.match(reopened.ui.view(),/data-action="tables-token"/);
});

test('Writing errors retry the same blank fields and capture DOM-only answers',()=>{
 const f=fixture();dativeCourse(f);toWriting(f);
 const ids=stepOf(f).blankIds;
 f.submit(true,[{dataset:{tableAnswer:ids[0]},value:'nicht richtig'}]);
 assert.equal(courseOf(f).session.answers[ids[0]],'nicht richtig');
 f.button('tables-learning-next');
 assert.equal(courseOf(f).session.reviewing,true);
 assert.equal(inputTags(f.ui.view()).length,0);
 f.button('tables-learning-next');
 assert.deepEqual(stepOf(f).blankIds,ids);
 assert.deepEqual(Object.keys(courseOf(f).session.answers),[]);
 const byId=new Map(itemsOf(courseOf(f)).map(item=>[item.id,item]));
 f.submit(true,ids.map(id=>({dataset:{tableAnswer:id},value:byId.get(id).answer})));
 assert.equal(learningResult(courseOf(f).session,itemsOf(courseOf(f))).passed,true);
});

test('Learning drafts restore independently for tables, prefixes, and another profile',()=>{
 const values=new Map(),f=fixture({values});
 dativeCourse(f);toWriting(f);
 const tableId=stepOf(f).blankIds[0];
 f.answer(tableId,'cui');
 const tableDraft=clone(f.ui.draft.tableLearning);
 prefixes(f,true);toWriting(f);
 const prefixId=stepOf(f).blankIds[0];
 f.answer(prefixId,'meine Antwort');
 const prefixDraft=clone(f.ui.draft.prefixLearning);
 f.button('tables-open');f.button('tables-resume-learning');
 assert.equal(f.ui.draft.kind,'tables');assert.equal(f.ui.draft.tableMode,'learning');
 assert.deepEqual(clone(f.ui.draft.tableLearning),tableDraft);
 f.button('prefixes-open');f.button('prefixes-resume-learning');
 const reopened=fixture({values});
 assert.deepEqual(clone(reopened.ui.draft.tableLearning),tableDraft);
 assert.deepEqual(clone(reopened.ui.draft.prefixLearning),prefixDraft);
 const other=fixture({id:'another',values});
 assert.equal(other.ui.draft.tableLearning,null);assert.equal(other.ui.draft.prefixLearning,null);
 prefixes(other,true);
 assert.deepEqual(clone(fixture({values}).ui.draft.prefixLearning),prefixDraft);
});

test('Prefix practice uses the same progression and keeps the classic all-eleven test available',()=>{
 const f=fixture(),course=prefixes(f,true);
 assert.equal(course.session.prefix,true);assert.equal(course.session.itemIds.length,11);
 assert.equal(stepOf(f).kind,'study');
 for(const item of PREFIXES)assert.ok(f.ui.view().includes(h(item.prompt)));
 toWriting(f);
 assert.equal(inputTags(f.ui.view()).length,6);
 assert.ok(inputTags(f.ui.view()).every(tag=>/lang="de"/.test(tag)));
 fillBlanks(f);f.submit(true);f.button('tables-learning-next');
 assert.equal(inputTags(f.ui.view()).length,9);
 fillBlanks(f);f.submit(true);f.button('tables-learning-next');
 assert.equal(inputTags(f.ui.view()).length,11);
 fillBlanks(f);f.submit(true);f.button('tables-learning-next');
 assert.equal(stepOf(f).kind,'done');
 f.button('tables-course-test');
 assert.equal(f.ui.draft.prefixMode,'worksheet');assert.equal(inputTags(f.ui.view()).length,11);
});

test('Returning to configuration uses the displayed worksheet, not an older learning course',()=>{
 const f=fixture();
 select(f,'adjectives');f.button('tables-learn');
 select(f,'relative');f.button('tables-case-basic');f.button('tables-start');
 f.button('tables-config');
 assert.equal(f.ui.draft.tableMode,'setup');
 assert.equal(f.ui.draft.tableId,'relative');
 assert.deepEqual(f.ui.draft.filters.relative.cases,['nom','acc']);
});

test('Existing v1 worksheet drafts migrate without losing answers or selection',()=>{
 const filters={cases:['nom','acc'],numbers:['sg'],genders:['m']},items=selectTableItems('adjectives',filters);
 const legacy={version:1,kind:'prefixes',tableId:'adjectives',filters:{adjectives:filters},tableMode:'worksheet',
  tableRound:{tableId:'adjectives',filters,itemIds:items.map(item=>item.id),answers:{[items[0].id]:'magnus',[items[1].id]:''},checked:false},
  prefixRound:{tableId:null,filters:null,itemIds:PREFIXES.map(item=>item.id),answers:{ab:'weg'},checked:true}};
 const f=fixture({values:new Map([[cacheKey('learner'),JSON.stringify(legacy)]])});
 assert.equal(f.ui.draft.version,2);assert.equal(f.ui.draft.prefixMode,'worksheet');
 assert.equal(f.ui.draft.prefixRound.answers.ab,'weg');assert.equal(f.ui.draft.prefixRound.checked,true);
 f.button('tables-resume');assert.equal(f.ui.draft.tableRound.answers[items[0].id],'magnus');
 assert.deepEqual(f.ui.draft.filters.adjectives,filters);
 assert.equal(f.ui.draft.tableLearning,null);assert.equal(f.ui.draft.prefixLearning,null);
});

test('HTML5 dragging preserves its source node and rejects external payloads',()=>{
 const f=fixture(),course=dativeCourse(f),[first,second]=course.session.itemIds;
 f.button('tables-learning-next');
 const source=fakeNode({tokenId:first}),target=fakeNode({targetId:second});
 const foreign=dragEvent('drop',target);foreign.dataTransfer.setData('application/x-latinio-table-token',first);
 assert.equal(f.ui.drag(foreign),false);
 assert.equal(Object.keys(courseOf(f).session.placements).length,0);
 const renders=f.calls.renders,start=dragEvent('dragstart',source);
 assert.equal(f.ui.drag(start),true);
 assert.equal(f.calls.renders,renders,'dragstart must keep the native drag source attached');
 assert.equal(start.values.get('application/x-latinio-table-token'),first);
 const over=dragEvent('dragover',target);
 assert.equal(f.ui.drag(over),true);assert.equal(over.prevented,true);
 const drop=dragEvent('drop',target);
 assert.equal(f.ui.drag(drop),true);assert.equal(drop.prevented,true);
 assert.equal(courseOf(f).session.placements[second],first);
 f.ui.drag(dragEvent('dragend',source));
 assert.equal(f.ui.drag(dragEvent('drop',fakeNode({targetId:first}))),false);
 f.button('tables-place',{targetId:second});
 assert.equal(courseOf(f).session.placements[second],undefined,'tapping a filled slot returns the token');
});

test('Touch dragging places a token, cleans up its ghost, and suppresses the following click',t=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');
 const f=fixture(),course=dativeCourse(f),[tokenId,targetId]=course.session.itemIds;
 f.button('tables-learning-next');
 const source=fakeNode({tokenId},'cui'),slot=fakeNode({targetId});
 let removed=0,appended=0;
 Object.defineProperty(globalThis,'document',{configurable:true,value:{
  querySelector:()=>null,querySelectorAll:()=>[],elementFromPoint:()=>slot,
  createElement:()=>({className:'',textContent:'',style:{},setAttribute(){},remove(){removed++;}}),
  body:{append(){appended++;}}
 }});
 t.after(()=>original?Object.defineProperty(globalThis,'document',original):delete globalThis.document);
 const pointer=(type,x,y)=>dragEvent(type,source,{pointerType:'touch',pointerId:7,clientX:x,clientY:y});
 const down=pointer('pointerdown',0,0),renders=f.calls.renders;
 assert.equal(f.ui.drag(down),true);assert.equal(down.prevented,false);
 assert.equal(f.calls.renders,renders);
 assert.equal(f.ui.drag(pointer('pointermove',3,2)),true);assert.equal(appended,0);
 const move=pointer('pointermove',20,12);
 assert.equal(f.ui.drag(move),true);assert.equal(move.prevented,true);assert.equal(appended,1);
 const up=pointer('pointerup',20,12);
 assert.equal(f.ui.drag(up),true);assert.equal(up.prevented,true);assert.equal(removed,1);
 assert.equal(courseOf(f).session.placements[targetId],tokenId);
 f.button('tables-place',{targetId});
 assert.equal(courseOf(f).session.placements[targetId],tokenId,'synthetic click must not undo the drop');
});

test('User input remains escaped in both worksheet and learning drafts',()=>{
 const answer='"><img src=x onerror=alert(1)>',f=fixture(),round=basicRound(f);
 f.answer(round.itemIds[0],answer);
 let reopened=fixture({values:f.values});
 assert.equal(reopened.ui.draft.tableRound.answers[round.itemIds[0]],answer);
 assert.ok(!reopened.ui.view().includes('<img src=x'));assert.match(reopened.ui.view(),/&lt;img/);
 dativeCourse(f);toWriting(f);const id=stepOf(f).blankIds[0];f.answer(id,answer);
 reopened=fixture({values:f.values});
 assert.equal(courseOf(reopened).session.answers[id],answer);
 assert.ok(!reopened.ui.view().includes('<img src=x'));assert.match(reopened.ui.view(),/&lt;img/);
});

test('Unrelated events pass synchronously and the offline shell includes the learning engine',()=>{
 const f=fixture(),before=f.ui.draft;
 assert.equal(f.button('nav'),false);
 assert.equal(f.ui.input({dataset:{},value:'unrelated'}),false);
 assert.equal(f.ui.change({dataset:{},value:'unrelated'}),false);
 assert.equal(f.ui.submit({id:'word-form'}),false);
 assert.equal(f.ui.drag(dragEvent('dragstart',fakeNode())),false);
 assert.deepEqual(f.ui.draft,before);
 assert.match(tablePracticeCard(),/data-action="tables-open"/);assert.match(prefixPracticeCard(),/data-action="prefixes-open"/);
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const file of ['table-content.js','table-learning.js','table-practice.js','table-practice.css'])assert.ok(sw.includes('./app/'+file),file+' must be available offline');
});

test('Corrupt and unavailable storage leave both learning modes usable with a visible save warning',()=>{
 const f=fixture({values:new Map([[cacheKey('learner'),'{bad json']])});
 assert.equal(basicRound(f).itemIds.length,2);
 const denied=fixture({storageOverride:{getItem(){throw Error('denied');},setItem(){throw Error('full');}}});
 prefixes(denied,true);assert.equal(courseOf(denied).session.itemIds.length,11);
 assert.match(denied.ui.view(),/nicht gespeichert/);
 denied.button('prefixes-start');assert.equal(denied.ui.draft.prefixRound.itemIds.length,11);
 assert.match(denied.ui.view(),/nicht gespeichert/);
});

test('Main delegates drag and touch only to the ready, unobstructed Latin table screen',()=>{
 const source=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 const start=source.indexOf("for(const type of ['dragstart'");
 const end=source.indexOf('installKeyboardSupport(',start);
 assert.ok(start>=0&&end>start);
 const listeners=new Map(),received=[];
 const context=vm.createContext({ready:true,working:false,modalRoot:{children:[]},subject:'latin',screen:'tables',cloudWait:{blocked:true},
  document:{addEventListener:(type,listener)=>listeners.set(type,listener)},tablePractice:{drag:event=>received.push(event.type)}});
 vm.runInContext(source.slice(start,end),context);
 const types=['dragstart','dragover','drop','dragend','pointerdown','pointermove','pointerup','pointercancel'];
 for(const type of types){assert.ok(listeners.has(type));listeners.get(type)({type});}
 assert.deepEqual(received,types,'static practice must work while the initial cloud sync is pending');
 for(const blocked of [{ready:false},{working:true},{subject:'english'},{screen:'learn'},{modalRoot:{children:[{}]}}]){
  Object.assign(context,{ready:true,working:false,subject:'latin',screen:'tables',modalRoot:{children:[]}},blocked);
  for(const type of types)listeners.get(type)({type});
 }
 assert.deepEqual(received,types,'background screens, startup and modals must not receive drag events');
});
