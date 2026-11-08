const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

// One notice per failed connection, not one per background retry. Dialogs and
// exercises retain their focus; a pending notice waits for a safe moment.
export function createCloudNotice({sync,showModal,closeModal,canPrompt,isOpen,hasLocalContent,reload,online=()=>navigator.onLine}){
 let failure=null,shown=false,retrying=false,lastStatus=sync.status;
 function maybePrompt(){
  if(!failure||shown||retrying||!canPrompt())return false;
  shown=true;
  const offline=online()===false;
  const explanation=hasLocalContent()
   ?'Du kannst mit deinen gespeicherten Sammlungen offline weiterlernen. Deine Antworten bleiben auf diesem Gerät gespeichert und werden später abgeglichen.'
   :'Auf diesem Gerät sind noch keine Sammlungen gespeichert. Für den ersten Download brauchst du eine Verbindung zur Cloud.';
  showModal(`<h2 id="modal-title" data-cloud-connection-notice>${offline?'Du bist offline':'Abgleich gerade nicht möglich'}</h2><p>${explanation}</p>${!offline&&failure.message?`<p class="small muted">${escape(failure.message)}</p>`:''}<div class="word-tools"><button type="button" class="button primary wide" data-action="cloud-retry">Erneut laden</button><button type="button" class="button secondary wide" data-action="cloud-dismiss">Ausblenden</button></div>`);
  return true;
 }
 function fail(error){failure={message:error?.message||sync.message||''};lastStatus=sync.status;return maybePrompt();}
 function update(){
  const recovered=sync.status==='synced'&&lastStatus!=='synced';
  lastStatus=sync.status;
  if(recovered){failure=null;shown=false;if(isOpen())closeModal();return false;}
  if(sync.status==='error'||sync.status==='offline'||online()===false)failure={message:sync.message||''};
  return maybePrompt();
 }
 async function retry(){
  if(retrying)return;
  retrying=true;failure=null;shown=false;
  if(isOpen())closeModal();
  try{await reload();}catch(error){fail(error);}finally{retrying=false;update();}
 }
 function dismiss(){shown=true;failure=null;if(isOpen())closeModal();}
 return {update,fail,maybePrompt,retry,dismiss};
}
