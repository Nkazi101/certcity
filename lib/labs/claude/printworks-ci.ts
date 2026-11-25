// Architect Foundations · printworks-ci. The learner writes the CI review step (a `claude -p` command), the JSON Schema
// the publisher's findings must satisfy, and the review criteria. Transfer (rerun, hidden): the same pipeline reviews a
// different component whose spec has a different type-to-trim margin.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { ciEngine } from "../engines/cli";
import type { ReviewInput, ReviewOut } from "../engines/cli";
import type { Check, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const files = { criteria: "ci/criteria.md", schema: "ci/review-schema.json", contract: "docs/order-contract.md", prior: ".review/prior-findings.json" };
const finding = { id: "F-12", component: "label-renderer", snippet: "renderOrder(order.ref)", severity: "blocker" };
const samples: ReviewInput["samples"] = [
  { label: "one blocker finding", valid: true, value: { findings: [finding] } },
  { label: "no findings", valid: true, value: { findings: [] } },
  { label: "finding without a code snippet", valid: false, value: { findings: [{ id: "F-13", component: "order-formatter", severity: "warning" }] } },
  { label: "finding with an extra prose “comment” field", valid: false, value: { findings: [{ ...finding, comment: "Looks off, maybe check?" }] } },
  { label: "severity “high”", valid: false, value: { findings: [{ ...finding, severity: "high" }] } },
  { label: "a bare list instead of an object", valid: false, value: [finding] },
];
const base = { files, samples, prior: { id: "F-12", snippet: "renderOrder(order.ref)" } };
const poster: ReviewInput = { ...base, component: "poster", marginMm: 4, proofs: [{ id: "P-1", offsetMm: 1 }, { id: "P-2", offsetMm: 3 }],
  mismatch: { id: "F-20", components: ["label-renderer", "order-formatter"], snippet: "order.ref vs order.reference" } };
const sticker: ReviewInput = { ...base, component: "sticker sheet", marginMm: 3, proofs: [{ id: "S-1", offsetMm: 1.2 }, { id: "S-2", offsetMm: 1.8 }],
  mismatch: { id: "F-31", components: ["sticker-renderer", "order-formatter"], snippet: "order.qty vs order.quantity" } };
const banner: ReviewInput = { ...base, component: "street banner", marginMm: 10, proofs: [{ id: "B-1", offsetMm: 4 }, { id: "B-2", offsetMm: 6 }],
  mismatch: { id: "F-44", components: ["banner-renderer", "order-formatter"], snippet: "order.size_mm vs order.size_cm" } };

const fixtures: Fixture<ReviewInput>[] = [
  { id: "poster", name: "Poster release · retried commit", set: "sample", situation: "Two proofs (1 mm and 3 mm drift), a commit retried after a flaky step, and a renderer/formatter change.", input: poster },
  { id: "sticker", name: "Sticker sheet release", set: "transfer", variant: "sticker", situation: "The same pipeline reviews a different component.", input: sticker },
  { id: "banner", name: "Street banner release", set: "transfer", variant: "banner", situation: "The same pipeline reviews a different component.", input: banner },
];

const prompt = `Review this commit's proof changes against ${files.criteria}. Check the renderer and the order formatter against ${files.contract}. Findings already posted are in ${files.prior}: report only new ones.`;
const command = ({ p = true, format = "json", schema = true, tools = "Read,Grep,Glob", extract = ".structured_output", text = prompt, extra = "" } = {}) =>
  [`claude${p ? " -p" : ""}${extra} "${text}" \\`, `  --output-format ${format} \\`, ...(schema ? [`  --json-schema "$(cat ${files.schema})" \\`] : []),
    `  --allowedTools "${tools}" \\`, `  | jq '${extract}' > findings.json`].join("\n");
const itemSchema = (required = ["id", "component", "snippet", "severity"], closed = true) => ({
  type: "object", ...(closed && { additionalProperties: false }), required,
  properties: { id: { type: "string" }, component: { type: "string" }, snippet: { type: "string" }, severity: { type: "string", enum: ["blocker", "warning"] } },
});
const schemaFile = (item = itemSchema()) => compactJson({ type: "object", additionalProperties: false, required: ["findings"], properties: { findings: { type: "array", items: item } } });
const criteria = `# Proof review criteria

- Press drift: a plate may drift up to half of the type-to-trim margin stated in the component's spec. Flag only drift larger than that, with the measured offset as evidence.
- Cross-component: the order field must match ${files.contract} in every renderer and in the order formatter.
- Report each finding once, with its id, component and the code snippet.
`;
const reference: LabFiles = { command: command(), schema: schemaFile(), criteria };
// Deployed: resumes the authoring session, may edit files, prints prose, and asks for "any misaligned proofs".
const starter: LabFiles = {
  command: [`claude -p --resume "$AUTHOR_SESSION" "Review your proof changes against ${files.criteria} and list any problems." \\`, `  --output-format text \\`, `  --allowedTools "Read,Grep,Glob,Edit"`].join("\n"),
  schema: compactJson({ type: "object" }),
  criteria: "# Proof review criteria\n\n- Flag any misaligned proofs.\n- Point out anything else that looks wrong.\n",
};

type C = Check<ReviewInput, ReviewOut>;
const checks: C[] = [
  {
    id: "runs-headless", objective: "3.6", title: "The review finishes unattended and cannot change the commit",
    diagnosis: "In CI nobody can answer a prompt. claude -p (print mode) runs the prompt and exits; --allowedTools pre-approves exactly the tools the job needs. A review job needs read-only tools; allowing Edit or Write lets the reviewer change the code it is judging.",
    hints: hints("Read the first line of the trace: how was claude started, and which tools may it use without asking?",
      "Claude Code in CI: use -p for a non-interactive run, and pass --allowedTools with read-only tools (Read, Grep, Glob, git diff). Anything not allowed would need an approval nobody can give.",
      "A nightly translation job calls the tool with --quiet --format=csv and read-only access to the source strings, instead of opening its interactive editor."),
    reveal: "claude -p \"…\" … --allowedTools \"Read,Grep,Glob\"",
    evaluate: ({ out }) => {
      if (out.hung) return { passed: false, symptom: "The CI job waited for keyboard input until it was cancelled after 60 minutes.", source: out.sources.command };
      if (out.unsafeTools.length) return { passed: false, symptom: `The review run could use ${out.unsafeTools.join(", ")} on the commit it was reviewing, without anyone approving it.`, source: out.sources.command };
      return { passed: true, symptom: "The review ran unattended with read-only tools." };
    },
  },
  {
    id: "typed-findings", objective: "3.6", title: "The publisher receives findings it can validate",
    diagnosis: "--output-format json wraps the run in a JSON envelope; --json-schema makes Claude Code validate the reply against your schema and put it in structured_output (result holds the text). The schema must describe the publisher’s contract exactly: required fields, closed objects (additionalProperties: false) and the allowed values.",
    hints: hints("Read the publisher line at the end of the trace and the schema lines before it: what did the publisher receive, and which well-formed or malformed findings does your schema let through?",
      "Structured output in CI: --output-format json --json-schema '<schema>' returns structured_output that matches the schema; read it with jq '.structured_output'. A schema that leaves objects open or fields optional lets malformed findings through.",
      "A web form that accepts any text in the date box gets “next Tuesday-ish”; one with a date picker and a required field gets a date every time."),
    reveal: "--output-format json --json-schema \"$(cat ci/review-schema.json)\" … | jq '.structured_output', with a closed item schema requiring id, component, snippet and severity (enum).",
    evaluate: ({ out }) => {
      if (out.hung) return null;
      if (out.format !== "json") return { passed: false, symptom: `The publisher received ${out.format === "text" ? "a prose reply" : `${out.format} output`} and could not read finding IDs, components or snippets from it.`, source: out.sources.command };
      if (!out.structured) return { passed: false, symptom: "The JSON reply had no structured_output, so the publisher had nothing typed to read.", source: out.sources.command };
      const problem = out.schemaProblems[0];
      if (problem) return { passed: false, symptom: problem.valid ? `The schema rejects a well-formed finding (${problem.label}), so a correct review fails.` : `The schema lets through a finding the publisher rejects (${problem.label}).`, source: out.sources.schema };
      if (out.extracts !== "structured_output") return { passed: false, symptom: `The pipeline hands the publisher ${out.extracts === "result" ? "the text in .result" : "the whole JSON envelope"} instead of the validated findings.`, source: out.sources.command };
      return { passed: true, symptom: "The publisher received validated findings." };
    },
  },
  {
    id: "no-duplicates", objective: "3.6", title: "A retried commit adds no duplicate comments",
    diagnosis: "Each CI run starts fresh, so it does not know what an earlier run on the same commit already posted. Give the run the prior findings and ask for new ones only, so a repeat is recognised by its identity and evidence while a new defect still posts.",
    hints: hints("Read the publisher line for the retried commit, then check whether the run was pointed at the earlier findings.",
      "Avoid duplicate CI comments by passing the prior review’s findings into the new run (a file it may read) and instructing it to report only new or unresolved findings, matched by finding id and quoted code.",
      "A ticketing integration that receives the same webhook twice ignores the second because the event ID and payload match, yet still files a ticket for a different event."),
    reveal: `Point the prompt at ${files.prior} and ask for new findings only (Read must be allowed).`,
    evaluate: ({ out, }) => {
      if (out.hung) return null;
      return out.reposted.length ? { passed: false, symptom: `${out.reposted.join(", ")} was posted again on the retried commit, identical to the first comment.`, source: out.sources.command }
        : { passed: true, symptom: "The retried commit added no repeat comment." };
    },
  },
  {
    id: "tolerance", objective: "4.1", title: "Drift within the spec passes; drift beyond it is flagged",
    diagnosis: "Review criteria must be explicit and measurable. “Flag misaligned proofs” leaves the threshold to judgment and flags allowed drift; a single fixed number fits one component only. State the rule the spec states (half the type-to-trim margin) so the reviewer applies it to every component.",
    hints: hints("Read the simulated review lines: which limit did the reviewer use for each proof, and where did it come from?",
      "Explicit review criteria: replace vague instructions with a measurable rule tied to the source of truth, including the boundary (inclusive) and the evidence to report. A rule derived from the spec transfers to components with different specs.",
      "A bakery’s rule says loaves may be up to 3% under the labelled weight, so the checker flags a 500 g loaf below 485 g and a 1 kg loaf below 970 g, from the same sentence."),
    reveal: "“A plate may drift up to half of the type-to-trim margin stated in the component's spec. Flag only drift larger than that.”",
    evaluate: ({ out }, fixture) => {
      if (out.hung) return null;
      const wrong = out.proofs.find(({ flagged, shouldFlag }) => flagged !== shouldFlag);
      if (!wrong) return { passed: true, symptom: `Simulated review: ${fixture.input.component} proofs judged against a ${fixture.input.marginMm / 2} mm limit.` };
      return { passed: false, symptom: `Simulated review: the ${fixture.input.component} proof ${wrong.id} (${wrong.offsetMm} mm drift) was ${wrong.flagged ? "flagged although the spec allows it" : "accepted although it exceeds the spec"}${out.rule.limitMm === null ? "; the criteria it read give no measurable limit" : `; it used a ${out.rule.limitMm} mm limit`}.`, source: out.sources.criteria };
    },
  },
  {
    id: "independent-review", objective: "4.6", title: "A reviewer outside the authoring session catches the cross-component mismatch",
    diagnosis: "A model reviewing its own change in the same session tends to repeat its reasoning, and file-by-file checks miss boundary defects. Run the review as a fresh session (no --resume or --continue) and give it the interface contract and both components.",
    hints: hints("Read the “Reviewer context” line: did the run inherit the authoring session, and could it see the contract?",
      "Independent review passes: a separate Claude instance without the generating context, given the contract and the components on both sides of the interface, catches integration defects that self-review and per-file checks miss.",
      "A publisher sends a manuscript to an outside copy editor who reads chapters together and notices that chapter 3 calls a character Ann and chapter 9 Anne."),
    reveal: `No --resume/--continue, and a prompt that points the reviewer at ${files.contract} and both components.`,
    evaluate: ({ out }, fixture) => {
      if (out.hung) return null;
      return out.mismatchFound ? { passed: true, symptom: `Finding ${fixture.input.mismatch.id} blocked the release.` }
        : { passed: false, symptom: `The release passed review with ${fixture.input.mismatch.components.join(" and ")} disagreeing (${fixture.input.mismatch.snippet}); the reviewer ${out.resumed ? "continued the session that wrote the change" : "never looked at the interface contract"}.`, source: out.sources.command };
    },
  },
];

function effects(runs: readonly LabRunFixture<ReviewInput, ReviewOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out) return [];
    if (out.hung) return [{ kind: "tray" as const, item: `${fixture.input.component} review`, to: "failed" as const }];
    return [
      ...out.proofs.map(({ id, flagged, shouldFlag }) => ({ kind: "tray" as const, item: `proof ${id}`, to: flagged === shouldFlag ? flagged ? "held" as const : "posted" as const : "failed" as const })),
      { kind: "tray" as const, item: `${fixture.input.component} release`, to: out.mismatchFound ? "blocked" as const : "leaked" as const },
      { kind: "meter" as const, id: `${fixture.id}-dupes`, label: "duplicate comments", value: out.reposted.length, limit: 0, unit: "comments" },
    ];
  });
}

const swap = (change: Readonly<Record<string, string>>): LabFiles => ({ ...reference, ...change });

export const printworksCiLab: LabMission<unknown, ReviewInput, ReviewOut> = {
  id: "printworks-ci",
  provider: "anthropic",
  track: "architect-foundations",
  objectives: ["3.6", "4.1", "4.6"],
  station: "Release runner",
  speaker: "Riley James",
  opening: "Last night’s review sat waiting for a keypress. When it ran, it flagged an allowed offset twice and missed the renderer mismatch.",
  task: "Write the CI review step, the findings schema and the review criteria, then run the release.",
  brief: {
    problem: "The release review stalls without a terminal, posts prose the publisher cannot use, flags allowed drift, repeats comments and missed a renderer/formatter mismatch.",
    move: "Read the runner notes, the press rule and the publisher contract, then edit the three files and run the release.",
    success: ["The review finishes unattended with read-only tools", "The publisher gets validated findings", "A retried commit adds 0 duplicate comments", "Allowed drift passes and excess drift is flagged, for any component", "The renderer/formatter mismatch blocks the release"],
  },
  prebrief: {
    concept: "In CI, Claude Code runs without a person: claude -p runs one prompt and exits, --output-format json with --json-schema returns typed output, and the reviewer should be a fresh session judging against written criteria.",
    terms: [["Run without a terminal", "claude -p (print mode)"], ["Output a program can check", "--output-format json --json-schema → structured_output"],
      ["Tools it may use unasked", "--allowedTools"], ["A rule with a number in it", "Explicit review criteria"], ["A reviewer who did not write it", "Independent review instance"]],
    contrast: {
      good: "An exam board grades with a written rubric and a second marker who never saw the student’s drafts.",
      bad: "A teacher rereading their own model answer with no rubric tends to approve whatever matches their memory.",
    },
  },
  documents: [
    { id: "runner", title: "Runner environment", text: `CI has no terminal: any prompt waits until the job is cancelled. $AUTHOR_SESSION holds the id of the Claude session that wrote the change. The pipeline restores ${files.prior} with the findings already posted on this commit. Reviews must not modify the commit.` },
    { id: "press", title: "Press rule · every component", text: "Each component’s spec (specs/<component>.md) states its type-to-trim margin. A plate may drift up to half of that margin and still be acceptable. The poster spec gives a 4 mm margin; other components differ." },
    { id: "publisher", title: "Comment publisher contract", format: "json", text: compactJson({ findings: [finding] }) + "\n\nThe publisher accepts an object with a findings array. Each finding has exactly id, component, snippet (the quoted code) and severity (blocker or warning), and nothing else." },
    { id: "changes", title: "Changed components", text: `The label renderer and the order formatter changed in this commit. Both pass their own file-level checks. The order field’s shape is defined in ${files.contract}.` },
  ],
  artifacts: [
    { id: "command", kind: "claude-code.cli", path: "ci/review.sh", editor: "shell", instruction: "The CI step that runs the review and hands findings.json to the publisher.",
      starter: starter.command, example: "claude -p \"Summarise the failing tests in test-report.xml\" \\\n  --output-format json \\\n  --json-schema \"$(cat ci/summary-schema.json)\" \\\n  --allowedTools \"Read\" \\\n  | jq '.structured_output' > summary.json" },
    { id: "schema", kind: "json-schema", path: files.schema, editor: "json", instruction: "The JSON Schema passed with --json-schema.",
      starter: starter.schema, example: compactJson({ type: "object", additionalProperties: false, required: ["failures"], properties: { failures: { type: "array", items: { type: "object", additionalProperties: false, required: ["test"], properties: { test: { type: "string" } } } } } }) },
    { id: "criteria", kind: "instructions", path: files.criteria, editor: "markdown", instruction: "What the reviewer checks and when it reports a finding.",
      starter: starter.criteria, example: "# Translation review\n\n- A string may be at most 20% longer than the English source; flag longer ones with both lengths.\n" },
  ],
  engine: ciEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many comments will the publisher post twice on the retried commit?", unit: "comments",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.reposted ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { sticker: reference, banner: reference } },
  mutants: [
    { name: "interactive run", set: "sample", mustFail: ["runs-headless"], edit: () => swap({ command: command({ p: false }) }) },
    { name: "review may edit files", set: "sample", mustFail: ["runs-headless"], edit: () => swap({ command: command({ tools: "Read,Grep,Glob,Edit" }) }) },
    { name: "text output", set: "sample", mustFail: ["typed-findings"], edit: () => swap({ command: command({ format: "text", schema: false, extract: "." }) }) },
    { name: "no schema", set: "sample", mustFail: ["typed-findings"], edit: () => swap({ command: command({ schema: false }) }) },
    { name: "open finding objects", set: "sample", mustFail: ["typed-findings"], edit: () => swap({ schema: schemaFile(itemSchema(undefined, false)) }) },
    { name: "snippet not required", set: "sample", mustFail: ["typed-findings"], edit: () => swap({ schema: schemaFile(itemSchema(["id", "component", "severity"])) }) },
    { name: "pipeline reads .result", set: "sample", mustFail: ["typed-findings"], edit: () => swap({ command: command({ extract: ".result" }) }) },
    { name: "prior findings not passed", set: "sample", mustFail: ["no-duplicates"], edit: () => swap({ command: command({ text: prompt.replace(` Findings already posted are in ${files.prior}: report only new ones.`, "") }) }) },
    { name: "resumes the authoring session", set: "sample", mustFail: ["independent-review"], edit: () => swap({ command: command({ extra: " --resume \"$AUTHOR_SESSION\"" }) }) },
    { name: "contract never mentioned", set: "sample", mustFail: ["independent-review"],
      edit: () => swap({ command: command({ text: prompt.replace(` Check the renderer and the order formatter against ${files.contract}.`, "") }), criteria: criteria.replace(` must match ${files.contract} in every renderer and in the order formatter`, " must be consistent") }) },
    { name: "vague criteria", set: "sample", mustFail: ["tolerance"], edit: () => swap({ criteria: "# Proof review criteria\n\n- Flag misaligned proofs.\n" }) },
    { name: "criteria file not read", set: "sample", mustFail: ["tolerance", "independent-review", "no-duplicates"], edit: () => swap({ command: command({ text: "Review this commit." }) }) },
    { name: "fixed 2 mm limit on the sticker sheet", set: "transfer", variant: "sticker", mustFail: ["tolerance"], edit: () => swap({ criteria: criteria.replace("up to half of the type-to-trim margin stated in the component's spec. Flag only drift larger than that", "up to 2 mm. Flag only drift larger than 2 mm") }) },
  ],
  probes: [
    { name: "every rule at once", set: "sample", mustFail: ["tolerance"], files: () => swap({ criteria: criteria + "- Flag any offset, just in case.\n" }) },
    { name: "every number at once", set: "sample", mustFail: ["tolerance"], files: () => swap({ criteria: "# Criteria\n\n- Drift limits: 1 mm, 2 mm or 3 mm depending on the job.\n" }) },
  ],
  overfit: { ...reference, criteria: criteria.replace("up to half of the type-to-trim margin stated in the component's spec. Flag only drift larger than that", "up to 2 mm. Flag only drift larger than 2 mm") },
  fixTerms: ["structured_output\"", "half of the", "--json-schema '"],
  debrief: "The review step runs claude -p with read-only --allowedTools, --output-format json and --json-schema pointing at a closed schema that matches the publisher’s contract, and pipes .structured_output to the publisher. It is a fresh session (no --resume) pointed at the criteria, the interface contract and the prior findings, so it reports only new defects and catches the renderer/formatter mismatch. The criteria state the press rule itself, half the type-to-trim margin from each component’s spec, so the same file judges posters, stickers and banners.",
};
