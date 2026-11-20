# B · Game design document

**Design target · November 12, 2026**

## The experience

CertCity is a browser-based professional simulation set in a living city. The player takes a role from their certification pathway, starting as an AI solutions architect. They explore the city, meet the people who live and work there, take on problems, and return to places that reflect their decisions. The system view lets the player isolate the part they can change. The certification guide determines which distinctions the interaction must preserve. [CCAR-F exam guide, July 2026, §§5–8](https://github.com/Amey-Thakur/CLAUDE-CERTIFICATIONS/blob/main/architect-foundations/exam-guide.pdf), [Two Point Hospital](https://store.steampowered.com/app/535930/Two_Point_Hospital/), [Mini Metro](https://store.steampowered.com/app/287980/Mini_Metro/)

The smallest satisfying interaction is to snap a recovery route into place, send a single test ticket, and watch it arrive at the expected station. Drag is an optional shortcut. Click or tap a condition, select a destination and apply it to perform the same edit. The first attempt uses a clear symptom and a couple of cases. Later assignments involve competing policies, mixed inputs, exceptions, and stronger technical specificity. [Mini Metro](https://store.steampowered.com/app/287980/Mini_Metro/), [Chernikova et al., 2020](https://doi.org/10.3102/0034654320933544), [W3C dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements)

| Stage | What the player does | What the game returns |
|---|---|---|
| Discover | Explore the city, select a person or place, or resume an active assignment. | A glimpse of everyday activity and a request from the person affected when a job is available. |
| Investigate | Follow three tickets, inspect evidence and ask staff about constraints. | Case details, system behavior and explicit policy, with a worked example on request. |
| Change | Choose a response contract, route outcomes, set the retry limit and preview a test. | Acknowledgment on the system, with one trace showing the causal change. |
| Run | Predict the change, replay a sample and compare a full simulated workload. | Terminal states, exceptions, capacity and direct cost, with the baseline on the same workload. |
| Debrief | Compare two cases, attach a rationale, inspect the real terminology and contract. | Codex entry, saved project and feedback on the reasoning. |
| Return | Take a new job or a short delayed assessment. | A different use of the same principle or an adjacent professional problem. |

### Progression and economy decisions

- **Scenario constraints** include retry budget, limited staff time, permissions and service deadlines when the mechanics model them. Use fictional dollars and minutes with assumptions exposed. Introduce one binding constraint at a time. [OpenTTD mechanics](https://wiki.openttd.org/en/Manual/Game%20Mechanics/), [AWS retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- **Player progression** begins with a project portfolio, an institution before/after state and assignment access. Record project evidence, decisions and remaining limitations. A modest reputation layer can later surface harder jobs if playtests show it gives the work continuity. Practice and technical notes remain accessible when a player struggles. [Sailer and Homner, 2020](https://d-nb.info/1202307655/34), [Testing Standards](https://www.apa.org/science/programs/testing/standards)
- **Institution progression** persists the approved configuration and visible improvements. Resume shows the scene as left, with ambient activity and a recorded run. New demand arrives as an authored challenge. The first neighborhood shows several kinds of places and people. One assignment has full investigation, simulation and assessment. Other locations can show their activity and the people a future assignment would involve. [Zynga developer retrospective, 2010](https://media.gdcvault.com/GD_Mag_Archives/GDM_August_2010.pdf), [Zynga FarmVille 2, 2012](https://www.globenewswire.com/news-release/2012/09/05/489072/19100/en/zynga-reimagines-social-games-with-the-launch-of-farmville-2.html)
- **Future systems** include additional neighborhoods, missions that connect people and institutions, optional office customization and cooperative case discussion. Each should earn its place through a learning or retention test. A premium currency, salary grind, gifts required for progression, and countdowns tied to real time have no job in the slice. Resource and time constraints belong to the simulation clock. [Zynga SEC filing](https://www.sec.gov/Archives/edgar/data/1439404/000119312512128284/d312579ds1a.htm), [Bogost, Cow Clicker](https://old.bogost.com/games/cow_clicker), [FTC dark patterns](https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf?date=2024-10-09)

## The city

Neighborhoods mix residential, commercial, civic and institutional life. A resident can ask for help with a personal workflow or appear as a customer, employee or parent in another assignment. Schools and businesses have different rhythms, visible routines and constraints. Let players open a brief place or person detail from the map, then return there to see what changed after a job. A workplace incident can affect other people in a later mission when that relationship makes the problem clearer. [The Sims 4 Build Mode](https://www.ea.com/en-gb/games/the-sims/the-sims-4/media-hub/media/the-sims-4-build-mode-official-gameplay-trailer), [Two Point Campus](https://store.steampowered.com/app/1649080/Two_Point_Campus/)

| Place or person | Everyday activity | Possible assignment |
|---|---|---|
| Restaurant | Staff receive orders, manage bookings and check supplier deliveries. | Catch invoice totals that look valid but disagree with the source document. |
| School | Students arrive and the front office handles family questions. | Route enrollment questions to the right source and escalate unclear policy to staff. |
| Corporate office | Teams ship software and review changes. | Configure an independent review step and reduce duplicate findings. |
| Neighborhood repair shop | The owner checks inventory and schedules jobs. | Give an assistant distinct tools for looking up parts and booking service. |
| Resident who works independently | A freelance designer manages incoming briefs and follow-ups from home. | Keep confirmed deadlines and project details available across a long conversation. |
| City Dispatch | Workers sort local deliveries and help customers track orders. | Investigate the missing shipment in the first playable mission. |

The settings and job examples are design proposals. Assignments teach and assess a specific decision. The city supplies the people, routines and context that make it matter. [CCAR-F guide, §§5–8](https://github.com/Amey-Thakur/CLAUDE-CERTIFICATIONS/blob/main/architect-foundations/exam-guide.pdf)

## Playable mission · The missing shipment

**Primary objective** CCAR-F task 2.2, guide pp. 9–10. **Adjacent practice** task 5.3, guide p. 21, only in a later coordinator extension. The MVP single-agent mission cannot supply independent evidence for multi-agent propagation. **Target session** 12–18 minutes, a product hypothesis. **Play space** City Dispatch, a parcel depot with a raised office, support desks, dispatch doors and a marked request station. [CCAR-F guide](https://github.com/Amey-Thakur/CLAUDE-CERTIFICATIONS/blob/main/architect-foundations/exam-guide.pdf), [MCP tool spec](https://modelcontextprotocol.io/specification/latest/server/tools)

### Opening and investigation

The player selects the depot from the city view and accepts the invitation. Inside, a support ticket reaches the lookup station and exits as “Order not found.” Another ticket from a customer with a known shipment comes out with the same status. The player can pan to see the support queue, select an incident in the list or inspect the ticket in place. The City button returns to the neighborhood map. A returning player can resume the job directly.

| Stakeholder | Facts available | Interaction |
|---|---|---|
| Nia, support lead | Valid no-match tickets should be closed with a helpful clarification. False no-match messages generate six minutes of follow-up each. | “Show me a disputed ticket” and “What qualifies as a manual case?” |
| Arun, integration engineer | Gateway events record service outcome before the assistant collapses responses. The lookup is read-only and a short timeout sometimes clears on one additional attempt. | “Inspect raw return” and “Show the maintenance window.” |
| Jo, operations lead | An account outside permitted scope may receive a neutral denial. Identity and access rules stay fixed. At most one automatic retry, with a bounded delay, is available on this shift. | “What is the retry policy?” and “What can the customer see?” |

All three facts are reachable through case cards. Dialogue can restate them in character. The inspection timeline shows five cases, with hits and successful empty results distinguished from timeouts, malformed input and denials in the source events. Before the attempt, natural language and evidence fields take precedence. The canonical terms can be found in the optional technical inspection and are explicitly taught after the run. [Loibl et al., 2017](https://eric.ed.gov/?id=EJ1159862), [Goldstone and Son, 2005](https://doi.org/10.1207/s15327809jls1401_4)

### Action surface and rules

The station sequence is **Intake → Order lookup → Recovery rules → Customer reply or support desk**. Case records show timestamps, request ID, observed source status and downstream reply. Choose a “single fallback” or “typed response” contract at the order lookup, then assign actions to named conditions. Valid destinations include found response, no-match response, retry once, ask for a corrected identifier, deny safely, and manual review. Hits always route to the found response. Fixture permissions remain enforced by the tool. An attempted policy route that would need restricted data is blocked and shown as a misconfiguration. Simulation control offers one-ticket preview, Run Shift, pause/step and before/after comparison. Undo edits in the draft. Save an approved run to the portfolio. [CCAR-F §6 task 2.2](https://github.com/Amey-Thakur/CLAUDE-CERTIFICATIONS/blob/main/architect-foundations/exam-guide.pdf), [MCP tool spec](https://modelcontextprotocol.io/specification/latest/server/tools), [AWS retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

| Input fixture | Recommended rule | Consequence of an alternative |
|---|---|---|
| Lookup succeeds with a matching authorized order | Found response with permitted fields. | Fixture hit serves as a control case. |
| Lookup succeeds with zero rows | Confirm no match and offer a safe next step. | Blanket retry returns zero rows again and incurs one more call. |
| Lookup times out | Try once with bounded backoff on this read-only operation. If it fails again, acknowledge unavailable and hand off with the attempt history. | Returning no-match misleads customers. Repeated retries exceed the shift rule. Blanket manual review consumes avoidable staff capacity. |
| Identifier fails validation | Ask for a corrected identifier and perform a new lookup only when a correction is supplied. Hand off unresolved cases in this scenario. | Retry with the same identifier fails. Calling it empty hides the input problem. |
| Request lacks permission | Provide the allowed neutral denial or an approved handoff when policy requires one. | Retry has no effect. Responding with an inferred order detail is blocked. |
| Supplemental policy violation, outside the economic batch | Return a non-retryable structured business error and a customer-safe explanation. Escalate when policy specifies an exception route. | Categorizing a policy rejection as transient sends it into a retry cycle. |

The first run uses a few visible trace tokens with shape and label changes. Tap a stopped token to read the event. Then fast-forward across the full synthetic workload. If a novice cannot identify what changed, highlight the source observation, replay one comparison, and show a worked example. An expert can run the whole shift directly. The recovery exercise uses a new case that preserves the rule but changes the visible symptom. [Chernikova et al., 2020](https://doi.org/10.3102/0034654320933544), [Shute, 2008](https://myweb.fsu.edu/vshute/pdf/shute%202008_b.pdf)

### Concept bridge

After the first committed run, show the paired ticket outcomes side by side. Connect **successful empty result**, **tool execution error**, **transient**, **validation**, **permission**, **business rule**, and **retryability** to the station and disposition. An example field-level contract uses an MCP result with `isError: true` on a handled tool failure and application-defined structured metadata such as `errorCategory` and `retryable`. A successful no-match has an empty result set and no tool error. Transport and protocol failures are handled at the appropriate layer. The player inspects a redacted real-shaped result, predicts the next step from it, then saves a Codex entry. The documentation and lab should make clear which fields MCP defines and which the application defines. [MCP tool spec](https://modelcontextprotocol.io/specification/latest/server/tools), [CCAR-F §6 task 2.2](https://github.com/Amey-Thakur/CLAUDE-CERTIFICATIONS/blob/main/architect-foundations/exam-guide.pdf), [Fyfe et al., 2014](https://eric.ed.gov/?id=EJ1036777)

**Optional Exam Lens · Original practice item.** A museum's internal collection assistant checks whether a box contains a catalogued item. The same tool sometimes returns an empty inventory and sometimes cannot reach the catalog service. The assistant uses both results to answer “Nothing is recorded.” Which two changes make its responses reliable? Select two.

1. Mark a completed query with zero rows as a successful response and report the empty result.
2. Return a tool error with a retryable timeout category, and surface unavailability if the bounded retry fails.
3. Repeat every zero-row query once, then use the same empty response for both situations.
4. Ask a second language model to infer whether the first tool call completed from the user question.

**Key** 1 and 2. A genuine empty result establishes absence under the query. A timeout establishes uncertainty. Repeating valid empty results adds load, and the question provides no evidence about tool completion. Exam Lens pauses playback and restores focus on close. It can be opened before or after the attempt. Its exposure and related assistance are recorded as practice evidence. [CCAR-F §§3, 6](https://github.com/Amey-Thakur/CLAUDE-CERTIFICATIONS/blob/main/architect-foundations/exam-guide.pdf), [MCP tool spec](https://modelcontextprotocol.io/specification/latest/server/tools)

**Independent assessment prototype · Original transfer item.** A supplier compliance assistant reads a document index. A tool successfully finds zero attachments for one supplier. A second call for a different supplier returns an authorization failure. Users are allowed to know whether their search completed. What should the tool contract report for the two calls? Use an unseen domain and different response surface in the live form.

- A. Return empty arrays for both and show the same message.
- B. Return successful empty results for the first call and a non-retryable permission error with a permitted explanation for the second.
- C. Retry both calls with the original input before deciding which supplier is missing attachments.
- D. Return a validation error in both cases and ask users to re-enter the supplier name.

**Key** B. The live version of this item family must be held out from the playable mission and Lens. This published example is for review. Pair with an independently authored rationale or case trace on the distinction and a delayed variant using a recoverable timeout. Score the exam-format selection separately from the rationale with an anchored rubric covering observed state, permitted response, and rejected alternative. [Butler, 2010](https://pubmed.ncbi.nlm.nih.gov/20804289/), [Testing Standards](https://www.apa.org/science/programs/testing/standards)

### Economic model · One modeled week

All figures are synthetic. One batch is 1,000 requests in a modeled week, with the same fixture schedule for baseline and interventions. Service calls cost $0.002 each, including validation and denied calls in this simplified price model. One support follow-up costs six minutes of staff capacity. Loaded labor is $36/hour for capacity valuation, and a full-time week is modeled as 40 hours. Typed response support incurs $10/week of added operating cost and a $600 one-time deployment. The game UI makes these editable content parameters visible in the assumption drawer. The MVP omits estimates for revenue and satisfaction until there is a documented conversion model. [OpenTTD mechanics](https://wiki.openttd.org/en/Manual/Game%20Mechanics/), [SimPy shared resources](https://simpy.readthedocs.io/en/latest/), [AWS retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

| Initial outcome | Count | Additional fixture facts |
|---|---:|---|
| Hit | 720 | Authorized match. |
| Valid empty | 120 | Repeating produces the same empty result. |
| Transient timeout | 100 | 80 recover on one retry, 20 still time out. |
| Invalid identifier | 40 | 30 supply a corrected ID that yields a hit, 10 need a manual follow-up. |
| Permission denied | 20 | A neutral denial is a correct disposition for these fixtures. Repeating the unchanged request fails. |

| Outcome per week | Existing single fallback | Blanket retry once for every non-hit | Typed response and routed recovery |
|---|---:|---:|---:|
| Total lookup calls | 1,000 | 1,280 | 1,130 |
| Retry calls on unchanged input | 0 | 280 | 100 |
| Corrected-input calls | 0 | 0 | 30 |
| False no-match messages | 160 | 80 | 0 |
| Correct terminal dispositions without staff intervention | 840 | 920 | 970 |
| Follow-ups | 160 | 80 | 30 |
| Staff hours | 16 | 8 | 3 |
| Call spend | $2.00 | $2.56 | $2.26 |
| Extra recurring infrastructure | $0 | $0 | $10.00 |
| Staff capacity value used | $576.00 | $288.00 | $108.00 |
| Modeled operating cost with labor value | $578.00 | $290.56 | $120.26 |
| Weekly improvement with labor value | — | $287.44 | $457.74 |
| Actual direct cash improvement with fixed payroll | — | −$0.56 | −$10.26 |

Baseline and blanket fallbacks emit misleading messages when a recoverable or inaccessible result is treated as missing. The typed policy has 830 found results including 30 corrected and 80 recovered, 120 valid no-match results, and 20 safe denials. Its 30 manual cases are 20 exhausted timeouts and 10 unresolved validations. Each policy ends with 1,000 terminal dispositions when follow-ups are included. A safe denial contributes to disposition accuracy and is reported separately from a successful lookup. Actual disclosures stay zero because the backend fixture enforces access for every policy.

**Metrics and formulas**

- **Operating cost** is `calls × unit cost + follow-ups × minutes ÷ 60 × loaded rate + recurring infrastructure`. Typed cost is `1,130 × $0.002 + 30 × 0.1 h × $36 + $10 = $120.26`.
- **Freed capacity** is `(160 − 30) × 6 ÷ 60 = 13 h`. That is 0.325 of a modeled 40-hour week. Manual workload falls 81.25%. This measures capacity available for other work. Avoided hiring requires a separate sustained-demand model and evidence that a planned hire can be avoided. Payroll is held fixed here.
- **SLA and throughput** are separately scoped. The table measures cases dispositioned by staff and automation. It does not estimate per-hour throughput or waiting time. For timed playback, queue timestamped arrivals in stable order and compute resolution time from arrival to terminal outcome. Add a capacity model and show median and P95 only after validating arrival patterns and schedules. For example, an illustrative single-station queue with 8 simultaneous manual cases and one free worker at six minutes per case completes at 6, 12, …, 48 minutes. Changing worker availability changes waiting time and leaves total work minutes intact.
- **ROI** at week 13 uses `(13 × recurring net improvement − setup) ÷ setup`. If all freed hours have productive use valued at the modeled rate, the modeled return is 891.77%. With fixed payroll and no avoided variable labor, 13-week incremental cash impact is −$733.38 including setup. If a separate scenario actually displaces 4 paid overtime hours at $45/hour each week, weekly net cash improvement is $169.74 and simple cash payback is about 3.54 weeks. Label the assumptions next to the metric and lead with hours and direct spend.
- **Sensitivity**: at 10% recovery of 100 timeouts and the same correction rate, typed manual cases rise from 30 to 100. The capacity improvement versus baseline drops to 6 hours and the incremental direct cash cost remains $10.26. At scale a retry storm can couple outcomes. Use shared availability fixtures and the same workload for each policy, then add simulated congestion only if it changes the professional decision. [AWS retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

**Sample ordered events.** For case T-17, first lookup returns timeout at 500 ms. Policy waits an illustrative 200 ms, attempts once, then returns a hit 150 ms later. T-18 times out twice and enqueues a follow-up with the attempt record. E-12 returns a successful empty list and a no-match reply. P-09 records a permission failure and a neutral denial. V-04 records invalid input, receives a corrected identifier in the synthetic scenario and performs a new lookup. Cases maintain stable IDs and trace order.

**Acceptance for this shift.** Zero false no-match messages, zero requests outside scope disclosed, no more than one automatic retry on the same read-only request, no more than 150 extra lookup calls, and at most four follow-up staff hours. A safe manual-first strategy can avoid false statements but exceed the workload budget. Run repeated safe checks against independently authored fixtures. Incorrect actions stay reversible and can be compared to a known baseline. The game logs the chosen policy, prediction, observed traces and assistance as separate evidence. Completing the shift unlocks a follow-on job that adds a coordinator and a second lookup source, which specifically practices task 5.3. [CCAR-F tasks 2.2 and 5.3](https://github.com/Amey-Thakur/CLAUDE-CERTIFICATIONS/blob/main/architect-foundations/exam-guide.pdf)

## Additional gameplay mechanics

| Mission | Physical action | Technical decision | Institutional signal |
|---|---|---|---|
| Returns office · 1.4/1.5 | Place a gate before a refund station and fit a timestamp adapter at a tool boundary. | Choose pre-call enforcement versus post-call normalization and send a complete exception handoff. | Policy violations blocked, eligible cases continue, reviewer has the facts. |
| Release room · 3.1/3.3/3.6 | Place config cards in a file tree, change a path, send a synthetic PR through two review stations. | Select CLAUDE.md versus a scoped rule or reusable Skill, set noninteractive flags and isolate the reviewer. | Rule appears only in intended files, pipeline finishes, duplicates fall. |
| Invoice intake · 4.3/4.4/5.5 | Fit a schema template to a document, inspect the validation bench, sample high-confidence segments. | Distinguish syntax from semantic checks, use null when absent, correct a validation failure and calibrate human review. | Totals reconcile, dubious fields hold, review queue stays within capacity. |
| Research archive · 1.2/5.3/5.6 | Staff an investigation desk with specialists and attach citations to evidence cards. | Route only the needed specialists, pass structured facts and partial failures, flag contradictions and dates. | Report coverage and citation integrity are visible, with failure gaps explicitly marked. |
| Case history · 5.1/5.2 | Pin source facts, remove noisy payload fields, ask a clarifying question, send a handoff. | Preserve necessary state across context compaction and choose between clarification, action and escalation. | Decision remains tied to the correct account, amount and policy. |

## Learning and outcome surfaces

Institutional Impact shows a before/after and an assumption drawer. The professional competency profile shows what the player can explain or do, with context and support level. The readiness view shows first-seen independent evidence, assessed objective coverage and retention. After one mission it should say “Limited evidence” and show the specific distinctions measured. A passing shift can coexist with weak technical recognition. See [E](E-technical-architecture.md) for the estimator and [G](G-mvp-plan.md) for its validation. [Testing Standards](https://www.apa.org/science/programs/testing/standards), [Mislevy, 1994](https://www.cambridge.org/core/journals/psychometrika/article/abs/evidence-and-inference-in-educational-assessment/592B899A2036FE7CDD48F2B0880E6F82)

The Codex records one concept per entry, a screenshot or diagram anchor, an original example, one misconception, and official references. At a later session, recommend an unassisted probe for the oldest or weakest evidenced distinction and offer a varied practice case after it. Keep paid access separate from scores and learner access to evidence. [Cepeda et al., 2008](https://pubmed.ncbi.nlm.nih.gov/19076480/), [Roediger and Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x)
