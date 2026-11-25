// Long codebase investigation replay. Three learner artifacts:
//  1. runbook.sh: the `claude` commands the operator runs. Session semantics follow the Claude Code CLI: --resume <name>
//     appends to that session; adding --fork-session copies its history into a new session (named by -n); --continue picks
//     up the most recent session; no resume starts fresh. --permission-mode plan makes Claude explore and propose before any
//     edit (recorded behaviour: in default mode the migration trials edit the shared function in their first turn).
//  2. an expected-results table for the shared function, run against the deployed code and each trial's patch. The first
//     trial whose patch passes every row ships; production then exercises every caller.
//  3. the handoff note read after compaction: the next operator skips what it records as verified or rejected and inspects
//     what it lists as still open.
import { findTable, markdownSections, shellTokens } from "./parse";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type InputKey = "null" | "empty" | "ref";
/** Output per caller and input kind: "absent", "invalid", "crash", "=ref" (the normalized reference) or a literal value. */
export type Impl = Readonly<Record<string, Readonly<Record<InputKey, string>>>>;
export type InvestigationInput = {
  baseline: { session: string; commit: string };
  callers: readonly { key: string; pattern: string; label: string }[];
  deployed: Impl;
  truth: Impl;
  trials: readonly { id: "A" | "B"; idea: string; impl: Impl }[];
  /** A valid reference used to describe production failures. */
  example: string;
  uninspected: string;
  facts: {
    verified: readonly { token: string; label: string; minutes: number }[];
    rejected: readonly { token: string; label: string; minutes: number }[];
    pending: readonly { token: string }[];
  };
};

type Command = { line: number; text: string; flags: Map<string, string | true>; prompt: string; error?: string };
type Row = { line: number; caller: string | null; callerText: string; input: InputKey | null; raw: string; expected: string };
type Parsed = { commands: Command[]; rows: Row[]; tableLine: number; note: Map<string, string>; noteText: string };

export type TrialRun = { id: "A" | "B"; source: TraceSource; session: string; fromBaseline: boolean; inherited: boolean; baselineModified: boolean; plan: boolean };
export type InvestigationOut = {
  trials: readonly TrialRun[];
  missingTrials: readonly ("A" | "B")[];
  label: { found: boolean; plan: boolean; bundled: boolean; source: TraceSource };
  errors: readonly { message: string; source: TraceSource }[];
  table: {
    rows: number;
    deployedCaught: { null: boolean; empty: boolean };
    results: readonly { id: "A" | "B"; failed: readonly string[] }[];
    shipped: "A" | "B" | null;
    production: { caller: string; input: InputKey; actual: string; truth: string } | null;
    source: TraceSource;
  };
  resume: { repeated: readonly { label: string; minutes: number }[]; missed: readonly string[]; source: TraceSource };
  sources: { runbook: TraceSource; cases: TraceSource; handoff: TraceSource };
};

const valueFlags = new Set(["--resume", "-r", "--name", "-n", "--permission-mode", "--model", "--output-format", "--allowedTools", "--append-system-prompt"]);

function parseCommands(source: string): Command[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const commands: Command[] = [];
  for (let index = 0; index < lines.length; index++) {
    const start = index;
    let text = lines[index];
    while (text.trimEnd().endsWith("\\") && index + 1 < lines.length) text = text.trimEnd().slice(0, -1) + " " + lines[++index];
    if (!text.trim() || text.trim().startsWith("#")) continue;
    const tokens = shellTokens(text);
    if (tokens.error !== undefined) {
      commands.push({ line: start + 1, text, flags: new Map(), prompt: "", error: tokens.error });
      continue;
    }
    const segment = tokens.value.find((parts) => parts[0] === "claude");
    if (!segment) continue;
    const flags = new Map<string, string | true>();
    const positional: string[] = [];
    for (let at = 1; at < segment.length; at++) {
      const token = segment[at];
      const [name, inline] = token.startsWith("--") && token.includes("=") ? [token.slice(0, token.indexOf("=")), token.slice(token.indexOf("=") + 1)] : [token, undefined];
      if (valueFlags.has(name)) flags.set(name === "-r" ? "--resume" : name === "-n" ? "--name" : name, inline ?? segment[++at] ?? "");
      else if (name.startsWith("-")) flags.set(name === "-c" ? "--continue" : name === "-p" ? "--print" : name, true);
      else positional.push(token);
    }
    commands.push({ line: start + 1, text, flags, prompt: positional.join(" ") });
  }
  return commands;
}

function inputKey(cell: string): InputKey | null {
  const value = cell.trim();
  if (/^null$|^none$|^undefined$|no reference|not sent/i.test(value)) return "null";
  if (/^(""|''|``)$|empty|blank/i.test(value)) return "empty";
  return /[A-Za-z0-9]/.test(value) ? "ref" : null;
}
const unquote = (value: string) => value.trim().replace(/^["'`](.*)["'`]$/, "$1").trim();
function expectedOf(cell: string) {
  const value = unquote(cell);
  if (/^(absent|missing|not provided)\b/i.test(value)) return "absent";
  if (/^(invalid|rejected?|error)\b/i.test(value)) return "invalid";
  if (/^(crash|throws?)\b/i.test(value)) return "crash";
  return value;
}
function outputOf(impl: Impl, caller: string, input: InputKey, raw: string) {
  const out = impl[caller]?.[input] ?? "crash";
  return out === "=ref" ? unquote(raw).toUpperCase() : out;
}

export const investigationEngine: Engine<Parsed, InvestigationInput, InvestigationOut> = {
  id: "claude-code.investigation-replay",
  provider: "anthropic",
  label: "Claude Code session replay (resume · fork · plan mode) · expected-results run · post-compaction resume",
  simulated: false,
  parse(files) {
    const commands = parseCommands(files.runbook ?? "");
    if (!commands.length) return { ok: false, error: "release/runbook.sh has no claude commands.", source: { artifact: "runbook", line: 1 } };
    const table = findTable(files.cases, ["caller", "input", "expected"]);
    if (!table) return { ok: false, error: "The test cases file needs a Markdown table with the columns Caller, Input and Expected.", source: { artifact: "cases", line: 1 } };
    const lines = (files.cases ?? "").split("\n");
    const tableLine = Math.max(1, lines.findIndex((line) => /\|\s*caller\s*\|/i.test(line)) + 1);
    const rows: Row[] = table.rows.map((row, index) => {
      const pick = (word: string) => row[Object.keys(row).find((key) => key.includes(word))!] ?? "";
      const raw = pick("input");
      return { line: tableLine + 2 + index, caller: null, callerText: pick("caller"), input: inputKey(raw), raw, expected: expectedOf(pick("expected")) };
    });
    if (!(files.handoff ?? "").trim()) return { ok: false, error: "The handoff note is empty.", source: { artifact: "handoff", line: 1 } };
    return { ok: true, value: { commands, rows, tableLine, note: markdownSections(files.handoff), noteText: files.handoff } };
  },
  run({ commands, rows: parsedRows, tableLine, note, noteText }, fixture: Fixture<InvestigationInput>): EngineRun<InvestigationOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const sources = { runbook: { artifact: "runbook", line: 1 }, cases: { artifact: "cases", line: tableLine }, handoff: { artifact: "handoff", line: 1 } };
    const errors: InvestigationOut["errors"][number][] = [];

    // --- 1. sessions ---
    type Session = { name: string; history: string[]; baseline: boolean };
    const store = new Map<string, Session>([[input.baseline.session, { name: input.baseline.session, history: [`baseline ${input.baseline.commit}`], baseline: true }]]);
    const baselineObject = store.get(input.baseline.session)!;
    let last: Session | null = null;
    const trials: TrialRun[] = [];
    let label: InvestigationOut["label"] = { found: false, plan: false, bundled: false, source: sources.runbook };
    const migration = /normalizeRef|migration|identifier|\b(idea|trial|approach|option)\s+[AB]\b/i;
    for (const [index, command] of commands.entries()) {
      const source = { artifact: "runbook", line: command.line };
      if (command.error) {
        errors.push({ message: command.error, source });
        push({ actor: "service", kind: "error", label: `line ${command.line}: ${command.error}`, source, tone: "bad" });
        continue;
      }
      const resume = command.flags.get("--resume");
      const fork = command.flags.has("--fork-session");
      const plan = command.flags.get("--permission-mode") === "plan";
      let session: Session;
      if (typeof resume === "string") {
        const found = store.get(resume);
        if (!found) {
          const message = `No conversation found with session ID or name: ${resume || "(empty)"}`;
          errors.push({ message, source });
          push({ actor: "service", kind: "error", label: `line ${command.line}: ${message}`, source, tone: "bad" });
          continue;
        }
        session = fork ? { name: String(command.flags.get("--name") || `session-${index + 1}`), history: [...found.history], baseline: found.baseline } : found;
      } else if (command.flags.has("--continue")) {
        if (!last) {
          const message = "No conversation found to continue";
          errors.push({ message, source });
          push({ actor: "service", kind: "error", label: `line ${command.line}: ${message}`, source, tone: "bad" });
          continue;
        }
        session = last;
      } else session = { name: String(command.flags.get("--name") || `session-${index + 1}`), history: [], baseline: false };
      store.set(session.name, session);
      last = session;
      const how = typeof resume === "string" ? fork ? `forked from ${resume} as ${session.name}` : `resumed ${resume}` : command.flags.has("--continue") ? `continued ${session.name}` : `new session ${session.name}`;
      const trialIds = (["A", "B"] as const).filter((id) => new RegExp(`\\b(idea|trial|approach|option)\\s+${id}\\b`, "i").test(command.prompt));
      const isLabel = /\blabel\b/i.test(command.prompt);
      push({ actor: "learner-artifact", kind: "request", source, label: `claude ${how}${plan ? " · plan mode" : ""}${command.flags.has("--print") ? " · -p" : ""}`, detail: command.prompt });
      if (isLabel) {
        const bundled = trialIds.length > 0 || migration.test(command.prompt.replace(/\blabel\b/gi, "")) || session.history.length > 0;
        label = { found: true, plan, bundled, source };
        push({ actor: "model", kind: plan ? "decision" : "output", source, tone: bundled || plan ? "bad" : "ok",
          label: plan ? "Label fix: Claude writes a plan and waits for approval before a one-line edit" : bundled ? "Label fix edited inside the migration session" : "Label fix edited directly in its own session" });
      }
      for (const id of trialIds) {
        const others = session.history.filter((entry) => entry.startsWith("trial ") && entry !== `trial ${id}`);
        const run: TrialRun = { id, source, session: session.name, fromBaseline: session.baseline, inherited: others.length > 0, baselineModified: session === baselineObject, plan };
        trials.push(run);
        if (!session.baseline) push({ actor: "model", kind: "decision", source, tone: "bad", label: `Trial ${id} has no ${input.baseline.commit} findings: re-reads both callers and re-tests the rejected theory` });
        if (run.inherited) push({ actor: "model", kind: "decision", source, tone: "bad", label: `Trial ${id} starts with ${others.join(", ")}’s edits already in its history` });
        push({ actor: "model", kind: plan ? "response" : "tool_call", source, tone: plan ? "ok" : "bad",
          label: plan ? `Trial ${id} (plan mode): traces every caller, including ${input.uninspected}, then proposes the patch` : `Trial ${id}: edits src/ref/normalize.ts in its first turn, before tracing ${input.uninspected}` });
        session.history.push(`trial ${id}`);
      }
    }
    const missingTrials = (["A", "B"] as const).filter((id) => !trials.some((trial) => trial.id === id));

    // --- 2. expected-results table ---
    const rows = parsedRows.map((row) => ({ ...row, caller: input.callers.find(({ pattern }) => new RegExp(pattern, "i").test(row.callerText))?.key ?? null }));
    const usable = rows.filter((row) => row.caller && row.input);
    for (const row of rows.filter((entry) => !entry.caller || !entry.input)) {
      push({ actor: "service", kind: "decision", label: `Row ignored: “${row.callerText}” · ${row.raw || "(blank)"}`, detail: "The test runner cannot tell which caller or input this row means.", source: { artifact: "cases", line: row.line }, tone: "warn" });
    }
    const failures = (impl: Impl) => usable.filter((row) => outputOf(impl, row.caller!, row.input!, row.raw) !== row.expected)
      .map((row) => `${input.callers.find(({ key }) => key === row.caller)!.label} · normalizeRef(${row.raw.trim() || "(blank)"}) → expected ${row.expected}`);
    const deployedFails = usable.filter((row) => outputOf(input.deployed, row.caller!, row.input!, row.raw) !== row.expected);
    const deployedCaught = { null: deployedFails.some(({ input: key }) => key === "null"), empty: deployedFails.some(({ input: key }) => key === "empty") };
    push({ actor: "tool", kind: "tool_result", source: sources.cases, label: `Deployed normalizeRef · ${deployedFails.length} of ${usable.length} rows fail`, tone: deployedCaught.null && deployedCaught.empty ? "ok" : "warn" });
    const results = input.trials.map(({ id, impl }) => ({ id, failed: failures(impl) }));
    for (const { id, failed } of results) {
      push({ actor: "tool", kind: "tool_result", source: sources.cases, label: `Trial ${id} patch · ${failed.length ? `${failed.length} row${failed.length === 1 ? "" : "s"} fail` : "every row passes"}`, detail: failed.join("\n") || undefined });
    }
    const shipped = usable.length ? results.find(({ failed }) => !failed.length)?.id ?? null : null;
    let production: InvestigationOut["table"]["production"] = null;
    if (shipped) {
      const impl = input.trials.find(({ id }) => id === shipped)!.impl;
      for (const { key } of input.callers) {
        for (const kind of ["null", "empty", "ref"] as const) {
          const raw = kind === "ref" ? input.example : kind === "empty" ? "\"\"" : "null";
          const actual = outputOf(impl, key, kind, raw);
          const truth = outputOf(input.truth, key, kind, raw);
          if (!production && actual !== truth) production = { caller: key, input: kind, actual, truth };
        }
      }
      push({ actor: "service", kind: "output", source: sources.cases, label: `Trial ${shipped} ships`, tone: production ? "bad" : "ok",
        detail: production ? `Nightly run: ${production.caller}(${production.input === "ref" ? input.example : production.input === "empty" ? "\"\"" : "null"}) → ${production.actual}` : "Both callers behave as the contract says." });
    } else push({ actor: "service", kind: "output", source: sources.cases, label: "Release blocked: no trial passes the table", tone: "bad" });

    // --- 3. after compaction: the next operator reads the handoff note ---
    const classify = (heading: string) => /not yet|uninspected|pending|open|remain|next|to (inspect|check|do)|unresolved/i.test(heading) ? "pending"
      : /reject|ruled out|dead end|disproved|not the cause/i.test(heading) ? "rejected" : /verif|confirm|done|checked|inspected|cleared|known/i.test(heading) ? "done" : "other";
    const sections = [...note.entries()].map(([heading, body]) => ({ kind: classify(heading), text: `${heading}\n${body}`.toLowerCase() }));
    const recordedAs = (token: string, kind: string) => sections.some((entry) => entry.kind === kind && entry.text.includes(token.toLowerCase()));
    const repeated = [
      ...input.facts.verified.filter(({ token }) => !recordedAs(token, "done")),
      ...input.facts.rejected.filter(({ token }) => !recordedAs(token, "rejected")),
    ].map(({ label: name, minutes }) => ({ label: name, minutes }));
    const missed = input.facts.pending.filter(({ token }) => !recordedAs(token, "pending") || recordedAs(token, "done")).map(({ token }) => token);
    push({ actor: "person", kind: "request", source: sources.handoff, label: "After /compact · Omar resumes from notes/migration-handoff.md", detail: noteText.split("\n").slice(0, 3).join(" ").slice(0, 120) });
    for (const { label: name, minutes } of repeated) push({ actor: "person", kind: "decision", source: sources.handoff, tone: "bad", label: `Redone: ${name} (${minutes} min)` });
    for (const path of input.facts.pending) {
      const skipped = missed.includes(path.token);
      push({ actor: "person", kind: skipped ? "decision" : "output", source: sources.handoff, tone: skipped ? "bad" : "ok", label: skipped ? `Never inspected: ${path.token}` : `Inspected: ${path.token}` });
    }
    return { trace, out: {
      trials, missingTrials, label, errors,
      table: { rows: usable.length, deployedCaught, results, shipped, production, source: sources.cases },
      resume: { repeated, missed, source: sources.handoff }, sources,
    }, metrics: { repeatMinutes: repeated.reduce((total, { minutes }) => total + minutes, 0) } };
  },
};
