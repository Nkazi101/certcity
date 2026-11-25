# How realistic are CertCity's practice items? Evidence review and item-style spec

Prepared 2026-11-24. Scope: CCAO-F, CCDV-F, CCAR-F, CCAR-P (CertCity banks) plus CCDV-P (no CertCity bank yet).

## 0. Evidence base and confidence

| Evidence | What it is | Reliability |
|---|---|---|
| Official exam guides (local copies in `scratchpad/dl/`; CCDV-P from https://cc.sj-cdn.net/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1794947325/Claude_Certified_Developer-Professional_Exam_Guide.pdf) | Format tables, blueprints, 12 CCAR-F samples (v1.1), 3 samples each for CCAR-P/CCDV-F/CCAO-F in both the Nov and Dec-7 editions, 3 for CCDV-P (27 official items total) | Authoritative, but samples are "illustrative" and "not drawn from the live item bank" (Dec-7 guides). CCAR-F samples are "drawn from the practice test" |
| Official FAQ https://anthropic-partners.skilljar.com/page/faq-certifications | Format: "multiple choice and scenario-based multiple response", 120 min; the old practice exam "was retired in the move to Pearson" | Authoritative |
| Candidate reports (CertSafari exam-experience pages, Hackernoon, Udacity, dev.to, Substack, Learning Tree, Qiita) | ~170 self-reports, almost all pre-Dec-7 | Self-reported, unverifiable; CertSafari hosts them and sells practice tests; some vendors are promotional. Treat as signals, not facts |
| Competitor free items (~770 items: CertSafari, Tutorials Dojo, szymonpaluch.com, claudecertifiedarchitects.com, CyberSkill, two GitHub sets) | Measured by script | Shows market conventions, not the real exam |
| CertCity banks | Loaded from `lib/claude/**` via the existing TS hook; deduplicated by prompt across practice, follow-up, original/retest/recovery forms and recovery banks | Exact |

Scripts and data: `scratchpad/research/scripts/{official.py,bank.mjs,metrics.py}`, outputs `official.json`, `bank.json`, `metrics.json`. Competitor raw pages: `scratchpad/research/web2/`; candidate-report notes: `scratchpad/research/web/`.

Biggest caveat: the Dec-7 revision (CCAO-F, CCDV-F, CCAR-P go to 70 items with 10 unscored; CCAR-F stays at 60 under guide v1.1) postdates every candidate report found. Our only evidence of post-Dec-7 item style is the 9 revised official samples, and they changed a lot (Section 2).

## 1. What the real exams are (official facts)

| | CCAO-F | CCDV-F | CCAR-F | CCAR-P | CCDV-P |
|---|---|---|---|---|---|
| Items | 60 → 70 (10 unscored) from Dec 7 | 53 → 70 (10 unscored) | 60 | 63 (per candidates) → 70 (10 unscored) | 70 (10 unscored) |
| Time | 120 min | 120 | 120 | 120 | 120 |
| Format wording | Dec-7: "Scenario-based multiple-choice items; each item states how many responses to select" | same | "Multiple-choice and multiple-response items"; "4 scenarios drawn from a bank of 6" | same as CCDV-F Dec-7 | "Scenario-based multiple-choice and multiple-response items" |
| Fee | $99 | $125 | $125 | $175 | $175 |

Sources: the guides listed above; FAQ. CCAR-P Dec-7 guide also tells candidates to practice "reviewing artifacts produced by others, including architecture diagrams, configuration files, logs and traces, evaluation results, and code, since exam scenarios present such artifacts and expect you to reason from them". That is the only official statement that exhibits appear, and it is CCAR-P-specific.

Note a conflict: Whizlabs claims CCAR-P is "170 minutes" (https://www.whizlabs.com/claude-certified-architect-professional/); the official guide says 120. Ignore Whizlabs on format.

## 2. Official sample items, quantified

All 27 official samples are 4-option, single-answer, with no block exhibits (no code, JSON or log blocks). Technical detail is always inline (tool names, CLI commands, event names).

| Official set (n) | Stem words median | Option words mean | Correct = strictly longest | Stems with numbers | Stems citing observed evidence (logs, traces, usage data, reports) | Named Claude/API terms per 100 words | Distractors that name a real mechanism |
|---|---|---|---|---|---|---|---|
| CCAR-F v1.1 (12) | 46 (IQR 39–77) | 17.6 | 58% | 50% | 58% | 3.4 | — |
| CCAR-P Nov (3) | 33 | 9.8 | 67% | 33% | 0% | 0.9 | — |
| **CCAR-P Dec-7 (3)** | **82** | **24.2** | 100% | 0% | 33% | 0.9 | — |
| CCDV-F Nov (3) | 33 | 13.8 | 100% | 33% | 33% | 2.3 | — |
| **CCDV-F Dec-7 (3)** | **62** | **24.5** | 100% | 0% | 100% | 4.7 | — |
| CCAO-F Nov (3) | 32 | 9.4 | 67% | 0% | 0% | 0.5 | — |
| **CCAO-F Dec-7 (3)** | **63** | **22.9** | 33% | 0% | 0% | 3.4 | — |
| **CCDV-P v1.0 (3)** | **77** | **20.5** | 67% | 0% | 100% | 0.6 | — |
| Pooled current (CCAR-F + Dec-7 + CCDV-P, 24) | — | — | — | — | — | — | 38% of distractors; 1.19 distinct mechanism words each |

What changed in Dec-7. Stems roughly doubled (32–33 → 62–82 words) and options went from about 10 to about 23 words. Distractors went from absurd to plausible. Nov CCAO-F offered "Switch to a different AI platform" and "Skip the analysis entirely". Dec-7 CCAO-F offers incognito chat, a Project restricted to HR, or "Ask Claude to anonymize the data itself after upload". Each is a real feature that fails on one specific property. Treat the Nov samples as obsolete style.

Recurring official stem anatomy:
1. A role and a system.
2. One or two concrete symptoms with numbers or trace evidence ("in 12% of cases", "agrees with human raters on only slightly more than half").
3. A constraint ("organizational policy permits AI analysis only on de-identified data").
4. Sometimes an already-tried fix ("The team has already added a system prompt instruction…").
5. A qualified lead-in: "most effective first step", "without changing the model's behavior", "without reintroducing it elsewhere", "which constraint decides the architecture and the trade-off".

The lead-in qualifier is often what separates two defensible options.

Official distractor taxonomy. Every pattern below occurs in the published rationales.
- **D1, probabilistic where deterministic is needed.** A prompt instruction stands in for enforcement (CCAR-F Q1 B/C, CCAR-P S2 D, CCDV-F S3 A, CCDV-P S3 B).
- **D2, self-assessment as a control.** Self-reported confidence (CCAR-F Q3 B, CCAR-P S3 D, CCAO-F S1 C).
- **D3, disproportionate first step.** A routing classifier, a trained model or tool consolidation (CCAR-F Q2 C/D, Q3 C, Q11 D).
- **D4, reduces frequency, not mechanism.** A longer timeout, more max tokens, a larger context window or a longer cache TTL (CCAR-P S2 A, CCDV-F S1 A, S2 A, CCAR-F Q12 C).
- **D5, right control, wrong property.** ZDR vs residency, incognito vs disclosure, sentiment vs complexity, tool availability vs ordering (CCAR-P S1 B, CCAO-F S3 A/C, CCAR-F Q3 D, Q1 D).
- **D6, model swap.** Bigger, smaller or higher effort (CCAO-F S2 D, CCDV-F S2 C, CCDV-P S2 B).
- **D7, detective instead of preventive.** Logging or post-hoc review (CCAR-P S3 A, CCDV-P S3 D).
- **D8, blames the wrong component in the causal chain** (CCAR-F Q7 A/C/D, CCAO-F S2 A/B).
- **D9, fail-silent or fail-total error handling** (CCAR-F Q8 C/D).
- **D10, over-privilege or over-gating** (CCAR-F Q9 C, CCAR-P S3 C).
- **D11, non-existent feature or flag.** CCAR-F recall items only: `CLAUDE_HEADLESS`, `--batch`, `.claude/config.json`.

Recall vs judgment. CCAR-F has a real recall slice: 3 of 12 samples (Q4 `.claude/commands/`, Q6 `.claude/rules/` glob frontmatter, Q10 `-p`) hinge on exact Claude Code locations or flags. The Dec-7 CCDV-F samples require precise API semantics (`content_block_stop` vs `message_stop`, `message_delta` stop reason, cache-breakpoint prefix matching). Dec-7 CCAO-F requires product semantics (what incognito does and does not do; Project knowledge vs memory). CCAR-P and CCDV-P samples are judgment-heavy with low identifier density.

Artifacts to avoid copying. The official answer keys are badly unbalanced: CCAR-F is A for 10 of 12, and Dec-7 CCDV-F is B for 3 of 3. Their correct option is also the longest 58–100% of the time. These are flaws of the sample sets, not targets.

## 3. What candidates and competitors report

### CCAR-F (best-evidenced)
- **Scenario blocks.** About 15 items per scenario, 4 scenarios, matching the guide's six named scenarios. Sources: a verified CertSafari reviewer ("one for every 15 questions", https://www.certsafari.com/exam-experiences/anthropic/claude-certified-architect-foundations) and a second-hand YouTube report via https://dev.to/mjmirza/i-researched-anthropics-claude-certifications-for-a-week-before-applying-and-the-exam-is-the-easy-4in9.
- **Close options.** "Most options look nearly identical and sound justified"; "a handful… had 2 options… both 100% correct" (CertSafari, verified reviewers). Several options would work, and the most reliable one wins (https://www.udacity.com/blog/the-claude-certified-architect-exam-explained-by-someone-who-passed-it/, vendor-authored). "Technically correct" vs production-grade (https://dev.to/suraj_khaitan_f893c243958/i-passed-the-claude-certified-architect-foundations-cca-f-exam-my-journey-lessons-and-98j).
- **Reading load.** Stems of about 150–200 words including scenario context (https://rickhigh.substack.com/p/the-complete-guide-to-passing-the, self-reported, paywalled guide). "Dense" scenarios (https://www.learningtree.com/blog/my-journey-claude-certified-architect-foundations-certification/, vendor). Some concepts are described "without using the name" (CertSafari, unverified).
- **Format.** Mostly single-answer. Only Learning Tree mentions multi-answer items. No candidate mentions code, config or log blocks.
- **Time.** Most finish with 10–30 minutes spare (Udacity; dev.to). A minority feel pressure (CertSafari).
- **Form variance.** One form had "almost no Claude Code items" (Substack, self-reported).
- **Integrity flag.** One verified CertSafari reviewer says "A few questions were also repeated from the CertSafari mocks". That could indicate leaked content in a competitor bank. CertCity must not mine competitor or "dump" items (ExamTopics advertises "actual questions", https://www.examtopics.com/exams/anthropic/ccar-f/).

### CCAR-P (thin, pre-Dec-7)
- **Format.** One unverified CertSafari reviewer (882) reports about 75% "choose 2 of 5", plus "4-5 questions listed 5-6 architectural decisions to mark Yes/No each", with the rest single-answer (https://www.certsafari.com/exam-experiences/anthropic/claude-architect-professional).
  - A verified reviewer reports "a different type of question to classify different situations under certain cases".
  - Another unverified reviewer reports "more multiple choice questions".
  - A Skool post references "four different question/answer formats" (https://www.skool.com/clauders/earned-ccar-p-4-questionanswer-formats; snippet only).
  - Hackernoon reports 63 items, four options per scenario item, and "all sound responsible" distractors (https://hackernoon.com/i-scored-a-perfect-996-on-anthropics-claude-certified-architect-professional-exam).
  - Conclusion: multiple-response and matrix/classification formats very likely exist on at least some CCAR-P forms. Their share is unverified.
- **Content.**
  - Stakeholder communication: "Most of the questions… are about communication with stakeholders" (unverified).
  - Phase gates and SDLC ("what to do before a step"; mapping a problem to its implementation phase).
  - Least privilege (Hackernoon).
  - Practice tests are described as "harder and more technical than the real exam" (multiple CertSafari reviewers).

### CCDV-F (pre-Dec-7)
- **Single-select.** Four or more reviewers, two of them verified, report no multi-select (https://www.certsafari.com/exam-experiences/anthropic/claude-developer-foundations).
- **Little recall.** "No questions about any specific attributes or params". A verified reviewer reports "no technical questions… related to code or schema". "Short and easy to understand" sentences.
- **Option pattern.** Typically two options are obviously false and two are close.
- **Difficulty.** Real exam consistently "easier" than vendor practice.
- **Change risk.** The Dec-7 guide and samples are clearly more API-specific (streaming events, cache breakpoints), so expect this to shift.

### CCAO-F (pre-Dec-7)
- **Sequencing items are the signature format.** Six or more reviews mention them, several verified: "Several sequencing of steps related qs", "put steps in the correct sequence", "task decomposition sequences (e.g. 5-3-1-4-2)".
  - Answer form: numbered steps in the stem and lettered permutations as options, e.g. "A: 1,5,3,4,2". Reviewers say "the last two numbers were consistent across answers A-D".
  - Source: https://www.certsafari.com/exam-experiences/anthropic/claude-certified-associate-foundations.
- **Multi-select share varies.** From "a handful" (verified) to "in favor for multi" (unverified).
- **Wording.** Long scenarios with hard wording: "ambiguous wording", "a fairly high level of English".
- **Time.** About 90 minutes used.

### CCDV-P
No public candidate reports were found (searches and CertSafari had none). Evidence is the guide only.

### Competitor conventions (https://www.certsafari.com/anthropic/claude-certified-architect-foundations/practice-questions, https://szymonpaluch.com/claude-certification-practice-exams, https://tutorialsdojo.com/ccar-f-claude-certified-architect-foundations-study-guide/, https://claudecertifiedarchitects.com/, https://ccaf.cyberskill.world/practice/ccaf/sample-questions, GitHub sets)
- **Exhibits.** None of the ~770 items uses a block exhibit.
- **Stem length.** Median stems are 33–70 words (CertSafari CCDV-P about 123).
- **Multiple-response.** Signalled as "(Select TWO.)" or "(Select 2)".
- **Ordering and grids.** No competitor offers ordering or yes/no-grid items. That is a differentiation opportunity for CertCity, given the CCAO-F and CCAR-P reports.
- **Answer leaks.** The serious sets keep the correct answer at chance-level longest. The GitHub community sets leak the answer through length (correct strictly longest in 66–98% of items).

## 4. CertCity vs official: measured

Distinct items per track (deduplicated by prompt): CCAR-F 242, CCAR-P Dec 294, CCDV-F Dec 285, CCAO-F Dec 268.

| Metric | Official (current-style samples) | CertCity CCAR-F | CCAR-P Dec | CCDV-F Dec | CCAO-F Dec |
|---|---|---|---|---|---|
| Stem words, median (item-specific) | 46 (CCAR-F); 62–82 (Dec-7, CCDV-P) | **20** | **19** | **19** | **18** |
| Shared scenario preamble words, median | CCAR-F guide scenarios 41–69; Dec-7 samples are self-contained | 34 (202/242 have one) | 36 | 37 | 36 |
| Option words, mean | 17.6 (CCAR-F); 20.5–24.5 | **11.1** | **10.6** | **11.9** | **12.0** |
| Options per item | 4 | 4 (5 for multi) | same | same | same |
| Multi-select share | 0% in samples; exists per guides | 6.6% (all "2 of 5") | 4.1% | 3.2% | 3.7% |
| Block exhibits | 0% | 0% | 0% | 0% | 0% |
| Stems containing numbers | 50% (CCAR-F) | 14% | 11% | 11% | 9% |
| Stems citing observed evidence | 58% CCAR-F; 100% CCDV-F Dec-7 / CCDV-P | 16% | 14% | 11% | 6% |
| Named terms per 100 words | 3.4 CCAR-F; 4.7 CCDV-F; 3.4 CCAO-F; 0.6–0.9 CCAR-P/CCDV-P | **1.26** | **0.35** | **1.29** | **0.92** |
| Distractors naming a real Claude/API mechanism | 38% | **9%** | **2%** | **8%** | **10%** |
| Mechanism words per distractor | 1.19 | 0.33 | 0.39 | 0.44 | 0.30 |
| Correct strictly longest (single-answer) | 58–100% (a flaw) | 29% | 29% | 27% | 32% |
| Keyword-cue guesser accuracy (chance about 25%)* | 37% CCAR-F (n=12) | **53%** | **61%** | **58%** | **60%** |
| "Fewest absolutes" guesser accuracy | 31% CCAR-F | 33% | 35% | 32% | 32% |
| Correct options containing "verify/validate/evidence/scope/check…" | 29% (distractors 12%) | 47% (21%) | 58% (25%) | 52% (24%) | 64% (26%) |
| Items with a rationale for every option | official explains all distractors | 34% | 6% | 18% | 7% |
| Explanation words, median | about 50–110 in official rationales | 13 | 12 | 12 | 11 |
| Key position in distinct pool | — | A 31% | A 35% | A 36% | A 34% |

*The keyword guesser (`scripts/heur.cjs` vocabulary) was originally tuned on CertCity, so its CertCity accuracy is optimistic. The virtue-word row is the cleaner measure: it shows the cue in both corpora, but CertCity's correct options carry it 1.6–2.2x more often in absolute terms.

What the numbers say:
1. **CertCity is calibrated to the obsolete Nov-sample style.** Item-specific stems of 18–20 words and options of 11–12 words match the Nov samples (32–33 / 9–14). They do not match the Dec-7 or CCAR-F samples (46–82 / 18–25). Even with the shared preamble added, CertCity reading load per item is about half of the official samples. It is roughly a third of what CCAR-F candidates report (150–200 words).
2. **Distractors are generic rather than plausible named mechanisms.** This is the single biggest realism gap: 2–10% vs 38% of distractors name a real Claude or API mechanism. Typical CertCity distractors are paraphrased bad behaviors: "Default both to zero", "Save the rule in a chat with no supporting file", "Use whatever code seems appropriate to the description". Official distractors are things a competent engineer might actually do: few-shot examples, a routing classifier, ZDR, a longer timeout, incognito chat, a bigger judge model.
3. **Stems state conclusions instead of evidence.** CertCity often names the diagnosis in the stem ("overlapping descriptions", "Its cited document is current"). Official stems give raw symptoms and let the candidate diagnose.
4. **Surface cues are moderately exploitable.** Neither length nor absolutes leak much; CertCity length balance is better than the official samples. But "process-virtue" words in correct options and the A-position skew in the deduplicated pool are cues. Check served-form shuffling, which `arrangeRetest` partly handles.
5. **Formats are too uniform.** Every multiple-response item is "2 of 5" and is only 3–7% of items. CertCity has no sequencing items for CCAO-F, and no yes/no or classification matrix for CCAR-P.
6. **Scenario settings don't match the real exams.** CCAR-F forms use 4 scenarios × about 15 items, which is the right structure. But they are civic re-skins ("Canopy grant records", "Water district research room") rather than the six official scenarios, and 0 of 242 items name an official scenario. Those six are Customer Support Resolution Agent, Code Generation with Claude Code, Multi-Agent Research System, Developer Productivity, Claude Code for CI, and Structured Data Extraction.
   - Across all tracks, settings skew to municipal and small-organization contexts. Official settings are financial services, payments, HR, marketing, enterprise support, and regulated cloud.
   - CCAR-F vocabulary also drifts: CertCity says "worker" in 51 items. The guide and samples say "subagent", and CertCity uses that word in 0 items.
7. **Feedback depth is thin.** Explanations have a median of about 12 words. Only 6–34% of items explain every option. Official rationales explain why each distractor fails, which is the learning payload.

## 5. Hand comparisons (same objective, CertCity vs official)

I read about 10 CertCity items per track against the official sample on the same objective. Representative contrasts:

**CCAR-F**
- **Tool-order enforcement** (`refund-order`, 1.4) vs official Q1. The right concept is there: enforce at the write boundary. But the stem is 33 words with no evidence, and two distractors are strawmen: a post-refund hook, and accepting the summary's claim. The official version has a measured failure rate (12%), named tools, and three serious alternatives (prompt rule, few-shot, routing classifier), each wrong for a different reason (D1, D1, D5).
- **Tool descriptions** (`lookup-and-book`, 2.1) vs Q2. CertCity states the root cause ("overlapping descriptions") in the stem. Its distractors ("ask users to include the exact tool name", "force the booking tool whenever the request includes the word service") are not choices an engineer would weigh. The official version makes few-shot examples, a routing layer and tool consolidation compete with the fix, and keys on "first step".
- **Plan mode** (`benchmark-warehouse-modes`, 3.4). The option "Always use the same large autonomous rewrite for every change" is eliminable on wording alone. In official Q5, all four options are real execution strategies.
- **Coverage gap** (`archive-missing-slice`, 1.2) vs Q7. The official version shows the coordinator's actual decomposition and asks for the root cause among four components. CertCity pre-diagnoses the gap and offers "hope the map gap is noticed".
- **Structured errors** (`two-failure-layers`, 2.2). This item is good: it is concrete (`isError`, MCP disconnect) and close to official density. Use it as a model.
- **Batch vs live** (`permit-digest`, 4.5). Good and close to Q11. It adds a nice resubmit-by-ID twist (official rationale mentions `custom_id`).
- **Missing recall items.** No CertCity CCAR-F item asks where a project slash command lives. Only 1 item touches `tool_choice`, 4 touch `.claude/rules`, and 3 touch plan mode. Official samples spend 3 of 12 items on exactly this kind of recall.

**CCAR-P**
- **Residency** (`december-infra-residency`) vs Dec-7 S1. CertCity asks about "design evidence". Its distractors include "Use a region label in the user-facing app" and "Use a smaller model without reviewing where it processes inputs". The official item forces a trade-off between named deployment surfaces (marketplace surface vs Anthropic API + hosted runtime vs ZDR). Each option is a compound "decision + accepted trade-off". Only 2 of 294 CertCity items mention Bedrock/Vertex/Foundry or a cloud surface, and 0 mention ZDR or Managed Agents.
- **Idempotency** (`dec-practice-professional-short-3.8`). The concept is correct, but the stem is 11 words ("The charge request times out after being received"). The official S2 is an 82-word incident with a traffic surge, a retry wrapper, and a finance report.
- **Delegation** (`…short-1.1`). "Approve placements with verified paperwork" is terse and context-free. Official S3 enumerates six steps with different reversibility and asks for the minimal gate set.
- **Executive brief** (`benchmark-utility-sponsor-brief`). This is the right domain (D6). But the correct option is the only one that is not obviously negligent ("Projected savings only because the region is small").

**CCDV-F**
- **Cache breakpoints** (`dec-practice-developer-short-5.3`). This is the closest CertCity gets to official density: it names `cache_read_input_tokens` and `cache_control`. It still keeps the "cheaper model and assume…" strawman. Official S2 adds the two-cadence twist: system and tools never change, while policy changes a few times a day.
- **Streaming.** The CertCity UTF-8 chunk-split item is a realistic debugging item. But no CertCity item tests the `content_block_stop` vs `message_stop` / `message_delta` stop-reason semantics that official S1 hinges on. Only 15 items (5%) mention stop reason or max_tokens.
- **Tool parameter description** (official S3). Only 2 CertCity items address descriptions or parameters in this form, and 0 use `tool_choice`. Official S3 has three distractors that are real moves: a system-prompt rule, forced `tool_choice`, and a by-name tool.

**CCAO-F**
- **De-identification** (`Attendance summary`, 6.2). This one is well aligned with official S3: incognito, a restricted Project, and "ask Claude to aggregate" as distractors. It is a model item.
- **Stale knowledge vs memory** (`…short-3.3`). The right concept, but the stem gives the diagnosis ("shows a separate account memory entry containing the retired clause"). Official S2 gives only symptoms: an old price, another client's terminology, unchanged instructions.
- **Sequencing.** The "Which order…" items exist (about 6%) as prose options. None use the numbered-steps → permutation format candidates describe.

## 6. ITEM STYLE SPEC per exam

General rules for all exams:
- **Stems.** Present evidence, not diagnosis.
- **Distractors.** Every distractor is a real, named mechanism a competent practitioner might choose, and fails for exactly one articulable reason from taxonomy D1–D11.
- **Length.** Options within ±20% of each other in length.
- **Key balance.** Balance key positions at form level.
- **Wording cues.** Ban "virtue words" (verify, validate, evidence, scope) appearing only in the key.
- **Rationales.** Write a rationale for every option (40–80 words for the key, 15–40 per distractor) naming the failure class.
- **Multiple-response.** State the count in the stem ("Select TWO.").

### CCAR-F (60 items, 4 of 6 scenarios)
| Spec | Target |
|---|---|
| Scenario grouping | Mock forms use exactly 4 of the official 6 scenarios × 15 items, with a 50–70-word shared preamble per scenario that uses the official scenario frames. Re-skinning names is fine, but keep the frame (support agent with `get_customer`/`lookup_order`/`process_refund`-style tools; multi-agent research coordinator; CI pipeline; extraction pipeline; Claude Code team repo; developer productivity) |
| Stem length | 40–90 words item-specific (median about 55); total read about 100–150 per item with preamble |
| Evidence | ≥50% of stems contain a number or measured outcome; ≥50% cite logs, production data or traces |
| Options | 4; 14–25 words; multi-response ≤10% (select 2 of 5), so keep about 6–8% |
| Exhibits | Inline only: tool names, CLI invocations, paths, one-line log facts. No block exhibits |
| Recall slice | 15–25% of items hinge on exact Claude Code, API or MCP facts (file locations, flags, frontmatter, `stop_reason` values, `tool_choice` modes, Batches latency, MCP scopes, hook events), with non-existent-feature distractors (D11) |
| Named-term density | ≥3 per 100 words; ≥2 identifiers per item |
| Lead-ins | Mix "most effective", "first step", "root cause"; about 1 in 5 items asks for a root cause |

Example near-miss patterns (original, not official): (a) A coordinator drops a subagent's partial results on timeout. Options: structured error with partial results (key); retry with backoff and a generic failure (D9); mark success with empty results (D9); raise the timeout (D4). (b) Enforce that a schema-validation tool runs before `submit_record`. Options: PreToolUse hook that denies the call (key); system-prompt rule (D1); few-shot examples (D1); `tool_choice` forcing the validator on every turn (D5).

Under-represented in CertCity (counts out of 242): `.claude/commands` / slash commands (0); "subagent" vocabulary, Task tool and `allowedTools` (0); `tool_choice` (1); plan mode (3); `.claude/rules` globs (4); prompt caching (4); MCP scope / `.mcp.json` (2); `isError` (5); PreToolUse/PostToolUse (8); stop_reason loop control (8); the official scenario frames (0).

### CCAR-P (70 items, Dec-7 blueprint)
| Spec | Target |
|---|---|
| Stem length | 70–110 words, self-contained; scenario clusters of 3–6 items allowed, but each stem must stand alone |
| Options | 4 single; 5 for multi-response; 20–30 words; about a third are compound "decision + trade-off accepted" options |
| Multi-response | Hedge: 25–35% "select 2 of 5" (unverified report of about 75%; samples show 0%). Low confidence, so revisit after post-Dec-7 reports |
| Other formats | 3–5 per form "mark each of 5 decisions Yes/No" or classify-situations matrix items (single self-report plus a verified "classify situations" mention). Only if the UI can support them; score all-or-nothing |
| Exhibits | 10–20% with a short artifact: an architecture-decision excerpt, a trace summary, an eval table, or an IAM/settings snippet. The Dec-7 guide explicitly says scenarios present such artifacts |
| Named-term density | About 1–2 per 100 words; product terms, not parameters (surfaces, Managed Agents, Agent Skills, MCP, ZDR) |
| Judgment level | Reversibility/stakes, binding-constraint identification, phase gating, stakeholder framing; little parameter trivia |

Example patterns: (a) A health insurer needs hosted session state plus in-tenant processing. Options: marketplace surface, own the runtime (key); first-party API + ZDR (D5); hosted runtime on marketplace with "no trade-off" (non-existent combination); mirror data (violates the constraint). (b) Select TWO of five controls for a refund agent's irreversible steps; correct pairs combine a deterministic pre-execution gate with a constrained side channel.

Under-represented (out of 294): Bedrock/Vertex/Foundry (2); ZDR (0); Managed Agents (0); A2A vs MCP (0); idempotency (4); stakeholder or executive communication (4); phase gates / ADRs / handoff (9); HITL by reversibility (11).

### CCDV-F (70 items from Dec 7)
| Spec | Target |
|---|---|
| Stem length | 55–85 words; symptom + trace or usage evidence in ≥80% of items |
| Options | 4; 18–28 words; multi-response ≤5% (pre-Dec reports say 0) |
| Exhibits | Inline identifiers: event names, fields, usage counters, tool names and params. About 10% may carry a 3–8-line request/response or trace excerpt as a stretch item (the Dec-7 blueprint calls for "reading and writing correct Messages API interactions") |
| Recall | Precise semantics, not values: event order, stop reasons, cache prefix rules, tool schema behavior, error classes (429/529/overloaded), SDK hooks, settings precedence |
| Named-term density | ≥4 per 100 words |

Example patterns: (a) A tool-use loop exits early because it checks the last content block's type. Key: branch on `stop_reason == "tool_use"`. Distractors: raise max_tokens (D4), force `tool_choice` (D5), add a system-prompt rule (D1). (b) A judge passes everything. Key: calibrate against human labels. Distractors: bigger judge (D6), stricter rubric wording (D1), lower threshold.

Under-represented (out of 285): `tool_choice` (0); Files API (0); extended thinking/effort (1); permission modes and settings precedence (2); prompt injection (3); 429/529/retry-after (5); model tiers (5); stop reason/max_tokens (15); structured outputs `strict` (6).

### CCAO-F (70 items from Dec 7)
| Spec | Target |
|---|---|
| Stem length | 50–80 words; business persona + artifact + policy constraint; plain but formal English |
| Options | 4; 18–25 words |
| Sequencing | 10–15% of items: 4–6 numbered steps in the stem; options are 4 lettered permutations sharing suffixes, differing in the first 2–3 positions |
| Multi-response | 15–25% (select 2 of 5); reports range from "a handful" to a majority |
| Exhibits | Inline only (draft excerpts, a column list from a spreadsheet) |
| Named-term density | About 3 per 100 words of product names (Projects, project knowledge, memory, incognito, Skills, connectors, Research, code-executed analysis, Artifacts, effort/model) |
| Distractors | Real features misapplied (D5), model or effort swaps (D6), self-verification (D2) |

Example patterns: (a) Order five steps for turning a meeting transcript into a client-ready summary. The key verifies figures before formatting; distractor permutations put "share" before "verify". (b) A Project's drafts degrade. Key: replace stale knowledge. Distractors: rewrite instructions (D8), remove the Skill (D8), switch to a higher-effort model (D6).

Under-represented (out of 268): plugins (0); Usage Policy (0); code-executed analysis (3); Skills (9); permutation-format sequencing (0).

### CCDV-P (no CertCity bank)
| Spec | Target |
|---|---|
| Stem length | 70–100 words; every item carries production evidence (traces, cost or latency metrics, judge-agreement numbers, red-team results) |
| Options | 4 (5 for multi); about 20 words; multi-response 10–20% (guide says it exists; no candidate data) |
| Exhibits | 15–25% short trace, metric or eval tables |
| Content | Stop-condition branching, fallback/backpressure, judge bias and calibration, SLOs/SLIs, checkpointing, fleet coding-agent verification, defense in depth (lethal-trifecta style exploits) |
| Distractors | "More retries", "bigger model", "stronger prompt", "log it" (D4/D6/D1/D7) as named alternatives |

## 7. Bottom line

CertCity's structure is broadly right: 4-option scenario forms, CCAR-F 4 × 15 scenario blocks, balanced answer lengths, and a few strong items. But its items are written to the pre-December sample style: short stems, short options, and distractors that are generic bad behaviors rather than real mechanisms. Against the current official samples, CertCity stems carry about a third to half the reading load. Its stems present the diagnosis instead of evidence. Distractors name real mechanisms about a quarter as often as official ones. Explanations are about 12 words instead of a full per-option rationale.

The rewrite priorities are:
1. Lengthen and evidence-load stems.
2. Replace strawman distractors with the D1–D11 near-miss classes.
3. Add the CCAR-F recall slice.
4. Re-anchor CCAR-F on the six official scenario frames.
5. Add CCAO-F sequencing and CCAR-P multi-response / matrix formats, marked lower-confidence.
6. Write full per-option rationales.

Revisit the CCAR-P and CCDV-F format shares once post-Dec-7 candidate reports appear.
