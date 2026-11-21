import type { PracticeItem, sources } from "../items";

export type GuideActivity = readonly [
  objective: PracticeItem["objective"], source: keyof typeof sources, caseFile: string,
  change: string, comparison: string, effect: string, explanation: string, initialConsequence: string,
];
