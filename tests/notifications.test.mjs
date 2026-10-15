import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../server/database.mjs';
import {apiServer} from '../server/http.mjs';
import {createNotifications,localClock,validSubscription} from '../server/notifications.mjs';
import {harness} from './google-harness.mjs';
const token='a'.repeat(64),time=Date.parse('2026-10-15T17:15:00Z');
const subscription=(id='a')=>({endpoint:'https://web.push.apple.com/'+id,keys:{p256dh:Buffer.concat([Buffer.from([4]),Buffer.alloc(64,2)]).toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')}});
function fixture(t,file=':memory:'){
 const h=harness(),snapshot={format:'latinio-pi-migration',schema:1,properties:h.props,sheets:[...h.sheets].map(([name,s])=>({name,rows:s.rows}))};
 const database=openDatabase(file,{enableAutoSharing:true});database.importSnapshot(snapshot);
 const p=database.request({action:'profileCreate',token,name:'Felix',email:'felix@example.org'}).profile;
 const profile={...p,role:'student'},admin={id:'admin',role:'admin'},sent=[];
 let clock=time,fail=false;
 const transport={generateVAPIDKeys:()=>({publicKey:'public-test',privateKey:'private-test'}),async sendNotification(sub,payload,options){if(fail){const e=Error('gone');e.statusCode=410;throw e;}sent.push({sub,payload:JSON.parse(payload),options});}};
 const service=createNotifications(database,transport,{now:()=>clock,random:()=>0});t.after(()=>{service.close();database.close();});
 return {database,service,profile,admin,sent,setTime:n=>clock=n,setFailure:()=>fail=true};
}
test('Push subscriptions reject arbitrary internal URLs and malformed encryption keys',()=>{
 assert.equal(validSubscription(subscription()).endpoint,'https://web.push.apple.com/a');
 for(const endpoint of ['http://web.push.apple.com/a','https://127.0.0.1/a','https://evil.push.apple.com.evil.test/a','https://fcm.googleapis.com:8443/a','https://user:password@web.push.apple.com/a'])assert.throws(()=>validSubscription({...subscription(),endpoint}));
 assert.throws(()=>validSubscription({...subscription(),keys:{auth:'bad',p256dh:'bad'}}));
});
test('Random reminders send at most once per day across devices, with subject flags and an admin-only history',async t=>{
 const f=fixture(t);f.service.request({action:'notificationSubscribe',subscription:subscription('a')},f.profile);f.service.request({action:'notificationSubscribe',subscription:subscription('b')},f.profile);
 await Promise.all([f.service.tick(),f.service.tick()]);await f.service.tick();assert.equal(f.sent.length,2);assert.match(f.sent[0].payload.title,/🇺🇸/);
 const history=f.service.request({action:'notificationAdmin'},f.admin).history;assert.equal(history.length,1);assert.match(history[0].result,/angenommen: 2/);
 assert.throws(()=>f.service.request({action:'notificationAdmin'},f.profile),/Admin/);assert.throws(()=>f.service.request({action:'notificationCatalogSave',catalog:{}},f.profile),/Admin/);
 f.setTime(time+86400000);await f.service.tick();assert.equal(f.sent.length,4);
});
test('A completed French round suppresses reminders in every language and does not erase existing study data',async t=>{
 const f=fixture(t);f.service.request({action:'notificationSubscribe',subscription:subscription()},f.profile);
 const session=f.database.request({action:'login',email:f.profile.email});
 f.database.request({action:'push',subject:'french',token:session.token,base:0,ops:[{id:'day',entity:'settings',key:'streak_day_2026-10-15',value:{kind:'streakDay',day:'2026-10-15'},at:time,seq:1,device:'test'}]});
 await f.service.tick();assert.equal(f.sent.length,0);assert.equal(f.service.request({action:'notificationAdmin'},f.admin).history.length,0);
 assert.ok(f.database.request({action:'pull',token:session.token,subject:'french',since:0}).data.settings['streak_day_2026-10-15']);
});
test('Global daily celebration claim is shared by devices and suppresses a reminder before journal upload',async t=>{
 const f=fixture(t);f.service.request({action:'notificationSubscribe',subscription:subscription()},f.profile);
 assert.equal(f.service.request({action:'notificationStreakClaim',day:'2026-10-15'},f.profile).celebrate,true);
 assert.equal(f.service.request({action:'notificationStreakClaim',day:'2026-10-15'},f.profile).celebrate,false);
 await f.service.tick();assert.equal(f.sent.length,0);
});
test('Admin edits, disabled texts, global off and selected time windows are honored',async t=>{
 const f=fixture(t);f.service.request({action:'notificationSubscribe',subscription:subscription()},f.profile);
 const catalog={enabled:false,start:17*60,end:20*60,messages:[{id:'test',subject:'french',text:'Bonjour 🥐',enabled:true}]};
 f.service.request({action:'notificationCatalogSave',catalog},f.admin);await f.service.tick();assert.equal(f.sent.length,0);
 catalog.enabled=true;catalog.start=20*60;catalog.end=21*60;f.service.request({action:'notificationCatalogSave',catalog},f.admin);await f.service.tick();assert.equal(f.sent.length,0);
 f.setTime(Date.parse('2026-10-15T18:30:00Z'));await f.service.tick();assert.equal(f.sent.length,1);assert.equal(f.sent[0].payload.body,'Bonjour 🥐');assert.match(f.sent[0].payload.title,/Vocabify/);
 assert.throws(()=>f.service.request({action:'notificationCatalogSave',catalog:{...catalog,end:23*60}},f.admin),/Zeitfenster/);
});
test('Expired push endpoints are removed; revoked users and device opt-out receive nothing',async t=>{
 const f=fixture(t);f.service.request({action:'notificationSubscribe',subscription:subscription()},f.profile);f.setFailure();await f.service.tick();assert.equal(f.service.request({action:'notificationStatus'},f.profile).devices,0);
 f.service.request({action:'notificationSubscribe',subscription:subscription('new')},f.profile);f.service.request({action:'notificationUnsubscribe',endpoint:subscription('new').endpoint},f.profile);assert.equal(f.service.request({action:'notificationStatus'},f.profile).devices,0);
 f.service.request({action:'notificationSubscribe',subscription:subscription('deleted')},f.profile);f.database.request({action:'profileDelete',profileId:f.profile.id,token});f.setTime(time+86400000);await f.service.tick();assert.equal(f.sent.length,0);
});
test('Notification HTTP actions require a valid session and protect admin editing',async t=>{
 const f=fixture(t),server=apiServer(f.database,undefined,f.service);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const url='http://127.0.0.1:'+server.address().port+'/api',headers={Origin:'https://tiagogt0000.github.io','Content-Type':'application/json'};
 const denied=await fetch(url,{method:'POST',headers,body:JSON.stringify({action:'notificationAdmin'})});assert.equal(denied.status,400);
 const response=await fetch(url,{method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:JSON.stringify({action:'notificationAdmin'})});assert.equal(response.status,200);const body=await response.json();assert.equal(body.result.catalog.messages.length,12);assert.ok(!JSON.stringify(body).includes('private-test'));
 const student=f.database.request({action:'login',email:f.profile.email});const forbidden=await fetch(url,{method:'POST',headers:{...headers,Authorization:'Bearer '+student.token},body:JSON.stringify({action:'notificationAdmin',role:'admin',profile:{id:'admin'}})});assert.equal(forbidden.status,400);
});
test('Timezone day calculations cover midnight and German daylight-saving transitions',()=>{
 assert.equal(localClock(Date.parse('2026-10-15T22:02:00Z'),'Europe/Berlin').day,'2026-10-16');
 assert.equal(localClock(Date.parse('2026-03-29T01:30:00Z'),'Europe/Berlin').minute,210);
 assert.equal(localClock(Date.parse('2026-10-25T01:30:00Z'),'Europe/Berlin').minute,150);
});
test('Keys, subscriptions, edited messages and daily deduplication survive reopening the Pi database',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'latinio-push-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'state.sqlite');
 const f=fixture(t,path);f.service.request({action:'notificationSubscribe',subscription:subscription()},f.profile);
 const catalog={enabled:true,start:17*60,end:20*60,messages:[{id:'mine',subject:'french',text:'Mon petit rappel',enabled:true}]};f.service.request({action:'notificationCatalogSave',catalog},f.admin);await f.service.tick();assert.equal(f.sent.length,1);
 const database=openDatabase(path);t.after(()=>database.close());let keyGeneration=0,sent=0;
 const service=createNotifications(database,{generateVAPIDKeys(){keyGeneration++;throw Error('Must reuse keys');},async sendNotification(){sent++;}},{now:()=>time,random:()=>0});t.after(()=>service.close());
 assert.equal(keyGeneration,0);assert.equal(service.request({action:'notificationStatus'},f.profile).devices,1);assert.equal(service.request({action:'notificationAdmin'},f.admin).catalog.messages[0].text,'Mon petit rappel');await service.tick();assert.equal(sent,0);
});
