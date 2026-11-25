// Audits the December guide-practice decisions (lib/claude/curriculum/{associate,developer,professional}.ts).
// Same approach as check-item-quality.cjs: a learner with no subject knowledge must not be able to pick the key
// by length, by "careful" wording or by position.
// Usage: node scripts/check-guide-decisions.cjs [--enforce] [--track <id>] [--list]
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
const { sources } = load("items.ts");
const { guideChoices } = load("curriculum/guide-options.ts");
const studies = {
  "associate-foundations": load("curriculum/associate.ts").associateStudy,
  "developer-foundations": load("curriculum/developer.ts").developerStudy,
  "architect-professional": load("curriculum/professional.ts").professionalStudy,
};

const args = process.argv.slice(2);
const enforce = args.includes("--enforce");
const list = args.includes("--list");
const onlyTrack = args.includes("--track") ? args[args.indexOf("--track") + 1] : null;

// Per-track limits. Chance is 25–33% with three or four options.
const limits = { keyLongest: 30, keyShortest: 35, cueGuesser: 35, keySlot: 40, meanRatio: 1.3 };
// Per-decision limits.
const ratioMax = 1.5; // longest option / shortest option, in characters
const patterns = new Set(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11"]);

// Same cue vocabulary as check-item-quality.cjs.
const careful = /\b(verif\w*|validat\w*|test\w*|scop\w*|authori[sz]\w*|evidence|sources?|review\w*|compar\w*|measur\w*|labeled|approv\w*|separat\w*|enforc\w*|preserv\w*|explicit\w*|current|match\w*|representative|calibrat\w*|slices?|owner|bound\w*|flag\w*|confirm\w*|document\w*|isolat\w*|least|record\w*)\b/gi;
const reckless = /\b(only|always|every|all|assume\w*|ignore\w*|skip\w*|immediately|whichever|regardless|trust\w*|guess\w*|infer\w*|longest|shortest|confident\w*|never|indefinitely|any|automatically|remove\w*|disable\w*)\b/gi;
// Giveaways named in research/ai-slop-audit.md (I2) plus strawman verbs.
const giveaway = /^(only|just|declare)\b|\bunapproved\b|\bhope\b|\bwithout (checking|review)/i;
const slop = /—|\s·\s|\bnot only\b|\bseamless|\bleverag|\brobust\b/i;
const count = (text, pattern) => (text.match(pattern) || []).length;
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const sentences = (text) => text.split(/(?<=[.?!])\s+(?=[A-Z0-9“"])/).filter(Boolean).length;
const pct = (part, whole) => whole ? Math.round(1000 * part / whole) / 10 : 0;

let failed = false;
const seenCases = new Set();
for (const [track, study] of Object.entries(studies)) {
  if (onlyTrack && track !== onlyTrack) continue;
  const problems = [];
  const rows = [];
  for (const activity of study) {
    const [objective, source, caseFile, answer, explanation, distractors] = activity;
    const where = `${track} ${objective}`;
    if (!sources[source]) problems.push(`${where}: unknown source ${source}`);
    if (seenCases.has(caseFile)) problems.push(`${where}: duplicate case text`);
    seenCases.add(caseFile);
    const caseSentences = sentences(caseFile);
    if (caseSentences < 2 || caseSentences > 3) problems.push(`${where}: case has ${caseSentences} sentences (want 2–3)`);
    if (words(caseFile) > 60) problems.push(`${where}: case is ${words(caseFile)} words (max 60)`);
    if (!Array.isArray(distractors) || distractors.length < 2 || distractors.length > 3) {
      problems.push(`${where}: needs 3–4 options in total`);
      continue;
    }
    if (!explanation || words(explanation) < 12) problems.push(`${where}: explanation too short`);
    const options = [answer, ...distractors];
    const texts = options.map(([text]) => text);
    if (new Set(texts).size !== texts.length) problems.push(`${where}: duplicate option`);
    for (const [text, consequence, pattern] of options) {
      if (!text || !consequence) problems.push(`${where}: option without a consequence: ${text}`);
      if (consequence && words(consequence) < 6) problems.push(`${where}: consequence too short: ${consequence}`);
      if (slop.test(`${text} ${consequence}`)) problems.push(`${where}: separator or slop wording: ${text}`);
    }
    if (slop.test(caseFile) || slop.test(explanation)) problems.push(`${where}: separator or slop wording in case/explanation`);
    for (const [text, , pattern] of distractors) {
      if (!patterns.has(pattern)) problems.push(`${where}: distractor without a D1–D11 pattern: ${text}`);
      if (giveaway.test(text)) problems.push(`${where}: giveaway wording: ${text}`);
    }
    const lengths = texts.map((text) => text.length);
    const max = Math.max(...lengths), min = Math.min(...lengths);
    const ratio = max / min;
    if (ratio > ratioMax) problems.push(`${where}: option length ratio ${ratio.toFixed(2)} > ${ratioMax}`);
    const scores = texts.map((text) => count(text, careful) - count(text, reckless));
    const top = Math.max(...scores);
    const leaders = scores.flatMap((score, index) => score === top ? [index] : []);
    const displayed = guideChoices(activity);
    rows.push({
      objective,
      options: options.length,
      longest: lengths[0] === max && lengths.filter((length) => length === max).length === 1,
      shortest: lengths[0] === min && lengths.filter((length) => length === min).length === 1,
      cue: leaders.includes(0) ? 1 / leaders.length : 0,
      ratio,
      slot: displayed.findIndex(({ correct }) => correct),
      optionWords: texts.reduce((sum, text) => sum + words(text), 0) / texts.length,
      caseWords: words(caseFile),
    });
  }
  const n = rows.length;
  const slots = [0, 1, 2, 3].map((slot) => pct(rows.filter((row) => row.slot === slot).length, n));
  const summary = {
    decisions: n,
    fourOption: pct(rows.filter((row) => row.options === 4).length, n),
    keyLongest: pct(rows.filter((row) => row.longest).length, n),
    keyShortest: pct(rows.filter((row) => row.shortest).length, n),
    cueGuesser: pct(rows.reduce((sum, row) => sum + row.cue, 0), n),
    meanRatio: Math.round(100 * rows.reduce((sum, row) => sum + row.ratio, 0) / n) / 100,
    worstRatio: Math.round(100 * Math.max(...rows.map((row) => row.ratio))) / 100,
    keySlot: Math.max(...slots),
    optionWords: Math.round(10 * rows.reduce((sum, row) => sum + row.optionWords, 0) / n) / 10,
    caseWords: Math.round(10 * rows.reduce((sum, row) => sum + row.caseWords, 0) / n) / 10,
  };
  const breaches = [
    summary.keyLongest > limits.keyLongest && `key uniquely longest in ${summary.keyLongest}% > ${limits.keyLongest}%`,
    summary.keyShortest > limits.keyShortest && `key uniquely shortest in ${summary.keyShortest}% > ${limits.keyShortest}%`,
    summary.cueGuesser > limits.cueGuesser && `cue-word guesser ${summary.cueGuesser}% > ${limits.cueGuesser}%`,
    summary.keySlot > limits.keySlot && `one display slot holds ${summary.keySlot}% of keys > ${limits.keySlot}%`,
    summary.meanRatio > limits.meanRatio && `mean length ratio ${summary.meanRatio} > ${limits.meanRatio}`,
  ].filter(Boolean);
  console.log(`\n${track} · ${n} guide decisions (${summary.fourOption}% with four options)`);
  console.log(`  key longest ${summary.keyLongest}% · key shortest ${summary.keyShortest}% · cue guesser ${summary.cueGuesser}% · length ratio mean ${summary.meanRatio} worst ${summary.worstRatio} · key slots ${slots.join("/")}% · option ${summary.optionWords} words · case ${summary.caseWords} words`);
  if (list) for (const row of rows.filter((row) => row.longest || row.cue === 1)) console.log(`  cue risk ${row.objective}: ${row.longest ? "key longest " : ""}${row.cue === 1 ? "cue words favor key" : ""}`);
  for (const problem of problems) console.log(`  ${enforce ? "FAIL" : "WARN"}: ${problem}`);
  if (breaches.length) console.log(`  ${enforce ? "FAIL" : "WARN"}: ${breaches.join("; ")}`);
  if (problems.length || breaches.length) failed = true;
}

if (enforce && failed) {
  console.error("\nGuide decision quality limits not met.");
  process.exit(1);
}
