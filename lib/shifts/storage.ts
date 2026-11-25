import { readProgressItem, writeProgressItem } from "../progress-storage";
import { emptyShiftState } from "./engine";
import type { ConceptRecord, ShiftRecord, ShiftState } from "./engine";

// Each shift is saved under certcity.shift.v1.<shift-id> through progress storage, so it follows a signed-in account.
// The value is a JSON object: `shifts` is a list of records that each carry a unique `id` (merge by id), and `concepts`
// is an object map of the spaced-review boxes.

export const shiftStorageKey = (id: string) => `certcity.shift.v1.${id}`;

/** Keys used before shifts were generalized; read once and copied forward. */
export const legacyShiftKeys: Readonly<Record<string, string>> = { dispatch: "certcity.dispatch-shift.v1" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function conceptMap(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, record]) => isRecord(record) &&
    ["box", "lastShift", "seen", "correct"].every((field) => typeof record[field] === "number"))) as Record<string, ConceptRecord>;
}

/** Accepts the current shape and the legacy City Dispatch shape (no record ids, falseNotFound at the top level). */
export function parseShiftState(value: unknown): ShiftState | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.shifts) || !isRecord(value.concepts)) return null;
  const used = new Set<string>();
  const shifts = value.shifts.filter(isRecord).filter((record) => typeof record.date === "string" && typeof record.number === "number")
    .map((record, index): ShiftRecord => {
      const counts: Record<string, number> = isRecord(record.counts)
        ? Object.fromEntries(Object.entries(record.counts).filter(([, count]) => typeof count === "number")) as Record<string, number> : {};
      if (typeof record.falseNotFound === "number" && counts.falseNotFound === undefined) counts.falseNotFound = record.falseNotFound;
      let id = typeof record.id === "string" && record.id ? record.id : record.practice ? `practice-${record.date}-${index + 1}` : String(record.date);
      while (used.has(id)) id = `${id}-${index + 1}`;
      used.add(id);
      return {
        id, number: record.number as number, date: record.date as string, practice: record.practice ? true : undefined,
        served: Number(record.served) || 0, correct: Number(record.correct) || 0, callbackMinutes: Number(record.callbackMinutes) || 0,
        counts, missed: Array.isArray(record.missed) ? record.missed.filter((entry): entry is string => typeof entry === "string") : [],
        proof: isRecord(record.proof) ? Object.fromEntries(Object.entries(record.proof).map(([key, right]) => [key, right === true])) : {},
      };
    })
    // Merged saves can arrive out of order; the schedule reads them by date.
    .sort((left, right) => left.date.localeCompare(right.date) || Number(!!left.practice) - Number(!!right.practice));
  return { version: 1, shifts, concepts: conceptMap(value.concepts) };
}

export function readShiftState<C extends string>(id: string): ShiftState<C> {
  if (typeof window === "undefined") return emptyShiftState<C>();
  try {
    const stored = readProgressItem(shiftStorageKey(id));
    if (stored !== null) return (parseShiftState(JSON.parse(stored)) ?? emptyShiftState()) as ShiftState<C>;
    const legacyKey = legacyShiftKeys[id];
    const legacy = legacyKey ? parseShiftState(JSON.parse(window.localStorage.getItem(legacyKey) ?? "null")) : null;
    if (!legacy) return emptyShiftState<C>();
    // Copy the old save forward once; the old key stays as it was in case an older tab still reads it.
    writeProgressItem(shiftStorageKey(id), JSON.stringify(legacy));
    return legacy as ShiftState<C>;
  } catch {
    return emptyShiftState<C>();
  }
}

export function saveShiftState(id: string, state: ShiftState) {
  try {
    return writeProgressItem(shiftStorageKey(id), JSON.stringify(state));
  } catch {
    // The shift still plays; progress lasts for this page view.
    return false;
  }
}
