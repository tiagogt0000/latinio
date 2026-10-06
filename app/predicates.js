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

// Individual settings records reuse the existing authenticated, subject-scoped
// operation log. Concurrent imports of different verbs do not replace a whole deck.
export async function predicateCloudKey(grundform){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key(grundform)));
 return 'predicate_'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

export function predicateCloudItems(data){
 return Object.values(data?.settings||{}).filter(row=>row?.kind==='predicateItem'&&typeof row.grundform==='string'&&Array.isArray(row.praedikate)).map(({grundform,praedikate})=>({grundform,praedikate}));
}

export async function predicateChanges(items,name='Prädikate'){
 return Promise.all(items.map(async item=>{
  const id=await predicateCloudKey(item.grundform);
  return ['settings',id,{kind:'predicateItem',id,grundform:item.grundform,praedikate:item.praedikate,name}];
 }));
}

export async function migrateLocalPredicates(store,items){
 if(store.subject==='english'||store.doc.predicatesCloudMigrated)return;
 const changes=(await predicateChanges(items)).filter(([,id])=>!store.data.settings[id]);
 if(changes.length)await store.commit(changes);
 await store.update(doc=>{doc.predicatesCloudMigrated=true;return doc;});
}
