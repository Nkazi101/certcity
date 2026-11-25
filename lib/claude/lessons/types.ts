import type { PracticeItem } from "../items";

/** Inline `code` spans are written with backticks inside text strings. */
export type LessonBlock =
  | { kind: "text"; text: string }
  | { kind: "code"; language: "json" | "bash" | "python" | "typescript" | "markdown" | "yaml" | "text"; caption: string; code: string }
  | { kind: "list"; items: readonly string[] }
  | { kind: "table"; headers: readonly string[]; rows: readonly (readonly string[])[] }
  | { kind: "callout"; tone: "exam" | "pitfall" | "tip"; title: string; text: string };

export type Lesson = {
  /** Objective id in the current guide (Architect Foundations: November; others: December 7). */
  objective: PracticeItem["objective"];
  title: string;
  /** One or two sentences: the decision rule a candidate should leave with. */
  takeaway: string;
  minutes: number;
  blocks: readonly LessonBlock[];
  /** Exact product, API and configuration names taught here, e.g. "tool_choice", ".claude/commands". */
  terms: readonly string[];
  /** Official documentation the lesson was checked against. */
  sources: readonly (readonly [label: string, url: string])[];
};

export type LessonSet = {
  /** Short orientation shown before the first lesson. */
  overview: string;
  lessons: readonly Lesson[];
};
