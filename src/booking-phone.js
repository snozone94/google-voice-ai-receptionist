import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const say = text => `<Say voice="Polly.Joanna-Neural">${escape(text)}</Say>`;
const phone = value => /^\+1\d{10}$/.test(String(value)) ? String(value) : '';
export function bookingDescription(booking) {
  const status = String(booking.status || 'Status awaiting confirmation').replace(/[_-]/g, ' ');
  const rawTime = booking.serviceTime || booking.preferredTime;
  const time = /^\d{4}-\d{2}-\d{2}T/.test(rawTime || '') && !Number.isNaN(Date.parse(rawTime)) ? new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(rawTime)) : rawTime;
  return `${String(booking.serviceType || 'Service').slice(0, 100)}. ${String(time || 'Appointment time awaiting confirmation').slice(0, 160)}. Status: ${status.slice(0, 60)}.`;
}
export function createBookingPhone({ directory, lookup, sendCode, publishRequest, sendReceipt, voicemail, publicBaseUrl = process.env.PUBLIC_BASE_URL || "", now = Date.now, makeCode = () => String(crypto.randomInt(100000, 1000000)) }) {
  const file = path.join(directory, 'phone-booking-self-service.json');
  let queue = Promise.resolve();
  const transaction = action => {
    const result = queue.then(async () => {
      let state = { sessions: {}, requests: {} };
      try { state = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      for (const [id, session] of Object.entries(state.sessions)) if (session.expires <= now()) delete state.sessions[id];
      const value = await action(state);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(file + '.tmp', JSON.stringify(state), { mode: 0o600 });
      await fs.rename(file + '.tmp', file);
      return value;
    });
    queue = result.catch(() => {}); return result;
  };
  const hash = code => crypto.createHash('sha256').update(code).digest('hex');
  const action = (req, stage) => { const relative = '/api/twilio/call-menu?' + new URLSearchParams({ secret: String(req.query.secret || ''), stage: `booking-${stage}` }); return publicBaseUrl ? new URL(relative, publicBaseUrl).toString() : relative; };
  const gather = (req, stage, text, speech = false, digits = 1) => `<Response><Gather input="${speech ? 'speech' : 'dtmf'}" ${speech ? 'speechTimeout="auto" language="en-US"' : `numDigits="${digits}"`} timeout="15" actionOnEmptyResult="true" action="${escape(action(req, stage))}" method="POST">${say(text)}</Gather></Response>`;
  const choices = (req, bookings) => gather(req, 'select', bookings.map((b, i) => `Press ${i + 1} for ${bookingDescription(b)}`).join(' ') + ' Press 9 to return to the main menu.');
  const overview = (req, booking) => gather(req, 'action', `${bookingDescription(booking)} Press 1 to request a new date or time. Press 2 to request cancellation. Press 3 to leave an update. Press 5 to reach the team. Press 9 for the main menu.`);
  const fallback = req => voicemail(req);
  const remember = (req, mutate) => transaction(state => {
    const session = state.sessions[req.body.CallSid];
    if (!session || session.phone !== phone(req.body.From) || session.to !== req.body.To || session.expires <= now()) return null;
    return mutate(session, state);
  });
  async function handle(req) {
    const id = req.body.CallSid;
    const stage = String(req.query.stage || '').replace(/^booking-/, '');
    const digit = String(req.body.Digits || '');
    if (!/^CA[0-9a-f]{32}$/i.test(id || '') || !phone(req.body.From)) return fallback(req);
    if (!stage || stage === 'followup') {
      const code = makeCode();
      const result = await transaction(state => {
        const existing = state.sessions[id];
        if (existing && existing.phone === phone(req.body.From) && existing.to === req.body.To) return { existing: true };
        const recent = Object.values(state.sessions).filter(s => s.phone === phone(req.body.From) && s.created > now() - 15 * 60000);
        if (recent.length >= 3 || Object.keys(state.sessions).length >= 1000) return { limited: true };
        state.sessions[id] = { phone: phone(req.body.From), to: req.body.To, codeHash: hash(code), attempts: 0, created: now(), expires: now() + 10 * 60000, verified: false };
        return { created: true };
      });
      if (result.limited) return fallback(req);
      if (result.created) {
        let timer;
        const delivery = await Promise.race([sendCode(req.body.From, id, code).catch(() => ({ ok: false })), new Promise(resolve => { timer = setTimeout(() => resolve({ queued: true }), 1500); })]).finally(() => clearTimeout(timer));
        if (!delivery.ok && !delivery.queued) return fallback(req);
      }
      return gather(req, 'verify', 'For your privacy, we are sending a six digit verification code to the number you are calling from. Enter that code on your keypad. If you cannot receive texts, stay on the line to leave the team a message.', false, 6);
    }
    if (stage === 'verify') {
      const verified = await remember(req, session => {
        if (session.attempts >= 3) return false;
        session.attempts++;
        if (!/^\d{6}$/.test(digit) || hash(digit) !== session.codeHash) return false;
        session.verified = true; return true;
      });
      if (!verified) {
        const retry = await remember(req, session => session.attempts < 3 && Boolean(digit));
        return retry ? gather(req, 'verify', 'That code did not match. Please enter the six digit code from your text.', false, 6) : fallback(req);
      }
      const history = await lookup(req.body.From);
      const bookings = (history.bookings || []).filter(b => !/^(completed|complete|cancelled|canceled|closed)$/i.test(b.status || '')).slice(0, 5);
      if (!bookings.length) return `<Response>${say('We could not find an active booking under this phone number. Your booking may use a different number, or it may already be closed. Please leave your booking details for the team.')}${voicemail(req).replace(/^<Response>|<\/Response>$/g, '')}</Response>`;
      await remember(req, session => { session.bookings = bookings; session.selected = bookings.length === 1 ? 0 : null; });
      return bookings.length === 1 ? overview(req, bookings[0]) : choices(req, bookings);
    }
    const session = await remember(req, session => session.verified ? structuredClone(session) : null);
    if (!session?.bookings) return fallback(req);
    if (digit === '9') return null;
    if (digit === '5' && stage === 'action') return { team: true };
    if (stage === 'select') {
      const index = Number(digit) - 1;
      if (!/^\d$/.test(digit) || !session.bookings[index]) return choices(req, session.bookings);
      await remember(req, s => { s.selected = index; });
      return overview(req, session.bookings[index]);
    }
    const booking = session.bookings[session.selected];
    if (!booking) return choices(req, session.bookings);
    if (stage === 'action') {
      const type = ({ 1: 'reschedule', 2: 'cancel', 3: 'add_notes' })[digit];
      if (!type) return overview(req, booking);
      await remember(req, s => { s.change = { type }; });
      if (type === 'cancel') return gather(req, 'confirm', 'Press 1 to send a cancellation request to the team. This does not cancel your appointment yet. Press 9 to return to the main menu.');
      return gather(req, 'details', type === 'reschedule' ? 'Please say your preferred date and time, including AM or PM. Your current appointment stays in place until the team approves the change.' : 'Please say the update you want to leave for your booking.', true);
    }
    if (stage === 'details' && session.change) {
      const details = String(req.body.SpeechResult || '').trim().slice(0, 600);
      if (!details) {
        const attempts = await remember(req, s => { s.detailsAttempts = (s.detailsAttempts || 0) + 1; return s.detailsAttempts; });
        return attempts > 1 ? fallback(req) : gather(req, 'details', 'We did not catch that. Please say your requested date and time or booking update.', true);
      }
      await remember(req, s => { s.change.details = details; });
      return gather(req, 'confirm', `You said: ${details}. Press 1 to submit this request for team review. Press 9 to return to the main menu.`);
    }
    if (stage === 'confirm' && session.change) {
      if (digit !== '1') return overview(req, booking);
      if (session.change.type !== 'cancel' && !session.change.details) return overview(req, booking);
      const request = await remember(req, (s, state) => {
        const key = `BCR-${id}`;
        if (state.requests[key]) return state.requests[key];
        const request = { id: key, createdAt: new Date(now()).toISOString(), phone: s.phone, businessPhone: s.to, callId: id, booking, ...s.change, status: 'pending', originalAppointmentRetained: true };
        state.requests[key] = request; return request;
      });
      // These adapters use the durable delivery ledger. Repeated confirmations cannot create duplicate work.
      await publishRequest(request);
      void sendReceipt(request).catch(() => {});
      return `<Response>${say('Your request is saved for team review. Your original appointment has not changed. The team will confirm the outcome by text. Thank you.')}<Hangup/></Response>`;
    }
    return overview(req, booking);
  }
  return { handle,
    listRequests: () => transaction(state => Object.values(state.requests).sort((a,b) => b.createdAt.localeCompare(a.createdAt))),
    async refreshRequest(id, booking) {
      return transaction(state => {
        const request=state.requests[id];
        if(!request)throw Object.assign(new Error("Request not found."),{status:404});
        if(!['pending','offered'].includes(request.status))throw Object.assign(new Error("Resolve the previous decision before refreshing this request."),{status:409});
        if(booking.bookingId!==request.booking.bookingId)throw Object.assign(new Error("Booking identity changed."),{status:409});
        request.booking=structuredClone(booking);delete request.error;
        return structuredClone(request);
      });
    },
    async review(id, decision, execute) {
      const claim = await transaction(state => {
        const request = state.requests[id];
        if (!request) throw Object.assign(new Error("Request not found."), { status: 404 });
        if (["approved", "declined"].includes(request.status)) return { done: true, request };
        if (request.status === "processing" && now()-Date.parse(request.reviewStartedAt||0)>60000) request.status="needs_verification";
        if (request.status === "processing") throw Object.assign(new Error("This request is being reviewed. Please refresh shortly."), { status: 409 });
        if (request.review && request.status === "needs_verification" && JSON.stringify(request.review) !== JSON.stringify(decision)) throw Object.assign(new Error("Verify the previous change before submitting a different decision."), { status: 409 });
        request.status = "processing"; request.review = decision; request.reviewStartedAt=new Date(now()).toISOString();
        return { request: structuredClone(request) };
      });
      if (claim.done) return claim.request;
      try {
        const result = await execute(claim.request, decision);
        return await transaction(state => { const request=state.requests[id]; Object.assign(request,{status:decision.action==="approve"?"approved":decision.action==="offer"?"offered":"declined",reviewedAt:new Date(now()).toISOString(),result});return structuredClone(request); });
      } catch(error) {
        await transaction(state => { const request=state.requests[id];request.status=error.definite?"pending":"needs_verification";request.error=error.definite?error.message:"Check the current booking before retrying; the previous result was not confirmed."; });
        throw error;
      }
    }
  };
}
