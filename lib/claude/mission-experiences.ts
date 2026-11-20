import type { Mission } from "./missions";

export type RoomKind = "archive" | "printshop" | "kitchen" | "community" | "office" | "workshop" | "market" | "school" | "courthouse" | "dispatch";

export type MissionInterview = {
  id: string;
  name: string;
  role: string;
  portrait?: string;
  opening: string;
  question: string;
  reply: string;
};

export type MissionExperience = {
  kind: RoomKind;
  room: string;
  arrival: string;
  interviews: readonly [MissionInterview, MissionInterview];
};

const interview = (id: string, name: string, role: string, opening: string, question: string, reply: string, portrait?: string): MissionInterview => ({
  id, name, role, opening, question, reply, ...(portrait ? { portrait } : {}),
});

/** Authored entry and discovery beats for each city assignment. The replies expose only facts in that mission's case. */
export const missionExperiences: Record<string, MissionExperience> = {
  "library-search": {
    kind: "archive", room: "Local history reading room", arrival: "A catalog terminal faces the photo table; the accession ledger and exhibit label drafts are laid out for review.",
    interviews: [
      interview("nolan", "Nolan Price", "Archivist", "The draft assistant said it would check the catalog, then stopped. I need the accession record before I can verify the photo.", "What did the assistant return from the catalog call?", "The trace ends at stop_reason tool_use with tool ID c42. The matching accession is available, but c42 has not been run and its result has not been returned to Claude.", "nolan"),
      interview("tess", "Tess Okafor", "Exhibitions technician", "Two connectors claim to find exhibit material. One of them creates a draft record, which is not what the photo researcher asked for.", "Which records can support the visitor count?", "Saturday has 83 ticket scans. The weekend estimate is 120 attendees. They cover different periods and use different methods, so the label must keep both claims and their sources separate."),
    ],
  },
  "printworks-rules": {
    kind: "printshop", room: "Proofing floor", arrival: "Two proof stations share a checkout shelf. Project instructions, personal preferences, and test-only rules are stored in different places.",
    interviews: [
      interview("riley", "Riley James", "Print shop owner", "The evening shift starts from a fresh checkout. They keep asking me what to name proofs and where to find the release checklist. Can we put both where they’ll have them?", "Which instruction should every shift inherit?", "The naming convention and release checklist are team rules. Riley’s preference for terse explanations is personal and should stay in user scope.", "riley"),
      interview("lee", "Lee Morgan", "Prepress operator", "The paper-size rule should load in two proof test directories, but it keeps showing up while we work on billing code.", "Where do the affected tests live?", "They are in packages/posters/tests and packages/programs/tests. A rule scoped to one path will miss the second package; a root rule will affect billing work."),
    ],
  },
  "kitchen-extract": {
    kind: "kitchen", room: "Receiving counter and ledger station", arrival: "The receiving counter holds three supplier invoices beside the ledger terminal: one clean total, one mismatch, and one unreadable amount.",
    interviews: [
      interview("lina", "Lina Ortiz", "Restaurant owner", "Can you take a look at invoice 303? It passed the JSON check, but the printed total is $10 over what the lines add up to. I need the bookkeeper to see both figures.", "What does the original invoice show?", "The line sum is 10,000 cents and the printed total is 11,000. Both are valid numbers. We need to compare them before the invoice goes into the ledger.", "lina"),
      interview("ana", "Ana Ruiz", "Receiving clerk", "I pulled invoice 304 and another one with a blank total. There’s a mark on 304. I can’t tell what it says, but I can tell the supplier wrote something.", "What should the extractor preserve?", "Keep nullable integer cents, the original field status, and a review reason. Use validator feedback for a legible formatting error; preserve both amounts when source evidence conflicts."),
    ],
  },
  "community-handoff": {
    kind: "community", room: "Room-booking desk", arrival: "A booking request, an eligibility record, and a staff handoff tray sit beside the community center calendar.",
    interviews: [
      interview("malik", "Malik Reed", "Programs coordinator", "One resident asked us to make a room change, but the current session only says they were verified. There is no verification record.", "What must be true before the room changes?", "The service must find a matching, authorized verification record before executing the write. A transcript or saved summary is not that record."),
      interview("sara", "Sara Bell", "Front desk lead", "Ticket 31 explicitly asks for staff. Ticket 32 could refer to either of two rooms with the same nickname.", "What does the desk need for each ticket?", "Give staff ticket 31's request and attempted steps. Ask ticket 32 for a distinguishing room detail before committing a booking."),
    ],
  },
  "archive-coordination": {
    kind: "archive", room: "Research coordination room", arrival: "Map drawers, property registers, and three worker traces are open on the coordinator's table; the report is due today.",
    interviews: [
      interview("reese", "Reese Park", "Reference librarian", "The editor is waiting. We’ve got the full register and maps for three wards. The map worker used its retry and still couldn’t check the other two.", "What can the editor safely publish?", "Return the verified register and map findings, identify the two uncovered wards, and include the retry history. Missing results do not prove that those wards had no records."),
      interview("mina", "Mina Cho", "Map archivist", "The south ward is absent from the register request. The register does not search maps, even where street names overlap.", "How should the remaining research be divided?", "Keep the completed register result and send only the missing south-ward map search to the maps worker. Give each worker its collection boundary and required citation fields."),
    ],
  },
  "release-review": {
    kind: "office", room: "Migration review room", arrival: "The migration branch, previous investigation notes, and failing normalizer fixtures are pinned to a shared review wall.",
    interviews: [
      interview("priya", "Priya Shah", "Engineering lead", "The label change is known and small. The shared identifier migration may reach a second database through a caller nobody has documented.", "Which change needs dependency discovery first?", "Trace the migration callers before editing. Keep the known label edit small, then run a contract pass across the integration boundary."),
      interview("omar", "Omar Wells", "Release engineer", "Two repair approaches must start from the same verified baseline. The session may compact before all callers are checked.", "What must survive the handoff?", "Fork the trials from the verified session, isolate their edits, and preserve inspected paths, findings, rejected theories, and pending checks in the scratchpad."),
    ],
  },
  "repair-shop-tools": {
    kind: "workshop", room: "Service counter and parts bench", arrival: "The counter terminal, shared connector settings, and a clean test checkout are ready for the repair desk review.",
    interviews: [
      interview("sam", "Sam Okafor", "Repair shop owner", "Triage only needs a job status. The supervisor alone should be able to change a repair record.", "What is the smallest useful tool for triage?", "A status-only lookup scoped to the verified caller and job. A read-only prompt does not make a write-capable tool safe."),
      interview("gail", "Gail Turner", "Service technician", "The connector works on my workstation but vanishes from a fresh checkout. My experimental endpoint should remain private.", "What should be shared with the team?", "Track the shared .mcp.json with environment references. Keep the experimental endpoint and secrets in personal or project-local settings."),
    ],
  },
  "printworks-ci": {
    kind: "printshop", room: "Release gate and proof lab", arrival: "The CI console has a retried review commit, the shop's tolerance sheet, and an integration regression from the last proof run.",
    interviews: [
      interview("riley", "Riley James", "Print shop owner", "The review runner sometimes waits forever for a terminal, flags allowed tolerances, and missed a cross-package mismatch.", "Which failures should the review catch?", "The runner needs a bounded, noninteractive invocation, a threshold matched to the tolerance sheet, and an integration pass across changed components." ,"riley"),
      interview("noel", "Noel Park", "Build engineer", "The current output contains two comments for one defect. The label renderer and order formatter also disagree on the same commit.", "What evidence belongs in the report?", "Deduplicate by issue identity and evidence, and report the cross-component contract mismatch. Avoid suppressing every later finding in a file that had an earlier comment."),
    ],
  },
  "market-close": {
    kind: "market", room: "Vendor intake and closing desk", arrival: "The market hall's live counter and archive-import queue share a wall display; closing staff have limited review capacity.",
    interviews: [
      interview("inez", "Inez Vega", "Market manager", "One counter confirmation is due in six seconds. Eight hundred independent archive summaries can finish overnight.", "Which work should stay interactive?", "Keep the six-second confirmation on the live Messages path. Send the independent archive summaries through batch processing, then join results by custom_id and retry only temporary failures."),
      interview("paul", "Paul Kim", "Vendor coordinator", "Several purchase orders share a vendor surname and have different delivery dates. The workspace already has source-linked order IDs.", "How should the dates stay attached to the right orders?", "Store each order-to-date fact with its source ID and load the active order records. Don't carry a date forward from narrative position or a compacted summary."),
    ],
  },
  "dispatch-monday-peak": {
    kind: "dispatch", room: "City Dispatch control room", arrival: "Monday's queue is backed up on the wall board. Retry capacity, support hours, and the escalation desk are all visible.",
    interviews: [
      interview("nia", "Nia Brooks", "Customer support lead", "We can make one safe retry on a temporary read timeout. A valid empty lookup is not an outage.", "Which cases are eligible for the retry?", "Only the temporary failures. Preserve the valid empty result as a completed no-match and keep permission denials out of the retry queue.", "nia"),
      interview("jo", "Jo Rivera", "Operations lead", "The shift has a two-hour follow-up cap. We have a staffed escalation route, but duplicate and ambiguous records need different handling.", "What should the shift protect first?", "Use the evidence-backed retry budget, retain the remaining unresolved cases for staff, and ask for a distinguishing detail when records are ambiguous." ,"jo"),
    ],
  },
  "market-rush": {
    kind: "market", room: "Market hall rush desk", arrival: "The vendor check-in line and batch terminal are both live. The wall clock shows the counter deadline and review queue capacity.",
    interviews: [
      interview("inez", "Inez Vega", "Market manager", "Vendors in front of us need a confirmed pickup date. The overnight file has hundreds of independent records.", "Which work should stay out of the batch queue?", "Answer the live counter through the interactive path and use the batch path for the archive. Keep stable request IDs so out-of-order results remain matched."),
      interview("lia", "Lia Martin", "Produce vendor", "My confirmed delivery date is in the signed docket. A draft note from last week has a different date.", "Which source should remain active?", "Use the signed docket as the active claim, keep its source, and mark the old draft as superseded rather than blending the dates."),
    ],
  },
  "market-bulletin": {
    kind: "market", room: "Market hall notice board", arrival: "A draft bulletin, vendor form, approval stamp, and two send lists are waiting at the market manager's desk.",
    interviews: [
      interview("inez", "Inez Vega", "Market manager", "The public hours have changed. Vendors need the approved information, but I still sign off before anything is sent.", "What can the draft use as its source?", "Use the current signed hours sheet and preserve the approval step. A message from last season is not current evidence."),
      interview("marta", "Marta Singh", "Vendor liaison", "The staff copy and the vendor copy serve different readers. Last month's send list still includes three former vendors.", "What needs checking before distribution?", "Use the staff-facing instructions for internal work, write the vendor version for the public, and compare the recipient list with the current vendor roster."),
    ],
  },
  "library-desk": {
    kind: "archive", room: "Shared reference desk", arrival: "Four librarians' approved FAQ, changing glossary, access policy, and connector console are grouped at the service desk.",
    interviews: [
      interview("reese", "Reese Park", "Reference librarian", "New chats need the same answer rules and current glossary. We cannot depend on one librarian's old conversation.", "Where should each kind of reference live?", "Keep durable answer behavior in shared project instructions, the changing glossary in knowledge, and individual visitor context in its own case.") ,
      interview("tess", "Tess Okafor", "Collections technician", "The public programs folder sits beside restricted circulation records. A retired cancellation policy still appears in search.", "How can we verify the answer is in scope and current?", "Limit connector access to approved program data, remove the retired policy from active knowledge, and test a fresh question against the current rule."),
    ],
  },
  "school-notice-pilot": {
    kind: "school", room: "Front office and family notice station", arrival: "The school bulletin, a draft notice, an enrollment form, and the pilot's review ledger are open at the front desk.",
    interviews: [
      interview("jordan", "Jordan Chen", "School administrator", "The warmer draft dropped the missing-document list. The new hours survey only reached weekday families.", "Which claim is safe to publish?", "Keep the verified document list and limit the preference claim to weekday respondents until weekend families are represented.", "jordan"),
      interview("elena", "Elena Brooks", "Family liaison", "Incomplete dates cause the most rework. Review takes longer when families have to correct a missing field after submission.", "What should the pilot measure?", "Measure date completeness against the same referral rule, then report net staff time after the additional review and include the two corrections."),
    ],
  },
  "library-activity-kit": {
    kind: "archive", room: "Children's program preparation room", arrival: "Approved program minutes, future proposals, the catalog import, and editable activity-kit drafts are arranged on one worktable.",
    interviews: [
      interview("reese", "Reese Park", "Reference librarian", "We need creative ideas for the summer program and a separate list of decisions the board actually approved.", "How should proposals and approvals be handled?", "Brainstorm within the program constraints, but extract approvals only from the signed minutes. Keep proposals clearly separate.") ,
      interview("maya", "Maya Lewis", "Youth librarian", "Staff revise the activity kit by hand. The catalog loader expects a structured array of program IDs.", "What does each team need to receive?", "Give librarians an editable kit and the loader a structured ID array. Carry verified dates and source IDs into a fresh handoff chat."),
    ],
  },
  "kitchen-billing-audit": {
    kind: "kitchen", room: "Bookkeeping table", arrival: "Two equivalent supplier exports and the correction log sit beside a weekly summary draft; refunded amounts changed format in the latest file.",
    interviews: [
      interview("lina", "Lina Ortiz", "Restaurant owner", "Refunds used to be negative. In this export they are positive amounts marked with type R.", "What changed in the source data?", "The sign and type representation changed while the pinned model and prompt stayed the same. Compare matched rows before changing either.", "lina"),
      interview("arturo", "Arturo Silva", "Bookkeeper", "Nine reviewed drafts cite one refund rule that has been withdrawn. Staff also retype six stable instructions each shift.", "What should be fixed and measured?", "Replace the stale rule, rerun affected cases, and measure omissions and review time with a shared versioned template."),
    ],
  },
  "community-policy": {
    kind: "community", room: "Application and referral office", arrival: "The application queue, written eligibility policy, connector request, and fairness review sheet are open in the center's private office.",
    interviews: [
      interview("malik", "Malik Reed", "Programs coordinator", "Staff must choose every limited training award and record their reasons. The assistant can help organize evidence.", "Which decision must stay with staff?", "Use Claude to extract cited evidence for staff review. Do not rank, select, or break ties for the training awards.") ,
      interview("nina", "Nina Patel", "Privacy and access lead", "We can process redacted topic excerpts. The mailbox connector belongs to another program and has not been approved for this purpose.", "What must happen before using the connector?", "Redact addresses and medical details locally, obtain approval for this mailbox and purpose, then check routing errors by writing style."),
    ],
  },
  "permit-agent": {
    kind: "courthouse", room: "Permit intake counter", arrival: "The permit intake checklist, identity lookup trace, and case-specific work queue are open at the courthouse service counter.",
    interviews: [
      interview("darius", "Darius Wells", "Permit clerk", "Every application needs address and eligibility checks in that order before an acknowledgment is drafted.", "Which work can the assistant decide on its own?", "Keep the required checks deterministic and ordered. Claude can draft only after both succeed, within the two-second acknowledgment target.") ,
      interview("imani", "Imani Cole", "Application engineer", "Two lookups returned tool_use in one assistant turn, and the shared console may contain another applicant's history.", "What should the next turn receive?", "Append the assistant turn and both tool results under their matching IDs. Resume history only by a verified, authorized case ID."),
    ],
  },
  "printworks-stream": {
    kind: "printshop", room: "Proof console test bench", arrival: "The provider event stream, authenticated browser socket, and failing proof preview are open side by side.",
    interviews: [
      interview("riley", "Riley James", "Print shop owner", "The SDK receives the full response. The browser loses a field only when an event is split across chunks.", "Where should we reproduce the failure?", "Replay fragmented events through the client decoder. Raising the model output limit or rewriting the prompt won't repair a transport boundary." ,"riley"),
      interview("noel", "Noel Park", "Frontend engineer", "The provider SDK runs on the backend. The browser already has an authenticated WebSocket session.", "What should cross the browser boundary?", "Translate authorized SDK events to WebSocket events without exposing provider credentials. Keep the proof-test rule scoped to the two test paths."),
    ],
  },
  "vendor-batch-api": {
    kind: "market", room: "Live orders counter and batch terminal", arrival: "The live vendor counter is open beside a queue of archive records. Batch responses are arriving out of order.",
    interviews: [
      interview("inez", "Inez Vega", "Market manager", "Counter acknowledgments are due in six seconds. The historical archive can finish overnight.", "How should these two queues run?", "Use the interactive Messages path for live acknowledgments and the batch service for independent archive records. Don't put the counter behind bulk work."),
      interview("dev", "Dev Shah", "Integration engineer", "Completed rows must survive a retry. A vendor ID that is unreadable is not the same thing as an ID that was left blank.", "How do we keep results attached to the right records?", "Correlate by custom_id, upsert successful rows, retry only eligible failures, and use paired blank/unreadable extraction examples."),
    ],
  },
  "library-workers": {
    kind: "archive", room: "Catalog research and connector lab", arrival: "Worker packets, an addressable policy document, a scoped catalog lookup, and the editor's handoff are pinned to the library worktable.",
    interviews: [
      interview("reese", "Reese Park", "Reference librarian", "Each worker searches one collection. I need cited findings and the gaps, not a wall of raw worker logs.", "What belongs in each worker packet?", "Give each worker a collection boundary, required accession and citation fields, then return compact sourced claims and missing coverage to the editor."),
      interview("ben", "Ben Carter", "MCP administrator", "The policy can be fetched directly by URI. The catalog search needs to accept a live query from the model.", "Which interfaces serve each job?", "Expose the policy as a resource and the parameterized lookup as a tool. Package the repeatable workflow as a Skill and keep live data behind authorized MCP access."),
    ],
  },
  "repair-desk-safety": {
    kind: "workshop", room: "Parts intake and tool-permission bench", arrival: "Supplier documents, a staging connector, production permissions, and a pre-action trace are open on Sam's repair bench.",
    interviews: [
      interview("sam", "Sam Okafor", "Repair shop owner", "The parts lookup can be read-only. Changes to a customer job require supervisor authority.", "What can the assistant say about an uploaded supplier form?", "Treat document text as untrusted data, keep the write boundary in the service, and block an unauthorized action before it executes."),
      interview("gail", "Gail Turner", "Service technician", "A safe staging check should run before the shared write. Production and staging secrets cannot travel in project files.", "Where should each control and credential live?", "Place the policy at the pre-action hook, separate environment credentials, and preserve the tool result when the supplier search succeeds."),
    ],
  },
  "developer-release": {
    kind: "office", room: "Application release room", arrival: "The staged prompt, replay configuration, model comparison sheet, and routing budget are pinned to the release board.",
    interviews: [
      interview("priya", "Priya Shah", "Engineering lead", "A small prompt edit is ready, but the release review needs to reproduce the exact tested setup.", "What must be captured with the change?", "Version the prompt, model, parameters, fixtures, and evaluation result together so the comparison can be replayed.") ,
      interview("simon", "Simon Wu", "Platform engineer", "The default model exceeds the routine ticket budget. Flagged ambiguous cases need more capability and a reviewer.", "What should the routing decision use?", "Use the measured ambiguity signal and cost limits to route routine and exceptional work separately; don't choose by model name alone."),
    ],
  },
  "public-permit-discovery": {
    kind: "courthouse", room: "Permit service planning room", arrival: "The intake desk's process map, service-level target, cost sheet, and owner interview notes are ready for a pilot design.",
    interviews: [
      interview("darius", "Darius Wells", "Permit clerk", "Most applicants ask for the same status. Exceptions require a licensed reviewer and a source citation.", "Which part of the process is safe to test first?", "Start with the repeated status lookup, preserve the licensed review boundary, and measure successful resolutions against the actual service target."),
      interview("mae", "Mae Thompson", "Permit services manager", "The written workflow does not match how staff route incomplete applications. I can show you where they wait.", "What do you need from process owners?", "Interview the people who own intake and review, verify the wait points, and brief the sponsor with measured baseline and exception volume."),
    ],
  },
  "library-retrieval-architecture": {
    kind: "archive", room: "Archive search engineering room", arrival: "Search traces, archive identifiers, active revisions, and the retrieval index are displayed around the digitization workstation.",
    interviews: [
      interview("nolan", "Nolan Price", "Archivist", "Exact accession IDs are often reliable, but descriptive questions need the full procedure around a reference.", "Which retrieval stages are costing us most?", "Join stage traces before tuning. Index complete procedures, keep exact identifiers available, and retrieve relevant text for descriptive queries.", "nolan"),
      interview("mei", "Mei Chen", "Search engineer", "A stale revision remains in one collection. The index entry and source document disagree about which version is active.", "How should we prove a stale citation was removed?", "Trace the revision metadata through retrieval and response, then test the active claim against both identifier and paraphrase cases."),
    ],
  },
  "professional-eval-gate": {
    kind: "office", room: "Evaluation and rollout room", arrival: "The pilot dashboard, human review queue, canary controls, and input-format fixtures are loaded for a release decision.",
    interviews: [
      interview("priya", "Priya Shah", "Engineering lead", "The current score combines latency, customer corrections, and disputed closures. One blended score hides safety failures.", "Which signals belong on the release gate?", "Keep operational metrics separate and choose a grading method that matches each outcome. Set canary limits before promotion.") ,
      interview("frank", "Frank Okafor", "Quality lead", "The new supplier form changes the input shape. Short messages also receive more wrong refusals despite having the same facts.", "Which tests must the gate add?", "Add the new format as a separate fixture, and compare quality across writing styles before widening the canary."),
    ],
  },
  "market-scale": {
    kind: "market", room: "Market platform and cost-control room", arrival: "Model candidates, approved instructions, retrieval results, and spend traces are open beside the vendor operations dashboard.",
    interviews: [
      interview("inez", "Inez Vega", "Market manager", "The system meets the response target only if quality, access, and spend remain inside the signed limits.", "Which candidate is within all three limits?", "Compare end-to-end results, not the headline model tier. The waived-field rule is explicit and cannot be inferred from a missing value."),
      interview("cal", "Cal Nguyen", "Platform analyst", "Only the current vendor claim should be retrieved. Approved instructions repeat across requests; the latest spend spike began with a deployment change.", "Where should we look first?", "Retrieve the active claim with its source, reuse the approved stable prefix, and compare the spend trace to the prior deployment."),
    ],
  },
  "tenant-tools": {
    kind: "workshop", room: "Tenant integration and access lab", arrival: "The repair queue, identity claims, service connector catalog, and capability discovery trace are open at the security bench.",
    interviews: [
      interview("sam", "Sam Okafor", "Repair shop owner", "Each customer should see their own repair status. The caller cannot choose another tenant by changing a request field.", "Where should tenant scope come from?", "Derive it from the verified identity on the server, then expose only the lookup capability needed for that customer."),
      interview("gail", "Gail Turner", "Integration engineer", "One static tool list is too broad. Partners need to discover the connector capabilities they are authorized to use.", "What should the integration share?", "Keep suitable, narrowly scoped tools and discover capabilities when needed. Do not copy a broad connector or customer record set into every client."),
    ],
  },
  "community-controls": {
    kind: "community", room: "Privacy, approval, and service-control office", arrival: "The written policy, evidence store, production approval form, retention clock, and outage queue are visible to the center's review team.",
    interviews: [
      interview("malik", "Malik Reed", "Programs coordinator", "Policy decides which action is allowed. Resident evidence decides whether a particular case meets that policy.", "What must happen before an assistant writes?", "Keep policy separate from case facts, obtain the binding approval for this deployment, and enforce review before the write reaches the service."),
      interview("nina", "Nina Patel", "Privacy and access lead", "A timeout must not look like a successful empty search. Records also have a retention period that applies to every copy.", "Which boundaries should the pilot test?", "Distinguish unavailable from no match, record the approved scope, and enforce retention across source, prompt, log, and derived output."),
    ],
  },
  "regional-operations": {
    kind: "office", room: "Service handoff and incident room", arrival: "The outage queue, scoped worker packets, deployed version record, review dashboard, and manual-routing card are laid out for operations.",
    interviews: [
      interview("priya", "Priya Shah", "Engineering lead", "I am leaving the deployment. The incoming team has ten minutes to route work manually if the service goes down.", "What must the handoff contain?", "Give scoped claims, source IDs, unresolved conflicts, the deployed data flow, control versions, owners, and the tested manual outage route."),
      interview("devon", "Devon Hill", "Incoming operations lead", "I need to know who owns the queue, how failed stages recover, and how denied writes changed from the previous release.", "What evidence helps us take responsibility?", "Show checkpointed failure paths, named on-call ownership, an integration review with issue evidence, and the authorization trace across releases."),
    ],
  },
  "enrollment-replies": {
    kind: "school", room: "Front office reply station", arrival: "Three family messages, the current enrollment bulletin, last year's sample, and the exception policy are open at the front desk.",
    interviews: [
      interview("jordan", "Jordan Chen", "School administrator", "Three families are waiting. The sample from last year is still in the reply folder, but the current bulletin has changed.", "Which dates are confirmed today?", "The current bulletin says enrollment closes May 24. The repair reopening date is still pending; the old May 19 sample is not current.", "jordan"),
      interview("felicia", "Felicia Grant", "Enrollment lead", "I handle late applications. The assistant can prepare the facts, but it cannot decide an exception.", "What must be handed to me?", "Send the family's request and the relevant policy to the enrollment lead. Staff can draft the two routine messages from confirmed bulletin facts."),
    ],
  },
  "supplier-invoices": {
    kind: "kitchen", room: "Supplier invoice receiving desk", arrival: "Invoices 302, 303, and 304 sit beside the ledger with their original line items and source totals intact.",
    interviews: [
      interview("lina", "Lina Ortiz", "Restaurant owner", "One invoice agrees with its line items, one does not, and one has a printed total nobody can read.", "What should the ledger never lose?", "The supplier's original claim, the calculated line sum, and whether the printed amount was unreadable. Do not silently replace one with another.", "lina"),
      interview("arturo", "Arturo Silva", "Bookkeeper", "Invoice 303 is valid JSON. Its printed total still disagrees with the line sum, and the ledger requires a review reason.", "Which check is separate from the schema?", "Validate numeric cents and required fields in the schema, then compare the printed total with the trusted line sum in application logic."),
    ],
  },
  "support-pilot": {
    kind: "office", room: "Support pilot review room", arrival: "Two model candidates, the disputed-ticket policy, latency traces, and per-resolution cost figures are ready for the rollout decision.",
    interviews: [
      interview("priya", "Priya Shah", "Engineering lead", "Candidate B is more capable, but the service still has a strict latency target and cost ceiling.", "What qualifies a candidate for this pilot?", "The selected candidate must satisfy both measured limits. A single good accuracy score cannot override a failed operational gate.", "priya"),
      interview("deshawn", "DeShawn Price", "Support manager", "Forty test tickets are disputed. Our team must decide every one before closure, not audit the decisions afterward.", "What is the safe dispute control?", "Route all disputed tickets to staff before closure, then evaluate the full replay against latency, cost, and dispute requirements."),
    ],
  },
};

export function experienceFor(mission: Pick<Mission, "id">) {
  return missionExperiences[mission.id];
}
