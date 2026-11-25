import {
  countWords, describeAction, expandEnv, frontmatterList, globRegex, hasTodo, hookMatcherMatches, list, openObjects,
  parseClaudeCommand, parseFrontmatter, parseJsonObject, permissionDecision, permissionRules, record, ruleMatches,
  shellTokens, splitOutsideParens, text, validateSchema,
} from "./artifacts";
import type { Decision, ToolAction } from "./artifacts";
import { verdict } from "./model";
import type { CapstoneDefinition, CapstoneDraft, CapstoneStage } from "./model";

type HookCall = { tool: "Write" | "Edit"; path: string; expect: "allow" | "block" };
type PermissionCheck = { action: ToolAction; expect: Decision | "not-allow"; hint: string };
type McpCase =
  | { transport: "http"; name: string; url: string; header: string; scheme: string; envVar: string; leaked: string }
  | { transport: "stdio"; name: string; command: string; packageName: string; flag: string; envKey: string; envVar: string; leaked: string };
type Sample = { value: unknown; valid: boolean; label: string };

type ArchitectCase = {
  id: string;
  stage: CapstoneStage;
  title: string;
  brief: string;
  repo: string;
  tree: string;
  policy: string;
  allowed: readonly string[];
  hookCalls: readonly HookCall[];
  permissionChecks: readonly PermissionCheck[];
  mcp: McpCase;
  mcpNote: string;
  rule: { file: string; topic: string; conventions: readonly { label: string; pattern: RegExp; text: string }[]; load: readonly string[]; skip: readonly string[] };
  skill: { name: string; purpose: string; steps: readonly string[]; preApproved: readonly string[]; humanOnly: readonly string[] };
  tool: { name: string; job: string; spec: string; samples: readonly Sample[]; model: string };
  ci: { checklist: string; spec: string; samples: readonly Sample[] };
};

const guard = "guard-paths.sh";
const readOnlyTools = /^(Read|Grep|Glob|LS|Bash\(git (diff|log|show|status)[^)]*\))$/;

export function hookSimulation(input: ArchitectCase, settings: Record<string, unknown> | null) {
  const hooks = record(settings?.hooks);
  const entries = (event: string) => list(hooks?.[event]).map((entry) => record(entry)).filter((entry) => entry !== null);
  const commands = (entry: Record<string, unknown>) => list(entry.hooks).map((hook) => record(hook)).filter((hook) => hook !== null);
  const guardArgs = (command: unknown) => {
    const tokens = shellTokens(text(command)).value?.[0] ?? [];
    const index = tokens.findIndex((token) => token.endsWith(guard));
    return index < 0 ? null : tokens.slice(index + 1).map((arg) => arg.replace(/^\.\//, "").replace(/\/?$/, "/"));
  };
  const results = input.hookCalls.map((call) => {
    const allowedSets = entries("PreToolUse").filter((entry) => hookMatcherMatches(entry.matcher, call.tool))
      .flatMap((entry) => commands(entry).filter((hook) => hook.type === "command").map((hook) => guardArgs(hook.command)))
      .filter((args) => args !== null);
    const blocked = allowedSets.some((allowed) => !allowed.some((dir) => dir === "/" ? false : call.path.startsWith(dir)));
    return { call, ran: allowedSets.length > 0, blocked };
  });
  return { results, entries, commands, guardArgs, hooks };
}

function hookProblems(input: ArchitectCase, settings: Record<string, unknown> | null) {
  if (!settings) return [];
  const problems: string[] = [];
  const { results, entries, commands, guardArgs, hooks } = hookSimulation(input, settings);
  if (!hooks) return [`settings.json has no "hooks" object. Add "hooks": { "PreToolUse": [ … ] } so the guard runs before each write.`];
  for (const event of Object.keys(hooks)) {
    if (event !== "PreToolUse" && entries(event).some((entry) => commands(entry).some((hook) => guardArgs(hook.command)))) {
      problems.push(`The guard is registered under ${event}. ${event === "PostToolUse" ? "PostToolUse runs after the file is already written, so it cannot stop the write." : "That event does not fire before a tool call."} Register it under PreToolUse, which runs before the tool executes and can block it with exit code 2.`);
    }
  }
  const pre = entries("PreToolUse");
  if (pre.some((entry) => !Array.isArray(entry.hooks))) {
    problems.push(`Each PreToolUse entry needs a "matcher" and a nested "hooks" array: { "matcher": "…", "hooks": [{ "type": "command", "command": "…" }] }.`);
  }
  const typed = pre.flatMap(commands);
  if (typed.some((hook) => guardArgs(hook.command) && hook.type !== "command")) {
    problems.push(`The guard hook needs "type": "command" so Claude Code runs it as a shell command and reads its exit code.`);
  }
  if (!typed.some((hook) => guardArgs(hook.command))) {
    return [...problems, `No PreToolUse hook runs .claude/hooks/${guard}. Its command must call the script followed by the directories Claude may write to, and its matcher must cover Edit and Write.`];
  }
  for (const { call, ran, blocked } of results) {
    if (call.expect === "block" && !blocked) {
      problems.push(ran
        ? `${call.tool} ${call.path} was allowed. The guard's directory arguments include it; pass only ${input.allowed.join(" and ")}.`
        : `${call.tool} ${call.path} was allowed because no PreToolUse matcher covers the ${call.tool} tool. Use a matcher such as "Edit|Write" (pipe-separated exact names).`);
    }
    if (call.expect === "allow" && blocked) {
      problems.push(`${call.tool} ${call.path} was blocked, but it is inside an approved directory. Check the guard's arguments (${input.allowed.join(", ")}).`);
    }
  }
  return problems;
}

function permissionProblems(input: ArchitectCase, settings: Record<string, unknown> | null) {
  if (!settings) return [];
  const problems: string[] = [];
  const rules = permissionRules(settings);
  if (!rules.permissions) return [`settings.json has no "permissions" object with allow, ask, and deny arrays.`];
  for (const [kind, entries] of [["allow", rules.allow], ["ask", rules.ask], ["deny", rules.deny]] as const) {
    for (const rule of entries) {
      if (rule === "TODO" || !/^[A-Za-z0-9_*-]+(\(.+\))?$/.test(rule.trim())) problems.push(`"${rule}" in ${kind} is not a permission rule. Use Tool or Tool(specifier), such as Bash(npm run lint) or Read(./secrets/**).`);
    }
  }
  if (rules.permissions.defaultMode === "bypassPermissions") {
    problems.push(`defaultMode "bypassPermissions" skips every permission check, and Claude Code ignores it in project settings. Leave defaultMode unset (default) for a shared repo.`);
  }
  for (const { action, expect, hint } of input.permissionChecks) {
    const decision = permissionDecision(rules, action);
    const ok = expect === "not-allow" ? decision !== "allow" : decision === expect;
    if (!ok) {
      const shown = decision === "prompt" ? "no rule matches, so Claude asks" : `${decision}`;
      problems.push(`${describeAction(action)} → ${shown}; the policy needs ${expect === "not-allow" ? "anything except allow" : expect}. ${hint}`);
    }
  }
  return problems;
}

function mcpProblems(input: ArchitectCase, draft: CapstoneDraft) {
  const parsed = parseJsonObject(draft.mcp, ".mcp.json");
  if (parsed.error !== undefined) return [parsed.error];
  const servers = record(parsed.value.mcpServers);
  if (!servers) return [`.mcp.json must have a top-level "mcpServers" object keyed by server name.`];
  const { mcp } = input;
  const problems: string[] = [];
  if (draft.mcp?.includes(mcp.leaked) || draft.mcp?.includes(mcp.leaked.slice(0, 16))) {
    problems.push(`The file contains the credential from the chat paste. .mcp.json is committed to the repo, so reference the environment variable with \${${mcp.envVar}} instead and rotate the leaked value.`);
  }
  const server = record(servers[mcp.name]);
  if (!server) return [...problems, `No server named "${mcp.name}". The name becomes the tool prefix (mcp__${mcp.name}__…) that the team's permission rules already use.`];
  const probe = "probe-value-from-shell";
  const env = { [mcp.envVar]: probe };
  if (mcp.transport === "http") {
    if (server.type !== "http" && server.type !== "streamable-http") problems.push(`"${mcp.name}" is a remote server, so it needs "type": "http". Without a type, Claude Code treats the entry as a local stdio command.`);
    if (expandEnv(text(server.url), env) !== mcp.url) problems.push(`"url" should resolve to ${mcp.url}.`);
    const headers = record(server.headers);
    const header = text(headers?.[mcp.header]);
    const expanded = expandEnv(header, env);
    if (!header) problems.push(`Add "headers": { "${mcp.header}": "${mcp.scheme} \${${mcp.envVar}}" } so each engineer's own token is sent.`);
    else if (expanded !== `${mcp.scheme} ${probe}`) {
      problems.push(/\$\{/.test(expanded)
        ? `The ${mcp.header} header still contains ${expanded.match(/\$\{[^}]+\}/)?.[0]} after expansion. The team exports ${mcp.envVar}; use exactly \${${mcp.envVar}}.`
        : `The ${mcp.header} header should expand to "${mcp.scheme} <value of ${mcp.envVar}>". It expands to "${expanded.replace(probe, "<token>")}".`);
    }
  } else {
    if (server.type === "http") problems.push(`"${mcp.name}" runs locally over stdio, so it needs "command" and "args", not "type": "http".`);
    const argv = [text(server.command), ...list(server.args).map(text)];
    if (!argv.includes(mcp.packageName)) problems.push(`The server must launch ${mcp.packageName} (for example "command": "${mcp.command}", "args": ["-y", "${mcp.packageName}", …]).`);
    if (!argv.includes(mcp.flag)) problems.push(`Pass ${mcp.flag} in "args". The data team only approved read access for agents.`);
    const value = text(record(server.env)?.[mcp.envKey]);
    if (!value) problems.push(`Add "env": { "${mcp.envKey}": "\${${mcp.envVar}}" } so the server receives the connection string from each engineer's shell.`);
    else if (expandEnv(value, env) !== probe) problems.push(`env.${mcp.envKey} should expand from \${${mcp.envVar}}. It currently resolves to "${expandEnv(value, env).replace(probe, "<value>")}".`);
  }
  return problems;
}

function ruleProblems(input: ArchitectCase, draft: CapstoneDraft) {
  const { rule } = input;
  const parsed = parseFrontmatter(draft.rule);
  if (parsed.error) return [parsed.error];
  if (!parsed.present) return [`The rule has no YAML frontmatter. A rule without "paths" loads at the start of every session; add --- paths: … --- so it loads only for ${rule.topic}.`];
  const problems: string[] = [];
  if (!parsed.data.paths && (parsed.data.globs || parsed.data.include || parsed.data.files)) {
    problems.push(`Claude Code reads only the "paths" key in rule frontmatter. Rename "${Object.keys(parsed.data)[0]}" to "paths".`);
  }
  const globs = frontmatterList(parsed.data.paths).filter((glob) => glob !== "TODO");
  if (!globs.length) problems.push(`Add a "paths" list of glob patterns, one per line as "  - \\"pattern\\"".`);
  else {
    const loads = (file: string) => globs.some((glob) => globRegex(glob.replace(/^\.\//, "")).test(file));
    for (const file of rule.load) if (!loads(file)) problems.push(`The rule does not load for ${file}. Check that a glob reaches that folder (use ** to cross directories).`);
    for (const file of rule.skip) if (loads(file)) problems.push(`The rule also loads for ${file}, which is outside ${rule.topic}. Narrow the glob so unrelated files don't carry this context.`);
  }
  if (hasTodo(parsed.body) || countWords(parsed.body) < 15) problems.push(`Write the rule body: the instructions Claude should follow when it touches ${rule.topic}.`);
  for (const convention of rule.conventions) {
    if (!convention.pattern.test(parsed.body)) problems.push(`The body does not state the convention "${convention.text}"`);
  }
  return problems;
}

function skillProblems(input: ArchitectCase, draft: CapstoneDraft) {
  const { skill } = input;
  const parsed = parseFrontmatter(draft.skill);
  if (parsed.error) return [parsed.error];
  if (!parsed.present) return [`SKILL.md must start with YAML frontmatter between --- lines (name, description, and the invocation settings).`];
  const problems: string[] = [];
  const { data } = parsed;
  if (data.name !== skill.name) problems.push(`"name" should be "${skill.name}" to match the .claude/skills/${skill.name}/ folder and the /${skill.name} command the team types.`);
  const description = text(data.description);
  if (hasTodo(description) || countWords(description) < 12) {
    problems.push(`"description" is how Claude and teammates decide when the skill applies. Write at least a full sentence: what it does and when to use it (${skill.purpose}).`);
  }
  if (data["disable-model-invocation"] !== true) {
    problems.push(`Set "disable-model-invocation: true". This skill creates a release tag, so only a person typing /${skill.name} should start it; otherwise Claude may run it when a conversation merely mentions releases.`);
  }
  const tools = frontmatterList(data["allowed-tools"], /[,\s]/);
  if (!tools.length) problems.push(`Add "allowed-tools" so the routine commands run without a prompt each time, for example "Bash(npm run build *)".`);
  if (tools.some((tool) => tool === "Bash" || tool === "Bash(*)" || tool === "Bash(* *)")) {
    problems.push(`"allowed-tools" grants unrestricted Bash. Pre-approve only the exact commands the procedure needs.`);
  }
  for (const command of skill.preApproved) {
    if (!tools.some((tool) => ruleMatches(tool, { tool: "Bash", command }))) problems.push(`"allowed-tools" does not cover \`${command}\`. Add a Bash(…) rule for it.`);
  }
  for (const command of skill.humanOnly) {
    if (tools.some((tool) => ruleMatches(tool, { tool: "Bash", command }))) problems.push(`"allowed-tools" pre-approves \`${command}\`, which the release procedure reserves for a person. Remove it so Claude has to ask.`);
  }
  const steps = parsed.body.split("\n").filter((line) => /^\s*(\d+[.)]|[-*])\s+\S/.test(line) && !/TODO/.test(line));
  if (steps.length < 3) problems.push(`The body should list the procedure as at least three numbered steps so Claude follows the same order every time.`);
  return problems;
}

function toolProblems(input: ArchitectCase, draft: CapstoneDraft) {
  const parsed = parseJsonObject(draft.tool, "The tool request");
  if (parsed.error !== undefined) return [parsed.error];
  const problems: string[] = [];
  const tools = list(parsed.value.tools).map((tool) => record(tool)).filter((tool) => tool !== null);
  const tool = tools.find(({ name }) => name === input.tool.name);
  if (!tool) return [`"tools" must contain a tool named "${input.tool.name}". Tool names must match ^[a-zA-Z0-9_-]{1,128}$.`];
  const description = text(tool.description);
  if (hasTodo(description) || countWords(description) < 20) {
    problems.push(`The description is Claude's main signal for how to use the tool. Write at least 20 words: what it records, what each field means, and when not to call it.`);
  } else if (!/\b(do not|don't|never|only|not for|instead|unless)\b/i.test(description)) {
    problems.push(`State the tool's boundary in its description (for example "Only call this for …; do not …"). Boundaries keep Claude from stretching a tool to cover nearby cases.`);
  }
  const schema = record(tool.input_schema);
  if (!schema || schema.type !== "object") problems.push(`"input_schema" must be a JSON Schema with "type": "object".`);
  else {
    const open = openObjects(schema, "input_schema");
    if (open.length) problems.push(`${open.join(", ")} must set "additionalProperties": false so strict tool use can reject invented fields.`);
    for (const sample of input.tool.samples) {
      const errors = validateSchema(schema, sample.value);
      if (sample.valid && errors.length) problems.push(`The schema rejects a correct record (${sample.label}): ${errors[0]}.`);
      if (!sample.valid && !errors.length) problems.push(`The schema accepts an invalid record (${sample.label}). Tighten it with "required", "enum", or "pattern".`);
    }
  }
  if (tool.strict !== true) problems.push(`Add "strict": true to the tool definition so Claude's tool input is guaranteed to follow input_schema.`);
  const choice = record(parsed.value.tool_choice);
  const forced = choice?.type === "tool" && choice.name === input.tool.name || choice?.type === "any" && tools.length === 1;
  if (!forced) {
    problems.push(choice?.type === "auto" || !choice
      ? `With tool_choice auto (the default), Claude may answer in prose instead of calling the tool. The pipeline needs a call on every transcript: use {"type": "tool", "name": "${input.tool.name}"}.`
      : choice.type === "none" ? `tool_choice "none" prevents tool calls entirely. Use {"type": "tool", "name": "${input.tool.name}"}.`
        : `tool_choice should force ${input.tool.name}: {"type": "tool", "name": "${input.tool.name}"}.`);
  }
  return problems;
}

function ciProblems(input: ArchitectCase, draft: CapstoneDraft) {
  const parsed = parseClaudeCommand(draft.ci);
  if (parsed.error !== undefined) return [parsed.error];
  const { print, prompt, flags, pipeline } = parsed.value;
  const problems: string[] = [];
  if (!print) problems.push(`Add -p (print mode). Without it, claude starts an interactive session and the CI job waits forever.`);
  if (hasTodo(prompt) || countWords(prompt) < 6) problems.push(`Give the review prompt as the argument to -p, for example claude -p "Review … using ${input.ci.checklist}".`);
  else if (!prompt.includes(input.ci.checklist)) problems.push(`The prompt should point Claude at ${input.ci.checklist}. Explicit review criteria keep findings consistent between runs.`);
  if (flags.get("--output-format") !== "json") problems.push(`Use --output-format json so the step prints one JSON object the next step can parse.`);
  const schemaText = flags.get("--json-schema");
  if (typeof schemaText !== "string") problems.push(`Add --json-schema '<schema>' so the verdict is validated against a schema instead of parsed from prose.`);
  else {
    let schema: unknown = null;
    try {
      schema = JSON.parse(schemaText);
    } catch {
      problems.push(`The --json-schema value is not valid JSON. Wrap it in single quotes so the shell keeps the double quotes inside.`);
    }
    if (schema !== null) {
      for (const sample of input.ci.samples) {
        const errors = validateSchema(schema, sample.value);
        if (sample.valid && errors.length) problems.push(`The schema rejects a correct verdict (${sample.label}): ${errors[0]}.`);
        if (!sample.valid && !errors.length) problems.push(`The schema accepts a malformed verdict (${sample.label}). Use "required" and "enum" so the gate can trust the result.`);
      }
    }
  }
  const allowed = flags.get("--allowedTools");
  const tools = typeof allowed === "string" ? splitOutsideParens(allowed, /[,\s]/) : [];
  if (!tools.length) problems.push(`Pass --allowedTools with the read-only tools the review needs (for example "Read,Grep,Glob,Bash(git diff *)"). Nobody is present in CI to approve prompts.`);
  const unsafe = tools.filter((tool) => !readOnlyTools.test(tool));
  if (unsafe.length) problems.push(`--allowedTools includes ${unsafe.join(", ")}. A review job should only read: Read, Grep, Glob, and git diff/log.`);
  if (flags.has("--dangerously-skip-permissions") || flags.get("--permission-mode") === "bypassPermissions") {
    problems.push(`Remove the permission bypass. The allowlist already lets the review run unattended without granting write access.`);
  }
  const jq = pipeline.find((segment) => segment[0] === "jq");
  if (!jq || !jq.some((arg) => arg.includes(".structured_output"))) {
    problems.push(`Pipe the output to jq and read .structured_output. With --json-schema, the validated object is in structured_output; "result" holds the plain-text reply.`);
  }
  return problems;
}

function settingsParse(draft: CapstoneDraft) {
  return parseJsonObject(draft.settings, ".claude/settings.json");
}

function preview(input: ArchitectCase, draft: CapstoneDraft) {
  const out: string[] = [];
  const settings = settingsParse(draft);
  out.push("$ .claude/settings.json");
  if (settings.error !== undefined) out.push(`  ✗ ${settings.error}`);
  else {
    out.push("  PreToolUse dry run:");
    for (const { call, ran, blocked } of hookSimulation(input, settings.value).results) {
      out.push(`    ${call.tool} ${call.path} → ${blocked ? `blocked by ${guard} (exit 2)` : ran ? "guard ran, allowed" : "no hook ran, allowed"}`);
    }
    const rules = permissionRules(settings.value);
    out.push("  Permission decisions (deny → ask → allow):");
    for (const { action } of input.permissionChecks) out.push(`    ${describeAction(action)} → ${permissionDecision(rules, action)}`);
  }
  const mcp = parseJsonObject(draft.mcp, ".mcp.json");
  out.push("", "$ .mcp.json");
  if (mcp.error !== undefined) out.push(`  ✗ ${mcp.error}`);
  else {
    for (const [name, value] of Object.entries(record(mcp.value.mcpServers) ?? {})) {
      const server = record(value) ?? {};
      const resolved = expandEnv(JSON.stringify(server), { [input.mcp.envVar]: `<${input.mcp.envVar} from your shell>` });
      out.push(`  ${name}: ${resolved}`);
    }
  }
  const rule = parseFrontmatter(draft.rule);
  out.push("", `$ ${input.rule.file}`);
  if (rule.error) out.push(`  ✗ ${rule.error}`);
  else {
    const globs = frontmatterList(rule.data.paths);
    const files = [...input.rule.load, ...input.rule.skip];
    out.push(globs.length ? `  paths: ${globs.join(", ")}` : "  no paths → loads at every session start");
    for (const file of files) out.push(`    ${file} → ${!globs.length || globs.some((glob) => globRegex(glob.replace(/^\.\//, "")).test(file)) ? "loads" : "skipped"}`);
  }
  const skill = parseFrontmatter(draft.skill);
  out.push("", `$ .claude/skills/${input.skill.name}/SKILL.md`);
  if (skill.error) out.push(`  ✗ ${skill.error}`);
  else {
    const tools = frontmatterList(skill.data["allowed-tools"], /[,\s]/);
    out.push(`  /${text(skill.data.name) || "(no name)"} · Claude may start it on its own: ${skill.data["disable-model-invocation"] === true ? "no" : "yes"}`);
    for (const command of [...input.skill.preApproved, ...input.skill.humanOnly]) {
      out.push(`    ${command} → ${tools.some((tool) => ruleMatches(tool, { tool: "Bash", command })) ? "pre-approved" : "asks first"}`);
    }
  }
  const tool = parseJsonObject(draft.tool, "tool request");
  out.push("", `$ ${input.tool.name} schema check`);
  if (tool.error !== undefined) out.push(`  ✗ ${tool.error}`);
  else {
    const schema = record(list(tool.value.tools).map(record).find((entry) => entry?.name === input.tool.name)?.input_schema);
    for (const sample of input.tool.samples) {
      const errors = schema ? validateSchema(schema, sample.value) : ["no input_schema"];
      out.push(`  ${sample.label} → ${errors.length ? `rejected (${errors[0]})` : "accepted"}`);
    }
    out.push(`  tool_choice: ${JSON.stringify(tool.value.tool_choice ?? { type: "auto" })}`);
  }
  const ci = parseClaudeCommand(draft.ci);
  out.push("", "$ CI step");
  if (ci.error !== undefined) out.push(`  ✗ ${ci.error}`);
  else {
    out.push(`  print mode: ${ci.value.print ? "yes" : "no"} · output: ${ci.value.flags.get("--output-format") ?? "text"} · schema: ${ci.value.flags.has("--json-schema") ? "yes" : "no"}`);
    out.push(`  allowed tools: ${ci.value.flags.get("--allowedTools") ?? "(none)"}`);
    out.push(`  pipeline: ${ci.value.pipeline.map((segment) => segment[0]).join(" | ")}`);
  }
  return out.join("\n");
}

function lab(input: ArchitectCase): CapstoneDefinition {
  const { mcp, rule, skill, tool, ci } = input;
  const mcpExample = mcp.transport === "http"
    ? `{\n  "mcpServers": {\n    "docs": {\n      "type": "http",\n      "url": "https://mcp.docs.example/mcp",\n      "headers": { "X-Api-Key": "\${DOCS_KEY}" }\n    }\n  }\n}`
    : `{\n  "mcpServers": {\n    "search": {\n      "command": "npx",\n      "args": ["-y", "@example/search-mcp"],\n      "env": { "SEARCH_URL": "\${SEARCH_URL:-http://localhost:9200}" }\n    }\n  }\n}`;
  return {
    id: input.id, stage: input.stage, title: input.title, role: "Claude Code setup",
    brief: input.brief,
    deliverable: `Write the six files the ${input.repo} team will commit: settings with a write guard and permission rules, an MCP server entry, a path-scoped rule, a release Skill, a strict extraction tool, and a CI review step. Each file is parsed and run against the fixtures.`,
    documents: [
      { id: "REPO", title: `${input.repo} layout`, text: input.tree, format: "code" },
      { id: "POLICY", title: "Team policy for Claude Code", text: input.policy },
      {
        id: "GUARD", title: `.claude/hooks/${guard} contract`, format: "code",
        text: `# Already committed. Do not rewrite it; call it from a hook.\n# Usage: ${guard} <dir/> [<dir/> ...]\n# Reads the PreToolUse JSON on stdin and takes tool_input.file_path.\n# Exit 0  → the path is inside one of the directories given as arguments.\n# Exit 2  → the path is outside them; the reason is printed to stderr,\n#           Claude Code blocks the tool call and shows Claude the reason.\n# No file_path in the input → exit 0.`,
      },
      { id: "MCP", title: "MCP server notes", text: input.mcpNote },
      {
        id: "RULE", title: `Conventions for ${rule.topic}`,
        text: `${rule.conventions.map(({ text: line }, index) => `${index + 1}. ${line}`).join("\n")}\n\nThese apply only to ${rule.topic}. Put them in ${rule.file} so they load when Claude works on those files.`,
      },
      {
        id: "SKILL", title: `Release procedure (/${skill.name})`,
        text: `${skill.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\nThe team starts this procedure by typing /${skill.name}. Claude may run ${skill.preApproved.map((command) => `\`${command}\``).join(" and ")} without asking. ${skill.humanOnly.map((command) => `\`${command}\``).join(" and ")} must always ask.`,
      },
      { id: "TOOL", title: `Extraction pipeline · ${tool.name}`, text: `${tool.job}\n\n${tool.spec}\n\nThe pipeline calls the Messages API with model ${tool.model}. Every transcript must produce exactly one ${tool.name} call; prose replies are discarded.` },
      { id: "CI", title: "Pull request review job", text: ci.spec },
    ],
    fields: [
      {
        id: "settings", label: ".claude/settings.json", editor: "json",
        instruction: `Register the write guard as a PreToolUse hook for the Edit and Write tools, and add allow / ask / deny permission rules that implement POLICY.`,
        initial: `{\n  "permissions": {\n    "allow": ["TODO"],\n    "ask": [],\n    "deny": []\n  },\n  "hooks": {\n    "TODO_EVENT": [\n      {\n        "matcher": "TODO",\n        "hooks": [{ "type": "command", "command": "TODO" }]\n      }\n    ]\n  }\n}`,
        example: `{\n  "permissions": {\n    "allow": ["Bash(make check)"],\n    "ask": ["Bash(docker push *)"],\n    "deny": ["Read(./secrets/**)"]\n  },\n  "hooks": {\n    "PostToolUse": [\n      {\n        "matcher": "Edit|Write",\n        "hooks": [{ "type": "command", "command": "\\"$CLAUDE_PROJECT_DIR\\"/.claude/hooks/format.sh" }]\n      }\n    ]\n  }\n}`,
      },
      {
        id: "mcp", label: ".mcp.json", editor: "json",
        instruction: `Add the ${mcp.name} server. This file is committed, so credentials must come from environment variable expansion.`,
        initial: `{\n  "mcpServers": {\n    "TODO": {}\n  }\n}`,
        example: mcpExample,
      },
      {
        id: "rule", label: rule.file, editor: "markdown",
        instruction: `Scope the conventions to ${rule.topic} with a paths list in the frontmatter, then write the rule body.`,
        initial: `---\npaths:\n  - "TODO"\n---\n\n# TODO: rule title\n\nTODO`,
        example: `---\npaths:\n  - "src/api/**/*.ts"\n---\n\n# API handlers\n\n- Validate request bodies with the shared zod schemas.\n- Return errors in the { code, message } envelope.`,
      },
      {
        id: "skill", label: `.claude/skills/${skill.name}/SKILL.md`, editor: "markdown",
        instruction: `Package the release procedure. Decide who may start it and which commands it pre-approves.`,
        initial: `---\nname: TODO\ndescription: TODO\n---\n\nTODO: steps`,
        example: `---\nname: fix-issue\ndescription: Fix a GitHub issue by number. Use when someone asks to fix or close a specific issue.\nargument-hint: [issue-number]\nallowed-tools: Bash(gh issue view *) Bash(npm test *)\n---\n\n1. Read the issue with gh issue view $ARGUMENTS.\n2. Write a failing test, then fix the code.\n3. Run npm test and summarise the change.`,
      },
      {
        id: "tool", label: `${tool.name} tool definition and tool_choice`, editor: "json",
        instruction: `Write the "tools" and "tool_choice" parts of the Messages API request. Only these two keys are graded.`,
        initial: `{\n  "tools": [\n    {\n      "name": "${tool.name}",\n      "description": "TODO",\n      "input_schema": {\n        "type": "object",\n        "properties": {}\n      }\n    }\n  ],\n  "tool_choice": { "type": "auto" }\n}`,
        example: `{\n  "tools": [\n    {\n      "name": "get_weather",\n      "description": "Get the current weather for one city. Only call this for current conditions; do not use it for forecasts.",\n      "strict": true,\n      "input_schema": {\n        "type": "object",\n        "properties": {\n          "city": { "type": "string" },\n          "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] }\n        },\n        "required": ["city", "unit"],\n        "additionalProperties": false\n      }\n    }\n  ],\n  "tool_choice": { "type": "auto" }\n}`,
      },
      {
        id: "ci", label: "CI step (run:)", editor: "shell",
        instruction: `Write the shell command for the review job: headless Claude Code, read-only tools, a JSON Schema verdict, and jq extracting the validated object.`,
        initial: `claude TODO \\\n  | jq TODO`,
        example: `claude -p "List the exported functions in auth.py" \\\n  --output-format json \\\n  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \\\n  --allowedTools "Read,Grep" \\\n  | jq '.structured_output.functions'`,
      },
    ],
    criteria: [
      { id: "hook", title: "Block out-of-scope writes with a PreToolUse hook", objectives: ["1.5", "1.4"],
        review: "Prompts can be ignored; hooks are enforced. PreToolUse runs before the tool executes, and a command hook that exits 2 blocks the call and returns its stderr to Claude. Match every write tool (Edit|Write) and pass only the approved directories." },
      { id: "permissions", title: "Scope tool access with permission rules", objectives: ["2.3", "1.4"],
        review: "Claude Code checks deny, then ask, then allow; the first match wins and an allow can never override a deny. Deny secrets by path, pre-approve narrow commands, and route irreversible commands to ask." },
      { id: "mcp", title: "Share an MCP server without committing secrets", objectives: ["2.4"],
        review: ".mcp.json is committed for the whole team. Claude Code expands ${VAR} and ${VAR:-default} in command, args, env, url, and headers, so each person supplies their own credential from the environment." },
      { id: "rules", title: "Load conventions only for matching paths", objectives: ["3.3", "3.1"],
        review: "A file in .claude/rules with a paths frontmatter list loads only when Claude works with matching files. Without paths it loads every session. Keep the globs tight and the body specific." },
      { id: "skill", title: "Package a procedure as a Skill", objectives: ["3.2"],
        review: "A Skill bundles a repeatable procedure behind /name. Use disable-model-invocation: true for procedures with side effects, and allowed-tools to pre-approve only the routine commands." },
      { id: "tool", title: "Define a precise tool and force its use", objectives: ["2.1", "4.3"],
        review: "Write the tool description as the contract: purpose, field meanings, and boundaries. Use strict: true with additionalProperties: false to guarantee the input shape, and tool_choice {type: tool} when every request must produce a call." },
      { id: "ci", title: "Run Claude Code in CI with a schema-checked verdict", objectives: ["3.6", "4.1", "4.3", "5.6"],
        review: "In CI use claude -p with --output-format json and --json-schema, read the validated object from .structured_output, give explicit review criteria, require file and line for each finding, and allow only read-only tools." },
    ],
    preview: (draft) => ({ kind: "console", text: preview(input, draft) }),
    exercise: (draft) => {
      const settings = settingsParse(draft);
      const settingsError = settings.error !== undefined ? [settings.error] : [];
      return [
        verdict("hook", settingsError.length ? settingsError : hookProblems(input, settings.value),
          `The guard blocks ${input.hookCalls.filter(({ expect }) => expect === "block").length} out-of-scope writes and allows the approved ones.`),
        verdict("permissions", settingsError.length ? settingsError : permissionProblems(input, settings.value),
          "Every policy action gets the intended decision under deny → ask → allow precedence."),
        verdict("mcp", mcpProblems(input, draft), `The ${mcp.name} server resolves with each engineer's own credential and no secret is committed.`),
        verdict("rules", ruleProblems(input, draft), `The rule loads only for ${rule.topic} and states all ${rule.conventions.length} conventions.`),
        verdict("skill", skillProblems(input, draft), `/${skill.name} is human-started, pre-approves only routine commands, and lists the steps.`),
        verdict("tool", toolProblems(input, draft), `${tool.name} accepts the valid record, rejects every malformed one, and is forced on each call.`),
        verdict("ci", ciProblems(input, draft), "The CI step runs headless with read-only tools and gates on a schema-validated verdict."),
      ];
    },
    reference: { label: "Claude Code settings, hooks, and permissions", url: "https://code.claude.com/docs/en/settings" },
  };
}

export const architectDefinitions = {
  capstone: lab({
    id: "architect-dispatch-repo-lab-v2", stage: "capstone", title: "Set up Claude Code for the Dispatch Board repo",
    brief: "The City Dispatch platform team is rolling Claude Code out to eight engineers on the dispatch-board monorepo. Last week an agent edited production Terraform, an engineer pasted the incident tracker token into Slack, and the PR review bot posted prose nobody could parse. Write the shared configuration so the guard rails are enforced by Claude Code itself, not by asking nicely in a prompt.",
    repo: "Dispatch Board",
    tree: `dispatch-board/\n├── .claude/\n│   ├── hooks/guard-paths.sh\n│   ├── rules/\n│   └── skills/\n├── .env\n├── .env.production\n├── docs/review-checklist.md\n├── infra/terraform/prod/main.tf\n├── scripts/seed.ts\n├── services/dispatch-api/src/\n│   ├── db/migrations/0041_create_units.sql\n│   ├── db/migrations/0042_add_unit_status.sql\n│   └── routes/units.ts\n└── web/console/src/App.tsx`,
    policy: "1. Claude may create and edit files only under services/ and web/. Infra, scripts, and Claude's own configuration change through a person. Enforce this with the committed guard hook.\n2. Claude must never read .env or .env.production.\n3. Claude may run the unit tests (npm run test -- <suite>) and npm run lint without asking.\n4. git push always asks first.\n5. Anything else (for example rm -rf or curl to a webhook) must not be pre-approved.\n6. Do not set a permission mode in the shared file.",
    allowed: ["services/", "web/"],
    hookCalls: [
      { tool: "Write", path: "services/dispatch-api/src/routes/units.ts", expect: "allow" },
      { tool: "Edit", path: "web/console/src/App.tsx", expect: "allow" },
      { tool: "Edit", path: "infra/terraform/prod/main.tf", expect: "block" },
      { tool: "Write", path: "scripts/seed.ts", expect: "block" },
      { tool: "Edit", path: ".claude/settings.json", expect: "block" },
    ],
    permissionChecks: [
      { action: { tool: "Read", path: ".env" }, expect: "deny", hint: "Add Read(./.env) to deny." },
      { action: { tool: "Read", path: ".env.production" }, expect: "deny", hint: "Add Read(./.env.*) to deny; Read(./.env) does not cover it." },
      { action: { tool: "Bash", command: "npm run test -- units" }, expect: "allow", hint: "Add Bash(npm run test *) to allow." },
      { action: { tool: "Bash", command: "npm run lint" }, expect: "allow", hint: "Add Bash(npm run lint) to allow." },
      { action: { tool: "Bash", command: "git push origin main" }, expect: "ask", hint: "Add Bash(git push *) to ask." },
      { action: { tool: "Bash", command: "rm -rf services" }, expect: "not-allow", hint: "Remove broad Bash allow rules; allow only the exact commands in POLICY." },
      { action: { tool: "Bash", command: "curl -X POST https://hooks.chat.example/T0" }, expect: "not-allow", hint: "Remove broad Bash allow rules." },
    ],
    mcp: { transport: "http", name: "incidents", url: "https://mcp.incidents.dispatch.example/mcp", header: "Authorization", scheme: "Bearer", envVar: "INCIDENTS_TOKEN", leaked: "inc_live_7Hq2Lx9vRb4Tn0pWc8Zd" },
    mcpNote: "The incident tracker runs a remote MCP server at https://mcp.incidents.dispatch.example/mcp (Streamable HTTP). It expects an Authorization header of the form \"Bearer <personal token>\". Every engineer exports their own token as INCIDENTS_TOKEN in their shell. Existing permission rules refer to its tools as mcp__incidents__*.\n\nFrom #dispatch-platform, Tuesday: “here’s mine if you need to test: inc_live_7Hq2Lx9vRb4Tn0pWc8Zd” (this token has been reported for rotation).",
    rule: {
      file: ".claude/rules/migrations.md", topic: "database migrations",
      load: ["services/dispatch-api/src/db/migrations/0042_add_unit_status.sql", "services/dispatch-api/src/db/migrations/0043_index_units.sql"],
      skip: ["services/dispatch-api/src/routes/units.ts", "web/console/src/App.tsx", "scripts/seed.ts"],
      conventions: [
        { label: "immutable", pattern: /(never|don'?t|do not|must not|cannot)\b[^.\n]{0,40}\b(edit|modify|change|rewrite|alter)|immutable|new (numbered )?(migration|file)/i, text: "Applied migrations are immutable: add a new numbered file instead of editing one." },
        { label: "rollback", pattern: /\b(down|rollback|roll back|revert)\b/i, text: "Every migration needs a matching down (rollback) section." },
        { label: "check", pattern: /npm run db:check/, text: "Run npm run db:check after writing a migration." },
      ],
    },
    skill: {
      name: "cut-release", purpose: "cutting a dispatch-board release when a person asks for one",
      steps: ["Run npm run test -- all and stop if anything fails.", "Update CHANGELOG.md from the merged pull request titles since the last tag.", "Create the tag with git tag v<version>.", "A person pushes the tag with git push origin --tags."],
      preApproved: ["npm run test -- all", "git tag v2.8.0"], humanOnly: ["git push origin --tags"],
    },
    tool: {
      name: "record_dispatch", model: "claude-haiku-5-5",
      job: "Radio transcripts from the dispatch floor are converted into dispatch records overnight. Last month the extraction step used a vague search tool and sometimes replied in prose, so records were lost.",
      spec: "record_dispatch fields:\n- unit_id: string, always U- followed by three digits (U-214)\n- priority: one of P1, P2, P3\n- location: free-text street or landmark\n- incident_type: one of fire, medical, traffic, other\nAll four are required. No other fields are accepted.",
      samples: [
        { label: "U-214, P1, Pier 9 gate, fire", valid: true, value: { unit_id: "U-214", priority: "P1", location: "Pier 9 gate", incident_type: "fire" } },
        { label: "unit_id \"214\"", valid: false, value: { unit_id: "214", priority: "P2", location: "Elm & 3rd", incident_type: "traffic" } },
        { label: "priority \"urgent\"", valid: false, value: { unit_id: "U-118", priority: "urgent", location: "Depot", incident_type: "medical" } },
        { label: "missing location", valid: false, value: { unit_id: "U-301", priority: "P3", incident_type: "other" } },
        { label: "extra notes field", valid: false, value: { unit_id: "U-214", priority: "P1", location: "Pier 9", incident_type: "fire", notes: "caller hung up" } },
      ],
    },
    ci: {
      checklist: "docs/review-checklist.md",
      spec: "The GitHub Actions job runs on each pull request with the diff checked out. It must run Claude Code non-interactively, review the change against docs/review-checklist.md, and print JSON. The next step fails the build when verdict is request_changes, so the verdict must be machine-checked.\n\nVerdict shape:\n- verdict: approve or request_changes\n- findings: array (may be empty); each finding has file (string), line (integer), rule (string, a checklist ID such as R3), and severity (blocker or warning)\nverdict and findings are required, as are all four finding fields. No other keys.\n\nThe job has no human to approve prompts and must not be able to edit files.",
      samples: [
        { label: "request_changes with one blocker", valid: true, value: { verdict: "request_changes", findings: [{ file: "services/dispatch-api/src/routes/units.ts", line: 42, rule: "R3", severity: "blocker" }] } },
        { label: "approve with no findings", valid: true, value: { verdict: "approve", findings: [] } },
        { label: "verdict \"LGTM\"", valid: false, value: { verdict: "LGTM", findings: [] } },
        { label: "finding without a line", valid: false, value: { verdict: "request_changes", findings: [{ file: "web/console/src/App.tsx", rule: "R1", severity: "warning" }] } },
        { label: "findings missing", valid: false, value: { verdict: "approve" } },
      ],
    },
  }),
  transfer: lab({
    id: "architect-permits-repo-retention-v2", stage: "transfer", title: "Set up Claude Code for the Harbor Permits portal",
    brief: "The Harbor Permits team maintains a pnpm monorepo for the public permit portal and its shared form library. They want the same Claude Code guard rails you built for Dispatch, but their data lives behind a local read-only database MCP server, their conventions cover translations, and their review job checks accessibility. Write their shared configuration.",
    repo: "Harbor Permits",
    tree: `permits-portal/\n├── .claude/\n│   ├── hooks/guard-paths.sh\n│   ├── rules/\n│   └── skills/\n├── .env\n├── apps/portal/src/\n│   ├── i18n/en.json\n│   ├── i18n/es.json\n│   └── pages/apply.tsx\n├── config/secrets.json\n├── deploy/k8s/prod.yaml\n├── docs/a11y-checklist.md\n└── packages/forms/src/\n    ├── fields/date.tsx\n    └── schema.ts`,
    policy: "1. Claude may create and edit files only under apps/ and packages/. Deployment manifests, config, and Claude's own configuration change through a person. Enforce this with the committed guard hook.\n2. Claude must never read .env or config/secrets.json.\n3. Claude may run pnpm test --filter <package> and pnpm lint without asking.\n4. git push always asks first.\n5. kubectl and destructive shell commands must not be pre-approved.\n6. Do not set a permission mode in the shared file.",
    allowed: ["apps/", "packages/"],
    hookCalls: [
      { tool: "Write", path: "apps/portal/src/pages/apply.tsx", expect: "allow" },
      { tool: "Edit", path: "packages/forms/src/schema.ts", expect: "allow" },
      { tool: "Edit", path: "deploy/k8s/prod.yaml", expect: "block" },
      { tool: "Write", path: "config/secrets.json", expect: "block" },
      { tool: "Edit", path: ".claude/settings.json", expect: "block" },
    ],
    permissionChecks: [
      { action: { tool: "Read", path: ".env" }, expect: "deny", hint: "Add Read(./.env) to deny." },
      { action: { tool: "Read", path: "config/secrets.json" }, expect: "deny", hint: "Add Read(./config/secrets.json) to deny." },
      { action: { tool: "Bash", command: "pnpm test --filter portal" }, expect: "allow", hint: "Add Bash(pnpm test *) to allow." },
      { action: { tool: "Bash", command: "pnpm lint" }, expect: "allow", hint: "Add Bash(pnpm lint) to allow." },
      { action: { tool: "Bash", command: "git push origin release" }, expect: "ask", hint: "Add Bash(git push *) to ask." },
      { action: { tool: "Bash", command: "kubectl apply -f deploy/k8s/prod.yaml" }, expect: "not-allow", hint: "Remove broad Bash allow rules." },
      { action: { tool: "Bash", command: "rm -rf apps" }, expect: "not-allow", hint: "Remove broad Bash allow rules; allow only the exact commands in POLICY." },
    ],
    mcp: { transport: "stdio", name: "permits-db", command: "npx", packageName: "@harbor/permits-db-mcp", flag: "--read-only", envKey: "PERMITS_DB_URL", envVar: "PERMITS_DB_URL", leaked: "postgres://svc_portal:Hx9-wq2Lm4@db.harbor.internal:5432/permits" },
    mcpNote: "The permits database is exposed through a local stdio MCP server published as @harbor/permits-db-mcp. Start it with npx -y @harbor/permits-db-mcp --read-only. It reads its connection string from the PERMITS_DB_URL environment variable, which each engineer sets in their shell. Permission rules refer to its tools as mcp__permits-db__*.\n\nFrom the onboarding doc draft: “connection string: postgres://svc_portal:Hx9-wq2Lm4@db.harbor.internal:5432/permits” (flagged for rotation).",
    rule: {
      file: ".claude/rules/i18n.md", topic: "translation files",
      load: ["apps/portal/src/i18n/en.json", "apps/portal/src/i18n/es.json"],
      skip: ["apps/portal/src/pages/apply.tsx", "packages/forms/src/schema.ts", "packages/forms/src/fields/date.tsx"],
      conventions: [
        { label: "locales", pattern: /\b(every|all|each|both)\b[^.\n]{0,30}\b(locale|language|translation|file)s?\b/i, text: "Add every new key to all locale files in the same change." },
        { label: "placeholders", pattern: /placeholder|interpolat|\{[a-zA-Z]+\}/i, text: "Never translate placeholders such as {applicantName}." },
        { label: "check", pattern: /pnpm i18n:check/, text: "Run pnpm i18n:check after editing translations." },
      ],
    },
    skill: {
      name: "publish-forms", purpose: "publishing a new version of the shared forms package when a person asks",
      steps: ["Run pnpm test --filter forms and stop if anything fails.", "Run pnpm changeset version to bump the version and changelog.", "Create the tag with git tag forms-v<version>.", "A person publishes with npm publish --access public."],
      preApproved: ["pnpm test --filter forms", "git tag forms-v1.9.0"], humanOnly: ["npm publish --access public"],
    },
    tool: {
      name: "record_permit", model: "claude-haiku-5-5",
      job: "Scanned permit applications are converted into permit records each night. The previous extraction prompt asked for JSON in prose and broke whenever an applicant wrote notes in the margin.",
      spec: "record_permit fields:\n- permit_id: string, always HP- followed by five digits (HP-00412)\n- category: one of mooring, events, fishing\n- applicant: the applicant's full name\n- start_date: ISO date (YYYY-MM-DD)\nAll four are required. No other fields are accepted.",
      samples: [
        { label: "HP-00412, mooring, Ana Ruiz, 2026-12-01", valid: true, value: { permit_id: "HP-00412", category: "mooring", applicant: "Ana Ruiz", start_date: "2026-12-01" } },
        { label: "permit_id \"412\"", valid: false, value: { permit_id: "412", category: "events", applicant: "Joe Park", start_date: "2026-12-03" } },
        { label: "category \"parking\"", valid: false, value: { permit_id: "HP-00977", category: "parking", applicant: "Li Wen", start_date: "2026-12-09" } },
        { label: "missing applicant", valid: false, value: { permit_id: "HP-01002", category: "fishing", start_date: "2027-01-02" } },
        { label: "extra margin_notes field", valid: false, value: { permit_id: "HP-00412", category: "mooring", applicant: "Ana Ruiz", start_date: "2026-12-01", margin_notes: "call first" } },
      ],
    },
    ci: {
      checklist: "docs/a11y-checklist.md",
      spec: "The CI job runs on each pull request that touches apps/ or packages/forms. It must run Claude Code non-interactively, review the diff against docs/a11y-checklist.md, and print JSON. The next step fails the build when result is fail.\n\nResult shape:\n- result: pass or fail\n- issues: array (may be empty); each issue has path (string), line (integer), check (string, a checklist ID such as A4), and level (error or note)\nresult and issues are required, as are all four issue fields. No other keys.\n\nThe job has no human to approve prompts and must not be able to edit files.",
      samples: [
        { label: "fail with one error", valid: true, value: { result: "fail", issues: [{ path: "apps/portal/src/pages/apply.tsx", line: 88, check: "A4", level: "error" }] } },
        { label: "pass with no issues", valid: true, value: { result: "pass", issues: [] } },
        { label: "result \"ok\"", valid: false, value: { result: "ok", issues: [] } },
        { label: "issue without a line", valid: false, value: { result: "fail", issues: [{ path: "packages/forms/src/fields/date.tsx", check: "A2", level: "note" }] } },
        { label: "issues missing", valid: false, value: { result: "pass" } },
      ],
    },
  }),
};

export type { ArchitectCase };
