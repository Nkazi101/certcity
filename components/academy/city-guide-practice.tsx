"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { places } from "../../lib/world";
import { tracks, trackHref } from "../../lib/claude/blueprints";
import { decemberVersion, rehearsalBlueprint } from "../../lib/claude/december-blueprints";
import { missionGuideCases } from "../../lib/claude/curriculum/city-guide";
import type { Mission } from "../../lib/claude/missions";
import { emptyReadiness, readReadiness, readinessKey, updateReadiness } from "../../lib/claude/readiness";
import { progressScope, subscribeToProgress } from "../../lib/progress-storage";
import { GuideDecision } from "./guide-skills";

export function CityGuidePractice({ mission, objective }: { mission: Mission; objective?: string }) {
  const track = tracks.find(({ id }) => id === mission.track)!;
  const cases = missionGuideCases(track.id, mission.id);
  const place = places.find(({ id }) => id === mission.place)!;
  const [progress, setProgress] = useState(() => readReadiness(track) ?? emptyReadiness);
  const [notice, setNotice] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const pending = useRef<Promise<boolean>>(Promise.resolve(true));
  const latest = useRef(progress);

  useEffect(() => {
    return subscribeToProgress((key, local) => {
      if (local || (key !== readinessKey(track) && key !== null)) return;
      const saved = readReadiness(track) ?? emptyReadiness;
      latest.current = saved;
      setProgress(saved);
    });
  }, [track]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const active = ref.current?.querySelector<HTMLDetailsElement>("details[open]");
      active?.querySelector("summary")?.focus({ preventScroll: true });
      active?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [objective]);

  function complete(id: string) {
    const scope = progressScope();
    const work = pending.current.then(async () => {
      if (scope !== progressScope()) return false;
      const result = await updateReadiness(track, latest.current, { type: "guide", objective: id });
      latest.current = result.progress;
      setProgress(result.progress);
      setNotice(result.error ?? (!result.saved ? "Progress is available for this visit. This browser could not save it." : "Guide practice saved."));
      return result.error === null;
    });
    pending.current = work;
    return work;
  }

  return <div className="building-case-file city-guide-practice" ref={ref}>
    <header><BookOpen size={21} aria-hidden="true" /><div><h3>Current exam guide practice</h3><p>{place.name} · {mission.title}</p></div></header>
    {cases.map((activity, index) => {
      const id = activity[0];
      const [domain, skill] = id.split(".").map(Number);
      const heading = rehearsalBlueprint(track, decemberVersion).domains.find(({ id }) => id === domain)?.objectives[skill - 1] ?? id;
      return <details key={id} className="conversation-file" open={objective === id || (!objective && index === 0) || undefined}>
        <summary>{heading}{progress.guide.includes(id) && <span> · Practiced</span>}</summary>
        <GuideDecision track={track} activity={activity} completed={progress.guide.includes(id)} onPractice={complete} />
        <Link className="button button-outline" href={trackHref(track) + "?guide=" + decemberVersion + "&objective=" + id}>Try a different scenario in the Academy</Link>
      </details>;
    })}
    {notice && <p role="status">{notice}</p>}
  </div>;
}
