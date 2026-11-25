import { decemberBlueprints, decemberVersion, hasDecemberGuide } from "../december-blueprints";
import type { ExamVersion } from "../december-blueprints";
import { alignItem, associateAlignment, developerAlignment, professionalAlignment } from "./december-alignment";
import type { Alignment } from "./december-alignment";
import { decemberAssociateCases, decemberDeveloperCases, decemberProfessionalCases } from "./december-cases";
import { tracks } from "../blueprints";
import type { Domain } from "../blueprints";
import type { TrackId } from "../blueprints";
import type { PracticeItem } from "../items";
import { architectAssessment } from "./architect";
import { associateAssessment } from "./associate";
import { developerAssessment } from "./developer";
import { professionalAssessment } from "./professional";
import { associateRetest, associateDecemberRetest } from "./retest-associate";
import { developerRetest, developerDecemberRetest } from "./retest-developer";
import { architectRetest } from "./retest-architect";
import { professionalRetest, professionalDecemberRetest } from "./retest-professional";
import { arrangeRetest } from "./retest-author";
import { recoveryBank } from "./recovery-bank";
import { developerProfessionalAssessment } from "./developer-professional";
import { developerProfessionalRetest } from "./developer-professional-retest";
import { developerProfessionalScores, developerProfessionalUnscored } from "../tracks/developer-professional";

export const rehearsalFormIds = ["original", "retest", "recovery"] as const;
export type RehearsalForm = (typeof rehearsalFormIds)[number];

export function rehearsalFormLabel(form?: RehearsalForm) {
  if (form === "recovery") return "Practice exam 3";
  return form === "retest" ? "Practice exam 2" : "Practice exam 1";
}

export const assessmentForms: Record<TrackId, readonly PracticeItem[]> = {
  "associate-foundations": associateAssessment,
  "developer-foundations": developerAssessment,
  "architect-foundations": architectAssessment,
  "architect-professional": professionalAssessment,
  // Authored to the v1.0 blueprint: 60 scored items plus 10 marked unscored (pilot), keys already balanced.
  "developer-professional": developerProfessionalAssessment,
};

function buildDecemberForm(track: keyof typeof decemberBlueprints, candidates: readonly PracticeItem[]) {
  const blueprint = decemberBlueprints[track];
  const core = selectScoredItems(candidates, blueprint.domains, blueprint.scores);
  const coreIds = new Set(core.map(({ id }) => id));
  const pilots = candidates.filter(({ id }) => !coreIds.has(id)).slice(0, 10).map((item) => ({ ...item, pilot: true }));
  const order = new Map(candidates.map(({ id }, index) => [id, index]));
  return [...core, ...pilots].sort((left, right) => order.get(left.id)! - order.get(right.id)!);
}

function retainedItems(track: TrackId, alignment: Alignment) {
  return assessmentForms[track].flatMap((item) => alignItem(item, alignment) ?? []);
}

// Keep legacy item identity and ordering so saved rehearsals can still resume.
const decemberForms = {
  "associate-foundations": buildDecemberForm("associate-foundations", [...decemberAssociateCases, ...retainedItems("associate-foundations", associateAlignment)]),
  "developer-foundations": buildDecemberForm("developer-foundations", [...decemberDeveloperCases, ...retainedItems("developer-foundations", developerAlignment)]),
  "architect-professional": buildDecemberForm("architect-professional", [...decemberProfessionalCases, ...retainedItems("architect-professional", professionalAlignment)]),
};

const alternatePools: Record<TrackId, readonly PracticeItem[]> = {
  "associate-foundations": associateRetest,
  "developer-foundations": developerRetest,
  "architect-foundations": architectRetest,
  "architect-professional": professionalRetest,
  "developer-professional": developerProfessionalRetest,
};

const alternateDecemberForms = {
  "associate-foundations": arrangeRetest(buildDecemberForm("associate-foundations", associateDecemberRetest)),
  "developer-foundations": arrangeRetest(buildDecemberForm("developer-foundations", developerDecemberRetest)),
  "architect-professional": arrangeRetest(buildDecemberForm("architect-professional", professionalDecemberRetest)),
};

function weightedCounts(domains: readonly Domain[], count: number) {
  const quotas = domains.map(({ weight }) => weight * count / 100);
  const counts = quotas.map(Math.floor);
  const roundUp = quotas.map((quota, index) => ({ index, fraction: quota - counts[index] }))
    .sort((left, right) => right.fraction - left.fraction);
  const remaining = count - counts.reduce((sum, count) => sum + count, 0);
  for (const { index } of roundUp.slice(0, remaining)) counts[index]++;
  return counts;
}

function selectScoredItems(candidates: readonly PracticeItem[], domains: readonly Domain[], counts: readonly number[]) {
  return domains.flatMap(({ id, objectives }, index) => {
    const pool = candidates.filter(({ objective }) => objective.startsWith(`${id}.`));
    const anchors = objectives.flatMap((_, i) => pool.find(({ objective }) => objective === `${id}.${i + 1}`) ?? []);
    const chosen = new Set(anchors.map(({ id }) => id));
    return [...anchors, ...pool.filter(({ id }) => !chosen.has(id))].slice(0, counts[index]);
  });
}

function buildAlternateForm(track: TrackId) {
  const blueprint = tracks.find(({ id }) => id === track)!;
  const candidates = alternatePools[track];
  const selected = new Set(selectScoredItems(candidates, blueprint.domains, weightedCounts(blueprint.domains, blueprint.count)).map(({ id }) => id));
  return arrangeRetest(candidates.filter(({ id }) => selected.has(id)));
}

const alternateForms: Record<TrackId, PracticeItem[]> = {
  "associate-foundations": buildAlternateForm("associate-foundations"),
  "developer-foundations": buildAlternateForm("developer-foundations"),
  "architect-foundations": buildAlternateForm("architect-foundations"),
  "architect-professional": buildAlternateForm("architect-professional"),
  "developer-professional": [...developerProfessionalRetest],
};

export function rehearsalItems(track: TrackId, version?: ExamVersion, form: RehearsalForm = "original", seen: ReadonlySet<string> = new Set()) {
  if (form === "recovery") return selectRecoveryForm(track, version, seen);
  if (version === decemberVersion && hasDecemberGuide(track)) {
    return form === "retest" ? alternateDecemberForms[track] : decemberForms[track];
  }
  return form === "retest" ? alternateForms[track] : assessmentForms[track];
}

function recoveryGuide(track: TrackId, version?: ExamVersion) {
  if (hasDecemberGuide(track) && version === decemberVersion) {
    const guide = decemberBlueprints[track];
    return { ...guide, unscored: 10 };
  }
  if (track === "developer-professional") {
    const guide = tracks.find(({ id }) => id === track)!;
    return { ...guide, scores: developerProfessionalScores, unscored: developerProfessionalUnscored };
  }
  const guide = tracks.find(({ id }) => id === track)!;
  return { ...guide, scores: weightedCounts(guide.domains, guide.count), unscored: 0 };
}

function fitsBlueprint(items: readonly PracticeItem[], guide: ReturnType<typeof recoveryGuide>) {
  if (items.length !== guide.count || items.filter(({ pilot }) => pilot).length !== guide.unscored) return false;
  const scored = items.filter(({ pilot }) => !pilot);
  return guide.domains.every(({ id, objectives }, index) =>
    scored.filter(({ objective }) => objective.startsWith(`${id}.`)).length === guide.scores[index] &&
    objectives.every((_, position) => scored.some(({ objective }) => objective === `${id}.${position + 1}`)));
}

function selectRecoveryForm(track: TrackId, version: ExamVersion | undefined, seen: ReadonlySet<string>) {
  const guide = recoveryGuide(track, version);
  const { full } = recoveryBank(track, version);
  return recoverySelection(full.filter(({ id }) => !seen.has(id)), guide);
}

function recoverySelection(candidates: readonly PracticeItem[], guide: ReturnType<typeof recoveryGuide>) {
  const core = selectScoredItems(candidates.filter(({ pilot }) => !pilot), guide.domains, guide.scores);
  const coreIds = new Set(core.map(({ id }) => id));
  const unscored = candidates.filter(({ id }) => !coreIds.has(id)).slice(0, guide.unscored);
  const unscoredIds = new Set(unscored.map(({ id }) => id));
  const selection = candidates.flatMap((question) => coreIds.has(question.id) ? [question]
    : unscoredIds.has(question.id) ? [{ ...question, pilot: true }] : []);
  return fitsBlueprint(selection, guide) ? arrangeRetest(selection) : [];
}

export const domainSampleMinimum = 4;
export const reassessmentMinutes = 10;

export function selectReassessment(track: TrackId, version: ExamVersion | undefined, domain: number, seen: ReadonlySet<string>) {
  const { focused } = recoveryBank(track, version);
  const selection = focused.filter(({ id, objective }) => !seen.has(id) && objective.startsWith(`${domain}.`)).slice(0, domainSampleMinimum);
  return selection.length === domainSampleMinimum ? arrangeRetest(selection) : [];
}

export function savedRecoveryItems(track: TrackId, version: ExamVersion | undefined, itemIds: readonly string[], domain: number | null) {
  const { full, focused } = recoveryBank(track, version);
  const byId = new Map((domain === null ? full : focused).map((question) => [question.id, question]));
  const items = itemIds.flatMap((id) => byId.get(id) ?? []);
  if (items.length !== itemIds.length || new Set(itemIds).size !== itemIds.length) return [];
  if (domain === null) return recoverySelection(items, recoveryGuide(track, version));
  if (items.length !== domainSampleMinimum || items.some(({ objective }) => !objective.startsWith(`${domain}.`))) return [];
  return arrangeRetest(items);
}
