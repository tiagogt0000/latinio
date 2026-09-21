/** Wordlo 1.0.0 — eigener privater Lernstand, keine Benutzerverwaltung. */
function onOpen(){SpreadsheetApp.getUi().createMenu('Wordlo').addItem('Wordlo einrichten','setupWordlo').addToUi();}
function setupWordlo(){
  const ui=SpreadsheetApp.getUi(),props=PropertiesService.getScriptProperties();
  if(props.getProperty('WORDLO_TOKEN_HASH')){ui.alert('Wordlo ist bereits eingerichtet. Der bestehende Schlüssel bleibt gültig.');return;}
  const originPrompt=ui.prompt('Wordlo-Website','Herkunft deiner Website, ohne Pfad, z. B. https://tiagogt0000.github.io',ui.ButtonSet.OK_CANCEL);
  if(originPrompt.getSelectedButton()!==ui.Button.OK)return;
  const origin=originPrompt.getResponseText().trim().replace(/\/$/,'');
  if(!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(origin))throw Error('Bitte eine HTTPS-Herkunft ohne Pfad eingeben.');
  const book=SpreadsheetApp.getActiveSpreadsheet();if(!book)throw Error('Bitte dieses Skript über Erweiterungen → Apps Script in einer eigenen Google-Tabelle öffnen.');
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  props.setProperties({WORDLO_SHEET_ID:book.getId(),WORDLO_ORIGIN:origin,WORDLO_TOKEN_HASH:hash_(token)});
  ensureLog_();ui.alert('Wordlo-Verbindungsschlüssel','Diesen privaten Schlüssel sicher aufbewahren und auf deinen Geräten in Wordlo eintragen. Nicht in GitHub veröffentlichen.\n\n'+token,ui.ButtonSet.OK);
}
function doGet(e){
  const channel=String(e&&e.parameter&&e.parameter.channel||'');
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(channel))return HtmlService.createHtmlOutput('Wordlo-Synchronisierung. Öffne deine Wordlo-App.');
  const origin=PropertiesService.getScriptProperties().getProperty('WORDLO_ORIGIN');if(!origin)return HtmlService.createHtmlOutput('Bitte zuerst setupWordlo ausführen.');
  const template=HtmlService.createTemplateFromFile('Bridge');template.channel=channel;template.origin=origin;
  return template.evaluate().setTitle('Wordlo Cloud').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function wordloApi(request){
  if(!request||request.app!=='wordlo'||typeof request.token!=='string'||request.token.length<32||request.token.length>200)throw Error('Ungültige Wordlo-Verbindung.');
  const expected=PropertiesService.getScriptProperties().getProperty('WORDLO_TOKEN_HASH');
  if(!expected||hash_(request.token)!==expected)throw Error('Der private Verbindungsschlüssel ist nicht richtig.');
  const lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Ein anderes Gerät speichert gerade. Bitte gleich erneut versuchen.');
  try{
    const sheet=ensureLog_(),last=sheet.getLastRow();
    const log=last>1?sheet.getRange(2,1,last-1,5).getValues().map(function(r){return {version:Number(r[0]),op:JSON.parse(r[4])};}):[];
    const version=log.length?log[log.length-1].version:0;
    if(request.action==='check')return {app:'wordlo',schema:1,version:version};
    const data={collections:{},words:{},reviews:{},decks:{},settings:{}};log.forEach(function(row){apply_(data,row.op);});
    if(request.action==='pull'){
      const since=request.since;if(!Number.isSafeInteger(since)||since<0||since>version)throw Error('Der Cloud-Stand passt nicht zu diesem Gerät. Bitte keine Daten überschreiben.');
      return {app:'wordlo',version:version,data:data,ops:log.filter(function(r){return r.version>since;}).map(function(r){return r.op;})};
    }
    if(request.action!=='push')throw Error('Unbekannte Wordlo-Aktion.');
    if(!Number.isSafeInteger(request.base)||request.base<0)throw Error('Ungültiger Versionsstand.');
    if(request.base!==version)return {conflict:true,version:version};
    if(!Array.isArray(request.ops)||request.ops.length>100)throw Error('Ungültige Anzahl Änderungen.');
    const known=Object.create(null);log.forEach(function(r){known[r.op.id]=true;});const rows=[],accepted=[];let next=version;
    request.ops.forEach(function(op){validateOp_(op);accepted.push(op.id);if(known[op.id])return;known[op.id]=true;
      const json=JSON.stringify(op);if(json.length>45000)throw Error('Ein Eintrag ist zu groß. Bitte eine kleinere Auffrisch-Sammlung anlegen.');
      next++;rows.push([next,op.id,new Date().toISOString(),op.device,json]);apply_(data,op);
    });
    if(rows.length){sheet.getRange(last+1,1,rows.length,5).setValues(rows);SpreadsheetApp.flush();}
    return {app:'wordlo',version:next,data:data,accepted:accepted};
  }finally{lock.releaseLock();}
}
function hash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function ensureLog_(){
  const id=PropertiesService.getScriptProperties().getProperty('WORDLO_SHEET_ID');if(!id)throw Error('Wordlo ist noch nicht eingerichtet.');
  const book=SpreadsheetApp.openById(id);let sheet=book.getSheetByName('Wordlo_Änderungen');
  if(!sheet){sheet=book.insertSheet('Wordlo_Änderungen');sheet.getRange(1,1,1,5).setValues([['Version','Änderung-ID','Gespeichert am','Gerät','Daten (JSON)']]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,5).setFontWeight('bold').setBackground('#18243d').setFontColor('#ffffff');sheet.setColumnWidth(5,600);}return sheet;
}
function safeId_(v){return typeof v==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);}
function apply_(data,op){if(op.value===null)delete data[op.entity][op.key];else data[op.entity][op.key]=op.value;}
function groupsValid_(groups,english){return Array.isArray(groups)&&groups.length>0&&groups.length<=30&&groups.every(function(g){return g&&safeId_(g.id)&&Array.isArray(g.answers)&&g.answers.length>0&&g.answers.length<=20&&g.answers.every(function(s){return typeof s==='string'&&s.trim()&&s.length<=300;})&&(!g.region||english&&['UK','US'].includes(g.region));})&&new Set(groups.map(function(g){return g.id;})).size===groups.length;}
function validateOp_(op){
  if(!op||!['collections','words','reviews','decks','settings'].includes(op.entity)||!safeId_(op.id)||!safeId_(op.key)||!safeId_(op.device)||!Number.isFinite(op.at)||!Number.isSafeInteger(op.seq)||op.seq<0)throw Error('Ungültige Änderung.');
  if(op.value===null)return;const v=op.value;
  if(!v||typeof v!=='object'||Array.isArray(v)||v.id!==op.key)throw Error('Ungültiger Eintrag.');
  if(op.entity==='words'&&(!(v.collectionId===null||safeId_(v.collectionId))||!groupsValid_(v.english,true)||!groupsValid_(v.german,false)))throw Error('Ungültige Vokabel.');
  if(op.entity==='words'&&v.context&&['de','en'].some(function(k){return v.context[k]!==undefined&&(typeof v.context[k]!=='string'||v.context[k].length>300);}))throw Error('Ungültiger Kontexthinweis.');
  if(['collections','decks'].includes(op.entity)&&(typeof v.name!=='string'||!v.name.trim()||v.name.length>100))throw Error('Ungültiger Sammlungsname.');
  if(op.entity==='decks'&&(!Array.isArray(v.members)||v.members.length>5000||v.members.some(function(m){return !safeId_(m.wordId)||!Number.isFinite(m.addedAt); })))throw Error('Ungültige Auffrisch-Sammlung.');
  if(op.entity==='reviews'&&(!safeId_(v.wordId)||!['de-en','en-de'].includes(v.direction)||!['any','all'].includes(v.requirement)||!Number.isFinite(v.at)||!v.result||!['full','partial','wrong'].includes(v.result.grade)||!Array.isArray(v.result.matched)||!Array.isArray(v.result.rows)))throw Error('Ungültige Bewertung.');
}
