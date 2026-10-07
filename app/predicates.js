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
 return Object.entries(data?.settings||{}).filter(([,row])=>row?.kind==='predicateItem'&&typeof row.grundform==='string'&&Array.isArray(row.praedikate)).map(([id,row])=>({...row,id,deckId:row.deckId||legacyPredicateDeckId(row.name)}));
}

// Legacy imports already have a collection name. Derive a stable group without
// rewriting their keys or disturbing existing review/share history.
function legacyPredicateDeckId(name){let hash=14695981039346656037n;for(const byte of new TextEncoder().encode(key(name||'Prädikate')))hash=BigInt.asUintN(64,(hash^BigInt(byte))*1099511628211n);return 'predicate_deck_legacy_'+hash.toString(16);}
export function predicateDecks(data){
 const decks=new Map();
 for(const item of predicateCloudItems(data))if(!decks.has(item.deckId))decks.set(item.deckId,{kind:'predicateDeck',id:item.deckId,name:item.name||'Prädikate',active:true});
 for(const row of Object.values(data?.settings||{}))if(row?.kind==='predicateDeck')decks.set(row.id,row);
 return [...decks.values()].sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true}));
}
export function predicateDeckChanges(data,deck){
 // Names travel with items through the existing predicate sharing endpoint.
 return [['settings',deck.id,{...deck,kind:'predicateDeck'}],...predicateCloudItems(data).filter(item=>item.deckId===deck.id&&item.name!==deck.name).map(item=>['settings',item.id,{...item,name:deck.name}])];
}
export async function importPredicateCollection(data,parsed,newId){
 const deck=predicateDecks(data).find(d=>key(d.name)===key(parsed.name))||{id:newId,kind:'predicateDeck',name:parsed.name,active:true};
 const existing=predicateCloudItems(data).filter(item=>item.deckId===deck.id);
 const changes=await Promise.all(parsed.items.map(async item=>{
  const id=existing.find(row=>key(row.grundform)===key(item.grundform))?.id||await predicateCloudKey(deck.id+':'+item.grundform);
  return ['settings',id,{...item,id,kind:'predicateItem',deckId:deck.id,name:deck.name}];
 }));
 return {deck,changes:[['settings',deck.id,deck],...changes]};
}
export function predicateProgress(data,item){
 const reviews=Object.values(data.settings||{}).filter(row=>row?.kind==='predicateReview'&&(row.itemId?row.itemId===item.id:key(row.grundform)===key(item.grundform))).sort((a,b)=>b.at-a.at);
 return {seen:reviews.length>0,known:reviews[0]?.correct===true,at:reviews[0]?.at||0};
}
export function predicateQueue(data,deckIds,mode='smart',limit=10,random=Math.random){
 let items=shufflePredicates(predicateCloudItems(data).filter(item=>deckIds.includes(item.deckId)),random);
 if(mode==='learning')return items.filter(item=>!predicateProgress(data,item).known);
 if(mode==='refresh')return items.filter(item=>predicateProgress(data,item).known);
 if(mode==='all')return items;
 return items.sort((a,b)=>{const pa=predicateProgress(data,a),pb=predicateProgress(data,b);return Number(pa.known)-Number(pb.known)||pa.at-pb.at;}).slice(0,limit);
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
