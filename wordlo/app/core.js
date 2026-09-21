export const uid = () => crypto.randomUUID();
export const VERSION = '1.0.0';
export const entities = ['collections','words','reviews','decks','settings'];
export const emptyData = () => Object.fromEntries(entities.map(k=>[k,{}]));
export const clone = value => structuredClone(value);
export const safeId = value => typeof value==='string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
export function applyOps(data, ops) {
  const next=clone(data);
  for(const op of ops){if(!entities.includes(op.entity)||!safeId(op.key))throw Error('Ungültige Änderung.'); if(op.value===null)delete next[op.entity][op.key];else next[op.entity][op.key]=clone(op.value);}
  return next;
}
export function normalize(text, language='de') {
  const value=String(text).normalize('NFC').trim().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
  return language==='de'?value.toLocaleLowerCase('de').replace(/ß/g,'ss'):value;
}
export function distance(a,b) {
  const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
  }return d[a.length][b.length];
}
export const targetGroups=(word,direction)=>direction==='de-en'?word.english:word.german;
export function evaluate(word, answers, direction, requirement='any', overrides={}) {
  const language=direction==='de-en'?'en':'de',groups=targetGroups(word,direction);
  const canonical=groups.map(g=>g.answers.map(a=>normalize(a,language)));
  const seen=new Set();
  const rows=answers.map((answer,index)=>{
    const input=normalize(answer,language);let group=-1,kind=input?'wrong':'empty',intended=null;
    if(input){group=canonical.findIndex(g=>g.includes(input));if(group>=0)kind='exact';
      if(group<0){
        const candidates=canonical.map((g,i)=>({i,dist:Math.min(...g.map(v=>distance(input,v)))})).filter(x=>x.dist===1 && (language==='en'||input.length>=5));
        if(candidates.length===1){intended=groups[candidates[0].i].id;if(language==='de'){group=candidates[0].i;kind='typo';}else kind='spelling';}
      }
      if(language==='de' && overrides[index]==='wrong'){group=-1;kind='wrong';}
      else if(language==='de' && groups.some(g=>g.id===overrides[index])){group=groups.findIndex(g=>g.id===overrides[index]);kind='manual';}
    }
    const groupId=group>=0?groups[group].id:null;
    if(groupId){if(seen.has(groupId))kind='duplicate';seen.add(groupId);}
    return {answer,index,kind,groupId,intended};
  });
  const missing=groups.filter(g=>!seen.has(g.id)).map(g=>g.id);
  const hasWrong=rows.some(r=>['wrong','spelling'].includes(r.kind));
  const grade=!seen.size?'wrong':requirement==='any'?'full':hasWrong?'wrong':missing.length?'partial':'full';
  return {grade,rows,matched:[...seen],missing,direction,requirement,hasWrong};
}
export function regionQuestions(word,result) {
  if(result.direction!=='de-en'||result.grade!=='full')return [];
  return word.english.filter(g=>g.region && result.matched.includes(g.id)).map(g=>({id:g.id,answer:result.rows.find(r=>r.groupId===g.id)?.answer||g.answers[0],region:g.region}));
}
export function checkRegions(questions,answers){return questions.map(q=>({id:q.id,expected:q.region,answer:answers[q.id]||'',correct:answers[q.id]===q.region}));}
export function progressFor(word,reviews,direction,requirement='any',now=Date.now()) {
  const groups=targetGroups(word,direction),counts=Object.fromEntries(groups.map(g=>[g.id,0]));
  const events=Object.values(reviews).filter(r=>r.wordId===word.id && r.direction===direction && !r.repeat).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  let errors=0,spellingErrors=0,partial=0,last=0,lastGrade='new',due=0,regionErrors=0,regionLast=null;
  const groupStats=Object.fromEntries(groups.map(g=>[g.id,{correct:0,missed:0}]));
  for(const r of events){
    const matched=new Set(r.result?.matched||[]);last=r.at;
    for(const g of groups){if(matched.has(g.id)){counts[g.id]++;groupStats[g.id].correct++;}else if(r.requirement==='all'||r.result?.grade==='wrong'){counts[g.id]=0;groupStats[g.id].missed++;}}
    if(r.result?.grade==='wrong')errors++;if(r.result?.grade==='partial')partial++;
    spellingErrors+=(r.result?.rows||[]).filter(x=>x.kind==='spelling').length;
    if(r.regionPending)regionLast=false;
    else if(r.regions?.length){regionLast=r.regions.every(x=>x.correct);if(!regionLast)regionErrors++;}
    const count=groups.filter(g=>matched.has(g.id)).length;
    lastGrade=count && (requirement==='any'||count===groups.length) && !(requirement==='all'&&r.result?.hasWrong)?'full':count?'partial':'wrong';
    const strength=requirement==='all'?Math.min(...Object.values(counts)):Math.max(0,...Object.values(counts));
    due=r.at+(lastGrade==='full'?[1,3,7,14,30,60,90][Math.min(Math.max(strength-1,0),6)]:lastGrade==='partial'?1:.5)*86400000;
  }
  const strength=requirement==='all'?Math.min(...Object.values(counts)):Math.max(0,...Object.values(counts));
  return {level:!events.length?'new':strength>=3&&lastGrade==='full'&&regionLast!==false?'known':'learning',strength,seen:events.length,errors,spellingErrors,partial,last,lastGrade,due,overdue:due<=now,groupStats,regionErrors,regionLast};
}
export function memberDone(word,member,reviews,direction,requirement) {
  const dirs=direction==='mixed'?['de-en','en-de']:[direction];
  return dirs.every(dir=>{
    const latest=Object.values(reviews).filter(r=>r.wordId===word.id&&r.direction===dir&&!r.repeat&&r.at>member.addedAt).sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id))[0];
    if(!latest)return false;
    const count=targetGroups(word,dir).filter(g=>latest.result?.matched.includes(g.id)).length;
    return count>0&&(requirement==='any'||count===targetGroups(word,dir).length&&!latest.result?.hasWrong)&&!latest.regionPending&&(!latest.regions?.length||latest.regions.every(r=>r.correct));
  });
}
export function selectedWords(data,ids,{direction='mixed',requirement='any',includeDone=false,ignoreActive=false}={}){
  const wordIds=new Set();
  for(const id of ids){const c=data.collections[id];if(c&&(ignoreActive||c.active!==false))for(const w of Object.values(data.words))if(w.collectionId===id)wordIds.add(w.id);
    const deck=data.decks[id];if(deck&&(ignoreActive||deck.active!==false))for(const m of deck.members||[]){const w=data.words[m.wordId];if(w&&(includeDone||!memberDone(w,m,data.reviews,direction,requirement)))wordIds.add(w.id);}}
  return [...wordIds].map(id=>data.words[id]);
}
export function chooseDirection(word,reviews,requirement,random=Math.random){
  const a=progressFor(word,reviews,'de-en',requirement),b=progressFor(word,reviews,'en-de',requirement);
  const need=p=>!p.seen?6:1+(p.level==='known'?0:3)+Math.min(3,p.errors/(p.seen||1)*3)+(p.overdue?1:0);
  const chance=Math.max(.2,Math.min(.8,need(a)/(need(a)+need(b))));return random()<chance?'de-en':'en-de';
}
export function makeQueue(data,ids,{direction='mixed',requirement='any',mode='smart',limit=10,random=Math.random}={}) {
  const words=selectedWords(data,ids,{direction,requirement,includeDone:mode==='all'||mode==='check',ignoreActive:mode==='check'});
  const list=words.map(word=>{const dir=direction==='mixed'?chooseDirection(word,data.reviews,requirement,random):direction;return {word,dir,p:progressFor(word,data.reviews,dir,requirement),random:random()};});
  const filtered=list.filter(x=>mode==='learning'?x.p.level!=='known':mode==='refresh'?x.p.level==='known':true);
  const rank=p=>!p.seen?2:p.level==='known'?p.overdue?3:5:p.overdue?0:4;
  filtered.sort(mode==='all'||mode==='check'?(a,b)=>a.random-b.random:(a,b)=>rank(a.p)-rank(b.p)||b.p.errors/Math.max(1,b.p.seen)-a.p.errors/Math.max(1,a.p.seen)||a.p.last-b.p.last||a.random-b.random);
  let picked=mode==='all'||mode==='check'?filtered:filtered.slice(0,limit);
  if(mode==='smart'&&picked.length>=5){const safe=filtered.find(x=>x.p.level==='known'&&x.p.overdue&&!picked.includes(x));if(safe)picked[picked.length-1]=safe;}
  return picked.sort((a,b)=>a.random-b.random).map(x=>({wordId:x.word.id,direction:x.dir,repeat:false,promptIndex:Math.floor(random()*x.word.english.length)}));
}
export function cleanGroups(input,language){
  if(!Array.isArray(input)||!input.length||input.length>30)throw Error('Jede Sprache braucht mindestens eine und höchstens 30 Bedeutungen.');
  const ids=new Set();
  return input.map(item=>{
    const g=typeof item==='string'?{answers:[item]}:Array.isArray(item)?{answers:item}:item;
    if(!g||!Array.isArray(g.answers)||!g.answers.length||g.answers.length>20||g.answers.some(a=>typeof a!=='string'||!a.trim()||a.length>300))throw Error('Jede Bedeutung braucht mindestens eine gültige Antwort (max. 300 Zeichen).');
    if(g.region && (language!=='en'||!['UK','US'].includes(g.region)))throw Error('Sprachvariante muss UK oder US sein, nur bei Englisch.');
    const id=g.id||uid();if(!safeId(id)||ids.has(id))throw Error('Ungültige oder doppelte Bedeutungskennung.');ids.add(id);
    return {id,answers:[...new Set(g.answers.map(x=>x.trim()))],...(g.region?{region:g.region}:{})};
  });
}
export function cleanWord(item,collectionId=null){
  if(!item||typeof item!=='object')throw Error('Ungültiger Vokabeleintrag.');
  const id=item.id||uid();if(!safeId(id))throw Error('Ungültige Wortkennung.');
  const english=cleanGroups(item.english,'en'),german=cleanGroups(item.german,'de');
  const contexts={};for(const key of ['de','en']){if(item.context?.[key]!==undefined){if(typeof item.context[key]!=='string'||item.context[key].length>300)throw Error('Kontexthinweis zu lang.');contexts[key]=item.context[key].trim();}}
  return {id,collectionId,english,german,context:contexts};
}
export const fingerprint=word=>JSON.stringify([word.english.map(g=>[g.answers.map(a=>normalize(a,'en')).sort(),g.region||'']).sort(),word.german.map(g=>g.answers.map(a=>normalize(a)).sort()).sort(),word.context?.de||'',word.context?.en||'']);
export function parseImport(input,data,now=Date.now()){
  if(!input||!['wordlo-collection','wordlo-refresh'].includes(input.format)||input.schema!==1)throw Error('Bitte eine Wordlo-Sammlungsdatei oder Auffrisch-Datei (Schema 1) auswählen.');
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100)throw Error('Ein Sammlungsname mit höchstens 100 Zeichen fehlt.');
  if(!Array.isArray(input.words)||!input.words.length||input.words.length>5000)throw Error('Die Datei muss 1 bis 5.000 Einträge enthalten.');
  const refresh=input.format==='wordlo-refresh',id=input.id||uid();if(!safeId(id))throw Error('Ungültige Sammlungskennung.');
  if(data.collections[id]||data.decks[id])throw Error('Diese Sammlung wurde bereits importiert.');
  const words=[],members=[],seen=new Set();let linked=0,skipped=0;
  const byFingerprint=new Map();for(const w of Object.values(data.words)){const key=fingerprint(w);byFingerprint.set(key,[...(byFingerprint.get(key)||[]),w]);}
  for(const item of input.words){
    if(refresh&&item.wordId){if(!safeId(item.wordId)||!data.words[item.wordId])throw Error('Ein referenziertes Wort fehlt. Bitte den vollständigen Eintrag mit beiden Sprachen verwenden.');if(seen.has(item.wordId)){skipped++;continue;}seen.add(item.wordId);members.push({wordId:item.wordId,addedAt:now});linked++;continue;}
    let w=cleanWord(item,refresh?null:id),key=fingerprint(w);
    if(refresh){const matches=byFingerprint.get(key)||[];if(item.id&&data.words[item.id]){if(fingerprint(data.words[item.id])!==key)throw Error('Wortkennung und Inhalt stimmen nicht überein. Bitte den Eintrag prüfen.');w=data.words[item.id];linked++;}
      else if(matches.length===1){w=matches[0];linked++;}else if(matches.length>1)throw Error('Ein Wort passt zu mehreren vorhandenen Einträgen. Bitte in der Datei die eindeutige wordId angeben.');else{if(data.words[w.id]||words.some(x=>x.id===w.id))throw Error('Doppelte Wortkennung.');words.push(w);byFingerprint.set(key,[w]);}
      if(seen.has(w.id)){skipped++;continue;}seen.add(w.id);members.push({wordId:w.id,addedAt:now});
    }else{if(seen.has(key)){skipped++;continue;}if(data.words[w.id]||words.some(x=>x.id===w.id))throw Error('Diese Wortkennung existiert bereits.');seen.add(key);words.push(w);}
  }
  const collection=refresh?null:{id,name:input.name.trim(),active:true};
  const deck=refresh?{id,name:input.name.trim(),active:true,members}:null;
  return {type:refresh?'refresh':'collection',collection,deck,words,linked,skipped,count:refresh?members.length:words.length};
}
export function importChanges(candidate){return [...(candidate.collection?[['collections',candidate.collection.id,candidate.collection]]:[['decks',candidate.deck.id,candidate.deck]]),...candidate.words.map(w=>['words',w.id,w])];}
export function exportCollection(data,id){
  const deck=data.decks[id],collection=data.collections[id];if(!deck&&!collection)throw Error('Sammlung fehlt.');
  const words=deck?deck.members.map(m=>data.words[m.wordId]).filter(Boolean):Object.values(data.words).filter(w=>w.collectionId===id);
  return {format:deck?'wordlo-refresh':'wordlo-collection',schema:1,id,name:(deck||collection).name,words:words.map(w=>({id:w.id,english:w.english,german:w.german,context:w.context}))};
}
export function rebase(shadow,remoteOps,pending,choices={}){
  const acknowledged=new Set(remoteOps.map(o=>o.id)),remaining=pending.filter(o=>!acknowledged.has(o.id));
  const remote=new Map(remoteOps.map(o=>[o.entity+':'+o.key,o])),local=new Map(remaining.map(o=>[o.entity+':'+o.key,o]));
  const conflicts=[];for(const [key,op] of local){const other=remote.get(key);if(other&&other.device!==op.device&&JSON.stringify(other.value)!==JSON.stringify(op.value)&&!choices[key])conflicts.push({key,local:op,remote:other});}
  const kept=remaining.filter(o=>choices[o.entity+':'+o.key]!=='cloud');return {shadow:clone(shadow),pending:kept,conflicts,data:applyOps(shadow,kept)};
}
