import {SUBJECTS,subjectInfo} from './subjects.js';
import {sharingCheck} from './sharing-check.js';
import {activityRows,activityLabels} from './activity.js';
import {sortedCollections} from './refresh-decks.js';
import {shareResources,resourceRecipients,accessOverview} from './share-access.js';
import {incoming,settleSync} from './multiuser-sync.js';
const ADMIN_ACTIONS=new Set(['sharing-check','check-all-people','check-run','check-apply','access-edit','access-batch','access-select-all','admin-person','profile-new-toggle','share-subject','admin-person-shares','share-select-all','share-select-none','predicate-share-all','share-notify','share-repair','profile-activity','profile-subjects','profile-code-show','profile-code','profile-edit','profile-view','share-source','profile-delete','share-revoke','account-profiles','share-panel','share-changes']);
export function sharingUI({store,sync,profile,h,showModal,showAdmin,closeModal,notify,render,openCollection,openShareSubject,isAdminView=()=>true}){
  const checker=sharingCheck({sync,h,showAdmin,notify,isVisible:()=>isAdminView('checks'),prepare:async()=>{await flush();if(openShareSubject)for(const subject of SUBJECTS.map(subject=>subject.id).filter(value=>value!==(sync.subject||'latin'))){const other=await openShareSubject(subject);await settleSync(other.sync,other.store);if(other.store.doc.pending.length||other.sync.status!=='synced')throw Error('Das Lernfach '+subjectName(subject)+' ist noch nicht vollständig abgeglichen.');}}});
  let shares=store.doc.adminDirectory?.shares||[],predicateShares=store.doc.adminDirectory?.predicateShares||[],people=store.doc.adminDirectory?.people||[],changed=new Set(),notifying=false,newProfileOpen=false;
  let pending=0,directoryEpoch=0,codeResult=null,selectedPerson='',shareStore=store,shareSync=sync,shareSubject=sync.subject||'latin';
  let loaded=!!store.doc.adminDirectory,resourceShares=store.doc.adminDirectory?.resourceShares||[],accessSchema=0,accessQuery='',accessKind='all',accessSelection=new Set();
  async function remember(){const target=shareStore,directory={shares,predicateShares,resourceShares,people};await target.update(doc=>{doc.adminDirectory=directory;return doc;});}
  const errorText=e=>/Unbekannte.*Aktion/i.test(e.message||e)?'Der Pi benötigt das neue Latinio-Backend. Bitte das vorbereitete Vokabel-Update installieren.':String(e.message||e).replace(/^Error:\s*/, '');
  function status(node,message){if(node?.isConnected)node.textContent=message;}
  function failure(node,error,action){if(!node?.isConnected)return;const message=errorText(error);node.textContent=message;node.innerHTML=`<span role="alert">${h(message)}</span> <button class="text-button" data-action="${action}">Erneut versuchen</button>`;}
  const cancelButton='<button type="button" class="button secondary wide" data-action="close-modal">Abbrechen</button>';

  function latestActivity(event){return event?`${new Date(event.at).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'})} · ${activityLabels[event.action]||'Aktivität'}`:'Noch keine Aktivität';}
  function profileRows(){
    return `<div class="people-grid">${people.map(p=>`<section class="person-entry"><button class="person-card ${p.id===selectedPerson?'selected':''}" data-action="admin-person" data-id="${h(p.id)}" aria-expanded="${p.id===selectedPerson}"><span class="person-avatar" aria-hidden="true">${h(p.name.slice(0,1).toUpperCase())}</span><span><strong>${h(p.name)}</strong><small>${h(p.email)}</small><small>${normalizeSubjects(p.allowedSubjects).map(subjectName).join(' · ')}</small>${p.simplifiedMode?'<small class="person-meta">Vereinfachter Modus</small>':''}<small class="person-meta">Version: ${h(p.latestAppVersion?'v'+p.latestAppVersion:'noch nicht gemeldet')}</small><small class="person-meta" title="Oberster Eintrag aus dem bestehenden Aktivitätsprotokoll.">Letzte Aktivität: ${h(p.latestActivityLoading?'wird geladen …':latestActivity(p.latestActivity))}</small></span><span aria-hidden="true">${p.id===selectedPerson?'⌄':'›'}</span></button>${p.id===selectedPerson?`<div class="person-detail"><div class="profile-controls"><button class="button secondary" data-action="profile-activity" data-id="${h(p.id)}">Aktivitäten</button><button class="button secondary" data-action="profile-view" data-id="${h(p.id)}">Sammlungen ansehen</button>${codeResult?.profile.id===p.id?`<button class="button secondary" data-action="profile-code-show" data-id="${h(p.id)}">Neuen Code anzeigen</button>`:''}<button class="button secondary" data-action="profile-code" data-id="${h(p.id)}">${p.codeReady?'Neuen Zugangscode erzeugen':'Zugangscode erzeugen'}</button><button class="button secondary" data-action="profile-edit" data-id="${h(p.id)}">Bearbeiten</button><button class="button secondary danger-text" data-action="profile-delete" data-id="${h(p.id)}">Nutzer löschen</button></div></div>`:''}</section>`).join('')||'<p class="muted">Noch keine Nutzer angelegt.</p>'}</div>`;
  }
  function normalizeSubjects(value){return Array.isArray(value)&&value.length?value.filter(x=>SUBJECTS.map(subject=>subject.id).includes(x)):SUBJECTS.map(subject=>subject.id);}
  function subjectName(value){return subjectInfo(value).label;}
  function subjectFields(subjects){const selected=normalizeSubjects(subjects);return `<fieldset class="share-picker"><legend>Lernfächer freigeben</legend>${SUBJECTS.map(subject=>`<label class="collection-check"><input type="checkbox" name="allowedSubject" value="${subject.id}" ${selected.includes(subject.id)?'checked':''}><span>${subject.label}</span></label>`).join('')}</fieldset>`;}
  function modeField(person={}){return `<label class="setting-row"><span>Vereinfachter Modus<small class="muted">Nur Startseite und Sammlungen · keine Einstellungen oder Suche</small></span><input class="switch" type="checkbox" name="simplifiedMode" ${person.simplifiedMode===true?'checked':''}></label>`;}
  function shareRows(){
    if(!selectedPerson)return '<p class="empty-state">Wähle zuerst einen Nutzer. Hier erscheinen nur seine Freigaben.</p>';
    const rows=shares.filter(s=>s.profileId===selectedPerson);
    return `<div class="section-top"><h3>${rows.length} Freigaben</h3>${rows.length?`<button class="button secondary" data-action="share-notify" data-id="${h(selectedPerson)}">Erneut benachrichtigen</button>`:''}</div>`+(rows.map(s=>`<details class="share-entry"><summary>${h(s.collection?.name||'Gelöschte Sammlung')}</summary><p class="small muted">${s.delivery?(s.delivery.present?'In der Empfänger-Cloud: '+s.delivery.wordCount+' Wörter'+(s.delivery.missingWords?' · '+s.delivery.missingWords+' fehlende Einträge':''):'Sammlung fehlt in der Empfänger-Cloud'):'Empfang noch nicht geprüft'}</p><div class="profile-controls">${!s.automatic?`<button class="button secondary" data-action="share-changes" data-id="${h(s.id)}">Änderungen senden</button>`:''}${!s.automatic?`<button class="button secondary" data-action="share-repair" data-id="${h(s.id)}">Übertragung prüfen</button>`:''}<button class="button secondary" data-action="profile-view" data-id="${h(s.profileId)}">Beim Nutzer ansehen</button><button class="button secondary" data-action="share-source" data-id="${h(s.sourceId)}">Meine Sammlung</button>${!s.automatic?`<button class="button secondary danger-text" data-action="share-revoke" data-id="${h(s.id)}">Freigabe beenden</button>`:''}</div></details>`).join('')||'<p class="muted">Noch keine Sammlungen mit diesem Nutzer geteilt.</p>');
  }
  const admin=profile.role==='admin';
  async function refresh(){if(admin){const context=shareStore,result=await shareSync.request('shareList');if(context!==shareStore)return shares;shares=result.shares||[];predicateShares=result.predicateShares||[];resourceShares=result.resourceShares||[];loaded=true;await remember();}return shares;}
  store.addEventListener('commit',event=>{
    if(!admin)return;
    if(event.detail.changes.some(([entity,key,value])=>entity==='collections'&&!value?.refreshSource||entity==='words'&&!store.data.collections[value?.collectionId||event.detail.previous.words[key]?.collectionId]?.refreshSource||entity==='settings'&&['predicateDeck','predicateItem'].includes((value||event.detail.previous.settings[key])?.kind))){sync.autoShareState={busy:true,message:'Wird automatisch geteilt …'};sync.dispatchEvent(new Event('change'));}
    for(const [entity,key,value] of event.detail.changes){
      if(entity==='collections')changed.add(key);
      if(entity==='words'){const old=event.detail.previous.words[key];if(old)changed.add(old.collectionId);if(value)changed.add(value.collectionId);}
    }
  });
  async function flush(){
    await settleSync(sync,store);
    if(sync.status!=='synced'||store.doc.pending.length)throw Error('Deine Änderungen müssen zuerst vollständig hochgeladen sein. Bitte gleich erneut versuchen.');
  }
  function profiles(fetch=true){
    showAdmin(`<div class="section-top"><h2>Deine Nutzer</h2><button class="button secondary" data-action="sharing-check">Freigaben prüfen</button><button class="text-button profile-new-link" data-action="profile-new-toggle"><span aria-hidden="true">＋</span> Neu</button></div>${newProfileOpen?`<form id="profile-create" class="create-profile"><label>Name<input name="name" required maxlength="80" autocomplete="off"></label><label>Schüler-E-Mail<input name="email" type="email" required maxlength="254" autocapitalize="none"></label>${subjectFields()}${modeField()}<button class="button primary">Profil anlegen</button><p role="status" class="small muted" data-save-status></p></form>`:''}<p role="status" class="small muted" data-directory-status>${fetch?'Profile werden geladen …':''}</p><div class="profile-list">${profileRows()}</div>`,'people');
    if(!fetch)return;
    const epoch=++directoryEpoch;
    const root=document.querySelector('.profile-list'),message=document.querySelector('[data-directory-status]');
    void sync.request('profiles').then(async result=>{if(epoch!==directoryEpoch)return;people=result.profiles.map(p=>({...p,latestActivityLoading:true}));await remember();if(root.isConnected&&isAdminView('people'))root.innerHTML=profileRows();status(message,'Aktuell');const activities=await Promise.allSettled(people.map(p=>sync.request('profileActivity',{profileId:p.id})));if(epoch!==directoryEpoch)return;people=people.map((p,index)=>({...p,latestActivityLoading:false,latestActivity:activities[index].status==='fulfilled'?activities[index].value.events?.[0]:null}));await remember();if(root.isConnected&&isAdminView('people'))root.innerHTML=profileRows();}).catch(e=>{if(epoch===directoryEpoch&&isAdminView('people'))failure(message,e,'account-profiles');});
  }

  function accessState(){return {shares,resourceShares,predicateShares};}
  function visibleResources(){return shareResources(shareStore.data,shareSubject).filter(c=>(accessKind==='all'||c.resourceKind===accessKind)&&c.name.toLocaleLowerCase('de').includes(accessQuery.toLocaleLowerCase('de')));}
  function accessRows(){return accessOverview(visibleResources().map(c=>({...c,automatic:c.resourceKind!=='refresh'})),accessState(),people,h,{ready:accessSchema===2});}
  function paintAccess(){
    const list=document.querySelector('[data-share-list]');if(list){list.innerHTML=accessRows();list.querySelectorAll?.('[data-access-select]').forEach(input=>input.checked=accessSelection.has(input.dataset.accessSelect));}
    const count=document.querySelector('[data-access-count]');if(count)count.textContent=accessSelection.size+' ausgewählt';
    const batch=document.querySelector('[data-action="access-batch"]');if(batch)batch.disabled=!accessSelection.size||accessSchema!==2;
  }
  function accessEditor(keys){
    if(accessSchema!==2){notify('Die Freigaben sind noch nicht geladen. Bitte öffne die Freigabenübersicht erneut.');return;}
    const resources=shareResources(shareStore.data,shareSubject).filter(c=>keys.includes(c.key)&&c.resourceKind==='refresh');if(!resources.length){checker.handle({dataset:{action:'sharing-check'}});return;}
    const single=resources.length===1,recipients=single?new Set(resourceRecipients(resources[0],accessState(),people).map(p=>p.id)):new Set();
    showModal(`<h2 id="modal-title">${single?h(resources[0].name):resources.length+' Sammlungen teilen'}</h2><p class="small muted">${resources.map(c=>h(c.name)).join(' · ')}</p><form id="access-editor" data-resources="${h(JSON.stringify(resources.map(c=>({resourceKind:c.resourceKind,sourceId:c.id,name:c.name}))))}" data-subject="${shareSubject}">${single?'':`<label>Aktion<select name="mode"><option value="add">Mit ausgewählten Nutzern teilen</option><option value="remove">Freigaben ausgewählter Nutzer beenden</option></select></label>`}<label class="collection-check share-all"><input type="checkbox" data-access-all ${people.length&&recipients.size===people.length?'checked':''}><span>Alle Nutzer auswählen</span></label><div class="access-editor-list">${people.map(p=>{const allowed=normalizeSubjects(p.allowedSubjects).includes(shareSubject);return `<label class="collection-check"><input type="checkbox" name="recipient" value="${h(p.id)}" ${recipients.has(p.id)?'checked':''} ${!allowed&&!recipients.has(p.id)?'disabled':''}><span>${h(p.name)}<small class="muted">${h(p.email)}${!allowed?' · Lernfach nicht freigegeben':''}</small></span></label>`;}).join('')||'<p>Lege zuerst einen Nutzer an.</p>'}</div><p class="small muted">${single?'Häkchen zeigen die aktuellen Empfänger. Entfernte Häkchen beenden die Freigabe.':'Andere Nutzer und Sammlungen bleiben unverändert.'} Bereits übertragene Inhalte und Lernstände bleiben beim Beenden erhalten.</p><button class="button primary wide" type="submit" ${!people.length?'disabled':''}>Freigaben speichern</button><p role="status" data-save-status></p>${cancelButton}</form>${single&&resources[0].resourceKind==='lesson'?shares.filter(x=>x.sourceId===resources[0].id&&!x.revoked&&!x.automatic).map(x=>`<button class="text-button" data-action="share-changes" data-id="${h(x.id)}">Inhaltsänderungen für ${h(x.profileName)} senden</button>`).join(''):''}`);
  }
  function panel(fetch=true){
    if(fetch)accessSchema=0;
    const resources=shareResources(shareStore.data,shareSubject),shared=resources.filter(c=>resourceRecipients(c,accessState(),people).length).length;
    showAdmin(`<div class="section-top"><h2>Freigaben</h2><button class="button secondary" data-action="sharing-check">Freigaben prüfen</button><span class="access-summary">${shared} von ${resources.length} Sammlungen geteilt</span></div><div class="button-row section-tabs">${SUBJECTS.map(subject=>`<button class="chip ${shareSubject===subject.id?'selected':''}" data-action="share-subject" data-id="${subject.id}">${subject.label}</button>`).join('')}</div><p class="small muted">Lektionen und Perfekt-Sammlungen werden automatisch geteilt. Auffrisch-Sammlungen kannst du weiterhin selbst freigeben.</p><p role="status" class="small muted" data-directory-status>${fetch?'Cloud-Stand wird geprüft …':''}</p><div data-access-warning></div><div class="access-tools"><input type="search" id="access-search" value="${h(accessQuery)}" placeholder="Sammlung suchen" aria-label="Freigaben durchsuchen"><select id="access-kind" aria-label="Sammlungsart"><option value="all">Alle Arten</option><option value="lesson" ${accessKind==='lesson'?'selected':''}>Vokabeln</option><option value="refresh" ${accessKind==='refresh'?'selected':''}>Auffrischen</option>${shareSubject==='latin'?`<option value="predicates" ${accessKind==='predicates'?'selected':''}>Prädikate</option>`:''}</select></div><div class="access-actions"><button class="text-button" data-action="access-select-all">Sichtbare auswählen</button><span class="small muted" data-access-count>${accessSelection.size} ausgewählt</span><button class="button primary" data-action="access-batch" ${!accessSelection.size||accessSchema!==2?'disabled':''}>Auswahl teilen / verwalten</button></div><div data-share-list>${accessRows()}</div>`,'shares');
    paintAccess();
    if(!fetch)return;
    const epoch=++directoryEpoch,contextSync=shareSync,contextStore=shareStore,root=document.querySelector('[data-share-list]'),message=document.querySelector('[data-directory-status]');
    void Promise.all([sync.request('profiles'),(async()=>{if(contextSync.configured)await settleSync(contextSync,contextStore);return contextSync.request('shareList');})()]).then(async ([p,result])=>{
      if(epoch!==directoryEpoch||contextStore!==shareStore)return;
      people=p.profiles;shares=result.shares||[];predicateShares=result.predicateShares||[];resourceShares=result.resourceShares||[];accessSchema=result.accessSchema||0;loaded=true;await remember();
      if(!root.isConnected||!isAdminView('shares'))return;
      paintAccess();status(message,'Aktuell');
      const summary=document.querySelector('.access-summary');if(summary){const all=shareResources(shareStore.data,shareSubject);summary.textContent=all.filter(c=>resourceRecipients(c,accessState(),people).length).length+' von '+all.length+' Sammlungen geteilt';}
      const warning=document.querySelector('[data-access-warning]');if(warning&&accessSchema!==2)warning.innerHTML='<p class="access-warning">Die sammlungsgenauen Freigaben sind derzeit nicht verfügbar. Lade die Übersicht erneut. Bestehende Freigaben bleiben erhalten.</p>';
    }).catch(e=>{if(epoch!==directoryEpoch||contextStore!==shareStore)return;accessSchema=0;if(isAdminView('shares'))failure(message,e,'share-panel');});
  }
  async function saveAccess(form){
    if(form.dataset.saving)return;
    const fd=new FormData(form),resources=JSON.parse(form.dataset.resources),recipientIds=fd.getAll('recipient'),mode=resources.length===1?'replace':fd.get('mode');
    if(!['replace','add','remove'].includes(mode))throw Error('Bitte eine Aktion auswählen.');
    if(mode!=='replace'&&!recipientIds.length)throw Error('Wähle mindestens einen Nutzer.');
    const contextStore=shareStore,contextSync=shareSync,contextSubject=shareSubject,state=accessState(),allPeople=[...people];
    if(form.dataset.subject!==contextSubject||accessSchema!==2)throw Error('Bitte Freigaben erneut öffnen.');
    const targets=[];
    for(const resource of resources){
      const current=resourceRecipients({resourceKind:resource.resourceKind,id:resource.sourceId},state,allPeople).map(p=>p.id);
      for(const person of allPeople){
        const selected=recipientIds.includes(person.id),exists=current.includes(person.id);
        if(mode!=='remove'&&selected&&!exists&&!normalizeSubjects(person.allowedSubjects).includes(contextSubject))throw Error('Das Lernfach ist für '+person.name+' nicht freigegeben.');
        if(mode==='add'&&selected&&!exists||mode==='remove'&&selected&&exists||mode==='replace'&&selected!==exists)targets.push({...resource,profileId:person.id,enabled:mode==='remove'?false:selected});
      }
    }
    if(!targets.length){status(form.querySelector('[data-save-status]'),'Keine Änderungen. Die Freigaben sind bereits so gespeichert.');notify('Keine Freigaben zu ändern.');return;}
    const statusNode=form.querySelector('[data-save-status]'),controls=[...form.querySelectorAll('input,select,button')],previous=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);form.dataset.saving='1';pending++;directoryEpoch++;
    let completed=0,error=null;
    try{
      await settleSync(contextSync,contextStore);
      for(const target of targets){status(statusNode,`Speichern · ${completed+1} / ${targets.length}`);await contextSync.request('collectionAccessSet',target);completed++;}
    }catch(e){error=e;}
    try{
      const result=await contextSync.request('shareList');
      await contextStore.update(doc=>{doc.adminDirectory={...(doc.adminDirectory||{}),shares:result.shares||[],predicateShares:result.predicateShares||[],resourceShares:result.resourceShares||[],people:allPeople};return doc;});
      if(contextStore===shareStore){shares=result.shares||[];predicateShares=result.predicateShares||[];resourceShares=result.resourceShares||[];}
    }catch(e){error ||= e;}
    finally{pending--;delete form.dataset.saving;controls.forEach((c,i)=>c.disabled=previous[i]);}
    if(error){const message=`${completed} von ${targets.length} gespeichert. ${errorText(error)}`;if(form.isConnected)status(statusNode,message);else notify(message);}
    else {if(form.isConnected){closeModal();accessSelection.clear();panel(false);}notify('Freigaben gespeichert.');}
  }
  function describe(value){return value?(value.latin?value.latin+' – '+value.meanings.map(g=>g.join(' / ')).join(', '):value.grundform?value.grundform+' – '+(value.praedikate||[]).join(' / '):value.name):'Gelöscht / noch nicht vorhanden';}
  async function changes(id){
    showModal('<h2 id="modal-title">Änderungen auswählen</h2><p role="status" data-changes-loading>Änderungen werden geladen …</p><div class="indeterminate"></div>');
    const loading=document.querySelector('[data-changes-loading]');
    try{await settleSync(shareSync,shareStore);const result=await shareSync.request('shareChanges',{shareId:id});if(!loading.isConnected)return;
    showModal(`<h2 id="modal-title">Änderungen an ${h(result.share.profileName)}</h2><p class="muted">Wähle nur die Änderungen aus, die du senden möchtest.</p><form id="share-send" data-id="${h(id)}">${result.changes.map(c=>`<label class="collection-check"><input name="change" type="checkbox" value="${h(c.key)}"><span><strong>${h(c.label)}</strong><br><small>Bisher geteilt: ${h(describe(c.previous))}<br>Neue Fassung: ${h(describe(c.source))}</small></span></label>`).join('')||'<p>Keine ungesendeten Änderungen.</p>'}<button class="button primary wide" ${!result.changes.length?'disabled':''}>Ausgewählte Änderungen senden</button><p role="status" class="small muted" data-save-status></p>${cancelButton}</form>`);
    }catch(e){status(loading,errorText(e));if(loading.isConnected)loading.nextElementSibling?.remove();}
  }
  async function afterAction(){changed.clear();}
  function autoStatusMarkup(){
    if(!admin)return '';
    const state=sync.autoShareState;if(!state)return '';
    return `<div class="auto-share-status" role="status"><span>${h(state.message)}</span>${state.busy?`<progress ${state.total?`max="${state.total}" value="${state.done||0}"`:''}></progress>`:''}</div>`;
  }
  function profileView(id){
    showAdmin('<button class="text-button" data-action="account-profiles">← Alle Nutzer</button><h2>Nutzersammlungen</h2><div data-user-collections><p role="status">Cloud-Stand wird geladen …</p><div class="indeterminate"></div></div>');
    const root=document.querySelector('[data-user-collections]');
    void sync.request('profileCollections',{profileId:id}).then(result=>{
      if(!root.isConnected)return;
      const compare=new Map(result.comparisons.map(c=>[c.key,c]));
      const rows=Object.values(result.collections).map(collection=>{
        const words=Object.values(result.words).filter(w=>w.collectionId===collection.id);
        const missing=result.comparisons.filter(c=>c.collectionId===collection.id&&!c.current);
        return `<details class="user-collection"><summary>${h(collection.name)} · ${words.length} Wörter</summary>${words.map(w=>{const c=compare.get(w.id);return `<article class="user-vocab"><strong>${h(w.latin)}</strong><p>${h(w.meanings.map(g=>g.join(' / ')).join(', '))}</p><small class="muted">${c?(c.changed?'Vom Nutzer verändert':'Wie zuletzt geteilt'):'Eigener oder separat importierter Eintrag'}</small>${c?.changed?`<p class="small muted">Zuletzt geteilt: ${h(describe(c.previous))}</p>`:''}${c?`<p class="small muted">Aktuell bei dir: ${h(describe(c.admin))}</p>`:''}</article>`;}).join('')}${missing.map(c=>`<p class="small muted">Beim Nutzer gelöscht: ${h(describe(c.previous))}</p>`).join('')}</details>`;
      }).join('');
      const absent=result.comparisons.filter(c=>!result.collections[c.collectionId]);
      root.innerHTML=`<p><strong>${h(result.profile.name)}</strong></p><p class="small muted">Zuletzt hochgeladener Stand · v${result.version}. Noch nicht synchronisierte Änderungen auf dem Gerät sind hier nicht sichtbar.</p>${rows||'<p>Noch keine Sammlungen vorhanden.</p>'}${absent.length?'<p class="muted">Eine zuvor geteilte Sammlung wurde beim Nutzer gelöscht.</p>':''}`;
    }).catch(e=>{if(root.isConnected&&isAdminView('people'))failure(root,e,'account-profiles');});
  }
  function profileSubjects(id){
    const person=people.find(p=>p.id===id);if(!person)return;
    showModal(`<h2 id="modal-title">Lernfächer · ${h(person.name)}</h2><p class="muted">Nur freigegebene Lernfächer sind für diesen Nutzer verfügbar.</p><form id="profile-subjects-form" data-id="${h(id)}">${subjectFields(person.allowedSubjects)}<button class="button primary wide">Freigabe speichern</button><p role="status" class="small muted" data-save-status></p>${cancelButton}</form>`);
  }
  function profileEdit(id){
    const person=people.find(p=>p.id===id);if(!person)return;
    showModal(`<h2 id="modal-title">Nutzer bearbeiten · ${h(person.name)}</h2><form id="profile-edit-form" data-id="${h(id)}"><label>Name<input name="name" required maxlength="80" value="${h(person.name)}"></label><label>E-Mail<input name="email" type="email" required maxlength="254" value="${h(person.email)}" autocapitalize="none"></label>${subjectFields(person.allowedSubjects)}${modeField(person)}<button class="button primary wide">Änderungen speichern</button><p role="status" class="small muted" data-save-status></p>${cancelButton}</form>`);
  }
  function profileActivity(id){
    const person=people.find(p=>p.id===id);
    showAdmin(`<button class="text-button" data-action="account-profiles">← Alle Nutzer</button><h2>Aktivitätsprotokoll · ${h(person?.name||'Schüler')}</h2><p class="small muted">Letzte 90 Tage · maximal 200 Einträge · deutsche Zeit (Europe/Berlin). Gerätezeit; offline erfasste Aktionen erscheinen erst nach dem Abgleich. Keine Anwesenheitsdauer und kein Nachweis durchgehender Arbeit.</p><div data-activity-list role="status">Wird geladen …</div><button class="button secondary" data-action="profile-activity" data-id="${h(id)}">Aktualisieren</button>`);
    const root=document.querySelector('[data-activity-list]');
    void sync.request('profileActivity',{profileId:id}).then(result=>{if(root.isConnected)root.innerHTML=`<p class="small muted">Zuletzt gemeldete App-Version: <strong>${h(result.profile.latestAppVersion?`v${result.profile.latestAppVersion}`:'Noch keine Meldung')}</strong></p>${result.events.length?`<ol class="activity-list">${activityRows(result.events,h)}</ol>${result.truncated?'<p>Nur die neuesten 200 Einträge werden angezeigt.</p>':''}`:'Noch keine Aktivitäten aufgezeichnet. Die Aufzeichnung beginnt mit dieser App-Version; ältere Aktivitäten werden nicht nachträglich rekonstruiert.'}`;}).catch(e=>{if(root.isConnected&&isAdminView('people'))failure(root,e,'account-profiles');});
  }
  function showCode(result){
    showModal(`<h2 id="modal-title">Code für ${h(result.profile.name)}</h2><p class="access-code" aria-label="Zugangscode ${h(result.code.split('').join(' '))}">${h(result.code)}</p><p>Gib diesen Code persönlich an ${h(result.profile.name)} weiter.</p><p class="small muted">Der Code bleibt bis zum Schließen dieser App in der Nutzerverwaltung sichtbar. Er wird nicht auf diesem Gerät gespeichert.</p><button class="button primary wide" data-action="close-modal">Fertig</button>`);
  }
  function confirmRemoval(action,id){
    const deleting=action==='profile-delete';
    const name=deleting?people.find(p=>p.id===id)?.name:shares.find(s=>s.id===id)?.collection?.name;
    showModal(`<h2 id="modal-title">${deleting?'Nutzer löschen?':'Freigabe beenden?'}</h2><p><strong>${h(name||'Eintrag')}</strong></p><p class="muted">${deleting?'Der Nutzer wird aus der Verwaltung entfernt. Anmeldung und Cloud-Zugriff werden gesperrt; seine Freigaben werden beendet. Sein Cloud-Lernstand bleibt archiviert. Bereits gespeicherte Offline-Daten bleiben auf seinem Gerät.':'Weitere Änderungen werden über diese Freigabe nicht mehr gesendet. Die eigene Sammlung beim Nutzer und bereits gesendete Änderungen bleiben erhalten.'}</p><form id="${action}" data-id="${h(id)}"><button class="button danger wide">${deleting?'Nutzer löschen':'Freigabe beenden'}</button><p role="status" data-save-status></p>${cancelButton}</form>`);
  }
  function inbox(){
    const items=incoming(store.data);
    showModal(`<h2 id="modal-title">Geteilte Änderungen</h2><p class="muted">Diese Einträge unterscheiden sich von deiner eigenen Fassung. Du entscheidest, was du übernehmen möchtest.</p>${items.map(item=>{const current=store.data[item.entity]?.[item.key];const text=describe;return `<section class="conflict"><h3>${h(item.label)}</h3><p><strong>Bei dir:</strong> ${h(text(current))}</p><p><strong>Vorschlag:</strong> ${h(text(item.value))}</p><div class="button-row"><button class="button secondary" data-action="incoming-keep" data-id="${h(item.id)}">Meine Fassung behalten</button><button class="button primary" data-action="incoming-accept" data-id="${h(item.id)}">Übernehmen</button></div></section>`;}).join('')||'<p>Alles erledigt.</p>'}`);
  }
  function toolbar(){const count=incoming(store.data).length;return count?`<button class="button secondary" data-action="incoming-open">${count} Vokabeländerungen ansehen</button>`:'';}
  async function handle(button){
    const action=button.dataset.action,id=button.dataset.id;
    if(!admin&&!['incoming-open','incoming-accept','incoming-keep'].includes(action))return ADMIN_ACTIONS.has(action);
    if(admin&&checker.handle(button))return true;
    if(action==='access-edit'){accessEditor([id]);return true;}
    if(action==='access-batch'){accessEditor([...accessSelection]);return true;}
    if(action==='access-select-all'){const keys=visibleResources().filter(c=>c.resourceKind==='refresh').map(c=>c.key),remove=keys.every(key=>accessSelection.has(key));keys.forEach(key=>remove?accessSelection.delete(key):accessSelection.add(key));paintAccess();return true;}
    if(action==='admin-person'){selectedPerson=selectedPerson===id?'':id;profiles(false);return true;}
    if(action==='profile-new-toggle'){showModal(`<h2 id="modal-title">Nutzer anlegen</h2><form id="profile-create" class="create-profile"><label>Name<input name="name" required maxlength="80" autocomplete="off"></label><label>E-Mail<input name="email" type="email" required maxlength="254" autocapitalize="none"></label>${subjectFields()}${modeField()}<button type="submit" class="button primary wide">Nutzer anlegen</button><p role="status" data-save-status></p>${cancelButton}</form>`);return true;}
    if(action==='share-subject'){
      if(!SUBJECTS.map(subject=>subject.id).includes(id))return true;
      if(pending){notify('Bitte warte, bis die laufende Übertragung abgeschlossen ist.');return true;}
      const epoch=++directoryEpoch;accessSchema=0;accessSelection.clear();accessQuery='';accessKind='all';
      showAdmin(`<h2>Freigaben · ${subjectName(id)}</h2><p role="status" data-subject-loading>Sammlungen werden geladen …</p><div class="indeterminate" aria-hidden="true"></div><button class="text-button" data-action="share-panel">Zurück zur Übersicht</button>`,'shares');
      const loading=document.querySelector('[data-subject-loading]');
      void (async()=>{try{
        const context=id!==shareSubject&&openShareSubject?await openShareSubject(id):{store:shareStore,sync:shareSync};
        if(epoch!==directoryEpoch)return;
        shareStore=context.store;shareSync=context.sync;shareSubject=id;
        resourceShares=shareStore.doc.adminDirectory?.resourceShares||[];shares=shareStore.doc.adminDirectory?.shares||[];predicateShares=shareStore.doc.adminDirectory?.predicateShares||[];
        if(loading.isConnected&&isAdminView('shares'))panel();
      }catch(error){if(epoch===directoryEpoch&&isAdminView('shares'))failure(loading,error,'share-panel');}})();return true;
    }
    if(action==='admin-person-shares'){selectedPerson=id;panel();return true;}
    if(action==='share-select-all'||action==='share-select-none'){document.querySelectorAll('#share-create input[name=collectionId]').forEach(el=>el.checked=action==='share-select-all');return true;}
    if(action==='predicate-share-all'){document.querySelectorAll('#predicate-access-form input[name=recipient]').forEach(el=>el.checked=true);return true;}
    if(action==='share-notify'){
      showModal(`<h2 id="modal-title">Erneut benachrichtigen</h2><form id="share-notify-form" data-id="${h(id)}"><div class="bounded-list">${shares.filter(s=>s.profileId===id).map(s=>`<label class="collection-check"><input type="checkbox" name="shareId" value="${h(s.id)}" checked><span>${h(s.collection?.name||'Sammlung')}</span></label>`).join('')}</div><button type="submit" class="button primary wide">Benachrichtigung senden</button><p role="status" data-save-status></p>${cancelButton}</form>`);return true;
    }
    if(action==='share-repair'){
      showModal(`<h2 id="modal-title">Übertragung reparieren</h2><p>Fehlende Einträge werden aus der zuletzt geteilten Fassung ergänzt. Auch beim Nutzer gelöschte Einträge kommen zurück. Vorhandene Bearbeitungen und Lernstände bleiben erhalten.</p><form id="share-repair-form" data-id="${h(id)}"><button type="submit" class="button primary wide">Prüfen und reparieren</button><p role="status" data-save-status></p>${cancelButton}</form>`);return true;
    }
    if(action==='profile-activity'){if(!admin)return true;profileActivity(id);return true;}
    if(action==='profile-subjects'){if(!admin)return true;profileSubjects(id);return true;}
    if(action==='profile-code-show'){if(codeResult?.profile.id===id)showCode(codeResult);return true;}
    if(action==='profile-code'){
      if(!admin)return true;
      const person=people.find(p=>p.id===id);if(!person)return true;
      showModal(`<h2 id="modal-title">Zugangscode · ${h(person.name)}</h2><p>${person.codeReady?'Ein neuer Code ersetzt den bisherigen und meldet vorhandene Geräte ab.':'Dieser Nutzer braucht einen Code, um sich anzumelden.'} Die Lernstände bleiben erhalten.</p><form id="profile-code-form" data-id="${h(id)}"><button class="button primary wide">Code erzeugen</button><p role="status" data-save-status></p>${cancelButton}</form>`);
      return true;
    }
    if(action==='profile-edit'){if(!admin)return true;profileEdit(id);return true;}
    if(action==='profile-view'){profileView(id);return true;}
    if(action==='share-source'){openCollection?.(id);return true;}
    if(action==='profile-delete'||action==='share-revoke'){confirmRemoval(action,id);return true;}
    if(action==='account-profiles'){directoryEpoch++;await profiles();return true;}
    if(action==='share-panel'){await panel();return true;}
    if(action==='share-changes'){void changes(id);return true;}
    if(action==='incoming-open'){inbox();return true;}
    if(action==='incoming-accept'||action==='incoming-keep'){
      const item=store.data.settings[id];if(!item||item.kind!=='incomingShare')return true;
      const edits=[['settings',id,null]];
      if(action==='incoming-accept'){
        if(item.entity==='words'&&item.value&&!store.data.collections[item.collectionId])throw Error('Die zugehörige Sammlung wurde gelöscht. Übernimm zuerst ihre Wiederherstellung oder behalte deine Fassung.');
        if(item.entity==='collections'&&!item.value){if(!confirm('Diese Sammlung und ihre Vokabeln bei dir löschen?'))return true;Object.values(store.data.words).filter(w=>w.collectionId===item.key).forEach(w=>edits.push(['words',w.id,null]));}
        edits.unshift([item.entity,item.key,item.value]);
      }
      await store.commit(edits);sync.schedule();render();inbox();return true;
    }
    return false;
  }
  async function submit(form){
    if(!admin)return ['access-editor','profile-code-form','profile-create','profile-edit-form','profile-subjects-form','share-create','share-access-form','predicate-access-form','share-notify-form','share-repair-form','share-send','profile-delete','share-revoke'].includes(form.id);
    if(form.id==='access-editor'){void saveAccess(form).catch(e=>{if(form.isConnected)status(form.querySelector('[data-save-status]'),errorText(e));else notify(errorText(e));});return true;}
    if(!['profile-code-form','profile-create','profile-edit-form','profile-subjects-form','share-create','share-access-form','predicate-access-form','share-notify-form','share-repair-form','share-send','profile-delete','share-revoke'].includes(form.id))return false;
    if(form.dataset.saving)return true;
    const fd=new FormData(form),button=form.querySelector('button[type="submit"],button'),message=form.querySelector('[data-save-status]');
    pending++;form.dataset.saving='1';if(button)button.disabled=true;
    status(message,form.id==='profile-create'?'Profil wird angelegt …':form.id==='profile-subjects-form'?'Lernfach-Freigabe wird gespeichert …':'Übertragung läuft. Du kannst dieses Fenster schließen.');
    // Keep navigation responsive while the server confirms the mutation.
    void (async()=>{
      try{
        if(form.id==='profile-delete'||form.id==='share-revoke'){
          const deleting=form.id==='profile-delete',id=form.dataset.id;
          await sync.request(deleting?'profileDelete':'shareRevoke',deleting?{profileId:id}:{shareId:id});
          directoryEpoch++;if(deleting){people=people.filter(p=>p.id!==id);shares=shares.filter(s=>s.profileId!==id);}else shares=shares.filter(s=>s.id!==id);
          await remember();if(form.isConnected){if(deleting)profiles(false);else panel(false);}
          notify(deleting?'Nutzer gelöscht.':'Freigabe beendet.');
        }else if(form.id==='profile-code-form'){
          const result=await sync.request('profileCodeGenerate',{profileId:form.dataset.id});
          directoryEpoch++;people=people.map(p=>p.id===result.profile.id?result.profile:p);await remember();
          codeResult=result;if(form.isConnected){profiles(false);showCode(result);}else notify('Zugangscode bereit. Du findest ihn in der Nutzerverwaltung unter „Neuen Code anzeigen“.');
        }else if(form.id==='profile-create'){
          const allowedSubjects=fd.getAll('allowedSubject');if(!allowedSubjects.length)throw Error('Wähle mindestens ein Lernfach aus.');
          const result=await sync.request('profileCreate',{name:fd.get('name'),email:fd.get('email'),allowedSubjects,simplifiedMode:fd.has('simplifiedMode')});
          directoryEpoch++;people=people.filter(p=>p.id!==result.profile.id);people.push(result.profile);await remember();
          if(form.isConnected){closeModal();newProfileOpen=false;selectedPerson=result.profile.id;profiles(false);}notify('Profil angelegt.');
        }else if(form.id==='profile-edit-form'){
          const allowedSubjects=fd.getAll('allowedSubject');if(!allowedSubjects.length)throw Error('Wähle mindestens ein Lernfach aus.');
          const result=await sync.request('profileUpdate',{profileId:form.dataset.id,name:fd.get('name'),email:fd.get('email'),allowedSubjects,simplifiedMode:fd.has('simplifiedMode')});
          directoryEpoch++;people=people.map(p=>p.id===result.profile.id?result.profile:p);selectedPerson=result.profile.id;await remember();if(form.isConnected){closeModal();profiles(false);}notify('Nutzer aktualisiert.');
        }else if(form.id==='profile-subjects-form'){
          const allowedSubjects=fd.getAll('allowedSubject');if(!allowedSubjects.length)throw Error('Wähle mindestens ein Lernfach aus.');
          const result=await sync.request('profileUpdateSubjects',{profileId:form.dataset.id,allowedSubjects});
          directoryEpoch++;people=people.map(p=>p.id===result.profile.id?result.profile:p);await remember();if(form.isConnected)profiles(false);notify('Lernfach-Freigabe gespeichert.');
        }else if(form.id==='share-create'){
          const collectionIds=fd.getAll('collectionId');if(!collectionIds.length)throw Error('Wähle mindestens eine Sammlung.');
          if(!fd.get('profileId'))throw Error('Wähle einen Empfänger.');
          await flush();const result=await sync.request('shareCreateMany',{collectionIds,profileId:fd.get('profileId')});
          directoryEpoch++;for(const item of result.results){shares=shares.filter(s=>s.id!==item.share.id);shares.push(item.share);}loaded=true;await remember();
          if(form.isConnected)panel(false);notify(result.results.every(r=>r.share.delivery?.present)?`${result.results.length} Sammlungen in der Empfänger-Cloud bestätigt.`:'Freigabe gespeichert. Empfang noch nicht geprüft – bitte Google-Skript aktualisieren.');
        }else if(form.id==='predicate-access-form'){
          const selectedIds=fd.getAll('recipient'),currentIds=new Set(predicateShares.filter(s=>!s.revoked).map(s=>s.profileId));
          await settleSync(shareSync,shareStore);
          for(const person of people){const enabled=selectedIds.includes(person.id);if(enabled||currentIds.has(person.id)){const result=await shareSync.request('predicateShareSet',{profileId:person.id,enabled});predicateShares=predicateShares.filter(s=>s.profileId!==person.id);if(result.share)predicateShares.push(result.share);}}
          await remember();if(form.isConnected)panel(false);notify('Prädikatfreigaben gespeichert.');
        }else if(form.id==='share-access-form'){
          const collectionId=form.dataset.id,selectedIds=fd.getAll('recipient'),existing=shares.filter(s=>s.sourceId===collectionId&&!s.revoked),currentIds=new Set(existing.map(s=>s.profileId));
          await settleSync(shareSync,shareStore);
          for(const profileId of selectedIds){if(!currentIds.has(profileId)){const result=await shareSync.request('shareCreateMany',{collectionIds:[collectionId],profileId});for(const item of result.results){shares=shares.filter(s=>s.id!==item.share.id);shares.push(item.share);}currentIds.add(profileId);}}
          for(const item of existing){if(!selectedIds.includes(item.profileId)){await shareSync.request('shareRevoke',{shareId:item.id});shares=shares.filter(s=>s.id!==item.id);}}
          await remember();if(form.isConnected)panel(false);notify('Sammlungszugriff gespeichert.');
        }else if(form.id==='share-repair-form'){
          const result=await sync.request('shareRepair',{shareId:form.dataset.id});
          directoryEpoch++;shares=shares.filter(s=>s.id!==result.share.id);shares.push(result.share);await remember();
          if(form.isConnected)panel(false);notify(result.repaired?'Fehlende Einträge ergänzt. Empfänger-App neu öffnen.':'Sammlung ist in der Empfänger-Cloud vorhanden. Empfänger-App neu öffnen.');
        }else if(form.id==='share-notify-form'){
          const shareIds=fd.getAll('shareId');if(!shareIds.length)throw Error('Wähle mindestens eine Sammlung.');
          form.dataset.requestId ||= crypto.randomUUID();
          await sync.request('shareNotify',{profileId:form.dataset.id,shareIds,requestId:form.dataset.requestId});
          if(form.isConnected)panel(false);notify('Benachrichtigung gesendet.');
        }else{
          const keys=fd.getAll('change');if(!keys.length)throw Error('Wähle mindestens eine Änderung.');
          await settleSync(shareSync,shareStore);const result=await shareSync.request('shareSend',{shareId:form.dataset.id,keys});
          if(form.isConnected){closeModal();panel(false);}notify(`${result.sent} Änderungen gesendet.`);
        }
      }catch(e){if(form.isConnected)status(message,errorText(e));else notify(errorText(e));}
      finally{pending--;delete form.dataset.saving;if(button?.isConnected)button.disabled=false;}
    })();
    return true;
  }
  function input(el){if(!admin)return false;if(el.id==='access-search'){accessQuery=el.value;paintAccess();return true;}return false;}
  function change(el){if(!admin)return false;if(checker.change({target:el}))return true;if(el.dataset.accessSelect){el.checked?accessSelection.add(el.dataset.accessSelect):accessSelection.delete(el.dataset.accessSelect);const count=document.querySelector('[data-access-count]');if(count)count.textContent=accessSelection.size+' ausgewählt';const button=document.querySelector('[data-action="access-batch"]');if(button)button.disabled=!accessSelection.size||accessSchema!==2;return true;}if(el.id==='access-kind'){accessKind=el.value;paintAccess();return true;}if(el.matches?.('[data-access-all]')){el.closest('form')?.querySelectorAll('input[name=recipient]:not(:disabled)').forEach(input=>input.checked=el.checked);return true;}if(el.matches?.('[data-share-all]')){const form=el.closest('#share-access-form');form?.querySelectorAll('input[name="recipient"]').forEach(input=>input.checked=el.checked);return true;}if(el.matches?.('[data-predicate-all]')){const form=el.closest('#predicate-access-form');form?.querySelectorAll('input[name="recipient"]').forEach(input=>input.checked=el.checked);return true;}if(el.name==='recipient'&&el.closest('#share-access-form')){const form=el.closest('#share-access-form'),all=form.querySelector('[data-share-all]');if(all)all.checked=[...form.querySelectorAll('input[name="recipient"]')].every(input=>input.checked);return true;}if(el.name==='recipient'&&el.closest('#predicate-access-form')){const form=el.closest('#predicate-access-form'),all=form.querySelector('[data-predicate-all]');if(all)all.checked=[...form.querySelectorAll('input[name="recipient"]')].every(input=>input.checked);return true;}return false;}
  return {handle,submit,toolbar,afterAction,refresh,change,input,autoStatusMarkup,get busy(){return pending>0||checker.busy;}};
}
