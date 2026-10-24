import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import catalog from "../config/notification-sounds.json" with { type: "json" };
import { normalizeAlertAudio, notificationAudio } from "../src/notification-sounds.js";

test("sound names and files are unique and shared with the mobile catalog", async () => {
  assert.equal(new Set(catalog.sounds.map((sound) => sound.label)).size, 5);
  assert.equal(new Set(catalog.sounds.map((sound) => sound.file)).size, 5);
  assert.equal(new Set(catalog.sounds.map((sound) => sound.id)).size, 5);
  const mobile = JSON.parse(await fs.readFile(new URL("../mobile/assets/notification-sounds.json", import.meta.url)));
  assert.deepEqual(mobile, catalog);
});

test("installed old builds receive system sounds instead of missing custom files", () => {
  assert.equal(notificationAudio({ preferences: { alertSound: "ddd-roadside" } }, "texts").sound, "default");
  assert.equal(notificationAudio({ preferences: { soundPackVersion: 999, alertSound: "ddd-alert" } }, "texts").channelId, "ddd-dispatch");
});

test("new builds receive only allow-listed bundled sounds and a matching Android channel", () => {
  const result = notificationAudio({ preferences: { soundPackVersion: 1, alertSound: "ddd-roadside" } }, "texts");
  assert.equal(result.sound, "ddd_roadside_ring.wav");
  assert.equal(result.channelId, "ddd-alert-ddd-roadside-v1");
  assert.equal(normalizeAlertAudio({ alertSound: "../../private.wav" }).alertSound, "ddd-alert");
});

test("silence and time sensitivity are device choices; routine activity is not urgent", () => {
  const subscription = { preferences: { soundPackVersion: 1, alertSound: "silent", timeSensitive: false } };
  assert.equal(notificationAudio(subscription, "missedCalls").sound, null);
  assert.equal(notificationAudio(subscription, "missedCalls").interruptionLevel, "active");
  assert.equal(notificationAudio({}, "missedCalls").interruptionLevel, "time-sensitive");
  assert.equal(notificationAudio({}, "teamActivity").interruptionLevel, "active");
  assert.equal(notificationAudio({}, "dailySummary").interruptionLevel, "active");
  assert.notEqual(notificationAudio({}, "qaIssues").interruptionLevel, "critical");
});
