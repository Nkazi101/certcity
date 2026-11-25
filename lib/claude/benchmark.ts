import { domainSampleMinimum, reassessmentMinutes } from "./assessment/forms";
import { examMinutes, julyGuideUrls } from "./blueprints";
import type { Track } from "./blueprints";
import { capstoneEvidence } from "./capstones";
import { rehearsalBlueprint } from "./december-blueprints";
import type { ExamVersion } from "./december-blueprints";
import { itemDomain, score, sessionItems } from "./practice";
import type { Attempt } from "./practice";
import { rehearsalTarget } from "./readiness";
import type { cityEvidence, ReadinessProgress } from "./readiness";

// Scoring practice exams needs every question, so this lives apart from lib/claude/readiness.ts and is loaded on
// demand by the city (today's work, the skyline) instead of on first paint.

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

/**
 * The benchmark normally asks for a passed retention lab seven days after the first lab.
 * With the exam less than two weeks away there is no time for that delay, so a second
 * fresh practice exam that also meets the target stands in for the delayed evidence.
 */
export function benchmarkEvidence(track: Track, version: ExamVersion, progress: ReadinessProgress, attempts: readonly Attempt[], now: number, options: { cram?: boolean; city?: ReturnType<typeof cityEvidence> } = {}) {
  const forms = timedEvidence(track, version, attempts, now);
  const passing = forms.filter(({ met }) => met);
  const timed = passing[0] ?? forms.filter(({ fresh }) => fresh).at(-1) ?? null;
  const practical = capstoneEvidence(track.id, version, progress.capstones, now);
  const cram = !!options.cram;
  const confirmation = cram ? passing[1] ?? null : null;
  const delayed = !!practical.transfer || !!confirmation;
  const city = options.city ?? null;
  return { timed, practical, cram, confirmation, city, repeated: timed ? null : forms.at(-1) ?? null, met: !!(timed?.met && practical.capstone && delayed && (city?.met ?? true)) };
}
