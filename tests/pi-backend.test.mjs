import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {harness} from './google-harness.mjs';
import {openDatabase} from '../server/database.mjs';
import {apiServer} from '../server/http.mjs';
import {RestBridge} from '../server/rest-bridge.mjs';

const token='a'.repeat(64);
const op={id:'change-1',entity:'collections',key:'deck',value:{id:'deck',name:'Sammlung'},device:'iphone',at:1000,seq:1};
function fixture() {
  const google=harness();
  google.request({action:'push',base:0,ops:[op]});
  const student=google.request({action:'profileCreate',name:'Felix',email:'felix@example.org',allowedSubjects:['latin','english']}).profile;
  const session=google.request({action:'login',email:student.email});
  google.request({action:'push',token:session.token,subject:'english',base:0,ops:[{...op,id:'english-op',value:{id:'deck',name:'English'}}]});
  const snapshot={format:'latinio-pi-migration',schema:1,properties:google.props,
    sheets:[...google.sheets].map(([name,sheet])=>({name,rows:structuredClone(sheet.rows)}))};
  return {snapshot,student,session};
}
test('Pi import preserves both subjects, profiles, versions and existing session tokens',t=>{
  const {snapshot,student,session}=fixture();const database=openDatabase(':memory:');t.after(()=>database.close());
  database.importSnapshot(snapshot);
  assert.equal(database.ready(),true);
  assert.equal(database.request({action:'check',token}).version,1);
  assert.equal(database.request({action:'whoami',token:session.token}).profile.id,student.id);
  assert.equal(database.request({action:'pull',subject:'english',token:session.token,since:0}).data.collections.deck.name,'English');
  assert.equal(database.request({action:'profiles',token}).profiles[0].email,'felix@example.org');
});
test('Pi journals deduplicate, refuse outdated uploads and rollback a partly invalid batch',t=>{
  const database=openDatabase(':memory:');t.after(()=>database.close());database.importSnapshot(fixture().snapshot);
  assert.equal(database.request({action:'push',token,base:1,ops:[op]}).version,1);
  assert.equal(database.request({action:'push',token,base:0,ops:[op]}).conflict,true);
  assert.throws(()=>database.request({action:'push',token,base:1,ops:[{...op,id:'new-1'},{...op,id:'new-2',key:'__proto__'}]}),/Kennung/);
  assert.equal(database.request({action:'check',token}).version,1);
  assert.equal(database.request({action:'push',token,base:1,ops:[{...op,id:'deleted',value:null}]}).version,2);
  assert.deepEqual(database.request({action:'pull',token,since:0}).data.collections,{});
});
test('Pi admin login retains PIN lockout after failed requests',t=>{
  const database=openDatabase(':memory:');t.after(()=>database.close());database.importSnapshot(fixture().snapshot);
  for(let i=0;i<5;i++)assert.throws(()=>database.request({action:'login',admin:true,pin:'9999'}),/stimmt nicht/);
  assert.throws(()=>database.request({action:'login',admin:true,pin:'1234'}),/fünf Minuten/);
});
test('Pi shares and messages use the same existing domain rules',t=>{
  const {snapshot,student,session}=fixture();const database=openDatabase(':memory:');t.after(()=>database.close());database.importSnapshot(snapshot);
  database.request({action:'shareCreateMany',token,profileId:student.id,collectionIds:['deck']});
  const shared=database.request({action:'pull',token:session.token,since:0});
  assert.equal(Object.values(shared.data.collections)[0].name,'Sammlung');
  database.request({action:'announcementSend',token,profileId:student.id,title:'Test',message:'Hallo'});
  const inbox=database.request({action:'announcementInbox',token:session.token});
  assert.equal(inbox.announcements[0].message,'Hallo');
  database.request({action:'announcementRead',token:session.token,announcementId:inbox.announcements[0].id});
  assert.equal(database.request({action:'announcementInbox',token:session.token}).announcements.length,0);
  assert.throws(()=>database.request({action:'profiles',token:session.token}),/Admin/);
});
test('SQLite survives reopening and its online backup can restore the existing state',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'latinio-pi-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'state.sqlite'),saved=join(dir,'backup.sqlite');
  let database=openDatabase(file);database.importSnapshot(fixture().snapshot);
  await database.backup(saved);database.close();database=openDatabase(file);
  assert.equal(database.request({action:'check',token}).version,1);database.close();
  const restored=openDatabase(saved);assert.equal(restored.request({action:'check',token}).version,1);restored.close();
});
test('Import refuses overwrite and malformed journals without importing partial credentials',t=>{
  const database=openDatabase(':memory:');t.after(()=>database.close());
  const snapshot=fixture().snapshot;snapshot.sheets[0].rows[1][0]=123;
  assert.throws(()=>database.importSnapshot(snapshot),/Änderungsjournal/);assert.equal(database.ready(),false);
  database.importSnapshot(fixture().snapshot);assert.throws(()=>database.importSnapshot(fixture().snapshot),/leere Datenbank/);
});
test('HTTP allows only the GitHub origin, uses bearer sessions and refuses missing credentials',async t=>{
  const database=openDatabase(':memory:');database.importSnapshot(fixture().snapshot);
  const server=apiServer(database);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));database.close();});
  const url='http://127.0.0.1:'+server.address().port+'/api',origin='https://tiagogt0000.github.io';
  const denied=await fetch(url,{method:'OPTIONS',headers:{Origin:'https://other.example'}});assert.equal(denied.status,403);
  const preflight=await fetch(url,{method:'OPTIONS',headers:{Origin:origin}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  const missing=await fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'check'})});assert.equal(missing.status,400);
  const bridge=new RestBridge('https://test.invalid/api',token,{fetchImpl:(_url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}})});
  assert.equal((await bridge.request('check')).version,1);
  const result=await bridge.request('push',{base:1,ops:[{...op,id:'http-save'}]});assert.equal(result.version,2);
  const student=fixture().session;assert.ok(student.token);
  assert.throws(()=>new RestBridge('http://test.invalid/api',token),/HTTPS/);
});
