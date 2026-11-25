// A generic daily "shift": a short, deterministic day of tickets built from a content pack's concepts.
// Concepts unlock over the first days, missed concepts come back first the next day, and everything else returns on a
// Leitner schedule. One counted shift per calendar day; practice runs never change the schedule.

export type ConceptNote = { title: string; note: string; examTerm: string; objective: string };

export type ProofQuestion<C extends string = string> = {
  id: string;
  /** A concept from the pack, or a general item that fits any day (for example "contract"). */
  concept: C | (string & {});
  objective: string;
  prompt: string;
  options: readonly (readonly [key: string, text: string, rationale: string])[];
  correct: string;
  explanation: string;
};

export type ShiftTicket<C extends string, I> = {
  id: string;
  concept: C;
  returning: boolean;
  customer: string;
  line: string;
  /** "pair": several items, each matched to the request it answers instead of routed. */
  kind: "single" | "pair";
  items: readonly I[];
};

export type ShiftPlan<C extends string, I> = { number: number; tickets: readonly ShiftTicket<C, I>[]; introduces: readonly C[] };

export type ConceptPick<C extends string> = { concept: C; returning: boolean };

/** Everything the engine needs from a building's content. */
export type ShiftContent<C extends string, I> = {
  /** Concepts in their "day one" teaching order. */
  concepts: readonly C[];
  /** Which concepts each of the first days adds. */
  unlockOrder: readonly (readonly C[])[];
  /** A concept every shift includes once, so there is always one easy win. */
  easy: C;
  /** Tickets in shift `number`. */
  size: (number: number) => number;
  /** How many tickets of one concept a shift may hold (default 2). */
  maxPerShift?: Partial<Record<C, number>>;
  conceptNotes: Record<C, ConceptNote>;
  proofQuestions: readonly ProofQuestion<C>[];
  /** Turns the ordered picks into tickets (people, items). Must only use `random` for variation. */
  tickets: (picks: readonly ConceptPick<C>[], number: number, random: () => number) => ShiftTicket<C, I>[];
};

/** One routed item. `cost` is the follow-up minutes it created; `counts` are pack-specific tallies (e.g. falseNotFound). */
export type Decision = { ticketId: string; correct: boolean; cost: number; counts?: Readonly<Record<string, number>> };

export type ConceptRecord = { box: number; lastShift: number; seen: number; correct: number };
export type ShiftRecord<C extends string = string> = {
  /** Unique per record so saves from two devices merge: the date for a counted shift, a practice-… id otherwise. */
  id: string;
  number: number;
  date: string;
  practice?: boolean;
  served: number;
  correct: number;
  callbackMinutes: number;
  counts?: Record<string, number>;
  missed: C[];
  proof: Record<string, boolean>;
};
export type ShiftState<C extends string = string> = { version: 1; shifts: ShiftRecord<C>[]; concepts: Partial<Record<C, ConceptRecord>> };

export function emptyShiftState<C extends string = string>(): ShiftState<C> {
  return { version: 1, shifts: [], concepts: {} };
}

const reviewGap = [0, 1, 2, 4];

export function unlockedConcepts<C extends string>(content: { unlockOrder: readonly (readonly C[])[] }, shift: number): C[] {
  return content.unlockOrder.slice(0, Math.max(1, Math.min(shift, content.unlockOrder.length))).flat();
}

export function dueConcepts<C extends string>(state: ShiftState<C>, shift: number): C[] {
  return (Object.entries(state.concepts) as [C, ConceptRecord][])
    .filter(([, record]) => shift - record.lastShift >= reviewGap[Math.min(record.box, reviewGap.length - 1)])
    .sort((left, right) => left[1].box - right[1].box || left[1].lastShift - right[1].lastShift)
    .map(([concept]) => concept);
}

export function planShift<C extends string, I>(content: ShiftContent<C, I>, state: ShiftState<C>, number: number, seed = number): ShiftPlan<C, I> {
  const random = rng(seed * 7919 + 17);
  const unlocked = unlockedConcepts(content, number);
  const introduces = (content.unlockOrder[number - 1] ?? []).filter((concept) => !state.concepts[concept]);
  const missedLast = new Set(completedShifts(state).at(-1)?.missed ?? []);
  const due = dueConcepts(state, number).filter((concept) => unlocked.includes(concept));
  const size = content.size(number);
  const limit = (concept: C) => content.maxPerShift?.[concept] ?? 2;
  const picks: ConceptPick<C>[] = [];
  for (const concept of [...missedLast]) if (picks.length < 2 && unlocked.includes(concept)) picks.push({ concept, returning: true });
  for (const concept of introduces) if (!picks.some((pick) => pick.concept === concept)) picks.push({ concept, returning: false });
  for (const concept of due) if (picks.length < size - 1 && !picks.some((pick) => pick.concept === concept)) picks.push({ concept, returning: false });
  // Always one easy win, then fill with a varied mix.
  if (!picks.some(({ concept }) => concept === content.easy)) picks.push({ concept: content.easy, returning: false });
  while (picks.length < size) {
    const options = unlocked.filter((concept) => picks.filter((pick) => pick.concept === concept).length < limit(concept));
    if (!options.length) break;
    picks.push({ concept: options[Math.floor(random() * options.length)], returning: false });
  }
  // Day one opens gently in teaching order; later days are mixed, with returning tickets first.
  const rank = (concept: C) => content.concepts.indexOf(concept);
  const ordered = number === 1
    ? [...picks].sort((a, b) => rank(a.concept) - rank(b.concept))
    : shuffle(picks, random).sort((a, b) => Number(b.returning) - Number(a.returning));
  return { number, tickets: content.tickets(ordered.slice(0, size), number, random), introduces };
}

// ---- Outcome --------------------------------------------------------------------------------

export function recordShift<C extends string, I>(state: ShiftState<C>, plan: ShiftPlan<C, I>, decisions: readonly Decision[],
  proof: Record<string, boolean>, date: string, practice = false, id?: string): ShiftState<C> {
  const byTicket = new Map<string, Decision[]>();
  for (const decision of decisions) byTicket.set(decision.ticketId, [...(byTicket.get(decision.ticketId) ?? []), decision]);
  const results = plan.tickets.map((ticket) => {
    const made = byTicket.get(ticket.id) ?? [];
    return { ticket, correct: made.length > 0 && made.every(({ correct }) => correct) };
  });
  const counts: Record<string, number> = {};
  for (const decision of decisions) for (const [key, value] of Object.entries(decision.counts ?? {})) counts[key] = (counts[key] ?? 0) + value;
  const record: ShiftRecord<C> = {
    id: id ?? (practice ? `practice-${date}-${Math.random().toString(36).slice(2, 8)}` : date),
    number: plan.number, date, practice: practice || undefined, served: results.length,
    correct: results.filter(({ correct }) => correct).length,
    callbackMinutes: decisions.reduce((sum, { cost }) => sum + cost, 0),
    counts,
    missed: [...new Set(results.filter(({ correct }) => !correct).map(({ ticket }) => ticket.concept))], proof,
  };
  if (practice) return { ...state, shifts: [...state.shifts, record] };
  // One step on the review schedule per concept per shift: up a box only if every ticket of it went right.
  const concepts = { ...state.concepts };
  const today = new Map<C, { seen: number; correct: number }>();
  for (const { ticket, correct } of results) {
    const entry = today.get(ticket.concept) ?? { seen: 0, correct: 0 };
    today.set(ticket.concept, { seen: entry.seen + 1, correct: entry.correct + Number(correct) });
  }
  for (const [concept, { seen, correct }] of today) {
    const previous = concepts[concept] ?? { box: 0, lastShift: 0, seen: 0, correct: 0 };
    concepts[concept] = {
      box: correct === seen ? Math.min(previous.box + 1, 3) : 0,
      lastShift: plan.number, seen: previous.seen + seen, correct: previous.correct + correct,
    };
  }
  return { ...state, shifts: [...state.shifts, record], concepts };
}

/** Two exam-style questions: first on what went wrong today, then on what is newest. */
export function proofFor<C extends string, I>(content: ShiftContent<C, I>, state: ShiftState<C>, plan: ShiftPlan<C, I>, missed: readonly C[]): ProofQuestion<C>[] {
  const answered = new Set(state.shifts.flatMap(({ proof }) => Object.keys(proof)));
  const today = new Set<string>(plan.tickets.map(({ concept }) => concept));
  const introduced = new Set<string>(plan.introduces);
  const known = new Set<string>(content.concepts);
  // Missed today first, then skills new today, then today's other skills, then general items.
  const priority = (concept: string) =>
    (missed as readonly string[]).includes(concept) ? 0 : introduced.has(concept) ? 2 : today.has(concept) ? 4 : !known.has(concept) ? 6 : 8;
  const score = (question: ProofQuestion<C>) => priority(question.concept) + (answered.has(question.id) ? 20 : 0);
  return [...content.proofQuestions].sort((left, right) => score(left) - score(right) || left.id.localeCompare(right.id)).slice(0, 2);
}

export function completedShifts<C extends string>(state: ShiftState<C>) {
  return state.shifts.filter(({ practice }) => !practice);
}

export function nextShiftNumber(state: ShiftState) {
  return completedShifts(state).length + 1;
}

export function localDate(now = Date.now()) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** One counted shift per calendar day, FarmVille-style; practice runs are always open. */
export function shiftAvailableToday(state: ShiftState, now = Date.now()) {
  return !completedShifts(state).some(({ date }) => date === localDate(now));
}

export function streak(state: ShiftState, now = Date.now()) {
  const days = new Set(completedShifts(state).map(({ date }) => date));
  let count = 0;
  const cursor = new Date(now);
  if (!days.has(localDate(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDate(cursor.getTime()))) { count++; cursor.setDate(cursor.getDate() - 1); }
  return count;
}

/**
 * The concepts the next counted shift will review: yesterday's misses and anything due on the spaced schedule, or the
 * day-one set for a newcomer. Empty once today's shift is done.
 */
export function upcomingConcepts<C extends string, I>(content: ShiftContent<C, I>, state: ShiftState<C>, now = Date.now()): C[] {
  if (!shiftAvailableToday(state, now)) return [];
  const number = nextShiftNumber(state);
  const unlocked = unlockedConcepts(content, number);
  const missed = (completedShifts(state).at(-1)?.missed ?? []).filter((concept) => unlocked.includes(concept));
  const due = dueConcepts(state, number).filter((concept) => unlocked.includes(concept));
  const introduces = (content.unlockOrder[number - 1] ?? []).filter((concept) => !state.concepts[concept]);
  return [...new Set([...missed, ...due, ...introduces])];
}

// ---- Deterministic helpers ------------------------------------------------------------------

export function rng(seed: number) {
  let value = (seed * 2654435761) >>> 0 || 1;
  return () => {
    value ^= value << 13; value >>>= 0;
    value ^= value >>> 17;
    value ^= value << 5; value >>>= 0;
    return value / 4294967296;
  };
}

export function shuffle<T>(values: readonly T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const pick = Math.floor(random() * (index + 1));
    [result[index], result[pick]] = [result[pick], result[index]];
  }
  return result;
}
