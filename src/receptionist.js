import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const businessPath = path.join(root, "config", "business.json");
const bundledDataDir = path.join(root, "data");
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : bundledDataDir;
const leadsPath = path.join(dataDir, "leads.jsonl");
const callsPath = path.join(dataDir, "calls.jsonl");
const summariesPath = path.join(dataDir, "summaries.jsonl");
const bookingsPath = path.join(dataDir, "bookings.jsonl");
const smsPath = path.join(dataDir, "sms.jsonl");
const settingsPath = path.join(dataDir, "settings.json");
const bundledSettingsPath = path.join(bundledDataDir, "settings.json");
const bookingStatuses = ["Requested", "Confirmed", "Technician Assigned", "Technician En Route", "Arrived", "In Progress", "Completed", "Cancelled"];

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
const defaultGreeting = "Thank you for calling DDD Mobile. I can help book service or get your message to the team. What can I help with today?";
const defaultCustomInstructions =
  "Act like a polished front desk receptionist. Be warm, direct, and fast. Reflect the caller's exact request before asking questions. If they name a service like oil change, brakes, battery install, tire help, jump start, lockout, or fuel delivery, treat it as a bookable DDD service immediately. For oil changes, brakes, rotors, hub bearings, and battery installs, ask whether the customer already has the parts/materials or needs DDD to confirm parts. For tire-related work, ask whether the vehicle has a wheel lock/special key and whether they have it available. Reassure them once that this will be quick and that you can make the booking for them when booking applies. Do not ask generic category questions after they already named the service. Do not repeat that reassurance. Do not keep emergency callers on the phone longer than needed. Collect the key details, point them to the right DDD link, and save a clear next step.";
const defaultBusinessKnowledge =
  "DDD Mobile is a woman-owned Cincinnati mobile roadside and light mobile maintenance service. DDD helps with jump starts, battery installs, lockouts, fuel delivery, tire inflation, tire plugs, spare tire changes, oil change requests, brake pads, rotors, bolt-in hub bearing requests, light mobile maintenance, DDD Mobile app/status help, DDD Auto Doc vehicle guidance, booking help, existing booking messages, and apply-to-work questions. DDD does not tow. Use dddcincy.com links only for DDD Mobile, DDD Mobile app/status, DDD Auto Doc, roadside service booking, emergency service requests, shop roadside services, and apply-to-work requests. The receptionist should push callers toward booking/status/apply quickly instead of holding long conversations. If pricing, exact availability, or service-area details are unknown, collect details and say the DDD team will confirm.";
const defaultServiceArea = "Greater Cincinnati, Liberty Township, Northern Kentucky, and nearby tri-state areas DDD confirms case by case.";
const defaultPricingNotes =
  "Public starting points only, not final quotes: standard service fee $25, gas by the gallon $10, 5-gallon fuel refill $35, tire inflation $15, tire plug $20, spare tire change $50, battery jump-start $30, battery installation $40, door unlock $40, oil change labor $25 when customer provides oil/filter, brake pads $50 per axle or listed per-wheel/all-wheel options, rotor add-on +$20 per axle, rotor replacement only $50 per axle, full brake pad replacement four wheels $200, brake and rotor all wheels $280, bolt-in hub bearing $200 per axle. Say DDD will confirm final price before service.";
const defaultEmergencyInstructions =
  "For stranded or urgent roadside callers, be extremely brief. Ask if they are safe, get exact location, vehicle year/make/model/color, what happened, callback number, and whether they can receive a text. Then direct them to the emergency service request option and save the lead.";
const defaultHumanHandoffRules =
  "Do not promise a live transfer. Save the caller's details and tell them the DDD team will follow up as soon as possible.";
const defaultApplyInstructions =
  "For work, contractor, technician, or job-interest calls, collect name, phone, email, role or service type, experience, and location, then direct them to the DDD apply to work link.";
const defaultSmsFollowUpText =
  "Thanks for calling {{business}}. Here is the best next link for your request: {{link}}. The DDD team will follow up if anything else is needed.";
const defaultReviewFollowUpUrl = "https://g.page/r/CfVinSqxHOIDEAE/review";
const defaultReviewFollowUpText =
  "Thanks again for choosing DDD. If everything went well, please leave a quick Google review here: {{reviewLink}}";
const defaultVoiceDirection =
  "Warm, confident, friendly receptionist. Natural phone cadence, clear pronunciation, and not robotic.";
const defaultCallerFlows = {
  newClients:
    "If they already named the service, do not re-qualify it. Tell them this will be quick and that you can make the booking for them. Then collect name, callback number, location, vehicle details if relevant, parts/materials status for oil/brakes/rotors/hub/battery jobs, wheel-lock/special-key status for tire jobs, and preferred time. End by saving a lead or booking request and sharing the best DDD link.",
  existingClients:
    "Collect name, callback number, existing appointment or job details, and what they need changed or answered. Save a clear message for follow-up.",
  sales:
    "Collect company/name, callback number, email, what they are offering, and whether it sounds useful. Do not commit DDD to buying anything.",
  otherCallers:
    "Collect who they are, callback number, reason for calling, and the best next step. Keep it brief and professional."
};
const defaultQualifyingServices = [
  "Roadside assistance",
  "Mobile auto service",
  "Battery or jump start",
  "Battery installation",
  "Flat tire or tire help",
  "Tire inflation",
  "Tire plug",
  "Spare tire change",
  "Lockout",
  "Fuel delivery",
  "Oil change",
  "Brake pads",
  "Rotors",
  "Bolt-in hub bearings",
  "Maintenance or repair",
  "Existing appointment",
  "DDD Mobile app help",
  "DDD Auto Doc app help",
  "Apply to work with DDD"
];
const defaultEmergencyQuestions = [
  "Are you in a safe place right now?",
  "What is your exact location or nearest cross street?",
  "What is the vehicle year, make, and model?",
  "What happened?",
  "What is the best callback number?",
  "Can DDD text you the best link?"
];
const defaultOfferedServices =
  "Roadside assistance, mobile auto service, jump starts, battery help and battery installation, lockouts/door unlocks, tire inflation, tire plugs, spare tire changes, fuel delivery/gas refill, oil change requests, brake pads, rotors, bolt-in hub bearing requests, light mobile maintenance/repair requests, DDD Mobile app/status help, DDD Auto Doc guidance, booking help, existing appointment messages, Track My Tech/status questions, and apply-to-work questions.";
const defaultNotOfferedServices =
  "Do not promise towing, exact arrival times, exact final pricing, dealership-level repairs, engine/transmission rebuilds, body work, glass or windshield replacement, paint, tire sales, impound releases, emergency medical/police help, or services DDD has not confirmed.";
const defaultDirectoryReferral = {
  enabled: false,
  url: "",
  message:
    "DDD may not handle that exact service, but we can text you a referral/directory link for nearby mobile mechanics or shops if you want."
};
const defaultAfterHoursInstructions =
  "If DDD is closed or availability is unclear, still collect the message and push the right link. Say the team will follow up as soon as possible.";
const defaultCallOutcomeRules =
  "For every call, end with one clear outcome: booking created, lead/message saved, best DDD link shared, apply-to-work info captured, existing job message captured, sales message captured, spam/irrelevant declined, or human follow-up needed. Do not leave the caller unsure what happens next.";
const defaultFallbackRules =
  "If the AI cannot hear the caller, the caller is upset, the caller requests a human twice, the call is urgent and details are incomplete, booking sync fails, or the call drops before intake is complete, save a missed/fallback lead with caller ID if available and mark the next step as urgent human follow-up.";
const defaultQaChecklist =
  "QA should confirm: AI answered, caller intent identified, name/phone captured when possible, emergency callers were handled quickly, booking or lead was saved, correct DDD link was selected, SMS consent was asked before texting, transcript/recording was attached when available, and call ended with a clear next step.";
const defaultSoundPreferences = {
  ambientSound: "none",
  thinkingSound: true
};
const defaultStaffAccessCodes = [];
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
    if (settingsPath !== bundledSettingsPath) {
      try {
        const raw = await fs.readFile(bundledSettingsPath, "utf8");
        const settings = JSON.parse(raw);
        return normalizeSettings({ ...settings, voice: normalizeVoice(settings.voice) || envVoice || "marin" });
      } catch (fallbackError) {
        if (fallbackError.code !== "ENOENT") throw fallbackError;
      }
    }
    return normalizeSettings({ voice: envVoice || "marin" });
  }
}

export function getStorageInfo() {
  return {
    dataDir,
    persistent: Boolean(process.env.DATA_DIR),
    mode: process.env.DATA_DIR ? "persistent" : "bundled"
  };
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
        emergencyQuestions: next.emergencyQuestions,
        offeredServices: next.offeredServices,
        notOfferedServices: next.notOfferedServices,
        directoryReferral: next.directoryReferral,
        afterHoursInstructions: next.afterHoursInstructions,
        humanHandoffRules: next.humanHandoffRules,
        callOutcomeRules: next.callOutcomeRules,
        fallbackRules: next.fallbackRules,
        qaChecklist: next.qaChecklist,
        applyInstructions: next.applyInstructions,
        smsFollowUp: next.smsFollowUp,
        reviewFollowUp: next.reviewFollowUp,
        callerFlows: next.callerFlows,
        qualifyingServices: next.qualifyingServices,
        outOfScopeHandling: next.outOfScopeHandling,
        followUpStyle: next.followUpStyle,
        soundPreferences: next.soundPreferences,
        staffAccessCodes: next.staffAccessCodes,
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
  const record = normalizeBookingRecord(booking);
  const sync = await syncBookingRequest(record);
  record.externalSync = sync;
  if (sync.ok && sync.trackingUrl) {
    record.customerStatusUrl = sync.trackingUrl;
  }
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

export async function listCallLog(limit = 50) {
  const [calls, summaries, leads, bookings] = await Promise.all([
    listRecords(callsPath, 1000),
    listRecords(summariesPath, 1000),
    listRecords(leadsPath, 1000),
    listRecords(bookingsPath, 1000)
  ]);
  const summariesByCall = groupByCallId(summaries);
  const leadsByCall = groupByCallId(leads);
  const bookingsByCall = groupByCallId(bookings);
  return calls
    .map((call) => {
      const callId = call.callId || "";
      const relatedSummaries = summariesByCall.get(callId) || [];
      const relatedLeads = leadsByCall.get(callId) || [];
      const relatedBookings = bookingsByCall.get(callId) || [];
      const summary = relatedSummaries[0] || {};
      const transcript = relatedSummaries.flatMap((item) => normalizeTranscript(item.transcript));
      const caller = firstTruthy(
        call.from,
        extractSipHeader(call.sipHeaders, "from"),
        relatedBookings[0]?.phone,
        relatedLeads[0]?.phone
      );
      const destination = firstTruthy(call.to, extractSipHeader(call.sipHeaders, "to"));
      return {
        id: callId || `${call.createdAt || "call"}-${call.type || "event"}`,
        callId,
        createdAt: call.createdAt,
        startedAt: summary.startedAt || call.createdAt,
        endedAt: summary.endedAt || "",
        type: call.type || "call",
        caller,
        destination,
        status: call.status || (summary.endedAt ? "completed" : "logged"),
        recordingUrl: firstTruthy(call.recordingUrl, call.recording_url, summary.recordingUrl, summary.recording_url),
        transcript,
        transcriptText: transcript.map((item) => item.text).filter(Boolean).join("\n"),
        leads: relatedLeads,
        bookings: relatedBookings,
        summaries: relatedSummaries
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

export async function listBookingsByPhone(phone, limit = 20) {
  const target = normalizeE164(phone);
  if (!target) return [];
  const records = await listRecords(bookingsPath, 1000);
  return records
    .filter((booking) => normalizeE164(booking.phone || booking.customer_phone) === target)
    .slice(0, limit);
}

export async function getBookingStatus(bookingId, token) {
  if (!bookingId || !token) return null;
  const records = await listRecords(bookingsPath, 1000);
  return records.find((booking) => booking.bookingId === bookingId && booking.statusToken === token) || null;
}

export async function saveCallEvent(event) {
  const record = {
    createdAt: new Date().toISOString(),
    type: event.type,
    callId: event.data?.call_id,
    from: extractSipHeader(event.data?.sip_headers || [], "from"),
    to: extractSipHeader(event.data?.sip_headers || [], "to"),
    status: cleanText(event.data?.status || event.data?.call_status || "", "", 80),
    recordingUrl: cleanText(event.data?.recording_url || event.data?.recordingUrl || "", "", 500),
    sipHeaders: event.data?.sip_headers || []
  };
  await ensureDataDir();
  await fs.appendFile(callsPath, `${JSON.stringify(record)}\n`);
  return record;
}

export async function saveIncomingSms(message) {
  const record = {
    createdAt: new Date().toISOString(),
    direction: "inbound",
    from: cleanText(message.From || message.from, "", 40),
    to: cleanText(message.To || message.to, "", 40),
    body: cleanLongText(message.Body || message.body, "", 2000),
    messageSid: cleanText(message.MessageSid || message.SmsSid || "", "", 80),
    status: cleanText(message.SmsStatus || message.status || "received", "received", 80),
    agentName: ""
  };
  await ensureDataDir();
  await fs.appendFile(smsPath, `${JSON.stringify(record)}\n`);
  return record;
}

export async function saveOutgoingSms(message) {
  const record = {
    createdAt: new Date().toISOString(),
    direction: "outbound",
    from: cleanText(message.From || message.from, "", 40),
    to: cleanText(message.To || message.to, "", 40),
    body: cleanLongText(message.Body || message.body, "", 2000),
    messageSid: cleanText(message.MessageSid || message.messageSid || "", "", 80),
    status: cleanText(message.SmsStatus || message.status || "sent", "sent", 80),
    agentName: cleanText(message.agentName || "DDD team", "DDD team", 80)
  };
  await ensureDataDir();
  await fs.appendFile(smsPath, `${JSON.stringify(record)}\n`);
  return record;
}

export async function listSms(limit = 50) {
  return listRecords(smsPath, limit);
}

export async function listConversations(limit = 200) {
  const messages = await listRecords(smsPath, limit);
  const conversations = new Map();
  for (const message of [...messages].reverse()) {
    const direction = message.direction || "inbound";
    const customerPhone = direction === "outbound" ? message.to : message.from;
    const key = normalizeConversationPhone(customerPhone);
    if (!key) continue;
    if (!conversations.has(key)) {
      conversations.set(key, {
        phone: key,
        lastMessageAt: message.createdAt,
        lastBody: message.body || "",
        unread: 0,
        messages: []
      });
    }
    const conversation = conversations.get(key);
    conversation.messages.push({
      ...message,
      direction,
      customerPhone: key
    });
    conversation.lastMessageAt = message.createdAt || conversation.lastMessageAt;
    conversation.lastBody = message.body || conversation.lastBody;
    if (direction === "inbound") conversation.unread += 1;
  }

  return [...conversations.values()]
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    }))
    .sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)));
}

function groupByCallId(records) {
  const grouped = new Map();
  for (const record of records) {
    const callId = record.callId || "";
    if (!callId) continue;
    if (!grouped.has(callId)) grouped.set(callId, []);
    grouped.get(callId).push(record);
  }
  return grouped;
}

function normalizeTranscript(transcript) {
  if (!Array.isArray(transcript)) return [];
  return transcript
    .map((item) => ({
      at: item.at || item.createdAt || "",
      type: item.type || "transcript",
      speaker: item.speaker || inferTranscriptSpeaker(item.type),
      text: cleanLongText(item.text || item.transcript || "", "", 4000)
    }))
    .filter((item) => item.text);
}

function inferTranscriptSpeaker(type = "") {
  const eventType = String(type).toLowerCase();
  if (eventType.includes("input_audio") || eventType.includes("user")) return "Caller";
  if (eventType.includes("response") || eventType.includes("assistant")) return "AI";
  return "Call";
}

function extractSipHeader(headers = [], name = "") {
  const target = String(name).toLowerCase();
  const header = headers.find((item) => String(item.name || "").toLowerCase() === target);
  return cleanText(header?.value || "", "", 500);
}

function firstTruthy(...values) {
  return values.find((value) => String(value || "").trim()) || "";
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
- For booking or urgent service calls, reassure the caller once: "This will be quick, and I can make the booking for you." Use this idea naturally, then do not repeat it.
- If the caller names a specific bookable service, such as "oil change", "brakes", "battery install", "jump start", "lockout", "flat tire", or "fuel delivery", do not ask whether they need roadside, routine service, emergency help, or another category. Treat the named service as the intent and ask for the next missing booking detail.
- Do not repeat the greeting, the same reassurance, or the same question after the caller already answered. If you missed something, ask only for the missing detail.
- Do not invent business policies, prices, addresses, or availability.
- If a caller wants to book, collect their name, phone, email if available, service, location, vehicle year/make/model/color when relevant, issue, urgency, and preferred date/time.
- For oil changes, brake pads, rotors, bolt-in hub bearings, and battery installs, ask whether the customer already has the parts/materials or needs DDD to confirm parts.
- For tire-related jobs, ask whether the vehicle has a wheel lock/special key and whether the caller has that key available.
- As soon as you have enough booking details and callback information, call save_booking_request. Do not require the caller to fill out a form first.
- If save_booking_request returns a customerStatusUrl or trackingUrl, use that as the caller's booking/status link and offer to text it.
${bookingUrl ? `- The booking link is ${bookingUrl}. Offer it verbally and include it in saved lead next steps.` : "- A booking link is not configured yet because the public deployment URL is not set. Tell callers DDD will text or call them with the booking link after their details are saved."}

Opening flow:
- Start with exactly this greeting unless the caller speaks first: "${activeSettings.greeting}"
- If they ask whether you are human, be honest: say you are DDD's AI receptionist and you can take care of intake or get their message to the team.
- Identify the caller's intent: booking, pricing, service question, existing appointment, urgent help, apply-to-work, unsupported service, or general message.
- First reflect the caller's actual words in one short sentence, such as "I hear you need help with a flat tire right now," then ask the next best question.
- When the service is obvious, use a clean service reflection instead of repeating the caller's whole sentence. For example, say "I can help book the oil change," not "I hear you need help with: I need an oil change."
- Keep the opening flow fast: reflect need, reassure once if booking applies, ask the highest-priority missing question.
- Example: if the caller says "I need an oil change," respond like "I can help book the oil change. This will be quick, and I can make the booking for you. What is the best callback number?" Do not ask what type of call it is.
- If the caller wants Smith.ai-style service, focus on being useful and efficient instead of mentioning Smith.ai.

Intake flow:
- For every meaningful call, collect and confirm name, best callback number, service needed, location or service area if relevant, urgency, and preferred appointment time when scheduling.
- For roadside or vehicle-related requests, ask for vehicle year, make, model, color, current location, what happened, and whether the caller is in a safe place.
- For pricing questions, follow admin pricing guidance, gather job details, and say DDD will confirm final price before service.
- For existing customers, collect their name, callback number, and what appointment or job they are calling about.
- Before ending, summarize the message in one sentence and confirm the next step.
- Do not turn intake into a long interview. Get the minimum useful details, then move the caller to the link or saved callback.
- Avoid looping. If a detail is already known from the caller's words, do not ask for it again; confirm it briefly only if important.

Emergency intake questions, in order:
${activeSettings.emergencyQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Caller routing:
- Potential new clients and customers: ${activeSettings.callerFlows.newClients}
- Existing clients and customers: ${activeSettings.callerFlows.existingClients}
- Sales callers: ${activeSettings.callerFlows.sales}
- All other callers: ${activeSettings.callerFlows.otherCallers}

Qualifying services:
${activeSettings.qualifyingServices.map((service) => `- ${service}`).join("\n")}

Out-of-scope callers:
- ${activeSettings.outOfScopeHandling}
- If the requested service is listed under Admin not-offered / do-not-promise services, politely say DDD may not handle that exact service, do not book it as a DDD job, and offer to save a message.
- Directory/referral text is ${activeSettings.directoryReferral.enabled ? "enabled" : "disabled"}.
- Directory/referral link: ${activeSettings.directoryReferral.url || "not configured"}.
- Directory/referral wording: ${activeSettings.directoryReferral.message}

Follow-up style:
- ${activeSettings.followUpStyle}

Call outcome rules:
${activeSettings.callOutcomeRules}

Missed-call and fallback handling:
${activeSettings.fallbackRules}

Emergency handling:
- ${activeSettings.emergencyInstructions}

Pricing guidance:
- ${activeSettings.pricingNotes}

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

Google review follow-up:
- After DDD finishes a job, the follow-up text should be: ${activeSettings.reviewFollowUp.message}
- Google review link: ${activeSettings.reviewFollowUp.url}
- Do not ask for a review before service is completed.

Booking, app, and apply destinations:
${activeSettings.bookingDestinations.map((destination) => `- ${destination.label}: ${destination.url}\n  Use when: ${destination.useWhen}`).join("\n")}

DDD routing rules:
- Push callers toward the best DDD destination above instead of giving a generic booking link when one clearly fits.
- For ready-to-book roadside callers, direct them to Book roadside service.
- For stranded, locked out, flat tire, dead battery, fuel, or urgent roadside callers, direct them to Emergency service request.
- If the caller asks for a service DDD absolutely does not do, do not push a DDD booking. Offer a saved message or, when enabled, the referral/directory link instead.
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

Admin offered services:
${activeSettings.offeredServices}

Admin not-offered / do-not-promise services:
${activeSettings.notOfferedServices}

FAQs:
${business.faqs.map((faq) => `- Q: ${faq.question}\n  A: ${faq.answer}`).join("\n")}

Admin business knowledge:
${activeSettings.businessKnowledge}

Service area:
${activeSettings.serviceArea}

After-hours handling:
${activeSettings.afterHoursInstructions}

Pricing rules:
${activeSettings.pricingNotes}

Emergency call handling:
${activeSettings.emergencyInstructions}

Escalation rules:
${business.escalationRules.map((rule) => `- ${rule}`).join("\n")}

Human handoff rules:
${activeSettings.humanHandoffRules}

Quality checklist:
${activeSettings.qaChecklist}

Apply-to-work handling:
${activeSettings.applyInstructions}

Lead capture:
- Politely collect name, phone number, email if they are willing, location/service area when relevant, and reason for calling.
- For vehicle-related calls, collect vehicle year, make, model, and color.
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
            description: "Vehicle year, make, model, color, or related details, if relevant."
          },
          vehicleColor: {
            type: "string",
            description: "Vehicle color, if provided separately."
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
          vehicle: { type: "string", description: "Vehicle year, make, model, color, or related details." },
          vehicleColor: { type: "string", description: "Vehicle color, if provided separately." },
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
    emergencyQuestions: normalizeTextList(settings.emergencyQuestions, defaultEmergencyQuestions, 10, 140),
    offeredServices: cleanLongText(settings.offeredServices, defaultOfferedServices, 1400),
    notOfferedServices: cleanLongText(settings.notOfferedServices, defaultNotOfferedServices, 1400),
    directoryReferral: normalizeDirectoryReferral(settings.directoryReferral),
    afterHoursInstructions: cleanLongText(settings.afterHoursInstructions, defaultAfterHoursInstructions, 900),
    humanHandoffRules: cleanLongText(settings.humanHandoffRules, defaultHumanHandoffRules, 1200),
    callOutcomeRules: cleanLongText(settings.callOutcomeRules, defaultCallOutcomeRules, 1400),
    fallbackRules: cleanLongText(settings.fallbackRules, defaultFallbackRules, 1400),
    qaChecklist: cleanLongText(settings.qaChecklist, defaultQaChecklist, 1400),
    applyInstructions: cleanLongText(settings.applyInstructions, defaultApplyInstructions, 1200),
    smsFollowUp: normalizeSmsFollowUp(settings.smsFollowUp),
    reviewFollowUp: normalizeReviewFollowUp(settings.reviewFollowUp),
    callerFlows: normalizeCallerFlows(settings.callerFlows),
    qualifyingServices: normalizeTextList(settings.qualifyingServices, defaultQualifyingServices, 20, 80),
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
    staffAccessCodes: normalizeStaffAccessCodes(settings.staffAccessCodes || parseStaffAccessCodes(process.env.STAFF_ACCESS_CODES || "")),
    bookingDestinations: normalizeBookingDestinations(settings.bookingDestinations),
    voiceOptions
  };
}

export function normalizeStaffAccessCodes(value) {
  const source = Array.isArray(value) ? value : parseStaffAccessCodes(value);
  const seen = new Set();
  return source
    .map((entry) => ({
      name: cleanText(entry.name, "", 80),
      code: String(entry.code || "").replace(/\s+/g, "").slice(0, 32)
    }))
    .filter((entry) => entry.name && entry.code)
    .filter((entry) => {
      const key = entry.code.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

export function parseStaffAccessCodes(value) {
  const raw = String(value || "").trim();
  if (!raw) return defaultStaffAccessCodes;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to Name:Code,Name:Code format.
  }
  return raw
    .split(",")
    .map((pair) => {
      const [name, ...codeParts] = pair.split(":");
      return {
        name: String(name || "").trim(),
        code: codeParts.join(":").trim()
      };
    });
}

function normalizeBookingRecord(booking = {}) {
  const createdAt = new Date().toISOString();
  const bookingId = cleanText(booking.bookingId || booking.id, "", 80) || `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const statusToken =
    cleanText(booking.statusToken || booking.customerStatusToken, "", 120) ||
    `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const phone = normalizeE164(booking.phone || booking.customer_phone || booking.customerPhone);
  const email = cleanText(booking.email || booking.customer_email || booking.customerEmail, "", 160);
  const serviceType = cleanText(booking.serviceType || booking.service_type || booking.service || booking.reason, "Roadside Service", 120);
  const location = cleanLongText(booking.location || booking.service_address || booking.pickup_location || booking.address, "", 600);
  const vehicleColor = cleanText(booking.vehicleColor || booking.vehicle_color || booking.color || "", "", 80);
  const vehicle = cleanText(booking.vehicle || booking.vehicleInfo || "", "", 160);
  const preferredTime = cleanText(booking.preferredTime || booking.preferred_time || "ASAP", "ASAP", 120);
  const status = bookingStatuses.includes(booking.status) ? booking.status : "Requested";
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || "";
  const customerStatusUrl =
    cleanText(booking.customerStatusUrl || booking.tracking_url || booking.trackingUrl, "", 500) ||
    (publicBaseUrl && !publicBaseUrl.includes("your-domain")
      ? `${publicBaseUrl.replace(/\/$/, "")}/api/bookings/${encodeURIComponent(bookingId)}/status?token=${encodeURIComponent(statusToken)}`
      : "");

  return {
    createdAt,
    bookingId,
    statusToken,
    status,
    source: cleanText(booking.source || "ai_receptionist", "ai_receptionist", 80),
    sourceChannel: cleanText(booking.sourceChannel || booking.channel || "phone", "phone", 80),
    callId: cleanText(booking.callId || "", "", 120),
    name: cleanText(booking.name || booking.customer_name || booking.customerName, "Customer", 160),
    phone,
    email,
    serviceType,
    preferredTime,
    location,
    vehicle,
    vehicleColor,
    urgency: cleanText(booking.urgency || "normal", "normal", 40),
    reason: cleanLongText(booking.reason || serviceType, serviceType, 600),
    notes: cleanLongText(booking.notes || booking.customer_notes || booking.problem_description || booking.nextStep || "", "", 1200),
    nextStep: cleanLongText(booking.nextStep || "DDD should review and confirm the booking request.", "", 900),
    smsConsent: booking.smsConsent === true,
    customerStatusUrl,
    externalSync: { ok: false, skipped: true, reason: "Not attempted yet." }
  };
}

async function syncBookingRequest(record) {
  const url = process.env.DDD_BOOKING_WEBHOOK_URL || process.env.WORDPRESS_BOOKING_WEBHOOK_URL || "";
  if (!url) {
    return { ok: false, skipped: true, reason: "DDD_BOOKING_WEBHOOK_URL is not configured." };
  }

  const payload = buildDddBookingPayload(record);
  const headers = { "Content-Type": "application/json" };
  if (process.env.DDD_BOOKING_WEBHOOK_SECRET) {
    headers["x-ddd-ai-booking-secret"] = process.env.DDD_BOOKING_WEBHOOK_SECRET;
  }
  if (process.env.AUTOHUB_INTAKE_API_KEY) {
    headers["x-autohub-intake-key"] = process.env.AUTOHUB_INTAKE_API_KEY;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(9000)
    });
    const body = await response.json().catch(async () => ({
      raw: await response.text().catch(() => "")
    }));
    if (!response.ok) {
      return { ok: false, status: response.status, error: body.error || body.message || "DDD booking webhook failed.", body };
    }
    const jobValue = typeof body.job === "object" ? body.job?.id || body.job?.job_uuid : body.job;
    return {
      ok: true,
      status: response.status,
      jobId: body.jobId || jobValue || body.id || "",
      leadId: body.lead || body.leadId || "",
      trackingUrl: body.customer_status_url || body.tracking_url || body.trackingUrl || "",
      message: body.message || "",
      source: body.source || "ddd_booking_webhook"
    };
  } catch (error) {
    return { ok: false, error: error.message || "DDD booking webhook failed." };
  }
}

function buildDddBookingPayload(record) {
  return {
    source: "Phone call",
    lead_source: "Phone call",
    channel: "Phone call",
    external_booking_id: record.bookingId,
    customer_name: record.name,
    name: record.name,
    customer_phone: record.phone,
    phone: record.phone,
    customer_email: record.email,
    email: record.email,
    service_type: record.serviceType,
    service: record.serviceType,
    vehicle: record.vehicle,
    vehicle_color: record.vehicleColor,
    service_address: record.location,
    location: record.location,
    preferred_time: record.preferredTime,
    preferredTime: record.preferredTime,
    urgency: record.urgency,
    notes: [
      record.reason ? `Reason: ${record.reason}` : "",
      record.vehicleColor ? `Vehicle color: ${record.vehicleColor}` : "",
      record.notes ? `Notes: ${record.notes}` : "",
      record.nextStep ? `AI next step: ${record.nextStep}` : "",
      record.callId ? `OpenAI call ID: ${record.callId}` : "",
      record.smsConsent ? "Customer agreed to SMS follow-up." : "SMS consent not confirmed."
    ]
      .filter(Boolean)
      .join("\n"),
    created_at: record.createdAt
  };
}

export function buildDryRun(settings = {}, callerMessage = "") {
  const activeSettings = normalizeSettings(settings);
  const rawMessage = String(callerMessage || "").trim();
  const message = rawMessage.toLowerCase();
  const destination = chooseDestination(activeSettings.bookingDestinations, message);
  const intent = classifyIntent(message);
  const knownDetails = detectKnownDetails(message);
  const smsDestination =
    intent === "unsupported" && activeSettings.directoryReferral.enabled && activeSettings.directoryReferral.url
      ? { label: "Referral/directory", url: activeSettings.directoryReferral.url, useWhen: "Unsupported service referral." }
      : destination;
  const reflectedNeed = summarizeCallerNeed(rawMessage, intent);
  const directBookingNeed = summarizeBookableService(message);
  const baseQuestions =
    intent === "emergency"
      ? activeSettings.emergencyQuestions.slice(0, 6)
      : intent === "apply"
        ? ["What kind of DDD work are you applying for?", "What experience do you have?", "What is your best callback number and email?"]
        : intent === "unsupported"
          ? ["What service were you looking for?", "What is your name and best callback number if you want DDD to follow up?", "Can DDD text you a referral or directory link if available?"]
          : buildBookingQuestions(message);
  let questions = filterKnownQuestions(baseQuestions, knownDetails).slice(0, 6);
  const firstResponse =
    intent === "emergency"
      ? `${reflectedNeed} I'll keep this quick and can create the request for you. First, are you in a safe place right now?`
      : intent === "apply"
        ? `${reflectedNeed} I can get your info to DDD quickly. What kind of work are you applying for?`
        : intent === "unsupported"
          ? activeSettings.directoryReferral.enabled
            ? `${reflectedNeed} I can text a referral/directory link if you want.`
            : reflectedNeed.includes("save your message")
              ? reflectedNeed
              : `${reflectedNeed} I can save your message for the team.`
          : `${directBookingNeed || reflectedNeed} This will be quick, and I can make the booking for you. What is the best callback number?`;
  const action =
    intent === "apply"
      ? "Save an apply-to-work message and send the DDD apply link."
      : intent === "unsupported"
        ? "Do not book an unsupported service as a DDD job. Save a message and offer the referral/directory text if enabled."
        : "Collect only missing booking details, including vehicle color when relevant, create the booking during the call, and share/text the returned status link.";
  if (intent === "emergency") {
    questions = questions.filter((question) => !question.toLowerCase().includes("safe"));
  }
  if (/callback number/i.test(firstResponse)) {
    questions = questions.filter((question) => !/callback|phone|number/.test(question.toLowerCase()));
  }
  const bestNextLink =
    intent === "unsupported" && activeSettings.directoryReferral.enabled && activeSettings.directoryReferral.url
      ? `Referral/directory - ${activeSettings.directoryReferral.url}`
      : destination
        ? `${destination.label} - ${destination.url}`
        : "None yet. Save the message unless a referral/directory URL is configured.";
  const smsLine =
    intent === "unsupported" && !smsDestination
      ? "No referral/directory link is configured yet, so save the message instead of texting an empty link."
      : activeSettings.smsFollowUp.enabled
        ? `Ask permission, then text "${renderSmsTemplate(activeSettings.smsFollowUp.message, smsDestination, activeSettings)}"`
        : "Off";

  return {
    intent,
    destination,
    opening: activeSettings.greeting,
    firstResponse,
    action,
    bestNextLink,
    smsFollowUp: smsLine,
    likelyReply: [
      `First response: ${firstResponse}`,
      `Next questions, one at a time: ${questions.join(" | ")}`,
      `Action: ${action}`,
      `Best next link: ${bestNextLink}`,
      `SMS follow-up: ${smsLine}`,
      `Required outcome: ${activeSettings.callOutcomeRules}`,
      `Fallback if something breaks: ${activeSettings.fallbackRules}`
    ].join("\n\n"),
    questions,
    qaChecklist: activeSettings.qaChecklist
      .split(/[.;]\s+|\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12),
    note: "Free dry run. This does not place a phone call and does not use OpenAI voice minutes."
  };
}

function classifyIntent(message) {
  if (/\btow\b|\btowing\b|transmission|engine rebuild|\brebuild\b|body work|\bpaint\b|windshield|glass|impound|sell.*tire|new tire/.test(message)) {
    return "unsupported";
  }
  if (/oil change|brake|pads|battery install|maintenance|repair|mobile service/.test(message)) {
    return "booking";
  }
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

function buildBookingQuestions(message) {
  const questions = [
    "What service do you need?",
    "What is your name and best callback number?",
    "Where are you located?",
    "What is the vehicle year, make, model, and color?"
  ];
  if (/oil change|brake|pads|rotor|hub bearing|battery install/.test(message)) {
    questions.push("Do you already have the parts or materials, or do you need DDD to confirm parts?");
  }
  if (/flat|tire|spare|plug|inflation|wheel/.test(message)) {
    questions.push("Does the vehicle have a wheel lock or special key, and do you have it available?");
  }
  questions.push("What date or time works best?");
  return questions;
}

function detectKnownDetails(message) {
  return {
    service: /oil change|brake|pads|flat|tire|jump|battery|dead|fuel|gas|locked|lockout|tow|book|roadside|maintenance|repair|diagnos|apply|job|work/.test(message),
    location: /\b(at|near|by|on|in)\b.+/.test(message) || /\b\d{3,}\s+\w+/.test(message),
    vehicle: /\b(toyota|honda|ford|chevy|chevrolet|nissan|hyundai|kia|jeep|dodge|ram|bmw|mercedes|audi|lexus|camry|accord|civic|corolla|malibu|impala|altima|sonata|elantra|soul|wrangler|charger|f-?150)\b/.test(message),
    color: /\b(red|blue|black|white|gray|grey|silver|green|yellow|orange|purple|brown|tan|gold|maroon)\b/.test(message),
    phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(message),
    safe: /\b(safe|parking lot|shoulder|home|driveway|not safe|danger|highway)\b/.test(message)
  };
}

function filterKnownQuestions(questions, knownDetails) {
  return questions.filter((question) => {
    const normalized = question.toLowerCase();
    if (knownDetails.safe && normalized.includes("safe")) return false;
    if (knownDetails.service && /service|what happened|looking for/.test(normalized)) return false;
    if (knownDetails.phone && /callback|phone|number/.test(normalized)) return false;
    if (knownDetails.location && /location|cross street|located/.test(normalized)) return false;
    if (knownDetails.vehicle && knownDetails.color && /vehicle|year|make|model|color/.test(normalized)) return false;
    if (knownDetails.vehicle && /year, make, model, and color/.test(normalized)) return true;
    return true;
  });
}

function summarizeCallerNeed(rawMessage, intent) {
  const cleaned = cleanText(rawMessage, "", 180).replace(/[.!?]+$/g, "");
  if (intent === "emergency") return "I hear this is urgent.";
  if (intent === "apply") return "I can help with the DDD work application.";
  if (intent === "unsupported") {
    if (/\btow\b|\btowing\b/i.test(cleaned)) return "DDD does not offer towing, but I can save your message.";
    return "DDD may not handle that exact service.";
  }
  if (cleaned) return `I can help with ${cleaned}.`;
  return "I can help with that.";
}

function summarizeBookableService(message) {
  if (/oil change/.test(message)) return "I can help book the oil change.";
  if (/brake|pads/.test(message)) return "I can help book the brake service.";
  if (/battery install/.test(message)) return "I can help book the battery install.";
  if (/jump/.test(message)) return "I can help book the jump start.";
  if (/lockout|locked/.test(message)) return "I can help with the lockout request.";
  if (/flat|tire/.test(message)) return "I can help with the tire service request.";
  if (/fuel|gas/.test(message)) return "I can help with the fuel delivery request.";
  return "";
}

function chooseDestination(destinations, message) {
  const intent = classifyIntent(message);
  if (intent === "unsupported") return null;
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

function normalizeReviewFollowUp(value = {}) {
  return {
    enabled: value.enabled !== false,
    url: cleanText(value.url || defaultReviewFollowUpUrl, defaultReviewFollowUpUrl, 500),
    message: cleanLongText(value.message, defaultReviewFollowUpText, 500)
  };
}

function normalizeDirectoryReferral(value = {}) {
  return {
    enabled: value.enabled === true,
    url: cleanText(value.url || defaultDirectoryReferral.url, "", 500),
    message: cleanLongText(value.message, defaultDirectoryReferral.message, 500)
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
  const followUpDestination =
    type === "booking_request" && record.customerStatusUrl
      ? { label: "DDD booking status", url: record.customerStatusUrl, useWhen: "Customer booking created by the AI receptionist." }
      : destination;
  const message = renderSmsTemplate(settings.smsFollowUp.message, followUpDestination, settings);
  const delivery = await sendConfiguredSms(record.phone, message);
  await postOptionalWebhook(process.env.SMS_FOLLOWUP_WEBHOOK_URL, {
    type,
    to: record.phone,
    message,
    destination: followUpDestination,
    delivery,
    record
  });
}

function renderSmsTemplate(template, destination, settings = {}) {
  const fallbackLink = destination?.url || process.env.BOOKING_URL || "";
  const reviewLink = settings.reviewFollowUp?.url || defaultReviewFollowUpUrl;
  return String(template || defaultSmsFollowUpText)
    .replaceAll("{{link}}", fallbackLink)
    .replaceAll("{{reviewLink}}", reviewLink)
    .replaceAll("{{business}}", "DDD")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendConfiguredSms(to, message) {
  const twilioResult = await sendTwilioSms(to, message);
  if (!twilioResult.skipped) {
    await saveOutgoingSms({
      to,
      from: process.env.TWILIO_SMS_FROM || process.env.GOOGLE_VOICE_NUMBER || "",
      body: message,
      messageSid: twilioResult.sid || "",
      status: twilioResult.status || (twilioResult.ok ? "sent" : "failed"),
      agentName: "AI receptionist"
    });
    return twilioResult;
  }
  return sendVoipMsSms(to, message);
}

async function sendTwilioSms(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = normalizeE164(process.env.TWILIO_SMS_FROM || process.env.GOOGLE_VOICE_NUMBER);
  const normalizedTo = normalizeE164(to);
  if (!accountSid || !authToken || !from || !normalizedTo) {
    return { ok: false, skipped: true, reason: "Twilio SMS API is not configured." };
  }

  const body = new URLSearchParams({
    From: from,
    To: normalizedTo,
    Body: String(message || "").slice(0, 1000)
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

function normalizeE164(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function normalizeConversationPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return cleanText(value, "", 40);
}
