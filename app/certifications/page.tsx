import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { AcademyHeader, ExamAccess, trackIcons } from "../../components/academy/chrome";
import { AcademyCatalogProgress } from "../../components/academy/catalog-progress";
import { cityAssignmentHref, trackHref, tracks } from "../../lib/claude/blueprints";

export const metadata: Metadata = { title: "Claude certifications" };

export default function Certifications() {
  return (
    <div className="academy-shell">
      <AcademyHeader />
      <main className="academy-width academy-catalog">
        <div className="academy-workspace-title">
          <h1>Claude exam practice</h1>
          <p>Choose a role, work through its city assignments, and see what you can do in independent cases and timed exam rehearsals.</p>
        </div>
        <section aria-labelledby="pathway-title">
          <div className="academy-section-heading">
            <h2 id="pathway-title">Certification pathways</h2>
            <span>4 credentials</span>
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
                  <h3>{track.role} <span>· {track.level}</span></h3>
                  <p>{track.description}</p>
                  <div className="academy-card-foot">
                    <Link className="academy-catalog-action" href={cityAssignmentHref(track)}><MapPin size={16} aria-hidden="true" />Enter city pathway<ArrowRight size={16} aria-hidden="true" /></Link>
                    <Link className="academy-catalog-action" href={trackHref(track)}>
                      <AcademyCatalogProgress trackId={track.id} />
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <ExamAccess />
      </main>
    </div>
  );
}
