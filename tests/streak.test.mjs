import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreakLedger,dayKey,previousDay,streakState,streakVariant,streakDays,streakDayChanges} from '../app/streak.js';
import {emptyData,rebase} from '../app/core.js';
import {harness} from './google-harness.mjs';

const at=day=>new Date(day+'T12:00:00').getTime();
function storage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
function store(data=emptyData()){return {data,commits:0,async read(){},async commit(changes){this.commits++;for(const [entity,id,value] of changes)this.data[entity][id]=value;}};}

test('streak is gray with yesterday’s count, colored today, and resets after a missed day',()=>{
 const days=['2026-10-06','2026-10-07'];
 assert.deepEqual(streakState(days,at('2026-10-08')),{today:'2026-10-08',active:false,count:2});
 assert.equal(streakState([...days,'2026-10-08'],at('2026-10-08')).count,3);
 assert.equal(streakState([...days,'2026-10-08'],at('2026-10-08')).active,true);
 assert.equal(streakState(days,at('2026-10-09')).count,0);
 assert.equal(streakState([...days,'2026-10-09'],at('2026-10-09')).count,1);
 assert.equal(streakState(['invalid','2026-02-30','2099-01-01'],at('2026-10-08')).count,0);
});
test('calendar arithmetic handles leap years, year boundaries and both German clock changes',()=>{
 assert.equal(previousDay('2024-03-01'),'2024-02-29');assert.equal(previousDay('2027-01-01'),'2026-12-31');
 const old=process.env.TZ;process.env.TZ='Europe/Berlin';
 try{
  assert.equal(dayKey('2026-10-08T22:01:00Z'),'2026-10-09');
  assert.equal(streakState(['2026-03-28','2026-03-29','2026-03-30'],at('2026-03-30')).count,3);
  assert.equal(streakState(['2026-10-24','2026-10-25','2026-10-26'],at('2026-10-26')).count,3);
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('claim is idempotent for repeated completions and rotates on consecutive days',async()=>{
 const saved=store(),ledger=createStreakLedger({profileId:'a',storage:storage()});
 const first=await ledger.claim(saved,at('2026-10-08'));
 assert.equal(first.celebrate,true);assert.equal(first.count,1);assert.equal(first.variant,'orbit');
 const repeats=await Promise.all([ledger.claim(saved,at('2026-10-08')),ledger.claim(saved,at('2026-10-08'))]);
 assert.ok(repeats.every(result=>!result.celebrate));assert.equal(saved.commits,1);
 const second=await ledger.claim(saved,at('2026-10-09'));assert.equal(second.count,2);assert.equal(second.variant,'wave');
 assert.equal(streakVariant(3),'impact');assert.equal(streakVariant(4),'orbit');
});
test('Latin and English share one profile streak but separate profiles never share it',async()=>{
 const disk=storage(),latin=store(),english=store();
 const a=createStreakLedger({profileId:'a',storage:disk});await a.claim(latin,at('2026-10-08'));
 const otherSubject=createStreakLedger({profileId:'a',storage:disk});
 const again=await otherSubject.claim(english,at('2026-10-08'));assert.equal(again.celebrate,false);assert.equal(again.count,1);
 assert.equal(streakDays(english.data).length,1,'shared day is also carried by the current subject’s journal');
 const b=createStreakLedger({profileId:'b',storage:disk});assert.equal(b.state(store().data,at('2026-10-08')).count,0);
});
test('a failed local save does not consume the day or prevent a later celebration',async()=>{
 const saved=store(),ledger=createStreakLedger({profileId:'a',storage:storage()}),commit=saved.commit;
 saved.commit=async()=>{throw Error('disk full');};
 await assert.rejects(ledger.claim(saved,at('2026-10-08')),/disk full/);
 assert.equal(ledger.state(saved.data,at('2026-10-08')).active,false);
 saved.commit=commit;assert.equal((await ledger.claim(saved,at('2026-10-08'))).celebrate,true);
});
test('cloud days restore the count and same-day immutable records merge without conflicts',async()=>{
 const d=emptyData();d.settings.streak_day_2026_10_07={kind:'streakDay',day:'2026-10-07'};
 d.settings.review={kind:'predicateReview',at:at('2026-10-08'),correct:true};
 const ledger=createStreakLedger({profileId:'a',storage:storage()});ledger.merge(streakDays(d));
 assert.equal((await ledger.claim(store(),at('2026-10-08'))).count,2);
 const changes=streakDayChanges(emptyData(),['2026-10-08','2026-10-08']);assert.equal(changes.length,1);
 const [entity,key,value]=changes[0],remote={id:'remote',entity,key,value},local={...remote,id:'local'};
 const cloud=emptyData();cloud.settings[key]=value;
 assert.equal(rebase(cloud,[remote],[local]).conflicts.length,0);
});
test('existing Google settings endpoint stores streak days without a backend change',()=>{
 const h=harness(),[entity,key,value]=streakDayChanges(emptyData(),['2026-10-08'])[0];
 h.request({action:'push',base:0,ops:[{entity,key,value,id:'streak-test',device:'test',seq:1,at:Date.now()}]});
 assert.deepEqual(streakDays(h.request({action:'pull',since:0}).data),['2026-10-08']);
});
