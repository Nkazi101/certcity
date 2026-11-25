import { associateBank } from "./associate";
import { developerBank } from "./developer";
import { architectBank } from "./architect";
import { professionalBank } from "./professional";
import { developerProfessionalBank } from "./developer-professional-bank";
import type { PracticeBank } from "./items";
import type { TrackId } from "./blueprints";

/**
 * The base practice banks only. Kept apart from lib/claude/practice.ts, which also pulls in every rehearsal, retest
 * and recovery form (several MB), so the city can name and check case questions without loading the exam forms.
 */
export const banks: Record<TrackId, PracticeBank> = {
  "associate-foundations": associateBank,
  "developer-foundations": developerBank,
  "architect-foundations": architectBank,
  "architect-professional": professionalBank,
  "developer-professional": developerProfessionalBank,
};
