const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

// Load the same TypeScript data and selector the static app uses.
require.extensions[".ts"] = (module, file) => {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(code.outputText, file);
};

const { examMinutes, tracks } = require("../lib/claude/blueprints.ts");
const { decemberBlueprint, decemberVersion } = require("../lib/claude/december-blueprints.ts");
const { rehearsalFormIds, rehearsalItems } = require("../lib/claude/assessment/forms.ts");
const { skillNote } = require("../lib/claude/skill-notes.ts");
const { runReference, referenceBaseline, runStream, streamBaseline, runRetrieval, retrievalBaseline } = require("../lib/claude/fieldwork.ts");
const { assignmentChoices, hasAssignmentWork, validAssignmentWork } = require("../lib/claude/assignment-work.ts");
const { caseworkFor, cityCasework } = require("../lib/claude/cases/index.ts");
const { workLayout } = require("../lib/claude/cases/layouts.ts");
const { caseworkPassed, replayCasework, startingCase, validCaseDraft } = require("../lib/claude/casework.ts");
const { places } = require("../lib/world.ts");
const { missionMappings, missionPassed, stationOptions } = require("../lib/claude/missions.ts");
const { acknowledgeReview, missingExpertise, missionCompleted, missionFollowupQuestions, missionPreparationSteps, missionQuestions, missionsFor, missionStoragePrefix, portfolio, portfolioEvidence, readPortfolio, saveCityCasework, saveMission, saveMissionDebrief, saveMissionDraft, saveMissionFollowup, saveMissionInterview, saveTransfer, unmetMissions } = require("../lib/claude/pathway.ts");
const { missionExperiences } = require("../lib/claude/mission-experiences.ts");
const { sources } = require("../lib/claude/items.ts");
const { banks, createSession, domainEvidence, followupDue, itemDomain, rehearsalForms, responseComplete, score, sessionItems } = require("../lib/claude/practice.ts");
const { emptyProgress, progressKey, readProgress, updateProgress } = require("../lib/claude/progress.ts");
const { assignments, isCityAssignment } = require("../lib/claude/assignments.ts");
const { cityChecks } = require("../lib/claude/city-checks.ts");
const { readCityAssignment, readCityCheck, saveCityAssignment, saveCityCheck } = require("../lib/claude/city-progress.ts");
const { dispatchPreparationSteps, emptyProgress: emptyDispatchProgress, updateCertification } = require("../lib/certification-progress.ts");
const { skillChecks } = require("../lib/exam-practice.ts");
const { objectiveCoverage } = require("../lib/claude/curriculum/index.ts");
const { associateStudy } = require("../lib/claude/curriculum/associate.ts");
const { developerStudy } = require("../lib/claude/curriculum/developer.ts");
const { professionalStudy } = require("../lib/claude/curriculum/professional.ts");
const { bridges } = require("../lib/claude/curriculum/bridges.ts");
const { capstoneEvidence, getCapstoneDefinition, initialCapstoneDraft, scoreCapstone, validCapstoneAttempt } = require("../lib/claude/capstones/index.ts");
const { benchmarkEvidence, emptyReadiness, readReadiness, readinessKey, timedEvidence, updateReadiness } = require("../lib/claude/readiness.ts");
const { isProgressKey } = require("../lib/progress-storage.ts");
const { solved } = require("./check-claude-capstones.cjs");

const ids = new Set();
const prompts = new Set();
const delayedIds = new Set();
assert.equal(tracks.length, 4);
for (const track of tracks) {
  const bank = banks[track.id];
  const objectives = track.domains.flatMap((domain) => domain.objectives.map((_, index) => `${domain.id}.${index + 1}`));
  assert.equal(track.domains.reduce((sum, domain) => sum + Math.round(domain.weight * 10), 0), 1000);
  assert.deepEqual(new Set(bank.practice.map((item) => item.objective)), new Set(objectives), `${track.code} objective coverage`);
  assert.deepEqual(new Set(bank.followup.map(itemDomain)), new Set(track.domains.map(({ id }) => id)), `${track.code} follow-up domains`);
  assert.ok(bank.followup.every(({ objective, scenario }) =>
    bank.practice.some((item) => item.objective === objective) &&
    !bank.practice.some((item) => item.scenario === scenario)), `${track.code} independent follow-up contexts`);
  const transfer = cityChecks[track.id] ?? [];
  assert.ok(transfer.every((entry) => objectives.includes(entry.objective) &&
    itemDomain(entry) === assignments[track.id].domain &&
    ![...bank.practice, ...bank.followup].some(({ scenario }) => scenario === entry.scenario)), track.code);
  for (const item of [...bank.practice, ...bank.followup, ...transfer]) {
    assert.ok(!ids.has(item.id), item.id);
    ids.add(item.id);
    assert.ok(!prompts.has(item.prompt), item.id);
    prompts.add(item.prompt);
    assert.ok(item.scenario && item.explanation && item.prompt.endsWith("?"), item.id);
    assert.ok(sources[item.source]?.[1].startsWith("https://"), item.id);
    assert.ok(item.correct.length === 1 || item.correct.length === 2, item.id);
    assert.equal(item.options.length, item.correct.length + 3, item.id);
    assert.equal(new Set(item.correct).size, item.correct.length, item.id);
    const options = item.options.map(([value]) => value);
    assert.ok(item.correct.every((key) => options.includes(key)), item.id);
    assert.equal(new Set(item.options.map(([, text]) => text)).size, item.options.length, item.id);
    assert.ok(options.every((key) => item.rationales[key]?.trim()), item.id);
    assert.equal(score([item], { [item.id]: [...item.correct].reverse() }), 1);
    assert.equal(score([item], { [item.id]: [options.find((option) => !item.correct.includes(option))] }), 0);
  }

  const session = createSession(track, "mixed", null, true, [], 10_000);
  const items = sessionItems(track, session);
  assert.equal(items.length, 12);
  assert.equal(new Set(items.map(itemDomain)).size, track.domains.length);
  assert.equal(score(items, {}), 0);
  assert.ok(session.deadline > session.startedAt);
  const attempt = { ...session, answers: Object.fromEntries(items.map((item) => [item.id, [...item.correct]])), submittedAt: 20_000 };
  assert.equal(followupDue([attempt]), 20_000 + 7 * 86400_000);
  assert.equal(domainEvidence(track, [attempt, { ...attempt, answers: {} }]).firstAnswers.size, 12);
  const nextItems = sessionItems(track, createSession(track, "mixed", null, false, [attempt], 30_000));
  assert.ok(nextItems.some((item) => !session.itemIds.includes(item.id)));
  assert.ok(items.every((item) => responseComplete(item, attempt.answers)));
  console.log(`${track.code} · ${bank.practice.length} practice, ${bank.followup.length} follow-up, ${objectives.length} objectives`);
}

function checkRehearsals() {
  const alternateIds = new Set();
  const alternatePrompts = new Set();
  for (const track of tracks) {
    const updated = decemberBlueprint(track);
    const versions = updated ? ["july-2026", decemberVersion] : ["july-2026"];
    const originalIds = new Set(versions.flatMap((version) => rehearsalItems(track.id, version).map(({ id }) => id)));
    const originalPrompts = new Set(versions.flatMap((version) => rehearsalItems(track.id, version).map(({ prompt }) => prompt)));
    const cityItems = [
      ...skillChecks.first.questions, ...skillChecks.followup.questions,
      ...missionsFor(track.id).flatMap((mission) => [...missionQuestions(mission), ...missionFollowupQuestions(mission)]),
    ];
    const cityIds = new Set(cityItems.map(({ id }) => id));
    const cityPrompts = new Set(cityItems.map(({ prompt }) => prompt));
    for (const version of versions) {
      const blueprint = version === decemberVersion ? updated : track;
      for (const label of rehearsalFormIds) {
        const form = rehearsalItems(track.id, version, label);
        const scored = form.filter(({ pilot }) => !pilot);
        const title = `${track.code} ${version} ${label}`;
        assert.equal(form.length, blueprint.count, `${title} item count`);
        assert.equal(scored.length, version === decemberVersion ? 60 : blueprint.count, title);
        const objectives = blueprint.domains.flatMap((domain) => domain.objectives.map((_, index) => `${domain.id}.${index + 1}`));
        assert.deepEqual(new Set(scored.map(({ objective }) => objective)), new Set(objectives), title);
        assert.equal(new Set(form.map(({ id }) => id)).size, form.length, title);
        assert.equal(new Set(form.map(({ prompt }) => prompt)).size, form.length, title);
        for (const [index, domain] of blueprint.domains.entries()) {
          const coverage = scored.filter((item) => itemDomain(item) === domain.id).length;
          if (version === decemberVersion) assert.equal(coverage, blueprint.scores[index], title);
          else assert.ok(Math.abs(coverage - domain.weight * scored.length / 100) <= 1.1, `${title} domain ${domain.id} weighting`);
        }
        const singleResponse = form.filter(({ correct }) => correct.length === 1);
        // A copyediting check. Guessing by any one length rank should not clear even half the single-response items.
        for (const width of [(answer) => answer.length, (answer) => answer.split(/\s+/).length]) {
          const ranks = [0, 0, 0, 0];
          for (const question of singleResponse) {
            const lengths = question.options.map(([key, answer]) => ({ key, length: width(answer) }));
            const correct = lengths.find(({ key }) => key === question.correct[0]).length;
            const lower = lengths.filter(({ length }) => length < correct).length;
            const ties = lengths.filter(({ length }) => length === correct).length;
            for (let i = lower; i < lower + ties; i++) ranks[i] += 1 / ties;
          }
          assert.ok(Math.max(...ranks) <= singleResponse.length / 2, `${title} answer length cue`);
        }
        if (label === "retest") {
          const keyCounts = ["a", "b", "c", "d"].map((key) => singleResponse.filter(({ correct }) => correct[0] === key).length);
          assert.ok(Math.max(...keyCounts) - Math.min(...keyCounts) <= 1, `${title} single-response positions`);
        }
        for (const question of form) {
          assert.ok(!ids.has(question.id), question.id);
          assert.ok(sources[question.source] && question.explanation && question.context && question.prompt.endsWith("?"), question.id);
          assert.equal(question.options.length, question.correct.length + 3, question.id);
          assert.ok(question.correct.every((key) => question.options.some(([option]) => option === key)), question.id);
          assert.equal(new Set(question.options.map(([, text]) => text)).size, question.options.length, question.id);
          if (label === "retest") {
            assert.ok(!originalIds.has(question.id) && !cityIds.has(question.id) && !alternateIds.has(question.id), question.id);
            assert.ok(!originalPrompts.has(question.prompt) && !cityPrompts.has(question.prompt) &&
              !prompts.has(question.prompt) && !alternatePrompts.has(question.prompt), question.id);
            alternateIds.add(question.id);
            alternatePrompts.add(question.prompt);
          }
        }
        const session = createSession(track, "assessment", null, false, [], 10_000, [], version, label);
        assert.equal(session.deadline, session.startedAt + examMinutes * 60_000);
        assert.deepEqual(sessionItems(track, session), form);
      }
    }
  }
}

function checkFieldwork() {
  const reference = {
    ...referenceBaseline, shared: true, shelves: { faq: "project", glossary: "project", old: "off", circulation: "off" },
    scope: "program", instructions: ["cite", "contact", "refer"],
  };
  const stream = { ...streamBaseline, decoder: "frames", bridge: "service", rules: "proof" };
  const retrieval = { ...retrievalBaseline, sections: true, activeOnly: true, match: "hybrid", rerank: "flagged", trace: "linked" };
  for (const [baseline, solution, run] of [
    [referenceBaseline, reference, runReference], [streamBaseline, stream, runStream], [retrievalBaseline, retrieval, runRetrieval],
  ]) {
    const mission = portfolio.find(({ id }) => id === solution.kind);
    assert.equal(validAssignmentWork(mission.id, solution), true);
    assert.equal(run(baseline).passes.every(Boolean), false, mission.id);
    assert.equal(run(solution).passes.every(Boolean), true, mission.id);
    assert.equal(missionPassed(mission, assignmentChoices(solution)), true, mission.id);
  }
  assert.equal(runReference({ ...reference, shelves: { ...reference.shelves, old: "project" } }).passes[4], false);
  assert.equal(runStream({ ...stream, decoder: "chunks" }).passes[0], false);
  assert.equal(runStream({ ...stream, decoder: "buffer" }).passes[1], false);
  assert.equal(runRetrieval({ ...retrieval, rerank: "all" }).passes[0], false);
  assert.equal(runRetrieval({ ...retrieval, activeOnly: false }).passes[4], false);
}

function checkPortfolios() {
  const ids = new Set();
  for (const track of tracks) {
    const missions = missionsFor(track.id);
    const objectives = track.domains.flatMap((domain) => domain.objectives.map((_, index) => `${domain.id}.${index + 1}`));
    const records = {};
    const reachable = new Set();
    const examKeys = new Set();
    while (reachable.size < missions.length) {
      const available = missions.filter((mission) => !reachable.has(mission.id) && !unmetMissions(mission, records, reachable).length);
      assert.ok(available.length, `${track.code} unlock graph is blocked`);
      for (const mission of available) {
        assert.ok(!ids.has(mission.id), mission.id);
        ids.add(mission.id);
        assert.ok(places.some(({ id }) => id === mission.place), mission.id);
        assert.ok((mission.requires ?? []).every((id) => missions.some((entry) => entry.id === id)), mission.id);
        assert.ok((mission.verify ?? []).every((objective) => missions.some((candidate) =>
          reachable.has(candidate.id) && missionMappings(candidate).some((entry) => entry.objective === objective))), mission.id);
        const mappings = missionMappings(mission);
        const questions = missionQuestions(mission);
        assert.equal(new Set(mappings.map(({ objective }) => objective)).size, mappings.length, mission.id);
        assert.ok(questions.every((question, i) => question?.objective === mappings[i].objective && sources[question.source]), mission.id);
        assert.ok(questions.every((question) => skillNote(track.id, question.objective)), mission.id);
        for (const question of questions) {
          assert.ok(!examKeys.has(question.id), `${mission.id} repeats ${question.id}`);
          examKeys.add(question.id);
        }
        if (mission.kind !== "dispatch") {
          const experience = missionExperiences[mission.id];
          assert.ok(experience, `${mission.id} has an interior experience`);
          assert.ok(experience.kind && experience.room.trim() && experience.arrival.trim(), `${mission.id} has a place-specific arrival`);
          assert.equal(experience.interviews.length, 2, `${mission.id} has two stakeholders`);
          assert.equal(new Set(experience.interviews.map(({ id }) => id)).size, 2, `${mission.id} has distinct stakeholder IDs`);
          assert.equal(new Set(experience.interviews.map(({ name }) => name)).size, 2, `${mission.id} has distinct stakeholder names`);
          for (const interview of experience.interviews) {
            assert.ok(interview.name.trim() && interview.role.trim() && interview.opening.trim() && interview.reply.trim(), `${mission.id} interview content`);
            assert.ok(interview.question.trim().endsWith("?"), `${mission.id} stakeholder question`);
          }
          const followups = missionFollowupQuestions(mission);
          assert.deepEqual(new Set(followups.map(itemDomain)),
            new Set(questions.map(itemDomain)), `${mission.id} held-out follow-up domain coverage`);
          for (const question of followups) {
            assert.ok(!ids.has(question.id) && !delayedIds.has(question.id), question.id);
            assert.ok(sources[question.source] && question.explanation && question.correct.every((key) =>
              question.options.some(([option]) => key === option)), question.id);
            delayedIds.add(question.id);
          }
        }
        if (mission.kind === "workbench") {
          for (const decision of mission.decisions) {
            const options = stationOptions(mission.id, decision).sort((a, b) => a.index - b.index);
            assert.deepEqual(options.map(({ index, ...option }) => option), decision.options, mission.id);
          }
          const defaults = Object.fromEntries(mission.decisions.map((decision) => [decision.objective, decision.combine ? [0, 2] : [0]]));
          const correct = Object.fromEntries(mission.decisions.map((decision) => [decision.objective, decision.options.flatMap(({ passed }, index) => passed ? [index] : [])]));
          assert.equal(missionPassed(mission, defaults), false, mission.id);
          assert.equal(missionPassed(mission, correct), true, mission.id);
          assert.ok(mission.decisions.every(({ options }) => options.every(({ trace }) => trace.trim().length)), mission.id);
          if (mission.simulate) {
            const alternatives = mission.decisions.reduce((sets, decision) => sets.flatMap((set) =>
              decision.options.map((_, index) => ({ ...set, [decision.objective]: [index] }))), [{}]);
            assert.equal(alternatives.filter((choices) => missionPassed(mission, choices)).length, 1, mission.id);
            assert.ok(mission.simulate(defaults).unresolved > mission.simulate(correct).unresolved, mission.id);
          }
        }
        reachable.add(mission.id);
      }
    }
    const evidence = portfolioEvidence(track, records, reachable);
    assert.deepEqual(evidence.applied, new Set(objectives), track.code);
    console.log(`${track.code} · ${missions.length} city missions and ${evidence.covered.size} playable objectives`);
  }
  assert.deepEqual(new Set(Object.keys(missionExperiences)), new Set(portfolio.filter(({ kind }) => kind !== "dispatch").map(({ id }) => id)),
    "every non-dispatch mission has exactly one authored interior experience");
}

function checkPreparation() {
  const revisedActivities = [associateStudy, developerStudy, professionalStudy].flat();
  assert.equal(revisedActivities.length, new Set(revisedActivities.map((entry) => entry[2])).size, "distinct guide cases");
  let guided = 0;
  const scenarios = new Set();
  for (const track of tracks) {
    const { checkpoints } = bridges[track.id];
    assert.equal(checkpoints.length, 3);
    assert.ok(checkpoints.every(({ choices, correct, source, why, tryNext }) =>
      choices[correct] && new Set(choices).size === choices.length && sources[source] && why && tryNext));
    assert.ok(isProgressKey(readinessKey(track)), "preparation progress syncs via the existing account cache");
    for (const version of decemberBlueprint(track) ? ["july-2026", decemberVersion] : ["july-2026"]) {
      const revised = version === decemberVersion;
      const coverage = objectiveCoverage(track, version).flatMap(({ skills }) => skills);
      if (revised) {
        assert.ok(coverage.every(({ id, activity, missions }) => activity?.[0] === id && activity.every(Boolean) && sources[activity[1]] && !missions.length), track.code);
        guided += coverage.length;
      } else assert.ok(coverage.every(({ missions }) => missions.length), track.code);
      const covered = new Set(coverage.map(({ id }) => id));
      for (const stage of ["capstone", "transfer"]) {
        const definition = getCapstoneDefinition(track.id, version, stage);
        assert.ok(!scenarios.has(definition.id), definition.id);
        scenarios.add(definition.id);
        assert.ok(definition.criteria.every((item) => (revised ? item.revisedObjectives ?? item.objectives : item.objectives).every((code) => covered.has(code))), definition.id);
        const result = { ...scoreCapstone(track.id, version, stage, initialCapstoneDraft(definition)), id: `${definition.id}-check`, submittedAt: 10_000 };
        assert.ok(validCapstoneAttempt(result), definition.id);
        assert.equal(result.passed, false, `${definition.id} cannot pass in its initial state`);
        assert.equal(validCapstoneAttempt({ ...result, passed: true }), false, definition.id);
        assert.equal(capstoneEvidence(track.id, version, [result], 200_000).transferDue, null);
      }
      const draft = createSession(track, "assessment", null, true, [], 10_000, [], version, "retest");
      const items = sessionItems(track, draft);
      const attempt = { ...draft, submittedAt: 20_000, answers: Object.fromEntries(items.map(({ id, correct }) => [id, correct])) };
      const [fresh] = timedEvidence(track, version, [attempt]);
      assert.ok(fresh?.fresh && fresh.met, track.code);
      assert.equal(fresh.total, revised ? 60 : track.count, "unscored questions excluded from benchmark");
      assert.equal(timedEvidence(track, version, [{ ...attempt, priorExposure: [items[0].id] }])[0].met, false, "reuse is review evidence");
      assert.equal(timedEvidence(track, version, [{ ...attempt, priorExposure: undefined }])[0].met, false, "legacy exposure remains unknown");
      assert.equal(timedEvidence(track, version, [{ ...attempt, deadline: null }])[0].met, false, "untimed results cannot meet the benchmark");
      assert.deepEqual(timedEvidence(track, version, [{ ...attempt, itemIds: attempt.itemIds.slice(1) }]), []);
      assert.equal(benchmarkEvidence(track, version, emptyReadiness, [attempt], 20_000).met, false, "one timed score alone cannot meet the benchmark");
      const due = 10_000 + 7 * 86_400_000;
      const capstones = solved.filter(([id, guide]) => id === track.id && guide === version).map(([id, guide, stage, artifact]) => ({
        ...scoreCapstone(id, guide, stage, artifact), id: `${id}-${stage}`, submittedAt: stage === "capstone" ? 10_000 : due,
      }));
      assert.equal(benchmarkEvidence(track, version, { ...emptyReadiness, capstones }, [attempt], due - 1).met, false, "delayed case timing is enforced");
      assert.equal(benchmarkEvidence(track, version, { ...emptyReadiness, capstones }, [attempt], due).met, true);
    }
  }
  assert.equal(guided, revisedActivities.length);
  assert.equal(scenarios.size, 14);
  console.log(`${guided} revised guided objectives and ${scenarios.size} role-specific practical cases across four pathways`);
}

function checkCasework() {
  const expected = portfolio.filter(({ id, kind }) => kind !== "dispatch" && !hasAssignmentWork(id));
  assert.deepEqual(new Set(Object.keys(cityCasework)), new Set(expected.map(({ id }) => id)));
  for (const mission of expected) {
    const work = caseworkFor(mission.id);
    const layout = workLayout(mission.id);
    assert.ok(layout.sections.length >= 2 && layout.sections.every(({ title, fields }) => title && fields.length), mission.id);
    const arrangedFields = layout.sections.flatMap(({ fields }) => fields);
    assert.deepEqual([...arrangedFields].sort(), work.fields.map(({ id }) => id).sort(), mission.id);
    const artifacts = work.output?.(startingCase(work)) ?? [];
    assert.ok(layout.sections.every(({ preview }) => preview === undefined || artifacts[preview]), mission.id);
    if (layout.arrivals) {
      assert.deepEqual(layout.arrivals.map(({ field }) => field).sort(),
        (layout.kind === "inbox" ? arrangedFields : layout.sections[0].fields.slice()).sort(), mission.id);
    }
    const base = startingCase(work);
    assert.ok(validCaseDraft(work, base), mission.id);
    assert.equal(replayCasework(work, base).passed, false, mission.id);
    assert.ok(work.references.length >= 2 && work.cases.length >= 2 && work.retest.requirements.length, mission.id);
    assert.deepEqual(new Set(work.objectives), new Set(missionMappings(mission).map(({ objective }) => objective)), mission.id);
    const requirements = [...work.cases, work.retest].flatMap(({ requirements }) => requirements);
    assert.ok(requirements.every(([id]) => Object.hasOwn(base, id)), mission.id);
    const correct = Object.fromEntries(work.fields.map((field) => {
      assert.ok(requirements.some(([id]) => id === field.id), field.id);
      const candidates = "options" in field ? field.options :
        Array.from({ length: field.max - field.min + 1 }, (_, index) => field.min + index);
      const own = requirements.filter(([id]) => id === field.id);
      return [field.id, candidates.find((value) => own.every((limit) =>
        limit.length === 2 ? value === limit[1] : limit[1] === "atLeast" ? value >= limit[2] : value <= limit[2]))];
    }));
    assert.ok(validCaseDraft(work, correct) && caseworkPassed(work, correct), mission.id);
    const unexpected = { ...correct, [work.retest.requirements[0][0]]: {} };
    assert.equal(validCaseDraft(work, unexpected), false, mission.id);
    assert.ok(missionCompleted(mission, { [mission.id]: { casework: correct } }, new Set()), mission.id);
    assert.equal(missionCompleted(mission, { [mission.id]: { caseDraft: correct } }, new Set()), false);
  }
  console.log(`${expected.length} rebuilt workbenches have valid samples, second cases and objective mappings.`);
}

checkPortfolios();
checkRehearsals();
checkFieldwork();
checkCasework();
checkPreparation();

async function storageChecks() {
  const stored = new Map();
  global.window = { localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  } };
  for (const track of tracks) {
    assert.equal(readReadiness(track), null);
    const version = decemberBlueprint(track) ? decemberVersion : "july-2026";
    const choices = bridges[track.id].checkpoints.map(({ correct }) => correct);
    assert.ok((await updateReadiness(track, emptyReadiness, { type: "version", version })).saved);
    assert.equal((await updateReadiness(track, emptyReadiness, { type: "bridge", choices })).error, null);
    assert.deepEqual(readReadiness(track).bridge, choices);
    if (version === decemberVersion) {
      await updateReadiness(track, emptyReadiness, { type: "guide", objective: "1.1" });
      assert.deepEqual(readReadiness(track).guide, ["1.1"]);
      assert.equal((await updateReadiness(track, emptyReadiness, { type: "workshop" })).error, null);
      assert.equal(readReadiness(track).workshop, true);
    }
    const definition = getCapstoneDefinition(track.id, version, "transfer");
    const attempt = { ...scoreCapstone(track.id, version, "transfer", initialCapstoneDraft(definition)), id: `${track.id}-locked`, submittedAt: Date.now() };
    assert.match((await updateReadiness(track, emptyReadiness, { type: "submission", attempt })).error, /locked/);
    assert.equal(readReadiness(track).capstones.length, 0);
    assert.equal(readReadiness(track).version, version);
  }
  for (const track of tracks.filter(({ id }) => isCityAssignment(id))) {
    const assignment = assignments[track.id];
    const decisions = assignment.controls.reduce((runs, control) => runs.flatMap((run) =>
      control.choices.map((_, index) => ({ ...run, [control.id]: index }))), [{}]);
    const winning = decisions.filter((choices) => assignment.replay(choices).rows.every(({ accepted }) => accepted));
    assert.equal(winning.length, 1, track.code);
    assert.equal(saveCityAssignment(track, {}), false);
    assert.equal(saveCityAssignment(track, winning[0]), true);
    assert.deepEqual(readCityAssignment(track)?.choices, winning[0]);
    const questions = cityChecks[track.id];
    const responses = Object.fromEntries(questions.map(({ id, correct }) => [id, [...correct]]));
    assert.equal(saveCityCheck(track.id, questions, {}).saved, false);
    assert.equal(saveCityCheck(track.id, questions, responses).saved, true);
    assert.deepEqual(readCityCheck(track.id, questions), responses);
    assert.deepEqual(saveCityCheck(track.id, questions, {}).answers, responses);
    assert.equal(readProgress(track), null);
  }
  global.localStorage = window.localStorage;
  const bulletin = portfolio.find(({ id }) => id === "market-bulletin");
  const work = caseworkFor(bulletin.id);
  const baseline = startingCase(work);
  const bulletinDraft = { hours: "8:30", cutoff: "8:00", staff: "Staff copy", send: "Publish" };
  const corrected = { ...bulletinDraft, send: "Inez’s desk" };
  assert.equal(saveCityCasework(bulletin, baseline, true), null);
  assert.ok(replayCasework(work, bulletinDraft).passed);
  assert.equal(saveCityCasework(bulletin, bulletinDraft, true), null, "the unseen case must meet the release policy");
  assert.ok((await saveCityCasework(bulletin, bulletinDraft)).saved);
  assert.deepEqual(readPortfolio()[bulletin.id].caseDraft, bulletinDraft);
  assert.ok((await saveCityCasework(bulletin, corrected, true)).saved);
  assert.deepEqual(readPortfolio()[bulletin.id].casework, corrected);
  assert.equal(readPortfolio()[bulletin.id].caseDraft, undefined);
  const mission = missionsFor("architect-foundations").find((entry) => entry.id === "library-search");
  const [first, ...rest] = mission.decisions;
  const draftChoices = { [first.objective]: [1] };
  assert.equal((await saveMissionDraft(mission, draftChoices)).saved, true);
  assert.deepEqual(readPortfolio()[mission.id].draft, draftChoices);
  assert.equal(saveMission(mission, draftChoices), null);
  const completeChoices = { ...draftChoices, ...Object.fromEntries(rest.map(({ objective }) => [objective, [1]])) };
  const questions = missionQuestions(mission);
  const answers = Object.fromEntries(questions.map(({ id, correct }) => [id, [...correct]]));
  assert.equal((await saveTransfer(mission, answers)).saved, true, "the check is available before the assignment and debrief");
  assert.deepEqual(missionPreparationSteps(false, readPortfolio()[mission.id]), [false, false, true, false]);
  assert.equal((await saveMissionDebrief(mission)).saved, true, "the debrief can be completed while the assignment is a draft");
  assert.deepEqual(missionPreparationSteps(false, readPortfolio()[mission.id]), [false, true, true, false]);
  assert.equal((await saveMission(mission, completeChoices)).saved, true);
  assert.ok(missionCompleted(mission, readPortfolio(), new Set()));
  assert.equal(readPortfolio()[mission.id].draft, undefined);
  const interviews = missionExperiences[mission.id].interviews;
  assert.equal((await saveMissionInterview(mission, interviews[0].id)).saved, true);
  assert.deepEqual(readPortfolio()[mission.id].interviewed, [interviews[0].id]);
  assert.equal(readPortfolio()[mission.id].debriefSeen, true);
  assert.deepEqual(readPortfolio()[mission.id].check.answers, answers);
  assert.ok(readPortfolio()[mission.id].check.submittedAt > 0);
  const followup = missionFollowupQuestions(mission);
  const followupAnswers = Object.fromEntries(followup.map(({ id, correct }) => [id, [...correct]]));
  assert.equal((await saveMissionFollowup(mission, followupAnswers)).saved, false, "follow-up cannot be submitted early");
  const savedMission = JSON.parse(stored.get(missionStoragePrefix + mission.id));
  savedMission.check.submittedAt = undefined;
  stored.set(missionStoragePrefix + mission.id, JSON.stringify(savedMission));
  assert.equal((await saveTransfer(mission, answers, true)).saved, true);
  assert.equal(readPortfolio()[mission.id].checkHistory.length, 1, "earlier check is retained when scheduling a fresh cycle");
  const retakenMission = JSON.parse(stored.get(missionStoragePrefix + mission.id));
  retakenMission.check.submittedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
  stored.set(missionStoragePrefix + mission.id, JSON.stringify(retakenMission));
  assert.equal((await saveMissionFollowup(mission, followupAnswers)).saved, true);
  assert.deepEqual(readPortfolio()[mission.id].followup.answers, followupAnswers);
  assert.equal(saveTransfer(mission, {}), null);
  const archive = missionsFor("architect-foundations").find(({ id }) => id === "archive-coordination");
  const peak = missionsFor("architect-foundations").find(({ id }) => id === "dispatch-monday-peak");
  const incorrect = Object.fromEntries(missionQuestions(archive).map((item) => [item.id, item.options.slice(0, item.correct.length).map(([id]) => id)]));
  const legacy = new Set();
  assert.equal((await saveTransfer(archive, incorrect)).saved, true);
  assert.ok(missingExpertise(peak, readPortfolio()).includes("5.3"));
  assert.equal((await acknowledgeReview(archive, "5.3")).saved, true);
  assert.ok(!missingExpertise(peak, readPortfolio()).includes("5.3"));
  assert.ok(unmetMissions(peak, readPortfolio(), legacy).some(({ id }) => id === archive.id));
  assert.ok(!portfolioEvidence(tracks[2], readPortfolio(), legacy).demonstrated.has("5.3"));
  const archiveChoices = Object.fromEntries(archive.decisions.map(({ objective, options }) =>
    [objective, options.flatMap(({ passed }, index) => passed ? [index] : [])]));
  assert.equal((await saveMission(archive, archiveChoices)).saved, true);
  assert.ok(!unmetMissions(peak, readPortfolio(), legacy).some(({ id }) => id === archive.id));
  const enrollment = missionsFor("associate-foundations").find(({ id }) => id === "enrollment-replies");
  assert.deepEqual(missionPreparationSteps(true, readPortfolio()[enrollment.id]), [true, false, true, false]);
  await saveMissionDebrief(enrollment);
  assert.deepEqual(missionPreparationSteps(true, readPortfolio()[enrollment.id]), [true, true, true, false]);
  const dispatchCheck = { kind: "submit", stage: "first",
    answers: Object.fromEntries(skillChecks.first.questions.map(({ id, correct }) => [id, [...correct]])) };
  const dispatchResult = await updateCertification(emptyDispatchProgress, dispatchCheck);
  assert.equal(dispatchResult.saved, true);
  assert.deepEqual(dispatchPreparationSteps(dispatchResult.progress, false), [false, false, true, false]);
  const dispatchDebrief = await updateCertification(dispatchResult.progress, { kind: "debrief" });
  assert.equal(dispatchDebrief.saved, true);
  const dispatchProgress = dispatchDebrief.progress;
  assert.deepEqual(dispatchPreparationSteps(dispatchProgress, true), [true, true, true, false]);
  assert.deepEqual(dispatchPreparationSteps(dispatchProgress, false), [false, true, true, false]);
  const track = tracks[0];
  const now = Date.now();
  const draft = createSession(track, "mixed", null, false, [], now);
  assert.equal((await updateProgress(track, emptyProgress, { type: "start", draft })).saved, true);
  assert.equal(readProgress(track).draft.id, draft.id);
  assert.ok((await updateProgress(track, emptyProgress, { type: "submit", id: draft.id })).error);
  const items = sessionItems(track, draft);
  for (const item of items) {
    for (const value of item.correct) {
      await updateProgress(track, emptyProgress, { type: "choose", id: draft.id, itemId: item.id, value });
    }
  }
  const submitted = await updateProgress(track, emptyProgress, { type: "submit", id: draft.id });
  assert.equal(score(items, submitted.progress.attempts[0].answers), 12);
  assert.equal((await updateProgress(track, emptyProgress, { type: "submit", id: draft.id })).progress.attempts.length, 1);
  assert.ok((await updateProgress(track, emptyProgress, {
    type: "start", draft: createSession(track, "followup", null, false, [], now),
  })).error);
  const expired = createSession(track, "mixed", null, true, [], now - 86400_000);
  await updateProgress(track, emptyProgress, { type: "start", draft: expired });
  const timed = await updateProgress(track, emptyProgress, { type: "submit", id: expired.id });
  assert.equal(timed.progress.attempts.length, 2);
  assert.deepEqual(timed.progress.attempts[1].answers, {});
  const firstRehearsal = createSession(track, "assessment", null, true, [], now, [], "july-2026");
  const { form: _form, priorExposure: _priorExposure, ...oldDraft } = firstRehearsal;
  stored.set(progressKey(track), JSON.stringify({ ...timed.progress, draft: oldDraft }));
  assert.deepEqual(sessionItems(track, readProgress(track).draft), rehearsalItems(track.id));
  assert.equal(readProgress(track).draft.priorExposure, undefined);
  const firstTimed = await updateProgress(track, emptyProgress, { type: "submit", id: oldDraft.id });
  assert.equal(firstTimed.saved, true);
  const julyForms = rehearsalForms(track.id, "july-2026", firstTimed.progress.attempts);
  assert.equal(julyForms[0].exposed, firstRehearsal.itemIds.length);
  assert.equal(julyForms[0].completed, true);
  assert.equal(julyForms[1].exposed, 0);
  const oldGuideAlternate = createSession(track, "assessment", null, true, [], now, [], "july-2026", "retest");
  await updateProgress(track, emptyProgress, { type: "start", draft: oldGuideAlternate });
  await updateProgress(track, emptyProgress, { type: "submit", id: oldGuideAlternate.id });
  const modernForms = rehearsalForms(track.id, decemberVersion, readProgress(track).attempts);
  assert.equal(modernForms[0].completed, false);
  assert.ok(modernForms[0].exposed > 0, "legacy cross-guide question overlap must be disclosed");
  assert.equal(modernForms[1].exposed, 0, "either July form leaves the December alternate fresh");
  const staleDraft = createSession(track, "assessment", null, true, [], now, [], decemberVersion, "retest");
  assert.equal((await updateProgress(track, emptyProgress, { type: "start", draft: staleDraft })).saved, true);
  assert.equal(readProgress(track).draft.form, "retest");
  assert.deepEqual(readProgress(track).draft.priorExposure, []);
  assert.ok(readProgress(track).seen.includes(staleDraft.itemIds[0]));
  await updateProgress(track, emptyProgress, { type: "move", id: staleDraft.id, index: 3 });
  assert.equal(readProgress(track).draft.index, 3);
  assert.deepEqual(readProgress(track).draft.priorExposure, [], "viewing a question during the current attempt leaves its baseline fresh");
  assert.ok(readProgress(track).seen.includes(staleDraft.itemIds[3]));
  await updateProgress(track, emptyProgress, { type: "discard", id: staleDraft.id });
  const newDraft = createSession(track, "assessment", null, true, [], Date.now(), [], decemberVersion, "retest");
  const restarted = await updateProgress(track, emptyProgress, { type: "start", draft: newDraft });
  assert.deepEqual(restarted.progress.draft.priorExposure, [newDraft.itemIds[0], newDraft.itemIds[3]], "storage must account for earlier exposures missing from the client snapshot");
  assert.deepEqual(readProgress(track).draft.priorExposure, restarted.progress.draft.priorExposure);
  await updateProgress(track, emptyProgress, { type: "discard", id: newDraft.id });
  assert.ok((await updateProgress(track, emptyProgress, {
    type: "start", draft: { ...newDraft, itemIds: newDraft.itemIds.slice(0, -1) },
  })).error, "reject a truncated alternate form");
  assert.equal(readProgress(tracks[1]), null);
  stored.set(progressKey(track), "{corrupt");
  assert.equal(readProgress(track), null);
}

storageChecks().then(() => console.log("Coverage, answer keys, session selection and storage checks passed."))
  .catch((error) => { console.error(error); process.exitCode = 1; });
