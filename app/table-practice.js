import {CASES, NUMBERS, GENDERS, PERSONS, TARGETS, TABLES, PREFIXES, selectTableItems, checkAnswer} from './table-content.js';

const DIMENSIONS = {cases:{label:'Fälle',options:CASES},numbers:{label:'Singular / Plural',options:NUMBERS},genders:{label:'Geschlecht',options:GENDERS},persons:{label:'Person',options:PERSONS},targets:{label:'Was möchtest du üben?',options:TARGETS}};
const MAX_ANSWER = 300;
const own = (object,key) => Object.hasOwn(object,key);
const getTable = id => TABLES.find(table=>table.id===id);
const defaults = table => Object.fromEntries(table.dimensions.map(key=>[key,DIMENSIONS[key].options.map(option=>String(option.id))]));
const isRecord = value => value!==null && typeof value==='object' && !Array.isArray(value);

export function tablePracticeCard(){return '<section class="training-card table-practice-card"><div class="section-top"><span class="tag">LATEIN · FORMEN</span><span class="table-card-mark" aria-hidden="true">▦</span></div><h2>Tabellen üben</h2><p>Wähle deine Tabelle und genau die Fälle, die du lernen möchtest.</p><button class="button primary wide" data-action="tables-open">Tabellen abfragen <span aria-hidden="true">→</span></button><div class="card-foot">Adjektive · Pronomen · Perfektstämme</div></section>';}
export function prefixPracticeCard(){return '<section class="training-card table-practice-card"><div class="section-top"><span class="tag">LATEIN · WORTBAUSTEINE</span><span class="table-card-mark" aria-hidden="true">ab–</span></div><h2>Präfixe üben</h2><p>Links das Präfix, rechts deine Bedeutung. Kennst du alle elf?</p><button class="button primary wide" data-action="prefixes-open">Präfixe abfragen <span aria-hidden="true">→</span></button><div class="card-foot">11 Präfixe aus deinem Buch</div></section>';}

export function tablePracticeUI({profile,h,go,render,notify=()=>{},storage=globalThis.localStorage}){
 const cacheKey='latinio-tables-v1:'+profile.id;
 let storageError='';
 let state={version:1,kind:'tables',tableId:TABLES[0].id,filters:Object.fromEntries(TABLES.map(table=>[table.id,defaults(table)])),tableMode:'setup',tableRound:null,prefixRound:null};
 function cleanFilters(table,source){
  const result=defaults(table);
  if(!isRecord(source))return result;
  for(const key of table.dimensions){if(Array.isArray(source[key]))result[key]=result[key].filter(id=>source[key].includes(id));}
  return result;
 }
 function restoreRound(raw,prefix=false){
  if(!isRecord(raw)||!Array.isArray(raw.itemIds)||!isRecord(raw.answers))return null;
  const table=prefix?null:getTable(raw.tableId);
  if(!prefix&&!table)return null;
  const filters=prefix?null:cleanFilters(table,raw.filters);
  const allowed=prefix?PREFIXES:selectTableItems(table.id,filters);
  const ids=new Set(raw.itemIds.filter(id=>typeof id==='string'));
  const items=allowed.filter(item=>ids.has(item.id));
  if(!items.length)return null;
  return {tableId:table?.id||null,filters,itemIds:items.map(item=>item.id),answers:Object.fromEntries(items.map(item=>[item.id,typeof raw.answers[item.id]==='string'?raw.answers[item.id].slice(0,MAX_ANSWER):''])),checked:raw.checked===true};
 }
 try{
  const serialized=storage.getItem(cacheKey);
  const raw=serialized&&serialized.length<100000?JSON.parse(serialized):null;
  if(isRecord(raw)&&raw.version===1){
   if(getTable(raw.tableId))state.tableId=raw.tableId;
   if(raw.kind==='prefixes')state.kind='prefixes';
   for(const table of TABLES)state.filters[table.id]=cleanFilters(table,raw.filters?.[table.id]);
   state.tableRound=restoreRound(raw.tableRound);
   state.prefixRound=restoreRound(raw.prefixRound,true);
   state.tableMode=raw.tableMode==='worksheet'&&state.tableRound?'worksheet':'setup';
  }
 }catch{}
 function persist(){
  try{storage.setItem(cacheKey,JSON.stringify(state));storageError='';}
  catch{storageError='Deine Antworten konnten auf diesem Gerät nicht gespeichert werden. Lass diese Seite bitte geöffnet.';}
  const status=globalThis.document?.querySelector('[data-table-save]');
  if(status)status.textContent=saveMessage();
 }
 function saveMessage(){return storageError||'Dein Entwurf bleibt auf diesem Gerät gespeichert.';}
 function paint(focus=false){render();if(focus)globalThis.document?.querySelector('#table-result-heading')?.focus();}
 const currentRound=()=>state.kind==='prefixes'?state.prefixRound:state.tableRound;
 function roundItems(round,prefix=state.kind==='prefixes'){
  if(!round)return [];
  const items=prefix?PREFIXES:(getTable(round.tableId)?.items||[]);
  const ids=new Set(round.itemIds);
  return items.filter(item=>ids.has(item.id));
 }
 function makeRound(items,table=null,filters=null){return {tableId:table?.id||null,filters:filters?structuredClone(filters):null,itemIds:items.map(item=>item.id),answers:Object.fromEntries(items.map(item=>[item.id,''])),checked:false};}
 function filterView(table,key){
  const {label,options}=DIMENSIONS[key],selected=state.filters[table.id][key],all=options.every(option=>selected.includes(String(option.id)));
  return `<fieldset class="table-filter"><legend>${h(label)}</legend><div class="table-filter-tools"><button type="button" class="text-button" data-action="tables-filter-all" data-dimension="${h(key)}">${all?'Auswahl aufheben':'Alle wählen'}</button>${key==='cases'?'<button type="button" class="text-button" data-action="tables-case-basic">Nur Nominativ &amp; Akkusativ</button>':''}</div><div class="table-options">${options.map(option=>`<label class="table-option ${selected.includes(String(option.id))?'selected':''}"><input type="checkbox" data-table-filter="${h(key)}" value="${h(String(option.id))}" ${selected.includes(String(option.id))?'checked':''}><span>${h(option.label)}</span></label>`).join('')}</div></fieldset>`;
 }
 function setupView(){
  const table=getTable(state.tableId),items=selectTableItems(table.id,state.filters[table.id]);
  return `<section class="table-panel"><span class="tag">DEINE AUSWAHL</span><h2>Was möchtest du abfragen?</h2><label for="table-choice">Tabelle auswählen</label><select id="table-choice" data-table-choice>${TABLES.map(option=>`<option value="${h(option.id)}" ${option.id===table.id?'selected':''}>${h(option.label)}</option>`).join('')}</select><p class="muted table-description">${h(table.description)}</p>${table.dimensions.map(key=>filterView(table,key)).join('')}<div class="table-start"><p role="status">${items.length?`<strong>${items.length} Formen</strong> in dieser Runde`:'Wähle in jedem Bereich mindestens eine Möglichkeit.'}</p><button class="button primary" data-action="tables-start" ${items.length?'':'disabled'}>Abfrage starten →</button></div>${state.tableRound?`<button class="text-button wide" data-action="tables-resume">${state.tableRound.checked?'Letzte Auswertung ansehen':'Offene Tabelle fortsetzen'}</button>`:''}</section>`;
 }
 function answerCell(item,round,prefix=false){
  const answer=round.answers[item.id]||'',checked=round.checked,correct=checked&&checkAnswer(answer,item,{prefix});
  const fieldId='table-answer-'+item.id;
  const status=correct?'Richtig':answer.trim()?'Noch nicht richtig':'Nicht beantwortet';
  return `<div class="table-answer-cell ${checked?(correct?'is-correct':'is-wrong'):''}"><label class="table-sr-only" for="${h(fieldId)}">${h(item.prompt)}${prefix?' – deutsche Bedeutung':' – lateinische Form'}</label><input id="${h(fieldId)}" type="text" data-table-answer="${h(item.id)}" value="${h(answer)}" lang="${prefix?'de':'la'}" maxlength="${MAX_ANSWER}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="${prefix?'Bedeutung …':'Form …'}" ${checked?`readonly aria-describedby="${h(fieldId)}-feedback"`:''}>${checked?`<div id="${h(fieldId)}-feedback" class="table-cell-feedback"><strong>${correct?'✓':'○'} ${status}</strong><span>${correct?'Lösung':'Richtig ist'}: <span lang="${prefix?'de':'la'}">${h(item.answer)}</span></span></div>`:''}</div>`;
 }
 function formGrid(round,items){
  const table=getTable(round.tableId);
  if(!table.dimensions.includes('cases'))return `<div class="table-list"><div class="table-list-heading"><span>Gesuchte Form</span><span>Deine Antwort</span></div>${items.map(item=>`<div class="table-list-row"><label for="table-answer-${h(item.id)}">${h(item.prompt)}</label>${answerCell(item,round)}</div>`).join('')}</div>`;
  const personTable=table.dimensions.includes('persons'),columns=personTable?PERSONS:GENDERS,key=personTable?'person':'gender';
  return NUMBERS.filter(number=>items.some(item=>item.number===number.id)).map(number=>{
   const shownColumns=columns.filter(column=>items.some(item=>item.number===number.id&&String(item[key])===String(column.id)));
   return `<section class="table-number-group"><h3>${h(number.label)}</h3><div class="table-scroll" role="region" aria-label="${h(number.label)} – Formen" tabindex="0"><table class="table-matrix" style="--table-columns:${shownColumns.length}"><caption class="table-sr-only">${h(table.label)} · ${h(number.label)}</caption><thead><tr><th scope="col">Fall</th>${shownColumns.map(column=>`<th scope="col">${h(column.label)}</th>`).join('')}</tr></thead><tbody>${CASES.filter(caseItem=>items.some(item=>item.number===number.id&&item.case===caseItem.id)).map(caseItem=>`<tr><th scope="row">${h(caseItem.label)}</th>${shownColumns.map(column=>{const item=items.find(item=>item.number===number.id&&item.case===caseItem.id&&String(item[key])===String(column.id));return `<td>${item?answerCell(item,round):'<span class="muted" aria-label="Nicht Teil dieser Runde">—</span>'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }).join('');
 }
 function worksheetView(prefix=false){
  const round=prefix?state.prefixRound:state.tableRound;
  if(!round)return prefix?'':setupView();
  const items=roundItems(round,prefix),checked=round.checked;
  const correct=checked?items.filter(item=>checkAnswer(round.answers[item.id],item,{prefix})).length:0;
  const title=prefix?'Präfixe und ihre Bedeutung':getTable(round.tableId).label;
  const explanation=prefix?'Schreibe rechts die deutsche Bedeutung. Eine richtige Bedeutung pro Präfix genügt; mehrere Bedeutungen kannst du mit Komma trennen.':'Trage die lateinischen Formen ein. Längenzeichen und Trennstriche sind freiwillig. Bei mehreren Formen in einem Feld genügt eine passende Variante.';
  const fields=prefix?`<div class="table-list table-prefix-list"><div class="table-list-heading"><span>Präfix</span><span>Deine Bedeutung</span></div>${items.map(item=>`<div class="table-list-row"><label for="table-answer-${h(item.id)}" lang="la">${h(item.prompt)}</label>${answerCell(item,round,true)}</div>`).join('')}</div>`:formGrid(round,items);
  return `<section class="table-panel ${checked?'table-results':''}"><div class="section-top"><span class="tag">${checked?'DEINE AUSWERTUNG':prefix?'PRÄFIXE':'DEINE TABELLE'}</span><span class="small muted">${items.length} ${prefix?'Präfixe':'Formen'}</span></div><h2 ${checked?'id="table-result-heading" tabindex="-1"':''}>${checked?`${correct} von ${items.length} richtig`:h(title)}</h2>${checked?`<p class="muted">${h(title)} · ${correct===items.length?'Alles richtig!':'Die Lösungen stehen direkt bei deinen Antworten.'}</p>`:`<p class="muted">${h(explanation)}</p>`}<form id="table-practice-form">${fields}${checked?`<div class="table-actions">${correct<items.length?'<button type="button" class="button primary" data-action="tables-repeat-wrong">Nur Fehler wiederholen</button>':''}<button type="button" class="button ${correct===items.length?'primary':'secondary'}" data-action="tables-repeat">Diese Runde erneut üben</button></div>`:`<button class="button primary wide" type="submit">${items.length} Antworten kontrollieren</button>`}</form><div class="table-actions">${prefix?'<button class="text-button" data-action="prefixes-new">Alle Präfixe neu üben</button>':'<button class="text-button" data-action="tables-config">Tabelle &amp; Auswahl ändern</button>'}</div></section>`;
 }
 function view(){
  const prefix=state.kind==='prefixes';
  if(prefix&&!state.prefixRound){state.prefixRound=makeRound(PREFIXES);persist();}
  return `<div class="table-practice-shell"><div class="page-heading"><div><div class="eyebrow">DEIN LATEINTRAINING</div><h1>${prefix?'Präfixe üben':'Tabellen üben'}</h1><p class="muted">${prefix?'Kleine Wortbausteine, große Hilfe beim Übersetzen.':'Deine Buchtabellen – so viel oder so wenig, wie du gerade brauchst.'}</p></div></div><div class="table-mode-tabs" aria-label="Übung auswählen"><button class="chip ${!prefix?'selected':''}" aria-pressed="${!prefix}" data-action="tables-open">Tabellen</button><button class="chip ${prefix?'selected':''}" aria-pressed="${prefix}" data-action="prefixes-open">Präfixe</button></div>${prefix?worksheetView(true):state.tableMode==='worksheet'?worksheetView():setupView()}<p class="small muted table-save" data-table-save role="status">${h(saveMessage())}</p></div>`;
 }
 function handle(button){
  const action=button?.dataset?.action;
  if(!action?.startsWith('tables-')&&!action?.startsWith('prefixes-'))return false;
  if(action==='tables-open'||action==='prefixes-open'){
   state.kind=action==='prefixes-open'?'prefixes':'tables';
   if(state.kind==='prefixes'&&!state.prefixRound)state.prefixRound=makeRound(PREFIXES);
   persist();go();paint();return true;
  }
  const table=getTable(state.tableId);
  if(action==='tables-config'){state.kind='tables';state.tableMode='setup';}
  else if(action==='tables-resume'&&state.tableRound){state.kind='tables';state.tableMode='worksheet';}
  else if(action==='tables-filter-all'){
   const key=button.dataset.dimension;
   if(!table.dimensions.includes(key))return true;
   const all=DIMENSIONS[key].options.map(option=>String(option.id)),selected=state.filters[table.id][key];
   state.filters[table.id][key]=all.every(id=>selected.includes(id))?[]:all;
  }
  else if(action==='tables-case-basic'&&table.dimensions.includes('cases'))state.filters[table.id].cases=['nom','acc'];
  else if(action==='tables-start'){
   const filters=state.filters[table.id],items=selectTableItems(table.id,filters);
   if(!items.length){notify('Wähle in jedem Bereich mindestens eine Möglichkeit.');return true;}
   state.tableRound=makeRound(items,table,filters);state.kind='tables';state.tableMode='worksheet';
  }
  else if(action==='prefixes-new'){state.prefixRound=makeRound(PREFIXES);state.kind='prefixes';}
  else if(action==='tables-repeat'||action==='tables-repeat-wrong'){
   const round=currentRound();if(!round)return true;
   const prefix=state.kind==='prefixes';
   let items=roundItems(round,prefix);
   if(action==='tables-repeat-wrong'){
    if(!round.checked)return true;
    items=items.filter(item=>!checkAnswer(round.answers[item.id],item,{prefix}));
   }
   if(!items.length)return true;
   const next=makeRound(items,prefix?null:getTable(round.tableId),round.filters);
   if(prefix)state.prefixRound=next;else state.tableRound=next;
  }
  else return true;
  persist();paint();return true;
 }
 function input(element){
  const id=element?.dataset?.tableAnswer;
  if(typeof id!=='string')return false;
  const round=currentRound();
  if(!round||round.checked||!own(round.answers,id))return true;
  round.answers[id]=String(element.value||'').slice(0,MAX_ANSWER);persist();return true;
 }
 function change(element){
  if(own(element?.dataset||{},'tableChoice')){
   if(getTable(element.value)){state.tableId=element.value;persist();paint();globalThis.document?.querySelector('#table-choice')?.focus();}
   return true;
  }
  const key=element?.dataset?.tableFilter;
  if(typeof key!=='string')return false;
  const table=getTable(state.tableId);
  if(!table.dimensions.includes(key)||!DIMENSIONS[key].options.some(option=>String(option.id)===element.value))return true;
  const selected=new Set(state.filters[table.id][key]);
  if(element.checked)selected.add(element.value);else selected.delete(element.value);
  state.filters[table.id][key]=DIMENSIONS[key].options.map(option=>String(option.id)).filter(id=>selected.has(id));
  persist();paint();
  globalThis.document?.querySelector(`[data-table-filter="${key}"][value="${element.value}"]`)?.focus();
  return true;
 }
 function submit(form){
  if(form.id!=='table-practice-form')return false;
  const round=currentRound();if(!round||round.checked)return true;
  for(const field of form.querySelectorAll?.('[data-table-answer]')||[])input(field);
  round.checked=true;persist();paint(true);return true;
 }
 return {view,handle,input,change,submit,get draft(){return structuredClone(state);}};
}
