export function cleanTranscript(items = []) {
  if (!Array.isArray(items)) return [];
  const result = [];
  let fragments = [];
  const append = (item) => {
    const previous = result.at(-1);
    if (previous?.text === item.text && previous?.speaker === item.speaker && previous?.at === item.at) return;
    if (previous?.text === item.text && previous?.speaker === item.speaker && previous?.type !== item.type && Math.abs(Date.parse(previous.at) - Date.parse(item.at)) < 2000) return;
    result.push(item);
  };
  for (const item of items) {
    const type = item.type || "transcript";
    const text = String(item.text || item.transcript || "").trim();
    if (!text) continue;
    const speaker = item.speaker || (/input_audio|caller|customer/.test(type) ? "Customer" : "DDD AI");
    if (/\.delta$/.test(type)) { fragments.push({ ...item, speaker }); continue; }
    // Completed text supersedes its streamed fragments, not a second utterance.
    if (fragments.length && fragments[0].speaker !== speaker) {
      append({ ...fragments[0], text: fragments.map((fragment) => fragment.text || fragment.transcript || "").join(""), speaker: fragments[0].speaker });
    }
    fragments = [];
    append({ ...item, type, speaker, text });
  }
  if (fragments.length) append({ ...fragments[0], text: fragments.map((fragment) => fragment.text || fragment.transcript || "").join(""), speaker: fragments[0].speaker });
  return result;
}

export function actionableNotification(data = {}) {
  if (data.type === "call-completed") return false;
  if (data.type === "staff-text-reply") return /failed|undelivered/.test(data.status || "");
  return !["call", "staff-outbound-call"].includes(data.type) || /failed|busy|no-answer/.test(data.status || "");
}

// Email is a quiet summary channel. Push reminders remain independent.
export function alertEmailPolicy(data = {}) {
  if (!actionableNotification(data) || data.type === "unanswered-text") return { send: false };
  const customer = data.type === "sms-delivery-failed" ? data.to : data.from || data.to;
  const digits = String(customer || "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `1${digits}` : digits;
  if (phone && data.type === "sms") return { send: true, key: `customer-text-email:${phone}`, ttl: 5 * 60000 };
  if (phone && ["ai-pickup-failed", "openai-accept-failed", "ai-off-missed-call", "early-hangup", "missed-call", "customer-voicemail", "sms-failed", "sms-delivery-failed", "staff-text-reply"].includes(data.type)) return { send: true, key: `customer-attention-email:${phone}`, ttl: 10 * 60000 };
  return { send: true };
}

export function alertDisplayType(type = "") {
  return ({ "ai-pickup-failed": "Call needs a team member", "early-hangup": "Caller hung up early", "missed-call": "Missed call", "call-completed": "Call completed", sms: "New customer text", "unanswered-text": "Customer awaiting a reply", booking: "Booking update", "customer-voicemail": "New voice message", "staff-text-reply": "Text delivery update", "staff-outbound-call": "Outgoing call update" })[type] || "Dispatch update";
}

export function callAttentionEmailKey(data = {}) {
  const callId = data.parentCallId || data.callId;
  return callId && ["ai-pickup-failed", "openai-accept-failed", "ai-off-missed-call", "early-hangup", "missed-call", "customer-voicemail"].includes(data.type)
    ? `call-attention-email:${callId}` : null;
}

export function notificationPreference(data = {}) {
  if (/test|audit/.test(data.type || "")) return null;
  if (data.type === "sms") return "texts";
  if (data.type === "unanswered-text") return "texts";
  if (data.type === "booking") return "bookings";
  if (data.type === "call") return "newCalls";
  if (data.type === "customer-voicemail") return "missedCalls";
  if (/missed|hangup|pickup|ai-off/.test(data.type || "")) return "missedCalls";
  if (["staff-text-reply", "staff-outbound-call", "call-completed"].includes(data.type) && !/failed|undelivered/.test(data.status || "")) return "teamActivity";
  return "qaIssues";
}

export function callIdResolver(records) {
  const parents = new Map(records.filter((record) => record.callId && record.parentCallId && record.callId !== record.parentCallId).map((record) => [record.callId, record.parentCallId]));
  return (id) => {
    const seen = new Set();
    while (parents.has(id) && !seen.has(id)) { seen.add(id); id = parents.get(id); }
    return id;
  };
}

// HTTP 200 means the Expo batch was processed, not that its tickets succeeded.
export function expoTicketResults(payload, expectedCount) {
  const tickets = Array.isArray(payload?.data) ? payload.data : payload?.data ? [payload.data] : [];
  return Array.from({ length: expectedCount }, (_, index) => {
    const ticket = tickets[index];
    return ticket?.status === "ok" && typeof ticket.id === "string" && ticket.id
      ? { ok: true, ticketId: ticket.id }
      : { ok: false, error: ticket?.details?.error || ticket?.message || "Expo did not accept this notification." };
  });
}
