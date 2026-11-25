// Measures whether practice questions can be answered without subject knowledge.
// Usage: node scripts/check-item-quality.cjs [--enforce] [--json <file>] [--track <id>]
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, file) => {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(code.outputText, file);
};

const root = path.join(__dirname, "..");
const load = (file) => require(path.join(root, "lib/claude", file));
const { tracks } = load("blueprints.ts");
const { decemberBlueprints } = load("december-blueprints.ts");
const { banks } = load("practice.ts");
const { rehearsalItems } = load("assessment/forms.ts");
const { recoveryBank } = load("assessment/recovery-bank.ts");
const { revisedPracticeBanks } = load("curriculum/revised-practice.ts");
const { cityChecks } = load("city-checks.ts");
const { missionsFor, missionQuestions } = load("pathway.ts");

const args = process.argv.slice(2);
const enforce = args.includes("--enforce");
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const onlyTrack = args.includes("--track") ? args[args.indexOf("--track") + 1] : null;

// Thresholds a no-knowledge test taker must not beat. Chance is 25% for four options.
const limits = { cueGuesser: 35, longestCorrect: 30, rationaleCoverage: 100, explanationWords: 25, keyPosition: 35 };
// Style targets from research/exam-realism.md (official December 7 and November samples).
const style = {
  "CCAR-F": { stem: 40, option: 14, multiMax: 12 },
  "CCAR-P": { stem: 60, option: 18, multiMax: 40 },
  // CCDV-P v1.0 samples: 77-word stems, about 20-word options; the guide confirms multiple-response items exist.
  "CCDV-P": { stem: 60, option: 18, multiMax: 20 },
  "CCDV-F": { stem: 50, option: 16, multiMax: 10 },
  "CCAO-F": { stem: 45, option: 16, multiMax: 28 },
};

// Words that signal "sounds careful" or "sounds reckless" regardless of the subject.
const careful = /\b(verif\w*|validat\w*|test\w*|scop\w*|authori[sz]\w*|evidence|sources?|review\w*|compar\w*|measur\w*|labeled|approv\w*|separat\w*|enforc\w*|preserv\w*|explicit\w*|current|match\w*|representative|calibrat\w*|slices?|owner|bound\w*|flag\w*|confirm\w*|document\w*|isolat\w*|least|record\w*)\b/gi;
const reckless = /\b(only|always|every|all|assume\w*|ignore\w*|skip\w*|immediately|whichever|regardless|trust\w*|guess\w*|infer\w*|longest|shortest|confident\w*|never|indefinitely|any|automatically|remove\w*|disable\w*)\b/gi;
const count = (text, pattern) => (text.match(pattern) || []).length;
const words = (text) => (text || "").split(/\s+/).filter(Boolean).length;

// Map each item id to the file that defines it, so reports point at something editable.
const sourceIndex = new Map();
function indexSources(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) indexSources(file);
    else if (file.endsWith(".ts")) {
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/["'`]([a-z0-9][\w.-]{2,})["'`]/gi)) {
        if (!sourceIndex.has(match[1])) sourceIndex.set(match[1], path.relative(root, file));
      }
    }
  }
}
indexSources(path.join(root, "lib/claude"));

function pools(track) {
  const result = { "practice (July)": banks[track.id].practice, "follow-up (July)": banks[track.id].followup };
  const versions = ["july-2026"];
  if (decemberBlueprints[track.id]) {
    versions.push("december-2026");
    result["practice (Dec)"] = revisedPracticeBanks[track.id]?.practice ?? [];
    result["follow-up (Dec)"] = revisedPracticeBanks[track.id]?.followup ?? [];
  }
  for (const version of versions) {
    const label = version === "july-2026" ? (track.id === "architect-foundations" ? "Nov" : "July") : "Dec";
    for (const form of ["original", "retest", "recovery"]) result[`form ${form} (${label})`] = rehearsalItems(track.id, version, form);
    result[`reassessment pool (${label})`] = recoveryBank(track.id, version).focused;
  }
  result["city checks"] = cityChecks[track.id] ?? [];
  result["mission checks"] = missionsFor(track.id).flatMap((mission) => {
    try { return missionQuestions(mission); } catch { return []; }
  });
  return result;
}

function evaluate(item) {
  const lengths = item.options.map(([, text]) => text.length);
  const scores = item.options.map(([, text]) => count(text, careful) - count(text, reckless));
  const single = item.correct.length === 1;
  const correctIndex = item.options.findIndex(([value]) => value === item.correct[0]);
  const top = Math.max(...scores);
  const leaders = scores.flatMap((score, index) => score === top ? [index] : []);
  const cue = single ? (leaders.includes(correctIndex) ? 1 / leaders.length : 0) : null;
  const longest = single ? lengths[correctIndex] === Math.max(...lengths) && lengths.filter((l) => l === Math.max(...lengths)).length === 1 : null;
  const rationales = item.options.every(([value]) => (item.rationales?.[value] ?? "").trim().length > 0);
  return {
    id: item.id, objective: item.objective, file: sourceIndex.get(item.id) ?? "unknown", single, cue, longest, rationales,
    stemWords: words(item.prompt), optionWords: item.options.reduce((sum, [, text]) => sum + words(text), 0) / item.options.length,
    key: single ? item.correct[0] : null, explanationWords: words(item.explanation),
    exhibit: /[{}<>`]|\b\w+_\w+\b|--\w|\.json\b|\.md\b/.test(`${item.context ?? ""} ${item.prompt}`),
  };
}

const pct = (part, whole) => whole ? Math.round(1000 * part / whole) / 10 : 0;
const mean = (values) => values.length ? Math.round(10 * values.reduce((a, b) => a + b, 0) / values.length) / 10 : 0;
const report = [];
let failed = false;

for (const track of tracks.filter(({ id }) => !onlyTrack || id === onlyTrack)) {
  const unique = new Map();
  const poolRows = [];
  for (const [name, items] of Object.entries(pools(track))) {
    const results = items.map((item) => { const result = evaluate(item); unique.set(item.id, result); return result; });
    const single = results.filter((result) => result.single);
    poolRows.push({ pool: name, items: results.length, cue: pct(single.reduce((a, r) => a + r.cue, 0), single.length), longest: pct(single.filter((r) => r.longest).length, single.length) });
  }
  const all = [...unique.values()];
  const single = all.filter((result) => result.single);
  const summary = {
    track: track.code, items: all.length,
    cueGuesser: pct(single.reduce((a, r) => a + r.cue, 0), single.length),
    longestCorrect: pct(single.filter((r) => r.longest).length, single.length),
    rationaleCoverage: pct(all.filter((r) => r.rationales).length, all.length),
    explanationWords: mean(all.map((r) => r.explanationWords)),
    stemWords: mean(all.map((r) => r.stemWords)),
    optionWords: mean(all.map((r) => r.optionWords)),
    keyPosition: Math.max(...["a", "b", "c", "d"].map((key) => pct(single.filter((r) => r.key === key).length, single.length))),
    exhibitShare: pct(all.filter((r) => r.exhibit).length, all.length),
    multiSelectShare: pct(all.filter((r) => !r.single).length, all.length),
  };
  const breaches = [
    summary.cueGuesser > limits.cueGuesser && `cue guesser ${summary.cueGuesser}% > ${limits.cueGuesser}%`,
    summary.longestCorrect > limits.longestCorrect && `longest-correct ${summary.longestCorrect}% > ${limits.longestCorrect}%`,
    summary.rationaleCoverage < limits.rationaleCoverage && `rationale coverage ${summary.rationaleCoverage}% < ${limits.rationaleCoverage}%`,
    summary.explanationWords < limits.explanationWords && `mean explanation ${summary.explanationWords} words < ${limits.explanationWords}`,
    summary.keyPosition > limits.keyPosition && `one key letter holds ${summary.keyPosition}% of answers > ${limits.keyPosition}%`,
    summary.stemWords < style[track.code].stem && `mean stem ${summary.stemWords} words < ${style[track.code].stem}`,
    summary.optionWords < style[track.code].option && `mean option ${summary.optionWords} words < ${style[track.code].option}`,
    summary.multiSelectShare > style[track.code].multiMax && `multi-select ${summary.multiSelectShare}% > ${style[track.code].multiMax}%`,
  ].filter(Boolean);
  if (breaches.length) failed = true;
  report.push({ summary, pools: poolRows, breaches, flagged: all.filter((r) => (r.single && (r.cue === 1 || r.longest)) || !r.rationales || r.explanationWords < limits.explanationWords) });
  console.log(`\n${track.code} · ${all.length} unique served items`);
  console.log(`  cue guesser ${summary.cueGuesser}% · longest correct ${summary.longestCorrect}% · top key letter ${summary.keyPosition}% · rationales ${summary.rationaleCoverage}% · explanation ${summary.explanationWords} words · stem ${summary.stemWords} words · option ${summary.optionWords} words · exhibits ${summary.exhibitShare}% · multi-select ${summary.multiSelectShare}%`);
  for (const row of poolRows) console.log(`  ${row.pool.padEnd(28)} ${String(row.items).padStart(4)} items · cue ${row.cue}% · longest ${row.longest}%`);
  if (breaches.length) console.log(`  ${enforce ? "FAIL" : "WARN"}: ${breaches.join("; ")}`);
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
if (enforce && failed) {
  console.error("\nItem-quality limits not met. Run without --enforce for the full report, or --json <file> for flagged items.");
  process.exit(1);
}
