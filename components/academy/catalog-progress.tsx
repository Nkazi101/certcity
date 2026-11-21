"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { trackHref, trackPracticeHref, tracks } from "../../lib/claude/blueprints";
import type { TrackId } from "../../lib/claude/blueprints";
import { progressKey, readinessKey } from "../../lib/claude/progress-keys";
import { readProgressItem, subscribeToProgress } from "../../lib/progress-storage";
import { useAccount } from "../account";

export function AcademyCatalogProgress({ trackId }: { trackId: TrackId }) {
  const { ready, user } = useAccount();
  const [status, setStatus] = useState("");
  const track = tracks.find(({ id }) => id === trackId)!;
  useEffect(() => {
    if (!ready) return;
    const practiceKey = progressKey(track);
    const studyKey = readinessKey(track);
    let active = true;
    const refresh = async (key: string | null = null) => {
      if (key !== null && key !== practiceKey && key !== studyKey) return;
      try {
        if (!readProgressItem(practiceKey) && !readProgressItem(studyKey)) {
          setStatus("");
          return;
        }
        const [{ readProgress }, { readReadiness }] = await Promise.all([
          import("../../lib/claude/progress"),
          import("../../lib/claude/readiness"),
        ]);
        if (!active) return;
        const progress = readProgress(track);
        const readiness = readReadiness(track);
        setStatus(progress?.draft ? "Resume saved session" : progress?.attempts.length || readiness?.bridge || readiness?.capstones.length ? "Continue learning pathway" : "");
      } catch {
        if (active) setStatus("");
      }
    };
    void refresh();
    const unsubscribe = subscribeToProgress((key) => { void refresh(key); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [track, ready, user]);
  return <Link className="academy-catalog-action" href={status ? trackPracticeHref(track) : trackHref(track)} prefetch={false} aria-describedby={`pathway-${trackId}`}>
    <span>{status || "Read study guide"}</span>
    <ArrowRight size={16} aria-hidden="true" />
  </Link>;
}
