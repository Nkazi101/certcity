// Agent loop at a reference desk: the learner's next Messages API request after stop_reason "tool_use" (validated the way
// the API validates it), the tool definitions in that request (which decide, through a simulated tool choice, which tool
// Claude reaches for), and the exhibit panel's source table (audited against the attendance records).
//
// Protocol validation is exact. Tool choice is a documented proxy: Claude reads tool names and descriptions; a tool is a
// candidate for a request when its name or description claims that kind of action (look up / create) and no sentence of
// its description rules it out ("never creates…", "do not use it to look up…", or a sentence that refers the job to another
// tool). With several candidates, the recorded model takes the one whose name, then description, shares the request's
// subject word (the misrouting the descriptions are meant to prevent).
import { findTable, list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type Intent = "lookup" | "create";
export type DeskRequest = { ask: string; intent: Intent; subject: string };
export type MethodKind = "count" | "estimate" | "report";
export type PanelRecord = { id: string; title: string; line: string; figure: number; kind: MethodKind; note: string };

export type LoopInput = {
  caseId: string;
  pending: { text: string; call: { id: string; name: string; input: Readonly<Record<string, string>> } };
  /** What running the pending call returned. */
  output: string;
  /** Text Claude needs from that output to take its next step (the record it must look up next). */
  lead: string;
  /** The step Claude takes once it has the result: a lookup of the lead. */
  next: { ask: string; subject: string; readOutput: string; createOutput: string; answer: string };
  /** The requests the desk handles, replayed against the offered tool definitions. */
  requests: readonly DeskRequest[];
  /** Which tool names the catalog connector implements, by effect. */
  implementations: { read: readonly string[]; create: readonly string[] };
  panel: { lines: readonly { key: string; title: string }[]; records: readonly PanelRecord[] };
};

type Routing = { request: DeskRequest; candidates: string[]; chosen: string | null; effect: "read" | "create" | "unknown" | null; source: TraceSource };
export type AuditRow = { index: number; line: string | null; cell: { line: string; figure: string; method: string; source: string };
  record: PanelRecord | null; ambiguous: boolean; figureOk: boolean; lineOk: boolean; methodKinds: MethodKind[]; source: TraceSource };

export type LoopOut = {
  accepted: boolean;
  error?: { message: string; source: TraceSource };
  continued: boolean;
  result: { state: "carried" | "flagged" | "empty" | "missing-lead"; content: string; source: TraceSource } | null;
  next: Routing | null;
  routings: readonly Routing[];
  reply: string;
  rows: readonly AuditRow[];
  dropped: readonly PanelRecord[];
  sources: { request: TraceSource; tools: TraceSource; label: TraceSource };
};

type Parsed = { json: LocatedJson; request: Record<string, unknown>; table: { headers: string[]; rows: Record<string, string>[] }; tableLine: number };

const verbs: Record<Intent, RegExp> = {
  lookup: /\b(search(es|ing)?|find(s|ing)?|look(s|ing)?[\s-]+up|lookups?|retriev\w*|read(s|ing)?|fetch(es|ing)?|gets?)\b/i,
  create: /\b(creat\w*|adds?|adding|open(s|ing)?\s+(a\s+)?(new\s+)?draft|insert\w*|writes?)\b/i,
};
const negation = /\b(not|never|no|don't|doesn't|cannot|can't|without)\b/i;
const kinds: Record<MethodKind, RegExp> = {
  count: /\b(count\w*|scan\w*|tall(y|ied|ies)|turnstile\w*|clicker)\b/i,
  estimate: /\b(estimat\w*|forecast\w*|projection|projected|planning)\b/i,
  report: /\b(report\w*|press|newspaper|gazette|article)\b/i,
};

/** Which actions a tool claims, from its name and description. Exclusions win over claims. */
export function toolClaims(name: string, description: string, others: readonly string[]) {
  const claimed = new Set<Intent>();
  const excluded = new Set<Intent>();
  const scan = (value: string, into: Set<Intent>) => (Object.keys(verbs) as Intent[]).forEach((intent) => verbs[intent].test(value) && into.add(intent));
  scan(name.replace(/[_-]+/g, " "), claimed);
  for (const sentence of description.split(/(?<=[.;!?])\s+|\n+/)) {
    if (others.some((other) => other && sentence.includes(other))) {
      scan(sentence, excluded);
      continue;
    }
    const at = sentence.search(negation);
    if (at < 0) scan(sentence, claimed);
    else {
      scan(sentence.slice(0, at), claimed);
      scan(sentence.slice(at), excluded);
    }
  }
  return new Set([...claimed].filter((intent) => !excluded.has(intent)));
}

function blockText(content: unknown): string {
  if (typeof content === "string") return content;
  return list(content).map((block) => text(record(block)?.text)).join("\n");
}

const file = "request";

export const agentLoopEngine: Engine<Parsed, LoopInput, LoopOut> = {
  id: "anthropic.agent-loop-desk",
  provider: "anthropic",
  label: "Messages API validator (exact) · simulated tool choice from your tool descriptions · panel source audit",
  simulated: true,
  parse(files) {
    const parsed = parseLocatedJson(files[file], "request.json");
    if (parsed.error !== undefined) return { ok: false, error: parsed.error, source: { artifact: file } };
    const request = record(parsed.value.value);
    if (!request) return { ok: false, error: "request.json must be a JSON object: the body of POST /v1/messages.", source: { artifact: file, line: 1 } };
    const table = findTable(files.label, ["line", "figure", "method", "source"]);
    if (!table) return { ok: false, error: "label.md needs a Markdown table with the columns Line, Figure, Method and Source: the panel printer reads that table.", source: { artifact: "label", line: 1 } };
    const tableLine = Math.max(1, (files.label ?? "").split("\n").findIndex((line) => /\|\s*line\s*\|/i.test(line)) + 1);
    return { ok: true, value: { json: parsed.value, request, table, tableLine } };
  },
  run({ json, request, table, tableLine }, fixture: Fixture<LoopInput>): EngineRun<LoopOut> {
    const input = fixture.input;
    const at = (path: string): TraceSource => ({ artifact: file, pointer: path, line: lineOf(json, path) });
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const messages = list(request.messages);
    const tools = list(request.tools).map((tool, index) => ({ index, name: text(record(tool)?.name), description: text(record(tool)?.description), raw: record(tool) }));
    const names = tools.map(({ name }) => name).filter(Boolean);
    const sources = { request: at(""), tools: at(request.tools ? "/tools" : ""), label: { artifact: "label", line: tableLine } };

    // --- simulated tool choice for each desk request (independent of whether the API accepts the follow-up) ---
    const effectOf = (name: string) => input.implementations.read.includes(name) ? "read" as const : input.implementations.create.includes(name) ? "create" as const : "unknown" as const;
    const route = (request: DeskRequest): Routing => {
      const candidates = tools.filter(({ name, description }) => toolClaims(name, description, names.filter((other) => other !== name)).has(request.intent));
      const named = candidates.filter(({ name }) => name.toLowerCase().includes(request.subject));
      const described = candidates.filter(({ description }) => description.toLowerCase().includes(request.subject));
      const chosen = (named.length ? named : described.length ? described : candidates)[0];
      return { request, candidates: candidates.map(({ name }) => name), chosen: chosen?.name ?? null, effect: chosen ? effectOf(chosen.name) : null,
        source: chosen ? at(pointer("tools", chosen.index, "description")) : sources.tools };
    };
    const routings = input.requests.map(route);
    push({ actor: "learner-artifact", kind: "request", label: `Tool definitions offered: ${names.join(", ") || "none"}`, source: sources.tools });
    for (const routing of routings) {
      const effect = routing.effect === "create" ? "creates a draft exhibit entry" : routing.effect === "read" ? "read-only lookup" : routing.effect === "unknown" ? "not served by the catalog connector" : "";
      push({ actor: "model", kind: "decision", source: routing.source,
        label: `Desk request “${routing.request.ask}” → ${routing.chosen ?? "no tool"}`,
        detail: routing.chosen ? `${routing.candidates.length > 1 ? `Candidates from the descriptions: ${routing.candidates.join(", ")}. ` : ""}${routing.chosen}: ${effect}.` : "No offered tool describes this kind of action, so Claude answers in text.",
        tone: routing.effect === (routing.request.intent === "lookup" ? "read" : "create") ? "ok" : "bad" });
    }

    // --- panel source audit (the label is printed whatever the API does) ---
    const rows: AuditRow[] = table.rows.map((row, index) => {
      const cell = { line: row[Object.keys(row).find((key) => key.includes("line"))!] ?? "", figure: row[Object.keys(row).find((key) => key.includes("figure"))!] ?? "",
        method: row[Object.keys(row).find((key) => key.includes("method"))!] ?? "", source: row[Object.keys(row).find((key) => key.includes("source"))!] ?? "" };
      const line = input.panel.lines.find(({ key }) => cell.line.toLowerCase().includes(key))?.key ?? null;
      const cited = input.panel.records.filter(({ title }) => cell.source.toLowerCase().includes(title.toLowerCase()));
      const figure = Number((/\d[\d,]*/.exec(cell.figure)?.[0] ?? "").replace(/,/g, ""));
      const entry = cited.length === 1 ? cited[0] : null;
      const methodKinds = (Object.keys(kinds) as MethodKind[]).filter((kind) => kinds[kind].test(cell.method));
      return { index, line, cell, record: entry, ambiguous: cited.length > 1, figureOk: !!entry && figure === entry.figure, lineOk: !!entry && entry.line === line,
        methodKinds, source: { artifact: "label", line: tableLine + 2 + index } };
    });
    const dropped = input.panel.records.filter((entry) => !rows.some((row) => row.record === entry && row.figureOk && row.lineOk));
    for (const row of rows) {
      const good = row.figureOk && row.lineOk && row.methodKinds.length === 1 && row.methodKinds[0] === row.record!.kind;
      push({ actor: "service", kind: "output", source: row.source, tone: good ? "ok" : "warn",
        label: `Panel · ${row.cell.line || "(no line)"} · ${row.cell.figure || "(no figure)"} · ${row.cell.method || "(no method)"} · ${row.cell.source || "(no source)"}`,
        detail: row.record ? `${row.record.title}: ${row.record.note}` : row.ambiguous ? "The source cell names more than one record." : "No attendance record has this title." });
    }

    const base: LoopOut = { accepted: false, continued: false, result: null, next: null, routings, reply: "", rows, dropped, sources };
    const finish = (out: LoopOut): EngineRun<LoopOut> => ({ trace, out, metrics: {
      unaskedDrafts: routings.filter(({ request, effect }) => request.intent === "lookup" && effect === "create").length + (out.next?.effect === "create" ? 1 : 0),
      panelRows: rows.length,
    } });
    const reject = (message: string, path: string) => {
      const source = at(path);
      push({ actor: "service", kind: "error", label: "400 invalid_request_error", detail: message, source, tone: "bad" });
      push({ actor: "person", kind: "output", label: `The visitor asking about ${input.caseId} is still waiting. No model turn ran.`, tone: "bad" });
      return finish({ ...base, error: { message, source } });
    };

    // --- request validation (what the API checks before any model runs) ---
    push({ actor: "learner-artifact", kind: "request", label: `POST /v1/messages · ${messages.length} messages`, source: sources.request });
    if (typeof request.model !== "string" || !request.model.trim()) return reject("model: Field required", "/model");
    if (!Number.isInteger(request.max_tokens) || Number(request.max_tokens) < 1) return reject("max_tokens: Field required (a positive integer)", "/max_tokens");
    for (const tool of tools) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) return reject(`tools.${tool.index}.name: String should match pattern '^[a-zA-Z0-9_-]{1,64}$'`, pointer("tools", tool.index, "name"));
      if (!record(tool.raw?.input_schema)) return reject(`tools.${tool.index}.input_schema: Field required`, pointer("tools", tool.index));
    }
    if (!messages.length) return reject("messages: at least one message is required", "/messages");
    type Turn = { role: string; indexes: number[]; blocks: { block: Record<string, unknown>; at: string }[] };
    const turns: Turn[] = [];
    for (const [index, message] of messages.entries()) {
      const role = text(record(message)?.role);
      if (role !== "user" && role !== "assistant") return reject(`messages.${index}.role: Input should be 'user' or 'assistant'`, pointer("messages", index, "role"));
      const content = record(message)?.content;
      const blocks = typeof content === "string" ? [{ block: { type: "text", text: content }, at: pointer("messages", index, "content") }]
        : list(content).map((block, inner) => ({ block: record(block) ?? {}, at: pointer("messages", index, "content", inner) }));
      const last = turns[turns.length - 1];
      if (last?.role === role) {
        last.indexes.push(index);
        last.blocks.push(...blocks);
      } else turns.push({ role, indexes: [index], blocks });
    }
    if (turns[0].role !== "user") return reject("messages.0: the first message must use the 'user' role", pointer("messages", 0));
    if (turns[turns.length - 1].role !== "user") return reject("This model does not support assistant message prefill. The conversation must end with a user message.", pointer("messages", messages.length - 1));
    const usesTools = turns.some((turn) => turn.blocks.some(({ block }) => block.type === "tool_use" || block.type === "tool_result"));
    if (usesTools && !tools.length) return reject("Requests which include `tool_use` or `tool_result` blocks must define tools.", "/messages");
    for (const [position, turn] of turns.entries()) {
      if (turn.role === "assistant") {
        const ids = turn.blocks.filter(({ block }) => block.type === "tool_use").map(({ block }) => text(block.id));
        const next = turns[position + 1]?.blocks ?? [];
        // tool_result blocks count only at the start of the next user turn, before any text.
        const firstOther = next.findIndex(({ block }) => block.type !== "tool_result");
        const lead = firstOther < 0 ? next : next.slice(0, firstOther);
        const answered = new Set(lead.map(({ block }) => text(block.tool_use_id)));
        const missing = ids.filter((id) => !answered.has(id));
        if (missing.length) {
          return reject(`messages.${turn.indexes[turn.indexes.length - 1] + 1}: \`tool_use\` ids were found without \`tool_result\` blocks immediately after: ${missing.join(", ")}. Each \`tool_use\` block must have a corresponding \`tool_result\` block in the next message.`,
            pointer("messages", turn.indexes[0]));
        }
      } else {
        const asked = new Set((turns[position - 1]?.blocks ?? []).filter(({ block }) => block.type === "tool_use").map(({ block }) => text(block.id)));
        for (const { block, at: path } of turn.blocks) {
          if (block.type === "tool_result" && !asked.has(text(block.tool_use_id))) {
            return reject(`${path.slice(1).replace(/\//g, ".")}: unexpected \`tool_use_id\` found in \`tool_result\` blocks: ${text(block.tool_use_id) || "(empty)"}. Each \`tool_result\` block must have a corresponding \`tool_use\` block in the previous message.`, path);
          }
        }
      }
    }
    push({ actor: "service", kind: "response", label: "200 · request accepted", tone: "ok" });

    // --- the recorded model turn ---
    const pending = turns.findIndex((turn) => turn.role === "assistant" && turn.blocks.some(({ block }) => block.type === "tool_use" && block.id === input.pending.call.id));
    if (pending < 0) {
      push({ actor: "model", kind: "response", label: `The request does not contain the pending turn for ${input.caseId}`, detail: `No assistant turn asks for ${input.pending.call.id}. Claude answers whatever conversation the file holds.`, tone: "bad" });
      return finish({ ...base, accepted: true });
    }
    const found = turns[pending + 1].blocks.find(({ block }) => block.type === "tool_result" && block.tool_use_id === input.pending.call.id)!;
    const content = blockText(found.block.content).trim();
    const flagged = found.block.is_error === true;
    const state = flagged ? "flagged" as const : !content ? "empty" as const : content.includes(input.lead) ? "carried" as const : "missing-lead" as const;
    const result = { state, content, source: at(found.at) };
    push({ actor: "tool", kind: "tool_result", label: `tool_result → ${input.pending.call.name} (${input.pending.call.id})${flagged ? " · is_error" : ""}`, detail: content || "(empty content)", source: result.source, tone: state === "carried" ? "ok" : "warn" });
    if (state !== "carried") {
      const reply = state === "flagged" ? `The catalog lookup for ${input.caseId} failed, so I can’t tell you where the photo comes from yet.`
        : `The catalog didn’t give me anything I can use for ${input.caseId}, so I can’t name its source.`;
      push({ actor: "model", kind: "response", label: "Claude’s next turn · stop_reason: end_turn", detail: reply, tone: "bad" });
      return finish({ ...base, accepted: true, continued: true, result, reply });
    }
    const next = route({ ask: input.next.ask, intent: "lookup", subject: input.next.subject });
    push({ actor: "model", kind: "tool_call", label: `Claude’s next turn · stop_reason: tool_use → ${next.chosen ?? "no tool"}`, detail: input.next.ask, source: next.source, tone: next.effect === "read" ? undefined : "bad" });
    let reply: string;
    if (next.effect === "read") {
      push({ actor: "tool", kind: "tool_result", label: `${next.chosen} returned`, detail: input.next.readOutput });
      reply = input.next.answer;
    } else if (next.effect === "create") {
      push({ actor: "tool", kind: "output", label: `${next.chosen} ran`, detail: input.next.createOutput, tone: "bad" });
      reply = `I opened a draft exhibit entry while looking for ${input.lead}; I still don’t have the photographer’s record.`;
    } else {
      reply = next.chosen ? `${next.chosen} is not a tool the catalog connector serves, so the call failed.` : `I have no tool I can use to look up ${input.lead}.`;
    }
    push({ actor: "model", kind: "response", label: "Claude’s final turn · stop_reason: end_turn", detail: reply, tone: next.effect === "read" ? "ok" : "bad" });
    return finish({ ...base, accepted: true, continued: true, result, next, reply });
  },
};
