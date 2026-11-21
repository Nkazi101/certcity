import type { sources } from "../items";

type Debrief = {
  observation: string;
  implementation: string;
  transfer: string;
  references: readonly (keyof typeof sources)[];
};

export const assignmentDebriefs: Readonly<Record<string, Debrief>> = {
  "dispatch-lookup": {
    observation: "T-17 never completed its order lookup. The original contract showed it as an empty match, so the desk could give the same answer for a verified miss and a failed search. The replay separates those outcomes and lets Dispatch act on each.",
    implementation: "In MCP terms the lookup station is the tool server, the routing desk is the client application, and the ticket is the tool’s input. A completed search can return zero records as data. A dependency timeout can be returned with isError set to true. Dispatch’s errorCategory and isRetryable fields are application-defined. A disconnected client may have no result to inspect. A retry budget and a staffed handoff belong to the application.",
    transfer: "If a new scenario shows an empty array, ask whether the underlying operation completed. If it failed, read the failure kind, remaining deadline and possibility of side effects before choosing retry, clarification or escalation.",
    references: ["mcp", "errors"],
  },
  "enrollment-replies": {
    observation: "You drafted a firm date from the signed bulletin, kept a reopening date pending, and routed a late exception to the enrollment lead with the request and its reason.",
    implementation: "The bulletin is the approved reference you would give Claude. A useful instruction asks for a claim, its source and an explicit unknown status. A staff approval step handles exceptions under the office policy. The source supports the reply and the authorized person owns the decision.",
    transfer: "Distinguish a source-supported fact, a gap in current information and a requested policy exception. Each calls for a different response even if all three drafts sound confident.",
    references: ["prompt", "grounding", "fluency"],
  },
  "market-bulletin": {
    observation: "You compared the vendor’s proposed hours with Inez’s signed sheet, kept Dock B directions in the staff copy, and placed the changed drafts in Inez’s approval tray.",
    implementation: "The signed sheet is grounding context. Audience and required fields belong in the request to Claude. A shared table of verified hours can feed two deliverables with different details. The tray represents a handoff before publication, with the source and unresolved request visible to the person who approves the send.",
    transfer: "When an example mixes a valid proposal with an approved fact, use the approved fact for the public version. Check whether the alternate audience actually needs the internal detail and who controls release.",
    references: ["prompt", "grounding", "fluency"],
  },
  "library-desk": {
    observation: "You assigned the approved reference files and persistent citation instructions to separate shelves, then opened a fresh chat to see which policy the next shift inherited.",
    implementation: "A Claude Project gives its chats access to project instructions and attached knowledge. Treat the approved FAQ as changing evidence and the citation policy as a standing instruction. A source connection has its own access permissions. Verify the current source and a denied source using the identity the real operator will use.",
    transfer: "When the question asks where behavior belongs, identify whether it should persist across chats, apply to a single request, or come from a current external source. Check freshness and access independently.",
    references: ["projects", "grounding", "privacy"],
  },
  "school-notice-pilot": {
    observation: "You restored two required documents, attributed feedback to weekday respondents and calculated three minutes of net savings per reply after including review. The next incomplete application stayed at intake.",
    implementation: "A rewrite prompt needs explicit must-keep facts. Compare the rewritten and prior drafts against the same checklist, including source coverage. In pilot evaluation, measure total drafting plus review effort and count the corrections. A form validation step handles a missing field before any draft can imply it was supplied.",
    transfer: "If a scenario claims success from faster drafting or a survey average, inspect the denominator, missing groups, review time and acceptance criteria before generalizing.",
    references: ["prompt", "eval", "fluency"],
  },
  "library-activity-kit": {
    observation: "You separated the approved program IDs, staff instructions and unapproved ideas. Then you compared the quick and deep routes on routine and conflicting records before handing verified dates to the next shift.",
    implementation: "An editable Artifact can hold the staff-facing kit. Send a machine-readable list of authorized IDs to the importer and validate it against the source record. Compare model tiers with the task’s acceptance limits instead of assuming more compute is always better. Bring current, source-linked facts into a fresh chat for handoff.",
    transfer: "Identify who consumes each output. A person needs something they can revise, a program needs a contract, and a fresh conversation needs the verified context it lacks.",
    references: ["artifacts", "models", "grounding"],
  },
  "kitchen-billing-audit": {
    observation: "Order 27 changed from a signed amount in the old export to a positive amount with a refund marker in the new one. The shared correction classified both formats and held a later smudged row for review.",
    implementation: "Compare the same record before and after a source-format change. Pin model and prompt, isolate the changed field, and test ordinary and unclear rows. Store the reviewed rule in shared instructions with the examples it applies to. Use the faster route where its measured output satisfies the job.",
    transfer: "When an output degrades after a system change, isolate the changed layer and replay matched examples. Separate a normal case from the slice that needs a person’s decision.",
    references: ["projects", "prompt", "eval"],
  },
  "community-policy": {
    observation: "You removed private fields from the outgoing packet, stopped an unapproved mailbox connection, sent a missing-date request back to intake and routed award decisions to the responsible staff.",
    implementation: "The outgoing packet is the actual data another service or Claude would receive. Apply data minimization before transfer. Verify connector purpose and authority separately. AI can organize sourced evidence. Staff can handle exceptions and own the consequential decision. To evaluate unequal effects, compare cases on the same eligibility standard by relevant group.",
    transfer: "Trace which details leave the approved environment, which action has a policy gate and whose outcomes the data represents. Treat these as separate decisions.",
    references: ["privacy", "fluency", "eval"],
  },
  "supplier-invoices": {
    observation: "Both printed totals fit an integer field. The line items backed invoice 302, but they added up to 10,000¢ on invoice 303, which printed 11,000¢. The third invoice had an unreadable printed field.",
    implementation: "The Messages API accepts a JSON schema in output_config.format with type json_schema. It can constrain the extracted amount to integer cents and capture a source status. Recalculate line totals in application code and compare them before a ledger write. Preserve the printed value, computed amount, source and exception status so staff can reconcile it.",
    transfer: "In a new integration distinguish type validation from business validity. Blank, garbled and inconsistent values can require different routes even when they all fit the response format.",
    references: ["structured", "eval"],
  },
  "permit-agent": {
    observation: "The eligibility result finished before the address result. Routing by the pending ID gave each result the right slot. The draft waited for both required checks and the next clerk resumed the verified case.",
    implementation: "With a Claude Messages client tool, preserve the assistant turn and its tool_use blocks. Start the next user message with the corresponding tool_result blocks keyed by tool_use_id, including is_error for an execution failure. Check authorization at the application’s resume boundary. Required steps belong in code.",
    transfer: "Look for whether ordering is a dependency or merely arrival order. Keep the stable call identifier, validate the case being restored, and enforce the required state before publishing a draft.",
    references: ["stop", "tool", "agents"],
  },
  "printworks-stream": {
    observation: "The provider’s complete proof reached the backend, while a split event left the browser preview incomplete. The recording let you compare the same data at both boundaries.",
    implementation: "A Claude Messages stream uses server-sent events. A network chunk can contain part of a frame or several frames. Use the provider SDK or an event parser that retains incomplete input. Treat the terminal message event as completion, and surface a stream error without filing the partial output as a final proof. Test the same captured chunks after changing the decoder.",
    transfer: "If the provider has the final text and the browser does not, locate the first boundary where they differ. Changing prompt, model or output limit cannot fix a client-side frame parser.",
    references: ["streaming", "errors", "memory"],
  },
  "vendor-batch-api": {
    observation: "You kept a counter order on the live lane, joined the out-of-order archive results by their IDs, and left the successful archive entries alone while retrying the one temporary failure.",
    implementation: "Use Messages for interactive responses and Message Batches for independent jobs that can wait. A batch result’s custom_id matches its submitted job independently of return order. Use a durable operation identity for side-effecting writes. Put the stable handbook before variable case data with a cache breakpoint at the end of the stable prefix.",
    transfer: "Find the deadline and the operation identity. Separate urgent response time from overnight throughput, and identify exactly which records a repeat operation should touch.",
    references: ["messages", "batch", "caching"],
  },
  "library-workers": {
    observation: "You handed the editor a verified accession and a separately labeled pending record. The public policy had a fixed address, the district lookup took inputs and the review procedure could be reused.",
    implementation: "Subagents work in separate contexts. Pass the exact scope and have each return verified facts, source identifiers and missing coverage. An MCP resource makes addressable context available. An MCP tool accepts a call and arguments. A Claude Skill packages a procedure and can refer to supporting files.",
    transfer: "Choose the mechanism by what the caller needs to do. Fetching a known policy, running an input-dependent lookup and teaching a repeatable procedure are different actions.",
    references: ["subagents", "resources", "mcp", "skills"],
  },
  "repair-desk-safety": {
    observation: "The attachment’s claim did not authorize a cancellation. A completed stock check showed zero while an outage remained unknown. Staging credential rotation and a maintenance action were checked independently.",
    implementation: "Treat the document as input data. Verify the acting user and action-specific approval in the cancellation service before executing a write. A PreToolUse hook can block the caller earlier. Separate environment credentials to make a staging rotation independent, and return typed tool outcomes so callers can handle each safely.",
    transfer: "A trusted connection to a document does not confer permission to act on its contents. Identify the trusted identity, the action and the enforcement point. Check whether a result is empty or unavailable.",
    references: ["hooks", "mcp", "auth"],
  },
  "developer-release": {
    observation: "The new configuration looked healthy on routine inputs and lost corrected addresses. The release stayed gated, then the earlier prompt and a validated fallback handled the affected slice.",
    implementation: "Record the resolved model, prompt, configuration and fixture versions for each run. Repeated trials on representative inputs show variability. Compare corrected addresses separately from routine traffic, choose a fallback based on measured quality and cost, and keep the previous runnable configuration for rollback.",
    transfer: "If the average improves while a meaningful slice fails, use the predeclared quality gate. Find which release boundary you can reverse without discarding unrelated good work.",
    references: ["eval", "models", "settings"],
  },
  "library-search": {
    observation: "The catalog read belonged to pending call c42. The exhibit caption also needed to keep verified Saturday scans distinct from the weekend planning estimate.",
    implementation: "In a client tool loop, tool_use asks the application to perform work. Return results under the original tool_use_id before continuation. Advertise a read-only tool separately from a create action. Keep source, measurement method and time window when presenting two facts together.",
    transfer: "Check whether the model stopped for a tool or finished. For each output claim, trace it to what the source actually measured. Treat a forecast and a verified count as different claims.",
    references: ["stop", "tool", "grounding"],
  },
  "printworks-rules": {
    observation: "You made the naming convention travel with the repository, kept a personal writing preference local, and scoped proof-test instructions to both proof trees while leaving billing alone.",
    implementation: "Commit general team rules in project CLAUDE.md and keep personal instructions in user scope. Use path frontmatter in .claude/rules for rules tied to particular files. A named Skill can contain the release checklist and supporting examples for when the procedure is needed. Test the effective instructions from a clean checkout.",
    transfer: "Choose by who needs the instruction and when it should load. A repository rule, conditional path rule, reusable procedure and enforced hook can all shape behavior but apply at different boundaries.",
    references: ["memory", "skills", "hooks"],
  },
  "kitchen-extract": {
    observation: "You tagged blank and unreadable originals separately, calculated the printed total discrepancy and let the ledger hold mismatches with their source evidence.",
    implementation: "Claude structured outputs constrain shape, such as integer cents and an explicit source status. Pair contrasting examples to teach blank versus unreadable, and test an unseen example of each. Compare trusted totals in application code. A reformat can repair known data, while contradictory evidence needs review.",
    transfer: "When a valid response fails downstream, identify whether the evidence, shape, or business rule failed before deciding to parse, reformat or escalate.",
    references: ["structured", "prompt"],
  },
  "community-handoff": {
    observation: "You blocked the booking change before execution, normalized the successful read’s timestamp, and handled a direct request for staff differently from a case that needed a room number.",
    implementation: "A PreToolUse hook can reject a call before it executes. The backing service must also verify the actor, operation, target and matching approval. Normalize a successful read after it returns, in supported post-tool processing or the caller. A staffed handoff should include verified state and failed attempts.",
    transfer: "Ask whether the step prevents a side effect, transforms data that already exists, or routes uncertainty. Put the control at the earliest boundary able to do that job reliably.",
    references: ["hooks", "agents"],
  },
  "archive-coordination": {
    observation: "You kept the verified property register and assigned the unchecked map slice to the worker with access, then distinguished missing coverage from verified findings in the editor’s packet.",
    implementation: "Give each Claude Agent SDK subagent an explicit task and scoped tools. A parent conversation’s reasoning is not a substitute for passing the worker the exact dates, IDs and output requirements. Preserve each returned claim with its source and carry forward failures and unchecked scope for reconciliation.",
    transfer: "When one worker fails, decide what remains verified and who can perform the missing read. Keep the distinction between a completed search with no matches and one that never completed.",
    references: ["subagents", "research"],
  },
  "release-review": {
    observation: "You separated a small label fix from a mapper shared by two callers. Both trials began from the same revision and the handoff retained rejected hypotheses and unresolved paths.",
    implementation: "Use plan mode to inspect unfamiliar dependencies before editing a shared contract. Keep alternative investigations isolated by forking a known baseline when appropriate. Test both callers against concrete null and empty-input expectations. Externalize inspected paths, evidence and remaining work before continuing after context has been compacted.",
    transfer: "Compare the cost of exploring together with the risk of parallel edits on a shared contract. Look for the smallest regression test that proves the intended behavior at each affected caller.",
    references: ["sessions", "context", "eval"],
  },
  "repair-shop-tools": {
    observation: "The triage desk received status without repair-edit authority. The new checkout inherited the shared connector, while the personal experiment stayed local. The edit was limited to the call site you inspected.",
    implementation: "Limit the available tool set and also authorize each call at the service. Share team MCP configuration through project scope and load credentials outside the repository. In Claude Code, use Grep for content matches, Glob for path patterns and Read for context before a focused edit.",
    transfer: "Choose the lowest-scope tool that supplies the required evidence. Identify whether the configuration belongs to the team or one person, and verify effective permissions at execution.",
    references: ["mcpConfig", "cli", "mcp"],
  },
  "printworks-ci": {
    observation: "The one-millimeter and three-millimeter proofs fell on different sides of the tolerance. The retry added no duplicate finding and a separate reviewer reproduced the relevant contract failure.",
    implementation: "Run Claude Code noninteractively in CI with scoped capabilities and a validated output contract. Encode measurable thresholds and require field-level evidence. Deduplicate findings using a stable key in application code. A separately scoped integration review can expose blind spots shared by local checks.",
    transfer: "Look for the acceptance rule the runner can check, the narrow evidence a reviewer needs and how a retried job avoids repeating an external side effect.",
    references: ["cli", "structured", "eval"],
  },
  "market-close": {
    observation: "You served the live confirmation and scheduled the archive for overnight work. Exact dates stayed linked to their source records, and review slots covered faint handwriting while leaving room to sample other records.",
    implementation: "Message Batches fit independent requests without a tight interactive deadline. Keep exact dates and record identities in durable structured state across context changes. Allocate human review using observed errors by input type and sample accepted outputs to watch for misses.",
    transfer: "Ask which work has a real deadline, which facts must survive summarization, and where reviewers get the highest benefit under their available capacity.",
    references: ["batch", "context", "eval"],
  },
  "dispatch-monday-peak": {
    observation: "One permitted retry recovered part of the read queue. You sent the remaining failures to staff with attempt history, and asked for a distinguishing identifier when two shipment labels looked alike.",
    implementation: "Represent a transient tool failure explicitly and limit recovery to the request deadline, the available attempts and the safety of repeating the operation. Keep verified results and show remaining uncertainty. A human request can go straight to staff, while a resolvable ambiguity can take one focused question.",
    transfer: "Separate unsuccessful retries, verified absence and ambiguity. Use the available staffing budget and what a new identifier can resolve to choose the next action.",
    references: ["mcp", "errors", "agents"],
  },
  "market-rush": {
    observation: "You kept live confirmations on time, moved independent archive requests to batch, used a source-linked date for a new order and budgeted the inspection queue.",
    implementation: "An application can route time-sensitive Messages requests independently from batch work. Join state by record ID when you restore context or receive a batch result. Set review routing using labeled failures in a meaningful slice and include a sample of cases the automatic system accepted.",
    transfer: "When cost, latency and review limits compete, choose which work belongs on each route and verify the resulting totals. Judge each claimed fact against the exact source for the request.",
    references: ["batch", "context", "eval"],
  },
  "support-pilot": {
    observation: "The pilot had to meet p95 and per-resolution cost targets while keeping all disputed cases behind staff approval. It also needed a condition that stopped rollout after an incorrect closure.",
    implementation: "Compare model and workflow candidates against joint service constraints and measure cost per completed resolution. Keep decision authority as a deterministic gate outside the model. Name the owner and observable breach that pauses expansion. Review results for disputed cases separately from routine traffic.",
    transfer: "Use hard acceptance limits to eliminate otherwise attractive candidates. Look for authorized staffing, a monitored failure condition and a reversible rollout.",
    references: ["agents", "models", "eval"],
  },
  "public-permit-discovery": {
    observation: "You located the attachment bottleneck, kept permit issuance with staff and compared candidates by cost per resolution at the same service target before setting a limited rollout.",
    implementation: "Convert stakeholder needs into testable requirements. Measure where work waits before proposing a model change. Compare complete resolution costs including review and rework. Write the proposed scope, staff authority and disqualifying failure in the rollout decision.",
    transfer: "Ask what the sponsor is trying to improve, where the constraint occurs and which outcome the evidence supports. A fast response can leave the permit unresolved.",
    references: ["fluency", "agents", "eval"],
  },
  "library-retrieval-architecture": {
    observation: "You compared an exact archive ID with a paraphrased search, followed the evidence through each stage and saw how reranking improved an ambiguous result while putting blanket reranking over the latency limit.",
    implementation: "Keep stable identifiers, revision and access scope in the index. Exact or lexical matching can serve known identifiers, while semantic retrieval helps when wording differs. Rerank the candidate set where the measured lift warrants its added latency. Correlate retrieval and generation traces to see whether supporting evidence actually reached the model.",
    transfer: "If the right record never reaches the model, improve retrieval before tuning wording. Evaluate by query type and compare the quality gain with p95 at the full service boundary.",
    references: ["retrieval", "eval", "context"],
  },
  "professional-eval-gate": {
    observation: "You tested representative layouts and groups, put comparable traffic in control and candidate cohorts, and stopped promotion when escalation quality failed on a slice despite a higher overall score.",
    implementation: "Use code for checks such as format and required fields. Use an evidence-based rubric for judgment, measure agreement with independent human labels and audit disagreements. Run a canary with comparable assignment and predeclared stop conditions. Record drift and risk by slice over time.",
    transfer: "Ask whether the evaluation measures the downstream decision and whether the test can attribute a difference to the candidate. Inspect the vulnerable slice before accepting an aggregate improvement.",
    references: ["eval", "fluency"],
  },
  "market-scale": {
    observation: "You selected a candidate that met the workload envelope, placed the stable policy before request-specific data and used a matched comparison to verify that the waiver evidence stayed in context.",
    implementation: "Budget the request around current, necessary evidence and stable instructions. With explicit Claude prompt caching, the prefix must match through the cache breakpoint. Place that breakpoint at the end of eligible stable material before variable data, then check cache reads, elapsed time and quality on representative requests.",
    transfer: "When the prompt has grown or cache usage drops, identify which data changes per request and which evidence the model needs to make the decision. Measure latency and spend alongside decision quality.",
    references: ["models", "caching", "tokens", "context"],
  },
  "tenant-tools": {
    observation: "You chose the callers that could use each capability, kept the archive transfer on its existing interface and checked that a tenant could see only scoped records.",
    implementation: "Derive the tenant from authenticated server-side identity. Check permission before retrieval and execution. Scope both what the host discovers and what the endpoint can do. MCP can expose an authorized portability layer. A deterministic transfer can stay on the existing API if a model does not add value.",
    transfer: "Identify whether the question needs a shared callable capability or a fixed transport. Confirm identity, tenant selection, discovery and execution independently.",
    references: ["mcp", "mcpConfig", "auth"],
  },
  "community-controls": {
    observation: "You held the changed amount for matching approval, kept diagnostics limited to metadata, checked each stored copy for deletion, and left an unavailable result visibly uncertain.",
    implementation: "An approval record binds actor, target and proposed action, including a material parameter such as amount. A changed action needs a new matching approval. Trace data across input, output, storage and logs, and apply the relevant retention and deletion control at each store. Use diagnostic IDs to correlate events without copying case details.",
    transfer: "Look for the exact authorized action and follow retained copies through the system. A receipt confirms only the outcome and scope it records.",
    references: ["privacy", "hooks", "mcp"],
  },
  "regional-operations": {
    observation: "You staffed the manual queue while writes were unavailable, found the changed effective identity and prepared a versioned replay and named owner for the next shift.",
    implementation: "Diagnose the failing stage with the exact caller, deployment and trace. Keep reads available where they remain safe and route blocked writes to staffed operations. A runbook needs the reproduction, trigger, fallback, recovery owner and the last verified checkpoint. Share the review procedure under existing permissions and merge duplicate findings by evidence and contract.",
    transfer: "Read the incident and handoff together. Ask who can act now, which path still works, what the next operator can reproduce and what condition warrants rollback or a staffed workaround.",
    references: ["settings", "skills", "eval", "context"],
  },
};
