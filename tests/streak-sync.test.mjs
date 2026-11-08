import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {streakDays} from '../app/streak.js';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('async function refreshStreak('),source.indexOf('async function offerRoundEnd('));
function fixture({summary=false,allowed=true}={}){
 let now=100000,version=3;const calls=[],days=new Set(),data={settings:{local:{kind:'streakDay',day:'2026-11-08'}}};
 const ctx=vm.createContext({
  streakLedger:{merge(values=[]){values.forEach(day=>days.add(day));}},streakDays,data:()=>data,subject:'latin',subjectAllowed:()=>allowed,SUBJECTS:[{id:'latin'},{id:'english'}],
  navigator:{onLine:true},Date:{now:()=>now},streakSyncTask:null,streakSyncedAt:0,streakOtherVersions:new Map(),refreshStreakBadge(){},
  store:{profileId:'student',doc:{config:{url:'https://example.test/api',token:'test-session'}}},
  sync:{configured:true,streakSummary:summary,async request(action,payload,subject){
   calls.push({action,payload,subject});
   if(action==='streak')return {version,days:['2026-11-07']};
   if(action==='check')return {version};
   if(action==='pull')return {version,data:{settings:{other:{kind:'streakDay',day:'2026-11-07'}}}};
   throw Error('Unexpected request '+action);
  }},
 });
 vm.runInContext(code,ctx);
 return {ctx,calls,days,advance(){now+=60001;},changeVersion(){version++;}};
}

test('Capable backends return cross-subject streak days without downloading learning history',async()=>{
 const f=fixture({summary:true});await f.ctx.refreshStreak();f.advance();await f.ctx.refreshStreak();
 assert.deepEqual(f.calls.map(call=>call.action),['streak','streak']);
 assert.ok(f.calls.every(call=>call.subject==='english'));
 assert.deepEqual([...f.days].sort(),['2026-11-07','2026-11-08']);
});

test('Unchanged legacy versions only check metadata on subsequent refreshes',async()=>{
 const f=fixture();await f.ctx.refreshStreak();f.advance();await f.ctx.refreshStreak();f.advance();await f.ctx.refreshStreak();
 assert.deepEqual(f.calls.map(call=>call.action),['check','pull','check','check']);
 f.changeVersion();f.advance();await f.ctx.refreshStreak();
 assert.deepEqual(f.calls.map(call=>call.action),['check','pull','check','check','check','pull']);
 assert.deepEqual([...f.days].sort(),['2026-11-07','2026-11-08']);
});

test('Legacy version reuse never crosses profile or connection changes',async()=>{
 const f=fixture();await f.ctx.refreshStreak();
 for(const change of [()=>f.ctx.store.profileId='other',()=>f.ctx.store.doc.config.token='new-token',()=>f.ctx.store.doc.config.url='https://other.test/api']){
  change();f.advance();await f.ctx.refreshStreak();assert.equal(f.calls.at(-1).action,'pull');
 }
 assert.equal(f.calls.filter(call=>call.action==='pull').length,4);
});

test('Streak refresh preserves its one-minute throttle and does not request restricted subjects',async()=>{
 const f=fixture({summary:true});await f.ctx.refreshStreak();await f.ctx.refreshStreak();assert.equal(f.calls.length,1);
 const restricted=fixture({allowed:false});await restricted.ctx.refreshStreak();assert.equal(restricted.calls.length,0);assert.ok(restricted.days.has('2026-11-08'));
 f.ctx.navigator.onLine=false;f.advance();await f.ctx.refreshStreak();assert.equal(f.calls.length,1);
});

test('Failed legacy downloads are retried and never cached as complete',async()=>{
 const f=fixture(),request=f.ctx.sync.request;let fail=true;
 f.ctx.sync.request=async(...args)=>{if(args[0]==='pull'&&fail){fail=false;throw Error('offline');}return request(...args);};
 await f.ctx.refreshStreak();assert.equal(f.ctx.streakOtherVersions.size,0);
 await f.ctx.refreshStreak();assert.equal(f.ctx.streakOtherVersions.size,1);assert.ok(f.days.has('2026-11-07'));
});
