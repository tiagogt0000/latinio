import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

export const SENTENCE_CATALOGUE_PATH=fileURLToPath(new URL('./content/landscape-sentences.json.gz',import.meta.url));
let cache=null,stamp=null;
function readCatalogue(){
  let next;
  try{const stat=statSync(SENTENCE_CATALOGUE_PATH);next=`${stat.mtimeMs}:${stat.size}`;}
  catch(error){if(error.code==='ENOENT')return {schema:1,version:null,collections:[],sentences:[]};throw error;}
  if(!cache||stamp!==next){cache=JSON.parse(gunzipSync(readFileSync(SENTENCE_CATALOGUE_PATH)).toString('utf8'));stamp=next;}
  return cache;
}
export function readSentenceCatalogue(){return structuredClone(readCatalogue());}
const values=value=>Array.isArray(value)?value:Object.values(value||{});
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=500;
const tileKey=value=>value.trim().normalize('NFC').toLocaleLowerCase('de');
const bag=tiles=>tiles.map(tileKey).sort().join('\u0000');

export function getSentenceCatalogue(collections=null){
  const catalogue=readCatalogue(),counts=new Map();
  for(const sentence of catalogue.sentences)counts.set(sentence.collectionId,(counts.get(sentence.collectionId)||0)+1);
  const requested=collections===null?catalogue.collections:values(collections);
  return {schema:1,version:catalogue.version,total:catalogue.sentences.length,
    collections:requested.map(c=>({id:c.id,name:c.name||c.id,count:counts.get(c.id)||0,
      status:counts.get(c.id)?'ready':'missing'}))};
}
export function getCollectionSentences(collectionId){
  if(typeof collectionId!=='string')return [];
  return structuredClone(readCatalogue().sentences.filter(sentence=>sentence.collectionId===collectionId));
}

/** Structural/lexical checks are not a claim of human linguistic review. */
export function validateSentenceCatalogue(catalogue,vocabulary,{minimumPerCollection=0}={}){
  const errors=[],warnings=[],counts=new Map(),seenIds=new Set(),seenLatin=new Set();
  const collections=new Map(values(vocabulary?.collections).map(c=>[c.id,c]));
  const words=new Map(values(vocabulary?.words).map(w=>[w.id,w]));
  const covered=new Map();
  if(catalogue?.schema!==1||!Array.isArray(catalogue?.sentences)||!Array.isArray(catalogue?.collections))return {ok:false,errors:['Ungültiges Katalogformat.'],warnings,stats:{total:0,collections:[]}};
  for(const s of catalogue.sentences){
    if(!s||typeof s!=='object'||Array.isArray(s)){errors.push('Ungültige Aufgabe.');continue;}
    const at=typeof s?.id==='string'?s.id:'(ohne ID)';
    const fail=message=>errors.push(`${at}: ${message}`);
    if(!text(s?.id)||seenIds.has(s.id))fail('Fehlende oder doppelte Aufgaben-ID.');
    seenIds.add(s?.id);
    if(!collections.has(s?.collectionId))fail('Unbekannte Sammlung.');
    counts.set(s?.collectionId,(counts.get(s?.collectionId)||0)+1);
    const latin=typeof s.latin==='string'?s.latin:'';
    if(!text(latin)||seenLatin.has(tileKey(latin)))fail('Leerer oder doppelter lateinischer Satz.');
    seenLatin.add(tileKey(latin));
    if(!['present','perfect'].includes(s?.tense))fail('Nur Präsens/Perfekt sind freigegeben.');
    if(![1,2,3].includes(s?.difficulty))fail('Ungültige Schwierigkeit.');
    if(!Array.isArray(s?.tokens)||!s.tokens.length){fail('Keine lateinischen Wörter.');continue;}
    const tokenIds=new Set();
    for(const token of s.tokens){
      if(!text(token?.text))fail('Leerer Wortbaustein.');
      if(!words.has(token?.wordId))fail(`Unbekannte Vokabel-ID für „${token?.text||''}“.`);
      else tokenIds.add(token.wordId);
    }
    const rendered=s.tokens.map(t=>typeof t?.text==='string'?t.text:'').join(' ').replace(/[.?!]+$/,'');
    if(rendered!==latin.replace(/[.?!]+$/,''))fail('Satz und Wortzuordnung weichen voneinander ab.');
    if(!Array.isArray(s.focusWordIds)||!s.focusWordIds.length)fail('Keine Schwerpunktvokabel.');
    for(const id of Array.isArray(s.focusWordIds)?s.focusWordIds:[]){
      if(!tokenIds.has(id)||words.get(id)?.collectionId!==s.collectionId)fail('Ungültige Schwerpunktzuordnung.');
      if(!covered.has(s.collectionId))covered.set(s.collectionId,new Set());covered.get(s.collectionId).add(id);
    }
    if(!Array.isArray(s.translations)||!s.translations.length){fail('Keine Übersetzung.');continue;}
    let expected=null;const answers=new Set(),allTiles=new Set();
    for(const answer of s.translations){
      if(!Array.isArray(answer)||answer.length<2||answer.some(t=>!text(t))){fail('Ungültige Übersetzungsbausteine.');continue;}
      const sequence=answer.map(tileKey).join('\u0000');
      if(answers.has(sequence))fail('Doppelte akzeptierte Lösung.');answers.add(sequence);
      const current=bag(answer);if(expected!==null&&expected!==current)fail('Alternative Wortstellung verwendet andere Bausteine.');expected=current;
      answer.forEach(t=>allTiles.add(tileKey(t)));
    }
    if(!Array.isArray(s.distractors)||s.distractors.length<2||s.distractors.some(t=>!text(t)))fail('Mindestens zwei plausible Ablenkungen benötigt.');
    else if(new Set(s.distractors.map(tileKey)).size!==s.distractors.length||s.distractors.some(t=>allTiles.has(tileKey(t))))fail('Doppelte oder zur Lösung gehörende Ablenkungen.');
  }
  const stats=values(vocabulary?.collections).map(c=>{
    const count=counts.get(c.id)||0,totalWords=[...words.values()].filter(w=>w.collectionId===c.id).length;
    if(count<minimumPerCollection)errors.push(`${c.name||c.id}: ${count} statt mindestens ${minimumPerCollection} Sätzen.`);
    const coverage=covered.get(c.id)?.size||0;if(coverage<totalWords)warnings.push(`${c.name||c.id}: ${coverage}/${totalWords} Vokabeln in Satzaufgaben; übrige Wörter bleiben in Vokabelübungen verfügbar.`);
    return {id:c.id,name:c.name,count,coveredWords:coverage,totalWords};
  });
  return {ok:!errors.length,errors,warnings,stats:{total:catalogue.sentences.length,collections:stats}};
}
