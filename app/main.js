Warning: truncated output (original token count: 18994)
Total output lines: 327

import {parseCollectionFile,importChanges} from './refresh-import.js';
import {legacyRefreshCount,reconcileRefreshDeck} from './refresh-reconcile.js';
import {rateRefresh,refreshCardView,bindRefreshSwipe,finishRefresh} from './refresh-cards.js';
import {installKeyboardSupport} from './keyboard.js';
import {appendAnswerField} from './answer-fields.js';
import {enqueueFailedWord} from './training-queue.js';
import {progressivePassResult} from './progressive-learning.js';
import {sortedCollections,refreshDecks,wordEnabled,trainingDecks,wordsForDecks,deckMembers,pendingMembers,selectedDeckPending,saveDeck,checkResultWords} from './refresh-decks.js';
import {refreshList,refreshMethod,refreshReconcileEditor,collectionRow,collectionToolbar,refreshCreate,checkPicker,refreshEditor} from './refresh-ui.js';
import {activityKey,collectionActive,forgottenWords,inactiveQueue} from './collection-learning.js';
import {classroomView,classroomResults} from './classroom.js';
import {uid,clone,normalize,evaluateSession,progressFor,chooseWords,parseImport,shuffleQueue} from './core.js';
import {confusionUI} from './confusion-ui.js';
import {openAccount,signOut,accountCard,updateActiveProfile} from './accounts.js';
import {sharingUI} from './sharing-ui.js';
import {cloudGate,settleSync} from './multiuser-sync.js';
import {Sync} from './sync.js';
import {Store} from './store.js';
import {englishTasks,directionsFor,answerWord,promptFor,englishImport} from './english.js';
import {answerFeedback,evaluationCorrection,translationCard} from './feedback.js';
import {AppUpdates,APP_VERSION} from './updates.js';
import {preserveTestDraft} from './app-lifecycle.js';
const updates=new AppUpdates(navigator.serviceWorker);
const subject=new URL(location.href).searchParams.get('subject')==='english'?'english':'latin';
const english=subject==='english';
document.documentElement.dataset.subject=subject;
if(english){document.querySelector('link[rel="icon"]').href='./icon-english.svg';document.querySelector('meta[name="theme-color"]').content='#d64b54';document.title='Latinio · Englisch lernen';}
const directionLabel=dir=>dir==='de-en'?'Deutsch → Englisch':dir==='en-de'?'Englisch → Deutsch':'Beide Richtungen';
const h=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',book:'<path d="M12 6c-3-3-7-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2zM12 6v15"/>',settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM9 3l-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-3-3 1-2-3z"/>',cloud:'<path d="M7 18H6a4 4 0 0 1-.5-8A7 7 0 0 1 19 9a4.5 4.5 0 0 1-1 9h-1M12 20V11m-3 3 3-3 3 3"/>',check:'<path d="m5 12 4 4L19 6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',edit:'<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',moon:'<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',award:'<circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/>',repeat:'<path d="M3 7h13a5 5 0 0 1 5 5M7 3 3 7l4 4M21 17H8a5 5 0 0 1-5-5m14 1 4 4-4 4"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.book}</svg>`;
const openPanels=new Set();
let collectionTab='lessons',refreshFlow=null;
let profile,sharing,cloudWait,ready=false,store,sync,confusions,screen='learn',classroomQuery='',collectionFilter='all',search='',selected=[],modalCleanup=null,toastTimer,working=false,pendingStart=null,announcementQueue=[],announcementLoading=false;
const app=document.querySelector('#app'),modalRoot=document.querySelector('#modal-root');
const isAdmin=()=>profile?.role==='admin';
const data=()=>store.data;
function autoUpdate(){if(ready&&updates.state==='available'&&!working&&!cloudWait?.blocked&&!modalRoot.children.length&&!['test','match'].includes(screen)&&!sync.busy&&!sharing?.busy&&!store.doc.pending.length)void updates.apply();}
async function showResult(){const saved=store.doc.session;if(saved?.mode==='inactive-check'&&saved.finished&&saved.refreshSavedCount===undefined){const session=clone(saved);await store.commit([finishRefresh(data(),session)],session);sync.schedule(0);}screen='result';render();void backgroundSync();}
async function backgroundSync(){if(!ready||cloudWait?.blocked)return;try{await settleSync(sync,store);if(!working&&!modalRoot.children.length&&!['test','match'].includes(screen))render();}catch{}finally{updateStatus();}}

const prefs=()=>({daily:10,typos:true,direction:'mixed',...data().settings.general,theme:'system',accent:'green',density:'comfortable',design:'rounded'});
const allWords=()=>Object.values(data().words).filter(w=>data().collections[w.collectionId]);
const activeWords=()=>wordsForDecks(data(),trainingDecks(data()).filter(d=>d.active).map(d=>d.id));
function notify(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);}
function theme(){const p=prefs();document.documentElement.dataset.subject=subject;document.documentElement.dataset.theme=p.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p.theme;document.documentElement.dataset.accent=p.accent||'green';document.documentElement.dataset.density=p.density||'comfortable';document.documentElement.dataset.design=p.design||'rounded';}
function nav(){return `<nav aria-label="Hauptmenü">${[['learn','home','Lernen'],['collections','book','Sammlungen'],['classroom','search','Unterricht'],['settings','settings','Einstellungen']].map(([id,i,label])=>`<button data-action="nav" data-screen="${id}" class="nav-item ${(screen===id||id==='collections'&&screen==='collection-detail')?'active':''}" ${screen===id?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;}
function todayCount(){const today=new Date().toLocaleDateString('sv');return Object.values(data().reviews).filter(r=>!r.repeat&&!r.manualKnown&&new Date(r.at).toLocaleDateString('sv')===today).length;}
function statusMarkup(){const doc=store.doc;const label=({checking:'Cloud wird geprüft',loading:'Cloud wird geladen',uploading:'Wird gespeichert',synced:'Gespeichert',newer:'Cloud wird geladen',offline:'Offline',error:'Verbindung prüfen'})[sync.status]||'Cloud';return `<button class="sync-indicator ${sync.status}" data-action="sync-info" title="${h(label)}">${icon('cloud',sync.busy?'pulse':'')}<span>${h(label)}</span></button>`;}
function updateStatus(){setTimeout(autoUpdate,0);document.querySelectorAll('[data-sync]').forEach(el=>el.innerHTML=statusMarkup());const detail=document.querySelector('[data-sync-details]');if(detail)detail.innerHTML=syncDetails();}
function render(){theme();if(screen==='match'){app.innerHTML=confusions.view();return;}if(screen==='test'){renderTest();return;}if(screen==='result'){renderResult();return;}if(screen==='progressive-summary'){renderProgressiveSummary();return;}
  app.innerHTML=`<aside class="sidebar"><button class="brand brand-switch" data-action="subject-menu" aria-label="Lernfach wechseln">latinio<span>✦</span></button>${nav()}<div class="sidebar-foot"><div class="language-tag">${english?'EN ↔ DE':'LA → DE'}</div><p>Ein bisschen ${english?'Englisch':'Latein'}.<br>Jeden Tag.</p><span class="muted small">App ${APP_VERSION}</span></div></aside><div class="workspace"><header class="topbar"><button class="mobile-brand brand" aria-label="Latinio">latinio<span>✦</span></button><span class="desktop-only muted">Dein ${english?'Englisch':'Latein'}training</span><details class="subject-dropdown"><summary>${english?'Englisch':'Latein'} <span aria-hidden="true">▾</span></summary><div class="subject-options"><button data-action="switch-subject" data-id="latin">Latein${!english?' · aktuell':''}</button><button data-action="switch-subject" data-id="english">Englisch${english?' · aktuell':''}</button></div></details></header><main class="content">${screen==='learn'?learnView():screen==='collections'?collectionsView():screen==='collection-detail'?collectionDetailView():screen==='classroom'?classroomView(data(),classroomQuery,h,english):settingsView()}</main></div><div class="mobile-nav">${nav()}</div>`;
 app.querySelectorAll('details[data-panel]').forEach(el=>{el.open=openPanels.has(el.dataset.panel);});
}
function learnView(){const d=data(),words=activeWords();const status=w=>{const list=english?directionsFor(prefs().direction).map(dir=>progressFor(w.id,d.reviews,dir)):[progressFor(w.id,d.reviews)];return {level:list.every(p=>p.level==='known')?'known':list.some(p=>p.seen)?'learning':'new',due:list.some(p=>p.seen&&p.due<=Date.now())};};const known=words.filter(w=>status(w).level==='known').length;const due=words.filter(w=>status(w).due).length;const count=todayCount(),goal=prefs().daily;const decks=trainingDecks(d).filter(x=>x.active);selected=selected.filter(id=>decks.some(x=>x.id===id));if(!selected.length)selected=decks.map(x=>x.id);
 return `<div class="page-heading"><div><div class="eyebrow">DEIN SMARTES TRAINING</div><h1>Hallo ${h(isAdmin()?'Tiago':profile.name)}!</h1><p class="muted" data-compact-hide>Kleine Schritte. Immer mehr im Kopf.</p></div><div class="daily-badge">${icon('bolt')}<strong>${count}</strong><span>heute</span></div></div>
 <div class="learning-grid"><div class="primary-column"><section class="training-card"><div class="section-top"><span class="tag">${english?directionLabel(prefs().direction).toUpperCase():'LATEIN → DEUTSCH'}</span>${icon('book','large-icon')}</div><h2>Das weißt du bald<br>wieder.</h2><p data-compact-hide>Übe neue Wörter und frische auf,<br>was noch nicht ganz sitzt.</p>${english?`<label class="direction-choice">Abfragerichtung<select id="direction"><option value="mixed" ${prefs().direction==='mixed'?'selected':''}>Gemischt · schwierige Richtung zuerst</option><option value="en-de" ${prefs().direction==='en-de'?'selected':''}>Englisch → Deutsch</option><option value="de-en" ${prefs().direction==='de-en'?'selected':''}>Deutsch → Englisch</option></select></label>`:''}<details data-panel="home-decks" class="deck-picker"><summary>Trainingsauswahl · ${decks.length} aktive Sammlungen</summary><div class="bounded-list">${decks.map(c=>`<label class="collection-check"><input type="checkbox" data-select="${h(c.id)}" ${selected.includes(c.id)?'checked':''}><span>${h(c.name)}</span><small>${wordsForDecks(d,[c.id]).length} Wörter</small></label>`).join('')||'<p>Keine aktive Sammlung. Schalte unter Sammlungen die gewünschten Lektionen ein.</p>'}</div></details><div class="word-tools"><button class="button primary wide" data-action="start" ${!words.length?'disabled':''}>Smartes Üben ${icon('arrow')}</button><button class="button secondary wide" data-action="training-options" ${!words.length?'disabled':''}>Mehr Optionen ${icon('plus')}</button></div><div class="card-foot">${icon('target')} ${goal} Aufgaben pro Runde · beliebig weiterüben</div></section>
 <section class="progress-section"><div class="section-top"><h2>Dein Wortschatz wächst</h2><span class="muted small">${words.length} Vokabeln</span></div><div class="stats-row"><div class="stat"><span class="stat-icon green">${icon('check')}</span><strong>${known}</strong><span>Schon sicher</span></div><div class="stat"><span class="stat-icon purple">${icon('repeat')}</span><strong>${words.filter(w=>status(w).level==='learning').length}</strong><span>Im Training</span></div><div class="stat"><span class="stat-icon orange">${icon('book')}</span><strong>${words.filter(w=>status(w).level==='new').length}</strong><span>Noch neu</span></div></div></section></div>
 <aside class="secondary-column"><section class="card goal-card"><div class="section-top"><h3>Dein Tagesziel</h3>${icon('target')}</div><div class="goal-ring" style="--progress:${Math.min(100,count/goal*100)}%"><div><strong>${count}<span> / ${goal}</span></strong><small>Vokabeln</small></div></div><p>${count>=goal?'Tagesziel geschafft. Bene!':'Ein guter Tag für einen kleinen Fortschritt.'}</p></section><section class="card reminder-card"><span class="stat-icon purple">${icon('repeat')}</span><h3>${due?`${due} Wörter sind wieder dran`:'Wiederholen, wenn es zählt'}</h3><p class="muted" data-compact-hide>Unsichere Wörter öfter wiederholen.</p></section><button class="card collection-link" data-action="nav" data-screen="collections"><span>${icon('book')} Deine Sammlungen</span>${icon('arrow')}</button></aside></div>`;
}
function collectionsView(){const d=data(),recoverable=typeof store==='undefined'?[]:(store.doc.deletedCollections||[]).filter(item=>item.expiresAt>Date.now());return `<div class="page-heading"><h1>Sammlungen</h1></div><label class="search-field collection-search">${icon('search')}<input id="search" placeholder="Alle Vokabeln durchsuchen" value="${h(search)}" aria-label="Vokabel suchen"></label><section id="collection-search-results" class="bounded-list">${search.trim()?wordRows('all',search):''}</section><div class="button-row section-tabs"><button class="chip ${collectionTab==='lessons'?'selected':''}" data-action="collection-tab" data-id="lessons">Lektionen</button><button class="chip ${collectionTab==='refresh'?'selected':''}" data-action="collection-tab" data-id="refresh">Auffrischen</button></div>${recoverable.length?`<section class="card deleted-collections"><h2>Zuletzt gelöscht</h2><p class="small muted">Sammlungen lassen sich auf diesem Gerät bis zu sieben Tage lang wiederherstellen.</p>${recoverable.map(item=>`<div class="deleted-collection-row"><span><strong>${h(item.name)}</strong><small>Verfügbar bis ${h(new Date(item.expiresAt).toLocaleDateString('de-DE'))}</small></span><button class="button secondary" data-action="restore-collection" data-id="${h(item.id)}">Rückgängig</button></div>`).join('')}</section>`:''}${collectionTab==='refresh'?refreshList(d,h,icon):collectionLearningView(d)}<div class="collection-footer">${sharing.toolbar()}<button class="button secondary" data-action="confusion-manage">Verwechslungen verwalten</button></div>`;}
function collectionLearningView(d){return `<section class="card collection-learning">${collectionToolbar()}<div class="bounded-list">${sortedCollections(d).map(c=>collectionRow(c,collectionActive(d,c.id),false,h,icon)).join('')||'<p class="muted">Noch keine Lektionen.</p>'}</div></section>`;}
function reconciliationChanges(result,deckId){return [['settings',deckId,result.deck],...result.removeWordIds.map(id=>['words',id,null]),...result.removeCollectionIds.map(id=>['collections',id,null])];}
function collectionDetailView(){const c=data().collections[collectionFilter]||data().settings[collectionFilter],refresh=c?.kind==='refreshDeck',legacy=refresh?legacyRefreshCount(data(),c.id):0;if(!c)return '<p>Sammlung nicht mehr vorhanden.</p><button class="button secondary" data-action="nav" data-screen="collections">Zurück</button>';return `<button class="text-button" data-action="nav" data-screen="collections">← Sammlungen</button><div class="page-heading collection-detail-heading"><div class="collection-title"><h1>${h(c.name)}</h1><button class="icon-button" data-action="rename-collection" data-id="${h(c.id)}" aria-label="Sammlung umbenennen">${icon('edit')}</button></div><button class="button primary" data-action="${refresh?'check-picker':'new-word'}" data-id="${h(c.id)}">${icon('plus')} Vokabeln hinzufügen</button></div><button class="text-button danger-text" data-action="${refresh?'refresh-delete':'delete-collection'}" data-id="${h(c.id)}">Sammlung löschen</button>${legacy?`<section class="card refresh-reconcile"><h2>Ältere Vokabeleinträge</h2><p class="small muted">${legacy} Einträge können noch mit den Vokabeln deiner Lektionen abgeglichen werden.</p><button class="button secondary" data-action="refresh-reconcile" data-id="${h(c.id)}">Auffrisch-Vokabeln überprüfen</button></section>`:''}<label class="search-field collection-search">${icon('search')}<input id="search" placeholder="In dieser Sammlung suchen" value="${h(search)}" aria-label="Vokabel suchen"></label><section class="word-list" id="word-list">${wordRows()}</section>`;}
async function setActivity(ids,active){
 const changed=ids.filter(id=>collectionActive(data(),id)!==active);
 if(!changed.length){render();return;}
 const s=store.doc.session;
 const affected=!active&&s&&!s.finished&&!s.mode?.startsWith('inactive-')&&s.queue.slice(s.cursor).some(x=>changed.includes(data().words[x.wordId]?.collectionId));
 const matchAffected=!active&&store.doc.matchRound?.words.some(w=>changed.includes(w.collectionId));
 if((affected||matchAffected)&&!confirm('Eine angefangene Runde enthält diese Sammlung und wird beendet. Bereits gespeicherte Antworten bleiben erhalten. Fortfahren?')){render();return;}
 await store.commit(changed.map(id=>['settings',activityKey(id),{kind:'collectionActivity',active}]));
 if(affected||matchAffected)await store.update(doc=>{if(affected)doc.session=null;if(matchAffected)doc.matchRound=null;return doc;});
 selected=selected.filter(id=>collectionActive(data(),id));sync.schedule();render();
}
function wordRows(filter=collectionFilter,query=search){const d=data(),deck=d.settings[filter]?.kind==='refreshDeck'?d.settings[filter]:null,members=new Set(deckMembers(d,deck).map(m=>m.wordId)),pending=new Set(english&&deck?directionsFor(deck.direction).flatMap(dir=>pendingMembers(d,deck,dir).map(m=>m.wordId)):pendingMembers(d,deck).map(m=>m.wordId));const items=allWords().filter(w=>(deck?members.has(w.id):filter==='all'||w.collectionId===filter)&&normalize(w.latin+' '+w.meanings.flat().join(' ')).includes(normalize(query)));return items.map(w=>{const progress=english?directionsFor(deck?.direction||prefs().direction).map(dir=>progressFor(w.id,d.reviews,dir)):[progressFor(w.id,d.reviews)],level=deck&&!pending.has(w.id)?'known':progress.every(p=>p.level==='known')?'known':progress.some(p=>p.seen)?'learning':'new';return `<article class="word-row"><div><strong>${h(w.latin)}</strong><span class="small muted">${h(d.collections[w.collectionId]?.name)}</span></div><p>${w.meanings.map(g=>h(g.join(' / '))).join(' · ')}</p><span class="word-level ${level}">${{new:'Neu',learning:'Im Training',known:'Sicher'}[level]}${deck&&pending.has(w.id)?' · Offen':''}</span><button class="icon-button" aria-label="${h(w.latin)} ${deck?'aus Auffrisch-Sammlung entfernen':'bearbeiten'}" data-action="${deck?'refresh-remove-word':'edit-word'}" data-id="${h(w.id)}">${icon(deck?'trash':'edit')}</button></article>`;}).join('')||'<div class="empty-state"><p class="muted">Keine Vokabeln gefunden.</p></div>';}
function syncDetails(){const doc=store.doc;return `<div class="sync-box"><p class="sync-state">${icon('cloud')} ${h(sync.message)}</p><dl><div><dt>Bestätigter Gerätestand</dt><dd>v${doc.base}</dd></div><div><dt>Cloud-Version</dt><dd>${sync.cloudVersion===null?'Noch nicht geprüft':'v'+sync.cloudVersion}</dd></div><div><dt>Lokale Änderungen</dt><dd>${doc.pending.length} ausstehend</dd></div><div><dt>Lokaler Änderungszähler</dt><dd>${doc.seq}</dd></div><div><dt>Letzter Abgleich</dt><dd>${doc.lastSync?h(new Date(doc.lastSync).toLocaleString('de-DE')):'Noch keiner'}</dd></div></dl>${sync.busy?'<div class="indeterminate" role="progressbar" aria-label="Synchronisierung läuft"></div>':''}</div>`;}
function updateView(){const busy=['checking','installing'].includes(updates.state);return `<h2>App-Updates</h2><p class="small muted">Installierte Version: ${APP_VERSION}</p><p role="status" class="update-message">${h(updates.message)}</p><button type="button" class="button ${updates.state==='available'?'primary':'secondary'} wide" data-action="${updates.state==='available'?'apply-update':'check-update'}" ${busy?'disabled':''}>${icon('repeat')} ${updates.state==='available'?'Jetzt aktualisieren':busy?'Bitte warten …':'Nach Updates suchen'}</button>`;}
updates.addEventListener('change',()=>{const area=document.querySelector('[data-app-updates]');if(area)area.innerHTML=updateView();autoUpdate();});
function settingsView(){const p=prefs();return `<div class="page-heading"><div><div class="eyebrow">SO LERNST DU</div><h1>Einstellungen</h1><p class="muted" data-compact-hide>Dein Tempo. Deine App.</p></div></div><div class="settings-grid">${accountCard(profile)}<details data-panel="updates" class="card compact-panel"><summary>App-Updates</summary><div data-app-updates>${updateView()}</div></details><details data-panel="appearance" class="card compact-panel"><summary>Training</summary><label class="setting-row"><span><strong>Tagesziel</strong><small data-compact-hide>Rundengröße und Tagesziel · kein Tageslimit</small></span><select id="daily">${[5,10,15,20,30].map(n=>`<option value="${n}" ${p.daily===n?'selected':''}>${n} Wörter</option>`).join('')}</select></label><label class="setting-row"><span><strong>Tippfehler tolerieren</strong><small data-compact-hide>Deutsche Tippfehler tolerieren; Englisch wird streng bewertet.<br>Du kannst jede Bewertung korrigieren.</small></span><input class="switch" id="typos" type="checkbox" ${p.typos?'checked':''}></label></details><details data-panel="import" class="card compact-panel"><summary>Vokabeln & Installation</summary><button class="button secondary wide" data-action="import">${icon('upload')} Sammlung importieren</button><button class="text-button" data-action="download-example">Beispiel für das Importformat</button><div class="divider"></div><h3>Auf deinem iPhone</h3><p class="muted">Safari → Teilen → Zum Home-Bildschirm.</p></details>${isAdmin()?`<details data-panel="cloud" class="card cloud-settings compact-panel"><summary>Cloud & Versionen</summary><div data-sync-details>${syncDetails()}</div><div class="button-row"><button class="button secondary" data-action="sync-now" ${!sync.configured?'disabled':''}>${icon('repeat')} Jetzt abgleichen</button>${sync.remote?'<button class="button primary" data-action="remote">Cloud-Version ansehen</button>':''}</div><div class="divider"></div><h3>Nachrichten an Nutzer</h3><p class="small muted">Einmalige Hinweise an einen Nutzer oder alle Profile senden.</p><div class="word-tools"><button class="button secondary wide" data-action="announcement-compose">Nachricht verfassen</button><button class="button secondary wide" data-action="announcement-history">Gesendete Nachrichten & Lesestatus</button></div></details>`:''}</div><p class="small muted app-version">Latinio ${APP_VERSION} · ${english?'Englisch ↔ Deutsch':'Latein → Deutsch'}</p>`;}
function showModal(content,closable=true){const previous=document.activeElement;modalCleanup?.();modalRoot.innerHTML=`<div class="modal-overlay"><section role="dialog" aria-modal="true" class="modal" aria-labelledby="modal-title">${closable?`<button class="icon-button modal-close" data-action="close-modal" aria-label="Schließen">${icon('close')}</button>`:''}${content}</section></div>`;
  const listener=e=>{if(cloudWait?.blocked)return;if(e.key==='Escape'&&closable)closeModal();if(e.key==='Tab'){const nodes=[...modalRoot.querySelectorAll('button,input,select,textarea,a[href]')].filter(n=>!n.disabled);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?…6994 tokens truncated…e 'subject-menu':showModal(`<h2 id="modal-title">Was möchtest du lernen?</h2><div class="word-tools"><button class="button ${!english?'primary':'secondary'} wide" data-action="switch-subject" data-id="latin">Latein → Deutsch${!english?' · aktuell':''}</button><button class="button ${english?'primary':'secondary'} wide" data-action="switch-subject" data-id="english">Englisch ↔ Deutsch${english?' · aktuell':''}</button></div><p class="small muted">Jedes Fach hat eigene Sammlungen, Lernstände und einen getrennten Cloud-Stand. Englisch wird erst beim Wechsel geladen.</p>`);break;
 case 'switch-subject':{button.closest('details')?.removeAttribute('open');if(id===subject){closeModal();break;}const url=new URL(location.href);if(id==='english')url.searchParams.set('subject','english');else url.searchParams.delete('subject');location.assign(url.href);break;}
 case 'announcement-compose':await composeAnnouncement();break;
 case 'announcement-history':await showAnnouncementHistory();break;
 case 'announcement-preview':{const item=announcementHistory.find(a=>a.id===id);if(item)announcementView(item,true);break;}
 case 'announcement-next':{const item=announcementQueue[0];if(!item||item.id!==id)break;await sync.request('announcementRead',{announcementId:id});announcementQueue.shift();if(announcementQueue.length)announcementView(announcementQueue[0]);else closeModal();break;}
 case 'collection-open':collectionFilter=id;search='';screen='collection-detail';render();break;
 case 'collection-tab':collectionTab=id;render();break;
 case 'refresh-new':showModal(refreshCreate(english));break;
 case 'check-picker':refreshFlow={target:id,sourceIds:[],direction:data().settings[id]?.direction||'both'};showModal(checkPicker(data(),h,id));break;
 case 'refresh-select-back':showModal(checkPicker(data(),h,refreshFlow.target,refreshFlow.sourceIds));break;
 case 'refresh-select-manual':showModal(refreshEditor(data(),{id:refreshFlow.target,merge:true,sourceIds:refreshFlow.sourceIds},h));break;
 case 'refresh-select-test':await start('inactive-check',refreshFlow.sourceIds,refreshFlow.target);break;
 case 'refresh-card-flip':{const {session}=current();if(session?.mode!=='inactive-check'||session.finished)break;await store.update(doc=>{doc.session.cardFlipped=!doc.session.cardFlipped;return doc;});render();break;}
 case 'refresh-card-known':case 'refresh-card-wrong':if(String(current().session?.cursor)===button.dataset.cursor)await rateCard(action==='refresh-card-known');break;
 case 'refresh-remove-word':{const deck=data().settings[collectionFilter];if(deck?.kind!=='refreshDeck')break;await store.commit([['settings',deck.id,{...deck,members:deck.members.filter(m=>m.wordId!==id)}]]);sync.schedule();render();break;}
 case 'refresh-tools':collectionFilter=id;search='';screen='collection-detail';render();break;
 case 'refresh-reconcile':{const result=reconcileRefreshDeck(data(),id);if(result.changed){await store.commit(reconciliationChanges(result,id));sync.schedule();}if(result.unmatched.length){showModal(refreshReconcileEditor(result,id,h));}else{render();notify(result.automatic||result.removedDuplicates?`${result.automatic} Vokabeln zugeordnet${result.removedDuplicates?` · ${result.removedDuplicates} doppelte Einträge entfernt`:''}.`:'Keine doppelten Vokabeleinträge gefunden.');}break;}
 case 'refresh-activity-all':{const active=button.dataset.active==='true';const edits=refreshDecks(data()).filter(d=>(d.active!==false)!==active).map(d=>['settings',d.id,{...d,active}]);if(edits.length)await store.commit(edits);sync.schedule();render();break;}
 case 'refresh-add-word':showModal(refreshEditor(data(),{selected:[id],merge:true},h));break;
 case 'refresh-legacy':showModal(refreshEditor(data(),{selected:forgottenWords(data()).map(w=>w.id),merge:true,name:'Bisherige Auffrisch-Wörter'},h));break;
 case 'refresh-check':refreshFlow={target:id,sourceIds:[id],direction:data().settings[id]?.direction||'both'};await start('inactive-check',[id]);break;
 case 'refresh-delete':{if(!confirm('Auffrisch-Sammlung löschen? Die Originalwörter und Lernstände bleiben erhalten.'))break;await store.commit([['settings',id,null]]);closeModal();screen='collections';collectionTab='refresh';collectionFilter='all';sync.schedule();render();break;}
 case 'activity-all':await setActivity(sortedCollections(data()).map(c=>c.id),button.dataset.active==='true');break;
 case 'inactive-practice':await start('inactive-practice',[]);break;
 case 'account-logout':signOut();break;
 case 'check-update':await updates.check();break;
 case 'apply-update':await updates.apply();break;
 case 'nav':screen=button.dataset.screen;if(screen==='collections'){collectionFilter='all';search='';}closeModal();render();break;
 case 'start':await start();break;
 case 'confirm-start':{const pending=pendingStart;if(!pending)break;const requirement=document.querySelector('#round-require-all')?.checked?'all':'any';pendingStart=null;await store.commit([['settings','general',{...prefs(),meaningRequirement:requirement}]]);sync.schedule();await start(pending.mode,pending.ids,pending.refreshTarget,requirement);break;}
 case 'training-options':trainingOptions();break;
 case 'start-all':await start('all');break;
 case 'start-progressive':await start('progressive');break;
 case 'start-learning':await start('learning');break;
 case 'start-refresh':await start('refresh');break;
 case 'pause':await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});screen='learn';render();break;
 case 'finish':await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});screen='learn';render();break;
 case 'progressive-next-stage':await nextProgressiveStage();break;
 case 'next':await next();break;
 case 'retry-submit':await submitCorrection();break;
 case 'practice-add':appendCorrectionField();break;
 case 'dont-know':await checkAnswer(true);break;
 case 'add-answer':appendAnswerField(document,answerInput);break;
 case 'remove-answer':button.closest('.answer-row').remove();break;
 case 'correct-evaluation':{const {session,word,item}=current();const index=Number(button.dataset.index);showModal(evaluationCorrection(english?answerWord(word,item.direction):word,index,session.overrides[index]));break;}
 case 'filter':collectionFilter=id;render();break;
 case 'edit-word':case 'new-word':case 'edit-word-fields':if(screen==='test'&&!store.doc.session.feedback){const answers=readAnswers();await store.update(doc=>{doc.session.answers=answers;return doc;});}if(action==='edit-word'&&screen==='test'){showModal(`<h2 id="modal-title">${h(data().words[id]?.latin)}</h2><div class="word-tools"><button class="button primary wide" data-action="confusion-manage" data-id="${h(id)}">${icon('repeat')} Verwechslungsgefahr einstellen</button><button class="button secondary wide" data-action="refresh-add-word" data-id="${h(id)}">Zur Auffrisch-Sammlung hinzufügen</button><button class="button secondary wide" data-action="edit-word-fields" data-id="${h(id)}">${icon('edit')} Vokabeleintrag bearbeiten</button></div>`);}else wordModal(id);break;
 case 'add-meaning':document.querySelector('#meaning-inputs').insertAdjacentHTML('beforeend',meaningInput());document.querySelector('#meaning-inputs').lastElementChild.querySelector('input').focus();break;
 case 'remove-meaning':if(document.querySelectorAll('.meaning-input').length>1)button.closest('.meaning-input').remove();break;
 case 'delete-word':{const w=data().words[id];showModal(`<h2 id="modal-title">Vokabel löschen?</h2><p>„${h(w.latin)}“ wird aus deiner Sammlung entfernt.</p><button class="button danger wide" data-action="confirm-delete-word" data-id="${h(id)}">Vokabel löschen</button>`);break;}
 case 'confirm-delete-word':await store.commit([['words',id,null]]);closeModal();sync.schedule();render();notify('Vokabel gelöscht.');break;
 case 'new-collection':case 'rename-collection':showModal(`<h2 id="modal-title">${id?'Sammlung umbenennen':'Neue Sammlung'}</h2><form id="collection-form" data-id="${h(id||uid())}"><label>Name<input name="name" required maxlength="100" value="${h((data().collections[id]||data().settings[id])?.name||'')}" placeholder="Lektion 11–18"></label><button type="submit" class="button primary wide">Speichern</button></form>`);break;
 case 'delete-collection':showModal(`<h2 id="modal-title">Sammlung löschen?</h2><p>„${h(data().collections[id].name)}“ und ihre Vokabeln werden auf allen verbundenen Geräten entfernt, sobald sie synchronisiert sind.</p><button class="button danger wide" data-action="confirm-delete-collection" data-id="${h(id)}">Sammlung löschen</button>`);break;
 case 'confirm-delete-collection':{const words=Object.values(data().words).filter(w=>w.collectionId===id);await store.commit([['collections',id,null],...words.map(w=>['words',w.id,null])]);collectionFilter='all';screen='collections';closeModal();sync.schedule();render();break;}
 case 'restore-collection':{const restored=await store.restoreDeletedCollection(id);collectionTab=restored.entity==='settings'?'refresh':'lessons';collectionFilter='all';screen='collections';sync.schedule();render();notify(`„${restored.name}“ wurde wiederhergestellt.`);break;}
 case 'import':importModal();break;
 case 'confirm-import':{if(!importCandidate)break;if(importCandidate.unmatched?.length)throw Error('Bitte ordne erst alle angezeigten Vokabeln zu.');const x=importCandidate;await store.commit(importChanges(x));importCandidate=null;importRaw=null;closeModal();screen='collections';collectionTab=x.deck?'refresh':'lessons';collectionFilter=x.deck?.id||x.collection.id;sync.schedule();render();notify(`${x.deck?x.deck.members.length:x.words.length} Vokabeln importiert.`);break;}
 case 'theme':await changePrefs({theme:id});break;
 case 'sync-info':screen='settings';render();break;
 case 'sync-now':void loadCloud();break;
 case 'remote':void loadCloud();break;
 case 'close-modal':closeModal();break;
 case 'download-example':{const example={format:'latinio-collection',schema:1,name:'Meine neue Sammlung',words:english?[{english:'hello',german:['hallo']}]:[{latin:'exemplum',meanings:[['Beispiel']],forms:['exempla','exemplorum','exemplis']}]};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(example,null,2)],{type:'application/json'}));a.download=english?'latinio-englisch-beispiel.json':'latinio-import-beispiel.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);break;}
 }}catch(error){notify(error.message);}finally{working=false;void sharing?.afterAction();autoUpdate();}}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-action="add-answer"]');
 if(!button||!ready||working||cloudWait?.blocked||screen!=='test'||current().session?.feedback)return;
 event.preventDefault();event.stopImmediatePropagation();
 appendAnswerField(document,answerInput);
},true);
document.addEventListener('click',actions);
installKeyboardSupport({root:document,active:()=>ready&&!working&&!cloudWait?.blocked&&!modalRoot.children.length&&screen==='test',session:()=>current().session,submit:()=>document.querySelector('#answer-form')?.requestSubmit?.(),next:()=>document.querySelector('#answer-form [data-action="next"]')?.click(),addField:()=>document.querySelector('#answer-form [data-action="add-answer"]')?.click(),addCorrectionField:appendCorrectionField,beginCorrection,submitCorrection,rateCard:known=>document.querySelector(`[data-action="refresh-card-${known?'known':'wrong'}"]`)?.click()});
document.addEventListener('toggle',event=>{const el=event.target;if(el.dataset?.panel&&el.isConnected){if(el.open)openPanels.add(el.dataset.panel);else openPanels.delete(el.dataset.panel);}},true);
document.addEventListener('input',event=>{if(event.target.dataset.reconcileSearch!==undefined){const select=document.getElementById(`reconcile-select-${event.target.dataset.reconcileSearch}`),q=normalize(event.target.value),suggestions=JSON.parse(event.target.dataset.candidates||'[]'),available=Object.values(data().words).filter(w=>data().collections[w.collectionId]&&!data().collections[w.collectionId].refreshSource).map(w=>({id:w.id,latin:w.latin,collection:data().collections[w.collectionId].name,meanings:w.meanings}));if(select){const options=q?available.filter(w=>normalize(`${w.latin} ${w.meanings.flat().join(' ')} ${w.collection}`).includes(q)).slice(0,50):suggestions;select.innerHTML=`<option value="">Nicht zuordnen</option>${options.length?`<optgroup label="${q?'Suchtreffer':'Mögliche Treffer'}">${options.map(w=>`<option value="${h(w.id)}">${h(w.latin)} · ${h(w.collection)}</option>`).join('')}</optgroup>`:''}`;}}if(event.target.id==='refresh-word-search'){const q=normalize(event.target.value);document.querySelectorAll('[data-refresh-word-row]').forEach(row=>row.hidden=!normalize(row.textContent).includes(q));}if(event.target.id==='classroom-search'){classroomQuery=event.target.value;document.querySelector('#classroom-results').innerHTML=classroomResults(data(),classroomQuery,h,english);}if(event.target.id==='search'){search=event.target.value;const results=document.querySelector('#collection-search-results');if(results)results.innerHTML=search.trim()?wordRows('all',search):'';else document.querySelector('#word-list').innerHTML=wordRows();}});
document.addEventListener('change',async event=>{const el=event.target;try{
 if(el.id==='collection-select'){collectionFilter=el.value;render();}
 
 if(el.dataset.importResolve!==undefined){importResolutions[el.dataset.importResolve]=el.value;renderImportPreview();return;}
 if(el.dataset.refreshActive){const deck=data().settings[el.dataset.refreshActive];if(deck){await store.commit([['settings',deck.id,{...deck,active:el.checked}]]);sync.schedule();render();}}
 if(el.name==='target'&&el.closest('#refresh-form')){const label=document.querySelector('#refresh-name-label');label.hidden=!!el.value;label.querySelector('input').required=!el.value;}
 if(el.name==='word'&&el.closest('#refresh-form'))document.querySelector('#refresh-selected-count').textContent=document.querySelectorAll('#refresh-form [name=word]:checked').length+' Wörter ausgewählt';
 if(el.dataset.activity){await setActivity([el.dataset.activity],el.checked);}
 if(el.dataset.select){selected=[...document.querySelectorAll('[data-select]:checked')].map(e=>e.dataset.select);}
 if(el.id==='daily')await changePrefs({daily:Number(el.value)});
 if(el.id==='direction')await changePrefs({direction:el.value});
 if(el.id==='refresh-direction'&&refreshFlow){refreshFlow.direction=el.value;const deck=data().settings[refreshFlow.target];if(deck?.kind==='refreshDeck'){await store.commit([['settings',deck.id,{...deck,direction:el.value}]]);sync.schedule();}}
 if(el.id==='typos')await changePrefs({typos:el.checked});
 if(el.id==='import-file'&&el.files[0]){if(el.files[0].size>3000000)throw Error('Bitte eine Datei unter 3 MB auswählen.');importRaw=JSON.parse(await el.files[0].text());importResolutions={};renderImportPreview();}
 }catch(error){importCandidate=null;importRaw=null;notify(error.message);}});
document.addEventListener('submit',async event=>{event.preventDefault();if(!ready||working||cloudWait?.blocked)return;working=true;const form=event.target;const fd=new FormData(form);try{
 if(await sharing.submit(form))return;
 if(form.id==='check-picker-form'){const ids=fd.getAll('lesson');if(!ids.length)throw Error('Wähle mindestens eine Lektion aus.');refreshFlow={target:form.dataset.target,sourceIds:ids,direction:refreshFlow?.direction||'both'};showModal(refreshMethod(english,refreshFlow.direction));}
 if(form.id==='refresh-create-form'){const id='refresh_'+uid();const deck={...saveDeck(data(),null,id,String(fd.get('name')||''),[]),...(english?{direction:String(fd.get('direction')||'both')}: {})};await store.commit([['settings',id,deck]]);collectionTab='refresh';collectionFilter=id;search='';screen='collection-detail';closeModal();sync.schedule();render();refreshFlow={target:id,sourceIds:[],direction:deck.direction||'both'};showModal(checkPicker(data(),h,id));}
 if(form.id==='refresh-form'){
  const target=form.dataset.id||fd.get('target')||'refresh_'+uid(),existing=data().settings[target];
  const chosen=fd.getAll('word');
  const ids=form.dataset.merge==='true'?[...(existing?.members||[]).map(m=>m.wordId),...chosen]:chosen;
  let deck={...saveDeck(data(),existing,target,fd.get('target')?existing.name:String(fd.get('name')||''),ids),...(english?{direction:existing?.direction||refreshFlow?.direction||'both'}:{})};
  // Explicitly adding a previously completed word starts a new practice cycle.
  if(form.dataset.merge==='true'){const pending=new Set(pendingMembers(data(),existing).map(m=>m.wordId));deck.members=deck.members.map(m=>chosen.includes(m.wordId)&&!pending.has(m.wordId)?{...m,addedAt:Date.now()}:m);}
  await store.commit([['settings',target,deck]]);sync.schedule();closeModal();collectionFilter=target;collectionTab='refresh';search='';screen='collection-detail';render();notify('Gespeichert.');
 }
 if(form.id==='refresh-reconcile-form'){
  const resolutions={};form.querySelectorAll('select[name^="legacy-"]').forEach(el=>{if(el.value)resolutions[el.name.slice(7)]=el.value;});
  const result=reconcileRefreshDeck(data(),form.dataset.id,resolutions);if(result.changed){await store.commit(reconciliationChanges(result,form.dataset.id));sync.schedule();}
  if(result.unmatched.length){showModal(refreshReconcileEditor(result,form.dataset.id,h));if(result.manual)notify(`${result.manual} manuelle ${result.manual===1?'Zuordnung':'Zuordnungen'} gespeichert. Noch ${result.unmatched.length} ungeklärt.`);}
  else{closeModal();render();if(result.manual||result.removedDuplicates)notify(`${result.manual} manuelle ${result.manual===1?'Zuordnung':'Zuordnungen'} gespeichert${result.removedDuplicates?` · ${result.removedDuplicates} doppelte Einträge entfernt`:''}.`);else notify('Prüfung abgeschlossen.');}
 }
 if(form.id==='answer-form')await checkAnswer();
 if(form.id==='evaluation-correction-form'){const {session}=current();session.overrides[form.dataset.index]=fd.getAll('group').map(Number);closeModal();await reevaluate();}
 if(form.id==='word-form'){
  const word={...data().words[form.dataset.id],id:form.dataset.id,forms:String(fd.get('forms')||'').split(',').map(f=>f.trim()).filter(Boolean),collectionId:fd.get('collectionId'),latin:fd.get('latin').trim(),meanings:fd.getAll('meaning').map(v=>v.split('/').map(x=>x.trim()).filter(Boolean)).filter(g=>g.length)};
  if(word.forms.length>300||word.forms.some(f=>f.length>100))throw Error('Höchstens 300 Suchformen mit je 100 Zeichen.');
  if(!word.latin||!word.meanings.length)throw Error((english?'Englisch':'Latein')+' und mindestens eine Bedeutung fehlen.');
  await store.commit([['words',word.id,word]]);closeModal();if(screen==='test'&&current().word?.id===word.id&&current().session.feedback){store.doc.session.overrides={};await reevaluate();}else render();sync.schedule();notify('Vokabel gespeichert.');
 }
 if(form.id==='collection-form'){const name=fd.get('name').trim();if(!name)throw Error('Bitte einen Namen eingeben.');const existing=data().settings[form.dataset.id];await store.commit([existing?.kind==='refreshDeck'?['settings',existing.id,{...existing,name}]:['collections',form.dataset.id,{id:form.dataset.id,name}]]);collectionFilter=form.dataset.id;search='';screen='collection-detail';closeModal();sync.schedule();render();}
 if(form.id==='remote-form'){
  const choices={};form.querySelectorAll('[data-conflict]').forEach(el=>choices[el.dataset.conflict]=el.value);form.querySelector('button').disabled=true;await sync.accept(choices);closeModal();render();notify('Cloud-Version geladen.');
 }
 if(form.id==='announcement-form'){
  form.querySelector('button').disabled=true;const result=await sync.request('announcementSend',{profileId:String(fd.get('profileId')),title:String(fd.get('title')),message:String(fd.get('message'))});closeModal();notify(`Nachricht gespeichert für ${result.announcement.profileId==='all'?'alle Nutzer':'den ausgewählten Nutzer'}.`);
 }
 }catch(error){notify(error.message);form.querySelectorAll('button').forEach(b=>b.disabled=false);}finally{working=false;void sharing?.afterAction();autoUpdate();}});
async function loadCloud(){await backgroundSync();}
async function boot(){try{
 ({store,profile}=await openAccount(app));
 if(profile.role!=='admin'&&Array.isArray(profile.allowedSubjects)&&!profile.allowedSubjects.includes(subject)){
  const allowed=profile.allowedSubjects;const fallback=allowed.includes(english?'latin':'english')?(english?'latin':'english'):allowed[0];
  if(fallback){const target=new URL(location.href);target.searchParams.set('subject',fallback);location.replace(target.href);return;}
 }
 if(english){const latinStore=store,config=latinStore.doc.config;store=await new Store().open(profile.id,'english');await store.update(doc=>{doc.config={...config};doc.profile=profile;doc.seeded=true;return doc;});latinStore.close();}
 await store.seed();await store.listDeletedCollections();if(store.doc.session||store.doc.matchRound)await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});sync=new Sync(store);
 sharing=sharingUI({store,sync,profile,h,showModal,closeModal,notify,render,openCollection:id=>{collectionFilter=id;search='';screen='collection-detail';closeModal();render();}});
 sync.addEventListener('subject-restricted',event=>{
  const allowed=event.allowedSubjects||[];const fallback=allowed.includes(english?'latin':'english')?(english?'latin':'english'):allowed[0];
  if(fallback){const target=new URL(location.href);target.searchParams.set('subject',fallback);location.replace(target.href);}
 });
 sync.addEventListener('subjects-updated',event=>{profile={...profile,allowedSubjects:event.allowedSubjects};updateActiveProfile(profile);});
 cloudWait=cloudGate({sync,store,name:isAdmin()?'Tiago':profile.name});
 confusions=confusionUI({store,sync,subject,h,showModal,closeModal,notify,go:target=>{if(target==='result')void showResult();else{screen=target;render();}},render});
 store.addEventListener('change',updateStatus);
 store.addEventListener('external',async()=>{if(screen==='test'||screen==='match'||screen==='progressive-summary'){await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});screen='learn';notify('Die laufende Runde wurde beendet. Bereits gespeicherte Antworten bleiben erhalten.');}render();});
 sync.addEventListener('change',updateStatus);
 sync.addEventListener('remote',()=>{if(!cloudWait.blocked)void loadCloud();});
 matchMedia('(prefers-color-scheme: dark)').addEventListener('change',theme);
 render();await cloudWait.run('Wir bereiten alles vor.');ready=true;render();await store.recordActivity('opened');sync.schedule();void checkAnnouncements();
 async function resume(){if(!ready||document.hidden)return;await store.recordActivity('opened');await loadCloud();if(screen==='learn'||screen==='collections'||screen==='collection-detail'||screen==='settings')void checkAnnouncements();void updates.check();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(screen==='test'&&!store.doc.session?.feedback)void preserveTestDraft(store,screen,readAnswers());}else void resume();});
 window.addEventListener('pageshow',event=>{if(event.persisted)void resume();});
 setInterval(()=>{if(!document.hidden){void backgroundSync();void updates.check();autoUpdate();}},60000);
 window.addEventListener('online',()=>{void updates.check();void resume();});
 if('serviceWorker'in navigator&&location.protocol!=='file:'){try{const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});updates.watch(registration);void updates.check();}catch{notify('Offline-Bereitstellung noch nicht möglich. Online kannst du weiterlernen.');}}
 }catch(error){app.innerHTML=`<main class="boot"><h1>Die App konnte nicht starten.</h1><p>Öffne Latinio über seine Website-Adresse in einem normalen Safari-Tab.</p><p class="muted">${h(error.message)}</p></main>`;}}
boot();
