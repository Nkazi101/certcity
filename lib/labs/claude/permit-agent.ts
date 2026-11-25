// Developer Foundations · permit-agent. The learner writes the next Messages API request after Claude stopped with
// stop_reason "tool_use": the pending assistant turn, one user turn of tool_result blocks keyed by tool_use_id,
// is_error on execution failures only, the tools the application offers (the acknowledgment gate), and the
// authorized case history. Transfer (revise): a new case with new IDs, either an eligibility timeout or a clean pass.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { messagesEngine } from "../engines/messages";
import type { ToolCall, ToolOutcome, ToolTurnInput, ToolTurnOut } from "../engines/messages";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

type Case = {
  id: string; applicant: string; place: string; permit: string;
  calls: readonly ToolCall[]; arrivals: readonly ToolOutcome[];
  console: { session: string; applicant: string; place: string };
};

const labels = { address_lookup: "Address", eligibility_lookup: "Eligibility", fee_estimate: "Fee estimate" };
const intakeText = (c: Case) => `Permit intake ${c.id}: ${c.applicant} applies for a ${c.permit} permit at ${c.place}. Verify the address and eligibility, estimate the fee, then acknowledge the application.`;
const consoleText = (c: Case) => `Permit intake ${c.console.applicant}: resident at ${c.console.place} asks to renew a parking permit. Verify the address and eligibility, estimate the fee, then acknowledge the application.`;
const assistantText = (c: Case) => `I'll check the address, eligibility, and fee for ${c.id}.`;

const tool = (name: string, description: string, params: Record<string, string>) => ({
  name, description,
  input_schema: { type: "object", properties: Object.fromEntries(Object.keys(params).map((key) => [key, { type: "string" }])), required: Object.keys(params) },
});
const tools = {
  address_lookup: tool("address_lookup", "Verify a permit address against the parcel register.", { case_id: "", address: "" }),
  eligibility_lookup: tool("eligibility_lookup", "Check zoning eligibility for a permit case.", { case_id: "" }),
  fee_estimate: tool("fee_estimate", "Estimate the permit fee for a case.", { case_id: "", permit_type: "" }),
  send_acknowledgment: tool("send_acknowledgment", "Send the applicant an acknowledgment that intake is complete.", { case_id: "" }),
};

const p42: Case = {
  id: "P-42", applicant: "Rosa Lind", place: "14 Ash Street", permit: "sidewalk café",
  calls: [
    { id: "toolu_01A7pqX", name: "address_lookup", input: { case_id: "P-42", address: "14 Ash Street" } },
    { id: "toolu_01F3mcK", name: "fee_estimate", input: { case_id: "P-42", permit_type: "sidewalk_cafe" } },
    { id: "toolu_01E9wtR", name: "eligibility_lookup", input: { case_id: "P-42" } },
  ],
  arrivals: [
    { id: "toolu_01F3mcK", status: "timeout", output: "fee_estimate timed out after 30 s (city-fees did not respond)" },
    { id: "toolu_01E9wtR", status: "negative", output: "P-42 eligibility: not eligible. 14 Ash Street is zoned I-2; sidewalk café permits need C-1 or C-2." },
    { id: "toolu_01A7pqX", status: "ok", output: "P-42 address verified: 14 Ash Street, parcel 0417-22, zone I-2." },
  ],
  console: { session: "S-118", applicant: "P-39", place: "9 Elm Court" },
};
const p57: Case = {
  id: "P-57", applicant: "Malik Osei", place: "210 Market Street", permit: "street banner",
  calls: [
    { id: "toolu_01Qd4vN", name: "eligibility_lookup", input: { case_id: "P-57" } },
    { id: "toolu_01Lr8sB", name: "address_lookup", input: { case_id: "P-57", address: "210 Market Street" } },
    { id: "toolu_01Hn2zC", name: "fee_estimate", input: { case_id: "P-57", permit_type: "street_banner" } },
  ],
  arrivals: [
    { id: "toolu_01Hn2zC", status: "ok", output: "P-57 fee estimate: $65 (street banner, 14 days)." },
    { id: "toolu_01Lr8sB", status: "ok", output: "P-57 address verified: 210 Market Street, parcel 0102-07, zone C-2." },
    { id: "toolu_01Qd4vN", status: "timeout", output: "eligibility_lookup timed out after 30 s (zoning-api returned no response)" },
  ],
  console: { session: "S-131", applicant: "P-55", place: "41 Pine Row" },
};
const p61: Case = {
  id: "P-61", applicant: "Dana Whit", place: "7 Mill Lane", permit: "food truck",
  calls: [
    { id: "toolu_01Wc6yD", name: "fee_estimate", input: { case_id: "P-61", permit_type: "food_truck" } },
    { id: "toolu_01Tb3kM", name: "eligibility_lookup", input: { case_id: "P-61" } },
    { id: "toolu_01Ps9gV", name: "address_lookup", input: { case_id: "P-61", address: "7 Mill Lane" } },
  ],
  arrivals: [
    { id: "toolu_01Ps9gV", status: "ok", output: "P-61 address verified: 7 Mill Lane, parcel 0388-15, zone C-1." },
    { id: "toolu_01Tb3kM", status: "ok", output: "P-61 eligibility: eligible. Food trucks are permitted in C-1 on weekdays." },
    { id: "toolu_01Wc6yD", status: "ok", output: "P-61 fee estimate: $120 (food truck, 30 days)." },
  ],
  console: { session: "S-140", applicant: "P-60", place: "3 Quarry Lane" },
};

const assistantTurn = (c: Case) => ({
  role: "assistant",
  content: [{ type: "text", text: assistantText(c) }, ...c.calls.map(({ id, name, input }) => ({ type: "tool_use", id, name, input }))],
});

const input = (c: Case): ToolTurnInput => ({
  caseId: c.id, intake: intakeText(c), assistant: { text: assistantText(c), calls: c.calls }, arrivals: c.arrivals,
  required: ["address_lookup", "eligibility_lookup"], gatedTool: "send_acknowledgment", eagerGate: true, labels,
  foreign: [{ session: c.console.session, applicant: c.console.applicant, marker: c.console.place }],
});

type ResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: true };
function request(c: Case, { results, intake = intakeText(c), offerAck = false }: { results: readonly ResultBlock[] | null; intake?: string; offerAck?: boolean }) {
  return compactJson({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    tools: [tools.address_lookup, tools.eligibility_lookup, tools.fee_estimate, ...(offerAck ? [tools.send_acknowledgment] : [])],
    messages: [{ role: "user", content: intake }, assistantTurn(c), ...(results ? [{ role: "user", content: results }] : [])],
  });
}
/** Each result under its own call, is_error only on execution failures. */
function correctResults(c: Case): ResultBlock[] {
  return c.calls.map(({ id }) => {
    const outcome = c.arrivals.find((entry) => entry.id === id)!;
    return { type: "tool_result", tool_use_id: id, content: outcome.output, ...(outcome.status === "timeout" && { is_error: true as const }) };
  });
}
const reference = (c: Case, offerAck: boolean) => request(c, { results: correctResults(c), offerAck });

// The deployed code joined results to calls by arrival position, sent failures as plain content, always offered the
// acknowledgment tool, and resumed whatever session was last open on the shared console.
const starter = request(p42, {
  intake: consoleText(p42), offerAck: true,
  results: p42.calls.map(({ id }, index) => ({ type: "tool_result", tool_use_id: id, content: p42.arrivals[index].output })),
});

const example = compactJson({
  model: "claude-opus-5-5",
  max_tokens: 1024,
  tools: [{ name: "hold_lookup", description: "…", input_schema: { type: "object", properties: { card: { type: "string" } }, required: ["card"] } }],
  messages: [
    { role: "user", content: "Library card L-7: can I renew my holds?" },
    { role: "assistant", content: [{ type: "text", text: "Checking both holds." },
      { type: "tool_use", id: "toolu_ex1", name: "hold_lookup", input: { card: "L-7" } },
      { type: "tool_use", id: "toolu_ex2", name: "fine_lookup", input: { card: "L-7" } }] },
    { role: "user", content: [
      { type: "tool_result", tool_use_id: "toolu_ex1", content: "2 holds, both renewable" },
      { type: "tool_result", tool_use_id: "toolu_ex2", content: "fines service unavailable (503)", is_error: true }] },
  ],
});

function caseDocuments(c: Case): LabDocument[] {
  return [
    { id: `${c.id}-turn`, title: `Assistant turn · ${c.id} (stop_reason: "tool_use")`, format: "json", text: compactJson(assistantTurn(c)) },
    { id: `${c.id}-arrivals`, title: "Tool completions · in the order they finished", format: "code",
      text: c.arrivals.map(({ id, output }, index) => `${index + 1}. ${id} → ${output}`).join("\n") },
    { id: `${c.id}-record`, title: `Case record ${c.id} · authorized for this clerk`, text: `Opening message: “${intakeText(c)}”` },
    { id: `${c.id}-console`, title: `Shared console · last open session ${c.console.session}`,
      text: `Most recent session on the counter console. Opening message: “${consoleText(c)}”` },
  ];
}

const procedure: LabDocument = { id: "procedure", title: "Counter procedure",
  text: "An acknowledgment may go out only for an application whose address and eligibility lookups have each passed. The application decides which tools Claude may call on each turn. A resumed case loads history from its authorized case record, never from the shared console." };

const fixtures: Fixture<ToolTurnInput>[] = [
  { id: "p42", name: "P-42 · three lookups, out of order", set: "sample", situation: "Fee timed out, eligibility answered “not eligible”, address verified — in that order.", input: input(p42) },
  { id: "p57", name: "P-57 · new case", set: "transfer", variant: "timeout", situation: "A new clerk resumes P-57. One lookup did not complete.", input: input(p57) },
  { id: "p61", name: "P-61 · new case", set: "transfer", variant: "clear", situation: "A new clerk resumes P-61. Every lookup came back.", input: input(p61) },
];

const quote = (value: string) => `“${value.length > 90 ? value.slice(0, 87) + "…" : value}”`;
type C = Check<ToolTurnInput, ToolTurnOut>;

const checks: C[] = [
  {
    id: "api-accepts", objective: "1.2", title: "The API accepts the follow-up request",
    diagnosis: "After stop_reason “tool_use”, the next request must contain the assistant turn exactly as returned, followed by a user turn holding one tool_result for every tool_use id in it. The API rejects a request with an unanswered tool_use, an id that no tool_use in the previous turn asked for, or a final assistant message.",
    hints: hints("Read the 400 message in the trace: it names the message index and the ids involved. Compare it with the assistant turn in the case file.",
      "Agent loop mechanics: append the assistant response unchanged, then one user message whose content starts with tool_result blocks, one per tool_use, each citing its tool_use_id. Every call is answered, including the ones that failed.",
      "A courier app sends three delivery requests in one batch. The depot must close all three tickets in its reply, even the one it could not deliver, or the app refuses the reply as incomplete."),
    reveal: "Keep the assistant turn exactly as returned, then add one user message with three tool_result blocks: one per tool_use id in that turn.",
    evaluate: ({ out }) => out.accepted ? { passed: true, symptom: "200 · the request was accepted." }
      : { passed: false, symptom: `The API returned 400: ${out.error!.message}`, source: out.error!.source },
  },
  {
    id: "errors-flagged", objective: "1.2", title: "Each result tells Claude whether the lookup ran",
    diagnosis: "is_error: true marks an execution failure (timeout, outage). A lookup that ran and returned an unfavourable answer is a successful result. Without the flag, Claude reads failure text as data; with it on a real answer, Claude discards a decision and calls the tool again.",
    hints: hints("Find the call that timed out in Tool completions, then read the block your request sends for that call’s id. Then read the block for the call that answered “not eligible”.",
      "tool_result.is_error distinguishes “the tool could not run” from “the tool ran and said no”. Set it only for execution failures and keep a short error message in content so Claude can retry or explain. A negative business answer is ordinary content.",
      "A thermostat reports “sensor offline” as an error, so the controller waits for a reading. It reports “18 °C” as a reading even when that is too cold; the controller acts on it instead of re-polling."),
    reveal: "{ \"type\": \"tool_result\", \"tool_use_id\": \"<the timed-out call’s id>\", \"content\": \"<the timeout message>\", \"is_error\": true } — and no is_error on results that completed, even negative ones.",
    evaluate: ({ out }, fixture) => {
      if (!out.accepted || !out.continuesTurn) return null;
      for (const pair of out.pairs) {
        const name = pair.call.name;
        if (pair.outcome.status === "timeout" && !pair.isError) {
          return { passed: false, symptom: `${name} (${pair.call.id}) timed out, yet Claude’s turn reports it as a finished lookup: ${quote(`${labels[name as keyof typeof labels]}: ${pair.carried?.output ?? pair.content}`)}`, source: pair.source };
        }
        if (pair.outcome.status === "timeout" && !pair.content) {
          return { passed: false, symptom: `${name} (${pair.call.id}) reached Claude as a failure with no message, so its turn cannot say what went wrong or whether to retry.`, source: pair.source };
        }
        if (pair.outcome.status !== "timeout" && pair.isError) {
          return { passed: false, symptom: `${name} (${pair.call.id}) returned a decision, but Claude’s turn treats it as a failed lookup and calls ${name} again for ${fixture.input.caseId}.`, source: pair.source };
        }
      }
      return { passed: true, symptom: "Claude’s turn knows which lookups ran and which did not." };
    },
  },
  {
    id: "results-paired", objective: "2.1", title: "Every result reaches the call that asked for it",
    diagnosis: "Claude correlates results only through tool_use_id. Completion order says nothing about which call finished: if ids follow arrival order, each result is read as the answer to a different question and nothing errors.",
    hints: hints("Line up the three ids in the assistant turn with the completions list. For each tool_result in your request, ask which call produced its content.",
      "Parallel tool calls: one assistant turn may hold several tool_use blocks. Your code keeps each pending call’s id with its execution and sends back tool_result.tool_use_id = that id, in any order. The id is the join key.",
      "A print shop gets jobs J1–J3. When J3 finishes first it is bagged with the J3 ticket, not with the first ticket in the stack."),
    reveal: "Each tool_result’s tool_use_id is the id of the tool_use that produced its content, e.g. the address text goes under the address_lookup call’s id.",
    evaluate: ({ out }, fixture) => {
      if (!out.accepted) return null;
      if (!out.continuesTurn) {
        return { passed: false, symptom: `Claude’s turn does not answer ${fixture.input.caseId}’s lookups: no assistant turn in the request asked for ${fixture.input.assistant.calls.map(({ id }) => id).join(", ")}.`, source: out.sources.history };
      }
      const wrong = out.pairs.find(({ carried, call }) => carried?.id !== call.id);
      if (!wrong) return { passed: true, symptom: "Each lookup’s answer reached the call that asked for it." };
      const label = labels[wrong.call.name as keyof typeof labels];
      return { passed: false, symptom: wrong.carried
        ? `Claude’s turn reads ${quote(wrong.carried.output)} as the ${label.toLowerCase()} result (${wrong.call.id}).`
        : `Claude’s turn has nothing usable for the ${label.toLowerCase()} lookup (${wrong.call.id}): ${quote(wrong.content || "(empty)")}.`, source: wrong.source };
    },
  },
  {
    id: "ack-gate", objective: "1.1", title: "An acknowledgment goes out only after address and eligibility both pass",
    diagnosis: "A required sequence belongs in application code. Offering the acknowledgment tool while a prerequisite is unmet leaves the decision to the model, which usually waits and sometimes does not; withholding a capability the model must not use yet is deterministic. When both checks pass, the tool must be available or the applicant waits.",
    hints: hints("Look at the outbox line at the end of the trace and at the tools your request offers. Then reread the Counter procedure.",
      "Deterministic prerequisites: the application, not the prompt, decides which tools exist on a turn. Offer send_acknowledgment only when both required lookups returned a pass; otherwise leave it out (or set tool_choice to none).",
      "A loan portal enables the “Send offer” button only once the credit and identity services have each returned a pass. The underwriting assistant cannot press a button that is not there."),
    reveal: "For a case whose address and eligibility both passed, include send_acknowledgment in tools; for any other case, leave it out of tools.",
    evaluate: ({ out }, fixture) => {
      if (!out.accepted || !out.continuesTurn) return null;
      if (out.ackSent && !out.gateAllowed) {
        const blocked = out.pairs.find(({ call, outcome }) => fixture.input.required.includes(call.name) && outcome.status !== "ok")!;
        return { passed: false, symptom: `send_acknowledgment ran for ${fixture.input.caseId} while ${blocked.call.name} had ${blocked.outcome.status === "timeout" ? "not completed" : "returned “not eligible”"}. The applicant was told intake is complete.`, source: out.sources.tools };
      }
      if (!out.ackSent && out.gateAllowed) {
        return { passed: false, symptom: `Both checks passed for ${fixture.input.caseId}, but the turn ended with no acknowledgment: Claude had no way to send one.`, source: out.sources.tools };
      }
      return { passed: true, symptom: out.ackSent ? "The acknowledgment went out after both checks passed." : "No acknowledgment went out; a prerequisite had not passed." };
    },
  },
  {
    id: "history-scope", objective: "2.5", title: "The resumed conversation carries only this case’s authorized record",
    diagnosis: "Restoring conversation state is an authorization decision. Load history from an identifier authorized for this case; the most recent session on a shared console can belong to another applicant, and Claude will use whatever is in its context.",
    hints: hints("Read the first message in your request, then the two records in the case file: the authorized case record and the shared console’s last session.",
      "Session resume and context hygiene: build the conversation from the case’s own stored record (the intake that produced this assistant turn), looked up by an id the clerk is authorized for. Recency and shared consoles are not authorization.",
      "A hospital tablet reopens a chart only from the patient’s wristband scan, never from “last chart viewed”, because the previous nurse may have been with someone else."),
    reveal: "The first message is the case’s own intake from its authorized record, and nothing from the shared console session.",
    evaluate: ({ out }, fixture) => {
      if (!out.accepted) return null;
      const foreign = out.foreignSeen[0];
      if (foreign) return { passed: false, symptom: `Claude’s turn repeats “${foreign.marker}” from console session ${foreign.session} (applicant ${foreign.applicant}) in ${fixture.input.caseId}’s reply.`, source: foreign.source };
      if (!out.intakePresent) return { passed: false, symptom: `Claude’s turn has no record of ${fixture.input.caseId}’s opening request: the history it received starts somewhere else.`, source: out.sources.history };
      return { passed: true, symptom: `The history holds ${fixture.input.caseId}’s own record only.` };
    },
  },
];

function effects(runs: readonly LabRunFixture<ToolTurnInput, ToolTurnOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    const item = `${fixture.input.caseId} acknowledgment`;
    const paired = run?.metrics.paired ?? 0;
    return [
      { kind: "tray" as const, item, to: !out?.accepted ? "failed" as const : out.ackSent ? out.gateAllowed ? "posted" as const : "leaked" as const : "held" as const },
      { kind: "meter" as const, id: `${fixture.id}-paired`, label: `${fixture.input.caseId} results under the right call`, value: paired, limit: fixture.input.assistant.calls.length, unit: "results" },
    ];
  });
}

const sampleRef: LabFiles = { request: reference(p42, false) };
const transferRef: Record<string, LabFiles> = { timeout: { request: reference(p57, false) }, clear: { request: reference(p61, true) } };
const sampleWith = (change: (results: ResultBlock[]) => ResultBlock[]): LabFiles => ({ request: request(p42, { results: change(correctResults(p42)) }) });

export const permitAgentLab: LabMission<unknown, ToolTurnInput, ToolTurnOut> = {
  id: "permit-agent",
  provider: "anthropic",
  track: "developer-foundations",
  objectives: ["1.1", "1.2", "2.1", "2.5"],
  station: "Permit request trace",
  speaker: "Imani Cole",
  opening: "Case P-42 stalled after ‘I’ll check.’ The three lookups finished out of order, and the console still had this morning’s session open.",
  task: "Write the request that continues P-42 after Claude asked for three lookups.",
  brief: {
    problem: "Case P-42 stopped after promising three lookups. The deployed code’s follow-up request mixed up the results, and an acknowledgment went out for an application that failed.",
    move: "Read the assistant turn, then Tool completions, then the two session records. Edit request.json and run it.",
    success: ["The API accepts the request", "Claude’s next turn reads each result under the call that asked for it", "0 acknowledgments for an application that has not passed both checks", "The resumed turn holds only the case’s own history"],
  },
  prebrief: {
    concept: "When Claude wants tools it stops with stop_reason “tool_use” and lists tool_use blocks, each with an id. Your code runs them and sends the next request: the same assistant turn, then a user turn of tool_result blocks that cite those ids, in any order.",
    terms: [["Claude asks for a lookup", "tool_use block (stop_reason: tool_use)"], ["Hand back an answer", "tool_result with tool_use_id"],
      ["The lookup could not run", "is_error: true"], ["Several lookups in one turn", "Parallel tool calls"], ["Steps that must always happen", "Deterministic prerequisite in code"]],
    contrast: {
      good: "A restaurant pass matches each finished dish to its ticket number, so table 9’s soup reaches table 9 even when it’s ready before table 4’s.",
      bad: "Handing dishes out in the order they finish sends table 9’s soup to table 4.",
    },
  },
  documents: [...caseDocuments(p42), procedure],
  artifacts: [{
    id: "request", kind: "anthropic.messages-request", path: "request.json", editor: "json",
    instruction: "The body of the next POST /v1/messages for this case. It is what the deployed intake code sent.",
    starter, example,
  }],
  engine: messagesEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { timeout: [...caseDocuments(p57), procedure], clear: [...caseDocuments(p61), procedure] },
  checks,
  prediction: {
    prompt: "How many of the 3 tool results will Claude read under the call that asked for them?", unit: "results",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.paired ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: transferRef },
  mutants: [
    { name: "address and eligibility ids swapped", set: "sample", mustFail: ["results-paired"],
      edit: () => sampleWith((results) => results.map((block) => ({ ...block, tool_use_id: block.tool_use_id === "toolu_01A7pqX" ? "toolu_01E9wtR"
        : block.tool_use_id === "toolu_01E9wtR" ? "toolu_01A7pqX" : block.tool_use_id }))) },
    { name: "timed-out fee sent without is_error", set: "sample", mustFail: ["errors-flagged"],
      edit: () => sampleWith((results) => results.map(({ is_error: _flag, ...block }) => block)) },
    { name: "“not eligible” marked as an error", set: "sample", mustFail: ["errors-flagged"],
      edit: () => sampleWith((results) => results.map((block) => block.tool_use_id === "toolu_01E9wtR" ? { ...block, is_error: true as const } : block)) },
    { name: "fee call left unanswered", set: "sample", mustFail: ["api-accepts"],
      edit: () => sampleWith((results) => results.filter((block) => block.tool_use_id !== "toolu_01F3mcK")) },
    { name: "conversation ends on the assistant turn", set: "sample", mustFail: ["api-accepts"],
      edit: () => ({ request: request(p42, { results: null }) }) },
    { name: "acknowledgment tool still offered", set: "sample", mustFail: ["ack-gate"],
      edit: () => ({ request: request(p42, { results: correctResults(p42), offerAck: true }) }) },
    { name: "resumed from the shared console", set: "sample", mustFail: ["history-scope"],
      edit: () => ({ request: request(p42, { results: correctResults(p42), intake: consoleText(p42) }) }) },
    { name: "timed-out eligibility sent without is_error", set: "transfer", variant: "timeout", mustFail: ["errors-flagged"],
      edit: () => ({ request: request(p57, { results: correctResults(p57).map(({ is_error: _flag, ...block }) => block) }) }) },
    { name: "acknowledgment withheld after both checks passed", set: "transfer", variant: "clear", mustFail: ["ack-gate"],
      edit: () => ({ request: reference(p61, false) }) },
  ],
  probes: [
    { name: "sample request replayed on the new case", set: "transfer", variant: "timeout", files: () => sampleRef, mustFail: "any" },
    { name: "sample request replayed on the clean case", set: "transfer", variant: "clear", files: () => sampleRef, mustFail: "any" },
    { name: "every output stuffed into every result", set: "sample", mustFail: "any",
      files: () => ({ request: request(p42, { results: p42.calls.map(({ id }) => ({ type: "tool_result", tool_use_id: id, content: p42.arrivals.map(({ output }) => output).join(" | "), is_error: true })) }) }) },
  ],
  fixTerms: ["is_error", "tool_choice"],
  debrief: "The follow-up request repeats the assistant turn as returned and answers every tool_use in one user turn, joined by tool_use_id rather than arrival order. is_error marks execution failures (the timeout) and never a completed lookup that said no. The application enforces the counter procedure by offering send_acknowledgment only when both required checks passed, and it resumes the case from its authorized record instead of the shared console.",
};
