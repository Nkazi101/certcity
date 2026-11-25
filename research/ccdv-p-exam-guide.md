# Claude Certified Developer – Professional (CCDV-P): exam guide facts

Source: *Claude Certified Developer – Professional Exam Guide*, Version 1.0, effective November 2026, 15 pages.
PDF: https://cc.sj-cdn.net/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1794947325/Claude_Certified_Developer-Professional_Exam_Guide.pdf
(fetched 2026-11-25; the PDF metadata shows it was generated on November 17, 2026).
Registration: https://anthropic-partners.skilljar.com/claude-certified-developer-professional-certification
Prep path: https://anthropic-partners.skilljar.com/path/claude-certified-developer-professional

Everything below is copied or closely paraphrased from the guide, with page numbers. Nothing here comes from candidate
reports; the guide is the only public evidence for this exam (see `research/exam-realism.md` §3, "CCDV-P").

Text-extraction note: the PDF's text layer drops the en dash and some hyphens (the title extracts as "Developer
Professional", the score range as "1001,000"). The exam code extracts as "CCDVP" on pages 1 and 3. The other
programme codes in the same family are written with a hyphen (CCDV-F, CCAR-P), and the prompt that commissioned this
track calls it CCDV-P, so CertCity writes **CCDV-P**. If a future guide shows the code without a hyphen, change
`code` in `lib/claude/tracks/developer-professional.ts`.

## 1. Exam details at a glance (p. 3)

| Field | Guide wording |
|---|---|
| Credential | Claude Certified Developer – Professional |
| Exam code | CCDV-P (extracted as "CCDVP", see note) |
| Number of items | 70, of which 60 are scored and 10 are unscored. Unscored items are not identified and do not affect the score |
| Item format | Scenario-based multiple-choice and multiple-response items; each item states how many responses to select |
| Time limit | 120 minutes |
| Delivery | Proctored: online proctored and/or test center, per program policy |
| Prerequisites | None. CCDV-F is recommended, not required, preparation. The credential is awarded on exam performance alone |
| Passing score | Scaled score of 720 on a scale of 100–1,000 |
| Exam fee | $175 USD |
| Validity | 12 months from the date the credential is awarded |
| Result reporting | Pass/fail with scaled score 100–1,000, plus percent-correct by domain on the score report |

Scoring (p. 11–12): criterion-referenced against a fixed standard set by a formal standard-setting study with subject
matter experts judging a minimally qualified candidate. Cut score 720. Unscored items are mixed in and "Allow time for
every item." Domain percentages on the score report are informational and do not decide pass/fail.

Renewal (p. 14–15): valid 12 months. On-time renewal is a free, non-proctored assessment on the Anthropic Partner
Academy after reviewing what changed. A lapsed credential requires the full exam at the full fee. Anthropic may require
a full retake if content changes significantly.

Retakes (p. 13): waits of 14 days after the first failure, 30 after the second, 90 after the third; at most four
attempts per exam in a rolling twelve months; the fee applies to each attempt.

Scheduling (p. 12): OnVUE exams can be cancelled or rescheduled up to one hour before the appointment, test-centre exams
up to 48 hours before; later changes forfeit the fee.

## 2. Purpose and audience (p. 1–2)

The credential "validates that an individual can operate Claude-powered applications, agents, and workflows in
production at scale" and builds on CCDV-F. Audience: senior and staff software engineers, platform and site
reliability engineers, and solutions engineers who own deployed Claude systems and are accountable for reliability,
quality, cost and safety; increasingly they "direct fleets of coding agents". The intended candidate works daily with
the Messages API, Agent SDK, Claude Managed Agents, Claude Code and MCP, understands first-party versus cloud-platform
deployments, and "built and deployed at least one tool-using agent in production rather than only an LLM-backed
chatbot or summarizer" (p. 2).

The nine competency areas listed on p. 1–2: observability and drift monitoring; diagnosing multi-turn and multi-agent
failures and leading incident response; evaluation systems (calibrated LLM-as-judge, regression suites, CI/CD gates);
resilient high-throughput integration with progressive delivery of prompt and model changes; context, memory and
retrieval architecture; fleet-scale cost and latency (routing, caching, latency engineering); layered runtime
guardrails and defense in depth for tool-using agents; durable multi-agent orchestration (checkpointing, session
persistence, failure containment); operating fleets of coding agents (verification, AI code review, unattended runs).

## 3. Blueprint (p. 3–8)

| Domain | Title (guide wording) | Weight | Scored items on a 60-item form* |
|---|---|---|---|
| 1 | Advanced Agent Architecture and Orchestration | 17% | 10 |
| 2 | Production Integration, Reliability, and Knowledge Grounding | 20% | 12 |
| 3 | Observability and Production Monitoring | 12% | 7 |
| 4 | Advanced Debugging and Incident Response | 10% | 6 |
| 5 | Evaluation Engineering and Quality Assurance | 12% | 7 |
| 6 | Cost and Latency Optimization at Scale | 8% | 5 |
| 7 | Runtime Guardrails and Production Security | 11% | 7 |
| 8 | Agent Fleet Operations for Software Delivery | 10% | 6 |
| | Total | 100% | 60 |

\*The guide gives weights only ("approximate proportion of scored items", p. 3). The item counts are CertCity's
largest-remainder rounding of weight × 60, the same rule `weightedCounts` in `lib/claude/assessment/forms.ts` uses.

### Objectives (skill statements), verbatim

Domain 1 · Advanced Agent Architecture and Orchestration (17%), p. 4–5
- **1.1 Multi-Agent Orchestration.** Evaluating orchestration patterns for production multi-agent designs and inter-agent failures, including supervisor/worker hierarchies, parallel subagent dispatch, delegation and context-isolation boundaries, inter-agent communication, and human-in-the-loop and approval flows.
- **1.2 Durable Execution and State Management.** Applying session persistence, checkpointing, resumability, and memory architecture patterns to long-running agents that must survive interruption, restart, and model version change.
- **1.3 Architecture Selection at Scale.** Evaluating production cost, reliability, and quality data to decide whether to evolve a running system between workflow and agentic patterns, and selecting the agent harness, framework, and reusable-pattern standards a team should adopt.
- **1.4 Context and Memory Architecture.** Evaluating context-policy options for long-running agents approaching context limits or cost ceilings, including context compaction and editing, persistent memory, cache-safe instruction changes mid-conversation, and tool-use techniques that keep large tool catalogs out of the context window.

Domain 2 · Production Integration, Reliability, and Knowledge Grounding (20%), p. 5
- **2.1 Reliability Engineering for Claude Services.** Evaluating and applying resilience patterns for production Claude integrations, including retry and backoff design, circuit breakers, graceful degradation, and cross-model, cross-region, and cross-platform fallbacks that distinguish rate limits from safety refusals from context-window stops while respecting per-platform feature parity.
- **2.2 Scale and Throughput Management.** Analyzing rate-limit strategy, queueing and backpressure, batch pipeline design, multi-tenant quota and isolation, and capacity planning for high-volume Claude workloads, and identifying whether rate limits, token throughput, or batch economics is the binding constraint.
- **2.3 Production MCP and Change Management.** Applying production MCP operation and change-management practice to MCP server deployments, model version migrations, and prompt updates, including remote MCP deployment and authentication, tool and schema versioning, migration testing against breaking behavior changes, platform-specific configuration parity and gateway/routing architectures, prompt versioning, and progressive rollout with rollback.
- **2.4 Retrieval and Knowledge Grounding at Scale.** Evaluating retrieval architecture for knowledge-grounded production applications, including agentic search versus RAG tradeoffs, chunking and embedding strategy, hybrid search, and reranking, and designing grounding practices such as source citation, uncertainty declaration, and confidence signals, and diagnosing retrieval-quality failures by stage.

Domain 3 · Observability and Production Monitoring (12%), p. 6
- **3.1 Telemetry and Instrumentation.** Applying instrumentation practice to production Claude systems under debuggability and privacy requirements, including distributed traces for agent loops and tool calls, token and cost metrics, cache-performance diagnostics, grounding and reasoning traceability, structured log events, and content-capture configuration under privacy constraints such as zero-data-retention.
- **3.2 Production Monitoring and Alerting.** Analyzing production signals from LLM-backed services to define service level indicators (SLIs) and SLOs, design alerting and dashboards (including token and cost telemetry), and detect quality drift, behavioral regressions, and anomalous usage, including drift after model updates.
- **3.3 Trace Analysis at Scale.** Analyzing high-volume trace data using sampling strategies, aggregation, and failure-cohort analysis to surface and quantify systemic issues that are not visible in individual traces.

Domain 4 · Advanced Debugging and Incident Response (10%), p. 6
- **4.1 Complex Failure Diagnosis.** Analyzing evidence from complex production failures, including multi-turn, multi-agent, and non-deterministic failures, to isolate the problem origin among model output, agent harness, tools, and data, including model refusals as a failure class and retrieval-grounding failures.
- **4.2 Incident Response and Learning Loops.** Evaluating incident-response options during an LLM-system outage or quality regression, including triage, mitigation, rollback, and communication, and converting the incident into regression evaluations, monitoring coverage, and postmortem findings.

Domain 5 · Evaluation Engineering and Quality Assurance (12%), p. 6–7
- **5.1 Evaluation System Design.** Evaluating and designing offline evaluation systems for Claude applications, including golden sets, regression suites, behavioral checks, CI/CD evaluation gates, retrieval precision and groundedness metrics, and release criteria for prompt, model, and agent changes, and maintaining suite validity over time against contamination, saturation, and coverage gaps.
- **5.2 LLM-as-Judge Engineering.** Analyzing LLM-as-judge evaluator quality against human-labeled data, including calibration, rubric design, bias and position effects, inter-rater reliability, and judge drift across model versions.
- **5.3 Online Quality Measurement.** Analyzing quality on live production traffic using online evaluation techniques, including live-traffic sampling, A/B testing, feedback loops, and metric selection matched to task type (extraction, generation, agentic, retrieval-grounded).

Domain 6 · Cost and Latency Optimization at Scale (8%), p. 7
- **6.1 Cost Architecture at Scale.** Evaluating fleet-level optimization strategies using usage and cost data, including cost modeling and forecasting, model routing and cascades across the Claude model family, caching strategy and cache diagnostics, batch-versus-realtime economics, and per-tenant budget enforcement.
- **6.2 Latency Engineering.** Analyzing the latency profile of a Claude application against a latency target, distinguishing time-to-first-token from total latency, and applying streaming, parallel tool execution, cache checkpointing, and effort-level tuning.

Domain 7 · Runtime Guardrails and Production Security (11%), p. 7–8
- **7.1 Runtime Guardrail Systems.** Evaluating layered guardrail architectures against a production agent's risk profile, including input/output filtering, PII redactors, hook-based policy enforcement, destructive-action prevention, sandboxing that grants tool and web access without exposing production systems, approval gates, refusal handling and safety fallbacks, deterministic enforcement for irreversible actions, and false-positive/false-negative tuning.
- **7.2 Threat Defense and Adversarial Testing for Agentic Systems.** Analyzing the attack surface of tool-using agents that process untrusted content, including prompt injection, tool and memory poisoning, data exfiltration paths, unsafe-autonomy conditions, and the high-risk combination of private data access, untrusted input, and external communication, and applying defense-in-depth mitigations, red-team exercise design, and secure MCP configuration, drawing on the OWASP Top 10 for LLM Applications and the NIST AI Risk Management Framework and its Generative AI Profile.
- **7.3 Identity, Secrets, and Audit at Scale.** Applying enterprise identity and secrets practice to production Claude deployments, including agent identity, workload identity federation replacing static API keys, credential and secrets management, least-privilege tool permissioning, and audit logging of security-relevant agent actions.

Domain 8 · Agent Fleet Operations for Software Delivery (10%), p. 8
- **8.1 Parallel Agent Orchestration for Engineering Work.** Evaluating parallel fan-out patterns for large engineering tasks, including parallel agents on isolated worktrees, task decomposition, and merge and conflict strategy, and diagnosing fleet-level failure modes from fleet telemetry.
- **8.2 Verification and AI Code Review Operations.** Analyzing verification operations in delivery pipelines where generation outpaces review, including AI code review introduced in shadow mode, calibration against human review before merge gating, and human oversight design.
- **8.3 Unattended and Event-Driven Agent Operations.** Applying unattended-operation patterns to goal- or schedule-driven engineering tasks, including agents running toward goals, on schedules, or as event-driven responders such as CI/CD incident first response, with checkpointing, notification, and escalation design.
- **8.4 Organization-Wide Coding Agent Configuration.** Applying enterprise configuration for organizations adopting coding agents, including managed settings and policies, MCP allowlists, telemetry, gateway routing, and governance with a quality and safety bar for sharing prompts, Skills, and MCP servers across teams.

Totals: 8 domains, 25 skill statements (4, 4, 3, 2, 3, 2, 3, 4).

## 4. How to prepare (p. 8–9)

No single required course; Anthropic does not guarantee any resource ensures a pass. The guide recommends: study the
blueprint and self-assess; review the CCDV-F guide, whose scope "is assumed knowledge for this exam"; review official
documentation for the Claude API, Agent SDK, Claude Managed Agents, Claude Code (hooks, Skills, plugins, headless
operation) and MCP, and first-party versus cloud-platform differences; operate a tool-using agent in production with
distributed tracing and cost telemetry, SLIs and SLOs, a release-gating eval suite, layered guardrails, and an
incident and postmortem practice; practise the Professional competencies (multi-agent and non-deterministic failure
diagnosis from traces, judge calibration against human labels, fallbacks and backpressure, context and memory
policies, fleet cost and latency modelling, red-teaming a tool-using agent, parallel and unattended coding agents);
complete the Section 7 sample questions.

## 5. Sample questions (p. 9–11)

The guide calls these "illustrative items" that "are not drawn from the live item bank". All three are single-answer,
four options, no block exhibits. Answer keys and rationales are on p. 11. CertCity does not reproduce them as practice
items; they inform item style only.

| # | Domain | Scenario (summary) | Key | What the rationale says |
|---|---|---|---|---|
| 1 | 2 | A fallback policy retries every failure against a second model with exponential backoff. After a model update: cost spike, shorter fallback answers; traces mix rate-limit errors, max-length stops and declined requests in one retry path | B: branch on the stop condition (back off rate limits, raise the output budget on length stops, route declines to a safety path) | One undifferentiated retry path is the root cause. More retries amplify cost; permanent rerouting and disabling the fallback trade one failure for another |
| 2 | 5 | A pairwise LLM judge gates prompt releases; every candidate passes; judge agrees with humans only slightly more than half the time and favours the first-shown response | C: randomize order, re-measure agreement against human labels, withhold gating authority until agreement is acceptable | Position bias and poor calibration; changing format or judge model "may help later but does not establish calibration"; lowering the threshold makes an uncalibrated gate more permissive |
| 3 | 7 | Support agent reads tickets, has CRM access and an email tool; a red-team ticket makes it email another customer's record externally; a system-prompt rule was already added | A: recipient allowlisting or human approval on the email tool, and CRM access scoped to the ticket's account | Private data + untrusted input + external channel; a deterministic control outside the model closes the path; a stronger prompt is not enforceable, lower effort does not remove capability, logging detects rather than prevents |

Style observations (from `research/exam-realism.md` §2, measured on these three items): median stem 77 words, options
about 20 words, every stem cites observed evidence, low identifier density (0.6 named terms per 100 words),
distractors drawn from "more retries", "bigger model", "stronger prompt", "log it".

## 6. What the guide does not say

- No per-objective weights below the domain level, no scenario bank, no exhibit policy, no multi-response share. The
  format line says multiple-response items exist and each item states how many to select.
- No list of named products per objective beyond the preparation section's list (Claude API, Agent SDK, Managed
  Agents, Claude Code with hooks, Skills, plugins and headless operation, MCP).
- No candidate reports existed when this file was written (`research/exam-realism.md` §3).

## 7. How CertCity maps the guide

- Track: `lib/claude/tracks/developer-professional.ts` (id `developer-professional`, 70 items, $175).
- Objective ids are `<domain>.<position>` in guide order, e.g. 2.1 = Reliability Engineering for Claude Services.
- Practice exam forms: 70 items, 60 scored + 10 marked `pilot` (unscored), scored counts [10, 12, 7, 6, 7, 5, 7, 6].
- Item style follows the CCDV-P row of `research/exam-realism.md` §6: 70–100-word evidence-bearing stems, about
  20-word options, 10–20% "Select TWO" items, a rationale for every option.
- Practice exam 3 draws from a separate 70-item reserve (`lib/claude/assessment/recovery-developer-professional.ts`);
  domain reassessments draw from a 40-item pool (`focused-developer-professional.ts`).
- City: starter lab `stadium-fallbacks` at Busch Stadium (2.1, 2.2) plus four workbench missions at nearby venues that
  together cover all 25 objectives (`lib/claude/developer-professional-missions.ts`).
- Hands-on lab and 7-day review lab: `lib/claude/capstones/developer-professional.ts` (Meridian Health claims
  assistant, then Lakeside Credit Union dispute assistant).
- Single guide version: CCDV-P has no December 7 revision, so it uses the app's "july-2026" version key internally and
  shows "Exam guide v1.0 · November 2026".
