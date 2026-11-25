import type { LessonBlock, LessonSet } from "./types";

// Lessons for Claude Certified Architect – Foundations (CCAR-F), guide v1.1 (November 2026).
// Technical details were checked against code.claude.com/docs, platform.claude.com/docs and the
// MCP specification (2026-07-28). Where the exam guide and current docs use different names,
// the lesson teaches the exam term and says what the docs call it today.

const text = (value: string): LessonBlock => ({ kind: "text", text: value });
const code = (language: Extract<LessonBlock, { kind: "code" }>["language"], caption: string, value: string): LessonBlock => ({ kind: "code", language, caption, code: value });
const list = (...items: string[]): LessonBlock => ({ kind: "list", items });
const table = (headers: string[], rows: string[][]): LessonBlock => ({ kind: "table", headers, rows });
const exam = (title: string, value: string): LessonBlock => ({ kind: "callout", tone: "exam", title, text: value });
const pitfall = (title: string, value: string): LessonBlock => ({ kind: "callout", tone: "pitfall", title, text: value });
const tip = (title: string, value: string): LessonBlock => ({ kind: "callout", tone: "tip", title, text: value });

const DOCS = {
  toolCalls: ["Handle tool calls (Claude API)", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls"],
  stopReasons: ["Handling stop reasons", "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons"],
  defineTools: ["Define tools (Claude API)", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"],
  structured: ["Structured outputs", "https://platform.claude.com/docs/en/build-with-claude/structured-outputs"],
  batches: ["Batch processing (Message Batches API)", "https://platform.claude.com/docs/en/build-with-claude/batch-processing"],
  prompting: ["Prompting best practices", "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"],
  agentLoop: ["Agent SDK: how the agent loop works", "https://code.claude.com/docs/en/agent-sdk/agent-loop"],
  sdkSubagents: ["Agent SDK: subagents", "https://code.claude.com/docs/en/agent-sdk/subagents"],
  sdkHooks: ["Agent SDK: hooks", "https://code.claude.com/docs/en/agent-sdk/hooks"],
  sdkSessions: ["Agent SDK: sessions", "https://code.claude.com/docs/en/agent-sdk/sessions"],
  sdkTools: ["Agent SDK: custom tools", "https://code.claude.com/docs/en/agent-sdk/custom-tools"],
  hooks: ["Claude Code hooks reference", "https://code.claude.com/docs/en/hooks"],
  memory: ["Claude Code memory (CLAUDE.md and rules)", "https://code.claude.com/docs/en/memory"],
  skills: ["Claude Code skills", "https://code.claude.com/docs/en/skills"],
  subAgents: ["Claude Code subagents", "https://code.claude.com/docs/en/sub-agents"],
  mcp: ["Claude Code MCP", "https://code.claude.com/docs/en/mcp"],
  cli: ["Claude Code CLI reference", "https://code.claude.com/docs/en/cli-reference"],
  headless: ["Run Claude Code programmatically", "https://code.claude.com/docs/en/headless"],
  sessions: ["Claude Code sessions", "https://code.claude.com/docs/en/sessions"],
  permissionModes: ["Claude Code permission modes (plan mode)", "https://code.claude.com/docs/en/permission-modes"],
  tools: ["Claude Code tools reference", "https://code.claude.com/docs/en/tools-reference"],
  commands: ["Claude Code commands", "https://code.claude.com/docs/en/commands"],
  bestPractices: ["Claude Code best practices", "https://code.claude.com/docs/en/best-practices"],
  mcpTools: ["MCP specification: tools", "https://modelcontextprotocol.io/specification/2026-07-28/server/tools"],
  mcpResources: ["MCP specification: resources", "https://modelcontextprotocol.io/specification/2026-07-28/server/resources"],
} as const satisfies Record<string, readonly [string, string]>;

export const architectFoundationsLessons: LessonSet = {
  overview:
    "CCAR-F is a proctored exam: 60 multiple-choice and multiple-response items in 120 minutes, drawn from 4 of 6 production scenarios (support agent, Claude Code code generation, multi-agent research, developer productivity, CI/CD, structured extraction). You pass at a scaled 720 on a 100 to 1,000 scale. Items are judgment-heavy: several options would work in a demo, and you must pick the one that holds up in production. Three habits carry most items. When a rule must always hold, prefer a structural fix (a hook, a schema, a scoped tool list, the right config file) over a prompt tweak. Fix the root cause the scenario describes before adding infrastructure. And know exact names, because distractors cite flags and files that do not exist.",
  lessons: [
    // ───────────────────────────── Domain 1 ─────────────────────────────
    {
      objective: "1.1",
      title: "Run the agent loop on stop_reason",
      takeaway: "Loop while `stop_reason` is \"tool_use\": run every requested tool, append the assistant turn plus matching `tool_result` blocks, and call again. Stop on \"end_turn\", and treat turn caps as a safety net rather than the exit condition.",
      minutes: 4,
      blocks: [
        text("An agentic loop is a plain control structure around the Messages API. You send the conversation, the tool definitions and the system prompt. Claude answers with content blocks and a `stop_reason`. When `stop_reason` is \"tool_use\", the response contains one or more `tool_use` blocks, each with an `id`, a `name` and an `input`. Your code runs those tools, appends the assistant message exactly as returned, then appends a user message holding one `tool_result` per call, each pointing back with `tool_use_id`. You call the API again with the longer history. When `stop_reason` is \"end_turn\", Claude has finished and the last text is the answer."),
        text("The history is the agent's working memory. Claude does not remember the previous call; it reasons only over what you send. Appending the tool results is what lets the model read an order status, notice the order is outside the return window, and decide on its own to call a policy tool next. That is model-driven decision-making: the next step is chosen from evidence in context. The alternative, a pre-configured decision tree that always calls tools A then B then C, is predictable but cannot adapt when a result changes what should happen next."),
        code("python", "A minimal loop with the Anthropic Python SDK (TOOLS, SYSTEM_PROMPT and run_tool are yours)", `import anthropic

client = anthropic.Anthropic()
messages = [{"role": "user", "content": "Where is order 8812, and can I still return it?"}]

while True:
    response = client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        messages=messages,
    )
    # Keep the assistant turn exactly as returned, tool_use blocks included.
    messages.append({"role": "assistant", "content": response.content})

    if response.stop_reason == "tool_use":
        results = []
        for block in response.content:
            if block.type == "tool_use":
                output, failed = run_tool(block.name, block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,  # must match the request
                    "content": output,
                    "is_error": failed,
                })
        # Every result for this turn goes back in ONE user message.
        messages.append({"role": "user", "content": results})
        continue

    if response.stop_reason == "end_turn":
        break

    handle_other_stop(response)  # max_tokens, refusal, pause_turn, ...
    break`),
        text("Three details trip people up. First, Claude may request several tools in one response; return all of their results together in the next user message. Second, inside that user message the `tool_result` blocks must come before any text you add, or the API rejects the request. Third, a failed tool still gets a `tool_result`: set `is_error` to true and describe the failure so Claude can retry, change course or explain the problem."),
        table(["stop_reason", "Meaning", "What the loop does"], [
          ["\"tool_use\"", "Claude wants one or more tools run", "Execute each call, append results, call again"],
          ["\"end_turn\"", "Claude finished its response", "Exit the loop and use the final text"],
          ["\"max_tokens\"", "Output hit your `max_tokens` limit", "Raise the limit or continue; a tool_use block may be cut off"],
          ["\"pause_turn\"", "A server-tool loop hit its iteration limit", "Send the assistant content back to let it continue"],
          ["\"refusal\" / \"stop_sequence\" / \"model_context_window_exceeded\"", "Declined, hit a stop sequence, or ran out of context", "Handle explicitly; do not treat as success"],
        ]),
        list(
          "Anti-pattern: parsing the reply for phrases like 'task complete' to decide when to stop. Wording varies; `stop_reason` does not.",
          "Anti-pattern: a hard cap of N iterations as the main stopping rule. It cuts off legitimate long tasks and hides runaway loops instead of fixing them.",
          "Anti-pattern: stopping as soon as the response contains text. Claude often writes a sentence and then requests a tool in the same response.",
        ),
        text("Caps still belong in production, but as a guard. The Agent SDK runs this loop for you and exposes `max_turns` (Python) or `maxTurns` (TypeScript); when the cap is hit, the final `ResultMessage` has subtype `error_max_turns`, which you log and investigate as an incident rather than treat as a normal finish."),
        exam("How the exam frames it", "Several answers will make a demo stop. The production-grade one branches on the structured `stop_reason` field, continues on \"tool_use\", ends on \"end_turn\", and feeds tool results back into history. Options that parse text, count iterations, or look for any text block are the distractors."),
        pitfall("Dropping the assistant turn", "If you append only the tool results and forget the assistant message that contained the `tool_use` blocks, the `tool_use_id` references point at nothing and the request fails. Always append the assistant content first, unchanged."),
      ],
      terms: ["stop_reason", "tool_use", "end_turn", "tool_result", "tool_use_id", "is_error", "max_tokens", "pause_turn", "refusal", "max_turns", "maxTurns", "error_max_turns", "ResultMessage"],
      sources: [DOCS.toolCalls, DOCS.stopReasons, DOCS.agentLoop],
    },
    {
      objective: "1.2",
      title: "Coordinate specialist agents through a hub",
      takeaway: "Put one coordinator at the center: it decomposes the request, picks only the subagents the query needs, gives each a distinct slice of scope, and loops synthesis back to targeted re-delegation until coverage criteria are met. Subagents never talk to each other directly.",
      minutes: 4,
      blocks: [
        text("In a hub-and-spoke system, the coordinator is the only agent that sees the whole task. It breaks the request into pieces, decides which specialists to call, sends each one a self-contained assignment, collects their results, checks them, and assembles the answer. Each subagent runs in its own isolated context. It does not inherit the coordinator's conversation, and it does not see what sibling agents found unless the coordinator passes that along. Isolation is a feature: a web searcher that reads forty pages does not flood the coordinator's context, because only its final report comes back."),
        text("Routing every message through the hub gives you three production properties. Observability: one place logs who was asked what and what came back. Consistent error handling: one component decides whether a failed search is retried, rerouted or reported as a gap. Controlled information flow: the coordinator decides what context each worker receives, so a synthesis agent cannot quietly start doing its own research. Peer-to-peer chatter between subagents loses all three."),
        text("A good coordinator is selective. A simple factual question may need only the search agent; a request for a cited market report needs search, document analysis, synthesis and report generation. Sending every request through the full pipeline wastes time and money and adds failure points. Have the coordinator analyze the query first and choose the smallest set of specialists that can answer it."),
        code("python", "Sketch of a coordinator refinement loop (all functions are your own orchestration code)", `plan = coordinator.plan(question)              # choose specialists, split scope
findings = run_parallel(plan.assignments)      # each assignment owns a distinct slice

for _ in range(MAX_ROUNDS):                    # safety cap, not the exit rule
    draft = synthesize(findings)
    gaps = coordinator.review(draft, criteria=COVERAGE_CRITERIA)
    if not gaps:                               # exit when coverage criteria are met
        break
    findings += run_parallel(targeted_queries(gaps))

report = generate_report(draft)`),
        text("Decomposition has two failure modes. Too narrow, and coverage collapses: asked about the effect of remote work on cities, a coordinator that only assigns 'office vacancy rates' and 'commuter traffic' will miss housing, small business and tax revenue, and the final report looks complete while missing half the topic. Too overlapping, and three agents fetch the same five articles. Partition deliberately: give each subagent a distinct subtopic or a distinct source type (academic papers, government statistics, news), and state the boundaries in each assignment."),
        text("Iterative refinement closes the loop. After the first synthesis, the coordinator compares the draft against explicit coverage criteria, such as each subtopic having at least two independent sources and every statistic being cited. For each gap it sends a targeted query back to search or analysis, then re-runs synthesis. The loop ends when the criteria pass, with a round cap only as protection."),
        table(["Decision", "Weak design", "Production design"], [
          ["Which agents run", "Every request runs the full pipeline", "Coordinator selects agents based on the query"],
          ["Scope split", "Overlapping or overly narrow subtopics", "Distinct subtopics or source types per agent, covering the whole question"],
          ["Quality check", "Accept the first synthesis", "Evaluate for gaps, re-delegate targeted queries, re-synthesize"],
          ["Communication", "Subagents call each other", "All traffic routed through the coordinator"],
        ]),
        exam("How the exam frames it", "When a report is well written but misses whole areas of the topic, the root cause is usually the coordinator's decomposition, not the search or synthesis agents. Several fixes are possible; the production-grade one changes how the coordinator partitions scope and checks coverage, rather than tuning a downstream worker's prompt."),
        pitfall("Blaming the last agent in the chain", "Gaps show up in the final report, so candidates often fix the report generator. Trace the coverage problem upstream to the assignments the coordinator handed out."),
      ],
      terms: ["coordinator", "subagent", "hub-and-spoke", "iterative refinement"],
      sources: [DOCS.sdkSubagents, DOCS.prompting],
    },
    {
      objective: "1.3",
      title: "Spawn subagents with explicit, structured context",
      takeaway: "A subagent knows only its own definition and the prompt string you hand it, so pass complete prior findings in structured form, emit parallel spawns in one response, and describe goals and quality bars rather than step-by-step procedures.",
      minutes: 3,
      blocks: [
        text("In the Claude Agent SDK, a coordinator starts a subagent by calling the subagent tool. The exam guide calls it the Task tool. Current docs call it the Agent tool: it was renamed in Claude Code 2.1.63, `tool_use` blocks now carry the name \"Agent\", and \"Task\" still works as an alias in settings and definitions. Either way the rule is the same: the coordinator's `allowedTools` (`allowed_tools` in Python) must list that tool, or it cannot spawn workers without a permission prompt."),
        text("You describe each worker with an `AgentDefinition`. The `description` tells the coordinator when to use it, the `prompt` is the worker's system prompt, and `tools` restricts what it may call. Optional fields include `model` and `disallowedTools`. Keep descriptions specific, because the coordinator picks a worker by matching the task against them."),
        code("python", "Coordinator options with two scoped subagents (Claude Agent SDK, Python)", `from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

options = ClaudeAgentOptions(
    # The coordinator must be allowed to spawn workers. Docs name the tool
    # "Agent"; the exam guide and older SDK versions call it "Task".
    allowed_tools=["Agent", "Read"],
    agents={
        "web-searcher": AgentDefinition(
            description="Searches the web for ONE assigned subtopic and returns findings as JSON.",
            prompt="Search only the subtopic you are given. Return every finding with its source URL and publication date.",
            tools=["WebSearch", "WebFetch"],
        ),
        "synthesizer": AgentDefinition(
            description="Merges findings supplied in its prompt into a cited draft. Never searches.",
            prompt="Combine the findings you receive. Keep every claim linked to its source.",
            tools=["Read"],
        ),
    },
)`),
        text("Context does not flow automatically. A non-fork subagent starts with a fresh window: its own system prompt, the prompt string from the spawning call, tool definitions and, if settings load it, the project CLAUDE.md. It does not get the parent's conversation, tool results or system prompt, and a fresh invocation shares no memory with earlier invocations of itself unless you explicitly resume that subagent by its agent ID. So when the synthesis agent needs the search and document-analysis results, the coordinator must paste those results into the synthesis prompt in full. 'Use the findings from earlier' means nothing to a worker that never saw them."),
        text("Structure that handoff. Separate the content from its metadata so attribution survives each hop: give every finding a claim, an evidence excerpt, and source fields such as URL, document name, page and date. Free-form paragraphs invite the next agent to merge claims and drop citations."),
        code("json", "A structured handoff the coordinator pastes into the synthesis prompt", `{
  "goal": "Summarize how municipal EV charging programs were funded, 2022-2026",
  "quality_bar": "Every claim cited; flag conflicting figures instead of choosing one",
  "findings": [
    {
      "claim": "Grant funding covered most installation costs in the pilot cities",
      "evidence": "Federal grants paid 68% of installed cost across 12 pilots.",
      "source": { "url": "https://example.gov/ev-pilots", "document": null, "page": null },
      "published": "2025-04-02"
    }
  ]
}`),
        list(
          "Parallel spawning: emit several subagent calls in a single coordinator response. Claude Code runs them concurrently, so independent research finishes in the time of the slowest worker, not the sum of all of them.",
          "Sequential spawning across separate turns serializes independent work and is the slower, less correct answer when tasks do not depend on each other.",
          "Goal-oriented prompts: tell a worker what to find and what good looks like (coverage, recency, source quality). Rigid step lists stop it from adapting when the first search reveals a better angle.",
          "Fork-based sessions are a different tool: they copy a whole conversation so you can explore two approaches from one analysis baseline. Lesson 1.7 covers `fork_session`.",
        ),
        exam("How the exam frames it", "If a synthesis or report agent produces vague or uncited output, ask what was in its prompt. Several answers mention better instructions; the production-grade fix passes the complete upstream findings, with source metadata kept in separate fields, directly in the subagent's prompt."),
        pitfall("Assuming inheritance", "Subagents do not see the coordinator's history, and two fresh calls to the same subagent do not share memory (only an explicit resume carries a subagent's transcript forward). Any option that relies on a worker 'remembering' or 'already knowing' earlier results is wrong."),
      ],
      terms: ["Task tool", "Agent tool", "allowedTools", "allowed_tools", "AgentDefinition", "description", "prompt", "tools", "disallowedTools", "ClaudeAgentOptions", "agents", "fork_session"],
      sources: [DOCS.sdkSubagents, DOCS.subAgents],
    },
    {
      objective: "1.4",
      title: "Enforce prerequisites in code, hand off with structure",
      takeaway: "When a step must always happen first, such as verifying identity before any refund, block the downstream tool in code until the prerequisite has succeeded. When escalating, send the human a structured summary because they cannot read the transcript.",
      minutes: 3,
      blocks: [
        text("Prompt guidance and programmatic enforcement are different kinds of control. A system prompt that says 'always call get_customer before lookup_order' works most of the time, but its failure rate is never zero. When the cost of a miss is a misidentified account or money sent to the wrong person, 'most of the time' is not acceptable. Programmatic enforcement puts a gate in your code, a hook or a check in the tool layer, that refuses the downstream call until the prerequisite has returned what you need. The model can still make the wrong request, but the request cannot succeed."),
        text("The Agent SDK gives you two places to put that gate. A `PostToolUse` hook can record that `get_customer` returned a verified customer ID. A `PreToolUse` hook on `lookup_order` and `process_refund` can then deny the call, with a reason, if no verified ID is on record for this session. The denial reason goes back to Claude, which typically calls `get_customer` and tries again."),
        code("python", "Gate order and refund tools behind a verified customer (Agent SDK hooks)", `from claude_agent_sdk import ClaudeAgentOptions, HookMatcher

verified: dict[str, str] = {}  # session_id -> verified customer id

async def record_verification(input_data, tool_use_id, context):
    customer_id = parse_verified_id(input_data["tool_response"])  # your parser
    if customer_id:
        verified[input_data["session_id"]] = customer_id
    return {}

async def require_verified_customer(input_data, tool_use_id, context):
    if input_data["session_id"] not in verified:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Verify the customer with get_customer first.",
            }
        }
    return {}  # no decision: normal permission flow applies

options = ClaudeAgentOptions(
    mcp_servers={"support": support_server},
    hooks={
        "PostToolUse": [HookMatcher(matcher="mcp__support__get_customer", hooks=[record_verification])],
        "PreToolUse": [HookMatcher(
            matcher="mcp__support__lookup_order|mcp__support__process_refund",
            hooks=[require_verified_customer],
        )],
    },
)`),
        text("Multi-concern requests need decomposition before action. 'My last order arrived damaged, I was charged twice, and I want to change my email' is three items. Split them into a list, investigate each one (in parallel where they are independent) against the same verified customer context, and then write one reply that resolves or explains each item. Handling only the first concern, or answering three times, both look broken to the customer."),
        text("Some cases must still go to a person mid-process. The human agent who picks up the ticket usually cannot see the conversation, so a bare 'escalated' is a dead end. Compile a structured handoff with what they need to act at once."),
        code("json", "A structured escalation payload for escalate_to_human", `{
  "customer_id": "C-20931",
  "verified": true,
  "issues": [
    {
      "summary": "Duplicate charge on order 8812",
      "root_cause": "Payment retried after gateway timeout; both captures settled",
      "evidence": ["charge ch_1 on 2026-11-02", "charge ch_2 on 2026-11-02"],
      "refund_amount": 642.10,
      "recommended_action": "Refund the second capture; amount exceeds agent limit"
    }
  ],
  "already_done": ["Confirmed identity", "Resolved email change"],
  "customer_expectation": "Refund before the statement date of Nov 28"
}`),
        table(["Approach", "Guarantee", "Use it for"], [
          ["System prompt instruction", "Probabilistic; usually followed", "Style, tone, soft preferences"],
          ["Few-shot examples of the right order", "Probabilistic; improves consistency", "Judgment calls with no single correct sequence"],
          ["Hook or tool-layer prerequisite gate", "Deterministic; the call cannot succeed out of order", "Identity before money, compliance steps, irreversible actions"],
        ]),
        exam("How the exam frames it", "A scenario reports that the agent sometimes skips verification. Stronger prompt wording, more examples and a routing classifier are all possible. The production-grade answer is a programmatic prerequisite that blocks the order and refund tools until verification has returned a customer ID, because financial operations need deterministic compliance."),
        pitfall("Fixing ordering with tool availability", "Removing tools per request type controls which tools exist, not the order they run in. If the problem is sequence, the fix must gate the sequence."),
      ],
      terms: ["PreToolUse", "PostToolUse", "HookMatcher", "hookSpecificOutput", "permissionDecision", "permissionDecisionReason", "tool_response", "mcp__<server>__<tool>", "escalate_to_human"],
      sources: [DOCS.sdkHooks, DOCS.hooks],
    },
    {
      objective: "1.5",
      title: "Intercept and normalize tool traffic with hooks",
      takeaway: "Use `PreToolUse` hooks to block or rewrite policy-violating calls before they run, and `PostToolUse` hooks to normalize or trim results before Claude reads them. Choose hooks over prompt instructions whenever the business rule must hold every time.",
      minutes: 3,
      blocks: [
        text("Hooks are your code running at fixed points in the agent loop. Two events matter most for this objective. `PreToolUse` fires after Claude asks for a tool and before the tool runs, so it can allow, deny, ask, or defer the call, and can replace the input with `updatedInput`. `PostToolUse` fires after the tool returns and before Claude sees the result, so it can add `additionalContext` or replace the result with `updatedToolOutput`. In the Agent SDK you register callbacks with `HookMatcher` objects; in Claude Code you declare shell commands in settings. Both use the same JSON output format."),
        text("Normalization is the classic `PostToolUse` job. Three MCP servers might report time as Unix seconds, ISO 8601 strings and local date text, and status as 2, \"SHIPPED\" and \"in transit\". Asking the model to reconcile formats on every turn wastes tokens and invites mistakes. A hook that converts everything to one shape makes the data consistent before reasoning starts."),
        code("python", "PostToolUse hook that normalizes timestamps and numeric status codes", `from datetime import datetime, timezone

STATUS = {0: "pending", 1: "shipped", 2: "delivered", 3: "returned"}

def normalize(value, key=""):
    if isinstance(value, dict):
        return {k: normalize(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize(v, key) for v in value]
    if key.endswith("_at") and isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    if key == "status" and isinstance(value, int):
        return STATUS.get(value, f"unknown({value})")
    return value

async def normalize_order_data(input_data, tool_use_id, context):
    # Same structure in, same structure out: only values change.
    return {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "updatedToolOutput": normalize(input_data["tool_response"]),
        }
    }`),
        text("Interception is the `PreToolUse` job. A refund above a threshold should never execute automatically, whatever the conversation says. The hook reads `tool_input`, denies the call when the amount is too high, and uses `permissionDecisionReason` to steer Claude toward the alternative workflow, here an escalation to a human."),
        code("python", "PreToolUse hook that blocks large refunds and redirects to escalation", `REFUND_LIMIT = 500

async def cap_refunds(input_data, tool_use_id, context):
    amount = float(input_data["tool_input"].get("amount", 0))
    if amount > REFUND_LIMIT:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    f"Refunds over {REFUND_LIMIT} USD need a human. "
                    "Call escalate_to_human with a structured handoff instead."
                ),
            }
        }
    return {}

hooks = {"PreToolUse": [HookMatcher(matcher="mcp__billing__process_refund", hooks=[cap_refunds])]}`),
        text("The same rule as a Claude Code command hook lives in `.claude/settings.json`. The script receives the event as JSON on stdin; exiting with code 2 blocks the call and sends its stderr to Claude, or it can print the `hookSpecificOutput` JSON shown above and exit 0."),
        code("json", ".claude/settings.json command hook for the same tool", `{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__billing__process_refund",
        "hooks": [
          { "type": "command", "command": "\${CLAUDE_PROJECT_DIR}/.claude/hooks/refund-limit.sh" }
        ]
      }
    ]
  }
}`),
        table(["Need", "Mechanism", "Strength"], [
          ["Stop a call that breaks policy", "`PreToolUse` with `permissionDecision: \"deny\"`", "Deterministic"],
          ["Rewrite arguments (for example, force a sandbox path)", "`PreToolUse` with `updatedInput`", "Deterministic"],
          ["Make heterogeneous results consistent or smaller", "`PostToolUse` with `updatedToolOutput`", "Deterministic"],
          ["Encourage a behavior", "System prompt instruction", "Probabilistic"],
        ]),
        text("Matchers decide which calls a hook sees. A matcher is the tool name or a regular expression over it, such as `Write|Edit` or `mcp__billing__.*` for every tool on one MCP server. Keep matchers narrow, so a normalization hook for order data never rewrites unrelated results, and a deny rule for refunds never blocks a harmless lookup."),
        exam("How the exam frames it", "When a rule has financial, legal or safety consequences, several answers will reduce violations. The production-grade one enforces it in a hook, because prompts produce probabilistic compliance and hooks produce guaranteed compliance. Pick prompt changes only when occasional misses are acceptable."),
        pitfall("Expecting PostToolUse to undo an action", "`PostToolUse` only changes what Claude sees; the tool has already run. A refund that should never happen must be stopped in `PreToolUse`. Note too that `updatedMCPToolOutput` is the older MCP-only field; `updatedToolOutput` works for built-in and MCP tools."),
      ],
      terms: ["PreToolUse", "PostToolUse", "HookMatcher", "matcher", "permissionDecision", "permissionDecisionReason", "updatedInput", "updatedToolOutput", "updatedMCPToolOutput", "additionalContext", "tool_input", "tool_response", ".claude/settings.json", "CLAUDE_PROJECT_DIR", "exit code 2"],
      sources: [DOCS.sdkHooks, DOCS.hooks],
    },
    {
      objective: "1.6",
      title: "Choose fixed chains or adaptive decomposition",
      takeaway: "Use a fixed prompt chain when the steps are known in advance, such as per-file review passes followed by an integration pass. Use adaptive decomposition when what you find decides what to do next, as with an open-ended investigation.",
      minutes: 4,
      blocks: [
        text("Decomposition means splitting a large task into smaller units that Claude can do well. The exam tests two patterns and when each fits. Prompt chaining is a fixed sequence of focused calls in which each step's output feeds the next. You decide the steps before you start. Dynamic, adaptive decomposition starts with a goal and lets the plan grow from what each step uncovers. You decide only the first step."),
        text("Chaining fits predictable, multi-aspect work. A code review always has the same shape: look at each changed file, then look at how the files interact. Running one giant prompt over twenty files dilutes attention. The model skims, misses local bugs in the middle files, and sometimes contradicts itself across files. Splitting the work into a local pass per file plus a separate cross-file integration pass gives each call a narrow, checkable job. You can also inspect and log intermediate outputs, which the prompting docs list as the main reason to chain explicitly."),
        code("python", "Fixed chain: per-file passes, then one integration pass (review_file and integrate are your functions)", `local_findings = {}
for path, diff in changed_files.items():
    # Each call sees one file's diff plus shared project conventions.
    local_findings[path] = review_file(path, diff, conventions=CONVENTIONS)

# A separate call looks only at interactions: data flow, contracts, call sites.
integration_findings = integrate(
    summaries={p: f["summary"] for p, f in local_findings.items()},
    interfaces=extract_interfaces(changed_files),
)

report = merge(local_findings, integration_findings)`),
        text("Adaptive decomposition fits open-ended investigation. Take 'add comprehensive tests to this legacy codebase'. Nobody knows the right subtasks up front. A good plan starts by mapping structure: modules, entry points, existing tests, build commands. Next it identifies high-impact areas, such as code that handles money, has many callers, or changes often and has no tests. Then it writes a prioritized plan and revises it as dependencies appear. If the payment module turns out to need a fake clock before it can be tested, that becomes a new subtask ahead of the original order. A fixed chain written on day one would have missed it."),
        list(
          "Map: list modules, entry points and the current test layout before planning anything.",
          "Prioritize: rank areas by risk and impact, not alphabetically or by file size.",
          "Plan: write the ordered subtasks down, ideally in a file the agent can re-read.",
          "Adapt: when a step reveals a dependency or a blocker, insert or reorder subtasks instead of pushing through the stale plan.",
        ),
        table(["Signal in the scenario", "Pattern", "Why"], [
          ["Same steps every time; several known aspects to check", "Prompt chaining", "Predictable, inspectable, each call stays focused"],
          ["Large review spanning many files", "Per-file passes plus an integration pass", "Avoids attention dilution and contradictory findings"],
          ["Goal is clear but the path is unknown", "Dynamic decomposition", "Subtasks depend on what earlier steps discover"],
          ["Plan made early is going stale", "Re-plan from new findings", "A rigid plan wastes effort on paths that no longer matter"],
        ]),
        text("The two patterns combine. An adaptive investigation can choose to run a fixed review chain once it knows which files matter, and a chained pipeline can include an open-ended research step. What the exam checks is whether you can match the pattern to how predictable the work is."),
        exam("How the exam frames it", "A single-pass review of a big pull request misses bugs and gives inconsistent verdicts. Bigger context windows, stronger wording and a different model are all offered. The production-grade answer splits the review into focused per-file passes plus a cross-file integration pass. For open-ended work, look for the option that maps first and adapts the plan as it learns."),
        pitfall("A fixed plan for an unknown problem", "Writing every subtask up front for an exploratory job looks organized but breaks on the first surprise. If the scenario stresses discovery, the right answer lets findings reshape the plan."),
      ],
      terms: ["prompt chaining", "dynamic decomposition", "integration pass"],
      sources: [DOCS.prompting, DOCS.bestPractices],
    },
    {
      objective: "1.7",
      title: "Resume, fork, or restart a session",
      takeaway: "Resume a named session when its context is still mostly valid, and tell it exactly which files changed. Fork when you want two directions from one baseline. Start fresh with an injected summary when old tool results are stale.",
      minutes: 3,
      blocks: [
        text("Sessions carry everything Claude has seen: prompts, reasoning and every tool result. That is valuable when the facts still hold and harmful when they do not. This objective is about choosing between continuing a session, branching it, and replacing it."),
        text("In the Claude Code CLI, name a session with `-n` (or `--name`) at launch, or with `/rename` mid-session. Later, `claude --resume <name>` (or `-r`) reopens it with its full history. `--continue` (`-c`) picks the most recent conversation in the current directory. Adding `--fork-session` to a resume creates a new session ID that starts from a copy of the history, leaving the original untouched. Inside a session, `/branch` does the same interactively. In the Agent SDK, capture `session_id` from the result message, pass it as `resume`, and add `fork_session=True` (Python) or `forkSession: true` (TypeScript) to branch."),
        code("bash", "Claude Code CLI: name, resume and fork sessions", `# Day 1: start a named investigation
claude -n "refund-flow-audit"

# Day 2: pick it up where it left off
claude --resume refund-flow-audit

# Try a different approach without disturbing the original thread
claude --resume refund-flow-audit --fork-session`),
        code("python", "Agent SDK: fork from a shared analysis baseline", `from claude_agent_sdk import query, ClaudeAgentOptions

async def compare_strategies(baseline_id: str):
    # baseline_id was captured from ResultMessage.session_id after the codebase analysis.
    # Each fork gets its own new session ID; the baseline session is left unchanged.
    async for message in query(
        prompt="Using that analysis, design an integration-test-first strategy.",
        options=ClaudeAgentOptions(resume=baseline_id, fork_session=True),
    ):
        ...

    async for message in query(
        prompt="Using the same analysis, design a unit-test-first strategy.",
        options=ClaudeAgentOptions(resume=baseline_id, fork_session=True),
    ):
        ...`),
        text("Forking branches the conversation, not the filesystem. Two forks that edit the same working directory will see each other's file changes. Compare approaches on paper in forks, or give each branch its own worktree before letting both write code."),
        text("Resuming has a hidden cost: the old tool results are still in context and Claude trusts them. If you edited `refunds.py` overnight, the session still remembers yesterday's version. Tell the resumed session precisely what changed, for example 'refunds.py and ledger.py were modified since we last spoke; re-read those two and re-check your conclusions about them', so it re-analyzes those files instead of re-exploring the whole codebase or silently relying on stale reads."),
        text("When most of the earlier results are stale, because of a big merge, a branch switch or days of team commits, resuming does more harm than good. Start a new session and inject a structured summary of what still holds: key decisions, open questions, file paths that matter and what must be re-verified. A clean context with a reliable summary beats a long context full of outdated observations."),
        table(["Situation", "Choose", "Mechanism"], [
          ["Continue yesterday's work; little has changed", "Resume", "`claude --resume <name>` / SDK `resume`"],
          ["A few known files changed", "Resume and name the changes", "Resume, then list the changed files for targeted re-analysis"],
          ["Compare two strategies from one analysis", "Fork", "`--fork-session`, `/branch`, SDK `fork_session` / `forkSession`"],
          ["Much of the prior context is stale", "Fresh session plus summary", "New session with an injected structured summary"],
          ["Most recent conversation, no name needed", "Continue", "`claude --continue` / SDK `continue_conversation`"],
        ]),
        exam("How the exam frames it", "Resuming, forking and starting over can all 'work'. The production-grade choice depends on whether the prior tool results are still true. Mostly valid means resume and point at the changes. Largely stale means start fresh with a structured summary. Two divergent explorations from a shared baseline means fork."),
        pitfall("Resuming silently after code changes", "A resumed session does not know the files changed. Answers built on stale reads look confident and are wrong. Always state what changed, or start over if too much did."),
      ],
      terms: ["--resume", "-r", "--name", "-n", "/rename", "--continue", "--fork-session", "/branch", "resume", "fork_session", "forkSession", "session_id", "continue_conversation"],
      sources: [DOCS.sessions, DOCS.sdkSessions, DOCS.cli],
    },
    // ───────────────────────────── Domain 2 ─────────────────────────────
    {
      objective: "2.1",
      title: "Write tool descriptions that route correctly",
      takeaway: "Claude picks tools mainly from their names and descriptions, so make each one say what it does, what input it takes, what it returns, and when to use it instead of its nearest neighbor. Rename or split tools whose purposes overlap.",
      minutes: 4,
      blocks: [
        text("When Claude decides which tool to call, the strongest signal it has is the tool definition: the `name`, the `description`, and the parameter descriptions inside `input_schema`. The Claude API docs call detailed descriptions by far the most important factor in tool performance. A one-line description such as 'Retrieves customer information' gives the model almost nothing to separate that tool from 'Retrieves order details', especially when both accept similar identifiers. The result is misrouting: the agent calls `get_customer` when the user asked about order #12345."),
        text("A strong description answers five questions. What does the tool do? What input formats does it accept, with an example? What does it return? Which edge cases matter, such as partial IDs or multiple matches? And when should Claude use a different tool instead? The last question is the one most often left out, and it is the one that fixes overlap."),
        code("json", "Before and after: two tools that used to collide", `[
  {
    "name": "get_customer",
    "description": "Look up a customer ACCOUNT by email address or customer ID (format C-12345). Returns profile, verification status and account flags. Use this to identify or verify who you are talking to. Do NOT use it for questions about a specific order; use lookup_order for anything with an order number.",
    "input_schema": {
      "type": "object",
      "properties": {
        "email": { "type": "string", "description": "Customer email, e.g. ana@example.com" },
        "customer_id": { "type": "string", "description": "Customer ID such as C-12345" }
      }
    }
  },
  {
    "name": "lookup_order",
    "description": "Fetch one ORDER by order number (digits, optionally prefixed with #, e.g. #12345 or 12345). Returns items, totals, shipping status and return eligibility. Use for 'where is my order', returns and delivery questions. Requires a verified customer_id; call get_customer first if you do not have one.",
    "input_schema": {
      "type": "object",
      "properties": {
        "order_number": { "type": "string", "description": "Order number, with or without leading #" },
        "customer_id": { "type": "string", "description": "Verified customer ID from get_customer" }
      },
      "required": ["order_number", "customer_id"]
    }
  }
]`),
        text("Sometimes better wording is not enough because the tools really do overlap. Two research tools named `analyze_content` and `analyze_document` with near-identical descriptions will be confused no matter how you phrase them. Rename to make the boundary obvious: `analyze_content` becomes `extract_web_results`, with a description that limits it to web search output. Or split a vague, do-everything tool into purpose-specific tools with clear input and output contracts. A generic `analyze_document` becomes `extract_data_points` (returns structured fields), `summarize_content` (returns prose) and `verify_claim_against_source` (returns supported, contradicted or not found, plus the excerpt)."),
        text("This does not conflict with the API docs' advice to consolidate related operations into fewer tools. Consolidation fits operations on one resource that differ only by verb, such as create, review and merge on pull requests, behind an `action` parameter. Splitting fits a single tool whose name hides several different jobs with different outputs. Both aim at the same thing: no two tools should be plausible answers to the same request."),
        list(
          "Name tools for their job and domain: `extract_web_results` rather than `analyze_content`. Prefix by service once you have many, such as `github_list_prs`.",
          "Put the boundary in the description: 'Use X for A; use Y for B.'",
          "Describe every parameter, with a concrete example of its format.",
          "For complex or format-sensitive inputs, the API also accepts optional `input_examples`, but descriptions come first.",
        ),
        text("Finally, audit the system prompt. Instructions keyed on a word can override a good description. 'Always analyze any document the user mentions' pulls the model toward whatever tool contains 'analyze', even for a web page. Reword such instructions around outcomes, or name the right tool explicitly, so they do not create accidental associations."),
        exam("How the exam frames it", "For misrouting between similar tools, few-shot examples, a keyword routing layer and merging the tools are all possible. The production-grade first step is to rewrite the tool descriptions with input formats, examples, edge cases and explicit 'use this, not that' boundaries, because descriptions are the main selection signal and the fix is cheap."),
        pitfall("Fixing descriptions while the system prompt fights them", "If a keyword-heavy instruction in the system prompt keeps pushing the model to the wrong tool, better descriptions alone will not hold. Check the prompt for words that collide with tool names."),
      ],
      terms: ["name", "description", "input_schema", "input_examples", "get_customer", "lookup_order", "extract_web_results", "extract_data_points", "summarize_content", "verify_claim_against_source"],
      sources: [DOCS.defineTools, DOCS.mcpTools],
    },
    {
      objective: "2.2",
      title: "Return structured, categorized tool errors",
      takeaway: "Report tool failures as results with `isError: true` and a machine-readable body: an error category, whether a retry can help, and a human-readable explanation. Keep 'the lookup failed' clearly separate from 'the lookup succeeded and found nothing'.",
      minutes: 4,
      blocks: [
        text("The MCP specification separates two kinds of failure. Protocol errors, such as an unknown tool or a malformed request, come back as JSON-RPC errors that the model is unlikely to fix. Tool execution errors, such as an API failure, bad input or a business rule violation, come back as a normal tool result with `isError` set to true. Clients should pass these to the model so it can correct itself. In the Claude API the same idea appears as `is_error` on a `tool_result` block, and in the Agent SDK an in-process tool returns `is_error` (Python) or `isError` (TypeScript)."),
        text("The flag alone is not enough. A body that says 'Operation failed' gives the agent no way to choose between retrying, fixing its input, explaining a policy to the customer, or escalating. So it guesses: it retries a permission error five times, or tells a customer to try again later about a refund that policy forbids. Put structure in the error body. The field names below are a convention you define in your own server, not part of the MCP spec."),
        code("json", "A tool execution error with structured metadata (CallToolResult body)", `{
  "content": [
    {
      "type": "text",
      "text": "{\\"errorCategory\\": \\"business\\", \\"isRetryable\\": false, \\"code\\": \\"REFUND_WINDOW_EXPIRED\\", \\"message\\": \\"Order 8812 was delivered 47 days ago; refunds close after 30 days.\\", \\"customerMessage\\": \\"This order is past our 30-day refund window, but I can offer store credit or connect you with a specialist.\\"}"
    }
  ],
  "isError": true
}`),
        table(["Category", "Example", "Retryable?", "What the agent should do"], [
          ["transient", "Timeout, 503, rate-limited upstream", "Yes, after backoff", "Retry a bounded number of times, then report"],
          ["validation", "Date in wrong format, missing field", "Yes, with corrected input", "Fix the arguments and call again"],
          ["business", "Refund past the policy window", "No", "Explain to the user using the friendly message; offer alternatives or escalate"],
          ["permission", "Caller lacks scope for this account", "No", "Do not retry; escalate or ask for authorization"],
        ]),
        text("For business rule violations, include `isRetryable: false` (some teams spell it `retriable`) and a customer-safe explanation. The agent then knows not to loop and has wording it can pass on without exposing internal codes."),
        code("python", "Returning the same structure from an Agent SDK in-process tool", `import json
from claude_agent_sdk import tool

@tool("process_refund", "Refund a verified order. Fails with a structured error if policy forbids it.",
      {"order_id": str, "amount": float})
async def process_refund(args):
    try:
        receipt = await billing.refund(args["order_id"], args["amount"])
    except billing.Timeout:
        return {"content": [{"type": "text", "text": json.dumps({
            "errorCategory": "transient", "isRetryable": True,
            "message": "Billing service timed out after 10s."})}], "is_error": True}
    except billing.PolicyViolation as err:
        return {"content": [{"type": "text", "text": json.dumps({
            "errorCategory": "business", "isRetryable": False,
            "message": str(err), "customerMessage": err.customer_text})}], "is_error": True}
    return {"content": [{"type": "text", "text": json.dumps(receipt)}]}`),
        text("Two more distinctions complete the picture. First, an empty result is not an error. A search that ran and matched nothing is a successful answer ('no orders for that email'), so return it as a normal result. A search that never ran because the backend timed out is an access failure and must say so. Mixing them up makes the agent tell a customer they have no orders when the database was simply down. Second, recover locally where you can. A subagent that hits a transient failure should retry on its own; only problems it cannot resolve should go up to the coordinator, together with what it attempted and any partial results it gathered."),
        exam("How the exam frames it", "Several designs surface failures. The production-grade one returns `isError` plus a category, a retryable flag and a clear description, so the agent retries transient faults, fixes validation faults, and explains business faults instead of retrying them. Uniform generic errors and empty-success responses are the distractors."),
        pitfall("Returning an empty list on failure", "Catching an exception and returning `[]` makes an outage look like 'no matches'. The agent then acts confidently on a false negative. Failures must be marked as errors."),
      ],
      terms: ["isError", "is_error", "tool_result", "CallToolResult", "JSON-RPC error", "errorCategory", "isRetryable", "retriable", "@tool"],
      sources: [DOCS.mcpTools, DOCS.toolCalls, DOCS.sdkTools],
    },
    {
      objective: "2.3",
      title: "Scope tools per agent and steer with tool_choice",
      takeaway: "Give each agent only the handful of tools its role needs, add narrow cross-role tools for frequent needs, and use `tool_choice` to require a tool call (\"any\") or a specific first tool (`{\"type\": \"tool\", \"name\": ...}`).",
      minutes: 4,
      blocks: [
        text("Every tool you attach is another option Claude must weigh on every turn. An agent with 18 tools makes worse choices than one with 4 or 5, because more similar-looking options means more chances to pick the wrong one. Tools outside an agent's specialty also invite misuse: a synthesis agent that happens to have web search will start searching instead of synthesizing what it was given, which duplicates the search agent's work and breaks the coordinator's control of scope."),
        text("Scope access by role. The search agent gets search and fetch. The document analyst gets document loaders and extractors. The synthesizer gets almost nothing beyond what it needs to write. In the Agent SDK this is the `tools` list on each `AgentDefinition`, with `disallowedTools` to strip specific tools. When a role has a frequent, narrow need outside its specialty, give it a small, constrained cross-role tool rather than the full capability. A synthesizer might get `verify_fact`, which checks one claim against a supplied source, while anything bigger goes back through the coordinator."),
        text("The same thinking applies to generic tools. A raw `fetch_url` can load anything, including pages you never meant the agent to touch. Replace it with `load_document`, which validates that the URL points to an approved document store and returns parsed text. Narrow tools are easier for the model to choose correctly and safer to run."),
        code("python", "Role-scoped tool lists with one constrained cross-role tool", `agents = {
    "searcher": AgentDefinition(
        description="Finds sources for an assigned subtopic.",
        prompt=SEARCH_PROMPT,
        tools=["WebSearch", "mcp__research__load_document"],
    ),
    "synthesizer": AgentDefinition(
        description="Writes a cited synthesis from findings supplied in its prompt.",
        prompt=SYNTH_PROMPT,
        tools=["mcp__research__verify_fact"],  # narrow check, not open-ended search
    ),
}`),
        text("On the Claude API, `tool_choice` controls whether and which tool is called. It has four forms. `{\"type\": \"auto\"}` is the default when tools are present: Claude may call a tool or answer in text. `{\"type\": \"any\"}` requires a call to one of the provided tools, Claude's choice. `{\"type\": \"tool\", \"name\": \"extract_metadata\"}` forces that one tool. `{\"type\": \"none\"}` prevents tool use, and is the default when no tools are sent. With \"any\" or a forced tool, the response starts directly with the `tool_use` block, so Claude writes no explanation first."),
        code("json", "Force metadata extraction first; enrichment runs on later turns (Haiku 5.5 accepts forced tool use)", `{
  "model": "claude-haiku-5-5",
  "max_tokens": 1024,
  "tools": [
    { "name": "extract_metadata", "description": "Extract title, authors, date and document type.", "input_schema": { "type": "object", "properties": { "title": { "type": "string" } } } },
    { "name": "lookup_author", "description": "Enrich one author with affiliation data.", "input_schema": { "type": "object", "properties": { "author": { "type": "string" } }, "required": ["author"] } }
  ],
  "tool_choice": { "type": "tool", "name": "extract_metadata" },
  "messages": [{ "role": "user", "content": "<document>...</document>" }]
}`),
        table(["tool_choice", "Claude must…", "Use when"], [
          ["auto (default with tools)", "Decide freely; may answer with text", "Normal conversational agents"],
          ["any", "Call some tool, its choice", "You need structured output and several schemas could apply"],
          ["tool + name", "Call exactly that tool", "A specific step must run first, such as `extract_metadata`"],
          ["none", "Not call tools", "A turn that must be plain text"],
        ]),
        text("A forced tool applies to one request. Force `extract_metadata` on the first call, then send follow-up requests with `auto` so Claude can choose enrichment tools based on what the metadata showed. Forced tool use is not available everywhere. Claude Opus 5.5, Claude Sonnet 5.5 and the Fable and Mythos 5.1/5.2 models reject \"any\" and named-tool choices with a 400 error, and so does manual extended thinking (`thinking: {type: \"enabled\"}`); \"auto\" and \"none\" still work. On those models, use \"auto\" with strict tools or structured outputs. Where forcing is accepted, the forced call skips thinking."),
        exam("How the exam frames it", "When an agent misuses tools outside its role, adding prompt warnings is possible, but the production-grade fix removes those tools from that agent and offers a narrow cross-role tool where a real need exists. When the model sometimes replies with text instead of calling a tool, the fix is `tool_choice: \"any\"` (or a forced tool), not more instructions."),
        pitfall("Forcing the same tool on every turn", "Keeping `tool_choice` pinned to one tool after the first step stops the agent from ever moving on. Force the first step, then return to `auto` or `any` for the rest of the flow."),
      ],
      terms: ["tool_choice", "auto", "any", "tool", "none", "AgentDefinition", "tools", "disallowedTools", "verify_fact", "load_document", "fetch_url", "extract_metadata"],
      sources: [DOCS.defineTools, DOCS.sdkSubagents],
    },
    {
      objective: "2.4",
      title: "Configure MCP servers at the right scope",
      takeaway: "Commit shared servers to the project's `.mcp.json` with `${VAR}` references for secrets, keep personal or experimental servers in `~/.claude.json`, prefer community servers for standard systems, and expose browsable catalogs as MCP resources.",
      minutes: 4,
      blocks: [
        text("Claude Code reads MCP servers from three scopes. Project scope lives in `.mcp.json` at the repository root and is meant to be committed, so every teammate who clones the repo gets the same tools. User scope lives in `~/.claude.json` and follows you into every project. Local scope, the default for `claude mcp add`, also lives in `~/.claude.json` but applies only to the current project, which suits personal or experimental servers you do not want to share. If the same server name appears in several scopes, local wins over project, which wins over user, and the entries are not merged."),
        text("Shared configuration must not contain secrets. `.mcp.json` supports environment variable expansion in `command`, `args`, `env`, `url` and `headers`: `${VAR}` expands to the variable's value, and `${VAR:-default}` supplies a fallback when the variable is unset. Each developer, and each CI runner, sets the token in its own environment, and the committed file stays clean."),
        code("json", ".mcp.json (committed): shared servers with credentials from the environment", `{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://mcp.example.com/github",
      "headers": { "Authorization": "Bearer \${GITHUB_TOKEN}" }
    },
    "orders-db": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@acme/orders-mcp"],
      "env": {
        "ORDERS_API_KEY": "\${ORDERS_API_KEY}",
        "ORDERS_URL": "\${ORDERS_URL:-https://orders.internal.example}"
      }
    }
  }
}`),
        code("bash", "Adding servers at each scope from the CLI", `# Shared with the team: writes .mcp.json
claude mcp add --transport http github --scope project https://mcp.example.com/github

# Personal, every project: writes ~/.claude.json
claude mcp add --transport http notes --scope user https://mcp.example.com/notes

# Personal, this project only (default scope): writes ~/.claude.json
claude mcp add --transport stdio scratch-db -- npx -y @acme/scratch-mcp`),
        text("Interactive sessions ask each developer to approve project-scoped servers before first use, so a cloned repository cannot silently connect to arbitrary servers. (Non-interactive `claude -p` and Agent SDK runs cannot show that prompt and load them without asking, so vet `.mcp.json` before running a pipeline on an untrusted repo.) Once connected, the tools from every configured server are available to the agent together in the same session; by default tool search defers their full schemas until Claude needs them. Claude can use a GitHub tool and a database tool in the same task without any switching. They are named `mcp__<server>__<tool>`, which is also how hooks and permission rules target them."),
        text("Availability is not the same as adoption. If an MCP tool's description is thin, Claude will often fall back to built-in tools it knows well, such as using Grep through the repository instead of calling the far more capable `search_issues` tool. Write MCP tool descriptions that explain what the tool can do that built-ins cannot, and what it returns."),
        text("Before writing a server, check whether one exists. For standard systems such as Jira, GitHub or common databases, a maintained community or vendor server is faster to adopt and gets updates for free. Build custom servers for workflows specific to your team, like an internal approval process or a proprietary data model."),
        text("Finally, MCP has more than tools. Resources are read-only content a server exposes by URI, listed with `resources/list` and fetched with `resources/read`. They suit catalogs: issue summaries, documentation trees, database schemas. In Claude Code you can reference one with an `@server:protocol://path` mention. Exposing a schema catalog as a resource lets the agent see what exists up front instead of making a dozen exploratory tool calls to discover table names."),
        table(["Need", "Where it goes"], [
          ["Team-wide server everyone should have", "`.mcp.json` in the repo (`--scope project`)"],
          ["Your own server across all projects", "`~/.claude.json` (`--scope user`)"],
          ["Experimental server in one project, just for you", "`~/.claude.json` (`--scope local`, the default)"],
          ["Credentials", "Environment variables referenced as `${VAR}`, never literal values"],
          ["A catalog the agent should browse", "MCP resources, not a list-everything tool"],
        ]),
        exam("How the exam frames it", "Asked where a team-wide integration belongs, the production-grade answer is the project's `.mcp.json` with `${VAR}` expansion for tokens. Personal or experimental servers go in `~/.claude.json`. Hard-coded tokens, per-developer copies of shared config and custom builds of standard integrations are the distractors."),
        pitfall("Committing the token", "Putting a literal API key in `.mcp.json` leaks it to everyone with repo access and to git history. Reference the environment variable instead."),
      ],
      terms: [".mcp.json", "~/.claude.json", "mcpServers", "claude mcp add", "--scope", "project", "user", "local", "${VAR}", "${VAR:-default}", "mcp__<server>__<tool>", "resources/list", "resources/read", "MCP resources"],
      sources: [DOCS.mcp, DOCS.mcpResources],
    },
    {
      objective: "2.5",
      title: "Pick the right built-in tool for the job",
      takeaway: "Grep searches inside files, Glob finds files by name, Read and Write handle whole files, and Edit replaces one unique string. Explore incrementally, starting from Grep hits, and fall back to Read plus Write when Edit cannot find a unique anchor.",
      minutes: 4,
      blocks: [
        text("The built-in tools look similar but answer different questions, and exam items test whether you can match a task to the right one. Grep searches file contents with a regular expression, so it answers 'where is this text?': every caller of `calculateRefund`, every place an error message is raised, every file that imports a module. It is built on ripgrep, can return file names, matching lines or counts (`output_mode`), and can be narrowed with a `glob` or `type` filter. Glob matches file paths, so it answers 'which files are named like this?': `**/*.test.tsx`, `src/**/*.ts`, or every `Dockerfile`."),
        text("Read loads a file's contents, optionally a slice with `offset` and `limit`. Write creates a file or replaces it entirely with new content. Edit makes a targeted change: it takes an `old_string` and a `new_string`, and `old_string` must match the file exactly and appear exactly once. If the text occurs several times, Claude must either include more surrounding context to make the match unique or set `replace_all`. Edit does no regex and no fuzzy matching."),
        code("json", "Typical inputs for each tool (as they appear in tool_use blocks)", `[
  { "name": "Grep",  "input": { "pattern": "calculateRefund\\\\(", "glob": "**/*.ts", "output_mode": "content" } },
  { "name": "Glob",  "input": { "pattern": "**/*.test.tsx" } },
  { "name": "Read",  "input": { "file_path": "src/billing/refunds.ts" } },
  { "name": "Edit",  "input": { "file_path": "src/billing/refunds.ts", "old_string": "const LIMIT = 300;", "new_string": "const LIMIT = 500;" } },
  { "name": "Write", "input": { "file_path": "src/billing/limits.ts", "content": "export const LIMIT = 500;\\n" } }
]`),
        text("When Edit keeps failing because the anchor text is repeated, for example a boilerplate block that appears in several functions, the reliable fallback is to Read the whole file and Write the corrected version. This trades a small edit for a full rewrite, so use it when targeted edits cannot pin down a unique location, not as the default."),
        text("For understanding code, build up knowledge step by step. Reading every file up front burns context on code that does not matter and buries the useful parts in the middle. Instead, Grep for an entry point, such as a route, a command name or an error string. Read that file. Follow its imports and calls to the next file, and Read only what the trace requires. You end up with a mental map built from evidence, using a fraction of the tokens."),
        text("Wrapper modules need one more step. Suppose `utils/index.ts` re-exports `fmtMoney` as `formatCurrency` and also exposes `toCents`. Grepping only for the original function name misses every caller that uses the re-exported names. First list everything the wrapper exports, then Grep for each exported name across the codebase."),
        table(["Question", "Tool", "Example"], [
          ["Where is this text, symbol or error message?", "Grep", "All callers of `processRefund`"],
          ["Which files match this naming pattern?", "Glob", "`**/*.test.tsx`"],
          ["What does this file say?", "Read", "Open the handler Grep found"],
          ["Change one specific line or block", "Edit", "Unique `old_string` replaced by `new_string`"],
          ["Create a file, or rewrite one Edit cannot anchor", "Write (after Read)", "Replace a file with repeated boilerplate"],
          ["Run tests, builds or git", "Bash", "`npm test -- refunds`"],
        ]),
        tip("Claude Code defaults on macOS and Linux", "In Claude Code on macOS, Linux and WSL, the Glob and Grep tools are left out of the default tool set, and Claude searches with `find` and `grep` through Bash instead. Naming them in `--tools` or `--allowedTools`, or in the equivalent Agent SDK options, brings them back. The selection logic the exam tests is the same either way."),
        exam("How the exam frames it", "Several tools can technically find something. The production-grade choice uses Grep for content, Glob for file names, Edit for unique targeted changes with Read plus Write as the fallback, and incremental Grep-then-Read exploration rather than reading the whole codebase up front."),
        pitfall("Using Glob to find code", "Glob only sees paths. 'Find every function that calls the payment API' is a content search, so Grep is the right tool. Glob would only find files whose names happen to match."),
      ],
      terms: ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "old_string", "new_string", "replace_all", "output_mode", "file_path", "--tools", "--allowedTools"],
      sources: [DOCS.tools],
    },
    // ───────────────────────────── Domain 3 ─────────────────────────────
    {
      objective: "3.1",
      title: "Place CLAUDE.md instructions at the right level",
      takeaway: "Team standards belong in the project CLAUDE.md (root or `.claude/`), personal preferences in `~/.claude/CLAUDE.md`, and area-specific guidance in subdirectory files, `@import`ed standards or `.claude/rules/`. Use `/memory` to see which files are in play.",
      minutes: 4,
      blocks: [
        text("CLAUDE.md files give Claude Code standing instructions at the start of every session. Where you put a file decides who gets it. User instructions in `~/.claude/CLAUDE.md` apply to you in every project and are never shared, because they sit in your home directory and not in the repository. Project instructions in `./CLAUDE.md` or `./.claude/CLAUDE.md` are committed and reach every teammate through version control. `./CLAUDE.local.md` holds your private notes for one project and should be gitignored. Subdirectories can hold their own CLAUDE.md for area-specific guidance. Organizations can also deploy a managed CLAUDE.md."),
        table(["Level", "Path", "Shared via git?", "Loads"], [
          ["User", "`~/.claude/CLAUDE.md`", "No, only you", "Every session, every project"],
          ["Project", "`./CLAUDE.md` or `./.claude/CLAUDE.md`", "Yes", "At launch for sessions in the repo"],
          ["Local", "`./CLAUDE.local.md`", "No (gitignore it)", "At launch, after the project file"],
          ["Directory", "`<subdir>/CLAUDE.md`", "Yes", "When Claude reads or edits files in that subdirectory"],
        ]),
        text("Loading is additive, not override-based. Claude Code reads CLAUDE.md files from the working directory and every directory above it at launch and concatenates them, from the filesystem root down. Files in subdirectories below the working directory load on demand, the first time Claude touches a file there. Contradictory instructions at different levels are not resolved by precedence, so Claude may follow either; keep them consistent."),
        text("The most common diagnosis question follows from this. A new teammate says Claude ignores the team's testing rules, while it works fine for you. Check where the rules live. If they are in your `~/.claude/CLAUDE.md`, they were only ever yours. Move them into the project CLAUDE.md and commit them."),
        text("Large instruction files get hard to maintain, so split them. A CLAUDE.md can pull in other files with `@path/to/file`. Relative paths resolve from the file containing the import, imports can nest up to four hops deep, and an `@path` inside a code span or code block is left as literal text. In a monorepo, each package's CLAUDE.md can import only the standards its maintainers know are relevant."),
        code("markdown", "packages/payments/CLAUDE.md importing only the standards this package needs", `# Payments package

Money is stored as integer cents; never use floats for amounts.

@../../docs/standards/api-conventions.md
@../../docs/standards/pci-handling.md
@./docs/ledger-invariants.md`),
        text("The other way to modularize is the `.claude/rules/` directory. Each Markdown file covers one topic, such as `testing.md`, `api-conventions.md` or `deployment.md`, and files are discovered recursively. Rules without a `paths` field load at launch like the project CLAUDE.md. Rules with a `paths` field load only for matching files, which lesson 3.3 covers. Personal rules can live in `~/.claude/rules/`."),
        code("text", "A project that replaced one long CLAUDE.md with topic rules", `CLAUDE.md                  # short: build commands, architecture overview
.claude/
  rules/
    testing.md               # test style, fixtures, naming
    api-conventions.md       # error format, pagination, versioning
    deployment.md            # release checklist, environment rules`),
        text("When behavior varies between sessions or teammates, verify before rewriting anything. `/memory` lists the CLAUDE.md, CLAUDE.local.md and rules locations across user and project scope, lets you open and edit them, and toggles auto memory. `/context all` shows which memory files actually loaded into the current context. Together they tell you whether a missing instruction is a wording problem or a file-placement problem."),
        tip("Try it in Claude", "In a repository open in Claude Code: (1) run `/memory` to list the user, project and local CLAUDE.md and rules locations; (2) run `/context all` and read the Memory files list to see which ones actually loaded; (3) move one instruction from `~/.claude/CLAUDE.md` into `./CLAUDE.md`, start a new session and run `/context all` again. The instruction now comes from the project file, which teammates receive through git; that placement rule is what this objective tests."),
        exam("How the exam frames it", "If one developer gets the right behavior and another does not, the production-grade explanation is usually configuration level: the instructions sit in user-level `~/.claude/CLAUDE.md` instead of the committed project file. Rewording the instruction or adding it to everyone's home directory are distractors."),
        pitfall("Expecting overrides", "Deeper CLAUDE.md files do not replace higher ones; all of them are concatenated. If two levels disagree, fix the conflict instead of assuming the closer file wins."),
      ],
      terms: ["CLAUDE.md", "~/.claude/CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md", "@import", "@path/to/file", ".claude/rules/", "~/.claude/rules/", "/memory", "/context"],
      sources: [DOCS.memory, DOCS.commands],
    },
    {
      objective: "3.2",
      title: "Build shared slash commands and skills",
      takeaway: "Put team commands in `.claude/commands/` or team skills in `.claude/skills/` so git shares them, keep personal variants under `~/.claude/` with distinct names, and use SKILL.md frontmatter (`context: fork`, `allowed-tools`, `argument-hint`) to control how a skill runs.",
      minutes: 4,
      blocks: [
        text("A custom slash command is a Markdown file whose body becomes the prompt when someone types its name. Where the file lives decides who has it. `.claude/commands/review.md` in the repository gives every developer who clones or pulls a `/review` command. `~/.claude/commands/` is the personal location the exam guide uses for commands only you need. Current Claude Code docs say custom commands have been merged into skills. Command files keep working and accept the same frontmatter as skills (except `name` and `paths`), but skills are recommended for new work because they can bundle supporting files."),
        code("markdown", ".claude/commands/review.md (committed, so the whole team gets /review)", `---
description: Run the team review checklist on the current diff
argument-hint: [focus-area]
---

Review the staged changes against our checklist:
1. Input validation on every new endpoint
2. Money handled as integer cents
3. New behavior covered by tests

Pay extra attention to: $ARGUMENTS`),
        text("A skill is a folder with a `SKILL.md` file: `.claude/skills/<name>/SKILL.md` for the project or `~/.claude/skills/<name>/SKILL.md` for you personally. Frontmatter between `---` markers configures it. `description` tells Claude when the skill applies, because Claude can load skills on its own as well as when you type `/name`. `argument-hint` shows the expected arguments in autocomplete, such as `[module-path]`, so a developer who forgets them knows what to supply. `$ARGUMENTS`, `$0` and `$1` place the arguments in the body. `disable-model-invocation: true` limits a skill to manual use."),
        code("markdown", ".claude/skills/codebase-map/SKILL.md: verbose analysis isolated in a forked subagent", `---
name: codebase-map
description: Map a module's structure, entry points and dependencies before refactoring
argument-hint: [module-path]
context: fork
agent: Explore
allowed-tools: Read Grep Glob
---

Map the module at $ARGUMENTS:
1. List entry points and public exports.
2. Trace the main call paths and external dependencies.
3. Return a one-page summary with file paths. Do not include raw file dumps.`),
        text("`context: fork` runs the skill in a separate subagent of the type named in `agent` (built-ins such as `Explore`, `Plan` or `general-purpose`, or a custom agent). That subagent does not see your conversation; it gets the skill body as its prompt, and only its result comes back. This is exactly what you want for skills that read a lot or think out loud: codebase analysis, brainstorming alternatives, wide searches. The main session receives a summary instead of hundreds of lines of exploration."),
        text("`allowed-tools` lists tools Claude can use without asking for permission during the turn that invokes the skill; the grant clears with your next message. The exam treats it as the way to limit a skill to safe operations. Know the current nuance: the docs say `allowed-tools` pre-approves the listed tools but does not remove others, and `disallowed-tools` is the field that takes tools away while the skill is active. For a hard limit you can also point a forked skill at a custom agent whose `tools` list is restricted."),
        text("Personal customization should not affect teammates. If you want a stricter version of the team's `/review`, create it under `~/.claude/skills/` with a different name, such as `review-strict`. A personal skill with the same name as a project skill takes precedence for you, which quietly changes what `/review` means in your sessions and makes your results differ from the team's."),
        table(["Put it in…", "When"], [
          ["CLAUDE.md", "Universal standards that should apply to every session (always loaded)"],
          ["A skill or command", "A task-specific workflow invoked on demand, like a review checklist, a release or a migration recipe"],
          ["`.claude/` in the repo", "The team should have it, via version control"],
          ["`~/.claude/`", "Only you should have it; use a distinct name"],
        ]),
        exam("How the exam frames it", "Asked where a command every developer should get on clone or pull belongs, the production-grade answer is `.claude/commands/` (or `.claude/skills/`) in the repository, not each home directory and not CLAUDE.md. For a skill whose verbose output clutters the session, the answer is `context: fork`."),
        pitfall("Commands in CLAUDE.md or invented config", "CLAUDE.md holds instructions, not command definitions, and there is no `.claude/config.json` commands array. Options built on either are distractors."),
      ],
      terms: [".claude/commands/", "~/.claude/commands/", ".claude/skills/", "~/.claude/skills/", "SKILL.md", "description", "argument-hint", "context: fork", "agent", "allowed-tools", "disallowed-tools", "disable-model-invocation", "$ARGUMENTS", "Explore"],
      sources: [DOCS.skills, DOCS.commands],
    },
    {
      objective: "3.3",
      title: "Load conventions by path with scoped rules",
      takeaway: "When a convention applies to a kind of file wherever it lives, write a `.claude/rules/` file with a `paths` glob such as `**/*.test.tsx`. It loads only when Claude works on matching files, unlike directory CLAUDE.md files, which are tied to one folder.",
      minutes: 3,
      blocks: [
        text("Not every convention should sit in context all the time. Terraform rules are noise while Claude edits React components, and React rules are noise in a migration script. Path-specific rules solve this. A file in `.claude/rules/` with YAML frontmatter containing a `paths` field becomes a conditional rule: Claude Code loads it only when Claude reads, writes or edits a file that matches one of the patterns. Until then it costs no tokens and cannot distract the model."),
        code("markdown", ".claude/rules/testing.md: applies to every test file, wherever it lives", `---
paths:
  - "**/*.test.tsx"
  - "**/*.test.ts"
---

# Test conventions

- Use React Testing Library queries by role, never by CSS class.
- One behavior per test; name tests "does X when Y".
- Build data with the factories in test/factories, not inline literals.`),
        code("markdown", ".claude/rules/terraform.md: applies only under terraform/", `---
paths:
  - "terraform/**/*"
---

# Terraform rules

- Every resource gets the standard tags block.
- Never hard-code account IDs; use data sources.`),
        text("Patterns are globs relative to the project root, the directory that contains `.claude`. `**/*.ts` matches TypeScript files at any depth, `src/api/**/*` matches everything under `src/api`, and brace expansion such as `src/**/*.{ts,tsx}` covers several extensions in one line. `paths` is the only frontmatter field Claude Code reads from a rule. If the YAML fails to parse, the rule loads as if it had no `paths` at all, which means always."),
        table(["Pattern", "Matches"], [
          ["`**/*.test.tsx`", "Every .test.tsx file in any directory"],
          ["`terraform/**/*`", "All files under terraform/"],
          ["`src/api/**/*.ts`", ".ts files anywhere under src/api/"],
          ["`src/**/*.{ts,tsx}`", ".ts and .tsx files under src/"],
          ["`/*.md`", ".md files directly in the project root only"],
        ]),
        text("Why not a CLAUDE.md in each directory? Directory CLAUDE.md files are tied to where files live. That works when a convention belongs to one folder, like everything under `terraform/`. It breaks down when the convention follows a file type spread across the tree. Test files that sit next to the code they test (`Button.test.tsx` beside `Button.tsx`) appear in dozens of folders. You would need a CLAUDE.md in each one, kept in sync by hand. A single rule with `**/*.test.tsx` covers all of them, including folders created next month."),
        text("Compare the other wrong answers too. Putting every area's conventions under headings in the root CLAUDE.md loads all of them all the time and relies on Claude to infer which section applies. Packaging conventions as skills makes them depend on someone invoking the skill, or on Claude choosing to, which is not the automatic, path-triggered behavior the scenario asks for."),
        list(
          "Use a path-scoped rule when a convention is defined by file type or pattern, especially across many directories.",
          "Use a directory CLAUDE.md when guidance belongs to one subtree and nothing outside it.",
          "Use an unscoped rule or the root CLAUDE.md for standards that truly apply everywhere.",
          "Use a skill for a workflow someone runs on demand, not for conventions that must apply automatically.",
        ),
        exam("How the exam frames it", "For conventions that must apply automatically to files spread across the codebase, the production-grade answer is `.claude/rules/` files with `paths` globs. Root CLAUDE.md sections, per-directory CLAUDE.md copies and skills can all carry the text, but none of them match by file pattern."),
        pitfall("Broken frontmatter means always-on", "A YAML error in the `paths` block does not disable the rule; it makes the rule load in every session. Run `claude --debug` to see the parse error if a scoped rule seems to apply everywhere."),
      ],
      terms: [".claude/rules/", "paths", "YAML frontmatter", "**/*.test.tsx", "terraform/**/*", "glob", "CLAUDE.md", "claude --debug"],
      sources: [DOCS.memory],
    },
    {
      objective: "3.4",
      title: "Decide between plan mode and direct execution",
      takeaway: "Use plan mode when the task is large, architectural, spans many files or has several valid approaches. Execute directly when the change is small and well understood. Push verbose discovery into the Explore subagent, and often plan first, then execute the approved plan.",
      minutes: 4,
      blocks: [
        text("Plan mode is a Claude Code permission mode in which Claude researches and proposes but does not edit your source. It reads files, runs exploratory commands and writes a plan. Edits stay blocked until you approve it. You enter it by pressing Shift+Tab to cycle modes, by prefixing a prompt with `/plan`, or by launching with `claude --permission-mode plan`. At the approval prompt you can accept, keep planning, or press Ctrl+G to edit the plan in your editor first. Approving switches the session into an editing mode and Claude starts implementing."),
        code("bash", "Ways to plan before changing code", `# Start the whole session in plan mode
claude --permission-mode plan

# Or, inside a session, plan just this task
/plan split the billing module into invoice and payment services`),
        text("Plan mode earns its cost when getting the approach wrong is expensive. That means restructuring a monolith into services, a library migration that touches 45 or more files, or choosing between two integration designs with different infrastructure needs. In each case the risk is not typing the code; it is committing to a direction before you understand the dependencies. Exploring first and agreeing on a design prevents rework. It also gives you a checkpoint to catch a misunderstanding before it spreads across dozens of files."),
        text("Direct execution is right when scope is clear and small: adding a date validation conditional to one function, or fixing a single-file bug with a clear stack trace. Planning those adds a review cycle without reducing any real risk. The exam rewards matching the mode to the stated complexity. When the scenario already tells you the task is architectural, waiting until 'complexity appears' is the wrong answer; the complexity is in the requirements."),
        table(["Task in the scenario", "Mode", "Reason"], [
          ["Monolith to microservices", "Plan mode", "Service boundaries and dependencies must be decided first"],
          ["Library migration across ~45 files", "Plan, then execute", "Agree on the pattern once, apply it consistently"],
          ["Two valid integration approaches", "Plan mode", "Compare trade-offs before committing infrastructure"],
          ["Single-file bug with a clear stack trace", "Direct execution", "Scope known, low risk"],
          ["Add one validation check to a function", "Direct execution", "Well scoped, easy to verify"],
        ]),
        text("Long discovery phases fill the context window fast. Every file read and every search result stays in the conversation, and by the time implementation starts, the useful findings are buried. The built-in Explore subagent addresses this. It is a fast, read-only agent: Write and Edit are denied. Claude delegates codebase searches to it with a thoroughness level (quick, medium or very thorough), and only its summary returns to the main conversation. In plan mode, Claude similarly delegates research to the built-in Plan subagent. Use Explore deliberately for multi-phase tasks, such as 'use the Explore agent to find every place we construct a PaymentIntent', so the main session keeps room for design and implementation."),
        list(
          "Phase 1, plan mode: explore, often through Explore, and propose a migration approach with the affected files.",
          "Review and edit the plan (Ctrl+G), then approve it.",
          "Phase 2, direct execution: implement the approved plan file by file, running tests as you go.",
          "Optionally start implementation from a clean context so the build begins with the plan, not the exploration transcript.",
        ),
        exam("How the exam frames it", "Plan mode and direct execution can both finish most tasks. The production-grade choice uses plan mode when the scenario states architectural impact, many files or competing approaches, and direct execution for clearly scoped fixes. 'Start directly and switch if it gets hard' is the usual distractor for large tasks."),
        pitfall("Plan mode for everything", "Planning a one-line fix wastes a review cycle and trains the team to rubber-stamp plans. Reserve plan mode for changes where a wrong approach is costly."),
      ],
      terms: ["plan mode", "direct execution", "Shift+Tab", "/plan", "--permission-mode plan", "Ctrl+G", "Explore subagent", "Plan subagent"],
      sources: [DOCS.permissionModes, DOCS.subAgents, DOCS.commands],
    },
    {
      objective: "3.5",
      title: "Refine output with examples, tests and interviews",
      takeaway: "When prose is read inconsistently, show 2 or 3 concrete input-to-output examples. Drive changes with tests and paste back the failures. Have Claude interview you before building in unfamiliar territory. Batch interacting fixes into one message and fix independent ones one at a time.",
      minutes: 3,
      blocks: [
        text("Iterative refinement is how you get from a first attempt to correct code with the fewest round trips. The exam tests four techniques and when each one applies."),
        text("First, concrete examples beat descriptions. 'Normalize phone numbers to a standard format' gets read three different ways. Two or three input-to-output pairs remove the ambiguity, including the edge cases you care about. When Claude's output keeps drifting from what you meant, stop rewording the description and show the transformation."),
        code("text", "Communicating a transformation with examples instead of adjectives", `Convert legacy phone fields to E.164. Examples:

Input:  "(415) 555-0132"        Output: "+14155550132"
Input:  "415.555.0132 ext 9"    Output: "+14155550132"   (drop extensions)
Input:  ""                      Output: null             (never invent a number)`),
        text("Second, test-driven iteration gives Claude an objective target. Write tests first that cover expected behavior, edge cases and any performance requirement. Then ask Claude to implement until they pass, and paste back the specific failures each round. A failing test names exactly what is wrong; 'it still doesn't work' does not. Claude Code's best-practice guidance makes the same point: give Claude a check it can run, or you become the test suite."),
        code("python", "A failing edge case handed back to Claude, with input and expected output", `def test_migration_keeps_null_middle_names():
    row = {"first": "Ana", "middle": None, "last": "Ruiz"}
    assert migrate_name(row) == {"full_name": "Ana Ruiz", "middle_initial": None}
    # Currently fails: migrate_name returns "Ana None Ruiz" and middle_initial "N"`),
        text("Third, the interview pattern surfaces what you have not thought of. In an unfamiliar domain, ask Claude to question you before writing code. For example: 'I want to add caching to the pricing service. Interview me about requirements, then write the spec to SPEC.md.' The questions surface cache invalidation strategy, staleness tolerance, failure behavior when the cache is down and memory limits, decisions that would otherwise be made silently, and possibly wrongly, inside the implementation."),
        text("Fourth, decide how to deliver feedback. If problems interact, such as a schema change that affects validation and the serializer, send them together in one detailed message so the fix is designed as a whole. Fixing them one at a time would make each fix undo another. If problems are independent, like a typo in one module and a missing log line in another, fix them in sequence so each change is small and easy to verify."),
        table(["Situation", "Technique"], [
          ["Prose instructions produce inconsistent transformations", "2 or 3 concrete input/output examples"],
          ["Need confidence the behavior is correct and stays correct", "Write tests first; iterate by sharing failures"],
          ["Unfamiliar domain, unclear requirements", "Interview pattern before implementing"],
          ["Edge case keeps failing (for example, nulls in a migration)", "A specific test case with input and expected output"],
          ["Several issues that affect each other", "One message describing all of them"],
          ["Several unrelated issues", "Fix sequentially, one per iteration"],
        ]),
        exam("How the exam frames it", "Asking again with stronger wording is always an option, and rarely the best one. The production-grade answer gives Claude something concrete: examples for format problems, tests and their failures for correctness, an interview for missing requirements, and grouped feedback when fixes interact."),
        pitfall("Correcting the same thing three times", "Repeated corrections pile failed attempts into the conversation for Claude to re-read. After two misses, change the input: add an example or a failing test, or clear the session and restate the task with what you learned."),
      ],
      terms: ["interview pattern", "test-driven iteration", "input/output examples", "SPEC.md"],
      sources: [DOCS.bestPractices, DOCS.prompting],
    },
    {
      objective: "3.6",
      title: "Run Claude Code in CI with structured output",
      takeaway: "In pipelines, run `claude -p` so nothing waits for input, request `--output-format json` with `--json-schema` to get machine-readable findings in `structured_output`, keep project context in CLAUDE.md, and review with a separate instance from the one that wrote the code.",
      minutes: 3,
      blocks: [
        text("Interactive Claude Code waits for a person. In CI there is no person, so a plain `claude` invocation can hang the job. The `-p` (or `--print`) flag runs non-interactively: it takes the prompt, does the work and exits. Every pipeline invocation should use it."),
        text("Pipelines also need output a script can parse. `--output-format` accepts `text`, `json` or `stream-json`. With `json`, the result is one JSON object holding the final text in `result` plus metadata such as the session ID and usage. Add `--json-schema` with a JSON Schema, and Claude Code validates the agent's final answer against it and returns it in a `structured_output` field. If a run ends without valid structured output, for example because Claude declined, that field is absent, so check for it before you post anything."),
        code("bash", "A CI review step that produces inline-comment-ready findings", `claude -p "Review the diff in pr.diff against the review rules in CLAUDE.md.
Prior findings are in prior.json. Report only issues that are new or still unaddressed." \\
  --output-format json \\
  --json-schema '{
    "type": "object",
    "properties": {
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "file": {"type": "string"},
            "line": {"type": "integer"},
            "severity": {"type": "string", "enum": ["critical", "major", "minor"]},
            "issue": {"type": "string"},
            "suggested_fix": {"type": "string"}
          },
          "required": ["file", "line", "severity", "issue"]
        }
      }
    },
    "required": ["findings"]
  }' \\
  --allowedTools "Read" "Bash(git diff *)" \\
  --max-turns 10 > review.json

jq -e '.structured_output' review.json > /dev/null || exit 1
jq -c '.structured_output.findings[]' review.json | ./post-inline-comments.sh`),
        text("CI runs start with no memory of your team's habits, so project context has to come from files. A plain `claude -p` run discovers and loads CLAUDE.md just as an interactive session does, which makes it the place for review criteria, testing standards, which fixtures exist and what counts as a valuable test. One catch: the docs recommend `--bare` for scripted runs (and say it will become the default for `-p`), and bare mode skips CLAUDE.md, hooks, skills and MCP servers. With `--bare`, pass the standards explicitly, for example with `--append-system-prompt-file`. Documenting these directly improves generated tests: Claude stops writing trivial getter tests and uses your factories instead of inventing data."),
        list(
          "Re-reviews after new commits: include the previous run's findings in the prompt and ask only for issues that are new or still unaddressed. Otherwise every push re-posts the same comments.",
          "Test generation: put the existing test files for the module in context so Claude does not propose scenarios the suite already covers.",
          "Permissions: pre-approve only what the job needs with `--allowedTools`, and bound the run with `--max-turns`.",
        ),
        text("Who reviews matters as much as how. The session that generated a change carries its own reasoning forward, so it tends to confirm its decisions rather than question them. Run review as a separate invocation that sees only the diff, the criteria and the codebase, not the generator's conversation. In CI this happens naturally if the review step is its own `claude -p` call rather than a follow-up prompt in the generating session."),
        table(["Flag", "Purpose in CI"], [
          ["`-p` / `--print`", "Non-interactive run; prevents hangs waiting for input"],
          ["`--output-format json`", "One JSON result object with `result` and metadata"],
          ["`--json-schema '<schema>'`", "Validated structured answer in `structured_output`"],
          ["`--allowedTools`", "Tools that run without a permission prompt"],
          ["`--max-turns`", "Upper bound on agentic turns for the job"],
        ]),
        exam("How the exam frames it", "Pipelines can scrape text output or retry on hangs. The production-grade setup uses `-p` to stay non-interactive, `--output-format json` with `--json-schema` for parseable findings, CLAUDE.md for standards, prior findings in context to avoid duplicates, and an independent review instance."),
        pitfall("Self-review in the same session", "Asking the generating session to 'now review your changes' is cheap but weak. It shares the reasoning that produced the bug. Use a fresh instance for review."),
      ],
      terms: ["claude -p", "--print", "--output-format json", "--json-schema", "structured_output", "result", "--allowedTools", "--max-turns", "stream-json", "CLAUDE.md"],
      sources: [DOCS.headless, DOCS.cli],
    },
    // ───────────────────────────── Domain 4 ─────────────────────────────
    {
      objective: "4.1",
      title: "Define explicit criteria to cut false positives",
      takeaway: "Precision comes from categorical criteria: say exactly which issues to report and which to skip, and define each severity with concrete code examples. 'Be conservative' and 'only high-confidence findings' do not reliably raise precision.",
      minutes: 3,
      blocks: [
        text("Automated review lives or dies on precision. If a third of the comments are wrong or trivial, developers stop reading all of them, including the correct security finding buried in the middle. False positives in one noisy category erode trust in every other category. That is why this objective treats precision as a design problem rather than a model problem."),
        text("Vague instructions do not fix it. 'Check that comments are accurate' invites the model to flag any comment it would have phrased differently. 'Be conservative' or 'only report high-confidence findings' sounds like a filter, but it gives the model no rule to apply, and its sense of confidence is not calibrated to your team's idea of what matters. The fix is a specific, categorical criterion: 'flag a comment only when the behavior it claims contradicts what the code actually does'. Now there is a test the model can apply to each case."),
        code("text", "Review criteria written as categories, not moods", `REPORT these:
- Bugs: logic that produces wrong results for reachable inputs
- Security: injection, missing authorization checks, secrets in code
- Comment/code contradictions: a comment claims behavior the code does not have
- Data loss: writes without transactions where partial failure corrupts state

SKIP these, even if you notice them:
- Formatting, naming and import order (the linter owns these)
- Patterns used consistently elsewhere in this repo, even if you would choose differently
- Missing comments or docstrings
- Hypothetical performance issues without a hot path

SEVERITY:
- critical: exploitable or corrupts data. Example: SQL built with f-string from request input
- major: wrong result in a normal flow. Example: refund total ignores tax lines
- minor: wrong result only in a rare edge. Example: off-by-one on an empty page`),
        text("Two parts of that prompt do most of the work. The skip list is as important as the report list. It tells the model which true-but-unwanted observations to drop, such as local conventions it would never guess, and it takes style off the table entirely. And each severity level has a concrete code example. Without examples, 'major' means something different on every run; with them, classification stays consistent across files and across days."),
        text("Sometimes one category stays noisy after a round of improvement, for example 'possible race condition' flags that are almost always wrong. The pragmatic move is to switch that category off temporarily so the accurate categories rebuild developer trust, and improve its criteria offline. Then turn it back on once its precision on a test set is acceptable. Shipping a noisy category 'because some hits are real' costs more than it earns."),
        table(["Instruction style", "Example", "Effect on precision"], [
          ["Vague goal", "\"Check that comments are accurate\"", "Low; flags anything the model would phrase differently"],
          ["Confidence filter", "\"Only report high-confidence issues\"", "Unreliable; self-assessed confidence is not calibrated"],
          ["Categorical criterion", "\"Flag only when claimed behavior contradicts actual code\"", "High; a testable rule per finding"],
          ["Severity with examples", "critical = exploitable, e.g. SQL from request input", "Consistent classification"],
        ]),
        list(
          "Write a report list and a skip list; the skip list carries local knowledge the model cannot infer.",
          "Anchor each severity to a concrete code example.",
          "Measure precision per category, not just overall.",
          "Disable a persistently noisy category while you fix it, rather than letting it poison the rest.",
        ),
        exam("How the exam frames it", "Developers dismiss most automated comments. Raising the confidence bar, adding 'be conservative', or switching models all sound plausible. The production-grade fix replaces vague guidance with explicit report and skip criteria and example-anchored severities, and temporarily disables the categories that produce most false positives."),
        pitfall("Confidence thresholds as a precision fix", "Asking the model to self-filter by confidence feels rigorous but does not reliably remove the findings developers reject. Criteria that define what counts as an issue do."),
      ],
      terms: ["false positive", "precision", "severity criteria", "skip list"],
      sources: [DOCS.prompting, DOCS.bestPractices],
    },
    {
      objective: "4.2",
      title: "Use few-shot examples to teach judgment and format",
      takeaway: "When instructions alone give inconsistent results, add a few targeted examples. Show the exact output format, the reasoning behind ambiguous choices, acceptable patterns next to real issues, and varied document layouts, so the model generalizes rather than pattern-matching.",
      minutes: 4,
      blocks: [
        text("Few-shot prompting means including worked examples of the task in the prompt. It is the most reliable way to get consistently formatted, actionable output when detailed instructions still produce drift. Examples show what instructions can only describe: the shape of a good answer, the level of detail and how to handle a borderline case. Anthropic's prompting guidance recommends wrapping them in `<example>` tags inside an `<examples>` block so Claude can tell them apart from instructions, and making them relevant and varied."),
        text("The exam guide focuses on small, targeted sets: 2 to 4 examples aimed at the ambiguous cases, not a long list of easy ones. (The general prompting docs suggest 3 to 5 examples for typical tasks; both point the same way, toward a handful of well-chosen examples.) The best ones show reasoning: why this action was chosen over a plausible alternative. That is what lets the model carry the judgment to cases you did not anticipate, instead of matching surface features of the examples."),
        code("text", "Two targeted review examples: one real issue, one acceptable pattern", `<examples>
<example>
Code: user = db.query(f"SELECT * FROM users WHERE id = {request.args['id']}")
Finding:
  location: api/users.py:42
  issue: SQL built from request input with an f-string (injection)
  severity: critical
  suggested_fix: Use a parameterized query: db.query("... WHERE id = %s", (user_id,))
Why: Input reaches the query unescaped. This is exploitable, not style.
</example>
<example>
Code: except Exception: logger.exception("sync failed"); raise
Finding: none
Why: Broad except looks risky, but it logs and re-raises. This repo uses this
pattern on purpose at job boundaries. Do not flag it.
</example>
</examples>`),
        text("Notice what these examples do. The first shows the exact output format (location, issue, severity, suggested fix), so every finding comes back in that shape. The second shows an acceptable pattern that looks like a problem, which teaches the model to tell the two apart. That is one of the most effective ways to cut false positives while still letting the model generalize to new code."),
        text("Examples work the same way for tool selection and ambiguous routing. An example where the user says 'my order is wrong' and the agent first asks which order, explaining why, does more than a paragraph of rules. They also help coverage judgments, such as showing that a test suite which never exercises the `else` branch has a branch-level gap even though every function is called."),
        text("In extraction, few-shot examples reduce hallucination and empty fields. Documents vary: one paper puts citations inline, another in a bibliography; one report has a methodology section, another buries method details in the results. If the model has only seen one layout, it returns null for required fields found in an unfamiliar place, or invents values. Add examples that show correct extraction from each structural variant, including informal measurements like 'about two cups' or 'a little over 3 kg' and how you want them recorded."),
        list(
          "Target the ambiguous cases, not the easy ones.",
          "Show the reasoning for the choice, including the rejected alternative.",
          "Demonstrate the exact output format you will parse.",
          "Pair a true issue with a look-alike acceptable pattern.",
          "Cover each document layout you see in production, especially where required fields were coming back empty.",
        ),
        table(["Problem", "Example set to add"], [
          ["Inconsistent output format", "Examples in the exact target format"],
          ["Wrong choice on ambiguous requests", "Ambiguous inputs with the chosen action and why"],
          ["False positives on accepted patterns", "Look-alike acceptable code marked 'no finding' with reasoning"],
          ["Empty or invented fields on unusual layouts", "Correct extractions from each structural variant"],
        ]),
        exam("How the exam frames it", "When instructions are already detailed but output is still inconsistent, more rules is a possible answer. The production-grade one adds a few targeted examples that show format and reasoning on the ambiguous cases. For tool misrouting, though, fix descriptions first (lesson 2.1); examples add tokens without fixing a weak definition."),
        pitfall("Many easy examples", "Ten near-identical, obvious examples teach the model to copy their surface, not your judgment. They cost tokens and can make it worse at novel cases."),
      ],
      terms: ["few-shot prompting", "<example>", "<examples>"],
      sources: [DOCS.prompting],
    },
    {
      objective: "4.3",
      title: "Guarantee structure with tool use and JSON schemas",
      takeaway: "Define an extraction tool whose `input_schema` is your output schema, force it with `tool_choice` (\"any\" or a named tool), and read the `tool_use` input. Use nullable fields for data that may be missing and enum values plus 'other' and detail fields for open categories. Validate meaning separately.",
      minutes: 3,
      blocks: [
        text("Asking for JSON in plain text works most of the time and fails at scale: a missing brace, a trailing comment or an extra sentence before the object. Tool use removes that class of failure. Define a tool whose `input_schema` is the structure you want, make Claude call it, and read the structured `input` from the `tool_use` block. You never parse free text. With `strict: true` on the tool definition, the API also guarantees the input conforms to your schema. The Messages API offers a second route to the same guarantee, JSON outputs through `output_config.format` with a `json_schema`, which the exam groups with this objective."),
        code("json", "An extraction tool with nullable fields and extensible enums", `{
  "name": "extract_invoice",
  "description": "Record the fields of ONE invoice. Use null for any field the document does not state.",
  "strict": true,
  "input_schema": {
    "type": "object",
    "properties": {
      "invoice_number": { "type": "string" },
      "issue_date": { "type": ["string", "null"], "description": "YYYY-MM-DD; null if absent" },
      "vendor_name": { "type": "string" },
      "po_number": { "type": ["string", "null"] },
      "category": { "type": "string", "enum": ["software", "hardware", "services", "unclear", "other"] },
      "category_detail": { "type": ["string", "null"], "description": "Required wording when category is other" },
      "line_items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": { "description": { "type": "string" }, "amount": { "type": "number" } },
          "required": ["description", "amount"],
          "additionalProperties": false
        }
      },
      "stated_total": { "type": ["number", "null"] }
    },
    "required": ["invoice_number", "issue_date", "vendor_name", "po_number", "category", "category_detail", "line_items", "stated_total"],
    "additionalProperties": false
  }
}`),
        text("Schema design decides how honest the output is. If a field is required and non-nullable, the model must put something there, and when the document does not contain it, that something is a fabrication. Make fields nullable (`\"type\": [\"string\", \"null\"]`) whenever the source might not state them, and say in the description that null is expected in that case. For categories, a closed enum forces every odd case into the nearest wrong bucket. Add \"other\" with a free-text detail field so new categories surface instead of being misfiled, and add \"unclear\" so genuinely ambiguous documents are flagged rather than guessed."),
        table(["tool_choice", "Behavior", "Extraction use"], [
          ["`{\"type\": \"auto\"}`", "May answer in text instead of calling a tool", "Risky: you might get prose back"],
          ["`{\"type\": \"any\"}`", "Must call one of the tools; Claude picks which", "Several schemas (invoice, receipt, contract) and the document type is unknown"],
          ["`{\"type\": \"tool\", \"name\": \"extract_metadata\"}`", "Must call that tool", "A specific extraction must run before enrichment steps"],
        ]),
        code("python", "Forcing the tool and reading the structured result", `response = client.messages.create(
    model="claude-haiku-5-5",     # Opus 5.5 and Sonnet 5.5 reject forced tool_choice
    max_tokens=2048,
    tools=[EXTRACT_INVOICE, EXTRACT_RECEIPT],
    tool_choice={"type": "any"},  # must call one; the model chooses which schema fits
    system=NORMALIZATION_RULES,
    messages=[{"role": "user", "content": document_text}],
)
call = next(b for b in response.content if b.type == "tool_use")
record = call.input            # already a dict that matches the schema
schema_used = call.name        # extract_invoice or extract_receipt`),
        text("Check the model before you force a tool. Claude Opus 5.5, Claude Sonnet 5.5 and the Fable and Mythos 5.1/5.2 models return a 400 error for \"any\" or a named tool, and so does manual extended thinking. On those models, keep `tool_choice` on \"auto\" with `strict: true` tools, or use JSON outputs (`output_config.format`) when you need one fixed shape. Models such as Claude Haiku 5.5 and Claude Opus 5 still accept forced tool use."),
        text("Schemas fix syntax, not truth. A schema-valid invoice can still have line items that do not add up to the total, a vendor name in the PO field, or a date in the wrong century. Those are semantic errors, and lesson 4.4 covers how to catch them. Pair the strict schema with format normalization rules in the prompt, such as 'dates as YYYY-MM-DD; amounts as numbers without currency symbols; convert \"1.234,50\" European notation to 1234.50', because source documents are inconsistent and the schema alone cannot tell the model how to convert them."),
        exam("How the exam frames it", "Prompting for JSON, regex cleanup and retries all improve parse rates. The production-grade answer is tool use with a JSON schema (strict where available), `tool_choice` set to \"any\" or a named tool on models that support forcing, nullable fields for possibly-missing data, and separate semantic validation."),
        pitfall("Required fields that cause hallucination", "Making every field required looks tidy but pressures the model to invent values that are not in the document. If the source may omit it, make it nullable."),
      ],
      terms: ["tool_use", "input_schema", "strict", "tool_choice", "auto", "any", "tool", "nullable", "enum", "other", "unclear", "additionalProperties", "output_config.format", "json_schema"],
      sources: [DOCS.defineTools, DOCS.structured],
    },
    {
      objective: "4.4",
      title: "Validate extractions and retry with specific errors",
      takeaway: "After schema validation, run semantic checks. On failure, retry with the original document, the failed output and the exact errors, but only when the information is actually in the source. Add fields such as `calculated_total`, `conflict_detected` and `detected_pattern` so problems become measurable.",
      minutes: 4,
      blocks: [
        text("Tool use with a strict schema eliminates syntax errors. It does not stop semantic errors: line items that do not sum to the stated total, a phone number in the email field, an end date before the start date. You catch those with your own validation, often a Pydantic model with validators, and then decide what to do with each failure."),
        text("The retry that works is specific. Send a follow-up request that contains the original document, the extraction that failed and the precise validation errors. 'Line items sum to 1,180.00 but stated_total is 1,280.00; re-check the line items on page 2' gives the model something to act on. 'That was wrong, try again' does not. Retries with error feedback reliably fix format mismatches, misplaced fields and arithmetic slips."),
        code("python", "Semantic validation with Pydantic, then a targeted retry", `from pydantic import BaseModel, ValidationError, model_validator

class LineItem(BaseModel):
    description: str
    amount: float

class Invoice(BaseModel):
    invoice_number: str
    line_items: list[LineItem]
    stated_total: float | None
    calculated_total: float
    conflict_detected: bool

    @model_validator(mode="after")
    def totals_agree(self):
        computed = round(sum(i.amount for i in self.line_items), 2)
        if abs(computed - self.calculated_total) > 0.01:
            raise ValueError(f"calculated_total {self.calculated_total} != sum of items {computed}")
        mismatch = self.stated_total is not None and abs(computed - self.stated_total) > 0.01
        if mismatch and not self.conflict_detected:
            raise ValueError("stated_total differs from items but conflict_detected is false")
        return self

def extract_with_retry(document: str, max_attempts: int = 2) -> Invoice:
    raw = extract(document)
    for _ in range(max_attempts):
        try:
            return Invoice.model_validate(raw)
        except ValidationError as err:
            raw = extract(document, previous=raw, errors=str(err))  # doc + failed output + errors
    return route_to_review(document, raw)`),
        text("Notice the two self-correction fields. Asking for `calculated_total` alongside `stated_total` makes the model add the items itself, and your code can compare the two. `conflict_detected` lets it report honestly that the document contradicts itself, which is very different from making an extraction error. A document with a typo in its own total should come back flagged, not 'corrected' by silently changing one number to match the other."),
        text("Know when retrying is pointless. If the required information is not in the document at all, for example the contract says 'pricing per Schedule B' and Schedule B was not provided, no number of retries will produce a correct value. They will produce a guess, or burn tokens on repeated failures. Classify validation failures before retrying: format and structure problems go back to the model; missing information goes to a human or triggers a fetch of the missing source."),
        table(["Failure type", "Example", "Retry helps?"], [
          ["Syntax / schema", "Invalid JSON, wrong type", "Prevented by tool use with a schema"],
          ["Format mismatch", "Date as 03/04/26 instead of 2026-04-03", "Yes, with the specific error"],
          ["Structural / placement", "PO number in the vendor field", "Yes, with the specific error"],
          ["Arithmetic inconsistency", "Items do not sum to the total", "Often; or flag `conflict_detected` if the source itself conflicts"],
          ["Information absent from source", "Value lives in an attachment you did not send", "No; route to a human or fetch the source"],
        ]),
        text("The same idea applies to review systems. Add a `detected_pattern` field to each finding that names the code construct that triggered it, such as 'broad-except' or 'string-built-sql'. When developers dismiss findings, you can group dismissals by pattern and see exactly which rule is generating noise, then tighten its criteria (lesson 4.1) instead of guessing."),
        exam("How the exam frames it", "Retrying more times, switching models and loosening the schema all change the numbers. The production-grade loop validates semantics, retries with the document, the failed output and the specific errors, stops retrying when the data is absent from the source, and records fields that make errors detectable and analyzable."),
        pitfall("Retrying an impossible extraction", "If the value is not in the provided text, a retry loop converts 'unknown' into a plausible fabrication. Detect absence and escalate instead."),
      ],
      terms: ["Pydantic", "model_validator", "ValidationError", "calculated_total", "stated_total", "conflict_detected", "detected_pattern", "retry with error feedback"],
      sources: [DOCS.structured, DOCS.prompting],
    },
    {
      objective: "4.5",
      title: "Schedule work with the Message Batches API",
      takeaway: "Use Message Batches for latency-tolerant bulk work: 50% cheaper, results within 24 hours, matched by `custom_id`. Keep blocking checks such as pre-merge review on the synchronous API, and remember each batched request is one call, so your code cannot answer a tool call inside it.",
      minutes: 4,
      blocks: [
        text("The Message Batches API accepts many Messages API requests at once and processes them asynchronously. The trade is simple. You pay 50 percent of standard prices on input and output tokens, and in return you give up immediacy. Most batches finish within an hour, but there is no latency guarantee: results are available when all requests finish or after 24 hours, whichever comes first, and requests not processed within 24 hours expire. A batch can hold up to 100,000 requests or 256 MB, and results stay downloadable for 29 days."),
        text("That shape decides where batches fit. Overnight report generation, weekly codebase audits, nightly test generation and bulk document extraction all tolerate hours of delay and benefit from the discount. A pre-merge check that blocks a developer's pull request does not: the developer cannot wait an unknown number of hours. Use the synchronous Messages API there, even though it costs twice as much per token."),
        code("python", "Submit a batch, poll, and collect results by custom_id", `import time
import anthropic

client = anthropic.Anthropic()

batch = client.messages.batches.create(requests=[
    {
        "custom_id": f"doc-{doc.id}",  # 1-64 chars: letters, digits, - and _
        "params": {
            "model": "claude-haiku-5-5",   # a model that accepts forced tool_choice
            "max_tokens": 2048,
            "tools": [EXTRACT_INVOICE],
            "tool_choice": {"type": "tool", "name": "extract_invoice"},
            "messages": [{"role": "user", "content": doc.text}],
        },
    }
    for doc in documents
])

while client.messages.batches.retrieve(batch.id).processing_status != "ended":
    time.sleep(60)

failed = []
for item in client.messages.batches.results(batch.id):   # order is NOT guaranteed
    if item.result.type == "succeeded":
        save(item.custom_id, item.result.message)
    else:                                                # errored, canceled, expired
        failed.append(item.custom_id)`),
        text("Results can come back in any order, so `custom_id` is how you match each response to its request. It is also how you handle failures cheaply. Collect the IDs whose result type is `errored` or `expired`, look at why they failed, and resubmit only those, with changes where needed. A document that exceeded the context window gets chunked into sections before resubmission; an invalid request gets its body fixed. Do not resubmit the whole batch."),
        text("Batches do not run your agent loop. Each batched request is a single Messages call. It can include tool definitions and prior conversation turns, and server tools such as web search run inside it, but if Claude stops with `stop_reason` \"tool_use\" for one of your client tools, there is no way to run the tool and return the result inside that request. Any follow-up needs a new request, synchronous or in a later batch. Batch work should be designed as single-shot: one document in, one forced extraction out."),
        list(
          "SLA math: if results must be ready within 30 hours of a document arriving and processing can take up to 24 hours, submission must happen within 6 hours of arrival with no slack. Submitting every 4 hours caps the wait at 4 hours, leaving about 2 hours for polling, failures and resubmission.",
          "Refine first: run the prompt on a representative sample with the synchronous API, fix failure patterns, then batch the full volume. A 10% failure rate on 50,000 documents is 5,000 resubmissions.",
          "Poll `processing_status` until it reads \"ended\", then stream results rather than downloading everything at once.",
        ),
        table(["Workload", "API", "Why"], [
          ["Pre-merge review that blocks a PR", "Synchronous Messages API", "Needs an answer in seconds or minutes"],
          ["Nightly test generation, weekly audit", "Message Batches", "Latency-tolerant; 50% cheaper"],
          ["Agent that must call tools mid-task", "Synchronous loop", "Batches cannot return tool results within a request"],
          ["100k documents, results needed by tomorrow", "Message Batches with scheduled submissions", "Fits the 24-hour window with margin"],
        ]),
        exam("How the exam frames it", "Moving everything to batches to save money is the trap. The production-grade split puts blocking, interactive or tool-looping work on the synchronous API, puts latency-tolerant bulk work on Message Batches, resubmits only failures by `custom_id`, and sizes submission frequency from the SLA minus the 24-hour window."),
        pitfall("Assuming ordered results", "Batch results are not returned in submission order. Code that zips results with inputs by position will attach answers to the wrong documents. Always join on `custom_id`."),
      ],
      terms: ["Message Batches API", "messages.batches.create", "custom_id", "params", "processing_status", "ended", "succeeded", "errored", "canceled", "expired", "results", "24-hour window", "50% discount"],
      sources: [DOCS.batches],
    },
    {
      objective: "4.6",
      title: "Review with independent instances and multiple passes",
      takeaway: "Do not ask the generator to grade itself. Review with a fresh instance that never saw the generation reasoning, split large reviews into per-file passes plus an integration pass, and have findings carry a confidence value you calibrate and use for routing.",
      minutes: 4,
      blocks: [
        text("A model reviewing its own work in the same session starts with a handicap. Its context still holds the reasoning that produced the code: the assumptions it made, the edge cases it decided were impossible, the reasons it gave itself. Reviewing from inside that context, it tends to re-derive the same conclusions and approve them. Telling it to 'critically review your work', or giving it more thinking budget, does not remove the shared context, so the same blind spots remain."),
        text("An independent review instance is a new conversation that receives only the artifact and the criteria: the diff, the relevant files and the review rules, with none of the generator's messages. Without the earlier rationalizations, it reads the code as a stranger would, which is how subtle bugs get noticed. In practice that is a separate API call with a fresh `messages` list, a separate `claude -p` invocation in CI, or a reviewer subagent that is given the diff rather than the conversation."),
        code("python", "An independent reviewer: fresh context, artifact and criteria only", `def independent_review(diff: str, files: dict[str, str]) -> list[dict]:
    # Fresh conversation: none of the generator's messages or reasoning.
    response = client.messages.create(
        model="claude-opus-5",           # accepts forced tool_choice; Opus 5.5 / Sonnet 5.5 do not
        max_tokens=4096,
        system=REVIEW_CRITERIA,          # explicit report/skip lists (lesson 4.1)
        tools=[RECORD_FINDINGS],
        tool_choice={"type": "tool", "name": "record_findings"},
        messages=[{"role": "user", "content": render(diff, files)}],
    )
    call = next(b for b in response.content if b.type == "tool_use")
    return call.input["findings"]        # each finding includes a confidence value`),
        text("Size matters too. A single pass over a 30-file change spreads attention thin. Findings in the middle files get missed, the same pattern is judged differently in two places, and the review contradicts itself. Split it. Run focused per-file passes for local issues such as logic errors, missing checks and misuse of an API. Then run a separate integration pass that looks only at what crosses file boundaries: data flow between modules, changed function signatures and their callers, and contracts between services. Each pass has a narrow question, and the integration pass is not distracted by local style."),
        table(["Design", "Weakness / strength"], [
          ["Same session: 'now review your code'", "Shares the generator's assumptions; misses what it already rationalized"],
          ["Same session with more thinking", "More reasoning on the same flawed premises"],
          ["Independent instance, artifact plus criteria only", "Fresh reading; catches subtle issues"],
          ["One pass over every file", "Attention dilution, inconsistent and contradictory findings"],
          ["Per-file passes plus an integration pass", "Local depth and cross-file coverage without overload"],
        ]),
        text("Finally, make the output routable. Add a verification step in which each finding carries a self-reported confidence alongside its evidence. On its own, a model's confidence is not trustworthy (lesson 5.2). Once you have compared it against labeled outcomes, though, it becomes a useful routing signal. High-confidence findings with evidence post automatically, middle-band findings go to a human reviewer, and low-confidence ones are dropped or batched for periodic audit. Lesson 5.5 covers calibrating those thresholds."),
        list(
          "Generator and reviewer run in separate contexts; pass the reviewer the artifact, not the transcript.",
          "Local passes per file, then one integration pass for cross-file data flow.",
          "Every finding records location, issue, severity, evidence and confidence.",
          "Thresholds for auto-posting come from labeled data, not intuition.",
        ),
        exam("How the exam frames it", "Self-review prompts and extended thinking are offered as cheap fixes. The production-grade design uses a second, independent instance without the generator's context, splits large reviews into per-file and integration passes, and routes findings by calibrated confidence."),
        pitfall("Bigger context as the fix for missed findings", "A larger window lets you fit all 30 files in one pass, but it does not restore attention to the middle files. Splitting the review is what fixes dilution."),
      ],
      terms: ["independent review instance", "self-review", "multi-pass review", "integration pass", "confidence", "tool_choice"],
      sources: [DOCS.prompting, DOCS.bestPractices],
    },
    // ───────────────────────────── Domain 5 ─────────────────────────────
    {
      objective: "5.1",
      title: "Keep critical facts intact in long conversations",
      takeaway: "Keep amounts, dates, IDs and promises in a persistent case-facts block outside any summary. Trim tool results to the fields that matter before they pile up, put key findings first with clear headers, and have upstream agents return compact structured data.",
      minutes: 4,
      blocks: [
        text("The Messages API is stateless: each request must carry the full conversation you want Claude to consider. In a long support session or research run, that history grows with every turn and every tool result, so teams start summarizing older turns. Summaries are where critical facts die. '$247.83 refund for order 8812, promised by Friday' turns into 'customer discussed a refund'. Exact numbers, percentages, dates and what the customer was told are precisely the details progressive summarization blurs, and precisely the ones the agent needs to get right."),
        text("The fix is to separate facts from narrative. Extract transactional facts into a structured case-facts block that you rebuild and include in every request, outside the summarized history. The history can be compressed freely; the facts never are. In multi-issue sessions, keep one entry per issue (order ID, amount, status, what is pending) so the agent does not mix up the details of two orders."),
        code("text", "A case-facts block placed at the top of each request", `<case_facts>
customer_id: C-20931 (verified 14:02)
issues:
  - order: 8812 | problem: duplicate charge | amount: 642.10 USD | status: escalated, awaiting finance
  - order: 9107 | problem: damaged item | amount: 89.00 USD | status: replacement approved, ships Nov 26
promises_made: "Refund decision by Nov 28" (agent, 14:09)
customer_preferences: email contact only
</case_facts>

<conversation_summary>
...older turns, summarized...
</conversation_summary>`),
        text("Tool results are the other source of bloat. An order lookup that returns 40 fields, when the return decision needs 5, adds hundreds of irrelevant tokens on every call, and they stay in context for the rest of the session. Trim results to the relevant fields before they enter the conversation. Do it in the tool implementation, in a `PostToolUse` hook that replaces the output (lesson 1.5), or with a purpose-built tool that returns only what its job needs."),
        code("python", "Keep only return-relevant fields from a verbose order lookup", `RETURN_FIELDS = ("order_id", "delivered_at", "items", "total", "return_eligible_until")

def trim_order(order: dict) -> dict:
    return {key: order[key] for key in RETURN_FIELDS if key in order}`),
        text("Position matters as well. Models handle information at the beginning and end of a long input more reliably than information in the middle, the 'lost in the middle' effect. When a coordinator aggregates many subagent reports, a crucial finding in report 6 of 11 can be skipped. Put a short summary of key findings at the top of the aggregated input, then organize the detailed results under explicit section headers so each part is easy to find. Anthropic's long-context guidance adds that long documents should sit above the question and instructions, with the query at the end."),
        text("Multi-agent pipelines create the same problem one level up. If upstream agents return pages of prose and reasoning, a downstream synthesizer with a limited budget gets the least useful tokens. Change the upstream agents to return structured data: key facts, citations, relevance scores, dates, source locations and methodological context. The downstream agent then gets more signal per token, plus the metadata it needs to synthesize accurately."),
        table(["Risk", "Mitigation"], [
          ["Summaries blur numbers, dates and promises", "Persistent case-facts block outside the summary"],
          ["Several issues get conflated", "One structured entry per issue in a separate context layer"],
          ["Verbose tool results crowd the window", "Trim to relevant fields before they accumulate"],
          ["Findings in the middle get dropped", "Key findings first; detailed sections with headers"],
          ["Downstream agent overwhelmed by upstream prose", "Upstream returns structured facts, citations, dates and scores"],
        ]),
        exam("How the exam frames it", "A bigger context window and a better summarization prompt are both possible answers. The production-grade fix keeps critical facts out of the summary entirely, in a structured block sent with every request, and shrinks tool output at the source. Look for options that preserve exact values structurally rather than ask the model to remember them."),
        pitfall("Summarizing everything, facts included", "Rolling summaries that compress the transaction details along with the chit-chat will eventually lose the amount or the date. Facts go in their own block, verbatim."),
      ],
      terms: ["case facts block", "progressive summarization", "lost in the middle", "PostToolUse", "context window"],
      sources: [DOCS.prompting, DOCS.sdkHooks],
    },
    {
      objective: "5.2",
      title: "Escalate on clear triggers and ask when ambiguous",
      takeaway: "Escalate when the customer asks for a human, when policy is silent or needs an exception, or when the agent cannot make progress. Do not escalate on sentiment or self-rated confidence. When a lookup returns several matches, ask for another identifier instead of guessing.",
      minutes: 3,
      blocks: [
        text("Escalation calibration is a common source of exam items because both failure directions are expensive. Escalate too often and first-contact resolution collapses: straightforward replacements with photo evidence end up in a human queue. Escalate too rarely and the agent improvises on policy exceptions it has no authority to grant. Good escalation logic is driven by explicit triggers, not mood."),
        list(
          "The customer explicitly asks for a human. Honor it right away; do not first run an investigation they did not want.",
          "Policy is silent or ambiguous on this request, or the request needs an exception, for example a competitor price match when policy only covers adjustments on your own site.",
          "The agent cannot make meaningful progress: required data is unavailable, tools keep failing, or the customer rejects every resolution that is in policy.",
        ),
        text("Frustration alone is not on that list. A customer who is annoyed about a late delivery that the agent can fix should hear an acknowledgment and a concrete offer to resolve it. If they then repeat that they want a person, escalate. Sentiment scores do not track case complexity: a polite customer can have a case that needs a policy exception, and an angry one can have a two-minute fix. Self-reported confidence is no better. The agent that mishandles a complex case is usually confident while doing it, which is exactly the problem."),
        code("text", "Escalation criteria in the system prompt, anchored with short examples", `Escalate to a human (escalate_to_human) when ANY of these is true:
1. The customer asks for a human or a manager. Do it immediately.
2. The request needs something our policy does not cover or explicitly forbids.
3. You cannot make progress: required data unavailable or repeated tool failures.
Do NOT escalate just because the customer is upset. Acknowledge it and resolve.

Example: "Item arrived cracked, photo attached, I want a replacement."
-> Resolve. Standard damage replacement with evidence is within policy.

Example: "The store across town has it $40 cheaper, match it."
-> Escalate. Policy covers our own price drops only; competitor matching is a policy gap.

Example: "This is ridiculous, third time I'm writing!" (late package, trackable)
-> Acknowledge, give tracking and a concrete fix. Escalate only if they ask again for a person.`),
        text("Ambiguity in data needs a different response. If `get_customer` returns three accounts for 'J. Smith', picking the most recent or the one with the most orders is a guess that can expose someone else's data or refund the wrong account. Instruct the agent to ask for an additional identifier, such as email, order number or postal code, and continue only when exactly one match remains."),
        table(["Signal", "Right response", "Why"], [
          ["\"Let me talk to a person\"", "Escalate immediately", "Explicit customer preference"],
          ["Policy silent or exception needed", "Escalate with a structured handoff", "The agent lacks authority to invent policy"],
          ["No progress possible", "Escalate with what was tried", "Further turns only frustrate the customer"],
          ["Customer frustrated, issue routine", "Acknowledge and resolve; escalate if they ask again", "Sentiment does not equal complexity"],
          ["Multiple customer matches", "Ask for another identifier", "Heuristic selection risks the wrong account"],
          ["Low self-reported confidence", "Not a trigger by itself", "LLM self-confidence is poorly calibrated"],
        ]),
        exam("How the exam frames it", "Sentiment thresholds, confidence scores and a separate escalation classifier all sound sophisticated. The production-grade first step is explicit escalation criteria with a few examples in the system prompt, because the root cause is unclear decision boundaries. That fixes calibration without new infrastructure."),
        pitfall("Investigating before honoring a request for a human", "When a customer clearly asks for a person, running lookups first to 'try to help' overrides their stated preference. Hand off, with a structured summary, right away."),
      ],
      terms: ["escalate_to_human", "escalation criteria", "first-contact resolution", "get_customer"],
      sources: [DOCS.prompting],
    },
    {
      objective: "5.3",
      title: "Propagate errors with enough context to recover",
      takeaway: "Subagents should retry transient failures themselves and escalate only what they cannot fix, with the failure type, the query tried, partial results and alternatives. Keep access failures distinct from valid empty results, and have synthesis mark coverage gaps.",
      minutes: 3,
      blocks: [
        text("In a coordinator-subagent system, errors cross agent boundaries, and what crosses with them decides whether the coordinator can recover. A subagent that reports only 'search unavailable' leaves the coordinator with two bad choices: retry blindly or give up. A subagent that reports what failed, what it tried, what it already found and what might work instead lets the coordinator make a real decision. It can reroute to another source, accept partial coverage, or ask the user to narrow the question."),
        code("json", "A subagent's structured failure report to the coordinator", `{
  "status": "partial_failure",
  "failure": {
    "type": "timeout",
    "source": "academic-search",
    "attempted_query": "municipal broadband adoption rural 2023..2026",
    "attempts": 3,
    "retryable_later": true
  },
  "partial_results": [
    { "claim": "Rural adoption rose 11 points after subsidies", "source_url": "https://example.org/report", "published": "2025-06-10" }
  ],
  "alternatives": ["Try the government statistics source", "Narrow to 2025-2026 only"],
  "coverage": { "covered": ["urban adoption"], "not_covered": ["rural adoption after 2024"] }
}`),
        text("Two anti-patterns sit at opposite extremes, and both appear as distractors. Silently suppressing the error, by catching the exception and returning an empty list marked as success, makes the coordinator believe there is nothing to find, and the final report states a false negative with confidence. Terminating the whole workflow because one of six sources timed out throws away five good results. The right path is in between: recover locally where possible, propagate what cannot be fixed, and keep going with what you have."),
        text("Local recovery comes first. Timeouts and rate limits are usually transient, so the subagent should retry with backoff before reporting anything. Only failures it cannot resolve go up to the coordinator: persistent outages, permission problems, or invalid queries it does not know how to fix. Those reports carry what was attempted and any partial results, so nothing already gathered is lost."),
        text("Keep the difference between an access failure and an empty result visible all the way up. 'The database timed out' and 'the database answered: no matching records' call for opposite actions. The first needs a retry or another source; the second is a finding that may belong in the report. A shared status field such as `ok_empty` versus `failed` prevents that information from being flattened along the way."),
        table(["Outcome", "Report as", "Coordinator's options"], [
          ["Query ran, found matches", "ok + results", "Use them"],
          ["Query ran, found nothing", "ok_empty", "Treat as evidence of absence for that scope"],
          ["Transient failure, recovered after retry", "ok (note retries in metadata)", "Nothing extra"],
          ["Failure the subagent cannot resolve", "failed + type, attempted query, partial results, alternatives", "Reroute, accept partial coverage, or ask the user"],
        ]),
        text("The final synthesis should be honest about the gaps. Annotate coverage: which findings rest on multiple solid sources, and which topic areas are thin or missing because a source was unavailable. A reader can then trust what is well supported and knows what to verify elsewhere. A report that hides its gaps looks complete and is not."),
        exam("How the exam frames it", "Generic error strings, empty-success responses and abort-on-first-failure all appear as options. The production-grade answer has subagents recover transient errors locally and propagate structured context (failure type, attempted query, partial results, alternatives), with access failures distinguished from empty results and gaps annotated in the output."),
        pitfall("Generic statuses", "'Search unavailable' hides which query, which source, how many attempts and what was already found. The coordinator cannot recover intelligently from a message that carries no context."),
      ],
      terms: ["error propagation", "partial results", "attempted_query", "ok_empty", "coverage annotations", "local recovery"],
      sources: [DOCS.mcpTools, DOCS.sdkSubagents],
    },
    {
      objective: "5.4",
      title: "Manage context across long codebase investigations",
      takeaway: "Long explorations degrade as context fills. Delegate verbose searches to subagents, record findings in scratchpad files, carry phase summaries forward, write state manifests for crash recovery, and use `/compact` when discovery output piles up.",
      minutes: 4,
      blocks: [
        text("Exploring a large, unfamiliar codebase is where context limits bite hardest. Every Grep hit and every file read stays in the conversation. After a few hours the window is full of raw discovery output, and the quality of answers drops in a recognizable way. The agent gives inconsistent answers to questions it handled earlier, and it starts saying things like 'this probably follows the typical repository pattern' instead of naming the `LedgerRepository` class it read an hour ago. That is context degradation: the specific facts are still in there somewhere, but they are buried."),
        text("Delegation is the first defense. Give verbose questions to subagents: 'find all test files and summarize how fixtures are built', or 'trace every dependency of the refund flow'. Each subagent burns its own context on the search, and only a compact answer returns. The main agent keeps the high-level map and coordinates. In Claude Code, the built-in Explore subagent exists for exactly this read-only discovery."),
        text("Scratchpad files are the second defense. Have the agent write key findings to a file as it goes, such as decisions, class names, file paths and open questions, and consult that file before answering later questions. The file survives compaction, new sessions and subagent boundaries, so knowledge does not depend on what is still in the window."),
        code("markdown", "notes/refund-investigation.md, a scratchpad the agent maintains", `# Refund flow investigation

## Confirmed
- Entry: api/refunds.py::create_refund -> services/refunds.py::RefundService.issue
- Money math in services/ledger.py::LedgerRepository (integer cents)
- Idempotency key checked in middleware/idempotency.py (header X-Idem-Key)

## Open questions
- Who calls RefundService.issue besides the API? (searching jobs/)

## Next phase
- Map test coverage for RefundService (delegate to Explore)`),
        text("Work in phases and carry summaries forward. When the mapping phase ends, write a summary of what it established and inject that summary into the initial context of the subagents that run the next phase. Each phase then starts from distilled knowledge rather than from scratch, or from a transcript stuffed with raw output."),
        text("Plan for crashes. Long multi-agent runs fail partway through, through timeouts, restarts or exhausted budgets. Have each agent export its state to a known location: its assignment, progress, findings so far and what remains. The coordinator keeps a manifest pointing at those exports. On resume, it loads the manifest and injects each agent's saved state into that agent's prompt, so work continues where it stopped instead of starting over."),
        code("json", "Coordinator manifest for resumable investigation", `{
  "run_id": "refund-audit-2026-11-24",
  "phase": "test-coverage",
  "agents": [
    { "name": "mapper", "status": "done", "state_file": "state/mapper.json" },
    { "name": "coverage", "status": "in_progress", "state_file": "state/coverage.json", "next": "jobs/ directory" }
  ],
  "phase_summary_file": "notes/refund-investigation.md"
}`),
        text("Inside an interactive session, `/compact` frees space by summarizing the conversation so far. You can pass focus instructions, for example `/compact keep the confirmed call paths and open questions`, so the summary keeps what matters. Use it when verbose discovery output has filled the window but the session's direction is still right. Use `/clear` instead when you are switching to an unrelated task."),
        table(["Symptom or need", "Technique"], [
          ["Main context filling with search output", "Delegate to subagents (for example, Explore)"],
          ["Answers getting vague, forgetting specifics", "Scratchpad file of key findings, consulted before answering"],
          ["Moving to the next phase of work", "Summarize the phase and inject it into the next agents' prompts"],
          ["Run might crash partway", "Per-agent state exports plus a coordinator manifest"],
          ["Window full but the direction is still right", "`/compact` with focus instructions"],
        ]),
        exam("How the exam frames it", "Bigger models and bigger windows only delay the problem. The production-grade answer isolates verbose exploration in subagents, persists findings outside the context (scratchpads and manifests), passes phase summaries forward, and compacts deliberately."),
        pitfall("Relying on the transcript as memory", "If a finding exists only in an old tool result, it is one compaction away from gone. Anything you will need later belongs in a file."),
      ],
      terms: ["context degradation", "scratchpad file", "Explore subagent", "manifest", "/compact", "/clear"],
      sources: [DOCS.subAgents, DOCS.commands, DOCS.bestPractices],
    },
    {
      objective: "5.5",
      title: "Calibrate confidence and target human review",
      takeaway: "Do not trust aggregate accuracy. Measure accuracy by document type and field, calibrate field-level confidence thresholds on labeled data, keep sampling high-confidence output with stratified random samples, and send low-confidence or contradictory cases to people.",
      minutes: 3,
      blocks: [
        text("A headline number like '97% accurate' is where bad automation decisions start. Accuracy averaged over everything hides where errors concentrate. The 97% might be 99.5% on standard invoices, which are most of the volume, and 70% on handwritten receipts or on one field such as tax ID. If you cut human review because of the aggregate, you automate exactly the segment that is failing."),
        text("So break accuracy down before reducing review. Measure it per document type and per field, on a labeled validation set that reflects production. Automate only the segments that clear your bar on their own, and keep review in place for the rest."),
        text("Confidence makes routing efficient, if it is calibrated. Have the extraction output a confidence score for each field rather than one score for the whole document, since a document is rarely uniformly easy. Raw model confidence is not trustworthy on its own, so check it against labeled data. Bucket the validation set by reported confidence, measure actual accuracy in each bucket, and set the auto-accept threshold where measured accuracy meets your requirement, separately for each field if needed."),
        code("python", "Calibrate a per-field threshold on labeled data, then route", `def calibrate(validation, field, target=0.99):
    """Lowest confidence cutoff whose accepted items meet the target accuracy."""
    rows = sorted(validation, key=lambda r: r.confidence[field], reverse=True)
    best = None
    correct = 0
    for n, row in enumerate(rows, start=1):
        correct += row.predicted[field] == row.label[field]
        if correct / n >= target:
            best = row.confidence[field]
    return best

THRESHOLDS = {f: calibrate(labeled_set, f) for f in ("total", "tax_id", "due_date")}

def route(extraction):
    low = [f for f, t in THRESHOLDS.items() if t is None or extraction.confidence[f] < t]
    if low or extraction.conflict_detected:
        return "human_review", low
    return "auto_accept", []`),
        text("Routing sends people the cases they are most useful on: fields below their calibrated threshold, and documents where the source is ambiguous or contradicts itself. Reviewer capacity is limited, so spending it on near-certain cases is waste."),
        text("Auto-accepted output still needs watching. Error rates drift as document sources change, and new failure patterns appear that confidence scores do not reflect. Run stratified random sampling on high-confidence extractions. Divide them into strata, typically by document type, source and field, and sample from each stratum at a set rate. That way rare but important segments are represented and not drowned out by the dominant one. Measure error rates per stratum over time and look at the sampled errors for patterns nobody has seen before."),
        table(["Practice", "What it catches"], [
          ["Accuracy by document type and field", "Weak segments hidden by a good aggregate"],
          ["Field-level confidence, calibrated on labeled data", "Which individual values can be trusted automatically"],
          ["Routing low-confidence or contradictory cases to people", "Errors before they reach downstream systems"],
          ["Stratified random sampling of high-confidence output", "Drift and novel error patterns in what you automated"],
        ]),
        exam("How the exam frames it", "Scenarios often quote a strong overall accuracy and ask whether to reduce review. The production-grade answer validates by document type and field first, calibrates thresholds on labeled data, routes uncertain cases to humans, and keeps stratified sampling running on what is automated."),
        pitfall("Simple random sampling of everything", "Uniform sampling mostly re-checks the dominant, easy document type and rarely sees the small segment where errors cluster. Stratify so every segment is measured."),
      ],
      terms: ["field-level confidence", "calibration", "labeled validation set", "stratified random sampling", "human review routing"],
      sources: [DOCS.prompting],
    },
    {
      objective: "5.6",
      title: "Preserve provenance through multi-source synthesis",
      takeaway: "Make every claim travel with its source (URL or document, excerpt and date) through every hop. Keep conflicting values side by side with attribution, separate established findings from contested ones, and present each content type in the format that suits it.",
      minutes: 4,
      blocks: [
        text("Citations usually disappear in the middle of a pipeline, not at the end. A search agent finds five sources, an analysis agent summarizes them into three paragraphs, and the synthesis agent writes a fluent report in which nobody can tell which claim came from which source. Each summarization step compresses away the link between claim and source unless the format forces it to survive."),
        text("Force it with structured claim-source mappings. Require subagents to output each finding as a record with the claim, the supporting excerpt, the source URL or document name with location, and the publication or data-collection date. Instruct the synthesis agent that it must preserve and merge these mappings, not paraphrase them away. When two findings support the same claim, the merged claim lists both sources."),
        code("json", "Claim-source records, including a conflict kept intact", `{
  "claims": [
    {
      "claim": "Share of households with fiber access in the region",
      "values": [
        { "value": "41%", "source": "https://example.gov/broadband-2025", "excerpt": "41 percent of households...", "collected": "2025-01", "method": "provider-reported coverage" },
        { "value": "33%", "source": "Regional Survey Report, p. 12", "excerpt": "one in three households...", "collected": "2024-06", "method": "household survey" }
      ],
      "conflict": true,
      "note": "Different methods and collection dates; not necessarily contradictory"
    }
  ]
}`),
        text("Conflicts between credible sources are information, not noise. If one source says 41% and another 33%, picking one quietly misleads the reader, and averaging them is worse. Have the analysis step finish with both values included and annotated with their sources, then let the coordinator decide how to reconcile or present them before synthesis. Often the explanation is in the metadata: different methods, populations or dates."),
        text("Dates deserve special attention. Two figures collected two years apart may both be correct. Without publication or collection dates in the structured output, the synthesizer sees a contradiction where there is a trend. Requiring dates on every finding lets the report say 'rose from 33% (2024 survey) to 41% (2025 provider data)' instead of 'sources disagree'."),
        text("Structure the final report so readers can calibrate their trust. Put well-established findings, supported by several independent sources, in a separate section from contested or single-source findings. Keep the original sources' characterizations ('preliminary', 'modeled estimate') and the methodological context instead of flattening everything into confident prose. Coverage gaps from unavailable sources belong here too (lesson 5.3)."),
        text("Finally, let each kind of content keep its natural form. Financial figures and comparisons read best as tables, news and narrative developments as prose, and technical findings as structured lists. Forcing everything into one uniform format, such as all bullets or all paragraphs, makes some of it harder to read and can strip out the qualifiers that carry provenance."),
        table(["Situation", "Weak handling", "Production handling"], [
          ["Summarizing findings", "Prose summary without sources", "Claim-source records preserved and merged"],
          ["Two credible sources disagree", "Pick one, or average", "Keep both with attribution; flag the conflict for the coordinator"],
          ["Figures from different years", "Reported as a contradiction", "Dates required; interpreted as change over time"],
          ["Mixed evidence strength", "Uniform confident prose", "Separate established and contested sections"],
          ["Mixed content types", "One format for everything", "Tables for financials, prose for news, lists for technical findings"],
        ]),
        exam("How the exam frames it", "Asking the synthesizer to 'cite sources' is a possible answer, but it cannot recover citations that were already dropped upstream. The production-grade fix requires structured claim-source mappings, with excerpts and dates, from every subagent, preserved through synthesis, with conflicts annotated rather than resolved arbitrarily."),
        pitfall("Resolving conflicts silently", "Choosing the 'more credible' number without telling anyone hides real uncertainty and often a real methodological difference. Surface both values with their sources and let the reconciliation be explicit."),
      ],
      terms: ["claim-source mapping", "provenance", "source attribution", "conflict annotation", "publication date", "coverage gaps"],
      sources: [DOCS.prompting, DOCS.sdkSubagents],
    },
  ],
};
