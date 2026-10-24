import test from "node:test";
import assert from "node:assert/strict";
import { appendSmsCompliance } from "../src/receptionist.js";

test("SMS formatting keeps separate links intact and adds one opt-out footer", () => {
  const body = "Book online:\nhttps://dddcincy.com/book-service/\n\nAndroid:\nhttps://play.google.com/store/apps/details?id=com.dddroadside.mobile";
  const result = appendSmsCompliance(body);
  assert.ok(result.includes("Book online:\nhttps://"));
  assert.ok(result.includes("?id=com.dddroadside.mobile\n\nReply STOP to stop."));
  assert.equal(appendSmsCompliance(result), result);
});
