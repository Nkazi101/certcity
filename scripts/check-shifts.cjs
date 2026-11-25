// Checks Maplewood School's front-office shift (routing rules, desk papers, spaced return, daily gating, proof items),
// the shift registry and status API used by "today's work", and the 3D room layouts' basic geometry.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, file);
};

const shifts = require("../lib/shifts/engine.ts");
const front = require("../lib/shifts/front-office.ts");
const registry = require("../lib/shifts/index.ts");
const { routes, conceptNotes, proofQuestions, frontOfficeContent: content, frontOfficeScenarios: scenarios } = front;

// ---- Every kind of draft has exactly one right tray; wrong trays describe a symptom, never the fix. -----------------
const routeIds = routes.map(({ id }) => id);
const concepts = content.concepts;
assert.deepEqual(new Set(concepts), new Set(Object.keys(conceptNotes)));
for (const concept of concepts) {
  const scenario = scenarios.find(({ truth }) => truth === concept);
  assert.ok(scenario, `a scenario for ${concept}`);
  const draft = { ...scenario.draft, id: "d", truth: concept };
  const right = front.correctRoute(draft);
  for (const route of routeIds) {
    const result = front.consequence(draft, route);
    assert.equal(result.correct, route === right, `${concept} → ${route}`);
    if (result.correct) continue;
    assert.ok(result.callbackMinutes > 0, `${route} on ${concept} costs a call back`);
    const fixLabel = routes.find(({ id }) => id === right).label.toLowerCase();
    assert.ok(!result.text.toLowerCase().includes(fixLabel), `symptom text names the fix: ${result.text}`);
    // Sending an unchecked claim (or an undecided exception) is what puts a wrong answer in a family's hands.
    if (route === "send") assert.equal(result.wrongSent, true, `${concept} sent as written reaches the family wrong`);
  }
}
for (const route of routeIds) assert.ok(routes.find(({ id }) => id === route).label.length <= 32, "tray labels fit a phone tray");

// ---- The papers on the desk actually support each verdict. --------------------------------------------------------
const values = (text) => text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b|\b\d{1,2}(?::\d\d)? [ap]\.m\./g) ?? [];
const families = new Set();
for (const { truth, customer, line, draft } of scenarios) {
  assert.ok(!families.has(customer), `${customer} appears once`); families.add(customer);
  assert.ok(line.trim().endsWith("?") || line.trim().endsWith("."), customer);
  assert.ok(customer.startsWith(draft.to + " "), `${customer}'s draft is addressed to them`);
  const signed = draft.papers.filter(({ signed }) => signed).map(({ text }) => text).join(" ");
  const unsigned = draft.papers.filter(({ signed }) => !signed).map(({ text }) => text).join(" ");
  const claimed = values(draft.sentence);
  if (truth === "supported") for (const value of claimed) assert.ok(signed.includes(value), `${customer}: a signed paper states ${value}`);
  if (truth === "supported" && !claimed.length) assert.ok(signed.toLowerCase().includes(draft.sentence.toLowerCase().replace(/\.$/, "").split(" ").slice(-3).join(" ")), `${customer}: the signed paper states it`);
  if (truth === "incorrect" || truth === "outdated") {
    assert.ok(draft.fix && signed.includes(draft.fix), `${customer}: the fix ${draft.fix} comes from a signed paper`);
    for (const value of claimed) assert.ok(!signed.includes(value), `${customer}: no signed paper states ${value}`);
  }
  if (truth === "outdated") assert.ok(claimed.some((value) => unsigned.includes(value)) || /proposes|template/i.test(unsigned + draft.papers.map(({ title }) => title).join(" ")), `${customer}: an old or unsigned paper agrees with the draft`);
  if (truth === "unsupported" || truth === "draft-only") {
    assert.ok(claimed.length, `${customer}: the draft names a date`);
    for (const value of claimed) assert.ok(!signed.includes(value), `${customer}: no signed paper gives ${value}`);
    assert.ok(/not set|no reopening day|once staffing|will confirm/i.test(signed), `${customer}: the signed paper says the date isn't set`);
  }
  if (truth === "unsupported") assert.ok(!unsigned, `${customer}: no unsigned paper either`);
  if (truth === "draft-only") assert.ok(claimed.some((value) => unsigned.includes(value)) || /June 2|November 1|September 8/.test(unsigned), `${customer}: only an unsigned paper gives the date`);
  if (truth === "decision") assert.ok(draft.papers.some(({ text }) => /decided by Felicia Grant/.test(text)), `${customer}: the policy names Felicia`);
  if (truth === "decision") assert.ok(!draft.papers.some(({ title }) => /Decision note/.test(title)), `${customer}: nothing is decided yet`);
  if (truth === "decided") assert.ok(draft.papers.some(({ title, signed }) => signed && /signed by Felicia Grant/.test(title)), `${customer}: Felicia's signed note is on the desk`);
}
assert.ok(scenarios.every(({ draft }) => draft.papers.length >= 1 && draft.papers.length <= 3), "at most three papers per desk on a phone");

// ---- Day one is gentle, plans are deterministic, missed concepts come back first. ---------------------------------
const plan = (state, n, seed) => shifts.planShift(content, state, n, seed);
const first = plan(shifts.emptyShiftState(), 1);
assert.equal(first.tickets.length, 5);
assert.equal(first.tickets[0].concept, "supported");
assert.deepEqual([...first.introduces], ["supported", "incorrect", "unsupported", "decision"]);
assert.equal(JSON.stringify(plan(shifts.emptyShiftState(), 1)), JSON.stringify(first));

function play(day, miss = new Set()) {
  return day.tickets.flatMap((ticket) => ticket.items.map((draft) => {
    const route = miss.has(ticket.concept) ? (front.correctRoute(draft) === "send" ? "hold" : "send") : front.correctRoute(draft);
    const result = front.consequence(draft, route);
    return { ticketId: ticket.id, correct: result.correct, cost: result.callbackMinutes, counts: { wrongSent: Number(result.wrongSent) } };
  }));
}
let state = shifts.recordShift(shifts.emptyShiftState(), first, play(first, new Set(["decision"])), {}, "2026-11-25");
assert.deepEqual(state.shifts[0].missed, ["decision"]);
assert.equal(state.shifts[0].counts.wrongSent, first.tickets.filter(({ concept }) => concept === "decision").length);
{
  // A concept seen twice in one shift moves one box on the schedule, not two.
  const twice = first.tickets.map((ticket) => ticket.concept).find((concept, index, all) => all.indexOf(concept) !== index);
  if (twice) assert.equal(shifts.recordShift(shifts.emptyShiftState(), first, play(first), {}, "2026-11-25").concepts[twice].box, 1);
}
const second = plan(state, 2);
assert.equal(second.tickets[0].concept, "decision");
assert.equal(second.tickets[0].returning, true);
assert.deepEqual([...second.introduces], ["outdated", "draft-only"]);
assert.equal(shifts.shiftAvailableToday(state, new Date(2026, 10, 25, 18).getTime()), false, "one counted shift per day");
assert.equal(shifts.shiftAvailableToday(state, new Date(2026, 10, 26, 8).getTime()), true);
state = shifts.recordShift(state, second, play(second), {}, "2026-11-26");
assert.ok(plan(state, 3).tickets.some(({ concept }) => concept === "decided"), "signed decisions arrive on shift three");
for (let n = 3; n <= 14; n++) {
  const day = plan(state, n);
  assert.equal(new Set(day.tickets.map(({ customer }) => customer)).size, day.tickets.length, "each family once per shift");
  assert.ok(day.tickets.some(({ concept }) => concept === "supported"), "every shift has a draft to send as written");
  assert.ok(day.tickets.every(({ concept }) => day.tickets.filter((ticket) => ticket.concept === concept).length <= 2));
  state = shifts.recordShift(state, day, play(day), {}, `2026-12-${String(n).padStart(2, "0")}`);
}
const practice = shifts.recordShift(state, plan(state, 15, 7), play(plan(state, 15, 7)), {}, "2026-12-14", true);
assert.equal(shifts.nextShiftNumber(practice), shifts.nextShiftNumber(state), "practice shifts don't count");
assert.deepEqual(practice.concepts, state.concepts, "practice shifts don't move the review schedule");

// ---- Proof items: well formed, unique, not guessable from length. --------------------------------------------------
function checkProof(items, label) {
  const ids = new Set();
  let keyLongest = 0;
  for (const question of items) {
    assert.ok(!ids.has(question.id)); ids.add(question.id);
    assert.ok(question.prompt.trim().endsWith("?"), question.id);
    assert.equal(question.options.length, 4, question.id);
    assert.ok(question.options.some(([key]) => key === question.correct), question.id);
    assert.ok(question.options.every(([, text, rationale]) => text && rationale && rationale.split(/\s+/).length >= 12), `${question.id} rationales`);
    const words = question.explanation.split(/\s+/).length;
    assert.ok(words >= 30 && words <= 60, `${question.id} explanation ${words} words`);
    const lengths = question.options.map(([, text]) => text.length);
    if (lengths[question.options.findIndex(([key]) => key === question.correct)] === Math.max(...lengths)) keyLongest++;
    assert.ok(Math.max(...lengths) / Math.min(...lengths) <= 1.35, `${question.id} option lengths are uneven`);
    assert.ok(/^\d\.\d$/.test(question.objective), question.id);
  }
  assert.ok(keyLongest / items.length <= 0.4, `${label}: the key is the longest option in ${keyLongest} of ${items.length}`);
  assert.equal(new Set(items.map(({ correct }) => correct)).size, 4, `${label}: keys use every letter`);
}
checkProof(proofQuestions, "front office");
for (const concept of concepts) {
  if (concept === "outdated" || concept === "unsupported" || concept === "decision" || concept === "decided" || concept === "draft-only" || concept === "supported" || concept === "incorrect") {
    assert.ok(proofQuestions.some((question) => question.concept === concept), `a proof item for ${concept}`);
  }
}
const proof = shifts.proofFor(content, shifts.emptyShiftState(), first, ["unsupported"]);
assert.equal(proof.length, 2);
assert.equal(proof[0].concept, "unsupported", "a concept missed today is asked first");

// ---- Plain, specific language (research/ai-slop-audit.md). ---------------------------------------------------------
const source = fs.readFileSync(path.join(__dirname, "../lib/shifts/front-office.ts"), "utf8");
const strings = source.match(/"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g).join(" ");
assert.ok(!/—/.test(strings), "no em dashes in front-office copy");
assert.ok(!/\b(unlock|seamless|leverage|elevate|journey|robust|empower|delve)\b/i.test(strings), "no buzzwords in front-office copy");
assert.ok(/Jordan/.test(source) && /Felicia Grant/.test(source), "uses the school's existing people");

// ---- Registry and the "today's work" status API. ------------------------------------------------------------------
assert.deepEqual(registry.shiftsForTrack("associate-foundations").map(({ id }) => id), ["front-office"]);
assert.deepEqual(registry.shiftsForTrack("architect-foundations").map(({ id }) => id), ["dispatch"]);
assert.deepEqual(registry.shiftsForTrack("developer-foundations"), []);
assert.equal(registry.shiftInfo["front-office"].openHref, "/?shift=front-office");
assert.equal(registry.shiftInfo.dispatch.openHref, "/?shift=dispatch");
assert.ok(registry.isShiftId("front-office") && !registry.isShiftId("library"));
const noon = (day) => new Date(2026, 10, day, 12).getTime();
const fresh = registry.statusFromState("front-office", shifts.emptyShiftState(), noon(25));
assert.deepEqual({ ...fresh, dueLessons: undefined }, { id: "front-office", availableToday: true, doneToday: false, streak: 0, completed: 0,
  dueObjectives: ["2.3", "2.4"], dueLessons: undefined, openHref: "/?shift=front-office" });
assert.deepEqual(fresh.dueLessons, ["2.2", "2.3"], "lab objectives map to the current guide's lessons");
const afterOne = shifts.recordShift(shifts.emptyShiftState(), first, play(first, new Set(["decision"])), {}, "2026-11-25");
const sameDay = registry.statusFromState("front-office", afterOne, noon(25));
assert.equal(sameDay.doneToday, true);
assert.equal(sameDay.availableToday, false);
assert.equal(sameDay.streak, 1);
assert.deepEqual(sameDay.dueObjectives, []);
const nextDay = registry.statusFromState("front-office", afterOne, noon(26));
assert.equal(nextDay.availableToday, true);
assert.ok(nextDay.dueObjectives.includes("2.4"), "yesterday's missed exception comes back");
const dispatchFresh = registry.statusFromState("dispatch", shifts.emptyShiftState(), noon(25));
assert.deepEqual(dispatchFresh.dueObjectives, ["2.2"]);
assert.deepEqual(dispatchFresh.dueLessons, ["2.2"]);
assert.equal(registry.shiftStatus("dispatch").availableToday, true, "outside a browser, status reads an empty state");

// ---- Room layouts: every walking point is on the room floor, and the line never overlaps the bench. ----------------
function layoutFrom(file, name) {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  const start = text.indexOf(`const ${name}`) >= 0 ? text.indexOf(`const ${name}`) : text.indexOf(`export const ${name}`);
  assert.ok(start >= 0, `${name} in ${file}`);
  return text.slice(start, text.indexOf("\n};", start));
}
for (const [file, name, bounds] of [["../lib/scene/depot-shift.ts", "depotReactionLayout", [-7.6, 7.6, -4.9, 8.2]], ["../lib/scene/mission-interior.ts", "schoolReactionLayout", [-7.5, 7.5, -4.9, 6.5]]]) {
  const text = layoutFrom(file, name);
  const slots = [...text.match(/slots: \[(.*)\],/)[1].matchAll(/\[(-?[\d.a-z]+), (-?[\d.]+)\]/g)];
  assert.ok(slots.length >= 6, `${name} has room for a full line`);
  for (const [, x, z] of [...text.matchAll(/\[(-?\d*\.?\d+), (-?\d*\.?\d+)\]/g)]) {
    assert.ok(+x >= bounds[0] && +x <= bounds[1] && +z >= bounds[2] && +z <= bounds[3], `${name}: point ${x}, ${z} is inside the room`);
  }
}

console.log(`Front office shift · ${concepts.length} concepts × ${routeIds.length} trays · ${scenarios.length} desks, spaced return, daily gating and ${proofQuestions.length} proof items checked; shift registry, status API and room layouts checked.`);
