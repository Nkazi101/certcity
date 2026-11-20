import { tracks } from "./claude/blueprints";

export const architectFoundations = {
  title: "Claude Certified Architect: Foundations",
  guide: tracks.find(({ id }) => id === "architect-foundations")!.guide,
  program: "https://claude.com/resources/articles/four-role-based-claude-certifications",
  specification: "https://modelcontextprotocol.io/specification/2026-07-28/server/tools#error-handling",
  objective: "Implement structured error responses for MCP tools",
  task: "2.2",
  taskCount: 30,
} as const;

function toolResult(structuredContent: Record<string, unknown>, isError: boolean) {
  return {
    resultType: "complete",
    isError,
    structuredContent,
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
  };
}

export const lookupResults = [
  {
    title: "Completed, zero matches",
    action: "Report that the search completed and found zero orders. Return the empty list as data.",
    result: toolResult({ orders: [] }, false),
  },
  {
    title: "T-17, upstream timeout",
    action: "Retry the read once in this shift. If it still fails, report unavailability and pass the attempted action to support.",
    result: toolResult({ errorCategory: "transient", isRetryable: true, message: "The shipment lookup timed out." }, true),
  },
] as const;

export const otherErrors = [
  { title: "Validation", example: "The tracking number has an invalid format.", action: "Ask for the corrected number. Repeating the same input will fail again." },
  { title: "Permission", example: "The caller lacks access to the order.", action: "Respect the access decision and give a safe explanation. Offer the approved access process if one exists." },
  { title: "Business rule", example: "An authorized customer requests a cancellation after the depot cutoff.", action: "Mark it non-retryable, explain the cutoff and offer the next allowed option." },
] as const;

export type CheckStage = "first" | "followup";

type Question = {
  id: string;
  skill: string;
  prompt: string;
  options: readonly (readonly [id: string, label: string])[];
  correct: string;
  explanation: string;
};

type LegacySkillCheck = {
  id: string;
  title: string;
  context: string;
  questions: readonly Question[];
};

export const legacySkillChecks: Record<CheckStage, LegacySkillCheck> = {
  first: {
    id: "bike-share-service.v1",
    title: "Bike-share service desk",
    context: "A city bike-share assistant checks repair tickets and makes service bookings. Review its tool outcomes before the team enables the assistant for riders.",
    questions: [
      {
        id: "lookup",
        skill: "Distinguish empty results from unavailability",
        prompt: "Station 14’s ticket query completed with an empty array. Station 32’s upstream ticket service timed out before returning data. What should the assistant tell staff?",
        options: [
          ["both-empty", "Report no open tickets at either station because neither response contains a ticket."],
          ["separate", "Report no open tickets at Station 14 and say Station 32’s ticket status is unavailable."],
          ["both-unknown", "Say both stations are unverified until a second search returns at least one ticket."],
        ],
        correct: "separate",
        explanation: "Station 14’s completed query establishes that the search found no open tickets. Station 32’s timeout leaves its ticket status unknown.",
      },
      {
        id: "format",
        skill: "Recover from invalid input",
        prompt: "The booking tool rejects station code ‘14B’ because codes must be numeric. The app has no way to infer the intended station. What should it do?",
        options: [
          ["trim", "Remove the letter and book a visit for station 14."],
          ["retry", "Treat the rejection as transient and retry the original request after a short pause."],
          ["clarify", "Return a validation error and ask the rider for a numeric station code before trying again."],
        ],
        correct: "clarify",
        explanation: "The same input will fail validation again. Ask for the correct code so the next attempt uses the intended station.",
      },
      {
        id: "access",
        skill: "Respect access boundaries",
        prompt: "A rider asks for a repair log restricted to technicians. Their role has been confirmed and the tool returns access denied. How should the assistant respond?",
        options: [
          ["permission", "Return a non-retryable permission error and explain the approved access route without revealing log details."],
          ["filter", "Return a validation error and ask for a narrower date range to make the log accessible."],
          ["override", "Ask another worker with broader access to fetch the log for the rider."],
        ],
        correct: "permission",
        explanation: "The rider’s role is the reason for the failure. Filtering the request or routing it through a more privileged worker leaves that access restriction in place.",
      },
      {
        id: "policy",
        skill: "Handle a business rule",
        prompt: "The rider has permission to book. The tool rejects tomorrow’s booking because the rider already holds the maximum of two active visits. What should the result communicate?",
        options: [
          ["transient", "The booking service is temporarily busy. Retry the same request in the background."],
          ["permission", "The rider lacks booking permission. Direct them to an administrator for access."],
          ["business", "The active-visit limit was reached. Mark the outcome non-retryable and explain that the rider can manage an existing booking."],
        ],
        correct: "business",
        explanation: "The rider has access and the request reached the service. The booking limit is a business rule. A useful response explains the constraint and an allowed next step.",
      },
      {
        id: "contract",
        skill: "Return a structured tool error",
        prompt: "The ticket tool receives a valid read request, but its upstream service times out. Its recovery policy allows one safe retry. Which result lets the assistant recognize the failure and apply the policy?",
        options: [
          ["tool", "Return isError: true with a transient category and isRetryable: true in structuredContent."],
          ["empty", "Return isError: false and an empty ticket list, with a note about the timeout in the text block."],
          ["rpc", "Return a JSON-RPC unknown-tool error and have the assistant call the same tool again whenever that code appears."],
        ],
        correct: "tool",
        explanation: "The tool received the call and encountered an execution failure. MCP’s error flag signals the failure and the application payload gives the assistant what it needs to apply the one-retry policy.",
      },
    ],
  },
  followup: {
    id: "arts-center-equipment.v1",
    title: "Arts center equipment desk",
    context: "An arts center uses a tool-using assistant to lend lighting and sound equipment. Review the latest availability checks and loan requests before tomorrow’s events.",
    questions: [
      {
        id: "absence",
        skill: "Interpret a completed search",
        prompt: "The availability tool successfully searches all lendable equipment for Friday and returns zero projectors. The assistant has no conflicting source. What should it report?",
        options: [
          ["outage", "The catalog is unavailable because the projector list is empty."],
          ["unverified", "Friday’s result is inconclusive until the search finds a projector on another date."],
          ["empty", "The search found no projectors available to lend on Friday."],
        ],
        correct: "empty",
        explanation: "The tool completed the scoped search. The empty list supports an answer about Friday’s lendable stock.",
      },
      {
        id: "recovery",
        skill: "Apply a bounded retry",
        prompt: "A read-only lighting lookup times out. Its policy allows one retry within the deadline. The retry also times out. What should the worker do now?",
        options: [
          ["wait", "Start another retry because the category is still transient."],
          ["handoff", "Stop retrying and return the unavailable result with the attempt history for staff follow-up."],
          ["empty", "Return no available lighting because two attempts found no rows."],
        ],
        correct: "handoff",
        explanation: "Retryability allows recovery within the tool’s budget. Once the budget is exhausted, communicate unavailability and carry forward what was attempted.",
      },
      {
        id: "rules",
        skill: "Distinguish policy and permission",
        prompt: "A volunteer requests an inventory view reserved for staff. Separately, a staff member requests a loan longer than the published seven-day limit. How should the tool classify these failures?",
        options: [
          ["pair", "Permission for the inventory view and business rule for the loan. Explain the allowed next step for each."],
          ["validation", "Validation for both. Ask each person to resubmit the same request with a more detailed explanation."],
          ["permission", "Permission for both. Direct both people to the staff access request process."],
        ],
        correct: "pair",
        explanation: "The inventory decision is based on who may view the data. The loan decision is based on a lending rule that applies even to authorized staff.",
      },
      {
        id: "contract",
        skill: "Encode a tool execution failure",
        prompt: "The MCP call reached the loan tool, which rejected an invalid asset ID. The assistant needs an actionable tool result. Which contract fits?",
        options: [
          ["success", "Return an empty success and place ‘bad ID’ in the human-readable text."],
          ["rpc", "Use a JSON-RPC unknown-tool error for every rejection returned by the loan service."],
          ["tool", "Set isError on the tool result and return validation and retryability fields in the application payload."],
        ],
        correct: "tool",
        explanation: "The tool ran and rejected its input. MCP provides isError for that execution result. The application’s validation and retryability fields help the assistant choose the next action.",
      },
    ],
  },
};
