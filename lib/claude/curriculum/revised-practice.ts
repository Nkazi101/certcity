import type { TrackId } from "../blueprints";
import { item } from "../items";
import type { PracticeBank, PracticeItem } from "../items";
import type { GuideActivity } from "./types";
import { associateStudy } from "./associate";
import { developerStudy } from "./developer";
import { professionalStudy } from "./professional";
import { associateChecks, associateRetention } from "./associate-practice";
import { developerChecks, developerRetention } from "./developer-practice";
import { professionalChecks, professionalRetention } from "./professional-practice";

type Alternative = string | readonly [choice: string, rationale: string];

export type Check = readonly [
  objective: PracticeItem["objective"], setting: string, question: string, answer: Alternative,
  explanation: string, alternative: Alternative, secondAlternative: Alternative, thirdAlternative: Alternative,
];

function bank(role: string, activities: readonly GuideActivity[], practice: readonly Check[], followup: readonly Check[]): PracticeBank {
  const source = new Map(activities.map(([objective, reference]) => [objective, reference]));
  function build(checks: readonly Check[], stage: string) {
    return checks.map(([objective, setting, question, answer, explanation, ...alternatives], index) => {
      const position = (index * 3 + Math.floor(index / 4)) % 4;
      const choices = alternatives.map((option) => typeof option === "string" ? [option, ""] as const : option);
      const keyed = typeof answer === "string" ? [answer, ""] as const : answer;
      const options = [...choices.slice(0, position), keyed, ...choices.slice(position)];
      return item(`dec-practice-${role}-${stage}-${objective}`, objective, source.get(objective)!, setting, question,
        String.fromCharCode(97 + position), explanation, ...options);
    });
  }
  return { practice: build(practice, "short"), followup: build(followup, "weekly") };
}

export const revisedPracticeBanks: Partial<Record<TrackId, PracticeBank>> = {
  "associate-foundations": bank("associate", associateStudy, associateChecks, associateRetention),
  "developer-foundations": bank("developer", developerStudy, developerChecks, developerRetention),
  "architect-professional": bank("professional", professionalStudy, professionalChecks, professionalRetention),
};
