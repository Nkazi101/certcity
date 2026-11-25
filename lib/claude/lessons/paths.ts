import { trackHref } from "../blueprints";
import type { Domain, Track, TrackId } from "../blueprints";
import { decemberBlueprints, decemberVersion, hasDecemberGuide } from "../december-blueprints";
import type { ExamVersion } from "../december-blueprints";
import { associateAlignment, developerAlignment, professionalAlignment } from "../assessment/december-alignment";
import type { Alignment } from "../assessment/december-alignment";
import type { PracticeItem } from "../items";
import { readProgressItem, writeProgressItem } from "../../progress-storage";

// Lessons follow each track's current guide: v1.1 (November) for Architect Foundations, v1.0 (November) for Developer
// Professional, and December 7 for the others.
// This module stays free of lesson text so client components can link to lessons cheaply.

const julyToCurrent: Partial<Record<TrackId, Alignment>> = {
  "associate-foundations": associateAlignment,
  "developer-foundations": developerAlignment,
  "architect-professional": professionalAlignment,
};

export function lessonDomains(track: Pick<Track, "id" | "domains">): readonly Domain[] {
  return hasDecemberGuide(track.id) ? decemberBlueprints[track.id].domains : track.domains;
}

export function lessonObjectives(track: Pick<Track, "id" | "domains">) {
  return lessonDomains(track).flatMap((domain) => domain.objectives.map((title, index) => ({
    id: `${domain.id}.${index + 1}` as PracticeItem["objective"], title, domain,
  })));
}

/** The lesson that teaches an objective from the guide a question was written for. */
export function lessonObjectiveFor(track: Pick<Track, "id">, version: ExamVersion | undefined, objective: string) {
  if (!hasDecemberGuide(track.id) || version === decemberVersion) return objective;
  return julyToCurrent[track.id]?.[objective as PracticeItem["objective"]] ?? null;
}

export const lessonSlug = (objective: string) => objective.replace(".", "-");
export const slugObjective = (slug: string) => /^\d+-\d+$/.test(slug) ? slug.replace("-", ".") : null;

export function studyHref(track: Pick<Track, "id">) {
  return `${trackHref(track as Track)}/study`;
}

export function lessonHref(track: Pick<Track, "id">, objective: string) {
  return `${studyHref(track)}/${lessonSlug(objective)}`;
}

const legacyStudiedKey = (track: TrackId) => `certcity.lessons.v1.${track}`;
/** Synced with the learner's account when signed in (see isProgressKey). */
export const studiedKey = (track: TrackId) => `certcity.lessons.v2.${track}`;

export function readStudied(track: TrackId): Set<string> {
  try {
    const saved = readProgressItem(studiedKey(track));
    const value = saved !== null ? JSON.parse(saved)?.studied : JSON.parse(window.localStorage.getItem(legacyStudiedKey(track)) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((entry: unknown): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set();
  }
}

export function setStudied(track: TrackId, objective: string, studied: boolean) {
  const next = readStudied(track);
  if (studied) next.add(objective);
  else next.delete(objective);
  try {
    writeProgressItem(studiedKey(track), JSON.stringify({ studied: [...next] }));
    window.dispatchEvent(new CustomEvent("certcity:lessons", { detail: track }));
  } catch {
    // Reading still works; the mark lasts for this page view.
  }
  return next;
}
