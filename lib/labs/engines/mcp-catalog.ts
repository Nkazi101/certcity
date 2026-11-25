// Library research desk replay: collection workers, an MCP catalog server and a shared Skill.
// 1. Workers return results in the learner's finding schema; the coordinator assembles the editor's packet from them
//    (what each worker reports, including the coverage status of a worker that never finished).
// 2. A mock MCP client lists the learner's server manifest the way the protocol defines it (resources by uri,
//    tools with name + inputSchema, prompts with arguments), then the reader app calls resources/read and Claude
//    calls the search tool with arguments validated against its inputSchema.
// 3. Three desks start sessions; SKILL.md frontmatter decides whether Claude loads the skill and its body decides
//    which steps run. How Claude fills fields and matches a description are proxies and are labelled as simulated.
import { list, parseFrontmatter, record, text, validateSchema } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type CollectionWorker = {
  id: string; collection: string;
  state: "found" | "empty" | "unfinished";
  /** What the coordinator saw, e.g. "finished 09:10" or "no completion event by 09:30". */
  event: string;
  claim?: string; accession?: string; source?: string; at?: string;
  /** Size of the worker's full transcript. */
  logTokens: number;
};
export type CatalogInput = {
  workers: readonly CollectionWorker[];
  /** How much of the packet the editor's drafting step can work from. */
  packetBudget: number;
  reader: { app: string; uri: string };
  search: { question: string; district: string; title: string; hits: Readonly<Record<string, readonly string[]>> };
  skill: { name: string; checklist: string; steps: readonly string[]; terms: readonly string[] };
  desks: readonly { desk: string; request: string }[];
};

export type Coverage = "complete" | "empty" | "incomplete" | "unlabelled" | "omitted";
export type CatalogOut = {
  packet: {
    tokens: number; lost: boolean;
    entries: readonly { worker: string; state: CollectionWorker["state"]; reported: Coverage; status: string | null;
      accession: boolean; source: boolean; time: boolean; raw: boolean }[];
  };
  policy: { ok: boolean; problem: string | null; source: TraceSource };
  search: { ok: boolean; problem: string | null; source: TraceSource };
  desks: readonly { desk: string; loaded: boolean; problem: string | null; source: TraceSource }[];
  sources: { schema: TraceSource; status: TraceSource; manifest: TraceSource; skill: TraceSource };
};

type Parsed = { schema: LocatedJson; manifest: LocatedJson; skill: string };

const toolName = /^[a-zA-Z0-9_-]{1,64}$/;
const incompleteWord = /pending|incomplete|unfinished|timed?_?out|timeout|fail|error|partial|unknown|not_?(?:checked|finished|done|complete)|in_?progress|running|unverified|gap/i;
const emptyWord = /no_?records?|none|empty|not_?found|no_?results?|nothing|no_?match/i;
const kindOf = (value: string): "incomplete" | "empty" | "complete" => incompleteWord.test(value) ? "incomplete" : emptyWord.test(value) ? "empty" : "complete";

const typesOf = (node: Record<string, unknown> | null): string[] => !node ? [] : [
  ...(Array.isArray(node.type) ? node.type.map(String) : typeof node.type === "string" ? [node.type] : []),
  ...list(node.anyOf).flatMap((option) => typesOf(record(option))),
];
const enumOf = (node: Record<string, unknown> | null): string[] => [
  ...list(node?.enum).filter((value): value is string => typeof value === "string"),
  ...list(node?.anyOf).flatMap((option) => enumOf(record(option))),
];

const fieldTests = {
  status: /status|coverage|state|outcome/i,
  raw: /log|transcript|raw|trace|details|full/i,
  accession: /accession|item_?id|record_?id|call_?number/i,
  source: /source|citation|cite|reference|evidence/i,
  time: /time|_at$|^at$|checked|timestamp|date|when/i,
  claim: /claim|finding|summary|answer|result/i,
  collection: /collection|worker|scope/i,
};

function workerResult(schema: Record<string, unknown>, worker: CollectionWorker) {
  const properties = Object.entries(record(schema.properties) ?? {}).map(([key, node]) => [key, record(node)] as const);
  const required = new Set(list(schema.required).map(String));
  const keyFor = (test: RegExp, enumOnly = false) => properties.find(([key, node]) => test.test(key) && (enumOnly ? enumOf(node).length > 0 : true))?.[0] ?? null;
  const keys = {
    status: keyFor(fieldTests.status, true), raw: keyFor(fieldTests.raw), accession: keyFor(fieldTests.accession), source: keyFor(fieldTests.source),
    time: keyFor(fieldTests.time), claim: keyFor(fieldTests.claim), collection: keyFor(fieldTests.collection),
  };
  const output: Record<string, unknown> = {};
  const fill = (key: string | null, value: string | undefined) => {
    if (!key) return;
    const node = properties.find(([name]) => name === key)?.[1] ?? null;
    if (value !== undefined) output[key] = value;
    else if (typesOf(node).includes("null")) output[key] = null;
    else if (required.has(key)) output[key] = "";
  };
  fill(keys.collection, worker.collection);
  fill(keys.claim, worker.claim);
  fill(keys.accession, worker.accession);
  fill(keys.source, worker.source);
  fill(keys.time, worker.at);
  if (keys.raw) output[keys.raw] = `[${worker.logTokens.toLocaleString("en-US")}-token transcript of ${worker.id}]`;
  let reported: Coverage = "omitted";
  let status: string | null = null;
  if (keys.status) {
    const values = enumOf(properties.find(([key]) => key === keys.status)?.[1] ?? null);
    const want = worker.state === "found" ? "complete" : worker.state === "empty" ? "empty" : "incomplete";
    // Simulated: the coordinator picks the closest allowed value; with no honest option it rounds up to an outcome.
    const fallback: readonly ("incomplete" | "empty" | "complete")[] = want === "incomplete" ? ["empty", "complete"] : want === "empty" ? ["complete", "incomplete"] : ["empty", "incomplete"];
    status = values.find((value) => kindOf(value) === want)
      ?? (required.has(keys.status) ? fallback.map((kind) => values.find((value) => kindOf(value) === kind)).find(Boolean) ?? values[0] ?? null : null);
    if (status !== null) output[keys.status] = status;
    reported = status === null ? "unlabelled" : kindOf(status);
  } else reported = worker.state === "found" ? "complete" : "omitted";
  const included = keys.status ? true : worker.state === "found";
  return { output, keys, reported, status, included };
}

export const mcpCatalogEngine: Engine<Parsed, CatalogInput, CatalogOut> = {
  id: "mcp.catalog-desk-replay",
  provider: "neutral",
  label: "Worker handoff · MCP client (resources, tools, prompts) · Skill loading",
  simulated: false,
  parse(files) {
    const schema = parseLocatedJson(files.schema, "workers/finding-schema.json");
    if (schema.error !== undefined) return { ok: false, error: schema.error, source: { artifact: "schema" } };
    if (!record(schema.value.value)) return { ok: false, error: "workers/finding-schema.json must be a JSON Schema object.", source: { artifact: "schema", line: 1 } };
    const manifest = parseLocatedJson(files.manifest, "catalog-server.json");
    if (manifest.error !== undefined) return { ok: false, error: manifest.error, source: { artifact: "manifest" } };
    if (!record(manifest.value.value)) return { ok: false, error: "catalog-server.json must be a JSON object with resources, tools and prompts.", source: { artifact: "manifest", line: 1 } };
    const skill = parseFrontmatter(files.skill);
    if (skill.error) return { ok: false, error: `SKILL.md: ${skill.error}`, source: { artifact: "skill", line: 1 } };
    if (!(files.skill ?? "").trim()) return { ok: false, error: "SKILL.md is empty.", source: { artifact: "skill", line: 1 } };
    return { ok: true, value: { schema: schema.value, manifest: manifest.value, skill: files.skill } };
  },
  run({ schema: located, manifest: manifestFile, skill: skillText }, fixture: Fixture<CatalogInput>): EngineRun<CatalogOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const schemaAt = (path: string): TraceSource => ({ artifact: "schema", pointer: path, line: lineOf(located, path) });
    const manifestAt = (path: string): TraceSource => ({ artifact: "manifest", pointer: path, line: lineOf(manifestFile, path) });
    const schema = record(located.value)!;
    const statusKey = Object.keys(record(schema.properties) ?? {}).find((key) => fieldTests.status.test(key) && enumOf(record(record(schema.properties)?.[key])).length > 0);
    const sources = { schema: schemaAt(""), status: schemaAt(statusKey ? pointer("properties", statusKey) : "/properties"), manifest: manifestAt(""), skill: { artifact: "skill", line: 1 } as TraceSource };

    // --- 1. workers → editor's packet ---
    push({ actor: "learner-artifact", kind: "request", label: `Coordinator · ${input.workers.length} collection workers, each returning workers/finding-schema.json`, source: sources.schema });
    const entries: CatalogOut["packet"]["entries"][number][] = [];
    let tokens = 0;
    for (const worker of input.workers) {
      push({ actor: "tool", kind: "output", label: `${worker.id} · ${worker.collection} · ${worker.event}`, tone: worker.state === "unfinished" ? "warn" : undefined });
      const result = workerResult(schema, worker);
      const problems = validateSchema(schema, result.output);
      if (!result.included) {
        push({ actor: "model", kind: "response", label: `${worker.id} · nothing to return: the finding schema has no way to report this worker`, source: sources.status, tone: "bad" });
        continue;
      }
      const raw = !!result.keys.raw;
      const size = 45 + (raw ? worker.logTokens : 0);
      tokens += size;
      entries.push({ worker: worker.id, state: worker.state, reported: result.reported, status: result.status,
        accession: !!result.keys.accession && !!worker.accession && result.output[result.keys.accession] === worker.accession,
        source: !!result.keys.source && !!worker.source && result.output[result.keys.source] === worker.source,
        time: !!result.keys.time && !!worker.at && result.output[result.keys.time] === worker.at, raw });
      push({ actor: "model", kind: "response", label: `${worker.id} returns ${size.toLocaleString("en-US")} tokens${problems.length ? " · " + problems[0] : ""}`,
        payload: result.output, source: sources.schema, tone: problems.length ? "warn" : undefined });
    }
    const lost = tokens > input.packetBudget;
    push({ actor: "service", kind: "metric", label: `Editor’s packet · ${entries.length} entries · ${tokens.toLocaleString("en-US")} tokens (drafting reads up to ${input.packetBudget.toLocaleString("en-US")})`, tone: lost ? "bad" : undefined });
    const draft = input.workers.map((worker) => {
      const entry = entries.find(({ worker: id }) => id === worker.id);
      if (!entry) return `${worker.collection}: not mentioned`;
      if (lost && entry.raw && worker.state === "found") return `${worker.collection}: “checked” (no accession found in the transcript excerpt)`;
      if (entry.reported === "complete" || entry.reported === "unlabelled") {
        return worker.state === "found"
          ? `${worker.collection}: ${worker.claim}${entry.accession ? ` · ${worker.accession}` : ""}${entry.source ? ` · ${worker.source}` : ""}${entry.time ? ` · ${worker.at}` : ""}`
          : `${worker.collection}: checked`;
      }
      return `${worker.collection}: ${entry.reported === "empty" ? "searched, no records" : "not finished; not checked"}`;
    });
    push({ actor: "person", kind: "output", label: "Simulated editor’s draft", detail: draft.join("\n") });

    // --- 2. MCP server ---
    const manifest = record(manifestFile.value)!;
    const resources = list(manifest.resources).map((entry, index) => ({ entry: record(entry), index }));
    const tools = list(manifest.tools).map((entry, index) => ({ entry: record(entry), index }));
    const prompts = list(manifest.prompts).map((entry, index) => ({ entry: record(entry), index }));
    const validResources = resources.filter(({ entry, index }) => {
      const ok = !!entry && typeof entry.uri === "string" && typeof entry.name === "string";
      if (!ok) push({ actor: "service", kind: "error", label: `resources/list · entry ${index} skipped: a resource needs a string uri and name`, source: manifestAt(pointer("resources", index)), tone: "bad" });
      return ok;
    });
    const validTools = tools.filter(({ entry, index }) => {
      const schemaNode = record(entry?.inputSchema);
      const problem = !entry || typeof entry.name !== "string" ? "a tool needs a name" : !toolName.test(entry.name) ? `“${entry.name}” is not a valid tool name (letters, digits, _ and -, up to 64)`
        : !schemaNode ? "inputSchema is missing" : schemaNode.type !== "object" ? "inputSchema must have \"type\": \"object\"" : null;
      if (problem) push({ actor: "service", kind: "error", label: `tools/list · entry ${index} skipped: ${problem}`, source: manifestAt(pointer("tools", index)), tone: "bad" });
      return !problem;
    });
    push({ actor: "service", kind: "response", label: `initialize · catalog server lists ${validResources.length} resource(s), ${validTools.length} tool(s), ${prompts.length} prompt(s)`,
      detail: [...validResources.map(({ entry }) => `resource ${entry!.uri}`), ...validTools.map(({ entry }) => `tool ${entry!.name}`), ...prompts.map(({ entry }) => `prompt ${text(entry?.name)}`)].join(" · "), source: sources.manifest });

    // Reader app: resources/read by URI.
    const policyResource = validResources.find(({ entry }) => entry!.uri === input.reader.uri);
    const policyElsewhere = [...prompts.map(({ entry, index }) => ({ kind: "prompt", entry, at: manifestAt(pointer("prompts", index)) })),
      ...validTools.map(({ entry, index }) => ({ kind: "tool", entry, at: manifestAt(pointer("tools", index)) }))]
      .find(({ entry }) => /lend|policy/i.test(`${text(entry?.name)} ${text(entry?.description)}`));
    const policy = policyResource
      ? { ok: true, problem: null, source: manifestAt(pointer("resources", policyResource.index)) }
      : { ok: false, source: policyElsewhere?.at ?? manifestAt(manifest.resources ? "/resources" : ""),
        problem: `resources/read ${input.reader.uri} → error -32002 Resource not found${policyElsewhere ? ` (the lending policy is listed as a ${policyElsewhere.kind}, which ${input.reader.app} cannot read by address)` : ""}` };
    push({ actor: "person", kind: "request", label: `${input.reader.app} · resources/read ${input.reader.uri}`, detail: policy.ok ? "Returned the lending policy." : policy.problem!, source: policy.source, tone: policy.ok ? "ok" : "bad" });

    // Claude: tools/list → tools/call with arguments built from inputSchema.
    push({ actor: "person", kind: "request", label: `Reader asks Claude: “${input.search.question}”` });
    const searchTool = validTools.find(({ entry }) => /search|holding|catalog|find|lookup/i.test(`${entry!.name} ${text(entry!.description)}`));
    let search: CatalogOut["search"];
    if (!searchTool) {
      const asResource = validResources.find(({ entry }) => /search|holding|catalog/i.test(`${entry!.uri} ${entry!.name} ${text(entry!.description)}`));
      search = { ok: false, source: asResource ? manifestAt(pointer("resources", asResource.index)) : manifestAt(manifest.tools ? "/tools" : ""),
        problem: asResource ? `Claude has no tool it can call to search; ${text(asResource.entry!.uri)} is a fixed resource that cannot take “${input.search.district}”` : "Claude has no tool it can call to search live holdings" };
      push({ actor: "model", kind: "response", label: "Claude answers without searching", detail: search.problem!, source: search.source, tone: "bad" });
    } else {
      const entry = searchTool.entry!;
      const inputSchema = record(entry.inputSchema)!;
      const properties = Object.entries(record(inputSchema.properties) ?? {});
      const at = manifestAt(pointer("tools", searchTool.index, "inputSchema"));
      const args: Record<string, unknown> = {};
      const districtKey = properties.find(([key]) => /district|area|region|borough|zone|neighbo/i.test(key))?.[0];
      const queryKey = properties.find(([key]) => /query|title|^q$|text|search|term|keyword/i.test(key))?.[0];
      if (districtKey) args[districtKey] = input.search.district;
      if (queryKey) args[queryKey] = input.search.title;
      push({ actor: "model", kind: "tool_call", label: `tools/call ${entry.name} ${JSON.stringify(args)}`, source: at });
      const problems = validateSchema(inputSchema, args, "arguments");
      if (problems.length) {
        search = { ok: false, source: at, problem: `${entry.name} rejected Claude’s call: ${problems[0].replace(/^arguments\./, "")}` };
        push({ actor: "tool", kind: "tool_result", label: "isError: true", detail: problems.join("; "), source: at, tone: "bad" });
      } else {
        const districts = districtKey ? [input.search.district] : Object.keys(input.search.hits);
        const hits = districts.flatMap((district) => (input.search.hits[district] ?? []).map((branch) => `${branch} (${district})`));
        const wrong = hits.filter((hit) => !hit.endsWith(`(${input.search.district})`));
        search = !queryKey ? { ok: false, source: at, problem: `${entry.name} could not be told which title to look for, so it returned every holding in ${districts.join(", ")}` }
          : wrong.length ? { ok: false, source: at, problem: `${entry.name} could not be told the district, so Claude’s answer lists ${wrong.length} copies outside ${input.search.district}: ${wrong.slice(0, 3).join(", ")}` }
          : { ok: true, source: at, problem: null };
        push({ actor: "tool", kind: "tool_result", label: `${hits.length} holding(s)`, detail: hits.join(" · ") || "none", tone: search.ok ? "ok" : "bad" });
      }
    }

    // --- 3. Skill ---
    const skill = parseFrontmatter(skillText);
    const description = text(skill.data.description) || skill.body.split(/\n\s*\n/)[0] || "";
    const manual = skill.data["disable-model-invocation"] === true;
    const matches = input.skill.terms.some((term) => description.toLowerCase().includes(term));
    const followsFile = skill.body.includes(input.skill.checklist);
    const pasted = skill.body.split("\n").map((line) => /^\s*(?:\d+[.)]|[-*])\s+(.*)$/.exec(line)?.[1]?.trim()).filter((line): line is string => !!line);
    const steps = followsFile ? input.skill.steps : pasted;
    const missing = input.skill.steps.filter((step) => !steps.some((line) => line.toLowerCase().includes(step.toLowerCase())));
    const descriptionAt: TraceSource = { artifact: "skill", line: Math.max(1, skillText.split("\n").findIndex((line) => /^description:/.test(line)) + 1) };
    const desks = input.desks.map(({ desk, request }) => {
      push({ actor: "person", kind: "request", label: `${desk} desk · “${request}”` });
      if (manual || !matches) {
        const problem = manual ? `${input.skill.name} only runs when someone types /${input.skill.name}; nobody at the ${desk} desk did` : `Claude did not load ${input.skill.name}: its description does not say when it applies to this request`;
        push({ actor: "model", kind: "decision", label: `Simulated · ${input.skill.name} not loaded`, detail: `${problem}. Claude improvised a review from general knowledge.`, source: manual ? sources.skill : descriptionAt, tone: "bad" });
        return { desk, loaded: false, problem, source: manual ? sources.skill : descriptionAt };
      }
      push({ actor: "model", kind: "decision", label: `Simulated · loaded ${input.skill.name}${followsFile ? ` and read ${input.skill.checklist}` : ""}`,
        detail: steps.length ? steps.map((step, index) => `${index + 1}. ${step}`).join("\n") : "SKILL.md gives no steps.", source: sources.skill, tone: missing.length ? "bad" : "ok" });
      const problem = missing.length ? `the review ran ${steps.length} step(s); “${missing[0]}” from the current ${input.skill.checklist} never ran` : null;
      return { desk, loaded: true, problem, source: sources.skill };
    });
    return { trace, out: { packet: { tokens, lost, entries }, policy, search, desks, sources },
      metrics: { packetTokens: tokens, desksOnProcedure: desks.filter(({ problem }) => !problem).length } };
  },
};
