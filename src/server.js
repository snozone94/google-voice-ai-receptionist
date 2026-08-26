import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import {
  buildReceptionistInstructions,
  callAcceptPayload,
  listCalls,
  listBookings,
  listLeads,
  listSummaries,
  loadBusiness,
  receptionistTools,
  saveCallEvent,
  saveBookingRequest,
  saveLead
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

app.use(express.static(new URL("../web", import.meta.url).pathname));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/setup-status", (_req, res) => {
  const required = {
    openAIKey: Boolean(process.env.OPENAI_API_KEY),
    publicBaseUrl: Boolean(process.env.PUBLIC_BASE_URL && !process.env.PUBLIC_BASE_URL.includes("your-domain")),
    webhookSecret: Boolean(process.env.OPENAI_WEBHOOK_SECRET),
    googleVoiceNumber: Boolean(process.env.GOOGLE_VOICE_NUMBER),
    aiForwardingNumber: Boolean(process.env.AI_FORWARDING_NUMBER)
  };

  res.json({
    ok: Object.values(required).every(Boolean),
    required,
    googleVoiceNumber: process.env.GOOGLE_VOICE_NUMBER || "",
    aiForwardingNumber: process.env.AI_FORWARDING_NUMBER || "",
    webhookUrl:
      process.env.PUBLIC_BASE_URL && !process.env.PUBLIC_BASE_URL.includes("your-domain")
        ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/openai/sip-webhook`
        : ""
  });
});

app.get("/api/business", async (_req, res, next) => {
  try {
    const business = await loadBusiness();
    res.json({
      ...business,
      googleVoiceNumber: process.env.GOOGLE_VOICE_NUMBER || "",
      aiForwardingNumber: process.env.AI_FORWARDING_NUMBER || ""
    });
  } catch (error) {
    next(error);
  }
});

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
    const form = new FormData();
    form.set("sdp", new Blob([req.body], { type: "application/sdp" }), "offer.sdp");
    form.set(
      "session",
      new Blob(
        [
          JSON.stringify({
            type: "realtime",
            model: "gpt-realtime",
            instructions: buildReceptionistInstructions(business),
            tools: receptionistTools(),
            tool_choice: "auto",
            audio: {
              output: {
                voice: "marin"
              }
            }
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

app.post("/openai/sip-webhook", express.raw({ type: "*/*" }), async (req, res, next) => {
  try {
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
      const callId = event.data.call_id;
      const business = await loadBusiness();
      await saveCallEvent(event);
      await openAIClient().realtime.calls.accept(callId, callAcceptPayload(business));
      monitorRealtimeCall(callId);
    }

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: error.message });
});

app.listen(port, () => {
  console.log(`AI receptionist listening on http://localhost:${port}`);
});
