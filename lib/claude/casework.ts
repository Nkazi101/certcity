export type CaseValue = string | number;
export type CaseDraft = Record<string, CaseValue>;

export type CaseField =
  | { id: string; label: string; initial: string; options: readonly string[] }
  | { id: string; label: string; initial: number; min: number; max: number; unit: string };

type Requirement = readonly [field: string, value: CaseValue] | readonly [field: string, comparison: "atLeast" | "atMost", value: number];
export type CaseFixture = {
  name: string;
  evidence: string;
  requirements: readonly Requirement[];
  done: string;
  problem: string;
};

export type Casework = {
  station: string;
  view: "document" | "terminal" | "flow" | "operations";
  opening: string;
  task: string;
  references: readonly (readonly [name: string, content: string])[];
  fields: readonly CaseField[];
  cases: readonly CaseFixture[];
  retest: CaseFixture;
  debrief: string;
  objectives: readonly string[];
  output?: (draft: CaseDraft) => readonly (readonly [title: string, text: string])[];
  capacity?: { label: string; limit: number; unit: string; terms: readonly (readonly [string, number | readonly number[]])[] };
};

export function field(id: string, label: string, initial: string, ...options: string[]): CaseField {
  return { id, label, initial, options };
}

export function quantity(id: string, label: string, initial: number, min: number, max: number, unit: string): CaseField {
  return { id, label, initial, min, max, unit };
}

export function fixture(name: string, evidence: string, requirements: readonly Requirement[], problem: string, done: string): CaseFixture {
  return { name, evidence, requirements, done, problem };
}

export function startingCase(work: Casework): CaseDraft {
  return Object.fromEntries(work.fields.map(({ id, initial }) => [id, initial]));
}

export function validCaseDraft(work: Casework, candidate: unknown): candidate is CaseDraft {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const entries = candidate as Record<string, unknown>;
  return Object.keys(entries).length === work.fields.length && work.fields.every((field) => {
    const value = entries[field.id];
    if ("options" in field) return typeof value === "string" && field.options.includes(value);
    return typeof value === "number" && Number.isInteger(value) && value >= field.min && value <= field.max;
  });
}

export function caseCapacity(work: Casework, configuration: CaseDraft) {
  if (!work.capacity) return undefined;
  const lengths = work.capacity.terms.map(([id, rate]) => {
    const field = work.fields.find((entry) => entry.id === id);
    const value = configuration[id];
    const units = typeof rate === "number" ? rate * Number(value)
      : field && "options" in field ? rate[field.options.indexOf(String(value))] ?? 0 : 0;
    return { id, units };
  });
  return { ...work.capacity, lengths, used: lengths.reduce((total, { units }) => total + units, 0) };
}

export function replayCasework(work: Casework, configuration: CaseDraft, retest = false) {
  const checks = (retest ? [work.retest] : work.cases).map(({ name, evidence, requirements, done, problem }) => {
    const passed = requirements.every((requirement) => {
      const value = configuration[requirement[0]];
      if (requirement.length === 2) return value === requirement[1];
      if (typeof value !== "number") return false;
      return requirement[1] === "atLeast" ? value >= requirement[2] : value <= requirement[2];
    });
    return { name, evidence, passed, effect: passed ? done : problem };
  });
  const capacity = caseCapacity(work, configuration);
  return { checks, capacity, output: retest ? [] : work.output?.(configuration) ?? [],
    passed: checks.every(({ passed }) => passed) && (!capacity || capacity.used <= capacity.limit) };
}

export function caseworkPassed(work: Casework, draft: CaseDraft) {
  return replayCasework(work, draft).passed && replayCasework(work, draft, true).passed;
}
