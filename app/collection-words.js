import {normalize,progressFor} from './core.js';
import {deckMembers,pendingMembers} from './refresh-decks.js';

// Index the history once, rather than scanning every review for every visible word.
// Keep this local to the render so edits, new reviews and cloud updates are immediate.
export function collectionWords(data,{filter='all',query='',directions=[null]}={}){
 const deck=data.settings[filter]?.kind==='refreshDeck'?data.settings[filter]:null;
 const members=deck?new Set(deckMembers(data,deck).map(member=>member.wordId)):null;
 const search=normalize(query);
 const words=Object.values(data.words).filter(word=>data.collections[word.collectionId]
  &&(members?members.has(word.id):filter==='all'||word.collectionId===filter)
  &&(!search||normalize(word.latin+' '+word.meanings.flat().join(' ')).includes(search)));
 if(!words.length)return [];
 const histories=new Map(words.map(word=>[word.id,[]]));
 for(const review of Object.values(data.reviews))histories.get(review.wordId)?.push(review);
 const pending=deck?new Set(directions.flatMap(direction=>pendingMembers(data,deck,direction).map(member=>member.wordId))):null;
 return words.map(word=>{
  const progress=directions.map(direction=>progressFor(word.id,histories.get(word.id),direction));
  const level=progress.every(p=>p.level==='known')?'known':progress.some(p=>p.seen)?'learning':'new';
  return {word,level,inRefreshDeck:!!deck,pending:pending?.has(word.id)??false};
 });
}
