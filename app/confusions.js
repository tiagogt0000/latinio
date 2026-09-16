import {normalize,variants,uid} from './core.js';
export function pairId(a,b){
  let hash=14695981039346656037n;
  for(const c of JSON.stringify([a,b].sort()))hash=BigInt.asUintN(64,(hash^BigInt(c.codePointAt(0)))*1099511628211n);
  return 'confusion_'+hash.toString(16);
}
export function pairs(data){return Object.values(data.settings).filter(p=>p?.kind==='confusion'&&p.wordIds?.length===2&&p.wordIds.every(id=>data.words[id]&&data.collections[data.words[id].collectionId]));}
export function suggestions(word,feedback,data){
  const found=new Map();
  for(const row of feedback.rows.filter(r=>r.kind==='wrong'))for(const other of Object.values(data.words)){
    if(other.id===word.id||!data.collections[other.collectionId]||data.settings[pairId(word.id,other.id)])continue;
    if(other.meanings.some(group=>group.some(value=>variants(value).includes(normalize(row.answer)))))found.set(other.id,{word:other,answer:row.answer});
  }
  return [...found.values()];
}
export function pairDue(pair,data){
  const events=Object.values(data.settings).filter(x=>x?.kind==='confusionReview'&&x.pairId===pair.id&&x.at>=pair.createdAt).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  let streak=0,due=0;
  for(const e of events){streak=e.correct?streak+1:0;due=e.at+(e.correct?[1,3,7,14,30][Math.min(streak-1,4)]:.5)*86400000;}
  return due;
}
export function makeRound(data,wordIds=null,force=false,now=Date.now()){
  const candidates=pairs(data).filter(p=>(!wordIds||p.wordIds.some(id=>wordIds.includes(id)))&&(force||pairDue(p,data)<=now)).sort((a,b)=>pairDue(a,data)-pairDue(b,data)||a.id.localeCompare(b.id));
  const ids=new Set(),chosen=[];
  for(const p of candidates){if(new Set([...ids,...p.wordIds]).size>4)continue;p.wordIds.forEach(id=>ids.add(id));chosen.push(p.id);}
  if(!chosen.length)return null;
  const words=[...ids].map(id=>structuredClone(data.words[id]));
  const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  return {id:uid(),pairIds:chosen,words,left:shuffle([...ids]),right:shuffle([...ids]),doneLeft:[],doneRight:[],selected:null,errors:0,message:'Wähle ein lateinisches Wort und danach seine deutschen Bedeutungen.',returnScreen:'collections'};
}
export function matchRound(round,rightId){
  const r=structuredClone(round),left=r.words.find(w=>w.id===r.selected),right=r.words.find(w=>w.id===rightId);
  if(!left||!right||r.doneLeft.includes(left.id)||r.doneRight.includes(right.id))return r;
  // Identical meaning sets are interchangeable, never an artificial error.
  const signature=w=>JSON.stringify(w.meanings.map(g=>g.flatMap(variants).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  const correct=left.id===right.id||signature(left)===signature(right);
  if(correct){r.doneLeft.push(left.id);r.doneRight.push(right.id);r.message='Richtig zugeordnet!';r.bad=null;}
  else{r.errors++;r.message='Noch nicht richtig. Vergleiche die Wörter und versuche es erneut.';r.bad={left:left.id,right:right.id};}
  r.selected=null;return r;
}
