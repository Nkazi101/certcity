import { legacySkillChecks } from "./certification";
import type { CheckStage } from "./certification";

export type ExamQuestion = {
  id: string;
  skill: string;
  prompt: string;
  options: readonly (readonly [id: string, label: string])[];
  correct: readonly string[];
  explanation: string;
};

export type SkillCheck = {
  id: string;
  title: string;
  context: string;
  questions: readonly ExamQuestion[];
};

export const skillChecks: Record<CheckStage, SkillCheck> = {
  first: {
    id: "bike-share-service.v2",
    title: "Bike-share support assistant",
    context: "You’re preparing a Claude Agent SDK assistant for the city’s bike-share network. It uses MCP tools to check station repair tickets, book maintenance visits, and look up technician notes. Public ticket lookups must reply within 1.2 seconds. Station staff need accurate outage messages, and the MCP server must enforce account access and booking limits.",
    questions: [
      {
        id: "lookup",
        skill: "Preserve the meaning of lookup outcomes",
        prompt: "A week of logs shows 212 ‘no open tickets’ replies. In 37 of them the depot API had returned `401 token_expired`, which the MCP `get_tickets` tool converts to the same `{\"tickets\": []}` it returns for a completed empty search. Riders at 4 stations were told repairs were finished when they were not. What is the best first change?",
        options: [
          ["prompt", "Tell the agent in its instructions to describe empty results as uncertain at stations with recent login problems."],
          ["contract", "Keep completed empty searches as data, and return the expired token as a structured tool error with its category."],
          ["cache", "When the depot API rejects the token, return the last cached open tickets and attach their age to the reply."],
          ["verify", "Keep the current response and have the agent verify every empty result with a second identical lookup."],
        ],
        correct: ["contract"],
        explanation: "The tool knows whether the search completed, so the fix belongs in its contract: completed empty results stay data, and an authentication failure becomes a tool error the agent can act on. Prompt hedging guesses, cached tickets may be stale, and a second identical lookup returns the same ambiguous empty list.",
      },
      {
        id: "retry",
        skill: "Fit local recovery within a latency budget",
        prompt: "The depot API answers a read-only ticket lookup with `429 Too Many Requests` and a 300 ms retry-after hint. The public reply budget is 1.2 s and 700 ms remain; a retry takes at most 250 ms after the wait, and the dependency permits one local retry. Which two behaviors should the tool implement?",
        options: [
          ["retry", "Wait out the 300 ms hint and retry the read once inside the tool, within the remaining 700 ms budget."],
          ["queue", "Queue a background refresh and return the latest cached ticket status as if it were the current result."],
          ["handoff", "If the retry also fails, return a transient tool error with the attempts made and leave status unconfirmed."],
          ["worker", "Hand every first 429 to a second subagent that starts with a fresh 1.2 s request budget of its own."],
          ["shorten", "On a second 429, shorten the requested date range and return whatever ticket count that narrower search finds."],
        ],
        correct: ["retry", "handoff"],
        explanation: "Waiting 300 ms and retrying once fits the 700 ms left, and the read is safe to repeat. If that retry fails, availability is still unknown, so return a structured transient error with the attempts. Cached data has different freshness, a new subagent cannot reset the rider’s deadline, and a narrower search answers another question.",
      },
      {
        id: "validation",
        skill: "Return actionable validation feedback",
        prompt: "The booking tool accepts numeric station IDs only. Last week 23 requests passed names such as `Union Sq`, which matches stations 31 and 58 at opposite entrances, and the service has no name resolver. Two of those requests were auto-matched by the agent and booked the wrong entrance. Which tool response lets the assistant recover safely?",
        options: [
          ["strip", "Resolve the name at the MCP boundary to the first matching station and note the choice in the confirmation."],
          ["schema", "Make the input schema numeric and return one generic invalid-request message for every kind of booking failure it sees."],
          ["suggest", "Pick the station with the most past bookings for that name and include the original text in the confirmation."],
          ["clarify", "Return a validation error naming `station_id` as the field to fix, so the assistant asks which entrance is meant."],
        ],
        correct: ["clarify"],
        explanation: "The request needs a corrected value before it can safely run, and only the rider knows which entrance they mean. A validation error that names the field lets the assistant ask. Auto-matching and popularity guesses can book the wrong station, and one generic error hides which field to fix.",
      },
      {
        id: "policy",
        skill: "Handle permission and business-rule failures",
        prompt: "A rider asks for technician-only maintenance notes and gets `errorCategory: \"permission\"`. In a separate, authorized request, the same rider tries to book a third visit and hits the two-visit account limit. Support logged 31 complaints last month about unclear denials. Which two handling rules let the assistant respond usefully within policy?",
        options: [
          ["permission", "Return a permission error for the notes, with only the approved access route and no note content."],
          ["mask", "Return an empty notes list to protect privacy and let the assistant offer to check another station instead."],
          ["limit-retry", "Label the visit limit transient and have the assistant retry once after refreshing the rider’s account."],
          ["business", "Return a non-retryable business-rule error for the visit limit, offering to change one existing booking."],
          ["generic", "Use one shared permission message for both failures and route both requests to an administrator."],
        ],
        correct: ["permission", "business"],
        explanation: "The notes restriction depends on who can view the data; the booking limit applies to an authorized rider until their bookings change. Each needs its own category and next step. An empty list hides the denial, an immediate retry repeats a rule failure, and one generic message produces the unclear denials behind the complaints.",
      },
    ],
  },
  followup: {
    id: "arts-center-equipment.v2",
    title: "Arts center equipment assistant",
    context: "A Claude assistant helps a city arts center lend sound and lighting equipment. Two MCP tools read separate inventories, and a reservation tool enforces a seven-day loan limit. A coordinator needs to tell event staff which inventory was checked. One read retry is allowed within the deadline. Reservations require explicit approval before any new write.",
    questions: [
      {
        id: "coverage",
        skill: "Communicate checked and unavailable inventory",
        prompt: "A planner asks about spotlights and microphones for Saturday. The lighting inventory returns a completed search with `spotlights: []`. The sound inventory returns `isError: true`, `errorCategory: \"unavailable\"` and `message: \"maintenance window until 18:00\"`; it is 16:40 and the planner needs an answer by 17:00. Which response best serves the planner?",
        options: [
          ["all-unknown", "Report that availability across the center is unknown until both inventories can be checked after 18:00."],
          ["all-empty", "Report no spotlights or microphones available, noting that the catalog may lag behind actual stock levels."],
          ["partial", "Report no spotlights, mark microphones unconfirmed until 18:00, and pass the sound attempt to staff."],
          ["estimate", "Report no spotlights and use last week’s sound inventory count as the current microphone availability."],
        ],
        correct: ["partial"],
        explanation: "The lighting result is a completed search, so it answers the spotlight question now. The sound inventory failed and will not return before the planner’s deadline, so microphone availability is unconfirmed. Keeping the verified answer and the explicit gap serves the planner without implying completeness or presenting stale counts as current.",
      },
      {
        id: "execution",
        skill: "Design a tool execution error contract",
        prompt: "An authenticated staff member requests a ten-day loan of a mixing desk. The call reaches the reservation tool, which rejects it before any write because the published limit is seven days. Last month the assistant retried 19 such rejections as if they were outages. Which two choices belong in the tool’s response?",
        options: [
          ["rpc", "Return a JSON-RPC unknown-tool error so the client can tell this rejection apart from a reservation success."],
          ["flag", "Set `isError` to true on the MCP tool result so the client and agent both see the call as failed."],
          ["success", "Return a successful response with an empty reservation ID and describe the rejection in the text content."],
          ["payload", "Include a business-rule category, `isRetryable: false`, and the seven-day maximum so the assistant can offer it."],
          ["retryable", "Mark the ten-day request retryable, since the assistant could shorten it to seven days on another call."],
        ],
        correct: ["flag", "payload"],
        explanation: "The tool ran and returned a policy failure, so the MCP result flag marks it as an error and the payload explains what must change. A non-retryable business category stops the outage-style retries. A shorter loan is a different request that needs its own approval, not a retry of this one.",
      },
      {
        id: "permission",
        skill: "Keep authorization decisions intact",
        prompt: "A volunteer opens the stockroom inventory, which requires a staff role. The first call fails with `errorCategory: \"transient\"` during a network blip. Thirty seconds later, with connectivity restored, the server returns `errorCategory: \"permission\"` and `isRetryable: false` for the volunteer’s current identity. The retry policy allows two attempts. What should the assistant do next?",
        options: [
          ["retry", "Use the second allowed attempt, since the first failure was a transient network problem that may simply recur."],
          ["access", "Act on the latest permission result, stop retrying with this identity, and explain the approved access route."],
          ["filter", "Retry with a narrower inventory filter to confirm whether the denial covers only some stockroom items."],
          ["review", "Ask a staff subagent to fetch the inventory and give the volunteer a summarized version of the result."],
        ],
        correct: ["access"],
        explanation: "The latest call reached the service and established a non-retryable permission boundary, which supersedes the earlier transient failure. Retrying or narrowing the request cannot change the volunteer’s role, and routing through a staff subagent would bypass the access control. Explain the restriction and the approved route instead.",
      },
      {
        id: "write",
        skill: "Distinguish safe retries from uncertain writes",
        prompt: "A reservation write for a projector timed out after 8 s; the service log later shows it may have accepted the request. The tool sends no idempotency key, but a read-only lookup can search reservations by request reference `REQ-5521`. Last quarter, repeated writes created 6 double bookings. What is the best next action?",
        options: [
          ["repeat", "Apply the same single-retry rule used for read-only requests and send the reservation write again."],
          ["cancel", "Send a cancellation for the projector first, then retry the reservation write once that cancellation returns."],
          ["unknown", "Mark the reservation as failed and ask the requester to start a brand new reservation from the beginning."],
          ["verify", "Look up `REQ-5521` first; if the outcome is still uncertain, hand off with the reference and attempt history."],
        ],
        correct: ["verify"],
        explanation: "A timed-out write may have committed, so repeating it risks another double booking. The read-only lookup by request reference resolves the uncertainty without changing state. Cancelling could remove someone else’s valid booking, and declaring failure invites a duplicate; if the lookup is inconclusive, hand off with the reference and attempts.",
      },
    ],
  },
};

export function checkForAttempt(stage: CheckStage, checkId: string): SkillCheck {
  const legacy = legacySkillChecks[stage];
  if (legacy.id !== checkId) return skillChecks[stage];
  return { ...legacy, questions: legacy.questions.map((question) => ({ ...question, correct: [question.correct] })) };
}
