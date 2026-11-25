// Developer Foundations · supplier-invoices. The learner writes the extraction request's output_config (a JSON Schema
// for structured outputs) and the importer's posting rule (a line-sum check in a small expression language plus the
// note staff see on a held invoice). The engine validates output_config like the API, plays a recorded extraction
// through the schema (constrained decoding fills whatever the schema demands), then runs the rule. Transfer (rerun,
// hidden): next week's invoices with a delivery fee, a credit line, mismatches in both directions and another smudge.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { structuredOutputEngine } from "../engines/structured-output";
import type { InvoiceInput, InvoiceOut, SourceInvoice } from "../engines/structured-output";
import { show } from "../engines/rule-expression";
import type { Check, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const invoice = (id: string, supplier: string, lines: readonly [string, number][], printed: number | null): SourceInvoice =>
  ({ id, supplier, lines: lines.map(([description, cents]) => ({ description, cents })), printed });

const sample = [
  invoice("302", "Mill & Grain", [["flour, 4 sacks", 4200], ["eggs, 6 trays", 1800]], 6000),
  invoice("303", "Dairy Row", [["butter, 10 kg", 7900], ["cream, 12 L", 2100]], 11000),
  invoice("318", "Harbor Produce", [["lemons, 2 cases", 2450], ["herbs, 8 bunches", 1600]], null),
];
const fees = [
  invoice("411", "Coast Fish", [["cod, 6 kg", 3200], ["mussels, 3 kg", 1450], ["delivery fee", 500]], 5150),
  invoice("412", "Hill Bakery", [["rye loaves, 40", 4100], ["dinner rolls, 200", 3500]], 7300),
  invoice("413", "Spice Yard", [["saffron, 20 g", 2250], ["black pepper, 1 kg", 900]], null),
];
const credit = [
  invoice("521", "Dairy Row", [["milk, 60 L", 4800], ["returned crates (credit)", -600]], 4200),
  invoice("522", "Mill & Grain", [["semolina, 2 sacks", 1999], ["paper bag", 1]], 2000),
  invoice("523", "Orchard Lane", [["apples, 3 crates", 5100], ["pears, 2 crates", 3000]], 9000),
  invoice("524", "Harbor Produce", [["limes, 1 case", 1250], ["mint, 10 bunches", 700]], null),
];

const fixtures: Fixture<InvoiceInput>[] = [
  { id: "week-47", name: "This week’s supplier copies · 302, 303, 318", set: "sample", situation: "One invoice agrees with its items, one does not, and one printed total is smudged.", input: { invoices: sample } },
  { id: "week-48-fees", name: "Next week · 411–413", set: "transfer", variant: "fees", situation: "Another week: a delivery fee line, a printed total lower than its items, and another smudge.", input: { invoices: fees } },
  { id: "week-48-credit", name: "Next week · 521–524", set: "transfer", variant: "credit", situation: "Another week: a credit line, a one-cent line, a printed total higher than its items, and a smudge.", input: { invoices: credit } },
];

const lineItem = { type: "object", additionalProperties: false, required: ["description", "amount_cents"],
  properties: { description: { type: "string" }, amount_cents: { type: "integer" } } };
const configFile = ({ total = { type: ["integer", "null"] } as Record<string, unknown>, status = ["printed", "unreadable"] as string[] | null, item = lineItem as Record<string, unknown>, type = "json_schema" } = {}) =>
  compactJson({ format: { type, schema: {
    type: "object", additionalProperties: false,
    required: ["invoice_id", "lines", "total_cents", ...(status ? ["total_status"] : [])],
    properties: { invoice_id: { type: "string" }, lines: { type: "array", items: item }, total_cents: total, ...(status && { total_status: { type: "string", enum: status } }) },
  } } });
const referenceNote = "Invoice {invoice_id} · printed: {total_cents} ({total_status}) · items add up to: {sum(lines[].amount_cents)}";
const referencePost = "total_status == \"printed\" && total_cents == sum(lines[].amount_cents)";
const ruleFile = (postWhen: string, note = referenceNote) => compactJson({ post_when: postWhen, review_note: note });
const reference: LabFiles = { format: configFile(), rule: ruleFile(referencePost) };
// Deployed: the schema guarantees integer cents (so a smudged total must become a number) and the importer only
// checks that the printed total is a valid amount.
const starter: LabFiles = {
  format: configFile({ total: { type: "integer" }, status: null }),
  rule: ruleFile("total_cents >= 0", "Invoice {invoice_id} needs a look."),
};

type C = Check<InvoiceInput, InvoiceOut>;
const ready = (out: InvoiceOut) => out.accepted && out.structured;
const cents = (value: unknown) => typeof value === "number" ? `${value}¢` : show(value as never);
const checks: C[] = [
  {
    id: "output-parses", objective: "6.3", title: "Every invoice reaches the importer as JSON with a printed total and line amounts",
    diagnosis: "Structured outputs (output_config.format with type \"json_schema\") make Claude’s reply valid JSON that matches your schema. The API only accepts schemas it can compile: every object must set additionalProperties to false. Without a format, a reply is prose that code cannot rely on.",
    hints: hints("Read the first lines of the trace: was the request accepted, and what did the importer receive for each invoice?",
      "JSON outputs: output_config: { format: { type: \"json_schema\", schema } }. The schema needs a field for each value your code uses (here the printed total and every line amount), and each object in it is closed with additionalProperties: false.",
      "A timesheet form with a box for each day’s hours and a box for the weekly total lets payroll add up the days; a form with one free-text box does not."),
    reveal: "{ \"format\": { \"type\": \"json_schema\", \"schema\": { …, \"additionalProperties\": false, \"properties\": { \"total_cents\": …, \"lines\": { \"type\": \"array\", \"items\": { …closed object with amount_cents… } } } } } }",
    evaluate: ({ out }) => {
      if (!out.accepted) return { passed: false, symptom: `The request was rejected before Claude saw an invoice: ${out.error!.message}`, source: out.error!.source };
      if (!out.structured) return { passed: false, symptom: "Claude answered every invoice in prose and the importer could not parse any of them.", source: out.sources.format };
      if (out.missing.length) return { passed: false, symptom: `Claude’s output has no field for ${out.missing.join(" or ")}, so the importer has nothing to compare.`, source: out.sources.format };
      return { passed: true, symptom: "Every invoice arrived as JSON with its printed total and line amounts." };
    },
  },
  {
    id: "no-bad-post", objective: "6.3", title: "0 invoices posted with a total their items don’t support",
    diagnosis: "A schema guarantees types and required fields, not that the numbers are true: 11000 is a perfectly valid integer. Agreement between the printed total and the line items is a business invariant, so application code recomputes the sum and compares before the ledger write.",
    hints: hints("Find the invoice that reached the ledger with the wrong amount. What did post_when actually compare?",
      "Application-level validation after structured output: recompute what the source data implies (sum the line amounts) and post only when the printed total equals it. Anything else is held with both numbers. A tolerance or a type check lets a real disagreement through.",
      "An expense app sums the itemized lines of each receipt and only auto-approves when that sum equals the receipt total; every amount being a valid number is not enough."),
    reveal: "\"post_when\": \"<the printed total field> == sum(lines[].amount_cents)\" (and the total is known to be printed).",
    evaluate: ({ out }) => {
      if (!ready(out)) return null;
      const bad = out.invoices.find(({ decision, truth, fabricated }) => decision === "posted" && (truth !== "agree" || fabricated));
      if (!bad) return { passed: true, symptom: "Only invoices whose items match their printed total reached the ledger." };
      return { passed: false, source: out.sources.rule, symptom: bad.truth === "mismatch"
        ? `Invoice ${bad.id} is in the ledger at ${cents(bad.totalOut)}, but its items add up to ${bad.computed}¢.`
        : `Invoice ${bad.id} is in the ledger at ${cents(bad.totalOut)}, but its printed total is smudged: nobody can read what the supplier charged.` };
    },
  },
  {
    id: "agreeing-posts", objective: "6.3", title: "Invoices whose items match their printed total post without a review",
    diagnosis: "The check has to let correct records through, or staff review everything and the automation is gone. The rule must read the fields your schema actually defines, and compare exactly what the source implies, including fee and credit lines.",
    hints: hints("Open the post_when line for the invoice that was held. Which values did the rule read, and is any of them null?",
      "The importer reads Claude’s output by your schema’s field names; a name the schema does not define reads as null, and null never equals a number. Sum every line, negative credits and fees included.",
      "A spreadsheet formula that points at column F while the totals live in column G marks every row as wrong."),
    reveal: "Use the exact field names from your schema in post_when, and sum every line amount.",
    evaluate: ({ out }) => {
      if (!ready(out)) return null;
      const agreeing = out.invoices.filter(({ truth }) => truth === "agree");
      if (!agreeing.length) return null;
      const held = agreeing.find(({ decision }) => decision !== "posted");
      return held ? { passed: false, symptom: `Invoice ${held.id}’s items add up to its printed ${held.printed}¢, yet it went to staff review instead of the ledger.`, source: out.sources.rule }
        : { passed: true, symptom: `${agreeing.map(({ id }) => id).join(", ")} posted at ${agreeing.length === 1 ? "its printed total" : "their printed totals"}.` };
    },
  },
  {
    id: "unreadable-kept", objective: "6.3", title: "An illegible total stays unknown and keeps its source status",
    diagnosis: "Constrained decoding makes Claude produce whatever the schema requires. If the printed total must be an integer, a smudged figure still comes back as a number, invented from the items. Let the field be null and add a status value for “unreadable”, so the output can say what the source really shows; then hold the record.",
    hints: hints("Read Claude’s output for the smudged invoice. Where did its total come from, and what does the output say about legibility?",
      "Design the schema for the unknown state: a nullable total (type [\"integer\", \"null\"]) plus an enum status such as printed / unreadable. A required non-null field forces a value; a missing status loses the fact that the source was illegible.",
      "A medical intake form has a “dose unreadable” checkbox next to the dose box, so a smudged prescription is recorded as unreadable instead of as the usual dose."),
    reveal: "\"total_cents\": { \"type\": [\"integer\", \"null\"] } and a required status field with an enum that includes an unreadable value.",
    evaluate: ({ out }) => {
      if (!ready(out)) return null;
      const smudged = out.invoices.filter(({ truth }) => truth === "unreadable");
      if (!smudged.length) return null;
      for (const entry of smudged) {
        if (entry.fabricated) return { passed: false, symptom: `Claude’s output for invoice ${entry.id} has a printed total of ${cents(entry.totalOut)}, a figure the supplier never printed: the printed total is smudged.`, source: out.sources.format };
        if (entry.decision === "posted") return { passed: false, symptom: `Invoice ${entry.id} posted although nobody can read its printed total.`, source: out.sources.rule };
        if (entry.statusKind !== "unreadable") return { passed: false, symptom: `Invoice ${entry.id} went to review, but nothing in Claude’s output records that its printed total was unreadable${entry.statusOut ? ` (status: “${entry.statusOut}”)` : ""}.`, source: out.sources.format };
      }
      return { passed: true, symptom: `${smudged.map(({ id }) => id).join(", ")} kept an unknown total marked unreadable and went to staff.` };
    },
  },
  {
    id: "review-note", objective: "6.3", title: "A held invoice reaches staff with the printed figure and the items’ sum",
    diagnosis: "Holding a record is only useful if the reviewer can act: the ledger procedure asks for the source value and the computed value side by side. Fill the review note from the extracted fields and the recomputed sum, never from one of them alone.",
    hints: hints("Read the staff review lines in the trace. Could Arturo decide what to do from that note alone?",
      "Exception handling keeps both sides of a failed invariant: what the source says (the printed total, or that it is unreadable) and what you computed (the sum of the lines). A template placeholder can hold an expression such as a sum.",
      "A bank flags a deposit whose slip says $500 while the counted cash is $450, and the flag shows both numbers to the teller."),
    reveal: "\"review_note\": \"… printed: {total_cents} ({status}) · items add up to: {sum(lines[].amount_cents)}\"",
    evaluate: ({ out }) => {
      if (!ready(out)) return null;
      const held = out.invoices.filter(({ decision, truth }) => decision === "held" && truth !== "agree");
      if (!held.length) return null;
      for (const entry of held) {
        const note = entry.note ?? "";
        const sum = note.includes(String(entry.computed));
        const printed = entry.printed !== null ? note.includes(String(entry.printed)) : /null|unread|illegib|smudg/i.test(note);
        if (!sum || !printed) {
          const what = !sum && !printed ? "either amount" : !sum ? "the amount the items add up to" : entry.printed === null ? "that the printed total is unreadable" : "what the supplier printed";
          return { passed: false, symptom: `Staff opened invoice ${entry.id} and read “${note || "(empty)"}”: it does not show ${what}.`, source: out.sources.note };
        }
      }
      return { passed: true, symptom: "Every held invoice shows the printed figure and the items’ sum." };
    },
  },
];

function effects(runs: readonly LabRunFixture<InvoiceInput, InvoiceOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out?.accepted) return [{ kind: "tray" as const, item: `${fixture.name}: extraction`, to: "failed" as const }];
    return [
      ...out.invoices.map(({ id, decision, truth, fabricated }) => ({ kind: "tray" as const, item: `Invoice ${id}`,
        to: decision === "unparsed" ? "failed" as const : decision === "held" ? "held" as const : truth === "agree" && !fabricated ? "posted" as const : "leaked" as const })),
      { kind: "meter" as const, id: `${fixture.id}-wrong`, label: "cents posted without support", value: run?.metrics.wrongCents ?? 0, unit: "¢" },
    ];
  });
}

const supplierCopies = sample.map(({ id, supplier, lines, printed }) =>
  `Invoice ${id} · ${supplier}\n${lines.map(({ description, cents: amount }) => `   ${description.padEnd(22)} ${amount}¢`).join("\n")}\n   Printed total          ${printed === null ? "▒▒▒▒¢ (smudged)" : `${printed}¢`}`).join("\n\n");

export const supplierInvoicesLab: LabMission<unknown, InvoiceInput, InvoiceOut> = {
  id: "supplier-invoices",
  provider: "anthropic",
  track: "developer-foundations",
  objectives: ["6.3"],
  station: "Invoice terminal",
  speaker: "Lina Ortiz",
  opening: "The importer accepted invoice 303. The printed total is valid JSON and still charges us ten dollars too much.",
  task: "Write the extraction’s output_config and the importer’s posting rule, then run this week’s supplier copies.",
  brief: {
    problem: "Invoice 303 passed the importer even though its printed total disagrees with its items, and last month a smudged total was replaced by a number nobody printed.",
    move: "Read the supplier copies and the ledger procedure, then how extract-invoice.ts uses your two files. Edit them and run the week.",
    success: ["0 invoices posted with a total their items don’t support", "Invoices that agree post without review", "An illegible total stays unknown and is marked unreadable", "Held invoices show staff both amounts"],
  },
  prebrief: {
    concept: "Structured outputs guarantee a response matches a JSON schema: types and required fields. They do not make the numbers true. Business rules such as “the total equals the sum of the lines” need their own check in application code.",
    terms: [["Right fields and types", "JSON schema in output_config.format"], ["Numbers that agree with each other", "Application-level validation"],
      ["Keep an illegible value as unknown", "Nullable field plus a status enum"], ["Schema the API can compile", "additionalProperties: false on every object"]],
    contrast: {
      good: "An expense app accepts a receipt only when the itemized amounts add up to its total, even though every amount is a valid number.",
      bad: "An expense app that only checks each amount is a number accepts a receipt totalling $50 for $40 of items.",
    },
  },
  documents: [
    { id: "copies", title: "This week’s supplier copies", format: "code", text: supplierCopies },
    { id: "procedure", title: "Ledger procedure", text: "Records whose printed total agrees with their items post. Disagreements and illegible totals go to staff with the printed value (or the fact that it is unreadable) and the computed value. Never replace what the supplier printed." },
    { id: "importer", title: "extract-invoice.ts · how your files are used", text: "Each scan goes to POST /v1/messages with output_config from invoice-output-config.json. Claude fills each schema field from its name and the scan. The importer then evaluates post_when from posting-rule.json against Claude’s output: true posts the invoice at its printed total; anything else sends it to staff review with review_note, where every {…} is filled in.\nRule language: field names from your schema; lines[].amount_cents collects one field from every line; sum(), abs(), count(); == != < <= > >= && || ! + - *; numbers, \"strings\", true, false, null. A field Claude left out reads as null." },
  ],
  artifacts: [
    { id: "format", kind: "json-schema", path: "invoice-output-config.json", editor: "json", instruction: "The output_config sent with every extraction request.",
      starter: starter.format, example: compactJson({ format: { type: "json_schema", schema: { type: "object", additionalProperties: false, required: ["sku", "count"],
        properties: { sku: { type: "string" }, count: { type: ["integer", "null"] }, shelf: { type: "string", enum: ["front", "back"] } } } } }) },
    { id: "rule", kind: "error-contract", path: "posting-rule.json", editor: "json", instruction: "When the importer may post an invoice, and the note staff see when it may not.",
      starter: starter.rule, example: compactJson({ post_when: "count != null && count <= max(bins[].capacity)", review_note: "SKU {sku}: counted {count}, largest bin {max(bins[].capacity)}" }) },
  ],
  engine: structuredOutputEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many of this week’s 3 invoices will post to the ledger?", unit: "invoices",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + ((entry?.out as InvoiceOut | undefined)?.invoices.filter(({ decision }) => decision === "posted").length ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { fees: reference, credit: reference } },
  mutants: [
    { name: "line-item object left open", set: "sample", mustFail: ["output-parses"], edit: (files) => ({ ...files, format: configFile({ item: (({ additionalProperties: _closed, ...open }) => open)(lineItem) }) }) },
    { name: "format type other than json_schema", set: "sample", mustFail: ["output-parses"], edit: (files) => ({ ...files, format: configFile({ type: "json" }) }) },
    { name: "no output_config.format", set: "sample", mustFail: ["output-parses"], edit: (files) => ({ ...files, format: "{}" }) },
    { name: "a 1000¢ tolerance", set: "sample", mustFail: ["no-bad-post"], edit: (files) => ({ ...files, rule: ruleFile("total_status == \"printed\" && abs(total_cents - sum(lines[].amount_cents)) <= 1000") }) },
    { name: "rule reads a field the schema doesn’t have", set: "sample", mustFail: ["agreeing-posts"], edit: (files) => ({ ...files, rule: ruleFile("total == sum(lines[].amount_cents)") }) },
    { name: "total must be an integer", set: "sample", mustFail: ["unreadable-kept"], edit: (files) => ({ ...files, format: configFile({ total: { type: "integer" } }) }) },
    { name: "status with no unreadable value", set: "sample", mustFail: ["unreadable-kept"], edit: (files) => ({ ...files, format: configFile({ status: ["printed"] }) }) },
    { name: "note without the items’ sum", set: "sample", mustFail: ["review-note"], edit: (files) => ({ ...files, rule: ruleFile(referencePost, "Invoice {invoice_id} · printed: {total_cents} ({total_status})") }) },
    { name: "first and largest line only", set: "transfer", variant: "fees", mustFail: ["agreeing-posts"], edit: (files) => ({ ...files, rule: ruleFile("total_status == \"printed\" && total_cents == max(lines[].amount_cents) + min(lines[].amount_cents)") }) },
  ],
  probes: [
    { name: "hold everything", set: "sample", mustFail: ["agreeing-posts"], files: (files) => ({ ...files, rule: ruleFile("false") }) },
    { name: "status alone decides", set: "sample", mustFail: ["no-bad-post"], files: (files) => ({ ...files, rule: ruleFile("total_status == \"printed\"") }) },
  ],
  overfit: { ...reference, rule: ruleFile("total_cents != 11000 && total_cents != null") },
  fixTerms: ["\"null\"", "anyOf"],
  debrief: "output_config.format carries a closed JSON Schema (additionalProperties: false on every object) with the line amounts, a nullable printed total and a printed/unreadable status, so a smudged total comes back as null instead of a number Claude had to invent. The importer then enforces the invariant the schema cannot express: it posts only when the printed total equals sum(lines[].amount_cents), and holds everything else with the printed figure and the computed sum side by side.",
};
