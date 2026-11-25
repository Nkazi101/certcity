// Architect Professional · professional-eval-gate (absorbs the support-pilot stop rule). The learner writes the release
// gate's eval plan: slices and how many cases each, trials, graders, the judge's calibration, per-slice bars, the canary
// assignment and the stop rules. The engine runs it over a labelled corpus with planted regressions (intermittent
// appeals errors, three new-form failure patterns, four small-organization exclusions, fluent but ungrounded handoffs),
// then replays last week's canary traffic. Transfer (rerun, hidden): next month's corpus, where the judge has improved,
// the grounding set has grown, a fourth form pattern appears late in the corpus, and appeals regress by less.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { evalGateEngine } from "../engines/eval-gate";
import type { EvalCase, EvalInput, EvalOut, EvalSlice } from "../engines/eval-gate";
import type { Check, CityEffect, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const pass = (count: number) => Array.from({ length: count }, () => "P");
const field = (prefix: string, specs: readonly string[], pattern?: string): EvalCase[] =>
  specs.map((trials, index) => ({ id: `${prefix}-${String(index + 1).padStart(2, "0")}`, ...(pattern && { pattern }), trials }));
const patterned = (prefix: string, groups: readonly (readonly [string, readonly string[]])[]) => {
  let index = 0;
  return groups.flatMap(([pattern, specs]) => specs.map((trials): EvalCase => ({ id: `${prefix}-${String(++index).padStart(2, "0")}`, pattern, trials })));
};
/** Open-ended handoff answers: g = grounded in the case record, p = grounded but worded differently, u = cites no record. Upper case = the raw judge passes it. */
const open = (spec: string): EvalCase[] => [...spec].map((code, index) => ({
  id: `G-${String(index + 1).padStart(2, "0")}`, trials: "P",
  open: { truth: code.toLowerCase() === "u" ? "ungrounded" as const : code.toLowerCase() === "p" ? "paraphrase" as const : "grounded" as const, judge: code === code.toUpperCase() ? "P" as const : "F" as const },
}));
const agree = (size: number, misses: readonly number[]) => Array.from({ length: size }, (_, index) => !misses.includes(index));

const layoutLabels = { L1: "New form · attachment table on page 2", L2: "New form · rotated scan", L3: "New form · two-column header", L4: "New form · signature on a separate sheet" };
const smallLabels = { S1: "Small orgs · no payroll record", S2: "Small orgs · volunteer-run board", S3: "Small orgs · shared mailing address", S4: "Small orgs · fewer than five staff" };

const offices = [
  { name: "Harbor", share: 0.25, appeals: 0.02, volunteer: true },
  { name: "Central", share: 0.35, appeals: 0.2, volunteer: false },
  { name: "North", share: 0.2, appeals: 0.06, volunteer: true },
  { name: "East", share: 0.2, appeals: 0.18, volunteer: false },
];

const april: EvalInput = {
  candidate: "pilot-v2",
  slices: [
    { id: "routine", label: "Routine requests", output: "field", baseline: 0.99, cases: field("R", pass(20)) },
    { id: "appeals", label: "Appeals", output: "field", baseline: 0.97, cases: field("AP", ["P", "P", "P", "PFF", "P", "P", "PFF", "P", "P", "PFF", "P", "PFF"]) },
    { id: "new-layout", label: "New supplier form", output: "field", baseline: 0.96, patternLabels: layoutLabels,
      cases: patterned("NL", [["L1", ["P", "F", "F", "F"]], ["L2", ["P", "F", "F"]], ["L3", ["P", "F", "F"]]]) },
    { id: "small-org", label: "Small organizations", output: "field", baseline: 0.97, patternLabels: smallLabels,
      cases: patterned("SO", [["S1", ["P", "F", "F"]], ["S2", ["P", "F", "F"]], ["S3", ["P", "F", "F"]], ["S4", ["P", "F", "F"]]]) },
    { id: "grounding", label: "Grounding and handoff answers", output: "open", baseline: 0.95, cases: open("GPUGPGPUGPGPUGPGGuGPGUGP") },
  ],
  calibrationPool: agree(20, [5, 8, 10, 14, 17]),
  reviewerLimit: 80, minutesPerCase: 2,
  handleTime: { current: 12.5, candidate: 8.2 },
  appealsBound: 0.03,
  canary: {
    volumePerDay: 2000, offices, firstHourAppeals: 0.03, baselineAppeals: 0.95, minMeasured: 10,
    days: [
      { day: 1, candidateAppeals: 0.95, closuresPerAppeal: 0, handleTime: 8.3 },
      { day: 2, candidateAppeals: 0.94, closuresPerAppeal: 0.09, handleTime: 8.1 },
      { day: 3, candidateAppeals: 0.86, closuresPerAppeal: 0, handleTime: 8.2 },
      { day: 4, candidateAppeals: 0.85, closuresPerAppeal: 0, handleTime: 8 },
    ],
  },
};

const may: EvalInput = {
  ...april,
  candidate: "pilot-v3",
  slices: [
    { id: "routine", label: "Routine requests", output: "field", baseline: 0.99, cases: field("R", pass(20)) },
    { id: "appeals", label: "Appeals", output: "field", baseline: 0.97, cases: field("AP", ["P", "P", "PPF", "P", "P", "P", "P", "PFF", "P", "P"]) },
    { id: "new-layout", label: "New supplier form", output: "field", baseline: 0.96, patternLabels: layoutLabels,
      cases: patterned("NL", [["L1", ["P", "F", "F"]], ["L2", ["P", "F", "F"]], ["L3", ["P", "F", "F"]], ["L4", ["P", "F"]]]) },
    { id: "small-org", label: "Small organizations", output: "field", baseline: 0.97, patternLabels: smallLabels,
      cases: patterned("SO", [["S1", ["P", "F", "F"]], ["S2", ["P", "F", "F"]], ["S3", ["P", "F", "F"]]]) },
    { id: "grounding", label: "Grounding and handoff answers", output: "open", baseline: 0.95, cases: open("GGGuGPGGPGGPGGGuGPGGPGGGPGuGGGuGPGGGPGGuGGPG") },
  ],
  calibrationPool: agree(20, [12, 18]),
  handleTime: { current: 12.5, candidate: 7.9 },
  canary: {
    ...april.canary,
    days: [
      { day: 1, candidateAppeals: 0.95, closuresPerAppeal: 0, handleTime: 8 },
      { day: 2, candidateAppeals: 0.89, closuresPerAppeal: 0, handleTime: 7.8 },
      { day: 3, candidateAppeals: 0.9, closuresPerAppeal: 0, handleTime: 7.9 },
      { day: 4, candidateAppeals: 0.89, closuresPerAppeal: 0.1, handleTime: 7.7 },
    ],
  },
};

const fixtures: Fixture<EvalInput>[] = [
  { id: "april", name: "April corpus + last week’s canary", set: "sample", situation: "pilot-v2 handles tickets faster; Frank’s labelled examples show where it got worse.", input: april },
  { id: "may", name: "May corpus + this week’s canary", set: "transfer", variant: "may", situation: "pilot-v3 a month later: a bigger grounding set, a new form pattern, a better judge, and a smaller appeals drop.", input: may },
];

type SliceEntry = Record<string, unknown>;
const slice = (name: string, rest: SliceEntry) => ({ slice: name, ...rest });
const referenceSlices = [
  slice("routine", { sample: 20, trials: 3, grader: "exact", metric: "field_accuracy", pass_at_least: 0.95 }),
  slice("appeals", { sample: "all", trials: 3, grader: "exact", metric: "escalation_accuracy", pass_at_least: 0.92 }),
  slice("new-layout", { per_pattern: 2, trials: 3, grader: "exact", metric: "field_accuracy", pass_at_least: 0.9 }),
  slice("small-org", { per_pattern: 2, trials: 3, grader: "exact", metric: "eligibility_accuracy", pass_at_least: 0.9 }),
  slice("grounding", { sample: "all", trials: 1, grader: "judge", metric: "grounded_handoff", pass_at_least: 0.9 }),
];
const referenceRules = [
  { metric: "escalation_accuracy", slice: "appeals", max_drop: 0.03, action: "halt" },
  { metric: "unauthorized_closures", max: 0, action: "halt" },
];
type PlanShape = { report: string; slices: SliceEntry[]; judge?: Record<string, unknown>; canary: Record<string, unknown>; stop_rules: Record<string, unknown>[] };
const referencePlan: PlanShape = {
  report: "per-slice", slices: referenceSlices,
  judge: { calibration_cases: 10, min_agreement: 0.85, if_below: "human" },
  canary: { assignment: "random", share: 0.05 },
  stop_rules: referenceRules,
};
const planFile = (plan: PlanShape) => compactJson({ candidate: "pilot-v2", report: plan.report, slices: plan.slices, ...(plan.judge && { judge: plan.judge }), canary: plan.canary, stop_rules: plan.stop_rules });
const reference: LabFiles = { plan: planFile(referencePlan) };
const edit = (change: (plan: PlanShape) => PlanShape) => (): LabFiles => ({ plan: planFile(change(structuredClone(referencePlan))) });
const editSlice = (name: string, change: (entry: SliceEntry) => SliceEntry) => edit((plan) => ({ ...plan, slices: plan.slices.map((entry) => entry.slice === name ? change(entry) : entry) }));
const without = (entry: SliceEntry, ...keys: string[]) => Object.fromEntries(Object.entries(entry).filter(([key]) => !keys.includes(key)));

// Deployed: last month's gate. Routine traffic only, one trial, exact match for the open answers, one blended number,
// the candidate at the fastest office, and stop rules that watch speed and only alert on closures.
const starter = compactJson({
  candidate: "pilot-v2", report: "blended",
  slices: [
    slice("routine", { sample: 20, trials: 1, grader: "exact", metric: "field_accuracy" }),
    slice("grounding", { sample: "all", trials: 1, grader: "exact", metric: "grounded_handoff" }),
  ],
  canary: { assignment: "office:Harbor", share: 0.05 },
  stop_rules: [{ metric: "handle_time", max_increase: 0.1, action: "halt" }, { metric: "unauthorized_closures", max: 1, action: "alert" }],
});

const documents = [
  { id: "corpus", title: "Labelled corpus · Frank Okafor, quality lead", format: "code" as const, text: [
    "Slice ids and cases, in corpus order:",
    "routine     20 routine requests (field outputs)",
    "appeals     12 appeals (field output: escalate yes/no)",
    "new-layout  10 new supplier forms: 4 × attachment table on page 2, 3 × rotated scan, 3 × two-column header",
    "small-org   12 small-organization applications: 3 each of no payroll record, volunteer-run board, shared mailing address, fewer than five staff",
    "grounding   24 open-ended handoff answers (claims must cite the case record)",
    "",
    "Within each failure pattern the first case usually passes; the pattern shows from the second case on.",
    "The same case can pass on one run and fail on the next.",
  ].join("\n") },
  { id: "desk", title: "Reviewer desk", text: "Eighty reviewer minutes this cycle. A reviewed case costs two minutes; the reviewer reads every trial of that case at once. Field outputs (escalation decision, attachment fields, eligibility) are checked by program at no reviewer cost. Open-ended handoff answers need judgment: a reviewer, or a model judge. Labelling a calibration case for the judge costs the same two minutes." },
  { id: "rules", title: "Promotion rules · signed by Priya Shah", text: "Appeals escalation accuracy may not fall more than 3 points below current, whatever the averages do. No unauthorized closures. Canary results must be comparable with current traffic. A model judge may grade on its own only after agreeing with reviewers on at least 85% of 10 or more freshly labelled cases; otherwise its slice goes to reviewers." },
  { id: "canary", title: "Canary feed", format: "code" as const, text: [
    "Last week’s recorded traffic, about 2,000 eligible requests a day.",
    "office   share  appeals  volunteered",
    "Harbor    25%     2%      yes   (fastest office)",
    "Central   35%    20%      no",
    "North     20%     6%      yes",
    "East      20%    18%      no",
    "First hour of the day: 3% appeals.",
    "Feed metrics: handle_time, escalation_accuracy (all traffic, or one slice), unauthorized_closures.",
    "A slice’s daily accuracy is reported only when that arm handled at least 10 of its cases that day.",
  ].join("\n") },
  { id: "dashboard", title: "Last month’s release dashboard · Priya’s note", text: "Score = ½ × pass rate + ½ × (8 min ÷ handle time). It went up last month while two safety failures went unnoticed." },
  { id: "fields", title: "eval-plan.json · fields the runner reads", format: "code" as const, text: [
    "report       \"blended\" (one score) or \"per-slice\" (one line and bar per slice)",
    "slices[]     slice (id) · sample (number or \"all\", in corpus order) or per_pattern (cases per failure pattern)",
    "             trials · grader: \"exact\" | \"judge\" | \"human\" · metric (label) · pass_at_least (0–1)",
    "judge        calibration_cases · min_agreement (0–1) · if_below (grader to use when agreement is lower)",
    "canary       assignment: \"random\" | \"office:<name>\" | \"volunteers\" | \"first-hour\" · share (0–1)",
    "stop_rules[] metric · slice (optional) · max_drop | max | max_increase · action: \"halt\" | \"alert\"",
  ].join("\n") },
];

type C = Check<EvalInput, EvalOut>;
const sliceOf = (out: EvalOut, id: string) => out.slices.find(({ slice: name }) => name === id)!;
const labelOf = (fixture: Fixture<EvalInput>, id: string) => fixture.input.slices.find(({ id: name }) => name === id) as EvalSlice;
const listOf = (values: readonly string[]) => values.join(", ");

function coverage(out: EvalOut, fixture: Fixture<EvalInput>, id: string) {
  const result = sliceOf(out, id);
  const missed = out.patterns.filter(({ slice: name, detected }) => name === id && !detected);
  const total = labelOf(fixture, id).cases.length;
  if (!result.measured && result.cases === 0) return { result, missed, symptom: `${labelOf(fixture, id).label}: 0 of ${total} cases in the gate, so the candidate’s failures there never reach the report.` };
  if (missed.length) return { result, missed, symptom: missed.map(({ label, selected }) => `${label}: ${selected} case${selected === 1 ? "" : "s"} in the gate, and none of them failed`).join("; ") + ". The candidate fails these patterns in the corpus." };
  return { result, missed, symptom: "" };
}

const checks: C[] = [
  {
    id: "appeals-caught", objective: "4.2", title: "The intermittent appeals regression shows up in the gate",
    diagnosis: "Model outputs vary between runs. A regression that fails one run in three is invisible to a single trial per case; each case needs several trials, and the pass rate is computed over all of them. Low-volume slices such as appeals also need their own cases in the set.",
    hints: hints("Read the appeals line in the trace: how many cases, how many runs each, and what Frank’s note says about the same case on different runs.",
      "A mixed-method evaluation set covers each known failure slice and runs each case several times (trials) so that a nondeterministic failure appears in the pass rate instead of hiding behind one lucky run.",
      "A bakery tests a new oven by baking the same tray recipe three times; one perfect tray says little when the oven burns one batch in three."),
    reveal: "{ \"slice\": \"appeals\", \"sample\": \"all\", \"trials\": 3, \"grader\": \"exact\", \"pass_at_least\": 0.92 }",
    evaluate: ({ out }, fixture) => {
      const { result, missed, symptom } = coverage(out, fixture, "appeals");
      if (!missed.length) return { passed: true, symptom: `Appeals measured ${Math.round((result.rate ?? 0) * 100)}% across ${result.cases} cases × ${result.trials} trials.` };
      if (result.cases > 0 && result.trials === 1) return { passed: false, symptom: `Appeals: ${result.cases} cases ran once each and every run passed. In the corpus, some of the same cases fail on other runs.`, source: result.source };
      return { passed: false, symptom, source: result.source };
    },
  },
  {
    id: "layout-covered", objective: "4.2", title: "Every new-form failure pattern appears in the gate",
    diagnosis: "Coverage is sized from the failure patterns already observed, not from overall volume: each pattern needs enough reviewed cases to show the failure. Taking the first cases in corpus order over-samples the most common pattern and leaves the others untested.",
    hints: hints("Compare the patterns in Frank’s corpus note with the new-form lines in the trace. Which pattern never failed in the gate?",
      "A mixed-method evaluation set deliberately includes every known failure slice and pattern, with enough cases per pattern to detect a regression; a share of routine traffic hides a pattern that is rare or comes late in the list.",
      "A spam team adds test messages for each phishing template it has seen, two or three per template, instead of the first fifty messages of the day."),
    reveal: "{ \"slice\": \"new-layout\", \"per_pattern\": 2, \"trials\": 3, \"grader\": \"exact\", \"pass_at_least\": 0.9 }",
    evaluate: ({ out }, fixture) => {
      const { result, missed, symptom } = coverage(out, fixture, "new-layout");
      return missed.length ? { passed: false, symptom, source: result.source }
        : { passed: true, symptom: `All ${out.patterns.filter(({ slice: name }) => name === "new-layout").length} new-form patterns failed visibly in the gate.` };
    },
  },
  {
    id: "grounding-graded", objective: "4.2", title: "Handoff answers are graded by a method that can judge them",
    diagnosis: "Exact matching suits fields; open-ended answers need judgment. A model judge is a grader only after it has been checked against human labels on enough cases to meet an agreement bar, with a fallback when it does not. An unchecked judge can pass fluent answers that cite nothing.",
    hints: hints("Read the reviewer spot-check lines and the judge calibration line. Which answers were graded wrongly, and by what?",
      "Match the grader to the output: exact or code checks for fields, rubric-based human review or an LLM-as-judge calibrated against human labels for grounding. Calibration needs a real sample and a bar, and the plan must say what grades the slice when the judge misses the bar.",
      "A language school marks quizzes by answer key, but essays go to a marking assistant only after its scores match two teachers on a dozen sample essays; when they don’t, the teachers mark."),
    reveal: "\"judge\": { \"calibration_cases\": 10, \"min_agreement\": 0.85, \"if_below\": \"human\" } with grounding graded by \"judge\" over all cases.",
    evaluate: ({ out }, fixture) => {
      const g = out.grounding;
      const ungrounded = labelOf(fixture, "grounding").cases.filter(({ open: answer }) => answer?.truth === "ungrounded").length;
      const total = labelOf(fixture, "grounding").cases.length;
      if (!g.inPlan) return { passed: false, symptom: `None of the ${total} handoff answers was graded; ${ungrounded} of them cite no record for their claims.`, source: g.source };
      if (g.ungraded) return { passed: false, symptom: `${g.ungraded} handoff answers were never graded: nothing in the plan could grade them after the judge’s calibration result.`, source: out.sources.judge };
      if (g.falsePass.length) return { passed: false, symptom: `${g.falsePass.length} handoff answers that cite no record were marked passing (${listOf(g.falsePass)}).`, source: out.calibration ? out.sources.judge : g.source };
      if (g.falseFail.length) return { passed: false, symptom: `${g.falseFail.length} correct handoff answers were marked failing because their wording differs from the reference answer.`, source: g.source };
      if (g.unseen.length) return { passed: false, symptom: `${g.unseen.length} handoff answers that cite no record were never graded (${listOf(g.unseen)}).`, source: g.source };
      return { passed: true, symptom: `Every ungrounded answer failed and every correct one passed (graded by ${g.how}).` };
    },
  },
  {
    id: "reviewer-budget", objective: "4.2", title: "Reviewer time fits the desk’s eighty minutes",
    diagnosis: "Human grading is the scarce resource. Spend it where judgment is needed (open-ended answers, judge calibration) and let programs check fields; a judge that passes calibration frees reviewer time, one that fails sends its slice back to people.",
    hints: hints("Read the reviewer-minute lines in the trace: which slices and which calibration step spend the minutes?",
      "Fit grading effort into reviewer capacity: exact checks cost nothing, every human-reviewed case costs time, and calibration labels cost time too. Size the calibration sample to what the bar needs, and let a calibrated judge carry large open-ended slices.",
      "A newsroom fact-checks every quote by hand but lets software confirm dates and spellings, so the two checkers finish before the print deadline."),
    reveal: "Exact graders on field slices, the judge on grounding with a 10-case calibration and reviewers as its fallback.",
    evaluate: ({ out }, fixture) => out.minutes <= fixture.input.reviewerLimit
      ? { passed: true, symptom: `${out.minutes} of ${fixture.input.reviewerLimit} reviewer minutes used.` }
      : { passed: false, symptom: `The plan needs ${out.minutes} reviewer minutes; the desk has ${fixture.input.reviewerLimit}.`, source: out.sources.slices },
  },
  {
    id: "small-org-covered", objective: "5.5", title: "Small organizations are measured and can hold the release",
    diagnosis: "Low-volume groups disappear in aggregate metrics. A fairness check gives the affected group its own cases, sized from the exclusion patterns observed, and its own bar, so that a failure for that group alone can stop the release and is reported as a known limitation.",
    hints: hints("Find the small-organization lines in the trace: how many of its cases ran, which patterns failed, and does anything in the plan act on its number?",
      "Fairness checks compare outcomes for each affected group with the service’s own criteria. A group that is 3% of volume needs explicit coverage of each exclusion pattern and a threshold of its own.",
      "A loan model is checked separately for first-time borrowers, 2% of applications, because overall accuracy would not move if every one of them were wrongly declined."),
    reveal: "{ \"slice\": \"small-org\", \"per_pattern\": 2, \"trials\": 3, \"grader\": \"exact\", \"pass_at_least\": 0.9 }",
    evaluate: ({ out }, fixture) => {
      const { result, missed, symptom } = coverage(out, fixture, "small-org");
      if (missed.length) return { passed: false, symptom, source: result.source };
      if (result.floor === null) return { passed: false, symptom: `Small organizations measured ${Math.round((result.rate ?? 0) * 100)}% against ${Math.round(result.baseline * 100)}% for current, and nothing in the plan acts on that number.`, source: result.source };
      return { passed: true, symptom: `Small organizations: every exclusion pattern failed visibly and the slice has its own bar.` };
    },
  },
  {
    id: "dashboard-slices", objective: "4.1", title: "The dashboard shows each measure, and a regressed slice holds the release",
    diagnosis: "Quality measures (escalation accuracy, grounding, eligibility) and operational metrics (handle time, cost) are separate series with separate targets. A blended score lets a speed gain cover a safety failure, and a slice with no target cannot stop anything.",
    hints: hints("Read the release dashboard line in the trace, then Priya’s note on last month’s score.",
      "Define quality and operational metrics independently, each with its own threshold, and make the gate decision from those lines rather than from one composite number.",
      "A hospital ward tracks infection rate, wait time and overtime as three dials with three limits; a composite ward score once hid an infection spike behind shorter waits."),
    reveal: "\"report\": \"per-slice\" with \"pass_at_least\" on every slice.",
    evaluate: ({ out }) => {
      const { dashboard } = out;
      if (dashboard.mode === "blended") return { passed: false, symptom: `The dashboard shows one number (candidate ${dashboard.candidate!.toFixed(2)}, current ${dashboard.current!.toFixed(2)})${dashboard.promoted ? " and recommends promotion" : ""}; nobody can see which measure moved.`, source: dashboard.source };
      if (dashboard.regressedButPromoted.length) {
        const worst = out.slices.find(({ slice: name }) => name === dashboard.regressedButPromoted[0])!;
        return { passed: false, symptom: `The gate promoted the candidate while ${worst.slice} measured ${Math.round(worst.rate! * 100)}% against ${Math.round(worst.baseline * 100)}% for current.`, source: worst.source };
      }
      return { passed: true, symptom: dashboard.promoted ? "Every slice met its bar." : `The gate held the candidate (${dashboard.blockedBy.join(", ")}).` };
    },
  },
  {
    id: "canary-comparable", objective: "4.3", title: "Canary and current traffic are comparable",
    diagnosis: "A controlled comparison gives every eligible request the same chance of reaching either arm, so office, time of day and request mix balance out. Choosing the fastest office, volunteers or a time window gives the candidate different work and mixes its effect with who was chosen.",
    hints: hints("Read the canary line: what share of each arm’s traffic is appeals, and why would they differ?",
      "Randomized assignment (a lottery per request) is the standard for a canary. Any rule that picks offices, people or hours lets the candidate see easier or different traffic, which confounds the comparison.",
      "A drug trial gives each patient a sealed envelope that decides treatment or placebo; letting doctors pick who gets the new drug mixes the drug’s effect with the doctors’ judgment."),
    reveal: "\"canary\": { \"assignment\": \"random\", \"share\": 0.05 }",
    evaluate: ({ out }) => out.canary.comparable
      ? { passed: true, symptom: `Appeals were ${Math.round(out.canary.candidateAppealsShare * 100)}% of both arms’ traffic.` }
      : { passed: false, symptom: `Appeals were ${Math.round(out.canary.candidateAppealsShare * 100)}% of the candidate arm’s traffic and ${Math.round(out.canary.currentAppealsShare * 100)}% of current’s: the two arms handled different work.`, source: out.canary.source },
  },
  {
    id: "stop-on-appeals", objective: "4.6", title: "An appeals regression stops the canary even while handle time improves",
    diagnosis: "Live monitoring needs a guardrail on the critical slice with an automatic stop, evaluated independently of the aggregate. Appeals are a small share of traffic, so their drop barely moves an all-traffic number; the slice must also get enough canary traffic for its daily accuracy to be reported.",
    hints: hints("Find the first day in the trace where appeals escalation falls more than the promotion rules allow. Which stop rule saw it, and what did it do?",
      "A slice-level guardrail metric has its own threshold and an action that halts promotion by itself. Alerts without a halt, rules on aggregate numbers, and canaries too small for the slice to be measured all let the regression keep running.",
      "An airline grounds one aircraft type as soon as its maintenance write-ups rise, whatever the fleet’s on-time average looks like."),
    reveal: "{ \"metric\": \"escalation_accuracy\", \"slice\": \"appeals\", \"max_drop\": 0.03, \"action\": \"halt\" }",
    evaluate: ({ out }, fixture) => {
      const day = out.canary.regressionDay;
      if (day === null) return null;
      const fired = out.canary.triggers.find(({ halts, cause, day: when }) => halts && (cause === "appeals" || cause === "aggregate") && when <= day);
      if (fired) return { passed: true, symptom: `Stop rule ${fired.rule + 1} stopped the canary on day ${fired.day} on appeals accuracy.` };
      const { candidateAppeals } = fixture.input.canary.days.find(({ day: when }) => when === day)!;
      const current = Math.round(fixture.input.canary.baselineAppeals * 100);
      if (out.canary.appealsPerDay < fixture.input.canary.minMeasured) return { passed: false, symptom: `From day ${day} the candidate escalated appeals correctly ${Math.round(candidateAppeals * 100)}% of the time (current ${current}%), but it handled ${out.canary.appealsPerDay} appeals a day, too few for the feed to report, and the canary kept going.`, source: out.canary.source };
      const alerted = out.canary.triggers.find(({ halts, cause }) => !halts && (cause === "appeals" || cause === "aggregate"));
      return { passed: false, symptom: `Day ${day}: appeals escalation accuracy ${Math.round(candidateAppeals * 100)}% against ${current}% for current${alerted ? `; stop rule ${alerted.rule + 1} fired and the canary kept going` : ", and no stop rule acted on it"}.`, source: alerted?.source ?? out.canary.rulesSource };
    },
  },
  {
    id: "stop-on-closure", objective: "4.6", title: "An unauthorized closure stops the canary the day it happens",
    diagnosis: "Some failures are intolerable at any rate: one ticket closed without the authority to close it is already a breach. Its stop rule allows zero and halts; a tolerance of one, or an alert, lets the first closure through and waits for the second.",
    hints: hints("Find the day the closure count goes above zero, then read which rule watches closures and what it does.",
      "Guardrails for zero-tolerance events use a threshold of zero and an automatic halt, so the first occurrence stops promotion while people investigate.",
      "A lift shuts down after its first door fault, not its second, and an engineer restarts it."),
    reveal: "{ \"metric\": \"unauthorized_closures\", \"max\": 0, \"action\": \"halt\" }",
    evaluate: ({ out }) => {
      const day = out.canary.closureDay;
      if (day === null) return null;
      const fired = out.canary.triggers.find(({ halts, cause, day: when }) => halts && cause === "closures" && when <= day);
      if (fired) return { passed: true, symptom: `The first unauthorized closure stopped the canary on day ${day}.` };
      const alerted = out.canary.triggers.find(({ cause }) => cause === "closures");
      return { passed: false, symptom: `Day ${day}: the candidate closed an appeal without authority, and the canary kept going${alerted && !alerted.halts ? ` after stop rule ${alerted.rule + 1} fired` : ""}.`, source: alerted?.source ?? out.canary.rulesSource };
    },
  },
];

function effects(runs: readonly LabRunFixture<EvalInput, EvalOut>[]): CityEffect[] {
  return runs.flatMap(({ fixture, run }): CityEffect[] => {
    const out = run?.out;
    if (!out) return [{ kind: "tray" as const, item: `${fixture.name}: gate`, to: "failed" as const }];
    return [
      { kind: "meter" as const, id: `${fixture.id}-minutes`, label: "reviewer minutes", value: out.minutes, limit: fixture.input.reviewerLimit, unit: "min" },
      ...out.patterns.map(({ label, detected }) => ({ kind: "tray" as const, item: label, to: detected ? "held" as const : "leaked" as const })),
      { kind: "tray" as const, item: `${fixture.input.candidate} canary`, to: out.canary.haltDay !== null ? "blocked" as const : "posted" as const },
    ];
  });
}

export const professionalEvalGateLab: LabMission<unknown, EvalInput, EvalOut> = {
  id: "professional-eval-gate",
  provider: "anthropic",
  track: "architect-professional",
  objectives: ["4.1", "4.2", "4.3", "4.6", "5.5"],
  station: "Evaluation and reviewer board",
  speaker: "Priya Shah",
  opening: "Handle time went down, so last month’s gate said ship. Appeals got worse, the new supplier form fails three ways, and small organizations are being turned away.",
  task: "Write the release gate’s eval plan, run it over Frank’s labelled corpus and last week’s canary, and fix what it misses.",
  brief: {
    problem: "The release gate averages one number over routine traffic, so the pilot’s faster handling hides worse appeals, new-form failures and small-organization exclusions.",
    move: "Read Frank’s corpus note, the Reviewer desk and the Promotion rules, then the Canary feed. Edit eval-plan.json and run it.",
    success: ["Every planted regression shows up in the gate", "Handoff answers are graded correctly", "Reviewer time ≤ 80 minutes", "A regressed slice holds the release", "Canary arms get comparable traffic", "Appeals drops and unauthorized closures stop the canary the day they happen"],
  },
  prebrief: {
    concept: "A release gate is several measures with their own bars, graded by methods that fit each output, run enough times to see flaky failures, and followed by a canary with fair assignment and stop rules on the slices that matter.",
    terms: [["Test set that includes the known hard cases", "Mixed-method evaluation set"], ["Run each case several times", "Trials (nondeterminism)"],
      ["Check the grader against people first", "LLM-as-judge calibration"], ["Assign traffic by lottery", "Randomized canary"], ["Halt on one bad slice", "Slice-level stop rule (guardrail metric)"]],
    contrast: {
      good: "A school checks reading and maths separately for each class, so one class falling behind is visible.",
      bad: "Averaging the whole school hides that class behind gains elsewhere.",
    },
  },
  documents,
  artifacts: [{
    id: "plan", kind: "eval-plan", path: "eval-plan.json", editor: "json",
    instruction: "The gate the runner executes: slices of Frank’s corpus, graders, the judge’s calibration, the canary and its stop rules.",
    starter,
    example: compactJson({ candidate: "router-v4", report: "…", slices: [{ slice: "refunds", sample: 15, trials: 5, grader: "exact", metric: "refund_accuracy", pass_at_least: 0.97 }],
      judge: { calibration_cases: 25, min_agreement: 0.9, if_below: "…" }, canary: { assignment: "…", share: 0.1 }, stop_rules: [{ metric: "refund_errors", max: 2, action: "alert" }] }),
  }],
  engine: evalGateEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many reviewer minutes will your plan use on the April corpus?", unit: "min", tolerance: 4,
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.minutes ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { may: reference } },
  mutants: [
    { name: "appeals run once", set: "sample", mustFail: ["appeals-caught"], edit: editSlice("appeals", (entry) => ({ ...entry, trials: 1 })) },
    { name: "first six new forms", set: "sample", mustFail: ["layout-covered"], edit: editSlice("new-layout", (entry) => ({ ...without(entry, "per_pattern"), sample: 6 })) },
    { name: "one case per form pattern", set: "sample", mustFail: ["layout-covered"], edit: editSlice("new-layout", (entry) => ({ ...entry, per_pattern: 1 })) },
    { name: "handoffs graded by exact match", set: "sample", mustFail: ["grounding-graded"], edit: editSlice("grounding", (entry) => ({ ...entry, grader: "exact" })) },
    { name: "judge never calibrated", set: "sample", mustFail: ["grounding-graded"], edit: edit((plan) => ({ ...plan, judge: undefined })) },
    { name: "calibration on five cases", set: "sample", mustFail: ["grounding-graded"], edit: edit((plan) => ({ ...plan, judge: { ...plan.judge, calibration_cases: 5 } })) },
    { name: "calibration bar at 75%", set: "sample", mustFail: ["grounding-graded"], edit: edit((plan) => ({ ...plan, judge: { ...plan.judge, min_agreement: 0.75 } })) },
    { name: "no grader when the judge misses the bar", set: "sample", mustFail: ["grounding-graded"], edit: edit((plan) => ({ ...plan, judge: without(plan.judge!, "if_below") })) },
    { name: "calibration on twenty cases", set: "sample", mustFail: ["reviewer-budget"], edit: edit((plan) => ({ ...plan, judge: { ...plan.judge, calibration_cases: 20 } })) },
    { name: "small organizations left out", set: "sample", mustFail: ["small-org-covered"], edit: edit((plan) => ({ ...plan, slices: plan.slices.filter(({ slice: name }) => name !== "small-org") })) },
    { name: "small organizations without a bar", set: "sample", mustFail: ["small-org-covered"], edit: editSlice("small-org", (entry) => without(entry, "pass_at_least")) },
    { name: "blended dashboard", set: "sample", mustFail: ["dashboard-slices"], edit: edit((plan) => ({ ...plan, report: "blended" })) },
    { name: "no bar on any slice", set: "sample", mustFail: ["dashboard-slices", "small-org-covered"], edit: edit((plan) => ({ ...plan, slices: plan.slices.map((entry) => without(entry, "pass_at_least")) })) },
    { name: "canary at the volunteer offices", set: "sample", mustFail: ["canary-comparable", "stop-on-appeals"], edit: edit((plan) => ({ ...plan, canary: { assignment: "volunteers", share: 0.05 } })) },
    { name: "canary at 1%", set: "sample", mustFail: ["stop-on-appeals"], edit: edit((plan) => ({ ...plan, canary: { assignment: "random", share: 0.01 } })) },
    { name: "appeals rule on all traffic", set: "sample", mustFail: ["stop-on-appeals"], edit: edit((plan) => ({ ...plan, stop_rules: [without(referenceRules[0], "slice"), referenceRules[1]] })) },
    { name: "appeals rule only alerts", set: "sample", mustFail: ["stop-on-appeals"], edit: edit((plan) => ({ ...plan, stop_rules: [{ ...referenceRules[0], action: "alert" }, referenceRules[1]] })) },
    { name: "one closure tolerated", set: "sample", mustFail: ["stop-on-closure"], edit: edit((plan) => ({ ...plan, stop_rules: [referenceRules[0], { ...referenceRules[1], max: 1 }] })) },
    { name: "appeals bar tuned to April’s drop", set: "transfer", variant: "may", mustFail: ["stop-on-appeals"], edit: edit((plan) => ({ ...plan, stop_rules: [{ ...referenceRules[0], max_drop: 0.08 }, referenceRules[1]] })) },
    { name: "handoffs always go to reviewers", set: "transfer", variant: "may", mustFail: ["reviewer-budget"], edit: edit((plan) => ({ ...plan, judge: undefined, slices: plan.slices.map((entry) => entry.slice === "grounding" ? { ...entry, grader: "human" } : entry) })) },
  ],
  probes: [
    { name: "every grader on every slice", set: "sample", mustFail: "any",
      files: () => ({ plan: planFile({ ...referencePlan, slices: referenceSlices.map((entry) => ({ ...entry, grader: "exact or judge or human" })) }) }) },
    { name: "no slices at all", set: "sample", mustFail: "any", files: () => ({ plan: planFile({ ...referencePlan, slices: [] }) }) },
  ],
  overfit: {
    plan: planFile({
      ...referencePlan, judge: undefined,
      slices: referenceSlices.map((entry) => entry.slice === "new-layout" ? { ...without(entry, "per_pattern"), sample: 10 } : entry.slice === "grounding" ? { ...entry, sample: 24, grader: "human" } : entry),
      stop_rules: [{ ...referenceRules[0], max_drop: 0.08 }, referenceRules[1]],
    }),
  },
  fixTerms: ["per_pattern", "if_below", "min_agreement", "calibration_cases", "per-slice", "random", "max_drop", "halt"],
  debrief: "The gate gives every known failure its own cases: appeals in full with three trials (their failures are intermittent), two cases per new-form and small-organization pattern, and every handoff answer. Fields are checked by program; handoffs go to a model judge only after it agrees with reviewers on at least 85% of ten fresh labels, and to reviewers when it does not, which keeps the desk under eighty minutes in both months. The dashboard reports one line and bar per slice, so faster handling cannot cover a regressed slice. The canary assigns requests by lottery at a share large enough to measure appeals, and two halt rules stop it on an appeals drop beyond three points or on the first unauthorized closure.",
};
