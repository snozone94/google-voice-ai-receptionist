const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'});
export function phoneHours(availability={},now=Date.now()) {
  const hour=Number(clock.format(new Date(now)));
  const scheduledAfterHours=hour<11||hour>=19;
  const override=availability.hoursOverride||'auto';
  return {scheduledAfterHours,afterHours:scheduledAfterHours||availability.mode==='closed'||override==='after-hours',extended:availability.mode!=='closed'&&override==='extended',timeZone:'America/New_York'};
}
export function afterHoursGreeting(availability={},now=Date.now()) {
  const state=phoneHours(availability,now);
  const situation=availability.mode==='closed'||!state.scheduledAfterHours?'We are currently closed for regular service.':state.extended?'After-hours requests are open for technician review.':'We are currently outside those hours.';
  return `Hey, thanks for calling Triple D. Our regular hours are 11 AM to 7 PM. ${situation} Roadside help depends on technician availability. Immediate or 24-hour service is not guaranteed.`;
}
export function bookingRequestPolicy(availability={},now=Date.now()) {
  const state=phoneHours(availability,now);
  const status=availability.mode==='closed'?'We are currently closed. Requests will be reviewed for the next available service window.':availability.mode==='busy'?'We are currently busy. Requests will be reviewed when a technician is available.':'';
  const tires=state.scheduledAfterHours||state.afterHours?'New-tire replacements are offered during regular hours. After-hours tire help is limited to spare-tire changes when a technician is available.':availability.newTiresAvailable===false?'New-tire replacement service is currently unavailable.':'New-tire replacements are available until 7 PM, subject to tire and technician availability.';
  return [state.afterHours?'After-hours request: service is not confirmed until our team accepts your request.':'Service is not confirmed until our team accepts your request.','Regular hours: 11 AM–7 PM, Cincinnati time. After-hours service is not guaranteed.',status,tires,'Shop visits require a confirmed appointment before traveling.',availability.notice||''].filter(Boolean).join('\n\n');
}
