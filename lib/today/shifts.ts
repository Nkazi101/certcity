import type { TrackId } from "../claude/blueprints";
import { shiftInfo, shiftsForTrack, shiftStatus } from "../shifts";
import { shiftStorageKey } from "../shifts/storage";
import type { ShiftInfo } from "./plan";

/** Daily shifts a track's learners can play, as today's-work review items. */
export function shiftsForToday(track: TrackId, now: number): ShiftInfo[] {
  return shiftsForTrack(track).map((info) => {
    const status = shiftStatus(info.id, now);
    return { id: info.id, title: `${info.title} at ${info.building}`, place: info.place, href: info.openHref, availableToday: status.availableToday, doneToday: status.doneToday, played: status.completed, minutes: info.minutes + 3 };
  });
}

/** Storage keys whose change can finish a shift item. */
export const shiftKeys: readonly string[] = Object.keys(shiftInfo).map(shiftStorageKey);
