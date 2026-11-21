import type { TrackId } from "../blueprints";
import type { ExamVersion } from "../december-blueprints";

export type CapstoneStage = "capstone" | "transfer";
export type CapstoneDraft = Record<string, string>;

export type CapstoneField = {
  id: string;
  label: string;
  group?: string;
  instruction?: string;
  initial?: string;
  editor?: "text" | "notes" | "json";
  options?: readonly string[];
};

export type CapstoneCriterion = {
  id: string;
  title: string;
  objectives: readonly string[];
  revisedObjectives?: readonly string[];
  review: string;
};

export type CapstoneTest = {
  criterion: string;
  passed: boolean;
  detail: string;
};

export type CapstonePreview =
  | { kind: "notice"; title: string; body: string; handoff: string }
  | { kind: "console"; text: string }
  | { kind: "trace"; steps: readonly string[]; citations: readonly string[]; missing: readonly string[] }
  | { kind: "comparison"; windows: readonly {
      name: string; route: string; queue: string; cost: number | null; budget: number;
      minutes: number | null; reviewMinutes: number;
    }[]; decision: string };

export type CapstoneDefinition = {
  id: string;
  stage: CapstoneStage;
  title: string;
  role: string;
  brief: string;
  deliverable: string;
  documents: readonly { id: string; title: string; text: string; format?: "json" }[];
  fields: readonly CapstoneField[];
  criteria: readonly CapstoneCriterion[];
  runs?: readonly { id: string; label: string }[];
  preview: (draft: CapstoneDraft, run?: string) => CapstonePreview;
  exercise: (draft: CapstoneDraft) => readonly CapstoneTest[];
  reference: { label: string; url: string };
};

export type CapstoneAttempt = {
  id: string;
  trackId: TrackId;
  version: ExamVersion;
  stage: CapstoneStage;
  scenarioId: string;
  submittedAt: number;
  passed: boolean;
  artifact: CapstoneDraft;
  results: readonly {
    criterion: string;
    title: string;
    passed: boolean;
    objectives: readonly string[];
    detail: string;
    review: string;
  }[];
};

export const capstoneFieldLimit = 4800;

export function test(criterion: string, passed: boolean, ifPassed: string, ifFailed: string): CapstoneTest {
  return { criterion, passed, detail: passed ? ifPassed : ifFailed };
}

export function words(value: string | undefined) {
  return (value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function sameList(actual: unknown, expected: readonly string[]) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, i) => value === expected[i]);
}

export function sameMembers(actual: unknown, expected: readonly string[]) {
  return Array.isArray(actual) && actual.length === expected.length && expected.every((value) => actual.includes(value));
}

export function jsonObject(value: string | undefined): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value ?? "");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function integer(value: string | undefined) {
  const input = value?.trim() ?? "";
  if (!/^\d+$/.test(input)) return null;
  const number = Number(input);
  return Number.isSafeInteger(number) ? number : null;
}
