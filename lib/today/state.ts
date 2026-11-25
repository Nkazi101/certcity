import type { TrackId } from "../claude/blueprints";
import { readProgressItem, writeProgressItem } from "../progress-storage";
import type { TodayItem } from "./plan";

/**
 * The day's list is fixed when first shown, so finishing one item never reshuffles the rest. Each stored item keeps the
 * value its progress measure had at that moment (`base`); it's done once the measure moves past it. Synced per track.
 */
export type TodayDay = { id: string; items: TodayItem[]; done: string[] };
export type TodayState = { days: TodayDay[]; dateAsked?: boolean };

export const todayKey = (track: TrackId) => `certcity.today.v1.${track}`;
const keepDays = 60;

export function localDay(now = Date.now()) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function readToday(track: TrackId): TodayState {
  try {
    const value = JSON.parse(readProgressItem(todayKey(track)) ?? "null");
    if (!value || typeof value !== "object" || !Array.isArray(value.days)) return { days: [] };
    const days = value.days.filter((day: unknown): day is TodayDay => !!day && typeof day === "object" &&
      typeof (day as TodayDay).id === "string" && Array.isArray((day as TodayDay).items) && Array.isArray((day as TodayDay).done));
    return { days, dateAsked: value.dateAsked === true };
  } catch {
    return { days: [] };
  }
}

export function saveToday(track: TrackId, state: TodayState) {
  try {
    const days = [...state.days].sort((left, right) => left.id.localeCompare(right.id)).slice(-keepDays);
    return writeProgressItem(todayKey(track), JSON.stringify({ ...state, days }));
  } catch {
    return false;
  }
}

/** Days in a row with at least one finished item, counting back from today (or yesterday, before today's first). */
export function todayStreak(state: TodayState, now = Date.now()) {
  const active = new Set(state.days.filter(({ done }) => done.length > 0).map(({ id }) => id));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!active.has(localDay(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(localDay(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
