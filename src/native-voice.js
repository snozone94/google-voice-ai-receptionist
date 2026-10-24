import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import twilio from "twilio";

export const voiceIdentity = (staff) => `ddd_${crypto.createHash("sha256").update(String(staff.id || staff.name)).digest("hex").slice(0, 32)}`;
export const voiceNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(String(value || "")) ? String(value) : "";
};
const xml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);

let savedConfiguration = {};
const configuration = () => ({ ...savedConfiguration, ...Object.fromEntries(Object.entries(process.env).filter(([key, value]) => key.startsWith("TWILIO_VOICE_") && value)) });

export function nativeVoiceStatus() {
  const config = configuration();
  const missing = [
    ["Twilio account", process.env.TWILIO_ACCOUNT_SID],
    ["Voice API key", config.TWILIO_VOICE_API_KEY_SID],
    ["Voice API secret", config.TWILIO_VOICE_API_KEY_SECRET],
    ["Voice application", config.TWILIO_VOICE_APP_SID],
    ["Public server address", process.env.PUBLIC_BASE_URL]
  ].filter(([, value]) => !value).map(([label]) => label);
  return { ready: missing.length === 0, incomingReady: missing.length === 0 && Boolean(config.TWILIO_VOICE_PUSH_CREDENTIAL_SID), missing };
}

export function configuredAiSipUri() { return configuration().TWILIO_VOICE_AI_SIP_URI || ""; }

export function mountNativeVoice(app, { express, authenticate, directory, callerIds, saveCallEvent, getLiveCalls = () => null, createClient = twilio }) {
  const file = path.join(directory, "voice-sessions.json");
  const configFile = path.join(directory, "voice-connection.enc.json");
  let provisioning;
  const encryptionKey = () => crypto.createHash("sha256").update(process.env.TWILIO_AUTH_TOKEN || "").digest();
  function encryptStaffCode(code) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const data = Buffer.concat([cipher.update(code), cipher.final()]);
    return { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") };
  }
  async function verifySession(identity, session) {
    if (!session?.signedIn || !session.credential) return { ok: false };
    try {
      const stored = session.credential;
      const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(stored.iv, "hex"));
      decipher.setAuthTag(Buffer.from(stored.tag, "hex"));
      const code = Buffer.concat([decipher.update(Buffer.from(stored.data, "hex")), decipher.final()]).toString();
      const staff = await authenticate({ get: (name) => ["x-staff-code", "x-admin-pin"].includes(name) ? code : "", query: {} });
      return staff.ok && voiceIdentity(staff) === identity ? staff : { ok: false };
    } catch { return { ok: false }; }
  }
  const initialized = (async () => {
    try {
      const stored = JSON.parse(await fs.readFile(configFile, "utf8"));
      const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(stored.iv, "hex"));
      decipher.setAuthTag(Buffer.from(stored.tag, "hex"));
      savedConfiguration = JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.data, "hex")), decipher.final()]).toString());
    } catch (error) { if (error.code !== "ENOENT") console.error("Native voice connection needs admin attention; saved configuration could not be loaded."); }
  })();
  async function storeConfiguration(patch) {
    const next = { ...savedConfiguration, ...patch };
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(next)), cipher.final()]);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(`${configFile}.tmp`, JSON.stringify({ iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") }), { mode: 0o600 });
    await fs.rename(`${configFile}.tmp`, configFile);
    savedConfiguration = next;
  }
  let writes = Promise.resolve();
  async function sessions() {
    await writes;
    try { return JSON.parse(await fs.readFile(file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return {}; throw error; }
  }
  async function saveSession(identity, record) {
    const result = writes.then(async () => {
      let data;
      try { data = JSON.parse(await fs.readFile(file, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; data = {}; }
      data[identity] = { ...data[identity], ...record };
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(`${file}.tmp`, JSON.stringify(data));
      await fs.rename(`${file}.tmp`, file);
    });
    writes = result.catch(() => {});
    return result;
  }
  async function staffOnly(req, res, next) {
    res.set("Cache-Control", "no-store, private");
    try {
      await initialized;
      const staff = await authenticate(req);
      if (!staff.ok || staff.role === "reviewer") return res.status(403).json({ error: "Staff sign-in required." });
      res.locals.staff = staff;
      next();
    } catch (error) { next(error); }
  }
  function signedTwilio(req, res, next) {
    const url = `${String(process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "")}${req.originalUrl}`;
    if (!process.env.TWILIO_AUTH_TOKEN || req.body.AccountSid !== process.env.TWILIO_ACCOUNT_SID || !twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, req.get("x-twilio-signature") || "", url, req.body)) {
      return res.status(403).send("Forbidden");
    }
    next();
  }
  app.get("/api/voice/config", staffOnly, (_req, res) => res.json({ ...nativeVoiceStatus(), callerIds: [...new Set(callerIds())] }));
  app.get("/api/voice/number-routes", staffOnly, async (_req, res, next) => {
    if (res.locals.staff.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    try {
      const client = createClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const allowed = new Set(callerIds());
      const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });
      res.json({ numbers: numbers.filter((number) => allowed.has(number.phoneNumber)).map((number) => ({ phone: number.phoneNumber, route: number.trunkSid ? "AI direct" : number.voiceUrl?.includes("/api/twilio/voice") ? "Dispatch call controls" : "Other", voiceUrl: number.voiceUrl || "" })) });
    } catch (error) { next(error); }
  });
  app.post("/api/voice/number-routes", express.json(), staffOnly, async (req, res, next) => {
    if (res.locals.staff.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    try {
      const phone = voiceNumber(req.body.phone);
      if (!callerIds().includes(phone)) return res.status(400).json({ error: "Choose one of your DDD numbers." });
      const client = createClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const number = (await client.incomingPhoneNumbers.list({ phoneNumber: phone, limit: 1 }))[0];
      if (!number) return res.status(404).json({ error: "This number is not in the connected phone account." });
      const previousRoutes = configuration().TWILIO_VOICE_PREVIOUS_NUMBER_ROUTES || {};
      if (req.body.restore === true) {
        const previous = previousRoutes[phone];
        if (!previous) return res.status(400).json({ error: "No saved route to restore." });
        await client.incomingPhoneNumbers(number.sid).update(previous);
        return res.json({ ok: true, restored: true });
      }
      let aiUri = process.env.TRANSFER_SIP_URI || process.env.OPENAI_SIP_URI || configuredAiSipUri();
      if (!aiUri && number.trunkSid) {
        const urls = await client.trunking.v1.trunks(number.trunkSid).originationUrls.list({ limit: 20 });
        aiUri = urls.find((item) => item.enabled && /@sip\.api\.openai\.com(?=[:;?]|$)/i.test(item.sipUrl))?.sipUrl || "";
      }
      if (!aiUri) return res.status(409).json({ error: "The existing AI destination could not be verified. Current routing has not been changed." });
      if (!previousRoutes[phone]) previousRoutes[phone] = { voiceUrl: number.voiceUrl || "", voiceMethod: number.voiceMethod || "POST", trunkSid: number.trunkSid || "", voiceApplicationSid: number.voiceApplicationSid || "" };
      await storeConfiguration({ TWILIO_VOICE_AI_SIP_URI: aiUri, TWILIO_VOICE_PREVIOUS_NUMBER_ROUTES: previousRoutes });
      await getLiveCalls().config({ ...await getLiveCalls().config(), enabled: true });
      const voiceUrl = `${String(process.env.PUBLIC_BASE_URL).replace(/\/$/, "")}/api/twilio/voice`;
      await client.incomingPhoneNumbers(number.sid).update({ trunkSid: "", voiceApplicationSid: "", voiceUrl, voiceMethod: "POST" });
      res.json({ ok: true, phone, route: "Dispatch call controls", voiceUrl });
    } catch (error) { next(error); }
  });
  app.post("/api/voice/provision", express.json(), staffOnly, async (_req, res, next) => {
    if (res.locals.staff.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    try {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.PUBLIC_BASE_URL) return res.status(503).json({ error: "Twilio server connection is missing." });
      provisioning ||= (async () => {
        const client = createClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        if (!configuration().TWILIO_VOICE_APP_SID) {
          const application = await client.applications.create({ friendlyName: "DDD Dispatch native calls", voiceUrl: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/voice/connect`, voiceMethod: "POST" });
          try { await storeConfiguration({ TWILIO_VOICE_APP_SID: application.sid }); }
          catch (error) { await client.applications(application.sid).remove().catch(() => {}); throw error; }
        }
        if (!configuration().TWILIO_VOICE_API_KEY_SID) {
          const key = await client.newKeys.create({ friendlyName: "DDD Dispatch voice tokens" });
          try { await storeConfiguration({ TWILIO_VOICE_API_KEY_SID: key.sid, TWILIO_VOICE_API_KEY_SECRET: key.secret }); }
          catch (error) { await client.keys(key.sid).remove().catch(() => {}); throw error; }
        }
      })().finally(() => { provisioning = null; });
      await provisioning;
      res.json({ ok: true, ...nativeVoiceStatus() });
    } catch (error) { next(error); }
  });
  app.post("/api/voice/push-credential", express.json({ limit: "100kb" }), staffOnly, async (req, res, next) => {
    if (res.locals.staff.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    try {
      const certificate = String(req.body.certificate || "");
      const privateKey = String(req.body.privateKey || "");
      const cert = new crypto.X509Certificate(certificate);
      if (!cert.checkPrivateKey(crypto.createPrivateKey(privateKey)) || Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) < Date.now() || !cert.subject.includes("com.dddcincy.aireceptionist") || !/VoIP/i.test(cert.subject)) return res.status(400).json({ error: "Use the matching, unexpired DDD Dispatch Apple VoIP certificate and private key." });
      const client = createClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const credential = await client.chat.v2.credentials.create({ type: "apn", certificate, privateKey, sandbox: false, friendlyName: "DDD Dispatch production VoIP" });
      try { await storeConfiguration({ TWILIO_VOICE_PUSH_CREDENTIAL_SID: credential.sid }); }
      catch (error) { await client.chat.v2.credentials(credential.sid).remove().catch(() => {}); throw error; }
      res.json({ ok: true, ...nativeVoiceStatus() });
    } catch (error) { next(error); }
  });
  app.post("/api/voice/token", express.json(), staffOnly, async (req, res, next) => {
    try {
      const status = nativeVoiceStatus();
      if (!status.ready) return res.status(503).json({ error: "Direct calling setup is not complete.", ...status });
      const staff = res.locals.staff;
      const config = configuration();
      const identity = voiceIdentity(staff);
      const token = new twilio.jwt.AccessToken(process.env.TWILIO_ACCOUNT_SID, config.TWILIO_VOICE_API_KEY_SID, config.TWILIO_VOICE_API_KEY_SECRET, { identity, ttl: 3600 });
      token.addGrant(new twilio.jwt.AccessToken.VoiceGrant({ outgoingApplicationSid: config.TWILIO_VOICE_APP_SID, incomingAllow: status.incomingReady, ...(status.incomingReady ? { pushCredentialSid: config.TWILIO_VOICE_PUSH_CREDENTIAL_SID } : {}) }));
      const code = String(req.get("x-staff-code") || req.get("x-admin-pin") || "").trim();
      if (!code) return res.status(403).json({ error: "Staff sign-in required." });
      await saveSession(identity, { identity, name: staff.name, role: staff.role, credential: encryptStaffCode(code), signedIn: true, updatedAt: new Date().toISOString() });
      res.json({ token: token.toJwt(), identity, expiresIn: 3600, incomingReady: status.incomingReady, callerIds: [...new Set(callerIds())] });
    } catch (error) { next(error); }
  });
  app.post("/api/voice/session", express.json(), staffOnly, async (req, res, next) => {
    try {
      await saveSession(voiceIdentity(res.locals.staff), { active: req.body.active === true && nativeVoiceStatus().incomingReady, signedIn: req.body.signedOut !== true, available: req.body.available !== false, updatedAt: new Date().toISOString() });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });
  app.post("/api/voice/connect", express.urlencoded({ extended: false }), signedTwilio, async (req, res, next) => {
    try {
      const identity = String(req.body.From || "").replace(/^client:/, "");
      const registered = (await sessions())[identity];
      const staff = await verifySession(identity, registered);
      if (!staff.ok || staff.role === "reviewer") return res.status(403).type("text/xml").send("<Response><Say>Please sign in to Dispatch again.</Say><Hangup/></Response>");
      if (req.body.LiveCallId) {
        const twiml = await getLiveCalls().join(String(req.body.LiveCallId), identity, req.body.CallSid, req.body.LiveMode || "listen", staff.name);
        return res.type("text/xml").send(twiml);
      }
      const to = voiceNumber(req.body.To);
      const ids = [...new Set(callerIds())];
      const from = voiceNumber(req.body.CallerId) || ids[0];
      if (!staff.ok || !to || !ids.includes(from) || ids.includes(to)) return res.status(400).type("text/xml").send("<Response><Say>DDD could not start this call. Please check the customer number and sign in again.</Say><Hangup/></Response>");
      const base = String(process.env.PUBLIC_BASE_URL).replace(/\/$/, "");
      const callback = `${base}/api/voice/status?customer=${encodeURIComponent(to)}`;
      await saveCallEvent({ type: "twilio.native.outgoing", data: { call_id: req.body.CallSid, direction: "outbound", status: "initiated", sip_headers: [{ name: "from", value: to }, { name: "to", value: from }] } });
      res.type("text/xml").send(`<Response><Dial callerId="${xml(from)}" answerOnBridge="true" timeout="30"><Number statusCallback="${xml(callback)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${xml(to)}</Number></Dial></Response>`);
    } catch (error) { next(error); }
  });
  app.post("/api/voice/status", express.urlencoded({ extended: false }), signedTwilio, async (req, res, next) => {
    try {
      await saveCallEvent({ type: "twilio.native.status", data: { call_id: req.body.ParentCallSid || req.body.CallSid, status: req.body.CallStatus || "", durationSeconds: Number(req.body.CallDuration || 0), direction: "outbound", sip_headers: [{ name: "from", value: voiceNumber(req.query.customer) }, { name: "to", value: voiceNumber(req.body.From) }] } });
      res.sendStatus(204);
    } catch (error) { next(error); }
  });
  app.post("/api/voice/human-result", express.urlencoded({ extended: false }), signedTwilio, (req, res) => {
    const completed = req.body.DialCallStatus === "completed";
    res.type("text/xml").send(completed ? "<Response><Hangup/></Response>" : "<Response><Say>We could not reach the team. Please reply to DDD by text and we will follow up.</Say><Hangup/></Response>");
  });
  app.get("/api/live-calls/config", staffOnly, async (_req, res, next) => {
    if (res.locals.staff.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    try { res.json(await getLiveCalls().config()); } catch (error) { next(error); }
  });
  app.post("/api/live-calls/config", express.json(), staffOnly, async (req, res, next) => {
    if (res.locals.staff.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    try { res.json(await getLiveCalls().config(req.body)); } catch (error) { next(error); }
  });
  app.post("/api/live-calls/:id/takeover", express.json(), staffOnly, async (req, res, next) => {
    try { res.json(await getLiveCalls().takeOver(req.params.id, voiceIdentity(res.locals.staff))); } catch (error) { next(error); }
  });
  app.post("/api/live-calls/:id/incoming-mode", express.json(), staffOnly, async (req, res, next) => {
    try { res.json(await getLiveCalls().prepareIncoming(req.params.id, voiceIdentity(res.locals.staff), req.body.mode)); } catch (error) { next(error); }
  });
  for (const route of ["events", "participant-status"]) {
    app.post(`/api/live-calls/${route}`, express.urlencoded({ extended: false }), signedTwilio, async (req, res, next) => {
      try {
        if (route === "events") await getLiveCalls().events(req.query.call, req.body);
        else await getLiveCalls().participantStatus(req.query.call, req.query.participant, req.body);
        res.sendStatus(204);
      } catch (error) { next(error); }
    });
  }
  return { async routingIdentities() {
    await initialized;
    if (!nativeVoiceStatus().incomingReady) return [];
    const candidates = Object.values(await sessions()).filter((session) => session.signedIn && session.active && session.available && Date.now() - Date.parse(session.updatedAt) < 7 * 86400000).slice(0, 10);
    const verified = await Promise.all(candidates.map(async (session) => {
      const staff = await verifySession(session.identity, session);
      return staff.ok && !["busy", "active_call", "active call"].includes(String(staff.availability || "").toLowerCase()) ? session.identity : "";
    }));
    return verified.filter(Boolean);
  } };
}
