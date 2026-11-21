import { item } from "../items";
import type { PracticeItem, sources } from "../items";

type Objective = PracticeItem["objective"];
type Source = keyof typeof sources;
type Choice = string | readonly [response: string, rationale: string];

type Decision = readonly [
  id: string,
  earlier: Objective | null,
  source: Source,
  question: string,
  explanation: string,
  answer: Choice | { both: readonly [Choice, Choice] },
  distractorA: Choice,
  distractorB: Choice,
  distractorC: Choice,
  revised?: Objective | false,
];

export type RecoveryItem = PracticeItem & { revised?: Objective | false };

export function recoveryCase(
  scenario: string,
  context: string,
  decisions: readonly Decision[],
  purpose: "full" | "focus" | "pilot" = "full",
): RecoveryItem[] {
  return decisions.map(([id, earlier, source, question, explanation, answer, a, b, c, revised]) => {
    const multiple = typeof answer === "object" && "both" in answer;
    const correct = multiple ? answer.both : [answer];
    const choices = [...correct, a, b, c].map((choice) => typeof choice === "string" ? [choice, ""] as const : choice);
    const objective = earlier ?? (revised || "0.0");
    return {
      ...item(`reserve-${id}`, objective, source, scenario, question, multiple ? "ab" : "a", explanation, ...choices),
      context,
      pilot: purpose === "pilot" || undefined,
      revised,
      ...(earlier === null && { skill: "revised-only" }),
    };
  });
}
