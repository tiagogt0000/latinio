import test from 'node:test';
import assert from 'node:assert/strict';
import {createLandscapeAudio,LANDSCAPE_SOUNDS} from '../app/landscape-audio.js';

function setup(){
  const sources=[],fetches=[],order=[];
  class Context{
    constructor(){this.state='suspended';this.destination={};}
    resume(){order.push('resume');this.state='running';return Promise.resolve();}
    decodeAudioData(bytes){return Promise.resolve({bytes});}
    createBufferSource(){
      const source={starts:0,stops:0,connect(){},disconnect(){this.disconnected=true;},start(){this.starts++;},stop(){this.stops++;}};
      sources.push(source);return source;
    }
  }
  const audio=createLandscapeAudio({AudioContext:Context,Audio:null,fetchImpl:async url=>{
    order.push('fetch');fetches.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
  }});
  return {audio,sources,fetches,order};
}

test('selection and start overlap, with independent same-effect voices',async()=>{
  const {audio,sources,fetches,order}=setup();
  await Promise.all([audio.play('select'),audio.play('start'),audio.play('select')]);
  assert.equal(sources.length,3);
  assert.equal(audio.activeVoices,3);
  assert(sources.every(source=>source.starts===1&&source.stops===0));
  assert.equal(fetches.filter(url=>url===LANDSCAPE_SOUNDS.select).length,1);
  assert.equal(order[0],'resume');
  sources[0].onended();
  assert.equal(audio.activeVoices,2);
  assert.equal(sources[0].disconnected,true);
  assert.equal(sources[1].stops,0);
});

test('warming decodes effects without playing them or blocking actions',async()=>{
  const {audio,sources,fetches}=setup();
  await audio.warm();
  assert.equal(fetches.length,4);
  assert.equal(sources.length,0);
  await audio.play('right');await audio.play('wrong');
  assert.equal(fetches.length,4);
  assert.equal(sources.length,2);
});

test('unsupported audio and network errors remain nonfatal and retryable',async()=>{
  let attempts=0;
  class Context{constructor(){this.state='running';}decodeAudioData(){return Promise.resolve({});}}
  const audio=createLandscapeAudio({AudioContext:Context,Audio:null,fetchImpl:async()=>{attempts++;throw Error('offline');}});
  assert.equal(await audio.play('right'),false);
  assert.equal(await audio.play('right'),false);
  assert.equal(attempts,2);
  assert.equal(await audio.play('__proto__'),false);
});

test('HTML audio fallback never reuses or pauses an earlier element',async()=>{
  const elements=[];
  class Audio{constructor(url){this.url=url;this.pauses=0;elements.push(this);}addEventListener(){}play(){return Promise.resolve();}pause(){this.pauses++;}}
  const audio=createLandscapeAudio({AudioContext:null,Audio});
  await audio.play('select');await audio.play('start');await audio.play('start');
  assert.equal(elements.length,3);
  assert(elements.every(el=>el.pauses===0));
});
