import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {phoneHours,afterHoursGreeting,bookingRequestPolicy} from '../src/business-hours.js';
import {serviceControlStore,validateAvailability} from '../src/service-controls.js';
import {mountCallMenu} from '../src/call-menu.js';
const open={mode:'available',newTiresAvailable:true,notice:'',hoursOverride:'auto'};
test('Cincinnati schedule opens at 11 and closes at 19 regardless of server zone or DST',()=>{
 for(const [instant,after] of [['2026-11-08T15:59:59Z',true],['2026-11-08T16:00:00Z',false],['2026-11-08T23:59:59Z',false],['2026-11-09T00:00:00Z',true],['2026-07-08T14:59:59Z',true],['2026-07-08T15:00:00Z',false],['2026-07-08T23:00:00Z',true],['2026-11-01T05:30:00Z',true],['2026-11-01T06:30:00Z',true],['2026-03-08T06:59:00Z',true],['2026-03-08T07:01:00Z',true]])assert.equal(phoneHours(open,Date.parse(instant)).afterHours,after,instant);
});
test('early closure and extended coverage never promise immediate or all-day service',()=>{
 const noon=Date.parse('2026-11-08T17:00:00Z'),night=Date.parse('2026-11-09T02:00:00Z');
 assert.equal(phoneHours({...open,hoursOverride:'after-hours'},noon).afterHours,true);
 assert.match(afterHoursGreeting({...open,hoursOverride:'after-hours'},noon),/closed for regular service/);
 assert.match(afterHoursGreeting({...open,hoursOverride:'extended'},night),/technician review/);
 assert.match(afterHoursGreeting({...open,hoursOverride:'extended'},night),/not guaranteed/);
 assert.equal(phoneHours({...open,mode:'closed',hoursOverride:'extended'},night).extended,false);
 assert.throws(()=>validateAvailability({...open,hoursOverride:'always-open'}));
});
test('legacy app availability saves retain a web-admin greeting override',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'ddd-hours-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));const store=serviceControlStore(directory);
 await store.setAvailability({...open,hoursOverride:'after-hours'});
 const {hoursOverride,...legacy}=open;await store.setAvailability({...legacy,mode:'busy'});
 assert.equal((await store.availability()).hoursOverride,'after-hours');
 assert.equal((await serviceControlStore(directory).availability()).hoursOverride,'after-hours');
});
test('requested after-hours text retains confirmation, tire and shop limits within the message cap',()=>{
 const policy=bookingRequestPolicy({...open,mode:'closed',notice:'x'.repeat(160)},Date.parse('2026-11-09T02:00:00Z'));
 assert.match(policy,/not confirmed until our team accepts/);assert.match(policy,/limited to spare-tire changes/);assert.match(policy,/confirmed appointment before traveling/);
 assert.match(policy,/next available service window/);assert.ok(278+policy.length+22<980);
});
test('initial, repeated and returning menus use the current schedule; team and voicemail routing remain intact',async()=>{
 let handler,time=Date.parse('2026-11-08T17:00:00Z'),current={...open},dialed=0;
 const menu=mountCallMenu({post(_path,_parser,route){handler=route;}},{express:{urlencoded:()=>null},authenticate:()=>true,availability:async()=>current,now:()=>time,settings:async()=>({enabled:true}),saveEvent:async()=>{},notify:()=>{},humanDial:async()=>{dialed++;return '<Response><Say>Unavailable</Say></Response>';},bookingSelfService:async()=>null});
 const req={query:{secret:'synthetic'},body:{CallSid:'CA'+'a'.repeat(32),From:'+15135550100',To:'+15135550101'}};
 assert.match(await menu.render(req),/automated system/);
 time=Date.parse('2026-11-09T02:00:00Z');let greeting=await menu.render(req);assert.match(greeting,/outside those hours/);assert.match(greeting,/try the team or leave a voicemail/);assert.doesNotMatch(greeting,/<Dial|<Redirect/);
 async function run(digit,stage=''){const r={type(){return this;},status(){return this;},send(text){this.text=text;return this;}};await handler({...req,query:{...req.query,stage},body:{...req.body,Digits:digit}},r,e=>{throw e;});return r.text;}
 assert.match(await run('3'),/outside those hours/);
 assert.match(await run('7'),/try the team or leave a voicemail/);
 assert.match(await run('5'),/<Record/);assert.equal(dialed,1);
 current={...open,notice:'Delay <10> & call first'};assert.match(await menu.render(req),/Delay &lt;10&gt; &amp; call first/);
 time=Date.parse('2026-11-08T17:00:00Z');assert.match(await menu.render(req),/automated system/);
});
