import {DatabaseSync, backup} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import vm from 'node:vm';

// Preserve the existing domain rules and journal versions while replacing
// every Google storage/service call with local SQLite and Node operations.
export function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS properties (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sheets (name TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS rows (sheet TEXT NOT NULL, position INTEGER NOT NULL,
      value TEXT NOT NULL, PRIMARY KEY(sheet, position));`);
  const getProp = db.prepare('SELECT value FROM properties WHERE key=?');
  const putProp = db.prepare('INSERT OR REPLACE INTO properties VALUES (?,?)');
  const getRow = db.prepare('SELECT value FROM rows WHERE sheet=? AND position=?');
  const putRow = db.prepare('INSERT OR REPLACE INTO rows VALUES (?,?,?)');
  const sheetExists = db.prepare('SELECT 1 FROM sheets WHERE name=?');
  const lastRow = db.prepare('SELECT COALESCE(MAX(position),0) AS n FROM rows WHERE sheet=?');
  function sheet(name) {
    return {
      getLastRow: () => lastRow.get(name).n,
      getRange(r, c, n = 1, m = 1) {
        const range = {
          getValues: () => Array.from({length:n}, (_,i) => {
            const row = JSON.parse(getRow.get(name,r+i)?.value || '[]');
            return Array.from({length:m}, (_,j) => row[c+j-1] ?? '');
          }),
          getValue: () => range.getValues()[0][0],
          setValues(values) {
            values.forEach((cells,i) => {
              const row = JSON.parse(getRow.get(name,r+i)?.value || '[]');
              cells.forEach((v,j) => { row[c+j-1] = v; });
              putRow.run(name,r+i,JSON.stringify(row));
            });
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
    Number, JSON, Date, Error, Array,
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
  for (const file of ['Code.gs','Accounts.gs']) {
    vm.runInContext(readFileSync(new URL('../google/'+file,import.meta.url),'utf8'),ctx);
  }
  return {
    db,
    ready: () => Boolean(getProp.get('SHEET_ID') && getProp.get('TOKEN_HASH') && getProp.get('ADMIN_PIN_HASH')),
    request(request) {
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
        for (const key of ['SHEET_ID','TOKEN_HASH','ADMIN_PIN_HASH','ADMIN_PIN_SALT','PIN_FAILURES','PIN_BLOCKED_UNTIL']) {
          if (snapshot.properties[key] !== undefined) putProp.run(key,String(snapshot.properties[key]));
        }
        if (!getProp.get('SHEET_ID')) putProp.run('SHEET_ID','local');
        for (const entry of snapshot.sheets) {
          if (!/^(Änderungen|Englisch_Änderungen|(?:Englisch_)?Lernen_[a-zA-Z0-9_-]+|_Latinio[a-zA-Z]+)$/.test(entry.name) || !Array.isArray(entry.rows)) {
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
