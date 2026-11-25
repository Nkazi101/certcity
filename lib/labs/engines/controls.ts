// Production controls replay (provider-neutral): the learner's controls file decides which sources count as sign-off,
// which roles must sign, which fields of a write a sign-off is bound to, what diagnostics record, which stores a
// deletion reaches, and what a resident is told for each tool result state. Pending writes, a diagnostic event, a
// deletion request and supplier lookups are replayed against the approval ledger and the data map.
import { list, record, text } from "./parse";
import { lineOf, parseLocatedJson, pointer } from "./located-json";
import type { LocatedJson } from "./located-json";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type SignOff = { case: string; role: string; version: number; amount: number; payee: string };
export type PendingWrite = { id: string; case: string; version: number; amount: number; payee: string; label: string; attachmentClaim?: string; shouldRun: boolean };
export type ToolCall = { tool: string; state: "error" | "empty"; detail: string };
export type ControlsInput = {
  ledger: readonly SignOff[];
  writes: readonly PendingWrite[];
  /** Diagnostic fields that carry case content or personal data. */
  sensitiveFields: readonly string[];
  diagnosticFields: readonly string[];
  stores: readonly { name: string; holds: string }[];
  deletionCase: string;
  calls: readonly ToolCall[];
  replies: Readonly<Record<string, string>>;
};

type Parsed = {
  located: LocatedJson;
  sources: readonly string[];
  roles: readonly string[];
  bound: readonly string[];
  fields: readonly string[];
  stores: readonly string[];
  states: Readonly<Record<string, { error: string; empty: string }>>;
};

export type ControlsOut = {
  writes: readonly { write: PendingWrite; ran: boolean; byAttachment: boolean; missing: readonly string[]; source: TraceSource }[];
  diagnostics: { leaked: readonly string[]; unknown: readonly string[]; source: TraceSource };
  retained: readonly { store: string; source: TraceSource }[];
  replies: readonly { call: ToolCall; reply: string; right: boolean; source: TraceSource }[];
};

const file = "controls.json";
const strings = (value: unknown) => list(value).map(text).map((entry) => entry.trim().toLowerCase()).filter(Boolean);

export const controlsEngine: Engine<Parsed, ControlsInput, ControlsOut> = {
  id: "neutral.controls",
  provider: "neutral",
  label: "Controls replayed on pending writes, a diagnostic event, a deletion request and supplier lookups",
  simulated: false,
  parse(files) {
    const parsed = parseLocatedJson(files.controls, file);
    if (parsed.error !== undefined) return { ok: false, error: parsed.error, source: { artifact: "controls", line: 1 } };
    const root = record(parsed.value.value);
    if (!root) return { ok: false, error: `${file} must be a JSON object at the top level.`, source: { artifact: "controls", line: 1 } };
    const guard = record(root.write_guard) ?? {};
    const states = Object.fromEntries(Object.entries(record(root.tool_states) ?? {}).map(([tool, value]) => {
      const entry = record(value) ?? {};
      return [tool, { error: text(entry.on_error).toLowerCase(), empty: text(entry.on_empty).toLowerCase() }];
    }));
    return { ok: true, value: {
      located: parsed.value, sources: strings(record(root.authority)?.approvals_from), roles: strings(guard.required_signoffs), bound: strings(guard.bound_to),
      fields: strings(record(root.diagnostics)?.fields), stores: strings(record(root.deletion)?.stores), states,
    } };
  },
  run(parsed, fixture: Fixture<ControlsInput>): EngineRun<ControlsOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const at = (where: string): TraceSource => ({ artifact: "controls", pointer: where, line: lineOf(parsed.located, where) });
    push({ actor: "learner-artifact", kind: "request", label: `${file} · sign-off from ${parsed.sources.join(", ") || "(nothing)"} · needs ${parsed.roles.join(" + ") || "(no one)"} · bound to ${parsed.bound.join(", ") || "(nothing)"}`, source: at("") });

    const documentsCount = parsed.sources.some((source) => /attach|document|upload|case-file|evidence/.test(source));
    const ledgerCounts = parsed.sources.some((source) => /ledger/.test(source));
    const writes = input.writes.map((write) => {
      const mismatches: string[] = [];
      const missing = parsed.roles.filter((role) => {
        const candidates = ledgerCounts ? input.ledger.filter((entry) => entry.case === write.case && entry.role === role) : [];
        const match = candidates.find((entry) => parsed.bound.every((field) => {
          if (/version/.test(field)) return entry.version === write.version;
          if (/amount/.test(field)) return entry.amount === write.amount;
          if (/payee/.test(field)) return entry.payee === write.payee;
          return true;
        }));
        if (!match && candidates.length) mismatches.push(`${role} signed v${candidates[0].version} · $${candidates[0].amount} · ${candidates[0].payee}`);
        return !match;
      });
      const byAttachment = missing.length > 0 && documentsCount && !!write.attachmentClaim;
      const ran = missing.length === 0 || byAttachment;
      const source = at(byAttachment ? "/authority" : missing.length ? "/write_guard/required_signoffs" : "/write_guard/bound_to");
      push({ actor: "service", kind: "decision", label: `${write.id} · ${write.label} (v${write.version}, $${write.amount}, ${write.payee}) → ${ran ? "write runs" : "held for sign-off"}`,
        detail: byAttachment ? `Counted as approved: the attachment says “${write.attachmentClaim}”.` : missing.length ? `Missing: ${missing.join(", ")}${mismatches.length ? ` (ledger: ${mismatches.join("; ")})` : ""}` : `Ledger sign-offs: ${parsed.roles.join(", ") || "none required"}`,
        source, tone: ran !== write.shouldRun ? "bad" : ran ? "ok" : undefined });
      return { write, ran, byAttachment, missing, source };
    });

    const leaked = parsed.fields.filter((field) => input.sensitiveFields.includes(field));
    const unknown = parsed.fields.filter((field) => !input.sensitiveFields.includes(field) && !input.diagnosticFields.includes(field));
    push({ actor: "service", kind: "output", label: `Diagnostic event for a failed write records: ${parsed.fields.join(", ") || "(nothing)"}`,
      detail: leaked.length ? `Case content leaves the source system in: ${leaked.join(", ")}` : undefined, source: at("/diagnostics/fields"), tone: leaked.length ? "bad" : "ok" });

    const retained = input.stores.filter(({ name }) => !parsed.stores.includes(name)).map(({ name }) => ({ store: name, source: at("/deletion/stores") }));
    for (const store of input.stores) {
      const kept = !parsed.stores.includes(store.name);
      push({ actor: "service", kind: "output", label: `Deletion of case ${input.deletionCase} · ${store.name} (${store.holds}): ${kept ? "still holds the case" : "deleted and verified"}`, source: at("/deletion/stores"), tone: kept ? "bad" : "ok" });
    }

    const replies = input.calls.map((call) => {
      const mapping = parsed.states[call.tool];
      const key = mapping ? (call.state === "error" ? mapping.error : mapping.empty) : "";
      const reply = input.replies[key] ?? (key ? `“${key}” (no such reply template; the resident sees a blank message)` : "(no mapping; the resident sees a blank message)");
      const right = call.state === "error" ? /unavailable|could not|couldn|try again|follow up/.test(key) : /no[-_ ]?capacity|none|no[-_ ]results/.test(key);
      const source = at(mapping ? pointer("tool_states", call.tool, call.state === "error" ? "on_error" : "on_empty") : "/tool_states");
      push({ actor: "tool", kind: "tool_result", label: `${call.tool}: ${call.detail}`, detail: `Resident is told: ${reply}`, source, tone: right ? "ok" : "bad" });
      return { call, reply, right, source };
    });
    return { trace, out: { writes, diagnostics: { leaked, unknown, source: at("/diagnostics/fields") }, retained, replies },
      metrics: { wrongWrites: writes.filter(({ ran, write }) => ran && !write.shouldRun).length } };
  },
};
