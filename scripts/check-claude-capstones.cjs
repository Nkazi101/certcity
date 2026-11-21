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
const { decemberVersion, rehearsalBlueprint } = require("../lib/claude/december-blueprints.ts");
const { capstoneEvidence, getCapstoneDefinition, initialCapstoneDraft, scoreCapstone, validCapstoneAttempt } = require("../lib/claude/capstones/index.ts");

const earlier = "july-2026";
const due = 1 + 7 * 86400_000;
const associate = "associate-foundations";
const developer = "developer-foundations";
const architect = "architect-foundations";
const professional = "architect-professional";

function notice(date, hours, venue, capacity, contact, reviewer, sources) {
  return { date, hours, venue, capacity, contact, reviewer, sources, extra: "" };
}

function adapter(key, payload, failure) {
  return { adapter: JSON.stringify({
    assistantTurn: { role: "assistant", content: "$assistant.content" },
    match: { method: "equal", call: "$call.id", receipt: `$receipt.${key}` },
    resultRole: "user",
    result: { type: "tool_result", tool_use_id: "$call.id", content: `$receipt.${payload}`, is_error: `$receipt.${failure}` },
  }) };
}

function workflow(recordVersion, route, delegation) {
  return { plan: JSON.stringify({
    sequence: ["authorize", "load_records", "assign_workers", "reconcile", "release"],
    delegation: delegation.map(([worker, fields]) => ({ worker, fields })),
    recordVersion,
    preserve: true,
  }), retryOn: "temporary", retryLimit: "1", route };
}

function design(routine, complex, first, next, host, routineGate, complexGate, owner) {
  return {
    startRoutine: routine, startComplex: complex, startReview: first[0], startDeferred: first[1],
    changedRoutine: routine, changedComplex: complex, changedReview: next[0], changedDeferred: next[1],
    host, routineGate, complexGate, owner,
  };
}

const solved = [
  [associate, earlier, "capstone", notice("2026-11-26", "10:00–15:00", "North Lobby", "32", "access@riverbend.example", "Mina Das", "RB-26, OPS-09")],
  [associate, earlier, "transfer", notice("2026-12-08", "15:30–19:00", "Depot Room B", "24", "pickup@sparrow.example", "Owen Lam", "SP-19, VOL-08")],
  [associate, decemberVersion, "capstone", notice("2026-12-16", "13:00–17:30", "Maple Studio", "28", "helpdesk@willow.example", "Samir Tate", "WL-31, OPS-17")],
  [associate, decemberVersion, "transfer", notice("2026-12-23", "09:30–13:00", "Community Room 2", "36", "seeds@brook.example", "Rina Voss", "BG-12, GDN-06")],
  [developer, earlier, "capstone", adapter("call_id", "body", "failed")],
  [developer, earlier, "transfer", adapter("request_ref", "report", "unavailable")],
  [developer, decemberVersion, "capstone", adapter("invocation", "summary", "failed_read")],
  [developer, decemberVersion, "transfer", adapter("tool_ref", "finding", "timed_out")],
  [architect, earlier, "capstone", workflow("CANAL-REV-5", "Access review desk", [
    ["permit-register", ["site_id", "record_revision"]], ["inspection-log", ["site_id", "inspection_date"]],
  ])],
  [architect, earlier, "transfer", workflow("LOAN-REV-9", "Collections triage", [
    ["loan-ledger", ["loan_id", "storage_location"]], ["condition-register", ["accession_id", "record_revision"]],
  ])],
  [professional, earlier, "capstone", design("Circuit", "Lattice", ["10", "0"], ["8", "4"], "Regional private runtime", "95", "94", "Facilities duty lead")],
  [professional, earlier, "transfer", design("Beacon", "Harbor", ["8", "0"], ["7", "3"], "Partner tenant", "96", "95", "Recreation intake supervisor")],
  [professional, decemberVersion, "capstone", design("Keel", "Atlas", ["8", "0"], ["5", "4"], "Fleet approved tenant", "96", "95", "Fleet approval lead")],
  [professional, decemberVersion, "transfer", design("Folio", "Index", ["10", "0"], ["7", "7"], "Archive restricted tenancy", "97", "96", "Archive review manager")],
];

function checkCapstones() {
  const attempts = [];
  const ids = new Set();
  for (const [trackId, version, stage, draft] of solved) {
    const definition = getCapstoneDefinition(trackId, version, stage);
    const track = tracks.find(({ id }) => id === trackId);
    const domains = rehearsalBlueprint(track, version).domains;
    const objectiveIds = new Set(domains.flatMap(({ id, objectives }) => objectives.map((_, index) => `${id}.${index + 1}`)));
    const initial = initialCapstoneDraft(definition);
    const baseline = scoreCapstone(trackId, version, stage, initial);
    assert.equal(baseline.passed, false, `${definition.id} requires learner work`);
    assert.equal(ids.has(definition.id), false, definition.id);
    ids.add(definition.id);
    assert.ok(definition.reference.url.startsWith("https://"), definition.id);
    assert.equal(new Set(definition.fields.map(({ id }) => id)).size, definition.fields.length, definition.id);
    assert.equal(new Set(definition.criteria.map(({ id }) => id)).size, definition.criteria.length, definition.id);

    const result = scoreCapstone(trackId, version, stage, draft);
    assert.equal(result.passed, true, `${definition.id}: ${result.results.filter((check) => !check.passed).map(({ detail }) => detail).join(" ")}`);
    assert.ok(result.results.every(({ objectives }) => objectives.length > 0 && objectives.every((id) => objectiveIds.has(id))),
      `${definition.id} uses objectives from the selected guide`);
    const attempt = { ...result, id: definition.id, submittedAt: stage === "capstone" ? 1 : due };
    assert.ok(validCapstoneAttempt(attempt));
    attempts.push(attempt);
    assert.ok(!validCapstoneAttempt({ ...attempt, artifact: initial }));
    assert.ok(!validCapstoneAttempt({ ...attempt, results: [{ ...attempt.results[0], objectives: ["99.1"] }, ...attempt.results.slice(1)] }));
    assert.ok(!validCapstoneAttempt({ ...attempt, stage: stage === "capstone" ? "transfer" : "capstone" }));

    const preview = definition.preview(draft);
    if (trackId === associate) {
      assert.equal(preview.kind, "notice");
      assert.ok(preview.body.includes(draft.venue));
      assert.ok(preview.handoff.includes(draft.reviewer));
      const wrong = scoreCapstone(trackId, version, stage, { ...draft, extra: "An unconfirmed perk." });
      assert.ok(!wrong.results.find(({ criterion }) => criterion === "hold").passed);
    }
    if (trackId === developer) {
      assert.equal(preview.kind, "console");
      const [, fault] = JSON.parse(definition.preview(draft, "1").text);
      assert.equal(fault.content.filter(({ is_error: failed }) => failed).length, 1);
      assert.ok(fault.content.some(({ content, is_error: failed }) => content === "No matching record." && !failed));
      const arrangement = JSON.parse(draft.adapter);
      arrangement.match.method = "index";
      const wrong = scoreCapstone(trackId, version, stage, { adapter: JSON.stringify(arrangement) });
      assert.ok(!wrong.results.find(({ criterion }) => criterion === "association").passed);
    }
    if (trackId === architect) {
      assert.deepEqual(definition.preview(draft, "denied").steps, ["Authorization denied. Workflow stopped."]);
      const permanent = definition.preview(draft, "permanent");
      assert.equal(permanent.citations.length, 1);
      assert.equal(permanent.missing.length, 1);
      const wrong = scoreCapstone(trackId, version, stage, { ...draft, retryOn: "permanent" });
      assert.ok(!wrong.results.find(({ criterion }) => criterion === "retry").passed);
    }
    if (trackId === professional) {
      assert.equal(preview.kind, "comparison");
      assert.equal(preview.windows.length, 2);
      assert.ok(preview.windows.every(({ cost, budget, minutes, reviewMinutes }) => cost <= budget && minutes <= reviewMinutes));
      const wrong = scoreCapstone(trackId, version, stage, { ...draft, changedReview: "100" });
      assert.ok(!wrong.results.find(({ criterion }) => criterion === "cost").passed);
      assert.ok(!wrong.results.find(({ criterion }) => criterion === "flow").passed);
    }
  }

  for (const capstone of attempts.filter(({ stage }) => stage === "capstone")) {
    const { trackId, version } = capstone;
    const transfer = attempts.find((attempt) => attempt.trackId === trackId && attempt.version === version && attempt.stage === "transfer");
    assert.equal(capstoneEvidence(trackId, version, attempts, due - 1).transfer, undefined);
    assert.equal(capstoneEvidence(trackId, version, [capstone, { ...transfer, submittedAt: due - 1 }], due + 1).transfer, undefined);
    assert.equal(capstoneEvidence(trackId, version, [capstone, { ...transfer, scenarioId: capstone.scenarioId }], due).transfer, undefined);
    assert.equal(capstoneEvidence(trackId, version, attempts, due).transferDue, due);
    assert.equal(capstoneEvidence(trackId, version, attempts, due).transfer, transfer);
    if (trackId !== architect) {
      const otherGuide = version === earlier ? decemberVersion : earlier;
      assert.equal(capstoneEvidence(trackId, otherGuide, [capstone, transfer], due).transferDue, null);
    }
  }

  console.log(`${ids.size} practicals passed solution, regression, guide mapping, and delayed eligibility checks.`);
}

if (require.main === module) checkCapstones();
module.exports = { solved };
