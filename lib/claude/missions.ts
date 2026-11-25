import type { PlaceId } from "../world";
import type { TrackId } from "./blueprints";
import type { PracticeItem } from "./items";
import type { Workload } from "./workload";

export type Decision = {
  objective: PracticeItem["objective"];
  itemId: string;
  station: string;
  evidence: string;
  // The first effect is the currently deployed behavior.
  options: readonly { label: string; passed: boolean; trace: string }[];
  combine?: boolean;
};

type MissionInfo = {
  id: string;
  track: TrackId;
  place: PlaceId;
  title: string;
  brief: string;
  specialist: string;
  workload: string;
  measure: string;
  requires?: readonly string[];
  verify?: readonly PracticeItem["objective"][];
  simulate?: (choices: Choices) => Workload;
};

export type Mission = MissionInfo & (
  | { kind: "workbench"; decisions: readonly Decision[] }
  | { kind: "dispatch" | "original"; objectives: readonly PracticeItem["objective"][]; itemIds: readonly string[] }
);

export type Choices = Record<string, number[]>;

type DecisionOption = readonly [label: string, trace: string, passed?: boolean];

/** Option slots carry explicit outcomes: `proposed` and `second` meet the target unless an option sets its own flag. */
export function decision(
  objective: Decision["objective"], itemId: string, station: string, evidence: string,
  current: DecisionOption, proposed: DecisionOption, alternative: DecisionOption, second?: DecisionOption, other?: DecisionOption,
): Decision {
  const slots: [DecisionOption, boolean][] = [[current, false], [proposed, true], [alternative, false],
    ...(second ? [[second, true] as [DecisionOption, boolean]] : []), ...(other ? [[other, false] as [DecisionOption, boolean]] : [])];
  return {
    objective, itemId, station, evidence, combine: !!second,
    options: slots.map(([[label, trace, passed], fallback]) => ({ label, trace, passed: passed ?? fallback })),
  };
}

export function workbench(info: MissionInfo, decisions: readonly Decision[]): Mission {
  return { ...info, kind: "workbench", decisions };
}

export function missionMappings(mission: Mission) {
  return mission.kind === "workbench"
    ? mission.decisions.map(({ objective, itemId }) => ({ objective, itemId }))
    : mission.objectives.map((objective, i) => ({ objective, itemId: mission.itemIds[i] }));
}

/** Keep saved decision indexes stable and vary presentation by station. */
export function stationOptions(missionId: string, decision: Decision) {
  const options = decision.options.map((option, index) => ({ ...option, index }));
  let seed = 2166136261;
  for (const character of missionId + decision.objective) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  }
  for (let index = options.length - 1; index > 0; index--) {
    seed = Math.imul(seed ^ index, 16777619);
    const other = (seed >>> 0) % (index + 1);
    [options[index], options[other]] = [options[other], options[index]];
  }
  return options;
}

function seeded(text: string) {
  let seed = 2166136261;
  for (const character of text) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return ((seed ^= seed >>> 16) >>> 0) / 4294967296;
  };
}

/** Display order for a casework field's options. Saved values stay stable; a new retry cycle reshuffles. */
export function caseOptionOrder(missionId: string, fieldId: string, cycle: number, count: number) {
  const order = Array.from({ length: count }, (_, index) => index);
  const random = seeded(`${missionId}:${fieldId}:${cycle}`);
  for (let index = count - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return order;
}

export function replayMission(mission: Extract<Mission, { kind: "workbench" }>, choices: Choices) {
  return mission.decisions.map((decision) => {
    const chosen = choices[decision.objective] ?? [0];
    const options = chosen.map((index) => decision.options[index]).filter(Boolean);
    const passed = decision.combine
      ? options.length === 2 && new Set(chosen).size === 2 && options.every((option) => option.passed)
      : options.length === 1 && options[0].passed;
    return { objective: decision.objective, station: decision.station, passed, traces: options.map(({ trace }) => trace) };
  });
}

export function missionPassed(mission: Extract<Mission, { kind: "workbench" }>, choices: Choices) {
  return mission.simulate
    ? mission.simulate(choices).goals.every(({ passed }) => passed)
    : replayMission(mission, choices).every(({ passed }) => passed);
}
