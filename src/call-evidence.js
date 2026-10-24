export function cleanTranscript(items = []) {
  if (!Array.isArray(items)) return [];
  const result = [];
  let fragments = [];
  const append = (item) => {
    const previous = result.at(-1);
    if (previous?.text === item.text && previous?.speaker === item.speaker && previous?.at === item.at) return;
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
  if (data.type === "staff-text-reply") return /failed|undelivered/.test(data.status || "");
  return !["call", "staff-outbound-call"].includes(data.type) || /failed|busy|no-answer/.test(data.status || "");
}

export function notificationPreference(data = {}) {
  if (/test|audit/.test(data.type || "")) return null;
  if (data.type === "sms") return "texts";
  if (data.type === "unanswered-text") return "texts";
  if (data.type === "booking") return "bookings";
  if (data.type === "call") return "newCalls";
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
