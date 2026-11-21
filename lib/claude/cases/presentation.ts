import { replayCasework } from "../casework";
import type { CaseDraft, Casework } from "../casework";

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
};

export function sourcesForSection(id: string, exercise: Casework, section: number) {
  return (sectionSources[id]?.[section] ?? []).flatMap((index) => {
    const source = exercise.references[index];
    return source ? [source] : [];
  });
}

const firstActions: Record<string, string> = {
  "enrollment-replies": "Open Avery’s message and check the date against the signed bulletin.",
  "market-bulletin": "Open the vendor draft. Compare its opening time with the sheet Inez signed.",
  "school-notice-pilot": "Read the notice through a new family’s eyes, with the signed checklist beside it.",
  "library-activity-kit": "Check which activities the library actually approved before putting together the kit.",
  "kitchen-billing-audit": "Look at order 27 in both exports. Why does the same order have a different sign?",
  "community-policy": "Read sample A17 and decide what a colleague needs to see to handle the request.",
  "supplier-invoices": "Open Invoice 303 beside the ledger. Do the item lines add up to the printed total?",
  "permit-agent": "Put the two returned permit records beside their requests. The results arrived out of order.",
  "vendor-batch-api": "Start with the vendor at the live counter. Check how long they can wait for a reply.",
  "library-workers": "Put the register and map worker reports side by side. Check what the editor can confirm.",
  "repair-desk-safety": "Start with the cancellation and check what approval the service has on file.",
  "developer-release": "Open the pinned release and the candidate report. Check how each handles corrected addresses.",
  "library-search": "Trace the open photo lookup. Find the pending call and the result the next turn needs.",
  "printworks-rules": "Open the project naming rules. Check what a colleague sees on a fresh checkout.",
  "kitchen-extract": "Open Invoice 303. Compare its printed total with what the item lines add up to.",
  "community-handoff": "Open the room-change log. Check whether a verified record existed before the change.",
  "archive-coordination": "Compare the worker packets. Find the finished search and the district still missing.",
  "release-review": "Open both call sites for the normalizer. Check which one the local test actually exercises.",
  "repair-shop-tools": "Check the access register. What can a triage worker see and do on a repair job?",
  "printworks-ci": "Open the review runner. Check what it can return to the comment publisher.",
  "market-close": "Check the clock for the live counter and the overnight archive. Give each a route that can meet its deadline.",
  "dispatch-monday-peak": "Start with the stalled tickets. Which completed, and which can still recover?",
  "market-rush": "Look at the live counter and archive volumes. Check how much each queue would cost to run.",
  "support-pilot": "Open the controlled trial and check both candidates against the desk’s operating limits.",
  "public-permit-discovery": "Follow one incomplete application. Where does the applicant spend most of their time waiting?",
  "library-retrieval-architecture": "Run the current search, then compare the record-number result with the plain-language result.",
  "professional-eval-gate": "Open the appeals and small-organization samples. What would a faster average hide?",
  "market-scale": "Put the two candidate runs beside the cost, time and accuracy limits.",
  "tenant-tools": "Open the triage role card and the verified scope. Check what the worker can access.",
  "community-controls": "Check the approval ledger. Does the approval cover this exact change?",
  "regional-operations": "Open the incident clock and Trace W-19. Decide how to keep serving residents while writes are stuck.",
  "library-desk": "Open a fresh test chat and compare the source behind its answer with the policy shelf.",
  "printworks-stream": "Step through the first recorded proof. Look for the chunk that ends halfway through a line.",
};

export function roomFirstAction(id: string, fallback: string) {
  return firstActions[id] ?? fallback;
}

const roomSampleOutcome: Record<string, number> = {
  "supplier-invoices": 1,
  "regional-operations": 0,
};

export function roomCaseOutcome(id: string, exercise: Casework, saved: CaseDraft) {
  const sample = roomSampleOutcome[id];
  return replayCasework(exercise, saved, sample === undefined).checks[sample ?? 0].effect;
}
