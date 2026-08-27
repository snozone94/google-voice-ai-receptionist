import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import {
  callAcceptPayload,
  listCalls,
  listConversations,
  listSms,
  listBookings,
  listLeads,
  listSummaries,
  loadReceptionistSettings,
  loadBusiness,
  buildDryRun,
  normalizeVoice,
  saveCallEvent,
  saveIncomingSms,
  saveOutgoingSms,
  saveBookingRequest,
  saveLead,
  saveReceptionistSettings
} from "./receptionist.js";
import { monitorRealtimeCall } from "./realtime-tools.js";

const app = express();
const port = Number(process.env.PORT || 8787);

function openAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function requireOpenAIKey(req, res, next) {
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ ok: false, error: "OPENAI_API_KEY is not set." });
    return;
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/setup-status", (_req, res) => {
  const required = {
    openAIKey: Boolean(process.env.OPENAI_API_KEY),
    publicBaseUrl: Boolean(process.env.PUBLIC_BASE_URL && !process.env.PUBLIC_BASE_URL.includes("your-domain")),
    webhookSecret: Boolean(process.env.OPENAI_WEBHOOK_SECRET),
    googleVoiceNumber: Boolean(process.env.GOOGLE_VOICE_NUMBER),
    aiForwardingNumber: Boolean(process.env.AI_FORWARDING_NUMBER),
    smsDelivery: Boolean(
      process.env.SMS_FOLLOWUP_WEBHOOK_URL ||
        process.env.TWILIO_SMS_WEBHOOK_SECRET ||
        (process.env.VOIPMS_API_USERNAME && process.env.VOIPMS_API_PASSWORD && process.env.VOIPMS_SMS_DID)
    )
  };

  res.json({
    ok: Object.values(required).every(Boolean),
    required,
    googleVoiceNumber: process.env.GOOGLE_VOICE_NUMBER || "",
    aiForwardingNumber: process.env.AI_FORWARDING_NUMBER || "",
    webhookUrl:
      process.env.PUBLIC_BASE_URL && !process.env.PUBLIC_BASE_URL.includes("your-domain")
        ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/openai/sip-webhook`
        : ""
  });
});

app.get("/api/business", async (_req, res, next) => {
  try {
    const business = await loadBusiness();
    const settings = await loadReceptionistSettings();
    res.json({
      ...business,
      receptionistVoice: settings.voice,
      googleVoiceNumber: process.env.GOOGLE_VOICE_NUMBER || "",
      aiForwardingNumber: process.env.AI_FORWARDING_NUMBER || ""
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (_req, res, next) => {
  try {
    res.json(await loadReceptionistSettings());
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings", express.json(), async (req, res, next) => {
  try {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    res.json(await saveReceptionistSettings(req.body || {}));
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post("/api/twilio/sms", express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    if (!hasTwilioSmsAccess(req)) {
      res.status(403).send("Forbidden");
      return;
    }

    const record = await saveIncomingSms(req.body || {});
    console.log(`Inbound Twilio SMS stored from ${record.from || "unknown"} to ${record.to || "unknown"}`);
    res.type("text/xml").send("<Response></Response>");
  } catch (error) {
    next(error);
  }
});

app.get("/api/sms", async (req, res, next) => {
  try {
    if (!hasSmsReadAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json({ sms: await listSms(limit) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/conversations", async (req, res, next) => {
  try {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 200, 500);
    res.json({ conversations: await listConversations(limit) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sms/reply", express.json(), async (req, res, next) => {
  try {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    const to = normalizeE164(req.body?.to);
    const message = String(req.body?.message || "").replace(/\s+/g, " ").trim();
    const agentName = String(req.body?.agentName || "DDD team").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!to) {
      res.status(400).json({ ok: false, error: "Enter a valid customer phone number." });
      return;
    }
    if (!message || message.length > 1000) {
      res.status(400).json({ ok: false, error: "Enter a reply between 1 and 1000 characters." });
      return;
    }

    const delivery = await sendTwilioSms(to, message);
    const record = await saveOutgoingSms({
      to,
      from: process.env.TWILIO_SMS_FROM || process.env.GOOGLE_VOICE_NUMBER || "",
      body: message,
      messageSid: delivery.sid || "",
      status: delivery.status || (delivery.ok ? "sent" : "failed"),
      agentName
    });
    res.status(delivery.ok ? 201 : 502).json({ ok: delivery.ok, delivery, sms: record });
  } catch (error) {
    next(error);
  }
});

app.post("/api/twilio/voice-verify", express.urlencoded({ extended: false }), async (req, res) => {
  if (!hasTwilioSmsAccess(req)) {
    res.status(403).send("Forbidden");
    return;
  }

  const action = `/api/twilio/voice-verify/capture?secret=${encodeURIComponent(req.query.secret || "")}`;
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" timeout="12" speechTimeout="auto" action="${action}" method="POST">
    <Pause length="1"/>
  </Gather>
  <Redirect method="POST">${action}</Redirect>
</Response>`);
});

app.post("/api/twilio/voice-verify/capture", express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    if (!hasTwilioSmsAccess(req)) {
      res.status(403).send("Forbidden");
      return;
    }

    const codeText = [req.body.SpeechResult, req.body.Digits].filter(Boolean).join(" ").trim();
    await saveIncomingSms({
      From: req.body.From || "voice-verification",
      To: req.body.To || process.env.AI_FORWARDING_NUMBER || "",
      Body: codeText ? `Google Voice spoken verification: ${codeText}` : "Google Voice spoken verification call ended without captured speech.",
      MessageSid: req.body.CallSid || ""
    });
    res.type("text/xml").send("<Response><Hangup/></Response>");
  } catch (error) {
    next(error);
  }
});

app.post("/api/voice-preview", requireOpenAIKey, express.json(), async (req, res, next) => {
  try {
    const voice = normalizeVoice(req.body?.voice);
    if (!voice) {
      res.status(400).json({ ok: false, error: "Choose a supported voice." });
      return;
    }

    const settings = await loadReceptionistSettings();
    const speed = clampSpeechSpeed(req.body?.voiceSpeed || settings.voiceSpeed);
    const instructions = String(
      req.body?.voiceDirection ||
        settings.voiceDirection ||
        "Sound like a warm, polished business receptionist on a phone call."
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 700);
    const input = String(req.body?.text || settings.greeting || "Thank you for calling DDD. How can I help today?")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
    const speech = await openAIClient().audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input,
      instructions,
      speed,
      response_format: "mp3"
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.type("audio/mpeg").send(buffer);
  } catch (error) {
    next(error);
  }
});

app.get("/api/voice-preview.mp3", requireOpenAIKey, async (req, res, next) => {
  try {
    const settings = await loadReceptionistSettings();
    const voice = normalizeVoice(req.query.voice) || settings.voice;
    const speed = clampSpeechSpeed(req.query.voiceSpeed || settings.voiceSpeed);
    const instructions = String(req.query.voiceDirection || settings.voiceDirection)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 700);
    const input = String(req.query.text || settings.greeting || "Thank you for calling DDD. How can I help today?")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
    const speech = await openAIClient().audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input,
      instructions,
      speed,
      response_format: "mp3"
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.set("Cache-Control", "no-store");
    res.type("audio/mpeg").send(buffer);
  } catch (error) {
    next(error);
  }
});

app.post("/api/test-script", express.json(), async (req, res, next) => {
  try {
    const settings = await loadReceptionistSettings();
    res.json(buildDryRun(settings, req.body?.callerMessage || ""));
  } catch (error) {
    next(error);
  }
});

function clampSpeechSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return 1;
  return Math.min(1.5, Math.max(0.5, Math.round(speed * 100) / 100));
}

app.get("/api/leads", async (req, res, next) => {
  try {
    res.json({ leads: await listLeads(Number(req.query.limit || 25)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bookings", async (req, res, next) => {
  try {
    res.json({ bookings: await listBookings(Number(req.query.limit || 25)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings", express.json(), async (req, res, next) => {
  try {
    const booking = await saveBookingRequest(req.body || {});
    res.status(201).json({ ok: true, booking });
  } catch (error) {
    next(error);
  }
});

app.post("/api/leads", express.json(), async (req, res, next) => {
  try {
    const lead = await saveLead(req.body || {});
    res.status(201).json({ ok: true, lead });
  } catch (error) {
    next(error);
  }
});

app.get("/api/book", (_req, res) => {
  res.type("html").send(bookingPage());
});

app.get("/api/calls", async (req, res, next) => {
  try {
    res.json({ calls: await listCalls(Number(req.query.limit || 25)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/summaries", async (req, res, next) => {
  try {
    res.json({ summaries: await listSummaries(Number(req.query.limit || 25)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/webrtc-offer", requireOpenAIKey, express.text({ type: "*/*", limit: "2mb" }), async (req, res, next) => {
  try {
    if (!req.body?.startsWith("v=")) {
      res.status(400).send("Expected an SDP offer body.");
      return;
    }

    const business = await loadBusiness();
    const settings = await loadReceptionistSettings();
    if (!settings.enabled) {
      res.status(409).send("The AI receptionist is turned off.");
      return;
    }

    const form = new FormData();
    form.set("sdp", new Blob([req.body], { type: "application/sdp" }), "offer.sdp");
    form.set(
      "session",
      new Blob(
        [
          JSON.stringify({
            ...callAcceptPayload(business, settings),
            type: "realtime"
          })
        ],
        { type: "application/json" }
      )
    );

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const answer = await response.text();
    if (!response.ok) {
      res.status(response.status).send(answer);
      return;
    }

    res.type("application/sdp").send(answer);
  } catch (error) {
    next(error);
  }
});

async function handleSipWebhook(req, res, next) {
  try {
    console.log(`OpenAI webhook HTTP hit: ${req.method} ${req.originalUrl || req.url}`);
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).send("OPENAI_API_KEY is required for SIP webhooks.");
      return;
    }

    if (!process.env.OPENAI_WEBHOOK_SECRET) {
      res.status(500).send("OPENAI_WEBHOOK_SECRET is required for SIP webhooks.");
      return;
    }

    const event = await openAIClient().webhooks.unwrap(
      req.body.toString("utf8"),
      req.headers,
      process.env.OPENAI_WEBHOOK_SECRET
    );

    if (event.type === "realtime.call.incoming") {
      const callId = event.data?.call_id;
      console.log(`Incoming realtime SIP webhook received: ${callId || "missing call_id"}`);
      const business = await loadBusiness();
      const settings = await loadReceptionistSettings();
      const callSettings = isGoogleVoiceVerificationCall(event)
        ? { ...settings, verificationMode: true }
        : settings;
      await saveCallEvent(event);
      if (!settings.enabled) {
        console.warn("AI receptionist is off. Incoming call was logged but not accepted.");
        res.sendStatus(200);
        return;
      }

      if (!callId) {
        console.warn("Received realtime.call.incoming webhook without a call_id.");
        res.sendStatus(200);
        return;
      }
      try {
        await openAIClient().realtime.calls.accept(callId, callAcceptPayload(business, callSettings));
        console.log(`Accepted realtime SIP call ${callId}`);
        monitorRealtimeCall(callId, callSettings);
      } catch (acceptError) {
        console.error(`Failed to accept realtime call ${callId}: ${acceptError.message}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
}

app.post("/openai/sip-webhook", express.raw({ type: "*/*" }), handleSipWebhook);
app.post("/api/openai/sip-webhook", express.raw({ type: "*/*" }), handleSipWebhook);

function isGoogleVoiceVerificationCall(event) {
  const headers = event.data?.sip_headers || [];
  const headerText = headers.map((header) => `${header.name || ""}: ${header.value || ""}`).join("\n");
  return /\+12024558888\b/.test(headerText);
}

function hasTwilioSmsAccess(req) {
  const secret = process.env.TWILIO_SMS_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.query.secret === secret || req.get("x-twilio-sms-secret") === secret;
}

function hasSmsReadAccess(req) {
  return hasTwilioSmsAccess(req) || hasAdminAccess(req);
}

function hasAdminAccess(req) {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return process.env.ALLOW_UNPROTECTED_ADMIN === "true";
  return req.get("x-admin-pin") === pin || req.query.adminPin === pin;
}

async function sendTwilioSms(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = normalizeE164(process.env.TWILIO_SMS_FROM || process.env.GOOGLE_VOICE_NUMBER);
  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      skipped: true,
      reason: "Twilio SMS sending is not configured yet."
    };
  }

  const body = new URLSearchParams({
    From: from,
    To: to,
    Body: message
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(async () => ({
    message: await response.text().catch(() => "Twilio returned an unreadable response.")
  }));
  if (!response.ok) {
    return {
      ok: false,
      status: payload.status || response.status,
      error: payload.message || "Twilio SMS failed.",
      code: payload.code
    };
  }
  return {
    ok: true,
    sid: payload.sid,
    status: payload.status,
    to: payload.to,
    from: payload.from
  };
}

function normalizeE164(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

app.use(express.static(new URL("../web", import.meta.url).pathname));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: error.message });
});

app.listen(port, () => {
  console.log(`AI receptionist listening on http://localhost:${port}`);
});

function bookingPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Book With DDD</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f5f7fb; color: #18202f; }
      main { width: min(720px, calc(100vw - 32px)); margin: 40px auto; }
      section { background: #fff; border: 1px solid #d8dee9; border-radius: 8px; padding: 24px; box-shadow: 0 10px 30px rgba(24, 32, 47, 0.08); }
      .eyebrow { margin: 0 0 8px; color: #4f46e5; font-size: 13px; font-weight: 700; text-transform: uppercase; }
      h1 { margin: 0 0 8px; font-size: clamp(28px, 6vw, 42px); line-height: 1.05; }
      .summary { margin: 0 0 24px; color: #4a5568; }
      form { display: grid; gap: 14px; }
      label { display: grid; gap: 6px; font-weight: 700; }
      input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font: inherit; }
      button { border: 0; border-radius: 6px; padding: 12px 16px; background: #111827; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
      #bookingStatus { min-height: 24px; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p class="eyebrow">DDD booking</p>
        <h1>Request a Booking</h1>
        <p class="summary">Send DDD your details and preferred time. A team member will confirm the appointment.</p>
        <form id="bookingForm">
          <label>Name <input name="name" autocomplete="name" required /></label>
          <label>Phone <input name="phone" autocomplete="tel" required /></label>
          <label>Email <input name="email" autocomplete="email" /></label>
          <label>Preferred date/time <input name="preferredTime" autocomplete="off" required /></label>
          <label>What do you need? <textarea name="reason" rows="4" required></textarea></label>
          <button type="submit">Request booking</button>
        </form>
        <p id="bookingStatus"></p>
      </section>
    </main>
    <script>
      const form = document.querySelector("#bookingForm");
      const statusEl = document.querySelector("#bookingStatus");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        statusEl.textContent = "Sending...";
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          form.reset();
          statusEl.textContent = "Thanks. DDD received your booking request.";
        } else {
          statusEl.textContent = "Something went wrong. Please call or text DDD.";
        }
      });
    </script>
  </body>
</html>`;
}
