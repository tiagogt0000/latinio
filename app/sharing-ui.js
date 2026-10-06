import {activityRows} from './activity.js';
import {sortedCollections} from './refresh-decks.js';
import {incoming,settleSync} from './multiuser-sync.js';
export function sharingUI({store,sync,profile,h,showModal,showAdmin,closeModal,notify,render,openCollection}){
  let shares=store.doc.adminDirectory?.shares||[],people=store.doc.adminDirectory?.people||[],changed=new Set(),notifying=false;
  let pending=0,directoryEpoch=0,selectedPerson='';
  let loaded=!!store.doc.adminDirectory;
  async function remember(){await store.update(doc=>{doc.adminDirectory={shares,people};return doc;});}
  const errorText=e=>/Unbekannte.*Aktion/i.test(e.message||e)?'Google verwendet eine ältere Skript-Version. Code.gs und Accounts.gs aktualisieren, dann Bereitstellen → Bereitstellungen verwalten → Stift → Neue Version → Bereitstellen.':String(e.message||e).replace(/^Error:\s*/, '');
  function status(node,message){if(node?.isConnected)node.textContent=message;}
  function profileRows(){
    const person=people.find(p=>p.id===selectedPerson);
    const directory=`<div class="people-grid">${people.map(p=>`<button class="person-card ${p.id===selectedPerson?'selected':''}" data-action="admin-person" data-id="${h(p.id)}"><span class="person-avatar" aria-hidden="true">${h(p.name.slice(0,1).toUpperCase())}</span><span><strong>${h(p.name)}</strong><small>${h(p.email)}</small><small>${normalizeSubjects(p.allowedSubjects).map(subjectName).join(' · ')}</small></span><span aria-hidden="true">→</span></button>`).join('')||'<p class="muted">Noch keine Nutzer angelegt.</p>'}</div>`;
    return directory+(person?`<section class="card person-detail"><div class="section-top"><h3>${h(person.name)}</h3><span class="small muted">${h(person.latestAppVersion?'v'+person.latestAppVersion:'Version noch nicht gemeldet')}</span></div><div class="profile-controls"><button class="button secondary" data-action="admin-person-shares" data-id="${h(person.id)}">Freigaben verwalten</button><button class="button secondary" data-action="profile-subjects" data-id="${h(person.id)}">Lernfächer</button><button class="button secondary" data-action="profile-view" data-id="${h(person.id)}">Sammlungen ansehen</button><button class="button secondary" data-action="profile-activity" data-id="${h(person.id)}">Aktivitäten</button><button class="button secondary danger-text" data-action="profile-delete" data-id="${h(person.id)}">Nutzer löschen</button></div></section>`:'<p class="muted">Wähle einen Nutzer für Freigaben, Lernfächer und Aktivitäten.</p>');
  }
  function normalizeSubjects(value){return Array.isArray(value)&&value.length?value.filter(x=>x==='latin'||x==='english'):['latin','english'];}
  function subjectName(value){return value==='english'?'Englisch':'Latein';}
  function subjectFields(subjects){const selected=normalizeSubjects(subjects);return `<fieldset class="share-picker"><legend>Lernfächer freigeben</legend><label class="collection-check"><input type="checkbox" name="allowedSubject" value="latin" ${selected.includes('latin')?'checked':''}><span>Latein</span></label><label class="collection-check"><input type="checkbox" name="allowedSubject" value="english" ${selected.includes('english')?'checked':''}><span>Englisch</span></label></fieldset>`;}
  function shareRows(){
    if(!selectedPerson)return '<p class="empty-state">Wähle zuerst einen Nutzer. Hier erscheinen nur seine Freigaben.</p>';
    const rows=shares.filter(s=>s.profileId===selectedPerson);
    return `<div class="section-top"><h3>${rows.length} Freigaben</h3>${rows.length?`<button class="button secondary" data-action="share-notify" data-id="${h(selectedPerson)}">Erneut benachrichtigen</button>`:''}</div>`+(rows.map(s=>`<details class="share-entry"><summary>${h(s.collection?.name||'Gelöschte Sammlung')}</summary><p class="small muted">${s.delivery?(s.delivery.present?'In der Empfänger-Cloud: '+s.delivery.wordCount+' Wörter'+(s.delivery.missingWords?' · '+s.delivery.missingWords+' fehlende Einträge':''):'Sammlung fehlt in der Empfänger-Cloud'):'Empfang noch nicht geprüft'}</p><div class="profile-controls"><button class="button secondary" data-action="share-changes" data-id="${h(s.id)}">Änderungen senden</button><button class="button secondary" data-action="share-repair" data-id="${h(s.id)}">Übertragung prüfen</button><button class="button secondary" data-action="profile-view" data-id="${h(s.profileId)}">Beim Nutzer ansehen</button><button class="button secondary" data-action="share-source" data-id="${h(s.sourceId)}">Meine Sammlung</button><button class="button secondary danger-text" data-action="share-revoke" data-id="${h(s.id)}">Freigabe beenden</button></div></details>`).join('')||'<p class="muted">Noch keine Sammlungen mit diesem Nutzer geteilt.</p>');
  }
  const admin=profile.role==='admin';
  async function refresh(){if(admin){shares=(await sync.request('shareList')).shares;loaded=true;await remember();}return shares;}
  store.addEventListener('commit',event=>{
    if(!admin)return;
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
    showAdmin(`<div class="section-top"><h2>Deine Nutzer</h2><button class="button secondary" data-action="account-profiles">Aktualisieren</button></div><p role="status" class="small muted" data-directory-status>${fetch?'Profile werden geladen …':''}</p><div class="profile-list">${profileRows()}</div><details class="card create-profile"><summary>Neuen Nutzer anlegen</summary><form id="profile-create"><label>Name<input name="name" required maxlength="80" autocomplete="off"></label><label>Schüler-E-Mail<input name="email" type="email" required maxlength="254" autocapitalize="none"></label>${subjectFields()}<button class="button primary">Profil anlegen</button><p role="status" class="small muted" data-save-status></p></form></details>`,'people');
    if(!fetch)return;
    const epoch=directoryEpoch;
    const root=document.querySelector('.profile-list'),message=document.querySelector('[data-directory-status]');
    void sync.request('profiles').then(async result=>{if(epoch!==directoryEpoch)return;people=result.profiles;await remember();if(root.isConnected)root.innerHTML=profileRows();status(message,'Aktuell');}).catch(e=>status(message,errorText(e)));
  }
  function panel(fetch=true){
    showAdmin(`<h2>Sammlungen freigeben</h2><p class="muted">Freigaben für das aktuelle Lernfach. Wähle einen Nutzer und danach die Sammlungen.</p><form id="share-create"><label>Nutzer<select name="profileId" required><option value="">Bitte auswählen</option>${people.map(p=>`<option value="${h(p.id)}" ${p.id===selectedPerson?'selected':''}>${h(p.name)}</option>`).join('')}</select></label><details class="card share-picker"><summary>Weitere Sammlungen teilen</summary><div class="button-row"><button type="button" class="button secondary" data-action="share-select-all">Alle auswählen</button><button type="button" class="button secondary" data-action="share-select-none">Keine</button></div><div class="bounded-list">${sortedCollections(store.data).map(c=>`<label class="collection-check"><input type="checkbox" name="collectionId" value="${h(c.id)}"><span>${h(c.name)}</span></label>`).join('')}</div><button type="submit" class="button primary" ${!people.length?'disabled':''}>Auswahl teilen</button><p role="status" class="small muted" data-save-status></p></details></form><p role="status" class="small muted" data-directory-status>${fetch?'Freigaben werden geladen …':''}</p><div data-share-list>${shareRows()}</div>`,'shares');
    if(!fetch)return;
    const epoch=directoryEpoch;
    const form=document.querySelector('#share-create'),message=document.querySelector('[data-directory-status]'),list=document.querySelector('[data-share-list]');
    void Promise.all([sync.request('profiles'),sync.request('shareList')]).then(async ([p,s])=>{
      if(epoch!==directoryEpoch)return;people=p.profiles;shares=s.shares;loaded=true;await remember();
      if(!form.isConnected)return;
      const select=form.elements.profileId,value=select.value;
      select.innerHTML='<option value="">Bitte auswählen</option>'+people.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('');select.value=value;
      if(!form.dataset.saving)form.querySelector('button[type=submit]').disabled=!people.length;
      list.innerHTML=shareRows();status(message,'Aktuell');
    }).catch(e=>status(message,errorText(e)));
  }
  function describe(value){return value?(value.latin?value.latin+' – '+value.meanings.map(g=>g.join(' / ')).join(', '):value.name):'Gelöscht / noch nicht vorhanden';}
  async function changes(id){
    showModal('<h2 id="modal-title">Änderungen auswählen</h2><p role="status" data-changes-loading>Änderungen werden geladen …</p><div class="indeterminate"></div>');
    const loading=document.querySelector('[data-changes-loading]');
    try{await flush();const result=await sync.request('shareChanges',{shareId:id});if(!loading.isConnected)return;
    showModal(`<h2 id="modal-title">Änderungen an ${h(result.share.profileName)}</h2><p class="muted">Wähle nur die Änderungen aus, die du senden möchtest.</p><form id="share-send" data-id="${h(id)}">${result.changes.map(c=>`<label class="collection-check"><input name="change" type="checkbox" value="${h(c.key)}"><span><strong>${h(c.label)}</strong><br><small>Bisher geteilt: ${h(describe(c.previous))}<br>Neue Fassung: ${h(describe(c.source))}</small></span></label>`).join('')||'<p>Keine ungesendeten Änderungen.</p>'}<button class="button primary wide" ${!result.changes.length?'disabled':''}>Ausgewählte Änderungen senden</button><p role="status" class="small muted" data-save-status></p></form>`);
    }catch(e){status(loading,errorText(e));if(loading.isConnected)loading.nextElementSibling?.remove();}
  }
  async function afterAction(){
    if(!admin||!changed.size||notifying)return;
    notifying=true;const ids=new Set(changed);changed.clear();
    try{
      if(!loaded)await refresh();const affected=shares.filter(s=>ids.has(s.sourceId));
      if(affected.length&&!document.querySelector('.modal'))showModal(`<h2 id="modal-title">Änderung auch weitergeben?</h2><p>Deine Bearbeitung ist bei dir gespeichert. Möchtest du Änderungen auch an deine Freunde senden?</p><div class="word-tools">${affected.map(s=>`<button class="button secondary" data-action="share-changes" data-id="${h(s.id)}">Für ${h(s.profileName)} auswählen</button>`).join('')}<button class="text-button" data-action="close-modal">Nur bei mir ändern</button></div>`);
    }catch{notify('Bei dir gespeichert. Du kannst die Änderung später unter „Sammlungen teilen“ senden.');}
    finally{notifying=false;}
  }
  function profileView(id){
    showAdmin('<h2>Nutzersammlungen</h2><div data-user-collections><p role="status">Cloud-Stand wird geladen …</p><div class="indeterminate"></div></div>');
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
    }).catch(e=>{if(root.isConnected)root.textContent=errorText(e);});
  }
  function profileSubjects(id){
    const person=people.find(p=>p.id===id);if(!person)return;
    showModal(`<h2 id="modal-title">Lernfächer · ${h(person.name)}</h2><p class="muted">Nur freigegebene Lernfächer sind für diesen Nutzer verfügbar.</p><form id="profile-subjects-form" data-id="${h(id)}">${subjectFields(person.allowedSubjects)}<button class="button primary wide">Freigabe speichern</button><p role="status" class="small muted" data-save-status></p></form>`);
  }
  function profileActivity(id){
    const person=people.find(p=>p.id===id);
    showAdmin(`<h2>Aktivitätsprotokoll · ${h(person?.name||'Schüler')}</h2><p class="small muted">Letzte 90 Tage · maximal 200 Einträge · deutsche Zeit (Europe/Berlin). Gerätezeit; offline erfasste Aktionen erscheinen erst nach dem Abgleich. Keine Anwesenheitsdauer und kein Nachweis durchgehender Arbeit.</p><div data-activity-list role="status">Wird geladen …</div><button class="text-button" data-action="profile-activity" data-id="${h(id)}">Aktualisieren</button>`);
    const root=document.querySelector('[data-activity-list]');
    void sync.request('profileActivity',{profileId:id}).then(result=>{if(root.isConnected)root.innerHTML=`<p class="small muted">Zuletzt gemeldete App-Version: <strong>${h(result.profile.latestAppVersion?`v${result.profile.latestAppVersion}`:'Noch keine Meldung')}</strong></p>${result.events.length?`<ol class="activity-list">${activityRows(result.events,h)}</ol>${result.truncated?'<p>Nur die neuesten 200 Einträge werden angezeigt.</p>':''}`:'Noch keine Aktivitäten aufgezeichnet. Die Aufzeichnung beginnt mit dieser App-Version; ältere Aktivitäten werden nicht nachträglich rekonstruiert.'}`;}).catch(e=>{if(root.isConnected)root.textContent=errorText(e);});
  }
  function confirmRemoval(action,id){
    const deleting=action==='profile-delete';
    const name=deleting?people.find(p=>p.id===id)?.name:shares.find(s=>s.id===id)?.collection?.name;
    showModal(`<h2 id="modal-title">${deleting?'Nutzer löschen?':'Freigabe beenden?'}</h2><p><strong>${h(name||'Eintrag')}</strong></p><p class="muted">${deleting?'Der Nutzer wird aus der Verwaltung entfernt. Anmeldung und Cloud-Zugriff werden gesperrt; seine Freigaben werden beendet. Sein Cloud-Lernstand bleibt archiviert. Bereits gespeicherte Offline-Daten bleiben auf seinem Gerät.':'Weitere Änderungen werden über diese Freigabe nicht mehr gesendet. Die eigene Sammlung beim Nutzer und bereits gesendete Änderungen bleiben erhalten.'}</p><form id="${action}" data-id="${h(id)}"><button class="button danger wide">${deleting?'Nutzer löschen':'Freigabe beenden'}</button><p role="status" data-save-status></p></form>`);
  }
  function inbox(){
    const items=incoming(store.data);
    showModal(`<h2 id="modal-title">Vokabeländerungen</h2><p class="muted">Diese Einträge unterscheiden sich von deiner eigenen Fassung. Du entscheidest, was du übernehmen möchtest.</p>${items.map(item=>{const current=store.data[item.entity]?.[item.key];const text=v=>v?(v.latin?v.latin+' – '+v.meanings.flat().join(', '):v.name):'Gelöscht';return `<section class="conflict"><h3>${h(item.label)}</h3><p><strong>Bei dir:</strong> ${h(text(current))}</p><p><strong>Vorschlag:</strong> ${h(text(item.value))}</p><div class="button-row"><button class="button secondary" data-action="incoming-keep" data-id="${h(item.id)}">Meine Fassung behalten</button><button class="button primary" data-action="incoming-accept" data-id="${h(item.id)}">Übernehmen</button></div></section>`;}).join('')||'<p>Alles erledigt.</p>'}`);
  }
  function toolbar(){const count=incoming(store.data).length;return `${admin?'<button class="button secondary" data-action="share-panel">Teilen verwalten</button>':''}${count?`<button class="button secondary" data-action="incoming-open">${count} Vokabeländerungen ansehen</button>`:''}`;}
  async function handle(button){
    const action=button.dataset.action,id=button.dataset.id;
    if(action==='admin-person'){selectedPerson=id;profiles(false);return true;}
    if(action==='admin-person-shares'){selectedPerson=id;panel();return true;}
    if(action==='share-select-all'||action==='share-select-none'){document.querySelectorAll('#share-create input[name=collectionId]').forEach(el=>el.checked=action==='share-select-all');return true;}
    if(action==='share-notify'){
      showModal(`<h2 id="modal-title">Erneut benachrichtigen</h2><form id="share-notify-form" data-id="${h(id)}"><div class="bounded-list">${shares.filter(s=>s.profileId===id).map(s=>`<label class="collection-check"><input type="checkbox" name="shareId" value="${h(s.id)}" checked><span>${h(s.collection?.name||'Sammlung')}</span></label>`).join('')}</div><button type="submit" class="button primary wide">Benachrichtigung senden</button><p role="status" data-save-status></p></form>`);return true;
    }
    if(action==='share-repair'){
      showModal(`<h2 id="modal-title">Übertragung reparieren</h2><p>Fehlende Einträge werden aus der zuletzt geteilten Fassung ergänzt. Auch beim Nutzer gelöschte Einträge kommen zurück. Vorhandene Bearbeitungen und Lernstände bleiben erhalten.</p><form id="share-repair-form" data-id="${h(id)}"><button type="submit" class="button primary wide">Prüfen und reparieren</button><p role="status" data-save-status></p></form>`);return true;
    }
    if(action==='profile-activity'){if(!admin)return true;profileActivity(id);return true;}
    if(action==='profile-subjects'){if(!admin)return true;profileSubjects(id);return true;}
    if(action==='profile-view'){profileView(id);return true;}
    if(action==='share-source'){openCollection?.(id);return true;}
    if(action==='profile-delete'||action==='share-revoke'){confirmRemoval(action,id);return true;}
    if(action==='account-profiles'){await profiles();return true;}
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
    if(!['profile-create','profile-subjects-form','share-create','share-notify-form','share-repair-form','share-send','profile-delete','share-revoke'].includes(form.id))return false;
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
        }else if(form.id==='profile-create'){
          const allowedSubjects=fd.getAll('allowedSubject');if(!allowedSubjects.length)throw Error('Wähle mindestens ein Lernfach aus.');
          const result=await sync.request('profileCreate',{name:fd.get('name'),email:fd.get('email'),allowedSubjects});
          directoryEpoch++;people=people.filter(p=>p.id!==result.profile.id);people.push(result.profile);await remember();
          if(form.isConnected)profiles(false);notify('Profil angelegt.');
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
          await flush();const result=await sync.request('shareSend',{shareId:form.dataset.id,keys});
          if(form.isConnected)panel(false);notify(`${result.sent} Änderungen gesendet.`);
        }
      }catch(e){if(form.isConnected)status(message,errorText(e));else notify(errorText(e));}
      finally{pending--;delete form.dataset.saving;if(button?.isConnected)button.disabled=false;}
    })();
    return true;
  }
  function change(el){if(el.name!=='profileId'||!el.closest('#share-create'))return false;selectedPerson=el.value;const list=document.querySelector('[data-share-list]');if(list)list.innerHTML=shareRows();return true;}
  return {handle,submit,toolbar,afterAction,refresh,change,get busy(){return pending>0;}};
}
