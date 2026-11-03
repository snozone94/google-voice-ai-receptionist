import crypto from 'node:crypto';
import { businessAppointmentIso } from './service-controls.js';
export function reviewDecision(body, request, now=Date.now()) {
  if(!['approve','offer','decline'].includes(body.action))throw Object.assign(new Error('Choose Approve, Offer another time, or Decline.'),{status:400,definite:true});
  const decision={action:body.action,note:String(body.note||'').trim().slice(0,600)};
  if(body.action==='approve'&&body.availabilityConfirmed!==true)throw Object.assign(new Error('Confirm that you reviewed the booking and technician availability.'),{status:400,definite:true});
  if(body.action==='offer'||body.action==='approve'&&request.type==='reschedule') {
    decision.appointmentAt=businessAppointmentIso(body.appointmentAt);
    if(Date.parse(decision.appointmentAt)<=now)throw Object.assign(new Error('Choose a future appointment time.'),{status:400,definite:true});
  }
  if(body.action==='decline'&&!decision.note)throw Object.assign(new Error('Add a brief reason for the customer.'),{status:400,definite:true});
  return decision;
}
export const reviewKey=(request,decision)=>crypto.createHash('sha256').update(JSON.stringify([request.id,decision])).digest('hex');
export function reviewReceipt(request) {
  const decision=request.review;
  const time=decision.appointmentAt?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'short'}).format(new Date(decision.appointmentAt)):'';
  const message=decision.action==='offer'?`DDD can offer ${time}. This is an offer, not a confirmed change. Please reply to accept or suggest another time. Your original appointment remains unchanged.`:decision.action==='decline'?`DDD could not approve your booking change. ${decision.note} Your original appointment remains unchanged.`:request.type==='cancel'?'DDD confirms your appointment has been canceled.':request.type==='reschedule'?`DDD confirms your appointment has been moved to ${time}.`:'DDD has added your update to your booking.';
  return `${message}${decision.action==='approve'&&decision.note?' '+decision.note:''}${decision.action==='approve'&&request.type!=='cancel'?' Shop visits require a confirmed appointment and location before traveling.':''}`;
}
export async function applyPlatformReview(request,decision,{token,url,fetcher=fetch}) {
  const payload={request_id:request.id,idempotency_key:reviewKey(request,decision),booking_id:request.booking.bookingId,phone:request.phone,type:request.type,details:request.details||'',expected_status:request.booking.status||'',expected_time:request.booking.preferredTime||'',appointment_at:decision.appointmentAt||'',note:decision.note};
  if(!url||!token)throw Object.assign(new Error('WordPress booking approval is not connected. Your original booking is unchanged.'),{status:503,definite:true});
  const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json','X-DDD-Tech-Token':token},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true)throw Object.assign(new Error(data.error||data.message||'Booking update was not confirmed. Refresh before retrying.'),{status:response.status>=400&&response.status<500?response.status:502,definite:response.status>=400&&response.status<500});
  return data;
}
