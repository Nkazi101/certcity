// Architect Foundations · library-search. The learner writes the reference desk's next Messages API request after Claude
// stopped with stop_reason "tool_use" (the pending catalog call answered by tool_use_id, before the visitor's new text), the
// two catalog tool definitions in that request (whose descriptions decide which tool Claude reaches for), and the exhibit
// panel's source table (each attendance figure with its line, method and record). Transfer (revise): a new photo with a
// new call id and a new set of attendance records, one of them a conflicting newspaper figure.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { agentLoopEngine } from "../engines/agent-loop";
import type { LoopInput, LoopOut, PanelRecord } from "../engines/agent-loop";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

type Case = {
  input: LoopInput;
  visitor: string;
  followup: string;
  /** Exhibit the desk is building, used in the create request. */
  exhibit: string;
};

const implementations = { read: ["search_records"], create: ["search_exhibit", "create_exhibit_draft"] };
const lookupAsk = (photo: string) => `Find the exhibit file behind photo ${photo}`;

const img311: Case = {
  visitor: "Where does the harbor photo IMG-311 come from? Tess needs its source before the label goes up.",
  followup: "Hello? Did you find where the photo came from?",
  exhibit: "Waterfront",
  input: {
    caseId: "IMG-311",
    pending: { text: "I'll check the catalog for IMG-311.", call: { id: "toolu_01C42hXk", name: "search_records", input: { query: "IMG-311" } } },
    output: "IMG-311 · accession A-1907-12 · “Harbor at low tide”, glass-plate print. Original negative: exhibit file EX-88.",
    lead: "EX-88",
    next: { ask: "Look up exhibit file EX-88", subject: "exhibit",
      readOutput: "EX-88 · negative by M. Alvarez, 1907 · donated by the Alvarez family in 1952.",
      createOutput: "Draft exhibit entry D-0412 created (title: EX-88).",
      answer: "IMG-311 is accession A-1907-12. Its negative (exhibit file EX-88) was made by M. Alvarez in 1907 and donated by the Alvarez family in 1952." },
    requests: [{ ask: lookupAsk("IMG-311"), intent: "lookup", subject: "exhibit" }, { ask: "Add IMG-311 to the Waterfront exhibit draft", intent: "create", subject: "exhibit" }],
    implementations,
    panel: {
      lines: [{ key: "saturday", title: "Saturday 14 June" }, { key: "weekend", title: "Weekend 14–15 June" }],
      records: [
        { id: "scanner", title: "Gate scanner log", line: "saturday", figure: 83, kind: "count", note: "83 ticket scans at the gate on Saturday 14 June. Members do not scan tickets." },
        { id: "tally", title: "Docent door tally", line: "saturday", figure: 95, kind: "count", note: "95 visitors counted by hand at the gallery door on Saturday 14 June, members included." },
        { id: "note", title: "Weekend planning note", line: "weekend", figure: 120, kind: "estimate", note: "Estimated 120 attendees across Saturday and Sunday, written the week before for staffing." },
      ],
    },
  },
};
const img528: Case = {
  visitor: "Where did the ferry photo IMG-528 come from? We need the donor before it goes on the wall.",
  followup: "Any luck with the ferry photo?",
  exhibit: "Crossings",
  input: {
    caseId: "IMG-528",
    pending: { text: "Let me look up IMG-528 in the catalog.", call: { id: "toolu_01Fy7Qm2", name: "search_records", input: { query: "IMG-528" } } },
    output: "IMG-528 · accession A-1911-03 · “Ferry landing in fog”, silver print. Donor correspondence: exhibit file EX-102.",
    lead: "EX-102",
    next: { ask: "Look up exhibit file EX-102", subject: "exhibit",
      readOutput: "EX-102 · letters from the Okafor family, 1964, transferring the print and its copyright to the library.",
      createOutput: "Draft exhibit entry D-0419 created (title: EX-102).",
      answer: "IMG-528 is accession A-1911-03. The Okafor family gave the print and its copyright to the library in 1964 (letters in exhibit file EX-102)." },
    requests: [{ ask: lookupAsk("IMG-528"), intent: "lookup", subject: "exhibit" }, { ask: "Put IMG-528 in the Crossings exhibit draft", intent: "create", subject: "exhibit" }],
    implementations,
    panel: {
      lines: [{ key: "sunday", title: "Sunday 22 June" }, { key: "weekend", title: "Weekend 21–22 June" }],
      records: [
        { id: "turnstile", title: "Turnstile counter", line: "sunday", figure: 64, kind: "count", note: "64 entries through the turnstile on Sunday 22 June." },
        { id: "forecast", title: "Staffing forecast", line: "weekend", figure: 150, kind: "estimate", note: "Forecast of 150 visitors for Saturday and Sunday, made before the weekend." },
        { id: "gazette", title: "Harbor Gazette", line: "weekend", figure: 200, kind: "report", note: "Monday’s paper reported “about 200 visitors over the weekend”." },
      ],
    },
  },
};
const img604: Case = {
  visitor: "Who took the mill photo IMG-604? The caption needs a photographer.",
  followup: "Still there? I need the photographer’s name.",
  exhibit: "Working River",
  input: {
    caseId: "IMG-604",
    pending: { text: "Checking the catalog for IMG-604 now.", call: { id: "toolu_01Ml3Rv8", name: "search_records", input: { query: "IMG-604" } } },
    output: "IMG-604 · accession A-1923-40 · “Mill race in spring”, lantern slide. Photographer’s log: exhibit file EX-117.",
    lead: "EX-117",
    next: { ask: "Look up exhibit file EX-117", subject: "exhibit",
      readOutput: "EX-117 · studio log of T. Brandt, 1923; the slide is entry 41.",
      createOutput: "Draft exhibit entry D-0423 created (title: EX-117).",
      answer: "IMG-604 is accession A-1923-40. T. Brandt made the slide in 1923; it is entry 41 in Brandt’s studio log (exhibit file EX-117)." },
    requests: [{ ask: lookupAsk("IMG-604"), intent: "lookup", subject: "exhibit" }, { ask: "Add IMG-604 to the Working River exhibit draft", intent: "create", subject: "exhibit" }],
    implementations,
    panel: {
      lines: [{ key: "saturday", title: "Saturday 5 July" }, { key: "weekend", title: "Weekend 5–6 July" }],
      records: [
        { id: "scanner", title: "Gate scanner log", line: "saturday", figure: 71, kind: "count", note: "71 ticket scans at the gate on Saturday 5 July." },
        { id: "newsletter", title: "Friends newsletter", line: "weekend", figure: 140, kind: "report", note: "The Friends newsletter reported “nearly 140 people” over the weekend." },
        { id: "note", title: "Weekend planning note", line: "weekend", figure: 160, kind: "estimate", note: "Estimated 160 attendees for Saturday and Sunday, written for staffing." },
      ],
    },
  },
};

// --- tool definitions -------------------------------------------------------------------------------------------------
const schema = (properties: Record<string, string>) => ({ type: "object", properties: Object.fromEntries(Object.entries(properties).map(([key, description]) => [key, { type: "string", description }])), required: Object.keys(properties) });
const searchSchema = schema({ query: "A catalog or exhibit-file ID, e.g. IMG-311 or EX-88" });
const draftSchema = schema({ catalog_id: "The catalog item to add, e.g. IMG-311", exhibit: "The exhibit's name" });
type ToolDef = { name: string; description: string; input_schema: unknown };
const tool = (name: string, description: string): ToolDef => ({ name, description, input_schema: name === "search_records" ? searchSchema : draftSchema });
const deployedTools = [tool("search_records", "Searches the catalog."), tool("search_exhibit", "Finds exhibit material.")];
const referenceTools = [
  tool("search_records", "Looks up existing catalog records and exhibit files by ID and returns their fields. Read-only: it never creates or changes a record. Use it whenever someone asks where an item comes from or who made it."),
  tool("create_exhibit_draft", "Creates a new draft exhibit entry for one catalog item. Use it only when a curator asks to add an item to an exhibit. It does not look up records; for lookups use search_records."),
];

// --- request.json -------------------------------------------------------------------------------------------------------
type Block = Record<string, unknown>;
const assistantTurn = (c: Case) => ({ role: "assistant", content: [{ type: "text", text: c.input.pending.text }, { type: "tool_use", ...c.input.pending.call }] });
const resultBlock = (c: Case, change: Partial<Block> = {}): Block => ({ type: "tool_result", tool_use_id: c.input.pending.call.id, content: c.input.output, ...change });
function request(c: Case, { tools = referenceTools, answer = [resultBlock(c), { type: "text", text: c.followup }] as readonly Block[] | string } = {}) {
  return compactJson({
    model: "claude-opus-5-5",
    max_tokens: 2048,
    tools,
    messages: [{ role: "user", content: c.visitor }, assistantTurn(c), { role: "user", content: answer }],
  });
}

// --- label.md ---------------------------------------------------------------------------------------------------------
const methodText: Record<string, string> = { scanner: "ticket scans at the gate", tally: "hand count at the door", note: "planning estimate",
  turnstile: "turnstile count", forecast: "staffing forecast", gazette: "newspaper report", newsletter: "newsletter report" };
const titleOf = (c: Case, key: string) => c.input.panel.lines.find((line) => line.key === key)!.title;
const row = (c: Case, entry: PanelRecord, change: Partial<Record<"line" | "figure" | "method" | "source", string>> = {}) =>
  `| ${change.line ?? titleOf(c, entry.line)} | ${change.figure ?? entry.figure} | ${change.method ?? methodText[entry.id]} | ${change.source ?? entry.title} |`;
const label = (c: Case, rows: readonly string[]) => [`# Attendance panel · ${c.input.caseId}`, "", "| Line | Figure | Method | Source |", "|---|---|---|---|", ...rows, ""].join("\n");
const referenceLabel = (c: Case) => label(c, c.input.panel.records.map((entry) => row(c, entry)));
const records = (c: Case) => Object.fromEntries(c.input.panel.records.map((entry) => [entry.id, entry]));

const reference = (c: Case): LabFiles => ({ request: request(c), label: referenceLabel(c) });

// Deployed: the loop treated "I'll check…" as the end of the turn, then appended the visitor's next message with no
// result for the pending call; the connector descriptions overlap; the panel averaged two counts and reused a count.
const starter: LabFiles = {
  request: request(img311, { tools: deployedTools, answer: img311.followup }),
  label: label(img311, ["| Saturday 14 June | 89 | visitors | Attendance records |", "| Weekend 14–15 June | 83 | visitors | Attendance records |"]),
};

// --- documents --------------------------------------------------------------------------------------------------------
function caseDocuments(c: Case): LabDocument[] {
  return [
    { id: `${c.input.caseId}-turn`, title: `Assistant turn · ${c.input.caseId} (stop_reason: "tool_use")`, format: "json", text: compactJson(assistantTurn(c)) },
    { id: `${c.input.caseId}-output`, title: `Catalog connector · what ${c.input.pending.call.id} returned`, format: "code", text: c.input.output },
    { id: `${c.input.caseId}-visitor`, title: "Visitor’s chat", text: `First message: “${c.visitor}” · After the assistant’s “${c.input.pending.text}”, nothing came back. Two minutes later: “${c.followup}”` },
    { id: `${c.input.caseId}-records`, title: "Attendance records for the panel", format: "code",
      text: c.input.panel.records.map((entry) => `${entry.title}: ${entry.note}`).join("\n") },
    { id: `${c.input.caseId}-panel`, title: "Panel layout · Tess Okafor", text: `The attendance panel has two lines: ${c.input.panel.lines.map(({ title }) => `“${title}”`).join(" and ")}. The printer reads a table with the columns Line, Figure, Method, Source, one row per figure; a line may have more than one row. Visitors read every row as printed.` },
  ];
}
const connector: LabDocument = { id: "connector", title: "Catalog connector · tools it serves",
  text: "search_records: looks up catalog records and exhibit files; changes nothing. search_exhibit: opens a new draft exhibit entry in the catalog (since v2.3 the connector also serves this tool as create_exhibit_draft). Tool names come from the connector; the descriptions Claude reads come from the tools array in your request." };
const deskRequests = (c: Case): LabDocument => ({ id: `${c.input.caseId}-desk`, title: "What the desk asks the assistant",
  text: `Look-ups, e.g. “${c.input.requests[0].ask}”. Curator requests to add items, e.g. “${c.input.requests[1].ask}”. Both kinds come in every day.` });

const fixtures: Fixture<LoopInput>[] = [
  { id: "img311", name: "IMG-311 · harbor photo", set: "sample", situation: "The assistant promised a catalog check and the visitor heard nothing back; the panel needs its Saturday and weekend figures.", input: img311.input },
  { id: "img528", name: "IMG-528 · new photo", set: "transfer", variant: "ferry", situation: "A different photo, a new pending call and a different set of attendance records.", input: img528.input },
  { id: "img604", name: "IMG-604 · new photo", set: "transfer", variant: "mill", situation: "A different photo, a new pending call and a different set of attendance records.", input: img604.input },
];

// --- checks -----------------------------------------------------------------------------------------------------------
const quote = (value: string) => `“${value.length > 90 ? value.slice(0, 87) + "…" : value}”`;
type C = Check<LoopInput, LoopOut>;
const checks: C[] = [
  {
    id: "api-accepts", objective: "1.1", title: "The API accepts the follow-up request",
    diagnosis: "stop_reason “tool_use” means Claude is waiting for your code to run the tool. The next request repeats the assistant turn as returned and starts the next user turn with a tool_result for every tool_use id. Text the visitor typed meanwhile can follow those blocks in the same turn, never precede them.",
    hints: hints("Read the 400 in the trace: which message does it point at, and what does it say is missing right after the assistant turn?",
      "Agent loop: loop on stop_reason, not on whether the reply contains text. After tool_use, append the assistant content unchanged, run each tool, and send one user turn whose content begins with the tool_result blocks (tool_use_id = the call’s id). Extra text goes after them.",
      "A ticket system’s bot asks the billing API for invoice 7 and says “one moment”. The integration posts the invoice back under the request’s id first; the customer’s “hello?” follows in the same message."),
    reveal: "Third message: { \"role\": \"user\", \"content\": [ { \"type\": \"tool_result\", \"tool_use_id\": \"<the pending call’s id>\", \"content\": \"<what the call returned>\" }, { \"type\": \"text\", \"text\": \"<the visitor’s follow-up>\" } ] }",
    evaluate: ({ out }) => out.accepted ? { passed: true, symptom: "200 · the request was accepted." }
      : { passed: false, symptom: `The API returned 400: ${out.error!.message}`, source: out.error!.source },
  },
  {
    id: "loop-continues", objective: "1.1", title: "Claude’s next turn works from the catalog record",
    diagnosis: "The result Claude continues from is only what your tool_result carries. Send the tool’s output as returned (the record with its fields), flagged as an error only when the tool failed to run. A status line or an empty block leaves Claude with nothing to reason over, so the loop ends without an answer.",
    hints: hints("Read the tool_result line in the trace and compare it with what the catalog connector returned for the pending call.",
      "Tool results are the model’s evidence: content holds the tool’s output (text or blocks), and is_error marks only an execution failure. The model decides its next step from that content, so a trimmed or mislabelled result changes what it does next.",
      "A dispatcher asks the warehouse for bin B-12’s contents and gets back “done”. Without the list, the dispatcher cannot decide what to ship."),
    reveal: "The tool_result content is the catalog’s full output for the pending call, with no is_error.",
    evaluate: ({ out }, fixture) => {
      if (!out.accepted) return null;
      const id = fixture.input.pending.call.id;
      if (!out.continued) return { passed: false, symptom: `Claude’s turn does not continue ${fixture.input.caseId}: no assistant turn in the request asks for ${id}.`, source: out.sources.request };
      const result = out.result!;
      if (result.state === "carried") return { passed: true, symptom: `Claude continued from ${fixture.input.caseId}’s record and looked up ${fixture.input.lead}.` };
      return { passed: false, source: result.source, symptom: result.state === "flagged"
        ? `Claude’s turn reports the ${fixture.input.caseId} lookup as failed, though ${fixture.input.pending.call.name} returned a record: ${quote(out.reply)}`
        : `Claude’s turn ends without a source: what it received for ${id} (${quote(result.content || "(empty)")}) never mentions ${fixture.input.lead}.` };
    },
  },
  {
    id: "lookup-read-only", objective: "2.1", title: "Look-ups go to a tool that changes nothing",
    diagnosis: "Claude picks a tool from its name and description. When two descriptions both claim to find things and one of them also writes, a look-up can land on the writing tool. Each description has to say what the tool does, what it never does, and send the other job to the other tool.",
    hints: hints("Read the routing lines at the top of the trace: for the look-up, which tools counted as candidates, and what does the chosen one do in the catalog?",
      "Tool descriptions are the main selection signal. State the tool’s job and its side effects, and draw the boundary explicitly: ‘Use X for A. It does not do B; for B use Y.’ A name that says search on a tool that writes needs that boundary in its description, or a clearer name.",
      "A calendar assistant has find_slots and book_slot. Asked when the dentist is free, it checks availability without booking, because only find_slots is described as non-booking and book_slot says it is for confirmed bookings only."),
    reveal: "search_records: “Looks up records… Read-only: it never creates or changes a record.” The draft tool: “Creates a new draft exhibit entry… It does not look up records; for lookups use search_records.”",
    evaluate: ({ out }) => {
      const wrong = [...out.routings.filter(({ request }) => request.intent === "lookup"), ...(out.next ? [out.next] : [])].find(({ effect }) => effect !== "read");
      if (!wrong) return { passed: true, symptom: "Every look-up went to a read-only lookup." };
      return { passed: false, source: wrong.source, symptom: wrong.effect === "create"
        ? `“${wrong.request.ask}” went to ${wrong.chosen}, which opened a draft exhibit entry in the catalog though nobody asked for one.`
        : wrong.chosen ? `“${wrong.request.ask}” went to ${wrong.chosen}, which the catalog connector does not serve; the call failed.`
          : `“${wrong.request.ask}” matched no offered tool; Claude answered in text without looking anything up.` };
    },
  },
  {
    id: "create-reachable", objective: "2.1", title: "A curator’s request to add an item reaches the draft tool",
    diagnosis: "Removing or muting the writing tool stops the misroute but also stops the job it exists for. The description should say when the tool is the right one, so a real request to add an item still finds it.",
    hints: hints("Read the routing line for the curator’s request to add an item: which tools did Claude consider, and what happened in the catalog?",
      "A tool boundary has two sides: the description says when to use the tool as well as when not to. A tool that is offered but describes no job, or describes every job as off limits, will not be chosen.",
      "A shop’s refund_order tool says “Use only when the customer asks for a refund on a delivered order.” Asked for a refund, the assistant uses it; asked where an order is, it does not."),
    reveal: "Offer the draft tool with a description that claims its job: “Creates a new draft exhibit entry… Use it only when a curator asks to add an item to an exhibit.”",
    evaluate: ({ out }) => {
      const wrong = out.routings.find(({ request, effect }) => request.intent === "create" && effect !== "create");
      if (!wrong) return { passed: true, symptom: "The curator’s request added the item to the exhibit draft." };
      return { passed: false, source: wrong.source, symptom: wrong.chosen
        ? `“${wrong.request.ask}” went to ${wrong.chosen}, ${wrong.effect === "read" ? "a lookup; no draft entry was added" : "which the catalog connector does not serve; the call failed"}.`
        : `“${wrong.request.ask}” matched no offered tool; Claude replied that it cannot add items, and the draft stayed empty.` };
    },
  },
  {
    id: "figures-attributed", objective: "5.6", title: "Every printed figure is the one its cited record holds, on the line that record covers",
    diagnosis: "Source provenance: a figure keeps the record it came from and the period that record measured. Averaging two records gives a number neither holds; putting a weekend figure on a one-day line (or citing a vague “records”) leaves the panel with a claim nobody can audit.",
    hints: hints("Read the panel rows in the trace next to the records they cite: does each figure appear in that record, for that line’s period?",
      "Claim–source mapping: each row carries one figure from exactly one named record, under the line whose period that record measured. Conflicting figures are not reconciled by arithmetic.",
      "A city dashboard shows a census count “2020, counted” and a projection “2025, projected” on separate rows with their sources, never one blended number."),
    reveal: "One row per record: | <the line its period covers> | <its figure> | <its method> | <its exact title> |",
    evaluate: ({ out }, fixture) => {
      const titleOf = (key: string | null) => fixture.input.panel.lines.find((line) => line.key === key)?.title ?? "none of the panel’s lines";
      const bad = out.rows.find((entry) => !entry.record || !entry.figureOk || !entry.lineOk);
      if (!bad) return { passed: true, symptom: "Each printed figure matches its record and its line." };
      const shown = `${bad.cell.line || "(no line)"} · ${bad.cell.figure || "(no figure)"}`;
      if (!bad.record) return { passed: false, source: bad.source, symptom: bad.ambiguous
        ? `The panel row “${shown}” cites several records in one source cell; visitors cannot tell which one holds the figure.`
        : `The panel row “${shown}” cites “${bad.cell.source || "(blank)"}”; no attendance record has that title.` };
      if (!bad.lineOk) return { passed: false, source: bad.source, symptom: `The panel row “${shown}” comes from ${bad.record.title}, which measured ${titleOf(bad.record.line)}.` };
      return { passed: false, source: bad.source, symptom: `The panel row “${shown}” cites ${bad.record.title}, which records ${bad.record.figure}.` };
    },
  },
  {
    id: "figures-kept", objective: "5.6", title: "Every record’s figure reaches the panel, conflicts included",
    diagnosis: "When credible records disagree (two counts by different methods, a forecast and a newspaper figure), the disagreement is information. Dropping one silently tells visitors the other is the only measure.",
    hints: hints("List the attendance records, then find each one’s figure on the panel in the trace.",
      "Conflict annotation: keep each value with its source side by side and let the method explain the difference; do not pick the ‘better’ number without saying so.",
      "A product page lists the lab’s measured battery life and the maker’s claimed figure on two labelled rows rather than printing only the bigger one."),
    reveal: "A line can carry more than one row: one per record that measured its period.",
    evaluate: ({ out }, fixture) => {
      const missing = out.dropped[0];
      if (!missing) return { passed: true, symptom: "Every record’s figure is on the panel." };
      const title = fixture.input.panel.lines.find((line) => line.key === missing.line)!.title;
      return { passed: false, source: out.sources.label, symptom: `${missing.title} (${missing.figure} for ${title}) does not appear anywhere on the panel.` };
    },
  },
  {
    id: "method-shown", objective: "5.6", title: "Each figure says how it was measured",
    diagnosis: "A count, a forecast and a newspaper report answer different questions. The method travels with the figure so a reader can weigh it; a generic word like “visitors”, or a method that contradicts the record, strips that context.",
    hints: hints("For each panel row in the trace, compare the Method cell with how the cited record produced its number.",
      "Provenance includes method and date as well as source: counted, estimated in advance, or reported by someone else. Keep the record’s own characterisation.",
      "A weather report labels tomorrow’s figure “forecast” and yesterday’s “measured”, even when both read 18 °C."),
    reveal: "Method cells such as “ticket scans at the gate”, “hand count at the door”, “planning estimate”, “newspaper report”.",
    evaluate: ({ out }) => {
      const bad = out.rows.find((entry) => entry.record && entry.figureOk && entry.lineOk && !(entry.methodKinds.length === 1 && entry.methodKinds[0] === entry.record.kind));
      if (!bad) return out.rows.some((entry) => entry.record) ? { passed: true, symptom: "Each figure says how it was measured." } : null;
      return { passed: false, source: bad.source, symptom: `Visitors read ${bad.record!.figure} (${bad.record!.title}) as “${bad.cell.method || "(blank)"}”, which does not match how ${bad.record!.title} produced it.` };
    },
  },
];

function effects(runs: readonly LabRunFixture<LoopInput, LoopOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out) return [];
    const panelOk = !out.dropped.length && out.rows.every((entry) => entry.record && entry.figureOk && entry.lineOk && entry.methodKinds.length === 1 && entry.methodKinds[0] === entry.record.kind);
    return [
      { kind: "tray" as const, item: `${fixture.input.caseId} answer`, to: out.result?.state === "carried" && out.next?.effect === "read" ? "posted" as const : "failed" as const },
      ...Array.from({ length: run.metrics.unaskedDrafts }, () => ({ kind: "tray" as const, item: "draft exhibit entry", to: "leaked" as const })),
      { kind: "tray" as const, item: `${fixture.input.caseId} attendance panel`, to: panelOk ? "posted" as const : "held" as const },
    ];
  });
}

const sample = reference(img311);
const swap = (files: LabFiles, change: Readonly<Record<string, string>>): LabFiles => ({ ...files, ...change });
const { scanner, tally, note } = records(img311);

export const librarySearchLab: LabMission<unknown, LoopInput, LoopOut> = {
  id: "library-search",
  provider: "anthropic",
  track: "architect-foundations",
  objectives: ["1.1", "2.1", "5.6"],
  station: "Catalog response and label",
  speaker: "Nolan Price",
  opening: "The assistant said it would check the catalog for IMG-311, then stopped. The panel beside the photo prints a number no record contains.",
  task: "Write the request that continues the catalog lookup, the two catalog tool definitions it offers, and the panel’s source table.",
  brief: {
    problem: "The reference assistant ended its turn on “I’ll check” and the next request was rejected; a look-up opened a draft exhibit entry; the attendance panel averages two counts.",
    move: "Read the assistant turn and what the pending call returned, then the connector notes and the attendance records. Edit request.json and label.md and run.",
    success: ["The API accepts the follow-up and Claude names the photo’s source", "0 draft entries from look-ups, while a curator’s add request still works", "Every panel figure matches one record, its period and its method"],
  },
  prebrief: {
    concept: "An agent loop keeps calling the API while stop_reason is “tool_use”: your code runs the tool and sends the result back under the call’s id. Which tool Claude reaches for depends on the names and descriptions you send. What it writes depends on the evidence you keep attached to each figure.",
    terms: [["The assistant is waiting on a lookup", "stop_reason: \"tool_use\""], ["Send the lookup’s result under its call ID", "tool_result with tool_use_id"],
      ["Say what a tool does and doesn’t do", "Tool description with an explicit boundary"], ["Keep each number with where it came from", "Source provenance (claim–source mapping)"]],
    contrast: {
      good: "A cashier who asks the stockroom for a size waits for the answer, then tells the customer what the stockroom found.",
      bad: "A cashier who says “we’re checking” and rings up the sale never tells the customer what the stockroom found.",
    },
  },
  documents: [...caseDocuments(img311), connector, deskRequests(img311)],
  artifacts: [
    { id: "request", kind: "anthropic.messages-request", path: "request.json", editor: "json",
      instruction: "The next POST /v1/messages for this visitor, as the desk’s loop sends it. The tools array is where Claude reads the connector’s descriptions.",
      starter: starter.request,
      example: compactJson({ model: "claude-opus-5-5", max_tokens: 1024,
        tools: [{ name: "find_slots", description: "Lists free appointment slots for a clinic. Read-only: it never books. For bookings use book_slot.", input_schema: { type: "object", properties: { clinic: { type: "string" } }, required: ["clinic"] } }],
        messages: [{ role: "user", content: "When is the dentist free?" },
          { role: "assistant", content: [{ type: "text", text: "Let me check." }, { type: "tool_use", id: "toolu_ex7", name: "find_slots", input: { clinic: "dental" } }] },
          { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_ex7", content: "Tue 09:00, Thu 14:30" }, { type: "text", text: "Any luck?" }] }] }) },
    { id: "label", kind: "claim-table", path: "exhibit/label.md", editor: "markdown",
      instruction: "The attendance panel’s source table. The printer prints every row; visitors read Figure, Method and Source together.",
      starter: starter.label,
      example: "| Line | Figure | Method | Source |\n|---|---|---|---|\n| Monday 3 March | 41 | badge swipes | Front door log |\n| March | 900 | budget projection | Spring plan |" },
  ],
  engine: agentLoopEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { ferry: [...caseDocuments(img528), connector, deskRequests(img528)], mill: [...caseDocuments(img604), connector, deskRequests(img604)] },
  checks,
  prediction: {
    prompt: "How many draft exhibit entries will appear that nobody asked for?", unit: "entries",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.unaskedDrafts ?? 0), 0),
  },
  effects,
  reference: { sample, transfer: { ferry: reference(img528), mill: reference(img604) } },
  mutants: [
    { name: "visitor text before the tool_result", set: "sample", mustFail: ["api-accepts"],
      edit: (files) => swap(files, { request: request(img311, { answer: [{ type: "text", text: img311.followup }, resultBlock(img311)] }) }) },
    { name: "result trimmed to a status line", set: "sample", mustFail: ["loop-continues"],
      edit: (files) => swap(files, { request: request(img311, { answer: [resultBlock(img311, { content: "Found 1 record." })] }) }) },
    { name: "successful lookup flagged as an error", set: "sample", mustFail: ["loop-continues"],
      edit: (files) => swap(files, { request: request(img311, { answer: [resultBlock(img311, { is_error: true })] }) }) },
    { name: "draft tool claims to find and create", set: "sample", mustFail: ["lookup-read-only"],
      edit: (files) => swap(files, { request: request(img311, { tools: [referenceTools[0], tool("search_exhibit", "Finds exhibit material and opens a draft entry for it.")] }) }) },
    { name: "draft tool removed", set: "sample", mustFail: ["create-reachable"],
      edit: (files) => swap(files, { request: request(img311, { tools: [referenceTools[0]] }) }) },
    { name: "draft tool described as off limits", set: "sample", mustFail: ["create-reachable"],
      edit: (files) => swap(files, { request: request(img311, { tools: [referenceTools[0], tool("search_exhibit", "Internal connector action. Do not use it to search or to create anything.")] }) }) },
    { name: "Saturday counts averaged", set: "sample", mustFail: ["figures-attributed", "figures-kept"],
      edit: (files) => swap(files, { label: label(img311, [row(img311, scanner, { figure: "89" }), row(img311, note)]) }) },
    { name: "docent tally dropped", set: "sample", mustFail: ["figures-kept"],
      edit: (files) => swap(files, { label: label(img311, [row(img311, scanner), row(img311, note)]) }) },
    { name: "weekend estimate printed on the Saturday line too", set: "sample", mustFail: ["figures-attributed"],
      edit: (files) => swap(files, { label: label(img311, [row(img311, scanner), row(img311, tally), row(img311, note), row(img311, note, { line: "Saturday 14 June" })]) }) },
    { name: "estimate labelled as a head count", set: "sample", mustFail: ["method-shown"],
      edit: (files) => swap(files, { label: label(img311, [row(img311, scanner), row(img311, tally), row(img311, note, { method: "head count" })]) }) },
    { name: "newspaper figure dropped", set: "transfer", variant: "ferry", mustFail: ["figures-kept"],
      edit: (files) => swap(files, { label: label(img528, img528.input.panel.records.filter(({ id }) => id !== "gazette").map((entry) => row(img528, entry))) }) },
    { name: "result sent under the sample’s call id", set: "transfer", variant: "mill", mustFail: ["api-accepts"],
      edit: (files) => swap(files, { request: request(img604, { answer: [resultBlock(img604, { tool_use_id: img311.input.pending.call.id })] }) }) },
  ],
  probes: [
    { name: "sample request and panel replayed on the new photo", set: "transfer", variant: "ferry", files: () => sample, mustFail: "any" },
    { name: "every verb claimed and denied in both descriptions", set: "sample", mustFail: ["lookup-read-only"],
      files: (files) => swap(files, { request: request(img311, { tools: [
        tool("search_records", "Searches, finds, looks up, reads and creates drafts. Never searches, finds, reads or creates."),
        tool("create_exhibit_draft", "Searches, finds, looks up, reads and creates drafts. Never searches, finds, reads or creates.")] }) }) },
    { name: "every record named in one source cell", set: "sample", mustFail: ["figures-attributed"],
      files: (files) => swap(files, { label: label(img311, [row(img311, scanner, { source: "Gate scanner log, Docent door tally, Weekend planning note" }), row(img311, tally), row(img311, note)]) }) },
  ],
  fixTerms: ["is_error"],
  debrief: "stop_reason “tool_use” is a request for your code to act, so the loop runs search_records and sends its output back as a tool_result under the call’s id, first in the next user turn, before the visitor’s new text. Claude then continues from the record and looks up the exhibit file. The tool descriptions draw the boundary both ways (search_records is read-only and says so; the draft tool claims only adding items and refers look-ups away), so a look-up never opens a draft and a curator’s request still reaches it. The panel keeps a claim–source mapping: one row per record, under the line its period covers, with its own method, conflicts kept side by side.",
};
