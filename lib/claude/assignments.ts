import type { TrackId } from "./blueprints";

export type ReplayCase = { id: string; name: string; evidence: string; };
export type ReplayResult = {
  rows: readonly { name: string; outcome: string; accepted: boolean }[];
  summary: string;
};
export type Assignment = {
  title: string;
  brief: string;
  cases: readonly ReplayCase[];
  controls: readonly { id: string; label: string; choices: readonly string[] }[];
  replay: (choices: Record<string, number>) => ReplayResult;
  debrief: string;
  impact: string;
  domain: number;
};

const schoolCases = [
  { id: "new", name: "New enrollment", evidence: "Current bulletin: new enrollments close May 24. Last year’s sample says May 19.", state: "verified", fact: "New enrollments close May 24." },
  { id: "opening", name: "Office reopening", evidence: "A family asks when repairs end. The current bulletin lists the reopening date as pending.", state: "pending", fact: "The reopening date is pending." },
  { id: "exception", name: "Late application", evidence: "A family requests an exception. Only the enrollment lead can approve late applications.", state: "exception", fact: "Late applications require enrollment lead approval." },
] as const;

const invoices = [
  { id: "302", name: "Invoice 302", evidence: "Lines: 4,200¢ and 1,800¢. Printed total: 6,000¢.", lines: [4200, 1800], total: 6000 },
  { id: "303", name: "Invoice 303", evidence: "Lines: 7,900¢ and 2,100¢. Printed total: 11,000¢. No taxes or fees.", lines: [7900, 2100], total: 11000 },
  { id: "304", name: "Invoice 304", evidence: "Lines: 3,000¢ and 2,300¢. The printed total is unreadable.", lines: [3000, 2300], total: null },
] as const;

const routes = [
  { id: "speed", name: "Latency target", evidence: "Operations requires p95 under 2 seconds." },
  { id: "cost", name: "Cost ceiling", evidence: "Finance requires a cost of at most $0.02 per resolved ticket." },
  { id: "approval", name: "Dispute rule", evidence: "Staff must decide all disputes. Test replay includes 40 disputed tickets." },
] as const;

export type CityAssignmentId = Exclude<TrackId, "architect-foundations">;

export function isCityAssignment(id: TrackId): id is CityAssignmentId {
  return id !== "architect-foundations";
}

export const assignments: Record<CityAssignmentId, Assignment> = {
  "associate-foundations": {
    title: "Prepare an enrollment reply",
    brief: "Jordan needs to clear three messages. Choose how to handle each one. Use the approved bulletin, give families only confirmed facts, and send decisions on exceptions to the enrollment lead.",
    cases: schoolCases,
    controls: schoolCases.map(({ id, name }) => ({
      id, label: name, choices: ["Draft with the confirmed answer", "Draft a reply marking the detail as pending", "Send to the enrollment lead"],
    })),
    replay(choices) {
      const rows = schoolCases.map(({ id, name, state, fact }) => {
        const choice = choices[id];
        const accepted = choice === (state === "verified" ? 0 : state === "pending" ? 1 : 2);
        const outcome = choice === 0
          ? state === "verified" ? `Ready for staff review. ${fact}` : "Blocked. The reply would need a fact or decision the bulletin cannot supply."
          : choice === 1 ? state === "pending" ? `Ready for staff review. ${fact}` : state === "verified" ? "The verified answer was withheld." : "The requested exception never reached the enrollment lead."
          : state === "exception" ? `Routed with the request and policy. ${fact}` : "Sent to the enrollment lead even though staff can draft a response.";
        return { name, accepted, outcome };
      });
      return { rows, summary: `${rows.filter(({ accepted }) => accepted).length} of ${rows.length} messages handled according to the bulletin.` };
    },
    debrief: "Use a maintained source for shared facts. In a Claude Project, keep the bulletin in project knowledge and put the audience, format, and escalation rule in project instructions. Have staff verify the claims before sending.",
    impact: "Two replies are ready for staff review. One exception is with the enrollment lead.",
    domain: 2,
  },
  "developer-foundations": {
    title: "Validate a supplier invoice",
    brief: "Lina found a schema-valid invoice with the wrong total. Configure the importer, then replay the three invoices. The ledger should accept reconciled records and preserve the original claim for every exception.",
    cases: invoices,
    controls: [
      { id: "validation", label: "Check before posting", choices: ["Check JSON shape only", "Compare printed total with line items"] },
      { id: "exception", label: "Handle a discrepancy or unreadable total", choices: ["Replace the printed value with the calculation", "Preserve both values and send to review"] },
    ],
    replay({ validation, exception }) {
      const rows = invoices.map(({ name, total, lines }) => {
        const calculated = lines.reduce<number>((sum, amount) => sum + amount, 0);
        if (total === calculated) return { name, outcome: `Posted ${total.toLocaleString()}¢ with the source reference.`, accepted: true };
        const original = total === null ? "unreadable" : `${total.toLocaleString()}¢`;
        if (validation === 0) return { name, outcome: `Passed schema validation. Ledger received the printed total (${original}) without reconciliation.`, accepted: false };
        if (exception === 0) return { name, outcome: `Ledger received ${calculated.toLocaleString()}¢. The original status (${original}) was overwritten.`, accepted: false };
        return { name, outcome: `Held for review. Printed total: ${original}. Calculated: ${calculated.toLocaleString()}¢.`, accepted: true };
      });
      return { rows, summary: `${rows.filter(({ accepted }) => accepted).length} of ${rows.length} invoices met the posting policy.` };
    },
    debrief: "Constrain the output shape with a schema, then validate business rules in application code. Save the original claim, the computed check, and the reason for review as separate fields.",
    impact: "One invoice reached the ledger. Two exceptions are held with their source totals.",
    domain: 6,
  },
  "architect-professional": {
    title: "Plan a support rollout",
    brief: "Priya has approval for a controlled support pilot. Pick a candidate and a dispute control. Replay the workload and check whether the plan meets all three release conditions.",
    cases: routes,
    controls: [
      { id: "candidate", label: "Pilot candidate", choices: ["Candidate A · 1.6 s p95, $0.018 per resolution", "Candidate B · 2.7 s p95, $0.033 per resolution"] },
      { id: "gate", label: "Disputed tickets", choices: ["Audit closed disputes after the shift", "Require staff approval before closure"] },
    ],
    replay({ candidate, gate }) {
      const latency = (candidate === 0 ? 1.6 : 2.7) + (gate ? 0.2 : 0);
      const cost = (candidate === 0 ? 0.018 : 0.033) + (gate ? 0.001 : 0);
      const closed = gate ? 0 : candidate === 0 ? 2 : 0;
      const rows = [
        { name: "Latency target", outcome: `${latency.toFixed(1)} s p95 in replay.`, accepted: latency < 2 },
        { name: "Cost ceiling", outcome: `$${cost.toFixed(3)} per resolution in replay.`, accepted: cost <= 0.02 },
        { name: "Dispute rule", outcome: gate ? "All 40 disputed tickets routed to staff." : `${closed} of 40 disputed tickets closed automatically. The audit runs after closure.`, accepted: gate === 1 },
      ];
      return { rows, summary: `${rows.filter(({ accepted }) => accepted).length} of ${rows.length} pilot conditions met.` };
    },
    debrief: "Make the prohibition a deterministic state gate at the closure service. Define monitored thresholds for cost, latency, and disputed closures, plus a rollback trigger and an owner before live exposure.",
    impact: "The pilot plan meets its replay targets and sends all disputes to staff.",
    domain: 6,
  },
};
