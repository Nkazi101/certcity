import type { Choices } from "./missions";
import { fieldworkChoices, runReference, runRetrieval, runStream, validFieldwork } from "./fieldwork";
import type { Fieldwork } from "./fieldwork";

export const assignmentStations = {
  "kitchen-extract": "Receiving counter",
  "printworks-rules": "Proof workstation",
  "archive-coordination": "Research table",
  "library-desk": "Reference Project",
  "printworks-stream": "Event inspector",
  "library-retrieval-architecture": "Search bench",
} as const;

export type AssignmentWorkId = keyof typeof assignmentStations;

export function hasAssignmentWork(id: string): id is AssignmentWorkId {
  return Object.hasOwnProperty.call(assignmentStations, id);
}

export const invoices = [
  { id: "302", label: "Invoice 302", description: "Printed total agrees with the item lines.", status: "readable" },
  { id: "303", label: "Invoice 303", description: "Printed total 11,000¢. Item lines add up to 10,000¢.", status: "readable", printed: 11000, sum: 10000 },
  { id: "304", label: "Invoice 304", description: "There is a mark in the total field, but it cannot be read.", status: "unreadable" },
  { id: "blank", label: "Blank total", description: "The supplier left the total field empty.", status: "blank" },
] as const;
export type InvoiceStatus = "readable" | "unreadable" | "blank";
export type InvoiceExample = { source: string; status: InvoiceStatus };
export type InvoiceRoute = "unchanged" | "repair" | "review" | "clear";
export type KitchenWork = {
  kind: "kitchen-extract";
  examples: InvoiceExample[];
  typed: boolean;
  reconcile: boolean;
  date: InvoiceRoute;
  conflict: InvoiceRoute;
};

export const approvedProofExample = [
  "Proof file: spring-program-v3.pdf",
  "Paper size: checked against the order",
  "Approval: recorded before release",
].join("\n");

export const proofPaths = [
  { id: "posters", path: "packages/posters/tests/proof.test.ts", glob: "packages/posters/tests/**" },
  { id: "programs", path: "packages/programs/tests/proof.test.ts", glob: "packages/programs/tests/**" },
  { id: "billing", path: "packages/billing/src/invoice.ts", glob: "packages/billing/src/**" },
] as const;
export type ProofPath = typeof proofPaths[number]["id"];
export type FileLocation = "user" | "project";
export type SkillLocation = FileLocation | "instructions";
export type PrintWork = {
  kind: "printworks-rules";
  naming: FileLocation;
  tone: FileLocation;
  skill: SkillLocation;
  example: boolean;
  rule: "project" | "paths";
  paths: ProofPath[];
};

export const archiveRequests = {
  register: { name: "Property register", dates: "1904–1912", accession: "REG-27" },
  maps: { name: "Historic maps", dates: "1904–1912", accession: "MAP-41" },
} as const;

export const packetFields = [
  { id: "collection", label: "Collection boundary" },
  { id: "dates", label: "Date range" },
  { id: "accession", label: "Accession ID" },
  { id: "citation", label: "Citation fields" },
] as const;
export const briefSections = [
  { id: "register", label: "Property register", detail: "Completed findings and accession references." },
  { id: "maps", label: "Map findings", detail: "Verified results from three wards." },
  { id: "gaps", label: "Coverage gaps", detail: "Two wards remain unchecked." },
  { id: "retry", label: "Retry record", detail: "The maps worker used its one permitted retry." },
] as const;
type PacketField = typeof packetFields[number]["id"];
type BriefSection = typeof briefSections[number]["id"];
export type ArchiveWork = {
  kind: "archive-coordination";
  keepRegister: boolean;
  south: "maps" | "register" | "both" | "none";
  packets: Record<"register" | "maps", PacketField[]>;
  parallel: boolean;
  access: "assigned" | "both";
  brief: BriefSection[];
};

export type AssignmentWork = KitchenWork | PrintWork | ArchiveWork | Fieldwork;

export const kitchenBaseline: KitchenWork = {
  kind: "kitchen-extract", examples: [], typed: false, reconcile: false, date: "unchanged", conflict: "unchanged",
};
export const printBaseline: PrintWork = {
  kind: "printworks-rules", naming: "user", tone: "user", skill: "user", example: false, rule: "project", paths: [],
};
export const archiveBaseline: ArchiveWork = {
  kind: "archive-coordination", keepRegister: true, south: "none", packets: { register: [], maps: [] }, parallel: false, access: "assigned", brief: [],
};

export function validAssignmentWork(id: string, candidate: unknown): candidate is AssignmentWork {
  if (!candidate || typeof candidate !== "object" || !("kind" in candidate) || candidate.kind !== id) return false;
  const value = candidate as AssignmentWork;
  const includes = (values: readonly string[], field: unknown) => typeof field === "string" && values.includes(field);
  const subset = (values: readonly string[], fields: unknown): fields is string[] => Array.isArray(fields)
    && fields.every((field) => includes(values, field)) && new Set(fields).size === fields.length;
  const boolean = (field: unknown) => typeof field === "boolean";
  switch (value.kind) {
    case "library-desk":
    case "printworks-stream":
    case "library-retrieval-architecture":
      return validFieldwork(value);
    case "kitchen-extract":
      return Array.isArray(value.examples) && value.examples.length <= 2 &&
        value.examples.every((item) => item && includes(invoices.map(({ id }) => id), item.source) &&
          includes(["readable", "unreadable", "blank"], item.status)) &&
        new Set(value.examples.map(({ source }) => source)).size === value.examples.length &&
        boolean(value.typed) && boolean(value.reconcile) &&
        [value.date, value.conflict].every((route) => includes(["unchanged", "repair", "review", "clear"], route));
    case "printworks-rules":
      return [value.naming, value.tone].every((scope) => includes(["user", "project"], scope)) &&
        includes(["user", "project", "instructions"], value.skill) && boolean(value.example) &&
        includes(["project", "paths"], value.rule) && subset(proofPaths.map(({ id }) => id), value.paths);
    case "archive-coordination":
      return boolean(value.keepRegister) && boolean(value.parallel) &&
        includes(["maps", "register", "both", "none"], value.south) && includes(["assigned", "both"], value.access) &&
        !!value.packets && subset(packetFields.map(({ id }) => id), value.packets.register) &&
        subset(packetFields.map(({ id }) => id), value.packets.maps) && subset(briefSections.map(({ id }) => id), value.brief);
  }
  return false;
}

export function runKitchen(work: KitchenWork) {
  // The simulator replays a fixed extractor failure. Only the paired examples
  // demonstrate the distinction between a mark that cannot be read and no mark.
  const correctlyPaired = (source: string, status: InvoiceStatus) =>
    work.examples.some((example) => example.source === source && example.status === status);
  const distinguishes = correctlyPaired("304", "unreadable") && correctlyPaired("blank", "blank");
  const rows = invoices.map((invoice) => {
    if ("printed" in invoice && work.reconcile) {
      return { ...invoice, extracted: `${invoice.printed.toLocaleString("en-US")}¢`, tray: "review", reason: `${(invoice.printed - invoice.sum).toLocaleString("en-US")}¢ above the trusted line sum.` };
    }
    if (invoice.status === "unreadable" || invoice.status === "blank") {
      const status = invoice.status === "unreadable" && !distinguishes ? "blank" : invoice.status;
      return { ...invoice, extracted: `null · ${status}`, tray: "review",
        reason: status === "unreadable" ? "Marked total needs a reader." : "No total available to post." };
    }
    return { ...invoice, extracted: "printed" in invoice ? `${invoice.printed.toLocaleString("en-US")}¢` : "Source total",
      tray: "posted", reason: "printed" in invoice ? "Posted without a line-sum check." : "Source and item lines agree." };
  });
  const exception = (route: InvoiceRoute, conflict: boolean) => {
    if (route === "review") return { tray: "review", reason: conflict ? "Both printed totals sent to the bookkeeper." : "Legible date waits for staff." };
    if (route === "clear") return { tray: "cleared", reason: "Source value dropped from the result." };
    if (route === "unchanged") return { tray: "retried", reason: "The same request returned the same problem." };
    return conflict
      ? { tray: "retried", reason: "The formatter cannot decide which source total takes precedence." }
      : { tray: "repaired", reason: "Validator feedback corrected the date format." };
  };
  const date = exception(work.date, false);
  const conflict = exception(work.conflict, true);
  return {
    rows, date, conflict, distinguishes,
    shape: work.typed ? "Amount text rejected at extraction." : "Amount text passed through the output contract.",
    passes: [distinguishes, work.typed && work.reconcile, date.tray === "repaired" && conflict.tray === "review"],
    posted: rows.filter(({ tray }) => tray === "posted").length,
    held: rows.filter(({ tray }) => tray === "review").length,
    mismatchHeld: rows.find(({ id }) => id === "303")?.tray === "review",
  };
}

export function runPrintworks(work: PrintWork) {
  const files = proofPaths.map((file) => ({ ...file, loaded: work.rule === "project" || work.paths.includes(file.id) }));
  const sharedNaming = work.naming === "project";
  const personalToneLeaked = work.tone === "project";
  const callable = work.skill === "project";
  const releaseReady = callable && work.example;
  return {
    files, sharedNaming, personalToneLeaked, callable, releaseReady,
    passes: [sharedNaming && !personalToneLeaked, releaseReady,
      files.every(({ id, loaded }) => loaded === (id !== "billing"))],
  };
}

export function runArchive(work: ArchiveWork) {
  const workers = (["register", "maps"] as const).map((id) => ({
    id,
    ...archiveRequests[id],
    missing: packetFields.filter((field) => !work.packets[id].includes(field.id)),
  }));
  const assignment = work.south === "maps" ? "South ward assigned to Historic maps."
    : work.south === "register" ? "Property register has no map holdings for the south ward."
      : work.south === "both" ? "Both workers received the same request. Only Historic maps can search it."
        : "South ward still has no worker.";
  const preserved = work.keepRegister ? "Completed register findings retained." : "Completed register findings removed from the desk.";
  const scoped = work.access === "assigned";
  const packetReady = workers.every(({ missing }) => !missing.length) && scoped;
  const brief = briefSections.filter(({ id }) => work.brief.includes(id));
  return {
    assignment, preserved, workers, packetReady, brief,
    passes: [work.keepRegister && work.south === "maps", packetReady && work.parallel, brief.length === briefSections.length],
  };
}

/** Project evaluated work onto the existing certification and save contract. */
export function assignmentChoices(work: AssignmentWork): Choices {
  switch (work.kind) {
    case "library-desk":
    case "printworks-stream":
    case "library-retrieval-architecture":
      return fieldworkChoices(work);
    case "kitchen-extract": {
      const result = runKitchen(work);
      return { "4.2": [result.distinguishes ? 1 : work.examples.length === 2 ? 2 : 0], "4.3": [work.typed ? 1 : 0, work.reconcile ? 3 : 2],
        "4.4": [result.passes[2] ? 1 : work.date === "clear" && work.conflict === "clear" ? 2 : 0] };
    }
    case "printworks-rules": {
      const [instructions, skill, rule] = runPrintworks(work).passes;
      return { "3.1": [instructions ? 1 : work.naming === "user" ? 0 : 2], "3.2": [skill ? 1 : work.skill === "instructions" ? 0 : 2],
        "3.3": [rule ? 1 : work.rule === "project" ? 0 : 2] };
    }
    case "archive-coordination": {
      const result = runArchive(work);
      return { "1.2": [result.passes[0] ? 1 : work.south === "register" ? 2 : 0],
        "1.3": [result.packetReady ? 1 : 0, work.parallel ? 3 : 2],
        "5.3": [result.passes[2] ? 1 : work.brief.includes("register") ? 0 : 2] };
    }
  }
}

export function assignmentWorkStatus(id: AssignmentWorkId, work?: AssignmentWork) {
  if (!work) return "Assignment open";
  switch (id) {
    case "kitchen-extract": return "Ledger protected";
    case "printworks-rules": return "Release ready";
    case "archive-coordination": return "Brief ready";
    case "library-desk": return "Project tested";
    case "printworks-stream": return "Proof console repaired";
    case "library-retrieval-architecture": return "Search validated";
  }
}

export function assignmentOutcome(work: AssignmentWork) {
  switch (work.kind) {
    case "library-desk": return `Fresh librarian chat · ${runReference(work).loaded.length} approved shared references · Restricted circulation excluded`;
    case "printworks-stream": return `Proof console · ${runStream(work).rows[0].browserEvents.length} live text deltas · Visitor blocked before forwarding`;
    case "library-retrieval-architecture": {
      const { hits, rows, p95 } = runRetrieval(work);
      return `Archive search · ${hits}/${rows.length} current matches · ${p95} ms fixture p95`;
    }
    case "kitchen-extract": {
      const result = runKitchen(work);
      return `Receiving batch · Held for review ${runKitchen(kitchenBaseline).held} → ${result.held} · ${result.mismatchHeld ? "1,000¢ mismatch caught before posting" : "mismatch posted"}`;
    }
    case "printworks-rules": {
      const result = runPrintworks(work);
      return `Clean checkout · Unrelated files loading the rule 1 → ${Number(result.files.some(({ id, loaded }) => id === "billing" && loaded))} · ${result.releaseReady ? "release Skill available" : "release procedure incomplete"}`;
    }
    case "archive-coordination": {
      const result = runArchive(work);
      return `Editor’s brief · ${result.brief.length} of 4 sections · Unchecked wards disclosed 0 → ${result.brief.some(({ id }) => id === "gaps") ? 2 : 0}`;
    }
  }
}
