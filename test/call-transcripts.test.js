import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCallTranscripts } from "../src/call-transcripts.js";

const id = `CA${"1".repeat(32)}`;
const sid = `GT${"2".repeat(32)}`;
async function fixture(t, fail = false) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-transcripts-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const requests = [];
  const dependencies = { directory, baseUrl: () => "https://dispatch.example.test", client: () => ({ calls: (call) => ({ transcriptions: { create: async (options) => { requests.push({ call, options }); if (fail) throw new Error("provider unavailable"); return { sid }; } } }) }) };
  const store = createCallTranscripts(dependencies);
  const content = (sequence, text, complete = true, track = "inbound_track") => store.accept(id, { CallSid: id, TranscriptionSid: sid, Timestamp: new Date(1760000000000 + sequence * 1000).toISOString(), SequenceId: String(sequence), TranscriptionEvent: "transcription-content", Track: track, Final: String(complete), TranscriptionData: JSON.stringify({ transcript: text }) });
  return { store, requests, content, directory, dependencies };
}

test("one both-sided multilingual transcription is started, even with concurrent requests", async (t) => {
  const { store, requests } = await fixture(t);
  await Promise.all([store.start(id), store.start(id)]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.track, "both_tracks");
  assert.equal(requests[0].options.languageCode, "multi");
  assert.match(requests[0].options.statusCallbackUrl, /\/api\/live-calls\/transcription\?call=CA/);
});

test("partial speech is replaced, final callbacks deduplicate, later identical speech is retained", async (t) => {
  const { store, content } = await fixture(t);
  await store.start(id);
  await content(1, "I need", false);
  await content(2, "I need a tire", false);
  assert.deepEqual((await store.get(id)).turns.map((turn) => turn.text), ["I need a tire"]);
  await content(3, "I need a tire.");
  await content(3, "I need a tire.");
  await content(2, "I need a tire", false);
  await content(4, "Where are you?", true, "outbound_track");
  await content(5, "I need a tire.");
  const result = await store.get(id);
  assert.deepEqual(result.turns.map((turn) => turn.text), ["I need a tire.", "Where are you?", "I need a tire."]);
  assert.deepEqual(result.turns.map((turn) => turn.speaker), ["Customer", "DDD", "Customer"]);
  assert.ok(result.turns.every((turn) => turn.complete));
});

test("final speech is saved without unfinished fragments and remains readable after the call ends", async (t) => {
  const { store, content, directory, dependencies } = await fixture(t);
  await store.start(id);
  await content(1, "AI greeting", true, "outbound_track");
  await content(2, "Human took over", true, "outbound_track");
  await content(3, "Thank you");
  await content(4, "unfinished", false);
  const saved = JSON.parse(await fs.readFile(path.join(directory, "call-transcripts", `${id}.json`), "utf8"));
  assert.equal(saved.turns.length, 3);
  assert.deepEqual(saved.partial, {});
  await store.accept(id, { CallSid: id, TranscriptionSid: sid, SequenceId: "5", TranscriptionEvent: "transcription-stopped" });
  await store.accept(id, { CallSid: id, TranscriptionSid: sid, SequenceId: "0", TranscriptionEvent: "transcription-started" });
  const restored = await createCallTranscripts(dependencies).get(id);
  assert.equal(restored.status, "saved");
  assert.equal(restored.turns.length, 3);
});

test("outbound call tracks label team and customer correctly", async (t) => {
  const { store, content } = await fixture(t);
  await store.start(id, { inboundSpeaker: "DDD", outboundSpeaker: "Customer" });
  await content(1, "Hello from DDD");
  await content(2, "Hello", true, "outbound_track");
  assert.deepEqual((await store.get(id)).turns.map((turn) => turn.speaker), ["DDD", "Customer"]);
});

test("mismatched calls and transcription sessions cannot write to another conversation", async (t) => {
  const { store } = await fixture(t);
  await store.start(id);
  await assert.rejects(store.accept(id, { CallSid: `CA${"3".repeat(32)}` }), /mismatch/);
  await assert.rejects(store.accept(id, { CallSid: id, TranscriptionSid: `GT${"4".repeat(32)}` }), /mismatch/);
  assert.equal((await store.get(id)).turns.length, 0);
});

test("provider failures are visible and cannot trigger duplicate billable starts", async (t) => {
  const { store, requests } = await fixture(t, true);
  await assert.rejects(store.start(id), /provider unavailable/);
  assert.equal((await store.get(id)).status, "unavailable");
  await store.start(id);
  assert.equal(requests.length, 1);
});

test("call history prefers the saved full conversation over an AI-only summary", async (t) => {
  const { store, content, directory } = await fixture(t);
  await store.start(id);
  await content(1, "Hello from AI", true, "outbound_track");
  await content(2, "Hello from the team", true, "outbound_track");
  await content(3, "Thanks for helping");
  await fs.writeFile(path.join(directory, "calls.jsonl"), JSON.stringify({ callId: id, createdAt: new Date().toISOString(), from: "+15135550100", status: "completed" }) + "\n");
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  try {
    const { listCallLog } = await import(`../src/receptionist.js?transcription-test=${Date.now()}`);
    const calls = await listCallLog();
    assert.deepEqual(calls[0].transcript.map((turn) => turn.text), ["Hello from AI", "Hello from the team", "Thanks for helping"]);
    assert.equal(calls[0].transcript[2].speaker, "Customer");
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
  }
});
