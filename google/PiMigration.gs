/** Temporary bridge for cached old PWAs. No Pi setting is active until the
 * administrator calls the explicit migration functions in the editor. */
function piMigrationRoute_(request) {
  const props=PropertiesService.getScriptProperties();
  const target=props.getProperty('PI_API_URL');
  if(target){
    if(target!=='https://elektrogilbersserver.tail7c7157.ts.net:8443/api')throw new Error('Ungültiges Pi-Ziel.');
    const payload=Object.assign({},request);delete payload.token;
    const headers={Origin:'https://tiagogt0000.github.io'};
    if(request&&request.token)headers.Authorization='Bearer '+request.token;
    const response=UrlFetchApp.fetch(target,{method:'post',contentType:'application/json',headers:headers,
      payload:JSON.stringify(payload),muteHttpExceptions:true,followRedirects:false});
    let body;try{body=JSON.parse(response.getContentText());}catch(error){throw new Error('Der Pi antwortet noch nicht richtig. Änderungen bleiben lokal gespeichert.');}
    if(response.getResponseCode()!==200||body.error)throw new Error(body.error||'Der Pi ist gerade nicht erreichbar.');
    return {handled:true,result:body.result};
  }
  const readOnly=request&&['check','pull','whoami','profiles','shareList','profileCollections','profileActivity','announcementInbox','announcementList'].includes(request.action);
  if(props.getProperty('PI_MIGRATION_FROZEN')==='1'&&!readOnly)throw new Error('Der Speicher zieht gerade um. Deine Änderungen bleiben lokal und werden später synchronisiert.');
  return {handled:false};
}

function beginPiMigrationExport(){
  const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Es wird gerade gespeichert. Erneut versuchen.');
  try{
    if(props.getProperty('PI_API_URL')||props.getProperty('PI_MIGRATION_FROZEN')==='1')throw new Error('Die Migration wurde bereits begonnen.');
    props.setProperty('PI_MIGRATION_FROZEN','1');
  }finally{lock.releaseLock();}
  try{exportLatinioForPi();}
  catch(error){props.deleteProperty('PI_MIGRATION_FROZEN');throw error;}
}

function finishPiMigration(){
  const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();
  if(props.getProperty('PI_MIGRATION_FROZEN')!=='1')throw new Error('Die finale Datenübernahme wurde noch nicht begonnen.');
  const response=UrlFetchApp.fetch('https://elektrogilbersserver.tail7c7157.ts.net:8443/health',{muteHttpExceptions:true,followRedirects:false});
  if(response.getResponseCode()!==200||JSON.parse(response.getContentText()).ready!==true)throw new Error('Der Pi ist noch nicht bereit.');
  if(!lock.tryLock(15000))throw new Error('Es wird gerade gespeichert. Erneut versuchen.');
  try{props.setProperty('PI_API_URL','https://elektrogilbersserver.tail7c7157.ts.net:8443/api');props.deleteProperty('PI_MIGRATION_FROZEN');}
  finally{lock.releaseLock();}
  Logger.log('Alte App-Versionen werden jetzt an den Pi weitergereicht.');
}

function cancelPiMigrationBeforeCutover(){
  const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Es wird gerade gespeichert. Erneut versuchen.');
  try{
    if(props.getProperty('PI_API_URL'))throw new Error('Nach der Umschaltung nicht auf den alten Google-Stand zurückschalten.');
    props.deleteProperty('PI_MIGRATION_FROZEN');
  }finally{lock.releaseLock();}
}
