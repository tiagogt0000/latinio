import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {openDatabase} from './database.mjs';
const [snapshotFile,databaseFile]=process.argv.slice(2);
if (!snapshotFile || !databaseFile || existsSync(databaseFile)) throw Error('Aufruf: node server/import.mjs export.json NEUE-datenbank.sqlite');
mkdirSync(dirname(databaseFile),{recursive:true});
const snapshot=JSON.parse(readFileSync(snapshotFile,'utf8'));
const database=openDatabase(databaseFile);
try {database.importSnapshot(snapshot);console.log('Import abgeschlossen. '+snapshot.sheets.length+' Tabellen übernommen.');}
finally {database.close();}
