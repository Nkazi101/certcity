// Release bench for a prompt change. Three things happen to the learner's files:
// 1. The eval runner resolves the eval config twice (Monday's run and Thursday's rerun): model IDs, the notebook's
//    "default" model, prompt versions vs address@latest, and the case file with or without a pinned revision. Requests
//    carrying sampling parameters are rejected the way current Claude models reject them. Each case runs `trials`
//    times; the report gives the mean per slice and the run-to-run spread, then the gate decides promote or block.
// 2. The live cohort replay evaluates the rollback rule (rule-expression.ts) against 10-minute monitor windows.
// 3. A day of traffic goes through the routing rules: per-slice accuracy and spend against the budget.
import { list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import { compileExpression, evaluate, show } from "./rule-expression";
import type { Compiled } from "./rule-expression";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type Moving<T> = { monday: T; thursday: T };
export type ReleaseInput = {
  production: { model: string; prompt: string };
  candidate: string;
  /** The last prompt version that passed the gate. */
  lastGood: string;
  floor: number;
  models: readonly string[];
  prompts: readonly string[];
  latest: Moving<string>;
  defaultModel: Moving<string>;
  cases: { file: string; current: Moving<string>; revisions: Readonly<Record<string, readonly string[]>> };
  casesPerSlice: number;
  /** Correct answers out of casesPerSlice, per trial, keyed "model|prompt|slice". */
  results: Readonly<Record<string, readonly number[]>>;
  /** Monitor windows for the live cohort; weights are each slice's share of traffic (overall is traffic-weighted). */
  live: { cohort: string; weights: Readonly<Record<string, number>>; windows: readonly { at: string; slices: Readonly<Record<string, number>> }[] };
  traffic: {
    groups: readonly { slice: string; flagged_correction: boolean; chars: number; count: number }[];
    accuracy: Readonly<Record<string, Readonly<Record<string, number>>>>;
    costPerMessage: Readonly<Record<string, number>>;
    budget: number;
  };
};

export type Resolution = { model: string; prompt: string; cases: string };
export type ReleaseOut = {
  rejected: { message: string; source: TraceSource } | null;
  monday: Resolution | null;
  thursday: Resolution | null;
  trials: number;
  report: readonly { slice: string; mean: number; spread: number | null }[];
  gate: { decision: "promote" | "block"; expected: "promote" | "block"; lowest: { slice: string; mean: number } | null; unchecked: readonly string[] } | null;
  rollback: { firedAt: string | null; firedIndex: number | null; breachIndex: number | null; to: string | null; resolvedTo: string | null };
  routing: { slices: readonly { slice: string; accuracy: number }[]; cost: number; budget: number; unrouted: number };
  sources: { model: TraceSource; prompt: TraceSource; cases: TraceSource; trials: TraceSource; gate: TraceSource; rollback: TraceSource; routes: TraceSource };
};

type Route = { when: Compiled; model: string; index: number };
type Parsed = { evalFile: LocatedJson; routing: LocatedJson; routes: readonly Route[]; rollback: { when: Compiled; to: string } | null };

const sampling = ["temperature", "top_p", "top_k"];
const efforts = ["low", "medium", "high", "xhigh", "max"];
const percent = (value: number) => `${Math.round(value * 100)}%`;

export const releaseEvalEngine: Engine<Parsed, ReleaseInput, ReleaseOut> = {
  id: "anthropic.release-eval",
  provider: "anthropic",
  label: "Eval runner (Monday run + Thursday rerun) · live cohort monitor · routing day",
  simulated: false,
  parse(files) {
    const evalFile = parseLocatedJson(files.eval, "evals/address-release.json");
    if (evalFile.error !== undefined) return { ok: false, error: evalFile.error, source: { artifact: "eval" } };
    if (!record(evalFile.value.value)) return { ok: false, error: "evals/address-release.json must be a JSON object.", source: { artifact: "eval", line: 1 } };
    const routing = parseLocatedJson(files.routing, "config/address-routing.json");
    if (routing.error !== undefined) return { ok: false, error: routing.error, source: { artifact: "routing" } };
    const config = record(routing.value.value);
    if (!config) return { ok: false, error: "config/address-routing.json must be a JSON object.", source: { artifact: "routing", line: 1 } };
    const at = (...path: (string | number)[]) => ({ artifact: "routing", pointer: pointer(...path), line: lineOf(routing.value, pointer(...path)) });
    const routes: Route[] = [];
    for (const [index, entry] of list(config.routes).entries()) {
      const route = record(entry);
      if (!route || typeof route.when !== "string" || typeof route.model !== "string") return { ok: false, error: `routes[${index}] needs "when" (an expression) and "model".`, source: at("routes", index) };
      try {
        routes.push({ when: compileExpression(route.when), model: route.model, index });
      } catch (error) {
        return { ok: false, error: `routes[${index}].when cannot be read: ${(error as Error).message}.`, source: at("routes", index, "when") };
      }
    }
    const rollbackNode = record(config.rollback);
    let rollback: Parsed["rollback"] = null;
    if (rollbackNode) {
      if (typeof rollbackNode.when !== "string") return { ok: false, error: "rollback needs \"when\": an expression over the monitor window.", source: at("rollback") };
      try {
        rollback = { when: compileExpression(rollbackNode.when), to: text(rollbackNode.to) };
      } catch (error) {
        return { ok: false, error: `rollback.when cannot be read: ${(error as Error).message}.`, source: at("rollback", "when") };
      }
    }
    return { ok: true, value: { evalFile: evalFile.value, routing: routing.value, routes, rollback } };
  },
  run({ evalFile, routing, routes, rollback }, fixture: Fixture<ReleaseInput>): EngineRun<ReleaseOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const evalAt = (path: string): TraceSource => ({ artifact: "eval", pointer: path, line: lineOf(evalFile, path) });
    const routingAt = (path: string): TraceSource => ({ artifact: "routing", pointer: path, line: lineOf(routing, path) });
    const config = record(evalFile.value)!;
    const candidate = record(config.candidate) ?? {};
    const sources = {
      model: evalAt("/candidate/model"), prompt: evalAt("/candidate/prompt"), cases: evalAt("/cases"), trials: evalAt("/trials"), gate: evalAt("/gate"),
      rollback: routingAt("/rollback"), routes: routingAt("/routes"),
    };

    // --- 1. eval runner ---
    const resolve = (day: "monday" | "thursday"): Resolution | { error: string; source: TraceSource } => {
      const model = text(candidate.model);
      const prompt = text(candidate.prompt);
      const cases = text(config.cases);
      const resolvedModel = model === "default" ? input.defaultModel[day] : model;
      if (!input.models.includes(resolvedModel)) return { error: `404 not_found_error · model: ${model || "(missing)"}`, source: sources.model };
      const resolvedPrompt = prompt === "address@latest" ? input.latest[day] : prompt;
      if (!input.prompts.includes(resolvedPrompt)) return { error: `prompt registry · no prompt named ${prompt || "(missing)"}`, source: sources.prompt };
      const [file, revision] = cases.split("@");
      if (file !== input.cases.file) return { error: `case file ${cases || "(missing)"} not found`, source: sources.cases };
      const resolvedCases = revision ?? input.cases.current[day];
      if (!input.cases.revisions[resolvedCases]) return { error: `${file} has no revision ${revision}`, source: sources.cases };
      return { model: resolvedModel, prompt: resolvedPrompt, cases: resolvedCases };
    };
    const trialsValue = config.trials;
    const trials = typeof trialsValue === "number" && Number.isInteger(trialsValue) ? trialsValue : NaN;
    const samplingKey = Object.keys(candidate).find((key) => sampling.includes(key));
    const effort = candidate.effort;
    let rejected: ReleaseOut["rejected"] = null;
    const monday = resolve("monday");
    const thursday = resolve("thursday");
    if ("error" in monday) rejected = { message: monday.error, source: monday.source };
    else if (samplingKey) rejected = { message: `400 invalid_request_error · ${samplingKey}: not supported on ${monday.model}`, source: evalAt(pointer("candidate", samplingKey)) };
    else if (effort !== undefined && !efforts.includes(String(effort))) rejected = { message: `400 invalid_request_error · output_config.effort: ${JSON.stringify(effort)} is not one of ${efforts.join(", ")}`, source: evalAt("/candidate/effort") };
    else if (!(trials >= 1 && trials <= 8)) rejected = { message: "eval runner · trials must be a whole number from 1 to 8", source: sources.trials };
    const base = { monday: "error" in monday ? null : monday, thursday: "error" in thursday ? null : thursday };
    push({ actor: "learner-artifact", kind: "request", label: `Eval run · Monday · ${base.monday ? `${base.monday.model} · ${base.monday.prompt} · cases ${base.monday.cases}` : "could not resolve"}`, source: sources.model });

    let report: ReleaseOut["report"] = [];
    let gate: ReleaseOut["gate"] = null;
    if (rejected) push({ actor: "service", kind: "error", label: `The eval never ran: ${rejected.message}`, source: rejected.source, tone: "bad" });
    else {
      const resolved = base.monday!;
      const slices = input.cases.revisions[resolved.cases];
      report = slices.map((slice) => {
        const all = input.results[`${resolved.model}|${resolved.prompt}|${slice}`] ?? [0];
        const runs = Array.from({ length: trials }, (_, index) => all[index % all.length]);
        const mean = runs.reduce((total, value) => total + value, 0) / (runs.length * input.casesPerSlice);
        const spread = runs.length >= 2 ? (Math.max(...runs) - Math.min(...runs)) : null;
        push({ actor: "model", kind: "metric", label: `${slice} · ${percent(mean)} over ${trials} trial(s) of ${input.casesPerSlice} cases`,
          detail: `Correct per trial: ${runs.join(", ")}${spread === null ? " · spread not measured" : ` · spread ${spread} case(s)`}` });
        return { slice, mean, spread };
      });
      // Gate.
      const gateNode = record(config.gate) ?? {};
      const failing: string[] = [];
      const checked = new Set<string>();
      const floorFor = (slice: string) => typeof gateNode.every_slice_min_accuracy === "number" ? gateNode.every_slice_min_accuracy
        : typeof record(gateNode.slices)?.[slice] === "number" ? record(gateNode.slices)![slice] as number : null;
      for (const { slice, mean } of report) {
        const floor = floorFor(slice);
        if (floor === null) continue;
        checked.add(slice);
        if (mean < floor) failing.push(slice);
      }
      const overall = report.reduce((total, { mean }) => total + mean, 0) / Math.max(1, report.length);
      if (typeof gateNode.overall_min_accuracy === "number" && overall < gateNode.overall_min_accuracy) failing.push("overall");
      const decision = failing.length ? "block" as const : "promote" as const;
      const lowest = [...report].sort((left, right) => left.mean - right.mean)[0] ?? null;
      const expected = report.some(({ mean }) => mean < input.floor) ? "block" as const : "promote" as const;
      gate = { decision, expected, lowest, unchecked: report.map(({ slice }) => slice).filter((slice) => !checked.has(slice)) };
      push({ actor: "learner-artifact", kind: "decision", label: `Gate · ${decision === "block" ? `blocked on ${failing.join(", ")}` : `${resolved.prompt} promoted`}`,
        detail: gate.unchecked.length ? `No floor applied to: ${gate.unchecked.join(", ")}.` : undefined, source: sources.gate, tone: decision === expected ? "ok" : "bad" });
      if (base.thursday) {
        const same = base.thursday.model === resolved.model && base.thursday.prompt === resolved.prompt && base.thursday.cases === resolved.cases;
        push({ actor: "service", kind: "request", label: `Rerun · Thursday · ${base.thursday.model} · ${base.thursday.prompt} · cases ${base.thursday.cases}`,
          detail: same ? "Same setup as Monday." : "The rerun resolved to a different setup than Monday’s run.", source: sources.model, tone: same ? "ok" : "bad" });
      }
    }

    // --- 2. live cohort ---
    push({ actor: "service", kind: "request", label: `Live cohort on ${input.live.cohort} · monitor every 10 minutes`, source: sources.rollback });
    const breachIndex = input.live.windows.findIndex(({ slices }) => Object.values(slices).some((value) => value < input.floor));
    let firedIndex: number | null = null;
    for (const [index, window] of input.live.windows.entries()) {
      const values = Object.entries(window.slices);
      const data = {
        overall: { accuracy: values.reduce((total, [name, value]) => total + value * (input.live.weights[name] ?? 0), 0) / Math.max(1e-9, values.reduce((total, [name]) => total + (input.live.weights[name] ?? 0), 0)) },
        slice: Object.fromEntries(values.map(([name, accuracy]) => [name, { accuracy }])),
        slices: values.map(([name, accuracy]) => ({ name, accuracy })),
      };
      if (index === breachIndex) push({ actor: "service", kind: "metric", label: `${window.at} · ${values.filter(([, value]) => value < input.floor).map(([name, value]) => `${name} ${percent(value)}`).join(", ")} on the cohort`, tone: "warn" });
      if (rollback && firedIndex === null) {
        const verdict = evaluate(rollback.when, data);
        if (verdict.value === true) {
          firedIndex = index;
          push({ actor: "learner-artifact", kind: "decision", label: `${window.at} · rollback.when → true · cohort switched to ${rollback.to || "(no target)"}`,
            detail: verdict.seen.map(({ label, value }) => `${label} = ${show(typeof value === "number" ? Math.round(value * 100) / 100 : value)}`).join(" · "), source: sources.rollback });
        }
      }
    }
    const resolvedTo = rollback ? (rollback.to === "address@latest" ? input.latest.monday : rollback.to) : null;
    if (firedIndex === null) push({ actor: "service", kind: "output", label: `End of day · cohort still on ${input.live.cohort}`, tone: breachIndex >= 0 ? "bad" : "ok", source: sources.rollback });

    // --- 3. routing day ---
    const tally = new Map<string, { correct: number; total: number }>();
    let cost = 0;
    let unrouted = 0;
    const perModel = new Map<string, number>();
    for (const group of input.traffic.groups) {
      // Routing sees only what the app knows about a message, never its true slice.
      const features = { flagged_correction: group.flagged_correction, chars: group.chars };
      const route = routes.find(({ when }) => evaluate(when, features).value === true);
      const model = route && input.traffic.accuracy[route.model] ? route.model : null;
      const entry = tally.get(group.slice) ?? { correct: 0, total: 0 };
      entry.total += group.count;
      if (model) {
        entry.correct += group.count * (input.traffic.accuracy[model][group.slice] ?? 0);
        cost += group.count * input.traffic.costPerMessage[model];
        perModel.set(model, (perModel.get(model) ?? 0) + group.count);
      } else unrouted += group.count;
      tally.set(group.slice, entry);
    }
    const slices = [...tally].map(([slice, { correct, total }]) => ({ slice, accuracy: total ? correct / total : 0 }));
    push({ actor: "learner-artifact", kind: "decision", label: `Routing day · ${[...perModel].map(([model, count]) => `${count} → ${model}`).join(" · ") || "no route matched"}${unrouted ? ` · ${unrouted} unrouted` : ""}`, source: sources.routes });
    push({ actor: "service", kind: "metric", label: `Live accuracy · ${slices.map(({ slice, accuracy }) => `${slice} ${percent(accuracy)}`).join(" · ")} · spend $${cost.toFixed(2)} of $${input.traffic.budget.toFixed(2)}`,
      tone: slices.every(({ accuracy }) => accuracy >= input.floor) && cost <= input.traffic.budget && !unrouted ? "ok" : "bad", source: sources.routes });

    return { trace, out: { rejected, ...base, trials: Number.isFinite(trials) ? trials : 0, report, gate,
      rollback: { firedAt: firedIndex === null ? null : input.live.windows[firedIndex].at, firedIndex, breachIndex: breachIndex < 0 ? null : breachIndex, to: rollback?.to ?? null, resolvedTo },
      routing: { slices, cost, budget: input.traffic.budget, unrouted }, sources },
      metrics: { cost: Math.round(cost * 100) / 100 } };
  },
};
