// Developer Foundations · vendor-batch-api. The learner writes tonight's Message Batches body (batch.json), the shared
// system prompt every request uses (prompt.json, with its cache breakpoint and few-shot examples), and the import plan
// (how results join to archive rows and which custom_ids to resubmit). Transfer (revise): a new night's archive with
// results in a different order, an expired request and an invalid one.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { batchesEngine } from "../engines/batches";
import type { ArchiveOrder, BatchInput, BatchOut, FirstOutcome } from "../engines/batches";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const handbookMarker = "VENDOR HANDBOOK v12";
const handbook = `${handbookMarker} (about 9,000 tokens; shortened in this lab). Extract the vendor ID, the order lines and the order total from one scanned archive invoice. Reply with JSON only: vendor_id (string or null), status, total_cents (integer).`;
const blankExample = "<example>\nScan: Vendor ID: (blank) · 2 crates basil · $18.00\nOutput: {\"vendor_id\": null, \"status\": \"missing\", \"total_cents\": 1800}\n</example>";
const smudgedExample = "<example>\nScan: Vendor ID: V-▒▒ · 1 case lemons · $24.50\nOutput: {\"vendor_id\": null, \"status\": \"unreadable\", \"total_cents\": 2450}\n</example>";

type Night = { id: string; orders: readonly ArchiveOrder[]; arrival: readonly string[]; outcomes: Readonly<Record<string, FirstOutcome>> };

const sampleNight: Night = {
  id: "sample",
  orders: [
    { id: "A-101", stall: "Dock Greens", scan: "Vendor ID: V-17 · 3 crates tomatoes · $42.00", vendorId: "clear" },
    { id: "A-102", stall: "Hill Dairy", scan: "Vendor ID: (blank) · 6 tubs yogurt · $27.00", vendorId: "blank" },
    { id: "A-103", stall: "Orchard Row", scan: "Vendor ID: V-▒4 · 2 boxes peaches · $31.00", vendorId: "smudged" },
  ],
  arrival: ["A-103", "A-101", "A-102"],
  outcomes: { "A-101": "overloaded", "A-102": "succeeded", "A-103": "succeeded" },
};
const expiredNight: Night = {
  id: "expired",
  orders: [
    { id: "A-211", stall: "Bread Lab", scan: "Vendor ID: V-08 · 40 loaves · $96.00", vendorId: "clear" },
    { id: "A-212", stall: "Kettle & Co", scan: "Vendor ID: V-▒▒ · 12 jars soup · $54.00", vendorId: "smudged" },
    { id: "A-213", stall: "Fen Farms", scan: "Vendor ID: V-22 · 9 trays eggs · $63.00", vendorId: "clear" },
    { id: "A-214", stall: "Pier Fish", scan: "Vendor ID: V-31 · attached photo, 7.8 MB · $120.00", vendorId: "clear" },
    { id: "A-215", stall: "Mill Flour", scan: "Vendor ID: (blank) · 4 sacks rye · $38.00", vendorId: "blank" },
  ],
  arrival: ["A-215", "A-213", "A-211", "A-214", "A-212"],
  outcomes: { "A-211": "succeeded", "A-212": "succeeded", "A-213": "expired", "A-214": "invalid", "A-215": "succeeded" },
};
const overloadNight: Night = {
  id: "overload",
  orders: [
    { id: "A-321", stall: "Root Cellar", scan: "Vendor ID: (blank) · 5 sacks potatoes · $35.00", vendorId: "blank" },
    { id: "A-322", stall: "Bee Hive", scan: "Vendor ID: V-44 · attached photo, 9.1 MB · $88.00", vendorId: "clear" },
    { id: "A-323", stall: "Glass House", scan: "Vendor ID: V-▒9 · 8 flats herbs · $48.00", vendorId: "smudged" },
    { id: "A-324", stall: "Salt Works", scan: "Vendor ID: V-12 · 20 tins · $70.00", vendorId: "clear" },
  ],
  arrival: ["A-324", "A-322", "A-321", "A-323"],
  outcomes: { "A-321": "expired", "A-322": "invalid", "A-323": "succeeded", "A-324": "overloaded" },
};

const invalidMessage = "messages.0.content.1.source: image exceeds 5 MB maximum";
const input = (night: Night): BatchInput => ({
  orders: night.orders, arrival: night.arrival, outcomes: night.outcomes, invalidMessage,
  handbook: { marker: handbookMarker, tokens: 9000 }, answerTokens: 190,
});

const message = (order: ArchiveOrder) => `Archive order ${order.id} · Stall: ${order.stall}\nScan: ${order.scan}`;
function batchFile(night: Night, { ids = (order: ArchiveOrder) => `order-${order.id}`, maxTokens = 1024, stream = false } = {}) {
  return compactJson({ requests: night.orders.map((order) => ({ custom_id: ids(order),
    params: { model: "claude-opus-5-5", max_tokens: maxTokens, ...(stream && { stream: true }), messages: [{ role: "user", content: message(order) }] } })) });
}
const promptFile = (blocks: readonly Record<string, unknown>[]) => compactJson(blocks);
const referencePrompt = promptFile([{ type: "text", text: handbook }, { type: "text", text: `${blankExample}\n${smudgedExample}`, cache_control: { type: "ephemeral" } }]);
const retryable = (night: Night) => night.orders.filter(({ id }) => night.outcomes[id] === "overloaded" || night.outcomes[id] === "expired").map(({ id }) => `order-${id}`);
const planFile = (join: string, resubmit: readonly string[]) => compactJson({ join_results_on: join, resubmit });
const referenceFor = (night: Night): LabFiles => ({ batch: batchFile(night), prompt: referencePrompt, plan: planFile("custom_id", retryable(night)) });

// Deployed: positional custom_ids, a tiny max_tokens, the stall name ahead of the handbook inside the cached block,
// one blank-ID example, a positional join and "resubmit everything".
const starter: LabFiles = {
  batch: batchFile(sampleNight, { ids: (order) => String(sampleNight.orders.indexOf(order) + 1), maxTokens: 64 }),
  prompt: promptFile([{ type: "text", text: `Stall: {{stall}} (order {{order_id}}).\n${handbook}\n${blankExample}`, cache_control: { type: "ephemeral" } }]),
  plan: planFile("position", ["1", "2", "3"]),
};

function nightDocuments(night: Night, intro: string): LabDocument[] {
  const label = { succeeded: "succeeded", overloaded: "errored · overloaded_error", invalid: `errored · invalid_request_error (${invalidMessage})`, expired: "expired" } as const;
  return [
    { id: `${night.id}-orders`, title: "Tonight’s archive orders", format: "code", text: night.orders.map((order) => `${order.id} · ${order.stall}\n   ${order.scan}`).join("\n") },
    { id: `${night.id}-outcomes`, title: "Provider outcome per order (results arrive in this order)", format: "code",
      text: `${intro}\n` + night.arrival.map((id, index) => `${index + 1}. ${id} → ${label[night.outcomes[id]]}`).join("\n") },
  ];
}
const shopNotes: LabDocument[] = [
  { id: "submit", title: "submit-batch.ts · how your files are used", text: "Sends batch.json to POST /v1/messages/batches with prompt.json as params.system on every request. In prompt.json, {{order_id}} and {{stall}} are filled in per request. Each extraction answer needs about 150–190 output tokens." },
  { id: "importer", title: "import-results.ts · import-plan.json fields", text: "join_results_on: \"custom_id\" (match each result to the request that carried the same custom_id) or \"position\" (the n-th result line goes to the n-th request). The importer inserts one archive row per succeeded result. resubmit: custom_ids from batch.json to send again tomorrow night, rebuilt from batch.json." },
  { id: "scans", title: "Reading the scans", text: "▒ marks ink the scanner could not read: the vendor wrote an ID, but some characters are illegible. “(blank)” means the vendor ID box was left empty. Staff follow up differently: an illegible ID is matched against the stall register, a missing one is phoned in." },
];

const fixtures: Fixture<BatchInput>[] = [
  { id: "night-1", name: "Tonight’s archive · 3 orders", set: "sample", situation: "Results come back out of order; one request hits an overloaded error.", input: input(sampleNight) },
  { id: "night-2", name: "Next night · 5 orders", set: "transfer", variant: "expired", situation: "A different night: one request expires and one is rejected.", input: input(expiredNight) },
  { id: "night-3", name: "Next night · 4 orders", set: "transfer", variant: "overload", situation: "A different night: an overload, an expiry and a rejected request.", input: input(overloadNight) },
];

type C = Check<BatchInput, BatchOut>;
const list = (values: readonly string[]) => values.join(", ");
const was = (values: readonly string[]) => values.length === 1 ? "was" : "were";

const checks: C[] = [
  {
    id: "batch-accepted", objective: "2.3", title: "The batch is accepted with one request per archive order",
    diagnosis: "A Message Batches body is { requests: [{ custom_id, params }] }. custom_id must match ^[a-zA-Z0-9_-]{1,64}$ and be unique in the batch; params holds a normal Messages request, except that batch requests cannot stream. Every record needs exactly one request that asks about it.",
    hints: hints("Read the 400 message or the list of orders in the trace: which request or which order does it point at?",
      "Batch mechanics: each entry pairs your own custom_id with the Messages API params for one independent job. The API validates the ids (allowed characters, uniqueness) and the params when the batch is created; streaming does not exist for asynchronous batch work.",
      "A print shop’s overnight queue takes one job ticket per file, each with a ticket number made of letters, digits, dashes and underscores. Two tickets with the same number, or a ticket asking for live preview, bounce the whole queue."),
    reveal: "{ \"custom_id\": \"order-A-101\", \"params\": { \"model\": \"claude-opus-5-5\", \"max_tokens\": 1024, \"messages\": [ … ] } } — one per order, ids from letters, digits, - and _.",
    evaluate: ({ out }) => {
      if (!out.accepted) return { passed: false, symptom: `The batch was rejected: ${out.error!.message}`, source: out.error!.source };
      if (out.unmapped.length) return { passed: false, symptom: `Request ${out.unmapped[0].customId} asks about no single archive order, so its result has no row.`, source: out.unmapped[0].source };
      if (out.missing.length) return { passed: false, symptom: `Archive order ${list(out.missing)} ${was(out.missing)} not submitted exactly once tonight.`, source: { artifact: "batch", line: 1 } };
      return { passed: true, symptom: "The batch was queued with one request per order." };
    },
  },
  {
    id: "outputs-complete", objective: "2.3", title: "Every succeeded result holds a complete answer",
    diagnosis: "A succeeded batch result can still be cut off: if the answer needs more tokens than max_tokens allows, the message ends with stop_reason \"max_tokens\" and the JSON is incomplete. Size max_tokens for the longest expected answer.",
    hints: hints("Open a succeeded line in results.jsonl and read its stop_reason. Then compare the answer size in submit-batch.ts with what each request allows.",
      "stop_reason tells you why generation ended. end_turn means Claude finished; max_tokens means it hit your cap mid-answer. max_tokens is a ceiling, not a target, so give room for the full JSON.",
      "A receipt printer set to 6 lines prints the first 6 lines of a 9-line receipt and stops. The paper says “printed”, but the total is missing."),
    reveal: "\"max_tokens\": 1024 (any value comfortably above the ~190 tokens an answer needs).",
    evaluate: ({ out }) => {
      if (!out.accepted) return null;
      const cut = out.truncated[0];
      return cut ? { passed: false, symptom: `${list(out.truncated.map(({ order }) => order))} came back succeeded with stop_reason "max_tokens": the extraction JSON stops mid-object.`, source: cut.source }
        : { passed: true, symptom: "Every succeeded answer ended with end_turn." };
    },
  },
  {
    id: "results-joined", objective: "2.4", title: "Each result lands on the order it belongs to",
    diagnosis: "Batch results are not returned in submission order. Every result echoes the custom_id of its request, so the join key is the custom_id; joining by line position writes one order’s extraction into another order’s row whenever results arrive out of order.",
    hints: hints("Compare the order results arrived in with the order you submitted. Then read the “Archive row … ← extraction of …” lines.",
      "Message Batches results can arrive in any order, keyed by custom_id. Match each result to its request by that id, never by position; that is why each custom_id should identify its record.",
      "A coat check hands back coats by ticket number, not by the order people line up at the end of the night."),
    reveal: "\"join_results_on\": \"custom_id\"",
    evaluate: ({ out }) => {
      if (!out.accepted) return null;
      const wrong = out.misassigned[0];
      return wrong ? { passed: false, symptom: wrong.to === "(nowhere)" ? `The extraction of ${wrong.from} was not written to any archive row.` : `The extraction of ${wrong.from} was written to ${wrong.to}’s archive row.`, source: out.sources.join }
        : { passed: true, symptom: "Every extraction landed on its own order’s row." };
    },
  },
  {
    id: "retry-exact", objective: "2.4", title: "Tomorrow’s resubmission fixes exactly what failed",
    diagnosis: "Resubmit only requests whose result was errored by a transient server problem (overloaded, api_error) or expired, under the same custom_id. A succeeded request resent is imported twice; an invalid_request error fails the same way again and needs a person or a fix to the request.",
    hints: hints("Read each result type in results.jsonl, then the resubmit list. Which orders never got a row, which got two, and which failed twice?",
      "Batch result types: succeeded, errored (check error.type), canceled, expired. Retry errored server errors and expired requests; leave succeeded ones alone; route invalid_request errors to someone who can fix the input.",
      "A mail merge that bounced for one recipient because the server was busy is resent to that recipient. A recipient whose address is malformed goes to the office to correct, and nobody else gets a second copy."),
    reveal: "\"resubmit\": the custom_ids of the overloaded and expired orders only.",
    evaluate: ({ out }) => {
      if (!out.accepted) return null;
      if (out.duplicates.length) return { passed: false, symptom: `${list(out.duplicates)} had already succeeded and ${was(out.duplicates)} imported a second time.`, source: out.sources.resubmit };
      if (out.failedAgain.length) return { passed: false, symptom: `${list(out.failedAgain)} ${was(out.failedAgain)} sent again and failed with the same invalid_request_error.`, source: out.sources.resubmit };
      if (out.lost.length) return { passed: false, symptom: `${list(out.lost)} never reached the archive: it did not succeed tonight and was not sent again.`, source: out.sources.resubmit };
      return { passed: true, symptom: "Every order is in the archive once, and the rejected one waits for staff." };
    },
  },
  {
    id: "cache-prefix", objective: "5.4", title: "Requests after the first read the handbook from the prompt cache",
    diagnosis: "Prompt caching reuses an exact prefix (tools → system → messages) up to a cache_control breakpoint. Anything that changes per request inside that prefix, such as a stall name ahead of the handbook, makes every prefix unique, so nothing is ever read from cache. Stable content goes first, the breakpoint at its end, varying content after it.",
    hints: hints("Read the usage lines: cache_read_input_tokens per request. Then compare the first block of prompt.json for two different orders.",
      "Prompt caching is a prefix match. Put the identical handbook and examples first, mark the end of that stable part with cache_control, and put per-request details (order, stall, scan) after the breakpoint, in the user message.",
      "A podcast records its intro once and reuses it every episode; if the guest’s name were spoken in the first second of the intro, it would have to be re-recorded each time."),
    reveal: "prompt.json: [{ handbook text }, { examples, \"cache_control\": { \"type\": \"ephemeral\" } }] with no {{stall}} or {{order_id}} inside the cached blocks.",
    evaluate: ({ out }) => {
      if (!out.accepted) return null;
      const later = out.cacheReads.slice(1);
      if (!later.length || later.every(({ read }) => read > 0)) return { passed: true, symptom: `Requests 2–${out.cacheReads.length} read the cached prefix.` };
      const zeros = later.filter(({ read }) => read === 0).map(({ customId }) => customId);
      return { passed: false, symptom: `cache_read_input_tokens is 0 on ${list(zeros)}${out.prefixDiff ? `: the cached prefix already differs between requests at prompt.json block ${out.prefixDiff.block}` : ""}.`,
        source: out.prefixDiff?.source ?? out.sources.prompt };
    },
  },
  {
    id: "unreadable-status", objective: "6.2", title: "A smudged vendor ID and a blank one get different statuses",
    diagnosis: "Few-shot examples teach the boundary you care about. With only an example of an empty field, the model files an illegible field the same way (or invents a value). Pair an empty example with an illegible one, each with its own status and vendor_id null.",
    hints: hints("Read the simulated extraction lines for the blank and the smudged scans, then the examples in prompt.json.",
      "Few-shot prompting: examples show the model which cases differ. To keep “missing” and “unreadable” apart, include one example of each edge case with its expected output, rather than more clean examples or a request to be careful.",
      "A survey scanner is shown one skipped question (status: skipped) and one scribbled-over answer (status: illegible), so it stops filing scribbles as skips."),
    reveal: "Add an <example> whose scan has a smudged ID (e.g. “Vendor ID: V-▒▒”) with Output vendor_id null and its own status, next to the blank-ID example.",
    evaluate: ({ out }) => {
      if (!out.accepted) return null;
      const { blank, smudged, source } = out.extraction;
      if (smudged.guessed) return { passed: false, symptom: `Simulated extraction: the smudged scan came back with vendor_id "${smudged.vendorId}", a value nobody can read on the invoice.`, source };
      if (blank.guessed) return { passed: false, symptom: `Simulated extraction: the blank scan came back with vendor_id "${blank.vendorId}" although the box is empty.`, source };
      if (blank.status === smudged.status) return { passed: false, symptom: `Simulated extraction: the smudged scan and the blank scan both came back as status "${blank.status}", so staff phone vendors whose ID is on the invoice.`, source };
      return { passed: true, symptom: `Simulated extraction: blank → "${blank.status}", smudged → "${smudged.status}".` };
    },
  },
];

function effects(runs: readonly LabRunFixture<BatchInput, BatchOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out?.accepted) return [{ kind: "tray" as const, item: `${fixture.name}: batch`, to: "failed" as const }];
    const wrong = new Set([...out.misassigned.map(({ from }) => from), ...out.duplicates, ...out.lost, ...out.failedAgain]);
    return [
      ...fixture.input.orders.map(({ id }) => ({ kind: "tray" as const, item: id,
        to: wrong.has(id) ? "failed" as const : out.held.includes(id) ? "held" as const : "posted" as const })),
      { kind: "meter" as const, id: `${fixture.id}-cache`, label: "tokens read from cache", value: run?.metrics.cacheRead ?? 0, unit: "tokens" },
    ];
  });
}

const sampleRef = referenceFor(sampleNight);
const replace = (files: LabFiles, key: string, from: string | RegExp, to: string): LabFiles => {
  const next = files[key].replace(from, to);
  if (next === files[key]) throw new Error(`vendor-batch-api mutant edit not found in ${key}: ${String(from)}`);
  return { ...files, [key]: next };
};

export const vendorBatchLab: LabMission<unknown, BatchInput, BatchOut> = {
  id: "vendor-batch-api",
  provider: "anthropic",
  track: "developer-foundations",
  objectives: ["2.3", "2.4", "5.4", "6.2"],
  station: "Archive batch terminal",
  speaker: "Dev Shah",
  opening: "Last night’s archive import wrote one order’s data into another’s row, imported two orders twice, and never once read the handbook from cache.",
  task: "Write tonight’s batch, the shared system prompt, and the import plan. Then run the night.",
  brief: {
    problem: "The archive batch misfiles results that come back out of order, re-imports orders on retry, and pays full price for the same handbook on every request.",
    move: "Read Tonight’s archive orders and the provider outcomes, then the two shop notes. Edit the three files and run the night.",
    success: ["The batch is accepted with one request per order", "Every extraction lands on its own row, once", "The rejected order waits for staff instead of failing again", "Requests after the first read the handbook from cache", "Smudged and blank vendor IDs are filed differently"],
  },
  prebrief: {
    concept: "The Message Batches API runs many independent requests asynchronously at about half price. Each request carries your custom_id; results come back in any order with that id and a type: succeeded, errored, canceled or expired.",
    terms: [["Overnight bulk run", "Message Batches API"], ["Your tag on each job", "custom_id"], ["Answer cut off", "stop_reason: max_tokens"],
      ["Reuse the unchanging start of a prompt", "Prompt caching (cache_control, cache_read_input_tokens)"], ["Teach an edge case by showing it", "Few-shot examples"]],
    contrast: {
      good: "A photo lab tags each overnight print job with its order number, so prints are bagged by number however the printers finish.",
      bad: "Bagging prints in the order they come off the printers puts one customer’s photos in another’s envelope.",
    },
  },
  documents: [...nightDocuments(sampleNight, "Recorded outcome for tonight’s orders:"), ...shopNotes],
  artifacts: [
    { id: "batch", kind: "anthropic.batch-requests", path: "batch.json", editor: "json", instruction: "The body of POST /v1/messages/batches: one request per archive order.",
      starter: starter.batch, example: compactJson({ requests: [{ custom_id: "invoice-Q7", params: { model: "claude-opus-5-5", max_tokens: 512, messages: [{ role: "user", content: "Invoice Q7 · …" }] } }] }) },
    { id: "prompt", kind: "prompt", path: "prompt.json", editor: "json", instruction: "The system blocks sent with every request. {{order_id}} and {{stall}} are filled in per request.",
      starter: starter.prompt, example: compactJson([{ type: "text", text: "Library catalog rules…" }, { type: "text", text: "<example>\nScan: …\nOutput: {\"status\": \"…\"}\n</example>", cache_control: { type: "ephemeral" } }]) },
    { id: "plan", kind: "error-contract", path: "import-plan.json", editor: "json", instruction: "How the importer joins results to archive rows, and which custom_ids to send again.",
      starter: starter.plan, example: compactJson({ join_results_on: "…", resubmit: ["invoice-Q9"] }) },
  ],
  engine: batchesEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: {
    expired: [...nightDocuments(expiredNight, "Recorded outcome for the next night:"), ...shopNotes],
    overload: [...nightDocuments(overloadNight, "Recorded outcome for the next night:"), ...shopNotes],
  },
  checks,
  prediction: {
    prompt: "How many of tonight’s 3 orders will end up in the archive exactly once, on their own row?", unit: "orders",
    actual: (run) => run.fixtures.reduce((total, { run: entry, fixture }) => {
      const out = entry?.out as BatchOut | undefined;
      if (!out?.accepted) return total;
      const wrong = new Set([...out.misassigned.flatMap(({ from, to }) => [from, to]), ...out.duplicates, ...out.lost, ...out.failedAgain, ...out.held]);
      return total + (fixture.input as BatchInput).orders.filter(({ id }) => !wrong.has(id)).length;
    }, 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { expired: referenceFor(expiredNight), overload: referenceFor(overloadNight) } },
  mutants: [
    { name: "custom_id with a slash", set: "sample", mustFail: ["batch-accepted"], edit: (files) => ({ ...files, batch: batchFile(sampleNight, { ids: (order) => `order/${order.id}` }) }) },
    { name: "stream: true in a batch request", set: "sample", mustFail: ["batch-accepted"], edit: (files) => ({ ...files, batch: batchFile(sampleNight, { stream: true }) }) },
    { name: "max_tokens too small", set: "sample", mustFail: ["outputs-complete"], edit: (files) => ({ ...files, batch: batchFile(sampleNight, { maxTokens: 120 }) }) },
    { name: "positional join", set: "sample", mustFail: ["results-joined"], edit: (files) => replace(files, "plan", "\"custom_id\",", "\"position\",") },
    { name: "resubmit everything", set: "sample", mustFail: ["retry-exact"], edit: (files) => ({ ...files, plan: planFile("custom_id", sampleNight.orders.map(({ id }) => `order-${id}`)) }) },
    { name: "resubmit nothing", set: "sample", mustFail: ["retry-exact"], edit: (files) => ({ ...files, plan: planFile("custom_id", []) }) },
    { name: "resubmit the invalid request", set: "transfer", variant: "expired", mustFail: ["retry-exact"], edit: (files) => ({ ...files, plan: planFile("custom_id", [...retryable(expiredNight), "order-A-214"]) }) },
    { name: "stall name ahead of the handbook", set: "sample", mustFail: ["cache-prefix"], edit: (files) => replace(files, "prompt", `"text": "${handbookMarker}`, `"text": "Stall: {{stall}}. ${handbookMarker}`) },
    { name: "no cache breakpoint", set: "sample", mustFail: ["cache-prefix"], edit: (files) => replace(files, "prompt", /,\s*"cache_control": \{ "type": "ephemeral" \}/, "") },
    { name: "no smudged example", set: "sample", mustFail: ["unreadable-status"], edit: (files) => ({ ...files, prompt: promptFile([{ type: "text", text: handbook }, { type: "text", text: blankExample, cache_control: { type: "ephemeral" } }]) }) },
    { name: "smudged example filed as missing", set: "sample", mustFail: ["unreadable-status"], edit: (files) => replace(files, "prompt", "\\\"unreadable\\\"", "\\\"missing\\\"") },
  ],
  probes: [
    { name: "every status in one example", set: "sample", mustFail: ["unreadable-status"],
      files: (files) => ({ ...files, prompt: promptFile([{ type: "text", text: handbook }, { type: "text", text: "<example>\nScan: Vendor ID: (blank) or V-▒▒\nOutput: {\"vendor_id\": null, \"status\": \"missing\" or \"unreadable\"}\n</example>", cache_control: { type: "ephemeral" } }]) }) },
    { name: "tonight’s ids replayed on the next night", set: "transfer", variant: "expired", files: () => sampleRef, mustFail: ["batch-accepted"] },
  ],
  fixTerms: ["end_turn", "ephemeral"],
  debrief: "The batch gives every order one request whose custom_id names the order, with max_tokens large enough for a complete answer and no stream flag. Results are joined on custom_id because they arrive in any order; only overloaded and expired requests are resubmitted under the same id, while the invalid_request rejection goes to staff. The handbook and examples sit first in the system prompt with cache_control at their end, so every request after the first reads them from cache, and paired examples keep an illegible ID distinct from a missing one.",
};
