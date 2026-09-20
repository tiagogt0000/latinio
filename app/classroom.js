import {formMatch} from './morphology.js';
import {normalize} from './core.js';
const key=s=>normalize(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.,;:!?()[\]«»„“"']/g,' ').replace(/\s+/g,' ').trim();
export function lookupWords(data,query){
 const q=key(query);if(!q)return [];
 const terms=q.split(' ');
 return Object.values(data.words).filter(w=>data.collections[w.collectionId]).map(word=>{
  const latin=key(word.latin),german=key(word.meanings.flat().join(' '));
  const forms=latin.split(' ');
  const match=formMatch(word,q);
  const rank=latin===q||forms.includes(q)||match==='stored'?0:match==='inferred'?5:latin.startsWith(q)?1:latin.includes(q)?2:german.includes(q)?3:terms.every(t=>(latin+' '+german).includes(t))?4:99;
  return {word,rank};
 }).filter(x=>x.rank<99).sort((a,b)=>a.rank-b.rank||a.word.latin.localeCompare(b.word.latin,'la')).map(x=>x.word);
}
export function classroomView(data,query,h){return `<div class="page-heading"><div><div class="eyebrow">SCHNELL NACHSCHLAGEN</div><h1>Unterricht</h1><p class="muted"></p></div></div><section class="card"><label for="classroom-search">Lateinisches Wort oder deutsche Bedeutung</label><input id="classroom-search" type="search" value="${h(query)}" placeholder="Zum Beispiel vox, vocis oder Stimme" autocomplete="off" autocapitalize="none" spellcheck="false" style="width:100%;margin-top:12px"><p class="small muted">Alle Lektionen · auch offline.</p></section><section id="classroom-results" class="lookup-results" aria-live="polite">${classroomResults(data,query,h)}</section>`;}
export function classroomResults(data,query,h){
 if(!query.trim())return '<p class="muted">Wort eingeben.</p>';
 const words=lookupWords(data,query);
 if(!words.length)return '<p class="muted">Kein Treffer. Versuche die Grundform oder einen kürzeren Wortteil.</p>';
 return `<p class="small muted">${words.length} Treffer${words.length>80?' · die ersten 80 werden angezeigt':''}</p>`+words.slice(0,80).map(w=>`<article class="card lookup-word"><h2 lang="la">${h(w.latin)}</h2>${formMatch(w,query)==='inferred'&&!key(w.latin).split(' ').includes(key(query))?'<span class="tag">Mögliche gebeugte Form · Grundbedeutungen</span>':''}<p>${w.meanings.map(g=>h(g.join(' / '))).join(', ')}</p><small class="muted">${h(data.collections[w.collectionId].name)}</small></article>`).join('');
}
