import test from "node:test";
import assert from "node:assert/strict";
import { menuTwiml, boundedMenuDelivery, parsePublishedPrices, priceSpeech, priceText, mountCallMenu } from "../src/call-menu.js";

test("published starting prices parse without inventing prices on a changed page", () => {
  const prices = parsePublishedPrices('<p>Standard Service Fee: <b>Starting at</b> $25.00+</p><p>Battery jump-start — Starting at $30.00+</p><p>Door unlock — Starting at $40.00+</p><p>Tire plug repair — Starting at $20.00+</p><p>Spare tire change — Starting at $50.00+</p>');
  assert.deepEqual(prices, { fee: 25, jump: 30, unlock: 40, plug: 20, spare: 50 });
  for (const total of [55, 65, 45, 75]) {
    assert.ok(priceSpeech(prices).includes(`${total} dollars total`));
    assert.ok(priceText(prices).includes(`$${total} total`));
  }
  assert.match(priceSpeech(prices), /already include the 25 dollar service fee/);
  assert.doesNotMatch(priceSpeech(prices), /before the visit fee|fee starts at|30 dollars|40 dollars|20 dollars|50 dollars/);
  assert.match(priceText(prices), /including the \$25 service fee/);
  for (const message of [priceText(prices), priceText({})]) {
    assert.match(message, /11 AM to 7 PM/);
    assert.match(message, /New-tire replacement service is available until 7 PM/);
    assert.match(message, /After 7 PM, tire service is limited to spare-tire changes/);
    assert.match(message, /24\/7 service is not guaranteed/);
    assert.doesNotMatch(message, /10 PM/);
  }
  assert.match(priceSpeech(prices), /final quote before service/);
  assert.deepEqual(parsePublishedPrices('<script>Battery jump-start Starting at $0</script>Unavailable'), {});
  assert.doesNotMatch(priceSpeech({ jump: 30 }), /start at 30/);
});

test("short menu accepts keypad digits during the greeting and has no default AI or team dial", () => {
  const menu = menuTwiml({ action: '/menu?secret=test&repeat=1' });
  assert.match(menu, /^<Response><Pause length="1"\/>/);
  assert.match(menu, /Hey, thank you for calling Triple D’s automated system. How can we help you today\?/);
  assert.match(menu, /input="dtmf" numDigits="1" timeout="4" actionOnEmptyResult="true"/);
  assert.match(menu, /Press 1 to book by text. 2 for prices. 3 for an existing booking. 4 for hours and shop information. Or 5 to reach the team/);
  assert.match(menu, /secret=test&amp;repeat=1/);
  assert.doesNotMatch(menu, /<Dial|<Conference|assistant/i);
});

test("keypad routing books without AI, handles text failures honestly, saves voicemail and rings only on request", async () => {
  let handler, calls = 0, booking = 0, messages = 0, ai = 0, smsOk = true, teamAvailable = true;
  const events = [];
  const menu = mountCallMenu({ post: (_path, _parser, callback) => { handler = callback; } }, {
    express: { urlencoded: () => null }, authenticate: req => req.authorized !== false,
    settings: async () => ({ enabled: true }), menuEnabled: async () => true,
    saveEvent: async event => events.push(event), sendBookingLinks: async () => { booking++; return { ok: smsOk }; },
    sendPriceLink: async () => ({ ok: false }), humanDial: async () => { calls++; return teamAvailable ? '<Response><Dial>team</Dial></Response>' : '<Response><Say>No team</Say><Hangup/></Response>'; },
    notify: () => { messages++; }, bypassAssistant: async (_req, res) => { ai++; res.send('assistant'); }
  });
  async function request(Digits = '', query = {}, body = {}, authorized = true) {
    const req = { authorized, query: { secret: 'test', ...query }, body: { CallSid: 'CA' + 'a'.repeat(32), From: '+15135550100', To: '+15134091342', Digits, ...body } };
    const res = { code: 200, status(code) { this.code = code; return this; }, type() { return this; }, send(text) { this.text = text; return this; } };
    await handler(req, res, error => { throw error; });
    return res;
  }
  assert.equal(await menu.enabled(), true);
  assert.match((await request('1')).text, /booking and app links/);
  assert.equal(booking, 1); assert.equal(ai, 0); assert.equal(calls, 0);
  const hours = await request('4');
  assert.match(hours.text, /11 AM to 7 PM/);
  assert.match(hours.text, /confirmed appointment only/);
  assert.match(hours.text, /wait for approval before traveling/);
  assert.match(hours.text, /info=hours/);
  assert.match(hours.text, /Press 5 to reach the team/);
  assert.doesNotMatch(hours.text, /<Dial/);
  assert.equal(calls, 0);
  assert.equal(booking, 1);
  smsOk = false;
  assert.match((await request('1')).text, /could not confirm/);
  assert.match((await request('3')).text, /same phone number or email/);
  assert.match((await request('', { stage: 'followup' })).text, /<Record/);
  assert.match((await request('7')).text, /Please choose/);
  assert.match((await request('', { repeat: '1' })).text, /<Record/);
  assert.equal(calls, 0);
  assert.match((await request('5')).text, /<Dial>/);
  assert.equal(calls, 1); assert.equal(ai, 0);
  teamAvailable = false;
  assert.match((await request("5")).text, /<Record/);
  assert.equal((await request('1', {}, {}, false)).code, 403);
  assert.equal((await request('5', {}, { CallSid: 'bad' })).code, 400);
  const before = messages;
  assert.match((await request('', { stage: 'saved' }, { RecordingUrl: 'https://api.twilio.com/test.wav', RecordingDuration: '8' })).text, /message is saved/);
  assert.equal(messages, before + 1);
  assert.equal(events.at(-1).data.status, 'message-saved');
  assert.match((await request('', { stage: 'saved' })).text, /No message was recorded/);
  assert.equal(messages, before + 1);
  menu.recordingCompleted({ query: { menuMessage: "1" }, body: { CallSid: "CA" + "a".repeat(32), RecordingStatus: "completed", RecordingDuration: "8", RecordingUrl: "https://api.twilio.com/test.wav" } });
  assert.equal(messages, before + 2);
  menu.recordingCompleted({ query: { menuMessage: "1" }, body: { RecordingStatus: "completed", RecordingDuration: "0" } });
  assert.equal(messages, before + 2);
});


test("slow or failed text delivery cannot hold the call menu open", async () => {
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  assert.deepEqual(await boundedMenuDelivery(() => pending, 5), { ok: true, queued: true });
  complete({ ok: true });
  assert.deepEqual(await boundedMenuDelivery(() => Promise.reject(new Error("provider offline")), 5), { ok: false });
  assert.deepEqual(await boundedMenuDelivery(() => ({ ok: true }), 5), { ok: true });
});

test('verified booking flow is behind provider authentication and returns team calls to the normal last-option route', async () => {
  let handler, lookups = 0, team = 0;
  mountCallMenu({ post(_path, _parser, route) { handler = route; } }, {
    express: { urlencoded: () => null }, authenticate: req => req.allowed,
    settings: async () => ({}), saveEvent: async () => {}, notify: () => {},
    bookingSelfService: async req => { lookups++; return req.body.Digits === '5' ? { team: true } : '<Response><Say>Verify your booking</Say></Response>'; },
    humanDial: async () => { team++; return '<Response><Dial>team</Dial></Response>'; }
  });
  async function request(allowed, stage, Digits) {
    const res = { code: 200, status(code) { this.code = code; return this; }, type() { return this; }, send(text) { this.text = text; return this; } };
    await handler({ allowed, query: { stage }, body: { CallSid: 'CA' + 'b'.repeat(32), From: '+15135550100', To: '+15134091342', Digits } }, res, error => { throw error; }); return res;
  }
  assert.equal((await request(false, '', '3')).code, 403); assert.equal(lookups, 0);
  assert.match((await request(true, '', '3')).text, /Verify your booking/);
  assert.match((await request(true, 'booking-action', '5')).text, /<Dial>/); assert.equal(team, 1);
});
