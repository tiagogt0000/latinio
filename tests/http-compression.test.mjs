import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {gunzipSync} from 'node:zlib';
import {apiServer} from '../server/http.mjs';

const origin='https://tiagogt0000.github.io';
async function fixture(t){
  const result={version:900,data:{collections:{lesson:{id:'lesson',name:'Lektion ÄÖÜ'}},words:Object.fromEntries(Array.from({length:500},(_,i)=>['word'+i,{id:'word'+i,collectionId:'lesson',front:'amicus',back:'Freund'}]))}};
  const server=apiServer({ready:()=>true,request:()=>result});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  function call(encoding){return new Promise((resolve,reject)=>{
    const headers={Origin:origin,'Content-Type':'application/json'};
    if(encoding!==undefined)headers['Accept-Encoding']=encoding;
    const req=request({hostname:'127.0.0.1',port:server.address().port,path:'/api',method:'POST',headers},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);
    });req.on('error',reject);req.end(JSON.stringify({action:'pull',since:0}));
  });}
  return {result,call};
}
test('large cloud replies are compressed on the wire and restore every collection and word',async t=>{
  const {result,call}=await fixture(t),response=await call('gzip, deflate, br');
  assert.equal(response.status,200);assert.equal(response.headers['content-encoding'],'gzip');
  assert.equal(Number(response.headers['content-length']),response.body.length);
  assert.match(response.headers.vary,/Origin/);assert.match(response.headers.vary,/Accept-Encoding/);
  assert.equal(response.headers['cache-control'],'no-store');
  const decoded=gunzipSync(response.body);assert.deepEqual(JSON.parse(decoded),{result});
  assert.ok(response.body.length<decoded.length/4);
});
test('clients that decline gzip retain the exact existing JSON response',async t=>{
  const {result,call}=await fixture(t);
  for(const encoding of [undefined,'identity','br','gzip;q=0','*;q=1, gzip;q=0','gzip;q=invalid']){
    const response=await call(encoding);assert.equal(response.headers['content-encoding'],undefined);
    assert.equal(Number(response.headers['content-length']),response.body.length);
    assert.deepEqual(JSON.parse(response.body),{result});
  }
  for(const encoding of ['gzip;q=0.5','*;q=1']){
    const response=await call(encoding);assert.equal(response.headers['content-encoding'],'gzip');
    assert.deepEqual(JSON.parse(gunzipSync(response.body)),{result});
  }
});
