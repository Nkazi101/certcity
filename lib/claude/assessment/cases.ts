import { item } from "../items";
import type { PracticeItem, sources } from "../items";

/** One authored case can support related questions without repeating a teaching assignment. */
export type CaseQuestion = readonly [
  id: string, objective: PracticeItem["objective"], source: keyof typeof sources, prompt: string,
  key: string, explanation: string, ...choices: string[],
];

export function caseQuestions(scenario: string, context: string, questions: readonly CaseQuestion[], purpose = "benchmark") {
  return questions.map(([id, objective, source, prompt, key, explanation, ...choices]) => ({
    ...item(`${purpose}-${id}`, objective, source, scenario, prompt, key, explanation,
      ...choices.map((choice) => [choice, ""] as const)),
    context,
  }));
}
