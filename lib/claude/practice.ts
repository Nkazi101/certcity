import { isCorrect } from "../certification-progress";
import type { PracticeBank, PracticeItem } from "./items";
import { answeredBeforeRelease } from "./items";
import { examMinutes } from "./blueprints";
import { reassessmentMinutes, rehearsalFormIds, rehearsalItems, savedRecoveryItems, selectReassessment } from "./assessment/forms";
import type { RehearsalForm } from "./assessment/forms";
import { decemberVersion, rehearsalBlueprint } from "./december-blueprints";
import type { ExamVersion } from "./december-blueprints";
import type { Track, TrackId } from "./blueprints";
import { revisedPracticeBanks } from "./curriculum/revised-practice";
import { createRehearsalSnapshot } from "./rehearsal-snapshot";
import type { RehearsalSnapshot } from "./rehearsal-snapshot";

import { banks } from "./banks";
export { banks };

export const practiceModes = ["mixed", "domain", "followup", "assessment", "reassessment"] as const;
export type PracticeMode = (typeof practiceModes)[number];
export type Answers = Record<string, string[]>;
export type Session = {
  id: string;
  mode: PracticeMode;
  version?: ExamVersion;
  form?: RehearsalForm;
  priorExposure?: string[];
  objective?: string;
  snapshot?: RehearsalSnapshot;
  domain: number | null;
  itemIds: string[];
  answers: Answers;
  index: number;
  startedAt: number;
  deadline: number | null;
};
export type Attempt = Omit<Session, "index"> & { submittedAt: number };

export function itemDomain(item: PracticeItem) {
  return Number(item.objective.split(".")[0]);
}

export function objectiveTitle(track: Pick<Track, "domains">, item: PracticeItem) {
  const [domain, objective] = item.objective.split(".").map(Number);
  return track.domains.find((entry) => entry.id === domain)?.objectives[objective - 1] ?? item.objective;
}

export function practiceBank(track: TrackId, version?: ExamVersion) {
  return (version === decemberVersion ? revisedPracticeBanks[track] : undefined) ?? banks[track];
}

export function sessionItems(track: Track, session: Pick<Session, "mode" | "itemIds" | "version" | "form"> & Partial<Pick<Session, "snapshot" | "domain">>) {
  if (session.snapshot) return [...session.snapshot.items];
  if (session.mode === "reassessment" || session.form === "recovery") {
    return savedRecoveryItems(track.id, session.version, session.itemIds, session.domain ?? null);
  }
  const bank = practiceBank(track.id, session.version);
  const pool = session.mode === "assessment" ? rehearsalItems(track.id, session.version, session.form) : session.mode === "followup" ? bank.followup : bank.practice;
  const byId = new Map(pool.map((entry) => [entry.id, entry]));
  return session.itemIds.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
}

export function responseComplete(item: PracticeItem, answers: Answers) {
  return answers[item.id]?.length === item.correct.length;
}

export function score(items: readonly PracticeItem[], answers: Answers) {
  return items.filter((entry) => isCorrect(entry, answers[entry.id] ?? [])).length;
}

export function domainEvidence(track: Track, attempts: readonly Attempt[], cityExposure?: ReadonlyMap<string, number>, version: ExamVersion = "july-2026") {
  const firstAnswers = new Map<string, boolean>();
  const reviewed = new Set<string>();
  const firstObjectives = new Map<number, Set<string>>();
  const domainScores = new Map<number, number>();
  const domainCounts = new Map<number, number>();
  for (const attempt of attempts) {
    if (attempt.mode !== "mixed" && attempt.mode !== "domain" || (attempt.version ?? "july-2026") !== version) continue;
    if (answeredBeforeRelease(attempt.submittedAt)) continue;
    for (const entry of sessionItems(track, attempt)) {
      if (reviewed.has(entry.id) || !responseComplete(entry, attempt.answers)) continue;
      reviewed.add(entry.id);
      if ((cityExposure?.get(entry.id) ?? Infinity) <= attempt.submittedAt) continue;
      const correct = isCorrect(entry, attempt.answers[entry.id]);
      firstAnswers.set(entry.id, correct);
      const id = itemDomain(entry);
      const objectives = firstObjectives.get(id) ?? new Set<string>();
      objectives.add(entry.objective);
      firstObjectives.set(id, objectives);
      domainCounts.set(id, (domainCounts.get(id) ?? 0) + 1);
      domainScores.set(id, (domainScores.get(id) ?? 0) + Number(correct));
    }
  }
  return { firstAnswers, firstObjectives, domainScores, domainCounts, reviewed };
}

export function rehearsalPriorExposure(itemIds: readonly string[], attempts: readonly Attempt[], exposed: Iterable<string> = []) {
  const seen = questionExposure(attempts, exposed);
  return itemIds.filter((id) => seen.has(id));
}

function questionExposure(attempts: readonly Attempt[], exposed: Iterable<string>) {
  return new Set([...exposed, ...attempts.flatMap((attempt) => attempt.itemIds)]);
}

export function reassessmentItems(track: TrackId, version: ExamVersion | undefined, domain: number, attempts: readonly Attempt[], exposed: Iterable<string> = []) {
  return selectReassessment(track, version, domain, questionExposure(attempts, exposed));
}

export function rehearsalForms(track: TrackId, version: ExamVersion | undefined, attempts: readonly Attempt[], exposed: Iterable<string> = []) {
  const seen = questionExposure(attempts, exposed);
  return rehearsalFormIds.map((form) => {
    const items = rehearsalItems(track, version, form, seen);
    return {
      form, items, exposed: items.filter(({ id }) => seen.has(id)).length,
      completed: form !== "recovery" && attempts.some((attempt) => attempt.mode === "assessment" &&
        (attempt.version ?? "july-2026") === (version ?? "july-2026") && (attempt.form ?? "original") === form),
    };
  });
}

export function createSession(track: Track, mode: PracticeMode, domain: number | null, timed: boolean, attempts: readonly Attempt[], now: number, exposed: Iterable<string> = [], version?: ExamVersion, form: RehearsalForm = "original", objective?: string): Session {
  const bank = practiceBank(track.id, version);
  const guide = rehearsalBlueprint(track, version);
  const seen = questionExposure(attempts, exposed);
  const questions = (id: number) => bank.practice.filter((entry) => itemDomain(entry) === id)
    .sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
  let items: readonly PracticeItem[];
  if (mode === "assessment") {
    items = rehearsalItems(track.id, version, form, seen);
  } else if (mode === "reassessment") {
    items = selectReassessment(track.id, version, domain ?? 0, seen);
  } else if (mode === "followup") {
    items = bank.followup;
  } else if (mode === "domain") {
    items = questions(domain ?? 0).filter((entry) => !objective || objective === entry.objective);
  } else {
    // Start with one item per domain. Give the remaining places to the largest weight shortfalls.
    const groups = guide.domains.map(({ id, weight }) => ({ weight, pool: questions(id), selected: 1 }));
    const target = Math.min(12, bank.practice.length);
    for (let total = groups.length; total < target; total++) {
      const next = groups.filter(({ pool, selected }) => selected < pool.length)
        .sort((a, b) => (b.weight * target / 100 - b.selected) - (a.weight * target / 100 - a.selected))[0];
      if (!next) break;
      next.selected++;
    }
    // Alternate domains where possible, keeping one reproducible order for a saved session.
    items = Array.from({ length: Math.max(...groups.map(({ selected }) => selected)) }, (_, index) =>
      groups.flatMap(({ pool, selected }) => index < selected ? [pool[index]] : [])).flat();
  }
  const itemIds = items.map(({ id }) => id);
  const snapshot = !items.length ? undefined : mode === "assessment" ? createRehearsalSnapshot(track, version, form, items)
    : mode === "reassessment" ? createRehearsalSnapshot(track, version, undefined, items, domain, reassessmentMinutes) : undefined;
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`,
    mode, ...(version && { version }), ...(mode === "assessment" && { form }),
    ...(mode === "domain" && objective && { objective }),
    ...(snapshot && { snapshot, priorExposure: itemIds.filter((id) => seen.has(id)) }),
    domain, itemIds, answers: {}, index: 0, startedAt: now,
    deadline: mode === "assessment" ? now + examMinutes * 60_000
      : mode === "reassessment" ? now + reassessmentMinutes * 60_000
        : timed ? now + Math.ceil(items.length * examMinutes / guide.count) * 60_000 : null,
  };
}

export function followupDue(attempts: readonly Attempt[], version: ExamVersion = "july-2026") {
  const first = attempts.find((attempt) => attempt.mode === "mixed" && (attempt.version ?? "july-2026") === version);
  return first ? first.submittedAt + 7 * 24 * 60 * 60 * 1000 : null;
}
