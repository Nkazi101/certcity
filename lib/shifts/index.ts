// Daily shifts across the city: which building hosts one for a track, and where each learner stands today.
// Safe to import from client components; reading status touches localStorage (through progress storage) only when called.
import type { TrackId } from "../claude/blueprints";
import { lessonObjectiveFor } from "../claude/lessons/paths";
import { completedShifts, shiftAvailableToday, streak, upcomingConcepts } from "./engine";
import type { ShiftContent, ShiftState } from "./engine";
import { dispatchContent } from "./dispatch";
import { frontOfficeContent } from "./front-office";
import { readShiftState } from "./storage";

export type ShiftId = "dispatch" | "front-office";

export type ShiftInfo = {
  id: ShiftId;
  track: TrackId;
  /** City place id (lib/world.ts) for the building that hosts the shift; City Dispatch is its own depot view. */
  place: "dispatch" | "school";
  building: string;
  title: string;
  /** About how long a counted shift takes. */
  minutes: number;
  openHref: `/?shift=${ShiftId}`;
};

export const shiftInfo: Readonly<Record<ShiftId, ShiftInfo>> = {
  dispatch: { id: "dispatch", track: "architect-foundations", place: "dispatch", building: "City Dispatch", title: "Support counter shift", minutes: 5, openHref: "/?shift=dispatch" },
  "front-office": { id: "front-office", track: "associate-foundations", place: "school", building: "Maplewood School", title: "Front office shift", minutes: 5, openHref: "/?shift=front-office" },
};

// Packs differ in concept and item types; callers only use the shared engine functions.
export const shiftContent: Readonly<Record<ShiftId, ShiftContent<any, any>>> = {
  dispatch: dispatchContent,
  "front-office": frontOfficeContent,
};

export function isShiftId(value: string | null | undefined): value is ShiftId {
  return value === "dispatch" || value === "front-office";
}

/** Shifts that practice a track's objectives, in the order a "today's work" list should offer them. */
export function shiftsForTrack(trackId: TrackId): ShiftInfo[] {
  return Object.values(shiftInfo).filter(({ track }) => track === trackId);
}

export type ShiftStatus = {
  id: ShiftId;
  /** A counted shift can still be worked today (local calendar day). */
  availableToday: boolean;
  doneToday: boolean;
  /** Consecutive days with a counted shift, including today once it is done. */
  streak: number;
  /** Counted shifts so far. */
  completed: number;
  /** Exam objectives (as the track's lab and items number them) the next counted shift reviews; empty once done today. */
  dueObjectives: string[];
  /** The same objectives mapped to the lesson numbering of the current exam guide (for lesson links). */
  dueLessons: string[];
  openHref: ShiftInfo["openHref"];
};

/** Pure form, for callers (and checks) that already hold a state. */
export function statusFromState(id: ShiftId, state: ShiftState, now = Date.now()): ShiftStatus {
  const content = shiftContent[id];
  const availableToday = shiftAvailableToday(state, now);
  const dueObjectives = [...new Set(upcomingConcepts(content, state, now).map((concept) => content.conceptNotes[concept].objective as string))].sort();
  const track = { id: shiftInfo[id].track };
  const dueLessons = [...new Set(dueObjectives.map((objective) => lessonObjectiveFor(track, undefined, objective)).filter((entry): entry is string => !!entry))].sort();
  return {
    id, availableToday, doneToday: !availableToday, streak: streak(state, now),
    completed: completedShifts(state).length, dueObjectives, dueLessons, openHref: shiftInfo[id].openHref,
  };
}

/** Today's status for one shift, read from the learner's saved progress (browser only; empty state on the server). */
export function shiftStatus(id: ShiftId, now = Date.now()): ShiftStatus {
  return statusFromState(id, readShiftState(id), now);
}
