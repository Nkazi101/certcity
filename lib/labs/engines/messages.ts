// Messages API tool loop: validates the follow-up request the way the API does after stop_reason "tool_use",
// then plays the recorded model turn whose branch is selected from what the request actually contains
// (which result sits under which tool_use_id, is_error, which tools are offered, what history is present).
// Wire format here is Anthropic's (tool_use / tool_result / tool_use_id); the concepts are provider-neutral.
import { list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type ToolCall = { id: string; name: string; input: Readonly<Record<string, string>> };
/** "negative" is a completed lookup with an unfavourable answer; "timeout" is an execution failure. */
export type ToolOutcome = { id: string; output: string; status: "ok" | "negative" | "timeout" };

export type ToolTurnInput = {
  caseId: string;
  /** Text of the authorized case record's opening user message. The resumed conversation must carry it. */
  intake: string;
  assistant: { text: string; calls: readonly ToolCall[] };
  /** Results in the order they finished. */
  arrivals: readonly ToolOutcome[];
  /** Tool names whose results must all be "ok" before the gated tool may run. */
  required: readonly string[];
  gatedTool: string;
  /** In this recorded run, Claude calls the gated tool whenever it is offered, even with a prerequisite unmet. */
  eagerGate: boolean;
  /** How Claude names each tool's result in its reply. */
  labels: Readonly<Record<string, string>>;
  /** Text from other sessions that must never reach this conversation. */
  foreign: readonly { session: string; applicant: string; marker: string }[];
};

export type Perceived = "pass" | "negative" | "failed" | "misread" | "flagged" | "swapped" | "empty" | "missing";

export type ToolTurnOut = {
  accepted: boolean;
  error?: { message: string; source: TraceSource };
  /** False when the request does not continue this case's tool_use turn at all. */
  continuesTurn: boolean;
  pairs: readonly {
    call: ToolCall;
    outcome: ToolOutcome;
    /** The arrival whose output the block carries, if any. */
    carried: ToolOutcome | null;
    isError: boolean;
    content: string;
    perceived: Perceived;
    source: TraceSource;
  }[];
  gateOffered: boolean;
  gateAllowed: boolean;
  ackSent: boolean;
  retried: readonly string[];
  foreignSeen: readonly { session: string; applicant: string; marker: string; source: TraceSource }[];
  intakePresent: boolean;
  reply: string;
  /** Where the offered tools and the conversation history start in request.json. */
  sources: { tools: TraceSource; history: TraceSource };
};

type Parsed = { json: LocatedJson; request: Record<string, unknown> };
type Turn = { role: string; indexes: number[]; blocks: { block: Record<string, unknown>; at: string }[] };

const file = "request";

function blockText(content: unknown): string {
  if (typeof content === "string") return content;
  return list(content).map((block) => text(record(block)?.text)).join("\n");
}

function turns(messages: readonly unknown[]): Turn[] {
  const merged: Turn[] = [];
  messages.forEach((message, index) => {
    const entry = record(message);
    const role = text(entry?.role);
    const content = entry?.content;
    const blocks = typeof content === "string"
      ? [{ block: { type: "text", text: content }, at: pointer("messages", index, "content") }]
      : list(content).map((block, inner) => ({ block: record(block) ?? {}, at: pointer("messages", index, "content", inner) }));
    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.indexes.push(index);
      last.blocks.push(...blocks);
    } else merged.push({ role, indexes: [index], blocks });
  });
  return merged;
}

export const messagesEngine: Engine<Parsed, ToolTurnInput, ToolTurnOut> = {
  id: "anthropic.messages-tool-loop",
  provider: "anthropic",
  label: "Messages API validator · recorded model turns",
  simulated: false,
  parse(files) {
    const parsed = parseLocatedJson(files[file], "request.json");
    if (parsed.error !== undefined) return { ok: false, error: parsed.error, source: { artifact: file } };
    const request = record(parsed.value.value);
    if (!request) return { ok: false, error: "request.json must be a JSON object: the body of POST /v1/messages.", source: { artifact: file, line: 1 } };
    return { ok: true, value: { json: parsed.value, request } };
  },
  run({ json, request }, fixture: Fixture<ToolTurnInput>): EngineRun<ToolTurnOut> {
    const input = fixture.input;
    const at = (path: string): TraceSource => ({ artifact: file, pointer: path, line: lineOf(json, path) });
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const messages = list(request.messages);
    const tools = list(request.tools).map(record);
    const toolNames = tools.map((tool) => text(tool?.name)).filter(Boolean);
    push({ actor: "learner-artifact", kind: "request", label: `POST /v1/messages · ${messages.length} messages · tools: ${toolNames.join(", ") || "none"}`, source: at("") });
    const base: ToolTurnOut = {
      sources: { tools: at("/tools"), history: at("/messages/0") },
      accepted: false, continuesTurn: false, pairs: [], gateOffered: false, gateAllowed: false, ackSent: false,
      retried: [], foreignSeen: [], intakePresent: false, reply: "",
    };
    const reject = (message: string, path: string): EngineRun<ToolTurnOut> => {
      const source = at(path);
      push({ actor: "service", kind: "error", label: "400 invalid_request_error", detail: message, source, tone: "bad" });
      push({ actor: "person", kind: "output", label: `${input.caseId} is still waiting. No model turn ran.`, tone: "bad" });
      return { trace, out: { ...base, error: { message, source } }, metrics: { paired: 0, results: input.assistant.calls.length } };
    };

    // --- request validation (the checks the API performs before any model runs) ---
    if (typeof request.model !== "string" || !request.model.trim()) return reject("model: Field required", "/model");
    if (!Number.isInteger(request.max_tokens) || Number(request.max_tokens) < 1) return reject("max_tokens: Field required (a positive integer)", "/max_tokens");
    if (!messages.length) return reject("messages: at least one message is required", "/messages");
    for (const [index, message] of messages.entries()) {
      const role = record(message)?.role;
      if (role !== "user" && role !== "assistant") return reject(`messages.${index}.role: Input should be 'user' or 'assistant'`, pointer("messages", index, "role"));
    }
    const merged = turns(messages);
    for (const turn of merged) {
      if (turn.indexes.length > 1) {
        push({ actor: "service", kind: "decision", label: `messages ${turn.indexes.join(", ")} have the same role (${turn.role}) and are combined into one turn`, source: at(pointer("messages", turn.indexes[0])), tone: "warn" });
      }
    }
    if (merged[0].role !== "user") return reject("messages.0: the first message must use the 'user' role", pointer("messages", 0));
    if (merged[merged.length - 1].role !== "user") {
      return reject("This model does not support assistant message prefill. The conversation must end with a user message.", pointer("messages", messages.length - 1));
    }
    for (const [position, turn] of merged.entries()) {
      if (turn.role === "assistant") {
        const ids = turn.blocks.filter(({ block }) => block.type === "tool_use").map(({ block }) => text(block.id));
        const next = merged[position + 1];
        const answered = new Set((next?.blocks ?? []).filter(({ block }) => block.type === "tool_result").map(({ block }) => text(block.tool_use_id)));
        const missing = ids.filter((id) => !answered.has(id));
        if (missing.length) {
          return reject(`messages.${turn.indexes[turn.indexes.length - 1] + 1}: tool_use ids were found without tool_result blocks immediately after: ${missing.join(", ")}. Each tool_use block must have a corresponding tool_result block in the next message.`,
            pointer("messages", turn.indexes[0]));
        }
      } else {
        const previous = merged[position - 1];
        const asked = new Set((previous?.blocks ?? []).filter(({ block }) => block.type === "tool_use").map(({ block }) => text(block.id)));
        const seen = new Set<string>();
        for (const { block, at: path } of turn.blocks) {
          if (block.type !== "tool_result") continue;
          const id = text(block.tool_use_id);
          if (!asked.has(id)) {
            return reject(`${path.slice(1).replace(/\//g, ".")}: unexpected tool_use_id found in tool_result blocks: ${id || "(empty)"}. Each tool_result block must have a corresponding tool_use block in the previous message.`, path);
          }
          if (seen.has(id)) return reject(`${path.slice(1).replace(/\//g, ".")}: tool_use_id ${id} already has a tool_result in this message. Send one result per tool_use.`, path);
          seen.add(id);
        }
      }
    }
    push({ actor: "service", kind: "response", label: "200 · request accepted", tone: "ok" });

    // --- which conversation is this? ---
    const pendingTurn = merged.findIndex((turn) => turn.role === "assistant" &&
      input.assistant.calls.every((call) => turn.blocks.some(({ block }) => block.type === "tool_use" && block.id === call.id)));
    const history = pendingTurn < 0 ? merged : merged.slice(0, pendingTurn);
    const historyText = history.flatMap((turn) => turn.blocks.map(({ block, at: path }) => ({ path, value: block.type === "tool_result" ? blockText(block.content) : text(block.text) })));
    const foreignSeen = input.foreign.flatMap((entry) => {
      const hit = historyText.find(({ value }) => value.includes(entry.marker));
      return hit ? [{ ...entry, source: at(hit.path) }] : [];
    });
    const intakePresent = historyText.some(({ value }) => value.includes(input.intake.slice(0, 40)));
    for (const entry of foreignSeen) {
      push({ actor: "learner-artifact", kind: "decision", label: `History includes console session ${entry.session}`, detail: `“…${entry.marker}…” belongs to applicant ${entry.applicant}.`, source: entry.source, tone: "warn" });
    }
    if (pendingTurn < 0) {
      push({ actor: "model", kind: "response", label: `The request does not contain ${input.caseId}’s pending tool_use turn`, detail: `None of the assistant turns asks for ${input.assistant.calls.map(({ id }) => id).join(", ")}. Claude answers the conversation in the file instead.`, tone: "bad" });
      return { trace, out: { ...base, accepted: true, foreignSeen, intakePresent, reply: "" }, metrics: { paired: 0, results: input.assistant.calls.length } };
    }

    // --- pair results with calls by tool_use_id ---
    const answerTurn = merged[pendingTurn + 1];
    const pairs = input.assistant.calls.map((call) => {
      const outcome = input.arrivals.find(({ id }) => id === call.id)!;
      const found = answerTurn.blocks.find(({ block }) => block.type === "tool_result" && block.tool_use_id === call.id)!;
      const content = blockText(found.block.content).trim();
      const carried = input.arrivals.find(({ output }) => content && content.includes(output)) ?? null;
      const isError = found.block.is_error === true;
      const perceived: Perceived =
        carried && carried.id !== call.id ? "swapped"
          : !carried ? isError ? "failed" : "empty"
            : isError ? outcome.status === "timeout" ? "failed" : "flagged"
              : outcome.status === "timeout" ? "misread" : outcome.status === "ok" ? "pass" : "negative";
      const source = at(found.at);
      push({ actor: "tool", kind: "tool_result", label: `tool_result → ${call.name} (${call.id})${isError ? " · is_error" : ""}`, detail: content || "(empty content)", source,
        tone: perceived === "pass" || perceived === "negative" || perceived === "failed" ? undefined : "warn" });
      return { call, outcome, carried, isError, content, perceived, source };
    });

    // --- the recorded model turn, selected by what the request contains ---
    const choice = record(request.tool_choice);
    const gateOffered = toolNames.includes(input.gatedTool) && choice?.type !== "none";
    const gateAllowed = input.required.every((name) => input.arrivals.find(({ id }) => input.assistant.calls.find((call) => call.id === id)?.name === name)?.status === "ok");
    const required = pairs.filter(({ call }) => input.required.includes(call.name));
    const believesPassed = required.every(({ perceived, carried }) => perceived === "pass" || perceived === "misread" || (perceived === "swapped" && carried?.status !== "negative"));
    const retried = pairs.filter(({ perceived }) => perceived === "flagged").map(({ call }) => call.name);
    const lines = pairs.map(({ call, perceived, carried, content }) => {
      const label = input.labels[call.name] ?? call.name;
      switch (perceived) {
        case "pass": case "negative": case "misread": case "swapped": return `${label}: ${carried?.output ?? content}`;
        case "failed": return `${label}: the lookup did not complete, so I can’t rely on it yet.`;
        case "flagged": return `${label}: that lookup failed, so I’ll run it again.`;
        default: return `${label}: no information came back.`;
      }
    });
    const foreignLine = foreignSeen.length ? [`Also on file from earlier in this session: ${foreignSeen.map(({ marker }) => marker).join("; ")}.`] : [];
    const reply = [...lines, ...foreignLine].join("\n");
    push({ actor: "model", kind: "response", label: "Claude’s next turn", detail: reply, tone: foreignSeen.length || pairs.some(({ perceived }) => perceived === "swapped" || perceived === "misread") ? "warn" : undefined });
    for (const name of retried) push({ actor: "model", kind: "tool_call", label: `tool_use → ${name} (again)`, detail: "Claude asks for a lookup that already returned a decision.", tone: "warn" });
    const ackSent = gateOffered && retried.length === 0 && (believesPassed || input.eagerGate);
    if (ackSent) {
      push({ actor: "model", kind: "tool_call", label: `tool_use → ${input.gatedTool}`, detail: `${input.caseId}: acknowledgment queued for the applicant.`, tone: gateAllowed ? "ok" : "bad" });
      push({ actor: "service", kind: "output", label: `Outbox · acknowledgment for ${input.caseId}`, tone: gateAllowed ? "ok" : "bad" });
    } else {
      push({ actor: "service", kind: "output", label: gateOffered ? `No acknowledgment sent for ${input.caseId}` : `${input.gatedTool} was not offered on this turn · no acknowledgment sent for ${input.caseId}`, tone: gateAllowed ? "warn" : "ok" });
    }
    const paired = pairs.filter(({ carried, call }) => carried?.id === call.id).length;
    return {
      trace,
      out: { ...base, accepted: true, continuesTurn: true, pairs, gateOffered, gateAllowed, ackSent, retried, foreignSeen, intakePresent, reply },
      metrics: { paired, results: pairs.length },
    };
  },
};
