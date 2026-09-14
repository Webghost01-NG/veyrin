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
