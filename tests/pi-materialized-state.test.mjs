import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {openDatabase} from '../server/database.mjs';
import {harness} from './google-harness.mjs';

const token='a'.repeat(64);
const plain=value=>JSON.parse(JSON.stringify(value));
const op=(id,entity,key,value,device='fixture')=>({id,entity,key,value,device,seq:1,at:1000});
const word={id:'word',collectionId:'deck',latin:'diēs',meanings:[['Tag']]};
function fixture(){
  const google=harness();google.ctx.AUTOMATIC_SHARING_ENABLED=false;
  google.request({action:'push',base:0,ops:[
    op('deck-old','collections','deck',{id:'deck',name:'Alt'}),
    op('word-old','words','word',word),
    op('review','reviews','review',{id:'review',wordId:'word',grade:'full',at:1000}),
    op('session','sessions','session',{id:'session',finished:true}),
    op('day','settings','day',{kind:'streakDay',day:'2026-11-08'}),
    op('bad-day','settings','bad_day',{kind:'streakDay',day:'2026-02-30'}),
    op('private-setting','settings','other',{kind:'other',day:'2026-11-09'})
  ]});
  google.request({action:'push',base:7,ops:[
    op('deck-new','collections','deck',{id:'deck',name:'Neu'},'other-device'),
    op('word-deleted','words','word',null,'other-device'),
    op('day-copy','settings','day_copy',{kind:'streakDay',day:'2026-11-08'})
  ]});
  return {google,snapshot:{format:'latinio-pi-migration',schema:1,properties:google.props,
    sheets:[...google.sheets].map(([name,sheet])=>({name,rows:structuredClone(sheet.rows)}))}};
}
function openCaptured(file=':memory:',options){
  const original=vm.runInContext;let context;
  vm.runInContext=function(code,ctx,...args){context=ctx;return original.call(this,code,ctx,...args);};
  try{return {database:openDatabase(file,options),context};}finally{vm.runInContext=original;}
}
const journals=db=>db.db.prepare("SELECT sheet,position,value FROM rows WHERE sheet NOT LIKE '_Latinio%' ORDER BY sheet,position").all();
const snapshots=db=>db.db.prepare('SELECT sheet,version,data FROM journal_snapshots ORDER BY sheet').all();
function temporary(t){const dir=mkdtempSync(join(tmpdir(),'latinio-state-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'state.sqlite');}

test('Existing journals derive a persistent snapshot without changing history, and warm reads never replay',async t=>{
  const file=temporary(t),{google,snapshot}=fixture();
  let {database,context}=openCaptured(file);database.importSnapshot(snapshot);
  const before=journals(database),expected=plain(google.request({action:'pull',since:0}));
  assert.equal(snapshots(database).length,0);
  assert.deepEqual(database.request({action:'pull',token,since:0}),expected);
  assert.equal(snapshots(database)[0].version,10);
  context.replay_=()=>{throw Error('Unexpected full journal replay');};
  const result=database.request({action:'pull',token,since:0,compact:1});
  assert.deepEqual(result.data,expected.data);
  result.data.collections.deck.name='Caller mutation';
  assert.equal(database.request({action:'pull',token,since:10}).data.collections.deck.name,'Neu');
  assert.deepEqual(database.request({action:'streak',token}),{version:10,days:['2026-11-08']});
  // The notification compatibility path keeps its existing historical input.
  assert.deepEqual(database.notificationSnapshot()[0].days,['2026-11-08','2026-02-30']);
  assert.deepEqual(journals(database),before);
  const backup=file+'.backup';await database.backup(backup);database.close();
  ({database,context}=openCaptured(file));context.replay_=()=>{throw Error('Unexpected restart replay');};
  assert.deepEqual(database.request({action:'pull',token,since:0}),expected);database.close();
  const restored=openDatabase(backup);t.after(()=>restored.close());
  assert.deepEqual(restored.request({action:'pull',token,since:0}),expected);
});

test('Warm snapshots follow appends, deletes and repeated IDs atomically',t=>{
  const {database,context}=openCaptured();t.after(()=>database.close());database.importSnapshot(fixture().snapshot);
  database.request({action:'pull',token,since:0});context.replay_=()=>{throw Error('Unexpected append replay');};
  const change=op('next-deck','collections','deck',{id:'deck',name:'Aktuell'});
  const result=database.request({action:'push',token,base:10,ops:[change]});
  assert.equal(result.version,11);assert.equal(snapshots(database)[0].version,11);
  assert.equal(JSON.parse(snapshots(database)[0].data).collections.deck.name,'Aktuell');
  const repeated=database.request({action:'push',token,base:11,ops:[change]});
  assert.equal(repeated.version,11);assert.deepEqual(repeated.accepted,['next-deck']);
  const before=snapshots(database);
  assert.throws(()=>database.request({action:'push',token,base:11,ops:[op('valid-first','collections','deck',null),op('bad','words','__proto__',word)]}),/Kennung/);
  assert.deepEqual(snapshots(database),before);
  assert.equal(database.request({action:'check',token}).version,11);
  database.request({action:'push',token,base:11,ops:[op('remove-deck','collections','deck',null)]});
  assert.deepEqual(JSON.parse(snapshots(database)[0].data).collections,{});
});

test('Historical row corrections invalidate derived state across a restart',t=>{
  const file=temporary(t);let database=openDatabase(file);database.importSnapshot(fixture().snapshot);
  database.request({action:'pull',token,since:0});
  const row=JSON.parse(database.db.prepare("SELECT value FROM rows WHERE sheet='Änderungen' AND position=9").get().value);
  const change=JSON.parse(row[4]);change.value.name='Korrigiert';row[4]=JSON.stringify(change);
  database.db.prepare("UPDATE rows SET value=? WHERE sheet='Änderungen' AND position=9").run(JSON.stringify(row));
  assert.equal(snapshots(database).length,0);database.close();
  database=openDatabase(file);t.after(()=>database.close());
  const result=database.request({action:'pull',token,since:0});
  assert.equal(result.version,10);assert.equal(result.data.collections.deck.name,'Korrigiert');
  database.db.prepare("UPDATE journal_snapshots SET data='not json'").run();
  assert.equal(database.request({action:'pull',token,since:10}).data.collections.deck.name,'Korrigiert');
});

test('Compact pull retains historical acknowledgments and the latest changed keys including tombstones',t=>{
  const {google,snapshot}=fixture(),database=openDatabase(':memory:');t.after(()=>database.close());database.importSnapshot(snapshot);
  for(const request of [payload=>plain(google.request(payload)),payload=>database.request({token,...payload})]){
    const legacy=request({action:'pull',since:0});
    const compact=request({action:'pull',since:0,compact:1,pendingIds:['deck-old','word-old','missing','deck-old']});
    assert.equal(compact.hasHistory,true);assert.equal(compact.version,legacy.version);assert.deepEqual(compact.data,legacy.data);
    assert.equal('ops' in compact,false);assert.deepEqual(compact.acknowledged,['deck-old','word-old']);
    assert.equal(compact.changes.filter(change=>change.key==='deck').length,1);
    assert.deepEqual(compact.changes.find(change=>change.key==='deck'),{id:'deck-new',device:'other-device',entity:'collections',key:'deck',version:8});
    assert.equal(compact.changes.find(change=>change.key==='word').id,'word-deleted');
    assert.ok(compact.changes.every(change=>!('value' in change)));
    const unchanged=request({action:'pull',since:10,compact:1,pendingIds:['deck-old']});
    assert.deepEqual(unchanged.changes,[]);assert.deepEqual(unchanged.acknowledged,['deck-old']);
    assert.equal(unchanged.hasHistory,true);
    assert.deepEqual(request({action:'pull',since:0,subject:'english',compact:1}),{version:0,data:{collections:{},words:{},reviews:{},sessions:{},settings:{}},changes:[],acknowledged:[],hasHistory:false});
    assert.throws(()=>request({action:'pull',since:11,compact:1}),/Gerätestand/);
    assert.throws(()=>request({action:'pull',since:0,compact:1,pendingIds:['bad:id']}),/kennungen/);
    assert.throws(()=>request({action:'streak',token:'invalid'}),/anmelden/);
  }
});

test('Google read-only responses pair their version with the captured state when an upload arrives during the read',()=>{
  for(const action of ['pull','streak']){
    const {google}=fixture(),sheet=google.sheets.get('Änderungen'),original=sheet.getLastRow;let reads=0;
    sheet.getLastRow=()=>{
      if(++reads===2)google.request({action:'push',base:10,ops:[op('arrived','settings','new_day',{kind:'streakDay',day:'2026-11-09'})]});
      return original();
    };
    const result=plain(google.request({action,since:11,compact:1}));
    assert.equal(result.version,11);
    if(action==='pull'){assert.equal(result.data.settings.new_day.day,'2026-11-09');assert.deepEqual(result.changes,[]);}
    else assert.deepEqual(result.days,['2026-11-08','2026-11-09']);
  }
});

test('Streak summaries advertise support, return only valid days and enforce subject access',t=>{
  const {google}=fixture();const profile=google.request({action:'profileCreate',name:'Fixture',email:'fixture@example.test',allowedSubjects:['latin']}).profile;
  const session=google.request({action:'login',email:profile.email});
  const snapshot={format:'latinio-pi-migration',schema:1,properties:google.props,sheets:[...google.sheets].map(([name,sheet])=>({name,rows:structuredClone(sheet.rows)}))};
  const database=openDatabase(':memory:');t.after(()=>database.close());database.importSnapshot(snapshot);
  for(const request of [payload=>plain(google.request(payload)),payload=>database.request({token,...payload})]){
    const identity=request({action:'whoami'});assert.equal(identity.compactSync,true);assert.equal(identity.streakSummary,true);
    assert.deepEqual(request({action:'streak'}),{version:10,days:['2026-11-08']});
    assert.throws(()=>request({action:'streak',subject:'english',token:session.token}),/freigeschaltet/);
    assert.throws(()=>request({action:'pull',subject:'english',token:session.token,since:0,compact:1}),/freigeschaltet/);
  }
});

test('Snapshots and all journal writes roll back together when automatic sharing fails',t=>{
  const google=harness();google.ctx.AUTOMATIC_SHARING_ENABLED=false;
  google.request({action:'push',base:0,ops:[op('deck','collections','deck',{id:'deck',name:'Deck'}),op('word','words','word',word)]});
  const database=openDatabase(':memory:',{enableAutoSharing:true});t.after(()=>database.close());
  database.importSnapshot({format:'latinio-pi-migration',schema:1,properties:google.props,sheets:[...google.sheets].map(([name,sheet])=>({name,rows:structuredClone(sheet.rows)}))});
  const first=database.request({action:'profileCreate',token,name:'First',email:'first@example.test'}).profile;
  const second=database.request({action:'profileCreate',token,name:'Second',email:'second@example.test'}).profile;
  const session=database.request({action:'login',email:first.email}).token;
  database.request({action:'pull',token:session,since:0});database.request({action:'pull',token,since:0});
  const metadata=database.db.prepare("SELECT position,value FROM rows WHERE sheet='_LatinioAutoShares' ORDER BY position").all().slice(1);
  const resource=metadata.map(row=>JSON.parse(JSON.parse(row.value)[1])).find(record=>record.kind==='autoResource'&&record.profileId===second.id);
  const entry=metadata.find(row=>{const record=JSON.parse(JSON.parse(row.value)[1]);return record.kind==='autoEntry'&&record.resourceId===resource.id;});
  const row=JSON.parse(entry.value),record=JSON.parse(row[1]);record.targetKey='__proto__';row[1]=JSON.stringify(record);
  database.db.prepare("UPDATE rows SET value=? WHERE sheet='_LatinioAutoShares' AND position=?").run(JSON.stringify(row),entry.position);
  const before=journals(database),cached=snapshots(database),base=database.request({action:'check',token}).version;
  assert.throws(()=>database.request({action:'push',token,base,ops:[op('fanout-fail','words','word',{...word,latin:'novus'})]}),/Kennung/);
  assert.deepEqual(journals(database),before);assert.deepEqual(snapshots(database),cached);
  assert.equal(database.request({action:'pull',token,since:0}).data.words.word.latin,'diēs');
});
