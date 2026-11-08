import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';

test('saving learning progress does not load the sharing directory',()=>{
  const h=harness();h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  h.ctx.autoContext_=()=>{throw Error('Sharing directory must not be read for learning activity');};
  const values=[
    ['reviews','review',{id:'review',wordId:'word',grade:'full',at:123}],
    ['sessions','session',{id:'session',ended:123}],
    ['settings','streak_day_2026-11-08',{kind:'streakDay',day:'2026-11-08'}],
    ['settings','preferences',{theme:'dark'}],
    ['collections','refresh',{id:'refresh',name:'Wiederholen',refreshSource:'lesson'}]
  ];
  const ops=values.map(([entity,key,value],i)=>({id:'progress_'+i,entity,key,value,device:'phone',at:123,seq:i}));
  const saved=h.request({action:'push',base:0,ops});
  assert.equal(saved.version,ops.length);assert.deepEqual(Array.from(saved.accepted),ops.map(op=>op.id));
  const restored=h.request({action:'pull',since:0});
  for(const [entity,key,value] of values)assert.deepEqual(restored.data[entity][key],value);
});
test('lesson edits in a mixed progress upload still reach students',()=>{
  const h=harness();h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  const student=h.request({action:'profileCreate',name:'Test',email:'test@example.org',allowedSubjects:['latin']}).profile;
  const session=h.request({action:'login',email:student.email});
  const ops=[
    {entity:'collections',key:'lesson',value:{id:'lesson',name:'Geänderte Lektion'}},
    {entity:'settings',key:'streak_day_2026-11-08',value:{kind:'streakDay',day:'2026-11-08'}}
  ].map((op,i)=>({...op,id:'mixed_'+i,device:'phone',at:123,seq:i}));
  const saved=h.request({action:'push',base:0,ops});assert.equal(saved.autoShare.users,1);
  const received=h.request({action:'pull',token:session.token,since:0});
  assert.equal(Object.values(received.data.collections)[0].name,'Geänderte Lektion');
  assert.equal(received.data.settings['streak_day_2026-11-08'],undefined);
});
