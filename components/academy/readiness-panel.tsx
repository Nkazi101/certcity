import { ArrowRight } from "lucide-react";
import { dueLabel } from "./session";
import { rehearsalTarget } from "../../lib/claude/readiness";
import type { benchmarkEvidence } from "../../lib/claude/benchmark";
import type { Domain } from "../../lib/claude/blueprints";
import { domainSampleMinimum } from "../../lib/claude/assessment/forms";

type DomainProgress = Pick<Domain, "id" | "title"> & {
  practiced: number; objectives: number; checked: number | null;
  practical: number; practicalTotal: number; delayed: number; delayedTotal: number;
};

export function ReadinessPanel({ evidence, domains, now, revised, onDomain, availableReassessments, reassessmentDisabled, onReassess }: {
  evidence: ReturnType<typeof benchmarkEvidence>;
  domains: DomainProgress[];
  now: number;
  revised: boolean;
  onDomain: (id: number) => void;
  availableReassessments: ReadonlySet<number>;
  reassessmentDisabled: boolean;
  onReassess: (id: number) => void;
}) {
  const { timed, repeated, practical, met, cram, confirmation, city } = evidence;
  const missingAreas = city?.domains.filter(({ applied }) => applied === 0).map(({ title }) => title) ?? [];
  const timedResult = timed ?? repeated;
  function caseResult(passed: typeof practical.capstone, first: typeof practical.firstCapstone, available: string) {
    if (!first) return available;
    if (first.passed) return "Passed on the first try";
    const initial = `${first.results.filter(({ passed }) => passed).length}/${first.results.length} checks passed on the first try`;
    return `${passed ? "Passed after revision" : "Needs revision"} (${initial})`;
  }
  return <section className="academy-panel academy-readiness" id="readiness" tabIndex={-1} aria-labelledby="readiness-title">
    <div className="academy-readiness-header">
      <h2 id="readiness-title">Are you ready?</h2>
      <strong data-met={met}>{met ? "Ready by our measure" : "Not yet"}</strong>
    </div>
    <p>{cram
      ? `Exam in under 2 weeks: complete a city mission in each exam area, score ${rehearsalTarget.overall}% overall (${rehearsalTarget.domain}% in each domain) on two practice exams you haven’t seen, and pass the hands-on lab.`
      : `To be ready: complete a city mission in each exam area on your own, score ${rehearsalTarget.overall}% overall (${rehearsalTarget.domain}% in each domain) on a practice exam you haven’t seen, pass the hands-on lab, then pass the 7-day review lab.`}</p>
    <dl className="academy-evidence-stages">
      {city && city.domains.length > 0 && <div><dt><a href="#city-cases">Missions in the city</a></dt><dd>{city.met
        ? `Applied on your own in all ${city.domains.length} exam areas the city covers.`
        : `${city.applied} of ${city.domains.length} exam areas applied on your own. Still to do: ${missingAreas.join(", ")}.`}</dd></div>}
      <div><dt><a href="#rehearsal">Practice exam you haven’t seen</a></dt><dd>{timed ? `${timed.correct}/${timed.total} correct. ${timed.overallMet ? "Target met." : `Below the ${rehearsalTarget.overall}% target.`}` : repeated ? "Take one you haven’t seen" : "Available"}</dd></div>
      <div><dt><a href="#track-practicals">Hands-on lab</a></dt><dd>{caseResult(practical.capstone, practical.firstCapstone, "Available")}</dd></div>
      {cram && <div><dt><a href="#rehearsal">Second practice exam you haven’t seen</a></dt><dd>{confirmation ? `${confirmation.correct}/${confirmation.total} correct. Target met.` : "Needed when your exam is under 2 weeks away"}</dd></div>}
      <div><dt><a href="#track-practicals">7-day review lab{cram && " (optional)"}</a></dt><dd>{caseResult(practical.transfer, practical.firstTransfer, practical.transferDue === null ? "Opens 7 days after you pass the hands-on lab" : practical.transferDue > now ? `Opens ${dueLabel(practical.transferDue)}` : "Available")}</dd></div>
    </dl>
    <details className="academy-review-meta">
      <summary>How CertCity measures preparation</summary>
      <p>The target is {rehearsalTarget.overall}% overall and at least {rehearsalTarget.domain}% in each domain with enough questions. After you review a weak domain, a domain retest with new questions can add to its count. The target is provisional: we haven’t compared it with real exam results yet.</p>
    </details>
    {timedResult && !timedResult.fresh && <p>Your last result is from a practice exam you had already seen, so it can guide review but doesn’t count toward ready.</p>}
    <h3 className="academy-domain-evidence-heading" id="domain-evidence-title">Progress by domain</h3>
    <div className="academy-domain-evidence" role="group" aria-labelledby="domain-evidence-title">
      {domains.map(({ id, title, practiced, objectives, checked, practical: applied, practicalTotal, delayed, delayedTotal }) => {
        const result = timedResult?.domains.find((domain) => domain.id === id);
        const underTarget = result?.status === "below";
        const needsEvidence = result?.status === "insufficient";
        return <div className="academy-domain-evidence-row" key={id}>
          <div className="academy-domain-evidence-title"><strong>{title}</strong><button type="button" className="academy-button text" aria-label={`Review ${title}`} onClick={() => onDomain(id)}>Review <ArrowRight size={15} aria-hidden="true" /></button></div>
          <div className="academy-domain-evidence-practice">
            <progress value={practiced} max={objectives} aria-label={`${title}: objectives practiced`} />
            <span>{practiced}/{objectives} practiced{checked !== null && `, ${checked} right first time`}</span>
          </div>
          <p className="academy-domain-evidence-figures">
            <span data-low={underTarget || undefined}>{result ? `${result.correct}/${result.total} on the practice exam` : "No practice exam yet"}</span>
            {needsEvidence && <span>Not enough questions yet ({result.sampleTotal} of {domainSampleMinimum})</span>}
            {underTarget && <span>Review this domain</span>}
            {result?.reassessed && <span>{result.sampleCorrect}/{result.sampleTotal} including the domain retest</span>}
            {practical.firstCapstone && practicalTotal > 0 && <span>{applied}/{practicalTotal} hands-on lab objectives</span>}
            {practical.firstTransfer && delayedTotal > 0 && <span>{delayed}/{delayedTotal} 7-day review lab objectives</span>}
          </p>
          {(needsEvidence || underTarget) && timedResult?.fresh && (availableReassessments.has(id)
            ? <button type="button" className="academy-button secondary" disabled={reassessmentDisabled}
                aria-label={`Retest ${title}`} onClick={() => onReassess(id)}>Retest this domain <ArrowRight size={15} aria-hidden="true" /></button>
            : <p className="academy-domain-evidence-figures">You’ve used all the new retest questions for this domain.</p>)}
        </div>;
      })}
    </div>
  </section>;
}
