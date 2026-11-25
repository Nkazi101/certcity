"use client";

import Link from "next/link";
import { tracks, trackTitle } from "../lib/claude/blueprints";
import type { Track, TrackId } from "../lib/claude/blueprints";
import { missionsFor } from "../lib/claude/pathway";
import { places } from "../lib/world";
import type { PlaceId } from "../lib/world";

/**
 * What each exam's first case sounds like from the person who needs it. CertCity puts the experience first: a visitor
 * meets someone with a problem, walks up to their building and goes in; the skills and their lessons surface inside the
 * case (hints, "Ask Arun why"), not as reading assigned up front.
 */
const asks: Record<TrackId, string> = {
  "associate-foundations": "Three families are waiting, and last year’s answers are out of date.",
  "developer-foundations": "Invoices with the wrong totals keep reaching my ledger.",
  "architect-foundations": "We told a customer their order doesn’t exist. It does.",
  "architect-professional": "I need a support pilot that meets our budget and handles disputes.",
  "developer-professional": "Fans got error pages at the gates, and our assistant kept retrying everything.",
};

const openCases = tracks.flatMap((track) => {
  const mission = missionsFor(track.id).find(({ kind }) => kind === "original" || kind === "dispatch");
  const place = mission && places.find(({ id }) => id === mission.place);
  return mission && place ? [{ track, place, ask: asks[track.id] }] : [];
});

const count: Record<number, string> = { 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six" };

/** First visit: the people with open cases, in place of a syllabus. Choosing an exam stays one click away. */
export function CityWelcome({ ready, onVisit, onExplore, onChooseExam }: {
  ready: boolean;
  onVisit: (place: PlaceId, track: Track) => void;
  onExplore: () => void;
  onChooseExam: () => void;
}) {
  return (
    <section className="city-welcome" aria-labelledby="city-welcome-title" data-restore="progress">
      <h1 id="city-welcome-title" className="city-welcome-kicker">Claude certification practice in a 3D city</h1>
      <p className="city-welcome-lead">{count[openCases.length] ?? openCases.length} people need help today.</p>
      <p className="city-welcome-note">Pick someone to visit. Each problem is a real exam skill, and the lesson is there when you get stuck.</p>
      <ul className="city-welcome-cases">
        {openCases.map(({ track, place, ask }) => (
          <li key={track.id}>
            <button type="button" className="city-welcome-case" disabled={!ready} onClick={() => onVisit(place.id, track)}
              aria-label={`Visit ${place.person} at ${place.name}: ${ask} A ${trackTitle(track)} mission.`}>
              <span className="place-icon" data-color={place.color}><place.icon size={18} aria-hidden="true" /></span>
              <span className="city-welcome-case-copy">
                <span className="city-welcome-who"><strong>{place.person}</strong> · {place.name}</span>
                <span className="city-welcome-ask">“{ask}”</span>
              </span>
              <span className="city-welcome-exam">{track.code}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="city-welcome-footer">
        <button type="button" className="button button-text" onClick={onExplore}>Look around first</button>
        {/* A real link to the catalog (crawlers, new-tab clicks, no JavaScript); a plain click opens the in-city chooser. */}
        <Link href="/certifications" className="button button-text" prefetch={false} onClick={(event) => {
          if (!ready || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onChooseExam();
        }}>Choose by exam</Link>
      </div>
    </section>
  );
}
