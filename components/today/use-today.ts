"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Track } from "../../lib/claude/blueprints";
import { decemberBlueprint, decemberVersion } from "../../lib/claude/december-blueprints";
import type { ExamVersion } from "../../lib/claude/december-blueprints";
import { missionMappings } from "../../lib/claude/missions";
import { missionCompleted, missionsFor, portfolioEvidence } from "../../lib/claude/pathway";
import type { PortfolioRecords } from "../../lib/claude/pathway";
import { progressKey } from "../../lib/claude/progress-keys";
import type { readProgress as ReadProgress } from "../../lib/claude/progress";
import type { benchmarkEvidence as BenchmarkEvidence } from "../../lib/claude/benchmark";
import { cityEvidenceFor, emptyReadiness, readReadiness, readinessKey } from "../../lib/claude/readiness";
import { daysUntilExam, examDateKey, guideForExamDate, inCramWindow, readExamDate } from "../../lib/exam-date";
import { subscribeToProgress } from "../../lib/progress-storage";
import { missionSteps, planToday } from "../../lib/today/plan";
import type { PlanInput, TodayItem } from "../../lib/today/plan";
import { shiftKeys, shiftsForToday } from "../../lib/today/shifts";
import { localDay, readToday, saveToday, todayKey, todayStreak } from "../../lib/today/state";
import type { TodayState } from "../../lib/today/state";
import { places } from "../../lib/world";

const placeNames = Object.fromEntries(places.map(({ id, name }) => [id, name]));

export type TodayView = {
  items: (TodayItem & { done: boolean })[];
  more: TodayItem[];
  doneCount: number;
  minutesLeft: number;
  budget: number;
  streak: number;
  daysLeft: number | null;
  examDate: string | null;
  dismissDate: () => void;
};

type Snapshot = {
  input: PlanInput;
  attempts: number;
  capstones: number;
  examDate: string | null;
};

type Scoring = { benchmarkEvidence: typeof BenchmarkEvidence; readProgress: typeof ReadProgress };

function readSnapshot(track: Track, records: PortfolioRecords, legacy: ReadonlySet<string>, now: number, state: TodayState, { benchmarkEvidence, readProgress }: Scoring): Snapshot {
  const examDate = readExamDate(track.id);
  const readiness = readReadiness(track) ?? emptyReadiness;
  const attempts = readProgress(track)?.attempts ?? [];
  const version: ExamVersion = readiness.version ?? (decemberBlueprint(track) ? (examDate ? guideForExamDate(examDate) : decemberVersion) : "july-2026");
  const missions = missionsFor(track.id);
  const starter = missions.find(({ kind }) => kind === "original" || kind === "dispatch");
  const portfolio = portfolioEvidence(track, records, legacy);
  const city = cityEvidenceFor(track, version, portfolio.applied, portfolio.covered);
  const cram = inCramWindow(examDate, now);
  const benchmark = benchmarkEvidence(track, version, readiness, attempts, now, { cram, city });
  const timed = benchmark.timed ?? benchmark.repeated;
  const weakDomains = (timed?.domains ?? []).filter(({ status }) => status === "below").sort((left, right) => left.correct / Math.max(1, left.total) - right.correct / Math.max(1, right.total))
    .map(({ id, title }) => ({ id, title }));
  return {
    examDate, attempts: attempts.length, capstones: readiness.capstones.length,
    input: {
      track, now, examDate, daysLeft: examDate ? daysUntilExam(examDate, now) : null, missions, records, legacy,
      starterDone: !!starter && missionCompleted(starter, records, legacy), dateAsked: !!state.dateAsked,
      exam: { taken: !!timed, met: !!benchmark.timed?.met, weakDomains, confirmationNeeded: cram && !benchmark.confirmation },
      lab: { passed: !!benchmark.practical.capstone, transferDue: benchmark.practical.transferDue, transferPassed: !!benchmark.practical.transfer },
      city, applied: portfolio.applied, shifts: shiftsForToday(track.id, now),
    },
  };
}

/** What each item's progress reads now; it's done once this moves past the value stored when the day began. */
function measure(item: TodayItem, snapshot: Snapshot): number {
  const { records, legacy, missions, applied, shifts } = snapshot.input;
  const mission = item.action.type === "mission" ? missions.find(({ id }) => id === (item.action as { missionId: string }).missionId) : undefined;
  switch (item.kind) {
    case "case": return mission ? missionSteps(mission, records, legacy) : 0;
    case "wrapup": return mission ? missionSteps(mission, records, legacy) : 0;
    case "followup": return mission && records[mission.id]?.followup ? 1 : 0;
    case "redo": return mission ? missionMappings(mission).filter(({ objective }) => applied.has(objective)).length : 0;
    case "shift": return shifts.find(({ id }) => `shift:${id}` === item.key)?.doneToday ? 1 : 0;
    case "date": return snapshot.examDate || snapshot.input.dateAsked ? 1 : 0;
    case "exam": case "review": return snapshot.attempts;
    case "lab": case "transfer": return snapshot.capstones;
  }
}

/**
 * Today's work for a track. Fixes the day's list on first view (stored and synced), marks items done from real progress,
 * and keeps a streak of days with at least one finished item.
 */
export function useTodaysWork(track: Track | null, records: PortfolioRecords, legacy: ReadonlySet<string>): TodayView | null {
  const [tick, setTick] = useState(0);
  // Practice-exam scoring needs every question; load it after first paint. The day's list waits for it, so it's never
  // fixed without knowing whether a practice exam has been taken.
  const [scoring, setScoring] = useState<Scoring | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([import("../../lib/claude/benchmark"), import("../../lib/claude/progress")]).then(([benchmark, progress]) => {
      if (live) setScoring({ benchmarkEvidence: benchmark.benchmarkEvidence, readProgress: progress.readProgress });
    });
    return () => { live = false; };
  }, []);
  const legacyKey = [...legacy].sort().join();
  useEffect(() => {
    if (!track) return;
    const watched = new Set([todayKey(track.id), examDateKey(track.id), readinessKey(track), progressKey(track), ...shiftKeys]);
    const refresh = () => setTick((value) => value + 1);
    // A new day starts a new list even if the page stays open overnight.
    const timer = window.setInterval(refresh, 5 * 60_000);
    window.addEventListener("certcity:exam-date", refresh);
    const unsubscribe = subscribeToProgress((key) => { if (key === null || watched.has(key) || key.startsWith("certcity.mission.v1.")) refresh(); });
    return () => { window.clearInterval(timer); window.removeEventListener("certcity:exam-date", refresh); unsubscribe(); };
  }, [track]);

  const view = useMemo(() => {
    if (!track || !scoring || typeof window === "undefined") return null;
    const now = Date.now();
    const state = readToday(track.id);
    const snapshot = readSnapshot(track, records, new Set(legacyKey ? legacyKey.split(",") : []), now, state, scoring);
    const plan = planToday(snapshot.input, placeNames);
    const id = localDay(now);
    let day = state.days.find((entry) => entry.id === id);
    let changed = false;
    if (!day) {
      day = { id, items: plan.today.map((item) => ({ ...item, base: measure(item, snapshot) })), done: [] };
      changed = true;
    }
    const items = day.items.map((item) => {
      const done = day!.done.includes(item.key) || measure(item, snapshot) > (item.base ?? 0);
      return { ...item, done };
    });
    const newlyDone = items.filter(({ done, key }) => done && !day!.done.includes(key)).map(({ key }) => key);
    if (newlyDone.length) { day = { ...day, done: [...day.done, ...newlyDone] }; changed = true; }
    const nextState: TodayState = { ...state, days: [...state.days.filter((entry) => entry.id !== id), day] };
    const chosen = new Set(items.map(({ key }) => key));
    return {
      items, more: [...plan.today, ...plan.more].filter(({ key }) => !chosen.has(key)).slice(0, 4),
      doneCount: items.filter(({ done }) => done).length,
      minutesLeft: items.filter(({ done }) => !done).reduce((sum, { minutes }) => sum + minutes, 0),
      budget: plan.budget, streak: todayStreak(nextState, now),
      daysLeft: snapshot.input.daysLeft, examDate: snapshot.examDate,
      pending: changed ? nextState : null,
    };
    // tick re-reads storage when progress changes elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, records, legacyKey, tick, scoring]);

  // Store the day's list (and newly finished items) after render, never during it.
  useEffect(() => {
    if (track && view?.pending) saveToday(track.id, view.pending);
  }, [track, view]);

  const dismissDate = useCallback(() => {
    if (!track) return;
    const state = readToday(track.id);
    saveToday(track.id, { ...state, dateAsked: true });
    setTick((value) => value + 1);
  }, [track]);

  if (!view) return null;
  const { pending: _pending, ...rest } = view;
  return { ...rest, dismissDate };
}
