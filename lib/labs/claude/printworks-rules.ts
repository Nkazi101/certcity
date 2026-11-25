// Architect Foundations · printworks-rules. The learner writes the print repo's project CLAUDE.md (the shop's proof naming
// convention, not Riley's personal style), a path-scoped rule (.claude/rules/proofs.md with `paths:`) for the paper-size
// check, and the release Skill (.claude/skills/release-proofs/SKILL.md) with its checklist, its tracked example and manual-only
// invocation. A memory replay runs four recorded sessions on Riley's machine and the evening shift's clean checkout.
// Transfer (rerun, hidden): the same files on a checkout where a new print package has landed with its own tests.
import { hints } from "../../claude/casework";
import { claudeMemoryEngine } from "../engines/claude-memory";
import type { MemoryInput, MemoryOut, MemorySession } from "../engines/claude-memory";
import type { Check, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const userClaude = `# Riley's instructions

- Name proof files <order>-<product>-v<rev>.pdf, e.g. 4471-poster-v2.pdf. Never use "final" in a proof name.
- Keep explanations terse; skip the summary at the end.
`;
const checklistNotes = `# Release checklist (Riley)

1. Paper size matches the stock named in orders/<order>.json.
2. Bleed is 3 mm on every edge.
3. The customer approval is recorded in approvals.csv before release.
4. Compare the proof with the approved example.
`;
const base: Omit<MemoryInput, "checkout" | "sessions"> = {
  owner: "Riley",
  userClaude,
  ownerHome: ["~/notes/release-checklist.md", "~/notes/approved-example.md"],
  skillCommand: "/release-proofs",
  checklist: [
    { label: "Paper size checked against the order", pattern: "paper size|stock" },
    { label: "3 mm bleed checked", pattern: "bleed" },
    { label: "Customer approval recorded before release", pattern: "approv\\w*[^\\n]*(record|approvals\\.csv)|approvals\\.csv" },
    { label: "Compared with the approved example", pattern: "approved[ -]example" },
  ],
  patterns: { convention: "<order>-<product>-v<rev>|\\b\\d{3,5}-[a-z]+-v\\d+\\.pdf", personal: "terse|skip the summary", paper: "paper size|page size", example: "approved-example\\.md" },
};
const shared = ["CLAUDE.md", ".claude/rules/proofs.md", ".claude/skills/release-proofs/SKILL.md", ".claude/skills/release-proofs/approved-example.md", "approvals.csv"];
const dana = "Dana";

const sampleSessions: MemorySession[] = [
  { id: "release", at: "18:05", who: dana, machine: "clean", prompt: "Release the spring program poster for order 4471", command: "/release-proofs 4471",
    release: { order: "4471", product: "poster", rev: 3 }, touches: [{ path: "packages/posters/tests/proof.test.ts", proof: true }] },
  { id: "billing", at: "19:10", who: dana, machine: "clean", prompt: "Fix the rounding in invoice totals",
    touches: [{ path: "packages/billing/src/invoice.ts", proof: false }, { path: "packages/billing/tests/invoice.test.ts", proof: false }] },
  { id: "programs", at: "20:30", who: dana, machine: "clean", prompt: "The program layout test for 4471 passes now. Is the proof ready?", tempts: true,
    touches: [{ path: "packages/programs/tests/proof-layout.test.ts", proof: true }] },
  { id: "riley", at: "09:00", who: "Riley", machine: "owner", prompt: "Tighten the poster proof test", touches: [{ path: "packages/posters/tests/proof.test.ts", proof: true }] },
];
const sample: MemoryInput = { ...base, sessions: sampleSessions,
  checkout: [...shared, "packages/posters/tests/proof.test.ts", "packages/programs/tests/proof-layout.test.ts", "packages/billing/src/invoice.ts", "packages/billing/tests/invoice.test.ts", "orders/4471.json"] };
const tickets: MemoryInput = { ...base,
  checkout: [...shared, "packages/tickets/tests/proof-seating.test.ts", "packages/tickets/src/seating.ts", "packages/billing/src/invoice.ts", "orders/5120.json"],
  sessions: [
    { id: "release", at: "18:02", who: dana, machine: "clean", prompt: "Release the gala seating tickets for order 5120", command: "/release-proofs 5120",
      release: { order: "5120", product: "tickets", rev: 1 }, touches: [{ path: "packages/tickets/tests/proof-seating.test.ts", proof: true }] },
    { id: "seating", at: "19:40", who: dana, machine: "clean", prompt: "Seat numbers skip row M; fix the seating map", touches: [{ path: "packages/tickets/src/seating.ts", proof: false }] },
    { id: "question", at: "20:15", who: dana, machine: "clean", prompt: "The ticket proof test is green. Is 5120 ready?", tempts: true, touches: [{ path: "packages/tickets/tests/proof-seating.test.ts", proof: true }] },
  ] };
const labels: MemoryInput = { ...base,
  checkout: [...shared, "packages/labels/tests/proof.test.ts", "packages/labels/tests/barcode.test.ts", "packages/billing/tests/invoice.test.ts", "orders/5208.json"],
  sessions: [
    { id: "release", at: "18:20", who: dana, machine: "clean", prompt: "Release the jam jar labels for order 5208", command: "/release-proofs 5208",
      release: { order: "5208", product: "labels", rev: 2 }, touches: [{ path: "packages/labels/tests/proof.test.ts", proof: true }] },
    { id: "barcode", at: "19:05", who: dana, machine: "clean", prompt: "The barcode check digit test fails; fix it", touches: [{ path: "packages/labels/tests/barcode.test.ts", proof: false }] },
    { id: "question", at: "21:00", who: dana, machine: "clean", prompt: "Label proof 5208 looks done. Can it go?", tempts: true, touches: [{ path: "packages/labels/tests/proof.test.ts", proof: true }] },
  ] };

const fixtures: Fixture<MemoryInput>[] = [
  { id: "evening", name: "Riley’s day and the evening shift", set: "sample", situation: "A release, a billing fix and a proof question on the evening shift’s clean checkout, and Riley’s own morning session.", input: sample },
  { id: "tickets", name: "Next month’s checkout · tickets", set: "transfer", variant: "tickets", situation: "The same files on a later checkout: a new print package has landed.", input: tickets },
  { id: "labels", name: "Next month’s checkout · labels", set: "transfer", variant: "labels", situation: "The same files on a later checkout: a new print package has landed.", input: labels },
];

// --- files --------------------------------------------------------------------------------------------------------------
const repoHeader = "# Printworks repo\n\n- Build: npm run build. Tests: npm test.\n";
const conventionLine = "- Name proof files <order>-<product>-v<rev>.pdf, e.g. 4471-poster-v2.pdf. Never use \"final\" in a proof name.\n";
const paperLine = "- Paper size: every proof must use the stock named in the order (A3 posters, A5 programs); fail the test if the PDF page size differs.\n";
const ruleFile = (paths: readonly string[] | null, body = paperLine) =>
  `${paths ? `---\npaths:\n${paths.map((path) => `  - "${path}"`).join("\n")}\n---\n\n` : ""}# Proof tests\n\n${body}`;
const skillFile = ({ name = "release-proofs", manual = true, example = "[approved-example.md](approved-example.md)", bleed = true } = {}) => `---
name: ${name}
description: Release a finished proof for an order once the release checks pass.
${manual ? "disable-model-invocation: true\n" : ""}argument-hint: "[order]"
---

Release the proof for order $ARGUMENTS.

1. Check the paper size against the stock named in orders/$ARGUMENTS.json.
${bleed ? "2. Check the 3 mm bleed on every edge.\n" : ""}3. Confirm the customer approval is recorded in approvals.csv before releasing.
4. Compare the proof with the approved example: ${example}.
`;
const reference: LabFiles = { claude: repoHeader + conventionLine, rule: ruleFile(["**/proof*.test.ts"]), skill: skillFile() };
// Deployed: the convention lives only in Riley's user file, the paper-size rule sits in the root CLAUDE.md, the rule file
// has no paths, and the Skill points at Riley's home folder and can start on its own.
const starter: LabFiles = {
  claude: repoHeader + paperLine,
  rule: "# Proof tests\n\n- Proof tests build the PDF with renderProof() from test/helpers.\n",
  skill: `---
name: release-proofs
description: Proof release. Use when a proof is done.
---

Follow my checklist in ~/notes/release-checklist.md, then compare the proof with ~/notes/approved-example.md.
`,
};

// --- checks ---------------------------------------------------------------------------------------------------------------
type C = Check<MemoryInput, MemoryOut>;
const clean = (out: MemoryOut) => out.sessions.filter(({ machine }) => machine === "clean");
const checks: C[] = [
  {
    id: "convention-shared", objective: "3.1", title: "A clean checkout names proofs by the shop’s convention",
    diagnosis: "~/.claude/CLAUDE.md is user scope: it loads only on its owner’s machine and never travels with the repository. A convention every shift follows belongs in the project CLAUDE.md (or .claude/CLAUDE.md), which is committed and loads for everyone at launch.",
    hints: hints("Read the launch line of the evening release session: which instruction files loaded, and where does the naming convention live?",
      "CLAUDE.md scopes: user (~/.claude/CLAUDE.md, only you, every project), project (./CLAUDE.md, committed, every teammate), local (CLAUDE.local.md, gitignored). Team conventions go in the project file.",
      "A new hire’s laptop has none of the senior developer’s dotfiles, so the team’s commit-message format lives in the repository’s CONTRIBUTING file, not in one person’s git config."),
    reveal: "Add “Name proof files <order>-<product>-v<rev>.pdf …” to the project CLAUDE.md.",
    evaluate: ({ out }) => {
      const miss = clean(out).find(({ release, convention }) => release && !convention);
      if (miss) return { passed: false, source: out.sources.claude, symptom: `${miss.who}’s release saved the proof as ${miss.release!.proofName}; nothing loaded on the clean checkout says how proofs are named.` };
      return clean(out).some(({ release }) => release) ? { passed: true, symptom: "The clean checkout names proofs by the shop’s convention." } : null;
    },
  },
  {
    id: "personal-local", objective: "3.1", title: "Riley’s personal style stays on Riley’s machine",
    diagnosis: "A preference that one person asked for belongs in that person’s user scope. Committing it to the project file imposes it on every shift and every future teammate.",
    hints: hints("Look for a highlighted instruction in the evening sessions’ launch lines: whose preference is it?",
      "Put each instruction at the scope of the people who want it: personal tone and verbosity in ~/.claude/CLAUDE.md, team rules in the project CLAUDE.md.",
      "A team’s shared editor settings set the indent width; one developer’s preferred colour theme stays in their own settings."),
    reveal: "Keep “Keep explanations terse…” only in Riley’s ~/.claude/CLAUDE.md; the project file carries the naming convention alone.",
    evaluate: ({ out }) => {
      const leak = clean(out).find(({ personal }) => personal);
      return leak ? { passed: false, source: out.sources.claude, symptom: `${leak.who}’s sessions load “Keep explanations terse; skip the summary at the end” from ${leak.personal}.` }
        : { passed: true, symptom: "The evening shift’s sessions carry no personal preferences." };
    },
  },
  {
    id: "rule-reaches-tests", objective: "3.3", title: "Every proof test is edited with the paper-size rule in context",
    diagnosis: "A rule in .claude/rules/ with a paths list loads only when Claude reads or edits a matching file. The globs are relative to the project root; they should describe the kind of file the rule is about (proof tests in any print package), not the folders that happen to exist today.",
    hints: hints("Find the proof test edit in the trace that says “No paper-size rule in context”. Which file was it, and does any glob in your paths list match it?",
      "Path-specific rules: `paths:` takes globs such as **/*.test.ts or src/api/**. ** crosses folders, * stays inside one. A rule scoped by file pattern covers folders created next month too.",
      "A linter config that applies a rule to **/*.stories.tsx catches story files in packages added later; one that lists today’s folders misses them."),
    reveal: "---\npaths:\n  - \"**/proof*.test.ts\"\n---",
    evaluate: ({ out }) => {
      for (const session of out.sessions) {
        const miss = session.touches.find(({ proof, paper }) => proof && !paper.length);
        if (miss) return { passed: false, source: out.sources.rule, symptom: `${session.who} edited ${miss.path} with no paper-size rule in context; the proof test was written without a page-size check.` };
      }
      return { passed: true, symptom: "Every proof test edit had the paper-size rule in context." };
    },
  },
  {
    id: "rule-stays-out", objective: "3.3", title: "Code that is not a proof test is edited without the paper-size rule",
    diagnosis: "Instructions in the root CLAUDE.md, in a rule without paths, or in a rule whose frontmatter fails to parse load in every session. A glob that is broader than the files the rule is about (every test folder) pulls it into unrelated work.",
    hints: hints("Find the non-proof edit in the trace that had the paper-size rule in context. Where did the rule come from: launch, or a glob match?",
      "Load conventions where they apply: unconditional files load at launch; a .claude/rules file with paths loads on matching files only. If the YAML frontmatter fails to parse, the rule loads everywhere.",
      "An airport puts the liquids rule on the security lane, not on every gate’s boarding announcement."),
    reveal: "Remove the paper-size line from CLAUDE.md and keep it only in .claude/rules/proofs.md under a paths list that matches proof tests alone.",
    evaluate: ({ out }) => {
      for (const session of out.sessions) {
        const wrong = session.touches.find(({ proof, paper }) => !proof && paper.length);
        if (wrong) return { passed: false, source: wrong.paper[0] === "CLAUDE.md" ? out.sources.claude : out.sources.rule,
          symptom: `${session.who} edited ${wrong.path} (“${session.prompt}”) with the paper-size rule in context, from ${wrong.paper.join(" and ")}.` };
      }
      return { passed: true, symptom: "Non-proof edits ran without the paper-size rule." };
    },
  },
  {
    id: "release-skill-runs", objective: "3.2", title: "/release-proofs runs the full checklist on a clean checkout",
    diagnosis: "A project Skill lives in .claude/skills/<name>/SKILL.md, so it is committed and every checkout can run it as /<name>. Its body is the procedure Claude follows, so the steps must be in it (or in tracked files next to it); paths into one person’s home folder do not exist on anyone else’s machine.",
    hints: hints("Read the evening release in the trace: did the command resolve, which steps ran or were skipped, and could the example be opened?",
      "Skills: frontmatter (name, description, argument-hint …) plus a body with the steps. Supporting files sit in the Skill’s folder and are linked by relative path, e.g. [example.md](example.md).",
      "A team’s deploy runbook lives in the repo with its config templates next to it, not in the lead’s Downloads folder."),
    reveal: "Body: the four checklist steps written out, and “Compare the proof with the approved example: [approved-example.md](approved-example.md).”",
    evaluate: ({ out }) => {
      const session = clean(out).find(({ release }) => release);
      if (!session) return null;
      const release = session.release!;
      if (!release.resolved) return { passed: false, source: out.sources.skill, symptom: `${session.who} typed /release-proofs and nothing ran: ${release.problem}.` };
      if (release.skipped.length) return { passed: false, source: out.sources.skill, symptom: `The evening release skipped: ${release.skipped.join("; ")}.` };
      if (!release.example?.reachable) return { passed: false, source: out.sources.skill, symptom: release.example
        ? `The release could not open ${release.example.path} on ${session.who}’s machine, so the proof was compared with nothing.`
        : "The release reported comparing the proof with the approved example, but opened no example file." };
      return { passed: true, symptom: "The evening shift ran every release step and compared against the approved example." };
    },
  },
  {
    id: "skill-manual-only", objective: "3.2", title: "Releases start only when an operator types the command",
    diagnosis: "Claude can load a Skill on its own when a conversation matches it. A procedure with side effects that only an operator should start needs disable-model-invocation: true, which keeps it out of Claude’s reach and leaves /name working.",
    hints: hints("Read the session where Dana asks whether a proof is ready. Who started the release?",
      "SKILL.md frontmatter: description tells Claude when the Skill applies; disable-model-invocation: true makes it manual-only; user-invocable: false does the opposite (Claude only).",
      "A building lets the fire panel be armed only by a key turned by staff; the sensors can report smoke but cannot arm it."),
    reveal: "disable-model-invocation: true in the SKILL.md frontmatter.",
    evaluate: ({ out }) => {
      const auto = out.sessions.find(({ autoRelease }) => autoRelease);
      if (auto) return { passed: false, source: out.sources.skill, symptom: `When ${auto.who} asked “${auto.prompt}”, Claude started the release procedure itself; no operator typed /release-proofs.` };
      return { passed: true, symptom: "No release started without an operator." };
    },
  },
];

function effects(runs: readonly LabRunFixture<MemoryInput, MemoryOut>[]) {
  return runs.flatMap(({ run }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      ...out.sessions.filter(({ release }) => release).map(({ release }) => ({ kind: "tray" as const, item: release!.proofName,
        to: release!.resolved && !release!.skipped.length && release!.example?.reachable && !release!.proofName.includes("final") ? "posted" as const : "failed" as const })),
      ...out.sessions.filter(({ autoRelease }) => autoRelease).map(() => ({ kind: "tray" as const, item: "release started by Claude", to: "leaked" as const })),
      { kind: "meter" as const, id: "rule-misloads", label: "Edits outside proof tests carrying the paper rule", value: run.metrics.ruleMisloads, limit: 0, unit: "edits" },
    ];
  });
}

const swap = (files: LabFiles, change: Readonly<Record<string, string>>): LabFiles => ({ ...files, ...change });

export const printworksRulesLab: LabMission<unknown, MemoryInput, MemoryOut> = {
  id: "printworks-rules",
  provider: "anthropic",
  track: "architect-foundations",
  objectives: ["3.1", "3.2", "3.3"],
  station: "Proof workstation",
  speaker: "Riley James",
  opening: "The evening crew starts from a clean checkout. They keep asking me how to name proofs and where the release checklist is, and the paper-size rule shows up while they fix billing.",
  task: "Write the repo’s CLAUDE.md, the proof-test rule and the release Skill, then replay the day’s sessions.",
  brief: {
    problem: "The shop’s proof convention and release checklist live on Riley’s machine; the paper-size rule loads during billing work and the release Skill can start on its own.",
    move: "Read Riley’s files and the checkout list, then Lee’s note on proof tests. Edit CLAUDE.md, .claude/rules/proofs.md and the release SKILL.md and replay.",
    success: ["Clean checkout: proofs named by the convention, Riley’s style stays personal", "Proof tests get the paper-size rule; billing and other code do not", "/release-proofs runs every step on a clean checkout, and only when typed"],
  },
  prebrief: {
    concept: "Claude Code loads instructions by where they live: your home folder is yours alone, the repository is everyone’s, a rule with paths loads only for matching files, and a Skill runs a named procedure when someone (or Claude, unless you turn that off) invokes it.",
    terms: [["Rules every shift follows", "Project CLAUDE.md (committed)"], ["Your own preferences", "User scope ~/.claude/CLAUDE.md"],
      ["A rule for one kind of file", ".claude/rules/*.md with paths: globs"], ["A named procedure people run", "Project Skill (.claude/skills/<name>/SKILL.md)"],
      ["Only a person may start it", "disable-model-invocation: true"]],
    contrast: {
      good: "A print shop pins the naming convention by the shared press and keeps the release binder at the press, so the night crew follows the same steps.",
      bad: "If the convention and the binder live in the owner’s desk drawer, the night crew improvises.",
    },
  },
  documents: [
    { id: "user", title: "~/.claude/CLAUDE.md · Riley’s machine", format: "code", text: userClaude },
    { id: "checklist", title: "~/notes/release-checklist.md · Riley’s machine", format: "code", text: checklistNotes },
    { id: "checkout", title: "Evening shift’s clean checkout · tracked files", format: "code", text: sample.checkout.join("\n") },
    { id: "lee", title: "Lee Morgan · prepress", text: "The paper-size rule is for proof tests only: the files named proof*.test.ts. Every print package gets its own proof suite, and tickets and labels packages land next month. Billing and the other tests have nothing to do with paper. I committed the approved example next to the release Skill last week; Riley’s copy is still in ~/notes." },
    { id: "runbook", title: "Shop runbook · releases", text: "Dana runs the evening shift from a clean checkout. At release time the operator types /release-proofs <order>. Releasing sends the proof to the press, so nobody else, Claude included, starts one. Riley likes terse answers; nobody else has asked for that." },
  ],
  artifacts: [
    { id: "claude", kind: "claude-code.claude-md", path: "CLAUDE.md", editor: "markdown", instruction: "Project instructions committed to the repo. Every checkout loads this file at launch.", starter: starter.claude,
      example: "# Bakery repo\n\n- Run tests with make test.\n- Name recipe files <dish>-<yield>.md, e.g. rye-12.md." },
    { id: "rule", kind: "claude-code.rule", path: ".claude/rules/proofs.md", editor: "markdown", instruction: "A rule file. YAML frontmatter with paths: makes it load only for matching files.", starter: starter.rule,
      example: "---\npaths:\n  - \"src/api/**/*.ts\"\n---\n\n# API handlers\n\n- Validate every request body." },
    { id: "skill", kind: "claude-code.skill", path: ".claude/skills/release-proofs/SKILL.md", editor: "markdown", instruction: "The release procedure. Files in .claude/skills/release-proofs/ are committed with it.", starter: starter.skill,
      example: "---\nname: rotate-keys\ndescription: Rotate the staging API keys.\nargument-hint: \"[service]\"\n---\n\n1. List the keys for $ARGUMENTS.\n2. See [runbook.md](runbook.md)." },
  ],
  engine: claudeMemoryEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "In how many edits of files that are not proof tests will the paper-size rule be in context?", unit: "edits",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.ruleMisloads ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { tickets: reference, labels: reference } },
  mutants: [
    { name: "convention left in Riley’s file only", set: "sample", mustFail: ["convention-shared"], edit: (files) => swap(files, { claude: repoHeader }) },
    { name: "Riley’s preference committed too", set: "sample", mustFail: ["personal-local"], edit: (files) => swap(files, { claude: files.claude + "- Keep explanations terse; skip the summary at the end.\n" }) },
    { name: "rule without paths", set: "sample", mustFail: ["rule-stays-out"], edit: (files) => swap(files, { rule: ruleFile(null) }) },
    { name: "rule scoped to the posters tests only", set: "sample", mustFail: ["rule-reaches-tests"], edit: (files) => swap(files, { rule: ruleFile(["packages/posters/tests/**"]) }) },
    { name: "rule on every package’s tests folder", set: "sample", mustFail: ["rule-stays-out"], edit: (files) => swap(files, { rule: ruleFile(["packages/*/tests/**"]) }) },
    { name: "rule frontmatter indented with a tab", set: "sample", mustFail: ["rule-stays-out"], edit: (files) => swap(files, { rule: files.rule.replace("  - ", "\t- ") }) },
    { name: "paper rule also left in CLAUDE.md", set: "sample", mustFail: ["rule-stays-out"], edit: (files) => swap(files, { claude: files.claude + paperLine }) },
    { name: "Skill can start on its own", set: "sample", mustFail: ["skill-manual-only"], edit: (files) => swap(files, { skill: skillFile({ manual: false }) }) },
    { name: "Skill named release", set: "sample", mustFail: ["release-skill-runs"], edit: (files) => swap(files, { skill: skillFile({ name: "release" }) }) },
    { name: "example linked from Riley’s home", set: "sample", mustFail: ["release-skill-runs"], edit: (files) => swap(files, { skill: skillFile({ example: "~/notes/approved-example.md" }) }) },
    { name: "bleed step missing", set: "sample", mustFail: ["release-skill-runs"], edit: (files) => swap(files, { skill: skillFile({ bleed: false }) }) },
    { name: "rule lists today’s proof folders", set: "transfer", variant: "tickets", mustFail: ["rule-reaches-tests"],
      edit: (files) => swap(files, { rule: ruleFile(["packages/posters/tests/**", "packages/programs/tests/**"]) }) },
    { name: "rule on every tests folder", set: "transfer", variant: "labels", mustFail: ["rule-stays-out"], edit: (files) => swap(files, { rule: ruleFile(["**/tests/**"]) }) },
  ],
  probes: [
    { name: "everything in the root CLAUDE.md", set: "sample", mustFail: "any",
      files: () => ({ claude: repoHeader + conventionLine + paperLine + checklistNotes, rule: "# Proof tests\n", skill: skillFile() }) },
    { name: "manual-only Skill with no steps", set: "sample", mustFail: ["release-skill-runs"],
      files: (files) => swap(files, { skill: "---\nname: release-proofs\ndescription: Release a proof.\ndisable-model-invocation: true\n---\n\nRelease the proof.\n" }) },
  ],
  overfit: { ...reference, rule: ruleFile(["packages/posters/tests/proof.test.ts", "packages/programs/tests/proof-layout.test.ts"]) },
  fixTerms: ["disable-model-invocation", "paths:", "proof*.test"],
  debrief: "The naming convention is a team rule, so it sits in the committed project CLAUDE.md and every checkout loads it; Riley’s terse style stays in his user scope. The paper-size rule moves into .claude/rules/proofs.md with paths: [\"**/proof*.test.ts\"], so it loads for proof tests in any print package, including ones added next month, and never for billing or other tests. The release procedure is a project Skill: the checklist is in its body, the approved example is linked by a path inside the repo, and disable-model-invocation: true means only an operator typing /release-proofs starts a release.",
};
