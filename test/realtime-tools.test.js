import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CallMonitor } from "../src/realtime-tools.js";

class Socket extends EventEmitter {
  static latest;
  readyState = 1;
  sent = [];
  constructor() { super(); Socket.latest = this; }
  send(value) { this.sent.push(JSON.parse(value)); }
}
async function fixture(t, settings = {}, timeout = 500) {
  const monitor = new CallMonitor("rt-test", settings, { Socket, openingTimeoutMs: timeout });
  const done = monitor.start();
  const socket = Socket.latest;
  socket.emit("open");
  t.after(async () => { socket.readyState = 3; socket.emit("close"); await done; });
  return { monitor, socket, event: event => monitor.handleEvent(event) };
}
const vad = { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true };
const session = (type, turn_detection) => ({ type, session: { audio: { input: { turn_detection } } } });
const responses = socket => socket.sent.filter(event => event.type === "response.create");

test("opening requires acknowledged protection and matching playback completion; restores actual VAD", async t => {
  const { socket, event } = await fixture(t, { greeting: "Hello from DDD" });
  assert.equal(responses(socket).length, 0);
  await event(session("session.created", vad));
  assert.deepEqual(socket.sent[0].session.audio.input.turn_detection, { ...vad, create_response: false, interrupt_response: false });
  await event(session("session.updated", vad));
  assert.equal(responses(socket).length, 0);
  await event(session("session.updated", { ...vad, create_response: false, interrupt_response: false }));
  assert.equal(responses(socket).length, 1);
  assert.match(responses(socket)[0].response.instructions, /Hello from DDD/);
  await event({ type: "response.created", response: { id: "opening", metadata: { ddd_opening: "rt-test" } } });
  await event({ type: "input_audio_buffer.speech_started" });
  await event({ type: "response.done", response: { id: "opening", status: "completed" } });
  await event({ type: "output_audio_buffer.stopped", response_id: "other" });
  assert.equal(socket.sent.length, 2);
  await event({ type: "output_audio_buffer.stopped", response_id: "opening" });
  assert.deepEqual(socket.sent.at(-1).session.audio.input.turn_detection, vad);
  await event(session("session.updated", { ...vad, create_response: false, interrupt_response: false }));
  assert.equal(responses(socket).length, 1);
});

test("missing acknowledgement or playback cannot deadlock turn-taking or repeat the greeting", async t => {
  const { socket, event, monitor } = await fixture(t, {}, 10);
  await event(session("session.created", vad));
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(responses(socket).length, 1);
  assert.equal(monitor.opening, null);
  assert.deepEqual(socket.sent.at(-1).session.audio.input.turn_detection, vad);
  await event(session("session.updated", { ...vad, create_response: false, interrupt_response: false }));
  assert.equal(responses(socket).length, 1);
});

test("failed greeting and protocol errors release protection", async t => {
  const { socket, event, monitor } = await fixture(t);
  await event(session("session.created", vad));
  await event(session("session.updated", { ...vad, create_response: false, interrupt_response: false }));
  await event({ type: "response.created", response: { id: "opening", metadata: { ddd_opening: "rt-test" } } });
  await event({ type: "response.done", response: { id: "opening", status: "failed" } });
  assert.equal(monitor.opening, null);
  assert.deepEqual(socket.sent.at(-1).session.audio.input.turn_detection, vad);
});

test("verification capture stays silent and disabled VAD remains disabled", async t => {
  const verification = await fixture(t, { verificationMode: true });
  await verification.event(session("session.created", vad));
  assert.equal(verification.socket.sent.length, 0);
  const normal = await fixture(t);
  await normal.event(session("session.created", null));
  assert.equal(responses(normal.socket).length, 1);
  normal.monitor.finishOpening();
  assert.equal(normal.socket.sent.at(-1).session.audio.input.turn_detection, null);
});

test("stopped assistant cannot start a delayed greeting", async t => {
  const { monitor, socket, event } = await fixture(t, {}, 10);
  monitor.stopped = true;
  monitor.finishOpening();
  await event(session("session.created", vad));
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(responses(socket).length, 0);
});

test("missing playback completion restores automatic turns within the guard deadline", async t => {
  const { socket, event, monitor } = await fixture(t, {}, 10);
  await event(session("session.created", vad));
  await event(session("session.updated", { ...vad, create_response: false, interrupt_response: false }));
  await event({ type: "response.created", response: { id: "opening", metadata: { ddd_opening: "rt-test" } } });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(monitor.opening, null);
  assert.deepEqual(socket.sent.at(-1).session.audio.input.turn_detection, vad);
  assert.equal(responses(socket).length, 1);
});

test("rejected opening protection releases automatic turns without restarting greeting", async t => {
  const { socket, event, monitor } = await fixture(t);
  await event(session("session.created", vad));
  await event({ type: "error", error: { type: "invalid_request_error" } });
  assert.equal(monitor.opening, null);
  assert.deepEqual(socket.sent.at(-1).session.audio.input.turn_detection, vad);
  assert.equal(responses(socket).length, 1);
  await event({ type: "error" });
  assert.equal(responses(socket).length, 1);
});
