import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSession,optionalMeaning} from '../app/core.js';
import {createErrorRetry} from '../app/error-retry.js';
import {consumeSubjectSwitch,SUBJECT_SWITCH_KEY} from '../app/subject-entrance.js';
import {adjustDifferenceSelection} from '../app/sharing-check.js';

test('Fully parenthesized meanings are optional in all modes and still accepted',()=>{
  const word={meanings:[['Tag'],['(Tageszeit)'],['(sich (von etwas) ernähren)']]};
  for(const mode of ['all','any']){
    assert.equal(evaluateSession(word,['Tag'],false,{}, {meaningRequirement:mode}).grade,'full');
    assert.equal(evaluateSession(word,['Tag','Tageszeit'],false,{}, {meaningRequirement:mode}).grade,'full');
  }
  assert.equal(evaluateSession(word,['Tag Tageszeit'],false).grade,'full');
  assert.equal(evaluateSession(word,['Tageszeit'],false).grade,'partial');
  assert.equal(evaluateSession({meanings:[['(optional)']]},[''],false).grade,'full');
  assert.equal(optionalMeaning('jemanden (besuchen)'),false);
  assert.equal(optionalMeaning('(eins) (zwei)'),false);
  assert.equal(evaluateSession({meanings:[['Tag'],['(optional)','Pflicht']]},['Tag'],false).grade,'partial');
});
test('Each error retry shuffles while retaining task direction and original completion data',()=>{
  const tasks=[{wordId:'a',direction:'en-de'},{wordId:'b',direction:'de-en'},{wordId:'c',direction:'en-de'}];
  const previous={completionRoot:{first:{a:false}},meaningRequirement:'all',sourceIds:['lesson']};
  for(let i=0;i<10;i++){
    const retry=createErrorRetry(previous,tasks,'retry'+i);
    assert.notDeepEqual(retry.queue.map(t=>t.wordId),tasks.map(t=>t.wordId));
    assert.deepEqual(retry.queue.map(t=>t.wordId).sort(),['a','b','c']);
    assert.equal(retry.queue.find(t=>t.wordId==='b').direction,'de-en');
    assert.equal(retry.completionRoot,previous.completionRoot);
  }
  assert.deepEqual(tasks.map(t=>t.wordId),['a','b','c']);
});
test('A direct language switch bypasses the entrance once, then normal opens show it again',()=>{
  const values=new Map([[SUBJECT_SWITCH_KEY,'english']]);
  const storage={getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
  assert.equal(consumeSubjectSwitch(storage),'english');assert.equal(consumeSubjectSwitch(storage),null);
  values.set(SUBJECT_SWITCH_KEY,'invalid');assert.equal(consumeSubjectSwitch(storage),null);
});
test('Checker selections include required containers and deselect their children together',()=>{
  const diffs=[{id:'parent',resourceId:'r',key:'deck',parentMissing:true},{id:'child',resourceId:'r',key:'w',parentMissing:true},{id:'other',resourceId:'x',key:'w'}],selected=new Set();
  adjustDifferenceSelection(diffs,selected,'child',true);assert.deepEqual([...selected].sort(),['child','parent']);
  adjustDifferenceSelection(diffs,selected,'other',true);
  adjustDifferenceSelection(diffs,selected,'parent',false);assert.deepEqual([...selected],['other']);
});
