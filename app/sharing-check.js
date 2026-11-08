import {uid} from './core.js';

export function adjustDifferenceSelection(differences,selected,id,checked){
  const item=differences.find(d=>d.id===id);if(!item)return;
  checked?selected.add(id):selected.delete(id);
  if(checked&&item.parentMissing&&item.key!=='deck'){
    const parent=differences.find(d=>d.resourceId===item.resourceId&&d.key==='deck'&&d.profileId===item.profileId&&d.subject===item.subject);if(parent)selected.add(parent.id);
  }
  if(!checked&&item.key==='deck'&&item.parentMissing)differences.filter(d=>d.resourceId===item.resourceId&&d.profileId===item.profileId&&d.subject===item.subject).forEach(d=>selected.delete(d.id));
}

export function sharingCheck({sync,h,showAdmin,prepare,notify,isVisible=()=>true}){
  let people=[],chosen=new Set(),differences=[],selected=new Set(),checkedAt=0,busy=false,excluded=new Set(),error='',operation='',loaded=false;
  const identity=d=>JSON.stringify([d.profileId,d.subject,d.resourceId,d.key]);
  const text=value=>value==null?'Nicht vorhanden':value.latin?`${value.latin} · ${value.meanings.map(g=>g.join(' / ')).join(' · ')}${value.forms?.length?' · Formen: '+value.forms.join(', '):''}`:value.grundform?`${value.grundform} · ${value.praedikate.join(' / ')}`:value.name||JSON.stringify(value);
  function view(force=false){
    if(!force&&!isVisible())return;
    showAdmin(`<div class="section-top"><h2>Freigaben prüfen</h2><button class="text-button" data-action="share-panel">Zur Freigabenübersicht</button></div><p class="muted">Vergleicht deine Lektionen und Perfekt-Sammlungen in Latein und Englisch mit den ausgewählten Nutzern. Die Prüfung ändert keine Freigaben oder Lernstände.</p>${error?`<div class="admin-error" role="alert"><p>${h(error)}</p>${!loaded?'<button class="button secondary" data-action="sharing-check">Erneut laden</button>':''}</div>`:''}<div class="checker-people">${people.map(p=>`<label class="collection-check"><input type="checkbox" data-check-person="${h(p.id)}" ${chosen.has(p.id)?'checked':''} ${busy?'disabled':''}><span>${h(p.name)}</span></label>`).join('')}</div><div class="button-row"><button class="text-button" data-action="check-all-people" ${busy?'disabled':''}>${chosen.size===people.length&&people.length?'Auswahl aufheben':'Alle auswählen'}</button><button class="button primary" data-action="check-run" ${busy||!chosen.size?'disabled':''}>Jetzt prüfen</button></div><p role="status" data-check-status>${busy?h(operation):checkedAt?'Geprüft am '+h(new Date(checkedAt).toLocaleString('de-DE')):loaded&&!people.length?'Noch keine Nutzer angelegt.':chosen.size?'Bereit zur Prüfung.':'Wähle mindestens einen Nutzer aus.'}</p><div class="checker-results">${checkedAt?people.filter(p=>chosen.has(p.id)).map(p=>{const rows=differences.filter(d=>d.profileId===p.id);return `<section class="checker-person"><h3>${h(p.name)} <span class="muted small">${rows.length} Unterschiede</span></h3>${rows.map(d=>`<label class="checker-difference"><input type="checkbox" data-check-diff="${h(d.id)}" ${selected.has(d.id)?'checked':''} ${busy?'disabled':''}><span><small class="muted">${d.subject==='english'?'🇺🇸 Englisch':'🇻🇦 Latein'} · ${h(d.resourceName)}</small><strong>${h(d.label)}</strong><span class="checker-before">Beim Nutzer: ${h(text(d.before))}</span><span class="checker-after">Bei dir: ${h(text(d.after))}</span></span></label>`).join('')||'<p class="muted">Alle Inhalte stimmen überein.</p>'}</section>`;}).join(''):''}</div>${checkedAt&&differences.length?`<div class="checker-footer"><p class="small muted" data-check-count>${selected.size} Änderungen ausgewählt</p><button class="button primary wide" data-action="check-apply" ${busy||!selected.size?'disabled':''}>Ausgewählte Unterschiede ändern</button><progress data-check-progress max="1" value="0" hidden></progress></div>`:''}`,'checks');
  }
  const status=message=>{if(!isVisible())return;const node=document.querySelector('[data-check-status]');if(node)node.textContent=message;};
  async function open(){
    if(busy){view(true);return;}busy=true;error='';operation='Nutzer werden geladen …';view(true);
    try{const result=await sync.request('profiles');people=(result.profiles||[]).sort((a,b)=>a.name.localeCompare(b.name,'de'));chosen=new Set([...chosen].filter(id=>people.some(p=>p.id===id)));differences=[];selected.clear();checkedAt=0;loaded=true;}
    catch(reason){error=String(reason.message||reason);}finally{busy=false;view();}
  }
  async function run(){
    if(busy)return;if(!chosen.size){status('Wähle mindestens einen Nutzer aus.');return;}
    busy=true;error='';operation='Aktuelle Inhalte werden abgeglichen und geprüft …';view();
    try{
      await prepare();const result=await sync.request('autoShareCheck',{profileIds:[...chosen]});
      differences=(result.differences||[]).filter(d=>['latin','english'].includes(d.subject||'latin'));checkedAt=result.checkedAt||Date.now();selected=new Set(differences.filter(d=>!excluded.has(identity(d))).map(d=>d.id));
    }catch(reason){error=String(reason.message||reason);}
    busy=false;view();
  }
  async function apply(){
    if(busy||!selected.size)return;
    const rows=differences.filter(d=>selected.has(d.id));
    excluded=new Set(differences.filter(d=>!selected.has(d.id)).map(identity));
    busy=true;error='';operation='Ausgewählte Änderungen werden übertragen …';view();let completed=0;
    const progress=isVisible()?document.querySelector('[data-check-progress]'):null;if(progress){progress.hidden=false;progress.max=rows.length;}
    try{
      // Parent containers are applied first, even across batch boundaries.
      rows.sort((a,b)=>(a.key==='deck'?0:1)-(b.key==='deck'?0:1));
      for(let i=0;i<rows.length;i+=200){
        const batch=rows.slice(i,i+200);
        await sync.request('autoShareApply',{profileIds:[...chosen],differenceIds:batch.map(d=>d.id),requestId:uid()});
        completed+=batch.length;if(progress?.isConnected)progress.value=completed;status(`Ändern · ${completed} / ${rows.length}`);
      }
      busy=false;await run();notify(`${completed} Inhaltsänderungen übernommen.`);
    }catch(reason){error=`${completed} von ${rows.length} geändert. ${String(reason.message||reason)}`;busy=false;view();}
  }
  function handle(button){
    const action=button.dataset.action;
    if(!['sharing-check','check-all-people','check-run','check-apply'].includes(action))return false;
    if(action==='sharing-check')void open();
    else if(action==='check-all-people'&&!busy){chosen=chosen.size===people.length?new Set():new Set(people.map(p=>p.id));checkedAt=0;differences=[];selected.clear();error='';view();}
    else if(action==='check-run')void run();
    else if(action==='check-apply')void apply();
    return true;
  }
  function change(event){
    const el=event.target;
    if(el.dataset.checkPerson){if(busy)return true;el.checked?chosen.add(el.dataset.checkPerson):chosen.delete(el.dataset.checkPerson);checkedAt=0;differences=[];selected.clear();error='';view();return true;}
    if(el.dataset.checkDiff){
      if(busy)return true;adjustDifferenceSelection(differences,selected,el.dataset.checkDiff,el.checked);
      document.querySelectorAll('[data-check-diff]').forEach(node=>node.checked=selected.has(node.dataset.checkDiff));
      const count=document.querySelector('[data-check-count]');if(count)count.textContent=selected.size+' Änderungen ausgewählt';
      const button=document.querySelector('[data-action="check-apply"]');if(button)button.disabled=!selected.size;
      return true;
    }
    return false;
  }
  return {handle,change,get busy(){return busy;}};
}
