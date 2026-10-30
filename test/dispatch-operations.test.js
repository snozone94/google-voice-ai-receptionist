import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { operationsSnapshot, operationsHandlers, operationsHealth, replyPolicyStore, validateReplyPolicy, notificationAudience, reminderAudience, canonicalBookingStatus, isOpenBooking, bookingServiceDay, easternBookingDay, bookingSyncHealth } from "../src/dispatch-operations.js";
const staff = { ok: true, id: "one", name: "One", role: "tech" };
const admin = { ok: true, id: "admin", name: "Admin", role: "admin" };
const policy = { remindAfterMinutes: 5, escalateAfterMinutes: 15 };

test("operations preserves legacy fields, exposes safe team/capabilities and Eastern booking counts", () => {
  const input = { staff, conversations: [{ phone: "+15135550100", messages: [{ direction: "inbound", createdAt: "2026-10-29T03:30:00Z", body: "Need a tire" }] }], calls: [], bookings: [{ status: "Requested", createdAt: "2026-10-29T03:00:00Z" }, { status: "Requested", createdAt: "2026-10-29T04:30:00Z" }, { status: "Completed", createdAt: "2026-10-29T04:30:00Z" }], voice: { ready: true }, activeCalls: [{}], replyPolicy: policy, team: [{ ...staff, code: "secret", email: "private@example.test" }], now: Date.parse("2026-10-29T05:00:00Z"), health: [{ key: "storage" }] };
  const result = operationsSnapshot(input);
  for (const key of ["staff", "conversations", "calls", "bookings", "attention", "voice"]) assert.ok(key in result);
  assert.deepEqual(result.summary, { olderRequests: 0, activeCalls: 1, unreadMessages: 1, needsReply: 1, openBookings: 2, todayOpenBookings: 1, overdueReplies: 1 });
  assert.deepEqual(result.team, [{ id: "one", name: "One", role: "tech", active: true }]);
  assert.equal(result.health, undefined);
  assert.deepEqual(result.conversations[0].capabilities, { claim: true, assign: false, release: false, unassign: false });
  assert.equal(result.tasks[0].priority, "urgent");
  const owned = operationsSnapshot({ ...input, staff: admin, state: { "+15135550100": { assignedTo: { id: "two", name: "Two" } } } });
  assert.equal(owned.conversations[0].capabilities.claim, false);
  assert.equal(owned.conversations[0].capabilities.assign, true);
  assert.equal(owned.conversations[0].capabilities.release, true);
  assert.ok(owned.health);
});

test("reviewer snapshot bypasses all real data, policy and roster reads; writes are forbidden", async () => {
  let reads = 0;
  const forbidden = async () => { reads++; throw new Error("Real data read"); };
  const handlers = operationsHandlers({ workspace: { get: forbidden, mark: forbidden }, policy: { get: forbidden, set: forbidden }, load: forbidden, roster: forbidden, synthetic: (staff) => ({ staff, conversations: [{ phone: "demo" }] }) });
  const reviewer = { ok: true, role: "reviewer" };
  assert.equal((await handlers.snapshot(reviewer)).conversations[0].phone, "demo");
  for (const operation of [() => handlers.mutate(reviewer, "phone", { action: "claim" }), () => handlers.getPolicy(reviewer), () => handlers.setPolicy(reviewer, policy), () => handlers.snapshot({ ok: false }), () => handlers.mutate(staff, "phone", { action: "assign" })]) await assert.rejects(operation, { status: 403 });
  assert.equal(reads, 0);
});

test("reply policy validates, persists, survives restart and is admin-only", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-policy-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = replyPolicyStore(dir, {});
  assert.deepEqual(await store.get(), policy);
  for (const value of [{ remindAfterMinutes: 0, escalateAfterMinutes: 15 }, { remindAfterMinutes: 5.5, escalateAfterMinutes: 15 }, { remindAfterMinutes: 5, escalateAfterMinutes: 5 }, { remindAfterMinutes: "bad", escalateAfterMinutes: 20 }]) assert.throws(() => validateReplyPolicy(value));
  const handlers = operationsHandlers({ policy: store });
  await assert.rejects(() => handlers.setPolicy(staff, policy), { status: 403 });
  await handlers.setPolicy(admin, { remindAfterMinutes: 7, escalateAfterMinutes: 20 });
  assert.deepEqual(await replyPolicyStore(dir, {}).get(), { remindAfterMinutes: 7, escalateAfterMinutes: 20 });
});

test("health distinguishes acceptance, actual delivery, failure, missing configuration and stale evidence", () => {
  const now = Date.now();
  const health = operationsHealth({ now, configured: { calling: true, sms: true, email: true }, tokenCount: 1, teamCount: 2, outcomes: { push: { status: "failed", at: new Date(now).toISOString() }, email: { status: "accepted", at: new Date(now).toISOString() }, sms: { status: "delivered", at: new Date(now).toISOString() }, calling: { status: "failed", at: new Date(now - 2 * 86400000).toISOString() } } });
  const byKey = Object.fromEntries(health.map((row) => [row.key, row]));
  assert.equal(byKey.push.status, "error");
  assert.equal(byKey.email.status, "unknown");
  assert.match(byKey.email.detail, /accepted/);
  assert.equal(byKey.sms.status, "ok");
  assert.equal(byKey.calling.status, "unknown");
  assert.equal(byKey.team.status, "ok");
  assert.equal(operationsHealth({ storage: false })[5].status, "error");
});

test("notification audiences exclude other staff, reviewers and disabled devices", () => {
  const token = { staffId: "one", staffName: "One", staffRole: "tech" };
  assert.equal(notificationAudience(token, { staffIds: ["one"] }), true);
  assert.equal(notificationAudience(token, { staffIds: ["two"] }), false);
  assert.equal(notificationAudience(token, { adminOnly: true }), false);
  assert.equal(notificationAudience({ ...token, staffRole: "admin" }, { adminOnly: true }), true);
  assert.equal(notificationAudience({ ...token, staffRole: "reviewer" }), false);
  assert.equal(notificationAudience({ ...token, enabled: false }), false);
});

test("reminder routing uses active roster identities; escalations exclude removed admins", () => {
  const roster = [{ id: "one", name: "One", role: "tech", email: "one@example.test" }, { id: "admin", name: "Admin", role: "admin" }, { id: "removed", name: "Removed", role: "admin", active: false }];
  const reminder = reminderAudience({ stage: "reminder", assignedTo: { id: "one" } }, roster);
  assert.deepEqual(reminder, { staffIds: ["one"], emailTo: ["one@example.test"] });
  const escalation = reminderAudience({ stage: "escalation", assignedTo: { id: "one" } }, roster);
  assert.equal(notificationAudience({ staffRole: "admin", staffId: "removed" }, escalation), false);
  assert.equal(notificationAudience({ staffRole: "admin", staffId: "admin" }, escalation), true);
});

test("authoritative platform status and canonical terminal aliases control open counts", () => {
  for (const status of ["Completed", "Cleared", "Done", "Technician Completed", "technician_completed", "TECH-COMPLETE", "Cancelled", "Canceled", "Closed", "Rejected", "Failed"]) assert.equal(isOpenBooking({ status }), false, status);
  assert.equal(canonicalBookingStatus({ platformStatus: "Done", status: "Requested" }), "completed");
  assert.equal(isOpenBooking({ platformStatus: "Requested", status: "Completed" }), true);
  assert.equal(isOpenBooking({ status: "Incomplete" }), true);
  assert.equal(isOpenBooking({ status: "Not completed" }), true);
});

test("service day prefers scheduled fields and uses Eastern dates independent of server TZ", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "Pacific/Honolulu"]) {
      process.env.TZ = zone;
      assert.equal(bookingServiceDay({ serviceTime: "2026-10-30T01:00:00Z", createdAt: "2026-10-28T12:00:00Z" }), "2026-10-29");
      assert.equal(bookingServiceDay({ appointmentAt: "2026-10-30T09:00:00", scheduledAt: "2026-10-31", createdAt: "2026-10-29T12:00:00Z" }), "2026-10-30");
      assert.equal(bookingServiceDay({ scheduledAt: "2026-10-30", createdAt: "2026-10-29T12:00:00Z" }), "2026-10-30");
      assert.equal(bookingServiceDay({ preferredTime: "10/30/2026 9:00 AM", createdAt: "2026-10-29T12:00:00Z" }), "2026-10-30");
      assert.equal(bookingServiceDay({ preferredTime: "ASAP", createdAt: "2026-10-29T03:59:00Z" }), "2026-10-28");
      assert.equal(easternBookingDay("2026-11-01T03:59:00Z"), "2026-10-31");
      assert.equal(easternBookingDay("2026-11-01T04:00:00Z"), "2026-11-01");
      assert.equal(easternBookingDay("2026-02-30"), "");
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  const snapshot = operationsSnapshot({ staff, conversations: [], calls: [], voice: {}, replyPolicy: policy, now: Date.parse("2026-10-29T12:00:00Z"), bookings: [{ status: "Requested", scheduledAt: "2026-10-29", createdAt: "2026-10-28T12:00:00Z" }, { status: "Requested", scheduledAt: "2026-10-30", createdAt: "2026-10-29T12:00:00Z" }, { status: "Requested", platformStatus: "Cleared", scheduledAt: "2026-10-29" }] });
  assert.equal(snapshot.summary.openBookings, 2);
  assert.equal(snapshot.summary.todayOpenBookings, 1);
});

test("sync health requires a matched lifecycle timestamp; creation acceptance and empty lookups do not refresh it", () => {
  const now = Date.now();
  const unknown = bookingSyncHealth([{ externalSync: { ok: true }, updatedAt: new Date(now).toISOString() }], { configured: true, now });
  assert.equal(unknown.status, "unknown");
  assert.match(unknown.detail, /1 unverified/);
  const fresh = { statusSync: { status: "matched", matchedAt: new Date(now - 60000).toISOString() } };
  assert.equal(bookingSyncHealth([fresh], { configured: true, now }).status, "ok");
  assert.equal(bookingSyncHealth([fresh], { configured: true, now: now + 30 * 60000 }).status, "warning");
  const missing = bookingSyncHealth([{ statusSync: { status: "missing", checkedAt: new Date(now).toISOString() } }], { configured: true, now });
  assert.equal(missing.status, "warning");
  assert.match(missing.detail, /0 lifecycle matches/);
  assert.match(missing.detail, /1 absent remote matches/);
  const failed = bookingSyncHealth([{ statusSync: { status: "error", matchedAt: new Date(now - 60000).toISOString() }, externalSync: { ok: false, error: "Rejected" } }], { configured: true, now });
  assert.equal(failed.status, "error");
  assert.match(failed.detail, /1 stale/);
});

test("actual receptionist platformRefresh metadata distinguishes exact matches from empty/failed lookups", () => {
  const now = Date.now(), checkedAt = new Date(now - 60000).toISOString();
  const options = { configured: true, now };
  assert.equal(bookingSyncHealth([{ platformRefresh: { state: "fresh", checkedAt } }], options).status, "ok");
  assert.equal(bookingSyncHealth([{ platformRefresh: { state: "stale", checkedAt } }], options).status, "warning");
  const unverified = bookingSyncHealth([{ platformRefresh: { state: "unverified", checkedAt }, externalSync: { ok: true } }], options);
  assert.equal(unverified.status, "unknown");
  assert.match(unverified.detail, /No verified lifecycle match timestamp/);
  assert.equal(bookingSyncHealth([{ platformRefresh: { state: "error", checkedAt } }], options).status, "error");
});

test("normative missing lifecycle overrides legacy fresh without treating an ID-only lookup as verified", () => {
  const now = Date.now(), checkedAt = new Date(now).toISOString();
  const row = { platformRefresh: { state: "fresh", checkedAt }, statusSync: { status: "missing", matchedAt: null, checkedAt } };
  const result = bookingSyncHealth([row], { configured: true, now });
  assert.equal(result.status, "warning");
  assert.match(result.detail, /0 lifecycle matches/);
  assert.match(result.detail, /1 unverified/);
  assert.match(result.detail, /1 absent remote matches/);
  assert.match(result.detail, /No verified lifecycle match timestamp/);
});

test("current call follow-up sorts before ten-week-old unanswered requests without resolving the backlog", () => {
  const now = Date.parse("2026-10-29T16:00:00Z");
  const oldPhone = "+15135550100", callPhone = "+15135550101";
  const ancient = new Date(now - 70 * 86400000).toISOString();
  const result = operationsSnapshot({ staff, replyPolicy: policy, voice: {}, bookings: [], now,
    conversations: [{ phone: oldPhone, messages: [{ direction: "inbound", body: "Old unanswered request", createdAt: ancient }] }, { phone: callPhone, messages: [] }],
    calls: [{ callId: "current-call", caller: callPhone, startedAt: new Date(now - 120000).toISOString(), endedAt: new Date(now - 60000).toISOString(), status: "completed", completion: "incomplete" }]
  });
  assert.deepEqual(result.tasks.map((task) => task.phone), [callPhone, oldPhone]);
  assert.equal(result.tasks[0].historical, false);
  assert.equal(result.tasks[0].priority, "normal");
  assert.equal(result.tasks[1].historical, true);
  assert.equal(result.tasks[1].priority, "review");
  assert.equal(result.summary.olderRequests, 1);
  assert.equal(result.summary.needsReply, 1);
  assert.equal(result.attention.followUp, 2);
  assert.equal(result.conversations[0].needsReply, true);
  assert.equal(result.conversations[0].waitingSince, ancient);
});

test("recent activity on an old thread keeps it active; exactly 24 hours is not historical", () => {
  const now = Date.parse("2026-10-29T16:00:00Z");
  const ancient = new Date(now - 70 * 86400000).toISOString();
  const conversation = (phone, messages) => ({ phone, messages: messages.map((createdAt) => ({ direction: "inbound", body: "Need help", createdAt })) });
  const result = operationsSnapshot({ staff, replyPolicy: policy, voice: {}, bookings: [], calls: [], now,
    conversations: [conversation("+15135550100", [ancient, new Date(now - 60000).toISOString()]), conversation("+15135550101", [new Date(now - 86400000).toISOString()]), conversation("+15135550102", [new Date(now - 86400001).toISOString()])]
  });
  assert.deepEqual(result.tasks.map((task) => task.historical), [false, false, true]);
  assert.equal(result.summary.olderRequests, 1);
  assert.equal(result.summary.needsReply, 3);
});
