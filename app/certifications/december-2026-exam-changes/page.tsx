import Link from "next/link";
import { AcademyHeader, ExternalLink } from "../../../components/academy/chrome";
import { SeoBreadcrumbs } from "../../../components/academy/seo-breadcrumbs";
import { examMinutes, trackHref, trackPracticeHref, tracks } from "../../../lib/claude/blueprints";
import { decemberBlueprint, decemberVersion } from "../../../lib/claude/december-blueprints";
import { guidesReviewed, publicGuides } from "../../../lib/claude/public-guides";
import { certificationCatalog, decemberGuidePage, methodologyPage, pageMetadata, siteName } from "../../../lib/seo";

export const metadata = pageMetadata(decemberGuidePage);

export default function DecemberExamChanges() {
  const revisions = tracks.flatMap((track) => {
    const revised = decemberBlueprint(track);
    return revised ? [{ track, revised }] : [];
  });
  return <div className="academy-shell">
    <AcademyHeader />
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-editorial academy-article">
      <SeoBreadcrumbs entries={[{ name: siteName, path: "/" }, { name: "Claude exam practice", path: certificationCatalog.path }, { name: "December exam changes", path: decemberGuidePage.path }]} />
      <header className="academy-workspace-title">
        <h1>{decemberGuidePage.title}</h1>
        <p>Use the guide for your exam date. Anthropic published revised guides for Associate Foundations, Developer Foundations, and Architect Professional.</p>
        <p className="academy-code">Sources reviewed <time dateTime={guidesReviewed}>November 21, 2026</time></p>
      </header>
      <section className="academy-panel" aria-labelledby="format-comparison">
        <h2 id="format-comparison">Format before and from December 7</h2>
        <p>Each revised exam has {examMinutes} minutes for 70 questions, including 60 scored and 10 unscored questions.</p>
        <table className="academy-editorial-table">
          <thead><tr><th scope="col">Certification</th><th scope="col">Before Dec 7</th><th scope="col">Dec 7 or later</th></tr></thead>
          <tbody>{revisions.map(({ track, revised }) => <tr key={track.id}>
            <th scope="row"><a href={`#${track.id}`}>{track.role} {track.level}</a></th><td>{track.count} items</td><td>{revised.count} items</td>
          </tr>)}</tbody>
        </table>
        <p><Link href="/certifications/architect-foundations">Architect Foundations</Link> follows its November guide, with 60 exam items and the same five domains in CertCity. <Link href="/certifications/developer-professional">Developer Professional</Link> launched with guide v1.0 in November 2026 and has no December revision.</p>
      </section>
      {revisions.map(({ track, revised }) => <section className="academy-panel" key={track.id} id={track.id} aria-labelledby={`${track.id}-title`}>
        <h2 id={`${track.id}-title`}>{track.role} {track.level}</h2>
        <p>{publicGuides[track.id].revision}</p>
        <details className="academy-guide-edition">
          <summary>Compare published domain weights</summary>
          <div className="academy-guide-comparison">
            {[{ label: "Before December 7", domains: track.domains }, { label: "December 7 or later", domains: revised.domains }].map(({ label, domains }) => <div key={label}>
              <h3>{label}</h3>
              <ul className="academy-editorial-list">{domains.map(({ title, weight }) => <li key={title}>{title} · {weight}%</li>)}</ul>
            </div>)}
          </div>
        </details>
        <div className="academy-actions">
          <ExternalLink href={track.guide}>Official earlier guide</ExternalLink>
          <ExternalLink href={revised.guide}>Official December guide</ExternalLink>
          <Link href={trackHref(track)}>Study guide</Link>
          <a className="academy-button secondary" href={`${trackPracticeHref(track)}&guide=${decemberVersion}`}>Practice with the December guide</a>
        </div>
      </section>)}
      <section className="academy-panel">
        <h2>Plan your practice</h2>
        <ol className="academy-editorial-list">
          <li>Confirm your test date and open the applicable official guide.</li>
          <li>Use the <Link href={methodologyPage.path}>objective map</Link> to find a city exercise for each skill you want to review.</li>
          <li>Work through guided practice and try an independent scenario. Finish with a timed practice exam for the same guide.</li>
        </ol>
      </section>
    </main>
  </div>;
}
