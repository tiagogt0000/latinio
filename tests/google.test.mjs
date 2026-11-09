import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
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
 const h=harness();assert.throws(()=>h.ctx.latinioApi({action:'check',token:'b'.repeat(64)}),/anmelden/);
 assert.throws(()=>h.request({action:'push',base:0,ops:[{...op,key:'__proto__'}]}),/Kennung/);
 assert.equal(h.rows.length,1);
});
