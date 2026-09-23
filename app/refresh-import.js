import {parseImport,normalize,uid,distance} from './core.js';
import {saveDeck} from './refresh-decks.js';

const latinKey=value=>normalize(String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')).split(/[;,]/)[0].replace(/[^a-z0-9]/g,'');
const meaningKey=value=>normalize(String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,''));
export function parseCollectionFile(input,data,resolutions={}){
 if(input?.format!=='latinio-refresh')return parseImport(input,data);
 // Reuse the normal strict vocabulary validation, without trusting file IDs.
 const parsed=parseImport({...input,format:'latinio-collection',id:uid()},data);
 const available=Object.values(data.words).filter(w=>data.collections[w.collectionId]);
 const words=[],members=[],previewWords=[],unmatched=[];let linked=0;
 for(const [index,w] of parsed.words.entries()){
  const key=latinKey(w.latin),manualId=resolutions[index];
  if(manualId==='new'){words.push(w);members.push(w.id);previewWords.push(w);continue;}
  if(manualId){const existing=data.words[manualId];if(!existing||!data.collections[existing.collectionId])throw Error('Die manuelle Zuordnung für „'+w.latin+'“ ist nicht mehr verfügbar.');members.push(existing.id);previewWords.push(existing);linked++;continue;}
  const exact=available.filter(existing=>latinKey(existing.latin)===key);
  if(exact.length===1){members.push(exact[0].id);previewWords.push(exact[0]);linked++;continue;}
  if(exact.length>1){unmatched.push({index,latin:w.latin,meanings:w.meanings,candidates:exact.map(x=>({id:x.id,latin:x.latin,collection:data.collections[x.collectionId].name}))});previewWords.push(w);continue;}
  const limit=key.length>=10?2:key.length>=6?1:0;
  const near=limit?available.map(x=>({x,d:distance(key,latinKey(x.latin))})).filter(x=>x.d>0&&x.d<=limit).sort((a,b)=>a.d-b.d||a.x.latin.localeCompare(b.x.latin,'de')).map(x=>x.x):[];
  const bestDistance=near.length?distance(key,latinKey(near[0].latin)):Infinity;
  const best=near.filter(x=>distance(key,latinKey(x.latin))===bestDistance);
  const meaningful=new Set(w.meanings.flat().map(meaningKey));
  const overlap=x=>x.meanings.flat().map(meaningKey).filter(m=>meaningful.has(m)).length;
  const bestScore=best.length?Math.max(...best.map(overlap)):0,top=best.filter(x=>overlap(x)===bestScore);
  if(top.length===1&&bestDistance===1&&bestScore>0){members.push(top[0].id);previewWords.push(top[0]);linked++;continue;}
  const suggestions=(top.length?top:near.slice(0,8)).map(x=>({id:x.id,latin:x.latin,collection:data.collections[x.collectionId].name}));
  unmatched.push({index,latin:w.latin,meanings:w.meanings,candidates:suggestions});previewWords.push(w);
 }
 const collection=words.length?{...parsed.collection,refreshSource:true}:null;
 const next={...data,collections:{...data.collections,...(collection?{[collection.id]:collection}:{})},words:{...data.words,...Object.fromEntries(words.map(w=>[w.id,w]))}};
 const deck=saveDeck(next,null,'refresh_'+uid(),parsed.collection.name,members);
 return {collection,words,deck,linked,previewWords,unmatched,available:available.map(x=>({id:x.id,latin:x.latin,collection:data.collections[x.collectionId].name})),skipped:parsed.skipped};
}
export function importChanges(x){return [...(x.collection?[['collections',x.collection.id,x.collection]]:[]),...x.words.map(w=>['words',w.id,w]),...(x.deck?[['settings',x.deck.id,x.deck]]:[])];}
