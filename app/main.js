import {SUBJECTS,subjectInfo,brandWord,beginSubjectTransition,TRANSITION_KEY} from './subjects.js';
import {notificationsUI} from './notifications.js';
import {createCloudNotice} from './cloud-notice.js';
import {grammarUI,grammarCard} from './grammar.js';
import {tablePracticeUI,tablePracticeCard,prefixPracticeCard} from './table-practice.js';
import {parseCollectionFile,importChanges} from './refresh-import.js';
import {legacyRefreshCount,reconcileRefreshDeck} from './refresh-reconcile.js';
import {rateRefresh,refreshCardView,bindRefreshSwipe,finishRefresh} from './refresh-cards.js';
import {installKeyboardSupport} from './keyboard.js';
import {appendAnswerField,hasAnswerContent} from './answer-fields.js';
import {installInputVisibility,focusInput} from './input-visibility.js';
import {captureViewState,restoreViewState} from './view-state.js';
import {createInterfaceMotion} from './interface-motion.js';
import {collectionWords} from './collection-words.js';
import {trainingOptionCounts} from './training-options.js';
import {createCollectionOpener} from './collection-opening.js';
import {failedTasks,createErrorRetry} from './error-retry.js';
import {parsePredicateFile,readPredicateStore,predicateMatches,predicateStorageKey,predicateCloudItems,migrateLocalPredicates,predicateDecks,predicateProgress,predicateProgressIndex,predicateDeckChanges,importPredicateCollection,predicateQueue} from './predicates.js';
import {sortedCollections,refreshDecks,wordEnabled,trainingDecks,wordsForDecks,deckMembers,pendingMembers,saveDeck,checkResultWords} from './refresh-decks.js';
import {refreshList,refreshMethod,refreshReconcileEditor,collectionRow,collectionToolbar,refreshCreate,checkPicker,refreshEditor} from './refresh-ui.js';
import {activityKey,collectionActive,forgottenWords,inactiveQueue} from './collection-learning.js';
import {classroomView,classroomResults} from './classroom.js';
import {uid,clone,normalize,evaluateSession,progressFor,chooseWords,parseImport,shuffleQueue} from './core.js';
import {confusionUI} from './confusion-ui.js';
import {openAccount,signOut,accountCard,updateActiveProfile} from './accounts.js';
import {sharingUI} from './sharing-ui.js';
import {streakLab,streakDemo,mountStreakDemo,mountStreakFinish} from './streak-demo.js';
import {createStreakLedger,streakDays,streakState} from './streak.js';
import {completionRoot,roundStats} from './round-completion.js';
import {fadeRound,fadeDialog} from './round-transition.js';
import {predicateList,predicateDetail,predicateDeckForm,predicateItemForm} from './predicate-ui.js';
import {cloudGate,settleSync,waitForInitialSync,unreadShareNotices,noticeCollections} from './multiuser-sync.js';
import {Sync} from './sync.js';
import {Store} from './store.js';
import {englishTasks,directionsFor,answerWord,promptFor,englishImport} from './english.js';
import {answerFeedback,evaluationCorrection,translationCard} from './feedback.js';
import {AppUpdates,APP_VERSION} from './updates.js';
import {preserveTestDraft} from './app-lifecycle.js';
import {chooseSubject,arrive,consumeSubjectSwitch,SUBJECT_SWITCH_KEY} from './subject-entrance.js';
import {currentSubject,rememberSubject} from './subject-preference.js';
const updates=new AppUpdates(navigator.serviceWorker);
const collectionOpener=createCollectionOpener();
let subject=currentSubject(location.search,localStorage);
let english=subject!=='latin';
let reminders,grammar,tablePractice;
document.documentElement.dataset.subject=subject;
const languageName=()=>subjectInfo(subject).label;
const directionLabel=dir=>dir==='de-en'?'Deutsch → '+languageName():dir==='en-de'?languageName()+' → Deutsch':'Beide Richtungen';
function subjectMetadata(){document.documentElement.dataset.subject=subject;document.querySelector('link[rel="icon"]').href=subjectInfo(subject).logo;theme();document.title='Latinio · '+languageName()+' lernen';}
const h=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5"/>',home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',book:'<path d="M12 6c-3-3-7-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2zM12 6v15"/>',settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM9 3l-1 3-3 1-2 3 2 2-1 3 3 3 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-3-3 1-2-3z"/>',cloud:'<path d="M7 18H6a4 4 0 0 1-.5-8A7 7 0 0 1 19 9a4.5 4.5 0 0 1-1 9h-1M12 20V11m-3 3 3-3 3 3"/>',check:'<path d="m5 12 4 4L19 6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',edit:'<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',moon:'<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',award:'<circle cx="12" cy="8" r="6"/><path d="m8 13-2 9 6-3 6 3-2-9"/>',repeat:'<path d="M3 7h13a5 5 0 0 1 5 5M7 3 3 7l4 4M21 17H8a5 5 0 0 1-5-5m14 1 4 4-4 4"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.book}</svg>`;
const openPanels=new Set();
let collectionTab='lessons',collectionsSearchOpen=false,refreshFlow=null,adminContent='',adminTab='people';
let predicateSelected=null;
let streakDemoDay=1,streakDemoVariant='orbit',streakDemoTheme='auto';
let streakLedger=null,streakSyncTask=null,streakSyncedAt=0,streakOtherVersions=new Map(),roundEnd=null,predicateRoot=null,predicateResults=[],predicateRoundId='';
let predicateKey='',predicateRun=[],predicateCursor=0,predicateAnswer='',predicateFeedback=null;
let profile,sharing,cloudWait,cloudNotice,ready=false,store,sync,confusions,screen='learn',renderedScreen=null,classroomQuery='',collectionFilter='all',search='',selected=[],modalCleanup=null,toastTimer,working=false,waitingStart=false,pendingStart=null,announcementQueue=[],announcementLoading=false;
const app=document.querySelector('#app'),modalRoot=document.querySelector('#modal-root');
const interfaceMotion=createInterfaceMotion({root:document});
let modalReturnFocus=null;
const isBootSplash=()=>app.querySelector('.boot')?.textContent.includes('Deine Vokabeln werden geladen');
updates.addEventListener('change',()=>{if(!ready&&isBootSplash()&&updates.state==='available')void updates.apply();});
if('serviceWorker'in navigator&&location.protocol!=='file:')void navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>{updates.watch(registration);void updates.check();}).catch(()=>{});
const isAdmin=()=>profile?.role==='admin';
const subjectAllowed=value=>SUBJECTS.some(s=>s.id===value)&&(isAdmin()||!Array.isArray(profile?.allowedSubjects)||profile.allowedSubjects.includes(value));
let viewSnapshot=null,subjectTransition=null,pendingCloudRender=false;
const data=()=>viewSnapshot||store.data;
function autoUpdate(){if(ready&&updates.state==='available'&&!working&&!waitingStart&&!cloudWait?.blocked&&!modalRoot.children.length&&!['test','match','predicate-test','round-end','grammar','tables'].includes(screen)&&!sync.busy&&!sharing?.busy&&!store.doc.pending.length)void updates.apply();}
async function showResult(){const saved=store.doc.session;if(!saved?.finished)return;if(saved.mode==='inactive-check'&&saved.refreshSavedCount===undefined){const session=clone(saved);await store.commit([finishRefresh(data(),session)],session);sync.schedule(0);}const session=store.doc.session;await offerRoundEnd({kind:'vocab',id:session.id,stats:roundStats(session,data()),errors:failedTasks(session,data().reviews)});void backgroundSync();}
function flushCloudRender(){
 if(pendingCloudRender&&ready&&!subjectTransition&&!working&&!waitingStart&&!modalRoot.children.length&&!['test','match','predicate-test','round-end','admin','grammar','tables'].includes(screen)){pendingCloudRender=false;render();}
 cloudNotice?.maybePrompt();
}
function renderCloudChanges(){pendingCloudRender=true;flushCloudRender();}
async function backgroundSync(){if(!ready||cloudWait?.blocked)return;try{await settleSync(sync,store);void refreshStreak();renderCloudChanges();}catch(error){cloudNotice?.fail(error);}finally{updateStatus();}}

const prefs=()=>({daily:10,typos:true,direction:'mixed',...data().settings.general,theme:'system',accent:'green',density:'comfortable',design:'rounded'});
const allWords=()=>{const d=data();return Object.values(d.words).filter(w=>d.collections[w.collectionId]);};
const activeWords=(d=data())=>wordsForDecks(d,trainingDecks(d).filter(deck=>deck.active).map(deck=>deck.id));
function notify(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);}
function applyColorScheme(mode='system'){
 const resolved=mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):mode;
 document.documentElement.dataset.theme=resolved;
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=resolved==='dark'?'#111114':'#f5f5f7';
}
function theme(){const p=store?prefs():{theme:'system'};document.documentElement.dataset.subject=subject;applyColorScheme(p.theme);document.documentElement.dataset.accent=p.accent||'green';document.documentElement.dataset.density=p.density||'comfortable';document.documentElement.dataset.design=p.design||'rounded';}
function nav(){return `<nav aria-label="Hauptmenü">${[['learn','home','Lernen'],['collections','book','Sammlungen'],['classroom','search','Unterricht'],...(isAdmin()?[['admin','users','Nutzer']]:[]),['settings','settings','Einstellungen']].map(([id,i,label])=>`<button data-action="nav" data-screen="${id}" aria-label="${label}" title="${label}" class="nav-item ${(screen===id||id==='learn'&&screen==='tables'||id==='collections'&&['collection-detail','predicate-detail'].includes(screen))?'active':''}" ${screen===id?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;}
function todayCount(){const today=new Date().toLocaleDateString('sv');return Object.values(data().reviews).filter(r=>!r.repeat&&!r.manualKnown&&new Date(r.at).toLocaleDateString('sv')===today).length;}
function updateStatus(){setTimeout(autoUpdate,0);updateWaitingOptions();cloudNotice?.update();document.querySelectorAll('[data-auto-share]').forEach(el=>el.innerHTML=sharing?.autoStatusMarkup()||'');const detail=document.querySelector('[data-sync-details]');if(detail)detail.innerHTML=syncDetails();}
function render(){
 pendingCloudRender=false;
 viewSnapshot=store.data;
 try{
 theme();
 interfaceMotion.beforeRender();
 const sameScreen=renderedScreen===screen,screenChanged=!sameScreen;
 const previousScreen=renderedScreen;renderedScreen=screen;
 if(screen==='match'){app.innerHTML=confusions.view();return;}
 if(screen==='test'){renderTest();return;}
 if(screen==='predicate-test'){renderPredicateTest();return;}
 if(screen==='round-end')return;
 const viewState=captureViewState(app);
 const transition=screenChanged?({learn:'learn',collections:'collections',admin:'admin',settings:'settings','collection-detail':'detail','predicate-detail':'detail',classroom:'classroom'}[screen]||'fade'):'';
 app.innerHTML=`<aside class="sidebar"><button class="brand brand-switch" data-action="subject-menu" aria-label="Lernfach wechseln">${brandWord(subject)}</button>${nav()}<div class="sidebar-foot"><div class="language-tag">${english?'EN ↔ DE':'LA → DE'}</div><p>Ein bisschen ${languageName()}.<br>Jeden Tag.</p><span class="muted small">App ${APP_VERSION}</span></div></aside><div class="workspace"><header class="topbar"><button class="mobile-brand brand" data-action="subject-menu" aria-label="Lernfach wechseln">${brandWord(subject)}</button><span class="desktop-only muted">Dein ${languageName()}training</span><div class="topbar-actions"><details class="subject-dropdown"><summary><span class="subject-flag" aria-hidden="true">${subjectInfo(subject).flag}</span>${languageName()} <span aria-hidden="true">▾</span></summary><div class="subject-options">${SUBJECTS.filter(x=>subjectAllowed(x.id)).map(x=>`<button data-action="switch-subject" data-id="${x.id}">${x.flag} ${x.label}${subject===x.id?' · aktuell':''}</button>`).join('')}</div></details></div></header><main class="content" ${transition?`data-screen-transition="${transition}"`:''}>${isAdmin()&&['collections','collection-detail','predicate-detail','admin'].includes(screen)?`<div data-auto-share>${sharing?.autoStatusMarkup()||''}</div>`:''}${screen==='tables'&&subject==='latin'?tablePractice.view():screen==='grammar'&&isAdmin()&&subject==='english'?grammar.view():screen==='learn'?learnView():screen==='collections'?collectionsView():screen==='collection-detail'?collectionDetailView():screen==='predicate-detail'?predicateDetail(data(),collectionFilter,h,icon):screen==='classroom'?classroomView(data(),classroomQuery,h,english,subject):screen==='admin'&&isAdmin()?adminView():settingsView()}</main></div><div class="mobile-nav">${nav()}</div>`;
 app.querySelectorAll('details[data-panel]').forEach(el=>{el.open=openPanels.has(el.dataset.panel);});
 restoreViewState(app,viewState,{preserve:sameScreen});
 if(!sameScreen&&previousScreen!==null)window.scrollTo({left:0,top:0,behavior:'instant'});
 interfaceMotion.screen(app,{from:previousScreen,to:screen});
 }finally{viewSnapshot=null;}
}
function adminView(){return `<div class="page-heading"><div><div class="eyebrow">VERWALTUNG</div><h1>Nutzer</h1><p class="muted">Profile, Freigaben und Nachrichten an einem Ort.</p></div></div><div class="section-tabs admin-tabs" aria-label="Nutzerverwaltung"><button class="chip ${adminTab==='people'?'selected':''}" data-action="account-profiles">Nutzer</button><button class="chip ${adminTab==='shares'?'selected':''}" data-action="share-panel">Freigaben</button><button class="chip ${adminTab==='checks'?'selected':''}" data-action="sharing-check">Freigaben prüfen</button><button class="chip ${adminTab==='messages'?'selected':''}" data-action="announcement-history">Nachrichten</button><button class="chip ${adminTab==='reminders'?'selected':''}" data-action="notification-admin">Erinnerungen</button></div><section class="admin-content">${adminContent||'<p class="muted">Nutzerverwaltung wird geladen …</p>'}</section>`;}
function showAdmin(content,tab='people'){if(!isAdmin())return;closeModal();adminContent=content;adminTab=tab;screen='admin';render();}
function learnView(){const d=data(),words=activeWords(d),streak=streakLedger?streakLedger.state(d):streakState(streakDays(d)),goal=prefs().daily;const decks=trainingDecks(d).filter(x=>x.active);selected=selected.filter(id=>decks.some(x=>x.id===id));if(!selected.length)selected=decks.map(x=>x.id);
 return `<div class="page-heading home-heading"><div><div class="eyebrow">DEIN TRAINING</div><h1>Hallo ${h(isAdmin()?'Tiago':profile.name)}!</h1><p class="muted">Was möchtest du heute üben?</p></div><div class="daily-badge streak-badge ${streak.active?'is-active':''}" aria-label="${streak.count} ${streak.count===1?'Tag':'Tage'} Streak · ${streak.active?'heute gelernt':'heute noch keine Runde abgeschlossen'}">${streakBadgeFlame()}<strong>${streak.count}</strong><span>${streak.count===1?'Tag':'Tage'}</span></div></div>
 <div class="learning-grid home-practice-grid"><section class="training-card"><div class="section-top"><span class="tag">${english?directionLabel(prefs().direction).toUpperCase():'LATEIN → DEUTSCH'}</span>${icon('book','large-icon')}</div><h2>Vokabeln üben</h2><p data-compact-hide>Wähle deine Sammlungen und starte eine Runde.</p>${english?`<label class="direction-choice">Abfragerichtung<select id="direction"><option value="mixed" ${prefs().direction==='mixed'?'selected':''}>Gemischt · schwierige Richtung zuerst</option><option value="en-de" ${prefs().direction==='en-de'?'selected':''}>${languageName()} → Deutsch</option><option value="de-en" ${prefs().direction==='de-en'?'selected':''}>Deutsch → ${languageName()}</option></select></label>`:''}<details data-panel="home-decks" class="deck-picker"><summary>Trainingsauswahl · ${decks.length} aktive Sammlungen</summary><div class="bounded-list">${decks.map(c=>`<label class="collection-check"><input type="checkbox" data-select="${h(c.id)}" ${selected.includes(c.id)?'checked':''}><span>${h(c.name)}</span><small>${wordsForDecks(d,[c.id]).length} Wörter</small></label>`).join('')||'<p>Keine aktive Sammlung. Schalte unter Sammlungen die gewünschten Lektionen ein.</p>'}</div></details><div class="word-tools"><button class="button primary wide" data-action="start" ${!words.length&&!cloudWait?.blocked?'disabled':''}>Smart lernen ${icon('arrow')}</button><button class="button secondary wide" data-action="training-options">Mehr Optionen ${icon('plus')}</button></div><div class="card-foot">${icon('target')} ${goal} Aufgaben pro Runde · beliebig weiterüben</div></section>${!english?predicatePracticeCard():''}${subject==='latin'?tablePracticeCard()+prefixPracticeCard():''}${isAdmin()&&subject==='english'?grammarCard():''}</div>`;;
}
function selectedPredicateDecks(d=data()){const decks=predicateDecks(d).filter(deck=>deck.active!==false);return predicateSelected===null?decks.map(deck=>deck.id):predicateSelected.filter(id=>decks.some(deck=>deck.id===id));}
function predicatePracticeCard(){const d=data(),decks=predicateDecks(d).filter(deck=>deck.active!==false),ids=selectedPredicateDecks(d),allItems=predicateCloudItems(d),items=allItems.filter(item=>ids.includes(item.deckId));return `<section class="training-card"><div class="section-top"><span class="tag">GRUNDFORM → PERFEKTFORM</span>${icon('book','large-icon')}</div><h2>Perfektform lernen</h2><p data-compact-hide>Wähle deine Sammlungen und starte eine Runde.</p><details data-panel="home-predicates" class="deck-picker"><summary>Trainingsauswahl · ${decks.length} aktive Sammlungen</summary><div class="bounded-list">${decks.map(deck=>`<label class="collection-check"><input type="checkbox" data-predicate-select="${h(deck.id)}" ${ids.includes(deck.id)?'checked':''}><span>${h(deck.name)}</span><small>${allItems.filter(item=>item.deckId===deck.id).length} Formen</small></label>`).join('')||'<p>Keine aktive Sammlung. Schalte unter Sammlungen die gewünschten Perfekt-Sammlungen ein.</p>'}</div></details><div class="word-tools"><button class="button primary wide" data-action="predicate-start" ${!items.length&&!cloudWait?.blocked?'disabled':''}>Smart lernen ${icon('arrow')}</button><button class="button secondary wide" data-action="predicate-options">Mehr Optionen ${icon('plus')}</button></div><div class="card-foot">${icon('target')} ${prefs().daily} Aufgaben pro Runde · beliebig weiterüben</div></section>`;}
function startPredicatePractice(mode='smart'){if(english)return;const d=data();predicateRun=predicateQueue(d,selectedPredicateDecks(d),mode,prefs().daily);if(!predicateRun.length){notify('Für diese Auswahl gibt es noch keine passenden Formen.');return;}const progress=predicateProgressIndex(d,predicateRun);closeModal();predicateRoot={items:[...predicateRun],known:Object.fromEntries(predicateRun.map(item=>[item.id,progress.get(item.id).known])),first:{}};predicateResults=[];predicateRoundId=uid();roundEnd=null;predicateCursor=0;predicateAnswer='';predicateFeedback=null;screen='predicate-test';void store.recordActivity('started');sync.schedule();render();document.querySelector('#predicate-answer')?.focus({preventScroll:true});}
function predicateOptions(){const d=data(),ids=selectedPredicateDecks(d),empty=!predicateQueue(d,ids,'all').length;showModal(`<h2 id="modal-title">Mehr Optionen</h2><p class="muted">Für deine Trainingsauswahl.</p>${empty?emptyOptionsMarkup('Formen'):''}<div class="word-tools" ${empty?'data-waiting-options="predicates"':''}>${predicateOptionButtons(d,ids)}</div>`);}
function predicateOptionButtons(d,ids){return [['refresh','Auffrischen'],['learning','Noch unsichere Formen üben'],['all','Alle ausgewählten Formen üben']].map(([mode,label])=>{const count=predicateQueue(d,ids,mode).length;return `<button class="button secondary wide" data-action="predicate-mode" data-id="${mode}" ${!count?'disabled':''}>${label} · ${count}</button>`;}).join('');}
function renderPredicateTest(){const item=predicateRun[predicateCursor];if(!item){screen='learn';render();return;}const result=predicateFeedback;app.innerHTML=`<main class="test-shell predicate-test"><header class="test-top"><button class="icon-button" data-action="predicate-exit" aria-label="Prädikatübung beenden">${icon('close')}</button><div class="test-progress"><div style="width:${Math.round(predicateCursor/predicateRun.length*100)}%"></div></div><span class="small muted">${predicateCursor+1} / ${predicateRun.length}</span></header><div class="test-content"><div class="eyebrow">PERFEKTFORMEN LERNEN</div><h1>Wie lautet die Perfektform?</h1><div class="latin-word" lang="la">${h(item.grundform)}</div>${result?`<section class="feedback ${result.correct?'full':'wrong'}"><h2>${result.correct?'Richtig!':'Noch nicht richtig.'}</h2>${!result.correct?`<p>Gesucht: <strong>${item.praedikate.map(h).join(' · ')}</strong></p>`:''}</section><button class="button primary wide" data-action="predicate-next">${predicateCursor+1===predicateRun.length?'Fertig':'Weiter'} ${icon('arrow')}</button>`:`<form id="predicate-answer-form"><label class="small muted" for="predicate-answer">Perfektform / Prädikat</label><input id="predicate-answer" name="answer" lang="la" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="300" value="${h(predicateAnswer)}" placeholder="Perfektform eingeben" required><button class="button primary wide" type="submit">Prüfen ${icon('check')}</button></form>`}</div></main>`;}
function collectionsView(){const d=data(),recoverable=typeof store==='undefined'?[]:(store.doc.deletedCollections||[]).filter(item=>item.expiresAt>Date.now());return `<div class="page-heading collections-heading"><h1>Sammlungen</h1><button class="collection-search-toggle" data-action="collection-search-toggle" aria-label="${collectionsSearchOpen?'Suche schließen':'Sammlungen durchsuchen'}" aria-expanded="${collectionsSearchOpen}">${icon(collectionsSearchOpen?'close':'search')}</button></div>${collectionsSearchOpen?`<label class="search-field collection-search">${icon('search')}<input id="search" placeholder="Alle Vokabeln durchsuchen" value="${h(search)}" aria-label="Vokabel suchen"></label><section id="collection-search-results" class="bounded-list">${search.trim()?wordRows('all',search):''}</section>`:''}<div class="button-row section-tabs collection-tabs-nav" aria-label="Sammlungsbereiche"><button class="chip ${collectionTab==='lessons'?'selected':''}" data-action="collection-tab" data-id="lessons">Lektionen</button><button class="chip ${collectionTab==='refresh'?'selected':''}" data-action="collection-tab" data-id="refresh">Auffrischen</button>${!english?`<button class="chip ${collectionTab==='predicates'?'selected':''}" data-action="collection-tab" data-id="predicates">Perfekt</button>`:''}<button class="chip ${collectionTab==='confusions'?'selected':''}" data-action="collection-tab" data-id="confusions">Verwechslungen</button></div>${recoverable.length?`<section class="card deleted-collections"><h2>Zuletzt gelöscht</h2><p class="small muted">Sammlungen lassen sich auf diesem Gerät bis zu sieben Tage lang wiederherstellen.</p>${recoverable.map(item=>`<div class="deleted-collection-row"><span><strong>${h(item.name)}</strong><small>Verfügbar bis ${h(new Date(item.expiresAt).toLocaleDateString('de-DE'))}</small></span><button class="button secondary" data-action="restore-collection" data-id="${h(item.id)}">Rückgängig</button></div>`).join('')}</section>`:''}${collectionTab==='confusions'?`<section class="confusions-panel">${confusions.collectionView()}</section>`:collectionTab==='predicates'&&!english?predicateList(d,h,icon):collectionTab==='refresh'?refreshList(d,h,icon):collectionLearningView(d)}<div class="collection-footer">${sharing.toolbar()}</div>`;}
function collectionLearningView(d){return `<section class="card collection-learning">${collectionToolbar()}<div class="bounded-list">${sortedCollections(d).map(c=>collectionRow(c,collectionActive(d,c.id),false,h,icon)).join('')||'<p class="muted">Noch keine Lektionen.</p>'}</div></section>`;}
function reconciliationChanges(result,deckId){return [['settings',deckId,result.deck],...result.removeWordIds.map(id=>['words',id,null]),...result.removeCollectionIds.map(id=>['collections',id,null])];}
function collectionDetailView(){const d=data(),c=d.collections[collectionFilter]||d.settings[collectionFilter],refresh=c?.kind==='refreshDeck',legacy=refresh?legacyRefreshCount(d,c.id):0;if(!c)return '<p>Sammlung nicht mehr vorhanden.</p><button class="text-button flat-action" data-action="nav" data-screen="collections">Zurück</button>';return `<button class="text-button flat-action" data-action="nav" data-screen="collections">← Sammlungen</button><div class="page-heading collection-detail-heading"><div class="collection-title"><h1>${h(c.name)}</h1><button class="icon-button flat-action" data-action="rename-collection" data-id="${h(c.id)}" aria-label="Sammlung umbenennen">${icon('edit')}</button></div><button class="button primary" data-action="${refresh?'check-picker':'new-word'}" data-id="${h(c.id)}">${icon('plus')} Vokabeln hinzufügen</button></div><button class="text-button danger-text flat-action" data-action="${refresh?'refresh-delete':'delete-collection'}" data-id="${h(c.id)}">Sammlung löschen</button>${legacy?`<section class="card refresh-reconcile"><h2>Ältere Vokabeleinträge</h2><p class="small muted">${legacy} Einträge können noch mit den Vokabeln deiner Lektionen abgeglichen werden.</p><button class="button secondary" data-action="refresh-reconcile" data-id="${h(c.id)}">Auffrisch-Vokabeln überprüfen</button></section>`:''}<label class="search-field collection-search">${icon('search')}<input id="search" placeholder="In dieser Sammlung suchen" value="${h(search)}" aria-label="Vokabel suchen"></label><section class="word-list" id="word-list">${wordRows(collectionFilter,search,d)}</section>`;}
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
function wordRows(filter=collectionFilter,query=search,d=data()){
 const deck=d.settings[filter]?.kind==='refreshDeck'?d.settings[filter]:null;
 const directions=english?directionsFor(deck?.direction||d.settings.general?.direction||'mixed'):[null];
 return collectionWords(d,{filter,query,directions}).map(({word:w,level,inRefreshDeck,pending})=>`<article class="word-row"><div><strong>${h(w.latin)}</strong><span class="small muted">${h(d.collections[w.collectionId]?.name)}</span></div><p>${w.meanings.map(g=>h(g.join(' / '))).join(' · ')}</p><span class="word-level ${level}">${{new:'Neu',learning:'Im Training',known:'Sicher'}[level]}${inRefreshDeck?(pending?' · Offen':' · Erledigt'):''}</span><button class="icon-button" aria-label="${h(w.latin)} ${inRefreshDeck?'aus Auffrisch-Sammlung entfernen':'bearbeiten'}" data-action="${inRefreshDeck?'refresh-remove-word':'edit-word'}" data-id="${h(w.id)}">${icon(inRefreshDeck?'trash':'edit')}</button></article>`).join('')||'<div class="empty-state"><p class="muted">Keine Vokabeln gefunden.</p></div>';
}
function syncDetails(){const doc=store.doc;return `<div class="sync-box"><p class="sync-state">${icon('cloud')} ${h(sync.message)}</p><dl><div><dt>Bestätigter Gerätestand</dt><dd>v${doc.base}</dd></div><div><dt>Cloud-Version</dt><dd>${sync.cloudVersion===null?'Noch nicht geprüft':'v'+sync.cloudVersion}</dd></div><div><dt>Lokale Änderungen</dt><dd>${doc.pending.length} ausstehend</dd></div><div><dt>Lokaler Änderungszähler</dt><dd>${doc.seq}</dd></div><div><dt>Letzter Abgleich</dt><dd>${doc.lastSync?h(new Date(doc.lastSync).toLocaleString('de-DE')):'Noch keiner'}</dd></div></dl>${sync.busy?'<div class="indeterminate" role="progressbar" aria-label="Synchronisierung läuft"></div>':''}</div>`;}
function updateView(){const busy=['checking','installing'].includes(updates.state);return `<p class="small muted">Installierte Version: ${APP_VERSION}</p><p role="status" class="update-message">${h(updates.message)}</p><button type="button" class="button ${updates.state==='available'?'primary':'secondary'} wide" data-action="${updates.state==='available'?'apply-update':'check-update'}" ${busy?'disabled':''}>${icon('repeat')} ${updates.state==='available'?'Jetzt aktualisieren':busy?'Bitte warten …':'Nach Updates suchen'}</button>`;}
updates.addEventListener('change',()=>{const area=document.querySelector('[data-app-updates]');if(area)area.innerHTML=updateView();autoUpdate();});
function settingsView(){const p=prefs();return `<div class="page-heading"><div><div class="eyebrow">DEINE APP</div><h1>Einstellungen</h1><p class="muted">Einfach anpassen, der Reihe nach.</p></div></div><div class="settings-list">${accountCard(profile)}${reminders?.settingsMarkup()||''}<section class="settings-section"><h2>Training</h2><label class="setting-row"><span><strong>Tagesziel</strong><small>Aufgaben pro Runde · kein Tageslimit</small></span><select id="daily">${[5,10,15,20,30].map(n=>`<option value="${n}" ${p.daily===n?'selected':''}>${n} Wörter</option>`).join('')}</select></label><label class="setting-row"><span><strong>Tippfehler tolerieren</strong><small>Deutsche Tippfehler tolerieren; Fremdsprachige Antworten werden streng bewertet. Bewertungen kannst du korrigieren.</small></span><input class="switch" id="typos" type="checkbox" ${p.typos?'checked':''}></label></section><section class="settings-section"><h2>App-Updates</h2><div data-app-updates>${updateView()}</div></section><section class="settings-section"><h2>Vokabeln & Installation</h2><div class="settings-actions"><button class="button secondary wide" data-action="import">${icon('upload')} Sammlung importieren</button><button class="text-button wide" data-action="download-example">Beispiel für das Importformat</button>${!english?'<button class="text-button wide" data-action="predicate-example">Beispiel für Perfekt-Sammlungen</button>':''}</div><p class="muted install-hint"><strong>Auf deinem iPhone oder iPad:</strong> Safari → Teilen → „Zum Home-Bildschirm“.</p></section>${isAdmin()?`<section class="settings-section"><h2>Admin Tests</h2><p class="small muted">Streak-Animationen als Vorschau ausprobieren.</p><div class="settings-actions"><button class="button secondary wide" data-action="admin-tests">Streak-Animationen testen</button></div></section><section class="settings-section cloud-settings"><h2>Cloud & Versionen</h2><div data-sync-details>${syncDetails()}</div><div class="settings-actions"><button class="button secondary wide" data-action="sync-now" ${!sync.configured?'disabled':''}>${icon('repeat')} Jetzt abgleichen</button>${sync.remote?'<button class="button primary wide" data-action="remote">Cloud-Version ansehen</button>':''}</div></section>`:''}</div><p class="small muted app-version">Latinio ${APP_VERSION} · ${english?languageName()+' ↔ Deutsch':'Latein → Deutsch'}</p>`;}
function showModal(content,closable=true){
 interfaceMotion.closeModal();
 const previous=modalRoot.children.length?modalReturnFocus:document.activeElement;
 modalCleanup?.(false);modalReturnFocus=previous;
 modalRoot.innerHTML=`<div class="modal-overlay"><section role="dialog" aria-modal="true" class="modal" tabindex="-1" aria-labelledby="modal-title">${closable?`<button class="icon-button modal-close" data-action="close-modal" aria-label="Schließen">${icon('close')}</button>`:''}${content}</section></div>`;
 const listener=e=>{
  if(e.key==='Escape'&&closable){e.preventDefault();closeModal();return;}
  if(e.key!=='Tab')return;
  const nodes=[...modalRoot.querySelectorAll('button,input,select,textarea,a[href]')].filter(n=>!n.disabled&&!n.hidden&&n.type!=='hidden');
  if(!nodes.length){e.preventDefault();modalRoot.querySelector('.modal')?.focus({preventScroll:true});return;}
  const first=nodes[0],last=nodes.at(-1),outside=!modalRoot.contains(document.activeElement);
  if(e.shiftKey&&(document.activeElement===first||outside)){e.preventDefault();last.focus({preventScroll:true});}
  else if(!e.shiftKey&&(document.activeElement===last||outside)){e.preventDefault();first.focus({preventScroll:true});}
 };
 document.addEventListener('keydown',listener);
 modalCleanup=(restore=true)=>{document.removeEventListener('keydown',listener);if(restore&&previous?.isConnected!==false)previous?.focus({preventScroll:true});};
 modalRoot.querySelector('input,select,button,.modal')?.focus({preventScroll:true});
 interfaceMotion.openModal(modalRoot);
}
function closeModal(){interfaceMotion.closeModal();modalRoot.innerHTML='';modalCleanup?.();modalCleanup=null;modalReturnFocus=null;queueMicrotask(flushCloudRender);}
function showStreakDemo(){
 showModal(streakDemo(streakDemoDay,streakDemoVariant,streakDemoTheme));
 const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const dispose=mountStreakDemo(modalRoot.querySelector('.streak-stage'),{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches,onStart:()=>modalRoot.querySelector('.modal-close')?.focus({preventScroll:true})});
 const cleanup=modalCleanup;modalCleanup=restore=>{dispose();document.body.style.overflow=overflow;cleanup?.(restore);};
}

function streakBadgeFlame(){return '<svg class="streak-badge-flame" viewBox="100 90 1060 1320" aria-hidden="true"><path fill="currentColor" d="M583 114C606 84 647 84 671 115L1036 584C1118 689 1155 792 1155 915C1155 1200 920 1402 629 1402C339 1402 103 1196 103 916V388C103 325 144 289 198 312L365 389Z"/><path class="streak-badge-core" d="M600 652C614 631 640 631 655 652L809 870C839 911 854 953 854 1001C854 1118 755 1210 628 1210C502 1210 402 1118 402 1001C402 953 417 911 447 870Z"/></svg>';}
function refreshStreakBadge(){
 if(!ready||screen!=='learn'||!streakLedger)return;
 const badge=app.querySelector('.streak-badge');if(!badge)return;
 const state=streakLedger.state(data()),label=state.count===1?'Tag':'Tage';
 badge.classList.toggle('is-active',state.active);badge.setAttribute('aria-label',`${state.count} ${label} Streak · ${state.active?'heute gelernt':'heute noch keine Runde abgeschlossen'}`);
 badge.querySelector('strong').textContent=state.count;badge.querySelector('span').textContent=label;
}
async function refreshStreak(){
 if(!streakLedger)return;
 streakLedger.merge(streakDays(data()));
 const others=SUBJECTS.map(s=>s.id).filter(s=>s!==subject&&subjectAllowed(s));
 if(!navigator.onLine||!sync.configured||!others.length||Date.now()-streakSyncedAt<60000)return;
 if(streakSyncTask)return streakSyncTask;
 streakSyncTask=(async()=>{try{
  for(const other of others){
   if(sync.streakSummary===true){const result=await sync.request('streak',{},other);streakLedger.merge(result.days);continue;}
   const config=store.doc.config,cached=streakOtherVersions.get(other),meta=await sync.request('check',{},other);
   if(cached&&cached.profileId===store.profileId&&cached.url===config.url&&cached.token===config.token&&cached.version===meta.version)continue;
   const result=await sync.request('pull',{since:0},other);streakLedger.merge(streakDays(result.data));
   streakOtherVersions.set(other,{profileId:store.profileId,url:config.url,token:config.token,version:result.version});
  }
  streakSyncedAt=Date.now();
 }catch{/* Offline and unavailable subjects never block local completion. */}finally{streakSyncTask=null;refreshStreakBadge();}})();
 return streakSyncTask;
}
async function offerRoundEnd(completion){
 if(roundEnd?.id===completion.id)return;
 roundEnd=completion;screen='round-end';
 document.activeElement?.blur?.();
 if(!completion.stats.total){await returnFromRound();return;}
 if(completion.errors.length){
  showModal(`<div class="round-decision"><h2 id="modal-title">Noch einmal üben?</h2><p>${completion.errors.length} ${completion.errors.length===1?'Aufgabe war':'Aufgaben waren'} noch nicht ganz richtig. Möchtest du sie direkt wiederholen?</p><div class="round-decision-actions"><button class="button primary wide" data-action="retry-errors">Fehler wiederholen</button><button class="button secondary wide" data-action="round-finish">Runde beenden</button></div><p class="small muted">Deine erste Antwort bleibt für die Auswertung erhalten.</p></div>`,false);
 }else await acceptRoundEnd();
}
async function acceptRoundEnd(){
 if(!roundEnd||roundEnd.accepted)return;
 const completion=roundEnd;
 try{
 // The day is the local calendar day when the user chooses to finish.
 const state=await streakLedger.claim(store);
 completion.accepted=true;sync.schedule(0);
 if(state.celebrate&&navigator.onLine){try{const claimed=await sync.request('notificationStreakClaim',{day:state.today});state.celebrate=claimed.celebrate;}catch{}}
 if(!state.celebrate){closeModal();showModal(`<div class="round-complete-simple"><p class="eyebrow">RUNDE GESCHAFFT</p><h2 id="modal-title">Gut gemacht!</h2><p class="muted">Dein Streak zählt heute schon. Lust auf eine weitere Runde?</p><button class="button primary wide" data-action="round-home">Weiter ${icon('arrow')}</button></div>`,false);return;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 await fadeDialog(modalRoot.querySelector('.modal-overlay'),reduced);closeModal();
 await fadeRound(app,reduced);
 showModal(streakDemo(state.count,state.variant,'auto',{live:true,celebrate:state.celebrate,stats:completion.stats}),false);
 const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const dispose=mountStreakFinish(modalRoot.querySelector('.streak-stage'),{celebrate:state.celebrate,reducedMotion:reduced});
 const cleanup=modalCleanup;modalCleanup=restore=>{dispose();document.body.style.overflow=overflow;cleanup?.(restore);};
 }catch(error){completion.accepted=false;showModal(`<div class="round-decision"><h2 id="modal-title">Abschluss erneut versuchen</h2><p>${h(error.message)}</p><button class="button primary wide" data-action="round-finish">Erneut versuchen</button></div>`,false);}
}
async function retryRoundErrors(){
 if(!roundEnd||roundEnd.accepted||!roundEnd.errors.length)return;
 if(roundEnd.kind==='predicate'){
  predicateRun=shuffleQueue(roundEnd.errors);predicateResults=[];predicateRoundId=uid();predicateCursor=0;predicateAnswer='';predicateFeedback=null;
  closeModal();roundEnd=null;screen='predicate-test';await store.recordActivity('started');sync.schedule();render();document.querySelector('#predicate-answer')?.focus({preventScroll:true});return;
 }
 const previous=store.doc.session,errors=failedTasks(previous,data().reviews),retry=createErrorRetry(previous,errors,uid());if(!retry)return;
 await store.update(doc=>{doc.session=retry;return doc;});await store.recordActivity?.('started');
 closeModal();roundEnd=null;sync.schedule();screen='test';render();
}
async function finishPredicateRound(){
 if(!predicateRoot||roundEnd?.id===predicateRoundId)return;
 await store.commit([['sessions',predicateRoundId,{id:predicateRoundId,at:Date.now(),count:predicateRun.length,kind:'predicate'}]]);sync.schedule(0);
 const first=Object.values(predicateRoot.first),stats={correct:first.filter(Boolean).length,wrong:first.filter(value=>!value).length,newlyKnown:predicateRoot.items.filter(item=>!predicateRoot.known[item.id]&&predicateProgress(data(),item).known).length,total:first.length};
 await offerRoundEnd({kind:'predicate',id:predicateRoundId,stats,errors:predicateRun.filter((item,index)=>predicateResults[index]!==true)});
}
async function returnFromRound(){
 await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});
 await fadeDialog(modalRoot.querySelector('.modal-overlay'),matchMedia('(prefers-reduced-motion: reduce)').matches);
 closeModal();
 roundEnd=null;predicateRoot=null;predicateResults=[];predicateRun=[];predicateFeedback=null;predicateAnswer='';screen='learn';render();void backgroundSync();
}

function announcementView(item,preview=false){showModal(`<span class="stat-icon purple">${icon('info')}</span>${preview?'<div class="eyebrow">VORSCHAU · SO SIEHT DIE NACHRICHT AUS</div>':''}<h2 id="modal-title">${h(item.title)}</h2><p class="announcement-message">${h(item.message).replace(/\n/g,'<br>')}</p>${preview?'<button class="button secondary wide" data-action="announcement-history">Zurück zur Nachrichtenliste</button>':`<button class="button primary wide" data-action="announcement-next" data-id="${h(item.id)}">Weiter ${icon('arrow')}</button>`}`,preview);}
function checkShareNotices(){if(!ready||cloudWait?.blocked||working||waitingStart||modalRoot.children.length||!['learn','collections','settings'].includes(screen))return;const notices=unreadShareNotices(data());if(!notices.length)return;showModal(`<h2 id="modal-title">Neue Inhalte für dich</h2><p>Diese Inhalte wurden mit dir geteilt:</p><ul>${noticeCollections(notices).map(item=>`<li>${h(item.name)}</li>`).join('')}</ul><button class="button primary wide" data-action="share-notices-read">Weiter</button>`,false);}
async function checkAnnouncements(){if(cloudWait?.blocked||!ready||!sync?.configured||!navigator.onLine||announcementLoading||modalRoot.children.length||['test','match','predicate-test','round-end'].includes(screen))return;announcementLoading=true;try{const result=await sync.request('announcementInbox');announcementQueue=result.announcements||[];if(announcementQueue.length&&!working&&!waitingStart&&!modalRoot.children.length&&!['test','match','predicate-test','round-end','grammar','tables'].includes(screen))announcementView(announcementQueue[0]);}catch{}finally{announcementLoading=false;reminders?.maybePrompt?.();}}
let announcementHistory=[];
function showAnnouncementHistory(){if(!isAdmin())return;showAdmin('<p role="status" data-message-loading>Nachrichten werden geladen …</p>','messages');const root=document.querySelector('[data-message-loading]');void sync.request('announcementList').then(result=>{if(!root.isConnected)return;announcementHistory=result.announcements||[];showAdmin(`<div class="section-top"><h2>Nachrichten</h2><button class="button primary" data-action="announcement-compose">Nachricht verfassen</button></div>${announcementHistory.map(a=>`<details class="announcement-history"><summary>${h(a.title)} · ${a.recipients.filter(r=>r.readAt).length}/${a.recipients.length} gelesen</summary><div class="announcement-history-heading"><strong>${h(a.title)}</strong><button class="button secondary" data-action="announcement-preview" data-id="${h(a.id)}">Testen</button></div><p class="small muted">${h(new Date(a.createdAt).toLocaleString('de-DE'))} · ${a.profileId==='all'?'Alle Nutzer':'Einzelner Nutzer'}</p><p class="announcement-message">${h(a.message).replace(/\n/g,'<br>')}</p><ul>${a.recipients.map(r=>`<li>${h(r.name)} · ${r.readAt?`gelesen am ${h(new Date(r.readAt).toLocaleString('de-DE'))}`:'noch nicht gelesen'}</li>`).join('')||'<li>Keine Empfänger gespeichert</li>'}</ul></details>`).join('')||'<p class="muted">Noch keine Nachrichten gesendet.</p>'}`,'messages');}).catch(error=>{if(root.isConnected)root.textContent='Nachrichten konnten nicht geladen werden: '+error.message;});}
async function composeAnnouncement(){const result=await sync.request('profiles'),people=result.profiles||[];showModal(`<h2 id="modal-title">Nachricht an Nutzer</h2><form id="announcement-form"><label>Empfänger<select name="profileId" required><option value="" selected>Empfänger auswählen</option><option value="all">Alle Nutzer</option>${people.map(p=>`<option value="${h(p.id)}" >${h(p.name)} · ${h(p.email)}</option>`).join('')}</select></label><label>Überschrift<input name="title" required maxlength="120" value="Neue Funktionen verfügbar"></label><label>Nachricht<textarea name="message" required maxlength="2000" rows="6"></textarea></label><button class="button primary wide">Nachricht senden</button><p class="small muted" role="status" data-announcement-status></p></form>`);}
function remoteContent(){const comparison=sync.compare();const conflicts=comparison.conflicts;return `<span class="stat-icon purple">${icon('cloud')}</span><h2 id="modal-title">Eine neuere Version ist da.</h2><p>Auf diesem Gerät: <strong>v${store.doc.base}</strong><br>In deiner Cloud: <strong>v${sync.remote.version}</strong></p><p class="muted">${store.doc.pending.filter(o=>!o.bootstrap).length?'Deine ausstehenden Änderungen bleiben erhalten. Bearbeitungen derselben Angabe vergleichst du unten.':'Lade den aktuellen Stand, um hier weiterzulernen.'}</p><form id="remote-form">${conflicts.map((c,i)=>`<div class="conflict"><h3>${h(conflictName(c.local))}</h3><p><strong>Dieses Gerät:</strong> ${h(conflictValue(c.local.value))}</p><p><strong>Cloud:</strong> ${h(conflictValue(c.remote.value))}</p><label>Welche Fassung soll bleiben?<select name="c${i}" data-conflict="${h(c.key)}" required><option value="">Bitte wählen</option><option value="local">Dieses Gerät</option><option value="cloud">Cloud</option></select></label></div>`).join('')}<button type="submit" class="button primary wide">${icon('download')} Cloud-Version laden${conflicts.length?' & zusammenführen':''}</button></form>`;}
function remoteModal(){if(!sync.remote)return;showModal(remoteContent());}
function conflictName(op){return op.value?.latin||op.value?.name||data().words[op.key]?.latin||'Geänderte Angabe';}
function conflictValue(value){if(value===null)return 'Gelöscht';if(value.latin)return value.latin+' – '+value.meanings.map(g=>g.join(' / ')).join(', ');if(value.name)return value.name;if(value.grade)return 'Bewertung: '+value.grade;return JSON.stringify(value);}
function wordModal(id){const d=data(),word=d.words[id]||{id:uid(),collectionId:collectionFilter!=='all'?collectionFilter:Object.keys(d.collections)[0],latin:'',meanings:[['']]};if(!word.collectionId){notify('Lege zuerst eine Sammlung an.');return;}
 showModal(`<h2 id="modal-title">${id?'Vokabel bearbeiten':'Neue Vokabel'}</h2><form id="word-form" data-id="${h(word.id)}"><label>Sammlung<select name="collectionId">${[...sortedCollections(d),...(d.collections[word.collectionId]?.refreshSource?[d.collections[word.collectionId]]:[])].map(c=>`<option value="${h(c.id)}" ${word.collectionId===c.id?'selected':''}>${h(c.name)}</option>`).join('')}</select></label><label>${english?languageName():'Latein · alle angezeigten Formen'}<input name="latin" required maxlength="200" value="${h(word.latin)}" placeholder="${english?'hello':'vox, vocis'}" lang="${subjectInfo(subject).code}" autocorrect="off" autocapitalize="none" spellcheck="false"></label><label>Deutsche Bedeutungen</label><div id="meaning-inputs">${word.meanings.map(g=>meaningInput(g.join(' / '))).join('')}</div><button type="button" class="text-button" data-action="add-meaning">${icon('plus')} Bedeutung hinzufügen</button><p class="small muted" data-compact-hide>Eine Bedeutung pro Feld. Alternativen mit / trennen.</p><details><summary>Zusätzliche Suchformen (optional)</summary><label>Nur für den Vokabelsucher, mit Komma trennen<input name="forms" value="${h((word.forms||[]).join(', '))}" maxlength="10000" placeholder="${english?'z. B. went, gone':'z. B. vocem, voces, vocibus'}"></label></details><div class="button-row"><button type="submit" class="button primary">Speichern</button>${id?`<button type="button" class="button danger" data-action="delete-word" data-id="${h(id)}">${icon('trash')} Löschen</button>`:''}</div></form>`);}
function meaningInput(value=''){return `<div class="meaning-input"><input name="meaning" value="${h(value)}" required maxlength="300" aria-label="Deutsche Bedeutung"><button type="button" class="icon-button" data-action="remove-meaning" aria-label="Bedeutung entfernen">${icon('close')}</button></div>`;}
function importModal(){showModal(`<h2 id="modal-title">Eine neue Sammlung</h2><p class="muted" data-compact-hide>Vokabel-, Auffrisch- oder Perfekt-Sammlung auswählen. Das Dateiformat bestimmt den Zielbereich.</p><label class="file-drop">${icon('upload')}<strong>JSON-Datei auswählen</strong><input type="file" id="import-file" accept=".json,application/json"></label><div id="import-preview"></div>`);}
let importCandidate=null,importRaw=null,importResolutions={};
function renderImportPreview(){
 if(importRaw?.format==='latinio-predicates'){
  if(english)throw Error('Perfekt-Sammlungen bitte im Lernfach Latein importieren.');
  const parsed=parsePredicateFile(importRaw);importCandidate={predicate:true,...parsed};
  document.querySelector('#import-preview').innerHTML=`<h3>${h(parsed.name)}</h3><p>${parsed.items.length} Formen · Perfekt-Sammlung</p><button class="button primary wide" data-action="confirm-import">Sammlung importieren</button>`;return;
 }

 importCandidate=parseCollectionFile(english?englishImport(importRaw):importRaw,data(),importResolutions);const x=importCandidate,deck=!!x.deck;
 const name=x.deck?.name||x.collection?.name||importRaw?.name||'Sammlung';
 const count=x.deck?.members.length??x.words.length;
 const resolutions=(x.unmatched||[]).map(row=>`<div class="import-resolution"><strong>${h(row.latin)}</strong><small class="muted">${h(row.meanings.map(g=>g[0]).join(' · '))}</small><label>Passende vorhandene Vokabel auswählen<select data-import-resolve="${row.index}"><option value="">Zuordnung auswählen …</option>${(row.candidates.length?row.candidates:x.available).map(w=>`<option value="${h(w.id)}">${h(w.latin)} · ${h(w.collection)}</option>`).join('')}${row.candidates.length&&row.candidates.length<x.available.length?'<optgroup label="Alle Vokabeln">'+x.available.filter(w=>!row.candidates.some(c=>c.id===w.id)).map(w=>`<option value="${h(w.id)}">${h(w.latin)} · ${h(w.collection)}</option>`).join('')+'</optgroup>':''}<optgroup label="Kein passendes vorhandenes Wort"><option value="new">Als neue Vokabel aus der Datei übernehmen</option></optgroup></select></label></div>`).join('');
 document.querySelector('#import-preview').innerHTML=`<h3>${h(name)}</h3><p>${count} Vokabeln${x.skipped?` · ${x.skipped} doppelte Einträge übersprungen`:''}${deck?` · Auffrisch-Sammlung · ${x.linked} vorhandene Wörter verknüpft`:''}</p>${resolutions?`<p class="small">${x.unmatched.length} Vokabel${x.unmatched.length===1?' muss':'n müssen'} noch manuell zugeordnet werden. So bleiben Originalschreibung und Lernstand erhalten.</p>${resolutions}`:''}<ul>${(x.previewWords||x.words).slice(0,4).map(w=>`<li><strong>${h(w.latin)}</strong> – ${h(w.meanings.map(g=>g[0]).join(', '))}</li>`).join('')}</ul><button class="button primary wide" data-action="confirm-import" ${x.unmatched?.length?'disabled':''}>${x.unmatched?.length?'Bitte erst alle Vokabeln zuordnen':'Sammlung importieren'}</button>`;
}
function trainingOptions(){
 const d=data(),direction=d.settings.general?.direction??'mixed';
 const counts=trainingOptionCounts(d,selected,{direction:english?direction:null});
 showModal(`<h2 id="modal-title">Mehr Optionen</h2><p class="muted">Für deine Trainingsauswahl${english?' · '+directionLabel(direction):''}.</p>${!counts.total?emptyOptionsMarkup('Vokabeln'):''}<div class="word-tools" ${!counts.total?'data-waiting-options="vocab"':''}>${trainingOptionButtons(counts)}</div>`);
}
function emptyOptionsMessage(kind){return cloudWait?.blocked?'Deine Sammlungen werden geladen …':`Für diese Auswahl sind noch keine ${kind} verfügbar.`;}
function emptyOptionsMarkup(kind){return `<div data-options-empty><p>${emptyOptionsMessage(kind)}</p><button class="text-button" data-action="nav" data-screen="collections">Sammlungen auswählen</button></div>`;}
function trainingOptionButtons({learning,known,total}){return `<button class="button secondary wide" data-action="start-refresh" ${!known?'disabled':''}>Auffrischen · ${known} sichere ${english?'Aufgaben':'Wörter'}</button><button class="button secondary wide" data-action="start-learning" ${!learning?'disabled':''}>Noch unsichere Wörter üben · ${learning}</button><button class="button secondary wide" data-action="start-all" ${!total?'disabled':''}>Alle ausgewählten ${english?'Richtungen':'Vokabeln'} üben · ${total}</button>`;}
function updateWaitingOptions(){
 const node=modalRoot.querySelector('[data-waiting-options]');if(!node?.dataset?.waitingOptions)return;
 const hint=modalRoot.querySelector('[data-options-empty] p');if(hint)hint.textContent=emptyOptionsMessage(node.dataset.waitingOptions==='vocab'?'Vokabeln':'Prädikate');
 const d=data();let markup;
 if(node.dataset.waitingOptions==='vocab'){
  const active=trainingDecks(d).filter(deck=>deck.active).map(deck=>deck.id);
  const ids=selected.length?selected.filter(id=>active.includes(id)):active;
  const counts=trainingOptionCounts(d,ids,{direction:english?(d.settings.general?.direction??'mixed'):null});
  if(!counts.total)return;selected=ids;markup=trainingOptionButtons(counts);
 }else{
  const ids=selectedPredicateDecks(d);if(!predicateQueue(d,ids,'all').length)return;
  markup=predicateOptionButtons(d,ids);
 }
 node.innerHTML=markup;node.removeAttribute('data-waiting-options');
 const empty=node.closest('.modal')?.querySelector('[data-options-empty]'),restoreFocus=empty?.contains?.(document.activeElement);
 empty?.remove();if(restoreFocus)node.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
function startOptionsView(){return `<h2 id="modal-title">Vor der Runde</h2><p class="muted">Lege fest, wann ein Wort als richtig zählt.</p><label class="setting-row"><span><strong>Alle Bedeutungen nötig</strong><small>Ausgeschaltet: Eine richtige Bedeutung genügt.</small></span><input class="switch" id="round-require-all" type="checkbox" ${prefs().meaningRequirement!=='any'?'checked':''}></label><button class="button primary wide" data-action="confirm-start">Runde starten ${icon('arrow')}</button>`;}
async function start(mode='smart',ids=selected,refreshTarget=null,meaningRequirement=null){
 if(meaningRequirement===null&&mode!=='inactive-check'){
  pendingStart={mode,ids:[...ids],refreshTarget};showModal(startOptionsView());return;
 }
 void backgroundSync();
 if(store.doc.session||store.doc.matchRound)await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});
 if(!ids.length&&!mode.startsWith('inactive-')){notify('Wähle mindestens eine Sammlung aus.');return;}
 const chosen=mode.startsWith('inactive-')?inactiveQueue(data(),ids,mode,prefs().daily):null;
 const cardDirection=mode==='inactive-check'?refreshFlow?.direction||data().settings[refreshTarget]?.direction||data().settings[ids[0]]?.direction||'both':prefs().direction;
 const selectedQueue=english?mode.startsWith('inactive-')?chosen.flatMap(wordId=>directionsFor(cardDirection).map(direction=>({wordId,direction}))):englishTasks(data(),ids,mode,prefs().daily,prefs().direction):mode.startsWith('inactive-')?chosen:chooseWords(data(),ids,prefs().daily,mode);
 const queue=shuffleQueue(selectedQueue);
 if(!queue.length){notify(mode==='refresh'?'In dieser Auswahl sind noch keine sicheren Vokabeln zum Auffrischen.':mode==='learning'?'Diese Vokabeln sind schon sicher. Nutze Auffrischen oder wiederhole alle.':'In dieser Auswahl sind keine Vokabeln.');return;}
 closeModal();
 const session={id:uid(),mode,sourceIds:ids,refreshTarget,meaningRequirement:meaningRequirement||prefs().meaningRequirement||'all',cardFlipped:false,queue:queue.map(entry=>english?{...entry,repeat:false}:{wordId:entry,repeat:false}),cursor:0,originalLength:queue.length,answers:[''],feedback:null,overrides:{},startedAt:Date.now(),finished:false,retryStage:1,allWordIds:queue.map(entry=>english?entry.wordId:entry)};
 session.completionRoot=completionRoot(session,data());
 await store.update(doc=>{doc.session=session;return doc;});await store.recordActivity?.('started');sync.schedule();screen='test';render();
}
function current(){const session=store.doc.session;if(!session)return {};const item=session.queue[session.cursor];return {session,item,word:data().words[item?.wordId]};}
function reviewKey(session,cursor=session.cursor){return `${session.id}-${cursor}`;}
function renderTest(){const {session,item,word}=current();if(!session){screen='learn';render();return;}if(!word){app.innerHTML=`<main class="test-shell"><h1>Diese Vokabel wurde gelöscht.</h1><button class="button primary" data-action="next">Weiter</button></main>`;return;}
 if(session.mode==='inactive-check'){app.innerHTML=refreshCardView(session,word,h,icon,subject);const cursor=session.cursor;bindRefreshSwipe(app.querySelector('.refresh-card'),known=>{void actions({preventDefault(){},target:{closest:()=>({dataset:{action:known?'refresh-card-known':'refresh-card-wrong',cursor:String(cursor)}})}});});return;}
 const feedback=session.feedback;const pct=Math.round(session.cursor/session.queue.length*100);
 const target=english?answerWord(word,item.direction):word;
 app.innerHTML=`<main class="test-shell"><header class="test-top"><button class="icon-button" data-action="pause" aria-label="Runde beenden">${icon('close')}</button><div class="test-progress"><div style="width:${pct}%"></div></div><span class="small muted">${session.cursor+1} / ${session.queue.length}</span></header><div class="test-content"><div class="eyebrow">${session.mode==='errors'?`STUFE ${session.retryStage} · FEHLER WIEDERHOLEN`:english?directionLabel(item.direction).toUpperCase():'LATEIN → DEUTSCH'}</div><div class="test-title"><h1>${english&&item.direction==='de-en'?'Wie heißt auf '+languageName()+' …':'Was bedeutet …'}</h1><button class="icon-button" data-action="edit-word" data-id="${h(word.id)}" aria-label="Vokabel bearbeiten">${icon('edit')}</button></div><div class="latin-word" lang="${english?item.direction==='de-en'?'de':subjectInfo(subject).code:'la'}">${h(english?promptFor(word,item.direction):word.latin)}</div>${translationCard(target,feedback,english&&item.direction==='de-en'?subjectInfo(subject).code:'de')}${!feedback?'<p class="muted test-help" data-compact-hide>Schreibe die Bedeutungen auf, die du kennst.</p>':''}<form id="answer-form"><div id="answers">${feedback?answerFeedback(feedback):session.answers.map((a,i)=>answerInput(a,i,false)).join('')}</div>${!feedback?`<button type="button" class="add-answer" data-action="add-answer">${icon('plus')} Weitere Bedeutung</button>`:''}${session.correctionMode?`<section class="correction-practice" aria-live="polite"><p class="small muted">Noch einmal üben · ohne Wertung</p><div id="practice-answers">${session.correctionAnswers.map((a,i)=>answerInput(a,i,false)).join('')}</div>${session.correctionResult?`<p class="practice-result ${session.correctionResult.grade==='full'?'correct':'incorrect'}">${session.correctionResult.grade==='full'?'Richtig! Enter führt weiter.':'Noch nicht richtig. Ändere deine Antwort und versuche es erneut.'}</p>`:''}<button type="button" class="add-answer" data-action="practice-add">${icon('plus')} Weitere Bedeutung</button></section>`:''}<div class="test-feedback">${feedback?feedbackView(word,feedback)+(english?'':confusions.prompt(word,feedback,session)):''}</div><footer class="test-footer ${feedback?'compact-footer':''}">${session.correctionMode?(session.correctionResult?.grade==='full'?`<button class="button primary wide" type="button" data-action="next">Weiter ${icon('arrow')}</button>`:`<button class="button primary wide" type="button" data-action="retry-submit">Prüfen ${icon('check')}</button>`):feedback?`<button class="button primary wide" type="button" data-action="next">Weiter ${icon('arrow')}</button>`:`<button class="text-button" type="button" data-action="dont-know">Weiß ich noch nicht</button><button class="button primary" type="submit">Prüfen ${icon('check')}</button>`}</footer></form></div></main>`;
 if(!feedback)document.querySelector('#answers input')?.focus({preventScroll:true});
}
function answerInput(value,i,disabled){const toEnglish=english&&current().item?.direction==='de-en';return `<div class="answer-row"><span>${i+1}</span><input name="answer" value="${h(value)}" placeholder="${toEnglish?'Wort auf '+languageName():'Deutsche Bedeutung'}" aria-label="${toEnglish?'Antwort auf '+languageName():'Deutsche Bedeutung'} ${i+1}" lang="${toEnglish?subjectInfo(subject).code:'de'}" inputmode="text" autocomplete="${toEnglish?'off':'on'}" autocorrect="${toEnglish?'off':'on'}" autocapitalize="${toEnglish?'none':'sentences'}" spellcheck="${toEnglish?'false':'true'}" maxlength="300" ${disabled?'readonly':''}>${!disabled&&i>0?`<button type="button" class="icon-button" data-action="remove-answer" data-index="${i}" aria-label="Antwortfeld entfernen">${icon('close')}</button>`:''}</div>`;}
function feedbackView(word,f){const title={full:f.meaningRequirement==='any'?'Bedeutung erkannt!':'Alles richtig!',partial:'Richtig – noch nicht vollständig.',wrong:'Noch nicht ganz.'}[f.grade];return `<section class="feedback compact-feedback ${f.grade}" aria-live="polite"><h2>${icon(f.grade==='wrong'?'repeat':'check')} ${title}</h2><button type="button" class="icon-button" data-action="edit-word" data-id="${h(word.id)}" aria-label="Vokabeleintrag korrigieren">${icon('edit')}</button></section>`;}

function readAnswers(){return [...document.querySelectorAll('#answers input')].map(el=>el.value);}
async function checkAnswer(skip=false){const {session,word,item}=current();if(!word||session.feedback)return;const answers=readAnswers();if(!skip&&!hasAnswerContent(answers))return;session.answers=answers;if(skip)session.answers=[''];session.overrides={};session.feedback=evaluateSession(english?answerWord(word,item.direction):word,session.answers,english?item.direction==='en-de'&&prefs().typos:prefs().typos,{},session);const review={id:reviewKey(session),wordId:word.id,direction:item.direction,grade:session.feedback.grade,at:Date.now(),repeat:!!item.repeat,mode:session.mode||'smart',meaningRequirement:session.meaningRequirement||'all',retryStage:session.retryStage||1,answers:session.answers};await store.commit([['reviews',review.id,review]],session);sync.schedule();render();}
async function beginCorrection(initial=''){const {session}=current();if(!session?.feedback||session.feedback.grade==='full')return;session.correctionMode=true;session.correctionAnswers=[initial];session.correctionResult=null;await store.update(doc=>{doc.session=session;return doc;});render();const input=document.querySelector('#practice-answers input');focusInput(input);input?.setSelectionRange?.(input.value.length,input.value.length);}
async function submitCorrection(){const {session,word,item}=current();if(!session?.correctionMode||!word)return;const answers=[...document.querySelectorAll('#practice-answers input[name="answer"]')].map(el=>el.value);if(!hasAnswerContent(answers))return;session.correctionAnswers=answers;session.correctionResult=evaluateSession(english?answerWord(word,item.direction):word,answers,english?item.direction==='en-de'&&prefs().typos:prefs().typos,{},session);await store.update(doc=>{doc.session=session;return doc;});render();if(session.correctionResult.grade!=='full')document.querySelector('#practice-answers input')?.focus({preventScroll:true});}
function appendCorrectionField(){const host=document.querySelector('#practice-answers');if(!host)return;const index=host.querySelectorAll('[name="answer"]').length;host.insertAdjacentHTML('beforeend',answerInput('',index,false));focusInput(host.lastElementChild?.querySelector('input'));}
async function reevaluate(){const {session,word,item}=current();if(!session.feedback||!word)return;session.feedback=evaluateSession(english?answerWord(word,item.direction):word,session.answers,english?item.direction==='en-de'&&prefs().typos:prefs().typos,session.overrides,session);const key=reviewKey(session);const review={...data().reviews[key],grade:session.feedback.grade,answers:session.answers};await store.commit([['reviews',key,review]],session);sync.schedule();render();}
async function finishSession(session){if(session.finished)return;session.finished=true;await store.commit([['sessions',session.id,{id:session.id,at:Date.now(),count:session.originalLength}]],session);sync.schedule(0);await showResult();}
async function next(){const {session,word}=current();if(!session||session.finished)return;
 if(session.correctionMode){if(session.correctionResult?.grade!=='full')return;delete session.correctionMode;delete session.correctionAnswers;delete session.correctionResult;}
 if(session.mode==='inactive-check'){await rateCard(false);return;}
 if(word&&!session.feedback)return;
 session.cursor++;session.answers=[''];session.feedback=null;session.overrides={};
 if(session.cursor>=session.queue.length){await finishSession(session);return;}await store.update(doc=>{doc.session=session;return doc;});render();}
async function rateCard(known){const transition=rateRefresh(data(),store.doc.session,known);if(!transition)return;await store.commit(transition.ops,transition.session);sync.schedule(0);if(transition.session.finished)await showResult();else render();}

async function changePrefs(changes){await store.commit([['settings','general',{...prefs(),...changes}]]);sync.schedule();render();}
async function actions(event){const button=event.target.closest('[data-action]');if(!button)return;event.preventDefault();const action=button.dataset.action,id=button.dataset.id;
 if(!ready||subjectTransition)return;
 if(!['collection-open','refresh-tools','predicate-open'].includes(action))collectionOpener.cancel();
 if(['collection-open','refresh-tools','predicate-open','collection-tab','nav','close-modal'].includes(action)){
  if(['collection-open','refresh-tools','predicate-open'].includes(action)){
   const originStore=store,originScreen=screen;
   try{await collectionOpener.open(button,()=>{
    collectionFilter=id;search='';screen=action==='predicate-open'?'predicate-detail':'collection-detail';
    if(action==='predicate-open')collectionTab='predicates';
    closeModal();render();
   },()=>store===originStore&&screen===originScreen);}catch(error){notify(error.message);}
   return;
  }
  if(action==='close-modal'){closeModal();return;}
  if(action==='nav'){
   if(button.dataset.screen==='admin'){if(isAdmin())void sharing.handle({dataset:{action:'account-profiles'}}).catch(error=>notify(error.message));return;}
   if(!['learn','collections','classroom','settings'].includes(button.dataset.screen))return;
   screen=button.dataset.screen;if(screen==='collections'){collectionFilter='all';search='';collectionsSearchOpen=false;}
  }else if(action==='collection-tab')collectionTab=id;
  closeModal();render();return;
 }
 if(['account-profiles','share-panel','sharing-check','announcement-history','notification-admin'].includes(action)&&isAdmin()){
  try{
   if(action==='announcement-history')showAnnouncementHistory();
   else void Promise.resolve(action==='notification-admin'?reminders.handle(button):sharing.handle(button)).catch(error=>notify(error.message));
  }catch(error){notify(error.message);}return;
 }
 if(action==='cloud-dismiss'){cloudNotice.dismiss();return;}
 if(action==='cloud-retry'||action==='retry-sync'){void cloudNotice.retry();return;}
 if(working){notify('Die vorige Aktion wird noch abgeschlossen …');return;}
 const starts=['start','start-all','start-learning','start-refresh','confirm-start','predicate-start','predicate-mode','inactive-practice','refresh-check','refresh-select-test','confusion-practice'].includes(action);
 if(starts&&waitingStart)return;
 if(starts&&cloudWait?.blocked){
  waitingStart=true;
  try{await waitForInitialSync(cloudWait,button);}finally{waitingStart=false;}
  if(!button.isConnected||working)return;
  const active=trainingDecks(data()).filter(deck=>deck.active).map(deck=>deck.id);selected=selected.filter(id=>active.includes(id));if(!selected.length)selected=active;
 }
 working=true;
 let actionDots=null;
 const actionDotsTimer=setTimeout(()=>{if(button.isConnected){actionDots=document.createElement('span');actionDots.className='button-loading';actionDots.setAttribute('role','status');actionDots.setAttribute('aria-label','Wird geladen');actionDots.innerHTML='<i></i><i></i><i></i>';button.append(actionDots);button.setAttribute('aria-busy','true');}},140);
 try{
 if(subject==='latin'&&tablePractice?.handle(button))return;
 if(grammar?.handle(button))return;
 if(await reminders?.handle(button))return;
 if(await sharing.handle(button))return;if(await confusions.handle(button))return;switch(action){
 case 'subject-menu':showModal(`<h2 id="modal-title">Lernfach wechseln</h2><div class="word-tools">${SUBJECTS.filter(x=>subjectAllowed(x.id)).map(x=>`<button class="button secondary wide" data-action="switch-subject" data-id="${x.id}">${x.flag} ${x.label}${x.id===subject?' · aktuell':''}</button>`).join('')}</div>`);break;
 case 'switch-subject':{
  button.closest('details')?.removeAttribute('open');if(id===subject){closeModal();break;}if(!subjectAllowed(id))break;
  closeModal();subjectTransition=beginSubjectTransition(app,subject,id,{keyboard:event.detail===0});
  try{
   rememberSubject(id,localStorage);sessionStorage.setItem(TRANSITION_KEY,subject);sessionStorage.setItem(SUBJECT_SWITCH_KEY,id);
   // Local edits are already journaled. A cloud round trip is never a prerequisite for navigation.
   const url=new URL(location.href);url.searchParams.set('subject',id);await subjectTransition.entered;location.assign(url.href);
  }catch(error){subjectTransition.fail();subjectTransition=null;throw error;}
  break;
 }
 case 'announcement-compose':await composeAnnouncement();break;
 case 'announcement-history':await showAnnouncementHistory();break;
 case 'announcement-preview':{const item=announcementHistory.find(a=>a.id===id);if(item)announcementView(item,true);break;}
 case 'announcement-next':{const item=announcementQueue[0];if(!item||item.id!==id)break;await sync.request('announcementRead',{announcementId:id});announcementQueue.shift();if(announcementQueue.length)announcementView(announcementQueue[0]);else closeModal();break;}
 case 'collection-open':collectionFilter=id;search='';screen='collection-detail';render();break;
 case 'collection-tab':collectionTab=id;render();break;
 case 'collection-search-toggle':collectionsSearchOpen=!collectionsSearchOpen;if(!collectionsSearchOpen)search='';render();if(collectionsSearchOpen)requestAnimationFrame(()=>document.querySelector('#search')?.focus({preventScroll:true}));break;
 case 'refresh-new':showModal(refreshCreate(english,languageName()));break;
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
 case 'account-logout':try{await reminders.disable();}catch{}signOut();break;
 case 'check-update':await updates.check();break;
 case 'apply-update':await updates.apply();break;
 case 'nav':if(button.dataset.screen==='admin'){if(isAdmin())await sharing.handle({dataset:{action:'account-profiles'}});break;}screen=button.dataset.screen;if(screen==='collections'){collectionFilter='all';search='';collectionsSearchOpen=false;}closeModal();render();break;
 case 'start':await start();break;
 case 'predicate-start':startPredicatePractice();break;
 case 'predicate-options':predicateOptions();break;
 case 'predicate-mode':startPredicatePractice(id);break;
 case 'predicate-open':collectionFilter=id;collectionTab='predicates';screen='predicate-detail';render();break;
 case 'predicate-new':showModal(predicateDeckForm(null,h));break;
 case 'predicate-rename':showModal(predicateDeckForm(predicateDecks(data()).find(deck=>deck.id===id),h));break;
 case 'predicate-add':case 'predicate-edit':{const item=action==='predicate-edit'?predicateCloudItems(data()).find(row=>row.id===id):null;const deck=predicateDecks(data()).find(row=>row.id===(item?.deckId||id));if(deck)showModal(predicateItemForm(deck,item,h));break;}
 case 'predicate-delete-item':if(confirm('Diese Form löschen?')){await store.commit([['settings',id,null]]);sync.schedule();closeModal();render();}break;
 case 'predicate-delete':{if(!confirm('Diese Perfekt-Sammlung und ihre Formen löschen?'))break;await store.commit([['settings',id,null],...predicateCloudItems(data()).filter(item=>item.deckId===id).map(item=>['settings',item.id,null])]);sync.schedule();screen='collections';collectionTab='predicates';render();break;}
 case 'predicate-activity-all':{const active=button.dataset.active==='true';await store.commit(predicateDecks(data()).flatMap(deck=>predicateDeckChanges(data(),{...deck,active})));sync.schedule();render();break;}
 case 'share-notices-read':{const notices=unreadShareNotices(data());await store.commit(notices.map(n=>['settings','read_'+n.id,{kind:'shareNoticeRead',noticeId:n.id,at:Date.now()}]));closeModal();sync.schedule();void checkAnnouncements();break;}
 case 'predicate-next':if(!predicateFeedback)break;if(predicateCursor===predicateRun.length-1){await finishPredicateRound();break;}predicateCursor++;predicateAnswer='';predicateFeedback=null;render();break;
 case 'predicate-exit':predicateRun=[];predicateAnswer='';predicateFeedback=null;screen='learn';render();break;
 case 'predicate-example':{const example={format:'latinio-predicates',schema:1,name:'Meine Prädikate',predicates:[{grundform:'amare',praedikat:'amo, amare, amavi, amatum'},{grundform:'monere',praedikat:['moneo, monere, monui, monitum']}]};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(example,null,2)],{type:'application/json'}));a.download='latinio-praedikate-beispiel.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);break;}
 case 'confirm-start':{const pending=pendingStart;if(!pending)break;const requirement=document.querySelector('#round-require-all')?.checked?'all':'any';pendingStart=null;await store.commit([['settings','general',{...prefs(),meaningRequirement:requirement}]]);sync.schedule();await start(pending.mode,pending.ids,pending.refreshTarget,requirement);break;}
 case 'training-options':trainingOptions();break;
 case 'start-all':await start('all');break;
 
 case 'start-learning':await start('learning');break;
 case 'start-refresh':await start('refresh');break;
 case 'pause':await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});screen='learn';render();break;
 case 'round-finish':await acceptRoundEnd();break;
 case 'round-home':await returnFromRound();break;
 case 'finish':await returnFromRound();break;
 case 'retry-errors':await retryRoundErrors();break;
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
 case 'confirm-import':{if(!importCandidate)break;if(importCandidate.unmatched?.length)throw Error('Bitte ordne erst alle angezeigten Vokabeln zu.');const x=importCandidate;if(x.predicate){const imported=await importPredicateCollection(data(),x,'predicate_deck_'+uid());await store.commit(imported.changes);importCandidate=null;importRaw=null;closeModal();screen='collections';collectionTab='predicates';sync.schedule();render();notify(`${x.items.length} Formen importiert.`);break;}await store.commit(importChanges(x));importCandidate=null;importRaw=null;closeModal();screen='collections';collectionTab=x.deck?'refresh':'lessons';collectionFilter=x.deck?.id||x.collection.id;sync.schedule();render();notify(`${x.deck?x.deck.members.length:x.words.length} Vokabeln importiert.`);break;}
 case 'theme':await changePrefs({theme:id});break;
 case 'sync-now':void loadCloud();break;
 case 'remote':void loadCloud();break;
 case 'close-modal':closeModal();break;
 case 'admin-tests':if(isAdmin())showModal(streakLab(streakDemoDay,streakDemoTheme));break;
 case 'streak-demo':if(isAdmin()){streakDemoDay=Number(document.querySelector('#streak-demo-day')?.value)||1;streakDemoTheme=document.querySelector('#streak-demo-theme')?.value||'auto';streakDemoVariant=id;showStreakDemo();}break;
 case 'streak-demo-replay':if(isAdmin())showStreakDemo();break;
 case 'download-example':{const example={format:'latinio-collection',schema:1,name:'Meine neue Sammlung',words:english?[{english:'hello',german:['hallo']}]:[{latin:'exemplum',meanings:[['Beispiel']],forms:['exempla','exemplorum','exemplis']}]};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(example,null,2)],{type:'application/json'}));a.download=english?'latinio-englisch-beispiel.json':'latinio-import-beispiel.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);break;}
 }}catch(error){notify(error.message);}finally{clearTimeout(actionDotsTimer);actionDots?.remove();button.removeAttribute?.('aria-busy');working=false;flushCloudRender();void sharing?.afterAction();checkShareNotices();reminders?.maybePrompt?.();autoUpdate();}}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-action="add-answer"]');
 if(!button||!ready||working||cloudWait?.blocked||screen!=='test'||current().session?.feedback)return;
 event.preventDefault();event.stopImmediatePropagation();
 appendAnswerField(document,answerInput);
},true);
document.addEventListener('click',actions);
for(const type of ['dragstart','dragover','drop','dragend','pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{
 if(ready&&!working&&!modalRoot.children.length&&subject==='latin'&&screen==='tables')tablePractice?.drag?.(event);
},{passive:false});

installKeyboardSupport({root:document,active:()=>ready&&!working&&!cloudWait?.blocked&&!modalRoot.children.length&&screen==='test',session:()=>current().session,submit:()=>document.querySelector('#answer-form')?.requestSubmit?.(),next:()=>document.querySelector('#answer-form [data-action="next"]')?.click(),addField:()=>document.querySelector('#answer-form [data-action="add-answer"]')?.click(),addCorrectionField:appendCorrectionField,beginCorrection,submitCorrection,rateCard:known=>document.querySelector(`[data-action="refresh-card-${known?'known':'wrong'}"]`)?.click()});
installInputVisibility({root:document,active:()=>['test','predicate-test','tables','grammar'].includes(screen)&&!modalRoot.children.length});
document.addEventListener('toggle',event=>{const el=event.target;if(el.dataset?.panel&&el.isConnected){if(el.open)openPanels.add(el.dataset.panel);else openPanels.delete(el.dataset.panel);}},true);
document.addEventListener('input',event=>{if(screen==='tables'&&tablePractice?.input(event.target))return;if(event.target.dataset.grammarAnswer){grammar?.input(event.target);return;}if(sharing?.input?.(event.target))return;if(event.target.dataset.reconcileSearch!==undefined){const select=document.getElementById(`reconcile-select-${event.target.dataset.reconcileSearch}`),q=normalize(event.target.value),suggestions=JSON.parse(event.target.dataset.candidates||'[]'),available=Object.values(data().words).filter(w=>data().collections[w.collectionId]&&!data().collections[w.collectionId].refreshSource).map(w=>({id:w.id,latin:w.latin,collection:data().collections[w.collectionId].name,meanings:w.meanings}));if(select){const options=q?available.filter(w=>normalize(`${w.latin} ${w.meanings.flat().join(' ')} ${w.collection}`).includes(q)).slice(0,50):suggestions;select.innerHTML=`<option value="">Nicht zuordnen</option>${options.length?`<optgroup label="${q?'Suchtreffer':'Mögliche Treffer'}">${options.map(w=>`<option value="${h(w.id)}">${h(w.latin)} · ${h(w.collection)}</option>`).join('')}</optgroup>`:''}`;}}if(event.target.id==='refresh-word-search'){const q=normalize(event.target.value);document.querySelectorAll('[data-refresh-word-row]').forEach(row=>row.hidden=!normalize(row.textContent).includes(q));}if(event.target.id==='classroom-search'){classroomQuery=event.target.value;document.querySelector('#classroom-results').innerHTML=classroomResults(data(),classroomQuery,h,english,subject);}if(event.target.id==='search'){search=event.target.value;const results=document.querySelector('#collection-search-results');if(results)results.innerHTML=search.trim()?wordRows('all',search):'';else document.querySelector('#word-list').innerHTML=wordRows();}});
document.addEventListener('change',async event=>{const el=event.target;try{if(screen==='tables'&&tablePractice?.change(el))return;if(sharing?.change?.(el))return;
 if(el.id==='collection-select'){collectionFilter=el.value;render();}
 
 if(el.dataset.importResolve!==undefined){importResolutions[el.dataset.importResolve]=el.value;renderImportPreview();return;}
 if(el.dataset.refreshActive){const deck=data().settings[el.dataset.refreshActive];if(deck){await store.commit([['settings',deck.id,{...deck,active:el.checked}]]);sync.schedule();render();}}
 if(el.name==='target'&&el.closest('#refresh-form')){const label=document.querySelector('#refresh-name-label');label.hidden=!!el.value;label.querySelector('input').required=!el.value;}
 if(el.name==='word'&&el.closest('#refresh-form'))document.querySelector('#refresh-selected-count').textContent=document.querySelectorAll('#refresh-form [name=word]:checked').length+' Wörter ausgewählt';
 if(el.dataset.activity){await setActivity([el.dataset.activity],el.checked);}
 if(el.dataset.predicateSelect){predicateSelected=[...document.querySelectorAll('[data-predicate-select]:checked')].map(input=>input.dataset.predicateSelect);}
 if(el.dataset.predicateActive){const deck=predicateDecks(data()).find(row=>row.id===el.dataset.predicateActive);if(deck){await store.commit(predicateDeckChanges(data(),{...deck,active:el.checked}));sync.schedule();render();}}
 if(el.dataset.select){selected=[...document.querySelectorAll('[data-select]:checked')].map(e=>e.dataset.select);}
 if(el.id==='daily')await changePrefs({daily:Number(el.value)});
 if(el.id==='direction')await changePrefs({direction:el.value});
 if(el.id==='refresh-direction'&&refreshFlow){refreshFlow.direction=el.value;const deck=data().settings[refreshFlow.target];if(deck?.kind==='refreshDeck'){await store.commit([['settings',deck.id,{...deck,direction:el.value}]]);sync.schedule();}}
 if(el.id==='typos')await changePrefs({typos:el.checked});
 if(el.id==='import-file'&&el.files[0]){if(el.files[0].size>3000000)throw Error('Bitte eine Datei unter 3 MB auswählen.');importRaw=JSON.parse(await el.files[0].text());importResolutions={};renderImportPreview();}
 }catch(error){importCandidate=null;importRaw=null;notify(error.message);}});
document.addEventListener('submit',async event=>{event.preventDefault();if(!ready||working)return;working=true;const form=event.target;const fd=new FormData(form);try{
 if(screen==='tables'&&tablePractice?.submit(form))return;
 if(grammar?.submit(form))return;
 if(await reminders?.submit(form))return;
 if(await sharing.submit(form))return;
 if(form.id==='predicate-deck-form'){const name=String(fd.get('name')||'').trim();if(!name)throw Error('Bitte einen Namen eingeben.');const existing=predicateDecks(data()).find(deck=>deck.id===form.dataset.id);const deck={...existing,id:existing?.id||'predicate_deck_'+uid(),kind:'predicateDeck',name,active:existing?.active!==false};await store.commit(predicateDeckChanges(data(),deck));collectionFilter=deck.id;collectionTab='predicates';screen='predicate-detail';closeModal();sync.schedule();render();return;}
 if(form.id==='predicate-item-form'){const deck=predicateDecks(data()).find(row=>row.id===form.dataset.deck);if(!deck)throw Error('Sammlung nicht gefunden.');const parsed=parsePredicateFile({format:'latinio-predicates',schema:1,name:deck.name,predicates:[{grundform:fd.get('grundform'),praedikat:fd.get('praedikat')}]});const item=parsed.items[0],existing=predicateCloudItems(data()).find(row=>row.deckId===deck.id&&normalize(row.grundform)===normalize(item.grundform)&&row.id!==form.dataset.id);if(existing)throw Error('Diese Grundform ist bereits in der Sammlung vorhanden.');const id=form.dataset.id||'predicate_'+uid();await store.commit([['settings',id,{...item,id,kind:'predicateItem',deckId:deck.id,name:deck.name}]]);closeModal();sync.schedule();render();return;}
 if(form.id==='predicate-answer-form'){const answer=String(fd.get('answer')||'').trim();predicateAnswer=answer;const item=predicateRun[predicateCursor];predicateFeedback={correct:predicateMatches(item?.praedikate,answer)};const resultId='predicate_review_'+uid();await store.commit([['settings',resultId,{kind:'predicateReview',id:resultId,itemId:item.id,grundform:item.grundform,correct:predicateFeedback.correct,at:Date.now()}]]);predicateResults[predicateCursor]=predicateFeedback.correct;if(predicateRoot&&!Object.hasOwn(predicateRoot.first,item.id))predicateRoot.first[item.id]=predicateFeedback.correct;sync.schedule();render();document.querySelector('[data-action="predicate-next"]')?.focus({preventScroll:true});return;}
 if(form.id==='check-picker-form'){const ids=fd.getAll('lesson');if(!ids.length)throw Error('Wähle mindestens eine Lektion aus.');refreshFlow={target:form.dataset.target,sourceIds:ids,direction:refreshFlow?.direction||'both'};showModal(refreshMethod(english,refreshFlow.direction,languageName()));}
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
  if(!word.latin||!word.meanings.length)throw Error(languageName()+' und mindestens eine Bedeutung fehlen.');
  await store.commit([['words',word.id,word]]);closeModal();if(screen==='test'&&current().word?.id===word.id&&current().session.feedback){store.doc.session.overrides={};await reevaluate();}else render();sync.schedule();notify('Vokabel gespeichert.');
 }
 if(form.id==='collection-form'){const name=fd.get('name').trim();if(!name)throw Error('Bitte einen Namen eingeben.');const existing=data().settings[form.dataset.id];await store.commit([existing?.kind==='refreshDeck'?['settings',existing.id,{...existing,name}]:['collections',form.dataset.id,{id:form.dataset.id,name}]]);collectionFilter=form.dataset.id;search='';screen='collection-detail';closeModal();sync.schedule();render();}
 if(form.id==='remote-form'){
  const choices={};form.querySelectorAll('[data-conflict]').forEach(el=>choices[el.dataset.conflict]=el.value);form.querySelector('button').disabled=true;await sync.accept(choices);closeModal();render();notify('Cloud-Version geladen.');
 }
 if(form.id==='announcement-form'){
  form.querySelector('button').disabled=true;const result=await sync.request('announcementSend',{profileId:String(fd.get('profileId')),title:String(fd.get('title')),message:String(fd.get('message'))});closeModal();notify(`Nachricht gespeichert für ${result.announcement.profileId==='all'?'alle Nutzer':'den ausgewählten Nutzer'}.`);
 }
 }catch(error){notify(error.message);form.querySelectorAll('button').forEach(b=>b.disabled=false);}finally{working=false;flushCloudRender();void sharing?.afterAction();checkShareNotices();reminders?.maybePrompt?.();autoUpdate();}});
async function loadCloud(){await backgroundSync();}
async function boot(){try{
 const parameters=new URLSearchParams(location.search);const reminded=parameters.get('from')==='reminder'&&SUBJECTS.some(x=>x.id===parameters.get('subject'))?parameters.get('subject'):null;if(reminded){const cleaned=new URL(location.href);cleaned.searchParams.delete('from');history.replaceState(null,'',cleaned.href);}const direct=consumeSubjectSwitch(sessionStorage);subject=direct||reminded||await chooseSubject(app);rememberSubject(subject,localStorage);english=subject!=='latin';
 const from=sessionStorage.getItem(TRANSITION_KEY);sessionStorage.removeItem(TRANSITION_KEY);
 subjectTransition=beginSubjectTransition(app,from||subject,subject,{resume:true});subjectMetadata();
 arrive(app);
 ({store,profile}=await openAccount(app,{onLogin:()=>subjectTransition?.dispose()}));predicateKey=predicateStorageKey(profile.id);streakLedger=createStreakLedger({profileId:profile.id,storage:localStorage,locks:navigator.locks});
 if(profile.role!=='admin'&&Array.isArray(profile.allowedSubjects)&&!profile.allowedSubjects.includes(subject)){
  const allowed=profile.allowedSubjects.filter(id=>SUBJECTS.some(s=>s.id===id));const fallback=allowed.includes(english?'latin':'english')?(english?'latin':'english'):allowed[0];
  if(fallback){subject=fallback;english=subject!=='latin';rememberSubject(subject,localStorage);subjectMetadata();}else throw Error('Für dein Profil ist noch kein Lernfach freigeschaltet. Bitte wende dich an den Admin.');
 }
 if(subject!=='latin'){const latinStore=store,config=latinStore.doc.config;store=await new Store().open(profile.id,subject);await store.update(doc=>{doc.config={...config};doc.profile=profile;doc.seeded=true;return doc;});latinStore.close();}
 subjectMetadata();await store.seed();await store.listDeletedCollections();if(store.doc.session||store.doc.matchRound)await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});sync=new Sync(store);
 reminders=notificationsUI({sync,profile,h,showModal,showAdmin,isAdminView:tab=>screen==='admin'&&adminTab===tab,notify,render,closeModal,canPrompt:()=>ready&&!document.hidden&&!working&&!waitingStart&&!cloudWait?.blocked&&!announcementLoading&&!modalRoot.children.length&&['learn','collections','settings'].includes(screen)});
 if(isAdmin()&&subject==='english')grammar=grammarUI({profile,sync,h,go:()=>{closeModal();screen='grammar';},render,isVisible:()=>screen==='grammar',notify});
 if(subject==='latin')tablePractice=tablePracticeUI({profile,h,showModal,closeModal,go:(target='tables')=>{closeModal();screen=target;},render,notify});
 const shareContexts=new Map([[subject,{store,sync}]]);
 sharing=sharingUI({store,sync,profile,h,showModal,showAdmin,isAdminView:tab=>screen==='admin'&&adminTab===tab,closeModal,notify,render,openShareSubject:async next=>{if(shareContexts.has(next))return shareContexts.get(next);const nextStore=await new Store().open(profile.id,next);await nextStore.update(doc=>{doc.config={...store.doc.config};doc.profile=profile;doc.seeded=true;return doc;});await nextStore.seed();const nextSync=new Sync(nextStore);await settleSync(nextSync,nextStore);const context={store:nextStore,sync:nextSync};shareContexts.set(next,context);return context;},openCollection:id=>{collectionFilter=id;search='';screen='collection-detail';closeModal();render();}});
 sync.addEventListener('subject-restricted',event=>{
  const allowed=(event.allowedSubjects||[]).filter(id=>SUBJECTS.some(s=>s.id===id));const fallback=allowed.includes(english?'latin':'english')?(english?'latin':'english'):allowed[0];
  if(fallback){sessionStorage.setItem(SUBJECT_SWITCH_KEY,fallback);const target=new URL(location.href);target.searchParams.set('subject',fallback);location.replace(target.href);}else{ready=false;closeModal();app.innerHTML='<main class="boot"><h1>Kein Lernfach freigeschaltet</h1><p>Bitte wende dich an den Admin, um Latein oder Englisch freizuschalten.</p><button class="button secondary" id="restricted-logout">Abmelden</button></main>';app.querySelector('#restricted-logout')?.addEventListener('click',signOut);}
 });
 sync.addEventListener('profile-updated',event=>{profile={...profile,...event.profile};updateActiveProfile(profile);});
 sync.addEventListener('subjects-updated',event=>{profile={...profile,allowedSubjects:event.allowedSubjects};updateActiveProfile(profile);});
 cloudWait=cloudGate({sync,store,shouldBlock:()=>!Object.keys(data().collections).length&&!predicateDecks(data()).length,onError:error=>cloudNotice.fail(error),afterSync:async()=>{if(!english)await migrateLocalPredicates(store,readPredicateStore(localStorage,predicateKey));}});
 cloudNotice=createCloudNotice({sync,showModal,closeModal,reload:loadCloud,isOpen:()=>!!modalRoot.querySelector('[data-cloud-connection-notice]'),hasLocalContent:()=>{const d=data();return !!Object.keys(d.collections).length||!!predicateDecks(d).length;},canPrompt:()=>ready&&!document.hidden&&!working&&!waitingStart&&!subjectTransition&&!cloudWait?.blocked&&!modalRoot.children.length&&['learn','collections','collection-detail','predicate-detail','classroom','settings'].includes(screen)});
 confusions=confusionUI({store,sync,subject,h,showModal,closeModal,notify,go:target=>{if(target==='result')void showResult();else{screen=target;render();}},render});
 store.addEventListener('change',updateStatus);
 store.addEventListener('external',async()=>{streakLedger.merge(streakDays(data()));if(screen==='test'||screen==='match'){await store.update(doc=>{doc.session=null;doc.matchRound=null;return doc;});screen='learn';notify('Die laufende Runde wurde beendet. Bereits gespeicherte Antworten bleiben erhalten.');}if(!['grammar','tables'].includes(screen))render();});
 sync.addEventListener('change',updateStatus);
 sync.addEventListener('authentication-required',()=>signOut());
 sync.addEventListener('remote',()=>{if(!cloudWait.blocked)void loadCloud();});
 ready=true;void reminders.refresh().then(()=>reminders.maybePrompt());const startup=cloudWait.run();render();arrive(app);subjectTransition?.finish();subjectTransition=null;
 void startup.then(async()=>{void refreshStreak();await store.recordActivity('opened');sync.schedule();renderCloudChanges();updateStatus();checkShareNotices();void checkAnnouncements();void reportAppVersion();}).catch(error=>notify(error.message));
 async function reportAppVersion(){if(!ready||isAdmin()||!sync?.configured||!navigator.onLine||store.doc.appVersionReported===APP_VERSION)return;try{await sync.request('profileVersion',{version:APP_VERSION});await store.update(doc=>{doc.appVersionReported=APP_VERSION;return doc;});}catch{}}
 async function resume(){if(!ready||document.hidden)return;void reminders.refresh().then(()=>reminders.maybePrompt());await store.recordActivity('opened');await loadCloud();checkShareNotices();if(screen==='learn'||screen==='collections'||screen==='collection-detail'||screen==='settings')void checkAnnouncements();void updates.check();}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(screen==='test'&&!store.doc.session?.feedback)void preserveTestDraft(store,screen,readAnswers());}else void resume();});
 window.addEventListener('pageshow',event=>{if(event.persisted)void resume();});
 setInterval(()=>{if(!document.hidden){if(screen==='learn'&&!modalRoot.children.length)render();void backgroundSync();void updates.check();autoUpdate();}},60000);
 window.addEventListener('storage',event=>{if(event.key===streakLedger.key&&screen==='learn'&&!modalRoot.children.length)render();});
 window.addEventListener('online',()=>{void updates.check();void reportAppVersion();void resume();});
 }catch(error){subjectTransition?.fail();subjectTransition=null;app.innerHTML=`<main class="boot"><h1>Die App konnte nicht starten.</h1><p>Deine gespeicherten Lernstände bleiben erhalten. Lade die App erneut, um es noch einmal zu versuchen.</p><p class="muted">${h(error.message)}</p><button class="button primary" onclick="location.reload()">Erneut laden</button></main>`;}}
// Keep the browser chrome in sync during subject selection, login and startup errors too.
theme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',theme);
boot();
