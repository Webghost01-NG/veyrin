import assert from "node:assert/strict";
import test from "node:test";
import { diffInspections, maxPcztLength, selectReviewFindings, validPcztBase64 } from "../lib/pczt.ts";

test("validPcztBase64 accepts bounded base64 and rejects malformed input", () => {
  assert.equal(validPcztBase64(Buffer.from("PCZT deterministic fixture").toString("base64")), true);
  assert.equal(validPcztBase64("not base64"), false);
  assert.equal(validPcztBase64("AAAAA"), false);
  assert.equal(validPcztBase64("A".repeat(maxPcztLength + 4)), false);
  assert.equal(validPcztBase64(null), false);
});

test("diffInspections deterministically exposes a recipient mutation", () => {
  const expected = {
    fee_zat: 15_000,
    transparent: { outputs: [{ address: "tmExpected", value_zat: 100_000 }] }
  };
  const returned = {
    fee_zat: 15_000,
    transparent: { outputs: [{ address: "tmChanged", value_zat: 100_000 }] }
  };

  assert.deepEqual(diffInspections(expected, returned), [{
    path: "transparent / outputs / 0 / address",
    before: "tmExpected",
    after: "tmChanged"
  }]);
});

test("diffInspections represents added and removed fields without losing empty values", () => {
  assert.deepEqual(diffInspections({ memo: "", fee_zat: 1 }, { privacy_policy: "FullPrivacy", fee_zat: 1 }), [
    { path: "memo", before: "", after: undefined },
    { path: "privacy_policy", before: undefined, after: "FullPrivacy" }
  ]);
});

test("diffInspections preserves a number changing to an equal-looking string", () => {
  assert.deepEqual(diffInspections({ value_zat: 1 }, { value_zat: "1" }), [
    { path: "value_zat", before: 1, after: "1" }
  ]);
});

test("diffInspections preserves a missing field changing to an empty array", () => {
  assert.deepEqual(diffInspections({}, { outputs: [] }), [
    { path: "outputs", before: undefined, after: [] }
  ]);
});

test("diffInspections preserves an empty array changing to an empty object", () => {
  assert.deepEqual(diffInspections({ outputs: [] }, { outputs: {} }), [
    { path: "outputs", before: [], after: {} }
  ]);
});

test("selectReviewFindings keeps human-review fields and excludes unrelated metadata", () => {
  const findings = selectReviewFindings({
    tx_version: 5,
    fee_zat: 10_000,
    orchard: { outputs: [{ value_zat: 50_000 }] }
  });

  assert.deepEqual(findings.map((entry) => entry.path), [
    "fee_zat",
    "orchard / outputs / 0 / value_zat"
  ]);
});
