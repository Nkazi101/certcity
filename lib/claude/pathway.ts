import { answeredBeforeRelease } from "./items";
import { assignmentFollowups } from "./assignment-followups";
import { progressScope, readProgressItem, writeProgressItem } from "../progress-storage";
import { followupDays, gradeAttempt, isCorrect, modulePreparationSteps, readCertification } from "../certification-progress";
import type { SkillAttempt } from "../certification-progress";
import { skillChecks } from "../exam-practice";
import { architectMissions } from "./architect-missions";
import { associateMissions, developerMissions, professionalMissions } from "./role-missions";
import { developerProfessionalMissions } from "./developer-professional-missions";
import { distinctSettings, missionExhibits, missionTransfer } from "./mission-transfer";
import { tracks } from "./blueprints";
import { cityChecks } from "./city-checks";
import { readCityCheck } from "./city-progress";
import { isCityAssignment } from "./assignments";
import type { Track, TrackId } from "./blueprints";
import { missionMappings, missionPassed } from "./missions";
import type { Choices, Mission } from "./missions";
import { banks } from "./banks";
import { progressKey } from "./progress-keys";
import { missionExperiences } from "./mission-experiences";
import { assignmentChoices, validAssignmentWork } from "./assignment-work";
import type { AssignmentWork } from "./assignment-work";
import { caseworkFor } from "./cases";
import { caseworkPassed, objectiveFields, solvedCase, validCaseDraft } from "./casework";
import type { CaseDraft, Casework } from "./casework";
import { labFor } from "../labs";
import { labIndependent, runLab, transferVariants } from "../labs/run";
import type { AnyLabMission, FixtureSet } from "../labs/types";
import { capstoneFieldLimit } from "./capstones/model";

export const portfolio: readonly Mission[] = [
  ...architectMissions,
  ...associateMissions,
  ...developerMissions,
  ...professionalMissions,
  { id: "enrollment-replies", track: "associate-foundations", place: "school", kind: "original",
    title: "Prepare enrollment replies", brief: "Families need answers from the current bulletin and a clear route for exceptions.",
    specialist: "", workload: "Three enrollment messages", measure: "Messages routed", objectives: ["2.3", "2.4"],
    itemIds: ["garden-refund-date", "recital-access"] },
  { id: "supplier-invoices", track: "developer-foundations", place: "restaurant", kind: "original",
    title: "Validate supplier invoices", brief: "Keep incorrect invoice totals out of the ledger without losing what the supplier printed.",
    specialist: "", workload: "Three supplier invoices", measure: "Invoices handled", objectives: ["6.3"], itemIds: ["venue-credit-sum"] },
  { id: "support-pilot", track: "architect-professional", place: "office", kind: "original",
    title: "Plan the support rollout", brief: "Pick a pilot that meets the service, spending, and dispute-handling requirements.",
    specialist: "", workload: "Forty disputed tickets", measure: "Release conditions met", objectives: ["6.3"], itemIds: ["library-pilot-stop"] },
  { id: "stadium-fallbacks", track: "developer-professional", place: "busch-stadium", kind: "original",
    title: "Repair the game-day fallback policy", brief: "Fans got error pages and cut-off directions while the guest assistant retried every failure the same way.",
    specialist: "", workload: "Eighteen first-inning guest questions", measure: "Questions answered within capacity", objectives: ["2.1", "2.2"],
    itemIds: ["ccdvp-p-parts-breaker", "ccdvp-p-hr-otpm"] },
  ...developerProfessionalMissions,
];

export type MissionCheck = { answers: Record<string, string[]>; priorExposure: string[]; submittedAt?: number };
/** Hint rungs: 1 nudge, 2 concept, 3 worked example. */
export type HintRung = 1 | 2 | 3;
/** How a casework outcome was reached. Saves from before this record existed are treated as legacy and keep full credit. */
export type CaseMastery = {
  cycle: number;
  runs: number;
  /** null until the first sample run of the cycle. */
  firstRunPassed: boolean | null;
  hints: Record<string, HintRung>;
  revealed: string[];
  /** Predictions that matched the replay with a passing setup. */
  predictions: number;
  /** Failed sample or new-case runs per field this cycle. Three unlock the answer; with no hint opened they also pause Run. */
  failures: Record<string, number>;
  /** The record of the cycle that produced the saved outcome. */
  credit?: { cycle: number; runs: number; firstRunPassed: boolean | null; hints: Record<string, HintRung>; revealed: string[]; predictions: number };
};
export const emptyMastery: CaseMastery = { cycle: 0, runs: 0, firstRunPassed: null, hints: {}, revealed: [], predictions: 0, failures: {} };
export type LabFileSet = Record<string, string>;
/**
 * Work on a learn-by-doing lab (lib/labs). Mastery reuses the casework record with check ids in place of field ids:
 * hints and reveals per check, failures per check, and the credit of the cycle that produced the saved outcome.
 */
export type LabRecord = {
  /** Working files per stage. Rerun-mode labs only use "sample". */
  drafts: Partial<Record<FixtureSet, LabFileSet>>;
  mastery: CaseMastery;
  /** The files that passed the sample and the hidden transfer variant. */
  outcome?: { sample: LabFileSet; transfer: LabFileSet; variant: string; at: number };
};
export type MissionRecord = {
  choices?: Choices;
  draft?: Choices;
  work?: AssignmentWork;
  workDraft?: AssignmentWork;
  casework?: CaseDraft;
  caseDraft?: CaseDraft;
  mastery?: CaseMastery;
  lab?: LabRecord;
  briefSeen?: boolean;
  legacyVerified?: boolean;
  interviewed?: string[];
  debriefSeen?: boolean;
  practiced?: boolean;
  lensItems?: string[];
  lensExposure?: Record<string, number>;
  reviewed?: string[];
  check?: MissionCheck;
  checkHistory?: MissionCheck[];
  followup?: { answers: Record<string, string[]>; submittedAt: number };
};
export type PortfolioRecords = Record<string, MissionRecord>;
export const missionStoragePrefix = "certcity.mission.v1.";

export function missionPreparationSteps(complete: boolean, record?: MissionRecord) {
  return modulePreparationSteps(complete, !!record?.debriefSeen, !!record?.check, !!record?.followup);
}

export function missionFollowupAt(check?: MissionCheck) {
  return check?.submittedAt ? check.submittedAt + followupDays * 24 * 60 * 60 * 1000 : null;
}

export function missionsFor(id: TrackId) {
  return portfolio.filter((mission) => mission.track === id);
}

export function missionQuestions(mission: Mission) {
  const items = mission.kind === "original" && isCityAssignment(mission.track)
    ? cityChecks[mission.track]
    : [...banks[mission.track].practice, ...banks[mission.track].followup, ...missionTransfer];
  return missionMappings(mission).map(({ itemId }) => {
    const exhibit = missionExhibits.find(({ id }) => id === itemId);
    if (exhibit) return exhibit;
    const item = items.find(({ id }) => id === itemId)!;
    return distinctSettings[itemId] ? { ...item, scenario: distinctSettings[itemId] } : item;
  });
}

/** Each module owns its delayed questions. Earlier saves retain the item set they answered. */
export function missionFollowupQuestions(mission: Mission, answers?: Record<string, string[]>) {
  const authored = assignmentFollowups[mission.id];
  if (authored && (!answers || authored.every(({ id }) => Object.hasOwnProperty.call(answers, id)))) return authored;
  const domains = new Set(missionQuestions(mission).map((question) => Number(question.objective.split(".")[0])));
  return banks[mission.track].followup.filter((question) => domains.has(Number(question.objective.split(".")[0])));
}

const rungs = (value: unknown): Record<string, HintRung> => value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, HintRung] => entry[1] === 1 || entry[1] === 2 || entry[1] === 3)) : {};
const counts = (value: unknown): Record<string, number> => value && typeof value === "object" && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] >= 0)) : {};
const strings = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
const whole = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
const firstRun = (value: unknown) => typeof value === "boolean" ? value : null;

function validMastery(value: any): CaseMastery | null {
  if (!value || typeof value !== "object") return null;
  const credit = value.credit && typeof value.credit === "object" ? {
    cycle: whole(value.credit.cycle), runs: whole(value.credit.runs), firstRunPassed: firstRun(value.credit.firstRunPassed),
    hints: rungs(value.credit.hints), revealed: strings(value.credit.revealed), predictions: whole(value.credit.predictions),
  } : undefined;
  return { cycle: whole(value.cycle), runs: whole(value.runs), firstRunPassed: firstRun(value.firstRunPassed), hints: rungs(value.hints),
    revealed: strings(value.revealed), predictions: whole(value.predictions), failures: counts(value.failures), ...(credit && { credit }) };
}

function validFiles(lab: AnyLabMission, value: unknown): LabFileSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.every(([id, content]) => typeof content === "string" &&
    lab.artifacts.some((artifact) => artifact.id === id && content.length <= (artifact.maxChars ?? capstoneFieldLimit)))
    ? Object.fromEntries(entries) as LabFileSet : null;
}

/** Saved lab work. Unknown files and malformed parts are dropped; a missing record reads as no lab work. */
function validLab(lab: AnyLabMission, value: any): LabRecord | null {
  if (!value || typeof value !== "object") return null;
  const drafts = Object.fromEntries((["sample", "transfer"] as const).flatMap((set) => {
    const files = validFiles(lab, value.drafts?.[set]);
    return files ? [[set, files]] : [];
  }));
  const outcome = value.outcome && typeof value.outcome === "object" && Number.isFinite(value.outcome.at) &&
    transferVariants(lab).includes(value.outcome.variant) && validFiles(lab, value.outcome.sample) && validFiles(lab, value.outcome.transfer)
    ? { sample: validFiles(lab, value.outcome.sample)!, transfer: validFiles(lab, value.outcome.transfer)!, variant: String(value.outcome.variant), at: Number(value.outcome.at) }
    : undefined;
  return { drafts, mastery: validMastery(value.mastery) ?? emptyMastery, ...(outcome && { outcome }) };
}

const labVerdicts = new Map<string, boolean>();
/** A saved lab outcome counts while its files still pass the sample and their transfer variant. */
export function labOutcomePassed(lab: AnyLabMission, outcome: NonNullable<LabRecord["outcome"]>) {
  const key = `${lab.id}\u0000${outcome.variant}\u0000${JSON.stringify(outcome.sample)}\u0000${JSON.stringify(outcome.transfer)}`;
  let passed = labVerdicts.get(key);
  if (passed === undefined) {
    passed = runLab(lab, outcome.sample, "sample").passed && runLab(lab, outcome.transfer, "transfer", outcome.variant).passed;
    if (labVerdicts.size > 200) labVerdicts.clear();
    labVerdicts.set(key, passed);
  }
  return passed;
}

/** A committed outcome. A save from before the mastery record passed the stations of its time; it migrates to the current answers. */
function committedCasework(work: Casework, value: any): CaseDraft | null {
  const saved = value?.casework;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
  if (validCaseDraft(work, saved) && caseworkPassed(work, saved)) return saved;
  const entries = Object.entries(saved);
  const shaped = entries.length > 0 && entries.every(([, entry]) => typeof entry === "string" || typeof entry === "number") &&
    work.fields.filter(({ id }) => Object.hasOwn(saved, id)).length * 2 >= work.fields.length;
  return !value.mastery && shaped ? solvedCase(work) : null;
}

function readRecord(mission: Mission): MissionRecord {
  try {
    const value = JSON.parse(readProgressItem(missionStoragePrefix + mission.id) ?? "null");
    if (!value || typeof value !== "object") return {};
    const casework = caseworkFor(mission.id);
    const check = value.check;
    const questions = missionQuestions(mission);
    const validCheck = (candidate: any) => candidate && Array.isArray(candidate.priorExposure) && questions.every(({ id, options, correct }) => {
      const picks = candidate.answers?.[id];
      return Array.isArray(picks) && picks.length === correct.length && new Set(picks).size === picks.length &&
        picks.every((pick) => options.some(([option]) => option === pick));
    });
    const valid = validCheck(check);
    const followupAnswers: Record<string, string[]> | undefined = value.followup?.answers;
    const followupQuestions = missionFollowupQuestions(mission, followupAnswers);
    const followupValid = followupQuestions.length > 0 &&
      Number.isFinite(value.followup?.submittedAt) && followupQuestions.every(({ id, options, correct }) => {
        const picks = followupAnswers?.[id];
        return Array.isArray(picks) && picks.length === correct.length && new Set(picks).size === picks.length &&
          picks.every((pick: string) => options.some(([option]) => option === pick));
      });
    return {
      ...(mission.kind === "workbench" && validChoices(mission, value.choices) && { choices: value.choices }),
      ...(mission.kind === "workbench" && validChoices(mission, value.draft, true) && { draft: value.draft }),
      ...(validAssignmentWork(mission.id, value.work) && { work: value.work }),
      ...(validAssignmentWork(mission.id, value.workDraft) && { workDraft: value.workDraft }),
      ...(casework && committedCasework(casework, value) && { casework: committedCasework(casework, value) }),
      ...(casework && validCaseDraft(casework, value.caseDraft, true) && { caseDraft: value.caseDraft }),
      ...(casework && validMastery(value.mastery) && { mastery: validMastery(value.mastery) }),
      ...(labFor(mission.id) && validLab(labFor(mission.id)!, value.lab) && { lab: validLab(labFor(mission.id)!, value.lab)! }),
      ...(value.briefSeen === true && { briefSeen: true }),
      ...(Array.isArray(value.interviewed) && { interviewed: value.interviewed.filter((id: unknown) =>
        missionExperiences[mission.id]?.interviews.some((person) => person.id === id)) }),
      ...(value.debriefSeen === true && { debriefSeen: true }),
      ...(value.practiced === true && { practiced: true }),
      ...(Array.isArray(value.lensItems) && { lensItems: value.lensItems.filter((id: unknown) => typeof id === "string") }),
      ...(value.lensExposure && typeof value.lensExposure === "object" && { lensExposure: Object.fromEntries(
        Object.entries(value.lensExposure).filter((entry) => typeof entry[1] === "number" && Number.isFinite(entry[1])),
      ) }),
      ...(valid && { check: { answers: check.answers, priorExposure: check.priorExposure,
        ...(Number.isFinite(check.submittedAt) && { submittedAt: check.submittedAt }) },
        reviewed: Array.isArray(value.reviewed) ? value.reviewed.filter((id: unknown) => questions.some(({ objective }) => objective === id)) : [] }),
      ...(Array.isArray(value.checkHistory) && { checkHistory: value.checkHistory.filter(validCheck).map((entry: any) => ({
        answers: entry.answers, priorExposure: entry.priorExposure,
        ...(Number.isFinite(entry.submittedAt) && { submittedAt: entry.submittedAt }),
      })) }),
      ...(followupValid && { followup: { answers: followupAnswers, submittedAt: value.followup.submittedAt } }),
    };
  } catch {
    return {};
  }
}

export function readPortfolio(committedDispatchCheck?: SkillAttempt | null) {
  const records = Object.fromEntries(portfolio.map((mission) => [mission.id, readRecord(mission)]));
  const dispatchCheck = committedDispatchCheck === undefined ? readCertification()?.first : committedDispatchCheck;
  if (dispatchCheck) {
    const passed = gradeAttempt(skillChecks.first, dispatchCheck) === skillChecks.first.questions.length;
    records["dispatch-lookup"] = { ...records["dispatch-lookup"], legacyVerified: passed, reviewed: ["2.2"] };
  }
  for (const mission of portfolio) {
    if (mission.kind !== "original" || !isCityAssignment(mission.track) || records[mission.id].check) continue;
    const questions = cityChecks[mission.track];
    const answers = readCityCheck(mission.track, questions);
    if (answers) records[mission.id] = { ...records[mission.id], check: { answers, priorExposure: [] } };
  }
  return records;
}

function writeRecord(mission: Mission, update: (current: MissionRecord) => MissionRecord | null) {
  const key = missionStoragePrefix + mission.id;
  const scope = progressScope();
  const apply = () => {
    if (progressScope() !== scope) return { record: {}, saved: false };
    const current = readRecord(mission);
    const next = update(current);
    if (!next) return { record: current, saved: false };
    try {
      return { record: next, saved: writeProgressItem(key, JSON.stringify(next)) };
    } catch {
      return { record: next, saved: false };
    }
  };
  return navigator.locks?.request(scope + ":" + key, apply).catch(apply) ?? Promise.resolve(apply());
}

export function missionCompleted(mission: Mission, records: PortfolioRecords, legacy: ReadonlySet<string>) {
  if (legacy.has(mission.id)) return true;
  const record = records[mission.id];
  const lab = labFor(mission.id);
  if (lab && record?.lab?.outcome && labOutcomePassed(lab, record.lab.outcome)) return true;
  const exercise = caseworkFor(mission.id);
  if (exercise && validCaseDraft(exercise, record?.casework) && caseworkPassed(exercise, record.casework)) return true;
  const choices = record?.choices;
  return mission.kind === "workbench" && !!choices && validChoices(mission, choices) &&
    missionPassed(mission, choices);
}

export function unmetMissions(mission: Mission, records: PortfolioRecords, legacy: ReadonlySet<string>) {
  return (mission.requires ?? []).flatMap((id) => {
    const prerequisite = portfolio.find((entry) => entry.id === id);
    return prerequisite && !missionCompleted(prerequisite, records, legacy) ? [prerequisite] : [];
  });
}

function validChoices(mission: Extract<Mission, { kind: "workbench" }>, value: unknown, partial = false): value is Choices {
  if (!value || typeof value !== "object") return false;
  const choices = value as Choices;
  return mission.decisions.every(({ objective, options, combine }) => {
    const picks = choices[objective];
    if (partial && picks === undefined) return true;
    const size = combine ? 2 : 1;
    return Array.isArray(picks) && (partial ? picks.length <= size : picks.length === size) &&
      new Set(picks).size === picks.length && picks.every((i) => Number.isInteger(i) && i >= 0 && i < options.length);
  });
}

export function saveMissionDraft(mission: Extract<Mission, { kind: "workbench" }>, draft: Choices) {
  if (!validChoices(mission, draft, true)) return;
  return writeRecord(mission, (current) => ({ ...current, draft }));
}

export function saveMission(mission: Extract<Mission, { kind: "workbench" }>, choices: Choices) {
  if (!validChoices(mission, choices) || !missionPassed(mission, choices)) return null;
  return writeRecord(mission, (current) => ({ ...current, choices, draft: undefined }));
}

export function saveAssignmentWork(mission: Extract<Mission, { kind: "workbench" }>, work: AssignmentWork, commit = false) {
  if (!validAssignmentWork(mission.id, work)) return null;
  if (!commit) return writeRecord(mission, (current) => ({ ...current, workDraft: work }));
  const choices = assignmentChoices(work);
  if (!missionPassed(mission, choices)) return null;
  return writeRecord(mission, (current) => ({ ...current, choices, work, draft: undefined, workDraft: undefined }));
}

export function saveCityCasework(mission: Mission, draft: CaseDraft, commit = false) {
  const exercise = caseworkFor(mission.id);
  if (!exercise || !validCaseDraft(exercise, draft, !commit) || (commit && !caseworkPassed(exercise, draft))) return null;
  return writeRecord(mission, (current) => {
    if (!commit) return { ...current, caseDraft: draft };
    const mastery = current.mastery ?? emptyMastery;
    const { failures: _failures, credit: previous, ...cycle } = mastery;
    // Keep the strongest saved evidence: a later guided save does not erase an earlier independent one.
    const credit = previous && caseCredit(exercise, previous) >= caseCredit(exercise, cycle) ? previous : cycle;
    return { ...current, casework: draft, caseDraft: undefined, mastery: { ...mastery, credit } };
  });
}

/** Update the live mastery record for the current cycle (runs, hints, reveals, predictions). */
export function saveCaseMastery(mission: Mission, update: (mastery: CaseMastery) => CaseMastery) {
  if (!caseworkFor(mission.id)) return Promise.resolve(null);
  return writeRecord(mission, (current) => ({ ...current, mastery: update(current.mastery ?? emptyMastery) }));
}

/** Start a fresh attempt: options reshuffle, choices clear, and the saved outcome and its credit stay. */
export function startCaseCycle(mission: Mission) {
  if (!caseworkFor(mission.id)) return Promise.resolve(null);
  return writeRecord(mission, (current) => {
    const mastery = current.mastery ?? emptyMastery;
    return { ...current, caseDraft: undefined,
      mastery: { ...emptyMastery, cycle: mastery.cycle + 1, ...(mastery.credit && { credit: mastery.credit }) } };
  });
}

function labCredit(lab: AnyLabMission, record: Pick<CaseMastery, "hints" | "revealed">) {
  return lab.objectives.filter((objective) => labIndependent(lab, record, objective)).length;
}

/** Station choices that pass every decision, so surfaces that still read `choices` see a completed mission. */
function passingChoices(mission: Mission) {
  if (mission.kind !== "workbench") return undefined;
  const choices = Object.fromEntries(mission.decisions.map(({ objective, options, combine }) => {
    const passed = options.flatMap((option, index) => option.passed ? [index] : []);
    return [objective, combine ? passed.slice(0, 2) : passed.slice(0, 1)];
  }));
  return validChoices(mission, choices) && missionPassed(mission, choices) ? choices : undefined;
}

export function saveLabDraft(mission: Mission, set: FixtureSet, files: LabFileSet) {
  const lab = labFor(mission.id);
  if (!lab || !validFiles(lab, files)) return Promise.resolve(null);
  return writeRecord(mission, (current) => {
    const record = current.lab ?? { drafts: {}, mastery: emptyMastery };
    return { ...current, lab: { ...record, drafts: { ...record.drafts, [set]: files } } };
  });
}

export function saveLabMastery(mission: Mission, update: (mastery: CaseMastery) => CaseMastery) {
  if (!labFor(mission.id)) return Promise.resolve(null);
  return writeRecord(mission, (current) => {
    const record = current.lab ?? { drafts: {}, mastery: emptyMastery };
    return { ...current, lab: { ...record, mastery: update(record.mastery) } };
  });
}

/** Saves a lab outcome once its files pass the sample and the hidden transfer. Keeps the strongest credit across cycles. */
export function saveLabOutcome(mission: Mission, sample: LabFileSet, transfer: LabFileSet, variant: string) {
  const lab = labFor(mission.id);
  if (!lab || !validFiles(lab, sample) || !validFiles(lab, transfer) || !transferVariants(lab).includes(variant)) return null;
  const outcome = { sample, transfer, variant, at: Date.now() };
  if (!labOutcomePassed(lab, outcome)) return null;
  const choices = passingChoices(mission);
  return writeRecord(mission, (current) => {
    const record = current.lab ?? { drafts: {}, mastery: emptyMastery };
    const { failures: _failures, credit: previous, ...cycle } = record.mastery;
    const credit = previous && labCredit(lab, previous) >= labCredit(lab, cycle) ? previous : cycle;
    return { ...current, ...(choices && !current.choices && { choices }),
      lab: { drafts: {}, mastery: { ...record.mastery, credit }, outcome } };
  });
}

/** A fresh attempt: drafts clear, the cycle (and so the hidden transfer variant) changes, and the saved outcome and credit stay. */
export function startLabCycle(mission: Mission) {
  if (!labFor(mission.id)) return Promise.resolve(null);
  return writeRecord(mission, (current) => {
    const record = current.lab ?? { drafts: {}, mastery: emptyMastery };
    return { ...current, lab: { ...record, drafts: {},
      mastery: { ...emptyMastery, cycle: record.mastery.cycle + 1, ...(record.mastery.credit && { credit: record.mastery.credit }) } } };
  });
}

export function saveCaseBriefSeen(mission: Mission) {
  return writeRecord(mission, (current) => current.briefSeen ? null : { ...current, briefSeen: true });
}

/** Objectives a casework outcome earned without the answer: no reveal and no worked example on any of their fields. */
export function caseIndependent(work: Casework, record: Pick<CaseMastery, "hints" | "revealed">, objective: string) {
  return objectiveFields(work, objective).every((id) => !record.revealed.includes(id) && (record.hints[id] ?? 0) <= 2);
}

function caseCredit(work: Casework, record: Pick<CaseMastery, "hints" | "revealed">) {
  return work.objectives.filter((objective) => caseIndependent(work, record, objective)).length;
}

export function saveTransfer(mission: Mission, answers: Record<string, string[]>, startNewCycle = false) {
  const questions = missionQuestions(mission);
  const valid = questions.every(({ id, options, correct }) =>
    Array.isArray(answers[id]) && answers[id].length === correct.length &&
    new Set(answers[id]).size === correct.length && answers[id].every((value) => options.some(([key]) => key === value)));
  if (!valid) return null;
  const track = tracks.find(({ id }) => id === mission.track)!;
  return writeRecord(mission, (current) => {
    if (current.check && (!startNewCycle || current.check.submittedAt)) return current;
    const legacyAnswers = mission.kind === "original" && isCityAssignment(mission.track)
      ? readCityCheck(mission.track, questions) : null;
    const priorCheck = current.check ?? (startNewCycle && legacyAnswers
      ? { answers: legacyAnswers, priorExposure: [] } : undefined);
    // Only the ids a learner has already seen matter here; read them without loading the practice engine.
    const practice = readExposure(track);
    const exposed = new Set([...(practice?.seen ?? []), ...(practice?.attempts ?? []).flatMap(({ answers }) => Object.keys(answers)),
      ...Object.keys(practice?.draft?.answers ?? {}),
      ...portfolio.flatMap((other) => {
        const entry = readRecord(other);
        return [...(entry.lensItems ?? []), ...(other.id === mission.id ? [] : Object.keys(entry.check?.answers ?? {}))];
      })]);
    return {
      ...current,
      ...(startNewCycle && priorCheck && { checkHistory: [...(current.checkHistory ?? []), priorCheck] }),
      check: { answers, priorExposure: questions.filter(({ id }) => exposed.has(id)).map(({ id }) => id), submittedAt: Date.now() },
    };
  });
}

export function recordMissionLens(mission: Mission, itemId: string, attempted = false) {
  return writeRecord(mission, (current) => ({
    ...current, practiced: current.practiced || attempted, lensItems: [...new Set([...(current.lensItems ?? []), itemId])],
    lensExposure: { ...current.lensExposure, [itemId]: current.lensExposure?.[itemId] ??
      (current.lensItems?.includes(itemId) ? 0 : Date.now()) },
  }));
}

export function saveMissionInterview(mission: Mission, interviewId: string) {
  if (!missionExperiences[mission.id]?.interviews.some(({ id }) => id === interviewId)) return Promise.resolve(null);
  return writeRecord(mission, (current) => ({ ...current, interviewed: [...new Set([...(current.interviewed ?? []), interviewId])] }));
}

export function saveMissionDebrief(mission: Mission) {
  return writeRecord(mission, (current) => ({ ...current, debriefSeen: true }));
}

export function saveMissionFollowup(mission: Mission, answers: Record<string, string[]>) {
  const questions = missionFollowupQuestions(mission);
  const valid = questions.length > 0 && questions.every(({ id, options, correct }) =>
    Array.isArray(answers[id]) && answers[id].length === correct.length && new Set(answers[id]).size === correct.length &&
    answers[id].every((value) => options.some(([key]) => key === value)));
  if (!valid) return null;
  return writeRecord(mission, (current) => {
    if (current.followup) return current;
    const due = missionFollowupAt(current.check);
    const now = Date.now();
    if (due === null || now < due) return null;
    return { ...current, followup: { answers, submittedAt: now } };
  });
}

export function missingExpertise(mission: Mission, records: PortfolioRecords) {
  if (!mission.verify?.length) return [];
  const prior = missionsFor(mission.track).filter((entry) => entry.id !== mission.id);
  const { demonstrated, reviewed } = checkEvidence(prior, records);
  return mission.verify.filter((objective) => !demonstrated.has(objective) && !reviewed.has(objective));
}

export function acknowledgeReview(mission: Mission, objective: string) {
  return writeRecord(mission, (current) => {
    if (!current.check || !missionQuestions(mission).some((item) => item.objective === objective)) return null;
    const reviewed = new Set(current.reviewed ?? []);
    reviewed.add(objective);
    return { ...current, reviewed: [...reviewed] };
  });
}

function checkEvidence(missions: readonly Mission[], records: PortfolioRecords) {
  const assessed = new Set<string>();
  const demonstrated = new Set<string>();
  const reviewed = new Set<string>();
  for (const mission of missions) {
    if (records[mission.id]?.legacyVerified && mission.kind === "dispatch") {
      assessed.add("2.2");
      demonstrated.add("2.2");
    }
    if (mission.kind === "dispatch" && records[mission.id]?.reviewed?.includes("2.2")) reviewed.add("2.2");
    const check = records[mission.id]?.check;
    if (!check || !Array.isArray(check.priorExposure) || answeredBeforeRelease(check.submittedAt)) continue;
    for (const item of missionQuestions(mission)) {
      const answer = check.answers?.[item.id];
      if (!Array.isArray(answer)) continue;
      if (records[mission.id].reviewed?.includes(item.objective)) reviewed.add(item.objective);
      if (check.priorExposure.includes(item.id)) continue;
      assessed.add(item.objective);
      if (isCorrect(item, answer)) demonstrated.add(item.objective);
    }
  }
  return { assessed, demonstrated, reviewed };
}

export function cityItemExposure(track: Track, records: PortfolioRecords) {
  const earliest = new Map<string, number>();
  function seen(id: string, at: number) {
    earliest.set(id, Math.min(at, earliest.get(id) ?? Infinity));
  }
  for (const mission of missionsFor(track.id)) {
    const record = records[mission.id];
    for (const id of record?.lensItems ?? []) seen(id, record.lensExposure?.[id] ?? 0);
    for (const check of [...(record?.checkHistory ?? []), ...(record?.check ? [record.check] : [])]) {
      for (const id of Object.keys(check.answers)) seen(id, check.submittedAt ?? 0);
    }
  }
  return earliest;
}

export function portfolioEvidence(track: Track, records: PortfolioRecords, legacy: ReadonlySet<string>) {
  const missions = missionsFor(track.id);
  const completed = missions.filter((mission) => missionCompleted(mission, records, legacy));
  const covered = new Set(missions.flatMap((mission) => missionMappings(mission).map(({ objective }) => objective)));
  const earned = completed.flatMap((mission) => {
    const mappings = missionMappings(mission);
    const record = records[mission.id];
    const lab = labFor(mission.id);
    // A lab outcome credits its objectives as applied (transfer passed without a reveal or worked example) or guided.
    if (lab && record?.lab?.outcome && labOutcomePassed(lab, record.lab.outcome)) {
      const credit = record.lab.mastery.credit ?? record.lab.mastery;
      return mappings.filter(({ objective }) => lab.objectives.includes(objective))
        .map(({ objective }) => ({ objective, independent: labIndependent(lab, credit, objective) }));
    }
    const exercise = caseworkFor(mission.id);
    // Saves without a mastery record predate it and keep full credit.
    const mastery = record?.casework && exercise ? record.mastery?.credit ?? record.mastery : undefined;
    return mappings.filter(({ objective }) => !record?.casework || !exercise || exercise.objectives.includes(objective))
      .map(({ objective }) => ({ objective, independent: !mastery || !exercise || caseIndependent(exercise, mastery, objective) }));
  });
  const applied = new Set(earned.filter(({ independent }) => independent).map(({ objective }) => objective));
  // Completed with a revealed answer or a worked example: shown separately and never counted as applied.
  const guided = new Set(earned.filter(({ objective, independent }) => !independent && !applied.has(objective)).map(({ objective }) => objective));
  const checks = missions.filter(({ id }) => !!records[id]?.check || records[id]?.reviewed?.includes("2.2") && id === "dispatch-lookup");
  const delayed = missions.filter(({ id }) => !!records[id]?.followup);
  const retained = new Set<string>();
  for (const mission of delayed) {
    const attempt = records[mission.id].followup!;
    for (const question of missionFollowupQuestions(mission, attempt.answers)) {
      if (isCorrect(question, attempt.answers[question.id] ?? [])) retained.add(question.objective);
    }
  }
  return { missions, completed, checks, delayed, retained, covered, applied, guided, ...checkEvidence(missions, records), domains: track.domains };
}

type ExposureSave = { seen?: string[]; attempts?: { answers: Record<string, unknown> }[]; draft?: { answers?: Record<string, unknown> } | null };
function readExposure(track: Track): ExposureSave | null {
  try {
    const value = JSON.parse(readProgressItem(progressKey(track)) ?? "null");
    if (!value || typeof value !== "object") return null;
    return {
      seen: Array.isArray(value.seen) ? value.seen.filter((id: unknown): id is string => typeof id === "string") : [],
      attempts: Array.isArray(value.attempts) ? value.attempts.filter((entry: unknown) => !!entry && typeof entry === "object" && !!(entry as { answers?: unknown }).answers && typeof (entry as { answers?: unknown }).answers === "object") : [],
      draft: value.draft && typeof value.draft === "object" && value.draft.answers && typeof value.draft.answers === "object" ? value.draft : null,
    };
  } catch {
    return null;
  }
}
