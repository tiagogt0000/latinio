import {parseImport,normalize,uid} from './core.js';
import {saveDeck} from './refresh-decks.js';

export function parseCollectionFile(input,data){
 if(input?.format!=='latinio-refresh')return parseImport(input,data);
 // Reuse the normal strict vocabulary validation, without trusting file IDs.
 const parsed=parseImport({...input,format:'latinio-collection',id:uid()},data);
 const signature=w=>JSON.stringify([normalize(w.latin),w.meanings.map(g=>g.map(normalize).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
 const matches=new Map();
 for(const w of Object.values(data.words))if(data.collections[w.collectionId]){const key=signature(w);if(!matches.has(key))matches.set(key,[]);matches.get(key).push(w);}
 const words=[],members=[],previewWords=[];let linked=0;
 for(const w of parsed.words){const candidates=matches.get(signature(w))||[];
  if(candidates.length>1)throw Error('Mehrere passende Originaleinträge für „'+w.latin+'“. Bitte doppelte Originaleinträge zuerst klären.');
  const existing=candidates[0];if(existing){members.push(existing.id);previewWords.push(existing);linked++;}else{words.push(w);members.push(w.id);previewWords.push(w);}
 }
 const collection=words.length?{...parsed.collection,refreshSource:true}:null;
 const next={...data,collections:{...data.collections,...(collection?{[collection.id]:collection}:{})},words:{...data.words,...Object.fromEntries(words.map(w=>[w.id,w]))}};
 const deck=saveDeck(next,null,'refresh_'+uid(),parsed.collection.name,members);
 return {collection,words,deck,linked,previewWords,skipped:parsed.skipped};
}
export function importChanges(x){return [...(x.collection?[['collections',x.collection.id,x.collection]]:[]),...x.words.map(w=>['words',w.id,w]),...(x.deck?[['settings',x.deck.id,x.deck],...(x.collection?[['settings','collection-active_'+x.collection.id,{kind:'collectionActivity',active:false}]]:[])]:[])];}
