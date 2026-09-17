import {GoogleBridge} from './sync.js';
import {Store} from './store.js';
import {CLOUD_URL} from './cloud-config.js';
const ACTIVE='latinio-account-v2',MIGRATED='latinio-account-migrated-v2';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function openAccount(root){
  let active;try{active=JSON.parse(localStorage.getItem(ACTIVE));}catch{}
  if(active?.id){
    const store=await new Store().open(active.id);
    if(store.doc.config.token){if(CLOUD_URL)await store.update(doc=>{doc.config.url=CLOUD_URL;return doc;});return {store,profile:active};}
    store.close();
  }
  const legacy=await new Store().open('admin');
  const endpoint=CLOUD_URL||legacy.doc.config.url;
  // Only an existing, previously configured device migrates without logging in again.
  if(!localStorage.getItem(MIGRATED)&&legacy.doc.config.token&&legacy.doc.config.url){
    const profile={id:'admin',role:'admin',name:'Admin'};localStorage.setItem(ACTIVE,JSON.stringify(profile));localStorage.setItem(MIGRATED,'1');return {store:legacy,profile};
  }
  legacy.close();
  return new Promise(resolve=>{
    let admin=false,busy=false;
    function show(){root.innerHTML=`<main class="login-shell"><div class="brand">latinio<span>✦</span></div><h1>${admin?'Admin-Anmeldung':'Willkommen bei Latinio'}</h1><p class="muted">${admin?'Gib deinen Admin-PIN ein.':'Gib deine freigeschaltete Schüler-E-Mail ein.'}</p><form id="account-login"><label>${admin?'Admin-PIN':'E-Mail-Adresse'}<input name="credential" type="${admin?'password':'email'}" ${admin?'inputmode="numeric" minlength="4" maxlength="12" autocomplete="off"':'autocomplete="email" autocapitalize="none"'} required></label><button class="button primary wide" type="submit">Anmelden</button><p role="status" id="login-status"></p></form><button class="text-button" id="login-toggle">${admin?'Zur Schüler-Anmeldung':'Admin'}</button></main>`;
      root.querySelector('#login-toggle').onclick=()=>{if(!busy){admin=!admin;show();}};
      root.querySelector('form').onsubmit=async event=>{
        event.preventDefault();event.stopPropagation();if(busy)return;busy=true;
        const form=event.currentTarget,status=root.querySelector('#login-status');form.querySelector('button').disabled=true;status.textContent='Anmeldung läuft …';
        let bridge;
        try{
          if(!endpoint)throw Error('Die neue Cloud-Verbindung wird noch eingerichtet.');
          if(!navigator.onLine)throw Error('Für die erste Anmeldung auf diesem Gerät brauchst du Internet.');
          bridge=new GoogleBridge(endpoint,'');const value=new FormData(form).get('credential').trim();
          const result=await bridge.request('login',admin?{admin:true,pin:value}:{email:value});
          const store=await new Store().open(result.profile.id);
          await store.update(doc=>{doc.config={url:endpoint,token:result.token};doc.profile=result.profile;doc.seeded=true;return doc;});
          localStorage.setItem(ACTIVE,JSON.stringify(result.profile));localStorage.setItem(MIGRATED,'1');resolve({store,profile:result.profile});
        }catch(error){status.textContent=error.message;form.querySelector('button').disabled=false;busy=false;}
        finally{bridge?.destroy();}
      };
    }
    show();
  });
}
export function signOut(){localStorage.removeItem(ACTIVE);localStorage.setItem(MIGRATED,'1');location.reload();}
export function accountCard(profile){return `<section class="card"><h2>Dein Profil</h2><p>${h(profile.name)}</p><p class="small muted">${profile.role==='admin'?'Administrator':h(profile.email)}</p>${profile.role==='admin'?'<button class="button secondary wide" data-action="account-profiles">Profile verwalten</button>':''}<button class="text-button" data-action="account-logout">Abmelden</button><p class="small muted">Lokale Lernstände bleiben auf diesem Gerät erhalten.</p></section>`;}
