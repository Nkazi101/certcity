// Reliability policy replay (Claude API error classes and stop reasons): the learner's policy file decides what the
// service does after each failure class (429 rate_limit_error, 529 overloaded_error, 500 api_error, 400
// invalid_request_error) and each stop reason that ends a turn early (max_tokens, refusal,
// model_context_window_exceeded): retry and how long to wait, switch model, raise the output budget, compact the
// conversation, hand the request to a safety path, show a degraded reply, or fail. A retry budget caps extra calls and
// a circuit breaker can stop sending traffic to an overloaded model. Recorded guest requests are replayed in order;
// the recorded behaviour of each request decides what every call returns, so runs are deterministic.
import { record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

/** What the recorded request does on the primary model before any policy runs. */
export type Behaviour = "ok" | "rate_limited" | "overloaded" | "server_error" | "length" | "declined" | "too_long" | "malformed";

export type GuestRequest = {
  id: string;
  ask: string;
  behaviour: Behaviour;
  /** rate_limited: seconds the API's retry-after header asked for. */
  retryAfter?: number;
  /** server_error: how many calls to the primary model return 500 before it recovers. */
  transient?: number;
  /** length: output tokens the complete answer needs. */
  needs?: number;
};

export type ReliabilityInput = {
  requests: readonly GuestRequest[];
  /** Models that return 529 overloaded_error for this whole window. */
  overloaded: readonly string[];
  /** Model calls the service may make per guest question, averaged over the window. */
  capacity: number;
  /** Share of guests that must get a model answer (declined and malformed requests excluded). */
  answerTarget: number;
};

export type FailureClass = "rate_limit_error" | "overloaded_error" | "api_error" | "invalid_request_error"
  | "max_tokens" | "refusal" | "model_context_window_exceeded";
type Result = "ok" | FailureClass;
export const failureClasses: readonly FailureClass[] = ["rate_limit_error", "overloaded_error", "api_error", "invalid_request_error", "max_tokens", "refusal", "model_context_window_exceeded"];
const actions = ["retry", "fallback", "raise_max_tokens", "compact", "safety_path", "degrade", "fail"] as const;
type Action = (typeof actions)[number];
type Rule = { action: Action; maxAttempts: number; wait: "retry-after" | "backoff"; backoff: number; then: Action; model: string; to: number; at: string };

type Parsed = {
  located: LocatedJson;
  primary: string;
  maxTokens: number;
  rules: Partial<Record<FailureClass | "default", Rule>>;
  retryRatio: number | null;
  whenExhausted: Action;
  breaker: { openAfter: number; model: string } | null;
  degradedReply: string;
};

export type Call = { model: string; result: Result; maxTokens: number; waited: number; resend: boolean };
export type Final = "answered" | "safety" | "degraded" | "error";
export type RequestRun = {
  request: GuestRequest;
  calls: readonly Call[];
  final: Final;
  /** Calls sent to the same model before the wait the API asked for had passed. */
  early: number;
  /** Calls identical to the previous one after a stop that the same request would reproduce. */
  repeats: number;
  source: TraceSource;
};
export type ReliabilityOut = { requests: readonly RequestRun[]; calls: number; answered: number; eligible: number; reply: string; breakerOpened: number | null; source: TraceSource };

const file = "reliability-policy.json";
const number = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const asAction = (value: unknown, fallback: Action): Action => actions.includes(text(value) as Action) ? text(value) as Action : fallback;

export const reliabilityEngine: Engine<Parsed, ReliabilityInput, ReliabilityOut> = {
  id: "anthropic.reliability-policy",
  provider: "anthropic",
  label: "Recorded game-day requests replayed through the reliability policy (Claude API error classes and stop reasons)",
  simulated: false,
  parse(files) {
    const parsed = parseLocatedJson(files.policy, file);
    if (parsed.error !== undefined) return { ok: false, error: parsed.error, source: { artifact: "policy", line: 1 } };
    const root = record(parsed.value.value);
    if (!root) return { ok: false, error: `${file} must be a JSON object at the top level.`, source: { artifact: "policy", line: 1 } };
    const primary = text(root.primary);
    if (!primary) return { ok: false, error: `${file} needs "primary": the model the service calls first.`, source: { artifact: "policy", line: 1 } };
    const on = record(root.on);
    if (!on) return { ok: false, error: `${file} needs an "on" object that says what happens after each kind of failure.`, source: { artifact: "policy", line: 1 } };
    const rules: Parsed["rules"] = {};
    for (const [key, value] of Object.entries(on)) {
      if (key !== "default" && !failureClasses.includes(key as FailureClass)) {
        return { ok: false, error: `"on" has a key "${key}", which is not an error type or stop reason the API returns. Known keys: ${failureClasses.join(", ")}, default.`, source: { artifact: "policy", pointer: pointer("on", key), line: lineOf(parsed.value, pointer("on", key)) } };
      }
      const entry = record(value) ?? {};
      if (!actions.includes(text(entry.action) as Action)) {
        return { ok: false, error: `on.${key}.action must be one of ${actions.join(", ")}.`, source: { artifact: "policy", pointer: pointer("on", key), line: lineOf(parsed.value, pointer("on", key)) } };
      }
      rules[key as FailureClass | "default"] = {
        action: text(entry.action) as Action,
        maxAttempts: Math.max(1, Math.floor(number(entry.max_attempts, 2))),
        wait: text(entry.wait) === "retry-after" ? "retry-after" : "backoff",
        backoff: Math.max(0, number(entry.backoff_seconds, 1)),
        then: asAction(entry.then, "fail"),
        model: text(entry.model),
        to: Math.floor(number(entry.to, 0)),
        at: pointer("on", key),
      };
    }
    const budget = record(root.retry_budget);
    const breaker = record(root.circuit_breaker);
    return { ok: true, value: {
      located: parsed.value, primary, maxTokens: Math.floor(number(root.max_tokens, 1024)), rules,
      retryRatio: budget ? Math.max(0, number(budget.max_retry_ratio, 0)) : null,
      whenExhausted: asAction(budget?.when_exhausted, "fail"),
      breaker: breaker && text(breaker.model) ? { openAfter: Math.max(1, Math.floor(number(breaker.open_after, 3))), model: text(breaker.model) } : null,
      degradedReply: text(root.degraded_reply).trim(),
    } };
  },
  run(parsed, fixture: Fixture<ReliabilityInput>): EngineRun<ReliabilityOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const at = (where: string): TraceSource => ({ artifact: "policy", pointer: where, line: lineOf(parsed.located, where) });
    const ruleFor = (result: FailureClass) => parsed.rules[result] ?? parsed.rules.default;
    const budget = parsed.retryRatio === null ? Infinity : Math.floor(parsed.retryRatio * input.requests.length + 1e-9);
    push({ actor: "learner-artifact", kind: "request", label: `${file} · primary ${parsed.primary} · max_tokens ${parsed.maxTokens} · ${Object.keys(parsed.rules).length} failure rules · retry budget ${budget === Infinity ? "none" : `${budget} extra calls`}${parsed.breaker ? ` · breaker after ${parsed.breaker.openAfter} overloads` : ""}`, source: at("") });

    let extra = 0;
    let overloadStreak = 0;
    let breakerOpened: number | null = null;
    const runs: RequestRun[] = [];

    const respond = (request: GuestRequest, model: string, maxTokens: number, waited: number, compacted: boolean, previous: readonly Call[]): Result => {
      if (input.overloaded.includes(model)) return "overloaded_error";
      switch (request.behaviour) {
        case "ok": return "ok";
        case "rate_limited": return model === parsed.primary && waited < (request.retryAfter ?? 0) ? "rate_limit_error" : "ok";
        case "overloaded": return model === parsed.primary ? "overloaded_error" : "ok";
        case "server_error": return model === parsed.primary && previous.filter((call) => call.model === model && call.result === "api_error").length < (request.transient ?? 1) ? "api_error" : "ok";
        case "length": return maxTokens < (request.needs ?? 0) ? "max_tokens" : "ok";
        case "declined": return "refusal";
        case "too_long": return compacted ? "ok" : "model_context_window_exceeded";
        case "malformed": return "invalid_request_error";
      }
    };

    input.requests.forEach((request, index) => {
      const calls: Call[] = [];
      const attempts = new Map<string, number>();
      const breakerOpen = parsed.breaker !== null && breakerOpened !== null;
      let model = breakerOpen ? parsed.breaker!.model : parsed.primary;
      let maxTokens = parsed.maxTokens;
      let waited = 0;
      let compacted = false;
      let early = 0;
      let repeats = 0;
      let final: Final | null = null;
      let source: TraceSource = at("/on");
      let pendingWait = 0;
      for (let step = 0; step < 12 && final === null; step++) {
        if (step > 0) {
          if (extra >= budget) {
            final = parsed.whenExhausted === "degrade" ? "degraded" : "error";
            source = at("/retry_budget");
            break;
          }
          extra++;
        }
        waited += pendingWait;
        const last = calls[calls.length - 1];
        const resend = !!last && last.model === model && last.maxTokens === maxTokens && !(last.result === "model_context_window_exceeded" && compacted);
        if (last && last.result === "rate_limit_error" && last.model === model && waited < (request.retryAfter ?? 0)) early++;
        const result = respond(request, model, maxTokens, waited, compacted, calls);
        if (resend && (result === "max_tokens" || result === "refusal" || result === "model_context_window_exceeded" || result === "invalid_request_error")) repeats++;
        calls.push({ model, result, maxTokens, waited, resend });
        pendingWait = 0;
        if (model === parsed.primary) {
          overloadStreak = result === "overloaded_error" ? overloadStreak + 1 : 0;
          if (parsed.breaker && breakerOpened === null && overloadStreak >= parsed.breaker.openAfter) breakerOpened = index;
        }
        if (result === "ok") { final = "answered"; break; }
        const rule = ruleFor(result);
        if (!rule) { final = "error"; source = at("/on"); break; }
        source = at(rule.at);
        const apply = (action: Action): void => {
          switch (action) {
            case "retry": {
              const used = (attempts.get(result) ?? 0) + 1;
              attempts.set(result, used);
              if (used >= rule.maxAttempts) return rule.then === "retry" ? void (final = "error") : apply(rule.then);
              pendingWait = rule.wait === "retry-after" && result === "rate_limit_error" ? Math.max(request.retryAfter ?? 0, rule.backoff) : rule.backoff * 2 ** (used - 1);
              return;
            }
            case "fallback":
              if (!rule.model || rule.model === model) { final = parsed.degradedReply ? "degraded" : "error"; return; }
              model = rule.model;
              return;
            case "raise_max_tokens":
              if (rule.to <= maxTokens) { final = "error"; return; }
              maxTokens = rule.to;
              return;
            case "compact":
              if (compacted || result !== "model_context_window_exceeded") { final = "error"; return; }
              compacted = true;
              return;
            case "safety_path": final = "safety"; return;
            case "degrade": final = "degraded"; return;
            case "fail": final = "error"; return;
          }
        };
        apply(rule.action);
      }
      // `final` is set inside apply(), which flow analysis cannot see, so widen it again here.
      const ended = (final as Final | null) ?? "error";
      const settled: Final = ended === "degraded" && !parsed.degradedReply ? "error" : ended;
      const run: RequestRun = { request, calls, final: settled, early, repeats, source };
      runs.push(run);
      const path = calls.map((call) => `${call.model.replace(/^claude-/, "")}${call.maxTokens !== parsed.maxTokens ? `@${call.maxTokens}` : ""}→${call.result === "ok" ? "answer" : call.result}${call.waited ? ` (+${call.waited}s)` : ""}`).join(", ");
      const shown = settled === "answered" ? "answered" : settled === "safety" ? "sent to the guest-safety desk" : settled === "degraded" ? "shown the busy reply" : "shown an error page";
      push({ actor: "service", kind: "decision", label: `${request.id} · ${request.ask} → ${shown}`, detail: `${calls.length} call${calls.length === 1 ? "" : "s"}: ${path}`, source,
        tone: settled === "error" || early || repeats ? "bad" : settled === "answered" || settled === "safety" ? "ok" : undefined });
      if (breakerOpened === index && parsed.breaker) push({ actor: "service", kind: "decision", label: `Breaker opened after ${parsed.breaker.openAfter} overloaded responses in a row: new questions go to ${parsed.breaker.model}`, source: at("/circuit_breaker") });
    });

    const callsTotal = runs.reduce((sum, run) => sum + run.calls.length, 0);
    const eligible = runs.filter(({ request }) => request.behaviour !== "declined" && request.behaviour !== "malformed");
    const answered = eligible.filter(({ final }) => final === "answered").length;
    push({ actor: "service", kind: "metric", label: `${callsTotal} model calls for ${runs.length} questions (${(callsTotal / runs.length).toFixed(2)} per question; capacity ${input.capacity}) · ${answered} of ${eligible.length} answerable questions answered`, source: at("/retry_budget"),
      tone: callsTotal / runs.length > input.capacity + 1e-9 ? "bad" : "ok" });
    return {
      trace,
      out: { requests: runs, calls: callsTotal, answered, eligible: eligible.length, reply: parsed.degradedReply, breakerOpened, source: at("/retry_budget") },
      metrics: { calls: callsTotal, answered, guests: runs.length },
    };
  },
};

/** The first thing each recorded request returned on the primary model, for the case documents. */
export function firstResponse(request: GuestRequest, input: ReliabilityInput, primary: string) {
  if (input.overloaded.includes(primary)) return "HTTP 529 overloaded_error";
  switch (request.behaviour) {
    case "ok": return "200 · stop_reason end_turn";
    case "overloaded": return "HTTP 529 overloaded_error";
    case "rate_limited": return `HTTP 429 rate_limit_error · retry-after: ${request.retryAfter}`;
    case "server_error": return "HTTP 500 api_error";
    case "length": return `200 · stop_reason max_tokens · answer cut off (needs about ${request.needs} output tokens)`;
    case "declined": return "200 · stop_reason refusal · stop_details.category set";
    case "too_long": return "200 · stop_reason model_context_window_exceeded";
    case "malformed": return "HTTP 400 invalid_request_error · image exceeds the size limit";
  }
}

