import Link from "next/link";
import { AcademyHeader, ExternalLink } from "../../../components/academy/chrome";
import { SeoBreadcrumbs } from "../../../components/academy/seo-breadcrumbs";
import { cityAssignmentHref, trackHref, tracks, trackTitle } from "../../../lib/claude/blueprints";
import { objectiveCoverage } from "../../../lib/claude/curriculum";
import { guideEditions, guidesReviewed } from "../../../lib/claude/public-guides";
import { certificationCatalog, dispatchCasePage, methodologyPage, pageMetadata, siteName } from "../../../lib/seo";

export const metadata = pageMetadata(methodologyPage);

export default function PracticeMethodology() {
  return <div className="academy-shell">
    <AcademyHeader />
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-editorial academy-article">
      <SeoBreadcrumbs entries={[{ name: siteName, path: "/" }, { name: "Claude exam practice", path: certificationCatalog.path }, { name: "Objective map and methodology", path: methodologyPage.path }]} />
      <header className="academy-workspace-title">
        <h1>{methodologyPage.title}</h1>
        <p>Find the CertCity simulation that practices a published exam skill, then use the official guide to check the scope of the objective.</p>
        <p className="academy-code">Guide selection reviewed <time dateTime={guidesReviewed}>November 21, 2026</time></p>
      </header>
      <section className="academy-panel">
        <h2>How CertCity develops practice</h2>
        <ol className="academy-editorial-list">
          <li><strong>Start with the official guide.</strong> CertCity assigns a reference code and paraphrases each skill below. The exam guide determines the scope and domain weights.</li>
          <li><strong>Build a mission around a decision.</strong> Each mission asks the learner to inspect evidence, choose a policy or work product, and observe the outcome. The <Link href={dispatchCasePage.path}>City Dispatch walkthrough</Link> shows the evidence, decision, and simulated results.</li>
          <li><strong>Write original practice and explanations.</strong> Guided items explain why each decision fits the scenario. Independent scenarios and timed forms use separate prompts, so they test reasoning on questions you haven’t seen.</li>
          <li><strong>Check the published mapping.</strong> Automated checks validate objective coverage, item identifiers, answer keys, form selection, and saved assessment snapshots in the repository.</li>
        </ol>
        <p>Coverage means a CertCity exercise samples a skill from the published guide. The practice benchmark is provisional. CertCity has yet to validate it against independent learner exam outcomes.</p>
      </section>
      <nav className="academy-panel academy-related" aria-label="Jump to a pathway">
        <h2>Share an objective map</h2>
        <ul>{tracks.map((track) => <li key={track.id}><a href={`#${track.id}`}>{track.role} {track.level}</a></li>)}</ul>
      </nav>
      {tracks.map((track) => <section className="academy-panel" key={track.id} id={track.id} aria-labelledby={`${track.id}-title`}>
        <h2 id={`${track.id}-title`}>{trackTitle(track)}</h2>
        <p><Link href={trackHref(track)}>Open the study guide and sample questions</Link>.</p>
        {guideEditions(track).map((edition) => <details className="academy-guide-edition" key={edition.version}>
          <summary>{edition.label}</summary>
          <ExternalLink href={edition.guide}>Official exam guide</ExternalLink>
          {objectiveCoverage(track, edition.version).map(({ id, title, weight, skills }) => <div className="academy-mapped-domain" key={id}>
            <h3>{title} · {weight}%</h3>
            <table className="academy-editorial-table">
              <thead><tr><th scope="col">CertCity skill</th><th scope="col">Mapped city practice</th></tr></thead>
              <tbody>{skills.map((skill) => <tr key={skill.id}>
                <th scope="row">{skill.id} · {skill.title}</th>
                <td>{skill.missions.length ? <ul>{skill.missions.map((mission) => <li key={mission.id}>
                  <Link href={`${cityAssignmentHref(track)}&mission=${mission.id}&guide=${edition.version}${edition.version === "december-2026" ? `&objective=${skill.id}` : ""}`} prefetch={false}>{mission.title}</Link>
                </li>)}</ul> : "See pathway practice"}</td>
              </tr>)}</tbody>
            </table>
          </div>)}
        </details>)}
      </section>)}
    </main>
  </div>;
}
