// Architect Professional · market-scale. The learner writes the vendor-review request template (model, system blocks,
// cache_control breakpoint, the context each case carries), a contrastive holdout set, and the usage assertions CI runs
// on matched requests. The engine renders three matched requests, bills them with prompt caching, derives dispositions
// from the context, scores the holdout on two recorded faulty builds and the assertions on a good and a bad build.
// Transfer (revise): a month later the policy is shorter, deadline checks need the request time, the case bank and the
// recorded builds are new.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { contextCostEngine } from "../engines/context-cost";
import type { BankCase, ContextInput, ContextOut, ModelRow, Placeholder, UsageRow } from "../engines/context-cost";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const models: ModelRow[] = [
  { id: "claude-opus-5-5", accuracy: 0.98, p95: 2.4, input: 4, output: 20, cacheRead: 0.2 },
  { id: "claude-sonnet-5-5", accuracy: 0.95, p95: 1.4, input: 2, output: 10, cacheRead: 0.1 },
  { id: "claude-haiku-5-5", accuracy: 0.92, p95: 0.7, input: 0.1, output: 0.5, cacheRead: 0.01 },
];
const context = (policyTokens: number, extra: Placeholder[] = []): Placeholder[] => [
  { name: "policy", tokens: policyTokens, varies: "never" },
  { name: "rubric", tokens: 900, varies: "never" },
  { name: "vendor_id", tokens: 3, varies: "vendor" },
  { name: "case_id", tokens: 2, varies: "case" },
  { name: "verified_records", tokens: 300, varies: "case", context: "verified" },
  { name: "case_transcript", tokens: 6000, varies: "case", context: "transcript" },
  { name: "last_summary", tokens: 250, varies: "case", context: "summary" },
  { name: "vendor_files", tokens: 9000, varies: "vendor", context: "vendor-files" },
  ...extra,
];
const usage = (rows: readonly (readonly [number, number, number, number, number, number])[]): UsageRow[] =>
  rows.map(([input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens, latency_ms, cost_usd]) => ({ input_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens, latency_ms, cost_usd }));
const builds = [{ name: "build 41", rule: "every-blank-missing" as const }, { name: "build 39", rule: "any-waiver-approves" as const }];

const marchBank: BankCase[] = [
  { id: "11", vendor: "V-03", kind: "complete", note: "All fields present" },
  { id: "12", vendor: "V-17", kind: "complete", note: "All fields present" },
  { id: "13", vendor: "V-08", kind: "blank-none", note: "Insurance field blank; no waiver" },
  { id: "14", vendor: "V-22", kind: "complete", note: "All fields present" },
  { id: "15", vendor: "V-17", kind: "blank-signed", note: "Field 7 blank; waiver W-15 signed by the market manager" },
  { id: "16", vendor: "V-17", kind: "blank-none", note: "Field 7 blank; no waiver" },
  { id: "17", vendor: "V-05", kind: "complete", note: "All fields present" },
  { id: "18", vendor: "V-22", kind: "complete", note: "All fields present" },
  { id: "19", vendor: "V-11", kind: "blank-draft", note: "Field 4 blank; draft waiver on file, unsigned" },
  { id: "20", vendor: "V-30", kind: "blank-signed", note: "Field 7 blank; waiver W-20 signed by the market manager" },
];
const aprilBank: BankCase[] = [
  { id: "41", vendor: "V-02", kind: "complete", note: "All fields present" },
  { id: "42", vendor: "V-31", kind: "complete", note: "All fields present" },
  { id: "43", vendor: "V-14", kind: "blank-none", note: "Permit number blank; no waiver" },
  { id: "44", vendor: "V-31", kind: "blank-signed", note: "Field 2 blank; waiver W-44 signed by the market manager" },
  { id: "45", vendor: "V-06", kind: "complete", note: "All fields present" },
  { id: "46", vendor: "V-31", kind: "blank-none", note: "Field 2 blank; no waiver" },
  { id: "47", vendor: "V-09", kind: "late", note: "All fields present; filed after its five-day deadline" },
  { id: "48", vendor: "V-27", kind: "blank-draft", note: "Insurance field blank; draft waiver on file, unsigned" },
  { id: "49", vendor: "V-12", kind: "complete", note: "All fields present" },
  { id: "50", vendor: "V-19", kind: "blank-signed", note: "Field 9 blank; waiver W-50 signed by the market manager" },
];

const base = { models, targets: { accuracy: 0.94, costUsd: 0.02, p95: 2 }, minimumCacheable: 512, outputTokens: 250, secondsPerThousandUncached: 0.06, builds };
const march: ContextInput = {
  ...base, placeholders: context(3800), bank: marchBank,
  calls: [{ vendor: "V-17", caseId: "15", at: "09:00:04" }, { vendor: "V-17", caseId: "16", at: "09:01:12" }, { vendor: "V-22", caseId: "18", at: "09:02:40" }],
  logs: {
    good: { name: "build 52", calls: usage([[352, 4700, 0, 250, 1610, 0.01495], [349, 0, 4700, 244, 1250, 0.00361], [361, 0, 4700, 256, 1210, 0.00375]]) },
    bad: { name: "build 53", calls: usage([[352, 4704, 0, 250, 1580, 0.01496], [349, 4704, 0, 246, 1240, 0.01492], [361, 4704, 0, 251, 1190, 0.01497]]) },
  },
};
const april: ContextInput = {
  ...base, placeholders: context(3000, [{ name: "request_time", tokens: 8, varies: "call", context: "time" }]), bank: aprilBank,
  calls: [{ vendor: "V-31", caseId: "44", at: "14:00:02" }, { vendor: "V-31", caseId: "46", at: "14:01:30" }, { vendor: "V-09", caseId: "47", at: "14:02:51" }],
  logs: {
    good: { name: "build 61", calls: usage([[360, 3900, 0, 250, 1540, 0.01297], [358, 0, 3900, 248, 1190, 0.00359], [371, 0, 3900, 252, 1230, 0.00365]]) },
    bad: { name: "build 62", calls: usage([[360, 3908, 0, 250, 1560, 0.01299], [358, 3908, 0, 247, 1220, 0.01296], [371, 3908, 0, 251, 1185, 0.01302]]) },
  },
};

const fixtures: Fixture<ContextInput>[] = [
  { id: "march", name: "Three matched vendor requests · March", set: "sample", situation: "Two requests for V-17 (cases 15 and 16) and one for V-22, a minute apart.", input: march },
  { id: "april", name: "Three matched vendor requests · April", set: "transfer", variant: "april", situation: "A shorter policy, deadline checks that need the request time, and a new case bank.", input: april },
];

type Block = { text: string; cache?: boolean };
const requestFile = (model: string, system: readonly Block[], user: readonly Block[]) => compactJson({
  model, max_tokens: 1024,
  system: system.map(({ text, cache }) => ({ type: "text", text, ...(cache && { cache_control: { type: "ephemeral" } }) })),
  messages: [{ role: "user", content: user.map(({ text, cache }) => ({ type: "text", text, ...(cache && { cache_control: { type: "ephemeral" } }) })) }],
});
const holdoutFile = (cases: readonly (readonly [string, string])[]) => compactJson({ cases: cases.map(([id, expect]) => ({ case: id, expect })) });
const checkFile = (assertions: readonly Record<string, unknown>[]) => compactJson({ requests: "matched", assert: assertions });

const sonnet = "claude-sonnet-5-5";
const stable: Block[] = [{ text: "{{policy}}" }, { text: "{{rubric}}", cache: true }];
const caseMessage = (records = "{{verified_records}}", time = false): Block[] => [{ text: `Vendor {{vendor_id}} · case {{case_id}}${time ? " · received {{request_time}}" : ""}\n${records}` }];
const readAssertion = { field: "usage.cache_read_input_tokens", calls: "after-first", min: 1000 };
const marchHoldout: [string, string][] = [["15", "approved-exception"], ["16", "missing-document"], ["19", "missing-document"], ["12", "complete"]];
const aprilHoldout: [string, string][] = [["44", "approved-exception"], ["46", "missing-document"], ["48", "missing-document"], ["42", "complete"]];
const sampleRef: LabFiles = { request: requestFile(sonnet, stable, caseMessage()), holdout: holdoutFile(marchHoldout), check: checkFile([readAssertion]) };
const transferRef: LabFiles = { request: requestFile(sonnet, stable, caseMessage("{{verified_records}}", true)), holdout: holdoutFile(aprilHoldout), check: checkFile([readAssertion]) };
const swap = (files: LabFiles, change: Readonly<Record<string, string>>): LabFiles => ({ ...files, ...change });

// Deployed: the more accurate model, the vendor ID ahead of the policy inside the cached prefix, the full case
// transcript as context, a holdout of clean cases, and a CI check on latency.
const starter: LabFiles = {
  request: requestFile("claude-opus-5-5", [{ text: "Vendor {{vendor_id}}.\n{{policy}}" }, { text: "{{rubric}}", cache: true }], [{ text: "Case {{case_id}}\n{{case_transcript}}" }]),
  holdout: holdoutFile([["11", "complete"], ["12", "complete"], ["14", "complete"]]),
  check: checkFile([{ field: "latency_ms", calls: "all", max: 2000 }]),
};

const usageTable = (log: { name: string; calls: readonly UsageRow[] }) => [`${log.name}  call  input  cache_creation  cache_read  output  latency_ms  cost_usd`,
  ...log.calls.map((row, index) => `${" ".repeat(log.name.length)}  ${index + 1}     ${row.input_tokens}    ${row.cache_creation_input_tokens}            ${row.cache_read_input_tokens}        ${row.output_tokens}     ${row.latency_ms}        ${row.cost_usd}`)].join("\n");
const sharedDocs = (input: ContextInput, policyTokens: number, time: boolean): LabDocument[] => [
  { id: "limits", title: "Signed limits · Inez Vega", text: "Holdout accuracy of at least 94%, at most $0.02 per request and p95 under 2 s. All three apply together." },
  { id: "runs", title: "Candidate runs · Cal Nguyen", format: "code", text: [
    "model              holdout  p95 (cached prompt)  $/MTok in  out    cache read",
    "claude-opus-5-5     98%      2.4 s               4.00       20.00  0.20",
    "claude-sonnet-5-5   95%      1.4 s               2.00       10.00  0.10",
    "claude-haiku-5-5    92%      0.7 s               0.10        0.50  0.01",
    "Cache writes cost 1.25× the input price (5-minute TTL) or 2× (1 hour). Prefixes under 512 tokens are not cached.",
    "Each 1,000 input tokens not read from cache adds about 0.06 s at p95. Answers are about 250 output tokens.",
  ].join("\n") },
  { id: "builder", title: "request-builder.ts · placeholders", format: "code", text: [
    `{{policy}}            ${policyTokens.toLocaleString("en-US")} tokens · approved vendor policy, identical on every request`,
    "{{rubric}}            900 tokens · disposition rubric, identical on every request",
    "{{vendor_id}}         the vendor this request is about",
    "{{case_id}}           the case this request is about",
    "{{verified_records}}  ~300 tokens · the case’s active records, each with its source and status",
    "{{case_transcript}}   ~6,000 tokens · the case’s full history, withdrawn and superseded entries included",
    "{{last_summary}}      ~250 tokens · last week’s compacted summary of the case",
    "{{vendor_files}}      ~9,000 tokens · every file in the vendor’s folder, cross-references to other vendors included",
    ...(time ? ["{{request_time}}      the time the request was received (deadline checks need it)"] : []),
  ].join("\n") },
  { id: "matched", title: "Matched requests replayed", format: "code", text: input.calls.map(({ vendor, caseId, at }) => `${at}  ${vendor} · case ${caseId}`).join("\n") },
  { id: "bank", title: "Case bank", format: "code", text: input.bank.map(({ id, vendor, note }) => `case ${id}  ${vendor}  ${note}`).join("\n") + "\nDispositions: complete · missing-document · approved-exception" + (time ? " · late" : "") },
  { id: "builds", title: "Recorded builds", format: "code", text: [
    "Holdout replays: build 41 files every blank field as missing-document; build 39 treats any waiver document as approval.",
    "",
    usageTable(input.logs.good), `${input.logs.good.name}: ran within budget.`, "",
    usageTable(input.logs.bad), `${input.logs.bad.name}: the deployment behind the ${time ? "new" : "March"} spend spike.`,
  ].join("\n") },
  { id: "fields", title: "holdout.json and cost-check.json", format: "code", text: [
    "holdout.json     cases[]: { case, expect } (expect is a disposition)",
    "cost-check.json  assert[]: { field, calls, min?, max? }",
    "  field  usage.input_tokens | usage.cache_creation_input_tokens | usage.cache_read_input_tokens |",
    "         usage.output_tokens | latency_ms | cost_usd",
    "  calls  \"all\" | \"first\" | \"after-first\"",
    "CI runs the assertions on every build’s matched requests.",
  ].join("\n") },
];

type C = Check<ContextInput, ContextOut>;
const money = (value: number) => `$${value.toFixed(4)}`;
const checks: C[] = [
  {
    id: "route-targets", objective: "2.1", title: "The route meets accuracy, cost and p95 together",
    diagnosis: "Model selection is a trade-off against every signed limit at once. The most accurate model can miss latency or cost; the cheapest can miss accuracy. Cost and tail latency also depend on the request you build: uncached input costs more and adds latency.",
    hints: hints("Read the route line in the trace: which of the three numbers misses its target, and what feeds it?",
      "Choose models by measured quality, cost and latency together on representative requests. Pick the least expensive route that meets every limit, and remember that context size and caching move cost and p95.",
      "A delivery firm picks the van that meets payload, range and running cost together; the biggest truck fails the city’s weight limit and the e-bike cannot carry the load."),
    reveal: "\"model\": \"claude-sonnet-5-5\" with a cached stable prefix and only the verified records per case.",
    evaluate: ({ out }, fixture) => {
      if (out.error) return { passed: false, symptom: `The API rejected the request: ${out.error.message}`, source: out.error.source };
      const { targets } = fixture.input;
      const misses = [
        out.model!.accuracy < targets.accuracy && `holdout accuracy ${Math.round(out.model!.accuracy * 100)}% (target ≥ ${Math.round(targets.accuracy * 100)}%)`,
        out.costPerRequest > targets.costUsd && `${money(out.costPerRequest)} per request (limit $${targets.costUsd.toFixed(2)})`,
        out.p95 >= targets.p95 && `p95 ${out.p95.toFixed(2)} s (limit ${targets.p95} s)`,
      ].filter(Boolean);
      return misses.length ? { passed: false, symptom: `${out.model!.id}: ${misses.join(", ")}.`, source: out.sources.model }
        : { passed: true, symptom: `${out.model!.id} meets all three: ${Math.round(out.model!.accuracy * 100)}%, ${money(out.costPerRequest)}, p95 ${out.p95.toFixed(2)} s.` };
    },
  },
  {
    id: "cache-prefix", objective: "2.5", title: "Requests after the first reuse the shared prefix from cache",
    diagnosis: "Prompt caching matches an exact prefix (system, then messages) up to a cache_control breakpoint. Anything that changes per request inside that prefix (a vendor ID, a case record, a timestamp) makes every prefix unique, so every request writes the cache and none reads it. Stable content first, the breakpoint at its end, per-request content after it.",
    hints: hints("Read cache_read_input_tokens on calls 2 and 3, then find the first block whose rendered text differs between calls.",
      "Stable prefix before the cache_control breakpoint: the identical policy and rubric come first, the breakpoint closes them, and per-request values (vendor ID, case, time) go after it, usually in the user message.",
      "A podcast records its intro once and reuses it every episode; if the guest’s name were spoken in the first second of the intro, it would be re-recorded every time."),
    reveal: "system: [{ \"text\": \"{{policy}}\" }, { \"text\": \"{{rubric}}\", \"cache_control\": { \"type\": \"ephemeral\" } }], with {{vendor_id}} and the records in the user message.",
    evaluate: ({ out }) => {
      if (out.error) return null;
      const later = out.calls.slice(1);
      const cold = later.filter(({ read }) => read === 0);
      if (!cold.length) return { passed: true, symptom: `Calls 2–${out.calls.length} read ${later.map(({ read }) => read).join(" and ")} tokens from cache.` };
      return { passed: false, symptom: `cache_read_input_tokens is 0 on ${cold.map(({ label }) => label).join(" and ")}${out.firstDiff ? `; the rendered request already differs from call 1 at block ${out.firstDiff.block + 1}, before the last breakpoint` : ""}.`, source: out.firstDiff?.source ?? out.sources.system };
    },
  },
  {
    id: "context-verified", objective: "2.4", title: "Each request carries the facts its case depends on, and nothing from other vendors",
    diagnosis: "Context assembly loads the active, verified facts a request depends on, with their source and status. A full transcript brings in withdrawn and superseded entries that can outweigh the signed record; a compacted summary drops qualifiers; a vendor’s whole folder brings in other vendors’ data and cost. Facts a decision needs, such as the time of receipt, must be in the request.",
    hints: hints("Read each call’s disposition line next to the case bank: which case came back wrong, and what did its request carry?",
      "Assemble context from verified sources: the records that are active for this case, with source and status, plus any fact the decision needs. More context is not safer context.",
      "A pharmacist checks the current prescription on file, not the patient’s whole history of crossed-out prescriptions or a nurse’s one-line summary."),
    reveal: "User message: \"Vendor {{vendor_id}} · case {{case_id}}\\n{{verified_records}}\"",
    evaluate: ({ out }) => {
      if (out.error) return null;
      const wrong = out.calls.find(({ disposition, truth }) => disposition !== truth);
      if (wrong) return { passed: false, symptom: `${wrong.label} came back ${wrong.disposition}; the case bank records it as ${wrong.truth}.`, source: out.sources.messages };
      const foreign = out.calls.find(({ otherVendors }) => otherVendors);
      if (foreign) return { passed: false, symptom: `The request for ${foreign.label} carried other vendors’ records.`, source: out.sources.messages };
      return { passed: true, symptom: "Every case received its recorded disposition from its own records." };
    },
  },
  {
    id: "holdout-contrastive", objective: "2.3", title: "The holdout set catches both recorded faulty builds",
    diagnosis: "A holdout set tests a boundary only if it contains look-alike cases on both sides of it, labelled correctly. Clean cases or one-sided cases let a system that files every blank as missing, or approves any waiver document, score perfectly.",
    hints: hints("Read the two holdout lines in the trace: which faulty build still scores 100%, and which kind of case would make it fail?",
      "Contrastive edge cases: pair cases that look alike but deserve different outcomes (signed waiver vs no waiver, signed vs unsigned draft), each labelled from the source record, so confusion shows up as errors.",
      "A spam filter’s test set includes newsletters people asked for next to look-alike phishing, so a filter that blocks every newsletter, or none, is caught."),
    reveal: "cases: 15 approved-exception, 16 missing-document, 19 missing-document, plus a complete case.",
    evaluate: ({ out }) => {
      const { holdout } = out;
      if (holdout.unknown.length) return { passed: false, symptom: `Holdout case ${holdout.unknown[0]} is not in the case bank.`, source: holdout.source };
      if (!holdout.size) return { passed: false, symptom: "The holdout set has no cases.", source: holdout.source };
      if (holdout.mislabeled.length) return { passed: false, symptom: `The holdout expects case ${holdout.mislabeled[0].caseId} to be ${holdout.mislabeled[0].expect}, which the case bank’s record for it does not support.`, source: holdout.source };
      const blind = holdout.builds.find(({ score }) => score === 1);
      return blind ? { passed: false, symptom: `${blind.name} scores 100% on the holdout although it gets real cases wrong.`, source: holdout.source }
        : { passed: true, symptom: `Both faulty builds fail cases in the holdout (${holdout.builds.map(({ name, score }) => `${name} ${Math.round(score * 100)}%`).join(", ")}).` };
    },
  },
  {
    id: "usage-check", objective: "4.5", title: "CI passes the good build and fails the build behind the spend spike",
    diagnosis: "To isolate a cost change, compare matched requests on the fields that measure the variable: usage.cache_read_input_tokens and usage.cache_creation_input_tokens show whether the prefix was reused; per-request cost on matched requests shows the price of it. Latency and output tokens move for other reasons.",
    hints: hints("Compare the two recorded builds column by column in the Recorded builds note: which numbers differ between them, and which barely move?",
      "Cost optimization starts with measurement on matched requests. The usage object reports input_tokens, cache_creation_input_tokens and cache_read_input_tokens per request; an assertion on the right field turns a silent cache break into a failed build.",
      "A utility checks a meter by comparing the same household’s readings week on week, not by whether the lights seem brighter."),
    reveal: "{ \"field\": \"usage.cache_read_input_tokens\", \"calls\": \"after-first\", \"min\": 1000 }",
    evaluate: ({ out }, fixture) => {
      const { costCheck } = out;
      if (!costCheck.count) return { passed: false, symptom: "CI ran no assertions.", source: costCheck.source };
      if (!costCheck.good) return { passed: false, symptom: `CI fails ${fixture.input.logs.good.name}, which ran within budget.`, source: costCheck.source };
      if (costCheck.bad) return { passed: false, symptom: `CI passes ${fixture.input.logs.bad.name}, the build behind the spend spike.`, source: costCheck.source };
      return { passed: true, symptom: `CI passes ${fixture.input.logs.good.name} and fails ${fixture.input.logs.bad.name}.` };
    },
  },
];

function effects(runs: readonly LabRunFixture<ContextInput, ContextOut>[]) {
  return runs.flatMap(({ run }) => {
    const out = run?.out;
    if (!out || out.error) return [];
    return [
      ...out.calls.map(({ label, disposition, truth }) => ({ kind: "tray" as const, item: label, to: disposition === truth ? "posted" as const : "failed" as const })),
      { kind: "meter" as const, id: "cost", label: "cost per request", value: Math.round(out.costPerRequest * 10000) / 10000, limit: 0.02, unit: "$" },
      { kind: "meter" as const, id: "cache", label: "tokens read from cache", value: out.calls.reduce((sum, { read }) => sum + read, 0), unit: "tokens" },
    ];
  });
}

const marchDocs = sharedDocs(march, 3800, false);
export const marketScaleLab: LabMission<unknown, ContextInput, ContextOut> = {
  id: "market-scale",
  provider: "anthropic",
  track: "architect-professional",
  objectives: ["2.1", "2.3", "2.4", "2.5", "4.5"],
  station: "Context and cost bench",
  speaker: "Inez Vega",
  opening: "Vendor requests got more expensive when the vendor ID moved to the top, and case 15’s signed waiver keeps coming back as a missing document.",
  task: "Write the request template, the holdout set and the CI usage check, then replay three matched vendor requests.",
  brief: {
    problem: "The vendor-review route misses the signed limits, never reuses its shared prompt, misfiles a signed waiver, and nothing in CI noticed the spend spike.",
    move: "Read the signed limits and Cal’s candidate runs, then the placeholders, the case bank and the recorded builds. Edit the three files and replay.",
    success: ["The route meets accuracy, cost and p95 together", "Calls 2 and 3 read the shared prefix from cache", "Cases 15 and 16 get different, correct outcomes", "Both faulty builds fail the holdout", "CI fails the spike build and passes the good one"],
  },
  prebrief: {
    concept: "Pick the route that meets every limit, then build each request as a reusable stable part followed by the verified facts for this case. Test the boundary with look-alike cases, and watch the usage fields that show whether the cache is working.",
    terms: [["Repeated opening text that costs less the second time", "Prompt caching (cache_control breakpoint)"],
      ["Reused vs newly stored input", "cache_read_input_tokens / cache_creation_input_tokens"],
      ["Look-alike test cases with different answers", "Contrastive edge cases in a holdout set"], ["Only the facts this request needs", "Context assembly from verified sources"]],
    contrast: {
      good: "A reference librarian keeps the style guide open on the desk and fetches only the patron’s file each time.",
      bad: "Rereading the whole archive for every patron is slow, and an old file can slip in.",
    },
  },
  documents: marchDocs,
  artifacts: [
    { id: "request", kind: "anthropic.messages-request", path: "vendor-review/request.json", editor: "json",
      instruction: "The Messages API body for one vendor case. request-builder.ts fills the {{placeholders}} per request.",
      starter: starter.request,
      example: compactJson({ model: "claude-…", max_tokens: 512, system: [{ type: "text", text: "{{style_guide}}", cache_control: { type: "ephemeral" } }], messages: [{ role: "user", content: [{ type: "text", text: "Ticket {{ticket_id}}\n{{ticket_body}}" }] }] }) },
    { id: "holdout", kind: "eval-plan", path: "vendor-review/holdout.json", editor: "json", instruction: "Cases from the case bank with the disposition each must receive.",
      starter: starter.holdout, example: compactJson({ cases: [{ case: "A-3", expect: "refund" }, { case: "A-9", expect: "no-refund" }] }) },
    { id: "check", kind: "eval-plan", path: "ci/cost-check.json", editor: "json", instruction: "Assertions CI runs on each build’s matched requests.",
      starter: starter.check, example: compactJson({ requests: "matched", assert: [{ field: "usage.output_tokens", calls: "all", max: 600 }] }) },
  ],
  engine: contextCostEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { april: [
    { id: "april-note", title: "April changes · Cal Nguyen", text: "Legal shortened the vendor policy to 3,000 tokens. Late filings are now their own disposition, and deadline checks need the time each request was received. The case bank and the recorded builds are new." },
    ...sharedDocs(april, 3000, true),
  ] },
  checks,
  prediction: {
    prompt: "How many tokens will calls 2 and 3 read from cache, together?", unit: "tokens", tolerance: 50,
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + ((entry?.out as ContextOut | undefined)?.calls.slice(1).reduce((sum, { read }) => sum + read, 0) ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { april: transferRef } },
  mutants: [
    { name: "most accurate model", set: "sample", mustFail: ["route-targets"], edit: (files) => swap(files, { request: requestFile("claude-opus-5-5", stable, caseMessage()) }) },
    { name: "cheapest model", set: "sample", mustFail: ["route-targets"], edit: (files) => swap(files, { request: requestFile("claude-haiku-5-5", stable, caseMessage()) }) },
    { name: "vendor ID ahead of the policy", set: "sample", mustFail: ["cache-prefix"], edit: (files) => swap(files, { request: requestFile(sonnet, [{ text: "Vendor {{vendor_id}}.\n{{policy}}" }, { text: "{{rubric}}", cache: true }], [{ text: "Case {{case_id}}\n{{verified_records}}" }]) }) },
    { name: "no cache breakpoint", set: "sample", mustFail: ["cache-prefix"], edit: (files) => swap(files, { request: requestFile(sonnet, [{ text: "{{policy}}" }, { text: "{{rubric}}" }], caseMessage()) }) },
    { name: "records inside the cached prefix", set: "sample", mustFail: ["cache-prefix"], edit: (files) => swap(files, { request: requestFile(sonnet, [{ text: "{{policy}}" }, { text: "{{rubric}}\n{{verified_records}}", cache: true }], [{ text: "Vendor {{vendor_id}} · case {{case_id}}" }]) }) },
    { name: "breakpoint on the user message only", set: "sample", mustFail: ["cache-prefix"], edit: (files) => swap(files, { request: requestFile(sonnet, [{ text: "{{policy}}" }, { text: "{{rubric}}" }], [{ ...caseMessage()[0], cache: true }]) }) },
    { name: "full transcript as context", set: "sample", mustFail: ["context-verified", "route-targets"], edit: (files) => swap(files, { request: requestFile(sonnet, stable, caseMessage("{{case_transcript}}")) }) },
    { name: "last summary as context", set: "sample", mustFail: ["context-verified"], edit: (files) => swap(files, { request: requestFile(sonnet, stable, caseMessage("{{last_summary}}")) }) },
    { name: "the vendor’s whole folder", set: "sample", mustFail: ["context-verified", "route-targets"], edit: (files) => swap(files, { request: requestFile(sonnet, stable, caseMessage("{{vendor_files}}")) }) },
    { name: "holdout of missing documents only", set: "sample", mustFail: ["holdout-contrastive"], edit: (files) => swap(files, { holdout: holdoutFile([["13", "missing-document"], ["16", "missing-document"]]) }) },
    { name: "holdout without the unsigned draft", set: "sample", mustFail: ["holdout-contrastive"], edit: (files) => swap(files, { holdout: holdoutFile(marchHoldout.filter(([id]) => id !== "19")) }) },
    { name: "holdout labels the draft as approved", set: "sample", mustFail: ["holdout-contrastive"], edit: (files) => swap(files, { holdout: holdoutFile(marchHoldout.map(([id, expect]) => id === "19" ? [id, "approved-exception"] : [id, expect])) }) },
    { name: "CI checks latency", set: "sample", mustFail: ["usage-check"], edit: (files) => swap(files, { check: checkFile([{ field: "latency_ms", calls: "after-first", max: 1250 }]) }) },
    { name: "CI checks output tokens", set: "sample", mustFail: ["usage-check"], edit: (files) => swap(files, { check: checkFile([{ field: "usage.output_tokens", calls: "all", max: 300 }]) }) },
    { name: "request time inside the cached prefix", set: "transfer", variant: "april", mustFail: ["cache-prefix"], edit: (files) => swap(files, { request: requestFile(sonnet, [{ text: "Received {{request_time}}.\n{{policy}}" }, { text: "{{rubric}}", cache: true }], caseMessage()) }) },
    { name: "request time left out", set: "transfer", variant: "april", mustFail: ["context-verified"], edit: (files) => swap(files, { request: requestFile(sonnet, stable, caseMessage()) }) },
    { name: "CI floor copied from March", set: "transfer", variant: "april", mustFail: ["usage-check"], edit: (files) => swap(files, { check: checkFile([{ ...readAssertion, min: 4000 }]) }) },
  ],
  probes: [
    { name: "five cache breakpoints", set: "sample", mustFail: ["route-targets"],
      files: (files) => swap(files, { request: requestFile(sonnet, [{ text: "{{policy}}", cache: true }, { text: "{{rubric}}", cache: true }, { text: "Rules.", cache: true }, { text: "More rules.", cache: true }], [{ ...caseMessage()[0], cache: true }]) }) },
    { name: "every disposition on every case", set: "sample", mustFail: ["holdout-contrastive"],
      files: (files) => swap(files, { holdout: holdoutFile(marchHoldout.map(([id]) => [id, "approved-exception or missing-document"])) }) },
  ],
  fixTerms: ["after-first", "verified_records"],
  debrief: "claude-sonnet-5-5 is the only route inside all three signed limits once the request is built well. The identical policy and rubric come first with cache_control on the rubric, so calls 2 and 3 read about 4,700 tokens at the cache-read price; the vendor ID, the case and (in April) the request time go after the breakpoint in the user message, with only the case’s verified records. The holdout pairs a signed waiver with a blank field without one and with an unsigned draft, so both recorded faulty builds fail it, and CI asserts cache_read_input_tokens on the matched requests after the first, which separates the spike build from the good one in both months.",
};
