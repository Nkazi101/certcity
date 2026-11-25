import type { GuideActivity } from "./types";

export type GuideChoice = { text: string; consequence: string; correct: boolean };

// FNV-1a, then a small xorshift stream. Stable across server and client renders.
function seed(text: string) {
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Options in display order. The key's slot is seeded by the case text, so it is fixed per case and varies across cases. */
export function guideChoices([, , caseFile, [answer, effect], , distractors]: GuideActivity): GuideChoice[] {
  const choices: GuideChoice[] = [
    { text: answer, consequence: effect, correct: true },
    ...distractors.map(([text, consequence]) => ({ text, consequence, correct: false })),
  ];
  let state = seed(caseFile) || 1;
  for (let index = choices.length - 1; index > 0; index--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const swap = (state >>> 0) % (index + 1);
    [choices[index], choices[swap]] = [choices[swap], choices[index]];
  }
  return choices;
}

/** Short fingerprint of the wording a learner answered, attached to question reports. */
export function guideRevision([, , caseFile, [answer], , distractors]: GuideActivity) {
  return seed([caseFile, answer, ...distractors.map(([text]) => text)].join("|")).toString(36);
}
