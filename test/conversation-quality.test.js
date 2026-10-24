import test from "node:test";
import assert from "node:assert/strict";
import { analyzeConversationQuality } from "../src/conversation-quality.js";

test("conversation insights suggest bounded communication improvements, not new business policies", () => {
  const result = analyzeConversationQuality([{ transcript: [
    { speaker: "DDD AI", text: "What is your preferred time?", at: "2026-10-24T00:00:00Z" },
    { speaker: "Customer", text: "Hello?", at: "2026-10-24T00:00:05Z" },
    { speaker: "DDD AI", text: "What is your preferred time?", at: "2026-10-24T00:00:10Z" },
    { speaker: "DDD AI", text: "Help is on the way.", at: "2026-10-24T00:00:20Z" }
  ] }]);
  assert.equal(result.analyzed, 1);
  assert.equal(result.repeatedQuestions, 1);
  assert.equal(result.repeatedTiming, 1);
  assert.equal(result.dispatchPromises, 1);
  assert.equal(result.adjustments.length, 2);
  assert.equal(JSON.stringify(result).includes("Hello"), false);
});
