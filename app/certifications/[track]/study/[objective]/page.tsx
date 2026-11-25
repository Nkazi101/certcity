import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcademyHeader } from "../../../../../components/academy/chrome";
import { LessonArticle } from "../../../../../components/academy/lesson";
import { StudiedToggle } from "../../../../../components/academy/lesson-progress";
import { SeoBreadcrumbs } from "../../../../../components/academy/seo-breadcrumbs";
import { cityAssignmentHref, trackHref, trackPracticeHref, tracks, trackTitle } from "../../../../../lib/claude/blueprints";
import { missionMappings } from "../../../../../lib/claude/missions";
import { missionsFor } from "../../../../../lib/claude/pathway";
import { places } from "../../../../../lib/world";
import { findLesson, lessonSets } from "../../../../../lib/claude/lessons";
import { lessonDomains, lessonHref, lessonObjectiveFor, lessonSlug, slugObjective, studyHref } from "../../../../../lib/claude/lessons/paths";
import { certificationCatalog, pageMetadata, siteName } from "../../../../../lib/seo";
import styles from "../../../../../components/academy/lesson.module.css";

type Props = { params: Promise<{ track: string; objective: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return tracks.flatMap((track) => lessonSets[track.id].lessons.map(({ objective }) => ({ track: track.id, objective: lessonSlug(objective) })));
}

async function resolve({ params }: Props) {
  const { track: id, objective: slug } = await params;
  const track = tracks.find((entry) => entry.id === id);
  const objective = slugObjective(slug);
  const lesson = track && objective ? findLesson(track.id, objective) : undefined;
  if (!track || !lesson) notFound();
  return { track, lesson };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { track, lesson } = await resolve(props);
  return pageMetadata({ path: lessonHref(track, lesson.objective), title: `${lesson.title} · ${track.code} lesson ${lesson.objective}`, description: lesson.takeaway.replace(/[`*]/g, "") });
}

export default async function LessonPage(props: Props) {
  const { track, lesson } = await resolve(props);
  const ordered = lessonSets[track.id].lessons;
  const index = ordered.findIndex(({ objective }) => objective === lesson.objective);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  const domain = lessonDomains(track).find(({ id }) => String(id) === lesson.objective.split(".")[0]);
  const practice = `${trackPracticeHref(track)}${track.id === "architect-foundations" ? "" : "&guide=december-2026"}&objective=${lesson.objective}`;
  // The city case that puts this lesson to work: reading leads back to doing. Cases use their guide's numbering, so map
  // each case objective to the lesson that teaches it.
  const useCase = missionsFor(track.id).find((mission) => missionMappings(mission).some(({ objective }) =>
    lessonObjectiveFor(track, undefined, objective) === lesson.objective));
  const usePlace = useCase && places.find(({ id }) => id === useCase.place);
  return <div className="academy-shell">
    <AcademyHeader />
    <main id="academy-main" tabIndex={-1} className="academy-width academy-workspace academy-editorial academy-article">
      <SeoBreadcrumbs entries={[
        { name: siteName, path: "/" },
        { name: "Claude exam practice", path: certificationCatalog.path },
        { name: `${track.role} ${track.level}`, path: trackHref(track) },
        { name: "Study guide", path: studyHref(track) },
        { name: lesson.title, path: lessonHref(track, lesson.objective) },
      ]} />
      <header className="academy-workspace-title">
        <p className="academy-code">{track.code} · Objective {lesson.objective}{domain && ` · ${domain.title} (${domain.weight}%)`}</p>
        <h1>{lesson.title}</h1>
        <p className={styles.meta}><span>{lesson.minutes} min read</span><span>{trackTitle(track)}</span></p>
      </header>
      <article className="academy-panel">
        <LessonArticle lesson={lesson} track={track.id} />
        <div className={styles.lessonActions}>
          <StudiedToggle track={track.id} objective={lesson.objective} />
          {useCase && <Link className="academy-button primary" href={`${cityAssignmentHref(track)}&mission=${useCase.id}`} prefetch={false}>
            Use it on a mission: {useCase.title}{usePlace ? ` at ${usePlace.name}` : ""} <ArrowRight size={16} aria-hidden="true" /></Link>}
          <Link className="academy-button secondary" href={practice}>Quick decisions on {lesson.objective} <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </article>
      <nav className={styles.lessonNav} aria-label="Lessons">
        {previous ? <Link href={lessonHref(track, previous.objective)}><ArrowLeft size={15} aria-hidden="true" /> {previous.objective} · {previous.title}</Link> : <Link href={studyHref(track)}><ArrowLeft size={15} aria-hidden="true" /> All lessons</Link>}
        {next ? <Link href={lessonHref(track, next.objective)}>{next.objective} · {next.title} <ArrowRight size={15} aria-hidden="true" /></Link> : <Link href={practice}>Go to practice <ArrowRight size={15} aria-hidden="true" /></Link>}
      </nav>
    </main>
  </div>;
}
