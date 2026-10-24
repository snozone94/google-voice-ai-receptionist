import test from "node:test";
import assert from "node:assert/strict";
import { createLiveTranscript } from "../src/live-transcript.js";

test("final transcript replaces fragments and duplicate final events", () => {
  const transcript = createLiveTranscript();
  transcript.accept({ type: "response.output_audio_transcript.delta", item_id: "a", delta: "How " });
  transcript.accept({ type: "response.output_audio_transcript.delta", item_id: "a", delta: "can I help?" });
  transcript.accept({ type: "response.output_audio_transcript.done", item_id: "a", transcript: "How can I help?" });
  transcript.accept({ type: "response.output_audio_transcript.done", item_id: "a", transcript: "How can I help?" });
  assert.equal(transcript.list().length, 1);
  assert.equal(transcript.list()[0].text, "How can I help?");
});

test("preserves actual repeated speech and customer speaker identity", () => {
  const transcript = createLiveTranscript();
  for (const item_id of ["one", "two"]) transcript.accept({ type: "conversation.item.input_audio_transcription.completed", item_id, transcript: "An oil change." });
  assert.equal(transcript.list().length, 2);
  assert.equal(transcript.list()[0].speaker, "Customer");
});

test("ignores tool arguments and bounds live transcript memory", () => {
  const transcript = createLiveTranscript(2);
  transcript.accept({ type: "response.function_call_arguments.done", item_id: "tool", text: "private tool data" });
  assert.equal(transcript.list().length, 0);
  for (const item_id of ["one", "two", "three"]) transcript.accept({ type: "response.audio_transcript.done", item_id, transcript: item_id });
  assert.deepEqual(transcript.list().map((turn) => turn.text), ["two", "three"]);
});
