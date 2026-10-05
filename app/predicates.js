export const PREDICATE_FORMAT='latinio-predicates';
export const PREDICATE_STORAGE_KEY='latinio-predicates-v1';
export const predicateStorageKey=profileId=>`${PREDICATE_STORAGE_KEY}:${profileId||'default'}`;

const text=value=>String(value??'').trim();
const key=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de');

export function parsePredicateFile(input){
 const file=typeof input==='string'?JSON.parse(input):input;
 if(!file||file.format!==PREDICATE_FORMAT||file.schema!==1||!Array.isArray(file.predicates))throw Error('Das ist keine gültige Latinio-Prädikatdatei. Nutze das Format „latinio-predicates“, Version 1.');
 const predicates=[],seen=new Set();
 for(const [index,row] of file.predicates.entries()){
  const grundform=text(row?.grundform??row?.Grundform??row?.lemma);
  const raw=row?.praedikat??row?.prädikat??row?.Praedikat??row?.Prädikat??row?.predicate;
  const accepted=(Array.isArray(raw)?raw:[raw]).flatMap(value=>text(value).split('|').map(text)).filter(Boolean);
  if(!grundform||!accepted.length)throw Error(`Eintrag ${index+1}: Grundform und Prädikat müssen ausgefüllt sein.`);
  if(grundform.length>180||accepted.some(value=>value.length>300))throw Error(`Eintrag ${index+1}: Ein Eintrag ist zu lang.`);
  const id=key(grundform);if(seen.has(id))throw Error(`Die Grundform „${grundform}“ steht mehrfach in der Datei.`);seen.add(id);
  predicates.push({grundform,praedikate:[...new Set(accepted)]});
 }
 if(!predicates.length)throw Error('Die Datei enthält keine Prädikate.');
 return {name:text(file.name)||'Prädikate',items:predicates};
}

export function mergePredicateFiles(existing,incoming){
 const items=new Map((existing||[]).map(item=>[key(item.grundform),item]));
 for(const item of incoming.items)items.set(key(item.grundform),item);
 return [...items.values()];
}

export function readPredicateStore(storage,storageKey=PREDICATE_STORAGE_KEY){
 try{const value=JSON.parse(storage.getItem(storageKey)||'[]');return Array.isArray(value)?value.filter(row=>row&&typeof row.grundform==='string'&&Array.isArray(row.praedikate)):[];}
 catch{return [];}
}

export function writePredicateStore(storage,items,storageKey=PREDICATE_STORAGE_KEY){storage.setItem(storageKey,JSON.stringify(items));}

export function predicateMatches(expected,answer){
 const given=key(answer).replace(/[.,;:!?]+$/g,'').trim();
 return (expected||[]).some(value=>key(value).replace(/[.,;:!?]+$/g,'').trim()===given);
}

export function shufflePredicates(items,random=Math.random){
 const result=[...(items||[])];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
