// City Dispatch's daily shift: customers ask where their order is, the learner runs the lookup and sends each tool
// result down the right chute. Exam alignment: CCAR-F 2.2 (structured tool errors), 1.1 and 2.1 (tool_use / tool_result pairing).
import { shuffle } from "./engine";
import type { ProofQuestion as GenericProofQuestion, ShiftContent, ShiftTicket } from "./engine";

export type Concept = "found" | "empty" | "retry" | "handoff" | "validation" | "permission" | "pairing";
export type Route = "status" | "no-match" | "retry" | "handoff" | "fix-id" | "explain-access";
export type ProofQuestion = GenericProofQuestion<Concept>;

export const routes: readonly { id: Route; label: string; hint: string }[] = [
  { id: "status", label: "Send the status", hint: "Tell the customer where the order is" },
  { id: "no-match", label: "Say no order found", hint: "The search finished and found nothing" },
  { id: "retry", label: "Retry once", hint: "Run the same lookup one more time" },
  { id: "handoff", label: "Hand to support", hint: "A person follows up with what was tried" },
  { id: "fix-id", label: "Ask for the right ID", hint: "Request a corrected order number" },
  { id: "explain-access", label: "Explain access", hint: "Say who can see this and how" },
];

/** The short teaching note Arun gives after a miss, and the exam vocabulary it maps to. */
export const conceptNotes: Record<Concept, { title: string; note: string; examTerm: string; objective: string }> = {
  found: {
    title: "A result with data",
    note: "isError is false and the body has the order. Report it.",
    examTerm: "Successful tool result", objective: "2.2",
  },
  empty: {
    title: "A finished search with zero rows",
    note: "isError is false and the list is empty: the search completed and found nothing. That is an answer, not a failure.",
    examTerm: "Empty result as data", objective: "2.2",
  },
  retry: {
    title: "A transient failure with time left",
    note: "isError is true, the category is transient and isRetryable is true. A read is safe to repeat, so retry once inside the deadline.",
    examTerm: "errorCategory: transient · isRetryable", objective: "2.2",
  },
  handoff: {
    title: "A retry that also failed",
    note: "The second attempt failed too, so nobody knows whether the order exists. Hand off with what was tried. Never say “not found”.",
    examTerm: "Bounded retry, then escalate with context", objective: "2.2",
  },
  validation: {
    title: "Input the tool rejected",
    note: "A validation error means the same input will fail again. Ask for the corrected ID instead of retrying.",
    examTerm: "errorCategory: validation · not retryable", objective: "2.2",
  },
  permission: {
    title: "An access decision",
    note: "A permission error is a decision, not a glitch. Explain the approved route without revealing what was blocked, and don't route around it.",
    examTerm: "errorCategory: permission · not retryable", objective: "2.2",
  },
  pairing: {
    title: "Results that arrive out of order",
    note: "Each tool_result carries the tool_use_id of the call it answers. Match by ID, never by arrival order.",
    examTerm: "tool_use_id pairing", objective: "1.1",
  },
};

export const customers = [
  { name: "Rosa Delgado", line: "My tracking page has said “processing” since Monday." },
  { name: "Ken Mwangi", line: "Can you tell me where my order is? I need it for Friday." },
  { name: "Priyanka Rao", line: "I'm checking on an order for my shop." },
  { name: "Tom Becker", line: "The driver's app says it's nearby. Is it?" },
  { name: "Aisha Bello", line: "I ordered a replacement part last week." },
  { name: "Luis Ortega", line: "Just making sure this one is still coming." },
  { name: "Hannah Cho", line: "I got an email saying it shipped. Where is it now?" },
  { name: "Marcus Webb", line: "I'm the account holder's son. Can you check this for him?" },
  { name: "Grace Kim", line: "I copied this order number from my receipt." },
  { name: "Omar Haddad", line: "Two packages, two order numbers. Where are they?" },
  { name: "Lena Novak", line: "It's for a birthday this weekend, so please check." },
  { name: "Jamal Price", line: "I placed this yesterday at the counter." },
] as const;

/** What the customer hears or sees after each routing, keyed by the lookup outcome and the route taken. */
export const reactions = {
  happy: ["“Perfect, thank you.”", "“Great, that's all I needed.”", "“Thanks. That's really clear.”", "“Okay, that makes sense.”"],
  unhappy: ["“That can't be right…”", "“Wait, what?”", "“I'll have to call back, then.”", "“That doesn't help me.”"],
} as const;

export const openings = {
  first: "Morning! The overnight lookup glitch filled our callback list. Run each customer's lookup and send the result down the right chute. Read the parcel's label: it tells you what actually happened.",
  clean: (shift: number) => `Shift ${shift}. Yesterday nobody had to call anyone back. Let's keep it that way.`,
  callbacks: (shift: number, minutes: number) => `Shift ${shift}. Yesterday's routing cost us ${minutes} minutes of callbacks. A couple of those customers are back today.`,
  unlock: { handoff: "New today: some lookups will fail twice. Watch what you tell people when that happens.", permission: "New today: the access rules went live, so not everyone can see every order.", pairing: "New today: some customers ask about two orders at once, and the results don't always come back in order." } as Partial<Record<Concept, string>>,
} as const;

export const closings = {
  clean: "Queue's clear and nobody needs a callback. That's a good shift.",
  some: (minutes: number) => `Queue's moving. We still owe ${minutes} minutes of callbacks. Tomorrow's customers will tell us if it stuck.`,
} as const;

// A deterministic, short "day at Dispatch": tickets arrive, the learner routes each tool result,
// mistakes become callbacks, and missed skills come back on later shifts (spaced review).

export type Outcome = "found" | "empty" | "timeout" | "invalid" | "denied";

export type Lookup = {
  callId: string;
  orderId: string;
  outcome: Outcome;
  attempt: 0 | 1;
  /** What a retry would return; only set for first-attempt timeouts. */
  next?: Outcome;
  status?: string;
};

export type Ticket = ShiftTicket<Concept, Lookup>;

export type Consequence = {
  correct: boolean;
  /** What visibly happened, phrased as a symptom (never the fix). */
  text: string;
  callbackMinutes: number;
  falseNotFound: boolean;
  /** A retry produces a fresh parcel to route. */
  follow?: Lookup;
};

const statuses = ["Out for delivery, arriving by 4 p.m.", "At the Maplewood depot, loading tomorrow", "Delivered to the front desk at 11:42", "In transit, on the 9 a.m. truck"];

// Concepts unlock across the first three shifts so day one stays simple.
const unlockOrder: readonly (readonly Concept[])[] = [["found", "empty", "retry", "validation"], ["handoff", "permission"], ["pairing"]];

export function correctRoute(lookup: Lookup): Route {
  switch (lookup.outcome) {
    case "found": return "status";
    case "empty": return "no-match";
    case "timeout": return lookup.attempt === 0 ? "retry" : "handoff";
    case "invalid": return "fix-id";
    case "denied": return "explain-access";
  }
}

/** The parcel label: the structured fields a real MCP tool result would carry. */
export function parcelFields(lookup: Lookup): readonly (readonly [field: string, value: string])[] {
  switch (lookup.outcome) {
    case "found": return [["isError", "false"], ["order", lookup.status ?? "found"]];
    case "empty": return [["isError", "false"], ["orders", "[ ]  (search completed)"]];
    case "timeout": return [["isError", "true"], ["errorCategory", "\"transient\""], ["isRetryable", "true"], ["attempt", lookup.attempt === 0 ? "1 of 2" : "2 of 2 · budget spent"]];
    case "invalid": return [["isError", "true"], ["errorCategory", "\"validation\""], ["isRetryable", "false"], ["message", "\"order IDs end in digits\""]];
    case "denied": return [["isError", "true"], ["errorCategory", "\"permission\""], ["isRetryable", "false"], ["message", "\"caller is not the account holder\""]];
  }
}

export function consequence(lookup: Lookup, route: Route): Consequence {
  const right = correctRoute(lookup);
  if (route === right) {
    if (route === "retry") return { correct: true, text: "Second lookup sent while there was still time.", callbackMinutes: 0, falseNotFound: false, follow: { ...lookup, attempt: 1, outcome: lookup.next ?? "found", next: undefined, status: lookup.status } };
    const text: Record<Route, string> = {
      status: "Customer got their status.",
      "no-match": "Customer heard there's no such order and is checking their receipt.",
      retry: "",
      handoff: "Customer was told the status is unavailable, and support has the case with both attempts.",
      "fix-id": "Customer re-read their receipt and is sending the right number.",
      "explain-access": "Caller knows who can see this order and how to get access.",
    };
    return { correct: true, text: text[route], callbackMinutes: 0, falseNotFound: false };
  }
  // Wrong routes: describe the symptom the city sees, and what it costs.
  const unknownOutcome = lookup.outcome === "timeout";
  if (route === "no-match") {
    return lookup.outcome === "found"
      ? { correct: false, text: "Customer was told their order doesn't exist. It was on a truck.", callbackMinutes: 6, falseNotFound: true }
      : { correct: false, text: unknownOutcome ? "Customer was told their order doesn't exist, but the lookup never finished." : "Customer was told “no order found”, but that's not what the lookup said.", callbackMinutes: 6, falseNotFound: unknownOutcome || lookup.outcome === "invalid" || lookup.outcome === "denied" };
  }
  if (route === "retry") {
    if (lookup.outcome === "timeout") return { correct: false, text: "A third attempt ran past the two-second budget. The customer gave up waiting.", callbackMinutes: 6, falseNotFound: false };
    return { correct: false, text: lookup.outcome === "empty" || lookup.outcome === "found" ? "The same lookup ran again and returned the same thing. The customer waited for nothing." : "The same request failed the same way again.", callbackMinutes: lookup.outcome === "denied" ? 3 : 1, falseNotFound: false };
  }
  if (route === "handoff") {
    return { correct: false, text: lookup.outcome === "timeout" ? "Support got a case that one more try would probably have answered." : "Support spent six minutes on a case the lookup had already answered.", callbackMinutes: 6, falseNotFound: false };
  }
  if (route === "status") {
    return { correct: false, text: lookup.outcome === "denied" ? "Order details went to someone who isn't the account holder." : "Customer got a status message with nothing in it.", callbackMinutes: lookup.outcome === "denied" ? 10 : 6, falseNotFound: false };
  }
  if (route === "fix-id") return { correct: false, text: "Customer re-checked a correct order number and got annoyed.", callbackMinutes: 3, falseNotFound: false };
  return { correct: false, text: "Customer was told about access rules that had nothing to do with their order.", callbackMinutes: 3, falseNotFound: false };
}


// ---- Deterministic generation -------------------------------------------------------------

function orderId(random: () => number, prefix?: string) {
  const letters = "TKMRPDL";
  const letter = prefix ?? letters[Math.floor(random() * letters.length)];
  return `${letter}-${10 + Math.floor(random() * 89)}`;
}

function callId(random: () => number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "toolu_" + Array.from({ length: 4 }, () => chars[Math.floor(random() * chars.length)]).join("");
}

function lookupFor(concept: Concept, random: () => number): Lookup[] {
  const status = statuses[Math.floor(random() * statuses.length)];
  const base = () => ({ callId: callId(random), orderId: orderId(random), attempt: 0 as const, status });
  switch (concept) {
    case "found": return [{ ...base(), outcome: "found" }];
    case "empty": return [{ ...base(), outcome: "empty" }];
    case "retry": return [{ ...base(), outcome: "timeout", next: "found" }];
    case "handoff": return [{ ...base(), outcome: "timeout", next: "timeout" }];
    case "validation": { const lookup = { ...base(), outcome: "invalid" as const }; return [{ ...lookup, orderId: lookup.orderId + "O" }]; }
    case "permission": return [{ ...base(), outcome: "denied" }];
    case "pairing": return [{ ...base(), outcome: "found" }, { ...base(), outcome: "found", status: statuses[(statuses.indexOf(status) + 1) % statuses.length] }];
  }
}


// Marcus, Omar and Grace were written for permission, pairing and validation tickets; keep them there.
const reserved: Partial<Record<Concept, string>> = { permission: "Marcus Webb", pairing: "Omar Haddad", validation: "Grace Kim" };

/** Live workload driving the 3D depot's trays and wall queue (4 hours per visible tray). */
export function depotWorkload(ticketsLeft: number, callbacks: number) {
  return Math.min(16, (ticketsLeft + callbacks) * 4);
}

// Original exam-style items in the CCAR-F style: evidence in the stem, plausible named-mechanism distractors.
export const proofQuestions: readonly ProofQuestion[] = [
  {
    id: "shift-q-contract", concept: "contract", objective: "2.2",
    prompt: "A parcel-tracking MCP tool returns `{ \"orders\": [] }` with `isError: false` for completed searches, and the same body when the carrier API times out after 3 s. Last week 41 of 290 “order not found” replies came from timeouts, and each one triggered a 6-minute callback. What change fixes this at the right layer?",
    options: [
      ["a", "Return completed searches as data, and return timeouts as `isError: true` with a transient category and a retryable flag.", "The tool is the only component that knows whether the search finished, so its result contract has to carry that difference."],
      ["b", "Add a system prompt rule telling the agent to treat empty results as uncertain whenever the lookup took longer than two seconds.", "Elapsed time is a weak proxy: slow searches can still complete, and the agent still can't see why the list is empty."],
      ["c", "Have the agent repeat every empty lookup once before replying, and only report no match when both calls come back empty.", "A second call can return the same ambiguous empty body, and it doubles load for every genuine no-match search."],
      ["d", "Cache the last successful lookup for each order and return it whenever the carrier API misses the three-second deadline.", "Cached data can be stale and is presented as current, so a timeout would silently become a possibly wrong status."],
    ],
    correct: "a",
    explanation: "Fix ambiguity where it starts. A completed empty search is data; a timeout is a tool execution error with a category and retry flag the agent can act on. Prompt rules, repeated calls and caches all work around a contract that still hides what happened.",
  },
  {
    id: "shift-q-handoff", concept: "handoff", objective: "2.2",
    prompt: "Dispatch's lookup budget is 2 seconds. A read-only tracking call timed out at 0.8 s with `errorCategory: \"transient\"` and `isRetryable: true`. The agent retried once and it timed out again at 1.7 s. The customer is still waiting in chat. What should the agent do next?",
    options: [
      ["a", "Retry the lookup a third time, because the error is still marked retryable and the customer has not left the chat.", "The retry budget and the 2-second deadline are both spent; another attempt delays the customer without a better outcome."],
      ["b", "Tell the customer no order was found, because two attempts returned no order data before the search window closed.", "Neither attempt completed a search, so “not found” is a false answer that creates exactly the callbacks the team is fighting."],
      ["c", "Say the status is unavailable right now and hand the case to support with both attempts, their errors and the order ID.", "The outcome is unknown, so the honest reply is unavailability, and the handoff carries the context support needs."],
      ["d", "Return the last cached status for that order and label it as current so the customer still gets an answer immediately.", "A cached status presented as current can be wrong; it hides the failure instead of routing it to someone who can check."],
    ],
    correct: "c",
    explanation: "Bound retries by both a count and the deadline. When they run out, the result is unknown, not empty: report unavailability and escalate with what was tried. Retrying past the budget, guessing “not found” or serving stale data all mislead the customer.",
  },
  {
    id: "shift-q-validation", concept: "validation", objective: "2.2",
    prompt: "A customer types order ID `T-17O`, ending in the letter O. The lookup tool rejects it before querying with `isError: true`, `errorCategory: \"validation\"`, `isRetryable: false` and the message “order IDs end in digits”. Which response should the agent give?",
    options: [
      ["a", "Retry the same lookup after a short backoff, because validation errors at the gateway are often caused by heavy load.", "The category says the input itself is invalid and not retryable; repeating the same input fails the same way."],
      ["b", "Strip the trailing letter, look up order T-17 instead, and report that order's status to the customer without asking.", "Guessing the intended ID can disclose another customer's order and answers a question the customer never asked."],
      ["c", "Report that no order matches T-17O, because the tool returned an error rather than an order record for that ID.", "No search ran, so “no match” is unsupported; the useful information is that the ID's format is wrong."],
      ["d", "Ask the customer to confirm the order ID, quoting the expected format, and run the lookup after a corrected ID arrives.", "The validation error says the input must change, so the next step is getting the right input from the person who has it."],
    ],
    correct: "d",
    explanation: "Read the error category before choosing recovery. Validation means the same input will fail again, so ask for corrected input and explain the expected format. Retrying, guessing a nearby ID or reporting “no match” each ignore what the tool reported.",
  },
  {
    id: "shift-q-permission", concept: "permission", objective: "2.2",
    prompt: "A caller asks for the delivery photo on order M-204. The tool returns `isError: true`, `errorCategory: \"permission\"` and `isRetryable: false` because the caller is not the account holder. The desk has an identity-verification form for exactly this case. What should happen?",
    options: [
      ["a", "Explain the photo is limited to the account holder and offer the verification form, without sharing any order details.", "This respects the access decision, reveals nothing restricted, and gives the caller the approved route forward."],
      ["b", "Retry the request through the support desk's service account, which is allowed to read every order's delivery photo.", "Routing around the check with a more privileged identity defeats the access control the tool just enforced."],
      ["c", "Tell the caller that no delivery photo exists for M-204, so the restricted detail is not revealed by the agent's reply.", "That is a false statement; it protects data by misleading the caller and blocks the legitimate verification route."],
      ["d", "Escalate to a human immediately and attach the full order record so the reviewer can decide what the caller may see.", "Escalation isn't needed for a clear policy decision, and attaching the full record spreads restricted data further."],
    ],
    correct: "a",
    explanation: "A permission error is a decision, not a fault. Don't retry it with broader credentials or disguise it as missing data. Explain the boundary without leaking restricted content and point to the approved process, such as identity verification.",
  },
  {
    id: "shift-q-pairing", concept: "pairing", objective: "1.1",
    prompt: "Claude's turn ends with `stop_reason: \"tool_use\"` and two calls: `toolu_A` for order R-11 and `toolu_B` for order R-12. The R-12 lookup finishes first, 600 ms before R-11. How should the harness send the results back to Claude?",
    options: [
      ["a", "Send the R-12 result in its own user turn as soon as it arrives, then send the R-11 result in a second user turn.", "Splitting results across turns breaks the expected shape: every call from that turn should be answered in the next user turn."],
      ["b", "Send one user turn containing both `tool_result` blocks, each carrying the `tool_use_id` of the call it answers.", "IDs tie each result to its call, so arrival order no longer matters and both answers reach Claude together."],
      ["c", "Reorder the results to match the calls, then send them as plain text in one user turn labeled with the order IDs.", "Plain text loses the structured link between call and result that `tool_result` blocks exist to carry."],
      ["d", "Wait for both, then send the results in the order the calls appeared and leave out the IDs since the order now matches.", "Without `tool_use_id` the request is invalid, and position-based matching is exactly what breaks when the harness changes."],
    ],
    correct: "b",
    explanation: "Answer every `tool_use` from a turn in the next user turn with `tool_result` blocks that carry the matching `tool_use_id`. The ID, not the position or arrival time, is what pairs a result with its call, so parallel lookups can finish in any order.",
  },
  {
    id: "shift-q-empty", concept: "empty", objective: "2.2",
    prompt: "The tracking tool completes a search for order K-90 across all three carriers and returns `isError: false` with `{ \"orders\": [] }` in 140 ms. The customer says they placed the order yesterday and are sure of the number. What should the agent tell them?",
    options: [
      ["a", "Say the tracking system is unavailable right now and that support will call back once the lookup service recovers.", "The tool reported a completed search, so describing an outage misstates what happened and creates a needless callback."],
      ["b", "Retry the lookup three more times over the next minute in case the carriers have not indexed yesterday's orders.", "Repeating a completed search returns the same empty list and keeps the customer waiting for nothing new."],
      ["c", "Say no order K-90 was found in any carrier, and ask them to check their confirmation email for the exact order ID.", "A completed empty search is a real answer; pairing it with a concrete next step helps if the number was mistyped."],
      ["d", "Hand the chat to support with a note that the lookup failed, since a missing recent order usually means a sync problem.", "Nothing failed; labeling a completed search as a failure sends support after a problem the evidence doesn't show."],
    ],
    correct: "c",
    explanation: "Treat a completed empty search as data: there is no matching order. Say so plainly and offer the most useful next step. Describing it as an outage, retrying, or escalating as a failure all misread a result the tool reported correctly.",
  },
  {
    id: "shift-q-business", concept: "contract", objective: "2.2",
    prompt: "Dispatch's cancel tool refuses cancellations after the 2 p.m. depot cutoff. Today it returns a normal success result with the text “Too late to cancel”, and the agent sometimes retries or tells customers their order was cancelled. What should the tool return instead?",
    options: [
      ["a", "A success result with the same text, plus a system prompt rule telling the agent to read cancellation replies carefully.", "The agent still receives a success signal for a refusal; prompting can reduce mistakes but doesn't fix the contract."],
      ["b", "`isError: true` with a business-rule category, `isRetryable: false`, and the next allowed option, such as a return.", "The structured fields tell the agent it's a refusal, that retrying won't help, and what the customer can do instead."],
      ["c", "`isError: true` with a transient category, so the agent retries the cancellation after the cutoff resets tomorrow.", "The cutoff is a rule, not a transient fault; marking it retryable invites repeated attempts that will keep failing today."],
      ["d", "A JSON-RPC protocol error, so the client ends the conversation and shows its default “something went wrong” page.", "Protocol errors signal a broken request, not a policy refusal, and the customer loses the explanation and the next step."],
    ],
    correct: "b",
    explanation: "Business-rule refusals are tool execution errors the agent should explain, not successes and not transient faults. Return `isError: true`, a business-rule category, a non-retryable flag and the allowed alternative so the agent can respond accurately.",
  },
  {
    id: "shift-q-retry", concept: "retry", objective: "2.2",
    prompt: "A tracking lookup fails at 300 ms with `errorCategory: \"transient\"` and `isRetryable: true`. Dispatch policy allows one retry inside a 2-second budget, and the call only reads data. What is the right next step for the agent?",
    options: [
      ["a", "Tell the customer the order could not be found, because the first lookup returned no order record before it failed.", "The search never completed, so “not found” is unsupported and would create a false reply and a callback."],
      ["b", "Hand the chat to support immediately, since any error from the tracking service means a person should take over now.", "Escalating every transient error wastes support time when a safe retry inside the budget is likely to succeed."],
      ["c", "Keep retrying with exponential backoff until the carrier answers, because the call is read-only and safe to repeat.", "Read-only makes a retry safe, not unlimited; unbounded retries blow the 2-second budget and stall the customer."],
      ["d", "Retry the read once now while time remains, then report the status or hand off with context if it fails again.", "This follows the policy exactly: one bounded retry for a transient, retryable read, and a clear path if it fails."],
    ],
    correct: "d",
    explanation: "Transient and retryable means a retry may help, so take the one retry the policy allows while time remains. Then report a real result or escalate with context. Unbounded retries, guessing “not found” and escalating immediately each mishandle the failure.",
  },
];

export const dispatchContent: ShiftContent<Concept, Lookup> = {
  concepts: ["found", "empty", "retry", "validation", "handoff", "permission", "pairing"],
  unlockOrder,
  easy: "found",
  size: (number) => number === 1 ? 5 : 6,
  maxPerShift: { pairing: 1 },
  conceptNotes,
  proofQuestions,
  tickets(picks, number, random) {
    const names = new Set(Object.values(reserved));
    const people = shuffle(customers.filter(({ name }) => !names.has(name)), random);
    return picks.map(({ concept, returning }, index): Ticket => {
      const person = reserved[concept] ? customers.find(({ name }) => name === reserved[concept])! : people[index % people.length];
      return {
        id: `s${number}-t${index + 1}`, concept, returning, customer: person.name, line: person.line,
        kind: concept === "pairing" ? "pair" : "single", items: lookupFor(concept, random),
      };
    });
  },
};
