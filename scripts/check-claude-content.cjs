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
const { rehearsalItems } = require("../lib/claude/assessment/forms.ts");
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
const { banks, createSession, domainEvidence, followupDue, itemDomain, responseComplete, score, sessionItems } = require("../lib/claude/practice.ts");
const { emptyProgress, progressKey, readProgress, updateProgress } = require("../lib/claude/progress.ts");
const { assignments, isCityAssignment } = require("../lib/claude/assignments.ts");
const { cityChecks } = require("../lib/claude/city-checks.ts");
const { readCityAssignment, readCityCheck, saveCityAssignment, saveCityCheck } = require("../lib/claude/city-progress.ts");
const { dispatchPreparationSteps, emptyProgress: emptyDispatchProgress, updateCertification } = require("../lib/certification-progress.ts");
const { skillChecks } = require("../lib/exam-practice.ts");

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
  for (const track of tracks) {
    const updated = decemberBlueprint(track);
    for (const version of updated ? ["july-2026", decemberVersion] : ["july-2026"]) {
      const blueprint = version === decemberVersion ? updated : track;
      const form = rehearsalItems(track.id, version);
      const scored = form.filter(({ pilot }) => !pilot);
      assert.equal(form.length, blueprint.count, `${track.code} ${version} item count`);
      assert.equal(scored.length, version === decemberVersion ? 60 : blueprint.count);
      const objectives = blueprint.domains.flatMap((domain) => domain.objectives.map((_, index) => `${domain.id}.${index + 1}`));
      assert.deepEqual(new Set(scored.map(({ objective }) => objective)), new Set(objectives), track.code);
      assert.equal(new Set(form.map(({ id }) => id)).size, form.length, track.code);
      assert.equal(new Set(form.map(({ prompt }) => prompt)).size, form.length, track.code);
      for (const domain of blueprint.domains) {
        const coverage = scored.filter((item) => itemDomain(item) === domain.id).length;
        assert.ok(Math.abs(coverage - domain.weight * scored.length / 100) <= 1.1, `${track.code} domain ${domain.id} weighting`);
      }
      for (const question of form) {
        assert.ok(!ids.has(question.id), question.id);
        assert.ok(sources[question.source] && question.explanation && question.context && question.prompt.endsWith("?"), question.id);
        assert.equal(question.options.length, question.correct.length + 3, question.id);
        assert.ok(question.correct.every((key) => question.options.some(([option]) => option === key)), question.id);
        assert.equal(new Set(question.options.map(([, text]) => text)).size, question.options.length, question.id);
      }
      const session = createSession(track, "assessment", null, false, [], 10_000, [], version);
      assert.equal(session.deadline, session.startedAt + examMinutes * 60_000);
      assert.deepEqual(sessionItems(track, session), form);
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

async function storageChecks() {
  const stored = new Map();
  global.window = { localStorage: {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  } };
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
  assert.equal(readProgress(tracks[1]), null);
  stored.set(progressKey(track), "{corrupt");
  assert.equal(readProgress(track), null);
}

storageChecks().then(() => console.log("Coverage, answer keys, session selection and storage checks passed."))
  .catch((error) => { console.error(error); process.exitCode = 1; });
