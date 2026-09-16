import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Startup and resume use background sync without a blocking cloud dialog',()=>{
  const main=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
  assert.doesNotMatch(main,/StartupGate|gateDialog|gate\.begin|gate\?\.blocked/);
  assert.match(main,/render\(\);sync\.schedule\(0\)/);
  assert.match(main,/visibilitychange[^\n]+sync\.schedule\(0\)/);
  assert.match(main,/pageshow[^\n]+sync\.schedule\(0\)/);
  assert.match(main,/if\(sync\.remote\)\{remoteModal\(\);return;\}/);
});
