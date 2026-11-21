import { progressScope, readProgressItem, writeProgressItem } from "../progress-storage";
import { examMinutes } from "./blueprints";
import type { Track } from "./blueprints";
import { decemberBlueprint, decemberVersion, rehearsalBlueprint } from "./december-blueprints";
import { createSession, followupDue, itemDomain, practiceModes, rehearsalPriorExposure, responseComplete, sessionItems } from "./practice";
import { reassessmentMinutes, rehearsalFormIds, rehearsalItems } from "./assessment/forms";
import { evidenceRecord } from "./evidence-snapshot";
import { packRehearsalSnapshot, unpackRehearsalSnapshot, validRehearsalSnapshot } from "./rehearsal-snapshot";
import type { PackedRehearsalSnapshot, RehearsalSnapshot } from "./rehearsal-snapshot";
import type { Attempt, Session } from "./practice";
import { progressKey } from "./progress-keys";

export { progressKey } from "./progress-keys";

export type Progress = {
  draft: Session | null;
  attempts: Attempt[];
  assignment: boolean;
  seen?: string[];
};

export const emptyProgress: Progress = { draft: null, attempts: [], assignment: false };

type ReadRehearsalArchive = (
  id: string, version: Session["version"], form: Session["form"], domain: Session["domain"] | undefined,
) => RehearsalSnapshot | null;

function parseSession(track: Track, value: unknown, readArchive?: ReadRehearsalArchive): Session | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Partial<Session> & { snapshotId?: string };
  const { id, mode, version, form, priorExposure, domain, objective, itemIds, answers, startedAt, deadline } = saved;
  if (typeof id !== "string" || !mode || !practiceModes.includes(mode) ||
      (version !== undefined && version !== "july-2026" && (version !== decemberVersion || !decemberBlueprint(track))) ||
      (form !== undefined && (mode !== "assessment" || !rehearsalFormIds.includes(form))) ||
      (objective !== undefined && (mode !== "domain" || typeof objective !== "string" || !/^\d+\.\d+$/.test(objective))) ||
      !Array.isArray(itemIds) || !itemIds.length || new Set(itemIds).size !== itemIds.length ||
      (priorExposure !== undefined && (mode !== "assessment" && mode !== "reassessment" || !Array.isArray(priorExposure) ||
        new Set(priorExposure).size !== priorExposure.length || priorExposure.some((id) => !itemIds.includes(id)))) ||
      !startedAt || !Number.isSafeInteger(startedAt) || startedAt < 0 || startedAt > 8.64e15 ||
      (deadline !== null && (!deadline || !Number.isSafeInteger(deadline) || deadline <= startedAt || deadline > 8.64e15)) ||
      !answers || typeof answers !== "object" ||
      (mode === "domain" || mode === "reassessment"
        ? !rehearsalBlueprint(track, version).domains.some((entry) => entry.id === domain) && saved.snapshot === undefined && saved.snapshotId === undefined
        : domain !== null)) return null;
  let snapshot: RehearsalSnapshot | undefined;
  if (saved.snapshot !== undefined || saved.snapshotId !== undefined) {
    if (mode !== "assessment" && mode !== "reassessment") return null;
    const archived = saved.snapshotId === undefined
      ? validRehearsalSnapshot(saved.snapshot, track, version, form, domain) ? saved.snapshot : null
      : typeof saved.snapshotId === "string" ? readArchive?.(saved.snapshotId, version, form, domain) : null;
    if (!archived || deadline !== startedAt + archived.minutes * 60_000 ||
        archived.items.length !== itemIds.length || archived.items.some(({ id: itemId }, index) => itemId !== itemIds[index])) return null;
    snapshot = archived;
  }
  const items = sessionItems(track, { mode, version, form, itemIds, domain, snapshot });
  if (items.length !== itemIds.length || ((mode === "domain" || mode === "reassessment") &&
      items.some((entry) => itemDomain(entry) !== domain || (objective !== undefined && entry.objective !== objective)))) return null;
  if (!snapshot && form && form !== "recovery") {
    const expected = rehearsalItems(track.id, version, form);
    if (deadline !== startedAt + examMinutes * 60_000 || expected.length !== itemIds.length ||
        expected.some((entry, index) => entry.id !== itemIds[index])) return null;
  }
  if (!snapshot && (form === "recovery" || mode === "reassessment") &&
      deadline !== startedAt + (mode === "reassessment" ? reassessmentMinutes : examMinutes) * 60_000) return null;
  const cleanAnswers = Object.fromEntries(items.flatMap(({ id, options, correct }) => {
    const picks = answers[id];
    return Array.isArray(picks) && picks.length <= correct.length && new Set(picks).size === picks.length &&
      picks.every((value) => options.some(([key]) => key === value)) ? [[id, picks]] : [];
  }));
  const index = Number.isInteger(saved.index) ? Math.max(0, Math.min(items.length - 1, saved.index!)) : 0;
  return { id, mode, ...(version && { version }), ...(form && { form }), ...(priorExposure && { priorExposure }),
    ...(objective && { objective }), ...(snapshot && { snapshot }),
    domain: domain!, itemIds, answers: cleanAnswers, index, startedAt, deadline };
}

export function readProgress(track: Track): Progress | null {
  try {
    const saved = JSON.parse(readProgressItem(progressKey(track)) ?? "null");
    if (!saved || typeof saved !== "object") return null;
    const archives = evidenceRecord(saved.rehearsalArchives) ? saved.rehearsalArchives : {};
    const validated = new Map<string, RehearsalSnapshot | null>();
    const readArchive: ReadRehearsalArchive = (id, version, form, domain) => {
      if (!/^[a-f0-9]{16}$/.test(id) || !Object.hasOwn(archives, id)) return null;
      const key = [id, version, form, domain].join("|");
      if (validated.has(key)) return validated.get(key) ?? null;
      const archive = unpackRehearsalSnapshot(archives[id]);
      const snapshot = validRehearsalSnapshot(archive, track, version, form, domain) && archive.id === id ? archive : null;
      validated.set(key, snapshot);
      return snapshot;
    };
    const attempts: Attempt[] = [];
    for (const candidate of Array.isArray(saved.attempts) ? saved.attempts : []) {
      const session = parseSession(track, candidate, readArchive);
      const submittedAt = candidate?.submittedAt;
      if (!session || !Number.isSafeInteger(submittedAt) || submittedAt < session.startedAt || submittedAt > 8.64e15 ||
          attempts.some(({ id }) => id === session.id)) continue;
      const { index: _index, ...attempt } = session;
      attempts.push({ ...attempt, submittedAt });
    }
    attempts.sort((a, b) => a.submittedAt - b.submittedAt);
    const draft = parseSession(track, saved.draft, readArchive);
    const seen = Array.isArray(saved.seen) ? saved.seen.filter((id: unknown): id is string => typeof id === "string") : [];
    return { draft: attempts.some(({ id }) => id === draft?.id) ? null : draft, attempts, assignment: saved.assignment === true, seen };

  } catch {
    return null;
  }
}

function serializeProgress(progress: Progress) {
  const rehearsalArchives: Record<string, PackedRehearsalSnapshot> = {};
  function archive<T extends Session | Attempt>(session: T) {
    const { snapshot, ...rest } = session;
    if (!snapshot) return rest;
    rehearsalArchives[snapshot.id] ??= packRehearsalSnapshot(snapshot);
    return { ...rest, snapshotId: snapshot.id };
  }
  const attempts = progress.attempts.map(archive);
  const draft = progress.draft ? archive(progress.draft) : null;
  return JSON.stringify({ ...progress, attempts, draft, rehearsalArchives });
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
      const draft = parseSession(track, action.draft);
      const due = followupDue(current.attempts, draft?.version);
      if (current.draft) error = "Resume or discard the saved session before starting another.";
      else if (!draft) error = "This session could not be started.";
      else if (draft.mode === "followup" && (due === null || due > now || current.attempts.some((attempt) =>
        attempt.mode === "followup" && (attempt.version ?? "july-2026") === (draft.version ?? "july-2026")))) {
        error = "This follow-up is unavailable.";
      } else if (draft.mode === "assessment" || draft.mode === "reassessment") {
        // A concurrent tab can have shown a question after the learner chose a form.
        const exposed = [...(current.seen ?? []), ...(draft.priorExposure ?? [])];
        const priorExposure = rehearsalPriorExposure(draft.itemIds, current.attempts, exposed);
        const expected = createSession(track, draft.mode, draft.domain, true, current.attempts, draft.startedAt, exposed, draft.version, draft.form);
        if ((draft.form === "recovery" || draft.mode === "reassessment") &&
            (priorExposure.length > 0 || draft.itemIds.some((id, index) => id !== expected.itemIds[index]))) {
          error = "The fresh question set changed. Start again to use questions you have not seen.";
        } else if (draft.snapshot && draft.snapshot.id !== expected.snapshot?.id) {
          error = "This rehearsal form changed. Start it again to use the current version.";
        } else {
          next = { ...current, draft: { ...draft, priorExposure },
            seen: [...new Set([...(current.seen ?? []), draft.itemIds[draft.index]])] };
        }
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
          ...((draft.mode === "assessment" || draft.mode === "reassessment") && { seen: [...new Set([...(current.seen ?? []), items[action.index].id])] }) };
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
      return { progress: next, error, saved: writeProgressItem(key, serializeProgress(next)) };
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
