// Provider-agnostic learn-by-doing missions: Author → Run → See → Fix → Transfer.
// A learner writes real artifacts; a deterministic engine executes them against fixtures and returns a trace;
// checks read the trace and report what happened (the symptom) and where in the artifact it came from.
// Concepts live in neutral engines and checks; wire formats (tool_use_id, tool_call_id, toolUseId) live in the engines' adapters.
import type { ProviderId } from "../certifications/providers";
import type { CapstoneEditor } from "../claude/capstones/model";
import type { CaseBrief, CasePrebrief, HintLadder } from "../claude/casework";

export type ArtifactKind =
  // provider-neutral
  | "prompt" | "instructions" | "claim-table" | "redaction" | "delegation-table" | "json-schema" | "handoff-template"
  | "eval-plan" | "judge-rubric" | "adr" | "runbook" | "authz-policy" | "retrieval-config" | "error-contract"
  // anthropic
  | "anthropic.messages-request" | "anthropic.messages-followup" | "anthropic.batch-requests" | "anthropic.tool-definition"
  | "claude-code.settings" | "claude-code.mcp" | "claude-code.rule" | "claude-code.skill" | "claude-code.claude-md" | "claude-code.cli"
  | "claude-code.subagent" | "claude-code.agent-dispatch" | "test-cases" | "handoff-note"
  // Model Context Protocol (provider-neutral wire format) and deployment config
  | "mcp.server-manifest" | "mcp.tool-result-contract" | "deploy.env-config" | "routing-config"
  // plain-language work products (Associate labs)
  | "pilot-report" | "shared-template"
  // future providers (examples; no missions use these yet)
  | "azure.openai-chat-request" | "azure.ai-search-index" | "azure.content-filter"
  | "aws.bedrock-converse-request" | "aws.bedrock-guardrail" | "aws.kb-chunking"
  | "gcp.vertex-generate-request" | "gcp.vertex-response-schema";

/** Artifact files keyed by ArtifactSpec.id. */
export type LabFiles = Readonly<Record<string, string>>;

export type ArtifactSpec = {
  id: string;
  kind: ArtifactKind;
  /** The real path the file has in the system, for example ".claude/settings.json". */
  path: string;
  editor: CapstoneEditor;
  /** One line under the file name: what the file is for. Never the answer. */
  instruction: string;
  /** The deployed, broken version the learner maintains. Never contains the answer. */
  starter: string;
  /** The file format with different values from the lab. Shown in an "Example format" disclosure. */
  example?: string;
  /** Defaults to capstoneFieldLimit. */
  maxChars?: number;
};

export type LabDocument = { id: string; title: string; text: string; format?: "json" | "code" };

export type FixtureSet = "sample" | "transfer";

export type Fixture<Input = unknown> = {
  id: string;
  name: string;
  set: FixtureSet;
  /** Transfer fixtures belong to one seeded variant; the sample set has none. */
  variant?: string;
  /** One sentence describing the situation, shown with the trace. */
  situation: string;
  input: Input;
};

export type TraceSource = { artifact: string; pointer?: string; line?: number };

export type TraceEvent = {
  step: number;
  actor: "learner-artifact" | "model" | "tool" | "hook" | "service" | "person";
  kind: "request" | "response" | "tool_call" | "tool_result" | "decision" | "output" | "error" | "metric";
  label: string;
  detail?: string;
  payload?: unknown;
  /** Where in the artifact this event came from, for "jump to line". */
  source?: TraceSource;
  /** Marks an event the learner should notice (blocked, leaked, rejected). Never a verdict on its own. */
  tone?: "ok" | "warn" | "bad";
};

export type EngineRun<Out = unknown> = { trace: readonly TraceEvent[]; out: Out; metrics: Readonly<Record<string, number>> };

export type ParseResult<Parsed> = { ok: true; value: Parsed } | { ok: false; error: string; source?: TraceSource };

/** Pure and deterministic: the same files and fixture always give the same run. */
export type Engine<Parsed = unknown, Input = unknown, Out = unknown> = {
  id: string;
  provider: ProviderId | "neutral";
  /** Shown above the trace, e.g. "Messages API validator + recorded model turns". */
  label: string;
  /** True for proxy engines (prompt simulators). The bench labels their output as simulated. */
  simulated: boolean;
  parse(files: LabFiles): ParseResult<Parsed>;
  run(parsed: Parsed, fixture: Fixture<Input>): EngineRun<Out>;
};

/** What a check saw. The symptom names observed behavior and its location in the artifact, never the fix. */
export type Observation = { passed: boolean; symptom: string; source?: TraceSource };

export type Check<Input = unknown, Out = unknown> = {
  id: string;
  objective: string;
  /** The observable success criterion, e.g. "Every tool result reaches the call that asked for it". */
  title: string;
  /** Concept-level explanation. Shown only once the learner opens the concept hint. */
  diagnosis: string;
  hints: HintLadder;
  /** The working fragment, shown after three failed runs. Marks the objective as guided. */
  reveal: string;
  /** null when the check does not apply to this fixture (or could not be observed). */
  evaluate(run: EngineRun<Out>, fixture: Fixture<Input>): Observation | null;
};

export type CheckResult = {
  check: string;
  objective: string;
  title: string;
  fixture: string;
  passed: boolean;
  symptom: string;
  source?: TraceSource;
};

export type CityEffect =
  | { kind: "tray"; item: string; to: "posted" | "held" | "escalated" | "leaked" | "blocked" | "failed" }
  /** `better: "lower"` for budgets and caps (spend, tokens), where staying under the limit is the good outcome. */
  | { kind: "meter"; id: string; label: string; value: number; limit?: number; unit: string; better?: "higher" | "lower" };

export type LabRunFixture<Input = unknown, Out = unknown> = {
  fixture: Fixture<Input>;
  run: EngineRun<Out> | null;
  results: readonly CheckResult[];
};

export type LabRun<Input = unknown, Out = unknown> = {
  set: FixtureSet;
  variant?: string;
  parseError?: { error: string; source?: TraceSource };
  fixtures: readonly LabRunFixture<Input, Out>[];
  results: readonly CheckResult[];
  /** Per check id: did it hold on every fixture it applied to? Checks that never applied are absent. */
  checks: Readonly<Record<string, boolean>>;
  passed: boolean;
  effects: readonly CityEffect[];
};

export type LabMutant = {
  name: string;
  set: FixtureSet;
  /** Transfer variant the mutant runs against (transfer mutants only). */
  variant?: string;
  /** Derives the mutant from the reference files for its set. */
  edit: (reference: LabFiles) => LabFiles;
  /** Exactly these checks must fail; every other applicable check must hold. */
  mustFail: readonly string[];
};

export type LabProbe = {
  name: string;
  set: FixtureSet;
  variant?: string;
  files: (reference: LabFiles) => LabFiles;
  /** "any" for gaming probes that only need to fail somewhere. */
  mustFail: "any" | readonly string[];
};

export type LabMission<Parsed = unknown, Input = unknown, Out = unknown> = {
  id: string;
  provider: ProviderId;
  track: string;
  /** The mission's objectives (kept from its casework mapping). Every one needs at least one check. */
  objectives: readonly string[];
  station: string;
  /** Who briefs the learner in the building (from the mission's interviews). */
  speaker: string;
  opening: string;
  task: string;
  brief: CaseBrief;
  prebrief: CasePrebrief;
  documents: readonly LabDocument[];
  artifacts: readonly ArtifactSpec[];
  engine: Engine<Parsed, Input, Out>;
  fixtures: readonly Fixture<Input>[];
  /**
   * "rerun": the transfer runs the same files against a hidden variant (config artifacts).
   * "revise": the transfer reveals a new case and the learner adapts their files to it (instance artifacts such as a request body).
   */
  transferMode: "rerun" | "revise";
  /** Shown when a revise-mode transfer opens: the new case's documents per variant. */
  transferDocuments?: Readonly<Record<string, readonly LabDocument[]>>;
  /**
   * Revise mode: files that change with the new case (e.g. the new application to redact), per variant. They replace the
   * learner's practice-case copy of that file when the new case opens; every other file carries over.
   */
  transferStarters?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  checks: readonly Check<Input, Out>[];
  prediction?: { prompt: string; unit: string; tolerance?: number; actual(run: LabRun<Input, Out>): number };
  effects(fixtures: readonly LabRunFixture<Input, Out>[]): readonly CityEffect[];
  /** Reference files: the sample solution and one per transfer variant (identical in rerun mode). */
  reference: { sample: LabFiles; transfer: Readonly<Record<string, LabFiles>> };
  mutants: readonly LabMutant[];
  probes: readonly LabProbe[];
  /**
   * A sample-hard-coded artifact (values copied from the sample fixtures): must pass the sample and fail every transfer
   * variant. Rerun-mode labs need one; revise-mode labs default to the sample reference.
   */
  overfit?: LabFiles;
  /** Words that name the fix. Failure symptoms must never contain them (checked with tokens found only in the reference). */
  fixTerms?: readonly string[];
  /** Exam terms and the reasoning behind the reference, shown in the debrief. */
  debrief: string;
  /**
   * Optional live-Claude "field test" (research/learn-by-doing.md §3.3). Not built: it needs an API key and spend
   * decisions that have not been made. Kept as a typed hook so adding it later does not change mission data.
   */
  live?: undefined;
};

// Erased form used by the registry, the runner and the UI.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLabMission = LabMission<any, any, any>;
