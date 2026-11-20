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
        prompt: "The ticket service sometimes returns an empty array in 90 ms. It also sometimes times out after 400 ms, which the MCP tool currently converts to the same empty array. What is the best first change?",
        options: [
          ["prompt", "Update the agent instructions to qualify empty replies whenever the observed lookup duration is above 300 ms."],
          ["contract", "Keep completed empty results as data and return the upstream timeout as a structured tool execution error."],
          ["cache", "Return the last known open tickets when the service times out and attach their age to every reply."],
          ["verify", "Keep the existing response and have the assistant verify every empty result with a second lookup."],
        ],
        correct: ["contract"],
        explanation: "The tool already knows whether the service completed. Preserving that outcome fixes the contract for every caller. Timing is a proxy, the cache can serve stale state, and a second call can return the same ambiguous payload.",
      },
      {
        id: "retry",
        skill: "Fit local recovery within a latency budget",
        prompt: "A read-only ticket lookup has timed out once. A retry would take at most 400 ms, 600 ms remain in the request budget, and the dependency permits one local retry. Which two behaviors should the tool implement?",
        options: [
          ["retry", "Retry the read once inside the tool using the remaining deadline."],
          ["queue", "Queue a background refresh and return the latest cached ticket status as the current result."],
          ["handoff", "If the retry fails, return a transient tool error with the attempts made and preserve the unavailable status."],
          ["worker", "Escalate every initial timeout to a second agent that gets a fresh request budget."],
          ["shorten", "On a second timeout, shorten the requested date range and return the resulting ticket count."],
        ],
        correct: ["retry", "handoff"],
        explanation: "One local retry fits the budget and is safe for this read. A failed retry still leaves availability unknown. Cached data has different freshness, a new agent cannot reset the original deadline, and a narrower search answers a different question.",
      },
      {
        id: "validation",
        skill: "Return actionable validation feedback",
        prompt: "The booking tool accepts numeric station IDs. The input ‘14B’ could be an old alias for any of several stations, and the service has no alias resolver. Which response lets the assistant recover while avoiding a booking at the wrong station?",
        options: [
          ["strip", "Strip nonnumeric characters at the MCP boundary and return a note when the normalized booking succeeds."],
          ["schema", "Make the input schema numeric and use one generic invalid-request message for all booking failures."],
          ["suggest", "Infer the closest known station ID and include the original input in the booking confirmation."],
          ["clarify", "Return a validation tool error identifying station ID as the field to correct and ask for the numeric ID before resubmitting."],
        ],
        correct: ["clarify"],
        explanation: "The request needs a corrected value before it can be retried safely. Normalization and guessing can act on the wrong station. A schema helps prevent malformed calls, but one generic error hides the field and blurs other failure categories.",
      },
      {
        id: "policy",
        skill: "Handle permission and business-rule failures",
        prompt: "A rider requests technician-only notes. On a separate, authorized booking request, the same rider hits a two-visit account limit. Which two handling rules let the assistant offer a useful response within the service policy?",
        options: [
          ["permission", "Return a permission error for the notes with only the approved access route, if available."],
          ["mask", "Return an empty notes list to preserve privacy and let the assistant offer to check another station."],
          ["limit-retry", "Label the visit limit transient and have the assistant retry once after refreshing the account."],
          ["business", "Return a non-retryable business error for the visit limit with the option to manage an existing booking."],
          ["generic", "Use the same permission response for both failures and send both requests to an administrator."],
        ],
        correct: ["permission", "business"],
        explanation: "The notes restriction depends on who can view the data. The booking limit applies to an authorized rider until their bookings change. A shared denial, an empty list, or an immediate retry would each hide an actionable distinction.",
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
        prompt: "The lighting inventory returns a completed empty search for spotlights. The sound inventory times out twice and the deadline has expired. Which response best serves an event planner who asked about spotlights and microphones?",
        options: [
          ["all-unknown", "Report that availability across the center is unknown until both inventories can be checked again."],
          ["all-empty", "Report no available spotlights or microphones and note that the catalog may lag behind actual stock."],
          ["partial", "Report zero matches for spotlights, mark microphone availability unconfirmed, and include the sound lookup attempts in the handoff."],
          ["estimate", "Report no available spotlights and use last week’s sound inventory as the current microphone count."],
        ],
        correct: ["partial"],
        explanation: "The lighting result is verified for the requested scope. Sound remains unavailable after its retry. Keeping the verified result and the coverage gap helps staff continue without implying completeness.",
      },
      {
        id: "execution",
        skill: "Design a tool execution error contract",
        prompt: "An authenticated staff member requests a ten-day loan. The request reaches the reservation tool, which rejects it before any write under the seven-day limit. Which two choices belong in the tool’s response design?",
        options: [
          ["rpc", "Use a JSON-RPC unknown-tool error so the client can distinguish it from reservation success."],
          ["flag", "Set isError to true on the MCP tool result."],
          ["success", "Return a successful response with an empty reservation ID and place the rejection in the text."],
          ["payload", "Include a business-rule category, non-retryable flag, and an explanation of the maximum loan period."],
          ["retryable", "Mark the same ten-day request retryable because the assistant could shorten it on another call."],
        ],
        correct: ["flag", "payload"],
        explanation: "The tool ran and returned an actionable policy failure. MCP’s result flag signals the failure. Application fields explain what must change. A shorter loan is a changed request and needs separate approval.",
      },
      {
        id: "permission",
        skill: "Keep authorization decisions intact",
        prompt: "The stockroom inventory requires a staff role. A volunteer’s first call fails with a temporary network issue. After connectivity returns, the server responds with permission denied for the volunteer’s current identity. What should the assistant do next?",
        options: [
          ["retry", "Continue the transient retry policy because the first failure was network-related."],
          ["access", "Use the new permission outcome, stop retrying with that identity, and explain the approved access process."],
          ["filter", "Retry using a narrower inventory filter to see whether the denial is limited to particular items."],
          ["review", "Have a staff worker fetch the inventory and give the volunteer a summarized result."],
        ],
        correct: ["access"],
        explanation: "The latest call reached the service and established a permission boundary. Prior connectivity trouble does not change that result. A narrower request or a more privileged worker does not grant the volunteer access.",
      },
      {
        id: "write",
        skill: "Distinguish safe retries from uncertain writes",
        prompt: "A reservation write timed out after the service may have accepted it. The tool has no idempotency key, but a read-only lookup can search for the reservation by request reference. What is the best next action?",
        options: [
          ["repeat", "Apply the same single-retry rule used for read-only requests and repeat the reservation write."],
          ["cancel", "Send a cancellation for the asset and retry the write once the cancellation returns."],
          ["unknown", "Mark the reservation as failed and ask the requester to start a new reservation."],
          ["verify", "Check the reservation by reference first. If the outcome remains uncertain, hand it off with the reference and attempt history."],
        ],
        correct: ["verify"],
        explanation: "A timeout can leave a write committed. The reference lookup can resolve that uncertainty without changing state. Repeating, cancelling, or inviting a new reservation risks duplicate or unintended changes.",
      },
    ],
  },
};

export function checkForAttempt(stage: CheckStage, checkId: string): SkillCheck {
  const legacy = legacySkillChecks[stage];
  if (legacy.id !== checkId) return skillChecks[stage];
  return { ...legacy, questions: legacy.questions.map((question) => ({ ...question, correct: [question.correct] })) };
}
