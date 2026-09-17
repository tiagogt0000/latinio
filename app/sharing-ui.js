import {incoming} from './multiuser-sync.js';
export function sharingUI({store,sync,profile,h,showModal,closeModal,notify,render}){
  let shares=store.doc.adminDirectory?.shares||[],people=store.doc.adminDirectory?.people||[],changed=new Set(),notifying=false;
  let pending=0;
  let loaded=!!store.doc.adminDirectory;
  async function remember(){await store.update(doc=>{doc.adminDirectory={shares,people};return doc;});}
  const errorText=e=>String(e.message||e).replace(/^Error:\s*/, '');
  function status(node,message){if(node?.isConnected)node.textContent=message;}
  function profileRows(){return people.map(p=>`<p><strong>${h(p.name)}</strong><br><span class="small muted">${h(p.email)}</span></p>`).join('')||'<p>Noch keine Freundesprofile angelegt.</p>';}
  function shareRows(){return shares.map(s=>`<div class="confusion-pair"><span>${h(s.collection?.name||'Gelöschte Sammlung')} → ${h(s.profileName)}</span><button class="text-button" data-action="share-changes" data-id="${h(s.id)}">Änderungen auswählen</button></div>`).join('')||'<p class="muted">Noch nichts geteilt.</p>';}
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
    await sync.run();
    if(sync.remote)throw Error('Bitte zuerst den neueren Cloud-Stand unter Einstellungen laden.');
    if(sync.status!=='synced'||store.doc.pending.length)throw Error('Deine Änderungen müssen zuerst vollständig hochgeladen sein. Bitte gleich erneut versuchen.');
  }
  function profiles(fetch=true){
    showModal(`<h2 id="modal-title">Profile verwalten</h2><form id="profile-create"><label>Name<input name="name" required maxlength="80" autocomplete="off"></label><label>Schüler-E-Mail<input name="email" type="email" required maxlength="254" autocapitalize="none"></label><button class="button primary wide">Profil anlegen</button><p role="status" class="small muted" data-save-status></p></form><p role="status" class="small muted" data-directory-status>${fetch?'Profile werden im Hintergrund geladen …':''}</p><div class="profile-list">${profileRows()}</div>`);
    if(!fetch)return;
    const root=document.querySelector('.profile-list'),message=document.querySelector('[data-directory-status]');
    void sync.request('profiles').then(async result=>{people=result.profiles;await remember();if(root.isConnected)root.innerHTML=profileRows();status(message,'Aktuell');}).catch(e=>status(message,errorText(e)));
  }
  function panel(fetch=true){
    showModal(`<h2 id="modal-title">Sammlungen teilen</h2><p class="muted">Die gewählte Sammlung wird als eigene, bearbeitbare Kopie geteilt. Dein Lernstand bleibt privat.</p><form id="share-create"><label>Sammlung<select name="collectionId" required><option value="">Bitte auswählen</option>${Object.values(store.data.collections).map(c=>`<option value="${h(c.id)}">${h(c.name)}</option>`).join('')}</select></label><label>Empfänger<select name="profileId" required><option value="">Bitte auswählen</option>${people.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('')}</select></label><button class="button primary wide" ${!people.length?'disabled':''}>Diese Sammlung teilen</button><p role="status" class="small muted" data-save-status></p></form><p role="status" class="small muted" data-directory-status>${fetch?'Freigaben und Profile werden im Hintergrund geladen …':''}</p><h3>Bisher geteilt</h3><div data-share-list>${shareRows()}</div>`);
    if(!fetch)return;
    const form=document.querySelector('#share-create'),message=document.querySelector('[data-directory-status]'),list=document.querySelector('[data-share-list]');
    void Promise.all([sync.request('profiles'),sync.request('shareList')]).then(async ([p,s])=>{
      people=p.profiles;shares=s.shares;loaded=true;await remember();
      if(!form.isConnected)return;
      const select=form.elements.profileId,value=select.value;
      select.innerHTML='<option value="">Bitte auswählen</option>'+people.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('');select.value=value;
      if(!form.dataset.saving)form.querySelector('button').disabled=!people.length;
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
  function inbox(){
    const items=incoming(store.data);
    showModal(`<h2 id="modal-title">Vokabeländerungen</h2><p class="muted">Diese Einträge unterscheiden sich von deiner eigenen Fassung. Du entscheidest, was du übernehmen möchtest.</p>${items.map(item=>{const current=store.data[item.entity]?.[item.key];const text=v=>v?(v.latin?v.latin+' – '+v.meanings.flat().join(', '):v.name):'Gelöscht';return `<section class="conflict"><h3>${h(item.label)}</h3><p><strong>Bei dir:</strong> ${h(text(current))}</p><p><strong>Vorschlag:</strong> ${h(text(item.value))}</p><div class="button-row"><button class="button secondary" data-action="incoming-keep" data-id="${h(item.id)}">Meine Fassung behalten</button><button class="button primary" data-action="incoming-accept" data-id="${h(item.id)}">Übernehmen</button></div></section>`;}).join('')||'<p>Alles erledigt.</p>'}`);
  }
  function toolbar(){const count=incoming(store.data).length;return `${admin?'<button class="button secondary" data-action="share-panel">Sammlungen teilen</button>':''}${count?`<button class="button secondary" data-action="incoming-open">${count} Vokabeländerungen ansehen</button>`:''}`;}
  async function handle(button){
    const action=button.dataset.action,id=button.dataset.id;
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
    if(!['profile-create','share-create','share-send'].includes(form.id))return false;
    if(form.dataset.saving)return true;
    const fd=new FormData(form),button=form.querySelector('button[type="submit"],button'),message=form.querySelector('[data-save-status]');
    pending++;form.dataset.saving='1';if(button)button.disabled=true;
    status(message,form.id==='profile-create'?'Profil wird angelegt …':'Übertragung läuft. Du kannst dieses Fenster schließen.');
    // Keep navigation responsive while the server confirms the mutation.
    void (async()=>{
      try{
        if(form.id==='profile-create'){
          const result=await sync.request('profileCreate',{name:fd.get('name'),email:fd.get('email')});
          people=people.filter(p=>p.id!==result.profile.id);people.push(result.profile);await remember();
          if(form.isConnected)profiles(false);notify('Profil angelegt.');
        }else if(form.id==='share-create'){
          await flush();const result=await sync.request('shareCreate',{collectionId:fd.get('collectionId'),profileId:fd.get('profileId')});
          shares=shares.filter(s=>s.id!==result.share.id);shares.push(result.share);loaded=true;await remember();
          if(form.isConnected)panel(false);notify(result.already?'Bereits geteilt.':'Sammlung geteilt.');
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
