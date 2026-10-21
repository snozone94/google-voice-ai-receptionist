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
      state ||= { claims: {}, badges: {} };
      const now = Date.now();
      for (const [key, expiry] of Object.entries(state.claims)) {
        if (expiry <= now) delete state.claims[key];
      }
      const value = action(state, now);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(`${file}.tmp`, JSON.stringify(state));
      await fs.rename(`${file}.tmp`, file);
      return value;
    });
    queue = result.catch(() => {});
    return result;
  }
  const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
  return {
    claim(key, ttl = 86400000) {
      return update((state, now) => {
        const id = hash(key);
        if (state.claims[id]) return false;
        state.claims[id] = now + ttl;
        return true;
      });
    },
    release(key) { return update((state) => { delete state.claims[hash(key)]; }); },
    badge(token, reset = false) {
      return update((state) => {
        const id = hash(token);
        state.badges[id] = reset ? 0 : (state.badges[id] || 0) + 1;
        return state.badges[id];
      });
    }
  };
}
