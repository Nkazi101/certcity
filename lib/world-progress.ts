import { isCorrect } from "./certification-progress";
import { missingExpertise, missionCompleted, missionFollowupQuestions, portfolio, portfolioEvidence, readPortfolio, unmetMissions } from "./claude/pathway";
import type { PortfolioRecords } from "./claude/pathway";
import type { Mission } from "./claude/missions";
import { tracks } from "./claude/blueprints";
import type { Track, TrackId } from "./claude/blueprints";
import { cityEvidenceFor, readReadiness, readinessKey } from "./claude/readiness";
import type { benchmarkEvidence as BenchmarkEvidence } from "./claude/benchmark";
import { progressKey } from "./claude/progress-keys";
import type { readProgress as ReadProgress } from "./claude/progress";
import { decemberBlueprint, decemberVersion } from "./claude/december-blueprints";
import type { ExamVersion } from "./claude/december-blueprints";

/**
 * How a place in the 3D city reflects the learner's saved work.
 * - locked: it hosts missions, but none can be entered yet
 * - available: at least one mission can be entered
 * - in-progress: a mission here has a saved draft, interview or study evidence but is not finished
 * - completed: a mission here passed
 * - mastered: completed, plus a passed delayed follow-up or the track's readiness benchmark
 */
export type PlaceProgress = "locked" | "available" | "in-progress" | "completed" | "mastered";

export type WorldProgress = {
  /** Only places that host at least one mission appear here. */
  places: Record<string, PlaceProgress>;
  /** The one place the learner should visit next, if any. */
  next: string | null;
  /** Tracks whose readiness benchmark (timed rehearsal + capstone + transfer) is met. */
  benchmarks: TrackId[];
};

export const emptyWorldProgress: WorldProgress = { places: {}, next: null, benchmarks: [] };

function followupPassed(mission: Mission, records: PortfolioRecords) {
  const followup = records[mission.id]?.followup;
  if (!followup) return false;
  const questions = missionFollowupQuestions(mission, followup.answers);
  return questions.length > 0 && questions.every((question) => isCorrect(question, followup.answers[question.id] ?? []));
}

function started(mission: Mission, records: PortfolioRecords) {
  const record = records[mission.id];
  if (!record) return false;
  return !!(record.draft || record.workDraft || record.caseDraft || record.interviewed?.length ||
    record.debriefSeen || record.lensItems?.length || record.check || record.practiced);
}

const rank: Record<PlaceProgress, number> = { locked: 0, available: 1, "in-progress": 2, completed: 3, mastered: 4 };

/** Reads only from storage through the existing readiness/progress readers. Safe to call often; it never writes. */
/** Scoring and the practice reader are passed in so the city can load them after first paint. */
export function readBenchmarks(scoring: { benchmarkEvidence: typeof BenchmarkEvidence; readProgress: typeof ReadProgress }, now = Date.now(), legacy: ReadonlySet<string> = new Set()): TrackId[] {
  const { benchmarkEvidence, readProgress } = scoring;
  const met: TrackId[] = [];
  const records = readPortfolio();
  for (const track of tracks) {
    try {
      const readiness = readReadiness(track);
      if (!readiness) continue;
      const attempts = readProgress(track)?.attempts ?? [];
      const versions: ExamVersion[] = decemberBlueprint(track) ? [decemberVersion, "july-2026"] : ["july-2026"];
      const { applied, covered } = portfolioEvidence(track, records, legacy);
      if (versions.some((version) => benchmarkEvidence(track, version, readiness, attempts, now, { city: cityEvidenceFor(track, version, applied, covered) }).met)) met.push(track.id);
    } catch {
      // A malformed save simply leaves the skyline unlit.
    }
  }
  return met;
}

/** Storage keys whose change can move a readiness benchmark. */
export function benchmarkKeys() {
  return tracks.flatMap((track: Track) => [readinessKey(track), progressKey(track)]);
}

/** Mission saves also move the benchmark now that city cases count toward ready. */
export function movesBenchmark(key: string) {
  return key.startsWith("certcity.mission.v1.") || key.startsWith("certcity.city.") || key === "simza.city-dispatch.v1";
}

export function deriveWorldProgress(records: PortfolioRecords, legacy: ReadonlySet<string>, options: {
  track?: TrackId | null;
  next?: string | null;
  benchmarks?: readonly TrackId[];
} = {}): WorldProgress {
  const benchmarks = [...(options.benchmarks ?? [])];
  const places: Record<string, PlaceProgress> = {};
  for (const mission of portfolio) {
    let state: PlaceProgress;
    if (missionCompleted(mission, records, legacy)) {
      state = followupPassed(mission, records) || benchmarks.includes(mission.track) ? "mastered" : "completed";
    } else {
      // Nothing is locked any more: a case with unmet suggestions is still open, so its building reads as available.
      state = started(mission, records) ? "in-progress" : "available";
    }
    // When a track is chosen, its locked missions should not grey out a place another track has opened.
    const current = places[mission.place];
    if (!current || rank[state] > rank[current]) places[mission.place] = state;
  }
  if (options.track) {
    // Places that only host other tracks' locked work stay neutral rather than grey.
    const relevant = new Set(portfolio.filter((mission) => mission.track === options.track).map(({ place }) => place));
    for (const [place, state] of Object.entries(places)) {
      if (state === "locked" && !relevant.has(place as Mission["place"])) delete places[place];
    }
  }
  return { places, next: options.next ?? null, benchmarks };
}

/** Stable string so callers can skip identical updates. */
export function worldProgressKey(progress: WorldProgress) {
  return JSON.stringify([Object.entries(progress.places).sort(), progress.next, [...progress.benchmarks].sort()]);
}
