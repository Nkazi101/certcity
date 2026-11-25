import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AcademyHeader, ExamAccess } from "../../components/academy/chrome";
import { AcademyCatalogProgress } from "../../components/academy/catalog-progress";
import styles from "../../components/academy/catalog.module.css";
import { StructuredData } from "../../components/structured-data";
import { partnerFAQ, trackHref, tracks, trackTitle } from "../../lib/claude/blueprints";
import { availableProviders, plannedProviders } from "../../lib/certifications/providers";
import { certificationCatalog, decemberGuidePage, dispatchCasePage, methodologyPage, pageMetadata, siteUrl } from "../../lib/seo";

export const metadata = pageMetadata(certificationCatalog);

const studySteps = [
  { title: "Take on a mission in the city", description: "Someone at a building has a problem that uses a real exam skill. Your work is checked and the result is saved." },
  { title: "Read what you need when you need it", description: "When a skill trips you up, its short lesson opens from the mission. You can also read ahead." },
  { title: "Take a timed practice exam", description: "Full-length, original questions in the exam's format, with results by domain." },
];

const resources = [
  { page: decemberGuidePage, title: "December 7 exam changes", description: "Choose the guide for your exam date." },
  { page: dispatchCasePage, title: "City Dispatch mission walkthrough", description: "See how an order lookup fails and how to recover." },
  { page: methodologyPage, title: "Objective map and methodology", description: "See where each exam skill is practiced." },
];

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
      <AcademyHeader current="tracks" />
      <main id="academy-main" tabIndex={-1} className={`academy-width ${styles.catalog}`}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1>{certificationCatalog.title}</h1>
            <p>Practice for AI certification exams. The five Claude exams are available now. Each starts with missions in a 3D city, with a lesson for every exam objective when you need it, then timed practice exams.</p>
          </div>
          <div className={styles.heroImage} aria-hidden="true" />
        </header>
        <section aria-labelledby="pathway-title">
          <div className="academy-section-heading">
            <h2 id="pathway-title" tabIndex={-1}>Choose your exam</h2>
          </div>
          {availableProviders.map((provider) => <p key={provider.id} className={styles.providerLine}><strong>{provider.name}</strong>, from {provider.issuer}</p>)}
          <div className={styles.cards}>
            {tracks.map((track) => (
              <article key={track.id} className={styles.card} data-track={track.id} aria-labelledby={`pathway-${track.id}`}>
                <span className={styles.cardCode}>{track.code}</span>
                <h3 id={`pathway-${track.id}`} tabIndex={-1}><Link href={trackHref(track)} prefetch={false}>{track.role} <span>{track.level}</span></Link></h3>
                <p>{track.description}</p>
                <AcademyCatalogProgress trackId={track.id} />
              </article>
            ))}
          </div>
          <p className={styles.coverageNote}><a href={partnerFAQ} target="_blank" rel="noreferrer">See all Claude exams</a> on the Anthropic Partner Academy.</p>
          <p className={styles.coverageNote}>Planned, not available yet: {plannedProviders.map(({ name }) => name.replace(" certifications", "")).join(", ").replace(/, ([^,]*)$/, " and $1")} certifications.</p>
        </section>
        <section aria-labelledby="study-plan-title">
          <div className="academy-section-heading"><h2 id="study-plan-title">How to prepare for your Claude exam</h2></div>
          <ol className={styles.studySteps}>
            {studySteps.map(({ title, description }) => <li key={title}>
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>)}
          </ol>
        </section>
        <section aria-labelledby="public-resources-title">
          <div className="academy-section-heading"><h2 id="public-resources-title">Study resources</h2></div>
          <ul className={styles.resources}>
            {resources.map(({ page, title, description }) => <li key={page.path}>
              <Link href={page.path} prefetch={false}><strong>{title}</strong><p>{description}</p><ArrowUpRight size={17} aria-hidden="true" /></Link>
            </li>)}
          </ul>
        </section>
        <ExamAccess />
      </main>
    </div>
  );
}
