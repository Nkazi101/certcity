// Deterministic lab runner: parse the learner's files once, run every fixture of a set through the engine,
// and evaluate each check against each run. Pure: no clock, no randomness, no storage.
import type { AnyLabMission, CheckResult, Fixture, FixtureSet, LabFiles, LabRun, LabRunFixture } from "./types";

/** FNV-1a; small, stable, and good enough to spread cycles across variants. */
export function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function transferVariants(mission: AnyLabMission) {
  return [...new Set(mission.fixtures.filter(({ set }) => set === "transfer").map(({ variant }) => variant ?? "default"))];
}

/** The hidden transfer variant for an attempt. Changes with the cycle, so a fresh attempt meets a different case. */
export function pickVariant(mission: AnyLabMission, cycle: number, salt = "") {
  const variants = transferVariants(mission);
  return variants[hashString(`${salt}|${mission.id}|${cycle}`) % variants.length];
}

export function fixturesFor(mission: AnyLabMission, set: FixtureSet, variant?: string): readonly Fixture[] {
  return mission.fixtures.filter((fixture) => fixture.set === set && (set === "sample" || (fixture.variant ?? "default") === variant));
}

export function starterFiles(mission: AnyLabMission): Record<string, string> {
  return Object.fromEntries(mission.artifacts.map(({ id, starter }) => [id, starter]));
}

export function runLab(mission: AnyLabMission, files: LabFiles, set: FixtureSet, variant?: string): LabRun {
  const chosen = set === "transfer" ? variant ?? transferVariants(mission)[0] : undefined;
  const fixtures = fixturesFor(mission, set, chosen);
  const parsed = mission.engine.parse(files);
  const runs: LabRunFixture[] = fixtures.map((fixture) => {
    if (!parsed.ok) {
      const results: CheckResult[] = mission.checks.map(({ id, objective, title }) => ({
        check: id, objective, title, fixture: fixture.id, passed: false,
        symptom: `Not run: ${parsed.error}`, source: parsed.source,
      }));
      return { fixture, run: null, results };
    }
    const run = mission.engine.run(parsed.value, fixture);
    const results = mission.checks.flatMap((check): CheckResult[] => {
      const seen = check.evaluate(run, fixture);
      return seen ? [{ check: check.id, objective: check.objective, title: check.title, fixture: fixture.id, ...seen }] : [];
    });
    return { fixture, run, results };
  });
  const results = runs.flatMap(({ results: entries }) => entries);
  const checks: Record<string, boolean> = {};
  for (const result of results) checks[result.check] = (checks[result.check] ?? true) && result.passed;
  return {
    set, ...(chosen && { variant: chosen }),
    ...(!parsed.ok && { parseError: { error: parsed.error, source: parsed.source } }),
    fixtures: runs, results, checks,
    passed: runs.length > 0 && results.length > 0 && results.every(({ passed }) => passed),
    effects: mission.effects(runs),
  };
}

/** Check ids that failed somewhere in a run. */
export function failedChecks(run: LabRun) {
  return Object.entries(run.checks).filter(([, passed]) => !passed).map(([id]) => id);
}

/**
 * An objective counts as applied when the transfer passed, no check for that objective was revealed,
 * and no check for it needed the worked example (hint rung 3). Same rule as casework's caseIndependent.
 */
export function labIndependent(mission: AnyLabMission, record: { hints: Readonly<Record<string, number>>; revealed: readonly string[] }, objective: string) {
  return mission.checks.filter((check) => check.objective === objective)
    .every(({ id }) => !record.revealed.includes(id) && (record.hints[id] ?? 0) <= 2);
}
