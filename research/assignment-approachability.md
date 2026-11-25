# CertCity city assignments: approachability vs. knowledge audit

Scope: all 34 missions in `portfolio` (`lib/claude/pathway.ts`): 12 Architect Foundations, 7 Associate, 7 Developer, 8 Architect Professional. Read-only review of code + one mobile (375×812) check of a live station. Supporting scripts: `analyze.cjs`, `game.cjs`, `list.cjs`, `analysis.json` in this folder.

## 0. Which surface the learner actually sees

Routing in `components/certcity.tsx` / `components/academy/building-assignment.tsx`:

| Surface | Missions | Code |
|---|---|---|
| **Casework station** (default for 27 missions) | every mission with an entry in `lib/claude/cases/*` | `Casework` in `lib/claude/casework.ts`, UI `case-workbench.tsx` + `case-surface.tsx` |
| **Dedicated lab** (6) | kitchen-extract, printworks-rules, archive-coordination, library-desk, printworks-stream, library-retrieval-architecture | `assignment-work.ts`, `fieldwork.ts`, UI `assignment-work.tsx`, `role-fieldwork.tsx` |
| **City Dispatch** (1) | dispatch-lookup | `components/system-view.tsx`, `supabase/functions/_shared/dispatch.ts` |
| Legacy `Decision` workbench | only via "Open work from the earlier version" | `missions.ts` `decision()`, `mission-workbench.tsx`, `mission-lab.tsx` |

So the "longest option wins ~96%" finding from the prior pass applies to the **legacy** `Decision` data (`decision()` hard-codes `passed: i === 1 || i === 3`). The live casework stations have a different, stronger tell (below).

## 1. Systemic problems (ranked)

### 1.1 Position tell: the key is the second option, the default is always wrong (new, severe)
`field(id, label, initial, ...options)` is always authored as `f("x", "Label", WRONG, WRONG, KEY, distractor)`. `case-surface.tsx` renders `field.options.map(...)` in authored order with no shuffle (unlike `stationOptions()` for legacy decisions).

* **114 of 115** select fields have the key at `options[1]` (only exception: `release-review.empty` → "Invalid" at index 2).
* **71 of 115** fields are binary, so the whole task is "flip away from the default".
* Strategy "set every dropdown to its second entry, leave numbers alone, click Run" **passes 15 of 27 casework missions without reading anything** (`game.cjs`). The other 12 fail only on numeric fields; of the 17 numeric fields, 11 have the target number printed verbatim in a reference or fixture ("up to and including 2 mm", "Six handwritten", "at least 8/10", "16 live").
* Length cue persists at a lower level: key is the longest option in 69/115 fields (60%) vs 44% expected by chance. In the labs the key is usually the most descriptive select label ("Merge lexical and semantic candidates", "Join stage timing and status by request ID", "Validate session and translate server-side events", "Retry with validator feedback").

### 1.2 Hint leakage on four redundant channels
1. **`WorkstationBrief.ready`** ("Look for", `cases/presentation.ts`) describes the passing state in mechanism terms. ≥50% keyword overlap with the key in 40/115 fields. Example (enrollment-replies, confirmed on a live mobile screenshot): "leaves reopening pending and sends the late request to the enrollment lead" — those are two of the three answers.
2. **`MissionInterview.reply`** (`mission-experiences.ts`) prescribes the fix in almost every mission. community-handoff/Sara: "Give staff ticket 31's request and attempted steps. Ask ticket 32 for a distinguishing room detail"; repair-shop-tools: "Track the shared .mcp.json with environment references"; vendor-batch-api: "Correlate by custom_id, upsert successful rows, retry only eligible failures".
3. **`Casework.references`** are written as policies that name the mechanism instead of the goal: repair-shop-tools "Use environment references for credentials"; tenant-tools "Tenant scope comes from the signed-in identity and is enforced in search"; regional-operations "Resume from that checkpoint". The key's content words appear in the references for 84/115 fields (73%).
4. **Per-check oracle on failure**: `fixture.problem` text plus the "Review <section>" jump button (`issueLinks` in `case-workbench.tsx`) take the learner to the exact field. "Replay the starting setup" in the case file shows every failure before the learner chooses anything.

### 1.3 Unlimited, free, instant retries
`replayCasework` is pure, `runSample`/`runNewCase` are unbounded, and `MissionRecord` stores no attempts, hint use or first-run result. Worst-case exhaustive flipping with per-check feedback is ≤10 runs per mission (`game.cjs`). A gamed completion still counts as **"Applied in city"** (`portfolioEvidence().applied` → `readiness-panel.tsx`, `city-certifications.tsx`, `workspace.tsx`). The separate first-seen check (`demonstrated`) is the only knowledge-gated signal.

### 1.4 "Check everything" passes the checklists
archive-coordination: tick all 4 packet fields for both workers + all 4 brief sections + parallel. kitchen-extract: tick both ledger checks. Only library-desk has a distractor checklist item (`instructionClips.infer`), so check-all fails there. Copy that pattern.

### 1.5 Plain labels hide the exam vocabulary (and undefined jargon appears in other places)
Casework labels are friendly ("Before each write", "After read", "Request ID", "Headless JSON", "Separate from 54a", "Read + creation tokens"), so a learner can finish without ever meeting PreToolUse/PostToolUse, `custom_id`, `tool_use_id`/`tool_result`, `-p --output-format json --json-schema`, plan mode, `--fork-session`, `cache_read_input_tokens`/`cache_creation_input_tokens`, `.mcp.json` scope or `isError`. Those terms are what the exam uses. The interviews and references use other jargon ("stop_reason tool_use", "cache breakpoint", "custom_id") with no definition or pre-brief. So the learner gets the jargon cost and none of the vocabulary.

### 1.6 Unclear or missing success criteria in the hidden "new case"
Every casework mission has at least one field that only the retest checks (regional-operations has four). The field sits on screen from the start with a wrong default, and the learner doesn't find out it matters until the sample passes. As a transfer test this is a good idea, but it's built as a surprise rather than as a changed constraint. Some objectives are claimed but have no field: community-policy 6.4 (uneven treatment by writing style) and professional-eval-gate 4.1 (operational metrics). `casework.objectives` also disagrees with `curriculum/city-guide.ts` placements (e.g. permit-agent 1.1/1.2/2.1/2.5 vs guide 1.1/1.2/1.3/8.1).

### 1.7 Prerequisite chains and invisible gates
`requires` forms a DAG up to 4 deep (Arch: printworks-rules → release-review → printworks-ci → market-rush; Prof: public-permit-discovery → tenant-tools → community-controls → regional-operations). The two Architect capstones also have `verify`, and `missingExpertise()` keeps them locked until the objective is **correct on a first-seen check or its review is acknowledged**. The journal doesn't explain this gate type, so a learner who has finished every prerequisite mission can still find the capstone closed. Follow-ups lock for 7 days (`followupDays`).

### 1.8 Reading load is moderate. The problem is redundancy, not volume.
Casework stations have ~140–220 words of case text, plus ~2×40-word interview replies, plus the Start here/Look for block. That's fine for a working professional (2–3 min). But the same answer shows up in 3–4 places, so the reading never has to be integrated.

### 1.9 Mobile
At 375×812 the station dialog starts at `max(114px, 17.5dvh)`. Header, "Start here/Look for" and section tabs push the first control to just above the sticky run bar (verified live). Touch targets are 44px, `.fieldwork-columns` collapses at 690px, and kitchen/print/archive grids collapse to one column. Results render below the controls, which makes the scroll long. The "Review <section>" buttons help. Workable. The main cost is the always-expanded directions block.

### 1.10 What works (keep it)
* Dispatch (dispatch-lookup) and the three fieldwork labs show **consequences in a simulation**: real SSE frames with `content_block_delta`/`message_stop`/`overloaded_error`; fresh-chat replies that change when a retired FAQ is moved; per-stage retrieval latency where "rerank all" breaks p95. This is the strongest learning value in the app.
* Capacity meters (market-close, market-rush, professional-eval-gate, regional-operations) and the derived numbers (school-notice-pilot net = (12+2)−(5+6) = 3; public-permit-discovery 1 + 0.5×3 = 2.5¢) are the only casework fields that need reasoning. They're also the fields the position heuristic cannot pass.
* Goals are concrete and short, the stakes read as office work rather than as exam questions, and nothing dead-ends: a save always becomes possible.

## 2. Per-mission table

Legend: **Gameable** = how a learner can pass without the concept. 2nd = second-option rule passes. A = approachability (5 = easy to start and finish, clear goal), L = learning value (5 = needs and builds transferable Claude knowledge). Times are for an honest first attempt; a gamer needs 1–3 min on any casework station. Retries are unlimited and free everywhere.

| # | id | Track | Building | Objectives | Interaction | Time | Gameable / leakage | Goal clarity | Realism vs real Claude work | Jargon | A | L |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | dispatch-lookup | Arch-F | City Dispatch | 2.2 | Replay ticket T-17; pick contract (3) and route 4 outcomes (6 routes each); run a simulated week | 8–12 | "Next step" names "Route by outcome"; routes found by trial and error with weekly metrics | Clear (0 false replies, staff hours below baseline) | Good error taxonomy (empty/timeout/invalid/denied) | Low | 5 | 3 |
| 2 | library-search | Arch-F | Central Library | 1.1, 2.1, 5.6 | Flow casework, 4 selects | 5–8 | 2nd passes; Nolan's reply states c42 must run and return; 83/120 copied from refs | Clear | Agentic loop reduced to "Read and return c42"; no tool_result | Med (stop_reason) | 4 | 2 |
| 3 | printworks-rules | Arch-F | Printworks | 3.1, 3.2, 3.3 | IDE lab: CLAUDE.md scope, SKILL.md location, example link, `.claude/rules` paths frontmatter; clean-checkout run | 8–12 | Riley and Lee give both answers; small space (384) | Clear | High: real files and frontmatter | Med | 4 | 4 |
| 4 | kitchen-extract | Arch-F | Juniper Kitchen | 4.2, 4.3, 4.4 | 3-tab lab: pair 2 examples to statuses, 2 ledger checks, 2 exception routes; batch run | 10–15 | Ledger is check-all; Ana prescribes the routes; example pairing is a real puzzle | Medium (2-slot tray not obvious) | High: boundary few-shot, schema + semantic validation, validator-feedback retry | Low–Med | 3 | 4 |
| 5 | community-handoff | Arch-F | Community Center | 1.4, 1.5, 5.2 | Flow casework, 4 selects | 5–7 | 2nd passes; Sara/Malik prescribe; hook names never shown | Clear | Medium | Low (de-jargonized) | 5 | 2 |
| 6 | archive-coordination | Arch-F | Lucas Branch Library | 1.2, 1.3, 5.3 | Lab: keep register, assign south ward, packet checkboxes ×2, parallel, access, brief sections | 10–14 | Check-all on packets and brief; Mina states the assignment; per-pass messages | Clear | Good subagent context and partial-result handling | Low–Med | 4 | 3 |
| 7 | release-review | Arch-F | Northline Systems | 1.6, 1.7, 3.4, 3.5, 5.4 | Terminal casework, 6 selects, generated fixture output | 8–12 | Only station where 2nd fails (empty→Invalid), but the contract is printed in refs; plan mode and fork reduced to labels | Medium (dense IDs) | Low: the learner never searches, forks or plans | Med–High | 3 | 2 |
| 8 | repair-shop-tools | Arch-F | Sam's Repair Shop | 2.3, 2.4, 2.5 | Terminal casework, 4 selects | 5–7 | 2nd passes; refs say "Use environment references"; Grep/Edit reduced to choosing a filename | Clear | Medium (.mcp.json not shown) | Low | 5 | 2 |
| 9 | printworks-ci | Arch-F | Printworks | 3.6, 4.1, 4.6 | Terminal casework, 3 selects + mm threshold | 5–8 | 2 mm copied; selects 2nd | Clear | Medium (CLI flags never shown) | Med | 4 | 2 |
| 10 | market-close | Arch-F | Market Hall | 4.5, 5.1, 5.5 | Flow casework, 3 selects + 2 numbers, capacity meter | 6–9 | Six and ≥2 stated; meter guides; 2nd | Clear | "Live/Archive" hides Message Batches | Low | 4 | 2 |
| 11 | dispatch-monday-peak | Arch-F | City Dispatch | 2.2, 5.3, 5.2 | Flow casework: retry limit + 3 selects; queue and cost output | 7–10 | retry = 1 needs budget reasoning; the rest is 2nd; behind 3 prereqs + `verify` gate | Clear (gate opaque) | Good bounded retry and budget | Low | 3 | 3 |
| 12 | market-rush | Arch-F | Market Hall | 4.5, 5.1, 5.5 | Flow casework: 3 numbers + 1 select; spend and review meters | 7–10 | 16 and 12 stated; sample ≤3 needs (12+s)×4 ≤ 60 arithmetic | Clear (gate opaque) | Medium | Low | 3 | 3 |
| 13 | market-bulletin | Assoc | Market Hall | 1.1, 1.2, 2.1, 2.5, 4.4 | Document casework, 4 selects (button group) | 4–6 | Reading times off a sheet; 2nd | Very clear | Low: no prompt is ever written for 1.1 | Low | 5 | 1 |
| 14 | library-desk | Assoc | Lucas Branch Library | 3.1, 5.1–5.4 | Project lab: shared Project, shelve 4 sources, connector scope, 4 instruction clips (1 distractor), fresh-chat test | 10–15 | Length tell on scope; distractor clip defeats check-all; consequences visible | Clear | High (Projects, knowledge vs chat) | Low | 4 | 4 |
| 15 | school-notice-pilot | Assoc | Maplewood School | 1.3, 2.2, 4.1, 4.3, 4.5 | Document casework, 3 selects + 2 numbers | 6–9 | Net-minutes arithmetic is real; rest 2nd | Clear | Medium | Low | 4 | 3 |
| 16 | library-activity-kit | Assoc | Lucas Branch Library | 1.4, 2.6, 3.2, 3.4 | Document casework, 6 selects | 6–9 | Model-trial table needs threshold reading, but 2nd passes all | Clear | Medium (Artifact never named) | Low–Med | 4 | 2 |
| 17 | kitchen-billing-audit | Assoc | Juniper Kitchen | 3.3, 7.1–7.3 | Document casework, 5 selects | 5–8 | Bookkeeper note says "R is a refund"; 2nd | Clear | Low–Med | Low | 4 | 2 |
| 18 | community-policy | Assoc | Community Center | 4.2, 6.1–6.4 | Document casework, 6 selects + packet preview | 5–7 | Mostly binary flip-default; policy ref states every rule; 6.4 has no field | Clear | Generic data governance | Low | 5 | 1 |
| 19 | enrollment-replies | Assoc | Maplewood School | 2.3, 2.4 | Inbox casework, 3 selects | 3–5 | Reading comprehension; "Look for" states 2 of 3; 2nd | Very clear | Generic grounding | Low | 5 | 1 |
| 20 | permit-agent | Dev | Old Courthouse | 1.1, 1.2, 2.1, 2.5 | Link p7/p9 results + 2 selects | 5–7 | p7/p9 matched from "p7 → address lookup"; no tool_result block is built | Clear | Concept right, no message JSON | Med | 5 | 2 |
| 21 | printworks-stream | Dev | Printworks | 4.1, 5.2, 3.1 | Event inspector: step raw SSE chunks; decoder, bridge and rules selects; fixture run | 10–15 | Longest label wins 2 of 3; acceptance names describe the fix; 27 combos | Clear if you can read SSE | High: real event frames | High | 3 | 4 |
| 22 | vendor-batch-api | Dev | Market Hall | 2.3, 2.4, 5.4, 6.2 | Terminal casework, 6 selects | 6–8 | 2nd passes; custom_id hidden as "Request ID" | Clear | Medium | Low–Med | 4 | 2 |
| 23 | library-workers | Dev | Lucas Branch Library | 1.3, 6.1, 8.2, 8.3 | Terminal casework, 5 selects | 5–7 | Resource/Tool/Skill needs real MCP knowledge, but 2nd is correct for all three | Clear | Medium–High | Med | 4 | 3 |
| 24 | repair-desk-safety | Dev | Sam's Repair Shop | 7.1–7.4, 8.1 | Terminal casework, 6 binary selects | 5–7 | Flip every default | Clear | Medium (isError never named) | Low | 5 | 2 |
| 25 | developer-release | Dev | Northline Systems | 2.2, 2.6, 5.1, 5.3 | Operations casework, 4 selects + 2 numbers | 6–9 | Floor 8 and ≥2 trials stated; 2nd | Clear | Medium | Low–Med | 4 | 2 |
| 26 | supplier-invoices | Dev | Juniper Kitchen | 6.3 | Terminal casework, 2 selects + expected sum | 4–6 | Sum printed in ref; 2nd | Clear | Medium | Low | 5 | 2 |
| 27 | public-permit-discovery | Prof | Old Courthouse | 1.1, 1.3, 1.6, 6.1, 6.2 | Operations casework, 4 binary + cost in "tenths of a cent" | 6–8 | Expected-cost calc is real; the unit confuses | Medium | Medium (business case) | Low | 4 | 3 |
| 28 | library-retrieval-architecture | Prof | Central Library | 3.3–3.6, 4.4 | Search bench: hybrid, sections, active-only, rerank, trace; inspect candidates and latency | 12–18 | Longest-label tell; header states p95 target; real latency trade-off | Medium | High | Med–High | 3 | 4 |
| 29 | professional-eval-gate | Prof | Northline Systems | 4.1–4.3, 4.6, 5.5 | 2 numbers + 3 binary; reviewer-minute meter (80) | 6–9 | 6 and 8 stated; meter forces 6×2 + 8×2 + 48 ≤ 80; 4.1 has no field | Clear | Medium | Med | 4 | 3 |
| 30 | market-scale | Prof | Market Hall | 2.1, 2.3–2.5, 4.5 | Operations casework, 5 binary | 5–7 | Flip every default; cache-token names hidden | Clear | Medium | Med | 5 | 2 |
| 31 | tenant-tools | Prof | Sam's Repair Shop | 3.1, 3.2, 3.7, 3.8 | Operations casework, 5 selects | 5–7 | Ref states the scope rule; 2nd | Clear | Medium | Low–Med | 5 | 2 |
| 32 | community-controls | Prof | Community Center | 2.2, 5.1–5.4 | 5 binary + approvals ≥2 | 6–8 | "two operators" stated; 2nd | Clear | Generic governance | Low | 5 | 2 |
| 33 | regional-operations | Prof | Northline Systems | 1.2, 1.4, 1.5, 6.4, 6.5, 7.1–7.3 | Incident board: 8 binary + 10-min clock | 8–10 | 8 flips pass; 4 retest-only fields | Clear but dense | Mostly generic SRE | Low | 4 | 2 |
| 34 | support-pilot | Prof | Northline Systems | 6.3 | 3 selects + stop count | 4–6 | "Stop immediately after the first" → 0; 2nd | Clear | Medium | Low | 5 | 2 |

Averages: approachability ≈ 4.2/5; learning value ≈ 2.4/5. The 7 dedicated surfaces (Dispatch + 6 labs) average L ≈ 3.7, while the 27 casework stations average L ≈ 2.1.

## 3. Redesign spec: approachable but knowledge-requiring

Design goal: a novice can still start in under 30 seconds and always finish, but finishing without the concept costs visible "mastery", and readiness credit separates *applied* from *guided*.

### 3.1 Kill the structural tells (do first, mechanical)
**`lib/claude/casework.ts`**
```ts
export type CaseOption = {
  value: string;
  rationale: string;          // shown in the debrief, per option
  misconception?: string;     // which wrong mental model this distractor targets
  examTerm?: string;          // e.g. "PreToolUse hook", "custom_id", "MCP resource"
};
export type CaseField =
  | { id: string; label: string; options: readonly CaseOption[]; key: string | readonly string[] }
  | { id: string; label: string; min: number; max: number; unit: string; key: Requirement; derivation?: string };
export type CaseDraft = Record<string, CaseValue | null>;   // null = "Choose…"
export type Casework = { …; deployed: CaseDraft; /* the current broken config, shown read-only as "Before" */ };
```
* Replace `field(id, label, initial, ...options)` with a constructor that takes no `initial`. `startingCase()` returns `null` for every field. The broken deployed config moves to `Casework.deployed`, which only feeds the "Before" column and `baseline`. So the starting value is no longer a wrong option, and the key is no longer "the next one".
* Render options in seeded order: add `caseOptionOrder(missionId, fieldId, cycle)` next to `stationOptions()` in `missions.ts` and use it in `case-surface.tsx` `Field` and `LinkedResults`. The seed includes `MissionRecord.cycle` so a retry cycle reshuffles.
* Give every field at least 3 options. Each distractor carries a `misconception` (e.g. "filter in the prompt", "retry everything", "audit after the fact").
* Move `fixture.requirements` to `CaseField.key`, so the answer lives with the field and lints can see it.
* Do the same in the legacy `decision()`: take explicit `passed` flags instead of `i === 1 || i === 3`.

**Lint rules** (add to `scripts/check-claude-content.cjs`):
1. Per field: longest/shortest option length ≤ 1.5×. Per track: key is strictly longest in ≤ 40% of fields, and key index is uniform after seeding (χ² check over seeds).
2. No key content word set has ≥ 50% overlap with `WorkstationBrief.ready`/`move`, any `MissionInterview.reply`, or `references` text marked `kind: "policy"`.
3. A numeric `key` value may appear literally in references only if `derivation` is unset and the field is tagged `transcription: true`. Prefer derived numbers.
4. Every checklist (`packetFields`, `briefSections`, ledger checks) has at least 1 distractor, as `instructionClips.infer` does.
5. Every `casework.objectives` entry maps to at least one field via `CaseField.objective` (catches community-policy 6.4 and eval-gate 4.1).

### 3.2 Turn hints into a ladder that costs mastery
**`lib/claude/cases/presentation.ts`**: change `WorkstationBrief` to
```ts
export type WorkstationBrief = {
  problem: string;                 // unchanged
  move: string;                    // where to look, never what to choose
  success: readonly string[];      // observable outcomes only ("0 unverified writes", "queue ≤ 120 min")
};
export type HintRung = { level: 1 | 2 | 3; kind: "nudge" | "concept" | "worked"; text: string; cost: 0.5 | 1; guideObjective?: string };
// Casework gains:
hints: Readonly<Record<string /* field id */, readonly [HintRung, HintRung, HintRung]>>;
```
* **Nudge (free on the first use per field):** restates the observed symptom and names which source to reread. Example: "The write happened before the record changed. Which moment can still stop it?"
* **Concept (−0.5):** a ~60-word explanation plus a link to the guide objective (`guideCityHref`), using the exam term. Example: "PreToolUse runs before execution and can block; PostToolUse sees the result."
* **Worked example (−1):** an isomorphic case in a different domain with its answer, never this case's answer. The `assignmentLens` items already have the right shape.
* **Reveal:** available after 3 failed runs on that field. It sets the field and marks `revealed`.
* `MissionInterview.reply` is rewritten to **facts and constraints only**. Add `kind: "fact" | "constraint"` and lint out imperatives ("Give…", "Use…", "Track…").
* Split `CaseFixture.problem` into `symptom` (what the simulation shows, always visible) and `diagnosis` (which field or concept, shown only at the concept rung). Show the "Review <section>" jump (`issueLinks`) only after the nudge rung is opened.

### 3.3 Predict, then run
```ts
Casework.prediction?: {
  prompt: string;                                   // "How many of the 48 timeouts reach staff?"
  options?: readonly string[];                      // or numeric with tolerance
  actual: (draft: CaseDraft) => string | number;    // reuse output() formulas
};
```
The first `runSample` in a cycle asks for a prediction. The replay shows "You predicted 24 / actual 24". A prediction that matches the actual, given a correct config, gives +0.5 mastery. Good targets: Dispatch peak queue minutes, market-rush spend, school-notice net minutes, retrieval p95, and the kitchen batch posted/held counts. For the labs, add `predict` to `runKitchen`/`runStream`/`runRetrieval` callers in `assignment-work.tsx` / `role-fieldwork.tsx`.

### 3.4 Show consequences before the verdict
In `case-workbench.tsx` `Replay`, the first run of a cycle renders `output()` artifacts and each fixture's `symptom`, but hides the pass/fail icons and the `sampleStatus` count. The learner first ticks which checks they think failed ("Judge the replay"), then the badges appear. The labs already do something close to this (fresh-chat replies, SSE timeline, retrieval candidates). Apply the same "artifact first" order to all `Casework.view` types.

### 3.5 Retry economics (keep it humane)
`MissionRecord` gains
```ts
mastery?: { cycle: number; runs: number; firstRunPassed: boolean; hints: Record<string, 1 | 2 | 3>; revealed: string[]; predictions: number; score: number /* 0–3 */ };
```
* No hard lockout. After 3 consecutive failed runs on the same field, Run is replaced by "Open a hint for <field label>" until one rung is opened. This turns flailing into reflection.
* After a pass, the **new case comes from `Casework.retestVariants: readonly CaseFixture[]`**, picked by seed. Each variant changes a constraint so the right answer differs (e.g. retry window 0 → retry limit 0; tolerance 3 mm; a different worker fails). Passing that variant is what earns "applied" credit, so memorized positions don't transfer.
* `saveCityCasework` persists `mastery`, and `caseworkPassed` stays the gate for completion.

### 3.6 Readiness integrity
In `portfolioEvidence()` (`pathway.ts`), count an objective as **applied** only when `!revealed.includes(field)` for that objective's fields and `hints[field] ≤ 2`. Otherwise add it to a new `guided` set. Surface the difference in `readiness-panel.tsx`, `city-certifications.tsx` and `workspace.tsx` ("applied" vs "guided").

### 3.7 A 60–90 second pre-brief that teaches the concept
```ts
Casework.prebrief: {
  concept: string;                                    // one sentence
  terms: readonly (readonly [plain: string, exam: string])[];   // ["Before each write", "PreToolUse hook"]
  contrast: { good: string; bad: string };            // tiny worked contrast in a neutral domain
};
```
Show it once per mission in a card before the station (stored as `MissionRecord.briefSeen`). After that it collapses into a "Concepts" chip. Show `CaseOption.examTerm` next to the chosen option in the debrief (`cases/debriefs.ts`), so friendly labels and exam vocabulary stay linked without making the controls harder to read.

### 3.8 Gates and mobile
* In the mission journal, render the `verify` gate explicitly: "Unlocks after a first-seen correct answer, or a reviewed explanation, on 2.2 and 5.3", with a link to the check.
* On screens ≤ 700px: after the first view, collapse `WorkstationDirections` into a one-line chip (keyed by `briefSeen`), so the first control sits above the fold. Put the prediction prompt into the sticky `.runActions` bar so it can't be scrolled past.

### 3.9 Priority order for an implementer
1. §3.1 null defaults, seeded order, ≥3 options and the lints. This is mechanical, removes the 15/27 zero-knowledge pass, and needs no UX change.
2. §3.2 rewrite the `ready`/`reply`/`references` text and split `problem` → `symptom`/`diagnosis`. This is content work, about 34 missions × 15 min.
3. §3.5 + §3.6 mastery record and applied-vs-guided credit.
4. §3.3 / §3.4 predict-then-run and the judge step, starting with the six missions that already have `output()` or capacity meters.
5. §3.7 pre-briefs with exam-term mapping; §3.8 gate copy and mobile collapse.
