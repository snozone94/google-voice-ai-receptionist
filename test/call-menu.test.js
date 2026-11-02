import test from "node:test";
import assert from "node:assert/strict";
import { menuTwiml, parsePublishedPrices, priceSpeech, mountCallMenu } from "../src/call-menu.js";

test("published starting prices parse without inventing prices on a changed page", () => {
  const prices = parsePublishedPrices('<p>Standard Service Fee: <b>Starting at</b> $25.00+</p><p>Battery jump-start — Starting at $30.00+</p><p>Door unlock — Starting at $40.00+</p><p>Tire plug repair — Starting at $20.00+</p><p>Spare tire change — Starting at $50.00+</p>');
  assert.deepEqual(prices, { fee: 25, jump: 30, unlock: 40, plug: 20, spare: 50 });
  assert.match(priceSpeech(prices), /visit fee starts at 25 dollars/);
  assert.match(priceSpeech(prices), /final quote before service/);
  assert.deepEqual(parsePublishedPrices('<script>Battery jump-start Starting at $0</script>Unavailable'), {});
  assert.doesNotMatch(priceSpeech({ jump: 30 }), /start at 30/);
});

test("short menu accepts keypad digits during the greeting and has no default AI or team dial", () => {
  const menu = menuTwiml({ action: '/menu?secret=test&repeat=1' });
  assert.match(menu, /input="dtmf" numDigits="1" timeout="4" actionOnEmptyResult="true"/);
  assert.match(menu, /Press 1 to book by text. 2 for prices. 3 for an existing booking. Or 4 for the team/);
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
  smsOk = false;
  assert.match((await request('1')).text, /could not confirm/);
  assert.match((await request('3')).text, /same phone number or email/);
  assert.match((await request('', { stage: 'followup' })).text, /<Record/);
  assert.match((await request('7')).text, /Please choose/);
  assert.match((await request('', { repeat: '1' })).text, /<Record/);
  assert.equal(calls, 0);
  assert.match((await request('4')).text, /<Dial>/);
  assert.equal(calls, 1); assert.equal(ai, 0);
  teamAvailable = false;
  assert.match((await request("4")).text, /<Record/);
  assert.equal((await request('1', {}, {}, false)).code, 403);
  assert.equal((await request('4', {}, { CallSid: 'bad' })).code, 400);
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
