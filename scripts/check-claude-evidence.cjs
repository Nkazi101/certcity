const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, file);
};

const { tracks } = require("../lib/claude/blueprints.ts");
const { rehearsalItems } = require("../lib/claude/assessment/forms.ts");
const { decemberBlueprint, decemberVersion, rehearsalBlueprint } = require("../lib/claude/december-blueprints.ts");
const { createRehearsalSnapshot, packRehearsalSnapshot, unpackRehearsalSnapshot, validRehearsalSnapshot } = require("../lib/claude/rehearsal-snapshot.ts");
const { createSession, score, sessionItems } = require("../lib/claude/practice.ts");
const { emptyProgress, progressKey, readProgress, updateProgress } = require("../lib/claude/progress.ts");
const { emptyReadiness, readReadiness, updateReadiness } = require("../lib/claude/readiness.ts");
const { readAccountSave, setProgressUser } = require("../lib/progress-storage.ts");
const { getCapstoneDefinition, scoreCapstone, validCapstoneAttempt, validNewCapstoneAttempt } = require("../lib/claude/capstones/index.ts");
const { solved } = require("./check-claude-capstones.cjs");

const roundTrip = (value) => JSON.parse(JSON.stringify(value));
const earlier = "july-2026";
const forms = ["original", "retest"];
let verifiedForms = 0;
for (const track of tracks) {
  let bytes = 0;
  for (const version of decemberBlueprint(track) ? [earlier, decemberVersion] : [earlier]) {
    for (const form of forms) {
      const published = rehearsalItems(track.id, version, form);
      const current = createRehearsalSnapshot(track, version, form, published);
      const saved = roundTrip(current);
      assert.ok(validRehearsalSnapshot(saved, track, version, form), `${track.code} ${version} ${form}`);
      const packed = roundTrip(packRehearsalSnapshot(saved));
      assert.deepEqual(unpackRehearsalSnapshot(packed), saved);
      assert.deepEqual(unpackRehearsalSnapshot(saved), saved);
      assert.equal(unpackRehearsalSnapshot({ ...packed, data: [0, 99_999, null] }), null);
      assert.ok(Buffer.byteLength(JSON.stringify(packed)) < Buffer.byteLength(JSON.stringify(saved)));
      assert.deepEqual(saved.items.map(({ id, options, correct }) => ({ id, options, correct })),
        published.map(({ id, options, correct }) => ({ id, options, correct })));
      assert.ok(!validRehearsalSnapshot(saved, track, version, forms.find((key) => key !== form)));
      assert.ok(!validRehearsalSnapshot({ ...saved, minutes: current.minutes + 1 }, track, version, form));
      saved.items[0].options.reverse();
      assert.ok(!validRehearsalSnapshot(saved, track, version, form));
      bytes += Buffer.byteLength(JSON.stringify(current));
      verifiedForms++;
    }
  }
  assert.ok(bytes < 524_288, `${track.code} unique authored form snapshots exceed storage bound`);
}

const firstTrack = tracks[0];
const original = rehearsalItems(firstTrack.id, earlier, "original");
const [item, ...rest] = original;
const previousKey = item.options.find(([key]) => !item.correct.includes(key))[0];
const priorContent = [{ ...item, prompt: "Archival fixture with the delivered prompt", correct: [previousKey], explanation: "Original evidence note." }, ...rest];
const snapshot = roundTrip(createRehearsalSnapshot(firstTrack, earlier, "original", priorContent));
const rehearsal = { mode: "assessment", itemIds: original.map(({ id }) => id), version: earlier, form: "original", snapshot };
assert.ok(validRehearsalSnapshot(snapshot, firstTrack, earlier, "original"));
const archivedItems = sessionItems(firstTrack, rehearsal);
assert.equal(archivedItems[0].prompt, priorContent[0].prompt);
assert.equal(archivedItems[0].explanation, priorContent[0].explanation);
assert.equal(score(archivedItems, { [item.id]: [previousKey] }), 1);
assert.equal(score(sessionItems(firstTrack, { ...rehearsal, snapshot: undefined }), { [item.id]: [previousKey] }), 0);

const domain = firstTrack.domains[0].id;
const domainItems = original.filter(({ objective }) => objective.startsWith(`${domain}.`)).slice(0, 3);
const scoped = roundTrip(createRehearsalSnapshot(firstTrack, earlier, undefined, domainItems, domain, 15));
assert.ok(validRehearsalSnapshot(scoped, firstTrack, earlier, undefined, domain));
assert.ok(!validRehearsalSnapshot(scoped, firstTrack, earlier));

function exhaustiveArchive(track, version, allArchives, attempts) {
  const seen = new Set();
  function add(mode, domain, form) {
    const attempt = createSession(track, mode, domain, true, [], 10_000, seen, version, form);
    if (!attempt.snapshot) return false;
    const { snapshot, ...metadata } = attempt;
    assert.ok(validRehearsalSnapshot(snapshot, track, version, metadata.form, domain), `${track.code} ${mode} archive`);
    const freshItems = snapshot.items.filter(({ id }) => !seen.has(id));
    assert.ok(freshItems.length, `${track.code} ${mode} should consume fresh items within one blueprint`);
    allArchives[snapshot.id] = snapshot;
    for (const { id } of snapshot.items) seen.add(id);
    attempts.push({ ...metadata, snapshotId: snapshot.id, submittedAt: 20_000,
      answers: Object.fromEntries(snapshot.items.map(({ id, correct }) => [id, correct])) });
    return true;
  }
  for (const form of ["original", "retest", "recovery"]) add("assessment", null, form);
  for (const { id } of rehearsalBlueprint(track, version).domains) {
    while (add("reassessment", id)) {
      // Each trial consumes fresh question IDs and cannot be selected again.
    }
  }
}

const archiveSizes = tracks.map((track) => {
  const rehearsalArchives = {};
  const attempts = [];
  for (const version of decemberBlueprint(track) ? [earlier, decemberVersion] : [earlier]) {
    exhaustiveArchive(track, version, rehearsalArchives, attempts);
  }
  const raw = Buffer.byteLength(JSON.stringify({ rehearsalArchives, attempts }));
  const packedArchives = Object.fromEntries(Object.entries(rehearsalArchives).map(([id, archive]) => [id, packRehearsalSnapshot(archive)]));
  const packed = Buffer.byteLength(JSON.stringify({ rehearsalArchives: packedArchives, attempts }));
  assert.ok(packed < raw, track.code);
  return { track: track.code, raw, packed };
});
const originallyOversize = archiveSizes.filter(({ raw }) => raw > 524_288);
assert.ok(originallyOversize.length > 0, "current archives exercise the account row limit");
assert.ok(originallyOversize.every(({ packed }) => packed <= 524_288), JSON.stringify(archiveSizes));

for (const [track, version, stage, draft] of solved) {
  const definition = getCapstoneDefinition(track, version, stage);
  const attempt = roundTrip({ ...scoreCapstone(track, version, stage, draft), id: definition.id, submittedAt: 100 });
  assert.ok(validCapstoneAttempt(attempt));
  assert.ok(validNewCapstoneAttempt(attempt));
  const priorTitle = definition.title;
  const priorDocument = definition.documents[0].text;
  const priorCriterion = definition.criteria[0].title;
  try {
    definition.title = "Rewritten exercise";
    definition.documents[0].text = "New source text.";
    definition.criteria[0].title = "Rewritten review criterion";
    assert.ok(validCapstoneAttempt(attempt), `${definition.id} archived history is independent of later wording`);
    assert.ok(!validNewCapstoneAttempt(attempt), `${definition.id} later submissions must match live case`);
    assert.notEqual(attempt.snapshot.title, definition.title);
    assert.notEqual(attempt.snapshot.documents[0].text, definition.documents[0].text);
    assert.notEqual(attempt.results[0].title, definition.criteria[0].title);
    const { snapshot: _archive, ...legacy } = attempt;
    assert.ok(validCapstoneAttempt(legacy), `${definition.id} legacy history still loads after a copy edit`);
  } finally {
    definition.title = priorTitle;
    definition.documents[0].text = priorDocument;
    definition.criteria[0].title = priorCriterion;
  }
  assert.ok(!validCapstoneAttempt({ ...attempt, snapshot: { ...attempt.snapshot, title: "Modified accepted record" } }));
  assert.ok(!validCapstoneAttempt({ ...attempt, results: [{ ...attempt.results[0], detail: "Modified evidence" }, ...attempt.results.slice(1)] }));
}

async function checkPersistence() {
  const memory = new Map();
  global.window = {
    dispatchEvent() {},
    localStorage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
    },
  };
  const userId = "evidence-test";
  const key = progressKey(firstTrack);
  try {
    setProgressUser(userId);
    for (let repeat = 0; repeat < 2; repeat++) {
      const progress = readProgress(firstTrack) ?? emptyProgress;
      const draft = createSession(firstTrack, "assessment", null, true, progress.attempts, Date.now(), progress.seen, earlier, "original");
      const started = await updateProgress(firstTrack, progress, { type: "start", draft });
      assert.equal(started.error, null);
      assert.equal(readProgress(firstTrack).draft.snapshot.id, draft.snapshot.id);
      const submitted = await updateProgress(firstTrack, started.progress, { type: "submit", id: draft.id });
      assert.equal(submitted.error, null);
    }
    const account = readAccountSave(userId, key);
    const payload = JSON.parse(account.value);
    assert.equal(payload.attempts.length, 2);
    assert.equal(Object.keys(payload.rehearsalArchives).length, 1);
    assert.equal(payload.attempts[0].snapshotId, payload.attempts[1].snapshotId);
    assert.equal(payload.attempts[0].snapshot, undefined);
    assert.equal(payload.rehearsalArchives[payload.attempts[0].snapshotId].encoding, 1);
    const stored = readProgress(firstTrack);
    assert.deepEqual(stored.attempts.map(({ snapshot }) => snapshot.id), payload.attempts.map(({ snapshotId }) => snapshotId));
    const readinessDraft = solved.find(([track, version, stage]) =>
      track === firstTrack.id && version === earlier && stage === "capstone")[3];
    const practical = {
      ...scoreCapstone(firstTrack.id, earlier, "capstone", readinessDraft),
      id: "account-practical-archive-test", submittedAt: Date.now(),
    };
    const accepted = await updateReadiness(firstTrack, emptyReadiness, { type: "submission", attempt: practical });
    assert.equal(accepted.saved, true);
    assert.equal(accepted.error, null);
    assert.deepEqual(readReadiness(firstTrack).capstones, [roundTrip(practical)]);
  } finally {
    setProgressUser(null);
    delete global.window;
  }
}

checkPersistence().then(() => {
  console.log(`${verifiedForms} rehearsal and ${solved.length} practical archives passed round-trip, validation, editorial-change, and account storage checks.`);
  console.log(archiveSizes.map(({ track, raw, packed }) => `${track} ${raw} → ${packed} bytes`).join(" · "));
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
