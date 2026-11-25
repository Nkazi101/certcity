// Small, dependency-free parsers used to grade learner-written artifacts (lifted from lib/claude/capstones/artifacts.ts,
// which re-exports this module). Each parser reports a teaching error instead of throwing.

export type Parsed<T> = { value: T; error?: undefined } | { value: null; error: string };

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** JSON.parse with a learner-facing error message that names the line. */
export function parseJson(input: string | undefined, file: string): Parsed<unknown> {
  const source = (input ?? "").trim();
  if (!source) return { value: null, error: `${file} is empty.` };
  try {
    return { value: JSON.parse(source) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = /position (\d+)/.exec(message);
    const line = position ? source.slice(0, Number(position[1])).split("\n").length : null;
    const hint = /'|’|“|”/.test(source) ? " JSON needs straight double quotes around keys and strings." :
      /,\s*[}\]]/.test(source) ? " JSON does not allow a trailing comma before } or ]." :
      /\/\/|\/\*/.test(source) ? " JSON does not allow comments; remove the // TODO lines." : "";
    return { value: null, error: `${file} is not valid JSON${line ? ` (near line ${line})` : ""}: ${message}.${hint}` };
  }
}

export function parseJsonObject(input: string | undefined, file: string): Parsed<Record<string, unknown>> {
  const parsed = parseJson(input, file);
  if (parsed.error !== undefined) return parsed;
  const object = record(parsed.value);
  return object ? { value: object } : { value: null, error: `${file} must be a JSON object ({ … }) at the top level.` };
}

// ---------------------------------------------------------------------------
// YAML frontmatter (the subset used by SKILL.md, subagents, and .claude/rules)

export type Frontmatter = { present: boolean; data: Record<string, unknown>; body: string; error?: string };

function scalar(raw: string): unknown {
  const value = raw.trim();
  if (!value) return "";
  if (/^\[.*\]$/.test(value)) {
    return value.slice(1, -1).split(",").map((item) => scalar(item)).filter((item) => item !== "");
  }
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value.replace(/\s+#.*$/, "");
}

export function parseFrontmatter(input: string | undefined): Frontmatter {
  const source = (input ?? "").replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  let start = 0;
  while (start < lines.length && !lines[start].trim()) start++;
  if (lines[start]?.trim() !== "---") return { present: false, data: {}, body: source.trim() };
  const end = lines.findIndex((line, index) => index > start && line.trim() === "---");
  if (end < 0) return { present: true, data: {}, body: "", error: "The frontmatter opens with --- but never closes. Add a second --- line after the last field." };
  const data: Record<string, unknown> = {};
  let current: string | null = null;
  for (let index = start + 1; index < end; index++) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\t/.test(line)) return { present: true, data, body: "", error: `Frontmatter line ${index + 1} is indented with a tab. YAML indentation must use spaces.` };
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && current) {
      const existing = data[current];
      data[current] = [...(Array.isArray(existing) ? existing : []), scalar(item[1])];
      continue;
    }
    const nested = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (nested && current) {
      const existing = record(data[current]) ?? {};
      data[current] = { ...existing, [nested[1]]: scalar(nested[2]) };
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) return { present: true, data, body: "", error: `Frontmatter line ${index + 1} is not a "key: value" pair: ${line.trim().slice(0, 60)}` };
    current = pair[1];
    data[current] = pair[2].trim() ? scalar(pair[2]) : [];
  }
  return { present: true, data, body: lines.slice(end + 1).join("\n").trim() };
}

/** Frontmatter lists may be YAML lists or comma/space separated strings. */
export function frontmatterList(value: unknown, separator: RegExp = /,/): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return splitOutsideParens(value, separator);
  return [];
}

export function splitOutsideParens(value: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of value) {
    if (character === "(") depth++;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && separator.test(character)) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ---------------------------------------------------------------------------
// Globs and Claude Code permission rules

export function globRegex(glob: string) {
  let pattern = "";
  for (let index = 0; index < glob.length; index++) {
    const character = glob[index];
    if (character === "*" && glob[index + 1] === "*") {
      const slash = glob[index + 2] === "/";
      pattern += slash ? "(?:.*/)?" : ".*";
      index += slash ? 2 : 1;
    } else if (character === "*") pattern += "[^/]*";
    else if (character === "?") pattern += "[^/]";
    else if (character === "{") {
      const close = glob.indexOf("}", index);
      if (close < 0) pattern += "\\{";
      else {
        pattern += `(?:${glob.slice(index + 1, close).split(",").map((part) => globRegex(part).source.slice(1, -1)).join("|")})`;
        index = close;
      }
    } else pattern += character.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${pattern}$`);
}

/** Matches a project-relative path against a Read/Edit rule specifier, following gitignore-style anchoring. */
export function pathRuleMatches(spec: string, path: string) {
  let pattern = spec.trim();
  if (!pattern || pattern.startsWith("//") || pattern.startsWith("~")) return false;
  if (pattern.startsWith("./")) pattern = pattern.slice(2);
  else if (pattern.startsWith("/")) pattern = pattern.slice(1);
  else if (!pattern.replace(/\/$/, "").includes("/") && !pattern.startsWith("**")) pattern = `**/${pattern}`;
  if (pattern.endsWith("/")) pattern += "**";
  const regex = globRegex(pattern);
  const parts = path.split("/");
  return parts.some((_, index) => regex.test(parts.slice(0, index + 1).join("/")));
}

export function bashRuleMatches(spec: string, command: string) {
  let pattern = spec.trim();
  if (pattern.endsWith(":*")) pattern = `${pattern.slice(0, -2)} *`;
  const optionalTail = pattern.endsWith(" *");
  const body = optionalTail ? pattern.slice(0, -2) : pattern;
  const source = body.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${source}${optionalTail ? "(?: .*)?" : ""}$`).test(command.trim());
}

export type ToolAction =
  | { tool: "Read" | "Edit" | "Write" | "NotebookEdit"; path: string }
  | { tool: "Bash"; command: string }
  | { tool: "WebFetch"; domain: string }
  | { tool: string; path?: undefined; command?: undefined; domain?: undefined };

export function describeAction(action: ToolAction) {
  if ("path" in action && action.path) return `${action.tool}(${action.path})`;
  if ("command" in action && action.command) return `Bash(${action.command})`;
  if ("domain" in action && action.domain) return `WebFetch(${action.domain})`;
  return action.tool;
}

const editTools = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);

export function ruleMatches(rule: string, action: ToolAction) {
  const parsed = /^([A-Za-z0-9_*-]+)(?:\((.*)\))?$/.exec(rule.trim());
  if (!parsed) return false;
  const [, tool, spec] = parsed;
  if (tool.startsWith("mcp__")) {
    if (!action.tool.startsWith("mcp__") || spec !== undefined) return false;
    const regex = new RegExp(`^${tool.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
    return regex.test(action.tool) || action.tool.startsWith(`${tool}__`);
  }
  const sameTool = tool === action.tool || (tool === "Edit" && editTools.has(action.tool));
  if (!sameTool) return false;
  if (spec === undefined || spec === "*" || spec === "**") return true;
  if ("path" in action && action.path) return pathRuleMatches(spec, action.path);
  if ("command" in action && action.command) return bashRuleMatches(spec, action.command);
  if ("domain" in action && action.domain) {
    const domain = spec.replace(/^domain:/, "");
    return domain.startsWith("*.") ? action.domain.endsWith(domain.slice(1)) : action.domain === domain;
  }
  return false;
}

export type Decision = "deny" | "ask" | "allow" | "prompt";

/** Claude Code evaluates deny first, then ask, then allow. Unmatched actions fall back to the permission mode (a prompt by default). */
export function permissionDecision(rules: { allow: string[]; ask: string[]; deny: string[] }, action: ToolAction): Decision {
  if (rules.deny.some((rule) => ruleMatches(rule, action))) return "deny";
  if (rules.ask.some((rule) => ruleMatches(rule, action))) return "ask";
  if (rules.allow.some((rule) => ruleMatches(rule, action))) return "allow";
  return "prompt";
}

export function permissionRules(settings: Record<string, unknown> | null) {
  const permissions = record(settings?.permissions);
  const strings = (value: unknown) => list(value).filter((rule): rule is string => typeof rule === "string");
  return { allow: strings(permissions?.allow), ask: strings(permissions?.ask), deny: strings(permissions?.deny), permissions };
}

/** A hook matcher of letters, digits, _, -, spaces, commas and pipes is an exact list; anything else is an unanchored regex. */
export function hookMatcherMatches(matcher: unknown, tool: string) {
  if (matcher === undefined || matcher === "" || matcher === "*") return true;
  if (typeof matcher !== "string") return false;
  if (/^[A-Za-z0-9_\-|, ]+$/.test(matcher)) return matcher.split(/[|,]/).map((part) => part.trim()).includes(tool);
  try {
    return new RegExp(matcher).test(tool);
  } catch {
    return false;
  }
}

/** Expands ${VAR} and ${VAR:-default} the way Claude Code expands .mcp.json values. */
export function expandEnv(value: string, env: Record<string, string>) {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (whole, name: string, fallback?: string) =>
    Object.hasOwn(env, name) ? env[name] : fallback !== undefined ? fallback : whole);
}

// ---------------------------------------------------------------------------
// Shell commands

/** Tokenizes a shell command. Handles quotes, backslash escapes, line continuations, and pipes. */
export function shellTokens(input: string | undefined): Parsed<string[][]> {
  const source = (input ?? "").replace(/\r\n?/g, "\n").replace(/\\\n/g, " ");
  const segments: string[][] = [[]];
  let token = "";
  let quoted = false;
  let quote: "'" | "\"" | null = null;
  const flush = () => {
    if (token || quoted) segments[segments.length - 1].push(token);
    token = "";
    quoted = false;
  };
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      else token += character;
    } else if (quote === "\"") {
      if (character === "\\" && /["\\$`]/.test(source[index + 1] ?? "")) token += source[++index];
      else if (character === "\"") quote = null;
      else token += character;
    } else if (character === "'" || character === "\"") {
      quote = character;
      quoted = true;
    } else if (character === "\\") token += source[++index] ?? "";
    else if (character === "#" && !token && !quoted) {
      while (index < source.length && source[index] !== "\n") index++;
      flush();
    } else if (/\s/.test(character)) flush();
    else if (character === "|" || character === ";" || character === "&") {
      flush();
      if (source[index + 1] === character) index++;
      segments.push([]);
    } else token += character;
  }
  if (quote) return { value: null, error: `The command has an unclosed ${quote === "'" ? "single" : "double"} quote. Close it so the shell can split the arguments.` };
  flush();
  return { value: segments.filter((segment) => segment.length) };
}

export type ClaudeInvocation = {
  print: boolean;
  prompt: string;
  flags: Map<string, string | true>;
  pipeline: string[][];
};

const valueFlags = new Set(["--output-format", "--json-schema", "--allowedTools", "--allowed-tools", "--disallowedTools",
  "--disallowed-tools", "--permission-mode", "--max-turns", "--model", "--append-system-prompt", "--system-prompt",
  "--tools", "--mcp-config", "--settings", "--input-format", "--max-budget-usd", "--add-dir", "--agents", "--fallback-model"]);

const flagAliases: Record<string, string> = { "--allowed-tools": "--allowedTools", "--disallowed-tools": "--disallowedTools" };

export function parseClaudeCommand(input: string | undefined): Parsed<ClaudeInvocation> {
  const tokens = shellTokens(input);
  if (tokens.error !== undefined) return tokens;
  const pipeline = tokens.value;
  const segment = pipeline.find((parts) => parts[0] === "claude");
  if (!segment) return { value: null, error: "No `claude` command found. The CI step must call the claude CLI directly (for example `claude -p \"…\"`)." };
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  let print = false;
  for (let index = 1; index < segment.length; index++) {
    const token = segment[index];
    const [rawName, inline] = token.startsWith("--") && token.includes("=") ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)] : [token, undefined];
    const name = flagAliases[rawName] ?? rawName;
    if (name === "-p" || name === "--print") print = true;
    else if (valueFlags.has(rawName)) {
      const value = inline ?? segment[++index];
      if (value === undefined) return { value: null, error: `${rawName} needs a value after it.` };
      flags.set(name, value);
    } else if (name.startsWith("-")) flags.set(name, inline ?? true);
    else positional.push(token);
  }
  return { value: { print, prompt: positional.join(" "), flags, pipeline } };
}

// ---------------------------------------------------------------------------
// Markdown

export type MarkdownTable = { headers: string[]; rows: Record<string, string>[] };

function cells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

/** Removes Markdown emphasis and code marks but keeps underscores inside identifiers such as rate_limit_error. */
function plain(cell: string) {
  return cell.replace(/[*`]/g, "").replace(/^_(.*)_$/, "$1").trim();
}

/** Returns every pipe table in a Markdown document. Header names are lowercased. */
export function markdownTables(input: string | undefined): MarkdownTable[] {
  const lines = (input ?? "").replace(/\r\n?/g, "\n").split("\n");
  const tables: MarkdownTable[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim().startsWith("|") || !/^\s*\|?\s*:?-{2,}/.test(lines[index + 1] ?? "")) continue;
    const headers = cells(lines[index]).map((header) => plain(header).toLowerCase());
    const rows: Record<string, string>[] = [];
    index += 2;
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      const values = cells(lines[index]);
      rows.push(Object.fromEntries(headers.map((header, column) => [header, plain(values[column] ?? "")])));
      index++;
    }
    tables.push({ headers, rows });
  }
  return tables;
}

/** Finds the first table whose headers include each of the given words. */
export function findTable(input: string | undefined, required: readonly string[]) {
  return markdownTables(input).find(({ headers }) => required.every((word) => headers.some((header) => header.includes(word))));
}

export function column(row: Record<string, string>, word: string) {
  const key = Object.keys(row).find((header) => header.includes(word));
  return key ? row[key] : "";
}

/** Splits Markdown into sections keyed by lowercased heading text. */
export function markdownSections(input: string | undefined) {
  const sections = new Map<string, string>();
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    if (heading) sections.set(heading, body.join("\n").trim());
  };
  for (const line of (input ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const match = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (match) {
      flush();
      heading = match[1].toLowerCase().replace(/[*_`]/g, "").replace(/^\d+[.)]\s*/, "").trim();
      body = [];
    } else body.push(line);
  }
  flush();
  return sections;
}

export function section(sections: Map<string, string>, word: string) {
  for (const [heading, body] of sections) if (heading.includes(word)) return body;
  return null;
}

/** True when the text still contains skeleton placeholders. */
export function hasTodo(value: string | undefined) {
  return /\bTODO\b/.test(value ?? "");
}

// ---------------------------------------------------------------------------
// JSON Schema (the subset used by tool input_schema and structured outputs)

export function validateSchema(schema: unknown, value: unknown, path = "$", root: unknown = schema): string[] {
  const node = record(schema);
  if (!node) return [];
  if (typeof node.$ref === "string") {
    const target = node.$ref.replace(/^#\//, "").split("/").reduce<unknown>((object, key) => record(object)?.[key], root);
    return validateSchema(target, value, path, root);
  }
  const errors: string[] = [];
  if (Array.isArray(node.anyOf)) {
    return node.anyOf.some((option) => !validateSchema(option, value, path, root).length) ? [] : [`${path} matches none of the anyOf options`];
  }
  const types = Array.isArray(node.type) ? node.type : node.type === undefined ? [] : [node.type];
  const actual = value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "number" && Number.isInteger(value) ? "integer" : typeof value;
  if (types.length && !types.some((type) => type === actual || (type === "number" && actual === "integer"))) {
    return [`${path} should be ${types.join(" or ")} but is ${actual}`];
  }
  if (Array.isArray(node.enum) && !node.enum.some((option) => option === value)) errors.push(`${path} is ${JSON.stringify(value)}, which is not in the enum`);
  if (node.const !== undefined && node.const !== value) errors.push(`${path} must be ${JSON.stringify(node.const)}`);
  if (typeof value === "string" && typeof node.pattern === "string") {
    try {
      if (!new RegExp(node.pattern).test(value)) errors.push(`${path} does not match pattern ${node.pattern}`);
    } catch {
      errors.push(`${path} has an invalid pattern`);
    }
  }
  if (typeof value === "string" && node.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push(`${path} is not a date`);
  const object = record(value);
  if (object) {
    const properties = record(node.properties) ?? {};
    for (const key of list(node.required)) {
      if (typeof key === "string" && !Object.hasOwn(object, key)) errors.push(`${path}.${key} is required but missing`);
    }
    for (const [key, child] of Object.entries(object)) {
      if (Object.hasOwn(properties, key)) errors.push(...validateSchema(properties[key], child, `${path}.${key}`, root));
      else if (node.additionalProperties === false) errors.push(`${path}.${key} is not an allowed property`);
    }
  }
  if (Array.isArray(value)) {
    if (typeof node.minItems === "number" && value.length < node.minItems) errors.push(`${path} needs at least ${node.minItems} item(s)`);
    value.forEach((item, index) => errors.push(...validateSchema(node.items, item, `${path}[${index}]`, root)));
  }
  return errors;
}

/** Lists every object node in a schema that lacks additionalProperties: false. */
export function openObjects(schema: unknown, path = "schema"): string[] {
  const node = record(schema);
  if (!node) return [];
  const found: string[] = [];
  const isObject = node.type === "object" || (Array.isArray(node.type) && node.type.includes("object")) || record(node.properties);
  if (isObject && node.additionalProperties !== false) found.push(path);
  for (const [key, child] of Object.entries(record(node.properties) ?? {})) found.push(...openObjects(child, `${path}.properties.${key}`));
  if (node.items) found.push(...openObjects(node.items, `${path}.items`));
  for (const [key, child] of Object.entries(record(node.$defs) ?? {})) found.push(...openObjects(child, `${path}.$defs.${key}`));
  for (const [index, child] of list(node.anyOf).entries()) found.push(...openObjects(child, `${path}.anyOf[${index}]`));
  return found;
}

/** Finds JSON Schema keywords anywhere in a schema. */
export function schemaKeywords(schema: unknown, keywords: readonly string[]): string[] {
  const found = new Set<string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    const node = record(value);
    if (!node) return;
    for (const [key, child] of Object.entries(node)) {
      if (keywords.includes(key) && key !== "properties") found.add(key);
      if (key === "properties") Object.values(record(child) ?? {}).forEach(visit);
      else visit(child);
    }
  };
  visit(schema);
  return [...found];
}

export function mentions(value: string | undefined, pattern: RegExp) {
  return pattern.test(value ?? "");
}

export function countWords(value: string | undefined) {
  return (value ?? "").trim().split(/\s+/).filter(Boolean).length;
}
