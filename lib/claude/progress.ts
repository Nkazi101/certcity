import { progressScope, readProgressItem, writeProgressItem } from "../progress-storage";
import { blueprint, examMinutes } from "./blueprints";
import type { Track } from "./blueprints";
import { decemberBlueprint, decemberVersion } from "./december-blueprints";
import { followupDue, itemDomain, rehearsalPriorExposure, responseComplete, sessionItems } from "./practice";
import { rehearsalFormIds, rehearsalItems } from "./assessment/forms";
import type { Attempt, Session } from "./practice";

export type Progress = {
  draft: Session | null;
  attempts: Attempt[];
  assignment: boolean;
  seen?: string[];
};

export const emptyProgress: Progress = { draft: null, attempts: [], assignment: false };

export function progressKey(track: Track) {
  return `certcity.practice.${track.code}.${blueprint}`;
}

function parseSession(track: Track, value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Partial<Session>;
  const { id, mode, version, form, priorExposure, domain, itemIds, answers, startedAt, deadline } = saved;
  if (typeof id !== "string" || !["mixed", "domain", "followup", "assessment"].includes(mode ?? "") ||
      (version !== undefined && (mode !== "assessment" ||
        version !== "july-2026" && (version !== decemberVersion || !decemberBlueprint(track)))) ||
      (form !== undefined && (mode !== "assessment" || !rehearsalFormIds.includes(form))) ||
      !Array.isArray(itemIds) || !itemIds.length || new Set(itemIds).size !== itemIds.length ||
      (priorExposure !== undefined && (mode !== "assessment" || !Array.isArray(priorExposure) ||
        new Set(priorExposure).size !== priorExposure.length || priorExposure.some((id) => !itemIds.includes(id)))) ||
      !startedAt || !Number.isSafeInteger(startedAt) || startedAt < 0 || startedAt > 8.64e15 ||
      (deadline !== null && (!deadline || !Number.isSafeInteger(deadline) || deadline <= startedAt || deadline > 8.64e15)) ||
      !answers || typeof answers !== "object" ||
      (mode === "domain" ? !track.domains.some((entry) => entry.id === domain) : domain !== null)) return null;
  const items = sessionItems(track, { mode: mode!, version, form, itemIds });
  if (items.length !== itemIds.length || (mode === "domain" && items.some((entry) => itemDomain(entry) !== domain))) return null;
  if (form) {
    const expected = rehearsalItems(track.id, version, form);
    if (deadline !== startedAt + examMinutes * 60_000 || expected.length !== itemIds.length ||
        expected.some((entry, index) => entry.id !== itemIds[index])) return null;
  }
  const cleanAnswers = Object.fromEntries(items.flatMap(({ id, options, correct }) => {
    const picks = answers[id];
    return Array.isArray(picks) && picks.length <= correct.length && new Set(picks).size === picks.length &&
      picks.every((value) => options.some(([key]) => key === value)) ? [[id, picks]] : [];
  }));
  const index = Number.isInteger(saved.index) ? Math.max(0, Math.min(items.length - 1, saved.index!)) : 0;
  return { id, mode: mode!, ...(version && { version }), ...(form && { form }), ...(priorExposure && { priorExposure }),
    domain: domain!, itemIds, answers: cleanAnswers, index, startedAt, deadline };
}

export function readProgress(track: Track): Progress | null {
  try {
    const saved = JSON.parse(readProgressItem(progressKey(track)) ?? "null");
    if (!saved || typeof saved !== "object") return null;
    const attempts: Attempt[] = [];
    for (const candidate of Array.isArray(saved.attempts) ? saved.attempts : []) {
      const session = parseSession(track, candidate);
      const submittedAt = candidate?.submittedAt;
      if (!session || !Number.isSafeInteger(submittedAt) || submittedAt < session.startedAt || submittedAt > 8.64e15 ||
          attempts.some(({ id }) => id === session.id)) continue;
      const { index: _index, ...attempt } = session;
      attempts.push({ ...attempt, submittedAt });
    }
    attempts.sort((a, b) => a.submittedAt - b.submittedAt);
    const draft = parseSession(track, saved.draft);
    const seen = Array.isArray(saved.seen) ? saved.seen.filter((id: unknown): id is string => typeof id === "string") : [];
    return { draft: attempts.some(({ id }) => id === draft?.id) ? null : draft, attempts, assignment: saved.assignment === true, seen };

  } catch {
    return null;
  }
}

type Action =
  | { type: "start"; draft: Session }
  | { type: "move"; id: string; index: number }
  | { type: "present"; id: string; itemId: string }
  | { type: "choose"; id: string; itemId: string; value: string }
  | { type: "submit"; id: string }
  | { type: "discard"; id: string };

export async function updateProgress(track: Track, fallback: Progress, action: Action) {
  const key = progressKey(track);
  const scope = progressScope();
  function apply() {
    if (progressScope() !== scope) return { progress: fallback, error: "Your account changed. Try again.", saved: false };
    const current = readProgress(track) ?? fallback;
    let next = current;
    let error: string | null = null;
    if (action.type === "discard") {
      if (current.draft?.id === action.id) next = { ...current, draft: null };
    } else if (action.type === "start") {
      const now = Date.now();
      const due = followupDue(current.attempts);
      const draft = parseSession(track, action.draft);
      if (current.draft) error = "Resume or discard the saved session before starting another.";
      else if (!draft) error = "This session could not be started.";
      else if (draft.mode === "followup" && (due === null || due > now || current.attempts.some(({ mode }) => mode === "followup"))) {
        error = "This follow-up is unavailable.";
      } else if (draft.mode === "assessment") {
        // A concurrent tab can have shown a question after the learner chose a form.
        const exposed = [...(current.seen ?? []), ...(draft.priorExposure ?? [])];
        const priorExposure = rehearsalPriorExposure(draft.itemIds, current.attempts, exposed);
        next = { ...current, draft: { ...draft, priorExposure },
          seen: [...new Set([...(current.seen ?? []), draft.itemIds[draft.index]])] };
      } else next = { ...current, draft };
    } else if (current.draft?.id !== action.id) {
      if (!current.attempts.some(({ id }) => id === action.id)) error = "This session was closed in another tab.";
    } else {
      const now = Date.now();
      const { draft } = current;
      const expired = draft.deadline !== null && now >= draft.deadline;
      const items = sessionItems(track, draft);
      if (action.type === "present") {
        if (draft.itemIds[draft.index] === action.itemId && !current.seen?.includes(action.itemId)) {
          next = { ...current, seen: [...(current.seen ?? []), action.itemId] };
        }
      } else if (action.type === "submit") {
        if (!expired && draft.mode !== "assessment" && items.some((entry) => !responseComplete(entry, draft.answers))) {
          error = "Answer every question before submitting.";
        } else {
          const { index: _index, ...attempt } = draft;
          next = { ...current, draft: null, attempts: [...current.attempts, { ...attempt, submittedAt: now }] };
        }
      } else if (!expired && action.type === "move" && items[action.index]) {
        next = { ...current, draft: { ...draft, index: action.index },
          ...(draft.mode === "assessment" && { seen: [...new Set([...(current.seen ?? []), items[action.index].id])] }) };
      } else if (!expired && action.type === "choose") {
        const question = items.find(({ id }) => id === action.itemId);
        if (question?.options.some(([value]) => value === action.value)) {
          const existing = draft.answers[question.id] ?? [];
          const picks = question.correct.length === 1 ? [action.value]
            : existing.includes(action.value) ? existing.filter((value) => value !== action.value)
            : [...existing, action.value];
          if (picks.length <= question.correct.length) {
            next = { ...current, draft: { ...draft, answers: { ...draft.answers, [question.id]: picks } } };
          }
        }
      }
    }
    if (error || next === current) return { progress: next, error, saved: null };
    try {
      return { progress: next, error, saved: writeProgressItem(key, JSON.stringify(next)) };
    } catch {
      return { progress: next, error, saved: false };
    }
  }
  try {
    if (navigator.locks) return await navigator.locks.request(scope + ":" + key, apply);
  } catch {
    // Local storage is still usable in browsers where locks are unavailable.
  }
  return apply();
}
