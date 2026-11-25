"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cityAssignmentHref, trackPracticeHref, tracks } from "../../lib/claude/blueprints";
import { studyHref } from "../../lib/claude/lessons/paths";
import type { TrackId } from "../../lib/claude/blueprints";
import { progressKey, readinessKey } from "../../lib/claude/progress-keys";
import { readProgressItem, subscribeToProgress } from "../../lib/progress-storage";
import { useAccount } from "../account";
import { useRestoreGate } from "../restore-gate";
import styles from "./catalog.module.css";

export function AcademyCatalogProgress({ trackId }: { trackId: TrackId }) {
  const { ready, user } = useAccount();
  const [hasPractice, setHasPractice] = useState(false);
  const [checked, setChecked] = useState(false);
  useRestoreGate("progress", checked);
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
          if (active) {
            setHasPractice(false);
            setChecked(true);
          }
          return;
        }
        const [{ readProgress }, { readReadiness }] = await Promise.all([
          import("../../lib/claude/progress"),
          import("../../lib/claude/readiness"),
        ]);
        if (!active) return;
        const progress = readProgress(track);
        const readiness = readReadiness(track);
        setHasPractice(Boolean(progress?.draft || progress?.attempts.length || readiness?.bridge || readiness?.capstones.length));
        setChecked(true);
      } catch {
        if (active) {
          setHasPractice(false);
          setChecked(true);
        }
      }
    };
    void refresh();
    const unsubscribe = subscribeToProgress((key) => { void refresh(key); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [track, ready, user]);
  const context = `pathway-${trackId}`;
  const city = cityAssignmentHref(track);
  const practice = trackPracticeHref(track);
  return <div className={styles.cardActions} data-restore="progress">
    <Link className={styles.primaryAction} href={hasPractice ? practice : city} prefetch={false} aria-describedby={context}>
      <span>{hasPractice ? "Continue practice" : "Start in the city"}</span>
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
    <div className={styles.secondaryActions}>
      <Link href={studyHref(track)} prefetch={false} aria-describedby={context}>Study guide</Link>
      <Link href={hasPractice ? city : practice} prefetch={false} aria-describedby={context}>{hasPractice ? "City missions" : "Practice exams"}</Link>
    </div>
  </div>;
}
