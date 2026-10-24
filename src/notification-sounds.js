import catalog from "../config/notification-sounds.json" with { type: "json" };

export function normalizeAlertAudio(value = {}) {
  const valid = new Set(["system", "silent", ...catalog.sounds.map((sound) => sound.id)]);
  return {
    soundPackVersion: value.soundPackVersion === catalog.version ? catalog.version : 0,
    alertSound: valid.has(value.alertSound) ? value.alertSound : "ddd-alert",
    timeSensitive: value.timeSensitive !== false
  };
}

export function notificationAudio(subscription = {}, preference) {
  const options = normalizeAlertAudio(subscription.preferences);
  const custom = options.soundPackVersion === catalog.version;
  const sound = custom && options.alertSound === "silent" ? null : custom ? catalog.sounds.find((item) => item.id === options.alertSound)?.file || "default" : "default";
  const urgent = ["texts", "missedCalls", "bookings", "qaIssues", "newCalls"].includes(preference);
  return {
    sound,
    channelId: custom ? `ddd-alert-${options.alertSound}-v${catalog.version}` : "ddd-dispatch",
    interruptionLevel: urgent && options.timeSensitive ? "time-sensitive" : "active"
  };
}
