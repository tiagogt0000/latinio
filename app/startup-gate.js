// A successful check or an explicit offline choice releases the app.
export class StartupGate extends EventTarget {
  constructor(sync){
    super();this.sync=sync;this.state='open';this.message='';
    sync.addEventListener('change',()=>{if(this.blocked)this.observe();});
  }
  get blocked(){return this.state!=='open';}
  set(state,message=''){
    if(this.state===state&&this.message===message)return;
    this.state=state;this.message=message;this.dispatchEvent(new Event('change'));
  }
  observe(){
    const {status,message,remote}=this.sync;
    if(status==='error'||status==='offline'){this.set('error',message);return;}
    if(status==='loading'){this.set('loading',message);return;}
    if(remote){this.set('newer');return;}
    if(status==='synced'){this.set('open');return;}
    if(status==='unconfigured'){this.set('open');return;}
    this.set('checking',message);
  }
  begin(){
    if(!this.sync.configured){this.set('open');return;}
    this.set('checking','Dein Gerät wird mit dem Cloud-Stand abgeglichen.');
    if(this.sync.remote){this.set('newer');return;}
    // An already running check must finish before access is granted.
    void this.sync.run();
  }
  fail(message){this.set('error',message);}
  continueOffline(){if(this.state==='error')this.set('open');}
}
