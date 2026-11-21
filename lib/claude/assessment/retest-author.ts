import { item } from "../items";
import type { PracticeItem, sources } from "../items";

type Objective = PracticeItem["objective"];
type Source = keyof typeof sources;
type Question = readonly [
  id: string, objective: Objective, source: Source, prompt: string,
  answer: string | readonly [string, string], explanation: string,
  distractorA: string, distractorB: string, distractorC: string,
  rationales?: readonly [string, string, string, string] | readonly [string, string, string, string, string],
];

/** Build an original held-out case. Key positions are assigned to the full form. */
export function retestCase(scenario: string, context: string, questions: readonly Question[]): PracticeItem[] {
  return questions.map(([id, objective, source, prompt, answer, explanation, a, b, c, rationales]) => {
    const correct = typeof answer === "string" ? [answer] : answer;
    return {
      ...item("retest-" + id, objective, source, scenario, prompt, typeof answer === "string" ? "a" : "ab",
        explanation, ...[...correct, a, b, c].map((choice, index) => [choice, rationales?.[index] ?? ""] as const)),
      context,
    };
  });
}

const singlePositions = ["a", "b", "c", "d"];
const pairedPositions = ["ab", "ac", "ad", "ae", "bc", "bd", "be", "cd", "ce", "de"];

export function arrangeRetest(form: readonly PracticeItem[]) {
  let seed = 2166136261;
  for (const character of form[0]?.id ?? "") seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);

  // Stable across reloads. Balance positions to avoid an answerable pattern without changing question content.
  function shuffle<T>(values: readonly T[]) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const pick = (seed >>> 0) % (index + 1);
      [result[index], result[pick]] = [result[pick], result[index]];
    }
    return result;
  }

  const singles = form.filter(({ correct }) => correct.length === 1).length;
  const positionSchedule = (count: number, choices: string[]) =>
    shuffle(Array.from({ length: count }, (_, index) => choices[index % choices.length]));
  const singleKeys = positionSchedule(singles, shuffle(singlePositions));
  const pairedKeys = positionSchedule(form.length - singles, shuffle(pairedPositions));

  return form.map((question) => {
    const keys = question.correct.length === 1 ? singleKeys : pairedKeys;
    const correct = [...keys.pop()!];
    const right = shuffle(question.options.filter(([id]) => question.correct.includes(id)));
    const wrong = shuffle(question.options.filter(([id]) => !question.correct.includes(id)));
    const entries = question.options.map(([id]) => ({ id, original: (correct.includes(id) ? right : wrong).pop()! }));
    return { ...question, correct,
      options: entries.map(({ id, original }) => [id, original[1]] as const),
      rationales: Object.fromEntries(entries.map(({ id, original }) => [id, question.rationales[original[0]]])),
    };
  });
}
