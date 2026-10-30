import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLiveCalls } from "../src/live-calls.js";

const id = `CA${"a".repeat(32)}`;
const conferenceSid = `CF${"b".repeat(32)}`;
const settleAlerts = () => new Promise(resolve => setTimeout(resolve, 40));
async function waitFor(predicate) {
  const deadline = Date.now() + 3000;
  while (!await predicate()) {
    assert.ok(Date.now() < deadline, "mocked recovery did not settle within three seconds");
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-live-test-"));

  const actions = [];
  let failUnmute = false;
  const participants = (sid) => ({ update: async (patch) => { actions.push(["update", sid, patch]); if (failUnmute && patch.muted === false && sid !== "ai-leg") throw new Error("phone disconnected"); }, fetch: async () => { throw Object.assign(new Error("not found"), { status: 404 }); }, remove: async () => { actions.push(["remove", sid]); } });
  participants.create = async (options) => { actions.push(["create", options]); return { callSid: options.label === "ddd-ai" ? "ai-leg" : options.label }; };
  const dependencies = { directory, client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }), update: async () => {} }) }), baseUrl: () => "https://dispatch.example.test", routingIdentities: async () => ["tech-one"], saveCallEvent: async (event) => actions.push(["event", event]), stopAssistant: () => actions.push(["stop-ai"]) };
  Object.assign(dependencies, overrides);
  const calls = createLiveCalls(dependencies);
  t.after(async () => { await calls.close(); await fs.rm(directory, { recursive: true, force: true }); });
  await calls.start({ id, phone: "+15135550100", businessPhone: "+15134091342", aiUri: "sip:project@example.test;transport=tls", recordingCallback: "https://dispatch.example.test/recording" });
  const event = (label, sid, type = "participant-join") => calls.events(id, { ConferenceSid: conferenceSid, FriendlyName: `ddd-${id}`, ParticipantLabel: label, CallSid: sid, StatusCallbackEvent: type });
  await event("customer", id);
  await event("ddd-ai", "ai-leg");
  return { calls, event, actions, dependencies, failUnmute: () => { failUnmute = true; } };
}

test("repeated provider callbacks do not dial AI or team twice", async (t) => {
  const { calls, event, actions } = await fixture(t);
  await event("customer", id);
  assert.equal(actions.filter(([kind, options]) => kind === "create" && options.label === "ddd-ai").length, 1);
  assert.equal(actions.filter(([kind, options]) => kind === "create" && options.label === "staff-tech-one").length, 1);
  const list = await calls.list("tech-one");
  assert.equal(list[0].capabilities.listen, true);
  assert.equal(JSON.stringify(list).includes("linkToken"), false);
  assert.equal(JSON.stringify(list).includes("example.test"), false);
});

test("listening stays muted; takeover only proceeds after the phone joins", async (t) => {
  const { calls, event, actions } = await fixture(t);
  const twiml = await calls.join(id, "listener", "listen-leg", "listen", "Bria");
  assert.match(twiml, /muted="true"/);
  await assert.rejects(calls.takeOver(id, "listener"), /Join this call/);
  await event("staff-listener", "listen-leg");
  assert.equal(actions.some(([kind]) => kind === "update"), false);
  await calls.takeOver(id, "listener");
  const operations = actions.filter(([kind]) => ["update", "remove"].includes(kind));
  assert.deepEqual(operations.slice(0, 3), [["update", "ai-leg", { muted: true }], ["update", "listen-leg", { muted: false, endConferenceOnExit: true }], ["remove", "ai-leg"]]);
  assert.equal((await calls.list("listener"))[0].ownedByYou, true);
});

test("failed takeover restores AI audio and does not claim ownership", async (t) => {
  const { calls, event, failUnmute, actions } = await fixture(t);
  await calls.join(id, "listener", "listen-leg", "listen");
  await event("staff-listener", "listen-leg");
  failUnmute();
  await assert.rejects(calls.takeOver(id, "listener"), /phone disconnected/);
  assert.deepEqual(actions.filter(([kind]) => kind === "update").at(-1), ["update", "ai-leg", { muted: false }]);
  assert.equal((await calls.list("listener"))[0].ownedByYou, false);
});

test("only one staff member owns a call; ended calls cannot be joined", async (t) => {
  const { calls, event } = await fixture(t);
  await calls.join(id, "one", "leg-one", "listen");
  await calls.join(id, "two", "leg-two", "listen");
  await event("staff-one", "leg-one");
  await event("staff-two", "leg-two");
  const results = await Promise.allSettled([calls.takeOver(id, "one"), calls.takeOver(id, "two")]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  await event("customer", id, "conference-end");
  assert.equal((await calls.list("one")).length, 0);
  await assert.rejects(calls.join(id, "three", "leg-three"), /ended/);
});

test("sessions and call configuration survive restart without exposing join secrets", async (t) => {
  const { calls, dependencies } = await fixture(t);
  await calls.config({ enabled: true, ringTeam: false });
  await calls.close();
  const restarted = createLiveCalls(dependencies);
  t.after(() => restarted.close());
  assert.deepEqual(await restarted.config(), { enabled: true, ringTeam: false, transcribeCalls: true });
  assert.equal((await restarted.list("one"))[0].phone, "+15135550100");
  assert.equal(await restarted.linkAi(id, "invalid", "rt-call"), null);
  await assert.rejects(restarted.events(id, { ConferenceSid: "wrong", FriendlyName: `ddd-${id}` }), /mismatch/);
  await restarted.close();
});

test("transcript provider failure does not interrupt AI pickup or team takeover", async (t) => {
  const { calls, event, actions } = await fixture(t, { startTranscription: async () => { throw new Error("transcription offline"); } });
  assert.equal(actions.filter(([kind, options]) => kind === "create" && options.label === "ddd-ai").length, 1);
  await calls.join(id, "one", "leg-one", "listen");
  await event("staff-one", "leg-one");
  await calls.takeOver(id, "one");
  assert.equal((await calls.list("one"))[0].ownedByYou, true);
});

test("full-call transcript continues after the AI is removed", async (t) => {
  const turns = [{ text: "AI greeting", speaker: "DDD" }];
  const { calls, event } = await fixture(t, { getTranscription: async () => ({ status: "live", turns: [...turns] }) });
  await calls.join(id, "one", "leg-one", "listen");
  await event("staff-one", "leg-one");
  await calls.takeOver(id, "one");
  turns.push({ text: "Hello, this is Bria", speaker: "DDD" }, { text: "Thank you", speaker: "Customer" });
  assert.equal((await calls.list("one"))[0].transcript.length, 3);
});

test("AI completion before conference end is not a pickup failure", async (t) => {
  const alerts = [];
  const { calls, event } = await fixture(t, { aiDisconnectGraceMs: 5, notify: async alert => alerts.push(alert) });
  await calls.participantStatus(id, "ddd-ai", { CallSid: "ai-leg", CallStatus: "completed" });
  await event("customer", id, "conference-end");
  await settleAlerts();
  assert.equal(alerts.filter(alert => alert.data.type === "ai-pickup-failed").length, 0);
});

test("ended customer leg suppresses an out-of-order AI failure callback", async (t) => {
  const alerts = [];
  const { calls, dependencies } = await fixture(t, { aiDisconnectGraceMs: 5, notify: async alert => alerts.push(alert) });
  const client = dependencies.client();
  dependencies.client = () => client;
  // Restart with a provider that confirms the caller already disconnected.
  await calls.close();
  const restarted = createLiveCalls({ ...dependencies, client: () => ({ ...client, calls: () => ({ fetch: async () => ({ status: "completed" }) }) }) });
  t.after(() => restarted.close());
  await restarted.participantStatus(id, "ddd-ai", { CallSid: "ai-leg", CallStatus: "completed" });
  await settleAlerts();
  assert.equal(alerts.length, 0);
  await restarted.close();
});

test("real AI disconnect while caller is connected alerts once despite retries", async (t) => {
  const alerts = [];
  const { calls } = await fixture(t, { aiDisconnectGraceMs: 5, notify: async alert => alerts.push(alert) });
  await calls.participantStatus(id, "ddd-ai", { CallSid: "ai-leg", CallStatus: "failed" });
  await calls.participantStatus(id, "ddd-ai", { CallSid: "ai-leg", CallStatus: "failed" });
  await settleAlerts();
  await calls.participantStatus(id, "ddd-ai", { CallSid: "ai-leg", CallStatus: "failed" });
  await settleAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].data.type, "ai-pickup-failed");
});

async function recoveredFixture(t, patch = {}, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-recovery-test-"));
  const state = { id, phone: "+15135550100", businessPhone: "+15134091342", aiUri: "sip:ai@example.test", room: `ddd-${id}`, linkToken: "secret", startedAt: new Date(Date.now() - 60000).toISOString(), conferenceSid, ringTeam: false, staff: {}, status: "Connecting", aiState: "failed", ...patch };
  await fs.writeFile(path.join(directory, "live-call-sessions.json"), JSON.stringify({ [id]: state }));
  const actions = [];
  const participants = label => ({ fetch: async () => { actions.push(["verify", label]); throw Object.assign(new Error("missing"), { status: 404 }); } });
  participants.create = async options => { actions.push(["dial", options.label]); return { callSid: options.label }; };
  const dependencies = { directory, client: () => ({ conferences: () => ({ participants }), calls: sid => ({ fetch: async () => { actions.push(["call", sid]); return { status: sid === id ? "in-progress" : "completed" }; } }) }), routingIdentities: async () => ["one"], baseUrl: () => "https://example.test", saveCallEvent: async () => {}, notify: async () => { actions.push(["alert"]); return { ok: true }; }, fallback: async () => { actions.push(["fallback"]); }, recoveryRetryMs: 5, aiDisconnectGraceMs: 5, pickupTimeoutMs: 25, ...overrides };
  const calls = createLiveCalls(dependencies);
  t.after(async () => { await calls.close(); await fs.rm(directory, { recursive: true, force: true }); });
  const read = async () => { await calls.close(); return JSON.parse(await fs.readFile(path.join(directory, "live-call-sessions.json"), "utf8"))[id]; };
  await calls.config();
  return { calls, dependencies, directory, actions, read };
}

test("startup restores an overdue pickup deadline without list requests or callbacks", async t => {
  const { actions, read } = await recoveredFixture(t);
  await settleAlerts();
  assert.equal(actions.filter(([kind]) => kind === "fallback").length, 1);
  assert.equal(actions.filter(([kind]) => kind === "alert").length, 1);
  assert.equal((await read()).aiAlerted, true);
  assert.ok(actions.findIndex(([kind]) => kind === "call") < actions.findIndex(([kind]) => kind === "fallback"));
});

test("restart retires ended callers and never falls back or alerts them", async t => {
  const { actions, read } = await recoveredFixture(t, {}, { client: () => ({ calls: () => ({ fetch: async () => ({ status: "completed" }) }) }) });
  await settleAlerts();
  assert.ok((await read()).endedAt);
  assert.equal(actions.length, 0);
});

test("failed and skipped notifications retry, and only successful delivery is persisted", async t => {
  let attempts = 0;
  const { read } = await recoveredFixture(t, {}, { notify: async () => { attempts++; if (attempts === 1) throw new Error("offline"); return { ok: attempts === 3, skipped: attempts === 2 }; } });
  await waitFor(() => attempts === 3);
  const state = await read();
  assert.equal(attempts, 3);
  assert.equal(state.aiAlerted, true);
  assert.equal(state.aiAlertAttempts, 3);
});

test("notification retry budget survives restart", async t => {
  let attempts = 0;
  const { dependencies, calls, directory } = await recoveredFixture(t, { aiAlertPending: true, aiAlertAttempts: 2 }, { notify: async () => { attempts++; return { ok: false }; } });
  await settleAlerts();
  await calls.close();
  const restarted = createLiveCalls(dependencies);
  t.after(() => restarted.close());
  await restarted.config();
  await settleAlerts();
  await restarted.close();
  assert.equal(attempts, 1);
  const state = JSON.parse(await fs.readFile(path.join(directory, "live-call-sessions.json"), "utf8"))[id];
  assert.equal(state.aiAlertAttempts, 3);
  assert.notEqual(state.aiAlerted, true);
});

test("definite rate-limit rejection retries staff once; accepted legs never redial", async t => {
  let dials = 0;
  const participants = () => ({ fetch: async () => { throw Object.assign(new Error("missing"), { status: 404 }); } });
  participants.create = async () => { dials++; if (dials === 1) throw Object.assign(new Error("rate limited"), { status: 429 }); return { callSid: "staff-leg" }; };
  const { calls, read } = await recoveredFixture(t, { ringTeam: true }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await waitFor(() => dials === 2);
  const state = await read();
  assert.equal(dials, 2);
  assert.equal(state.rangTeam, true);
  assert.equal(state.staff.one.dialAttempts, 2);
  // Callback replay cannot redial either leg, even after timers finish.
  await calls.events(id, { ConferenceSid: conferenceSid, CallSid: id, ParticipantLabel: "customer", StatusCallbackEvent: "participant-join" });
  assert.equal(dials, 2);
});

test("ambiguous staff create is verified but never redialed or followed by duplicate fallback dialing", async t => {
  let dials = 0;
  const participants = () => ({ fetch: async () => { throw Object.assign(new Error("missing"), { status: 404 }); } });
  participants.create = async () => { dials++; throw new Error("response lost after submission"); };
  const { actions, read } = await recoveredFixture(t, { ringTeam: true }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await new Promise(resolve => setTimeout(resolve, 75));
  const state = await read();
  assert.equal(dials, 1);
  assert.equal(state.staff.one.dialState, "uncertain");
  assert.equal(state.rangTeam, false);
  assert.equal(actions.some(([kind]) => kind === "fallback"), false);
  assert.equal(state.recoveryAttempts, 3);
});

test("legacy ringing intent and pending staff calls prevent duplicate fallback dialing", async t => {
  const { actions } = await recoveredFixture(t, { rangTeam: true, ringTeam: true, staff: { one: { joined: false } } });
  await settleAlerts();
  assert.equal(actions.some(([kind]) => ["dial", "fallback"].includes(kind)), false);
});

test("actual AI participant rescues a lost join callback without a false failure alert", async t => {
  const participants = label => ({ fetch: async () => { if (label === "ddd-ai") return { callSid: "ai-leg", status: "connected" }; throw Object.assign(new Error("missing"), { status: 404 }); } });
  const { actions, read } = await recoveredFixture(t, { aiState: "creating", aiAlertPending: true }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await settleAlerts();
  const state = await read();
  assert.equal(state.aiState, "connected");
  assert.equal(state.aiCallSid, "ai-leg");
  assert.equal(actions.length, 0);
});

test("lost fallback response never replays a redirect after restart", async t => {
  let redirects = 0;
  const { dependencies, calls } = await recoveredFixture(t, {}, { fallback: async () => { redirects++; throw new Error("response lost"); } });
  await settleAlerts();
  await calls.close();
  const restarted = createLiveCalls(dependencies);
  t.after(() => restarted.close());
  await restarted.config();
  await settleAlerts();
  await restarted.close();
  assert.equal(redirects, 1);
});

test("missing conference callback recovers the room only after verifying its customer SID", async t => {
  let creates = 0;
  const participants = label => ({ fetch: async () => { if (label === "customer") return { callSid: id }; throw Object.assign(new Error("missing"), { status: 404 }); } });
  participants.create = async () => { creates++; return { callSid: "ai-leg" }; };
  const conferences = () => ({ participants });
  conferences.list = async query => { assert.equal(query.friendlyName, `ddd-${id}`); return [{ sid: conferenceSid }]; };
  const { read } = await recoveredFixture(t, { conferenceSid: undefined, aiState: undefined }, { client: () => ({ conferences, calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await settleAlerts();
  const state = await read();
  assert.equal(state.conferenceSid, conferenceSid);
  assert.equal(state.aiCallSid, "ai-leg");
  assert.equal(creates, 1);
});

test("provider verification errors use a bounded budget without fallback dialing", async t => {
  let checks = 0;
  const { actions, read } = await recoveredFixture(t, {}, { client: () => ({ calls: () => ({ fetch: async () => { checks++; throw new Error("provider unavailable"); } }) }) });
  await waitFor(() => checks === 6);
  const state = await read();
  assert.equal(state.recoveryAttempts, 3);
  assert.equal(state.aiAlertAttempts, 3);
  assert.equal(checks, 6);
  assert.equal(actions.length, 0);
});

test("a lost staff-create response is recovered by label without placing another call", async t => {
  let creates = 0;
  const participants = label => ({ fetch: async () => { if (label === "staff-one") return { callSid: "already-ringing" }; throw Object.assign(new Error("missing"), { status: 404 }); } });
  participants.create = async () => { creates++; throw new Error("must not dial"); };
  const { actions, read } = await recoveredFixture(t, { ringTeam: true, ringTargets: ["one"], staff: { one: { dialState: "creating", dialAttempts: 1 } } }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await settleAlerts();
  const state = await read();
  assert.equal(state.staff.one.callSid, "already-ringing");
  assert.equal(state.rangTeam, true);
  assert.equal(creates, 0);
  assert.equal(actions.some(([kind]) => kind === "fallback"), false);
});

test("a staff rate-limit retry preempts the original pickup timer", async t => {
  let creates = 0;
  const participants = label => ({ fetch: async () => { throw Object.assign(new Error("missing"), { status: 404 }); } });
  participants.create = async options => {
    if (options.label === "ddd-ai") return { callSid: "ai-leg" };
    creates++;
    if (creates === 1) throw Object.assign(new Error("rate limited"), { status: 429 });
    return { callSid: "staff-leg" };
  };
  await fixture(t, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }), recoveryRetryMs: 5, pickupTimeoutMs: 60000 });
  await waitFor(() => creates === 2);
  assert.equal(creates, 2);
});

test("rate-limited AI retries are bounded and do not recreate an accepted leg", async t => {
  let creates = 0;
  const participants = () => ({ fetch: async () => { throw Object.assign(new Error("missing"), { status: 404 }); } });
  participants.create = async () => { creates++; if (creates < 3) throw Object.assign(new Error("rate limited"), { status: 429 }); return { callSid: "ai-leg" }; };
  const { read } = await recoveredFixture(t, { aiState: "retryable", aiAttempts: 0 }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await waitFor(() => creates === 3);
  const state = await read();
  assert.equal(creates, 3);
  assert.equal(state.aiCallSid, "ai-leg");
  assert.equal(state.aiState, "submitted");
});

test("a ringing AI participant is not mistaken for a connected assistant", async t => {
  const participants = () => ({ fetch: async () => ({ callSid: "ai-leg", status: "ringing" }) });
  const { actions, read } = await recoveredFixture(t, { aiState: "submitted", aiCallSid: "ai-leg" }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await waitFor(() => actions.some(([kind]) => kind === "alert"));
  const state = await read();
  assert.notEqual(state.aiState, "connected");
  assert.equal(actions.some(([kind]) => kind === "fallback"), false);
});

test("a persisted fallback intent prevents subsequent callbacks from creating more legs", async t => {
  const { calls, actions } = await recoveredFixture(t, { fallbackAttempted: true, aiState: undefined, ringTeam: true });
  await calls.events(id, { ConferenceSid: conferenceSid, CallSid: id, ParticipantLabel: "customer", StatusCallbackEvent: "participant-join" });
  assert.equal(actions.some(([kind]) => ["dial", "fallback"].includes(kind)), false);
});

test("restart verifies a missed staff join and preserves listen mode", async t => {
  const participants = label => ({ fetch: async () => ({ callSid: label === "ddd-ai" ? "ai-leg" : "staff-leg", status: "connected" }) });
  const { read } = await recoveredFixture(t, { rangTeam: true, ringTeam: true, staff: { one: { callSid: "staff-leg", mode: "listen", joined: false } } }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await settleAlerts();
  const state = await read();
  assert.equal(state.staff.one.joined, true);
  assert.equal(state.staff.one.mode, "listen");
  assert.equal(state.owner, undefined);
});

test("restart can complete answer takeover after a verified missed staff join", async t => {
  const updates = [];
  const participants = label => ({ fetch: async () => ({ callSid: label === "ddd-ai" ? "ai-leg" : "staff-leg", status: "connected" }), update: async patch => updates.push([label, patch]), remove: async () => {} });
  const { read } = await recoveredFixture(t, { aiCallSid: "ai-leg", rangTeam: true, ringTeam: true, staff: { one: { callSid: "staff-leg", mode: "answer", joined: false } } }, { client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }) }) }) });
  await waitFor(() => updates.length === 2);
  const state = await read();
  assert.equal(state.owner, "one");
  assert.deepEqual(updates, [["ai-leg", { muted: true }], ["staff-leg", { muted: false, endConferenceOnExit: true }]]);
});

test("legacy pre-delivery aiAlerted is rearmed once after actual provider verification", async t => {
  const { actions, read } = await recoveredFixture(t, { aiAlerted: true });
  await waitFor(() => actions.some(([kind]) => kind === "alert"));
  const state = await read();
  assert.equal(state.aiAlertReconciled, true);
  assert.equal(state.aiAlerted, true);
  assert.ok(state.aiAlertDeliveredAt);
});
