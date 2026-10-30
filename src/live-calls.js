import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import twilio from "twilio";

const xml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const terminal = (value) => ["completed", "failed", "busy", "no-answer", "canceled"].includes(value);
const failure = (message, status = 409) => Object.assign(new Error(message), { status });

export function createLiveCalls({ directory, client = () => twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN), baseUrl = () => process.env.PUBLIC_BASE_URL, routingIdentities, saveCallEvent, transcript = () => [], stopAssistant = () => {}, notify = async () => {}, fallback = async () => {}, startTranscription = async () => {}, getTranscription = async () => null, aiDisconnectGraceMs = 3000, recoveryRetryMs = 1000, pickupTimeoutMs = 25000 }) {
  const file = path.join(directory, "live-call-sessions.json");
  const configFile = path.join(directory, "live-call-options.json");
  let records = {};
  let options = { enabled: false, ringTeam: true, transcribeCalls: true };
  let writes = Promise.resolve();
  const locks = new Map();
  const pendingAiAlerts = new Map();
  const recoveryTimers = new Map();
  const maxAttempts = 3;
  let closed = false;
  const ready = (async () => {
    for (const [target, assign] of [[file, (data) => { records = data; }], [configFile, (data) => { options = { ...options, ...data }; }]]) {
      try { assign(JSON.parse(await fs.readFile(target, "utf8"))); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    for (const record of Object.values(records)) {
      if (!record.endedAt) scheduleRecovery(record.id, 0);
    }
  })();
  ready.catch(() => {});
  const endpoint = (route) => `${String(baseUrl() || "").replace(/\/$/, "")}${route}`;
  async function persist() {
    const snapshot = JSON.stringify(records);
    const operation = writes.then(async () => {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(`${file}.tmp`, snapshot, { mode: 0o600 });
      await fs.rename(`${file}.tmp`, file);
    });
    writes = operation.catch(() => {});
    return operation;
  }
  function locked(id, action) {
    const operation = (locks.get(id) || Promise.resolve()).catch(() => {}).then(action);
    locks.set(id, operation);
    operation.finally(() => { if (locks.get(id) === operation) locks.delete(id); }).catch(() => {});
    return operation;
  }
  function get(id) {
    const record = records[id];
    if (!record || record.endedAt || Date.now() - Date.parse(record.startedAt) > 4 * 3600000) throw failure("This call has ended.", 410);
    return record;
  }
  const conference = (record) => client().conferences(record.conferenceSid);
  const callback = (id) => endpoint(`/api/live-calls/events?call=${encodeURIComponent(id)}`);
  const statusCallback = (id, label) => endpoint(`/api/live-calls/participant-status?call=${encodeURIComponent(id)}&participant=${encodeURIComponent(label)}`);
  function cancelAiAlert(id) {
    clearTimeout(pendingAiAlerts.get(id));
    pendingAiAlerts.delete(id);
  }
  function active(record) {
    return record && !record.endedAt && !record.customerLeft && !record.owner;
  }
  function scheduleRecovery(id, delay = recoveryRetryMs) {
    if (closed) return;
    const dueAt = Date.now() + Math.max(0, delay);
    const existing = recoveryTimers.get(id);
    if (existing && existing.dueAt <= dueAt) return;
    clearTimeout(existing?.timer);
    const timer = setTimeout(() => {
      recoveryTimers.delete(id);
      locked(id, () => recover(id)).catch(error => console.error("Live call recovery failed", error.message));
    }, Math.max(0, delay));
    timer.unref?.();
    recoveryTimers.set(id, { timer, dueAt });
  }
  function cancelRecovery(id) {
    clearTimeout(recoveryTimers.get(id)?.timer);
    recoveryTimers.delete(id);
    cancelAiAlert(id);
  }
  async function callerConnected(record) {
    try {
      const caller = await client().calls(record.id).fetch();
      if (terminal(caller.status)) {
        record.endedAt = new Date().toISOString();
        record.status = "Ended";
        cancelRecovery(record.id);
        await persist();
        return false;
      }
      return caller.status === "in-progress";
    } catch (error) {
      if (error.status !== 404) throw error;
      record.endedAt = new Date().toISOString();
      record.status = "Ended";
      cancelRecovery(record.id);
      await persist();
      return false;
    }
  }
  async function findParticipant(record, label) {
    if (!record.conferenceSid) return null;
    try { return await conference(record).participants(label).fetch(); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }
  function scheduleAiAlert(id) {
    const record = records[id];
    if (closed || !active(record) || record.aiAlerted || (record.aiAlertAttempts || 0) >= maxAttempts || pendingAiAlerts.has(id)) return;
    record.aiAlertPending = true;
    const timer = setTimeout(() => locked(id, async () => {
      pendingAiAlerts.delete(id);
      if (!active(record) || record.aiAlerted) return;
      record.aiAlertAttempts = (record.aiAlertAttempts || 0) + 1;
      await persist();
      try {
        if (!await callerConnected(record)) return;
        const ai = await findParticipant(record, "ddd-ai");
        if (ai?.status === "connected") { record.aiState = "connected"; record.aiAlertPending = false; await persist(); return; }
        record.status = "Team needed";
        const result = await notify({ title: "DDD call needs a person", body: "A caller is still connected and needs a team member. Open Dispatch to answer.", data: { type: "ai-pickup-failed", callId: id, from: record.phone } });
        // Existing void-returning notifiers remain supported; explicit failures
        // (including skipped delivery) must not be recorded as delivered.
        if (result && typeof result === "object" && result.ok !== true) throw new Error("Team notification was not delivered");
        record.aiAlerted = true;
        record.aiAlertDeliveredAt = new Date().toISOString();
        record.aiAlertPending = false;
        await persist();
      } catch (error) {
        console.error("Could not verify call assistance alert", error.message);
        scheduleAiAlert(id);
      }
    }).catch(error => console.error("Could not persist call assistance alert", error.message)), aiDisconnectGraceMs);
    timer.unref?.();
    pendingAiAlerts.set(id, timer);
  }
  async function recover(id) {
    const record = records[id];
    if (!record || record.endedAt) return;
    if (!active(record)) { await callerConnected(record); return; }
    record.recoveryAttempts = (record.recoveryAttempts || 0) + 1;
    await persist();
    try {
      if (!await callerConnected(record)) return;
      // Never recreate an ambiguously submitted leg. Labels can recover a
      // successful create whose response/callback was lost, but a 404 alone
      // cannot prove that an outbound call was never placed.
      const ai = await findParticipant(record, "ddd-ai");
      if (ai?.callSid) record.aiCallSid = ai.callSid;
      if (ai?.status === "connected") {
        record.aiCallSid = ai.callSid;
        record.aiState = "connected";
        record.status = "AI answering";
        cancelAiAlert(id);
        record.aiAlertPending = false;
      }
      if (!record.conferenceSid) {
        const rooms = await client().conferences.list({ friendlyName: record.room, status: "in-progress", limit: 2 });
        if (rooms.length === 1) {
          const customer = await client().conferences(rooms[0].sid).participants("customer").fetch();
          if (customer.callSid === record.id) record.conferenceSid = rooms[0].sid;
        }
      }
      if (!ai && record.aiAlerted && !record.aiAlertDeliveredAt && !record.aiAlertReconciled) {
        // Old releases saved aiAlerted before delivery. Re-arm once only after
        // provider verification; downstream notification dedupe still applies.
        record.aiAlerted = false;
        record.aiAlertReconciled = true;
        record.aiAlertPending = true;
      }
      if (record.conferenceSid) {
        if (!ai && (!record.aiState || record.aiState === "retryable")) await addAi(record).catch(error => console.error("AI recovery dial failed", error.message));
        await ringStaff(record, true);
      }
      await persist();
      if (record.aiAlertPending) scheduleAiAlert(id);
      if (record.owner) return;
      const remaining = Date.parse(record.startedAt) + pickupTimeoutMs - Date.now();
      if (remaining > 0) { scheduleRecovery(id, remaining); return; }
      if (record.owner || ai?.status === "connected") return;
      record.status = "Team needed";
      scheduleAiAlert(id);
      // A redirect can itself ring the team. Do not redirect while any known
      // or ambiguously submitted leg might still be ringing or connected.
      let uncertain = (["creating", "uncertain"].includes(record.aiState) || (record.aiState === "retryable" && record.aiAttempts < maxAttempts)) && !record.aiCallSid;
      for (const member of Object.values(record.staff || {})) {
        if (member.callSid) {
          const call = await client().calls(member.callSid).fetch();
          if (!terminal(call.status)) uncertain = true;
        } else if (["creating", "uncertain"].includes(member.dialState) || (member.dialState === "retryable" && member.dialAttempts < maxAttempts) || (!member.dialState && record.rangTeam)) uncertain = true;
      }
      if (record.aiCallSid) {
        const call = await client().calls(record.aiCallSid).fetch();
        if (!terminal(call.status)) uncertain = true;
      }
      if (uncertain && record.recoveryAttempts < maxAttempts) scheduleRecovery(id, 20000);
      if (!uncertain && !record.fallbackAttempted) {
        record.fallbackAttempted = true;
        await persist(); // durable intent: a lost redirect response is not retried
        await fallback(record);
      }
      await persist();
    } catch (error) {
      console.error("Live call recovery verification failed", error.message);
      if (record.recoveryAttempts < maxAttempts) scheduleRecovery(id);
      else { scheduleAiAlert(id); await persist(); }
    }
  }
  async function takeOver(record, identity, callSid) {
    const member = record.staff?.[identity];
    if (!member?.joined || member.callSid !== callSid) throw failure("Join this call before taking over.");
    if (record.owner && record.owner !== identity) throw failure("Another team member is already speaking with this customer.");
    if (record.owner === identity && record.status === "Team answering") return;
    const ai = record.aiCallSid;
    // Mute AI first, then unmute the verified staff leg. Never drop the caller
    // while a phone is still ringing or if joining failed.
    if (ai && record.aiState === "connected") await conference(record).participants(ai).update({ muted: true });
    try { await conference(record).participants(callSid).update({ muted: false, endConferenceOnExit: true }); }
    catch (error) {
      if (ai && record.aiState === "connected") await conference(record).participants(ai).update({ muted: false }).catch(() => {});
      throw error;
    }
    record.owner = identity;
    cancelRecovery(record.id);
    record.status = "Team answering";
    member.mode = "answer";
    await persist();
    record.transcript = stopAssistant(record.aiRealtimeId) || [];
    if (ai) await conference(record).participants(ai).remove().catch(() => {});
    record.aiState = "removed";
    await persist();
    await Promise.allSettled(Object.entries(record.staff).filter(([other, participant]) => other !== identity && !participant.joined && participant.callSid).map(([, participant]) => client().calls(participant.callSid).update({ status: "canceled" })));
    await saveCallEvent({ type: "ddd.live.takeover", data: { call_id: record.id, status: "team-answering", staffName: member.name || "DDD team" } });
  }
  async function addAi(record) {
    if (record.fallbackAttempted || record.owner || (record.aiState && record.aiState !== "retryable") || (record.aiAttempts || 0) >= maxAttempts) return;
    if (record.aiState === "retryable") {
      const existing = await findParticipant(record, "ddd-ai");
      if (existing) { record.aiCallSid = existing.callSid; record.aiState = existing.status === "connected" ? "connected" : "submitted"; await persist(); return; }
    }
    record.aiAttempts = (record.aiAttempts || 0) + 1;
    record.aiState = "creating";
    await persist();
    const separator = record.aiUri.includes("?") ? "&" : "?";
    const target = `${record.aiUri}${separator}${new URLSearchParams({ "X-DDD-Call": record.id, "X-DDD-Session": record.linkToken })}`;
    try {
      const ai = await conference(record).participants.create({ from: record.phone, to: target, label: "ddd-ai", muted: false, beep: "false", endConferenceOnExit: false, earlyMedia: false, statusCallback: statusCallback(record.id, "ddd-ai"), statusCallbackEvent: ["initiated", "ringing", "answered", "completed"] });
      record.aiCallSid = ai.callSid;
      record.aiState = "submitted";
      await persist();
    } catch (error) {
      record.aiState = error.status === 429 ? "retryable" : error.status >= 400 && error.status < 500 ? "failed" : "uncertain";
      record.status = "Team needed";
      await persist();
      scheduleAiAlert(record.id);
      if ((record.recoveryAttempts || 0) < maxAttempts) scheduleRecovery(record.id);
      throw error;
    }
  }
  async function ringStaff(record, recovering = false) {
    if (record.fallbackAttempted || !record.ringTeam || record.owner || record.customerLeft || record.endedAt) return;
    // A legacy rangTeam intent may represent a submitted call with no saved SID.
    // Preserve it rather than guessing that it is safe to call again.
    if (record.rangTeam && !record.ringTargets) {
      if (!recovering) return;
      record.ringTargets = Object.keys(record.staff || {});
      for (const member of Object.values(record.staff || {})) {
        if (!member.callSid && !member.dialState) member.dialState = "uncertain";
      }
    }
    record.ringTargets ||= [...new Set(await routingIdentities())];
    await persist();
    for (const identity of record.ringTargets) {
      const label = `staff-${identity}`;
      const member = record.staff[identity] ||= { mode: "answer", joined: false, dialState: "pending", dialAttempts: 0 };
      if (recovering && member.callSid && !member.joined) {
        const existing = await findParticipant(record, label);
        if (existing?.callSid === member.callSid && existing.status === "connected") {
          member.joined = true;
          await persist();
          if (member.mode === "answer") await takeOver(record, identity, member.callSid);
        }
      }
      if (record.owner) break;
      if (member.callSid || member.joined || member.dialState === "failed") continue;
      if (recovering || ["creating", "uncertain"].includes(member.dialState)) {
        const existing = await findParticipant(record, label);
        if (existing) {
          member.callSid = existing.callSid;
          member.dialState = "submitted";
          member.joined = existing.status === "connected";
          await persist();
          if (member.joined && member.mode === "answer") await takeOver(record, identity, member.callSid);
          continue;
        }
      }
      if (!["pending", "retryable"].includes(member.dialState) || member.dialAttempts >= maxAttempts) continue;
      member.dialState = "creating";
      member.dialAttempts += 1;
      await persist();
      const params = new URLSearchParams({ customerPhone: record.phone, liveCallId: record.id, liveMode: "answer" });
      try {
        const participant = await conference(record).participants.create({ from: record.businessPhone, to: `client:${identity}?${params}`, label, muted: true, beep: "false", endConferenceOnExit: false, earlyMedia: false, timeout: 20, statusCallback: statusCallback(record.id, label), statusCallbackEvent: ["initiated", "ringing", "answered", "completed"] });
        member.callSid ||= participant.callSid;
        member.dialState = "submitted";
      } catch (error) {
        // Only a definite rate-limit rejection permits another POST. Timeouts
        // and 5xx may have placed a call and are reconciled, never redialed.
        member.dialState = error.status === 429 ? "retryable" : error.status >= 400 && error.status < 500 ? "failed" : "uncertain";
        member.dialError = String(error.code || error.status || "unknown");
        record.status = "Team needed";
        if ((record.recoveryAttempts || 0) < maxAttempts) scheduleRecovery(record.id);
      }
      await persist();
    }
    record.rangTeam = record.ringTargets.every(identity => Boolean(record.staff[identity]?.callSid));
    if ((record.recoveryAttempts || 0) < maxAttempts && record.ringTargets.some(identity => ["retryable", "uncertain"].includes(record.staff[identity]?.dialState))) scheduleRecovery(record.id);
    await persist();
  }
  return {
    async close() {
      await ready;
      closed = true;
      for (const id of recoveryTimers.keys()) cancelRecovery(id);
      for (const id of pendingAiAlerts.keys()) cancelAiAlert(id);
      await Promise.allSettled([...locks.values()]);
      await writes;
    },
    async config(patch) {
      await ready;
      if (patch) {
        const next = { enabled: patch.enabled === true, ringTeam: patch.ringTeam !== false, transcribeCalls: patch.transcribeCalls === undefined ? options.transcribeCalls : patch.transcribeCalls === true };
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(`${configFile}.tmp`, JSON.stringify(next), { mode: 0o600 });
        await fs.rename(`${configFile}.tmp`, configFile);
        options = next;
      }
      return { ...options };
    },
    async start({ id, phone, businessPhone, aiUri, recordingCallback }) {
      await ready;
      if (!/^CA[0-9a-f]{32}$/i.test(id)) throw failure("Invalid incoming call.", 400);
      return locked(id, async () => {
        if (!records[id]) {
          // Retain ended sessions for callback deduplication, not indefinitely.
          for (const [key, record] of Object.entries(records)) if (record.endedAt && Date.now() - Date.parse(record.endedAt) > 7 * 86400000) delete records[key];
          records[id] = { id, phone, businessPhone, aiUri, room: `ddd-${id}`, linkToken: crypto.randomBytes(24).toString("hex"), ringTeam: options.ringTeam, startedAt: new Date().toISOString(), status: "Connecting", staff: {} };
          await persist();
          scheduleRecovery(id, pickupTimeoutMs);
        }
        const record = get(id);
        const recordingUrl = `${recordingCallback}${recordingCallback.includes("?") ? "&" : "?"}call=${encodeURIComponent(id)}`;
        return `<Response><Dial><Conference participantLabel="customer" beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="" record="record-from-start" recordingStatusCallback="${xml(recordingUrl)}" recordingStatusCallbackMethod="POST" statusCallback="${xml(callback(id))}" statusCallbackMethod="POST" statusCallbackEvent="start end join leave">${xml(record.room)}</Conference></Dial><Hangup/></Response>`;
      });
    },
    async events(id, event) {
      await ready;
      return locked(id, async () => {
        const record = records[id];
        if (!record || record.endedAt) return;
        if (event.FriendlyName && event.FriendlyName !== record.room) throw failure("Call session mismatch.", 400);
        if (record.conferenceSid && record.conferenceSid !== event.ConferenceSid) throw failure("Call session mismatch.", 400);
        if (!record.conferenceSid && event.CallSid !== record.id) return;
        record.conferenceSid = event.ConferenceSid;
        const label = event.ParticipantLabel || "";
        if (event.StatusCallbackEvent === "conference-end") {
          cancelRecovery(id);
          record.endedAt = new Date().toISOString();
          record.status = "Ended";
          await persist();
          await saveCallEvent({ type: "twilio.live.completed", data: { call_id: id, status: "completed", durationSeconds: Math.max(0, Math.round((Date.now() - Date.parse(record.startedAt)) / 1000)), sip_headers: [{ name: "from", value: record.phone }, { name: "to", value: record.businessPhone }] } });
          await notify({ title: "DDD call ended", body: `${record.phone} finished their call. Open Dispatch for the conversation and next steps.`, data: { type: "call-completed", callId: id, from: record.phone, status: "completed" } });
          return;
        }
        if (event.StatusCallbackEvent === "participant-leave" && label === "customer") {
          record.customerLeft = true;
          cancelRecovery(id);
          await persist();
        } else if (event.StatusCallbackEvent === "participant-join" && label === "customer") {
          await Promise.allSettled([addAi(record), ringStaff(record), options.transcribeCalls ? startTranscription(record.id) : Promise.resolve()]);
        } else if (event.StatusCallbackEvent === "participant-join" && label === "ddd-ai") {
          record.aiCallSid = event.CallSid;
          cancelAiAlert(id);
          record.aiAlertPending = false;
          record.aiState = "connected";
          record.status = record.owner ? "Team answering" : "AI answering";
          await persist();
          if (record.owner) await conference(record).participants(event.CallSid).remove();
        } else if (label.startsWith("staff-") && event.StatusCallbackEvent === "participant-join") {
          const identity = label.slice(6);
          const member = record.staff[identity];
          if (!member) { await conference(record).participants(event.CallSid).remove(); return; }
          member.joined = true;
          member.callSid = event.CallSid;
          await persist();
          if (member.mode === "answer") {
            if (record.owner && record.owner !== identity) await conference(record).participants(event.CallSid).remove();
            else await takeOver(record, identity, event.CallSid);
          }
        } else if (event.StatusCallbackEvent === "participant-leave" && label.startsWith("staff-")) {
          const member = record.staff[label.slice(6)];
          if (member?.callSid === event.CallSid) member.joined = false;
          await persist();
        }
      });
    },
    async participantStatus(id, label, event) {
      await ready;
      return locked(id, async () => {
        const record = records[id];
        if (!record || record.endedAt || !event.CallSid) return;
        if (label === "ddd-ai") {
          if (record.aiCallSid && record.aiCallSid !== event.CallSid) return;
          record.aiCallSid ||= event.CallSid;
          if (terminal(event.CallStatus) && !record.owner && record.aiState !== "removed") {
            record.aiState = "failed";
            scheduleAiAlert(id);
          }
        } else if (label.startsWith("staff-")) {
          const member = record.staff[label.slice(6)];
          if (member && (!member.callSid || member.callSid === event.CallSid)) { member.callSid ||= event.CallSid; member.status = event.CallStatus; }
        }
        await persist();
      });
    },
    async linkAi(id, linkToken, realtimeId) {
      await ready;
      const record = records[id];
      if (!record || record.endedAt || !linkToken || linkToken.length !== record.linkToken.length || !crypto.timingSafeEqual(Buffer.from(linkToken), Buffer.from(record.linkToken))) return null;
      record.aiRealtimeId = realtimeId;
      await persist();
      return { id, phone: record.phone, businessPhone: record.businessPhone };
    },
    async join(id, identity, callSid, mode = "listen", name = "DDD team") {
      await ready;
      return locked(id, async () => {
        const record = get(id);
        if (!record.conferenceSid) throw failure("This call is still connecting. Try again in a moment.");
        if (!["listen", "answer"].includes(mode)) throw failure("Choose listen or answer.", 400);
        if (mode === "answer" && record.owner && record.owner !== identity) throw failure("Another team member is answering this call.");
        const previous = record.staff[identity];
        if (previous?.joined && previous.callSid !== callSid) throw failure("You already joined this call on another device.");
        record.staff[identity] = { name, callSid, mode, joined: false };
        await persist();
        return `<Response><Dial><Conference participantLabel="staff-${xml(identity)}" muted="true" beep="false" startConferenceOnEnter="false" endConferenceOnExit="false">${xml(record.room)}</Conference></Dial><Hangup/></Response>`;
      });
    },
    async takeOver(id, identity) {
      await ready;
      return locked(id, async () => { const record = get(id); await takeOver(record, identity, record.staff?.[identity]?.callSid); return { ok: true }; });
    },
    async prepareIncoming(id, identity, mode) {
      await ready;
      return locked(id, async () => {
        const record = get(id);
        const member = record.staff[identity];
        if (!member || member.joined) throw failure("This incoming call is no longer available.");
        if (!["listen", "answer"].includes(mode)) throw failure("Choose listen or answer.", 400);
        member.mode = mode;
        await persist();
        return { ok: true };
      });
    },
    async list(identity) {
      await ready;
      for (const record of Object.values(records)) {
        if (record.endedAt || Date.now() - Date.parse(record.startedAt) < 30000 || Date.now() - (record.checkedAt || 0) < 10000) continue;
        record.checkedAt = Date.now();
        try {
          const call = await client().calls(record.id).fetch();
          if (terminal(call.status)) { record.endedAt = new Date().toISOString(); record.status = "Ended"; await persist(); }
        } catch (error) { if (error.status === 404) { record.endedAt = new Date().toISOString(); await persist(); } }
      }
      return Promise.all(Object.values(records).filter((record) => !record.endedAt && Date.now() - Date.parse(record.startedAt) < 4 * 3600000).map(async (record) => {
        const audio = await getTranscription(record.id).catch(() => ({ status: "unavailable", turns: [] }));
        return { callId: record.id, phone: record.phone, startedAt: record.startedAt, status: record.status, transcriptionStatus: audio?.status || "AI transcript", transcript: audio?.turns.length ? audio.turns : transcript().find((call) => call.callId === record.aiRealtimeId)?.transcript || record.transcript || [], joined: Boolean(record.staff?.[identity]?.joined), ownedByYou: record.owner === identity, teamAnswering: Boolean(record.owner), capabilities: { listen: Boolean(record.conferenceSid), takeOver: Boolean(record.conferenceSid) && (!record.owner || record.owner === identity) } };
      }));
    }
  };
}
