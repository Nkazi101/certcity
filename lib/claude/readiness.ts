import { progressScope, readProgressItem, writeProgressItem } from "../progress-storage";
import type { Track } from "./blueprints";
import { capstoneEvidence, validCapstoneAttempt, validNewCapstoneAttempt } from "./capstones";
import type { CapstoneAttempt } from "./capstones/model";
import { bridges } from "./curriculum/bridges";
import { objectiveCoverage } from "./curriculum";
import { decemberBlueprint, decemberVersion, rehearsalBlueprint } from "./december-blueprints";
import type { ExamVersion } from "./december-blueprints";
import { readinessKey } from "./progress-keys";
import { lessonObjectiveFor } from "./lessons/paths";

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
      if (!validNewCapstoneAttempt(attempt) || attempt.trackId !== track.id) error = "Check the practical mission before submitting again.";
      else if (!current.capstones.some(({ id }) => id === attempt.id)) {
        const { transferDue } = capstoneEvidence(track.id, attempt.version, current.capstones, Date.now());
        if (attempt.stage === "transfer" && (transferDue === null || transferDue > attempt.submittedAt)) error = "The delayed scenario is still locked.";
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

/**
 * City cases count toward ready. The city teaches by doing first, so the bar asks for that doing: every exam domain
 * the track's cases cover needs at least one objective applied in a case on your own (no revealed answer or worked
 * example). A handful of cases meets it; it never requires finishing the whole city.
 */
/** City cases are tagged with their original guide's objectives; count them in the guide the learner is preparing for. */
export function cityEvidenceFor(track: Track, version: ExamVersion | undefined, applied: ReadonlySet<string>, covered: ReadonlySet<string>) {
  if (version !== decemberVersion || track.id === "architect-foundations") return cityEvidence(track, applied, covered);
  const map = (objectives: ReadonlySet<string>) => new Set([...objectives].map((objective) => lessonObjectiveFor(track, undefined, objective)).filter((entry): entry is string => !!entry));
  return cityEvidence(rehearsalBlueprint(track, version), map(applied), map(covered));
}

export function cityEvidence(track: Pick<Track, "domains">, applied: ReadonlySet<string>, covered: ReadonlySet<string>) {
  const inDomain = (id: number) => (objective: string) => Number(objective.split(".")[0]) === id;
  const domains = track.domains.map(({ id, title }) => ({
    id, title,
    covered: [...covered].filter(inDomain(id)).length,
    applied: [...applied].filter(inDomain(id)).length,
  })).filter(({ covered: count }) => count > 0);
  return { domains, applied: domains.filter(({ applied: count }) => count > 0).length, met: domains.every(({ applied: count }) => count > 0) };
}

