import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData} from '../app/core.js';
import {legacyRefreshCount,reconcileRefreshDeck} from '../app/refresh-reconcile.js';

function fixture(){
 const d=emptyData();d.collections.lesson={id:'lesson',name:'Lektion 1'};d.collections.old={id:'old',name:'Alte Datei',refreshSource:true};
 d.settings.deck={id:'deck',kind:'refreshDeck',name:'Auffrischen 1',active:true,members:[]};return d;
}
const word=(id,collectionId,latin,meanings)=>({id,collectionId,latin,meanings});

test('explicit review links unique old refresh copies to originals and removes duplicate membership without changing reviews',()=>{
 const d=fixture();d.words.original=word('original','lesson','gerēre',[['führen'],['tragen']]);d.words.copy=word('copy','old','gerere',[['führen']]);d.settings.deck.members=[{wordId:'original',addedAt:3},{wordId:'copy',addedAt:4}];d.reviews.review={id:'review',wordId:'original',grade:'full',at:10};
 assert.equal(legacyRefreshCount(d,'deck'),1);const result=reconcileRefreshDeck(d,'deck',{},20);
 assert.equal(result.automatic,1);assert.equal(result.removedDuplicates,1);assert.deepEqual(result.deck.members.map(m=>m.wordId),['original']);assert.deepEqual(result.removeWordIds,['copy']);assert.deepEqual(result.removeCollectionIds,['old']);assert.equal(d.reviews.review.grade,'full');assert.equal(d.settings.deck.members[1].wordId,'copy');
});

test('ambiguous matches wait for manual selection and unmatched copies remain untouched',()=>{
 const d=fixture();d.words.one=word('one','lesson','vox, vocis',[['Stimme']]);d.words.two=word('two','lesson','vox, vocis',[['Stimme']]);d.words.copy=word('copy','old','vox',[['Stimme']]);d.words.unique=word('unique','old','ignotus',[['unbekannt']]);d.settings.deck.members=[{wordId:'copy',addedAt:1},{wordId:'unique',addedAt:2}];
 const pending=reconcileRefreshDeck(d,'deck');assert.equal(pending.automatic,0);assert.equal(pending.unmatched.length,2);assert.deepEqual(pending.unmatched[0].candidates.map(x=>x.id),['one','two']);assert.deepEqual(pending.deck.members.map(m=>m.wordId),['copy','unique']);
 const assigned=reconcileRefreshDeck(d,'deck',{copy:'two'});assert.equal(assigned.manual,1);assert.equal(assigned.unmatched.length,1);assert.deepEqual(assigned.deck.members.map(m=>m.wordId),['two','unique']);assert.deepEqual(assigned.removeWordIds,['copy']);assert.deepEqual(assigned.removeCollectionIds,[]);
});

test('manual reconciliation logic is only exposed by an explicit button, never by app startup',async()=>{
 const fs=await import('node:fs');const main=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
 assert.match(main,/data-action="refresh-reconcile"/);const boot=main.slice(main.indexOf('async function boot('));assert.doesNotMatch(boot,/reconcileRefreshDeck\(/);
});
