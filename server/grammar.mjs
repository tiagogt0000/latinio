import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,lstatSync,unlinkSync} from 'node:fs';
import {TOPIC,GENERATION_SCHEMA,GRADING_SCHEMA,learningStats,makePlan,generationMessages,gradingMessages,validateTasks,validateResults} from './grammar-content.mjs';

export const MODEL='Meta-Llama-3_3-70B-Instruct';
export const ENDPOINT='https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions';
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
const idOk=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(id);
function secretFile(path){
 return {
  get(){
   try{const info=lstatSync(path);if(!info.isFile()||info.isSymbolicLink()||(info.mode&0o077))return '';return readFileSync(path,'utf8').trim();}catch{return '';}
  },
  set(key){
   try{if(lstatSync(path).isSymbolicLink())throw Error('link');}catch(e){if(e.code!=='ENOENT')throw Error('Der Schlüssel konnte nicht sicher gespeichert werden.');}
   const temp=path+'.'+randomUUID();
   try{writeFileSync(temp,key,{mode:0o600,flag:'wx'});renameSync(temp,path);}catch{try{unlinkSync(temp);}catch{}throw Error('Der Schlüssel konnte nicht gespeichert werden.');}
  }
 };
}
export function createGrammar(database,{fetchImpl=(...args)=>globalThis.fetch(...args),now=Date.now,keyPath='/data/grammar-ovh.key',keyStore=secretFile(keyPath),envKey=process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN||'',timeout=85000}={}){
 const db=database.db,pending=new Map();let active=false;
 db.exec(`CREATE TABLE IF NOT EXISTS grammar_rounds(id TEXT PRIMARY KEY,profile TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,value TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS grammar_round_profile ON grammar_rounds(profile,created DESC);
 CREATE TABLE IF NOT EXISTS grammar_operations(id TEXT PRIMARY KEY,profile TEXT NOT NULL,kind TEXT NOT NULL,hash TEXT NOT NULL,status TEXT NOT NULL,round_id TEXT,error TEXT NOT NULL,started INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS grammar_usage(day TEXT PRIMARY KEY,calls INTEGER NOT NULL,input_tokens INTEGER NOT NULL,output_tokens INTEGER NOT NULL,reserved_tokens INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS grammar_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 db.prepare("UPDATE grammar_operations SET status='error',error='Die KI-Anfrage wurde durch einen Neustart unterbrochen. Bitte erneut versuchen.' WHERE status='running'").run();
 const read=id=>{const row=db.prepare('SELECT value FROM grammar_rounds WHERE id=?').get(id);return row?JSON.parse(row.value):null;};
 const save=r=>db.prepare('INSERT OR REPLACE INTO grammar_rounds VALUES(?,?,?,?,?)').run(r.id,r.profile,r.created,now(),JSON.stringify(r));
 const recent=profile=>db.prepare('SELECT value FROM grammar_rounds WHERE profile=? ORDER BY created DESC,rowid DESC LIMIT 30').all(profile).map(r=>JSON.parse(r.value));
 const config=()=>JSON.parse(db.prepare("SELECT value FROM grammar_config WHERE key='limits'").get()?.value||'{"dailyCalls":40,"dailyTokens":200000}');
 const key=()=>envKey||keyStore.get();
 const owned=(id,profile)=>{const r=read(id);if(!r||r.profile!==profile.id)throw Error('Diese Grammatikrunde wurde nicht gefunden.');return r;};
 const publicRound=r=>({...r,profile:undefined,tasks:r.tasks.map(({solution,alternatives,targetEvidence,...task})=>task)});
 function status(profile){
  const rounds=recent(profile.id),usage=db.prepare('SELECT * FROM grammar_usage WHERE day=?').get(day(now()))||{day:day(now()),calls:0,input_tokens:0,output_tokens:0,reserved_tokens:0};
  const count=db.prepare('SELECT count(*) n FROM grammar_rounds WHERE profile=?').get(profile.id).n;
  return {available:true,configured:!!key(),keySource:envKey?'environment':'file',topic:TOPIC,model:MODEL,limits:config(),usage,stats:learningStats(rounds),roundCount:count,
   rounds:rounds.map(r=>({id:r.id,created:r.created,count:r.tasks.length,evaluated:!!r.evaluations.length,correct:r.evaluations.at(-1)?.results.filter(x=>x.status==='correct').length||0})),latest:rounds[0]?publicRound(rounds[0]):null};
 }
 function checkedAnswers(r,answers){
  if(!answers||typeof answers!=='object'||Array.isArray(answers)||Object.keys(answers).length!==r.tasks.length||r.tasks.some(t=>typeof answers[t.id]!=='string'||answers[t.id].length>1000)||Object.keys(answers).some(id=>!r.tasks.some(t=>t.id===id)))throw Error('Die Antworten sind unvollständig oder zu lang.');
  return Object.fromEntries(r.tasks.map(t=>[t.id,answers[t.id]]));
 }
 function storeAnswers(body,profile){
  const r=owned(body.roundId,profile);
  if(r.evaluations.length)throw Error('Diese Runde ist bereits ausgewertet.');
  if(db.prepare("SELECT 1 FROM grammar_operations WHERE round_id=? AND status='running'").get(r.id))throw Error('Diese Runde wird gerade kontrolliert.');
  if(body.revision!==r.revision)throw Error('Diese Runde wurde auf einem anderen Gerät geändert. Öffne sie erneut; dein lokaler Entwurf bleibt erhalten.');
  r.answers=checkedAnswers(r,body.answers);r.revision++;save(r);return r;
 }
 async function completion(messages,schema,kind,count){
  const secret=key();if(!secret)throw Error('Bitte zuerst den OVHcloud-Schlüssel unter KI-Einstellungen hinterlegen.');
  const maxTokens=kind==='generate'?800+count*420:900+count*650;
  const reservation=Buffer.byteLength(JSON.stringify(messages),'utf8')+maxTokens;
  const today=day(now()),limits=config();
  db.prepare('INSERT OR IGNORE INTO grammar_usage VALUES(?,0,0,0,0)').run(today);
  const used=db.prepare('SELECT * FROM grammar_usage WHERE day=?').get(today);
  if(used.calls>=limits.dailyCalls||used.input_tokens+used.output_tokens+used.reserved_tokens+reservation>limits.dailyTokens)throw Error('Dein tägliches KI-Limit ist erreicht. Du kannst es in den KI-Einstellungen anpassen.');
  db.prepare('UPDATE grammar_usage SET calls=calls+1,reserved_tokens=reserved_tokens+? WHERE day=?').run(reservation,today);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
   const response=await fetchImpl(ENDPOINT,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},signal:controller.signal,
    body:JSON.stringify({model:MODEL,messages,temperature:kind==='generate'?.4:0,max_tokens:maxTokens,stream:false,response_format:{type:'json_schema',json_schema:{name:kind==='generate'?'grammar_tasks_v1':'grammar_grades_v1',schema}}})});
   if(!response.ok){
    if(response.status===401||response.status===403)throw Error('OVHcloud hat den Schlüssel abgelehnt. Bitte Schlüssel und Modellzugriff prüfen.');
    if(response.status===429)throw Error('OVHcloud ist momentan ausgelastet oder hat ein Anfrage-Limit erreicht. Bitte später erneut versuchen.');
    throw Error('OVHcloud konnte die Anfrage nicht bearbeiten. Bitte erneut versuchen.');
   }
   // Never include the provider response body in errors or logs (may echo data).
   const raw=await response.text();if(raw.length>180000)throw Error('Die KI-Antwort ist zu groß. Bitte erneut versuchen.');
   let body;try{body=JSON.parse(raw);}catch{throw Error('OVHcloud hat keine gültige Antwort geliefert. Bitte erneut versuchen.');}
   const usage=body.usage;
   if(Number.isSafeInteger(usage?.prompt_tokens)&&usage.prompt_tokens>=0&&Number.isSafeInteger(usage?.completion_tokens)&&usage.completion_tokens>=0){
    db.prepare('UPDATE grammar_usage SET input_tokens=input_tokens+?,output_tokens=output_tokens+?,reserved_tokens=MAX(0,reserved_tokens-?) WHERE day=?').run(usage.prompt_tokens,usage.completion_tokens,reservation,today);
   }
   const result=body.choices?.[0];if(result?.finish_reason!=='stop'||result.message?.refusal||typeof result.message?.content!=='string')throw Error('Die KI-Antwort wurde nicht vollständig abgeschlossen. Bitte erneut versuchen.');
   try{return JSON.parse(result.message.content);}catch{throw Error('Die KI-Antwort hat ein ungültiges Format. Bitte erneut versuchen.');}
  }catch(error){
   if(controller.signal.aborted)throw Error('Die KI hat zu lange gebraucht. Deine Antworten bleiben erhalten. Bitte erneut versuchen.');
   // Only our own German errors are exposed, not fetch errors with request data.
   if(/^(Bitte zuerst|Dein tägliches|OVHcloud |Die KI-)/.test(error.message))throw error;
   throw Error('Die Verbindung zu OVHcloud ist fehlgeschlagen. Deine Antworten bleiben erhalten.');
  }finally{clearTimeout(timer);}
 }
 async function operation(body,profile,kind){
  if(!idOk(body.requestId))throw Error('Eine gültige Anfrage-ID fehlt.');
  const opId=profile.id+':'+body.requestId;
  const hash=createHash('sha256').update(JSON.stringify({kind,count:body.count,topicId:body.topicId,roundId:body.roundId,answers:body.answers,revision:body.revision})).digest('hex');
  const previous=db.prepare('SELECT * FROM grammar_operations WHERE id=?').get(opId);
  if(previous&&(previous.hash!==hash||previous.kind!==kind))throw Error('Diese Anfrage-ID wurde schon für andere Daten verwendet.');
  if(previous?.status==='done')return {round:publicRound(owned(previous.round_id,profile)),state:status(profile)};
  if(pending.has(opId))return pending.get(opId);
  if(active)throw Error('Eine KI-Anfrage läuft bereits. Bitte kurz warten.');
  let round,plan,history;
  if(kind==='generate'){
   if(![3,5,10].includes(body.count)||body.topicId!==TOPIC.id)throw Error('Bitte 3, 5 oder 10 Aufgaben zum Hilfsverb-Thema wählen.');
   history=recent(profile.id);plan=makePlan(body.count,history,db.prepare('SELECT count(*) n FROM grammar_rounds WHERE profile=?').get(profile.id).n);
  }else{
   round=owned(body.roundId,profile);
   if(kind==='grade'){
    if(round.evaluations.length)return {round:publicRound(round),state:status(profile)};
    // On retry, answers already persisted by this operation are used unchanged.
    if(!previous)round=storeAnswers(body,profile);
    else if(JSON.stringify(checkedAnswers(round,body.answers))!==JSON.stringify(round.answers))throw Error('Die Antworten wurden inzwischen geändert. Bitte erneut absenden.');
   }else if(!round.evaluations.length)throw Error('Bitte zuerst die Runde kontrollieren lassen.');
   else if(round.evaluations.length>=3)throw Error('Diese Runde wurde bereits zweimal nachgeprüft. Bei Unklarheit bleibt sie ohne Wertung.');
  }
  db.prepare('INSERT OR REPLACE INTO grammar_operations VALUES(?,?,?,?,?,?,?,?)').run(opId,profile.id,kind,hash,'running',round?.id||null,'',now());
  active=true;
  const task=(async()=>{
   try{
    if(kind==='generate'){
     const prompts=history.flatMap(r=>r.tasks.map(t=>t.promptDe)).slice(0,60),output=await completion(generationMessages(plan,prompts),GENERATION_SCHEMA,kind,body.count);
     const tasks=validateTasks(output,plan,prompts);
     round={id:randomUUID(),profile:profile.id,topicId:TOPIC.id,created:now(),revision:0,plan,tasks,answers:Object.fromEntries(tasks.map(t=>[t.id,''])),evaluations:[]};
    }else{
     const output=await completion(gradingMessages(round,{review:kind==='review'}),GRADING_SCHEMA,kind,round.tasks.length);
     let results=validateResults(output,round);
     if(kind==='review'){
      results=results.map(r=>{
       const disagrees=round.evaluations.some(e=>{const prior=e.results.find(x=>x.id===r.id);return ['target','otherGrammar','vocabulary','content'].some(k=>r[k]!==prior[k]);});
       return disagrees?{...r,status:'uncertain',confidence:'uncertain',explanationDe:r.explanationDe+' Die Nachprüfungen widersprechen einer früheren Bewertung. Diese Aufgabe zählt deshalb nicht zum Lernprofil.'}:r;
      });
     }
     round.evaluations.push({id:randomUUID(),at:now(),model:MODEL,promptVersion:1,kind,results});round.revision++;
    }
    db.exec('BEGIN IMMEDIATE');
    try{save(round);db.prepare("UPDATE grammar_operations SET status='done',round_id=? WHERE id=?").run(round.id,opId);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    return {round:publicRound(round),state:status(profile)};
   }catch(error){db.prepare("UPDATE grammar_operations SET status='error',error=? WHERE id=?").run(error.message,opId);throw error;}
   finally{active=false;pending.delete(opId);}
  })();pending.set(opId,task);return task;
 }
 async function request(body,profile){
  if(profile?.role!=='admin')throw Error('Nur für den Admin.');
  if(JSON.stringify(body).length>20000)throw Error('Die Grammatik-Anfrage ist zu groß.');
  if(body.action==='grammarStatus')return status(profile);
  if(body.action==='grammarOperation'){
   if(!idOk(body.requestId))throw Error('Ungültige Anfrage-ID.');
   const op=db.prepare('SELECT * FROM grammar_operations WHERE id=? AND profile=?').get(profile.id+':'+body.requestId,profile.id);
   return op?{status:op.status,error:op.error,...(op.status==='done'?{round:publicRound(owned(op.round_id,profile))}:{})}:{status:'unknown'};
  }
  if(body.action==='grammarRound')return {round:publicRound(owned(body.roundId,profile))};
  if(body.action==='grammarHistory'){
   const offset=body.offset;if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw Error('Ungültige Verlaufsseite.');
   return {rounds:db.prepare('SELECT value FROM grammar_rounds WHERE profile=? ORDER BY created DESC,rowid DESC LIMIT 30 OFFSET ?').all(profile.id,offset).map(row=>{const r=JSON.parse(row.value);return {id:r.id,created:r.created,count:r.tasks.length,evaluated:!!r.evaluations.length,correct:r.evaluations.at(-1)?.results.filter(x=>x.status==='correct').length||0};})};
  }
  if(body.action==='grammarSave')return {round:publicRound(storeAnswers(body,profile))};
  if(body.action==='grammarConfigure'){
   if(active)throw Error('Bitte die laufende KI-Anfrage abwarten.');
   const limits=body.limits;
   if(!limits||!Number.isInteger(limits.dailyCalls)||limits.dailyCalls<2||limits.dailyCalls>200||!Number.isInteger(limits.dailyTokens)||limits.dailyTokens<20000||limits.dailyTokens>2000000)throw Error('Bitte 2–200 Anfragen und 20.000–2.000.000 Tokens pro Tag wählen.');
   if(body.apiKey){
    if(envKey)throw Error('Der Schlüssel wird bereits über die Serverumgebung verwaltet.');
    if(typeof body.apiKey!=='string'||body.apiKey.length<16||body.apiKey.length>4096||/\s/.test(body.apiKey))throw Error('Der API-Schlüssel hat ein ungültiges Format.');
    keyStore.set(body.apiKey);
   }
   db.prepare("INSERT OR REPLACE INTO grammar_config VALUES('limits',?)").run(JSON.stringify(limits));return status(profile);
  }
  if(body.action==='grammarGenerate')return operation(body,profile,'generate');
  if(body.action==='grammarGrade')return operation(body,profile,'grade');
  if(body.action==='grammarReview')return operation(body,profile,'review');
  throw Error('Unbekannte Grammatikaktion.');
 }
 return {request,ready:true};
}
