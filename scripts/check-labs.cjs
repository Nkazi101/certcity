// Learn-by-doing lab checks (lib/labs). Each mission must be honest about what it grades:
// references pass, starters fail per objective, mutants fail exactly what they target, sample-hard-coded work fails the
// transfer, gaming probes fail, runs are deterministic, symptoms never name the fix, and progress saves round-trip.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, file);
};

const { labMissions, labFor } = require("../lib/labs/index.ts");
const { runLab, starterFiles, transferVariants, failedChecks, pickVariant, labIndependent } = require("../lib/labs/run.ts");
const { capstoneFieldLimit } = require("../lib/claude/capstones/model.ts");
const { providers } = require("../lib/certifications/providers.ts");
const { tracks } = require("../lib/claude/blueprints.ts");
const { lessonObjectives } = require("../lib/claude/lessons/paths.ts");
const { missionMappings } = require("../lib/claude/missions.ts");
const pathway = require("../lib/claude/pathway.ts");
const { caseworkFor } = require("../lib/claude/cases/index.ts");

const failedSet = (run) => new Set(failedChecks(run));
const tokens = (value) => new Set((String(value).match(/[A-Za-z_][A-Za-z0-9_|.-]{3,}/g) ?? []).map((token) => token.replace(/[.-]+$/, "")));
const sameSet = (left, right) => left.size === right.size && [...left].every((value) => right.has(value));
let runs = 0;
let mutants = 0;
let probes = 0;

function run(mission, files, set, variant) {
  runs++;
  return runLab(mission, files, set, variant);
}

function checkMission(mission) {
  const label = mission.id;
  const portfolioMission = pathway.portfolio.find(({ id }) => id === mission.id);
  assert.ok(portfolioMission, `${label}: lab id must match a city mission`);
  assert.equal(portfolioMission.track, mission.track, `${label}: track`);
  assert.ok(providers.some(({ id }) => id === mission.provider), `${label}: provider`);
  assert.equal(mission.live, undefined, `${label}: live mode is not built`);

  // Objectives: kept from the mission's mapping, each in the track blueprint, each with a check, and every check claims one of them.
  const mapped = new Set(missionMappings(portfolioMission).map(({ objective }) => objective));
  const track = tracks.find(({ id }) => id === mission.track);
  const known = new Set([...track.domains.flatMap((domain) => domain.objectives.map((_, index) => `${domain.id}.${index + 1}`)),
    ...lessonObjectives(track).map(({ id }) => id)]);
  for (const objective of mission.objectives) {
    assert.ok(mapped.has(objective), `${label}: ${objective} is not in the mission's objective mapping`);
    assert.ok(known.has(objective), `${label}: ${objective} is not in the ${track.id} blueprint`);
    assert.ok(mission.checks.some((check) => check.objective === objective), `${label}: objective ${objective} has no check`);
  }
  const casework = caseworkFor(mission.id);
  if (casework) assert.deepEqual([...mission.objectives].sort(), [...casework.objectives].sort(), `${label}: lab objectives must match the casework it replaces`);
  for (const check of mission.checks) {
    assert.ok(mission.objectives.includes(check.objective), `${label}: ${check.id} claims ${check.objective}`);
    for (const rung of ["nudge", "concept", "worked"]) assert.ok(check.hints[rung]?.length > 20, `${label}: ${check.id} ${rung} hint`);
    assert.ok(check.reveal.length > 10 && check.diagnosis.length > 40, `${label}: ${check.id} reveal/diagnosis`);
  }
  assert.equal(new Set(mission.checks.map(({ id }) => id)).size, mission.checks.length, `${label}: duplicate check ids`);

  // Files fit the editor.
  const limit = (artifact) => artifact.maxChars ?? capstoneFieldLimit;
  const variants = transferVariants(mission);
  assert.ok(variants.length >= 1, `${label}: needs a transfer variant`);
  assert.ok(mission.fixtures.some(({ set }) => set === "sample"), `${label}: needs a sample fixture`);
  for (const artifact of mission.artifacts) {
    assert.ok(artifact.starter.length <= limit(artifact), `${label}: starter ${artifact.path} is ${artifact.starter.length} chars`);
    for (const files of [mission.reference.sample, ...Object.values(mission.reference.transfer)]) {
      assert.ok(typeof files[artifact.id] === "string" && files[artifact.id].length <= limit(artifact), `${label}: reference ${artifact.path} size`);
    }
  }
  if (mission.transferMode === "revise") {
    for (const variant of variants) assert.ok(mission.transferDocuments?.[variant]?.length, `${label}: revise-mode variant ${variant} needs its case documents`);
  }

  // 1. The reference passes every sample and every transfer variant.
  const reference = run(mission, mission.reference.sample, "sample");
  assert.ok(reference.passed, `${label}: reference fails the sample: ${JSON.stringify(reference.results.filter(({ passed }) => !passed))}`);
  for (const variant of variants) {
    const files = mission.reference.transfer[variant];
    assert.ok(files, `${label}: no reference for variant ${variant}`);
    const outcome = run(mission, files, "transfer", variant);
    assert.ok(outcome.passed, `${label}: reference fails transfer ${variant}: ${JSON.stringify(outcome.results.filter(({ passed }) => !passed))}`);
    assert.ok(mission.checks.every(({ id }) => id in reference.checks || id in outcome.checks), `${label}: a check never applies`);
    if (mission.transferMode === "rerun") assert.deepEqual(files, mission.reference.sample, `${label}: rerun mode uses one set of files`);
  }

  // 2. The deployed starter fails at least one check for every objective.
  const starter = run(mission, starterFiles(mission), "sample");
  assert.ok(!starter.parseError, `${label}: the starter must parse so its failures are visible`);
  const starterFailed = failedSet(starter);
  for (const objective of mission.objectives) {
    assert.ok(mission.checks.some(({ id, objective: owner }) => owner === objective && starterFailed.has(id)), `${label}: starter passes every check for ${objective}`);
  }

  // 3. Mutants fail exactly their targeted checks.
  for (const mutant of mission.mutants) {
    mutants++;
    const base = mutant.set === "sample" ? mission.reference.sample : mission.reference.transfer[mutant.variant ?? variants[0]];
    const outcome = run(mission, mutant.edit(base), mutant.set, mutant.variant);
    assert.ok(!outcome.parseError, `${label}: mutant “${mutant.name}” does not parse`);
    assert.ok(sameSet(failedSet(outcome), new Set(mutant.mustFail)),
      `${label}: mutant “${mutant.name}” failed [${[...failedSet(outcome)]}] but targets [${mutant.mustFail}]`);
  }
  for (const check of mission.checks) {
    assert.ok(mission.mutants.some(({ mustFail }) => mustFail.includes(check.id)) || starterFailed.has(check.id), `${label}: nothing ever fails ${check.id}`);
  }

  // 4. A sample-hard-coded artifact passes the sample and fails every transfer variant.
  const overfit = mission.overfit ?? (mission.transferMode === "revise" ? mission.reference.sample : null);
  assert.ok(overfit, `${label}: rerun-mode labs need an overfit artifact`);
  assert.ok(run(mission, overfit, "sample").passed, `${label}: the overfit artifact must pass the sample`);
  for (const variant of variants) assert.ok(!run(mission, overfit, "transfer", variant).passed, `${label}: sample-hard-coded work passes transfer ${variant}`);

  // 5. Gaming probes: mission probes, plus empty and truncated files.
  for (const probe of mission.probes) {
    probes++;
    const base = probe.set === "sample" ? mission.reference.sample : mission.reference.transfer[probe.variant ?? variants[0]];
    const outcome = run(mission, probe.files(base), probe.set, probe.variant);
    assert.ok(!outcome.passed, `${label}: probe “${probe.name}” passes`);
    if (probe.mustFail !== "any") for (const id of probe.mustFail) assert.ok(failedSet(outcome).has(id), `${label}: probe “${probe.name}” should fail ${id}`);
  }
  const empty = Object.fromEntries(mission.artifacts.map(({ id }) => [id, ""]));
  const short = Object.fromEntries(mission.artifacts.map(({ id }) => [id, mission.reference.sample[id].slice(0, 60)]));
  for (const files of [empty, short]) {
    probes++;
    assert.ok(!run(mission, files, "sample").passed, `${label}: an empty or truncated artifact passes`);
  }

  // 6. Determinism: identical input gives an identical run, trace included.
  for (const files of [starterFiles(mission), mission.reference.sample]) {
    assert.equal(JSON.stringify(run(mission, files, "sample")), JSON.stringify(run(mission, files, "sample")), `${label}: runs are not deterministic`);
  }
  assert.equal(pickVariant(mission, 3, "x"), pickVariant(mission, 3, "x"));

  // 7. Symptoms never name the fix: no explicit fix term, and no token that only the reference contains.
  const visible = [JSON.stringify(starterFiles(mission)), JSON.stringify(mission.documents), JSON.stringify(mission.transferDocuments ?? {}),
    ...mission.artifacts.map(({ example }) => example ?? ""), JSON.stringify(mission.fixtures.map(({ input, situation, name }) => ({ input, situation, name })))].join("\n");
  const seen = tokens(visible);
  // Distinctive tokens only (values, identifiers, paths, placeholders); plain words are covered by the mission's fixTerms.
  const distinctive = (token) => /[0-9_${}|/]|[a-z][A-Z]/.test(token);
  const fixOnly = [...tokens(JSON.stringify([mission.reference.sample, ...Object.values(mission.reference.transfer)]))].filter((token) => distinctive(token) && !seen.has(token));
  const terms = [...(mission.fixTerms ?? []), ...fixOnly];
  if (process.env.LAB_DEBUG) console.log(label, "fix-only tokens:", terms.join(" "));
  const failing = [{ files: starterFiles(mission), outcome: starter }, ...mission.mutants.map((mutant) => {
    const files = mutant.edit(mutant.set === "sample" ? mission.reference.sample : mission.reference.transfer[mutant.variant ?? variants[0]]);
    return { files, outcome: run(mission, files, mutant.set, mutant.variant) };
  })];
  for (const { files, outcome } of failing) {
    // Quoting the learner's own file back is fine; naming something only the reference contains is not.
    const own = tokens(JSON.stringify(files));
    for (const { symptom, check } of outcome.results.filter(({ passed }) => !passed)) {
      const said = tokens(symptom);
      for (const term of mission.fixTerms ?? []) assert.ok(!symptom.includes(term), `${label}: ${check} symptom names the fix (“${term}”): ${symptom}`);
      for (const term of fixOnly.filter((term) => !own.has(term))) assert.ok(!said.has(term), `${label}: ${check} symptom names the fix (“${term}”): ${symptom}`);
    }
  }

  // 8. Traces stay readable on a phone.
  for (const outcome of [starter, reference]) {
    for (const { run: entry, fixture } of outcome.fixtures) assert.ok((entry?.trace.length ?? 0) <= 60, `${label}: ${fixture.id} trace too long`);
  }
  return { checks: mission.checks.length, variants: variants.length };
}

async function storageChecks() {
  const stored = new Map();
  global.window = { localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) } };
  global.localStorage = global.window.localStorage;
  for (const lab of Object.values(labMissions)) {
    const mission = pathway.portfolio.find(({ id }) => id === lab.id);
    const track = tracks.find(({ id }) => id === lab.track);
    const variant = transferVariants(lab)[0];
    const sample = lab.reference.sample;
    const transfer = lab.reference.transfer[variant];
    // Drafts round-trip; foreign files and oversized files are dropped on read.
    assert.ok((await pathway.saveLabDraft(mission, "sample", starterFiles(lab))).saved);
    assert.deepEqual(pathway.readPortfolio()[lab.id].lab.drafts.sample, starterFiles(lab));
    assert.equal(await pathway.saveLabDraft(mission, "sample", { "not-a-file": "x" }), null);
    // An outcome needs passing files.
    assert.equal(pathway.saveLabOutcome(mission, starterFiles(lab), transfer, variant), null);
    assert.equal(pathway.missionCompleted(mission, pathway.readPortfolio(), new Set()), false);
    // A worked example on one check makes that objective guided, not applied.
    const guidedCheck = lab.checks[0];
    await pathway.saveLabMastery(mission, (mastery) => ({ ...mastery, runs: 3, firstRunPassed: false, hints: { [guidedCheck.id]: 3 } }));
    assert.ok((await pathway.saveLabOutcome(mission, sample, transfer, variant)).saved);
    let records = pathway.readPortfolio();
    assert.ok(pathway.missionCompleted(mission, records, new Set()), `${lab.id}: a saved lab outcome completes the mission`);
    let evidence = pathway.portfolioEvidence(track, records, new Set());
    assert.ok(evidence.guided.has(guidedCheck.objective) && !evidence.applied.has(guidedCheck.objective), `${lab.id}: worked example → guided`);
    for (const objective of lab.objectives.filter((objective) => labIndependent(lab, records[lab.id].lab.mastery.credit, objective))) {
      assert.ok(evidence.applied.has(objective), `${lab.id}: ${objective} should be applied`);
    }
    // A fresh attempt keeps the outcome and its credit; a cleaner later save upgrades the credit.
    await pathway.startLabCycle(mission);
    records = pathway.readPortfolio();
    assert.equal(records[lab.id].lab.mastery.cycle, 1);
    assert.ok(records[lab.id].lab.outcome && pathway.missionCompleted(mission, records, new Set()));
    await pathway.saveLabMastery(mission, (mastery) => ({ ...mastery, runs: 2, firstRunPassed: true, hints: { [guidedCheck.id]: 1 } }));
    assert.ok((await pathway.saveLabOutcome(mission, sample, transfer, variant)).saved);
    evidence = pathway.portfolioEvidence(track, pathway.readPortfolio(), new Set());
    for (const objective of lab.objectives) assert.ok(evidence.applied.has(objective), `${lab.id}: ${objective} applied after a clean attempt`);
    // The city surfaces that still read station choices see a completed workbench.
    if (mission.kind === "workbench") assert.ok(pathway.readPortfolio()[lab.id].choices, `${lab.id}: completion bridge choices`);
    // A tampered outcome no longer counts.
    const key = pathway.missionStoragePrefix + lab.id;
    const saved = JSON.parse(stored.get(key) ?? [...stored.entries()].find(([entry]) => entry.endsWith(key))[1]);
    const raw = typeof saved.value === "string" ? JSON.parse(saved.value) : saved;
    const tampered = { lab: { ...raw.lab, outcome: { ...raw.lab.outcome, transfer: starterFiles(lab) } } };
    assert.equal(pathway.missionCompleted(mission, { [lab.id]: tampered }, new Set()), false, `${lab.id}: a tampered outcome must not count`);
  }
  // Old records keep working: a casework save on a lab mission still completes it and counts as before.
  const permit = pathway.portfolio.find(({ id }) => id === "permit-agent");
  const work = caseworkFor(permit.id);
  const { solvedCase } = require("../lib/claude/casework.ts");
  const legacy = { [permit.id]: { casework: solvedCase(work) } };
  assert.ok(pathway.missionCompleted(permit, legacy, new Set()), "a casework outcome on a lab mission stays complete");
  const developerTrack = tracks.find(({ id }) => id === permit.track);
  assert.ok(work.objectives.every((objective) => pathway.portfolioEvidence(developerTrack, legacy, new Set()).applied.has(objective)), "legacy casework credit is unchanged");
}

// A lab replaces its casework station, so the room around it has to describe the lab, not the older casework:
// the dock's directions and station name come from the lab, the lab's speaker is in the room, and every record ID
// the room's arrival line and people mention exists somewhere in the lab.
function checkRoomMatchesLab(lab) {
  const { workstationBrief, stationName } = require("../lib/claude/cases/presentation.ts");
  const { missionExperiences } = require("../lib/claude/mission-experiences.ts");
  const room = missionExperiences[lab.id];
  assert.ok(room, `${lab.id} has a room`);
  assert.equal(workstationBrief(lab.id), lab.brief, `${lab.id}: the room's directions come from the lab`);
  assert.equal(stationName(lab.id), lab.station.split(" · ")[0], `${lab.id}: the room names the lab's station`);
  assert.ok(room.interviews.some(({ name }) => name === lab.speaker), `${lab.id}: the lab's speaker ${lab.speaker} is in the room`);
  const source = JSON.stringify(lab, (_key, value) => typeof value === "function" ? String(value) : value);
  const said = [room.arrival, ...room.interviews.flatMap(({ opening, question, reply }) => [opening, question, reply])].join(" ");
  const ids = [...new Set(said.match(/\b(?:[A-Z]{1,5}-\d[\w-]*|[a-z]\d{2,4})\b/g) ?? [])];
  const stray = ids.filter((id) => !source.includes(id));
  assert.deepEqual(stray, [], `${lab.id}: the room mentions records the lab doesn't have: ${stray.join(", ")}`);
}

const summary = Object.values(labMissions).map(checkMission);
Object.values(labMissions).forEach(checkRoomMatchesLab);
assert.equal(labFor("no-such-mission"), undefined);
storageChecks().then(() => {
  console.log(`${summary.length} learn-by-doing labs (${Object.keys(labMissions).join(", ")}) · ${summary.reduce((total, { checks }) => total + checks, 0)} checks · ${mutants} mutants · ${probes} probes · ${runs} deterministic runs · references, starters, overfit, symptom-leak and save checks passed.`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
