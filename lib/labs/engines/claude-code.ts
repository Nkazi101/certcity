// Claude Code session replay: a recorded session's tool calls run through the learner's .claude/settings.json hooks
// (event, matcher semantics, type "command", exit code 2 blocks a PreToolUse call; PostToolUse runs after the tool and
// can replace an MCP tool's output) and the desk handoff template. Matcher rule: letters, digits, _, -, spaces, commas
// and pipes form an exact list; anything else is an unanchored regular expression (hookMatcherMatches).
import { describeAction, expandEnv, hookMatcherMatches, list, permissionDecision, permissionRules, record, shellTokens, text } from "./parse";
import type { ToolAction } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type SessionStep =
  | {
      kind: "tool"; at: string; tool: string; summary: string;
      /** For booking changes: what the approvals ledger says when the call is made. */
      approval?: { id: string; current: boolean; room: string; note: string };
      /** For calendar reads: the epoch seconds the tool returns, and the ISO value it stands for. */
      epoch?: { value: number; iso: string; consumer: string };
    }
  | { kind: "event"; at: string; label: string }
  | { kind: "handoff"; at: string; ticket: Readonly<Record<string, string>>; required: readonly { field: string; value: string; label: string }[] };

export type SessionInput = {
  steps: readonly SessionStep[];
  /** Script names the shop's hooks are installed under. */
  scripts: { guard: string; normalizer: string };
};

type HookRun = { event: "PreToolUse" | "PostToolUse"; script: string; source: TraceSource };

export type SessionOut = {
  writes: readonly { at: string; tool: string; summary: string; approval: NonNullable<Extract<SessionStep, { kind: "tool" }>["approval"]>; ran: boolean; guardedAfter: boolean; source: TraceSource }[];
  wronglyBlocked: readonly { at: string; tool: string; summary: string; source: TraceSource }[];
  times: readonly { at: string; tool: string; delivered: string; iso: string; consumer: string; normalized: boolean; source: TraceSource }[];
  handoffs: readonly { ticket: string; body: string; missing: readonly string[]; source: TraceSource }[];
  sources: { settings: TraceSource; pre: TraceSource; post: TraceSource; template: TraceSource };
};

type Parsed = { settings: LocatedJson; template: string };

export function renderTemplate(template: string, values: Readonly<Record<string, string>>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key: string) => Object.hasOwn(values, key) ? values[key] : whole);
}

export const claudeCodeEngine: Engine<Parsed, SessionInput, SessionOut> = {
  id: "claude-code.session-replay",
  provider: "anthropic",
  label: "Claude Code session replay · hooks · desk handoff",
  simulated: false,
  parse(files) {
    const settings = parseLocatedJson(files.settings, ".claude/settings.json");
    if (settings.error !== undefined) return { ok: false, error: settings.error, source: { artifact: "settings" } };
    if (!record(settings.value.value)) return { ok: false, error: ".claude/settings.json must be a JSON object.", source: { artifact: "settings", line: 1 } };
    if (!(files.template ?? "").trim()) return { ok: false, error: ".claude/handoff.md is empty.", source: { artifact: "template", line: 1 } };
    return { ok: true, value: { settings: settings.value, template: files.template } };
  },
  run({ settings, template }, fixture: Fixture<SessionInput>): EngineRun<SessionOut> {
    const input = fixture.input;
    const at = (path: string): TraceSource => ({ artifact: "settings", pointer: path, line: lineOf(settings, path) });
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const hooks = record(record(settings.value)?.hooks);
    const scriptOf = (command: unknown) => {
      const tokens = shellTokens(text(command)).value?.flat() ?? [];
      return [input.scripts.guard, input.scripts.normalizer].find((script) => tokens.some((token) => token.endsWith(script))) ?? null;
    };
    /** Hook scripts that fire for a tool at an event, with where they are registered. */
    const firing = (event: "PreToolUse" | "PostToolUse", tool: string): HookRun[] =>
      list(hooks?.[event]).flatMap((entry, index) => {
        const group = record(entry);
        if (!group || !hookMatcherMatches(group.matcher, tool)) return [];
        return list(group.hooks).flatMap((hook, inner) => {
          const command = record(hook);
          const script = command?.type === "command" ? scriptOf(command.command) : null;
          return script ? [{ event, script, source: at(pointer("hooks", event, index, "hooks", inner)) }] : [];
        });
      });
    const sources = { settings: at(""), pre: at(hooks?.PreToolUse ? "/hooks/PreToolUse" : "/hooks"), post: at(hooks?.PostToolUse ? "/hooks/PostToolUse" : "/hooks"), template: { artifact: "template", line: 1 } };
    const writes: SessionOut["writes"][number][] = [];
    const wronglyBlocked: SessionOut["wronglyBlocked"][number][] = [];
    const times: SessionOut["times"][number][] = [];
    const handoffs: SessionOut["handoffs"][number][] = [];
    push({ actor: "learner-artifact", kind: "request", label: `Session starts · hooks loaded: ${Object.keys(hooks ?? {}).join(", ") || "none"}`, source: sources.settings });

    for (const step of input.steps) {
      if (step.kind === "event") {
        push({ actor: "person", kind: "decision", label: `${step.at} · ${step.label}` });
        continue;
      }
      if (step.kind === "handoff") {
        const body = renderTemplate(template, step.ticket);
        const missing = step.required.filter(({ value }) => !body.includes(value)).map(({ label }) => label);
        handoffs.push({ ticket: step.ticket.ticket ?? "", body, missing, source: sources.template });
        push({ actor: "model", kind: "tool_call", label: `${step.at} · mcp__desk__handoff · ticket ${step.ticket.ticket}`, detail: body, source: sources.template, tone: missing.length ? "warn" : "ok" });
        push({ actor: "person", kind: "output", label: missing.length ? `Staff tray · ticket ${step.ticket.ticket} arrives without: ${missing.join(", ")}` : `Staff tray · ticket ${step.ticket.ticket} ready to act on`, tone: missing.length ? "bad" : "ok" });
        continue;
      }
      push({ actor: "model", kind: "tool_call", label: `${step.at} · ${step.tool}`, detail: step.summary });
      const pre = firing("PreToolUse", step.tool);
      const guardsBefore = pre.filter(({ script }) => script === input.scripts.guard);
      for (const hook of pre.filter(({ script }) => script === input.scripts.normalizer)) {
        push({ actor: "hook", kind: "decision", label: `PreToolUse · ${hook.script} · exit 0`, detail: "There is no tool output yet, so there is nothing to convert.", source: hook.source });
      }
      let blocked = false;
      if (guardsBefore.length) {
        const allowed = step.approval?.current === true;
        blocked = !allowed;
        push({ actor: "hook", kind: "decision", label: `PreToolUse · ${input.scripts.guard} · exit ${allowed ? 0 : 2}`,
          detail: allowed ? `${step.approval!.id} is current for room ${step.approval!.room}.` : step.approval ? `No current approval for room ${step.approval.room} (${step.approval.note}).` : "No booking change to approve in this call.",
          source: guardsBefore[0].source, tone: allowed ? "ok" : step.approval ? "ok" : "bad" });
      }
      if (blocked) {
        push({ actor: "tool", kind: "error", label: `${step.tool} did not run`, detail: "Claude receives the hook’s message instead of the tool result.", tone: step.approval ? "ok" : "bad" });
        if (step.approval) writes.push({ at: step.at, tool: step.tool, summary: step.summary, approval: step.approval, ran: false, guardedAfter: false, source: guardsBefore[0].source });
        else wronglyBlocked.push({ at: step.at, tool: step.tool, summary: step.summary, source: guardsBefore[0].source });
        continue;
      }
      if (step.approval?.current === false) {
        push({ actor: "tool", kind: "output", label: `${step.tool} ran · ${step.summary}`, tone: "bad" });
      } else if (step.approval?.current) {
        push({ actor: "tool", kind: "output", label: `${step.tool} ran · ${step.summary}`, tone: "ok" });
      } else if (step.epoch) {
        push({ actor: "tool", kind: "tool_result", label: `${step.tool} returned`, detail: `{"start": ${step.epoch.value}}` });
      } else push({ actor: "tool", kind: "tool_result", label: `${step.tool} ran` });
      const post = firing("PostToolUse", step.tool);
      const guardsAfter = post.filter(({ script }) => script === input.scripts.guard);
      if (guardsAfter.length) {
        const allowed = step.approval?.current === true;
        push({ actor: "hook", kind: "decision", label: `PostToolUse · ${input.scripts.guard} · exit ${allowed ? 0 : 2}`,
          detail: allowed ? "Approval found." : `Reported to Claude after ${step.tool} had already run.`, source: guardsAfter[0].source, tone: allowed ? undefined : "warn" });
      }
      if (step.approval) writes.push({ at: step.at, tool: step.tool, summary: step.summary, approval: step.approval, ran: true, guardedAfter: guardsAfter.length > 0, source: guardsAfter[0]?.source ?? sources.pre });
      if (step.epoch) {
        const normalizer = post.find(({ script }) => script === input.scripts.normalizer);
        const normalized = !!normalizer && step.tool.startsWith("mcp__");
        if (normalizer) {
          push({ actor: "hook", kind: "decision", label: `PostToolUse · ${input.scripts.normalizer}`, source: normalizer.source,
            detail: normalized ? `updatedMCPToolOutput → {"start": "${step.epoch.iso}"}` : `${step.tool} is not an MCP tool, so its output cannot be replaced.` });
        }
        const delivered = normalized ? step.epoch.iso : String(step.epoch.value);
        const delivery = { at: step.at, tool: step.tool, delivered, iso: step.epoch.iso, consumer: step.epoch.consumer, normalized,
          source: normalizer?.source ?? sources.post };
        times.push(delivery);
        push({ actor: "model", kind: "tool_call", label: `${step.epoch.consumer} · start: ${JSON.stringify(delivered)}`,
          detail: normalized ? "Accepted." : "Rejected: start must be an ISO 8601 date-time.", tone: normalized ? "ok" : "bad" });
      }
    }
    return { trace, out: { writes, wronglyBlocked, times, handoffs, sources }, metrics: {
      unapprovedRan: writes.filter(({ ran, approval }) => ran && !approval.current).length,
      blockedWrongly: wronglyBlocked.length,
    } };
  },
};

// ---------------------------------------------------------------------------------------------
// Claude Code configuration replay: which MCP servers a checkout loads (local > project > user scope, ${VAR} expansion
// from the machine's environment), whose credentials they connect with, and what a headless session may do under the
// project's permission rules (deny → ask → allow; with nobody to answer, ask and unmatched calls are refused).

export type ServerSpec = Readonly<Record<string, unknown>>;
export type Machine = {
  owner: string;
  /** How symptoms name the machine, e.g. "Sam’s laptop". */
  label: string;
  env: Readonly<Record<string, string>>;
  /** Servers in this machine's user scope (~/.claude.json). A fresh checkout has none. */
  userServers: Readonly<Record<string, ServerSpec>>;
};
export type ConfigAttempt = { action: ToolAction; result: string; quality: "right" | "wrong-tool" | "broad" | "write" };
export type ConfigStep = { at: string; goal: string; attempts: readonly ConfigAttempt[]; needs?: string };
export type ConfigInput = {
  machine: Machine;
  /** Every engineer's credentials, so a committed or borrowed one can be recognised. */
  secrets: readonly { owner: string; value: string }[];
  /** What each shared server must be, and the tools it provides. */
  servers: Readonly<Record<string, { transport: "http" | "stdio"; url?: string; package?: string; credential: string; tools: readonly string[] }>>;
  /** Servers that belong to one engineer and must never be committed. */
  personal: readonly { name: string; owner: string; url: string }[];
  steps: readonly ConfigStep[];
};

export type ConfigOut = {
  servers: readonly { name: string; scope: "project" | "user" | "missing"; connected: boolean; identity?: string; problem?: string; source: TraceSource }[];
  committedSecrets: readonly { owner: string; source: TraceSource }[];
  personalCommitted: readonly { name: string; owner: string; source: TraceSource }[];
  steps: readonly { at: string; goal: string; used: ConfigAttempt | null; refused: readonly string[]; unavailable: readonly string[]; source: TraceSource }[];
  sources: { mcp: TraceSource; permissions: TraceSource };
};

type ConfigParsed = { mcp: LocatedJson; settings: LocatedJson; mcpText: string };

function expandDeep(value: unknown, env: Readonly<Record<string, string>>): unknown {
  if (typeof value === "string") return expandEnv(value, env as Record<string, string>);
  if (Array.isArray(value)) return value.map((item) => expandDeep(item, env));
  const object = record(value);
  return object ? Object.fromEntries(Object.entries(object).map(([key, item]) => [key, expandDeep(item, env)])) : value;
}

export const claudeConfigEngine: Engine<ConfigParsed, ConfigInput, ConfigOut> = {
  id: "claude-code.config-replay",
  provider: "anthropic",
  label: "Claude Code checkout replay · MCP scopes · permission rules (headless)",
  simulated: false,
  parse(files) {
    const mcp = parseLocatedJson(files.mcp, ".mcp.json");
    if (mcp.error !== undefined) return { ok: false, error: mcp.error, source: { artifact: "mcp" } };
    const settings = parseLocatedJson(files.settings, ".claude/settings.json");
    if (settings.error !== undefined) return { ok: false, error: settings.error, source: { artifact: "settings" } };
    if (!record(record(mcp.value.value)?.mcpServers)) return { ok: false, error: ".mcp.json needs a top-level \"mcpServers\" object keyed by server name.", source: { artifact: "mcp", line: 1 } };
    return { ok: true, value: { mcp: mcp.value, settings: settings.value, mcpText: files.mcp } };
  },
  run({ mcp, settings, mcpText }, fixture: Fixture<ConfigInput>): EngineRun<ConfigOut> {
    const input = fixture.input;
    const { machine } = input;
    const atMcp = (path: string): TraceSource => ({ artifact: "mcp", pointer: path, line: lineOf(mcp, path) });
    const atSettings = (path: string): TraceSource => ({ artifact: "settings", pointer: path, line: lineOf(settings, path) });
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const project = record(record(mcp.value)?.mcpServers) ?? {};
    const sources = { mcp: atMcp("/mcpServers"), permissions: atSettings(record(record(settings.value)?.permissions) ? "/permissions" : "") };
    push({ actor: "person", kind: "request", label: `${machine.owner} opens the repo · ${Object.keys(machine.userServers).length ? `user-scope servers: ${Object.keys(machine.userServers).join(", ")}` : "fresh checkout, no user-scope servers"}` });

    const committedSecrets = input.secrets.filter(({ value }) => mcpText.includes(value)).map(({ owner, value }) => {
      const line = mcpText.slice(0, mcpText.indexOf(value)).split("\n").length;
      return { owner, source: { artifact: "mcp", line } };
    });
    for (const { owner, source } of committedSecrets) push({ actor: "learner-artifact", kind: "decision", label: `.mcp.json contains ${owner}’s credential and is committed to the repo`, source, tone: "bad" });
    const personalCommitted = input.personal.filter(({ name }) => Object.hasOwn(project, name)).map(({ name, owner }) => ({ name, owner, source: atMcp(pointer("mcpServers", name)) }));

    // --- servers ---
    const identityOf = (value: string) => input.secrets.find((secret) => value.includes(secret.value))?.owner;
    const servers: ConfigOut["servers"][number][] = Object.entries(input.servers).map(([name, spec]) => {
      const fromProject = record(project[name]);
      const raw = fromProject ?? record(machine.userServers[name]);
      const scope = fromProject ? "project" as const : raw ? "user" as const : "missing" as const;
      const source = fromProject ? atMcp(pointer("mcpServers", name)) : sources.mcp;
      if (!raw) return { name, scope, connected: false, problem: `no server named ${name} is configured on this checkout`, source };
      const server = record(expandDeep(raw, machine.env)) ?? {};
      const unresolved = JSON.stringify(server).match(/\$\{[A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?\}/)?.[0];
      if (spec.transport === "http") {
        if (server.type !== "http" && server.type !== "streamable-http") {
          return { name, scope, connected: false, problem: typeof server.command === "string" ? "it is configured as a local command" : "no \"type\" is set, so Claude Code looks for a local command to start and finds none", source };
        }
        if (text(server.url) !== spec.url) return { name, scope, connected: false, problem: `the url resolves to ${JSON.stringify(text(server.url))}`, source };
      } else {
        const argv = [text(server.command), ...list(server.args).map(text)];
        if (server.type === "http" || !text(server.command)) return { name, scope, connected: false, problem: "there is no command to start it", source };
        if (!argv.includes(spec.package!)) return { name, scope, connected: false, problem: `the command does not start ${spec.package}`, source };
      }
      if (unresolved) return { name, scope, connected: false, problem: `${unresolved} is not set in ${machine.owner}’s environment, so the server starts without a credential`, source };
      const credential = spec.transport === "http" ? JSON.stringify(record(server.headers) ?? {}) : JSON.stringify(record(server.env) ?? {});
      const identity = identityOf(credential);
      if (!identity) return { name, scope, connected: false, problem: "it was rejected: no valid credential was sent", source };
      return { name, scope, connected: true, identity, source };
    });
    for (const server of servers) {
      push({ actor: "service", kind: server.connected ? "response" : "error", source: server.source,
        label: server.connected ? `MCP ${server.name} connected (${server.scope} scope) as ${server.identity}` : `MCP ${server.name} unavailable`,
        detail: server.problem, tone: server.connected ? server.identity === machine.owner ? "ok" : "bad" : "bad" });
    }
    for (const { name, owner, source } of personalCommitted) {
      const entry = input.personal.find((server) => server.name === name)!;
      push({ actor: "service", kind: owner === machine.owner ? "response" : "error", source, tone: "bad",
        label: owner === machine.owner ? `MCP ${name} loaded from the committed .mcp.json` : `MCP ${name} failed to connect: ${entry.url} refused`,
        detail: `${name} is ${owner}’s experiment; every checkout of the repo now tries to load it.` });
    }

    // --- the headless triage session ---
    const rules = permissionRules(record(settings.value));
    const toolsAvailable = new Set(servers.filter(({ connected }) => connected).flatMap(({ name }) => input.servers[name].tools.map((tool) => `mcp__${name}__${tool}`)));
    const steps = input.steps.map((step) => {
      const refused: string[] = [];
      const unavailable: string[] = [];
      let used: ConfigAttempt | null = null;
      push({ actor: "person", kind: "request", label: `${step.at} · ${step.goal}` });
      for (const attempt of step.attempts) {
        const name = describeAction(attempt.action);
        if (attempt.action.tool.startsWith("mcp__") && !toolsAvailable.has(attempt.action.tool)) {
          unavailable.push(attempt.action.tool);
          push({ actor: "model", kind: "tool_call", label: `${name} · tool not available on this checkout`, tone: "warn" });
          continue;
        }
        const decision = permissionDecision(rules, attempt.action);
        if (decision !== "allow") {
          refused.push(name);
          push({ actor: "service", kind: "decision", label: `${name} · ${decision === "deny" ? "denied by a rule" : decision === "ask" ? "needs approval; nobody can answer in a headless run" : "no rule allows it; refused in a headless run"}`, source: sources.permissions });
          continue;
        }
        used = attempt;
        push({ actor: "tool", kind: "tool_result", label: `${name} · allowed`, detail: attempt.result, source: sources.permissions,
          tone: attempt.quality === "right" ? "ok" : "bad" });
        break;
      }
      if (!used) push({ actor: "model", kind: "response", label: `Claude stops: no permitted way to ${step.goal.toLowerCase()}`, tone: step.attempts.some(({ quality }) => quality === "right") ? "bad" : "ok" });
      return { at: step.at, goal: step.goal, used, refused, unavailable, source: sources.permissions };
    });
    return { trace, out: { servers, committedSecrets, personalCommitted, steps, sources }, metrics: {
      connected: servers.filter(({ connected, identity }) => connected && identity === machine.owner).length, servers: servers.length,
    } };
  },
};
