import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import { EventEmitter } from "node:events";
import { notificationState } from "../src/notification-state.js";

// Isolated data and fake providers: these tests never load a secret env file or
// contact Twilio, Expo, SMTP, or the production staff service.
test("dispatch HTTP contract, reviewer isolation, ownership, policy and provider outcomes", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-server-dispatch-"));
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { DATA_DIR: dir, NODE_ENV: "test", DOTENV_CONFIG_PATH: "/dev/null", ADMIN_PIN: "test-admin", APP_REVIEW_PIN: "4444", DDD_TECH_TEAM_URL: "https://roster.invalid/team", DDD_TECH_AUTH_URL: "", DDD_TECH_ROLE_OVERRIDES_URL: "", TWILIO_ACCOUNT_SID: "test-account", TWILIO_AUTH_TOKEN: "test-auth", TWILIO_SMS_FROM: "+15135550101", BOOKING_URL: "https://booking.invalid/request", EMAIL_ALERTS_ENABLED: "false", TWILIO_SMS_WEBHOOK_SECRET: "test-webhook", PUBLIC_BASE_URL: "https://dispatch.invalid", OPENAI_SIP_URI: "sip:ai.invalid", DDD_BOOKING_WEBHOOK_URL: "", WORDPRESS_BOOKING_WEBHOOK_URL: "", DDD_CUSTOMER_HISTORY_URL: "", LEAD_WEBHOOK_URL: "", CALL_START_SMS_ENABLED: "true", MISSED_CALL_SMS_ENABLED: "true", COMPLETED_CALL_SMS_ENABLED: "true" });
  const roster = [{ id: "one", name: "One", role: "tech", code: "staff-one", active: true }, { id: "two", name: "Two", role: "tech", code: "staff-two", active: true }];
  let rosterCalls = 0;
  const pushes = [], sms = [];
  let historyRows = [];
  let ticketFailure = false, smsFailure = false, smsNetworkFailure = false;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("http://127.0.0.1:")) return originalFetch(url, options);
    if (String(url) === "https://roster.invalid/team") { rosterCalls++; return Response.json({ team: roster }); }
    if (String(url).startsWith("https://history.invalid/")) return Response.json({ bookings: historyRows });
    if (String(url).startsWith("https://exp.host/")) { pushes.push(JSON.parse(options.body)); return Response.json({ data: ticketFailure ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: `ticket-${pushes.length}` } }); }
    if (String(url).startsWith("https://api.twilio.com/") && String(url).endsWith("Messages.json")) {
      sms.push(Object.fromEntries(options.body));
      if (smsNetworkFailure) throw new Error("Unknown provider outcome");
      return smsFailure ? Response.json({ status: "failed", message: "Rejected", code: 21610 }, { status: 400 }) : Response.json({ sid: `SMtest${sms.length}`, status: "queued" });
    }
    throw new Error(`Unexpected external request: ${url}`);
  };
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
    await fs.rm(dir, { recursive: true, force: true });
  });
  const { app, sendAlertEmail, sendSmtpMail, notifyTeam, checkUnansweredTexts, sendCallStartSmsIfNeeded, sendMissedCallSms, sendCompletedCallSmsIfNeeded, callSelfServiceSmsMessage } = await import("../src/server.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, code = "test-admin", body) => {
    const response = await originalFetch(`${base}${route}`, { method: body ? "POST" : "GET", headers: { "x-staff-code": code, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const phone = "+15135550100";
  // A persisted migration baseline allows the ordinary reminder scenarios
  // below to use already-due post-activation fixtures without waiting minutes.
  const baseline = await notificationState(dir).activation("reply-escalation-v1", Date.now() - 20 * 60000);
  const receivedAt = new Date(Date.now() - 6 * 60000).toISOString();
  const writeInbound = (createdAt) => fs.writeFile(path.join(dir, "sms.jsonl"), `${JSON.stringify({ direction: "inbound", from: phone, to: "+15135550101", body: "Private real customer", messageSid: "SMinbound", createdAt })}\n`);
  await writeInbound(receivedAt);
  await t.test("reviewer credentials bypass real auth/data and cannot mutate or read policy", async () => {
    const response = await request("/api/operations", "4444");
    assert.equal(response.status, 200);
    assert.doesNotMatch(JSON.stringify(response.body), /Private real customer/);
    assert.equal(response.body.staff.role, "reviewer");
    assert.equal(rosterCalls, 0);
    assert.equal((await request(`/api/conversations/${phone}/state`, "4444", { action: "claim" })).status, 403);
    assert.equal((await request("/api/admin/reply-policy", "4444")).status, 403);
    assert.equal((await request("/api/operations", "")).status, 403);
  });
  await t.test("ownership uses auth identity, validates roster and keeps read separate from reply", async () => {
    let response = await request("/api/operations", "staff-one");
    assert.equal(response.status, 200);
    assert.equal(response.body.summary.needsReply, 1);
    assert.equal(response.body.health, undefined);
    assert.doesNotMatch(JSON.stringify(response.body.team), /staff-one|staff-two/);
    assert.equal((await request(`/api/conversations/${phone}/state`, "staff-one", { action: "claim", assigneeId: "two", assigneeName: "Two" })).body.state.assignedTo.id, "one");
    assert.equal((await request(`/api/conversations/${phone}/state`, "staff-two", { action: "release" })).status, 403);
    assert.equal((await request(`/api/conversations/${phone}/state`, "staff-two", { action: "assign", assigneeId: "two", assigneeName: "Two" })).status, 403);
    assert.equal((await request(`/api/conversations/${phone}/state`, "test-admin", { action: "assign", assigneeId: "missing", assigneeName: "Missing" })).status, 400);
    await request(`/api/conversations/${phone}/state`, "staff-one", { action: "read", through: new Date().toISOString() });
    response = await request("/api/operations", "staff-one");
    assert.equal(response.body.summary.unreadMessages, 0);
    assert.equal(response.body.summary.needsReply, 1);
    assert.equal(response.body.conversations[0].capabilities.release, true);
    assert.equal((await request("/api/admin/reply-policy", "staff-one")).status, 403);
    assert.deepEqual((await request("/api/admin/reply-policy")).body.replyPolicy, { remindAfterMinutes: 5, escalateAfterMinutes: 15 });
    assert.equal((await request("/api/admin/reply-policy", "test-admin", { remindAfterMinutes: 5, escalateAfterMinutes: 4 })).status, 400);
  });
  await t.test("rollout baseline leaves historical requests on Home but excludes them from new-stage alerts", async () => {
    const ancient = new Date(Date.now() - 180 * 86400000).toISOString();
    await fs.appendFile(path.join(dir, "sms.jsonl"), [
      { direction: "inbound", from: phone, body: "Old request on the current thread", messageSid: "SMancient-current", createdAt: ancient },
      { direction: "inbound", from: "+15135550997", body: "Historical-only backlog", messageSid: "SMancient-only", createdAt: ancient },
      { direction: "inbound", from: "+15135550998", body: "Already reminded by the legacy worker", messageSid: "SMlegacy", createdAt: receivedAt }
    ].map(JSON.stringify).join("\n") + "\n");
    await notificationState(dir).claim("unanswered-text:+15135550998:SMlegacy");
    const result = await request("/api/operations");
    assert.equal(result.body.conversations.find((thread) => thread.phone === phone).waitingSince, ancient);
    assert.equal(result.body.conversations.find((thread) => thread.phone === "+15135550997").needsReply, true);
    assert.equal(await notificationState(dir).activation("reply-escalation-v1"), baseline);
  });
  await fs.writeFile(path.join(dir, "push-tokens.jsonl"), [
    { token: "ExponentPushToken[one]", staffId: "one", staffName: "One", staffRole: "tech" },
    { token: "ExponentPushToken[two]", staffId: "two", staffName: "Two", staffRole: "tech" },
    { token: "ExponentPushToken[admin]", staffName: "Brianna", staffRole: "admin" }
  ].map((value) => JSON.stringify(value)).join("\n"));
  await t.test("reminder reaches only owner once; escalation reaches only admins once; handled suppresses", async () => {
    await checkUnansweredTexts();
    assert.deepEqual(pushes.map((message) => message.to), ["ExponentPushToken[one]"]);
    await checkUnansweredTexts();
    assert.equal(pushes.length, 1);
    await writeInbound(new Date(Date.now() - 16 * 60000).toISOString());
    await checkUnansweredTexts();
    assert.equal(pushes.at(-1).to, "ExponentPushToken[admin]");
    assert.equal(pushes.length, 2);
    await checkUnansweredTexts();
    assert.equal(pushes.length, 2);
    await request(`/api/conversations/${phone}/state`, "staff-one", { action: "handled", through: new Date().toISOString() });
    await checkUnansweredTexts();
    assert.equal(pushes.length, 2);
  });
  await t.test("HTTP 200 failed Expo tickets produce honest failure health, accepted tickets stay unverified", async () => {
    ticketFailure = true;
    const failed = await notifyTeam({ title: "Ticket test", body: "Test", data: { type: "sms", messageId: "SMticket-failed" } });
    assert.equal(failed.ok, false);
    assert.equal(failed.sent, 0);
    assert.ok(failed.errors.some((error) => /DeviceNotRegistered/.test(error)));
    let result = await request("/api/operations");
    assert.equal(result.body.health.find((row) => row.key === "push").status, "error");
    ticketFailure = false;
    const accepted = await notifyTeam({ title: "Ticket test", body: "Test", data: { type: "sms", messageId: "SMticket-ok" } });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.sent, 3);
    result = await request("/api/operations");
    const health = result.body.health.find((row) => row.key === "push");
    assert.equal(health.status, "unknown");
    assert.match(health.detail, /accepted/);
    const before = pushes.length;
    await notifyTeam({ title: "Ticket test", body: "Test", data: { type: "sms", messageId: "SMticket-ok" } });
    assert.equal(pushes.length, before);
  });
  await t.test("three call SMS paths serialize normalized phone and share durable reservation", async () => {
    const results = await Promise.all([sendCallStartSmsIfNeeded("5135550123"), sendMissedCallSms("+15135550123"), sendCompletedCallSmsIfNeeded("(513) 555-0123")]);
    assert.equal(results.filter((result) => result.ok && !result.skipped).length, 1);
    assert.equal(sms.length, 1);
    assert.equal((sms[0].Body.match(/https:\/\//g) || []).length, 1);
    assert.match(sms[0].Body, /service, vehicle, and location/);
    assert.doesNotMatch(sms[0].Body, /apps.apple|play.google/);
    assert.equal(callSelfServiceSmsMessage("Custom https://apps.apple.com/custom and {{link}}"), "Custom https://apps.apple.com/custom and https://booking.invalid/request");
    smsNetworkFailure = true;
    await assert.rejects(() => sendCallStartSmsIfNeeded("5135550124"));
    smsNetworkFailure = false;
    assert.equal((await sendCompletedCallSmsIfNeeded("5135550124")).skipped, true);
    assert.equal(sms.length, 2);
  });
  await t.test("known stock three-link env templates migrate; genuine custom templates and links remain unchanged", async () => {
    const booking = "https://dddcincy.com/book-service/";
    const ios = "https://apps.apple.com/app/id6762315831";
    const android = "https://play.google.com/store/apps/details?id=com.dddroadside.mobile";
    for (const opening of ["Thanks for calling DDD.", "Sorry we missed you."]) {
      const old = `${opening} Reply with the service, vehicle, and location, or book here: ${booking} DDD Mobile: iPhone ${ios} Android ${android}`;
      const result = callSelfServiceSmsMessage(old);
      assert.equal((result.match(/https:\/\//g) || []).length, 1);
      assert.doesNotMatch(result, /apps.apple|play.google/);
    }
    const custom = "Thanks for calling DDD. Our custom instructions: https://custom.invalid/one and https://custom.invalid/two";
    assert.equal(callSelfServiceSmsMessage(custom), custom);
    const allCustom = `Special campaign: ${booking} ${ios} ${android}`;
    assert.equal(callSelfServiceSmsMessage(allCustom), allCustom);
    const previous = process.env.CALL_START_SMS_MESSAGE;
    process.env.CALL_START_SMS_MESSAGE = `Thanks for calling DDD. Book here: ${booking} iPhone ${ios} Android ${android}`;
    const before = sms.length;
    await sendCallStartSmsIfNeeded("5135550125");
    assert.equal(sms.length, before + 1);
    assert.equal((sms.at(-1).Body.match(/https:\/\//g) || []).length, 1);
    if (previous === undefined) delete process.env.CALL_START_SMS_MESSAGE; else process.env.CALL_START_SMS_MESSAGE = previous;
  });
  await t.test("public booking replay cannot recover another record or inject identity/status", async () => {
    const victim = { bookingId: "victim", statusToken: "private-bearer", name: "Existing private customer", phone: "+15135550999", createdAt: new Date().toISOString(), status: "Requested" };
    await fs.writeFile(path.join(dir, "bookings.jsonl"), JSON.stringify(victim) + "\n");
    const response = await request("/api/bookings", "", { bookingId: "victim", id: "victim", statusToken: "private-bearer", customerStatusToken: "injected", externalSync: { jobId: "injected" }, status: "Completed", name: "New customer", phone: "+15135550888", preferredTime: "ASAP", smsConsent: false });
    assert.equal(response.status, 201);
    assert.notEqual(response.body.booking.bookingId, "victim");
    assert.notEqual(response.body.booking.statusToken, "private-bearer");
    assert.notEqual(response.body.booking.statusToken, "injected");
    assert.equal(response.body.booking.status, "Requested");
    assert.doesNotMatch(JSON.stringify(response.body), /Existing private customer|private-bearer|injected/);
    const snapshots = (await fs.readFile(path.join(dir, "bookings.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.deepEqual(snapshots[0], victim);
  });
  await t.test("authenticated provider status feeds change health; acceptance alone stays unknown", async () => {
    let health = (await request("/api/operations")).body.health;
    assert.equal(health.find((row) => row.key === "sms").status, "unknown");
    const callback = (route, body, authenticated = true) => originalFetch(`${base}${route}${authenticated ? "?secret=test-webhook" : ""}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
    assert.equal((await callback("/api/twilio/sms-status", { MessageStatus: "delivered", MessageSid: "SMtest1" }, false)).status, 403);
    assert.equal((await callback("/api/twilio/sms-status", { MessageStatus: "delivered", MessageSid: "SMtest1", From: "+15135550101", To: "+15135550123" })).status, 200);
    process.env.COMPLETED_CALL_SMS_ENABLED = "false";
    assert.equal((await callback("/api/twilio/call-status", { CallStatus: "completed", CallSid: "CA" + "a".repeat(32), CallDuration: "90", From: phone })).status, 200);
    health = (await request("/api/operations")).body.health;
    assert.equal(health.find((row) => row.key === "sms").status, "ok");
    assert.match(health.find((row) => row.key === "sms").detail, /delivered/);
    assert.equal(health.find((row) => row.key === "calling").status, "ok");
    assert.match(health.find((row) => row.key === "calling").detail, /completed/);
    const sync = health.find((row) => row.key === "bookingSync");
    assert.notEqual(sync.status, "ok");
    assert.match(sync.detail, /unverified/);
  });
  await t.test("caller booking status reads the actual status feed; empty remote matches stay unverified", async () => {
    process.env.DDD_CUSTOMER_HISTORY_URL = "https://history.invalid/feed?version=empty";
    let result = await request("/api/operations");
    let sync = result.body.health.find((row) => row.key === "bookingSync");
    assert.equal(sync.status, "warning"); // The normative statusSync marks absent remote lifecycle as missing.
    assert.ok(result.body.bookings.every((booking) => booking.statusSync.status === "missing" && booking.statusSync.matchedAt === null));
    assert.match(sync.detail, /0 lifecycle matches/);
    assert.match(sync.detail, /absent remote matches/);
    assert.match(sync.detail, /No verified lifecycle match timestamp/);
    const statusRoute = "/api/bookings/victim/status?token=private-bearer";
    assert.equal((await request(statusRoute, "")).body.booking.status, "Requested");
    process.env.DDD_CUSTOMER_HISTORY_URL = "https://history.invalid/feed?version=matched";
    historyRows = [{ external_booking_id: "victim", status: "Technician Completed", assignee: "One", serviceTime: "2026-10-30" }];
    assert.equal((await request(statusRoute, "")).body.booking.status, "Technician Completed");
    result = await request("/api/operations");
    assert.equal(result.body.summary.openBookings, 1); // Only the new public intake remains open.
    sync = result.body.health.find((row) => row.key === "bookingSync");
    assert.match(sync.detail, /1 lifecycle matches/);
    assert.notEqual(sync.status, "ok"); // The other booking has no exact remote match.
    process.env.DDD_CUSTOMER_HISTORY_URL = "";
  });
  await t.test("SMTP DATA acceptance survives failed QUIT; lost acknowledgments are held as uncertain", async () => {
    for (const mode of ["accepted", "quit-error"]) {
      let message;
      const result = await sendSmtpMail({ host: "smtp.invalid", secure: true, user: "test", pass: "test", from: "sender@example.test", to: ["one@example.test"], subject: "Test", text: "Test", connect: () => fakeSmtp(mode, undefined, undefined, (body) => { message = body; }) });
      assert.equal(result.status, "accepted");
      assert.match(message, /From: DDD Dispatch <sender@example.test>/);
      assert.doesNotMatch(message, /From: DDD AI Dispatch/);
    }
    await assert.rejects(() => sendSmtpMail({ host: "smtp.invalid", secure: true, user: "test", pass: "test", from: "sender@example.test", to: ["one@example.test"], subject: "Test", text: "Test", connect: () => fakeSmtp("lost-data-ack") }), (error) => error.uncertain === true);
    await assert.rejects(() => sendSmtpMail({ host: "smtp.invalid", secure: true, user: "test", pass: "test", from: "sender@example.test", to: ["one@example.test"], subject: "Test", text: "Test", connect: () => fakeSmtp("reject-data") }), (error) => error.smtpCode === 550 && !error.uncertain);
  });
  await t.test("partial SMTP recipients and canonical child-call retries never resend accepted mail", async (child) => {
    Object.assign(process.env, { EMAIL_ALERTS_ENABLED: "true", SMTP_HOST: "smtp.invalid", SMTP_USER: "sender@example.test", SMTP_PASS: "test", ALERT_EMAIL_TO: "one@example.test,two@example.test" });
    const recipients = [], acceptedRecipients = [];
    let rejectSecond = true;
    child.mock.method(tls, "connect", () => fakeSmtp("accepted", (recipient) => { recipients.push(recipient); return rejectSecond && recipient === "two@example.test"; }, (recipient) => acceptedRecipients.push(recipient)));
    await fs.appendFile(path.join(dir, "calls.jsonl"), JSON.stringify({ callId: "smtp-child", parentCallId: "smtp-root", createdAt: new Date().toISOString(), status: "completed" }) + "\n");
    const first = await notifyTeam({ title: "Call attention", body: "Test", data: { type: "ai-pickup-failed", callId: "smtp-root" } });
    assert.equal(first.ok, false);
    assert.deepEqual(acceptedRecipients, ["one@example.test"]);
    const stateFile = path.join(dir, "notification-state.json");
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    for (const delivery of Object.values(state.deliveries)) if (delivery.status === "retry") delivery.expires = 0;
    await fs.writeFile(stateFile, JSON.stringify(state));
    rejectSecond = false;
    const second = await notifyTeam({ title: "Call attention again", body: "Test", data: { type: "missed-call", callId: "smtp-child" } });
    assert.equal(second.ok, true);
    assert.deepEqual(recipients.sort(), ["one@example.test", "two@example.test", "two@example.test"]);
    assert.deepEqual(acceptedRecipients.sort(), ["one@example.test", "two@example.test"]);
    process.env.EMAIL_ALERTS_ENABLED = "false";
  });
  await t.test("SMTP acceptance is preserved when outcome-observation persistence fails", async (child) => {
    process.env.EMAIL_ALERTS_ENABLED = "true";
    let failObservation = false;
    const writeFile = fs.writeFile;
    child.mock.method(fs, "writeFile", async (file, ...args) => {
      if (failObservation && String(file).endsWith("notification-state.json.tmp")) { failObservation = false; throw new Error("Observation write failed"); }
      return writeFile(file, ...args);
    });
    child.mock.method(tls, "connect", () => fakeSmtp("accepted", () => false, () => { failObservation = true; }));
    const result = await sendAlertEmail({ title: "Test accepted", body: "Test", data: { type: "sms" }, emailRecipient: "one@example.test" });
    assert.equal(result.ok, true);
    assert.equal(result.status, "accepted");
    process.env.EMAIL_ALERTS_ENABLED = "false";
  });
  await t.test("uncertain SMTP submissions are not automatically resent", async (child) => {
    process.env.EMAIL_ALERTS_ENABLED = "true";
    let submissions = 0;
    child.mock.method(tls, "connect", () => { submissions++; return fakeSmtp("lost-data-ack"); });
    const payload = { title: "Uncertain email", body: "Test", data: { type: "sms", messageId: "SMuncertain" } };
    const result = await notifyTeam(payload);
    assert.equal(result.ok, false);
    assert.equal(result.stopRetry, true);
    assert.equal(result.email.uncertain, true);
    await notifyTeam(payload);
    assert.equal(submissions, 2); // One submission for each configured recipient.
    const health = (await request("/api/operations")).body.health.find((row) => row.key === "email");
    assert.equal(health.status, "warning");
    assert.match(health.detail, /uncertain/);
    assert.match(health.nextStep, /before resending/);
    process.env.EMAIL_ALERTS_ENABLED = "false";
  });

});

function fakeSmtp(mode, rejectRecipient = () => false, accepted = () => {}, capture = () => {}) {
  const socket = new EventEmitter();
  let auth = 0, inData = false, recipient;
  const reply = (code) => socket.emit("data", Buffer.from(`${code} test\r\n`));
  socket.setTimeout = () => socket;
  socket.destroy = (error) => { if (error) socket.emit("error", error); socket.emit("close"); };
  socket.end = () => {};
  socket.write = (line, encoding, callback) => {
    queueMicrotask(() => {
      if (line.startsWith("QUIT") && mode === "quit-error") { callback(new Error("QUIT failed after acceptance")); return; }
      callback();
      if (inData) {
        capture(line);
        inData = false;
        if (mode === "lost-data-ack") { socket.emit("close"); return; }
        if (mode === "reject-data") { reply(550); return; }
        accepted(recipient);
        reply(250);
      } else if (line.startsWith("EHLO")) reply(250);
      else if (line.startsWith("AUTH LOGIN")) { auth = 1; reply(334); }
      else if (auth === 1) { auth = 2; reply(334); }
      else if (auth === 2) { auth = 0; reply(235); }
      else if (line.startsWith("MAIL FROM")) reply(250);
      else if (line.startsWith("RCPT TO")) { recipient = line.match(/<([^>]+)>/)[1]; reply(rejectRecipient(recipient) ? 550 : 250); }
      else if (line.startsWith("DATA")) { inData = true; reply(354); }
      else if (line.startsWith("QUIT")) reply(221);
    });
    return true;
  };
  queueMicrotask(() => reply(220));
  return socket;
}
