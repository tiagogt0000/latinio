import {emptyLandscape, buildRound, currentTask, submitAnswer, correctRoundEvaluation, advanceRound, requestGrammarHelp, recommendations, planNext, validateExam, dayKey, updateInventory,landscapeSubject,wordKey} from './landscape-engine.js';

const clone=value=>structuredClone(value);
const uid=()=>globalThis.crypto.randomUUID();
const safeKey=key=>typeof key==='string' && key.length>0 && key.length<=250 && !['__proto__','constructor','prototype'].includes(key);
function initialize(saved, deviceId,subject='latin') {
  if(saved && (saved.subject || 'latin')!==subject)throw Error('Der gespeicherte Lernstand gehört zu einem anderen Fach. Er wurde nicht verändert.');
  return {...emptyLandscape(subject),pendingEvents:[],dirtyRounds:{},dirtyExams:{},cursor:0,catalogue:null,sentenceCache:{},...saved,subject,deviceId:saved?.deviceId || deviceId || uid()};
}
function mergeEvents(a,b) { return [...new Map([...a,...b].map(event=>[event.id,event])).values()].sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id)); }
function addStreak(doc, now, timeZone) {
  const day=dayKey(now,timeZone), key=`streak_day_${day}`;
  if(doc.shadow?.settings?.[key] || doc.pending?.some(op=>op.entity==='settings' && op.key===key && op.value?.kind==='streakDay'))return;
  doc.seq=(doc.seq || 0)+1;
  (doc.pending ||= []).push({id:`landscape-streak:${doc.device}:${day}`,entity:'settings',key,value:{kind:'streakDay',day},device:doc.device,seq:doc.seq,at:now});
}
export function mergeLandscapeResponse(saved, response) {
  if(response.subject && response.subject!==(saved.subject || 'latin'))throw Error('Die Antwort gehört zu einem anderen Lernfach.');
  const state=clone(saved), accepted=response.acceptedRounds || [];
  state.events=mergeEvents(state.events || [],response.events || []);
  const acknowledged=new Set(response.ackEventIds || []);
  state.pendingEvents=(state.pendingEvents || []).filter(eventId=>!acknowledged.has(eventId));
  for(const ack of accepted) {
    if(!safeKey(ack.localId) || !safeKey(ack.id))continue;
    const local=state.rounds[ack.localId], dirty=state.dirtyRounds[ack.localId];
    if(ack.localId!==ack.id && local) {
      // Concurrent devices retain separate resumable branches, not a lossy LWW.
      const existing=state.rounds[ack.id];
      const branch=existing && !dirty?existing:{...local,id:ack.id,forkedFrom:ack.localId,serverVersion:Math.max(existing?.serverVersion || 0,ack.serverVersion)};
      state.rounds[ack.id]=branch;
      if(state.activeRoundId===ack.localId)state.activeRoundId=ack.id;
      delete state.dirtyRounds[ack.localId];
      if(dirty && dirty.mutationId!==ack.mutationId)state.dirtyRounds[ack.id]={mutationId:dirty.mutationId,baseVersion:ack.serverVersion};
    } else if(local) {
      local.serverVersion=Math.max(local.serverVersion || 0,ack.serverVersion);
      if(dirty?.mutationId===ack.mutationId)delete state.dirtyRounds[ack.localId];
      else if(dirty)dirty.baseVersion=Math.max(dirty.baseVersion || 0,ack.serverVersion);
    }
  }
  for(const round of response.rounds || []) {
    if(!safeKey(round.id))continue;
    const local=state.rounds[round.id];
    if(!state.dirtyRounds[round.id] && (!local || (round.serverVersion || 0)>=(local.serverVersion || 0)))state.rounds[round.id]=clone(round);
  }
  for(const ack of response.acceptedExams || [])if(state.dirtyExams[ack.id]?.mutationId===ack.mutationId)delete state.dirtyExams[ack.id];
  for(const exam of response.exams || []) {
    if(!safeKey(exam.id))continue;
    if(!state.dirtyExams[exam.id])state.exams[exam.id]=clone(exam);
  }
  for(const [id,entry] of Object.entries(response.inventory || {})){
    if(!safeKey(id))continue;
    const local=state.inventory[id];
    state.inventory[id]={...entry,new:!!entry.new || !!local?.new,wordIds:[...new Set([...(local?.wordIds || []),...(entry.wordIds || [])])]};
    state.inventoryInitialized=true;
  }
  state.cursor=Math.max(state.cursor || 0,response.cursor || 0);
  state.lastSync=Date.now();state.syncError=null;
  if(!state.activeRoundId)state.activeRoundId=Object.values(state.rounds).filter(r=>r.phase!=='complete').sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.id || null;
  return state;
}

export function createLandscapeStore({store,sync,profile,subject=store?.subject || 'latin',now=Date.now,timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'}={}) {
  if(!store?.update)throw Error('Der lokale Lernspeicher fehlt.');
  landscapeSubject(subject);
  return new LandscapeStore({store,sync,profile,subject,now,timeZone});
}
class LandscapeStore extends EventTarget {
  constructor({store,sync,profile,subject,now,timeZone}) {
    super();Object.assign(this,{store,sync,profile,subject,now,timeZone});this.serial=Promise.resolve();this.inflight=null;this.destroyed=false;
    this.external=()=>this.dispatchEvent(new Event('change'));
    this.online=()=>{this.flush().catch(()=>{});};
    store.addEventListener?.('external',this.external);
    globalThis.addEventListener?.('online',this.online);
  }
  get state(){return initialize(this.store.doc?.landscape,this.store.doc?.device,this.subject);}
  get activeRound(){return this.state.rounds[this.state.activeRoundId] || null;}
  get error(){return this.state.syncError || this.state.contentError || null;}
  get data(){return this.store.data;}
  get configured(){return !!this.sync?.request && this.sync.configured!==false && !!this.store.doc?.config?.url && !!this.store.doc?.config?.token;}
  assertAdmin(){const profile=typeof this.profile==='function'?this.profile():this.profile || this.store.doc?.profile;if(profile?.role!=='admin' || (this.store.subject && this.store.subject!==this.subject))throw Error('Die Lernlandschaft ist vorerst nur für den Admin im ausgewählten Fach verfügbar.');}
  async load(){this.assertAdmin();await this.mutate(state=>{updateInventory(state,this.data,this.now());});this.schedule();return this;}
  mutate(fn) {
    const run=async()=>{
      this.assertAdmin();let result;
      await this.store.update(doc=>{const state=initialize(doc.landscape,doc.device,this.subject);result=fn(state,doc);doc.landscape=state;return doc;});
      this.dispatchEvent(new Event('change'));return result;
    };
    const pending=this.serial.then(run);this.serial=pending.catch(()=>{});return pending;
  }
  persistRound(state, round) {
    if(!safeKey(round.id))throw Error('Ungültige Lernrunde.');
    state.rounds[round.id]=round;
    state.dirtyRounds[round.id]={mutationId:uid(),baseVersion:state.dirtyRounds[round.id]?.baseVersion ?? round.serverVersion ?? 0};
  }
  schedule(){if(this.destroyed)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),300);}
  recommendations(limit=5){return recommendations({data:this.data,state:this.state,now:this.now(),timeZone:this.timeZone,subject:this.subject},limit);}
  async start(options={}) {
    this.assertAdmin();
    const suggestion=options.kind?options:planNext({data:this.data,state:this.state,now:this.now(),timeZone:this.timeZone,subject:this.subject});
    if(suggestion.kind==='resume')return this.resume(suggestion.roundId);
    let sentences=options.sentences;
    if(!sentences && ['sentence','mixed'].includes(suggestion.kind))sentences=await this.sentences(suggestion.collectionId);
    const round=await this.mutate(state=>{
      updateInventory(state,this.data,this.now());
      // Preserve an unfinished session even when another kind is explicitly chosen.
      if(state.activeRoundId && state.rounds[state.activeRoundId]?.phase!=='complete')state.rounds[state.activeRoundId].paused=true;
      const value=buildRound({data:this.data,state,now:this.now(),timeZone:this.timeZone,...suggestion,...options,sentences:sentences || [],subject:this.subject});
      this.persistRound(state,value);state.activeRoundId=value.id;return value;
    });
    this.schedule();return round;
  }
  async answer(answer,options={}) {
    const result=await this.mutate(state=>{
      const saved=state.rounds[state.activeRoundId];if(!saved)throw Error('Keine Lernrunde geöffnet.');
      const value=submitAnswer(saved,answer,{now:this.now(),...options});
      state.events=mergeEvents(state.events,value.events);state.pendingEvents.push(...value.events.map(event=>event.id));
      this.persistRound(state,value.round);return value;
    });this.schedule();return result;
  }
  async correctEvaluation(overrides){
    const result=await this.mutate(state=>{
      const saved=clone(state.rounds[state.activeRoundId]);if(!saved)throw Error('Keine Lernrunde geöffnet.');
      if(saved.feedback && !saved.feedback.eventId){
        const original=state.events.find(event=>event.roundId===saved.id && event.taskId===saved.feedback.taskId && event.attempt===saved.feedback.attempt && !event.corrects);
        if(original){saved.feedback.eventId=original.id;saved.feedback.originalEventId=original.id;}
      }
      const changed=correctRoundEvaluation(saved,overrides,{now:this.now()});state.events=mergeEvents(state.events,changed.events);state.pendingEvents.push(...changed.events.map(event=>event.id));this.persistRound(state,changed.round);return changed;
    });this.schedule();return result;
  }
  async refreshVocabulary(wordId){
    const updated=await this.mutate(state=>{
      const source=this.data.words?.[wordId],saved=state.rounds[state.activeRoundId];
      if(!source || !saved || saved.phase==='complete')return false;
      const round=clone(saved),finished=new Set(round.completedTaskIds || []);let changed=false;
      for(const task of round.tasks){
        if(finished.has(task.id))continue;
        if(task.wordId===wordId){task.word=clone(source);changed=true;}
        if(task.words?.some(word=>word.id===wordId)){task.words=task.words.map(word=>word.id===wordId?clone(source):word);changed=true;}
      }
      if(!changed)return false;
      const task=currentTask(round);
      if(round.phase==='feedback' && ['write','quick'].includes(task?.kind) && task.wordId===wordId){
        if(!round.feedback.eventId){const original=state.events.find(event=>event.roundId===round.id && event.taskId===task.id && event.attempt===round.feedback.attempt && !event.corrects);if(original)round.feedback.eventId=round.feedback.originalEventId=original.id;}
        const corrected=correctRoundEvaluation(round,round.feedback.overrides || {},{now:this.now()});
        state.events=mergeEvents(state.events,corrected.events);state.pendingEvents.push(...corrected.events.map(event=>event.id));this.persistRound(state,corrected.round);
      }else{round.updatedAt=this.now();round.revision++;this.persistRound(state,round);}
      return true;
    });if(updated)this.schedule();return updated;
  }
  async next(){
    const round=await this.mutate((state,doc)=>{
      const saved=state.rounds[state.activeRoundId];if(!saved)throw Error('Keine Lernrunde geöffnet.');
      const value=advanceRound(saved,{now:this.now()});this.persistRound(state,value);
      if(value.phase==='complete')addStreak(doc,this.now(),this.timeZone);
      return value;
    });this.schedule();if(round.phase==='complete')this.sync?.schedule?.(0);return round;
  }
  async pause(){const round=await this.mutate(state=>{const value=state.rounds[state.activeRoundId];if(!value)return null;value.paused=true;value.updatedAt=this.now();value.revision++;this.persistRound(state,value);return value;});this.schedule();return round;}
  async resume(roundId){const round=await this.mutate(state=>{const value=state.rounds[roundId || state.activeRoundId];if(!value)throw Error('Die gespeicherte Runde fehlt.');value.paused=false;value.updatedAt=this.now();value.revision++;this.persistRound(state,value);state.activeRoundId=value.id;return value;});this.schedule();return round;}
  async updateDraft(partial){
    return this.mutate(state=>{
      const round=state.rounds[state.activeRoundId];if(!round || round.phase==='complete')return;
      const recorded=round.draft?.recordedMistakeCount || 0, task=currentTask(round);
      round.draft={...round.draft,...clone(partial)};
      if(task && ['matching','case-match'].includes(task.kind) && Array.isArray(round.draft.mistakes)){
        // Pair errors are evidence even if the learner pauses before finishing
        // the set. The final set result will not log these taps a second time.
        for(let index=recorded;index<round.draft.mistakes.length;index++){
          const mistake=round.draft.mistakes[index],word=task.words?.find(w=>w.id===mistake.wordId),caseId=mistake.caseId || mistake.wordId;
          const results=word?[{key:wordKey(word.id,0,task.direction),wordId:word.id,meaningIndex:0,correct:false}]:task.cases?.some(c=>c.id===caseId)?[{key:`case-question:${caseId}`,correct:false}]:[];
          if(!results.length)continue;
          const attempt=(round.attempts[task.id] || 0)+1,event={id:`${task.id}:tap:${attempt}:${index}`,subject:this.subject,direction:task.direction || 'la-de',roundId:round.id,taskId:task.id,at:this.now(),modality:task.kind,attempt,retry:false,hinted:false,hintedWordIds:[],correct:false,results,wordId:word?.id || null,sentenceId:null,caseId:task.kind==='case-match'?caseId:null,errorType:task.kind==='case-match'?'case-question':'matching'};
          state.events=mergeEvents(state.events,[event]);if(!state.pendingEvents.includes(event.id))state.pendingEvents.push(event.id);
        }
        round.draft.recordedMistakeCount=Math.max(recorded,round.draft.mistakes.length);
      }
      round.updatedAt=this.now();round.revision++;this.persistRound(state,round);this.schedule();return round;
    });
  }
  async grammarHelp(){const round=await this.mutate(state=>{const value=requestGrammarHelp(state.rounds[state.activeRoundId],{now:this.now()});this.persistRound(state,value);return value;});this.schedule();return round;}
  async saveExam(exam){const value=validateExam(exam,{now:this.now()});await this.mutate(state=>{state.exams[value.id]=value;state.dirtyExams[value.id]={mutationId:uid()};});this.schedule();return value;}
  async endExam(examId){const value=await this.mutate(state=>{const exam=state.exams[examId];if(!exam)throw Error('Diese Prüfung fehlt.');exam.endedAt=this.now();exam.updatedAt=this.now();state.dirtyExams[examId]={mutationId:uid()};return exam;});this.schedule();return value;}
  async catalogue(){
    this.assertAdmin();if(!this.configured)return this.state.catalogue || {collections:[],total:0};
    try{const catalogue=await this.sync.request('landscapeCatalogue',{subject:this.subject,collections:Object.values(this.data.collections || {}).map(({id,name})=>({id,name}))});await this.mutate(state=>{state.catalogue=catalogue;});return catalogue;}
    catch(error){if(this.state.catalogue)return this.state.catalogue;throw error;}
  }
  async sentences(collectionId){
    this.assertAdmin();if(!collectionId)return [];
    const cached=this.state.sentenceCache[collectionId] || [];
    if(!this.configured || globalThis.navigator?.onLine===false)return cached;
    // Revalidate for every new sentence round, so corrected/imported content
    // reaches existing devices. Running rounds own immutable task snapshots and
    // are deliberately unaffected by refreshing this reusable offline cache.
    try{const result=await this.sync.request('landscapeSentences',{subject:this.subject,collectionId}), sentences=Array.isArray(result)?result:result.sentences || [];await this.mutate(state=>{state.sentenceCache[collectionId]=sentences;state.contentError=null;});return sentences;}
    catch(error){await this.mutate(state=>{state.contentError=error.message;});return cached;}
  }
  async flush(){
    this.assertAdmin();if(this.destroyed || !this.configured)return false;if(this.inflight)return this.inflight;
    this.inflight=(async()=>{
      await this.serial;let pages=0;
      do {
        const state=this.state, ids=new Set(state.pendingEvents.slice(0,500));
        const payload={subject:this.subject,cursor:state.cursor,events:state.events.filter(event=>ids.has(event.id)),rounds:Object.entries(state.dirtyRounds).slice(0,50).map(([id,dirty])=>({...clone(state.rounds[id]),...dirty,deviceId:state.deviceId})),exams:Object.entries(state.dirtyExams).slice(0,50).map(([id,dirty])=>({...clone(state.exams[id]),...dirty,deviceId:state.deviceId})),inventory:Object.entries(state.inventory).map(([id,entry])=>({id,...entry}))};
        const response=await this.sync.request('landscapeSync',payload);
        await this.mutate(current=>{Object.assign(current,mergeLandscapeResponse(current,response));});
        pages++;
        if(!response.hasMore && !this.state.pendingEvents.length && !Object.keys(this.state.dirtyRounds).length && !Object.keys(this.state.dirtyExams).length)break;
      }while(pages<20);
      return true;
    })().catch(async error=>{await this.mutate(state=>{state.syncError=error.message;});return false;}).finally(()=>{this.inflight=null;});
    return this.inflight;
  }
  destroy(){this.destroyed=true;clearTimeout(this.timer);this.store.removeEventListener?.('external',this.external);globalThis.removeEventListener?.('online',this.online);}
  dispose(){this.destroy();}
}
