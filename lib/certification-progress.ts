import { progressScope, readProgressItem, writeProgressItem } from "./progress-storage";
import type { CheckStage } from "./certification";
import { checkForAttempt, skillChecks } from "./exam-practice";
import type { ExamQuestion, SkillCheck } from "./exam-practice";

// Keep the original key so existing practice records survive the rename.
export const certificationKey = "simza.ccar-f.task-2.2.v1";
export const followupDays = 7;

export type SkillAttempt = {
  checkId: string;
  submittedAt: number;
  answers: Record<string, string[]>;
  score?: number;
};

export type CertificationProgress = {
  practiced: boolean;
  debriefSeen: boolean;
  first: SkillAttempt | null;
  followup: SkillAttempt | null;
  previousFirst: SkillAttempt | null;
  previousFollowup: SkillAttempt | null;
};

export const emptyProgress: CertificationProgress = {
  practiced: false, debriefSeen: false, first: null, followup: null, previousFirst: null, previousFollowup: null,
};

export function followupAt(first: SkillAttempt) {
  return first.submittedAt + followupDays * 24 * 60 * 60 * 1000;
}

export function modulePreparationSteps(assignmentSaved: boolean, debriefSeen: boolean, hasCheck: boolean, hasFollowup: boolean) {
  return [assignmentSaved, debriefSeen, hasCheck, hasFollowup] as const;
}

export function dispatchPreparationSteps(progress: CertificationProgress, shiftComplete: boolean) {
  return modulePreparationSteps(shiftComplete, progress.debriefSeen, !!progress.first, !!progress.followup);
}

function validAnswers(check: SkillCheck, answers: Record<string, unknown>) {
  return check.questions.every(({ id, options, correct }) => {
    const picks = answers[id];
    return Array.isArray(picks) && picks.length === correct.length && new Set(picks).size === picks.length &&
      picks.every((pick) => options.some(([value]) => value === pick));
  });
}

export function isCorrect(question: ExamQuestion, picks: string[]) {
  return picks.length === question.correct.length && question.correct.every((answer) => picks.includes(answer));
}

export function gradeAttempt(check: SkillCheck, attempt: SkillAttempt) {
  return attempt.score ?? check.questions.filter((question) => isCorrect(question, attempt.answers[question.id])).length;
}

function parseAttempt(stage: CheckStage, data: unknown): SkillAttempt | null {
  if (!data || typeof data !== "object") return null;
  const { checkId, submittedAt, answers } = data as { checkId?: string; submittedAt?: number; answers?: Record<string, unknown> };
  if (!checkId) return null;
  const check = checkForAttempt(stage, checkId);
  if (checkId !== check.id || typeof submittedAt !== "number" || !Number.isSafeInteger(submittedAt) ||
      submittedAt <= 0 || submittedAt > 8.64e15 || !answers || typeof answers !== "object") return null;
  const picks = Object.fromEntries(check.questions.map(({ id }) => [id, typeof answers[id] === "string" ? [answers[id]] : answers[id]]));
  if (!validAnswers(check, picks)) return null;
  return { checkId, submittedAt, answers: picks as SkillAttempt["answers"] };
}

export function readCertification(): CertificationProgress | null {
  try {
    const saved = JSON.parse(readProgressItem(certificationKey) ?? "null");
    if (!saved || typeof saved !== "object") return null;
    const first = parseAttempt("first", saved.first);
    const followup = parseAttempt("followup", saved.followup);
    const currentFirst = first?.checkId === skillChecks.first.id ? first : null;
    const currentFollowup = followup?.checkId === skillChecks.followup.id ? followup : null;
    return {
      practiced: saved.practiced === true,
      debriefSeen: saved.debriefSeen === true,
      first: currentFirst,
      followup: currentFirst && currentFollowup && currentFollowup.submittedAt >= followupAt(currentFirst) ? currentFollowup : null,
      previousFirst: first && !currentFirst ? first : parseAttempt("first", saved.previousFirst),
      previousFollowup: followup && !currentFollowup ? followup : parseAttempt("followup", saved.previousFollowup),
    };
  } catch {
    return null;
  }
}

type ProgressAction = { kind: "practice" | "debrief" } | { kind: "submit"; stage: CheckStage; answers: Record<string, string[]> };

export async function updateCertification(inSession: CertificationProgress, action: ProgressAction) {
  const scope = progressScope();
  function apply() {
    if (progressScope() !== scope) return { progress: inSession, saved: false, error: "Your account changed. Try again." };
    const stored = readCertification() ?? emptyProgress;
    const progress = {
      practiced: stored.practiced || inSession.practiced,
      debriefSeen: stored.debriefSeen || inSession.debriefSeen,
      first: stored.first ?? inSession.first,
      followup: stored.followup ?? inSession.followup,
      previousFirst: stored.previousFirst ?? inSession.previousFirst,
      previousFollowup: stored.previousFollowup ?? inSession.previousFollowup,
    };
    if (action.kind === "practice") {
      progress.practiced = true;
    } else if (action.kind === "debrief") {
      progress.debriefSeen = true;
    } else if (action.kind === "submit" && !progress[action.stage]) {
      const now = Date.now();
      const check = skillChecks[action.stage];
      if (!validAnswers(check, action.answers)) return { progress, saved: false, error: "Choose the requested number of answers for every question." };
      if (action.stage === "followup" && (!progress.first || now < followupAt(progress.first))) {
        return { progress, saved: false, error: "The follow-up window has yet to open." };
      }
      progress[action.stage] = { checkId: check.id, submittedAt: now, answers: action.answers };
    }

    try {
      return { progress, saved: writeProgressItem(certificationKey, JSON.stringify(progress)), error: null };
    } catch {
      return { progress, saved: false, error: null };
    }
  }

  // Serialize the read and write across tabs where Web Locks are available.
  if (navigator.locks) {
    try {
      return await navigator.locks.request(scope + ":" + certificationKey, apply);
    } catch {
      return apply();
    }
  }
  return apply();
}
