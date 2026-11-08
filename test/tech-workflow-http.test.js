import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountTechWorkflow } from '../src/tech-workflow.js';

test('Dispatch HTTP bridge shares canonical notes and personal responses without sending customer SMS', async t => {
  const notes = [], answers = new Map();
  const upstream = async (url, options) => {
    const code = options.headers['X-DDD-Tech-Token'];
    const id = { 'individual-a': 'a', 'individual-b': 'b' }[code];
    if (!id) return Response.json({}, { status: 401 });
    const pathname = new URL(url).pathname;
    if (pathname.endsWith('/team')) return Response.json({ current_tech_id: id, owner: false, technicians: [{ id:'a',name:'A',availability:'available' },{ id:'b',name:'B',availability:'on_call' }] });
    if (pathname.endsWith('/response')) {
      const { action } = JSON.parse(options.body); answers.set(id, { read: true, response: action === 'read' ? '' : action }); return Response.json({ ok:true });
    }
    if (options.method === 'POST') { const data=JSON.parse(options.body);notes.unshift({ ...data, id:'note_shared', sender_tech_id:id, customer_visible:false });return Response.json({ ok:true }); }
    return Response.json({ notes:notes.map(n=>({...n,...answers.get(id)})) });
  };
  const app=express();
  const auth=(req,res,next)=>{const code=req.get('x-staff-code');if(!['individual-a','individual-b'].includes(code))return res.status(403).json({error:'Sign in'});res.locals.staff={role:'tech'};next();};
  mountTechWorkflow(app,{staffOnly:auth,authUrl:'https://wordpress.invalid/wp-json/ddd/v1/tech-auth-test',fetchImpl:upstream});
  const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(code,path,body)=>fetch(base+path,{method:body?'POST':'GET',headers:{'X-Staff-Code':code,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('invalid','/api/tech-workflow/inbox')).status,403);
  // A note created through the Tech Assist WordPress endpoint is immediately the Dispatch source too.
  await upstream('https://wordpress.invalid/wp-json/ddd/v1/tech-workflow/inbox',{method:'POST',headers:{'X-DDD-Tech-Token':'individual-a'},body:JSON.stringify({message:'Need backup',type:'tech_ping'})});
  let inbox=await(await request('individual-b','/api/tech-workflow/inbox')).json();assert.equal(inbox.notes[0].message,'Need backup');
  assert.equal((await request('individual-b','/api/tech-workflow/inbox/note_shared/response',{action:'accept'})).status,200);
  inbox=await(await upstream('https://wordpress.invalid/wp-json/ddd/v1/tech-workflow/inbox',{method:'GET',headers:{'X-DDD-Tech-Token':'individual-b'}})).json();assert.equal(inbox.notes[0].response,'accept');
  const otherInbox=await(await request('individual-a','/api/tech-workflow/inbox')).json();assert.equal(otherInbox.notes[0].response,undefined);
  assert.equal((await request('individual-a','/api/tech-workflow/inbox',{message:'Team note',customer_visible:true,sender_tech_id:'b'})).status,200);
  assert.equal(notes[0].customer_visible,false);assert.equal(notes[0].sender_tech_id,'a');
  assert.equal((await request('individual-a','/api/tech-workflow/inbox',{message:''})).status,400);
  const roster=await(await request('individual-a','/api/tech-workflow/team')).json();assert.equal(roster.technicians[1].availability,'on_call');
});
