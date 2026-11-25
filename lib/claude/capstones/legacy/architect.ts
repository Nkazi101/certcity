import { integer, jsonObject, sameList, sameMembers, test, words } from "../model";
import type { CapstoneDefinition, CapstoneDraft, CapstoneStage } from "../model";

type Worker = {
  id: string;
  job: string;
  fields: readonly string[];
  citation: string;
};

type WorkflowCase = {
  id: string;
  stage: CapstoneStage;
  title: string;
  brief: string;
  snapshot: string;
  obsolete: string;
  workers: readonly [Worker, Worker];
  queue: string;
};

type Run = "success" | "temporary" | "permanent" | "denied";

const commands = ["authorize", "load_records", "assign_workers", "reconcile", "release"];

function scenario(input: WorkflowCase, draft: CapstoneDraft, run: Run) {
  const plan = jsonObject(draft.plan);
  const trace: string[] = [];
  const calls: string[] = [];
  const delegated: { worker: string; fields: unknown }[] = Array.isArray(plan?.delegation)
    ? plan.delegation.flatMap((worker: unknown) => worker && typeof worker === "object" && "worker" in worker && typeof worker.worker === "string"
      ? [{ worker: worker.worker, fields: "fields" in worker ? worker.fields : undefined }] : [])
    : [];
  let authorized = false;
  let source = "";
  let reconciled = false;
  let released = false;
  let earlyRelease = false;
  let missing: string[] = [];
  let citations: string[] = [];

  for (const command of Array.isArray(plan?.sequence) ? plan.sequence : []) {
    if (command === "authorize") {
      if (run === "denied") {
        trace.push("Authorization denied. Workflow stopped.");
        break;
      }
      authorized = true;
      trace.push("Authorization confirmed.");
    } else if (command === "load_records") {
      source = typeof plan?.recordVersion === "string" ? plan.recordVersion : "";
      trace.push(`Record version ${source || "missing"} loaded.`);
    } else if (command === "assign_workers") {
      for (const worker of delegated) {
        const model = input.workers.find(({ id }) => id === worker.worker);
        calls.push(worker.worker);
        trace.push(`Assigned ${worker.worker} from ${source || "an unloaded record set"}.`);
        if (!model || !sameMembers(worker.fields, model.fields)) continue;
        const status = worker.worker === input.workers[1].id && (run === "temporary" || run === "permanent") ? run : "success";
        if (status === "success") {
          citations.push(model.citation);
          continue;
        }
        trace.push(status === "temporary" ? `${worker.worker} timed out.` : `${worker.worker} could not complete the read.`);
        const mayRetry = Number(integer(draft.retryLimit)) > 0 && draft.retryOn?.trim().toLowerCase() === status;
        if (mayRetry) {
          const amount = Math.min(integer(draft.retryLimit) ?? 0, 3);
          for (let i = 0; i < amount; i++) calls.push(worker.worker);
          trace.push(`Retried ${worker.worker} ${amount} time${amount === 1 ? "" : "s"}.`);
        }
        if (status === "temporary" && mayRetry) {
          trace.push(`${worker.worker} recovered and returned ${model.citation}.`);
          citations.push(model.citation);
        } else missing.push(worker.worker);
      }
    } else if (command === "reconcile") {
      reconciled = true;
      if (missing.length && plan?.preserve !== true) citations = [];
      trace.push(`Reconciled records. Provenance retained for ${citations.length} result${citations.length === 1 ? "" : "s"}.`);
    } else if (command === "release") {
      if (!authorized || !reconciled || !source) earlyRelease = true;
      if (missing.length && words(draft.route) === words(input.queue)) trace.push(`Deferred to ${input.queue} with confirmed evidence and missing coverage.`);
      else {
        released = true;
        trace.push("Sent to the release queue.");
      }
    } else {
      trace.push(`Unknown command ${String(command)}.`);
    }
  }
  missing = [...new Set(missing)];
  return { source, calls, trace, citations, missing, released, earlyRelease };
}

function workflow(input: WorkflowCase): CapstoneDefinition {
  const initial = JSON.stringify({
    sequence: ["load_records", "assign_workers", "release"],
    recordVersion: input.obsolete,
    delegation: input.workers.map(({ id }) => ({ worker: id, fields: ["resident_contact", "full_transcript"] })),
    preserve: false,
  }, null, 2);

  return {
    id: input.id, stage: input.stage, title: input.title, role: "Workflow lab", brief: input.brief,
    deliverable: "Repair the workflow manifest, set a bounded retry, and route a partial report with its verified evidence intact.",
    documents: [
      {
        id: "VERSION", title: "Record versions and release control",
        text: `Current signed record set ${input.snapshot}. The cached set ${input.obsolete} expired. Authorize each request before loading the records or assigning workers. Reconcile worker evidence with the signed record set before release.`,
      },
      {
        id: "JOBS", title: "Worker contracts",
        text: input.workers.map(({ id, job, fields, citation }) => `${id} · ${job}. Required fields ${fields.join(", ")}. Verified result carries archive reference ${citation}.`).join("\n\n") +
          "\n\nKeep the resident contact and full transcript in the coordinator’s workspace.",
      },
      {
        id: "REVIEW", title: "Service recovery policy",
        text: `Retry a temporary read failure once. A permanent failure needs a handoff to ${input.queue}, with successful citations and a list of missing results. Release a completed report only after verifying coverage.`,
      },
      {
        id: "MANIFEST", title: "Manifest interface",
        text: `Available commands: ${commands.join(", ")}. Write their order in sequence. recordVersion selects a record set. For each delegation entry, supply worker and its allowed fields. preserve controls whether a partial report carries completed citations.`,
      },
    ],
    fields: [
      { id: "plan", label: "Workflow manifest", editor: "json", initial },
      { id: "retryOn", label: "Failure allowed to retry", instruction: "Enter the failure class from the service policy.", initial: "permanent" },
      { id: "retryLimit", label: "Retry limit per failed read", initial: "3" },
      { id: "route", label: "Owner of the partial handoff" },
    ],
    criteria: [
      {
        id: "order", title: "Protect the work and release sequence",
        objectives: ["1.1", "1.4", "1.6"],
        review: "Gate delegation with request authorization, bind work to a verified record set, then reconcile coverage before releasing a report.",
      },
      {
        id: "delegation", title: "Pass the inputs each worker needs",
        objectives: ["1.2", "1.3", "2.3"],
        review: "Send each worker only the fields its contract requires. Keep private contact and coordinator history out of worker inputs.",
      },
      {
        id: "state", title: "Use the signed record state",
        objectives: ["5.1", "5.6"],
        review: "Carry the active source revision across handoffs and retries. Preserve citations so another operator can reproduce the run.",
      },
      {
        id: "retry", title: "Recover from temporary failures",
        objectives: ["2.2", "5.3"],
        review: "Retry the affected read within its limit on a temporary failure. Preserve successful worker outcomes and surface permanent failures.",
      },
      {
        id: "handoff", title: "Keep verified evidence in a partial handoff",
        objectives: ["5.2", "5.3", "5.6"],
        review: "Separate an unresolved check from verified evidence. Route the partial report to its named queue with the successful citations and missing coverage.",
      },
    ],
    runs: [
      { id: "success", label: "Authorized request" },
      { id: "denied", label: "Denied request" },
      { id: "temporary", label: "Temporary worker failure" },
      { id: "permanent", label: "Permanent worker failure" },
    ],
    preview: (draft, run) => {
      const { trace, citations, missing } = scenario(input, draft,
        run === "denied" || run === "temporary" || run === "permanent" ? run : "success");
      return { kind: "trace", steps: trace, citations, missing };
    },
    exercise: (draft) => {
      const plan = jsonObject(draft.plan);
      const normal = scenario(input, draft, "success");
      const denied = scenario(input, draft, "denied");
      const temporary = scenario(input, draft, "temporary");
      const permanent = scenario(input, draft, "permanent");
      const [primary, secondary] = input.workers;
      return [
        test("order", sameList(plan?.sequence, commands) && normal.released &&
          !normal.earlyRelease && !denied.calls.length && !denied.released,
        "A denied request stops before worker calls. The authorized report releases after reconciliation.",
        "The sequence must gate worker work, load the records, and reconcile coverage before release."),
        test("delegation", sameMembers(normal.calls, input.workers.map(({ id }) => id)) &&
          sameMembers(normal.citations, input.workers.map(({ citation }) => citation)),
        "Both workers received their scoped packets and returned evidence.", "One or more worker assignments are missing, duplicated, or outside the worker contract."),
        test("state", normal.source === input.snapshot && temporary.source === input.snapshot,
          "The signed record version stays active when the workflow retries.", "A later run is still using the cached, obsolete, or missing record version."),
        test("retry", words(draft.retryOn) === "temporary" && integer(draft.retryLimit) === 1 &&
          sameMembers(temporary.citations, [primary.citation, secondary.citation]) &&
          temporary.calls.filter((id) => id === secondary.id).length === 2 &&
          temporary.calls.filter((id) => id === primary.id).length === 1 &&
          permanent.calls.filter((id) => id === secondary.id).length === 1,
        "The temporary failure recovers with one retry of the affected worker. Verified work stays in place.",
        "A temporary failure needs one retry of the affected read. A permanent failure needs escalation."),
        test("handoff", !permanent.released && !permanent.earlyRelease &&
          words(draft.route) === words(input.queue) && sameMembers(permanent.missing, [secondary.id]) &&
          sameMembers(permanent.citations, [primary.citation]),
        "The review queue receives the verified citation and an explicit coverage gap.",
        "The partial report must keep completed evidence and route missing coverage to the review owner."),
      ];
    },
    reference: { label: "Review patterns for effective agents", url: "https://www.anthropic.com/research/building-effective-agents" },
  };
}

export const architectDefinitions = {
  capstone: workflow({
    id: "architect-canal-readiness-v1", stage: "capstone", title: "Coordinate a canal access report",
    brief: "A seasonal reopening needs a confirmed access report. Records and field inspection are handled by separate teams. Repair the draft workflow so it can assemble verified evidence and handle incomplete work.",
    snapshot: "CANAL-REV-5", obsolete: "CANAL-REV-4",
    workers: [
      { id: "permit-register", job: "Read the approval register", fields: ["site_id", "record_revision"], citation: "PR-28" },
      { id: "inspection-log", job: "Read the latest inspection", fields: ["site_id", "inspection_date"], citation: "IN-14" },
    ],
    queue: "Access review desk",
  }),
  transfer: workflow({
    id: "architect-museum-inventory-transfer-v1", stage: "transfer", title: "Recover a gallery inventory handoff",
    brief: "Two registrars are reconciling a loan return and a case inspection. The initial manifest releases a result on incomplete coverage. Repair the workflow using the new worker contracts and its retained records.",
    snapshot: "LOAN-REV-9", obsolete: "LOAN-REV-7",
    workers: [
      { id: "loan-ledger", job: "Verify the loan record", fields: ["loan_id", "storage_location"], citation: "LL-62" },
      { id: "condition-register", job: "Verify returned condition", fields: ["accession_id", "record_revision"], citation: "CR-25" },
    ],
    queue: "Collections triage",
  }),
};
