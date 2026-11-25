import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cityAssignmentHref, examMinutes, examRegistration, trackHref, trackPracticeHref, tracks, trackTitle } from "../../lib/claude/blueprints";
import type { Track } from "../../lib/claude/blueprints";
import { guideEditions, publicGuides } from "../../lib/claude/public-guides";
import { missionsFor } from "../../lib/claude/pathway";
import { decemberGuidePage, dispatchCasePage, methodologyPage } from "../../lib/seo";
import { studyHref } from "../../lib/claude/lessons/paths";
import { ExternalLink } from "./chrome";
import { introductions } from "../../lib/city-dialogue";
import { PublicSample } from "./public-sample";
import styles from "./public-track-guide.module.css";

export function PublicTrackGuide({ track, breadcrumbs }: { track: Track; breadcrumbs: ReactNode }) {
  const guide = publicGuides[track.id];
  const editions = guideEditions(track);
  const starter = missionsFor(track.id).find(({ kind }) => kind === "original" || kind === "dispatch");
  const caseHref = starter ? `${cityAssignmentHref(track)}&mission=${starter.id}` : cityAssignmentHref(track);
  const firstCase = track.id === "architect-foundations"
    ? "Ticket T-17 timed out, but the customer was told the order didn’t exist. Find out why and change the rule."
    : track.id === "developer-professional"
      ? "During the first inning, Busch Stadium’s guest assistant showed fans error pages and cut-off directions while retrying every failure. Rewrite its reliability policy."
      : introductions[track.id].greeting;
  return <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-editorial">
    {breadcrumbs}
    <header className={`academy-workspace-title ${styles.hero}`} data-track={track.id}>
      <div className="academy-title-label"><span className="academy-code">{track.code}</span></div>
      <h1>{trackTitle(track)}</h1>
      <p>{guide.audience}</p>
      <div className={styles.actions}>
        <Link href={caseHref} className="academy-button primary" prefetch={false}>Start the first mission <ArrowRight size={17} aria-hidden="true" /></Link>
        <Link href={studyHref(track)} className={styles.textLink}>Study guide</Link>
        <a href={trackPracticeHref(track)} className={styles.textLink}>Practice exams</a>
      </div>
      <noscript><p>The practice workspace requires JavaScript. The guide and sample explanations are available below.</p></noscript>
    </header>
    <div className="academy-editorial-layout">
      <div className="academy-main-column">
        <section className="academy-panel" aria-labelledby="study-plan">
          <h2 id="study-plan" tabIndex={-1}>What to study</h2>
          <ol className="academy-editorial-list">{guide.study.map((step) => <li key={step}>{step}</li>)}</ol>
          <p>Start with a <Link href={caseHref} prefetch={false}>case in the city</Link>. When a skill trips you up, its lesson opens from the case. The <Link href={studyHref(track)}>study guide</Link> has one lesson per exam objective if you’d rather read ahead. Finish with the hands-on lab, where your written answers are checked against test cases, and timed practice exams.</p>
        </section>
        <section className="academy-panel" aria-labelledby="exam-domains">
          <h2 id="exam-domains" tabIndex={-1}>Exam domains and weights</h2>
          <p>Use the official exam guide for your scheduled date. The published time limit is {examMinutes} minutes.</p>
          {editions.map((edition) => <details className={styles.edition} key={edition.version} open={editions.length === 1}>
            <summary><span>{edition.label}</span><span>{edition.count} questions</span></summary>
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
          <h2 id="sample-questions" tabIndex={-1}>Original sample questions</h2>
          <p>Choose an answer and check your reasoning. These samples don’t count toward your practice results.</p>
          {guide.samples.map((sample) => <PublicSample key={sample.question} {...sample} />)}
          <a href={`${trackPracticeHref(track)}#rehearsal`} className="academy-button secondary">Take a practice exam</a>
        </section>
      </div>
      <aside className="academy-sidebar">
        <section className="academy-panel">
          <h2>Your first mission: {track.assignment.toLowerCase()}</h2>
          <p>{firstCase}</p>
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
