# CertCity assignments: a learn-by-doing re-evaluation

Date: 2026-11-24 · Branch `certcity-readiness-overhaul` (working tree, uncommitted) · Read-only review.
Inputs read: `lib/claude/casework.ts`, `lib/claude/cases/*` (dumped field-by-field with `dump.cjs` in this folder → `dump.txt`), `lib/claude/assignment-work.ts`, `lib/claude/fieldwork.ts`, `supabase/functions/_shared/dispatch.ts`, `supabase/functions/dispatch/index.ts`, `lib/claude/capstones/{model,artifacts,associate,developer,architect,professional}.ts`, `lib/claude/pathway.ts`, `lib/claude/blueprints.ts` (domain weights), `lib/certifications/providers.ts`, `lib/scene/room-replay.ts`, `lib/scene/sites.ts`, `components/academy/case-workbench.tsx`, `research/assignment-approachability.md`.

---

## 0. The short version

* **27 of 34 missions are still menus.** The redesign removed the answer tells (null defaults, seeded shuffle, hint ladder, predict, judge-the-replay), so a learner now has to *understand* to pass. But what they produce is still "a choice from 3–4 labelled options". Nobody writes a prompt, a `tool_result`, a `custom_id`, a hook, or a `.mcp.json` in the city. That's recognition, not production. It transfers to multiple-choice exam items reasonably well (the exams *are* scenario MCQs). It does not deliver the product promise of learning by doing.
* **The real "doing" already exists, but in the wrong place.** The 8 practice-workspace labs (`lib/claude/capstones/*`, 4 tracks × capstone + transfer) have learners author real `settings.json`, `.mcp.json`, `SKILL.md`, rule frontmatter, Messages API requests, `tool_result` follow-ups, batch bodies, JSON schemas, `claude -p` CI commands, ADRs and eval plans. Some of those are graded by *executing* the artifact against fixtures: `hookSimulation`, `permissionDecision`, `expandEnv`, `globRegex` rule loading, `validateSchema` against good/bad samples, `prefixBlocks` cache ordering, `custom_id` joins. That's the right engine. It's sitting behind the practice workspace while the 3D city runs menus.
* **The 7 dedicated surfaces (Dispatch + 6 labs) are the city's best work.** Their consequences come from a mechanism (an SSE decoder, a retrieval ranker, a fresh-chat reply generator), not from a lookup of "is the answer key selected". But the input is still constrained config (enums and booleans), not authored artifacts.
* **Recommendation:** adopt one mission format, **Author → Run → See → Fix → Transfer**. The learner writes a real artifact in a real file format. A deterministic simulator *executes* it against fixture traces. Its behavior comes from the artifact's actual properties (IDs match or don't, a matcher fires or doesn't, a prompt states an "unknown is allowed" rule or doesn't). The trace is shown, the city reacts, and credit requires a hidden *transfer* fixture. Lift the capstone simulators into a provider-agnostic `lib/labs/` engine layer. Rebuild 8 high-weight, low-fidelity missions first. Merge 3 redundant ones. Add an optional, non-credit "field test with real Claude" mode for prompt-writing missions only.

---

## 1. First-principles framework

### 1.1 What "doing" means per exam

The exams test judgment through scenarios. The professional skill behind each scenario is *producing an artifact that makes a system behave correctly*. Learn-by-doing means the learner produces that artifact, and the judgment follows from watching it work or fail.

| Track (weight hot-spots) | The real work product | What "doing" looks like in-browser | What it is *not* |
|---|---|---|---|
| **CCAO-F Associate**: D2 Output evaluation 21%, D4 Workflow 16%, D6 Governance 15%, D1 Prompting 14% | Project instructions and prompts; a verified draft (claims checked against sources); a redacted paste; a delegation plan (who signs what); a placement of knowledge vs instructions vs connector vs memory | Write instructions → see 6 replies the "model" produced from them → mark each claim supported / incorrect / unsupported with source → fix the instructions → run again. Redact a real email. Build a Project shelf and test it in a fresh chat (library-desk already does this) | Choosing "8:30" from four times copied off a sheet |
| **CCDV-F Developer**: D2 Applications & integration 33.1%, D5 Model/cost 16.8%, D1 Agents 14.7%, D6 Prompt/context 11%, D8 Tools/MCP 10.6% | Messages API request JSON; the `messages` array after a `tool_use` turn (`tool_result` blocks keyed by `tool_use_id`, `is_error`); retry policy by status code; `output_config.format` JSON schema; Message Batches body with `custom_id`s and the result join; tool definitions; MCP server manifest; hook config | Edit JSON → "send" it to a mock API that validates it exactly like the real one (400 with the real error message) → the mock model's next turn depends on whether results were matched correctly → results arrive out of order / with an `errored` entry → learner's join code or retry table decides what is resubmitted | Picking "Request ID" from a list labelled "Match results using" |
| **CCAR-F Architect Foundations**: D1 Agent architecture 27%, D3 Claude Code config 20%, D4 Prompting/structured output 20%, D2 Tools/MCP 18%, D5 Context/reliability 15% | `.claude/settings.json` (permissions + hooks), `.mcp.json`, `CLAUDE.md` and `.claude/rules/*.md` with `paths:`, `SKILL.md`, tool definitions + `tool_choice`, `claude -p --output-format json --json-schema` CI steps, few-shot example sets, subagent briefs, handoff notes, structured tool-error contracts | Author config → replay a recorded Claude Code session trace (tool calls, file paths, env) through it → see which calls were blocked/allowed/prompted, which rules loaded, which secrets leaked to git → fix → replay a different repo (transfer) | Choosing "Before each write" instead of writing `"PreToolUse": [{"matcher":"Edit\|Write", …}]` |
| **CCAR-P Architect Professional**: D3 Integration 19%, D1 Solution design 17%, D4 Evaluation 16%, D5 Governance 14%, D6 Stakeholders 14% | ADRs with alternatives and trade-offs, managed settings, eval plans (slices, trials, metrics, stop rules, judge calibration), authorization matrices, retrieval/index configs, rollout plans with stop rules, runbooks and handoff packets | Author an eval plan → run it against a labelled corpus of transcripts that contains known regressions → see which regressions it catches, its reviewer-minute cost, and the false-pass rate of an uncalibrated judge. Author an authz policy → replay cross-tenant and injection requests | Eight binary "flip the default" selects on an incident board |

### 1.2 Fidelity ladder (used in the scorecard)

| Score | Name | Learner produces | Example in the repo today |
|---|---|---|---|
| 1 | Recognition | A choice among authored options | most casework fields |
| 2 | Consequence-backed choice | Choices that drive a simulation whose output follows from a mechanism, or numbers that must be *derived* | dispatch-monday-peak retry budget, market-rush meters |
| 3 | Constrained configuration | Real-shaped objects (real event frames, real frontmatter keys, real sources) via enums/booleans, run through a real mechanism | printworks-stream, library-retrieval-architecture, library-desk |
| 4 | Partial authoring | Free text/JSON for part of the work, structurally validated | capstone Associate instructions (regex-graded) |
| 5 | Authored artifact, executed | A complete real-format artifact executed by a simulator against fixtures; behavior follows from the artifact's properties; hidden transfer fixture | capstone Architect `settings.json` + `hookSimulation`, Developer schema vs samples |

Fidelity 5 is the target for every mission whose real-world skill is "write the thing". Fidelity 3 is acceptable where the real-world skill is placement or selection (choosing a model tier, placing a file in Project knowledge).

### 1.3 The feedback loop

"Run it and see the consequence" only teaches if:

1. **The consequence is mechanistic, not keyed.** Casework's `replayCasework` passes a fixture when `draft[field] === field.key`. The learner sees an authored `symptom` string. A simulator that *parses* `tool_result.tool_use_id` and finds no matching `tool_use` gives the same feedback the real API gives. The learner learns the rule, not the answer.
2. **The trace is visible before the verdict.** Keep the existing predict → run → judge order (`case-workbench.tsx`). Show the trace (request, model turn, tool call, hook decision, output), let the learner say what went wrong, *then* show checks.
3. **Failure messages name the observed behavior and the property that caused it, never the fix.** The capstone `verdict()` messages are close to this. Some still prescribe the fix ("Use a matcher such as `Edit|Write`"). Move prescriptions to hint rung 2.
4. **Transfer is a changed situation, not a hidden field.** The transfer fixture uses the same artifact in a different repo, tenant, error mix or document set. Overfitting (hard-coding `p7`) fails it.
5. **Retries are cheap but recorded.** Keep `CaseMastery` semantics (runs, firstRunPassed, hints, revealed) and apply them to labs.

### 1.4 What the 3D city should contribute, and what distracts

**Contribute:**
* **Context and audience.** The building tells you whose system it is (a school office, a kitchen, a courthouse) and therefore who reads the output. That carries audience and stakes for the prompt and governance missions.
* **Stakes as numbers that live in the world.** Staff hours on the Dispatch depot, the queue at the Market Hall, the ledger tray in the kitchen. These already exist for Dispatch (`staffHours`) and three room replays (`bulletin`, `receiving`, `operations` in `lib/scene/room-replay.ts`).
* **Consequence made physical.** Every run emits items that land in trays: *posted / held for review / escalated to a person / leaked / failed*. A leaked secret becomes a red packet on the public counter. A cross-tenant record becomes a folder on the wrong desk. That is memorable and costs little, because the three existing replay kinds are already a tray metaphor.
* **Progress as a city that works.** A completed transfer lights the building and changes ambient life (the queue outside shrinks).

**Distract:**
* Walking or loading to a station before work can start (keep the "open station" button one tap from the map).
* Interviews that restate the answer (already flagged; keep them to facts and constraints).
* Decorative 3D during authoring. The editor should take the full panel; the city view returns for the run replay.
* Story mechanics that hide exam vocabulary. The artifact itself carries the vocabulary (`tool_use_id`, `PreToolUse`), and that's the point.

---

## 2. Scorecard: all 34 missions (City Dispatch = `dispatch-lookup`)

Legend: **Do** = doing fidelity 1–5 (§1.2). **Ex** = transfer to the exam 1–5 (does it exercise the discrimination the exam tests, using exam vocabulary?). Exam weight is the sum of the domain weights the mission's objectives sit in, read as a rough priority signal.

### Architect Foundations (CCAR-F)

| Mission | What the learner produces today | Real work? | Do | Ex | Verdict | Reason |
|---|---|---|---|---|---|---|
| **dispatch-lookup** (City Dispatch, 2.2) | Picks 1 of 3 contracts + 1 route per error type (4×3); runs a simulated week; result persisted server-side | Partly: an error taxonomy is real design work | 3 | 4 | **Keep → upgrade** | Strongest consequence loop in the city. Upgrade: learner writes the tool's structured error contract (`{"isError":true,"error_type":"timeout","retryable":true}` per condition) plus the routing table, and `runShift` reads the authored contract |
| library-search (1.1, 2.1, 5.6) | 4 selects: next step after a pending call, connector choice, two label numbers | No: the agent loop is reduced to "Read and return c42" | 1 | 2 | **Rebuild** (wave 2) | 1.1 is the D1 anchor. Learner should write the next request after `stop_reason: tool_use` and the exhibit label with source provenance; shares the tool-loop engine with permit-agent |
| printworks-rules (3.1–3.3) | Lab: scope toggles (user/project), Skill location, "example" checkbox, rule paths picked from 3 files | Close: real files, real frontmatter concept | 3 | 4 | **Keep → upgrade** (wave 2) | Swap toggles for authoring `CLAUDE.md`, `.claude/rules/proofs.md` with `paths:`, and `SKILL.md`; `ruleProblems`/`skillProblems` and `globRegex` already exist |
| kitchen-extract (4.2–4.4) | Lab: pairs 2 examples to statuses, 2 ledger checks (+1 distractor), 2 exception routes | Yes in concept (few-shot boundary, validation, retry) | 3 | 4 | **Keep** | Good mechanism. Later: author the 2 few-shot examples and the extraction JSON schema in place of pairing tiles |
| community-handoff (1.4, 1.5, 5.2) | 4 selects: when to verify, when to normalize, two routing choices | No: hook names never appear | 1 | 3 | **Rebuild** (wave 1) | D1 27%; hooks are a high-yield exam topic. Learner writes `settings.json` `hooks.PreToolUse`/`PostToolUse` and a handoff template; replay a session trace through `hookSimulation` |
| archive-coordination (1.2, 1.3, 5.3) | Lab: assign worker, tick packet fields ×2 (+distractor), parallel toggle, brief sections (+distractor) | Partly: subagent context scoping is real | 3 | 3 | **Keep → upgrade** (wave 3) | Replace checkboxes with an authored subagent brief (Task prompt) per worker; simulated workers return partial results whose completeness depends on the brief |
| release-review (1.6, 1.7, 3.4, 3.5, 5.4) | 6 selects (contract test scope, fork, plan mode, null/empty expectations, handoff contents) | No: never plans, forks or writes tests | 1 | 2 | **Rebuild** (wave 3) | Author the expected-results test table for the normalizer (run against fixture inputs) and a compaction-proof handoff note; plan/fork stay as decisions |
| repair-shop-tools (2.3, 2.4, 2.5) | 4 selects: tool scope, where the shared config lives, personal config, which file to edit | No: `.mcp.json` is never shown | 1 | 3 | **Rebuild** (wave 1) | Write `.mcp.json` with `${ENV}` refs and `permissions.allow/deny`; replay a fresh checkout and triage tool calls via `expandEnv` + `permissionDecision` |
| printworks-ci (3.6, 4.1, 4.6) | 3 selects + mm threshold | No: CLI flags never shown | 1–2 | 3 | **Rebuild** (wave 1) | Write the `claude -p … --output-format json --json-schema` step + review criteria; `parseClaudeCommand` + `validateSchema` run it on fixture findings; duplicate-commit fixture tests dedupe key |
| market-close (4.5, 5.1, 5.5) | 4 selects + 2 derived counts; capacity meter | No: "Live/Batch" hides Message Batches | 2 | 3 | **Merge** into market-rush | Same three objectives at the same building as market-rush; keep one, use the other's numbers as its transfer variant |
| dispatch-monday-peak (2.2, 5.3, 5.2) | Retry limit derived from budget/minutes + 3 selects; queue/cost output | Partly: the budget reasoning is real | 2 | 4 | **Keep** | The derivation needs real reasoning. Later: reads the authored error contract from dispatch-lookup |
| market-rush (4.5, 5.1, 5.5) | 3 derived numbers + 1 select; spend and review meters | Partly | 2 | 3 | **Keep (absorb market-close)** | Later: author the batch body for the 36 archive requests (shares the batch engine) |

### Associate (CCAO-F)

| Mission | Produces today | Real work? | Do | Ex | Verdict | Reason |
|---|---|---|---|---|---|---|
| **market-bulletin** (1.1, 1.2, 2.1, 2.5, 4.4) | 5 selects (times read off a sheet, Dock B placement, destination, step order) | No: objective 1.1 "write task-specific prompts" never writes a prompt | 1 | 2 | **Rebuild** (wave 1) | D1+D2 = 35%. Learner writes the bulletin prompt (audience, approved source, required fields, steps); the prompt-policy simulator produces vendor and staff drafts whose errors follow from what the prompt omits |
| library-desk (3.1, 5.1–5.4) | Lab: share toggle, shelve 4 sources, connector scope, 4 instruction clips (1 distractor), fresh-chat test | Yes: the Projects placement *is* the job | 3 | 4 | **Keep** | Small upgrade: write the instructions instead of picking clips (reuse the Associate capstone instruction checks) |
| school-notice-pilot (1.3, 2.2, 4.1, 4.3, 4.5) | 3 selects + net-minutes arithmetic + count | Partly (arithmetic is real) | 2 | 3 | **Keep → upgrade** (wave 3) | 1.3 "iterate prompts": give a v1 intake prompt plus a correction log; learner edits it and reruns |
| library-activity-kit (1.4, 2.6, 3.2, 3.4) | 6 selects incl. a JSON payload choice and model-trial table | Partly | 1–2 | 3 | **Keep → small fix** | Make the catalog payload a typed JSON field validated by schema (2.6) instead of choosing among three strings |
| kitchen-billing-audit (3.3, 7.1–7.3) | 5 selects (refund rule, entry, where to save, route) | Weak | 1 | 2 | **Rebuild** (wave 3) | D7 troubleshooting: show a bad summary, have the learner rewrite the classification rule in the shared template, rerun the ledger |
| community-policy (4.2, 6.1–6.4) | 7 selects (include/remove fields, consent, who decides, fairness check) | No | 1 | 2 | **Rebuild** (wave 2) | D6 15%: redact the real packet text (the capstone `redact`/`keep` patterns exist) + judge the use case; 6.4 gets a fixture of replies grouped by writing style |
| **enrollment-replies** (2.3, 2.4) | 3 selects (a date, "mark pending", "hold for lead") | No: reading comprehension | 1 | 2 | **Rebuild** (wave 1) | D2 21%: verify Claude's draft by writing the Claim / Source / Verdict / Fix table (capstone `checklistProblems`); a hidden second draft is the transfer |

### Developer (CCDV-F)

| Mission | Produces today | Real work? | Do | Ex | Verdict | Reason |
|---|---|---|---|---|---|---|
| **permit-agent** (1.1, 1.2, 2.1, 2.5) | Links p7/p9 results + 2 selects | No: no `tool_result` block is ever built | 1 | 2 | **Rebuild** (wave 1, #1 priority) | D2 33.1% + D1 14.7%. Write the follow-up `messages` (all `tool_result`s in one user turn, matched by `tool_use_id`, `is_error` on failure); mock model's next turn depends on it |
| printworks-stream (4.1, 5.2, 3.1) | Lab: decoder/bridge/rules enums; real SSE chunks stepped through | Partly: real event frames | 3 | 4 | **Keep** | Mechanism is genuine (`decodeFixture` really splits frames). Later: learner writes the frame-buffering handler in a tiny constrained DSL or pseudocode |
| **vendor-batch-api** (2.3, 2.4, 5.4, 6.2) | 6 selects | No: `custom_id` hidden as "Request ID" | 1 | 2 | **Rebuild** (wave 1) | Write the Batches body (`custom_id`, `params`) and the resubmission list; results JSONL returns out of order with `errored`/`expired`; capstone `batchProblems` exists |
| library-workers (1.3, 6.1, 8.2, 8.3) | 5 selects incl. MCP prompt/resource/tool choice | Partly: the MCP primitive distinction is real | 1 | 3 | **Rebuild** (wave 2) | Author an MCP server manifest (resources, tools with `inputSchema`, prompts) + a Skill; a mock client lists and calls it |
| repair-desk-safety (7.1–7.4, 8.1) | 6 binary selects | No | 1 | 2 | **Rebuild** (wave 2) | Write the tool handler's response contract (empty vs `isError`), a PreToolUse guard and per-env key config; replay synthetic requests incl. a prompt-injected supplier doc |
| developer-release (2.2, 2.6, 5.1, 5.3) | 4 selects + trials and slice floor numbers | Partly | 2 | 3 | **Keep → upgrade** (wave 3) | Author a pinned eval config (model, prompt version, trials, slice thresholds) on the shared eval engine |
| supplier-invoices (6.3) | 2 selects + expected line sum | Partly | 1–2 | 3 | **Rebuild** (wave 2) | Write `output_config.format` JSON schema + a line-sum check; run against valid/malformed fixture outputs (`schemaProblems` exists) |

### Architect Professional (CCAR-P)

| Mission | Produces today | Real work? | Do | Ex | Verdict | Reason |
|---|---|---|---|---|---|---|
| public-permit-discovery (1.1, 1.3, 1.6, 6.1, 6.2) | 4 selects + expected-cost calculation | Partly: the business-case arithmetic is real | 2 | 3 | **Keep → small upgrade** | Add a short authored ADR (decision, alternatives, cost per 100, stop rule) graded by section rubric |
| library-retrieval-architecture (3.3–3.6, 4.4) | Lab: match mode, sections, active-only, rerank, trace; real latency and candidates | Yes in mechanism | 3 | 4 | **Keep** | Best Professional surface. Later: author the index/query config as JSON (same engine) |
| **professional-eval-gate** (4.1–4.3, 4.6, 5.5) | 2 derived numbers + 3 binary selects; reviewer-minute meter | Partly | 2 | 3 | **Rebuild** (wave 1; absorbs support-pilot) | D4 16%: author the eval plan (slices, cases, trials, metrics, stop rules, judge calibration) and run it against a labelled transcript corpus containing planted regressions |
| market-scale (2.1, 2.3–2.5, 4.5) | 5 binary selects | No: cache-token fields hidden | 1 | 2 | **Rebuild** (wave 2) | Reorder a real request JSON with `cache_control` breakpoint; mock usage shows `cache_read_input_tokens` across 3 calls (`prefixBlocks` exists) |
| **tenant-tools** (3.1, 3.2, 3.7, 3.8) | 5 selects | No | 1 | 3 | **Rebuild** (wave 1) | D3 19%: author tool allowlist per role + authz policy (tenant from verified identity, filter at service); replay cross-tenant, injection and nightly-batch requests |
| community-controls (2.2, 5.1–5.4) | 5 selects + approvals count | No | 1 | 2 | **Rebuild** (wave 3) | Author the approval binding (version + amount hash) and data-flow/retention map; replay a changed-amount approval and a deletion request across 3 stores |
| regional-operations (1.2, 1.4, 1.5, 6.4, 6.5, 7.1–7.3) | 8 binary selects + 10-min clock | Mostly generic SRE | 1 | 2 | **Rebuild (slim)** (wave 3) | Too many objectives on flips. Author a handoff packet (version, fixture, owner, cited claims + gaps, checkpoint) graded by rubric; keep the clock |
| support-pilot (6.3) | 3 selects + stop count | No | 1 | 2 | **Merge** into professional-eval-gate | Single objective; its stop rule and dispute owner become fields of the authored eval/rollout plan |

**Totals.** Current mean fidelity is about **1.6 / 5**: 27 casework at ~1.2, 7 dedicated surfaces at ~3. Mean exam transfer is about **2.8 / 5**.

**Verdicts:** keep 10 (6 of them with upgrades), rebuild 21, merge 2. The rebuild count includes 3 rebuilds where only some fields are replaced: kitchen-billing-audit, school-notice-pilot, developer-release.

**Cut:** none outright. support-pilot and market-close disappear by merging; regional-operations shrinks.

---

## 3. The redesign: Author → Run → See → Fix → Transfer

### 3.1 Mission flow (≈10–15 minutes)

1. **Brief (30 s).** The building, who's affected, the observable success criteria (numbers, not mechanisms). Documents on the desk. Same `CaseBrief` and `CasePrebrief` content as today, including the plain-to-exam term map.
2. **Author.** A file editor pre-loaded with the *currently deployed, broken* artifact. That replaces casework's `deployed` record and makes the learner a maintainer, which is realistic. Starter files never contain the answer. An "Example format" disclosure uses different values (the capstone `example` pattern).
3. **Predict.** One prompt about the run ("How many of the 5 tool results will Claude see paired with their calls?"). Reuses `CasePrediction`.
4. **Run.** The simulator executes the artifact against the *sample* fixtures and returns a **trace**. The trace viewer shows the request, model turn, tool calls, hook and permission decisions, outputs and errors, rendered like the printworks-stream event inspector. The room replay animates items into trays.
5. **Judge.** The learner marks which fixtures failed (existing judge step), then sees checks. Each check shows the observed *symptom* and the artifact *location* (file + JSON path or line). Diagnosis sits behind the concept hint (existing ladder).
6. **Fix and rerun.** Unlimited runs, recorded in mastery.
7. **Transfer.** When the sample passes, the same artifact runs against a hidden variant: different IDs, a different error, a different tenant, a different document set. Passing it earns *applied* credit. A reveal or concept-plus-worked hint makes it *guided* (reuse `portfolioEvidence` semantics).
8. **Debrief.** A side-by-side of the learner's artifact and a reference artifact, with exam terms highlighted, plus 2 lens items (existing `assignmentLens`).

### 3.2 Simulators that behave honestly

Two classes, with different honesty guarantees.

**A. Protocol and config simulators: faithful.** The real system is deterministic given the artifact, so the simulator can match it exactly:

| Engine | Real behavior reproduced | Existing code to lift (most is module-private today and must be exported) |
|---|---|---|
| `messages` (Messages API validator + mock model) | Request validation (roles, content block types, `tool_result` must follow `tool_use`, every `tool_use` answered, IDs exist, `max_tokens`), `stop_reason`, usage incl. cache read/creation from prefix stability | `developer.ts` `followupParse`, `errorProblems`, `prefixBlocks` (private); `artifacts.ts` `parseJsonObject`, `validateSchema`, `openObjects`, `schemaKeywords` |
| `batches` | `custom_id` regex/uniqueness, results JSONL in any order with `succeeded/errored/canceled/expired`, join + resubmission | `developer.ts` `batchProblems` |
| `claude-code` (session replay) | Permission precedence deny → ask → allow → prompt, hook event/matcher semantics, exit-code blocking, rule `paths:` glob loading, Skill frontmatter (`disable-model-invocation`, `allowed-tools`), `.mcp.json` env expansion and what lands in git | `artifacts.ts` `permissionDecision`, `ruleMatches`, `hookMatcherMatches`, `expandEnv`, `globRegex`, `parseFrontmatter`; `architect.ts` `hookSimulation` (private) |
| `cli` | `claude -p` flags, `--output-format json`, `--json-schema` → `structured_output`, allowedTools | `artifacts.ts` `parseClaudeCommand`, `shellTokens` |
| `stream` | SSE framing across chunk boundaries, `message_stop`, error events | `fieldwork.ts` `decodeFixture` |
| `retrieval` | Lexical/dense/hybrid candidates, filters, rerank cost, p95 | `fieldwork.ts` `runRetrieval` |
| `authz` | Tenant derivation, enforcement point, tool scoping per role, injection in retrieved docs | new (small; reuse `permissionDecision` shape) |
| `eval` | Run an eval plan over a labelled corpus: slice coverage, trials × variance, judge agreement vs human labels, stop-rule firing, reviewer minutes | new; casework `capacity` math is the seed |

The mock model in `messages` is a **fixture-trace player**. Each fixture holds a scripted conversation with branch points keyed to request properties, for example: `if results paired correctly → turn A (correct summary); if p7/p9 swapped → turn B (states the wrong address for eligibility); if a failure is sent without is_error → turn C (treats "timeout" text as data and approves)`. Branches are authored per fixture, but the *selection* is computed from the learner's JSON, never from a key.

**B. Prompt simulators: proxy, so label them honestly.** No deterministic system can actually execute a natural-language prompt. Use a **property-driven mock model**:

1. **Feature extraction**, structural first and keyword second:
   * names the actual source title from the documents
   * contains a rule permitting "unknown / not announced"
   * lists required output fields (a list or table, matched against the fixture's required set)
   * states the audience
   * contains format constraints
   * names the escalation owner
   * has a step order (numbered steps containing extract/check/draft)
   * contains a *harmful* instruction ("fill gaps from similar cases", which `instructionClips.infer` already models)
   * hard-codes facts that belong in knowledge (Associate capstone `facts` check)
2. **Behavior policy:** each fixture question has response variants keyed by missing or harmful properties. Example: no unknown-rule → the reply invents a reopening date; no required-fields list → the reply omits the 8:00 delivery cutoff; source not named → the reply cites the old template.
3. **Anti-gaming:**
   * Features must bind to case-specific values (the exact signed sheet's title, the actual owner's name).
   * Contradiction probes: a prompt that contains both "say unknown" and "always give a date" gets the invent behavior.
   * Length and TODO floors.
   * A keyword-stuffing mutant in the content check suite (§4.5) must fail.
   * The transfer fixture uses a different document set, so copying sample-specific strings fails.
4. **UI copy:** "Simulated replies show how Claude tends to behave when instructions include or omit this. Try it on real Claude in Field test." This is where live mode adds real value.

### 3.3 Optional live-Claude mode ("Field test")

**What exists.** `supabase/functions/dispatch/index.ts` does **not** call any LLM. It is a deterministic server-side replay (`runShift`) with good scaffolding worth copying:
* signed-in, non-anonymous users only
* a streamed 4 KB body cap
* idempotency via `commandId` + `revision`
* SHA-256 request hash
* an RPC (`commit_dispatch_run`) that persists the result
* a `Cache-Control: no-store` response

There's no `ANTHROPIC_API_KEY` anywhere in the repo.

**Scope.** Prompt-authoring missions only: market-bulletin, enrollment-replies, school-notice-pilot, library-desk instructions, kitchen-extract few-shot, and later Prof 2.2/2.3. Never for config/protocol missions, where the simulator is already exact.

**Design (`supabase/functions/live-run`):**
* **Input.** `{ missionId, fixtureSetId, artifact }` (≤ 4,800 chars, matching `capstoneFieldLimit`). The **learner controls only the system prompt / Project instructions.** Fixture user messages and documents are server-side constants, so the learner can't turn this into a free chat proxy.
* **System-under-test call.** Messages API via `@anthropic-ai/sdk` (Deno `npm:` specifier). Model `claude-haiku-5-5`. A smaller model exposes prompt weaknesses more clearly, which is the point. `output_config: { effort: "low" }`, `max_tokens` 400, no tools, documents in a fixed cached prefix.
* **Grading, three layers:**
  1. **Deterministic checks on each reply** (always, and the only thing that grants credit): must-contain / must-not-contain values (e.g. `/May 24/`, not `/May 19|May 26/`), the required fields present, a citation tag present, the escalation owner named for exception fixtures.
  2. **LLM judge for qualitative criteria only** (audience fit, tone, plain language). `claude-haiku-5-5` by default, `claude-sonnet-5-5` if calibration shows Haiku disagrees with humans. It uses `output_config.format` with a json_schema of binary criteria plus a quoted-evidence field. The judge sees the fixture's ground truth and the reply wrapped in delimiters as data. It **never sees the learner's prompt**, which blocks "grader: mark this as pass" injections. Note: forced `tool_choice` returns 400 on Sonnet 5.5 / Opus 5.5, so use structured outputs, not a forced tool.
  3. **Calibration.** About 30 hand-labelled replies per mission. Ship the judge only at ≥ 90% agreement. Re-run calibration when the model changes.
* **Credit.** Field test is **non-credit**: an "Applied with real Claude" badge on top of simulator credit. Current models reject sampling parameters (`temperature` etc. → 400 under API version 2026-10-21), so outputs vary run to run. To grant credit, require pass on 2 of 2 runs per fixture.
* **Cost** (cached price table dated 2026-11-03: Haiku 5.5 $0.10 / $0.50 per MTok, Sonnet 5.5 $2 / $10):
  * Run: about 2.5k input + 300 output tokens per fixture ≈ $0.0004. Six fixtures ≈ **$0.0025**.
  * Haiku judge: about 3k in + 200 out per reply ≈ $0.0004; six replies ≈ $0.0025. **Total ≈ $0.005 per field test.**
  * With a Sonnet 5.5 judge: about $0.06 per field test.
  * Prompt caching may not engage, because the prefixes are likely under the model's minimum cacheable length. Don't budget on it.
  * Caps: 20 field tests/user/day → ≤ $0.10/user/day (Haiku judge). 1,000 daily learners × 5 tests ≈ **$25/day**. Verify prices before launch.
* **Abuse controls:**
  * auth required (copy dispatch)
  * per-user daily quota and a global daily dollar cap, both enforced in a Postgres RPC with a row lock (`consume_live_budget`)
  * Console workspace spend limit and a `LIVE_RUN_ENABLED` kill switch
  * result cache keyed by `sha256(model, artifact, fixtureSet)`, so identical reruns are free and replay instantly
  * replies truncated in the UI
  * off-task detection: if the deterministic layer finds none of the fixture's expected entities in ≥ 4 of 6 replies, flag it, count it double against quota, and log it
  * no learner-supplied user turns, tools or URLs
  * store hashes and the verdict, not long outputs (privacy)
* **Provider-agnostic:** the function dispatches on `mission.provider` to a `LiveAdapter` (`anthropic` now; `azure-openai`, `bedrock`, `vertex` later). Each adapter maps `{ system, documents, userMessage, maxTokens }` to that provider's request.

### 3.4 Provider-agnostic mission schema

Lives in `lib/labs/types.ts`. Claude content stays in `lib/claude/labs/`; future providers add `lib/microsoft/labs/` etc. `ProviderId` already exists in `lib/certifications/providers.ts`.

```ts
import type { ProviderId } from "../certifications/providers";
import type { CapstoneEditor } from "../claude/capstones/model";

export type ArtifactKind =
  // provider-neutral
  | "prompt" | "instructions" | "claim-table" | "redaction" | "delegation-table" | "json-schema"
  | "eval-plan" | "judge-rubric" | "adr" | "runbook" | "authz-policy" | "retrieval-config" | "error-contract"
  // anthropic
  | "anthropic.messages-request" | "anthropic.messages-followup" | "anthropic.batch-requests" | "anthropic.tool-definition"
  | "claude-code.settings" | "claude-code.mcp" | "claude-code.rule" | "claude-code.skill" | "claude-code.claude-md" | "claude-code.cli"
  // future (examples)
  | "azure.openai-chat-request" | "azure.ai-search-index" | "azure.content-filter"
  | "aws.bedrock-converse-request" | "aws.bedrock-guardrail" | "aws.kb-chunking"
  | "gcp.vertex-generate-request" | "gcp.vertex-response-schema";

export type ArtifactSpec = {
  id: string; kind: ArtifactKind; path: string;          // ".claude/settings.json"
  editor: CapstoneEditor; starter: string;                // the deployed, broken version
  example?: string; maxChars?: number;                    // default capstoneFieldLimit
};

export type Fixture = {
  id: string; name: string; set: "sample" | "transfer";
  variant?: string;                                       // seeded pick among transfer variants
  input: unknown;                                         // engine-specific (session trace, tool turn, questions…)
  expect: Readonly<Record<string, unknown>>;              // engine-specific expectations used by checks
};

export type TraceEvent = {
  step: number; actor: "learner-artifact" | "model" | "tool" | "hook" | "service" | "person";
  kind: "request" | "response" | "tool_call" | "tool_result" | "decision" | "output" | "error" | "metric";
  label: string; detail?: string; payload?: unknown;
  /** Where in the artifact this event came from, for "jump to line". */
  source?: { artifact: string; pointer?: string; line?: number };
};

export type CheckResult = {
  check: string; objective: string; passed: boolean;
  symptom: string;        // what the trace shows (always visible)
  diagnosis: string;      // concept-level (behind hint rung 2)
  source?: TraceEvent["source"];
};

export type Check = {
  id: string; objective: string; title: string;
  evaluate(run: EngineRun, fixture: Fixture): CheckResult | null;   // null = not applicable to this fixture
};

export type CityEffect =
  | { kind: "tray"; item: string; to: "posted" | "held" | "escalated" | "leaked" | "blocked" | "failed" }
  | { kind: "meter"; id: string; value: number; limit?: number; unit: string };

export type EngineRun = { trace: TraceEvent[]; outputs: Readonly<Record<string, unknown>>; metrics: Readonly<Record<string, number>> };

export type Engine<Parsed = unknown> = {
  id: string; provider: ProviderId | "neutral";
  parse(files: Readonly<Record<string, string>>): { value: Parsed } | { error: string; source?: TraceEvent["source"] };
  run(parsed: Parsed, fixture: Fixture): EngineRun;      // pure + deterministic
};

export type LabMission = {
  id: string; provider: ProviderId; track: string; objectives: readonly string[];
  place: string; station: string;
  brief: CaseBrief; prebrief: CasePrebrief;              // reuse casework types
  documents: readonly { id: string; title: string; text: string; format?: "json" | "code" }[];
  artifacts: readonly ArtifactSpec[];
  engine: string;                                        // Engine id
  fixtures: readonly Fixture[];
  checks: readonly Check[];
  hints: Readonly<Record<string /* check id */, HintLadder>>;
  prediction?: { prompt: string; unit: string; tolerance?: number; actual(run: EngineRun[]): number };
  effects(runs: readonly EngineRun[]): readonly CityEffect[];
  reference: Readonly<Record<string, string>>;           // reference solution files (lint + debrief)
  mutants: readonly { name: string; files: Readonly<Record<string, string>>; mustFail: readonly string[] }[];
  live?: { adapter: ProviderId; model: string; fixtures: readonly string[]; checks: readonly string[]; judge?: { criteria: readonly string[] } };
};
```

How future certifications plug in:
* **AI-102 (Azure AI Engineer):**
  * write an Azure AI Search index + skillset JSON → reuse the `retrieval` engine with an Azure adapter
  * write an Azure OpenAI chat request with tools → the `messages` engine's protocol layer, with an OpenAI-shaped adapter (`tool_calls` / `role: "tool"` / `tool_call_id`)
  * write content filter configs → the `authz`-style engine
* **AWS AI Practitioner / MLA:**
  * Bedrock Converse `toolUse` / `toolResult` → same tool-loop engine
  * Bedrock Guardrails JSON → policy engine
  * Knowledge Base chunking config → retrieval engine
* **Google Cloud:** Vertex `generateContent` with `functionCall` / `functionResponse` and `responseSchema` → tool-loop engine + `validateSchema`.
* **Foundational exams (AI-900, AI Practitioner):** more conceptual. Fidelity 3 is acceptable there, but "doing" can still mean computing precision/recall from a confusion matrix the learner builds, or choosing and configuring a service on the `eval`/`retrieval` engines.

The rule that keeps this portable: **concepts live in neutral engines; wire formats live in adapters.** "Answer every tool call by ID" is one engine; `tool_use_id`, `tool_call_id`, `toolUseId` and `functionResponse.name` are four adapters.

---

## 4. Implementation plan

### 4.1 Wave 1: rebuild these 8 first (exam weight × fidelity gap)

| # | Mission | Track / domains (weight) | Artifact(s) | Engine | Sample fixtures → transfer variant | Mutants that must fail (targeted check) |
|---|---|---|---|---|---|---|
| 1 | **permit-agent** | Dev D1 14.7% + D2 33.1% | `followup.json`: the `messages` to append after an assistant turn with 3 `tool_use` blocks | `messages` | P-42: eligibility returns before address, fee earlier; one passes and one fails → *transfer:* P-57 with a timeout on one tool and different IDs | results split across 2 user messages; IDs swapped; failure sent without `is_error`; one `tool_use` left unanswered; draft started before both checks |
| 2 | **vendor-batch-api** | Dev D2, D5, D6 | `batch.json` (requests with `custom_id` + `params`) and `resubmit.json` (IDs to resend) | `batches` | 3 archive orders, results arrive reversed with one `errored` (overloaded) → *transfer:* 5 orders, one `expired`, one `errored` invalid_request (must not resubmit) | positional join; `custom_id` with `/`; `stream: true`; resubmits all; resubmits the invalid one |
| 3 | **market-bulletin** | Assoc D1 14% + D2 21% + D4 | `prompt.md` (bulletin generation prompt, vendor + staff outputs) | `prompt-policy` (+ live) | Signed sheet + V-17 + Dock B + form tray → vendor and staff drafts → *transfer:* a different market day's signed sheet with a changed cutoff and an unsigned form | no required-fields list; source unnamed; one-pass instruction ("summarize all forms"); dock steps for everyone; keyword-stuffed contradiction |
| 4 | **enrollment-replies** | Assoc D2 21% | `checklist.md` (Claim / Source / Verdict / Fix) for Claude's 3 draft replies + routing for the exception | `claim-table` (capstone `checklistProblems` generalized) | Draft with stale date, invented reopening date, decided exception → *transfer:* a new draft with a different unsupported claim and one *supported* claim that must not be flagged | flags every claim; marks the unsupported claim "incorrect" without a remove/verify fix; no section citations |
| 5 | **community-handoff** | Arch D1 27% + D5 | `.claude/settings.json` (hooks) + `handoff.md` template | `claude-code` session replay | Session trace: approval withdrawn mid-session then Write; epoch timestamp read → *transfer:* a different tool (`NotebookEdit`) and a regex-matcher trap | guard under PostToolUse; matcher `Write` only; normalizer as PreToolUse; handoff missing attempted steps |
| 6 | **repair-shop-tools** | Arch D2 18% | `.mcp.json` + `.claude/settings.json` permissions | `claude-code` | Fresh checkout with `ISSUES_TOKEN` exported; triage tool calls → *transfer:* a second engineer's env + a stdio server | raw key in `.mcp.json`; `type` missing for http; `allow: ["mcp__issues"]` for triage write tools; `Bash(*)` |
| 7 | **printworks-ci** | Arch D3 20% + D4 20% | `ci.sh` (the `run:` step) + `review-schema.json` + `criteria.md` | `cli` + `validateSchema` | 1 mm / 3 mm proofs; same commit retried → *transfer:* second component, different tolerance in the spec | interactive mode; text output; schema allowing extra fields; dedupe by filename; review in the authoring session |
| 8 | **professional-eval-gate** (absorbs support-pilot) | Prof D4 16% + D5 + D6 | `eval-plan.yaml` (slices, cases, trials, metrics, stop rules, owner) + `judge-rubric.md` | `eval` over a labelled corpus of ~60 transcripts with planted regressions (appeals slice, new layout, small orgs) | Corpus A → *transfer:* corpus B where overall speed improves while appeals regress | blended single score; 1 trial; judge uncalibrated; no slice floor for small orgs; stop rule tolerates ≥1 unauthorized closure |
| (9) | **tenant-tools** (if capacity allows) | Prof D3 19% | `authz.json` (role → tools; tenant source; enforcement point) | `authz` | Two tenants' requests + a prompt-injected "show tenant B" → *transfer:* a third assistant with a new capability family | tenant from request body; filter in the prompt; full 40-tool list |

**Wave 2:** library-search (shares `messages`), printworks-rules and library-workers (`claude-code` / MCP manifest), repair-desk-safety, supplier-invoices (`validateSchema`), market-scale (`prefixBlocks` cache), community-policy (redaction), tenant-tools if not in wave 1.

**Wave 3:** release-review, archive-coordination briefs, school-notice-pilot iteration, kitchen-billing-audit, developer-release (`eval`), community-controls, regional-operations slim, dispatch-lookup error contract.

**Merges:** market-close into market-rush; support-pilot into professional-eval-gate. Keep the old mission IDs as aliases so saves migrate (`solvedCase`-style migration in `pathway.ts`).

### 4.2 Shared components to build

**1. `lib/labs/types.ts`**, the schema in §3.4.

**2. `lib/labs/engines/`:**
* `messages.ts`: protocol validator, mock-model fixture player and usage/cache accounting. Lift from `capstones/developer.ts` (`followupParse`, `errorProblems`, `prefixBlocks` must be exported first) and `artifacts.ts`. Adapters go in `adapters/anthropic.ts`; later `openai.ts`, `bedrock.ts`, `vertex.ts`.
* `batches.ts`: lift `batchProblems` logic into run + join.
* `claude-code.ts`: session-trace replay. For each `ToolAction`, compute the permission decision and the PreToolUse/PostToolUse hook runs (exit code 2 blocks), the rules loaded for each path, and the Skills invocable. Lift `hookSimulation` (private in `architect.ts`) and use `permissionDecision`, `hookMatcherMatches`, `globRegex`, `expandEnv`, `parseFrontmatter`.
* `cli.ts`: wrap `parseClaudeCommand` and simulate `--output-format json` → `structured_output` validated against `--json-schema`.
* `prompt-policy.ts`: feature extractors (structural first) and a behavior policy table per fixture question.
* `claim-table.ts`: generalize Associate `checklistProblems`, `classify`, `findTable`.
* `eval.ts`: parse the plan with a YAML subset (or JSON), run it over the corpus, and compute slice coverage, the detection of each planted regression, judge agreement, reviewer minutes and stop-rule firing.
* `authz.ts`: role → tool allowlist, tenant derivation and enforcement-point simulation.
* Existing `decodeFixture` and `runRetrieval` become `stream.ts` and `retrieval.ts` engines unchanged.

**3. `lib/labs/run.ts`:** `runLab(mission, files, set, seed) → { runs: {fixture, run, results: CheckResult[]}[], effects: CityEffect[], passed }`. The transfer variant is picked by `seed = hash(userId|missionId|cycle)`.

**4. `lib/claude/labs/*.ts`:** mission data, one file per mission, with the reference files and mutants inline.

### 4.3 UI changes

* **Routing.** `components/academy/building-assignment.tsx` checks `labFor(missionId)` first, then `hasAssignmentWork`, then `caseworkFor`. Missions migrate one at a time; casework stays as the fallback.
* **New `components/academy/lab-bench.tsx`:**
  * Left: documents (reuse the case-surface reference cards) and a file-tab editor (reuse the capstone-workspace editor: monospace with line numbers, `example` disclosure, char limit).
  * Right: Predict, then Run, then a **TraceViewer**. The TraceViewer is new: a vertical timeline of `TraceEvent`s, with an expandable payload JSON and "jump to source" that focuses the editor line or JSON pointer. Generalize the printworks-stream inspector.
  * Then Judge, then Checks (symptom first; diagnosis behind the hint ladder).
  * Reuse `HintLadder`, the judge fieldset and the prediction logic from `case-workbench.tsx` by extracting them into `components/academy/run-loop/*`.
* **Editor ergonomics** for JSON/YAML:
  * live parse errors with line and column (`parseJson` already reports them)
  * a "format" button
  * snippets limited to *structure*, never values (e.g. an empty `{ "type": "tool_result", "tool_use_id": "", "content": "" }`)
* **Mobile:** the editor is full-width with tabs for Docs / Files / Run; the trace collapses to a one-line-per-event list. Keep the sticky run bar (`.runActions`).
* **City:**
  * Replace `MissionRoomReplay` kinds (`bulletin | receiving | operations` in `lib/scene/sites.ts`) with a generic `{ kind: "trays"; slots: Slot[]; items: CityEffect[] }`.
  * Map each station's slots in `room-replay.ts`; the existing three become configs. Every lab gets a replay for free.
  * Meters (`CityEffect.meter`) feed the building's status sign. Transfer pass sets `assignmentStatuses[id] = "Assignment complete"`, which already drives `data-complete` in `world-scene.tsx`.
* **Readiness:** applied vs guided per objective from `LabMastery` (§4.4). Labs whose engine is a *proxy* (prompt-policy) show "Simulated" next to the credit, and "Real Claude" when a field test passed.

### 4.4 Data and progress

```ts
// lib/claude/pathway.ts MissionRecord gains:
lab?: { files: Record<string, string>; mastery: CaseMastery; transfer?: { variant: string; passed: boolean; at: number };
        live?: { runs: number; lastPassed?: boolean; at?: number } };
labDraft?: Record<string, string>;
```

* `portfolioEvidence()` counts an objective as **applied** when the transfer passed, no check for that objective was revealed, and hint rung ≤ 2 for its checks. Otherwise it counts as **guided**.
* Legacy casework completions keep their current credit (same rule as `legacyVerified`).
* Cloud sync: extend the existing progress keys. Field-test runs persist in Supabase (`live_runs`), not localStorage.

### 4.5 Checks (add to `npm run check:claude` as `scripts/check-labs.cjs`, same TS-transpile loader as `check-claude-capstones.cjs`)

1. **Reference passes:** `mission.reference` passes every sample *and* every transfer variant.
2. **Starter fails:** the deployed starter fails at least one check for *each* objective in `mission.objectives`.
3. **Mutation coverage:** each mutant fails exactly its `mustFail` checks and passes the rest. This proves checks are targeted, not all-or-nothing.
4. **Overfit probe:** a "sample-hard-coded" mutant (IDs or values copied from sample fixtures) passes the sample and fails transfer.
5. **Prompt-policy gaming probes:**
   * a keyword-stuffed prompt with contradictory instructions fails
   * a prompt shorter than the floor fails
   * a prompt that copies the documents' facts fails the "facts belong in knowledge" check
6. **Determinism:** `runLab` twice on the same input gives identical traces (snapshot hash).
7. **No answer leakage:** reuse the existing lint from the approachability audit (key values never in `brief.move`, interviews or policy references), applied to checks' `symptom` text: symptom strings must not contain the reference artifact's distinguishing tokens.
8. **Objective coverage:** every objective has ≥ 1 check, and every check's objective is in the track blueprint (`blueprints.ts`) for the mission's exam version.
9. **Size:** starters and references are ≤ `capstoneFieldLimit`, and the trace has ≤ 60 events per fixture (mobile readability).
10. **Live mode** (if enabled): judge calibration fixtures are present and recorded agreement is ≥ 0.9.

### 4.6 Live mode build steps (after wave 1 ships)

1. Supabase migration: `live_runs(user_id, mission_id, fixture_set, input_hash, model, verdict jsonb, input_tokens, output_tokens, cost_micros, created_at)`, `live_budget(day, user_id, runs, cost_micros)`, plus RPC `consume_live_budget(actor_id, est_cost)` returning `ok | user_cap | global_cap`.
2. `supabase/functions/live-run/index.ts`:
   * copy auth, the body cap (raise it to 8 KB) and the error style from `dispatch/index.ts`
   * look up the cache by hash, then call `consume_live_budget`, then run the fixtures in parallel
   * apply deterministic checks, then the judge (structured outputs), then persist and respond
   * secrets: `ANTHROPIC_API_KEY`, `LIVE_RUN_ENABLED`, `LIVE_RUN_DAILY_USD`
3. Client: a "Field test with real Claude" button on prompt labs, signed-in users only. It shows the real replies next to the simulated ones; the difference is itself a lesson.

### 4.7 Effort estimate

* Engine layer + lab-bench UI + generic tray replay + check script: about **8–10 engineer-days**. Most of the parsers and simulators exist; the work is exporting, generalizing and the trace viewer.
* Each wave-1 mission: about **1.5–2 days** (content, fixtures, branches, mutants, hints). That puts wave 1 at about 3 weeks total.
* Live mode: about **3–4 days**, plus judge calibration labelling (about 2 hours per mission).

---

## Appendix: method notes

* `dump.txt` in this folder is the full field and option dump of all 27 casework missions (key marked `*`), produced by `dump.cjs` (TS transpile loader). `bp.cjs` dumps blueprint weights.
* Exam weights come from `lib/claude/blueprints.ts` (Associate D2 21%, Developer D2 33.1%, Architect-F D1 27%, Professional D3 19% are the largest domains).
* Pricing comes from the bundled Claude API reference table cached 2026-11-03. Re-check before budgeting.

---

## 5. Implementation status (2026-11-25)

**Built** (`lib/labs/`, `components/academy/lab-bench.tsx`, `scripts/check-labs.cjs`, run by `npm run check:claude`):

* `lib/labs/types.ts`: the §3.4 schema, with two additions: `transferMode` (`"rerun"`: the same files run against a hidden seeded variant, for config artifacts; `"revise"`: the new case's documents are revealed and the learner adapts instance artifacts such as a request body) and `overfit` / `fixTerms` for the check script.
* Engines: `engines/parse.ts` (the capstone parsers, moved; `capstones/artifacts.ts` re-exports it), `located-json.ts` (JSON pointer → line for "jump to source"), `messages.ts` (tool-loop validator + recorded model turns), `batches.ts` (create-time validation, cache accounting, results replay, importer, simulated few-shot extraction), `claude-code.ts` (session replay for hooks + handoff template; checkout replay for MCP scopes, `${VAR}` expansion and headless permission rules), `cli.ts` (`claude -p` flags, `--json-schema` vs the publisher contract, simulated reviewer), `stream.ts` and `retrieval.ts` (lifted from `fieldwork.ts`, which re-exports them). `engines/capstone.ts` re-exports the now-exported `hookSimulation`, `prefixBlocks`, `followupParse`, `errorProblems`.
* Missions rebuilt (casework kept as the fallback and for saved records): permit-agent, vendor-batch-api, community-handoff, repair-shop-tools, printworks-ci.
* Progress: `MissionRecord.lab` (drafts per stage, the casework mastery shape keyed by check id, and the outcome that passed sample + transfer). `missionCompleted` and `portfolioEvidence` credit a lab outcome as applied or guided by the same rule as casework (no reveal, hint rung ≤ 2 per check of the objective). A lab completion also records passing station `choices` so surfaces that still read them see a completed mission.

**Not built:** enrollment-replies (claim-table engine), professional-eval-gate absorbing support-pilot (eval engine), market-bulletin (prompt-policy engine), tenant-tools, and Waves 2–3. No generic tray replay in the 3D room yet; the bench shows effects as chips.

**Live-Claude "Field test" (§3.3) is deliberately not built.** It needs an `ANTHROPIC_API_KEY`, a spend cap, and decisions on quotas and judge calibration that have not been made. `LabMission.live` is typed as `undefined` so mission data does not change when it is added; the check script asserts it stays unset until then.
