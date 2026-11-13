// Original AAC effects supplied by the owner. Each action gets its own voice:
// starting another effect must never stop, rewind or replace an earlier one.
export const LANDSCAPE_SOUNDS=Object.freeze(Object.fromEntries(
  ['select','start','right','wrong'].map(kind=>[kind,new URL(`./assets/landscape/${kind}.m4a`,import.meta.url).href])
));

export function createLandscapeAudio({
  AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,
  Audio=globalThis.Audio,
  fetchImpl=(...args)=>globalThis.fetch(...args),
  urls=LANDSCAPE_SOUNDS
}={}){
  let context=null,unavailable=false;
  const buffers=new Map(),voices=new Set();
  function unlock(){
    if(!context&&!unavailable&&AudioContext){
      try{context=new AudioContext();}catch{unavailable=true;}
    }
    // Invoke resume in the user's event, before waiting for fetch/decode.
    if(context?.state==='suspended'){
      try{Promise.resolve(context.resume()).catch(()=>{});}catch{}
    }
    return context;
  }
  function load(kind){
    if(!context||!urls[kind])return Promise.resolve(null);
    if(!buffers.has(kind)){
      const task=Promise.resolve().then(()=>fetchImpl(urls[kind]))
        .then(response=>{if(!response.ok)throw Error('Sound nicht verfügbar');return response.arrayBuffer();})
        .then(bytes=>context.decodeAudioData(bytes))
        .catch(()=>{buffers.delete(kind);return null;});
      buffers.set(kind,task);
    }
    return buffers.get(kind);
  }
  function fallback(kind){
    if(!Audio)return false;
    try{
      const voice=new Audio(urls[kind]);
      voices.add(voice);
      const release=()=>voices.delete(voice);
      voice.addEventListener?.('ended',release,{once:true});
      voice.addEventListener?.('error',release,{once:true});
      Promise.resolve(voice.play()).catch(release);
      return true;
    }catch{return false;}
  }
  function warm(){
    if(!unlock())return Promise.resolve([]);
    return Promise.all(Object.keys(urls).map(load));
  }
  function play(kind){
    if(!Object.hasOwn(urls,kind))return Promise.resolve(false);
    if(!unlock())return Promise.resolve(fallback(kind));
    return load(kind).then(buffer=>{
      if(!buffer)return fallback(kind);
      try{
        const voice=context.createBufferSource();
        voice.buffer=buffer;
        voice.connect(context.destination);
        voices.add(voice);
        voice.onended=()=>{voices.delete(voice);try{voice.disconnect();}catch{}};
        voice.start(0);
        return true;
      }catch{return fallback(kind);}
    }).catch(()=>false);
  }
  return {play,warm,get activeVoices(){return voices.size;}};
}

let shared;
function player(){return shared||=(createLandscapeAudio());}
export const playLandscapeSound=kind=>player().play(kind);
export const warmLandscapeAudio=()=>player().warm();
