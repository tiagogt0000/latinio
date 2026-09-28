import {saveDeck,deckMembers} from './refresh-decks.js';
import {suggestRefreshMatch} from './refresh-import.js';

const availableWords=data=>Object.values(data.words).filter(word=>data.collections[word.collectionId]&&!data.collections[word.collectionId].refreshSource);
const legacyEntries=(data,deck)=>deckMembers(data,deck).filter(member=>data.collections[data.words[member.wordId].collectionId]?.refreshSource);

export function legacyRefreshCount(data,deckId){
 const deck=data.settings[deckId];return deck?.kind==='refreshDeck'?legacyEntries(data,deck).length:0;
}

// Called only from the explicit user action. Existing progress is never copied
// from a duplicate entry; the deck is pointed at the canonical vocabulary ID.
export function reconcileRefreshDeck(data,deckId,resolutions={},now=Date.now()){
 const existing=data.settings[deckId];
 if(existing?.kind!=='refreshDeck')throw Error('Diese Auffrisch-Sammlung ist nicht mehr vorhanden.');
 const available=availableWords(data),members=deckMembers(data,existing),wordIds=[],unmatched=[],mappedLegacyIds=[];
 let automatic=0,manual=0;
 for(const member of members){
  const word=data.words[member.wordId],source=word&&data.collections[word.collectionId];
  if(!source?.refreshSource){wordIds.push(member.wordId);continue;}
  const picked=resolutions[word.id];
  if(picked&&available.some(candidate=>candidate.id===picked)){wordIds.push(picked);mappedLegacyIds.push(word.id);manual++;continue;}
  const suggestion=suggestRefreshMatch(word,available,data);
  if(suggestion.match){wordIds.push(suggestion.match.id);mappedLegacyIds.push(word.id);automatic++;continue;}
  unmatched.push({word,candidates:suggestion.candidates.map(candidate=>({id:candidate.id,latin:candidate.latin,collection:data.collections[candidate.collectionId].name}))});
  wordIds.push(word.id);
 }
 const deck=saveDeck(data,existing,deckId,existing.name,wordIds,now);
 const before=members.length,removedDuplicates=before-deck.members.length;
 const otherReferences=new Set(Object.values(data.settings).filter(item=>item?.kind==='refreshDeck'&&item.id!==deckId).flatMap(item=>(item.members||[]).map(member=>member.wordId)));
 const removeWordIds=mappedLegacyIds.filter(id=>!otherReferences.has(id));
 const sourceCollections=new Set(removeWordIds.map(id=>data.words[id]?.collectionId).filter(Boolean));
 const removeCollectionIds=[...sourceCollections].filter(id=>Object.values(data.words).every(word=>word.collectionId!==id||removeWordIds.includes(word.id)));
 const changed=JSON.stringify(deck.members)!==JSON.stringify(existing.members)||removeWordIds.length>0;
 return {deck,automatic,manual,removedDuplicates,unmatched,changed,removeWordIds,removeCollectionIds,available:available.map(w=>({id:w.id,latin:w.latin,collection:data.collections[w.collectionId].name}))};
}
