import { assignmentFollowups } from "./assignment-followups";
import { progressScope, readProgressItem, writeProgressItem } from "../progress-storage";
import { followupDays, gradeAttempt, isCorrect, modulePreparationSteps, readCertification } from "../certification-progress";
import type { SkillAttempt } from "../certification-progress";
import { skillChecks } from "../exam-practice";
import { architectMissions } from "./architect-missions";
import { associateMissions, developerMissions, professionalMissions } from "./role-missions";
import { distinctSettings, missionTransfer } from "./mission-transfer";
import { tracks } from "./blueprints";
import { cityChecks } from "./city-checks";
import { readCityCheck } from "./city-progress";
import { isCityAssignment } from "./assignments";
import type { Track, TrackId } from "./blueprints";
import { missionMappings, missionPassed } from "./missions";
import type { Choices, Mission } from "./missions";
import { banks } from "./practice";
import { readProgress } from "./progress";
import { missionExperiences } from "./mission-experiences";
import { assignmentChoices, validAssignmentWork } from "./assignment-work";
import type { AssignmentWork } from "./assignment-work";
import { caseworkFor } from "./cases";
import { caseworkPassed, validCaseDraft } from "./casework";
import type { CaseDraft } from "./casework";

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
];

export type MissionCheck = { answers: Record<string, string[]>; priorExposure: string[]; submittedAt?: number };
export type MissionRecord = {
  choices?: Choices;
  draft?: Choices;
  work?: AssignmentWork;
  workDraft?: AssignmentWork;
  casework?: CaseDraft;
  caseDraft?: CaseDraft;
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
      ...(casework && validCaseDraft(casework, value.casework) && { casework: value.casework }),
      ...(casework && validCaseDraft(casework, value.caseDraft) && { caseDraft: value.caseDraft }),
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
  if (!exercise || !validCaseDraft(exercise, draft) || (commit && !caseworkPassed(exercise, draft))) return null;
  return writeRecord(mission, (current) => commit
    ? { ...current, casework: draft, caseDraft: undefined }
    : { ...current, caseDraft: draft });
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
    const practice = readProgress(track);
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
    if (!check || !Array.isArray(check.priorExposure)) continue;
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
  const applied = new Set(completed.flatMap((mission) => {
    const mappings = missionMappings(mission);
    const exercise = caseworkFor(mission.id);
    return mappings.filter(({ objective }) => !records[mission.id]?.casework || !exercise || exercise.objectives.includes(objective))
      .map(({ objective }) => objective);
  }));
  const checks = missions.filter(({ id }) => !!records[id]?.check || records[id]?.reviewed?.includes("2.2") && id === "dispatch-lookup");
  const delayed = missions.filter(({ id }) => !!records[id]?.followup);
  const retained = new Set<string>();
  for (const mission of delayed) {
    const attempt = records[mission.id].followup!;
    for (const question of missionFollowupQuestions(mission, attempt.answers)) {
      if (isCorrect(question, attempt.answers[question.id] ?? [])) retained.add(question.objective);
    }
  }
  return { missions, completed, checks, delayed, retained, covered, applied, ...checkEvidence(missions, records), domains: track.domains };
}
