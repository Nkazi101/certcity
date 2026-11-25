import type { TrackId } from "./blueprints";
import type { PracticeItem } from "./items";

/** Each entry is ordered by the published July 2026 objective list for its domain. */
export const skillNotes: Record<TrackId, readonly (readonly string[])[]> = {
  "associate-foundations": [
    [
      "Specify the audience, the action they need to take, the approved inputs, the format, and what to do with missing evidence. Put source text in a clearly labeled section so its content is easy to distinguish from the task.",
      "Separate extraction, reconciliation, and writing. Ask for a table of claims with source IDs first. Resolve contradictions in the table before drafting from it.",
      "Change one instruction at a time. Keep an earlier input and a checklist of must-preserve facts to detect a regression when tone or length changes.",
      "Give brainstorming permission to vary ideas within constraints. Give fact extraction a narrow source set and an explicit way to mark unknowns. Review the outputs against different criteria.",
    ],
    [
      "Evaluate against a checklist of required fields and compare each fact to the source. A fluent sentence or working link can still omit the condition the reader needs.",
      "Check which people or cases an observation actually represents. Preserve the sample boundary and invite evidence from missing groups before writing a broader conclusion.",
      "Open the citation and verify the relevant passage, effective date, and population before using the claim. The source may be genuine while supporting a different statement.",
      "Route disputed or missing evidence to a named decision owner. Include the case, what you verified, and the specific decision they need to make.",
      "Start both versions from the same verified claim table. Change the vocabulary, order, examples, and call to action for each reader, then compare facts between versions.",
      "Use an editable Artifact for a distinct deliverable that staff will revise and a defined machine-readable structure for import. Validate the imported fields before running the workflow on more records.",
    ],
    [
      "A Project shares durable instructions and selected knowledge across its chats. Pick a standalone chat for isolated work, Research when evidence needs to be gathered across sources, and an Artifact when the output should be revised independently of the conversation.",
      "Compare Haiku, Sonnet, and Opus on representative examples of the task. A speed-oriented tier may fit routine labeling and a higher-capability tier may help resolve multi-source inconsistencies. Verify each with outputs you can judge.",
      "Compare total time and cost per acceptable result. Test routine and ambiguous inputs separately so low average cost does not hide extra review and corrections.",
      "When unrelated history interferes, begin a new chat with the verified case facts and their sources. Store durable instructions in the Project and current case details in the case itself.",
    ],
    [
      "Translate a proposed use into a measurable problem and an acceptance target. Keep the staff decision and the relevant constraints visible in the workflow.",
      "Map the actual stages and measure where completed and incomplete cases wait. Test an intervention at the dominant bottleneck before optimizing generation time.",
      "Compare how an intervention changes outputs on the same representative cases. Keep policies and approvals fixed so you can attribute changes to the intervention.",
      "Insert drafting where staff already review the source. Keep the owner’s approval before publication and capture corrections as evidence for the next revision.",
      "Report net effort, including review and rework, alongside output quality and remaining limitations. Separate observed pilot results from projections.",
    ],
    [
      "In a shared Project, put reusable behavior in project instructions and changing reference files in project knowledge. Open a fresh chat to verify both are available.",
      "Use connectors and uploaded knowledge scoped to the task. Confirm who can access each source upstream, and test both an approved reference and a restricted one.",
      "Write stable instructions about sources, audience, output structure, and what to do with uncertainty. Test the rule on a clean conversation and a borderline case.",
      "Remove superseded policy from active knowledge and keep it in the source system’s archive if needed. Verify a changed rule in a fresh chat before reopening the workflow.",
    ],
    [
      "Separate organizing evidence from making consequential decisions. Use cited facts to support the authorized reviewer, and keep decision and exception authority with that person.",
      "Minimize inputs before sending them to the approved workspace. Check handling requirements for direct identifiers and contextual details that could still identify someone.",
      "Verify that the current organization, data source, and purpose are approved. Technical connector access is one part of the review. The data owner defines the authorized use.",
      "Compare error rates across relevant groups or writing styles with matched evidence. Audit which downstream decisions a label influences, and review errors with the people affected.",
    ],
    [
      "Reproduce the error on matched old and new inputs while pinning the model and prompt. Change the input mapping after you identify the field that changed.",
      "Group reviewer corrections by cause and severity. Fix repeated factual errors at the source, then rerun affected cases before spending time on cosmetic edits.",
      "Version a shared template and measure omissions, approvals, and review effort over several runs. Reuse rules while keeping individual case facts isolated.",
    ],
  ],
  "developer-foundations": [
    [
      "Use application code for mandatory, ordered steps and deploy bounded agent discretion where the path varies. Check the gate at the service that performs the action.",
      "For client tools, keep the assistant message with its tool_use blocks, execute eligible calls, and append linked tool_result blocks in a user message before requesting the next turn.",
      "Give subagents isolated context and collection access. Specify what each worker returns, how to report partial failure, and how the coordinator reconciles gaps and contradictions.",
    ],
    [
      "Turn requirements into tests for deadline, completion, authorization, and allowed fallback. Break independent jobs out of a latency-sensitive path.",
      "Pin candidate configuration, test a labeled regression set, gate the release, and keep a deployable rollback. Observe slice outcomes after exposure before promoting.",
      "Use Messages for interactive work and Message Batches for independent, latency-tolerant work. Design streaming, visual inputs, thinking, and caching explicitly where applicable and test the selected platform.",
      "Join asynchronous results by stable IDs, make persistent writes idempotent, and retry only eligible failures. A request ID identifies the unit of work even when order or timing changes.",
      "Load authorized case context on each request using a verified identifier. Keep case history separate from durable configuration and run a misuse fixture for the adjacent case boundary.",
      "Record the resolved model and versioned prompt, rules, tools, dependencies and runtime settings with each trace. Compare the effective configuration across releases.",
    ],
    [
      "In Claude Code, shared conditional rules live in .claude/rules with matching paths. Compare a fresh checkout, a matching file, and an unrelated file before relying on repository-wide behavior.",
    ],
    [
      "Compare the provider’s accumulated message with events at each transport boundary. A byte chunk is not an SSE event boundary. Parse complete frames, preserve event order, and handle stream errors before marking output final.",
    ],
    [
      "Language model outputs vary across runs. Use representative repeated trials to choose settings and measure quality by slice. Keep output length, reasoning settings, and context limits in the experiment record.",
      "Use the platform SDK for the provider stream and translate events at the application backend when the browser uses another protocol. Authenticate the browser session before sending its events.",
      "Pin the evaluated model version and measure quality, p95 latency, and total cost on labeled cases. A cheaper route needs an evaluated fallback for cases it cannot handle.",
      "Count tokens before expensive work. Put stable instructions and source material before variable case data in a cacheable prefix, and inspect usage/cache-read fields after changing it.",
    ],
    [
      "Carry verified IDs and current state through compaction. Isolate unrelated case data, prune stale tool output, and keep exact facts linked to a durable source.",
      "Use examples that differ at the error boundary you need to teach, such as a blank versus an unreadable ID. Inspect success on cases outside the examples.",
      "Enforce output shape with structured outputs or the appropriate tool schema. Compare returned values with application authority and preserve discrepancies and missing fields separately.",
    ],
    [
      "Treat retrieved text as data. Keep instruction, authorization and secrets at trusted boundaries. Limit scope in the service and redact unneeded fields before model or logging access.",
      "Require verified approval at a shared endpoint for the specific action and caller. Narrow draft-only tool permissions upstream and replay a denied request through each caller path.",
      "Use pre-action hooks for checks that must run before tool execution. Resolve the actual resource boundary and enforce the same policy at the service.",
      "Keep a separate server-held credential for each environment and verify caller authorization independently. Plan revocation, rotation and audit records before enabling access.",
    ],
    [
      "Define tool inputs, outcomes and side effects precisely. Return structured errors when execution fails and distinguish them from completed queries with zero results.",
      "An MCP resource is an addressable piece of context. A tool performs parameterized work. Choose a transport and authorization model the client supports and test each capability through a real client session.",
      "Use a Skill for a repeatable procedure and a tool for an operation. A shared MCP server lets multiple clients discover a capability and call it with the same service contract.",
    ],
  ],
  "architect-foundations": [
    [
      "Branch the harness on stop_reason. For tool_use, preserve the assistant turn and append the matching tool_result before continuing. An end_turn without pending calls can finish the response.",
      "Give a coordinator the coverage plan and responsibility for reconciliation. Preserve finished work and reassign only the missing slice to a qualified worker.",
      "A worker with an isolated context needs its own inputs, scope, required output fields, and failure representation. Parallelize independent reads while keeping dependencies ordered.",
      "Make verification an application prerequisite for sensitive writes. Match actor, record, operation and approval before dispatch, and carry the relevant trace into a staffed handoff.",
      "Place a blocking check in PreToolUse and transform eligible successful output after execution. Keep the endpoint’s policy consistent if the tool can be reached by another caller.",
      "Split known changes from work with unknown dependencies. Discover callers first for shared contracts and run an integration pass after parallel work is combined.",
      "Resume from a relevant verified session for continuity. Fork when comparing independent alternatives from a common baseline, and keep their changes and evidence isolated.",
    ],
    [
      "Give tools distinct descriptions and name side effects. An informational request should reach a read tool whose advertised input, scope and output match the request.",
      "Separate successful empty results, tool execution errors with isError, protocol errors, and a disconnected client without a result. Add product-specific category and retryability where the caller needs them.",
      "Publish the smallest useful tool set to each agent role and enforce the same scope when the service executes. A UI label or prompt does not change tool authority.",
      "Share project MCP configuration with environment references to credentials. Keep personal experiments out of the repository and verify discovery from a clean checkout.",
      "Use search to locate references, read the relevant file for context, and make an exact scoped edit. Reserve shell use for operations that need it and keep the tool's access bounded.",
    ],
    [
      "Put shared engineering instructions in the repository’s Claude configuration. Keep personal preferences in user scope and check a teammate’s clean checkout.",
      "Package an on-demand procedure as a project Skill. Use a clear invocation, link the supporting example, and verify that the intended invocation method loads it.",
      "Use path-scoped .claude/rules for instructions that apply to a subset of files. Test matching files in each relevant tree and a nearby nonmatching file.",
      "Use plan mode to inspect unknown dependencies and agree on a risky change. A local low-risk edit with a known target can proceed directly with a focused check.",
      "Give concrete expected and actual behavior, disambiguating examples, and regression tests. A generic request to be robust does not identify the required behavior.",
      "Use noninteractive Claude Code for CI with bounded tool access and validated output. Keep reviewer context reproducible and post findings idempotently on retries.",
    ],
    [
      "Spell out the threshold and what to report around it. Include allowed and disallowed cases alongside severity and evidence requirements.",
      "Choose a small set of contrastive examples for the boundary that fails. Keep the correct field status visible and verify with examples the model has not seen.",
      "Enforce parsed types and required fields with the response contract. Use a separate comparison for reconciliation, limits, or validity against a trusted service.",
      "Use validator feedback when the source is legible and the format is repairable. Keep conflicting source claims separate and route unresolved facts to review.",
      "Isolate interactive work from independent asynchronous batches. Correlate results by custom_id and preserve successes when resubmitting eligible failures.",
      "Review high-impact changes in a fresh context with acceptance criteria, changed components and tests. Combine independent findings and deduplicate by evidence.",
    ],
    [
      "Store exact facts in durable state keyed by case or entity ID with source references. Load only the active subset after compaction.",
      "Honor an explicit request for a person and send useful context with the handoff. Ask a narrow clarifying question when a matching ambiguity can be resolved safely.",
      "Workers should return verified results, pending scope, errors and retry state. A coordinator should preserve partial evidence and disclose unchecked coverage.",
      "Persist inspected files, current hypotheses, confirmed findings and pending checks in a durable note. Reopen the smallest relevant code context to continue after compaction.",
      "Calibrate review on labeled outcomes and risk slices. Send known weak cases to review and sample accepted cases to catch confidently wrong outputs.",
      "Keep each claim tied to its source, population, period and method. Preserve contradictions or incomparable measures instead of blending them into a single assertion.",
    ],
  ],
  "architect-professional": [
    [
      "Find the operational bottleneck and express it as a baseline and acceptance condition. Align the first intervention with where the service actually loses time or quality.",
      "Draw the end-to-end data and decision flow with trust boundaries, action authority, error states and owners. Verify that worker output contains enough evidence for safe synthesis.",
      "Match fixed obligations to deterministic gates and variable research to bounded orchestration. Check which workflow steps can safely execute in parallel.",
      "Specify task boundaries, required evidence, failure state and conflict resolution for delegated workers. Limit worker access and keep coordination observable.",
      "Decompose work by decision and data dependency. Preserve independently verifiable outputs and require a cross-component test where responsibilities meet.",
      "Compare cost per resolved case, p95 latency, and quality for a measured workload, including retries, review and fallback. Gate a rollout on the full service envelope.",
    ],
    [
      "Compare model candidates under the same sources and workload. Optimize only within the quality, latency and cost thresholds agreed with owners.",
      "Label trusted policy separately from external evidence. Keep permission and approval checks in a deterministic service boundary before committing data or issuing actions.",
      "Use contrasting labeled examples for confusing categories and inspect missed cases. Keep examples current when source policy or the decision definition changes.",
      "Cache stable reusable context before variable inputs. Retrieve relevant exact state and preserve provenance while reducing unrelated context and measuring cache utilization.",
      "Version shared instruction and Skill assets alongside schema and tests. Record the applied version so service owners can reproduce behavior and roll back safely.",
    ],
    [
      "Expose capabilities required by the role and scope them to the verified task. Removing unrelated tools reduces authority and the context needed to choose among tools.",
      "Resolve identity and authorization on the server and scope each tool operation to the caller’s granted resources. Verify separation using both permitted and denied requests.",
      "Measure accuracy and tail latency on labeled slices. Route expensive retrieval or model steps to cases that need them and verify the cost and service budget under load.",
      "Join sanitized timing and status events with a request ID across services. Alert by operation and relevant slice without recording restricted source content.",
      "Chunk at meaningful document boundaries and carry section, revision, collection and source identifiers with each excerpt. Validate that retrieved passages can support the intended decision.",
      "Use lexical matching for exact identifiers and semantic retrieval for paraphrases where each has measured value. Combine candidates and compare by slice before expanding.",
      "Reuse a stable bulk interface for deterministic transfers and use a scoped discovery or reasoning interface where dynamic tool selection is required.",
      "Load capabilities as the task requires them. Apply authorization during discovery and again at execution. Review what remains visible when a task changes.",
    ],
    [
      "Set separate acceptance gates for accuracy, safety, cost, tail latency and service workload. Report critical regressions by slice so average improvement cannot hide them.",
      "Use deterministic graders for format and exact matches, calibrated human review for judgment, and labeled samples for unusual source types. Keep evaluation criteria stable while comparing versions.",
      "Use a controlled eligible rollout with a baseline and an explicit rollback rule. Record exposure, compare the vulnerable slices, and stop independently of headline gains.",
      "Trace a known case through ingestion, retrieval and the prompt. Swap one component or fixture at a time. Fix the earliest verified failure and rerun the case end to end.",
      "Compare matched deployments and measure cache reads, input tokens, time to first token, generation time and review cost. Optimize the measured cause within quality thresholds.",
      "Sample and label live input slices, including low-volume formats. Put monitoring and fallback ownership in the handoff so new drift triggers a concrete response.",
    ],
    [
      "Separate drafting and commitment. Validate the exact approval and actor before each sensitive action and record the decision at the service boundary.",
      "Walk the failure lifecycle for each dependency. Keep completed empty results, timeouts, stale evidence and permission failures distinguishable for staff and users.",
      "Design human review around authority, workload and evidence. Give reviewers the original evidence and proposed action, and make their decision attributable.",
      "Inventory all copies of restricted data, including diagnostics and derived outputs. Implement approved access and retention on each storage surface and test removal.",
      "Compare harms and error rates by affected cohort. Examine small or unusual groups explicitly and tell decision owners which conclusions the evidence can support.",
    ],
    [
      "Interview people who own service and policy outcomes. Agree on what the system may display or change at each step and capture those constraints in acceptance criteria.",
      "Put demonstrated results, assumptions, trade-offs, and stop conditions in the decision brief. Separate projections from observed outcomes and name the current uncertainty.",
      "Record measurable service objectives, the review cadence, incident owner and rollback trigger. Validate the plan with a replay before exposing live traffic.",
      "Version the architecture flow, configurations, contracts, failure fixtures, decision rationale and runbook. Verify that another operator can reproduce an incident from the release record.",
      "Hand off a staffed fallback, explicit trigger and ownership before launch. Check whether the team can detect the issue, change modes, and confirm safe recovery.",
    ],
    [
      "Use shared versioned team workflows with organizational restrictions enforced at their governing scope. Verify effective configuration in a clean checkout and in representative team environments.",
      "Assess changes spanning multiple components in an independent review and track repeat findings by identity and evidence. Measure quality and handling time against the existing workflow.",
      "Correlate the first failing stage with configuration and permission revisions. Reproduce a known-good case, compare with the failing trace, and repair the smallest responsible boundary.",
    ],
  ],
  // Decision rules from the CCDV-P lessons (guide v1.0), one per skill.
  "developer-professional": [
    [
      "Split work across agents only where the pieces are independent and reading-heavy, and make every handoff an explicit contract: what the worker receives, which tools it may use, what it must return, and how it reports failure.",
      "A long-running agent survives interruption only if its progress lives outside the context window: persist the session, checkpoint side effects as idempotent steps keyed by a stable ID, and treat a model version change as a new conversation boundary.",
      "Let production data move a system along the workflow-to-agent spectrum: convert paths that turn out to be fixed into code, give autonomy only where traces show the next step genuinely depends on what was found, and standardize the harness the team operates.",
      "Pick the context tool by what is filling the window and what must survive: clear stale tool results, compact when the conversation itself is near the limit, write durable facts to memory, defer large tool catalogs, and change instructions mid-conversation without breaking the cached prefix.",
    ],
    [
      "Classify every failure before reacting to it: back off and retry transient capacity errors, raise the output budget on length stops, route refusals through a refusal-specific path, fail fast on invalid requests, and stop retrying when a circuit breaker says the dependency is down.",
      "Find the binding constraint before you scale: requests per minute, uncached input tokens per minute, output tokens per minute, ramp limits, a tenant's share, or the price of real-time work that could wait for a batch.",
      "Treat prompts, models, MCP tool schemas and gateway configuration as versioned release artifacts: test each change against recorded production cases, roll it out progressively with a measured gate, and keep a rollback that takes seconds.",
      "Diagnose grounding failures stage by stage (indexing, retrieval, reranking, generation, citation) before changing anything, and pick agentic search or a retrieval pipeline by corpus size, freshness and the latency budget.",
    ],
    [
      "Instrument every model request, tool call and agent turn as spans in one trace with token, cache and cost attributes, and choose the content-capture mode per destination from the privacy rules, not from convenience.",
      "Define SLIs for what users experience (successful, grounded, on-time answers) as well as what the API returns, alert on error-budget burn rather than single spikes, and watch quality and cost signals specifically around model and prompt changes.",
      "Find systemic problems by grouping traces into cohorts and comparing failure rates across them, and sample so that the rare failing traces are kept while routine successes are thinned.",
    ],
    [
      "Locate a failure before fixing it: hold inputs fixed and replay, then test each layer in turn (data, tools, harness, model output) until the evidence shows where correct information stopped being correct.",
      "During an LLM incident, mitigate first with the fastest reversible lever (flag rollback, fallback route, degraded mode), communicate on a schedule, and close the incident only when the failure is a regression eval, a monitor and a postmortem action item.",
    ],
    [
      "Gate every prompt, model and agent change on a versioned suite that pairs a near-100% regression set with sliced capability tasks, graded by code where possible, and retire or refresh tasks before saturation and contamination make the score meaningless.",
      "A model judge earns gating authority only after it agrees with human labels on a held-out set at a level you agreed in advance, with position and verbosity bias controlled and the judge model pinned; until then it advises and humans decide.",
      "Measure live quality with a metric matched to the task type, sampled from real traffic and compared through a controlled experiment, and treat explicit user feedback as a biased signal that points you to cases rather than a score you can average.",
    ],
    [
      "Model cost per completed task from real usage fields, take the free wins first (cache hit rate, batch for work that can wait), then route by measured quality per tier, and enforce per-tenant budgets in the platform rather than in application code that a busy tenant can outrun.",
      "Split latency into time to first token and total time before changing anything, then fix the part the user waits on: stream and keep the prefix cached for a slow start, run independent tool calls in parallel and tune effort for a long finish, and use fast mode only where the measured gain justifies its price.",
    ],
    [
      "Size guardrails to the agent's risk profile, put deterministic enforcement in code at the point where an irreversible action executes, and use model-based filters as an additional layer whose false-positive and false-negative rates you measure and tune per slice.",
      "When an agent combines private data access, untrusted input and a way to communicate externally, assume injected text will steer it and remove or gate one leg of that combination in code; then prove the defense with red-team cases that target each path, not with a stronger system prompt.",
      "Give every workload and agent its own non-human identity with short-lived credentials from workload identity federation, grant each tool only the scope its task needs, keep secrets out of prompts and sandboxes, and log security-relevant actions against that identity.",
    ],
    [
      "Fan engineering work out only along seams where the pieces do not edit the same files, give each agent its own worktree and a verifiable definition of done, and plan the merge order before dispatch; then read fleet telemetry to find the failure mode instead of retrying individual agents.",
      "Introduce AI code review in shadow mode, measure its findings against what human reviewers and later incidents show, and give it merge-gating authority only for the finding classes where its precision is proven, while humans stay accountable for what merges.",
      "Run an unattended agent only with a verifiable completion condition, the narrowest tools and connectors the run needs, durable checkpoints, a bound on turns or spend, and a notification and escalation path for the moment it stops or needs a decision.",
      "Put organization policy in managed settings, which outrank every user and project file, lock the lists that matter (permission rules, hooks, MCP servers, marketplaces) to managed sources, deliver telemetry and gateway routing centrally, and admit shared prompts, Skills, plugins and MCP servers through a reviewed quality and safety bar.",
    ],
  ],
};

export function skillNote(track: TrackId, objective: PracticeItem["objective"]) {
  const [domain, skill] = objective.split(".").map(Number);
  return skillNotes[track][domain - 1]?.[skill - 1];
}
