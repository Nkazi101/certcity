// Architect Foundations · release-review. The learner writes the operator's runbook of `claude` commands (the label fix run
// directly; two repair trials forked from the verified 54a session in plan mode), the expected-results table for the shared
// normalizeRef that picks which trial ships, and the handoff note the next operator reads after compaction.
// Transfer (rerun, hidden): the same runbook, table and note judge a different pair of trial patches.
import { hints } from "../../claude/casework";
import { investigationEngine } from "../engines/investigation";
import type { Impl, InvestigationInput, InvestigationOut } from "../engines/investigation";
import type { Check, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const contract = { null: "absent", empty: "invalid", ref: "=ref" } as const;
const both = (behaviour: Impl[string]): Impl => ({ importOrders: behaviour, nightReconcile: behaviour });
const withNight = (night: Partial<Impl[string]>): Impl => ({ importOrders: contract, nightReconcile: { ...contract, ...night } });

const base: Omit<InvestigationInput, "trials"> = {
  baseline: { session: "migration-54a", commit: "54a" },
  callers: [{ key: "importOrders", pattern: "import", label: "importOrders" }, { key: "nightReconcile", pattern: "reconcile|night", label: "nightReconcile" }],
  deployed: both({ null: "crash", empty: "", ref: "=ref" }),
  truth: both(contract),
  example: "NL-0042",
  uninspected: "reconcile/ledgerSync.ts",
  facts: {
    verified: [{ token: "importOrders", label: "re-inspected importOrders → normalizeRef", minutes: 7 }, { token: "nightReconcile", label: "re-inspected nightReconcile → normalizeRef → secondary ledger", minutes: 9 }],
    rejected: [{ token: "timezone", label: "re-tested the timezone theory", minutes: 20 }],
    pending: [{ token: "reconcile/ledgerSync.ts" }, { token: "billing/exportRefs.ts" }, { token: "api/orderLookup.ts" }],
  },
};
const ideas = { A: "normalizeRef returns a { status, ref } object", B: "normalizeRef keeps returning a string and uses the ABSENT / INVALID sentinels" };
const input = (a: Impl): InvestigationInput => ({ ...base, trials: [{ id: "A", idea: ideas.A, impl: a }, { id: "B", idea: ideas.B, impl: both(contract) }] });

const fixtures: Fixture<InvestigationInput>[] = [
  { id: "migration", name: "Order-reference migration", set: "sample", situation: "A label fix, two repair ideas to try from the verified 54a session, a failing normalizer and a session about to compact.", input: input(withNight({ ref: "[object Object]" })) },
  { id: "nightnull", name: "Second pair of trial patches", set: "transfer", variant: "nightnull", situation: "The same runbook, table and note judge a different pair of trial patches.", input: input(withNight({ null: "crash" })) },
  { id: "nightblank", name: "Third pair of trial patches", set: "transfer", variant: "nightblank", situation: "The same runbook, table and note judge a different pair of trial patches.", input: input(withNight({ empty: "" })) },
];

// --- files ---------------------------------------------------------------------------------------------------------------
const labelCommand = (flags = "-p") => `claude ${flags} "In src/labels.ts change the order label text from 'Ref' to 'Order ref'."`;
const trialCommand = (id: "A" | "B", flags = `--resume migration-54a --fork-session -n trial-${id.toLowerCase()} --permission-mode plan`) =>
  `claude ${flags} "Try repair idea ${id} for normalizeRef. Trace every caller before editing."`;
const runbook = ({ label = labelCommand(), a = trialCommand("A"), b = trialCommand("B") } = {}) =>
  `# Label fix: small, known, no identifier code\n${label}\n\n# Repair trials: each from the verified 54a session\n${a}\n${b}\n`;

type Case = readonly [caller: string, input: string, expected: string];
const fullCases: Case[] = [
  ["importOrders", "null", "absent"], ["importOrders", "\"\"", "invalid"], ["importOrders", "\" nl-0042 \"", "NL-0042"],
  ["nightReconcile", "null", "absent"], ["nightReconcile", "\"\"", "invalid"], ["nightReconcile", "\" nl-0042 \"", "NL-0042"],
];
const cases = (rows: readonly Case[]) => `# normalizeRef expected results\n\n| Caller | Input | Expected |\n|---|---|---|\n${rows.map(([caller, value, expected]) => `| ${caller} | ${value} | ${expected} |`).join("\n")}\n`;
const noteParts = {
  head: "# normalizeRef migration · handoff\n\nBaseline: session migration-54a (commit 54a, tests green).\n",
  verified: "\n## Verified call paths\n- importOrders → normalizeRef\n- nightReconcile → normalizeRef → secondary ledger\n",
  rejected: "\n## Rejected theories\n- Timezone offset in batch timestamps: tested at 54a, not the cause.\n",
  pending: "\n## Still to inspect\n- reconcile/ledgerSync.ts\n- billing/exportRefs.ts\n- api/orderLookup.ts\n",
};
const note = (parts: readonly (keyof typeof noteParts)[] = ["head", "verified", "rejected", "pending"]) => parts.map((part) => noteParts[part]).join("");

const reference: LabFiles = { runbook: runbook(), cases: cases(fullCases), handoff: note() };
// Deployed: the previous operator resumed the baseline itself for idea A with the label fix folded in, then continued the
// same session for idea B in default mode; the test file has one happy-path row; the note is a title.
const starter: LabFiles = {
  runbook: `# What the previous operator ran\nclaude --resume migration-54a --permission-mode plan "Try repair idea A for normalizeRef, and change the order label in src/labels.ts while you're there."\nclaude --continue "Now try repair idea B for normalizeRef."\n`,
  cases: cases([["importOrders", "\"NL-0042\"", "NL-0042"]]),
  handoff: "# Migration\n\nWorking on the normalizeRef migration. Nearly there.\n",
};

// --- checks ---------------------------------------------------------------------------------------------------------------
type C = Check<InvestigationInput, InvestigationOut>;
const inputText = (kind: string, example: string) => kind === "ref" ? example : kind === "empty" ? "\"\"" : "null";
const checks: C[] = [
  {
    id: "both-callers", objective: "1.6", title: "The patch that ships works for every caller of normalizeRef",
    diagnosis: "normalizeRef is a shared boundary: every caller depends on its contract. A test that drives only the caller you happened to run lets a patch through that breaks the other one. Decompose by dependency: put the cases at the shared function and run each through every consumer path.",
    hints: hints("Read the trial that shipped and the nightly run line under it. Which caller and which input did your table never try?",
      "Dependency-driven decomposition: list every consumer of the shared function (the saved baseline names two), then cover each consumer with the same inputs. Integration breaks hide where local tests do not reach.",
      "A payments team changing a rounding helper used by invoices and refunds tests it through both paths, because refunds broke last time only invoices were tested."),
    reveal: "Six rows: null, \"\" and a reference, each for importOrders and for nightReconcile.",
    evaluate: ({ out }, fixture) => {
      const { shipped, production } = out.table;
      if (!shipped) return null;
      if (!production) return { passed: true, symptom: `Trial ${shipped} shipped and both callers behave as the contract says.` };
      const shown = `${production.caller}(${inputText(production.input, fixture.input.example)})`;
      return { passed: false, source: out.table.source, symptom: production.actual === "crash"
        ? `Trial ${shipped} passed every row and shipped; that night ${shown} crashed.`
        : `Trial ${shipped} passed every row and shipped; that night ${shown} wrote ${JSON.stringify(production.actual)} into the secondary ledger.` };
    },
  },
  {
    id: "red-then-green", objective: "3.5", title: "The table fails the deployed code on both reported bugs and passes a fix",
    diagnosis: "Iterating against tests works when the cases encode the contract’s expected outputs, including the edge cases that broke: null (nothing sent) and \"\" (sent blank) are different states. Cases that expect today’s behaviour, or that collapse the two states, either pass the bug or block every correct fix.",
    hints: hints("Read the three table runs in the trace: how many rows fail on the deployed code, and which rows block each trial?",
      "Test-driven refinement: write the failing cases first with concrete expected outputs taken from the contract (absent for null, invalid for \"\"), confirm they fail on the current code, then iterate until a patch passes them.",
      "A form library’s tests say: phone not submitted → ‘not provided’; phone submitted as ‘abc’ → ‘wrong format’. Both fail on the old code, and the fix is done when both pass."),
    reveal: "| importOrders | null | absent |, | importOrders | \"\" | invalid | (and the same for nightReconcile).",
    evaluate: ({ out }) => {
      const table = out.table;
      if (!table.rows) return { passed: false, source: table.source, symptom: "The test runner could not read any row of the table, so nothing was tested." };
      if (!table.deployedCaught.null) return { passed: false, source: table.source, symptom: "The deployed normalizeRef passes the table, though it crashed the nightly import on an order with no reference." };
      if (!table.deployedCaught.empty) return { passed: false, source: table.source, symptom: "The deployed normalizeRef passes the table, though it wrote a blank reference to the ledger as if it were real." };
      if (!table.shipped) return { passed: false, source: table.source, symptom: `No trial passes the table (trial A fails “${table.results[0]?.failed[0]}”; trial B fails “${table.results[1]?.failed[0]}”). The release is blocked.` };
      return { passed: true, symptom: "The table fails the deployed code on both bugs and a trial passes it." };
    },
  },
  {
    id: "trials-isolated", objective: "1.7", title: "Both repair trials start from the verified 54a session, apart",
    diagnosis: "Resuming a session appends to it; resuming with --fork-session copies its history into a new session and leaves the original alone. Two experiments from one verified point each need their own fork: resuming (or continuing) one session for both mixes their edits, and a fresh session throws away the verified findings.",
    hints: hints("Follow each trial’s session in the trace: where did it start, and what was already in its history?",
      "Session management: claude --resume <name> continues that session; add --fork-session (and -n to name it) to branch a copy; --continue resumes the most recent session; a plain claude starts with no history. In the Agent SDK the same is resume + fork_session.",
      "A chef testing two sauces splits one finished base stock into two pots, rather than seasoning one pot twice or starting a new stock."),
    reveal: "claude --resume migration-54a --fork-session -n trial-a … and the same with -n trial-b.",
    evaluate: ({ out }) => {
      const missing = out.missingTrials[0];
      if (missing) return { passed: false, source: out.sources.runbook, symptom: `No command runs repair idea ${missing}; there is nothing to compare the other idea against.` };
      for (const trial of out.trials) {
        if (!trial.fromBaseline) return { passed: false, source: trial.source, symptom: `Trial ${trial.id} started without the 54a findings: it re-read both callers and re-tested the timezone theory before its first edit.` };
        if (trial.inherited) return { passed: false, source: trial.source, symptom: `Trial ${trial.id} started with the other trial’s edits to src/ref/normalize.ts already in its history.` };
        if (trial.baselineModified) return { passed: false, source: trial.source, symptom: `Session migration-54a now holds trial ${trial.id}’s edits; the verified starting point is gone.` };
      }
      return { passed: true, symptom: "Each trial started from 54a in its own session." };
    },
  },
  {
    id: "migration-planned", objective: "3.4", title: "The migration trials trace every caller before editing",
    diagnosis: "Plan mode lets Claude read, search and propose without editing until you approve. It pays off where dependencies are unknown, like a shared identifier with an undocumented caller; in default mode the agent starts changing code with the dependency map half drawn.",
    hints: hints("Read what each trial did in its first turn, and which file it had not yet traced.",
      "Plan mode (claude --permission-mode plan, or Shift+Tab, or /plan) for large or ambiguous changes with unknown dependencies; approve the plan, then Claude edits.",
      "A crew renovating an old house surveys the wiring before opening walls; repainting a door needs no survey."),
    reveal: "--permission-mode plan on both trial commands.",
    evaluate: ({ out }) => {
      const rushed = out.trials.find(({ plan }) => !plan);
      if (rushed) return { passed: false, source: rushed.source, symptom: `Trial ${rushed.id} edited src/ref/normalize.ts in its first turn, before tracing reconcile/ledgerSync.ts.` };
      return out.trials.length ? { passed: true, symptom: "Both trials traced every caller before proposing a patch." } : null;
    },
  },
  {
    id: "label-direct", objective: "3.4", title: "The label fix ships on its own, without a planning pass",
    diagnosis: "A small, well-understood change with no unknown dependencies is executed directly. Planning it costs review time for nothing; folding it into the migration ties a ten-minute fix to the riskiest change in the release.",
    hints: hints("Find the label change in the trace: which session did it run in, and in which mode?",
      "Choose the mode per change: direct execution for clear, contained edits; plan mode for multi-file or ambiguous work. Keep unrelated changes in separate sessions so each can be reviewed and reverted alone.",
      "Fixing a README typo goes straight to a one-line commit; renaming a column used by six services starts with a written plan."),
    reveal: "Its own command, not in plan mode: claude -p \"In src/labels.ts change the order label text …\"",
    evaluate: ({ out }) => {
      const label = out.label;
      if (!label.found) return { passed: false, source: out.sources.runbook, symptom: "No command makes the label fix; it is still waiting." };
      if (label.bundled) return { passed: false, source: label.source, symptom: "The label fix ran inside the migration’s session; it cannot be reviewed, shipped or reverted apart from the migration." };
      if (label.plan) return { passed: false, source: label.source, symptom: "The one-line label fix waited for a written plan and an approval before its edit." };
      return { passed: true, symptom: "The label fix ran directly in its own session." };
    },
  },
  {
    id: "no-rework", objective: "5.4", title: "After compaction, nothing verified or ruled out is done again",
    diagnosis: "Compaction keeps a summary, not the details. A scratchpad file outside the conversation that records what was verified and what was tested and rejected lets the next session skip that work instead of rediscovering it.",
    hints: hints("Read the resume steps at the end of the trace: what did Omar redo, and is it in your note under a heading that says it is done or ruled out?",
      "Manage long investigations with a scratchpad: confirmed findings (with file and call path), rejected hypotheses and open questions, each under its own heading, updated as you go and read before continuing.",
      "A night nurse’s handover lists which patients were assessed and which tests came back normal, so the day nurse does not repeat them."),
    reveal: "## Verified call paths (importOrders, nightReconcile) and ## Rejected theories (the timezone offset).",
    evaluate: ({ out }) => {
      const redone = out.resume.repeated;
      return redone.length ? { passed: false, source: out.resume.source, symptom: `After compaction Omar ${redone.map(({ label }) => label).join(" and ")} (${redone.reduce((total, { minutes }) => total + minutes, 0)} min).` }
        : { passed: true, symptom: "Omar redid nothing already verified or ruled out." };
    },
  },
  {
    id: "pending-carried", objective: "5.4", title: "Every path still open is inspected after compaction",
    diagnosis: "What is still open is the part a summary loses first. The note lists each uninspected path where the next operator looks for open work, and never among the finished items.",
    hints: hints("Read the resume steps: which paths did Omar never inspect, and where (if anywhere) does your note list them?",
      "A handoff carries pending checks explicitly (file names, not “a few more callers”), separate from confirmed findings, so the next session resumes at the unresolved files.",
      "An audit checklist keeps ‘not yet sampled’ accounts in their own column so the next auditor starts there."),
    reveal: "## Still to inspect, listing reconcile/ledgerSync.ts, billing/exportRefs.ts and api/orderLookup.ts.",
    evaluate: ({ out }) => {
      const missed = out.resume.missed;
      return missed.length ? { passed: false, source: out.resume.source, symptom: `After compaction Omar never inspected ${missed.join(", ")}.` }
        : { passed: true, symptom: "Omar picked up every open path." };
    },
  },
];

function effects(runs: readonly LabRunFixture<InvestigationInput, InvestigationOut>[]) {
  return runs.flatMap(({ run }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      { kind: "tray" as const, item: out.table.shipped ? `trial ${out.table.shipped} patch` : "migration release", to: !out.table.shipped ? "held" as const : out.table.production ? "failed" as const : "posted" as const },
      { kind: "tray" as const, item: "label fix", to: out.label.found && !out.label.bundled ? "posted" as const : "held" as const },
      { kind: "meter" as const, id: "rework", label: "Minutes redone after compaction", value: run.metrics.repeatMinutes, limit: 0, unit: "min" },
    ];
  });
}

const swap = (files: LabFiles, change: Readonly<Record<string, string>>): LabFiles => ({ ...files, ...change });

export const releaseReviewLab: LabMission<unknown, InvestigationInput, InvestigationOut> = {
  id: "release-review",
  provider: "anthropic",
  track: "architect-foundations",
  objectives: ["1.6", "1.7", "3.4", "3.5", "5.4"],
  station: "Migration dependency desk",
  speaker: "Priya Shah",
  opening: "The label fix is ready. The identifier change passed its own folder’s test and broke the nightly import.",
  task: "Write the runbook for today’s sessions, the expected-results table that decides which repair ships, and the handoff note for after compaction.",
  brief: {
    problem: "Two repair ideas were tried in one session with the label fix folded in, the only test covered one caller, and the investigation lives in a conversation about to compact.",
    move: "Read the saved baseline, the contract and the repair ideas, then edit release/runbook.sh, tests/normalizeRef.cases.md and notes/migration-handoff.md and replay.",
    success: ["The patch that ships works for importOrders and nightReconcile", "Both trials start from 54a, apart, and trace callers before editing; the label ships alone", "After compaction nothing is redone and every open path is inspected"],
  },
  prebrief: {
    concept: "Long code investigations go better when you plan the risky part, branch experiments from a verified point, let concrete expected results pick the fix, and write the state down outside the conversation.",
    terms: [["Explore and propose before editing", "Plan mode (--permission-mode plan)"], ["Branch from a known-good point", "--resume <session> --fork-session"],
      ["Test with expected outputs, then iterate", "Test-driven iterative refinement"], ["Notes that survive a context reset", "Scratchpad file across /compact"],
      ["Split work along what depends on what", "Task decomposition by dependency"]],
    contrast: {
      good: "A renovation crew surveys the wiring before moving walls, tries two layouts on copies of the same floor plan and keeps a log of what has been inspected.",
      bad: "A crew that knocks down walls first and tries both layouts on one plan cannot tell which idea broke the lights.",
    },
  },
  documents: [
    { id: "baseline", title: "Saved baseline · session migration-54a", text: "Commit 54a, all tests green. Verified call paths: importOrders → normalizeRef, and nightReconcile → normalizeRef → secondary ledger (a second database nobody had documented). Tested and rejected: the timezone theory (batch timestamps an hour off). Not yet inspected: reconcile/ledgerSync.ts, billing/exportRefs.ts, api/orderLookup.ts." },
    { id: "contract", title: "Contract · normalizeRef", text: "normalizeRef(null): the supplier sent no reference → absent. normalizeRef(\"\"): the field arrived blank, which the ledger format forbids → invalid. Any other string → the reference trimmed and upper-cased (\" nl-0042 \" → NL-0042). The contract is the same for every caller." },
    { id: "bugs", title: "Bug reports", text: "1. The nightly import crashed on an order with no reference (null).\n2. A blank reference (\"\") was written to the ledger as if it were real." },
    { id: "ideas", title: "Repair ideas · Priya Shah", text: `Idea A: ${ideas.A}. Idea B: ${ideas.B}. Try each from the verified 54a session, separately, and let the test table pick. The order-label change (src/labels.ts, ‘Ref’ → ‘Order ref’) touches no identifier code and takes ten minutes.` },
    { id: "runner", title: "Test runner · tests/normalizeRef.cases.md", text: "One row per case: Caller (importOrders or nightReconcile), Input (null, \"\" or a reference string) and Expected (absent, invalid, or the normalized reference). The runner runs every row against the deployed code and against each trial’s patch, A first; the first patch that passes every row ships." },
    { id: "omar", title: "Omar Wells · release engineer", text: "The session will compact within the hour. Whoever picks it up reads notes/migration-handoff.md and nothing else." },
  ],
  artifacts: [
    { id: "runbook", kind: "claude-code.cli", path: "release/runbook.sh", editor: "shell", instruction: "The claude commands the operator runs today, in order. Session migration-54a already exists.", starter: starter.runbook,
      example: "# Docs typo\nclaude -p \"Fix the typo in README.md line 4.\"\n# Two layouts from the saved design session\nclaude --resume design-7 --fork-session -n layout-1 \"Try layout 1.\"" },
    { id: "cases", kind: "test-cases", path: "tests/normalizeRef.cases.md", editor: "markdown", instruction: "Expected results for normalizeRef. The test runner reads the table.", starter: starter.cases,
      example: "| Caller | Input | Expected |\n|---|---|---|\n| checkout | \"\" | invalid |" },
    { id: "handoff", kind: "handoff-note", path: "notes/migration-handoff.md", editor: "markdown", instruction: "The scratchpad the next operator reads after the session compacts.", starter: starter.handoff,
      example: "# Refund flow investigation\n\n## Confirmed\n- api/refunds.py → RefundService.issue\n\n## Open questions\n- jobs/ callers" },
  ],
  engine: investigationEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many minutes will the next operator spend redoing work after compaction?", unit: "min",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.repeatMinutes ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { nightnull: reference, nightblank: reference } },
  mutants: [
    { name: "both trials resume the baseline without forking", set: "sample", mustFail: ["trials-isolated"],
      edit: (files) => swap(files, { runbook: runbook({ a: trialCommand("A", "--resume migration-54a --permission-mode plan"), b: trialCommand("B", "--resume migration-54a --permission-mode plan") }) }) },
    { name: "trial B continues trial A", set: "sample", mustFail: ["trials-isolated"], edit: (files) => swap(files, { runbook: runbook({ b: trialCommand("B", "--continue --permission-mode plan") }) }) },
    { name: "trials start fresh", set: "sample", mustFail: ["trials-isolated"],
      edit: (files) => swap(files, { runbook: runbook({ a: trialCommand("A", "-n trial-a --permission-mode plan"), b: trialCommand("B", "-n trial-b --permission-mode plan") }) }) },
    { name: "trial B forked from trial A", set: "sample", mustFail: ["trials-isolated"], edit: (files) => swap(files, { runbook: runbook({ b: trialCommand("B", "--resume trial-a --fork-session -n trial-b --permission-mode plan") }) }) },
    { name: "trials in default mode", set: "sample", mustFail: ["migration-planned"],
      edit: (files) => swap(files, { runbook: runbook({ a: trialCommand("A", "--resume migration-54a --fork-session -n trial-a"), b: trialCommand("B", "--resume migration-54a --fork-session -n trial-b") }) }) },
    { name: "label fix planned first", set: "sample", mustFail: ["label-direct"], edit: (files) => swap(files, { runbook: runbook({ label: labelCommand("--permission-mode plan") }) }) },
    { name: "label fix folded into trial A", set: "sample", mustFail: ["label-direct"],
      edit: (files) => swap(files, { runbook: runbook({ label: "", a: trialCommand("A").replace("Trace every caller", "Also change the order label in src/labels.ts. Trace every caller") }) }) },
    { name: "importOrders rows only", set: "sample", mustFail: ["both-callers"], edit: (files) => swap(files, { cases: cases(fullCases.slice(0, 3)) }) },
    { name: "blank expected as absent", set: "sample", mustFail: ["red-then-green"],
      edit: (files) => swap(files, { cases: cases(fullCases.map(([caller, value, expected]) => [caller, value, value === "\"\"" ? "absent" : expected] as const)) }) },
    { name: "null expected to crash", set: "sample", mustFail: ["red-then-green"],
      edit: (files) => swap(files, { cases: cases(fullCases.map(([caller, value, expected]) => [caller, value, value === "null" ? "crash" : expected] as const)) }) },
    { name: "note without the rejected theory", set: "sample", mustFail: ["no-rework"], edit: (files) => swap(files, { handoff: note(["head", "verified", "pending"]) }) },
    { name: "open paths listed with the verified ones", set: "sample", mustFail: ["pending-carried"],
      edit: (files) => swap(files, { handoff: note(["head", "verified", "rejected"]).replace("- nightReconcile → normalizeRef → secondary ledger\n", "- nightReconcile → normalizeRef → secondary ledger\n- reconcile/ledgerSync.ts\n- billing/exportRefs.ts\n- api/orderLookup.ts\n") }) },
    { name: "note with only the open paths", set: "sample", mustFail: ["no-rework"], edit: (files) => swap(files, { handoff: note(["head", "pending"]) }) },
    { name: "table skips nightReconcile null", set: "transfer", variant: "nightnull", mustFail: ["both-callers"], edit: (files) => swap(files, { cases: cases(fullCases.filter((_, index) => index !== 3)) }) },
    { name: "table skips nightReconcile blank", set: "transfer", variant: "nightblank", mustFail: ["both-callers"], edit: (files) => swap(files, { cases: cases(fullCases.filter((_, index) => index !== 4)) }) },
  ],
  probes: [
    { name: "table that expects whatever the deployed code does", set: "sample", mustFail: ["red-then-green"],
      files: (files) => swap(files, { cases: cases(fullCases.map(([caller, value, expected]) => [caller, value, value === "null" ? "crash" : value === "\"\"" ? "\"\"" : expected] as const)) }) },
    { name: "every fact under every heading", set: "sample", mustFail: ["pending-carried"],
      files: (files) => swap(files, { handoff: `${note()}\n## Done\n- reconcile/ledgerSync.ts billing/exportRefs.ts api/orderLookup.ts importOrders nightReconcile timezone\n` }) },
  ],
  overfit: { ...reference, cases: cases([fullCases[0], fullCases[1], fullCases[2], fullCases[5]]) },
  fixTerms: ["--fork-session", "--permission-mode", "fork"],
  debrief: "The label change is small and known, so it runs directly in its own session. The identifier migration has an undocumented caller, so both trials run in plan mode, and each is forked from the verified migration-54a session (--resume migration-54a --fork-session) so they share its findings and never each other’s edits. The expected-results table encodes the contract (null → absent, \"\" → invalid, a reference → normalized) for both callers: it fails on the deployed code, rejects trial A’s patch that breaks nightReconcile, and lets the correct patch ship. The handoff note separates verified paths, rejected theories and the three paths still to inspect, so the session after /compact redoes nothing and misses nothing.",
};
