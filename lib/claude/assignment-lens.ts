import { item } from "./items";
import type { PracticeItem } from "./items";
import { hasAssignmentWork } from "./assignment-work";
import type { AssignmentWorkId } from "./assignment-work";
import { banks } from "./banks";
import { missionMappings } from "./missions";
import type { Mission } from "./missions";

// Practice-only items. Mission checks and follow-ups use different item IDs.
export const assignmentLens: Partial<Record<AssignmentWorkId, PracticeItem>> = {
  "kitchen-extract": item("lens-equipment-credits", "4.3", "structured", "Equipment rental credits",
    "The assistant returns a credit amount as integer cents or null. It proposed 7,500¢ for a rental with an approved credit limit of 5,000¢. The limit lives in the rental service. Which two controls address the output contract and the over-credit?",
    "bd", "The schema enforces the amount type. A separate check compares the proposed amount with the limit for that rental.",
    ["Make the amount a required field and accept every response that parses.", "A required field may still contain an amount above the approved limit."],
    ["Specify integer cents or null in the response schema.", "This establishes a machine-readable amount contract."],
    ["Reject every credit above 5,000¢ in the schema for all rentals.", "The approved limit varies by rental."],
    ["Look up the verified limit for that rental and compare it before posting.", "The comparison uses the current limit attached to the correct rental."],
    ["Retry over-limit credits with the same prompt until they are below the limit.", "A smaller proposal alone does not establish the correct credit amount."]),
  "printworks-rules": item("lens-parts-catalog", "3.3", "memory", "Parts catalog repository",
    "Two packages have import fixtures under kits/tests/import and spares/tests/import. Both need a unit-conversion instruction when those fixtures are edited. Support scripts and other tests should continue to use their own rules. Where should the instruction live?",
    "c", "A project rule scoped to both fixture paths shares the instruction while leaving unrelated files unaffected.",
    ["In the root CLAUDE.md with a reminder to ignore it on support work.", "The instruction is still loaded in unrelated work."],
    ["In each operator’s user rules under one common test pattern.", "The rule must travel with the repository, and other tests share the pattern."],
    ["In .claude/rules with paths for both import-fixture directories.", "The rule follows the checkout and loads for the intended files."],
    ["In one package’s directory instructions for all of its tests.", "This misses the other package and applies to tests outside the import fixtures."]),
  "archive-coordination": item("lens-lease-audit", "5.3", "research", "Regional lease audit",
    "The title worker verified all deeds. The zoning worker verified three parcels, then exhausted the retry budget on two. A reviewer needs the verified findings today and will check the remaining parcels tomorrow. What should the coordinator return?",
    "b", "A useful partial result preserves verified evidence, names the uncovered parcels, and records the failed attempts so the reviewer can resume.",
    ["Publish all five parcels as covered, flagging the last two as low confidence.", "A confidence label cannot establish coverage for parcels that were never checked."],
    ["Return verified deeds and zoning findings with sources, list the unchecked parcels, and record the failed attempt.", "The reviewer sees what was established and where work needs to resume."],
    ["Return only the deeds and omit the zoning report entirely.", "This discards verified zoning work and conceals the coverage gap."],
    ["Delay all findings until the zoning source responds.", "The reviewer needs the verified work today and can follow up on the gap separately."]),
};

/** Keep the mission’s skill check and delayed questions out of its Lens. */
export function lensForMission(mission: Mission): PracticeItem {
  const authored = hasAssignmentWork(mission.id) ? assignmentLens[mission.id] : undefined;
  if (authored) return authored;
  const mappings = missionMappings(mission);
  const used = new Set(mappings.map(({ itemId }) => itemId));
  const objectives = new Set(mappings.map(({ objective }) => objective));
  const domains = new Set(mappings.map(({ objective }) => objective.split(".")[0]));
  const items = banks[mission.track].practice.filter(({ id }) => !used.has(id));
  return items.find(({ objective }) => objectives.has(objective))
    ?? items.find(({ objective }) => domains.has(objective.split(".")[0]))
    ?? items[0];
}
