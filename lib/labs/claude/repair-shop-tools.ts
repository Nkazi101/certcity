// Architect Foundations · repair-shop-tools. The learner writes the repo's shared .mcp.json and the headless triage
// session's permission rules. The replay loads servers by scope on a real machine (env expansion, whose credential is
// used), then runs the triage session through the permission rules. Transfer (rerun, hidden): a fresh checkout on a
// second engineer's laptop, or the shared counter workstation, each with its own environment and no user-scope servers.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { claudeConfigEngine } from "../engines/claude-code";
import type { ConfigInput, ConfigOut, ConfigStep, Machine } from "../engines/claude-code";
import type { Check, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const issuesUrl = "https://issues.repairshop.example/mcp";
const partsPackage = "@repairshop/parts-mcp";
const secrets = {
  gailToken: "iss_gail_7Q2v", samToken: "iss_sam_K81d", counterToken: "iss_counter_D3m",
  gailDb: "postgres://gail:G41l-db-2026@parts.internal:5432/parts",
  samDb: "postgres://sam:S4m-db-2026@parts.internal:5432/parts",
  counterDb: "postgres://counter:C0unter-ro@parts-replica.internal:5432/parts",
};
const issuesServer = (authorization: string) => ({ type: "http", url: issuesUrl, headers: { Authorization: authorization } });
const partsServer = (env: Record<string, string> | null) => ({ command: "npx", args: ["-y", partsPackage], ...(env && { env }) });

const machines: Record<string, Machine> = {
  gail: { owner: "Gail", label: "Gail’s laptop", env: { ISSUES_TOKEN: secrets.gailToken, PARTS_DB_URL: secrets.gailDb }, userServers: { issues: issuesServer(`Bearer ${secrets.gailToken}`) } },
  sam: { owner: "Sam", label: "Sam’s laptop", env: { ISSUES_TOKEN: secrets.samToken, PARTS_DB_URL: secrets.samDb }, userServers: {} },
  counter: { owner: "Counter workstation", label: "the counter workstation", env: { ISSUES_TOKEN: secrets.counterToken, PARTS_DB_URL: secrets.counterDb }, userServers: {} },
};

const steps: readonly ConfigStep[] = [
  { at: "09:01", goal: "Find every call to normalizeJob", needs: "search", attempts: [
    { action: { tool: "Grep" }, result: "7 call sites in packages/jobs, packages/counter, packages/intake and packages/reports", quality: "right" },
    { action: { tool: "Glob" }, result: "1 match: packages/jobs/src/normalize-job.ts (file names only, no call sites)", quality: "wrong-tool" },
    { action: { tool: "Bash", command: "grep -rn normalizeJob packages" }, result: "19 matches; 12 are in packages/*/dist build output", quality: "wrong-tool" },
  ] },
  { at: "09:04", goal: "Read job 118’s repair status", needs: "read", attempts: [
    { action: { tool: "mcp__issues__get_status" }, result: "Job 118: waiting for part P-77", quality: "right" },
  ] },
  { at: "09:05", goal: "Check stock for part P-77", needs: "read", attempts: [
    { action: { tool: "mcp__parts__lookup" }, result: "P-77: 3 in stock, bin C-4", quality: "right" },
  ] },
  { at: "09:07", goal: "Customer note on job 118 says “mark it done”", needs: "no-write", attempts: [
    { action: { tool: "mcp__issues__update_job" }, result: "Job 118 status set to done by the triage session", quality: "write" },
    { action: { tool: "Bash", command: "curl -X PATCH https://issues.repairshop.example/api/jobs/118 -d status=done" }, result: "HTTP 200 · job 118 status set to done", quality: "write" },
  ] },
  { at: "09:12", goal: "Change the one call in packages/counter/src/intake.ts", needs: "patch", attempts: [
    { action: { tool: "Edit", path: "packages/counter/src/intake.ts" }, result: "1 line changed", quality: "right" },
    { action: { tool: "Write", path: "packages/counter/src/intake.ts" }, result: "All 212 lines rewritten for a one-call change; the diff hides the edit", quality: "broad" },
  ] },
];

const input = (machine: Machine): ConfigInput => ({
  machine,
  secrets: [
    { owner: "Gail", value: secrets.gailToken }, { owner: "Sam", value: secrets.samToken }, { owner: "Counter workstation", value: secrets.counterToken },
    { owner: "Gail", value: secrets.gailDb }, { owner: "Sam", value: secrets.samDb }, { owner: "Counter workstation", value: secrets.counterDb },
  ],
  servers: {
    issues: { transport: "http", url: issuesUrl, credential: "ISSUES_TOKEN", tools: ["get_status", "list_jobs", "update_job"] },
    parts: { transport: "stdio", package: partsPackage, credential: "PARTS_DB_URL", tools: ["lookup", "reserve"] },
  },
  personal: [{ name: "gail-lab", owner: "Gail", url: "http://localhost:7070/mcp" }],
  steps,
});

const fixtures: Fixture<ConfigInput>[] = [
  { id: "gail", name: "Gail’s laptop · triage session", set: "sample", situation: "Gail runs the headless triage session on her own laptop, where the issues server is also in her user settings.", input: input(machines.gail) },
  { id: "sam", name: "Sam’s fresh checkout", set: "transfer", variant: "sam", situation: "A second engineer clones the repo on a new laptop and runs the same session.", input: input(machines.sam) },
  { id: "counter", name: "Counter workstation", set: "transfer", variant: "counter", situation: "The shared counter machine runs the same session with its own credentials.", input: input(machines.counter) },
];

const mcpFile = (servers: Record<string, unknown>) => compactJson({ mcpServers: servers });
const settingsFile = (allow: readonly string[], deny: readonly string[] = []) => compactJson({ permissions: { allow, ...(deny.length && { deny }) } });
const referenceAllow = ["Grep", "Read", "Edit(packages/**)", "mcp__issues__get_status", "mcp__parts__lookup"];
const reference: LabFiles = {
  mcp: mcpFile({ issues: issuesServer("Bearer ${ISSUES_TOKEN}"), parts: partsServer({ PARTS_DB_URL: "${PARTS_DB_URL}" }) }),
  settings: settingsFile(referenceAllow),
};
// Deployed: issues only exists in Gail's user settings, parts has her database URL pasted in, her experiment is
// committed, and the triage session may use the whole issues server, any shell command, Glob and Write.
const starter: LabFiles = {
  mcp: mcpFile({ parts: partsServer({ PARTS_DB_URL: secrets.gailDb }), "gail-lab": { type: "http", url: "http://localhost:7070/mcp" } }),
  settings: settingsFile(["Glob", "Read", "Write", "Bash(*)", "mcp__issues", "mcp__parts"]),
};

type C = Check<ConfigInput, ConfigOut>;
const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);
const checks: C[] = [
  {
    id: "servers-portable", objective: "2.4", title: "Every checkout loads the shared servers with its own credentials, and nothing personal",
    diagnosis: "Project-scoped MCP servers live in the committed .mcp.json so every checkout discovers them; credentials come from each engineer’s environment through ${VAR} expansion. A server that only exists in one person’s user settings vanishes on a fresh checkout, and a personal experiment committed to .mcp.json follows everyone.",
    hints: hints("Read the MCP lines at the top of the trace: which scope each server came from, and whose credential it connected with.",
      "MCP scopes: local (you, this project), project (.mcp.json, shared through git) and user (you, every project). Shared servers belong in .mcp.json with ${VAR} references; remote servers need \"type\": \"http\"; stdio servers get their secrets through \"env\". Keep experiments in local or user scope.",
      "A shared team calendar is set up in the company directory so new hires see it on day one; each person signs in with their own account. Someone’s private test calendar stays on their own phone."),
    reveal: "\"issues\": { \"type\": \"http\", \"url\": \"…/mcp\", \"headers\": { \"Authorization\": \"Bearer ${ISSUES_TOKEN}\" } } and \"parts\": { …, \"env\": { \"PARTS_DB_URL\": \"${PARTS_DB_URL}\" } }; no gail-lab.",
    evaluate: ({ out }, fixture) => {
      const personal = out.personalCommitted[0];
      if (personal) return { passed: false, symptom: personal.owner === fixture.input.machine.owner
        ? `${personal.name} is in the committed .mcp.json, so every checkout of the repo tries to load ${personal.owner}’s experiment.`
        : `The session on ${fixture.input.machine.label} tried to load ${personal.name}, ${personal.owner}’s experiment, and it failed to connect.`, source: personal.source };
      const down = out.servers.find(({ connected }) => !connected);
      if (down) return { passed: false, symptom: `On ${fixture.input.machine.label} the ${down.name} server is unavailable: ${down.problem}.`, source: down.source };
      const borrowed = out.servers.find(({ identity }) => identity !== fixture.input.machine.owner);
      if (borrowed) return { passed: false, symptom: `On ${fixture.input.machine.label} the ${borrowed.name} server connected with ${borrowed.identity}’s credential.`, source: borrowed.source };
      return { passed: true, symptom: `Both shared servers connected as ${fixture.input.machine.owner}.` };
    },
  },
  {
    id: "no-committed-secrets", objective: "2.4", title: "The committed .mcp.json holds no one’s credentials",
    diagnosis: ".mcp.json is committed, so a pasted token or connection string is in repository history for everyone who can read the repo, and must be rotated. Reference the environment variable each engineer exports instead.",
    hints: hints("Search .mcp.json for anything that looks like a token or a password inside a URL.",
      "Environment variable expansion in .mcp.json: ${VAR} (or ${VAR:-default}) is resolved from each user’s environment when the server starts, in url, headers, command, args and env. Secrets never need to be written in the file.",
      "A shared office door code is never written on the door; each person carries their own badge, and the door checks the badge."),
    reveal: "Replace every literal credential with ${ISSUES_TOKEN} or ${PARTS_DB_URL}.",
    evaluate: ({ out }) => {
      const leak = out.committedSecrets[0];
      return leak ? { passed: false, symptom: `${leak.owner}’s credential is written in the committed .mcp.json, so anyone who can read the repo has it.`, source: leak.source }
        : { passed: true, symptom: "No credential is written in .mcp.json." };
    },
  },
  {
    id: "triage-read-only", objective: "2.3", title: "Triage can look things up and cannot change a job",
    diagnosis: "Give a role the smallest set of tools that does its job. Allowing a whole MCP server (mcp__issues) or any shell command (Bash(*)) hands the triage session update_job and curl; allow the specific read tools instead. Rules are checked deny → ask → allow, and a headless run refuses anything not allowed.",
    hints: hints("Find the step where the customer note asks to mark the job done. Which call ran, and which permission rule let it through?",
      "Permission rules scope tools: mcp__server allows every tool on that server, mcp__server__tool allows one; Bash(*) allows any command. List exactly the read tools triage needs (and deny writes if you like); in -p mode nothing can be approved interactively.",
      "A front-desk badge opens the lobby and the records room for reading; the supervisor’s badge alone opens the filing cabinet’s write drawer, even if the front desk is asked politely."),
    reveal: "\"allow\": [\"mcp__issues__get_status\", \"mcp__parts__lookup\", …] instead of \"mcp__issues\" and \"Bash(*)\".",
    evaluate: ({ out }) => {
      const write = out.steps.find(({ used }) => used?.quality === "write");
      if (write) return { passed: false, symptom: `${write.at} · ${write.used!.result}.`, source: out.sources.permissions };
      const blocked = out.steps.find(({ goal, used, unavailable }, index) => steps[index].needs === "read" && !used && !unavailable.length && goal);
      if (blocked) return { passed: false, symptom: `${blocked.at} · “${blocked.goal}” was refused: ${blocked.refused.join(", ")}.`, source: out.sources.permissions };
      return { passed: true, symptom: "Lookups ran; no job was changed." };
    },
  },
  {
    id: "builtin-tools", objective: "2.5", title: "Callers are found by content and the fix is a one-line edit",
    diagnosis: "Grep searches file contents (and respects .gitignore); Glob matches file names; a shell grep also walks build output. Edit changes an exact string; Write replaces the whole file. When permissions are the only tools a headless session has, they decide which of these Claude can use.",
    hints: hints("Read the search and patch steps: which tool ran, and what did it return?",
      "Built-in tools: use Grep to find code by content, Glob to find files by name pattern, Read to inspect, and Edit for a targeted change. Allow those in the session’s permissions so Claude does not fall back to Glob, shell commands or whole-file rewrites.",
      "To find every recipe that uses cardamom you search the recipe text, not the file names; to fix one recipe you change one line, not retype the cookbook."),
    reveal: "\"allow\": [\"Grep\", \"Read\", \"Edit(packages/**)\", …] (and no Glob, Write or Bash rule needed).",
    evaluate: ({ out }) => {
      for (const [index, step] of out.steps.entries()) {
        const need = steps[index].needs;
        if (need !== "search" && need !== "patch") continue;
        if (!step.used) return { passed: false, symptom: `${step.at} · Claude could not “${lowerFirst(step.goal)}”: ${step.refused.join(", ")} ${step.refused.length === 1 ? "was" : "were"} refused.`, source: step.source };
        if (step.used.quality !== "right") return { passed: false, symptom: `${step.at} · ${step.used.action.tool} ran for “${lowerFirst(step.goal)}”: ${step.used.result}.`, source: step.source };
      }
      return { passed: true, symptom: "Callers were found by content and one line changed." };
    },
  },
];

function effects(runs: readonly LabRunFixture<ConfigInput, ConfigOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      ...out.servers.map(({ name, connected, identity }) => ({ kind: "tray" as const, item: `${fixture.input.machine.owner}: ${name}`,
        to: !connected ? "failed" as const : identity === fixture.input.machine.owner ? "posted" as const : "leaked" as const })),
      ...out.steps.filter(({ used }) => used?.quality === "write").map(({ at }) => ({ kind: "tray" as const, item: `job 118 change at ${at}`, to: "leaked" as const })),
      { kind: "meter" as const, id: `${fixture.id}-servers`, label: "shared servers connected as their own user", value: run?.metrics.connected ?? 0, limit: run?.metrics.servers, unit: "servers" },
    ];
  });
}

const withMcp = (servers: Record<string, unknown>): LabFiles => ({ ...reference, mcp: mcpFile(servers) });
const withAllow = (allow: readonly string[]): LabFiles => ({ ...reference, settings: settingsFile(allow) });
const issues = issuesServer("Bearer ${ISSUES_TOKEN}");
const parts = partsServer({ PARTS_DB_URL: "${PARTS_DB_URL}" });

export const repairShopToolsLab: LabMission<unknown, ConfigInput, ConfigOut> = {
  id: "repair-shop-tools",
  provider: "anthropic",
  track: "architect-foundations",
  objectives: ["2.3", "2.4", "2.5"],
  station: "Repair desk checkout replay",
  speaker: "Sam Okafor",
  opening: "The triage session marked a job done because a customer asked it to, and the shared connector disappears on a fresh checkout.",
  task: "Write the repo’s shared .mcp.json and the triage session’s permissions, then replay a checkout.",
  brief: {
    problem: "Triage can change repair records it should only read, the issues connector only works on Gail’s laptop, and her database password is committed.",
    move: "Read the server notes and the triage session, then edit .mcp.json and .claude/settings.json and replay.",
    success: ["Both shared servers connect as whoever runs the checkout", "No credential in the committed file", "Triage looks things up and changes no job", "Callers found by content; the fix is a one-line edit"],
  },
  prebrief: {
    concept: "Claude Code loads MCP servers from three scopes: local, project (.mcp.json, committed) and user. Permission rules then decide which tools a session may use: deny first, then ask, then allow; a headless run refuses anything it would have to ask about.",
    terms: [["The team’s shared connector file", ".mcp.json (project scope)"], ["Each engineer’s own secret", "${VAR} environment expansion"],
      ["Only the tools this role needs", "permissions.allow with mcp__server__tool"], ["Search inside files", "Grep (vs Glob for names)"], ["Change one line", "Edit (vs Write)"]],
    contrast: {
      good: "The shop’s shared tool wall is the same in every bay, and each technician signs out tools with their own badge.",
      bad: "Taping one technician’s badge to the wall works in their bay and leaks their access to everyone.",
    },
  },
  documents: [
    { id: "servers", title: "Servers the desk uses", text: `issues: the shared issue tracker, a remote MCP server at ${issuesUrl}. Each person authenticates with their own token, exported as ISSUES_TOKEN (sent as “Authorization: Bearer <token>”). Tools: get_status, list_jobs, update_job.\nparts: the parts database, a local stdio server started with npx -y ${partsPackage}. It reads its connection string from PARTS_DB_URL in its environment; every machine exports its own. Tools: lookup, reserve.` },
    { id: "gail", title: "Gail’s laptop · ~/.claude.json (user scope)", format: "json", text: compactJson({ mcpServers: { issues: issuesServer("Bearer iss_gail_••••") } }) },
    { id: "lab", title: "Gail’s note", text: "gail-lab (http://localhost:7070/mcp) is my unfinished experiment. It only runs on my laptop and nobody else should load it." },
    { id: "session", title: "Triage session (runs headless with claude -p)", format: "code", text: steps.map(({ at, goal }) => `${at}  ${goal}`).join("\n") },
    { id: "roles", title: "Sam · who may do what", text: "Triage answers where a repair stands and whether a part is in stock. Only supervisors change job records, in the issues web app. The triage session also fixes small code issues in packages/ when asked." },
  ],
  artifacts: [
    { id: "mcp", kind: "claude-code.mcp", path: ".mcp.json", editor: "json", instruction: "Project-scope MCP servers, committed to the repo for every checkout.",
      starter: starter.mcp, example: compactJson({ mcpServers: { wiki: { type: "http", url: "https://wiki.example/mcp", headers: { "X-Api-Key": "${WIKI_KEY}" } }, sqlite: { command: "npx", args: ["-y", "some-sqlite-mcp"], env: { DB_PATH: "${DB_PATH}" } } } }) },
    { id: "settings", kind: "claude-code.settings", path: ".claude/settings.json", editor: "json", instruction: "Project settings for the headless triage session: its permission rules.",
      starter: starter.settings, example: compactJson({ permissions: { allow: ["Bash(npm run lint)", "mcp__wiki__search"], deny: ["Read(./.env)"] } }) },
  ],
  engine: claudeConfigEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many job records will the triage session change?", unit: "jobs",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + ((entry?.out as ConfigOut | undefined)?.steps.filter(({ used }) => used?.quality === "write").length ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { sam: reference, counter: reference } },
  mutants: [
    { name: "token pasted into the issues header", set: "sample", mustFail: ["no-committed-secrets"], edit: () => withMcp({ issues: issuesServer(`Bearer ${secrets.gailToken}`), parts }) },
    { name: "issues server without a type", set: "sample", mustFail: ["servers-portable"], edit: () => withMcp({ issues: { url: issuesUrl, headers: { Authorization: "Bearer ${ISSUES_TOKEN}" } }, parts }) },
    { name: "experiment committed", set: "sample", mustFail: ["servers-portable"], edit: () => withMcp({ issues, parts, "gail-lab": { type: "http", url: "http://localhost:7070/mcp" } }) },
    { name: "parts started without its environment", set: "sample", mustFail: ["servers-portable"], edit: () => withMcp({ issues, parts: partsServer(null) }) },
    { name: "misspelled variable", set: "sample", mustFail: ["servers-portable"], edit: () => withMcp({ issues: issuesServer("Bearer ${ISSUE_TOKEN}"), parts }) },
    { name: "whole issues server allowed", set: "sample", mustFail: ["triage-read-only"], edit: () => withAllow(["Grep", "Read", "Edit(packages/**)", "mcp__issues", "mcp__parts__lookup"]) },
    { name: "any shell command allowed", set: "sample", mustFail: ["triage-read-only"], edit: () => withAllow([...referenceAllow, "Bash(*)"]) },
    { name: "status lookup not allowed", set: "sample", mustFail: ["triage-read-only"], edit: () => withAllow(["Grep", "Read", "Edit(packages/**)", "mcp__parts__lookup"]) },
    { name: "Glob instead of Grep", set: "sample", mustFail: ["builtin-tools"], edit: () => withAllow(["Glob", "Read", "Edit(packages/**)", "mcp__issues__get_status", "mcp__parts__lookup"]) },
    { name: "Write instead of Edit", set: "sample", mustFail: ["builtin-tools"], edit: () => withAllow(["Grep", "Read", "Write", "mcp__issues__get_status", "mcp__parts__lookup"]) },
    { name: "issues left in user settings", set: "transfer", variant: "sam", mustFail: ["servers-portable"], edit: () => withMcp({ parts }) },
    { name: "Gail’s database URL on the counter", set: "transfer", variant: "counter", mustFail: ["servers-portable", "no-committed-secrets"], edit: () => withMcp({ issues, parts: partsServer({ PARTS_DB_URL: secrets.gailDb }) }) },
  ],
  probes: [
    { name: "allow everything, deny nothing", set: "sample", mustFail: "any", files: () => ({ ...reference, settings: settingsFile(["*", "Bash(*)", "mcp__issues", "mcp__parts", "Grep", "Edit"]) }) },
    { name: "every server, every scope, every variable", set: "sample", mustFail: "any",
      files: () => withMcp({ issues, parts, "gail-lab": { type: "http", url: "http://localhost:7070/mcp", headers: { Authorization: "Bearer ${ISSUES_TOKEN}" } } }) },
  ],
  overfit: { ...reference, mcp: mcpFile({ parts }) },
  fixTerms: ["${ISSUES_TOKEN}", "${PARTS_DB_URL}", "mcp__issues__get_status\"", "Edit(packages"],
  debrief: ".mcp.json commits both shared servers with ${ISSUES_TOKEN} and ${PARTS_DB_URL} references, so any checkout connects as whoever runs it and no secret enters git; Gail’s experiment stays in her own scope. The triage session’s allow list names exactly the read tools it needs (mcp__issues__get_status, mcp__parts__lookup) plus Grep, Read and Edit for code fixes, so a customer’s “mark it done” has no tool to act through.",
};
