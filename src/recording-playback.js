// AVPlayer probes and seeks with byte ranges. Keep recording bodies private and
// bounded; signed-link authorization remains in the route before this handler.
export function createRecordingPlayback({fetcher, maxBytes=32*1024*1024, cacheBytes=16*1024*1024, cacheMs=90000, now=Date.now}) {
  const cache=new Map(),pending=new Map();let storedBytes=0;
  function prune(){for(const [key,item] of cache)if(item.expires<=now()){storedBytes-=item.body.length;cache.delete(key);}}
  async function load(url){
    prune();if(cache.has(url))return cache.get(url).body;
    if(pending.has(url))return pending.get(url);
    if(pending.size>=4)throw Object.assign(Error('Please try the recording again shortly.'),{status:503});
    const work=(async()=>{
      const response=await fetcher(url);
      if(!response.ok||!response.body)throw Object.assign(Error('Recording unavailable. Please open it again shortly.'),{status:response.status===404?404:502});
      const length=Number(response.headers.get('content-length'));
      if(length>maxBytes){await response.body.cancel();throw Object.assign(Error('This recording is too large for playback.'),{status:413});}
      const reader=response.body.getReader();let total=0;const chunks=[];
      try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw Object.assign(Error('This recording is too large for playback.'),{status:413});chunks.push(Buffer.from(value));}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
      if(!total)throw Object.assign(Error('Recording is not ready yet.'),{status:502});
      const body=Buffer.concat(chunks,total);
      if(total<=cacheBytes){while(storedBytes+total>cacheBytes&&cache.size){const key=cache.keys().next().value;storedBytes-=cache.get(key).body.length;cache.delete(key);}cache.set(url,{body,expires:now()+cacheMs});storedBytes+=total;}
      return body;
    })();pending.set(url,work);
    try{return await work;}finally{pending.delete(url);}
  }
  return async function playback(req,res,url){
    const body=await load(url),length=body.length;
    res.set({'Cache-Control':'no-store, private','Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Content-Disposition':'inline; filename="ddd-recording.mp3"'});
    let start=0,end=length-1;
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match||(!match[1]&&!match[2]))return res.status(416).set('Content-Range',`bytes */${length}`).end();
      if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return res.status(416).set('Content-Range',`bytes */${length}`).end();start=Math.max(0,length-suffix);}
      else{start=Number(match[1]);if(match[2])end=Math.min(length-1,Number(match[2]));}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=length||end<start)return res.status(416).set('Content-Range',`bytes */${length}`).end();
      res.status(206).set('Content-Range',`bytes ${start}-${end}/${length}`);
    }
    res.set('Content-Length',String(end-start+1));
    if(req.method==='HEAD')return res.end();
    return res.end(body.subarray(start,end+1));
  };
}
