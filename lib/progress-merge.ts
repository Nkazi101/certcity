const collectionFields = new Set(["attempts", "capstones", "checkHistory", "guide", "seen", "interviewed", "lensItems", "reviewed", "studied", "days", "shifts"]);
const achievementFields = new Set(["assignment", "workshop", "legacyVerified", "debriefSeen", "practiced"]);
const mapFields = new Set(["answers", "rehearsalArchives", "lensExposure", "reviews", "concepts"]);
const incompatible = Symbol("conflicting changes");

// Matches the learner_progress payload check (supabase/migrations/20261124230000_progress_payload_limit.sql).
export const maxProgressSaveBytes = 2_097_152;
export const fitsProgressSave = (value: string) => new TextEncoder().encode(value).length <= maxProgressSaveBytes;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function equal(left: unknown, right: unknown) {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function keysOf(base: unknown, left: Record<string, unknown>, right: Record<string, unknown>) {
  return new Set([...Object.keys(record(base) ? base : {}), ...Object.keys(left), ...Object.keys(right)]);
}

function collection(base: unknown, left: unknown[], right: unknown[]) {
  const idOf = (value: unknown) => record(value) && typeof value.id === "string" ? "id:" + value.id : "value:" + JSON.stringify(value);
  const merged = new Map<ReturnType<typeof idOf>, unknown>();
  for (const value of [...(Array.isArray(base) ? base : []), ...left, ...right]) {
    const id = idOf(value);
    if (merged.has(id) && !equal(merged.get(id), value)) return incompatible;
    merged.set(id, value);
  }
  return [...merged.values()];
}

function mergeFields(base: unknown, left: Record<string, unknown>, right: Record<string, unknown>, rule: typeof mergeField) {
  const entries: [string, unknown][] = [];
  for (const key of keysOf(base, left, right)) {
    const value = rule(record(base) ? base[key] : undefined, left[key], right[key], key);
    if (value === incompatible) return incompatible;
    if (value !== undefined) entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

function mergeField(base: unknown, left: unknown, right: unknown, field: string): unknown {
  if (equal(left, right)) return left;
  if (collectionFields.has(field) && Array.isArray(left) && Array.isArray(right)) return collection(base, left, right);
  if (achievementFields.has(field) && (left === true || right === true)) return true;
  if (equal(left, base)) return right;
  if (equal(right, base)) return left;

  if (field === "draft" && record(left) && record(right) && typeof left.id === "string" && left.id === right.id) {
    return mergeFields(base, left, right, (prior, local, cloud, key) => {
      if (key === "index" && Number.isSafeInteger(local) && Number.isSafeInteger(cloud)) return Math.max(local as number, cloud as number);
      return mergeField(prior, local, cloud, key);
    });
  }
  if (mapFields.has(field) && record(left) && record(right)) {
    return mergeFields(base, left, right, (prior, local, cloud) => {
      if (field === "lensExposure" && typeof local === "number" && typeof cloud === "number") return Math.min(local, cloud);
      if (equal(local, cloud) || equal(cloud, prior)) return local;
      if (equal(local, prior)) return cloud;
      return incompatible;
    });
  }
  return incompatible;
}

/** Merge independent attempts and achievements. Keep competing artifacts as separate recovery copies. */
export function mergeProgressValues(key: string, base: string | null, left: string, right: string): string | null {
  if (left === right || right === base) return left;
  if (left === base) return right;
  if (key === "certcity.city.active-assignment.v1") return null;
  try {
    const local: unknown = JSON.parse(left);
    const cloud: unknown = JSON.parse(right);
    const previous: unknown = base === null ? null : JSON.parse(base);
    if (!record(local) || !record(cloud)) return null;
    const merged = mergeFields(previous, local, cloud, mergeField);
    if (merged === incompatible) return null;
    if (record(merged.draft) && Array.isArray(merged.attempts) && merged.attempts.some((attempt) => record(attempt) && attempt.id === (merged.draft as Record<string, unknown>).id)) {
      merged.draft = null;
    }
    const encoded = JSON.stringify(merged);
    return fitsProgressSave(encoded) ? encoded : null;
  } catch {
    return null;
  }
}
