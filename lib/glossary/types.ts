/**
 * A term a learner may meet while working a case. Definitions are plain language: a person who has never used the
 * product should be able to act on the case after reading one. Each provider (Anthropic today; Microsoft, AWS and
 * Google later) ships its own list.
 */
export type GlossaryEntry = {
  id: string;
  /** How the term is shown at the top of its definition. */
  term: string;
  /**
   * The exact spellings to detect in assignment text. Code-like forms (with `_`, `.`, `/`, `-`, `<`, `$`, `:` or an
   * inner capital, such as `tool_use` or `PreToolUse`) match case-sensitively. Ordinary words match whole words, any case.
   */
  forms: readonly string[];
  /** Match ordinary-word forms with their exact capitals too, for names like `Skills` or `Projects` that are also plain words. */
  caseSensitive?: boolean;
  /** One or two plain sentences, at most 45 words. Avoid other jargon, or use only terms that are themselves defined. */
  plain: string;
  /** Optional concrete example, at most 25 words. */
  example?: string;
  /** Lesson terms (from each lesson's "Terms to recognize" list) that this entry explains, for linking the lesson. */
  lessonTerms?: readonly string[];
};

/** A pattern-based entry, for families of names such as MCP tool names (`mcp__calendar__hold_slot`). */
export type GlossaryPattern = {
  id: string;
  term: string;
  pattern: RegExp;
  /** Builds the definition from the matched text. */
  plain: (match: RegExpMatchArray) => string;
  lessonTerms?: readonly string[];
};

export type Glossary = {
  provider: string;
  entries: readonly GlossaryEntry[];
  patterns: readonly GlossaryPattern[];
};
