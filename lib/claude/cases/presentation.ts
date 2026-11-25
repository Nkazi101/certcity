import { replayCasework } from "../casework";
import type { CaseBrief, CaseDraft, Casework } from "../casework";
import { caseworkFor } from "./index";
import { labFor } from "../../labs";
import { assignmentStations } from "../assignment-work";
import type { AssignmentWorkId } from "../assignment-work";
import { developerProfessionalSectionSources } from "./developer-professional";

// Source indexes follow the case file. The first source in each group starts open
// alongside its controls. The rest of the file remains accessible in the room.
const sectionSources: Record<string, readonly (readonly number[])[]> = {
  "enrollment-replies": [[0, 1], [0], [2]],
  "market-bulletin": [[0, 1], [2], [2, 1]],
  "school-notice-pilot": [[0, 1], [0], [2, 1]],
  "library-activity-kit": [[0, 1], [2, 0], [3], [2, 1]],
  "kitchen-billing-audit": [[0, 1, 2], [2], [3]],
  "community-policy": [[1, 2], [2, 0]],
  "supplier-invoices": [[1, 0, 2], [2]],
  "permit-agent": [[0, 1], [2]],
  "vendor-batch-api": [[0], [1], [2]],
  "library-workers": [[0, 1], [2], [2]],
  "repair-desk-safety": [[0], [1], [2, 3]],
  "developer-release": [[0, 2], [1, 2], [3]],
  "library-search": [[0], [1, 2]],
  "community-handoff": [[0], [1], [2]],
  "release-review": [[0, 2], [1, 0], [2]],
  "repair-shop-tools": [[0], [1], [2]],
  "printworks-ci": [[0], [1, 2]],
  "market-close": [[0], [1], [2]],
  "dispatch-monday-peak": [[0, 1], [1, 2], [1, 0]],
  "market-rush": [[0], [1], [2]],
  "support-pilot": [[0, 1], [1, 2], [2]],
  "public-permit-discovery": [[0, 2], [1], [2]],
  "professional-eval-gate": [[0, 1], [2]],
  "market-scale": [[0], [1], [2]],
  "tenant-tools": [[1, 0], [0, 2], [2]],
  "community-controls": [[0, 2], [1], [2]],
  "regional-operations": [[0, 1], [2, 1], [3]],
  ...developerProfessionalSectionSources,
};

export function sourcesForSection(id: string, exercise: Casework, section: number) {
  return (sectionSources[id]?.[section] ?? []).flatMap((index) => {
    const source = exercise.references[index];
    return source ? [source] : [];
  });
}

export type WorkstationBrief = CaseBrief;

// Assignment workstations keep their directions here. Labs and casework stations carry theirs in their own files.
const assignmentWorkstations: Record<string, WorkstationBrief> = {
  "kitchen-extract": {
    problem: "The extractor can send an incorrect total straight to the ledger.",
    move: "Compare Invoice 303’s printed total with its line items, then look at what the Ledger tab records for each invoice.",
    success: ["0 mismatched totals posted", "Unreadable and blank totals reach staff as different states", "Every held invoice keeps its printed and computed amounts"],
  },
  "library-desk": {
    problem: "A fresh Project chat can give advice from an outdated reference.",
    move: "Compare the dated FAQs in Policy shelf. Note what a brand-new chat in the Project would be able to read.",
    success: ["A fresh chat quotes the current cancellation rule", "Exception requests reach staff", "Restricted circulation records stay unreachable"],
  },
  "printworks-stream": {
    problem: "The proof preview loses part of a line when its response arrives in chunks.",
    move: "Step through the recorded proof. Find the first chunk where the browser’s text differs from the provider’s.",
    success: ["Every recorded fixture renders the full proof", "A stream error is shown as an error, not a finished proof", "Provider credentials never reach the browser"],
  },
  "library-retrieval-architecture": {
    problem: "The archive misses requests written in plain language and can surface retired material.",
    move: "Run the labeled queries first. Compare which expected records each stage of Search pipeline returns.",
    success: ["Both exact-ID and plain-language queries find the expected record", "0 retired revisions cited", "p95 latency stays under the stated limit"],
  },
};

/**
 * The directions for the station the room actually opens. A registered lab replaces its casework station
 * (see lib/labs/index.ts), so its brief wins; the casework brief would name records the learner never sees.
 */
export function workstationBrief(id: string): WorkstationBrief | undefined {
  return labFor(id)?.brief ?? caseworkFor(id)?.brief ?? assignmentWorkstations[id];
}

/** The station's name as the room's button, its 3D marker and the station's own heading all show it. */
export function stationName(id: string): string | undefined {
  return labFor(id)?.station.split(" · ")[0] ?? caseworkFor(id)?.station ?? (Object.hasOwn(assignmentStations, id) ? assignmentStations[id as AssignmentWorkId] : undefined);
}

export function roomFirstAction(id: string, fallback: string) {
  return workstationBrief(id)?.move ?? fallback;
}

const roomSampleOutcome: Record<string, number> = {
  "supplier-invoices": 1,
  "regional-operations": 0,
};

export function roomCaseOutcome(id: string, exercise: Casework, saved: CaseDraft) {
  const sample = roomSampleOutcome[id];
  return replayCasework(exercise, saved, sample === undefined).checks[sample ?? 0].effect;
}
