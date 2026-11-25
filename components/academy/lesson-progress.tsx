"use client";

import { Check } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import type { TrackId } from "../../lib/claude/blueprints";
import { readStudied, setStudied } from "../../lib/claude/lessons/paths";
import { useRestoreGate } from "../restore-gate";
import { subscribeToProgress } from "../../lib/progress-storage";
import { studiedKey } from "../../lib/claude/lessons/paths";
import styles from "./lesson.module.css";

/** Lessons this browser has marked studied. Callers mark what they render with it `data-restore="progress"`. */
export function useStudied(track: TrackId) {
  const [studied, setState] = useState<Set<string> | null>(null);
  useRestoreGate("progress", studied !== null);
  // localStorage is synchronous: read before paint, so client-side navigations never show the empty state.
  useLayoutEffect(() => {
    const refresh = () => setState(readStudied(track));
    refresh();
    window.addEventListener("certcity:lessons", refresh);
    window.addEventListener("storage", refresh);
    // Signed-in learners also get marks made on their other devices.
    const unsubscribe = subscribeToProgress((key) => { if (key === null || key === studiedKey(track)) refresh(); });
    return () => {
      window.removeEventListener("certcity:lessons", refresh);
      window.removeEventListener("storage", refresh);
      unsubscribe();
    };
  }, [track]);
  return studied ?? empty;
}

const empty: ReadonlySet<string> = new Set();

export function StudiedMark({ track, objective }: { track: TrackId; objective: string }) {
  const studied = useStudied(track);
  return studied.has(objective) ? <small className={styles.studied} data-restore="progress"><Check size={14} aria-hidden="true" /> Studied</small> : null;
}

export function StudiedCount({ track, total }: { track: TrackId; total: number }) {
  const studied = useStudied(track);
  return <span data-restore="progress">{studied.size}/{total} lessons studied</span>;
}

export function StudiedToggle({ track, objective }: { track: TrackId; objective: string }) {
  const studied = useStudied(track);
  const done = studied.has(objective);
  return <button type="button" className={`academy-button ${done ? "secondary" : "primary"}`} aria-pressed={done} data-restore="progress"
    onClick={() => setStudied(track, objective, !done)}>
    {done ? <><Check size={16} aria-hidden="true" /> Studied</> : "Mark as studied"}
  </button>;
}
