import {SUBJECTS} from './subjects.js';
export function notificationsUI({sync,profile,h,showModal,showAdmin,notify,render}){
 let state=null,catalog=null,history=[],enabled=false;
 const supported=()=>!!(globalThis.Notification&&navigator.serviceWorker&&globalThis.PushManager);
 const request=(action,payload={})=>sync.request(action,payload);
 async function registration(){return navigator.serviceWorker.ready;}
 function settingsMarkup(){return `<section class="settings-section"><h2>Lern-Erinnerungen</h2><p class="small muted">Ein freundlicher Schubs, wenn du heute noch keine Runde abgeschlossen hast. Höchstens einmal am Tag, zu einer zufälligen Zeit am späten Nachmittag oder Abend. Lernen in jedem der drei Fächer zählt.</p><p class="small muted" data-notification-status>${!supported()?'Auf dem iPhone: Öffne die installierte App vom Home-Bildschirm.':enabled?'Auf diesem Gerät eingeschaltet.':Notification.permission==='denied'?'Benachrichtigungen sind vom Gerät blockiert. Erlaube sie in den Geräte-Einstellungen.':'Auf diesem Gerät ausgeschaltet.'}</p><button class="button secondary wide" data-action="${enabled?'notification-disable':'notification-enable'}" ${!supported()?'disabled':''}>${enabled?'Erinnerungen hier ausschalten':'Benachrichtigungen erlauben'}</button>${profile.role==='admin'?'<button class="text-button wide" data-action="notification-admin">Nachrichten & Versand verwalten</button>':''}</section>`;}
 async function refresh(){
  if(!supported())return;
  try{state=await request('notificationStatus');const sub=await (await registration()).pushManager.getSubscription();enabled=!!sub&&Notification.permission==='granted';
   // Refresh ownership after a login, and keep a device opted in without prompting again.
   if(enabled)await request('notificationSubscribe',{subscription:sub.toJSON(),zone:Intl.DateTimeFormat().resolvedOptions().timeZone});
   const status=document.querySelector('[data-notification-status]');if(status)render();
  }catch{enabled=false;}
 }
 async function disable(){if(!supported())return;const sub=await (await registration()).pushManager.getSubscription();if(sub){await request('notificationUnsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}enabled=false;}
 const time=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
 const minute=value=>{const [hours,minutes]=value.split(':').map(Number);return hours*60+minutes;};
 function adminView(){
  showAdmin(`<div class="section-top"><h2>Lern-Erinnerungen</h2><span class="small muted">${state?.deviceCount||0} angemeldete Geräte</span></div><p class="muted">Zufälliger Text, zufällige Zeit im gewählten Fenster. Höchstens eine Erinnerung je Nutzer und Tag. Eine abgeschlossene Runde in Latein, Englisch oder Französisch reicht, damit keine Erinnerung mehr gesendet wird. Maßgeblich ist der synchronisierte Lernstand.</p><form id="notification-catalog"><label class="setting-row"><span>Erinnerungen für alle aktiv</span><input class="switch" name="enabled" type="checkbox" ${catalog.enabled?'checked':''}></label><div class="notification-times"><label>Frühestens<input name="start" type="time" min="08:00" max="21:00" required value="${time(catalog.start)}"></label><label>Spätestens<input name="end" type="time" min="08:00" max="21:00" required value="${time(catalog.end)}"></label></div><p class="small muted">Es gilt die Zeitzone des zuletzt angemeldeten Geräts.</p><div id="notification-messages">${catalog.messages.map(rowMarkup).join('')}</div><div class="button-row"><button type="button" class="button secondary" data-action="notification-new">Text hinzufügen</button><button class="button primary" type="submit">Änderungen speichern</button></div><p role="status" data-notification-save></p></form><section class="notification-history"><h2>Versandverlauf</h2><button class="text-button" data-action="notification-admin">Aktualisieren</button><p class="small muted">Letzte 200 Einträge, maximal 90 Tage. „Angenommen“ bedeutet: an den Push-Dienst übergeben; eine Anzeige auf dem Handy kann die App nicht bestätigen.</p>${history.map(row=>`<article><small class="muted">${h(new Date(row.at).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}))} · ${h(row.name)}</small><p>${h(row.text)}</p><small>${h(row.result)}</small></article>`).join('')||'<p class="muted">Noch keine Erinnerungen versendet.</p>'}</section>`,'reminders');
 }
 function rowMarkup(m){return `<fieldset class="notification-message" data-notification-id="${h(m.id)}"><div class="button-row"><label><input type="checkbox" name="active" ${m.enabled?'checked':''}> Aktiv</label><select name="subject" aria-label="Lernfach"><option value="all" ${m.subject==='all'?'selected':''}>Alle Fächer</option>${SUBJECTS.map(s=>`<option value="${s.id}" ${s.id===m.subject?'selected':''}>${s.flag} ${s.label}</option>`).join('')}</select><button type="button" class="text-button danger-text" data-action="notification-remove">Entfernen</button></div><label>Nachricht<textarea name="text" maxlength="240" required rows="3">${h(m.text)}</textarea></label></fieldset>`;}
 async function handle(button){
  const action=button.dataset.action;if(!action?.startsWith('notification-'))return false;
  if(action==='notification-enable'){
   if(!supported())throw Error('Bitte öffne die installierte App auf dem Home-Bildschirm.');
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Benachrichtigungen wurden nicht erlaubt. Du kannst das später in den Geräte-Einstellungen ändern.');
   state=state||await request('notificationStatus');const reg=await registration();const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:state.publicKey});
   try{await request('notificationSubscribe',{subscription:sub.toJSON(),zone:Intl.DateTimeFormat().resolvedOptions().timeZone});enabled=true;render();notify('Lern-Erinnerungen sind auf diesem Gerät eingeschaltet.');}catch(error){await sub.unsubscribe();throw error;}
  }else if(action==='notification-disable'){await disable();render();notify('Erinnerungen auf diesem Gerät ausgeschaltet.');}
  else{
   if(profile.role!=='admin')return true;
   if(action==='notification-admin'){const result=await request('notificationAdmin');state=result;catalog=result.catalog;history=result.history;adminView();}
   if(action==='notification-new'){const id=crypto.randomUUID();document.querySelector('#notification-messages').insertAdjacentHTML('beforeend',rowMarkup({id,enabled:true,subject:'all',text:''}));document.querySelector(`[data-notification-id="${id}"] textarea`).focus();}
   if(action==='notification-remove')button.closest('[data-notification-id]')?.remove();
  }return true;
 }
 async function submit(form){
  if(form.id!=='notification-catalog')return false;if(profile.role!=='admin')return true;
  const fd=new FormData(form);const next={enabled:fd.has('enabled'),start:minute(fd.get('start')),end:minute(fd.get('end')),messages:[...form.querySelectorAll('[data-notification-id]')].map(row=>({id:row.dataset.notificationId,enabled:row.querySelector('[name="active"]').checked,subject:row.querySelector('[name="subject"]').value,text:row.querySelector('textarea').value}))};
  await request('notificationCatalogSave',{catalog:next});catalog=next;notify('Erinnerungen gespeichert.');return true;
 }
 return {settingsMarkup,refresh,handle,submit,disable};
}
