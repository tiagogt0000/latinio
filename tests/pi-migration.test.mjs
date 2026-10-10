import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness} from './google-harness.mjs';
import {createBridge,GoogleBridge} from '../app/sync.js';
import {RestBridge} from '../app/rest-bridge.js';
function migration(){
  const h=harness();
  h.ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>h.props[k],setProperty:(k,v)=>{h.props[k]=v;},deleteProperty:k=>{delete h.props[k];},setProperties:p=>Object.assign(h.props,p)})};
  vm.runInContext(fs.readFileSync(new URL('../google/PiMigration.gs',import.meta.url),'utf8'),h.ctx);
  h.ctx.Logger={log(){}};
  return h;
}
test('Migration starts inactive and preserves Google API; freezing rejects writes but allows reads',()=>{
  const h=migration();assert.equal(h.request({action:'check'}).version,0);
  h.props.PI_MIGRATION_FROZEN='1';
  assert.equal(h.request({action:'check'}).version,0);
  assert.throws(()=>h.request({action:'push',base:0,ops:[]}),/zieht gerade um/);
  assert.throws(()=>h.request({action:'login',email:'test@example.org'}),/zieht gerade um/);
  assert.equal(h.rows.length,1);
});
test('Old clients relay their bearer token and never fall back to Google on a Pi error',()=>{
  const h=migration();h.props.PI_API_URL='https://elektrogilbersserver.tail7c7157.ts.net:8443/api';
  let success=true;
  h.ctx.UrlFetchApp={fetch:(url,options)=>{
    assert.equal(url,h.props.PI_API_URL);assert.equal(options.headers.Origin,'https://tiagogt0000.github.io');
    assert.equal(options.headers.Authorization,'Bearer '+'a'.repeat(64));
    assert.equal(JSON.parse(options.payload).token,undefined);
    return {getResponseCode:()=>success?200:503,getContentText:()=>JSON.stringify(success?{result:{version:123}}:{error:'Nicht bereit.'})};
  }};
  assert.equal(h.request({action:'check'}).version,123);success=false;
  assert.throws(()=>h.request({action:'push',base:0,ops:[]}),/Nicht bereit/);assert.equal(h.rows.length,1);
});
test('Final export freezes first, aborting before cutover can restore Google, activated relay cannot be cancelled',()=>{
  const h=migration();let exports=0;
  h.ctx.exportLatinioForPi=()=>{assert.equal(h.props.PI_MIGRATION_FROZEN,'1');exports++;};
  h.ctx.beginPiMigrationExport();assert.equal(exports,1);assert.equal(h.props.PI_MIGRATION_FROZEN,'1');
  h.ctx.cancelPiMigrationBeforeCutover();assert.equal(h.props.PI_MIGRATION_FROZEN,undefined);
  h.ctx.exportLatinioForPi=()=>{throw Error('Export fehlgeschlagen');};
  assert.throws(()=>h.ctx.beginPiMigrationExport(),/Export fehlgeschlagen/);assert.equal(h.props.PI_MIGRATION_FROZEN,undefined);
  h.props.PI_API_URL='https://elektrogilbersserver.tail7c7157.ts.net:8443/api';
  assert.throws(()=>h.ctx.cancelPiMigrationBeforeCutover(),/alten Google/);
});
test('Pi cutover refuses an unhealthy service and activates the legacy relay only when ready',()=>{
  const h=migration();h.props.PI_MIGRATION_FROZEN='1';let ready=false;
  h.ctx.UrlFetchApp={fetch:()=>({getResponseCode:()=>ready?200:503,getContentText:()=>JSON.stringify({ready})})};
  assert.throws(()=>h.ctx.finishPiMigration(),/nicht bereit/);assert.equal(h.props.PI_API_URL,undefined);
  ready=true;h.ctx.finishPiMigration();assert.equal(h.props.PI_MIGRATION_FROZEN,undefined);assert.match(h.props.PI_API_URL,/:8443\/api$/);
});
test('Cloud transport selects REST only for the new API endpoint',()=>{
  assert.ok(createBridge('https://script.google.com/example/exec','token') instanceof GoogleBridge);
  const bridge=createBridge('https://elektrogilbersserver.tail7c7157.ts.net:8443/api','token');
  assert.ok(bridge instanceof RestBridge);bridge.destroy();
});
