import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {openDatabase} from './database.mjs';
import {apiServer} from './http.mjs';
import webpush from 'web-push';
import {createNotifications} from './notifications.mjs';
const path=process.env.LATINIO_DATABASE || '/data/latinio.sqlite';
mkdirSync(dirname(path),{recursive:true});
const database=openDatabase(path,{requireStudentCodes:true,enableAutoSharing:true});
const notifications=createNotifications(database,webpush);
const server=apiServer(database,undefined,notifications);
server.requestTimeout=20000;
server.headersTimeout=15000;
server.listen(8080,'0.0.0.0');
function stop(){notifications.close();server.close(()=>{database.close();process.exit(0);});}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
