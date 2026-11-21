import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { AcademyHeader, ExamAccess, trackIcons } from "../../components/academy/chrome";
import { AcademyCatalogProgress } from "../../components/academy/catalog-progress";
import { StructuredData } from "../../components/structured-data";
import { cityAssignmentHref, trackHref, tracks, trackTitle } from "../../lib/claude/blueprints";
import { certificationCatalog, decemberGuidePage, dispatchCasePage, methodologyPage, pageMetadata, siteUrl } from "../../lib/seo";

export const metadata = pageMetadata(certificationCatalog);

export default function Certifications() {
  return (
    <div className="academy-shell">
      <StructuredData data={{
        "@type": "CollectionPage",
        url: siteUrl(certificationCatalog.path),
        name: certificationCatalog.title,
        description: certificationCatalog.description,
        inLanguage: "en",
        mainEntity: {
          "@type": "ItemList",
          itemListElement: tracks.map((track, index) => ({
            "@type": "ListItem", position: index + 1, name: trackTitle(track), url: siteUrl(trackHref(track)),
          })),
        },
      }} />
      <AcademyHeader />
      <main className="academy-width academy-catalog">
        <header className="academy-workspace-title">
          <h1>{certificationCatalog.title}</h1>
          <p>{certificationCatalog.description}</p>
        </header>
        <section aria-labelledby="pathway-title">
          <div className="academy-section-heading">
            <h2 id="pathway-title">Certification pathways</h2>
          </div>
          <div className="academy-cards">
            {tracks.map((track) => {
              const Icon = trackIcons[track.id];
              return (
                <article key={track.id} className="academy-track-card" data-track={track.id}>
                  <div className="academy-card-top">
                    <span className="academy-track-icon"><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
                    <span className="academy-code">{track.code}</span>
                  </div>
                  <h3 id={`pathway-${track.id}`}>{track.role} <span>· {track.level}</span></h3>
                  <p>{track.description}</p>
                  <div className="academy-card-foot">
                    <Link className="academy-catalog-action" href={cityAssignmentHref(track)} prefetch={false}><MapPin size={16} aria-hidden="true" />Enter city pathway<ArrowRight size={16} aria-hidden="true" /></Link>
                    <AcademyCatalogProgress trackId={track.id} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <section className="academy-study-plan" aria-labelledby="study-plan-title">
          <div className="academy-section-heading"><h2 id="study-plan-title">How to prepare for your Claude exam</h2></div>
          <ol>
            <li><strong>Choose the guide for your exam date.</strong> Each pathway links to Anthropic’s exam guide and shows the domains it covers.</li>
            <li><strong>Apply one skill at a time.</strong> Start with a city assignment, then practice by domain and work through an independent case.</li>
            <li><strong>Rehearse under a timer.</strong> Take a full-length practice exam and use the answer explanations to choose what to revisit.</li>
          </ol>
        </section>
        <section className="academy-study-plan" aria-labelledby="public-resources-title">
          <div className="academy-section-heading"><h2 id="public-resources-title">Study resources</h2></div>
          <ul className="academy-editorial-list">
            <li><Link href={decemberGuidePage.path}>December 7 Claude exam changes</Link> · Compare the official guides by test date.</li>
            <li><Link href={dispatchCasePage.path}>City Dispatch worked case</Link> · Diagnose a timeout and compare two recovery policies.</li>
            <li><Link href={methodologyPage.path}>Objective map and practice methodology</Link> · Find missions for the skills in each guide.</li>
          </ul>
        </section>
        <ExamAccess />
      </main>
    </div>
  );
}
