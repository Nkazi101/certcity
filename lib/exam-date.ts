import type { TrackId } from "./claude/blueprints";
import { decemberVersion } from "./claude/december-blueprints";
import type { ExamVersion } from "./claude/december-blueprints";
import { readProgressItem, writeProgressItem } from "./progress-storage";

// The December 7 guides apply to exams on or after this date (US Central, as published).
export const decemberGuideStart = Date.parse("2026-12-07T00:00:00-06:00");
export const cramWindowDays = 14;
const legacyKey = (track: TrackId) => `certcity.exam-date.v1.${track}`;
/** Synced with the learner's account when signed in (see isProgressKey). */
export const examDateKey = (track: TrackId) => `certcity.exam-date.v2.${track}`;
const day = 86_400_000;
const valid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** A yyyy-mm-dd string, or null. Nothing sensitive. */
export function readExamDate(track: TrackId): string | null {
  try {
    const saved = readProgressItem(examDateKey(track));
    if (saved !== null) {
      const value = JSON.parse(saved)?.date;
      return valid(value) ? value : null;
    }
    const legacy = window.localStorage.getItem(legacyKey(track));
    return valid(legacy) ? legacy : null;
  } catch {
    return null;
  }
}

export function saveExamDate(track: TrackId, value: string | null) {
  try {
    writeProgressItem(examDateKey(track), JSON.stringify({ date: value && valid(value) ? value : null, setAt: Date.now() }));
    window.dispatchEvent(new CustomEvent("certcity:exam-date", { detail: track }));
  } catch {
    // The date still applies for this page view.
  }
}

/** Noon local time avoids off-by-one days around midnight and DST changes. */
export function examTime(value: string) {
  return new Date(`${value}T12:00:00`).getTime();
}

/** Calendar days from today to the exam date, in the viewer's time zone. */
export function daysUntilExam(value: string, now = Date.now()) {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime();
  return Math.round((examTime(value) - start) / day);
}

export function guideForExamDate(value: string): ExamVersion {
  return examTime(value) >= decemberGuideStart ? decemberVersion : "july-2026";
}

export function inCramWindow(value: string | null, now = Date.now()) {
  if (!value) return false;
  const days = daysUntilExam(value, now);
  return days >= 0 && days < cramWindowDays;
}
