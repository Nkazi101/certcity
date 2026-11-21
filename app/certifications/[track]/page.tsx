import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyHeader } from "../../../components/academy/chrome";
import { PublicTrackGuide } from "../../../components/academy/public-track-guide";
import { SeoBreadcrumbs } from "../../../components/academy/seo-breadcrumbs";
import { TrackExperience } from "../../../components/academy/track-experience";
import { trackHref, tracks, trackTitle } from "../../../lib/claude/blueprints";
import { certificationCatalog, pageMetadata, siteName, trackDescriptions } from "../../../lib/seo";

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
  return pageMetadata({ path: trackHref(track), title: `${trackTitle(track)} Exam Practice`, description: trackDescriptions[track.id] });
}

export default async function TrackPage(props: Props) {
  const track = await findTrack(props);
  const breadcrumbs = [
    { name: siteName, path: "/" },
    { name: "Claude exam practice", path: certificationCatalog.path },
    { name: `${track.role} ${track.level}`, path: trackHref(track) },
  ];
  const trail = <SeoBreadcrumbs entries={breadcrumbs} />;
  return (
    <div className="academy-shell">
      <AcademyHeader />
      <TrackExperience key={track.id} track={track} breadcrumbs={trail}>
        <PublicTrackGuide track={track} breadcrumbs={trail} />
      </TrackExperience>
    </div>
  );
}
