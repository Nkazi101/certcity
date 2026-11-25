// Developer Foundations · library-workers. The learner writes the JSON Schema each collection worker returns (what
// crosses from an isolated worker to the editor: cited fields and coverage status), the catalog MCP server's listing
// (resources by URI, tools with an inputSchema, prompts) and the shared review Skill. The replay assembles the editor's
// packet, runs a mock MCP client for the reader app and for Claude, and starts sessions at three desks.
// Transfer (rerun, hidden): another morning's workers (one finds nothing, one fails), another district and title,
// and next quarter's checklist.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { mcpCatalogEngine } from "../engines/mcp-catalog";
import type { CatalogInput, CatalogOut, CollectionWorker } from "../engines/mcp-catalog";
import type { Check, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const checklistV3 = [
  "Confirm the collection’s scope and owner", "List accessions changed this quarter", "Check each accession against the register",
  "Mark anything not checked as pending", "Send cited findings to the editor",
];
const checklistV4 = [
  "Confirm the collection’s scope and owner", "List accessions changed this quarter", "Check each accession against the register",
  "Photograph items that have condition notes", "Mark anything not checked as pending", "Send cited findings to the editor",
];
const skill = (steps: readonly string[]) => ({ name: "collection-review", checklist: "checklist.md", steps, terms: ["review"] });
const desks = [
  { desk: "Reference", request: "Start the quarterly review of the reference collection." },
  { desk: "Maps", request: "Begin this quarter’s maps review." },
  { desk: "Special collections", request: "Run the quarterly review for special collections." },
];
const reader = { app: "the reader app", uri: "policy://lending" };
const hits = {
  Eastside: ["Eastside Main", "Dock Street"], Northgate: ["Northgate Hall"], Rivermouth: ["Rivermouth", "Quay Annex"], "Old Town": ["Central Stacks"],
};

const worker = (entry: CollectionWorker) => entry;
const morning: CatalogInput = {
  workers: [
    worker({ id: "REG-9", collection: "register", state: "found", event: "finished 09:10", claim: "The 1904 flood map was donated by the Hale family in 1911",
      accession: "A-5531", source: "Donations register 1898–1912, folio 44", at: "09:10", logTokens: 14200 }),
    worker({ id: "MAP-4", collection: "maps", state: "unfinished", event: "started 09:02 · no completion event by 09:30", logTokens: 6100 }),
  ],
  packetBudget: 8000, reader,
  search: { question: "Do any Eastside branches hold the 1921 Harbor survey?", district: "Eastside", title: "Harbor survey 1921", hits },
  skill: skill(checklistV3), desks,
};
const news: CatalogInput = {
  workers: [
    worker({ id: "NEWS-2", collection: "newspapers", state: "found", event: "finished 10:41", claim: "The Harbor Gazette reported the survey’s completion",
      accession: "N-8812", source: "Harbor Gazette, 12 May 1921, p. 3", at: "10:41", logTokens: 11800 }),
    worker({ id: "SHIP-3", collection: "shipping records", state: "empty", event: "finished 10:15 · 0 matching records", logTokens: 4300 }),
    worker({ id: "PHOTO-7", collection: "photographs", state: "unfinished", event: "failed 10:20 · archive API returned 503", logTokens: 900 }),
  ],
  packetBudget: 8000, reader,
  search: { question: "Is there a copy of the 1888 tide tables anywhere in Northgate?", district: "Northgate", title: "Tide tables 1888", hits: { Northgate: ["Northgate Hall"], Eastside: ["Eastside Main"], "Old Town": ["Central Stacks"] } },
  skill: skill(checklistV4), desks,
};
const parish: CatalogInput = {
  workers: [
    worker({ id: "DEED-2", collection: "land deeds", state: "unfinished", event: "started 13:40 · no completion event by 14:10", logTokens: 7400 }),
    worker({ id: "PAR-5", collection: "parish registers", state: "found", event: "finished 14:05", claim: "The Mill Lane chapel’s baptism record names the surveyor",
      accession: "P-1187", source: "St Brigid parish register 1838–1845, entry 212", at: "14:05", logTokens: 9600 }),
    worker({ id: "CEM-1", collection: "cemetery plans", state: "empty", event: "finished 13:58 · 0 matching records", logTokens: 2100 }),
  ],
  packetBudget: 8000, reader,
  search: { question: "Which Rivermouth branches have the 1840 parish register?", district: "Rivermouth", title: "Parish register 1840", hits: { Rivermouth: ["Quay Annex"], Northgate: ["Northgate Hall"], Eastside: ["Dock Street"] } },
  skill: skill(checklistV4), desks: [
    { desk: "Local history", request: "Start our quarterly review of the local history shelves." }, ...desks.slice(1),
  ],
};

const fixtures: Fixture<CatalogInput>[] = [
  { id: "morning", name: "Tuesday morning · 2 workers, 1 reader, 3 desks", set: "sample", situation: "REG-9 finished with a finding; MAP-4 started and never reported back.", input: morning },
  { id: "news", name: "Another morning · 3 workers", set: "transfer", variant: "news", situation: "One worker finds a source, one finds nothing, one fails; a Northgate search; next quarter’s checklist.", input: news },
  { id: "parish", name: "Another afternoon · 3 workers", set: "transfer", variant: "parish", situation: "One worker stalls, one finds a source, one finds nothing; a Rivermouth search; next quarter’s checklist.", input: parish },
];

const nullableText = { type: ["string", "null"] };
const schemaFile = ({ coverage = ["verified", "no_records", "incomplete"] as string[] | null, extra = {} as Record<string, unknown>, drop = [] as string[] } = {}) => {
  const properties: Record<string, unknown> = { collection: { type: "string" }, ...(coverage && { coverage: { type: "string", enum: coverage } }),
    claim: nullableText, accession: nullableText, source: nullableText, checked_at: nullableText, ...extra };
  for (const key of drop) delete properties[key];
  return compactJson({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
};
const policyResource = { uri: "policy://lending", name: "lending-policy", description: "The current lending policy (read-only).", mimeType: "text/markdown" };
const searchTool = (properties: Record<string, unknown> = { district: { type: "string" }, query: { type: "string" } }, { name = "search_holdings", type = "object" as string | null } = {}) => ({
  name, description: "Search live holdings in one district by title or keyword.",
  inputSchema: { ...(type && { type }), properties, required: Object.keys(properties) },
});
const manifestFile = ({ resources = [policyResource] as unknown[], tools = [searchTool()] as unknown[], prompts = [] as unknown[] } = {}) => compactJson({ resources, tools, prompts });
const skillFile = ({ description = "Quarterly collection review procedure. Use when a desk starts or runs its quarterly review of a collection.", body = "Follow the steps in checklist.md in this folder, in order, for the collection named in the request.\nReport each finding with its accession, source and time; list anything not checked as pending.", extra = "" } = {}) =>
  `---\nname: collection-review\ndescription: ${description}\n${extra}---\n${body}\n`;
const reference: LabFiles = { schema: schemaFile(), manifest: manifestFile(), skill: skillFile() };
// Deployed: workers hand back their whole transcript and can only say verified or no_records; the policy is a prompt,
// the search is a fixed resource, and the review steps were pasted into a skill nobody's request ever matches.
const starter: LabFiles = {
  schema: compactJson({ type: "object", required: ["transcript", "status"], properties: { transcript: { type: "string" }, status: { type: "string", enum: ["verified", "no_records"] } } }),
  manifest: manifestFile({ resources: [{ uri: "catalog://holdings", name: "holdings", description: "Catalog holdings for every district." }], tools: [],
    prompts: [{ name: "lending_policy", description: "The lending policy text." }] }),
  skill: skillFile({ description: "Catalog rows for the collections table.", body: "1. List new accessions\n2. Check them against the register\n3. Send the editor a summary" }),
};

type C = Check<CatalogInput, CatalogOut>;
const checks: C[] = [
  {
    id: "packet-cited", objective: "6.1", title: "The editor can name the accession, source and time of every finding",
    diagnosis: "A worker runs in its own context; only what it returns reaches the coordinator. Returning the whole transcript floods the editor’s context and buries the one fact that matters. Return compact structured findings: the claim with its accession, source and time.",
    hints: hints("Read the packet size line and the editor’s draft. Which worker’s finding lost its accession, source or time?",
      "Context engineering for subagents: define the worker’s output as structured fields (claim, accession, source, checked_at) instead of raw logs. Small, cited facts survive the handoff; twenty pages of tool output do not fit the next step’s working context.",
      "A detective hands the prosecutor an evidence log (item, where found, time, officer), not the whole notebook."),
    reveal: "Finding schema properties: claim, accession, source, checked_at (strings, null when there is nothing), and no transcript field.",
    evaluate: ({ out }, fixture) => {
      const found = fixture.input.workers.filter(({ state }) => state === "found");
      for (const entry of found) {
        const packet = out.packet.entries.find(({ worker: id }) => id === entry.id);
        if (out.packet.lost && packet?.raw) return { passed: false, symptom: `The editor’s packet is ${out.packet.tokens.toLocaleString("en-US")} tokens of worker transcript; the draft names no accession for ${entry.id}.`, source: out.sources.schema };
        const missing = [!packet?.accession && "accession", !packet?.source && "source", !packet?.time && "time"].filter(Boolean);
        if (missing.length) return { passed: false, symptom: `The editor’s draft cites ${entry.id}’s finding without its ${missing.join(", ")}.`, source: out.sources.schema };
      }
      return { passed: true, symptom: `${found.map(({ id, accession }) => `${id} → ${accession}`).join(", ")} reached the editor with source and time in a ${out.packet.tokens}-token packet.` };
    },
  },
  {
    id: "coverage-honest", objective: "1.3", title: "An unfinished worker never appears as complete or as “nothing found”",
    diagnosis: "In an orchestrator–worker pattern the coordinator only knows what workers report. A worker that timed out or failed must surface as unfinished, separate from one that finished and found nothing; otherwise the synthesis claims coverage it does not have.",
    hints: hints("Compare each worker’s event (finished, found nothing, never finished) with how the packet reports it.",
      "Propagate worker status: give the result a coverage field whose values distinguish verified, searched-with-no-records and not finished (timed out or failed). If the schema has no honest value, the coordinator rounds an unfinished search up to an outcome.",
      "A building inspector who could not reach the roof writes “roof: not inspected”, not “roof: no defects”, and a roof checked and found sound gets its own line."),
    reveal: "\"coverage\": { \"type\": \"string\", \"enum\": [\"verified\", \"no_records\", \"incomplete\"] } (required).",
    evaluate: ({ out }, fixture) => {
      for (const worker of fixture.input.workers) {
        const entry = out.packet.entries.find(({ worker: id }) => id === worker.id);
        const want = worker.state === "found" ? "complete" : worker.state === "empty" ? "empty" : "incomplete";
        if (!entry) {
          if (worker.state === "found") continue;
          return { passed: false, symptom: `${worker.id} ${worker.state === "unfinished" ? "never finished" : "found nothing"} and is missing from the packet, so the editor cannot tell the ${worker.collection} were in scope.`, source: out.sources.status };
        }
        if (entry.reported === want) continue;
        if (entry.reported === "unlabelled") return { passed: false, symptom: `${worker.id} appears in the packet with no coverage status, and the editor’s draft counts the ${worker.collection} as checked.`, source: out.sources.status };
        if (worker.state === "unfinished") return { passed: false, symptom: `${worker.id} never finished, but the packet reports it as “${entry.status}”: the editor’s draft says the ${worker.collection} were ${entry.reported === "empty" ? "searched with no records" : "checked"}.`, source: out.sources.status };
        if (worker.state === "empty") return { passed: false, symptom: `${worker.id} finished and found nothing, but the packet reports it as “${entry.status}”.`, source: out.sources.status };
        return { passed: false, symptom: `${worker.id} found ${worker.accession}, but the packet reports it as “${entry.status}”.`, source: out.sources.status };
      }
      return { passed: true, symptom: "Every worker’s coverage reached the editor as it really was." };
    },
  },
  {
    id: "policy-resource", objective: "8.2", title: "The reader app opens the lending policy by its URI",
    diagnosis: "MCP has three server primitives. Resources are read-only content a client application lists and reads by URI (resources/read). Tools are functions the model decides to call with arguments. Prompts are templates a user picks. A fixed document an app addresses directly is a resource.",
    hints: hints("Read the resources/read line in the trace, then where your manifest lists the lending policy.",
      "MCP resources: { uri, name, description?, mimeType? } in resources/list; the client reads one with resources/read { uri }. Listing a document as a prompt or a tool does not give it an address.",
      "A museum app links each exhibit to its audio file at a fixed address; it does not ask a guide to fetch it."),
    reveal: "\"resources\": [{ \"uri\": \"policy://lending\", \"name\": \"lending-policy\", \"mimeType\": \"text/markdown\" }]",
    evaluate: ({ out }) => out.policy.ok ? { passed: true, symptom: "resources/read returned the lending policy." }
      : { passed: false, symptom: `The reader app could not open the policy: ${out.policy.problem}.`, source: out.policy.source },
  },
  {
    id: "search-tool", objective: "8.2", title: "Claude searches live holdings in the district the reader asked about",
    diagnosis: "A lookup whose inputs Claude chooses mid-conversation is an MCP tool: a name, a description and an inputSchema (a JSON Schema with \"type\": \"object\") declaring each argument. A fixed resource cannot take a district, and an argument the schema does not declare cannot be passed.",
    hints: hints("Read the tools/call line: which arguments did Claude send, and what did the tool return?",
      "MCP tools: { name, description, inputSchema: { type: \"object\", properties: { … }, required: [ … ] } }. Declare every argument the handler needs (here the district and what to look for) and keep the values open unless the set is truly fixed.",
      "A weather app’s “forecast for city X” is a function with an input; its terms of service page is a document at a fixed link."),
    reveal: "\"tools\": [{ \"name\": \"search_holdings\", \"description\": \"…\", \"inputSchema\": { \"type\": \"object\", \"properties\": { \"district\": { \"type\": \"string\" }, \"query\": { \"type\": \"string\" } }, \"required\": [\"district\", \"query\"] } }]",
    evaluate: ({ out }, fixture) => out.search.ok ? { passed: true, symptom: `Claude searched ${fixture.input.search.district} for “${fixture.input.search.title}”.` }
      : { passed: false, symptom: `${out.search.problem}.`, source: out.search.source },
  },
  {
    id: "shared-procedure", objective: "8.3", title: "Every desk loads the same, current review procedure",
    diagnosis: "A Skill is a folder with SKILL.md plus supporting files. Claude sees the description and loads the body when a request matches it, unless disable-model-invocation makes it manual-only. Pointing the body at checklist.md keeps every team on the file Reese updates; steps pasted into SKILL.md drift.",
    hints: hints("Read the three desk lines: did Claude load the skill, and which steps ran?",
      "Agent Skills: the description says what the skill does and when to use it, in the words requests use. The body gives instructions and references supporting files in the skill folder, which Claude reads when needed.",
      "A restaurant chain keeps one laminated opening checklist in each kitchen’s binder and swaps the page when it changes; cooks who copied last year’s steps onto a sticky note drift."),
    reveal: "description: “… Use when a desk starts or runs its quarterly review of a collection.” Body: “Follow the steps in checklist.md in this folder…”.",
    evaluate: ({ out }) => {
      const wrong = out.desks.find(({ problem }) => problem);
      return wrong ? { passed: false, symptom: `${wrong.desk} desk: ${wrong.problem}.`, source: wrong.source }
        : { passed: true, symptom: `${out.desks.length} desks ran the current checklist.` };
    },
  },
];

function effects(runs: readonly LabRunFixture<CatalogInput, CatalogOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      ...fixture.input.workers.map((worker) => {
        const entry = out.packet.entries.find(({ worker: id }) => id === worker.id);
        const honest = !!entry && entry.reported === (worker.state === "found" ? "complete" : worker.state === "empty" ? "empty" : "incomplete");
        return { kind: "tray" as const, item: `${worker.id} packet entry`, to: !honest ? "failed" as const : worker.state === "found" && !out.packet.lost ? "posted" as const : "held" as const };
      }),
      { kind: "tray" as const, item: `${fixture.input.reader.uri}`, to: out.policy.ok ? "posted" as const : "failed" as const },
      { kind: "tray" as const, item: `${fixture.input.search.district} search`, to: out.search.ok ? "posted" as const : "failed" as const },
      { kind: "meter" as const, id: `${fixture.id}-packet`, label: "editor’s packet", value: out.packet.tokens, limit: fixture.input.packetBudget, unit: "tokens", better: "lower" as const },
    ];
  });
}

const withSchema = (options: Parameters<typeof schemaFile>[0]): LabFiles => ({ ...reference, schema: schemaFile(options) });
const withManifest = (options: Parameters<typeof manifestFile>[0]): LabFiles => ({ ...reference, manifest: manifestFile(options) });
const withSkill = (options: Parameters<typeof skillFile>[0]): LabFiles => ({ ...reference, skill: skillFile(options) });
const pastedSteps = (steps: readonly string[]) => steps.map((step, index) => `${index + 1}. ${step}`).join("\n");

export const libraryWorkersLab: LabMission<unknown, CatalogInput, CatalogOut> = {
  id: "library-workers",
  provider: "anthropic",
  track: "developer-foundations",
  objectives: ["1.3", "6.1", "8.2", "8.3"],
  station: "Worker packets and catalog",
  speaker: "Reese Park",
  opening: "The editor got twenty pages of logs and lost the accession that had actually been checked.",
  task: "Write what each worker returns, the catalog server’s listing and the shared review Skill, then replay the morning.",
  brief: {
    problem: "The editor received raw logs and lost the one checked finding, an unfinished map search read as complete, the reader app cannot open the policy, Claude cannot search by district, and each desk runs a different review.",
    move: "Read the worker reports and the catalog consumers, then how the coordinator and the catalog server use your files. Edit the three files and replay.",
    success: ["The editor can name the accession, source and time for each finding", "An unfinished worker is reported as unfinished", "The reader app opens policy://lending by its URI", "Claude searches live holdings in the requested district", "Every desk runs the current checklist"],
  },
  prebrief: {
    concept: "Workers start with isolated context and return only what you ask for. MCP servers expose resources (content an app reads by URI), tools (functions Claude calls with arguments) and prompts (templates a user picks). A Skill packages instructions and files Claude loads when a task needs them.",
    terms: [["What a worker hands back", "Structured subagent output"], ["A search that never finished", "Propagated worker status"], ["Document you open by address", "MCP resource (resources/read)"],
      ["Action with inputs", "MCP tool with inputSchema"], ["Reusable procedure with files", "Agent Skill (SKILL.md)"]],
    contrast: {
      good: "A library catalog card points to one book by call number, while the search kiosk takes whatever words you type.",
      bad: "Making the kiosk the only way to reach a known call number forces every reader to search for it.",
    },
  },
  documents: [
    { id: "workers", title: "Worker reports this morning", format: "code", text: morning.workers.map(({ id, collection, event, claim, accession, source, logTokens }) =>
      `${id} · ${collection} · ${event}${claim ? `\n   ${claim} · accession ${accession} · ${source}` : ""}\n   full transcript: ${logTokens.toLocaleString("en-US")} tokens`).join("\n") },
    { id: "consumers", title: "Catalog consumers (Ben Carter)", text: "The reader app opens one fixed document, the lending policy, at policy://lending; it never needs inputs. Claude has to search live holdings while it talks to a reader: the search handler needs the district and what to look for (a title or keyword). Three desks run the same quarterly review with checklist.md, which Reese updates every quarter." },
    { id: "coordinator", title: "coordinator.ts and catalog-server.ts · how your files are used", text: "Each worker’s final result must match workers/finding-schema.json (it is the worker’s output format); the coordinator puts every result into the editor’s packet, and the drafting step works from at most 8,000 tokens of it.\ncatalog-server.json is what the MCP server answers to resources/list, tools/list and prompts/list. The reader app calls resources/read with a URI; Claude calls tools/call with arguments that must validate against the tool’s inputSchema.\nSKILL.md lives in .claude/skills/collection-review/ next to checklist.md and is committed for every desk." },
    { id: "checklist", title: ".claude/skills/collection-review/checklist.md (this quarter)", format: "code", text: pastedSteps(checklistV3) },
  ],
  artifacts: [
    { id: "schema", kind: "json-schema", path: "workers/finding-schema.json", editor: "json", instruction: "What every collection worker returns to the coordinator.",
      starter: starter.schema, example: compactJson({ type: "object", additionalProperties: false, required: ["shelf", "result", "seen_at"],
        properties: { shelf: { type: "string" }, result: { type: "string", enum: ["ok", "damaged"] }, seen_at: { type: ["string", "null"] } } }) },
    { id: "manifest", kind: "mcp.server-manifest", path: "catalog-server.json", editor: "json", instruction: "What the catalog MCP server lists: resources, tools and prompts.",
      starter: starter.manifest, example: compactJson({ resources: [{ uri: "menu://today", name: "todays-menu", mimeType: "text/plain" }],
        tools: [{ name: "book_table", description: "Book a table.", inputSchema: { type: "object", properties: { guests: { type: "integer" } }, required: ["guests"] } }],
        prompts: [{ name: "allergy_note", description: "Draft an allergy note.", arguments: [{ name: "dish", required: true }] }] }) },
    { id: "skill", kind: "claude-code.skill", path: ".claude/skills/collection-review/SKILL.md", editor: "markdown", instruction: "The review procedure every desk’s Claude should load.",
      starter: starter.skill, example: "---\nname: opening-shift\ndescription: Café opening procedure. Use when someone starts the morning opening.\n---\nWork through opening.md in this folder, in order.\n" },
  ],
  engine: mcpCatalogEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many of the three desks will run the current checklist?", unit: "desks",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + ((entry?.out as CatalogOut | undefined)?.desks.filter(({ problem }) => !problem).length ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { news: reference, parish: reference } },
  mutants: [
    { name: "transcript in every result", set: "sample", mustFail: ["packet-cited"], edit: () => withSchema({ extra: { transcript: { type: "string" } } }) },
    { name: "no source field", set: "sample", mustFail: ["packet-cited"], edit: () => withSchema({ drop: ["source"] }) },
    { name: "no value for an unfinished worker", set: "sample", mustFail: ["coverage-honest"], edit: () => withSchema({ coverage: ["verified", "no_records"] }) },
    { name: "no coverage field", set: "sample", mustFail: ["coverage-honest"], edit: () => withSchema({ coverage: null }) },
    { name: "no value for an empty search", set: "transfer", variant: "parish", mustFail: ["coverage-honest"], edit: () => withSchema({ coverage: ["verified", "incomplete"] }) },
    { name: "policy listed as a prompt", set: "sample", mustFail: ["policy-resource"], edit: () => withManifest({ resources: [], prompts: [{ name: "lending_policy", description: "The lending policy text." }] }) },
    { name: "policy at another URI", set: "sample", mustFail: ["policy-resource"], edit: () => withManifest({ resources: [{ ...policyResource, uri: "policy://lending-v2" }] }) },
    { name: "search as a fixed resource", set: "sample", mustFail: ["search-tool"], edit: () => withManifest({ resources: [policyResource, { uri: "catalog://holdings", name: "holdings", description: "Catalog holdings." }], tools: [] }) },
    { name: "tool without a district", set: "sample", mustFail: ["search-tool"], edit: () => withManifest({ tools: [searchTool({ query: { type: "string" } })] }) },
    { name: "inputSchema without a type", set: "sample", mustFail: ["search-tool"], edit: () => withManifest({ tools: [searchTool(undefined, { type: null })] }) },
    { name: "tool name with a space", set: "sample", mustFail: ["search-tool"], edit: () => withManifest({ tools: [searchTool(undefined, { name: "search holdings" })] }) },
    { name: "district limited to Eastside", set: "transfer", variant: "news", mustFail: ["search-tool"], edit: () => withManifest({ tools: [searchTool({ district: { type: "string", enum: ["Eastside"] }, query: { type: "string" } })] }) },
    { name: "manual-only skill", set: "sample", mustFail: ["shared-procedure"], edit: () => withSkill({ extra: "disable-model-invocation: true\n" }) },
    { name: "description never says when", set: "sample", mustFail: ["shared-procedure"], edit: () => withSkill({ description: "Collections procedure and checklist." }) },
    { name: "steps pasted into SKILL.md", set: "transfer", variant: "news", mustFail: ["shared-procedure"], edit: () => withSkill({ body: pastedSteps(checklistV3) }) },
  ],
  probes: [
    { name: "transcript and fields together", set: "sample", mustFail: ["packet-cited"], files: () => withSchema({ extra: { full_log: { type: "string" } } }) },
    { name: "manual-only skill stuffed with review words", set: "sample", mustFail: ["shared-procedure"],
      files: () => withSkill({ description: "review review quarterly review collection review", extra: "disable-model-invocation: true\n" }) },
  ],
  overfit: withSkill({ body: pastedSteps(checklistV3) }),
  fixTerms: ["checked_at", "disable-model-invocation: false"],
  debrief: "Workers return a closed finding schema (claim, accession, source, checked_at) plus a required coverage enum that separates verified, no_records and incomplete, so the editor gets a few hundred cited tokens and every gap stays visible. The catalog server lists the lending policy as a resource at policy://lending for the reader app, and search_holdings as a tool whose inputSchema declares district and query for Claude. The review Skill’s description says when to use it and its body points at checklist.md, so every desk loads the same current steps.",
};
