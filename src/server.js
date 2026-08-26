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
    aiForwardingNumber: Boolean(process.env.AI_FORWARDING_NUMBER)
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

async function handleSipWebhook(req, res, next) {
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
      const callId = event.data?.call_id;
      const business = await loadBusiness();
      await saveCallEvent(event);
      if (!callId) {
        console.warn("Received realtime.call.incoming webhook without a call_id.");
        res.sendStatus(200);
        return;
      }
      try {
        await openAIClient().realtime.calls.accept(callId, callAcceptPayload(business));
        monitorRealtimeCall(callId);
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
