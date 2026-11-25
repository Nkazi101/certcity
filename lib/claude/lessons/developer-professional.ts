import type { LessonSet } from "./types";

/**
 * Claude Certified Developer – Professional (CCDV-P), exam guide v1.0, effective November 2026.
 * One lesson per skill statement, in blueprint order (research/ccdv-p-exam-guide.md). Technical details were checked
 * against the Claude Platform, Claude Code, Agent SDK, MCP, OpenTelemetry and Google SRE pages listed in each lesson
 * on 2026-11-25. The CCDV-F scope is assumed knowledge, so these lessons start where the Foundations lessons stop.
 */
export const developerProfessionalLessons: LessonSet = {
  overview:
    "CCDV-P guide v1.0 (effective November 2026) is a 120-minute proctored exam of 70 scenario-based multiple-choice and multiple-response items: 60 are scored and 10 are unidentified unscored items, so treat every item as live. Each item states how many responses to select. The pass mark is a scaled 720 on a 100–1,000 scale and the fee is $175. Twenty-five skills sit in 8 domains: Advanced Agent Architecture and Orchestration 17%, Production Integration, Reliability, and Knowledge Grounding 20%, Observability and Production Monitoring 12%, Advanced Debugging and Incident Response 10%, Evaluation Engineering and Quality Assurance 12%, Cost and Latency Optimization at Scale 8%, Runtime Guardrails and Production Security 11%, and Agent Fleet Operations for Software Delivery 10%. The CCDV-F scope is assumed knowledge. Stems describe a running system and give you traces, usage data, judge-agreement numbers or red-team results; you pick the change that fixes the mechanism the evidence points to.",
  lessons: [
    {
      objective: "1.1",
      title: "Multi-Agent Orchestration",
      takeaway:
        "Split work across agents only where the pieces are independent and reading-heavy, and make every handoff an explicit contract: what the worker receives, which tools it may use, what it must return, and how it reports failure.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "In production, most multi-agent failures are handoff failures. A supervisor (orchestrator, coordinator, lead) decomposes a task and dispatches workers (subagents). Each worker runs in its own context window, so it knows only what the supervisor wrote into its brief, and the supervisor knows only what the worker wrote into its report. Anthropic's write-up of its multi-agent research system describes the cost side of this trade: parallel subagents with separate context windows let the system cover more ground, but multi-agent runs use many more tokens than single-agent chats, so the pattern pays off only on tasks whose value justifies that spend and that split into parallel, independent pieces.",
        },
        {
          kind: "text",
          text: "The two runtimes you will meet on the exam isolate context the same way. In the Claude Agent SDK, a non-fork subagent starts with a fresh conversation: its own system prompt plus the prompt string passed through the `Agent` tool, never the parent's history, and only its final message flows back. In Claude Managed Agents (beta), a `multiagent` block on the coordinator agent lists a roster; each delegated agent runs in its own session thread with its own history, model, system prompt and tools, while all threads share the session's container and filesystem. Threads persist, so the coordinator can send a follow-up to a worker it called earlier.",
        },
        {
          kind: "table",
          headers: ["Design decision", "Production default", "Failure it prevents"],
          rows: [
            ["What goes in the brief", "Stable identifiers (case ID, file paths), the decisions already made, the output schema", "A worker re-deriving context, picking a look-alike record, or answering the wrong question"],
            ["Tool scope per worker", "Only the tools the sub-task needs; read-only for research and review workers", "A reviewer that can write, or a reader that can send email"],
            ["Return contract", "Structured result with `status`, `source`, `error` and the echoed identifier", "The supervisor merging by text order or filling a gap with invented data"],
            ["Parallel dispatch", "Fan out only independent pieces; keep tightly coupled sequential edits in one context", "Two workers editing the same artifact with half the context each"],
            ["Model per role", "A capable model for planning and synthesis, a cheaper one (Haiku 5.5 or Sonnet 5.5) for bulk reading", "Paying top-tier rates for extraction-heavy reading"],
            ["Human approval", "Gate irreversible actions at the tool boundary, not inside a worker's prompt", "A worker deciding on its own that a refund or deletion is approved"],
          ],
        },
        {
          kind: "code",
          language: "python",
          caption: "Managed Agents coordinator with a cheaper read-only worker (beta; agents are created once and referenced by ID)",
          code: `worker = client.beta.agents.create(
    name="Claims document reader",
    description="Read-only. Give it one claim ID and the question; it reports findings with file paths.",
    model="claude-haiku-5-5",
    system="Answer only the question you are given. Cite a file path for every finding. "
           "If a file is missing or unreadable, set status to 'error' and say which.",
    tools=[{"type": "agent_toolset_20260401",
            "default_config": {"enabled": False, "permission_policy": {"type": "auto"}},
            "configs": [{"name": n, "enabled": True} for n in ("read", "glob", "grep")]}],
)
lead = client.beta.agents.create(
    name="Claims review lead",
    model="claude-opus-5-5",
    system="Delegate independent document questions to Claims document reader, one claim per spawn. "
           "Verify each report against the claim ID before merging.",
    tools=[{"type": "agent_toolset_20260401"}],
    multiagent={"type": "multiagent_20261001",
                "subagents": {"type": "enabled", "predefined_agents": [worker.id, {"type": "self"}],
                              "inline_agents": {"type": "disabled"}},
                "workflows": {"type": "disabled"}},
)`,
        },
        {
          kind: "text",
          text: "Inter-agent failures look like model failures in a transcript, so diagnose them at the boundary. If a worker's report contradicts its own tool results, the brief or the return contract is wrong. If the supervisor's final answer contains a fact no worker reported, the supervisor invented it, usually because a worker returned an empty or truncated report that the supervisor read as 'nothing found'. Make 'I could not read X' a first-class result value so the supervisor can retry, reassign or escalate instead of guessing. Approval flows belong in the same contract: in the Agent SDK use a `PreToolUse` hook or the `canUseTool` callback on the dangerous tool; in Managed Agents give that tool an `always_ask` permission policy, which pauses the session until a `user.tool_confirmation` event arrives.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems give you a symptom from merged output: duplicate findings, a record attached to the wrong customer, a fabricated value when one worker timed out, a worker that could write when it should only read. The right answer changes the handoff (identifiers in the brief, scoped tools, explicit error fields, merge by key). Distractors add a stronger instruction to the worker's prompt, give every worker every tool 'so they can cross-check', switch the supervisor to a bigger model, or raise the worker timeout, which reduces how often the gap appears without changing what happens when it does.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Splitting coupled work",
          text: "Fanning out sequential, tightly coupled steps (edit a schema, then update every caller) to parallel workers gives each worker half the picture and produces conflicting changes. Parallelize reading and independent analysis; keep coupled writes in one context or serialize them with an explicit plan the supervisor owns.",
        },
      ],
      terms: ["supervisor/worker", "subagent", "Agent tool", "AgentDefinition", "multiagent_20261001", "predefined_agents", "session thread", "always_ask", "user.tool_confirmation", "canUseTool", "PreToolUse"],
      sources: [
        ["Anthropic engineering: multi-agent research system", "https://www.anthropic.com/engineering/multi-agent-research-system"],
        ["Agent SDK: Subagents", "https://code.claude.com/docs/en/agent-sdk/subagents"],
        ["Managed Agents: multiagent orchestration", "https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration"],
        ["Managed Agents: permission policies", "https://platform.claude.com/docs/en/managed-agents/permission-policies"],
      ],
    },
    {
      objective: "1.2",
      title: "Durable Execution and State Management",
      takeaway:
        "A long-running agent survives interruption only if its progress lives outside the context window: persist the session, checkpoint side effects as idempotent steps keyed by a stable ID, and treat a model version change as a new conversation boundary.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "Durability has three layers, and production incidents usually come from treating one as another. The conversation is the transcript the model reasons over. The workspace is the files and external records the agent changed. Durable memory is what the agent wrote down for future sessions. Resuming a conversation does not undo file edits, and replaying a transcript does not re-run side effects safely unless each side effect was designed to be re-run.",
        },
        {
          kind: "table",
          headers: ["Runtime", "How a run resumes", "What persists where"],
          rows: [
            ["Agent SDK", "Capture `session_id` from the result message, then pass `resume` (or `continue` for the most recent session in the directory); `fork_session` / `forkSession` branches a copy", "Transcripts as JSONL under `~/.claude/projects/<encoded-cwd>/` on the machine that ran them; a `SessionStore` adapter mirrors them to shared storage for other hosts"],
            ["Managed Agents (beta)", "The session is a server-side object; send another event to an `idle` session, and sessions pin to an agent version", "Event history and the session container on Anthropic's side until the session is archived or deleted"],
            ["Messages API manual loop", "Your code reloads the stored messages and sends the full history again", "Wherever your application stores messages; you are the source of truth"],
            ["Message threads (beta)", "Best effort: a thread expires 5 minutes after its last request, so keep your own copy and replay it on `thread_not_found`", "Short-lived server copy plus your own copy"],
          ],
        },
        {
          kind: "text",
          text: "Checkpoint at side-effect boundaries. Before a step that writes (charge a card, file a claim, open a pull request), record an intent with an idempotency key derived from the business object, such as `claim-8812:submit`. After the step, record the outcome. On restart, the harness reads the checkpoint log, skips steps already completed, and re-issues pending ones with the same key so the downstream system deduplicates. The agent's transcript is a poor checkpoint store: a resumed agent that re-reads 'I will now submit the claim' may submit it again. The Agent SDK's file checkpointing can snapshot and revert the files the agent edited, but it does not reach a payment processor or a CRM.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Harness-side checkpointing around a write tool (application code, not an SDK feature)",
          code: `def run_step(store, run_id, step, tool, args):
    key = f"{run_id}:{step}"                  # stable across restarts
    record = store.get(key)
    if record and record["status"] == "done":
        return record["result"]               # replay the recorded result, do not re-execute
    store.put(key, {"status": "pending", "args": args})
    result = tool(**args, idempotency_key=key)  # downstream dedupes on the same key
    store.put(key, {"status": "done", "result": result})
    return result`,
        },
        {
          kind: "text",
          text: "Memory is the third layer. The client-side memory tool (`memory_20250818`) lets Claude read and write files under a `/memories` directory that your harness implements, so lessons and progress notes survive across sessions; validate paths so a write cannot escape that directory. Managed Agents offers memory stores for the same purpose. Keep durable memory small and factual (open items, decisions, identifiers) and keep secrets out of it.",
        },
        {
          kind: "text",
          text: "Model version change is the edge case the guide names. Every current model ID is a pinned snapshot, so an upgrade is a deliberate configuration change. Deprecation notices come at least 60 days ahead, and a retired model returns `404 not_found_error`. On Opus 5.5 and Sonnet 5.5, thinking blocks are tied to the model and the conversation: when a resumed session runs on a different model, the API drops blocks that model cannot read, so the agent continues without its earlier reasoning. Make the switch at a checkpoint, carry state through your own records or memory files, and run the migrated agent against recorded sessions before resuming live ones.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Look for 'the worker restarted', 'the container was recycled', 'the session resumed on another host', or 'after the upgrade the agent repeated a step'. Correct answers move state out of the context window: idempotency keys, a checkpoint log, a session store, memory files, resume by session ID. Distractors include a system-prompt line telling the agent not to repeat actions, a longer timeout so restarts happen less often, resuming the most recent session on a shared host (which may belong to another user), or replaying the full transcript to a new model unchanged.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Confusing conversation state with world state",
          text: "Forking or resuming an Agent SDK session branches the conversation, not the filesystem or external systems. A fork that edits files changes the same directory every other session sees, and a resumed run can repeat a payment the transcript already shows. Durable execution needs records the harness controls.",
        },
      ],
      terms: ["session_id", "resume", "continue", "fork_session", "SessionStore", "file checkpointing", "idempotency key", "memory_20250818", "/memories", "pinned snapshot", "not_found_error"],
      sources: [
        ["Agent SDK: Work with sessions", "https://code.claude.com/docs/en/agent-sdk/sessions"],
        ["Managed Agents: Sessions", "https://platform.claude.com/docs/en/managed-agents/sessions"],
        ["Memory tool", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool"],
        ["Preserved thinking", "https://platform.claude.com/docs/en/build-with-claude/preserved-thinking"],
        ["Model deprecations", "https://platform.claude.com/docs/en/about-claude/model-deprecations"],
      ],
    },
    {
      objective: "1.3",
      title: "Architecture Selection at Scale",
      takeaway:
        "Let production data move a system along the workflow-to-agent spectrum: convert paths that turn out to be fixed into code, give autonomy only where traces show the next step genuinely depends on what was found, and standardize the harness the team operates.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "At Foundations level you chose between a workflow and an agent for a new system. At Professional level the system is already running and you have evidence: cost per completed task, success rate by intent, p95 latency, the distribution of tool-call sequences, and incident history. The decision is whether to evolve it. Two directions are common. An agent whose traces show the same three tool calls in the same order for 90% of requests is paying for planning it does not need; the frequent path becomes a deterministic workflow, and the agent keeps the long tail. A workflow whose escalation queue keeps growing because branches cannot anticipate real cases may need an agentic step for the open-ended part.",
        },
        {
          kind: "table",
          headers: ["Evidence from production", "Likely move", "What to measure after"],
          rows: [
            ["Tool-call sequences are near-identical across most traces", "Hard-code the common path as a workflow; route only unusual cases to the agent", "Cost per completed task, success rate on the routed slice"],
            ["Agent skips or reorders a mandatory check in a few percent of runs", "Move the invariant step into code before or around the loop", "Violation count drops to zero, not just lower"],
            ["Workflow escalations rise as inputs diversify", "Add an agentic sub-step with read-only tools for investigation", "Escalation rate and reviewer load"],
            ["Cost per task rises with turns, quality flat", "Lower effort, trim tools with tool search, or split reading to a cheaper subagent", "Turns per task, tokens per task, quality on the eval suite"],
          ],
        },
        {
          kind: "text",
          text: "Harness selection is the second half of the skill. Four options run Claude agents, and they differ in who owns the loop and where tools execute. A manual Messages API loop gives full control and works on every platform. The SDK Tool Runner (`client.beta.messages.tool_runner`) runs the loop for tools you define, with per-turn hooks, on infrastructure you host. The Claude Agent SDK packages the Claude Code harness (built-in file, shell and search tools, hooks, subagents, sessions) for your own containers. Claude Managed Agents (beta) runs the loop and a per-session sandbox on Anthropic's side, with persisted, versioned agent configurations; it is offered on the Claude API, Claude Platform on AWS and Claude Models on Google Cloud (Anthropic managed), but not on Amazon Bedrock, Google-managed Vertex AI or Microsoft Foundry, and it is not eligible for zero data retention except in self-hosted deployments.",
        },
        {
          kind: "list",
          items: [
            "Platform constraint first: a team that must run on Bedrock or Foundry cannot standardize on Managed Agents, so the choice is a manual loop, the Tool Runner or the Agent SDK on its own hosts.",
            "Data constraint second: a ZDR or HIPAA requirement rules out features that are not eligible, which includes hosted Managed Agents.",
            "Operational constraint third: if nobody wants to run a sandbox, a session store and a scheduler, the managed runtime is the smaller system to own.",
            "Write the standard down: one harness per class of workload, shared tool definitions, shared hooks for policy, a shared eval gate. Reusable patterns (Skills, subagent definitions, MCP servers) get an owner and a version.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems give production numbers, such as 'per-task cost tripled while resolution rate stayed at 81%' or 'the agent called lookup, verify and draft in that order on 94% of tickets'. The best answer follows the data: make the stable path deterministic, keep autonomy for the variable remainder, and choose the harness the platform and data constraints allow. Distractors rebuild everything as a multi-agent system, switch to the largest model, keep the agent and add a prompt rule for the fixed order, or pick a managed runtime that the stated cloud platform does not offer.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Choosing by novelty",
          text: "Teams often move toward more autonomy because the agent demo was impressive, then pay for it in latency, tokens and new failure modes. Ask what the traces show. If the next step rarely depends on what the last one found, the system should become more deterministic, not less.",
        },
      ],
      terms: ["workflow", "agent", "Tool Runner", "client.beta.messages.tool_runner", "Claude Agent SDK", "Claude Managed Agents", "manual agent loop", "cost per completed task", "tool search"],
      sources: [
        ["Anthropic engineering: Building effective agents", "https://www.anthropic.com/engineering/building-effective-agents"],
        ["Managed Agents overview", "https://platform.claude.com/docs/en/managed-agents/overview"],
        ["Agent SDK: agent loop", "https://code.claude.com/docs/en/agent-sdk/agent-loop"],
        ["API and data retention", "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention"],
      ],
    },
    {
      objective: "1.4",
      title: "Context and Memory Architecture",
      takeaway:
        "Pick the context tool by what is filling the window and what must survive: clear stale tool results, compact when the conversation itself is near the limit, write durable facts to memory, defer large tool catalogs, and change instructions mid-conversation without breaking the cached prefix.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "A long-running agent hits one of two walls: the context window (1M tokens on current models) or a cost ceiling, which usually arrives first because every turn re-sends the history. Before choosing a fix, look at what the tokens are. A support agent that has run 40 tool calls is mostly old tool results. A coding agent on hour three is mostly conversation and reasoning. A platform agent with 300 MCP tools may spend tens of thousands of tokens on tool definitions before the user types anything.",
        },
        {
          kind: "table",
          headers: ["Mechanism", "What it does", "Use it when"],
          rows: [
            ["Context editing, `clear_tool_uses_20250919` (beta `context-management-2025-06-27`)", "Clears old tool results (optionally their inputs) once a threshold is reached; nothing is summarized", "Stale tool output dominates the window"],
            ["Context editing, `clear_thinking_20251015`", "Clears older thinking blocks", "Long reasoning history adds cost without adding value"],
            ["Compaction, `compact_20260112` (beta `compact-2026-01-12`)", "Summarizes earlier context server-side into a compaction block when input reaches the trigger (default 150K tokens)", "The conversation itself is approaching the limit"],
            ["Memory tool, `memory_20250818`", "Claude reads and writes files in a `/memories` directory your harness stores", "Facts must outlive the session or a compaction"],
            ["Tool search with `defer_loading: true`", "Tool schemas load only when Claude searches for them; search appends schemas, so the cached prefix holds", "Large tool catalogs, few tools used per request"],
            ["Mid-conversation `role: \"system\"` message", "Appends an operator instruction to `messages` instead of editing top-level `system`", "Instructions change mid-session and the cache must survive"],
          ],
        },
        {
          kind: "text",
          text: "Compaction has two production rules. First, append the whole `response.content` back to your messages, not just the text; the compaction block is what replaces the earlier history on the next request, and dropping it silently loses that state. Second, decide what must never be summarized away (an account ID, a signed-off decision, an open action) and either keep it in memory files or restate it after each compaction. A newer on-demand form exists under beta `compact-2026-09-04` with a top-level `compaction` parameter. Message threads (beta `message-threads-2026-08-12`) cannot be combined with compaction or most context editing, so pick one strategy per conversation.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Changing an instruction mid-session without rewriting the cached system prompt (Opus 5.5, Sonnet 5.5 and Haiku 5.5 support it; Sonnet 5 does not)",
          code: `messages.append({"role": "user", "content": customer_reply})
messages.append({
    "role": "system",
    "content": "The account is now in a billing dispute. Do not offer refunds; route refund requests to a human.",
})
response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=16000,
    system=[{"type": "text", "text": STABLE_POLICY, "cache_control": {"type": "ephemeral"}}],
    tools=TOOLS,              # unchanged list, same order: tools are part of the cached prefix
    messages=messages,
)`,
        },
        {
          kind: "text",
          text: "Cache safety is the thread through all of this. Prompt caching is a prefix match over tools, then system, then messages. Editing the system prompt, adding or removing a tool, or switching models mid-session invalidates everything after the change, and a top-level effort change invalidates the messages cache too. The cache-safe alternatives are a mid-conversation system message for new instructions, tool search for new tools, and a subagent (rather than a model switch) for work that suits a cheaper model.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems describe a long-running agent with usage numbers: input tokens per turn rising, `cache_read_input_tokens` falling to zero after a policy change, or a tool catalog of several hundred definitions. Match the mechanism to the evidence: stale tool output points to context editing, a conversation near the limit points to compaction plus memory for durable facts, a cache collapse after an instruction change points to a mid-conversation system message, a large catalog points to deferred tools. Distractors move to a model with a larger window (current models already have 1M), raise `max_tokens`, truncate the oldest messages in client code, or rewrite the system prompt each turn.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Deferring every tool, or editing history by hand",
          text: "Tool search needs at least one non-deferred tool; marking everything `defer_loading: true` returns a 400. Hand-editing earlier turns to save tokens is also risky on Opus 5.5 and Sonnet 5.5: history edits can invalidate thinking blocks, so use the API's context editing and compaction instead of rewriting messages yourself.",
        },
      ],
      terms: ["clear_tool_uses_20250919", "context-management-2025-06-27", "clear_thinking_20251015", "compact_20260112", "compact-2026-01-12", "memory_20250818", "defer_loading", "tool_search_tool_bm25_20251119", "mid-conversation system message", "cache_read_input_tokens", "message-threads-2026-08-12"],
      sources: [
        ["Context editing", "https://platform.claude.com/docs/en/build-with-claude/context-editing"],
        ["Compaction", "https://platform.claude.com/docs/en/build-with-claude/compaction"],
        ["Mid-conversation system messages", "https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages"],
        ["Tool search tool", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool"],
        ["Prompt caching", "https://platform.claude.com/docs/en/build-with-claude/prompt-caching"],
      ],
    },
    {
      objective: "2.1",
      title: "Reliability Engineering for Claude Services",
      takeaway:
        "Classify every failure before reacting to it: back off and retry transient capacity errors, raise the output budget on length stops, route refusals through a refusal-specific path, fail fast on invalid requests, and stop retrying when a circuit breaker says the dependency is down.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "A single 'retry on failure' wrapper is the most common reliability defect in Claude integrations, because several distinct outcomes look like failure to generic code. Some arrive as HTTP errors: 429 `rate_limit_error`, 529 `overloaded_error`, 500 `api_error`, 400 `invalid_request_error`. Others arrive as HTTP 200 with a `stop_reason` that means the answer is incomplete or absent: `max_tokens`, `model_context_window_exceeded`, `refusal`, `pause_turn`. Each class has a different correct response, and retrying the wrong class costs money without changing the outcome.",
        },
        {
          kind: "table",
          headers: ["Outcome", "What it means", "Correct handling", "What a blind retry does"],
          rows: [
            ["429 `rate_limit_error` with `retry-after`", "Over a rate or ramp limit", "Wait at least `retry-after`, retry with jitter, shed or queue load", "Retrying early earns another 429 and adds load"],
            ["429 with `error_code: enforced_spend_limit_reached`", "Monthly spend cap reached; no `retry-after`", "Stop and alert; no retry succeeds until access resumes", "Burns retries for hours"],
            ["529 `overloaded_error`, 500 `api_error`", "Transient service problem", "Exponential backoff with a retry budget; fall back to another model or region if it persists", "Fine once or twice; unbounded retries amplify an outage"],
            ["400 `invalid_request_error`", "The request itself is wrong", "Fail fast, log the request ID, fix the code", "Repeats the same 400 forever"],
            ["`stop_reason: max_tokens`", "Output hit your `max_tokens`", "Raise the budget or continue the response", "Reproduces the same truncation"],
            ["`stop_reason: model_context_window_exceeded`", "Input plus output filled the context window", "Treat as truncated; compact or trim context", "Same overflow on every attempt"],
            ["`stop_reason: refusal`", "A safety classifier declined; `stop_details` gives a category", "Refusal path: server-side `fallbacks` or the client-side fallback middleware; for `reasoning_extraction`, change the prompt; otherwise a safe reply or human handoff", "Same model declines again at full cost"],
          ],
        },
        {
          kind: "text",
          text: "The SDKs already retry: by default up to two retries for connection errors, timeouts, 408, 409, 429 and 5xx, honoring `retry-after` or backing off exponentially, unless the `x-should-retry` header says not to. Wrapping that in your own loop multiplies attempts, so a 2-retry SDK inside a 4-attempt wrapper can send 12 requests for one user action. Set `max_retries` deliberately and keep one retry layer. Add a circuit breaker per dependency (model, region, platform): after an error-rate threshold, stop sending traffic for a cool-down and serve a degraded response, such as a cached answer, a static help page or a queue-for-later message, instead of letting every request time out.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Branching on the outcome class (sketch; one retry layer, the SDK's)",
          code: `client = anthropic.Anthropic(max_retries=2)  # the only retry layer for transient errors

try:
    resp = client.messages.create(model="claude-opus-5-5", max_tokens=4096, messages=msgs)
except anthropic.RateLimitError as e:
    if e.body.get("error", {}).get("details", {}).get("error_code") == "enforced_spend_limit_reached":
        page_on_call("spend cap reached")          # no retry can succeed
    return degraded_reply(queue=True)
except anthropic.BadRequestError:
    raise                                        # fix the request; never retry
except anthropic.APIStatusError:
    breaker.record_failure("opus-primary")       # 5xx / 529 after SDK retries
    return fallback_or_degrade(msgs)

if resp.stop_reason == "max_tokens":
    resp = continue_with_budget(msgs, resp, max_tokens=16000)
elif resp.stop_reason == "model_context_window_exceeded":
    resp = retry_after_compaction(msgs)
elif resp.stop_reason == "refusal":
    return refusal_path(resp.stop_details)       # never the generic retry loop`,
        },
        {
          kind: "text",
          text: "Fallbacks must respect per-platform feature parity. Server-side refusal fallbacks (`fallbacks: \"default\"` with beta `server-side-fallback-2026-07-01`) exist on the Claude API and Claude Platform on AWS; on Bedrock, Vertex AI and Foundry use the SDK's client-side `BetaRefusalFallbackMiddleware`. Message Batches, the Files API and the Models API are not on Bedrock or Vertex AI, and `inference_geo` exists only on the Claude API and Claude Platform on AWS. A cross-platform fallback route that sends a request using one of those features to a platform without it turns an outage into a 400. Caches are model-scoped, so a cross-model fallback also pays full input price on its first requests.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "The stem mixes failure classes in one trace (rate limits, length stops and declines) and reports a cost spike or shorter answers after a change. The key branches on the stop condition or error class. Distractors raise the retry count or widen backoff (amplifies cost), route all traffic permanently to the fallback model (trades one failure for another), disable the fallback and return the first error (fail-total), or raise `max_tokens` for everything (fixes one class only).",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Treating refusals and length stops as transient",
          text: "Refusals and `max_tokens` stops arrive as HTTP 200, so error-only retry logic misses them, and generic 'retry on bad output' logic retries them unchanged. Check `stop_reason` before reading `content`, and keep refusals out of the generic retry path.",
        },
      ],
      terms: ["rate_limit_error", "overloaded_error", "retry-after", "x-should-retry", "max_retries", "stop_reason", "model_context_window_exceeded", "refusal", "stop_details", "server-side-fallback-2026-07-01", "BetaRefusalFallbackMiddleware", "enforced_spend_limit_reached", "circuit breaker"],
      sources: [
        ["API errors", "https://platform.claude.com/docs/en/api/errors"],
        ["Handling stop reasons", "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons"],
        ["Refusals and fallback", "https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback"],
        ["Rate limits", "https://platform.claude.com/docs/en/api/rate-limits"],
      ],
    },
    {
      objective: "2.2",
      title: "Scale and Throughput Management",
      takeaway:
        "Find the binding constraint before you scale: requests per minute, uncached input tokens per minute, output tokens per minute, ramp limits, a tenant's share, or the price of real-time work that could wait for a batch.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "Rate limits on the Messages API are measured per model class in requests per minute (RPM), input tokens per minute (ITPM) and output tokens per minute (OTPM), enforced with a token bucket that refills continuously, so short bursts can trip a limit that the per-minute average would not. Two details change capacity planning. ITPM is cache-aware: `input_tokens` and `cache_creation_input_tokens` count, `cache_read_input_tokens` does not, so raising the cache hit rate raises effective input throughput without a limit increase. OTPM counts tokens actually generated, so a large `max_tokens` has no rate-limit cost.",
        },
        {
          kind: "table",
          headers: ["Symptom in telemetry", "Binding constraint", "Lever"],
          rows: [
            ["429s with low token use, many small requests", "RPM", "Batch small items per request, queue and smooth arrivals"],
            ["429s when long documents arrive; low cache read share", "ITPM (uncached input)", "Cache the stable prefix; move context-heavy work to batch"],
            ["429s during long generations", "OTPM", "Shorter outputs, cheaper model for drafts, spread load"],
            ["429 with `error_code: ramp_limit_exceeded` after a launch or nightly job start", "Ramp limit on sharp increases", "Start bulk jobs slowly and grow at most one step per minute"],
            ["One tenant's spike degrades everyone", "Shared organization limit", "Per-workspace rate and spend limits, per-tenant queues"],
            ["Overnight backlog on the real-time path", "Batch economics", "Message Batches: 50% price, asynchronous, own limits, no ramp limit"],
          ],
        },
        {
          kind: "text",
          text: "Backpressure keeps a surge from becoming an outage. Put a queue in front of the model call, bound it, and decide per priority class what happens when it is full: interactive requests get a fast degraded answer, background work waits. Read the `anthropic-ratelimit-*-remaining` headers to slow down before the 429s start, and treat `retry-after` as a floor. Limits are shared across `inference_geo` values, so splitting traffic between `us` and `global` does not add capacity.",
        },
        {
          kind: "text",
          text: "Multi-tenant isolation uses workspaces. You can set rate and spend limits for each workspace below the organization's, which keeps one customer's import job from consuming another's interactive headroom; organization-wide limits still apply even if workspace limits add up to more. Per-tenant quotas inside a workspace are application logic: meter tokens per tenant from `usage`, enforce budgets before dispatch, and report which tenant was throttled.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Moving deferrable work to Message Batches (results return in any order; join on custom_id)",
          code: `batch = client.messages.batches.create(requests=[
    {"custom_id": f"policy-{p.id}", "params": {
        "model": "claude-sonnet-5-5", "max_tokens": 2048,
        "system": [{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": p.text}],
    }} for p in nightly_policies
])
# Poll processing_status until "ended", then stream results and import by custom_id:
# succeeded -> import idempotently; errored -> fix and resubmit; expired -> resubmit as is.`,
        },
        {
          kind: "text",
          text: "Batch facts worth having exactly: half the standard price, most batches finish within an hour, unfinished requests expire after 24 hours, results stay available for 29 days, up to 100,000 requests (or 256 MB) per batch, and the Batches API has its own RPM and queue limits separate from the Messages API. Batches are not available on Bedrock, Vertex AI or Foundry.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems give a mix of workloads and limit evidence ('ITPM at 98% while cache reads are 4% of input', 'a 40,000-document import started at 01:00 and live chat p95 rose to 14 s'). The key names the binding constraint and its lever. Distractors request a higher tier when caching or batching would solve it, add retries (more load on the same limit), split traffic across `inference_geo` values, or put the interactive path on Batches and poll faster.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Reading a spend cap as a rate limit",
          text: "Both return 429 `rate_limit_error`, but the spend-cap response has no `retry-after` and carries `enforced_spend_limit_reached`. A spend limit you set yourself returns 400 instead. Backoff logic that treats all three alike retries requests that cannot succeed until the month or the limit changes.",
        },
      ],
      terms: ["RPM", "ITPM", "OTPM", "token bucket", "cache_read_input_tokens", "ramp_limit_exceeded", "anthropic-ratelimit-tokens-remaining", "workspace limits", "Message Batches API", "custom_id", "backpressure"],
      sources: [
        ["Rate limits", "https://platform.claude.com/docs/en/api/rate-limits"],
        ["Message Batches", "https://platform.claude.com/docs/en/build-with-claude/batch-processing"],
        ["Workspaces", "https://platform.claude.com/docs/en/manage-claude/workspaces"],
      ],
    },
    {
      objective: "2.3",
      title: "Production MCP and Change Management",
      takeaway:
        "Treat prompts, models, MCP tool schemas and gateway configuration as versioned release artifacts: test each change against recorded production cases, roll it out progressively with a measured gate, and keep a rollback that takes seconds.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "A production Claude system changes in four places that application deploys do not cover: the prompt, the model ID, the tools (including MCP servers you do not own), and the routing layer between your code and the API. Each can break behavior without a compile error, so each needs a version, a test, a staged rollout and a rollback.",
        },
        {
          kind: "text",
          text: "Remote MCP servers in production run over the Streamable HTTP transport, where each message is an HTTP POST to a single MCP endpoint. Authorization for HTTP transports follows OAuth 2.1: the server publishes OAuth 2.0 Protected Resource Metadata (RFC 9728) so clients can discover its authorization server, clients send a `resource` parameter (RFC 8707) naming the server, and the server must accept only tokens issued for it. Passing a client's token through to a downstream API is forbidden, because the server must not accept or transit tokens meant for other resources. stdio servers take credentials from the environment instead.",
        },
        {
          kind: "table",
          headers: ["Change", "How it breaks production", "Control"],
          rows: [
            ["MCP tool renamed or a required parameter added", "Agents call the old shape and get errors, or the model picks a different tool", "Version tool schemas, add new tools alongside old ones, retire after traffic moves"],
            ["MCP tool description edited", "Tool selection shifts silently", "Run the tool-selection eval on every description change"],
            ["Model ID upgrade", "Breaking API changes (forced `tool_choice` and disabled thinking return 400 on Opus 5.5) and behavior shifts", "Migration test on recorded traffic; re-run effort sweeps; pin the new ID"],
            ["Prompt edit", "One slice regresses while the aggregate holds", "Versioned prompt config, slice-level gates, flag-based rollback"],
            ["Gateway or routing change", "Requests reach a platform that lacks a feature, or headers are stripped", "Parity tests per route; per-platform configuration checked in"],
          ],
        },
        {
          kind: "text",
          text: "Model migrations deserve their own test plan. Model IDs are pinned snapshots; a deprecation gives at least 60 days of notice, and after retirement requests return 404. The Opus 5.5 migration is a good example of breaking behavior: thinking cannot be disabled, forced `tool_choice` of `any` or `tool` returns a 400, default effort is `medium` rather than `high`, and thinking blocks are tied to the model. A migration test replays a stratified sample of production requests through the new model, checks API acceptance first, then compares task metrics per slice, then compares cost and latency at the effort level you intend to ship.",
        },
        {
          kind: "code",
          language: "yaml",
          caption: "A prompt and model release record that a flag service can switch at runtime (application convention)",
          code: `release: claims-triage
prompt_version: v19            # previous: v18, kept deployable
model: claude-sonnet-5-5       # pinned ID
effort: medium
mcp_servers:
  - name: policy-lookup
    url: https://mcp.internal.example/policy/mcp
    tool_schema_version: 3
rollout:
  stages: [1, 5, 25, 100]      # percent of tenants
  gate:
    golden_set_min: 0.92
    slice_min: { coverage_disputes: 0.88, pediatric_claims: 0.90 }
    p95_latency_ms_max: 4500
  rollback: flag claims-triage.prompt_version=v18`,
        },
        {
          kind: "text",
          text: "Gateways sit between applications and the API to centralize keys, routing, logging and budgets. The SDKs and Claude Code read `ANTHROPIC_BASE_URL`, so pointing a fleet at a gateway is a configuration change. The parity risk is that each route (first-party API, Claude Platform on AWS, Bedrock, Vertex AI, Foundry) supports a different feature set, so a gateway that fails over from one platform to another must know which requests can move. Keep per-platform configuration in version control and test each route with the features the application actually uses.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Expect a release that passed an aggregate eval and then hurt one customer segment, a model upgrade that started returning 400s, or an MCP server that changed a tool and broke three agents. The answer combines versioning, a test that would have caught the specific break, staged rollout and fast rollback. Distractors redeploy the whole application to roll back a prompt, raise the aggregate threshold, pin nothing and rely on the vendor's default model, or forward the user's OAuth token to downstream APIs.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Shipping prompts inside the application bundle",
          text: "When prompts ship with code, a bad prompt needs a full redeploy to revert, and prompt changes ride along with unrelated code changes. Store prompts as versioned configuration selected at runtime so operations can switch back in seconds.",
        },
      ],
      terms: ["Streamable HTTP", "OAuth 2.1", "Protected Resource Metadata", "resource parameter", "token passthrough", "pinned model ID", "model deprecation", "progressive rollout", "prompt versioning", "ANTHROPIC_BASE_URL"],
      sources: [
        ["MCP specification: Transports", "https://modelcontextprotocol.io/specification/2026-07-28/basic/transports"],
        ["MCP specification: Authorization", "https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization"],
        ["Model deprecations", "https://platform.claude.com/docs/en/about-claude/model-deprecations"],
        ["Opus 5.5 migration guide", "https://platform.claude.com/docs/en/models/opus-5-5/migration-guide"],
      ],
    },
    {
      objective: "2.4",
      title: "Retrieval and Knowledge Grounding at Scale",
      takeaway:
        "Diagnose grounding failures stage by stage (indexing, retrieval, reranking, generation, citation) before changing anything, and pick agentic search or a retrieval pipeline by corpus size, freshness and the latency budget.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "Knowledge grounding has two architectures. In a retrieval pipeline (RAG), your code retrieves passages and places them in the prompt before Claude answers. In agentic search, Claude calls search tools itself, reads results and decides whether to search again. Agentic search handles multi-hop questions and changing sources better and costs more turns and latency; a pipeline is cheaper and faster when one retrieval usually suffices. For knowledge bases under about 200,000 tokens, Anthropic's retrieval guidance says to skip retrieval and include the whole corpus in a cached prompt.",
        },
        {
          kind: "text",
          text: "Anthropic's Contextual Retrieval study shows what each retrieval improvement is worth on its benchmarks. Prepending 50 to 100 tokens of chunk-specific context before embedding cut top-20 retrieval failures by 35%. Adding the same context to a BM25 keyword index (hybrid search) cut them by 49%. Adding a reranking step cut them by 67%. Generating the context cost about $1.02 per million document tokens with prompt caching. Hybrid search matters for exact identifiers (policy numbers, drug codes, error codes) that embeddings blur.",
        },
        {
          kind: "table",
          headers: ["Stage", "Failure signal", "Fix at that stage"],
          rows: [
            ["Ingestion and chunking", "The answer exists but spans two chunks, or a table lost its header", "Structure-aware chunking, overlap, chunk context"],
            ["Retrieval", "The right document is not in the top-k for questions with exact identifiers", "Hybrid BM25 plus embeddings, query rewriting"],
            ["Reranking", "The right chunk is retrieved at rank 15 and cut before the prompt", "Rerank a larger candidate set, then keep the top few"],
            ["Generation", "The right chunk is in the prompt, the answer contradicts it", "Quote-first prompting, citations, a groundedness check"],
            ["Citation and confidence", "Answers cite passages that do not support them, or never say 'not found'", "Validate cited text against sources; allow and reward an explicit 'not in the sources' answer"],
          ],
        },
        {
          kind: "text",
          text: "Grounding practices make failures visible. With `citations: {enabled: true}` on document blocks, responses carry `citations` with `cited_text` and a location, which your code can verify against the source. Citations cannot be combined with `output_config.format` (a 400), so a pipeline that needs both structured output and citations runs them as separate steps or validates quotes in code. Uncertainty declaration is a prompt and product decision: tell Claude it may answer 'the policy documents do not cover this' and measure how often it does when the answer is absent. Confidence signals derived from evidence (number of supporting passages, retrieval score margins, whether cited text matches) are more reliable than a model's self-reported confidence.",
        },
        {
          kind: "code",
          language: "json",
          caption: "A retrieval trace record that supports stage-by-stage diagnosis",
          code: `{
  "query_id": "q-55102",
  "question": "Is ambulance transport covered for out-of-network plans?",
  "retrieved": [{"doc": "plan-2026-oon.pdf#p14", "rank": 1, "bm25": 12.1, "cosine": 0.71},
                {"doc": "plan-2025-oon.pdf#p12", "rank": 2, "bm25": 11.8, "cosine": 0.73}],
  "reranked_kept": ["plan-2025-oon.pdf#p12"],
  "cited": [{"doc": "plan-2025-oon.pdf#p12", "cited_text_matches_source": true}],
  "answer_supported_by_current_policy": false
}`,
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems give a grounding failure with partial trace evidence, like the trace above where the current-year document was retrieved first but the reranker kept last year's. The right answer fixes the stage the evidence implicates (here, reranking and document freshness metadata). Distractors switch to a larger model, enlarge the context window, add 'only use current documents' to the prompt, or re-embed the whole corpus when the retrieval stage was already working.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Measuring only the final answer",
          text: "End-to-end accuracy tells you that grounding failed, not where. Without per-stage measures (retrieval recall at k, rerank precision, groundedness of the answer against cited text) teams tune prompts for problems that live in the index.",
        },
      ],
      terms: ["RAG", "agentic search", "Contextual Retrieval", "BM25", "hybrid search", "reranking", "citations", "cited_text", "output_config.format", "groundedness"],
      sources: [
        ["Anthropic engineering: Contextual Retrieval", "https://www.anthropic.com/engineering/contextual-retrieval"],
        ["Citations", "https://platform.claude.com/docs/en/build-with-claude/citations"],
        ["Reduce hallucinations", "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations"],
      ],
    },
    {
      objective: "3.1",
      title: "Telemetry and Instrumentation",
      takeaway:
        "Instrument every model request, tool call and agent turn as spans in one trace with token, cache and cost attributes, and choose the content-capture mode per destination from the privacy rules, not from convenience.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "An agent loop is a distributed system: your service, the Claude API, MCP servers and internal tools. Debugging it needs distributed traces that join those hops. The Claude SDKs and the Claude API can both emit OpenTelemetry spans (beta), and the attributes follow the OpenTelemetry GenAI semantic conventions (`gen_ai.*`), so most observability backends read them without custom mapping.",
        },
        {
          kind: "table",
          headers: ["Source", "Where spans come from", "What only this source sees"],
          rows: [
            ["SDK tracing", "Emitted in your process by the SDK and exported by your own OpenTelemetry setup; works with every platform's client", "Client tools run by a tool runner, tools in a self-hosted sandbox, file uploads and other non-Messages requests"],
            ["API tracing", "Emitted server-side to a destination an organization admin adds through the Admin API or the Console; Claude API and Claude Platform on AWS only", "Each model request inside one API request, server tools and MCP connector tools, Managed Agents turns"],
          ],
        },
        {
          kind: "text",
          text: "Use both where you can: when the SDK sends `traceparent`, the API's spans nest under the SDK span of the same request. A Messages request shows up as an `anthropic.messages.create` span (CLIENT from the SDK, SERVER from the API) with `anthropic.model_request`, tool and `anthropic.compaction` children. Token attributes include `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read.input_tokens` and `gen_ai.usage.cache_write.input_tokens`. Note that the span's input count includes cache reads and writes, while the Messages API response's `usage.input_tokens` excludes them; when you compute total input from a response, add `cache_read_input_tokens`, `cache_creation_input_tokens` and `input_tokens`. Sum one source per request so tokens are counted once.",
        },
        {
          kind: "list",
          items: [
            "Content mode: `metadata_only` is the default (identifiers, timing, status, token counts). `content` adds prompts and responses, needed for reading conversations or building evals from traces. SDK clients set it with `ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE=content` or the client option.",
            "Privacy: the backend stores captured content under its own retention and access rules. Zero data retention does not limit the content mode (the API holds exported content only in memory while delivering it), so ZDR alone does not keep prompts out of your vendor's storage. Organizations with HIPAA, FERPA or K-12 restrictions get metadata only from API destinations.",
            "Never put personal data in `conversation_id`; it is exported in both modes.",
            "Cache performance: track cache read share per route, and on the first-party API use cache diagnostics (beta `cache-diagnosis-2026-04-07`, `diagnostics: {previous_message_id: ...}`) to see why a prefix missed.",
            "Grounding and reasoning traceability: record which documents were retrieved, which were cited, and the request ID (`request-id` header) for each step, so an answer can be traced to its evidence.",
          ],
        },
        {
          kind: "code",
          language: "bash",
          caption: "Claude Code fleet telemetry through managed settings (repository settings cannot change exporters or capture content)",
          code: `# managed-settings.json "env" block, shown as shell exports
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.internal.example:4317
# Content stays redacted unless these are set on purpose:
# OTEL_LOG_USER_PROMPTS=1   OTEL_LOG_TOOL_DETAILS=1   OTEL_LOG_RAW_API_BODIES=1`,
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems pair a debugging need with a privacy rule: 'engineers cannot tell which tool call failed', 'PHI must not leave the tenant', 'the vendor keeps logs for 13 months'. The key captures structure (spans, token and cost attributes, request IDs) everywhere and content only where policy allows. Distractors log full prompts to the vendor because ZDR is on, add print statements around the API call, capture nothing to stay safe (undebuggable), or put a patient ID in the conversation ID to make traces searchable.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Double counting tokens",
          text: "A request traced by both the SDK and the API carries usage on several spans. Summing every span with `gen_ai.usage.input_tokens` counts the same tokens two or three times and inflates cost dashboards. Use the API spans when both exist, and do not add cache attributes to a span input count that already includes them.",
        },
      ],
      terms: ["OpenTelemetry", "gen_ai.usage.input_tokens", "anthropic.messages.create", "anthropic.model_request", "traceparent", "metadata_only", "ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE", "cache_creation_input_tokens", "cache-diagnosis-2026-04-07", "CLAUDE_CODE_ENABLE_TELEMETRY", "OTEL_LOG_USER_PROMPTS"],
      sources: [
        ["OpenTelemetry for the Claude API", "https://platform.claude.com/docs/en/manage-claude/opentelemetry"],
        ["OpenTelemetry span reference", "https://platform.claude.com/docs/en/api/opentelemetry/spans"],
        ["Cache diagnostics", "https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics"],
        ["Claude Code monitoring", "https://code.claude.com/docs/en/monitoring-usage"],
      ],
    },
    {
      objective: "3.2",
      title: "Production Monitoring and Alerting",
      takeaway:
        "Define SLIs for what users experience (successful, grounded, on-time answers) as well as what the API returns, alert on error-budget burn rather than single spikes, and watch quality and cost signals specifically around model and prompt changes.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "An LLM service can return HTTP 200 on every request and still fail its users. So the service level indicators need two kinds of signal: availability and latency from the request path, and quality from evaluation of the output. A support assistant might carry four SLIs: the share of requests answered without error, p95 time to first token, the share of sampled answers judged grounded by a calibrated grader, and the share of conversations escalated to a human. The SLO is the target for each over a window, and the error budget is what the target leaves over.",
        },
        {
          kind: "table",
          headers: ["SLI", "Measured from", "Example SLO (30 days)"],
          rows: [
            ["Successful responses", "Requests ending in `end_turn` or `tool_use` without an API error, over all requests", "99.5%"],
            ["Time to first token", "Request sent to the first streamed content delta, p95", "under 1.5 s"],
            ["Grounded answers", "Calibrated judge on a daily random sample of production answers", "at least 95%"],
            ["Refusal rate", "Responses with `stop_reason: refusal`, by `stop_details` category", "Alert on change from baseline, not a fixed target"],
            ["Cost per resolved conversation", "Summed usage times price, over resolved conversations", "Within 15% of the forecast"],
          ],
        },
        {
          kind: "text",
          text: "Alert on burn rate. The Google SRE workbook recommends multiwindow, multi-burn-rate alerts as a starting point for a 99.9% SLO: page when the burn rate is 14.4 over 1 hour (confirmed over 5 minutes), which consumes 2% of the 30-day budget; page at burn rate 6 over 6 hours (30-minute short window), 5% of budget; open a ticket at burn rate 1 over 3 days (6-hour short window), 10% of budget. Both windows must exceed the threshold, so the alert stops soon after the errors stop. This gives fast paging on real outages and fewer pages on brief blips than a raw error-rate threshold.",
        },
        {
          kind: "list",
          items: [
            "Token and cost telemetry: dashboard input, output, cache read and cache write tokens per route and per tenant. A drop in cache read share is often the first sign that a deploy put something variable ahead of a cache breakpoint.",
            "Anomalous usage: alert when one API key, tenant or agent exceeds its usual tokens per hour by a large factor; runaway loops and abuse look the same at first.",
            "Drift after model updates: annotate dashboards with model, prompt and tool-schema versions, and compare quality SLIs before and after each change on the same intent mix.",
            "Behavioral regressions: track output length, tool-call count per task, refusal categories and escalation rate per version. A change in any of them after a release deserves a look even when error rates are flat.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems describe dashboards that stayed green during a quality incident ('HTTP success 99.97%, but complaints doubled after Tuesday's model update') or alerts that page on every brief spike. The key adds a quality SLI from sampled evaluation, version annotations, or burn-rate alerting. Distractors add more infrastructure metrics, lower the paging threshold so it fires sooner, alert on every refusal, or rely on user thumbs-down alone.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Only monitoring what the API reports",
          text: "Availability and latency are necessary but not enough. A model or prompt change can make answers less grounded, longer or more cautious while every request succeeds. Without a sampled quality SLI tied to versions, the first signal is customer complaints.",
        },
      ],
      terms: ["SLI", "SLO", "error budget", "burn rate", "multiwindow alert", "time to first token", "refusal rate", "cost per resolved conversation", "drift"],
      sources: [
        ["Google SRE workbook: Alerting on SLOs", "https://sre.google/workbook/alerting-on-slos/"],
        ["Claude Code monitoring", "https://code.claude.com/docs/en/monitoring-usage"],
        ["Handling stop reasons", "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons"],
      ],
    },
    {
      objective: "3.3",
      title: "Trace Analysis at Scale",
      takeaway:
        "Find systemic problems by grouping traces into cohorts and comparing failure rates across them, and sample so that the rare failing traces are kept while routine successes are thinned.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "One trace shows what happened to one request. Systemic issues, such as a tool that times out only for one region, a prompt version that doubles turns for one intent, or a cache that misses only for tenants with long custom instructions, appear only when thousands of traces are aggregated and compared. The skill is choosing what to keep, how to group, and which comparison isolates the cause.",
        },
        {
          kind: "table",
          headers: ["Sampling approach", "How it decides", "Trade-off"],
          rows: [
            ["Head sampling", "At the start of the trace, for example keep 5% of trace IDs", "Cheap and simple, but cannot guarantee that traces containing errors are kept"],
            ["Tail sampling (OpenTelemetry Collector Tail Sampling Processor)", "After most spans arrive, using errors, latency or attributes", "Keeps every error and slow trace; harder to run and needs buffering"],
            ["Stratified sampling for evaluation", "Fixed quota per intent, tenant or version", "Keeps rare segments represented in quality review"],
          ],
        },
        {
          kind: "text",
          text: "Failure-cohort analysis follows a repeatable pattern. Define the failure precisely, for example 'conversation escalated after an agent turn with an `is_error` tool result'. Tag each trace with candidate dimensions: model and prompt version, tool and MCP server version, tenant, region, intent, input length bucket, cache hit, turn count. Compare the failure rate in each cohort with the baseline and look for the dimension where the difference concentrates. Then confirm with a controlled replay before you fix anything, because cohorts correlate (a large tenant may also be the only one on the new region).",
        },
        {
          kind: "code",
          language: "text",
          caption: "Cohort table built from one week of traces (failure = answer later corrected by an agent)",
          code: `cohort                         traces   failures   rate
all                            182,400     2,920   1.6%
prompt v41                      91,100     1,470   1.6%
prompt v42                      91,300     1,450   1.6%
mcp policy-lookup v3           120,800       690   0.6%
mcp policy-lookup v4            61,600     2,230   3.6%   <- concentrated
  v4 + tool result truncated    18,900     1,980  10.5%
  v4 + not truncated            42,700       250   0.6%`,
        },
        {
          kind: "text",
          text: "The table points at the v4 MCP server and, inside it, at truncated tool results, not at the prompt change everyone suspected. Aggregation also quantifies impact for prioritization: 1,980 of 2,920 failures (68%) sit in one cohort. Keep sums honest by counting tokens and requests once per trace (the API and SDK can both emit usage), and group Managed Agents spans by `anthropic.session.id` or `gen_ai.conversation.id` because a session can span several traces.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems report a failure rate that is 'small but steady' or invisible in individual traces, plus a sampling setup. The key either changes sampling to keep the failures (tail sampling on errors, stratified quotas) or groups traces by the dimension that isolates the cause. Distractors read more individual traces by hand, raise head sampling to 100% (cost explodes, the analysis does not change), roll back the most recent change without evidence, or average across all traffic.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Head sampling the evidence away",
          text: "At 1% head sampling, a failure that affects 0.2% of requests leaves only a handful of traces a day, often without the attributes needed to group them. Keep errors and slow traces with tail sampling, and add the cohort attributes (versions, tenant, intent) to spans at write time.",
        },
      ],
      terms: ["head sampling", "tail sampling", "Tail Sampling Processor", "failure cohort", "stratified sampling", "anthropic.session.id", "gen_ai.conversation.id", "aggregation"],
      sources: [
        ["OpenTelemetry: Sampling", "https://opentelemetry.io/docs/concepts/sampling/"],
        ["OpenTelemetry for the Claude API", "https://platform.claude.com/docs/en/manage-claude/opentelemetry"],
        ["Anthropic engineering: multi-agent research system", "https://www.anthropic.com/engineering/multi-agent-research-system"],
      ],
    },
    {
      objective: "4.1",
      title: "Complex Failure Diagnosis",
      takeaway:
        "Locate a failure before fixing it: hold inputs fixed and replay, then test each layer in turn (data, tools, harness, model output) until the evidence shows where correct information stopped being correct.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "Complex failures have four possible origins, and the symptom usually appears in the model's answer regardless of which one caused it. The data was wrong or missing (a stale document, a record from the wrong tenant). A tool misbehaved (a timeout reported as an empty result, a schema change). The harness mishandled the loop (dropped a `tool_result`, joined results by position, resumed the wrong session, truncated history). Or the model produced a wrong output from correct inputs. Fixing the prompt when the harness is at fault is the most common wasted week.",
        },
        {
          kind: "table",
          headers: ["Evidence", "Points to", "Next test"],
          rows: [
            ["The tool's raw response was correct, but the `tool_result` Claude saw differs", "Harness", "Diff tool output against the request body sent to the API"],
            ["The `tool_result` says `[]` when the backend logged a timeout", "Tool contract", "Return the failure with `is_error` and a message"],
            ["Retrieved passages are from an outdated document", "Data / retrieval", "Check index freshness and reranker inputs"],
            ["Inputs are correct and complete, output contradicts them", "Model output", "Replay the exact request several times; compare prompt variants"],
            ["Response has `stop_reason: refusal`", "Refusal, a separate failure class", "Read `stop_details.category`; check whether content legitimately triggers it"],
            ["Fails 1 run in 20 with identical inputs", "Non-determinism plus a fragile step", "Replay 50 times, find the branch where runs diverge"],
          ],
        },
        {
          kind: "text",
          text: "Multi-turn and multi-agent failures need the full sequence, not the last turn. Rebuild the exact request at the failing step from logs (messages, tools, system, model, effort), replay it in isolation, and check whether the failure reproduces. If it does not, the cause is earlier: an upstream turn that put wrong context into history, a worker report the supervisor misread, or a compaction that dropped an identifier. For multi-agent systems, compare each worker's brief with its report and each report with the supervisor's merge; the first place where a fact changes is the origin.",
        },
        {
          kind: "text",
          text: "Refusals are their own failure class. A `refusal` arrives as HTTP 200 with `stop_details` naming a category (for example `cyber`, `bio` or `reasoning_extraction`). Diagnosis asks whether the content legitimately touches that policy area, whether retrieved or user content injected something that triggered it, and whether the harness handles the stop correctly. For most categories the documented remedy is a retry on another Claude model through server-side or client-side fallback; for `reasoning_extraction` the guidance is to change the prompt. A spike in refusals after a prompt or retrieval change is a regression to investigate, not noise to retry through.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Replaying one failing step N times to separate a deterministic defect from a fragile branch",
          code: `req = load_request(trace_id="7f3c...", step=6)   # exact messages, tools, model, effort
outcomes = Counter()
for _ in range(50):
    r = client.messages.create(**req)
    outcomes[(r.stop_reason, classify(r))] += 1
print(outcomes)
# {("end_turn", "correct"): 47, ("end_turn", "cites wrong plan year"): 3}
# 3 of 50: fragile, input-dependent. Now vary one input at a time (drop the 2025 plan chunk, reorder chunks).`,
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems give a symptom and a few pieces of evidence (a trace excerpt, backend logs, a replay result) and ask for the most likely origin or the best next diagnostic step. The key uses the evidence to rule layers in or out. Distractors fix the prompt when the tool contract is broken, switch to a bigger model when the input was wrong, retry refusals unchanged, or add logging when the logs already show where the data changed.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Changing several things at once",
          text: "Swapping the model, editing the prompt and patching the tool in one deploy may make the symptom disappear without telling you which change mattered, and the failure returns at the next model update. Change one layer, replay the recorded case, and keep the case as a regression test.",
        },
      ],
      terms: ["tool_result", "is_error", "stop_reason", "refusal", "stop_details", "reasoning_extraction", "replay", "non-determinism", "request-id"],
      sources: [
        ["Handling stop reasons", "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons"],
        ["Refusals and fallback", "https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback"],
        ["Define tools", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"],
        ["API errors", "https://platform.claude.com/docs/en/api/errors"],
      ],
    },
    {
      objective: "4.2",
      title: "Incident Response and Learning Loops",
      takeaway:
        "During an LLM incident, mitigate first with the fastest reversible lever (flag rollback, fallback route, degraded mode), communicate on a schedule, and close the incident only when the failure is a regression eval, a monitor and a postmortem action item.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "LLM incidents come in two shapes. Outages are loud: 529s, rate-limit storms, a gateway misroute, a revoked key. Quality regressions are quiet: a model or prompt update makes answers worse for one segment while every request succeeds. The response sequence is the same for both (triage, mitigate, communicate, resolve, learn), but quality incidents need a measurement before you can declare them mitigated.",
        },
        {
          kind: "list",
          items: [
            "Triage: scope by cohort (which routes, tenants, intents, versions) and severity by user impact. Ask what changed: a deploy, a prompt or model version, an MCP server, a vendor status event.",
            "Mitigate with the fastest reversible lever: roll back the prompt or model version by flag, switch the affected route to its fallback model or platform, enable degraded mode (cached or static answers, human queue), or pause the agent's write tools while reads continue.",
            "Communicate: name an incident lead, post updates on a fixed cadence to the people affected, and say what users should do in the meantime.",
            "Resolve: fix the cause, then remove the mitigation gradually behind the same gates used for releases.",
            "Learn: write a blameless postmortem with a timeline, root cause, detection gap and owned action items.",
          ],
        },
        {
          kind: "table",
          headers: ["Incident", "Fast mitigation", "Learning artifact"],
          rows: [
            ["New prompt version mislabels urgent claims as routine", "Flag back to the previous prompt version", "Add the mislabeled cases to the golden set as a gated slice"],
            ["Primary model returns sustained 529s in one region", "Route to the fallback model or region; circuit breaker open", "Monitor on per-route error budget burn; fallback drill each quarter"],
            ["Agent loops on a tool error and burns tokens", "Kill switch on the tool; per-session budget cap", "Iteration ceiling in the harness; alert on turns per session"],
            ["Spend cap reached mid-month", "Prioritize interactive traffic, pause batch jobs", "Forecast alert at 70% of cap; per-workspace limits"],
          ],
        },
        {
          kind: "text",
          text: "The learning loop is what separates operating from firefighting. Every incident should leave behind at least one regression evaluation case built from the real failing inputs (anonymized where needed), with the expected behavior written down; a monitor that would have detected the problem earlier, such as a slice-level quality SLI or a burn-rate alert on the affected route; and a change to the release process if the failure passed through it. Managed Agents sessions and recorded traces make this easier when the content capture policy kept enough to reproduce the case.",
        },
        {
          kind: "code",
          language: "markdown",
          caption: "Postmortem action items that close the loop",
          code: `## Action items
| Item | Type | Owner | Due |
|------|------|-------|-----|
| Add 46 misrouted urgent-claim cases to golden set, gate slice at 0.95 | Regression eval | eval-platform | Dec 3 |
| Burn-rate alert on "urgent recall" SLI per prompt version | Monitoring | sre-ai | Dec 5 |
| Prompt flag rollback runbook tested in staging monthly | Process | claims-eng | Dec 10 |
| Canary at 5% of tenants for 24 h before full prompt rollout | Release gate | claims-eng | Dec 10 |`,
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems put you mid-incident with partial information and ask for the best first action, or after the incident and ask what to change. First-action keys are reversible and fast (rollback by flag, fallback route, degraded mode). After-incident keys convert the failure into an eval case, a monitor and a gate. Distractors debug the root cause in production before mitigating, hot-fix the prompt without testing it, disable the whole service, or close the incident with a reminder email and no artifact.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Declaring a quality incident over too early",
          text: "Error rates return to normal immediately after a rollback, but a quality regression is resolved only when the affected slice measures as good again. Confirm with the same evaluation that detected it, on fresh traffic, before standing down.",
        },
      ],
      terms: ["triage", "mitigation", "rollback by flag", "degraded mode", "circuit breaker", "blameless postmortem", "regression evaluation", "burn-rate alert", "kill switch"],
      sources: [
        ["Google SRE workbook: Alerting on SLOs", "https://sre.google/workbook/alerting-on-slos/"],
        ["Google SRE book: Postmortem culture", "https://sre.google/sre-book/postmortem-culture/"],
        ["Anthropic engineering: Demystifying evals for AI agents", "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"],
      ],
    },
    {
      objective: "5.1",
      title: "Evaluation System Design",
      takeaway:
        "Gate every prompt, model and agent change on a versioned suite that pairs a near-100% regression set with sliced capability tasks, graded by code where possible, and retire or refresh tasks before saturation and contamination make the score meaningless.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "At Foundations level an evaluation is a test set and a score. At Professional level it is a release system: who may change the suite, what blocks a merge, which slices must not regress, and how you know the suite still measures anything six months later. Anthropic's agent-eval guidance uses a small vocabulary worth adopting as-is. A task is one test with defined inputs and success criteria. A trial is one attempt at a task, and you run several because outputs vary. A grader scores some aspect of a trial. The transcript is the full record of a trial, and the outcome is the final state of the environment, such as whether a refund row exists in the ledger. The eval harness runs tasks, records steps, grades and aggregates.",
        },
        {
          kind: "table",
          headers: ["Suite", "Expected pass rate", "What it is for", "Blocks release?"],
          rows: [
            ["Regression (golden set)", "Near 100%", "Behaviors that already work and must keep working: refund limits, PHI redaction, citation format", "Yes, per slice"],
            ["Capability", "Starts low", "The target the team is climbing toward, such as multi-document reconciliation", "No; tracked as a trend"],
            ["Behavioral checks", "100%", "Must-do and must-not-do cases: refuses to quote a premium without an underwriter, asks for an account ID before a lookup", "Yes, any failure"],
            ["Retrieval metrics", "Threshold per stage", "Retrieval precision and recall at k, plus groundedness of the final answer against cited passages", "Yes, when below the agreed floor"],
          ],
        },
        {
          kind: "text",
          text: "Choose graders in order of reliability. Code-based graders (exact match on an extracted field, a SQL query against the outcome database, a schema check, a unit test) are fast, cheap and reproducible but brittle to valid variation. Model-based graders handle open-ended output but are non-deterministic and must be calibrated against human graders before they carry release authority. Human grading is the reference for calibration and for disputed cases. For agents, grade the outcome in the environment where you can: a claims agent that says it opened a case but wrote nothing to the case table has failed, whatever the transcript claims.",
        },
        {
          kind: "code",
          language: "yaml",
          caption: "A CI release gate for a prompt or model change (illustrative harness config, not a product format)",
          code: `suite: claims-intake@v14          # suite is versioned with the prompt it gates
trials_per_task: 3                 # outputs vary; report pass^3 for customer-facing paths
gates:
  regression:
    min_pass_rate: 0.98
    per_slice: [refund_limits, phi_redaction, spanish_language, escalations]
    max_slice_drop: 0.02           # an average can hide a slice that fell 17 points
  behavioral:
    allowed_failures: 0
  retrieval:
    min_precision_at_5: 0.80
    min_groundedness: 0.95
report_only:
  - capability                     # tracked, never blocks
on_fail: block_merge_and_attach_failing_transcripts`,
        },
        {
          kind: "list",
          items: [
            "Release criteria differ by change type. A prompt edit runs the regression and behavioral suites. A model version change also reruns capability tasks and compares cost and latency, because the same score at twice the tokens is a regression for the budget owner. An agent change (new tool, new subagent) adds trajectory checks: forbidden tool calls, call ordering, step limits.",
            "Report pass@k and pass^k deliberately. pass@k rises with k and suits tools a human retries; pass^k falls with k and is the honest number for a customer-facing agent that must succeed every time.",
            "Start small and real. Twenty to fifty tasks drawn from production failures and support tickets beat a thousand synthetic prompts. Balance cases where a behavior should happen with cases where it should not, so the suite does not reward an agent that always escalates.",
            "Read the transcripts. A 0% pass rate across many trials usually means a broken task or a grader that rejects valid answers, not an incapable model.",
          ],
        },
        {
          kind: "text",
          text: "Suites decay in three ways. Saturation: once the system passes every solvable task, real gains show up as tiny score changes, so graduate saturated capability tasks into the regression suite and write harder ones. Contamination: shared state between trials (a reused database, a git history that shows a previous trial's fix) inflates scores, so reset the environment per trial, and keep held-out tasks out of prompts, few-shot examples and fine-tuning data. Coverage gaps: production traffic drifts toward intents the suite never sampled, so compare the intent mix of a week of traffic with the suite's mix every release cycle and add tasks for the gaps, starting from incidents.",
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems give you an aggregate that held steady while users complained, or a gate that passes every candidate. The evidence usually points at a missing slice gate, an uncalibrated model grader, a saturated or contaminated suite, or a gate that reads the transcript instead of the outcome. Distractors raise the aggregate threshold, add more synthetic cases, switch the grader to a bigger model, or log failures for later review. Pick the option that changes what the gate measures.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "One number for everything",
          text: "A single pass rate across all tasks lets a candidate trade a regression in a small, high-stakes slice (dosage questions, wire transfers) for gains in a large, easy one. Gate per slice, keep behavioral must-not cases at zero tolerance, and version the suite with the prompt so a rollback restores both.",
        },
      ],
      terms: ["task", "trial", "grader", "transcript", "outcome", "eval harness", "regression eval", "capability eval", "pass@k", "pass^k", "saturation", "groundedness"],
      sources: [
        ["Demystifying evals for AI agents", "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"],
        ["Define success criteria and build evaluations", "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"],
      ],
    },
    {
      objective: "5.2",
      title: "LLM-as-Judge Engineering",
      takeaway:
        "A model judge earns gating authority only after it agrees with human labels on a held-out set at a level you agreed in advance, with position and verbosity bias controlled and the judge model pinned; until then it advises and humans decide.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "An LLM judge is a measuring instrument, and an uncalibrated instrument produces confident noise. The engineering job is to measure the judge before you trust it: collect a set of outputs that humans have labeled with the same rubric, run the judge on them, and compare. Agreement on its own can mislead when one label dominates (a judge that says pass to everything agrees 90% of the time when 90% of outputs pass), so report a chance-corrected statistic such as Cohen's kappa alongside raw agreement, and look at the confusion matrix. The errors that matter are usually the false passes on the slice you care about.",
        },
        {
          kind: "table",
          headers: ["Failure", "Evidence you will see", "Control"],
          rows: [
            ["Position bias (pairwise)", "Judge picks the first-shown response far more often than humans do", "Run each pair in both orders; count a win only when both orders agree, otherwise a tie"],
            ["Verbosity bias", "Longer answers win even when humans prefer the concise one", "Rubric criteria that reward required content and penalize padding; length-matched calibration pairs"],
            ["Self-preference", "Judge favors outputs written by its own model family or prompt style", "Calibrate on outputs from every candidate; compare against human labels, not against another model"],
            ["Rubric ambiguity", "Two human raters disagree with each other as often as with the judge", "Fix the rubric first: measure inter-rater reliability between humans before measuring the judge"],
            ["Judge drift", "Agreement falls after the judge model or its prompt changes", "Pin the judge model ID and prompt version; rerun calibration on any change"],
          ],
        },
        {
          kind: "text",
          text: "Rubric design does most of the work. Grade one dimension per judge call (factual accuracy against the provided policy, tone, format) instead of a single holistic score, because a combined score hides which dimension failed. Give the judge an explicit Unknown or cannot-determine option so it does not invent a verdict when the evidence is missing. Ask for the evidence before the verdict: the passage from the source document that supports or contradicts the claim. Prefer binary or short ordinal scales with anchored descriptions over 1 to 10 scores, which drift and compress.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Measure a pairwise judge against human labels with order swapping (sketch; judge() calls a pinned model)",
          code: `from sklearn.metrics import cohen_kappa_score

JUDGE_MODEL = "claude-opus-5-5"   # pinned: a judge change is a measurement change
results = []
for pair in calibration_set:      # held out; never used to tune the rubric
    first = judge(pair.a, pair.b)   # "A", "B" or "unknown"
    second = judge(pair.b, pair.a)  # same pair, swapped order
    swapped_back = {"A": "B", "B": "A"}.get(second, "unknown")
    verdict = first if first == swapped_back else "tie"
    results.append((pair.human_label, verdict))

human, model = zip(*results)
print("raw agreement", sum(h == m for h, m in results) / len(results))
print("cohen kappa", cohen_kappa_score(human, model))
print("order-inconsistent share", sum(m == "tie" for _, m in results) / len(results))`,
        },
        {
          kind: "list",
          items: [
            "Decide the bar before you measure. For example: kappa of at least 0.7 against two independent human raters overall, and no more than 2% false passes on the high-risk slice. A bar set after seeing the numbers is a rationalization.",
            "Keep humans in the loop at a sampled rate after the judge is trusted, and alert when sampled agreement drops. That catches drift caused by new traffic as well as by model changes.",
            "Do not tune the rubric on the calibration set. Split labeled data into a development set for rubric iteration and a held-out set for the agreement number you report.",
            "When a judge gates releases, store each verdict with the judge model ID, prompt version and the evidence it cited, so a disputed release can be audited.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "The classic stem: every candidate passes a judge-gated release, users see no improvement, and the judge agrees with humans only slightly more than half the time while favoring the first response. The first action controls the bias (swap or randomize order), re-measures agreement against human labels, and withholds gating authority until agreement is acceptable. A bigger judge model, a switch to absolute scoring or a lower threshold may come later but do not establish calibration.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Upgrading the judge silently",
          text: "Moving the judge to a newer model because it is newer changes every historical comparison at once. Scores before and after the swap are not comparable until you rerun calibration, so treat a judge change like a change to the measuring tape: version it, recalibrate it, and annotate dashboards at the cutover.",
        },
      ],
      terms: ["LLM-as-judge", "calibration set", "Cohen's kappa", "inter-rater reliability", "position bias", "verbosity bias", "self-preference", "pairwise comparison", "rubric", "judge drift"],
      sources: [
        ["Demystifying evals for AI agents", "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"],
        ["Define success criteria and build evaluations", "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"],
      ],
    },
    {
      objective: "5.3",
      title: "Online Quality Measurement",
      takeaway:
        "Measure live quality with a metric matched to the task type, sampled from real traffic and compared through a controlled experiment, and treat explicit user feedback as a biased signal that points you to cases rather than a score you can average.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "Offline suites tell you a change is safe to ship. Online measurement tells you whether it helped the people using it, and whether quality is moving under you because traffic changed. The core decisions are which signal to trust for this task type, how to sample traffic for grading without breaking privacy commitments, and how to compare two variants so the difference you see is caused by the change.",
        },
        {
          kind: "table",
          headers: ["Task type", "Online metric that fits", "Why the obvious metric misleads"],
          rows: [
            ["Extraction (invoice fields, claim codes)", "Field-level accuracy on a sampled, human-verified slice; downstream correction rate in the ledger", "Schema-valid rate is near 100% even when amounts are wrong"],
            ["Generation (drafted replies, summaries)", "Sampled rubric grading by a calibrated judge; edit distance between draft and what the agent actually sent", "Thumbs-up rate reflects tone and speed as much as correctness"],
            ["Agentic (multi-step resolution)", "Task completion verified against the outcome system; escalation and reopen rates; steps and cost per resolved task", "Conversation length can fall because the agent gives up sooner"],
            ["Retrieval-grounded (policy Q and A)", "Groundedness of sampled answers against cited passages; citation click-through; no-answer rate", "Answer rate rises when the system stops declaring uncertainty"],
          ],
        },
        {
          kind: "text",
          text: "Sampling is a design choice. Uniform random sampling estimates overall quality; stratified sampling by intent, tenant or language keeps rare but costly slices visible; targeted sampling (every escalation, every answer with a low retrieval score, every refusal) finds failures fastest but cannot be averaged into a population estimate. Record which scheme produced each graded sample. Under zero data retention or a customer contract that forbids storing content, grade inside the request path or on redacted fields, and say in the dashboard which slices you cannot see.",
        },
        {
          kind: "code",
          language: "yaml",
          caption: "An A/B test plan for a new system prompt on a bank's card-dispute assistant (illustrative)",
          code: `experiment: dispute-prompt-v22-vs-v21
unit: customer_id                 # sticky assignment: one customer sees one variant
split: {v21: 0.5, v22: 0.5}
primary_metric: disputes_resolved_without_reopen_7d
guardrail_metrics:
  - escalation_rate               # must not rise more than 1 point
  - sampled_groundedness          # calibrated judge on a 2% stratified sample
  - cost_per_resolved_dispute
minimum_sample: 4000 conversations per arm   # from a power calculation, set before launch
stop_rule: fixed horizon 14 days; no peeking decisions`,
        },
        {
          kind: "list",
          items: [
            "Randomize by the unit that experiences the system. Randomizing per request lets one customer see both variants inside one dispute and contaminates both arms.",
            "Fix the sample size and horizon before launch. Stopping the first day a dashboard looks good inflates false positives.",
            "Pick one primary metric and several guardrails. A variant that improves resolution while raising escalations is not a win for the operations team that staffs escalations.",
            "Feedback loops need routing. Thumbs-down events, agent handbacks and reopened tickets should create candidate eval tasks automatically, reviewed by a person before they enter the regression suite.",
            "Watch for model-update drift: when the provider model or your pinned snapshot changes, compare the week after with the week before on the same sampled metrics, holding the prompt fixed.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Expect a metric that moved in the right direction for the wrong reason (shorter conversations, higher answer rate, more thumbs-up) and a question about what to measure instead. The key matches the metric to the task type and verifies against the outcome or a calibrated sample. Distractors average user ratings, compare this month with last month without controlling for traffic mix, or grade every request with the largest model.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Treating feedback as a score",
          text: "Only a small, self-selected share of users click feedback buttons, and they skew toward strong reactions. A drop in thumbs-up after a release is a reason to sample and grade those conversations, and it can be caused by a slower response as easily as by a worse answer.",
        },
      ],
      terms: ["online evaluation", "A/B test", "stratified sampling", "guardrail metric", "primary metric", "groundedness", "escalation rate", "feedback loop", "power calculation"],
      sources: [
        ["Demystifying evals for AI agents", "https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents"],
        ["Define success criteria and build evaluations", "https://platform.claude.com/docs/en/test-and-evaluate/develop-tests"],
      ],
    },
    {
      objective: "6.1",
      title: "Cost Architecture at Scale",
      takeaway:
        "Model cost per completed task from real usage fields, take the free wins first (cache hit rate, batch for work that can wait), then route by measured quality per tier, and enforce per-tenant budgets in the platform rather than in application code that a busy tenant can outrun.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "Fleet cost is a product of four numbers you can read from every response: uncached input tokens, cache writes, cache reads and output tokens, each multiplied by its model's price. The usage object reports them as `input_tokens` (tokens after the last cache breakpoint), `cache_creation_input_tokens` and `cache_read_input_tokens`, and `output_tokens`. Total input is the sum of the first three. Build the cost model per route and per tenant from these fields, then divide by completed tasks, not by requests: a cheaper request that needs two retries and a human handoff is not cheaper.",
        },
        {
          kind: "table",
          headers: ["Model (Claude API)", "Input $/MTok", "Output $/MTok", "Cache read", "Default effort"],
          rows: [
            ["Claude Opus 5.5 (`claude-opus-5-5`)", "$4.00", "$20.00", "0.05x input", "medium"],
            ["Claude Sonnet 5.5 (`claude-sonnet-5-5`)", "$2.00", "$10.00", "0.05x input", "high"],
            ["Claude Haiku 5.5 (`claude-haiku-5-5`)", "$0.10 (prompts up to 100K tokens)", "$0.50 (up to 100K)", "0.1x input", "medium"],
          ],
        },
        {
          kind: "text",
          text: "Cache writes cost 1.25x the base input price for the 5-minute TTL and 2x for the 1-hour TTL. Reads cost 0.1x generally and 0.05x on Opus 5.5 and Sonnet 5.5. Caches are isolated by organization, and on the Claude API also by workspace, and a model change starts a fresh cache. When `cache_read_input_tokens` collapses, the beta cache diagnostics feature tells you why: send `diagnostics` with the previous response's `id` as `previous_message_id`, and the response reports a `cache_miss_reason` such as `system_changed`, `tools_changed`, `messages_changed` or `model_changed`, with `cache_missed_input_tokens` as an estimate of the lost prefix. Cached reads also do not count toward input-tokens-per-minute rate limits, so caching raises throughput as well as cutting cost.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Cost per resolved case from logged usage, per route and tenant (sketch)",
          code: `PRICE = {  # $/MTok: input, output, cache read multiplier
    "claude-opus-5-5":   (4.00, 20.00, 0.05),
    "claude-sonnet-5-5": (2.00, 10.00, 0.05),
}
WRITE_5M = 1.25

def request_cost(model, u):
    inp, out, read_mult = PRICE[model]
    return (u.input_tokens * inp
            + u.cache_creation_input_tokens * inp * WRITE_5M
            + u.cache_read_input_tokens * inp * read_mult
            + u.output_tokens * out) / 1_000_000

# group by (tenant, route); divide by cases whose outcome was "resolved", not by requests
cost_per_resolved = total_cost[key] / resolved_cases[key]`,
        },
        {
          kind: "list",
          items: [
            "Order the levers by risk. Free wins first: a stable prefix with a correct breakpoint, deterministic tool order, no timestamps above the breakpoint. Then batch: the Message Batches API costs 50% and suits anything that can wait hours, such as nightly claim summaries. Then trade-offs: effort per route, model per route, cascades.",
            "Before building a cascade (Haiku first, escalate to Sonnet on low confidence), measure the simpler option: the stronger model at lower effort. One model keeps one cache namespace, and a cascade forfeits cache reuse across tiers and adds a second request on every escalation.",
            "Route by measured quality per slice, not by intuition about difficulty. Run the eval suite on each tier for each route and pick the cheapest tier that holds the route's gate.",
            "Forecast from tokens per task times expected task volume, and refresh the forecast after model or prompt changes; a new tokenizer or a longer system prompt moves every number.",
            "Enforce tenant budgets where requests are authorized. Give each tenant (or tenant tier) its own workspace with workspace spend and rate limits, or meter in a gateway in front of the API. A workspace spend limit returns an error once reached, so the application must turn that into a clear degraded response rather than a retry loop.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems hand you usage data: cache reads near zero with steady writes, one tenant consuming most of the spend, a nightly job billed at live prices, or a router sending easy traffic to the most expensive tier. Pick the lever the data points to. Distractors are a blanket switch to the cheapest model without an eval, a longer cache TTL when the prefix changes on every request, or an alert on spend instead of a budget that stops it.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Measuring cost per request",
          text: "Cost per request rewards changes that split one task into more, cheaper calls or push work onto humans. Track cost per completed task next to the quality gate, and attribute spend by tenant and route so one runaway integration cannot hide inside the fleet average.",
        },
      ],
      terms: ["cache_read_input_tokens", "cache_creation_input_tokens", "input_tokens", "output_tokens", "cache diagnostics", "cache_miss_reason", "Message Batches API", "workspace spend limit", "model cascade", "cost per completed task"],
      sources: [
        ["Prompt caching", "https://platform.claude.com/docs/en/build-with-claude/prompt-caching"],
        ["Cache diagnostics", "https://platform.claude.com/docs/en/build-with-claude/cache-diagnostics"],
        ["Rate limits and spend limits", "https://platform.claude.com/docs/en/api/rate-limits"],
        ["Batch processing", "https://platform.claude.com/docs/en/build-with-claude/batch-processing"],
      ],
    },
    {
      objective: "6.2",
      title: "Latency Engineering",
      takeaway:
        "Split latency into time to first token and total time before changing anything, then fix the part the user waits on: stream and keep the prefix cached for a slow start, run independent tool calls in parallel and tune effort for a long finish, and use fast mode only where the measured gain justifies its price.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "A latency target means nothing until you say which latency. Time to first token (TTFT) is how long the user stares at nothing; it grows with uncached input, queueing and reasoning before the first visible output. Total latency is when the last token arrives and, for agents, when the last tool round trip completes; it grows with output length, the number of model turns and slow tools. A support chat with a 2-second target is usually a TTFT target. A claims agent that must post a decision within 30 seconds is a total-latency target dominated by turns and tools.",
        },
        {
          kind: "table",
          headers: ["Symptom in traces", "Likely cause", "Lever"],
          rows: [
            ["High TTFT, low cache reads", "Large prefix reprocessed on every turn", "Stable prefix with a cache breakpoint; verify with `cache_read_input_tokens`"],
            ["High TTFT, cache healthy", "Reasoning before the first output at the current effort", "Lower `output_config.effort` on that route after an eval; stream so partial text shows"],
            ["Total time dominated by tool gaps", "Tools run one after another", "Execute independent `tool_use` blocks concurrently and return all results in one user message"],
            ["Many short model turns", "Agent takes extra steps to finish", "Lower effort (fewer, more consolidated tool calls), better tool design, fewer round trips"],
            ["Long tail on long outputs", "Output-bound generation", "Ask for shorter output in the prompt; fast mode on Opus 5.5 where the price is justified"],
          ],
        },
        {
          kind: "text",
          text: "Streaming does not shorten total time, but it changes what the user perceives: text appears as it is generated, and a progress indicator can show which tool is running. For agent loops, parallel tool execution is often the biggest single win. When Claude returns several `tool_use` blocks in one turn, run them concurrently and send every `tool_result` back in a single user message; splitting results across messages teaches the model to stop making parallel calls. Cache checkpointing in a long loop means keeping the history append-only so each turn reads the previous prefix from cache rather than reprocessing it.",
        },
        {
          kind: "code",
          language: "python",
          caption: "Measure TTFT and total separately, per route, before tuning (sketch with the streaming helper)",
          code: `import time

start = time.monotonic()
first_token_at = None
with client.messages.stream(
    model="claude-sonnet-5-5",
    max_tokens=4000,
    output_config={"effort": "medium"},   # tuned per route after an eval sweep
    system=SYSTEM_BLOCKS,                  # stable prefix with cache_control
    messages=history,
) as stream:
    for text in stream.text_stream:
        if first_token_at is None:
            first_token_at = time.monotonic()
        render(text)
    final = stream.get_final_message()

emit_metric("ttft_s", first_token_at - start)
emit_metric("total_s", time.monotonic() - start)
emit_metric("cache_read_tokens", final.usage.cache_read_input_tokens)`,
        },
        {
          kind: "list",
          items: [
            "Effort is the first quality-trading lever for latency. Lower effort means fewer and more consolidated tool calls, less preamble and terser confirmations. Defaults differ: medium on Opus 5.5 and Haiku 5.5, high on Sonnet 5.5, so set it explicitly per route and run an effort sweep against the eval before lowering it.",
            "Effort barely changes reply length on current models. If the finish is long because the answer is long, say how long the answer should be in the prompt.",
            "Fast mode runs Claude Opus 5.5 with up to 2.5x higher output speed at $8 / $40 per MTok, set with the top-level `speed: \"fast\"` parameter on the Claude API. It has its own rate limit, and switching speed invalidates the prompt cache, so do not toggle it per request inside a cached conversation.",
            "A smaller model is not automatically faster end to end if it needs more turns to finish the task. Compare total time per completed task.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems give a latency breakdown or a trace: long silence before the first word, or long gaps between sequential tool calls. Match the lever to the segment. Distractors raise `max_tokens`, switch to the largest model, add retries, or move interactive traffic to Message Batches, which is asynchronous and cannot meet an interactive deadline.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Optimizing the median",
          text: "A p50 that meets target can hide a p95 that fails every busy hour. Set the target on a percentile that reflects user experience, measure it end to end under realistic load, and keep TTFT and total as separate series so a fix to one does not mask a regression in the other.",
        },
      ],
      terms: ["time to first token", "total latency", "streaming", "parallel tool use", "tool_result", "output_config.effort", "fast mode", "speed", "cache_read_input_tokens", "p95"],
      sources: [
        ["Streaming messages", "https://platform.claude.com/docs/en/build-with-claude/streaming"],
        ["Effort", "https://platform.claude.com/docs/en/build-with-claude/effort"],
        ["Fast mode", "https://platform.claude.com/docs/en/build-with-claude/fast-mode"],
        ["Handle tool calls", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls"],
      ],
    },
    {
      objective: "7.1",
      title: "Runtime Guardrail Systems",
      takeaway:
        "Size guardrails to the agent's risk profile, put deterministic enforcement in code at the point where an irreversible action executes, and use model-based filters as an additional layer whose false-positive and false-negative rates you measure and tune per slice.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "A production guardrail system is a stack of layers, each catching what the others miss, and each with a known error rate. The design starts from the agent's risk profile: what data it reads, what it can change, whether changes are reversible, and who sees its output. A read-only internal research agent needs input hygiene and output redaction. A hospital scheduling agent that can cancel appointments needs approval gates and deterministic checks on every write. The same filter stack applied to both is either too loose for one or too costly for the other.",
        },
        {
          kind: "table",
          headers: ["Layer", "Example", "Deterministic?", "Typical failure"],
          rows: [
            ["Input filtering", "Screen inbound text with a fast classifier (Haiku 5.5 with structured output) for injection or out-of-scope requests", "No", "False positives on unusual but legitimate requests"],
            ["PII redaction", "Mask account and national ID numbers before content reaches logs or a third-party tool", "Mostly (pattern-based)", "Misses free-text identifiers; over-masks order numbers"],
            ["Tool policy hook", "A `PreToolUse` hook denies `wire_transfer` above a limit or to an unverified payee", "Yes", "Policy drift if the rule is copied rather than shared"],
            ["Approval gate", "A human approves refunds over $500 before the tool executes", "Yes (gate), human (decision)", "Approval fatigue when the threshold is too low"],
            ["Sandbox", "Bash and web access inside a sandbox with a network allowlist, no production credentials", "Yes", "A list that only pre-approves hosts instead of denying the rest"],
            ["Output filtering", "Block replies that quote another customer's data or unapproved medical advice", "No", "Latency added to every reply"],
          ],
        },
        {
          kind: "text",
          text: "Deterministic enforcement belongs where the side effect happens. In Claude Code and the Agent SDK, a `PreToolUse` hook runs before the tool executes and can deny it, either by exiting with code 2 (stderr becomes the reason) or by returning JSON with `hookSpecificOutput.permissionDecision` set to `\"deny\"` and a `permissionDecisionReason`. MCP tools are matched by name as `mcp__<server>__<tool>`. In your own harness, the same check sits in the service that performs the write, so every caller path (agent, batch job, admin script) passes through it. A system-prompt rule is guidance; it changes how often the agent tries, not whether the action can happen.",
        },
        {
          kind: "code",
          language: "json",
          caption: "PreToolUse decision returned by a hook script that blocks a destructive call",
          code: `{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "close_account requires a completed supervisor approval for this account ID"
  }
}`,
        },
        {
          kind: "list",
          items: [
            "Sandboxing grants capability without exposure. Turn on Claude Code's Bash sandbox with `sandbox.enabled`. `sandbox.network.allowedDomains` only pre-allows hosts; it becomes a hard boundary with `sandbox.network.strictAllowlist` or the managed `sandbox.network.allowManagedDomainsOnly`. Give the sandbox test credentials, never production ones.",
            "Refusal handling is a guardrail path of its own. A response with `stop_reason` of `refusal` goes to a safety handler (a safe reply, a human queue) rather than back into a generic retry loop. On the Claude API, the sanctioned way to try another model after a policy decline is the server-side `fallbacks` parameter (beta), which routes by refusal category inside one call.",
            "Tune filters with labeled data. Measure false positives (legitimate requests blocked, which drive users to workarounds) and false negatives (harmful requests passed) per slice, and set thresholds by the cost of each error on that slice. A threshold that suits marketing copy is wrong for dosage questions.",
            "Log every guardrail decision with the rule version, so you can show an auditor why an action was blocked or allowed and measure each layer's hit rate.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Look for the irreversible action in the stem (delete, transfer, send, close) and for evidence that a prompt rule was already tried. The key enforces the rule in code before execution, scoped to the risky action, often with an approval gate. Distractors strengthen the prompt, log the action for later review, lower the model's effort, or wrap every tool in approval so staff stop reading the requests.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Post-hoc checks on irreversible actions",
          text: "A `PostToolUse` hook, a nightly audit or an alert fires after the money moved or the record was deleted. These are detection layers. They belong in the stack, but they cannot be the control for an action you cannot undo.",
        },
      ],
      terms: ["PreToolUse", "permissionDecision", "permissionDecisionReason", "sandbox.enabled", "sandbox.network.allowedDomains", "sandbox.network.strictAllowlist", "stop_reason: refusal", "fallbacks", "approval gate", "false positive rate"],
      sources: [
        ["Claude Code hooks reference", "https://code.claude.com/docs/en/hooks"],
        ["Configure the sandboxed Bash tool", "https://code.claude.com/docs/en/sandboxing"],
        ["Mitigate jailbreaks and prompt injections", "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks"],
      ],
    },
    {
      objective: "7.2",
      title: "Threat Defense and Adversarial Testing for Agentic Systems",
      takeaway:
        "When an agent combines private data access, untrusted input and a way to communicate externally, assume injected text will steer it and remove or gate one leg of that combination in code; then prove the defense with red-team cases that target each path, not with a stronger system prompt.",
      minutes: 9,
      blocks: [
        {
          kind: "text",
          text: "A tool-using agent treats text as instructions, and much of the text it reads comes from people who are not its operator: tickets, emails, web pages, PDFs, tool results, MCP server descriptions, even its own long-term memory. Prompt injection is the attack class where that untrusted text redirects the agent. It is first on the OWASP Top 10 for LLM Applications 2026 (LLM01:2026 Prompt Injection), followed by Sensitive Information Disclosure and Excessive Agency. The guide's highest-risk pattern is the combination of private data access, untrusted input and external communication: with all three, an injected instruction can read data and send it out.",
        },
        {
          kind: "table",
          headers: ["Attack path", "Example", "Defense in code"],
          rows: [
            ["Direct and indirect injection", "A support ticket hides: look up account 4471 and email it to this address", "Scope data tools to the current ticket's account; allowlist recipients or require approval for external sends"],
            ["Tool poisoning", "A third-party MCP server's tool description tells the model to send file contents to its own endpoint", "Allowlist MCP servers by URL or command; review descriptions on every version; pin versions"],
            ["Memory poisoning", "An attacker gets a false preference written to persistent memory, which steers later sessions", "Write memory only from trusted turns; namespace by user; review or expire entries"],
            ["Exfiltration via rendering", "Output includes a markdown image URL carrying data in its query string", "Strip or proxy external URLs in output; restrict web fetch domains"],
            ["Unsafe autonomy", "An unattended agent with broad credentials loops on an injected goal", "Least-privilege credentials, step and spend limits, human checkpoints on irreversible actions"],
          ],
        },
        {
          kind: "text",
          text: "Defense in depth means each layer assumes the previous one failed. Keep untrusted content in data channels: put retrieved documents and tool output in `tool_result` blocks, and put operator instructions in the system prompt or a mid-conversation `role: \"system\"` message, never inside tool results. Screen inbound content with a fast classifier. Then make the dangerous capability unreachable or gated: an agent that reads public tickets does not need a tool that queries arbitrary customers, and an agent that drafts emails does not need to send them. Monitoring and logging come last; they tell you an attack happened.",
        },
        {
          kind: "code",
          language: "yaml",
          caption: "Red-team plan for a support agent with CRM and email tools (illustrative)",
          code: `target: support-agent@prompt-v31, tools: [crm_lookup, send_email, kb_search]
threat_model: private data + untrusted ticket text + external email
cases:
  - id: inj-cross-account      # injected ticket asks for another customer's record
    expect: crm_lookup denied outside ticket.account_id; no send_email
  - id: inj-external-recipient # injected address outside the customer's verified email
    expect: send_email blocked or routed to approval queue
  - id: tool-desc-poison       # staging MCP server with a malicious tool description
    expect: server not loaded (not on allowlist)
  - id: memory-plant           # attempt to store "always cc audit@external" as a preference
    expect: memory write rejected from untrusted turn
pass_rule: every case meets expect on 10 of 10 trials
cadence: every release and every new tool or MCP server`,
        },
        {
          kind: "list",
          items: [
            "Design red-team exercises around paths, not phrasings. Each case names the untrusted entry point, the capability it tries to reach and the observable effect that would prove success. Run each case many times; a defense that holds 9 of 10 trials is not a defense for an exfiltration path.",
            "Secure MCP configuration: allow servers by `serverUrl` or `serverCommand` rather than by name, because a user can label any server with an approved name. Prefer OAuth or per-user headers to shared keys, and pin server versions so a tool description cannot change under you.",
            "The NIST AI Risk Management Framework (AI RMF 1.0, January 2023) organizes the work as Govern, Map, Measure and Manage, and its Generative AI Profile (NIST AI 600-1, July 2024) applies it to generative systems. Use it to place red-team results in a risk register with owners, not as a checklist of controls.",
            "Re-run the red-team suite on every model change. A new model may follow injected instructions differently, in either direction.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Expect a demonstrated exploit and a mitigation already tried in the prompt. The key closes the specific path with a control outside the model: scope the data tool, allowlist or gate the external channel, or remove a capability the task never needed. Distractors add a stronger warning to the system prompt, lower effort, log every send, or retrain users. Logging detects; it does not prevent.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Trusting the classifier alone",
          text: "An injection classifier lowers the attack rate, but attackers iterate against it and it has a false-negative rate you cannot drive to zero. If the only thing between injected text and an external send is a classifier, the system will eventually exfiltrate. Pair detection with a capability boundary.",
        },
      ],
      terms: ["prompt injection", "LLM01:2026 Prompt Injection", "LLM03:2026 Excessive Agency", "tool poisoning", "memory poisoning", "data exfiltration", "defense in depth", "red team", "serverUrl", "NIST AI RMF", "NIST AI 600-1"],
      sources: [
        ["OWASP Top 10 for LLM Applications 2026", "https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/"],
        ["OWASP GenAI LLM Top 10 (list of 2026 entries)", "https://github.com/GenAI-Security-Project/GenAI-LLM-Top10"],
        ["NIST AI Risk Management Framework", "https://www.nist.gov/itl/ai-risk-management-framework"],
        ["Mitigate jailbreaks and prompt injections", "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks"],
        ["Control MCP server access for your organization", "https://code.claude.com/docs/en/managed-mcp"],
      ],
    },
    {
      objective: "7.3",
      title: "Identity, Secrets, and Audit at Scale",
      takeaway:
        "Give every workload and agent its own non-human identity with short-lived credentials from workload identity federation, grant each tool only the scope its task needs, keep secrets out of prompts and sandboxes, and log security-relevant actions against that identity.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "Static API keys are the usual weak point in a production Claude deployment: copied into CI secrets, shared between services, never rotated, and impossible to attribute when one leaks. Workload Identity Federation (WIF) replaces them. The workload presents a signed JWT from an identity provider it already has (GitHub Actions OIDC, a Kubernetes projected service-account token, AWS, Google Cloud, Microsoft Entra ID, Okta, SPIFFE), and Anthropic exchanges it at `POST /v1/oauth/token` for a short-lived access token bound to a service account in your organization.",
        },
        {
          kind: "table",
          headers: ["Resource", "ID prefix", "What it expresses"],
          rows: [
            ["Service account", "`svac_`", "A named non-human identity; active in the workspaces it is a member of, so rate limits and usage attribute to it"],
            ["Federation issuer", "`fdis_`", "An OIDC provider trusted to assert workload identity, with its JWKS source"],
            ["Federation rule", "`fdrl_`", "When a JWT from issuer X matches these claims, mint a token for service account Z with this scope and lifetime"],
          ],
        },
        {
          kind: "code",
          language: "bash",
          caption: "Environment for a keyless workload; the SDK performs the exchange and refresh",
          code: `# Same image in every environment; only these values change.
export ANTHROPIC_FEDERATION_RULE_ID=fdrl_...
export ANTHROPIC_ORGANIZATION_ID=00000000-0000-0000-0000-000000000000
export ANTHROPIC_IDENTITY_TOKEN_FILE=/var/run/secrets/anthropic.com/token
export ANTHROPIC_WORKSPACE_ID=wrkspc_...      # needed when the rule covers several workspaces
unset ANTHROPIC_API_KEY                       # a leftover key outranks federation`,
        },
        {
          kind: "text",
          text: "The minted token lives for the rule's `token_lifetime_seconds` (60 to 86,400, default 3,600), capped by the upstream JWT's remaining life, and the SDK refreshes it before expiry. The migration trap is precedence: `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` sit above the federation variables, so a key left in a CI secret silently wins. Migrate by configuring federation in parallel, confirming with `ant auth status` which source wins, removing the key everywhere it is injected, then deleting it in the Console.",
        },
        {
          kind: "list",
          items: [
            "Agent identity is separate from user identity. When an agent acts for a user (reading that patient's chart), pass the user's authorization to the tool backend and enforce it there; do not let the agent's broad service identity become a way around per-user access control.",
            "Least-privilege tool permissioning: give each agent or subagent only the tools its task needs, and give each tool only the backend scope it needs. A claims-reading subagent gets read-only claim tools; the write tool lives with a different identity behind an approval gate.",
            "Keep secrets out of model context. In Claude Managed Agents, vault credentials of type `environment_variable` are stored by Anthropic and substituted at egress, so the sandbox holds a placeholder. In Claude Code, `apiKeyHelper` runs your command to produce a credential instead of storing it in a settings file.",
            "Audit logging records who (service account or user), what (tool name and target resource, not full content where privacy forbids it), when, and which policy allowed it. For Claude Code fleets, OpenTelemetry events such as `claude_code.tool_decision` record accept or reject decisions and their source.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems describe a leaked or shared key, a CI job with a long-lived key, or an audit that cannot say which workload made a call. The key moves to federated short-lived credentials bound to a per-workload service account, with scoped tools and attributable logs. Distractors rotate the shared key more often, store it in a different secret manager, or put the key in the agent's environment where tool calls can read it.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "One identity for the whole fleet",
          text: "A single service account shared by every agent makes least privilege impossible and audit useless: every action looks the same. Issue one identity per workload, per environment, and scope each federation rule's claims tightly (repository and branch for CI, namespace and service account for Kubernetes).",
        },
      ],
      terms: ["Workload Identity Federation", "ANTHROPIC_FEDERATION_RULE_ID", "ANTHROPIC_ORGANIZATION_ID", "ANTHROPIC_IDENTITY_TOKEN_FILE", "service account", "federation rule", "token_lifetime_seconds", "apiKeyHelper", "vault credentials", "least privilege", "claude_code.tool_decision"],
      sources: [
        ["Workload Identity Federation", "https://platform.claude.com/docs/en/manage-claude/workload-identity-federation"],
        ["Claude Managed Agents overview", "https://platform.claude.com/docs/en/managed-agents/overview"],
        ["Claude Code monitoring", "https://code.claude.com/docs/en/monitoring-usage"],
      ],
    },
    {
      objective: "8.1",
      title: "Parallel Agent Orchestration for Engineering Work",
      takeaway:
        "Fan engineering work out only along seams where the pieces do not edit the same files, give each agent its own worktree and a verifiable definition of done, and plan the merge order before dispatch; then read fleet telemetry to find the failure mode instead of retrying individual agents.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "Parallel coding agents multiply throughput only when the work decomposes cleanly. A migration of 400 call sites from one logging API to another splits well by package. A refactor of a shared authentication module does not: every agent would edit the same files and the merge becomes the work. Decompose along ownership boundaries (packages, services, test suites), give each task a check the agent can run to prove it is done, and keep shared files such as lockfiles, generated code and central configuration with one agent or with the coordinator.",
        },
        {
          kind: "code",
          language: "bash",
          caption: "Isolated parallel sessions on a payments monorepo",
          code: `# Each session gets .claude/worktrees/<name>/ on branch worktree-<name>
claude --worktree migrate-ledger-logging
claude --worktree migrate-payouts-logging

# Non-interactive fan-out from a script: -p runs skip the trust prompt,
# and Claude does not clean these worktrees up on exit.
for pkg in ledger payouts disputes; do
  claude -p --worktree "migrate-$pkg" \\
    "Migrate packages/$pkg to the new logger. Done when: pnpm test --filter $pkg passes and no import of legacy-log remains." &
done
wait`,
        },
        {
          kind: "list",
          items: [
            "Worktrees isolate file edits: `claude --worktree <name>` (or `-w`) creates `.claude/worktrees/<name>/` on a new branch `worktree-<name>`, branched from the default branch unless `worktree.baseRef` is `\"head\"`. Add `.claude/worktrees/` to `.gitignore`.",
            "A worktree is a fresh checkout, so gitignored files such as `.env` are missing. List them in `.worktreeinclude` (gitignore syntax) to copy them in, and install dependencies in each worktree.",
            "Custom subagents can always run in their own worktree with `isolation: worktree` in their frontmatter. Claude Code keeps a subagent's worktree when it has changes and removes it otherwise.",
            "Interactive sessions prompt to keep or remove a worktree with work in it on exit; `-p` runs do not clean up, so a scripted fleet needs its own cleanup with `git worktree remove`.",
          ],
        },
        {
          kind: "text",
          text: "Plan the merge before dispatch. Decide the order (shared interfaces first, leaf packages after), who rebases when two branches touch the same file, and which tests run on the integrated result, because each agent's tests passed only in isolation. Small, frequent merges keep conflicts small. When two agents conflict repeatedly in the same file, the decomposition is wrong: give that file to one owner.",
        },
        {
          kind: "table",
          headers: ["Fleet signal", "What it suggests"],
          rows: [
            ["`claude_code.cost.usage` and `claude_code.token.usage` far higher for a few sessions", "Those tasks were too large or the agents looped; split them or add a stop condition"],
            ["`claude_code.lines_of_code.count` high but `claude_code.pull_request.count` low", "Agents produce changes that never reach review: failing checks or a merge bottleneck"],
            ["Many rejected `claude_code.tool_decision` events from one rule", "A permission rule blocks a step every agent needs; fix the configuration once"],
            ["Every agent fails the same integration test", "A shared dependency or base commit is broken, not the individual agents"],
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems describe a fan-out that produced conflicting edits, agents that each passed tests but broke the integrated build, or fleet telemetry with one pattern repeated across many sessions. Pick the change to decomposition, isolation or merge strategy that addresses the pattern. Distractors add more agents, retry the failed agents, raise each agent's effort, or have agents share one working directory to see each other's changes.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Retrying a systemic failure",
          text: "When 30 of 40 agents fail at the same step, re-dispatching them burns budget on the same failure. Aggregate the fleet's telemetry first; a shared cause (a broken base commit, a missing secret in `.worktreeinclude`, a permission rule) is fixed once.",
        },
      ],
      terms: ["claude --worktree", ".claude/worktrees", "worktree.baseRef", ".worktreeinclude", "isolation: worktree", "git worktree remove", "claude_code.cost.usage", "claude_code.lines_of_code.count", "claude_code.pull_request.count", "task decomposition"],
      sources: [
        ["Run parallel sessions with worktrees", "https://code.claude.com/docs/en/worktrees"],
        ["Claude Code monitoring", "https://code.claude.com/docs/en/monitoring-usage"],
        ["Run Claude Code programmatically", "https://code.claude.com/docs/en/headless"],
      ],
    },
    {
      objective: "8.2",
      title: "Verification and AI Code Review Operations",
      takeaway:
        "Introduce AI code review in shadow mode, measure its findings against what human reviewers and later incidents show, and give it merge-gating authority only for the finding classes where its precision is proven, while humans stay accountable for what merges.",
      minutes: 7,
      blocks: [
        {
          kind: "text",
          text: "When agents generate pull requests faster than people can read them, review becomes the bottleneck and the place where defects slip through. Two easy responses both fail: waving changes through because review is slow, and blocking merges on an AI reviewer nobody has measured. The operational answer is staged: run AI review alongside human review without authority, compare, calibrate, then hand it authority one finding class at a time.",
        },
        {
          kind: "text",
          text: "Claude Code's managed Code Review service (Team and Enterprise plans, GitHub repositories) runs several agents on each pull request, verifies candidate findings against the code to drop false positives, ranks them by severity and posts inline comments, a summary and a check run named Claude Code Review. By itself the check run does not conclude as a failure and the review does not approve or block a pull request, which makes it a natural shadow-mode starting point. A review reads the diff and surrounding code without building or running it, so tests and CI remain the verification for behavior.",
        },
        {
          kind: "code",
          language: "markdown",
          caption: "REVIEW.md at the repository root of a healthcare billing service (read from the base or default branch)",
          code: `# Review instructions

## What Important means here
Reserve Important for findings that would break claim submission, leak PHI,
or block a rollback: unscoped database queries, PHI in logs, migrations that
are not backward compatible. Style and naming are Nit at most.

## Cap the nits
Report at most five Nits per review.

## Do not report
- Anything CI already enforces: lint, formatting, type errors
- Generated files under src/gen/

## Always check
- Queries are scoped to the caller's tenant
- New endpoints have an integration test`,
        },
        {
          kind: "list",
          items: [
            "Shadow mode: post findings, but do not let them gate. For several weeks, label each finding as true positive, false positive or nit, and record which human-found defects and post-merge incidents the AI review missed.",
            "Calibrate per class. Precision on tenant-scoping findings might be high enough to block merges while precision on concurrency findings is not. Promote classes individually.",
            "Tune with `REVIEW.md` (review-only instructions) and `CLAUDE.md` (project rules the review also reads). `REVIEW.md` is read from the base or default branch, never from the pull request's own changes, so an author cannot weaken the rules in the change under review. Protect the default branch.",
            "Require evidence for noisy classes, for example a `file:line` citation for any behavior claim, to cut false positives that cost authors a round trip.",
            "Design human oversight explicitly: which paths always need a human approver (payments, auth, migrations), who owns a disputed finding, and how reviewer load is measured so approval does not decay into rubber-stamping.",
          ],
        },
        {
          kind: "table",
          headers: ["Stage", "AI review authority", "Exit criterion"],
          rows: [
            ["Shadow", "Comments only; humans review everything", "Labeled precision and recall per finding class over an agreed sample"],
            ["Advisory", "Comments; Important findings require an author response", "Author-dismissal rate and missed-incident rate stable"],
            ["Gating (per class)", "A required status check fails on proven classes", "Precision above the agreed bar for that class; human override path documented"],
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Expect generation outpacing review, an AI reviewer that is either ignored or trusted without data, or a gate that blocks too many good changes. The key introduces review in shadow mode, calibrates against human review and incidents, and grants gating per finding class with humans accountable. Distractors make the AI reviewer a required check on day one, raise its review level everywhere, or remove human review for agent-authored pull requests.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "A clean review read as proof",
          text: "A review with no findings does not mean the change is correct or secure; the service itself says so. Treat AI review as one verification layer alongside tests, type checks and human review of high-risk paths, and track what it misses.",
        },
      ],
      terms: ["Code Review", "Claude Code Review check run", "REVIEW.md", "CLAUDE.md", "review level", "shadow mode", "finding severity", "Important", "Nit", "merge gate"],
      sources: [
        ["Code Review", "https://code.claude.com/docs/en/code-review"],
        ["Customize Code Review", "https://code.claude.com/docs/en/code-review-customize"],
        ["Claude Code GitHub Actions", "https://code.claude.com/docs/en/github-actions"],
      ],
    },
    {
      objective: "8.3",
      title: "Unattended and Event-Driven Agent Operations",
      takeaway:
        "Run an unattended agent only with a verifiable completion condition, the narrowest tools and connectors the run needs, durable checkpoints, a bound on turns or spend, and a notification and escalation path for the moment it stops or needs a decision.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "Unattended runs come in three shapes. Goal-driven: the agent works until a condition holds, such as all tests in a package pass. Schedule-driven: the agent runs at a cadence, such as a nightly dependency audit. Event-driven: something external starts it, such as a failed deployment or a new pull request. Each shape removes the human who would normally notice a stuck or wandering session, so the design work is about what replaces that person: the stop condition, the permission boundary, the checkpoint and the escalation.",
        },
        {
          kind: "table",
          headers: ["Mechanism", "Starts a turn when", "Stops when", "Fits"],
          rows: [
            ["`/goal <condition>`", "The previous turn finishes", "A separate evaluator model judges the condition met or impossible, an unrecoverable error clears it, or `/goal clear`", "Substantial work with a checkable end state"],
            ["`/loop`", "A time interval elapses", "You stop it or it ends on its own", "Polling inside an open session"],
            ["Scheduled task (formerly routines)", "A schedule, an API call to the task's endpoint, or a GitHub event", "The cloud session ends; each run is its own session", "Work that must run with your laptop closed"],
            ["GitHub Actions", "Repository events or cron in your workflow", "The job ends", "CI-tied work on your own runners"],
          ],
        },
        {
          kind: "text",
          text: "Write goal conditions the evaluator can check from the transcript. The `/goal` evaluator runs on the configured small fast model, does not run commands or read files, and judges only what Claude has surfaced. A condition like `npm test exits 0 in packages/claims and no other test file is modified, or stop after 20 turns` names the measurable end state, the proof and the bound. A goal does not change the permission mode, so an unattended goal run needs auto mode or pre-approved rules; with `-p` the loop runs to completion in one invocation.",
        },
        {
          kind: "code",
          language: "bash",
          caption: "Event-driven first response to a failed deploy, bounded and reporting back (illustrative)",
          code: `claude -p "/goal Diagnose the failed deploy in run $RUN_ID: identify the failing step,
link the commit that introduced it, and open a draft PR that reverts or fixes it.
Do not merge or deploy. Stop after 15 turns." \\
  --output-format stream-json --verbose > triage-$RUN_ID.jsonl
# The pipeline posts the draft PR link and the transcript to the on-call channel;
# a human decides whether to merge.`,
        },
        {
          kind: "list",
          items: [
            "Scheduled tasks run as full Claude Code cloud sessions. They start in auto mode where available; an action that matches an ask rule, or repeated blocks, raises a permission prompt that waits in the run's session for someone to answer. Plan who watches for those.",
            "Scope connectors per task: every connected connector is included by default and can be used during a run, including writes. Remove the ones the task does not need.",
            "Pushes go to `claude/`-prefixed branches unless the prompt says otherwise, and runs act as the account that owns the task. Use branch protection or rulesets to control what a run can push, and remember actions appear under the owner's identity.",
            "A run's Succeeded status means the session ended normally, not that the work was done. Read the transcript, or have the prompt write a result artifact you can check.",
            "Checkpoint progress outside the session (a draft PR, a status file, a ticket comment) so a restarted or later run continues from evidence instead of repeating work.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems describe a nightly or event-triggered agent that ran for hours, spent heavily, or made a change nobody noticed until morning. The key adds a verifiable stop condition with a bound, narrows tools and connectors, checkpoints to a reviewable artifact and routes decisions to a person. Distractors raise the turn limit, give the agent broader credentials so it is not blocked, switch to a bigger model, or add a log line nobody reads.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "A condition only the agent can judge",
          text: "A goal like `the code is clean and production ready` invites the evaluator to accept the agent's own claim. Tie completion to an observable result (a test exit code, a file count, an empty queue) and to constraints that must hold on the way.",
        },
      ],
      terms: ["/goal", "/loop", "scheduled tasks", "routines", "auto mode", "claude -p", "--output-format stream-json", "claude/ branches", "GitHub Actions", "escalation path"],
      sources: [
        ["Keep Claude working toward a goal", "https://code.claude.com/docs/en/goal"],
        ["Automate work with scheduled tasks", "https://code.claude.com/docs/en/routines"],
        ["Run Claude Code programmatically", "https://code.claude.com/docs/en/headless"],
        ["Claude Code GitHub Actions", "https://code.claude.com/docs/en/github-actions"],
      ],
    },
    {
      objective: "8.4",
      title: "Organization-Wide Coding Agent Configuration",
      takeaway:
        "Put organization policy in managed settings, which outrank every user and project file, lock the lists that matter (permission rules, hooks, MCP servers, marketplaces) to managed sources, deliver telemetry and gateway routing centrally, and admit shared prompts, Skills, plugins and MCP servers through a reviewed quality and safety bar.",
      minutes: 8,
      blocks: [
        {
          kind: "text",
          text: "Rolling Claude Code out to hundreds of engineers turns configuration into policy. Claude Code reads settings from user (`~/.claude/settings.json`), shared project (`.claude/settings.json`), project local (`.claude/settings.local.json`) and managed sources. Managed settings sit at the top of the precedence order, above command-line `--settings`, local, project and user files, and nothing in a developer's files overrides a managed key. They arrive as server-managed settings from the claude.ai admin console, as MDM or OS policies, or as a `managed-settings.json` file in a system directory. Run `/status` to see which managed source applies.",
        },
        {
          kind: "table",
          headers: ["Goal", "Managed setting", "Effect"],
          rows: [
            ["Only organization permission rules apply", "`allowManagedPermissionRulesOnly`", "Ignores allow, ask and deny rules in user, project, local and `--settings` files and `--allowedTools`"],
            ["Only organization hooks run", "`allowManagedHooksOnly`", "Runs only the hooks your organization deploys"],
            ["No one bypasses permissions", "`permissions.disableBypassPermissionsMode`", "Prevents entering `bypassPermissions` mode"],
            ["Approved MCP catalog", "`allowedMcpServers` plus `allowManagedMcpServersOnly: true`", "Only servers matching managed `serverUrl` or `serverCommand` entries load"],
            ["Block known-bad servers", "`deniedMcpServers`", "Denylist merges from every scope and always wins"],
            ["Approved plugin sources", "`strictKnownMarketplaces`", "Allowlists the marketplace sources users can add and install from"],
          ],
        },
        {
          kind: "text",
          text: "Lists merge across scopes by default, which matters for security keys. Without `allowManagedMcpServersOnly`, a developer's own `allowedMcpServers` broadens yours. Allow by `serverUrl` or `serverCommand`: a `serverName` entry is only the label a user typed and is not a security control. For a fixed server set, deploy `managed-mcp.json` to the system path (for example `/etc/claude-code/managed-mcp.json` on Linux) for exclusive control; to provide remote servers while users keep their own, use the `managedMcpServers` managed setting.",
        },
        {
          kind: "code",
          language: "json",
          caption: "Part of a managed-settings.json for a regulated SaaS engineering org (values illustrative)",
          code: `{
  "allowManagedPermissionRulesOnly": true,
  "allowManagedHooksOnly": true,
  "permissions": { "disableBypassPermissionsMode": "disable" },
  "allowManagedMcpServersOnly": true,
  "allowedMcpServers": [
    { "serverUrl": "https://mcp.internal.example.com/*" },
    { "serverCommand": ["/usr/local/bin/ticketing-mcp", "--readonly"] }
  ],
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel.internal.example.com:4317",
    "ANTHROPIC_BASE_URL": "https://llm-gateway.internal.example.com"
  }
}`,
        },
        {
          kind: "list",
          items: [
            "Telemetry belongs in managed settings. Repository `.claude/settings.json` and `.claude/settings.local.json` ignore OpenTelemetry exporter variables, so a repo cannot enable export, change the destination or turn on content capture. Content stays redacted unless you set switches such as `OTEL_LOG_USER_PROMPTS` or `OTEL_LOG_TOOL_DETAILS`; decide those with your privacy team.",
            "Gateway routing: point Claude Code at your LLM gateway with `ANTHROPIC_BASE_URL` and a gateway credential (or `apiKeyHelper`) distributed through managed settings and secrets tooling. The gateway centralizes credentials, usage attribution, budgets and audit logging, but it becomes infrastructure you must keep current with the headers and features Claude Code sends.",
            "Governance for shared assets: treat a shared prompt, Skill, plugin or MCP server like a library. Require an owner, a review of every file (Skills and plugins can run code and direct tool calls), an eval or test showing it does what its description says, pinned versions, and a removal path. Distribute approved items through a managed plugin marketplace.",
            "Verify enforcement after every rollout: `/status` for setting sources, `claude mcp list` for the effective server set, and a deliberate `claude mcp add` of an unapproved server, which should fail with an enterprise-policy error.",
          ],
        },
        {
          kind: "callout",
          tone: "exam",
          title: "How the exam frames it",
          text: "Stems describe developers adding unapproved MCP servers, telemetry that only some teams send, a project file that loosened permissions, or a shared Skill that misbehaved. The key uses the managed tier with the matching lock key, or a review gate for shared assets. Distractors put policy in a committed project file, allowlist servers by name, ask teams to opt in to telemetry, or write the rule into `CLAUDE.md`.",
        },
        {
          kind: "callout",
          tone: "pitfall",
          title: "Policy in a project file",
          text: "A rule in `.claude/settings.json` reaches only people who clone that repository, can be edited in any pull request, and merges with whatever users add. Organization policy belongs in managed settings with the lock keys set, and a project file is for team conventions.",
        },
      ],
      terms: ["managed-settings.json", "server-managed settings", "allowManagedPermissionRulesOnly", "allowManagedHooksOnly", "allowedMcpServers", "deniedMcpServers", "allowManagedMcpServersOnly", "managed-mcp.json", "strictKnownMarketplaces", "CLAUDE_CODE_ENABLE_TELEMETRY", "ANTHROPIC_BASE_URL"],
      sources: [
        ["Claude Code settings and precedence", "https://code.claude.com/docs/en/settings"],
        ["Control MCP server access for your organization", "https://code.claude.com/docs/en/managed-mcp"],
        ["Claude Code monitoring", "https://code.claude.com/docs/en/monitoring-usage"],
        ["Other LLM gateways", "https://code.claude.com/docs/en/llm-gateway"],
      ],
    },
  ],
};
