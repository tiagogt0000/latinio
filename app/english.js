import {progressFor} from './core.js';
import {wordsForDecks,selectedDeckPending} from './refresh-decks.js';

export const DIRECTIONS=['en-de','de-en'];
export function directionsFor(value='mixed'){
  return DIRECTIONS.includes(value)?[value]:DIRECTIONS;
}
export function englishTasks(data,ids,mode='smart',limit=10,direction='mixed',now=Date.now()){
  const tasks=wordsForDecks(data,ids).flatMap(word=>directionsFor(direction).filter(dir=>{
    const selected=ids.filter(id=>data.settings[id]?.kind!=='refreshDeck'||!data.settings[id]?.direction||data.settings[id].direction==='both'||data.settings[id].direction===dir);
    return selected.some(id=>id===word.collectionId||data.settings[id]?.members?.some(m=>m.wordId===word.id));
  }).map(dir=>{
    const p=progressFor(word.id,data.reviews,dir),pending=selectedDeckPending(data,word.id,ids,dir);
    return {wordId:word.id,direction:dir,p,level:pending===null?p.level:pending?'learning':'known',random:Math.random()};
  }));
  const oldest=(a,b)=>a.p.lastReviewedAt-b.p.lastReviewedAt||a.p.due-b.p.due||a.random-b.random;
  if(mode==='all')return tasks.sort((a,b)=>a.random-b.random).map(({wordId,direction})=>({wordId,direction}));
  if(mode==='learning'||mode==='refresh')return tasks.filter(x=>mode==='learning'?x.level!=='known':x.level==='known').sort(oldest).slice(0,limit).map(({wordId,direction})=>({wordId,direction}));
  const rank=x=>x.level!=='known'?(x.p.seen&&x.p.due<=now?0:!x.p.seen?1:2):(x.p.due<=now?3:4);
  return tasks.sort((a,b)=>rank(a)-rank(b)||oldest(a,b)).slice(0,limit).map(({wordId,direction})=>({wordId,direction}));
}
export function answerWord(word,direction){return direction==='de-en'?{...word,meanings:[[word.latin]]}:word;}
export function promptFor(word,direction){return direction==='de-en'?word.meanings.map(g=>g.join(' / ')).join(' · '):word.latin;}
export function englishImport(input){
 if(!input||!Array.isArray(input.words))return input;
 return {...input,words:input.words.map(item=>{
  const meanings=item.meanings??(Array.isArray(item.german)?item.german:typeof item.german==='string'?[item.german]:null);
  return {...item,latin:item.latin??item.english,meanings:meanings?.map(group=>Array.isArray(group)?group:[group])};
 })};
}
