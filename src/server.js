import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import {
  callAcceptPayload,
  listCalls,
  listConversations,
  listSms,
  listBookings,
  listBookingsByPhone,
  listCallLog,
  listLeads,
  listSummaries,
  loadReceptionistSettings,
  loadBusiness,
  getStorageInfo,
  getBookingStatus,
  updateBookingLocation,
  buildDryRun,
  buildBusinessInsights,
  normalizeVoice,
  saveCallEvent,
  saveIncomingSms,
  saveOutgoingSms,
  saveBookingRequest,
  saveLead,
  saveReceptionistSettings,
  normalizeStaffAccessCodes,
  parseStaffAccessCodes
} from "./receptionist.js";
import { monitorRealtimeCall } from "./realtime-tools.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const presence = new Map();

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
    persistentStorage: getStorageInfo().persistent,
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
    const settings = await loadReceptionistSettings();
    if (hasAdminAccess(_req)) {
      res.json(settings);
      return;
    }
    const { staffAccessCodes: _staffAccessCodes, ...publicSettings } = settings;
    res.json(publicSettings);
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
    const staff = await getStaffAccess(req);
    if (!staff.ok) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const teamInfo = await getVisibleTeamInfo(req);
    res.json({
      staff,
      team: teamInfo.team,
      teamSource: teamInfo.source,
      presence: listPresence(),
      conversations: await listConversations(limit)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/presence", async (req, res, next) => {
  try {
    const staff = await getStaffAccess(req);
    if (!staff.ok) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    const teamInfo = await getVisibleTeamInfo(req);
    res.json({ staff, team: teamInfo.team, teamSource: teamInfo.source, presence: listPresence() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/presence", express.json(), async (req, res, next) => {
  try {
    const staff = await getStaffAccess(req);
    if (!staff.ok) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    const now = Date.now();
    const key = `${staff.role}:${staff.name}`;
    presence.set(key, {
      id: key,
      name: staff.name,
      role: staff.role,
      online: true,
      status: normalizePresenceStatus(req.body?.status),
      typingTo: normalizeE164(req.body?.typingTo || ""),
      viewing: normalizeE164(req.body?.viewing || ""),
      updatedAt: new Date(now).toISOString(),
      expiresAt: now + 45000
    });
    res.json({ ok: true, staff, presence: listPresence() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sms/reply", express.json(), async (req, res, next) => {
  try {
    const staff = await getStaffAccess(req);
    if (!staff.ok) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    const to = normalizeE164(req.body?.to);
    const message = String(req.body?.message || "").replace(/\s+/g, " ").trim();
    const agentName = String(staff.name || req.body?.agentName || "DDD team")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
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
    res.status(delivery.ok ? 201 : 502).json({ ok: delivery.ok, delivery, staff, sms: record });
  } catch (error) {
    next(error);
  }
});

app.post("/api/calls/outbound", express.json(), async (req, res, next) => {
  try {
    const staff = await getStaffAccess(req);
    if (!staff.ok) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    const customerPhone = normalizeE164(req.body?.to || req.body?.customerPhone);
    const staffPhone = normalizeE164(req.body?.staffPhone || req.body?.from);
    if (!customerPhone) {
      res.status(400).json({ ok: false, error: "Enter a valid customer phone number." });
      return;
    }
    if (!staffPhone) {
      res.status(400).json({ ok: false, error: "Enter your phone number so DDD can connect the outbound call." });
      return;
    }

    const delivery = await startTwilioBridgeCall(staffPhone, customerPhone);
    await saveCallEvent({
      type: "twilio.outbound.call",
      call_id: delivery.sid || "",
      caller: staffPhone,
      status: delivery.ok ? "initiated" : "failed",
      details: {
        staff: staff.name,
        staffRole: staff.role,
        customerPhone,
        from: delivery.from || process.env.TWILIO_VOICE_FROM || process.env.TWILIO_SMS_FROM || process.env.AI_FORWARDING_NUMBER || ""
      }
    });
    res.status(delivery.ok ? 201 : 502).json({ ok: delivery.ok, delivery, staff });
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

app.get("/api/twilio/voice", async (req, res, next) => {
  handleTwilioVoice(req, res, next);
});

app.post("/api/twilio/voice", express.urlencoded({ extended: false }), async (req, res, next) => {
  handleTwilioVoice(req, res, next);
});

app.post("/api/twilio/outbound-bridge", express.urlencoded({ extended: false }), async (req, res) => {
  if (!hasTwilioSmsAccess(req)) {
    res.status(403).send("Forbidden");
    return;
  }

  const to = normalizeE164(req.query.to || req.body?.to);
  const from = normalizeE164(process.env.TWILIO_VOICE_FROM || process.env.TWILIO_SMS_FROM || process.env.AI_FORWARDING_NUMBER || process.env.GOOGLE_VOICE_NUMBER);
  if (!to || !from) {
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>DDD could not connect this outbound call.</Say></Response>`);
    return;
  }

  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your DDD call now.</Say>
  <Dial callerId="${escapeXml(from)}">${escapeXml(to)}</Dial>
</Response>`);
});

async function handleTwilioVoice(req, res, next) {
  try {
    if (!hasTwilioSmsAccess(req)) {
      res.status(403).send("Forbidden");
      return;
    }

    const sipUri = normalizeSipUri(process.env.TRANSFER_SIP_URI || process.env.OPENAI_SIP_URI || "");
    const secret = encodeURIComponent(req.query.secret || "");
    const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
    const statusCallback = publicBaseUrl
      ? `${publicBaseUrl}/api/twilio/call-status?secret=${secret}`
      : `/api/twilio/call-status?secret=${secret}`;
    const recordingCallback = publicBaseUrl
      ? `${publicBaseUrl}/api/twilio/recording?secret=${secret}`
      : `/api/twilio/recording?secret=${secret}`;

    await saveCallEvent({
      type: "twilio.voice.incoming",
      data: {
        call_id: req.body?.CallSid || req.query?.CallSid || "",
        status: sipUri ? "routing-to-sip" : "missing-sip-uri",
        sip_headers: [
          { name: "from", value: req.body?.From || req.query?.From || "" },
          { name: "to", value: req.body?.To || req.query?.To || "" }
        ]
      }
    });

    if (!sipUri) {
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">DDD AI Dispatch is not fully connected yet. Please try again shortly.</Say>
  <Hangup/>
</Response>`);
      return;
    }

    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" answerOnBridge="true" record="record-from-answer" recordingStatusCallback="${xmlEscape(recordingCallback)}" recordingStatusCallbackMethod="POST">
    <Sip statusCallback="${xmlEscape(statusCallback)}" statusCallbackMethod="POST">${xmlEscape(sipUri)}</Sip>
  </Dial>
</Response>`);
  } catch (error) {
    next(error);
  }
}

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

app.post("/api/twilio/recording", express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    if (!hasTwilioSmsAccess(req)) {
      res.status(403).send("Forbidden");
      return;
    }
    await saveCallEvent({
      type: "twilio.recording.completed",
      data: {
        call_id: req.body.CallSid || req.body.callSid || "",
        status: req.body.RecordingStatus || req.body.recordingStatus || "",
        recording_url: req.body.RecordingUrl || req.body.recordingUrl || "",
        sip_headers: [
          { name: "from", value: req.body.From || "" },
          { name: "to", value: req.body.To || "" }
        ]
      }
    });
    res.type("text/xml").send("<Response></Response>");
  } catch (error) {
    next(error);
  }
});

app.post("/api/twilio/call-status", express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    if (!hasTwilioSmsAccess(req)) {
      res.status(403).send("Forbidden");
      return;
    }
    const status = req.body.CallStatus || req.body.callStatus || "";
    await saveCallEvent({
      type: "twilio.call.status",
      data: {
        call_id: req.body.CallSid || req.body.callSid || "",
        status,
        durationSeconds: req.body.CallDuration || req.body.callDuration || 0,
        sip_headers: [
          { name: "from", value: req.body.From || "" },
          { name: "to", value: req.body.To || "" }
        ]
      }
    });
    res.type("text/xml").send("<Response></Response>");
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
    const input = String(req.body?.text || settings.greeting || "Thank you for calling Triple D Roadside. How can I help today?")
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
    const input = String(req.query.text || settings.greeting || "Thank you for calling Triple D Roadside. How can I help today?")
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
    const settings = await loadSettingsWithInsights();
    res.json(buildDryRun(settings, req.body?.callerMessage || ""));
  } catch (error) {
    next(error);
  }
});

app.get("/api/qa-dashboard", async (req, res, next) => {
  try {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    const [settings, callLog, leads, bookings, sms] = await Promise.all([
      loadReceptionistSettings(),
      listCallLog(200),
      listLeads(200),
      listBookings(200),
      listSms(200)
    ]);
    const teamInfo = await getVisibleTeamInfo(req);
    const recentCalls = callLog.slice(0, 25);
    const missedStatuses = new Set(["busy", "no-answer", "failed", "canceled", "cancelled", "missed"]);
    const missedCalls = recentCalls.filter((call) => missedStatuses.has(String(call.status || "").toLowerCase()));
    const callsWithIntake = recentCalls.filter((call) => (call.leads?.length || 0) + (call.bookings?.length || 0) > 0);
    const callsWithRecordings = recentCalls.filter((call) => call.recordingUrl);
    const callsWithTranscripts = recentCalls.filter((call) => call.transcriptText);
    const bookingSyncFailures = bookings.filter((booking) => booking.externalSync && !booking.externalSync.ok && !booking.externalSync.skipped);
    const smsFailures = sms.filter((message) => String(message.status || "").toLowerCase() === "failed");

    const checks = [
      qaCheck("AI answering", settings.enabled, settings.enabled ? "AI is on." : "AI is paused."),
      qaCheck("Persistent storage", getStorageInfo().persistent, getStorageInfo().persistent ? "Settings/logs are on persistent storage." : "Render disk is not active yet."),
      qaCheck("Recent calls captured", recentCalls.length > 0, recentCalls.length ? `${recentCalls.length} recent calls found.` : "No forwarded calls logged yet."),
      qaCheck("Intake saved", !recentCalls.length || callsWithIntake.length > 0, callsWithIntake.length ? `${callsWithIntake.length} recent calls have leads/bookings.` : "No recent calls have saved intake yet."),
      qaCheck("Missed-call visibility", missedCalls.length === 0, missedCalls.length ? `${missedCalls.length} recent calls show missed/busy/failure states.` : "No missed/busy calls in recent log."),
      qaCheck("Recording hook", !recentCalls.length || callsWithRecordings.length > 0, callsWithRecordings.length ? `${callsWithRecordings.length} recent calls have recording links.` : "No recording links stored yet."),
      qaCheck("Transcript capture", !recentCalls.length || callsWithTranscripts.length > 0, callsWithTranscripts.length ? `${callsWithTranscripts.length} recent calls have transcripts.` : "No transcripts stored yet."),
      qaCheck("Booking sync", bookingSyncFailures.length === 0, bookingSyncFailures.length ? `${bookingSyncFailures.length} booking sync failures need review.` : "No booking sync failures found."),
      qaCheck("SMS delivery", smsFailures.length === 0, smsFailures.length ? `${smsFailures.length} failed texts found.` : "No failed texts found."),
      qaCheck(
        "DDD team sync",
        teamInfo.source !== "unconfigured" && teamInfo.team.length > 0,
        teamInfo.source === "ddd-platform"
          ? `${teamInfo.team.length} team members loaded from DDD platform.`
          : teamInfo.source === "manual"
            ? `${teamInfo.team.length} manual/fallback team members loaded.`
            : "DDD platform team sync is not configured yet."
      )
    ];

    res.json({
      ok: checks.every((check) => check.ok),
      generatedAt: new Date().toISOString(),
      counts: {
        recentCalls: recentCalls.length,
        leads: leads.length,
        bookings: bookings.length,
        missedCalls: missedCalls.length,
        sms: sms.length
      },
      checks,
      qaChecklist: settings.qaChecklist,
      fallbackRules: settings.fallbackRules,
      recentIssues: [
        ...missedCalls.slice(0, 5).map((call) => ({
          type: "missed-call",
          message: `${call.caller || "Unknown caller"} ended as ${call.status || "missed"}.`,
          at: call.startedAt || call.createdAt || ""
        })),
        ...bookingSyncFailures.slice(0, 5).map((booking) => ({
          type: "booking-sync",
          message: `${booking.name || booking.phone || "Booking"} did not sync: ${booking.externalSync?.error || booking.externalSync?.reason || "unknown error"}.`,
          at: booking.createdAt || ""
        })),
        ...smsFailures.slice(0, 5).map((message) => ({
          type: "sms",
          message: `Text to ${message.to || "customer"} failed.`,
          at: message.createdAt || ""
        }))
      ]
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/insights", async (req, res, next) => {
  try {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    res.json(await buildBusinessInsights());
  } catch (error) {
    next(error);
  }
});

function qaCheck(label, ok, detail) {
  return { label, ok: Boolean(ok), detail };
}

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

app.get("/api/customer/bookings", async (req, res, next) => {
  try {
    if (!hasCustomerLookupAccess(req) && !hasAdminAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    res.json({ bookings: await listBookingsByPhone(req.query.phone || "", Number(req.query.limit || 20)) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bookings/:bookingId/status", async (req, res, next) => {
  try {
    const booking = await getBookingStatus(req.params.bookingId, req.query.token || "");
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found." });
      return;
    }
    res.json({
      ok: true,
      booking: {
        bookingId: booking.bookingId,
        status: booking.status,
        serviceType: booking.serviceType,
        preferredTime: booking.preferredTime,
        location: booking.location,
        latitude: booking.latitude,
        longitude: booking.longitude,
        locationConfirmedAt: booking.locationConfirmedAt,
        confidence: booking.confidence,
        customerLocationUrl: booking.customerLocationUrl,
        vehicle: booking.vehicle,
        createdAt: booking.createdAt,
        customerStatusUrl: booking.customerStatusUrl,
        externalSync: booking.externalSync
          ? {
              ok: booking.externalSync.ok,
              jobId: booking.externalSync.jobId,
              trackingUrl: booking.externalSync.trackingUrl,
              message: booking.externalSync.message
            }
          : undefined
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bookings/:bookingId/confirm-location", async (req, res, next) => {
  try {
    const booking = await getBookingStatus(req.params.bookingId, req.query.token || "");
    if (!booking) {
      res.status(404).type("html").send("<h1>Booking not found</h1><p>Please text or call DDD.</p>");
      return;
    }
    res.type("html").send(locationPage(booking));
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings/:bookingId/location", express.json(), async (req, res, next) => {
  try {
    const booking = await updateBookingLocation(req.params.bookingId, req.query.token || req.body?.token || "", req.body || {});
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found." });
      return;
    }
    res.json({
      ok: true,
      booking: {
        bookingId: booking.bookingId,
        location: booking.location,
        latitude: booking.latitude,
        longitude: booking.longitude,
        locationConfirmedAt: booking.locationConfirmedAt,
        confidence: booking.confidence
      }
    });
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

app.get("/api/call-log", async (req, res, next) => {
  try {
    if (!hasAdminAccess(req)) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }
    res.json({ calls: await listCallLog(Number(req.query.limit || 50)) });
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
    const settings = await loadSettingsWithInsights();
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

async function loadSettingsWithInsights() {
  const settings = await loadReceptionistSettings();
  if (settings.insightLearning?.enabled === false) return settings;
  try {
    return { ...settings, insightSnapshot: await buildBusinessInsights() };
  } catch (error) {
    console.warn(`Could not build insight learning snapshot: ${error.message}`);
    return settings;
  }
}

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
      const settings = await loadSettingsWithInsights();
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

function normalizeSipUri(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("sip:") ? trimmed : `sip:${trimmed}`;
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hasSmsReadAccess(req) {
  return hasTwilioSmsAccess(req) || hasAdminAccess(req);
}

function hasAdminAccess(req) {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return process.env.ALLOW_UNPROTECTED_ADMIN === "true";
  return req.get("x-admin-pin") === pin || req.query.adminPin === pin;
}

async function getStaffAccess(req) {
  const submittedCode = String(req.get("x-staff-code") || req.get("x-admin-pin") || req.query.staffCode || req.query.adminPin || "")
    .trim();
  const adminPin = String(process.env.ADMIN_PIN || "").trim();
  if (!submittedCode) {
    return { ok: false };
  }
  if (adminPin && submittedCode === adminPin) {
    return { ok: true, name: process.env.ADMIN_STAFF_NAME || "Brianna", role: "admin" };
  }

  const staffCodes = await getStaffDirectoryForAuth();
  const staff = staffCodes.find((entry) => entry.code === submittedCode);
  if (!staff) {
    return { ok: false };
  }
  return { ok: true, name: staff.name, role: "staff" };
}

async function getVisibleTeamInfo(req) {
  const admin = hasAdminAccess(req);
  const adminPin = String(process.env.ADMIN_PIN || "").trim();
  const directory = await getStaffDirectory();
  const team = [
    ...(adminPin ? [{ name: process.env.ADMIN_STAFF_NAME || "Brianna", code: adminPin, role: "admin" }] : []),
    ...directory.team
  ];
  return {
    source: directory.source,
    team: dedupeTeam(team).map((entry) => ({
      id: entry.id || "",
      name: entry.name,
      phone: admin ? entry.phone || "" : maskPhone(entry.phone || ""),
      role: entry.role,
      active: entry.active !== false,
      code: admin ? entry.code || "" : maskAccessCode(entry.code || "")
    }))
  };
}

async function getStaffDirectoryForAuth() {
  const directory = await getStaffDirectory();
  return directory.team.filter((entry) => entry.code);
}

async function getStaffDirectory() {
  const settings = await loadReceptionistSettings();
  const manualCodes = normalizeStaffAccessCodes(settings.staffAccessCodes?.length ? settings.staffAccessCodes : parseStaffAccessCodes(process.env.STAFF_ACCESS_CODES || ""))
    .map((entry) => ({ ...entry, role: "staff", active: true, source: "manual" }));
  const platformTeam = await fetchDddPlatformTeam();
  const team = dedupeTeam([...platformTeam.team, ...manualCodes]);
  if (platformTeam.team.length) return { source: "ddd-platform", team };
  if (manualCodes.length) return { source: "manual", team };
  return { source: platformTeam.configured ? "ddd-platform-empty" : "unconfigured", team };
}

async function fetchDddPlatformTeam() {
  const url = String(process.env.DDD_TECH_TEAM_URL || "").trim();
  if (!url) return { configured: false, team: [] };
  const headers = { Accept: "application/json" };
  const secret = String(process.env.DDD_TECH_TEAM_SECRET || "").trim();
  if (secret) headers["x-ddd-ai-secret"] = secret;

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      console.warn(`DDD team sync failed: ${response.status}`);
      return { configured: true, team: [] };
    }
    const payload = await response.json();
    const records = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.technicians)
        ? payload.technicians
        : Array.isArray(payload.team)
          ? payload.team
          : Array.isArray(payload.data)
            ? payload.data
            : [];
    return {
      configured: true,
      team: records.map(normalizePlatformTeamMember).filter((entry) => entry.name)
    };
  } catch (error) {
    console.warn(`DDD team sync failed: ${error.message}`);
    return { configured: true, team: [] };
  }
}

function normalizePlatformTeamMember(member = {}) {
  const code = String(
    member.inbox_code ||
      member.dispatch_code ||
      member.staff_code ||
      member.access_code ||
      member.pin ||
      member.code ||
      ""
  )
    .replace(/\s+/g, "")
    .slice(0, 32);
  return {
    id: String(member.id || member.user_id || member.uuid || ""),
    name: String(member.name || member.full_name || member.display_name || member.email || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
    phone: normalizeE164(member.phone || member.mobile_phone || member.phone_number || ""),
    code,
    role: String(member.role || member.type || "tech")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40),
    active: member.active !== false && member.disabled !== true,
    source: "ddd-platform"
  };
}

function dedupeTeam(team) {
  const seen = new Set();
  return team.filter((entry) => {
    const key = entry.code ? `code:${entry.code}` : entry.id ? `id:${entry.id}` : `name:${String(entry.name).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return entry.active !== false;
  });
}

function maskPhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `***-${digits.slice(-4)}`;
}

function listPresence() {
  const now = Date.now();
  for (const [key, value] of presence.entries()) {
    if (value.expiresAt <= now) presence.delete(key);
  }
  return [...presence.values()]
    .map(({ expiresAt: _expiresAt, ...value }) => value)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function maskAccessCode(code = "") {
  const value = String(code);
  if (value.length <= 2) return "*".repeat(value.length || 1);
  return `${"*".repeat(Math.max(2, value.length - 2))}${value.slice(-2)}`;
}

function normalizePresenceStatus(status) {
  const value = String(status || "").trim().toLowerCase().replace(/\s+/g, "-");
  return ["available", "busy", "on-call", "active-call"].includes(value) ? value : "available";
}

function hasCustomerLookupAccess(req) {
  const secret = process.env.CUSTOMER_LOOKUP_SECRET;
  if (!secret) return false;
  return req.get("x-customer-lookup-secret") === secret || req.query.secret === secret;
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

async function startTwilioBridgeCall(staffPhone, customerPhone) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = normalizeE164(process.env.TWILIO_VOICE_FROM || process.env.TWILIO_SMS_FROM || process.env.AI_FORWARDING_NUMBER || process.env.GOOGLE_VOICE_NUMBER);
  const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const secret = process.env.TWILIO_SMS_WEBHOOK_SECRET || "";
  if (!accountSid || !authToken || !from || !publicBaseUrl || !secret) {
    return {
      ok: false,
      skipped: true,
      reason: "Twilio outbound calling is not fully configured yet."
    };
  }

  const bridgeUrl = `${publicBaseUrl}/api/twilio/outbound-bridge?secret=${encodeURIComponent(secret)}&to=${encodeURIComponent(customerPhone)}`;
  const body = new URLSearchParams({
    From: from,
    To: staffPhone,
    Url: bridgeUrl,
    Method: "POST"
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
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
      error: payload.message || "Twilio outbound call failed.",
      code: payload.code
    };
  }
  return {
    ok: true,
    sid: payload.sid,
    status: payload.status,
    to: payload.to,
    from: payload.from,
    customerPhone
  };
}

function normalizeE164(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.use(express.static(new URL("../web", import.meta.url).pathname));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: error.message });
});

app.listen(port, () => {
  console.log(`AI receptionist listening on http://localhost:${port}`);
});

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function locationPage(booking) {
  const token = escapeHtml(booking.statusToken || "");
  const bookingId = escapeHtml(booking.bookingId || "");
  const currentLocation = escapeHtml(booking.location || "");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirm DDD Location</title>
    <style>
      :root { font-family: Arial, sans-serif; color: #171827; }
      body { margin: 0; min-height: 100vh; background: linear-gradient(135deg, #fff7fb, #f5fffb 46%, #f7f4ff); }
      main { width: min(680px, calc(100vw - 28px)); margin: 28px auto; }
      section { overflow: hidden; border: 1px solid rgba(118, 87, 255, .24); border-radius: 10px; background: rgba(255,255,255,.92); box-shadow: 0 18px 46px rgba(35, 38, 69, .12); }
      section::before { content: ""; display: block; height: 7px; background: linear-gradient(90deg, #ff3ea5, #ff7a3d, #ffc83d, #23c779, #16b8ff, #7657ff); }
      .wrap { display: grid; gap: 14px; padding: 22px; }
      .eyebrow { margin: 0; color: #a81586; font-size: 12px; font-weight: 800; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(28px, 8vw, 44px); line-height: 1.04; }
      p { margin: 0; color: #5f6477; line-height: 1.45; }
      label { display: grid; gap: 7px; font-weight: 800; }
      input { width: 100%; box-sizing: border-box; border: 1px solid #d9d3ee; border-radius: 8px; padding: 13px; font: inherit; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      button { min-height: 46px; border: 0; border-radius: 8px; padding: 0 14px; background: linear-gradient(90deg, #7657ff, #ff3ea5, #ff7a3d); color: white; font: inherit; font-weight: 900; cursor: pointer; }
      button.secondary { border: 1px solid rgba(118,87,255,.28); background: white; color: #34364d; }
      #status { min-height: 24px; font-weight: 800; color: #12824d; }
      @media (max-width: 560px) { .row { grid-template-columns: 1fr; } main { margin: 14px auto; } .wrap { padding: 16px; } }
    </style>
  </head>
  <body>
    <main>
      <section>
        <div class="wrap">
          <p class="eyebrow">DDD location</p>
          <h1>Confirm your service location</h1>
          <p>This helps DDD dispatch to the right spot. You can type the address/cross street or share your phone location.</p>
          <label>
            Address or nearest cross street
            <input id="locationInput" autocomplete="street-address" value="${currentLocation}" placeholder="Address, business name, or nearest cross street" />
          </label>
          <div class="row">
            <button id="useLocationButton" type="button" class="secondary">Use my current location</button>
            <button id="saveButton" type="button">Save location</button>
          </div>
          <p id="status"></p>
        </div>
      </section>
    </main>
    <script>
      const bookingId = ${JSON.stringify(booking.bookingId || "")};
      const token = ${JSON.stringify(booking.statusToken || "")};
      const input = document.querySelector("#locationInput");
      const status = document.querySelector("#status");
      const saveButton = document.querySelector("#saveButton");
      let coords = {};
      document.querySelector("#useLocationButton").addEventListener("click", () => {
        if (!navigator.geolocation) {
          status.textContent = "Location sharing is not available on this browser. Type your address instead.";
          return;
        }
        status.textContent = "Getting your location...";
        navigator.geolocation.getCurrentPosition((position) => {
          coords = {
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude),
            source: "browser_geolocation"
          };
          input.value = input.value || "Live location shared from phone";
          status.textContent = "Location captured. Tap Save location.";
        }, () => {
          status.textContent = "Could not access location. Type your address or cross street instead.";
        }, { enableHighAccuracy: true, timeout: 10000 });
      });
      saveButton.addEventListener("click", async () => {
        status.textContent = "Saving...";
        const response = await fetch("/api/bookings/" + encodeURIComponent(bookingId) + "/location?token=" + encodeURIComponent(token), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location: input.value, ...coords })
        });
        status.textContent = response.ok ? "Saved. DDD has your location." : "Could not save. Please text or call DDD.";
      });
    </script>
  </body>
</html>`;
}

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
