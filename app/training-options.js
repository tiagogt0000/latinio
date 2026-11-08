import {progressFor} from './core.js';
import {directionsFor} from './english.js';
import {wordsForDecks,refreshDecks,deckMembers} from './refresh-decks.js';
import {compareReviews,successfulRetry} from './review-history.js';

/** Count the selected tasks without cloning the store or building random queues per word. */
export function trainingOptionCounts(data,ids,{direction=null}={}){
 const words=wordsForDecks(data,ids),directions=direction===null?[null]:directionsFor(direction);
 const histories=new Map(words.map(word=>[word.id,[]]));
 const latest=new Map(directions.map(dir=>[dir,new Map()]));
 for(const review of Object.values(data.reviews)){
  if(!histories.has(review.wordId))continue;
  histories.get(review.wordId).push(review);
  if(successfulRetry(review))continue;
  for(const dir of directions){
   if(dir&&review.direction!==dir)continue;
   const byWord=latest.get(dir),previous=byWord.get(review.wordId);
   if(!previous||compareReviews(review,previous)>0)byWord.set(review.wordId,review);
  }
 }
 const selected=new Set(ids),decks=refreshDecks(data).filter(deck=>selected.has(deck.id)&&deck.active!==false);
 let known=0,learning=0;
 for(const dir of directions){
  // Direction-limited refresh collections must not invent the reverse task.
  const availableIds=ids.filter(id=>!dir||data.settings[id]?.kind!=='refreshDeck'||!data.settings[id].direction||data.settings[id].direction==='both'||data.settings[id].direction===dir);
  const sources=new Set(availableIds),members=new Set(availableIds.flatMap(id=>(data.settings[id]?.members||[]).map(member=>member.wordId)));
  const pending=new Map();
  for(const deck of decks){
   if(dir&&deck.direction&&deck.direction!=='both'&&deck.direction!==dir)continue;
   for(const member of deckMembers(data,deck)){
    if(!histories.has(member.wordId))continue;
    const review=latest.get(dir).get(member.wordId);
    const unfinished=!review||review.at<=member.addedAt||review.grade!=='full';
    pending.set(member.wordId,Boolean(pending.get(member.wordId)||unfinished));
   }
  }
  for(const word of words){
   if(dir&&!sources.has(word.collectionId)&&!members.has(word.id))continue;
   const secure=pending.has(word.id)?!pending.get(word.id):progressFor(word.id,histories.get(word.id),dir).level==='known';
   if(secure)known++;else learning++;
  }
 }
 return {learning,known,total:learning+known};
}
