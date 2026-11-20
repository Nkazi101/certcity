import type { PlaceId } from "../world";

export type TrackId = "associate-foundations" | "developer-foundations" | "architect-foundations" | "architect-professional";

export type Domain = {
  id: number;
  title: string;
  weight: number;
  objectives: readonly string[];
};

export type Track = {
  id: TrackId;
  code: string;
  role: string;
  level: "Foundations" | "Professional";
  description: string;
  count: number;
  fee: number;
  guide: string;
  prep: string;
  place: PlaceId;
  assignment: string;
  domains: readonly Domain[];
};

export const blueprint = "2026-07.v1";
export const blueprintLabel = "Exam guide v1.0 · July 2026";
export const partnerCatalog = "https://anthropic-partners.skilljar.com/page/partner-certifications";
export const partnerFAQ = "https://anthropic-partners.skilljar.com/page/faq-certifications";
export const pearson = "https://www.pearsonvue.com/us/en/anthropic.html";
export const examMinutes = 120;
const academy = "https://anthropic-partners.skilljar.com";
const guideRoot = "https://everpath-course-content.s3-accelerate.amazonaws.com/instructor%2F6nizmqk8tpzpfjvt6qmmav7rh%2Fpublic";

function domain(id: number, title: string, weight: number, ...objectives: string[]): Domain {
  return { id, title, weight, objectives };
}

export const tracks: readonly Track[] = [
  {
    id: "associate-foundations", code: "CCAO-F", role: "Associate", level: "Foundations",
    description: "Use Claude in everyday work. Practice giving clear instructions, checking outputs, and deciding when to hand a task to a person.",
    count: 60, fee: 99, place: "school", assignment: "Prepare an enrollment reply",
    guide: `${guideRoot}/1783542847%2FClaude+Certified+Associate+%E2%80%93+Foundations+Exam+Guide.pdf`,
    prep: `${academy}/path/claude-certified-associate-foundations`,
    domains: [
      domain(1, "Prompting and task execution", 14, "Write task-specific prompts", "Break complex work into steps", "Improve prompts through iteration", "Adapt prompts to the type of work"),
      domain(2, "Output evaluation and validation", 21, "Check accuracy and completeness", "Detect unsupported claims, inconsistencies, and bias", "Verify claims against sources", "Decide when human verification is needed", "Adapt outputs for an audience", "Choose an output format"),
      domain(3, "Product and model selection", 12, "Choose Claude features", "Distinguish model families", "Balance cost, speed, and quality", "Manage context and memory"),
      domain(4, "Workflow integration and solution design", 16, "Identify requirements and use cases", "Research and improve a process", "Design and revise a solution", "Integrate Claude into existing work", "Explain value and limitations"),
      domain(5, "Configuration and knowledge management", 12, "Set up Projects and their knowledge", "Manage files and connectors", "Set reusable instructions", "Keep configurations and knowledge current"),
      domain(6, "Governance, risk, and responsible use", 15, "Judge whether a use case is appropriate", "Handle sensitive information", "Follow organizational policies", "Consider ethical effects"),
      domain(7, "Troubleshooting and optimization", 10, "Diagnose poor outputs", "Use feedback to revise the approach", "Improve workflow efficiency"),
    ],
  },
  {
    id: "developer-foundations", code: "CCDV-F", role: "Developer", level: "Foundations",
    description: "Build and ship applications with the Claude API, Claude Code, and MCP. Read traces and debug the behavior of a working integration.",
    count: 53, fee: 125, place: "restaurant", assignment: "Validate a supplier invoice",
    guide: `${guideRoot}/1783542875%2FClaude+Certified+Developer+%E2%80%93+Foundations+Exam+Guide.pdf`,
    prep: `${academy}/path/claude-certified-developer-foundations`,
    domains: [
      domain(1, "Agents and workflows", 14.7, "Choose an agent architecture", "Build agents with Claude", "Use agent patterns and frameworks"),
      domain(2, "Applications and integration", 33.1, "Translate requirements", "Manage the system lifecycle", "Handle Claude API mechanics", "Apply software engineering fundamentals", "Design a Claude application", "Manage versioned configuration"),
      domain(3, "Claude Code", 3.1, "Operate Claude Code"),
      domain(4, "Evaluation, testing, and debugging", 2.6, "Trace and handle failures"),
      domain(5, "Model selection and optimization", 16.8, "Apply LLM fundamentals", "Integrate SDKs and transports", "Make model trade-offs", "Manage cost and tokens"),
      domain(6, "Prompt and context engineering", 11, "Engineer context", "Engineer prompts", "Handle model outputs"),
      domain(7, "Security and safety", 8.1, "Secure application data", "Layer deployment guardrails", "Enforce policies with hooks", "Manage identity and secrets"),
      domain(8, "Tools and MCP", 10.6, "Implement tools", "Develop MCP servers", "Choose an agent extension"),
    ],
  },
  {
    id: "architect-foundations", code: "CCAR-F", role: "Architect", level: "Foundations",
    description: "Design production agent systems. Practice orchestration, tool contracts, Claude Code workflows, and reliability under failure.",
    count: 60, fee: 125, place: "dispatch", assignment: "Repair the order lookup",
    guide: `${guideRoot}/1783542750%2FClaude+Certified+Architect+%E2%80%93+Foundations+Exam+Guide.pdf`,
    prep: `${academy}/page/claude-certified-architect-foundations-prep-courses`,
    domains: [
      domain(1, "Agent architecture and orchestration", 27, "Run the agent loop", "Coordinate specialist agents", "Invoke workers with scoped context", "Enforce prerequisites and handoffs", "Intercept or transform tool calls with hooks", "Decompose complex work", "Resume or branch a session"),
      domain(2, "Tool design and MCP integration", 18, "Define clear tool boundaries", "Return structured tool errors", "Scope tool access and select tools", "Configure MCP integrations", "Choose built-in tools"),
      domain(3, "Claude Code configuration and workflows", 20, "Scope project instructions", "Create shared commands and Skills", "Apply path-specific rules", "Decide when to plan", "Refine changes through feedback", "Run Claude Code in CI"),
      domain(4, "Prompting and structured output", 20, "Specify review criteria", "Teach decision boundaries with examples", "Enforce a schema", "Validate and repair extraction", "Schedule batch processing", "Design independent review passes"),
      domain(5, "Context management and reliability", 15, "Preserve critical facts", "Resolve ambiguity and escalate", "Propagate worker errors", "Manage long codebase investigations", "Calibrate human review", "Preserve source provenance"),
    ],
  },
  {
    id: "architect-professional", code: "CCAR-P", role: "Architect", level: "Professional",
    description: "Lead enterprise deployments. Design integrations, establish evaluation and governance, and agree on how a system will operate after launch.",
    count: 63, fee: 175, place: "office", assignment: "Plan a support rollout",
    guide: `${guideRoot}/1783542810%2FClaude+Certified+Architect+%E2%80%93+Professional+Exam+Guide.pdf`,
    prep: `${academy}/path/claude-certified-architect-professional`,
    domains: [
      domain(1, "Solution design and architecture", 17, "Translate business problems", "Design the end-to-end flow", "Select an architecture pattern", "Orchestrate specialist agents", "Decompose a complex problem", "Design to value and service targets"),
      domain(2, "Models, prompting, and context engineering", 13, "Choose models by trade-off", "Design prompts and guardrails", "Apply prompting techniques", "Optimize context and tokens", "Reuse prompts and Skills"),
      domain(3, "Integration", 19, "Limit the capability surface", "Design authentication and authorization", "Trade accuracy against latency", "Monitor integrations at scale", "Chunk and index sources", "Match retrieval to queries", "Choose an integration protocol", "Discover capabilities progressively"),
      domain(4, "Evaluation, testing, and optimization", 16, "Define quality and operational metrics", "Build mixed-method evaluation sets", "Run controlled comparisons", "Isolate system failures", "Optimize cost and latency", "Monitor live performance"),
      domain(5, "Governance, safety, and risk management", 14, "Implement guardrails", "Identify failure modes", "Design human review", "Translate compliance obligations into controls", "Check fairness and communicate limitations"),
      domain(6, "Stakeholders and system lifecycle", 14, "Discover stakeholder requirements", "Explain decisions and trade-offs", "Agree on feedback loops and service targets", "Document the architecture and implementation", "Plan handoff, monitoring, and iteration"),
      domain(7, "Developer productivity and enablement", 7, "Configure tools and environments", "Improve team development workflows", "Support operational diagnosis"),
    ],
  },
];

export function trackTitle(track: Track) {
  return `Claude Certified ${track.role} – ${track.level}`;
}

export function examRegistration(track: Track) {
  return `${academy}/claude-certified-${track.id}-certification`;
}

export function trackHref(track: Track) {
  return `/certifications/${track.id}`;
}

export function cityAssignmentHref(track: Track) {
  return `/?pathway=${track.id}`;
}
