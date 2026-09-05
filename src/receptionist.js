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
const pushTokensPath = path.join(dataDir, "push-tokens.jsonl");
const settingsPath = path.join(dataDir, "settings.json");
const bundledSettingsPath = path.join(bundledDataDir, "settings.json");
const callCorrectionsPath = path.join(dataDir, "call-corrections.json");
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
const customerBusinessName = "Triple D Roadside";
const defaultGreeting = `Thank you for calling ${customerBusinessName}. I can help book service or get your message to the team. What can I help with today?`;
const defaultCustomInstructions =
  "Act like a polished front desk receptionist. Be warm, direct, and fast. Use Triple D Roadside only in the opening greeting so the business is pronounced correctly; after that, DDD is okay. Reflect the caller's exact request before asking questions. If they name a service like oil change, brakes, battery install, tire help, jump start, lockout, or fuel delivery, treat it as a bookable DDD service immediately. For oil changes, brakes, rotors, hub bearings, and battery installs, ask whether the customer already has the parts/materials or needs DDD to confirm parts. For brake, rotor, tire replacement, tire plug, or spare tire calls, ask quantity/position only if they have not already said it: one wheel, front axle, rear axle, both axles/all four, or spare/tire-specific need. Accept what the customer says and use it for the booking notes and rough starting-price math when possible. For tire-related work, ask whether the vehicle has a wheel lock/special key and whether they have it available. Reassure them once that this will be quick and that you can make the booking for them when booking applies. If callers ask how they can pay, say DDD accepts cash, card, tap pay, and installments, but does not accept checks. Do not ask generic category questions after they already named the service. Do not repeat that reassurance. Do not keep emergency callers on the phone longer than needed. Collect the key details, point them to the right DDD link, and save a clear next step.";
const defaultBusinessKnowledge =
  "DDD Mobile is a woman-owned Cincinnati mobile roadside and light mobile maintenance service. DDD helps with jump starts, battery installs, lockouts, fuel delivery, tire inflation, tire plugs, spare tire changes, oil change requests, brake pads, rotors, bolt-in hub bearing requests, light mobile maintenance, DDD Mobile app/status help, DDD Auto Doc vehicle guidance, booking help, existing booking messages, and apply-to-work questions. DDD does not tow. Accepted payment methods are cash, card, tap pay, and installments. No checks. Use dddcincy.com links only for DDD Mobile, DDD Mobile app/status, DDD Auto Doc, roadside service booking, emergency service requests, shop roadside services, and apply-to-work requests. The receptionist should push callers toward booking/status/apply quickly instead of holding long conversations. If pricing, exact availability, or service-area details are unknown, collect details and say the DDD team will confirm.";
const defaultServiceArea = "Greater Cincinnati, Liberty Township, Northern Kentucky, and nearby tri-state areas DDD confirms case by case.";
const defaultPricingNotes =
  "Public starting points only, not final quotes: standard service fee $25, gas by the gallon $10, 5-gallon fuel refill $35, tire inflation $15, tire plug $20, spare tire change $50, battery jump-start $30, battery installation $40, door unlock $40, oil change labor $25 when customer provides oil/filter, brake pads $50 per axle or listed per-wheel/all-wheel options, rotor add-on +$20 per axle, rotor replacement only $50 per axle, full brake pad replacement four wheels $200, brake and rotor all wheels $280, bolt-in hub bearing $200 per axle. For brakes/rotors/tires, confirm quantity or position before giving a starting estimate. Accepted payment methods: cash, card, tap pay, and installments. No checks. Say DDD will confirm final price before service.";
const defaultEmergencyInstructions =
  "For stranded or urgent roadside callers, be extremely brief. Ask if they are safe, get exact location, vehicle year/make/model/color, what happened, callback number, and whether they can receive a text. Then direct them to the emergency service request option and save the lead.";
const defaultHumanHandoffRules =
  "If human routing is on, route callers to the saved DDD human numbers when they ask for a person, when AI is paused, or when the call cannot be handled safely by AI. If no human answers, save the caller's details and tell them DDD will follow up as soon as possible.";
const defaultApplyInstructions =
  "For work, contractor, technician, or job-interest calls, collect name, phone, email, role or service type, experience, and location, then direct them to the DDD apply to work link.";
const defaultSmsFollowUpText =
  "Thanks for calling {{business}}. Your request was received: {{link}}. Add photos if needed: {{photoUploadLink}}. iPhone users: open DDD Mobile and log in with this phone number. Non-iPhone users: log in at {{webLoginLink}}. Reply here if anything changes. Reply STOP to stop.";
const defaultReviewFollowUpUrl = "https://g.page/r/CfVinSqxHOIDEAE/review";
const defaultReviewFollowUpText =
  "Thanks again for choosing DDD. If everything went well, please leave a quick Google review here: {{reviewLink}}";
const defaultVoiceDirection =
  "Warm, confident, friendly receptionist. Natural phone cadence, clear pronunciation, and not robotic.";
const defaultCallerFlows = {
  newClients:
    "If they already named the service, do not re-qualify it. Tell them this will be quick and that you can make the booking for them. Then collect name, callback number, location, vehicle details if relevant, parts/materials status for oil/brakes/rotors/hub/battery jobs, wheel-lock/special-key status for tire jobs, and preferred time. End by saving a lead or booking request and texting or queueing the best DDD link.",
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
  "For every call, end with one clear outcome: booking created, lead/message saved, best DDD link texted or queued, apply-to-work info captured, existing job message captured, sales message captured, spam/irrelevant declined, or human follow-up needed. Do not leave the caller unsure what happens next. Do not read long URLs out loud.";
const defaultFallbackRules =
  "If the AI cannot hear the caller, the caller is upset, the caller requests a human twice, the call is urgent and details are incomplete, booking sync fails, or the call drops before intake is complete, save a missed/fallback lead with caller ID if available and mark the next step as urgent human follow-up.";
const defaultComplaintInstructions =
  "If the caller is complaining, upset about a job, requesting a refund, reporting damage, or escalating a problem, stay calm, apologize once, collect name, callback number, job/service details, what happened, and desired resolution. Save it as high priority or emergency if safety-related. Tell them DDD can also be reached at support@dddcincy.com. If SMS is allowed, text the support email/link instead of reading a long link.";
const defaultQaChecklist =
  "QA should confirm: AI answered, caller intent identified, name/phone captured when possible, emergency callers were handled quickly, booking or lead was saved, correct DDD link was selected, SMS consent was asked before texting, transcript/recording was attached when available, and call ended with a clear next step.";
const defaultSoundPreferences = {
  ambientSound: "none",
  thinkingSound: true,
  thinkingPhrase: "One moment while I get that into the request.",
  backgroundAudio: {
    enabled: false,
    label: "None",
    url: ""
  }
};
const defaultNoiseHandling = {
  mode: "patient",
  eagerness: "low",
  interruptResponse: false,
  notes:
    "Let the receptionist finish short statements before listening. Ignore tiny background noises, road noise, breathing, and quick filler sounds unless the caller is clearly speaking. Be patient with elderly callers, strong accents, dialect differences, speech delays, and people whose first language is not English. If a caller uses Spanish or another language, keep the call simple, ask whether English is okay, and continue in the caller's language when you can."
};
const defaultNotificationPreferences = {
  newCalls: true,
  missedCalls: true,
  bookings: true,
  texts: true,
  qaIssues: true,
  dailySummary: true,
  weeklySummary: true,
  monthlySummary: true
};
const defaultInsightLearning = {
  enabled: true,
  useTopServices: true,
  useTopLocations: true,
  useQaIssues: true,
  useSpeedSuggestions: true
};
const defaultHumanRouting = {
  mode: "ai_then_humans",
  numbers: [],
  ringStyle: "simultaneous",
  timeoutSeconds: 22,
  callerMessage: "Please hold while I connect you with DDD.",
  fallbackMessage: "DDD could not reach the team live, but your call was logged. Please leave a message or text DDD and the team will follow up.",
  transferTriggers: [
    "Caller asks for a person twice",
    "Caller is upset or complaint is high priority",
    "AI cannot hear or understand the caller",
    "Urgent roadside call has incomplete safety or location details",
    "AI is turned off in admin"
  ]
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
  },
  {
    label: "DDD support email",
    url: "mailto:support@dddcincy.com",
    useWhen: "Caller has a complaint, refund concern, damage report, bad experience, billing issue, or wants management/support follow-up."
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
        noiseHandling: next.noiseHandling,
        notificationPreferences: next.notificationPreferences,
        insightLearning: next.insightLearning,
        humanRouting: next.humanRouting,
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
  record.confidence = calculateBookingConfidence(record);
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

async function readJsonObject(filePath, fallback = {}) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
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
  const records = await listRecords(bookingsPath, limit);
  return records.map((booking) => ({ ...booking, confidence: booking.confidence || calculateBookingConfidence(booking) }));
}

export async function buildBusinessInsights() {
  const [callLog, leads, bookings, sms] = await Promise.all([listCallLog(1000), listLeads(1000), listBookings(1000), listSms(1000)]);
  const generatedAt = new Date();
  const windows = [
    makeInsightWindow("Today", "day", generatedAt, 1),
    makeInsightWindow("Yesterday", "day", generatedAt, 1, 1),
    makeInsightWindow("This week", "week", generatedAt, 7),
    makeInsightWindow("Last week", "week", generatedAt, 7, 7),
    makeInsightWindow("This month", "month", generatedAt, 30),
    makeInsightWindow("Last month", "month", generatedAt, 30, 30)
  ];
  const sections = {
    daily: summarizeInsightPeriod(windows[0], windows[1], { callLog, leads, bookings, sms }),
    weekly: summarizeInsightPeriod(windows[2], windows[3], { callLog, leads, bookings, sms }),
    monthly: summarizeInsightPeriod(windows[4], windows[5], { callLog, leads, bookings, sms })
  };
  sections.latestActiveDay = sections.daily.calls || sections.daily.bookings || sections.daily.leads
    ? sections.daily
    : summarizeLatestActiveDay(generatedAt, { callLog, leads, bookings, sms });
  return {
    ok: true,
    generatedAt: generatedAt.toISOString(),
    sections,
    suggestions: buildInsightSuggestions(sections),
    highlights: buildInsightHighlights(sections)
  };
}

function summarizeLatestActiveDay(now, records) {
  for (let offset = 1; offset <= 30; offset += 1) {
    const currentWindow = makeInsightWindow(`Latest active day (${offset === 1 ? "yesterday" : `${offset} days ago`})`, "day", now, 1, offset);
    const previousWindow = makeInsightWindow("Previous active comparison", "day", now, 1, offset + 1);
    const summary = summarizeInsightPeriod(currentWindow, previousWindow, records);
    if (summary.calls || summary.bookings || summary.leads) {
      return summary;
    }
  }
  return {
    ...summarizeInsightPeriod(makeInsightWindow("Latest active day", "day", now, 1), makeInsightWindow("Previous active comparison", "day", now, 1, 1), records),
    label: "No activity yet"
  };
}

export async function listCallLog(limit = 50) {
  const [calls, summaries, leads, bookings, sms] = await Promise.all([
    listRecords(callsPath, 1000),
    listRecords(summariesPath, 1000),
    listRecords(leadsPath, 1000),
    listRecords(bookingsPath, 1000),
    listRecords(smsPath, 1000)
  ]);
  const corrections = await readJsonObject(callCorrectionsPath, {});
  const callsByCall = groupByCallId(calls);
  const summariesByCall = groupByCallId(summaries);
  const leadsByCall = groupByCallId(leads);
  const bookingsByCall = groupByCallId(bookings);
  return [...callsByCall.entries()]
    .map(([callId, events]) => {
      const sortedEvents = events.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const firstEvent = sortedEvents[0] || {};
      const latestEvent = sortedEvents[sortedEvents.length - 1] || firstEvent;
      const relatedSummaries = summariesByCall.get(callId) || [];
      const relatedLeads = leadsByCall.get(callId) || [];
      const relatedBookings = bookingsByCall.get(callId) || [];
      const summary = relatedSummaries[0] || {};
      const transcript = relatedSummaries.flatMap((item) => normalizeTranscript(item.transcript));
      const caller = firstTruthy(
        latestEvent.from,
        firstEvent.from,
        extractSipHeader(latestEvent.sipHeaders, "from"),
        extractSipHeader(firstEvent.sipHeaders, "from"),
        relatedBookings[0]?.phone,
        relatedLeads[0]?.phone
      );
      const destination = firstTruthy(
        latestEvent.to,
        firstEvent.to,
        extractSipHeader(latestEvent.sipHeaders, "to"),
        extractSipHeader(firstEvent.sipHeaders, "to")
      );
      const relatedSms = findRelatedSms(sms, caller, summary.startedAt || firstEvent.createdAt, summary.endedAt || latestEvent.createdAt);
      const durationSeconds = getCallDurationSeconds(sortedEvents, summary);
      const finalStatus = firstTruthy(latestEvent.status, firstEvent.status, summary.endedAt ? "completed" : "logged");
      const outcome = summarizeCallOutcome({ status: finalStatus, transcript, relatedLeads, relatedBookings, relatedSms, durationSeconds });
      const id = callId || `${firstEvent.createdAt || "call"}-${firstEvent.type || "event"}`;
      const correction = corrections[id] || null;
      const displayStatus = correction?.outcomeTag ? getCorrectionDisplayStatus(correction.outcomeTag) : getCallDisplayStatus(finalStatus, outcome, relatedBookings, relatedLeads);
      return {
        id,
        callId,
        createdAt: firstEvent.createdAt,
        startedAt: summary.startedAt || firstEvent.createdAt,
        endedAt: summary.endedAt || latestEvent.createdAt || "",
        type: latestEvent.type || firstEvent.type || "call",
        caller,
        destination,
        status: finalStatus,
        displayStatus,
        statusEvents: sortedEvents.map((event) => ({
          at: event.createdAt,
          type: event.type,
          status: event.status || "",
          displayStatus: getCleanStatusLabel(event.status || event.type || ""),
          durationSeconds: event.durationSeconds || 0
        })),
        durationSeconds,
        durationLabel: formatDuration(durationSeconds),
        recordingUrl: firstTruthy(
          ...sortedEvents.map((event) => firstTruthy(event.recordingUrl, event.recording_url)),
          summary.recordingUrl,
          summary.recording_url
        ),
        recordingStatus: sortedEvents.some((event) => firstTruthy(event.recordingUrl, event.recording_url))
          ? "available"
          : "none",
        smsStatus: summarizeSmsStatus(relatedSms),
        outcome,
        correction,
        completion: correction ? correctedCompletion(correction.outcomeTag, outcome.completion) : outcome.completion,
        transcript,
        transcriptText: transcript.map((item) => item.text).filter(Boolean).join("\n"),
        leads: relatedLeads,
        bookings: relatedBookings,
        sms: relatedSms,
        summaries: relatedSummaries
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

function correctedCompletion(tag, fallback = "needs-review") {
  if (tag === "booked" || tag === "lead" || tag === "apply") return "complete";
  if (tag === "missed" || tag === "incomplete") return "incomplete";
  return fallback;
}

function getCorrectionDisplayStatus(tag = "") {
  const labels = {
    booked: "Booked",
    lead: "Lead saved",
    missed: "Missed",
    incomplete: "Incomplete",
    spam: "Spam",
    sales: "Sales",
    apply: "Apply to work",
    complaint: "Complaint",
    unsupported: "Unsupported",
    "follow-up": "Needs follow-up"
  };
  return labels[tag] || "Needs follow-up";
}

function makeInsightWindow(label, key, now, days, offsetDays = 0) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - offsetDays);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { label, key, start: start.toISOString(), end: end.toISOString() };
}

function summarizeInsightPeriod(currentWindow, previousWindow, records) {
  const current = summarizeInsightWindow(currentWindow, records);
  const previous = summarizeInsightWindow(previousWindow, records);
  return {
    ...current,
    previous,
    changes: {
      calls: compareNumbers(current.calls, previous.calls),
      bookings: compareNumbers(current.bookings, previous.bookings),
      leads: compareNumbers(current.leads, previous.leads),
      missed: compareNumbers(current.missed, previous.missed),
      smsSent: compareNumbers(current.smsSent, previous.smsSent),
      averageDurationSeconds: compareNumbers(current.averageDurationSeconds, previous.averageDurationSeconds)
    },
    changed: buildChangedList(current, previous)
  };
}

function summarizeInsightWindow(window, records) {
  const calls = records.callLog.filter((call) => isWithinWindow(call.startedAt || call.createdAt, window));
  const leads = records.leads.filter((lead) => isWithinWindow(lead.createdAt, window));
  const bookings = records.bookings.filter((booking) => isWithinWindow(booking.createdAt, window));
  const sms = records.sms.filter((message) => isWithinWindow(message.createdAt, window));
  const completed = calls.filter((call) => call.completion === "complete").length;
  const missed = calls.filter((call) => call.completion === "incomplete" || /busy|missed|failed|no-answer|canceled|cancelled/i.test(call.status || "")).length;
  const needsReview = calls.filter((call) => call.completion === "needs-review").length;
  const outboundSms = sms.filter((message) => String(message.direction || "").toLowerCase() === "outbound").length;
  const capturedPeople = bookings.length + leads.length;
  const durations = calls.map((call) => Number(call.durationSeconds || 0)).filter((seconds) => seconds > 0);
  const transcriptText = calls.map((call) => call.transcriptText || "").filter(Boolean).join("\n").slice(0, 20000);
  const serviceCounts = countTopValues([
    ...bookings.map((booking) => booking.serviceType || booking.reason),
    ...leads.map((lead) => lead.serviceType || lead.reason),
    ...calls.map((call) => inferServiceFromText(`${call.transcriptText || ""}\n${call.outcome?.detail || ""}`))
  ]);
  const locationCounts = countTopValues([
    ...bookings.map((booking) => booking.location),
    ...leads.map((lead) => lead.location),
    ...calls.map((call) => inferLocationFromText(call.transcriptText || ""))
  ]);
  const callerTypes = countTopValues(calls.map(classifyCallerType));
  const commonQuestions = countTopValues(extractCommonQuestions(transcriptText));
  return {
    label: window.label,
    key: window.key,
    start: window.start,
    end: window.end,
    calls: calls.length,
    bookings: bookings.length,
    leads: leads.length,
    completed,
    missed,
    needsReview,
    bookingRate: calls.length ? Math.round((bookings.length / calls.length) * 100) : 0,
    completionRate: calls.length ? Math.round((completed / calls.length) * 100) : 0,
    smsCoverageRate: capturedPeople ? Math.min(100, Math.round((outboundSms / capturedPeople) * 100)) : 0,
    smsSent: outboundSms,
    smsReceived: sms.filter((message) => String(message.direction || "").toLowerCase() === "inbound").length,
    recordings: calls.filter((call) => call.recordingUrl).length,
    transcripts: calls.filter((call) => call.transcriptText).length,
    averageDurationSeconds: durations.length ? Math.round(durations.reduce((sum, seconds) => sum + seconds, 0) / durations.length) : 0,
    topServices: serviceCounts,
    topLocations: locationCounts,
    callerTypes,
    commonQuestions,
    recentCalls: calls.slice(0, 8).map((call) => ({
      at: call.startedAt || call.createdAt || "",
      caller: call.caller || "",
      outcome: call.outcome?.label || call.status || "Logged",
      service: call.bookings?.[0]?.serviceType || call.leads?.[0]?.serviceType || inferServiceFromText(call.transcriptText || ""),
      location: call.bookings?.[0]?.location || call.leads?.[0]?.location || inferLocationFromText(call.transcriptText || ""),
      smsStatus: call.smsStatus || "none",
      durationLabel: call.durationLabel || ""
    }))
  };
}

function isWithinWindow(value, window) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return false;
  return time >= Date.parse(window.start) && time <= Date.parse(window.end);
}

function compareNumbers(current, previous) {
  const difference = current - previous;
  const percent = previous > 0 ? Math.round((difference / previous) * 100) : current > 0 ? 100 : 0;
  return { current, previous, difference, percent };
}

function buildChangedList(current, previous) {
  const changes = [];
  addChange(changes, "Calls", current.calls, previous.calls);
  addChange(changes, "Bookings", current.bookings, previous.bookings);
  addChange(changes, "Missed / incomplete calls", current.missed, previous.missed);
  addChange(changes, "Average call length", current.averageDurationSeconds, previous.averageDurationSeconds, "seconds");
  const currentTopService = current.topServices[0]?.label || "";
  const previousTopService = previous.topServices[0]?.label || "";
  if (currentTopService && currentTopService !== previousTopService) {
    changes.push(`Top service changed from ${previousTopService || "none"} to ${currentTopService}.`);
  }
  const currentTopLocation = current.topLocations[0]?.label || "";
  const previousTopLocation = previous.topLocations[0]?.label || "";
  if (currentTopLocation && currentTopLocation !== previousTopLocation) {
    changes.push(`Top location changed from ${previousTopLocation || "none"} to ${currentTopLocation}.`);
  }
  if (!changes.length) changes.push("No major movement compared with the previous period yet.");
  return changes.slice(0, 6);
}

function addChange(changes, label, current, previous, suffix = "") {
  const delta = current - previous;
  if (!delta) return;
  const direction = delta > 0 ? "up" : "down";
  const unit = suffix ? ` ${suffix}` : "";
  changes.push(`${label} ${direction} ${Math.abs(delta)}${unit} (${previous} to ${current}).`);
}

function buildInsightSuggestions(sections) {
  const suggestions = [];
  const daily = sections.daily;
  const weekly = sections.weekly;
  const monthly = sections.monthly;
  if (daily.missed > 0) suggestions.push(`Review ${daily.missed} missed/incomplete call${daily.missed === 1 ? "" : "s"} from today and text those callers first.`);
  if (daily.calls > 0 && daily.bookings === 0) suggestions.push("Today has calls but no saved bookings yet, so check transcripts for any intake flow friction.");
  if (daily.smsSent < daily.bookings + daily.leads) suggestions.push("Some captured callers may not have an outbound SMS attached. Confirm follow-up texts are sending.");
  if (weekly.topServices[0]) suggestions.push(`This week's hottest request is ${weekly.topServices[0].label}. Keep that service quick in the AI flow and easy to book.`);
  if (weekly.topLocations[0]) suggestions.push(`Calls are clustering around ${weekly.topLocations[0].label}. Consider mentioning coverage/ETA confidence for that area.`);
  if (weekly.averageDurationSeconds > 180) suggestions.push("Average calls are over 3 minutes. Shorten the script or move more details into the follow-up text.");
  if (weekly.changed.some((change) => /Missed/.test(change) && /up/.test(change))) suggestions.push("Missed calls increased this week. Check forwarding, business hours, and fallback SMS.");
  if (monthly.calls > weekly.calls * 3 && monthly.bookings < weekly.bookings * 2) suggestions.push("Monthly calls are outpacing booking growth. Review sales/unsupported callers and tighten booking prompts.");
  if (!suggestions.length) suggestions.push("No urgent changes found. Keep watching call reasons, missed calls, SMS delivery, and booking conversion.");
  return suggestions.slice(0, 8);
}

function buildInsightHighlights(sections) {
  return [
    { label: "Today calls", value: sections.daily.calls, change: sections.daily.changes.calls },
    { label: "Today bookings", value: sections.daily.bookings, change: sections.daily.changes.bookings },
    { label: "Week calls", value: sections.weekly.calls, change: sections.weekly.changes.calls },
    { label: "Month calls", value: sections.monthly.calls, change: sections.monthly.changes.calls }
  ];
}

function countTopValues(values, limit = 6) {
  const counts = new Map();
  for (const rawValue of values) {
    const value = cleanInsightLabel(rawValue);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function dedupeTextValues(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanInsightLabel(value) {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^customer$/i, "")
    .trim()
    .slice(0, 80);
  const lower = cleaned.toLowerCase();
  const canonical = {
    "oil change": "Oil change",
    "roadside help": "Roadside service",
    "roadside service": "Roadside service",
    "brakes / rotors": "Brakes / rotors",
    "tire / flat": "Tire / flat",
    "jump start / battery": "Jump start / battery",
    lockout: "Lockout",
    "fuel delivery": "Fuel delivery",
    "hub bearing": "Hub bearing",
    "apply to work": "Apply to work",
    "existing appointment": "Existing appointment",
    "unsupported service": "Unsupported service",
    "potential customer": "Potential customer",
    "existing customer": "Existing customer",
    sales: "Sales",
    other: "Other"
  };
  return canonical[lower] || cleaned;
}

function classifyCallerType(call) {
  const text = `${call.transcriptText || ""} ${call.bookings?.[0]?.serviceType || ""} ${call.leads?.[0]?.reason || ""}`.toLowerCase();
  if (/apply|job|work|technician|contractor/.test(text)) return "Apply to work";
  if (/appointment|booking|already|existing|change|status/.test(text)) return "Existing customer";
  if (/price|quote|cost|how much|service|flat|jump|battery|lockout|fuel|gas|brake|rotor|oil|tire/.test(text)) return "Potential customer";
  if (/sell|marketing|vendor|partnership/.test(text)) return "Sales";
  return "Other";
}

function inferServiceFromText(text = "") {
  const value = String(text).toLowerCase();
  const services = [
    ["Tire / flat", /flat|tire|spare|plug|wheel lock|inflation/],
    ["Jump start / battery", /jump|battery|dead battery/],
    ["Lockout", /lockout|locked out|unlock|door unlock/],
    ["Fuel delivery", /fuel|gas|out of gas/],
    ["Oil change", /oil change|oil\/filter/],
    ["Brakes / rotors", /brake|rotor/],
    ["Hub bearing", /hub|bearing/],
    ["Apply to work", /apply|job|work|technician|contractor/],
    ["Existing appointment", /appointment|booking|reschedule|status/],
    ["Unsupported service", /tow|towing|transmission|engine rebuild|body work|windshield/]
  ];
  return services.find(([, pattern]) => pattern.test(value))?.[0] || "";
}

function inferLocationFromText(text = "") {
  const value = String(text).toLowerCase();
  const known = [
    "Liberty Township",
    "Cincinnati",
    "Northern Kentucky",
    "Hamilton",
    "Middletown",
    "West Chester",
    "Fairfield",
    "Mason",
    "Blue Ash",
    "Sharonville",
    "Covington",
    "Newport",
    "Florence"
  ];
  return known.find((place) => value.includes(place.toLowerCase())) || "";
}

function extractCommonQuestions(text = "") {
  return String(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.includes("?") && line.replace(/[?\s]/g, "").length > 8)
    .map((line) => line.replace(/^(caller|ai|call)\s*[:\-]\s*/i, "").slice(0, 100))
    .slice(0, 40);
}

export async function listBookingsByPhone(phone, limit = 20) {
  const target = normalizeE164(phone);
  if (!target) return [];
  const records = await listRecords(bookingsPath, 1000);
  return records
    .filter((booking) => normalizeE164(booking.phone || booking.customer_phone) === target)
    .map((booking) => ({ ...booking, confidence: booking.confidence || calculateBookingConfidence(booking) }))
    .slice(0, limit);
}

export async function getCustomerHistory(phone, limit = 8) {
  const target = normalizeE164(phone);
  if (!target) return { phone: "", returningCustomer: false, bookings: [], knownVehicles: [], lastOilService: null };
  const [localBookings, platformHistory] = await Promise.all([
    listBookingsByPhone(target, limit),
    fetchDddCustomerHistory(target, limit)
  ]);
  const bookings = mergeCustomerBookings(localBookings, platformHistory.bookings).slice(0, limit);
  const knownVehicles = dedupeTextValues(
    [
      ...bookings.map((booking) => [booking.vehicle, booking.vehicleColor].filter(Boolean).join(" ").trim()).filter(Boolean),
      ...platformHistory.knownVehicles
    ]
  ).slice(0, 5);
  const lastOilService = bookings.find((booking) =>
    /oil/i.test(`${booking.serviceType || ""} ${booking.reason || ""} ${booking.notes || ""}`)
  ) || null;
  return {
    phone: target,
    returningCustomer: bookings.length > 0,
    source: platformHistory.bookings.length ? "ddd-platform-and-ai" : "ai-dispatch",
    bookings: bookings.map((booking) => ({
      createdAt: booking.createdAt,
      name: booking.name,
      serviceType: booking.serviceType,
      vehicle: booking.vehicle,
      vehicleColor: booking.vehicleColor,
      location: booking.location,
      preferredTime: booking.preferredTime,
      notes: booking.notes,
      oilType: booking.oilType,
      oilQuantity: booking.oilQuantity,
      partsStatus: booking.partsStatus,
      status: booking.status,
      confidence: booking.confidence
    })),
    knownVehicles,
    lastOilService: lastOilService
      ? {
          createdAt: lastOilService.createdAt,
          vehicle: lastOilService.vehicle,
          vehicleColor: lastOilService.vehicleColor,
          notes: lastOilService.notes,
          serviceType: lastOilService.serviceType
        }
      : null
  };
}

async function fetchDddCustomerHistory(phone, limit) {
  const url = String(process.env.DDD_CUSTOMER_HISTORY_URL || "").trim();
  if (!url) return { bookings: [], knownVehicles: [] };
  const headers = { Accept: "application/json" };
  if (process.env.DDD_TECH_TEAM_TOKEN) headers["X-DDD-Tech-Token"] = process.env.DDD_TECH_TEAM_TOKEN;
  if (process.env.CUSTOMER_LOOKUP_SECRET) headers["X-DDD-Customer-Lookup-Secret"] = process.env.CUSTOMER_LOOKUP_SECRET;
  try {
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("phone", phone);
    requestUrl.searchParams.set("limit", String(Math.min(20, Math.max(1, Number(limit) || 8))));
    const response = await fetch(requestUrl, { headers, signal: AbortSignal.timeout(6000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { bookings: [], knownVehicles: [] };
    const records = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.bookings)
        ? payload.bookings
        : Array.isArray(payload.jobs)
          ? payload.jobs
          : Array.isArray(payload.data)
            ? payload.data
            : [];
    return {
      bookings: records.map(normalizeHistoryBooking).filter((booking) => booking.serviceType || booking.vehicle || booking.notes),
      knownVehicles: dedupeTextValues([
        ...(Array.isArray(payload.knownVehicles) ? payload.knownVehicles : []),
        ...(Array.isArray(payload.vehicles) ? payload.vehicles : []).map((vehicle) =>
          [vehicle.year, vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(" ")
        )
      ])
    };
  } catch {
    return { bookings: [], knownVehicles: [] };
  }
}

function mergeCustomerBookings(localBookings = [], platformBookings = []) {
  const seen = new Set();
  return [...platformBookings, ...localBookings].filter((booking) => {
    const key = [booking.bookingId || booking.id || "", booking.createdAt || "", booking.serviceType || "", booking.vehicle || ""].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeHistoryBooking(booking = {}) {
  return {
    bookingId: cleanText(booking.bookingId || booking.id || booking.job_uuid || booking.job || "", "", 120),
    createdAt: cleanText(booking.createdAt || booking.created_at || booking.submitted_at || booking.updated_at || "", "", 80),
    name: cleanText(booking.name || booking.customer_name || booking.customerName || "", "", 160),
    serviceType: cleanText(booking.serviceType || booking.service_type || booking.service || booking.reason || "", "", 120),
    vehicle: cleanText(booking.vehicle || booking.vehicleInfo || [booking.vehicle_year, booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(" "), "", 180),
    vehicleColor: cleanText(booking.vehicleColor || booking.vehicle_color || booking.color || "", "", 80),
    location: cleanLongText(booking.location || booking.service_address || booking.pickup_location || booking.address || "", "", 600),
    preferredTime: cleanText(booking.preferredTime || booking.preferred_time || booking.eta || "", "", 120),
    notes: cleanLongText(booking.notes || booking.customer_notes || booking.admin_notes || booking.problem_description || "", "", 1200),
    oilType: cleanText(booking.oilType || booking.oil_type || "", "", 80),
    oilQuantity: cleanText(booking.oilQuantity || booking.oil_capacity || booking.oil_quantity || "", "", 80),
    partsStatus: cleanText(booking.partsStatus || booking.parts_status || "", "", 160),
    status: cleanText(booking.status || "", "", 80),
    source: "ddd-platform"
  };
}

export async function getBookingStatus(bookingId, token) {
  if (!bookingId || !token) return null;
  const records = await listRecords(bookingsPath, 1000);
  const booking = records.find((item) => item.bookingId === bookingId && item.statusToken === token) || null;
  return booking ? { ...booking, confidence: booking.confidence || calculateBookingConfidence(booking) } : null;
}

export async function updateCallCorrection(callId, correction = {}) {
  const id = cleanText(callId, "", 160);
  if (!id) return null;
  const allowedOutcomes = new Set(["booked", "lead", "missed", "incomplete", "spam", "sales", "apply", "complaint", "unsupported", "follow-up"]);
  const record = {
    callId: id,
    updatedAt: new Date().toISOString(),
    outcomeTag: allowedOutcomes.has(correction.outcomeTag) ? correction.outcomeTag : "follow-up",
    note: cleanLongText(correction.note || "", "", 500),
    updatedBy: cleanText(correction.updatedBy || "DDD admin", "DDD admin", 120)
  };
  await ensureDataDir();
  const corrections = await readJsonObject(callCorrectionsPath, {});
  corrections[id] = record;
  await fs.writeFile(callCorrectionsPath, JSON.stringify(corrections, null, 2));
  return record;
}

export async function updateBookingLocation(bookingId, token, locationUpdate = {}) {
  if (!bookingId || !token) return null;
  await ensureDataDir();
  const records = await listRecords(bookingsPath, 5000);
  const index = records.findIndex((booking) => booking.bookingId === bookingId && booking.statusToken === token);
  if (index < 0) return null;
  const existing = records[index];
  const next = {
    ...existing,
    location: cleanLongText(locationUpdate.location || existing.location, existing.location || "", 700),
    latitude: cleanText(locationUpdate.latitude || locationUpdate.lat || existing.latitude || "", "", 80),
    longitude: cleanText(locationUpdate.longitude || locationUpdate.lng || existing.longitude || "", "", 80),
    locationConfirmedAt: new Date().toISOString(),
    locationSource: cleanText(locationUpdate.source || "customer_location_page", "customer_location_page", 80)
  };
  next.confidence = calculateBookingConfidence(next);
  records[index] = next;
  await fs.writeFile(bookingsPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return next;
}

export async function addBookingPhotos(bookingId, token, uploads = []) {
  if (!bookingId || !token || !Array.isArray(uploads)) return null;
  await ensureDataDir();
  const records = await listRecords(bookingsPath, 5000);
  const index = records.findIndex((booking) => booking.bookingId === bookingId && booking.statusToken === token);
  if (index < 0) return null;
  const existing = records[index];
  const currentPhotos = Array.isArray(existing.photos) ? existing.photos : [];
  const nextPhotos = [...currentPhotos, ...uploads]
    .filter((photo) => photo && photo.url)
    .slice(-30);
  const next = {
    ...existing,
    photos: nextPhotos,
    photoCount: nextPhotos.length,
    photosUpdatedAt: new Date().toISOString()
  };
  next.confidence = calculateBookingConfidence(next);
  records[index] = next;
  await fs.writeFile(bookingsPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  return next;
}

export async function saveCallEvent(event) {
  const from = extractSipHeader(event.data?.sip_headers || [], "from");
  const to = extractSipHeader(event.data?.sip_headers || [], "to");
  const record = {
    createdAt: new Date().toISOString(),
    type: event.type,
    callId: event.data?.call_id,
    from: normalizeE164(from) || from,
    to: normalizeE164(to) || to,
    status: cleanText(event.data?.status || event.data?.call_status || "", "", 80),
    durationSeconds: Number(event.data?.durationSeconds || event.data?.duration_seconds || event.data?.CallDuration || 0) || 0,
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
    agentName: cleanText(message.agentName || "DDD team", "DDD team", 80),
    source: cleanText(message.source || "", "", 80),
    reason: cleanText(message.reason || "", "", 160)
  };
  await ensureDataDir();
  await fs.appendFile(smsPath, `${JSON.stringify(record)}\n`);
  return record;
}

export async function listSms(limit = 50) {
  return listRecords(smsPath, limit);
}

export async function savePushToken(subscription = {}) {
  const token = cleanText(subscription.token, "", 180);
  const webSubscription = subscription.subscription && typeof subscription.subscription === "object" ? subscription.subscription : null;
  const endpoint = cleanLongText(webSubscription?.endpoint || "", "", 900);
  const isExpoToken = /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
  const isWebPush =
    /^https:\/\/[^.\s]+(\.[^/\s]+)+\/.+/.test(endpoint) &&
    !/^https:\/\/example\.com\//i.test(endpoint) &&
    webSubscription?.keys?.p256dh &&
    webSubscription?.keys?.auth;
  if (!isExpoToken && !isWebPush) {
    throw new Error("Enter a valid push token or browser notification subscription.");
  }

  const existing = await listPushTokens(1000);
  const record = {
    createdAt: new Date().toISOString(),
    token: isExpoToken ? token : "",
    subscription: isWebPush
      ? {
          endpoint,
          expirationTime: webSubscription.expirationTime || null,
          keys: {
            p256dh: cleanLongText(webSubscription.keys.p256dh, "", 400),
            auth: cleanLongText(webSubscription.keys.auth, "", 200)
          }
        }
      : null,
    platform: cleanText(subscription.platform, "", 40),
    staffName: cleanText(subscription.staffName, "DDD team", 80),
    staffRole: cleanText(subscription.staffRole, "staff", 40),
    staffPhone: normalizeE164(subscription.staffPhone || ""),
    enabled: subscription.enabled !== false
  };
  const identity = record.token || record.subscription?.endpoint || "";
  const withoutToken = existing.filter((item) => (item.token || item.subscription?.endpoint || "") !== identity);
  await ensureDataDir();
  await fs.writeFile(pushTokensPath, `${[record, ...withoutToken].map((item) => JSON.stringify(item)).join("\n")}\n`);
  return record;
}

export async function listPushTokens(limit = 100) {
  const records = await listRecords(pushTokensPath, limit);
  return records.filter((record) => record.enabled !== false && (record.token || record.subscription?.endpoint));
}

export async function listConversations(limit = 200) {
  const messages = await listRecords(smsPath, limit);
  const bookings = await listRecords(bookingsPath, 1000);
  const calls = await listRecords(callsPath, 1000);
  const bookingsByPhone = new Map();
  for (const booking of bookings) {
    const phone = normalizeConversationPhone(booking.phone || booking.customer_phone);
    if (!phone) continue;
    if (!bookingsByPhone.has(phone)) bookingsByPhone.set(phone, []);
    bookingsByPhone.get(phone).push({ ...booking, confidence: booking.confidence || calculateBookingConfidence(booking) });
  }
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
        bookings: bookingsByPhone.get(key) || [],
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
  for (const call of [...calls].reverse()) {
    const key = normalizeConversationPhone(call.from);
    if (!key) continue;
    const status = call.status || (call.durationSeconds ? `completed in ${formatDuration(call.durationSeconds)}` : "call received");
    if (!conversations.has(key)) {
      conversations.set(key, {
        phone: key,
        lastMessageAt: call.createdAt,
        lastBody: `Call: ${status}`,
        unread: 1,
        bookings: bookingsByPhone.get(key) || [],
        messages: []
      });
    }
    const conversation = conversations.get(key);
    const hasCallNote = conversation.messages.some((message) => message.messageSid === `call:${call.callId || call.createdAt}`);
    if (!hasCallNote) {
      conversation.messages.push({
        createdAt: call.createdAt,
        direction: "call",
        from: key,
        to: call.to || "",
        body: `Call: ${status}`,
        messageSid: `call:${call.callId || call.createdAt}`,
        status,
        agentName: "DDD AI Dispatch",
        customerPhone: key
      });
    }
    if (String(call.createdAt || "").localeCompare(String(conversation.lastMessageAt || "")) > 0) {
      conversation.lastMessageAt = call.createdAt;
      conversation.lastBody = `Call: ${status}`;
    }
  }

  return [...conversations.values()]
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    }))
    .sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)));
}

export function calculateBookingConfidence(booking = {}) {
  const missing = [];
  if (!cleanText(booking.name, "", 160) || cleanText(booking.name, "", 160).toLowerCase() === "customer") missing.push("customer name");
  if (!normalizeE164(booking.phone || booking.customer_phone || booking.customerPhone)) missing.push("callback number");
  if (!cleanLongText(booking.location || booking.service_address || booking.address, "", 700)) missing.push("location");
  if (!cleanText(booking.serviceType || booking.service || booking.reason, "", 160)) missing.push("service");
  const serviceText = String(booking.serviceType || booking.reason || booking.notes || "").toLowerCase();
  if (/(roadside|tire|flat|jump|battery|lockout|fuel|gas|oil|brake|rotor|hub|vehicle|mobile)/.test(serviceText)) {
    if (!cleanText(booking.vehicle || booking.vehicleInfo, "", 200)) missing.push("vehicle");
    if (!cleanText(booking.vehicleColor || booking.color, "", 80)) missing.push("vehicle color");
  }
  if (/tire|flat|spare|plug|wheel/.test(serviceText) && !/wheel lock|special key|lock key|no key|has key/i.test(`${booking.notes || ""} ${booking.reason || ""}`)) {
    missing.push("wheel lock/key answer");
  }
  if (/oil|brake|rotor|hub|battery install/.test(serviceText) && !/part|parts|oil|filter|pad|rotor|battery|suppl/i.test(`${booking.notes || ""} ${booking.reason || ""}`)) {
    missing.push("parts/materials answer");
  }
  const score = Math.max(0, Math.round(((7 - Math.min(missing.length, 7)) / 7) * 100));
  const label =
    missing.length === 0
      ? "Ready to dispatch"
      : missing.includes("location")
        ? "Needs location"
        : missing.includes("callback number")
          ? "Needs callback"
          : missing.includes("vehicle") || missing.includes("vehicle color")
            ? "Needs vehicle info"
            : "Needs review";
  return { score, label, missing };
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

function findRelatedSms(messages, caller, startedAt, endedAt) {
  const phone = normalizeE164(caller);
  if (!phone) return [];
  const start = Date.parse(startedAt || "") || 0;
  const end = Date.parse(endedAt || "") || Date.now();
  const windowStart = start ? start - 10 * 60 * 1000 : 0;
  const windowEnd = end + 24 * 60 * 60 * 1000;
  return messages.filter((message) => {
    const relatedPhone = normalizeE164(message.direction === "outbound" ? message.to : message.from);
    if (relatedPhone !== phone) return false;
    const created = Date.parse(message.createdAt || "") || 0;
    return !created || (created >= windowStart && created <= windowEnd);
  });
}

function getCallDurationSeconds(events, summary = {}) {
  const explicit = Math.max(0, ...events.map((event) => Number(event.durationSeconds || 0) || 0));
  if (explicit) return explicit;
  const started = Date.parse(summary.startedAt || events[0]?.createdAt || "");
  const ended = Date.parse(summary.endedAt || events.at(-1)?.createdAt || "");
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0;
  return Math.round((ended - started) / 1000);
}

function summarizeSmsStatus(messages = []) {
  if (!messages.length) return "none";
  if (messages.some((message) => String(message.status || "").toLowerCase() === "failed")) return "failed";
  if (messages.some((message) => String(message.direction || "").toLowerCase() === "outbound")) return "sent";
  return "inbound only";
}

function summarizeCallOutcome({ status, transcript, relatedLeads, relatedBookings, relatedSms, durationSeconds }) {
  const normalizedStatus = String(status || "").toLowerCase();
  const hasBooking = relatedBookings.length > 0;
  const hasLead = relatedLeads.length > 0;
  const smsStatus = summarizeSmsStatus(relatedSms);
  const hungUpEarly = durationSeconds > 0 && durationSeconds < 25 && !hasBooking && !hasLead;
  const failed = /busy|failed|no-answer|canceled|cancelled|missed/.test(normalizedStatus);
  const completed = hasBooking || hasLead;
  let label = "Logged";
  let detail = "Call reached the system, but no final intake outcome is attached yet.";
  if (hasBooking) {
    label = "Booking captured";
    detail = "The AI saved a booking request.";
  } else if (hasLead) {
    label = "Message saved";
    detail = "The AI saved a lead or callback message.";
  } else if (hungUpEarly) {
    label = "Caller hung up early";
    detail = "The call ended before intake was completed.";
  } else if (failed) {
    label = "Missed or failed";
    detail = "The call did not complete and needs a human follow-up check.";
  } else if (!transcript.length) {
    label = "No transcript yet";
    detail = "The call is logged, but the AI transcript is not ready or was not received.";
  }
  return {
    label,
    detail,
    completion: completed ? "complete" : hungUpEarly || failed ? "incomplete" : "needs-review",
    callerStayedOn: durationSeconds >= 25,
    hungUpEarly,
    smsStatus
  };
}

function getCallDisplayStatus(status, outcome = {}, bookings = [], leads = []) {
  if (bookings.length) return "Booking captured";
  if (leads.length) return "Message saved";
  if (outcome.hungUpEarly) return "Caller hung up early";
  return getCleanStatusLabel(status || outcome.label || "");
}

function getCleanStatusLabel(value = "") {
  const status = String(value).toLowerCase();
  if (/routing|sip|incoming|accepted|in-progress|ringing|queued|initiated/.test(status)) return "Connected";
  if (/completed|complete/.test(status)) return "Completed";
  if (/busy/.test(status)) return "Busy";
  if (/no-answer|missed/.test(status)) return "Missed";
  if (/failed|canceled|cancelled/.test(status)) return "Failed";
  if (/recording/.test(status)) return "Recording saved";
  if (/outbound/.test(status)) return "Outbound call";
  return "Logged";
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0) || 0);
  if (!total) return "Unknown";
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
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
  const insightLearningNotes = buildInsightLearningNotes(activeSettings);
  return `
You are the AI receptionist for ${business.name}.
Your job is to answer Google Voice forwarded calls like a polished Smith.ai-style front-desk teammate for DDD.

Voice and manner:
- Sound ${business.tone}.
- Voice direction: ${activeSettings.voiceDirection}
- Speaking speed: ${activeSettings.voiceSpeed}x. Keep the same natural pace throughout the call.
- Speak like a real front desk receptionist: calm, helpful, confident, and not robotic.
- Use "Triple D Roadside" only in the opening greeting so the business is pronounced correctly. After the greeting, DDD is okay, and DDD Mobile app stays the app name.
- Keep answers short enough for a phone call, usually one or two sentences.
- Ask one question at a time.
- Let the caller finish before responding, and do not over-explain.
- Be patient with elderly callers, strong accents, dialect differences, code-switching, and people whose first language is not English.
- If the caller seems confused, hard of hearing, or slower to answer, slow down slightly, use plain words, and confirm only the detail that matters.
- If the caller speaks Spanish or another non-English language, ask briefly if English is okay. If not, continue in the caller's language when possible while still collecting the same DDD intake details.
- Use natural acknowledgements like "I can help with that" or "Let me grab a few details."
- For booking or urgent service calls, reassure the caller once: "This will be quick, and I can make the booking for you." Use this idea naturally, then do not repeat it.
- If the caller names a specific bookable service, such as "oil change", "brakes", "battery install", "jump start", "lockout", "flat tire", or "fuel delivery", do not ask whether they need roadside, routine service, emergency help, or another category. Treat the named service as the intent and ask for the next missing booking detail.
- Do not repeat the greeting, the same reassurance, or the same question after the caller already answered. If you missed something, ask only for the missing detail.
- Do not invent business policies, prices, addresses, or availability.
- If a caller wants to book, collect their name, phone, email if available, service, location, vehicle year/make/model/color when relevant, issue, urgency, and preferred date/time.
- After the caller gives a callback number, call lookup_customer_history before asking repeat details. If history exists, confirm the saved name, vehicle, service, or oil-change notes briefly and ask what changed, if anything.
- If a returning customer needs another oil change, use their saved vehicle and previous oil notes/type/quantity when available unless they say the vehicle changed. Do not pretend to know oil type or quantity if it is not in history.
- For oil changes, brake pads, rotors, bolt-in hub bearings, and battery installs, ask whether the customer already has the parts/materials or needs DDD to confirm parts.
- For oil changes, capture oilType and oilQuantity if the caller knows them or returning-customer history contains them. If not known, save that DDD should confirm oil type and quantity.
- For brake pads, rotors, tire replacement, tire plug, and spare tire calls, accept quantity/position if the caller already says it. If they do not, ask whether it is one wheel, front axle, rear axle, both axles/all four, or a spare/tire-specific need.
- For tire-related jobs, ask whether the vehicle has a wheel lock/special key and whether the caller has that key available.
- As soon as you have enough booking details and callback information, call save_booking_request. Do not require the caller to fill out a form first.
- Do not read long URLs out loud. If a text is allowed, say "I'll text that link to you now" instead of speaking the full link.
- Do not send or promise live tracking until a technician is assigned, active, or en route. If save_booking_request returns a customerStatusUrl or trackingUrl, keep it in the saved record for staff/tech use later.
${bookingUrl ? `- The immediate text link is ${bookingUrl}. Offer to text it, but do not read it out loud character by character.` : "- A booking link is not configured yet because the public deployment URL is not set. Tell callers DDD will text or call them after their details are saved."}

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
- For pricing or payment questions, follow admin pricing guidance, gather job details when needed, and say DDD will confirm final price before service. Accepted payment methods are cash, card, tap pay, and installments. No checks.
- For existing customers, collect their name, callback number, and what appointment or job they are calling about. If they call to reschedule, cancel, or add notes, save a message/booking update with changeRequestType set to reschedule, cancel, or add_notes. Tell them DDD received the update request and will confirm if needed.
- For complaints, refund concerns, damage reports, bad experiences, or upset callers: ${activeSettings.complaintInstructions}
- Complaint support destination: support@dddcincy.com
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
- Thinking bridge: ${activeSettings.soundPreferences.thinkingSound ? activeSettings.soundPreferences.thinkingPhrase : "Avoid filler sounds or thinking noises; stay silent briefly if needed."}
- Background audio/music: ${activeSettings.soundPreferences.backgroundAudio.enabled ? `${activeSettings.soundPreferences.backgroundAudio.label || "enabled"} (${activeSettings.soundPreferences.backgroundAudio.url || "no URL set"})` : "off"}. Keep emergency calls clear. Do not play or mention music unless the system is actually configured to mix licensed audio.

Noise and interruption handling:
- ${activeSettings.noiseHandling.notes}
- If you hear a tiny noise while speaking, keep finishing the current short sentence. Do not restart from the top.
- After you ask a question, stay quiet and listen until the caller finishes. If they pause briefly, wait instead of jumping in.

SMS follow-up:
- SMS follow-up is ${activeSettings.smsFollowUp.enabled ? "enabled" : "disabled"} in admin.
- If enabled, ask permission before texting the caller the best DDD link.
- Message template: ${activeSettings.smsFollowUp.message}
- All outbound SMS must include opt-out wording: "Reply STOP to stop." If the template already includes it, do not repeat it.
- Use the most relevant DDD destination as {{link}}. Do not use a booking/customer tracking URL for immediate SMS until a technician is assigned, active, or en route.
- If the caller asks how to check the booking, say iPhone users can use the DDD Mobile app link and non-iPhone users can use the dddcincy.com login link, and that DDD will text those instructions. Do not read the links out loud.
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

Insight learning:
${insightLearningNotes}

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
- Human routing mode: ${activeSettings.humanRouting.mode}. Saved human route numbers: ${activeSettings.humanRouting.numbers.length ? activeSettings.humanRouting.numbers.map((entry) => `${entry.label}: ${entry.phone}`).join(", ") : "none configured"}.
- Human transfer triggers: ${activeSettings.humanRouting.transferTriggers.join("; ")}.
- If transfer is needed, follow the human handoff rules and keep the caller calm. If no route number is configured, save an urgent follow-up instead of promising a live transfer.

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
      name: "lookup_customer_history",
      description: "Look up recent DDD booking history after the caller provides a callback phone number. Use this before re-asking vehicle or oil-change details for returning customers.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Caller phone number to search."
          }
        },
        required: ["phone"]
      }
    },
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
          changeRequestType: {
            type: "string",
            enum: ["reschedule", "cancel", "add_notes", "complaint", "general"],
            description: "Use reschedule, cancel, add_notes, or complaint for existing customer changes."
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
          oilType: { type: "string", description: "Oil type/spec if known or confirmed, such as 5W-30 synthetic." },
          oilQuantity: { type: "string", description: "Oil quantity if known or confirmed, such as 5 quarts." },
          partsStatus: { type: "string", description: "Whether the customer has parts/materials or needs DDD to confirm/supply them." },
          changeRequestType: {
            type: "string",
            enum: ["new_booking", "reschedule", "cancel", "add_notes"],
            description: "Use for booking changes or normal new booking."
          },
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
  const activeSettings = normalizeSettings(settings);
  return {
    type: "realtime",
    model: "gpt-realtime",
    instructions: buildReceptionistInstructions(business, activeSettings),
    tools: receptionistTools(),
    tool_choice: "auto",
    output_modalities: ["audio"],
    tracing: "auto",
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          prompt: settings.verificationMode
            ? "This is a Google Voice verification call. Listen for a six digit numeric code."
            : "Phone call with a DDD receptionist. Transcribe caller details, names, phone numbers, service requests, locations, appointment times, accents, dialects, and mixed-language speech. English is the default, but callers may use Spanish or another language."
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: activeSettings.noiseHandling.eagerness,
          create_response: true,
          interrupt_response: activeSettings.noiseHandling.interruptResponse
        }
      },
      output: {
        voice: normalizeVoice(activeSettings.voice) || "marin",
        speed: normalizeSpeed(activeSettings.voiceSpeed)
      }
    }
  };
}

function buildInsightLearningNotes(settings = {}) {
  const learning = normalizeInsightLearning(settings.insightLearning);
  const snapshot = settings.insightSnapshot || {};
  if (!learning.enabled || !snapshot.sections) {
    return "- Insight learning is off or there is not enough recent data yet. Follow the admin script exactly.";
  }

  const weekly = snapshot.sections.weekly || {};
  const monthly = snapshot.sections.monthly || {};
  const daily = snapshot.sections.daily || {};
  const notes = [
    "- Treat these notes as lightweight guidance from aggregate call history, not as a replacement for admin rules.",
    "- Never invent policies from insights. If insight guidance conflicts with admin settings, admin settings win."
  ];
  if (learning.useTopServices) {
    const service = weekly.topServices?.[0]?.label || monthly.topServices?.[0]?.label;
    if (service) notes.push(`- Recent callers most often ask about ${service}. If a caller mentions this, skip generic category questions and go straight to the needed booking details.`);
  }
  if (learning.useTopLocations) {
    const location = weekly.topLocations?.[0]?.label || monthly.topLocations?.[0]?.label;
    if (location) notes.push(`- Recent calls cluster around ${location}. Still collect the exact address/cross street, but expect callers may reference that area casually.`);
  }
  if (learning.useQaIssues) {
    const followUps = Number(daily.missed || 0) + Number(daily.needsReview || 0);
    if (followUps > 0) notes.push(`- Today has ${followUps} call${followUps === 1 ? "" : "s"} needing follow-up. Be extra careful to capture callback number, exact location, service, and a clear next step.`);
    if (Number(weekly.smsCoverageRate || 0) > 0 && Number(weekly.smsCoverageRate || 0) < 80) {
      notes.push("- SMS coverage has been low. Ask permission to text and make sure smsConsent is true only when the caller agrees.");
    }
  }
  if (learning.useSpeedSuggestions && Number(weekly.averageDurationSeconds || 0) > 150) {
    notes.push("- Calls have been running long this week. Keep responses shorter, ask one high-value question at a time, and avoid repeating details already captured.");
  }
  if (snapshot.suggestions?.length) {
    notes.push(`- Current admin insight suggestion: ${cleanLongText(snapshot.suggestions[0], "", 220)}`);
  }
  return notes.join("\n");
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
    greeting: migrateGreeting(cleanText(settings.greeting, defaultGreeting, 240)),
    customInstructions: cleanLongText(
      appendMissingGuidance(settings.customInstructions, defaultCustomInstructions, [
        {
          test: /Triple D Roadside only in the opening greeting/i,
          text: "Use Triple D Roadside only in the opening greeting so the business is pronounced correctly; after that, DDD is okay."
        },
        {
          test: /one wheel, front axle, rear axle, both axles\/all four/i,
          text: "For brake, rotor, tire replacement, tire plug, or spare tire calls, ask quantity/position only if they have not already said it: one wheel, front axle, rear axle, both axles/all four, or spare/tire-specific need."
        },
        {
          test: /cash, card, tap pay, and installments/i,
          text: "If callers ask how they can pay, say DDD accepts cash, card, tap pay, and installments, but does not accept checks."
        }
      ]),
      defaultCustomInstructions,
      2400
    ),
    businessKnowledge: cleanLongText(
      appendMissingGuidance(settings.businessKnowledge, defaultBusinessKnowledge, [
        {
          test: /Accepted payment methods are cash, card, tap pay, and installments/i,
          text: "Accepted payment methods are cash, card, tap pay, and installments. No checks."
        }
      ]),
      defaultBusinessKnowledge,
      3000
    ),
    serviceArea: cleanLongText(settings.serviceArea, defaultServiceArea, 900),
    pricingNotes: cleanLongText(
      appendMissingGuidance(settings.pricingNotes, defaultPricingNotes, [
        {
          test: /confirm quantity or position/i,
          text: "For brakes, rotors, and tire work, confirm quantity or position first."
        },
        {
          test: /Accepted payment methods: cash, card, tap pay, and installments/i,
          text: "Accepted payment methods: cash, card, tap pay, and installments. No checks."
        }
      ]),
      defaultPricingNotes,
      1200
    ),
    emergencyInstructions: cleanLongText(settings.emergencyInstructions, defaultEmergencyInstructions, 1200),
    emergencyQuestions: normalizeTextList(settings.emergencyQuestions, defaultEmergencyQuestions, 10, 140),
    offeredServices: cleanLongText(settings.offeredServices, defaultOfferedServices, 1400),
    notOfferedServices: cleanLongText(settings.notOfferedServices, defaultNotOfferedServices, 1400),
    directoryReferral: normalizeDirectoryReferral(settings.directoryReferral),
    afterHoursInstructions: cleanLongText(settings.afterHoursInstructions, defaultAfterHoursInstructions, 900),
    humanHandoffRules: cleanLongText(settings.humanHandoffRules, defaultHumanHandoffRules, 1200),
    callOutcomeRules: cleanLongText(
      appendMissingGuidance(settings.callOutcomeRules, defaultCallOutcomeRules, [
        {
          test: /Do not read long URLs out loud/i,
          text: "Do not read long URLs out loud."
        }
      ]),
      defaultCallOutcomeRules,
      1400
    ),
    fallbackRules: cleanLongText(settings.fallbackRules, defaultFallbackRules, 1400),
    complaintInstructions: cleanLongText(settings.complaintInstructions, defaultComplaintInstructions, 1200),
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
    noiseHandling: normalizeNoiseHandling(settings.noiseHandling),
    notificationPreferences: normalizeNotificationPreferences(settings.notificationPreferences),
    insightLearning: normalizeInsightLearning(settings.insightLearning),
    humanRouting: normalizeHumanRouting(settings.humanRouting),
    insightSnapshot: settings.insightSnapshot || null,
    staffAccessCodes: normalizeStaffAccessCodes(settings.staffAccessCodes || parseStaffAccessCodes(process.env.STAFF_ACCESS_CODES || "")),
    bookingDestinations: normalizeBookingDestinations(settings.bookingDestinations),
    voiceOptions
  };
}

function migrateGreeting(greeting) {
  if (/thank you for calling ddd mobile/i.test(greeting)) return defaultGreeting;
  if (/thank you for calling ddd[,. ]/i.test(greeting)) return defaultGreeting;
  return greeting;
}

function appendMissingGuidance(value, fallback, additions) {
  let text = typeof value === "string" && value.trim() ? value.trim() : fallback;
  for (const addition of additions) {
    if (!addition.test.test(text)) text = `${text} ${addition.text}`;
  }
  return text;
}

function migrateSmsMessage(message) {
  const text = cleanLongText(message, defaultSmsFollowUpText, 500);
  if (/iPhone users: open the DDD Mobile app link/i.test(text) && /Non-iPhone users: log in/i.test(text)) return text;
  if (/Here is the best next link for your request|Use this link for the best next step/i.test(text)) return defaultSmsFollowUpText;
  return text;
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
  const customerLocationUrl =
    publicBaseUrl && !publicBaseUrl.includes("your-domain")
      ? `${publicBaseUrl.replace(/\/$/, "")}/api/bookings/${encodeURIComponent(bookingId)}/confirm-location?token=${encodeURIComponent(statusToken)}`
      : "";
  const photoUploadUrl = buildPhotoUploadUrl(bookingId, statusToken, publicBaseUrl);

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
    latitude: cleanText(booking.latitude || booking.lat || "", "", 80),
    longitude: cleanText(booking.longitude || booking.lng || "", "", 80),
    locationConfirmedAt: cleanText(booking.locationConfirmedAt || "", "", 80),
    locationSource: cleanText(booking.locationSource || "", "", 80),
    urgency: cleanText(booking.urgency || "normal", "normal", 40),
    reason: cleanLongText(booking.reason || serviceType, serviceType, 600),
    notes: cleanLongText(booking.notes || booking.customer_notes || booking.problem_description || booking.nextStep || "", "", 1200),
    oilType: cleanText(booking.oilType || booking.oil_type || "", "", 80),
    oilQuantity: cleanText(booking.oilQuantity || booking.oil_quantity || "", "", 80),
    partsStatus: cleanText(booking.partsStatus || booking.parts_status || "", "", 160),
    changeRequestType: cleanText(booking.changeRequestType || booking.change_request_type || "", "", 80),
    nextStep: cleanLongText(booking.nextStep || "DDD should review and confirm the booking request.", "", 900),
    smsConsent: booking.smsConsent === true,
    customerStatusUrl,
    customerLocationUrl,
    photoUploadUrl,
    photos: Array.isArray(booking.photos) ? booking.photos : [],
    photoCount: Array.isArray(booking.photos) ? booking.photos.length : 0,
    externalSync: { ok: false, skipped: true, reason: "Not attempted yet." }
  };
}

function buildPhotoUploadUrl(bookingId, statusToken, publicBaseUrl = "") {
  const directUrl =
    publicBaseUrl && !publicBaseUrl.includes("your-domain")
      ? `${publicBaseUrl.replace(/\/$/, "")}/api/bookings/${encodeURIComponent(bookingId)}/photos?token=${encodeURIComponent(statusToken)}`
      : "";
  const brandedBase = String(process.env.DDD_PHOTO_UPLOAD_BASE_URL || "").trim();
  if (!brandedBase || !directUrl) return directUrl;
  try {
    const brandedUrl = new URL(brandedBase);
    brandedUrl.searchParams.set("booking", bookingId);
    brandedUrl.searchParams.set("token", statusToken);
    return brandedUrl.toString();
  } catch {
    return directUrl;
  }
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
      record.oilType ? `Oil type: ${record.oilType}` : "",
      record.oilQuantity ? `Oil quantity: ${record.oilQuantity}` : "",
      record.partsStatus ? `Parts/materials: ${record.partsStatus}` : "",
      record.changeRequestType ? `Change request: ${record.changeRequestType}` : "",
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
  const startingEstimate = estimateStartingPrice(message);
  const baseQuestions =
    intent === "emergency"
      ? buildEmergencyQuestions(activeSettings.emergencyQuestions, message)
      : intent === "apply"
        ? ["What kind of DDD work are you applying for?", "What experience do you have?", "What is your best callback number and email?"]
        : intent === "complaint"
          ? ["What name and callback number should DDD use?", "What happened?", "What job or service is this about?", "What resolution are you looking for?"]
          : intent === "booking_change"
            ? ["What name and callback number is the booking under?", "Do you need to reschedule, cancel, or add notes?", "What booking date, service, or vehicle is this about?", "What exact change should DDD make?"]
        : intent === "unsupported"
          ? ["What service were you looking for?", "What is your name and best callback number if you want DDD to follow up?", "Can DDD text you a referral or directory link if available?"]
          : buildBookingQuestions(message);
  let questions = filterKnownQuestions(baseQuestions, knownDetails).slice(0, 6);
  const firstResponse =
    intent === "emergency"
      ? `${reflectedNeed} I'll keep this quick and can create the request for you. First, are you in a safe place right now?`
      : intent === "apply"
        ? `${reflectedNeed} I can get your info to DDD quickly. What kind of work are you applying for?`
        : intent === "complaint"
          ? "I'm sorry that happened. I can send this to DDD as a priority support message. What name and callback number should DDD use?"
        : intent === "booking_change"
          ? "I can help update that request. What name and callback number is the booking under?"
        : intent === "payment"
          ? "DDD accepts cash, card, tap pay, and installments. We do not accept checks. Do you want me to help make the booking now?"
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
      : intent === "complaint"
        ? "Save a high-priority complaint/support message and offer to text support@dddcincy.com."
      : intent === "booking_change"
        ? "Save the reschedule, cancel, or add-notes request with the caller's booking details and tell them DDD received it."
      : intent === "payment"
        ? "Answer accepted payment methods clearly, then offer to book the service if the caller is ready."
        : intent === "unsupported"
        ? "Do not book an unsupported service as a DDD job. Save a message and offer the referral/directory text if enabled."
        : "Collect only missing booking details, including vehicle color and brake/rotor/tire quantity when relevant, create the booking during the call, and text the best next-step link instead of reading URLs out loud. Do not send a tracking link until a tech is assigned or en route.";
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
    insightLearning: buildInsightLearningNotes(activeSettings),
    likelyReply: [
      `First response: ${firstResponse}`,
      `Next questions, one at a time: ${questions.join(" | ")}`,
      `Action: ${action}`,
      startingEstimate ? `Starting price math: ${startingEstimate}` : "",
      `Best next link: ${bestNextLink}`,
      `SMS follow-up: ${smsLine}`,
      `Insight learning: ${buildInsightLearningNotes(activeSettings).split("\n").slice(0, 3).join(" | ")}`,
      `Required outcome: ${activeSettings.callOutcomeRules}`,
      `Fallback if something breaks: ${activeSettings.fallbackRules}`
    ]
      .filter(Boolean)
      .join("\n\n"),
    questions,
    qaChecklist: activeSettings.qaChecklist
      .split(/[.;]\s+|\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12),
    note: "Free dry run. This does not place a phone call and does not use OpenAI voice minutes."
  };
}

function estimateStartingPrice(message) {
  if (/brake|pads/.test(message) && /rotor/.test(message) && /all four|4|four|all wheels|both axles/.test(message)) {
    return "Brake pads and rotors all four wheels start around $280 before final confirmation.";
  }
  if (/brake|pads/.test(message) && /rotor/.test(message) && /front|rear|back|axle/.test(message)) {
    return "Brake pads start around $50 per axle, plus rotor add-on around $20 per axle, so one axle starts around $70 before final confirmation.";
  }
  if (/brake|pads/.test(message) && /all four|4|four|all wheels|both axles/.test(message)) {
    return "Full brake pad replacement for four wheels starts around $200 before final confirmation.";
  }
  if (/rotor/.test(message) && /all four|4|four|all wheels|both axles/.test(message)) {
    return "Rotor replacement for both axles starts around $100 before final confirmation.";
  }
  if (/brake|pads/.test(message) && /front|rear|back|axle/.test(message)) {
    return "Brake pads start around $50 per axle before final confirmation.";
  }
  if (/rotor/.test(message) && /front|rear|back|axle/.test(message)) {
    return "Rotor replacement starts around $50 per axle, or rotor add-on starts around $20 per axle before final confirmation.";
  }
  if (/tire plug|plug/.test(message) && /\btwo\b|\b2\b/.test(message)) {
    return "Tire plugs start around $20 per tire, so two starts around $40 before final confirmation.";
  }
  if (/tire plug|plug/.test(message)) return "Tire plugs start around $20 per tire before final confirmation.";
  if (/spare/.test(message)) return "Spare tire change starts around $50 before final confirmation.";
  if (/tire inflation|inflate/.test(message)) return "Tire inflation starts around $15 before final confirmation.";
  return "";
}

function classifyIntent(message) {
  if (/complain|complaint|upset|angry|refund|damage|damaged|bad service|manager|supervisor|charged wrong|overcharged/.test(message)) {
    return "complaint";
  }
  if (/reschedule|re-schedule|cancel|add note|add notes|update.*booking|change.*booking|change.*appointment|move.*appointment/.test(message)) {
    return "booking_change";
  }
  if (/\btow\b|\btowing\b|transmission|engine rebuild|\brebuild\b|body work|\bpaint\b|windshield|glass|impound|sell.*tire|new tire/.test(message)) {
    return "unsupported";
  }
  if (/payment|pay|cash|card|tap pay|apple pay|installment|financing|finance|check|checks/.test(message)) {
    return "payment";
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
  if (/brake|pads|rotor|tire replacement|replace.*tire|new tire|tire change|plug|spare/.test(message)) {
    questions.push("Is that for one wheel, the front axle, the rear axle, all four, or a specific tire?");
  }
  if (/oil change|brake|pads|rotor|hub bearing|battery install/.test(message)) {
    questions.push("Do you already have the parts or materials, or do you need DDD to confirm parts?");
  }
  if (/flat|tire|spare|plug|inflation|wheel/.test(message)) {
    questions.push("Does the vehicle have a wheel lock or special key, and do you have it available?");
  }
  questions.push("What date or time works best?");
  return questions;
}

function buildEmergencyQuestions(emergencyQuestions, message) {
  const questions = emergencyQuestions.slice(0, 6);
  if (/flat|tire|spare|plug|inflation|wheel/.test(message)) {
    questions.splice(
      Math.max(questions.length - 2, 0),
      0,
      "Does the vehicle have a wheel lock or special key, and do you have it available?"
    );
  }
  return questions;
}

function detectKnownDetails(message) {
  return {
    service: /oil change|brake|pads|flat|tire|jump|battery|dead|fuel|gas|locked|lockout|tow|book|roadside|maintenance|repair|diagnos|apply|job|work/.test(message),
    location: /\b(at|near|by|on|in)\b.+/.test(message) || /\b\d{3,}\s+\w+/.test(message),
    vehicle: /\b(toyota|honda|ford|chevy|chevrolet|nissan|hyundai|kia|jeep|dodge|ram|bmw|mercedes|audi|lexus|camry|accord|civic|corolla|malibu|impala|altima|sonata|elantra|soul|wrangler|charger|f-?150)\b/.test(message),
    color: /\b(red|blue|black|white|gray|grey|silver|green|yellow|orange|purple|brown|tan|gold|maroon)\b/.test(message),
    phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(message),
    safe: /\b(safe|parking lot|shoulder|home|driveway|not safe|danger|highway)\b/.test(message),
    quantity: /\b(one|1|two|2|front|rear|back|both|all four|4|four|driver|passenger|left|right|axle|wheel|wheels|tire|tires)\b/.test(message)
  };
}

function filterKnownQuestions(questions, knownDetails) {
  return questions.filter((question) => {
    const normalized = question.toLowerCase();
    if (/wheel lock|special key/.test(normalized)) return true;
    if (knownDetails.safe && normalized.includes("safe")) return false;
    if (knownDetails.service && /service|what happened|looking for/.test(normalized)) return false;
    if (knownDetails.phone && /callback|phone|number/.test(normalized)) return false;
    if (knownDetails.location && /location|cross street|located/.test(normalized)) return false;
    if (knownDetails.vehicle && knownDetails.color && /vehicle|year|make|model|color/.test(normalized)) return false;
    if (knownDetails.vehicle && /year, make, model, and color/.test(normalized)) return true;
    if (knownDetails.quantity && /one wheel|front axle|rear axle|all four|specific tire/.test(normalized)) return false;
    return true;
  });
}

function summarizeCallerNeed(rawMessage, intent) {
  const cleaned = cleanText(rawMessage, "", 180).replace(/[.!?]+$/g, "");
  if (intent === "emergency") return "I hear this is urgent.";
  if (intent === "apply") return "I can help with the DDD work application.";
  if (intent === "payment") return "I can answer payment options.";
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
    complaint: /support|complaint|refund|damage|billing/i,
    booking_change: /mobile app|book|status|login/i,
    app: /auto doc|mobile app/i,
    payment: /shop|service|book/i,
    shopping: /shop|service/i,
    booking: /book/i
  }[intent];
  return destinations.find((destination) => wanted?.test(`${destination.label} ${destination.useWhen}`)) || destinations[0] || null;
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
    thinkingSound: value.thinkingSound !== false,
    thinkingPhrase: cleanLongText(value.thinkingPhrase, defaultSoundPreferences.thinkingPhrase, 220),
    backgroundAudio: {
      enabled: value.backgroundAudio?.enabled === true,
      mode: cleanText(value.backgroundAudio?.mode, value.backgroundAudio?.enabled ? "licensed-music" : "off", 80),
      label: cleanText(value.backgroundAudio?.label, defaultSoundPreferences.backgroundAudio.label, 80),
      url: cleanText(value.backgroundAudio?.url, "", 500)
    }
  };
}

function normalizeNoiseHandling(value = {}) {
  const mode = ["fast", "balanced", "patient"].includes(value.mode) ? value.mode : defaultNoiseHandling.mode;
  const eagerness = ["low", "medium", "high", "auto"].includes(value.eagerness) ? value.eagerness : mode === "fast" ? "medium" : "low";
  return {
    mode,
    eagerness,
    interruptResponse: value.interruptResponse === true,
    notes: cleanLongText(value.notes, defaultNoiseHandling.notes, 700)
  };
}

function normalizeNotificationPreferences(value = {}) {
  return {
    newCalls: value.newCalls !== false,
    missedCalls: value.missedCalls !== false,
    bookings: value.bookings !== false,
    texts: value.texts !== false,
    qaIssues: value.qaIssues !== false,
    dailySummary: value.dailySummary !== false,
    weeklySummary: value.weeklySummary !== false,
    monthlySummary: value.monthlySummary !== false
  };
}

function normalizeInsightLearning(value = {}) {
  return {
    enabled: value.enabled !== false,
    useTopServices: value.useTopServices !== false,
    useTopLocations: value.useTopLocations !== false,
    useQaIssues: value.useQaIssues !== false,
    useSpeedSuggestions: value.useSpeedSuggestions !== false
  };
}

function normalizeHumanRouting(value = {}) {
  const supportedModes = new Set(["ai", "humans", "ai_then_humans"]);
  const mode = supportedModes.has(value.mode) ? value.mode : defaultHumanRouting.mode;
  const numbersSource = Array.isArray(value.numbers) ? value.numbers : parseHumanRouteNumbers(value.numbers || process.env.HUMAN_ROUTE_NUMBERS || "");
  const numbers = numbersSource
    .map((entry, index) => ({
      label: cleanText(entry.label || entry.name || `Route ${index + 1}`, `Route ${index + 1}`, 80),
      phone: normalizePhoneForSettings(entry.phone || entry.number || entry.value)
    }))
    .filter((entry) => entry.phone)
    .slice(0, 8);
  const timeout = Number(value.timeoutSeconds);
  return {
    mode,
    numbers,
    ringStyle: value.ringStyle === "sequential" ? "sequential" : "simultaneous",
    timeoutSeconds: Number.isFinite(timeout) ? Math.min(45, Math.max(8, Math.round(timeout))) : defaultHumanRouting.timeoutSeconds,
    callerMessage: cleanText(value.callerMessage, defaultHumanRouting.callerMessage, 220),
    fallbackMessage: cleanText(value.fallbackMessage, defaultHumanRouting.fallbackMessage, 260),
    transferTriggers: normalizeTextList(value.transferTriggers, defaultHumanRouting.transferTriggers, 10, 120)
  };
}

function parseHumanRouteNumbers(value) {
  const raw = String(value || "").trim();
  if (!raw) return defaultHumanRouting.numbers;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to line format.
  }
  return raw
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label, ...phoneParts] = line.includes("|") ? line.split("|") : [`Route ${index + 1}`, line];
      return { label: label.trim(), phone: phoneParts.join("|").trim() };
    });
}

function normalizePhoneForSettings(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function normalizeSmsFollowUp(value = {}) {
  return {
    enabled: value.enabled !== false,
    askPermission: value.askPermission !== false,
    message: migrateSmsMessage(value.message)
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
  const followUpDestination = destination;
  const message = renderSmsTemplate(settings.smsFollowUp.message, followUpDestination, settings, record);
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

function renderSmsTemplate(template, destination, settings = {}, record = {}) {
  const fallbackLink = destination?.url || process.env.BOOKING_URL || "";
  const reviewLink = settings.reviewFollowUp?.url || defaultReviewFollowUpUrl;
  const webLoginLink = process.env.DDD_WEB_LOGIN_URL || "https://dddcincy.com/login";
  const photoUploadLink = record.photoUploadUrl || record.customerStatusUrl || fallbackLink;
  return appendSmsCompliance(String(template || defaultSmsFollowUpText)
    .replaceAll("{{link}}", fallbackLink)
    .replaceAll("{{webLoginLink}}", webLoginLink)
    .replaceAll("{{reviewLink}}", reviewLink)
    .replaceAll("{{photoUploadLink}}", photoUploadLink)
    .replaceAll("{{business}}", "DDD")
    .replace(/\s+/g, " ")
    .trim());
}

export function appendSmsCompliance(message = "") {
  const cleaned = String(message || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (/\bstop\b.*\bstop\b|\breply stop\b|text stop/i.test(cleaned)) return cleaned;
  const footer = " Reply STOP to stop.";
  return `${cleaned.slice(0, Math.max(0, 1000 - footer.length)).trim()}${footer}`;
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
  const text = String(value || "");
  const sipPhone = text.match(/\+1\d{10}\b/);
  if (sipPhone) return sipPhone[0];
  const nationalPhone = text.match(/(?:^|\D)(\d{10})(?:\D|$)/);
  if (nationalPhone) return `+1${nationalPhone[1]}`;
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function normalizeConversationPhone(value) {
  const normalized = normalizeE164(value);
  if (normalized) return normalized;
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return cleanText(value, "", 40);
}
