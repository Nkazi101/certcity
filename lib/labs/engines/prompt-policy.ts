// Property-driven prompt simulation (provider-neutral). No deterministic system can execute natural language, so
// prompt labs use a proxy: read structural properties of the learner's text (which source it names, whether it lists
// required fields, whether its numbered steps run extract → check → draft, which instruction it gives for a gap),
// then produce the replies Claude tends to produce when instructions include or omit that property. Engines built on
// these helpers set `simulated: true`, so the bench labels their output honestly.
//
// Anti-gaming rules shared by every prompt lab:
// * a property binds to case-specific words (the signed sheet's name, the approver's name), not to generic advice;
// * a harmful instruction wins over a helpful one (a prompt that says both "say unknown" and "always give a date" guesses);
// * a fact typed into the prompt is used as written, so values copied from the sample break on a new case;
// * a floor on length and no TODO placeholders.
import type { TraceSource } from "../types";

/**
 * A sentence with the 1-based line it starts on, the whole line it sits in, and the nearest heading above it.
 * Line and heading let a short sentence ("No Dock B directions.") inherit who it is about from its label or section.
 */
export type Sentence = { text: string; line: number; lineText?: string; heading?: string };

/** Splits a document into sentences. Times (8:30) and decimals (18.40) stay whole. */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let heading = "";
  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, index) => {
    const line = raw.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, "").replace(/[*_`]/g, "").trim();
    if (!line) return;
    if (/^\s*#{1,6}\s/.test(raw)) heading = line;
    for (const part of line.split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)) {
      if (part.trim()) out.push({ text: part.trim(), line: index + 1, lineText: line, heading });
    }
  });
  return out;
}

/** The first pattern group found in the clause itself, else in its line, else in its heading. */
export function contextOf(sentence: Sentence, clause: string, groups: Readonly<Record<string, RegExp>>): string[] {
  for (const scope of [clause, sentence.lineText ?? "", sentence.heading ?? ""]) {
    const found = Object.entries(groups).filter(([, pattern]) => pattern.test(scope)).map(([name]) => name);
    if (found.length) return found;
  }
  return [];
}

/** True when a negation comes before the first match of `target` in the clause ("do not publish", not "publish, no rush"). */
export function negatedBefore(clause: string, target: RegExp) {
  const match = new RegExp(target.source, target.flags.replace("g", "")).exec(clause);
  return negation.test(match ? clause.slice(0, match.index) : clause);
}

/** Clauses inside a sentence: split on semicolons, "but", and "or" so a negation only covers its own clause. */
export function clauses(sentence: string): string[] {
  return sentence.split(/;|\s+(?:but|or|unless|except)\s+/i).map((part) => part.trim()).filter(Boolean);
}

export const negation = /\b(?:no|not|never|without|don['’]?t|do not|does not|doesn['’]?t|isn['’]?t|is not|aren['’]?t|are not|cannot|can['’]?t|leave out|leaves out|keep out|keep .{0,30} out|exclude|excluding|omit|avoid|nothing|none)\b/i;

export function negated(clause: string) {
  return negation.test(clause);
}

/** Sentences matching every pattern. */
export function where(list: readonly Sentence[], ...patterns: readonly RegExp[]) {
  return list.filter(({ text }) => patterns.every((pattern) => pattern.test(text)));
}

/** Clauses (with their sentence's line and context) matching every pattern, split into said and negated. */
export function clauseHits(list: readonly Sentence[], ...patterns: readonly RegExp[]) {
  const said: Sentence[] = [];
  const denied: Sentence[] = [];
  for (const sentence of list) {
    for (const clause of clauses(sentence.text)) {
      if (!patterns.every((pattern) => pattern.test(clause))) continue;
      (negated(clause) ? denied : said).push({ ...sentence, text: clause });
    }
  }
  return { said, denied };
}

/** Every clause, with its sentence's line and context. */
export function allClauses(list: readonly Sentence[]): Sentence[] {
  return list.flatMap((sentence) => clauses(sentence.text).map((text) => ({ ...sentence, text })));
}

export type Step = { number: number; text: string; line: number };

/** Numbered steps ("1. …", "2) …", "Step 3: …") in document order. */
export function numberedSteps(text: string): Step[] {
  const steps: Step[] = [];
  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, index) => {
    const match = /^\s*(?:step\s*)?(\d{1,2})\s*[.):]\s+(.+)$/i.exec(raw);
    if (match) steps.push({ number: Number(match[1]), text: match[2].replace(/[*_`]/g, "").trim(), line: index + 1 });
  });
  return steps;
}

/** Index of the first step at or after `from` that matches every pattern, or -1. */
export function stepIndex(steps: readonly Step[], from: number, ...patterns: readonly RegExp[]) {
  for (let index = Math.max(0, from); index < steps.length; index++) if (patterns.every((pattern) => pattern.test(steps[index].text))) return index;
  return -1;
}

export const clockTime = /\b\d{1,2}:\d{2}\b/g;

export function timesIn(value: string) {
  return value.match(clockTime) ?? [];
}

export function countWords(value: string) {
  return value.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
}

/** A parse error for prompts that are empty, placeholder, or too short to carry any instruction. */
export function promptFloor(text: string, file: string, artifact: string, minimum = 20): { error: string; source: TraceSource } | null {
  if (/\bTODO\b/.test(text)) return { error: `${file} still contains a TODO placeholder.`, source: { artifact, line: lineOf(text, /\bTODO\b/) } };
  const words = countWords(text);
  if (words < minimum) return { error: `${file} has ${words} words; a request this short gives Claude nothing to work from (at least ${minimum}).`, source: { artifact, line: 1 } };
  return null;
}

/** 1-based line of the first match, or 1. */
export function lineOf(text: string, pattern: RegExp) {
  const index = text.replace(/\r\n?/g, "\n").split("\n").findIndex((line) => pattern.test(line));
  return index >= 0 ? index + 1 : 1;
}

export function at(artifact: string, sentence?: Sentence | null, fallback = 1): TraceSource {
  return { artifact, line: sentence?.line ?? fallback };
}
