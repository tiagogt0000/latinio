import {wordsForDecks,selectedDeckPending} from './refresh-decks.js';
import {collectionActive} from './collection-learning.js';
export const uid = () => globalThis.crypto.randomUUID();
export const clone = value => structuredClone(value);
export const emptyData = () => ({collections:{}, words:{}, reviews:{}, sessions:{}, settings:{}});
export function applyOps(data, ops) {
  const next = clone(data);
  for (const op of ops) {
    if (!Object.hasOwn(next, op.entity) || ['__proto__','constructor','prototype'].includes(op.key)) throw Error('Ungültige Änderung.');
    if (op.value === null) delete next[op.entity][op.key];
    else next[op.entity][op.key] = clone(op.value);
  }
  return next;
}
export function normalize(text) {
  return String(text).normalize('NFC').toLocaleLowerCase('de').trim().replace(/ß/g,'ss').replace(/\s+/g,' ');
}
export function variants(text) {
  let list = [String(text).trim()];
  for (let count=0; count<8 && list.some(t=>/\([^()]*\)/.test(t)); count++) {
    list = list.flatMap(t => {const m=t.match(/\(([^()]*)\)/); return !m?[t]:[t.replace(m[0],m[1]),t.replace(m[0],'')];});
  }
  return [...new Set(list.map(normalize))];
}
export function distance(a,b) {
  const d = Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)d[i][0]=i;
  for(let j=0;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++) {
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
export function evaluate(word, answers, allowTypos=true, overrides={}) {
  const groups=word.meanings.map(g=>g.flatMap(variants));
  const seen=new Set();
  const rows=answers.map((answer,index)=>{
    const input=normalize(answer);
    if(!input)return {index,answer,kind:'empty',group:-1};
    let group=groups.findIndex(g=>g.includes(input));
    let kind=group>=0?'exact':'wrong';
    if(group<0&&allowTypos&&input.length>=5) {
      const candidates=groups.map((g,i)=>({i,dist:Math.min(...g.filter(v=>v.length>=5).map(v=>distance(input,v)))})).filter(g=>g.dist===1);
      if(candidates.length===1){group=candidates[0].i;kind='typo';}
    }
    const override=overrides[index];
    if(override==='wrong'){kind='wrong';group=-1;}
    if(Number.isInteger(override)&&override>=0&&override<groups.length){group=override;kind='manual';}
    if(group>=0){if(seen.has(group))kind='duplicate';seen.add(group);}
    return {index,answer,kind,group};
  });
  const missing=word.meanings.map((g,i)=>({label:g[0],i})).filter(g=>!seen.has(g.i));
  const wrong=rows.some(r=>r.kind==='wrong');
  return {rows,missing,grade:wrong||!seen.size?'wrong':missing.length?'partial':'full'};
}
export function evaluateSession(word,answers,allowTypos=true,overrides={},session={}) {
  const result=evaluate(word,answers,allowTypos,overrides);
  const any=session.mode==='inactive-check'&&session.meaningRequirement==='any';
  if(any&&result.rows.some(row=>row.group>=0))result.grade='full';
  return {...result,meaningRequirement:any?'any':'all'};
}
export function progressFor(wordId, reviews) {
  const events=Object.values(reviews).filter(r=>r.wordId===wordId).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  let streak=0,due=0,lastReviewedAt=0,level='new';
  for(const r of events){
    if(r.repeat)continue;
    lastReviewedAt=r.at;
    if(r.grade==='full'){streak=r.manualKnown||r.mode?.startsWith('inactive-')?Math.max(3,streak+1):streak+1;due=r.at+Math.min(90,[1,3,7,14,30,60,90][Math.min(streak-1,6)])*86400000;level=streak>=3?'known':'learning';}
    else {streak=0;due=r.at+(r.grade==='partial'?1:.5)*86400000;level='learning';}
  }
  return {streak,due,level,seen:events.length,lastReviewedAt};
}
export function chooseWords(data, collectionIds, limit=10, mode='smart', now=Date.now()) {
  const words=wordsForDecks(data,collectionIds);
  const shuffled=words.map(w=>{const p=progressFor(w.id,data.reviews),deckPending=selectedDeckPending(data,w.id,collectionIds);return {w,p,level:deckPending===null?p.level:deckPending?'learning':'known',random:Math.random()};});
  if(mode==='all')return shuffled.sort((a,b)=>a.random-b.random).map(x=>x.w.id);
  const oldest=(a,b)=>a.p.lastReviewedAt-b.p.lastReviewedAt||a.p.due-b.p.due||a.random-b.random;
  if(mode==='learning')return shuffled.filter(x=>x.level!=='known').sort(oldest).slice(0,limit).map(x=>x.w.id);
  if(mode==='refresh')return shuffled.filter(x=>x.level==='known').sort(oldest).slice(0,limit).map(x=>x.w.id);
  // Unlimited rounds: due learning words, unseen words, then the least recently practiced.
  const count=Math.max(0,Math.floor(limit));
  const learning=shuffled.filter(x=>x.level!=='known').sort((a,b)=>{
    const rank=x=>!x.p.seen?1:x.p.due<=now?0:2;
    return rank(a)-rank(b)||oldest(a,b);
  });
  const known=shuffled.filter(x=>x.level==='known').sort((a,b)=>{
    const rank=x=>x.p.due<=now?0:1;
    return rank(a)-rank(b)||oldest(a,b);
  });
  // Reserve about one fifth for spaced refreshers; don't force a just-reviewed secure word.
  const refreshers=known.filter(x=>x.p.due<=now||now-x.p.lastReviewedAt>=3*86400000);
  const quota=learning.length?Math.min(Math.floor(count/5),refreshers.length):0;
  const chosen=learning.slice(0,count-quota);
  chosen.push(...refreshers.slice(0,Math.min(quota,count-chosen.length)));
  // Small or fully mastered decks still support another round, rotating oldest words first.
  for(const item of [...learning,...known]){
    if(chosen.length>=count)break;
    if(!chosen.includes(item))chosen.push(item);
  }
  return chosen.sort((a,b)=>a.random-b.random).map(x=>x.w.id);
}
export function rebase(shadow, remoteOps, pending, choices={}) {
  const acknowledged=new Set(remoteOps.map(o=>o.id));
  const remaining=pending.filter(o=>!acknowledged.has(o.id)&&!(o.bootstrap&&(remoteOps.length||Object.keys(shadow.collections).length)));
  const latestRemote=new Map(remoteOps.map(o=>[o.entity+':'+o.key,o]));
  const conflicts=[];
  for(const op of remaining){
    const key=op.entity+':'+op.key, other=latestRemote.get(key);
    if(other&&other.device!==op.device&&JSON.stringify(other.value)!==JSON.stringify(op.value)&&!conflicts.some(c=>c.key===key))conflicts.push({key,local:op,remote:other});
  }
  const kept=remaining.filter(o=>choices[o.entity+':'+o.key]!=='cloud');
  return {shadow:clone(shadow),pending:kept,conflicts:conflicts.filter(c=>!choices[c.key]),data:applyOps(shadow,kept)};
}
export function parseImport(input, existing) {
  if(!input||input.format!=='latinio-collection'||input.schema!==1||!Array.isArray(input.words)||!input.name?.trim())throw Error('Bitte eine Latinio-Sammlung im JSON-Format auswählen.');
  if(input.words.length>5000)throw Error('Bitte höchstens 5.000 Vokabeln auf einmal importieren.');
  const collectionId=input.id||uid();
  if(typeof collectionId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(collectionId))throw Error('Ungültige Sammlungskennung.');
  if(existing.collections[collectionId])throw Error('Diese Sammlung ist bereits vorhanden. Bearbeite sie in „Sammlungen“, statt sie doppelt zu importieren.');
  let skipped=0;const seen=new Set();const words=[];
  for(const item of input.words){
    if(typeof item.latin!=='string'||!item.latin.trim()||!Array.isArray(item.meanings)||!item.meanings.length||item.meanings.some(g=>!Array.isArray(g)||!g.length||g.some(s=>typeof s!=='string'||!s.trim()||s.length>300)))throw Error('Ein Eintrag braucht ein lateinisches Wort und mindestens eine deutsche Bedeutung.');
    if(item.forms!==undefined&&(!Array.isArray(item.forms)||item.forms.length>300||item.forms.some(f=>typeof f!=='string'||!f.trim()||f.length>100)))throw Error('Suchformen müssen eine Liste mit höchstens 300 kurzen Texten sein.');
    const key=normalize(item.latin);
    if(seen.has(key)){skipped++;continue;}seen.add(key);
    words.push({id:uid(),collectionId,latin:item.latin.trim().slice(0,200),meanings:item.meanings,...(item.forms?{forms:[...new Set(item.forms.map(f=>f.trim()))]}:{})});
  }
  return {collection:{id:collectionId,name:input.name.trim().slice(0,100)},words,skipped};
}
