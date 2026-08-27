import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const businessPath = path.join(root, "config", "business.json");
const leadsPath = path.join(root, "data", "leads.jsonl");
const callsPath = path.join(root, "data", "calls.jsonl");
const summariesPath = path.join(root, "data", "summaries.jsonl");
const bookingsPath = path.join(root, "data", "bookings.jsonl");
const smsPath = path.join(root, "data", "sms.jsonl");
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
const defaultServiceArea = "Greater Cincinnati and nearby service areas DDD confirms case by case.";
const defaultPricingNotes =
  "Do not quote exact prices unless the admin has added them. Collect job details and say the DDD team will confirm the final price.";
const defaultEmergencyInstructions =
  "For stranded or urgent roadside callers, first ask if they are in a safe location, collect their exact location and callback number, then direct them to the emergency service request option.";
const defaultHumanHandoffRules =
  "Do not promise a live transfer. Save the caller's details and tell them the DDD team will follow up as soon as possible.";
const defaultApplyInstructions =
  "For work, contractor, technician, or job-interest calls, collect name, phone, email, role or service type, experience, and location, then direct them to the DDD apply to work link.";
const defaultSmsFollowUpText =
  "Thanks for calling {{business}}. Here is the best next link for your request: {{link}}. The DDD team will follow up if anything else is needed.";
const defaultVoiceDirection =
  "Warm, confident, friendly receptionist. Natural phone cadence, clear pronunciation, and not robotic.";
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
const defaultBookingDestinations = [
  {
    label: "Book roadside service",
    url: "https://dddcincy.com/book-service/",
    useWhen: "Most roadside or mobile service callers who are ready to book. Push this for jump starts, lockouts, tire help, fuel delivery, batteries, oil changes, brakes, and light maintenance."
  },
  {
    label: "Emergency service request",
    url: "https://dddcincy.com/emergency-service/",
    useWhen: "Caller says they need urgent roadside help now, is stranded, locked out, has a flat, dead battery, fuel issue, or needs dispatch-style help."
  },
  {
    label: "Shop roadside services",
    url: "https://dddcincy.com/shop-our-roadside-services/",
    useWhen: "Caller asks what DDD offers, wants prices, wants to choose a service, or may need to add a service to cart."
  },
  {
    label: "DDD Mobile app",
    url: "https://dddcincy.com/ddd-mobile-app/",
    useWhen: "Caller wants the mobile app, service status, booking alerts, app account tools, or a smoother repeat-customer flow."
  },
  {
    label: "DDD Auto Doc app",
    url: "https://dddcincy.com/ddd-auto-doc/",
    useWhen: "Caller wants AI vehicle diagnosis, safety guidance, saved reports, or help deciding what is wrong before booking."
  },
  {
    label: "DDDCincy.com",
    url: "https://dddcincy.com/",
    useWhen: "Caller needs the main website, general DDD information, or is not sure which DDD page they need."
  },
  {
    label: "DDD apply to work",
    url: "https://dddcincy.com/apply-to-work-with-ddd/",
    useWhen: "Caller wants to apply to work with DDD, contractor interest, technician approval, or service provider onboarding."
  }
];

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
        voiceSpeed: next.voiceSpeed,
        voiceDirection: next.voiceDirection,
        greeting: next.greeting,
        customInstructions: next.customInstructions,
        businessKnowledge: next.businessKnowledge,
        serviceArea: next.serviceArea,
        pricingNotes: next.pricingNotes,
        emergencyInstructions: next.emergencyInstructions,
        humanHandoffRules: next.humanHandoffRules,
        applyInstructions: next.applyInstructions,
        smsFollowUp: next.smsFollowUp,
        callerFlows: next.callerFlows,
        qualifyingServices: next.qualifyingServices,
        outOfScopeHandling: next.outOfScopeHandling,
        followUpStyle: next.followUpStyle,
        soundPreferences: next.soundPreferences,
        bookingDestinations: next.bookingDestinations
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
  await sendOptionalSmsFollowUp(record, "lead");
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
  await sendOptionalSmsFollowUp(record, "booking_request");
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

export async function saveIncomingSms(message) {
  const record = {
    createdAt: new Date().toISOString(),
    from: cleanText(message.From || message.from, "", 40),
    to: cleanText(message.To || message.to, "", 40),
    body: cleanLongText(message.Body || message.body, "", 2000),
    messageSid: cleanText(message.MessageSid || message.SmsSid || "", "", 80)
  };
  await ensureDataDir();
  await fs.appendFile(smsPath, `${JSON.stringify(record)}\n`);
  return record;
}

export async function listSms(limit = 50) {
  return listRecords(smsPath, limit);
}

export function buildReceptionistInstructions(business, settings = {}) {
  const activeSettings = normalizeSettings(settings);
  if (settings.verificationMode) {
    return `
You are connected to a Google Voice phone verification call for DDD.
Stay silent at the start of the call.
Listen for a six-digit verification code.
When you hear the code, immediately call save_lead with:
- reason: "Google Voice verification code"
- urgency: "normal"
- nextStep: "Google Voice verification code: XXXXXX" with the exact six digits you heard
- serviceType: "Google Voice verification"
- smsConsent: false
Do not ask questions. Do not say the DDD greeting. Only speak if needed after saving the code.
`.trim();
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL || "";
  const fallbackBookingUrl =
    publicBaseUrl && !publicBaseUrl.includes("your-domain") ? `${publicBaseUrl.replace(/\/$/, "")}/api/book` : "";
  const bookingUrl = process.env.BOOKING_URL || fallbackBookingUrl;
  return `
You are the AI receptionist for ${business.name}.
Your job is to answer Google Voice forwarded calls like a polished Smith.ai-style front-desk teammate for DDD.

Voice and manner:
- Sound ${business.tone}.
- Voice direction: ${activeSettings.voiceDirection}
- Speaking speed: ${activeSettings.voiceSpeed}x. Keep the same natural pace throughout the call.
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

SMS follow-up:
- SMS follow-up is ${activeSettings.smsFollowUp.enabled ? "enabled" : "disabled"} in admin.
- If enabled, ask permission before texting the caller the best DDD link.
- Message template: ${activeSettings.smsFollowUp.message}
- Use the most relevant DDD destination as {{link}}.
- When calling save_lead or save_booking_request, set smsConsent to true only if the caller clearly agreed to receive the text.
- If SMS delivery is not connected yet, still save the caller's phone number and best next link.

Booking, app, and apply destinations:
${activeSettings.bookingDestinations.map((destination) => `- ${destination.label}: ${destination.url}\n  Use when: ${destination.useWhen}`).join("\n")}

DDD routing rules:
- Push callers toward the best DDD destination above instead of giving a generic booking link when one clearly fits.
- For ready-to-book roadside callers, direct them to Book roadside service.
- For stranded, locked out, flat tire, dead battery, fuel, or urgent roadside callers, direct them to Emergency service request.
- For callers comparing or buying specific services, direct them to Shop roadside services.
- For mobile-app, booking-alert, service-status, or repeat-customer questions, direct them to DDD Mobile app.
- For vehicle symptom or "what is wrong with my car" questions, direct them to DDD Auto Doc app after collecting the main symptoms.
- For general website or unclear DDD page questions, direct them to DDDCincy.com.
- For contractor/job interest, direct them to DDD apply to work.
- Do not mention DDD Tech, customer portal, Fish On, Rap League, TrustCall, or unrelated DDD products unless the admin adds them to the booking destinations.

Business hours:
${Object.entries(business.hours).map(([day, hours]) => `- ${day}: ${hours}`).join("\n")}

Services you can provide:
${business.services.map((service) => `- ${service}`).join("\n")}

FAQs:
${business.faqs.map((faq) => `- Q: ${faq.question}\n  A: ${faq.answer}`).join("\n")}

Admin business knowledge:
${activeSettings.businessKnowledge}

Service area:
${activeSettings.serviceArea}

Pricing rules:
${activeSettings.pricingNotes}

Emergency call handling:
${activeSettings.emergencyInstructions}

Escalation rules:
${business.escalationRules.map((rule) => `- ${rule}`).join("\n")}

Human handoff rules:
${activeSettings.humanHandoffRules}

Apply-to-work handling:
${activeSettings.applyInstructions}

Lead capture:
- Politely collect name, phone number, email if they are willing, location/service area when relevant, and reason for calling.
- Repeat important contact details back for confirmation.
- Once the caller confirms details, call the save_lead tool.
- If the caller specifically requests an appointment or gives a preferred time, call the save_booking_request tool after confirming the details.
- End with a clear next step. Include the most relevant DDD destination link in the saved next step and tell the caller they can use that link.
- If SMS follow-up is enabled and the caller agrees, say DDD will text the best link to the callback number on file.
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
          smsConsent: {
            type: "boolean",
            description: "True only if the caller clearly agreed to receive an SMS follow-up."
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
          nextStep: { type: "string", description: "What DDD should do next." },
          smsConsent: {
            type: "boolean",
            description: "True only if the caller clearly agreed to receive an SMS follow-up."
          }
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
    output_modalities: ["audio"],
    tracing: "auto",
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
          prompt: settings.verificationMode
            ? "This is a Google Voice verification call. Listen for a six digit numeric code."
            : "Phone call with a DDD receptionist. Transcribe caller details, names, phone numbers, service requests, locations, and appointment times."
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "high",
          create_response: true,
          interrupt_response: true
        }
      },
      output: {
        voice: normalizeVoice(settings.voice) || "marin",
        speed: normalizeSpeed(settings.voiceSpeed)
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
    voiceSpeed: normalizeSpeed(settings.voiceSpeed),
    voiceDirection: cleanLongText(settings.voiceDirection, defaultVoiceDirection, 700),
    greeting: cleanText(settings.greeting, defaultGreeting, 240),
    customInstructions: cleanLongText(settings.customInstructions, defaultCustomInstructions, 1600),
    businessKnowledge: cleanLongText(settings.businessKnowledge, defaultBusinessKnowledge, 3000),
    serviceArea: cleanLongText(settings.serviceArea, defaultServiceArea, 900),
    pricingNotes: cleanLongText(settings.pricingNotes, defaultPricingNotes, 1200),
    emergencyInstructions: cleanLongText(settings.emergencyInstructions, defaultEmergencyInstructions, 1200),
    humanHandoffRules: cleanLongText(settings.humanHandoffRules, defaultHumanHandoffRules, 1200),
    applyInstructions: cleanLongText(settings.applyInstructions, defaultApplyInstructions, 1200),
    smsFollowUp: normalizeSmsFollowUp(settings.smsFollowUp),
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
    bookingDestinations: normalizeBookingDestinations(settings.bookingDestinations),
    voiceOptions
  };
}

export function buildDryRun(settings = {}, callerMessage = "") {
  const activeSettings = normalizeSettings(settings);
  const message = String(callerMessage || "").toLowerCase();
  const destination = chooseDestination(activeSettings.bookingDestinations, message);
  const intent = classifyIntent(message);
  const questions = intent === "emergency"
    ? ["Are you in a safe place right now?", "What is your exact location?", "What vehicle are you with, and what happened?", "What is the best callback number?"]
    : intent === "apply"
      ? ["What kind of DDD work are you applying for?", "What experience do you have?", "What is your best callback number and email?"]
      : ["What service do you need?", "What is your name and best callback number?", "Where are you located?", "What date or time works best?"];

  return {
    intent,
    destination,
    opening: activeSettings.greeting,
    likelyReply: [
      activeSettings.greeting,
      intent === "emergency"
        ? "I can help with that. First, are you in a safe place right now?"
        : intent === "apply"
          ? "I can help get your information to DDD. What kind of work are you applying for?"
          : "I can help with that. Let me grab a few details so DDD can follow up correctly.",
      `I would ask: ${questions.join(" ")}`,
      destination ? `Best next link: ${destination.label} - ${destination.url}` : "Best next link: use the main DDD booking option if one applies.",
      activeSettings.smsFollowUp.enabled
        ? `SMS follow-up: ask permission, then text "${renderSmsTemplate(activeSettings.smsFollowUp.message, destination)}"`
        : "SMS follow-up: off"
    ].join("\n\n"),
    questions,
    note: "Free dry run. This does not place a phone call and does not use OpenAI voice minutes."
  };
}

function classifyIntent(message) {
  if (/stranded|emergency|urgent|now|locked|lockout|flat|tire|jump|battery|dead|fuel|gas|tow/.test(message)) {
    return "emergency";
  }
  if (/apply|job|work|hire|contractor|technician|tech|driver/.test(message)) {
    return "apply";
  }
  if (/app|auto doc|diagnos|symptom|what'?s wrong/.test(message)) {
    return "app";
  }
  if (/price|cost|quote|how much|shop/.test(message)) {
    return "shopping";
  }
  return "booking";
}

function chooseDestination(destinations, message) {
  const intent = classifyIntent(message);
  const wanted = {
    emergency: /emergency/i,
    apply: /apply/i,
    app: /auto doc|mobile app/i,
    shopping: /shop|service/i,
    booking: /book/i
  }[intent];
  return destinations.find((destination) => wanted.test(`${destination.label} ${destination.useWhen}`)) || destinations[0] || null;
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

function normalizeSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) return 1;
  return Math.min(1.5, Math.max(0.5, Math.round(speed * 100) / 100));
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

function normalizeSmsFollowUp(value = {}) {
  return {
    enabled: value.enabled !== false,
    askPermission: value.askPermission !== false,
    message: cleanLongText(value.message, defaultSmsFollowUpText, 500)
  };
}

function normalizeBookingDestinations(value = {}) {
  const list = Array.isArray(value) ? value : defaultBookingDestinations;
  const normalized = list
    .map((destination) => ({
      label: cleanText(destination?.label, "", 80),
      url: cleanText(destination?.url, "", 240),
      useWhen: cleanLongText(destination?.useWhen, "", 400)
    }))
    .filter((destination) => destination.label && isHttpUrl(destination.url) && destination.useWhen)
    .slice(0, 12);
  return normalized.length ? normalized : defaultBookingDestinations;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

async function sendOptionalSmsFollowUp(record, type) {
  const settings = await loadReceptionistSettings();
  if (!settings.smsFollowUp.enabled || !record.phone) return;
  if (settings.smsFollowUp.askPermission && record.smsConsent !== true) return;

  const destination = chooseDestination(
    settings.bookingDestinations,
    `${record.reason || ""} ${record.serviceType || ""} ${record.nextStep || ""}`
  );
  const message = renderSmsTemplate(settings.smsFollowUp.message, destination);
  const voipmsResult = await sendVoipMsSms(record.phone, message);
  await postOptionalWebhook(process.env.SMS_FOLLOWUP_WEBHOOK_URL, {
    type,
    to: record.phone,
    message,
    destination,
    delivery: voipmsResult,
    record
  });
}

function renderSmsTemplate(template, destination) {
  const fallbackLink = destination?.url || process.env.BOOKING_URL || "";
  return String(template || defaultSmsFollowUpText)
    .replaceAll("{{link}}", fallbackLink)
    .replaceAll("{{business}}", "DDD")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendVoipMsSms(to, message) {
  if (!process.env.VOIPMS_API_USERNAME || !process.env.VOIPMS_API_PASSWORD || !process.env.VOIPMS_SMS_DID) {
    return { ok: false, skipped: true, reason: "VoIP.ms SMS API is not configured." };
  }

  const body = new URLSearchParams({
    api_username: process.env.VOIPMS_API_USERNAME,
    api_password: process.env.VOIPMS_API_PASSWORD,
    method: "sendSMS",
    did: normalizePhoneForSms(process.env.VOIPMS_SMS_DID),
    dst: normalizePhoneForSms(to),
    message: String(message || "").slice(0, 160),
    content_type: "json"
  });

  const response = await fetch("https://voip.ms/api/v1/rest.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(async () => ({
    status: "invalid_response",
    raw: await response.text().catch(() => "")
  }));
  if (!response.ok || payload.status !== "success") {
    console.warn(`VoIP.ms SMS failed: ${response.status} ${JSON.stringify(payload)}`);
    return { ok: false, status: payload.status || response.status, payload };
  }
  return { ok: true, status: payload.status, sms: payload.sms };
}

function normalizePhoneForSms(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}
