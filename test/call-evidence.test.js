import test from "node:test";
import assert from "node:assert/strict";
import { cleanTranscript, callIdResolver, actionableNotification, alertDisplayType, callAttentionEmailKey } from "../src/call-evidence.js";
import { decorateConversations, pendingTextReminders } from "../src/dispatch-workspace.js";

test("completed transcript replaces fragments without deleting later repeated speech", () => {
  const transcript = cleanTranscript([
    { type: "response.audio_transcript.delta", text: "How " },
    { type: "response.audio_transcript.delta", text: "can I help?" },
    { type: "response.audio_transcript.done", text: "How can I help?", at: "1" },
    { type: "conversation.item.input_audio_transcription.completed", text: "A tire", at: "2" },
    { type: "response.audio_transcript.done", text: "How can I help?", at: "3" }
  ]);
  assert.deepEqual(transcript.map((turn) => turn.text), ["How can I help?", "A tire", "How can I help?"]);
  assert.equal(transcript[1].speaker, "Customer");
});

test("call legs merge only with explicit parent IDs; redials remain separate", () => {
  const id = callIdResolver([{ callId: "sip-1", parentCallId: "parent-1" }, { callId: "redial-2" }]);
  assert.equal(id("sip-1"), "parent-1");
  assert.equal(id("redial-2"), "redial-2");
});

test("automatic follow-up does not mark a customer's message read", () => {
  const phone = "+15135550100";
  const conversations = [{ phone, messages: [
    { direction: "inbound", createdAt: "2026-01-01T10:00:00Z" },
    { direction: "outbound", source: "automatic", status: "delivered", createdAt: "2026-01-01T10:01:00Z" }
  ] }];
  assert.equal(decorateConversations(conversations, [])[0].unread, 1);
  assert.equal(decorateConversations(conversations, [], { [phone]: { readThrough: "2026-01-01T10:02:00Z" } })[0].unread, 0);
});

test("routine call completion stays quiet while actual delivery failures remain actionable", () => {
  assert.equal(actionableNotification({ type: "call" }), false);
  assert.equal(actionableNotification({ type: "call-completed" }), false);
  assert.equal(actionableNotification({ type: "staff-text-reply", status: "sent" }), false);
  assert.equal(actionableNotification({ type: "staff-text-reply", status: "failed" }), true);
});

test("call attention emails share a durable key without hiding a genuine redial", () => {
  assert.equal(callAttentionEmailKey({ type: "ai-pickup-failed", callId: "CAone" }), callAttentionEmailKey({ type: "early-hangup", callId: "CAone" }));
  assert.notEqual(callAttentionEmailKey({ type: "missed-call", callId: "CAone" }), callAttentionEmailKey({ type: "missed-call", callId: "CAtwo" }));
  assert.equal(callAttentionEmailKey({ type: "sms", callId: "CAone" }), null);
  assert.equal(alertDisplayType("ai-pickup-failed"), "Call needs a team member");
});

test("reply reminders wait five minutes and ignore auto replies and opt-out commands", () => {
  const received = "2026-01-01T10:00:00Z";
  const inbound = { direction: "inbound", body: "Can you help with a tire?", createdAt: received, messageSid: "SMtest" };
  const conversation = { phone: "+15135550100", messages: [inbound] };
  assert.equal(pendingTextReminders([conversation], { now: Date.parse(received) + 4 * 60000 }).length, 0);
  const now = Date.parse(received) + 6 * 60000;
  assert.equal(pendingTextReminders([conversation], { now }).length, 1);
  conversation.messages.push({ direction: "outbound", source: "automatic", createdAt: "2026-01-01T10:01:00Z" });
  assert.equal(pendingTextReminders([conversation], { now }).length, 1);
  conversation.messages.push({ direction: "outbound", agentName: "AI receptionist", createdAt: "2026-01-01T10:01:30Z" });
  assert.equal(pendingTextReminders([conversation], { now }).length, 1);
  assert.equal(decorateConversations([conversation], [])[0].unread, 1);
  conversation.messages.push({ direction: "outbound", status: "sent", createdAt: "2026-01-01T10:02:00Z" });
  assert.equal(pendingTextReminders([conversation], { now }).length, 0);
  assert.equal(pendingTextReminders([{ ...conversation, messages: [{ ...inbound, body: "STOP" }] }], { now }).length, 0);
});

test("Expo HTTP-200 ticket errors and missing tickets are never accepted", async () => {
  const { expoTicketResults } = await import("../src/call-evidence.js");
  const results = expoTicketResults({ data: [{ status: "ok", id: "ticket" }, { status: "error", details: { error: "DeviceNotRegistered" } }] }, 3);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(results[1].error, "DeviceNotRegistered");
  assert.equal(results[2].ok, false);
  assert.equal(expoTicketResults({ data: { status: "ok" } }, 1)[0].ok, false);
});

test("all pickup failure types share the root-call email key", () => {
  for (const type of ["openai-accept-failed", "ai-off-missed-call", "early-hangup"]) assert.equal(callAttentionEmailKey({ type, callId: "child", parentCallId: "root" }), "call-attention-email:root");
});
