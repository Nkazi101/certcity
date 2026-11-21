import { jsonObject, test } from "./model";
import type { CapstoneDefinition, CapstoneStage } from "./model";

type ToolCall = { type: "tool_use"; id: string; name: string; input: { code: string } };
type Completion = { key: string; text: string; failed: boolean };
type Replay = {
  label: string;
  assistant: { role: "assistant"; content: ({ type: "text"; text: string } | ToolCall)[] };
  calls: ToolCall[];
  completions: Completion[];
};

type DeveloperCase = {
  id: string;
  stage: CapstoneStage;
  title: string;
  brief: string;
  tool: string;
  key: string;
  payload: string;
  failure: string;
  records: readonly [string, string];
  lookup: readonly [string, string];
};

function fixtures(input: DeveloperCase): Replay[] {
  const calls: ToolCall[] = input.records.map((code, index) => ({
    id: `tool_${index + 1}`, type: "tool_use", name: input.tool, input: { code },
  }));
  const assistant: Replay["assistant"] = { role: "assistant", content: [{ type: "text", text: "I’ll check both records." }, ...calls] };
  return [
    {
      label: "Out-of-order receipts", assistant, calls,
      completions: [{ key: "tool_2", text: input.lookup[1], failed: false }, { key: "tool_1", text: input.lookup[0], failed: false }],
    },
    {
      label: "Empty result and timeout", assistant, calls,
      completions: [{ key: "tool_2", text: "The service timed out.", failed: true }, { key: "tool_1", text: "No matching record.", failed: false }],
    },
  ];
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function simulate(input: DeveloperCase, replay: Replay, adapter: Record<string, unknown> | null) {
  const assistant = record(adapter?.assistantTurn);
  const matcher = record(adapter?.match);
  const template = record(adapter?.result);
  const evaluate = (value: unknown, call: ToolCall, completion?: Completion) => {
    if (value === "$call.id") return call.id;
    if (value === "$call.input.code") return call.input.code;
    if (value === `$receipt.${input.key}`) return completion?.key;
    if (value === `$receipt.${input.payload}`) return completion?.text;
    if (value === `$receipt.${input.failure}`) return completion?.failed;
    if (typeof value === "string" && value.startsWith("$")) return undefined;
    return value;
  };

  const results = replay.calls.flatMap((call, position) => {
    const left = evaluate(matcher.call, call);
    const receipt = matcher.method === "index" ? replay.completions[position] : replay.completions.find((candidate) => {
      const right = evaluate(matcher.receipt, call, candidate);
      return left !== undefined && right === left;
    });
    if (!receipt) return [];
    const block = Object.fromEntries(Object.entries(template).map(([id, value]) => [id, evaluate(value, call, receipt)]));
    return [{ block, source: receipt.key }];
  });

  return {
    messages: [
      { role: assistant.role, content: assistant.content === "$assistant.content" ? replay.assistant.content : assistant.content },
      { role: adapter?.resultRole, content: results.map(({ block }) => block) },
    ],
    results,
  };
}

function integration(input: DeveloperCase): CapstoneDefinition {
  const runs = fixtures(input);
  const sample = runs[0];
  const toolRecords = sample.completions.map(({ key, text, failed }) => ({
    [input.key]: key, [input.payload]: text, [input.failure]: failed,
  }));
  const initial = JSON.stringify({
    assistantTurn: { role: "assistant", content: "I’ll check both records." },
    match: { method: "index", call: "$call.input.code", receipt: `$receipt.${input.key}` },
    resultRole: "assistant",
    result: { type: "tool_result", tool_use_id: "$call.id", content: "", is_error: false },
  }, null, 2);

  return {
    id: input.id, stage: input.stage, title: input.title, role: "Integration bench",
    brief: input.brief,
    deliverable: "Repair the JSON adapter and show that the next Messages API turn preserves tool calls and distinguishes an empty lookup from a failed one.",
    documents: [
      { id: "TRACE", title: "Captured assistant message", text: JSON.stringify(sample.assistant, null, 2), format: "json" },
      { id: "RECEIPTS", title: "Service completions in arrival order", text: JSON.stringify(toolRecords, null, 2), format: "json" },
      {
        id: "ADAPTER", title: "Fixture runner interface",
        text: [
          "The adapter builds two messages. Keep the draft’s JSON structure, including the braces and quoted keys. Edit assistantTurn.role and assistantTurn.content, then set resultRole and the template for each result block.",
          "Bindings available in this exercise are $assistant.content, $call.id, $call.input.code, and the receipt fields listed in RECEIPTS. Use $receipt. followed by the field name.",
          "Set match.method to index or equal. Index pairs by arrival order. Equal finds a receipt by comparing match.call and match.receipt.",
          "The fixture runner substitutes bindings and checks both a reordered completion stream and an empty result paired with a timeout. This adapter uses an explicit true or false error flag for every result block.",
        ].join("\n\n"),
      },
    ],
    fields: [{ id: "adapter", label: "Tool-loop adapter", editor: "json", initial }],
    criteria: [
      {
        id: "history", title: "Preserve the assistant turn",
        objectives: ["1.2", "6.1"], revisedObjectives: ["1.2", "6.1"],
        review: "Keep the full content array when appending the assistant turn so tool requests and surrounding text still describe the same response.",
      },
      {
        id: "association", title: "Correlate by invocation ID",
        objectives: ["2.3", "8.1"], revisedObjectives: ["2.1", "8.1"],
        review: "Match the ID of the tool invocation to the identifier returned by the worker. Results can complete in a different order.",
      },
      {
        id: "result-turn", title: "Build a valid tool result message",
        objectives: ["2.3"], revisedObjectives: ["2.1", "2.4"],
        review: "Return client tool results in the next user message. Each block needs the tool use ID, a content value, and the tool_result type.",
      },
      {
        id: "failure", title: "Preserve the difference between empty and failed",
        objectives: ["4.1", "6.3"], revisedObjectives: ["4.2", "6.3"],
        review: "A successful empty lookup makes a claim about the checked records. A timeout means the lookup could not resolve the claim. Carry the actual error flag into its result.",
      },
    ],
    runs: runs.map(({ label }, index) => ({ id: String(index), label })),
    preview: ({ adapter }, run) => {
      const parsed = jsonObject(adapter);
      return {
        kind: "console",
        text: parsed ? JSON.stringify(simulate(input, runs[Number(run)] ?? sample, parsed).messages, null, 2)
          : "Enter a valid JSON object to replay the visible trace.",
      };
    },
    exercise: ({ adapter }) => {
      const parsed = jsonObject(adapter);
      const [ordinary, fault] = runs.map((run) => simulate(input, run, parsed));
      const firstMessage = ordinary.messages[0];
      const blocks = ordinary.results;
      const faultResults = fault.results;
      return [
        test("history", firstMessage.role === "assistant" && firstMessage.content === sample.assistant.content,
          "The replay preserves the complete assistant content array.", "The replay dropped the assistant text or a tool request from the original turn."),
        test("association", blocks.length === sample.calls.length && blocks.every(({ block, source }, index) =>
          source === sample.calls[index].id && block.tool_use_id === source),
        "The receipts are linked to the tool calls even when arrival order changes.", "At least one receipt is missing or associated with the wrong invocation."),
        test("result-turn", ordinary.messages[1].role === "user" && blocks.length === sample.calls.length &&
          blocks.every(({ block, source }) => block.type === "tool_result" &&
            block.content === sample.completions.find(({ key }) => key === source)?.text &&
            typeof block.is_error === "boolean" && Object.keys(block).every((key) =>
              ["type", "tool_use_id", "content", "is_error"].includes(key))),
        "The next user message contains the complete tool result blocks.", "The result message has the wrong role, a malformed block, or missing tool content."),
        test("failure", faultResults.length === 2 && faultResults.every(({ block, source }) => {
          const observed = runs[1].completions.find(({ key }) => key === source);
          return observed && block.tool_use_id === source && block.is_error === observed.failed && block.content === observed.text;
        }),
        "The completed empty result stays successful and the timed-out result carries an error.", "The adapter lost the distinction between the completed empty lookup and the timeout."),
      ];
    },
    reference: { label: "Review Claude tool calls and error results", url: "https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls" },
  };
}

export const developerDefinitions = {
  capstone: integration({
    id: "developer-spares-tool-loop-v1", stage: "capstone", title: "Repair a spare-parts tool loop",
    brief: "A message requests two stock checks. The integration assumes that the service finishes them in request order and drops the tool calls when it continues the conversation. Repair the adapter on local records.",
    tool: "lookup_stock", key: "call_id", payload: "body", failure: "failed",
    records: ["FILTER-R", "SEAL-Q"], lookup: ["Seven filters available.", "Three seals available."],
  }),
  transfer: integration({
    id: "developer-room-readings-transfer-v1", stage: "transfer", title: "Restore a utility readings adapter",
    brief: "A new building service returns readings using a different receipt schema. Connect the captured Claude requests to the receipts and preserve what happened when only one lookup succeeded.",
    tool: "read_room_meter", key: "request_ref", payload: "report", failure: "unavailable",
    records: ["NORTH-12", "MEETING-03"], lookup: ["North 12 reads 13 units.", "Meeting 03 reads 8 units."],
  }),
};

export const developerRevisedDefinitions = {
  capstone: integration({
    id: "developer-shuttle-status-revised-v1", stage: "capstone", title: "Reconnect shuttle status results",
    brief: "A local Claude integration checks two shuttle routes and replies using the wrong vehicle status. The service can finish a route check on a different schedule than its neighbors. Rebuild the adapter to preserve the message contract.",
    tool: "read_route_status", key: "invocation", payload: "summary", failure: "failed_read",
    records: ["SHUTTLE-2", "SHUTTLE-5"], lookup: ["Route 2 arrives in nine minutes.", "Route 5 arrives in fourteen minutes."],
  }),
  transfer: integration({
    id: "developer-exhibit-ledger-transfer-revised-v1", stage: "transfer", title: "Restore a loan ledger integration",
    brief: "Two exhibit ledgers report back through a different service. The first blank receipt might be a valid empty result. Correlate the tool results and carry the actual outcome to the next assistant turn.",
    tool: "lookup_exhibit_loan", key: "tool_ref", payload: "finding", failure: "timed_out",
    records: ["EXH-SHELL", "EXH-CHIMES"], lookup: ["Shell collection loan ends March 8.", "Chimes collection loan ends April 21."],
  }),
};
