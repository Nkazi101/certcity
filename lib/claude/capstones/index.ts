import type { TrackId } from "../blueprints";
import { decemberVersion } from "../december-blueprints";
import type { ExamVersion } from "../december-blueprints";
import { architectDefinitions } from "./architect";
import { associateDefinitions, associateRevisedDefinitions } from "./associate";
import { developerDefinitions, developerRevisedDefinitions } from "./developer";
import { capstoneFieldLimit, sameList } from "./model";
import type { CapstoneAttempt, CapstoneDefinition, CapstoneDraft, CapstoneStage } from "./model";
import { professionalDefinitions, professionalRevisedDefinitions } from "./professional";

export type { CapstoneAttempt, CapstoneDefinition, CapstoneDraft, CapstoneStage } from "./model";

const earlier = {
  "associate-foundations": associateDefinitions,
  "developer-foundations": developerDefinitions,
  "architect-foundations": architectDefinitions,
  "architect-professional": professionalDefinitions,
};

const revised = {
  "associate-foundations": associateRevisedDefinitions,
  "developer-foundations": developerRevisedDefinitions,
  "architect-professional": professionalRevisedDefinitions,
};

const transferInterval = 7 * 24 * 60 * 60 * 1000;

export function getCapstoneDefinition(trackId: TrackId, version: ExamVersion, stage: CapstoneStage): CapstoneDefinition {
  return version === decemberVersion && trackId !== "architect-foundations" ? revised[trackId][stage] : earlier[trackId][stage];
}

export function initialCapstoneDraft(definition: CapstoneDefinition): CapstoneDraft {
  return Object.fromEntries(definition.fields.map(({ id, initial }) => [id, initial ?? ""]));
}

export function scoreCapstone(trackId: TrackId, version: ExamVersion, stage: CapstoneStage, draft: CapstoneDraft) {
  const definition = getCapstoneDefinition(trackId, version, stage);
  const artifact = Object.fromEntries(definition.fields.map(({ id }) => [id, (draft[id] ?? "").slice(0, capstoneFieldLimit)]));
  const checks = definition.exercise(artifact);
  const results = definition.criteria.map((criterion) => {
    const check = checks.find(({ criterion: id }) => id === criterion.id);
    return {
      criterion: criterion.id, title: criterion.title,
      passed: check?.passed ?? false,
      objectives: version === decemberVersion ? criterion.revisedObjectives ?? criterion.objectives : criterion.objectives,
      detail: check?.detail ?? "This check did not complete.",
      review: criterion.review,
    };
  });
  return { trackId, version, stage, scenarioId: definition.id, artifact, results, passed: results.every(({ passed }) => passed) };
}

export function validCapstoneAttempt(value: unknown): value is CapstoneAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<CapstoneAttempt>;
  const { id, trackId, version, stage, scenarioId, submittedAt, artifact, results } = attempt;
  if (typeof id !== "string" || !id || id.length > 120 ||
      typeof trackId !== "string" || !Object.hasOwn(earlier, trackId) ||
      (version !== "july-2026" && version !== decemberVersion) ||
      (version === decemberVersion && trackId === "architect-foundations") ||
      (stage !== "capstone" && stage !== "transfer") ||
      typeof submittedAt !== "number" || !Number.isSafeInteger(submittedAt) || submittedAt < 1 || submittedAt > 8.64e15 ||
      !artifact || typeof artifact !== "object" || Array.isArray(artifact) || !Array.isArray(results)) return false;

  const definition = getCapstoneDefinition(trackId, version, stage);
  if (scenarioId !== definition.id || Object.keys(artifact).length !== definition.fields.length ||
      definition.fields.some(({ id }) => typeof artifact[id] !== "string" || artifact[id].length > capstoneFieldLimit)) return false;
  const expected = scoreCapstone(trackId, version, stage, artifact);

  return attempt.passed === expected.passed && results.length === expected.results.length &&
    expected.results.every((entry, index) => {
      const result = results[index];
      return result && result.criterion === entry.criterion && result.title === entry.title && result.detail === entry.detail &&
        result.review === entry.review && result.passed === entry.passed && sameList(result.objectives, entry.objectives);
    });
}

export function capstoneEvidence(trackId: TrackId, version: ExamVersion, attempts: readonly CapstoneAttempt[], now = Date.now()) {
  const eligible = attempts.filter((entry) => entry.trackId === trackId && entry.version === version && entry.submittedAt <= now &&
    entry.scenarioId === getCapstoneDefinition(trackId, version, entry.stage).id)
    .sort((left, right) => left.submittedAt - right.submittedAt);
  const capstones = eligible.filter(({ stage }) => stage === "capstone");
  const capstone = capstones.find(({ passed }) => passed);
  const transferDue = capstone ? capstone.submittedAt + transferInterval : null;
  const transfers = transferDue === null ? [] : eligible.filter(({ stage, submittedAt }) => stage === "transfer" && submittedAt >= transferDue);
  return {
    capstone, transferDue, transfer: transfers.find(({ passed }) => passed),
    firstCapstone: capstones[0], firstTransfer: transfers[0],
  };
}
