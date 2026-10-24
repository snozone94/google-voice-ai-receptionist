import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLiveCalls } from "../src/live-calls.js";

const id = `CA${"a".repeat(32)}`;
const conferenceSid = `CF${"b".repeat(32)}`;
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-live-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const actions = [];
  let failUnmute = false;
  const participants = (sid) => ({ update: async (patch) => { actions.push(["update", sid, patch]); if (failUnmute && patch.muted === false && sid !== "ai-leg") throw new Error("phone disconnected"); }, remove: async () => { actions.push(["remove", sid]); } });
  participants.create = async (options) => { actions.push(["create", options]); return { callSid: options.label === "ddd-ai" ? "ai-leg" : options.label }; };
  const dependencies = { directory, client: () => ({ conferences: () => ({ participants }), calls: () => ({ fetch: async () => ({ status: "in-progress" }), update: async () => {} }) }), baseUrl: () => "https://dispatch.example.test", routingIdentities: async () => ["tech-one"], saveCallEvent: async (event) => actions.push(["event", event]), stopAssistant: () => actions.push(["stop-ai"]) };
  const calls = createLiveCalls(dependencies);
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
  const restarted = createLiveCalls(dependencies);
  assert.deepEqual(await restarted.config(), { enabled: true, ringTeam: false });
  assert.equal((await restarted.list("one"))[0].phone, "+15135550100");
  assert.equal(await restarted.linkAi(id, "invalid", "rt-call"), null);
  await assert.rejects(restarted.events(id, { ConferenceSid: "wrong", FriendlyName: `ddd-${id}` }), /mismatch/);
});
