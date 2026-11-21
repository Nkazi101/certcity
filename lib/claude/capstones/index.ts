import type { TrackId } from "../blueprints";
import { decemberVersion } from "../december-blueprints";
import type { ExamVersion } from "../december-blueprints";
import { evidenceFingerprint, evidenceKeys, evidenceLink, evidenceRecord, evidenceText } from "../evidence-snapshot";
import { architectDefinitions } from "./architect";
import { associateDefinitions, associateRevisedDefinitions } from "./associate";
import { developerDefinitions, developerRevisedDefinitions } from "./developer";
import { capstoneFieldLimit, sameList } from "./model";
import type { CapstoneAttempt, CapstoneDefinition, CapstoneDraft, CapstoneSnapshot, CapstoneStage } from "./model";
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
  const evidence = { trackId, version, stage, scenarioId: definition.id, artifact, results, passed: results.every(({ passed }) => passed) };
  const { title, role, brief, deliverable, documents, fields, runs, reference } = definition;
  const frozen = {
    schema: 1, scoring: "fixture-v1", title, role, brief, deliverable,
    documents: documents.map((document) => ({ ...document })),
    fields: fields.map((field) => ({ ...field, ...(field.options && { options: [...field.options] }) })),
    ...(runs && { runs: runs.map((run) => ({ ...run })) }), reference: { ...reference },
  } as const;
  const revision = evidenceFingerprint([frozen, results.map(({ criterion, title, objectives, review }) => [criterion, title, objectives, review])]);
  const snapshot: CapstoneSnapshot = { ...frozen, revision, receipt: evidenceFingerprint([evidence, revision]) };
  return { ...evidence, snapshot };
}

function validSnapshot(value: unknown): value is CapstoneSnapshot {
  if (!evidenceRecord(value) || !evidenceKeys(value, ["schema", "scoring", "receipt", "revision", "title", "role",
    "brief", "deliverable", "documents", "fields", "runs", "reference"])) return false;
  const { title, role, brief, deliverable, documents, fields, runs, reference, revision, receipt } = value;
  return value.schema === 1 && value.scoring === "fixture-v1" &&
    evidenceText(revision, 16) && /^[a-f0-9]{16}$/.test(revision) && evidenceText(receipt, 16) && /^[a-f0-9]{16}$/.test(receipt) &&
    evidenceText(title, 240) && evidenceText(role, 120) && evidenceText(brief, 2200) && evidenceText(deliverable, 2200) &&
    Array.isArray(documents) && documents.length > 0 && documents.length <= 20 && documents.every((document) =>
      evidenceRecord(document) && evidenceKeys(document, ["id", "title", "text", "format"]) &&
      evidenceText(document.id, 120) && evidenceText(document.title, 240) && evidenceText(document.text, 4800) &&
      (document.format === undefined || document.format === "json")) &&
    new Set(documents.map(({ id }) => id)).size === documents.length &&
    Array.isArray(fields) && fields.length > 0 && fields.length <= 30 && fields.every((field) =>
      evidenceRecord(field) && evidenceKeys(field, ["id", "label", "group", "instruction", "initial", "editor", "options"]) &&
      evidenceText(field.id, 120) && evidenceText(field.label, 240) &&
      (field.group === undefined || evidenceText(field.group, 240)) &&
      (field.instruction === undefined || evidenceText(field.instruction, 1600)) &&
      (field.initial === undefined || evidenceText(field.initial, capstoneFieldLimit, true)) &&
      (field.editor === undefined || field.editor === "text" || field.editor === "notes" || field.editor === "json") &&
      (field.options === undefined || Array.isArray(field.options) && field.options.length <= 20 &&
        field.options.every((option) => evidenceText(option, 120)))) &&
    new Set(fields.map(({ id }) => id)).size === fields.length &&
    (runs === undefined || Array.isArray(runs) && runs.length <= 20 && runs.every((run) => evidenceRecord(run) &&
      evidenceKeys(run, ["id", "label"]) && evidenceText(run.id, 120) && evidenceText(run.label, 240))) &&
    evidenceRecord(reference) && evidenceKeys(reference, ["label", "url"]) && evidenceText(reference.label, 240) && evidenceLink(reference.url);
}

export function validCapstoneAttempt(value: unknown): value is CapstoneAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<CapstoneAttempt>;
  const { id, trackId, version, stage, scenarioId, submittedAt, artifact, results, passed, snapshot } = attempt;
  if (typeof id !== "string" || !id || id.length > 120 ||
      typeof trackId !== "string" || !Object.hasOwn(earlier, trackId) ||
      (version !== "july-2026" && version !== decemberVersion) ||
      (version === decemberVersion && trackId === "architect-foundations") ||
      (stage !== "capstone" && stage !== "transfer") ||
      !evidenceText(scenarioId, 120) ||
      typeof submittedAt !== "number" || !Number.isSafeInteger(submittedAt) || submittedAt < 1 || submittedAt > 8.64e15 ||
      !evidenceRecord(artifact) || !Array.isArray(results) || !results.length || results.length > 30 || typeof passed !== "boolean" ||
      !results.every((result) => evidenceRecord(result) &&
        evidenceKeys(result, ["criterion", "title", "passed", "objectives", "detail", "review"]) &&
        evidenceText(result.criterion, 120) && evidenceText(result.title, 240) && typeof result.passed === "boolean" &&
        Array.isArray(result.objectives) && result.objectives.length > 0 && result.objectives.length <= 30 &&
        result.objectives.every((objective) => evidenceText(objective, 12) && /^\d+\.\d+$/.test(objective)) &&
        evidenceText(result.detail, 2400) && evidenceText(result.review, 2400)) ||
      new Set(results.map(({ criterion }) => criterion)).size !== results.length ||
      passed !== results.every((result) => result.passed)) return false;

  if (snapshot !== undefined) {
    if (!validSnapshot(snapshot) || Object.keys(artifact).length !== snapshot.fields.length ||
        snapshot.fields.some(({ id }) => !Object.hasOwn(artifact, id) || !evidenceText(artifact[id], capstoneFieldLimit, true))) return false;
    const { revision, receipt, ...frozen } = snapshot;
    return revision === evidenceFingerprint([frozen, results.map(({ criterion, title, objectives, review }) => [criterion, title, objectives, review])]) &&
      receipt === evidenceFingerprint([{ trackId, version, stage, scenarioId, artifact, results, passed }, revision]);
  }

  // Earlier submissions did not record their complete case. Validate their original work and result identities.
  const definition = getCapstoneDefinition(trackId, version, stage);
  if (scenarioId !== definition.id || Object.keys(artifact).length !== definition.fields.length ||
      definition.fields.some(({ id }) => typeof artifact[id] !== "string" || artifact[id].length > capstoneFieldLimit)) return false;
  const expected = scoreCapstone(trackId, version, stage, artifact);
  return passed === expected.passed && results.length === expected.results.length &&
    expected.results.every((entry, index) => {
      const result = results[index];
      return result && result.criterion === entry.criterion && result.passed === entry.passed &&
        sameList(result.objectives, entry.objectives);
    });
}

export function validNewCapstoneAttempt(value: unknown): value is CapstoneAttempt {
  if (!validCapstoneAttempt(value)) return false;
  const { trackId, version, stage, artifact, snapshot } = value;
  return snapshot?.receipt === scoreCapstone(trackId, version, stage, artifact).snapshot.receipt;
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
