import {CASES, NUMBERS, GENDERS, PERSONS, TARGETS, DECLENSIONS, TABLES, PREFIXES, selectTableItems, checkAnswer} from './table-content.js';
import {createLearning, learningStep, learningResult, learningAnswer, learningPlace, learningCheck, learningNext, restoreLearning} from './table-learning.js';

const DIMENSIONS={cases:{label:'Welche Fälle?',options:CASES},numbers:{label:'Singular / Plural',options:NUMBERS},genders:{label:'Welches Geschlecht?',options:GENDERS},persons:{label:'Welche Person?',options:PERSONS},targets:{label:'Welche Formen?',options:TARGETS},declensions:{label:'Welche Deklinationen?',options:DECLENSIONS}};
const MAX_ANSWER=300;
const formCount=(count,prefix=false)=>`${count} ${prefix?(count===1?'Präfix':'Präfixe'):(count===1?'Form':'Formen')}`;
const own=(object,key)=>Object.hasOwn(object,key);
const getTable=id=>TABLES.find(table=>table.id===id);
const defaults=table=>Object.fromEntries(table.dimensions.map(key=>[key,DIMENSIONS[key].options.map(option=>String(option.id))]));
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const CATALOG_TITLES={adjectives:'Adjektive der a- und o-Deklination',personal:'Personalpronomen',relative:'Relativpronomen',is:'Demonstrativpronomen',perfect:'Dehnungsperfekt',nouns:'Substantiv-Deklinationen'};

export function tablePracticeCard(){return '<section class="training-card table-practice-card"><div class="section-top"><span class="tag">LATEIN · FORMEN</span><span class="table-card-mark" aria-hidden="true">▦</span></div><h2>Tabellen üben</h2><p>Wähle deine Tabelle. Lerne Schritt für Schritt oder frage dich direkt ab.</p><button class="button primary wide" data-action="tables-open">Tabellen auswählen <span aria-hidden="true">→</span></button><div class="card-foot">Substantive · Adjektive · Pronomen · Perfektstämme</div></section>';}
export function prefixPracticeCard(){return '<section class="training-card table-practice-card"><div class="section-top"><span class="tag">LATEIN · WORTBAUSTEINE</span><span class="table-card-mark" aria-hidden="true">ab–</span></div><h2>Präfixe üben</h2><p>Erst zuordnen, dann selbst schreiben. Lerne die elf Präfixe aus deinem Buch.</p><button class="button primary wide" data-action="prefixes-open">Präfixe auswählen <span aria-hidden="true">→</span></button><div class="card-foot">Schrittweise üben · direkt abfragen</div></section>';}

export function tablePracticeUI({profile,h,go,render,showModal=()=>{},closeModal=()=>{},notify=()=>{},storage=globalThis.localStorage}){
 const cacheKey='latinio-tables-v1:'+profile.id;
 let storageError='',selectedToken=null,dragToken=null,pointer=null,ghost=null,scrollFrame=null,suppressClickUntil=0;
 let state={version:2,kind:'tables',tableId:TABLES[0].id,filters:Object.fromEntries(TABLES.map(table=>[table.id,defaults(table)])),tableMode:'catalog',prefixMode:'setup',tableRound:null,prefixRound:null,tableLearning:null,prefixLearning:null};
 function cleanFilters(table,source){const result=defaults(table);if(!isRecord(source))return result;for(const key of table.dimensions)if(Array.isArray(source[key]))result[key]=result[key].filter(id=>source[key].includes(id));return result;}
 function restoreRound(raw,prefix=false){
  if(!isRecord(raw)||!Array.isArray(raw.itemIds)||!isRecord(raw.answers))return null;
  const table=prefix?null:getTable(raw.tableId);if(!prefix&&!table)return null;
  const filters=prefix?null:cleanFilters(table,raw.filters),allowed=prefix?PREFIXES:selectTableItems(table.id,filters),ids=new Set(raw.itemIds.filter(id=>typeof id==='string')),items=allowed.filter(item=>ids.has(item.id));
  if(!items.length)return null;
  return {tableId:table?.id||null,filters,itemIds:items.map(item=>item.id),answers:Object.fromEntries(items.map(item=>[item.id,typeof raw.answers[item.id]==='string'?raw.answers[item.id].slice(0,MAX_ANSWER):''])),checked:raw.checked===true};
 }
 function restoreCourse(raw,prefix=false){
  if(!isRecord(raw))return null;const table=prefix?null:getTable(raw.tableId);if(!prefix&&!table)return null;
  const filters=prefix?null:cleanFilters(table,raw.filters),items=prefix?PREFIXES:selectTableItems(table.id,filters);
  if(!items.length)return null;const session=restoreLearning(raw.session,items,{prefix});
  return session?{tableId:table?.id||null,filters,session}:null;
 }
 try{
  const serialized=storage.getItem(cacheKey),raw=serialized&&serialized.length<100000?JSON.parse(serialized):null;
  if(isRecord(raw)&&[1,2].includes(raw.version)){
   if(getTable(raw.tableId))state.tableId=raw.tableId;if(raw.kind==='prefixes')state.kind='prefixes';
   for(const table of TABLES)state.filters[table.id]=cleanFilters(table,raw.filters?.[table.id]);
   state.tableRound=restoreRound(raw.tableRound);state.prefixRound=restoreRound(raw.prefixRound,true);
   state.tableLearning=restoreCourse(raw.tableLearning);state.prefixLearning=restoreCourse(raw.prefixLearning,true);
   if(raw.tableMode==='worksheet'&&state.tableRound)state.tableMode='worksheet';
   else if(raw.tableMode==='learning'&&state.tableLearning)state.tableMode='learning';
   else if(raw.tableMode==='setup')state.tableMode='setup';
   if(raw.prefixMode==='learning'&&state.prefixLearning)state.prefixMode='learning';
   else if((raw.prefixMode==='worksheet'||raw.version===1)&&state.prefixRound)state.prefixMode='worksheet';
  }
 }catch{}
 function persist(){
  try{storage.setItem(cacheKey,JSON.stringify(state));storageError='';}catch{storageError='Deine Antworten konnten auf diesem Gerät nicht gespeichert werden. Lass diese Seite bitte geöffnet.';}
  const status=globalThis.document?.querySelector('[data-table-save]');if(status)status.textContent=saveMessage();
 }
 function saveMessage(){return storageError||'Dein Entwurf bleibt auf diesem Gerät gespeichert.';}
 function paint(focus=false){render();if(focus)globalThis.document?.querySelector('#table-result-heading, #table-step-heading')?.focus();}
 const isPrefix=()=>state.kind==='prefixes';
 const currentMode=()=>isPrefix()?state.prefixMode:state.tableMode;
 const currentRound=()=>isPrefix()?state.prefixRound:state.tableRound;
 const currentCourse=()=>isPrefix()?state.prefixLearning:state.tableLearning;
 function roundItems(round,prefix=isPrefix()){if(!round)return [];const ids=new Set(round.itemIds);return (prefix?PREFIXES:(getTable(round.tableId)?.items||[])).filter(item=>ids.has(item.id));}
 function courseItems(course=currentCourse()){return course?roundItems({tableId:course.tableId,itemIds:course.session.itemIds}):[];}
 function makeRound(items,table=null,filters=null){return {tableId:table?.id||null,filters:filters?structuredClone(filters):null,itemIds:items.map(item=>item.id),answers:Object.fromEntries(items.map(item=>[item.id,''])),checked:false};}
 function catalogView(){return `<section aria-labelledby="table-step-heading"><h2 id="table-step-heading" tabindex="-1">Welche Tabelle möchtest du lernen?</h2><p class="muted">Wähle eine Tabelle. Danach bestimmst du die Formen und deinen Lernmodus.</p><div class="table-catalog">${TABLES.map(table=>`<button class="table-choice-card" data-action="tables-select" data-table-id="${h(table.id)}"><span class="table-choice-copy"><strong>${h(CATALOG_TITLES[table.id]||table.label)}</strong><span>${table.items.length} Formen · ${table.dimensions.includes('cases')?'5 Fälle':'3 Verben'}</span></span><span class="table-choice-arrow" aria-hidden="true">→</span></button>`).join('')}</div></section>`;}
 function filterView(table,key,primary=false){
  const {label,options}=DIMENSIONS[key],selected=state.filters[table.id][key],all=options.every(option=>selected.includes(String(option.id)));
  return `<fieldset class="table-filter ${primary?'table-filter-primary':''}" data-table-filter-group="${h(key)}"><legend>${h(label)}</legend><div class="table-filter-tools"><button type="button" class="text-button" data-action="tables-filter-all" data-dimension="${h(key)}">${all?'Auswahl aufheben':'Alle wählen'}</button>${key==='cases'?'<button type="button" class="text-button" data-action="tables-case-basic">Nur Nominativ &amp; Akkusativ</button>':''}</div><div class="table-options">${options.map(option=>`<label class="table-option ${selected.includes(String(option.id))?'selected':''}"><input type="checkbox" data-table-filter="${h(key)}" value="${h(String(option.id))}" ${selected.includes(String(option.id))?'checked':''}><span>${h(option.label)}</span></label>`).join('')}</div></fieldset>`;
 }
 function modeChoices(prefix=false,enabled=true){return `<div class="table-mode-choices" aria-label="Lernmodus wählen"><button class="table-mode-card" data-action="${prefix?'prefixes':'tables'}-learn" ${enabled?'':'disabled'}><span class="tag">SCHRITT FÜR SCHRITT</span><strong>Üben</strong><span>Anschauen → zuordnen → Lücken ergänzen → alles selbst schreiben</span></button><button class="table-mode-card" data-action="${prefix?'prefixes':'tables'}-start" ${enabled?'':'disabled'}><span class="tag">WISSEN PRÜFEN</span><strong>Abfragen</strong><span>Alle Antworten direkt selbst eintragen und gemeinsam kontrollieren</span></button></div>`;}
 function selectionText(table){const count=selectTableItems(table.id,state.filters[table.id]).length;return count?`${formCount(count)} ausgewählt`:'Wähle in jedem Bereich mindestens eine Möglichkeit.';}
 function secondaryDimensions(table){return table.dimensions.filter(key=>!['cases','targets'].includes(key));}
 function settingsText(table){return secondaryDimensions(table).some(key=>state.filters[table.id][key].length!==DIMENSIONS[key].options.length)?'Auswahl angepasst':'Singular und Plural sowie alle weiteren Formen';}
 function refreshSelection(){
  // Keep the existing inputs and scroll containers attached when a selection changes.
  const table=getTable(state.tableId),doc=globalThis.document;
  for(const field of doc?.querySelectorAll?.('[data-table-filter]')||[]){
   const key=field.dataset.tableFilter;if(!table.dimensions.includes(key))continue;
   field.checked=state.filters[table.id][key].includes(field.value);
   field.closest?.('.table-option')?.classList.toggle('selected',field.checked);
  }
  for(const button of doc?.querySelectorAll?.('[data-action="tables-filter-all"]')||[]){
   const key=button.dataset.dimension;if(!table.dimensions.includes(key))continue;
   button.textContent=DIMENSIONS[key].options.every(option=>state.filters[table.id][key].includes(String(option.id)))?'Auswahl aufheben':'Alle wählen';
  }
  for(const label of doc?.querySelectorAll?.('[data-table-selection-count]')||[])label.textContent=selectionText(table);
  for(const label of doc?.querySelectorAll?.('[data-table-settings-note]')||[])label.textContent=settingsText(table);
  for(const button of doc?.querySelectorAll?.('[data-action="tables-choose-mode"]')||[])button.disabled=!selectTableItems(table.id,state.filters[table.id]).length;
 }
 function settingsDialog(){
  const table=getTable(state.tableId),dimensions=secondaryDimensions(table);if(!dimensions.length)return;
  showModal(`<div class="table-settings-dialog"><h2 id="modal-title">Weitere Einstellungen</h2><p class="muted">${h(table.label)} · Wähle hier bei Bedarf nur bestimmte Formen.</p>${dimensions.map(key=>filterView(table,key)).join('')}<p class="small muted" data-table-selection-count role="status">${h(selectionText(table))}</p><button class="button primary wide" data-action="tables-modal-done">Fertig</button></div>`);
 }
 function modeDialog(prefix=false){
  const table=prefix?null:getTable(state.tableId),items=prefix?PREFIXES:selectTableItems(table.id,state.filters[table.id]);
  if(!items.length){notify('Wähle in jedem Bereich mindestens eine Möglichkeit.');return;}
  showModal(`<div class="table-mode-dialog"><h2 id="modal-title">Wie möchtest du lernen?</h2><p class="muted">${h(prefix?'Präfixe':table.label)} · ${formCount(items.length,prefix)}</p>${modeChoices(prefix)}</div>`);
 }
 function setupView(prefix=false){
  if(prefix)return `<section class="table-panel"><span class="tag">11 PRÄFIXE</span><h2 id="table-step-heading" tabindex="-1">Präfixe und ihre Bedeutung</h2><p class="muted">Die Präfixe stehen links, ihre Bedeutungen rechts. Wähle im nächsten Schritt, ob du mit Hilfe üben oder dich direkt abfragen möchtest.</p><div class="table-setup-actions"><button class="button primary wide" data-action="prefixes-choose-mode">Weiter →</button></div></section>`;
  const table=getTable(state.tableId),items=selectTableItems(table.id,state.filters[table.id]),primary=table.dimensions.includes('cases')?'cases':'targets';
  return `<section class="table-panel"><button class="text-button" data-action="tables-catalog">← Alle Tabellen</button><h2 id="table-step-heading" tabindex="-1">${h(table.label)}</h2><p class="muted table-description">${h(table.description)}</p>${filterView(table,primary,true)}${secondaryDimensions(table).length?`<button class="table-settings-button" data-action="tables-settings" aria-haspopup="dialog"><span><strong>Weitere Einstellungen</strong><small data-table-settings-note>${h(settingsText(table))}</small></span><span aria-hidden="true">→</span></button>`:''}<div class="table-setup-actions"><p data-table-selection-count role="status">${h(selectionText(table))}</p><button class="button primary wide" data-action="tables-choose-mode" aria-haspopup="dialog" ${items.length?'':'disabled'}>Weiter →</button></div></section>`;
 }
 function answerCell(item,round,prefix=false){
  const answer=round.answers[item.id]||'',checked=round.checked,correct=checked&&checkAnswer(answer,item,{prefix}),fieldId='table-answer-'+item.id,status=correct?'Richtig':answer.trim()?'Noch nicht richtig':'Nicht beantwortet';
  return `<div class="table-answer-cell ${checked?(correct?'is-correct':'is-wrong'):''}"><label class="table-sr-only" for="${h(fieldId)}">${h(item.prompt)}${prefix?' – deutsche Bedeutung':' – lateinische Form'}</label><input id="${h(fieldId)}" type="text" data-table-answer="${h(item.id)}" value="${h(answer)}" lang="${prefix?'de':'la'}" maxlength="${MAX_ANSWER}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="${prefix?'Bedeutung …':'Form …'}" ${checked?`readonly aria-describedby="${h(fieldId)}-feedback"`:''}>${checked?`<div id="${h(fieldId)}-feedback" class="table-cell-feedback"><strong>${correct?'✓':'○'} ${status}</strong><span>${correct?'Lösung':'Richtig ist'}: <span lang="${prefix?'de':'la'}">${h(item.answer)}</span></span></div>`:''}</div>`;
 }
 function formGrid(round,items,cell=item=>answerCell(item,round),prefix=false){
  const table=prefix?null:getTable(round.tableId);
  if(prefix||!table.dimensions.includes('cases'))return `<div class="table-list ${prefix?'table-prefix-list':''}"><div class="table-list-heading"><span>${prefix?'Präfix':'Gesuchte Form'}</span><span>${prefix?'Bedeutung':'Lateinische Form'}</span></div>${items.map(item=>`<div class="table-list-row"><span>${h(item.prompt)}</span>${cell(item)}</div>`).join('')}</div>`;
  const [key,columns]=table.dimensions.includes('declensions')?['declension',DECLENSIONS]:table.dimensions.includes('persons')?['person',PERSONS]:['gender',GENDERS];
  return NUMBERS.filter(number=>items.some(item=>item.number===number.id)).map(number=>{
   const shownColumns=columns.filter(column=>items.some(item=>item.number===number.id&&String(item[key])===String(column.id)));
   return `<section class="table-number-group"><h3>${h(number.label)}</h3>${shownColumns.length>1?'<p class="table-scroll-hint">Bei Bedarf seitlich wischen für weitere Spalten <span aria-hidden="true">↔</span></p>':''}<div class="table-scroll" role="region" aria-label="${h(number.label)} – Formen${shownColumns.length>1?', bei Bedarf seitlich scrollbar':''}" tabindex="0"><table class="table-matrix" style="--table-columns:${shownColumns.length}"><caption class="table-sr-only">${h(table.label)} · ${h(number.label)}</caption><thead><tr><th scope="col">Fall</th>${shownColumns.map(column=>`<th scope="col">${h(column.label)}${column.example?`<small class="table-column-example" lang="la">${h(column.example)}</small>`:''}</th>`).join('')}</tr></thead><tbody>${CASES.filter(caseItem=>items.some(item=>item.number===number.id&&item.case===caseItem.id)).map(caseItem=>`<tr><th scope="row">${h(caseItem.label)}</th>${shownColumns.map(column=>{const item=items.find(item=>item.number===number.id&&item.case===caseItem.id&&String(item[key])===String(column.id));return `<td>${item?cell(item):'<span class="muted" aria-label="Nicht Teil dieser Runde">—</span>'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }).join('');
 }
 function worksheetView(prefix=false){
  const round=prefix?state.prefixRound:state.tableRound;if(!round)return setupView(prefix);
  const items=roundItems(round,prefix),checked=round.checked,correct=checked?items.filter(item=>checkAnswer(round.answers[item.id],item,{prefix})).length:0,title=prefix?'Präfixe und ihre Bedeutung':getTable(round.tableId).label;
  const explanation=prefix?'Schreibe rechts die deutsche Bedeutung. Eine richtige Bedeutung pro Präfix genügt; mehrere Bedeutungen kannst du mit Komma trennen.':'Trage die lateinischen Formen ein. Längenzeichen und Trennstriche sind freiwillig. Bei mehreren Formen genügt eine passende Variante.';
  return `<section class="table-panel ${checked?'table-results':''}"><span class="tag">${checked?'DEINE AUSWERTUNG':'ABFRAGEN'}</span><h2 id="table-result-heading" tabindex="-1">${checked?`${correct} von ${items.length} richtig`:h(title)}</h2><p class="muted">${checked?(correct===items.length?'Alles richtig!':'Die Lösungen stehen direkt bei deinen Antworten.'):h(explanation)}</p><form id="table-practice-form">${formGrid(round,items,item=>answerCell(item,round,prefix),prefix)}${checked?`<div class="table-actions">${correct<items.length?'<button type="button" class="button primary" data-action="tables-repeat-wrong">Nur Fehler wiederholen</button>':''}<button type="button" class="button secondary" data-action="tables-repeat">Abfrage wiederholen</button></div>`:`<button class="button primary wide" type="submit">${items.length} ${items.length===1?'Antwort':'Antworten'} kontrollieren</button>`}</form><div class="table-actions"><button class="text-button" data-action="${prefix?'prefixes-config':'tables-config'}">Auswahl &amp; Lernmodus ändern</button></div></section>`;
 }
 function caseList(ids){
  const labels=ids.map(id=>CASES.find(item=>item.id===id)?.label).filter(Boolean);
  return labels.length>1?labels.slice(0,-1).join(', ')+' und '+labels.at(-1):labels[0]||'';
 }
 function learningCaseNote(step){
  if(!step.caseIds?.length)return '';
  const added=step.newCaseIds||[],previous=step.caseIds.filter(id=>!added.includes(id));
  let text;
  if(step.kind==='write')text='Alle ausgewählten Fälle: '+caseList(step.caseIds)+'.';
  else if(step.batchTotal>1&&previous.length&&added.length)text='Neu: '+caseList(added)+'. '+caseList(previous)+' übst du weiter mit.';
  else if(step.batchTotal>1&&added.length)text='Du startest mit '+caseList(step.caseIds)+'.';
  else text='In dieser Runde: '+caseList(step.caseIds)+'.';
  return `<p class="table-learning-cases">${h(text)}</p>`;
 }
 function learningView(){
  const prefix=isPrefix(),course=currentCourse();if(!course)return setupView(prefix);
  const session=course.session,step=learningStep(session),allItems=courseItems(course),activeIds=new Set(step.itemIds),items=allItems.filter(item=>activeIds.has(item.id)),result=learningResult(session,allItems),title=prefix?'Präfixe und ihre Bedeutung':getTable(course.tableId).label;
  if(step.kind==='done')return `<section class="table-panel table-learning-complete"><span class="tag">GESCHAFFT</span><h2 id="table-step-heading" tabindex="-1">Du hast alles selbst ausgefüllt!</h2><p>${h(title)} · ${formCount(items.length,prefix)}</p><p class="muted">Vom Anschauen bis zum Schreiben ohne Hilfe: Alle Stufen sind geschafft.</p><div class="table-actions"><button class="button primary" data-action="tables-course-test">Jetzt abfragen</button><button class="button secondary" data-action="tables-course-restart">Noch einmal üben</button><button class="text-button" data-action="${prefix?'prefixes-config':'tables-catalog'}">${prefix?'Zur Präfixauswahl':'Andere Tabelle wählen'}</button></div></section>`;
  const preview=step.kind==='study'||session.reviewing,blanks=new Set(step.blankIds);
  const instructions=preview?(session.reviewing?'Schau dir die Lösungen noch einmal an. Die markierten Felder waren noch nicht richtig. Danach versuchst du dieselbe Stufe erneut.':'Schau dir die gezeigten Formen in Ruhe an. Tippe unten auf Weiter, sobald du bereit bist.'):step.kind==='match'?'Ziehe die Schnipsel in die passenden Lücken. Du kannst auch zuerst einen Schnipsel und dann seine Lücke antippen. Tippe ein belegtes Feld an, um es wieder zu leeren.':`${blanks.size} von ${items.length} ${items.length===1?'Antwort':'Antworten'} schreibst du jetzt selbst. ${blanks.size<items.length?'Die übrigen sind schon eingetragen.':'Diesmal ohne Vorgaben.'} Längenzeichen sind freiwillig.`;
  const progress=`<progress class="table-learning-meter" value="${step.number-1}" max="${step.total}" aria-label="Lernfortschritt: Schritt ${step.number} von ${step.total}"></progress>`;
  let bank='';
  if(step.kind==='match'&&!preview){
   const used=new Set(Object.entries(session.placements).filter(([id])=>activeIds.has(id)).map(([,id])=>id));
   bank=`<div class="table-token-bank" role="group" aria-label="Schnipsel zum Zuordnen">${session.order.filter(id=>activeIds.has(id)).map(id=>{const item=items.find(item=>item.id===id),taken=used.has(id);return `<button type="button" class="table-token ${selectedToken===id?'selected':''} ${taken?'used':''}" data-action="tables-token" data-token-id="${h(id)}" draggable="${!taken&&!session.checked}" aria-pressed="${selectedToken===id}" ${taken||session.checked?'disabled':''}>${h(item.answer)}</button>`;}).join('')}</div><p class="small muted" data-table-placement role="status">${selectedToken?'Schnipsel ausgewählt. Tippe jetzt auf die passende Lücke.':`${used.size} von ${items.length} ${items.length===1?'Schnipsel':'Schnipseln'} zugeordnet`}</p>`;
  }
  const cell=item=>{
   if(preview||step.kind==='write'&&!blanks.has(item.id))return `<div class="table-study-value ${session.reviewing&&result.wrongIds.includes(item.id)?'is-wrong':''}"><span lang="${prefix?'de':'la'}">${h(item.answer)}</span>${session.reviewing&&result.wrongIds.includes(item.id)?'<small>Noch einmal merken</small>':''}</div>`;
   if(step.kind==='write')return answerCell(item,session,prefix);
   const token=items.find(candidate=>candidate.id===session.placements[item.id]),correct=session.checked&&!result.wrongIds.includes(item.id);
   return `<div class="table-answer-cell"><button type="button" class="table-drop-slot ${token?'filled':''} ${session.checked?(correct?'is-correct':'is-wrong'):''}" data-action="tables-place" data-target-id="${h(item.id)}" ${token?`data-token-id="${h(token.id)}" draggable="${!session.checked}"`:''} aria-label="${h(item.prompt)}: ${token?h(token.answer):'leere Lücke'}" ${session.checked?'disabled':''}>${token?h(token.answer):'Hier zuordnen'}</button>${session.checked?`<div class="table-cell-feedback"><strong>${correct?'✓ Richtig':'○ Noch nicht richtig'}</strong>${correct?'':`<span>Lösung: ${h(item.answer)}</span>`}</div>`:''}</div>`;
  };
  const feedback=session.checked&&!session.reviewing?`<div class="table-learning-feedback" role="status"><strong>${result.correct} von ${result.total} richtig</strong><p>${result.passed?'Alles richtig! Du bist bereit für die nächste Stufe.':'Wir bleiben bei dieser Stufe. Schau dir die Lösungen an und versuche es noch einmal.'}</p></div>`:'';
  const next=preview||session.checked;
  return `<section class="table-panel">${progress}<div class="table-learning-heading"><span class="tag">ÜBEN · SCHRITT ${step.number} VON ${step.total}</span><h2 id="table-step-heading" tabindex="-1">${session.reviewing?'Noch einmal anschauen':h(step.label)}</h2><p>${h(title)}</p>${learningCaseNote(step)}<p class="muted">${h(instructions)}</p></div><form id="table-learning-form">${bank}${formGrid(course,items,cell,prefix)}${feedback}${next?`<button type="button" class="button primary wide" data-action="tables-learning-next">${session.reviewing?'Noch einmal versuchen':session.checked&&!result.passed?'Lösungen noch einmal ansehen':'Weiter'} →</button>`:'<button type="submit" class="button primary wide">Kontrollieren</button>'}</form><div class="table-actions"><button class="text-button" data-action="${prefix?'prefixes-config':'tables-config'}">Auswahl &amp; Lernmodus ändern</button></div></section>`;
 }
 function view(){const prefix=isPrefix(),mode=currentMode();return `<div class="table-practice-shell"><div class="page-heading"><div><div class="eyebrow">DEIN LATEINTRAINING</div><h1>${prefix?'Präfixe üben':'Tabellen üben'}</h1><p class="muted">${prefix?'Wortbausteine verstehen und sicher behalten.':'Tabelle wählen. Formen auswählen. In deinem Tempo lernen.'}</p></div></div>${mode==='learning'?learningView():mode==='worksheet'?worksheetView(prefix):!prefix&&mode==='catalog'?catalogView():setupView(prefix)}<p class="small muted table-save" data-table-save role="status">${h(saveMessage())}</p></div>`;}
 function start(prefix,learning){
  const table=prefix?null:getTable(state.tableId),filters=prefix?null:state.filters[table.id],items=prefix?PREFIXES:selectTableItems(table.id,filters);
  if(!items.length){notify('Wähle in jedem Bereich mindestens eine Möglichkeit.');return false;}
  if(learning){const course={tableId:table?.id||null,filters:filters?structuredClone(filters):null,session:createLearning(items,{prefix})};if(prefix)state.prefixLearning=course;else state.tableLearning=course;}
  else{const round=makeRound(items,table,filters);if(prefix)state.prefixRound=round;else state.tableRound=round;}
  state.kind=prefix?'prefixes':'tables';if(prefix)state.prefixMode=learning?'learning':'worksheet';else state.tableMode=learning?'learning':'worksheet';selectedToken=null;return true;
 }
 function matchActive(){const course=currentCourse();return currentMode()==='learning'&&course&&learningStep(course.session).kind==='match'&&!course.session.checked&&!course.session.reviewing;}
 function place(targetId,tokenId){
  if(!validTarget(targetId)||tokenId!==null&&!validToken(tokenId))return false;
  const changed=learningPlace(currentCourse().session,targetId,tokenId);
  if(changed){selectedToken=null;persist();paint();globalThis.document?.querySelector(`[data-target-id="${targetId}"]`)?.focus();}return changed;
 }
 function handle(button){
  const action=button?.dataset?.action;if(!action?.startsWith('tables-')&&!action?.startsWith('prefixes-'))return false;
  if(Date.now()<suppressClickUntil&&(action==='tables-token'||action==='tables-place'))return true;
  if(action==='tables-token'){
   if(validToken(button.dataset.tokenId)&&!Object.values(currentCourse().session.placements).includes(button.dataset.tokenId)){selectedToken=selectedToken===button.dataset.tokenId?null:button.dataset.tokenId;paint();globalThis.document?.querySelector(`[data-action="tables-token"][data-token-id="${button.dataset.tokenId}"]`)?.focus();}return true;
  }
  if(action==='tables-place'){if(matchActive())place(button.dataset.targetId,selectedToken);return true;}
  selectedToken=null;cleanupDrag();
  if(action==='tables-settings'){settingsDialog();return true;}
  if(action==='tables-choose-mode'||action==='prefixes-choose-mode'){modeDialog(action==='prefixes-choose-mode');return true;}
  if(action==='tables-modal-done'){closeModal();return true;}
  if(action==='tables-open'||action==='prefixes-open'){state.kind=action==='prefixes-open'?'prefixes':'tables';if(isPrefix())state.prefixMode='setup';else state.tableMode='catalog';persist();go();paint(true);return true;}
  const table=getTable(state.tableId);
  if(action==='tables-select'){if(!getTable(button.dataset.tableId))return true;state.tableId=button.dataset.tableId;state.tableMode='setup';state.kind='tables';}
  else if(action==='tables-catalog'){state.kind='tables';state.tableMode='catalog';}
  else if(action==='tables-config'){const active=state.tableMode==='learning'?state.tableLearning:state.tableRound;state.kind='tables';state.tableMode='setup';if(active&&getTable(active.tableId))state.tableId=active.tableId;}
  else if(action==='prefixes-config'){state.kind='prefixes';state.prefixMode='setup';}
  else if(action==='tables-resume'&&state.tableRound){state.kind='tables';state.tableMode='worksheet';}
  else if(action==='prefixes-resume'&&state.prefixRound){state.kind='prefixes';state.prefixMode='worksheet';}
  else if(action==='tables-resume-learning'&&state.tableLearning){state.kind='tables';state.tableMode='learning';}
  else if(action==='prefixes-resume-learning'&&state.prefixLearning){state.kind='prefixes';state.prefixMode='learning';}
  else if(action==='tables-filter-all'){const key=button.dataset.dimension;if(!table.dimensions.includes(key))return true;const all=DIMENSIONS[key].options.map(option=>String(option.id));state.filters[table.id][key]=all.every(id=>state.filters[table.id][key].includes(id))?[]:all;persist();refreshSelection();return true;}
  else if(action==='tables-case-basic'&&table.dimensions.includes('cases')){state.filters[table.id].cases=['nom','acc'];persist();refreshSelection();return true;}
  else if(['tables-start','tables-learn','prefixes-start','prefixes-learn','prefixes-new'].includes(action)){if(!start(action.startsWith('prefixes'),action.endsWith('learn')))return true;closeModal();}
  else if(action==='tables-learning-next'){if(currentMode()!=='learning'||!currentCourse())return true;learningNext(currentCourse().session,courseItems());}
  else if(action==='tables-course-test'||action==='tables-course-restart'){
   const course=currentCourse();if(!course)return true;
   if(action==='tables-course-restart')course.session=createLearning(courseItems(),{prefix:isPrefix()});
   else{const round=makeRound(courseItems(),isPrefix()?null:getTable(course.tableId),course.filters);if(isPrefix()){state.prefixRound=round;state.prefixMode='worksheet';}else{state.tableRound=round;state.tableMode='worksheet';}}
  }
  else if(action==='tables-repeat'||action==='tables-repeat-wrong'){
   const round=currentRound();if(!round)return true;const prefix=isPrefix();let items=roundItems(round,prefix);
   if(action==='tables-repeat-wrong'){if(!round.checked)return true;items=items.filter(item=>!checkAnswer(round.answers[item.id],item,{prefix}));}
   if(!items.length)return true;const next=makeRound(items,prefix?null:getTable(round.tableId),round.filters);if(prefix)state.prefixRound=next;else state.tableRound=next;
  }else return true;
  persist();paint(!['tables-filter-all','tables-case-basic'].includes(action));return true;
 }
 function input(element){
  const id=element?.dataset?.tableAnswer;if(typeof id!=='string')return false;
  if(currentMode()==='learning'){const course=currentCourse();if(course&&learningAnswer(course.session,id,String(element.value||'').slice(0,MAX_ANSWER)))persist();return true;}
  const round=currentRound();if(!round||round.checked||!own(round.answers,id))return true;round.answers[id]=String(element.value||'').slice(0,MAX_ANSWER);persist();return true;
 }
 function change(element){
  if(own(element?.dataset||{},'tableChoice')){if(getTable(element.value)){state.tableId=element.value;state.tableMode='setup';persist();paint(true);}return true;}
  const key=element?.dataset?.tableFilter;if(typeof key!=='string')return false;const table=getTable(state.tableId);
  if(!table.dimensions.includes(key)||!DIMENSIONS[key].options.some(option=>String(option.id)===element.value))return true;
  const selected=new Set(state.filters[table.id][key]);if(element.checked)selected.add(element.value);else selected.delete(element.value);
  state.filters[table.id][key]=DIMENSIONS[key].options.map(option=>String(option.id)).filter(id=>selected.has(id));persist();refreshSelection();return true;
 }
 function submit(form){
  if(!['table-practice-form','table-learning-form'].includes(form.id))return false;
  if(form.id==='table-learning-form'){
   const course=currentCourse();if(currentMode()!=='learning'||!course)return true;for(const field of form.querySelectorAll?.('[data-table-answer]')||[])input(field);
   learningCheck(course.session,courseItems());selectedToken=null;persist();paint(true);return true;
  }
  const round=currentRound();if(!round||round.checked)return true;for(const field of form.querySelectorAll?.('[data-table-answer]')||[])input(field);round.checked=true;persist();paint(true);return true;
 }
 function cleanupDrag(){
  const previous=pointer;pointer=null;
  if(scrollFrame!==null)globalThis.cancelAnimationFrame?.(scrollFrame);scrollFrame=null;
  ghost?.remove();ghost=null;dragToken=null;
  // A second finger must neither take over nor release the active answer's drag.
  try{if(previous?.source?.hasPointerCapture?.(previous.id))previous.source.releasePointerCapture(previous.id);}catch{}
  globalThis.document?.querySelectorAll?.('.table-drop-slot.drag-over').forEach(node=>node.classList.remove('drag-over'));
 }
 function scrollWhileDragging(){
  if(pointer?.source?.isConnected===false){cleanupDrag();return;}
  if(!pointer?.moved)return;
  const viewport=globalThis.innerHeight||0,y=pointer.lastY,x=pointer.lastX;
  if(viewport){const dy=y<64?-12:y>viewport-64?12:0;if(dy)globalThis.scrollBy?.(0,dy);}
  const under=globalThis.document?.elementFromPoint?.(x,y),region=under?.closest?.('.table-scroll');
  if(region){const bounds=region.getBoundingClientRect();if(x<bounds.left+36)region.scrollLeft-=10;else if(x>bounds.right-36)region.scrollLeft+=10;}
  scrollFrame=globalThis.requestAnimationFrame?.(scrollWhileDragging)??null;
 }
 function validTarget(id){return matchActive()&&learningStep(currentCourse().session).itemIds.includes(id);}
 function validToken(id){return validTarget(id);}
 function drag(event){
  const source=event.target?.closest?.('[data-token-id]'),target=event.target?.closest?.('[data-target-id]');
  if(event.type==='dragend'){if(dragToken!==null)cleanupDrag();return false;}
  if(event.type==='pointercancel'||event.type==='lostpointercapture'){if(pointer?.id===event.pointerId)cleanupDrag();return false;}
  if(!matchActive()){cleanupDrag();return false;}
  if(event.type==='dragstart'){
   if(!source||source.disabled||!validToken(source.dataset.tokenId))return false;
   cleanupDrag();
   dragToken=source.dataset.tokenId;event.dataTransfer?.setData('application/x-latinio-table-token',dragToken);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';return true;
  }
  if(event.type==='dragover'){if(!target||!validTarget(target.dataset.targetId)||!validToken(dragToken))return false;event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';return true;}
  if(event.type==='drop'){
   if(!target||!validTarget(target.dataset.targetId)||!validToken(dragToken))return false;event.preventDefault();const token=dragToken;cleanupDrag();place(target.dataset.targetId,token);return true;
  }
  if(event.type==='pointerdown'){
   if(pointer||event.isPrimary===false||event.button>0||!['touch','pen'].includes(event.pointerType)||!source||source.disabled||!validToken(source.dataset.tokenId))return false;
   pointer={id:event.pointerId,source,token:source.dataset.tokenId,x:event.clientX,y:event.clientY,moved:false,text:source.textContent};
   // Keep receiving moves and the release when a pen or finger leaves the token.
   try{source.setPointerCapture?.(event.pointerId);}catch{}
   return true;
  }
  if(!pointer||pointer.id!==event.pointerId)return false;
  if(event.type==='pointermove'){
   if(!pointer.moved&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<8)return true;
   pointer.moved=true;pointer.lastX=event.clientX;pointer.lastY=event.clientY;event.preventDefault();
   if(scrollFrame===null)scrollWhileDragging();
   if(!ghost&&globalThis.document?.body){ghost=document.createElement('div');ghost.className='table-token table-drag-ghost';ghost.textContent=pointer.text;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);}
   if(ghost){ghost.style.left=event.clientX+'px';ghost.style.top=event.clientY+'px';}
   const slot=globalThis.document?.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-target-id]');
   globalThis.document?.querySelectorAll?.('.table-drop-slot.drag-over').forEach(node=>node.classList.remove('drag-over'));if(slot&&validTarget(slot.dataset.targetId))slot.classList.add('drag-over');return true;
  }
  if(event.type==='pointerup'){
   const touch=pointer,slot=globalThis.document?.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-target-id]');cleanupDrag();
   if(touch.moved){event.preventDefault();suppressClickUntil=Date.now()+500;if(slot)place(slot.dataset.targetId,touch.token);}return true;
  }
  return false;
 }
 return {view,handle,input,change,submit,drag,get draft(){return structuredClone(state);}};
}
