# Lesson fact-check (2026-11-25)

Scope: the four lesson files in `lib/claude/lessons/` (`associate-foundations.ts`, `developer-foundations.ts`,
`architect-foundations.ts`, `architect-professional.ts`). Every concrete claim (parameter names, flags, paths, settings
keys, limits, prices, defaults, beta headers, product features and plan availability) was checked against live official
sources: platform.claude.com docs (fetched as `.md`), code.claude.com docs, support.claude.com, privacy.claude.com,
modelcontextprotocol.io and anthropic.com. The bundled `claude-api` skill was not used as an authority, so this pass
found no disagreements with it.

Not checked anywhere: exam-guide facts (item counts, timing, cut scores, domain weights, objective wording, the
guides' sample questions). They come from the exam-guide PDFs and were left unchanged.

## Summary

| Track | Lessons | Claims checked | Corrected | Unverifiable (technical) | "Try it in Claude" callouts |
|---|---|---|---|---|---|
| Associate Foundations (CCAO-F) | 21 | ~120 | 10 | 0 (1 softened) | 9 |
| Developer Foundations (CCDV-F) | 24 | ~310 | 15 | 0 | 1 (3.1) |
| Architect Foundations (CCAR-F) | 30 | ~165 | 11 | 0 | 1 (3.1) |
| Architect Professional (CCAR-P) | 39 | ~370 | 18 | 0 (3 exam-guide items) | 0 |

## Claims the lead asked about (guide-practice decisions in `lib/claude/curriculum/*.ts`)

| # | Claim | Verdict | What changed in the lessons | Source |
|---|---|---|---|---|
| 1 | On current models, sending `temperature` and/or a thinking `budget_tokens` returns a 400 (Developer 5.1) | **True, with a nuance.** `thinking: {type: "enabled", budget_tokens}` returns a 400 on every model numbered 4.7 or higher (deprecated on Opus/Sonnet 4.6). For sampling: on API version `2026-10-21`, sending `temperature`, `top_p` or `top_k` returns a 400 on every model, even at the default value. On `2023-06-01`, Claude 4.7+ models accept only the default values, so `temperature: 0` fails but `temperature: 1` does not. | Developer 5.1 already said this correctly; no change. Architect Professional 4.7/6.1 were corrected by the part-2 checker (they had tied the rejection only to `2026-10-21`). | https://platform.claude.com/docs/en/build-with-claude/extended-thinking ; https://platform.claude.com/docs/en/api/versioning ; https://platform.claude.com/docs/en/api/migration-2026-10-21 |
| 2 | A PNG sent in a `document` content block is rejected (Developer 2.1) | **True.** The Files API lists "Invalid file type (400): the file type doesn't match the content block type (for example, using an image file in a document block)". PNG/JPEG/GIF/WebP belong in `image` blocks; `document` takes PDF and plain text. | None needed. | https://platform.claude.com/docs/en/build-with-claude/files |
| 3 | Prompt caching has a one-hour TTL option (Developer 5.3) | **True.** `cache_control: {"type": "ephemeral", "ttl": "1h"}`, writes at 2x base input (5-minute writes 1.25x), available on every platform that supports caching; longer TTL entries must come before shorter ones. | Developer 5.3: added the missing cache-read exception for Fable and Mythos 5.1/5.2 (0.025x). TTL text unchanged. | https://platform.claude.com/docs/en/build-with-claude/prompt-caching |
| 4 | `tool_choice` of `any` or a specific `tool` is rejected on current models (Architect Professional 2.3) | **Too broad as a blanket statement.** It returns a 400 on Opus 5.5, Sonnet 5.5, Fable 5.2, Mythos 5.2, Fable 5.1 and Mythos 5.1, and with manual extended thinking on any model. Haiku 5.5 and Opus 5 still accept forced tool use (a forced call skips thinking). `auto` and `none` work everywhere. | Architect Professional 2.3: the list now names all six rejecting models plus manual extended thinking, and says Haiku 5.5 and Opus 5 still accept it. Architect Foundations 2.3/4.3/4.5/4.6 had code examples that forced tools on `claude-sonnet-5-5` (a 400); they now use `claude-haiku-5-5` / `claude-opus-5`. If a curriculum decision says "rejected on current models", make it "rejected on Opus 5.5, Sonnet 5.5 and Fable/Mythos 5.x". | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools ; https://platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5 |
| 5 | Managed Agents data residency / EU vs Amazon Bedrock in the EU with a self-hosted Agent SDK loop (Architect Professional 1.6) | **Direction correct; needed two additions.** Hosted Managed Agents runs only on the Claude API, Claude Platform on AWS and Claude Models on Google Cloud (Anthropic managed). Its `inference_geo` values are only `us` and `global`, and workspace geo (storage at rest) is US only. So it cannot meet an EU-only obligation. Bedrock has EU inference profiles and in-region EU endpoints (10% premium over global) but no Managed Agents, so the firm hosts the loop (Agent SDK). New fact: **self-hosted Claude Managed Agents** (through the account team) runs the service on your own infrastructure and can send model calls to Bedrock, Google-managed Claude, Foundry or a gateway. | Architect Professional 1.6: added the Bedrock EU options and premium, the self-hosted Managed Agents alternative, and the explicit "hosted Managed Agents has no EU geo" point. Added three sources. | https://platform.claude.com/docs/en/manage-claude/data-residency ; https://platform.claude.com/docs/en/managed-agents/overview ; https://platform.claude.com/docs/en/managed-agents/self-hosted ; https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock |

## Associate Foundations, CCAO-F (`associate-foundations.ts`, 21 lessons)

- Claims checked: ~120 (product, plan, policy and prompting-guidance claims)
- Claims corrected: 10
- Unverifiable: 0 product claims. One claim softened (sensitive-memory examples). Exam-guide claims (70 items, 120
  minutes, 720 scaled, domain weights, sample items) were not checked.

### Corrections

| Lesson | Before | After | Source |
|---|---|---|---|
| 3.1 | Google Workspace connectors "search and read Drive files and email, and work with calendar events" | Adds that they can also draft or change content, and that by default Claude asks for approval before actions such as sending email or sharing, moving or trashing a file | https://support.claude.com/en/articles/10166901 |
| 3.2 | Haiku / Sonnet / Opus, "your model list may include other families as well" | Adds Fable as Anthropic's most capable family; which models appear depends on plan and, on Enterprise, the admin | https://support.claude.com/en/articles/8664678 ; https://platform.claude.com/docs/en/about-claude/models/choosing-a-model |
| 3.2 | Effort: "lower levels ... high ... max" | Lists the actual levels (Low, Medium, High, Extra high, Max; not every model has every level) and describes Extra high (long-running coding/agentic work) | https://support.claude.com/en/articles/8664678 |
| 5.1 | Free accounts have "a limited number of Projects" | Free is limited to five Projects | https://support.claude.com/en/articles/9517075 |
| 5.2 | Workspace connectors "search and read Gmail, work with Calendar events, search and read Drive" | Adds drafting, event management and approval-gated actions (send, share, move) | https://support.claude.com/en/articles/10166901 |
| 5.2 | (missing) | During Research, Claude can call connector tools without asking each time, so turn off write-capable tools first | https://support.claude.com/en/articles/11175166 |
| 5.3 | Account instructions "labeled 'Instructions for Claude' in current settings" | 'Instructions for Claude', shown as 'Instructions' under Settings > Your Claude in the current layout (term string unchanged) | https://support.claude.com/en/articles/10185728 |
| 6.1 | Usage Policy prohibitions: "fraudulent or predatory practices", "prohibited surveillance or censorship" | "fraudulent, abusive or predatory practices", "surveillance, censorship or prohibited law-enforcement purposes" (matches the Nov 12, 2026 headings) | https://www.anthropic.com/legal/aup |
| 6.1 | High-risk areas: "legal, healthcare, financial, insurance, housing, employment and education" | Adds medical, credit and public-benefits decisions (the policy now lists eleven high-risk areas) | https://www.anthropic.com/legal/aup |
| 6.1 | "consumer-facing chatbots must tell users they are interacting with AI" | "chatbots and AI agents that talk directly with external users must tell them they are interacting with AI rather than a human" | https://www.anthropic.com/legal/aup |
| 6.2 | Memory does not store "sensitive subjects such as health or politics"; never saves "government ID numbers and financial account numbers" | "topics about personal or sensitive subject matter" unless 'Include sensitive topics in memory' is on (the examples health/politics are not on the page, so they were removed); never-saved list adds criminal history and "even if you ask" | https://support.claude.com/en/articles/11817273 |

### Verified unchanged (highlights)

- Prompting guidance (1.1, 1.3, 2.2, 5.3): the colleague test; long documents at the top; XML tags; say what to do
  instead of what not to do; explain the motivation; `<example>` tags; quote-first grounding for long documents;
  prompt chaining. Source: prompting best practices page.
- AI Fluency 4D definitions and the automation/augmentation/agency modes (framework PDF).
- Projects (2.x, 4.3, 5.1): on all plans; sharing only on Team and Enterprise with 'Can view' / 'Can edit'; each
  Project has its own memory; 'Use account memory' toggle; context is not shared across chats unless it is in Project
  knowledge; RAG capacity expansion on paid plans; concise Project instructions recommended.
- Memory and incognito (3.3, 5.4, 6.2): topics, 'remember this', edit/delete, pause vs reset, deleting a chat does not
  delete its memories, memory off for one chat from '+' (chat stays in history); incognito not saved to history or
  memory, not used for training, retained 30 days by default or longer under Enterprise custom retention, included in
  Team/Enterprise owner exports; incognito only outside Projects.
- Automatic context management (3.3): paid plans with code execution; full history preserved.
- Skills (2.4, 3.1, 4.3, 6.1): all plans; need code execution; Claude decides based on the request and description;
  built-in Excel/Word/PowerPoint/PDF Skills; custom Skills uploaded as a ZIP and private until shared; trusted-source,
  prompt-injection and exfiltration guidance.
- Code execution and file creation (2.4, 3.1): all plans; xlsx/pptx/docx/PDF output; CSV analysis; sandboxed.
- Artifacts (2.4): created for significant, self-contained content; open beside the chat; start private.
- Research (1.2, 3.1, 4.1): paid plans; web search must be on; chained searches; Gmail/Calendar/Docs connectors on web
  and desktop (web only on mobile); citations; uses limits faster.
- Custom connectors (5.2, 6.1): not verified by Anthropic; trusted servers only; hidden instructions risk; 'Allow always'.
- Google Workspace (4.3, 5.2): Owner enables on Team/Enterprise; individual auth; Docs sync from Drive; images not read.
- Model menu (3.2): next to the send button; changes apply from the next response; 'Default' label; thinking separate
  and always on for some models; Enterprise admins can restrict models/effort by role and set defaults; "tuning effort is
  often a better lever than switching models".
- Usage Policy human-in-the-loop (2.3, 6.1): qualified person with authority to change, before advice is delivered or a
  decision implemented; disclosure to the affected individual.
- Commercial data not used for training by default; consumer plans have the 'Help improve' setting (4.4, 6.2).

### Could not verify

- None outstanding. Softened: 6.2 "health or politics" examples (removed; the page says only "personal or sensitive
  subject matter").

### "Try it in Claude" callouts added (Associate)

Nine short exercises, each placed after the lesson's main explanation and tied to its decision rule. Plan availability
was checked on support.claude.com and stated where a feature is not on every plan:

- 2.4: code execution and file creation; compute a known CSV total and a two-slide deck, then reconcile one number in the file (all plans).
- 3.2: model menu and effort; compare a lower effort level with Default on a checkable tagging task.
- 3.3: memory topics, 'remember this', edit/delete, incognito (ghost icon, outside Projects), memory off from '+' in a Project (memory on by default for Free/Pro/Max/Ultra; Owner-controlled on Team/Enterprise).
- 4.1: Research on a scoped question, then open two cited sources (paid plans; web search on).
- 4.3: Skills; built-in Word Skill, optional custom SKILL.md ZIP upload (all plans; needs code execution).
- 5.1: Projects; instructions, knowledge, two chats, 'Use account memory', Share levels on Team/Enterprise (Free limited to five).
- 5.2: Google Drive connector; scoped request, approval prompt, upload-vs-connect comparison (Owner enablement on Team/Enterprise).
- 5.3: account Instructions vs Project instructions; format and edge-case rule consistency.
- 6.2: de-identify made-up data before upload; memory/incognito do not undo disclosure.

Developer 3.1 and Architect Foundations 3.1 each gained one Claude Code callout (see their sections).

## Developer Foundations, CCDV-F (lib/claude/lessons/developer-foundations.ts, all 24 lessons, 1.1 to 8.3)
- Claims checked: ~310
- Claims corrected: 14 (in 11 edits, plus 3 source updates and 1 added callout)
- Unverifiable: 0 technical claims. The exam-guide claims (overview paragraph, domain weights, item counts, "the guide lists six modes") were not checked.

Method: I downloaded the live markdown of each cited page (platform.claude.com `.md`, code.claude.com `.md`, modelcontextprotocol.io `.md`, the python-sdk README) and grepped it, rather than relying on the bundled claude-api skill. All checks were made 2026-11-25.

### Corrections
| Lesson (objective) | Before | After | Source URL |
|---|---|---|---|
| 1.1 pitfall | Managed Agents "not offered on Amazon Bedrock or on Google-managed Vertex AI" | Now names where it is offered (Claude API, Claude Platform on AWS, Claude Models on Google Cloud (Anthropic managed)) and where it is not (Bedrock, Claude Models on Google Cloud (Google managed)). The docs no longer use the name "Vertex AI" | https://platform.claude.com/docs/en/managed-agents/overview |
| 2.3 list | "older Vertex AI models use an `@` date suffix" | "older models on Claude Models on Google Cloud (Google managed) use an `@` date suffix" | https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions |
| 2.4 Files API | "not available on Amazon Bedrock or Google-managed Vertex AI" | "...or Claude Models on Google Cloud (Google managed)" (the Files API is on Claude API, Platform on AWS, Google Cloud Anthropic-managed, and Foundry hosted on Anthropic) | https://platform.claude.com/docs/en/build-with-claude/files |
| 2.4 retries text | SDKs "retry connection errors, 429s and 5xx responses twice by default with exponential backoff, honoring retry-after" | The SDKs retry up to two times (three attempts in all): connection errors, timeouts, 408, 409, 429 and 5xx, unless `x-should-retry` says otherwise. They wait as long as `retry-after` says, or back off exponentially from 0.5 to 8 s. `max_retries` 0 disables retries | https://platform.claude.com/docs/en/api/errors |
| 2.4 error table | 500 `api_error`: "Yes, with exponential backoff" | "...unless `x-should-retry` is `false`" | https://platform.claude.com/docs/en/api/errors |
| 3.1 command table | "Edit memory files, permissions, hooks, subagents: `/memory`, `/permissions`, `/hooks`, `/agents`" | `/hooks` only *views* the hook configuration. The current `/agents` only prints a reminder to ask Claude or edit `.claude/agents/`; the interactive editor exists only in v2.1.197 and earlier. Split into two rows | https://code.claude.com/docs/en/commands |
| 3.1 modes table | `plan`: "Reads only; edits wait for an approved plan" | "Reads, plus classifier-approved commands when auto mode is available; edits wait for an approved plan" | https://code.claude.com/docs/en/permission-modes |
| 3.1 headless text | "A `-p` run starts in `default` mode, so anything not pre-approved is denied" | "When nothing sets a permission mode, a `-p` run starts in default (Manual) mode, where a call that needs approval is denied rather than prompted unless something (allow rule, `PermissionRequest` hook) approves it" | https://code.claude.com/docs/en/headless |
| 5.1 text | Effort change "is part of the cached prefix" (unqualified) | Narrowed to a top-level effort change, and added that a per-message effort change (a `role: "system"` message) keeps the cache on models that support it | https://platform.claude.com/docs/en/build-with-claude/effort |
| 5.1 sources | "Adaptive thinking" -> /build-with-claude/adaptive-thinking (now serves a page titled "Steering thinking") | "Thinking" -> /build-with-claude/thinking | https://platform.claude.com/docs/en/build-with-claude/thinking |
| 5.2 list | "Claude Fable models require 30-day data retention, so an organization on zero data retention receives a 400 on every request to them" | Fable and Mythos are Covered Models that need 30-day retention. They are unavailable under Legacy ZDR unless Anthropic expressly authorizes it; a request without retention enabled returns 400 `invalid_request_error`. Retention can be enabled for one non-default workspace instead | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention |
| 5.2 list | "Bedrock and Google-managed Vertex AI lack several features" | "Bedrock and Claude Models on Google Cloud (Google managed)..." | (platform naming, models overview) |
| 5.3 list | "a single turn that appends more than 20 blocks" can push the entry out of the lookback window | "20 or more blocks". The docs' example misses at exactly 20 added blocks, because the lookback counts the breakpoint itself as the first position | https://platform.claude.com/docs/en/build-with-claude/prompt-caching |
| 6.1 text | "A newer on-demand form, under its own beta" | Names it: beta `compact-2026-09-04` with a top-level `compaction` parameter. Also notes that the docs recommend on-demand compaction wherever it is available | https://platform.claude.com/docs/en/build-with-claude/compaction |
| 6.2 pitfall | Prefill returns 400 "on current models such as Claude Opus 5.5 and Sonnet 5.5" | "on Claude 4.6 and later models, including Claude Opus 5.5 and Sonnet 5.5" | https://platform.claude.com/docs/en/api/errors (Prefill not supported) |
| 8.2 text | MCP connector "beta header `mcp-client-2025-11-20`" | Adds the newer `mcp-client-2026-09-15`. Both are listed as current; the docs examples still use 2025-11-20 | https://platform.claude.com/docs/en/agents-and-tools/mcp-connector |

Sources added: 2.2 "Mid-conversation system messages" (https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages), and 5.2 "API and data retention" (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

Callout added: in 3.1 ("Operate Claude Code"), a `tip` titled "Try it in Claude". It has the reader run `claude -p "Create notes.txt containing hello" --permission-mode dontAsk --output-format stream-json --verbose`, find the `permission_denied` event and the `permission_denials` list, then re-run with `--allowedTools "Write"`. Each flag and output field was verified in the headless, CLI-reference and permission-modes pages.

No `terms` were changed. The 3.1 term "/agents" stays, because the command still exists and the table still mentions it.

### Verified (by lesson)
- 1.1: The five workflow shapes. The Agent SDK subagent context (non-fork subagents start fresh, get only their own prompt plus the Agent tool prompt, and return only their final message). `allowed_tools` includes "Agent". AgentDefinition fields, including `model="sonnet"`. The SDK spawns one `claude` CLI subprocess per session. Managed Agents is beta (header `managed-agents-2026-04-01`) with agent/environment/session/events, `agent_toolset_20260401`, environment `{"type":"cloud","networking":{"type":"limited"}}`, and sessions `agent={"type":"agent","id","version"}`. Managed Agents is not ZDR-eligible except when self-hosted. It supports cloud or self-hosted sandboxes.
- 1.2: Tool results come first and text after. `is_error`. SDK hooks: `{}` means no decision. `on_failure`/`onFailure` "block": by default a failed callback lets the action continue. A hook's allow cannot override deny or ask rules. PostToolUse runs after success. Stop `decision:"block"`. The `if` field takes permission-rule syntax. Exit code 2 blocks with stderr as the reason. `${CLAUDE_PROJECT_DIR}`. `max_turns`.
- 1.3: The stop reasons, including pause_turn behaviour. `ResultMessage` with `error_max_turns`. Context editing beta `context-management-2025-06-27`. Compaction.
- 2.1: Request shape. `output_config.effort` and `output_config.format` (`json_schema`). Vision: base64/url/file sources; JPEG, PNG, GIF, WebP; image before text. Opus 5.5 thinking is always on, and the default display is "omitted". The stop_reason table, including `refusal` (HTTP 200, `stop_details`) and `model_context_window_exceeded`. Batches: 50%, most finish within 1 h, 24 h expiry, 29-day results, 100,000 requests or 256 MB, result types, any order / `custom_id`.
- 2.2: Mid-conversation `role:"system"` messages on supported models (Opus 5.5, Sonnet 5.5, Haiku 5.5 among others; not Sonnet 5). Don't put your own instructions in tool results. Files are workspace-scoped, not user-scoped. `anthropic-dangerous-direct-browser-access`. ZDR organizations cannot make browser calls. Session ownership per surface. Citations combined with `output_config.format` is a 400.
- 2.3: CLAUDE.md files concatenate (root down, closest last; CLAUDE.local.md after CLAUDE.md). Managed path `/etc/claude-code/CLAUDE.md`. Settings precedence managed > `--settings` > local > project > user. Lists merge. A deny from any scope beats an allow. `@` imports go max four hops. `extraKnownMarketplaces` shape, and it waits for folder trust. Plugin `dependencies`. Dateless IDs are pinned snapshots, and 4.5 aliases point at the latest dated snapshot. Bedrock `anthropic.` prefix. `anthropics/claude-code-action@v1` with `anthropic_api_key`. What `--bare` skips. `dontAsk`.
- 2.4: Streaming event order, `ping`, cumulative usage in `message_delta`, and error events after HTTP 200. Error table (400/401/403/404/413 128 MB/429 spend cap without retry-after/504 timeout_error/529). Python exception classes; `APITimeoutError` falls under `APIConnectionError`. Files: block per MIME type, `container_upload`, convert .docx/.xlsx, 500 MB per file, uploads not downloadable.
- 3.1: `--continue`, `--resume`, `--fork-session`, `/clear`, `/compact`, `/rewind`, `/context`, `--cloud`, `--teleport`, `/desktop`, `/init`. Four CLAUDE.md scopes. Keep files under 200 lines. Shift+Tab. The `manual` alias. `acceptEdits` (mkdir/mv). auto, dontAsk, bypassPermissions. Output formats; `--json-schema` gives `structured_output`, which is absent on a declined run. `--include-partial-messages`. `--max-turns`.
- 3.2: `.claude/rules` `paths`. Skill frontmatter (`disable-model-invocation`, `user-invocable`, `allowed-tools` space-separated, `context: fork`). Commands accept the same frontmatter except `name` and `paths`. Subagent frontmatter (`tools` comma-separated, `model: haiku`). plugin.json requires only `name`. Namespacing `deploy-tools:reviewer`. Component directories go at the plugin root. marketplace.json `name`/`owner`/`plugins`. `/plugin marketplace add`, `/plugin install x@y`, `claude plugin validate`.
- 4.1: Grading hierarchy (code > LLM > human). Edge-case list. "Prioritize volume over quality". Rubric tips. A `reasoning_extraction` refusal from schema reasoning fields.
- 4.2: `stop_details.category`/`explanation` (null unless refusal). Sampling parameters are a 400 on 2026-10-21, and 4.7+ models accept only defaults. Refusals are HTTP 200.
- 5.1: Lineup context (1M; Haiku 4.5 200K). 128K max output. 555k words per 1M on the Opus 4.7+ tokenizer. `count_tokens` returns an estimate. `budget_tokens` is deprecated on 4.6 and rejected later. Effort levels and their defaults (medium on Opus 5.5 and Haiku 5.5, high elsewhere). `xhigh`/`max`. Effort affects all output tokens. Thinking is billed regardless of display. `output_tokens_details.thinking_tokens`. Thinking and effort config are rendered into the prompt.
- 5.2: The models table (IDs, positioning, latency, prices including Haiku "From $0.10 / $0.50", Fable 5.2 $8/$40). Retirement is "not sooner than" on Anthropic-operated platforms, and partners set their own dates. Models API `max_input_tokens` and `max_tokens`. `claude-opus-5` exists (legacy). Opus 5.5 breaking changes: forced tool_choice 400, thinking disabled 400, default effort medium.
- 5.3: Usage fields. Cache order tools > system > messages. 4 breakpoints. 5 m TTL refreshed free; `ttl` 1h. Writes 1.25x/2x, reads 0.1x (0.05x on Opus 5.5 and Sonnet 5.5). Minimum 512 tokens on the newest models, up to 4,096 on older ones. Automatic top-level caching. Worked cost example recomputed at $328 to about $34 (Opus 5.5 5 m write $5, read $0.20). Batch 1 h TTL advice. `task_budget` beta `task-budgets-2026-03-13`, minimum 20,000. Each model has its own prompt cache (Claude Code settings doc). tool_choice changes invalidate message blocks.
- 6.1: `clear_tool_uses_20250919`, `clear_thinking_20251015`. `compact-2026-01-12` with `compact_20260112`, default trigger 150,000; blocks before the compaction block are dropped. Clearing invalidates the cache.
- 6.2: Long documents first and the query last ("up to 30 percent"). 3–5 examples in `<example>`/`<examples>`.
- 6.3: Constrained decoding for JSON outputs and strict tools; the two combine. Grammars don't apply to thinking. `messages.parse` with `output_format=Model` and `parsed_output`. Refusal and max_tokens caveats. Enum casing. Limits 20/24/16. Citations and prefill are incompatible.
- 6.4: Location types; pages 1-indexed; `cited_text` not counted in output tokens. `search_result` `source` and `title`. The "Get structured data with citations" one-line-per-field approach matches the lesson. Example indices verified (0–47, exclusive).
- 7.1: Every bullet matches the mitigate-jailbreaks page (tool_result channel, skepticism, policy, JSON encoding, Haiku 5.5 screen with structured outputs, least privilege, mid-conversation system message).
- 7.2: Deny > ask > allow, first match wins regardless of specificity. A deny in any scope wins. SDK order hooks > deny > ask > mode > allow > canUseTool. Read/Edit rule limits (scripts bypass them; use the sandbox). `sandbox.enabled`. The space before `*` matters (`ls*` matches `lsof`). Managed Agents `always_ask` permission policy.
- 7.3: Browser header, `dangerouslyAllowBrowser`, `Origin` rejection when forwarding. Key types (personal, service account, legacy workspace, WIF, admin `sk-ant-admin`). `anthropic-workspace-id`. Admin API rejects workspace-scoped keys. Expiration presets 3 h / 1 d / 7 d / 30 d / custom / never. Disable is reversible and delete is permanent; an expired key returns 401 and cannot be reactivated. Workspace-scoped resources (files, batches, prompt caches). Usage and Cost Analytics API. IP allowlisting. Files audit logging.
- 8.1: "by far the most important factor" and "at least 3–4 sentences". `input_examples`. `is_error`. Forced tool_choice is a 400 on Opus 5.5 and Sonnet 5.5 (also Fable 5.x and Mythos).
- 8.2: MCP spec 2026-07-28 exists and is "latest". Tools, resources and prompts are model-, application- and user-controlled, with their list/call/read/get methods. Python SDK `from mcp.server import MCPServer` and `mcp.run(transport="stdio")` (current README and build-server tutorial). stdio rules (stdout only protocol, stderr for logs; auth spec SHOULD NOT apply). Streamable HTTP (POST to one endpoint, JSON or SSE; validate `Origin`; bind 127.0.0.1). OAuth 2.1, RFC 9728 PRM, WWW-Authenticate, RFC 8707 audience, no token passthrough. `claude mcp add` syntax (matches the docs example ordering). `.mcp.json` `${VAR}` expansion and `type: "http"`. Connector: tools only, public HTTP only, `mcp_servers` url plus `mcp_toolset`.
- 8.3: `create_sdk_mcp_server` and `@tool`. `mcp__server__tool` and the `mcp__crm__*` wildcard. A plugin is packaging, not a capability.

### Could not verify
- Overview paragraph (v1.1, Dec 7 2026, 70 items, 60 scored, 720/1000, domain weights) and "the guide lists six modes" (4.2): not checked (exam guide). Left unchanged.
- "Claude Code ... the mobile app" as a front end (3.1): not specifically checked; low risk. Left as is.

### Notes / disagreements between the bundled claude-api skill and the live docs
- I did not consult the bundled skill. Every check was made against live docs fetched today, so I logged no disagreements.
- Naming drift: the live docs consistently say "Claude Models on Google Cloud (Google managed)" or "Google Cloud's Agent Platform" instead of "Vertex AI". Other lesson files probably still use "Vertex AI".
- New in API version 2026-10-21 and not covered by the lesson (no change needed, but useful elsewhere): `document` blocks in assistant messages and non-empty `citations` on user `text` blocks now return 400. SDK major versions send keys as `Authorization: Bearer`.

### Coordinator follow-up

| Lesson | Before | After | Source |
|---|---|---|---|
| 5.3 | cache reads "0.1 times (0.05 times on Claude Opus 5.5 and Sonnet 5.5)" | adds "0.025 times on Fable and Mythos 5.1 and 5.2" | https://platform.claude.com/docs/en/build-with-claude/prompt-caching |

## Architect Foundations, CCAR-F (lessons 1.1 to 5.6, all 30)
- Claims checked: ~165
- Claims corrected: 11 (in 8 lessons), plus 1 "Try it in Claude" callout added (3.1)
- Unverifiable: 0 technical claims. Exam-guide claims were not checked (see below).

### Corrections
| Lesson (objective) | Before | After | Source URL |
|---|---|---|---|
| 2.3 | Forced-tool JSON example used `"model": "claude-sonnet-5-5"` with `tool_choice: {type: "tool"}` | `claude-haiku-5-5`, and the caption notes that Haiku 5.5 accepts forced tool use | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools |
| 2.3 | "not every model and setting supports forced tool use" (vague) | Names the models that reject it: Opus 5.5, Sonnet 5.5, Fable/Mythos 5.1 and 5.2, and manual extended thinking. Says these return a 400, recommends "auto" with strict tools or structured outputs instead, and adds that a forced call skips thinking | same |
| 4.3 | Python example used `claude-sonnet-5-5` with `tool_choice={"type": "any"}` (the API returns a 400) | `claude-haiku-5-5`, with a comment explaining why | same |
| 4.3 | (no model caveat) | New paragraph: on Opus 5.5, Sonnet 5.5 and Fable/Mythos 5.x, use auto with `strict: true` or `output_config.format`. Haiku 5.5 and Opus 5 still accept forced tool use | same, plus https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| 4.3 exam callout | "`tool_choice` set to any or a named tool" | adds "on models that support forcing" | define-tools |
| 4.5 | Batch params used `claude-sonnet-5-5` with a forced `tool_choice`. Every request would come back `errored` | `claude-haiku-5-5` | define-tools; https://platform.claude.com/docs/en/build-with-claude/batch-processing |
| 4.5 | "if Claude stops with tool_use there is no way to run the tool" (applied to all tools) | Narrowed to your client tools. Server tools such as web search do run inside a batched request | batch-processing ("Tool use, including all server tools") |
| 4.6 | Independent reviewer used `claude-sonnet-5-5` with a forced `record_findings` tool | `claude-opus-5`, with a comment | define-tools |
| 3.6 | "CLAUDE.md is loaded in -p runs just as in interactive sessions" | Plain `-p` still loads it. Adds that the docs recommend `--bare` for scripted runs (and plan to make it the `-p` default), that bare mode skips CLAUDE.md, hooks, skills and MCP, and to use `--append-system-prompt-file` in that case | https://code.claude.com/docs/en/headless |
| 1.3 (text + pitfall) | Subagents "share no memory with earlier invocations of itself" / "two calls ... do not share memory" | Qualified: a fresh invocation shares nothing; only an explicit resume by agent ID carries the transcript forward | https://code.claude.com/docs/en/agent-sdk/subagents |
| 3.2 | `allowed-tools` pre-approves tools "while it runs" | Pre-approves them "during the turn that invokes the skill; the grant clears with your next message" | https://code.claude.com/docs/en/skills |
| 2.4 | Project servers need approval; tools are "discovered and offered to the agent together" | Adds that `claude -p` and SDK runs load `.mcp.json` servers without asking, and that tool search defers MCP tool schemas by default | https://code.claude.com/docs/en/mcp ; https://code.claude.com/docs/en/agent-sdk/agent-loop |

Callout added (3.1, tone tip, "Try it in Claude"): run `/memory`, then `/context all`, then move one instruction from `~/.claude/CLAUDE.md` to `./CLAUDE.md` and check again. All three behaviours are confirmed on the memory docs page.

### Verified (one line per lesson)
- 1.1: stop_reason values tool_use, end_turn, max_tokens, stop_sequence, pause_turn (server-tool loop iteration limit, default 10), refusal (HTTP 200), model_context_window_exceeded. tool_result blocks must come first in the user message (text before them gives a 400). Every tool_use gets a result, failures included. `is_error`. SDK `max_turns`/`maxTurns` and `error_max_turns` on ResultMessage. Model ID `claude-sonnet-5-5` is valid (used here without forced tools).
- 1.2: design guidance. Subagents' isolated context and the "only the final message returns" behaviour match the SDK subagents page.
- 1.3: Task renamed to Agent in 2.1.63. `Task(...)` still works as an alias in settings and agent definitions, and tool_use blocks say "Agent". `allowedTools`/`allowed_tools`. AgentDefinition fields description, prompt, tools, model, disallowedTools (camelCase in Python). Subagent context = own prompt + Agent tool prompt + tools + project CLAUDE.md via settingSources; no parent history or system prompt. Parallel subagents. `fork_session`.
- 1.4: Python hook callback signature `(input_data, tool_use_id, context)`. hookSpecificOutput / permissionDecision deny / permissionDecisionReason. `{}` = no decision. HookMatcher. `tool_response`, `session_id`. `mcp__server__tool` naming.
- 1.5: permissionDecision allow/deny/ask/defer. updatedInput. PostToolUse additionalContext and updatedToolOutput (built-in and MCP tools) vs older MCP-only updatedMCPToolOutput, for both the SDK and Claude Code hooks. Exit 2 blocks and sends stderr to Claude; exit 0 + JSON. `${CLAUDE_PROJECT_DIR}`. Matchers: `Write|Edit` exact list; regex like `mcp__billing__.*`.
- 1.6: the prompting docs say chaining is "still useful when you need to inspect intermediate outputs or enforce a specific pipeline structure".
- 1.7: `-n`/`--name`, `/rename`, `--resume`/`-r <name>`, `--continue`/`-c` (most recent in the current directory), `--fork-session` (new session ID), `/branch`. SDK `resume`, `fork_session`/`forkSession`, `continue_conversation` (Python) / `continue` (TS). Forks branch the conversation, not the filesystem.
- 2.1: "by far the most important factor in tool performance". `input_examples` (optional, GA). Consolidate behind an `action` param. Service-prefixed names such as `github_list_prs`.
- 2.2: MCP 2026-07-28 spec exists. Protocol errors are JSON-RPC errors; tool execution errors use `isError: true`, and clients SHOULD pass them to the model. CallToolResult `content`/`isError`. SDK custom tool returns `"is_error": True` (Python) / `isError` (TS). `@tool(name, description, schema)`.
- 2.3: four tool_choice values and their defaults (auto when tools are present, none when there are none). any/tool make the response start with tool_use and no preamble. AgentDefinition tools/disallowedTools.
- 2.4: local (default, `~/.claude.json`), project (`.mcp.json`), user (`~/.claude.json`). Precedence local > project > user, with no field merging. `${VAR}` and `${VAR:-default}` in command/args/env/url/headers. `claude mcp add --transport ... --scope ...`, and `--` for stdio. Approval prompt for project servers. `@server:protocol://resource/path`. `resources/list`, `resources/read`, URI-identified.
- 2.5: Grep built on ripgrep with output_mode/glob/type. Edit old_string must be unique, replace_all, no regex or fuzzy matching. Read offset/limit. Glob and Grep are left out of the default tool set on macOS/Linux/WSL and come back via `--tools`/`--allowedTools`.
- 3.1: CLAUDE.md locations including `.claude/CLAUDE.md`, CLAUDE.local.md and managed. Ancestors load at launch and are concatenated root-down; subdirectory files load on demand. Conflicts: Claude "may pick one arbitrarily". Imports resolve relative to the importing file, max depth four hops, skipped inside code spans and blocks. `.claude/rules/` is recursive, `~/.claude/rules/` exists. `/memory` lists files and toggles auto memory. `/context all` shows Memory files.
- 3.2: commands merged into skills; command files take the same frontmatter except name and paths. Skill paths. Frontmatter description, argument-hint, context: fork, agent (Explore/Plan/general-purpose/custom), allowed-tools (pre-approves, doesn't restrict; space- or comma-separated or a list), disallowed-tools, disable-model-invocation, `$ARGUMENTS`/`$0`/`$1`. Personal skills take precedence over project skills. A forked subagent doesn't see the conversation.
- 3.3: `paths` frontmatter; globs relative to the directory that contains `.claude`; brace expansion; `/*.md` = root only; `paths` is the only field read; bad YAML means the rule loads as if unscoped; `claude --debug` shows the parse error.
- 3.4: Shift+Tab, `/plan` prefix, `--permission-mode plan`, approval options, Ctrl+G edits the plan, approving switches the mode. Explore is read-only (Write/Edit denied) with quick, medium or very thorough. The Plan subagent is used in plan mode.
- 3.5: design guidance. Matches best-practices ("give Claude a check it can run").
- 3.6: `-p`/`--print`; `--output-format text|json|stream-json`; json has `result` and `session_id`; `--json-schema` puts the result in `structured_output`, which is absent when there's no valid output; `--allowedTools "Read" "Bash(git diff *)"` syntax; `--max-turns` (print mode).
- 4.1 and 4.2: `<example>`/`<examples>` tags; 3 to 5 examples recommended.
- 4.3: `strict: true`; `output_config.format` with `type: "json_schema"` (GA, status stable); schemas guarantee structure, not accuracy.
- 4.5: 50% discount; most batches finish in under 1 hour; results available at completion or after 24h, and unfinished requests expire at 24h; 100,000 requests or 256 MB; results kept 29 days; custom_id `^[a-zA-Z0-9_-]{1,64}$`; result types succeeded/errored/canceled/expired; processing_status in_progress→ended; results may not match input order.
- 5.1: long documents go at the top, above the query, instructions and examples.
- 5.4: Explore subagent; `/compact [instructions]`; `/clear`.
- 5.2, 5.3, 5.5, 5.6: design and judgment guidance with no concrete product claims. Nothing to correct.

### Could not verify / not checked
- Overview paragraph (60 items, 120 minutes, 4 of 6 scenarios, scaled 720 on 100 to 1,000) and every "How the exam frames it" callout: not checked (exam guide).
- The "lost in the middle" effect (5.1) is a general research finding, not an Anthropic doc claim. Left as written; it isn't attributed to Anthropic docs.

### Notes / disagreements between bundled claude-api skill and live docs
- I didn't consult the bundled skill; everything was checked against the live docs. The main stale assumption in the lesson (likely carried over from older references) was that any current model accepts forced `tool_choice`. The live define-tools page says Opus 5.5, Sonnet 5.5 and the Fable/Mythos 5.1 and 5.2 models reject "any" and named tools with a 400 error.
- Also noted (not changed): Claude Code subagents now start in the background by default, and subagents can message each other via `SendMessage` and spawn nested subagents (default depth 3). Lesson 1.2's "subagents never talk to each other directly" is framed as a design rule, so I left it.

## Architect Professional (CCAR-P), header/constants/overview + lessons 1.1 through 3.7 (lines 1 to ~1334)

- Claims checked: ~185
- Claims corrected: 4 (plus 1 source added)
- Unverifiable: 0 product claims (exam-guide claims not checked, listed below)

The lessons were already accurate against the live docs (fetched 2026-11-25). No factual errors were found in model IDs, prices, defaults, beta headers, parameter names, or spec requirements. The edits below fix one incompleteness, one imprecision, one numeric approximation, and make one vague claim specific.

### Corrections

| Lesson (objective) | Before | After | Source URL |
|---|---|---|---|
| 2.3 | "Opus 5.5 and Fable 5.2 keep thinking always on, and a request with `thinking: {"type": "disabled"}` is rejected." (no mention of Sonnet 5.5, so a reader could infer that Sonnet 5.5 accepts `disabled`) | Added: "Sonnet 5.5 also rejects `disabled`; its lowest setting is `thinking: {"type": "between_tools"}`, which skips up-front thinking." | https://platform.claude.com/docs/en/api/errors (Thinking cannot be disabled) |
| 3.4 | "`plugin_errors` and `mcp_server_errors` fields let CI fail fast when a plugin or MCP server did not load" | Added "(plus each server's `status` in `mcp_servers`)". `mcp_server_errors` lists only `--mcp-config` entries that failed config validation. A server that fails to connect shows up through its `status` in `mcp_servers`. | https://code.claude.com/docs/en/headless |
| 1.5 (pitfall) | "A Haiku router looks ten times cheaper per call" | "looks far cheaper per call (Haiku 5.5 list prices start at one-twentieth of Sonnet 5.5's)". List prices are $0.10/$0.50 vs $2/$10, which is 20x, not 10x. | https://platform.claude.com/docs/en/about-claude/pricing |
| 2.1 | "'from' because longer prompts are billed at a higher rate" | "'from' because prompts over 100,000 tokens are billed at a higher rate" ($0.50/$2.50 above 100K) | https://platform.claude.com/docs/en/about-claude/pricing (Long context pricing) |
| 2.5 sources | Only the API prompt caching page was cited for "caches are model-scoped", and that page does not state it | Added source `${CODE}/prompt-caching` ("each model has its own cache"). The `terms` were not changed. | https://code.claude.com/docs/en/prompt-caching |

### Verified (grouped by lesson)
- Header constants: the `DOCS`, `CODE` and `ENG` URLs resolve. `MCP` = https://modelcontextprotocol.io/specification/2026-07-28 EXISTS (HTTP 200). Its /basic/authorization and /basic/transports pages also exist, so the constant was left unchanged.
- 1.1: Agent SDK `canUseTool`, ask rules, and `PreToolUse` deny; Managed Agents `permission_policy` `always_ask` pauses the session (MCP toolsets default to `always_ask`).
- 1.2: 429 `rate_limit_error`; ramp limits (with `ramp_limit_exceeded` code); rate limits set at the org level; cache isolation per org plus per workspace on the Claude API, Platform on AWS, and Foundry; org-only isolation on Bedrock and Google-managed.
- 1.3: Building-effective-agents definitions and the five workflow patterns; augmented LLM; Skills about 100 tokens of metadata, body loaded on trigger, scripts run through bash with only their output entering context; Skills on the API are workspace-wide and run in a container with no network access; `.claude/skills/` and plugins; "use only trusted sources" and audit guidance.
- 1.4: `Agent` tool; fresh context unless a fork; only the final message returns; `tools`, `disallowedTools`, and `maxTurns` (partial marking); `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` default 3; `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` default 20; `maxBudgetUsd` includes subagents; `parent_tool_use_id`, plus `agent_id` in TS; multi-agent post guidance (objective, output format, tools/sources, boundaries; 1 agent for simple tasks, 10+ subagents for complex ones).
- 1.5: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 from $0.10/$0.50; Batch 50%; cache reads 5% on Opus 5.5 and Sonnet 5.5; default effort Opus 5.5 `medium`, Sonnet 5.5 `high`. Table arithmetic checked.
- 1.6: The surfaces and names (Claude Platform on AWS, Google Cloud Anthropic-managed and Google-managed); Managed Agents is beta on the Claude API and Platform on AWS and not offered on Bedrock, Google-managed, or Foundry; Platform on AWS has feature parity, ZDR on request, and no HIPAA; Bedrock lacks Batches, Files, and Models API and sets its own lifecycle; Google-managed has no web fetch and only basic `web_search_20250305`; Foundry offers Hosted on Anthropic or Hosted on Azure, with some tools needing Anthropic hosting; `inference_geo`; Managed Agents is not ZDR/HIPAA eligible except self-hosted under Legacy ZDR; Covered Models (Fable and Mythos 5, 5.1, 5.2) need 30-day retention unless expressly authorized.
- 2.1: The full model table (IDs, positioning, latency, prices, default effort); Fable 5.2 is a Covered Model; partner platforms set their own lifecycles; caches are model-scoped.
- 2.2: Prefill returns 400 on Claude 4.6+; `output_config.format`; `strict: true`; effort barely changes reply length (Fable 5.2 and Opus 5 guidance); context-engineering "right altitude".
- 2.3: Effort values low/medium/high/xhigh/max; adaptive thinking on current models; `display` defaults to `omitted` on Claude 5+ and `"summarized"` opts in; `budget_tokens` deprecated on Opus 4.6 and Sonnet 4.6 and not accepted later; forced `tool_choice` any/tool rejected on Opus 5.5 and Sonnet 5.5; API `2026-10-21` rejects temperature/top_p/top_k; only the schema is cached (up to 24h); `json_schema` request shape.
- 2.4: Cache read multipliers 10% / 5% (Opus 5.5, Sonnet 5.5) / 2.5% (Fable 5.2); `/v1/messages/count_tokens`; `clear_tool_uses_20250919`; `defer_loading`; context rot and "smallest possible set of high-signal tokens".
- 2.5: Prefix order tools → system → messages; max 4 breakpoints, with automatic caching using one slot; 5-minute default TTL refreshed free; 1h writes at 2x vs 1.25x; longer TTL first; 512-token minimum on current models; 20-position lookback; invalidators (tool_choice, images, thinking, effort); per-message effort preserves the cache.
- 2.6: `output_config.effort` / Managed Agents `effort` on the model object; effort affects text, tool calls, and thinking; `xhigh` for long-running work; `low` for subagents; `clear_tool_uses_20250919` params; beta `context-management-2025-06-27`; `clear_thinking_20251015` with `keep`; `compact_20260112` (threshold) and top-level `compaction` (on demand); `memory_20250818`, `/memories`, client-side, path-traversal guidance; automatic warning before clearing when paired with memory.
- 3.1: AgentDefinition `tools` does not pre-approve; `disallowedTools` accepts `mcp__server__*`; `allowedTools` does not constrain `bypassPermissions`; deny rules and hook denies apply in every mode.
- 3.2: MCP 2026-07-28 auth: OAuth 2.1 resource server; MUST implement RFC 9728; `resource` (RFC 8707) in both authorization and token requests; audience validation; MUST NOT accept or transit other tokens; PKCE; least-privilege scopes; 403 `insufficient_scope` step-up; stdio takes credentials from the environment. Also `apiKeyHelper`; Managed Agents `vault_ids`, with credentials keyed by `mcp_server_url`.
- 3.3: Contextual retrieval 35% / 49% / 67%; top 150 reranked to top 20; fast mode `speed: "fast"` on Opus 5.5 (up to 2.5x OTPS, premium pricing).
- 3.4: `request-id` header; stop_reason values; `CLAUDE_CODE_ENABLE_TELEMETRY` settable in managed settings; `claude_code.tool_decision` / `claude_code.api_request`; `system/api_retry`; `system/init` fields; multi-agent post on tracing and decision-pattern monitoring without conversation contents.
- 3.5: 50-100 token chunk context; $1.02 per million document tokens; under 200,000 tokens put the whole corpus in the prompt; top-20 beats top-5/10; `search_result` blocks; citations plus `output_config.format` returns 400.
- 3.6: Transports (stdio, Streamable HTTP POST with JSON or request-scoped SSE); `_meta` per-request metadata; earlier revisions used `initialize` / sessions, with backward-compatibility fallback; MCP connector needs `mcp_servers` plus `mcp_toolset` and a beta header, is not ZDR/HIPAA eligible, and is not on Bedrock or Google-managed; 4x / 15x token figures.
- 3.7: Skills levels (about 100 tokens, under about 5k, resources as needed); tool search keeps at least one tool non-deferred; just-in-time context is slower than pre-retrieval; hybrid approach (Claude Code loads CLAUDE.md up front and uses glob/grep); a Skill `description` must say what the Skill does and when to use it.

### Could not verify
- Exam-guide claims (not checked): overview (70 items, 60 scored + 10 unscored, 120 minutes, scaled 100-1,000, cut 720, domain weights 21/18/17/16/13/8/7, guide v1.1 effective December 7, 2026), the header comment's "exam guide v1.1", and per-lesson paraphrases of guide wording ("under a specified load or trust condition", "without unnecessary token cost", "without loss of task-relevant information", the four surfaces and three runtimes, the value pillars). Left unchanged.

### Notes / disagreements
- I did not use the bundled claude-api skill. All checks were made against live docs.
- The API prompt-caching page never says that caches are per model. Only the Claude Code prompt-caching page does, so I added it as the source.
- MCP constant: the 2026-07-28 spec exists and is current. No change was needed, which is safe for the other agent's range.

### Coordinator follow-up (lead-requested checks)

| Lesson | Before | After | Source |
|---|---|---|---|
| 1.6 | Bedrock/Vertex satisfies residency; "because Managed Agents is not offered there, the firm hosts the agent loop ... typically with the Agent SDK" | Adds Bedrock EU inference profiles / in-region endpoints (10% premium), self-hosted Managed Agents (account team) as an alternative that can call Bedrock or Google-managed Claude, and that hosted Managed Agents offers only `us`/`global` inference geo with US-only workspace geo | https://platform.claude.com/docs/en/manage-claude/data-residency ; https://platform.claude.com/docs/en/managed-agents/self-hosted ; https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock |
| 2.3 | "Opus 5.5 and Sonnet 5.5 reject `tool_choice` of type `any` or `tool`" | Also Fable/Mythos 5.1 and 5.2, and manual extended thinking on any model; Haiku 5.5 and Opus 5 still accept it (forced call skips thinking) | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools |

## Architect Professional, CCAR-P (lessons 3.8 through 7.3, 20 lessons; line ~1336 to end)
- Claims checked: ~185
- Claims corrected: 12 (10 text corrections/clarifications + source additions)
- Unverifiable: 3 (all exam-guide items, left unchanged)

All checks were made on 2026-11-25 against live markdown copies of platform.claude.com and code.claude.com pages
(`<url>.md`), plus the two anthropic.com engineering posts. The MCP constant URL
(https://modelcontextprotocol.io/specification/2026-07-28) returns HTTP 200; it is not used in my range.

### Corrections
| Lesson (objective) | Before | After | Source URL |
|---|---|---|---|
| 3.8 | 429 with no `retry-after`: "Likely a spend cap" | Names the tier's monthly spend cap and the code to check for (`error.details.error_code` = `enforced_spend_limit_reached` on the Messages API) | https://platform.claude.com/docs/en/api/errors |
| 3.8 | Refusal fallback: "`fallbacks` (beta) on the Claude API, or client-side fallback middleware on other platforms" | Server-side `fallbacks` (beta) on the Claude API **and Claude Models on Google Cloud (Anthropic managed)**; the SDK middleware works on any platform | https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback |
| 3.8 | "Retry only transient classes: 429, 5xx, 529, and connection errors." | Rate-limit 429s, 5xx (including 529), connection errors, **and follow `x-should-retry` when present** (a spend-cap 429 is not transient) | https://platform.claude.com/docs/en/api/errors#retries |
| 3.8 | sources | Added "Refusals and fallback" | same |
| 4.6 | "380-token prompt is below the 512-token minimum for current models" | 512 tokens applies to the latest models (Sonnet 5.5, Opus 5.5 and others); some earlier models still on sale need 1,024 or more (Sonnet 5 and Opus 4.8 need 1,024; Opus 4.7 needs 2,048; Opus 4.6/4.5 and Haiku 4.5 need 4,096) | https://platform.claude.com/docs/en/build-with-claude/prompt-caching#cache-limitations |
| 4.7 | "sampling parameters are rejected under API version `2026-10-21`" | Opus 5.5 rejects `temperature`/`top_p`/`top_k` on any API version; API version 2026-10-21 removes them for every model | https://platform.claude.com/docs/en/models/opus-5-5/migration-guide ; https://platform.claude.com/docs/en/api/versioning |
| 4.7 | sources | Added Opus 5.5 migration guide and API versions | same |
| 5.2 | "`sandbox.network.allowedDomains` limits where commands can reach" | The list only pre-allows hosts. It becomes a hard boundary only with `sandbox.network.strictAllowlist` or managed `allowManagedDomainsOnly`; otherwise a host outside the list goes to the permission mode, and `bypassPermissions` allows it | https://code.claude.com/docs/en/settings-reference ; https://code.claude.com/docs/en/sandboxing |
| 5.2 | sources | Added Mid-conversation system messages and Claude Code sandboxing | as above + https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages |
| 5.3 | "Separate workspaces keep one runaway app from starving another" | Needs each workspace to have its own rate and spend limits, because a workspace with no limits set shares the organization's | https://platform.claude.com/docs/en/api/rate-limits#setting-lower-limits-for-workspaces |
| 5.4 | "`--permission-prompts none`, anything that would prompt is denied" | Added "unless a `PermissionRequest` hook allows the call"; added Managed Agents permission policies source | https://code.claude.com/docs/en/headless ; https://platform.claude.com/docs/en/managed-agents/permission-policies |
| 5.5 | "Amazon Bedrock or Vertex AI" | "Amazon Bedrock or Claude Models on Google Cloud (Google managed)", the current product name used everywhere else in the docs and this file | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention |
| 5.5 | "Covered Models ... require 30-day retention." | Adds that Covered Models are unavailable under Legacy ZDR unless Anthropic expressly authorizes them, and that Enterprise Frontier Safeguards ZDR (beta) is the separate route | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention#model-specific-data-retention-requirements |
| 6.1 | Clause 3.1: "sampling parameters are not available on current models under API version `2026-10-21`" | Current models such as Opus 5.5 reject them; 2026-10-21 removes them for every model; `temperature: 0` never guaranteed identical outputs. Added API versions source | https://platform.claude.com/docs/en/api/versioning ; Opus 5.5 migration guide |
| 7.2 | acceptEdits commands `mkdir, touch, rm, mv, cp, sed` | Added `rmdir` (the docs list it) | https://code.claude.com/docs/en/agent-sdk/permissions |

No `terms` arrays were changed.

### Verified (grouped)
- 3.8: 429 `rate_limit_error`; tier spend-cap 429 has no `retry-after` and persists; 529 `overloaded_error` under high traffic across all users; 413 `request_too_large`; SDK retries twice by default (`max_retries`), honors `retry-after`, otherwise exponential backoff; streaming for long requests; `request-id` header on every response; `stop_reason: "refusal"`; `fallbacks` is beta (header `server-side-fallback-2026-07-01`).
- 4.1 / 4.2 / 4.3 / 4.4 / 4.5 / 5.6 (engineering posts): transcript vs outcome (flight-booking DB example); code, model and human graders, with human as gold standard used to calibrate; capability vs regression evals (regression near 100%); 20 to 50 tasks drawn from real failures; balanced problem sets; isolated trials (shared state skews results); grade outcomes, not paths; give the judge an "Unknown" option; read transcripts; pass@k vs pass^k with 0.75^3 ≈ 42%; research-system judge (single prompt, 0.0 to 1.0 score plus pass/fail; rubric: factual accuracy, citation accuracy, completeness, source quality, tool efficiency).
- 4.4 / 4.6: batch is 50% off; cache reads cost 5% of base input on Opus 5.5 and Sonnet 5.5 (10% generally, 2.5% on Fable 5.2/5.1); usage field names; changing top-level effort can invalidate the cache, while per-message effort preserves it on supporting models; lower effort means fewer and terser tool calls.
- 4.5: forced-`tool_choice` 400 message text is exact; `maxTurns` returns output marked partial (v2.1.246+); `max_tokens` stop reason; `is_error`.
- 4.7: lifecycle states and definitions; at least 60 days' notice; scope of dates (Anthropic-operated platforms vs Bedrock and Google-managed); retired models return 404 `not_found_error` on the Messages API; every model ID is a pinned snapshot, including dateless IDs from 4.6 on; Opus 4.5 (`claude-opus-4-5-20251101`) deprecated 2026-11-23 with retirement on January 22, 2027 and replacement `claude-opus-5-5`; Opus 5.5 rejects forced `tool_choice` (`any`/`tool`), so use `auto` plus strict tools or structured outputs; thinking cannot be disabled; default effort is `medium`; effort barely changes reply length, so prompt for length; Sonnet 5.5's effort levels are calibrated differently from Sonnet 5's; run an effort sweep; Console Usage page Export audits usage by API key and model.
- 5.1 / 5.4 / 7.2 (Agent SDK permissions): evaluation order (hooks, deny, ask, mode, allow, canUseTool); hook `allow` does not skip deny/ask rules; deny rules and hook denials hold in `bypassPermissions`; `permissionDecision` values (`allow`/`deny`/`ask`, plus `defer`, which is not mentioned); `updatedInput`; `PermissionRequest` hook; six modes and their behavior; `allowedTools` does not constrain `bypassPermissions`; subagents inherit plan/acceptEdits/auto/bypassPermissions, and a subagent's own `bypassPermissions` value is never applied (v2.1.267+); calls that were auto-approved never reach `canUseTool`; `-p` and SDK runs start in `default` (Manual) from v2.1.302; `defaultMode` values `auto` and `bypassPermissions` are ignored in project and local settings; `--permission-prompts none` (v2.1.259+); JSON output `result` and `total_cost_usd`; `--json-schema`; `--max-budget-usd`; hook JSON output shape.
- 5.1 / 5.4 (Managed Agents): `always_ask` pauses the session (`requires_action`) until a `user.tool_confirmation` event with `allow`/`deny`.
- 5.2: Skills security warnings (trusted sources only, audit all files, external URLs are risky, a malicious Skill can direct tool calls that don't match its stated purpose); mid-conversation `role: "system"` messages treated as the operator's channel, on supported models; subagent output scanning neutralizes control-tag imitation (v2.1.210+).
- 5.3: `maxBudgetUsd` / `max_budget_usd`; `--max-budget-usd`; a spend limit you set returns 400; plugin `version` keeps users on that version; `strictKnownMarketplaces` (managed-only); `deniedMcpServers`.
- 5.5: data processor by platform; Legacy ZDR per organization, not blocked by the API; HIPAA readiness blocks non-eligible features with a 400, is permanent, needs separate organizations, and does not cover Claude Code; batch has 29-day retention; Files API, code execution, Agent Skills, MCP connector, message threads and Managed Agents (except self-hosted) are not ZDR-eligible; structured outputs keep only the schema, for up to 24 hours; no PHI in schemas; prompt caching is ZDR- and HIPAA-eligible, with in-memory KV cache; cache isolated by organization, and by workspace on the Claude API, Claude Platform on AWS and Foundry; `inference_geo: "us"`; Activity Feed kept 6 years; Bedrock regional endpoints guarantee routing.
- 6.1 / 6.2 / 6.3: "not sooner than" retirement dates fall in 2027 for current models; Managed Agents sessions persist until deleted; self-hosted Managed Agents are ZDR-eligible; 401 `authentication_error` on an expired key; the spend-cap 429 facts above.
- 7.1: plugin layout (`.claude-plugin/plugin.json`, `skills/`, `agents/`, `commands/` with "Prefer `skills/` for new plugins", `hooks/hooks.json`, `.mcp.json`); `.claude-plugin/marketplace.json`; `claude plugin marketplace add`, `claude plugin install name@marketplace`, `claude plugin validate --strict`; `extraKnownMarketplaces` shape and its trust gate; `strictKnownMarketplaces` (an empty array blocks all, including the official marketplace); `allowManagedHooksOnly`; `allowManagedPermissionRulesOnly`; `permissions.disableBypassPermissionsMode: "disable"`; managed settings at the top of precedence; list keys merge; `-p` runs project hooks and `.mcp.json` servers with no trust dialog; bare mode skips hooks, including those passed with `--settings` or a plugin.
- 7.3: `attribution` / `attribution.commit` / `attribution.pr`; `includeCoAuthoredBy` deprecated since v2.0.62; `CLAUDE_CODE_ENABLE_TELEMETRY=1`; metrics `claude_code.pull_request.count`, `claude_code.commit.count`, `claude_code.code_edit_tool.decision`.

### Could not verify
- Exam-guide claims (not checked, exam guide): 7.2 "The guide lists six permission modes"; 5.4 "That table is the guide's own sample"; 3.8 and 5.5 "How the exam frames it" references to guide samples and rationale; the guide's named categories in 4.1, 4.3, 4.5, 5.3 and 5.6. Left unchanged.
- 6.3 "the notice goes to the account's contacts, who may not be the receiving team". The docs say only that impacted customers are notified by email and in the documentation. Left as is, since it is a reasonable reading and not a product claim.

### Notes / disagreements
- I did not consult the bundled claude-api skill; everything was checked against live docs.
- `${DOCS}/about-claude/models/overview` now serves canonical URL `/docs/en/models/overview` (redirect). The link still works, so I left it.
- Default effort differs by model: `medium` on Opus 5.5 and Haiku 5.5, `high` on Sonnet 5.5 and Fable 5.2. Lesson artifacts that set `effort=medium` explicitly are fine.

## Checks run

- `node scripts/build-glossary-lessons.cjs`: regenerated `lib/glossary/claude-lessons.ts`. No `terms` strings were changed on any track.
- `node scripts/check-glossary.cjs`: passed (129 terms, 115 linked to lessons).
- `node scripts/check-labs.cjs` (loads lesson paths): passed.
- `npx tsc --noEmit`: no errors in `lib/claude/lessons/`. Errors remain in files other agents are editing (`lib/claude/readiness.ts` exports, `components/academy/*`, `components/today/use-today.ts`, `lib/labs/claude/professional-eval-gate.ts`, `lib/world-progress.ts`).
- `node scripts/check-claude-content.cjs`: fails before its own checks with `TypeError: timedEvidence is not a function` from the in-progress `lib/claude/readiness.ts` change. It does not load the lesson files.
