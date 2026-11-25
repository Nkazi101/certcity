import type { Domain, Track } from "../blueprints";

/**
 * Claude Certified Developer – Professional (CCDV-P), exam guide v1.0, effective November 2026.
 * Domains, weights and skill statements follow the guide exactly (research/ccdv-p-exam-guide.md, guide p. 3–8).
 * Listed in `tracks` (blueprints.ts). Single guide version: no December revision applies to this exam.
 */
export const developerProfessionalLabel = "Exam guide v1.0 · November 2026";

/** Scored items per domain on a 60-scored-item form (largest-remainder rounding of weight × 60). */
export const developerProfessionalScores = [10, 12, 7, 6, 7, 5, 7, 6] as const;
export const developerProfessionalUnscored = 10;

const guideRoot = "https://cc.sj-cdn.net/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public";
const academy = "https://anthropic-partners.skilljar.com";

function domain(id: number, title: string, weight: number, ...objectives: string[]): Domain {
  return { id, title, weight, objectives };
}

export const developerProfessionalTrack: Track = {
  id: "developer-professional", provider: "anthropic", code: "CCDV-P", role: "Developer", level: "Professional",
  description: "For engineers who run Claude applications and agents in production: tracing, evaluation gates, fallbacks, cost and guardrails. The first mission is the Busch Stadium guest assistant, which stopped answering fans during a game-day rush.",
  audience: "code",
  count: 70, fee: 175, place: "busch-stadium", assignment: "Repair the game-day fallback policy",
  guide: `${guideRoot}/1794947325/Claude_Certified_Developer-Professional_Exam_Guide.pdf`,
  prep: `${academy}/path/claude-certified-developer-professional`,
  domains: [
    domain(1, "Advanced Agent Architecture and Orchestration", 17,
      "Multi-Agent Orchestration", "Durable Execution and State Management", "Architecture Selection at Scale", "Context and Memory Architecture"),
    domain(2, "Production Integration, Reliability, and Knowledge Grounding", 20,
      "Reliability Engineering for Claude Services", "Scale and Throughput Management", "Production MCP and Change Management", "Retrieval and Knowledge Grounding at Scale"),
    domain(3, "Observability and Production Monitoring", 12,
      "Telemetry and Instrumentation", "Production Monitoring and Alerting", "Trace Analysis at Scale"),
    domain(4, "Advanced Debugging and Incident Response", 10,
      "Complex Failure Diagnosis", "Incident Response and Learning Loops"),
    domain(5, "Evaluation Engineering and Quality Assurance", 12,
      "Evaluation System Design", "LLM-as-Judge Engineering", "Online Quality Measurement"),
    domain(6, "Cost and Latency Optimization at Scale", 8,
      "Cost Architecture at Scale", "Latency Engineering"),
    domain(7, "Runtime Guardrails and Production Security", 11,
      "Runtime Guardrail Systems", "Threat Defense and Adversarial Testing for Agentic Systems", "Identity, Secrets, and Audit at Scale"),
    domain(8, "Agent Fleet Operations for Software Delivery", 10,
      "Parallel Agent Orchestration for Engineering Work", "Verification and AI Code Review Operations", "Unattended and Event-Driven Agent Operations", "Organization-Wide Coding Agent Configuration"),
  ],
};
