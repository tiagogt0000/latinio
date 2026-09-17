import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
export function harness(){
 const sheets=new Map();const metrics={reads:0,writes:0};let locked=false;
 function makeSheet(name){const rows=[];const sheet={rows,getLastRow:()=>rows.length,getRange(r,c,n=1,m=1){metrics.reads++;const range={getValue:()=>rows[r-1]?.[c-1],getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows[r-1+i]?.[c-1+j]??'')),setValues(values){metrics.writes++;values.forEach((row,i)=>{rows[r-1+i]??=[];row.forEach((v,j)=>rows[r-1+i][c-1+j]=v);});return range;},setFontWeight(){return range;},setBackground(){return range;},setFontColor(){return range;}};return range;},setFrozenRows(){},setColumnWidths(){},setColumnWidth(){}};sheets.set(name,sheet);return sheet;}
 const token='a'.repeat(64),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 const props={SHEET_ID:'test',TOKEN_HASH:hash(token),ADMIN_PIN_SALT:'salt',ADMIN_PIN_HASH:hash('salt:1234')};
 const book={getSheetByName:name=>sheets.get(name),insertSheet:makeSheet};
 const ctx=vm.createContext({console,Number,JSON,Date,Error,Array,SpreadsheetApp:{openById:()=>book,flush:()=>{}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperties:p=>Object.assign(props,p)})},Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_a,s)=>[...crypto.createHash('sha256').update(s).digest()]},LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>locked=false})}});
 for(const file of ['Code.gs','Accounts.gs'])vm.runInContext(fs.readFileSync(new URL('../google/'+file,import.meta.url),'utf8'),ctx);
 ctx.ensureLog_('admin');return {request:request=>ctx.latinioApi({token,...request}),ctx,rows:sheets.get('Änderungen').rows,sheets,props,metrics};
}
