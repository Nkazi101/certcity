import { readProgressItem, writeProgressItem } from "../progress-storage";
import { assignments, isCityAssignment } from "./assignments";
import type { CityAssignmentId } from "./assignments";
import { blueprint, tracks } from "./blueprints";
import type { Track } from "./blueprints";

export const activeAssignmentKey = "certcity.city.active-assignment.v1";
const resultKey = "certcity.city.assignment.v1";

export function cityAssignmentKey(track: Track) {
  return `${resultKey}.${track.id}`;
}

export type CityAssignmentSave = { choices: Record<string, number> | null };

export function readCityAssignment(track: Track): CityAssignmentSave | null {
  if (!isCityAssignment(track.id)) return null;
  try {
    const choices = JSON.parse(readProgressItem(cityAssignmentKey(track)) ?? "null");
    if (validReplay(track.id, choices)) return { choices };
    const earlier = JSON.parse(readProgressItem(`certcity.practice.${track.code}.${blueprint}`) ?? "null");
    return earlier?.assignment === true ? { choices: null } : null;
  } catch {
    return null;
  }
}

function validReplay(id: CityAssignmentId, choices: unknown): choices is Record<string, number> {
  if (!choices || typeof choices !== "object") return false;
  const record = choices as Record<string, number>;
  const assignment = assignments[id];
  return assignment.controls.every(({ id, choices }) => Number.isInteger(record[id]) && record[id] >= 0 && record[id] < choices.length) &&
    assignment.replay(record).rows.every(({ accepted }) => accepted);
}

export function saveCityAssignment(track: Track, choices: Record<string, number>) {
  if (!isCityAssignment(track.id) || !validReplay(track.id, choices)) return false;
  try {
    return writeProgressItem(cityAssignmentKey(track), JSON.stringify(choices));
  } catch {
    return false;
  }
}

export function readActiveAssignment() {
  try {
    const id = readProgressItem(activeAssignmentKey);
    return tracks.find((track) => track.id === id) ?? null;
  } catch {
    return null;
  }
}

export function saveActiveAssignment(track: Track) {
  try {
    writeProgressItem(activeAssignmentKey, track.id);
  } catch {
    // The active assignment remains available for this visit.
  }
}

type CheckQuestion = {
  id: string;
  options: readonly (readonly [id: string, label: string])[];
  correct: readonly string[];
};
type CheckAnswers = Record<string, string[]>;

function validCheck(questions: readonly CheckQuestion[], value: unknown): value is CheckAnswers {
  if (!value || typeof value !== "object") return false;
  const answers = value as CheckAnswers;
  return questions.every(({ id, options, correct }) => {
    const picks = answers[id];
    return Array.isArray(picks) && picks.length === correct.length &&
      new Set(picks).size === picks.length && picks.every((pick) => options.some(([option]) => option === pick));
  });
}

export function readCityCheck(id: CityAssignmentId, questions: readonly CheckQuestion[]) {
  try {
    const result = JSON.parse(readProgressItem(`certcity.city.check.v1.${id}`) ?? "null");
    return validCheck(questions, result) ? result : null;
  } catch {
    return null;
  }
}

export function saveCityCheck(id: CityAssignmentId, questions: readonly CheckQuestion[], answers: CheckAnswers) {
  const previous = readCityCheck(id, questions);
  if (previous) return { answers: previous, saved: true };
  if (!validCheck(questions, answers)) return { answers: null, saved: false };
  try {
    return { answers, saved: writeProgressItem(`certcity.city.check.v1.${id}`, JSON.stringify(answers)) };
  } catch {
    return { answers, saved: false };
  }
}
