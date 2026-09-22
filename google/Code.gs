/** Latinio 1.0.0 – an eine private Google-Tabelle gebundenes Apps Script.
 * Geheimnisse werden ausschließlich in ScriptProperties gespeichert.
 * Die Änderungstabelle ist ein fortlaufendes Journal, keine zu überschreibende Momentaufnahme.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Latinio').addItem('Mehrbenutzer-Update einrichten', 'setupMultiuser').addItem('Cloud-Verbindung einrichten', 'setupLatinio').addToUi();
}
function setupLatinio() {
  const ui=SpreadsheetApp.getUi();
  const originPrompt=ui.prompt('Latinio-Website','Gib die Herkunft deiner Website ein, z. B. https://deinname.github.io (ohne weiteren Pfad).',ui.ButtonSet.OK_CANCEL);
  if(originPrompt.getSelectedButton()!==ui.Button.OK)return;
  const origin=originPrompt.getResponseText().trim().replace(/\/$/,'');
  if(!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(origin))throw new Error('Bitte eine HTTPS-Herkunft ohne Pfad eingeben.');
  const props=PropertiesService.getScriptProperties();
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  props.setProperties({SHEET_ID:SpreadsheetApp.getActiveSpreadsheet().getId(),ALLOWED_ORIGIN:origin,TOKEN_HASH:hash_(token)});
  ensureLog_();
  ui.alert('Privater Verbindungsschlüssel','Kopiere diesen Schlüssel in Latinio unter Einstellungen → Google-Verbindung. Er wird hier nur einmal angezeigt. Teile ihn nicht öffentlich.\n\n'+token,ui.ButtonSet.OK);
}
function doGet(e) {
  const channel=String(e&&e.parameter&&e.parameter.channel||'');
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(channel))return HtmlService.createHtmlOutput('Latinio-Synchronisierung. Öffne deine Latinio-App.');
  const origin=PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGIN');
  if(!origin)return HtmlService.createHtmlOutput('Bitte zuerst die Latinio-Cloud einrichten.');
  const template=HtmlService.createTemplateFromFile('Bridge');
  template.channel=channel;template.origin=origin;
  return template.evaluate().setTitle('Latinio Cloud').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function latinioApi(request) {
  requestSheets_=Object.create(null);
  const readOnly=request&&['check','pull','whoami','profiles','shareList','profileCollections','profileActivity'].includes(request.action);
  const lock=readOnly?null:LockService.getScriptLock();
  if(lock&&!lock.tryLock(15000))throw new Error('Ein anderes Gerät speichert gerade. Bitte gleich noch einmal versuchen.');
  try {
    if(!request||typeof request.action!=='string')throw new Error('Ungültige Anfrage.');
    if(request.action==='login')return login_(request);
    const identity=authorize_(request);
    if(request.action==='whoami')return {profile:identity,apiVersion:2};
    if(['profiles','profileCreate','profileDelete','profileCollections','profileActivity','shareRevoke','shareList','shareCreate','shareCreateMany','shareNotify','shareRepair','shareChanges','shareSend','logout'].includes(request.action))return accountApi_(request,identity);
    const sheet=ensureLog_(identity.id,readOnly);
    const lastRow=sheet?sheet.getLastRow():0;
    const version=lastRow>1?Number(sheet.getRange(lastRow,1).getValue()):0;
    if(request.action==='check')return {version:version};
    const log=lastRow>1?sheet.getRange(2,1,lastRow-1,5).getValues().map(function(row){return {version:Number(row[0]),op:JSON.parse(row[4])};}):[];
    const data=replay_(log);
    if(request.action==='pull') {
      const since=Number(request.since||0);
      if(!Number.isSafeInteger(since)||since<0||since>version)throw new Error('Ungültiger Gerätestand.');
      return {version:version,data:data,ops:log.filter(function(row){return row.version>since;}).map(function(row){return row.op;})};
    }
    if(request.action!=='push')throw new Error('Unbekannte Aktion.');
    if(!Number.isSafeInteger(request.base)||request.base<0)throw new Error('Ungültige Version.');
    if(request.base!==version)return {conflict:true,version:version};
    if(!Array.isArray(request.ops)||request.ops.length>200)throw new Error('Ungültige Anzahl von Änderungen.');
    const known={};log.forEach(function(row){known[row.op.id]=true;});
    const rows=[],accepted=[];let next=version;
    request.ops.forEach(function(op){
      validateOp_(op);accepted.push(op.id);if(known[op.id])return;
      known[op.id]=true;next++;
      const json=JSON.stringify(op);if(json.length>45000)throw new Error('Eine Änderung ist zu groß.');
      rows.push([next,op.id,new Date().toISOString(),op.device,json]);
      apply_(data,op);
    });
    if(rows.length){sheet.getRange(lastRow+1,1,rows.length,5).setValues(rows);SpreadsheetApp.flush();}
    return {version:next,data:data,accepted:accepted};
  } finally {if(lock)lock.releaseLock();}
}
function hash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function authorize_(request){
  const props=PropertiesService.getScriptProperties();
  if(!request||typeof request.token!=='string'||request.token.length<32||request.token.length>200)throw new Error('Bitte erneut anmelden.');
  const hashed=hash_(request.token),expected=props.getProperty('TOKEN_HASH');
  if(expected&&hashed===expected)return {id:'admin',role:'admin',name:'Admin'};
  const session=records_('_LatinioSessions')[hashed];
  if(!session||session.expires<Date.now())throw new Error('Bitte erneut anmelden.');
  if(session.profileId==='admin')return {id:'admin',role:'admin',name:'Admin'};
  const profile=records_('_LatinioProfiles')[session.profileId];
  if(!profile||!profile.active)throw new Error('Dieses Profil ist nicht freigeschaltet.');
  return {id:profile.id,role:'student',name:profile.name,email:profile.email};
}
function ensureLog_(profileId,readOnly){
  const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)throw new Error('Cloud noch nicht eingerichtet.');
  const book=SpreadsheetApp.openById(id);
  const tab=!profileId||profileId==='admin'?'Änderungen':'Lernen_'+profileId;
  let sheet=book.getSheetByName(tab);
  if(!sheet&&readOnly)return null;
  if(!sheet){sheet=book.insertSheet(tab);sheet.getRange(1,1,1,5).setValues([['Version','Änderung-ID','Gespeichert am','Gerät','Daten (JSON)']]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,5).setFontWeight('bold').setBackground('#59b923').setFontColor('#ffffff');sheet.setColumnWidths(1,4,160);sheet.setColumnWidth(5,600);}
  return sheet;
}
function replay_(log){const data={collections:{},words:{},reviews:{},sessions:{},settings:{}};log.forEach(function(row){apply_(data,row.op);});return data;}
function apply_(data,op){if(op.value===null)delete data[op.entity][op.key];else data[op.entity][op.key]=op.value;}
function validateOp_(op){
  if(!op||!['collections','words','reviews','sessions','settings'].includes(op.entity))throw new Error('Ungültige Datenart.');
  ['id','key','device'].forEach(function(field){if(typeof op[field]!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(op[field])||['__proto__','constructor','prototype'].includes(op[field]))throw new Error('Ungültige Kennung.');});
  if(!Number.isFinite(op.at)||!Number.isSafeInteger(op.seq)||op.seq<0)throw new Error('Ungültige Änderungsnummer.');
  if(op.value===null)return;
  if(!op.value||typeof op.value!=='object'||Array.isArray(op.value))throw new Error('Ungültige Daten.');
  const v=op.value;
  if(op.entity==='words'&&(v.id!==op.key||typeof v.latin!=='string'||typeof v.collectionId!=='string'||!Array.isArray(v.meanings)||!v.meanings.length||v.meanings.some(function(g){return !Array.isArray(g)||!g.length||g.some(function(s){return typeof s!=='string'||!s.trim()||s.length>300;});})))throw new Error('Ungültige Vokabel.');
  if(op.entity==='collections'&&(v.id!==op.key||typeof v.name!=='string'||!v.name.trim()))throw new Error('Ungültige Sammlung.');
  if(op.entity==='reviews'&&(v.id!==op.key||typeof v.wordId!=='string'||!['full','partial','wrong'].includes(v.grade)||!Number.isFinite(v.at)))throw new Error('Ungültige Bewertung.');
}
