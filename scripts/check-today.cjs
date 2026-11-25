// Checks today's work (lib/today), city cases counting toward ready, synced study keys and the row-by-row table editor.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = require.extensions[".tsx"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  module._compile(outputText, file);
};
// CSS modules are irrelevant here.
require.extensions[".css"] = (module) => { module.exports = new Proxy({}, { get: (_, key) => String(key) }); };

const root = path.join(__dirname, "..");
const { planToday, dailyMinutes, rankMissions } = require(path.join(root, "lib/today/plan.ts"));
const { todayStreak, localDay } = require(path.join(root, "lib/today/state.ts"));
const { tracks } = require(path.join(root, "lib/claude/blueprints.ts"));
const { missionsFor } = require(path.join(root, "lib/claude/pathway.ts"));
const { cityEvidence } = require(path.join(root, "lib/claude/readiness.ts"));
const { isProgressKey } = require(path.join(root, "lib/progress-storage.ts"));
const { parseTable, formatTable, columnChoices } = require(path.join(root, "components/academy/table-rows.tsx"));

const now = new Date(2026, 10, 25, 12).getTime();
const day = 86_400_000;
const associate = tracks.find(({ id }) => id === "associate-foundations");
const missions = missionsFor(associate.id);
const starter = missions.find(({ kind }) => kind === "original");
const base = {
  track: associate, now, examDate: null, daysLeft: null, missions, records: {}, legacy: new Set(), starterDone: false, dateAsked: false,
  exam: { taken: false, met: false, weakDomains: [], confirmationNeeded: false },
  lab: { passed: false, transferDue: null, transferPassed: false },
  city: { domains: associate.domains.map(({ id, title }) => ({ id, title, applied: 0 })) }, applied: new Set(), shifts: [],
};
const names = {};

// A new learner: the starter case leads, nothing is a lesson, no date means a steady ~25 minutes.
let plan = planToday(base, names);
assert.equal(plan.today[0].key, `case:${starter.id}`, "the starter case comes first");
assert.ok(plan.today.every(({ kind }) => kind !== "exam"), "no practice exam before any cases");
assert.equal(plan.budget, 25);
assert.ok(plan.today.every(({ label }) => !/lesson/i.test(label)), "reading is never assigned");

// After the starter, the date is asked in the story once; dismissing it stops the question.
const afterStarter = { ...base, starterDone: true, legacy: new Set([starter.id]) };
plan = planToday(afterStarter, names);
assert.equal(plan.today[0].kind, "date");
assert.ok(!planToday({ ...afterStarter, dateAsked: true }, names).today.some(({ kind }) => kind === "date"));
assert.ok(!plan.today.some(({ key }) => key === `case:${starter.id}`), "finished cases leave the plan");

// An exam date paces the day; a close exam asks for more per day than a far one.
const far = dailyMinutes({ ...afterStarter, examDate: "2027-03-01", daysLeft: 96 });
const near = dailyMinutes({ ...afterStarter, examDate: "2026-12-05", daysLeft: 10 });
assert.ok(near > far, `near ${near} > far ${far}`);
assert.ok(far >= 15 && near <= 150);

// The practice exam arrives once ~40% of cases are done, or when the exam is close.
const doneMost = new Set(missions.slice(0, Math.ceil(missions.length * 0.4)).map(({ id }) => id));
const examPlan = planToday({ ...afterStarter, dateAsked: true, legacy: doneMost, starterDone: true }, names);
assert.ok([...examPlan.today, ...examPlan.more].some(({ kind }) => kind === "exam"), "practice exam offered at 40%");
assert.ok(planToday({ ...afterStarter, dateAsked: true, examDate: "2026-12-01", daysLeft: 6 }, names).today.concat([]).length > 0);
const closePlan = planToday({ ...afterStarter, dateAsked: true, examDate: "2026-12-01", daysLeft: 6 }, names);
assert.ok([...closePlan.today, ...closePlan.more].some(({ kind }) => kind === "exam"), "a close exam brings the practice exam forward");

// After the practice exam: weak areas get review, then the lab; a due 7-day lab and 7-day checks show up.
const reviewed = planToday({ ...afterStarter, dateAsked: true, exam: { taken: true, met: false, weakDomains: [{ id: 2, title: "Output Evaluation" }], confirmationNeeded: false } }, names);
assert.ok([...reviewed.today, ...reviewed.more].some(({ key }) => key === "review:2"));
assert.ok([...reviewed.today, ...reviewed.more].some(({ kind }) => kind === "lab"));
const followRecords = { [starter.id]: { check: { answers: {}, priorExposure: [], submittedAt: now - 8 * day } } };
assert.ok(planToday({ ...afterStarter, dateAsked: true, records: followRecords }, names).today.some(({ kind }) => kind === "followup"), "due 7-day checks come first");
const transfer = planToday({ ...afterStarter, dateAsked: true, exam: { taken: true, met: true, weakDomains: [], confirmationNeeded: false }, lab: { passed: true, transferDue: now - day, transferPassed: false } }, names);
assert.ok([...transfer.today, ...transfer.more].some(({ kind }) => kind === "transfer"));

// Weak and uncovered areas move their cases up; suggested order never hides a case.
const ranked = rankMissions({ ...afterStarter, exam: { ...base.exam, taken: true, weakDomains: [{ id: 7, title: "Troubleshooting" }] } });
assert.equal(ranked.length, missions.length - 1, "every unfinished case stays offered");

// Shifts ride along as review.
const withShift = planToday({ ...afterStarter, dateAsked: true, shifts: [{ id: "front-office", title: "Today’s shift", place: "school", href: "/?shift=front-office", availableToday: true, doneToday: false, played: 2, minutes: 8 }] }, names);
assert.ok(withShift.today.some(({ kind }) => kind === "shift"));
const firstShift = planToday({ ...base, shifts: [{ id: "front-office", title: "Today’s shift", place: "school", href: "/?shift=front-office", availableToday: true, doneToday: false, played: 0, minutes: 8 }] }, names);
assert.equal(firstShift.today[0].key, `case:${starter.id}`, "a first shift waits until after the starter case");

// Streak: consecutive days with something finished.
const id = (offset) => localDay(now - offset * day);
assert.equal(todayStreak({ days: [{ id: id(0), items: [], done: ["a"] }, { id: id(1), items: [], done: ["b"] }, { id: id(3), items: [], done: ["c"] }] }, now), 2);
assert.equal(todayStreak({ days: [{ id: id(1), items: [], done: ["b"] }, { id: id(2), items: [], done: ["c"] }] }, now), 2, "today not started yet keeps yesterday's streak");
assert.equal(todayStreak({ days: [{ id: id(0), items: [], done: [] }] }, now), 0);

// City cases count toward ready: every covered area needs one objective applied on your own.
const city = cityEvidence(associate, new Set(["2.3"]), new Set(["2.3", "4.1"]));
assert.equal(city.met, false);
assert.deepEqual(city.domains.map(({ id }) => id), [2, 4]);
assert.equal(cityEvidence(associate, new Set(["2.3", "4.1"]), new Set(["2.3", "4.1"])).met, true);

// Study progress follows the learner: new keys sync, odd keys don't.
for (const key of ["certcity.exam-date.v2.associate-foundations", "certcity.lessons.v2.architect-foundations", "certcity.today.v1.developer-foundations", "certcity.shift.v1.front-office"]) {
  assert.ok(isProgressKey(key), key);
}
assert.ok(!isProgressKey("certcity.today.v1.Associate"), "track ids are lowercase");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261125180000_synced_study_keys.sql"), "utf8");
assert.ok(migration.includes("exam-date\\.v2|lessons\\.v2|today\\.v1|shift\\.v1"), "the database accepts the same keys");

// Row-by-row editing writes the same markdown table and reads verdict choices from the file's instruction.
const sample = "# Reply check\n\n| Reply | Claim | Source | Verdict | Fix |\n|---|---|---|---|---|\n| Avery | Close May 19 | Template | Supported | — |\n\nNotes after";
const table = parseTable(sample);
assert.deepEqual(table.header, ["Reply", "Claim", "Source", "Verdict", "Fix"]);
assert.equal(table.rows.length, 1);
const edited = formatTable({ ...table, rows: [...table.rows, ["Cameron", "Wing | reopens", "Bulletin", "Unsupported", "Say not set"]] });
assert.ok(edited.startsWith("# Reply check") && edited.endsWith("Notes after"));
assert.equal(parseTable(edited).rows[1][1], "Wing / reopens", "a pipe typed in a cell can't break the table");
assert.deepEqual(columnChoices("One row per claim. Verdict: supported, incorrect, unsupported, or needs decision.", "Verdict"),
  ["Supported", "Incorrect", "Unsupported", "Needs decision"]);
assert.equal(parseTable("no table here"), null);

console.log("Today's work · pacing, milestones, review, streaks, city evidence, synced keys and row editing checked.");
