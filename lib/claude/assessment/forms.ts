import { decemberBlueprints, decemberVersion } from "../december-blueprints";
import type { ExamVersion } from "../december-blueprints";
import { alignItem, associateAlignment, developerAlignment, professionalAlignment } from "./december-alignment";
import type { Alignment } from "./december-alignment";
import { decemberAssociateCases, decemberDeveloperCases, decemberProfessionalCases } from "./december-cases";
import type { TrackId } from "../blueprints";
import type { PracticeItem } from "../items";
import { architectAssessment } from "./architect";
import { associateAssessment } from "./associate";
import { developerAssessment } from "./developer";
import { professionalAssessment } from "./professional";

export const assessmentForms: Record<TrackId, readonly PracticeItem[]> = {
  "associate-foundations": associateAssessment,
  "developer-foundations": developerAssessment,
  "architect-foundations": architectAssessment,
  "architect-professional": professionalAssessment,
};

function buildDecemberForm(track: keyof typeof decemberBlueprints, alignment: Alignment, newItems: readonly PracticeItem[]) {
  const blueprint = decemberBlueprints[track];
  const retained = assessmentForms[track].flatMap((item) => {
    const aligned = alignItem(item, alignment);
    return aligned ? [aligned] : [];
  });
  const candidates = [...newItems, ...retained];
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

const decemberForms = {
  "associate-foundations": buildDecemberForm("associate-foundations", associateAlignment, decemberAssociateCases),
  "developer-foundations": buildDecemberForm("developer-foundations", developerAlignment, decemberDeveloperCases),
  "architect-professional": buildDecemberForm("architect-professional", professionalAlignment, decemberProfessionalCases),
};

export function rehearsalItems(track: TrackId, version?: ExamVersion) {
  return version === decemberVersion && track !== "architect-foundations" ? decemberForms[track] : assessmentForms[track];
}
