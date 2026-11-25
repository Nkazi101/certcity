// Release-gate evaluation (provider-neutral): the learner's eval plan is executed against a labelled transcript corpus
// with planted regressions, then against a recorded canary week. Which regressions show up, what the reviewers spend,
// how a model judge is trusted, what the dashboard says and when the canary halts all follow from the plan as written.
import { list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

/** One labelled case. `trials` is the candidate's result per trial (P/F), repeated when the plan asks for more trials. */
export type EvalCase = { id: string; pattern?: string; trials: string; open?: { truth: "grounded" | "paraphrase" | "ungrounded"; judge: "P" | "F" } };
export type EvalSlice = { id: string; label: string; output: "field" | "open"; baseline: number; cases: readonly EvalCase[]; patternLabels?: Readonly<Record<string, string>> };
export type CanaryDay = { day: number; candidateAppeals: number; closuresPerAppeal: number; handleTime: number };
export type EvalInput = {
  candidate: string;
  slices: readonly EvalSlice[];
  /** Per calibration case: does the raw judge agree with the human label? */
  calibrationPool: readonly boolean[];
  reviewerLimit: number;
  minutesPerCase: number;
  handleTime: { current: number; candidate: number };
  appealsBound: number;
  canary: {
    volumePerDay: number;
    offices: readonly { name: string; share: number; appeals: number; volunteer: boolean }[];
    firstHourAppeals: number;
    baselineAppeals: number;
    minMeasured: number;
    days: readonly CanaryDay[];
  };
};

type Grader = "exact" | "judge" | "human" | "unknown";
type SlicePlan = { slice: string; sample: number | "all" | null; perPattern: number | null; trials: number; grader: Grader; floor: number | null; at: string };
type StopRule = { metric: string; slice: string; maxDrop: number | null; max: number | null; maxIncrease: number | null; action: string; at: string };
type Plan = {
  located: LocatedJson;
  slices: readonly SlicePlan[];
  judge: { cases: number; minAgreement: number; fallback: string } | null;
  report: string;
  canary: { assignment: string; share: number };
  stopRules: readonly StopRule[];
};

export type PatternResult = { slice: string; pattern: string; label: string; selected: number; detected: boolean; source: TraceSource };
export type SliceResult = { slice: string; measured: boolean; rate: number | null; baseline: number; floor: number | null; cases: number; trials: number; grader: string; source: TraceSource };
export type RuleTrigger = { rule: number; day: number; cause: "appeals" | "aggregate" | "closures" | "speed"; halts: boolean; source: TraceSource };

export type EvalOut = {
  slices: readonly SliceResult[];
  patterns: readonly PatternResult[];
  grounding: { inPlan: boolean; falsePass: readonly string[]; falseFail: readonly string[]; unseen: readonly string[]; ungraded: number; how: string; source: TraceSource };
  minutes: number;
  calibration: { cases: number; agreement: number | null; trusted: boolean } | null;
  dashboard: { mode: "per-slice" | "blended"; promoted: boolean; candidate?: number; current?: number; blockedBy: readonly string[]; regressedButPromoted: readonly string[]; source: TraceSource };
  canary: {
    comparable: boolean; candidateAppealsShare: number; currentAppealsShare: number; appealsPerDay: number;
    regressionDay: number | null; closureDay: number | null; triggers: readonly RuleTrigger[]; haltDay: number | null; source: TraceSource; rulesSource: TraceSource;
  };
  sources: { judge: TraceSource; slices: TraceSource };
};

const file = "eval-plan.json";
const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const two = (value: number) => value.toFixed(2);

function graderOf(value: unknown): Grader {
  const name = text(value).toLowerCase();
  if (/exact|match|code|program/.test(name)) return "exact";
  if (/judge|model|llm/.test(name)) return "judge";
  if (/human|review|people|person/.test(name)) return "human";
  return "unknown";
}

function parsePlan(source: string | undefined): { ok: true; plan: Plan } | { ok: false; error: string; line?: number } {
  const parsed = parseLocatedJson(source, file);
  if (parsed.error !== undefined) return { ok: false, error: parsed.error };
  const located = parsed.value;
  const root = record(located.value);
  if (!root) return { ok: false, error: `${file} must be a JSON object at the top level.`, line: 1 };
  if (!Array.isArray(root.slices)) return { ok: false, error: `${file} needs a "slices" array: one entry per slice of the corpus the gate measures.`, line: 1 };
  const slices = list(root.slices).map((entry, index): SlicePlan => {
    const item = record(entry) ?? {};
    const sample = item.sample === "all" ? "all" as const : num(item.sample);
    return {
      slice: text(item.slice).trim().toLowerCase(), sample, perPattern: num(item.per_pattern), trials: Math.max(0, Math.floor(num(item.trials) ?? 1)),
      grader: graderOf(item.grader), floor: num(item.pass_at_least), at: pointer("slices", index),
    };
  });
  const judgeRecord = record(root.judge);
  const judge = judgeRecord ? { cases: Math.max(0, Math.floor(num(judgeRecord.calibration_cases) ?? 0)), minAgreement: num(judgeRecord.min_agreement) ?? 0, fallback: text(judgeRecord.if_below).toLowerCase() } : null;
  const canaryRecord = record(root.canary) ?? {};
  const stopRules = list(root.stop_rules).map((entry, index): StopRule => {
    const item = record(entry) ?? {};
    return { metric: text(item.metric).toLowerCase(), slice: text(item.slice).toLowerCase(), maxDrop: num(item.max_drop), max: num(item.max), maxIncrease: num(item.max_increase),
      action: text(item.action).toLowerCase(), at: pointer("stop_rules", index) };
  });
  return { ok: true, plan: { located, slices, judge, report: text(root.report).toLowerCase(), canary: { assignment: text(canaryRecord.assignment).trim(), share: num(canaryRecord.share) ?? 0 }, stopRules } };
}

function select(slice: EvalSlice, plan: SlicePlan) {
  if (plan.perPattern !== null) {
    const byPattern = new Map<string, EvalCase[]>();
    for (const item of slice.cases) {
      const key = item.pattern ?? slice.id;
      byPattern.set(key, [...(byPattern.get(key) ?? []), item]);
    }
    return [...byPattern.values()].flatMap((cases) => cases.slice(0, Math.max(0, plan.perPattern!)));
  }
  if (plan.sample === "all") return [...slice.cases];
  return slice.cases.slice(0, Math.max(0, plan.sample ?? 0));
}

const truthOf = (item: EvalCase, trial: number): "P" | "F" => item.open ? (item.open.truth === "ungrounded" ? "F" : "P") : (item.trials[trial % item.trials.length] as "P" | "F");

export const evalGateEngine: Engine<Plan, EvalInput, EvalOut> = {
  id: "neutral.eval-gate",
  provider: "neutral",
  label: "Eval plan run over the labelled corpus, then the recorded canary week",
  simulated: false,
  parse(files) {
    const result = parsePlan(files.plan);
    return result.ok ? { ok: true, value: result.plan } : { ok: false, error: result.error, source: { artifact: "plan", line: result.line ?? 1 } };
  },
  run(plan, fixture: Fixture<EvalInput>): EngineRun<EvalOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const at = (where: string): TraceSource => ({ artifact: "plan", pointer: where, line: lineOf(plan.located, where) });
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    push({ actor: "learner-artifact", kind: "request", label: `${file} · ${plan.slices.length} slices · ${plan.stopRules.length} stop rules`, detail: `Corpus: ${input.slices.map(({ label, cases }) => `${label} (${cases.length})`).join(", ")}`, source: at("") });

    // Judge calibration runs once, before any slice it would grade.
    const usesJudge = plan.slices.some(({ grader, slice }) => grader === "judge" && input.slices.some(({ id }) => id === slice));
    let minutes = 0;
    let calibration: EvalOut["calibration"] = null;
    let judgeMode: "raw" | "trusted" | "human" | "ungraded" = "raw";
    if (usesJudge) {
      if (plan.judge && plan.judge.cases > 0) {
        const cases = Math.min(plan.judge.cases, input.calibrationPool.length);
        const agreement = input.calibrationPool.slice(0, cases).filter(Boolean).length / cases;
        const trusted = agreement >= plan.judge.minAgreement;
        minutes += cases * input.minutesPerCase;
        calibration = { cases, agreement, trusted };
        judgeMode = trusted ? "trusted" : /human|review/.test(plan.judge.fallback) ? "human" : "ungraded";
        push({ actor: "person", kind: "metric", label: `Judge calibration: reviewers labelled ${cases} cases (${cases * input.minutesPerCase} min); the judge agreed on ${pct(agreement)}`,
          detail: trusted ? `At or above your bar of ${pct(plan.judge.minAgreement)}: the judge grades alone.` : judgeMode === "human" ? `Below your bar of ${pct(plan.judge.minAgreement)}: judge slices go to reviewers.` : `Below your bar of ${pct(plan.judge.minAgreement)}, and the plan names no other grader: judge slices stay ungraded.`,
          source: at("/judge"), tone: trusted ? "ok" : "warn" });
      } else {
        calibration = null;
        push({ actor: "model", kind: "decision", label: "Model judge grades with no calibration against reviewers", source: at("/judge") });
      }
    }

    const sliceResults: SliceResult[] = [];
    const patterns: PatternResult[] = [];
    const grounding: EvalOut["grounding"] = { inPlan: false, falsePass: [], falseFail: [], unseen: [], ungraded: 0, how: "not in the plan", source: at("/slices") };
    const gradeOutputs: { slice: string; passes: number; total: number }[] = [];
    for (const slice of input.slices) {
      const planned = plan.slices.find(({ slice: name }) => name === slice.id);
      const source = planned ? at(planned.at) : at("/slices");
      if (!planned) {
        sliceResults.push({ slice: slice.id, measured: false, rate: null, baseline: slice.baseline, floor: null, cases: 0, trials: 0, grader: "none", source });
        push({ actor: "service", kind: "decision", label: `${slice.label}: not in the gate (0 of ${slice.cases.length} cases)`, source, tone: "warn" });
      } else {
        const chosen = select(slice, planned);
        const trials = slice.output === "open" ? 1 : Math.max(1, planned.trials);
        let grader: Grader | "ungraded" = planned.grader;
        if (grader === "judge" && judgeMode === "human") grader = "human";
        if (grader === "judge" && judgeMode === "ungraded") grader = "ungraded";
        if (grader === "human") minutes += chosen.length * input.minutesPerCase;
        let passes = 0;
        let total = 0;
        const failedCases = new Set<string>();
        if (grader !== "ungraded" && grader !== "unknown") {
          for (const item of chosen) {
            for (let trial = 0; trial < trials; trial++) {
              const truth = truthOf(item, trial);
              let graded = truth;
              if (item.open && grader === "exact") graded = item.open.truth === "grounded" ? "P" : "F";
              if (item.open && grader === "judge") graded = item.open.judge;
              total++;
              if (graded === "P") passes++;
              else failedCases.add(item.id);
              if (item.open) {
                if (graded === "P" && truth === "F") grounding.falsePass = [...grounding.falsePass, item.id];
                if (graded === "F" && truth === "P") grounding.falseFail = [...grounding.falseFail, item.id];
              }
            }
          }
        }
        const measured = total > 0;
        const rate = measured ? passes / total : null;
        if (measured) gradeOutputs.push({ slice: slice.id, passes, total });
        sliceResults.push({ slice: slice.id, measured, rate, baseline: slice.baseline, floor: planned.floor, cases: chosen.length, trials, grader: String(grader), source });
        const humanNote = grader === "human" ? ` · ${chosen.length * input.minutesPerCase} reviewer min` : "";
        push({ actor: grader === "human" ? "person" : grader === "judge" ? "model" : "service", kind: "metric",
          label: `${slice.label}: ${chosen.length} cases × ${trials} trial${trials === 1 ? "" : "s"}, graded by ${grader === "unknown" ? `“${planned.grader}” (no such grader)` : grader}${humanNote}`,
          detail: measured ? `Candidate ${pct(rate!)} · current ${pct(slice.baseline)}${planned.floor !== null ? ` · bar ${pct(planned.floor)}` : " · no bar set"}` : "No grades recorded.",
          source, tone: measured && rate! < slice.baseline - 0.02 ? "warn" : !measured ? "bad" : undefined });
        if (slice.output === "open") {
          grounding.inPlan = true;
          grounding.how = String(grader);
          grounding.source = source;
          grounding.ungraded = grader === "ungraded" || grader === "unknown" ? chosen.length : 0;
          const picked = new Set(chosen.map(({ id }) => id));
          grounding.unseen = slice.cases.filter((item) => item.open?.truth === "ungrounded" && !picked.has(item.id)).map(({ id }) => id);
          if (grounding.falsePass.length) push({ actor: "person", kind: "output", label: `Reviewer spot check: ${grounding.falsePass.length} handoff answers marked passing cite no record for their claims`, detail: grounding.falsePass.join(", "), source, tone: "bad" });
          if (grounding.falseFail.length) push({ actor: "person", kind: "output", label: `Reviewer spot check: ${grounding.falseFail.length} answers marked failing are correct, in different words`, detail: grounding.falseFail.join(", "), source, tone: "bad" });
        }
        // Planted regressions: one per pattern (or per slice without patterns).
        const keys = [...new Set(slice.cases.filter((item) => !item.open).map((item) => item.pattern ?? slice.id))];
        for (const key of keys) {
          const members = slice.cases.filter((item) => (item.pattern ?? slice.id) === key);
          if (!members.some((item) => item.trials.includes("F"))) continue;
          const selected = chosen.filter((item) => (item.pattern ?? slice.id) === key);
          const detected = selected.some((item) => failedCases.has(item.id));
          const label = slice.patternLabels?.[key] ?? slice.label;
          patterns.push({ slice: slice.id, pattern: key, label, selected: selected.length, detected, source });
          if (!detected) push({ actor: "service", kind: "output", label: `${label}: the candidate’s failures here do not appear in the gate (${selected.length} case${selected.length === 1 ? "" : "s"} selected)`, source, tone: "bad" });
        }
      }
      if (!planned && slice.output === "open") grounding.unseen = slice.cases.filter((item) => item.open?.truth === "ungrounded").map(({ id }) => id);
      if (!planned) {
        for (const key of [...new Set(slice.cases.filter((item) => !item.open && item.trials.includes("F")).map((item) => item.pattern ?? slice.id))]) {
          patterns.push({ slice: slice.id, pattern: key, label: slice.patternLabels?.[key] ?? slice.label, selected: 0, detected: false, source });
        }
      }
    }
    push({ actor: "person", kind: "metric", label: `Reviewer minutes: ${minutes} of ${input.reviewerLimit}`, source: at("/slices"), tone: minutes > input.reviewerLimit ? "bad" : "ok" });

    // The release dashboard and the gate decision.
    const blended = /blend|single|composite|one/.test(plan.report);
    const measured = sliceResults.filter(({ measured: isMeasured }) => isMeasured);
    const regressed = measured.filter(({ rate, baseline }) => rate! < baseline - 0.02).map(({ slice }) => slice);
    let dashboard: EvalOut["dashboard"];
    if (blended) {
      const passes = gradeOutputs.reduce((sum, { passes: value }) => sum + value, 0);
      const total = gradeOutputs.reduce((sum, { total: value }) => sum + value, 0);
      const baselineQuality = total ? gradeOutputs.reduce((sum, { slice, total: value }) => sum + value * input.slices.find(({ id }) => id === slice)!.baseline, 0) / total : 1;
      const quality = total ? passes / total : 1;
      const candidate = 0.5 * quality + 0.5 * Math.min(1, 8 / input.handleTime.candidate);
      const current = 0.5 * baselineQuality + 0.5 * Math.min(1, 8 / input.handleTime.current);
      const promoted = candidate >= current;
      dashboard = { mode: "blended", promoted, candidate, current, blockedBy: promoted ? [] : ["blended score"], regressedButPromoted: promoted ? regressed : [], source: at("/report") };
      push({ actor: "service", kind: "decision", label: `Release dashboard: blended score ${two(candidate)} for ${input.candidate}, ${two(current)} for current → ${promoted ? "promote" : "hold"}`,
        detail: "One line: quality and handle time folded into a single number.", source: at("/report"), tone: promoted && regressed.length ? "bad" : undefined });
    } else {
      const blockedBy = measured.filter(({ rate, floor }) => floor !== null && rate! < floor).map(({ slice }) => slice);
      const promoted = blockedBy.length === 0;
      dashboard = { mode: "per-slice", promoted, blockedBy, regressedButPromoted: promoted ? regressed : [], source: at("/report") };
      push({ actor: "service", kind: "decision", label: `Release dashboard: ${measured.length} lines, one per slice → ${promoted ? "promote" : `hold (${blockedBy.join(", ")} below bar)`}`,
        source: at("/report"), tone: promoted && regressed.length ? "bad" : promoted ? undefined : "ok" });
    }

    // The canary rehearsal: last week's recorded traffic replayed under the plan's assignment and stop rules.
    const { canary } = input;
    const global = canary.offices.reduce((sum, office) => sum + office.share * office.appeals, 0);
    const assignment = plan.canary.assignment.toLowerCase();
    let candidateShare = global;
    if (assignment.startsWith("office")) {
      const name = assignment.split(/[:=]/)[1]?.trim();
      candidateShare = canary.offices.find((office) => office.name.toLowerCase() === name)?.appeals ?? 0;
    } else if (/volunteer/.test(assignment)) {
      const volunteers = canary.offices.filter(({ volunteer }) => volunteer);
      candidateShare = volunteers.reduce((sum, office) => sum + office.share * office.appeals, 0) / Math.max(1e-9, volunteers.reduce((sum, { share }) => sum + share, 0));
    } else if (/first|hour|morning|window/.test(assignment)) candidateShare = canary.firstHourAppeals;
    else if (!/random|lottery|hash/.test(assignment)) candidateShare = 0;
    const comparable = Math.abs(candidateShare - global) <= 0.02;
    const requests = Math.round(canary.volumePerDay * Math.max(0, plan.canary.share));
    const appealsPerDay = Math.round(requests * candidateShare);
    const canarySource = at("/canary");
    push({ actor: "service", kind: "decision", label: `Canary (${plan.canary.assignment || "no assignment"}, ${pct(plan.canary.share)}): ${requests} requests a day to ${input.candidate}, ${appealsPerDay} of them appeals`,
      detail: `Appeals are ${pct(candidateShare)} of the candidate arm’s traffic and ${pct(global)} of current’s.`, source: canarySource, tone: comparable ? undefined : "warn" });
    let regressionDay: number | null = null;
    let closureDay: number | null = null;
    const triggers: RuleTrigger[] = [];
    for (const day of canary.days) {
      const observable = appealsPerDay >= canary.minMeasured;
      const closures = Math.floor(appealsPerDay * day.closuresPerAppeal + 1e-9);
      if (regressionDay === null && canary.baselineAppeals - day.candidateAppeals > input.appealsBound && appealsPerDay > 0) regressionDay = day.day;
      if (closureDay === null && closures > 0) closureDay = day.day;
      const aggregateCandidate = requests ? (day.candidateAppeals * appealsPerDay + (requests - appealsPerDay)) / requests : 1;
      const aggregateCurrent = canary.baselineAppeals * global + (1 - global);
      push({ actor: "model", kind: "metric", label: `Day ${day.day}: handle time ${day.handleTime} min (current ${input.handleTime.current}) · appeals escalation ${observable ? pct(day.candidateAppeals) : `not reported (${appealsPerDay} appeals)`} · unauthorized closures ${closures}`,
        tone: closures > 0 || (observable && canary.baselineAppeals - day.candidateAppeals > input.appealsBound) ? "warn" : undefined });
      plan.stopRules.forEach((rule, index) => {
        if (triggers.some(({ rule: fired }) => fired === index)) return;
        let cause: RuleTrigger["cause"] | null = null;
        if (/escalat|appeal/.test(rule.metric)) {
          if (rule.slice && /appeal/.test(rule.slice)) { if (observable && rule.maxDrop !== null && canary.baselineAppeals - day.candidateAppeals > rule.maxDrop) cause = "appeals"; }
          else if (rule.maxDrop !== null && aggregateCurrent - aggregateCandidate > rule.maxDrop) cause = "aggregate";
        } else if (/closure/.test(rule.metric)) {
          if (closures > (rule.max ?? 0)) cause = "closures";
        } else if (/handle|latency|speed|time/.test(rule.metric)) {
          if (rule.maxIncrease !== null && (day.handleTime - input.handleTime.current) / input.handleTime.current > rule.maxIncrease) cause = "speed";
        }
        if (!cause) return;
        const halts = /halt|stop|rollback|roll back|pause/.test(rule.action);
        triggers.push({ rule: index, day: day.day, cause, halts, source: at(rule.at) });
        push({ actor: "learner-artifact", kind: "decision", label: `Stop rule ${index + 1} (${rule.metric}${rule.slice ? ` · ${rule.slice}` : ""}) fires on day ${day.day} → ${halts ? "halt" : rule.action || "no action"}`, source: at(rule.at), tone: halts ? "ok" : "warn" });
      });
    }
    const haltDay = triggers.filter(({ halts }) => halts).reduce<number | null>((min, { day }) => min === null || day < min ? day : min, null);
    push({ actor: "service", kind: "output", label: haltDay !== null ? `Canary halted on day ${haltDay}` : `Canary ran all ${canary.days.length} days; promotion continues to every office`, source: at("/stop_rules"),
      tone: haltDay === null && (regressionDay !== null || closureDay !== null) ? "bad" : undefined });

    const out: EvalOut = {
      slices: sliceResults, patterns, grounding, minutes, calibration, dashboard,
      canary: { comparable, candidateAppealsShare: candidateShare, currentAppealsShare: global, appealsPerDay, regressionDay, closureDay, triggers, haltDay, source: canarySource, rulesSource: at("/stop_rules") },
      sources: { judge: at("/judge"), slices: at("/slices") },
    };
    return { trace, out, metrics: { minutes, caught: patterns.filter(({ detected }) => detected).length, planted: patterns.length } };
  },
};
