import { column, countWords, findTable, globRegex, hasTodo, list, markdownSections, parseJsonObject, record, section, text } from "./artifacts";
import { verdict } from "./model";
import type { CapstoneDefinition, CapstoneDraft, CapstoneStage } from "./model";

// Developer Professional hands-on lab: operate a production Claude assistant. The learner writes the production request
// template, the release gate (evaluation suites, judge calibration, progressive rollout), the managed settings for the
// team's Claude Code fleet (telemetry and MCP allowlist), a postmortem for a real incident, and picks an enforced control
// for each security risk. Every artifact is parsed and checked against the case.

type Slice = { name: string; share: number; minCases: number; human: boolean };
type Risk = { id: string; risk: string; options: readonly string[]; answer: number; why: string };
type Server = { name: string; url: string };

type OpsCase = {
  id: string;
  stage: CapstoneStage;
  title: string;
  org: string;
  brief: string;
  service: string;
  model: string;
  stable: readonly string[];
  volatile: readonly string[];
  latency: string;
  slices: readonly Slice[];
  evalBrief: string;
  canaryMetric: string;
  endpoint: string;
  privacy: string;
  allowed: readonly Server[];
  blocked: readonly Server[];
  incident: string;
  rootCause: RegExp;
  rootCauseHint: string;
  alert: RegExp;
  alertHint: string;
  regressionMin: number;
  risks: readonly Risk[];
};

const currentModels = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2"];
const contentFlags = ["OTEL_LOG_USER_PROMPTS", "OTEL_LOG_ASSISTANT_RESPONSES", "OTEL_LOG_TOOL_DETAILS", "OTEL_LOG_TOOL_CONTENT", "OTEL_LOG_RAW_API_BODIES"];
const postmortemSections = [
  { key: "impact", label: "Impact" },
  { key: "root cause", label: "Root cause" },
  { key: "mitigation", label: "Mitigation" },
  { key: "regression", label: "Regression evals" },
  { key: "monitoring", label: "Monitoring" },
  { key: "communication", label: "Communication" },
] as const;

const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const strings = (value: unknown) => list(value).map(text).filter(Boolean);
const placeholders = (value: unknown): string[] => JSON.stringify(value ?? "").match(/\{\{[a-z_]+\}\}/g) ?? [];
const truthy = (value: unknown) => value !== undefined && !/^(0|false|)$/i.test(String(value).trim());

function requestProblems(input: OpsCase, draft: CapstoneDraft) {
  const parsed = parseJsonObject(draft.request, "messages-template.json");
  if (parsed.error !== undefined) return [parsed.error];
  const body = parsed.value;
  const problems: string[] = [];
  const model = text(body.model);
  if (model !== input.model) {
    problems.push(model && currentModels.includes(model)
      ? `"model" is ${model}. The service was evaluated and approved on ${input.model}; a different model needs its own release.`
      : `"model" must be the exact current model ID the service was approved on (${input.model}); "${model || "nothing"}" is not one the API accepts as written.`);
  }
  if (body.stream !== true) problems.push(`Set "stream": true. ${input.latency} Without streaming, nothing reaches the screen until the whole answer is done.`);
  const choice = record(body.tool_choice);
  if (choice && choice.type !== "auto" && choice.type !== "none") {
    problems.push(`tool_choice "${text(choice.type)}" returns a 400 on ${input.model} (forced tool use is not supported on Opus 5.5 and Sonnet 5.5). Use "auto" with strict tools, or leave tool_choice out.`);
  }
  const system = list(body.system).map(record).filter((block) => block !== null);
  if (!system.length) return [...problems, `Write "system" as an array of text blocks so a cache_control breakpoint can sit after the stable part.`];
  const breakpoint = system.map((block) => !!record(block.cache_control)).lastIndexOf(true);
  if (breakpoint < 0) return [...problems, `No cache_control breakpoint in "system". The stable prefix (${input.stable.join(", ")}) is resent on every request at full price.`];
  const cached = placeholders(system.slice(0, breakpoint + 1));
  for (const placeholder of input.stable) {
    if (!cached.includes(placeholder)) problems.push(`${placeholder} is not inside the cached prefix. It is the same on every request, so it belongs before the breakpoint.`);
  }
  for (const placeholder of input.volatile) {
    if (cached.includes(placeholder)) problems.push(`${placeholder} changes on every request but sits inside the cached prefix, so the prefix never matches and every call writes a new cache entry. Move it after the breakpoint.`);
  }
  const everywhere = placeholders(body);
  for (const placeholder of input.volatile) {
    if (!everywhere.includes(placeholder)) problems.push(`${placeholder} is missing from the request; the assistant needs it on every call.`);
  }
  return problems;
}

function gateParse(draft: CapstoneDraft) {
  return parseJsonObject(draft.gate, "release-gate.json");
}

function evalProblems(input: OpsCase, gate: Record<string, unknown>) {
  const suites = list(gate.suites).map(record).filter((suite) => suite !== null);
  if (!suites.length) return [`Add "suites": one entry per traffic slice with slice, cases, trials, metric, threshold and grader.`];
  const problems: string[] = [];
  for (const slice of input.slices) {
    const suite = suites.find((entry) => text(entry.slice).toLowerCase().includes(slice.name.toLowerCase()));
    if (!suite) {
      problems.push(`No suite for "${slice.name}" (${slice.share}% of traffic). A regression in a slice with no cases ships unseen.`);
      continue;
    }
    const cases = number(suite.cases);
    if (cases === null || cases < slice.minCases) problems.push(`"${slice.name}": ${cases ?? "no"} cases. The brief asks for at least ${slice.minCases}, so the slice's pass rate means something.`);
    const trials = number(suite.trials);
    if (trials === null || trials < 3) problems.push(`"${slice.name}": run each case at least 3 times. One trial cannot tell a flaky pass from a reliable one.`);
    if (!text(suite.metric) || hasTodo(text(suite.metric))) problems.push(`"${slice.name}": name the metric being measured.`);
    const threshold = number(suite.threshold);
    if (threshold === null || threshold <= 0 || threshold > 1) problems.push(`"${slice.name}": give "threshold" as a pass rate between 0 and 1 (for example 0.95).`);
    if (slice.human && !/human|expert|reviewer|clinician|analyst|investigator/i.test(text(suite.grader))) {
      problems.push(`"${slice.name}" is high risk; its grader must be a person, not a model judge alone.`);
    }
  }
  return problems;
}

function judgeProblems(gate: Record<string, unknown>) {
  const judge = record(gate.judge);
  if (!judge) return [`Add "judge": the model that grades transcripts and how it is calibrated against people.`];
  const problems: string[] = [];
  const model = text(judge.model);
  if (!currentModels.includes(model)) problems.push(`Pin the judge to an exact current model ID (for example claude-opus-5-5). "${model || "nothing"}" either is not a model ID or can change under you, and a judge that drifts moves every score with it.`);
  const labels = number(judge.human_labels);
  if (labels === null || labels < 100) problems.push(`"human_labels": compare the judge with at least 100 human-labelled transcripts before it grades alone.`);
  const agreement = number(judge.min_agreement);
  if (agreement === null || agreement < 0.8 || agreement > 1) problems.push(`"min_agreement": set an agreement target with the human labels of at least 0.8 that the judge must meet before it gates releases.`);
  if (!/random|swap|both/i.test(text(judge.order))) problems.push(`"order": randomize or swap which response the judge sees first. Pairwise judges favour a position unless the order varies.`);
  if (!strings(judge.recalibrate_on).some((entry) => /model/i.test(entry))) problems.push(`"recalibrate_on" must include a judge model change: a new judge model shifts agreement even when the rubric is unchanged.`);
  return problems;
}

function rolloutProblems(input: OpsCase, gate: Record<string, unknown>) {
  const rollout = record(gate.rollout);
  if (!rollout) return [`Add "rollout": the traffic stages, how long each holds, and what rolls a release back.`];
  const problems: string[] = [];
  const stages = list(rollout.stages_percent).map(number);
  const valid = stages.length >= 3 && stages.every((stage, index) => stage !== null && stage > 0 && (index === 0 || stage > stages[index - 1]!));
  if (!valid || (stages[0] ?? 100) > 10 || stages[stages.length - 1] !== 100) {
    problems.push(`"stages_percent" should start at 10% of traffic or less and rise through at least three stages to 100, so a bad prompt reaches a small cohort first.`);
  }
  const hold = number(rollout.hold_minutes);
  if (hold === null || hold < 30) problems.push(`"hold_minutes": hold each stage long enough (30 minutes or more) for the canary metric to move.`);
  if (text(rollout.rollback) !== "automatic") problems.push(`"rollback": "automatic". During the last incident a person had to find the change and redeploy.`);
  if (!strings(rollout.rollback_on).includes(input.canaryMetric)) problems.push(`"rollback_on" must include ${input.canaryMetric}, the signal that moved in the last incident.`);
  if (!/version/i.test(text(rollout.tag_responses_with))) problems.push(`"tag_responses_with": record the prompt and model version on every response, so you can tell which version answered.`);
  return problems;
}

function managedParse(draft: CapstoneDraft) {
  return parseJsonObject(draft.managed, "managed-settings.json");
}

function telemetryProblems(input: OpsCase, settings: Record<string, unknown>) {
  const env = record(settings.env);
  if (!env) return [`Add an "env" block. Telemetry for the whole fleet is turned on from managed settings, because repository settings cannot enable or redirect it.`];
  const problems: string[] = [];
  if (text(env.CLAUDE_CODE_ENABLE_TELEMETRY) !== "1") problems.push(`Set CLAUDE_CODE_ENABLE_TELEMETRY to "1"; nothing is exported without it.`);
  for (const key of ["OTEL_METRICS_EXPORTER", "OTEL_LOGS_EXPORTER"]) {
    if (text(env[key]) !== "otlp") problems.push(`Set ${key} to "otlp" so cost, token and tool events reach the collector.`);
  }
  if (text(env.OTEL_EXPORTER_OTLP_ENDPOINT) !== input.endpoint) problems.push(`OTEL_EXPORTER_OTLP_ENDPOINT must be the platform collector, ${input.endpoint}.`);
  for (const flag of contentFlags) {
    if (truthy(env[flag])) problems.push(`${flag} turns on content capture. ${input.privacy}`);
  }
  return problems;
}

function mcpProblems(input: OpsCase, settings: Record<string, unknown>) {
  const problems: string[] = [];
  const entries = list(settings.allowedMcpServers).map(record).filter((entry) => entry !== null);
  const allows = (server: Server) => entries.some((entry) => {
    const url = text(entry.serverUrl);
    return !!url && globRegex(url).test(server.url);
  });
  if (!entries.length) problems.push(`Add "allowedMcpServers" with one { "serverUrl": … } entry per approved server.`);
  else {
    for (const server of input.allowed) if (!allows(server)) problems.push(`${server.name} (${server.url}) is approved but not allowed by any serverUrl entry.`);
    for (const server of input.blocked) if (allows(server)) problems.push(`${server.name} (${server.url}) is allowed. It has not passed the security review.`);
    if (entries.some((entry) => !text(entry.serverUrl) && text(entry.serverName))) problems.push(`Match servers by "serverUrl", not "serverName": a name is only a label anyone can reuse.`);
  }
  if (settings.allowManagedMcpServersOnly !== true) problems.push(`Set "allowManagedMcpServersOnly": true. Allowlists merge across scopes, so without it a developer's own allowedMcpServers can add servers.`);
  if (record(settings.permissions)?.disableBypassPermissionsMode !== "disable") problems.push(`Set permissions.disableBypassPermissionsMode to "disable" so no session runs with permission checks off.`);
  return problems;
}

function controlProblems(input: OpsCase, draft: CapstoneDraft) {
  return input.risks.flatMap(({ id, risk, options, answer, why }) => {
    const chosen = draft[id] ?? "";
    if (!chosen) return [`Choose a control for "${risk}".`];
    return chosen === options[answer] ? [] : [`"${risk}" → ${chosen}. ${why}`];
  });
}

function incidentProblems(input: OpsCase, draft: CapstoneDraft) {
  const sections = markdownSections(draft.postmortem);
  const problems: string[] = [];
  for (const { key, label } of postmortemSections) {
    const body = section(sections, key);
    if (body === null) problems.push(`Add a "## ${label}" section.`);
    else if (hasTodo(body) || countWords(body) < 12) problems.push(`Fill in "${label}" with at least a couple of sentences.`);
  }
  if (problems.length) return problems;
  if (!input.rootCause.test(section(sections, "root cause") ?? "")) problems.push(`Root cause should name what actually changed: ${input.rootCauseHint}`);
  if (!/roll(ed)? ?back|revert|previous version|pinned/i.test(section(sections, "mitigation") ?? "")) problems.push(`Mitigation should say how service was restored: roll back to the previous version.`);
  const regression = section(sections, "regression") ?? "";
  const added = Math.max(0, ...(regression.match(/\b\d{1,4}\b/g) ?? []).map(Number));
  if (added < input.regressionMin) problems.push(`Regression evals should add at least ${input.regressionMin} cases built from the affected conversations, so the same failure cannot pass the gate again.`);
  if (!/gate|suite|release/i.test(regression)) problems.push(`Say which suite or release gate the new cases join; cases nobody runs do not prevent a repeat.`);
  const monitoring = section(sections, "monitoring") ?? "";
  if (!input.alert.test(monitoring)) problems.push(`Monitoring should alert on the signal that would have caught this incident: ${input.alertHint}`);
  if (!/\d/.test(monitoring)) problems.push(`Give the alert a numeric threshold and window, so on-call knows when it fires.`);
  return problems;
}

function preview(input: OpsCase, draft: CapstoneDraft) {
  const out: string[] = [];
  const request = parseJsonObject(draft.request, "messages-template.json");
  out.push("$ messages-template.json");
  if (request.error !== undefined) out.push(`  ✗ ${request.error}`);
  else {
    const system = list(request.value.system).map(record).filter((block) => block !== null);
    const breakpoint = system.map((block) => !!record(block.cache_control)).lastIndexOf(true);
    out.push(`  model ${text(request.value.model) || "(none)"} · stream ${request.value.stream === true ? "on" : "off"} · tool_choice ${text(record(request.value.tool_choice)?.type) || "default (auto)"}`);
    out.push(`  cached prefix: ${breakpoint < 0 ? "none" : placeholders(system.slice(0, breakpoint + 1)).join(", ") || "(no placeholders)"}`);
  }
  const gate = gateParse(draft);
  out.push("", "$ release-gate.json");
  if (gate.error !== undefined) out.push(`  ✗ ${gate.error}`);
  else {
    for (const suite of list(gate.value.suites).map(record).filter((entry) => entry !== null)) {
      out.push(`  ${text(suite.slice) || "?"}: ${number(suite.cases) ?? "?"} cases × ${number(suite.trials) ?? "?"} trials · pass ≥ ${number(suite.threshold) ?? "?"} · ${text(suite.grader) || "no grader"}`);
    }
    const judge = record(gate.value.judge);
    out.push(`  judge ${text(judge?.model) || "(none)"} · ${number(judge?.human_labels) ?? 0} human labels · agreement ≥ ${number(judge?.min_agreement) ?? "?"}`);
    const rollout = record(gate.value.rollout);
    out.push(`  rollout ${list(rollout?.stages_percent).map(String).join(" → ") || "(none)"} · rollback ${text(rollout?.rollback) || "(none)"} on ${strings(rollout?.rollback_on).join(", ") || "(nothing)"}`);
  }
  const managed = managedParse(draft);
  out.push("", "$ managed-settings.json");
  if (managed.error !== undefined) out.push(`  ✗ ${managed.error}`);
  else {
    const env = record(managed.value.env) ?? {};
    out.push(`  telemetry ${text(env.CLAUDE_CODE_ENABLE_TELEMETRY) === "1" ? "on" : "off"} → ${text(env.OTEL_EXPORTER_OTLP_ENDPOINT) || "(no endpoint)"} · content capture ${contentFlags.some((flag) => truthy(env[flag])) ? "on" : "off"}`);
    const entries = list(managed.value.allowedMcpServers).map(record).filter((entry) => entry !== null);
    for (const server of [...input.allowed, ...input.blocked]) {
      out.push(`  MCP ${server.name} → ${entries.some((entry) => !!text(entry.serverUrl) && globRegex(text(entry.serverUrl)).test(server.url)) ? "allowed" : "blocked"}`);
    }
  }
  out.push("", "$ postmortem");
  const sections = markdownSections(draft.postmortem);
  for (const { key, label } of postmortemSections) {
    const body = section(sections, key);
    out.push(`  ${label}: ${body === null ? "missing" : `${countWords(body)} words`}`);
  }
  out.push("", "$ risk controls");
  for (const { id, risk } of input.risks) out.push(`  ${risk.slice(0, 48)}… → ${draft[id] || "(not chosen)"}`);
  return out.join("\n");
}

function lab(input: OpsCase): CapstoneDefinition {
  const requestInitial = JSON.stringify({
    model: "TODO", max_tokens: 2048,
    system: [{ type: "text", text: "TODO" }],
    messages: [{ role: "user", content: "TODO" }],
  }, null, 2);
  return {
    id: input.id, stage: input.stage, title: input.title, role: "Production operations",
    brief: input.brief,
    deliverable: "Write the production request template, the release gate, the managed settings for the team's Claude Code fleet, and the postmortem, then choose an enforced control for each risk. Each file is parsed and checked against the case.",
    documents: [
      { id: "SERVICE", title: `${input.org} service sheet`, text: `${input.service}\n\nApproved model: ${input.model}.\nRequest parts the same on every call: ${input.stable.join(", ")}.\nRequest parts that change on every call: ${input.volatile.join(", ")}.\n${input.latency}` },
      { id: "EVALS", title: "Evaluation brief", text: `${input.evalBrief}\n\n${input.slices.map(({ name, share, minCases, human }) => `- ${name}: ${share}% of traffic, at least ${minCases} cases${human ? ", high risk" : ""}`).join("\n")}\n\nRelease rollbacks are judged on ${input.canaryMetric}.` },
      { id: "FLEET", title: "Claude Code fleet policy", text: `The engineering team's Claude Code sessions export metrics and events to the platform collector at ${input.endpoint}. ${input.privacy}\nApproved MCP servers: ${input.allowed.map(({ name, url }) => `${name} (${url})`).join("; ")}.\nNot approved: ${input.blocked.map(({ name, url }) => `${name} (${url})`).join("; ")}.\nNo developer may start a session with permission checks turned off.` },
      { id: "INCIDENT", title: "Incident notes", text: input.incident },
      { id: "RISKS", title: "Security risk register", text: input.risks.map(({ risk }, index) => `${index + 1}. ${risk}`).join("\n") },
    ],
    fields: [
      {
        id: "request", label: "messages-template.json", editor: "json",
        instruction: "The Messages API request body the service sends. Use the {{placeholders}} from the service sheet where values are filled in at runtime.",
        initial: requestInitial,
        example: JSON.stringify({
          model: "claude-haiku-5-5", max_tokens: 1024, stream: true,
          system: [{ type: "text", text: "{{style_guide}}", cache_control: { type: "ephemeral" } }, { type: "text", text: "Order: {{order_id}}" }],
          messages: [{ role: "user", content: "{{question}}" }],
        }, null, 2),
      },
      {
        id: "gate", label: "release-gate.json", editor: "json",
        instruction: "What every prompt or model change must pass before and during rollout: suites per slice, the judge and its calibration, and the rollout stages.",
        initial: JSON.stringify({
          suites: input.slices.map(({ name }) => ({ slice: name, cases: 0, trials: 0, metric: "TODO", threshold: 0, grader: "TODO" })),
          judge: { model: "TODO" },
          rollout: { stages_percent: [100] },
        }, null, 2),
        example: JSON.stringify({
          suites: [{ slice: "Password resets", cases: 40, trials: 5, metric: "Resolved without escalation", threshold: 0.9, grader: "model judge" }],
          judge: { model: "claude-sonnet-5-5", human_labels: 150, min_agreement: 0.85, order: "swapped", recalibrate_on: ["rubric change"] },
          rollout: { stages_percent: [2, 20, 100], hold_minutes: 45, rollback: "automatic", rollback_on: ["refund_rate"], tag_responses_with: "release_id" },
        }, null, 2),
      },
      {
        id: "managed", label: "managed-settings.json", editor: "json",
        instruction: "Deployed by IT to every developer machine running Claude Code.",
        initial: JSON.stringify({ env: {}, permissions: {}, allowedMcpServers: [] }, null, 2),
        example: JSON.stringify({
          env: { CLAUDE_CODE_ENABLE_TELEMETRY: "1", OTEL_METRICS_EXPORTER: "console" },
          permissions: { deny: ["Read(**/.env)"] },
          deniedMcpServers: [{ serverUrl: "https://mcp.untrusted.example/*" }],
        }, null, 2),
      },
      {
        id: "postmortem", label: "Postmortem", editor: "markdown",
        instruction: "Blameless. Use the sections Impact, Root cause, Mitigation, Regression evals, Monitoring, and Communication.",
        initial: `# Postmortem\n\n${postmortemSections.map(({ label }) => `## ${label}\nTODO`).join("\n\n")}`,
        example: "# Postmortem: search outage\n\n## Monitoring\nPage when the zero-result rate for catalog search stays above 8% for 10 minutes; today it sits near 2%.",
      },
      ...input.risks.map(({ id, risk, options }) => ({ id, group: "Controls for each risk", label: risk, options })),
    ],
    criteria: [
      { id: "request", title: "Send a request that streams and keeps its cache", objectives: ["6.1", "6.2"],
        review: "Pin the approved model, stream so the first words arrive quickly, keep forced tool_choice off models that reject it, and put everything that changes per request after the last cache_control breakpoint so the stable prefix is read from cache." },
      { id: "evals", title: "Cover every slice with repeated trials", objectives: ["5.1"],
        review: "Derive suites from the real traffic mix, size each slice so its pass rate means something, run several trials per case because outputs vary, set numeric thresholds, and keep people grading the high-risk slice." },
      { id: "judge", title: "Calibrate the judge before it gates releases", objectives: ["5.2"],
        review: "A model judge earns gating authority only after it agrees with enough human labels. Pin its model, vary response order to remove position bias, and re-calibrate when the judge model or rubric changes." },
      { id: "rollout", title: "Roll out progressively with automatic rollback", objectives: ["2.3"],
        review: "Ship prompt and model changes to a small cohort first, hold each stage long enough to see the canary metric, roll back automatically on it, and tag responses with the version that produced them." },
      { id: "telemetry", title: "Export fleet telemetry without capturing content", objectives: ["3.1", "8.4"],
        review: "Fleet telemetry is set in managed settings, which repository files cannot override. Export metrics and events to the platform collector and leave prompt, response, tool-detail and raw-body capture off when the data is regulated." },
      { id: "mcp", title: "Allow only approved MCP servers", objectives: ["8.4", "7.3"],
        review: "allowedMcpServers with serverUrl entries names the approved servers; allowManagedMcpServersOnly stops local lists from adding to it; disableBypassPermissionsMode keeps permission checks on." },
      { id: "controls", title: "Enforce controls outside the model", objectives: ["7.1", "7.2", "7.3"],
        review: "Destructive actions need a deterministic block, an agent holding private data and reading untrusted input needs its exfiltration channel closed, and CI should hold short-lived federated credentials instead of a static key." },
      { id: "incident", title: "Turn the incident into coverage", objectives: ["4.2", "3.2"],
        review: "A postmortem names what changed, how service was restored, the regression cases that now guard the release gate, and the alert that would have caught it sooner." },
    ],
    preview: (draft) => ({ kind: "console", text: preview(input, draft) }),
    exercise: (draft) => {
      const gate = gateParse(draft);
      const gateError = gate.error !== undefined ? [gate.error] : null;
      const managed = managedParse(draft);
      const managedError = managed.error !== undefined ? [managed.error] : null;
      return [
        verdict("request", requestProblems(input, draft), "The request streams on the approved model and caches the stable prefix."),
        verdict("evals", gateError ?? evalProblems(input, gate.value!), "Every slice has enough cases, repeated trials, a metric, a threshold and the right grader."),
        verdict("judge", gateError ?? judgeProblems(gate.value!), "The judge is pinned, order-randomized and calibrated against human labels."),
        verdict("rollout", gateError ?? rolloutProblems(input, gate.value!), "Releases reach a small cohort first and roll back automatically on the canary metric."),
        verdict("telemetry", managedError ?? telemetryProblems(input, managed.value!), "The fleet exports metrics and events to the collector with content capture off."),
        verdict("mcp", managedError ?? mcpProblems(input, managed.value!), "Only the approved MCP servers load, and bypass mode is off."),
        verdict("controls", controlProblems(input, draft), "Each risk has a control enforced outside the model."),
        verdict("incident", incidentProblems(input, draft), "The postmortem names the change, the rollback, the new regression cases and the alert."),
      ];
    },
    reference: { label: "Claude Code monitoring and managed settings", url: "https://code.claude.com/docs/en/monitoring-usage" },
  };
}

const meridian: OpsCase = {
  id: "developer-professional-claims-ops-lab-v1", stage: "capstone", title: "Operate Meridian Health's claims assistant",
  org: "Meridian Health",
  brief: "Meridian Health Plan's members ask a Claude assistant about claim status, prior authorizations and appeals. You now own it in production. Last month a prompt change reached every member at once and stopped mentioning appeal deadlines for six hours. Before the next release, the platform review wants the production request template, a release gate, managed settings for the engineers' Claude Code fleet, the postmortem, and an enforced control for each open security risk.",
  service: "The claims assistant runs on the Claude API and answers members in the member portal chat. Each request carries the plan's benefits policy and tool guide (identical on every call), the current time, the member's ID and the member's message.",
  model: "claude-sonnet-5-5",
  stable: ["{{benefits_policy}}", "{{tool_guide}}"],
  volatile: ["{{now}}", "{{member_id}}", "{{member_message}}"],
  latency: "Members must see the first words of a reply within 2 seconds.",
  slices: [
    { name: "Claim status", share: 60, minCases: 50, human: false },
    { name: "Prior authorization", share: 25, minCases: 40, human: false },
    { name: "Appeals", share: 12, minCases: 40, human: false },
    { name: "Crisis mentions", share: 3, minCases: 50, human: true },
  ],
  evalBrief: "Every prompt or model change runs the offline suites before rollout. A model judge grades most transcripts. Crisis mentions (self-harm, emergencies) are high risk: a clinician reviews those answers.",
  canaryMetric: "escalation_rate",
  endpoint: "https://otel.meridian.example:4317",
  privacy: "Prompts and tool output in these sessions can contain protected health information, which must not leave the developer's machine in telemetry.",
  allowed: [
    { name: "claims-api", url: "https://mcp.meridian.example/claims" },
    { name: "policy-docs", url: "https://mcp.meridian.example/policies" },
  ],
  blocked: [{ name: "community-sql-helper", url: "https://mcp.community-tools.example/sql" }],
  incident: "Nov 3, 09:10: prompt v18 was edited in production configuration and reached every member at once.\n09:10–15:20: answers to appeals questions stopped mentioning the 180-day filing deadline. 212 conversations were affected.\n13:05: a member complaint reached support; engineering could not tell which prompt version had answered.\n15:20: v17 was restored by redeploying the service.\nThe offline suite had 6 appeals cases, all about appeal status, none about deadlines. Escalations to staff rose from 4% to 11% during the incident, and no alert fired.",
  rootCause: /v18|prompt (change|edit|version)/i, rootCauseHint: "the prompt v18 edit that shipped to everyone at once.",
  alert: /appeal|escalation/i, alertHint: "the escalation rate or appeals answer quality.",
  regressionMin: 20,
  risks: [
    {
      id: "riskDestroy", risk: "Engineers' Claude Code sessions can run database migrations, and one session pointed a migration at the production claims database.",
      options: ["Add a CLAUDE.md rule telling Claude never to run migrations against production", "A PreToolUse hook denies migrations that target production, and sessions hold no production credentials", "Review each session's Bash history every Friday"],
      answer: 1, why: "An irreversible action needs a deterministic block before it runs. A CLAUDE.md rule is guidance the model can miss, and a weekly review finds the damage afterwards.",
    },
    {
      id: "riskExfil", risk: "The claims assistant reads member-uploaded documents, can look up any member's claims, and can email members.",
      options: ["Add a system prompt warning that uploaded documents may contain instructions to ignore", "Scope claim lookups to the signed-in member and allow email only to that member's address on file", "Log every outbound email with its recipient for compliance review"],
      answer: 1, why: "Private data, untrusted input and an outbound channel together make an exfiltration path. Close it with scoping and a recipient allowlist; prompts are not boundaries and logs only detect.",
    },
    {
      id: "riskKeys", risk: "CI pipelines in two clouds call the Claude API with one shared API key stored as a repository secret in 30 repositories.",
      options: ["Rotate the shared key every 30 days with a script that updates all 30 secrets", "Use workload identity federation: each pipeline exchanges its OIDC token for short-lived Claude API credentials", "Store the key in each pipeline's environment variables instead of repository secrets"],
      answer: 1, why: "Federation removes the static key entirely; rotation and relocation still leave a long-lived secret that can leak.",
    },
  ],
};

const lakeside: OpsCase = {
  id: "developer-professional-disputes-ops-transfer-v1", stage: "transfer", title: "Operate Lakeside Credit Union's dispute assistant",
  org: "Lakeside Credit Union",
  brief: "Lakeside Credit Union's members report card disputes, fee questions and fraud to a Claude assistant that drafts the case for the disputes team. You take over its operations. A model upgrade last month misrouted fraud reports as fee questions for a day. The operations review wants the same five artifacts you produced for Meridian, but Lakeside's model, traffic, collector, servers, incident and risks are different.",
  service: "The dispute assistant runs on the Claude API inside the online banking app. Each request carries the dispute policy and the Regulation E summary (identical on every call), the current time, the member's ID and the member's message.",
  model: "claude-opus-5-5",
  stable: ["{{dispute_policy}}", "{{reg_e_summary}}"],
  volatile: ["{{now}}", "{{member_id}}", "{{message}}"],
  latency: "Members must see the assistant start answering within 3 seconds.",
  slices: [
    { name: "Card disputes", share: 45, minCases: 50, human: false },
    { name: "Fee questions", share: 30, minCases: 40, human: false },
    { name: "Fraud reports", share: 20, minCases: 40, human: false },
    { name: "Elder financial abuse", share: 5, minCases: 50, human: true },
  ],
  evalBrief: "Every prompt or model change runs the offline suites before rollout. A model judge grades most drafts. Possible elder financial abuse is high risk: a fraud investigator reviews those drafts.",
  canaryMetric: "fraud_misroute_rate",
  endpoint: "https://otel.lakeside.example:4318",
  privacy: "Sessions handle account numbers and transaction details, which policy forbids sending to the telemetry backend.",
  allowed: [
    { name: "ledger", url: "https://mcp.lakeside.example/ledger" },
    { name: "disputes", url: "https://mcp.lakeside.example/disputes" },
  ],
  blocked: [{ name: "free-finance-tools", url: "https://mcp.free-finance-tools.example/mcp" }],
  incident: "Oct 28, 08:00: the assistant moved from claude-opus-5 to claude-opus-5-5 for all members at once, as a model migration with no staged rollout.\n08:00 to Oct 29 07:30: 64 fraud reports were drafted as fee questions and waited in the low-priority queue.\nThe offline judge pass rate did not change: the suite had 8 fraud cases and none described fraud as an unexpected fee.\nA branch manager noticed on Oct 29. Rollback to claude-opus-5 took four hours because the model ID was hard-coded. No alert covered routing.",
  rootCause: /model|opus|migration|upgrade/i, rootCauseHint: "the model migration that reached every member at once.",
  alert: /fraud|misrout|routing/i, alertHint: "the fraud misroute rate.",
  regressionMin: 20,
  risks: [
    {
      id: "riskDestroy", risk: "Claude Code sessions in the infrastructure repository can run terraform destroy, and one plan nearly removed the disputes database.",
      options: ["Add a CLAUDE.md rule telling Claude to ask before destroying infrastructure", "A PreToolUse hook denies terraform destroy and apply on production, and sessions hold no production credentials", "Have the infrastructure lead read session transcripts every week"],
      answer: 1, why: "Destruction is irreversible, so it needs a deterministic block and no production credentials in reach; instructions and later review do not stop it.",
    },
    {
      id: "riskExfil", risk: "The dispute assistant summarizes merchant emails, can read any member's transactions, and can post messages to an external merchant portal.",
      options: ["Tell the model in the system prompt never to share member data with merchants", "Limit reads to the member in the case, and require staff approval before any merchant portal post", "Keep an audit log of every portal post for monthly review"],
      answer: 1, why: "Untrusted merchant text plus private data plus an outbound channel is an exfiltration path; scope the data and gate the channel outside the model.",
    },
    {
      id: "riskKeys", risk: "Self-hosted CI runners call the Claude API with a static key kept in a .env file on each runner.",
      options: ["Encrypt the .env file on each runner and rotate the key every quarter", "Use workload identity federation so each runner exchanges its identity token for short-lived Claude API credentials", "Move the key into the runner's shell profile so it is not in the repository"],
      answer: 1, why: "Short-lived federated credentials remove the static key; encrypting or moving it keeps a long-lived secret on every runner.",
    },
  ],
};

export const developerProfessionalDefinitions = { capstone: lab(meridian), transfer: lab(lakeside) };
