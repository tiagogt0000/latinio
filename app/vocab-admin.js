import {uid} from './core.js';
import {SUBJECTS,subjectInfo} from './subjects.js';
import {settleSync} from './multiuser-sync.js';

export function vocabularyFields(word={}){
 return {latin:word.latin||'',meanings:word.meanings||[],forms:word.forms||[],...(word.answerVariants?{answerVariants:word.answerVariants}:{})};
}
export function canManageVocabulary(profile,subject){
 return profile?.role!=='admin'&&profile?.vocabAdminSubjects?.includes(subject)===true&&profile?.allowedSubjects?.includes(subject)===true;
}
export function vocabularyAdmin({store,sync,getProfile,subject,h,modalRoot,showModal,closeModal,notify,saveLocal,onPublished}){
 let editor=null,pending=null,history=null,busy=false;
 const same=(a,b)=>JSON.stringify(vocabularyFields(a))===JSON.stringify(vocabularyFields(b));
 const visible=selector=>!!modalRoot.querySelector(selector);
 const message=error=>String(error?.message||error||'Die Verbindung ist gerade nicht verfügbar.').replace(/^Error:\s*/,'');
 function prepare(word){
  pending=null;
  editor=word&&canManageVocabulary(getProfile(),subject)?{before:structuredClone(word),metadata:null,error:null,loading:true}:null;
  if(editor)void loadMetadata(editor);
 }
 async function loadMetadata(state){
  state.loading=true;state.error=null;
  try{
   const metadata=await sync.request('vocabAdminWord',{wordId:state.before.id});
   if(metadata.eligible!==false&&!same(metadata.localBefore,state.before))throw Error('Diese Vokabel wurde inzwischen geändert. Öffne den Eintrag erneut, bevor du eine Änderung für alle übernimmst.');
   state.metadata=metadata;
  }catch(error){state.error=message(error);state.metadata=null;}
  finally{state.loading=false;if(pending?.editor===state&&visible('[data-vocab-choice]'))drawChoice();}
 }
 function offer(word){
  if(!editor||editor.before.id!==word.id||!canManageVocabulary(getProfile(),subject)||same(editor.before,word)||editor.metadata?.eligible===false)return false;
  pending={editor,word:structuredClone(word),requestId:uid()};drawChoice();return true;
 }
 function drawChoice(){
  if(!pending)return;
  const {editor:state,word}=pending,eligible=state.metadata&&state.metadata.eligible!==false&&!state.error;
  showModal(`<div data-vocab-choice><h2 id="modal-title">Änderung für alle übernehmen?</h2><p>Du betreust ${h(subjectInfo(subject).label)}. Soll diese Korrektur auch in der gemeinsamen Vokabel und bei allen Empfängern gespeichert werden?</p><div class="card vocab-change-preview"><strong>${h(word.latin)}</strong><p>${word.meanings.map(group=>h(group.join(' / '))).join('<br>')}</p></div><p class="small muted">Lernstände bleiben erhalten. Die übertragene Änderung ist für den Hauptadmin im Verlauf sichtbar.</p><p role="status" data-vocab-status>${state.loading?'Berechtigung wird geprüft …':state.error?h(state.error):state.metadata?.eligible===false?'Dieser Eintrag gehört nur dir. Er kann nicht an alle übertragen werden.':''}</p><div class="button-row"><button class="button primary" data-action="vocab-publish" ${!eligible?'disabled':''}>Ja, für alle übernehmen</button><button class="button secondary" data-action="vocab-private-save">Nur für mich speichern</button></div>${state.error?'<button class="text-button" data-action="vocab-prepare-retry">Verbindung erneut prüfen</button>':''}<button class="text-button" data-action="close-modal">Abbrechen</button></div>`);
 }
 function setBusy(value,status=''){
  busy=value;
  modalRoot.querySelectorAll('[data-vocab-choice] button').forEach(button=>button.disabled=value);
  const node=modalRoot.querySelector('[data-vocab-status]');if(node)node.textContent=status;
 }
 async function publish(){
  const draft=pending;if(!draft||busy)return;
  if(!canManageVocabulary(getProfile(),subject))throw Error('Du bist für dieses Fach nicht mehr als Fach-Admin eingetragen.');
  if(!draft.editor.metadata||draft.editor.metadata.eligible===false)throw Error('Die Berechtigung konnte noch nicht geprüft werden.');
  if(draft.word.collectionId!==draft.editor.before.collectionId)throw Error('Eine Vokabel kann beim Übertragen nicht in eine andere Sammlung verschoben werden. Speichere diese Änderung nur für dich.');
  const liveWord=store.data.words[draft.word.id];
  if(!liveWord||liveWord.collectionId!==draft.editor.before.collectionId||!same(liveWord,draft.editor.before))throw Error('Die Vokabel wurde inzwischen geändert. Bitte öffne sie erneut.');
  setBusy(true,'Die Änderung wird für alle gespeichert …');
  try{
   await sync.request('vocabAdminPublish',{wordId:draft.word.id,revision:draft.editor.metadata.revision,requestId:draft.requestId,word:vocabularyFields(draft.word),confirmed:true});
   pending=null;editor=null;
   // The server has saved the correction atomically. A failed refresh must never
   // offer a second publication or silently fall back to a private write.
   try{await settleSync(sync,store);}catch{}
   closeModal();await onPublished(draft.word.id);
   if(sync.status!=='synced')sync.schedule();
   notify(sync.status==='synced'?'Änderung für alle übernommen.':'Änderung für alle übernommen. Dein aktueller Stand wird noch geladen.');
  }catch(error){
   if(pending===draft){setBusy(false,message(error));throw error;}
   notify('Änderung für alle übernommen. Bitte lade die Ansicht neu.');
  }finally{busy=false;}
 }
 const value=(word,key)=>key==='meanings'?(word?.meanings||[]).map(group=>group.join(' / ')).join('\n'):Array.isArray(word?.[key])?word[key].join(', '):word?.[key]||'—';
 function changeMarkup(change){
  const before=change.editorBefore||change.before;
  const fields=[['latin','Vokabel'],['meanings','Bedeutungen'],['forms','Suchformen'],['answerVariants','Antwortvarianten']].filter(([key])=>JSON.stringify(before?.[key])!==JSON.stringify(change.after?.[key]));
  return `<article class="card vocab-audit-entry"><h3>${h(change.after?.latin||change.before?.latin||'Vokabel')}</h3><p class="small muted">${h(change.actorName||'Ehemaliger Nutzer')} · ${h(new Date(change.at).toLocaleString('de-DE'))}${change.collectionName?' · '+h(change.collectionName):''}</p>${fields.map(([key,label])=>`<div class="vocab-audit-field"><strong>${label}</strong><div class="vocab-audit-values"><div><small>Vorher</small><p>${h(value(before,key))}</p></div><div><small>Nachher</small><p>${h(value(change.after,key))}</p></div></div></div>`).join('')}<p class="small muted">Für alle Empfänger übernommen${Number.isInteger(change.users)?' · '+change.users+' Nutzer':''}</p></article>`;
 }
 function drawHistory(){
  const state=history;if(!state)return;
  showModal(`<div data-vocab-history><h2 id="modal-title">Vokabeländerungen</h2><div class="button-row" aria-label="Lernfach">${SUBJECTS.map(item=>`<button class="chip ${item.id===state.subject?'selected':''}" data-action="vocab-history-subject" data-subject="${item.id}" aria-pressed="${item.id===state.subject}">${item.label}</button>`).join('')}</div><p class="small muted">Von Fach-Admins bestätigte Änderungen mit dem Inhalt vor und nach der Übertragung.</p>${state.rows.map(changeMarkup).join('')}${!state.rows.length&&!state.loading&&!state.error?'<p>Noch keine Änderungen für dieses Fach.</p>':''}<p role="status">${state.loading?'Änderungen werden geladen …':h(state.error||'')}</p>${state.error?'<button class="button secondary" data-action="vocab-history-more">Erneut laden</button>':state.nextBefore&&!state.loading?'<button class="button secondary" data-action="vocab-history-more">Weitere Änderungen</button>':''}<button class="button secondary wide" data-action="close-modal">Schließen</button></div>`);
 }
 async function loadHistory(){
  const state=history;if(!state||state.loading)return;
  state.loading=true;state.error=null;drawHistory();
  try{
   const result=await sync.request('vocabAdminHistory',{limit:20,...(state.nextBefore?{before:state.nextBefore}:{})},state.subject);
   const ids=new Set(state.rows.map(row=>row.id));state.rows.push(...result.changes.filter(row=>!ids.has(row.id)));state.nextBefore=result.nextBefore||null;
  }catch(error){state.error=message(error);}
  finally{state.loading=false;if(history===state&&visible('[data-vocab-history]'))drawHistory();}
 }
 async function handle(button){
  const action=button.dataset.action;if(!action?.startsWith('vocab-'))return false;
  if(action.startsWith('vocab-history')){
   if(getProfile()?.role!=='admin')return true;
   if(action==='vocab-history'||action==='vocab-history-subject')history={subject:SUBJECTS.some(item=>item.id===button.dataset.subject)?button.dataset.subject:subject,rows:[],nextBefore:null,loading:false,error:null};
   await loadHistory();return true;
  }
  if(busy||!pending)return true;
  if(action==='vocab-prepare-retry'){void loadMetadata(pending.editor);drawChoice();}
  if(action==='vocab-publish')await publish();
  if(action==='vocab-private-save'){
   const draft=pending;setBusy(true,'Vokabel wird gespeichert …');
   try{await saveLocal(draft.word);pending=null;editor=null;}catch(error){setBusy(false,message(error));throw error;}finally{busy=false;}
  }
  return true;
 }
 return {prepare,offer,handle,get busy(){return busy;}};
}
