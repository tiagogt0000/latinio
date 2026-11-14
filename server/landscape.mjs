import {createHash} from 'node:crypto';
import {getSentenceCatalogue, getCollectionSentences} from './landscape-content.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const forbidden=new Set(['__proto__','constructor','prototype']);
const validId=value=>typeof value==='string' && value.length>0 && value.length<=250 && !forbidden.has(value) && !/[\u0000-\u001f]/u.test(value);
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const object=value=>value && typeof value==='object' && !Array.isArray(value);
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value) && value>=0 && value<=max;
const modalities=new Set(['cards','write','quick','matching','sentence','grammar','case-match']);
const phases=new Set(['task','feedback','checkpoint','complete']);
const englishDirections=new Set(['en-de','de-en']);
function checkedEvent(input,now,subject='latin') {
  assert(object(input) && validId(input.id) && validId(input.roundId) && validId(input.taskId),'Ungültiges Lernereignis.');
  assert(modalities.has(input.modality) && typeof input.correct==='boolean' && integer(input.at),'Ungültige Lernbewertung.');
  assert(input.at<=now+86400000,'Die Gerätezeit liegt zu weit in der Zukunft. Bitte die Uhrzeit prüfen.');
  assert(Array.isArray(input.results) && input.results.length<=200,'Zu viele Teilbewertungen.');
  assert(integer(input.attempt,10000) && input.attempt>=1,'Ungültige Versuchszahl.');
  assert((input.subject || 'latin')===subject,'Die Bewertung gehört zu einem anderen Fach.');
  assert(subject==='english'?englishDirections.has(input.direction):!input.direction || input.direction==='la-de','Ungültige Übersetzungsrichtung.');
  assert(subject!=='english' || !['grammar','case-match'].includes(input.modality),'Lateinische Endungen gehören nicht zum Englischen.');
  const results=input.results.map(result=>{
    assert(object(result) && typeof result.key==='string' && result.key.length>0 && result.key.length<=500 && !forbidden.has(result.key) && typeof result.correct==='boolean','Ungültige Teilbewertung.');
    const value={key:result.key,correct:result.correct};
    if(result.wordId!=null){assert(validId(result.wordId),'Ungültige Wortkennung.');value.wordId=result.wordId;}
    if(result.cellId!=null){assert(validId(result.cellId),'Ungültiges Tabellenfeld.');value.cellId=result.cellId;}
    if(result.meaningIndex!=null){assert(integer(result.meaningIndex,100),'Ungültige Bedeutung.');value.meaningIndex=result.meaningIndex;}
    if(subject==='english' && result.wordId && result.meaningIndex!=null)assert(result.key===`word:${result.wordId}:${input.direction}:${result.meaningIndex}`,'Die Bedeutungsbewertung gehört zu einer anderen Richtung.');
    return value;
  });
  const value={id:input.id,roundId:input.roundId,taskId:input.taskId,at:input.at,modality:input.modality,attempt:input.attempt,retry:!!input.retry,hinted:!!input.hinted,correct:input.correct,results};
  for(const key of ['wordId','sentenceId','caseId']){assert(input[key]==null || validId(input[key]),'Ungültige Inhaltskennung.');value[key]=input[key] || null;}
  value.hintedWordIds=[...new Set((Array.isArray(input.hintedWordIds)?input.hintedWordIds:[]).filter(validId))].slice(0,100);
  value.errorType=typeof input.errorType==='string'?input.errorType.slice(0,40):null;
  // Keep old Latin canonical payloads byte-compatible with their replay hashes.
  if(input.subject!==undefined)value.subject=input.subject;
  if(input.direction!==undefined)value.direction=input.direction;
  if(input.corrects!==undefined){assert(validId(input.corrects) && input.corrects!==input.id && integer(input.correctionRevision,10000) && input.correctionRevision>=1,'Ungültige Auswertungskorrektur.');value.corrects=input.corrects;value.correctionRevision=input.correctionRevision;}
  return value;
}
function checkedRound(input,now,subject='latin') {
  assert(object(input) && validId(input.id) && validId(input.mutationId) && validId(input.deviceId),'Ungültiger Rundenstand.');
  assert(integer(input.baseVersion) && integer(input.revision,100000000) && phases.has(input.phase),'Ungültige Rundenversion.');
  assert(['cards','write','quick','matching','sentence','mixed','grammar','case-match'].includes(input.kind),'Unbekannte Rundenart.');
  assert((input.subject || 'latin')===subject,'Diese Runde gehört zu einem anderen Fach.');
  assert(subject==='english'?['mixed','en-de','de-en'].includes(input.direction):!input.direction || input.direction==='la-de','Ungültige Rundenrichtung.');
  assert(subject!=='english' || !['grammar','case-match'].includes(input.kind),'Lateinische Endungen gehören nicht zum Englischen.');
  assert(Array.isArray(input.tasks) && input.tasks.length>0 && input.tasks.length<=2000,'Ungültige Aufgabenanzahl.');
  assert(input.tasks.every(task=>object(task) && validId(task.id) && modalities.has(task.kind)),'Ungültige Aufgaben.');
  assert(input.tasks.every(task=>(task.subject || 'latin')===subject && (subject==='english'?englishDirections.has(task.direction) && !['grammar','case-match'].includes(task.kind):!task.direction || task.direction==='la-de')),'Eine Aufgabe gehört zu einem anderen Fach oder einer ungültigen Richtung.');
  const ids=new Set(input.tasks.map(task=>task.id));
  assert(ids.size===input.tasks.length,'Doppelte Aufgabenkennung.');
  assert(Array.isArray(input.queue) && input.queue.length<=2000 && input.queue.every(key=>ids.has(key)),'Ungültige Aufgabenwarteschlange.');
  assert(Array.isArray(input.blocks) && input.blocks.length>0 && input.blocks.length<=20 && input.blocks.every(block=>Array.isArray(block) && block.length<=2000 && block.every(key=>ids.has(key))),'Ungültige Rundenabschnitte.');
  assert(integer(input.blockIndex,input.blocks.length-1),'Ungültiger Abschnitt.');
  assert(integer(input.createdAt) && integer(input.updatedAt),'Ungültiger Rundenzeitpunkt.');
  assert(input.createdAt<=now+86400000 && input.updatedAt<=now+86400000,'Die Gerätezeit liegt zu weit in der Zukunft.');
  const keys=['id','kind','label','collectionIds','createdAt','updatedAt','revision','phase','tasks','blocks','blockIndex','queue','retryIds','retryCycle','attempts','completedTaskIds','originalCount','feedback','draft','paused','caseId','contentNotice','completedAt','forkedFrom','subject','direction'];
  const round={};for(const key of keys)if(Object.hasOwn(input,key))round[key]=input[key];
  round.label=String(round.label || 'Lernrunde').slice(0,200);
  assert(Array.isArray(round.collectionIds) && round.collectionIds.length<=200 && round.collectionIds.every(validId),'Ungültige Sammlungen.');
  assert(Array.isArray(round.retryIds) && round.retryIds.every(key=>ids.has(key)) && Array.isArray(round.completedTaskIds) && round.completedTaskIds.every(key=>ids.has(key)),'Ungültiger Fortschritt.');
  assert(object(round.attempts) && Object.entries(round.attempts).every(([key,value])=>ids.has(key) && integer(value,10000)),'Ungültige Aufgabenversuche.');
  assert(integer(round.originalCount,2000) && integer(round.retryCycle,10000),'Ungültige Rundenzähler.');
  assert(object(round.draft),'Ungültiger Eingabeentwurf.');
  assert(Buffer.byteLength(JSON.stringify(round))<=1500000,'Der Rundenstand ist zu groß.');
  return {round,mutationId:input.mutationId,deviceId:input.deviceId,baseVersion:input.baseVersion};
}
function checkedExam(input,now) {
  assert(object(input) && validId(input.id) && validId(input.mutationId) && validId(input.deviceId),'Ungültige Prüfungsvorbereitung.');
  const date=String(input.date || '');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)===date,'Ungültiges Prüfungsdatum.');
  assert(Array.isArray(input.collectionIds) && input.collectionIds.length>0 && input.collectionIds.length<=200 && input.collectionIds.every(validId),'Ungültiger Prüfungsumfang.');
  assert(integer(input.createdAt) && integer(input.updatedAt) && (input.endedAt==null || integer(input.endedAt)),'Ungültiger Prüfungszeitpunkt.');
  assert(input.createdAt<=now+86400000 && input.updatedAt<=now+86400000,'Die Gerätezeit liegt zu weit in der Zukunft.');
  const name=String(input.name || input.title || 'Meine Prüfung').slice(0,120);
  return {exam:{id:input.id,name,title:name,date,collectionIds:[...new Set(input.collectionIds)],createdAt:input.createdAt,updatedAt:input.updatedAt,endedAt:input.endedAt || null,deleted:!!input.deleted},mutationId:input.mutationId,deviceId:input.deviceId};
}
function checkedInventory(input,now) {
  assert(object(input) && validId(input.id) && Array.isArray(input.wordIds) && input.wordIds.length<=5000 && input.wordIds.every(validId),'Ungültiger Sammlungsbestand.');
  return {id:input.id,wordIds:[...new Set(input.wordIds)],firstSeenAt:integer(input.firstSeenAt)?Math.min(input.firstSeenAt,now):now};
}

export function createLandscape(database,{now=Date.now}={}) {
  const db=database.db || database;
  db.exec(`CREATE TABLE IF NOT EXISTS landscape_events(profile TEXT NOT NULL,id TEXT NOT NULL,at INTEGER NOT NULL,hash TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(profile,id));
    CREATE INDEX IF NOT EXISTS landscape_event_profile_time ON landscape_events(profile,at);
    CREATE TABLE IF NOT EXISTS landscape_rounds(profile TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,updated INTEGER NOT NULL,value TEXT NOT NULL,PRIMARY KEY(profile,id));
    CREATE TABLE IF NOT EXISTS landscape_snapshots(profile TEXT NOT NULL,mutation_id TEXT NOT NULL,hash TEXT NOT NULL,value TEXT NOT NULL,result TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(profile,mutation_id));
    CREATE TABLE IF NOT EXISTS landscape_exams(profile TEXT NOT NULL,id TEXT NOT NULL,updated INTEGER NOT NULL,mutation_id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(profile,id));
    CREATE TABLE IF NOT EXISTS landscape_inventory(profile TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(profile,id));
    CREATE TABLE IF NOT EXISTS landscape_changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,profile TEXT NOT NULL,entity TEXT NOT NULL,item_id TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS landscape_changes_profile ON landscape_changes(profile,seq);`);
  const change=(profile,entity,itemId)=>db.prepare('INSERT INTO landscape_changes(profile,entity,item_id) VALUES(?,?,?)').run(profile,entity,itemId);
  function authorize(identity) { if(!identity || identity.role!=='admin' || !validId(identity.id)){const error=Error('Die Lernlandschaft ist nur für den Admin freigeschaltet.');error.status=403;throw error;}return identity.id; }
  function pull(profile,cursor=0) {
    assert(integer(cursor),'Ungültiger Synchronisierungsstand.');
    const rows=db.prepare('SELECT seq,entity,item_id FROM landscape_changes WHERE profile=? AND seq>? ORDER BY seq LIMIT 1001').all(profile,cursor), hasMore=rows.length>1000;
    const page=rows.slice(0,1000), events=[],rounds=[],exams=[],inventory={},seen=new Set();
    for(const item of page){
      const key=`${item.entity}:${item.item_id}`;if(seen.has(key))continue;seen.add(key);
      const table={event:'landscape_events',round:'landscape_rounds',exam:'landscape_exams',inventory:'landscape_inventory'}[item.entity];
      const row=db.prepare(`SELECT * FROM ${table} WHERE profile=? AND id=?`).get(profile,item.item_id);
      if(!row)continue;const value=JSON.parse(row.value);
      if(item.entity==='event')events.push(value);
      else if(item.entity==='round')rounds.push({...value,serverVersion:row.version});
      else if(item.entity==='exam')exams.push(value);
      else inventory[item.item_id]=value;
    }
    return {events,rounds,exams,inventory,cursor:page.at(-1)?.seq || cursor,hasMore};
  }
  function sync(body,profile,subject) {
    assert(Array.isArray(body.events || []) && (body.events || []).length<=500 && Array.isArray(body.rounds || []) && (body.rounds || []).length<=50 && Array.isArray(body.exams || []) && (body.exams || []).length<=50,'Zu viele Änderungen in einer Anfrage.');
    assert(Array.isArray(body.inventory || []) && (body.inventory || []).length<=500,'Zu viele Sammlungen.');
    const at=now(), events=(body.events || []).map(e=>checkedEvent(e,at,subject)), rounds=(body.rounds || []).map(r=>checkedRound(r,at,subject)), exams=(body.exams || []).map(e=>checkedExam(e,at));
    const inventory=(body.inventory || []).map(item=>checkedInventory(item,at));
    const ackEventIds=[],acceptedRounds=[],acceptedExams=[],conflicts=[],conflictingRounds=[];
    db.exec('BEGIN IMMEDIATE');
    try {
      const initialized=!!db.prepare('SELECT 1 FROM landscape_inventory WHERE profile=? LIMIT 1').get(profile);
      for(const input of inventory){
        const row=db.prepare('SELECT value FROM landscape_inventory WHERE profile=? AND id=?').get(profile,input.id),old=row?JSON.parse(row.value):null;
        const wordIds=[...new Set([...(old?.wordIds || []),...input.wordIds])];
        const value={firstSeenAt:old?.firstSeenAt || input.firstSeenAt,new:old?old.new || input.wordIds.some(id=>!old.wordIds.includes(id)):initialized,wordIds};
        if(!old || JSON.stringify(value)!==row.value){db.prepare('INSERT INTO landscape_inventory(profile,id,value) VALUES(?,?,?) ON CONFLICT(profile,id) DO UPDATE SET value=excluded.value').run(profile,input.id,JSON.stringify(value));change(profile,'inventory',input.id);}
      }
      for(const event of events){
        const digest=hash(event),existing=db.prepare('SELECT hash FROM landscape_events WHERE profile=? AND id=?').get(profile,event.id);
        if(existing)assert(existing.hash===digest,'Diese Ereigniskennung gehört bereits zu einer anderen Bewertung.');
        else {db.prepare('INSERT INTO landscape_events(profile,id,at,hash,value) VALUES(?,?,?,?,?)').run(profile,event.id,event.at,digest,JSON.stringify(event));change(profile,'event',event.id);}
        ackEventIds.push(event.id);
      }
      for(const event of events.filter(e=>e.corrects)){
        const target=db.prepare('SELECT value FROM landscape_events WHERE profile=? AND id=?').get(profile,event.corrects),original=target?JSON.parse(target.value):null;
        assert(original && !original.corrects && original.roundId===event.roundId && original.taskId===event.taskId && original.attempt===event.attempt && (original.direction || 'la-de')===(event.direction || 'la-de'),'Die Korrektur gehört nicht zu diesem bewerteten Versuch.');
      }
      for(const input of rounds){
        const digest=hash(input),previous=db.prepare('SELECT hash,result FROM landscape_snapshots WHERE profile=? AND mutation_id=?').get(profile,input.mutationId);
        if(previous){
          assert(previous.hash===digest,'Diese Speicherkennung wurde bereits für einen anderen Rundenstand verwendet.');
          const accepted=JSON.parse(previous.result);acceptedRounds.push(accepted);
          if(accepted.localId!==accepted.id){const remote=db.prepare('SELECT version,value FROM landscape_rounds WHERE profile=? AND id=?').get(profile,accepted.localId);if(remote)conflictingRounds.push({...JSON.parse(remote.value),serverVersion:remote.version});}
          continue;
        }
        const current=db.prepare('SELECT version,value FROM landscape_rounds WHERE profile=? AND id=?').get(profile,input.round.id);
        let round=input.round,targetId=round.id,version=(current?.version || 0)+1;
        if((current?.version || 0)!==input.baseVersion){
          targetId=`branch-${hash({profile,id:round.id,mutationId:input.mutationId}).slice(0,40)}`;
          round={...round,id:targetId,forkedFrom:input.round.id};version=1;
          conflicts.push({id:input.round.id,branchId:targetId,reason:'Auf einem anderen Gerät wurde diese Runde ebenfalls fortgesetzt. Beide Stände wurden erhalten.'});
          if(current)conflictingRounds.push({...JSON.parse(current.value),serverVersion:current.version});
        }
        const result={localId:input.round.id,id:targetId,mutationId:input.mutationId,serverVersion:version};
        db.prepare('INSERT INTO landscape_rounds(profile,id,version,updated,value) VALUES(?,?,?,?,?) ON CONFLICT(profile,id) DO UPDATE SET version=excluded.version,updated=excluded.updated,value=excluded.value').run(profile,targetId,version,at,JSON.stringify(round));
        // The latest resumable payload lives in landscape_rounds. Keep only
        // compact replay receipts here: typing must not duplicate the whole
        // vocabulary/task snapshot on every draft save. Receipts remain valid
        // for arbitrarily old offline retries, so they are not time-pruned.
        db.prepare('INSERT INTO landscape_snapshots(profile,mutation_id,hash,value,result,created) VALUES(?,?,?,?,?,?)').run(profile,input.mutationId,digest,'{}',JSON.stringify(result),at);
        change(profile,'round',targetId);acceptedRounds.push(result);
      }
      for(const {exam,mutationId} of exams){
        const current=db.prepare('SELECT updated,mutation_id FROM landscape_exams WHERE profile=? AND id=?').get(profile,exam.id);
        if(!current || exam.updatedAt>current.updated || exam.updatedAt===current.updated && mutationId>current.mutation_id){
          db.prepare('INSERT INTO landscape_exams(profile,id,updated,mutation_id,value) VALUES(?,?,?,?,?) ON CONFLICT(profile,id) DO UPDATE SET updated=excluded.updated,mutation_id=excluded.mutation_id,value=excluded.value').run(profile,exam.id,exam.updatedAt,mutationId,JSON.stringify(exam));change(profile,'exam',exam.id);
        }
        acceptedExams.push({id:exam.id,mutationId});
      }
      const result={...pull(profile,body.cursor || 0),ackEventIds,acceptedRounds,acceptedExams,conflicts};
      result.rounds=[...new Map([...result.rounds,...conflictingRounds].map(round=>[round.id,round])).values()];
      db.exec('COMMIT');return result;
    } catch(error){db.exec('ROLLBACK');throw error;}
  }
  return {ready:true,request(body,identity){
    const owner=authorize(identity),subject=body.subject || 'latin';
    assert(['latin','english'].includes(subject),'Dieses Fach hat noch keine Lernlandschaft.');
    // Existing Latin rows retain the exact original profile key. A reserved
    // control separator (forbidden in authenticated IDs) provides a disjoint
    // namespace for English without rewriting/deleting any installed history.
    const profile=subject==='latin'?owner:`${owner}\u001fenglish`;
    if(body.action==='landscapePull')return {...pull(profile,body.cursor || 0),subject};
    if(body.action==='landscapeSync')return {...sync(body,profile,subject),subject};
    if(body.action==='landscapeCatalogue'){
      assert(body.collections==null || Array.isArray(body.collections) && body.collections.length<=500 && body.collections.every(c=>object(c) && validId(c.id)),'Ungültige Sammlungsliste.');
      return {...getSentenceCatalogue(body.collections,subject),subject};
    }
    if(body.action==='landscapeSentences'){assert(validId(body.collectionId),'Ungültige Sammlung.');return {subject,collectionId:body.collectionId,sentences:getCollectionSentences(body.collectionId,subject)};}
    throw Error('Unbekannte Lernlandschaft-Anfrage.');
  }};
}
