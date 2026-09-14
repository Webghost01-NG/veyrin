export const maxPcztLength = 1_500_000;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Finding {
  path: string;
  value: string;
}

export interface InspectionChange {
  path: string;
  before: string;
  after: string;
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

export function diffInspections(beforeValue: JsonValue, afterValue: JsonValue): InspectionChange[] {
  const before = new Map(flattenJson(beforeValue).map((entry) => [entry.path, entry.value]));
  const after = new Map(flattenJson(afterValue).map((entry) => [entry.path, entry.value]));

  return [...new Set([...before.keys(), ...after.keys()])]
    .sort()
    .filter((path) => before.get(path) !== after.get(path))
    .map((path) => ({
      path,
      before: before.has(path) ? before.get(path)! : "∅",
      after: after.has(path) ? after.get(path)! : "∅"
    }));
}
