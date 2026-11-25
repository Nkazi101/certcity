// Checks the in-case glossary: plain, short definitions; no spelling claimed twice; the generated lesson map is current;
// the matcher marks jargon in assignment text without marking ordinary words.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, file);
};

const root = path.join(__dirname, "..");
const { claudeGlossary } = require(path.join(root, "lib/glossary/claude.ts"));
const { glossText, defineTerm } = require(path.join(root, "lib/glossary/index.ts"));
const { generate, output } = require("./build-glossary-lessons.cjs");

const words = (text) => text.split(/\s+/).filter(Boolean).length;
const ids = new Set();
const spellings = new Map();
for (const entry of claudeGlossary.entries) {
  assert.ok(!ids.has(entry.id), `duplicate id ${entry.id}`);
  ids.add(entry.id);
  assert.ok(entry.forms.length > 0, `${entry.id} has no forms`);
  const count = words(entry.plain);
  assert.ok(count >= 8 && count <= 45, `${entry.id}: definition is ${count} words (8–45)`);
  assert.ok(/[.?!]$/.test(entry.plain.trim()), `${entry.id}: definition should end with a full stop`);
  if (entry.example) assert.ok(words(entry.example) <= 25, `${entry.id}: example over 25 words`);
  for (const form of entry.forms) {
    const key = entry.caseSensitive || /[_./<>$:-]|[a-z][A-Z]|^[A-Z0-9]{2,}s?$/.test(form) ? form : form.toLowerCase();
    assert.ok(!spellings.has(key), `"${form}" is claimed by ${spellings.get(key)} and ${entry.id}`);
    spellings.set(key, entry.id);
  }
}
for (const pattern of claudeGlossary.patterns) {
  assert.ok(!ids.has(pattern.id), `duplicate id ${pattern.id}`);
  ids.add(pattern.id);
}

assert.equal(fs.readFileSync(output, "utf8"), generate(), "lib/glossary/claude-lessons.ts is stale: run node scripts/build-glossary-lessons.cjs");

const marked = (text) => glossText(text).filter((segment) => typeof segment !== "string").map(({ id }) => id);
const cases = [
  ["Trace: assistant text; stop_reason: tool_use; tool ID c42.", ["stop-reason", "tool-use"]],
  ["Send a tool_result with the same tool_use_id.", ["tool-result", "tool-use-id"]],
  ["isError true · errorCategory \"transient\" · isRetryable true", ["isError", "errorCategory", "isRetryable"]],
  ["A PreToolUse hook with matcher Edit|Write in .claude/settings.json", ["pre-tool-use", "hook", "matcher", "settings-json"]],
  ["Run claude -p with --output-format json and --json-schema.", ["claude-p", "output-format"]],
  ["The MCP connector calls a remote MCP server.", ["mcp-connector", "mcp-server"]],
  ["Allow mcp__calendar__hold_slot but not mcp__issues.", ["mcp-tool-name", "mcp-server-prefix"]],
  ["Result for toolu_01A7pqX arrived second.", ["tool-use-id-value"]],
  ["Keep the format in the Project instructions and the files in Project knowledge.", ["project-instructions", "project-knowledge"]],
  ["Use the Message Batches API and match results by custom_id.", ["batches", "custom-id"]],
  // Ordinary words stay plain.
  ["Read Claude's drafts, then every dated paper on the desk.", []],
  ["The description says to check skills, the context and the source.", []],
  ["Our api key and the ci build", []],
  ["Exam skills: Description of the goal.", ["description-4d"]],
];
for (const [text, expected] of cases) assert.deepEqual(marked(text), expected, text);
assert.deepEqual(marked("tool_use then tool_use again"), ["tool-use"], "each term is marked once per block");
assert.equal(defineTerm("isError")?.id, "isError");
assert.equal(defineTerm("order"), null);
assert.ok(defineTerm("mcp__parts__lookup")?.plain.includes("\"parts\""), "pattern definitions name the server");

// Jargon that cases and labs lean on must be defined.
const required = ["tool_use", "tool_result", "tool_use_id", "stop_reason", "max_tokens", "isError", "errorCategory", "isRetryable",
  "is_error", "PreToolUse", "PostToolUse", ".mcp.json", "CLAUDE.md", "custom_id", "cache_control", "--json-schema",
  "structured_output", "claude -p", "Message Batches API", "subagent", "MCP", "Skills", "Projects", "Project knowledge", "JSON"];
const missing = required.filter((term) => !defineTerm(term));
assert.deepEqual(missing, [], `undefined required terms: ${missing.join(", ")}`);

const linked = Object.keys(require(output.replace(/\.ts$/, ".ts")).termLessons).length;
console.log(`Glossary · ${claudeGlossary.entries.length} terms and ${claudeGlossary.patterns.length} name patterns · ${linked} linked to lessons · ${cases.length} matcher cases checked.`);
