import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConversations, newestUnreadIndex, workspaceSummary, ownerLabel, isOpenBooking, phoneKey, canWork, ownershipActions, workspaceState, notificationDestination, validateReplyPolicy, bookingOwnerLabel, bookingRequestedLabel, bookingStatusLabel, splitHomeTasks, taskWaitLabel } from '../workspace-view.js';

test('one thread per normalized phone retains messages, call transcripts and bookings', () => {
  const result = mergeConversations([
    { phone: '5551234567', unread: 1, messages: [{ messageSid: 'a', direction: 'inbound', body: 'Help', createdAt: '2026-10-29T10:00:00Z' }] },
    { phone: '+15551234567', unread: 2, needsFollowUp: true, messages: [{ messageSid: 'a', direction: 'inbound', body: 'Help', createdAt: '2026-10-29T10:00:00Z' }, { messageSid: 'b', body: 'Tire', createdAt: '2026-10-29T10:01:00Z' }] }
  ], [{ caller: '+15551234567', callId: 'call', transcript: 'Hello' }], [{ phone: '5551234567', bookingId: 'booking' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].messages.length, 2);
  assert.equal(result[0].unread, 2);
  assert.equal(result[0].needsReply, true);
  assert.equal(result[0].calls[0].transcript, 'Hello');
  assert.equal(result[0].bookings.length, 1);
});
test('call-only and booking-only customers can be opened as threads', () => {
  assert.equal(mergeConversations([], [{ caller: '+15551234567' }], [{ customerPhone: '+15557654321' }]).length, 2);
});
test('newest unread anchor is inbound even when a later outbound text exists', () => {
  assert.equal(newestUnreadIndex({ unread: 2, messages: [{ direction: 'inbound' }, { direction: 'inbound' }, { direction: 'outbound' }] }), 1);
  assert.equal(newestUnreadIndex({ unread: 0, messages: [{ direction: 'inbound' }] }), -1);
});
test('summary keeps legacy data, accepts new server counts and counts today open bookings', () => {
  const now = new Date('2026-10-29T12:00:00Z');
  const bookings = Array.from({ length: 35 }, () => ({ status: 'completed', scheduledAt: now.toISOString() }));
  bookings.push({ status: 'requested', scheduledAt: now.toISOString() });
  const summary = workspaceSummary({ bookings, conversations: [{ phone: '+15551234567', unread: 3, needsFollowUp: true }], summary: { activeCalls: 4, overdueReplies: 1 } }, now);
  assert.equal(summary.unreadMessages, 3);
  assert.equal(summary.needsReply, 1);
  assert.equal(summary.activeCalls, 4);
  assert.equal(summary.todayOpenBookings, 1);
  assert.equal(summary.openBookings, 1);
  assert.equal(bookings.filter(isOpenBooking).length, 1);
});
test('ownership and phone labels have usable fallbacks', () => {
  assert.equal(ownerLabel({ assignedTo: { name: 'Sam' } }), 'Sam');
  assert.equal(ownerLabel({}), 'Unassigned');
  assert.equal(phoneKey('123'), '');
  assert.equal(phoneKey('Sam 5551234567'), '');
  assert.equal(phoneKey('(555) 123-4567'), '+15551234567');
});

test('a customer name never overrides a valid phone identity; call-only selection uses the same merged list', () => {
  const threads = mergeConversations([{ customer: 'Pat', phone: '+15551234567' }], [{ caller: '+15557654321' }], [{ phone: '+15559876543' }]);
  assert.equal(threads.length, 3);
  for (const number of ['+15551234567', '+15557654321', '+15559876543']) assert.ok(threads.find(thread => thread.phone === number));
});
test('firstUnreadAt anchors the unread boundary, ahead of a later inbound text', () => {
  assert.equal(newestUnreadIndex({ unread: 2, firstUnreadAt: '2026-10-29T10:01:00Z', messages: [
    { direction: 'inbound', createdAt: '2026-10-29T10:00:00Z' },
    { direction: 'inbound', createdAt: '2026-10-29T10:01:00Z' },
    { direction: 'inbound', createdAt: '2026-10-29T10:02:00Z' }
  ] }), 1);
});
test('live-call fallback ignores stale active history and server today/all counts stay distinct', () => {
  assert.equal(workspaceSummary({ calls: [{ status: 'in-progress' }], liveCalls: [] }).activeCalls, 0);
  assert.equal(workspaceSummary({ liveCalls: [{ callId: 'live' }] }).activeCalls, 1);
  const result = workspaceSummary({ summary: { openBookings: 9, todayOpenBookings: 3, activeCalls: 2 } });
  assert.equal(result.openBookings, 9);
  assert.equal(result.todayOpenBookings, 3);
  assert.equal(result.activeCalls, 2);
});
test('reviewers cannot mutate ownership or retain an admin roster/health snapshot', () => {
  const reviewer = { ok: true, role: 'reviewer', id: 'reviewer' };
  const result = workspaceState({ staff: reviewer, conversations: [{ phone: '+15551234567', customerName: 'Demo' }], health: [{ detail: 'private' }], team: [{ id: 'private', name: 'Staff' }] });
  assert.equal(canWork(reviewer), false);
  assert.equal(result.health, null);
  assert.deepEqual(result.team, []);
  assert.equal(result.conversations[0].customerName, 'Demo');
  assert.deepEqual(ownershipActions(reviewer, { capabilities: { assign: true, claim: true, release: true, unassign: true } }), { assign: false, claim: false, release: false, unassign: false });
});
test('signout clears all workspace fields and a new session never merges previous fields', () => {
  const admin = { ok: true, role: 'admin' };
  let state = workspaceState({ staff: admin, conversations: [{ body: 'private' }], health: ['private'], team: ['private'], tasks: ['private'], replyPolicy: { remindAfterMinutes: 5 } });
  state = workspaceState(state, null);
  for (const field of ['conversations', 'calls', 'bookings', 'tasks', 'team', 'liveCalls']) assert.deepEqual(state[field], []);
  assert.equal(state.health, null);
  assert.equal(state.replyPolicy, null);
  assert.equal(state.staff, undefined);
  state = workspaceState({ staff: { ok: true, role: 'technician' }, conversations: [] });
  assert.equal(state.health, null);
  assert.deepEqual(state.team, []);
});
test('claim and release follow server capabilities; unassign remains admin-only', () => {
  const technician = { ok: true, role: 'technician', id: 'sam' };
  assert.equal(ownershipActions(technician, { capabilities: { claim: true, release: true, unassign: true } }).release, true);
  assert.equal(ownershipActions(technician, { capabilities: { claim: true, release: true, unassign: true } }).unassign, false);
  assert.equal(ownershipActions(technician, { capabilities: { release: false } }).release, false);
  assert.equal(ownershipActions({ ok: true, role: 'admin' }, { capabilities: { unassign: true } }).unassign, true);
});
test('notification payloads map to screens only; call notifications never become text targets', () => {
  assert.deepEqual(notificationDestination({ type: 'call', from: '+15551234567' }), { tab: 'Calls', phone: '' });
  assert.deepEqual(notificationDestination({ type: 'new-booking' }), { tab: 'Bookings', phone: '' });
  assert.deepEqual(notificationDestination({ type: 'sms', from: '+15551234567' }), { tab: 'Inbox', phone: '+15551234567' });
  assert.deepEqual(notificationDestination({ type: 'sms-delivery-failed', from: '+15557654321', to: '+15551234567' }), { tab: 'Inbox', phone: '+15551234567' });
  assert.deepEqual(notificationDestination({ type: 'unanswered-text', from: '+15551234567' }), { tab: 'Inbox', phone: '+15551234567' });
  assert.deepEqual(notificationDestination({ type: 'unknown' }), { tab: 'Home', phone: '' });
});
test('reply policy validation matches persisted backend limits', () => {
  assert.deepEqual(validateReplyPolicy({ remindAfterMinutes: '5', escalateAfterMinutes: '15' }), { remindAfterMinutes: 5, escalateAfterMinutes: 15 });
  for (const value of [{ remindAfterMinutes: 0, escalateAfterMinutes: 5 }, { remindAfterMinutes: 61, escalateAfterMinutes: 90 }, { remindAfterMinutes: 5, escalateAfterMinutes: 5 }, { remindAfterMinutes: 5, escalateAfterMinutes: 1441 }, { remindAfterMinutes: 1.5, escalateAfterMinutes: 15 }]) assert.throws(() => validateReplyPolicy(value));
});

test('refreshed lifecycle assignee and serviceTime win over obsolete intake fields in merged threads', () => {
  const local = { bookingId: 'job-1', phone: '+15551234567', status: 'requested', assignedTo: { name: 'Old tech' }, preferredTime: '2026-10-28T10:00:00Z' };
  const refreshed = { ...local, status: 'tech-completed', assignee: 'Tech Jo', serviceTime: '2026-10-30T15:00:00Z' };
  const [thread] = mergeConversations([{ phone: local.phone, bookings: [local] }], [], [refreshed]);
  assert.equal(thread.bookings.length, 1);
  assert.equal(bookingOwnerLabel(thread.bookings[0]), 'Tech Jo');
  assert.equal(bookingRequestedLabel(thread.bookings[0]), '2026-10-30T15:00:00Z');
  assert.equal(bookingStatusLabel(thread.bookings[0]), 'Completed');
  assert.equal(isOpenBooking(thread.bookings[0]), false);
  assert.equal(bookingOwnerLabel({ assignee: { id: 'safe', name: 'Alex' }, assigneeName: 'Old name' }), 'Alex');
  assert.equal(bookingOwnerLabel({ assignee: '', assignedTo: { name: 'Sam' } }), 'Sam');
});
test('booking aliases preserve platform priority and the summary uses refreshed service time', () => {
  assert.equal(isOpenBooking({ platformStatus: 'assigned', status: 'completed' }), true);
  for (const status of ['resolved', 'technician-completed', 'declined', 'failed']) assert.equal(isOpenBooking({ status }), false);
  const now = new Date('2026-10-29T12:00:00Z');
  const summary = workspaceSummary({ bookings: [{ status: 'assigned', serviceTime: now.toISOString(), preferredTime: '2026-10-28T12:00:00Z' }] }, now);
  assert.equal(summary.todayOpenBookings, 1);
});
test('new customer identity reads customer fields without treating call event names as customer names', () => {
  const [bookingThread] = mergeConversations([], [], [{ customer_phone: '5551234567', customer_name: 'Jo', name: 'Older name' }]);
  assert.equal(bookingThread.phone, '+15551234567');
  assert.equal(bookingThread.customerName, 'Jo');
  const [callThread] = mergeConversations([], [{ caller: '+15557654321', name: 'twilio.call.status' }]);
  assert.equal(callThread.customerName, undefined);
});
test('missing or failed user authentication exposes no workspace data or ownership actions', () => {
  const privateSnapshot = { staff: { ok: true, role: 'admin' }, conversations: [{ phone: '+15551234567' }], bookings: [{ assignee: 'Tech Jo', serviceTime: 'Tomorrow' }], team: [{ name: 'Staff' }], health: ['private'], summary: { openBookings: 1 } };
  for (const staff of [null, {}, { ok: false, role: 'admin' }]) {
    const state = workspaceState(privateSnapshot, staff);
    assert.deepEqual(state.conversations, []);
    assert.deepEqual(state.bookings, []);
    assert.deepEqual(state.team, []);
    assert.equal(state.summary, null);
    assert.equal(canWork(staff), false);
    assert.deepEqual(ownershipActions(staff, { capabilities: { assign: true, claim: true, release: true, unassign: true } }), { assign: false, claim: false, release: false, unassign: false });
  }
  assert.deepEqual(workspaceState({ conversations: privateSnapshot.conversations }).conversations, []);
});

test('Home keeps all older requests collapsed separately without changing follow-up state', () => {
  const tasks = [
    Object.freeze({ phone: '+15551234567', historical: true, priority: 'urgent', minutesWaiting: 71341, unread: 2, needsReply: true }),
    Object.freeze({ phone: '+15557654321', historical: false, priority: 'normal', minutesWaiting: 5 }),
    Object.freeze({ phone: '+15559876543', priority: 'urgent', minutesWaiting: 60 }),
    Object.freeze({ phone: '+15553456789', historical: true, minutesWaiting: 80000 })
  ];
  const { current, historical } = splitHomeTasks(Object.freeze(tasks));
  assert.deepEqual(current, [tasks[1], tasks[2]]);
  assert.deepEqual(historical, [tasks[0], tasks[3]]);
  assert.equal(current.length + historical.length, tasks.length);
  assert.equal(historical[0].unread, 2);
  assert.equal(historical[0].needsReply, true);
  assert.equal(historical[0].priority, 'urgent');
  assert.deepEqual(splitHomeTasks(), { current: [], historical: [] });
});
test('Home wait labels use readable minutes, hours and days at unit boundaries', () => {
  assert.equal(taskWaitLabel(71341), '49 days waiting');
  assert.equal(taskWaitLabel(1), '1 min waiting');
  assert.equal(taskWaitLabel(59), '59 min waiting');
  assert.equal(taskWaitLabel(60), '1 hour waiting');
  assert.equal(taskWaitLabel(90), '1 hour 30 min waiting');
  assert.equal(taskWaitLabel(120), '2 hours waiting');
  assert.equal(taskWaitLabel(1440), '1 day waiting');
  assert.equal(taskWaitLabel(2880), '2 days waiting');
  assert.equal(taskWaitLabel(0), 'Just now');
  assert.equal(taskWaitLabel(null), 'Waiting for follow-up');
  assert.equal(taskWaitLabel('bad'), 'Waiting for follow-up');
});
