import { integer, test, words } from "./model";
import type { CapstoneDefinition, CapstoneDraft, CapstoneStage } from "./model";

type Shift = {
  name: string;
  routine: number;
  complex: number;
  signedReview: number;
  reviewMinutes: number;
  budget: number;
};

type Model = {
  name: string;
  routineCents: number;
  complexCents: number;
  routineQuality: number;
  complexQuality: number;
  routineMs: number;
  complexMs: number;
};

type DesignCase = {
  id: string;
  stage: CapstoneStage;
  title: string;
  brief: string;
  start: Shift;
  changed: Shift;
  models: readonly [Model, Model];
  routineTarget: number;
  complexTarget: number;
  routineLatency: number;
  complexLatency: number;
  approvalMinutes: number;
  approvalCents: number;
  host: string;
  alternate: string;
  owner: string;
};

function evaluateShift(input: DesignCase, draft: CapstoneDraft, phase: "start" | "changed") {
  const shift = input[phase];
  const routine = input.models.find(({ name }) => words(name) === words(draft[`${phase}Routine`]));
  const complex = input.models.find(({ name }) => words(name) === words(draft[`${phase}Complex`]));
  const review = integer(draft[`${phase}Review`]);
  const defer = integer(draft[`${phase}Deferred`]);
  const minutes = review === null ? null : review * input.approvalMinutes;
  const cost = routine && complex && review !== null
    ? shift.routine * routine.routineCents + shift.complex * complex.complexCents + review * input.approvalCents
    : null;
  const qualityPassed = !!routine && !!complex && routine.routineQuality >= input.routineTarget &&
    complex.complexQuality >= input.complexTarget && routine.routineMs <= input.routineLatency && complex.complexMs <= input.complexLatency;
  const reviewCapacity = Math.floor(shift.reviewMinutes / input.approvalMinutes);
  return { shift, routine, complex, review, defer, minutes, cost, qualityPassed, reviewCapacity };
}

function design(input: DesignCase): CapstoneDefinition {
  const { models, start, changed } = input;
  const summary = (shift: Shift) => `${shift.name}. ${shift.routine} routine and ${shift.complex} complex requests. ${shift.signedReview} already-processed records need reviewer sign-off. ${shift.reviewMinutes} reviewer minutes and ${shift.budget} cents are available.`;
  return {
    id: input.id, stage: input.stage, title: input.title, role: "Architecture review",
    brief: input.brief,
    deliverable: "Size the deployment and recalculate the revised operating plan. Keep sign-off, audit, and launch decisions grounded in the records.",
    documents: [
      {
        id: "EVAL", title: "Validated model estimates",
        text: models.map((model) => `${model.name}\nRoutine: ${model.routineCents} cents, ${model.routineQuality}% accepted, ${model.routineMs} ms p95.\nComplex: ${model.complexCents} cents, ${model.complexQuality}% accepted, ${model.complexMs} ms p95.`).join("\n\n"),
      },
      {
        id: "TRAFFIC", title: "Original and revised operating windows",
        text: `${summary(start)}\n\n${summary(changed)}\n\nPer signed review: ${input.approvalMinutes} minutes and ${input.approvalCents} cents. Model cost applies to all inbound requests. Signed review is charged only for records assigned now. Keep deferred records queued and hold any unreviewed final action.`,
      },
      {
        id: "GATE", title: "Service and release requirements",
        text: `Routine needs at least ${input.routineTarget}% accepted and at most ${input.routineLatency} ms p95. Complex needs at least ${input.complexTarget}% accepted and at most ${input.complexLatency} ms p95. Assign as many of the sign-offs as the budget and queue allow. The partner reviews both slices before wider rollout. Halt rollout below the minimum for either slice.`,
      },
      {
        id: "BOUNDARY", title: "Deployment and operating ownership",
        text: `Sensitive records must stay in ${input.host}. The ${input.alternate} has no approved data or retention review. Pause final actions and give ${input.owner} the owner log when rollout checks miss a threshold.`,
      },
    ],
    fields: [
      { id: "startRoutine", group: start.name, label: "Routine model", options: models.map(({ name }) => name) },
      { id: "startComplex", group: start.name, label: "Complex model", options: models.map(({ name }) => name) },
      { id: "startReview", group: start.name, label: "Records to review now" },
      { id: "startDeferred", group: start.name, label: "Records to hold" },
      { id: "changedRoutine", group: changed.name, label: "Routine model", options: models.map(({ name }) => name) },
      { id: "changedComplex", group: changed.name, label: "Complex model", options: models.map(({ name }) => name) },
      { id: "changedReview", group: changed.name, label: "Records to review now" },
      { id: "changedDeferred", group: changed.name, label: "Records to hold" },
      { id: "host", group: "Launch and handoff", label: "Approved runtime for sensitive records", options: [input.alternate, input.host] },
      { id: "routineGate", group: "Launch and handoff", label: "Minimum accepted for routine rollout (%)", instruction: "Enter the agreed percentage as a whole number." },
      { id: "complexGate", group: "Launch and handoff", label: "Minimum accepted for complex rollout (%)", instruction: "Enter the agreed percentage as a whole number." },
      { id: "owner", group: "Launch and handoff", label: "Handoff owner if a rollout threshold is missed" },
      { id: "rationale", group: "Launch and handoff", label: "Decision rationale and handoff notes", editor: "notes", instruction: "Optional. Record the trade-off you accepted and what you would re-evaluate. The simulation saves these notes with your decision and checks the structured plan fields." },
    ],
    criteria: [
      {
        id: "models", title: "Use evaluation evidence to route each workload",
        objectives: ["2.1", "3.3", "4.5"], revisedObjectives: ["2.1", "3.3", "4.6"],
        review: "Evaluate accepted output and p95 separately for the two lanes. Use per-slice evidence to select models that fit both targets.",
      },
      {
        id: "cost", title: "Fit the revised plan to the operating budget",
        objectives: ["1.6", "4.5"], revisedObjectives: ["1.5", "4.6"],
        review: "Multiply per-case cost by workload in each lane, add planned review cost, then compare the total for each operating window.",
      },
      {
        id: "flow", title: "Preserve the human approval boundary",
        objectives: ["5.3", "6.5"], revisedObjectives: ["5.4", "6.3"],
        review: "Capacity is a separate constraint from model spend. Assign the maximum affordable reviews and defer the remainder with a hold on final actions.",
      },
      {
        id: "runtime", title: "Use the approved runtime",
        objectives: ["1.2", "5.4"], revisedObjectives: ["1.6", "5.5"],
        review: "Treat the runtime boundary, data custody, and retention review as deployment requirements alongside model performance.",
      },
      {
        id: "gate", title: "Leave a usable launch and handoff record",
        objectives: ["4.1", "6.5"], revisedObjectives: ["4.2", "6.3"],
        review: "Write a measurable release gate for each slice. Name the operator responsible for follow-through when one slice misses its target.",
      },
    ],
    preview: (draft) => ({
      kind: "comparison",
      windows: [evaluateShift(input, draft, "start"), evaluateShift(input, draft, "changed")].map(
        ({ shift, routine, complex, review, defer, cost, minutes }) => ({
          name: shift.name, budget: shift.budget, reviewMinutes: shift.reviewMinutes, cost, minutes,
          route: `Routine: ${routine?.name ?? "pending"} for ${shift.routine} · complex: ${complex?.name ?? "pending"} for ${shift.complex}`,
          queue: `Review now: ${review ?? "pending"} · hold: ${defer ?? "pending"}`,
        })),
      decision: [
        `Runtime ${draft.host || "pending"} · Routine gate ${draft.routineGate || "pending"}% · Complex gate ${draft.complexGate || "pending"}%`,
        `Handoff owner ${draft.owner || "pending"}`,
        draft.rationale,
      ].filter(Boolean).join("\n"),
    }),
    exercise: (draft) => {
      const windows = [evaluateShift(input, draft, "start"), evaluateShift(input, draft, "changed")];
      return [
        test("models", windows.every(({ qualityPassed }) => qualityPassed),
          "Both model choices meet the measured quality and latency gates in their lanes.",
          "A route misses the acceptance or p95 requirement for at least one lane."),
        test("cost", windows.every(({ cost, shift }) => cost !== null && cost <= shift.budget),
          "The two plans fit their assigned budgets including staffed review.",
          "A plan is missing a cost input or exceeds its operating budget when reviewer work is included."),
        test("flow", windows.every(({ shift, review, defer, minutes, cost, reviewCapacity }) => {
          if (review === null || defer === null || minutes === null || cost === null) return false;
          const fixedModelCost = cost - review * input.approvalCents;
          const affordable = Math.floor((shift.budget - fixedModelCost) / input.approvalCents);
          return review === Math.min(shift.signedReview, reviewCapacity, affordable) &&
            review + defer === shift.signedReview && minutes <= shift.reviewMinutes;
        }), "The plans use available reviewer capacity and hold the remaining unsigned records.",
          "Review assignments and deferred records must reconcile with the approval queue, the time cap, and the remaining budget."),
        test("runtime", words(draft.host) === words(input.host),
          "Sensitive requests remain on the approved runtime.", "The draft names an unapproved or missing runtime for sensitive records."),
        test("gate", integer(draft.routineGate) === input.routineTarget && integer(draft.complexGate) === input.complexTarget &&
          words(draft.owner) === words(input.owner),
          "Both rollout gates and the escalation owner match the service contract.",
          "Record the separate agreed percentages and the owner who pauses final actions."),
      ];
    },
    reference: { label: "Review measurable success criteria and evaluations", url: "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests" },
  };
}

export const professionalDefinitions = {
  capstone: design({
    id: "professional-maintenance-rollout-v1", stage: "capstone", title: "Design a maintenance intake rollout",
    brief: "The facilities partner plans to deploy a service for routine and complex maintenance requests. Before sign-off, a staffing change reduces the time available for reviewing final actions. Return a revised decision record.",
    start: { name: "Original window", routine: 88, complex: 32, signedReview: 10, reviewMinutes: 60, budget: 690 },
    changed: { name: "Revised window", routine: 65, complex: 45, signedReview: 12, reviewMinutes: 32, budget: 680 },
    models: [
      { name: "Circuit", routineCents: 3, complexCents: 3, routineQuality: 97, complexQuality: 86, routineMs: 900, complexMs: 1200 },
      { name: "Lattice", routineCents: 8, complexCents: 9, routineQuality: 98, complexQuality: 96, routineMs: 1500, complexMs: 4300 },
    ],
    routineTarget: 95, complexTarget: 94, routineLatency: 1500, complexLatency: 4600,
    approvalMinutes: 4, approvalCents: 8, host: "Regional private runtime",
    alternate: "General-purpose workspace", owner: "Facilities duty lead",
  }),
  transfer: design({
    id: "professional-grants-lab-transfer-v1", stage: "transfer", title: "Rescope a recreation intake pilot",
    brief: "A recreation partner must process routine registrations and complex exception cases. The amended contract leaves its staffing cap intact but changes its budget and case mix. Submit the updated architecture decision without dropping the sign-off gate.",
    start: { name: "Original block", routine: 55, complex: 20, signedReview: 8, reviewMinutes: 54, budget: 625 },
    changed: { name: "Revised block", routine: 45, complex: 32, signedReview: 10, reviewMinutes: 54, budget: 655 },
    models: [
      { name: "Beacon", routineCents: 5, complexCents: 5, routineQuality: 98, complexQuality: 89, routineMs: 800, complexMs: 1400 },
      { name: "Harbor", routineCents: 9, complexCents: 10, routineQuality: 99, complexQuality: 96, routineMs: 1600, complexMs: 2900 },
    ],
    routineTarget: 96, complexTarget: 95, routineLatency: 1400, complexLatency: 3200,
    approvalMinutes: 6, approvalCents: 15, host: "Partner tenant",
    alternate: "Personal workspace", owner: "Recreation intake supervisor",
  }),
};

export const professionalRevisedDefinitions = {
  capstone: design({
    id: "professional-fleet-rollout-revised-v1", stage: "capstone", title: "Design a fleet service pilot",
    brief: "A fleet desk is choosing a routing design for standard repairs and ambiguous maintenance claims. After the first sizing review, Finance lowers the spending cap and keeps the approval rule. Revise the plan and document the gate.",
    start: { name: "Original shift", routine: 80, complex: 20, signedReview: 8, reviewMinutes: 56, budget: 620 },
    changed: { name: "Amended shift", routine: 70, complex: 28, signedReview: 9, reviewMinutes: 56, budget: 622 },
    models: [
      { name: "Keel", routineCents: 4, complexCents: 4, routineQuality: 97, complexQuality: 87, routineMs: 1100, complexMs: 1300 },
      { name: "Atlas", routineCents: 9, complexCents: 10, routineQuality: 99, complexQuality: 97, routineMs: 1750, complexMs: 3200 },
    ],
    routineTarget: 96, complexTarget: 95, routineLatency: 1300, complexLatency: 3500,
    approvalMinutes: 7, approvalCents: 12, host: "Fleet approved tenant",
    alternate: "Workspace preview", owner: "Fleet approval lead",
  }),
  transfer: design({
    id: "professional-archive-handoff-transfer-revised-v1", stage: "transfer", title: "Resize an archive requests rollout",
    brief: "An archive hub will take routine catalog questions and complex provenance requests. A staffing contingency changes the maximum sign-off time while case volume rises. Reconcile the revised operating record.",
    start: { name: "Planned window", routine: 60, complex: 24, signedReview: 10, reviewMinutes: 60, budget: 750 },
    changed: { name: "Contingency window", routine: 54, complex: 36, signedReview: 14, reviewMinutes: 42, budget: 790 },
    models: [
      { name: "Folio", routineCents: 5, complexCents: 5, routineQuality: 98, complexQuality: 88, routineMs: 1000, complexMs: 1300 },
      { name: "Index", routineCents: 11, complexCents: 11, routineQuality: 99, complexQuality: 97, routineMs: 1600, complexMs: 3600 },
    ],
    routineTarget: 97, complexTarget: 96, routineLatency: 1500, complexLatency: 4100,
    approvalMinutes: 6, approvalCents: 12, host: "Archive restricted tenancy",
    alternate: "Shared research tenant", owner: "Archive review manager",
  }),
};
