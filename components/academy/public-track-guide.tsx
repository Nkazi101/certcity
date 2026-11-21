import Link from "next/link";
import type { ReactNode } from "react";
import { cityAssignmentHref, examMinutes, examRegistration, trackHref, trackPracticeHref, tracks, trackTitle } from "../../lib/claude/blueprints";
import type { Track } from "../../lib/claude/blueprints";
import { guideEditions, publicGuides } from "../../lib/claude/public-guides";
import { decemberGuidePage, dispatchCasePage, methodologyPage } from "../../lib/seo";
import { ExternalLink, trackIcons } from "./chrome";

export function PublicTrackGuide({ track, breadcrumbs }: { track: Track; breadcrumbs: ReactNode }) {
  const guide = publicGuides[track.id];
  const editions = guideEditions(track);
  const Icon = trackIcons[track.id];
  return <main className="academy-width academy-workspace academy-editorial">
    {breadcrumbs}
    <header className="academy-workspace-title">
      <div className="academy-title-label"><span className="academy-track-icon" data-track={track.id}><Icon size={22} aria-hidden="true" /></span><span className="academy-code">{track.code}</span></div>
      <h1>{trackTitle(track)} Exam Practice</h1>
      <p>{guide.audience}</p>
      <div className="academy-actions">
        <a href={trackPracticeHref(track)} className="academy-button primary">Open practice workspace</a>
        <a href="#sample-questions" className="academy-button secondary">Try sample questions</a>
      </div>
      <noscript><p>The practice workspace requires JavaScript. The guide and sample explanations are available below.</p></noscript>
    </header>
    <div className="academy-editorial-layout">
      <div className="academy-main-column">
        <section className="academy-panel" aria-labelledby="study-plan">
          <h2 id="study-plan">What to study</h2>
          <ol className="academy-editorial-list">{guide.study.map((step) => <li key={step}>{step}</li>)}</ol>
          <p>Apply those skills in a city assignment, then use independent cases and timed exam rehearsals in the practice workspace.</p>
        </section>
        <section className="academy-panel" aria-labelledby="exam-domains">
          <h2 id="exam-domains">Exam domains and weights</h2>
          <p>Use the official exam guide for your scheduled date. The published time limit is {examMinutes} minutes.</p>
          {editions.map((edition) => <details className="academy-guide-edition" key={edition.version} open={editions.length === 1 || edition.version === "december-2026"}>
            <summary>{edition.label} · {edition.count} questions</summary>
            <table className="academy-editorial-table">
              <thead><tr><th scope="col">Domain</th><th scope="col">Weight</th></tr></thead>
              <tbody>{edition.domains.map((domain) => <tr key={domain.id}><td>{domain.title}</td><td>{domain.weight}%</td></tr>)}</tbody>
            </table>
            <div className="academy-actions">
              <ExternalLink href={edition.guide}>Official guide PDF</ExternalLink>
              <a className="academy-button secondary" href={`${trackPracticeHref(track)}&guide=${edition.version}`}>Practice with this guide</a>
            </div>
          </details>)}
          {editions.length > 1 && <p><Link href={decemberGuidePage.path}>See what changed on December 7</Link>.</p>}
        </section>
        <section className="academy-panel" aria-labelledby="sample-questions">
          <h2 id="sample-questions">Original sample questions</h2>
          <p>Choose an answer, then open the explanation. These samples are separate from CertCity’s scored practice bank.</p>
          {guide.samples.map(({ question, options, answer, explanation }) => <div className="academy-guide-sample" key={question}>
            <h3>{question}</h3>
            <ol type="A" className="academy-editorial-list">{options.map((option) => <li key={option}>{option}</li>)}</ol>
            <details><summary>Show answer and explanation</summary><p><strong>{options[answer]}</strong> {explanation}</p></details>
          </div>)}
          <p><a href={`${trackPracticeHref(track)}#rehearsal`}>Open timed exam rehearsals</a></p>
        </section>
      </div>
      <aside className="academy-sidebar">
        <section className="academy-panel">
          <h2>Practice in the city</h2>
          <p>{track.assignment}. Inspect the case evidence, make a decision, and replay the outcome.</p>
          <Link className="academy-button secondary" href={cityAssignmentHref(track)} prefetch={false}>Enter the city pathway</Link>
          {track.id === "architect-foundations" && <p><Link href={dispatchCasePage.path}>Read the City Dispatch walkthrough</Link></p>}
        </section>
        <section className="academy-panel academy-official">
          <h2>Official exam resources</h2>
          <p>CertCity provides independent practice. The official exam is available through the Claude Partner Network.</p>
          <ExternalLink href={track.prep}>Anthropic preparation courses</ExternalLink>
          <ExternalLink href={examRegistration(track)}>Official exam registration</ExternalLink>
          <Link href={`${methodologyPage.path}#${track.id}`}>See the objective map and methodology</Link>
        </section>
        <nav className="academy-panel academy-related" aria-label="Other Claude study paths">
          <h2>Other Claude study paths</h2>
          <ul>{tracks.filter(({ id }) => id !== track.id).map((other) => <li key={other.id}>
            <Link href={trackHref(other)} prefetch={false}>{other.role} {other.level}</Link>
          </li>)}</ul>
        </nav>
      </aside>
    </div>
  </main>;
}
