import type { ExamQuestion } from "../exam-practice";

export const sources = {
  prompt: ["Anthropic · Prompt engineering", "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"],
  projects: ["Claude Help · Manage Projects", "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects"],
  artifacts: ["Claude Help · Artifacts", "https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them"],
  models: ["Claude Platform · Model selection", "https://platform.claude.com/docs/en/models/overview"],
  grounding: ["Claude Platform · Reduce hallucinations", "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations"],
  eval: ["Anthropic · Evaluation design", "https://www.anthropic.com/research/demystifying-evals-for-ai-agents"],
  context: ["Anthropic · Context engineering", "https://www.anthropic.com/research/effective-context-engineering-for-ai-agents"],
  agents: ["Anthropic · Workflow and agent patterns", "https://www.anthropic.com/research/building-effective-agents"],
  subagents: ["Claude Agent SDK · Subagents", "https://code.claude.com/docs/en/agent-sdk/subagents"],
  sessions: ["Claude Code · Sessions", "https://code.claude.com/docs/en/sessions"],
  hooks: ["Claude Code · Hooks", "https://code.claude.com/docs/en/hooks"],
  memory: ["Claude Code · Memory and rules", "https://code.claude.com/docs/en/memory"],
  skills: ["Claude Code · Skills", "https://code.claude.com/docs/en/skills"],
  cli: ["Claude Code · CLI reference", "https://code.claude.com/docs/en/cli-reference"],
  settings: ["Claude Code · Settings and precedence", "https://code.claude.com/docs/en/settings"],
  mcpConfig: ["Claude Code · MCP configuration", "https://code.claude.com/docs/en/mcp"],
  mcp: ["MCP specification · Tools", "https://modelcontextprotocol.io/specification/2026-07-28/server/tools"],
  resources: ["MCP specification · Resources", "https://modelcontextprotocol.io/specification/2026-07-28/server/resources"],
  tool: ["Claude Platform · Tool definitions", "https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"],
  stop: ["Claude Platform · Stop reasons", "https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons"],
  messages: ["Claude Platform · Messages API primer", "https://platform.claude.com/docs/en/claude_api_primer"],
  errors: ["Claude Platform · API errors", "https://platform.claude.com/docs/en/api/errors"],
  streaming: ["Claude Platform · Streaming messages", "https://platform.claude.com/docs/en/build-with-claude/streaming"],
  batch: ["Claude Platform · Message Batches", "https://platform.claude.com/docs/en/build-with-claude/batch-processing"],
  structured: ["Claude Platform · Structured outputs", "https://platform.claude.com/docs/en/build-with-claude/structured-outputs"],
  caching: ["Claude Platform · Prompt caching", "https://platform.claude.com/docs/en/build-with-claude/prompt-caching"],
  tokens: ["Claude Platform · Token counting", "https://platform.claude.com/docs/en/build-with-claude/token-counting"],
  privacy: ["Anthropic · Trust Center", "https://trust.anthropic.com/"],
  safety: ["Claude Platform · Guardrails and least privilege", "https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks"],
  auth: ["Claude Platform · Authentication", "https://platform.claude.com/docs/en/api/overview#authentication"],
  retrieval: ["Anthropic · Contextual Retrieval", "https://www.anthropic.com/research/contextual-retrieval"],
  research: ["Anthropic · Multi-agent research system", "https://www.anthropic.com/engineering/multi-agent-research-system"],
  fluency: ["Anthropic · AI Fluency Framework", "https://www.anthropic.com/ai-fluency"],
  managed: ["Claude Platform · Managed Agents", "https://platform.claude.com/docs/en/managed-agents/overview"],
  plugins: ["Claude Code · Plugins", "https://code.claude.com/docs/en/plugins"],
  files: ["Claude Platform · Files API", "https://platform.claude.com/docs/en/build-with-claude/files"],
  claudeMemory: ["Claude Help · Search and memory", "https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context"],
  claudeResearch: ["Claude Help · Using Research", "https://support.claude.com/en/articles/11088861-use-research-on-claude"],
  claudeSkills: ["Claude Help · Skills, connectors and plugins", "https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory"],
  deployment: ["Claude Platform · API and deployment options", "https://platform.claude.com/docs/en/api/overview"],
} as const;

type Source = keyof typeof sources;

/**
 * Practice questions were rewritten to the exam-realism spec (research/exam-realism.md) on this date,
 * keeping their ids. Answers to live-scored questions (mixed, domain and spaced-review practice, city
 * mission checks) saved earlier refer to wording learners can no longer see, so they stay in history
 * but no longer count as evidence. Timed practice exams keep a snapshot and are unaffected.
 */
export const questionReleaseAt = Date.parse("2026-11-25T00:00:00Z");
// No learner answered anything before CertCity's first release; earlier timestamps are fixtures.
const firstReleaseAt = Date.parse("2026-11-01T00:00:00Z");
export const answeredBeforeRelease = (submittedAt: number | undefined) =>
  submittedAt !== undefined && submittedAt >= firstReleaseAt && submittedAt < questionReleaseAt;
type Choice = readonly [text: string, rationale: string];

export type PracticeItem = ExamQuestion & {
  objective: `${number}.${number}`;
  scenario: string;
  context?: string;
  pilot?: boolean;
  source: Source;
  rationales: Record<string, string>;
};

export function item(
  id: string,
  objective: PracticeItem["objective"],
  source: Source,
  scenario: string,
  prompt: string,
  key: string,
  explanation: string,
  ...choices: Choice[]
): PracticeItem {
  const options = choices.map(([label], index) => [String.fromCharCode(97 + index), label] as const);
  return {
    id, objective, skill: objective, source, scenario, prompt, options, correct: [...key], explanation,
    rationales: Object.fromEntries(options.map(([value], index) => [value, choices[index][1]])),
  };
}

export type PracticeBank = {
  practice: readonly PracticeItem[];
  followup: readonly PracticeItem[];
};
