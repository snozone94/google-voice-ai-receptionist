import test from 'node:test';
import assert from 'node:assert/strict';
import { createHoldMusicUrl, verifyHoldMusic, holdMusicTwiml } from '../src/hold-music.js';
const call = 'CA' + 'a'.repeat(32), now = 1000000, secret = 'test-only-secret';
test('private waiting playlist uses both tracks with expiring signed URLs and no public audio paths', () => {
  const url = new URL(createHoldMusicUrl('https://dispatch.example.test', secret, call, now));
  const query = Object.fromEntries(url.searchParams);
  assert.equal(verifyHoldMusic(query, secret, now), true);
  const xml = holdMusicTwiml(url.origin, query);
  assert.match(xml, /\/api\/voice\/hold-audio\/ddd-bri-hold.mp3\?call=/);
  assert.match(xml, /ddd-check-your-phone-hold.mp3/);
  assert.match(xml, /<Redirect method="GET">https:\/\/dispatch.example.test/);
  assert.ok(xml.indexOf('ddd-bri') < xml.indexOf('ddd-check'));
  const alternate = holdMusicTwiml(url.origin, { ...query, track: '1' });
  assert.ok(alternate.indexOf('ddd-check') < alternate.indexOf('ddd-bri'));
  assert.doesNotMatch(xml, /<Say|<Record|<Dial|\/audio\//);
  assert.doesNotMatch(xml, new RegExp(secret));
});
test('private music rejects missing, changed, expired and extended access tokens', () => {
  const query = Object.fromEntries(new URL(createHoldMusicUrl('https://dispatch.example.test', secret, call, now)).searchParams);
  for (const invalid of [{}, {...query,token:[query.token]}, {...query,call: 'CA'+'b'.repeat(32)}, {...query,token:'0'.repeat(64)}, {...query,expires:String(now+99999999)}]) assert.equal(verifyHoldMusic(invalid, secret, now), false);
  assert.equal(verifyHoldMusic(query, secret, now+11*60000), false);
  assert.equal(verifyHoldMusic(query, 'wrong', now), false);
});
