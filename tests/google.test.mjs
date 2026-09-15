import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('../google/Code.gs',import.meta.url),'utf8');
function harness(){
 const rows=[['Version','ID','Zeit','Gerät','JSON']];let locked=false;
 const sheet={getLastRow:()=>rows.length,getRange(r,c,n=1,m=1){return {getValue:()=>rows[r-1]?.[c-1],getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m)),setValues(values){values.forEach((row,i)=>rows[r-1+i]=row);}};}};
 const token='a'.repeat(64);const ctx=vm.createContext({console,Number,JSON,Date,Error,Array,SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>({SHEET_ID:'test',TOKEN_HASH:crypto.createHash('sha256').update(token).digest('hex')})[k]})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_a,s)=>[...crypto.createHash('sha256').update(s).digest()]},LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>locked=false})}});vm.runInContext(source,ctx);return {request:request=>ctx.latinioApi({...request,token}),ctx,rows};
}
const op={id:'change-1',entity:'collections',key:'deck',value:{id:'deck',name:'Sammlung'},device:'iphone',at:1000,seq:1};
test('Google vergibt Versionen atomar, verweigert veraltete Uploads und zählt IDs nur einmal',()=>{
 const h=harness();assert.equal(h.request({action:'check'}).version,0);
 assert.equal(h.request({action:'push',base:0,ops:[op]}).version,1);
 assert.equal(h.request({action:'push',base:0,ops:[{...op,id:'change-2'}]}).conflict,true);
 assert.equal(h.request({action:'push',base:1,ops:[op]}).version,1);
 const next=h.request({action:'push',base:1,ops:[{...op,id:'change-2',value:null}]});assert.equal(next.version,2);assert.equal(next.data.collections.deck,undefined);
 const pulled=h.request({action:'pull',since:0});assert.equal(pulled.ops.length,2);assert.equal(pulled.version,2);
});
test('Google lehnt ungültige Zugangsschlüssel und schädliche Schlüssel ab',()=>{
 const h=harness();assert.throws(()=>h.ctx.latinioApi({action:'check',token:'b'.repeat(64)}),/Verbindungsschlüssel/);
 assert.throws(()=>h.request({action:'push',base:0,ops:[{...op,key:'__proto__'}]}),/Kennung/);
 assert.equal(h.rows.length,1);
});
