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
