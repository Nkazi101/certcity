// Message Batches: create-time validation of the batch body, prompt-cache accounting across requests, results that
// arrive in any order with succeeded / errored / expired types, the shop's importer (join + resubmission), and a
// simulated extraction whose status follows the few-shot examples in the shared system prompt.
import { list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type ArchiveOrder = { id: string; stall: string; scan: string; vendorId: "clear" | "blank" | "smudged" };
export type FirstOutcome = "succeeded" | "overloaded" | "invalid" | "expired";

export type BatchInput = {
  orders: readonly ArchiveOrder[];
  /** Order ids in the order their results arrive. */
  arrival: readonly string[];
  outcomes: Readonly<Record<string, FirstOutcome>>;
  invalidMessage: string;
  /** Text that identifies the handbook inside the system prompt, and its size. */
  handbook: { marker: string; tokens: number };
  /** Output tokens an extraction answer needs. */
  answerTokens: number;
};

type Extraction = { vendorId: string | null; status: string; guessed: boolean };

export type BatchOut = {
  accepted: boolean;
  error?: { message: string; source: TraceSource };
  missing: readonly string[];
  unmapped: readonly { customId: string; source: TraceSource }[];
  cacheReads: readonly { customId: string; read: number; written: number }[];
  /** Where the rendered prefix of a later request first differs from the first request's. */
  prefixDiff?: { block: number; source: TraceSource };
  truncated: readonly { order: string; source: TraceSource }[];
  misassigned: readonly { from: string; to: string }[];
  duplicates: readonly string[];
  lost: readonly string[];
  failedAgain: readonly string[];
  held: readonly string[];
  extraction: { blank: Extraction; smudged: Extraction; source: TraceSource };
  sources: { join: TraceSource; resubmit: TraceSource; prompt: TraceSource; maxTokens: TraceSource };
};

type Parsed = { batch: LocatedJson; prompt: LocatedJson; plan: LocatedJson };

const files = { batch: "batch.json", prompt: "prompt.json", plan: "import-plan.json" } as const;
const customIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const minimumCacheable = 1024;

function render(value: string, order: ArchiveOrder) {
  return value.replace(/\{\{\s*order_id\s*\}\}/g, order.id).replace(/\{\{\s*stall\s*\}\}/g, order.stall);
}

function classify(scan: string): ArchiveOrder["vendorId"] {
  if (scan.includes("▒")) return "smudged";
  if (/vendor id:\s*(\(blank\)|—|-\s|·|$)/im.test(scan)) return "blank";
  return "clear";
}

/** Reads <example> blocks: a "Scan:" line and an "Output:" line naming vendor_id and status. */
function examples(system: string) {
  return [...system.matchAll(/<example>([\s\S]*?)<\/example>/g)].map(([, body]) => {
    const scan = /scan:\s*(.*)/i.exec(body)?.[1] ?? "";
    const output = /output:\s*([\s\S]*)/i.exec(body)?.[1] ?? "";
    const status = /"?status"?\s*[:=]\s*"?([A-Za-z_-]+)/i.exec(output)?.[1]?.toLowerCase() ?? "";
    const vendor = /"?vendor_id"?\s*[:=]\s*"?([A-Za-z0-9_▒-]+)/i.exec(output)?.[1] ?? "";
    return { kind: classify(scan), status, vendorId: vendor && vendor !== "null" ? vendor : null };
  }).filter(({ status }) => status);
}

/** Simulated: Claude copies the status of the closest example; with no example for a state it reuses another state's, or guesses. */
function extract(system: string, kind: "blank" | "smudged"): Extraction {
  const shots = examples(system);
  const same = shots.find((shot) => shot.kind === kind);
  const other = shots.find((shot) => shot.kind === (kind === "blank" ? "smudged" : "blank"));
  const pick = same ?? other;
  if (!pick) return { vendorId: "V-17", status: "ok", guessed: true };
  return { vendorId: pick.vendorId, status: pick.status, guessed: pick.vendorId !== null };
}

export const batchesEngine: Engine<Parsed, BatchInput, BatchOut> = {
  id: "anthropic.message-batches",
  provider: "anthropic",
  label: "Message Batches validator · cache accounting · results replay · simulated extraction",
  simulated: false,
  parse(input) {
    const parsed: Partial<Parsed> = {};
    for (const [key, name] of Object.entries(files) as [keyof Parsed, string][]) {
      const result = parseLocatedJson(input[key], name);
      if (result.error !== undefined) return { ok: false, error: result.error, source: { artifact: key } };
      parsed[key] = result.value;
    }
    return { ok: true, value: parsed as Parsed };
  },
  run({ batch, prompt, plan }, fixture: Fixture<BatchInput>): EngineRun<BatchOut> {
    const input = fixture.input;
    const at = (artifact: keyof Parsed, path: string): TraceSource => ({ artifact, pointer: path, line: lineOf({ batch, prompt, plan }[artifact], path) });
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const requests = list(record(batch.value)?.requests).map((entry) => record(entry) ?? {});
    const blocks = (Array.isArray(prompt.value) ? prompt.value : list(record(prompt.value)?.system)).map((entry) => record(entry) ?? {});
    const planObject = record(plan.value) ?? {};
    const empty: BatchOut = {
      accepted: false, missing: [], unmapped: [], cacheReads: [], truncated: [], misassigned: [], duplicates: [], lost: [], failedAgain: [], held: [],
      extraction: { blank: { vendorId: null, status: "", guessed: false }, smudged: { vendorId: null, status: "", guessed: false }, source: at("prompt", "") },
      sources: { join: at("plan", "/join_results_on"), resubmit: at("plan", "/resubmit"), prompt: at("prompt", ""), maxTokens: at("batch", "/requests/0/params/max_tokens") },
    };
    push({ actor: "learner-artifact", kind: "request", label: `POST /v1/messages/batches · ${requests.length} requests · system from prompt.json (${blocks.length} blocks)`, source: at("batch", "") });
    const reject = (message: string, source: TraceSource): EngineRun<BatchOut> => {
      push({ actor: "service", kind: "error", label: "400 invalid_request_error", detail: message, source, tone: "bad" });
      push({ actor: "person", kind: "output", label: "Nothing was queued. The archive waits another night.", tone: "bad" });
      return { trace, out: { ...empty, error: { message, source } }, metrics: { cacheRead: 0 } };
    };

    // --- create-time validation ---
    if (!requests.length) return reject("requests: List should have at least 1 item", at("batch", "/requests"));
    const breakpoints = blocks.filter((block) => block.cache_control !== undefined);
    if (breakpoints.length > 4) return reject("A maximum of 4 blocks with cache_control may be provided.", at("prompt", ""));
    for (const [index, block] of blocks.entries()) {
      if (block.type !== "text" || typeof block.text !== "string") return reject(`system.${index}: each system block needs "type": "text" and a "text" string`, at("prompt", pointer(index)));
      const cache = record(block.cache_control);
      if (block.cache_control !== undefined && cache?.type !== "ephemeral") return reject(`system.${index}.cache_control.type: Input should be 'ephemeral'`, at("prompt", pointer(index, "cache_control")));
    }
    const seenIds = new Set<string>();
    for (const [index, request] of requests.entries()) {
      const id = text(request.custom_id);
      if (!customIdPattern.test(id)) return reject(`requests.${index}.custom_id: String should match pattern '^[a-zA-Z0-9_-]{1,64}$'`, at("batch", pointer("requests", index, "custom_id")));
      if (seenIds.has(id)) return reject(`requests.${index}.custom_id: custom_id "${id}" is used more than once in this batch`, at("batch", pointer("requests", index, "custom_id")));
      seenIds.add(id);
      const params = record(request.params);
      if (!params) return reject(`requests.${index}.params: Field required`, at("batch", pointer("requests", index)));
      if (typeof params.model !== "string" || !params.model) return reject(`requests.${index}.params.model: Field required`, at("batch", pointer("requests", index, "params")));
      if (!Number.isInteger(params.max_tokens) || Number(params.max_tokens) < 1) return reject(`requests.${index}.params.max_tokens: Field required (a positive integer)`, at("batch", pointer("requests", index, "params")));
      if (!list(params.messages).length) return reject(`requests.${index}.params.messages: Field required`, at("batch", pointer("requests", index, "params")));
      if (params.stream !== undefined) return reject(`requests.${index}.params.stream: streaming is not supported for batch requests`, at("batch", pointer("requests", index, "params", "stream")));
    }
    push({ actor: "service", kind: "response", label: `200 · batch queued (${requests.length} requests)`, tone: "ok" });

    // --- which order does each request ask about? ---
    const asked = requests.map((request, index) => {
      const content = text(record(list(record(request.params)?.messages)[0])?.content) ||
        list(record(list(record(request.params)?.messages)[0])?.content).map((block) => text(record(block)?.text)).join("\n");
      const orders = input.orders.filter((order) => new RegExp(`\\b${order.id}\\b`).test(content));
      return { index, customId: text(request.custom_id), order: orders.length === 1 ? orders[0] : null, maxTokens: Number(record(request.params)?.max_tokens),
        source: at("batch", pointer("requests", index)) };
    });
    const unmapped = asked.filter(({ order }) => !order).map(({ customId, source }) => ({ customId, source }));
    const missing = input.orders.filter((order) => asked.filter((entry) => entry.order?.id === order.id).length !== 1).map(({ id }) => id);

    // --- prompt caching across the batch: the prefix runs through the last block with cache_control ---
    const lastBreakpoint = blocks.reduce((last, block, index) => block.cache_control !== undefined ? index : last, -1);
    const rendered = (order: ArchiveOrder) => blocks.map((block) => render(text(block.text), order));
    const prefixFor = (order: ArchiveOrder) => lastBreakpoint < 0 ? null : rendered(order).slice(0, lastBreakpoint + 1);
    const tokensOf = (prefix: string[]) => prefix.join("\n").includes(input.handbook.marker) ? input.handbook.tokens + Math.ceil(prefix.join("").length / 4) : Math.ceil(prefix.join("").length / 4);
    const cached = new Set<string>();
    const cacheReads = asked.filter(({ order }) => order).map(({ customId, order }) => {
      const prefix = prefixFor(order!);
      if (!prefix || tokensOf(prefix) < minimumCacheable) return { customId, read: 0, written: 0 };
      const key = JSON.stringify(prefix);
      const hit = cached.has(key);
      cached.add(key);
      return { customId, read: hit ? tokensOf(prefix) : 0, written: hit ? 0 : tokensOf(prefix) };
    });
    for (const { customId, read, written } of cacheReads) {
      push({ actor: "service", kind: "metric", label: `${customId} · usage`, detail: `cache_creation_input_tokens: ${written}\ncache_read_input_tokens: ${read}`, tone: read || written ? undefined : "warn" });
    }
    const mapped = asked.filter(({ order }) => order);
    let prefixDiff: BatchOut["prefixDiff"];
    if (mapped.length > 1) {
      const first = rendered(mapped[0].order!);
      const second = rendered(mapped[1].order!);
      const block = first.findIndex((value, index) => value !== second[index]);
      if (block >= 0 && (lastBreakpoint < 0 || block <= lastBreakpoint)) prefixDiff = { block, source: at("prompt", pointer(block)) };
    }

    // --- results arrive in any order ---
    const byOrder = new Map(mapped.map((entry) => [entry.order!.id, entry]));
    const system = (order: ArchiveOrder) => rendered(order).join("\n");
    const truncated: BatchOut["truncated"][number][] = [];
    const resultLines = input.arrival.flatMap((orderId) => {
      const entry = byOrder.get(orderId);
      if (!entry) return [];
      const outcome = input.outcomes[orderId];
      const short = outcome === "succeeded" && entry.maxTokens < input.answerTokens;
      if (short) truncated.push({ order: orderId, source: at("batch", pointer("requests", entry.index, "params", "max_tokens")) });
      const result = outcome === "succeeded" ? { type: "succeeded", message: { stop_reason: short ? "max_tokens" : "end_turn" } }
        : outcome === "expired" ? { type: "expired" }
          : { type: "errored", error: { type: outcome === "overloaded" ? "overloaded_error" : "invalid_request_error", message: outcome === "overloaded" ? "Overloaded" : input.invalidMessage } };
      push({ actor: "service", kind: "tool_result", label: `results.jsonl · ${entry.customId}`, detail: JSON.stringify({ custom_id: entry.customId, result }),
        tone: outcome === "succeeded" && !short ? undefined : "warn" });
      return [{ ...entry, outcome }];
    });

    // --- the importer: one archive row per succeeded result, joined as import-plan.json says ---
    const join = text(planObject.join_results_on);
    const resubmit = list(planObject.resubmit).map(text);
    const misassigned: BatchOut["misassigned"][number][] = [];
    const imported = new Map<string, number>();
    resultLines.forEach((line, position) => {
      if (line.outcome !== "succeeded") return;
      const target = join === "custom_id" ? line.order! : join === "position" ? asked[position]?.order ?? null : null;
      if (!target) {
        push({ actor: "service", kind: "decision", label: `Importer · ${line.customId}: no row to write`, detail: `join_results_on is ${JSON.stringify(planObject.join_results_on ?? null)}; the importer supports "custom_id" and "position".`, source: at("plan", "/join_results_on"), tone: "bad" });
        misassigned.push({ from: line.order!.id, to: "(nowhere)" });
        return;
      }
      if (target.id !== line.order!.id) misassigned.push({ from: line.order!.id, to: target.id });
      imported.set(line.order!.id, (imported.get(line.order!.id) ?? 0) + 1);
      push({ actor: "service", kind: "output", label: `Archive row ${target.id} ← extraction of ${line.order!.id}`, source: at("plan", "/join_results_on"), tone: target.id === line.order!.id ? "ok" : "bad" });
    });

    // --- resubmission: a second batch with the listed custom_ids, rebuilt from batch.json ---
    const failedAgain: string[] = [];
    const duplicates: string[] = [];
    for (const id of resubmit) {
      const entry = mapped.find(({ customId }) => customId === id);
      if (!entry) {
        push({ actor: "service", kind: "decision", label: `Resubmit · ${id || "(empty)"} matches no request in batch.json`, source: at("plan", "/resubmit"), tone: "warn" });
        continue;
      }
      const first = input.outcomes[entry.order!.id];
      const again = first === "invalid" ? "errored (invalid_request_error)" : "succeeded";
      push({ actor: "service", kind: "tool_result", label: `Resubmitted · ${id}`, detail: first === "invalid" ? `${again}: ${input.invalidMessage}` : again, source: at("plan", "/resubmit"),
        tone: first === "invalid" || first === "succeeded" ? "bad" : "ok" });
      if (first === "invalid") failedAgain.push(entry.order!.id);
      else {
        if (first === "succeeded") duplicates.push(entry.order!.id);
        imported.set(entry.order!.id, (imported.get(entry.order!.id) ?? 0) + 1);
      }
    }
    const lost = input.orders.filter(({ id }) => (input.outcomes[id] === "overloaded" || input.outcomes[id] === "expired") && !imported.get(id)).map(({ id }) => id);
    const held = input.orders.filter(({ id }) => input.outcomes[id] === "invalid" && !failedAgain.includes(id)).map(({ id }) => id);
    for (const id of held) push({ actor: "person", kind: "output", label: `${id} held for staff: the request itself was rejected`, tone: "ok" });
    for (const id of lost) push({ actor: "person", kind: "output", label: `${id} never reached the archive`, tone: "bad" });
    for (const id of duplicates) push({ actor: "person", kind: "output", label: `${id} imported twice`, tone: "bad" });

    // --- simulated extraction from the shared system prompt's examples ---
    const sampleOrder = input.orders[0];
    const extraction = { blank: extract(system(sampleOrder), "blank"), smudged: extract(system(sampleOrder), "smudged"),
      source: at("prompt", pointer(Math.max(0, blocks.findIndex((block) => /<example>/.test(text(block.text)))))) };
    for (const order of input.orders.filter(({ vendorId, id }) => vendorId !== "clear" && input.outcomes[id] === "succeeded")) {
      const result = extraction[order.vendorId as "blank" | "smudged"];
      push({ actor: "model", kind: "response", label: `Simulated extraction · ${order.id} (${order.vendorId === "smudged" ? "vendor ID present but smudged" : "vendor ID left blank"})`,
        detail: JSON.stringify({ vendor_id: result.vendorId, status: result.status }), source: extraction.source,
        tone: result.guessed || extraction.blank.status === extraction.smudged.status ? "warn" : undefined });
    }
    const cacheRead = cacheReads.reduce((total, { read }) => total + read, 0);
    return {
      trace,
      out: { ...empty, accepted: true, missing, unmapped, cacheReads, prefixDiff, truncated, misassigned, duplicates, lost, failedAgain, held, extraction },
      metrics: { cacheRead, imported: [...imported.values()].reduce((total, count) => total + count, 0) },
    };
  },
};
