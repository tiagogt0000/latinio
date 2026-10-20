const TITLE='Wann brauche ich Hilfsverben?';
const TOPIC='english-auxiliaries-v1';
const labels={correct:'Richtig',incorrect:'Falsch',uncertain:'Nicht eindeutig bewertbar',not_answered:'Nicht beantwortet'};
const dimensions={target:'Hilfsverben',otherGrammar:'Weitere Grammatik',vocabulary:'Wortwahl',content:'Inhalt'};
export function grammarCard(){return '<section class="training-card grammar-card"><div class="section-top"><span class="tag">ENGLISCH · NUR FÜR DICH</span><span class="grammar-spark" aria-hidden="true">✦</span></div><h2>Grammatik lernen</h2><p>do, does oder doch is? Kleine Runden, die auf deine Fragen eingehen.</p><button class="button primary wide" data-action="grammar-open">Hilfsverben verstehen <span aria-hidden="true">→</span></button><div class="card-foot">KI-Aufgaben · persönliches Feedback</div></section>';}

export function grammarUI({profile,sync,h,go,render,isVisible,notify,storage=globalThis.localStorage,online=()=>globalThis.navigator?.onLine!==false,id=()=>crypto.randomUUID(),confirm=message=>globalThis.confirm(message)}){
 const cacheKey='latinio-grammar-v1:'+profile.id;
 let cache={count:5,mode:'intro',index:0,round:null,dirty:false,pending:null},state=null,busy='',error='',storageError='',remoteConflict=null,saveTimer=null,saving=null,history=[],historyMore=false;
 try{const raw=JSON.parse(storage.getItem(cacheKey)||'null');if(raw&&[3,5,10].includes(raw.count)&&(!raw.round||Array.isArray(raw.round.tasks)))cache={...cache,...raw};}catch{}
 // Cached state never contains the API key. It exists only in its password input until submission.
 function persist(){try{storage.setItem(cacheKey,JSON.stringify(cache));storageError='';}catch{storageError='Auf diesem Gerät konnte der Entwurf nicht gespeichert werden. Bitte die App geöffnet lassen.';}}
 function paint(){if(isVisible())render();}
 const request=(action,payload={})=>sync.request(action,payload);
 function statusText(){return storageError||(!online()?'Offline · Antworten bleiben auf diesem Gerät':cache.dirty?'Entwurf auf diesem Gerät · noch nicht auf dem Pi':'Auf dem Pi gespeichert');}
 function updateSaveLabel(){const element=globalThis.document?.querySelector('[data-grammar-save]');if(element)element.textContent=statusText();}
 async function flush(){
  clearTimeout(saveTimer);
  if(saving){await saving;if(cache.dirty)return flush();return;}
  if(!cache.round||cache.round.evaluations.length||!cache.dirty)return;
  if(!online())throw Error('Du bist offline. Deine Antworten bleiben auf diesem Gerät.');
  const roundId=cache.round.id,revision=cache.round.revision,answers={...cache.round.answers};
  saving=request('grammarSave',{roundId,revision,answers}).then(result=>{
   if(cache.round?.id!==roundId)return;
   cache.round.revision=result.round.revision;cache.dirty=JSON.stringify(cache.round.answers)!==JSON.stringify(answers);persist();updateSaveLabel();
  }).finally(()=>{saving=null;});
  await saving;if(cache.dirty)await flush();
 }
 function accept(result){error='';if(result.state){state=result.state;history=state.rounds;historyMore=history.length<state.roundCount;}cache.round=result.round;cache.dirty=false;cache.pending=null;cache.index=0;cache.mode=cache.round.evaluations.length?'results':'question';remoteConflict=null;persist();}
 async function load(){
  try{
   if(!online())return;
   state=await request('grammarStatus');history=state.rounds;historyMore=history.length<state.roundCount;
   if(cache.pending){
    const operation=await request('grammarOperation',{requestId:cache.pending.payload.requestId});
    if(operation.status==='done'){accept({...operation,state});return;}
    error=operation.status==='running'?'Deine KI-Anfrage läuft noch. Mit „Erneut versuchen“ rufst du denselben Auftrag ab.':operation.error||'Eine Anfrage wurde unterbrochen. Du kannst sie bewusst erneut versuchen.';
    return;
   }
   if(cache.round){
    const result=await request('grammarRound',{roundId:cache.round.id});
    if(cache.dirty&&result.round.revision!==cache.round.revision){remoteConflict=result.round;error='Auf dem Pi liegt ein anderer Stand dieser Runde. Vergleiche beide Entwürfe, bevor du weitermachst.';}
    else if(!cache.dirty){const oldMode=cache.mode;cache.round=result.round;if(result.round.evaluations.length&&['question','review'].includes(oldMode))cache.mode='results';persist();}
    else await flush();
   }else if(state.latest){cache.round=state.latest;persist();}
  }catch(e){error=e.message;}
  finally{paint();}
 }
 async function run(message,work){
  if(busy)return;busy=message;error='';paint();
  try{await work();}catch(e){error=e.name==='AbortError'?'Die Verbindung wurde unterbrochen. Deine Antworten bleiben erhalten. Bitte erneut versuchen.':e.message;}
  finally{busy='';persist();paint();}
 }
 async function performPending(){
  if(!online())throw Error('Für neue Aufgaben und die KI-Korrektur brauchst du eine Internetverbindung. Deine Antworten bleiben erhalten.');
  const pending=cache.pending;if(!pending)return;
  const result=await request(pending.action,pending.payload);accept(result);
 }
 function tools(){return `<div class="grammar-tools"><button class="text-button" data-action="grammar-intro">Thema</button><button class="text-button" data-action="grammar-history">Lernverlauf</button><button class="text-button" data-action="grammar-settings">KI-Einstellungen</button></div>`;}
 function sizes(){return `<fieldset class="grammar-sizes"><legend>Aufgaben pro Runde</legend>${[3,5,10].map(n=>`<button type="button" class="chip ${cache.count===n?'selected':''}" aria-pressed="${cache.count===n}" data-action="grammar-count" data-id="${n}">${n}</button>`).join('')}</fieldset>`;}
 function intro(){return `<section class="grammar-panel"><span class="tag">DEIN ERSTES THEMA</span><h2>${TITLE}</h2><p class="muted">Finde heraus, wann du do, does, did, be oder can brauchst – und wann kein zusätzliches Hilfsverb nötig ist.</p><details class="grammar-rules"><summary>Die Regeln kurz erklärt</summary>${(state?.topic.goals||[]).map(g=>`<article><strong>${h(g.title)}</strong><p>${h(g.rule)}</p><p lang="en">${h(g.example)}</p></article>`).join('')||'<p>Verbinde dich einmal mit dem Pi, um die Regeln zu laden.</p>'}<p class="small muted">like swimming und like to swim können beide richtig sein. Die -ing-Form nach like oder go ist etwas anderes als be + -ing.</p></details>${sizes()}<button class="button primary wide" data-action="grammar-generate" ${!online()||!state?.configured?'disabled':''}>Neue Aufgaben generieren</button><p class="small muted">Alle Antworten werden gemeinsam am Ende kontrolliert. Rechtschreibung und Großschreibung zählen nicht.</p>${cache.round?`<button class="button secondary wide" data-action="grammar-resume">${cache.round.evaluations.length?'Letzte Auswertung ansehen':'Offene Runde fortsetzen'} · ${cache.round.tasks.length} Aufgaben</button>`:''}</section>${state&&!state.configured?'<section class="grammar-notice"><strong>Einmal kurz einrichten</strong><p>Hinterlege deinen OVHcloud-Schlüssel in den KI-Einstellungen. Er wird ausschließlich auf deinem Pi gespeichert.</p><button class="text-button" data-action="grammar-settings">KI einrichten →</button></section>':''}${statsView()}`;}
 function statsView(){return state?`<section class="grammar-panel"><h2>Dein Lernprofil</h2><p class="small muted">Zielgrammatik aus den letzten 30 Runden. Unklare Bewertungen und reine Wortschatzfehler verschlechtern diesen Stand nicht.</p><div class="grammar-stats">${state.stats.map(s=>`<article><strong>${h(s.title)}</strong><span>${s.correct} richtig · ${s.incorrect} üben${s.uncertain?' · '+s.uncertain+' unklar':''}</span></article>`).join('')}</div></section>`:'';}
 function question(){
  const r=cache.round;if(!r)return intro();cache.index=Math.min(cache.index,r.tasks.length-1);const t=r.tasks[cache.index];
  return `<section class="grammar-panel grammar-question"><div class="section-top"><span class="tag">HILFSVERBEN</span><span>Aufgabe ${cache.index+1} von ${r.tasks.length}</span></div><progress max="${r.tasks.length}" value="${cache.index}" aria-label="Rundenfortschritt"></progress><h2>${h(t.promptDe)}</h2><p class="small muted">Schreibe den Satz auf Englisch.</p>${t.vocabularyHint?`<details class="grammar-hint"><summary>Vokabelhilfe</summary><p>${h(t.vocabularyHint)}</p></details>`:''}<form id="grammar-answer-form"><label for="grammar-answer">Deine Antwort</label><textarea id="grammar-answer" name="answer" data-grammar-answer="${h(t.id)}" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="1000" rows="3" placeholder="Your answer …">${h(r.answers[t.id]||'')}</textarea><p class="small muted" data-grammar-save role="status">${h(statusText())}</p><div class="grammar-actions"><button type="button" class="text-button" data-action="grammar-prev" ${!cache.index?'disabled':''}>Zurück</button><button class="button primary" type="submit">${cache.index===r.tasks.length-1?'Antworten ansehen':'Weiter'} →</button></div><button class="text-button wide" type="button" data-action="grammar-unknown">Weiß ich nicht · weiter</button></form></section>`;
 }
 function review(){const r=cache.round;if(!r)return intro();return `<section class="grammar-panel"><h2>Bereit zur Kontrolle?</h2><p class="muted">Du kannst noch alles ändern. Danach kontrolliert die KI die ganze Runde.</p>${r.tasks.map((t,i)=>`<article class="grammar-review-row"><label for="grammar-review-${i}"><strong>${i+1}. ${h(t.promptDe)}</strong></label><textarea id="grammar-review-${i}" data-grammar-answer="${h(t.id)}" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="1000" rows="2">${h(r.answers[t.id]||'')}</textarea><span class="small muted">Leer lassen = nicht beantwortet</span></article>`).join('')}<p class="small muted" data-grammar-save role="status">${h(statusText())}</p><button class="button primary wide" data-action="grammar-grade" ${!online()||remoteConflict?'disabled':''}>${r.tasks.length} Antworten kontrollieren lassen</button></section>`;}
 function resultView(){
  const r=cache.round,e=r?.evaluations.at(-1);if(!e)return intro();const correct=e.results.filter(x=>x.status==='correct').length;
  return `<section class="grammar-panel grammar-result-heading"><span class="tag">DEINE AUSWERTUNG</span><h2>${correct} von ${r.tasks.length} richtig</h2><p class="muted">${correct===r.tasks.length?'Das sitzt! Die nächste Runde bleibt beim gleichen Thema.':'Schau dir in Ruhe an, was schon klappt und was wir als Nächstes üben.'}</p></section>${r.tasks.map((t,i)=>{const result=e.results.find(x=>x.id===t.id);return `<article class="grammar-panel grammar-result" data-grade="${h(result.status)}"><div class="section-top"><span class="small muted">Aufgabe ${i+1}</span><strong class="grammar-grade">${h(labels[result.status])}</strong></div><h3>${h(t.promptDe)}</h3><div class="grammar-answer-copy"><span class="small muted">Deine Antwort</span><p lang="en">${h(r.answers[t.id]||'Weiß ich nicht')}</p></div><div class="grammar-correction"><span class="small muted">${result.status==='correct'?'Eine passende Lösung':'So geht es richtig'}</span><p lang="en">${h(result.correction)}</p></div><dl class="grammar-dimensions">${Object.entries(dimensions).map(([key,label])=>`<div><dt>${label}</dt><dd>${h(labels[result[key]])}</dd></div>`).join('')}</dl><p>${h(result.explanationDe)}</p><p class="grammar-rule"><strong>Merke:</strong> ${h(result.ruleDe)}</p>${result.possibleMisconceptionDe?`<p class="small muted">${h(result.possibleMisconceptionDe)}</p>`:''}${result.example?`<p lang="en" class="grammar-example">${h(result.example)}</p>`:''}</article>`;}).join('')}<section class="grammar-panel">${sizes()}<button class="button primary wide" data-action="grammar-generate" ${!online()?'disabled':''}>Neue Aufgaben · passend zu deinen Fehlern</button><button class="text-button wide" data-action="grammar-recheck" ${!online()||r.evaluations.length>=3?'disabled':''}>Bewertung erneut prüfen</button><p class="small muted">Die Nachprüfung ist eine weitere KI-Anfrage. Bei widersprüchlichen Urteilen zählt die Aufgabe nicht zum Lernprofil.</p>${r.evaluations.length>1?`<details><summary>Frühere Bewertungen ansehen</summary>${r.evaluations.slice(0,-1).map(old=>`<article><p>${h(new Date(old.at).toLocaleString('de-DE'))}</p>${old.results.map(x=>`<p><strong>${h(x.id)} · ${h(labels[x.status])}</strong><br>${h(x.correction)}<br>${h(x.explanationDe)}</p>`).join('')}</article>`).join('')}</details>`:''}</section>`;
 }
 function settings(){const limits=state?.limits||{dailyCalls:40,dailyTokens:200000},usage=state?.usage;return `<section class="grammar-panel"><h2>KI-Einstellungen</h2><p class="muted">OVHcloud · Meta Llama 3.3 70B Instruct</p><p>Deine Aufgaben und Antworten werden zur Erzeugung und Korrektur an OVHcloud gesendet. Dein Lernverlauf bleibt auf deinem Pi.</p><p><strong>${state?.configured?'Schlüssel hinterlegt':'Noch kein Schlüssel hinterlegt'}</strong></p><form id="grammar-config" autocomplete="off">${state?.keySource!=='environment'?'<label for="grammar-api-key">OVHcloud-API-Schlüssel</label><input id="grammar-api-key" name="apiKey" type="password" autocomplete="new-password" autocorrect="off" autocapitalize="none" spellcheck="false" maxlength="4096" placeholder="Zum Ändern neuen Schlüssel einfügen"><p class="small muted">Leer lassen, um den bisherigen Schlüssel zu behalten. Der Schlüssel wird nicht zurück an die App gesendet.</p>':'<p>Der Schlüssel wird über die Serverumgebung verwaltet.</p>'}<label for="grammar-calls">Maximale KI-Anfragen pro Tag</label><input id="grammar-calls" name="dailyCalls" type="number" min="2" max="200" required value="${limits.dailyCalls}"><label for="grammar-tokens">Maximale Tokens pro Tag</label><input id="grammar-tokens" name="dailyTokens" type="number" min="20000" max="2000000" step="1000" required value="${limits.dailyTokens}"><button class="button primary wide" type="submit" ${!online()?'disabled':''}>Einstellungen speichern</button></form><p class="small muted">Der erste Aufgabenaufruf prüft den tatsächlichen Modellzugriff. Es gibt keine automatische kostenpflichtige Testanfrage.</p></section><section class="grammar-panel"><h2>Verbrauch heute</h2><p>${usage?.calls||0} von ${limits.dailyCalls} Anfragen</p><p>${(usage?.input_tokens||0).toLocaleString('de-DE')} Eingabe- und ${(usage?.output_tokens||0).toLocaleString('de-DE')} Ausgabe-Tokens</p><p class="small muted">${(usage?.reserved_tokens||0).toLocaleString('de-DE')} Tokens vorsorglich reserviert. Bei unterbrochenen Anfragen ohne Verbrauchsangabe bleibt die Schätzung erhalten. Tageswechsel: Europe/Berlin. Dies ist keine Rechnung.</p></section>`;}
 function historyView(){return `<section class="grammar-panel"><h2>Deine bisherigen Runden</h2>${history.map(r=>`<button class="grammar-history-row" data-action="grammar-round" data-id="${h(r.id)}"><span>${h(new Date(r.created).toLocaleString('de-DE'))}<small>${r.count} Aufgaben · ${r.evaluated?r.correct+' richtig':'noch offen'}</small></span><span aria-hidden="true">→</span></button>`).join('')||'<p class="muted">Deine erste Runde wartet auf dich.</p>'}${historyMore?'<button class="text-button wide" data-action="grammar-more">Weitere Runden laden</button>':''}</section>`;}
 function conflictView(){return remoteConflict?`<section class="grammar-panel grammar-error"><h2>Zwei Entwürfe vergleichen</h2>${cache.round.tasks.map(t=>`<article><strong>${h(t.promptDe)}</strong><p>Dieses Gerät: ${h(cache.round.answers[t.id]||'—')}</p><p>Auf dem Pi: ${h(remoteConflict.answers[t.id]||'—')}</p></article>`).join('')}<div class="grammar-actions"><button class="button secondary" data-action="grammar-use-server">Pi-Stand übernehmen</button><button class="button primary" data-action="grammar-use-local" ${remoteConflict.evaluations.length?'disabled':''}>Meinen Entwurf übernehmen</button></div><p class="small muted">Dein Geräteentwurf bleibt als lokale Sicherung erhalten.</p></section>`:'';}
 function view(){
  if(profile.role!=='admin')return '';
  const body=cache.mode==='question'?question():cache.mode==='review'?review():cache.mode==='results'?resultView():cache.mode==='settings'?settings():cache.mode==='history'?historyView():intro();
  return `<div class="grammar-shell"><div class="page-heading"><div><div class="eyebrow">DEIN PERSÖNLICHES TRAINING</div><h1>Grammatik lernen</h1><p class="muted">${TITLE}</p></div></div>${tools()}${!online()?'<p class="grammar-notice" role="status">Offline: Du kannst geladene Aufgaben beantworten. Die KI-Kontrolle folgt, sobald du wieder verbunden bist.</p>':''}${error?`<div class="grammar-error" role="alert"><p>${h(error)}</p>${cache.pending?'<button class="button secondary" data-action="grammar-retry">Erneut versuchen</button>':'<button class="text-button" data-action="grammar-refresh">Verbindung und Stand prüfen</button>'}</div>`:''}${storageError?`<p class="grammar-error" role="alert">${h(storageError)}</p>`:''}${conflictView()}${busy?`<section class="grammar-panel grammar-loading" role="status" aria-live="polite"><span class="grammar-orbit" aria-hidden="true">✦</span><h2>${h(busy)}</h2><p class="muted">Deine Eingaben bleiben gespeichert. Du kannst diesen Bereich verlassen und später zurückkommen.</p></section>`:body}<p class="grammar-foot small muted">Nur für dich als Admin · KI-Feedback kann Fehler enthalten.</p></div>`;
 }
 function mutateAnswer(target){
  const taskId=target.dataset.grammarAnswer;if(!taskId||!cache.round||cache.round.evaluations.length||busy||!Object.hasOwn(cache.round.answers,taskId))return;
  cache.round.answers[taskId]=target.value.slice(0,1000);cache.dirty=true;cache.pending=null;persist();updateSaveLabel();clearTimeout(saveTimer);
  if(online()&&!remoteConflict)saveTimer=setTimeout(()=>void flush().catch(()=>updateSaveLabel()),1200);
 }
 function next(){cache.index++;if(cache.index>=cache.round.tasks.length){cache.index=cache.round.tasks.length-1;cache.mode='review';}persist();paint();}
 function handle(button){
  const action=button.dataset.action;if(!action?.startsWith('grammar-'))return false;if(profile.role!=='admin')return true;
  if(action==='grammar-open'){go();paint();void load();return true;}
  if(busy)return true;
  if(action==='grammar-count'){cache.count=Number(button.dataset.id);if(![3,5,10].includes(cache.count))cache.count=5;persist();paint();return true;}
  if(action==='grammar-intro'||action==='grammar-settings'||action==='grammar-history'){cache.mode=action.split('-')[1];persist();paint();if(action==='grammar-history')void load();return true;}
  if(action==='grammar-resume'){cache.mode=cache.round.evaluations.length?'results':'question';persist();paint();return true;}
  if(action==='grammar-prev'){cache.index=Math.max(0,cache.index-1);persist();paint();return true;}
  if(action==='grammar-unknown'){const t=cache.round.tasks[cache.index];cache.round.answers[t.id]='';cache.dirty=true;cache.pending=null;next();void flush().catch(()=>{});return true;}
  if(action==='grammar-refresh'){void run('Stand wird geladen …',load);return true;}
  if(action==='grammar-use-server'||action==='grammar-use-local'){
   if(!remoteConflict)return true;
   try{storage.setItem(cacheKey+':sicherung:'+Date.now(),JSON.stringify(cache.round));}catch{error='Die Sicherung konnte nicht gespeichert werden. Bitte die Antworten zuerst kopieren.';paint();return true;}
   if(action==='grammar-use-server'){cache.round=remoteConflict;cache.dirty=false;cache.mode=cache.round.evaluations.length?'results':'review';}
   else{cache.round.revision=remoteConflict.revision;cache.dirty=true;cache.pending=null;}
   remoteConflict=null;error='';persist();paint();void flush().catch(e=>{error=e.message;paint();});return true;
  }
  if(action==='grammar-round'){void run('Runde wird geladen …',async()=>{await flush();const result=await request('grammarRound',{roundId:button.dataset.id});accept(result);});return true;}
  if(action==='grammar-more'){void run('Lernverlauf wird geladen …',async()=>{const result=await request('grammarHistory',{offset:history.length});history.push(...result.rounds);historyMore=result.rounds.length===30;});return true;}
  if(action==='grammar-retry'){void run(cache.pending?.action==='grammarGenerate'?'Aufgaben werden erstellt …':'Wird kontrolliert …',performPending);return true;}
  if(action==='grammar-generate'){
   if(cache.round&&!cache.round.evaluations.length&&!confirm('Eine neue Runde beginnen? Die bisherige Runde bleibt im Lernverlauf.'))return true;
   void run('Aufgaben werden erstellt …',async()=>{await flush();cache.pending={action:'grammarGenerate',payload:{requestId:id(),count:cache.count,topicId:TOPIC}};persist();await performPending();});return true;
  }
  if(action==='grammar-grade'){
   if(remoteConflict){paint();return true;}
   void run('Wird kontrolliert …',async()=>{await flush();cache.pending={action:'grammarGrade',payload:{requestId:id(),roundId:cache.round.id,revision:cache.round.revision,answers:{...cache.round.answers}}};persist();await performPending();});return true;
  }
  if(action==='grammar-recheck'){void run('Bewertung wird erneut geprüft …',async()=>{cache.pending={action:'grammarReview',payload:{requestId:id(),roundId:cache.round.id}};persist();await performPending();});return true;}
  return true;
 }
 function submit(form){
  if(!['grammar-answer-form','grammar-config'].includes(form.id))return false;if(profile.role!=='admin'||busy)return true;
  if(form.id==='grammar-answer-form'){next();void flush().catch(()=>{});return true;}
  const fd=new FormData(form),apiKey=String(fd.get('apiKey')||'').trim(),limits={dailyCalls:Number(fd.get('dailyCalls')),dailyTokens:Number(fd.get('dailyTokens'))};form.querySelector('[name="apiKey"]')?.setAttribute('value','');const field=form.querySelector('[name="apiKey"]');if(field)field.value='';
  void run('Einstellungen werden gespeichert …',async()=>{state=await request('grammarConfigure',{apiKey,limits});notify('KI-Einstellungen auf dem Pi gespeichert.');cache.mode='intro';});return true;
 }
 return {view,handle,submit,input:mutateAnswer,flush,refresh:load,get busy(){return !!busy;},get draft(){return cache;}};
}
