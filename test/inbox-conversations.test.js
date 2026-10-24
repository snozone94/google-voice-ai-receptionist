import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("inbox groups telephone identities and excludes internal call addresses", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-inbox-test-"));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  try {
    const { normalizeConversationPhone, listConversations } = await import(`../src/receptionist.js?inbox=${Date.now()}`);
    for (const value of ["+15135550100", "(513) 555-0100", "sip:+15135550100@sip.example.com;transport=tls", '"Caller" <sips:+15135550100@example.com>']) {
      assert.equal(normalizeConversationPhone(value), "+15135550100");
    }
    for (const value of ["sip:proj_1234567890@example.com", "client:ddd_1234567890", "sip:alice@5135550100.example.com", "anonymous", "", "abc5135550100"]) {
      assert.equal(normalizeConversationPhone(value), "");
    }
    const calls = [
      { callId: "parent", createdAt: "2026-10-24T10:00:00Z", from: "+15135550100", status: "ringing" },
      { callId: "child", parentCallId: "parent", createdAt: "2026-10-24T10:00:02Z", from: "sip:+15135550100@example.com", status: "completed" },
      { callId: "internal", createdAt: "2026-10-24T10:00:04Z", from: "client:ddd_1234567890", status: "completed" },
      { callId: "outbound", createdAt: "2026-10-24T10:00:06Z", from: "client:ddd_1234567890", to: "+15135550100", status: "completed" }
    ];
    await fs.writeFile(path.join(dir, "calls.jsonl"), calls.map((call) => JSON.stringify(call)).join("\n") + "\n");
    await fs.writeFile(path.join(dir, "sms.jsonl"), JSON.stringify({ from: "5135550100", to: "+15135550101", direction: "inbound", body: "Need a tire", createdAt: "2026-10-24T10:00:05Z" }) + "\n");
    const threads = await listConversations();
    assert.equal(threads.length, 1);
    assert.equal(threads[0].phone, "+15135550100");
    assert.equal(threads[0].messages.filter((message) => message.direction === "call").length, 2);
    assert.equal(threads[0].messages.filter((message) => message.direction === "inbound").length, 1);
    assert.doesNotMatch(threads[0].lastBody, /sip:|client:/i);
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
