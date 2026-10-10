import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {harness} from './google-harness.mjs';
import {openDatabase} from '../server/database.mjs';
import {finalImport} from '../server/final-import.mjs';
const token='a'.repeat(64);
const op=id=>({id,entity:'collections',key:id,value:{id,name:id},device:'test',at:1000,seq:1});
function setup(t){
  const dir=mkdtempSync(join(tmpdir(),'latinio-final-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'latinio.sqlite'),h=harness();
  h.request({action:'push',base:0,ops:[op('first')]});
  const snapshot=()=>({format:'latinio-pi-migration',schema:1,properties:structuredClone(h.props),sheets:[...h.sheets].map(([name,s])=>({name,rows:structuredClone(s.rows)}))});
  const db=openDatabase(file);db.importSnapshot(snapshot());db.close();
  return {file,h,snapshot};
}
test('Final import preserves new learning entries and keeps a restorable pre-import backup',async t=>{
  const {file,h,snapshot}=setup(t);h.request({action:'push',base:1,ops:[op('second')]});
  const result=await finalImport(snapshot(),file);
  const db=openDatabase(file),saved=openDatabase(result.backup),previous=openDatabase(result.previous);
  t.after(()=>{db.close();saved.close();previous.close();});
  assert.equal(db.request({action:'check',token}).version,2);
  assert.equal(saved.request({action:'check',token}).version,1);
  assert.equal(previous.request({action:'check',token}).version,1);
});
test('Final import refuses stale journals or changed credentials without replacing existing data',async t=>{
  const {file,snapshot}=setup(t);
  const stale=snapshot();stale.sheets[0].rows.pop();
  await assert.rejects(finalImport(stale,file),/Lernjournal/);
  const changed=snapshot();changed.properties.TOKEN_HASH='b'.repeat(64);
  await assert.rejects(finalImport(changed,file),/Anmeldedaten/);
  const db=openDatabase(file);t.after(()=>db.close());assert.equal(db.request({action:'check',token}).version,1);
});
