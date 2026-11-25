const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const source = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(result.outputText, file);
};

const data = new Map();
const events = new EventTarget();
global.window = {
  localStorage: {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  },
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
  dispatchEvent: events.dispatchEvent.bind(events),
};
const { mergeProgressValues, fitsProgressSave } = require("../lib/progress-merge.ts");
const { readProgressItem, setProgressUser, writeProgressItem, readAccountSave, storeAccountSave } = require("../lib/progress-storage.ts");
const { makeProgressBackup, parseProgressBackup, recoveryCopies, rememberRecovery, restoreProgressBackup, activateRecovery } = require("../lib/progress-recovery.ts");
const key = "certcity.practice.CCDV-F.2026-07.v1";
const readiness = "certcity.practice.CCDV-F.readiness.v1";
const base = JSON.stringify({ attempts: [], draft: { id: "A", answers: {}, index: 0 }, seen: ["q1"] });
const phone = JSON.stringify({ attempts: [], draft: { id: "A", answers: { q1: ["a"] }, index: 1 }, seen: ["q1", "q2"] });
const laptop = JSON.stringify({ attempts: [], draft: { id: "A", answers: { q2: ["b"] }, index: 2 }, seen: ["q1", "q3"] });

async function checkCloudSync() {
  const userId = "sync-fixture";
  let cloud = { save_key: key, payload: laptop, revision: 4 };
  const client = { from(table) {
    let update;
    let expected;
    return {
      select() { return this; },
      update(value) { update = value; return this; },
      eq(field, value) { if (field === "revision") expected = value; return this; },
      order() { return this; },
      limit() { return this; },
      abortSignal() { return this; },
      maybeSingle() { return Promise.resolve({ data: null }); },
      then(resolve) {
        if (table !== "learner_progress") return resolve({ data: null });
        if (!update) return resolve({ data: [cloud] });
        if (!cloud || expected !== cloud.revision) return resolve({ data: [] });
        cloud = { ...cloud, ...update };
        return resolve({ data: [{ revision: cloud.revision }] });
      },
    };
  } };
  const clientPath = require.resolve("../lib/supabase/client.ts");
  require.cache[clientPath] = { exports: { getSupabase: () => client } };
  const { syncProgress, resolveProgressConflict } = require("../lib/supabase/progress.ts");
  setProgressUser(userId);
  storeAccountSave(userId, key, { value: phone, pending: { base } });
  assert.deepEqual(await syncProgress(userId, new AbortController().signal), { conflicts: [], retry: false });
  assert.deepEqual(JSON.parse(cloud.payload).draft.answers, { q1: ["a"], q2: ["b"] });
  assert.equal(cloud.revision, 5);
  assert.equal(readAccountSave(userId, key).pending, undefined);

  const choiceA = cloud.payload.replace('"q1":["a"]', '"q1":["c"]');
  const choiceB = cloud.payload.replace('"q1":["a"]', '"q1":["d"]');
  storeAccountSave(userId, key, { value: choiceA, pending: { base: cloud.payload } });
  cloud = { ...cloud, payload: choiceB, revision: 6 };
  const { conflicts } = await syncProgress(userId, new AbortController().signal);
  assert.equal(conflicts.length, 1);
  assert.equal(resolveProgressConflict(userId, conflicts[0], false), true);
  assert.equal(readAccountSave(userId, key).value, choiceB);
  assert.deepEqual(new Set(recoveryCopies().map(({ value }) => value)), new Set([choiceA, choiceB]));
}

async function verify() {
  const result = JSON.parse(mergeProgressValues(key, base, phone, laptop));
  assert.deepEqual(result.draft.answers, { q1: ["a"], q2: ["b"] });
  assert.deepEqual(result.seen, ["q1", "q2", "q3"]);
  assert.equal(result.draft.index, 2);
  assert.equal(mergeProgressValues(key, base, phone, laptop.replace('"q2":["b"]', '"q1":["b"]')), null);
  const recorded = {
    attempts: [{ id: "B", mode: "assessment", snapshotId: "form-B" }], draft: null,
    seen: ["q1", "q4"], rehearsalArchives: { "form-B": { deliverable: 2 } },
  };
  const second = {
    attempts: [{ id: "C", mode: "assessment", snapshotId: "form-C" }], draft: null,
    seen: ["q3", "q4"], rehearsalArchives: { "form-C": { deliverable: 3 } },
  };
  const combined = JSON.parse(mergeProgressValues(key, null, JSON.stringify(recorded), JSON.stringify(second)));
  assert.deepEqual(combined.attempts.map(({ id }) => id), ["B", "C"]);
  assert.deepEqual(Object.keys(combined.rehearsalArchives), ["form-B", "form-C"]);
  assert.deepEqual(combined.seen, ["q1", "q4", "q3"]);
  assert.equal(mergeProgressValues("certcity.city.active-assignment.v1", null, "architect-foundations", "developer-foundations"), null);
  assert.deepEqual(JSON.parse(mergeProgressValues(readiness, null,
    JSON.stringify({ guide: ["1.1"], workshop: false, capstones: [{ id: "pass" }] }),
    JSON.stringify({ guide: ["2.1"], workshop: true, capstones: [{ id: "week" }] }))),
    { guide: ["1.1", "2.1"], workshop: true, capstones: [{ id: "pass" }, { id: "week" }] });

  writeProgressItem(key, phone);
  assert.ok(rememberRecovery([{ key, value: laptop }]));
  const first = recoveryCopies()[0];
  const exported = makeProgressBackup();
  assert.equal(exported.entries.length, 1);
  assert.equal(exported.copies.length, 1);
  assert.ok(await activateRecovery(first));
  assert.equal(readProgressItem(key), laptop);
  assert.ok(recoveryCopies().some(({ value }) => value === phone), "restore preserves the previous copy");

  // 1.1 million two-byte characters: under the cap in characters, over it in bytes.
  const extra = JSON.stringify({ outcome: "é".repeat(1_100_000) });
  assert.equal(fitsProgressSave(extra), false, "the database cap is measured in bytes");
  assert.ok(parseProgressBackup(JSON.stringify({ ...exported, entries: [{ key, value: extra }] })), "oversize saves can be backed up");
  assert.equal(parseProgressBackup(JSON.stringify({ ...exported, entries: [{ key: "unrelated.auth", value: "ignored" }] })), null);

  setProgressUser("other-account");
  assert.equal(readProgressItem(key), null);
  assert.equal(recoveryCopies().length, 0);
  assert.equal(await activateRecovery(first), false, "recovery is scoped to the account");
  const imported = await restoreProgressBackup(parseProgressBackup(JSON.stringify(exported)));
  assert.equal(imported.restored, 2);
  assert.deepEqual(JSON.parse(readProgressItem(key)).draft.answers, { q1: ["a"], q2: ["b"] });
  assert.equal(recoveryCopies().length, 0);
  await checkCloudSync();
  console.log("Progress merge, conflicting drafts, versioned archives, account isolation and backup recovery passed.");
}

verify().catch((error) => { console.error(error); process.exitCode = 1; });
