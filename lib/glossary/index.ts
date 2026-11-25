import { claudeGlossary } from "./claude";
import type { Glossary, GlossaryEntry, GlossaryPattern } from "./types";

export type { Glossary, GlossaryEntry, GlossaryPattern } from "./types";

/** Glossaries by provider id (see lib/certifications/providers.ts). New providers add theirs here. */
const glossaries: Record<string, Glossary> = { anthropic: claudeGlossary };

export function glossaryFor(provider = "anthropic"): Glossary | undefined {
  return glossaries[provider];
}

/** A term found in text, ready to render with its definition. */
export type FoundTerm = { id: string; term: string; plain: string; example?: string; text: string; /** Where the text comes from when it isn't a glossary definition. */ note?: string };
export type GlossSegment = string | FoundTerm;

const codeLike = /[_./<>$:-]|[a-z][A-Z]/;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Compiled = {
  pattern: RegExp;
  /** Lower-cased form → candidates; the exact spelling decides case-sensitive ones. */
  forms: Map<string, { entry: GlossaryEntry; form: string; exact: boolean }[]>;
  patterns: readonly GlossaryPattern[];
};

const compiled = new Map<string, Compiled>();

function compile(glossary: Glossary): Compiled {
  const cached = compiled.get(glossary.provider);
  if (cached) return cached;
  const forms = new Map<string, { entry: GlossaryEntry; form: string; exact: boolean }[]>();
  const sources: string[] = [];
  for (const entry of glossary.entries) {
    for (const form of entry.forms) {
      const key = form.toLowerCase();
      const exact = !!entry.caseSensitive || codeLike.test(form) || /^[A-Z0-9]{2,}s?$/.test(form);
      forms.set(key, [...forms.get(key) ?? [], { entry, form, exact }]);
      // Whole-word edges only where the form itself starts or ends with a word character.
      sources.push(`${/^\w/.test(form) ? "(?<![\\w-])" : ""}${escape(form)}${/\w$/.test(form) ? "(?![\\w])" : ""}`);
    }
  }
  for (const { pattern } of glossary.patterns) sources.push(`(?<![\\w])${pattern.source}`);
  // Longest alternatives first so "MCP connector" wins over "connector" and "tool_use_id" over "tool_use".
  sources.sort((a, b) => b.length - a.length);
  const result = { pattern: new RegExp(sources.join("|"), "gi"), forms, patterns: glossary.patterns };
  compiled.set(glossary.provider, result);
  return result;
}

function resolve(glossary: Compiled, text: string): FoundTerm | null {
  for (const candidate of glossary.forms.get(text.toLowerCase()) ?? []) {
    if (candidate.exact && candidate.form !== text) continue;
    const { entry } = candidate;
    return { id: entry.id, term: entry.term, plain: entry.plain, example: entry.example, text };
  }
  for (const entry of glossary.patterns) {
    const match = text.match(new RegExp(`^(?:${entry.pattern.source})$`));
    if (match) return { id: entry.id, term: entry.term, plain: entry.plain(match), text };
  }
  return null;
}

/**
 * Splits text into plain strings and defined terms. Each term is marked once per call (its first appearance), so a
 * paragraph that repeats `tool_use` five times shows one definition, not five.
 */
export function glossText(text: string, provider = "anthropic", seen: Set<string> = new Set()): GlossSegment[] {
  const glossary = glossaryFor(provider);
  if (!glossary || !text) return [text];
  const compiledGlossary = compile(glossary);
  const segments: GlossSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(compiledGlossary.pattern)) {
    const found = resolve(compiledGlossary, match[0]);
    if (!found || seen.has(found.id)) continue;
    seen.add(found.id);
    if (match.index > last) segments.push(text.slice(last, match.index));
    segments.push(found);
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return segments;
}

/** Looks up a single term by exact text, for places that label one term on purpose (lesson term lists, parcel fields). */
export function defineTerm(text: string, provider = "anthropic"): FoundTerm | null {
  const glossary = glossaryFor(provider);
  return glossary ? resolve(compile(glossary), text) : null;
}
