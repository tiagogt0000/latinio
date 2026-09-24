import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSession,evaluate,emptyData,applyOps,progressFor,chooseWords,rebase,parseImport} from '../app/core.js';
import {vocabulary,collection} from '../app/vocabulary.js';
import {progressivePassResult} from '../app/progressive-learning.js';
const get=latin=>vocabulary.find(w=>w.latin===latin);
test('46 echte Vokabeln; Nomenformen und optionale Klammern bleiben erhalten',()=>{
 assert.equal(vocabulary.length,46);assert.equal(get('vox, vocis').meanings.length,3);
 for(const a of ['bleiben','zurückbleiben'])assert.equal(evaluate(get('remanere'),[a]).grade,'full');
 for(const a of ['wie','so wie'])assert.equal(evaluate(get('sicut'),[a]).grade,'full');
 for(const a of ['ein wenig','um ein wenig'])assert.equal(evaluate(get('paulo'),[a]).grade,'full');
 for(const a of ['lassen','loslassen'])assert.equal(evaluate(get('mittere'),[a,'schicken','werfen']).grade,'full');
});
test('Teilwissen besteht, fehlende Bedeutungen bleiben fällig; falsche Zusätze zählen',()=>{
 const result=evaluate(get('mittere'),['lassen']);assert.equal(result.grade,'partial');assert.deepEqual(result.missing.map(m=>m.label),['schicken','werfen']);
 assert.equal(evaluate(get('mittere'),['lassen','falsch']).grade,'wrong');
 assert.equal(evaluate(get('mittere'),['lassen','lassen']).grade,'partial');
 assert.equal(evaluate(get('mittere'),['']).grade,'wrong');
});
test('Alle Bedeutungen in einem Feld werden in beliebiger Reihenfolge automatisch erkannt',()=>{
 const word={meanings:[['in der Tat'],['Unglück'],['Niederlage']]};
 assert.equal(evaluate(word,['Niederlage in der Tat Unglück']).grade,'full');
 assert.equal(evaluate(word,['Unglück in der Tat']).grade,'partial');
 assert.equal(evaluate(word,['in der Tat Unglück daneben Niederlage']).grade,'wrong');
});
test('Tippfehler und beide manuelle Korrekturen beeinflussen die Bewertung',()=>{
 const word=get('soror, sororis');
 assert.equal(evaluate(word,['Schwseter']).rows[0].kind,'typo');
 assert.equal(evaluate(word,['Schwseter'],true,{0:'wrong'}).grade,'wrong');
 assert.equal(evaluate(word,['Schwseter'],false).grade,'wrong');
 assert.equal(evaluate(word,['xyz'],true,{0:0}).grade,'full');
 assert.equal(evaluate(get('mons, montis'),['Bergg']).grade,'wrong');
 assert.equal(evaluate(get('consilium'),['rat','beratung','BESCHLUSS','plan']).grade,'full');
});
test('Gleichwertige Alternativen zählen als ein Lernziel',()=>{
 const w={meanings:[['sprechen','reden'],['sagen']]};
 assert.equal(evaluate(w,['reden','sagen']).grade,'full');
 assert.equal(evaluate(w,['reden','sprechen']).grade,'partial');
});
test('Wiederholung am Rundenende löscht den ersten Fehler nicht',()=>{
 const wrong={id:'r1',wordId:'x',grade:'wrong',at:1000,repeat:false};
 const repeat={id:'r2',wordId:'x',grade:'full',at:2000,repeat:true};
 const p=progressFor('x',{r1:wrong,r2:repeat});assert.equal(p.streak,0);assert.equal(p.due,1000+43200000);
 const corrected=progressFor('x',{r1:{...wrong,grade:'full'},r2:repeat});assert.equal(corrected.streak,1);
});
test('Sichere Wörter erhalten wachsende Abstände; Auswahl respektiert Sammlungen',()=>{
 const d=emptyData();d.collections[collection.id]=collection;d.words[vocabulary[0].id]=vocabulary[0];d.words[vocabulary[1].id]=vocabulary[1];
 d.reviews.a={id:'a',wordId:vocabulary[0].id,grade:'full',at:1000,repeat:false};
 assert.deepEqual(chooseWords(d,[collection.id],1,'smart',2000),[vocabulary[1].id]);
 assert.deepEqual(chooseWords(d,['other'],10,'all',2000),[]);
 const rs={};for(let i=0;i<3;i++)rs[i]={id:String(i),wordId:'x',grade:'full',at:i*1e9,repeat:false};
 assert.equal(progressFor('x',rs).level,'known');
});
const op=(id,key,value,device='ipad')=>({id,entity:'words',key,value,device,seq:1,at:1000});
test('Gleichzeitige Änderungen werden erkannt statt blind überschrieben',()=>{
 const cloud=op('cloud','x',{latin:'neu'},'iphone'),local=op('local','x',{latin:'lokal'});
 const state=applyOps(emptyData(),[cloud]);
 assert.equal(rebase(state,[cloud],[local]).conflicts.length,1);
 assert.equal(rebase(state,[cloud],[local],{'words:x':'cloud'}).pending.length,0);
 assert.equal(rebase(state,[cloud],[local],{'words:x':'local'}).data.words.x.latin,'lokal');
});
test('Unabhängige Änderungen, Löschungen und Wiederholungsversuche bleiben konsistent',()=>{
 const cloud=op('a','a',{latin:'a'},'iphone'),local=op('b','b',{latin:'b'});
 const state=applyOps(emptyData(),[cloud]);
 assert.equal(rebase(state,[cloud],[local]).conflicts.length,0);
 assert.equal(rebase(state,[cloud],[cloud]).pending.length,0);
 assert.equal(rebase(state,[cloud],[op('c','a',{latin:'c'},'iphone')]).conflicts.length,0);
 const deletion=op('d','a',null,'iphone');assert.equal(rebase(emptyData(),[deletion],[op('e','a',{latin:'edit'})]).conflicts.length,1);
});
test('Import validiert, erkennt doppelte Wörter und überschreibt keine Sammlung',()=>{
 const input={format:'latinio-collection',schema:1,id:'neu',name:'Neu',words:[{latin:'a',meanings:[['b']]},{latin:'a',meanings:[['c']]}]};
 const parsed=parseImport(input,emptyData());assert.equal(parsed.words.length,1);assert.equal(parsed.skipped,1);
 const d=emptyData();d.collections.neu={};assert.throws(()=>parseImport(input,d),/bereits/);
 assert.throws(()=>parseImport({...input,words:[{latin:'a',meanings:['b']}]},emptyData()));
 assert.throws(()=>applyOps(emptyData(),[op('x','__proto__',{})]));
});
test('Ein frisches Gerät bringt aus der Cloud gelöschte Startvokabeln nicht zurück',()=>{
 const bootstrap={...op('seed','a',{latin:'alt'}),bootstrap:true};
 const deletion=op('delete','a',null,'iphone');
 const merged=rebase(emptyData(),[deletion],[bootstrap]);
 assert.equal(merged.pending.length,0);assert.equal(merged.data.words.a,undefined);
});

test('Auffrischtest: eine oder alle Bedeutungen bestimmen den sicheren Lernstand',()=>{
 const word={meanings:[['sprechen','reden'],['sagen']]};
 const any={mode:'inactive-check',meaningRequirement:'any'};
 const all={mode:'inactive-check',meaningRequirement:'all'};
 assert.equal(evaluateSession(word,['reden'],true,{},any).grade,'full');
 assert.equal(evaluateSession(word,['reden'],true,{},all).grade,'partial');
 assert.equal(evaluateSession(word,['reden','sagen'],true,{},all).grade,'full');
 assert.equal(evaluateSession(word,['falsch'],true,{},any).grade,'wrong');
 assert.equal(evaluateSession(word,[''],true,{},any).grade,'wrong');
 assert.equal(evaluateSession(word,['reden'],true,{0:'wrong'},any).grade,'wrong');
 assert.equal(evaluateSession(word,['falsch'],true,{0:0},any).grade,'full');
 assert.equal(evaluateSession(word,['reden'],true,{}, {...any,mode:'smart'}).grade,'partial');
 assert.equal(evaluateSession(word,['reden'],true,{}, {mode:'inactive-check'}).grade,'partial');
 const review={id:'test-0',wordId:'x',mode:'inactive-check',at:1000,grade:evaluateSession(word,['reden'],true,{},any).grade};
 assert.equal(progressFor('x',{review}).level,'known');
});
test('Schrittweises Lernen staffelt ab drei Fehlern und wiederholt ein oder zwei im selben Test',()=>{
 assert.deepEqual(progressivePassResult([]),{failed:[],action:'complete'});
 assert.deepEqual(progressivePassResult(['a']),{failed:['a'],action:'repeat-in-stage'});
 assert.deepEqual(progressivePassResult(['a','b']),{failed:['a','b'],action:'repeat-in-stage'});
 assert.deepEqual(progressivePassResult(['a','b','c','c'],10),{failed:['a','b','c'],action:'next-stage'});
 assert.deepEqual(progressivePassResult(['a','b','c'],4),{failed:['a','b','c'],action:'repeat-in-stage'});
 assert.deepEqual(progressivePassResult(['a','b'],4),{failed:['a','b'],action:'repeat-in-stage'});
});
