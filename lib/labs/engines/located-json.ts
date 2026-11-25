// JSON.parse plus a map from JSON pointer ("/messages/2/content/0") to the 1-based line where that value starts,
// so traces and checks can point at the exact place in the learner's file.
import { parseJson } from "./parse";

export type LocatedJson = { value: unknown; lines: ReadonlyMap<string, number> };

export function pointer(...path: readonly (string | number)[]) {
  return path.map((part) => "/" + String(part).replace(/~/g, "~0").replace(/\//g, "~1")).join("");
}

/** Line of the deepest located ancestor of a pointer (falls back to line 1). */
export function lineOf(located: LocatedJson | null | undefined, at: string) {
  if (!located) return undefined;
  let probe = at;
  for (;;) {
    const line = located.lines.get(probe);
    if (line !== undefined) return line;
    if (!probe) return 1;
    probe = probe.slice(0, probe.lastIndexOf("/"));
  }
}

/** Parses JSON and records where each value begins. Returns the same teaching error as parseJson on invalid input. */
export function parseLocatedJson(input: string | undefined, file: string): { value: LocatedJson; error?: undefined } | { value: null; error: string } {
  const parsed = parseJson(input, file);
  if (parsed.error !== undefined) return parsed;
  const source = input ?? "";
  const lines = new Map<string, number>();
  let index = 0;
  let line = 1;
  const advance = () => {
    if (source[index] === "\n") line++;
    index++;
  };
  const space = () => {
    while (index < source.length && /\s/.test(source[index])) advance();
  };
  const string = () => {
    let out = "";
    advance(); // opening quote
    while (index < source.length && source[index] !== "\"") {
      if (source[index] === "\\") {
        out += source[index] + source[index + 1];
        advance();
      } else out += source[index];
      advance();
    }
    advance(); // closing quote
    return JSON.parse(`"${out}"`) as string;
  };
  const value = (at: string): void => {
    space();
    lines.set(at, line);
    const character = source[index];
    if (character === "{") {
      advance();
      space();
      if (source[index] === "}") return advance();
      for (;;) {
        space();
        const key = string();
        space();
        advance(); // colon
        value(`${at}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`);
        space();
        if (source[index] === ",") advance();
        else return advance();
      }
    }
    if (character === "[") {
      advance();
      space();
      if (source[index] === "]") return advance();
      for (let item = 0; ; item++) {
        value(`${at}/${item}`);
        space();
        if (source[index] === ",") advance();
        else return advance();
      }
    }
    if (character === "\"") {
      string();
      return;
    }
    while (index < source.length && !/[\s,\]}]/.test(source[index])) advance();
  };
  try {
    value("");
  } catch {
    // Positions are a convenience; the parsed value is still valid.
  }
  return { value: { value: parsed.value, lines } };
}
