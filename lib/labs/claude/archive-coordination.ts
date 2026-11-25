// Architect Foundations · archive-coordination. The learner writes the map worker's subagent definition
// (.claude/agents/map-search.md: tools scoped to the map server, a return format that reports results and unchecked wards)
// and the coordinator's next turn of Agent calls (which wards go to which worker, with the date range, accession and
// citation fields in the prompt). A replay runs the workers and assembles the editor's brief. Transfer (revise): another
// exhibit with a different period, accession and a different set of wards still missing.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { subagentEngine } from "../engines/subagents";
import type { ArchiveInput, ArchiveOut } from "../engines/subagents";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const fence = "```";
const registerDefinition = `---
name: register-search
description: Searches the Property register (REG accessions) by ward and year range. Use for register entries only.
tools: mcp__register__search_rolls, mcp__register__get_entry
---

You search the Property register only. Search each ward named in your task, within the date range in your task.

Return only this JSON:

${fence}json
{
  "results": [{ "ward": "", "entry": "", "year": 0, "accession": "" }],
  "unchecked": [{ "ward": "", "reason": "" }]
}
${fence}
`;
const tools = {
  mapSearch: "mcp__maps__search_sheets",
  register: ["mcp__register__search_rolls", "mcp__register__get_entry"],
  all: ["Read", "Grep", "Glob", "Write", "Bash", "WebFetch", "mcp__maps__search_sheets", "mcp__maps__get_sheet", "mcp__register__search_rolls", "mcp__register__get_entry"],
};
const wards = ["North", "Mill", "Harbor", "Chapel", "Quarry", "South"];

type Case = { input: ArchiveInput; title: string; editor: string; round1: string; remaining: readonly string[]; note: string };
const harbor: Case = {
  title: "Harbor streets exhibit",
  editor: "Exhibit period 1904–1912. Cite every map sheet as accession MAP-41, sheet number and year. Every ward in the brief is either verified, or listed as not checked with what failed and how many times we tried: I decide from that whether to wait a day or print with a gap. “No records” only where a search actually ran.",
  round1: [
    "register-search · all six wards · 9 entries cited to REG-27 · complete.",
    "map-search · assigned North, Mill, Harbor, Chapel, Quarry (the first dispatch left South out).",
    "  North, Mill, Harbor: 5 sheets cited to MAP-41.",
    "  Chapel, Quarry: map server timed out; the worker’s one retry also timed out.",
    "  It returned: “Found 5 sheets. Some wards could not be searched.”",
  ].join("\n"),
  remaining: ["Chapel", "Quarry", "South"],
  note: "The map server has been unreliable for Quarry all week. South was farmland until about 1915.",
  input: {
    wards, range: { from: 1904, to: 1912 }, accession: "MAP-41", verifiedMaps: ["North", "Mill", "Harbor"], registerComplete: true,
    mapServer: { Chapel: { status: "ok", sheets: [{ sheet: "C-07", year: 1906 }, { sheet: "C-11", year: 1910 }, { sheet: "C-31", year: 1931 }] },
      Quarry: { status: "timeout" }, South: { status: "ok", sheets: [{ sheet: "S-24", year: 1924 }] } },
    definitions: { "register-search": registerDefinition }, tools,
  },
};
const millpond: Case = {
  title: "Mill pond exhibit",
  editor: "Exhibit period 1920–1931. Cite every map sheet as accession MAP-58, sheet number and year. Every ward in the brief is either verified, or listed as not checked with what failed and how many times we tried. “No records” only where a search actually ran.",
  round1: [
    "register-search · all six wards · 12 entries cited to REG-33 · complete.",
    "map-search · assigned South, Chapel, Quarry, Mill, North (the first dispatch left Harbor out).",
    "  South, Chapel, Quarry, Mill: 7 sheets cited to MAP-58.",
    "  North: map server timed out; the worker’s one retry also timed out.",
    "  It returned: “Found 7 sheets. One ward could not be searched.”",
  ].join("\n"),
  remaining: ["North", "Harbor"],
  note: "The Harbor sheets sit on the old scan server, which drops connections in the afternoon.",
  input: {
    wards, range: { from: 1920, to: 1931 }, accession: "MAP-58", verifiedMaps: ["South", "Chapel", "Quarry", "Mill"], registerComplete: true,
    mapServer: { North: { status: "ok", sheets: [{ sheet: "N-03", year: 1922 }, { sheet: "N-09", year: 1929 }, { sheet: "N-40", year: 1940 }] }, Harbor: { status: "timeout" } },
    definitions: { "register-search": registerDefinition }, tools,
  },
};

// --- files ---------------------------------------------------------------------------------------------------------------
const definition = ({ tools: toolLine = "tools: mcp__maps__search_sheets, mcp__maps__get_sheet" as string | null, contract = { results: [{ ward: "", sheet: "", year: 0, accession: "" }], unchecked: [{ ward: "", error_type: "", attempts: 0 }] } as Record<string, unknown> | null } = {}) => `---
name: map-search
description: Searches the Historic maps collection (MAP accessions) by ward and year range. Use for map sheets only.
${toolLine ? `${toolLine}\n` : ""}---

You search the Historic maps collection only. Search each ward named in your task, within the date range in your task. If a ward fails, retry it once.
${contract ? `
Return only this JSON:

${fence}json
${compactJson(contract, 70)}
${fence}
` : "\nSummarize what you find.\n"}`;
const prompt = (c: Case, { names = c.remaining, range = true, accession = true } = {}) =>
  `Search the Historic maps collection${accession ? ` (accession ${c.input.accession})` : ""} for sheets${range ? ` dated ${c.input.range.from}–${c.input.range.to}` : ""} in these wards: ${names.join(", ")}. The register search is complete and the other wards’ maps are verified. Cite each sheet with accession, sheet number and year.`;
type Call = { subagent_type: string; description: string; prompt: string };
const mapCall = (c: Case, options: Parameters<typeof prompt>[1] = {}): Call => ({ subagent_type: "map-search", description: `Maps: ${(options.names ?? c.remaining).join(", ")}`, prompt: prompt(c, options) });
const registerCall = (c: Case, names = c.remaining): Call => ({ subagent_type: "register-search", description: "Register recheck", prompt: `Search the Property register for ${names.join(", ")}, dated ${c.input.range.from}–${c.input.range.to}.` });
const dispatch = (calls: readonly Call[]) => compactJson(calls);
const reference = (c: Case): LabFiles => ({ agent: definition(), dispatch: dispatch([mapCall(c)]) });

// Deployed: the definition sets no tools (so it inherits the register tools) and returns prose; the coordinator reruns the
// complete register search and sends the map worker a task with no period or accession.
const starter: LabFiles = {
  agent: definition({ tools: null, contract: null }),
  dispatch: dispatch([
    { subagent_type: "register-search", description: "Register search", prompt: "Search the property register again for every ward so the brief is complete." },
    { subagent_type: "map-search", description: "Map search", prompt: "Continue the map search for Chapel, Quarry and South, as we discussed." },
  ]),
};

function caseDocuments(c: Case): LabDocument[] {
  return [
    { id: `${c.input.accession}-round1`, title: `${c.title} · worker traces, first round`, format: "code", text: c.round1 },
    { id: `${c.input.accession}-editor`, title: "Editor’s requirements · Reese Park", text: c.editor },
    { id: `${c.input.accession}-mina`, title: "Mina Cho · map archivist", text: `The map worker is the only one with map access; the register does not hold maps, even where street names overlap. ${c.note}` },
  ];
}
const shared: LabDocument[] = [
  { id: "register-def", title: ".claude/agents/register-search.md · already in the repo", format: "code", text: registerDefinition },
  { id: "policy", title: "Collection access policy", text: "Only the register desk’s worker may read the Property register’s closed rolls (mcp__register__search_rolls, mcp__register__get_entry). Map work uses mcp__maps__search_sheets and mcp__maps__get_sheet. A worker started with the Agent tool sees its own definition and the prompt it is given, nothing from the coordinator’s conversation." },
];

const fixtures: Fixture<ArchiveInput>[] = [
  { id: "harbor", name: "Harbor streets exhibit · second round", set: "sample", situation: "The register is done, three wards’ maps are verified, two timed out and one was never assigned.", input: harbor.input },
  { id: "millpond", name: "Mill pond exhibit · second round", set: "transfer", variant: "millpond", situation: "Another exhibit, another period and accession, and a different set of wards still missing.", input: millpond.input },
];

// --- checks ---------------------------------------------------------------------------------------------------------------
type C = Check<ArchiveInput, ArchiveOut>;
const mapCalls = (out: ArchiveOut) => out.calls.filter(({ canMaps, error, type }) => canMaps && !error && type !== "register-search");
const checks: C[] = [
  {
    id: "remaining-assigned", objective: "1.2", title: "Every ward still missing its map search goes to a worker that can search maps",
    diagnosis: "The coordinator partitions the remaining work by what each specialist can actually do. A ward goes to the worker whose tools reach its collection; overlapping street names do not make the register a map source.",
    hints: hints("List the wards whose maps are not verified yet (first-round trace), then find each one in your Agent calls and check which worker got it.",
      "Hub-and-spoke coordination: the coordinator keeps verified results, finds what is still uncovered, and sends each uncovered slice to the worker with access to it, naming the slice explicitly.",
      "A contractor whose plumber finished the kitchen sends the electrician, not the plumber, to the kitchen lights, and lists the rooms the electrician has not done yet."),
    reveal: "One map-search call (or one per ward) naming every ward whose maps are not yet verified.",
    evaluate: ({ out }, fixture) => {
      const remaining = fixture.input.wards.filter((ward) => !fixture.input.verifiedMaps.includes(ward));
      for (const ward of remaining) {
        if (mapCalls(out).some(({ wards }) => wards.includes(ward))) continue;
        const elsewhere = out.calls.find(({ wards, error }) => !error && wards.includes(ward));
        return { passed: false, source: elsewhere?.source ?? out.sources.dispatch, symptom: elsewhere
          ? `${ward} went to ${elsewhere.type}, which cannot search the map collection; no sheets were searched for ${ward}.`
          : `No Agent call that can search maps names ${ward}; its maps stay unsearched.` };
      }
      return { passed: true, symptom: "Every ward still missing its maps went to the map worker." };
    },
  },
  {
    id: "no-repeat", objective: "1.2", title: "Verified work is not searched again",
    diagnosis: "Results that came back verified stay in the coordinator’s hands; re-delegating them spends time and can only reproduce them (or contradict them by chance). Re-delegation targets the gaps.",
    hints: hints("Compare the first-round trace with what each worker searched this round.",
      "Iterative refinement in a coordinator: after synthesis, re-delegate only what is uncovered or failed. Completed slices are inputs to the brief, not new tasks.",
      "A proofreader who finished chapters 1–9 is sent only chapter 10, not the whole book again."),
    reveal: "No register-search call, and no map-search call naming a ward whose maps were verified in the first round.",
    evaluate: ({ out }) => {
      const repeat = out.calls.find(({ repeats }) => repeats.length);
      return repeat ? { passed: false, source: repeat.source, symptom: `${repeat.type} searched ${repeat.repeats.join(", ")} again; those results were already verified in the first round.` }
        : { passed: true, symptom: "No verified work was searched again." };
    },
  },
  {
    id: "packet-scoped", objective: "1.3", title: "Each worker’s task carries the period, the accession and the citation fields",
    diagnosis: "A subagent starts with a fresh context: its definition and the prompt string. Nothing from the coordinator’s conversation (“as we discussed”) reaches it, so the period, the accession and the citation fields have to be in the prompt or the definition, and the return format has to ask for every field the editor cites.",
    hints: hints("Read the map worker’s results and the editor’s brief in the trace: which sheets fall outside the exhibit’s period, and which arrive without the fields the editor cites?",
      "Spawning subagents: write a self-contained prompt (scope, date range, IDs, required output fields). The worker does not inherit the parent’s history, tool results or system prompt.",
      "A courier gets the full delivery address and the signature requirement on the job ticket, not “the usual place, like last time”."),
    reveal: "Prompt: “Search the Historic maps collection (accession <id>) for sheets dated <from>–<to> in these wards: … Cite each sheet with accession, sheet number and year.” Results fields: ward, sheet, year, accession.",
    evaluate: ({ out }, fixture) => {
      const calls = mapCalls(out);
      if (!calls.length) return null;
      const empty = calls.find(({ missing }) => missing.includes("wards"));
      if (empty) return { passed: false, source: empty.source, symptom: `${empty.type} received no ward list and asked which wards to search; nothing was searched.` };
      for (const status of out.brief) {
        if (status.state !== "verified" || status.round !== 2) continue;
        const late = status.sheets.find(({ inRange }) => !inRange);
        if (late) return { passed: false, source: calls[0].source, symptom: `The editor’s brief lists ${late.sheet} (${late.year}) for ${status.ward}, outside the exhibit’s ${fixture.input.range.from}–${fixture.input.range.to} period.` };
        if (status.sheets.some(({ cited }) => !cited)) {
          const call = calls.find(({ wards }) => wards.includes(status.ward)) ?? calls[0];
          return { passed: false, source: call.missing.includes("accession") ? call.source : out.sources.agent,
            symptom: `${status.ward}’s sheets reached the editor ${call.missing.includes("accession") ? "without an accession" : "without every citation field (accession, sheet, year)"}; she cannot cite them.` };
        }
      }
      return { passed: true, symptom: "Every returned sheet is in period and citable." };
    },
  },
  {
    id: "tools-scoped", objective: "1.3", title: "The map worker cannot reach the register’s closed rolls",
    diagnosis: "A subagent definition without a tools line inherits every tool of the main thread, MCP servers included. Scope each worker to the tools its job needs; the access policy then holds even when the worker decides a cross-check would help.",
    hints: hints("Find the highlighted register call in the trace. Which worker made it, and what does its definition say about tools?",
      "Subagent tool scoping: tools: lists the only tools the worker may use (comma-separated; MCP tools by full name). Omitting it means inherit all.",
      "A contractor gets a key to the rooms on the work order, not the building’s master key."),
    reveal: "tools: mcp__maps__search_sheets, mcp__maps__get_sheet",
    evaluate: ({ out }) => {
      const breach = out.calls.find(({ usedRegister }) => usedRegister);
      return breach ? { passed: false, source: out.sources.agent, symptom: `${breach.type} read the register’s closed rolls (mcp__register__search_rolls) while working on maps; the access policy reserves them for the register desk.` }
        : { passed: true, symptom: "Each worker stayed inside its own collection." };
    },
  },
  {
    id: "gaps-disclosed", objective: "5.3", title: "A ward that was never searched is not reported as having no records",
    diagnosis: "An access failure and an empty result call for opposite actions. If the worker’s return format has no place for wards it could not search, the coordinator sees only results and reads silence as “nothing found”.",
    hints: hints("Find the ward the map server never answered for, then read what the editor’s brief says about it.",
      "Error propagation: workers return partial results plus the scope they could not cover (failure type, attempts), so the coordinator can keep ‘searched, none found’ apart from ‘not searched’.",
      "A lab report says “sample lost in transit” rather than “no bacteria found” when the sample never arrived."),
    reveal: "A return format with an unchecked list next to the results, e.g. \"unchecked\": [{ \"ward\": \"\", \"error_type\": \"\", \"attempts\": 0 }].",
    evaluate: ({ out }) => {
      const wrong = out.brief.find(({ state }) => state === "false-empty");
      if (wrong) return { passed: false, source: out.sources.agent, symptom: `The editor’s brief says ${wrong.ward} has no matching map sheets; the map server never answered for ${wrong.ward}.` };
      return out.brief.some(({ state }) => state === "unchecked" || state === "empty") ? { passed: true, symptom: "Every unsearched ward is reported as not checked." } : null;
    },
  },
  {
    id: "failure-actionable", objective: "5.3", title: "The editor can tell what failed and how often it was tried",
    diagnosis: "A bare ‘not checked’ leaves the reader to guess. The failure type and the attempts made let the coordinator and the editor decide between waiting, rerouting and printing with a stated gap.",
    hints: hints("Read the brief line for the ward that was not checked. What would the editor need to decide whether to wait a day?",
      "Structured failure reports carry the failure type, what was attempted (how many times) and partial results, so the next decision is informed rather than a blind retry.",
      "A flight status that says “delayed: crew rest, new estimate 14:10” lets you decide to wait; “delayed” alone does not."),
    reveal: "Each unchecked entry carries an error type and the number of attempts.",
    evaluate: ({ out }) => {
      const vague = out.brief.find((status) => status.state === "unchecked" && !status.actionable);
      if (vague && vague.state === "unchecked") return { passed: false, source: out.sources.agent, symptom: `The brief lists ${vague.ward} as not checked${vague.detail ? ` (${vague.detail})` : ""} without ${vague.detail ? "how many times it was tried" : "what failed or how many times it was tried"}; the editor cannot tell whether waiting would help.` };
      return out.brief.some(({ state }) => state === "unchecked") ? { passed: true, symptom: "The unchecked ward carries its failure and attempts." } : null;
    },
  },
];

function effects(runs: readonly LabRunFixture<ArchiveInput, ArchiveOut>[]) {
  return runs.flatMap(({ run }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      ...out.brief.map((status) => ({ kind: "tray" as const, item: `${status.ward} ward`,
        to: status.state === "verified" ? status.round === 2 && status.sheets.some(({ cited, inRange }) => !cited || !inRange) ? "failed" as const : "posted" as const
          : status.state === "empty" ? "posted" as const : status.state === "unchecked" ? "held" as const : "failed" as const })),
      ...out.calls.filter(({ usedRegister }) => usedRegister).map(({ type }) => ({ kind: "tray" as const, item: `${type} read closed register rolls`, to: "leaked" as const })),
    ];
  });
}

const swap = (files: LabFiles, change: Readonly<Record<string, string>>): LabFiles => ({ ...files, ...change });
const sample = reference(harbor);

export const archiveCoordinationLab: LabMission<unknown, ArchiveInput, ArchiveOut> = {
  id: "archive-coordination",
  provider: "anthropic",
  track: "architect-foundations",
  objectives: ["1.2", "1.3", "5.3"],
  station: "Research table",
  speaker: "Reese Park",
  opening: "The editor is waiting. The register is done and three wards’ maps are verified. The map worker used its retry on two wards and never got South at all.",
  task: "Write the map worker’s definition and the coordinator’s next round of Agent calls, then replay the round and read the editor’s brief.",
  brief: {
    problem: "The first round duplicated work, left one ward unassigned and returned “some wards could not be searched” in prose; the editor nearly printed “no records” for wards nobody searched.",
    move: "Read the first-round traces, the editor’s requirements and the access policy. Edit .claude/agents/map-search.md and dispatch.json and replay.",
    success: ["Every ward still missing its maps is searched once, by the map worker", "Every sheet is in period and citable; the map worker never touches the register", "The brief keeps “not checked” (with cause and attempts) apart from “no records”"],
  },
  prebrief: {
    concept: "A coordinator hands work to subagents with the Agent tool. Each worker starts fresh: it knows its definition (role, tools, return format) and the prompt it is given, nothing else, and it reports back only what its return format has room for.",
    terms: [["Split the work between specialists", "Coordinator (hub-and-spoke) delegation"], ["Start a worker with a task", "Agent tool: subagent_type, description, prompt"],
      ["What the worker may use", "tools: in .claude/agents/<name>.md (omitted = inherit all)"], ["Tell the boss what you could not do", "Structured error propagation (coverage gaps)"]],
    contrast: {
      good: "A newsroom editor sends each reporter a written brief with the beat, the deadline and the sourcing rules, and asks them to say which calls went unanswered.",
      bad: "An editor who says “carry on with what we talked about” gets two reporters on the same story and none on the third.",
    },
  },
  documents: [...caseDocuments(harbor), ...shared],
  artifacts: [
    { id: "agent", kind: "claude-code.subagent", path: ".claude/agents/map-search.md", editor: "markdown",
      instruction: "The map worker’s definition: frontmatter (name, description, tools) and its system prompt, including what it returns.",
      starter: starter.agent,
      example: "---\nname: invoice-reader\ndescription: Reads supplier invoices from the inbox. Use for invoices only.\ntools: mcp__mail__read_message\n---\n\nRead each invoice you are given and return JSON: { \"invoices\": [ … ], \"unread\": [ … ] }" },
    { id: "dispatch", kind: "claude-code.agent-dispatch", path: "coordinator/dispatch.json", editor: "json",
      instruction: "The coordinator’s next turn: the Agent tool inputs it sends. Calls in one turn run in parallel.",
      starter: starter.dispatch,
      example: compactJson([{ subagent_type: "invoice-reader", description: "March invoices", prompt: "Read invoices INV-201 to INV-214 from March 2026 and return each total with its invoice number." }]) },
  ],
  engine: subagentEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { millpond: [...caseDocuments(millpond), ...shared] },
  checks,
  prediction: {
    prompt: "How many wards will the editor’s brief leave without a completed map search?", unit: "wards",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.unsearched ?? 0), 0),
  },
  effects,
  reference: { sample, transfer: { millpond: reference(millpond) } },
  mutants: [
    { name: "South left out of the dispatch", set: "sample", mustFail: ["remaining-assigned"], edit: (files) => swap(files, { dispatch: dispatch([mapCall(harbor, { names: ["Chapel", "Quarry"] })]) }) },
    { name: "every ward sent to the map worker", set: "sample", mustFail: ["no-repeat"], edit: (files) => swap(files, { dispatch: dispatch([mapCall(harbor, { names: wards })]) }) },
    { name: "register search run again", set: "sample", mustFail: ["no-repeat"], edit: (files) => swap(files, { dispatch: dispatch([mapCall(harbor), registerCall(harbor)]) }) },
    { name: "no date range in the task", set: "sample", mustFail: ["packet-scoped"], edit: (files) => swap(files, { dispatch: dispatch([mapCall(harbor, { range: false })]) }) },
    { name: "no accession in the task", set: "sample", mustFail: ["packet-scoped"], edit: (files) => swap(files, { dispatch: dispatch([mapCall(harbor, { accession: false })]) }) },
    { name: "results without an accession field", set: "sample", mustFail: ["packet-scoped"],
      edit: (files) => swap(files, { agent: definition({ contract: { results: [{ ward: "", sheet: "", year: 0 }], unchecked: [{ ward: "", error_type: "", attempts: 0 }] } }) }) },
    { name: "tools line removed", set: "sample", mustFail: ["tools-scoped"], edit: (files) => swap(files, { agent: definition({ tools: null }) }) },
    { name: "register tool added to the map worker", set: "sample", mustFail: ["tools-scoped"],
      edit: (files) => swap(files, { agent: definition({ tools: "tools: mcp__maps__search_sheets, mcp__maps__get_sheet, mcp__register__search_rolls" }) }) },
    { name: "return format without an unchecked list", set: "sample", mustFail: ["gaps-disclosed"],
      edit: (files) => swap(files, { agent: definition({ contract: { results: [{ ward: "", sheet: "", year: 0, accession: "" }] } }) }) },
    { name: "unchecked list copied from the register worker", set: "sample", mustFail: ["failure-actionable"],
      edit: (files) => swap(files, { agent: definition({ contract: { results: [{ ward: "", sheet: "", year: 0, accession: "" }], unchecked: [{ ward: "", reason: "" }] } }) }) },
    { name: "Harbor left out", set: "transfer", variant: "millpond", mustFail: ["remaining-assigned"], edit: (files) => swap(files, { dispatch: dispatch([mapCall(millpond, { names: ["North"] })]) }) },
  ],
  probes: [
    { name: "first exhibit’s dispatch replayed on the mill pond case", set: "transfer", variant: "millpond", files: () => sample, mustFail: "any" },
    { name: "every ward to every worker", set: "sample", mustFail: "any",
      files: (files) => swap(files, { dispatch: dispatch([mapCall(harbor, { names: wards }), registerCall(harbor, wards), { subagent_type: "general-purpose", description: "Everything", prompt: prompt(harbor, { names: wards }) }]) }) },
  ],
  fixTerms: ["error_type", "attempts"],
  debrief: "The coordinator keeps the complete register search and the three verified map wards, and sends only the uncovered wards to the one worker that can search maps. Its prompt is self-contained (wards, period, accession, citation fields), because a subagent never sees the coordinator’s conversation. The definition scopes tools to the map server, so the register’s closed rolls are out of reach, and its return format has an unchecked list with the error type and attempts next to the results. The editor’s brief then says Quarry was not checked (map server timeout, two attempts) instead of “no records”, and South was searched and has no sheets from the period.",
};
