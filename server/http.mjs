import {createServer} from 'node:http';

export function apiServer(database, origin = 'https://tiagogt0000.github.io', notifications = null, grammar = null) {
  return createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const reply = (status,body) => {
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify(body));
    };
    if (req.url === '/health' && req.method === 'GET') return reply(database.ready()?200:503,{ready:database.ready(),studentCodesRequired:database.studentCodesRequired===true,autoSharingEnabled:database.autoSharingEnabled===true,frenchEnabled:database.frenchEnabled===true,pushReady:notifications?.ready===true,grammarReady:grammar?.ready===true});
    if (req.headers.origin !== origin) return reply(403,{error:'Herkunft nicht erlaubt.'});
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    if (req.url !== '/api') return reply(404,{error:'Nicht gefunden.'});
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods','POST');
      res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age','600');
      res.writeHead(204); return res.end();
    }
    if (req.method !== 'POST') return reply(405,{error:'POST erforderlich.'});
    if (!database.ready()) return reply(503,{error:'Datenübernahme noch nicht abgeschlossen.'});
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) return reply(415,{error:'JSON erforderlich.'});
    try {
      const chunks=[];let size=0;
      for await (const chunk of req) {
        size+=chunk.length;
        if (size>12000000) { reply(413,{error:'Anfrage zu groß.'}); req.resume(); return; }
        chunks.push(chunk);
      }
      let body;
      try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reply(400,{error:'Ungültiges JSON.'}); }
      if (!body || Array.isArray(body) || typeof body.action !== 'string') return reply(400,{error:'Ungültige Anfrage.'});
      const token=(req.headers.authorization||'').match(/^Bearer ([a-zA-Z0-9_-]{32,200})$/)?.[1] || '';
      try {
        if(body.action.startsWith('grammar')){
          const identity=database.request({action:'whoami',token}).profile;
          if(identity.role!=='admin')return reply(403,{error:'Nur für den Admin.'});
          if(!grammar)throw Error('Bitte zuerst das neue Pi-Backend für Grammatik installieren.');
          return reply(200,{result:await grammar.request(body,identity)});
        }
        if(body.action.startsWith('notification')){
          if(!notifications)throw Error('Benachrichtigungen sind noch nicht eingerichtet.');
          const identity=database.request({action:'whoami',token}).profile;
          return reply(200,{result:await notifications.request(body,identity)});
        }
        reply(200,{result:database.request({...body,token})});
      }
      catch (error) { reply(400,{error:error.message}); }
    } catch { if (!res.headersSent) reply(400,{error:'Anfrage abgebrochen.'}); }
  });
}
