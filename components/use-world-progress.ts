"use client";

import { useEffect, useMemo, useState } from "react";
import type { PortfolioRecords } from "../lib/claude/pathway";
import type { TrackId } from "../lib/claude/blueprints";
import { subscribeToProgress } from "../lib/progress-storage";
import { benchmarkKeys, deriveWorldProgress, movesBenchmark, readBenchmarks, worldProgressKey } from "../lib/world-progress";
import type { WorldProgress } from "../lib/world-progress";

/**
 * Derives what the 3D city should show from the records the app already keeps in state, plus readiness benchmarks
 * read from storage. Returns the same object until something visible changes.
 */
export function useWorldProgress(records: PortfolioRecords, legacy: ReadonlySet<string>, track: TrackId | null, next: string | null) {
  const [benchmarks, setBenchmarks] = useState<TrackId[]>([]);
  const legacyKey = [...legacy].sort().join();
  useEffect(() => {
    const keys = new Set(benchmarkKeys());
    const completions = new Set(legacyKey ? legacyKey.split(",") : []);
    let scoring: Parameters<typeof readBenchmarks>[0] | null = null;
    let live = true;
    // Practice-exam scoring needs every question; load it after first paint rather than with the city.
    const refresh = () => {
      const loaded = scoring;
      if (!loaded) return;
      setBenchmarks((current) => {
        const met = readBenchmarks(loaded, Date.now(), completions);
        return met.join() === current.join() ? current : met;
      });
    };
    void Promise.all([import("../lib/claude/benchmark"), import("../lib/claude/progress")]).then(([benchmark, progress]) => {
      if (!live) return;
      scoring = { benchmarkEvidence: benchmark.benchmarkEvidence, readProgress: progress.readProgress };
      refresh();
    });
    const unsubscribe = subscribeToProgress((key) => {
      if (key === null || keys.has(key) || movesBenchmark(key)) refresh();
    });
    return () => { live = false; unsubscribe(); };
  }, [legacyKey]);
  const derived = useMemo(() => deriveWorldProgress(records, new Set(legacyKey ? legacyKey.split(",") : []), { track, next, benchmarks }),
    [records, legacyKey, track, next, benchmarks]);
  const key = worldProgressKey(derived);
  return useMemo<WorldProgress>(() => derived, [key]);
}
