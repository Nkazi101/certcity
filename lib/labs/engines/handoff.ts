// Incident runbook and operational handoff (provider-neutral). The learner's runbook is played on the incident clock
// (each action costs minutes and has an effect), and the next shift acts from the handoff packet alone: it calls the
// named owner, replays the named fixture on the named release, checks each cited claim against the sources, runs the
// importer restart command, loads the review procedure, and routes the findings table to contract owners.
import { column, findTable, markdownSections, section } from "./parse";
import type { Engine, EngineRun, Fixture, TraceEvent, TraceSource } from "../types";

export type ClockAction = { id: string; pattern: string; minutes: number; effect: "owner" | "person" | "cause" | "none"; label: string };
export type Defect = { id: string; title: string; contract: string; input: string; reports: readonly string[] };
export type HandoffInput = {
  catalog: readonly ClockAction[];
  limit: number;
  owners: readonly string[];
  release: string;
  repo: readonly { path: string; reproduces?: string }[];
  sources: readonly { id: string; available: boolean }[];
  importer: { stages: readonly string[]; done: readonly string[]; failed: string; partialRows: number };
  skills: readonly string[];
  defects: readonly Defect[];
};

type Parsed = { runbook: string; handoff: string };

export type HandoffOut = {
  clock: { owner: number | null; person: number | null; cause: number | null; total: number; unknown: readonly string[]; source: TraceSource };
  reproduce: { owner: boolean; release: string | null; fixture: string | null; fixtureExists: boolean; reproduced: boolean; source: TraceSource };
  evidence: { uncited: readonly string[]; unavailableCited: readonly string[]; gapStated: readonly string[]; gapsNeeded: readonly string[]; source: TraceSource };
  resume: { command: string | null; from: string | null; discard: boolean; reran: readonly string[]; duplicates: number; valid: boolean; source: TraceSource };
  procedure: { path: string | null; loaded: boolean; kind: string; source: TraceSource };
  findings: { table: boolean; duplicates: readonly string[]; merged: readonly string[]; missing: readonly string[]; unroutable: readonly string[]; source: TraceSource };
};

const lineOfText = (artifact: "runbook" | "handoff", body: string, needle: string): TraceSource => {
  const index = needle ? body.split("\n").findIndex((line) => line.toLowerCase().includes(needle.toLowerCase())) : -1;
  return { artifact, line: index >= 0 ? index + 1 : 1 };
};

export const handoffEngine: Engine<Parsed, HandoffInput, HandoffOut> = {
  id: "neutral.handoff",
  provider: "neutral",
  label: "Runbook on the incident clock, then the next shift working from the handoff alone",
  simulated: false,
  parse(files) {
    const runbook = files.runbook ?? "";
    const handoff = files.handoff ?? "";
    if (!/^\s*\d+[.)]\s+\S/m.test(runbook)) return { ok: false, error: "runbook.md needs a numbered list of actions (1. …, 2. …) in the order the on-call runs them.", source: { artifact: "runbook", line: 1 } };
    if (markdownSections(handoff).size === 0) return { ok: false, error: "handoff.md needs ## sections (Owner, Deployed, Reproduce, Evidence, Resume, Procedure, Findings) for the next shift to work from.", source: { artifact: "handoff", line: 1 } };
    return { ok: true, value: { runbook, handoff } };
  },
  run({ runbook, handoff }, fixture: Fixture<HandoffInput>): EngineRun<HandoffOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });

    // 1. The runbook on the incident clock.
    const steps = runbook.split("\n").map((line, index) => ({ line, index })).filter(({ line }) => /^\s*\d+[.)]\s+\S/.test(line));
    let minute = 0;
    const clock: { owner: number | null; person: number | null; cause: number | null } = { owner: null, person: null, cause: null };
    const unknown: string[] = [];
    for (const { line, index } of steps) {
      const action = input.catalog.find(({ pattern }) => new RegExp(pattern, "i").test(line));
      const source: TraceSource = { artifact: "runbook", line: index + 1 };
      if (!action) { unknown.push(line.trim()); push({ actor: "learner-artifact", kind: "decision", label: `“${line.trim().replace(/^\d+[.)]\s*/, "")}” is not an action anyone on shift can take`, source, tone: "warn" }); continue; }
      minute += action.minutes;
      if (action.effect !== "none" && clock[action.effect] === null) clock[action.effect] = minute;
      push({ actor: "person", kind: "decision", label: `min ${minute} · ${action.label} (${action.minutes} min)`, source, tone: minute > input.limit ? "warn" : action.effect === "none" ? undefined : "ok" });
    }
    const runbookSource: TraceSource = { artifact: "runbook", line: steps[0] ? steps[0].index + 1 : 1 };
    push({ actor: "service", kind: "metric", label: `Incident clock: owner ${clock.owner ?? "never"} · residents to a person ${clock.person ?? "never"} · cause found ${clock.cause ?? "never"} (limit ${input.limit} min)`, source: runbookSource,
      tone: [clock.owner, clock.person, clock.cause].every((value) => value !== null && value <= input.limit) ? "ok" : "bad" });

    // 2. The next shift works from the handoff alone.
    const sections = markdownSections(handoff);
    const read = (word: string) => section(sections, word) ?? "";
    const owner = read("owner");
    const ownerOk = input.owners.some((name) => owner.toLowerCase().includes(name.toLowerCase()));
    push({ actor: "person", kind: "request", label: ownerOk ? `Next shift pages ${input.owners.find((name) => owner.toLowerCase().includes(name.toLowerCase()))}` : "Next shift cannot tell whom to call", source: lineOfText("handoff", handoff, "owner"), tone: ownerOk ? "ok" : "bad" });
    const release = /\br\d+\b/i.exec(read("deploy") || read("release") || read("version"))?.[0]?.toLowerCase() ?? null;
    const fixturePath = /[\w./-]+\.json/.exec(read("reproduc"))?.[0] ?? null;
    const file = fixturePath ? input.repo.find(({ path }) => path === fixturePath) : undefined;
    const reproduced = !!file && release === input.release && file.reproduces === input.release;
    push({ actor: "tool", kind: "tool_result", label: fixturePath ? `Replay ${fixturePath} on ${release ?? "(no release named)"} → ${!file ? "file not found in the repo" : reproduced ? "write denied, read allowed: reproduced" : file.reproduces ? "write succeeded: not reproduced" : "this fixture does not exercise a write"}` : "No fixture to replay",
      source: lineOfText("handoff", handoff, fixturePath ?? "reproduc"), tone: reproduced ? "ok" : "bad" });

    const evidenceText = read("evidence");
    const lines = evidenceText.split("\n").map((line) => line.trim()).filter((line) => /^[-*]\s+\S/.test(line)).map((line) => line.replace(/^[-*]\s+/, ""));
    const isGap = (line: string) => /\bgap\b|not checked|unavailable|unverified|could not|couldn’t|not (yet )?verified/i.test(line);
    const cited = (line: string) => input.sources.filter(({ id }) => line.toLowerCase().includes(id.toLowerCase()));
    const uncited = lines.filter((line) => !isGap(line) && cited(line).length === 0);
    const unavailableCited = lines.filter((line) => !isGap(line) && cited(line).some(({ available }) => !available));
    const gapsNeeded = input.sources.filter(({ available }) => !available).map(({ id }) => id);
    const gapStated = gapsNeeded.filter((id) => lines.some((line) => isGap(line) && line.toLowerCase().includes(id.toLowerCase())));
    for (const line of lines) {
      const sources = cited(line);
      push({ actor: "person", kind: "decision", label: `Check “${line.length > 80 ? `${line.slice(0, 77)}…` : line}”`, detail: isGap(line) ? "Recorded as an open gap." : sources.length ? `Source: ${sources.map(({ id, available }) => `${id}${available ? "" : " (unavailable during the incident)"}`).join(", ")}` : "No source to check it against.",
        source: lineOfText("handoff", handoff, line.slice(0, 30)), tone: isGap(line) ? undefined : sources.length && sources.every(({ available }) => available) ? "ok" : "bad" });
    }

    const resumeText = read("resum") || read("restart") || read("import");
    const command = /importer\s+(resume|run)[^\n`]*/i.exec(resumeText)?.[0]?.trim() ?? null;
    const from = command ? (/--from[ =](\S+)/.exec(command)?.[1]?.toLowerCase() ?? (/\brun\b/.test(command) ? input.importer.stages[0] : null)) : null;
    const discard = !!command && /--discard-partial/.test(command);
    const valid = !!from && input.importer.stages.includes(from);
    const start = valid ? input.importer.stages.indexOf(from!) : -1;
    const reran = valid ? input.importer.done.filter((stage) => input.importer.stages.indexOf(stage) >= start) : [];
    const skipped = valid && input.importer.stages.indexOf(input.importer.failed) < start;
    const duplicates = valid && !skipped && !discard && input.importer.stages.indexOf(input.importer.failed) >= start ? input.importer.partialRows : 0;
    push({ actor: "tool", kind: "tool_result", label: command ? `$ ${command} → ${!valid ? "importer: unknown stage" : skipped ? `${input.importer.failed} stage never reruns` : `reruns ${input.importer.stages.slice(start).join(" → ")}`}` : "No restart command the importer accepts",
      detail: [reran.length && `Already finished and stored: ${reran.join(", ")}`, duplicates && `${duplicates} half-written rows from the failed run were written again`].filter(Boolean).join(" · ") || undefined,
      source: lineOfText("handoff", handoff, command ?? "resum"), tone: valid && !reran.length && !duplicates && !skipped ? "ok" : "bad" });

    const procedureText = read("procedure") || read("review");
    const path = /\.claude\/skills\/[\w-]+\/?(?:SKILL\.md)?/.exec(procedureText)?.[0] ?? null;
    const skill = path ? input.skills.find((entry) => path.replace(/SKILL\.md$/, "").replace(/\/$/, "") === entry.replace(/\/$/, "")) : undefined;
    const kind = path ? (skill ? "skill" : "a Skill that is not this procedure, or not in the repo") : /wiki|confluence|notion|http/i.test(procedureText) ? "wiki link" : /paste|prompt/i.test(procedureText) ? "pasted prompt" : /override|admin|elevat/i.test(procedureText) ? "access override" : "nothing";
    push({ actor: "model", kind: "decision", label: skill ? `The incoming team’s assistant loads the ${skill} Skill under its existing permissions` : `The incoming team’s assistant has no procedure to load (${kind}${path ? `: ${path}` : ""})`,
      source: lineOfText("handoff", handoff, path ?? "procedure"), tone: skill ? "ok" : "bad" });

    const table = findTable(read("finding"), ["finding"]);
    const rows = table?.rows ?? [];
    const matched = rows.map((row) => {
      const text = Object.values(row).join(" ").toLowerCase();
      const contract = column(row, "contract");
      const failing = column(row, "input");
      const hits = input.defects.filter((defect) => contract.toLowerCase().includes(defect.contract.toLowerCase()) && failing.toLowerCase().includes(defect.input.toLowerCase()));
      const byText = input.defects.filter((defect) => text.includes(defect.contract.toLowerCase()) || text.includes(defect.input.toLowerCase()));
      return { row, hits, byText, label: column(row, "finding") || Object.values(row)[0] || "(blank)" };
    });
    const doubled = input.defects.filter((defect) => matched.filter(({ hits }) => hits.includes(defect)).length > 1).map(({ id }) => id);
    const merged = matched.filter(({ byText }) => byText.length > 1).map(({ label }) => label);
    const missing = input.defects.filter((defect) => !matched.some(({ hits }) => hits.includes(defect))).map(({ id }) => id);
    const unroutable = matched.filter(({ hits, byText }) => hits.length === 0 && byText.length <= 1).map(({ label }) => label);
    for (const { label, hits } of matched) push({ actor: "service", kind: "output", label: `Finding “${label}” → ${hits.length ? `routed to the owner of ${hits.map(({ contract }) => contract).join(" and ")}` : "no contract owner to route it to"}`, source: lineOfText("handoff", handoff, label), tone: hits.length === 1 ? "ok" : "bad" });

    return {
      trace,
      out: {
        clock: { ...clock, total: minute, unknown, source: runbookSource },
        reproduce: { owner: ownerOk, release, fixture: fixturePath, fixtureExists: !!file, reproduced, source: lineOfText("handoff", handoff, fixturePath ?? "reproduc") },
        evidence: { uncited, unavailableCited, gapStated, gapsNeeded, source: lineOfText("handoff", handoff, "evidence") },
        resume: { command, from, discard, reran, duplicates, valid: valid && !skipped, source: lineOfText("handoff", handoff, command ?? "resum") },
        procedure: { path, loaded: !!skill, kind, source: lineOfText("handoff", handoff, path ?? "procedure") },
        findings: { table: !!table, duplicates: doubled, merged, missing, unroutable, source: lineOfText("handoff", handoff, "finding") },
      },
      metrics: { minutes: minute },
    };
  },
};
