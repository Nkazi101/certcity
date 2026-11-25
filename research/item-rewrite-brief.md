# Question rewrite brief

Use this brief when rewriting CertCity practice and exam-rehearsal questions. The goal is questions that resemble the real exams and that test-taking tricks alone cannot answer. Evidence and per-exam targets are in [exam-realism.md](exam-realism.md), especially the item style spec and distractor rules D1–D11. Read that file first.

## What does not change

Saved attempts and other checks depend on these, so keep them exactly:

- **Item ID and objective.** Keep each item's `id` and `objective`.
- **Number of correct answers.** Keep the number of correct responses and the option count: 4 options for single-answer items, 5 options with 2 correct for multi-select items.
- **Prompt format.** Every prompt ends with "?". Prompts must stay unique across the whole bank.
- **Authoring format.** Keep each file's existing helpers (`caseQuestions`, `retestCase`, `recoveryCase`, `item`, revised-practice `Check` tuples). They all accept a `[text, rationale]` tuple for each option. In revised-practice `Check` tuples the answer may also be a `[text, rationale]` tuple.
- **Key letters in files that set them.** Some files author the key letter directly (for example `caseQuestions` passes `"c"`). In those files, spread keys roughly evenly across a, b, c and d. Files whose positions are assigned later (retest via `arrangeRetest`, recovery reserve, revised practice) need no manual balancing.

## Targets for each item

### Stem
- **Length (question words, excluding the shared case context):**

  | Exam | Words |
  |---|---|
  | CCAR-F | 40–90 |
  | CCAR-P | 70–110 |
  | CCDV-F | 55–85 |
  | CCAO-F | 50–80 |

- **Show symptoms and evidence, not the diagnosis.** Use numbers, a short log or trace line, a config fragment or a usage figure. Write things like "p95 latency rose from 1.2 s to 4.8 s after…", not "the descriptions overlap".
- **Name real terms.** Use real product, API and configuration names at roughly the density the spec gives for each exam. Take them from that track's lesson file in `lib/claude/lessons/`. These were checked against the official docs, so treat them as the technical reference. Fetch the official docs if you need something the lesson does not cover.

### Options
- **Length:**

  | Exam | Words per option |
  |---|---|
  | CCAR-F | 14–25 |
  | CCAR-P | 20–30 |
  | CCDV-F | 18–28 |
  | CCAO-F | 18–25 |

  Keep all options of an item within about ±20% of each other's length. The key must not be the longest option more than about a quarter of the time.
- **Make every distractor a real, plausible mechanism that fails for one specific reason in this case.** Use patterns D1–D10 (D11 for CCAR-F recall items only): prompt where enforcement is needed, self-reported confidence, disproportionate first step, reduces frequency not mechanism, right control wrong property, model or effort swap, detective instead of preventive control, wrong component, silent failure or killing the whole workflow, over-privilege or over-gating.
- **No absurd options.** Nothing like "group findings by answer length", "raise temperature" or "continue indefinitely".
- **Balance "careful" words.** Use verify, validate, evidence, scope, preserve, enforce, review, approve, confirm, test, separate and document in distractors as often as in keys. Keys should not carry them disproportionately.
- **Avoid absolutes as tells.** Don't use always, only, never, all, every, assume, ignore or skip as a tell in distractors.

### Feedback
- **Rationale for every option, including the key.** 15–40 words. Say why that option fits or fails, citing the specific evidence in the stem.
- **Explanation:** 30–60 words that teach the general decision rule the item tests, so it transfers to new cases.

## Coverage

Many topics the real exams test are missing; the research's under-representation checklist lists them. Where an item's objective allows, move its content to cover one of those topics.

| Exam | Missing topics |
|---|---|
| CCAR-F | `.claude/commands` and skills, subagents / Task / `allowedTools`, `tool_choice`, MCP scopes, plan mode, `.claude/rules` globs, `-p --output-format json --json-schema` |
| CCAR-P | Bedrock, Vertex AI and Foundry differences, ZDR, Managed Agents, agent-to-agent, idempotency, stakeholder communication |
| CCDV-F | `tool_choice`, Files API, effort and thinking, permission modes and settings precedence, injection, 429/529 handling |
| CCAO-F | Plugins, Usage Policy, code-executed analysis, Skills, sequencing items |

Some formats and wording also need changing:

- **CCAO-F sequencing items.** Write about 10% of CCAO-F items as single-answer sequencing items. The stem lists numbered steps, and each option is an ordering such as "2, 4, 1, 3, 5". Make the orderings plausible near-misses.
- **CCAR-F scenario names.** Rename form scenarios to the six official frames: Customer Support Resolution Agent, Code Generation with Claude Code, Multi-Agent Research System, Developer Productivity, Claude Code for CI, Structured Data Extraction.
- **CCAR-F terminology.** Say "subagent", not "worker".
- **Exhibits.** Exhibits stay inline in the stem or context. Short JSON, trace or config snippets in backticks are fine.

## How to check your work

- **Structure:** `npm run check:claude` must pass.
- **Quality:** run `node scripts/check-item-quality.cjs --track <track-id>`. The track totals include other agents' files. To see your own items, use `--json <file>` and filter by your item IDs.
- **Types:** `npx tsc --noEmit 2>&1 | grep <your file>` must print nothing.
- **Shared files:** edit only your own items. Re-read a shared file before each edit; other agents are editing other parts of it at the same time.
