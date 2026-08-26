import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const businessPath = path.join(root, "config", "business.json");
const leadsPath = path.join(root, "data", "leads.jsonl");
const callsPath = path.join(root, "data", "calls.jsonl");
const summariesPath = path.join(root, "data", "summaries.jsonl");
const bookingsPath = path.join(root, "data", "bookings.jsonl");
const settingsPath = path.join(root, "data", "settings.json");
const dataDir = path.join(root, "data");

export const voiceOptions = [
  { id: "marin", label: "Marin", note: "Recommended, polished and natural" },
  { id: "cedar", label: "Cedar", note: "Recommended, calm and steady" },
  { id: "alloy", label: "Alloy", note: "Balanced and neutral" },
  { id: "ash", label: "Ash", note: "Clear and confident" },
  { id: "ballad", label: "Ballad", note: "Warm and expressive" },
  { id: "coral", label: "Coral", note: "Bright and friendly" },
  { id: "echo", label: "Echo", note: "Crisp and direct" },
  { id: "sage", label: "Sage", note: "Measured and professional" },
  { id: "shimmer", label: "Shimmer", note: "Upbeat and light" },
  { id: "verse", label: "Verse", note: "Smooth and conversational" }
];

const supportedVoiceIds = new Set(voiceOptions.map((voice) => voice.id));
const defaultGreeting = "Thank you for calling DDD, this is the receptionist. How can I help today?";
const defaultCustomInstructions =
  "Act like a polished front desk receptionist. Be warm, concise, collect the caller's details, and help them book or leave a clear message.";
const defaultBusinessKnowledge =
  "DDD helps callers with booking requests, service questions, and messages for the team. If pricing, exact availability, or service-area details are unknown, collect the caller's details and say the team will confirm.";
const defaultCallerFlows = {
  newClients:
    "Qualify the service needed, collect name, callback number, location, urgency, and preferred time. End by saving a lead or booking request and sharing the booking link.",
  existingClients:
    "Collect name, callback number, existing appointment or job details, and what they need changed or answered. Save a clear message for follow-up.",
  sales:
    "Collect company/name, callback number, email, what they are offering, and whether it sounds useful. Do not commit DDD to buying anything.",
  otherCallers:
    "Collect who they are, callback number, reason for calling, and the best next step. Keep it brief and professional."
};
const defaultQualifyingServices = ["Roadside assistance", "Maintenance/repair", "Existing appointment"];
const defaultSoundPreferences = {
  ambientSound: "none",
  thinkingSound: true
};

export async function loadBusiness() {
  const raw = await fs.readFile(businessPath, "utf8");
  return JSON.parse(raw);
}

export async function loadReceptionistSettings() {
  const envVoice = normalizeVoice(process.env.RECEPTIONIST_VOICE);
  try {
    const raw = await fs.readFile(settingsPath, "utf8");
    const settings = JSON.parse(raw);
    return normalizeSettings({ ...settings, voice: normalizeVoice(settings.voice) || envVoice || "marin" });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return normalizeSettings({ voice: envVoice || "marin" });
  }
}

export async function saveReceptionistSettings(settings) {
  const current = await loadReceptionistSettings();
  const next = normalizeSettings({ ...current, ...settings });
  if (settings.voice !== undefined && !normalizeVoice(settings.voice)) {
    throw new Error(`Unsupported voice "${settings.voice}".`);
  }

  await ensureDataDir();
  await fs.writeFile(
    settingsPath,
    `${JSON.stringify(
      {
        enabled: next.enabled,
        voice: next.voice,
        greeting: next.greeting,
        customInstructions: next.customInstructions,
        businessKnowledge: next.businessKnowledge,
        callerFlows: next.callerFlows,
        qualifyingServices: next.qualifyingServices,
        outOfScopeHandling: next.outOfScopeHandling,
        followUpStyle: next.followUpStyle,
        soundPreferences: next.soundPreferences
      },
      null,
      2
    )}\n`
  );
  return loadReceptionistSettings();
}

export async function saveLead(lead) {
  const record = {
    createdAt: new Date().toISOString(),
    ...lead
  };
  await ensureDataDir();
  await fs.appendFile(leadsPath, `${JSON.stringify(record)}\n`);
  await postOptionalWebhook(process.env.LEAD_WEBHOOK_URL, record);
  return record;
}

export async function saveCallSummary(summary) {
  const record = {
    createdAt: new Date().toISOString(),
    ...summary
  };
  await ensureDataDir();
  await fs.appendFile(summariesPath, `${JSON.stringify(record)}\n`);
  await postOptionalWebhook(process.env.CALL_SUMMARY_WEBHOOK_URL, record);
  return record;
}

export async function saveBookingRequest(booking) {
  const record = {
    createdAt: new Date().toISOString(),
    ...booking
  };
  await ensureDataDir();
  await fs.appendFile(bookingsPath, `${JSON.stringify(record)}\n`);
  await postOptionalWebhook(process.env.LEAD_WEBHOOK_URL, { ...record, type: "booking_request" });
  return record;
}

export async function listRecords(filePath, limit = 50) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-limit)
      .reverse();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function listLeads(limit) {
  return listRecords(leadsPath, limit);
}

export async function listCalls(limit) {
  return listRecords(callsPath, limit);
}

export async function listSummaries(limit) {
  return listRecords(summariesPath, limit);
}

export async function listBookings(limit) {
  return listRecords(bookingsPath, limit);
}

export async function saveCallEvent(event) {
  const record = {
    createdAt: new Date().toISOString(),
    type: event.type,
    callId: event.data?.call_id,
    sipHeaders: event.data?.sip_headers || []
  };
  await ensureDataDir();
  await fs.appendFile(callsPath, `${JSON.stringify(record)}\n`);
  return record;
}

export function buildReceptionistInstructions(business, settings = {}) {
  const activeSettings = normalizeSettings(settings);
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || "";
  const fallbackBookingUrl =
    publicBaseUrl && !publicBaseUrl.includes("your-domain") ? `${publicBaseUrl.replace(/\/$/, "")}/api/book` : "";
  const bookingUrl = process.env.BOOKING_URL || fallbackBookingUrl;
  return `
You are the AI receptionist for ${business.name}.
Your job is to answer Google Voice forwarded calls like a polished Smith.ai-style front-desk teammate for DDD.

Voice and manner:
- Sound ${business.tone}.
- Speak like a real front desk receptionist: calm, helpful, confident, and not robotic.
- Keep answers short enough for a phone call, usually one or two sentences.
- Ask one question at a time.
- Let the caller finish before responding, and do not over-explain.
- Use natural acknowledgements like "I can help with that" or "Let me grab a few details."
- Do not invent business policies, prices, addresses, or availability.
- If a caller wants to book, collect their name, phone, email if available, reason for booking, and preferred date/time.
${bookingUrl ? `- The booking link is ${bookingUrl}. Offer it verbally and include it in saved lead next steps.` : "- A booking link is not configured yet because the public deployment URL is not set. Tell callers DDD will text or call them with the booking link after their details are saved."}

Opening flow:
- Start with exactly this greeting unless the caller speaks first: "${activeSettings.greeting}"
- If they ask whether you are human, be honest: say you are DDD's AI receptionist and you can take care of intake or get their message to the team.
- Identify the caller's intent: booking, pricing, service question, existing appointment, urgent help, or general message.
- If the caller wants Smith.ai-style service, focus on being useful and efficient instead of mentioning Smith.ai.

Intake flow:
- For every meaningful call, collect and confirm name, best callback number, service needed, location or service area if relevant, urgency, and preferred appointment time when scheduling.
- For roadside or vehicle-related requests, ask for vehicle year/make/model, current location, what happened, and whether the caller is in a safe place.
- For pricing questions, gather the job details and say the DDD team will confirm the price.
- For existing customers, collect their name, callback number, and what appointment or job they are calling about.
- Before ending, summarize the message in one sentence and confirm the next step.

Caller routing:
- Potential new clients and customers: ${activeSettings.callerFlows.newClients}
- Existing clients and customers: ${activeSettings.callerFlows.existingClients}
- Sales callers: ${activeSettings.callerFlows.sales}
- All other callers: ${activeSettings.callerFlows.otherCallers}

Qualifying services:
${activeSettings.qualifyingServices.map((service) => `- ${service}`).join("\n")}

Out-of-scope callers:
- ${activeSettings.outOfScopeHandling}

Follow-up style:
- ${activeSettings.followUpStyle}

Sound preferences:
- Ambient sound preference: ${activeSettings.soundPreferences.ambientSound}. This is saved for admin preference; do not claim the caller can hear background audio unless it is actually present.
- Thinking sound: ${activeSettings.soundPreferences.thinkingSound ? "Use a short natural bridge like 'one moment while I check that' if processing takes a moment." : "Avoid filler sounds or thinking noises; stay silent briefly if needed."}

Business hours:
${Object.entries(business.hours).map(([day, hours]) => `- ${day}: ${hours}`).join("\n")}

Services you can provide:
${business.services.map((service) => `- ${service}`).join("\n")}

FAQs:
${business.faqs.map((faq) => `- Q: ${faq.question}\n  A: ${faq.answer}`).join("\n")}

Admin business knowledge:
${activeSettings.businessKnowledge}

Escalation rules:
${business.escalationRules.map((rule) => `- ${rule}`).join("\n")}

Lead capture:
- Politely collect name, phone number, email if they are willing, location/service area when relevant, and reason for calling.
- Repeat important contact details back for confirmation.
- Once the caller confirms details, call the save_lead tool.
- If the caller specifically requests an appointment or gives a preferred time, call the save_booking_request tool after confirming the details.
- End with a clear next step. If a booking link is configured, tell them to use it to book.
- If you cannot complete the request, say a team member will follow up.
- Never promise that a human is available unless the caller has actually been transferred.

User-editable receptionist notes:
${activeSettings.customInstructions}
`.trim();
}

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export function receptionistTools() {
  return [
    {
      type: "function",
      name: "save_lead",
      description: "Save caller contact details and reason for calling after confirming them with the caller.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Caller name, if provided."
          },
          phone: {
            type: "string",
            description: "Best callback phone number."
          },
          email: {
            type: "string",
            description: "Caller email, if provided."
          },
          reason: {
            type: "string",
            description: "Short reason for the call."
          },
          urgency: {
            type: "string",
            enum: ["low", "normal", "high", "emergency"],
            description: "How urgent the caller's request appears to be."
          },
          nextStep: {
            type: "string",
            description: "What the business should do next. Include the booking link if the caller wants to schedule and BOOKING_URL is configured."
          },
          preferredTime: {
            type: "string",
            description: "Caller preferred appointment date or time, if provided."
          },
          location: {
            type: "string",
            description: "Caller location or service area, if relevant."
          },
          serviceType: {
            type: "string",
            description: "Type of service or appointment the caller needs."
          },
          vehicle: {
            type: "string",
            description: "Vehicle year, make, model, or related details, if relevant."
          },
          callerSentiment: {
            type: "string",
            enum: ["calm", "confused", "upset", "urgent"],
            description: "How the caller sounded."
          }
        },
        required: ["reason", "urgency", "nextStep"]
      }
    },
    {
      type: "function",
      name: "save_booking_request",
      description: "Save a booking request after confirming appointment details with the caller.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Caller name." },
          phone: { type: "string", description: "Best callback phone number." },
          email: { type: "string", description: "Caller email, if provided." },
          preferredTime: { type: "string", description: "Preferred appointment date or time." },
          reason: { type: "string", description: "What the caller needs booked." },
          location: { type: "string", description: "Caller location or service area, if relevant." },
          serviceType: { type: "string", description: "Type of service requested." },
          nextStep: { type: "string", description: "What DDD should do next." }
        },
        required: ["name", "phone", "preferredTime", "reason", "nextStep"]
      }
    }
  ];
}

export function callAcceptPayload(business, settings = {}) {
  return {
    type: "realtime",
    model: "gpt-realtime",
    instructions: buildReceptionistInstructions(business, settings),
    tools: receptionistTools(),
    tool_choice: "auto",
    audio: {
      output: {
        voice: normalizeVoice(settings.voice) || "marin"
      }
    }
  };
}

export function normalizeVoice(voice) {
  if (!voice || typeof voice !== "string") return "";
  const normalized = voice.trim().toLowerCase();
  return supportedVoiceIds.has(normalized) ? normalized : "";
}

function normalizeSettings(settings = {}) {
  return {
    enabled: settings.enabled !== false,
    voice: normalizeVoice(settings.voice) || "marin",
    greeting: cleanText(settings.greeting, defaultGreeting, 240),
    customInstructions: cleanLongText(settings.customInstructions, defaultCustomInstructions, 1600),
    businessKnowledge: cleanLongText(settings.businessKnowledge, defaultBusinessKnowledge, 3000),
    callerFlows: normalizeCallerFlows(settings.callerFlows),
    qualifyingServices: normalizeTextList(settings.qualifyingServices, defaultQualifyingServices, 12, 80),
    outOfScopeHandling: cleanLongText(
      settings.outOfScopeHandling,
      "Take a message for services DDD may not offer, unless the request is unsafe or clearly unrelated.",
      600
    ),
    followUpStyle: cleanLongText(
      settings.followUpStyle,
      "For booking callers, share the booking link and save the request. For everyone else, save a message with the best callback number.",
      600
    ),
    soundPreferences: normalizeSoundPreferences(settings.soundPreferences),
    voiceOptions
  };
}

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function cleanLongText(value, fallback, maxLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function normalizeCallerFlows(flows = {}) {
  return {
    newClients: cleanLongText(flows.newClients, defaultCallerFlows.newClients, 900),
    existingClients: cleanLongText(flows.existingClients, defaultCallerFlows.existingClients, 900),
    sales: cleanLongText(flows.sales, defaultCallerFlows.sales, 900),
    otherCallers: cleanLongText(flows.otherCallers, defaultCallerFlows.otherCallers, 900)
  };
}

function normalizeTextList(value, fallback, maxItems, maxItemLength) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\n|,/)
      : fallback;
  const normalized = list
    .map((item) => cleanText(String(item || ""), "", maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
  return normalized.length ? normalized : fallback;
}

function normalizeSoundPreferences(value = {}) {
  return {
    ambientSound: cleanText(value.ambientSound, defaultSoundPreferences.ambientSound, 80),
    thinkingSound: value.thinkingSound !== false
  };
}

async function postOptionalWebhook(url, payload) {
  if (!url) return;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.warn(`Webhook failed: ${response.status} ${await response.text()}`);
  }
}
