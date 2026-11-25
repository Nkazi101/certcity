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
        skill: "Distinguish an empty result from a rate-limited lookup",
        prompt: "Before launch, staff review two station checks. Station 14’s `get_tickets` result is `isError: false` with `tickets: []` for open repairs. Station 32’s result is `isError: true` with `errorCategory: \"rate_limited\"` and `retryAfterSeconds: 20`, returned before any rows were read. A rider is asking about both stations right now. What should the assistant tell staff?",
        options: [
          ["both-empty", "Report no open repair tickets at either station, since neither result contains a single ticket row."],
          ["separate", "Report no open tickets at Station 14; Station 32 stays unconfirmed until a retry after 20 seconds."],
          ["both-unknown", "Report both stations as unverified until a second search at each one returns at least one ticket."],
        ],
        correct: "separate",
        explanation: "Station 14’s completed search is evidence that no open tickets exist. Station 32 was rate limited before reading any rows, so its status is unknown and can be retried after 20 seconds. Treating the error as an empty list hides the failure, and demanding a ticket before trusting a search discards a valid answer.",
      },
      {
        id: "format",
        skill: "Recover from invalid input",
        prompt: "The booking tool rejects station code `14B` with `isError: true`, `errorCategory: \"validation\"` and `field: \"station_id\"`, because codes must be numeric. Station IDs 14, 140 and 214 all exist, and the service has no alias table. The rider is still in the chat. What should the assistant do?",
        options: [
          ["trim", "Strip the letter, book a visit at station 14, and mention the correction in the booking confirmation."],
          ["retry", "Treat the rejection as transient and resend the same `14B` request after a short pause in the background."],
          ["clarify", "Tell the rider the station code must be numeric and ask which station they mean before trying again."],
        ],
        correct: "clarify",
        explanation: "A validation error means the same input will fail again, so retrying is pointless. Because 14, 140 and 214 all exist, stripping the letter could book the wrong station. Ask the rider for the corrected field the error names, then resubmit with the value they confirm.",
      },
      {
        id: "access",
        skill: "Respect access boundaries",
        prompt: "A rider asks for station 9’s repair log. The rider’s role is confirmed as `rider`, and the log tool returns `isError: true`, `errorCategory: \"permission\"` and `isRetryable: false`, noting the log is limited to technicians. A technician subagent in the same deployment can read every log. How should the assistant respond?",
        options: [
          ["permission", "Explain that repair logs are restricted to technicians and offer the approved access route, without log details."],
          ["filter", "Treat it as a validation error and ask the rider for a narrower date range that might make the restricted log accessible."],
          ["override", "Ask the technician subagent to fetch the log on the rider’s behalf and share a short summary of it."],
        ],
        correct: "permission",
        explanation: "The denial is about who is asking, and it is marked non-retryable. Respect it, explain the restriction safely, and point to an approved access route. Narrowing the request does not change the rider’s role, and routing through a more privileged subagent bypasses the boundary the tool enforced.",
      },
      {
        id: "policy",
        skill: "Handle a business rule",
        prompt: "A rider with booking permission asks for a visit tomorrow. The tool returns `isError: true`, `errorCategory: \"business_rule\"`, `isRetryable: false` and `message: \"limit of 2 active visits reached\"`; the rider already holds visits on Monday and Wednesday. Last month, retries of this error created 14 duplicate support tickets. What should the result communicate?",
        options: [
          ["transient", "That the booking service is briefly busy, with the same request retried in the background until it succeeds."],
          ["permission", "That the rider lacks booking permission, directing them to an administrator to have their access upgraded."],
          ["business", "That the two-visit limit is reached, so the rider can cancel or move Monday’s or Wednesday’s visit instead."],
        ],
        correct: "business",
        explanation: "The rider is authorized and the request reached the service, so this is a business-rule failure, not a permission or transient one. A non-retryable rule needs a clear explanation and an allowed next step, such as changing an existing visit; background retries are what created the duplicate tickets.",
      },
      {
        id: "contract",
        skill: "Return a structured tool error",
        prompt: "You maintain the MCP `get_tickets` tool. On a valid read request, the upstream ticket API returns `503 Service Unavailable`; the tool’s recovery policy allows one retry within the 1.2 s budget the agent has left. Today the tool returns an empty ticket list in this case. Which tool result lets the agent recognize the failure and apply the policy?",
        options: [
          ["tool", "A result with `isError: true`, plus `errorCategory: \"transient\"`, `isRetryable: true` and the 503 status in `structuredContent`."],
          ["empty", "A result with `isError: false` and an empty ticket list, adding a note about the 503 in the text block."],
          ["rpc", "A JSON-RPC unknown-tool error, so the agent calls the same tool again whenever that error code appears."],
        ],
        correct: "tool",
        explanation: "The tool received the call and hit an execution failure, so it should return a tool result with isError set and machine-readable category and retryability. That lets the agent apply its one-retry policy. An empty success hides the outage, and a JSON-RPC protocol error misdescribes a known tool that actually ran.",
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
        prompt: "The availability tool searches all lendable equipment for Friday and returns `isError: false` with `structuredContent: {\"projectors\": [], \"catalogVersion\": \"2026-11-24\"}`. Both center projectors are booked by a school group, and no other system lists projectors. A planner asks whether one can be borrowed on Friday. What should the assistant report?",
        options: [
          ["outage", "That the equipment catalog appears to be unavailable, because the projector list came back completely empty."],
          ["unverified", "That Friday’s result is inconclusive until a search for another date finds at least one projector."],
          ["empty", "That the search completed against the current catalog and found no projectors available to lend on Friday."],
        ],
        correct: "empty",
        explanation: "A completed search with isError false and a current catalog version is evidence of absence for that scope. Treating an empty list as an outage confuses absence with failure, and requiring a match on another date before trusting the answer discards a valid result the planner can act on.",
      },
      {
        id: "recovery",
        skill: "Apply a bounded retry",
        prompt: "A read-only lighting lookup returns `isError: true`, `errorCategory: \"rate_limited\"` and `retryAfterSeconds: 90`. The assistant’s response deadline is 30 seconds away, and the policy allows one retry only if it fits within the deadline. An event coordinator is waiting for an answer about spotlights. What should the assistant do now?",
        options: [
          ["wait", "Wait the full 90 seconds and then retry, because the error category is retryable and the coordinator's answer matters."],
          ["handoff", "Skip the retry, report spotlight availability as unconfirmed, and pass the attempt and retry time to staff."],
          ["empty", "Report that no spotlights are available, because the lookup returned no lighting rows to the assistant."],
        ],
        correct: "handoff",
        explanation: "Retryability says a retry could succeed, but the 90-second wait exceeds the 30-second deadline the policy allows. The assistant should say availability is unconfirmed and hand staff the attempt and retry time. Waiting breaks the deadline, and reporting no stock turns a failure into a false answer.",
      },
      {
        id: "rules",
        skill: "Distinguish policy and permission",
        prompt: "Two tool calls fail on the same afternoon. A volunteer’s request for the staff inventory view returns `errorCategory: \"permission\"`. A staff member’s 10-day loan request returns `errorCategory: \"business_rule\"` with `maxLoanDays: 7`; staff are allowed to request loans. Both people ask what to do next. How should the assistant handle these failures?",
        options: [
          ["pair", "Explain that the view is staff-only with its access route, and offer the staff member a loan of 7 days."],
          ["validation", "Treat both as validation errors and ask each person to resubmit the same request with more supporting detail."],
          ["permission", "Treat both as access problems and send both people to the staff access request process for approval."],
        ],
        correct: "pair",
        explanation: "The inventory denial depends on who is asking, so the answer is an access route. The loan denial applies a lending rule to an authorized person, so the answer is an allowed alternative such as a seven-day loan. Resubmitting unchanged requests or sending everyone to access requests helps neither person.",
      },
      {
        id: "contract",
        skill: "Encode a tool execution failure",
        prompt: "The loan tool receives a valid MCP call with `asset_id: \"LX-0\"`, which matches no asset because IDs run from LX-1 to LX-240. The tool currently returns `{\"reservation\": null}` with `isError: false`, and the assistant told 3 staff members their loans were confirmed. Which result contract fits?",
        options: [
          ["success", "Keep the successful empty result and put ‘bad asset ID’ in the human-readable text block for the model."],
          ["rpc", "Return a JSON-RPC unknown-tool error for every rejection the loan service produces, including invalid IDs."],
          ["tool", "Set `isError: true` with a validation category, the invalid field and `isRetryable: false` in the payload."],
        ],
        correct: "tool",
        explanation: "The tool ran and rejected its input, which is a tool execution error. Setting isError with a validation category and the invalid field lets the assistant ask for a corrected asset ID. A successful-looking result caused the false confirmations, and protocol errors are for unknown tools or malformed requests.",
      },
    ],
  },
};
