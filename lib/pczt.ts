export const maxPcztLength = 1_500_000;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Finding {
  path: string;
  value: string;
}

export interface InspectionChange {
  path: string;
  before: JsonValue | undefined;
  after: JsonValue | undefined;
}

export interface PcztByteComparison {
  beforeLength: number;
  afterLength: number;
  changedByteCount: number;
  firstChangedOffset: number | null;
  identical: boolean;
}

export interface PcztReviewVerdict {
  code: "no-difference" | "raw-only" | "review-required" | "review-blocked";
  label: string;
  summary: string;
  matchedRules: string[];
}

interface ComparableEntry {
  key: string;
  path: string;
  value: JsonValue;
}

const reviewFieldPattern = /(fee|value|amount|address|recipient|memo|privacy|proof|signature|signed|pool|input|output)/i;

export function validPcztBase64(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 16 &&
    value.length <= maxPcztLength &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function decodePcztBytes(value: string) {
  const normalized = value.trim();
  if (!validPcztBase64(normalized)) {
    throw new Error("Enter a valid base64-encoded PCZT");
  }

  try {
    return Uint8Array.from(globalThis.atob(normalized), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Enter a valid base64-encoded PCZT");
  }
}

export async function fingerprintPcztBytes(value: string) {
  const bytes = decodePcztBytes(value);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function comparePcztBytes(beforeValue: string, afterValue: string): PcztByteComparison {
  const before = decodePcztBytes(beforeValue);
  const after = decodePcztBytes(afterValue);
  const maximumLength = Math.max(before.length, after.length);
  let changedByteCount = 0;
  let firstChangedOffset: number | null = null;

  for (let index = 0; index < maximumLength; index += 1) {
    if (before[index] === after[index]) continue;
    changedByteCount += 1;
    if (firstChangedOffset === null) firstChangedOffset = index;
  }

  return {
    beforeLength: before.length,
    afterLength: after.length,
    changedByteCount,
    firstChangedOffset,
    identical: changedByteCount === 0
  };
}

export function flattenJson(value: JsonValue, path: string[] = [], result: Finding[] = []): Finding[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenJson(item, [...path, String(index)], result));
  } else if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => flattenJson(item, [...path, key], result));
  } else {
    result.push({ path: path.join(" / "), value: String(value) });
  }
  return result;
}

export function selectReviewFindings(value: JsonValue, limit = 24) {
  return flattenJson(value).filter((entry) => reviewFieldPattern.test(entry.path)).slice(0, limit);
}

function flattenComparableJson(
  value: JsonValue,
  path: string[] = [],
  result: ComparableEntry[] = []
): ComparableEntry[] {
  const key = JSON.stringify(path);
  const displayPath = path.join(" / ") || "(root)";

  if (Array.isArray(value)) {
    result.push({ key, path: displayPath, value: [] });
    value.forEach((item, index) => flattenComparableJson(item, [...path, String(index)], result));
  } else if (value !== null && typeof value === "object") {
    result.push({ key, path: displayPath, value: {} });
    Object.entries(value).forEach(([key, item]) => flattenComparableJson(item, [...path, key], result));
  } else {
    result.push({ key, path: displayPath, value });
  }

  return result;
}

function sameComparableValue(before: JsonValue | undefined, after: JsonValue | undefined) {
  if (before === undefined || after === undefined) return before === after;
  if (Array.isArray(before) || Array.isArray(after)) return Array.isArray(before) && Array.isArray(after);
  if ((before !== null && typeof before === "object") || (after !== null && typeof after === "object")) {
    return before !== null && typeof before === "object" && !Array.isArray(before) &&
      after !== null && typeof after === "object" && !Array.isArray(after);
  }
  return Object.is(before, after);
}

export function formatInspectionValue(value: JsonValue | undefined) {
  return value === undefined ? "∅" : JSON.stringify(value);
}

export function diffInspections(beforeValue: JsonValue, afterValue: JsonValue): InspectionChange[] {
  const before = new Map(flattenComparableJson(beforeValue).map((entry) => [entry.key, entry]));
  const after = new Map(flattenComparableJson(afterValue).map((entry) => [entry.key, entry]));

  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .filter((key) => !sameComparableValue(before.get(key)?.value, after.get(key)?.value))
    .map((key) => ({
      path: before.get(key)?.path || after.get(key)!.path,
      before: before.get(key)?.value,
      after: after.get(key)?.value
    }));
}

export function buildPcztReviewVerdict(
  changes: InspectionChange[],
  rawBytesChanged: boolean
): PcztReviewVerdict {
  const paths = changes.map((entry) => entry.path);
  const matchedRules = [
    paths.some((path) => /(address|recipient)/i.test(path)) ? "recipient" : "",
    paths.some((path) => /(^| \/ )(fee|fee_zat)( \/ |$)/i.test(path)) ? "fee" : "",
    paths.some((path) => /(^| \/ )(value|value_zat|amount)( \/ |$)/i.test(path)) ? "value" : "",
    paths.some((path) => /(^| \/ )outputs?( \/ |$)/i.test(path)) ? "output-set" : "",
    paths.some((path) => /(memo|privacy.*policy)/i.test(path)) ? "policy-or-memo" : ""
  ].filter(Boolean);

  if (changes.length === 0 && !rawBytesChanged) {
    return {
      code: "no-difference",
      label: "NO DIFFERENCE DETECTED",
      summary: "The compared bytes and Zallet inspection responses are identical.",
      matchedRules: []
    };
  }

  if (changes.length === 0) {
    return {
      code: "raw-only",
      label: "BYTE CHANGE — NO DECODED FIELD CHANGE",
      summary: "The envelopes differ, but this decoder reported no field change. Do not treat that as approval.",
      matchedRules: []
    };
  }

  if (matchedRules.includes("recipient")) {
    return {
      code: "review-blocked",
      label: "REVIEW BLOCKED — RECIPIENT CHANGED",
      summary: "A recipient-related decoded field changed. Stop and confirm the intended recipient in a trusted signing flow.",
      matchedRules
    };
  }

  if (matchedRules.some((rule) => ["fee", "value", "output-set"].includes(rule))) {
    return {
      code: "review-blocked",
      label: "REVIEW BLOCKED — VALUE OR FEE CHANGED",
      summary: "A decoded amount, fee, or output field changed. Stop and reconcile the transaction economics.",
      matchedRules
    };
  }

  return {
    code: "review-required",
    label: "REVIEW REQUIRED — DECODED FIELDS CHANGED",
    summary: "Zallet reported a decoded-field change that needs human review before signing.",
    matchedRules
  };
}
