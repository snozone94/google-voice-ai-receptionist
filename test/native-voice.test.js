import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mountNativeVoice, voiceNumber, voiceIdentity } from "../src/native-voice.js";

test("voice numbers normalize and staff identities do not reveal credentials", () => {
  assert.equal(voiceNumber("(513) 409-1342"), "+15134091342");
  assert.equal(voiceNumber("123"), "");
  assert.equal(voiceIdentity({ id: "42", name: "Bria" }), voiceIdentity({ id: "42", name: "Brianna" }));
  assert.notEqual(voiceIdentity({ id: "42" }), voiceIdentity({ id: "43" }));
});

test("native credential setup is admin-only, idempotent and encrypted at rest", async () => {
  const previous = { ...process.env };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-voice-test-"));
  try {
    process.env.TWILIO_ACCOUNT_SID = `AC${"1".repeat(32)}`;
    process.env.TWILIO_AUTH_TOKEN = "test-auth-token-not-production";
    process.env.PUBLIC_BASE_URL = "https://dispatch.example.test";
    for (const name of Object.keys(process.env)) if (name.startsWith("TWILIO_VOICE_")) delete process.env[name];
    const routes = new Map();
    const app = { get: (route, ...handlers) => routes.set(`GET ${route}`, handlers), post: (route, ...handlers) => routes.set(`POST ${route}`, handlers) };
    const parser = () => (_req, _res, next) => next();
    let keys = 0;
    let applications = 0;
    mountNativeVoice(app, {
      express: { json: parser, urlencoded: parser }, directory,
      authenticate: async (req) => req.staff || { ok: false },
      callerIds: () => ["+15134091342"], saveCallEvent: async () => {},
      createClient: () => ({
        applications: { create: async () => { applications++; return { sid: `AP${"2".repeat(32)}` }; } },
        newKeys: { create: async () => { keys++; return { sid: `SK${"3".repeat(32)}`, secret: "test-voice-secret" }; } }
      })
    });
    async function request(route, staff) {
      const req = { staff, body: {}, get: () => "test-staff-code" };
      const res = { locals: {}, statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      const handlers = routes.get(route);
      const run = async (index) => {
        if (!handlers[index]) return;
        let pending;
        await handlers[index](req, res, (error) => { if (error) throw error; pending = run(index + 1); });
        await pending;
      };
      await run(0);
      return res;
    }
    assert.equal((await request("POST /api/voice/provision")).statusCode, 403);
    assert.equal((await request("POST /api/voice/provision", { ok: true, name: "Tech", role: "tech" })).statusCode, 403);
    const admin = { ok: true, name: "Admin", role: "admin" };
    assert.equal((await request("POST /api/voice/provision", admin)).body.ready, true);
    await request("POST /api/voice/provision", admin);
    assert.equal(keys, 1);
    assert.equal(applications, 1);
    const saved = await fs.readFile(path.join(directory, "voice-connection.enc.json"), "utf8");
    assert.equal(saved.includes("test-voice-secret"), false);
    const token = (await request("POST /api/voice/token", admin)).body;
    const claims = JSON.parse(Buffer.from(token.token.split(".")[1], "base64url"));
    assert.equal(claims.exp - claims.iat, 3600);
    assert.equal(Boolean(claims.grants.voice.incoming?.allow), false);
    assert.deepEqual(token.callerIds, ["+15134091342"]);
    assert.equal(JSON.stringify(token).includes("test-voice-secret"), false);
    const sessions = await fs.readFile(path.join(directory, "voice-sessions.json"), "utf8");
    assert.equal(sessions.includes("test-staff-code"), false);
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
