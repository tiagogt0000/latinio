/** Add as a separate Apps Script file. Run manually in the editor only.
 * Does not change source tables, credentials, or the active deployment.
 * The generated PRIVATE file contains session hashes and PIN hashes.
 */
function exportLatinioForPi() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error('Es wird gerade gespeichert. Erneut versuchen.');
  try {
    const source=PropertiesService.getScriptProperties().getProperties();
    if(!source.SHEET_ID||!source.ADMIN_PIN_SALT||!/^([a-f0-9]{64})$/.test(source.TOKEN_HASH||'')||!/^([a-f0-9]{64})$/.test(source.ADMIN_PIN_HASH||''))throw new Error('Die vollständige Latinio-Konfiguration fehlt. Es wurde kein Export erstellt.');
    const properties={};
    ['SHEET_ID','TOKEN_HASH','ADMIN_PIN_HASH','ADMIN_PIN_SALT','PIN_FAILURES','PIN_BLOCKED_UNTIL'].forEach(function(key){if(source[key]!==undefined)properties[key]=source[key];});
    const book=SpreadsheetApp.openById(source.SHEET_ID);
    const sheets=book.getSheets().filter(function(sheet){return /^(Änderungen|Englisch_Änderungen|(?:Englisch_)?Lernen_[a-zA-Z0-9_-]+|_Latinio[a-zA-Z]+)$/.test(sheet.getName());}).map(function(sheet){return {name:sheet.getName(),rows:sheet.getDataRange().getValues()};});
    const exportData={format:'latinio-pi-migration',schema:1,createdAt:new Date().toISOString(),properties:properties,sheets:sheets};
    const name='latinio-pi-migration-'+Date.now()+'.json';
    const file=DriveApp.createFile(name,JSON.stringify(exportData),MimeType.PLAIN_TEXT);
    Logger.log('Privater Export: '+file.getUrl());
  } finally {lock.releaseLock();}
}
