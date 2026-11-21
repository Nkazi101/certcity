"use client";

import { useEffect, useState } from "react";
import { tracks } from "../../lib/claude/blueprints";
import type { TrackId } from "../../lib/claude/blueprints";
import { readReadiness } from "../../lib/claude/readiness";
import { readProgress } from "../../lib/claude/progress";
import { subscribeToProgress } from "../../lib/progress-storage";
import { useAccount } from "../account";

export function AcademyCatalogProgress({ trackId }: { trackId: TrackId }) {
  const { ready, user } = useAccount();
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!ready) return;
    const track = tracks.find(({ id }) => id === trackId);
    if (!track) return;
    function refresh() {
      if (!track) return;
      const progress = readProgress(track);
      const readiness = readReadiness(track);
      setStatus(progress?.draft ? "Resume saved session" : progress?.attempts.length || readiness?.bridge || readiness?.capstones.length ? "Continue learning pathway" : "");
    }
    refresh();
    return subscribeToProgress(refresh);
  }, [trackId, ready, user]);
  return <span>{status || "Open learning pathway"}</span>;
}
