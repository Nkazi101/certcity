import { isCorrect } from "../certification-progress";
import { associateBank } from "./associate";
import { developerBank } from "./developer";
import { architectBank } from "./architect";
import { professionalBank } from "./professional";
import type { PracticeBank, PracticeItem } from "./items";
import { examMinutes } from "./blueprints";
import { rehearsalItems } from "./assessment/forms";
import type { ExamVersion } from "./december-blueprints";
import type { Track, TrackId } from "./blueprints";

export const banks: Record<TrackId, PracticeBank> = {
  "associate-foundations": associateBank,
  "developer-foundations": developerBank,
  "architect-foundations": architectBank,
  "architect-professional": professionalBank,
};

export type PracticeMode = "mixed" | "domain" | "followup" | "assessment";
export type Answers = Record<string, string[]>;
export type Session = {
  id: string;
  mode: PracticeMode;
  version?: ExamVersion;
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

export function sessionItems(track: Track, session: Pick<Session, "mode" | "itemIds" | "version">) {
  const bank = banks[track.id];
  const pool = session.mode === "assessment" ? rehearsalItems(track.id, session.version) : session.mode === "followup" ? bank.followup : bank.practice;
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

export function domainEvidence(track: Track, attempts: readonly Attempt[], cityExposure?: ReadonlyMap<string, number>) {
  const firstAnswers = new Map<string, boolean>();
  const reviewed = new Set<string>();
  const firstObjectives = new Map<number, Set<string>>();
  const domainScores = new Map<number, number>();
  const domainCounts = new Map<number, number>();
  for (const attempt of attempts) {
    if (attempt.mode === "followup" || attempt.mode === "assessment") continue;
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

export function createSession(track: Track, mode: PracticeMode, domain: number | null, timed: boolean, attempts: readonly Attempt[], now: number, exposed: Iterable<string> = [], version?: ExamVersion): Session {
  const bank = banks[track.id];
  const seen = new Set([...domainEvidence(track, attempts).reviewed, ...exposed]);
  const questions = (id: number) => bank.practice.filter((entry) => itemDomain(entry) === id)
    .sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
  let items: readonly PracticeItem[];
  if (mode === "assessment") {
    items = rehearsalItems(track.id, version);
  } else if (mode === "followup") {
    items = bank.followup;
  } else if (mode === "domain") {
    items = questions(domain ?? 0);
  } else {
    // Start with one item per domain. Give the remaining places to the largest weight shortfalls.
    const groups = track.domains.map(({ id, weight }) => ({ weight, pool: questions(id), selected: 1 }));
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
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`,
    mode, ...(mode === "assessment" && version && { version }), domain, itemIds: items.map(({ id }) => id), answers: {}, index: 0, startedAt: now,
    deadline: mode === "assessment" ? now + examMinutes * 60_000
      : timed ? now + Math.ceil(items.length * examMinutes / track.count) * 60_000 : null,
  };
}

export function followupDue(attempts: readonly Attempt[]) {
  const first = attempts.find(({ mode }) => mode === "mixed");
  return first ? first.submittedAt + 7 * 24 * 60 * 60 * 1000 : null;
}
