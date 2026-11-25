import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcademyHeader, ExternalLink } from "../../../../components/academy/chrome";
import { StudiedCount, StudiedMark } from "../../../../components/academy/lesson-progress";
import { SeoBreadcrumbs } from "../../../../components/academy/seo-breadcrumbs";
import { trackHref, trackPracticeHref, tracks, trackTitle } from "../../../../lib/claude/blueprints";
import { decemberBlueprint } from "../../../../lib/claude/december-blueprints";
import { lessonSets, lessonWords } from "../../../../lib/claude/lessons";
import { lessonDomains, lessonHref, studyHref } from "../../../../lib/claude/lessons/paths";
import { certificationCatalog, pageMetadata, siteName } from "../../../../lib/seo";
import styles from "../../../../components/academy/lesson.module.css";

type Props = { params: Promise<{ track: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return tracks.map(({ id }) => ({ track: id }));
}

async function findTrack({ params }: Props) {
  const { track: id } = await params;
  const track = tracks.find((entry) => entry.id === id);
  if (!track) notFound();
  return track;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const track = await findTrack(props);
  return pageMetadata({
    path: studyHref(track),
    title: `${trackTitle(track)} Study Guide`,
    description: `Lessons for every objective in the ${track.code} exam guide, with configuration, API and workflow examples.`,
  });
}

export default async function StudyIndex(props: Props) {
  const track = await findTrack(props);
  const set = lessonSets[track.id];
  const lessons = new Map(set.lessons.map((lesson) => [lesson.objective, lesson]));
  const domains = lessonDomains(track);
  const total = domains.reduce((sum, domain) => sum + domain.objectives.length, 0);
  const minutes = set.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  const guide = decemberBlueprint(track)?.guide ?? track.guide;
  return <div className="academy-shell">
    <AcademyHeader />
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-editorial academy-article">
      <SeoBreadcrumbs entries={[
        { name: siteName, path: "/" },
        { name: "Claude exam practice", path: certificationCatalog.path },
        { name: `${track.role} ${track.level}`, path: trackHref(track) },
        { name: "Study guide", path: studyHref(track) },
      ]} />
      <header className="academy-workspace-title">
        <p className="academy-code">{track.code} · {track.id === "architect-foundations" ? "Guide v1.1 · November 2026" : track.id === "developer-professional" ? "Guide v1.0 · November 2026" : "Guide v1.1 · December 7, 2026"}</p>
        <h1>{trackTitle(track)} study guide</h1>
        <p>{set.overview}</p>
        <p className={styles.meta}><span>{set.lessons.length} lessons</span><span>About {Math.round(minutes / 60 * 10) / 10} hours of reading</span><StudiedCount track={track.id} total={total} /></p>
        <div className="academy-actions">
          <Link className="academy-button primary" href={lessonHref(track, set.lessons[0]?.objective ?? "1.1")}>Start the first lesson</Link>
          <Link className="academy-button secondary" href={trackPracticeHref(track)}>Open practice</Link>
          <ExternalLink href={guide}>Official exam guide</ExternalLink>
        </div>
      </header>
      <div className={styles.studyGrid}>
        {domains.map((domain) => <section key={domain.id} className={styles.domain} aria-labelledby={`study-domain-${domain.id}`}>
          <h2 id={`study-domain-${domain.id}`}>{domain.id}. {domain.title} <span>{domain.weight}% of the exam</span></h2>
          <ol className={styles.lessonList}>
            {domain.objectives.map((title, index) => {
              const objective = `${domain.id}.${index + 1}`;
              const lesson = lessons.get(objective as never);
              return <li key={objective}>
                <Link href={lessonHref(track, objective)}>
                  <span className={styles.lessonCode}>{objective}</span>
                  <span>{lesson?.title ?? title}</span>
                  <small>{lesson ? `${lesson.minutes} min · ${lessonWords(lesson)} words` : ""} <StudiedMark track={track.id} objective={objective} /></small>
                </Link>
              </li>;
            })}
          </ol>
        </section>)}
      </div>
    </main>
  </div>;
}
