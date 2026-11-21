import { decemberBlueprints, decemberVersion } from "../december-blueprints";
import type { ExamVersion } from "../december-blueprints";
import { alignItem, associateAlignment, developerAlignment, professionalAlignment } from "./december-alignment";
import type { Alignment } from "./december-alignment";
import { decemberAssociateCases, decemberDeveloperCases, decemberProfessionalCases } from "./december-cases";
import { tracks } from "../blueprints";
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

export type RehearsalForm = "original" | "retest";
export const rehearsalFormIds = ["original", "retest"] as const;

export function rehearsalFormLabel(form?: RehearsalForm) {
  return form === "retest" ? "Alternate rehearsal" : "First rehearsal";
}

export const assessmentForms: Record<TrackId, readonly PracticeItem[]> = {
  "associate-foundations": associateAssessment,
  "developer-foundations": developerAssessment,
  "architect-foundations": architectAssessment,
  "architect-professional": professionalAssessment,
};

function buildDecemberForm(track: keyof typeof decemberBlueprints, candidates: readonly PracticeItem[]) {
  const blueprint = decemberBlueprints[track];
  const core = blueprint.domains.flatMap(({ id, objectives }, index) => {
    const pool = candidates.filter(({ objective }) => objective.startsWith(id + "."));
    const anchored = objectives.flatMap((_, i) => pool.find(({ objective }) => objective === `${id}.${i + 1}`) ?? []);
    const seen = new Set(anchored.map(({ id }) => id));
    return [...anchored, ...pool.filter(({ id }) => !seen.has(id))].slice(0, blueprint.scores[index]);
  });
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
};

const alternateDecemberForms = {
  "associate-foundations": arrangeRetest(buildDecemberForm("associate-foundations", associateDecemberRetest)),
  "developer-foundations": arrangeRetest(buildDecemberForm("developer-foundations", developerDecemberRetest)),
  "architect-professional": arrangeRetest(buildDecemberForm("architect-professional", professionalDecemberRetest)),
};

function buildAlternateForm(track: TrackId) {
  const blueprint = tracks.find(({ id }) => id === track)!;
  const candidates = alternatePools[track];
  const quotas = blueprint.domains.map(({ weight }) => weight * blueprint.count / 100);
  const counts = quotas.map(Math.floor);
  const roundUp = quotas.map((quota, index) => ({ index, fraction: quota - counts[index] }))
    .sort((left, right) => right.fraction - left.fraction);
  const remaining = blueprint.count - counts.reduce((sum, count) => sum + count, 0);
  for (const { index } of roundUp.slice(0, remaining)) counts[index]++;

  const selected = new Set(blueprint.domains.flatMap(({ id, objectives }, index) => {
    const pool = candidates.filter(({ objective }) => objective.startsWith(`${id}.`));
    const anchors = new Set(objectives.flatMap((_, objective) => pool.find((question) => question.objective === `${id}.${objective + 1}`)?.id ?? []));
    return [...anchors, ...pool.filter((question) => !anchors.has(question.id)).map((question) => question.id)].slice(0, counts[index]);
  }));
  return arrangeRetest(candidates.filter(({ id }) => selected.has(id)));
}

const alternateForms: Record<TrackId, PracticeItem[]> = {
  "associate-foundations": buildAlternateForm("associate-foundations"),
  "developer-foundations": buildAlternateForm("developer-foundations"),
  "architect-foundations": buildAlternateForm("architect-foundations"),
  "architect-professional": buildAlternateForm("architect-professional"),
};

export function rehearsalItems(track: TrackId, version?: ExamVersion, form: RehearsalForm = "original") {
  if (version === decemberVersion && track !== "architect-foundations") {
    return form === "retest" ? alternateDecemberForms[track] : decemberForms[track];
  }
  return form === "retest" ? alternateForms[track] : assessmentForms[track];
}
