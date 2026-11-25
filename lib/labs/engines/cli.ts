// Claude Code in CI: parses the review step's `claude` invocation (print mode, output format, --json-schema, allowed
// tools, session resume), checks the schema against the publisher's contract with real JSON Schema validation, and
// plays a reviewer whose findings follow from what the run can see: the criteria file (if it can read it), the
// interface contract and the prior findings (if the run points at them), and whether it inherits the authoring session.
// The reviewer's reading of natural-language criteria is a property-driven proxy and is labelled as simulated.
import { parseClaudeCommand, parseJsonObject, splitOutsideParens, validateSchema } from "./parse";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type Proof = { id: string; offsetMm: number };
export type ReviewInput = {
  component: string;
  /** Type-to-trim margin from the component's spec; the press rule allows drift up to half of it. */
  marginMm: number;
  proofs: readonly Proof[];
  /** Files the run must be pointed at. */
  files: { criteria: string; schema: string; contract: string; prior: string };
  /** A finding already posted on this commit's previous run. */
  prior: { id: string; snippet: string };
  /** The cross-component defect only an independent reader with the contract finds. */
  mismatch: { id: string; components: readonly string[]; snippet: string };
  /** Publisher contract samples. */
  samples: readonly { label: string; valid: boolean; value: unknown }[];
};

export type ReviewOut = {
  hung: boolean;
  format: string;
  structured: boolean;
  unsafeTools: readonly string[];
  readable: boolean;
  schemaProblems: readonly { label: string; valid: boolean }[];
  extracts: "structured_output" | "result" | "nothing";
  resumed: string | null;
  sees: { criteria: boolean; contract: boolean; prior: boolean };
  rule: { kind: "formula" | "fixed" | "vague"; limitMm: number | null };
  proofs: readonly (Proof & { flagged: boolean; shouldFlag: boolean })[];
  reposted: readonly string[];
  mismatchFound: boolean;
  sources: { command: TraceSource; schema: TraceSource; criteria: TraceSource };
};

type Parsed = { command: string; schema: string; criteria: string };
const readOnly = /^(Read|Grep|Glob|LS|Bash\(git (diff|log|show|status)[^)]*\))$/;

/** Simulated: how a reviewer turns the criteria text into a drift limit for one component. */
export function driftRule(criteria: string, marginMm: number): ReviewOut["rule"] {
  if (/flag\s+(any|every|all)\s+(offset|drift|shift|misalign)/i.test(criteria)) return { kind: "vague", limitMm: null };
  if (/half\s+(?:of\s+)?(?:the\s+)?[\w\s-]*margin|margin\s*(?:÷|\/)\s*2|50\s*%\s*of\s+(?:the\s+)?[\w\s-]*margin/i.test(criteria)) return { kind: "formula", limitMm: marginMm / 2 };
  const numbers = new Set(criteria.split("\n").filter((line) => /(offset|drift|shift|toleran|misalign)/i.test(line))
    .flatMap((line) => [...line.matchAll(/(\d+(?:\.\d+)?)\s*mm/gi)].map((match) => Number(match[1]))));
  return numbers.size === 1 ? { kind: "fixed", limitMm: [...numbers][0] } : { kind: "vague", limitMm: null };
}

export const ciEngine: Engine<Parsed, ReviewInput, ReviewOut> = {
  id: "claude-code.ci-review",
  provider: "anthropic",
  label: "CI runner · claude CLI flags · JSON Schema validation · simulated reviewer",
  simulated: false,
  parse(files) {
    const command = parseClaudeCommand(files.command);
    if (command.error !== undefined) return { ok: false, error: command.error, source: { artifact: "command", line: 1 } };
    return { ok: true, value: { command: files.command, schema: files.schema ?? "", criteria: files.criteria ?? "" } };
  },
  run({ command: script, schema: schemaText, criteria }, fixture: Fixture<ReviewInput>): EngineRun<ReviewOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const parsed = parseClaudeCommand(script).value!;
    const lineWith = (needle: string) => {
      const index = script.split("\n").findIndex((line) => line.includes(needle));
      return index < 0 ? 1 : index + 1;
    };
    const sources = { command: { artifact: "command", line: lineWith("claude") }, schema: { artifact: "schema", line: 1 }, criteria: { artifact: "criteria", line: 1 } };
    const { flags, print, prompt, pipeline } = parsed;
    const tools = typeof flags.get("--allowedTools") === "string" ? splitOutsideParens(String(flags.get("--allowedTools")), /[,\s]/) : [];
    const resumed = ["--resume", "-r", "--continue", "-c"].find((flag) => flags.has(flag)) ?? null;
    const format = typeof flags.get("--output-format") === "string" ? String(flags.get("--output-format")) : "text";
    const empty: ReviewOut = {
      hung: !print, format, structured: false, unsafeTools: tools.filter((tool) => !readOnly.test(tool)), readable: tools.some((tool) => tool === "Read"),
      schemaProblems: [], extracts: "nothing", resumed, sees: { criteria: false, contract: false, prior: false }, rule: { kind: "vague", limitMm: null },
      proofs: [], reposted: [], mismatchFound: false, sources,
    };
    push({ actor: "learner-artifact", kind: "request", label: `CI step · claude ${print ? "-p" : "(interactive)"} · --output-format ${format}${resumed ? ` · ${resumed}` : ""}`, source: sources.command });
    if (!print) {
      push({ actor: "service", kind: "error", label: "The runner waits for input that never comes · job cancelled after 60 min", tone: "bad", source: sources.command });
      return { trace, out: empty, metrics: { reposted: 0 } };
    }
    if (empty.unsafeTools.length) push({ actor: "service", kind: "decision", label: `Allowed without asking: ${empty.unsafeTools.join(", ")}`, detail: "The review run can change files in the commit it is reviewing.", tone: "bad", source: sources.command });

    // --- schema and output plumbing ---
    const schemaFlag = flags.get("--json-schema");
    const schemaSource = typeof schemaFlag === "string" && schemaFlag.includes(input.files.schema) ? schemaText
      : typeof schemaFlag === "string" ? schemaFlag : null;
    const schema = schemaSource === null ? null : parseJsonObject(schemaSource, "--json-schema");
    const structured = format === "json" && !!schema && schema.error === undefined;
    if (schema?.error !== undefined && schema) push({ actor: "service", kind: "error", label: "--json-schema is not valid JSON", detail: schema.error, tone: "bad", source: sources.schema });
    const schemaProblems = structured ? input.samples.filter(({ value, valid }) => (validateSchema(schema!.value, value).length === 0) !== valid).map(({ label, valid }) => ({ label, valid })) : [];
    for (const problem of schemaProblems) {
      push({ actor: "service", kind: "decision", label: problem.valid ? `Your schema rejects a well-formed finding: ${problem.label}` : `Your schema allows a finding the publisher rejects: ${problem.label}`, source: sources.schema, tone: "bad" });
    }
    const jq = pipeline.find((segment) => segment[0] === "jq");
    const extracts = jq?.some((arg) => arg.includes(".structured_output")) ? "structured_output" as const : jq?.some((arg) => arg.includes(".result")) ? "result" as const : "nothing" as const;

    // --- what the reviewer can see ---
    const canRead = empty.readable;
    const pointsAt = (file: string) => prompt.includes(file);
    const criteriaVisible = canRead && pointsAt(input.files.criteria);
    const context = prompt + (criteriaVisible ? `\n${criteria}` : "");
    const sees = { criteria: criteriaVisible, contract: canRead && context.includes(input.files.contract), prior: canRead && context.includes(input.files.prior) };
    push({ actor: "model", kind: "decision", label: `Reviewer context${resumed ? " · inherits the authoring session" : " · fresh session"}`,
      detail: `criteria: ${sees.criteria ? input.files.criteria : "not read"} · contract: ${sees.contract ? input.files.contract : "not read"} · prior findings: ${sees.prior ? input.files.prior : "not read"}`, source: sources.command });

    // --- simulated reviewer ---
    const rule = sees.criteria ? driftRule(criteria, input.marginMm) : { kind: "vague" as const, limitMm: null };
    const proofs = input.proofs.map((proof) => ({ ...proof, shouldFlag: proof.offsetMm > input.marginMm / 2,
      flagged: rule.limitMm === null ? proof.offsetMm > 0 : proof.offsetMm > rule.limitMm }));
    for (const proof of proofs) {
      push({ actor: "model", kind: "output", label: `Simulated review · ${input.component} proof ${proof.id} drifts ${proof.offsetMm} mm → ${proof.flagged ? "flagged" : "accepted"}`,
        detail: rule.limitMm === null ? "No measurable limit in the criteria it read, so any drift is reported." : `Limit read from the criteria: ${rule.limitMm} mm (${rule.kind === "formula" ? "half the margin in this component’s spec" : "a fixed number"}).`,
        source: sources.criteria, tone: proof.flagged === proof.shouldFlag ? undefined : "bad" });
    }
    const mismatchFound = !resumed && sees.contract;
    push({ actor: "model", kind: "output", label: mismatchFound ? `Finding ${input.mismatch.id} · ${input.mismatch.components.join(" ↔ ")} disagree on the order field` : `No cross-component finding: ${input.mismatch.components.join(" and ")} each match ${resumed ? "the author’s own reasoning" : "their own files"}`,
      tone: mismatchFound ? "ok" : "bad", source: sources.command });
    const reposted = sees.prior ? [] : [input.prior.id];
    push({ actor: "service", kind: "output", label: reposted.length ? `Publisher · ${input.prior.id} posted again on the retried commit` : `Publisher · ${input.prior.id} already posted; not repeated`, tone: reposted.length ? "bad" : "ok", source: sources.command });
    if (!structured || extracts !== "structured_output") {
      push({ actor: "service", kind: "error", label: `Publisher receives ${format !== "json" ? "prose" : extracts === "result" ? "the text reply in .result" : !schema ? "JSON with no structured_output" : "the whole JSON envelope"}, not typed findings`, tone: "bad", source: sources.command });
    }
    return { trace, out: { ...empty, structured, schemaProblems, extracts, sees, rule, proofs, reposted, mismatchFound }, metrics: { reposted: reposted.length } };
  },
};

