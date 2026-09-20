// Incoming shared edits are independent of regular progress synchronization.
export function incoming(data){return Object.values(data.settings).filter(x=>x?.kind==='incomingShare').sort((a,b)=>(a.order??a.at)-(b.order??b.at)||a.id.localeCompare(b.id));}
export function incomingChanges(data){
  const changes=[],conflicts=[],copy=structuredClone(data);
  for(const item of incoming(data)){
    const current=copy[item.entity]?.[item.key]??null;
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const parentMissing=item.entity==='words'&&item.value&&!copy.collections[item.collectionId];
    const collectionDelete=item.entity==='collections'&&item.value===null&&Object.values(copy.words).some(w=>w.collectionId===item.key);
    if(!parentMissing&&!collectionDelete&&(same(current,item.previous)||same(current,item.value))){
      changes.push([item.entity,item.key,item.value],['settings',item.id,null]);
      if(item.value===null)delete copy[item.entity][item.key];else copy[item.entity][item.key]=item.value;
      delete copy.settings[item.id];
    }else conflicts.push(item);
  }
  return {changes,conflicts};
}
const settling=new WeakMap();
export function settleSync(sync,store){
 if(settling.has(sync))return settling.get(sync);
 const task=settle(sync,store).finally(()=>settling.delete(sync));settling.set(sync,task);return task;
}
async function settle(sync,store){
  for(let attempt=0;attempt<10;attempt++){
    if(!navigator.onLine)throw Error('Du bist offline. Dein Lernstand ist auf diesem Gerät gespeichert.');
    await sync.run();
    if(sync.status==='error'||sync.status==='offline')throw Error(sync.message);
    if(sync.remote){
      // Regular multi-device conflicts preserve pending local edits; shared vocabulary edits use the inbox.
      const choices=Object.fromEntries(sync.compare().conflicts.map(c=>[c.key,'local']));
      await sync.accept(choices);continue;
    }
    const result=incomingChanges(store.data);
    if(result.changes.length){await store.commit(result.changes);continue;}
    if(!store.doc.pending.length&&sync.status==='synced')return;
  }
  throw Error('Der Abgleich ist noch nicht abgeschlossen. Bitte erneut versuchen.');
}
export function cloudGate({sync,store,name='du',onReady}){
 const dialog=document.createElement('dialog');dialog.className='cloud-wait';dialog.setAttribute('aria-labelledby','cloud-greeting');document.body.append(dialog);
 dialog.addEventListener('cancel',e=>e.preventDefault());let running=null;
 const stages={checking:'Verbindung zur Cloud wird hergestellt …',newer:'Cloud-Stand wird heruntergeladen …',loading:'Cloud-Stand wird heruntergeladen …',uploading:'Fortschritt wird gespeichert …',synced:'Alles bereit.'};
 function status(){const el=dialog.querySelector('[data-cloud-stage]');if(el)el.textContent=stages[sync.status]||'Cloud-Stand wird geprüft …';}
 function showLoading(label){dialog.classList.remove('leaving');dialog.innerHTML='<div class="cloud-welcome"><h1 id="cloud-greeting"></h1><p class="cloud-intro"></p><div class="cloud-orbit" aria-hidden="true"><i></i><i></i><i></i></div><p data-cloud-stage role="status" aria-live="polite"></p></div>';dialog.querySelector('h1').textContent='Hallo '+name;dialog.querySelector('.cloud-intro').textContent=label;status();}
 function execute(label='Wir bereiten alles vor.'){
  if(running)return running;
  // Defer execution so the guard is set even when offline.
  running=Promise.resolve().then(async()=>{
   if(!navigator.onLine)return;
   showLoading(label);dialog.showModal();sync.addEventListener('change',status);
   while(true){
    try{await settleSync(sync,store);break;}
    catch(error){
     dialog.innerHTML='<div class="cloud-welcome"><h1 id="cloud-greeting">Verbindung unterbrochen</h1><p role="status"></p><div class="word-tools"><button class="button primary" data-choice="retry">Erneut versuchen</button><button class="button secondary" data-choice="offline">Offline fortfahren</button></div></div>';
     dialog.querySelector('p').textContent=error.message;
     const choice=await new Promise(resolve=>{dialog.onclick=e=>{const b=e.target.closest('[data-choice]');if(b)resolve(b.dataset.choice);};});dialog.onclick=null;
     if(choice==='offline')break;showLoading(label);
    }
   }
  }).finally(async()=>{sync.removeEventListener('change',status);if(dialog.open){dialog.classList.add('leaving');await new Promise(resolve=>setTimeout(resolve,180));dialog.close();}running=null;onReady?.();});
  return running;
 }
 return {run:execute,get blocked(){return !!running;}};
}
