// Context and cost bench (Anthropic Messages API): the learner's request template is rendered for a run of matched
// vendor requests and billed with prompt caching (exact prefix match over system then messages blocks, at most four
// cache_control breakpoints, a minimum cacheable prefix, writes at 1.25x and reads at the model's cache-read price).
// Dispositions follow from the context the request carries. The learner's holdout set is scored against two recorded
// faulty builds, and their usage assertions against a recorded good build and the build behind the spend spike.
import { list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type ModelRow = { id: string; accuracy: number; p95: number; input: number; output: number; cacheRead: number };
export type Placeholder = { name: string; tokens: number; varies: "never" | "vendor" | "case" | "call"; context?: "verified" | "transcript" | "summary" | "vendor-files" | "time" };
export type CaseKind = "complete" | "blank-none" | "blank-signed" | "blank-draft" | "late";
export type BankCase = { id: string; vendor: string; kind: CaseKind; note: string };
export type UsageRow = { input_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number; output_tokens: number; latency_ms: number; cost_usd: number };
export type ContextInput = {
  models: readonly ModelRow[];
  targets: { accuracy: number; costUsd: number; p95: number };
  placeholders: readonly Placeholder[];
  minimumCacheable: number;
  outputTokens: number;
  secondsPerThousandUncached: number;
  calls: readonly { vendor: string; caseId: string; at: string }[];
  bank: readonly BankCase[];
  builds: readonly { name: string; rule: "every-blank-missing" | "any-waiver-approves" }[];
  logs: { good: { name: string; calls: readonly UsageRow[] }; bad: { name: string; calls: readonly UsageRow[] } };
};

type Block = { template: string; breakpoint: boolean; ttl: "5m" | "1h"; at: string; where: string };
type Assertion = { field: string; calls: string; min: number | null; max: number | null; at: string };
type Parsed = {
  request: LocatedJson; holdout: LocatedJson; check: LocatedJson;
  model: string; blocks: readonly Block[];
  holdoutCases: readonly { caseId: string; expect: string; at: string }[];
  assertions: readonly Assertion[];
};

export type CallUsage = { label: string; caseId: string; input: number; creation: number; read: number; cost: number; latency: number; disposition: string; truth: string; otherVendors: boolean };
export type ContextOut = {
  error?: { message: string; source: TraceSource };
  model?: ModelRow;
  calls: readonly CallUsage[];
  costPerRequest: number;
  p95: number;
  firstDiff?: { block: number; source: TraceSource };
  missingContext: readonly string[];
  holdout: { unknown: readonly string[]; mislabeled: readonly { caseId: string; expect: string }[]; builds: readonly { name: string; score: number }[]; size: number; source: TraceSource };
  costCheck: { good: boolean; bad: boolean; count: number; source: TraceSource };
  sources: { model: TraceSource; system: TraceSource; messages: TraceSource };
};

const files = { request: "request.json", holdout: "holdout.json", check: "cost-check.json" } as const;
const labels: Record<CaseKind, string> = { complete: "complete", "blank-none": "missing-document", "blank-signed": "approved-exception", "blank-draft": "missing-document", late: "late" };

function blocksOf(request: Record<string, unknown>): Block[] {
  const blocks: Block[] = [];
  const add = (value: unknown, at: string, where: string) => {
    if (typeof value === "string") { blocks.push({ template: value, breakpoint: false, ttl: "5m", at, where }); return; }
    list(value).forEach((entry, index) => {
      const item = record(entry);
      if (!item) return;
      const control = record(item.cache_control);
      blocks.push({ template: text(item.text), breakpoint: !!control, ttl: text(control?.ttl) === "1h" ? "1h" : "5m", at: `${at}/${index}`, where });
    });
  };
  add(request.system, "/system", "system");
  list(request.messages).forEach((message, index) => add(record(message)?.content, pointer("messages", index, "content"), `messages[${index}]`));
  const auto = record(request.cache_control);
  if (auto && blocks.length) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], breakpoint: true, ttl: text(auto.ttl) === "1h" ? "1h" : "5m" };
  return blocks;
}

export const contextCostEngine: Engine<Parsed, ContextInput, ContextOut> = {
  id: "anthropic.context-cost",
  provider: "anthropic",
  label: "Messages requests rendered and billed with prompt caching; holdout and usage checks scored on recorded builds",
  simulated: false,
  parse(input) {
    const request = parseLocatedJson(input.request, files.request);
    if (request.error !== undefined) return { ok: false, error: request.error, source: { artifact: "request", line: 1 } };
    const holdout = parseLocatedJson(input.holdout, files.holdout);
    if (holdout.error !== undefined) return { ok: false, error: holdout.error, source: { artifact: "holdout", line: 1 } };
    const check = parseLocatedJson(input.check, files.check);
    if (check.error !== undefined) return { ok: false, error: check.error, source: { artifact: "check", line: 1 } };
    const root = record(request.value.value);
    if (!root || !Array.isArray(root.messages)) return { ok: false, error: `${files.request} needs a "messages" array, like any Messages API request body.`, source: { artifact: "request", line: 1 } };
    const holdoutCases = list(record(holdout.value.value)?.cases).map((entry, index) => {
      const item = record(entry) ?? {};
      return { caseId: String(item.case ?? "").trim(), expect: text(item.expect).trim().toLowerCase(), at: pointer("cases", index) };
    });
    const assertions = list(record(check.value.value)?.assert).map((entry, index): Assertion => {
      const item = record(entry) ?? {};
      const number = (value: unknown) => typeof value === "number" ? value : null;
      return { field: text(item.field).replace(/^usage\./, ""), calls: text(item.calls).toLowerCase() || "all", min: number(item.min), max: number(item.max), at: pointer("assert", index) };
    });
    return { ok: true, value: { request: request.value, holdout: holdout.value, check: check.value, model: text(root.model), blocks: blocksOf(root), holdoutCases, assertions } };
  },
  run(parsed, fixture: Fixture<ContextInput>): EngineRun<ContextOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const at = (artifact: "request" | "holdout" | "check", where: string): TraceSource => ({ artifact, pointer: where, line: lineOf(parsed[artifact], where) });
    const sources = { model: at("request", "/model"), system: at("request", "/system"), messages: at("request", "/messages") };
    const empty: ContextOut = {
      calls: [], costPerRequest: 0, p95: 0, missingContext: [],
      holdout: { unknown: [], mislabeled: [], builds: [], size: 0, source: at("holdout", "/cases") },
      costCheck: { good: false, bad: false, count: 0, source: at("check", "/assert") }, sources,
    };
    const model = input.models.find(({ id }) => id === parsed.model);
    const breakpoints = parsed.blocks.filter(({ breakpoint }) => breakpoint);
    let error: ContextOut["error"];
    if (!model) error = { message: `404 not_found_error: model: ${parsed.model || "(missing)"}`, source: sources.model };
    else if (breakpoints.length > 4) error = { message: "400 invalid_request_error: A maximum of 4 blocks with cache_control may be provided.", source: at("request", breakpoints[4].at) };
    push({ actor: "learner-artifact", kind: "request", label: `${files.request} · ${parsed.model || "(no model)"} · ${parsed.blocks.length} blocks · ${breakpoints.length} cache breakpoint${breakpoints.length === 1 ? "" : "s"}`, source: sources.model });

    // Holdout and usage checks are scored on recorded builds, whatever the request does.
    const unknown = parsed.holdoutCases.filter(({ caseId }) => !input.bank.some(({ id }) => id === caseId)).map(({ caseId }) => caseId);
    const known = parsed.holdoutCases.filter(({ caseId }) => input.bank.some(({ id }) => id === caseId));
    const mislabeled = known.filter(({ caseId, expect }) => labels[input.bank.find(({ id }) => id === caseId)!.kind] !== expect).map(({ caseId, expect }) => ({ caseId, expect }));
    const builds = input.builds.map(({ name, rule }) => {
      const score = known.length ? known.filter(({ caseId, expect }) => {
        const kind = input.bank.find(({ id }) => id === caseId)!.kind;
        const answer = rule === "every-blank-missing" ? (kind.startsWith("blank") ? "missing-document" : labels[kind]) : (kind === "blank-signed" || kind === "blank-draft" ? "approved-exception" : labels[kind]);
        return answer === expect;
      }).length / known.length : 1;
      push({ actor: "service", kind: "metric", label: `Holdout (${known.length} cases) on ${name}: ${Math.round(score * 100)}%`, source: at("holdout", "/cases"), tone: score === 1 ? "warn" : "ok" });
      return { name, score };
    });
    for (const id of unknown) push({ actor: "service", kind: "error", label: `Holdout case ${id} is not in the case bank`, source: at("holdout", "/cases"), tone: "bad" });
    const assess = (rows: readonly UsageRow[]) => parsed.assertions.every(({ field, calls, min, max }) => {
      const chosen = /first/.test(calls) && !/after|later|2/.test(calls) ? rows.slice(0, 1) : /after|later|2\+|rest/.test(calls) ? rows.slice(1) : rows;
      return chosen.every((row) => {
        const value = (row as Record<string, number>)[field];
        if (typeof value !== "number") return false;
        return (min === null || value >= min) && (max === null || value <= max);
      });
    });
    const good = parsed.assertions.length > 0 && assess(input.logs.good.calls);
    const bad = parsed.assertions.length > 0 && assess(input.logs.bad.calls);
    push({ actor: "service", kind: "metric", label: `${files.check} (${parsed.assertions.length} assertion${parsed.assertions.length === 1 ? "" : "s"}): ${input.logs.good.name} → ${good ? "pass" : "fail"} · ${input.logs.bad.name} → ${bad ? "pass" : "fail"}`,
      source: at("check", "/assert"), tone: good && !bad ? "ok" : "warn" });
    const shared = { holdout: { unknown, mislabeled, builds, size: known.length, source: at("holdout", "/cases") }, costCheck: { good, bad, count: parsed.assertions.length, source: at("check", "/assert") } };
    if (error || !model) {
      push({ actor: "service", kind: "error", label: error!.message, source: error!.source, tone: "bad" });
      return { trace, out: { ...empty, ...shared, error }, metrics: { cost: 0, cacheRead: 0 } };
    }

    // Render and bill each matched request.
    const placeholders = new Map(input.placeholders.map((entry) => [entry.name, entry]));
    const used = new Set(parsed.blocks.flatMap(({ template }) => [...template.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map(([, name]) => name)));
    for (const name of used) if (!placeholders.has(name)) push({ actor: "service", kind: "decision", label: `{{${name}}} is not filled by the request builder and is sent as written`, source: sources.system, tone: "warn" });
    const contexts = new Set([...used].map((name) => placeholders.get(name)?.context).filter(Boolean));
    const written = new Set<string>();
    let firstDiff: ContextOut["firstDiff"];
    let firstKeys: string[] | null = null;
    const calls: CallUsage[] = input.calls.map((call, index) => {
      const rendered = parsed.blocks.map(({ template }) => {
        let tokens = 0;
        const key = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, name: string) => {
          const entry = placeholders.get(name);
          if (!entry) return match;
          tokens += entry.tokens;
          const value = entry.varies === "vendor" ? call.vendor : entry.varies === "case" ? call.caseId : entry.varies === "call" ? call.at : "";
          return `⟨${name}${value ? `=${value}` : ""}⟩`;
        });
        tokens += Math.ceil(key.replace(/⟨[^⟩]*⟩/g, "").length / 4);
        return { key, tokens };
      });
      const keys = rendered.map((_, end) => rendered.slice(0, end + 1).map(({ key }) => key).join("\u0001"));
      if (!firstKeys) firstKeys = keys;
      else if (!firstDiff) {
        const block = keys.findIndex((key, position) => key !== firstKeys![position]);
        if (block >= 0 && block <= parsed.blocks.findLastIndex(({ breakpoint }) => breakpoint)) firstDiff = { block, source: at("request", parsed.blocks[block].at) };
      }
      const prefixTokens = (end: number) => rendered.slice(0, end + 1).reduce((sum, { tokens }) => sum + tokens, 0);
      const total = prefixTokens(rendered.length - 1);
      const last = parsed.blocks.findLastIndex(({ breakpoint }) => breakpoint);
      let hitEnd = -1;
      for (let end = last; end >= 0; end--) if (written.has(keys[end])) { hitEnd = end; break; }
      const read = hitEnd >= 0 ? prefixTokens(hitEnd) : 0;
      let creation = 0;
      if (last >= 0 && last > hitEnd && prefixTokens(last) >= input.minimumCacheable) creation = prefixTokens(last) - read;
      parsed.blocks.forEach(({ breakpoint }, end) => { if (breakpoint && prefixTokens(end) >= input.minimumCacheable) written.add(keys[end]); });
      const inputTokens = total - read - creation;
      const writeRate = parsed.blocks[last]?.ttl === "1h" ? 2 : 1.25;
      const cost = (inputTokens * model.input + creation * model.input * writeRate + read * model.cacheRead + input.outputTokens * model.output) / 1e6;
      const latency = model.p95 + input.secondsPerThousandUncached * (inputTokens + creation) / 1000;
      const bank = input.bank.find(({ id }) => id === call.caseId)!;
      const truth = labels[bank.kind];
      let disposition = "needs-review (no case records in the request)";
      if (contexts.has("transcript") || contexts.has("summary")) disposition = bank.kind === "blank-signed" ? "missing-document" : truth;
      else if (contexts.has("verified") || contexts.has("vendor-files")) disposition = truth;
      if (bank.kind === "late" && !contexts.has("time") && !disposition.startsWith("needs")) disposition = "complete";
      const otherVendors = contexts.has("vendor-files");
      push({ actor: "model", kind: "response", label: `Call ${index + 1} · ${call.vendor} case ${call.caseId} → ${disposition}`,
        detail: `usage: input_tokens ${inputTokens} · cache_creation_input_tokens ${creation} · cache_read_input_tokens ${read} · output_tokens ${input.outputTokens} · $${cost.toFixed(4)} · ${latency.toFixed(2)} s`,
        source: firstDiff && index > 0 ? firstDiff.source : sources.messages, tone: disposition !== truth ? "bad" : index > 0 && read === 0 ? "warn" : undefined });
      return { label: `${call.vendor} case ${call.caseId}`, caseId: call.caseId, input: inputTokens, creation, read, cost, latency, disposition, truth, otherVendors };
    });
    const costPerRequest = calls.reduce((sum, { cost }) => sum + cost, 0) / calls.length;
    const p95 = Math.max(...calls.map(({ latency }) => latency));
    push({ actor: "service", kind: "metric", label: `Route ${model.id}: holdout accuracy ${Math.round(model.accuracy * 100)}% · $${costPerRequest.toFixed(4)} per request · p95 ${p95.toFixed(2)} s`,
      detail: `Targets: ≥ ${Math.round(input.targets.accuracy * 100)}% · ≤ $${input.targets.costUsd.toFixed(2)} · < ${input.targets.p95} s`, source: sources.model,
      tone: model.accuracy >= input.targets.accuracy && costPerRequest <= input.targets.costUsd && p95 < input.targets.p95 ? "ok" : "bad" });
    const missingContext = input.placeholders.filter(({ context }) => context === "time").filter(({ name }) => !used.has(name)).map(({ name }) => name);
    return {
      trace,
      out: { ...empty, ...shared, model, calls, costPerRequest, p95, firstDiff, missingContext },
      metrics: { cost: Math.round(costPerRequest * 1e5) / 1e5, cacheRead: calls.reduce((sum, { read }) => sum + read, 0) },
    };
  },
};
