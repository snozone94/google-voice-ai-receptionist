import { cleanTranscript } from "./call-evidence.js";

export function analyzeConversationQuality(calls = []) {
  let analyzed = 0;
  let repeatedQuestions = 0;
  let repeatedTiming = 0;
  let longTurns = 0;
  let dispatchPromises = 0;
  for (const call of calls) {
    const turns = cleanTranscript(call.transcript || []);
    if (!turns.length) continue;
    analyzed++;
    const questions = new Set();
    let timingQuestions = 0;
    for (const turn of turns) {
      if (turn.speaker !== "DDD AI") continue;
      const text = turn.text.toLowerCase();
      if (text.split(/\s+/).length > 45) longTurns++;
      if (/help is on the way|someone is coming|technician is on (?:the|their) way/.test(text)) dispatchPromises++;
      if (!text.includes("?")) continue;
      const question = text.slice(text.lastIndexOf(".") + 1).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      if (questions.has(question)) repeatedQuestions++;
      questions.add(question);
      if (/preferred (?:time|date)|when would you like|when do you (?:want|need)/.test(text)) timingQuestions++;
    }
    if (timingQuestions > 1) repeatedTiming += timingQuestions - 1;
  }
  // These are bounded communication adjustments, never new policies or prices.
  const adjustments = [];
  if (repeatedQuestions || repeatedTiming) adjustments.push("Recent calls repeated intake questions. Reuse every answer already given; ask timing once, and offer text rather than looping when clarification fails.");
  if (longTurns) adjustments.push("Recent AI turns were long. Use one short sentence and one missing-detail question at a time.");
  if (dispatchPromises) adjustments.push("Recent calls included arrival promises. A saved request is not dispatch confirmation; say the team will follow up unless live assignment and travel are confirmed.");
  return { version: "communication-2026-10-24", analyzed, repeatedQuestions, repeatedTiming, longTurns, dispatchPromises, adjustments };
}
