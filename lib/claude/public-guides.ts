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
      { question: "A briefing draft says a pilot reduced processing time by 18%. The source packet reports that 18 people participated and gives no timing data. What should you do before sharing the draft?", options: ["Ask Claude to rephrase it as “up to 18%” with a caveat.", "Cut the 18% claim and flag the missing timing data.", "Keep 18% and cite the participation report as the source."], answer: 1, explanation: "The source supports a headcount, not a time saving. A caveat still repeats an unsupported number, so the reviewer needs to see the gap before distribution." },
      { question: "A team uses a shared Claude Project for a weekly memo. How should it handle the current week's metrics?", options: ["Add each week's metrics to the Project's standing instructions.", "Upload each weekly metrics file to the Project knowledge and keep them all.", "Keep the memo format in the Project and paste the dated metrics each run."], answer: 2, explanation: "Instructions should describe the stable process. Old metrics files in knowledge can be mixed into the wrong week; dated inputs per run let the team check the reporting period." },
    ],
  },
  "developer-foundations": {
    audience: "For engineers building Claude integrations who need to reason about API responses, agent workflows, Claude Code, and tool interfaces.",
    study: ["Trace a request through message handling, tool selection, and tool result parsing.", "Test failure paths alongside the happy path, including malformed output, interrupted responses, and retries.", "Compare when to use application code, a Claude Code extension, and an MCP tool for a reusable capability."],
    revision: "The revised guide puts more explicit emphasis on evaluation and debugging, defensive parsing, and testing how different parts of the application handle failures.",
    samples: [
      { question: "An invoice extraction stream ends before the JSON object closes. What should the application do before posting anything to the ledger?", options: ["Validate against the schema and hold the record if it fails.", "Post the fields that parsed and backfill the rest on the next run.", "Close the open braces, parse the repaired JSON, then post it."], answer: 0, explanation: "A cut-off stream can drop required fields or end mid-value. Repairing the syntax hides that; validating at the posting boundary keeps the failed extraction out of the ledger." },
      { question: "A tool reads inventory correctly but finds the same SKU in two warehouses. What should its response include?", options: ["The first matching row, to keep the tool result small.", "Both rows, each labeled with its warehouse ID.", "One summed quantity for the SKU across warehouses."], answer: 1, explanation: "The caller may need to pick a location or ask a follow-up. Keeping the warehouse identity in the response contract makes that possible; the other two lose it." },
    ],
  },
  "architect-foundations": {
    audience: "For solution architects and engineers who design Claude agent systems, specify tool contracts, and decide how workflows recover when evidence is incomplete.",
    study: ["Trace which component owns each step and where a tool result becomes a user-facing decision.", "Design distinct outcomes for verified results, incomplete results, invalid input, and permissions.", "Set retry boundaries, preserve source evidence, and specify what support receives on handoff."],
    revision: "",
    samples: [
      { question: "A library assistant receives partial results from two specialist searches. The user needs a complete inventory before retiring a collection. What should the orchestrator return?", options: ["Mark the inventory complete, since both specialists returned results.", "Return the verified items and name the sources still missing.", "Rerun both searches and return nothing until both fully finish."], answer: 1, explanation: "A reply can be partial. Keep the verified work, carry the coverage gap forward, and keep the irreversible retirement behind a completion check." },
      { question: "An order lookup reports a temporary timeout. The read-only request has enough time for one retry. What is a suitable tool policy?", options: ["Return an empty result and log the timeout for review.", "Retry with backoff until the 30-second client timeout.", "Retry once, then hand off with the timeout code."], answer: 2, explanation: "A timeout leaves the result unknown, so it can't be reported as empty. One bounded retry can recover a transient error; the handoff keeps the outcome predictable when it persists." },
    ],
  },
  "architect-professional": {
    audience: "For architects responsible for enterprise Claude deployments, including integration design, evaluation, governance, and operational handoff.",
    study: ["Translate service goals into measurable acceptance criteria across representative cases.", "Design an integration with least-privilege access, useful traces, and an explicit policy for recovery.", "Document rollout gates, who owns escalation, and what evidence would trigger rollback."],
    revision: "The revised guide makes operational decisions more explicit. It calls out evidence for model migrations, reliability controls, and accountability in lifecycle handoffs.",
    samples: [
      { question: "A support pilot reduces average handling time, but escalation accuracy falls for disputed orders. What should the approval group do?", options: ["Approve the rollout, since average handling time improved.", "Drop disputed orders from the evaluation set as edge cases.", "Hold expansion and investigate the disputed-order results."], answer: 2, explanation: "An average can hide a costly failure in one slice. Disputes are part of the release conditions, so that slice has to pass before the pilot expands." },
      { question: "A summary service suddenly uses more tokens after adding reference documents. What should the system owner inspect first?", options: ["Per-request traces of retrieved documents and context size.", "Monthly API invoice totals broken down by model.", "Average response length over the past week."], answer: 0, explanation: "The change came from added documents, so the input side is the likely cause. Per-request traces show which documents were retrieved and how much context each request carried." },
    ],
  },
  "developer-professional": {
    audience: "For senior and staff engineers, platform and reliability engineers who run Claude applications, agents and coding-agent fleets in production.",
    study: ["Read a trace from a failed agent run and decide whether the model, the harness, a tool or the data caused it.", "Calibrate a model judge against human labels before it gates a release, and design a rollout that can roll back on its own.", "Branch retries and fallbacks on the error type and stop reason, and keep extra calls inside a shared rate limit."],
    revision: "",
    samples: [
      { question: "After a release, a support agent's input cost doubled. Usage shows cache_read_input_tokens near zero on every request, and a per-request ID now sits at the top of the system prompt. What should change first?", options: ["Move the request ID after the cache breakpoint.", "Switch the agent to a cheaper model tier.", "Give the cache breakpoint a one-hour lifetime."], answer: 0, explanation: "Prompt caching matches an exact prefix. A value that changes on every request at the top means no request ever reuses the cached prefix, so every call pays full input price. A cheaper model or a longer lifetime leaves the prefix unmatched." },
      { question: "A coding agent opened 40 pull requests overnight and the team can review 10 a day. Automated review runs on every pull request. What is a sound first step before letting it block merges?", options: ["Run it in advisory mode and compare its findings with human reviews.", "Make its approval required on every pull request today.", "Turn it off until the team can review everything by hand."], answer: 0, explanation: "An automated reviewer earns merge-gating authority only after its findings have been compared with what human reviewers catch and miss. Advisory mode collects that evidence without blocking work." },
    ],
  },
} satisfies Record<TrackId, { audience: string; study: string[]; revision: string; samples: Sample[] }>;
