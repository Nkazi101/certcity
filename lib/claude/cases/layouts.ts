export type WorkSection = {
  title: string;
  fields: readonly string[];
  preview?: number;
};

export type WorkLayout = {
  kind: "inbox" | "desk" | "ledger" | "redaction" | "trace" | "matrix" | "console" | "lanes" | "review" | "incident";
  sections: readonly WorkSection[];
  arrivals?: readonly { field: string; label: string; text: string }[];
};

function section(title: string, ...fields: string[]): WorkSection {
  return { title, fields };
}

function draft(title: string, preview: number, ...fields: string[]): WorkSection {
  return { title, fields, preview };
}

const layouts: Record<string, WorkLayout> = {
  "enrollment-replies": { kind: "inbox", sections: [
    section("New enrollment", "date"), section("Office reopening", "pending"), section("Late application", "late"),
  ], arrivals: [
    { field: "date", label: "Avery", text: "I’m applying for the first time. When do applications close?" },
    { field: "pending", label: "Cameron", text: "Do you know when the office reopens after repairs?" },
    { field: "late", label: "Morgan", text: "Can the office accept an application after the deadline?" },
  ] },
  "market-bulletin": { kind: "desk", sections: [
    draft("Vendor draft", 0, "hours", "cutoff"), draft("Staff instructions", 1, "staff"), section("Approval tray", "send"),
  ] },
  "school-notice-pilot": { kind: "desk", sections: [
    draft("Notice", 0, "list", "scope"), section("Intake form", "form"), draft("Pilot report", 1, "net", "corrections"),
  ] },
  "library-activity-kit": { kind: "desk", sections: [
    draft("Staff kit and idea tray", 0, "kit", "ideas"), draft("Catalog import", 1, "import"),
    section("Model trial", "routine", "conflicts"), section("Staff handoff", "handoff"),
  ] },
  "kitchen-billing-audit": { kind: "ledger", sections: [
    section("Order 27 · source and entry", "classify", "measure"), section("Next shift", "store"),
    section("Processing and review", "routine", "ambiguous"),
  ] },
  "community-policy": { kind: "redaction", sections: [
    section("Outgoing copy · A17", "address", "medical", "topic"),
    section("Front desk and mailbox", "date", "mail", "award"),
  ], arrivals: [
    { field: "address", label: "Address", text: "8 Birch" },
    { field: "medical", label: "Medical detail", text: "Synthetic report attached" },
    { field: "topic", label: "Topic", text: "Weekend training" },
  ] },
  "supplier-invoices": { kind: "ledger", sections: [
    section("Invoice 303 · printed and calculated", "expected", "gate"), section("Unreadable totals tray", "exception"),
  ] },
  "permit-agent": { kind: "trace", sections: [
    section("Connect returned results", "address", "eligibility"), section("Intake and resume", "draft", "resume"),
  ], arrivals: [
    { field: "eligibility", label: "First to finish", text: "Eligibility verified" },
    { field: "address", label: "Second to finish", text: "Address verified" },
  ] },
  "vendor-batch-api": { kind: "lanes", sections: [
    section("Counter", "counter"), section("Archive", "archive", "join", "retry"),
    section("Request contents", "prefix", "unreadable"),
  ] },
  "library-workers": { kind: "desk", sections: [
    draft("Editor’s packet", 0, "record", "coverage"), draft("Catalog interfaces", 1, "policy", "search"),
    draft("Shared procedure", 1, "procedure"),
  ] },
  "repair-desk-safety": { kind: "matrix", sections: [
    section("Cancellation service", "approve", "doc"), section("Inventory reply", "empty", "timeout"),
    section("Service maintenance", "hook", "key"),
  ] },
  "developer-release": { kind: "review", sections: [
    section("Versions and repeat trial", "pin", "trials"), section("Candidate gate", "slice", "floor"),
    section("Live release", "route", "live"),
  ] },
  "library-search": { kind: "trace", sections: [
    section("Pending tool call", "call", "connector"), section("Exhibit caption and sources", "saturday", "weekend"),
  ] },
  "community-handoff": { kind: "lanes", sections: [
    section("Before the room changes", "gate"), section("After the read returns", "time"), section("Resident requests", "human", "ambiguity"),
  ] },
  "release-review": { kind: "console", sections: [
    draft("Repository and trial", 0, "path", "label", "trial"), draft("Normalizer expectations", 1, "null", "empty"),
    section("Next operator", "notes"),
  ] },
  "repair-shop-tools": { kind: "matrix", sections: [
    section("Role capabilities", "triage"), section("Shared and personal settings", "shared", "experiment"),
    section("Targeted edit", "edit"),
  ] },
  "printworks-ci": { kind: "console", sections: [
    section("Review runner", "runner", "publish"), section("Proof acceptance", "threshold", "cross"),
  ] },
  "market-close": { kind: "lanes", sections: [
    section("Service queues", "live", "batch"), section("Confirmed order record", "date"), section("Audit slots", "hand", "other"),
  ] },
  "dispatch-monday-peak": { kind: "lanes", sections: [
    section("Temporary failures", "retry", "unknown"), section("Staff queue", "human"), section("Similar shipment labels", "ambiguity"),
  ] },
  "market-rush": { kind: "lanes", sections: [
    section("Live counter and overnight archive", "live"), section("Order provenance", "state"), section("Inspection table", "hand", "sample"),
  ] },
  "support-pilot": { kind: "review", sections: [
    section("Pilot candidate", "candidate"), section("Dispute queue", "close", "owner"), section("Stop condition", "stop"),
  ] },
  "public-permit-discovery": { kind: "review", sections: [
    section("Application journey", "scope", "issue", "status"), section("Cost comparison", "a"), section("Sponsor decision", "rollout"),
  ] },
  "professional-eval-gate": { kind: "review", sections: [
    section("Reviewer coverage", "layout", "equity", "grade"), section("Canary and promotion", "canary", "gate"),
  ] },
  "market-scale": { kind: "console", sections: [
    section("Pilot route", "model"), section("Assemble the request", "prefix", "active"), section("Comparison run", "example", "counter"),
  ] },
  "tenant-tools": { kind: "matrix", sections: [
    section("Identity and execution scope", "scope", "filter"), section("Available capabilities", "catalog", "discover"),
    section("Overnight transfer", "batch"),
  ] },
  "community-controls": { kind: "matrix", sections: [
    section("Action approval", "input", "approvals", "bind"), section("Copies and diagnostics", "copies", "log"),
    section("When the source is down", "outage"),
  ] },
  "regional-operations": { kind: "incident", sections: [
    section("First ten minutes", "page", "queue", "investigate"), section("Handoff to the next shift", "packet", "source", "resume"),
    section("Release follow-through", "extension", "issue"),
  ] },
};

export function workLayout(id: string): WorkLayout {
  const layout = layouts[id];
  if (!layout) throw new Error(`Missing workbench layout for ${id}`);
  return layout;
}
