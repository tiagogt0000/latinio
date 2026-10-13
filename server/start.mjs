import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {openDatabase} from './database.mjs';
import {apiServer} from './http.mjs';
const path=process.env.LATINIO_DATABASE || '/data/latinio.sqlite';
mkdirSync(dirname(path),{recursive:true});
const database=openDatabase(path,{requireStudentCodes:true});
const server=apiServer(database);
server.requestTimeout=20000;
server.headersTimeout=15000;
server.listen(8080,'0.0.0.0');
function stop(){server.close(()=>{database.close();process.exit(0);});}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
