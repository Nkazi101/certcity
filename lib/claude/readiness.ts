import { progressScope, readProgressItem, writeProgressItem } from "../progress-storage";
import { domainSampleMinimum, reassessmentMinutes } from "./assessment/forms";
import { examMinutes, julyGuideUrls } from "./blueprints";
import type { Track } from "./blueprints";
import { capstoneEvidence, validCapstoneAttempt, validNewCapstoneAttempt } from "./capstones";
import type { CapstoneAttempt } from "./capstones/model";
import { bridges } from "./curriculum/bridges";
import { objectiveCoverage } from "./curriculum";
import { decemberBlueprint, decemberVersion, rehearsalBlueprint } from "./december-blueprints";
import type { ExamVersion } from "./december-blueprints";
import { itemDomain, score, sessionItems } from "./practice";
import type { Attempt } from "./practice";
import { readinessKey } from "./progress-keys";

export { readinessKey } from "./progress-keys";

export type ReadinessProgress = {
  version?: ExamVersion;
  bridge: number[] | null;
  guide: string[];
  workshop: boolean;
  capstones: CapstoneAttempt[];
};

export const emptyReadiness: ReadinessProgress = { bridge: null, guide: [], workshop: false, capstones: [] };

function isBridge(track: Track, choices: unknown): choices is number[] {
  return Array.isArray(choices) && choices.length === bridges[track.id].checkpoints.length &&
    Array.from(choices).every((choice, index) => Number.isInteger(choice) && choice >= 0 && choice < bridges[track.id].checkpoints[index].choices.length);
}

function allowedGuideSkills(track: Track) {
  if (!decemberBlueprint(track)) return new Set<string>();
  return new Set<string>(objectiveCoverage(track, decemberVersion).flatMap(({ skills }) => skills.filter(({ activity }) => !!activity).map(({ id }) => id)));
}

export function readReadiness(track: Track): ReadinessProgress | null {
  try {
    const value = JSON.parse(readProgressItem(readinessKey(track)) ?? "null");
    if (!value || typeof value !== "object") return null;
    const valid = allowedGuideSkills(track);
    const capstones = new Map<string, CapstoneAttempt>();
    for (const attempt of Array.isArray(value.capstones) ? value.capstones : []) {
      if (validCapstoneAttempt(attempt) && attempt.trackId === track.id) capstones.set(attempt.id, attempt);
    }
    const guide = Array.isArray(value.guide) ? value.guide.filter((id: unknown): id is string => typeof id === "string" && valid.has(id)) : [];
    const version = value.version === "july-2026" || (value.version === decemberVersion && decemberBlueprint(track)) ? value.version as ExamVersion : undefined;
    return {
      version, bridge: isBridge(track, value.bridge) ? value.bridge : null,
      guide: [...new Set<string>(guide)], workshop: !!decemberBlueprint(track) && value.workshop === true,
      capstones: [...capstones.values()],
    };
  } catch {
    return null;
  }
}

type Action = { type: "version"; version: ExamVersion } | { type: "bridge"; choices: number[] } | { type: "guide"; objective: string } |
  { type: "workshop" } | { type: "submission"; attempt: CapstoneAttempt };

export async function updateReadiness(track: Track, fallback: ReadinessProgress, action: Action) {
  const scope = progressScope();
  const key = readinessKey(track);
  function apply() {
    if (scope !== progressScope()) return { progress: fallback, saved: false, error: "Your account changed. Try again." };
    const current = readReadiness(track) ?? fallback;
    let next = current;
    let error: string | null = null;
    if (action.type === "version") {
      if (action.version === decemberVersion && !decemberBlueprint(track)) error = "This guide is unavailable.";
      else if (current.version !== action.version) next = { ...current, version: action.version };
    } else if (action.type === "bridge") {
      if (!isBridge(track, action.choices)) error = "Answer all three starting questions.";
      else if (!current.bridge) next = { ...current, bridge: action.choices };
    } else if (action.type === "guide") {
      if (!allowedGuideSkills(track).has(action.objective)) error = "This guide activity is unavailable.";
      else if (!current.guide.includes(action.objective)) next = { ...current, guide: [...current.guide, action.objective] };
    } else if (action.type === "workshop") {
      if (!decemberBlueprint(track)) error = "This workshop is unavailable.";
      else if (!current.workshop) next = { ...current, workshop: true };
    } else {
      const { attempt } = action;
      if (!validNewCapstoneAttempt(attempt) || attempt.trackId !== track.id) error = "Check the practical case before submitting again.";
      else if (!current.capstones.some(({ id }) => id === attempt.id)) {
        const { transferDue } = capstoneEvidence(track.id, attempt.version, current.capstones, Date.now());
        if (attempt.stage === "transfer" && (transferDue === null || transferDue > attempt.submittedAt)) error = "The delayed case is still locked.";
        else next = { ...current, capstones: [...current.capstones, attempt] };
      }
    }
    if (next === current) return { progress: current, saved: true, error };
    try {
      return { progress: next, saved: writeProgressItem(key, JSON.stringify(next)), error };
    } catch {
      return { progress: next, saved: false, error };
    }
  }
  try {
    if (navigator.locks) return await navigator.locks.request(`${scope}:${key}`, apply);
  } catch {
    // Storage remains available when browser locks are disabled.
  }
  return apply();
}

export const rehearsalTarget = { overall: 80, domain: 67 };

export function timedEvidence(track: Track, version: ExamVersion, attempts: readonly Attempt[], now = Date.now()) {
  const blueprint = rehearsalBlueprint(track, version);
  const guideIdentity = (url: string) => version === "july-2026" && url === julyGuideUrls[track.id] ? blueprint.guide : url;
  const guideAttempts = attempts.filter((attempt) => (attempt.version ?? "july-2026") === version &&
    attempt.submittedAt >= attempt.startedAt && attempt.submittedAt <= now);
  const sorted = [...guideAttempts].sort((left, right) => left.submittedAt - right.submittedAt);
  const focused = sorted.flatMap((attempt) => {
    if (attempt.mode !== "reassessment" || attempt.domain === null || attempt.priorExposure?.length !== 0 ||
        attempt.deadline !== attempt.startedAt + (attempt.snapshot?.minutes ?? reassessmentMinutes) * 60_000) return [];
    const items = sessionItems(track, attempt);
    if (items.length !== domainSampleMinimum || items.length !== attempt.itemIds.length ||
        items.some((entry, index) => itemDomain(entry) !== attempt.domain || entry.pilot || entry.id !== attempt.itemIds[index])) return [];
    return [{ attempt, items, guide: guideIdentity(attempt.snapshot?.guide ?? blueprint.guide), correct: score(items, attempt.answers) }];
  });
  return sorted.flatMap((attempt) => {
    if (attempt.mode !== "assessment") return [];
    const form = sessionItems(track, attempt);
    if (form.length !== (attempt.snapshot?.guideCount ?? blueprint.count) || form.length !== attempt.itemIds.length ||
        form.some((entry, index) => entry.id !== attempt.itemIds[index])) return [];
    const items = form.filter(({ pilot }) => !pilot);
    const domains = (attempt.snapshot?.domains ?? blueprint.domains).map(({ id, title }) => {
      const group = items.filter((item) => itemDomain(item) === id);
      const correct = score(group, attempt.answers);
      const total = group.length;
      const supplemental = focused.findLast((entry) => entry.attempt.domain === id && entry.attempt.startedAt >= attempt.submittedAt &&
        entry.guide === guideIdentity(attempt.snapshot?.guide ?? blueprint.guide) &&
        entry.items.every(({ id: itemId }) => !attempt.itemIds.includes(itemId)));
      const replacesPriorSample = supplemental && total >= domainSampleMinimum;
      const sampleCorrect = (replacesPriorSample ? 0 : correct) + (supplemental?.correct ?? 0);
      const sampleTotal = (replacesPriorSample ? 0 : total) + (supplemental?.items.length ?? 0);
      const status = sampleTotal < domainSampleMinimum ? "insufficient"
        : Math.round(100 * sampleCorrect / sampleTotal) >= rehearsalTarget.domain ? "met" : "below";
      return { id, title, correct, total, sampleCorrect, sampleTotal, status, reassessed: !!supplemental } as const;
    });
    const correct = score(items, attempt.answers);
    const fresh = attempt.priorExposure?.length === 0;
    const timed = attempt.deadline === attempt.startedAt + (attempt.snapshot?.minutes ?? examMinutes) * 60_000;
    const overallMet = fresh && timed && correct * 100 >= rehearsalTarget.overall * items.length;
    const met = overallMet && domains.every(({ status }) => status === "met");
    return [{ attempt, domains, correct, total: items.length, fresh, overallMet, met }];
  });
}

export function benchmarkEvidence(track: Track, version: ExamVersion, progress: ReadinessProgress, attempts: readonly Attempt[], now: number) {
  const forms = timedEvidence(track, version, attempts, now);
  const timed = forms.find(({ met }) => met) ?? forms.filter(({ fresh }) => fresh).at(-1) ?? null;
  const practical = capstoneEvidence(track.id, version, progress.capstones, now);
  return { timed, practical, repeated: timed ? null : forms.at(-1) ?? null, met: !!(timed?.met && practical.capstone && practical.transfer) };
}
