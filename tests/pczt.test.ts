import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPcztReviewVerdict,
  comparePcztBytes,
  decodePcztBytes,
  diffInspections,
  fingerprintPcztBytes,
  maxPcztLength,
  selectReviewFindings,
  validPcztBase64
} from "../lib/pczt.ts";
import {
  feeEscalationPczt,
  keystoneExpectedPczt,
  pcztAttackScenarios,
  recipientMutationPczt
} from "../lib/pczt-fixtures.ts";

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

test("fingerprintPcztBytes hashes decoded PCZT bytes rather than base64 text", async () => {
  const fixture = Buffer.from("PCZT byte fingerprint fixture").toString("base64");

  assert.equal(
    await fingerprintPcztBytes(fixture),
    "07173abac1edd3697f2d5237359fa5ce0c44eff55f36371fd1a18a7685505f0e"
  );
  assert.deepEqual(decodePcztBytes(fixture), Uint8Array.from(Buffer.from("PCZT byte fingerprint fixture")));
});

test("comparePcztBytes reports exact raw-byte evidence", () => {
  assert.deepEqual(comparePcztBytes(keystoneExpectedPczt, keystoneExpectedPczt), {
    beforeLength: 336,
    afterLength: 336,
    changedByteCount: 0,
    firstChangedOffset: null,
    identical: true
  });

  const recipientComparison = comparePcztBytes(keystoneExpectedPczt, recipientMutationPczt);
  assert.equal(recipientComparison.identical, false);
  assert.equal(recipientComparison.beforeLength, 336);
  assert.equal(recipientComparison.afterLength, 336);
  assert.equal(recipientComparison.firstChangedOffset, 136);
  assert.ok(recipientComparison.changedByteCount > 0);
});

test("fee fixture is a reproducible three-byte mutation independently decoded as a higher fee", () => {
  const expected = Buffer.from(keystoneExpectedPczt, "base64");
  const returned = Buffer.from(feeEscalationPczt, "base64");

  assert.equal(expected.subarray(193, 196).toString("hex"), "a08d06");
  assert.equal(returned.subarray(193, 196).toString("hex"), "90bf05");
  assert.equal(Buffer.compare(expected.subarray(0, 193), returned.subarray(0, 193)), 0);
  assert.equal(Buffer.compare(expected.subarray(196), returned.subarray(196)), 0);
  assert.deepEqual(comparePcztBytes(keystoneExpectedPczt, feeEscalationPczt), {
    beforeLength: 336,
    afterLength: 336,
    changedByteCount: 3,
    firstChangedOffset: 193,
    identical: false
  });
});

test("attack scenarios contain only valid, expectation-backed public fixtures", () => {
  assert.equal(validPcztBase64(keystoneExpectedPczt), true);
  assert.deepEqual(pcztAttackScenarios.map((scenario) => scenario.id), ["recipient-swap", "fee-escalation"]);
  for (const scenario of pcztAttackScenarios) {
    assert.equal(validPcztBase64(scenario.returnedPczt), true);
    assert.ok(scenario.expectedChangedPaths.length > 0);
  }
});

test("review verdicts distinguish raw evidence from decoded intent-review rules", () => {
  assert.equal(buildPcztReviewVerdict([], false).code, "no-difference");
  assert.equal(buildPcztReviewVerdict([], true).code, "raw-only");
  assert.deepEqual(buildPcztReviewVerdict([{
    path: "transparent / outputs / 0 / address",
    before: "tmExpected",
    after: "tmChanged"
  }], true), {
    code: "review-blocked",
    label: "REVIEW BLOCKED — RECIPIENT CHANGED",
    summary: "A recipient-related decoded field changed. Stop and confirm the intended recipient in a trusted signing flow.",
    matchedRules: ["recipient", "output-set"]
  });
  assert.equal(buildPcztReviewVerdict([{
    path: "fee_zat",
    before: 0,
    after: 10_000
  }], true).label, "REVIEW BLOCKED — VALUE OR FEE CHANGED");
});
