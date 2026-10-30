import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { notificationState } from "../src/notification-state.js";

test("simultaneous retries deliver once and claims survive restart", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-notifications-"));
  try {
    const state = notificationState(dir);
    const claims = await Promise.all(Array.from({ length: 20 }, () => state.claim("sms:SM1")));
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(await notificationState(dir).claim("sms:SM1"), false);
    assert.equal(await state.claim("sms:SM2"), true);
    await state.release("sms:SM1");
    assert.equal(await state.claim("sms:SM1"), true);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test("badge counts persist per device and reset independently", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-badges-"));
  try {
    const state = notificationState(dir);
    assert.equal(await state.badge("phone1"), 1);
    assert.equal(await state.badge("phone1"), 2);
    assert.equal(await state.badge("phone2"), 1);
    assert.equal(await state.badge("phone1", true), 0);
    assert.equal(await notificationState(dir).badge("phone1"), 1);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test("per-channel acceptance survives restart while failed channels retry independently", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-channel-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ledger = notificationState(dir);
  let push = 0, email = 0;
  const sendPush = async () => { push++; return { ok: true }; };
  const sendEmail = async () => { email++; return { ok: false, error: "Rejected" }; };
  await ledger.deliver("push:event:device", sendPush);
  await ledger.deliver("email:event", sendEmail);
  const restarted = notificationState(dir);
  assert.equal((await restarted.deliver("push:event:device", sendPush)).alreadyAccepted, true);
  assert.equal((await restarted.deliver("email:event", sendEmail)).ok, false);
  assert.equal(push, 1);
  assert.equal(email, 1); // Failure backoff prevents a rapid retry flood.
  const file = path.join(dir, "notification-state.json");
  const state = JSON.parse(await fs.readFile(file, "utf8"));
  for (const delivery of Object.values(state.deliveries)) if (delivery.status === "retry") delivery.expires = 0;
  await fs.writeFile(file, JSON.stringify(state));
  assert.equal((await restarted.deliver("email:event", async () => { email++; return { ok: true }; })).ok, true);
  assert.equal(email, 2);
});

test("concurrent destination sends reserve once and stale leases recover", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-lease-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ledger = notificationState(dir);
  let sends = 0;
  const results = await Promise.all(Array.from({ length: 12 }, () => ledger.deliver("event:device", async () => { sends++; return { ok: true }; })));
  assert.equal(sends, 1);
  assert.equal(results.filter((result) => result.ok && !result.skipped).length, 1);
  await ledger.observe("push", "accepted");
  assert.equal((await notificationState(dir).outcomes()).push.status, "accepted");
  assert.throws(() => ledger.observe("push", "pretend-delivered"));
});

test("outbox persists pending events and removes customer content on completion", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-outbox-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ledger = notificationState(dir);
  await ledger.enqueue("event", { body: "Customer request" });
  assert.equal((await notificationState(dir).pending())[0].payload.body, "Customer request");
  await ledger.finish("event", false);
  assert.equal((await ledger.pending()).length, 0);
  await ledger.finish("event", true);
  assert.equal(await ledger.enqueue("event", { body: "Duplicate" }), false);
  assert.doesNotMatch(await fs.readFile(path.join(dir, "notification-state.json"), "utf8"), /Customer request/);
});

test("expired at-most-once SMTP leases and uncertain submissions never replay automatically", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-uncertain-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ledger = notificationState(dir);
  let submissions = 0;
  const uncertain = async () => { submissions++; return { ok: false, uncertain: true }; };
  await ledger.deliver("email:uncertain", uncertain, { holdOnUncertain: true });
  assert.equal((await notificationState(dir).deliver("email:uncertain", uncertain, { holdOnUncertain: true })).uncertain, true);
  assert.equal(submissions, 1);
  const file = path.join(dir, "notification-state.json");
  const state = JSON.parse(await fs.readFile(file, "utf8"));
  state.deliveries["stale-email"] = { status: "pending", lease: "lost-process", holdOnUncertain: true, retentionMs: 86400000, expires: 0 };
  // Use the same public key hashing as the store to simulate a process exit
  // after a pre-send reservation, before its final outcome was persisted.
  const { createHash } = await import("node:crypto");
  state.deliveries[createHash("sha256").update("email:crashed").digest("hex")] = state.deliveries["stale-email"];
  delete state.deliveries["stale-email"];
  await fs.writeFile(file, JSON.stringify(state));
  const result = await notificationState(dir).deliver("email:crashed", async () => { submissions++; return { ok: true }; }, { holdOnUncertain: true });
  assert.equal(result.uncertain, true);
  assert.equal(submissions, 1);
});

test("worker activation migrates existing ledgers once and survives restart and claim expiration", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-activation-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const ledger = notificationState(dir);
  await ledger.claim("unanswered-text:+15135550100:SMlegacy");
  const earliest = Date.now();
  const baselines = await Promise.all(Array.from({ length: 10 }, () => ledger.activation("reply-escalation-v1")));
  assert.equal(new Set(baselines).size, 1);
  assert.ok(baselines[0] >= earliest);
  assert.ok(baselines[0] <= Date.now());
  const restarted = notificationState(dir);
  assert.equal(await restarted.activation("reply-escalation-v1", earliest - 86400000), baselines[0]);
  assert.equal(await restarted.hasClaim("unanswered-text:+15135550100:SMlegacy"), true);
  assert.equal(await restarted.hasClaim("unanswered-text:+15135550100:SMlegacy:escalation"), false);
  await restarted.release("unanswered-text:+15135550100:SMlegacy");
  assert.equal(await restarted.activation("reply-escalation-v1"), baselines[0]);
  const state = JSON.parse(await fs.readFile(path.join(dir, "notification-state.json"), "utf8"));
  state.activations["reply-escalation-v1"] = "corrupt";
  await fs.writeFile(path.join(dir, "notification-state.json"), JSON.stringify(state));
  await assert.rejects(() => notificationState(dir).activation("reply-escalation-v1"), /Invalid saved worker activation/);
});
