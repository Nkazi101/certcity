// Repair desk guardrail replay. A day at the repair desk runs through three learner files:
// - .claude/settings.json: which tools the headless desk sessions may call (deny → ask → allow; anything not allowed is
//   refused because nobody can approve it) and the PreToolUse hooks (matcher semantics, exit code 2 blocks the call;
//   the shop's scripts/path-guard.js compares tool_input.path, or its resolved real path with --resolve, against --root).
// - server/repair-tools.json: the repair MCP server's own checks on cancel_job (run for every caller) and the
//   CallToolResult (isError + content) stock_lookup returns for each supplier outcome.
// - deploy/env.json: the variables each environment's deployment gets (vault references or literals; NEXT_PUBLIC_*
//   variables are inlined into the browser bundle), then a key rotation.
// How Claude words a stock answer from a tool result is a proxy and is labelled as simulated.
import { list, permissionDecision, permissionRules, record, shellTokens, text, hookMatcherMatches } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type StockOutcome = "ok" | "no_match" | "timeout" | "upstream_error";
export type DeskStep =
  | { kind: "document"; at: string; session: string; title: string; quote: string; tool: string; jobs: readonly string[] }
  | { kind: "cancel"; at: string; caller: "staff screen" | "scheduled job"; job: string }
  | { kind: "stock"; at: string; part: string; supplier: string; outcome: StockOutcome; count?: number; seconds?: number; status?: string }
  | { kind: "cleanup"; at: string; path: string; resolved: string };

export type DeskInput = {
  project: string;
  ledger: readonly { job: string; action: string; by: string }[];
  steps: readonly DeskStep[];
  tools: { cancel: string; stock: string; cleanup: string };
  guardScript: string;
  vault: Readonly<Record<string, string>>;
  /** Key id behind each literal key value that might be pasted into the file. */
  literals: Readonly<Record<string, string>>;
  environments: readonly string[];
  rotate: string;
};

export type DeskOut = {
  injected: readonly { at: string; title: string; jobs: readonly string[]; cancelled: readonly string[] }[];
  cancels: readonly { at: string; caller: string; job: string; approved: boolean; ran: boolean; reason: string }[];
  stock: readonly { at: string; part: string; outcome: StockOutcome; told: string; expected: string; refused: string | null }[];
  cleanups: readonly { at: string; path: string; resolved: string; inside: boolean; ran: boolean; afterDelete: boolean; refused: string | null }[];
  env: { problems: readonly { message: string; source: TraceSource }[] };
  sources: { permissions: TraceSource; hooks: TraceSource; cancel: TraceSource; stock: TraceSource; env: TraceSource };
};

type Parsed = { settings: LocatedJson; server: LocatedJson; env: LocatedJson };

const fill = (template: string, values: Readonly<Record<string, string | number | undefined>>) =>
  template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key: string) => values[key] === undefined ? whole : String(values[key]));

/** Simulated: what Claude tells staff after reading a stock_lookup result. */
function readStock(result: { isError: boolean; text: string }) {
  if (result.isError) return "unavailable right now; try again later";
  const count = /(\d+)\s+(?:in stock|available|on hand)/i.exec(result.text);
  if (count && Number(count[1]) > 0) return `${count[1]} in stock`;
  if ((count && Number(count[1]) === 0) || /\b0\b|none|out of stock|no stock|not found|no match/i.test(result.text)) return "out of stock";
  return "the result was unclear";
}

export const repairGuardrailsEngine: Engine<Parsed, DeskInput, DeskOut> = {
  id: "repair-desk.guardrail-replay",
  provider: "anthropic",
  label: "Desk session permissions + hooks · repair MCP server checks and results · deployment secrets",
  simulated: false,
  parse(files) {
    const parsed: Record<string, LocatedJson> = {};
    for (const [id, path] of [["settings", ".claude/settings.json"], ["server", "server/repair-tools.json"], ["env", "deploy/env.json"]] as const) {
      const file = parseLocatedJson(files[id], path);
      if (file.error !== undefined) return { ok: false, error: file.error, source: { artifact: id } };
      if (!record(file.value.value)) return { ok: false, error: `${path} must be a JSON object.`, source: { artifact: id, line: 1 } };
      parsed[id] = file.value;
    }
    return { ok: true, value: { settings: parsed.settings, server: parsed.server, env: parsed.env } };
  },
  run({ settings: settingsFile, server: serverFile, env: envFile }, fixture: Fixture<DeskInput>): EngineRun<DeskOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const at = (artifact: string, located: LocatedJson) => (path: string): TraceSource => ({ artifact, pointer: path, line: lineOf(located, path) });
    const settingsAt = at("settings", settingsFile);
    const serverAt = at("server", serverFile);
    const envAt = at("env", envFile);
    const settings = record(settingsFile.value)!;
    const server = record(serverFile.value)!;
    const rules = permissionRules(settings);
    const hooks = record(settings.hooks);
    const sources = {
      permissions: settingsAt(rules.permissions ? "/permissions" : ""), hooks: settingsAt(hooks ? "/hooks" : ""),
      cancel: serverAt(record(server.cancel_job) ? "/cancel_job" : ""), stock: serverAt(record(server.stock_lookup) ? "/stock_lookup/results" : ""), env: envAt(""),
    };
    const allowed = (tool: string) => {
      const decision = permissionDecision(rules, { tool });
      return decision === "allow" ? null : decision === "deny" ? `${tool} is denied` : `${tool} is not allowed, and a headless session cannot ask anyone`;
    };
    /** path-guard.js hooks registered for an event that fire for this tool. */
    const guards = (event: "PreToolUse" | "PostToolUse", tool: string) => list(hooks?.[event]).flatMap((entry, index) => {
      const group = record(entry);
      if (!group || !hookMatcherMatches(group.matcher, tool)) return [];
      return list(group.hooks).flatMap((hook, inner) => {
        const command = record(hook);
        if (command?.type !== "command") return [];
        const raw = text(command.command).replace(/\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR/g, input.project);
        const tokens = shellTokens(raw).value?.flat() ?? [];
        if (!tokens.some((token) => token.endsWith(input.guardScript))) return [];
        const rootIndex = tokens.indexOf("--root");
        const root = rootIndex >= 0 ? tokens[rootIndex + 1]?.replace(/\/+$/, "") ?? null : null;
        return [{ root, resolve: tokens.includes("--resolve"), source: settingsAt(pointer("hooks", event, index, "hooks", inner)) }];
      });
    });
    const inside = (path: string, root: string) => path === root || path.startsWith(root + "/");

    const injected: DeskOut["injected"][number][] = [];
    const cancels: DeskOut["cancels"][number][] = [];
    const stock: DeskOut["stock"][number][] = [];
    const cleanups: DeskOut["cleanups"][number][] = [];
    const cancelChecks = list(record(server.cancel_job)?.checks).map(String);
    /** The repair server's own cancel_job handler: runs for every caller. */
    const cancelHandler = (job: string, caller: string) => {
      const approvals = input.ledger.filter((row) => row.job === job);
      for (const check of cancelChecks) {
        if (check === "approval:job" && !approvals.length) return { ran: false, reason: `no approval row for ${job}` };
        if (check === "approval:job+action" && !approvals.some((row) => row.action === "cancel")) return { ran: false, reason: `no cancel approval for ${job}` };
        if (check === "caller:staff_screen" && caller !== "staff screen") return { ran: false, reason: `${caller} is not the staff screen` };
      }
      return { ran: true, reason: cancelChecks.length ? `passed ${cancelChecks.join(", ")}` : "the handler runs no checks" };
    };
    const results = record(record(server.stock_lookup)?.results);
    push({ actor: "learner-artifact", kind: "request", label: `Repair desk day · project ${input.project} · cancel_job checks: ${cancelChecks.join(", ") || "none"}`, source: sources.cancel });

    for (const step of input.steps) {
      if (step.kind === "document") {
        push({ actor: "person", kind: "request", label: `${step.at} · ${step.session} reads ${step.title}`, detail: `“${step.quote}”` });
        const refused = allowed(step.tool);
        if (refused) {
          push({ actor: "model", kind: "decision", label: `${step.session} reports the form’s contents to staff`, detail: `The form asks for ${step.jobs.length} cancellations; ${refused}.`, source: sources.permissions, tone: "ok" });
          continue;
        }
        const done: string[] = [];
        for (const job of step.jobs) {
          const outcome = cancelHandler(job, step.session);
          push({ actor: "model", kind: "tool_call", label: `${step.at} · ${step.tool} {"job_id": "${job}"}`, detail: "Requested because the supplier form said so.", source: sources.permissions, tone: "bad" });
          push({ actor: "tool", kind: outcome.ran ? "output" : "error", label: outcome.ran ? `${job} cancelled` : `cancel_job refused ${job}: ${outcome.reason}`, source: sources.cancel, tone: outcome.ran ? "bad" : "ok" });
          if (outcome.ran) done.push(job);
        }
        injected.push({ at: step.at, title: step.title, jobs: step.jobs, cancelled: done });
      } else if (step.kind === "cancel") {
        const approved = input.ledger.some((row) => row.job === step.job && row.action === "cancel");
        const outcome = cancelHandler(step.job, step.caller);
        push({ actor: "service", kind: "tool_call", label: `${step.at} · ${step.caller} → cancel_job ${step.job}`, detail: approved ? "The approval ledger has a cancel approval for this job." : "The approval ledger has no cancel approval for this job." });
        push({ actor: "tool", kind: outcome.ran ? "output" : "error", label: outcome.ran ? `${step.job} cancelled` : `refused: ${outcome.reason}`, source: sources.cancel, tone: outcome.ran === approved ? "ok" : "bad" });
        cancels.push({ at: step.at, caller: step.caller, job: step.job, approved, ran: outcome.ran, reason: outcome.reason });
      } else if (step.kind === "stock") {
        const expected = step.outcome === "ok" ? `${step.count} in stock` : step.outcome === "no_match" ? "out of stock" : "unavailable right now; try again later";
        push({ actor: "model", kind: "tool_call", label: `${step.at} · ${input.tools.stock} {"part": "${step.part}"}` });
        const refused = allowed(input.tools.stock);
        if (refused) {
          push({ actor: "service", kind: "error", label: `Refused: ${refused}`, source: sources.permissions, tone: "bad" });
          stock.push({ at: step.at, part: step.part, outcome: step.outcome, told: "nothing (the lookup never ran)", expected, refused });
          continue;
        }
        const upstream = step.outcome === "ok" ? `${step.supplier} answered: ${step.count} units` : step.outcome === "no_match" ? `${step.supplier} search completed: 0 matching units`
          : step.outcome === "timeout" ? `${step.supplier} did not answer within ${step.seconds} s` : `${step.supplier} returned ${step.status}`;
        push({ actor: "service", kind: "output", label: `Supplier client · ${upstream}`, tone: step.outcome === "ok" || step.outcome === "no_match" ? undefined : "warn" });
        const key = results && Object.hasOwn(results, step.outcome) ? step.outcome : "no_match";
        const template = record(results?.[key]);
        const content = list(template?.content).map((block) => record(block)).find((block) => block?.type === "text");
        const result = { isError: template?.isError === true, text: fill(text(content?.text), { part: step.part, supplier: step.supplier, count: step.count ?? 0, seconds: step.seconds, status: step.status }) };
        push({ actor: "tool", kind: "tool_result", label: `CallToolResult · isError: ${result.isError}${key !== step.outcome ? ` (no ${step.outcome} template; used no_match’s)` : ""}`,
          detail: result.text || "(no text content)", source: serverAt(results && Object.hasOwn(results, key) ? pointer("stock_lookup", "results", key) : "/stock_lookup") });
        const told = readStock(result);
        push({ actor: "model", kind: "response", label: `Simulated · Claude tells staff: ${step.part}: ${told}`, tone: told === expected ? "ok" : "bad" });
        stock.push({ at: step.at, part: step.part, outcome: step.outcome, told, expected, refused: null });
      } else {
        push({ actor: "model", kind: "tool_call", label: `${step.at} · ${input.tools.cleanup} {"path": "${step.path}"}`, detail: `Resolves to ${step.resolved}` });
        const insideProject = inside(step.resolved, input.project);
        const refused = allowed(input.tools.cleanup);
        if (refused) {
          push({ actor: "service", kind: "error", label: `Refused: ${refused}`, source: sources.permissions, tone: insideProject ? "bad" : "ok" });
          cleanups.push({ at: step.at, path: step.path, resolved: step.resolved, inside: insideProject, ran: false, afterDelete: false, refused });
          continue;
        }
        let blocked = false;
        for (const guard of guards("PreToolUse", input.tools.cleanup)) {
          if (!guard.root) {
            push({ actor: "hook", kind: "error", label: `PreToolUse · ${input.guardScript} · exit 1: --root is missing`, detail: "A non-blocking error: the call goes ahead.", source: guard.source, tone: "bad" });
            continue;
          }
          const target = guard.resolve ? step.resolved : `${input.project}/${step.path.replace(/^\.\//, "")}`;
          const outside = !inside(target, guard.root);
          push({ actor: "hook", kind: "decision", label: `PreToolUse · ${input.guardScript} · exit ${outside ? 2 : 0}`, detail: `Compared ${target} with --root ${guard.root}.`, source: guard.source });
          if (outside) blocked = true;
        }
        if (blocked) {
          push({ actor: "tool", kind: "error", label: `${input.tools.cleanup} did not run`, detail: "Claude receives the hook’s message instead.", tone: insideProject ? "bad" : "ok" });
          cleanups.push({ at: step.at, path: step.path, resolved: step.resolved, inside: insideProject, ran: false, afterDelete: false, refused: null });
          continue;
        }
        push({ actor: "tool", kind: "output", label: `Deleted ${step.resolved}`, tone: insideProject ? "ok" : "bad" });
        let afterDelete = false;
        for (const guard of guards("PostToolUse", input.tools.cleanup).filter(({ root }) => root)) {
          const target = guard.resolve ? step.resolved : `${input.project}/${step.path.replace(/^\.\//, "")}`;
          const outside = !inside(target, guard.root!);
          afterDelete ||= outside;
          push({ actor: "hook", kind: "decision", label: `PostToolUse · ${input.guardScript} · exit ${outside ? 2 : 0}`,
            detail: `Compared ${target} with --root ${guard.root}${outside ? "; reported to Claude after the files were already deleted" : ""}.`, source: guard.source, tone: outside ? "warn" : undefined });
        }
        cleanups.push({ at: step.at, path: step.path, resolved: step.resolved, inside: insideProject, ran: true, afterDelete, refused: null });
      }
    }

    // --- deployment secrets ---
    const env = record(envFile.value)!;
    const problems: DeskOut["env"]["problems"][number][] = [];
    const keyOf = (value: string) => value.startsWith("vault:") ? input.vault[value.slice(6)] ?? null : input.literals[value] ?? (value.startsWith("sk-ant-") ? `literal:${value}` : null);
    const resolved: Record<string, string | null> = {};
    for (const name of input.environments) {
      const vars = record(env[name]);
      const where = envAt(vars ? pointer(name) : "");
      if (!vars) {
        problems.push({ message: `The ${name} deployment has no variables in deploy/env.json, so its backend cannot reach Claude`, source: where });
        resolved[name] = null;
        continue;
      }
      for (const [variable, raw] of Object.entries(vars)) {
        const value = text(raw);
        if (variable.startsWith("NEXT_PUBLIC_") && keyOf(value)) problems.push({ message: `The ${name} browser bundle contains ${variable}: anyone who opens the site can copy the key`, source: envAt(pointer(name, variable)) });
        if (value.startsWith("sk-ant-")) problems.push({ message: `deploy/env.json is committed with a literal API key for ${name}, so everyone who can read the repo has it`, source: envAt(pointer(name, variable)) });
      }
      const value = text(vars.ANTHROPIC_API_KEY);
      const key = value ? keyOf(value) : null;
      if (!value) problems.push({ message: `The ${name} backend could not authenticate: ANTHROPIC_API_KEY is not set`, source: where });
      else if (!key) problems.push({ message: `The ${name} backend could not authenticate: ${value} does not resolve to a key`, source: envAt(pointer(name, "ANTHROPIC_API_KEY")) });
      resolved[name] = key;
      push({ actor: "service", kind: "decision", label: `${name} deployment · ANTHROPIC_API_KEY ${key ? "resolves to a key" : "missing"}${Object.keys(vars).some((variable) => variable.startsWith("NEXT_PUBLIC_")) ? " · NEXT_PUBLIC_ variables inlined in the browser bundle" : ""}`, source: where });
    }
    const rotated = resolved[input.rotate];
    push({ actor: "person", kind: "request", label: `Rotate the ${input.rotate} key` });
    for (const name of input.environments.filter((entry) => entry !== input.rotate)) {
      if (rotated && resolved[name] === rotated) {
        problems.push({ message: `After the ${input.rotate} key was rotated, the ${name} backend got 401 authentication_error: both environments used the same key`, source: envAt(pointer(name, "ANTHROPIC_API_KEY")) });
        push({ actor: "service", kind: "error", label: `${name} backend · 401 authentication_error after the ${input.rotate} rotation`, tone: "bad" });
      } else if (resolved[name]) push({ actor: "service", kind: "output", label: `${name} backend still authenticates`, tone: "ok" });
    }
    const unique = problems.filter((problem, index) => problems.findIndex(({ message }) => message === problem.message) === index);
    problems.splice(0, problems.length, ...unique);
    for (const problem of problems) push({ actor: "service", kind: "error", label: problem.message, source: problem.source, tone: "bad" });

    return { trace, out: { injected, cancels, stock, cleanups, env: { problems }, sources },
      metrics: { wrongCancels: injected.reduce((total, { cancelled }) => total + cancelled.length, 0) + cancels.filter(({ ran, approved }) => ran && !approved).length,
        wrongDeletes: cleanups.filter(({ ran, inside: within }) => ran && !within).length } };
  },
};
