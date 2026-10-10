import {backup,DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
const [source,destination]=process.argv.slice(2);
if(!source || !destination || !existsSync(source) || existsSync(destination)) throw Error('Quelle und neuer Sicherungspfad erforderlich.');
const database=new DatabaseSync(source,{readOnly:true});
try {await backup(database,destination);console.log('SQLite-Sicherung abgeschlossen.');}
finally {database.close();}
