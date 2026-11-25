// Checks the City Dispatch daily shift: routing rules, spaced return of missed skills, daily gating and proof items.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, file);
};

const shifts = require("../lib/shifts/engine.ts");
const dispatch = require("../lib/shifts/dispatch.ts");
const { proofQuestions, routes, conceptNotes, dispatchContent: content } = dispatch;
// The dispatch rules plus the shared day engine, bound to this pack (the names the checks were written against).
const engine = {
  ...dispatch, ...shifts,
  emptyShiftState: shifts.emptyShiftState(),
  unlockedConcepts: (n) => shifts.unlockedConcepts(content, n),
  planShift: (state, n, seed) => shifts.planShift(content, state, n, seed),
  proofFor: (state, plan, missed) => shifts.proofFor(content, state, plan, missed),
};

const routeIds = routes.map(({ id }) => id);
const outcomes = [
  { outcome: "found", attempt: 0 }, { outcome: "empty", attempt: 0 }, { outcome: "timeout", attempt: 0, next: "found" },
  { outcome: "timeout", attempt: 1 }, { outcome: "invalid", attempt: 0 }, { outcome: "denied", attempt: 0 },
];

// Every outcome has exactly one right chute, and wrong chutes describe a symptom, never the fix.
for (const shape of outcomes) {
  const lookup = { callId: "toolu_TEST", orderId: "T-17", status: "Out for delivery", ...shape };
  const right = engine.correctRoute(lookup);
  for (const route of routeIds) {
    const result = engine.consequence(lookup, route);
    assert.equal(result.correct, route === right, `${shape.outcome}/${shape.attempt} → ${route}`);
    if (!result.correct) {
      assert.ok(result.callbackMinutes > 0, `${route} on ${shape.outcome} costs time`);
      const fixLabel = routes.find(({ id }) => id === right).label.toLowerCase();
      assert.ok(!result.text.toLowerCase().includes(fixLabel), `symptom text names the fix: ${result.text}`);
    }
  }
  assert.ok(engine.parcelFields(lookup).some(([field]) => field === "isError"), "parcels show isError");
}
const retried = engine.consequence({ callId: "toolu_X", orderId: "T-1", outcome: "timeout", attempt: 0, next: "timeout" }, "retry");
assert.equal(retried.follow.attempt, 1);
assert.equal(engine.correctRoute(retried.follow), "handoff", "a failed retry hands off");
assert.equal(engine.consequence({ callId: "toolu_X", orderId: "T-1", outcome: "timeout", attempt: 0 }, "no-match").falseNotFound, true);

// Day one is gentle, plans are deterministic, and skills unlock over three shifts.
const first = engine.planShift(engine.emptyShiftState, 1);
assert.equal(first.tickets.length, 5);
assert.equal(first.tickets[0].concept, "found");
assert.deepEqual([...first.introduces], ["found", "empty", "retry", "validation"]);
assert.deepEqual(JSON.stringify(engine.planShift(engine.emptyShiftState, 1)), JSON.stringify(first));
assert.ok(first.tickets.every(({ concept }) => engine.unlockedConcepts(1).includes(concept)));

// Play day one perfectly except the validation ticket; it must come back first on day two.
function play(plan, miss = new Set()) {
  const decisions = [];
  for (const ticket of plan.tickets) {
    for (const lookup of ticket.items) {
      if (ticket.kind === "pair") { decisions.push({ ticketId: ticket.id, correct: !miss.has(ticket.concept), cost: miss.has(ticket.concept) ? 3 : 0 }); continue; }
      const route = miss.has(ticket.concept) ? "no-match" : engine.correctRoute(lookup);
      const result = engine.consequence(lookup, route);
      decisions.push({ ticketId: ticket.id, correct: result.correct, cost: result.callbackMinutes, counts: { falseNotFound: Number(result.falseNotFound) } });
      if (result.follow) decisions.push({ ticketId: ticket.id, correct: true, cost: 0 });
    }
  }
  return decisions;
}
let state = engine.recordShift(engine.emptyShiftState, first, play(first, new Set(["validation"])), {}, "2026-11-25");
assert.deepEqual(state.shifts[0].missed, ["validation"]);
assert.equal(state.shifts[0].id, "2026-11-25", "a counted shift is keyed by its date");
assert.ok(state.shifts[0].callbackMinutes > 0 && state.shifts[0].counts.falseNotFound === 1, "a validation ticket sent as no match costs a callback and a false not found");
assert.equal(state.concepts.validation.box, 0);
const second = engine.planShift(state, 2);
assert.equal(second.tickets[0].concept, "validation");
assert.equal(second.tickets[0].returning, true);
assert.deepEqual([...second.introduces], ["handoff", "permission"]);
assert.equal(engine.shiftAvailableToday(state, new Date(2026, 10, 25, 18).getTime()), false, "one counted shift per day");
assert.equal(engine.shiftAvailableToday(state, new Date(2026, 10, 26, 8).getTime()), true);

state = engine.recordShift(state, second, play(second), {}, "2026-11-26");
const third = engine.planShift(state, 3);
assert.ok(third.tickets.some(({ concept }) => concept === "pairing"), "pairing unlocks on shift three");
for (let n = 3; n <= 12; n++) {
  const plan = engine.planShift(state, n);
  assert.ok(plan.tickets.filter(({ concept }) => concept === "pairing").length <= 1, "at most one pairing ticket");
  assert.ok(plan.tickets.some(({ concept }) => concept === "found"), "every shift has an easy win");
  state = engine.recordShift(state, plan, play(plan), {}, `2026-12-${String(n).padStart(2, "0")}`);
}
assert.equal(engine.streak(state, new Date(2026, 11, 12, 12).getTime()), 10);
const practice = engine.recordShift(state, engine.planShift(state, 13, 99), play(engine.planShift(state, 13, 99)), {}, "2026-12-12", true);
assert.equal(engine.nextShiftNumber(practice), engine.nextShiftNumber(state), "practice shifts don't count");
assert.deepEqual(practice.concepts, state.concepts, "practice shifts don't move the review schedule");
assert.ok(practice.shifts.at(-1).id.startsWith("practice-"), "practice records get their own ids");

// Customers written for one situation only appear in that situation.
const reservedFor = { "Marcus Webb": "permission", "Omar Haddad": "pairing", "Grace Kim": "validation" };
for (let n = 1; n <= 12; n++) {
  for (const ticket of engine.planShift(engine.emptyShiftState, n, n * 31).tickets) {
    if (reservedFor[ticket.customer]) assert.equal(ticket.concept, reservedFor[ticket.customer], `${ticket.customer} on a ${ticket.concept} ticket`);
  }
}

// The 3D queue empties only when no tickets or callbacks remain.
assert.equal(engine.depotWorkload(0, 0), 0);
assert.equal(engine.depotWorkload(6, 0), 16);
assert.equal(engine.depotWorkload(0, 1), 4);

// Proof items: well formed, unique, and not guessable from length.
const ids = new Set();
let keyLongest = 0;
for (const question of proofQuestions) {
  assert.ok(!ids.has(question.id)); ids.add(question.id);
  assert.ok(question.prompt.trim().endsWith("?"), question.id);
  assert.equal(question.options.length, 4, question.id);
  assert.ok(question.options.some(([key]) => key === question.correct), question.id);
  assert.ok(question.options.every(([, text, rationale]) => text && rationale && rationale.split(/\s+/).length >= 12), question.id);
  const words = question.explanation.split(/\s+/).length;
  assert.ok(words >= 30 && words <= 60, `${question.id} explanation ${words} words`);
  const lengths = question.options.map(([, text]) => text.length);
  if (lengths[question.options.findIndex(([key]) => key === question.correct)] === Math.max(...lengths)) keyLongest++;
  assert.ok(Math.max(...lengths) / Math.min(...lengths) <= 1.35, `${question.id} option lengths are uneven`);
}
assert.ok(keyLongest / proofQuestions.length <= 0.4, `the key is the longest option in ${keyLongest} of ${proofQuestions.length}`);
assert.equal(new Set(proofQuestions.map(({ correct }) => correct)).size, 4, "keys use every letter");
const proof = engine.proofFor(engine.emptyShiftState, first, ["retry"]);
assert.equal(proof.length, 2);
assert.equal(proof[0].concept, "retry", "a skill missed today is asked first");
assert.ok(Object.values(conceptNotes).every(({ objective }) => /^\d\.\d$/.test(objective)));

// Saves from before the generalization (certcity.dispatch-shift.v1) still read: ids are added, falseNotFound moves to counts.
const { parseShiftState, legacyShiftKeys, shiftStorageKey } = require("../lib/shifts/storage.ts");
assert.equal(legacyShiftKeys.dispatch, "certcity.dispatch-shift.v1");
assert.equal(shiftStorageKey("dispatch"), "certcity.shift.v1.dispatch");
const legacy = { version: 1, concepts: { validation: { box: 0, lastShift: 1, seen: 1, correct: 0 } }, shifts: [
  { number: 1, date: "2026-11-20", served: 5, correct: 4, callbackMinutes: 6, falseNotFound: 1, missed: ["validation"], proof: { "shift-q-retry": true } },
  { number: 2, date: "2026-11-20", practice: true, served: 6, correct: 6, callbackMinutes: 0, falseNotFound: 0, missed: [], proof: {} },
] };
const migrated = parseShiftState(JSON.parse(JSON.stringify(legacy)));
assert.deepEqual(migrated.shifts.map(({ id }) => id), ["2026-11-20", "practice-2026-11-20-2"]);
assert.equal(migrated.shifts[0].counts.falseNotFound, 1);
assert.equal(engine.planShift(migrated, engine.nextShiftNumber(migrated)).tickets[0].concept, "validation", "a migrated miss still comes back first");
assert.equal(parseShiftState(JSON.parse(JSON.stringify(migrated))).shifts[0].id, "2026-11-20", "the new shape reads back unchanged");
assert.equal(parseShiftState([]), null);
assert.equal(parseShiftState({ version: 2, shifts: [], concepts: {} }), null);

console.log(`City Dispatch shift · ${outcomes.length} outcomes × ${routeIds.length} chutes · spaced return, daily gating, streaks and ${proofQuestions.length} proof items checked.`);
