"use client";

import { useEffect, useState } from "react";
import { tracks } from "../../lib/claude/blueprints";
import type { TrackId } from "../../lib/claude/blueprints";
import { domainEvidence } from "../../lib/claude/practice";
import { readProgress } from "../../lib/claude/progress";
import { subscribeToProgress } from "../../lib/progress-storage";
import { useAccount } from "../account";

export function AcademyCatalogProgress({ trackId, questions }: { trackId: TrackId; questions: number }) {
  const { ready } = useAccount();
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!ready) return;
    const track = tracks.find(({ id }) => id === trackId);
    if (!track) return;
    function refresh() {
      if (!track) return;
      const progress = readProgress(track);
      const answered = domainEvidence(track, progress?.attempts ?? []).firstAnswers.size;
      setStatus(progress?.draft ? "Session in progress" : answered ? `${answered} of ${questions} questions practiced` : "");
    }
    refresh();
    return subscribeToProgress(refresh);
  }, [trackId, questions, ready]);
  return <span>{status || `${questions} practice questions`}</span>;
}
