import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sendWithSmsDisclosure } from '../src/sms-disclosure.js';

test('only the initial accepted text includes STOP, including concurrent paths and persisted history', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-disclosure-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const bodies = [];
  const input = { dataDir, from: '+15135550101', to: '(513) 555-0111', message: 'DDD booking: https://dddcincy.com/book-service/\n\nReply STOP to stop.', send: async body => { bodies.push(body); return { ok: true, status: 'queued' }; } };
  await Promise.all([sendWithSmsDisclosure(input), sendWithSmsDisclosure(input)]);
  assert.match(bodies[0], /Reply STOP to stop\.$/);
  assert.doesNotMatch(bodies[1], /STOP/);
  assert.match(bodies[1], /https:\/\/dddcincy.com\/book-service\//);
  await sendWithSmsDisclosure({ ...input, to: '+15135550111', message: 'Thanks. Text STOP to stop.' });
  assert.equal(bodies[2], 'Thanks.');
  await fs.writeFile(path.join(dataDir, 'sms.jsonl'), JSON.stringify({direction:'outbound',from:input.from,to:'+15135550222',status:'sent',body:'DDD. Reply STOP to stop.'})+'\n');
  await sendWithSmsDisclosure({ ...input, to: '+15135550222' });
  assert.doesNotMatch(bodies[3], /STOP/);
});

test('failed sends keep first-message disclosure for retry and different senders stay independent', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-disclosure-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  let ok = false;
  const bodies = [];
  const input = { dataDir, from: '+15135550101', to: '+15135550111', message: 'DDD update', send: async body => { bodies.push(body); return { ok, status: ok ? 'queued' : 400 }; } };
  await sendWithSmsDisclosure(input);
  ok = true;
  await sendWithSmsDisclosure(input);
  await sendWithSmsDisclosure(input);
  await sendWithSmsDisclosure({ ...input, from: '+15135550333' });
  assert.deepEqual(bodies.map(body => body.includes('STOP')), [true,true,false,true]);
});
