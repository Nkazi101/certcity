// Developer Professional (CCDV-P) city missions after the stadium starter lab. The downtown venues share one guest
// platform team that runs Claude systems in production: an event agent, box-office incident tooling, a plaza assistant
// under evaluation, and a coding-agent fleet. Exported here and spread into the shared registries.
import type { TrackId } from "./blueprints";
import { banks } from "./banks";
import { caseQuestions } from "./assessment/cases";
import type { CaseQuestion } from "./assessment/cases";
import { decision, workbench } from "./missions";
import type { Decision, Mission } from "./missions";
import type { PracticeItem, sources } from "./items";
import type { MissionExperience, MissionInterview } from "./mission-experiences";

type Job = {
  id: string; place: Mission["place"]; title: string; brief: string; specialist: string;
  requires?: string[]; stations: readonly [Decision["objective"], string, string, string, string, string, string, string, string][];
};

function jobs(track: TrackId, entries: readonly Job[]) {
  return entries.map(({ stations, ...job }) => workbench({
    ...job, track, workload: `${stations.length} acceptance cases`, measure: "Cases meeting the job’s requirements",
  }, stations.map(([objective, station, evidence, current, before, proposal, after, alternative, consequence]) => {
    const item = banks[track].practice.find((entry) => entry.objective === objective)!;
    return decision(objective, item.id, station, evidence, [current, before], [proposal, after], [alternative, consequence]);
  })));
}

export const developerProfessionalMissions: Mission[] = jobs("developer-professional", [
  {
    id: "venue-agent-runtime", place: "enterprise-center", title: "Stabilize the event-day agent runtime",
    brief: "The arena’s guest agent reports failed lookups as answers, repeats refunds after restarts, and a prompt edit reached every guest at once.",
    specialist: "Morgan has orchestrator traces, a restart log, context usage by turn, the prompt release history and retrieval logs.", requires: ["stadium-fallbacks"],
    stations: [
      ["1.1", "Contain a failed worker", "The orchestrator fans out seat, parking and accessibility subagents. When parking timed out, 31 guests were told no parking was available.", "Retry every subagent until all three return", "One slow worker stalls every reply.", "Have each subagent return status, results and an error field, and report parking as unavailable when it failed", "Guests hear the lookup failed instead of a false answer.", "Give one agent all three tool sets", "Context grows and the timeout still reads as empty."],
      ["1.2", "Resume after a restart", "A deploy restarted the agent mid-refund. On resume it replayed the conversation and issued the same $84 refund twice.", "Restart the session from the first user message", "Side effects replay with the conversation.", "Checkpoint each side effect with an idempotency key and resume the stored session from the last checkpoint", "The refund runs once and the session continues.", "Ask the model to check whether it already refunded", "The model cannot see the payment system’s state."],
      ["1.3", "Choose the pattern from production data", "Traces show 92% of will-call requests make the same four tool calls in the same order. Agent runs cost six times a fixed pipeline.", "Keep the open-ended agent for every request", "Cost stays high on a path that never varies.", "Move the fixed will-call path into a code workflow and keep the agent for the 8% that vary", "Cost drops on the fixed path and varied cases keep their flexibility.", "Add three more subagents for will-call", "More orchestration on a fixed path."],
      ["1.4", "Keep long sessions inside the window", "By the third hour 70% of the context is old seat-map tool results. Season holders’ seating preferences must survive.", "Raise max_tokens", "The output budget does not shrink the input.", "Clear old tool results with context editing and keep holder preferences in the memory tool", "Context shrinks while the preferences persist.", "Drop the oldest turns in the harness", "Preferences stated early are lost with them."],
      ["2.3", "Ship the prompt change safely", "Prompt v12 reached all guests at once and doubled transfers to staff. Rollback took a 40-minute redeploy.", "Edit the production prompt in place", "There is no version to roll back to.", "Version prompts as release artifacts, roll out by percentage with a transfer-rate gate, and roll back by flag", "A bad version reaches a small cohort and reverts in seconds.", "Run the offline suite once more", "The suite already passed v12."],
      ["2.4", "Find where grounding broke", "The agent quoted an old bag policy. The current policy is indexed but ranked 14th of 20 retrieved chunks, and only the top 5 reach the model.", "Tell the model to prefer recent documents", "The current chunk never reaches the context.", "Inspect retrieval and ranking for the query and add an effective-date signal so current policy ranks first", "The current policy reaches the chunks the model reads.", "Switch to a larger model", "It still answers from the chunks it was given."],
    ],
  },
  {
    id: "theatre-incident-room", place: "stifel-theatre", title: "Run the incident room for the box-office agent",
    brief: "Box-office answers went wrong on a sold-out night, and nobody could tell which turns, which tool, or how many guests.",
    specialist: "Taylor has conversation logs without tool spans, the alert history, a cohort table and the incident timeline.", requires: ["stadium-fallbacks"],
    stations: [
      ["3.1", "Trace the agent loop", "Logs hold one line per conversation. Model requests and tool calls share no ID and carry no token counts.", "Log the final reply text per conversation", "You see what went wrong, not where.", "Emit one trace per conversation with spans for each model request and tool call, carrying token and cache usage", "Each failure can be followed step by step with its cost.", "Turn on full prompt capture everywhere", "Card numbers end up in the logging backend."],
      ["3.2", "Alert on what guests feel", "The only alert is API error rate above 5%. Wrong-seat answers rose from 1% to 9% with no API errors.", "Lower the API error threshold to 2%", "The regression produced no errors.", "Define an SLI for correct seat answers from judged samples of live traffic and alert on fast error-budget burn", "Quality regressions page on-call while the API looks healthy.", "Email a weekly cost report", "It arrives after the show."],
      ["3.3", "Find the failing cohort", "Individual traces look fine. 2% of 40,000 conversations failed overall.", "Read 20 random traces", "Rare failures are unlikely to appear.", "Group traces by venue, tool version and language and compare failure rates per cohort", "One cohort failing at 31% stands out.", "Keep 1% of traces at random", "Most failing traces are thrown away."],
      ["4.1", "Locate the wrong answer", "A guest was told row K is accessible. The seat-map tool returned row K with accessible false; the reply said it was accessible.", "Re-index the seat map", "The tool already returned the right data.", "Replay the turn with the recorded tool result and check what the harness passed to the model", "The fault is isolated between harness and model output.", "Point the tool at another database replica", "The data was never wrong."],
      ["4.2", "Close the incident properly", "Wrong-seat answers stopped after rolling back prompt v9. The team wants to close the ticket.", "Close the incident once the rollback is live", "The same change can ship again.", "Add the failing conversations to the release gate, add a monitor for the signal, and publish a postmortem", "The failure cannot pass the gate again unnoticed.", "Freeze prompt changes for a month", "Releases stop and the gap remains."],
    ],
  },
  {
    id: "village-quality-desk", place: "ballpark-village", title: "Measure and price the plaza assistant",
    brief: "Prompt releases pass a judge that agrees with staff 58% of the time, live quality is unclear, and the model bill doubled.",
    specialist: "Jordan has the golden set, judge agreement data, an A/B log, usage exports and latency traces.", requires: ["stadium-fallbacks"],
    stations: [
      ["5.1", "Gate releases on the right suite", "The golden set has 120 cases, all from opening week. Every candidate now scores 99%.", "Keep gating on the same 120 cases", "A saturated suite cannot tell candidates apart.", "Refresh the suite with recent sliced production cases, keep a regression set, and gate each slice on its own threshold", "The gate catches regressions in the requests guests send now.", "Raise the pass bar to 99.5%", "Same stale cases, tighter number."],
      ["5.2", "Calibrate the judge", "The judge agrees with staff labels on 58% of 200 transcripts and favours longer answers.", "Let the judge gate releases now", "Its verdicts are close to chance.", "Revise the rubric, control length bias, re-measure agreement on the labeled set, and gate only above the agreed target", "The judge earns authority with measured agreement.", "Swap in a larger judge model", "Agreement is still unmeasured."],
      ["5.3", "Read the live experiment", "An A/B test shows v4 at 82.1% and v3 at 81.6% after two weekdays. Daily rates swing 2 points and weekend traffic is missing.", "Ship v4 now", "The difference is inside the noise.", "Run to the pre-set sample size across weekend traffic and decide on the pre-registered metric", "The decision reflects the real traffic mix.", "Count thumbs-up clicks instead", "Feedback is sparse and skewed."],
      ["6.1", "Cut cost without losing quality", "cache_read_input_tokens is near zero: the 12,000-token venue guide sits after a per-request timestamp. Nightly reports run as live requests.", "Move every request to a smaller model", "Hard requests lose quality.", "Put the venue guide before the cache breakpoint and send nightly reports through the Message Batches API", "Cache reads replace writes and nightly work costs half.", "Cut the venue guide in half", "Guests lose answers it covered."],
      ["6.2", "Fix the slow start", "p95 time to first token is 6.1 s against a 2 s target. Total time is within target. Responses are not streamed.", "Set effort to low on every request", "Answers may get worse while nothing appears sooner.", "Stream the response and keep the stable prefix cached", "The first words appear sooner.", "Raise max_tokens", "It does not move the first token."],
    ],
  },
  {
    id: "pageant-agent-fleet", place: "pageant", title: "Govern the platform’s coding-agent fleet",
    brief: "Coding agents open more pull requests than reviewers can read, one nearly touched a production table, and teams share unreviewed MCP servers.",
    specialist: "Reese has hook logs, a red-team report, the CI secret inventory, fleet telemetry and a managed settings draft.", requires: ["stadium-fallbacks"],
    stations: [
      ["7.1", "Block the destructive command", "An agent ran a migration script against production during a fix. CLAUDE.md already says never to.", "Strengthen the CLAUDE.md warning", "It is guidance the model already missed.", "Add a PreToolUse hook that denies migrations targeting production and keep production credentials out of agent sessions", "The command is blocked before it runs.", "Review Bash history every week", "It finds the damage afterwards."],
      ["7.2", "Close the exfiltration path", "A red-team issue comment made the triage agent read a private repository’s .env file and post it to a public gist.", "Add a system prompt rule to ignore instructions in comments", "A prompt is not an enforced boundary.", "Remove the agent’s ability to post outside the organization and deny reads of secret files", "The injected instruction has no channel to use.", "Log every gist the agent creates", "It detects the leak after it happens."],
      ["7.3", "Replace the shared key", "CI in two clouds uses one long-lived Claude API key stored in 25 repositories. A build log leaked it last month.", "Rotate the key monthly", "A static key is still there to leak.", "Use workload identity federation so each pipeline exchanges its OIDC token for short-lived credentials", "No static key exists to leak.", "Move the key into an environment variable", "It is still one long-lived secret."],
      ["8.1", "Fan out the migration", "Eight agents edited the same shared config file in one checkout, and three overwrote each other’s changes.", "Run eight sessions in one checkout", "Edits collide.", "Split the work along files that do not overlap and run each agent in its own worktree with a planned merge order", "Changes stay isolated and merge cleanly.", "Run the agents one after another", "Serial runs take eight times as long."],
      ["8.2", "Introduce AI review safely", "Agents open 60 pull requests a day and people review 15. The team wants AI review to block merges today.", "Make AI review a required check today", "Its precision is unmeasured.", "Run AI review in advisory mode, compare its findings with human reviews, and gate only on finding types with proven precision", "Gating authority follows measured agreement.", "Merge agent pull requests without review", "No one is accountable for what merges."],
      ["8.3", "Run the nightly fixer unattended", "A scheduled agent retried a failing test for six hours and opened 14 duplicate pull requests.", "Let it run until the test passes", "There is no stopping condition.", "Give it a verifiable done condition, a turn bound, one branch per run and a notification when it stops", "The run ends and someone is told.", "Run it only when someone is online", "It is no longer unattended."],
      ["8.4", "Set the fleet policy centrally", "Teams add any MCP server they find. Telemetry is configured per laptop and half the fleet exports nothing.", "Publish a wiki page of recommended servers", "Nothing enforces it.", "Deploy managed settings with an MCP allowlist, allowManagedMcpServersOnly and the telemetry variables", "Policy applies on every machine and local files cannot widen it.", "Put the allowlist in each repository’s .claude/settings.json", "Developers’ own settings can still add servers."],
    ],
  },
]);

type FollowupQuestion = readonly [
  objective: CaseQuestion[1], source: CaseQuestion[2], prompt: string, key: string, explanation: string,
  ...choices: (readonly [text: string, rationale: string])[],
];

function followup(mission: string, scenario: string, questions: readonly FollowupQuestion[]) {
  return caseQuestions(scenario, "", questions.map((question, index): CaseQuestion => [`${mission}-${index + 1}`, ...question]), "delayed");
}

/** Delayed questions for each CCDV-P mission, one per domain its stations touch, set away from the venues. */
export const developerProfessionalFollowups: Record<string, PracticeItem[]> = {
  "venue-agent-runtime": followup("venue-agent-runtime", "Regional airline rebooking agent", [
    ["1.2", "sessions", "An airline’s rebooking agent, built on the Agent SDK, runs up to 40 minutes per flight disruption. During a container restart, 12 sessions resumed by replaying their whole conversation, and 5 passengers received duplicate meal vouchers through the issue_voucher tool. Session transcripts were kept on the container’s local disk, so 3 other sessions could not be resumed at all. Which change lets the agent survive the next restart without repeating side effects?",
      "c", "A long-running agent survives interruption when its progress lives outside the process: persisted sessions it can resume, and side effects made idempotent so a replayed step does nothing twice. Reducing how often restarts happen, asking the model to remember, or abandoning the session all leave the duplicate-voucher path or lose work.",
      ["Raise the container memory limit and lengthen the restart grace period so fewer sessions are interrupted during routine deploys.", "Fewer restarts reduce how often this happens but leave local transcripts and the non-idempotent voucher call in place."],
      ["Add a system prompt rule telling the agent to check whether it already issued a voucher before it calls issue_voucher again.", "The model cannot reliably see what the voucher system already did, so a prompt rule does not prevent the duplicate."],
      ["Persist sessions outside the container and make issue_voucher idempotent with a key per passenger and disruption, then resume from storage.", "Stored sessions can be resumed after any restart, and the idempotency key turns a replayed voucher call into a no-op."],
      ["Start a fresh session after any restart and ask the passenger to repeat the request, so no earlier tool call is ever replayed.", "This avoids duplicates by discarding up to 40 minutes of work and making passengers start over."]],
    ["2.4", "retrieval", "The same rebooking agent answers fare-rule questions from a retrieval index. Passengers were told a nonrefundable fare allows free changes. The current fare rule is in the index, but for the failing queries the retrieval log shows it ranked 18th of 50 candidates by embedding similarity, and the generator reads only the top 8. The failing queries quote exact fare codes such as Y-NR. Which change addresses the failing stage?",
      "a", "Diagnose grounding by stage. The correct rule was indexed but never reached the model, so the fix belongs in retrieval and ranking. Exact identifiers like fare codes are where keyword search helps embeddings, and a reranker over the combined set lifts the right chunk into what the model reads.",
      ["Add keyword search alongside embeddings and rerank the combined candidates so exact fare codes such as Y-NR lift the current rule into the top 8.", "Hybrid search catches exact codes that embeddings blur, and reranking puts the current rule where the generator reads it."],
      ["Instruct the model to say it is unsure whenever a fare question mentions refunds, and route those passengers to the call center.", "This hides the retrieval miss by escalating every refund question, including the many the index could answer."],
      ["Increase the generator’s context to the top 50 candidates so the current rule is always included somewhere in the prompt.", "The rule would be present but buried among 49 competing chunks, at higher cost per question."],
      ["Re-embed the entire fare corpus with a newer embedding model and leave retrieval and ranking otherwise unchanged.", "A new embedding model may still blur exact fare codes, and nothing in the evidence points at embedding quality alone."]],
  ]),
  "theatre-incident-room": followup("theatre-incident-room", "Hospital appointment assistant", [
    ["3.2", "eval", "A hospital’s appointment assistant has one SLO: 99.5% API success. Last week, after a model update, the share of answers offering slots that were already booked rose from 0.5% to 6% for four days. API success stayed at 99.9% and no alert fired. A calibrated judge already grades a daily sample of transcripts, but nobody watches its results. Which monitoring change would have caught this regression?",
      "b", "SLIs should describe what users experience, not only what the API returns. A quality SLI fed by the judged sample, with burn-rate alerting watched closely after releases, catches a regression that produces no errors. Tighter availability targets, full logging and cost alerts each watch a different property.",
      ["Tighten the API success SLO from 99.5% to 99.9% so smaller availability dips page the on-call engineer sooner.", "API success never dropped. A tighter availability target still says nothing about wrong slots."],
      ["Add a correct-slot SLI from the daily judged sample and alert when its error budget burns quickly, especially after releases.", "The judged sample already measures the property that regressed; an SLI and burn alert turn it into a page."],
      ["Record every assistant response with its full text in the log store so engineers can search for complaints afterwards.", "Searchable logs help investigate after a complaint but do not detect the regression, and they store patient text."],
      ["Alert when daily token spend rises more than 20% above the trailing average, since model updates often change output length.", "Spend may not move at all when answers are wrong; cost is a different signal from correctness."]],
    ["4.1", "tool", "Patients were told a clinic is open on Saturday. The trace shows get_clinic_hours returned {\"saturday\": null}, which the scheduling system uses for a closed day. The harness converts null to the string \"see website\" before building the tool_result, and the model then wrote that the clinic is open. Replaying the same conversation gave the wrong answer 3 times in 5. Where should the fix go first?",
      "d", "Isolate the origin before changing the model. The data was right and the tool returned it; the harness mapping erased the meaning of null, and the model guessed from an ambiguous result. Fix the layer where correct information stopped being correct, then replay the recorded turn to confirm.",
      ["Switch to a larger model, since a stronger model would be less likely to invent opening hours from an unclear tool result.", "The model is being asked to guess from text that no longer says closed. The defect sits upstream of it."],
      ["Set temperature to 0 so the same conversation always gives the same answer when it is replayed.", "Current models reject sampling parameters, and consistency is not the problem: the result reaching the model is wrong."],
      ["Re-sync the clinic hours database from the scheduling system, because get_clinic_hours returned null for Saturday.", "Null is how the system marks a closed day, so the data was correct and a re-sync changes nothing."],
      ["Change the harness to pass a closed day as an explicit closed value, then replay the recorded turn to confirm the answer changes.", "The harness mapping is where closed became see website. Fixing it and replaying proves the cause."]],
  ]),
  "village-quality-desk": followup("village-quality-desk", "Insurance claims summarizer", [
    ["5.1", "eval", "An insurer gates prompt releases on a 300-case golden set built two years ago. The last six candidates all scored between 97% and 98%, yet adjusters report more errors on water-damage claims, which are now 25% of volume but 4% of the set. Some golden-set cases also appear word for word in the prompt’s few-shot examples. Which change restores the gate’s value?",
      "a", "A release gate is only as good as the suite behind it. This one is saturated, contaminated by its own examples, and missing the slice that grew. Refresh it from recent traffic, remove leaked cases, and give the large slice its own threshold so an average cannot hide its regression.",
      ["Refresh the set from recent sliced claims, remove cases that appear in the prompt, and gate water damage on its own threshold.", "This fixes saturation, contamination and the coverage gap together, so the gate can fail a candidate again."],
      ["Raise the overall pass threshold to 99% so only candidates that clearly beat the current prompt can be released.", "A higher bar on a saturated, contaminated suite measures the same stale mix more strictly."],
      ["Replace the golden set with a model judge scoring live traffic, since live traffic always reflects the current claim mix.", "An uncalibrated judge on live traffic scores after release and removes the offline gate entirely."],
      ["Add 300 synthetic cases generated from the existing set’s templates to double the size of the regression suite.", "New cases built from old templates repeat the old mix and still underrepresent water damage."]],
    ["6.1", "batch", "The summarizer handles 40,000 claims a month. 30,000 arrive overnight with a next-morning deadline; 10,000 are adjuster requests that need an answer within 20 seconds. Every request carries the same 9,000-token policy manual before the claim text, but usage shows cache_read_input_tokens at zero because a claim ID is inserted at the top of the system prompt. Which plan lowers cost the most without slowing adjusters?",
      "c", "Take the free wins first. Restoring the cache prefix cuts the repeated manual to a small fraction of its input price, and work that can wait overnight belongs in the Message Batches API at half price. Model swaps and trimming the manual trade quality for savings that were available without a trade-off.",
      ["Move all 40,000 requests to Claude Haiku 5.5, since its price per token is much lower than the current model’s.", "A model swap changes quality on every claim without measurement and leaves the cache defect in place."],
      ["Shorten the policy manual to 3,000 tokens by removing the sections that adjusters rarely cite in their reviews.", "Removing policy content risks wrong summaries, and the full manual would be cheap once it is cached."],
      ["Move the claim ID after the cached manual, and send the 30,000 overnight claims through the Message Batches API at half price.", "The fixed prefix becomes cache reads on every request, and overnight work gets the batch discount without touching adjusters."],
      ["Send all 40,000 claims through the Message Batches API so every request gets the batch discount, adjuster requests included.", "Batches run asynchronously and can take up to an hour or more, which breaks the 20-second adjuster deadline."]],
  ]),
  "pageant-agent-fleet": followup("pageant-agent-fleet", "Fintech platform engineering", [
    ["7.2", "safety", "A fintech’s coding agent reviews open-source dependency updates. It can read the internal monorepo, including service configuration files, and it can open issues on public GitHub repositories. In a red-team exercise, a package README told the agent to paste internal configuration into a public issue, and it did so in 3 of 10 runs. The team had already told it in CLAUDE.md to treat package content as data. Which control most directly closes the path?",
      "d", "Private data, untrusted input and an external channel together form an exfiltration path. Instructions are not boundaries, so remove or gate one leg in code: here, the public write and the secret reads. Lower effort, logging and stronger wording leave the capability in place.",
      ["Add a stronger system prompt rule telling the agent never to follow instructions found in package READMEs or documentation.", "The team already gave this instruction and it failed 3 times in 10. Prompt text is not an enforced boundary."],
      ["Log every issue the agent opens on public repositories and alert security when one mentions an internal hostname.", "Logging detects the leak after the data is public; it does not prevent the post."],
      ["Lower the agent’s effort level so it is less likely to follow multi-step instructions found in dependency documentation.", "Effort changes thoroughness, not authority. The agent can still read configs and post publicly."],
      ["Remove the agent’s permission to write outside the organization, and deny its reads of configuration secrets.", "Without the outbound channel and the secret reads, the injected instruction has nothing to exfiltrate and nowhere to send it."]],
    ["8.2", "eval", "The fintech’s coding agents now open 90 pull requests a week, and two senior reviewers can read about 30. An AI reviewer has run in advisory mode for three weeks. Compared with human reviews of the same 120 pull requests, its security findings matched the humans 94% of the time, while its style findings matched 41%. Leadership wants the AI reviewer to block merges. What should the team do?",
      "b", "Give an automated reviewer gating authority only where its findings are proven against human review, and keep people accountable for what merges. The evidence supports gating on security findings, not style. Gating everything, waiting longer despite evidence, or removing humans all ignore what the comparison shows.",
      ["Make every AI review finding a required check now, since it already reviews all 90 pull requests and people cannot keep up.", "Style findings matched humans only 41% of the time, so gating on them would block correct changes."],
      ["Let security findings block merges, keep style findings advisory, and keep humans accountable for approving merges.", "Authority follows the measured precision: 94% on security earns a gate, 41% on style does not."],
      ["Keep the reviewer advisory for another quarter and hire a third human reviewer to cover the backlog of agent pull requests.", "The three-week comparison already supports gating security findings; waiting leaves the backlog and the evidence unused."],
      ["Have the coding agents review each other’s pull requests and merge automatically when two agents approve the change.", "Agent-on-agent approval removes human oversight, and no comparison shows those approvals are reliable."]],
  ]),
};

const interview = (id: string, name: string, role: string, opening: string, question: string, reply: string, portrait?: string): MissionInterview => ({
  id, name, role, opening, question, reply, ...(portrait ? { portrait } : {}),
});

/** Arrival and stakeholder beats for each CCDV-P mission. Replies expose only facts in that mission's case. */
export const developerProfessionalExperiences: Record<string, MissionExperience> = {
  "stadium-fallbacks": {
    kind: "office", room: "Guest services control room", arrival: "Saturday’s first-inning log is on the main screen beside the reliability policy that ran during the game.",
    interviews: [
      interview("alex", "Alex Rivera", "Guest services coordinator", "Fans at the gates got error pages and directions that stopped mid-sentence on Saturday, and ticketing hit rate limits too. The assistant was making almost three model calls per question.", "What does guest services need from the assistant on game day?", "My operations note says the assistant shares one Claude API rate limit with ticketing, so it may average at most 1.5 model calls per guest question. Questions the model declines go to the guest-safety desk, and the note says what a guest sees when the assistant can’t answer. Next weekend is a doubleheader, and last season the primary model was overloaded for most of the second game."),
      interview("dev", "Dev Okafor", "Platform on-call engineer", "The deployed policy retries every failure four times on a one-second backoff, then switches to claude-haiku-5-5. Saturday’s log has more kinds of failure than that one path.", "What did the first responses in Saturday’s log look like?", "G-102 and G-109 got HTTP 429 with retry-after: 12, and G-105 and G-113 got HTTP 500. G-104 and G-112 stopped at max_tokens 1024 needing about 2600 and 2400 output tokens, G-107 came back with stop_reason refusal, and G-110’s 31 MB ticket photo got a 400 invalid_request_error. G-103, a ten-month season-holder thread, hit model_context_window_exceeded."),
    ],
  },
  "venue-agent-runtime": {
    kind: "office", room: "Event operations desk", arrival: "Orchestrator traces, a restart log and the prompt release history are pinned beside tonight’s event schedule.",
    interviews: [
      interview("morgan", "Morgan Ellis", "Event operations coordinator", "Thirty-one guests were told there was no parking when the parking lookup had only timed out, and one guest got the same $84 refund twice.", "What went wrong on the last event day?", "The parking subagent timed out and the orchestrator reported no parking for 31 guests. A deploy restarted the agent mid-refund and it repeated an $84 refund. Prompt v12 reached everyone at once and doubled transfers to staff."),
      interview("priyanka", "Priyanka Rao", "Platform engineer", "Most of what the agent does follows the same steps, and its context fills up by the third hour.", "What do the traces show about how the agent works?", "92% of will-call requests make the same four tool calls in the same order, at six times the cost of a fixed pipeline. By hour three, 70% of context is old seat-map results. The old bag policy reply came from a current policy ranked 14th of 20 chunks."),
    ],
  },
  "theatre-incident-room": {
    kind: "office", room: "Box-office incident room", arrival: "The sold-out night’s timeline, the alert history and a table of failure rates by cohort are on the wall.",
    interviews: [
      interview("taylor", "Taylor Lane", "Front-of-house coordinator", "Guests were sent to seats that were not accessible, and we could not tell how many or why.", "What did guests experience?", "Wrong-seat answers rose from 1% to 9% that night. One guest was told row K is accessible when the seat map said it is not. It stopped after the team rolled back prompt v9."),
      interview("marcus", "Marcus Webb", "Site reliability engineer", "Our only alert watches API errors, and the logs have one line per conversation.", "What can the team see today?", "The alert fires above 5% API errors, and there were none. Logs hold one line per conversation with no shared ID for model requests and tool calls. Overall 2% of 40,000 conversations failed, but single traces look fine."),
    ],
  },
  "village-quality-desk": {
    kind: "market", room: "Plaza assistant review table", arrival: "The golden set, a judge agreement sheet, an A/B log and last month’s usage export are spread across the table.",
    interviews: [
      interview("jordan", "Jordan Ellis", "Plaza events coordinator", "Every new prompt passes, but staff say the answers are not better, and the bill doubled.", "Why do staff doubt the release results?", "The golden set has 120 cases from opening week and everything scores 99%. The judge agrees with staff on 58% of 200 transcripts and likes longer answers. The latest A/B test ran two weekdays with no weekend traffic."),
      interview("ana", "Ana Torres", "Evaluation and cost lead", "Cache reads are near zero and guests wait too long before anything appears.", "Where are the cost and latency going?", "The 12,000-token venue guide sits after a per-request timestamp, so cache_read_input_tokens is near zero. Nightly reports run as live requests. p95 time to first token is 6.1 s against a 2 s target, and responses are not streamed."),
    ],
  },
  "pageant-agent-fleet": {
    kind: "workshop", room: "Platform engineering bay", arrival: "Hook logs, a red-team report, the CI secret inventory and a draft managed settings file are open on the bay’s screens.",
    interviews: [
      interview("reese", "Reese Lane", "Venue operations lead", "The agents work faster than we can review, and one of them nearly changed a production table.", "What worries you most about the fleet?", "An agent ran a migration against production even though CLAUDE.md forbids it. Agents open 60 pull requests a day and people review 15. A nightly fixer opened 14 duplicate pull requests, and eight agents in one checkout overwrote each other."),
      interview("kai", "Kai Brennan", "Security engineer", "The red team got a secret out through an issue comment, and our CI still uses one shared key.", "What did the security review find?", "A planted comment made the triage agent read a private .env file and post it to a public gist. One long-lived API key sits in 25 repositories and leaked in a build log. Teams add any MCP server they find, and half the fleet exports no telemetry."),
    ],
  },
};

type Debrief = { observation: string; implementation: string; transfer: string; references: readonly (keyof typeof sources)[] };

/** What each CCDV-P mission taught, in the shape of lib/claude/cases/debriefs.ts. */
export const developerProfessionalDebriefs: Record<string, Debrief> = {
  "stadium-fallbacks": {
    observation: "You gave each failure its own next step: a wait for the time the 429 asked, a larger budget for cut-off answers, the safety desk once for declined questions, compaction for long threads, and the busy reply instead of an error page, inside 1.5 calls per question.",
    implementation: "Branch on the error type and stop_reason before retrying. Honour retry-after, raise max_tokens on length stops, send refusals to a safety path (server-side fallbacks are the sanctioned way to try another model on a decline), compact before resending, cap extra calls with a retry budget, and open a circuit breaker on sustained 529s.",
    transfer: "When a scenario shows one retry wrapper for every failure, sort the failures by what the API returned and ask which ones a retry can fix. Then check whether extra calls fit the shared limit.",
    references: ["errors", "stop", "context"],
  },
  "venue-agent-runtime": {
    observation: "You made subagent failures explicit, checkpointed side effects so a restart could not repeat a refund, moved the fixed will-call path into code, trimmed stale tool results while keeping holder preferences, shipped prompts behind a gated rollout, and traced a grounding miss to ranking.",
    implementation: "Handoffs carry status and errors as data. Sessions persist outside the process and side effects use idempotency keys. Production traces decide where a workflow beats an agent. Context editing, memory and compaction each answer a different context problem. Prompts are versioned release artifacts with progressive rollout and flag rollback.",
    transfer: "When an agent gives a confident wrong answer, ask whether a worker failed silently, a step replayed, or the right source never reached the model, before changing the model or the prompt.",
    references: ["subagents", "sessions", "context", "retrieval"],
  },
  "theatre-incident-room": {
    observation: "You traced each model request and tool call in one trace, alerted on a guest-facing quality SLI, found the failing cohort by comparing groups, isolated the fault between harness and model by replay, and closed the incident with regression cases and a monitor.",
    implementation: "Instrument agent loops as spans with token and cache usage and capture content only where privacy allows. Define SLIs for what users experience and alert on error-budget burn. Aggregate traces into cohorts to see rare systemic failures. Replay with inputs held fixed to locate the origin.",
    transfer: "If an incident shows no API errors, look for a quality signal that moved. If a single trace looks fine, compare failure rates across cohorts before reading more traces one by one.",
    references: ["eval", "tool", "errors"],
  },
  "village-quality-desk": {
    observation: "You refreshed a saturated golden set, withheld gating from an uncalibrated judge, waited for an A/B test to cover the real traffic mix, restored the cache prefix and batched nightly work, and streamed responses to fix a slow first token.",
    implementation: "Gate releases on sliced, current suites. Trust a judge only after it agrees with human labels and its length bias is controlled. Decide experiments on pre-registered metrics and full traffic cycles. Put stable context before the cache breakpoint, batch work that can wait, and stream when time to first token is the problem.",
    transfer: "When a score looks good but users disagree, check what the score is measured against: a stale suite, an unmeasured judge, or a partial experiment. When cost rises, check cache reads and batchable work before changing models.",
    references: ["eval", "caching", "batch", "streaming"],
  },
  "pageant-agent-fleet": {
    observation: "You blocked production migrations with a hook, removed the exfiltration channel the red team used, replaced a shared key with federated credentials, isolated parallel agents in worktrees, kept AI review advisory until it was measured, bounded the nightly fixer, and moved fleet policy into managed settings.",
    implementation: "PreToolUse hooks enforce limits before a command runs. Remove or gate one leg of private data, untrusted input and outbound communication. Workload identity federation issues short-lived credentials. Worktrees isolate parallel edits. Managed settings outrank local files, and allowManagedMcpServersOnly stops local lists from adding servers.",
    transfer: "For each fleet risk, ask where the control is enforced. A rule in CLAUDE.md, a log or a wiki page influences or records behaviour; a hook, a permission, a credential scope or managed setting prevents it.",
    references: ["hooks", "safety", "auth", "settings"],
  },
};
