// Associate Foundations · kitchen-billing-audit. The learner repairs the shared template every clerk's new chat loads
// for the weekly billing summary: the refund rule (the supplier's export changed format), how a refund is posted,
// the reviewed standing instructions clerks used to retype, and how rows are routed. The engine applies the template
// row by row to the export, as the next clerk's fresh chat would. Transfer (rerun, hidden): next week's export, with
// different orders, two refunds, a different unreadable row and a different clerk's habits.
import { hints } from "../../claude/casework";
import { allClauses, countWords, negated, negatedBefore, promptFloor, sentences } from "../engines/prompt-policy";
import type { Sentence } from "../engines/prompt-policy";
import type { Check, Engine, EngineRun, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture, TraceEvent, TraceSource } from "../types";

type Row = { order: number; day: string; amount: number; code: "S" | "R" | null };
export type LedgerInput = {
  rows: readonly Row[];
  clerk: { name: string; notes: { decimals: string; order: string; section: string } };
  routes: { low: { cents: number; correct: number }; high: { cents: number; correct: number }; trial: number; bar: number };
  reviewer: string;
};
type Posted = { row: Row; label: "sale" | "refund" | "held" | "dropped"; effect: number; guessed: boolean };
export type LedgerOut = {
  posted: Posted[];
  total: number;
  expected: number;
  standing: { decimals: boolean; order: boolean; section: boolean };
  summary: string[];
  route: "low" | "high" | "both";
  cents: number;
  unreadable: "hold" | "guess" | "drop";
  sources: Record<"classify" | "entry" | "standing" | "route" | "unreadable", TraceSource>;
};

const file = "template";
const refundWord = /\b(refunds?|money (returned|back)|returns? of money)\b/i;
const unreadablePhrase = /\b(code|type|row)?['’]?s?\s*(can['’]?t|cannot|can not) be read\b|\bunreadable\b|\bsmudged\b|\billegible\b|\b(missing|blank|unclear|no) (code|type)\b/i;

function at(sentence?: Sentence | null): TraceSource {
  return { artifact: file, line: sentence?.line ?? 1 };
}

function readTemplate(text: string) {
  const clauses = allClauses(sentences(text));
  // Refund rule: every condition stated in a refund clause, evaluated per row (a union, so a rule can cover two formats).
  const ruleClauses = clauses.filter(({ text: clause }) => refundWord.test(clause) && !negated(clause));
  const conditions: ((row: Row) => boolean)[] = [];
  // A standalone type letter in a refund clause counts, unless the letter is named as a sale ("S is a sale").
  const letter = (clause: string, code: "R" | "S") => new RegExp(`(?:^|[^A-Za-z])["“'‘]?${code}["”'’]?(?![A-Za-z])(?![^.;]{0,12}\\bsales?\\b)`).test(clause);
  // A sign counts only as a stated condition ("when the amount is negative"), not as a description of the export.
  const governed = (clause: string, words: string) => new RegExp(`\\b(when|if|where|whose|with)\\b[^.;:]{0,40}\\b(${words})`, "i").test(clause);
  for (const { text: clause } of ruleClauses) {
    if (letter(clause, "R")) conditions.push((row) => row.code === "R");
    if (letter(clause, "S")) conditions.push((row) => row.code === "S");
    if (governed(clause, "negative|minus|below zero|less than (0|zero)|sign")) conditions.push((row) => row.amount < 0);
    if (governed(clause, "positive|above zero|greater than (0|zero)")) conditions.push((row) => row.amount > 0);
    const orders = [...clause.matchAll(/\border\s*#?\s*(\d+)/gi)].map((match) => Number(match[1]));
    if (orders.length) conditions.push((row) => orders.includes(row.order));
  }
  // Ledger entry: how a refund is posted. Adding wins over subtracting when a template says both.
  const entryVerb = /\b(post|record|enter|book|count|list|show|subtract|reduce|deduct|add|take)\w*\b/i;
  // An entry clause is about refunds by its own words, its line, or the heading it sits under.
  const entry = clauses.filter((clause) => entryVerb.test(clause.text) && [clause.text, clause.lineText ?? "", clause.heading ?? ""].some((scope) => refundWord.test(scope)));
  const adds = entry.find(({ text: clause }) => /\badd(s|ed)? (it|them|the amount|to the (week|total))\b|\bas (a )?sales?\b|\bincrease\b/i.test(clause) && !negatedBefore(clause, /\badd|\bas (a )?sale|\bincrease/i));
  const subtracts = entry.find(({ text: clause }) => /\b(subtract|reduce|deduct|minus|negative|take (it|them|the amount)? ?off|lower)\w*\b|−|-\s?\d/i.test(clause));
  // Standing instructions the reviewer approved; anything missing, the clerk types from their own notes.
  const decimals = clauses.find(({ text: clause }) => (/\b(two decimals?|2 decimals?|to the cent|cents|decimal places)\b|\.00\b/i.test(clause) && !negatedBefore(clause, /decimal|cent/i))
    || /\b(never|don['’]?t|do not)\s+round\b/i.test(clause));
  const order = clauses.find(({ text: clause }) => /\border (numbers?|no\.?|#|ids?)\b/i.test(clause) && !negated(clause));
  const section = clauses.find(({ text: clause }) => /\b(own|separate) (section|list|heading)\b|\bseparately\b|\bunder (its own|a separate) heading\b/i.test(clause) && !negated(clause));
  // Routing: which route routine rows take, and what happens to a row whose code cannot be read.
  const routeClauses = clauses.filter(({ text: clause }) => /\broute|model|tier\b/i.test(clause) && !negated(clause));
  const both = routeClauses.find(({ text: clause }) => /\bboth\b|\beach route\b|\bcompare\b/i.test(clause));
  const high = routeClauses.find(({ text: clause }) => /\b(high|higher)[- ]cost\b|\bpremium\b|\bmost accurate\b|\bexpensive\b/i.test(clause));
  const low = routeClauses.find(({ text: clause }) => /\b(low|lower)[- ]cost\b|\bcheap(er|est)?\b|\bbudget\b/i.test(clause));
  const route: LedgerOut["route"] = both ? "both" : high && !low ? "high" : low && !high ? "low" : high ? "high" : "high";
  const gap = clauses.filter(({ text: clause }) => unreadablePhrase.test(clause)).map((clause) => ({ ...clause, rest: clause.text.replace(unreadablePhrase, "UNREADABLE") }));
  const guess = gap.find(({ rest }) => /\b(guess|likely|infer|assume|default|best match|from the (total|amount))\w*\b/i.test(rest) && !negatedBefore(rest, /\b(guess|likely|infer|assume|default|best match|from the)/i));
  const drop = gap.find(({ rest }) => /\b(drop|skip|delete|ignore|leave (it )?out|remove)\w*\b/i.test(rest) && !negatedBefore(rest, /\b(drop|skip|delete|ignore|leave|remove)/i));
  const hold = gap.find(({ rest }) => /\b(hold|staff|person|human|review|bookkeeper|flag|arturo|send (it )?to)\w*\b/i.test(rest) && !negatedBefore(rest, /\b(hold|staff|person|human|review|bookkeeper|flag|arturo|send)/i));
  const unreadable: LedgerOut["unreadable"] = guess ? "guess" : drop ? "drop" : hold ? "hold" : "guess";
  return {
    isRefund: (row: Row) => conditions.some((condition) => condition(row)),
    subtract: !!subtracts && !adds,
    standing: { decimals: !!decimals, order: !!order, section: !!section },
    route, unreadable,
    sources: {
      classify: at(ruleClauses[0]), entry: at(adds ?? subtracts ?? entry[0]), standing: at(decimals ?? order ?? section ?? null),
      route: at(both ?? high ?? low ?? null), unreadable: at(guess ?? drop ?? hold ?? null),
    },
  };
}

const money = (value: number, decimals: boolean) => decimals ? value.toFixed(2).replace("-", "−") : String(Math.round(value)).replace("-", "−");

export const ledgerEngine: Engine<{ text: string }, LedgerInput, LedgerOut> = {
  id: "neutral.prompt-policy.ledger",
  provider: "neutral",
  label: "The next clerk’s new chat, applying your shared template row by row",
  simulated: true,
  parse(files) {
    const text = files[file] ?? "";
    const floor = promptFloor(text, "weekly-summary-template.md", file);
    return floor ? { ok: false, ...floor } : { ok: true, value: { text } };
  },
  run({ text }, fixture: Fixture<LedgerInput>): EngineRun<LedgerOut> {
    const input = fixture.input;
    const seen = readTemplate(text);
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    const missing = (["decimals", "order", "section"] as const).filter((key) => !seen.standing[key]);
    push({ actor: "person", kind: "request", label: `${input.clerk.name} opens a new chat; it loads weekly-summary-template.md (${countWords(text)} words)`,
      detail: missing.length ? `Not in the template, so ${input.clerk.name} types personal notes: ${missing.map((key) => input.clerk.notes[key]).join("; ")}` : "Every reviewed standing instruction is in the template; nothing is retyped.",
      tone: missing.length ? "warn" : "ok", source: { artifact: file, line: 1 } });

    const posted: Posted[] = input.rows.map((row) => {
      if (row.code === null) {
        if (seen.unreadable === "hold") {
          push({ actor: "model", kind: "decision", label: `Order ${row.order} · ${row.day} · ${row.amount.toFixed(2)} · type unreadable → held for ${input.reviewer} with the export row`, tone: "ok", source: seen.sources.unreadable });
          return { row, label: "held" as const, effect: 0, guessed: false };
        }
        if (seen.unreadable === "drop") {
          push({ actor: "model", kind: "decision", label: `Order ${row.order} · ${row.day} · ${row.amount.toFixed(2)} · type unreadable → removed from the summary`, tone: "bad", source: seen.sources.unreadable });
          return { row, label: "dropped" as const, effect: 0, guessed: false };
        }
        push({ actor: "model", kind: "decision", label: `Order ${row.order} · ${row.day} · ${row.amount.toFixed(2)} · type unreadable → posted as a sale (most rows are S)`, tone: "bad", source: seen.sources.unreadable });
        return { row, label: "sale" as const, effect: row.amount, guessed: true };
      }
      const refund = seen.isRefund(row);
      const effect = refund && seen.subtract ? -Math.abs(row.amount) : row.amount;
      push({ actor: "model", kind: "decision", label: `Order ${row.order} · ${row.day} · ${row.amount.toFixed(2)} · type ${row.code} → ${refund ? "refund" : "sale"}, ${effect < 0 ? "−" : "+"}${Math.abs(effect).toFixed(2)}`,
        source: refund ? seen.sources.entry : seen.sources.classify });
      return { row, label: refund ? "refund" as const : "sale" as const, effect, guessed: false };
    });
    const readable = posted.filter(({ row }) => row.code !== null);
    const total = Math.round(readable.reduce((sum, { effect }) => sum + effect, 0) * 100) / 100;
    const expected = Math.round(input.rows.filter(({ code }) => code !== null).reduce((sum, { amount, code }) => sum + (code === "R" ? -amount : amount), 0) * 100) / 100;

    const { decimals, order, section } = seen.standing;
    const line = ({ row, effect, label }: Posted) => `${order ? `#${row.order} ` : ""}${row.day} · ${label === "refund" ? "Refund" : "Sale"} · ${money(effect, decimals)}`;
    const shown = posted.filter(({ label }) => label === "sale" || label === "refund");
    const summary = section
      ? ["Sales", ...shown.filter(({ label }) => label === "sale").map(line), "Money returned", ...shown.filter(({ label }) => label === "refund").map(line)]
      : [...shown].sort((a, b) => days.indexOf(a.row.day) - days.indexOf(b.row.day)).map(line);
    const held = posted.filter(({ label }) => label === "held");
    if (held.length) summary.push(`Held for ${input.reviewer}: ${held.map(({ row }) => `#${row.order}`).join(", ")}`);
    summary.push(`Week (readable rows): ${money(total, decimals)}`);
    push({ actor: "model", kind: "output", label: `${input.clerk.name}’s weekly summary`, detail: summary.join("\n"), source: seen.sources.standing });

    const rate = { low: input.routes.low.cents, high: input.routes.high.cents, both: input.routes.low.cents + input.routes.high.cents }[seen.route];
    const cents = Math.round(rate * input.rows.length * 10) / 10;
    push({ actor: "service", kind: "metric", label: `Routing: ${{ low: "lower-cost route", high: "high-cost route", both: "both routes" }[seen.route]} · ${input.rows.length} rows × ${rate}¢ = ${cents}¢`, source: seen.sources.route, payload: { cents } });
    push({ actor: "person", kind: "metric", label: `${input.reviewer}’s reviewed ledger for the readable rows: ${expected.toFixed(2)} · summary shows ${total.toFixed(2)}`, tone: total === expected ? "ok" : "bad" });
    return {
      trace,
      out: { posted, total, expected, standing: seen.standing, summary, route: seen.route, cents, unreadable: seen.unreadable, sources: seen.sources },
      metrics: { total, cents },
    };
  },
};
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const routes = { low: { cents: 1.1, correct: 197 }, high: { cents: 6.5, correct: 200 }, trial: 200, bar: 98 };
const thisWeek: LedgerInput = {
  rows: [
    { order: 25, day: "Mon", amount: 42.0, code: "S" }, { order: 26, day: "Mon", amount: 15.1, code: "S" }, { order: 27, day: "Tue", amount: 18.4, code: "R" },
    { order: 28, day: "Wed", amount: 9.75, code: "S" }, { order: 29, day: "Wed", amount: 12.0, code: null }, { order: 30, day: "Thu", amount: 27.3, code: "S" },
  ],
  clerk: { name: "Bea", notes: { decimals: "round amounts to whole dollars", order: "group lines by day", section: "refunds go in with the sales" } },
  routes, reviewer: "Arturo",
};
const nextWeek: LedgerInput = {
  rows: [
    { order: 41, day: "Mon", amount: 7.25, code: "S" }, { order: 42, day: "Tue", amount: 12.6, code: "R" }, { order: 43, day: "Tue", amount: 30.0, code: null },
    { order: 44, day: "Wed", amount: 30.0, code: "S" }, { order: 45, day: "Thu", amount: 5.0, code: "R" }, { order: 46, day: "Fri", amount: 18.9, code: "S" },
  ],
  clerk: { name: "Theo", notes: { decimals: "amounts without cents", order: "dates instead of order numbers", section: "one list for everything" } },
  routes, reviewer: "Arturo",
};
const fixtures: Fixture<LedgerInput>[] = [
  { id: "this-week", name: "This week’s summary · Bea", set: "sample", situation: "Bea opens a new chat for this week’s summary; it loads the shared template and reads Export B.", input: thisWeek },
  { id: "next-week", name: "Next week’s summary · Theo", set: "transfer", variant: "next-week", situation: "Next week Theo opens a new chat with the same template and a new export.", input: nextWeek },
];

const documents: LabDocument[] = [
  { id: "a", title: "Export A · order 27, last week’s format", format: "code", text: "order 27 · amount −18.40 · (no type column)" },
  { id: "b", title: "Export B · order 27, Tuesday’s format", format: "code", text: "order 27 · amount 18.40 · type R" },
  { id: "changelog", title: "Export B changelog", text: "From Tuesday all amounts are positive. A new one-letter type column records the transaction kind: S for a sale, R for a return of money." },
  { id: "note", title: "Arturo’s correction note", text: "On last week’s summary: order 27 is money going back to the customer. The week should drop by 18.40, not rise. Nine drafts this month still used the withdrawn sign rule." },
  { id: "standing", title: "Reviewed standing instructions · Arturo", format: "code", text: "1. Amounts to the cent (18.40, never 18).\n2. Every line starts with the order number.\n3. Money returned goes in its own section, below sales." },
  { id: "bea", title: "Bea’s shift notes", text: "What I type at the start of each shift: round amounts to whole dollars; group lines by day; refunds go in with the sales." },
  { id: "trial", title: "Cost trial · 200 routine rows", text: "Lower-cost route: 197 correct, 1.1¢ a row. High-cost route: 200 correct, 6.5¢ a row. Routine rows may post when accuracy is at least 98%." },
  { id: "export", title: "This week’s export (Export B)", format: "code", text: "25 · Mon · 42.00 · S\n26 · Mon · 15.10 · S\n27 · Tue · 18.40 · R\n28 · Wed ·  9.75 · S\n29 · Wed · 12.00 · ▒ (type smudged)\n30 · Thu · 27.30 · S" },
];

const starter = `# Weekly billing summary · shared template
Version 3 · loaded by every clerk's new chat

## Refund rule
A row is a refund when the amount is negative.

## Ledger entry
Post every row with the amount the export shows.

## Routing
Send every row to the high-cost route.
If a code can't be read, post the row with the most likely code.
`;
const referenceText = `# Weekly billing summary · shared template
Version 4 · reviewed by Arturo · loaded by every clerk's new chat

## Refund rule
Export B records each row's kind in the type column. A row is a refund when its type is R. Type S is a sale.

## Ledger entry
Post each refund as money returned: subtract its original amount from the week's total.

## Standing instructions
Amounts to the cent, with two decimals.
Every line starts with the order number.
Money returned goes in its own section, below sales.

## Routing
Routine rows: use the lower-cost route; it meets the 98% bar.
If a row's code can't be read, hold it for Arturo with the export row attached. Do not guess.
`;
const reference: LabFiles = { [file]: referenceText };
const swap = (from: string, to: string) => (files: LabFiles): LabFiles => {
  if (!files[file].includes(from)) throw new Error(`kitchen-billing-audit mutant: “${from}” not in reference`);
  return { [file]: files[file].replace(from, to) };
};
const rule = "A row is a refund when its type is R.";

type C = Check<LedgerInput, LedgerOut>;
const checks: C[] = [
  {
    id: "refunds-found", objective: "7.1", title: "Every return of money is read as a refund, and no sale is",
    diagnosis: "To diagnose poor output after a change, hold the model and the template fixed and compare the same record before and after. Here the representation changed: the sign no longer marks a return of money; the new type column does. The rule must key on the field that now carries the meaning; a longer prompt or another model will not fix a source change.",
    hints: hints("Read the row lines in the trace, then put Export A and Export B for order 27 side by side: which field carries the meaning in each?",
      "Diagnosing poor output with matched inputs: same order, same template, old and new export. Whatever differs between the two rows is the cause, and the rule has to read that field.",
      "A thermostat starts reporting 70° as freezing after a firmware update. Comparing one reading before and after shows the sensor switched units, so the rule reads the new unit field."),
    reveal: "A row is a refund when its type is R.",
    evaluate: ({ out }) => {
      const missed = out.posted.find(({ row, label }) => row.code === "R" && label !== "refund");
      if (missed) return { passed: false, symptom: `Order ${missed.row.order} (${missed.row.amount.toFixed(2)}, type R) posts as a sale.`, source: out.sources.classify };
      const wrong = out.posted.find(({ row, label }) => row.code === "S" && label === "refund");
      if (wrong) return { passed: false, symptom: `Order ${wrong.row.order} (${wrong.row.amount.toFixed(2)}, type S) posts as a refund.`, source: out.sources.classify };
      return { passed: true, symptom: "Every type R row is read as a refund; every sale stays a sale." };
    },
  },
  {
    id: "week-matches-review", objective: "7.2", title: "The week’s total matches the bookkeeper’s reviewed ledger",
    diagnosis: "Feedback from a reviewer is evidence about what the output should be. Use it to revise the approach, then confirm on the same case: the refund needs the right category and the right effect on the total. Fixing the label while the arithmetic still adds the money is a partial revision.",
    hints: hints("Compare the summary’s week total with Arturo’s figure in the last line of the trace, then reread his correction note: what should order 27 do to the week?",
      "Revising from reviewer feedback: turn the correction into the rule (money returned reduces the week by its original amount), rerun the same week, and check the total now matches the reviewer’s.",
      "A grader notes that a rubric scored a late essay as on time. The teacher updates the rule, regrades that essay and checks the gradebook total moved as expected."),
    reveal: "Post each refund as money returned: subtract its original amount from the week's total.",
    evaluate: ({ out }, { input }) => out.total === out.expected
      ? { passed: true, symptom: `The week shows ${out.expected.toFixed(2)}, matching ${input.reviewer}’s ledger.` }
      : { passed: false, symptom: `The summary’s week shows ${out.total.toFixed(2)}; ${input.reviewer}’s ledger for the same rows shows ${out.expected.toFixed(2)}.`, source: out.sources.entry },
  },
  {
    id: "standing-loaded", objective: "7.3", title: "The next clerk’s chat follows the reviewed format without retyping anything",
    diagnosis: "Improving workflow efficiency means removing repeated manual setup. Standing instructions every clerk needs belong in the shared, versioned template, so each new chat starts with the reviewed version instead of whatever a clerk remembers. Retyped instructions drift apart.",
    hints: hints("Read the first line of the trace: what did the clerk have to type, and how does that show up in the summary?",
      "Reusable shared instructions: put the reviewed standing instructions in the template every chat loads (a Project’s instructions work the same way). One edit then updates every clerk.",
      "A support team stores the approved refund wording in a shared macro; when legal changes it, one edit updates every agent’s replies."),
    reveal: "## Standing instructions\nAmounts to the cent. Every line starts with the order number. Money returned goes in its own section.",
    evaluate: ({ out }, { input }) => {
      const { decimals, order, section } = out.standing;
      if (decimals && order && section) return { passed: true, symptom: `${input.clerk.name}’s summary follows the reviewed format with nothing retyped.` };
      const sample = out.summary.find((entry) => /·/.test(entry)) ?? out.summary[0];
      const drift = [!decimals && "amounts rounded", !order && "lines start with the day", !section && "refunds mixed in with sales"].filter(Boolean).join(", ");
      return { passed: false, symptom: `${input.clerk.name}’s summary reads “${sample}” (${drift}), from notes typed at the start of the shift.`, source: out.sources.standing };
    },
  },
  {
    id: "routine-cost", objective: "3.3", title: "Routine rows run on the cheapest route that meets the accuracy bar",
    diagnosis: "Balance cost, speed and quality against an explicit requirement: compute each option’s accuracy and price, and choose the cheapest that clears the bar. Paying for accuracy the task does not need is waste; running both routes doubles the cost and still needs a rule to choose.",
    hints: hints("Read the routing line in the trace, then the Cost trial: what accuracy does a routine row need, and what does each route achieve?",
      "Cost against a stated bar: 197 of 200 is 98.5%, which clears 98%. The cheaper route that clears the bar is the right one for routine rows.",
      "A print shop needs 300 dpi scans. Scanner X does 400 dpi for 2¢ a page, scanner Y does 1200 dpi for 9¢, so ordinary jobs go to X."),
    reveal: "Routine rows: use the lower-cost route.",
    evaluate: ({ out }, { input }) => out.route === "low"
      ? { passed: true, symptom: `${input.rows.length} rows cost ${out.cents}¢.` }
      : { passed: false, symptom: `${input.rows.length} routine rows cost ${out.cents}¢ this week${out.route === "both" ? ", each one run twice" : ""}.`, source: out.sources.route },
  },
  {
    id: "unreadable-held", objective: "3.3", title: "A row nobody can read waits for a person",
    diagnosis: "Quality and cost trade-offs include where a person is needed. Clear routine rows run through the cheaper automated path; a row whose code cannot be read goes to a person with the original attached. Guessing posts a silent error; dropping it leaves the ledger silently incomplete.",
    hints: hints("Find the row with a smudged type in the trace. What happened to it?",
      "Human review for uncertain inputs: the template says what to do when a required field is unreadable, and it is a person, not a default.",
      "An expense app auto-approves clear receipts and sends blurred ones to finance with the photo attached instead of estimating the amount."),
    reveal: "If a row's code can't be read, hold it for Arturo with the export row attached.",
    evaluate: ({ out }, { input }) => {
      const bad = out.posted.find(({ row, label }) => row.code === null && label !== "held");
      if (!bad) return { passed: true, symptom: "The unreadable row waits for a person." };
      return { passed: false, symptom: bad.label === "dropped" ? `Order ${bad.row.order} (${bad.row.amount.toFixed(2)}) is missing from the summary, and nobody was told.`
        : `Order ${bad.row.order} (${bad.row.amount.toFixed(2)}, type unreadable) posts as a sale without ${input.reviewer} seeing it.`, source: out.sources.unreadable };
    },
  },
];

function effects(runs: readonly LabRunFixture<LedgerInput, LedgerOut>[]) {
  return runs.flatMap(({ run }) => {
    if (!run) return [];
    return [
      ...run.out.posted.filter(({ row }) => row.code !== "S").map(({ row, label, guessed }) => ({ kind: "tray" as const, item: `Order ${row.order}`,
        to: label === "held" ? "escalated" as const : label === "dropped" || guessed ? "failed" as const : label === "refund" && row.code === "R" ? "posted" as const : "failed" as const })),
      { kind: "meter" as const, id: "cost", label: "routing cost this week", value: run.out.cents, unit: "¢" },
    ];
  });
}

export const kitchenBillingAuditLab: LabMission<{ text: string }, LedgerInput, LedgerOut> = {
  id: "kitchen-billing-audit",
  provider: "anthropic",
  track: "associate-foundations",
  objectives: ["3.3", "7.1", "7.2", "7.3"],
  station: "Refund ledger · shared summary template",
  speaker: "Lina Ortiz",
  opening: "A refund from last week shows up as a new sale. The supplier changed the export on Tuesday, and every clerk still types their own instructions.",
  task: "Repair the shared template every clerk’s new chat loads for the weekly summary, then run it on this week’s export.",
  brief: {
    problem: "After the supplier changed its export, refunds post as sales, clerks retype instructions that have drifted apart, and every row runs on the expensive route.",
    move: "Put Export A and Export B for order 27 side by side, then read the changelog, Arturo’s note, his standing instructions and the Cost trial. Edit the template and run it.",
    success: ["Every return of money is read as a refund", "The week’s total matches Arturo’s reviewed ledger", "The next clerk retypes nothing",
      "Routine rows post at the lowest cost that meets 98%", "0 unreadable rows posted"],
  },
  prebrief: {
    concept: "When output gets worse after a change, hold everything else fixed and compare the same record before and after to find what changed. Then put the fix where every operator loads it.",
    terms: [["Compare the same order in both files", "Diagnosing poor output with matched inputs"], ["Fix the rule from the bookkeeper’s note", "Using feedback to revise the approach"],
      ["Save the rule where everyone loads it", "Reusable shared instructions (Project instructions / template)"], ["Cheaper route when it’s accurate enough", "Balancing cost, speed and quality"]],
    contrast: {
      good: "A bakery’s bread turns out flat after a new flour arrives. They bake one loaf with old flour and one with new, same oven and recipe, and adjust hydration.",
      bad: "The bakery changes the oven, recipe and flour at once and cannot tell what fixed it.",
    },
  },
  documents,
  artifacts: [{
    id: file, kind: "shared-template", path: "shared/weekly-summary-template.md", editor: "markdown",
    instruction: "The template every clerk’s new chat loads before the weekly summary. Plain sentences under headings.",
    starter,
    example: "# Monthly stock count · shared template\n\n## Damaged items\nAn item is damaged when its status column says D.\n\n## Format\nQuantities as whole numbers. Every line starts with the item code.",
  }],
  engine: ledgerEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "What will the summary show as the week’s total for the readable rows?", unit: "dollars", tolerance: 0.01,
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.total ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { "next-week": reference } },
  mutants: [
    { name: "withdrawn sign rule kept", set: "sample", mustFail: ["refunds-found", "week-matches-review"], edit: swap(rule, "A row is a refund when the amount is negative.") },
    { name: "the new letter misread", set: "sample", mustFail: ["refunds-found", "week-matches-review"], edit: swap(rule, "A row is a refund when its type is S.") },
    { name: "old rule flipped", set: "sample", mustFail: ["refunds-found", "week-matches-review"], edit: swap(rule, "A row is a refund when the amount is positive.") },
    { name: "refund labelled but still added", set: "sample", mustFail: ["week-matches-review"],
      edit: swap("Post each refund as money returned: subtract its original amount from the week's total.", "Post each refund with the amount the export shows.") },
    { name: "refund counted as a sale", set: "sample", mustFail: ["week-matches-review"],
      edit: swap("Post each refund as money returned: subtract its original amount from the week's total.", "Post each refund as a sale of the same amount.") },
    { name: "standing instructions left to each clerk", set: "sample", mustFail: ["standing-loaded"],
      edit: swap("## Standing instructions\nAmounts to the cent, with two decimals.\nEvery line starts with the order number.\nMoney returned goes in its own section, below sales.\n", "") },
    { name: "one standing instruction missing", set: "sample", mustFail: ["standing-loaded"], edit: swap("Every line starts with the order number.\n", "") },
    { name: "high-cost route for routine rows", set: "sample", mustFail: ["routine-cost"], edit: swap("use the lower-cost route; it meets the 98% bar", "use the high-cost route; it is the most accurate") },
    { name: "both routes", set: "sample", mustFail: ["routine-cost"], edit: swap("use the lower-cost route; it meets the 98% bar", "run both routes and compare") },
    { name: "unreadable code guessed", set: "sample", mustFail: ["unreadable-held"],
      edit: swap("hold it for Arturo with the export row attached. Do not guess.", "post it with the most likely code.") },
    { name: "unreadable row dropped", set: "sample", mustFail: ["unreadable-held"], edit: swap("hold it for Arturo with the export row attached. Do not guess.", "drop it from the summary.") },
  ],
  probes: [
    { name: "every condition at once", set: "sample", mustFail: ["refunds-found"], files: (files) => swap(rule, "A row is a refund when its type is R, when its type is S, or when the amount is negative.")(files) },
    { name: "add and subtract", set: "sample", mustFail: ["week-matches-review"],
      files: (files) => swap("Post each refund as money returned: subtract its original amount from the week's total.", "Post each refund as money returned: subtract it, or add it to the week if unsure.")(files) },
  ],
  overfit: { [file]: referenceText.replace(rule, "A row is a refund when it is order 27.") },
  fixTerms: ["type is R", "subtract", "lower-cost", "to the cent", "order number", "own section", "hold it"],
  debrief: "Compared side by side, order 27 lost its minus sign and gained a type letter, so the rule now keys on type R instead of the sign. Arturo’s note became the entry rule: money returned reduces the week by its original amount, and the rerun matches his ledger. His reviewed standing instructions live in the shared template, so the next clerk’s chat loads them instead of her own notes. Routine rows take the lower-cost route because 197 of 200 clears the 98% bar, and a row whose type cannot be read waits for Arturo with the export row. Next week’s export, with two refunds and a different clerk, shows the template working without edits.",
};
