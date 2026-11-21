import type { Track, TrackId } from "./blueprints";
import { decemberBlueprint, decemberVersion, examGuideLabel } from "./december-blueprints";

export const guidesReviewed = "2026-11-21";

export function guideEditions(track: Track) {
  const revised = decemberBlueprint(track);
  const original = { ...track, version: "july-2026" as const, label: examGuideLabel(track) };
  return revised ? [original, { ...revised, version: decemberVersion, label: examGuideLabel(track, decemberVersion) } as const] : [original];
}

type Sample = { question: string; options: [string, string, string]; answer: 0 | 1 | 2; explanation: string };

export const publicGuides = {
  "associate-foundations": {
    audience: "For people who use Claude in everyday work, including project leads and business teams who draft, review, or hand off deliverables.",
    study: ["Practice writing a brief with a clear audience, format, and source requirements.", "Review a draft against its supporting evidence and decide which claims require a person’s judgment.", "Set up a repeatable workflow with reusable instructions and a clear point for human sign-off."],
    revision: "The revised guide groups troubleshooting into the work itself. Practice diagnosing prompts, reviewing output quality, and maintaining Project knowledge as part of a repeatable process.",
    samples: [
      { question: "A briefing draft says a pilot reduced processing time by 18%. The source packet reports that 18 people participated and gives no timing data. What should you do before sharing the draft?", options: ["Ask Claude for a more cautious estimate.", "Remove the claim and flag the missing timing evidence for the reviewer.", "Keep the number and cite the participation report."], answer: 1, explanation: "The source supports a headcount. A measured change requires timing evidence, so the reviewer needs to see the gap before distribution." },
      { question: "A team uses a shared Claude Project for a weekly memo. How should it handle the current week's metrics?", options: ["Place every weekly metric in the standing instructions.", "Ask Claude to infer the current metrics from past memos.", "Keep the stable memo instructions in the Project and supply the current, dated metrics for each run."], answer: 2, explanation: "Reusable instructions define the process. Dated inputs let the team check that the memo uses the right reporting period and source." },
    ],
  },
  "developer-foundations": {
    audience: "For engineers building Claude integrations who need to reason about API responses, agent workflows, Claude Code, and tool interfaces.",
    study: ["Trace a request through message handling, tool selection, and tool result parsing.", "Test failure paths alongside the happy path, including malformed output, interrupted responses, and retries.", "Compare when to use application code, a Claude Code extension, and an MCP tool for a reusable capability."],
    revision: "The revised guide puts more explicit emphasis on evaluation and debugging, defensive parsing, and testing how different parts of the application handle failures.",
    samples: [
      { question: "An invoice extraction stream ends before the JSON object closes. What should the application do before posting anything to the ledger?", options: ["Validate the complete response against the expected schema and hold the record if validation fails.", "Post the fields that arrived and fill in missing values later.", "Append a closing brace and trust the completed string."], answer: 0, explanation: "A partial stream may be missing required fields or contain incomplete values. Validation at the posting boundary keeps a failed extraction out of the ledger." },
      { question: "A tool reads inventory correctly but returns two warehouses with the same SKU. What should its response include?", options: ["Only the first row to minimize tokens.", "Structured rows with warehouse identifiers and enough context to distinguish them.", "A single combined value without the warehouse breakdown."], answer: 1, explanation: "Identity belongs in the response contract when a caller must distinguish locations. Preserving it lets the application ask the right follow-up or choose the appropriate row." },
    ],
  },
  "architect-foundations": {
    audience: "For solution architects and engineers who design Claude agent systems, specify tool contracts, and decide how workflows recover when evidence is incomplete.",
    study: ["Trace which component owns each step and where a tool result becomes a user-facing decision.", "Design distinct outcomes for verified results, incomplete results, invalid input, and permissions.", "Set retry boundaries, preserve source evidence, and specify what support receives on handoff."],
    revision: "",
    samples: [
      { question: "A library assistant receives partial results from two specialist searches. The user needs a complete inventory before retiring a collection. What should the orchestrator return?", options: ["Declare the inventory complete because both specialists replied.", "List the verified items and explicitly flag which sources are missing before any retirement decision.", "Discard the verified items and return an empty inventory."], answer: 1, explanation: "A reply can be partial. Preserve the verified work, carry the coverage gap forward, and keep the irreversible action behind a completion check." },
      { question: "An order lookup reports a temporary timeout. The read-only request has enough time for one retry. What is a suitable tool policy?", options: ["Treat the timeout as a confirmed empty result.", "Retry until a response arrives.", "Retry once while time remains, then route the unresolved request with its failure context."], answer: 2, explanation: "A timeout leaves the result unknown. A bounded retry can recover a transient error while preserving a predictable handoff when it persists." },
    ],
  },
  "architect-professional": {
    audience: "For architects responsible for enterprise Claude deployments, including integration design, evaluation, governance, and operational handoff.",
    study: ["Translate service goals into measurable acceptance criteria across representative cases.", "Design an integration with least-privilege access, useful traces, and an explicit policy for recovery.", "Document rollout gates, who owns escalation, and what evidence would trigger rollback."],
    revision: "The revised guide makes operational decisions more explicit. It calls out evidence for model migrations, reliability controls, and accountability in lifecycle handoffs.",
    samples: [
      { question: "A support pilot reduces average handling time, but escalation accuracy falls for disputed orders. What should the approval group do?", options: ["Approve rollout on the average time improvement.", "Remove disputed orders from evaluation so the test reflects the common case.", "Treat the disputed-order result as a release-gate failure and investigate that slice before expanding."], answer: 2, explanation: "An aggregate improvement can conceal a consequential failure. Review the affected slice, check the acceptance criteria, and retest it before expansion." },
      { question: "A summary service suddenly uses more tokens after adding reference documents. What should the system owner inspect first?", options: ["Request traces showing which documents were retrieved and how much context each request carried.", "Only the overall monthly invoice.", "The final response length without the input trace."], answer: 0, explanation: "Per-request retrieval and token traces identify whether context assembly changed. They give the owner evidence to target the fix and evaluate its trade-offs." },
    ],
  },
} satisfies Record<TrackId, { audience: string; study: string[]; revision: string; samples: Sample[] }>;
