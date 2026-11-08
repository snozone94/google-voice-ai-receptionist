import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createRecordingPlayback} from '../src/recording-playback.js';
const audio=Buffer.from('ID3 synthetic recording bytes 0123456789');
async function setup(t,options={}){
 let fetches=0;
 const app=express(),play=createRecordingPlayback({fetcher:async()=>{fetches++;return new Response(audio,{headers:{'Content-Type':'audio/mpeg'}});},...options});
 app.get('/recording',async(req,res,next)=>{try{await play(req,res,'https://provider.invalid/private.mp3');}catch(e){next(e);}});
 app.use((e,_req,res,_next)=>res.status(e.status||502).json({error:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return {url:`http://127.0.0.1:${server.address().port}/recording`,get fetches(){return fetches;}};
}
test('serves native Apple initial byte probe, full bytes and seeking consistently',async t=>{
 const f=await setup(t);const probe=await fetch(f.url,{headers:{Range:'bytes=0-1'}});
 assert.equal(probe.status,206);assert.equal(probe.headers.get('Content-Range'),`bytes 0-1/${audio.length}`);assert.equal(probe.headers.get('Content-Length'),'2');assert.deepEqual(Buffer.from(await probe.arrayBuffer()),audio.subarray(0,2));
 const seek=await fetch(f.url,{headers:{Range:'bytes=10-'}});assert.equal(seek.status,206);assert.deepEqual(Buffer.from(await seek.arrayBuffer()),audio.subarray(10));
 const all=await fetch(f.url);assert.equal(all.headers.get('Accept-Ranges'),'bytes');assert.equal(all.headers.get('Content-Type'),'audio/mpeg');assert.equal(all.headers.get('Content-Length'),String(audio.length));assert.equal(all.headers.get('Cache-Control'),'no-store, private');assert.deepEqual(Buffer.from(await all.arrayBuffer()),audio);assert.equal(f.fetches,1);
});
test('supports suffix, clamped ranges and HEAD without sending a body',async t=>{const f=await setup(t);for(const [range,expected] of [['bytes=-4',audio.subarray(-4)],['bytes=3-9999',audio.subarray(3)]]){const r=await fetch(f.url,{headers:{Range:range}});assert.equal(r.status,206);assert.deepEqual(Buffer.from(await r.arrayBuffer()),expected);}const head=await fetch(f.url,{method:'HEAD'});assert.equal(head.headers.get('Content-Length'),String(audio.length));assert.equal((await head.arrayBuffer()).byteLength,0);});
test('rejects invalid or unsatisfiable byte ranges with the real total length',async t=>{const f=await setup(t);for(const range of ['bytes=9999-','bytes=9-3','bytes=-0','bytes=0-1,3-4','bytes=-']){const r=await fetch(f.url,{headers:{Range:range}});assert.equal(r.status,416);assert.equal(r.headers.get('Content-Range'),`bytes */${audio.length}`);assert.equal((await r.arrayBuffer()).byteLength,0);}});
test('deduplicates parallel probes and refetches expired private cache',async t=>{let time=0;const f=await setup(t,{now:()=>time,cacheMs:100});await Promise.all([fetch(f.url),fetch(f.url),fetch(f.url)]);assert.equal(f.fetches,1);time=101;await fetch(f.url);assert.equal(f.fetches,2);});
test('provider failures and oversized bodies fail without serving misleading audio',async t=>{const huge=await setup(t,{maxBytes:3});assert.equal((await fetch(huge.url)).status,413);const missing=await setup(t,{fetcher:async()=>new Response('Not found',{status:404})});assert.equal((await fetch(missing.url)).status,404);const empty=await setup(t,{fetcher:async()=>new Response(new Uint8Array())});assert.equal((await fetch(empty.url)).status,502);});
