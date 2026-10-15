import {uid} from './core.js';

export function adjustDifferenceSelection(differences,selected,id,checked){
  const item=differences.find(d=>d.id===id);if(!item)return;
  checked?selected.add(id):selected.delete(id);
  if(checked&&item.parentMissing&&item.key!=='deck'){
    const parent=differences.find(d=>d.resourceId===item.resourceId&&d.key==='deck');if(parent)selected.add(parent.id);
  }
  if(!checked&&item.key==='deck'&&item.parentMissing)differences.filter(d=>d.resourceId===item.resourceId).forEach(d=>selected.delete(d.id));
}

export function sharingCheck({sync,h,showAdmin,prepare,notify}){
  let people=[],chosen=new Set(),differences=[],selected=new Set(),checkedAt=0,busy=false,excluded=new Set();
  const identity=d=>d.resourceId+':'+d.key;
  const text=value=>value===null?'Nicht vorhanden':value.latin?`${value.latin} · ${value.meanings.map(g=>g.join(' / ')).join(' · ')}${value.forms?.length?' · Formen: '+value.forms.join(', '):''}`:value.grundform?`${value.grundform} · ${value.praedikate.join(' / ')}`:value.name||JSON.stringify(value);
  function view(){
    showAdmin(`<div class="section-top"><h2>Freigabe-Prüfer</h2><button class="text-button" data-action="share-panel">← Freigaben</button></div><p class="muted">Vergleicht die aktuellen Pi-Daten deiner Lektionen und Perfekt-Sammlungen mit den ausgewählten Nutzern. Lernstände werden nicht verändert.</p><div class="checker-people">${people.map(p=>`<label class="collection-check"><input type="checkbox" data-check-person="${h(p.id)}" ${chosen.has(p.id)?'checked':''} ${busy?'disabled':''}><span>${h(p.name)}</span></label>`).join('')}</div><div class="button-row"><button class="text-button" data-action="check-all-people" ${busy?'disabled':''}>Alle Nutzer</button><button class="button primary" data-action="check-run" ${busy?'disabled':''}>Jetzt prüfen</button></div><p role="status" data-check-status>${busy?'Pi-Daten werden geprüft …':checkedAt?'Geprüft am '+h(new Date(checkedAt).toLocaleString('de-DE')):''}</p><div class="checker-results">${checkedAt?people.filter(p=>chosen.has(p.id)).map(p=>{const rows=differences.filter(d=>d.profileId===p.id);return `<section class="checker-person"><h3>${h(p.name)} <span class="muted small">${rows.length} Unterschiede</span></h3>${rows.map(d=>`<label class="checker-difference"><input type="checkbox" data-check-diff="${h(d.id)}" ${selected.has(d.id)?'checked':''} ${busy?'disabled':''}><span><small class="muted">${d.subject==='french'?'🇫🇷 Französisch':d.subject==='english'?'🇺🇸 Englisch':'🇻🇦 Latein'} · ${h(d.resourceName)}</small><strong>${h(d.label)}</strong><span class="checker-before">Beim Nutzer: ${h(text(d.before))}</span><span class="checker-after">Bei dir: ${h(text(d.after))}</span></span></label>`).join('')||'<p class="muted">Alle Inhalte stimmen überein.</p>'}</section>`;}).join(''):''}</div>${checkedAt&&differences.length?`<div class="checker-footer"><p class="small muted" data-check-count>${selected.size} Änderungen ausgewählt</p><button class="button primary wide" data-action="check-apply" ${busy||!selected.size?'disabled':''}>Ausgewählte Unterschiede ändern</button><progress data-check-progress max="1" value="0" hidden></progress></div>`:''}`,'shares');
  }
  const status=message=>{const node=document.querySelector('[data-check-status]');if(node)node.textContent=message;};
  async function open(){
    busy=true;view();
    try{const result=await sync.request('profiles');people=result.profiles.sort((a,b)=>a.name.localeCompare(b.name,'de'));chosen=new Set();differences=[];checkedAt=0;}
    catch(error){notify(error.message);}finally{busy=false;view();}
  }
  async function run(){
    if(busy)return;if(!chosen.size){status('Wähle mindestens einen Nutzer aus.');return;}
    busy=true;view();
    try{
      await prepare();const result=await sync.request('autoShareCheck',{profileIds:[...chosen]});
      differences=result.differences;checkedAt=result.checkedAt;selected=new Set(differences.filter(d=>!excluded.has(identity(d))).map(d=>d.id));
    }catch(error){status(error.message);busy=false;document.querySelectorAll('[data-action="check-run"],[data-check-person]').forEach(el=>el.disabled=false);return;}
    busy=false;view();
  }
  async function apply(){
    if(busy||!selected.size)return;
    const rows=differences.filter(d=>selected.has(d.id));
    excluded=new Set(differences.filter(d=>!selected.has(d.id)).map(identity));
    busy=true;view();let completed=0;
    const progress=document.querySelector('[data-check-progress]');if(progress){progress.hidden=false;progress.max=rows.length;}
    try{
      // Parent containers are applied first, even across batch boundaries.
      rows.sort((a,b)=>(a.key==='deck'?0:1)-(b.key==='deck'?0:1));
      for(let i=0;i<rows.length;i+=200){
        const batch=rows.slice(i,i+200);
        await sync.request('autoShareApply',{profileIds:[...chosen],differenceIds:batch.map(d=>d.id),requestId:uid()});
        completed+=batch.length;if(progress)progress.value=completed;status(`Ändern · ${completed} / ${rows.length}`);
      }
      busy=false;await run();notify(`${completed} Inhaltsänderungen übernommen.`);
    }catch(error){busy=false;view();status(`${completed} von ${rows.length} geändert. ${error.message}`);}
  }
  async function handle(button){
    const action=button.dataset.action;
    if(!['sharing-check','check-all-people','check-run','check-apply'].includes(action))return false;
    if(action==='sharing-check')await open();
    else if(action==='check-all-people'&&!busy){chosen=new Set(people.map(p=>p.id));checkedAt=0;view();}
    else if(action==='check-run')await run();
    else if(action==='check-apply')await apply();
    return true;
  }
  function change(event){
    const el=event.target;
    if(el.dataset.checkPerson){if(busy)return true;el.checked?chosen.add(el.dataset.checkPerson):chosen.delete(el.dataset.checkPerson);checkedAt=0;differences=[];view();return true;}
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
