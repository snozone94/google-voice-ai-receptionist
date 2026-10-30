import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decorateConversations, pendingTextReminders, workspaceStore, safeStaff } from "../src/dispatch-workspace.js";
const phone = "+15135550100";
const at = "2026-10-29T10:00:00Z";
const now = Date.parse(at) + 20 * 60000;
const staff = { ok: true, id: "one", name: "One", role: "tech" };
const other = { ok: true, id: "two", name: "Two", role: "tech" };
const admin = { ok: true, name: "Admin", role: "admin" };
const inbound = (minute, body = "Need help") => ({ direction: "inbound", createdAt: new Date(Date.parse(at) + minute * 60000).toISOString(), body, messageSid: `SM${minute}` });

test("reading an unsorted thread preserves needs-reply and its oldest waiting clock", () => {
  const conversation = { phone, messages: [inbound(10), inbound(0)] };
  const state = { [phone]: { readThrough: new Date(now).toISOString() } };
  const thread = decorateConversations([conversation], [], state)[0];
  assert.equal(thread.unread, 0);
  assert.equal(thread.firstUnreadAt, null);
  assert.equal(thread.needsReply, true);
  assert.equal(thread.waitingSince, inbound(0).createdAt);
  const reminder = pendingTextReminders([conversation], { state, now })[0];
  assert.equal(reminder.message.messageSid, "SM0");
  assert.equal(reminder.stage, "escalation");
  assert.equal(reminder.minutesWaiting, 20);
});

test("handled watermark suppresses reminders until a new request, without marking it read", () => {
  const state = { [phone]: { handledThrough: new Date(Date.parse(at) + 60000).toISOString() } };
  const conversation = { phone, messages: [inbound(0)] };
  const thread = decorateConversations([conversation], [], state)[0];
  assert.equal(thread.unread, 1);
  assert.equal(thread.firstUnreadAt, inbound(0).createdAt);
  assert.equal(thread.needsReply, false);
  assert.deepEqual(pendingTextReminders([thread], { now }), []);
  conversation.messages.push(inbound(2));
  assert.equal(pendingTextReminders([conversation], { state, now })[0].message.messageSid, "SM2");
});

test("staff replies resolve waiting; automation and failed replies do not", () => {
  const conversation = { phone, messages: [inbound(0), { direction: "outbound", createdAt: new Date(Date.parse(at) + 60000).toISOString(), agentName: "One", status: "failed" }] };
  assert.equal(decorateConversations([conversation], [])[0].needsReply, true);
  conversation.messages[1].status = "sent";
  assert.equal(decorateConversations([conversation], [])[0].needsReply, false);
  conversation.messages[1].source = "call_start";
  assert.equal(decorateConversations([conversation], [])[0].needsReply, true);
  assert.deepEqual(pendingTextReminders([{ phone, messages: [inbound(0, "STOP")] }], { now }), []);
});

test("reminder and escalation stages have distinct stable keys, even after a day", () => {
  const conversations = [{ phone, messages: [inbound(0)] }];
  assert.equal(pendingTextReminders(conversations, { now: Date.parse(at) + 4 * 60000 }).length, 0);
  const early = pendingTextReminders(conversations, { now: Date.parse(at) + 5 * 60000 })[0];
  const late = pendingTextReminders(conversations, { now: Date.parse(at) + 15 * 60000 })[0];
  assert.equal(early.stage, "reminder");
  assert.equal(late.stage, "escalation");
  assert.notEqual(early.key, late.key);
  assert.equal(pendingTextReminders(conversations, { now: Date.parse(at) + 25 * 3600000 })[0].key, late.key);
});

test("late incomplete call outcomes reopen attention, unrelated bookings cannot hide them", () => {
  const calls = [{ id: "call", caller: phone, startedAt: at, endedAt: new Date(now).toISOString(), status: "completed", completion: "incomplete" }];
  const state = { [phone]: { handledThrough: new Date(Date.parse(at) + 60000).toISOString() } };
  const conversations = [{ phone, bookings: [{ callId: "unrelated", createdAt: new Date(now).toISOString() }], messages: [] }];
  assert.equal(decorateConversations(conversations, calls, state)[0].needsFollowUp, true);
});

test("ownership is shared, serialized, persistent and limited to self/admin and active roster", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-workspace-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = workspaceStore(dir);
  const claims = await Promise.allSettled([store.mark(staff, phone, "claim"), store.mark(other, phone, "claim")]);
  assert.equal(claims.filter((result) => result.status === "fulfilled").length, 1);
  assert.deepEqual((await workspaceStore(dir).get(other))[phone].assignedTo, safeStaff(staff));
  await assert.rejects(() => store.mark(other, phone, "release"), { status: 403 });
  await assert.rejects(() => store.mark(staff, phone, "assign", null, { assignee: safeStaff(other), roster: [other] }), { status: 403 });
  await assert.rejects(() => store.mark(admin, phone, "assign", null, { assignee: safeStaff(other), roster: [{ ...other, active: false }] }));
  await assert.rejects(() => store.mark(admin, phone, "assign", null, { assignee: { id: "two", name: "Forged" }, roster: [other] }));
  await store.mark(admin, phone, "assign", null, { assignee: safeStaff(other), roster: [other] });
  await store.mark(other, phone, "unassign");
  assert.equal((await store.get(staff))[phone].assignedTo, null);
  await store.mark(staff, phone, "read", at);
  assert.equal((await store.get(other))[phone].readThrough, undefined);
  assert.throws(() => store.mark({ ok: true, role: "reviewer" }, phone, "claim"), { status: 403 });
});

test("activation baseline silences historical backlog but new inbound on that same thread gets its own clock", () => {
  const since = Date.parse("2026-10-29T10:00:00Z");
  const old = { direction: "inbound", body: "Old unresolved request", messageSid: "SMold", createdAt: "2026-01-01T10:00:00Z" };
  const conversation = { phone, messages: [old] };
  assert.equal(decorateConversations([conversation], [])[0].needsReply, true);
  assert.deepEqual(pendingTextReminders([conversation], { since, now: since + 20 * 60000 }), []);
  assert.equal(pendingTextReminders([conversation], { now: since + 20 * 60000 })[0].stage, "escalation");
  const fresh = { direction: "inbound", body: "New request", messageSid: "SMnew", createdAt: new Date(since + 60000).toISOString() };
  conversation.messages.push(fresh);
  assert.equal(decorateConversations([conversation], [])[0].waitingSince, old.createdAt);
  assert.deepEqual(pendingTextReminders([conversation], { since, now: since + 5 * 60000 }), []);
  const reminder = pendingTextReminders([conversation], { since, now: since + 6 * 60000 })[0];
  assert.equal(reminder.message.messageSid, "SMnew");
  assert.equal(reminder.minutesWaiting, 5);
  assert.equal(reminder.stage, "reminder");
  assert.match(reminder.key, /SMnew:reminder$/);
  const escalation = pendingTextReminders([conversation], { since, now: since + 16 * 60000 })[0];
  assert.equal(escalation.stage, "escalation");
  assert.match(escalation.key, /SMnew:escalation$/);
  const handled = { [phone]: { handledThrough: fresh.createdAt } };
  assert.deepEqual(pendingTextReminders([conversation], { since, state: handled, now: since + 20 * 60000 }), []);
  conversation.messages.push({ direction: "outbound", agentName: "One", status: "sent", createdAt: new Date(since + 2 * 60000).toISOString() });
  assert.deepEqual(pendingTextReminders([conversation], { since, now: since + 20 * 60000 }), []);
});
