import type { PracticeItem, sources } from "../items";

/** Distractor classes from research/exam-realism.md §2 (D1–D11). Each wrong option fails for one of these reasons. */
export type DistractorPattern = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8" | "D9" | "D10" | "D11";

/** An option and what happens in the case when it is chosen. */
export type GuideOption = readonly [choice: string, consequence: string];
export type GuideDistractor = readonly [choice: string, consequence: string, pattern: DistractorPattern];

/**
 * One guide-practice decision per objective. Saved progress stores only the objective id
 * (readiness `guide`), so options can be reworded or reordered without migrating anything.
 * Display order comes from `guideChoices`, seeded by the case text.
 */
export type GuideActivity = readonly [
  objective: PracticeItem["objective"], source: keyof typeof sources, caseFile: string,
  answer: GuideOption, explanation: string, distractors: readonly GuideDistractor[],
];
