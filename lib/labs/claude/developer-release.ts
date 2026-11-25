// Developer Foundations · developer-release. The learner writes the release eval config (pinned model, prompt version
// and case revision; trials per case; the slice gate) and the live routing config (which model each message goes to,
// and the rule that rolls a cohort back). The engine runs the eval on Monday and reruns it on Thursday, replays the
// cohort's monitor windows and routes a day of traffic. Transfer (revise): a later candidate on a case set with a new
// slice, either regressing on that slice or clean.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { releaseEvalEngine } from "../engines/release-eval";
import type { ReleaseInput, ReleaseOut } from "../engines/release-eval";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const models = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const prompts = ["address-v16", "address-v17", "address-v18", "address-v19", "address-v21", "address-v22", "address-v23"];
const byPrompt: Record<string, Record<string, readonly number[]>> = {
  "address-v16": { routine: [8, 9, 8], correction: [7, 8, 7], po_box: [7, 8, 8] },
  "address-v17": { routine: [9, 9, 9], correction: [8, 9, 8], po_box: [8, 8, 9] },
  "address-v18": { routine: [9, 9, 8], correction: [4, 5, 5], po_box: [8, 8, 8] },
  "address-v19": { routine: [9, 10, 9], correction: [6, 6, 7], po_box: [8, 9, 8] },
  "address-v21": { routine: [9, 9, 10], correction: [8, 9, 8], po_box: [7, 7, 6] },
  "address-v22": { routine: [9, 9, 9], correction: [8, 9, 8], po_box: [9, 8, 9] },
  "address-v23": { routine: [9, 9, 9], correction: [9, 8, 8], po_box: [8, 8, 8] },
};
const modelDelta: Record<string, number> = { "claude-haiku-5-5": -2, "claude-sonnet-5-5": 0, "claude-opus-5-5": 1 };
const results = Object.fromEntries(models.flatMap((model) => Object.entries(byPrompt).flatMap(([prompt, slices]) =>
  Object.entries(slices).map(([slice, runs]) => [`${model}|${prompt}|${slice}`, runs.map((value) => Math.max(0, Math.min(10, value + modelDelta[model])))]))));
const accuracy = {
  "claude-haiku-5-5": { routine: 0.74, correction: 0.30, po_box: 0.60 },
  "claude-sonnet-5-5": { routine: 0.92, correction: 0.52, po_box: 0.86 },
  "claude-opus-5-5": { routine: 0.94, correction: 0.90, po_box: 0.90 },
};
const costPerMessage = { "claude-haiku-5-5": 0.00027, "claude-sonnet-5-5": 0.0054, "claude-opus-5-5": 0.0108 };
const group = (slice: string, flagged: boolean, chars: number, count: number) => ({ slice, flagged_correction: flagged, chars, count });
const windows = (series: Readonly<Record<string, readonly number[]>>, start = 9) => Array.from({ length: Object.values(series)[0].length }, (_, index) => ({
  at: `${String(start + Math.floor(index / 6)).padStart(2, "0")}:${String((index % 6) * 10).padStart(2, "0")}`,
  slices: Object.fromEntries(Object.entries(series).map(([slice, values]) => [slice, values[index]])),
}));
const shared = { production: { model: "claude-sonnet-5-5", prompt: "address-v17" }, lastGood: "address-v17", floor: 0.8, models, prompts, results, casesPerSlice: 10,
  defaultModel: { monday: "claude-sonnet-5-5", thursday: "claude-haiku-5-5" } };
const casesFile = "evals/address-cases.jsonl";

const week47: ReleaseInput = {
  ...shared, candidate: "address-v18",
  latest: { monday: "address-v18", thursday: "address-v19" },
  cases: { file: casesFile, current: { monday: "r12", thursday: "r13" }, revisions: { r12: ["routine", "correction"], r13: ["routine", "correction"] } },
  live: { cohort: "address-v18", weights: { routine: 0.9, correction: 0.1 }, windows: windows({
    routine: [0.91, 0.92, 0.91, 0.90, 0.91, 0.92, 0.91, 0.91, 0.90, 0.92, 0.91, 0.91],
    correction: [0.86, 0.85, 0.84, 0.47, 0.45, 0.48, 0.44, 0.46, 0.45, 0.47, 0.46, 0.45],
  }) },
  traffic: { budget: 6.3, accuracy, costPerMessage, groups: [
    group("routine", false, 300, 630), group("routine", false, 900, 261), group("routine", true, 300, 9),
    group("correction", true, 300, 62), group("correction", true, 900, 34), group("correction", false, 300, 3), group("correction", false, 900, 1),
  ] },
};
const r14 = { file: casesFile, current: { monday: "r14", thursday: "r15" }, revisions: { r14: ["routine", "correction", "po_box"], r15: ["routine", "correction", "po_box"] } };
const poBox: ReleaseInput = {
  ...shared, candidate: "address-v21", latest: { monday: "address-v21", thursday: "address-v23" }, cases: r14,
  live: { cohort: "address-v21", weights: { routine: 0.8, correction: 0.15, po_box: 0.05 }, windows: windows({
    routine: [0.90, 0.91, 0.90, 0.91, 0.90, 0.91, 0.90, 0.91, 0.90, 0.91],
    correction: [0.85, 0.84, 0.86, 0.85, 0.84, 0.85, 0.86, 0.84, 0.85, 0.86],
    po_box: [0.88, 0.86, 0.87, 0.85, 0.66, 0.62, 0.64, 0.61, 0.63, 0.62],
  }, 13) },
  traffic: { budget: 6.6, accuracy, costPerMessage, groups: [
    group("routine", false, 300, 560), group("routine", false, 900, 234), group("routine", true, 300, 6),
    group("correction", true, 300, 94), group("correction", true, 900, 50), group("correction", false, 300, 6),
    group("po_box", false, 300, 50),
  ] },
};
const clean: ReleaseInput = {
  ...shared, candidate: "address-v22", latest: { monday: "address-v22", thursday: "address-v23" }, cases: r14,
  live: { cohort: "address-v22", weights: { routine: 0.83, correction: 0.12, po_box: 0.05 }, windows: windows({
    routine: [0.90, 0.91, 0.90, 0.91, 0.92, 0.91, 0.90, 0.91, 0.90, 0.91],
    correction: [0.84, 0.83, 0.85, 0.84, 0.82, 0.84, 0.85, 0.83, 0.84, 0.85],
    po_box: [0.88, 0.87, 0.86, 0.88, 0.87, 0.86, 0.88, 0.87, 0.86, 0.88],
  }, 10) },
  traffic: { budget: 6.4, accuracy, costPerMessage, groups: [
    group("routine", false, 300, 600), group("routine", false, 900, 225), group("routine", true, 300, 5),
    group("correction", true, 300, 70), group("correction", true, 900, 45), group("correction", false, 900, 5),
    group("po_box", false, 300, 50),
  ] },
};

const fixtures: Fixture<ReleaseInput>[] = [
  { id: "v18", name: "Prompt v18 release week", set: "sample", situation: "Candidate address-v18: Monday’s eval, Thursday’s rerun, a live cohort since Tuesday and a day of routed traffic.", input: week47 },
  { id: "v21", name: "Prompt v21 release week", set: "transfer", variant: "po-box", situation: "A later candidate, a case set with a PO-box slice, its cohort and a heavier correction day.", input: poBox },
  { id: "v22", name: "Prompt v22 release week", set: "transfer", variant: "clean", situation: "A later candidate on the same three-slice case set, its cohort and a routine day.", input: clean },
];

const evalFile = ({ model = "claude-sonnet-5-5", prompt = "address-v18", effort = "high" as string | null, cases = `${casesFile}@r12`, trials = 3 as unknown, gate = { every_slice_min_accuracy: 0.8 } as Record<string, unknown>, extra = {} as Record<string, unknown> } = {}) =>
  compactJson({ candidate: { model, prompt, ...(effort && { effort }), ...extra }, cases, trials, gate });
const flaggedRoutes = [{ when: "flagged_correction", model: "claude-opus-5-5" }, { when: "true", model: "claude-sonnet-5-5" }];
const routingFile = ({ routes = flaggedRoutes as unknown[], rollback = { when: "min(slices[].accuracy) < 0.8", to: "address-v17" } as Record<string, unknown> | null } = {}) =>
  compactJson({ prompt: "address-v17", routes, ...(rollback && { rollback }) });
const referenceFor = (candidate: string, cases: string): LabFiles => ({ eval: evalFile({ prompt: candidate, cases }), routing: routingFile() });
const sampleRef = referenceFor("address-v18", `${casesFile}@r12`);
// Deployed: the notebook demo's setup (default model, latest prompt, temperature 0, one run), a routine-only gate with
// a low bar, every message on the stronger model, and a rollback watching overall accuracy toward "latest".
const starter: LabFiles = {
  eval: compactJson({ candidate: { model: "default", prompt: "address@latest", temperature: 0 }, cases: casesFile, trials: 1, gate: { slices: { routine: 0.4 } } }),
  routing: routingFile({ routes: [{ when: "true", model: "claude-opus-5-5" }], rollback: { when: "overall.accuracy < 0.8", to: "address@latest" } }),
};

type C = Check<ReleaseInput, ReleaseOut>;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const neverRan = (out: ReleaseOut) => out.rejected ? { passed: false, symptom: `The eval never ran: ${out.rejected.message}.`, source: out.rejected.source } : null;
const checks: C[] = [
  {
    id: "rerun-pinned", objective: "2.6", title: "Thursday’s rerun reproduces Monday’s exact setup for the candidate",
    diagnosis: "A comparison is reproducible only when everything that can change behavior is recorded as a version: the exact model ID (not whatever a notebook defaults to), the prompt version (not “latest”), and the revision of the eval cases. Pin them together in the config the release review reruns.",
    hints: hints("Compare the Monday and Thursday lines in the trace: which part of the setup moved between them?",
      "Versioned configuration: candidate.model is an exact model ID, candidate.prompt names one prompt version, and cases names a file revision (file@revision). Then a rerun next week, or a rollback, returns to a known state.",
      "A lab replicating an experiment records the reagent lot number and the instrument’s calibration, not “the usual chemicals”."),
    reveal: "\"candidate\": { \"model\": \"claude-sonnet-5-5\", \"prompt\": \"address-v18\", … }, \"cases\": \"evals/address-cases.jsonl@r12\"",
    evaluate: ({ out }, fixture) => {
      const failed = neverRan(out);
      if (failed) return failed;
      const monday = out.monday!;
      const thursday = out.thursday;
      if (monday.prompt !== fixture.input.candidate) return { passed: false, symptom: `The eval tested ${monday.prompt}, not the release candidate ${fixture.input.candidate}.`, source: out.sources.prompt };
      if (monday.model !== fixture.input.production.model) return { passed: false, symptom: `The eval ran on ${monday.model}; the candidate ships on ${fixture.input.production.model}.`, source: out.sources.model };
      if (!thursday || thursday.model !== monday.model || thursday.prompt !== monday.prompt || thursday.cases !== monday.cases) {
        const source = !thursday || thursday.model !== monday.model ? out.sources.model : thursday.prompt !== monday.prompt ? out.sources.prompt : out.sources.cases;
        return { passed: false, source, symptom: `Thursday’s rerun used ${thursday ? `${thursday.model}, ${thursday.prompt} and cases ${thursday.cases}` : "a setup that no longer resolves"}; Monday’s used ${monday.model}, ${monday.prompt} and cases ${monday.cases}. The two reports compare different setups.` };
      }
      return { passed: true, symptom: `Monday and Thursday both ran ${monday.model} · ${monday.prompt} · cases ${monday.cases}.` };
    },
  },
  {
    id: "variance-observed", objective: "5.1", title: "The report shows how much results vary from run to run",
    diagnosis: "Model outputs are nondeterministic: the same case can be labelled differently on another run, and current models do not take temperature, top_p or top_k to force sameness. Measure variability by running every case several times under the pinned setup and reporting the spread.",
    hints: hints("Read the slice lines in the trace: how many trials ran, and what spread does the report show?",
      "LLM fundamentals for evaluation: repeat trials of the same case (at least two, usually three or more) to see run-to-run spread; one run cannot separate a real change from noise. Sampling parameters are rejected by current models, so they are not the tool for this.",
      "A coffee shop testing a new grinder pulls several shots per setting, because one shot could be a fluke."),
    reveal: "\"trials\": 3 (any whole number from 2 to 8), and no temperature in the candidate.",
    evaluate: ({ out }) => {
      const failed = neverRan(out);
      if (failed) return failed;
      if (out.trials < 2) return { passed: false, symptom: "Each case ran once, so the report shows no run-to-run spread and the release contract does not count the result.", source: out.sources.trials };
      return { passed: true, symptom: `${out.trials} trials per case · spread ${out.report.map(({ slice, spread }) => `${slice} ${spread}`).join(", ")} case(s).` };
    },
  },
  {
    id: "slice-gate", objective: "2.2", title: "A candidate under the bar on any slice is blocked, and one that clears every slice is promoted",
    diagnosis: "Release gates check each slice of representative data against its own bar. A candidate can hold on routine traffic and collapse on an edge slice; a routine-only, named-slice or average gate hides that. Encode the contract exactly: the same floor on every slice the case set contains.",
    hints: hints("Read the gate line and the slice lines above it. Which slice decided the outcome, and which slices had no floor at all?",
      "Slice-level evaluation: translate the release contract (at least 80% on every slice) into the gate literally, so a slice added to the cases next quarter is gated too. Do not set the bar from what the candidate happened to score.",
      "A new spam filter is tested on ordinary mail and on newsletters separately, each with its own pass mark; it can be fine on one and bury the other."),
    reveal: "\"gate\": { \"every_slice_min_accuracy\": 0.8 }",
    evaluate: ({ out }) => {
      const failed = neverRan(out);
      if (failed) return failed;
      const gate = out.gate!;
      const prompt = out.monday!.prompt;
      if (gate.decision === gate.expected) return { passed: true, symptom: gate.decision === "block" ? `${prompt} was blocked: ${gate.lowest!.slice} scored ${pct(gate.lowest!.mean)}.` : `${prompt} was promoted; every slice cleared the bar.` };
      return { passed: false, source: out.sources.gate, symptom: gate.decision === "promote"
        ? `The gate promoted ${prompt} although ${gate.lowest!.slice} scored ${pct(gate.lowest!.mean)}, under the contract’s bar.`
        : `The gate blocked ${prompt} although every slice met the contract’s bar (lowest: ${gate.lowest!.slice} ${pct(gate.lowest!.mean)}).` };
    },
  },
  {
    id: "live-rollback", objective: "2.2", title: "A live cohort that slips on any slice returns to the last good version within minutes",
    diagnosis: "When a live change regresses, roll back first to the last configuration that passed the gate, then investigate. Watch every slice, not overall accuracy, which a small slice barely moves; and point the rollback at a fixed version, not at a moving pointer that may be the regressing version itself.",
    hints: hints("Find the monitor line where a slice dropped, then the rollback lines. Did the rule fire, when, and where did it send the cohort?",
      "Rollback to a versioned configuration: a rule over each slice (for example the minimum slice accuracy) compared with the contract’s bar, and a target that names the last version that passed the gate.",
      "A website deploy that breaks checkout is reverted to yesterday’s build within minutes, even though the home page still loads fine."),
    reveal: "\"rollback\": { \"when\": \"min(slices[].accuracy) < 0.8\", \"to\": \"address-v17\" }",
    evaluate: ({ out }, fixture) => {
      const { firedIndex, breachIndex, firedAt, to, resolvedTo } = out.rollback;
      const { windows: live, cohort } = fixture.input.live;
      if (breachIndex === null) return firedIndex === null ? { passed: true, symptom: `The cohort stayed on ${cohort}: no slice fell under the bar.` }
        : { passed: false, symptom: `The cohort was switched back at ${firedAt} although every slice stayed above the bar all day.`, source: out.sources.rollback };
      const breach = live[breachIndex];
      const slice = Object.entries(breach.slices).find(([, value]) => value < fixture.input.floor)![0];
      if (firedIndex === null) return { passed: false, symptom: `${slice} on the cohort fell to ${pct(breach.slices[slice])} at ${breach.at} and stayed there; nothing switched back.`, source: out.sources.rollback };
      if (firedIndex < breachIndex) return { passed: false, symptom: `The cohort was switched back at ${firedAt}, before any slice fell under the bar.`, source: out.sources.rollback };
      if (firedIndex > breachIndex + 1) return { passed: false, symptom: `The cohort switched back at ${firedAt}, ${(firedIndex - breachIndex) * 10} minutes after ${slice} fell under the bar at ${breach.at}.`, source: out.sources.rollback };
      if (resolvedTo !== fixture.input.lastGood) return { passed: false, source: out.sources.rollback, symptom: resolvedTo === cohort
        ? `At ${firedAt} the cohort “switched” to ${to}, which is ${cohort} itself.` : `At ${firedAt} the cohort switched to ${to || "no version"}, which has not passed the gate.` };
      return { passed: true, symptom: `At ${firedAt} the cohort went back to ${resolvedTo}.` };
    },
  },
  {
    id: "routing", objective: "5.3", title: "Every slice meets the bar live, within the routing budget",
    diagnosis: "Model routing sends each request to the cheapest model that meets its quality bar, using a signal you have validated. Escalating everything blows the budget; routing by a proxy such as message length sends hard cases to the weaker model; one cheap model for everything misses the hard slice.",
    hints: hints("Read the routing-day lines: how many messages went to each model, the accuracy per slice, and the spend.",
      "Routes are checked in order and the first matching “when” wins. Send what the validated matching rule flags to the stronger model and everything else to the standard model; compare the result with the routing trial’s accuracy table and the budget.",
      "A clinic sends routine refills to the nurse line and only the refills the triage form marks urgent to a physician."),
    reveal: "\"routes\": [{ \"when\": \"flagged_correction\", \"model\": \"claude-opus-5-5\" }, { \"when\": \"true\", \"model\": \"claude-sonnet-5-5\" }]",
    evaluate: ({ out }, fixture) => {
      const { slices, cost, budget, unrouted } = out.routing;
      if (unrouted) return { passed: false, symptom: `${unrouted} messages matched no route and were never answered.`, source: out.sources.routes };
      const low = slices.find(({ accuracy: value }) => value < fixture.input.floor);
      if (low) return { passed: false, symptom: `${low.slice} came out ${pct(low.accuracy)} right on the live day.`, source: out.sources.routes };
      if (cost > budget) return { passed: false, symptom: `The day cost $${cost.toFixed(2)} against a $${budget.toFixed(2)} budget.`, source: out.sources.routes };
      return { passed: true, symptom: `${slices.map(({ slice, accuracy: value }) => `${slice} ${pct(value)}`).join(", ")} for $${cost.toFixed(2)} of $${budget.toFixed(2)}.` };
    },
  },
];

function effects(runs: readonly LabRunFixture<ReleaseInput, ReleaseOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out) return [];
    const gate = out.gate;
    return [
      { kind: "tray" as const, item: `${fixture.input.candidate} release`, to: !gate ? "failed" as const : gate.decision !== gate.expected ? "leaked" as const : gate.decision === "block" ? "held" as const : "posted" as const },
      { kind: "tray" as const, item: `${fixture.input.live.cohort} cohort`, to: out.rollback.breachIndex === null ? "posted" as const : out.rollback.resolvedTo === fixture.input.lastGood ? "held" as const : "failed" as const },
      { kind: "meter" as const, id: `${fixture.id}-spend`, label: "routing spend for the day", value: Math.round(out.routing.cost * 100) / 100, limit: out.routing.budget, unit: "$", better: "lower" as const },
    ];
  });
}

const percentTable = (rows: Record<string, Record<string, number>>, slices: readonly string[]) =>
  [`model              ${slices.map((slice) => slice.padEnd(11)).join("")}cost/message`, ...Object.entries(rows).map(([model, values]) =>
    `${model.padEnd(19)}${slices.map((slice) => pct(values[slice]).padEnd(11)).join("")}$${costPerMessage[model as keyof typeof costPerMessage]}`)].join("\n");
function weekDocuments(input: ReleaseInput, intro: string): LabDocument[] {
  const slices = input.cases.revisions[input.cases.current.monday];
  const routine = input.traffic.groups.filter(({ slice }) => slice === "routine");
  const corrections = input.traffic.groups.filter(({ slice }) => slice === "correction");
  const sum = (groups: typeof routine, test: (entry: (typeof routine)[number]) => boolean = () => true) => groups.filter(test).reduce((total, { count }) => total + count, 0);
  const total = sum([...input.traffic.groups]);
  return [
    { id: `${input.candidate}-record`, title: "Release record", text: `${intro} Production: prompt ${input.production.prompt} (the last version that passed the gate), standard model ${input.production.model}. Release candidate: prompt ${input.candidate} on ${input.production.model}; it has been live for a small cohort since this morning. The notebook demo ran on the notebook’s default model with address@latest, temperature 0 and one run.` },
    { id: `${input.candidate}-registry`, title: "Registry this week", format: "code", text: `Models: ${models.join(", ")} · notebook "default" → ${input.defaultModel.monday} (the platform team switches it on Wednesday)\nPrompts: ${prompts.filter((prompt) => prompt <= input.latest.monday).join(", ")} · address@latest → ${input.latest.monday} (moves on every merge)\nCases: ${casesFile} → revision ${input.cases.current.monday} (${slices.join(", ")}; ${input.casesPerSlice} cases per slice); another revision lands Wednesday` },
    { id: `${input.candidate}-trial`, title: "Routing trial (Simon Wu)", format: "code", text: `Accuracy with ${input.production.prompt}, and cost per message:\n${percentTable(accuracy, slices)}\n\nA day is about ${total} messages: ${sum(routine)} routine, ${sum(corrections)} corrections${slices.includes("po_box") ? `, ${total - sum(routine) - sum(corrections)} PO-box` : ""}. Budget: $${input.traffic.budget.toFixed(2)} per day.\nThe matching rule (flagged_correction) flags ${sum(corrections, ({ flagged_correction: flagged }) => flagged)} of the corrections and ${sum(routine, ({ flagged_correction: flagged }) => flagged)} routine messages. Long messages (chars > 600) are ${Math.round(sum(routine, ({ chars }) => chars > 600) / sum(routine) * 100)}% of routine and ${Math.round(sum(corrections, ({ chars }) => chars > 600) / sum(corrections) * 100)}% of corrections.` },
  ];
}
const contract: LabDocument = { id: "contract", title: "Release contract", text: "Every slice of the address cases must keep at least 80% accuracy, and a result counts only once its run-to-run variability has been observed. A live cohort that falls under the bar on any slice goes back to the last version that passed the gate within 10 minutes. The release review reruns the eval on Thursday and must get the same setup." };
const runnerNotes: LabDocument = { id: "runner", title: "Eval runner and routing config · how your files are used", text: "evals/address-release.json — candidate: { model, prompt, effort? } is sent to the Messages API for every case (any other request field is sent as-is). model: a model ID, or \"default\". prompt: a version such as address-v17, or address@latest. cases: evals/address-cases.jsonl (whatever revision is current) or evals/address-cases.jsonl@<revision>. trials: 1–8 runs of every case. gate: { every_slice_min_accuracy } or { slices: { <slice>: floor } } or { overall_min_accuracy } (fractions, 0–1).\nconfig/address-routing.json — routes are checked in order; the first whose \"when\" is true picks the model. \"when\" sees flagged_correction (true/false) and chars. rollback.when is checked on every 10-minute monitor window of the live cohort, which provides overall.accuracy (traffic-weighted), slice.<name>.accuracy and slices[] ({ name, accuracy }); the first time it is true, the cohort switches to rollback.to. Rule language: paths, min(), max(), sum(), abs(), == != < <= > >= && || !, numbers, \"strings\", true, false." };

const withEval = (options: Parameters<typeof evalFile>[0]): LabFiles => ({ ...sampleRef, eval: evalFile(options) });
const withRouting = (options: Parameters<typeof routingFile>[0], base: LabFiles = sampleRef): LabFiles => ({ ...base, routing: routingFile(options) });
const poBoxRef = referenceFor("address-v21", `${casesFile}@r14`);

export const developerReleaseLab: LabMission<unknown, ReleaseInput, ReleaseOut> = {
  id: "developer-release",
  provider: "anthropic",
  track: "developer-foundations",
  objectives: ["2.2", "2.6", "5.1", "5.3"],
  station: "Release test bench",
  speaker: "Priya Shah",
  opening: "The new prompt passed the demo. It keeps picking the wrong address when customers send a correction.",
  task: "Write the release eval config and the live routing config, then run the week: Monday’s eval, Thursday’s rerun, the cohort and a day of traffic.",
  brief: {
    problem: "The demo passed on an unrecorded setup while corrected addresses kept failing, the cohort has no working rollback, and every message goes to the stronger model.",
    move: "Read the release record and contract, the registry and Simon’s routing trial, then the runner notes. Edit both files and run the week.",
    success: ["Thursday’s rerun reproduces Monday’s setup", "The report shows run-to-run spread", "A candidate under the bar on any slice is blocked", "A slipping cohort is back on the last good version within 10 minutes", "Every slice meets the bar live within budget"],
  },
  prebrief: {
    concept: "Model outputs vary from run to run, so a fair comparison fixes everything that can change (model ID, prompt version, case revision) and repeats each case. Release gates look at each slice, not the average, and a live regression is rolled back to a known version before anyone investigates.",
    terms: [["Exact model and prompt versions", "Pinned, versioned configuration"], ["Run it more than once", "Repeated trials for nondeterminism"],
      ["Score each kind of case separately", "Slice-level evaluation"], ["Go back to what worked", "Rollback to a versioned configuration"], ["Send hard cases to a stronger model", "Model routing"]],
    contrast: {
      good: "A bakery testing a new recipe bakes three batches in the same oven and checks the gluten-free loaves separately.",
      bad: "Comparing one loaf from a new oven with last week’s loaf from the old oven can’t tell you whether the recipe helped.",
    },
  },
  documents: [...weekDocuments(week47, "Week 47."), contract, runnerNotes],
  artifacts: [
    { id: "eval", kind: "eval-plan", path: "evals/address-release.json", editor: "json", instruction: "The release eval: what runs, how often, and what blocks the candidate.",
      starter: starter.eval, example: compactJson({ candidate: { model: "claude-haiku-5-5", prompt: "tagger-v4", effort: "low" }, cases: "evals/tags.jsonl@r3", trials: 5, gate: { overall_min_accuracy: 0.7 } }) },
    { id: "routing", kind: "routing-config", path: "config/address-routing.json", editor: "json", instruction: "Live routing: which model answers each message, and when the cohort rolls back.",
      starter: starter.routing, example: compactJson({ prompt: "tagger-v3", routes: [{ when: "chars > 2000", model: "claude-sonnet-5-5" }, { when: "true", model: "claude-haiku-5-5" }], rollback: { when: "slice.spam.accuracy < 0.6", to: "tagger-v2" } }) },
  ],
  engine: releaseEvalEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: {
    "po-box": [...weekDocuments(poBox, "Week 50. Address cases now include a PO-box slice."), contract, runnerNotes],
    clean: [...weekDocuments(clean, "Week 51. Address cases include the PO-box slice."), contract, runnerNotes],
  },
  checks,
  prediction: {
    prompt: "How many dollars will the routing day cost (budget $6.30)?", unit: "$", tolerance: 0.5,
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + ((entry?.out as ReleaseOut | undefined)?.routing.cost ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { "po-box": poBoxRef, clean: referenceFor("address-v22", `${casesFile}@r14`) } },
  mutants: [
    { name: "notebook default model", set: "sample", mustFail: ["rerun-pinned"], edit: () => withEval({ model: "default" }) },
    { name: "latest prompt", set: "sample", mustFail: ["rerun-pinned"], edit: () => withEval({ prompt: "address@latest" }) },
    { name: "unpinned case file", set: "sample", mustFail: ["rerun-pinned"], edit: () => withEval({ cases: casesFile }) },
    { name: "production prompt under test", set: "sample", mustFail: ["rerun-pinned"], edit: () => withEval({ prompt: "address-v17" }) },
    { name: "temperature 0 from the notebook", set: "sample", mustFail: ["rerun-pinned", "variance-observed", "slice-gate"], edit: () => withEval({ extra: { temperature: 0 } }) },
    { name: "one trial", set: "sample", mustFail: ["variance-observed"], edit: () => withEval({ trials: 1 }) },
    { name: "routine-only gate", set: "sample", mustFail: ["slice-gate"], edit: () => withEval({ gate: { slices: { routine: 0.8 } } }) },
    { name: "average gate", set: "sample", mustFail: ["slice-gate"], edit: () => withEval({ gate: { overall_min_accuracy: 0.6 } }) },
    { name: "floor below the contract", set: "transfer", variant: "po-box", mustFail: ["slice-gate"], edit: (files) => ({ ...files, eval: evalFile({ prompt: "address-v21", cases: `${casesFile}@r14`, gate: { every_slice_min_accuracy: 0.6 } }) }) },
    { name: "floor above the contract", set: "transfer", variant: "clean", mustFail: ["slice-gate"], edit: (files) => ({ ...files, eval: evalFile({ prompt: "address-v22", cases: `${casesFile}@r14`, gate: { every_slice_min_accuracy: 0.85 } }) }) },
    { name: "rollback watches overall accuracy", set: "sample", mustFail: ["live-rollback"], edit: () => withRouting({ rollback: { when: "overall.accuracy < 0.8", to: "address-v17" } }) },
    { name: "rollback to latest", set: "sample", mustFail: ["live-rollback"], edit: () => withRouting({ rollback: { when: "min(slices[].accuracy) < 0.8", to: "address@latest" } }) },
    { name: "no rollback", set: "sample", mustFail: ["live-rollback"], edit: () => withRouting({ rollback: null }) },
    { name: "rollback on a hair trigger", set: "transfer", variant: "clean", mustFail: ["live-rollback"], edit: (files) => withRouting({ rollback: { when: "min(slices[].accuracy) < 0.9", to: "address-v17" } }, files) },
    { name: "rollback watches corrections only", set: "transfer", variant: "po-box", mustFail: ["live-rollback"], edit: (files) => withRouting({ rollback: { when: "slice.correction.accuracy < 0.8", to: "address-v17" } }, files) },
    { name: "everything on the stronger model", set: "sample", mustFail: ["routing"], edit: () => withRouting({ routes: [{ when: "true", model: "claude-opus-5-5" }] }) },
    { name: "long messages escalate", set: "sample", mustFail: ["routing"], edit: () => withRouting({ routes: [{ when: "chars > 600", model: "claude-opus-5-5" }, { when: "true", model: "claude-sonnet-5-5" }] }) },
    { name: "no escalation", set: "sample", mustFail: ["routing"], edit: () => withRouting({ routes: [{ when: "true", model: "claude-sonnet-5-5" }] }) },
    { name: "routine on the small model", set: "sample", mustFail: ["routing"], edit: () => withRouting({ routes: [{ when: "flagged_correction", model: "claude-opus-5-5" }, { when: "true", model: "claude-haiku-5-5" }] }) },
    { name: "no catch-all route", set: "sample", mustFail: ["routing"], edit: () => withRouting({ routes: [{ when: "flagged_correction", model: "claude-opus-5-5" }] }) },
  ],
  probes: [
    { name: "named slices on the new case set", set: "transfer", variant: "po-box", mustFail: ["slice-gate"],
      files: (files) => ({ ...files, eval: evalFile({ prompt: "address-v21", cases: `${casesFile}@r14`, gate: { slices: { routine: 0.8, correction: 0.8 } } }) }) },
    { name: "last week’s files on the new week", set: "transfer", variant: "clean", mustFail: ["rerun-pinned"], files: () => sampleRef },
  ],
  fixTerms: ["every_slice_min_accuracy", "min(slices"],
  debrief: "The eval pins claude-sonnet-5-5, prompt address-v18 and cases@r12, so Thursday’s rerun is the same experiment; it runs every case three times to show spread, sends no sampling parameters, and gates every slice at the contract’s 0.8, so v18 is blocked on corrections. Live, a rule on min(slices[].accuracy) sends the cohort back to address-v17 the moment any slice slips, and routing escalates only what the validated matching rule flags to claude-opus-5-5, keeping corrections above the bar within budget.",
};
