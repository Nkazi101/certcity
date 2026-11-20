import type { TrackId } from "./blueprints";
import { banks } from "./practice";
import { decision, workbench } from "./missions";
import type { Decision, Mission } from "./missions";
import { replayPilotGate, replaySchoolPilot, replayVendorImport } from "./workload";

type Job = {
  id: string; place: Mission["place"]; title: string; brief: string; specialist: string;
  requires?: string[]; simulate?: Mission["simulate"]; stations: readonly [Decision["objective"], string, string, string, string, string, string, string, string][];
};

function jobs(track: TrackId, entries: readonly Job[]) {
  return entries.map(({ stations, ...job }) => workbench({
    ...job, track, workload: job.simulate?.({}).name ?? `${stations.length} acceptance cases`, measure: "Cases meeting the job’s requirements",
  }, stations.map(([objective, station, evidence, current, before, proposal, after, alternative, consequence]) => {
    const item = banks[track].practice.find((item) => item.objective === objective)!;
    return decision(objective, item.id, station, evidence, [current, before], [proposal, after], [alternative, consequence]);
  })));
}

export const associateMissions = jobs("associate-foundations", [
  {
    id: "market-bulletin", place: "market-hall", title: "Publish the vendor bulletin", brief: "Vendor updates mix confirmed hours with proposals. Inez needs a reliable Friday bulletin.",
    specialist: "Compare the stall forms, the manager’s approval log, and last week’s draft.",
    stations: [
      ["1.1", "Set the writing brief", "Vendors need a short notice with confirmed hours. Two forms lack approved hours.", "Summarize all submitted changes", "Unapproved hours appear as confirmed.", "Specify audience, length, approved sources, and pending fields", "Vendors see confirmed hours and two pending entries.", "Match last week’s bulletin exactly", "Old hours carry forward."],
      ["1.2", "Sequence the work", "The draft should incorporate twenty forms and link each proposed change to its original form.", "Draft in one pass", "Three changes cannot be traced.", "Extract with form IDs, compare with approvals, then draft", "All included changes retain their source.", "Write the notice first and gather supporting forms later", "One omitted change stays invisible."],
      ["2.1", "Check the send list", "All notices need both opening time and delivery cutoff. One draft omits the cutoff.", "Read the first paragraph", "The incomplete notice is approved.", "Check both required fields against the schedule", "The missing cutoff is caught before sending.", "Accept any notice with a schedule link", "The link does not fix the omission."],
      ["2.5", "Write for staff and vendors", "Staff need the change procedure. Vendors need the effective date and their arrival time.", "Send the procedure to everyone", "Vendors miss the arrival time in staff steps.", "Reuse verified facts and adapt detail to each audience", "Both groups get the same dates in the right form.", "Ask for unrelated rewrites", "One rewrite changes the date."],
      ["4.4", "Keep the approval step", "Only Inez can publish a change to operating hours.", "Allow automatic publishing for routine changes", "A change bypasses the manager.", "Draft from forms, require approval, record corrections and staff time", "Approvals are preserved and net staff effort is measurable.", "Track generation speed only", "Extra review time remains invisible."],
    ],
  },
  {
    id: "library-desk", place: "library", title: "Set up a shared reference desk", brief: "Four librarians draft independently but need the same policy and style.",
    specialist: "Reese has an approved FAQ, a changing glossary, a restricted folder and a separate events service.",
    stations: [
      ["3.1", "Choose a shared workspace", "Librarians work in separate chats and need the same approved sources.", "Attach the FAQ to the first chat", "New chats lack the FAQ.", "Use one shared Project with instructions and knowledge", "Separate chats share approved reference material.", "Put all resident cases in one continuing chat", "Unrelated case histories intermingle."],
      ["5.1", "Set up policy and behavior", "The glossary changes monthly. Replies always need an access contact.", "Put both in one past response", "A fresh chat has neither rule nor glossary.", "Put the glossary in knowledge and the reply rule in project instructions", "Both are available in the next chat.", "Upload last month’s email as a template", "It carries stale source material."],
      ["5.2", "Scope the connector", "The public program folder sits beside restricted circulation records.", "Connect a broad account", "Restricted records can enter the workflow.", "Verify connector access covers only approved program data", "The program test retrieves the current FAQ within scope.", "Filter citations after retrieval", "Restricted content may already have been retrieved."],
      ["5.3", "Share a repeatable answer rule", "Replies must cite current terms and route missing evidence to the desk.", "Keep the rules in staff notes", "New staff omit the referral language.", "Set durable project instructions and test a fresh chat", "The new chat follows the same referral pattern.", "Put instructions only in the glossary filename", "The rule is too incidental to apply consistently."],
      ["5.4", "Replace a retired policy", "The knowledge base still contains last season’s cancellation PDF.", "Keep both and ask for the latest", "The retired PDF still answers some queries.", "Remove the retired policy from active knowledge and test a changed rule", "The test resolves the rule from the current policy.", "Start another chat with the same corpus", "The conflicting sources remain."],
    ],
  },
  {
    id: "school-notice-pilot", place: "school", title: "Fix the school’s notice workflow", brief: "Families are getting inconsistent answers. Jordan wants a pilot with evidence of saved work.",
    specialist: "The office can adjust its template and forms. Published policy and sign-off requirements stay fixed.", requires: ["enrollment-replies", "market-bulletin"], simulate: replaySchoolPilot,
    stations: [
      ["1.3", "Revise the tone", "A warmer draft dropped the verified missing-document list.", "Ask for a friendlier rewrite", "The list disappears again.", "Show a neutral example and require the verified list to remain", "Tone changes and the checklist survives.", "Replace the prompt with a friendly example", "The example’s facts are reused by mistake."],
      ["2.2", "Interpret feedback", "Thirty responses came from weekday-only families. The draft claims all families prefer the new hours.", "Publish the summary as written", "Weekend families are misrepresented.", "Limit the claim to weekday respondents and ask for weekend evidence", "The summary reflects the observed group.", "Estimate weekend preferences from past conversations", "The estimate is unsupported."],
      ["4.1", "Choose a pilot target", "Most rework comes from incomplete dates. Approval timing is fixed this term.", "Automate approval", "The workflow violates policy and misses the cause.", "Measure omitted dates and test earlier completeness checks", "The pilot targets the actual rework.", "Measure chat volume", "The cause of rework is still unknown."],
      ["4.3", "Test the form and the draft", "The current form allows empty dates. The referral rule must remain.", "Ask Claude to infer missing dates", "Families receive invented deadlines.", "Require dates in the form and compare draft omissions with baseline", "The pilot measures improvement under the same referral rule.", "Redesign referral first", "The team changes a control outside its scope."],
      ["4.5", "Report the trial", "Drafting fell from 12 to 5 minutes. Review rose from 2 to 6. Staff corrected two of 30 replies.", "Report seven minutes saved", "The sponsor misses four extra minutes of review.", "Report three minutes net saved and the two corrections", "The board sees net effort and remaining review need.", "Report model speed alone", "The report cannot explain actual staff impact."],
    ],
  },
  {
    id: "library-activity-kit", place: "library", title: "Build an activity kit for the library", brief: "Staff want a reusable kit for programs and a reliable way to carry confirmed information across teams.",
    specialist: "Use separate source records for approved programs, future proposals and machine imports.", requires: ["library-desk"],
    stations: [
      ["1.4", "Separate ideas from decisions", "Summer event ideas are open-ended. An approvals brief must stick to the signed minutes.", "Use one creative prompt for both", "The draft presents a proposal as approved.", "Brainstorm against constraints and extract approvals from minutes", "The idea list can vary and the approvals stay grounded.", "Require proof from minutes for every new idea", "Creative exploration is unnecessarily restricted."],
      ["2.6", "Deliver an editable kit and an import", "Staff revise the kit by hand. A catalog loader expects an array of program IDs.", "Send both as prose", "The loader cannot reliably parse IDs.", "Use an editable Artifact and a structured ID array", "Staff can revise the kit and the loader accepts the ID list.", "Send screenshots of both", "Neither editing nor import is practical."],
      ["3.2", "Choose model trial candidates", "Simple tagging is high volume. Reconciliation of conflicting archival notes is infrequent and demanding.", "Use the same capability tier for both without testing", "The trial gives no evidence on the different workloads.", "Benchmark a speed-oriented model for tagging and a higher-capability model for reconciliation", "Staff compare quality and operating cost for each workload.", "Use a higher-capability model only for tagging", "The budget goes to the easier workload."],
      ["3.4", "Start the handoff chat", "The current chat has verified dates and unrelated brainstorming for another program.", "Continue in the same chat", "The next draft reuses an unrelated program idea.", "Start fresh with the verified dates and relevant source IDs", "The next team retains the facts without stale proposals.", "Start fresh without a brief", "Confirmed dates are unavailable."],
    ],
  },
  {
    id: "kitchen-billing-audit", place: "restaurant", title: "Recover the weekly billing summary", brief: "Refunds disappeared after a vendor export changed. Lina also needs a cheaper and repeatable review process.",
    specialist: "Use equivalent rows from both exports and the bookkeeping correction log.", requires: ["market-bulletin"],
    stations: [
      ["3.3", "Route routine and ambiguous records", "A cheaper model meets the target on routine mail. The tested ambiguity signal catches unusual messages.", "Use the highest-cost model for every record", "Routine work exceeds budget.", "Use the cheaper routine model and route flagged cases to staff", "Routine cost stays low and unusual cases receive review.", "Use the cheapest model and trust its category", "Ambiguous records are silently misclassified."],
      ["7.1", "Trace the missing refunds", "Refunds changed from negative amounts to positive values with type R.", "Switch models first", "The source change remains untested.", "Compare matched rows with the model and prompt pinned", "The mismatch is isolated to the new type field.", "Ask for a longer summary", "Refund handling does not change."],
      ["7.2", "Prioritize corrections", "Nine reviewed drafts cite one withdrawn refund rule. Three edits are unrelated wording changes.", "Tweak wording first", "Nine policy errors remain.", "Replace the rule and rerun affected cases", "The repeated error is tested directly.", "Append every review note", "Unrelated edits obscure the outdated source."],
      ["7.3", "Reduce omissions between shifts", "Staff retype six stable instructions for each new summary.", "Give staff a longer input box", "The instructions are still copied by hand.", "Version a shared template and measure omissions and review time", "Shifts use the same requirements and compare workload.", "Combine every case into one conversation", "Old case details leak into new summaries."],
    ],
  },
  {
    id: "community-policy", place: "community", title: "Protect applicants while reducing queue time", brief: "Malik wants help organizing applications and improving a slow referral process.",
    specialist: "The written rules require human award decisions, local redaction, and approval before connecting the mailbox.", requires: ["school-notice-pilot", "library-activity-kit"],
    stations: [
      ["4.2", "Find where cases wait", "Complete requests take a day. Forms missing dates take twice as long. Drafting is ten minutes.", "Optimize drafting speed only", "The dominant delay stays in place.", "Compare stage times for complete and incomplete cases", "The team identifies the missing-date bottleneck.", "Remove waiting from the metric", "The report hides the participant experience."],
      ["6.1", "Choose a role for Claude", "Staff must decide each limited training slot and record reasons.", "Automatically rank and award clear cases", "Staff authority is bypassed.", "Extract cited evidence for staff scoring", "Staff retain the decision and verify its evidence.", "Use an anonymous model ranking to break ties", "Model ranking still decides some awards."],
      ["6.2", "Reduce data before upload", "The approved workspace allows topic themes and excludes addresses and medical details.", "Upload raw cases and request aggregate output", "Excluded inputs enter the workspace.", "Redact locally and send only topic-bearing excerpts", "The review can proceed within the input policy.", "Replace names but keep addresses", "The stated exclusion is still violated."],
      ["6.3", "Approve connector access", "Another team’s existing connector can technically see this mailbox. Written approval is required for this purpose.", "Use the other team’s approval", "The new mailbox scope lacks authorization.", "Get approval for this mailbox and purpose before connecting", "The designated owner can verify scope and handling.", "Connect for the trial and seek approval later", "Access precedes required approval."],
      ["6.4", "Check uneven treatment", "Short requests are disproportionately labeled uncooperative, even with the same facts.", "Keep the label internally", "The label still affects routing.", "Use service facts and compare errors by writing style", "Staff can detect and correct uneven routing.", "Remove short requests from the test", "The affected group disappears from the evidence."],
    ],
  },
]);

export const developerMissions = jobs("developer-foundations", [
  {
    id: "permit-agent", place: "old-courthouse", title: "Wire the permit intake agent", brief: "Acknowledgments sometimes go out before verification and tool results never reach the final turn.",
    specialist: "The clerk saved one fixed-rule intake and a trace with two independent lookups.",
    stations: [
      ["1.1", "Choose the intake flow", "Every application must pass address and eligibility validation, in that order, before drafting.", "Let an agent choose which checks to run", "An incomplete case skips eligibility.", "Run both fixed checks in code, then call Claude for the acknowledgment", "Every emitted draft follows the same validation path.", "Run the draft and both checks concurrently", "A draft is emitted before eligibility is known."],
      ["1.2", "Continue after the lookup", "The assistant emitted two tool_use calls and a preamble. Neither result is in history.", "Send the preamble as the final response", "The applicant sees no result.", "Append the assistant turn and both linked tool_result blocks", "Both results reach the next model turn.", "Append both results under one call ID", "One request remains unmatched."],
      ["2.1", "Translate the service requirements", "Intake needs an acknowledgment within two seconds. Reconciliation may run overnight. Posting requires verification.", "Require all work inside two seconds", "The overnight workload competes with intake.", "Separate acknowledgment and reconciliation, and gate posting", "The system has separate deadlines and a testable posting rule.", "Measure average provider latency", "Posting and tail latency remain untested."],
      ["2.5", "Resume the right case", "Two clerks share a console. Case history may contain a different customer’s notes.", "Use one transcript per clerk", "A different applicant’s notes reappear on resume.", "Load authorized history by verified case ID", "The resumed turn only receives its own history.", "Trust an unverified browser case number", "A user can select a case outside their access."],
    ],
  },
  {
    id: "printworks-stream", place: "washington-printworks", title: "Repair the live proof console", brief: "Long proof responses arrive in the SDK but the browser drops parts of them.",
    specialist: "Riley captured a complete provider message and the browser’s fragmented event stream.",
    stations: [
      ["4.1", "Isolate the failing layer", "The SDK holds the entire response. The UI truncates only when a chunk boundary bisects an event.", "Raise the model output limit", "The same browser boundary still loses a field.", "Replay fragmented events through the client decoder", "The test reproduces the failure without changing the model.", "Reorder fields in the prompt", "A different field is truncated."],
      ["5.2", "Bridge the transport", "The browser has an authenticated WebSocket. The provider SDK runs on the backend.", "Expose the provider credential to the browser", "The browser receives an application secret.", "Translate backend SDK events into authorized WebSocket events", "The UI receives progressive text under its existing session.", "Buffer the entire message before sending it", "The live display becomes static until the request completes."],
      ["3.1", "Share proof-test rules", "The instructions only apply to files under tests/proof in two packages.", "Put instructions in every developer’s personal profile", "The rule does not travel with the repo.", "Commit a path-scoped project rule", "The proof tests get it without adding it to unrelated contexts.", "Add a global heading named Proof", "The rule still loads across the project."],
    ],
  },
  {
    id: "vendor-batch-api", place: "market-hall", title: "Separate live orders and the archive import", brief: "The vendor archive delays urgent confirmations, and retries are creating duplicate imports.",
    specialist: "Inez has an interactive service deadline, a queued archive, and out-of-order batch results.", requires: ["supplier-invoices", "permit-agent"], simulate: replayVendorImport,
    stations: [
      ["2.3", "Choose a delivery mode for each queue", "Live acknowledgments are needed in six seconds. Archived rows are independent and can finish overnight.", "Batch both together", "The counter cannot rely on the six-second target.", "Use live Messages for the counter and Message Batches for the archive", "The two queues follow their own latency requirements.", "Process the archive synchronously ahead of the counter", "The counter waits behind bulk work."],
      ["2.4", "Make import retries idempotent", "Batch results can return in any order. Successful rows should survive retries.", "Append all results by return order", "Rows are misassigned and duplicates appear.", "Join by custom_id, upsert successes, retry eligible failures only", "The replay correlates each result and preserves completed rows.", "Retry the full batch without stable IDs", "Completed records are imported twice."],
      ["5.4", "Put stable content before the cache breakpoint", "A qualifying handbook repeats. A changing vendor ID currently comes first.", "Cache the whole request", "Per-vendor prefixes do not match.", "Cache stable instructions and handbook before appending vendor data", "The common prefix can be reused.", "Cache the final answer by handbook version", "One vendor can receive another vendor’s answer."],
      ["6.2", "Repair ambiguous fields with examples", "The model confuses an unreadable vendor ID and a blank vendor ID.", "Use two clean IDs", "The boundary still fails.", "Supply matched blank and unreadable examples with expected output", "The fixture retains both statuses.", "Ask for more confident extraction", "The ambiguity remains unspecified."],
    ],
  },
  {
    id: "library-workers", place: "library", title: "Scope workers and their catalog connectors", brief: "The writer is swamped by raw worker logs and each client implements the same catalog integration differently.",
    specialist: "Reese can show access boundaries, an addressable reference document and a callable catalog search.", requires: ["permit-agent"],
    stations: [
      ["1.3", "Set worker context and handoff", "Workers search separate collections. The editor needs cited findings and missing coverage.", "Append all raw logs to the editor’s context", "Useful findings get buried.", "Isolate each collection and return compact cited findings with gaps", "The editor has the evidence needed for synthesis.", "Send only a confidence number", "The editor cannot tell which claims were verified."],
      ["6.1", "Project durable context", "The editor needs only accession, status and latest verification time for each case.", "Repeat the full transcript every turn", "Older entries keep competing with current facts.", "Carry verified fields and source references, retain raw logs elsewhere", "Relevant state remains compact and auditable.", "Drop history entirely", "The next turn loses confirmed details."],
      ["8.2", "Expose catalog primitives", "One policy must be fetched by URI. The model invokes a parameterized live lookup.", "Package both as prompts", "The client has neither required direct read nor a model-callable lookup.", "Expose the policy as a resource and the search as a tool", "Each consumer gets the required interface.", "Expose every search query as a fixed resource", "Dynamic requests cannot use the required tool interface."],
      ["8.3", "Package procedures and live data", "Staff need a shared workflow and authorized live lookups across three clients.", "Put the lookup results into a static checklist", "Results become stale.", "Share the procedure as a Skill and the lookup as an authenticated MCP tool", "Clients reuse the procedure and obtain current scoped data.", "Copy a service secret into each client’s instructions", "Credentials are distributed and the procedure still drifts."],
    ],
  },
  {
    id: "repair-desk-safety", place: "shop", title: "Keep repair tools inside their authority", brief: "A draft assistant can post changes, and an offline supplier is shown as out of stock.",
    specialist: "Sam provides permission rules, staging and production keys, and an MCP trace.", requires: ["permit-agent"],
    stations: [
      ["7.1", "Handle supplier documents as data", "Third-party PDFs provide facts. Only signed-in staff can approve a send.", "Allow document instructions to direct sends", "Untrusted content influences a write.", "Label source text as untrusted and enforce staff authorization at send", "The document informs the draft without controlling release.", "Log unauthorized sends after the fact", "The write still occurs."],
      ["7.2", "Protect the shared write path", "The staff UI and a scheduled process use the same cancellation endpoint.", "Apply approval only in the staff UI", "The scheduler bypasses the rule.", "Require matching approval at the endpoint and use draft-only permissions upstream", "Both caller paths share the write gate.", "Audit cancellations nightly", "Unapproved cancellations still occur."],
      ["7.3", "Place a pre-action hook", "Build cleanup must stay inside the chosen project after resolving filesystem paths.", "Inspect only the result of deletion", "The wrong file can already be gone.", "Validate the resolved target in PreToolUse and in the tool", "Out-of-scope cleanup is blocked before execution.", "Check the raw path prefix", "The apparent path and resolved path can differ."],
      ["7.4", "Separate environment credentials", "Staging should be independently revocable and users authenticate through the app.", "Embed one provider key in all browsers", "The key is exposed and revocation affects every environment.", "Use distinct server-held keys and authorize user actions separately", "The team can revoke staging without breaking production.", "Use one provider key and log environment tags", "Logs provide no revocation boundary."],
      ["8.1", "Return the supplier lookup result", "One supplier search completes empty; another reaches the tool but its upstream is offline.", "Return empty success for both", "Staff report unavailable stock as known absent.", "Return empty success and a separate structured retryable error", "The client can distinguish absence from uncertainty.", "Return an unknown-tool protocol error for both", "The caller loses the successful empty result."],
    ],
  },
  {
    id: "developer-release", place: "office", title: "Release a safer application configuration", brief: "The new model route passed one hand-picked run. Staff need a credible release gate and prompt rollback.",
    specialist: "Priya has labeled requests, two prompt revisions, and separate cost and quality data for routine and ambiguous inputs.", requires: ["printworks-stream", "vendor-batch-api"],
    stations: [
      ["2.2", "Stage the prompt rollout", "Overall accuracy held, but address corrections regressed.", "Roll out globally and watch ticket volume", "The observed slice regression reaches all users.", "Pin both versions, test the affected slice and use a reversible rollout", "The release catches the failure and can switch back.", "Roll back the entire app for any prompt change", "Unrelated code and prompt changes remain coupled."],
      ["2.6", "Capture configuration for replay", "A previous run used a distinct model ID, prompt and settings.", "Record the model family alone", "The previous behavior cannot be reproduced.", "Record the resolved model ID, prompt version, settings and commit", "The on-call team can reconstruct the execution.", "Use the current settings for both runs", "Historical configuration disappears from the comparison."],
      ["5.1", "Test model variability", "One input can produce different labels on repeat. The release gate currently checks a single answer.", "Accept a confident answer from one request", "Variability and correctness remain unmeasured.", "Run repeat trials on labeled cases under pinned settings", "The gate measures actual outcomes and run-to-run variation.", "Require exact prose equality on one record", "Equivalent correct labels can fail while other cases go untested."],
      ["5.3", "Choose model routing", "Routine inputs meet targets on A; ambiguous inputs meet target on B. All-B exceeds budget.", "Route all to B", "Costs exceed the limit.", "Use a validated ambiguity signal to send only those cases to B", "The system can meet cost and compare quality on both slices.", "Alternate A and B by request number", "Many difficult inputs go to the weaker route."],
    ],
  },
]);

export const professionalMissions = jobs("architect-professional", [
  {
    id: "public-permit-discovery", place: "old-courthouse", title: "Design a permit support pilot", brief: "The sponsor wants a chatbot. Staff spend most of their time asking applicants for missing attachments.",
    specialist: "Interview support and publication owners. Review the workflow and compare the complete cost of two routes.",
    stations: [
      ["1.1", "Choose the first intervention", "Most of the six-day turnaround follows incomplete forms.", "Deploy a general FAQ bot", "The intervention has no effect on completeness.", "Test pre-submission completeness checks and measure total turnaround", "The pilot addresses the observed cause of delay.", "Automate final approval", "The proposal removes mandated review."],
      ["1.3", "Set the architecture boundary", "Eligibility is fixed, research varies and issuance needs approval.", "Give one agent research and issuance access", "Issuance can be attempted before approval.", "Use fixed gates with bounded read-only research", "The variable task remains separate from mandatory control.", "Enumerate every possible research query", "New evidence patterns fail outside the list."],
      ["1.6", "Compare costs per resolved case", "Route A costs 1¢ plus a 3¢ retry half the time. Route B costs 2.2¢ and meets the same SLA.", "Compare 1¢ with 2.2¢", "The estimate omits half the retries.", "Compare 2.5¢ with 2.2¢ and show the service outcomes", "The sponsor sees comparable cost per resolution.", "Charge 3¢ extra on every route A case", "The estimate overstates A’s cost."],
      ["6.1", "Interview process owners", "Support reports stale status. Policy owners restrict which changes can be shown before sign-off.", "Choose a model first", "The disclosure and freshness constraints are unresolved.", "Map status changes with both owners and agree on visible states and goals", "The pilot can test approved disclosure and freshness.", "Infer policy from prior tickets", "Old behavior may conflict with current rules."],
      ["6.2", "Brief the sponsor", "A broader rollout projects higher savings but failed its disputed-case holdout.", "Lead with savings and bury the holdout", "A material release constraint is missed.", "Show measured results, projected savings and the limited pilot stop conditions", "The board can compare evidence and risk.", "Present the variants as equivalent", "The decision ignores the observed failure."],
    ],
  },
  {
    id: "library-retrieval-architecture", place: "olive-library", title: "Modernize the archive search", brief: "The archive’s retrieval misses accession numbers and separates procedures from revision headers.",
    specialist: "The librarians have labeled exact-ID and description queries, plus traces from three retrieval stages.",
    stations: [
      ["3.3", "Target the expensive retrieval stage", "Reranking helps hard queries. Running it everywhere breaks p95. A tested signal identifies hard cases.", "Rerank every query and report median latency", "The service still misses its p95 requirement.", "Rerank flagged cases and verify recall and p95 by slice", "Hard queries receive extra work while routine latency stays lower.", "Remove reranking and report latency alone", "The known quality gap becomes invisible."],
      ["3.5", "Index complete procedures", "A procedure needs its revision and collection header. Fixed-length chunks split them.", "Shorten every chunk", "More procedures lose their governing header.", "Index coherent sections with revision and collection metadata", "The retrieved section retains the context needed to interpret it.", "Return entire manuals for every match", "Long documents crowd out targeted evidence."],
      ["3.6", "Support identifier and descriptive queries", "Dense search misses rare codes; lexical search misses paraphrases.", "Use dense retrieval alone", "Exact identifiers are still missed.", "Merge lexical and semantic candidates and measure each slice", "Both query types have dedicated evidence and their own checks.", "Search only titles", "Procedure descriptions are absent from the index."],
      ["3.4", "Join stage traces", "One overall timer cannot locate delays. Full case contents are excluded from logs.", "Record prompts and raw source payloads", "Logs violate policy and remain uncorrelated.", "Propagate trace IDs with per-stage timing, status and provider request ID", "The slow stage can be located without case contents.", "Record only browser duration", "Gateway, retrieval and model delays remain conflated."],
      ["4.4", "Investigate stale revisions", "The captured prompt already contains the wrong revision. The same model answers correctly with the current excerpt.", "Swap the model", "The retrieval issue survives.", "Trace a known-current excerpt through ingestion, revision filtering and retrieval", "The team finds the stale revision filter.", "Increase response tokens", "The model receives the same stale evidence."],
    ],
  },
  {
    id: "professional-eval-gate", place: "office", title: "Build the pilot’s evaluation gate", brief: "A candidate improves handle time but fails more disputed and uncommon requests.",
    specialist: "Priya can replay labeled cases, assign reviewers, and expose five percent of eligible tickets.", requires: ["support-pilot", "public-permit-discovery"], simulate: replayPilotGate,
    stations: [
      ["4.1", "Choose operational metrics", "Sponsors need speed, service quality and real cost, including escalations.", "Track tokens and sessions", "The dashboard cannot show correct resolutions.", "Track accuracy, escalation errors, p95 and cost per resolution", "The gate sees quality, cost and service performance together.", "Use confidence and total monthly spend", "Confidence is unvalidated and total spend moves with volume."],
      ["4.2", "Choose grading methods", "Required fields are exact. Grounding and handoff usefulness require judgment.", "Use exact text matching for everything", "Equivalent helpful handoffs fail.", "Automate exact checks and calibrate human review on grounding and handoffs", "Review time targets qualities exact checks cannot assess.", "Use complaints as the evaluation set", "Silent failures are missing."],
      ["4.3", "Set the canary decision", "Escalation accuracy regressed while average handle time improved.", "Run the candidate in the fastest region only", "Traffic and region confound the comparison.", "Randomize eligible cases and use a separate escalation rollback threshold", "The rollout measures the change while protecting the weak slice.", "Gate on aggregate speed alone", "Disputed-case regressions can pass."],
      ["4.6", "Monitor new input formats", "A newly onboarded office has a different attachment layout and rarely reports errors.", "Watch API errors only", "Schema-valid wrong results remain invisible.", "Sample labeled outcomes by layout and alert the owning team on drift", "New source quality is measured in production.", "Repeat only the original offline set", "The new layout remains untested."],
      ["5.5", "Audit uneven quality", "Small groups are five percent of samples. A false exclusion has a serious consequence.", "Use overall agreement as the only gate", "Large groups dominate the measure.", "Review false exclusions by group on a representative set and keep staff oversight", "Affected populations get enough evidence and decisions can be checked.", "Compare model confidence between groups", "Confidence does not measure false exclusions."],
    ],
  },
  {
    id: "market-scale", place: "market-hall", title: "Control context and inference cost", brief: "A multi-team vendor service is exceeding its token budget. Similar cases also need consistent treatment.",
    specialist: "Inez has repeated policy prefixes, variable request metadata, and held-out examples of missing and waived fields.", requires: ["library-retrieval-architecture"],
    stations: [
      ["2.1", "Choose a candidate inside all limits", "A achieves 95% at $0.01 and 1.6 s p95. B achieves 98% at $0.04 and 2.8 s. Targets are 94%, $0.02, and under 2 s.", "Use B for all traffic", "It misses both operating limits.", "Pilot A and monitor all three metrics on representative traffic", "The candidate meets the observed envelope.", "Call both models for every ticket", "Cost and tail time rise."],
      ["2.3", "Teach the waived-field boundary", "The model confuses a policy waiver with a missing required attachment.", "Add clear complete examples only", "The ambiguous boundary stays untested.", "Use matched waived and missing cases with expected dispositions", "The two cases receive distinct outcomes.", "Increase output length", "The prompt still omits the governing distinction."],
      ["2.4", "Retrieve only the active claim", "Raw search rows dominate long conversations. Only verified state and relevant claim records are needed.", "Replay raw search rows", "Stale rows compete with active evidence.", "Persist verified source-linked state and retrieve the relevant subset", "The case facts survive with a smaller context.", "Erase context whenever it grows", "Prior verified decisions are lost."],
      ["2.5", "Reuse approved instructions", "The policy and rubric are common, but team metadata and requests change each turn.", "Fork a policy copy for each team", "Policies drift and cache reuse fragments.", "Maintain a versioned shared prefix and put variable inputs after the breakpoint", "Teams share the update and qualifying requests can reuse the prefix.", "Cache the entire variable request", "The prefix differs across teams."],
      ["4.5", "Diagnose the spend regression", "The model and output length held. Cache reads fell after new IDs moved ahead of the policy.", "Compare aggregate latency alone", "The cause remains ambiguous.", "Move IDs around the breakpoint in matched runs and compare read and creation tokens", "The test isolates cache reuse and spend.", "Reduce the output cap", "It does not explain the input usage change."],
    ],
  },
  {
    id: "tenant-tools", place: "shop", title: "Share a service without sharing customer records", brief: "Three assistants need a common lookup. Current agents receive every tool, including tools for unrelated records and writes.",
    specialist: "Sam supplies service identities, authorized tenant scope, and an existing nightly bulk API.", requires: ["public-permit-discovery"],
    stations: [
      ["3.1", "Limit the triage tool surface", "Triage needs four read capabilities; its current 40 include payroll and updates.", "Hide unused tools in the UI only", "The model can still call them.", "Expose required read tools and enforce the scope at the service", "The tool list and execution authority match the role.", "Rename tools without changing scope", "Unnecessary authority remains."],
      ["3.2", "Derive tenant scope from identity", "The search service identity can read all tenants. Users must only receive their tenant’s snippets.", "Retrieve globally and filter in the prompt", "Other tenant content has already entered model context.", "Carry verified scope and filter in the search service", "The worker receives only records it may read.", "Trust the tenant supplied by the browser", "A signed-in user can name another tenant."],
      ["3.7", "Keep suitable integrations", "Three assistants need permissioned lookup. The nightly CSV transfer has a reliable existing API.", "Move the CSV transfer into an agent conversation", "Deterministic bulk transfer becomes coupled to model execution.", "Share the lookup through MCP and leave bulk transfer on the existing API", "Each workload retains an appropriate interface.", "Build three separate copies of the same lookup", "Policy and implementation can drift independently."],
      ["3.8", "Discover capabilities when needed", "Tool choices differ by task family. The authorized capability matrix is already available.", "Include all tool schemas each turn", "Token cost and selection errors persist.", "Discover authorized tools by task and measure routing and tokens", "Each turn receives a smaller relevant surface.", "Discover globally and enforce scope after execution", "Unauthorized results can be exposed before enforcement."],
    ],
  },
  {
    id: "community-controls", place: "community", title: "Put approval and privacy controls into production", brief: "Draft recommendations are useful, but disputed actions need staff decisions and the diagnostic pipeline retains too much.",
    specialist: "The governance owner provided a retention plan, mandatory approvals, and failure examples.", requires: ["tenant-tools", "professional-eval-gate"],
    stations: [
      ["2.2", "Separate policy from evidence", "External attachments may contain instructions. The assistant can propose account changes.", "Treat all retrieved text as system instructions", "External content gains application authority.", "Label untrusted data and verify each write at the service", "Evidence can inform drafts without granting action authority.", "Let a document’s claim of approval authorize updates", "No trusted approval has been verified."],
      ["5.1", "Enforce review before writes", "All changes require an operator; sensitive accounts require a second approval.", "Confirm only the first change per session", "Later changes skip their required approvals.", "Separate drafts from writes and verify matching approvals per action", "The control applies before every change.", "Audit all changes the next morning", "The changes happen before review."],
      ["5.2", "Distinguish an outage from an empty result", "A facility search publishes ‘no capacity’ when the upstream source is unavailable.", "Track uptime without changing result states", "Unsupported denials continue.", "Model distinct empty and unavailable states and test both", "Residents get accurate availability or a clear uncertainty message.", "Raise confidence requirements", "Confidence cannot establish what an unavailable source contains."],
      ["5.3", "Record a binding approval", "Staff must resolve disputed evidence and approve the exact amount issued.", "Log an approve click without version or amount", "The audit cannot show which action was approved.", "Show both sources and enforce approval for the exact version and amount", "The executed decision is traceable.", "Pay when two models agree", "The mandatory human decision is bypassed."],
      ["5.4", "Enforce retention throughout the data flow", "The database, diagnostics and model provider have separate retention surfaces.", "Expire records only in the app database", "Other copies remain.", "Map data paths, redact diagnostics and verify deletion settings and behavior per store", "The tested controls address each copy.", "Encrypt the stores and leave retention informal", "Encryption does not implement the retention schedule."],
    ],
  },
  {
    id: "regional-operations", place: "office", title: "Hand the service to operations", brief: "The implementation team is leaving. An outage must route work manually in ten minutes, and different teams need consistent release practices.",
    specialist: "Priya’s handoff includes one outage replay and a permission regression from the previous release.", requires: ["market-scale", "community-controls"],
    stations: [
      ["1.2", "Deliver a scoped handoff", "Each specialist sees one source collection. The coordinator needs claims and unresolved conflicts.", "Give all workers a shared history", "Workers see unrelated collections.", "Return scoped claims with source IDs and conflicts to the coordinator", "Synthesis can resolve or disclose disagreements.", "Combine worker confidence scores", "The evidence and disagreements disappear."],
      ["1.4", "Dispatch only the specialists needed", "Routine tickets need one worker. Outages may need two. All workers on every ticket exceed budget.", "Run every specialist in parallel", "Latency may improve, but excess work remains.", "Dispatch by task and inspect coverage before synthesis", "The coordinator requests the missing expertise only when needed.", "Always use the cheapest worker", "Some cases lack the required evidence."],
      ["1.5", "Make failed stages recoverable", "Privacy preflight is fixed, mapping varies by format, and approval must precede import.", "Map and approve in one unlogged turn", "Failures cannot be isolated.", "Checkpoint preflight, mapping, validation and approval", "Each failure has a known stage and retry path.", "Start approval in parallel with mapping", "Approval precedes the final input."],
      ["6.4", "Document deployed behavior", "The incoming team must reproduce retrieval and fallback from the release version.", "Deliver screenshots of successful chats", "Failures and deployed versions cannot be reproduced.", "Version the data flow, controls, failure fixtures and owners", "Operators can trace and test both success and failure.", "Document only the retrieval parameters", "Handoff and exception behavior remain unspecified."],
      ["6.5", "Prepare a ten-minute outage response", "The outage requires a staffed manual queue and a named on-call owner.", "Send a dashboard link alone", "The team has no defined action or owner.", "Test alerts and manual routing, assign the owner, schedule quality review", "The incoming team can execute the outage plan.", "Assign every local incident to the provider", "No one owns the local manual queue."],
      ["7.1", "Publish shared tools and enforce policy", "All teams need a review workflow. Repository config cannot override production write restrictions.", "Put both controls in a Skill", "The optional procedure does not enforce writes.", "Share a Skill and centrally enforce production permissions", "Teams reuse the workflow within a mandatory boundary.", "Store the write rule in an untracked local file", "The restriction can drift or be omitted."],
      ["7.2", "Improve cross-module review", "Repeated commits post duplicate issues and miss interactions between changed components.", "Deduplicate by exact wording alone", "Paraphrased duplicates and cross-component defects remain.", "Run a fresh integration pass and track findings by identity and evidence", "Cross-module defects become visible without repeated comments.", "Ignore every file with a prior comment", "New issues in those files are suppressed."],
      ["7.3", "Diagnose denied tool writes", "Reads still work after a deployment. Every write by one worker is denied.", "Add more write instructions to the prompt", "The service still rejects the verified identity.", "Compare the worker identity, effective scope and denial trace with the previous release", "The changed authorization path is isolated.", "Grant broad write access and observe", "The guardrail is weakened before the cause is known."],
    ],
  },
]);
