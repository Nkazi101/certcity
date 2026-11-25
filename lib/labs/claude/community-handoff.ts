// Architect Foundations · community-handoff. The learner writes the booking repo's .claude/settings.json hooks (the
// approval guard before writes, the time normalizer after calendar reads) and the desk handoff template. Transfer
// (rerun, hidden): a different session where the change arrives through NotebookEdit or Write, a different calendar
// tool returns epoch seconds, and a different resident asks for a person.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { claudeCodeEngine } from "../engines/claude-code";
import type { SessionInput, SessionOut, SessionStep } from "../engines/claude-code";
import type { Check, Fixture, LabFiles, LabMission, LabRunFixture } from "../types";

const scripts = { guard: "check-approval.sh", normalizer: "iso-time.sh" };
const hook = (script: string) => ({ type: "command", command: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/${script}` });
const settings = (pre: readonly [string, string][], post: readonly [string, string][]) => compactJson({
  hooks: {
    ...(pre.length && { PreToolUse: pre.map(([matcher, script]) => ({ matcher, hooks: [hook(script)] })) }),
    ...(post.length && { PostToolUse: post.map(([matcher, script]) => ({ matcher, hooks: [hook(script)] })) }),
  },
});

const referenceTemplate = `## Ticket {{ticket}} · {{resident}}

Why a person: {{reason}}
What they asked for: {{request}}
Current booking: {{booking}}

Already tried:
{{attempts}}

Chat log: {{transcript}}
`;

type Ticket = { ticket: string; resident: string; reason: string; request: string; booking: string; attempts: string; transcript: string };
const handoff = (at: string, ticket: Ticket): SessionStep => ({
  kind: "handoff", at, ticket,
  required: [
    { field: "request", value: ticket.request, label: "what they asked for" },
    { field: "booking", value: ticket.booking, label: "the current booking" },
    ...ticket.attempts.split("\n").map((value, index) => ({ field: "attempts", value, label: `attempt ${index + 1}` })),
  ],
});

const sampleSession: SessionInput = {
  scripts,
  steps: [
    { kind: "tool", at: "10:05", tool: "Read", summary: "bookings/rooms.json" },
    { kind: "tool", at: "10:06", tool: "mcp__calendar__get_slot", summary: "room 17, Saturday", epoch: { value: 1767225600, iso: "2026-01-01T00:00:00Z", consumer: "mcp__calendar__hold_slot" } },
    { kind: "event", at: "10:31", label: "Staff withdraw approval A-17 (room 17 change)" },
    { kind: "tool", at: "10:42", tool: "Edit", summary: "bookings/rooms.json · room 17 → Saturday choir", approval: { id: "A-17", current: false, room: "17", note: "A-17 withdrawn at 10:31" } },
    { kind: "tool", at: "10:44", tool: "Edit", summary: "bookings/rooms.json · room 12 → Tuesday chess club", approval: { id: "A-19", current: true, room: "12", note: "approved 09:50" } },
    handoff("10:50", { ticket: "31", resident: "J. Ortega", reason: "Asked “Can I talk to someone?”",
      request: "Move the Saturday choir from room 17 to a larger room", booking: "Room 17, Saturday 10:00–12:00",
      attempts: "Swap with room 12 (refused: chess club booked)\nSwap with the Hall (refused: approval withdrawn)", transcript: "[chat log attached · 46 messages]" }),
  ],
};
const notebookSession: SessionInput = {
  scripts,
  steps: [
    { kind: "tool", at: "14:02", tool: "Read", summary: "bookings/annex.ipynb" },
    { kind: "tool", at: "14:03", tool: "mcp__calendar__list_slots", summary: "Annex, next week", epoch: { value: 1767614400, iso: "2026-01-05T12:00:00Z", consumer: "mcp__calendar__hold_slot" } },
    { kind: "event", at: "14:10", label: "Approval A-23 (Annex change) is still waiting for the manager" },
    { kind: "tool", at: "14:15", tool: "NotebookEdit", summary: "bookings/annex.ipynb · Annex → Monday yoga", approval: { id: "A-23", current: false, room: "Annex", note: "A-23 not yet approved" } },
    { kind: "tool", at: "14:18", tool: "Edit", summary: "bookings/rooms.json · room 4 → Thursday tutoring", approval: { id: "A-24", current: true, room: "4", note: "approved 13:40" } },
    handoff("14:25", { ticket: "44", resident: "P. Achebe", reason: "Wrote “I’d rather speak to a person.”",
      request: "Book the Annex for a Monday yoga class", booking: "None yet (waiting list position 2)",
      attempts: "Offered room 9 (declined: no mirrors)", transcript: "[chat log attached · 19 messages]" }),
  ],
};
const writeSession: SessionInput = {
  scripts,
  steps: [
    { kind: "tool", at: "09:12", tool: "mcp__calendar__next_free", summary: "Hall, any evening", epoch: { value: 1767729600, iso: "2026-01-06T20:00:00Z", consumer: "mcp__calendar__hold_slot" } },
    { kind: "tool", at: "09:14", tool: "Read", summary: "bookings/hall.json" },
    { kind: "event", at: "09:20", label: "Staff withdraw approval A-30 (Hall change)" },
    { kind: "tool", at: "09:26", tool: "Write", summary: "bookings/hall.json · whole file rewritten · Hall → Tuesday quiz", approval: { id: "A-30", current: false, room: "Hall", note: "A-30 withdrawn at 09:20" } },
    { kind: "tool", at: "09:31", tool: "Edit", summary: "bookings/rooms.json · room 2 → Friday knitting", approval: { id: "A-31", current: true, room: "2", note: "approved 08:55" } },
    handoff("09:40", { ticket: "52", resident: "D. Novak", reason: "Asked for “a human, please”.",
      request: "Run the Tuesday quiz in the Hall every week", booking: "Hall, Tuesday 19:00–21:00 (one week only)",
      attempts: "Set a weekly repeat (refused: calendar limit)\nOffered room 6 (declined: too small)\nOffered Wednesdays (declined)", transcript: "[chat log attached · 33 messages]" }),
  ],
};

const fixtures: Fixture<SessionInput>[] = [
  { id: "saturday", name: "Saturday choir session", set: "sample", situation: "An approval is withdrawn mid-session, a calendar read returns epoch seconds, and a resident asks for a person.", input: sampleSession },
  { id: "annex", name: "Annex session", set: "transfer", variant: "notebook", situation: "A different session on the bookings repo.", input: notebookSession },
  { id: "hall", name: "Hall session", set: "transfer", variant: "write", situation: "A different session on the bookings repo.", input: writeSession },
];

const reference: LabFiles = {
  settings: settings([["Edit|Write|NotebookEdit", scripts.guard]], [["mcp__calendar__.*", scripts.normalizer]]),
  template: referenceTemplate,
};
// Deployed: the guard runs after Edit (it reports, it cannot stop), nothing normalizes calendar times,
// and the handoff carries only the ticket number and the attached chat log.
const starter: LabFiles = {
  settings: settings([], [["Edit", scripts.guard]]),
  template: "## Ticket {{ticket}}\n\n{{transcript}}\n",
};

type C = Check<SessionInput, SessionOut>;
const checks: C[] = [
  {
    id: "write-guarded", objective: "1.4", title: "No booking change runs without a current approval",
    diagnosis: "A prerequisite that must hold every time belongs in a hook that runs before the tool. PreToolUse fires when Claude requests the call and can block it with exit code 2; PostToolUse fires after the tool has already changed the file, so it can only report. The matcher must cover every tool that can write a booking.",
    hints: hints("Line up the times: when was the approval withdrawn, when did the booking file change, and which hook event ran around that call?",
      "Hook events: PreToolUse runs before a tool executes and its exit code 2 blocks the call (stderr goes back to Claude); PostToolUse runs after success. Matchers name tools exactly (Edit|Write) or by regular expression; every tool that writes files needs to be covered.",
      "A pharmacy refill bot checks that a prescription is still active at the moment the refill order is submitted, not afterwards, and the check covers phone, web and counter orders alike."),
    reveal: "\"PreToolUse\": [{ \"matcher\": \"Edit|Write|NotebookEdit\", \"hooks\": [{ \"type\": \"command\", \"command\": \"…/check-approval.sh\" }] }]",
    evaluate: ({ out }) => {
      const ran = out.writes.find(({ ran, approval }) => ran && !approval.current);
      if (!ran) return out.writes.length ? { passed: true, symptom: "Every unapproved booking change was stopped before it ran." } : null;
      return { passed: false, symptom: ran.guardedAfter
        ? `${ran.tool} ${ran.summary} ran at ${ran.at} (${ran.approval.note}). ${scripts.guard} reported it only after the file had changed.`
        : `${ran.tool} ${ran.summary} ran at ${ran.at} (${ran.approval.note}). No hook ran before the ${ran.tool} call.`, source: ran.source };
    },
  },
  {
    id: "guard-precise", objective: "1.5", title: "Reads, calendar lookups and approved changes go through",
    diagnosis: "check-approval.sh assumes every call it sees is a booking change. A matcher that also catches reads or MCP lookups blocks them. An empty matcher or * catches everything; an unanchored pattern such as Edit.* still misses Write; name the write tools or write a precise pattern.",
    hints: hints("Find the call that was blocked although it changes nothing. Which matcher sent it to the guard?",
      "Hook matchers: a value made only of letters, digits, _, -, | is an exact list of tool names; anything else is a regular expression matched anywhere in the name; empty or * matches every tool. Scope each hook to the tools its script was written for.",
      "A building’s badge reader on the server-room door is useful; the same reader on the lobby coffee machine locks everyone out of coffee."),
    reveal: "Scope the guard’s matcher to the write tools only (Edit|Write|NotebookEdit), not * or .*",
    evaluate: ({ out }) => {
      const wrong = out.wronglyBlocked[0];
      if (wrong) return { passed: false, symptom: `${wrong.tool} ${wrong.summary} was blocked at ${wrong.at}: ${scripts.guard} exited 2 on a call that changes nothing.`, source: wrong.source };
      const approved = out.writes.find(({ ran, approval }) => !ran && approval.current);
      if (approved) return { passed: false, symptom: `${approved.tool} ${approved.summary} was blocked although ${approved.approval.id} is current.`, source: approved.source };
      return { passed: true, symptom: "Reads, lookups and approved changes ran." };
    },
  },
  {
    id: "time-normalized", objective: "1.5", title: "Calendar times reach Claude as ISO dates",
    diagnosis: "A PostToolUse hook sees a tool’s result before Claude does; for MCP tools it can replace the output (updatedMCPToolOutput), so every later step gets the same format. Running it before the tool, or matching only one calendar tool, leaves the raw value in place.",
    hints: hints("Read the calendar call in the trace: what value did Claude pass to hold_slot, and which hook (if any) ran after the lookup?",
      "Transform tool results in PostToolUse: the hook runs after the tool returns and before Claude reads the result. Match the tools by their full MCP names (mcp__server__tool) or by a pattern that covers the whole server.",
      "A weather app converts every API response from Kelvin to Celsius as it arrives, so no screen downstream has to; it does it for the hourly and the weekly endpoint alike."),
    reveal: "\"PostToolUse\": [{ \"matcher\": \"mcp__calendar__.*\", \"hooks\": [{ \"type\": \"command\", \"command\": \"…/iso-time.sh\" }] }]",
    evaluate: ({ out }) => {
      if (!out.times.length) return null;
      const raw = out.times.find(({ normalized }) => !normalized);
      return raw ? { passed: false, symptom: `${raw.tool} returned ${raw.delivered} to Claude unchanged; ${raw.consumer} then rejected it because start was not an ISO 8601 date-time.`, source: raw.source }
        : { passed: true, symptom: "Every calendar time reached Claude as an ISO date." };
    },
  },
  {
    id: "handoff-complete", objective: "5.2", title: "Staff get the request, the current booking and every attempt",
    diagnosis: "An escalation is only useful if the person can act without re-asking: who, what they asked for, the current state and what was already tried, with the reason they want a person. A raw transcript attachment does not count; staff triage from the ticket body.",
    hints: hints("Read the ticket body staff received in the trace and the list of fields the desk tool can fill.",
      "Escalation with a structured handoff: honor an explicit request for a person immediately, and pass a summary with the customer’s goal, current state, attempted steps and reason, filled from the case rather than written for one case.",
      "A hospital shift handoff (SBAR) names the patient, the situation, what was already given and what is pending, so the next nurse does not repeat a dose."),
    reveal: "A template with {{reason}}, {{request}}, {{booking}} and {{attempts}} (plus {{ticket}} and {{resident}}).",
    evaluate: ({ out }) => {
      const gap = out.handoffs.find(({ missing }) => missing.length);
      if (!out.handoffs.length) return null;
      return gap ? { passed: false, symptom: `Staff received ticket ${gap.ticket} without ${gap.missing.join(", ")}; the desk has to ask the resident again.`, source: gap.source }
        : { passed: true, symptom: "Staff can act on the ticket without asking again." };
    },
  },
];

function effects(runs: readonly LabRunFixture<SessionInput, SessionOut>[]) {
  return runs.flatMap(({ run }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      ...out.writes.map(({ summary, ran, approval }) => ({ kind: "tray" as const, item: summary.split(" · ")[1] ?? summary,
        to: ran ? approval.current ? "posted" as const : "leaked" as const : approval.current ? "failed" as const : "blocked" as const })),
      ...out.handoffs.map(({ ticket, missing }) => ({ kind: "tray" as const, item: `ticket ${ticket}`, to: missing.length ? "failed" as const : "escalated" as const })),
    ];
  });
}

const swap = (files: LabFiles, change: Readonly<Record<string, string>>): LabFiles => ({ ...files, ...change });

export const communityHandoffLab: LabMission<unknown, SessionInput, SessionOut> = {
  id: "community-handoff",
  provider: "anthropic",
  track: "architect-foundations",
  objectives: ["1.4", "1.5", "5.2"],
  station: "Room-booking session replay",
  speaker: "Malik Reed",
  opening: "Room 17 changed at 10:42. Staff had withdrawn the approval at 10:31, and the transcript still said ‘verified’.",
  task: "Write the bookings repo’s hook settings and the desk handoff template, then replay the session.",
  brief: {
    problem: "The booking agent changed a room after its approval was withdrawn, fed epoch seconds to the calendar, and handed a resident to staff with nothing but a chat log.",
    move: "Read the session log and the two hook scripts’ notes, then edit .claude/settings.json and .claude/handoff.md and replay.",
    success: ["0 booking changes without a current approval", "Reads, lookups and approved changes still run", "Every calendar entry gets an ISO date", "Staff can act on an escalation without asking again"],
  },
  prebrief: {
    concept: "A hook is a command Claude Code runs at a fixed point around a tool call, so it can enforce a rule that a prompt can only request. PreToolUse runs before the call and can block it; PostToolUse runs after and can reshape an MCP tool’s result.",
    terms: [["Check when the tool is about to run", "PreToolUse hook (exit code 2 blocks)"], ["Clean up what a tool returned", "PostToolUse hook (updatedMCPToolOutput)"],
      ["Which tools a hook watches", "matcher: exact names or a regex"], ["Pass to a person with context", "Escalation with a structured handoff"]],
    contrast: {
      good: "A bank app checks your balance at the moment you press Send, so a transfer fails if the money left a minute ago.",
      bad: "A bank app that checked only after sending would tell you about the overdraft once the money had gone.",
    },
  },
  documents: [
    { id: "session", title: "Session log · Saturday choir", format: "code", text: sampleSession.steps.map((step) =>
      step.kind === "event" ? `${step.at}  ${step.label}` : step.kind === "handoff" ? `${step.at}  Resident on ticket ${step.ticket.ticket}: ${step.ticket.reason}` : `${step.at}  ${step.tool} · ${step.summary}`).join("\n") },
    { id: "guard", title: ".claude/hooks/check-approval.sh", text: "Reads the tool call on stdin and looks up the room it changes in the approvals ledger. Exits 2 with “no current approval for <room>” when the approval is missing or withdrawn, and 0 when it is current. It assumes every call it receives is a booking change: a call that changes no booking has nothing to approve, so it exits 2." },
    { id: "normalizer", title: ".claude/hooks/iso-time.sh", text: "Reads a finished tool call and its result on stdin. If an MCP tool returned epoch seconds, it prints JSON with hookSpecificOutput.updatedMCPToolOutput holding the same result with ISO 8601 times. All calendar tools belong to the MCP server named calendar." },
    { id: "desk", title: "Desk handoff tool · template fields", text: "mcp__desk__handoff fills .claude/handoff.md for the ticket being escalated. Fields: {{ticket}}, {{resident}}, {{reason}} (why they want a person), {{request}}, {{booking}} (current booking), {{attempts}} (one line per automated attempt), {{transcript}} (attaches the chat log as a file; staff triage from the ticket body)." },
    { id: "front", title: "Front desk lead · Sara Bell", text: "When someone asks for a person, we take it straight away. What slows us down is a ticket that makes us scroll a 40-message log to find out what was already tried." },
  ],
  artifacts: [
    { id: "settings", kind: "claude-code.settings", path: ".claude/settings.json", editor: "json", instruction: "Project settings committed to the bookings repo. The hook scripts already exist in .claude/hooks/.",
      starter: starter.settings, example: compactJson({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/no-force-push.sh" }] }] } }) },
    { id: "template", kind: "handoff-template", path: ".claude/handoff.md", editor: "markdown", instruction: "The body staff see when the desk agent escalates a ticket. Fields in {{double braces}} are filled per ticket.",
      starter: starter.template, example: "## Return {{order}}\nCustomer wants: {{goal}}\nTried: {{steps}}" },
  ],
  engine: claudeCodeEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many booking changes will run without a current approval?", unit: "changes",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.unapprovedRan ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { notebook: reference, write: reference } },
  mutants: [
    { name: "guard registered under PostToolUse", set: "sample", mustFail: ["write-guarded"], edit: (files) => swap(files, { settings: settings([], [["Edit|Write|NotebookEdit", scripts.guard], ["mcp__calendar__.*", scripts.normalizer]]) }) },
    { name: "guard matcher Write only", set: "sample", mustFail: ["write-guarded"], edit: (files) => swap(files, { settings: settings([["Write", scripts.guard]], [["mcp__calendar__.*", scripts.normalizer]]) }) },
    { name: "guard on every tool", set: "sample", mustFail: ["guard-precise"], edit: (files) => swap(files, { settings: settings([["*", scripts.guard]], [["mcp__calendar__.*", scripts.normalizer]]) }) },
    { name: "normalizer under PreToolUse", set: "sample", mustFail: ["time-normalized"], edit: (files) => swap(files, { settings: settings([["Edit|Write|NotebookEdit", scripts.guard], ["mcp__calendar__.*", scripts.normalizer]], []) }) },
    { name: "normalizer matcher uses the bare tool name", set: "sample", mustFail: ["time-normalized"], edit: (files) => swap(files, { settings: settings([["Edit|Write|NotebookEdit", scripts.guard]], [["get_slot", scripts.normalizer]]) }) },
    { name: "handoff without the attempts", set: "sample", mustFail: ["handoff-complete"], edit: (files) => swap(files, { template: files.template.replace("{{attempts}}", "(see chat log)") }) },
    { name: "Edit|Write misses NotebookEdit", set: "transfer", variant: "notebook", mustFail: ["write-guarded"], edit: (files) => swap(files, { settings: settings([["Edit|Write", scripts.guard]], [["mcp__calendar__.*", scripts.normalizer]]) }) },
    { name: "unanchored Edit pattern misses Write", set: "transfer", variant: "write", mustFail: ["write-guarded"], edit: (files) => swap(files, { settings: settings([["Edit.*", scripts.guard]], [["mcp__calendar__.*", scripts.normalizer]]) }) },
    { name: "normalizer only on get_slot", set: "transfer", variant: "write", mustFail: ["time-normalized"], edit: (files) => swap(files, { settings: settings([["Edit|Write|NotebookEdit", scripts.guard]], [["mcp__calendar__get_slot", scripts.normalizer]]) }) },
  ],
  probes: [
    { name: "guard and normalizer on every tool, every event", set: "sample", mustFail: "any",
      files: (files) => swap(files, { settings: settings([["", scripts.guard], ["", scripts.normalizer]], [["", scripts.guard], ["", scripts.normalizer]]) }) },
    { name: "every field name typed without braces", set: "sample", mustFail: ["handoff-complete"],
      files: (files) => swap(files, { template: "ticket resident reason request booking attempts transcript — see the chat log for details." }) },
  ],
  overfit: {
    settings: settings([["Edit", scripts.guard]], [["mcp__calendar__get_slot", scripts.normalizer]]),
    template: "## Ticket {{ticket}}\nWhy a person: {{reason}}\nWhat they asked for: Move the Saturday choir from room 17 to a larger room\nCurrent booking: Room 17, Saturday 10:00–12:00\nAlready tried:\n{{attempts}}\n",
  },
  fixTerms: ["PreToolUse", "{{attempts}}", "{{booking}}", "{{request}}"],
  debrief: "check-approval.sh runs in PreToolUse with a matcher naming every write tool (Edit|Write|NotebookEdit), so a withdrawn approval stops the change before it happens and reads are never sent to the guard. iso-time.sh runs in PostToolUse on the whole calendar MCP server (mcp__calendar__.*), so every lookup reaches Claude with ISO times. The handoff template is filled from the case, so staff see the reason, the request, the current booking and every attempt for any ticket.",
};
