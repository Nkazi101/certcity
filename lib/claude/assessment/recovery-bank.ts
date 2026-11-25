import type { TrackId } from "../blueprints";
import type { ExamVersion } from "../december-blueprints";
import { decemberVersion, hasDecemberGuide } from "../december-blueprints";
import type { PracticeItem } from "../items";
import { associateAlignment, developerAlignment, professionalAlignment } from "./december-alignment";
import { associateReserve } from "./recovery-associate";
import { architectReserve } from "./recovery-architect";
import { architectFocused } from "./focused-architect";
import { developerReserve } from "./recovery-developer";
import { developerFocused } from "./focused-developer";
import { professionalReserve } from "./recovery-professional";
import type { RecoveryItem } from "./recovery-author";
import { developerProfessionalReserveFull } from "./recovery-developer-professional";
import { developerProfessionalFocused } from "./focused-developer-professional";

type Reserve = { full: readonly RecoveryItem[]; focused: readonly RecoveryItem[] };
const banks: Record<TrackId, Reserve> = {
  "associate-foundations": associateReserve,
  "developer-foundations": { ...developerReserve, focused: developerFocused },
  "architect-foundations": { ...architectReserve, focused: architectFocused },
  "architect-professional": professionalReserve,
  "developer-professional": { full: developerProfessionalReserveFull, focused: developerProfessionalFocused },
};

const alignment = {
  "associate-foundations": associateAlignment,
  "developer-foundations": developerAlignment,
  "architect-professional": professionalAlignment,
};

export function recoveryBank(track: TrackId, version?: ExamVersion): { full: PracticeItem[]; focused: PracticeItem[] } {
  const { full, focused } = banks[track];
  function forGuide(pool: readonly RecoveryItem[]) {
    return pool.flatMap(({ revised, ...entry }) => {
      if (version === decemberVersion && hasDecemberGuide(track)) {
        const skill = revised ?? alignment[track][entry.objective];
        return skill ? [{ ...entry, objective: skill, skill }] : [];
      }
      return entry.pilot || entry.skill === "revised-only" ? [] : [entry];
    });
  }
  return { full: forGuide(full), focused: forGuide(focused) };
}
