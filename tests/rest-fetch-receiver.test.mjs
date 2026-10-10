import test from 'node:test';
import assert from 'node:assert/strict';
import {RestBridge} from '../app/rest-bridge.js';

test('Default REST fetch retains the global receiver required by Safari',async t=>{
  const original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async function(url,options){
    assert.equal(this,globalThis,'native Window.fetch requires the Window receiver');
    assert.equal(url,'https://example.org/api');
    assert.equal(options.headers.Authorization,'Bearer test');
    return {ok:true,json:async()=>({result:{version:2494}})};
  };
  const bridge=new RestBridge('https://example.org/api','test');
  t.after(()=>bridge.destroy());
  assert.deepEqual(await bridge.request('check'),{version:2494});
});
