// Gateway authorization replay (provider-neutral): the learner's authz policy decides where tenant scope comes from,
// where it is enforced, which tools each assistant client may run and is offered, and how scheduled jobs are routed.
// A worst-case model follows every instruction it reads, including ones planted in data, so only the service boundary
// and the tool allowlists hold. Tampered fields, injected notes, write requests and the nightly files are replayed.
import { list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type GatewayTool = { name: string; write: boolean; /** Reads repair records, scoped by tenant. */ lookup?: boolean };
export type Record_ = { id: string; tenant: string; summary: string };
export type GatewayStep =
  | { kind: "discover"; client: string }
  | { kind: "smoke"; client: string; token: string }
  | {
    kind: "request"; id: string; client: string; token: string; label: string;
    /** Tenant values a client put in the request (a bug or tampering). */
    fields?: { body?: string; header?: string };
    /** What a model that follows every instruction it reads would call, in order. */
    calls: readonly { tool: string; job?: string; tenant?: string; from: "user" | "injected" }[];
    /** The tenant the conversation's text claims (what a model would pick if asked to decide). */
    claimed?: string;
  }
  | { kind: "job"; job: string; files: readonly { name: string; rows: number; ambiguousDates: boolean }[] };
export type GatewayInput = {
  tools: readonly GatewayTool[];
  records: readonly Record_[];
  contracts: Readonly<Record<string, readonly string[]>>;
  steps: readonly GatewayStep[];
};

type Policy = {
  located: LocatedJson;
  tenantFrom: string;
  enforceAt: string;
  toolsList: string;
  clients: Readonly<Record<string, readonly string[]>>;
  jobs: Readonly<Record<string, string>>;
};

export type GatewayOut = {
  offeredDenied: readonly { client: string; tools: readonly string[]; source: TraceSource }[];
  contractFailures: readonly { client: string; tool: string; why: "denied" | "not offered" | "unknown client"; source: TraceSource }[];
  outOfContract: readonly { client: string; tool: string; request: string; from: "user" | "injected"; source: TraceSource }[];
  leaks: readonly { request: string; record: string; tenant: string; scope: string; via: "field" | "injection" | "lookup"; source: TraceSource }[];
  refusedOffered: readonly { client: string; tool: string; request: string }[];
  jobs: readonly { job: string; route: string; modelTurns: number; wrongRows: number; ran: boolean; source: TraceSource }[];
  requests: readonly { id: string; label: string; injected: boolean; tampered: boolean }[];
};

const file = "authz.json";

export function toolAllowed(entries: readonly string[], tool: string) {
  return entries.some((entry) => entry === "*" || entry === tool || (entry.endsWith(".*") && tool.startsWith(entry.slice(0, -1))));
}

function parsePolicy(source: string | undefined): { ok: true; value: Policy } | { ok: false; error: string } {
  const parsed = parseLocatedJson(source, file);
  if (parsed.error !== undefined) return { ok: false, error: parsed.error };
  const root = record(parsed.value.value);
  if (!root) return { ok: false, error: `${file} must be a JSON object at the top level.` };
  const clientsRecord = record(root.clients);
  if (!clientsRecord) return { ok: false, error: `${file} needs a "clients" object: one tool list per assistant client.` };
  const clients = Object.fromEntries(Object.entries(clientsRecord).map(([client, tools]) => [client, list(tools).map(text).filter(Boolean)]));
  const jobs = Object.fromEntries(Object.entries(record(root.jobs) ?? {}).map(([job, route]) => [job, text(route).toLowerCase()]));
  const scope = record(root.tenant_scope);
  return { ok: true, value: { located: parsed.value, tenantFrom: text(scope?.from).toLowerCase(), enforceAt: text(root.enforce_at).toLowerCase(), toolsList: text(root.tools_list).toLowerCase(), clients, jobs } };
}

export const authzEngine: Engine<Policy, GatewayInput, GatewayOut> = {
  id: "neutral.authz",
  provider: "neutral",
  label: "Gateway policy replayed on tenant traffic, a worst-case model and the nightly files",
  simulated: false,
  parse(files) {
    const result = parsePolicy(files.authz);
    return result.ok ? result : { ok: false, error: result.error, source: { artifact: "authz", line: 1 } };
  },
  run(policy, fixture: Fixture<GatewayInput>): EngineRun<GatewayOut> {
    const { tools, records, contracts, steps } = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const at = (where: string): TraceSource => ({ artifact: "authz", pointer: where, line: lineOf(policy.located, where) });
    const allowedFor = (client: string) => policy.clients[client] ?? [];
    const allowed = (client: string, tool: string) => client in policy.clients && toolAllowed(allowedFor(client), tool);
    const offered = (client: string) => {
      if (!(client in policy.clients) && !/all|static|every/.test(policy.toolsList)) return [];
      return /allow|scope|author|filter/.test(policy.toolsList) ? tools.filter(({ name }) => allowed(client, name)).map(({ name }) => name) : tools.map(({ name }) => name);
    };
    const serviceEnforces = /service|lookup|data|server|gateway/.test(policy.enforceAt);
    type Mutable = { -readonly [K in keyof GatewayOut]: GatewayOut[K] extends readonly (infer T)[] ? T[] : never };
    const out: Mutable = {
      offeredDenied: [], contractFailures: [], outOfContract: [], leaks: [], refusedOffered: [], jobs: [], requests: [],
    };
    push({ actor: "learner-artifact", kind: "request", label: `${file} · scope from ${policy.tenantFrom || "(unset)"} · enforced at ${policy.enforceAt || "(unset)"} · tools/list ${policy.toolsList || "(unset)"}`, source: at("") });

    for (const step of steps) {
      if (step.kind === "discover") {
        const shown = offered(step.client);
        const refused = shown.filter((tool) => !allowed(step.client, tool));
        if (refused.length) out.offeredDenied.push({ client: step.client, tools: refused, source: at("/tools_list") });
        push({ actor: "service", kind: "response", label: `tools/list for ${step.client}: ${shown.length} tools`, detail: shown.join(", ") || "(none)",
          source: at(pointer("clients", step.client)), tone: refused.length ? "warn" : undefined });
        continue;
      }
      if (step.kind === "smoke") {
        const shown = new Set(offered(step.client));
        const results = (contracts[step.client] ?? []).map((tool) => {
          const why = !(step.client in policy.clients) ? "unknown client" as const : !allowed(step.client, tool) ? "denied" as const : !shown.has(tool) ? "not offered" as const : null;
          if (why) out.contractFailures.push({ client: step.client, tool, why, source: at(step.client in policy.clients ? pointer("clients", step.client) : "/clients") });
          return `${tool} ${why ? `✗ ${why}` : "✓"}`;
        });
        push({ actor: "tool", kind: "tool_result", label: `${step.client} runs its contract reads for ${step.token}`, detail: results.join(" · "),
          source: at(step.client in policy.clients ? pointer("clients", step.client) : "/clients"), tone: results.some((entry) => entry.includes("✗")) ? "bad" : "ok" });
        continue;
      }
      if (step.kind === "job") {
        const route = policy.jobs[step.job];
        const source = at(route ? pointer("jobs", step.job) : "/jobs");
        const ran = !!route;
        const deterministic = !!route && /bulk|api|endpoint|batch-endpoint|etl|script/.test(route) && !/agent|model|claude|mcp/.test(route);
        const modelTurns = ran && !deterministic ? step.files.length : 0;
        const wrongRows = ran && !deterministic ? step.files.filter(({ ambiguousDates }) => ambiguousDates).reduce((sum, { rows }) => sum + rows, 0) : 0;
        out.jobs.push({ job: step.job, route: route ?? "(none)", modelTurns, wrongRows, ran, source });
        if (!ran) { push({ actor: "service", kind: "error", label: `${step.job}: no route in ${file}; the files wait in the inbox`, source, tone: "bad" }); continue; }
        if (deterministic) push({ actor: "service", kind: "output", label: `${step.job} → versioned bulk endpoint: ${step.files.reduce((sum, { rows }) => sum + rows, 0)} rows, 0 model turns`, source, tone: "ok" });
        else for (const item of step.files) push({ actor: "model", kind: "output", label: `${step.job}: a model turn reads ${item.name} (${item.rows} rows)`,
          detail: item.ambiguousDates ? "Dates such as 03/04 were read month-first; the partner writes day-first." : undefined, source, tone: item.ambiguousDates ? "bad" : undefined });
        continue;
      }
      // A request through the gateway.
      const tampered = !!(step.fields?.body || step.fields?.header);
      out.requests.push({ id: step.id, label: step.label, injected: step.calls.some(({ from }) => from === "injected"), tampered });
      let scope = step.token;
      if (/body/.test(policy.tenantFrom)) scope = step.fields?.body ?? step.token;
      else if (/header/.test(policy.tenantFrom)) scope = step.fields?.header ?? step.token;
      else if (/prompt|model|conversation/.test(policy.tenantFrom)) scope = step.claimed ?? step.token;
      else if (!/token|claim|jwt|identity|session/.test(policy.tenantFrom)) scope = "";
      push({ actor: "person", kind: "request", label: `${step.id} · ${step.client} · token for ${step.token}: ${step.label}`,
        detail: [step.fields?.body && `body.tenant = ${step.fields.body}`, step.fields?.header && `x-tenant header = ${step.fields.header}`, `scope used: ${scope || "(none)"}`].filter(Boolean).join(" · "),
        source: at("/tenant_scope"), tone: scope !== step.token ? "warn" : undefined });
      const shown = new Set(offered(step.client));
      for (const call of step.calls) {
        if (!shown.has(call.tool)) {
          push({ actor: "model", kind: "decision", label: `The model has no ${call.tool} tool and tells the customer staff will handle it`, source: at("/tools_list"), tone: "ok" });
          continue;
        }
        if (!allowed(step.client, call.tool)) {
          out.refusedOffered.push({ client: step.client, tool: call.tool, request: step.id });
          push({ actor: "service", kind: "error", label: `${call.tool} called → gateway refuses: not permitted for ${step.client}`, detail: "The customer sees a tool error mid-conversation.", source: at(pointer("clients", step.client)), tone: "warn" });
          continue;
        }
        const tool = tools.find(({ name }) => name === call.tool)!;
        if (!(contracts[step.client] ?? []).includes(call.tool)) out.outOfContract.push({ client: step.client, tool: call.tool, request: step.id, from: call.from, source: at(pointer("clients", step.client)) });
        if (!tool.lookup) {
          push({ actor: "tool", kind: "tool_result", label: `${call.tool}${call.job ? ` {job: ${call.job}}` : ""}${call.from === "injected" ? " (instruction found in the case’s documents)" : ""} → ${tool.write ? "write executed" : "ran"}`,
            source: at(pointer("clients", step.client)), tone: (contracts[step.client] ?? []).includes(call.tool) ? undefined : "bad" });
          continue;
        }
        // The lookup: with service enforcement the verified scope replaces any tenant the call names.
        const wanted = serviceEnforces ? scope : call.tenant ?? (call.job ? records.find(({ id }) => id === call.job)?.tenant : undefined) ?? scope;
        const rows = records.filter((row) => (!call.job || row.id === call.job) && row.tenant === wanted);
        const foreign = rows.filter((row) => row.tenant !== step.token);
        if (foreign.length) out.leaks.push({ request: step.id, record: foreign[0].id, tenant: foreign[0].tenant, scope: scope || "(none)", via: call.from === "injected" ? "injection" : tampered ? "field" : "lookup", source: at(serviceEnforces ? "/tenant_scope" : "/enforce_at") });
        push({ actor: "tool", kind: "tool_result", label: `${call.tool}${call.job ? ` {job: ${call.job}}` : ""}${call.tenant ? ` {tenant: ${call.tenant}}` : ""}${call.from === "injected" ? " (instruction found in the case’s documents)" : ""} → ${rows.length ? `${rows.length} record${rows.length === 1 ? "" : "s"} of ${rows[0].tenant}` : `nothing for ${wanted || "(no tenant)"}`}`,
          detail: rows.length ? rows.slice(0, 2).map(({ id, summary }) => `${id}: ${summary}`).join(" · ") : undefined,
          source: at(serviceEnforces ? "/enforce_at" : "/tenant_scope"), tone: foreign.length || !(contracts[step.client] ?? []).includes(call.tool) ? "bad" : undefined });
      }
    }
    for (const [client, entries] of Object.entries(policy.clients)) if (!(client in contracts)) push({ actor: "service", kind: "decision", label: `Client “${client}” in ${file} matches no assistant at the gateway (${entries.length} entries ignored)`, source: at(pointer("clients", client)), tone: "warn" });
    return { trace, out, metrics: { leaks: out.leaks.length, outOfContract: out.outOfContract.length, modelTurns: out.jobs.reduce((sum, { modelTurns }) => sum + modelTurns, 0) } };
  },
};
