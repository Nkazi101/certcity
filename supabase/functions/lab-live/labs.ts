// Server-side request builders for live lab runs. Each lab on the allowlist turns the learner's files plus one of the
// lab's own fixtures into Messages API calls. The client sends only a lab id, a fixture id and artifact text: it never
// picks the model, the token ceiling, the tools' definitions or any framing text, and nothing outside these builders
// reaches the API.
//
// The fixture text below is a server-side copy of the case files in lib/labs/claude/*.ts (Edge Functions cannot import
// the Next.js app). When a lab's fixtures change there, update the matching entry here.
import type Anthropic from "@anthropic-ai/sdk";
import { LIVE_MODEL, MAX_OUTPUT_TOKENS } from "./config.ts";

export type LiveCall = {
  /** Shown above the reply, e.g. "A-102 · vendor ID left blank". */
  label: string;
  system?: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  toolChoice?: Anthropic.ToolChoice;
  maxTokens: number;
};
export type LiveBuild = { ok: true; calls: LiveCall[]; notes: string[] } | { ok: false; error: string };
export type LiveLab = {
  /** Artifact ids the lab accepts, with their size limit. Any other file is refused. */
  artifacts: Readonly<Record<string, { path: string; maxChars: number; required: boolean }>>;
  fixtures: readonly string[];
  /** Throws Invalid with a learner-facing message. Adds what the live run changes or leaves out to notes. */
  build(files: Readonly<Record<string, string>>, fixtureId: string, notes: string[]): LiveCall[];
};

type Obj = Record<string, unknown>;
class Invalid extends Error {}
const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
function fail(message: string): never {
  throw new Invalid(message);
}

function parseJson(text: string, name: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fail(`${name} is not valid JSON, so it could not be sent. Run the checks to find the problem.`);
  }
}

function onlyKeys(value: Obj, allowed: readonly string[], at: string) {
  const extra = Object.keys(value).find((key) => !allowed.includes(key));
  if (extra) fail(`${at} has a field live runs do not send: "${extra}".`);
}

function nonEmpty(value: unknown, at: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${at} must be non-empty text.`);
  return value;
}

/** The learner's own max_tokens is part of several lessons, so it is honoured up to the live ceiling. */
function budget(value: unknown, at: string, notes: string[]) {
  if (value === undefined) return MAX_OUTPUT_TOKENS;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) fail(`${at} max_tokens must be a whole number of at least 1.`);
  if (value > MAX_OUTPUT_TOKENS) {
    notes.push(`max_tokens is capped at ${MAX_OUTPUT_TOKENS} in live runs.`);
    return MAX_OUTPUT_TOKENS;
  }
  return value;
}

const asMessage = (role: "user" | "assistant", content: string | Anthropic.ContentBlockParam[]) =>
  ({ role, content }) as Anthropic.MessageParam;

// ---------------------------------------------------------------------------------------------------------------
// permit-agent: the learner's request.json (messages, which tools to offer, tool_choice, max_tokens) is sent as the
// next Messages request. Tool definitions come from the counter application below, never from the file.

const permitTool = (name: string, description: string, params: readonly string[]): Anthropic.Tool => ({
  name, description,
  input_schema: { type: "object", properties: Object.fromEntries(params.map((key) => [key, { type: "string" }])), required: [...params] },
});
const permitCatalog: Readonly<Record<string, Anthropic.Tool>> = {
  address_lookup: permitTool("address_lookup", "Verify a permit address against the parcel register.", ["case_id", "address"]),
  eligibility_lookup: permitTool("eligibility_lookup", "Check zoning eligibility for a permit case.", ["case_id"]),
  fee_estimate: permitTool("fee_estimate", "Estimate the permit fee for a case.", ["case_id", "permit_type"]),
  send_acknowledgment: permitTool("send_acknowledgment", "Send the applicant an acknowledgment that intake is complete.", ["case_id"]),
};
const permitCases: Readonly<Record<string, string>> = { p42: "P-42", p57: "P-57", p61: "P-61" };

function permitBlock(value: unknown, at: string): Anthropic.ContentBlockParam {
  if (!isObj(value)) fail(`${at} must be an object.`);
  switch (value.type) {
    case "text":
      onlyKeys(value, ["type", "text"], at);
      return { type: "text", text: nonEmpty(value.text, `${at}.text`) };
    case "tool_use": {
      onlyKeys(value, ["type", "id", "name", "input"], at);
      if (!isObj(value.input)) fail(`${at}.input must be an object.`);
      return { type: "tool_use", id: nonEmpty(value.id, `${at}.id`), name: nonEmpty(value.name, `${at}.name`), input: value.input };
    }
    case "tool_result": {
      onlyKeys(value, ["type", "tool_use_id", "content", "is_error"], at);
      if (value.is_error !== undefined && typeof value.is_error !== "boolean") fail(`${at}.is_error must be true or false.`);
      let content: Anthropic.ToolResultBlockParam["content"];
      if (typeof value.content === "string" || value.content === undefined) content = value.content;
      else if (Array.isArray(value.content)) {
        content = value.content.map((part, index) => {
          if (!isObj(part) || part.type !== "text") fail(`${at}.content[${index}] must be a text block.`);
          onlyKeys(part, ["type", "text"], `${at}.content[${index}]`);
          return { type: "text" as const, text: nonEmpty(part.text, `${at}.content[${index}].text`) };
        });
      } else fail(`${at}.content must be text or an array of text blocks.`);
      return {
        type: "tool_result", tool_use_id: nonEmpty(value.tool_use_id, `${at}.tool_use_id`),
        ...(content !== undefined && { content }), ...(value.is_error !== undefined && { is_error: value.is_error }),
      };
    }
    default:
      return fail(`${at}: live runs send text, tool_use and tool_result blocks only.`);
  }
}

function permitMessages(value: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(value) || value.length === 0) fail("request.json needs a non-empty messages array.");
  if (value.length > 12) fail("Live runs send at most 12 messages.");
  let blocks = 0;
  return value.map((entry, index) => {
    const at = `messages[${index}]`;
    if (!isObj(entry)) fail(`${at} must be an object.`);
    onlyKeys(entry, ["role", "content"], at);
    if (entry.role !== "user" && entry.role !== "assistant") fail(`${at}.role must be "user" or "assistant".`);
    if (typeof entry.content === "string") return asMessage(entry.role, nonEmpty(entry.content, `${at}.content`));
    if (!Array.isArray(entry.content) || entry.content.length === 0) fail(`${at}.content must be text or a non-empty array of blocks.`);
    blocks += entry.content.length;
    if (blocks > 40) fail("Live runs send at most 40 content blocks.");
    return asMessage(entry.role, entry.content.map((block, position) => permitBlock(block, `${at}.content[${position}]`)));
  });
}

function permitTools(value: unknown): Anthropic.Tool[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail("tools must be an array.");
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const name = isObj(entry) && typeof entry.name === "string" ? entry.name : fail(`tools[${index}] needs a name.`);
    if (!Object.hasOwn(permitCatalog, name)) fail(`tools[${index}]: live runs offer only the counter application’s tools (${Object.keys(permitCatalog).join(", ")}).`);
    if (seen.has(name)) fail(`tools[${index}]: ${name} is offered twice.`);
    seen.add(name);
    return permitCatalog[name];
  });
}

function permitToolChoice(value: unknown, tools: readonly Anthropic.Tool[] | undefined): Anthropic.ToolChoice | undefined {
  if (value === undefined) return undefined;
  if (!isObj(value)) fail("tool_choice must be an object.");
  onlyKeys(value, ["type", "name", "disable_parallel_tool_use"], "tool_choice");
  const parallel = value.disable_parallel_tool_use;
  if (parallel !== undefined && typeof parallel !== "boolean") fail("tool_choice.disable_parallel_tool_use must be true or false.");
  const extra = parallel === undefined ? {} : { disable_parallel_tool_use: parallel };
  switch (value.type) {
    case "auto": return { type: "auto", ...extra };
    case "any": return { type: "any", ...extra };
    case "none": return { type: "none" };
    case "tool": {
      const name = nonEmpty(value.name, "tool_choice.name");
      if (!tools?.some((tool) => tool.name === name)) fail(`tool_choice names ${name}, which the request does not offer.`);
      return { type: "tool", name, ...extra };
    }
    default: return fail("tool_choice.type must be auto, any, tool or none.");
  }
}

const permitAgent: LiveLab = {
  artifacts: { request: { path: "request.json", maxChars: 16_000, required: true } },
  fixtures: Object.keys(permitCases),
  build(files, fixtureId, notes) {
    const body = parseJson(files.request, "request.json");
    if (!isObj(body)) fail("request.json must be one JSON object: the body of POST /v1/messages.");
    notes.push("Tools are sent with the counter application’s definitions; your file decides which ones are offered. Tool calls in the reply are shown, not run.");
    if (typeof body.model === "string" && body.model !== LIVE_MODEL) notes.push(`Your file names ${body.model}; live runs use ${LIVE_MODEL}.`);
    const skipped = Object.keys(body).filter((key) => !["model", "max_tokens", "messages", "tools", "tool_choice"].includes(key));
    if (skipped.length) notes.push(`Not sent in live runs: ${skipped.join(", ")}.`);
    const maxTokens = budget(body.max_tokens, "request.json", notes);
    const tools = permitTools(body.tools);
    return [{
      label: `${permitCases[fixtureId]} · Claude’s next turn`,
      messages: permitMessages(body.messages), tools, toolChoice: permitToolChoice(body.tool_choice, tools), maxTokens,
    }];
  },
};

// ---------------------------------------------------------------------------------------------------------------
// vendor-batch-api: prompt.json is the system prompt for two orders from the chosen night, the blank-ID scan and the
// smudged-ID scan, sent as ordinary Messages calls (a real batch can take hours). max_tokens comes from batch.json.

type ArchiveOrder = { id: string; stall: string; scan: string; vendorId: "clear" | "blank" | "smudged" };
const nights: Readonly<Record<string, readonly ArchiveOrder[]>> = {
  "night-1": [
    { id: "A-101", stall: "Dock Greens", scan: "Vendor ID: V-17 · 3 crates tomatoes · $42.00", vendorId: "clear" },
    { id: "A-102", stall: "Hill Dairy", scan: "Vendor ID: (blank) · 6 tubs yogurt · $27.00", vendorId: "blank" },
    { id: "A-103", stall: "Orchard Row", scan: "Vendor ID: V-▒4 · 2 boxes peaches · $31.00", vendorId: "smudged" },
  ],
  "night-2": [
    { id: "A-211", stall: "Bread Lab", scan: "Vendor ID: V-08 · 40 loaves · $96.00", vendorId: "clear" },
    { id: "A-212", stall: "Kettle & Co", scan: "Vendor ID: V-▒▒ · 12 jars soup · $54.00", vendorId: "smudged" },
    { id: "A-213", stall: "Fen Farms", scan: "Vendor ID: V-22 · 9 trays eggs · $63.00", vendorId: "clear" },
    { id: "A-214", stall: "Pier Fish", scan: "Vendor ID: V-31 · attached photo, 7.8 MB · $120.00", vendorId: "clear" },
    { id: "A-215", stall: "Mill Flour", scan: "Vendor ID: (blank) · 4 sacks rye · $38.00", vendorId: "blank" },
  ],
  "night-3": [
    { id: "A-321", stall: "Root Cellar", scan: "Vendor ID: (blank) · 5 sacks potatoes · $35.00", vendorId: "blank" },
    { id: "A-322", stall: "Bee Hive", scan: "Vendor ID: V-44 · attached photo, 9.1 MB · $88.00", vendorId: "clear" },
    { id: "A-323", stall: "Glass House", scan: "Vendor ID: V-▒9 · 8 flats herbs · $48.00", vendorId: "smudged" },
    { id: "A-324", stall: "Salt Works", scan: "Vendor ID: V-12 · 20 tins · $70.00", vendorId: "clear" },
  ],
};

function systemBlocks(text: string): Anthropic.TextBlockParam[] {
  const value = parseJson(text, "prompt.json");
  const list = Array.isArray(value) ? value : isObj(value) && Array.isArray(value.system) ? value.system
    : fail("prompt.json must be an array of system text blocks.");
  if (list.length === 0 || list.length > 8) fail("prompt.json needs between 1 and 8 text blocks.");
  let breakpoints = 0;
  return list.map((block: unknown, index: number): Anthropic.TextBlockParam => {
    const at = `prompt.json block ${index + 1}`;
    if (!isObj(block) || block.type !== "text") fail(`${at} must be { "type": "text", "text": "…" }.`);
    onlyKeys(block, ["type", "text", "cache_control"], at);
    const content = nonEmpty(block.text, `${at} text`);
    if (block.cache_control === undefined) return { type: "text", text: content };
    const cache = block.cache_control;
    if (!isObj(cache) || cache.type !== "ephemeral") fail(`${at}: cache_control must be { "type": "ephemeral" }.`);
    onlyKeys(cache, ["type", "ttl"], `${at} cache_control`);
    if (cache.ttl !== undefined && cache.ttl !== "5m" && cache.ttl !== "1h") fail(`${at}: cache_control.ttl must be "5m" or "1h".`);
    if (++breakpoints > 4) fail("prompt.json has more than 4 cache breakpoints.");
    return { type: "text", text: content, cache_control: cache.ttl ? { type: "ephemeral", ttl: cache.ttl } : { type: "ephemeral" } };
  });
}

const fill = (text: string, order: ArchiveOrder) =>
  text.replace(/\{\{\s*order_id\s*\}\}/g, order.id).replace(/\{\{\s*stall\s*\}\}/g, order.stall);

function batchMaxTokens(text: string | undefined, order: ArchiveOrder, notes: string[]) {
  if (!text?.trim()) return MAX_OUTPUT_TOKENS;
  let batch: unknown;
  try {
    batch = JSON.parse(text);
  } catch {
    notes.push(`batch.json is not valid JSON, so max_tokens is ${MAX_OUTPUT_TOKENS}.`);
    return MAX_OUTPUT_TOKENS;
  }
  const requests = isObj(batch) && Array.isArray(batch.requests) ? batch.requests.filter(isObj) : [];
  const mine = requests.find((entry) => (typeof entry.custom_id === "string" && entry.custom_id.includes(order.id))
    || JSON.stringify(entry.params ?? null).includes(order.id)) ?? requests[0];
  const value = isObj(mine?.params) ? mine.params.max_tokens : undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    notes.push(`No usable max_tokens in batch.json for ${order.id}, so live runs use ${MAX_OUTPUT_TOKENS}.`);
    return MAX_OUTPUT_TOKENS;
  }
  return budget(value, "batch.json", notes);
}

const vendorBatch: LiveLab = {
  artifacts: { prompt: { path: "prompt.json", maxChars: 12_000, required: true }, batch: { path: "batch.json", maxChars: 16_000, required: false } },
  fixtures: Object.keys(nights),
  build(files, fixtureId, notes) {
    const blocks = systemBlocks(files.prompt);
    notes.push(
      "Sends prompt.json as the system prompt with two of this night’s scans (the blank and the smudged vendor ID), as ordinary Messages calls rather than a batch.",
      "The handbook is shortened in this lab, below the minimum cacheable length, so live usage shows no cache reads. The simulator’s cache numbers model the full handbook.",
    );
    return (["blank", "smudged"] as const).map((kind) => {
      const order = nights[fixtureId].find((entry) => entry.vendorId === kind)!;
      return {
        label: `${order.id} · vendor ID ${kind === "blank" ? "left blank" : "smudged"}`,
        system: blocks.map((block) => ({ ...block, text: fill(block.text, order) })),
        messages: [asMessage("user", `Archive order ${order.id} · Stall: ${order.stall}\nScan: ${order.scan}`)],
        maxTokens: batchMaxTokens(files.batch, order, notes),
      };
    });
  },
};

// ---------------------------------------------------------------------------------------------------------------
// printworks-ci: the learner's review criteria (and findings schema, as text) go to a fresh reviewer together with
// the chosen release's spec, proof measurements, interface contract and changed code. The CLI flags, session handling
// and prior findings in ci/review.sh are judged by the simulator only.

type Release = {
  component: string; spec: string; marginMm: number; proofs: readonly { id: string; offsetMm: number }[];
  contract: string; changes: readonly { component: string; file: string; code: string }[];
};
const releases: Readonly<Record<string, Release>> = {
  poster: {
    component: "poster", spec: "specs/poster.md", marginMm: 4, proofs: [{ id: "P-1", offsetMm: 1 }, { id: "P-2", offsetMm: 3 }],
    contract: "Every order has a \"reference\" field (string). Every renderer and the order formatter read it as order.reference.",
    changes: [
      { component: "label-renderer", file: "src/label-renderer.ts", code: "renderOrder(order.ref)" },
      { component: "order-formatter", file: "src/order-formatter.ts", code: "formatOrder({ reference: order.reference })" },
    ],
  },
  sticker: {
    component: "sticker sheet", spec: "specs/sticker-sheet.md", marginMm: 3, proofs: [{ id: "S-1", offsetMm: 1.2 }, { id: "S-2", offsetMm: 1.8 }],
    contract: "Every order has a \"quantity\" field (integer). Every renderer and the order formatter read it as order.quantity.",
    changes: [
      { component: "sticker-renderer", file: "src/sticker-renderer.ts", code: "renderSheet({ count: order.qty })" },
      { component: "order-formatter", file: "src/order-formatter.ts", code: "formatOrder({ quantity: order.quantity })" },
    ],
  },
  banner: {
    component: "street banner", spec: "specs/street-banner.md", marginMm: 10, proofs: [{ id: "B-1", offsetMm: 4 }, { id: "B-2", offsetMm: 6 }],
    contract: "Every order has a \"size_mm\" field (integer, millimetres). Every renderer and the order formatter read it as order.size_mm.",
    changes: [
      { component: "banner-renderer", file: "src/banner-renderer.ts", code: "renderBanner({ width: order.size_cm })" },
      { component: "order-formatter", file: "src/order-formatter.ts", code: "formatOrder({ size_mm: order.size_mm })" },
    ],
  },
};

function reviewSchema(text: string | undefined) {
  if (!text?.trim()) return null;
  try {
    const value = JSON.parse(text);
    return isObj(value) ? JSON.stringify(value) : null;
  } catch {
    return null;
  }
}

const printworksCi: LiveLab = {
  artifacts: { criteria: { path: "ci/criteria.md", maxChars: 8_000, required: true }, schema: { path: "ci/review-schema.json", maxChars: 6_000, required: false } },
  fixtures: Object.keys(releases),
  build(files, fixtureId, notes) {
    const criteria = nonEmpty(files.criteria, "ci/criteria.md");
    const release = releases[fixtureId];
    const schema = reviewSchema(files.schema);
    notes.push("Sends your criteria and schema to a fresh reviewer with this release’s spec, proofs, contract and changed code. The command’s flags, session and prior findings are checked by the simulator only.");
    if (files.schema?.trim() && !schema) notes.push("ci/review-schema.json is not a JSON object, so no schema was sent.");
    const request = [
      `Release under review: ${release.component}`,
      `<file path="${release.spec}">\nType-to-trim margin: ${release.marginMm} mm.\n</file>`,
      `<file path="proofs/measurements.txt">\n${release.proofs.map(({ id, offsetMm }) => `${id}: plate drift ${offsetMm} mm`).join("\n")}\n</file>`,
      `<file path="docs/order-contract.md">\n${release.contract}\n</file>`,
      `<changed_code>\n${release.changes.map(({ component, file, code }) => `${component} (${file}): ${code}`).join("\n")}\n</changed_code>`,
      schema ? `Review this commit's proof changes and changed components. Reply with JSON only, matching this JSON Schema (ci/review-schema.json):\n${schema}`
        : "Review this commit's proof changes and changed components, and report your findings.",
    ].join("\n\n");
    return [{
      label: `${release.component} release · review`,
      system: [
        { type: "text", text: "You are the proof reviewer in Printworks’ CI release step. You did not write this change. Judge it only against the review criteria below and the files in the request." },
        { type: "text", text: `<review_criteria path="ci/criteria.md">\n${criteria}\n</review_criteria>` },
      ],
      messages: [asMessage("user", request)],
      maxTokens: MAX_OUTPUT_TOKENS,
    }];
  },
};

export const liveLabs: Readonly<Record<string, LiveLab>> = {
  "permit-agent": permitAgent,
  "vendor-batch-api": vendorBatch,
  "printworks-ci": printworksCi,
};

/** Validates the learner's files against the lab and builds its calls. Never throws. */
export function buildLiveRun(lab: LiveLab, files: Readonly<Record<string, string>>, fixtureId: string): LiveBuild {
  try {
    for (const [id, { path, required }] of Object.entries(lab.artifacts)) {
      if (required && !files[id]?.trim()) fail(`Write ${path} before trying it with real Claude.`);
    }
    const notes: string[] = [];
    const calls = lab.build(files, fixtureId, notes);
    return { ok: true, calls, notes: [...new Set(notes)] };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}
