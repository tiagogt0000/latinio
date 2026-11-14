import {evaluate, normalizeAnswer, optionalMeaningGroup, variants} from './core.js';
import {BOOK_CASES, CASE_QUESTIONS, endingCells, checkEnding} from './landscape-curriculum.js';
import {answerWord as englishAnswerWord, DIRECTIONS as ENGLISH_DIRECTIONS} from './english.js';

// The landscape has its own event-derived model. It never mutates classic reviews.
export const DAY = 86400000;
export const LANDSCAPE_SCHEMA = 1;
export const ROUND_KINDS = ['cards', 'write', 'quick', 'matching', 'sentence', 'mixed', 'grammar', 'case-match'];
// Transparent, adjustable heuristic; this is not a claim of calibrated memory
// probabilities. Stability is the number of days to predicted 90% recall.
export const LANDSCAPE_CONFIG = Object.freeze({targetRetention:0.90,independentRecallMs:20*3600000,initialStabilityDays:1,minStabilityDays:0.2,maxStabilityDays:180,initialDifficulty:5,lapseStabilityFactor:0.45,lapseDifficultyIncrease:1.2,englishSentenceEvery:8});
const copy = value => structuredClone(value);
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const clean = value => String(value ?? '').normalize('NFKC').trim();
const unique = values => [...new Set(values)];
const id = () => globalThis.crypto.randomUUID();
export function landscapeSubject(subject='latin') { if(!['latin','english'].includes(subject))throw Error('Dieses Fach hat noch keine Lernlandschaft.');return subject; }
export function emptyLandscape(subject='latin') { return {schema: LANDSCAPE_SCHEMA, subject:landscapeSubject(subject), events: [], rounds: {}, exams: {}, activeRoundId: null, inventory:{}, inventoryInitialized:false}; }
function taskDirection(subject,direction) { return subject==='english'?(ENGLISH_DIRECTIONS.includes(direction)?direction:'en-de'):'la-de'; }
function gradedWord(word,direction) { return direction==='de-en'?englishAnswerWord(word,direction):word; }
export function dayKey(at = Date.now(), timeZone = 'Europe/Berlin') {
  try { const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value])); return `${parts.year}-${parts.month}-${parts.day}`; }
  catch { return new Date(at).toISOString().slice(0, 10); }
}
export function seededShuffle(values, seed = '') {
  let n = 2166136261;
  for (const character of String(seed)) n = Math.imul(n ^ character.charCodeAt(0), 16777619);
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    const j = (n >>> 0) % (i + 1); [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function collectionWords(data, collectionId) {
  return Object.values(data?.words || {}).filter(word => word.collectionId === collectionId && !word.deleted && word.meanings?.length && word.latin);
}
function collectionsOf(data) {
  return Object.values(data?.collections || {}).filter(c => !c.deleted && !c.refreshSource && collectionWords(data, c.id).length);
}
export function updateInventory(state,data,now=Date.now()) {
  state.inventory ||= {};
  for(const collection of collectionsOf(data)) {
    const words=collectionWords(data,collection.id).map(word=>word.id), previous=state.inventory[collection.id];
    if(!previous)state.inventory[collection.id]={firstSeenAt:now,new:!!state.inventoryInitialized,wordIds:words};
    else {
      if(words.some(wordId=>!previous.wordIds.includes(wordId)))previous.new=true;
      previous.wordIds=words;
    }
  }
  state.inventoryInitialized=true;
  return state;
}
export function wordKey(wordId, meaningIndex, direction='la-de') { return ENGLISH_DIRECTIONS.includes(direction)?`word:${wordId}:${direction}:${meaningIndex}`:`word:${wordId}:${meaningIndex}`; }
function blankEvidence() { return {attempts:0, firstErrors:0, corrections:0, hints:0, stage:0, lastAt:0, lastIndependentAt:0, dueAt:0, confidence:0,stabilityDays:0,difficulty:LANDSCAPE_CONFIG.initialDifficulty}; }
export function predictedRecall(field,at=Date.now()) {
  if(!field?.lastIndependentAt || !field.stabilityDays)return 0;
  const elapsed=Math.max(0,(at-field.lastIndependentAt)/DAY);
  return Math.exp(Math.log(0.9)*elapsed/field.stabilityDays);
}

// Import only evidence we can interpret. Unknown legacy modes are recognition,
// not proof that every meaning was independently recalled.
function legacyEvents(data,subject) {
  return Object.values(data?.reviews || {}).filter(r => data.words?.[r.wordId] && (subject==='english'?ENGLISH_DIRECTIONS.includes(r.direction):!r.direction || ['la-de','latin-de','latin-german'].includes(r.direction)))
    .map(r => ({id:`legacy:${r.id}`, at:finite(r.at), roundId:`legacy:${r.sessionId || r.id}`, taskId:r.wordId,
      subject,direction:taskDirection(subject,r.direction),
      modality:r.meaningRequirement === 'all' ? 'write' : 'legacy', retry:!!r.repeat,
      correct:r.grade === 'full', hinted:false, wordId:r.wordId,
      results:gradedWord(data.words[r.wordId],taskDirection(subject,r.direction)).meanings.map((_, i) => ({key:wordKey(r.wordId, i,taskDirection(subject,r.direction)), wordId:r.wordId, meaningIndex:i, correct:r.grade === 'full'}))}));
}
function evidenceWeight(event) {
  if (event.hinted) return 0.12;
  return {write:1, grammar:1, quick:0.85, sentence:0.55, 'case-match':0.25, matching:0.25, cards:0.18, legacy:0.18}[event.modality] || 0.15;
}
function effectiveEvents(allEvents) {
  const corrections=new Map();
  for(const event of [...allEvents].sort((a,b)=>finite(a.correctionRevision)-finite(b.correctionRevision) || finite(a.at)-finite(b.at) || String(a.id).localeCompare(String(b.id))))if(event.corrects)corrections.set(event.corrects,event);
  const byId=new Map(allEvents.map(event=>[event.id,event]));
  return allEvents.filter(event=>!corrections.has(event.id) && (!event.corrects || corrections.get(event.corrects)?.id===event.id))
    .map(event=>event.corrects && byId.has(event.corrects)?{...event,at:byId.get(event.corrects).at}:event)
    .sort((a,b) => finite(a.at)-finite(b.at) || String(a.id).localeCompare(String(b.id)));
}
export function learningModel({data = {}, state = emptyLandscape(), now = Date.now(), subject=state.subject || 'latin'} = {}) {
  landscapeSubject(subject);
  const fields = {}, words = {}, directionWords={}, sentences = {}, seen = new Set();
  const allEvents=[...legacyEvents(data,subject), ...(state.events || [])].filter(event=>(event.subject || 'latin')===subject);
  const events=effectiveEvents(allEvents);
  for (const event of events) {
    if (!event?.id || seen.has(event.id)) continue;
    seen.add(event.id);
    const at = Math.min(finite(event.at), now), weight = evidenceWeight(event),direction=taskDirection(subject,event.direction);
    for (const result of event.results || []) {
      if (!result.key) continue;
      const field = fields[result.key] ||= blankEvidence();
      field.attempts++; field.lastAt = Math.max(field.lastAt, at);
      if (event.hinted) field.hints++;
      if (event.retry) { field.corrections += result.correct ? 1 : 0; continue; }
      if (!result.correct) {
        field.firstErrors++; field.stage = Math.max(0, field.stage - 1);
        field.difficulty=Math.min(10,field.difficulty+LANDSCAPE_CONFIG.lapseDifficultyIncrease);
        field.stabilityDays=Math.max(LANDSCAPE_CONFIG.minStabilityDays,field.stabilityDays*LANDSCAPE_CONFIG.lapseStabilityFactor);
        field.confidence = Math.max(0, field.confidence * 0.5); field.dueAt = at;
        continue;
      }
      if (weight < 0.8) {
        field.confidence = Math.max(field.confidence, Math.min(0.35, weight));
        continue;
      }
      // Multiple correct rounds seconds apart cannot inflate the spacing stage.
      if (!field.lastIndependentAt || at - field.lastIndependentAt >= LANDSCAPE_CONFIG.independentRecallMs) {
        const retention=predictedRecall(field,at);
        // Successful retrieval after more forgetting is stronger evidence, but
        // previous lapses keep the difficulty high and future intervals shorter.
        const growth=1+((11-field.difficulty)/10)*(1.1+1.7*(1-retention))*weight;
        const stability=field.lastIndependentAt?field.stabilityDays*growth:LANDSCAPE_CONFIG.initialStabilityDays*weight/(1+field.firstErrors*.25);
        field.stabilityDays=Math.min(LANDSCAPE_CONFIG.maxStabilityDays,Math.max(LANDSCAPE_CONFIG.minStabilityDays,stability));
        field.difficulty=Math.max(1,field.difficulty-(0.15+0.2*(1-retention))*weight);
        field.stage = Math.min(7, field.stage + 1);
        field.lastIndependentAt = at;
        const intervalDays=field.stabilityDays*Math.log(LANDSCAPE_CONFIG.targetRetention)/Math.log(0.9);
        field.dueAt = Math.round(at+intervalDays*DAY);
        field.confidence = Math.min(0.98, 0.35 + field.stage * 0.1);
      }
    }
    const eventWordIds = unique([event.wordId, ...(event.results || []).map(r=>r.wordId)].filter(Boolean));
    for (const wordId of eventWordIds) {
      const word = directionWords[`${wordId}:${direction}`] ||= {direction,seen:false,lastAt:0,lastErrorAt:0,lastWrittenAt:0,attempts:0};
      word.seen = true; word.lastAt = Math.max(word.lastAt,at); word.attempts++;
      const own = (event.results || []).filter(r=>r.wordId === wordId);
      if (!event.retry && (own.some(r=>!r.correct) || event.wordId===wordId && !event.correct)) word.lastErrorAt = Math.max(word.lastErrorAt,at);
      if (event.modality === 'write' && event.correct && !event.hinted && !event.retry) word.lastWrittenAt = Math.max(word.lastWrittenAt,at);
    }
    if (event.sentenceId) sentences[event.sentenceId] = Math.max(sentences[event.sentenceId] || 0, at);
  }
  for (const word of Object.values(data.words || {})) {
    const directions={};
    for(const direction of subject==='english'?ENGLISH_DIRECTIONS:['la-de']){
      const status = directionWords[`${word.id}:${direction}`] ||= {direction,seen:false,lastAt:0,lastErrorAt:0,lastWrittenAt:0,attempts:0};
      status.meanings = gradedWord(word,direction).meanings.map((group,i)=>({...fields[wordKey(word.id,i,direction)] || blankEvidence(), optional:optionalMeaningGroup(group),direction}));
      const required = status.meanings.filter(m=>!m.optional);
      status.confidence = required.length ? Math.min(...required.map(m=>m.confidence*(m.lastIndependentAt?predictedRecall(m,now):1))) : 0;
      status.predictedRetention=required.length?Math.min(...required.map(m=>predictedRecall(m,now))):0;
      status.dueAt = required.length ? Math.min(...required.map(m=>m.dueAt)) : 0;
      status.weak = required.some(m=>m.firstErrors && m.stage < 2) || status.confidence < 0.45;
      if(status.lastErrorAt>status.lastWrittenAt){status.weak=true;status.dueAt=Math.min(status.dueAt,status.lastErrorAt);}
      status.safe = !!required.length && required.every(m=>m.stage >= 2) && status.predictedRetention>=0.75;
      directions[direction]=status;
    }
    const statuses=Object.values(directions);
    words[word.id]={directions,seen:statuses.some(s=>s.seen),lastAt:Math.max(...statuses.map(s=>s.lastAt)),lastErrorAt:Math.max(...statuses.map(s=>s.lastErrorAt)),lastWrittenAt:Math.min(...statuses.map(s=>s.lastWrittenAt)),attempts:statuses.reduce((sum,s)=>sum+s.attempts,0),meanings:statuses.flatMap(s=>s.meanings),confidence:Math.min(...statuses.map(s=>s.confidence)),predictedRetention:Math.min(...statuses.map(s=>s.predictedRetention)),dueAt:Math.min(...statuses.map(s=>s.dueAt)),weak:statuses.some(s=>s.weak),safe:statuses.every(s=>s.safe)};
  }
  return {fields, words, sentences,subject};
}
export function chooseDirection(wordId,model,{direction='mixed',seed='',now=Date.now()}={}){
  if(model.subject!=='english')return 'la-de';
  if(ENGLISH_DIRECTIONS.includes(direction))return direction;
  const states=model.words[wordId]?.directions || {};
  const score=dir=>{const value=states[dir];return !value?10:(!value.seen?6:0)+(value.dueAt<=now?2:0)+(value.weak?2:0)+Math.min(3,Math.max(0,(now-(value.lastAt || now))/DAY)/7);};
  return seededShuffle(ENGLISH_DIRECTIONS,`${seed}:${wordId}`).sort((a,b)=>score(b)-score(a))[0];
}
function examPriority(exams, collectionId, now, timeZone) {
  const today = dayKey(now,timeZone), date = new Date(`${today}T12:00:00Z`).getTime();
  return Math.max(0, ...Object.values(exams || {}).filter(e=>!e.deleted && !e.endedAt && e.collectionIds?.includes(collectionId) && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && e.date >= today)
    .map(e=>Math.max(1, 5 - Math.floor((new Date(`${e.date}T12:00:00Z`).getTime()-date)/DAY/7))));
}
function grammarCase(model,now=Date.now()) {
  const due=BOOK_CASES.map(c=>({id:c.id,fields:endingCells(c.id).filter(cell=>cell.editable!==false).map(cell=>model.fields[cell.id])}))
    .filter(c=>c.fields.every(f=>f?.stage>=2) && c.fields.some(f=>f.dueAt<=now))
    .sort((a,b)=>Math.min(...a.fields.map(f=>f.dueAt))-Math.min(...b.fields.map(f=>f.dueAt)));
  if(due.length)return due[0].id;
  for (const c of BOOK_CASES) {
    const fields = endingCells(c.id).filter(cell=>cell.editable !== false);
    if (fields.some(cell=>(model.fields[cell.id]?.stage || 0)<2)) return c.id;
  }
  return [...BOOK_CASES].sort((a,b)=>Math.min(...endingCells(a.id).filter(c=>c.editable!==false).map(c=>model.fields[c.id]?.dueAt || 0))-Math.min(...endingCells(b.id).filter(c=>c.editable!==false).map(c=>model.fields[c.id]?.dueAt || 0)))[0]?.id || 'nom';
}
export function planNext({data = {}, state = emptyLandscape(), now = Date.now(), timeZone = 'Europe/Berlin', ignoreActive = false,subject=state.subject || 'latin'} = {}) {
  landscapeSubject(subject);
  const active = state.rounds?.[state.activeRoundId];
  if (!ignoreActive && active && (active.subject || 'latin')===subject && active.phase !== 'complete') return {kind:'resume',roundId:active.id,label:active.label,reason:'Hier hast du aufgehört.',estimatedCount:active.originalCount};
  const model = learningModel({data,state,now,subject}), today = dayKey(now,timeZone);
  const rounds = Object.values(state.rounds || {}).filter(r=>(r.subject || 'latin')===subject), finished = rounds.filter(r=>r.phase==='complete').sort((a,b)=>(b.completedAt || b.updatedAt)-(a.completedAt || a.updatedAt));
  const studiedToday = finished.some(r=>dayKey(r.completedAt || r.updatedAt,timeZone)===today);
  const grammarToday = rounds.some(r=>['grammar','case-match'].includes(r.kind) && dayKey(r.createdAt,timeZone)===today);
  if (subject==='latin' && studiedToday && !grammarToday) {
    const learnedCases=BOOK_CASES.filter(c=>endingCells(c.id).some(cell=>model.fields[cell.id]?.attempts));
    const grammarHistory=finished.filter(r=>['grammar','case-match'].includes(r.kind));
    const questions=learnedCases.length>=2 && grammarHistory[0]?.kind!=='case-match' && grammarHistory.length%3===2;
    return {kind:questions?'case-match':'grammar',caseId:grammarCase(model,now),label:questions?'Kasus und Fragen':'Endungen festigen',reason:'Deine kurze Grammatikrunde für heute.',estimatedCount:questions?learnedCases.length:8};
  }
  const vocabularyHistory=finished.filter(r=>r.collectionIds?.length && !['grammar','case-match'].includes(r.kind));
  const latestVocabulary=vocabularyHistory[0];
  // Finish the introduction of one collection before opening another. A daily
  // grammar task may be interleaved without losing this chain.
  if(latestVocabulary && ['cards','matching'].includes(latestVocabulary.kind)) {
    const collectionId=latestVocabulary.collectionIds[0], words=collectionWords(data,collectionId);
    if(words.length)return {kind:latestVocabulary.kind==='cards' && words.length>=3?'matching':'write',collectionId,label:data.collections[collectionId]?.name || 'Neue Wörter festigen',reason:latestVocabulary.kind==='cards'?'Festige diese Wörter zunächst durch Zuordnen.':'Schreibe jetzt die Bedeutungen dieser Sammlung selbstständig.',wordIds:words.map(w=>w.id),estimatedCount:words.length};
  }
  const currentEvents=effectiveEvents((state.events || []).filter(e=>(e.subject || 'latin')===subject));
  const failureWords=round=>unique(currentEvents.filter(e=>e.roundId===round?.id && !e.retry && !e.correct).flatMap(e=>[e.wordId,...(e.results || []).filter(r=>!r.correct).map(r=>r.wordId)]).filter(wordId=>wordId && data.words?.[wordId]?.collectionId===round.collectionIds?.[0]));
  const recentFailures=failureWords(latestVocabulary);
  if(latestVocabulary?.kind==='write') {
    const collectionId=latestVocabulary.collectionIds[0], words=collectionWords(data,collectionId);
    if(words.length && recentFailures.length>Math.max(2,words.length*.15))return {kind:subject==='english'?'quick':'mixed',collectionId,label:data.collections[collectionId]?.name || 'Fehler festigen',reason:subject==='english'?'Rufe deine unsicheren Wörter noch einmal selbstständig ab.':'Übe deine Fehlerwörter und wende sie in Sätzen an.',wordIds:subject==='english'?recentFailures:words.map(w=>w.id),estimatedCount:subject==='english'?recentFailures.length:Math.min(16,recentFailures.length+6)};
  }
  const ranked = seededShuffle(collectionsOf(data),`${today}:${finished.length}`).map(collection=>{
    const words = collectionWords(data,collection.id), statuses=words.map(w=>model.words[w.id]);
    const unknown=statuses.filter(w=>!w.seen).length, weak=statuses.filter(w=>w.weak).length, due=statuses.filter(w=>w.dueAt<=now).length;
    const overdue=statuses.reduce((sum,w)=>sum+Math.min(30,Math.max(0,(now-(w.dueAt || now))/DAY)),0)/words.length;
    const recent=finished.slice(0,2).filter(r=>r.collectionIds?.includes(collection.id)).length;
    const justAudited=latestVocabulary?.kind==='write' && latestVocabulary.collectionIds[0]===collection.id && recentFailures.length<=2;
    const newlyAdded=state.inventory?.[collection.id]?.new || state.inventoryInitialized && !state.inventory?.[collection.id];
    const score=unknown/words.length*3 + weak/words.length*4 + due/words.length*2 + overdue/10 + (newlyAdded && unknown?4:0) + examPriority(state.exams,collection.id,now,timeZone)*2 - recent*2.5 - (justAudited?8:0);
    return {collection,words,statuses,unknown,weak,due,score};
  }).sort((a,b)=>b.score-a.score);
  if (!ranked.length) return subject==='english'?{kind:'write',label:'Englische Wörter hinzufügen',reason:'Füge zuerst eine englische Vokabelsammlung hinzu.',estimatedCount:0,unavailable:true}:{kind:'grammar',caseId:grammarCase(model,now),label:'Endungen kennenlernen',reason:'Grammatik kannst du auch ohne Vokabelsammlung üben.',estimatedCount:8};
  const selected=ranked[0], collectionId=selected.collection.id;
  const history=finished.filter(r=>r.collectionIds?.[0]===collectionId), latest=history[0];
  let kind='write', reason='Prüfe selbstständig alle Bedeutungen dieser Sammlung.';
  const isNew=state.inventory?.[collectionId]?.new || state.inventoryInitialized && !state.inventory?.[collectionId];
  if (selected.unknown>0 && (isNew || !latest && !state.inventoryInitialized)) {kind='cards';reason='Lerne die neuen Wörter zuerst in Ruhe kennen.';}
  else if (latest?.kind==='cards' && selected.words.length>=3) {kind='matching';reason='Festige die neuen Wörter durch Zuordnen.';}
  else if (latest?.kind==='write' && failureWords(latest).length>Math.max(2,selected.words.length*.15)) {kind='mixed';reason='Verbinde deine Fehlerwörter mit passenden Satzaufgaben.';}
  else if (latest && selected.statuses.every(w=>w.safe)) {kind=latest.kind==='quick'?'sentence':'quick';reason='Frische weitgehend sichere Wörter kurz auf.';}
  else if (latest?.kind==='write') {kind='sentence';reason='Wende die Wörter im Zusammenhang an.';}
  if(subject==='english' && !['cards','matching'].includes(kind)){
    const sinceSentence=vocabularyHistory.findIndex(r=>['sentence','mixed'].includes(r.kind));
    const wordRounds=sinceSentence<0?vocabularyHistory.length:sinceSentence;
    if(wordRounds>=LANDSCAPE_CONFIG.englishSentenceEvery-1 && latest){kind='sentence';reason='Wende deine Wörter gelegentlich in einem englischen Satz an.';}
    else {kind=selected.statuses.every(w=>w.safe)?'quick':'write';reason=kind==='quick'?'Frische deine Wörter in beiden Richtungen auf.':'Schreibe die Wörter in der jeweils unsicheren Übersetzungsrichtung.';}
  }
  const carried=Object.values(data.words || {}).filter(w=>w.collectionId!==collectionId && model.words[w.id]?.lastErrorAt && model.words[w.id].weak && model.words[w.id].dueAt<=now)
    .sort((a,b)=>model.words[b.id].lastErrorAt-model.words[a.id].lastErrorAt).slice(0,3).map(w=>w.id);
  return {kind,collectionId,subject,direction:subject==='english'?'mixed':'la-de',label:selected.collection.name || 'Vokabelrunde',reason,wordIds:(kind==='cards' && isNew?selected.words.filter(w=>!model.words[w.id].seen):selected.words).map(w=>w.id),carryWordIds:carried,estimatedCount:selected.words.length};
}
export function recommendations(options = {}, limit = 5) {
  const next=planNext(options), data=options.data || {}, state=options.state || emptyLandscape();
  const subject=options.subject || state.subject || 'latin',out=next.unavailable?[]:[next];
  const others=collectionsOf(data).filter(c=>c.id!==next.collectionId).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  for (const c of seededShuffle(others, `${dayKey(options.now,options.timeZone)}:${Object.keys(state.rounds||{}).length}`)) {
    if(out.length>=limit)break;
    out.push({kind:'write',collectionId:c.id,label:c.name,reason:'Eine weitere Sammlung selbstständig auffrischen.',estimatedCount:collectionWords(data,c.id).length,preview:true});
  }
  if(subject==='latin' && out.length<limit)out.push({kind:'grammar',caseId:grammarCase(learningModel(options)),label:'Endungen üben',reason:'Eine freiwillige Grammatikrunde.',estimatedCount:8,preview:true});
  return out;
}

function answerParts(answer) {
  return (Array.isArray(answer)?answer:[answer]).map(clean);
}
export function evaluateWord(word, answers, {quick=false, allowTypos=true,direction='la-de',overrides={}} = {}) {
  const target=gradedWord(word,direction);
  const supplied=answerParts(answers), result=evaluate(target,supplied,direction==='de-en'?false:allowTypos,overrides);
  const required=target.meanings.map((g,i)=>optionalMeaningGroup(g)?null:i).filter(i=>i!==null);
  const missing=new Set(result.missing.map(x=>x.i));
  const matched=unique(result.rows.flatMap(row=>row.groups || (row.group>=0?[row.group]:[])));
  // Combined exact answers can represent several meaning groups in one field.
  if(result.rows.some(row=>['combined','partial-combined'].includes(row.kind))) {
    matched.splice(0,matched.length,...target.meanings.map((_,i)=>i).filter(i=>!missing.has(i)));
  }
  const invalid=result.rows.some(row=>row.kind==='wrong');
  const correct=quick ? matched.length>0 && !invalid : result.grade==='full';
  // An unsuccessful quick recall identifies a failed field only when there is
  // a single required group (including DE→EN). Otherwise keep the word-level
  // warning without pretending to know which of several meanings was forgotten.
  const checked=quick ? (matched.length?matched:required.length===1?required:[]) : unique([...required,...matched]);
  return {...result,grade:correct?'full':result.grade,meaningRequirement:quick?'any':'all',correct,matchedGroups:matched,results:checked.map(i=>({key:wordKey(word.id,i,direction),wordId:word.id,meaningIndex:i,correct:matched.includes(i)})),invalid};
}
function sentenceNorm(tokens) { return tokens.map(t=>clean(t).toLocaleLowerCase('de').replace(/[.!?,;:]+$/u,'')).filter(Boolean).join(' '); }
export function evaluateSentence(sentence, selected) {
  const value=sentenceNorm(Array.isArray(selected)?selected:[]);
  const correct=(sentence.translations || []).some(t=>sentenceNorm(t)===value);
  const bag=tokens=>tokens.map(t=>sentenceNorm([t])).sort().join('|');
  const sameWords=(sentence.translations || []).some(t=>bag(t)===bag(Array.isArray(selected)?selected:[]));
  return {correct,expected:sentence.translations?.[0] || [],errorType:correct?null:sameWords?'word-order':'meaning-or-form'};
}
function meaningLabels(word) { return word.meanings.flatMap(group=>group.flatMap(variants)).map(normalizeAnswer); }
export function matchingGroups(words, seed='') {
  const groups=[], unused=seededShuffle(words,seed);
  while(unused.length) {
    const group=[], labels=new Set();
    for(let i=0;i<unused.length && group.length<5;) {
      const word=unused[i], own=meaningLabels(word);
      if(group.length && own.some(s=>labels.has(s))) {i++;continue;}
      group.push(word); own.forEach(s=>labels.add(s)); unused.splice(i,1);
    }
    groups.push(group);
  }
  return groups;
}
function makeTask(roundId,index,kind,extra) { return {id:`${roundId}:t${index}`,kind,...copy(extra)}; }
export function buildRound({data = {}, state = emptyLandscape(), now=Date.now(), timeZone='Europe/Berlin', kind, collectionId, caseId, sentences=[], roundId=id(), wordIds, carryWordIds=[],subject=state.subject || 'latin',direction='mixed'} = {}) {
  landscapeSubject(subject);
  const suggestion=kind?{kind,collectionId,caseId,wordIds,carryWordIds}:planNext({data,state,now,timeZone,subject,ignoreActive:true});
  kind=suggestion.kind; collectionId=suggestion.collectionId; caseId=suggestion.caseId || caseId;
  if(!ROUND_KINDS.includes(kind))throw Error('Unbekannte Lernrunde.');
  if(subject==='english' && ['grammar','case-match'].includes(kind))throw Error('Lateinische Endungen gehören nicht zur englischen Lernlandschaft.');
  const model=learningModel({data,state,now,subject});
  let words=(suggestion.wordIds?.length?suggestion.wordIds.map(w=>data.words?.[w]).filter(Boolean):collectionWords(data,collectionId));
  const label=data.collections?.[collectionId]?.name || (kind==='case-match'?'Fälle verbinden':kind==='grammar'?'Endungen festigen':'Lernrunde');
  const round={id:roundId,subject,direction:subject==='english'?(ENGLISH_DIRECTIONS.includes(direction)?direction:'mixed'):'la-de',kind,label,collectionIds:collectionId?[collectionId]:[],createdAt:now,updatedAt:now,revision:0,phase:'task',tasks:[],blocks:[],blockIndex:0,queue:[],retryIds:[],retryCycle:0,attempts:{},completedTaskIds:[],originalCount:0,feedback:null,draft:{},paused:false};
  const add=(taskKind,extra)=>{
    const taskDir=extra.sentence?.direction || chooseDirection(extra.wordId || extra.words?.[0]?.id,model,{direction,seed:`${roundId}:${round.tasks.length}`,now});
    const t=makeTask(roundId,round.tasks.length,taskKind,{subject,direction:taskDir,...extra});round.tasks.push(t);return t.id;
  };
  if(kind==='grammar') {
    caseId=BOOK_CASES.some(c=>c.id===caseId)?caseId:grammarCase(model,now);
    const cells=endingCells(caseId), editable=cells.filter(c=>c.editable!==false).map(c=>c.id);
    const secure=editable.every(field=>(model.fields[field]?.stage || 0)>=1);
    round.caseId=caseId;
    if(!secure)add('grammar',{caseId,cells,hiddenIds:[],stage:'study'});
    if(!secure)for(let i=0;i<editable.length;i+=2)add('grammar',{caseId,cells,hiddenIds:editable.slice(i,i+2),stage:'pairs'});
    add('grammar',{caseId,cells,hiddenIds:editable,stage:'full'});
  } else if(kind==='case-match') {
    // Recognising the five case names is independent from writing their endings.
    add('case-match',{cases:BOOK_CASES,questions:CASE_QUESTIONS});
  } else {
    if(!words.length)throw Error('Diese Sammlung enthält keine verfügbaren Vokabeln.');
    words=seededShuffle(words,roundId);
    if(kind==='matching')for(const group of matchingGroups(words,roundId))add('matching',{words:group});
    else if(kind==='sentence' || kind==='mixed') {
      const recent=model.sentences;
      const ranked=seededShuffle(sentences.filter(s=>s.collectionId===collectionId && (s.subject || 'latin')===subject),roundId).sort((a,b)=>{
        const aw=(a.focusWordIds || []).filter(w=>model.words[w]?.weak).length, bw=(b.focusWordIds || []).filter(w=>model.words[w]?.weak).length;
        return (recent[a.id] || 0)-(recent[b.id] || 0) || bw-aw;
      });
      const weak=words.filter(w=>model.words[w.id]?.weak).sort((a,b)=>(model.words[b.id].lastErrorAt || 0)-(model.words[a.id].lastErrorAt || 0)).slice(0,8);
      const chosen=ranked.slice(0,Math.min(8,Math.max(3,Math.ceil(words.length/5))));
      for(let i=0;i<Math.max(kind==='mixed'?weak.length:0,chosen.length);i++) {
        if(kind==='mixed' && weak[i])add('quick',{word:weak[i],wordId:weak[i].id});
        if(chosen[i])add('sentence',{sentence:chosen[i]});
      }
      if(!chosen.length){round.contentNotice='Die Sätze sind gerade nicht verfügbar. Du kannst die Wörter bereits üben.'; if(!round.tasks.length)for(const word of words)add('quick',{word,wordId:word.id});}
    } else for(const word of words)add(kind,{word,wordId:word.id});
    if(kind!=='cards' && kind!=='matching')for(const wordId of unique(suggestion.carryWordIds || carryWordIds)) {
      const word=data.words?.[wordId]; if(word && !round.tasks.some(t=>t.wordId===wordId))add('quick',{word,wordId,carried:true});
    }
  }
  const taskIds=round.tasks.map(t=>t.id);
  // Split the actual source vocabulary; carried repair tasks belong to the second half.
  if(kind==='write' && words.length>1){const half=Math.ceil(words.length/2);round.blocks=[taskIds.slice(0,half),taskIds.slice(half)];}
  else round.blocks=[taskIds];
  round.queue=[...round.blocks[0]];
  round.originalCount=round.tasks.filter(t=>!(t.kind==='grammar' && t.stage==='study')).length;
  return round;
}
export function currentTask(round) {
  if(!round || ['complete','checkpoint'].includes(round.phase))return null;
  return round.tasks.find(t=>t.id===round.queue[0]) || null;
}
export function roundProgress(round) {
  return {done:(round.completedTaskIds || []).length,total:round.originalCount,block:round.blockIndex+1,blocks:round.blocks.length};
}
function evaluateTask(task,answer,options) {
  if(task.kind==='cards')return {correct:answer===true,results:gradedWord(task.word,task.direction).meanings.map((_,i)=>({key:wordKey(task.wordId,i,task.direction),wordId:task.wordId,meaningIndex:i,correct:answer===true}))};
  if(['write','quick'].includes(task.kind))return evaluateWord(task.word,answer,{quick:task.kind==='quick',direction:task.direction,...options});
  if(task.kind==='sentence')return {...evaluateSentence(task.sentence,answer),results:[{key:`sentence:${task.sentence.id}`,correct:evaluateSentence(task.sentence,answer).correct}]};
  if(task.kind==='grammar') {
    if(task.stage==='study')throw Error('Lies die Tabelle und bestätige zuerst, dass du sie dir gemerkt hast.');
    const results=task.cells.filter(cell=>task.hiddenIds.includes(cell.id)).map(cell=>({key:cell.id,cellId:cell.id,correct:checkEnding(answer?.[cell.id] || '',cell)}));
    return {correct:results.every(r=>r.correct),results,expected:task.cells.filter(c=>task.hiddenIds.includes(c.id))};
  }
  if(task.kind==='matching') {
    const pairs=Array.isArray(answer?.pairs)?answer.pairs:[], used=new Set(), results=[];
    for(const word of task.words) {
      const pair=pairs.find(p=>p.wordId===word.id), target=task.words.find(w=>w.id===pair?.meaningWordId);
      const labels=task.direction==='de-en'?gradedWord(word,'de-en').meanings.flatMap(g=>g.flatMap(variants)).map(normalizeAnswer):meaningLabels(word);
      const shown=target?(task.direction==='de-en'?target.latin:target.meanings[0][0]):'';
      const correct=!!target && !used.has(target.id) && (target.id===word.id || variants(shown).map(normalizeAnswer).some(label=>labels.includes(label)));
      if(target)used.add(target.id);
      results.push({key:wordKey(word.id,0,task.direction),wordId:word.id,meaningIndex:0,correct});
    }
    return {correct:results.every(r=>r.correct),results,mistakes:Array.isArray(answer?.mistakes)?answer.mistakes:[]};
  }
  if(task.kind==='case-match') {
    const results=task.cases.map(c=>({key:`case-question:${c.id}`,correct:answer?.[c.id]===c.id || answer?.[c.id]===task.questions[c.id]}));
    return {correct:results.every(r=>r.correct),results,mistakes:Array.isArray(answer?._mistakes)?answer._mistakes:[]};
  }
  throw Error('Unbekannte Aufgabe.');
}
export function submitAnswer(saved,answer,{now=Date.now(),eventId=id(),hinted=false,hintedWordIds=[],allowTypos=true,overrides={}}={}) {
  if(saved.phase!=='task')throw Error('Diese Aufgabe wurde bereits bewertet.');
  const round=copy(saved), task=currentTask(round);
  if(!task)throw Error('Keine offene Aufgabe.');
  const result=evaluateTask(task,answer,{hinted,hintedWordIds,allowTypos,overrides});
  const attempt=(round.attempts[task.id] || 0)+1;round.attempts[task.id]=attempt;
  const event={id:eventId,subject:round.subject || 'latin',direction:taskDirection(round.subject || 'latin',task.direction),roundId:round.id,taskId:task.id,at:now,modality:task.kind,attempt,retry:attempt>1,hinted:!!hinted || hintedWordIds.length>0,hintedWordIds:unique(hintedWordIds),correct:result.correct,results:result.results || [],wordId:task.wordId || null,sentenceId:task.sentence?.id || null,caseId:task.caseId || null,errorType:result.correct?null:(result.errorType || (task.kind==='grammar'?'ending':'meaning'))};
  const events=[event];
  // Preserve wrong pair taps independently of the eventually solved matching set.
  for(let index=round.draft?.recordedMistakeCount || 0;index<(result.mistakes || []).length;index++) {
    const mistake=result.mistakes[index], word=task.words?.find(w=>w.id===mistake.wordId);
    if(word)events.push({...event,id:`${eventId}:pair${index}`,correct:false,retry:false,results:[{key:wordKey(word.id,0,task.direction),wordId:word.id,meaningIndex:0,correct:false}],wordId:word.id,errorType:'matching'});
    else if(task.kind==='case-match' && task.cases.some(c=>c.id===(mistake.caseId || mistake.wordId)))events.push({...event,id:`${eventId}:pair${index}`,correct:false,retry:false,results:[{key:`case-question:${mistake.caseId || mistake.wordId}`,correct:false}],errorType:'case-question'});
  }
  round.feedback={...result,result:copy(result),answer:copy(answer),taskId:task.id,attempt,hinted:event.hinted,hintedWordIds:unique(hintedWordIds),allowTypos,overrides:copy(overrides),eventId,originalEventId:eventId};
  round.phase='feedback';round.updatedAt=now;round.revision++;round.paused=false;
  return {round,event,events,result};
}
export function correctRoundEvaluation(saved,overrides,{now=Date.now(),eventId=id()}={}) {
  const task=currentTask(saved);
  if(saved.phase!=='feedback' || !['write','quick'].includes(task?.kind))throw Error('Hier gibt es keine schriftliche Auswertung zu korrigieren.');
  const feedback=saved.feedback,round=copy(saved);
  round.phase='task';round.attempts[task.id]=Math.max(0,feedback.attempt-1);
  const changed=submitAnswer(round,feedback.answer,{now,eventId,hinted:feedback.hinted,hintedWordIds:feedback.hintedWordIds || [],allowTypos:feedback.allowTypos!==false,overrides});
  changed.event.corrects=feedback.originalEventId || feedback.eventId;
  changed.event.correctionRevision=(feedback.correctionRevision || 0)+1;
  if(!changed.event.corrects)throw Error('Die ursprüngliche Auswertung kann nicht eindeutig zugeordnet werden.');
  changed.round.feedback.originalEventId=changed.event.corrects;
  changed.round.feedback.correctionRevision=changed.event.correctionRevision;
  return changed;
}
function grammarSupport(round,task,now) {
  const cells=task.cells, editable=cells.filter(c=>c.editable!==false).map(c=>c.id), tasks=[];
  const suffix=`help${round.revision}`;
  const existingStudy=round.tasks.find(t=>t.kind==='grammar' && t.stage==='study' && !t.support);
  const existingPairs=round.tasks.filter(t=>t.kind==='grammar' && t.stage==='pairs' && !t.support);
  if(!existingStudy)tasks.push({id:`${round.id}:${suffix}:study`,kind:'grammar',caseId:task.caseId,cells,hiddenIds:[],stage:'study',support:true});
  if(!existingPairs.length)for(let i=0;i<editable.length;i+=2)tasks.push({id:`${round.id}:${suffix}:pair${i}`,kind:'grammar',caseId:task.caseId,cells,hiddenIds:editable.slice(i,i+2),stage:'pairs',support:true});
  // Resume the same full assessment so its correction remains a retry.
  const full=round.tasks.find(t=>t.kind==='grammar' && t.stage==='full');
  round.tasks.push(...tasks);round.queue=[existingStudy?.id || tasks.find(t=>t.stage==='study').id,...(existingPairs.length?existingPairs:tasks.filter(t=>t.stage==='pairs')).map(t=>t.id),full.id];round.retryIds=[];
  round.phase='task';round.feedback=null;round.draft={};round.updatedAt=now;round.revision++;
  return round;
}
export function requestGrammarHelp(saved,{now=Date.now()}={}) {
  const round=copy(saved), task=currentTask(round) || round.tasks.find(t=>t.kind==='grammar');
  if(!task || task.kind!=='grammar' || round.phase==='complete')throw Error('Hier ist keine Endungstabelle geöffnet.');
  return grammarSupport(round,task,now);
}
export function advanceRound(saved,{now=Date.now()}={}) {
  const round=copy(saved);
  if(round.phase==='complete')return round;
  if(round.phase==='checkpoint') {
    round.blockIndex++;round.queue=[...round.blocks[round.blockIndex]];round.phase='task';round.feedback=null;round.draft={};round.updatedAt=now;round.revision++;return round;
  }
  const task=currentTask(round), study=task?.kind==='grammar' && task.stage==='study';
  if(round.phase!=='feedback' && !study)throw Error('Beantworte zuerst die Aufgabe.');
  const feedback=round.feedback;
  if(!study && task.kind==='grammar' && task.stage==='full' && !feedback.correct && feedback.results.filter(r=>r.correct).length<Math.ceil(feedback.results.length/2))return grammarSupport(round,task,now);
  round.queue.shift();
  if(!study) {
    if(feedback.correct && !task.support && !round.completedTaskIds.includes(task.id))round.completedTaskIds.push(task.id);
    if(!feedback.correct) {
      if(task.kind==='quick')round.queue.push(task.id);
      else if(task.kind==='grammar' && task.stage==='pairs')round.queue.unshift(task.id);
      else round.retryIds.push(task.id);
    }
  }
  if(!round.queue.length && round.retryIds.length) {
    round.retryCycle++;round.queue=seededShuffle(unique(round.retryIds),`${round.id}:${round.retryCycle}`);round.retryIds=[];
  }
  round.feedback=null;round.draft={};round.updatedAt=now;round.revision++;round.phase='task';
  if(!round.queue.length) {
    if(round.blockIndex<round.blocks.length-1)round.phase='checkpoint';
    else {round.phase='complete';round.completedAt=now;round.paused=false;}
  }
  return round;
}
export function validateExam(exam, {now=Date.now()}={}) {
  const date=String(exam.date || '');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime()) || new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)throw Error('Bitte ein gültiges Prüfungsdatum wählen.');
  const collectionIds=unique((exam.collectionIds || []).filter(x=>typeof x==='string' && x.length<200));
  if(!collectionIds.length)throw Error('Bitte mindestens eine Sammlung wählen.');
  const name=clean(exam.name || exam.title || 'Meine Prüfung').slice(0,120);
  return {id:exam.id || id(),name,title:name,date,collectionIds,createdAt:exam.createdAt || now,updatedAt:now,endedAt:exam.endedAt || null,deleted:!!exam.deleted};
}
