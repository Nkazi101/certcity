import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AcademyHeader } from "../../../components/academy/chrome";
import { TrackWorkspace } from "../../../components/academy/workspace";
import { tracks, trackTitle } from "../../../lib/claude/blueprints";

type Props = { params: Promise<{ track: string }> };

export function generateStaticParams() {
  return tracks.map(({ id }) => ({ track: id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { track: id } = await params;
  const track = tracks.find((entry) => entry.id === id);
  return track ? { title: trackTitle(track) } : {};
}

export default async function TrackPage({ params }: Props) {
  const { track: id } = await params;
  const track = tracks.find((entry) => entry.id === id);
  if (!track) notFound();
  return (
    <div className="academy-shell">
      <AcademyHeader />
      <TrackWorkspace key={track.id} track={track} />
    </div>
  );
}
