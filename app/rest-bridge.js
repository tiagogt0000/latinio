// Keep the native fetch receiver: Safari rejects window.fetch called as a
// method of RestBridge rather than of Window.
export class RestBridge {
  constructor(url,token,{fetchImpl=(...args)=>globalThis.fetch(...args)}={}) {
    this.url=url;this.token=token;this.fetchImpl=fetchImpl;
    const parsed=new URL(url);
    if(parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw Error('HTTPS-Endpunkt erforderlich.');
    this.controllers=new Set();
  }
  async request(action,payload={}) {
    const controller=new AbortController();this.controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),['grammarGenerate','grammarGrade','grammarReview'].includes(action)?100000:30000);
    try {
      const headers={'Content-Type':'application/json'};
      if(this.token)headers.Authorization='Bearer '+this.token;
      const response=await this.fetchImpl(this.url,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
        headers,body:JSON.stringify({...payload,action}),signal:controller.signal});
      const body=await response.json();
      if(!response.ok || body.error)throw Error(body.error || 'Der Server antwortet nicht richtig.');
      return body.result;
    } finally {clearTimeout(timer);this.controllers.delete(controller);}
  }
  destroy(){for(const controller of this.controllers)controller.abort();this.controllers.clear();}
}
