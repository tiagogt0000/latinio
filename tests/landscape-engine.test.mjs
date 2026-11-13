import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY, emptyLandscape, dayKey, updateInventory, buildRound, currentTask, submitAnswer, advanceRound, requestGrammarHelp, learningModel, planNext, evaluateWord, evaluateSentence, matchingGroups, validateExam} from '../app/landscape-engine.js';
import {endingCells, BOOK_CASES} from '../app/landscape-curriculum.js';

const T=Date.parse('2026-11-13T12:00:00Z');
function data(count=6, collections=1) {
  const value={collections:{},words:{},reviews:{},settings:{}};
  for(let c=0;c<collections;c++){
    const collectionId=`lesson${c}`;value.collections[collectionId]={id:collectionId,name:`Lektion ${c+1}`};
    for(let i=0;i<count;i++){const id=`${collectionId}-w${i}`;value.words[id]={id,collectionId,latin:`verbum${c}-${i}`,meanings:[[String.fromCharCode(65+i)+'wort'],['Bedeutung'+i]]};}
  }return value;
}
const answerFor=task=>task.kind==='cards'?true:task.kind==='grammar'?Object.fromEntries(task.cells.filter(c=>task.hiddenIds.includes(c.id)).map(c=>[c.id,c.answer])):task.word?.meanings.map(g=>g[0]);
function finishRound(round,{wrongIds=[],now=T}={}) {
  const events=[];let ticks=0;
  while(round.phase!=='complete') {
    if(++ticks>1000)throw Error('Non-terminating round');
    const task=currentTask(round);
    if(round.phase==='checkpoint' || round.phase==='feedback' || task?.stage==='study'){round=advanceRound(round,{now:now+ticks});continue;}
    const shouldMiss=wrongIds.includes(task.wordId) && !round.attempts[task.id];
    const result=submitAnswer(round,shouldMiss?['falsch']:answerFor(task),{now:now+ticks,eventId:`${round.id}-e${ticks}`});events.push(...result.events);round=result.round;
  }return {round,events};
}
function noDailyGrammar(state,now=T){state.rounds['grammar-today']={id:'grammar-today',kind:'grammar',phase:'complete',createdAt:now,updatedAt:now,completedAt:now,collectionIds:[]};return state;}

test('checkpoint follows both original first half and all its repairs; denominator remains fixed',()=>{
  const d=data(4), events=[];let round=buildRound({data:d,kind:'write',collectionId:'lesson0',roundId:'checkpoint',now:T});
  const first=currentTask(round), wrong=submitAnswer(round,['falsch'],{now:T,eventId:'wrong'});events.push(wrong.event);round=advanceRound(wrong.round,{now:T+1});
  assert.notEqual(currentTask(round).id,first.id);
  round=advanceRound(submitAnswer(round,answerFor(currentTask(round)),{now:T+2,eventId:'correct-second'}).round,{now:T+3});
  assert.equal(round.phase,'task');assert.equal(currentTask(round).id,first.id);
  const corrected=submitAnswer(round,answerFor(currentTask(round)),{now:T+4,eventId:'repair'});events.push(corrected.event);round=advanceRound(corrected.round,{now:T+5});
  assert.equal(round.phase,'checkpoint');assert.equal(round.originalCount,4);assert.equal(round.completedTaskIds.length,2);
  assert.equal(events[0].correct,false);assert.equal(events.at(-1).retry,true);
  round=advanceRound(round,{now:T+6});assert.equal(round.blockIndex,1);assert.equal(round.queue.length,2);
});
test('card errors and quick errors return without double grading and survive serialization',()=>{
  const d=data(3);let round=buildRound({data:d,kind:'cards',collectionId:'lesson0',roundId:'cards',now:T});
  const task=currentTask(round), result=submitAnswer(round,false,{now:T,eventId:'c0'});
  assert.throws(()=>submitAnswer(result.round,true),/bereits bewertet/);
  round=JSON.parse(JSON.stringify(advanceRound(result.round,{now:T+1})));
  assert.notEqual(currentTask(round).id,task.id);assert(round.retryIds.includes(task.id));
  round=buildRound({data:d,kind:'quick',collectionId:'lesson0',roundId:'quick',now:T});const missed=currentTask(round);
  round=advanceRound(submitAnswer(round,'falsch',{now:T,eventId:'q0'}).round,{now:T+1});assert.equal(round.queue.at(-1),missed.id);
});
test('one-meaning success cannot certify all meanings; extra wrong input remains wrong',()=>{
  const d=data(1),word=Object.values(d.words)[0];
  const result=evaluateWord(word,[word.meanings[0][0]],{quick:true});assert.equal(result.correct,true);assert.equal(result.results.length,1);
  assert.equal(evaluateWord(word,[word.meanings[0][0],'falsch'],{quick:true}).correct,false);
  assert.equal(evaluateWord(word,[word.meanings[0][0]],{quick:false}).correct,false);
  const round=buildRound({data:d,kind:'quick',collectionId:'lesson0',roundId:'one',now:T});
  const event=submitAnswer(round,[word.meanings[0][0]],{now:T,eventId:'one-e'}).event;
  const model=learningModel({data:d,state:{...emptyLandscape(),events:[event]},now:T});
  assert.equal(model.words[word.id].meanings[0].stage,1);assert.equal(model.words[word.id].meanings[1].stage,0);assert.equal(model.words[word.id].safe,false);
});
test('corrections and immediate consecutive rounds do not inflate spaced mastery; hints do not certify',()=>{
  const d=data(1), events=[];
  for(let i=0;i<5;i++){
    const round=buildRound({data:d,kind:'write',collectionId:'lesson0',roundId:`spaced${i}`,now:T+i*1000});
    events.push(submitAnswer(round,answerFor(currentTask(round)),{now:T+i*1000,eventId:`spaced-e${i}`}).event);
  }
  let model=learningModel({data:d,state:{...emptyLandscape(),events},now:T+10000});
  assert.equal(model.words['lesson0-w0'].meanings[0].stage,1);assert.equal(model.words['lesson0-w0'].dueAt,T+DAY);
  const late=buildRound({data:d,kind:'write',collectionId:'lesson0',roundId:'later',now:T+DAY});
  events.push(submitAnswer(late,answerFor(currentTask(late)),{now:T+DAY,eventId:'later-e'}).event);
  model=learningModel({data:d,state:{...emptyLandscape(),events},now:T+DAY});assert.equal(model.words['lesson0-w0'].meanings[0].stage,2);
  const hinted=submitAnswer(late,answerFor(currentTask(late)),{now:T+DAY,eventId:'hinted-e',hinted:true}).event;
  assert.equal(learningModel({data:d,state:{...emptyLandscape(),events:[hinted]},now:T+DAY}).words['lesson0-w0'].meanings[0].stage,0);
});
test('wrong quick answer makes word due without asserting which of its meanings failed',()=>{
  const d=data(1),round=buildRound({data:d,kind:'quick',collectionId:'lesson0',roundId:'wrongquick',now:T});
  const event=submitAnswer(round,'falsch',{now:T,eventId:'wrongquick-e'}).event;
  const model=learningModel({data:d,state:{...emptyLandscape(),events:[event]},now:T});
  assert.equal(model.words['lesson0-w0'].lastErrorAt,T);assert.equal(event.results.length,0);assert.equal(model.words['lesson0-w0'].weak,true);
});
test('equal success counts produce different stability after lapses and different elapsed intervals',()=>{
  const d=data(1);
  function event(name,at,correct=true){const round=buildRound({data:d,kind:'write',collectionId:'lesson0',roundId:name,now:at});return submitAnswer(round,correct?answerFor(currentTask(round)):['falsch'],{now:at,eventId:name+'-e'}).event;}
  const first=event('first',T),second=event('second',T+DAY),late=event('late',T+7*DAY),error=event('error',T+10000,false);
  const field=events=>learningModel({data:d,state:{...emptyLandscape(),events},now:T+8*DAY}).fields['word:lesson0-w0:0'];
  const steady=field([first,second]),delayed=field([first,late]),lapsed=field([first,error,second]);
  assert(delayed.stabilityDays>steady.stabilityDays);assert(lapsed.stabilityDays<steady.stabilityDays);assert(lapsed.difficulty>steady.difficulty);
  assert(steady.dueAt>T+DAY);assert.notEqual(steady.dueAt-(T+DAY),3*DAY);
});
test('all current collections are audited; newly uploaded words get an introduction chain, not 19 card rounds',()=>{
  const d=data(3,19),state=emptyLandscape();updateInventory(state,d,T);noDailyGrammar(state,T);
  assert.equal(planNext({data:d,state,now:T}).kind,'write');
  const newWords=data(3);for(const word of Object.values(newWords.words)){word.id='new-'+word.id;word.collectionId='new';d.words[word.id]=word;}
  d.collections.new={id:'new',name:'Neue Lektion'};
  // A selected new collection follows its own cards -> matching -> writing chain.
  const first=buildRound({data:d,state,kind:'cards',collectionId:'new',roundId:'new-cards',now:T});
  const done=finishRound(first);state.rounds[done.round.id]=done.round;state.events.push(...done.events);
  const next=planNext({data:d,state,now:T+1000});assert.equal(next.collectionId,'new');assert.equal(next.kind,'matching');
  state.rounds['new-match']={id:'new-match',kind:'matching',collectionIds:['new'],phase:'complete',createdAt:T+2000,updatedAt:T+3000,completedAt:T+3000};
  const write=planNext({data:d,state,now:T+4000});assert.equal(write.collectionId,'new');assert.equal(write.kind,'write');
});
test('one or two first errors move on with targeted carry; many errors trigger a repair round',()=>{
  const d=data(10,3);for(const misses of [1,2,5]){
    const state=emptyLandscape();updateInventory(state,d,T);noDailyGrammar(state,T);
    const round=buildRound({data:d,state,kind:'write',collectionId:'lesson0',roundId:`audit${misses}`,now:T});
    const done=finishRound(round,{wrongIds:Object.keys(d.words).filter(id=>id.startsWith('lesson0')).slice(0,misses)});
    state.rounds[done.round.id]=done.round;state.events=done.events;
    const next=planNext({data:d,state,now:T+10000});
    if(misses<=2){assert.notEqual(next.collectionId,'lesson0');assert.equal(next.carryWordIds.length,misses);}
    else {assert.equal(next.collectionId,'lesson0');assert.equal(next.kind,'mixed');}
  }
});
test('exam priority affects selection and expires by local calendar date',()=>{
  const d=data(3,3),state=emptyLandscape();updateInventory(state,d,T);
  state.exams.e=validateExam({id:'e',title:'Arbeit',date:'2026-11-14',collectionIds:['lesson2']},{now:T});
  assert.equal(planNext({data:d,state,now:T}).collectionId,'lesson2');
  state.exams.e.endedAt=T;assert.notEqual(planNext({data:d,state,now:T}).collectionId,'lesson2');
  assert.equal(dayKey(Date.parse('2026-11-13T23:30:00Z'),'Europe/Berlin'),'2026-11-14');
  assert.throws(()=>validateExam({date:'2026-02-31',collectionIds:['x']}),/gültiges/);
});
test('grammar hides only each next pair, then all editable fields; poor full recall reopens support',()=>{
  let round=buildRound({data:{},kind:'grammar',caseId:'nom',roundId:'grammar',now:T});
  assert.equal(currentTask(round).stage,'study');assert.equal(currentTask(round).hiddenIds.length,0);
  round=advanceRound(round,{now:T});const first=currentTask(round).hiddenIds;
  assert.equal(first.length,2);
  round=advanceRound(submitAnswer(round,answerFor(currentTask(round)),{now:T,eventId:'pair1'}).round,{now:T});
  assert.equal(currentTask(round).hiddenIds.length,2);assert(currentTask(round).hiddenIds.every(id=>!first.includes(id)));
  while(currentTask(round)?.stage==='pairs')round=advanceRound(submitAnswer(round,answerFor(currentTask(round)),{now:T,eventId:'pair-'+round.revision}).round,{now:T});
  assert.equal(currentTask(round).stage,'full');assert.equal(currentTask(round).hiddenIds.length,7);
  round=advanceRound(submitAnswer(round,{}, {now:T,eventId:'blank'}).round,{now:T});
  assert.equal(currentTask(round).stage,'study');assert.equal(round.originalCount,5);
  round=advanceRound(round,{now:T});round=requestGrammarHelp(round,{now:T});assert.equal(currentTask(round).stage,'study');
});
test('grammar automatic scheduling is once per actual day; voluntary additional rounds are possible',()=>{
  const d=data(3),state=emptyLandscape();state.rounds.finished={id:'finished',kind:'write',phase:'complete',collectionIds:['lesson0'],createdAt:T,updatedAt:T,completedAt:T};
  assert.equal(planNext({data:d,state,now:T}).kind,'grammar');
  state.rounds.g=buildRound({data:d,state,kind:'grammar',roundId:'g',now:T});
  assert.notEqual(planNext({data:d,state,now:T+1000}).kind,'grammar');
  assert.equal(buildRound({data:d,state,kind:'grammar',now:T+1000}).kind,'grammar');
});
test('manual grammar help before an unfinished pair still completes the original progress total',()=>{
  let round=buildRound({data:{},kind:'grammar',caseId:'acc',roundId:'help-progress',now:T});
  round=advanceRound(round,{now:T});round=requestGrammarHelp(round,{now:T});
  const result=finishRound(round);assert.equal(result.round.completedTaskIds.length,result.round.originalCount);
});
test('matching a word to its own parenthesized meaning always succeeds',()=>{
  const d=data(1);d.words['lesson0-w0'].meanings=[['(zurück)bleiben']];
  const round=buildRound({data:d,kind:'matching',collectionId:'lesson0',roundId:'parentheses',now:T});
  assert.equal(submitAnswer(round,{pairs:[{wordId:'lesson0-w0',meaningWordId:'lesson0-w0'}]},{now:T,eventId:'parentheses-e'}).result.correct,true);
});
test('older due cases are reviewed and case-question matching is automatically scheduled',()=>{
  const d=data(2),state=emptyLandscape();let sequence=0;
  for(const caseId of ['nom','acc'])for(let day=0;day<2;day++)for(const cell of endingCells(caseId).filter(c=>c.editable))state.events.push({id:`g${sequence++}`,roundId:`g${day}`,taskId:cell.id,at:T-(10-day)*DAY,modality:'grammar',attempt:1,retry:false,hinted:false,correct:true,caseId,results:[{key:cell.id,correct:true}]});
  state.rounds.v={id:'v',kind:'write',phase:'complete',collectionIds:['lesson0'],createdAt:T,updatedAt:T,completedAt:T};
  const next=planNext({data:d,state,now:T});assert.equal(next.kind,'grammar');assert.equal(next.caseId,'nom');
  for(let i=0;i<2;i++)state.rounds[`oldg${i}`]={id:`oldg${i}`,kind:'grammar',phase:'complete',collectionIds:[],createdAt:T-(3-i)*DAY,updatedAt:T-(3-i)*DAY,completedAt:T-(3-i)*DAY};
  assert.equal(planNext({data:d,state,now:T}).kind,'case-match');
});
test('sentence grading respects accepted alternative orders and never marks every word wrong',()=>{
  const sentence={id:'s',collectionId:'lesson0',latin:'Servus dominum videt.',translations:[['Der','Sklave','sieht','den','Herrn'],['Den','Herrn','sieht','der','Sklave']],focusWordIds:['lesson0-w0']};
  assert.equal(evaluateSentence(sentence,['Den','Herrn','sieht','der','Sklave']).correct,true);
  const d=data(1),round=buildRound({data:d,kind:'sentence',collectionId:'lesson0',sentences:[sentence],roundId:'sentence',now:T});
  const {event}=submitAnswer(round,['falsch'],{now:T,eventId:'s-e',hintedWordIds:['lesson0-w0']});
  assert.equal(event.hinted,true);assert(event.results.every(result=>!result.wordId));
});
test('matching groups avoid overlapping meanings and retain wrong attempts before eventual success',()=>{
  const d=data(3);d.words['lesson0-w1'].meanings=[['Awort']];const groups=matchingGroups(Object.values(d.words),'test');
  assert(groups.every(group=>!group.some(a=>a.id==='lesson0-w0') || !group.some(a=>a.id==='lesson0-w1')));
  const round=buildRound({data:d,kind:'matching',collectionId:'lesson0',roundId:'match',now:T}),task=currentTask(round);
  const result=submitAnswer(round,{pairs:task.words.map(w=>({wordId:w.id,meaningWordId:w.id})),mistakes:[{wordId:task.words[0].id,meaningWordId:'other'}]},{now:T,eventId:'match-e'});
  assert.equal(result.result.correct,true);assert.equal(result.events.length,2);assert.equal(result.events[1].correct,false);
});
