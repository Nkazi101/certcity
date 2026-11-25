import type { Track } from "../claude/blueprints";
import { trackPracticeHref } from "../claude/blueprints";
import { caseworkFor } from "../claude/cases";
import { missionMappings } from "../claude/missions";
import type { Mission } from "../claude/missions";
import { missingExpertise, missionCompleted, missionFollowupAt, missionPreparationSteps, unmetMissions } from "../claude/pathway";
import type { PortfolioRecords } from "../claude/pathway";
import { labFor } from "../labs";

/**
 * Today's work: one short daily session built from the city's cases, so experience comes first and counts.
 *
 * - The case is the daily unit. Lessons are never assigned; each case opens the lesson for a skill when you get stuck.
 * - The exam date only sets the pace (minutes per day). Without one, a steady ~25 minutes a day.
 * - The suggested case order shapes the list, but nothing is locked: "Keep going" offers everything else.
 * - Review rides along: 7-day checks on finished cases and the track's daily shift, when it has one.
 * - Milestones (practice exam, hands-on lab, 7-day review lab) arrive when the pacing says they're due.
 */

export type TodayAction =
  | { type: "mission"; missionId: string; study?: "check" | "followup" }
  | { type: "href"; href: string }
  | { type: "date" };

export type TodayItem = {
  key: string;
  kind: "date" | "followup" | "shift" | "case" | "wrapup" | "redo" | "exam" | "lab" | "transfer" | "review";
  label: string;
  detail: string;
  minutes: number;
  place?: string;
  action: TodayAction;
  /** Reaching this value of `measure` marks the item done (see todayMeasures). */
  base?: number;
};

/** `played`: counted shifts so far. A first shift reads as practice for the case it follows, not as review. */
export type ShiftInfo = { id: string; title: string; place: string; href: string; availableToday: boolean; doneToday: boolean; played: number; minutes: number };

export type PlanInput = {
  track: Track;
  now: number;
  examDate: string | null;
  daysLeft: number | null;
  missions: readonly Mission[];
  records: PortfolioRecords;
  legacy: ReadonlySet<string>;
  starterDone: boolean;
  dateAsked: boolean;
  exam: { taken: boolean; met: boolean; weakDomains: readonly { id: number; title: string }[]; confirmationNeeded: boolean };
  lab: { passed: boolean; transferDue: number | null; transferPassed: boolean };
  city: { domains: readonly { id: number; title: string; applied: number }[] };
  applied: ReadonlySet<string>;
  shifts: readonly ShiftInfo[];
};

const examMinutes = 120;
const labMinutes = 30;
const transferMinutes = 20;
const relaxedMinutes = 25;

export function missionMinutes(mission: Mission) {
  if (labFor(mission.id)) return 20;
  if (mission.kind === "dispatch") return 15;
  return caseworkFor(mission.id) ? 12 : 10;
}

const domainsOf = (mission: Mission) => new Set(missionMappings(mission).map(({ objective }) => Number(objective.split(".")[0])));

function drafted(mission: Mission, records: PortfolioRecords) {
  const record = records[mission.id];
  return !!(record?.caseDraft || record?.workDraft || record?.lab?.drafts || (!record?.casework && record?.draft));
}

/** Steps toward a case's 4-part progress (solve, debrief, check, 7-day check). */
export function missionSteps(mission: Mission, records: PortfolioRecords, legacy: ReadonlySet<string>) {
  return missionPreparationSteps(missionCompleted(mission, records, legacy), records[mission.id]).filter(Boolean).length;
}

/** Cases in the order today's work offers them: in progress first, then the suggested order, favouring weak areas. */
export function rankMissions(input: PlanInput) {
  const { missions, records, legacy, exam, city } = input;
  const missingAreas = new Set(city.domains.filter(({ applied }) => applied === 0).map(({ id }) => id));
  const weak = new Set(exam.weakDomains.map(({ id }) => id));
  const open = missions.filter((mission) => !missionCompleted(mission, records, legacy));
  const score = (mission: Mission, index: number) => {
    const areas = domainsOf(mission);
    let value = index * 0.1;
    if (drafted(mission, records)) value -= 100;
    // Each exam's starter case is written as the way in: it comes first.
    if (mission.kind === "original" || mission.kind === "dispatch") value -= 50;
    if (unmetMissions(mission, records, legacy).length || missingExpertise(mission, records).length) value += 20;
    if ([...areas].some((id) => missingAreas.has(id))) value -= 5;
    if ([...areas].some((id) => weak.has(id))) value -= 4;
    return value;
  };
  return open.map((mission) => ({ mission, score: score(mission, missions.indexOf(mission)) }))
    .sort((left, right) => left.score - right.score).map(({ mission }) => mission);
}

/** Completed cases whose objectives were only reached with a worked example or revealed answer, in areas still missing. */
function redoCandidates(input: PlanInput) {
  const { missions, records, legacy, applied, city } = input;
  const missingAreas = new Set(city.domains.filter(({ applied: count }) => count === 0).map(({ id }) => id));
  return missions.filter((mission) => missionCompleted(mission, records, legacy) && !legacy.has(mission.id) &&
    missionMappings(mission).some(({ objective }) => !applied.has(objective) && missingAreas.has(Number(objective.split(".")[0]))));
}

function caseItem(mission: Mission, input: PlanInput, places: Record<string, string>): TodayItem {
  const steps = missionSteps(mission, input.records, input.legacy);
  const inProgress = drafted(mission, input.records);
  return {
    key: `case:${mission.id}`, kind: "case", place: mission.place,
    label: inProgress ? `Finish ${mission.title}` : mission.title,
    detail: `${places[mission.place] ?? "In the city"} · ${mission.brief}`,
    minutes: missionMinutes(mission), action: { type: "mission", missionId: mission.id }, base: steps,
  };
}

/** The remaining work, in minutes, that pacing spreads over the days left. */
export function remainingMinutes(input: PlanInput) {
  const open = input.missions.filter((mission) => !missionCompleted(mission, input.records, input.legacy));
  return open.reduce((sum, mission) => sum + missionMinutes(mission) + 4, 0) +
    (input.exam.met ? 0 : examMinutes) + (input.lab.passed ? 0 : labMinutes) + (input.lab.transferPassed ? 0 : transferMinutes) +
    (input.exam.confirmationNeeded ? examMinutes : 0);
}

/** Minutes a day the plan aims for: the remaining work spread over the days left, within humane bounds. */
export function dailyMinutes(input: PlanInput) {
  if (input.daysLeft === null || input.daysLeft < 0) return relaxedMinutes;
  const days = Math.max(1, input.daysLeft - 1);
  return Math.min(150, Math.max(15, Math.ceil(remainingMinutes(input) / days / 5) * 5));
}

export function planToday(input: PlanInput, placeNames: Record<string, string>): { today: TodayItem[]; more: TodayItem[]; budget: number } {
  const { track, now, records, legacy, exam, lab } = input;
  const practice = trackPracticeHref(track);
  const budget = dailyMinutes(input);
  const fixed: TodayItem[] = [];

  if (!input.examDate && input.starterDone && !input.dateAsked) {
    fixed.push({ key: "date", kind: "date", label: "When is your exam?", detail: "Add a date and today's work paces itself to it. No date is fine too.", minutes: 1, action: { type: "date" } });
  }
  for (const mission of input.missions) {
    const record = records[mission.id];
    const due = missionFollowupAt(record?.check);
    if (due !== null && due <= now && !record?.followup) {
      fixed.push({ key: `followup:${mission.id}`, kind: "followup", label: `7-day check: ${mission.title}`, detail: "Three questions on what you did a week ago. Remembering it now is what makes it stick.", minutes: 4, place: mission.place, action: { type: "mission", missionId: mission.id, study: "followup" } });
    }
  }
  // Before the starter case is done, a first shift waits until after it, so the story comes first.
  const laterShifts: TodayItem[] = [];
  for (const shift of input.shifts) {
    if (shift.availableToday && !shift.doneToday) {
      const item: TodayItem = {
        key: `shift:${shift.id}`, kind: "shift", label: shift.title, minutes: shift.minutes, place: shift.place, action: { type: "href", href: shift.href },
        detail: shift.played === 0
          ? `${placeNames[shift.place] ?? shift.place} · A few minutes of quick calls at the desk, using what the mission teaches.`
          : `${placeNames[shift.place] ?? shift.place} · A few minutes of quick calls that bring back what you missed before.`,
      };
      if (shift.played === 0 && !input.starterDone) laterShifts.push(item);
      else fixed.push(item);
    }
  }

  // Milestones, when the pacing says they're due.
  const total = input.missions.length;
  const done = input.missions.filter((mission) => missionCompleted(mission, records, legacy)).length;
  const examDue = !exam.taken && (done >= Math.ceil(total * 0.4) || (input.daysLeft !== null && input.daysLeft <= 10) || done === total);
  const milestones: TodayItem[] = [];
  if (examDue) milestones.push({ key: "exam", kind: "exam", label: "Take a practice exam", detail: `${examMinutes} minutes on a timer, results by exam area. It shows which missions to do next.`, minutes: examMinutes, action: { type: "href", href: `${practice}#rehearsal` } });
  if (exam.taken && !exam.met && exam.weakDomains.length) {
    const weakest = exam.weakDomains[0];
    milestones.push({ key: `review:${weakest.id}`, kind: "review", label: `Review ${weakest.title}`, detail: "Your practice exam was under target here. A short review, then a retest with new questions.", minutes: 15, action: { type: "href", href: `${practice}&domain=${weakest.id}` } });
  }
  if (exam.taken && !lab.passed) milestones.push({ key: "lab", kind: "lab", label: "Hands-on lab", detail: "Write the real files for a mission. Each check runs what you wrote.", minutes: labMinutes, action: { type: "href", href: `${practice}#track-practicals` } });
  if (lab.transferDue !== null && lab.transferDue <= now && !lab.transferPassed) milestones.push({ key: "transfer", kind: "transfer", label: "7-day review lab", detail: "The same skills a week later, in a new situation.", minutes: transferMinutes, action: { type: "href", href: `${practice}#track-practicals` } });
  if (exam.met && exam.confirmationNeeded) milestones.push({ key: "exam-2", kind: "exam", label: "Second practice exam", detail: "Your exam is close, so a second unseen exam stands in for the 7-day wait.", minutes: examMinutes, action: { type: "href", href: `${practice}#rehearsal` } });

  const cases = rankMissions(input).map((mission) => caseItem(mission, input, placeNames));
  const redo = redoCandidates(input).map((mission): TodayItem => ({
    key: `redo:${mission.id}`, kind: "redo", place: mission.place, label: `Solve ${mission.title} on your own`,
    detail: "You finished it with a worked example. Solving it unaided is what counts for this exam area.",
    minutes: missionMinutes(mission), action: { type: "mission", missionId: mission.id },
  }));

  // Fill the day: fixed items, then the next case, then milestones and more cases until the budget is used.
  const today: TodayItem[] = [...fixed];
  let used = fixed.reduce((sum, item) => sum + item.minutes, 0);
  const queue = [...(cases.length ? [cases[0]] : []), ...laterShifts, ...milestones, ...cases.slice(1), ...redo];
  for (const item of queue) {
    const primary = !today.some(({ kind }) => kind === "case" || kind === "exam" || kind === "lab" || kind === "transfer" || kind === "review" || kind === "redo");
    // A long milestone gets a day of its own unless the budget allows it.
    if (!primary && used + item.minutes > budget) continue;
    if (primary && item.minutes > budget && today.length > fixed.length) continue;
    today.push(item);
    used += item.minutes;
    if (used >= budget && today.length >= fixed.length + 1) break;
  }
  const chosen = new Set(today.map(({ key }) => key));
  const more = queue.filter(({ key }) => !chosen.has(key)).slice(0, 4);
  return { today, more, budget };
}
