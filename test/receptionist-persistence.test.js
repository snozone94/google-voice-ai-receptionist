import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { reserveCallSms } from '../src/call-sms-policy.js';

test('archives reopen only for genuinely new inbound events, with history and booking-only union', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-persistence-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  try {
    const api = await import(`../src/receptionist.js?archive=${Date.now()}`);
    const phone = '+15135550100';
    const write = (name, records) => fs.writeFile(path.join(dir, name), records.map(JSON.stringify).join('\n') + '\n');
    const sms = [{ from: phone, direction: 'inbound', body: 'old', createdAt: '2026-01-01T00:00:00Z' }, { to: phone, direction: 'outbound', body: 'staff reply', createdAt: '2026-03-01T00:00:00Z' }];
    await write('sms.jsonl', sms);
    await fs.writeFile(path.join(dir, 'archived-conversations.json'), JSON.stringify({ [phone]: { archivedAt: '2026-02-01T00:00:00Z' } }));
    await write('bookings.jsonl', [{ bookingId: 'only', phone: '5135550101', createdAt: '2026-01-02T00:00:00Z', serviceType: 'Tire' }]);
    assert.deepEqual((await api.listConversations()).map(x => x.phone), ['+15135550101']);
    sms.push({ from: '(513) 555-0100', direction: 'inbound', body: 'new', createdAt: '2026-04-01T00:00:00Z' });
    await write('sms.jsonl', sms);
    const threads = await api.listConversations(1);
    assert.equal(threads.length, 1);
    assert.equal(threads[0].messages.length, 3);
    assert.equal(threads[0].phone, phone);
    assert.equal((await api.listConversations(0)).length, 0);
  } finally { if (previous === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous; await fs.rm(dir, { recursive: true, force: true }); }
});

test('booking is durable before network, same stable ID creates once, refresh uses exact IDs and cache', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-booking-'));
  const names = ['DATA_DIR', 'DDD_BOOKING_WEBHOOK_URL', 'DDD_CUSTOMER_HISTORY_URL'];
  const old = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  process.env.DATA_DIR = dir;
  process.env.DDD_BOOKING_WEBHOOK_URL = 'https://test.invalid/create';
  process.env.DDD_CUSTOMER_HISTORY_URL = 'https://test.invalid/history';
  let creates = 0, reads = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/create')) {
      creates++;
      const saved = await fs.readFile(path.join(dir, 'bookings.jsonl'), 'utf8');
      assert.match(saved, /stable/);
      assert.equal(JSON.parse(options.body).external_booking_id, 'stable');
      return { ok: true, status: 200, json: async () => ({ jobId: '42' }) };
    }
    reads++;
    return { ok: true, json: async () => ({ bookings: [{ id: 'wrong', status: 'Cancelled' }, { id: '42', status: 'Completed', assignee: 'Jo', serviceTime: '2026-11-01' }] }) };
  };
  try {
    const api = await import(`../src/receptionist.js?booking=${Date.now()}`);
    const input = { bookingId: 'stable', phone: '5135550100', notes: 'keep local', smsConsent: false };
    const attempts = await Promise.allSettled([api.saveBookingRequest(input), api.saveBookingRequest(input)]);
    assert.equal(attempts[0].status, 'fulfilled');
    assert.equal(attempts[1].status, 'rejected');
    assert.equal(attempts[1].reason.status, 409);
    const saved = attempts[0].value;
    for (const replay of [input, { id: 'stable', phone: '5135550199' }, { ...input, statusToken: 'wrong' }]) {
      await assert.rejects(api.saveBookingRequest(replay), error => error.status === 409 && !error.message.includes(saved.statusToken));
    }
    const authorized = await api.saveBookingRequest({ ...input, statusToken: saved.statusToken });
    assert.equal(authorized.statusToken, saved.statusToken);
    assert.equal(creates, 1);
    const [booking] = await api.listBookings(20);
    assert.equal(booking.status, 'Completed');
    assert.equal(booking.assignee, 'Jo');
    assert.equal(booking.serviceTime, '2026-11-01');
    assert.equal(booking.notes, 'keep local');
    assert.ok(booking.statusToken);
    assert.equal((await api.listBookings(20)).length, 1);
    assert.equal(reads, 1);
  } finally { globalThis.fetch = originalFetch; for (const name of names) { if (old[name] === undefined) delete process.env[name]; else process.env[name] = old[name]; } await fs.rm(dir, { recursive: true, force: true }); }
});

test('automatic call SMS reservations are atomic across normalized numbers and durable across calls', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-claims-'));
  try {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => reserveCallSms({ dataDir: dir, phone: i % 2 ? '5135550100' : '+15135550100' })));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await reserveCallSms({ dataDir: dir, phone: '(513)555-0100' }), null);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('old call status callbacks do not reopen an archive; new call and booking do', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-reopen-'));
  const old = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  try {
    const api = await import(`../src/receptionist.js?calls=${Date.now()}`);
    const phone = '+15135550100';
    const write = (name, rows) => fs.writeFile(path.join(dir, name), rows.map(JSON.stringify).join('\n') + '\n');
    await fs.writeFile(path.join(dir, 'archived-conversations.json'), JSON.stringify({ [phone]: { archivedAt: '2026-02-01T00:00:00Z' } }));
    const rows = [{ callId: 'old', from: phone, createdAt: '2026-01-01T00:00:00Z', status: 'ringing' }, { callId: 'old', from: phone, createdAt: '2026-03-01T00:00:00Z', status: 'completed' }];
    await write('calls.jsonl', rows);
    assert.equal((await api.listConversations()).length, 0);
    rows.push({ callId: 'new', from: phone, createdAt: '2026-04-01T00:00:00Z', status: 'ringing' });
    await write('calls.jsonl', rows);
    assert.equal((await api.listConversations())[0].messages.length, 2);
    await write('calls.jsonl', rows.slice(0, 2));
    await write('bookings.jsonl', [{ bookingId: 'fresh', phone, createdAt: '2026-04-01T00:00:00Z', serviceType: 'Battery' }]);
    assert.equal((await api.listConversations())[0].bookings[0].bookingId, 'fresh');
  } finally { if (old === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = old; await fs.rm(dir, { recursive: true, force: true }); }
});

test('explicit external ID conflicts reject generic job collisions and thread rows share refreshed lifecycle', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-identities-'));
  const oldDir = process.env.DATA_DIR, oldUrl = process.env.DDD_CUSTOMER_HISTORY_URL;
  const oldFetch = globalThis.fetch;
  process.env.DATA_DIR = dir;
  process.env.DDD_CUSTOMER_HISTORY_URL = 'https://test.invalid/identities';
  const phone = '+15135550100';
  const rows = [
    { bookingId: 'local-conflict', phone, externalSync: { jobId: '42' }, status: 'Requested' },
    { bookingId: 'local-match', phone, externalSync: { jobId: '43' }, status: 'Requested', notes: 'local notes' }
  ];
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ bookings: [
    { id: '42', external_booking_id: 'other-booking', status: 'Completed' },
    { id: '43', external_booking_id: 'local-match', status: 'Technician Assigned', assignee: 'Jo', serviceTime: '2026-11-01T12:00:00Z' }
  ] }) });
  try {
    await fs.writeFile(path.join(dir, 'bookings.jsonl'), rows.map(JSON.stringify).join('\n') + '\n');
    const api = await import(`../src/receptionist.js?identities=${Date.now()}`);
    const bookings = await api.listBookings(20);
    const conflict = bookings.find(row => row.bookingId === 'local-conflict');
    assert.equal(conflict.status, 'Requested');
    assert.equal(conflict.platformRefresh.state, 'unverified');
    const match = bookings.find(row => row.bookingId === 'local-match');
    assert.equal(match.status, 'Technician Assigned');
    const [thread] = await api.listConversations();
    assert.deepEqual(thread.bookings, bookings);
    assert.equal(thread.bookings.find(row => row.bookingId === 'local-match').serviceTime, '2026-11-01T12:00:00Z');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = oldDir;
    if (oldUrl === undefined) delete process.env.DDD_CUSTOMER_HISTORY_URL; else process.env.DDD_CUSTOMER_HISTORY_URL = oldUrl;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('bounded refresh batches cover all customers, retain cache, and prioritize open unvisited jobs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-rotation-'));
  const oldDir = process.env.DATA_DIR, oldUrl = process.env.DDD_CUSTOMER_HISTORY_URL;
  const oldFetch = globalThis.fetch, oldNow = Date.now;
  let now = oldNow();
  Date.now = () => now;
  process.env.DATA_DIR = dir;
  process.env.DDD_CUSTOMER_HISTORY_URL = 'https://test.invalid/rotation';
  const requested = [];
  const rows = Array.from({ length: 18 }, (_, i) => ({ bookingId: `local-${i}`, phone: `+1513555${String(100 + i).padStart(4, '0')}`, status: i < 2 ? 'Completed' : 'Requested' }));
  globalThis.fetch = async url => {
    const phone = new URL(url).searchParams.get('phone');
    requested.push(phone);
    const row = rows.find(row => row.phone === phone);
    return { ok: true, json: async () => ({ bookings: [{ external_booking_id: row.bookingId, status: 'Completed', assignee: 'Jo' }] }) };
  };
  try {
    await fs.writeFile(path.join(dir, 'bookings.jsonl'), rows.map(JSON.stringify).join('\n') + '\n');
    const api = await import(`../src/receptionist.js?rotation=${now}`);
    let result = await api.listBookings(30);
    assert.equal(requested.length, 8);
    assert.equal(requested.some(phone => rows.slice(0, 2).some(row => row.phone === phone)), false);
    assert.equal(result.filter(row => row.platformRefresh.state === 'unverified').length, 10);
    result = await api.listBookings(30);
    assert.equal(requested.length, 16);
    assert.equal(result.filter(row => row.platformRefresh.state === 'fresh').length, 16);
    result = await api.listBookings(30);
    assert.equal(requested.length, 18);
    assert.equal(new Set(requested).size, 18);
    assert.ok(result.every(row => row.assignee === 'Jo' && row.platformRefresh.state === 'fresh'));
    await api.listConversations();
    assert.equal(requested.length, 18);
    now += 31_000;
    result = await api.listBookings(30);
    assert.equal(requested.length, 26);
    assert.equal(result.filter(row => row.platformRefresh.state === 'stale').length, 10);
    assert.ok(result.every(row => row.assignee === 'Jo'));
    await api.listBookings(30);
    await api.listBookings(30);
    assert.equal(requested.length, 36);
  } finally {
    Date.now = oldNow;
    globalThis.fetch = oldFetch;
    if (oldDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = oldDir;
    if (oldUrl === undefined) delete process.env.DDD_CUSTOMER_HISTORY_URL; else process.env.DDD_CUSTOMER_HISTORY_URL = oldUrl;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('statusSync is normative: ID-only is missing, fetch errors are errors, cached lifecycle keeps its timestamp', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-sync-contract-'));
  const oldDir = process.env.DATA_DIR, oldUrl = process.env.DDD_CUSTOMER_HISTORY_URL;
  const oldFetch = globalThis.fetch, oldNow = Date.now;
  let now = oldNow(), mode = 'missing';
  Date.now = () => now;
  process.env.DATA_DIR = dir;
  process.env.DDD_CUSTOMER_HISTORY_URL = 'https://test.invalid/sync-contract';
  globalThis.fetch = async () => {
    if (mode === 'error') throw new Error('offline');
    return { ok: true, json: async () => ({ bookings: [{ external_booking_id: 'local', assignee: 'Jo', ...(mode === 'matched' ? { status: 'Completed' } : {}) }] }) };
  };
  try {
    await fs.writeFile(path.join(dir, 'bookings.jsonl'), JSON.stringify({ bookingId: 'local', phone: '+15135550100', status: 'Requested' }) + '\n');
    const api = await import(`../src/receptionist.js?syncContract=${now}`);
    let [row] = await api.listBookings(20);
    assert.equal(row.statusSync.status, 'missing');
    assert.equal(row.statusSync.matchedAt, null);
    assert.equal(row.platformRefresh.state, 'unverified');
    assert.equal(row.status, 'Requested');
    now += 31_000; mode = 'error';
    [row] = await api.listBookings(20);
    assert.equal(row.statusSync.status, 'error');
    assert.equal(row.statusSync.matchedAt, null);
    assert.equal(row.platformRefresh.state, 'unverified');
    now += 31_000; mode = 'matched';
    [row] = await api.listBookings(20);
    const fetchedAt = new Date(now).toISOString();
    assert.deepEqual(row.statusSync, { status: 'matched', matchedAt: fetchedAt, checkedAt: fetchedAt });
    assert.equal(row.platformRefresh.state, 'fresh');
    now += 1_000;
    [row] = await api.listBookings(20);
    assert.equal(row.statusSync.matchedAt, fetchedAt);
    assert.equal(row.statusSync.checkedAt, fetchedAt);
  } finally {
    Date.now = oldNow; globalThis.fetch = oldFetch;
    if (oldDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = oldDir;
    if (oldUrl === undefined) delete process.env.DDD_CUSTOMER_HISTORY_URL; else process.env.DDD_CUSTOMER_HISTORY_URL = oldUrl;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
