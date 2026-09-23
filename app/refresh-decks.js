const collator=new Intl.Collator('de',{numeric:true,sensitivity:'base'});
export const sortedCollections=data=>Object.values(data.collections).filter(c=>!c.refreshSource).sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
export const refreshDecks=data=>Object.values(data.settings).filter(x=>x?.kind==='refreshDeck').sort((a,b)=>collator.compare(a.name,b.name)||a.id.localeCompare(b.id));
const sourceActive=(data,collection)=>!!collection&&data.settings['collection-active_'+collection.id]?.active!==false;
export function deckMembers(data,deck){return (deck?.members||[]).filter(m=>data.words[m.wordId]&&data.collections[data.words[m.wordId].collectionId]);}
export function pendingMembers(data,deck){
 const latest=new Map();
 for(const r of Object.values(data.reviews)){if(r.repeat)continue;const p=latest.get(r.wordId);if(!p||r.at>p.at||(r.at===p.at&&r.id>p.id))latest.set(r.wordId,r);}
 return deckMembers(data,deck).filter(m=>{const r=latest.get(m.wordId);return !r||r.at<=m.addedAt||r.grade!=='full';});
}
export function selectedDeckPending(data,wordId,ids){
 const selected=new Set(ids);
 const decks=refreshDecks(data).filter(deck=>selected.has(deck.id)&&deck.active!==false&&deckMembers(data,deck).some(member=>member.wordId===wordId));
 if(!decks.length)return null;
 const pending=new Set(decks.flatMap(deck=>pendingMembers(data,deck).map(member=>member.wordId)));
 return pending.has(wordId);
}
export function trainingDecks(data){return [...sortedCollections(data).map(c=>({...c,active:data.settings['collection-active_'+c.id]?.active!==false})),...refreshDecks(data).map(d=>({...d,active:d.active!==false}))];}
export function wordEnabled(data,id){const w=data.words[id],source=w&&data.collections[w.collectionId];return !!source&&(source.refreshSource?sourceActive(data,source):data.settings['collection-active_'+source.id]?.active!==false||refreshDecks(data).some(d=>d.active!==false&&deckMembers(data,d).some(m=>m.wordId===id)));}
export function wordsForDecks(data,ids){
 const chosen=new Set(ids),wordIds=new Set();
 for(const w of Object.values(data.words))if(data.collections[w.collectionId]&&chosen.has(w.collectionId)&&data.settings['collection-active_'+w.collectionId]?.active!==false)wordIds.add(w.id);
 // A selected, active refresher is its own explicit word selection. Include
 // exactly its members, even if their source lesson is inactive or they were
 // already mastered; unrelated inactive lessons remain excluded above.
 for(const d of refreshDecks(data))if(chosen.has(d.id)&&d.active!==false)for(const m of deckMembers(data,d))wordIds.add(m.wordId);
 return [...wordIds].map(id=>data.words[id]);
}
export function saveDeck(data,existing,id,name,wordIds,now=Date.now()){
 const title=name.trim();if(!title||title.length>100)throw Error('Bitte einen Namen mit höchstens 100 Zeichen eingeben.');
 const valid=[...new Set(wordIds)].filter(id=>data.words[id]&&data.collections[data.words[id].collectionId]);
 const before=new Map((existing?.members||[]).map(m=>[m.wordId,m]));
 return {id,kind:'refreshDeck',name:title,active:existing?.active!==false,members:valid.map(wordId=>before.get(wordId)||{wordId,addedAt:now})};
}
export function checkResultWords(data,session){return [...new Set(Object.values(data.reviews).filter(r=>r.id.startsWith(session.id+'-')&&!r.repeat&&r.grade!=='full'&&data.words[r.wordId]&&data.collections[data.words[r.wordId].collectionId]).map(r=>r.wordId))];}
