import {createHash,randomInt,randomUUID} from 'node:crypto';

export const defaultMessages=[
 ['english','Frau Clodius wäre stolz auf dich. Fünf Minuten Englisch? 🇺🇸'],
 ['english','Your vocabulary misses you. Komm, eine kleine Runde geht noch 🥺'],
 ['english','Plot twist: Heute gewinnst du gegen die unregelmäßigen Verben. 🇺🇸'],
 ['latin','Deine Vokabeln warten schon länger als Caesar auf den Senat. Eine Runde? 🏛️'],
 ['latin','Carpe diem … und vielleicht fünf Vokabeln. Deine Flamme zählt auf dich 🥺'],
 ['latin','Auch Rom wurde nicht an einem Tag gelernt. Aber heute geht ein kleines Stück. 🇻🇦'],
 ['french','Bonjour! Deine Vokabeln hätten gern ein kleines Rendezvous. 🇫🇷'],
 ['french','Ein Croissant fürs Gehirn? Fünf Minuten Französisch, s’il te plaît 🥐'],
 ['french','Dein Französisch wartet. Très traurig ohne dich 🥺'],
 ['all','Deine Streak-Flamme hat die Kuscheldecke bereit. Wärmst du sie kurz auf? 🔥'],
 ['all','Nur eine kleine Runde. Deine zukünftige Klassenarbeit sagt schon mal danke. ✨'],
 ['all','Die Vokabeln haben nach dir gefragt. Ich hab gesagt, du kommst gleich 🥺']
].map(([subject,text],i)=>({id:'starter-'+i,subject,text,enabled:true}));
export function localClock(now,zone='Europe/Berlin'){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));
 return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};
}
export function validSubscription(sub){
 let url;try{url=new URL(sub?.endpoint);}catch{throw Error('Ungültige Push-Adresse.');}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||sub.endpoint.length>2500||!(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com')))throw Error('Dieser Push-Dienst wird nicht unterstützt.');
 const keys=sub.keys||{};
 if(!/^[\w-]{87}$/.test(keys.p256dh||'')||!/^[\w-]{22}$/.test(keys.auth||'')||Buffer.from(keys.p256dh,'base64url').length!==65||Buffer.from(keys.p256dh,'base64url')[0]!==4)throw Error('Ungültige Push-Schlüssel.');
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function createNotifications(database,transport,{now=Date.now,random=randomInt}={}){
 const db=database.db;
 db.exec(`CREATE TABLE IF NOT EXISTS notification_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_devices(endpoint TEXT PRIMARY KEY,profile TEXT NOT NULL,subscription TEXT NOT NULL,zone TEXT NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS notification_daily(profile TEXT NOT NULL,day TEXT NOT NULL,minute INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(profile,day));
 CREATE TABLE IF NOT EXISTS notification_history(id TEXT PRIMARY KEY,profile TEXT NOT NULL,name TEXT NOT NULL,at INTEGER NOT NULL,subject TEXT NOT NULL,text TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS streak_celebrations(profile TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(profile,day));`);
 const get=key=>{const v=db.prepare('SELECT value FROM notification_meta WHERE key=?').get(key);return v?JSON.parse(v.value):null;};
 const put=(key,value)=>db.prepare('INSERT OR REPLACE INTO notification_meta VALUES(?,?)').run(key,JSON.stringify(value));
 if(!get('vapid'))put('vapid',transport.generateVAPIDKeys());
 if(!get('catalog'))put('catalog',{enabled:true,start:17*60,end:20*60+30,messages:defaultMessages});
 const vapid=get('vapid');let running=false;
 const learned=(person,day)=>person.days.includes(day)||!!db.prepare('SELECT 1 FROM streak_celebrations WHERE profile=? AND day=?').get(person.id,day);
 const status=profile=>({publicKey:vapid.publicKey,enabled:get('catalog').enabled,devices:db.prepare('SELECT count(*) n FROM notification_devices WHERE profile=?').get(profile.id).n});
 function request(body,profile){
  const action=body.action;
  if(action==='notificationStatus')return status(profile);
  if(action==='notificationSubscribe'){
   const subscription=validSubscription(body.subscription),zone=String(body.zone||'Europe/Berlin');try{localClock(now(),zone);}catch{throw Error('Ungültige Zeitzone.');}
   if(!db.prepare('SELECT 1 FROM notification_devices WHERE endpoint=? AND profile=?').get(subscription.endpoint,profile.id)&&status(profile).devices>=5)throw Error('Du hast bereits fünf Geräte für Erinnerungen aktiviert.');
   db.prepare('INSERT OR REPLACE INTO notification_devices VALUES(?,?,?,?,?)').run(subscription.endpoint,profile.id,JSON.stringify(subscription),zone,now());return status(profile);
  }
  if(action==='notificationUnsubscribe'){if(typeof body.endpoint!=='string')throw Error('Push-Adresse fehlt.');db.prepare('DELETE FROM notification_devices WHERE profile=? AND endpoint=?').run(profile.id,body.endpoint);return status(profile);}
  if(action==='notificationStreakClaim'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(body.day||''))throw Error('Ungültiger Lerntag.');
   if(Math.abs(Date.parse(body.day+'T12:00:00Z')-now())>36*3600000)throw Error('Ungültiger Lerntag.');
   return {celebrate:db.prepare('INSERT OR IGNORE INTO streak_celebrations VALUES(?,?)').run(profile.id,body.day).changes===1};
  }
  if(profile.role!=='admin')throw Error('Nur für den Admin.');
  if(action==='notificationAdmin')return {catalog:get('catalog'),history:db.prepare('SELECT * FROM notification_history ORDER BY at DESC LIMIT 200').all(),deviceCount:db.prepare('SELECT count(*) n FROM notification_devices').get().n};
  if(action==='notificationCatalogSave'){
   const c=body.catalog;
   if(!c||typeof c.enabled!=='boolean'||!Number.isInteger(c.start)||!Number.isInteger(c.end)||c.start<8*60||c.end>21*60||c.end<=c.start||!Array.isArray(c.messages)||c.messages.length>120)throw Error('Bitte ein Zeitfenster zwischen 08:00 und 21:00 Uhr und höchstens 120 Texte wählen.');
   const ids=new Set();const messages=c.messages.map(m=>{if(!m||typeof m.id!=='string'||!/^[\w-]{1,80}$/.test(m.id)||ids.has(m.id)||!['latin','english','french','all'].includes(m.subject)||typeof m.text!=='string'||!m.text.trim()||m.text.length>240||typeof m.enabled!=='boolean')throw Error('Ein Nachrichtentext ist ungültig.');ids.add(m.id);return {id:m.id,subject:m.subject,text:m.text.trim(),enabled:m.enabled};});
   put('catalog',{enabled:c.enabled,start:c.start,end:c.end,messages});return {saved:true};
  }
  throw Error('Unbekannte Benachrichtigungsaktion.');
 }
 async function tick(){
  if(running||!database.ready())return;running=true;
  try{
   const config=get('catalog');if(!config.enabled)return;
   db.prepare('DELETE FROM notification_devices WHERE updated<?').run(now()-90*86400000);
   db.prepare('DELETE FROM notification_daily WHERE day<?').run(new Date(now()-40*86400000).toISOString().slice(0,10));
   db.prepare('DELETE FROM notification_history WHERE at<?').run(now()-90*86400000);
   const devices=db.prepare('SELECT * FROM notification_devices ORDER BY updated DESC').all(),snapshot=database.notificationSnapshot();
   for(const profileId of new Set(devices.map(d=>d.profile))){
    const person=snapshot.find(p=>p.id===profileId);if(!person)continue;
    const targets=devices.filter(d=>d.profile===profileId),{day,minute}=localClock(now(),targets[0].zone);
    db.prepare('INSERT OR IGNORE INTO notification_daily VALUES(?,?,?,?)').run(profileId,day,config.start+random(config.end-config.start+1),'waiting');
    const job=db.prepare('SELECT * FROM notification_daily WHERE profile=? AND day=?').get(profileId,day);
    if(job.state!=='waiting')continue;
    if(learned(person,day)){db.prepare("UPDATE notification_daily SET state='learned' WHERE profile=? AND day=?").run(profileId,day);continue;}
    if(minute<Math.max(job.minute,config.start)||minute>config.end)continue;
    const choices=config.messages.filter(m=>m.enabled&&(m.subject==='all'||person.subjects.includes(m.subject)));if(!choices.length)continue;
    const message=choices[random(choices.length)],subject=message.subject==='all'?person.subjects[0]:message.subject;
    // Reserve before I/O. A restart never produces a second reminder for this day.
    const claimed=db.prepare("UPDATE notification_daily SET state='sending' WHERE profile=? AND day=? AND state='waiting'").run(profileId,day);if(!claimed.changes)continue;
    const logId=randomUUID();db.prepare('INSERT INTO notification_history VALUES(?,?,?,?,?,?,?)').run(logId,profileId,person.name,now(),subject,message.text,'Versand gestartet');
    let accepted=0,failed=0;
    for(const target of targets){
     const fresh=database.notificationSnapshot().find(p=>p.id===profileId);if(!fresh||learned(fresh,day)||!fresh.subjects.includes(subject)||!get('catalog').enabled)break;
     if(!db.prepare('SELECT 1 FROM notification_devices WHERE endpoint=? AND profile=?').get(target.endpoint,profileId))continue;
     const payload={title:subject==='french'?'🇫🇷 Vocabify':subject==='english'?'🇺🇸 Latinio · Englisch':'🇻🇦 Latinio · Latein',body:message.text,tag:'latinio-learn-'+day,url:'./?subject='+subject,day};
     try{await transport.sendNotification(JSON.parse(target.subscription),JSON.stringify(payload),{vapidDetails:{subject:'https://tiagogt0000.github.io/latinio/',...vapid},TTL:1800,timeout:10000,urgency:'normal',topic:createHash('sha256').update(profileId+day).digest('base64url').slice(0,32)});accepted++;}
     catch(error){failed++;if([404,410].includes(error.statusCode))db.prepare('DELETE FROM notification_devices WHERE endpoint=?').run(target.endpoint);}
    }
    db.prepare('UPDATE notification_history SET result=? WHERE id=?').run(accepted?`Push-Dienst hat angenommen: ${accepted}${failed?'; Fehler: '+failed:''}`:failed?'Versand fehlgeschlagen':'Vor Versand übersprungen',logId);
    db.prepare("UPDATE notification_daily SET state='finished' WHERE profile=? AND day=?").run(profileId,day);
   }
  }finally{running=false;}
 }
 const timer=setInterval(()=>void tick().catch(()=>{}),60000);timer.unref();
 return {request,tick,close:()=>clearInterval(timer),ready:true};
}
