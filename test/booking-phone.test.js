import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBookingPhone } from '../src/booking-phone.js';
const callId = 'CA' + 'a'.repeat(32);
const bookings = [{ bookingId: 'job-real', serviceType: 'Tire plug', preferredTime: 'November 4, 2026 at 2 PM', status: 'Confirmed' }];
async function fixture(t, history = bookings) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'booking-phone-')); t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const sent = [], published = [], receipts = []; let lookedUp = 0, time = Date.now();
  const options = { directory, publicBaseUrl: 'https://dispatch.example.com', now: () => time, makeCode: () => '123456', lookup: async () => { lookedUp++; return { bookings: history }; }, sendCode: async (...args) => { sent.push(args); return { ok: true }; }, publishRequest: async request => { published.push(request); }, sendReceipt: async request => { receipts.push(request); }, voicemail: () => '<Response><Record/></Response>' };
  let service = createBookingPhone(options);
  return { directory, sent, published, receipts, get lookedUp() { return lookedUp; }, advance(ms) { time += ms; }, restart() { service = createBookingPhone(options); }, run(stage = '', body = {}) { return service.handle({ query: { stage: stage ? 'booking-' + stage : '', secret: 'test' }, body: { From: '+15135550100', To: '+15134091342', CallSid: callId, ...body } }); } };
}
test('no booking details before code verification, bound to phone, destination and call, durable across restart', async t => {
  const f = await fixture(t);
  assert.match(await f.run(), /action="https:\/\/dispatch.example.com\/api\/twilio\/call-menu/);
  assert.match(await f.run(), /six digit verification/); assert.equal(f.sent.length, 1); assert.equal(f.lookedUp, 0);
  await f.run(); assert.equal(f.sent.length, 1);
  f.restart();
  assert.match(await f.run('action', { Digits: '1' }), /Record/);
  assert.match(await f.run('verify', { Digits: '123456', From: '+15135550200' }), /Record/);
  assert.match(await f.run('verify', { Digits: '123456', To: '+15135550999' }), /Record/);
  assert.equal(f.lookedUp, 0);
  const result = await f.run('verify', { Digits: '123456' });
  assert.match(result, /Tire plug/); assert.match(result, /November 4/); assert.match(result, /Confirmed/); assert.equal(f.lookedUp, 1);
  const disk = await fs.readFile(path.join(f.directory, 'phone-booking-self-service.json'), 'utf8');
  assert.doesNotMatch(disk, /123456/);
});
test('three bad codes lock session; expiry prevents access; phone is rate limited', async t => {
  const f = await fixture(t); await f.run();
  for (let i = 0; i < 3; i++) await f.run('verify', { Digits: '000000' });
  assert.match(await f.run('verify', { Digits: '123456' }), /Record/); assert.equal(f.lookedUp, 0);
  f.advance(11 * 60000); assert.match(await f.run('verify', { Digits: '123456' }), /Record/);
  for (let i = 0; i < 4; i++) await f.run('', { CallSid: 'CA' + String(i).repeat(32) });
  assert.equal(f.sent.length, 4); // first expired session + three new sessions
});
test('multiple active bookings require selection and closed bookings are excluded', async t => {
  const f = await fixture(t, [...bookings, { bookingId: 'closed', serviceType: 'Old private job', status: 'Completed' }, { bookingId: 'other', serviceType: 'Door unlock', preferredTime: 'Tomorrow at 1 PM', status: 'Requested' }]);
  await f.run(); const menu = await f.run('verify', { Digits: '123456' });
  assert.match(menu, /Press 1 for Tire plug/); assert.match(menu, /Press 2 for Door unlock/); assert.doesNotMatch(menu, /Old private job/);
  assert.match(await f.run('select', { Digits: '2' }), /Status: Requested/);
});
test('reschedule preserves original booking, requires confirmation and persists pending request', async t => {
  const f = await fixture(t); await f.run(); await f.run('verify', { Digits: '123456' });
  assert.match(await f.run('action', { Digits: '1' }), /current appointment stays/);
  assert.match(await f.run('details', { SpeechResult: 'Friday at 3 PM & please call first' }), /3 PM &amp;/);
  assert.equal(f.published.length, 0);
  const reply = await f.run('confirm', { Digits: '1' });
  assert.match(reply, /original appointment has not changed/);
  assert.equal(f.published[0].status, 'pending'); assert.equal(f.published[0].booking.bookingId, 'job-real');
  assert.equal(f.published[0].booking.preferredTime, bookings[0].preferredTime);
  assert.equal(f.receipts.length, 1);
  f.restart(); await f.run('confirm', { Digits: '1' });
  assert.equal(f.published[1].id, f.published[0].id); // adapters deduplicate this persistent ID
  const state = JSON.parse(await fs.readFile(path.join(f.directory, 'phone-booking-self-service.json')));
  assert.equal(Object.keys(state.requests).length, 1);
});
test('cancellation and notes are pending requests, never automatic booking mutations; main menu and team remain reachable', async t => {
  const f = await fixture(t); await f.run(); await f.run('verify', { Digits: '123456' });
  assert.deepEqual(await f.run('action', { Digits: '5' }), { team: true });
  assert.equal(await f.run('action', { Digits: '9' }), null);
  assert.match(await f.run('action', { Digits: '2' }), /does not cancel your appointment yet/);
  await f.run('confirm', { Digits: '1' }); assert.equal(f.published[0].type, 'cancel');
  const g = await fixture(t); await g.run(); await g.run('verify', { Digits: '123456' });
  await g.run('action', { Digits: '3' }); await g.run('details', { SpeechResult: 'The car is blue' }); await g.run('confirm', { Digits: '1' });
  assert.equal(g.published[0].type, 'add_notes'); assert.equal(g.published[0].details, 'The car is blue');
});
test('missing active bookings goes safely to a message without disclosing closed booking details', async t => {
  const f = await fixture(t, [{ serviceType: 'Old private job', status: 'Cancelled' }]); await f.run();
  const text = await f.run('verify', { Digits: '123456' }); assert.match(text, /could not find an active booking/); assert.match(text, /Record/); assert.doesNotMatch(text, /Old private job/);
});
