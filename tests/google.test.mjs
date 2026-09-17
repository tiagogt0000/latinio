import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
const op={id:'change-1',entity:'collections',key:'deck',value:{id:'deck',name:'Sammlung'},device:'iphone',at:1000,seq:1};
test('Existing Google backend accepts and returns confusion pairs and practice results',()=>{
 const h=harness();
 const pair={id:'confusion_1',kind:'confusion',wordIds:['a','b'],createdAt:1000};
 const review={id:'cr_1',kind:'confusionReview',pairId:pair.id,correct:false,at:2000};
 const ops=[pair,review].map((value,i)=>({...op,id:'confusion-op-'+i,entity:'settings',key:value.id,value}));
 const pushed=h.request({action:'push',base:0,ops});assert.equal(pushed.version,2);
 const pulled=h.request({action:'pull',since:0});assert.equal(pulled.data.settings.confusion_1.wordIds[1],'b');assert.equal(pulled.data.settings.cr_1.correct,false);
});
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
