import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// Serialize claims before delivery so simultaneous webhook retries cannot both send.
export function notificationState(directory) {
  const file = path.join(directory, "notification-state.json");
  let queue = Promise.resolve();
  function update(action) {
    const result = queue.then(async () => {
      let state;
      try { state = JSON.parse(await fs.readFile(file, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      state ||= {};
      state.claims ||= {};
      state.badges ||= {};
      state.outcomes ||= {};
      state.deliveries ||= {};
      state.events ||= {};
      state.activations ||= {};
      const now = Date.now();
      for (const [key, expiry] of Object.entries(state.claims)) {
        if (expiry <= now) delete state.claims[key];
      }
      for (const [key, delivery] of Object.entries(state.deliveries)) {
        if (delivery.expires > now) continue;
        if (delivery.status === "pending" && delivery.holdOnUncertain) state.deliveries[key] = { status: "uncertain", expires: now + delivery.retentionMs };
        else delete state.deliveries[key];
      }
      for (const [key, event] of Object.entries(state.events)) if (event.expires <= now) delete state.events[key];
      const value = action(state, now);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(`${file}.tmp`, JSON.stringify(state), { mode: 0o600 });
      await fs.rename(`${file}.tmp`, file);
      return value;
    });
    queue = result.catch(() => {});
    return result;
  }
  const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
  return {
    activation(key, initialTimestamp = Date.now()) {
      if (!/^[a-z0-9-]{1,80}$/.test(key) || !Number.isFinite(initialTimestamp) || initialTimestamp <= 0 || initialTimestamp > Date.now() + 5000) throw new Error("Invalid worker activation.");
      return update((state) => {
        if (Object.hasOwn(state.activations, key)) {
          const saved = state.activations[key];
          if (!Number.isFinite(saved) || saved <= 0) throw new Error("Invalid saved worker activation; reminders remain paused.");
          return saved;
        }
        state.activations[key] = initialTimestamp;
        return initialTimestamp;
      });
    },
    hasClaim(key) { return update((state) => Boolean(state.claims[hash(key)])); },
    claim(key, ttl = 86400000) {
      return update((state, now) => {
        const id = hash(key);
        if (state.claims[id]) return false;
        state.claims[id] = now + ttl;
        return true;
      });
    },
    release(key) { return update((state) => { delete state.claims[hash(key)]; }); },
    enqueue(key, payload) {
      return update((state, now) => {
        const id = hash(key);
        if (state.events[id]?.done) return false;
        state.events[id] ||= { key, payload, attempts: 0, nextAttemptAt: now, expires: now + 86400000 };
        return true;
      });
    },
    finish(key, complete) {
      return update((state, now) => {
        const event = state.events[hash(key)];
        if (!event || event.done) return;
        if (complete) { event.done = true; delete event.payload; }
        else { event.attempts += 1; event.nextAttemptAt = now + Math.min(900000, 60000 * 2 ** Math.min(event.attempts - 1, 4)); }
      });
    },
    pending() { return update((state, now) => Object.values(state.events).filter((event) => !event.done && event.nextAttemptAt <= now).slice(0, 50).map((event) => structuredClone(event))); },
    async deliver(key, send, { ttl = 7 * 86400000, leaseMs = 120000, holdOnUncertain = false } = {}) {
      const id = hash(key);
      const lease = crypto.randomUUID();
      const reservation = await update((state, now) => {
        const previous = state.deliveries[id];
        if (previous?.status === "accepted") return "accepted";
        if (previous?.status === "uncertain") return "uncertain";
        if (previous?.expires > now) return "pending";
        state.deliveries[id] = { status: "pending", lease, expires: now + leaseMs, holdOnUncertain, retentionMs: ttl };
        return "reserved";
      });
      if (reservation === "accepted") return { ok: true, skipped: true, alreadyAccepted: true };
      if (reservation === "uncertain") return { ok: false, uncertain: true, skipped: true, reason: "Submission outcome is unknown; verify with the provider before resending." };
      if (reservation === "pending") return { ok: false, pending: true, skipped: true, reason: "Delivery already in progress or awaiting retry." };
      let result;
      try { result = await send(); }
      catch (error) { result = { ok: false, uncertain: Boolean(error.uncertain), error: error.message }; }
      await update((state, now) => {
        if (state.deliveries[id]?.lease !== lease) return;
        state.deliveries[id] = result.ok && !result.skipped
          ? { status: "accepted", expires: now + ttl }
          : result.uncertain ? { status: "uncertain", expires: now + ttl } : { status: "retry", expires: now + 60000 };
      });
      return result;
    },
    observe(channel, status) {
      if (!["calling", "sms", "push", "email", "team"].includes(channel) || !["accepted", "delivered", "failed", "completed", "uncertain"].includes(status)) throw new Error("Invalid delivery observation.");
      return update((state, now) => { state.outcomes[channel] = { status, at: new Date(now).toISOString() }; });
    },
    async outcomes() {
      await queue;
      try { return JSON.parse(await fs.readFile(file, "utf8")).outcomes || {}; }
      catch (error) { if (error.code === "ENOENT") return {}; throw error; }
    },
    badge(token, reset = false) {
      return update((state) => {
        const id = hash(token);
        state.badges[id] = reset ? 0 : (state.badges[id] || 0) + 1;
        return state.badges[id];
      });
    }
  };
}
