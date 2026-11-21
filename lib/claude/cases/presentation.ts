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

export type WorkstationBrief = { problem: string; move: string; ready: string };

const workstations: Record<string, WorkstationBrief> = {
  "enrollment-replies": {
    problem: "A family received last year’s enrollment deadline.",
    move: "Compare Avery’s message with the signed bulletin, then set the closing date in the reply.",
    ready: "The replay uses the signed date, leaves reopening pending and sends the late request to the enrollment lead.",
  },
  "market-bulletin": {
    problem: "The Friday draft tells vendors to arrive at the wrong time.",
    move: "Compare the Vendor draft with Inez’s signed sheet. Edit the opening time and delivery cutoff.",
    ready: "Both audiences get the right details, and the new vendor request waits for approval.",
  },
  "school-notice-pilot": {
    problem: "A rewritten notice dropped a document families need to bring.",
    move: "Check the signed checklist beside the Notice. Edit the requirements families will see.",
    ready: "The notice is complete, the pilot reports total effort, and a form with no date goes back to intake.",
  },
  "library-activity-kit": {
    problem: "An unapproved activity made it into the catalog.",
    move: "Read the signed minutes beside Staff kit and idea tray. Decide which entries belong in the kit.",
    ready: "Staff can edit the kit, only approved IDs reach the import, and the next preview keeps verified dates and links.",
  },
  "kitchen-billing-audit": {
    problem: "A refund appeared as a sale after the supplier changed its export.",
    move: "Open both exports for Order 27. Set how the ledger classifies and measures the entry.",
    ready: "The refund keeps its source, the next shift can reuse the rule, and an ambiguous order waits for staff.",
  },
  "community-policy": {
    problem: "The outgoing packet includes private details and some intake dates are missing.",
    move: "Read sample A17 beside the outgoing copy. Edit which details the analysis team receives.",
    ready: "Only the permitted material leaves the desk, missing dates are requested, and staff still decide awards.",
  },
  "supplier-invoices": {
    problem: "Invoice 303 passed the importer even though its printed total disagrees with the item lines.",
    move: "Compare the supplier copy’s two totals. Set the expected line sum and the check before posting.",
    ready: "A matching invoice posts, Invoice 303 is held, and an unreadable total stays attached to its source.",
  },
  "permit-agent": {
    problem: "Case P-42 stopped after promising a lookup. The results returned out of order.",
    move: "Read Requested tools and the cards showing what finished first. Connect each returned record to its request.",
    ready: "Both results join the right calls, incomplete intake stays blocked, and the next clerk restores the verified case.",
  },
  "vendor-batch-api": {
    problem: "A vendor is waiting while the archive runs, and a retry entered one order twice.",
    move: "Check the deadline in Live counter first. Set the counter’s transport before repairing the archive join.",
    ready: "The counter stays responsive, the archive keeps its successes, and the new smudged ID is recognized.",
  },
  "library-workers": {
    problem: "The editor received logs and lost the finding a worker had verified.",
    move: "Compare Register worker and Map worker, then choose what goes in the editor’s packet.",
    ready: "The packet keeps the verified citation and pending work distinct, and staff can use the right catalog interface.",
  },
  "repair-desk-safety": {
    problem: "A cancellation bypassed review and a supplier outage looked like zero stock.",
    move: "Read the Approval ledger first. Set what the cancellation service checks when it receives a request.",
    ready: "Unapproved actions wait, empty stock and outages stay distinct, and staging is isolated.",
  },
  "developer-release": {
    problem: "The demo passed while corrected addresses kept failing.",
    move: "Check Pinned release and Release contract. Set what a repeat trial must preserve before opening the candidate gate.",
    ready: "The rerun is reproducible, failed address cases block promotion, and the next trial keeps routine costs bounded.",
  },
  "library-search": {
    problem: "The photo lookup stopped and the exhibit caption combines two different attendance measures.",
    move: "Inspect pending call c42 in the trace. Set what happens before the assistant continues.",
    ready: "The result returns under the pending call, and the caption keeps the Saturday count and weekend estimate sourced separately.",
  },
  "printworks-rules": {
    problem: "The evening crew’s fresh checkout misses the shop’s proof instructions.",
    move: "Open CLAUDE.md. Set where the shared proof naming convention should live.",
    ready: "Run clean checkout. The evening crew sees the shared naming and checklist, with the test rule limited to the right files.",
  },
  "kitchen-extract": {
    problem: "The extractor can send an incorrect total straight to the ledger.",
    move: "Compare Invoice 303’s printed total and line sum. Change the checks under Ledger.",
    ready: "Run receiving batch. The mismatch stays out of the ledger, and unreadable and blank totals remain distinct.",
  },
  "community-handoff": {
    problem: "A room change went through without the matching approval.",
    move: "Read the Write log beside Before the room changes. Decide where the check for verification runs.",
    ready: "Unverified changes stay blocked, timestamps arrive in the needed form, and open requests reach the right next step.",
  },
  "archive-coordination": {
    problem: "One worker finished while another district is still missing from the report.",
    move: "Compare the Property register and Historic maps packets. Decide which findings to keep before assigning the missing search.",
    ready: "The dispatch replay preserves completed work, gives each worker enough context, and the brief keeps their sourced findings.",
  },
  "release-review": {
    problem: "A normalizer passed its local test and broke a second import.",
    move: "Compare both callers in Call-site trace. Set the repository trial before changing the normalizer expectations.",
    ready: "Both callers are covered from the same baseline, null and empty remain distinct, and the next operator can continue.",
  },
  "repair-shop-tools": {
    problem: "Triage can edit jobs it should only read and a fresh checkout lost a shared connector.",
    move: "Read the Access register, then set the capabilities the triage role receives.",
    ready: "Triage can read approved status, the team gets the shared connector, and the patch touches only the intended call.",
  },
  "printworks-ci": {
    problem: "Review rejected a valid proof twice and missed a rendering mismatch.",
    move: "Read Runner environment beside Review runner. Set how the reviewer runs and hands off its finding.",
    ready: "Valid proofs pass, a retry creates no duplicate, and an independently reproduced mismatch blocks release.",
  },
  "market-close": {
    problem: "A vendor is still waiting and two closing records share the same surname.",
    move: "Read Service clock beside Service queues. Set how the counter and overnight work are handled.",
    ready: "The counter replies on time, risky records fit the available audit slots, and confirmed dates keep their source.",
  },
  "dispatch-monday-peak": {
    problem: "Forty-eight lookups timed out and support has only two hours.",
    move: "Compare Lookup policy and Queue card beside Temporary failures. Set what the lookup should retry.",
    ready: "Recovered tickets finish, remaining and requested handoffs fit the staffed queue, and a similar label prompts clarification.",
  },
  "market-rush": {
    problem: "The counter and the overnight import share a budget during a rush.",
    move: "Use Queues to compare volume and price. Set which work goes through the live counter.",
    ready: "Both lanes fit the budget, inspections cover the known risk, and the next order keeps its signed pickup date.",
  },
  "support-pilot": {
    problem: "The pilot has forty disputes and no rule for when to stop.",
    move: "Compare Controlled trial and Operating limits beside Pilot candidate. Choose the candidate to test.",
    ready: "The pilot stays inside its service limits, staff own disputes, and a wrong closure stops promotion.",
  },
  "public-permit-discovery": {
    problem: "Missing attachments make applicants wait longer than drafting does.",
    move: "Read Journey log beside Application journey. Choose the first part of intake to pilot.",
    ready: "Missing attachments are caught early, staff retain issuance, and the sponsor can see the cost and rollout limit.",
  },
  "library-retrieval-architecture": {
    problem: "The archive misses requests written in plain language and can surface retired material.",
    move: "Check Candidate retrieval in Search pipeline. Compare its coverage with the expected matches in Review labeled queries.",
    ready: "Run the labeled query set. Both types find current records with source details, and the run stays under the latency limit.",
  },
  "professional-eval-gate": {
    problem: "The pilot got faster while appeals and a new attachment layout got worse.",
    move: "Open Labeled examples and Review desk in Reviewer coverage. Allocate checks to the affected cases.",
    ready: "Review fits its time budget and promotion stops when escalation quality fails, even if the overall average improves.",
  },
  "market-scale": {
    problem: "Vendor requests got more expensive and an approved exception looks like a missing document.",
    move: "Compare Candidate runs against the desk’s limits. Set the pilot route before rebuilding the request.",
    ready: "The route meets time, cost and quality limits, and the matched run keeps the verified waiver distinct from missing evidence.",
  },
  "tenant-tools": {
    problem: "Triage can see unrelated capabilities from a shared lookup.",
    move: "Read Verified scope card and Triage contract. Set how identity limits the records the lookup can return.",
    ready: "Authorized reads still work, unrelated tools and records stay out, and the overnight bulk job keeps its own interface.",
  },
  "community-controls": {
    problem: "A write used a different amount from the one approved, and private text reached diagnostics.",
    move: "Read Approval ledger in Action approval. Set which version and amount the service can act on.",
    ready: "A changed amount waits for approval, diagnostics keep metadata only, and the outage keeps its trace.",
  },
  "regional-operations": {
    problem: "Writes fail after deployment. On-call has ten minutes to restore a staffed route for residents.",
    move: "Read Incident clock. Choose First contact, then use Trace W-19 to decide how to investigate.",
    ready: "The manual queue opens within the limit, and the next shift gets a versioned handoff it can use to resume.",
  },
  "library-desk": {
    problem: "A fresh Project chat can give advice from an outdated reference.",
    move: "Compare the dated FAQs in Policy shelf. Use File placement to choose what a fresh Project chat can see.",
    ready: "Open a fresh test chat. It uses the current approved reference, sends exceptions to staff and honors the intended access.",
  },
  "printworks-stream": {
    problem: "The proof preview loses part of a line when its response arrives in chunks.",
    move: "Step through the recorded proof. Check the chunk that ends mid-line before choosing the decoder.",
    ready: "Run proof console fixtures. Complete events arrive intact and a fresh checkout retains the approved proof instructions.",
  },
};

export function workstationBrief(id: string): WorkstationBrief | undefined {
  return workstations[id];
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
