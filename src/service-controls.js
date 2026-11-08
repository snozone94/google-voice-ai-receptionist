import fs from 'node:fs/promises';
import path from 'node:path';
const bad = message => Object.assign(new Error(message), { status: 400 });
export const defaultAvailability = { mode: 'available', newTiresAvailable: true, notice: '', hoursOverride: 'auto', regularHours: '11 AM–7 PM', timeZone: 'America/New_York' };
export function validateAvailability(input) {
  if (!['available','busy','closed'].includes(input.mode)) throw bad('Choose Taking requests, Busy, or Closed.');
  if (typeof input.newTiresAvailable !== 'boolean') throw bad('Choose whether new-tire service is available.');
  if (typeof input.notice !== 'string' || input.notice.length > 160) throw bad('Keep the temporary notice within 160 characters.');
  if(input.hoursOverride!==undefined&&!['auto','after-hours','extended'].includes(input.hoursOverride))throw bad('Choose Automatic, After-hours now, or Extended-hours availability.');
  return { ...defaultAvailability, hoursOverride:input.hoursOverride||'auto', mode: input.mode, newTiresAvailable: input.newTiresAvailable, notice: input.notice.replace(/\s+/g,' ').trim() };
}
export function availabilityMessage(value = defaultAvailability) {
  const mode = { available: 'Taking service requests, subject to technician availability.', busy: 'We are currently busy. Requests will be reviewed when a technician is available.', closed: 'We are currently closed. Requests will be reviewed for the next available service window.' }[value.mode];
  return `${mode} Regular hours are 11 AM to 7 PM. After-hours service is not guaranteed.${value.newTiresAvailable ? '' : ' New-tire replacement service is currently unavailable.'}${value.notice ? ' ' + value.notice : ''}`;
}
export function serviceControlStore(directory) {
  const file = path.join(directory,'service-controls.json'); let queue = Promise.resolve();
  const update = (action,write=true) => { const result = queue.then(async () => { let state={availability:{...defaultAvailability},staff:{}}; try { state=JSON.parse(await fs.readFile(file,'utf8')); } catch(e) { if(e.code!=='ENOENT')throw e; } const value=action(state); if(!write)return value; await fs.mkdir(directory,{recursive:true}); await fs.writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600}); await fs.rename(file+'.tmp',file); return value; }); queue=result.catch(()=>{});return result; };
  return {
    availability: () => update(s=>s.availability,false),
    setAvailability: value => update(s=>(s.availability=validateAvailability({...value,hoursOverride:value.hoursOverride??s.availability.hoursOverride??'auto'}))),
    preferences: id => update(s=>s.staff[id] || { working:true, backup:false },false),
    setPreferences: (id,value) => { if(typeof value.working!=='boolean'||typeof value.backup!=='boolean')throw bad('Working and backup must be on or off.');return update(s=>(s.staff[id]={working:value.working,backup:value.backup,...(value.voiceIdentity?{voiceIdentity:value.voiceIdentity}:{})})); },
    voicemailSeen: id => update(s=>s.voicemails?.[id]||{},false),
    markVoicemail: (id,callId) => { if(!/^CA[0-9a-f]{32}$/i.test(callId||''))throw bad('Choose a valid call.');return update(s=>{s.voicemails||={};s.voicemails[id]||={};s.voicemails[id][callId]=new Date().toISOString();return {ok:true};}); },
    allPreferences: () => update(s=>s.staff,false)
  };
}
export function businessAppointmentIso(value) {
  if(typeof value!=='string')throw bad('Choose an appointment date and time.');
  if(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?:[:.\d]*)(?:Z|[+-]\d\d:\d\d)$/.test(value)) { const d=new Date(value);if(!Number.isNaN(+d))return d.toISOString(); }
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw bad('Use YYYY-MM-DDTHH:mm in Cincinnati time.');
  const [date,time]=value.split('T'),[y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
  const stamp=Date.UTC(y,m-1,d,hh,mm);
  const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const matches=[3,4,5,6].map(offset=>new Date(stamp+offset*3600000)).filter(candidate=>format.format(candidate).replace(' ','T')===value);
  if(matches.length!==1)throw bad('That local time is invalid or ambiguous. Choose another time.');
  return matches[0].toISOString();
}
