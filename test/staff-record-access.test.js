import test from "node:test";
import assert from "node:assert/strict";
import { requireStaffRecords } from "../src/staff-record-access.js";

for (const [label, identity, allowed] of [
  ["anonymous", { ok: false }, false],
  ["invalid code", null, false],
  ["verified technician", { ok: true, role: "tech" }, true],
  ["verified admin", { ok: true, role: "admin" }, true]
]) {
  test(`${label} record-list access`, async () => {
    let reachedRecords = false;
    const headers = {};
    const response = { locals: {}, set(k, v) { headers[k] = v; }, vary() {}, status(value) { this.code = value; return this; }, json(value) { this.body = value; } };
    await requireStaffRecords(async () => identity)({}, response, () => { reachedRecords = true; });
    assert.equal(reachedRecords, allowed);
    assert.equal(headers["Cache-Control"], "no-store, private");
    if (!allowed) { assert.equal(response.code, 403); assert.equal(response.body.ok, false); }
  });
}

test("authentication failure never reaches record storage", async () => {
  let error;
  const res = { set() {}, vary() {}, locals: {} };
  await requireStaffRecords(async () => { throw new Error("Auth offline"); })({}, res, (value) => { error = value; });
  assert.equal(error.message, "Auth offline");
});
