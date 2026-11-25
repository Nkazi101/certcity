// Structured outputs + application-level validation. The learner's output_config is checked the way the Messages API
// checks it (format.type "json_schema", every object closed with additionalProperties: false), then a recorded
// extraction is played through the schema: Claude fills each field from its name and the scan, and constrained
// decoding forces whatever the schema demands (a required integer total on a smudged invoice gets a number).
// The importer then evaluates the learner's posting rule (rule-expression.ts) and renders the staff review note.
import { list, openObjects, record, text, validateSchema } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import { compileExpression, compileTemplate, evaluate, renderTemplate, show } from "./rule-expression";
import type { Compiled, CompiledTemplate } from "./rule-expression";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type InvoiceLine = { description: string; cents: number };
export type SourceInvoice = {
  id: string; supplier: string; lines: readonly InvoiceLine[];
  /** The printed total in cents, or null when the printed figure is smudged. */
  printed: number | null;
};
export type InvoiceInput = { invoices: readonly SourceInvoice[] };
export type Truth = "agree" | "mismatch" | "unreadable";

export type InvoiceOutcome = {
  id: string;
  truth: Truth;
  computed: number;
  printed: number | null;
  output: Record<string, unknown> | null;
  /** The value Claude wrote in the printed-total field (undefined when it left the field out). */
  totalOut: unknown;
  fabricated: boolean;
  statusOut: string | null;
  statusKind: "unreadable" | "printed" | "none";
  decision: "posted" | "held" | "unparsed";
  note: string | null;
};

export type InvoiceOut = {
  accepted: boolean;
  structured: boolean;
  error?: { message: string; source: TraceSource };
  /** What the importer needs that Claude's output never contains. */
  missing: readonly string[];
  invoices: readonly InvoiceOutcome[];
  sources: { format: TraceSource; rule: TraceSource; note: TraceSource };
};

type Parsed = { config: LocatedJson; rule: LocatedJson; postWhen: Compiled; note: CompiledTemplate };

const unreadableWord = /unread|illegib|smudg|unknown|blur|not_?legible|missing/i;
const printedWord = /print|legib|clear|read|ok|present|valid|visible/i;
const computedWord = /computed|calc|sum|expected|derived/i;

const typesOf = (node: Record<string, unknown> | null): string[] => {
  if (!node) return [];
  const own = Array.isArray(node.type) ? node.type.map(String) : typeof node.type === "string" ? [node.type] : [];
  const options = list(node.anyOf).flatMap((option) => typesOf(record(option)));
  return [...own, ...options, ...(node.const === null ? ["null"] : [])];
};
const enumOf = (node: Record<string, unknown> | null): string[] => [
  ...list(node?.enum).filter((value): value is string => typeof value === "string"),
  ...list(node?.anyOf).flatMap((option) => enumOf(record(option))),
];
const numberType = (types: readonly string[]) => types.includes("integer") || types.includes("number");

type Fields = {
  total: string | null; totalTypes: string[]; totalRequired: boolean;
  computed: string | null;
  lines: string | null; amount: string | null; description: string | null;
  status: string | null; statusValues: string[]; statusRequired: boolean;
  id: string | null; supplier: string | null;
};

function fieldsOf(schema: Record<string, unknown>): Fields {
  const properties = Object.entries(record(schema.properties) ?? {}).map(([key, node]) => [key, record(node)] as const);
  const required = new Set(list(schema.required).map(String));
  const find = (test: (key: string, node: Record<string, unknown> | null) => boolean) => properties.find(([key, node]) => test(key, node))?.[0] ?? null;
  const totalName = (key: string, node: Record<string, unknown> | null) => /total|printed|grand|amount_due|balance/i.test(key) && !computedWord.test(key) && !enumOf(node).length;
  const total = find((key, node) => totalName(key, node) && numberType(typesOf(node))) ?? find((key, node) => totalName(key, node) && typesOf(node).includes("string"));
  const computed = find((key, node) => computedWord.test(key) && numberType(typesOf(node)));
  const lines = find((_, node) => typesOf(node).includes("array") && !!record(record(node?.items)?.properties));
  const item = record(record(properties.find(([key]) => key === lines)?.[1]?.items)?.properties) ?? {};
  const itemKeys = Object.entries(item).map(([key, node]) => [key, record(node)] as const);
  const amount = itemKeys.find(([key, node]) => /amount|cents|price|cost|total|value/i.test(key) && numberType(typesOf(node)))?.[0] ?? null;
  const description = itemKeys.find(([key, node]) => /desc|item|name|product|label/i.test(key) && typesOf(node).includes("string"))?.[0] ?? null;
  const status = find((key, node) => enumOf(node).length > 0 && /status|legib|read|state|quality/i.test(key));
  const statusNode = properties.find(([key]) => key === status)?.[1] ?? null;
  return {
    total, totalTypes: typesOf(properties.find(([key]) => key === total)?.[1] ?? null), totalRequired: !!total && required.has(total),
    computed, lines, amount, description,
    status, statusValues: enumOf(statusNode), statusRequired: !!status && required.has(status),
    id: find((key, node) => /invoice|number|^id$/i.test(key) && typesOf(node).includes("string")),
    supplier: find((key, node) => /supplier|vendor/i.test(key) && typesOf(node).includes("string")),
  };
}

/** A value of the right type for a required field Claude has nothing to put in. */
function filler(node: Record<string, unknown> | null): unknown {
  const values = list(node?.enum);
  if (values.length) return values[0];
  if (node?.const !== undefined) return node.const;
  const types = typesOf(node);
  if (types.includes("null")) return null;
  if (types.includes("string")) return "";
  if (numberType(types)) return 0;
  if (types.includes("boolean")) return false;
  if (types.includes("array")) return [];
  return {};
}

/** Simulated extraction: what Claude writes for one invoice under this schema. */
function extract(schema: Record<string, unknown>, fields: Fields, invoice: SourceInvoice) {
  const computed = invoice.lines.reduce((total, { cents }) => total + cents, 0);
  const output: Record<string, unknown> = {};
  let fabricated = false;
  const properties = record(schema.properties) ?? {};
  const required = new Set(list(schema.required).map(String));
  for (const [key, raw] of Object.entries(properties)) {
    const node = record(raw);
    const types = typesOf(node);
    if (key === fields.total) {
      if (invoice.printed !== null) output[key] = types.includes("string") && !numberType(types) ? (invoice.printed / 100).toFixed(2) : invoice.printed;
      else if (types.includes("null")) output[key] = null;
      else if (required.has(key)) {
        // Constrained decoding: the field must hold a number, so Claude supplies the most plausible one.
        output[key] = numberType(types) ? computed : (computed / 100).toFixed(2);
        fabricated = true;
      }
    } else if (key === fields.computed) output[key] = computed;
    else if (key === fields.lines) {
      const itemNode = record(node?.items);
      const itemProps = record(itemNode?.properties) ?? {};
      const itemRequired = new Set(list(itemNode?.required).map(String));
      output[key] = invoice.lines.map((line) => Object.fromEntries(Object.entries(itemProps).flatMap(([name, child]) =>
        name === fields.amount ? [[name, line.cents]] : name === fields.description ? [[name, line.description]]
          : itemRequired.has(name) ? [[name, filler(record(child))]] : [])));
    } else if (key === fields.status) {
      const unreadable = fields.statusValues.find((value) => unreadableWord.test(value));
      const printed = fields.statusValues.find((value) => !unreadableWord.test(value) && printedWord.test(value))
        ?? fields.statusValues.find((value) => !unreadableWord.test(value));
      const chosen = invoice.printed === null ? unreadable ?? (required.has(key) ? fields.statusValues[0] : undefined)
        : printed ?? (required.has(key) ? fields.statusValues[0] : undefined);
      if (chosen !== undefined) output[key] = chosen;
    } else if (key === fields.id) output[key] = invoice.id;
    else if (key === fields.supplier) output[key] = invoice.supplier;
    else if (required.has(key)) output[key] = filler(node);
  }
  return { output, fabricated, computed };
}

export const structuredOutputEngine: Engine<Parsed, InvoiceInput, InvoiceOut> = {
  id: "anthropic.structured-output-import",
  provider: "anthropic",
  label: "Messages API output_config validator · recorded extraction under your schema · importer rule",
  simulated: false,
  parse(files) {
    const config = parseLocatedJson(files.format, "invoice-output-config.json");
    if (config.error !== undefined) return { ok: false, error: config.error, source: { artifact: "format" } };
    if (!record(config.value.value)) return { ok: false, error: "invoice-output-config.json must be a JSON object (the value of output_config).", source: { artifact: "format", line: 1 } };
    const rule = parseLocatedJson(files.rule, "posting-rule.json");
    if (rule.error !== undefined) return { ok: false, error: rule.error, source: { artifact: "rule" } };
    const ruleObject = record(rule.value.value);
    if (!ruleObject) return { ok: false, error: "posting-rule.json must be a JSON object with post_when and review_note.", source: { artifact: "rule", line: 1 } };
    const at = (key: string): TraceSource => ({ artifact: "rule", pointer: pointer(key), line: lineOf(rule.value, pointer(key)) });
    if (typeof ruleObject.post_when !== "string") return { ok: false, error: "posting-rule.json needs post_when: an expression that is true for invoices that may post.", source: at("post_when") };
    let postWhen: Compiled;
    try {
      postWhen = compileExpression(ruleObject.post_when);
    } catch (error) {
      return { ok: false, error: `post_when cannot be read: ${(error as Error).message}.`, source: at("post_when") };
    }
    let note: CompiledTemplate;
    try {
      note = compileTemplate(text(ruleObject.review_note));
    } catch (error) {
      return { ok: false, error: `review_note cannot be read: ${(error as Error).message}.`, source: at("review_note") };
    }
    return { ok: true, value: { config: config.value, rule: rule.value, postWhen, note } };
  },
  run({ config, rule, postWhen, note }, fixture: Fixture<InvoiceInput>): EngineRun<InvoiceOut> {
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const formatAt = (path: string): TraceSource => ({ artifact: "format", pointer: path, line: lineOf(config, path) });
    const ruleAt = (key: string): TraceSource => ({ artifact: "rule", pointer: pointer(key), line: lineOf(rule, pointer(key)) });
    const sources = { format: formatAt("/format"), rule: ruleAt("post_when"), note: ruleAt("review_note") };
    const base: InvoiceOut = { accepted: false, structured: false, missing: [], invoices: [], sources };
    const format = record(record(config.value)?.format);
    const schema = record(format?.schema);

    // --- request validation, as the Messages API does it ---
    let error: InvoiceOut["error"];
    if (format && format.type !== "json_schema") error = { message: `400 invalid_request_error · output_config.format.type: “${text(format.type) || String(format.type)}” is not a supported format; use "json_schema".`, source: formatAt("/format/type") };
    else if (format && !schema) error = { message: "400 invalid_request_error · output_config.format.schema: a JSON Schema object is required.", source: formatAt("/format") };
    else if (schema) {
      const open = openObjects(schema, "schema")[0];
      if (open) {
        const path = "/format" + open.replace(/^schema/, "/schema").replace(/\.properties\./g, "/properties/").replace(/\.items/g, "/items").replace(/\.\$defs\./g, "/$defs/").replace(/\.anyOf\[(\d+)\]/g, "/anyOf/$1");
        error = { message: `400 invalid_request_error · output_config.format.schema: For 'object' type, 'additionalProperties' must be explicitly set to false (at ${open}).`, source: formatAt(path) };
      } else if (!typesOf(schema).includes("object")) error = { message: "400 invalid_request_error · output_config.format.schema: the top-level schema must be an object.", source: formatAt("/format/schema") };
    }
    push({ actor: "learner-artifact", kind: "request", label: `POST /v1/messages · ${fixture.input.invoices.length} invoice scans · output_config.format ${format ? text(format.type) || "(no type)" : "not set"}`, source: sources.format });
    if (error) {
      push({ actor: "service", kind: "error", label: error.message, source: error.source, tone: "bad" });
      return { trace, out: { ...base, error }, metrics: { posted: 0, wrongCents: 0 } };
    }

    const fields = schema ? fieldsOf(schema) : null;
    const missing = !fields ? [] : [...(!fields.total ? ["the printed total"] : []), ...(!fields.amount ? ["the line amounts"] : [])];
    const invoices: InvoiceOutcome[] = [];
    let wrongCents = 0;
    for (const invoice of fixture.input.invoices) {
      const computed = invoice.lines.reduce((total, { cents }) => total + cents, 0);
      const truth: Truth = invoice.printed === null ? "unreadable" : invoice.printed === computed ? "agree" : "mismatch";
      if (!schema || !fields) {
        push({ actor: "model", kind: "response", label: `Invoice ${invoice.id} · Claude replied “Here is the extracted invoice: …” in prose`, tone: "bad" });
        push({ actor: "service", kind: "error", label: `Importer · JSON.parse failed on invoice ${invoice.id}; nothing was posted or held`, tone: "bad" });
        invoices.push({ id: invoice.id, truth, computed, printed: invoice.printed, output: null, totalOut: undefined, fabricated: false, statusOut: null, statusKind: "none", decision: "unparsed", note: null });
        continue;
      }
      const { output, fabricated } = extract(schema, fields, invoice);
      const problems = validateSchema(schema, output);
      const statusOut = fields.status && typeof output[fields.status] === "string" ? String(output[fields.status]) : null;
      const totalOut = fields.total ? output[fields.total] : undefined;
      push({ actor: "model", kind: "response", label: `Invoice ${invoice.id} · stop_reason "end_turn" · output matches your schema${problems.length ? " (with problems)" : ""}`,
        detail: fabricated ? `Simulated: the printed total on the scan is smudged, but ${fields.total} must hold ${fields.totalTypes.join(" or ")}, so Claude filled it with ${show(totalOut as number)}.` : undefined,
        payload: output, source: fabricated && fields.total ? formatAt(`/format/schema/properties/${fields.total}`) : sources.format, tone: fabricated ? "warn" : undefined });
      const verdict = evaluate(postWhen, output);
      const post = verdict.value === true;
      push({ actor: "learner-artifact", kind: "decision", label: `post_when → ${show(verdict.value)}`,
        detail: verdict.seen.map(({ label, value }) => `${label} = ${show(value)}`).join(" · ") || postWhen.source, source: sources.rule });
      let rendered: string | null = null;
      if (post) {
        push({ actor: "service", kind: "output", label: `Ledger · invoice ${invoice.id} posted at ${show(totalOut as number)}${typeof totalOut === "number" ? "¢" : ""}`,
          tone: truth === "agree" && !fabricated ? "ok" : "bad" });
        if (truth !== "agree" || fabricated) wrongCents += typeof totalOut === "number" ? Math.abs(totalOut - (invoice.printed ?? 0)) || totalOut : 0;
      } else {
        rendered = renderTemplate(note, output).trim();
        push({ actor: "person", kind: "output", label: `Staff review · invoice ${invoice.id}`, detail: rendered || "(empty review note)", source: sources.note, tone: truth === "agree" ? "bad" : "ok" });
      }
      invoices.push({ id: invoice.id, truth, computed, printed: invoice.printed, output, totalOut, fabricated, statusOut,
        statusKind: statusOut === null ? "none" : unreadableWord.test(statusOut) ? "unreadable" : "printed", decision: post ? "posted" : "held", note: rendered });
    }
    return { trace, out: { accepted: true, structured: !!schema, missing, invoices, sources },
      metrics: { posted: invoices.filter(({ decision }) => decision === "posted").length, wrongCents } };
  },
};
