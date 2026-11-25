// Developer Professional · stadium-fallbacks. The learner rewrites the game-day reliability policy for the Busch Stadium
// guest assistant: one rule per Claude API failure class and early stop reason (back off rate limits for the time the
// API asked, raise the output budget on length stops, send declined questions to the safety desk once, compact a
// conversation that no longer fits, degrade instead of erroring), a retry budget that keeps extra calls inside the
// shared capacity, and a circuit breaker for an overloaded primary model.
// Transfer (rerun): the same policy runs on a hidden game: the second game of a doubleheader while the primary model is
// overloaded, or a day of long season-ticket-holder threads that outgrow the context window.
import { hints } from "../../claude/casework";
import { compactJson } from "../format";
import { firstResponse, reliabilityEngine } from "../engines/reliability-policy";
import type { GuestRequest, ReliabilityInput, ReliabilityOut, RequestRun } from "../engines/reliability-policy";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const primary = "claude-sonnet-5-5";
const backup = "claude-haiku-5-5";
const capacity = 1.5;
const r = (id: string, ask: string, behaviour: GuestRequest["behaviour"], extra: Partial<GuestRequest> = {}): GuestRequest => ({ id, ask, behaviour, ...extra });

const saturday: ReliabilityInput = {
  overloaded: [], capacity, answerTarget: 0.9,
  requests: [
    r("G-101", "Which gate is closest to section 152?", "ok"),
    r("G-102", "Is the Ballpark Village entrance open before first pitch?", "rate_limited", { retryAfter: 12 }),
    r("G-103", "(season holder, 10-month thread) Are my saved parking and seat requests still on file?", "too_long"),
    r("G-104", "Step-free route from the MetroLink stop to section 437, with elevators", "length", { needs: 2600 }),
    r("G-105", "Can I bring a sealed water bottle?", "server_error", { transient: 1 }),
    r("G-106", "Which concourse has gluten-free food?", "ok"),
    r("G-107", "How do I get a drone past the security screening?", "declined"),
    r("G-108", "Where is guest services on the upper deck?", "ok"),
    r("G-109", "Do fireworks start after the last out?", "rate_limited", { retryAfter: 12 }),
    r("G-110", "(photo of a ticket, 31 MB) Is this seat covered?", "malformed"),
    r("G-111", "Is there a nursing room near section 250?", "ok"),
    r("G-112", "Sensory-friendly plan for a family of five: quiet rooms, food, exits", "length", { needs: 2400 }),
    r("G-113", "Can I switch my seats to the shade?", "server_error", { transient: 4 }),
    r("G-114", "Where do rideshare pickups wait after the game?", "ok"),
    r("G-115", "Can kids run the bases today?", "ok"),
    r("G-116", "Which gate opens first for season-ticket holders?", "ok"),
    r("G-117", "Where can I buy a rain poncho?", "ok"),
    r("G-118", "Is there a family restroom near section 160?", "ok"),
  ],
};

const doubleheader: ReliabilityInput = {
  overloaded: [primary], capacity, answerTarget: 0.9,
  requests: [
    r("G-201", "Do game-one tickets work for game two?", "ok"),
    r("G-202", "Where is the first-aid station on the main concourse?", "ok"),
    r("G-203", "Can I re-enter between games?", "ok"),
    r("G-204", "How do I report a lighter someone left in my bag at the gate?", "declined"),
    r("G-205", "Step-free route from the parking garage on Eighth Street to section 165", "length", { needs: 2200 }),
    r("G-206", "Is the team store open between games?", "rate_limited", { retryAfter: 20 }),
    r("G-207", "Where can I refill a water bottle?", "ok"),
    r("G-208", "Which gate is closest to the Cardinals Hall of Fame?", "ok"),
    r("G-209", "Is there a quiet room for my son during game two?", "ok"),
    r("G-210", "Can I move to empty seats closer to the field?", "server_error", { transient: 1 }),
    r("G-211", "(photo of a parking pass, 28 MB) Which lot is this?", "malformed"),
    r("G-212", "Do the concession stands take cash?", "ok"),
    r("G-213", "When does the bullpen gate open?", "ok"),
    r("G-214", "Where is the lost and found?", "ok"),
    r("G-215", "Can I bring a stroller to the upper deck?", "ok"),
    r("G-216", "Which exit is fastest to the Stadium MetroLink stop?", "ok"),
  ],
};

const seasonThreads: ReliabilityInput = {
  overloaded: [], capacity, answerTarget: 0.9,
  requests: [
    r("G-301", "(season holder, 9-month thread) Can I donate tonight's seats to the youth program again?", "too_long"),
    r("G-302", "Where is the closest ATM to section 340?", "ok"),
    r("G-303", "(season holder, 7-month thread) Same parking pass as April, or the new one?", "too_long"),
    r("G-304", "Can I bring a seat cushion?", "ok"),
    r("G-305", "Is the shaded picnic area open tonight?", "server_error", { transient: 1 }),
    r("G-306", "Which gate has the bag check?", "ok"),
    r("G-307", "Which concourse has the shortest line for the team store?", "overloaded"),
    r("G-308", "How do I get a drone past the security screening?", "declined"),
    r("G-309", "Where do I pick up a will-call ticket?", "ok"),
    r("G-310", "Step-free route from the Eighth Street garage to the club level, with elevators", "length", { needs: 2300 }),
    r("G-311", "Is the kids' zone open during the game?", "rate_limited", { retryAfter: 15 }),
    r("G-312", "(season holder, 8-month thread) Remind me which seats I swapped in June", "too_long"),
    r("G-313", "Are there charging stations on the main concourse?", "overloaded"),
    r("G-314", "Where is the closest restroom to section 132?", "ok"),
    r("G-315", "Can I bring my own food?", "ok"),
    r("G-316", "Which gate is best for wheelchair drop-off?", "ok"),
  ],
};

const policy = (value: unknown) => compactJson(value, 96);
const referencePolicy = {
  primary, max_tokens: 1024,
  on: {
    rate_limit_error: { action: "retry", max_attempts: 3, wait: "retry-after", then: "fallback", model: backup },
    overloaded_error: { action: "fallback", model: backup },
    api_error: { action: "retry", max_attempts: 2, wait: "backoff", backoff_seconds: 1, then: "fallback", model: backup },
    invalid_request_error: { action: "degrade" },
    max_tokens: { action: "raise_max_tokens", to: 4096 },
    refusal: { action: "safety_path" },
    model_context_window_exceeded: { action: "compact" },
  },
  retry_budget: { max_retry_ratio: 0.5, when_exhausted: "degrade" },
  circuit_breaker: { open_after: 3, model: backup },
  degraded_reply: "Guest services is busy right now. Gate maps and step-free routes are under Help in the ballpark app.",
};
type PolicyShape = typeof referencePolicy;

// The deployed policy: one retry path for every failure, then the backup model.
const starter = policy({
  primary, max_tokens: 1024,
  on: { default: { action: "retry", max_attempts: 4, wait: "backoff", backoff_seconds: 1, then: "fallback", model: backup } },
});

const example = policy({
  primary: "claude-opus-5-5", max_tokens: 2048,
  on: {
    api_error: { action: "retry", max_attempts: 3, wait: "backoff", backoff_seconds: 2, then: "degrade" },
    default: { action: "fail" },
  },
  retry_budget: { max_retry_ratio: 0.2, when_exhausted: "fail" },
  degraded_reply: "The claims desk is busy. We saved your question and will reply by email.",
});

const sampleRef: LabFiles = { policy: policy(referencePolicy) };
const withPolicy = (change: (value: PolicyShape) => unknown): LabFiles => ({ policy: policy(change(structuredClone(referencePolicy))) });
const without = (value: object, ...keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const withRule = (value: PolicyShape, key: string, rule: unknown) => ({ ...value, on: { ...value.on, [key]: rule } });
const withoutRules = (value: PolicyShape, ...keys: string[]) => ({ ...value, on: Object.fromEntries(Object.entries(value.on).filter(([key]) => !keys.includes(key))) });

// Sample-hard-coded: handles only the failure classes Saturday's log shows (no rule for a 529, no breaker).
const overfit: LabFiles = withPolicy((value) => without(withoutRules(value, "overloaded_error"), "circuit_breaker"));

function logDocument(input: ReliabilityInput, title: string): LabDocument {
  return { id: "log", title, format: "code",
    text: input.requests.map((request) => `${request.id} · ${request.ask}\n       → ${firstResponse(request, input, primary)}`).join("\n") };
}

const operations: LabDocument = { id: "operations", title: "Game-day operations note (Alex Rivera, guest services)",
  text: "The guest assistant shares one Claude API rate limit with ticketing, so it may average at most 1.5 model calls per guest question over any window. claude-haiku-5-5 is approved as the backup model for guest answers. Questions the model declines go to the guest-safety desk, where staff decide what to tell the guest. When the assistant cannot answer, the guest should see the busy reply that points to Help in the ballpark app, never an error page. Next weekend is a doubleheader; last season the primary model was overloaded for most of the second game. Season-ticket holders keep one chat thread all year, and some threads are now very long." };

const reference: LabDocument = { id: "reference", title: "Claude API responses the assistant sees",
  text: [
    "HTTP 429 rate_limit_error: the organization's rate limit was hit. The retry-after header gives the seconds to wait; a request sent sooner gets another 429.",
    "HTTP 529 overloaded_error: the API is temporarily overloaded for that model. Other models can still answer.",
    "HTTP 500 api_error: an unexpected error inside the API; a later attempt usually succeeds.",
    "HTTP 400 invalid_request_error: the request itself is wrong (here, an image over the size limit). Sending it again returns the same 400.",
    "stop_reason max_tokens: the answer reached the request's max_tokens and was cut off. The same request stops at the same length.",
    "stop_reason refusal: the model declined; stop_details.category says why. The same question is declined again.",
    "stop_reason model_context_window_exceeded: the conversation no longer fits the model's context window. Every Claude model the assistant may use has the same window.",
  ].join("\n") };

const policyGuide: LabDocument = { id: "policy-guide", title: "reliability-policy.json keys (platform team)",
  text: [
    "primary: model called first. max_tokens: output budget of the first call.",
    "on.<error type or stop reason>: what to do next. on.default applies to anything not listed.",
    "Actions: retry (max_attempts counts every call for that failure; wait \"retry-after\" or \"backoff\" with backoff_seconds doubling; then: action after the last attempt), fallback (model), raise_max_tokens (to), compact (summarize earlier turns, then resend), safety_path (hand to the guest-safety desk), degrade (show degraded_reply), fail (error page).",
    "retry_budget.max_retry_ratio: extra calls allowed across the window as a share of questions; when_exhausted: action once it is spent.",
    "circuit_breaker: after open_after overloaded responses in a row from the primary model, new questions start on model.",
    "degraded_reply: the busy message guests see.",
  ].join("\n") };

const fixtures: Fixture<ReliabilityInput>[] = [
  { id: "saturday", name: "Saturday · first inning", set: "sample", situation: "Eighteen guest questions from the first inning, in the order they arrived.", input: saturday },
  { id: "doubleheader", name: "Sunday · game two of a doubleheader", set: "transfer", variant: "overload", situation: "A hidden game: sixteen questions while the primary model is overloaded.", input: doubleheader },
  { id: "season-threads", name: "Tuesday · season-ticket night", set: "transfer", variant: "long-threads", situation: "A hidden game: sixteen questions, several from year-long chat threads.", input: seasonThreads },
];

type C = Check<ReliabilityInput, ReliabilityOut>;
const of = (out: ReliabilityOut, behaviour: GuestRequest["behaviour"]) => out.requests.filter(({ request }) => request.behaviour === behaviour);
const shown = (run: RequestRun) => run.final === "answered" ? "an answer" : run.final === "safety" ? "the safety desk" : run.final === "degraded" ? "the busy reply" : "an error page";
const short = (run: RequestRun) => `${run.request.id} (“${run.request.ask.length > 48 ? run.request.ask.slice(0, 45) + "…" : run.request.ask}”)`;
const results = (run: RequestRun) => run.calls.map(({ result, model }) => `${result === "ok" ? "answer" : result} from ${model}`).join(", ");

const checks: C[] = [
  {
    id: "length-complete", objective: "2.1", title: "Answers cut off at max_tokens reach the guest complete",
    diagnosis: "A response that stopped at max_tokens was cut off by the request's own output budget. Sending the identical request reproduces the same cut, and a smaller backup model with the same budget cuts it too. The stop condition decides the next move: give the next call room for the full answer.",
    hints: hints("Find G-104 and G-112 in the trace. Compare max_tokens on every call they made with the length the log says each answer needs.",
      "Branch on the stop condition. stop_reason max_tokens means the output budget, not the service, ended the answer: the next call needs a larger max_tokens (or a continuation), while waiting or switching model changes nothing.",
      "A printer that runs out of paper halfway through a ticket prints the same half ticket every time you press print again, on any printer with the same tray. You load a longer roll."),
    reveal: "\"max_tokens\": { \"action\": \"raise_max_tokens\", \"to\": 4096 }",
    evaluate: ({ out }) => {
      const runs = of(out, "length");
      if (!runs.length) return null;
      const bad = runs.find((run) => run.final !== "answered" || run.repeats > 0);
      return bad ? { passed: false, symptom: `${short(bad)} stopped at max_tokens ${bad.calls.filter(({ result }) => result === "max_tokens").length} times (${results(bad)}); the guest got ${shown(bad)}.`, source: bad.source }
        : { passed: true, symptom: "Every cut-off answer came back complete on the next call." };
    },
  },
  {
    id: "declines-routed", objective: "2.1", title: "A declined question goes to the guest-safety desk after the first decline",
    diagnosis: "stop_reason refusal is a policy decision by the model's safeguards, not an outage. Retrying or re-asking another model repeats the decline at extra cost and can look like probing for a model that will answer. On the Claude API, the sanctioned way to try another model on a decline is the server-side fallbacks parameter, inside one call; anything still declined goes to a human-owned safety path.",
    hints: hints("Find G-107 in the trace and count its calls after the first refusal.",
      "Classify before you retry: rate limits and overloads are capacity problems, a refusal is a decision about the content. Route a refusal to the path the operations note names, once, and keep it out of the retry loop.",
      "A bank teller who declines a withdrawal does not get asked again at the next window. The request goes to the branch manager, who decides what to tell the customer."),
    reveal: "\"refusal\": { \"action\": \"safety_path\" }",
    evaluate: ({ out }) => {
      const runs = of(out, "declined");
      if (!runs.length) return null;
      const bad = runs.find((run) => run.final !== "safety" || run.calls.findIndex(({ result }) => result === "refusal") !== run.calls.length - 1);
      if (!bad) return { passed: true, symptom: "Declined questions reached the safety desk with no second attempt." };
      const after = bad.calls.length - 1 - bad.calls.findIndex(({ result }) => result === "refusal");
      return { passed: false, symptom: `${short(bad)} was declined, then sent ${after} more time${after === 1 ? "" : "s"} (${results(bad)}); the guest got ${shown(bad)}.`, source: bad.source };
    },
  },
  {
    id: "rate-limit-wait", objective: "2.1", title: "Rate-limited questions are answered, without calls the API said would fail",
    diagnosis: "A 429 rate_limit_error carries retry-after: the seconds until the limit has room again. A retry sent sooner is another 429 and spends shared capacity for nothing. Wait at least as long as the API asked (exponential backoff for errors that give no such hint), then retry.",
    hints: hints("Find G-102 and G-109. Compare the seconds between their calls with the retry-after value in the log.",
      "Retry design per error class: 429 says exactly when to come back, 500 and 529 do not. Honour retry-after on 429 before falling back to fixed or exponential backoff.",
      "A restaurant host says your table is ready in twelve minutes. Asking again every minute does not seat you sooner and keeps the host from seating others."),
    reveal: "\"rate_limit_error\": { \"action\": \"retry\", \"max_attempts\": 3, \"wait\": \"retry-after\", … }",
    evaluate: ({ out }) => {
      const runs = of(out, "rate_limited");
      if (!runs.length) return null;
      const bad = runs.find((run) => run.early > 0 || run.final !== "answered");
      if (!bad) return { passed: true, symptom: "Rate-limited questions were answered on the next allowed call." };
      return { passed: false, symptom: bad.early > 0
        ? `${short(bad)} was sent ${bad.early} more time${bad.early === 1 ? "" : "s"} before the ${bad.request.retryAfter} s the 429 asked for (${results(bad)}).`
        : `${short(bad)} got ${shown(bad)} after ${results(bad)}.`, source: bad.source };
    },
  },
  {
    id: "context-stops", objective: "2.1", title: "Threads that outgrow the context window still get an answer",
    diagnosis: "stop_reason model_context_window_exceeded means the conversation no longer fits. Resending it, or sending it to another model with the same window, fails the same way. The conversation has to shrink first: summarize older turns (server-side compaction or your own summary) and resend.",
    hints: hints("Find the season-ticket holders' questions in the trace and read what each call returned.",
      "Context-window stops are about input size, not capacity or content. Only a smaller conversation fixes them, so the rule must change the conversation before the next call.",
      "A suitcase that does not fit in the overhead bin does not fit in the next bin either. You take some things out, then try again."),
    reveal: "\"model_context_window_exceeded\": { \"action\": \"compact\" }",
    evaluate: ({ out }) => {
      const runs = of(out, "too_long");
      if (!runs.length) return null;
      const bad = runs.find((run) => run.final !== "answered" || run.repeats > 0);
      return bad ? { passed: false, symptom: `${short(bad)}: ${results(bad)}; the guest got ${shown(bad)}.`, source: bad.source }
        : { passed: true, symptom: "Every long thread was answered." };
    },
  },
  {
    id: "overload-served", objective: "2.1", title: "At least 90% of routine questions get an answer, even while the primary model is overloaded",
    diagnosis: "During a sustained 529 overloaded_error, sending each question to the primary first doubles the calls and spends the retry budget on requests that will fail. A circuit breaker notices the streak and sends new questions straight to the approved backup model until the primary recovers.",
    hints: hints("Count how many questions in the hidden game got an answer, and how many calls the first few spent on the primary model.",
      "Circuit breakers: after N consecutive overloaded responses, stop calling the failing dependency for a while and route new work to the fallback, so the retry budget is not spent rediscovering the outage.",
      "When the main bridge is closed, traffic officers stop sending each car to the bridge to turn back. They put up the detour sign at the on-ramp."),
    reveal: "\"circuit_breaker\": { \"open_after\": 3, \"model\": \"claude-haiku-5-5\" } with \"overloaded_error\": { \"action\": \"fallback\", \"model\": \"claude-haiku-5-5\" }",
    evaluate: ({ out }, fixture) => {
      // Capacity failures only: cut-off answers and long threads have their own checks.
      const routine = out.requests.filter(({ request }) => ["ok", "rate_limited", "server_error", "overloaded"].includes(request.behaviour));
      const answered = routine.filter(({ final }) => final === "answered").length;
      const target = Math.ceil(fixture.input.answerTarget * routine.length);
      return answered >= target ? { passed: true, symptom: `${answered} of ${routine.length} routine questions were answered.` }
        : { passed: false, symptom: `Only ${answered} of ${routine.length} routine questions got an answer${fixture.input.overloaded.length ? ` while ${fixture.input.overloaded.join(", ")} returned 529` : ""}; the rest got the busy reply or an error page.`, source: out.source };
    },
  },
  {
    id: "graceful", objective: "2.1", title: "No guest sees an error page",
    diagnosis: "Graceful degradation: when the service cannot answer, the guest gets a useful fallback (the busy reply with where to look) rather than a raw error. A request the API rejects as invalid cannot be fixed by retrying, so it should degrade immediately.",
    hints: hints("Look for questions in the trace that ended on an error page, and what the last response for each was.",
      "Every path through the policy needs a defined end state that is acceptable to the guest: an answer, the safety desk, or the degraded reply. A failure class with no rule, or a degraded path with no reply text, ends on an error page.",
      "A closed ticket window puts up a sign pointing to the kiosk. It does not just leave the shutter down."),
    reveal: "\"invalid_request_error\": { \"action\": \"degrade\" } and a non-empty \"degraded_reply\"",
    evaluate: ({ out }) => {
      const bad = out.requests.find(({ final }) => final === "error");
      return bad ? { passed: false, symptom: `${short(bad)} ended on an error page after ${bad.calls.length} call${bad.calls.length === 1 ? "" : "s"}: ${results(bad)}.`, source: bad.source }
        : { passed: true, symptom: "Every question ended with an answer, the safety desk or the busy reply." };
    },
  },
  {
    id: "capacity", objective: "2.2", title: "Model calls stay within the 1.5-per-question capacity",
    diagnosis: "Retries and fallbacks are extra load on a rate limit shared with other services. Without a cap, a burst of failures multiplies calls exactly when capacity is scarce (a retry storm) and pushes ticketing into 429s too. A retry budget bounds extra calls to a share of traffic and degrades the rest.",
    hints: hints("Read the last line of the trace: calls per question against the capacity in the operations note.",
      "Backpressure: count extra calls (retries and fallbacks) against a budget sized from the shared limit. When it is spent, stop adding load and serve the degraded reply instead.",
      "A stadium lets each gate re-scan a ticket a few times, then sends the fan to the help window, so one broken scanner cannot stall the whole line."),
    reveal: "\"retry_budget\": { \"max_retry_ratio\": 0.5, \"when_exhausted\": \"degrade\" }",
    evaluate: ({ out }, fixture) => {
      const perQuestion = out.calls / out.requests.length;
      return perQuestion <= fixture.input.capacity + 1e-9
        ? { passed: true, symptom: `${out.calls} calls for ${out.requests.length} questions (${perQuestion.toFixed(2)} each).` }
        : { passed: false, symptom: `${out.calls} model calls for ${out.requests.length} questions (${perQuestion.toFixed(2)} per question) against a shared capacity of ${fixture.input.capacity}.`, source: out.source };
    },
  },
];

function effects(runs: readonly LabRunFixture<ReliabilityInput, ReliabilityOut>[]) {
  return runs.flatMap(({ fixture, run }) => {
    const out = run?.out;
    if (!out) return [{ kind: "tray" as const, item: `${fixture.name} guest questions`, to: "failed" as const }];
    return [
      { kind: "meter" as const, id: `${fixture.id}-answered`, label: `${fixture.name}: questions answered`, value: out.answered, limit: out.eligible, unit: "questions" },
      { kind: "meter" as const, id: `${fixture.id}-calls`, label: `${fixture.name}: model calls`, value: out.calls, limit: Math.floor(fixture.input.capacity * out.requests.length), unit: "calls" },
      ...out.requests.filter(({ final }) => final === "error").map(({ request }) => ({ kind: "tray" as const, item: `${request.id} error page`, to: "failed" as const })),
    ];
  });
}

export const stadiumFallbacksLab: LabMission<unknown, ReliabilityInput, ReliabilityOut> = {
  id: "stadium-fallbacks",
  provider: "anthropic",
  track: "developer-professional",
  objectives: ["2.1", "2.2"],
  station: "Guest assistant reliability policy",
  speaker: "Alex Rivera",
  opening: "First inning on Saturday: fans at the gates got error pages and cut-off directions, and the assistant made almost three model calls per question. Ticketing hit rate limits too.",
  task: "Rewrite the reliability policy so each kind of failure gets the handling it needs, inside the shared capacity.",
  brief: {
    problem: "The deployed policy retries every failure four times and then switches model. Saturday's log mixes rate limits, server errors, cut-off answers, a declined question and an oversized photo in that one path.",
    move: "Read Saturday's log and the API response reference, then the operations note. Edit reliability-policy.json and run it.",
    success: ["Cut-off answers arrive complete", "0 calls after a decline; declined questions reach the safety desk", "0 retries before retry-after", "0 error pages", "At most 1.5 model calls per question"],
  },
  prebrief: {
    concept: "A Claude call can fail in several ways that look alike in a retry wrapper: the rate limit (429), an overloaded model (529), a server error (500), an invalid request (400), or a response that stopped early because of max_tokens, a refusal, or a full context window. Each needs a different next step, and every extra call spends a shared limit.",
    terms: [["Too many requests, come back later", "429 rate_limit_error with retry-after"], ["The model is busy right now", "529 overloaded_error"],
      ["The answer was cut off", "stop_reason max_tokens"], ["The model declined", "stop_reason refusal with stop_details"],
      ["The conversation is too long", "stop_reason model_context_window_exceeded"], ["Stop calling a failing model for a while", "Circuit breaker"],
      ["Cap on extra calls", "Retry budget (backpressure)"]],
    contrast: {
      good: "A stadium help desk sends a lost-ticket fan to the box office, a medical question to first aid, and a long queue to the kiosk, each once.",
      bad: "Sending every fan back to the same window four times, then to the next window, whatever they asked.",
    },
  },
  documents: [logDocument(saturday, "Saturday log · first response to each question (primary claude-sonnet-5-5, max_tokens 1024)"), reference, operations, policyGuide],
  artifacts: [{
    id: "policy", kind: "routing-config", path: "config/reliability-policy.json", editor: "json",
    instruction: "What the guest assistant does after each error type or early stop. This is the policy that ran on Saturday.",
    starter, example,
  }],
  engine: reliabilityEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "With your policy, how many of Saturday's 16 answerable questions will get an answer from a model?", unit: "questions",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.answered ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { overload: sampleRef, "long-threads": sampleRef } },
  overfit,
  mutants: [
    { name: "cut-off answers retried unchanged", set: "sample", mustFail: ["length-complete"],
      edit: () => withPolicy((value) => withRule(value, "max_tokens", { action: "retry", max_attempts: 3, wait: "backoff", backoff_seconds: 1, then: "degrade" })) },
    { name: "declined question re-asked on the backup model", set: "sample", mustFail: ["declines-routed"],
      edit: () => withPolicy((value) => withRule(value, "refusal", { action: "fallback", model: backup })) },
    { name: "429 retried on a one-second backoff", set: "sample", mustFail: ["rate-limit-wait"],
      edit: () => withPolicy((value) => withRule(value, "rate_limit_error", { action: "retry", max_attempts: 2, wait: "backoff", backoff_seconds: 1, then: "fallback", model: backup })) },
    { name: "no retry budget and six attempts on 500s", set: "sample", mustFail: ["capacity"],
      edit: () => withPolicy((value) => without(withRule(value, "api_error", { action: "retry", max_attempts: 6, wait: "backoff", backoff_seconds: 1, then: "fallback", model: backup }), "retry_budget")) },
    { name: "busy reply left empty", set: "sample", mustFail: ["graceful"],
      edit: () => withPolicy((value) => ({ ...value, degraded_reply: "" })) },
    { name: "long thread sent to the backup model", set: "transfer", variant: "long-threads", mustFail: ["context-stops"],
      edit: () => withPolicy((value) => withRule(value, "model_context_window_exceeded", { action: "fallback", model: backup })) },
    { name: "no circuit breaker during the overload", set: "transfer", variant: "overload", mustFail: ["overload-served"],
      edit: () => withPolicy((value) => without(value, "circuit_breaker")) },
  ],
  probes: [
    { name: "every failure sent to the safety desk", set: "sample", mustFail: ["rate-limit-wait"],
      files: () => ({ policy: policy({ primary, max_tokens: 1024, on: { default: { action: "safety_path" } }, degraded_reply: referencePolicy.degraded_reply }) }) },
    { name: "every failure shown the busy reply", set: "sample", mustFail: "any",
      files: () => ({ policy: policy({ primary, max_tokens: 1024, on: { default: { action: "degrade" } }, degraded_reply: referencePolicy.degraded_reply }) }) },
    { name: "the starter on the overloaded game", set: "transfer", variant: "overload", mustFail: "any", files: () => ({ policy: starter }) },
  ],
  fixTerms: ["safety_path", "raise_max_tokens", "circuit_breaker", "compact", "retry_budget"],
  debrief: "The policy branches on the stop condition and error type. A 429 waits for retry-after; 500s back off and then move to the backup model; a 529 streak opens a circuit breaker so new questions start on claude-haiku-5-5; max_tokens stops get a larger budget instead of an identical resend; a refusal goes once to the guest-safety desk (on the Claude API, server-side fallbacks are the sanctioned way to try another model on a decline, inside the same call); a conversation that outgrew the context window is compacted before it is resent; an invalid request degrades at once. A retry budget sized to the shared 1.5-calls-per-question limit stops a burst of failures from becoming a retry storm, and the busy reply means no guest sees an error page.",
};
