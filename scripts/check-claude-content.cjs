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

const { examMinutes, julyGuideUrls, tracks } = require("../lib/claude/blueprints.ts");
const { decemberBlueprint, decemberVersion } = require("../lib/claude/december-blueprints.ts");
const { rehearsalFormIds, rehearsalItems } = require("../lib/claude/assessment/forms.ts");
const { skillNote } = require("../lib/claude/skill-notes.ts");
const { runReference, referenceBaseline, runStream, streamBaseline, runRetrieval, retrievalBaseline } = require("../lib/claude/fieldwork.ts");
const { assignmentChoices, hasAssignmentWork, validAssignmentWork } = require("../lib/claude/assignment-work.ts");
const { caseworkFor, cityCasework } = require("../lib/claude/cases/index.ts");
const { assignmentDebriefs } = require("../lib/claude/cases/debriefs.ts");
const { missionExhibits, missionTransfer } = require("../lib/claude/mission-transfer.ts");
const { workLayout } = require("../lib/claude/cases/layouts.ts");
const { caseworkPassed, deployedCase, isChoice, meetsKey, replayCasework, solvedCase, startingCase, validCaseDraft } = require("../lib/claude/casework.ts");
const { places } = require("../lib/world.ts");
const { caseOptionOrder, missionMappings, missionPassed, stationOptions } = require("../lib/claude/missions.ts");
const { caseIndependent, saveCaseMastery, startCaseCycle } = require("../lib/claude/pathway.ts");
const { packetFields, briefSections, runArchive, runKitchen, archiveBaseline, kitchenBaseline } = require("../lib/claude/assignment-work.ts");
const { acknowledgeReview, missingExpertise, missionCompleted, missionFollowupQuestions, missionPreparationSteps, missionQuestions, missionsFor, missionStoragePrefix, portfolio, portfolioEvidence, readPortfolio, saveCityCasework, saveMission, saveMissionDebrief, saveMissionDraft, saveMissionFollowup, saveMissionInterview, saveTransfer, unmetMissions } = require("../lib/claude/pathway.ts");
const { missionExperiences } = require("../lib/claude/mission-experiences.ts");
const { sources } = require("../lib/claude/items.ts");
const { banks, createSession, domainEvidence, followupDue, itemDomain, practiceBank, rehearsalForms, responseComplete, score, sessionItems } = require("../lib/claude/practice.ts");
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
const { emptyReadiness, readReadiness, readinessKey, updateReadiness } = require("../lib/claude/readiness.ts");
const { benchmarkEvidence, timedEvidence } = require("../lib/claude/benchmark.ts");
const { isProgressKey } = require("../lib/progress-storage.ts");
const { solved } = require("./check-claude-capstones.cjs");
const { publicGuides } = require("../lib/claude/public-guides.ts");

// Public sample questions are the first items an expert sees. The key must not be guessable by length or wording.
{
  const samples = Object.values(publicGuides).flatMap(({ samples }) => samples);
  const keyLongest = samples.filter(({ options, answer }) => {
    const lengths = options.map((option) => option.length);
    const max = Math.max(...lengths);
    return lengths[answer] === max && lengths.filter((length) => length === max).length === 1;
  }).length;
  assert.ok(keyLongest <= samples.length * .4, `Public samples: key is uniquely longest in ${keyLongest}/${samples.length}`);
  for (const { question, options } of samples) {
    assert.ok(!options.some((option) => /^(only|just|declare)\b|\bunapproved\b/i.test(option)), `Public sample has a giveaway option: ${question}`);
  }
}

const ids = new Set();
const prompts = new Set();
const delayedIds = new Set();
assert.equal(tracks.length, 5);
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
  // Answers saved against the pre-rewrite wording stay in history but are not evidence.
  assert.equal(domainEvidence(track, [{ ...attempt, submittedAt: Date.parse("2026-11-20T00:00:00Z") }]).firstAnswers.size, 0);
  const nextItems = sessionItems(track, createSession(track, "mixed", null, false, [attempt], 30_000));
  assert.ok(nextItems.some((item) => !session.itemIds.includes(item.id)));
  assert.ok(items.every((item) => responseComplete(item, attempt.answers)));
  console.log(`${track.code} · ${bank.practice.length} practice, ${bank.followup.length} follow-up, ${objectives.length} objectives`);
}

function checkAnswerLengths(questions, title) {
  // A copyediting check for both character and word counts, sharing tied ranks.
  for (const width of [(answer) => answer.length, (answer) => answer.split(/\s+/).length]) {
    const ranks = [0, 0, 0, 0];
    for (const question of questions) {
      const lengths = question.options.map(([key, answer]) => ({ key, length: width(answer) }));
      const correct = lengths.find(({ key }) => key === question.correct[0]).length;
      const lower = lengths.filter(({ length }) => length < correct).length;
      const ties = lengths.filter(({ length }) => length === correct).length;
      for (let i = lower; i < lower + ties; i++) ranks[i] += 1 / ties;
    }
    assert.ok(Math.max(...ranks) <= questions.length / 2, `${title} answer length cue (${ranks.join(", ")})`);
  }
}

function checkRehearsals() {
  const alternateIds = new Set();
  const alternatePrompts = new Set();
  const reserveSeen = new Map();
  const rememberReserve = (question) => {
    assert.equal(reserveSeen.get(question.id) ?? question.prompt, question.prompt, "cross-guide reserve IDs refer to equivalent evidence");
    reserveSeen.set(question.id, question.prompt);
  };
  const { domainSampleMinimum, reassessmentMinutes, selectReassessment } = require("../lib/claude/assessment/forms.ts");
  const { recoveryBank } = require("../lib/claude/assessment/recovery-bank.ts");
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
    const originalAndAlternateIds = new Set(versions.flatMap((version) => ["original", "retest"]
      .flatMap((label) => rehearsalItems(track.id, version, label).map(({ id }) => id))));
    const originalAndAlternatePrompts = new Set(versions.flatMap((version) => ["original", "retest"]
      .flatMap((label) => rehearsalItems(track.id, version, label).map(({ prompt }) => prompt))));
    const allPractice = versions.flatMap((version) => {
      const bank = practiceBank(track.id, version);
      return [...bank.practice, ...bank.followup];
    });
    const practiceIds = new Set(allPractice.map(({ id }) => id));
    const practicePrompts = new Set(allPractice.map(({ prompt }) => prompt));
    for (const version of versions) {
      const blueprint = version === decemberVersion ? updated : track;
      const reserve = recoveryBank(track.id, version);
      const reserveItems = [...reserve.full, ...reserve.focused];
      assert.equal(new Set(reserveItems.map(({ id }) => id)).size, reserveItems.length, "focused and full reserves have separate items");
      for (const question of reserveItems) {
        assert.ok(!originalAndAlternateIds.has(question.id) && !practiceIds.has(question.id) && !cityIds.has(question.id), question.id);
        assert.ok(!originalAndAlternatePrompts.has(question.prompt) && !practicePrompts.has(question.prompt) && !cityPrompts.has(question.prompt), question.id);
        rememberReserve(question);
      }
      for (const domain of blueprint.domains) {
        const domainPractice = createSession(track, "domain", domain.id, false, [], 10_000, cityIds, version);
        const [firstQuestion] = sessionItems(track, domainPractice);
        assert.ok(firstQuestion && !cityIds.has(firstQuestion.id) && !cityPrompts.has(firstQuestion.prompt),
          `${track.code} ${version} domain ${domain.id} starts with an unseen question after the city checks`);
        const focused = selectReassessment(track.id, version, domain.id, originalAndAlternateIds);
        assert.equal(focused.length, domainSampleMinimum, `${track.code} ${version} domain ${domain.id}`);
        assert.ok(focused.every((entry) => !entry.pilot && itemDomain(entry) === domain.id));
        const timed = createSession(track, "reassessment", domain.id, true, [], 10_000, originalAndAlternateIds, version);
        assert.deepEqual(timed.itemIds, focused.map(({ id }) => id));
        assert.equal(timed.deadline, timed.startedAt + reassessmentMinutes * 60_000);
        assert.deepEqual(timed.priorExposure, []);
      }
      for (const label of rehearsalFormIds) {
        const form = rehearsalItems(track.id, version, label);
        const scored = form.filter(({ pilot }) => !pilot);
        const title = `${track.code} ${version} ${label}`;
        assert.equal(form.length, blueprint.count, `${title} item count`);
        // December guides and CCDV-P (guide v1.0) score 60 of 70 items; the others score every item.
        assert.equal(scored.length, version === decemberVersion || track.id === "developer-professional" ? 60 : blueprint.count, title);
        if (track.id === "architect-foundations") assert.equal(new Set(form.map(({ scenario }) => scenario)).size, 4, `${title} shared scenarios`);
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
        checkAnswerLengths(singleResponse, title);
        if (label !== "original") {
          const keyCounts = ["a", "b", "c", "d"].map((key) => singleResponse.filter(({ correct }) => correct[0] === key).length);
          assert.ok(Math.max(...keyCounts) - Math.min(...keyCounts) <= 1, `${title} single-response positions`);
        }
        for (const question of form) {
          assert.ok(!ids.has(question.id), question.id);
          assert.ok(!practiceIds.has(question.id) && !cityIds.has(question.id) &&
            !practicePrompts.has(question.prompt) && !cityPrompts.has(question.prompt), `${question.id} is independent of city and short practice`);
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
        assert.deepEqual(sessionItems(track, session).map(({ reference: _reference, ...entry }) => entry), form);
        if (label === "recovery") {
          assert.deepEqual(rehearsalItems(track.id, version, label, originalAndAlternateIds), form);
          const used = new Set([...originalAndAlternateIds, ...form.map(({ id }) => id)]);
          const next = rehearsalItems(track.id, version, label, used);
          assert.ok(next.length === 0 || next.length === form.length && next.every(({ id }) => !used.has(id)),
            "exhaustion cannot generate a partial or repeated recovery form");
        }
      }
    }
    if (updated) {
      const earlierAttempts = rehearsalFormIds.map((label) => {
        const draft = createSession(track, "assessment", null, true, [], 10_000, [], "july-2026", label);
        return { ...draft, submittedAt: 25_000 };
      });
      assert.ok(rehearsalForms(track.id, decemberVersion, earlierAttempts).some(({ exposed, items }) => !exposed && items.length === updated.count),
        "each revised guide keeps a fresh full route after all earlier rehearsals");
    }
  }

  const developer = tracks.find(({ id }) => id === "developer-foundations");
  const first = createSession(developer, "assessment", null, true, [], 10_000, [], "july-2026");
  const earlier = {
    ...first,
    submittedAt: 20_000,
    answers: Object.fromEntries(sessionItems(developer, first).filter((entry) => itemDomain(entry) !== 4)
      .map(({ id, correct }) => [id, correct])),
  };
  const domainFour = (attempts) => timedEvidence(developer, "july-2026", attempts)[0].domains.find(({ id }) => id === 4);
  const before = domainFour([earlier]);
  assert.deepEqual([before.status, before.correct, before.total], ["insufficient", 0, 1]);
  const focused = createSession(developer, "reassessment", 4, true, [earlier], 30_000, [], "july-2026");
  assert.equal(focused.itemIds.length, domainSampleMinimum);
  const followup = {
    ...focused,
    submittedAt: 40_000,
    answers: Object.fromEntries(sessionItems(developer, focused).map(({ id, correct }) => [id, correct])),
  };
  const after = domainFour([earlier, followup]);
  assert.deepEqual([after.status, after.correct, after.total, after.sampleCorrect, after.sampleTotal], ["met", 0, 1, 4, 5],
    "a new targeted sample supplements the single original result without changing it");
  const julySnapshot = { ...earlier, snapshot: { ...earlier.snapshot, guide: julyGuideUrls[developer.id] } };
  assert.equal(domainFour([julySnapshot, followup]).status, "met", "the administrative guide update preserves reassessment eligibility");
  assert.equal(domainFour([earlier, { ...followup, priorExposure: [followup.itemIds[0]] }]).status, "insufficient");
  assert.equal(domainFour([earlier, { ...followup, version: decemberVersion }]).status, "insufficient");

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
  assert.deepEqual(new Set(Object.keys(assignmentDebriefs)), new Set(portfolio.map(({ id }) => id)), "every assignment teaches its technical analogy in the debrief");
  for (const { observation, implementation, transfer, references } of Object.values(assignmentDebriefs)) {
    assert.ok(observation && implementation && transfer && references.length && references.every((key) => sources[key]));
  }
  for (const exhibit of missionExhibits) {
    const mission = portfolio.find((entry) => missionMappings(entry).some(({ itemId }) => itemId === exhibit.id));
    assert.ok(mission && missionQuestions(mission).includes(exhibit), `${exhibit.id} is presented in its mapped city check`);
    const original = [...(cityChecks[mission.track] ?? []), ...banks[mission.track].practice, ...banks[mission.track].followup, ...missionTransfer]
      .find(({ id }) => id === exhibit.id);
    assert.equal(exhibit.objective, original.objective, exhibit.id);
    assert.deepEqual(exhibit.correct, original.correct, `${exhibit.id} preserves past check scoring`);
    assert.ok(exhibit.context && exhibit.prompt !== original.prompt && Object.values(exhibit.rationales).every(Boolean));
  }
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
      const bank = practiceBank(track.id, version);
      const objectives = new Set(coverage.map(({ id }) => id));
      assert.ok(checkpoints.every(({ objectives: [historical, updated] }) => objectives.has(revised ? updated ?? historical : historical)),
        `${track.code} ${version} starting feedback links to valid practice objectives`);
      if (revised) {
        assert.ok(coverage.every(({ id, activity, missions }) => activity?.[0] === id && activity.every(Boolean) && sources[activity[1]] && missions.length === 1), track.code);
        const { missionGuideCases } = require("../lib/claude/curriculum/city-guide.ts");
        checkAnswerLengths(bank.practice, `${track.code} December short practice`);
        checkAnswerLengths(bank.followup, `${track.code} December seven-day follow-up`);
        assert.deepEqual(new Set(bank.practice.map(({ objective }) => objective)), new Set(coverage.map(({ id }) => id)), track.code);
        assert.deepEqual(new Set(bank.followup.map(itemDomain)), new Set(decemberBlueprint(track).domains.map(({ id }) => id)), track.code);
        assert.ok(coverage.every(({ id, missions }) => missionGuideCases(track.id, missions[0].id).some(([objective]) => objective === id)));
        assert.equal(new Set([...bank.practice, ...bank.followup].map(({ id }) => id)).size, bank.practice.length + bank.followup.length);
        const target = coverage.at(-1).id;
        const targeted = createSession(track, "domain", Number(target.split(".")[0]), false, [], 5_000, [], version, undefined, target);
        assert.equal(sessionItems(track, targeted)[0].objective, target, "exact-skill practice uses the selected guide");
        const study = createSession(track, "mixed", null, false, [], 5_000, [], version);
        const first = { ...study, submittedAt: 9_000 };
        assert.equal(followupDue([first]), null, "revised work does not start the original guide's clock");
        assert.equal(followupDue([first], version), 9_000 + 7 * 86_400_000);
        guided += coverage.length;
      } else assert.ok(coverage.every(({ missions }) => missions.length), track.code);
      const covered = new Set(coverage.map(({ id }) => id));
      for (const stage of ["capstone", "transfer"]) {
        const definition = getCapstoneDefinition(track.id, version, stage);
        // Hands-on labs are shared by both guide editions (criteria carry revisedObjectives), so ids are unique per edition.
        assert.ok(!scenarios.has(`${version}:${definition.id}`), definition.id);
        scenarios.add(`${version}:${definition.id}`);
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
      assert.ok(fresh?.fresh && fresh.overallMet, track.code);
      const supplements = fresh.domains.filter(({ status }) => status === "insufficient").map(({ id }) => {
        const set = createSession(track, "reassessment", id, true, [attempt], 22_000, [], version);
        const entries = sessionItems(track, set);
        assert.ok(entries.length > 0, `${track.code} has a fresh sample for domain ${id}`);
        return { ...set, submittedAt: 32_000, answers: Object.fromEntries(entries.map(({ id, correct }) => [id, correct])) };
      });
      const evidenceAttempts = [attempt, ...supplements];
      assert.ok(timedEvidence(track, version, evidenceAttempts)[0].met, track.code);
      assert.equal(fresh.total, revised || track.id === "developer-professional" ? 60 : track.count, "unscored questions excluded from benchmark");
      assert.equal(timedEvidence(track, version, [{ ...attempt, priorExposure: [items[0].id] }])[0].met, false, "reuse is review evidence");
      assert.equal(timedEvidence(track, version, [{ ...attempt, priorExposure: undefined }])[0].met, false, "legacy exposure remains unknown");
      assert.equal(timedEvidence(track, version, [{ ...attempt, deadline: null }])[0].met, false, "untimed results cannot meet the benchmark");
      assert.deepEqual(timedEvidence(track, version, [{ ...attempt, itemIds: attempt.itemIds.slice(1) }]), []);
      assert.equal(benchmarkEvidence(track, version, emptyReadiness, [attempt], 20_000).met, false, "one timed score alone cannot meet the benchmark");
      const due = 10_000 + 7 * 86_400_000;
      const capstones = solved.filter(([id, guide]) => id === track.id && guide === version).map(([id, guide, stage, artifact]) => ({
        ...scoreCapstone(id, guide, stage, artifact), id: `${id}-${stage}`, submittedAt: stage === "capstone" ? 10_000 : due,
      }));
      assert.equal(benchmarkEvidence(track, version, { ...emptyReadiness, capstones }, evidenceAttempts, due - 1).met, false, "delayed case timing is enforced");
      assert.equal(benchmarkEvidence(track, version, { ...emptyReadiness, capstones }, evidenceAttempts, due).met, true);
    }
  }
  assert.equal(guided, revisedActivities.length);
  assert.equal(scenarios.size, 16);
  console.log(`${guided} revised guided objectives and ${scenarios.size} role-specific practical cases across five pathways`);
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
    assert.ok(Object.values(base).every((value) => value === null), `${mission.id} starts with every choice unset`);
    assert.ok(validCaseDraft(work, base, true) && !validCaseDraft(work, base), mission.id);
    assert.equal(replayCasework(work, base).passed, false, mission.id);
    const deployed = deployedCase(work);
    assert.ok(validCaseDraft(work, deployed), `${mission.id} deployed setup is complete`);
    assert.equal(replayCasework(work, deployed).passed, false, mission.id);
    assert.ok(work.references.length >= 2 && work.cases.length >= 2 && work.retest.fields.length, mission.id);
    assert.deepEqual(new Set(work.objectives), new Set(missionMappings(mission).map(({ objective }) => objective)), mission.id);
    const checked = new Set([...work.cases, work.retest].flatMap(({ fields }) => fields));
    assert.ok(work.fields.every(({ id }) => checked.has(id)), `${mission.id} every field is checked by a replay`);
    const correct = solvedCase(work);
    assert.ok(validCaseDraft(work, correct) && caseworkPassed(work, correct), mission.id);
    const unexpected = { ...correct, [work.retest.fields[0]]: {} };
    assert.equal(validCaseDraft(work, unexpected), false, mission.id);
    assert.ok(missionCompleted(mission, { [mission.id]: { casework: correct } }, new Set()), mission.id);
    assert.equal(missionCompleted(mission, { [mission.id]: { caseDraft: correct } }, new Set()), false);
  }
  console.log(`${expected.length} rebuilt workbenches have valid samples, second cases and objective mappings.`);
}

// ---- BEGIN casework design checks (approachable but knowledge-requiring stations) ----
// These keep the structural tells out of the casework stations: position and length cues, answers leaked by
// hints, interviews or policy text, printed numeric answers, check-all checklists and unmapped objectives.
const caseStop = new Set("with from that this each only into than then they them their there what when where which while will would about also have more most other over same some such these those under upon your been were does done just like very much many make made must should could".split(" "));
function caseWords(text) {
  return String(text).toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !caseStop.has(word));
}
/** Share of the key's content words found in a text, ignoring words already visible in the field label or station context. */
function keyOverlap(key, text, context) {
  const known = new Set(caseWords(context));
  const words = [...new Set(caseWords(key))].filter((word) => !known.has(word));
  if (!words.length) return 0;
  const found = new Set(caseWords(text));
  return words.filter((word) => found.has(word)).length / words.length;
}
const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
function printsNumber(text, value) {
  const forms = [String(value), value.toLocaleString("en-US"), ...(value <= 20 ? [numberWords[value]] : [])];
  return forms.some((form) => new RegExp(`(^|[^0-9a-z.,])${form.replace(/[.,]/g, "\\$&")}($|[^0-9a-z])`, "i").test(text));
}
const instruction = /^(give|use|track|keep|send|store|put|route|ask|set|choose|pick|move|add|remove|redact|compare|check|run|retry|join|correlate|upsert|replace|treat|place|separate|derive|expose|package|limit|start|answer|append|resume|version|fork|trace|measure|validate|interview|retrieve|reuse|return|deduplicate|show|name|record|apply|block|hold|escalate|mark|enforce|isolate|split|schedule|load|cache|translate|replay|index|brainstorm|extract|obtain|distinguish|preserve|include|attach|let|make|do|don’t|don't|never|always|avoid|only)\b/i;

function caseworkBots(missionId, work) {
  const pick = (choose) => Object.fromEntries(work.fields.map((field) => [field.id, isChoice(field) ? choose(field) : work.deployed[field.id]]));
  const strategies = [["longest option", pick((field) => [...field.options].sort((a, b) => b.value.length - a.value.length)[0].value)]];
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const [name, position] of [["second option", 1], ["first option", 0], ["last option", -1]]) {
      strategies.push([`${name} (cycle ${cycle})`, pick((field) => field.options[caseOptionOrder(missionId, field.id, cycle, field.options.length).at(position)].value)]);
    }
  }
  return strategies.filter(([, draft]) => caseworkPassed(work, draft)).map(([name]) => name);
}

function checkCaseworkDesign() {
  const totals = { fields: 0, keyLongest: 0, positions: {}, numbers: 0, printed: 0, botPasses: 0 };
  for (const track of tracks) {
    let fields = 0;
    let keyLongest = 0;
    for (const mission of missionsFor(track.id)) {
      const work = caseworkFor(mission.id);
      if (!work) continue;
      const replies = (missionExperiences[mission.id]?.interviews ?? []).map(({ reply }) => reply);
      const policy = work.references.filter((reference) => reference[2] === "policy").map(([, content]) => content).join(" ");
      const brief = [work.brief.move, ...work.brief.success].join(" ");
      const printed = [work.opening, work.task, work.brief.problem, brief, ...replies,
        ...work.references.map(([name, content]) => `${name} ${content}`), ...[...work.cases, work.retest].map(({ name, evidence }) => `${name} ${evidence}`)].join("\n");
      for (const objective of work.objectives) {
        assert.ok(work.fields.some((field) => field.objective === objective), `${mission.id} claims ${objective} without a field that practices it`);
      }
      assert.ok(work.prebrief.concept.trim() && work.prebrief.terms.length >= 2 && work.prebrief.contrast.good && work.prebrief.contrast.bad, `${mission.id} pre-brief`);
      assert.ok(work.brief.success.length, `${mission.id} observable success criteria`);
      for (const fixture of [...work.cases, work.retest]) assert.ok(fixture.symptom.trim() && fixture.diagnosis.trim(), `${mission.id} ${fixture.name} symptom and diagnosis`);
      for (const reply of replies) {
        for (const sentence of reply.split(/(?<=[.!?])\s+/)) assert.ok(!instruction.test(sentence.trim()), `${mission.id} interview states facts, not instructions: ${sentence}`);
      }
      for (const field of work.fields) {
        assert.ok(work.objectives.includes(field.objective), `${mission.id}.${field.id} objective`);
        assert.ok(["nudge", "concept", "worked"].every((rung) => field.hints[rung].trim()), `${mission.id}.${field.id} hint ladder`);
        assert.equal(meetsKey(field, work.deployed[field.id]), false, `${mission.id}.${field.id} deployed value is wrong`);
        if (!isChoice(field)) {
          totals.numbers++;
          if (typeof field.key === "number" && !field.transcription) {
            const leaked = printsNumber(printed, field.key) || printsNumber(field.hints.nudge, field.key);
            if (leaked) totals.printed++;
            assert.ok(!leaked, `${mission.id}.${field.id} prints its numeric answer ${field.key}`);
          }
          continue;
        }
        fields++;
        const values = field.options.map(({ value }) => value);
        assert.ok(values.length >= 3 && new Set(values).size === values.length, `${mission.id}.${field.id} has at least three distinct options`);
        const lengths = values.map((value) => value.length);
        assert.ok(Math.max(...lengths) <= Math.min(...lengths) * 1.5, `${mission.id}.${field.id} option lengths within 1.5×: ${values.join(" | ")}`);
        const key = field.options.find(({ value }) => value === field.key);
        assert.ok(key?.examTerm, `${mission.id}.${field.id} key names its exam term`);
        assert.ok(field.options.every((option) => option.rationale.trim() && (option === key || option.misconception?.trim())),
          `${mission.id}.${field.id} every distractor targets a misconception`);
        if (field.options.every((option) => option === key || option.value.length < key.value.length)) keyLongest++;
        const context = [field.label, work.station, work.opening, work.task].join(" ");
        for (const [name, text] of [["directions", brief], ["interviews", replies.join(" ")], ["policy references", policy],
          ["nudge", field.hints.nudge], ["concept", field.hints.concept], ["worked example", field.hints.worked]]) {
          const share = keyOverlap(field.key, text, context);
          assert.ok(share < .5, `${mission.id}.${field.id} key “${field.key}” shares ${Math.round(share * 100)}% of its words with the ${name}`);
        }
        const shown = caseOptionOrder(mission.id, field.id, 0, values.length).findIndex((index) => values[index] === field.key);
        totals.positions[shown] = (totals.positions[shown] ?? 0) + 1;
      }
      const passes = caseworkBots(mission.id, work);
      totals.botPasses += passes.length;
      assert.deepEqual(passes, [], `${mission.id} passes without reading: ${passes.join(", ")}`);
    }
    assert.ok(keyLongest <= fields * .4, `${track.code} key is the longest option in ${keyLongest}/${fields} fields`);
    totals.fields += fields;
    totals.keyLongest += keyLongest;
  }
  const spread = Object.values(totals.positions);
  assert.ok(Math.max(...spread) <= totals.fields * .4, `displayed key position is spread across options: ${JSON.stringify(totals.positions)}`);
  // Lab checklists: ticking every box must fail.
  for (const [name, items] of [["packet fields", packetFields], ["brief sections", briefSections]]) {
    assert.ok(items.some(({ wrong }) => wrong) && items.some(({ wrong }) => !wrong), `${name} include a wrong item`);
  }
  const everyPacket = packetFields.map(({ id }) => id);
  assert.equal(runArchive({ ...archiveBaseline, keepRegister: true, south: "maps", parallel: true, packets: { register: everyPacket, maps: everyPacket },
    brief: briefSections.map(({ id }) => id) }).passes.some(Boolean) && runArchive({ ...archiveBaseline, keepRegister: true, south: "maps", parallel: true,
    packets: { register: everyPacket, maps: everyPacket }, brief: briefSections.map(({ id }) => id) }).passes.slice(1).every(Boolean), false, "check-all archive packets");
  assert.equal(runKitchen({ ...kitchenBaseline, typed: true, reconcile: true, trustPrinted: true }).passes[1], false, "check-all kitchen ledger");
  assert.equal(runKitchen({ ...kitchenBaseline, typed: true, reconcile: true }).passes[1], true, "kitchen ledger without the distractor");
  console.log(`Casework design · ${totals.fields} choice fields · key longest ${totals.keyLongest} · displayed key position ${JSON.stringify(totals.positions)} · ${totals.printed}/${totals.numbers} numeric answers printed · ${totals.botPasses} bot passes`);
}
// ---- END casework design checks ----

checkPortfolios();
checkRehearsals();
checkFieldwork();
checkCasework();
checkCaseworkDesign();
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
  // ---- BEGIN casework storage, mastery and legacy checks ----
  const bulletin = portfolio.find(({ id }) => id === "market-bulletin");
  const work = caseworkFor(bulletin.id);
  const baseline = startingCase(work);
  const corrected = solvedCase(work);
  const bulletinDraft = { ...corrected, send: "Publish now" };
  assert.equal(saveCityCasework(bulletin, baseline, true), null);
  assert.ok((await saveCityCasework(bulletin, baseline)).saved, "an unset draft can be saved");
  assert.deepEqual(readPortfolio()[bulletin.id].caseDraft, baseline);
  assert.ok(replayCasework(work, bulletinDraft).passed);
  assert.equal(saveCityCasework(bulletin, bulletinDraft, true), null, "the unseen case must meet the release policy");
  assert.ok((await saveCityCasework(bulletin, bulletinDraft)).saved);
  assert.deepEqual(readPortfolio()[bulletin.id].caseDraft, bulletinDraft);
  await saveCaseMastery(bulletin, (mastery) => ({ ...mastery, runs: 4, firstRunPassed: false, hints: { send: 3 }, failures: { send: 3 } }));
  assert.ok((await saveCityCasework(bulletin, corrected, true)).saved);
  assert.deepEqual(readPortfolio()[bulletin.id].casework, corrected);
  assert.equal(readPortfolio()[bulletin.id].caseDraft, undefined);
  const bulletinTrack = tracks.find(({ id }) => id === bulletin.track);
  const sendObjective = work.fields.find(({ id }) => id === "send").objective;
  let evidence = portfolioEvidence(bulletinTrack, readPortfolio(), new Set());
  assert.ok(evidence.guided.has(sendObjective) && !evidence.applied.has(sendObjective), "a worked example makes the objective guided, not applied");
  assert.ok(work.objectives.filter((objective) => objective !== sendObjective && caseIndependent(work, readPortfolio()[bulletin.id].mastery.credit, objective))
    .every((objective) => evidence.applied.has(objective)));
  await startCaseCycle(bulletin);
  assert.equal(readPortfolio()[bulletin.id].mastery.cycle, 1, "a fresh attempt reshuffles with the next cycle");
  assert.deepEqual(readPortfolio()[bulletin.id].casework, corrected, "a fresh attempt keeps the saved outcome");
  await saveCaseMastery(bulletin, (mastery) => ({ ...mastery, runs: 2, firstRunPassed: true, hints: { send: 1 } }));
  assert.ok((await saveCityCasework(bulletin, corrected, true)).saved);
  evidence = portfolioEvidence(bulletinTrack, readPortfolio(), new Set());
  assert.ok(evidence.applied.has(sendObjective) && !evidence.guided.has(sendObjective), "an independent later attempt earns applied credit");
  // Saves from before the redesign keep their completion and full credit.
  const enrollmentMission = portfolio.find(({ id }) => id === "enrollment-replies");
  stored.set(missionStoragePrefix + enrollmentMission.id, JSON.stringify({ casework: { date: "May 24", pending: "Mark pending", late: "Hold for lead" } }));
  const legacyRecord = readPortfolio()[enrollmentMission.id];
  assert.ok(missionCompleted(enrollmentMission, readPortfolio(), new Set()), "a legacy casework save stays complete");
  assert.equal(legacyRecord.mastery, undefined);
  assert.ok(caseworkFor(enrollmentMission.id).objectives.every((objective) =>
    portfolioEvidence(tracks.find(({ id }) => id === enrollmentMission.track), readPortfolio(), new Set()).applied.has(objective)), "legacy saves count as applied");
  stored.delete(missionStoragePrefix + enrollmentMission.id);
  // ---- END casework storage, mastery and legacy checks ----
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
  const { form: _form, priorExposure: _priorExposure, snapshot: _snapshot, ...oldDraft } = firstRehearsal;
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
  const recovery = createSession(track, "assessment", null, true, readProgress(track).attempts, Date.now(), readProgress(track).seen, decemberVersion, "recovery");
  assert.equal(recovery.itemIds.length, 70);
  assert.equal((await updateProgress(track, emptyProgress, { type: "start", draft: recovery })).saved, true);
  assert.equal(readProgress(track).draft.snapshot.id, recovery.snapshot.id);
  assert.equal(JSON.parse(stored.get(progressKey(track))).draft.snapshot, undefined, "uses archive references in persisted sessions");
  await updateProgress(track, emptyProgress, { type: "discard", id: recovery.id });
  assert.ok((await updateProgress(track, emptyProgress, { type: "start", draft: recovery })).error,
    "a stale selection with a prior question cannot masquerade as fresh");
  const afterDiscard = createSession(track, "assessment", null, true, readProgress(track).attempts, Date.now(), readProgress(track).seen, decemberVersion, "recovery");
  assert.equal(afterDiscard.itemIds.length, 70, "an extra reserve question allows recovery after discarding the initial question");
  assert.ok(!afterDiscard.itemIds.includes(recovery.itemIds[0]));
  assert.equal((await updateProgress(track, emptyProgress, { type: "start", draft: afterDiscard })).saved, true);
  const savedRecovery = await updateProgress(track, emptyProgress, { type: "submit", id: afterDiscard.id });
  assert.deepEqual(readProgress(track).attempts.at(-1).snapshot, savedRecovery.progress.attempts.at(-1).snapshot);
  const reassessment = createSession(track, "reassessment", 1, true, readProgress(track).attempts, Date.now(), readProgress(track).seen, decemberVersion);
  assert.equal(reassessment.itemIds.length, 4);
  assert.equal((await updateProgress(track, emptyProgress, { type: "start", draft: reassessment })).saved, true);
  for (const question of sessionItems(track, reassessment)) {
    for (const value of question.correct) await updateProgress(track, emptyProgress, { type: "choose", id: reassessment.id, itemId: question.id, value });
  }
  const domainResult = await updateProgress(track, emptyProgress, { type: "submit", id: reassessment.id });
  assert.ok(domainResult.saved);
  assert.equal(readProgress(track).attempts.at(-1).snapshot.id, reassessment.snapshot.id);
  assert.ok(timedEvidence(track, decemberVersion, readProgress(track).attempts).at(-1).domains[0].reassessed);
  assert.equal(readProgress(tracks[1]), null);
  stored.set(progressKey(track), "{corrupt");
  assert.equal(readProgress(track), null);
}

storageChecks().then(() => console.log("Coverage, answer keys, session selection and storage checks passed."))
  .catch((error) => { console.error(error); process.exitCode = 1; });
