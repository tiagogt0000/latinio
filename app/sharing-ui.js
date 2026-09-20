import {sortedCollections} from './refresh-decks.js';
import {incoming,settleSync} from './multiuser-sync.js';
export function sharingUI({store,sync,profile,h,showModal,closeModal,notify,render,openCollection}){
  let shares=store.doc.adminDirectory?.shares||[],people=store.doc.adminDirectory?.people||[],changed=new Set(),notifying=false;
  let pending=0,directoryEpoch=0;
  let loaded=!!store.doc.adminDirectory;
  async function remember(){await store.update(doc=>{doc.adminDirectory={shares,people};return doc;});}
  const errorText=e=>/Unbekannte.*Aktion/i.test(e.message||e)?'Google verwendet eine ältere Skript-Version. Code.gs und Accounts.gs aktualisieren, dann Bereitstellen → Bereitstellungen verwalten → Stift → Neue Version → Bereitstellen.':String(e.message||e).replace(/^Error:\s*/, '');
  function status(node,message){if(node?.isConnected)node.textContent=message;}
  function profileRows(){return people.map(p=>`<p><strong>${h(p.name)}</strong><br><span class="small muted">${h(p.email)}</span></p><div class="profile-controls"><button class="button secondary" data-action="profile-view" data-id="${h(p.id)}">Sammlungen ansehen</button><button class="text-button danger-text" data-action="profile-delete" data-id="${h(p.id)}">Nutzer löschen</button></div>`).join('')||'<p>Noch keine Freundesprofile angelegt.</p>';}
  function shareRows(){return people.filter(p=>shares.some(s=>s.profileId===p.id)).map(p=>`<button class="button secondary wide" data-action="share-notify" data-id="${h(p.id)}">${h(p.name)} erneut benachrichtigen</button>`).join('')+ (shares.map(s=>`<div class="conflict"><strong>${h(s.collection?.name||'Gelöschte Sammlung')} → ${h(s.profileName)}</strong><div class="profile-controls"><button class="text-button" data-action="share-changes" data-id="${h(s.id)}">Änderungen auswählen</button><button class="text-button" data-action="profile-view" data-id="${h(s.profileId)}">Beim Nutzer ansehen</button><button class="text-button" data-action="share-source" data-id="${h(s.sourceId)}">Meine Sammlung bearbeiten</button><button class="text-button danger-text" data-action="share-revoke" data-id="${h(s.id)}">Freigabe beenden</button></div></div>`).join('')||'<p class="muted">Noch nichts geteilt.</p>');}
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
    showModal(`<h2 id="modal-title">Profile verwalten</h2><form id="profile-create"><label>Name<input name="name" required maxlength="80" autocomplete="off"></label><label>Schüler-E-Mail<input name="email" type="email" required maxlength="254" autocapitalize="none"></label><button class="button primary wide">Profil anlegen</button><p role="status" class="small muted" data-save-status></p></form><p role="status" class="small muted" data-directory-status>${fetch?'Profile werden im Hintergrund geladen …':''}</p><div class="profile-list">${profileRows()}</div>`);
    if(!fetch)return;
    const epoch=directoryEpoch;
    const root=document.querySelector('.profile-list'),message=document.querySelector('[data-directory-status]');
    void sync.request('profiles').then(async result=>{if(epoch!==directoryEpoch)return;people=result.profiles;await remember();if(root.isConnected)root.innerHTML=profileRows();status(message,'Aktuell');}).catch(e=>status(message,errorText(e)));
  }
  function panel(fetch=true){
    showModal(`<h2 id="modal-title">Sammlungen teilen</h2><form id="share-create"><fieldset class="share-picker"><legend>Sammlungen</legend><div class="button-row"><button type="button" class="text-button" data-action="share-select-all">Alle auswählen</button><button type="button" class="text-button" data-action="share-select-none">Keine</button></div><div class="bounded-list">${sortedCollections(store.data).map(c=>`<label class="collection-check"><input type="checkbox" name="collectionId" value="${h(c.id)}"><span>${h(c.name)}</span></label>`).join('')}</div></fieldset><label>Empfänger<select name="profileId" required><option value="">Bitte auswählen</option>${people.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('')}</select></label><button type="submit" class="button primary wide" ${!people.length?'disabled':''}>Ausgewählte Sammlungen teilen</button><p role="status" class="small muted" data-save-status></p></form><p role="status" class="small muted" data-directory-status>${fetch?'Freigaben und Profile werden im Hintergrund geladen …':''}</p><h3>Bisher geteilt</h3><div data-share-list>${shareRows()}</div>`);
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
    showModal('<h2 id="modal-title">Nutzersammlungen</h2><div data-user-collections><p role="status">Cloud-Stand wird geladen …</p><div class="indeterminate"></div></div>');
    const root=document.querySelector('[data-user-collections]');
    void sync.request('profileCollections',{profileId:id}).then(result=>{
      if(!root.isConnected)return;
      const compare=new Map(result.comparisons.map(c=>[c.key,c]));
      const rows=Object.values(result.collections).map(collection=>{
        const words=Object.values(result.words).filter(w=>w.collectionId===collection.id);
        const missing=result.comparisons.filter(c=>c.collectionId===collection.id&&!c.current);
        return `<section class="user-collection"><h3>${h(collection.name)} · ${words.length} Wörter</h3>${words.map(w=>{const c=compare.get(w.id);return `<article class="user-vocab"><strong>${h(w.latin)}</strong><p>${h(w.meanings.map(g=>g.join(' / ')).join(', '))}</p><small class="muted">${c?(c.changed?'Vom Nutzer verändert':'Wie zuletzt geteilt'):'Eigener oder separat importierter Eintrag'}</small>${c?.changed?`<p class="small muted">Zuletzt geteilt: ${h(describe(c.previous))}</p>`:''}${c?`<p class="small muted">Aktuell bei dir: ${h(describe(c.admin))}</p>`:''}</article>`;}).join('')}${missing.map(c=>`<p class="small muted">Beim Nutzer gelöscht: ${h(describe(c.previous))}</p>`).join('')}</section>`;
      }).join('');
      const absent=result.comparisons.filter(c=>!result.collections[c.collectionId]);
      root.innerHTML=`<p><strong>${h(result.profile.name)}</strong></p><p class="small muted">Zuletzt hochgeladener Stand · v${result.version}. Noch nicht synchronisierte Änderungen auf dem Gerät sind hier nicht sichtbar.</p>${rows||'<p>Noch keine Sammlungen vorhanden.</p>'}${absent.length?'<p class="muted">Eine zuvor geteilte Sammlung wurde beim Nutzer gelöscht.</p>':''}`;
    }).catch(e=>{if(root.isConnected)root.textContent=errorText(e);});
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
    if(action==='share-select-all'||action==='share-select-none'){document.querySelectorAll('#share-create input[name=collectionId]').forEach(el=>el.checked=action==='share-select-all');return true;}
    if(action==='share-notify'){
      showModal(`<h2 id="modal-title">Erneut benachrichtigen</h2><form id="share-notify-form" data-id="${h(id)}"><div class="bounded-list">${shares.filter(s=>s.profileId===id).map(s=>`<label class="collection-check"><input type="checkbox" name="shareId" value="${h(s.id)}" checked><span>${h(s.collection?.name||'Sammlung')}</span></label>`).join('')}</div><button type="submit" class="button primary wide">Benachrichtigung senden</button><p role="status" data-save-status></p></form>`);return true;
    }
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
    if(!['profile-create','share-create','share-notify-form','share-send','profile-delete','share-revoke'].includes(form.id))return false;
    if(form.dataset.saving)return true;
    const fd=new FormData(form),button=form.querySelector('button[type="submit"],button'),message=form.querySelector('[data-save-status]');
    pending++;form.dataset.saving='1';if(button)button.disabled=true;
    status(message,form.id==='profile-create'?'Profil wird angelegt …':'Übertragung läuft. Du kannst dieses Fenster schließen.');
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
          const result=await sync.request('profileCreate',{name:fd.get('name'),email:fd.get('email')});
          directoryEpoch++;people=people.filter(p=>p.id!==result.profile.id);people.push(result.profile);await remember();
          if(form.isConnected)profiles(false);notify('Profil angelegt.');
        }else if(form.id==='share-create'){
          const collectionIds=fd.getAll('collectionId');if(!collectionIds.length)throw Error('Wähle mindestens eine Sammlung.');
          if(!fd.get('profileId'))throw Error('Wähle einen Empfänger.');
          await flush();const result=await sync.request('shareCreateMany',{collectionIds,profileId:fd.get('profileId')});
          directoryEpoch++;for(const item of result.results){shares=shares.filter(s=>s.id!==item.share.id);shares.push(item.share);}loaded=true;await remember();
          if(form.isConnected)panel(false);notify(`${result.results.length} Sammlungen freigegeben.`);
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
  return {handle,submit,toolbar,afterAction,refresh,get busy(){return pending>0;}};
}
