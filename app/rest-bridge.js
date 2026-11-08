// Keep the native fetch receiver: Safari rejects window.fetch called as a
// method of RestBridge rather than of Window.
function connectionError(cause,{timedOut,aborted}) {
  const code=timedOut?'timeout':aborted?'cancelled':'network';
  const message=timedOut?'Die Cloud antwortet zu langsam. Dein lokaler Lernstand bleibt erhalten.':aborted?'Die Cloud-Verbindung wurde geändert.':globalThis.navigator?.onLine===false?'Du bist offline. Dein Lernstand bleibt auf diesem Gerät gespeichert.':'Die Cloud-Verbindung ist gerade nicht erreichbar. Dein lokaler Lernstand bleibt erhalten.';
  return Object.assign(new Error(message,{cause}),{code});
}
export class RestBridge {
  constructor(url,token,{fetchImpl=(...args)=>globalThis.fetch(...args)}={}) {
    this.url=url;this.token=token;this.fetchImpl=fetchImpl;
    const parsed=new URL(url);
    if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw Error('HTTPS-Endpunkt erforderlich.');
    this.controllers=new Set();
  }
  async request(action,payload={}) {
    const controller=new AbortController();this.controllers.add(controller);
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort();},['grammarGenerate','grammarGrade','grammarReview'].includes(action)?100000:30000);
    try {
      const headers={'Content-Type':'application/json'};
      if(this.token)headers.Authorization='Bearer '+this.token;
      let response,body;
      try {
        response=await this.fetchImpl(this.url,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
          headers,body:JSON.stringify({...payload,action}),signal:controller.signal});
      } catch(error) { throw connectionError(error,{timedOut,aborted:controller.signal.aborted}); }
      try { body=await response.json(); }
      catch(error) {
        if(timedOut||controller.signal.aborted||error instanceof TypeError)throw connectionError(error,{timedOut,aborted:controller.signal.aborted});
        throw Object.assign(new Error('Die Cloud hat keine gültige Antwort gesendet. Bitte versuche es erneut.',{cause:error}),{code:'invalid-response'});
      }
      if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(new Error('Die Cloud hat keine gültige Antwort gesendet. Bitte versuche es erneut.'),{code:'invalid-response'});
      if(!response.ok || body.error)throw Error(body.error || 'Der Server antwortet nicht richtig.');
      return body.result;
    } finally {clearTimeout(timer);this.controllers.delete(controller);}
  }
  destroy(){for(const controller of this.controllers)controller.abort();this.controllers.clear();}
}
