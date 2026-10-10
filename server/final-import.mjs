import {readFileSync,existsSync,renameSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {openDatabase} from './database.mjs';

// Run only while the api service is stopped. Never replace a live SQLite file.
export async function finalImport(snapshot,file) {
  if(!existsSync(file))throw Error('Die bestehende Testdatenbank fehlt.');
  const stamp=Date.now()+'-'+process.pid;
  const next=file+'.next-'+stamp,backup=file+'.backup-'+stamp,previous=file+'.previous-'+stamp;
  const candidate=openDatabase(next);
  let old;
  try {
    candidate.importSnapshot(snapshot);
    if(!candidate.ready())throw Error('Importierte Datenbank ist nicht bereit.');
    old=openDatabase(file);
    for(const key of ['TOKEN_HASH','ADMIN_PIN_HASH','ADMIN_PIN_SALT']) {
      const a=old.db.prepare('SELECT value FROM properties WHERE key=?').get(key)?.value;
      const b=candidate.db.prepare('SELECT value FROM properties WHERE key=?').get(key)?.value;
      if(a!==b)throw Error('Anmeldedaten unterscheiden sich vom geprüften Export.');
    }
    // Journals are append-only. Every previously imported entry must remain intact.
    for(const {name} of old.db.prepare('SELECT name FROM sheets').all()) {
      if(name.startsWith('_Latinio'))continue;
      const before=old.db.prepare('SELECT value FROM rows WHERE sheet=? ORDER BY position').all(name);
      const after=candidate.db.prepare('SELECT value FROM rows WHERE sheet=? ORDER BY position').all(name);
      if(after.length<before.length || before.some((row,i)=>!isDeepStrictEqual(JSON.parse(row.value),JSON.parse(after[i].value)))) {
        throw Error('Der finale Export enthält ein verkürztes oder verändertes Lernjournal.');
      }
    }
    await old.backup(backup);
    old.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    candidate.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch(error) {
    candidate.close();old?.close();
    // A failed candidate is never made active. Keep any completed backup.
    for(const suffix of ['','-wal','-shm'])if(existsSync(next+suffix))unlinkSync(next+suffix);
    throw error;
  }
  candidate.close();old.close();
  renameSync(file,previous);
  try {renameSync(next,file);}catch(error){renameSync(previous,file);throw error;}
  return {tables:snapshot.sheets.length,backup,previous};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [source,file]=process.argv.slice(2);
  if(!source||!file)throw Error('Aufruf bei gestopptem api: node server/final-import.mjs export.json /data/latinio.sqlite');
  const result=await finalImport(JSON.parse(readFileSync(source,'utf8')),file);
  console.log('Finaler Import abgeschlossen: '+result.tables+' Tabellen. Sicherung: '+result.backup);
}
