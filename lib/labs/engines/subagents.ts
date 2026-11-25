// Coordinator → subagent replay. The learner writes one subagent definition (.claude/agents/<name>.md: frontmatter name,
// description, tools; the body is the worker's system prompt and its return format) and the coordinator's next turn: the
// Agent tool calls ({ subagent_type, description, prompt }) it makes, all in one turn so they run in parallel.
//
// Faithful to Claude Code: a subagent sees only its definition and the prompt string (never the coordinator's
// conversation); a definition without `tools` inherits every tool of the main thread, MCP tools included. The worker's
// behaviour is a documented proxy: it searches the wards named in its context, filters by a year range only if one is
// stated, cites the accession only if it is given one, and returns exactly the fields of the first ```json block in its
// definition (prose if there is none). The coordinator's brief to the editor is assembled from what came back.
import { frontmatterList, list, parseFrontmatter, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type Sheet = { sheet: string; year: number };
export type ArchiveInput = {
  wards: readonly string[];
  range: { from: number; to: number };
  accession: string;
  /** Map wards already verified in the first round, and every ward the register already covered. */
  verifiedMaps: readonly string[];
  registerComplete: boolean;
  /** What the map server does for each ward this round. */
  mapServer: Readonly<Record<string, { status: "ok"; sheets: readonly Sheet[] } | { status: "timeout" }>>;
  /** Fixed definitions already in the repo, by name. */
  definitions: Readonly<Record<string, string>>;
  tools: { mapSearch: string; register: readonly string[]; all: readonly string[] };
};

type Definition = { name: string; tools: string[] | null; body: string; source: TraceSource; contract: Contract | null };
type Contract = { rows: { accession: boolean; sheet: boolean; year: boolean } | null; gaps: { type: boolean; attempts: boolean } | null };
export type WardStatus =
  | { ward: string; state: "verified"; round: 1 | 2; sheets: readonly (Sheet & { cited: boolean; inRange: boolean })[] }
  | { ward: string; state: "empty" }
  | { ward: string; state: "unchecked"; detail: string | null; actionable: boolean }
  | { ward: string; state: "false-empty" }
  | { ward: string; state: "not-searched" };
export type CallReport = {
  index: number; type: string; wards: readonly string[]; source: TraceSource;
  error?: string; canMaps: boolean; usedRegister: boolean; repeats: readonly string[];
  missing: readonly ("range" | "accession" | "wards")[]; prose: boolean; uncitable: boolean;
};
export type ArchiveOut = { calls: readonly CallReport[]; brief: readonly WardStatus[]; sources: { dispatch: TraceSource; agent: TraceSource } };

type Parsed = { json: LocatedJson; calls: unknown[]; agent: Definition };

function contractOf(body: string): Contract | null {
  const block = /```json\s*\n([\s\S]*?)```/.exec(body)?.[1];
  if (!block) return null;
  let value: unknown;
  try {
    value = JSON.parse(block);
  } catch {
    return null;
  }
  const object = record(value);
  if (!object) return null;
  const keyMatch = (keys: string[], pattern: RegExp) => keys.some((key) => pattern.test(key));
  const arrays = Object.entries(object).filter(([, item]) => Array.isArray(item)).map(([key, item]) => ({ key, item: record(list(item)[0]) }));
  const gapEntry = arrays.find(({ key }) => /unchecked|not_?checked|not_?covered|uncovered|gaps?|missing|fail|error/i.test(key));
  const rowEntry = arrays.find((entry) => entry !== gapEntry && entry.item);
  const rowKeys = Object.keys(rowEntry?.item ?? {});
  const gapKeys = Object.keys(gapEntry?.item ?? {});
  return {
    rows: rowEntry ? { accession: keyMatch(rowKeys, /accession/i), sheet: keyMatch(rowKeys, /sheet/i), year: keyMatch(rowKeys, /year|date/i) } : null,
    gaps: gapEntry ? { type: keyMatch(gapKeys, /error|type|reason|cause/i), attempts: keyMatch(gapKeys, /attempt|retr/i) } : null,
  };
}

export function parseDefinition(source: string, artifact: string): Definition | { error: string } {
  const front = parseFrontmatter(source);
  if (!front.present) return { error: `${artifact} needs YAML frontmatter between --- lines (name, description, tools).` };
  if (front.error) return { error: front.error };
  const name = text(front.data.name).trim();
  if (!name) return { error: `${artifact}: the frontmatter needs a name.` };
  const tools = Object.hasOwn(front.data, "tools") ? frontmatterList(front.data.tools, /[,\s]/) : null;
  const toolsLine = source.split("\n").findIndex((line) => /^tools\s*:/.test(line));
  return { name, tools, body: front.body, source: { artifact, line: toolsLine < 0 ? 1 : toolsLine + 1 }, contract: contractOf(front.body) };
}

export const subagentEngine: Engine<Parsed, ArchiveInput, ArchiveOut> = {
  id: "claude-code.subagent-dispatch",
  provider: "anthropic",
  label: "Agent tool dispatch (exact context and tool inheritance) · simulated workers that follow their briefs",
  simulated: true,
  parse(files) {
    const parsed = parseLocatedJson(files.dispatch, "dispatch.json");
    if (parsed.error !== undefined) return { ok: false, error: parsed.error, source: { artifact: "dispatch" } };
    if (!Array.isArray(parsed.value.value)) return { ok: false, error: "dispatch.json must be a JSON array of Agent tool inputs: [{ \"subagent_type\": …, \"description\": …, \"prompt\": … }].", source: { artifact: "dispatch", line: 1 } };
    const agent = parseDefinition(files.agent ?? "", "agent");
    if ("error" in agent) return { ok: false, error: `.claude/agents/map-search.md: ${agent.error}`, source: { artifact: "agent", line: 1 } };
    return { ok: true, value: { json: parsed.value, calls: parsed.value.value, agent } };
  },
  run({ json, calls, agent }, fixture: Fixture<ArchiveInput>): EngineRun<ArchiveOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const at = (path: string): TraceSource => ({ artifact: "dispatch", pointer: path, line: lineOf(json, path) });
    const definitions = new Map<string, Definition>();
    for (const [name, source] of Object.entries(input.definitions)) {
      const parsed = parseDefinition(source, `.claude/agents/${name}.md`);
      if (!("error" in parsed)) definitions.set(parsed.name, parsed);
    }
    definitions.set(agent.name, agent);
    const sources = { dispatch: at(""), agent: agent.source };
    const named = (value: string) => {
      const all = /\b(every|all)\s+(the\s+)?wards?\b/i.test(value);
      return input.wards.filter((ward) => all || new RegExp(`\\b${ward}\\b`, "i").test(value));
    };
    push({ actor: "learner-artifact", kind: "request", label: `Coordinator turn · ${calls.length} Agent call${calls.length === 1 ? "" : "s"} (run in parallel)`, source: sources.dispatch });

    const searched = new Map<string, { attempts: number; contract: Contract | null; prose: boolean; context: { range: { from: number; to: number } | null; accession: string | null } }>();
    const reports: CallReport[] = calls.map((raw, index) => {
      const call = record(raw) ?? {};
      const type = text(call.subagent_type);
      const prompt = text(call.prompt);
      const source = at(pointer(index));
      const base = { index, type, source, wards: [] as string[], canMaps: false, usedRegister: false, repeats: [] as string[], missing: [] as CallReport["missing"][number][], prose: false, uncitable: false };
      if (!prompt || !text(call.description)) {
        const error = `Agent call ${index + 1}: ${!prompt ? "prompt" : "description"} is required.`;
        push({ actor: "service", kind: "error", label: error, source, tone: "bad" });
        return { ...base, error };
      }
      const definition = type === "general-purpose" ? { name: "general-purpose", tools: null, body: "", source, contract: null } : definitions.get(type);
      if (!definition) {
        const error = `Agent type '${type || "(empty)"}' not found. Available agents: general-purpose, ${[...definitions.keys()].join(", ")}.`;
        push({ actor: "service", kind: "error", label: error, source, tone: "bad" });
        return { ...base, error };
      }
      const tools = definition.tools ?? input.tools.all;
      const matches = (tool: string) => tools.some((entry) => entry === tool || (entry.endsWith("*") && tool.startsWith(entry.slice(0, -1))));
      const canMaps = matches(input.tools.mapSearch);
      const hasRegister = input.tools.register.some(matches);
      const context = `${definition.body}\n${prompt}`;
      const wards = named(prompt).length ? named(prompt) : named(definition.body);
      const years = /\b(1[6-9]\d\d|20\d\d)\s*(?:–|—|-|to|through|until)\s*(1[6-9]\d\d|20\d\d)\b/.exec(context);
      const range = years ? { from: Number(years[1]), to: Number(years[2]) } : null;
      const accession = /\bMAP-\d+\b/.exec(context)?.[0] ?? null;
      const isRegister = definition.name === "register-search";
      push({ actor: "model", kind: "tool_call", source, label: `Agent → ${definition.name} · ${text(call.description)}`,
        detail: `Context the worker receives: its definition plus this prompt. Tools: ${definition.tools ? definition.tools.join(", ") || "none" : "not set, so it inherits every tool of the main thread"}.` });
      const missing: CallReport["missing"][number][] = [];
      if (!wards.length) {
        missing.push("wards");
        push({ actor: "tool", kind: "response", label: `${definition.name} returns: “Which wards should I search? My task does not name any.”`, source, tone: "bad" });
        return { ...base, wards, canMaps, missing };
      }
      if (isRegister) {
        const repeats = input.registerComplete ? wards : [];
        push({ actor: "tool", kind: "tool_result", label: `${definition.name} searched the register for ${wards.join(", ")}`, source,
          detail: repeats.length ? "Same entries as the first round; the register search was already complete." : "Register entries returned.", tone: repeats.length ? "warn" : undefined });
        return { ...base, wards, canMaps, usedRegister: false, repeats, missing };
      }
      let usedRegister = false;
      if (hasRegister) {
        usedRegister = true;
        push({ actor: "tool", kind: "tool_call", source: definition.source, tone: "bad",
          label: `${definition.name} → ${input.tools.register[0]} (cross-checking street names)`, detail: "The worker had register tools, so it read the register’s closed rolls." });
      }
      if (!canMaps) {
        push({ actor: "tool", kind: "response", label: `${definition.name} has no map search tool; no map sheets searched for ${wards.join(", ")}`, source: definition.source, tone: "bad" });
        return { ...base, wards, canMaps, usedRegister, missing };
      }
      if (!range) missing.push("range");
      if (!accession || accession !== input.accession) missing.push("accession");
      const repeats = wards.filter((ward) => input.verifiedMaps.includes(ward));
      const retries = /\bretr(y|ies)\b/i.test(definition.body) ? 2 : 1;
      const contract = definition.contract;
      const uncitable = !contract?.rows || !contract.rows.accession || !contract.rows.sheet || !contract.rows.year;
      for (const ward of wards) {
        const server = input.mapServer[ward];
        if (!server || input.verifiedMaps.includes(ward)) {
          push({ actor: "tool", kind: "tool_result", label: `${ward} · searched again`, detail: "Same sheets as the first round.", tone: "warn" });
          continue;
        }
        searched.set(ward, { attempts: retries, contract, prose: !contract, context: { range, accession } });
        if (server.status === "timeout") {
          push({ actor: "service", kind: "error", label: `${ward} · map server timed out${retries > 1 ? " twice" : ""}`, tone: "warn" });
          continue;
        }
        const kept = server.sheets.filter(({ year }) => !range || (year >= range.from && year <= range.to));
        push({ actor: "tool", kind: "tool_result", label: `${ward} · ${kept.length} sheet${kept.length === 1 ? "" : "s"}${range ? ` dated ${range.from}–${range.to}` : " (no date range given, so every year)"}`,
          detail: kept.map(({ sheet, year }) => `${sheet} (${year})`).join(", ") || "None." });
      }
      push({ actor: "tool", kind: "response", source: definition.source, label: `${definition.name} returns ${contract ? `JSON with ${[contract.rows && "results", contract.gaps && "an unchecked list"].filter(Boolean).join(" and ") || "no usable fields"}` : "a prose summary"}`,
        detail: contract ? `Fields per sheet: ${contract.rows ? Object.entries(contract.rows).filter(([, has]) => has).map(([key]) => key).join(", ") || "none" : "none"}${accession ? ` · filed under ${accession}` : " · no accession given"}.` : "“Found the sheets for most wards. Some could not be searched.”",
        tone: contract?.gaps ? undefined : "warn" });
      return { ...base, wards, canMaps, usedRegister, repeats, missing, prose: !contract, uncitable };
    });

    // --- the coordinator's brief to the editor ---
    const brief: WardStatus[] = input.wards.map((ward) => {
      if (input.verifiedMaps.includes(ward)) return { ward, state: "verified", round: 1, sheets: [] };
      const result = searched.get(ward);
      const server = input.mapServer[ward];
      if (!result || !server) return { ward, state: "not-searched" };
      if (server.status === "timeout") {
        if (!result.contract?.gaps) return { ward, state: "false-empty" };
        const { type, attempts } = result.contract.gaps;
        const detail = [type && "map server timeout", attempts && `${result.attempts} attempt${result.attempts === 1 ? "" : "s"}`].filter(Boolean).join(", ") || null;
        return { ward, state: "unchecked", detail, actionable: type && attempts };
      }
      const range = result.context.range;
      const cited = !!result.contract?.rows?.accession && !!result.contract.rows.sheet && !!result.contract.rows.year && result.context.accession === input.accession;
      const sheets = server.sheets.filter(({ year }) => !range || (year >= range.from && year <= range.to))
        .map((sheet) => ({ ...sheet, cited, inRange: sheet.year >= input.range.from && sheet.year <= input.range.to }));
      return sheets.length ? { ward, state: "verified", round: 2, sheets } : { ward, state: "empty" };
    });
    for (const status of brief) {
      const line = status.state === "verified" ? status.round === 1 ? "verified in the first round" : status.sheets.map(({ sheet, year, cited }) => `${sheet} (${year})${cited ? ` · ${input.accession}` : " · no citation"}`).join(", ")
        : status.state === "empty" ? `searched ${input.range.from}–${input.range.to}: no sheets`
          : status.state === "unchecked" ? `NOT CHECKED${status.detail ? ` (${status.detail})` : ""}`
            : status.state === "false-empty" ? "no matching map sheets" : "not searched";
      const bad = status.state === "false-empty" || status.state === "not-searched" || (status.state === "verified" && status.sheets.some(({ cited, inRange }) => !cited || !inRange));
      push({ actor: "person", kind: "output", label: `Editor’s brief · ${status.ward}: ${line}`, tone: bad ? "bad" : status.state === "unchecked" && !status.actionable ? "warn" : undefined });
    }
    return { trace, out: { calls: reports, brief, sources }, metrics: {
      unsearched: brief.filter(({ state }) => state === "not-searched" || state === "false-empty" || state === "unchecked").length,
    } };
  },
};
