// Architect Professional · regional-operations (slim rebuild). Priya is leaving the deployment; Devon’s shift takes
// over at 18:00. The learner writes the on-call runbook for the first ten minutes and the handoff packet. The runbook
// is played on the incident clock; the next shift then works from the packet alone: it pages the owner, replays the
// fixture on the release, checks each claim against its source, restarts the importer, loads the review procedure and
// routes the findings. Transfer (revise): a night incident on another release, with a different failed importer
// stage, a different procedure, and two defects that sound alike but break different contracts.
import { hints } from "../../claude/casework";
import { handoffEngine } from "../engines/handoff";
import type { ClockAction, Defect, HandoffInput, HandoffOut } from "../engines/handoff";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const catalog: ClockAction[] = [
  { id: "dashboard", pattern: "post .*dashboard|dashboard post|status page", minutes: 5, effect: "none", label: "Post to the status dashboard" },
  { id: "export", pattern: "export", minutes: 7, effect: "none", label: "Full dashboard export" },
  { id: "intake", pattern: "manual intake|staffed queue|route .*to (staff|a person|people)", minutes: 3, effect: "person", label: "Open the staffed queue (manual intake)" },
  { id: "hold", pattern: "hold .*writes|write queue", minutes: 2, effect: "none", label: "Hold writes in the queue" },
  { id: "page", pattern: "\\bpage\\b|on-?call", minutes: 1, effect: "owner", label: "Page the on-call owner" },
  { id: "email", pattern: "e-?mail", minutes: 4, effect: "none", label: "Email the team" },
  { id: "vendor", pattern: "vendor", minutes: 3, effect: "none", label: "Ping the vendor" },
  { id: "auto", pattern: "auto-?reply", minutes: 1, effect: "none", label: "Turn on the auto-reply" },
  { id: "wait", pattern: "wait|redeploy|next deploy", minutes: 8, effect: "none", label: "Wait for the next deploy" },
  { id: "diff", pattern: "compare|diff|permission|scope|service account|identity", minutes: 2, effect: "cause", label: "Compare the worker’s identity and scopes across releases" },
  { id: "logs", pattern: "log level|logging|verbose", minutes: 2, effect: "none", label: "Raise log levels" },
  { id: "restart", pattern: "restart", minutes: 2, effect: "none", label: "Restart the workers" },
];
const owners = ["platform on-call", "platform-oncall"];
const refundDefects: Defect[] = [
  { id: "D-1", title: "Refund amount accepts negative values", contract: "POST /refunds", input: "fixtures/refund-negative.json", reports: ["R-1", "R-2"] },
  { id: "D-2", title: "Export omits the currency", contract: "GET /export", input: "fixtures/export-no-currency.json", reports: ["R-3"] },
];
const nightDefects: Defect[] = [
  { id: "D-3", title: "Invoice amount rounds to whole dollars", contract: "POST /invoices", input: "fixtures/invoice-rounding.json", reports: ["R-4"] },
  { id: "D-4", title: "Permit fee amount accepts negative values", contract: "POST /permits", input: "fixtures/permit-negative-fee.json", reports: ["R-5", "R-6"] },
];

const evening: HandoffInput = {
  catalog, limit: 10, owners, release: "r17",
  repo: [{ path: "fixtures/w19-write-denied.json", reproduces: "r17" }, { path: "fixtures/w19-read.json" }, { path: "fixtures/refund-negative.json" }, { path: "fixtures/export-no-currency.json" }],
  sources: [{ id: "trace W-19", available: true }, { id: "deploy diff r17", available: true }, { id: "collection A", available: true }, { id: "collection B", available: false }],
  importer: { stages: ["validate", "write"], done: ["validate"], failed: "write", partialRows: 312 },
  skills: [".claude/skills/contract-review"],
  defects: refundDefects,
};
const night: HandoffInput = {
  catalog, limit: 10, owners, release: "r23",
  repo: [{ path: "fixtures/w31-permit-write-denied.json", reproduces: "r23" }, { path: "fixtures/w19-write-denied.json", reproduces: "r17" }, { path: "fixtures/invoice-rounding.json" }, { path: "fixtures/permit-negative-fee.json" }],
  sources: [{ id: "trace W-31", available: true }, { id: "deploy diff r23", available: true }, { id: "collection C", available: true }, { id: "collection D", available: false }],
  importer: { stages: ["validate", "transform", "write"], done: ["validate"], failed: "transform", partialRows: 140 },
  skills: [".claude/skills/release-review"],
  defects: nightDefects,
};

const fixtures: Fixture<HandoffInput>[] = [
  { id: "evening", name: "Write queue down · evening handoff", set: "sample", situation: "W-19 has failed every write since r17 went out at 14:00; reads still work. Devon takes over at 18:00.", input: evening },
  { id: "night", name: "Permit writes down · night handoff", set: "transfer", variant: "night", situation: "W-31’s permit writes fail since r23; the importer stopped mid-transform; two reviewers filed findings that sound alike.", input: night },
];

const runbookFile = (worker: string, from: string, to: string) => `# First ten minutes · writes failing

1. Page on-call
2. Open the staffed queue for residents (manual intake)
3. Compare ${worker}'s identity and scopes between ${from} and ${to}
`;
type Packet = { release: string; fixture: string; expect: string; evidence: string[]; resume: string; procedure: string; findings: readonly (readonly [string, string, string, string])[] };
const handoffFile = (packet: Packet) => `# Handoff · ${packet.release} write failures

## Owner
Platform on-call rotation (pager: platform-oncall). Primary from 18:00: Devon Hill.

## Deployed
Release: ${packet.release}

## Reproduce
Fixture: ${packet.fixture}
Expect: ${packet.expect}

## Evidence
${packet.evidence.map((line) => `- ${line}`).join("\n")}

## Resume
\`${packet.resume}\`

## Procedure
${packet.procedure}

## Findings
| Finding | Contract | Failing input | Reported by |
|---|---|---|---|
${packet.findings.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`;
const eveningPacket: Packet = {
  release: "r17", fixture: "fixtures/w19-write-denied.json", expect: "write denied for W-19, read allowed",
  evidence: ["Writes for W-19 are denied since r17 [trace W-19]", "r17 moved W-19 to a new service account without the write scope [deploy diff r17]", "No failed writes in collection A before r17 [collection A]", "Gap: collection B was unavailable during the incident; not checked"],
  resume: "importer resume --from write --discard-partial",
  procedure: "Contract review: .claude/skills/contract-review/ (versioned in the repo; loads under each team’s permissions)",
  findings: [["Refund amount accepts negative values", "POST /refunds amount", "fixtures/refund-negative.json", "Ana, Ben (R-1, R-2)"], ["Export omits the currency", "GET /export currency", "fixtures/export-no-currency.json", "Ana (R-3)"]],
};
const nightPacket: Packet = {
  release: "r23", fixture: "fixtures/w31-permit-write-denied.json", expect: "permit write denied for W-31, read allowed",
  evidence: ["Permit writes for W-31 are denied since r23 [trace W-31]", "r23 rotated W-31’s credentials to a role without the permit write scope [deploy diff r23]", "Collection C shows no permit write failures before r23 [collection C]", "Gap: collection D was unavailable; not checked"],
  resume: "importer resume --from transform --discard-partial",
  procedure: "Release review: .claude/skills/release-review/ (versioned in the repo)",
  findings: [["Invoice amount rounds to whole dollars", "POST /invoices amount", "fixtures/invoice-rounding.json", "Cy (R-4)"], ["Permit fee amount accepts negative values", "POST /permits fee", "fixtures/permit-negative-fee.json", "Dee, Cy (R-5, R-6)"]],
};
const sampleRef: LabFiles = { runbook: runbookFile("W-19", "r16", "r17"), handoff: handoffFile(eveningPacket) };
const transferRef: LabFiles = { runbook: runbookFile("W-31", "r22", "r23"), handoff: handoffFile(nightPacket) };
const packet = (base: Packet, change: Partial<Packet>) => (files: LabFiles): LabFiles => ({ ...files, handoff: handoffFile({ ...base, ...change }) });
const runbook = (lines: readonly string[]) => (files: LabFiles): LabFiles => ({ ...files, runbook: `# First ten minutes · writes failing\n\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}\n` });

// Deployed: Priya’s draft. Broadcast first, wait for a fix, export everything; a handoff of screenshots, confidence
// scores, “run it again”, a wiki link and one finding per report.
const starter: LabFiles = {
  runbook: "# First ten minutes · writes failing\n\n1. Post the outage to the status dashboard\n2. Wait for the next deploy\n3. Full dashboard export\n",
  handoff: `# Handoff

## Owner
The implementation team (ask in #incident)

## Deployed
See the dashboard screenshots in screenshots/

## Evidence
- Access specialist: writes look blocked (confidence 0.92)
- Records specialist: no data problems found (confidence 0.88)

## Resume
\`importer run\`

## Procedure
Review steps: wiki/contract-review

## Findings
| Finding | Reported by |
|---|---|
| Refund total can go below zero | Ana |
| Amount field accepts negatives | Ben |
| Currency missing from export | Ana |
`,
};

const clockDoc: LabDocument = { id: "clock", title: "Incident clock", format: "code", text: catalog.map(({ label, minutes }) => `${String(minutes).padStart(2)} min  ${label}`).join("\n") + "\nResidents count as served once a person can take their request; the on-call rotation is the accountable owner." };
const standardDoc: LabDocument = { id: "standard", title: "Handoff standard · signed by Priya Shah", text: "The next shift must be able to reproduce the failure and know whom to call without asking anyone on this shift. Every claim names the source it came from, and anything that could not be checked is written down as a gap. No finished import stage runs twice. The team that inherits the service uses the same review procedure as the team that built it. One finding per defect, routed to the owner of the contract it breaks." };
const importerDoc = (input: HandoffInput, detail: string): LabDocument => ({ id: "importer", title: "Importer restart", format: "code", text: [
  `Stages, in order: ${input.importer.stages.join(" → ")}.`, detail,
  "importer run                                   start again from the first stage",
  "importer resume --from <stage> [--discard-partial]",
  "    reruns <stage> and the stages after it; --discard-partial first removes rows a failed run half-wrote",
].join("\n") });
const repoDoc = (input: HandoffInput): LabDocument => ({ id: "repo", title: "Repository · ops files", format: "code", text: [...input.repo.map(({ path }) => path), "screenshots/dashboard-1402.png",
  ...input.skills.map((path) => `${path}/SKILL.md`), ...(input.skills.includes(".claude/skills/contract-review") ? [] : [".claude/skills/contract-review/SKILL.md"]), "wiki/contract-review (team wiki page, not in the repo)"].join("\n") });

const eveningDocs: LabDocument[] = [
  clockDoc, standardDoc,
  { id: "trace", title: "Trace W-19 · Priya Shah", text: "Release r17 went out at 14:00. Since then every write by worker W-19 is denied; reads succeed. No code in the write path changed in r17; the deploy did change the worker’s service account. fixtures/w19-write-denied.json replays one denied write." },
  { id: "specialists", title: "Specialist reports", format: "code", text: [
    "Access specialist   W-19 writes denied since r17 (source: trace W-19). r17 moved W-19 to a new service account",
    "                    without the write scope (source: deploy diff r17).",
    "Records specialist  Collection A: no failed writes before r17. Collection B: unavailable during the incident, not checked.",
  ].join("\n") },
  importerDoc(evening, "validate finished at 02:10 and its result is stored. write failed at 02:40 with 312 rows half-written."),
  { id: "reviews", title: "Reviewer reports", format: "code", text: [
    "R-1  Ana  “Refund total can go below zero”   POST /refunds · fixtures/refund-negative.json",
    "R-2  Ben  “Amount field accepts negatives”   POST /refunds · fixtures/refund-negative.json",
    "R-3  Ana  “Currency missing from export”     GET /export · fixtures/export-no-currency.json",
    "Both teams follow the contract review procedure. Production permissions are enforced centrally.",
  ].join("\n") },
  repoDoc(evening),
];
const nightDocs: LabDocument[] = [
  clockDoc, standardDoc,
  { id: "trace", title: "Trace W-31 · night shift", text: "Release r23 went out at 22:00. Since then every permit write by worker W-31 is denied; reads succeed. r23 rotated W-31’s credentials. fixtures/w31-permit-write-denied.json replays one denied permit write." },
  { id: "specialists", title: "Specialist reports", format: "code", text: [
    "Access specialist   W-31 permit writes denied since r23 (source: trace W-31). r23 rotated W-31’s credentials to a role",
    "                    without the permit write scope (source: deploy diff r23).",
    "Records specialist  Collection C: no permit write failures before r23. Collection D: unavailable, not checked.",
  ].join("\n") },
  importerDoc(night, "validate finished at 03:05 and its result is stored. transform failed at 03:40 with 140 rows half-written; write never started."),
  { id: "reviews", title: "Reviewer reports", format: "code", text: [
    "R-4  Cy   “Amount is wrong on invoices”      POST /invoices · fixtures/invoice-rounding.json",
    "R-5  Dee  “Amount accepts negative values”   POST /permits · fixtures/permit-negative-fee.json",
    "R-6  Cy   “Negative permit fee accepted”     POST /permits · fixtures/permit-negative-fee.json",
    "Both teams now follow the release review procedure. Production permissions are enforced centrally.",
  ].join("\n") },
  repoDoc(night),
];

type C = Check<HandoffInput, HandoffOut>;
const minuteText = (value: number | null) => value === null ? "at no point in the first ten minutes" : `only at minute ${value}`;
const checks: C[] = [
  {
    id: "owner-first", objective: "6.5", title: "Someone accountable is engaged in the first minute",
    diagnosis: "An incident needs an owner before anything else: the monitored on-call rotation is reachable in a minute and is accountable for the decisions that follow. Broadcasting to a dashboard or a mailing list informs people without making anyone responsible.",
    hints: hints("Read the incident clock line: when was the accountable owner engaged, and what ran before that?",
      "Plan the monitoring and escalation path as part of the handoff: a named on-call owner, paged first, through the rotation the next team inherits.",
      "A ward nurse who finds a patient deteriorating calls the duty doctor first, then updates the board."),
    reveal: "1. Page on-call",
    evaluate: ({ out }) => out.clock.owner !== null && out.clock.owner <= 1 ? { passed: true, symptom: "The on-call owner was engaged at minute 1." }
      : { passed: false, symptom: `Someone accountable was engaged ${minuteText(out.clock.owner)}.`, source: out.clock.source },
  },
  {
    id: "residents-routed", objective: "1.2", title: "Residents reach a person within ten minutes",
    diagnosis: "The end-to-end flow needs a fallback for the users while automation is down: a manual route to staff that works without the failing path. Holding writes, an auto-reply or waiting for a deploy keeps residents waiting on the broken system.",
    hints: hints("Find the minute residents could first reach a person in the trace. Which actions in the runbook are about residents at all?",
      "Graceful degradation: design the flow so that when a component fails, requests take a manual route that still serves people, and put it early on the clock.",
      "When a supermarket’s self-checkouts fail, staff open the staffed tills; a sign saying “back soon” is not a route."),
    reveal: "2. Open the staffed queue for residents (manual intake)",
    evaluate: ({ out }, fixture) => out.clock.person !== null && out.clock.person <= fixture.input.limit ? { passed: true, symptom: `Residents reached a person at minute ${out.clock.person}.` }
      : { passed: false, symptom: `Residents reached a person ${minuteText(out.clock.person)}.`, source: out.clock.source },
  },
  {
    id: "cause-isolated", objective: "7.1", title: "The shift finds why writes are denied inside the ten minutes",
    diagnosis: "Reads work and writes fail after a deploy that changed no write-path code but did change the worker’s identity: the environment’s configuration is the suspect. Comparing the effective identity and scopes across releases finds it in minutes; exports, restarts and louder logs do not.",
    hints: hints("Read the trace and the specialist reports: what changed in the release, and which action on the clock looks at that?",
      "Support operational diagnosis by comparing the environment as configured: service accounts, scopes and permissions before and after the release.",
      "When a key card stops opening one door after a system update, security compares the card’s access list before and after the update instead of replacing the lock."),
    reveal: "3. Compare W-19's identity and scopes between r16 and r17",
    evaluate: ({ out }, fixture) => out.clock.cause !== null && out.clock.cause <= fixture.input.limit ? { passed: true, symptom: `The scope change was found at minute ${out.clock.cause}.` }
      : { passed: false, symptom: `The shift had a finding on the denied writes ${minuteText(out.clock.cause)}.`, source: out.clock.source },
  },
  {
    id: "reproducible", objective: "6.4", title: "The next shift reproduces the denied write from the handoff alone",
    diagnosis: "An operational handoff documents the system as deployed: the accountable owner, the exact release, and a failing fixture that reproduces the problem. Screenshots and chat threads describe symptoms but cannot be replayed.",
    hints: hints("Read the next shift’s first lines in the trace: whom did they call, what did they replay, and on which release?",
      "Document the architecture and implementation as deployed: owner, release identifier, and a reproducible failing case kept in the repo.",
      "A pilot hands over with the aircraft’s tail number, the fault code and the duty engineer’s name."),
    reveal: "## Owner (on-call rotation) · ## Deployed Release: r17 · ## Reproduce Fixture: fixtures/w19-write-denied.json",
    evaluate: ({ out }, fixture) => {
      const { reproduce } = out;
      if (!reproduce.owner) return { passed: false, symptom: "The next shift could not tell from the handoff whom to call.", source: { artifact: "handoff", line: 1 } };
      if (!reproduce.fixture) return { passed: false, symptom: "The handoff gives the next shift nothing they can replay.", source: reproduce.source };
      if (!reproduce.fixtureExists) return { passed: false, symptom: `${reproduce.fixture} is not in the repository.`, source: reproduce.source };
      if (!reproduce.reproduced) return { passed: false, symptom: `The next shift replayed ${reproduce.fixture} on ${reproduce.release ?? "an unnamed release"} and did not see the failure that is live on ${fixture.input.release}.`, source: reproduce.source };
      return { passed: true, symptom: `The next shift paged the owner and reproduced the denied write on ${fixture.input.release}.` };
    },
  },
  {
    id: "claims-checkable", objective: "1.4", title: "Every claim names its source, and what was not checked is written down",
    diagnosis: "When specialist agents or people report to a coordinator, their output is cited claims plus explicit gaps. Confidence scores cannot be checked; an unavailable source left unmentioned reads as verified.",
    hints: hints("Read the evidence lines in the trace: which claim has no source, or which source was not available?",
      "Structured specialist output: each claim carries the ID of the source it came from, and each source that could not be consulted is listed as a gap, so the coordinator can verify or disclose.",
      "A newsroom’s research memo lists each fact with its document and says which archive was closed, so the editor knows what is unconfirmed."),
    reveal: "- Writes for W-19 are denied since r17 [trace W-19] … - Gap: collection B was unavailable; not checked",
    evaluate: ({ out }) => {
      const { evidence } = out;
      if (evidence.unavailableCited.length) return { passed: false, symptom: `“${evidence.unavailableCited[0]}” cites a source that was unavailable during the incident.`, source: evidence.source };
      if (evidence.uncited.length) return { passed: false, symptom: `“${evidence.uncited[0]}” has no source the next shift can check.`, source: evidence.source };
      const unstated = evidence.gapsNeeded.filter((id) => !evidence.gapStated.includes(id));
      if (unstated.length) return { passed: false, symptom: `Nothing in the handoff says ${unstated.join(" and ")} went unchecked, so the next shift takes it as verified.`, source: evidence.source };
      return { passed: true, symptom: "Every claim was checked against its source, and the open gap is on record." };
    },
  },
  {
    id: "resume-checkpoint", objective: "1.5", title: "The importer restarts without rerunning a finished stage or duplicating rows",
    diagnosis: "Decompose long jobs into stages with stored, validated results, and resume from the first unfinished stage. Starting over reruns finished work; resuming over a half-written stage without clearing it duplicates rows.",
    hints: hints("Read the importer line in the trace: which stages reran, and what happened to the half-written rows?",
      "Checkpoint and resume at a validated stage boundary: the restart command names the stage that failed and clears its partial output first.",
      "A bakery whose oven fails mid-batch does not remake the dough that already proved; it bins the half-baked tray and bakes from the proved dough."),
    reveal: "`importer resume --from write --discard-partial`",
    evaluate: ({ out }, fixture) => {
      const { resume } = out;
      if (!resume.command || !resume.valid) return { passed: false, symptom: resume.command ? `The restart did not rerun the ${fixture.input.importer.failed} stage that failed.` : "The handoff gives no restart command the importer accepts.", source: resume.source };
      if (resume.reran.length) return { passed: false, symptom: `The restart ran ${resume.reran.join(" and ")} again, which had already finished and been stored.`, source: resume.source };
      if (resume.duplicates) return { passed: false, symptom: `The restart wrote ${resume.duplicates} rows a second time.`, source: resume.source };
      return { passed: true, symptom: `The importer resumed at ${resume.from} with nothing duplicated.` };
    },
  },
  {
    id: "procedure-loaded", objective: "7.2", title: "The incoming team’s assistant runs the same review procedure",
    diagnosis: "Team workflows stay consistent when a procedure is packaged as a versioned Agent Skill in the repository: every team’s assistant loads the same steps under its existing permissions. A wiki link is not loaded by the agent, pasted prompts drift, and an access override changes permissions instead of sharing a procedure.",
    hints: hints("Read the procedure line in the trace, then the repository listing: what could the assistant actually load?",
      "Agent Skills: a folder with SKILL.md (instructions, scripts, references) that Claude loads when relevant. Point the handoff at the Skill path the inheriting team’s assistant will find.",
      "Two kitchens share a recipe card kept in the recipe binder, not a photo of last year’s whiteboard."),
    reveal: "Contract review: .claude/skills/contract-review/",
    evaluate: ({ out }) => out.procedure.loaded ? { passed: true, symptom: "The incoming team’s assistant loaded the review procedure." }
      : { passed: false, symptom: `The incoming team’s assistant found no review procedure it could load (${out.procedure.path ?? out.procedure.kind}).`, source: out.procedure.source },
  },
  {
    id: "findings-deduped", objective: "7.3", title: "One finding per defect, each routed to the contract it breaks",
    diagnosis: "Deduplicate findings by root cause: the violated interface and the failing input that reproduces it. Similar wording merges different defects; different wording splits one defect into several reports for the same owner.",
    hints: hints("Read where each finding was routed in the trace. Which defect got two rows, which row went nowhere, and which row covers two contracts?",
      "Root-cause deduplication: key each finding on contract + failing input, list every reporter on that one row, and keep defects on different contracts apart even when they sound alike.",
      "A garage merges two complaints about the same brake part on the same car, and keeps a squeal from the brakes and a squeal from the fan belt as two jobs."),
    reveal: "| Refund amount accepts negative values | POST /refunds amount | fixtures/refund-negative.json | Ana, Ben |",
    evaluate: ({ out }, fixture) => {
      const { findings } = out;
      if (!findings.table) return { passed: false, symptom: "The handoff has no findings table the next shift can route.", source: findings.source };
      const name = (id: string) => fixture.input.defects.find(({ id: defect }) => defect === id)!;
      if (findings.merged.length) return { passed: false, symptom: `“${findings.merged[0]}” was routed to the owners of two different contracts.`, source: findings.source };
      if (findings.duplicates.length) return { passed: false, symptom: `The owner of ${name(findings.duplicates[0]).contract} received the same defect twice.`, source: findings.source };
      if (findings.unroutable.length) return { passed: false, symptom: `“${findings.unroutable[0]}” could not be routed to any contract owner.`, source: findings.source };
      if (findings.missing.length) return { passed: false, symptom: `Reports ${name(findings.missing[0]).reports.join(" and ")} reached no contract owner.`, source: findings.source };
      return { passed: true, symptom: `${fixture.input.defects.length} defects, ${fixture.input.defects.length} findings, each with its contract owner.` };
    },
  },
];

function effects(runs: readonly LabRunFixture<HandoffInput, HandoffOut>[]) {
  return runs.flatMap(({ run, fixture }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      { kind: "meter" as const, id: `${fixture.id}-clock`, label: "minutes until residents reach a person", value: out.clock.person ?? out.clock.total, limit: fixture.input.limit, unit: "min" },
      { kind: "tray" as const, item: "Handoff packet", to: out.reproduce.reproduced && out.resume.valid && !out.resume.reran.length && !out.resume.duplicates ? "posted" as const : "failed" as const },
    ];
  });
}

export const regionalOperationsLab: LabMission<unknown, HandoffInput, HandoffOut> = {
  id: "regional-operations",
  provider: "anthropic",
  track: "architect-professional",
  objectives: ["1.2", "1.4", "1.5", "6.4", "6.5", "7.1", "7.2", "7.3"],
  station: "Incident control room",
  speaker: "Priya Shah",
  opening: "I’m leaving the deployment tonight. W-19 has failed every write since r17, and Devon’s shift takes over at 18:00 with only what we write down.",
  task: "Write the first-ten-minutes runbook and the handoff packet, then let the next shift work from them alone.",
  brief: {
    problem: "Writes fail after a deploy; the current runbook broadcasts and waits, and the handoff is screenshots, confidence scores and a wiki link.",
    move: "Read the Incident clock and the Handoff standard, then the trace, the specialist reports, the importer notes, the reviewer reports and the repository listing. Edit both files and run.",
    success: ["Owner engaged in minute 1", "Residents reach a person within ten minutes", "The cause is found inside the ten minutes", "The next shift reproduces the failure from the handoff alone", "Claims cite sources; gaps are written down", "No finished stage runs twice", "The incoming team loads the same procedure", "One finding per defect"],
  },
  prebrief: {
    concept: "An incident needs an owner, a fallback for users and a handoff the next shift can act on alone: the release, a failing fixture, cited evidence, a safe restart, a shared procedure and findings keyed to their contracts.",
    terms: [["Person who must answer now", "On-call owner"], ["Manual route while automation is down", "Fallback (graceful degradation)"],
      ["Pick up where a finished stage ended", "Checkpoint and resume"], ["Procedure an assistant can load", "Agent Skill"], ["One report per real defect", "Root-cause deduplication"]],
    contrast: {
      good: "A pilot hands over with the aircraft’s tail number, the fault code and the duty engineer’s name.",
      bad: "A pilot who hands over a photo of the warning light leaves the next crew to rediscover everything.",
    },
  },
  documents: eveningDocs,
  artifacts: [
    { id: "runbook", kind: "runbook", path: "ops/runbook.md", editor: "markdown", instruction: "The on-call’s first actions, numbered in the order they run. The incident clock counts each one.",
      starter: starter.runbook, example: "# First ten minutes · card payments down\n\n1. Switch the tills to offline mode\n2. …" },
    { id: "handoff", kind: "handoff-template", path: "ops/handoff.md", editor: "markdown", instruction: "What the next shift works from, alone: Owner, Deployed, Reproduce, Evidence, Resume, Procedure, Findings.",
      starter: starter.handoff, example: "## Deployed\nRelease: v4.2\n\n## Evidence\n- Card reader 3 rejects chip cards since v4.2 [reader log 3]\n- Gap: reader 5 offline; not checked\n\n## Findings\n| Finding | Contract | Failing input | Reported by |\n|---|---|---|---|\n| … | POST /charge currency | fixtures/… | … |" },
  ],
  engine: handoffEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { night: nightDocs },
  checks,
  prediction: {
    prompt: "At which minute will residents first reach a person?", unit: "min",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + ((entry?.out as HandoffOut | undefined)?.clock.person ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { night: transferRef } },
  mutants: [
    { name: "email before paging", set: "sample", mustFail: ["owner-first"], edit: runbook(["Email the team", "Page on-call", "Open the staffed queue for residents (manual intake)", "Compare W-19's identity and scopes between r16 and r17"]) },
    { name: "writes held instead of a staffed route", set: "sample", mustFail: ["residents-routed"], edit: runbook(["Page on-call", "Hold writes in the write queue", "Compare W-19's identity and scopes between r16 and r17"]) },
    { name: "full export instead of a scope comparison", set: "sample", mustFail: ["cause-isolated"], edit: runbook(["Page on-call", "Open the staffed queue for residents (manual intake)", "Full dashboard export"]) },
    { name: "previous release named", set: "sample", mustFail: ["reproducible"], edit: packet(eveningPacket, { release: "r16" }) },
    { name: "read fixture instead of the denied write", set: "sample", mustFail: ["reproducible"], edit: packet(eveningPacket, { fixture: "fixtures/w19-read.json" }) },
    { name: "confidence instead of a source", set: "sample", mustFail: ["claims-checkable"], edit: packet(eveningPacket, { evidence: ["Writes for W-19 are denied since r17 (confidence 0.92)", ...eveningPacket.evidence.slice(1)] }) },
    { name: "gap left unstated", set: "sample", mustFail: ["claims-checkable"], edit: packet(eveningPacket, { evidence: eveningPacket.evidence.slice(0, 3) }) },
    { name: "unavailable collection cited", set: "sample", mustFail: ["claims-checkable"], edit: packet(eveningPacket, { evidence: [...eveningPacket.evidence.slice(0, 3), "Collection B has no failed writes [collection B]"] }) },
    { name: "importer started over", set: "sample", mustFail: ["resume-checkpoint"], edit: packet(eveningPacket, { resume: "importer run" }) },
    { name: "resume without clearing the partial rows", set: "sample", mustFail: ["resume-checkpoint"], edit: packet(eveningPacket, { resume: "importer resume --from write" }) },
    { name: "procedure as a wiki link", set: "sample", mustFail: ["procedure-loaded"], edit: packet(eveningPacket, { procedure: "Contract review: wiki/contract-review" }) },
    { name: "one finding per report", set: "sample", mustFail: ["findings-deduped"], edit: packet(eveningPacket, { findings: [eveningPacket.findings[0], ["Amount field accepts negatives", "POST /refunds amount", "fixtures/refund-negative.json", "Ben (R-2)"], eveningPacket.findings[1]] }) },
    { name: "findings without contracts", set: "sample", mustFail: ["findings-deduped"], edit: packet(eveningPacket, { findings: eveningPacket.findings.map(([finding, , , by]) => [finding, "", "", by]) }) },
    { name: "alike defects merged by wording", set: "transfer", variant: "night", mustFail: ["findings-deduped"], edit: packet(nightPacket, { findings: [["Amount accepts wrong values", "POST /invoices, POST /permits", "fixtures/invoice-rounding.json, fixtures/permit-negative-fee.json", "Cy, Dee"]] }) },
    { name: "resume at last night’s stage", set: "transfer", variant: "night", mustFail: ["resume-checkpoint"], edit: packet(nightPacket, { resume: "importer resume --from write --discard-partial" }) },
    { name: "last shift’s procedure", set: "transfer", variant: "night", mustFail: ["procedure-loaded"], edit: packet(nightPacket, { procedure: "Contract review: .claude/skills/contract-review/" }) },
  ],
  probes: [
    { name: "every action on the clock", set: "sample", mustFail: "any", files: runbook(catalog.map(({ label }) => label)) },
    { name: "every claim marked as a gap", set: "sample", mustFail: "any",
      files: packet(eveningPacket, { evidence: eveningPacket.evidence.map((line) => `Gap: ${line}`), findings: [] }) },
  ],
  fixTerms: ["--discard-partial"],
  debrief: "The runbook pages on-call (minute 1), opens the staffed queue so residents reach a person by minute 4, and compares the worker’s identity and scopes across releases, which finds the missing write scope by minute 6. The handoff names the on-call rotation, the release and a fixture that reproduces the denied write on it; each claim cites its source and the unavailable collection is a written gap; the importer resumes at the failed stage after discarding its partial rows; the procedure is the versioned Skill in the repo; and findings are keyed on contract and failing input, so two reports of one defect become one row while two alike-sounding defects on different contracts stay two.",
};
