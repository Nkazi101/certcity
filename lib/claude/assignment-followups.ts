import { caseQuestions } from "./assessment/cases";
import type { CaseQuestion } from "./assessment/cases";
import type { PracticeItem } from "./items";

type FollowupQuestion = readonly [
  objective: CaseQuestion[1], source: CaseQuestion[2], prompt: string, key: string, rationale: string, ...choices: string[],
];

function followup(mission: string, scenario: string, questions: readonly FollowupQuestion[]) {
  return caseQuestions(scenario, "", questions.map((question, index): CaseQuestion => [`${mission}-${index + 1}`, ...question]), "delayed");
}

/** Each module owns its delayed items. Prompts are separate from the virtual job, Lens, and rehearsal. */
export const assignmentFollowups: Readonly<Record<string, readonly PracticeItem[]>> = {
  "market-bulletin": followup("market-bulletin", "Bus operator change notice", [
    ["1.1", "prompt", "The duty controller wants a message learners can act on immediately when a stop is closed. Until the diversion is verified, what should the draft brief require?", "b", "Name the audience, confirmed information and treatment of pending details.",
      "Use the previous diversion notice as fully applicable.", "State the confirmed stop closure and mark the replacement stop pending until approved.", "List candidate stops as if each is an available alternative.", "Wait to write any text until someone shares the complete route map."],
    ["2.1", "grounding", "A notice names the closed stop and the closure date but omits the last departure affected. What review catches this?", "d", "A required-element check against operations records catches omissions in otherwise correct text.",
      "Count citations.", "Review the announcement tone.", "Confirm that the stop name appears in the map.", "Compare the draft against every required operational field including the last affected departure."],
    ["4.4", "eval", "Only dispatch can publish route changes. Which drafting workflow keeps that control and measures impact?", "a", "Review gates belong to the authorized owner and pilots should measure total effort.",
      "Draft for dispatch approval and log edits and total processing time.", "Publish routine routes automatically and analyze edits afterward.", "Let the assistant publish when it recognizes the stop.", "Ask dispatch to review only the longest messages."],
  ]),
  "library-desk": followup("library-desk", "Maritime exhibition team", [
    ["3.1", "projects", "Six educators start different visitor conversations. They must share exhibit instructions and use the same current safety facts. What workspace design fits?", "c", "A Project carries approved common knowledge and instructions across separate chats.",
      "One chat joining all visitors.", "One editable Artifact containing all visitor messages.", "A shared Project with approved instruction and knowledge, plus a separate chat for each visitor.", "Independent accounts sharing only yesterday’s answer."],
    ["5.4", "projects", "The shared Project still cites winter exhibit hours after the summer schedule replaces them. What action tests the actual fix?", "b", "Remove the superseded reference from active retrieval and verify a new chat uses the current one.",
      "Add summer to the old file name.", "Replace the winter reference in active knowledge and run a fresh hours query.", "Tell each visitor to ignore winter hours before reading the response.", "Start a fresh chat with both references still active."],
  ]),
  "school-notice-pilot": followup("school-notice-pilot", "Volunteer intake trial", [
    ["1.3", "prompt", "A shorter onboarding reply drops the mandatory orientation link. Which next test isolates what changed?", "a", "Hold the relevant facts and test cases fixed when changing the prompt constraint.",
      "Require the link in the shorter version and compare both on the same intake cases.", "Change the message tone and the volunteer policy at once.", "Rank replies by length only.", "Add one approved long reply as an example and assume the link survives."],
    ["2.2", "grounding", "A chart claims most volunteers reject evening training. Only retirees with weekday shifts were surveyed. What may the team report?", "c", "The sample supports only its own population and conditions.",
      "Evening sessions are unpopular for volunteers in general.", "Weekday volunteers represent everyone because they answered first.", "The weekday retiree respondents’ result, with evening workers’ preferences unmeasured.", "The chart headline with a citation to the survey file."],
    ["4.5", "eval", "Writing time falls from 20 minutes to 10 minutes. Review increases from 3 minutes to 9 minutes per message. What comparison should the program use?", "b", "Net human effort changes from 23 to 19 minutes and quality should be reported separately.",
      "Ten minutes net saved.", "Four minutes net saved, with review quality included alongside it.", "Six minutes net lost.", "A 50% productivity gain for the whole workflow."],
  ]),
  "library-activity-kit": followup("library-activity-kit", "Aquarium education package", [
    ["1.4", "prompt", "The team wants new feeding-session ideas and a summary of approved handling rules. How should it prompt?", "d", "Ideas can vary within constraints. Rule summaries need validated sources and clear unknowns.",
      "Generate ideas and treat them as the official holding rules.", "Use the same creative task for both documents.", "Limit new ideas to sentences already in the approved rule book.", "Explore ideas within constraints and separately extract rules from approved sources."],
    ["2.6", "artifacts", "Teachers will edit the kit and a booking system ingests session IDs. What should they receive?", "b", "Give each consumer a format it can use and verify the data structure before import.",
      "Two PDF screenshots.", "An editable kit and a validated array of session IDs.", "A transcript that contains the IDs somewhere.", "A single natural-language description for the importer and teachers."],
    ["3.4", "context", "A chat contains two aquariums’ verified feeding times and unrelated planning sketches. What should carry into a new location-specific chat?", "a", "Use exact verified facts with their location and sources instead of full mixed history.",
      "Only the active aquarium’s confirmed feeding times, source and location ID.", "All times sorted by the latest comment.", "The last summary even though it conflates both sites.", "A list of times without aquarium identifiers."],
  ]),
  "kitchen-billing-audit": followup("kitchen-billing-audit", "Sports club equipment ledger", [
    ["3.3", "models", "Automatic tags are cheap and accurate for routine kit returns. Handwritten exceptions generate costly review. What evidence should determine whether to route differently?", "b", "Compare economics and errors by case type, including staffed work.",
      "Nominal generation price alone.", "Quality and total correction cost by routine and handwritten cases.", "One shared confidence threshold for the whole queue.", "Highest observed latency without comparing outputs."],
    ["7.1", "eval", "Returns were labeled by negative balance. A new export labels them with transaction_type = return. Which first test is most useful?", "d", "Compare matched examples with model and prompt fixed to isolate the schema change.",
      "Use a larger model and add the word refund.", "Rewrite the entire billing workflow.", "Compare the months by overall output length.", "Replay a matched return from each export and inspect which field drives the label."],
  ]),
  "community-policy": followup("community-policy", "Emergency equipment lending", [
    ["4.2", "eval", "Completed forms are reviewed within an hour. Incomplete forms wait days, while writing is already fast. Which pilot uses that evidence?", "c", "Target the wait and measure elapsed outcomes without weakening review.",
      "Prioritize faster wording generation.", "Publish a chat score without tracking wait time.", "Catch omissions before submitting the request and measure total time and corrections.", "Remove the reviewer step to make queue time shorter."],
    ["6.4", "eval", "Short requests are labeled hostile and routed more slowly despite equivalent circumstances. What review best tests this problem?", "b", "Compare matched facts across writing styles and verify the effect on actual service.",
      "Record the average routed volume only.", "Compare equivalent brief and detailed requests and review the routing for unsupported labels.", "Drop short messages from the dataset.", "Hide the label from applicants while continuing to route by it."],
  ]),
  "enrollment-replies": followup("enrollment-replies", "Art studio membership", [
    ["2.4", "grounding", "The published studio policy does not cover a member’s unusual cancellation. Only the coordinator approves exceptions. What reply is supportable?", "a", "State the known rule and refer the unresolved decision without promising a result.",
      "Explain the verified policy and send the documented exception to the coordinator.", "Promise an exception on likely goodwill.", "Deny it as though the ordinary policy settled the case.", "Cite a prior cancellation for a different member as binding."],
  ]),
  "permit-agent": followup("permit-agent", "Venue access service", [
    ["1.2", "messages", "The assistant requested a venue and badge lookup in one turn. Both completed. What must the next Messages request include?", "c", "Append the tool-call turn and match each result to its own tool_use_id.",
      "Both results under one app request ID.", "A new system message with the venue name.", "The assistant tool-use turn and user tool-result blocks carrying both matched call IDs.", "Only the provider’s response header for the last request."],
    ["2.5", "context", "Two badge cases share a visitor’s name. One can be read by the operator. What should be loaded on resume?", "b", "Restore only the authorized record identified by the verified case ID.",
      "The newest name match.", "The session state scoped to the verified, authorized badge case.", "Both cases with a prompt to hide one of them.", "Last week’s saved case for the same operator."],
  ]),
  "printworks-stream": followup("printworks-stream", "Weather terminal monitor", [
    ["3.1", "memory", "Wind-fixture instructions apply only inside tests/wind in two packages. How can everyone inherit them without changing other test runs?", "c", "Commit a path-specific rule covering both relevant directories.",
      "Use each operator’s personal CLAUDE.md.", "Put them in root instructions for every project task.", "Use a shared .claude/rules file scoped to both wind paths.", "Rely on the conversation where the rules were introduced."],
    ["4.1", "streaming", "The backend’s final response contains the complete alert. The browser loses every event split across buffers. Which layer should be replayed first?", "d", "The first verified failure is event framing between backend and browser.",
      "The model’s final-token limit.", "The source’s weather coordinate formatting.", "The application’s authentication token expiration.", "The browser event decoder with partial and complete event boundaries."],
    ["5.2", "streaming", "The browser requires progressive custom events while the provider SDK emits SSE. Where should the conversion occur?", "a", "Bridge the provider stream to an authenticated browser channel from the backend.",
      "Translate validated SDK events on the server and forward them to the authorized session.", "Give the browser a shared provider key.", "Send the body only when all events finish.", "Ask the model to emit transport headers as text."],
  ]),
  "vendor-batch-api": followup("vendor-batch-api", "Repair handbook ingest", [
    ["2.4", "batch", "Three completed async records arrive out of order and one request expired. What operation protects completed writes when the worker repeats the job?", "b", "Use stable result identity and retry only records requiring recovery.",
      "Replay all requests and append results in arrival order.", "Match by custom_id, upsert successes and separately handle the expired record.", "Join by generated title.", "Use a new database key on each retry."],
    ["5.4", "caching", "A stable long handbook follows a request timestamp. Cache reads fall and no generation settings changed. What should be checked?", "a", "Reuse depends on a matching prefix. Verify the ordering and observe cache reads.",
      "Put stable material before the changing timestamp and compare matched cache reads.", "Set a longer cache TTL only.", "Put a second timestamp after the handbook.", "Cache complete answers under an approximate model name."],
    ["6.2", "prompt", "A file stamp can be empty or present but illegible. Both return null, so the review queue needs a separate status. What examples should be added?", "d", "Use contrasting examples at the known classification boundary.",
      "Two legible stamps printed clearly.", "An empty stamp and an unrelated field with a valid amount.", "Examples with identical expected statuses.", "A blank and a visibly illegible stamp with distinct expected statuses."],
  ]),
  "library-workers": followup("library-workers", "Engineering drawings catalog", [
    ["1.3", "subagents", "Each worker starts in its own context, and their permitted drawing collections differ. What belongs in the task packet?", "c", "Fully scope each investigation and its result contract.",
      "A broad request to find anything relevant.", "Every worker’s secret and a shared mutable list.", "Allowed collection, drawing IDs and dates, and fields for provenance and missing coverage.", "Only the editor’s requested conclusion."],
    ["6.1", "context", "The editor needs verified drawing references from a long thread. What should the next turn receive after compaction?", "a", "Keep exact source references and verified scoped facts in durable state.",
      "Exact record IDs, relevant facts and source references, including known gaps.", "Only the last worker’s narrative.", "A confidence average for each drawing.", "Every raw unrelated tool result without labels."],
    ["8.2", "mcp", "A client must read the drafting policy by URI and ask a live service for drawings by ID. Which pairing fits?", "b", "Resources provide addressable reference context, while tools perform parameterized lookup.",
      "Use two static files for both operations.", "Provide the policy as a resource and live lookup as a scoped tool.", "Embed all records in a system prompt.", "Use the drawing catalog as an unscoped write tool."],
  ]),
  "repair-desk-safety": followup("repair-desk-safety", "Facilities change service", [
    ["7.2", "safety", "A web console and a job scheduler share the same equipment write service. Which control covers both?", "c", "Validate the specific caller, action and approval at the write boundary.",
      "Check confirmation only in the browser.", "Require that the assistant cite the approval policy.", "Enforce verified approval and authorization at the service endpoint.", "Rate-limit updates and audit a sample afterward."],
    ["8.1", "mcp", "A parts lookup completes with no stock for one part. A vendor service outage prevents a second lookup. How should callers distinguish them?", "a", "Successful absence and execution failure require different result contracts.",
      "Use empty success for the first and a structured tool execution error for the second.", "Use a no-match reply for both.", "Represent the valid empty result as permission denied.", "Retry both actions as if success were impossible."],
  ]),
  "developer-release": followup("developer-release", "Training portal prompt release", [
    ["2.6", "settings", "An instructor reports a regression from an earlier deployment and gives its run ID. What should the release record resolve?", "d", "Reproduction needs the exact effective system versions and fixture inputs.",
      "The current alias and best response time.", "The launch date and rough prompt topic.", "Only the note from the latest review.", "Resolved model, prompt, rules, tools and source versions, plus the fixture ID."],
    ["5.3", "models", "A small model is accurate on clean enrollment requests and unreliable on ambiguous overrides. A stronger model passes both but costs too much for all traffic. What should the next release test?", "b", "Validate a slice-aware routing rule before deploying.",
      "Send all cases to the smaller model and skip measuring overrides.", "Route identified ambiguous cases to the stronger model and verify both slices and total cost.", "Alternate routes by record number.", "Upgrade all cases using a one-case successful demo."],
  ]),
  "supplier-invoices": followup("supplier-invoices", "Stage lighting purchase report", [
    ["6.3", "structured", "A schema-valid report says 26 lights. The signed lines show 12 and 11 and no additional units. How should the importer respond?", "c", "JSON shape does not establish correctness. Keep source evidence and prevent an unsupported write.",
      "Post 26 because it's an integer.", "Replace the original total with 23 and discard the source discrepancy.", "Hold the record with both the claimed and computed totals for review.", "Accept either number if the model's confidence is high."],
  ]),
  "library-search": followup("library-search", "Municipal photograph index", [
    ["1.1", "stop", "The model emits a promise to check an accession plus a tool_use block. What event must happen before the harness can finish?", "b", "Continue after the linked tool_result and wait for a completed assistant turn.",
      "A friendly preamble appears.", "The tool is executed, its result is linked, and the model completes the response.", "The lookup becomes slower than the preamble.", "The tool ID is saved as the final answer."],
    ["2.1", "tool", "Both search tools can return an image ID. One also creates an exhibit draft. Which capability should a visitor’s information request use?", "d", "Use the contract that supplies the needed evidence without creating records.",
      "The write-capable tool with an informal instruction to avoid saving.", "Either tool because the returned ID has the same shape.", "The tool with the shortest name.", "The read-only search with its purpose clear to the agent."],
    ["5.6", "grounding", "A counter recorded 70 Friday entries. A volunteer estimates 300 visits across the festival. How should an exhibit note handle them?", "a", "Preserve source, method, and time window for each distinct observation.",
      "Report Friday entries and the festival estimate separately, with sources.", "Average both figures as attendance.", "Present the larger figure as a verified count.", "Report both numbers without their periods."],
  ]),
  "printworks-rules": followup("printworks-rules", "Audio-production repository", [
    ["3.1", "memory", "Every operator needs the same export naming rule. One operator prefers brief explanations. Which placement keeps both requirements?", "c", "Shared repo instructions travel with the project. Personal preferences belong in user scope.",
      "Put both in shared project instructions.", "Distribute each user’s complete instructions.", "Commit the team rule in project instructions and keep the personal style in user instructions.", "Keep both settings in the first operator’s conversation."],
  ]),
  "kitchen-extract": followup("kitchen-extract", "Warehouse damage report", [
    ["4.3", "structured", "A recovered weight must be an integer or null. The actual limit for each shipment comes from a trusted manifest. Which controls fit?", "d", "Constrain output type and verify the source-specific limit separately.",
      "Require an integer and approve any output containing one.", "Use a single global weight limit for every shipment.", "Ask for a higher confidence estimate.", "Enforce the nullable integer contract and compare values with the shipment’s trusted limit."],
  ]),
  "community-handoff": followup("community-handoff", "Appliance service appointment", [
    ["1.5", "hooks", "Before rescheduling, the service must check a current verified customer record. After a successful availability lookup it can normalize time zones. Which pairing fits?", "b", "Pre-execution gating prevents an unauthorized write. Normalization needs returned data.",
      "Run both checks after the write.", "Validate before the write and normalize returned availability after its read.", "Normalize before startup and trust a chat’s verification claims.", "Validate when the final message is sent."],
    ["5.2", "agents", "One caller asks expressly for a person. Another names two possible appointments and can provide the confirmation number. How should the system proceed?", "c", "Separate a human request from ambiguity that can be resolved safely.",
      "Ask both for a complete service history.", "Pick the newest appointment and continue both calls.", "Handoff the explicit request with context and ask the other caller for the confirmation number.", "Send both to staff and omit attempted steps."],
  ]),
  "archive-coordination": followup("archive-coordination", "Regional archaeology survey", [
    ["1.3", "subagents", "The site-list worker and permit worker have separate source access. What should the coordinator include in their independent requests?", "a", "Pass each worker its relevant scope and an auditable response contract.",
      "Allowed sources, geography and dates, required record IDs, and uncovered scope.", "The most recent full report but no collection boundaries.", "The other worker’s credentials and preferred narrative style.", "Only the sentence the editor hopes to publish."],
    ["5.3", "research", "The permit worker completed six regions. The site worker checked four and could not access two. What should be returned today?", "d", "Keep verified output and describe exactly what remains unknown.",
      "Confirm that the remaining regions have no sites.", "Throw away both workers’ progress.", "Predict likely results for the two regions using nearby ones.", "Return verified records, the two unknown regions, and the access failure."],
  ]),
  "release-review": followup("release-review", "Campus room-directory migration", [
    ["1.6", "agents", "Renaming a label is isolated. Remapping room IDs could break unknown API consumers. What work plan protects the migration?", "c", "Map hidden dependencies first and test both boundaries after independent work combines.",
      "Apply the larger change first to reveal failing users.", "Parallelize file edits and trust local unit tests.", "Isolate the label edit, discover the ID consumers, and add an integration test for the contract.", "Rewrite the complete directory to eliminate unknowns."],
    ["3.5", "prompt", "The latest change handles null rooms but treats an empty room list as missing. What input helps a developer correct it?", "b", "Give the exact distinctions and expected outputs instead of a broad instruction.",
      "A request for extra error handling.", "Separate null, empty and valid-list fixtures with expected results.", "A prompt to make the result friendlier.", "A single example of a populated result."],
    ["5.4", "context", "The investigation is about to compact. What note should a teammate be able to resume from tomorrow?", "a", "Keep inspectable evidence, outcomes, and explicitly pending work.",
      "Confirmed caller paths, tested hypotheses, accepted findings and open checks.", "Only the exact words of the final plan.", "The last commit message without the evidence.", "All past tool output merged into an unlabeled paragraph."],
  ]),
  "repair-shop-tools": followup("repair-shop-tools", "Furniture repair coordination", [
    ["2.3", "tool", "Triage needs status for one verified work order. Supervisors can change assignments. Which tool surface should triage get?", "d", "Limit the exposed capability and enforce the scope at the service.",
      "All tools, with a prompt-only write boundary.", "The supervisor tool hidden in the interface.", "A full unscoped status export.", "The status-only lookup for the verified work order."],
  ]),
  "printworks-ci": followup("printworks-ci", "Documentation build review", [
    ["3.6", "cli", "A CI assistant blocks on terminal input and the publisher needs validated fields. How should it run?", "b", "Use bounded noninteractive execution and a machine-readable contract.",
      "Capture interactive screen updates.", "Use print mode with a structured result and validate it before publishing.", "Ask the model to write informal comments and parse by sentence length.", "Give the job unrestricted tools so it cannot hang."],
    ["4.6", "eval", "Separate documentation and API reviews pass their own files, but the examples violate the API contract. What additional review fits?", "c", "Review cross-component behavior with evidence and a clear contract.",
      "Repeat the same isolated style checks.", "Suppress examples when documentation review passes.", "Run a fresh integration pass over API, changed examples and acceptance fixtures.", "Ask the original author to rate their confidence."],
  ]),
  "market-close": followup("market-close", "Museum shop order desk", [
    ["4.5", "batch", "Customers need live stock acknowledgment. Overnight catalog tagging has independent inputs due tomorrow. Which split fits?", "a", "Use live requests for deadlines and an async batch for independent bulk work.",
      "Serve the counter interactively and batch independent tagging.", "Batch both queues and poll for shoppers’ replies.", "Process the catalog synchronously before issuing counter replies.", "Use one queue ordered purely by upload time."],
    ["5.5", "eval", "Labels from one handwritten supplier have high confidence and frequent item-ID errors. How should six spare audits be used?", "d", "Check the known weak group and reserve representative audits for accepted results.",
      "Audit only cases with the lowest confidence globally.", "Spend all six on the most common clean forms.", "Skip review where the model agrees with itself.", "Prioritize the weak handwriting slice and sample the accepted population."],
  ]),
  "dispatch-monday-peak": followup("dispatch-monday-peak", "Snow removal status queue", [
    ["2.2", "mcp", "Read requests time out unevenly. Some have enough time for one safe retry, and others must reach the operator immediately. What policy fits?", "c", "Budget retries with deadline and operation safety. Preserve unknown results.",
      "Retry all requests including permission failures.", "Report every timeout as no matching route.", "Retry only eligible reads with time left and mark other outcomes unresolved.", "Retry writes without confirming whether the operation committed."],
    ["5.3", "context", "A failed retry prevents current confirmation for six routes. The operator has 18 confirmed routes. What should the handoff contain?", "b", "Keep the confirmed work and preserve exact unknowns and attempt records.",
      "One blank report while waiting for the source.", "The confirmed routes, six remaining IDs, the attempt history and current uncertainty.", "A list of 24 routes all marked clear.", "Only a count of failed requests."],
  ]),
  "market-rush": followup("market-rush", "Seasonal seed orders", [
    ["4.5", "batch", "The counter needs responses now. Offline order comments can run overnight. Batch output arrives in a different order. Which controls fit?", "d", "Isolate the latency budget and correlate asynchronous results with stable IDs.",
      "Batch counter replies with comments and read results in submission order.", "Process comments first on the live counter queue.", "Rerun all records each time one result fails.", "Serve the counter independently and join batch output by stable request ID."],
    ["5.1", "context", "Two orders share the same customer and have different shipping dates. The compacted answer assigns one date to each. What should replace it?", "a", "Key exact state by order and retain the authoritative source.",
      "Load verified order IDs, dates and source records for the active cases.", "Keep the last customer-level date.", "Copy both dates out of order into a single note.", "Increase context while preserving the ambiguous labels."],
  ]),
  "public-permit-discovery": followup("public-permit-discovery", "Food stall applications", [
    ["1.6", "eval", "Workflow A costs 1¢ plus a 4¢ retry on half the cases. Workflow B costs 2.6¢ per resolution at the same service level. What comparison should be reported?", "c", "Compare comparable total resolution costs. A costs 3¢ on average at the stated retry rate.",
      "A costs 1¢ and B costs 2.6¢.", "A costs 5¢ in every case and B costs 2.6¢.", "A averages 3¢ and B averages 2.6¢ per resolution, with service outcomes shown.", "Compare only the better performing workflow's API cost."],
    ["6.1", "eval", "Field staff report outdated statuses, and the policy owner restricts publication of provisional outcomes. What should discovery establish first?", "a", "Agree acceptance criteria with both service and policy owners.",
      "Which states can be shown, who approves publication, and how fresh they must be.", "The most convenient model for final text generation.", "Which status appears most in historical requests.", "The equivalent measure from a different program."],
  ]),
  "library-retrieval-architecture": followup("library-retrieval-architecture", "Engineering standards repository", [
    ["3.5", "retrieval", "Passages quote the right standard but omit the revision that supersedes the rule. What change should the indexer test?", "c", "Index coherent sections together with revision and source metadata.",
      "Split all chunks into shorter text without metadata.", "Return the full repo for every query.", "Index coherent procedure sections with governing revision and source fields.", "Merge every revision as equal context and let the model guess."],
    ["4.4", "retrieval", "The answer is correct when the current passage is substituted into the same prompt. The normal trace selects an obsolete passage. What should be checked first?", "b", "The failure was reproduced before generation. Inspect ingestion, filtering and ranking.",
      "Tune model effort.", "Trace the two revisions through the index and the request-time filter.", "Turn off evidence references in the generated answer.", "Ask reviewers to ignore minor factual changes."],
  ]),
  "professional-eval-gate": followup("professional-eval-gate", "Rental assistance appeal pilot", [
    ["4.2", "eval", "Review must measure exact case fields, evidence quality and unusual appeal types. Which design gives independent signals?", "d", "Match each criterion to a grader and cover the rare high-consequence slice.",
      "Use broad ratings from one uncalibrated reviewer.", "Require exact prose equality for all criteria.", "Sample only the most frequent forms.", "Check fields deterministically and use calibrated review for evidence quality on labeled, stratified cases."],
    ["5.5", "eval", "The release meets aggregate accuracy. Audits reveal unjustified declines in a small rural cohort. What evidence supports a promotion decision?", "b", "Use subgroup outcomes and uncertainty. Refer critical failures to the accountable decision owner.",
      "Only overall agreement with staff.", "Matched subgroup error counts, rates, evidence and uncertainty, with explicit stop conditions.", "Average model confidence from the large cohort.", "The number of completed rural applications after excluding declines."],
  ]),
  "market-scale": followup("market-scale", "Ticket resale service", [
    ["2.4", "caching", "Event-specific data moves ahead of a shared decision manual. Input spending rises as cache reads fall. What change isolates the cause?", "a", "Put stable content first and compare the same workloads and settings.",
      "Restore stable prefix ordering and compare cache reads under matched runs.", "Change the generation model and report its output price.", "Store the final answer for all events using the same manual.", "Increase the output limit and keep variables first."],
    ["4.5", "eval", "The low-price model saves on generation but causes more second passes for disputed tickets. What should the optimization report include?", "c", "Use end-to-end economics and quality, broken out by operational slice.",
      "Nominal price per token only.", "Only generation latency for routine tickets.", "Net resolution time and cost including second passes, with quality per slice.", "Average prompt length across both workflows."],
  ]),
  "tenant-tools": followup("tenant-tools", "Multi-campus case lookup", [
    ["3.8", "mcp", "Each campus search uses a verified operator role. The catalog has 30 capabilities across teams. How should the current task discover tools?", "b", "Scope discovery to authorized task capabilities and enforce scope at call time.",
      "Provide all capabilities and rely on polite agent instructions.", "Return only authorized task capabilities and check the grant again on execution.", "Hide unapproved tool names only from the browser.", "Let the agent choose a user role from a document."],
  ]),
  "community-controls": followup("community-controls", "Transport incident evidence", [
    ["2.2", "safety", "A submitted incident note claims to authorize changing a passenger record. How should the architecture handle the text?", "c", "Treat external text as evidence and check authority separately before state changes.",
      "Use the author’s confidence as permission.", "Ignore all notes with imperative sentences.", "Use the note as evidence and verify action approval at the record service.", "Assign the note user-level write permissions."],
    ["5.4", "privacy", "A handling policy requires removal of retained passenger details from three stores, including diagnostics. What release evidence matters?", "d", "Verify the policy for each retained copy and keep only permitted diagnostics.",
      "The customer UI no longer shows the notes.", "The model promises to avoid repeating details.", "One source record is deleted and logs remain unchanged.", "An inventory and verified retention controls for every store and derived copy."],
  ]),
  "regional-operations": followup("regional-operations", "Rail replacement bus control", [
    ["1.4", "research", "One worker checks bus availability and another checks closures. A coordinator must explain conflicts before advising the control team. What should worker returns include?", "a", "Supply separate provenance-bearing results with known gaps, then reconcile conflicts at the join.",
      "Scoped facts, source IDs, coverage and unresolved conflicts for each worker.", "One combined summary without source IDs.", "Only whichever worker responds first.", "A mean confidence for the whole route."],
    ["6.4", "context", "Operators need to reproduce a case whose deployed rule is superseded. What artifact makes that possible?", "c", "Store the effective versions, expected controls and relevant reproduction evidence.",
      "A screenshot of a modern successful case.", "Current deployment documentation only.", "Versioned flow, applied rules, failing fixture and responsible service owner.", "The original operator’s personal notes with no identifiers."],
    ["7.3", "settings", "Only the north depot sees permission errors after a rollout. What should the on-call team compare first?", "d", "Reproduce at the failing stage and compare effective identity and permissions with a working site.",
      "Model size on a test from the south depot.", "How many turns the model uses in routine dispatch.", "Prompt writing style for the affected depot.", "Known-good and failing traces, operation scope and applied policy revisions."],
  ]),
  "support-pilot": followup("support-pilot", "Hotel service recovery pilot", [
    ["6.3", "eval", "The trial must stay under two seconds p95 and staff must approve every disputed adjustment. What agreement should be in place before the pilot?", "b", "Pair service targets with enforcement, observability and an owner who can stop exposure.",
      "An average response-time goal and one postlaunch audit.", "Measured latency and cost targets, a per-adjustment approval gate, and explicit rollback ownership.", "A fixed amount of traffic with no dispute monitors.", "A promise to use a more capable model when staff request intervention."],
  ]),
};
