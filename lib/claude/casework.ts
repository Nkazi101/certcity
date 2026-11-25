export type CaseValue = string | number;
/** A working draft. `null` means the learner has not chosen yet ("Choose…"). */
export type CaseDraft = Record<string, CaseValue | null>;
/** A complete configuration: every field has a value. */
export type SolvedDraft = Record<string, CaseValue>;

export type CaseOption = {
  /** Stable saved value and visible label. */
  value: string;
  /** Shown in the debrief for this option: what it does in a real Claude system. */
  rationale: string;
  /** The wrong mental model a distractor targets. Every distractor names one. */
  misconception?: string;
  /** Exam vocabulary for this option, e.g. "PreToolUse hook" or "custom_id". */
  examTerm?: string;
};

/** Three rungs, opened in order. Nudge is free; concept and worked example cost mastery. */
export type HintLadder = {
  /** Restates the observed symptom and names the source to reread. Never the answer. */
  nudge: string;
  /** About 60 words with the exam term. Links to the objective's lesson. */
  concept: string;
  /** An isomorphic case from another domain, with its own answer. */
  worked: string;
};

export type NumberKey = number | { atLeast?: number; atMost?: number };

type FieldBase = { id: string; label: string; objective: string; hints: HintLadder };
export type CaseChoice = FieldBase & { options: readonly CaseOption[]; key: string };
export type CaseQuantity = FieldBase & {
  min: number; max: number; unit: string; key: NumberKey;
  /** How the number is worked out from the case file, shown in the debrief. */
  derivation?: string;
  /** Set only when copying a printed number is the intended skill (reading the right source). */
  transcription?: true;
};
export type CaseField = CaseChoice | CaseQuantity;

export type CaseFixture = {
  name: string;
  evidence: string;
  /** Fields this replay depends on. It passes when each one meets its key. */
  fields: readonly string[];
  /** What the replay visibly shows when it fails. Always visible. */
  symptom: string;
  /** Which concept went wrong. Shown only once the learner opens a concept hint. */
  diagnosis: string;
  done: string;
};

export type CaseReference = readonly [name: string, content: string] | readonly [name: string, content: string, kind: "policy"];

export type CasePrebrief = {
  concept: string;
  terms: readonly (readonly [plain: string, exam: string])[];
  contrast: { good: string; bad: string };
};

export type CaseBrief = {
  problem: string;
  /** Where to look, never what to choose. */
  move: string;
  /** Observable outcomes only ("0 unverified writes", "queue ≤ 120 min"). */
  success: readonly string[];
};

export type CasePrediction = {
  prompt: string;
  unit: string;
  /** Accepted distance from the actual value. */
  tolerance?: number;
  /** Reuses the replay's own formulas. */
  actual: (draft: CaseDraft) => number;
};

export type Casework = {
  station: string;
  view: "document" | "terminal" | "flow" | "operations";
  opening: string;
  task: string;
  brief: CaseBrief;
  prebrief: CasePrebrief;
  references: readonly CaseReference[];
  fields: readonly CaseField[];
  /** The broken configuration currently running. Shown read-only as "Before". */
  deployed: Readonly<Record<string, CaseValue>>;
  cases: readonly CaseFixture[];
  retest: CaseFixture;
  debrief: string;
  objectives: readonly string[];
  /** Unset choices arrive as "(not set)" and unset quantities as 0. */
  output?: (draft: CaseDraft) => readonly (readonly [title: string, text: string])[];
  capacity?: { label: string; limit: number; unit: string; terms: readonly (readonly [string, number | Readonly<Record<string, number>>])[] };
  prediction?: CasePrediction;
};

type AuthoredOption = CaseOption & { key?: true };

/** A distractor. It must name the misconception it targets. */
export function option(value: string, rationale: string, misconception: string, examTerm?: string): AuthoredOption {
  return { value, rationale, misconception, ...(examTerm ? { examTerm } : {}) };
}

/** The correct option. */
export function answer(value: string, rationale: string, examTerm: string): AuthoredOption {
  return { value, rationale, examTerm, key: true };
}

export function hints(nudge: string, concept: string, worked: string): HintLadder {
  return { nudge, concept, worked };
}

export function field(id: string, label: string, objective: string, options: readonly AuthoredOption[], ladder: HintLadder): CaseChoice {
  const keys = options.filter((entry) => entry.key);
  if (keys.length !== 1) throw new Error(`${id} needs exactly one answer`);
  return { id, label, objective, hints: ladder, key: keys[0].value,
    options: options.map(({ key: _key, ...entry }) => entry) };
}

export function quantity(id: string, label: string, objective: string, range: readonly [min: number, max: number, unit: string],
  key: NumberKey, ladder: HintLadder, extra: { derivation?: string; transcription?: true } = {}): CaseQuantity {
  return { id, label, objective, min: range[0], max: range[1], unit: range[2], key, hints: ladder, ...extra };
}

export function fixture(name: string, evidence: string, fields: readonly string[], symptom: string, diagnosis: string, done: string): CaseFixture {
  return { name, evidence, fields, symptom, diagnosis, done };
}

export const unsetLabel = "(not set)";

export function isChoice(field: CaseField): field is CaseChoice {
  return "options" in field;
}

export function startingCase(work: Casework): CaseDraft {
  return Object.fromEntries(work.fields.map(({ id }) => [id, null]));
}

export function deployedCase(work: Casework): CaseDraft {
  return { ...startingCase(work), ...work.deployed };
}

function validValue(field: CaseField, value: unknown) {
  if (isChoice(field)) return typeof value === "string" && field.options.some((entry) => entry.value === value);
  return typeof value === "number" && Number.isInteger(value) && value >= field.min && value <= field.max;
}

/** A committed configuration must be complete. A draft may leave fields unset. */
export function validCaseDraft(work: Casework, candidate: unknown, partial = false): candidate is CaseDraft {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const entries = candidate as Record<string, unknown>;
  return Object.keys(entries).length === work.fields.length && work.fields.every((field) => {
    const value = entries[field.id];
    return (partial && value === null) || validValue(field, value);
  });
}

export function meetsKey(field: CaseField, value: CaseValue | null | undefined) {
  if (value === null || value === undefined) return false;
  if (isChoice(field)) return value === field.key;
  if (typeof value !== "number") return false;
  if (typeof field.key === "number") return value === field.key;
  return (field.key.atLeast === undefined || value >= field.key.atLeast) && (field.key.atMost === undefined || value <= field.key.atMost);
}

function keyValue(field: CaseField): CaseValue {
  if (isChoice(field)) return field.key;
  if (typeof field.key === "number") return field.key;
  return field.key.atLeast ?? field.key.atMost ?? field.min;
}

/** The reference solution. Also used to migrate passing saves from before the redesign. */
export function solvedCase(work: Casework): SolvedDraft {
  return Object.fromEntries(work.fields.map((field) => [field.id, keyValue(field)]));
}

/** Values for previews: unset choices read "(not set)" and unset quantities read 0. */
export function shownCase(work: Casework, draft: CaseDraft): CaseDraft {
  return Object.fromEntries(work.fields.map((field) => {
    const value = draft[field.id];
    return [field.id, value ?? (isChoice(field) ? unsetLabel : 0)];
  }));
}

export function caseCapacity(work: Casework, configuration: CaseDraft) {
  if (!work.capacity) return undefined;
  const lengths = work.capacity.terms.map(([id, rate]) => {
    const value = configuration[id];
    const units = value === null || value === undefined ? 0
      : typeof rate === "number" ? rate * Number(value) : rate[String(value)] ?? 0;
    return { id, units };
  });
  return { ...work.capacity, lengths, used: lengths.reduce((total, { units }) => total + units, 0) };
}

export function replayCasework(work: Casework, configuration: CaseDraft, retest = false) {
  const fields = new Map(work.fields.map((entry) => [entry.id, entry]));
  const checks = (retest ? [work.retest] : work.cases).map(({ name, evidence, fields: ids, done, symptom, diagnosis }) => {
    const failing = ids.filter((id) => {
      const entry = fields.get(id);
      return !entry || !meetsKey(entry, configuration[id]);
    });
    const passed = failing.length === 0;
    return { name, evidence, passed, effect: passed ? done : symptom, symptom, diagnosis, failing };
  });
  const capacity = caseCapacity(work, configuration);
  return { checks, capacity, output: retest ? [] : work.output?.(shownCase(work, configuration)) ?? [],
    unset: work.fields.filter(({ id }) => configuration[id] === null || configuration[id] === undefined).map(({ id }) => id),
    passed: checks.every(({ passed }) => passed) && (!capacity || capacity.used <= capacity.limit) };
}

export function caseworkPassed(work: Casework, draft: CaseDraft) {
  return replayCasework(work, draft).passed && replayCasework(work, draft, true).passed;
}

/** Fields an objective depends on. */
export function objectiveFields(work: Casework, objective: string) {
  return work.fields.filter((entry) => entry.objective === objective).map(({ id }) => id);
}

export function chosenOption(field: CaseField, value: CaseValue | null | undefined) {
  return isChoice(field) ? field.options.find((entry) => entry.value === value) : undefined;
}
