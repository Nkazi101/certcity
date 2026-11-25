// CCDV-P content checks, limited to the Developer Professional files (not yet registered in the shared registries).
// Runs the item-quality audit from scripts/check-item-quality.cjs on the CCDV-P practice bank and practice exam forms,
// checks form blueprints, item structure, lesson structure, and the starter lab's honesty (reference passes, starter
// fails per objective, mutants fail exactly their targets, overfit fails transfer, symptoms never name the fix).
// Usage: node scripts/check-ccdv-p.cjs [--only track,bank,form1,form2,lessons,lab] [--verbose] [--json <file>]
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
const files = {
  track: "lib/claude/tracks/developer-professional.ts",
  bank: "lib/claude/developer-professional-bank.ts",
  form1: "lib/claude/assessment/developer-professional.ts",
  form2: "lib/claude/assessment/developer-professional-retest.ts",
  lessons: "lib/claude/lessons/developer-professional.ts",
  lab: "lib/labs/claude/stadium-fallbacks.ts",
};
const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const verbose = args.includes("--verbose");
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const wanted = (part) => !only || only.has(part);
const exists = (part) => fs.existsSync(path.join(root, files[part]));
const load = (part) => require(path.join(root, files[part]));

const errors = [];
const warnings = [];
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

// ---------------------------------------------------------------- track
const { developerProfessionalTrack: track, developerProfessionalScores: scores, developerProfessionalUnscored: unscored } = load("track");
const { sources } = require(path.join(root, "lib/claude/items.ts"));
const objectiveNames = new Map(track.domains.flatMap((domain) => domain.objectives.map((name, index) => [`${domain.id}.${index + 1}`, name])));
if (wanted("track")) {
  const total = track.domains.reduce((sum, { weight }) => sum + weight, 0);
  if (Math.abs(total - 100) > 1e-9) fail(`track: weights sum to ${total}, not 100`);
  if (track.domains.length !== 8) fail(`track: ${track.domains.length} domains, guide has 8`);
  if (objectiveNames.size !== 25) fail(`track: ${objectiveNames.size} objectives, guide has 25`);
  if (track.count !== 70 || track.fee !== 175) fail("track: guide says 70 items and $175");
  if (scores.reduce((a, b) => a + b, 0) + unscored !== track.count) fail("track: scored + unscored must equal count");
  // Largest-remainder rounding of weight x 60 (forms.ts weightedCounts).
  const quotas = track.domains.map(({ weight }) => weight * 60 / 100);
  const counts = quotas.map(Math.floor);
  quotas.map((quota, index) => ({ index, fraction: quota - counts[index] })).sort((a, b) => b.fraction - a.fraction)
    .slice(0, 60 - counts.reduce((a, b) => a + b, 0)).forEach(({ index }) => counts[index]++);
  if (counts.join() !== scores.join()) fail(`track: scores ${scores} differ from weighted counts ${counts}`);
}

// ---------------------------------------------------------------- items
// Same cue vocabulary and metrics as scripts/check-item-quality.cjs.
const limits = { cueGuesser: 35, longestCorrect: 30, rationaleCoverage: 100, explanationWords: 25, keyPosition: 35 };
const style = { stem: 60, option: 18, multiMax: 20 };
const careful = /\b(verif\w*|validat\w*|test\w*|scop\w*|authori[sz]\w*|evidence|sources?|review\w*|compar\w*|measur\w*|labeled|approv\w*|separat\w*|enforc\w*|preserv\w*|explicit\w*|current|match\w*|representative|calibrat\w*|slices?|owner|bound\w*|flag\w*|confirm\w*|document\w*|isolat\w*|least|record\w*)\b/gi;
const reckless = /\b(only|always|every|all|assume\w*|ignore\w*|skip\w*|immediately|whichever|regardless|trust\w*|guess\w*|infer\w*|longest|shortest|confident\w*|never|indefinitely|any|automatically|remove\w*|disable\w*)\b/gi;
const count = (text, pattern) => (text.match(pattern) || []).length;
const words = (text) => (text || "").split(/\s+/).filter(Boolean).length;
const slop = /\b(unlock\w*|elevat\w*|seamless\w*|robust\w*|leverag\w*|journey|hands-on|mastery|delve\w*|game-?changer)\b/i;

function evaluate(item) {
  const lengths = item.options.map(([, text]) => text.length);
  const scoresByOption = item.options.map(([, text]) => count(text, careful) - count(text, reckless));
  const single = item.correct.length === 1;
  const correctIndex = item.options.findIndex(([value]) => value === item.correct[0]);
  const top = Math.max(...scoresByOption);
  const leaders = scoresByOption.flatMap((score, index) => score === top ? [index] : []);
  const cue = single ? (leaders.includes(correctIndex) ? 1 / leaders.length : 0) : null;
  const longest = single ? lengths[correctIndex] === Math.max(...lengths) && lengths.filter((l) => l === Math.max(...lengths)).length === 1 : null;
  const rationales = item.options.every(([value]) => (item.rationales?.[value] ?? "").trim().length > 0);
  // Inverse cues: a test taker who learns that keys sound plainer or shorter than distractors must not beat chance either.
  const pickLowest = (values) => {
    const low = Math.min(...values);
    const leaders = values.flatMap((value, index) => value === low ? [index] : []);
    return leaders.includes(correctIndex) ? 1 / leaders.length : 0;
  };
  const shortest = single ? pickLowest(lengths) : null;
  const plainest = single ? pickLowest(scoresByOption) : null;
  return {
    id: item.id, objective: item.objective, single, cue, longest, rationales, shortest, plainest,
    stemWords: words(item.prompt), optionWords: item.options.reduce((sum, [, text]) => sum + words(text), 0) / item.options.length,
    key: single ? item.correct[0] : null, explanationWords: words(item.explanation),
  };
}
const pct = (part, whole) => whole ? Math.round(1000 * part / whole) / 10 : 0;
const mean = (values) => values.length ? Math.round(10 * values.reduce((a, b) => a + b, 0) / values.length) / 10 : 0;

function summarize(items) {
  const all = items.map(evaluate);
  const single = all.filter((r) => r.single);
  return {
    items: all.length,
    cueGuesser: pct(single.reduce((a, r) => a + r.cue, 0), single.length),
    longestCorrect: pct(single.filter((r) => r.longest).length, single.length),
    shortestGuesser: pct(single.reduce((a, r) => a + r.shortest, 0), single.length),
    plainestGuesser: pct(single.reduce((a, r) => a + r.plainest, 0), single.length),
    rationaleCoverage: pct(all.filter((r) => r.rationales).length, all.length),
    explanationWords: mean(all.map((r) => r.explanationWords)),
    stemWords: mean(all.map((r) => r.stemWords)),
    optionWords: mean(all.map((r) => r.optionWords)),
    keyPosition: Math.max(...["a", "b", "c", "d"].map((key) => pct(single.filter((r) => r.key === key).length, single.length))),
    keys: Object.fromEntries(["a", "b", "c", "d", "e"].map((key) => [key, single.filter((r) => r.key === key).length])),
    multiSelectShare: pct(all.filter((r) => !r.single).length, all.length),
    flagged: all.filter((r) => (r.single && (r.cue === 1 || r.longest)) || !r.rationales || r.explanationWords < limits.explanationWords),
  };
}

function breaches(label, summary, { keyBalance = true } = {}) {
  return [
    summary.cueGuesser > limits.cueGuesser && `cue guesser ${summary.cueGuesser}% > ${limits.cueGuesser}%`,
    summary.longestCorrect > limits.longestCorrect && `longest-correct ${summary.longestCorrect}% > ${limits.longestCorrect}%`,
    summary.shortestGuesser > limits.cueGuesser && `shortest-option guesser ${summary.shortestGuesser}% > ${limits.cueGuesser}%`,
    summary.plainestGuesser > limits.cueGuesser && `plainest-option guesser ${summary.plainestGuesser}% > ${limits.cueGuesser}%`,
    summary.rationaleCoverage < limits.rationaleCoverage && `rationale coverage ${summary.rationaleCoverage}% < 100%`,
    summary.explanationWords < limits.explanationWords && `mean explanation ${summary.explanationWords} words < ${limits.explanationWords}`,
    keyBalance && summary.keyPosition > limits.keyPosition && `one key letter holds ${summary.keyPosition}% of answers`,
    summary.stemWords < style.stem && `mean stem ${summary.stemWords} words < ${style.stem}`,
    summary.optionWords < style.option && `mean option ${summary.optionWords} words < ${style.option}`,
    summary.multiSelectShare > style.multiMax && `multi-select ${summary.multiSelectShare}% > ${style.multiMax}%`,
  ].filter(Boolean).map((message) => `${label}: ${message}`);
}

function structure(label, item) {
  const where = `${label} ${item.id}`;
  if (!objectiveNames.has(item.objective)) fail(`${where}: objective ${item.objective} is not in the CCDV-P blueprint`);
  if (!(item.source in sources)) fail(`${where}: unknown source ${item.source}`);
  const multi = item.correct.length > 1;
  if (multi && (item.correct.length !== 2 || item.options.length !== 5)) fail(`${where}: multi-response items select 2 of 5`);
  if (!multi && item.options.length !== 4) fail(`${where}: single-answer items have 4 options`);
  if (multi && !/Select TWO/.test(item.prompt)) fail(`${where}: multi-response prompt must say "Select TWO"`);
  if (!multi && /Select TWO/.test(item.prompt)) fail(`${where}: single-answer prompt says "Select TWO"`);
  for (const key of item.correct) if (!item.options.some(([value]) => value === key)) fail(`${where}: key ${key} is not an option`);
  if (new Set(item.options.map(([, text]) => text)).size !== item.options.length) fail(`${where}: duplicate option text`);
  if (!item.scenario || words(item.scenario) > 8) fail(`${where}: scenario label missing or longer than 8 words`);
  const text = [item.scenario, item.context ?? "", item.prompt, item.explanation, ...item.options.map(([, t]) => t), ...Object.values(item.rationales)].join(" ");
  if (text.includes("—")) fail(`${where}: em dash`);
  if (slop.test(text)) fail(`${where}: filler word "${text.match(slop)[0]}"`);
  if ((item.prompt.match(/`/g) ?? []).length % 2) fail(`${where}: unbalanced backticks in prompt`);
  if (/\b(?:option|answer) [A-E]\b|\b[A-E]\) /.test(Object.values(item.rationales).join(" ") + item.explanation)) {
    fail(`${where}: rationales must not cite option letters (forms are reshuffled)`);
  }
}

function formChecks(label, form) {
  if (form.length !== track.count) fail(`${label}: ${form.length} items, guide forms have ${track.count}`);
  const pilots = form.filter(({ pilot }) => pilot);
  if (pilots.length !== unscored) fail(`${label}: ${pilots.length} unscored items, guide has ${unscored}`);
  const scored = form.filter(({ pilot }) => !pilot);
  track.domains.forEach(({ id }, index) => {
    const n = scored.filter(({ objective }) => objective.startsWith(`${id}.`)).length;
    if (n !== scores[index]) fail(`${label}: domain ${id} has ${n} scored items, blueprint needs ${scores[index]}`);
  });
  for (const objective of objectiveNames.keys()) {
    if (!scored.some((item) => item.objective === objective)) fail(`${label}: no scored item for ${objective}`);
  }
  const multi = form.filter(({ correct }) => correct.length > 1).length;
  if (multi < 7) fail(`${label}: ${multi} multi-response items; the guide format includes them (target 10-20%)`);
}

const pools = {};
if (wanted("bank") && exists("bank")) {
  const { developerProfessionalBank } = load("bank");
  pools["practice"] = developerProfessionalBank.practice;
  pools["follow-up"] = developerProfessionalBank.followup;
  const practiceObjectives = new Set(developerProfessionalBank.practice.map(({ objective }) => objective));
  for (const objective of objectiveNames.keys()) {
    const n = developerProfessionalBank.practice.filter((item) => item.objective === objective).length;
    if (n < 2) fail(`bank: practice has ${n} items for ${objective}; mixed and domain practice need at least 2`);
    if (!developerProfessionalBank.followup.some((item) => item.objective === objective)) fail(`bank: no follow-up item for ${objective}`);
  }
  void practiceObjectives;
} else if (wanted("bank")) warn("bank: file not written yet");
if (wanted("form1") && exists("form1")) {
  const module = load("form1");
  pools["exam 1"] = module.developerProfessionalAssessment;
  formChecks("exam 1", pools["exam 1"]);
} else if (wanted("form1")) warn("exam 1: file not written yet");
if (wanted("form2") && exists("form2")) {
  pools["exam 2"] = load("form2").developerProfessionalRetest;
  formChecks("exam 2", pools["exam 2"]);
} else if (wanted("form2")) warn("exam 2: file not written yet");

const allItems = Object.values(pools).flat();
const seenIds = new Map();
const seenPrompts = new Map();
for (const [label, items] of Object.entries(pools)) {
  for (const item of items) {
    structure(label, item);
    if (!item.id.startsWith("ccdvp-")) fail(`${label} ${item.id}: ids start with "ccdvp-" so they never collide with other tracks`);
    if (seenIds.has(item.id)) fail(`${label} ${item.id}: id also used in ${seenIds.get(item.id)}`);
    seenIds.set(item.id, label);
    const prompt = item.prompt.trim().toLowerCase();
    if (seenPrompts.has(prompt)) fail(`${label} ${item.id}: same prompt as ${seenPrompts.get(prompt)}`);
    seenPrompts.set(prompt, `${label} ${item.id}`);
  }
}

const report = { pools: {}, overall: null, flagged: [] };
for (const [label, items] of Object.entries(pools)) {
  const summary = summarize(items);
  report.pools[label] = summary;
  // Small pools only report key balance; forms and the overall set must balance.
  for (const message of breaches(label, summary, { keyBalance: items.length >= 40 })) fail(message);
  console.log(`${label.padEnd(10)} ${String(summary.items).padStart(3)} items · cue ${summary.cueGuesser}% · longest ${summary.longestCorrect}% · shortest ${summary.shortestGuesser}% · plainest ${summary.plainestGuesser}% · keys ${JSON.stringify(summary.keys)} · rationales ${summary.rationaleCoverage}% · explanation ${summary.explanationWords} · stem ${summary.stemWords} · option ${summary.optionWords} · multi ${summary.multiSelectShare}%`);
  if (verbose) for (const flag of summary.flagged) console.log(`   flagged ${flag.id}: ${flag.cue === 1 ? "cue " : ""}${flag.longest ? "longest " : ""}${!flag.rationales ? "rationale " : ""}${flag.explanationWords < 25 ? "short-explanation" : ""}`);
  report.flagged.push(...summary.flagged.map((flag) => ({ pool: label, ...flag })));
}
if (allItems.length) {
  const summary = summarize(allItems);
  report.overall = summary;
  for (const message of breaches("all CCDV-P items", summary)) fail(message);
  console.log(`${"all".padEnd(10)} ${String(summary.items).padStart(3)} items · cue ${summary.cueGuesser}% · longest ${summary.longestCorrect}% · keys ${JSON.stringify(summary.keys)} · explanation ${summary.explanationWords} · stem ${summary.stemWords} · option ${summary.optionWords} · multi ${summary.multiSelectShare}%`);
  if (pools["exam 1"] && pools["exam 2"]) {
    const first = new Set(pools["exam 1"].map(({ id }) => id));
    if (pools["exam 2"].some(({ id }) => first.has(id))) fail("exam 2 reuses exam 1 items");
  }
}

// ---------------------------------------------------------------- lessons
const allowedHosts = /^https:\/\/(platform\.claude\.com|docs\.claude\.com|code\.claude\.com|support\.claude\.com|claude\.com|www\.anthropic\.com|anthropic\.com|modelcontextprotocol\.io|genai\.owasp\.org|owasp\.org|www\.nist\.gov|nvlpubs\.nist\.gov|doi\.org|opentelemetry\.io|git-scm\.com|sre\.google|github\.com)\//;
if (wanted("lessons") && exists("lessons")) {
  const { developerProfessionalLessons: set } = load("lessons");
  if (!set.overview || words(set.overview) < 60) fail("lessons: overview missing or under 60 words");
  const objectives = set.lessons.map(({ objective }) => objective);
  const expected = [...objectiveNames.keys()];
  if (objectives.join() !== expected.join()) fail(`lessons: objectives ${objectives.join(",")} must be one per objective in blueprint order`);
  for (const lesson of set.lessons) {
    const where = `lesson ${lesson.objective}`;
    if (lesson.title !== objectiveNames.get(lesson.objective)) fail(`${where}: title "${lesson.title}" must match the guide's skill name`);
    const sentences = lesson.takeaway.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    if (sentences > 2 || words(lesson.takeaway) < 15) fail(`${where}: takeaway must be one or two sentences of at least 15 words`);
    if (!(lesson.minutes >= 4 && lesson.minutes <= 12)) fail(`${where}: minutes ${lesson.minutes} outside 4-12`);
    const kinds = new Set(lesson.blocks.map(({ kind }) => kind));
    const tones = new Set(lesson.blocks.filter(({ kind }) => kind === "callout").map(({ tone }) => tone));
    if (!tones.has("exam")) fail(`${where}: needs an exam callout ("How the exam frames it")`);
    if (!tones.has("pitfall")) fail(`${where}: needs a pitfall callout (common mistake)`);
    if (![...kinds].some((kind) => kind === "code" || kind === "table")) fail(`${where}: needs a concrete example block (code or table)`);
    const text = lesson.blocks.map((block) => block.kind === "text" ? block.text : block.kind === "list" ? block.items.join(" ")
      : block.kind === "callout" ? `${block.title} ${block.text}` : block.kind === "table" ? block.rows.flat().join(" ") : block.code).join(" ");
    if (words(text) < 450) fail(`${where}: ${words(text)} words; professional lessons need at least 450`);
    if (lesson.terms.length < 5) fail(`${where}: list at least 5 exact terms`);
    if (lesson.sources.length < 2) fail(`${where}: cite at least 2 checked sources`);
    for (const [label, url] of lesson.sources) {
      if (!label || !allowedHosts.test(url)) fail(`${where}: source "${label}" ${url} is not an official or standards host`);
    }
    const prose = JSON.stringify(lesson);
    if (prose.includes("—")) fail(`${where}: em dash`);
    if (slop.test(prose)) fail(`${where}: filler word "${prose.match(slop)[0]}"`);
    for (const block of lesson.blocks) {
      for (const value of [block.text, block.title, ...(block.items ?? [])].filter(Boolean)) {
        if ((value.match(/`/g) ?? []).length % 2) fail(`${where}: unbalanced backticks in "${value.slice(0, 40)}…"`);
      }
    }
  }
  console.log(`lessons    ${set.lessons.length} lessons · ${set.lessons.reduce((a, l) => a + l.minutes, 0)} minutes · ${set.lessons.reduce((a, l) => a + l.sources.length, 0)} sources`);
} else if (wanted("lessons")) warn("lessons: file not written yet");

// ---------------------------------------------------------------- lab
if (wanted("lab") && exists("lab")) {
  const { runLab, starterFiles, transferVariants, failedChecks } = require(path.join(root, "lib/labs/run.ts"));
  const module = load("lab");
  const mission = Object.values(module).find((value) => value && typeof value === "object" && "engine" in value && "checks" in value);
  const failedSet = (run) => new Set(failedChecks(run));
  const sameSet = (left, right) => left.size === right.size && [...left].every((value) => right.has(value));
  const tokens = (value) => new Set((String(value).match(/[A-Za-z_][A-Za-z0-9_|.-]{3,}/g) ?? []).map((token) => token.replace(/[.-]+$/, "")));
  const label = `lab ${mission.id}`;
  const variants = transferVariants(mission);
  if (mission.track !== track.id) fail(`${label}: track must be ${track.id}`);
  for (const objective of mission.objectives) {
    if (!objectiveNames.has(objective)) fail(`${label}: ${objective} is not a CCDV-P objective`);
    if (!mission.checks.some((check) => check.objective === objective)) fail(`${label}: ${objective} has no check`);
  }
  for (const check of mission.checks) {
    if (!mission.objectives.includes(check.objective)) fail(`${label}: ${check.id} claims ${check.objective}`);
    for (const rung of ["nudge", "concept", "worked"]) if (!(check.hints[rung]?.length > 20)) fail(`${label}: ${check.id} ${rung} hint`);
  }
  const reference = runLab(mission, mission.reference.sample, "sample");
  if (!reference.passed) fail(`${label}: reference fails the sample: ${JSON.stringify(reference.results.filter(({ passed }) => !passed))}`);
  for (const variant of variants) {
    const outcome = runLab(mission, mission.reference.transfer[variant], "transfer", variant);
    if (!outcome.passed) fail(`${label}: reference fails transfer ${variant}: ${JSON.stringify(outcome.results.filter(({ passed }) => !passed))}`);
    if (mission.transferMode === "rerun" && JSON.stringify(mission.reference.transfer[variant]) !== JSON.stringify(mission.reference.sample)) fail(`${label}: rerun mode uses one set of files`);
  }
  const applied = new Set(mission.checks.filter(({ id }) => id in reference.checks || variants.some((variant) => id in runLab(mission, mission.reference.transfer[variant], "transfer", variant).checks)).map(({ id }) => id));
  for (const check of mission.checks) if (!applied.has(check.id)) fail(`${label}: ${check.id} never applies`);
  const starter = runLab(mission, starterFiles(mission), "sample");
  if (starter.parseError) fail(`${label}: starter must parse`);
  const starterFailed = failedSet(starter);
  for (const objective of mission.objectives) {
    if (!mission.checks.some(({ id, objective: owner }) => owner === objective && starterFailed.has(id))) fail(`${label}: starter passes every check for ${objective}`);
  }
  for (const mutant of mission.mutants) {
    const base = mutant.set === "sample" ? mission.reference.sample : mission.reference.transfer[mutant.variant ?? variants[0]];
    const outcome = runLab(mission, mutant.edit(base), mutant.set, mutant.variant);
    if (outcome.parseError) fail(`${label}: mutant "${mutant.name}" does not parse`);
    else if (!sameSet(failedSet(outcome), new Set(mutant.mustFail))) fail(`${label}: mutant "${mutant.name}" failed [${[...failedSet(outcome)]}] but targets [${mutant.mustFail}]`);
  }
  for (const check of mission.checks) {
    if (!mission.mutants.some(({ mustFail }) => mustFail.includes(check.id)) && !starterFailed.has(check.id)) fail(`${label}: nothing ever fails ${check.id}`);
  }
  const overfit = mission.overfit ?? (mission.transferMode === "revise" ? mission.reference.sample : null);
  if (!overfit) fail(`${label}: rerun-mode labs need an overfit artifact`);
  else {
    if (!runLab(mission, overfit, "sample").passed) fail(`${label}: overfit artifact must pass the sample`);
    for (const variant of variants) if (runLab(mission, overfit, "transfer", variant).passed) fail(`${label}: overfit passes transfer ${variant}`);
  }
  for (const probe of mission.probes) {
    const base = probe.set === "sample" ? mission.reference.sample : mission.reference.transfer[probe.variant ?? variants[0]];
    const outcome = runLab(mission, probe.files(base), probe.set, probe.variant);
    if (outcome.passed) fail(`${label}: probe "${probe.name}" passes`);
  }
  const empty = Object.fromEntries(mission.artifacts.map(({ id }) => [id, ""]));
  const short = Object.fromEntries(mission.artifacts.map(({ id }) => [id, mission.reference.sample[id].slice(0, 60)]));
  for (const probeFiles of [empty, short]) if (runLab(mission, probeFiles, "sample").passed) fail(`${label}: an empty or truncated artifact passes`);
  for (const probeFiles of [starterFiles(mission), mission.reference.sample]) {
    if (JSON.stringify(runLab(mission, probeFiles, "sample")) !== JSON.stringify(runLab(mission, probeFiles, "sample"))) fail(`${label}: runs are not deterministic`);
  }
  // Symptoms never name the fix.
  const visible = [JSON.stringify(starterFiles(mission)), JSON.stringify(mission.documents), JSON.stringify(mission.transferDocuments ?? {}),
    ...mission.artifacts.map(({ example }) => example ?? ""), JSON.stringify(mission.fixtures.map(({ input, situation, name }) => ({ input, situation, name })))].join("\n");
  const seen = tokens(visible);
  const distinctive = (token) => /[0-9_${}|/]|[a-z][A-Z]/.test(token);
  const fixOnly = [...tokens(JSON.stringify([mission.reference.sample, ...Object.values(mission.reference.transfer)]))].filter((token) => distinctive(token) && !seen.has(token));
  const failing = [{ files: starterFiles(mission), outcome: starter }, ...mission.mutants.map((mutant) => {
    const base = mutant.set === "sample" ? mission.reference.sample : mission.reference.transfer[mutant.variant ?? variants[0]];
    const edited = mutant.edit(base);
    return { files: edited, outcome: runLab(mission, edited, mutant.set, mutant.variant) };
  })];
  for (const { files: own, outcome } of failing) {
    const ownTokens = tokens(JSON.stringify(own));
    for (const { symptom, check } of outcome.results.filter(({ passed }) => !passed)) {
      for (const term of mission.fixTerms ?? []) if (symptom.includes(term)) fail(`${label}: ${check} symptom names the fix ("${term}"): ${symptom}`);
      const said = tokens(symptom);
      for (const term of fixOnly.filter((term) => !ownTokens.has(term))) if (said.has(term)) fail(`${label}: ${check} symptom names the fix ("${term}"): ${symptom}`);
    }
  }
  for (const outcome of [starter, reference]) {
    for (const { run: entry, fixture } of outcome.fixtures) if ((entry?.trace.length ?? 0) > 60) fail(`${label}: ${fixture.id} trace too long`);
  }
  console.log(`${label}: ${mission.checks.length} checks · ${variants.length} transfer variants · ${mission.mutants.length} mutants · ${mission.probes.length} probes · starter fails [${[...starterFailed]}]`);
} else if (wanted("lab")) warn("lab: file not written yet");

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ ...report, errors, warnings }, null, 2));
for (const message of warnings) console.log(`WARN ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`FAIL ${message}`);
  console.error(`\n${errors.length} CCDV-P check(s) failed.`);
  process.exit(1);
}
console.log("\nCCDV-P checks passed.");
