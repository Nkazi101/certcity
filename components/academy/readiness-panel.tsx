import { ArrowRight } from "lucide-react";
import { dueLabel } from "./session";
import { rehearsalTarget } from "../../lib/claude/readiness";
import type { benchmarkEvidence } from "../../lib/claude/readiness";
import type { Domain } from "../../lib/claude/blueprints";

type DomainProgress = Pick<Domain, "id" | "title"> & {
  practiced: number; objectives: number; checked: number | null;
  practical: number; practicalTotal: number; delayed: number; delayedTotal: number;
};

export function ReadinessPanel({ evidence, domains, now, revised, onDomain }: {
  evidence: ReturnType<typeof benchmarkEvidence>;
  domains: DomainProgress[];
  now: number;
  revised: boolean;
  onDomain: (id: number) => void;
}) {
  const { timed, repeated, practical, met } = evidence;
  const timedResult = timed ?? repeated;
  function caseResult(passed: typeof practical.capstone, first: typeof practical.firstCapstone, available: string) {
    if (!first) return available;
    if (first.passed) return "Passed on first submission";
    const initial = `${first.results.filter(({ passed }) => passed).length}/${first.results.length} checks on first submission`;
    return `${passed ? "Passed after revision" : "Needs revision"} · ${initial}`;
  }
  return <section className="academy-panel academy-readiness" id="readiness" aria-labelledby="readiness-title">
    <div className="academy-readiness-header">
      <h2 id="readiness-title">Exam preparation</h2>
      <strong data-met={met}>{met ? "Practice benchmark met" : "Practice benchmark in progress"}</strong>
    </div>
    <p>CertCity’s provisional target is {rehearsalTarget.overall}% overall and {rehearsalTarget.domain}% in every domain (rounded) on a fresh timed form, plus successful independent and seven-day practical cases. This benchmark has yet to be validated against exam results.</p>
    <dl className="academy-evidence-stages">
      <div><dt>Fresh timed form</dt><dd>{timed ? `${timed.correct}/${timed.total} correct · ${timed.met ? "Target met" : "Below target"}` : repeated ? "Fresh form needed" : "Available"}</dd></div>
      <div><dt>Independent case</dt><dd>{caseResult(practical.capstone, practical.firstCapstone, "Available")}</dd></div>
      <div><dt>Seven-day case</dt><dd>{caseResult(practical.transfer, practical.firstTransfer, practical.transferDue === null ? "Opens after passing the independent case" : practical.transferDue > now ? `Opens ${dueLabel(practical.transferDue)}` : "Available")}</dd></div>
    </dl>
    {timedResult && !timedResult.fresh && <p>Your last result comes from a form with prior or untracked exposure. It can guide review.</p>}
    <div className="academy-domain-evidence" aria-label="Evidence by domain">
      {domains.map(({ id, title, practiced, objectives, checked, practical: applied, practicalTotal, delayed, delayedTotal }) => {
        const result = timedResult?.domains.find((domain) => domain.id === id);
        const underTarget = result && Math.round(100 * result.correct / result.total) < rehearsalTarget.domain;
        return <div className="academy-domain-evidence-row" key={id}>
          <div className="academy-domain-evidence-title"><strong>{title}</strong><button type="button" className="academy-button text" aria-label={`Review ${title}`} onClick={() => onDomain(id)}>Review <ArrowRight size={15} aria-hidden="true" /></button></div>
          <div className="academy-domain-evidence-practice">
            <progress value={practiced} max={objectives} aria-label={`${title} ${revised ? "guide practice" : "city application"}`} />
            <span>{practiced}/{objectives} {revised ? "guided" : "applied"}{checked !== null && ` · ${checked} first-seen city checks correct`}</span>
          </div>
          <p className="academy-domain-evidence-figures">
            <span data-low={underTarget || undefined}>{result ? `${result.correct}/${result.total} timed${underTarget ? " · Review next" : ""}` : "Timed result pending"}</span>
            {practical.firstCapstone && practicalTotal > 0 && <span>{applied}/{practicalTotal} independent case objectives</span>}
            {practical.firstTransfer && delayedTotal > 0 && <span>{delayed}/{delayedTotal} seven-day case objectives</span>}
          </p>
        </div>;
      })}
    </div>
  </section>;
}
