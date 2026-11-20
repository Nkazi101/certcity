import type { Domain, Track, TrackId } from "./blueprints";

export const decemberVersion = "december-2026";
export const decemberLabel = "Exam guide v1.1 · December 7, 2026";
export type ExamVersion = "july-2026" | typeof decemberVersion;
type UpdatedTrack = Exclude<TrackId, "architect-foundations">;

const guideRoot = "https://cc.sj-cdn.net/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public";
const domain = (id: number, title: string, weight: number, ...objectives: string[]): Domain => ({ id, title, weight, objectives });

export const decemberBlueprints: Record<UpdatedTrack, { guide: string; count: number; scores: readonly number[]; domains: readonly Domain[] }> = {
  "associate-foundations": {
    guide: `${guideRoot}/1794946609/Claude_Certified_Associate_-_Foundations_Exam_Guide_Updated_Dec_7.pdf`,
    count: 70, scores: [9, 12, 9, 11, 9, 10],
    domains: [
      domain(1, "Task Definition and Prompting", 15, "Construct a task prompt", "Decompose and sequence work", "Diagnose and revise prompts"),
      domain(2, "Output Evaluation and Quality Control", 20, "Evaluate output fitness", "Detect and verify unsupported content", "Choose review depth and escalation", "Adapt output and select formats"),
      domain(3, "Capability, Model, and Context Selection", 15, "Choose Claude capabilities", "Select model tier and effort", "Manage context and memory"),
      domain(4, "Workflow Design and Integration", 18, "Complete a deliverable end to end", "Delegate and redesign steps", "Design repeatable workflows", "Communicate capability and oversight"),
      domain(5, "Configuration and Knowledge Management", 15, "Configure a Project", "Manage knowledge and connectors", "Design persistent instructions", "Diagnose configuration degradation"),
      domain(6, "Responsible Use, Data Protection, and Governance", 17, "Judge use-case appropriateness", "Protect data in practice", "Apply policy, ethics and diligence"),
    ],
  },
  "developer-foundations": {
    guide: `${guideRoot}/1794946771/Claude_Certified_Developer_-_Foundations_Exam_Guide_Updated_Dec_7.pdf`,
    count: 70, scores: [10, 12, 5, 6, 7, 9, 5, 6],
    domains: [
      domain(1, "Agents and Workflows", 17, "Select agent architecture and runtime", "Construct agents and hooks", "Diagnose agent patterns"),
      domain(2, "Applications and Integration", 20, "Apply Messages API mechanics", "Evaluate application and surface boundaries", "Integrate configurations into delivery", "Build resilient integrations"),
      domain(3, "Claude Code", 8, "Operate Claude Code", "Customize and distribute extensions"),
      domain(4, "Eval, Testing, and Debugging", 10, "Design evaluations", "Diagnose failure modes"),
      domain(5, "Model Selection and Optimization", 12, "Apply generation mechanics and model options", "Select a tier and plan releases", "Diagnose and optimize cost"),
      domain(6, "Prompt and Context Engineering", 15, "Manage long-running context", "Revise prompts", "Use structured output and defensive parsing", "Ground answers and cite sources"),
      domain(7, "Security and Safety", 8, "Defend against untrusted instructions", "Enforce guardrails and least privilege", "Handle credentials"),
      domain(8, "Tools and MCP", 10, "Design tools and response contracts", "Develop and integrate MCP servers", "Select a capability mechanism"),
    ],
  },
  "architect-professional": {
    guide: `${guideRoot}/1794946420/Claude_Certified_Architect_-_Professional_Exam_Guide_Updated_Dec_7.pdf`,
    count: 70, scores: [11, 8, 12, 10, 10, 4, 5],
    domains: [
      domain(1, "Solution Design and Architecture", 18, "Delegate work between Claude and people", "Evaluate end-to-end architectures", "Select an architectural pattern", "Decompose orchestrator and subagent work", "Choose by business value", "Select deployment surface and runtime"),
      domain(2, "Claude Models, Prompting, and Context Engineering", 13, "Select a model tier", "Diagnose and revise system prompts", "Choose prompting techniques", "Compose context within a token budget", "Place cache breakpoints and package reuse", "Choose reasoning effort and context lifecycle"),
      domain(3, "Integration", 21, "Configure least-privilege tools", "Evaluate authentication and authorization", "Relieve the binding performance constraint", "Identify instrumentation gaps", "Select a retrieval architecture", "Select a connection mechanism", "Apply progressive discovery", "Specify reliability controls"),
      domain(4, "Evaluation, Testing, and Optimization", 17, "Find evaluation coverage gaps", "Derive evaluations from business processes", "Design and calibrate model judges", "Design experiments", "Isolate root causes from traces", "Optimize cost and latency", "Plan model-version migration"),
      domain(5, "Governance, Safety, and Risk Management", 16, "Place guardrails", "Control untrusted instruction risk", "Rank production risks", "Place human checkpoints", "Design compliance controls", "Identify and mitigate bias"),
      domain(6, "Stakeholder Communication and Lifecycle Management", 7, "Identify unsupported SLA commitments", "Evaluate architecture decision records", "Complete operational handoff"),
      domain(7, "Developer Productivity and Operational Enablement", 8, "Package and distribute Claude Code workflows", "Configure Agent SDK and Claude Code", "Retain accountability for generated code"),
    ],
  },
};

export function decemberBlueprint(track: Track) {
  return track.id === "architect-foundations" ? undefined : decemberBlueprints[track.id];
}

export function rehearsalBlueprint(track: Track, version?: ExamVersion) {
  return version === decemberVersion ? decemberBlueprint(track) ?? track : track;
}
