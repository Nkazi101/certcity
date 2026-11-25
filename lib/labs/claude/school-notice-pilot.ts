// Associate Foundations · school-notice-pilot. The learner iterates the reply prompt the office uses (v1 is the
// "friendly rewrite" that the correction log caught dropping a document, rounding a date and greeting the wrong
// person) and writes the pilot report for the board. A property-driven simulator reruns the logged cases plus a
// form with a blank date; the board reads the report's numbers against the shift notes and the correction log.
// Transfer (revise): the fall intake trial, with a three-document checklist, a survey of a different group, a new
// correction log and new shift notes.
import { hints } from "../../claude/casework";
import { allClauses, at, countWords, negated, promptFloor, sentences } from "../engines/prompt-policy";
import type { Sentence } from "../engines/prompt-policy";
import type { Check, Engine, EngineRun, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture, TraceEvent, TraceSource } from "../types";

type Form = { id: string; guardian: string; student: string; visit: string | null; logged?: "date" | "name" | "document" };
export type PilotInput = {
  checklist: { title: string; items: readonly { name: string; pattern: string }[] };
  deadline: { exact: string; rounded: string };
  survey: { count: number; group: string; groupWord: string; finding: string };
  forms: readonly Form[];
  invented: string;
  shift: { before: { drafting: number; review: number }; after: { drafting: number; review: number }; replies: number };
  corrections: readonly string[];
};
type Reply = { form: Form; held: boolean; text: string; greeting: string; items: string[]; deadline: string; visit: string | null; survey: "none" | "scoped" | "wrong-group" | "general" };
export type PilotOut = {
  replies: Reply[];
  warm: boolean;
  board: { net: number | null; corrections: number | null; claimed: number | null; actual: number };
  sources: Record<"documents" | "dates" | "names" | "tone" | "survey" | "blank" | "net" | "corrections", TraceSource>;
};
type Parsed = { prompt: string; report: string };

const listed = (items: readonly string[]) => items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const groupWords = ["weekday", "weekend", "evening", "morning", "daytime", "open-house"];

function reportNumber(report: string, pattern: RegExp): { value: number | null; line: number } {
  const lines = report.replace(/\r\n?/g, "\n").split("\n");
  const index = lines.findIndex((line) => pattern.test(line) && /\d/.test(line));
  if (index < 0) return { value: null, line: Math.max(1, lines.findIndex((line) => pattern.test(line)) + 1) };
  const line = lines[index];
  const after = line.includes("=") ? line.slice(line.lastIndexOf("=") + 1) : line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
  const match = /-?\d+(?:\.\d+)?/.exec(after) ?? /-?\d+(?:\.\d+)?/.exec(line);
  return { value: match ? Number(match[0]) : null, line: index + 1 };
}

function readPrompt(prompt: string, input: PilotInput) {
  const list = sentences(prompt);
  const clauses = allClauses(list);
  const find = (...patterns: RegExp[]) => clauses.find(({ text }) => patterns.every((pattern) => pattern.test(text)));
  const findSaid = (...patterns: RegExp[]) => clauses.find(({ text }) => !negated(text) && patterns.every((pattern) => pattern.test(text)));

  const warm = findSaid(/\b(warm|friendly|kind|welcoming|gentle|caring)\w*\b/i);
  const checklistRule = findSaid(/checklist/i, /\b(documents?|items?|requirements?)\b/i, /\b(list|keep|include|name|copy|state|every|each|all|both|full)\b/i);
  const typedItems = input.checklist.items.filter(({ pattern }) => clauses.some(({ text }) => !negated(text) && new RegExp(pattern, "i").test(text)));
  const exactDates = find(/\b(dates?|deadline)\b/i, /\b(exact|exactly|unchanged|as written|word for word|verbatim|same|do not (change|round|reword|paraphrase)|don['’]?t (change|round|reword|paraphrase)|never (change|round|reword|paraphrase))\b/i);
  // "Address" counts only as a verb ("address the parent"), never in "proof of address".
  const greetVerb = /\b(greet|dear|name|open)\w*\b|\baddress (the|each|every|them|replies|families|parents?|guardians?)\b/i;
  const nameRule = findSaid(/\b(guardian|parent|signed|signer|sender|wrote|name on the form)\b/i, greetVerb) ?? findSaid(/\b(dear|hello|hi) famil/i);
  const studentGreeting = findSaid(/\b(student|child)\b/i, /\b(greet|dear|first name|by name)\w*\b|\baddress (the|each) (student|child)/i);
  const surveyClauses = clauses.filter(({ text }) => /\b(survey|prefer\w*)\b/i.test(text));
  const surveySaid = surveyClauses.filter(({ text }) => !negated(text));
  const general = surveySaid.find(({ text }) => /\b(all|every|most) families\b|\beveryone\b|\bwhole school\b|\b(too|as well|also)\b|\b(estimate|assume|probably|likely)\b/i.test(text));
  const typedGroup = surveySaid.flatMap(({ text }) => groupWords.filter((word) => text.toLowerCase().includes(word)))[0];
  const scoped = surveySaid.find(({ text }) => /\b(who (answered|responded|replied|took)|respondents?|surveyed|were asked|answered it|only the)\b/i.test(text) || groupWords.some((word) => text.toLowerCase().includes(word)));
  const survey: Reply["survey"] = !surveySaid.length ? "none" : general ? "general" : !scoped ? "general" : typedGroup && typedGroup !== input.survey.groupWord ? "wrong-group" : "scoped";
  const blankRule = clauses.find(({ text }) => /\b(blank|missing|empty|no date|without a date|left out)\b/i.test(text) && /\bdates?\b/i.test(text));
  const blankSentence = blankRule ? list.find(({ line }) => line === blankRule.line) : undefined;
  const blankText = blankSentence?.lineText ?? "";
  const guess = /\b(guess|infer|assume|likely|pick|estimate|fill (it )?in|choose a)\b/i.test(blankText) && !negated(blankText.split(/\b(guess|infer|assume|likely|pick|estimate|fill|choose)\b/i)[0]);
  const asks = /\b(ask|request|contact|email|call|hold|send (it )?back|return)\w*\b/i.test(blankText) && /\b(famil\w*|parent|guardian|them|sender)\b/i.test(blankText);
  const blank: "ask" | "guess" | "none" = guess ? "guess" : asks ? "ask" : "none";
  return { warm, checklistRule, typedItems, exactDates, nameRule, studentGreeting, survey, surveySource: general ?? scoped ?? surveySaid[0] ?? surveyClauses[0], blank, blankRule };
}

export const pilotEngine: Engine<Parsed, PilotInput, PilotOut> = {
  id: "neutral.prompt-policy.pilot",
  provider: "neutral",
  label: "Simulated Claude replies from your prompt, plus the pilot board",
  simulated: true,
  parse(files) {
    const prompt = files.prompt ?? "";
    const floor = promptFloor(prompt, "reply-prompt.md", "prompt");
    return floor ? { ok: false, ...floor } : { ok: true, value: { prompt, report: files.report ?? "" } };
  },
  run({ prompt, report }, fixture: Fixture<PilotInput>): EngineRun<PilotOut> {
    const input = fixture.input;
    const seen = readPrompt(prompt, input);
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    push({ actor: "learner-artifact", kind: "request", label: `reply-prompt.md · ${countWords(prompt)} words, run on ${input.forms.length} forms`, source: { artifact: "prompt", line: 1 } });

    const allItems = input.checklist.items.map(({ name }) => name);
    const items = seen.checklistRule ? allItems : seen.typedItems.length ? seen.typedItems.map(({ name }) => name) : allItems.slice(-1);
    const deadline = seen.exactDates ? input.deadline.exact : input.deadline.rounded;
    const surveyLine = {
      none: "",
      scoped: ` Of the ${input.survey.count} ${input.survey.group} who answered our survey, most ${input.survey.finding}.`,
      "wrong-group": ` Of the ${seen.surveySource ? groupWords.find((word) => seen.surveySource!.text.toLowerCase().includes(word)) : ""} families we asked, most ${input.survey.finding}.`,
      general: ` Families ${input.survey.finding}.`,
    }[seen.survey];
    const replies: Reply[] = input.forms.map((form) => {
      const greeting = seen.nameRule && !seen.studentGreeting ? (/famil/i.test(seen.nameRule.text) ? "Dear family" : `Dear ${form.guardian}`) : `Dear ${form.student.split(" ")[0]}`;
      if (!form.visit && seen.blank === "ask") {
        const text = `(held at intake) Message to ${form.guardian}: please add your preferred visit date so we can book it.`;
        push({ actor: "service", kind: "decision", label: `${form.id} · visit date blank → held at intake`, detail: text, tone: "ok", source: at("prompt", seen.blankRule) });
        return { form, held: true, text, greeting, items: [], deadline, visit: null, survey: "none" as const };
      }
      const visit = form.visit ?? input.invented;
      const open = seen.warm ? "thank you for applying; we look forward to meeting you!" : "your application has been received.";
      const text = `${greeting}, ${open} Your visit is booked for ${visit}. Please bring ${listed(items)} by ${deadline}.${surveyLine}`;
      push({ actor: "model", kind: "output", label: `Reply ${form.id}${form.logged ? ` (sent back last time: ${form.logged === "document" ? "missing document" : form.logged === "date" ? "wrong date" : "wrong name"})` : ""}${form.visit ? "" : " · visit date blank on the form"}`,
        detail: text, tone: !form.visit ? "bad" : undefined });
      return { form, held: false, text, greeting, items, deadline, visit, survey: seen.survey };
    });

    const net = reportNumber(report, /\bnet\b|saved per reply|saving per reply/i);
    const corrections = reportNumber(report, /sent back|returned|corrections?|needed fixing|fixed after review/i);
    const before = input.shift.before.drafting + input.shift.before.review;
    const after = input.shift.after.drafting + input.shift.after.review;
    const actual = (before - after) * input.shift.replies;
    const claimed = net.value === null ? null : net.value * input.shift.replies;
    push({ actor: "service", kind: "output", label: "Pilot board", source: { artifact: "report", line: net.line },
      detail: `${net.value === null ? "Saving: (no figure in the report)" : `Saving: ${net.value} min per reply × ${input.shift.replies} replies = ${claimed} min`}\n${corrections.value === null ? "Quality: (no figure in the report)" : `Replies sent back after review: ${corrections.value}`}`,
      tone: claimed === actual && corrections.value === input.corrections.length ? "ok" : "warn" });
    push({ actor: "service", kind: "metric", label: `Staff timesheets for the trial: ${before} → ${after} min per reply, ${actual} min fewer across ${input.shift.replies} replies`, payload: { before, after, actual } });

    return {
      trace,
      out: {
        replies, warm: !!seen.warm,
        board: { net: net.value, corrections: corrections.value, claimed, actual },
        sources: {
          documents: at("prompt", seen.checklistRule ?? null), dates: at("prompt", seen.exactDates ?? null), names: at("prompt", seen.studentGreeting ?? seen.nameRule ?? null),
          tone: at("prompt", seen.warm ?? null), survey: at("prompt", (seen.surveySource as Sentence | undefined) ?? null), blank: at("prompt", seen.blankRule ?? null),
          net: { artifact: "report", line: net.line }, corrections: { artifact: "report", line: corrections.line },
        },
      },
      metrics: { claimed: claimed ?? 0 },
    };
  },
};

const spring: PilotInput = {
  checklist: { title: "Signed checklist", items: [{ name: "proof of address", pattern: "proof of address|address" }, { name: "the student record", pattern: "student record|record" }] },
  deadline: { exact: "May 24", rounded: "late May" },
  survey: { count: 30, group: "weekday families", groupWord: "weekday", finding: "prefer the new pickup hours" },
  forms: [
    { id: "R04", guardian: "Maria Lopez", student: "Diego Lopez", visit: "Tue 20 May", logged: "date" },
    { id: "R11", guardian: "Ken Adams", student: "Lily Adams", visit: "Wed 21 May", logged: "document" },
    { id: "R19", guardian: "Pat Lowe", student: "Sam Lowe", visit: "Thu 22 May", logged: "name" },
    { id: "R26", guardian: "Aisha Khan", student: "Omar Khan", visit: "Fri 23 May", logged: "document" },
    { id: "F31", guardian: "Jo Reyes", student: "Mia Reyes", visit: null },
  ],
  invented: "Monday 2 June",
  shift: { before: { drafting: 12, review: 2 }, after: { drafting: 5, review: 6 }, replies: 30 },
  corrections: ["R04", "R11", "R19", "R26"],
};
const fall: PilotInput = {
  checklist: { title: "Signed fall checklist", items: [
    { name: "the immunization record", pattern: "immuni[sz]ation" }, { name: "proof of address", pattern: "proof of address|address" }, { name: "a parent’s photo ID", pattern: "photo id|photo identification" },
  ] },
  deadline: { exact: "September 12", rounded: "mid-September" },
  survey: { count: 24, group: "open-house evening families", groupWord: "evening", finding: "prefer the online form" },
  forms: [
    { id: "F03", guardian: "Lee Moreno", student: "Ava Moreno", visit: "Mon 8 Sep", logged: "document" },
    { id: "F09", guardian: "Ruth Cole", student: "Ben Cole", visit: "Tue 9 Sep", logged: "date" },
    { id: "F15", guardian: "Chris Obi", student: "Dami Obi", visit: "Wed 10 Sep", logged: "name" },
    { id: "F22", guardian: "Noor Aziz", student: "Sara Aziz", visit: null },
  ],
  invented: "Thursday 11 September",
  shift: { before: { drafting: 10, review: 3 }, after: { drafting: 4, review: 7 }, replies: 24 },
  corrections: ["F03", "F09", "F15"],
};

const fixtures: Fixture<PilotInput>[] = [
  { id: "spring", name: "Spring trial rerun", set: "sample", situation: "Your prompt reruns on the four replies the correction log sent back, plus F31, which arrived with its visit date blank. The board reads your report.", input: spring },
  { id: "fall", name: "Fall intake trial", set: "transfer", variant: "fall", situation: "The fall trial: a three-document checklist, a survey of a different group, new forms and new shift notes.", input: fall },
];

const springDocs: LabDocument[] = [
  { id: "checklist", title: "Signed checklist · spring intake", text: "Signed by the principal. Bring proof of address and the student record by May 24. Tone may change; both documents and the date are required." },
  { id: "log", title: "Correction log · v1 replies sent back after review", format: "code", text: "R04  wrong date: the reply said “late May”\nR11  missing document\nR19  wrong name: greeted the student; the parent wrote\nR26  missing document\n4 of 30 replies sent back." },
  { id: "survey", title: "Survey export · pickup hours", text: "30 responses, all collected Monday to Friday. Weekend families did not receive this round. Most respondents prefer the new pickup hours." },
  { id: "shift", title: "Shift notes", text: "Before the rewrite: 12 min drafting + 2 min review per reply. After: 5 min drafting + 6 min review per reply. 30 replies in the trial." },
  { id: "forms", title: "Rerun set · forms", format: "code", text: "R04  signed by Maria Lopez for Diego Lopez · visit Tue 20 May\nR11  signed by Ken Adams for Lily Adams · visit Wed 21 May\nR19  signed by Pat Lowe for Sam Lowe · visit Thu 22 May\nR26  signed by Aisha Khan for Omar Khan · visit Fri 23 May\nF31  signed by Jo Reyes for Mia Reyes · visit date: (blank)" },
];
const fallDocs: LabDocument[] = [
  { id: "checklist", title: "Signed checklist · fall intake", text: "Signed by the principal. Bring the immunization record, proof of address and a parent’s photo ID by September 12. All three are required." },
  { id: "log", title: "Correction log · fall trial", format: "code", text: "F03  missing document\nF09  wrong date: the reply said “mid-September”\nF15  wrong name: greeted the student; the parent wrote\n3 of 24 replies sent back." },
  { id: "survey", title: "Survey export · online form", text: "24 responses, all collected at the evening open house. Families who came in the morning were not asked. Most respondents prefer the online form." },
  { id: "shift", title: "Shift notes · fall trial", text: "Before: 10 min drafting + 3 min review per reply. After: 4 min drafting + 7 min review per reply. 24 replies in the trial." },
  { id: "forms", title: "Rerun set · fall forms", format: "code", text: "F03  signed by Lee Moreno for Ava Moreno · visit Mon 8 Sep\nF09  signed by Ruth Cole for Ben Cole · visit Tue 9 Sep\nF15  signed by Chris Obi for Dami Obi · visit Wed 10 Sep\nF22  signed by Noor Aziz for Sara Aziz · visit date: (blank)" },
];

const starterPrompt = `# Reply prompt · v1 (friendly rewrite)

Rewrite our reply to each family so it sounds warm and welcoming.
Keep it short: one friendly paragraph.
Greet the student by first name.
Mention that families prefer the new pickup hours.
Remind them to bring their documents before the deadline.
`;
const starterReport = `# Pilot report · spring reply rewrite

Net minutes saved per reply: 7
How it was counted: drafting went from 12 to 5 minutes.
Replies sent back after review: 0
`;
const referencePrompt = `# Reply prompt · v2

Write each reply to the family in a warm, welcoming tone, one short paragraph.
Greet the parent who signed the form by the name they signed with.
List every document on the signed checklist, word for word. Never shorten the list.
Copy dates exactly as the signed notice writes them.
If you mention the survey, say it reflects only the families who answered it.
If the form's visit date is blank, do not draft a reply: ask the family for the date instead.
`;
const report = (net: number, before: string, after: string, sent: string) => `# Pilot report

Net minutes saved per reply: ${net}
How it was counted: ${before} before − ${after} after, review included.
Replies sent back after review: ${sent}
`;
const springReport = report(3, "(12 + 2)", "(5 + 6)", "4 of 30");
const fallReport = report(2, "(10 + 3)", "(4 + 7)", "3 of 24");
const sampleRef: LabFiles = { prompt: referencePrompt, report: springReport };
const fallRef: LabFiles = { prompt: referencePrompt, report: fallReport };
const edit = (from: string, to: string, base = sampleRef) => (): LabFiles => {
  const key = base.prompt.includes(from) ? "prompt" : "report";
  if (!base[key].includes(from)) throw new Error(`school-notice-pilot mutant: “${from}” not found`);
  return { ...base, [key]: base[key].replace(from, to) };
};

type C = Check<PilotInput, PilotOut>;
const drafted = (out: PilotOut) => out.replies.filter(({ held }) => !held);
const checks: C[] = [
  {
    id: "documents-kept", objective: "4.1", title: "Every reply lists every document on the signed checklist",
    diagnosis: "Identifying requirements means separating what may change (tone, length) from what must not (each required item). Writing the must-keep facts into the prompt, or pointing Claude at the signed source for them, stops a friendlier rewrite from quietly dropping one.",
    hints: hints("Count the documents in each reply in the trace, then in the Signed checklist.",
      "Requirements captured from the source of truth: the prompt states which content is fixed (every item on the signed checklist) and which may change (tone, length). Each rewrite is checked against that list.",
      "A gym rewrites its waiver to sound welcoming. The legal team’s three required clauses are named in the request, and each new version is checked for all three before release."),
    reveal: "List every document on the signed checklist, word for word.",
    evaluate: ({ out }, { input }) => {
      const short = drafted(out).find(({ items }) => items.length < input.checklist.items.length);
      return short
        ? { passed: false, symptom: `${short.form.id}’s reply asks for ${listed(short.items)} only; the ${input.checklist.title.toLowerCase()} names ${input.checklist.items.length} documents.`, source: out.sources.documents }
        : { passed: true, symptom: "Every reply lists every document on the signed checklist." };
    },
  },
  {
    id: "logged-fixes", objective: "1.3", title: "The cases the correction log sent back come out right, and the warmer tone stays",
    diagnosis: "Improving a prompt through iteration: rerun the new version on the same cases that failed, change what the evidence points to, and keep what worked. A v2 that fixes one logged error and reintroduces another, or that drops the improvement the rewrite was for, is not better.",
    hints: hints("Open the rerun of each reply the correction log sent back. Does it fail the same way again?",
      "Iterating against a failure log: for each logged error, add the instruction that prevents it (exact dates, the right person’s name), rerun the same cases, and check that the earlier improvement (tone) survives.",
      "A translation team’s prompt kept rounding prices. They added “copy numbers exactly”, reran the 12 flagged documents, and checked the friendlier phrasing that started the change was still there."),
    reveal: "Copy dates exactly as the signed notice writes them. Greet the parent who signed the form by name.",
    evaluate: ({ out }, { input }) => {
      const replies = drafted(out);
      const date = replies.find(({ form, deadline }) => form.logged === "date" && deadline !== input.deadline.exact);
      if (date) return { passed: false, symptom: `${date.form.id} again reads “by ${date.deadline}”.`, source: out.sources.dates };
      const name = replies.find(({ form, greeting }) => form.logged === "name" && !greeting.includes(form.guardian) && greeting !== "Dear family");
      if (name) return { passed: false, symptom: `${name.form.id} again opens “${name.greeting},”; ${name.form.guardian} wrote the form.`, source: out.sources.names };
      if (!out.warm) return { passed: false, symptom: `Replies read “your application has been received.”, the wording families found cold before the rewrite.`, source: out.sources.tone };
      return { passed: true, symptom: "The logged cases come out right, in the warmer tone." };
    },
  },
  {
    id: "corrections-reported", objective: "1.3", title: "The board shows how many replies review sent back",
    diagnosis: "Comparing prompt versions means measuring quality as well as speed, on the same cases. A faster draft that needs more fixes may not be better; the count of replies sent back after review is the quality side of the comparison.",
    hints: hints("Compare the board’s quality line in the trace with the Correction log.",
      "Iteration is judged on output quality too: report how many outputs reviewers sent back, from the log, next to the time figures.",
      "A translation team’s new prompt halves drafting time; reviewers returned 7 of 50 documents. The report states both numbers so leaders can judge the trade-off."),
    reveal: "Replies sent back after review: (the count in the Correction log)",
    evaluate: ({ out }, { input }) => out.board.corrections === input.corrections.length
      ? { passed: true, symptom: `The board shows ${input.corrections.length} replies sent back.` }
      : { passed: false, symptom: out.board.corrections === null ? `The board has no quality line; the correction log lists ${input.corrections.length} replies sent back.`
        : `The board’s quality line reads ${out.board.corrections}; the correction log lists ${input.corrections.length} replies sent back.`, source: out.sources.corrections },
  },
  {
    id: "survey-scoped", objective: "2.2", title: "No reply speaks for families the survey never asked",
    diagnosis: "An unsupported claim generalizes beyond its evidence. A survey describes only the people who answered it; a claim about everyone, or about a group that was never asked, is unsupported and can be biased. Scope the claim to the respondents or leave it out.",
    hints: hints("Read the survey sentence in a reply, then the Survey export: who received this round?",
      "Detecting unsupported generalization and sampling bias: check who, when and how many. The claim names the group that answered, or it is not made.",
      "A cafe surveys only its morning customers and reports “morning regulars prefer the new menu”, not “customers prefer it”."),
    reveal: "If you mention the survey, say it reflects only the families who answered it.",
    evaluate: ({ out }, { input }) => {
      const bad = drafted(out).find(({ survey }) => survey === "general" || survey === "wrong-group");
      return bad
        ? { passed: false, symptom: `${bad.form.id}’s reply says “${bad.text.slice(bad.text.lastIndexOf(".", bad.text.length - 2) + 2)}”; the survey reached ${input.survey.count} ${input.survey.group}.`, source: out.sources.survey }
        : { passed: true, symptom: "Survey findings speak only for the families who answered." };
    },
  },
  {
    id: "blank-date-held", objective: "4.3", title: "A form with a blank date is held at intake, not drafted",
    diagnosis: "Designing and revising a solution means fixing a problem where it starts. A check at intake asks for the missing value before any draft exists; drafting anyway invites a plausible invented date, and review later costs more than asking now.",
    hints: hints("Find the form with a blank visit date in the trace. What did its family receive?",
      "Upstream validation: the prompt’s first instruction for a missing required field is to stop and ask for it, not to draft around it or fill it in.",
      "An online pharmacy form won’t submit without a prescriber’s phone number, so pharmacists never call patients back to get it."),
    reveal: "If the form's visit date is blank, do not draft: ask the family for the date.",
    evaluate: ({ out }) => {
      const invented = out.replies.find(({ form, held }) => !form.visit && !held);
      return invented
        ? { passed: false, symptom: `${invented.form.id}’s reply books a visit for ${invented.visit}; the form’s date is blank.`, source: out.sources.blank }
        : { passed: true, symptom: "The blank-date form waits at intake with a request to the family." };
    },
  },
  {
    id: "net-minutes", objective: "4.5", title: "The board’s saving matches what staff actually spent",
    diagnosis: "Explaining value and limitations means reporting the whole cost of the new process. Total effort per reply is drafting plus review, before and after; the saving is the difference. Reporting drafting speed alone overstates value when review time grew.",
    hints: hints("Compare the board’s saving with the timesheet line just below it in the trace.",
      "Net effort, not drafting speed: (drafting + review before) − (drafting + review after), per reply, from the Shift notes.",
      "A warehouse robot cuts picking from 10 to 4 minutes per order, but packing checks grow from 1 to 5. Net saving: (10 + 1) − (4 + 5) = 2 minutes per order."),
    reveal: "Net minutes saved per reply: (drafting + review before) − (drafting + review after)",
    evaluate: ({ out }) => out.board.claimed === out.board.actual
      ? { passed: true, symptom: `The board’s ${out.board.claimed} minutes match the timesheets.` }
      : { passed: false, symptom: out.board.claimed === null ? "The board shows no saving figure." : `The board claims ${out.board.claimed} minutes saved; the timesheets show ${out.board.actual}.`, source: out.sources.net },
  },
];

function effects(runs: readonly LabRunFixture<PilotInput, PilotOut>[]) {
  return runs.flatMap(({ run, fixture }) => {
    if (!run) return [];
    const total = fixture.input.checklist.items.length;
    return [
      ...run.out.replies.map(({ form, held, items, survey }) => ({ kind: "tray" as const, item: `Reply ${form.id}`,
        to: held ? "held" as const : !form.visit || items.length < total || survey === "general" || survey === "wrong-group" ? "failed" as const : "posted" as const })),
      { kind: "meter" as const, id: "board", label: "minutes the board claims", value: run.out.board.claimed ?? 0, unit: "min" },
    ];
  });
}

export const schoolNoticePilotLab: LabMission<Parsed, PilotInput, PilotOut> = {
  id: "school-notice-pilot",
  provider: "anthropic",
  track: "associate-foundations",
  objectives: ["1.3", "2.2", "4.1", "4.3", "4.5"],
  station: "Notice and intake desk · prompt v2 and pilot report",
  speaker: "Jordan Chen",
  opening: "The friendly rewrite lost the document checklist, and the pilot board says we saved seven minutes a reply. I don’t believe either.",
  task: "Iterate the reply prompt against the correction log, rerun the same cases, and write the pilot report the board will show.",
  brief: {
    problem: "The friendlier v1 prompt dropped a required document, rounded a date and greeted the wrong person, and the pilot board counts drafting time only.",
    move: "Read the Correction log first, then the Signed checklist, Survey export and Shift notes. Edit reply-prompt.md and pilot-report.md, then rerun.",
    success: ["Every reply lists every document on the signed checklist", "The logged cases come out right, in the warmer tone", "Survey findings speak only for families who were asked",
      "0 replies drafted for a form with a blank date", "The board shows net minutes after review, and the corrections"],
  },
  prebrief: {
    concept: "A prompt iteration is better only if it fixes the logged failures, keeps every required fact, and the total effort, including review, goes down.",
    terms: [["Fix what the log shows, keep what worked", "Iterating a prompt against requirements"], ["Claim only what the sample shows", "Detecting unsupported claims and sampling bias"],
      ["Stop bad input at the door", "Revising the solution with upstream validation"], ["Count review time too", "Measuring value: net effort, not drafting speed"]],
    contrast: {
      good: "A new checkout screen cut payment time by 20 seconds and support calls stayed flat, so the team reported the net saving.",
      bad: "A new checkout screen ‘saved 20 seconds’, while refund calls doubled and nobody counted them.",
    },
  },
  documents: springDocs,
  artifacts: [
    { id: "prompt", kind: "prompt", path: "reply-prompt.md", editor: "markdown",
      instruction: "The prompt Claude uses to draft each reply to a family’s intake form. Plain sentences.", starter: starterPrompt,
      example: "# Reminder prompt · v3\n\nWrite in a friendly tone.\nAlways include the room number and the start time from the signed timetable.\nIf the timetable has no room yet, say “room to be confirmed”." },
    { id: "report", kind: "pilot-report", path: "pilot-report.md", editor: "markdown",
      instruction: "What the pilot board shows the sponsor. Keep the labels; the board reads the numbers after them.", starter: starterReport },
  ],
  engine: pilotEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { fall: fallDocs },
  checks,
  prediction: {
    prompt: "How many staff minutes will the board claim the pilot saved across all 30 replies?", unit: "min",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.claimed ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { fall: fallRef } },
  mutants: [
    { name: "checklist rule dropped", set: "sample", mustFail: ["documents-kept"], edit: edit("List every document on the signed checklist, word for word. Never shorten the list.\n", "") },
    { name: "dates left to the rewrite", set: "sample", mustFail: ["logged-fixes"], edit: edit("Copy dates exactly as the signed notice writes them.\n", "") },
    { name: "student greeted again", set: "sample", mustFail: ["logged-fixes"], edit: edit("Greet the parent who signed the form by the name they signed with.", "Greet the student by first name.") },
    { name: "warm tone dropped", set: "sample", mustFail: ["logged-fixes"], edit: edit("in a warm, welcoming tone, one short paragraph", "in one short paragraph") },
    { name: "survey speaks for every family", set: "sample", mustFail: ["survey-scoped"], edit: edit("If you mention the survey, say it reflects only the families who answered it.", "Mention that families prefer the new pickup hours.") },
    { name: "weekend families estimated", set: "sample", mustFail: ["survey-scoped"], edit: edit("If you mention the survey, say it reflects only the families who answered it.", "Say weekday families prefer the new hours, and weekend families probably do too.") },
    { name: "blank date guessed", set: "sample", mustFail: ["blank-date-held"], edit: edit("If the form's visit date is blank, do not draft a reply: ask the family for the date instead.", "If the form's visit date is blank, pick the most likely date.") },
    { name: "drafting speed reported as the saving", set: "sample", mustFail: ["net-minutes"], edit: edit("Net minutes saved per reply: 3", "Net minutes saved per reply: 7") },
    { name: "review time counted twice", set: "sample", mustFail: ["net-minutes"], edit: edit("Net minutes saved per reply: 3", "Net minutes saved per reply: -1") },
    { name: "quality line hidden", set: "sample", mustFail: ["corrections-reported"], edit: edit("Replies sent back after review: 4 of 30", "Replies sent back after review: 0") },
    { name: "weekday scope copied to the fall survey", set: "transfer", variant: "fall", mustFail: ["survey-scoped"],
      edit: edit("say it reflects only the families who answered it", "say it reflects only the weekday families", fallRef) },
    { name: "spring checklist typed into the prompt", set: "transfer", variant: "fall", mustFail: ["documents-kept"],
      edit: edit("List every document on the signed checklist, word for word. Never shorten the list.", "Always ask for proof of address and the student record.", fallRef) },
  ],
  probes: [
    { name: "every survey phrase at once", set: "sample", mustFail: ["survey-scoped"],
      files: (files) => ({ ...files, prompt: files.prompt.replace("If you mention the survey, say it reflects only the families who answered it.", "Say the survey reflects only the weekday families who answered, and that all families prefer the new hours.") }) },
  ],
  fixTerms: ["word for word", "exactly", "who answered", "the parent who signed", "ask the family"],
  debrief: "Version 2 keeps the warmer tone and adds one instruction per logged failure: list every document on the signed checklist, copy dates exactly, greet the parent who signed. It scopes the survey claim to the families who answered, and it stops at intake when a required date is blank. The report counts drafting plus review before and after ((12 + 2) − (5 + 6) = 3 minutes per reply) and states the 4 replies review sent back, so the board shows the real trade-off. The fall trial asks for the same judgment on a three-document checklist, a survey of evening families and new timesheets.",
};
