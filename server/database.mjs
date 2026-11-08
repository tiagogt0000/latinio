import {DatabaseSync, backup} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import vm from 'node:vm';

// Preserve the existing domain rules and journal versions while replacing
// every Google storage/service call with local SQLite and Node operations.
export function openDatabase(path,{requireStudentCodes=false,enableAutoSharing=false}={}) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS properties (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sheets (name TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS rows (sheet TEXT NOT NULL, position INTEGER NOT NULL,
      value TEXT NOT NULL, PRIMARY KEY(sheet, position));
    CREATE TABLE IF NOT EXISTS journal_snapshots (sheet TEXT PRIMARY KEY,
      version INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS journal_snapshot_update AFTER UPDATE ON rows BEGIN
      DELETE FROM journal_snapshots WHERE sheet=OLD.sheet AND OLD.position<=version+1;
      DELETE FROM journal_snapshots WHERE sheet=NEW.sheet AND NEW.position<=version+1;
    END;
    CREATE TRIGGER IF NOT EXISTS journal_snapshot_delete AFTER DELETE ON rows BEGIN
      DELETE FROM journal_snapshots WHERE sheet=OLD.sheet AND OLD.position<=version+1;
    END;
    CREATE TRIGGER IF NOT EXISTS journal_snapshot_replace BEFORE INSERT ON rows BEGIN
      DELETE FROM journal_snapshots WHERE sheet=NEW.sheet AND NEW.position<=version+1;
    END;`);
  const getProp = db.prepare('SELECT value FROM properties WHERE key=?');
  const putProp = db.prepare('INSERT OR REPLACE INTO properties VALUES (?,?)');
  const getRow = db.prepare('SELECT value FROM rows WHERE sheet=? AND position=?');
  const getRows = db.prepare('SELECT position,value FROM rows WHERE sheet=? AND position>=? AND position<? ORDER BY position');
  const putRow = db.prepare('INSERT OR REPLACE INTO rows VALUES (?,?,?)');
  const sheetExists = db.prepare('SELECT 1 FROM sheets WHERE name=?');
  const lastRow = db.prepare('SELECT COALESCE(MAX(position),0) AS n FROM rows WHERE sheet=?');
  const getSnapshot = db.prepare('SELECT version,data FROM journal_snapshots WHERE sheet=?');
  const putSnapshot = db.prepare('INSERT OR REPLACE INTO journal_snapshots VALUES (?,?,?)');
  const getOperationIds = db.prepare("SELECT json_extract(value,'$[1]') AS id FROM rows WHERE sheet=? AND position>1 ORDER BY position");
  const isJournal = name => !name.startsWith('_Latinio');
  function journalLog(name,since=0) {
    return getRows.all(name,since+2,lastRow.get(name).n+1).map(({value}) => {
      const row=JSON.parse(value);return {version:Number(row[0]),op:JSON.parse(row[4])};
    });
  }
  function journalState(name) {
    const last=lastRow.get(name).n;
    const version=last>1?Number(JSON.parse(getRow.get(name,last).value)[0]):0;
    const saved=getSnapshot.get(name);
    let data,from=0;
    if(saved&&Number.isSafeInteger(saved.version)&&saved.version>=0&&saved.version<=version){
      try {
        data=JSON.parse(saved.data);
        if(!data||['collections','words','reviews','sessions','settings'].some(key=>!data[key]||typeof data[key]!=='object'||Array.isArray(data[key])))data=null;
        else from=saved.version;
      } catch { data=null; }
    }
    const rebuild=!data;
    if(rebuild)data={collections:{},words:{},reviews:{},sessions:{},settings:{}};
    if(rebuild||from!==version){
      for(const {op} of journalLog(name,from)){
        if(op.value===null)delete data[op.entity][op.key];else data[op.entity][op.key]=op.value;
      }
      // This row is derived data. The journal remains authoritative and intact.
      putSnapshot.run(name,version,JSON.stringify(data));
    }
    return {data,version};
  }
  function sheet(name) {
    return {
      getLastRow: () => lastRow.get(name).n,
      readState: () => journalState(name),
      readLog: since => journalLog(name,since),
      operationIds: () => getOperationIds.all(name).map(row=>row.id),
      getRange(r, c, n = 1, m = 1) {
        const range = {
          getValues: () => {
            const rows=new Map(getRows.all(name,r,r+n).map(row=>[row.position,JSON.parse(row.value)]));
            return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>rows.get(r+i)?.[c+j-1]??''));
          },
          getValue: () => range.getValues()[0][0],
          setValues(values) {
            values.forEach((cells,i) => {
              const row = JSON.parse(getRow.get(name,r+i)?.value || '[]');
              cells.forEach((v,j) => { row[c+j-1] = v; });
              putRow.run(name,r+i,JSON.stringify(row));
            });
            // Warm snapshots follow appends in the same transaction as all
            // recipient writes. Replaced history was invalidated by SQLite.
            if(isJournal(name)&&getSnapshot.get(name))journalState(name);
            return range;
          },
          setFontWeight: () => range, setBackground: () => range, setFontColor: () => range
        };
        return range;
      },
      setFrozenRows() {}, setColumnWidths() {}, setColumnWidth() {}
    };
  }
  const book = {
    getSheetByName: name => sheetExists.get(name) ? sheet(name) : null,
    insertSheet(name) { db.prepare('INSERT INTO sheets VALUES (?)').run(name); return sheet(name); }
  };
  const ctx = vm.createContext({
    Number, JSON, Date, Error, Array, STUDENT_CODES_REQUIRED:requireStudentCodes, AUTOMATIC_SHARING_ENABLED:enableAutoSharing,
    SpreadsheetApp: {openById: () => book, flush() {}},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: key => getProp.get(key)?.value ?? null,
      setProperties: values => { for (const [k,v] of Object.entries(values)) putProp.run(k,String(v)); }
    })},
    Utilities: {getUuid: randomUUID, DigestAlgorithm: {SHA_256:'sha256'}, Charset: {UTF_8:'utf8'},
      computeDigest: (_algorithm,value) => [...createHash('sha256').update(value).digest()]},
    // Single synchronous request in a SQLite transaction, no external locks needed.
    LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})}
  });
  for (const file of ['Code.gs','Accounts.gs','AutoSharing.gs']) {
    vm.runInContext(readFileSync(new URL('../google/'+file,import.meta.url),'utf8'),ctx);
  }
  function enableFrench(){
    if(getProp.get('FRENCH_ENABLED')||!getProp.get('SHEET_ID'))return;
    db.exec('BEGIN IMMEDIATE');
    try{
      vm.runInContext("requestSheets_=Object.create(null); Object.values(records_('_LatinioProfiles')).forEach(function(p){p.allowedSubjects=Array.from(new Set(normalizeSubjects_(p.allowedSubjects).concat(['french'])));saveRecord_('_LatinioProfiles',p.id,p);});",ctx);
      putProp.run('FRENCH_ENABLED','true');db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  return {
    db,
    studentCodesRequired:requireStudentCodes,
    autoSharingEnabled:enableAutoSharing,
    frenchEnabled:true,
    ready: () => Boolean(getProp.get('SHEET_ID') && getProp.get('TOKEN_HASH') && getProp.get('ADMIN_PIN_HASH')),
    request(request) {
      enableFrench();
      db.exec('BEGIN IMMEDIATE');
      try {
        ctx.requestInput = JSON.parse(JSON.stringify(request));
        const result = vm.runInContext('latinioApi(requestInput)',ctx,{timeout:10000});
        db.exec('COMMIT');
        return JSON.parse(JSON.stringify(result));
      } catch (error) {
        // Failed PIN attempts must persist the existing lockout counter.
        db.exec(request.action === 'login' ? 'COMMIT' : 'ROLLBACK');
        throw error;
      } finally { delete ctx.requestInput; }
    },
    notificationSnapshot(){
      enableFrench();
      db.exec('BEGIN IMMEDIATE');
      try {
        const value=vm.runInContext(`
        requestSheets_=Object.create(null);
        [{id:'admin',name:'Tiago',allowedSubjects:['latin','english','french']}]
        .concat(Object.values(records_('_LatinioProfiles')).filter(function(p){return p.active;}))
        .map(function(p){
          const days=['latin','english','french'].flatMap(function(subject){
            return Object.values(readState_(p.id,true,subject).data.settings)
              .filter(function(v){return v.kind==='streakDay';}).map(function(v){return v.day;});
          });
          return {id:p.id,name:p.name,subjects:normalizeSubjects_(p.allowedSubjects),days:Array.from(new Set(days))};
        });`,ctx,{timeout:10000});
        db.exec('COMMIT');
        return JSON.parse(JSON.stringify(value));
      } catch(error){db.exec('ROLLBACK');throw error;}
    },
    importSnapshot(snapshot) {
      if (db.prepare('SELECT COUNT(*) AS n FROM sheets').get().n || db.prepare('SELECT COUNT(*) AS n FROM properties').get().n) {
        throw Error('Import nur in eine leere Datenbank möglich.');
      }
      if (snapshot?.format !== 'latinio-pi-migration' || snapshot.schema !== 1 || !Array.isArray(snapshot.sheets)) {
        throw Error('Ungültige Migrationsdatei.');
      }
      for (const key of ['TOKEN_HASH','ADMIN_PIN_HASH']) {
        if (!/^[a-f0-9]{64}$/.test(snapshot.properties?.[key] || '')) throw Error('Anmeldedaten fehlen.');
      }
      if (!snapshot.properties.ADMIN_PIN_SALT) throw Error('PIN-Salt fehlt.');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec('DELETE FROM journal_snapshots');
        for (const key of ['SHEET_ID','TOKEN_HASH','ADMIN_PIN_HASH','ADMIN_PIN_SALT','PIN_FAILURES','PIN_BLOCKED_UNTIL']) {
          if (snapshot.properties[key] !== undefined) putProp.run(key,String(snapshot.properties[key]));
        }
        if (!getProp.get('SHEET_ID')) putProp.run('SHEET_ID','local');
        for (const entry of snapshot.sheets) {
          if (!/^(Änderungen|(?:Englisch_|Franzoesisch_)Änderungen|(?:(?:Englisch|Franzoesisch)_)?Lernen_[a-zA-Z0-9_-]+|_Latinio[a-zA-Z]+)$/.test(entry.name) || !Array.isArray(entry.rows)) {
            throw Error('Ungültige Tabelle.');
          }
          book.insertSheet(entry.name);
          entry.rows.forEach((row,i) => {
            if (!Array.isArray(row)) throw Error('Ungültige Zeile.');
            if (i > 0) {
              const meta = entry.name.startsWith('_Latinio');
              const parsed = JSON.parse(row[meta ? 1 : 4]);
              if (!meta) {
                ctx.validateOp_(parsed);
                if (Number(row[0]) !== i || row[1] !== parsed.id) throw Error('Ungültiges Änderungsjournal.');
              }
            }
            putRow.run(entry.name,i+1,JSON.stringify(row));
          });
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    backup: destination => backup(db,destination),
    close: () => db.close()
  };
}
