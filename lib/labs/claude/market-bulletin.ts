// Associate Foundations · market-bulletin. The learner writes the request the market sends Claude for the Friday
// bulletin. A property-driven simulator (prompt-policy) drafts the vendor notice and the staff copy: the times follow the
// source the request names (or the last thing typed into it), the forms follow its work order, Dock B follows who each
// sentence is about, and the drafts go where its last instruction sends them. Transfer (rerun, hidden): the same
// request runs on a Holiday Monday with a different signed sheet, different forms and a different dock time.
import { hints } from "../../claude/casework";
import {
  allClauses, at, clauseHits, contextOf, countWords, negated, negatedBefore, numberedSteps, promptFloor, sentences, stepIndex,
} from "../engines/prompt-policy";
import type { Sentence } from "../engines/prompt-policy";
import type { Check, Engine, EngineRun, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture, TraceEvent, TraceSource } from "../types";

type Form = { id: string; signed: boolean; change: string; time?: string };
export type BulletinInput = {
  day: string;
  sheet: { title: string; opening: string; cutoff: string };
  old: { title: string; opening: string; cutoff: string };
  dockTime: string;
  forms: readonly Form[];
  approver: string;
  outbox: string;
};
type FormOutcome = { form: Form; outcome: "announced" | "pending" | "left out"; withId: boolean };
export type BulletinOut = {
  vendor: string[];
  /** null when the request asks for one bulletin for everyone. */
  staff: string[] | null;
  opening: string;
  cutoff: string | null;
  timesFrom: string;
  workOrder: "staged" | "merged" | "filtered" | "ignored";
  forms: FormOutcome[];
  dock: { vendor: boolean; staff: boolean };
  destination: "approver" | "published" | "outbox";
  attached: boolean;
  sources: Record<"times" | "fields" | "forms" | "audience" | "destination", TraceSource>;
};

const file = "request";
const audienceWords = { vendor: /\bvendors?\b|public|notice\b/i, staff: /\bstaff\b|employees?|workers?/i, all: /everyone|every (copy|version|draft)|both|all (copies|versions|drafts|readers)/i };
const publishVerb = /\b(publish|post|release|send|email|distribute|share)\b/i;

function readRequest(text: string, input: BulletinInput): BulletinOut {
  const list = sentences(text);
  const clauses = allClauses(list);
  const approver = new RegExp(`\\b${input.approver}\\b`, "i");

  // Times: a time typed into the request is used as written; otherwise the source it names; otherwise the old bulletin.
  const typedOpen = clauses.find((clause) => /open/i.test(clause.text) && !/dock/i.test(clause.text) && /open\w*\D{0,24}\d{1,2}:\d{2}/i.test(clause.text));
  const typedCut = clauses.find((clause) => !/dock/i.test(clause.text) && /(?:deliver\w*|cut-?off)\D{0,24}\d{1,2}:\d{2}/i.test(clause.text));
  // The source must be named for the times, not only mentioned as something to attach for the approver.
  const named = clauseHits(list, /signed/i, /sheet/i).said.filter(({ text: clause }) => !/\b(tray|desk|inbox|attach\w*|alongside)\b/i.test(clause) && !approver.test(clause));
  const override = clauseHits(list, /\b(use|take|prefer|follow|go with|apply)\b/i, /\b(latest|newest|most recent|last season|forms?['’]?s?|requests?|requested)\b/i)
    .said.find(({ text: clause }) => /\b(time|times|hours?|opening)\b/i.test(clause));
  const newestTime = [...input.forms].reverse().find(({ time }) => time);
  let opening: string;
  let timesFrom: string;
  let timesSource: TraceSource;
  if (typedOpen) {
    opening = /open\w*\D{0,24}(\d{1,2}:\d{2})/i.exec(typedOpen.text)![1];
    timesFrom = "the times typed into your request";
    timesSource = at(file, typedOpen);
  } else if (override && newestTime) {
    opening = newestTime.time!;
    timesFrom = `${newestTime.id}, the newest form with a time`;
    timesSource = at(file, override);
  } else if (named.length) {
    opening = input.sheet.opening;
    timesFrom = input.sheet.title;
    timesSource = at(file, named[0]);
  } else {
    opening = input.old.opening;
    timesFrom = `${input.old.title}, the only paper in the tray printed as a bulletin`;
    timesSource = at(file, null);
  }

  // Required fields: a clause about the vendor notice (or no one in particular) naming both the opening and the delivery cutoff.
  const fields = clauses.find((clause) => /open/i.test(clause.text) && /deliver|cut-?off/i.test(clause.text) && !negatedBefore(clause.text, /open|deliver|cut-?off/i)
    && (() => { const who = contextOf(clause, clause.text, audienceWords); return !who.length || who.includes("vendor") || who.includes("all"); })());
  const cutoff = !fields ? null
    : typedCut ? /(?:deliver\w*|cut-?off)\D{0,24}(\d{1,2}:\d{2})/i.exec(typedCut.text)![1]
      : typedOpen ? input.sheet.cutoff
        : named.length || override ? input.sheet.cutoff : input.old.cutoff;

  // Work order: numbered steps that extract changes with their IDs, check signatures, then draft.
  const steps = numberedSteps(text);
  const extract = stepIndex(steps, 0, /\b(extract|list|pull|collect|note|go through|read|find)\b/i, /\b(forms?|changes?|requests?)\b/i, /\b(ids?|numbers?)\b/i);
  const check = extract < 0 ? -1 : stepIndex(steps, extract, /\b(check|compare|verify|match|confirm|mark)\b/i, /sign|approv/i);
  const draft = check < 0 ? -1 : stepIndex(steps, check + 1, /\b(draft|write|compose|produce|prepare)\b/i);
  const merge = clauseHits(list, /\b(summari[sz]e|announce|include|mention|add|publish)\b/i, /\b(all|every|each)\b/i, /\b(forms?|changes?|requests?)\b/i)
    .said.find(({ text: clause }) => !/sign|approv|check|pending|verified/i.test(clause));
  const unsignedRule = list.find(({ text: sentence }) => /unsigned|not signed|no signature|without (a |its )?signature|lacks? (a )?signature|approval box/i.test(sentence));
  // The forms travel with the request either way; only an explicit instruction keeps Claude from using them.
  const ignore = clauses.find(({ text: clause }) => /\b(ignore|skip|leave out|disregard|don['’]?t use|do not use)\b/i.test(clause) && /\bforms?\b/i.test(clause) && !/sign|approv/i.test(clause));
  const mentionsForms = list.find(({ text: sentence }) => /\b(forms?|changes?|requests?|tray)\b/i.test(sentence));
  const workOrder: BulletinOut["workOrder"] = merge ? "merged" : draft >= 0 ? "staged" : unsignedRule ? "filtered" : ignore ? "ignored" : "merged";
  const forms: FormOutcome[] = input.forms.map((form) => {
    if (workOrder === "merged") return { form, outcome: "announced", withId: false };
    if (workOrder === "staged") return { form, outcome: form.signed ? "announced" : "pending", withId: true };
    if (workOrder === "filtered") return { form, outcome: form.signed ? "announced" : "left out", withId: false };
    return { form, outcome: "left out", withId: false };
  });
  const formsSource = at(file, merge ?? (draft >= 0 ? steps[extract] : unsignedRule ?? ignore ?? mentionsForms ?? null));

  // Audience: one bulletin for everyone unless a staff copy is asked for; Dock B follows who each sentence is about.
  const staffCopy = /(staff|employees?)['’]?s?\s+(copy|version|notice|draft|note|bulletin)|(copy|version|notice|draft|note|bulletin)\s+for\s+(the\s+)?(market\s+)?(staff|employees)|two\s+(versions|drafts|copies|notices|bulletins)/i.test(text) && /vendor/i.test(text);
  let vendorDock = false;
  let vendorBlocked = false;
  let staffDock = false;
  let dockSource: TraceSource | undefined;
  for (const clause of clauses.filter(({ text: value }) => /\bdock\b|unload/i.test(value))) {
    const who = contextOf(clause, clause.text, audienceWords);
    const only = /\bonly\b/i.test(clause.text);
    if (negated(clause.text)) {
      if (who.includes("vendor") || (only && who.includes("staff"))) vendorBlocked = true;
      continue;
    }
    if (who.includes("staff")) { staffDock = true; if (only) vendorBlocked = true; }
    if (who.includes("all")) staffDock = true;
    if (who.includes("vendor") || who.includes("all") || !who.length) {
      if (who.includes("vendor") || who.includes("all")) { vendorDock = true; dockSource = at(file, clause); }
      if (!who.length) { staffDock = true; if (!vendorBlocked) { vendorDock = true; dockSource ??= at(file, clause); } }
    }
  }
  // A generic "include Dock B" earlier in the text is overridden by an explicit vendor exclusion; an explicit include is not.
  const explicitVendorDock = clauses.some((clause) => /\bdock\b|unload/i.test(clause.text) && !negated(clause.text)
    && (audienceWords.vendor.test(clause.text) || audienceWords.all.test(clause.text)));
  if (vendorBlocked && !explicitVendorDock) vendorDock = false;
  if (!staffCopy) {
    const anyDock = clauses.some((clause) => /\bdock\b|unload/i.test(clause.text) && !negated(clause.text));
    vendorDock = anyDock || !clauses.some((clause) => /\bdock\b|unload/i.test(clause.text));
    staffDock = vendorDock;
  }
  const audienceSource = dockSource ?? at(file, list.find(({ text: value }) => /\bdock\b|unload/i.test(value)) ?? list.find(({ text: value }) => audienceWords.staff.test(value)) ?? null);

  // Destination: the request's instruction about where drafts go.
  let published: Sentence | undefined;
  let toApprover: Sentence | undefined;
  for (const clause of clauses) {
    const names = approver.test(clause.text);
    const places = /\b(tray|desk|inbox|queue)\b/i.test(clause.text) || /\b(put|place|send|leave|route|give|hand|pass|submit|hold|forward)\b/i.test(clause.text) || /for \w+ to (sign|approve|review|check)/i.test(clause.text);
    // Sending to the approver ("email both drafts to Inez", "publish once Inez signs") is routing for approval, not publishing.
    if (publishVerb.test(clause.text) && !negatedBefore(clause.text, publishVerb)) {
      if (names) toApprover ??= clause;
      else published ??= clause;
    } else if (names && places && !negated(clause.text)) toApprover ??= clause;
  }
  const destination: BulletinOut["destination"] = published ? "published" : toApprover ? "approver" : "outbox";
  const approverSentence = toApprover ? list.find(({ line, text: value }) => line === toApprover!.line && value.includes(toApprover!.text)) : undefined;
  const attached = !!approverSentence && /\b(with|attach\w*|alongside|plus|together)\b/i.test(approverSentence.text) && /sheet|sources?|pending|forms?/i.test(approverSentence.text)
    || list.some(({ text: value }) => /\b(attach\w*|alongside)\b/i.test(value) && /sheet|sources?|pending|forms?/i.test(value) && approver.test(text));

  const announced = forms.filter(({ outcome }) => outcome === "announced");
  const timesLines = [`${input.day} market opens at ${opening}.`, ...(cutoff ? [`Deliveries must arrive by ${cutoff}.`] : [])];
  const changeLines = announced.map(({ form, withId }) => `${form.change}${withId ? ` (${form.id})` : ""}.`);
  const vendor = [...timesLines, ...changeLines, ...(vendorDock ? [`Dock B opens at ${input.dockTime} for unloading.`] : [])];
  const staff = staffCopy ? [...timesLines, ...(staffDock ? [`Dock B opens at ${input.dockTime}: unload there before the market opens.`] : []), ...changeLines,
    ...forms.filter(({ outcome }) => outcome === "pending").map(({ form }) => `Waiting for a signature: ${form.id} · ${form.change}.`)] : null;
  return {
    vendor, staff, opening, cutoff, timesFrom, workOrder, forms, dock: { vendor: vendorDock, staff: staffDock }, destination, attached,
    sources: {
      times: timesSource, fields: at(file, fields ?? list.find(({ text: value }) => audienceWords.vendor.test(value)) ?? null), forms: formsSource,
      audience: audienceSource, destination: at(file, published ?? toApprover ?? list[list.length - 1] ?? null),
    },
  };
}

export const bulletinEngine: Engine<{ text: string }, BulletinInput, BulletinOut> = {
  id: "neutral.prompt-policy.bulletin",
  provider: "neutral",
  label: "Simulated Claude drafting from your request (property-driven)",
  simulated: true,
  parse(files) {
    const text = files[file] ?? "";
    const floor = promptFloor(text, "bulletin-request.md", file);
    return floor ? { ok: false, ...floor } : { ok: true, value: { text } };
  },
  run({ text }, fixture: Fixture<BulletinInput>): EngineRun<BulletinOut> {
    const input = fixture.input;
    const out = readRequest(text, input);
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });
    push({ actor: "learner-artifact", kind: "request", label: `bulletin-request.md · ${countWords(text)} words, sent with the tray`,
      detail: `Papers: ${input.sheet.title}; ${input.old.title}; form tray (${input.forms.map(({ id }) => id).join(", ")}); Dock B note`, source: { artifact: file, line: 1 } });
    push({ actor: "model", kind: "decision", label: `Times taken from ${out.timesFrom}`, source: out.sources.times });
    const pending = out.forms.filter(({ outcome }) => outcome === "pending").map(({ form }) => form.id);
    const workLabel = {
      staged: `Works in stages: lists ${out.forms.length} changes by form number, finds ${pending.length} without a signature (${pending.join(", ")}), then drafts`,
      merged: `One pass over the tray (the forms come with the request): every change goes straight into the drafts`,
      filtered: `One pass over the tray: changes without a signature are dropped while drafting`,
      ignored: `The request says to ignore the forms; no changes are read`,
    }[out.workOrder];
    push({ actor: "model", kind: "decision", label: workLabel, source: out.sources.forms });
    push({ actor: "model", kind: "output", label: out.staff ? "Vendor notice" : "Bulletin (one version for everyone)", detail: out.vendor.join("\n"), source: out.sources.fields });
    push({ actor: "model", kind: "output", label: out.staff ? "Staff copy" : "No staff copy: employees read the same bulletin", detail: out.staff?.join("\n"), source: out.sources.audience });
    const where = {
      approver: `Drafts placed in ${input.approver}’s tray${out.attached ? " with the signed sheet and the unsigned forms" : " (drafts only)"}`,
      published: `Drafts posted to the vendor list as soon as they were written`,
      outbox: `No destination given: drafts wait in the outbox, which sends to the vendor list ${input.outbox}`,
    }[out.destination];
    push({ actor: "service", kind: "decision", label: where, tone: out.destination === "approver" ? "ok" : "bad", source: out.sources.destination });
    for (const { form, outcome } of out.forms) {
      if (!form.signed && outcome === "announced") push({ actor: "person", kind: "output", label: `Vendors read “${form.change}” as decided; ${form.id} carries no signature`, tone: "bad" });
    }
    if (out.dock.vendor) push({ actor: "person", kind: "output", label: `Vendors read the Dock B unloading time`, tone: "warn" });
    return { trace, out, metrics: { announcedUnsigned: out.forms.filter(({ form, outcome }) => !form.signed && outcome === "announced").length,
      announced: out.forms.filter(({ outcome }) => outcome === "announced").length } };
  },
};

const friday: BulletinInput = {
  day: "Friday",
  sheet: { title: "Signed hours sheet · Friday", opening: "8:30", cutoff: "8:00" },
  old: { title: "Last season’s bulletin", opening: "9:00", cutoff: "7:30" },
  dockTime: "7:45",
  forms: [
    { id: "V-12", signed: true, change: "The honey stall moves to row A" },
    { id: "V-17", signed: false, change: "Opening moves to 9:00", time: "9:00" },
    { id: "V-21", signed: false, change: "Flower stalls move to the north lot" },
  ],
  approver: "Inez",
  outbox: "Friday at 6:00",
};
const holiday: BulletinInput = {
  day: "Holiday Monday",
  sheet: { title: "Signed hours sheet · Holiday Monday", opening: "9:30", cutoff: "8:15" },
  old: { title: "Last year’s holiday bulletin", opening: "10:00", cutoff: "9:00" },
  dockTime: "7:15",
  forms: [
    { id: "V-28", signed: true, change: "The coffee cart moves next to the fountain" },
    { id: "V-30", signed: false, change: "Opening moves to 10:00", time: "10:00" },
    { id: "V-33", signed: false, change: "Bread stalls move to the east lane" },
  ],
  approver: "Inez",
  outbox: "Monday at 6:00",
};

const fixtures: Fixture<BulletinInput>[] = [
  { id: "friday", name: "Friday bulletin", set: "sample", situation: "Claude drafts the Friday bulletin from your request and the papers on Inez’s desk.", input: friday },
  { id: "holiday", name: "Holiday Monday bulletin", set: "transfer", variant: "holiday", situation: "Next week the same request runs for the Holiday Monday market: a new signed sheet, new forms and an earlier dock.", input: holiday },
];

const documents: LabDocument[] = [
  { id: "sheet", title: "Signed hours sheet · Friday", text: "Signed by Inez Vega on Tuesday. Market opens 8:30. Deliveries must arrive by 8:00." },
  { id: "tray", title: "Form tray · 20 forms this week", format: "code", text: "V-12 · The honey stall moves to row A · signed by Inez\nV-17 · Opening moves to 9:00 · approval box empty\nV-21 · Flower stalls move to the north lot · no signature, arrived this morning\nThe other 17 forms repeat last week’s stall places." },
  { id: "dock", title: "Dock B note", text: "Dock B opens at 7:45 for unloading. Only market employees use the dock; vendors never enter it. Last month two vendors went to the dock because the public notice described it." },
  { id: "old", title: "Last season’s bulletin", text: "Market opens 9:00. Deliveries by 7:30. Printed last season." },
  { id: "tool", title: "Bulletin tool", text: "Claude drafts in the market’s bulletin tool and follows the request’s instruction about where drafts go. Drafts with no destination wait in the outbox, which sends to the vendor list Friday at 6:00. Market rule: nothing public goes out until Inez signs it." },
];

const starter = `# Friday bulletin request

Write this week's market bulletin from the papers in the tray.
Summarize all the forms that came in so vendors know what changed.
Include the Dock B opening for unloading.
Keep it friendly and short. Publish it to the vendor list when it's done.
`;

const referenceText = `# Friday bulletin request

You are drafting the market bulletin in two versions from the same facts: a vendor notice for vendors and a staff copy for market employees.

Source: take every time from the signed hours sheet. Vendor forms are requests until Inez signs them.

Steps:
1. List every change in the form tray with its form ID.
2. Check each change for Inez's signature and mark unsigned forms as pending.
3. Draft both versions from the checked list only.

Vendor notice: must include the opening time and the delivery cutoff. No Dock B directions; vendors never use the dock.
Staff copy: the same times, the Dock B unloading procedure, and the pending forms.

When the drafts are ready, put both in Inez's approval tray with the signed sheet and the pending forms. Do not publish.
`;
const reference: LabFiles = { [file]: referenceText };
const swap = (from: string, to: string) => (files: LabFiles): LabFiles => {
  if (!files[file].includes(from)) throw new Error(`market-bulletin mutant: “${from}” not in reference`);
  return { [file]: files[file].replace(from, to) };
};
const stepsBlock = "Steps:\n1. List every change in the form tray with its form ID.\n2. Check each change for Inez's signature and mark unsigned forms as pending.\n3. Draft both versions from the checked list only.";

type C = Check<BulletinInput, BulletinOut>;
const checks: C[] = [
  {
    id: "fields-complete", objective: "1.1", title: "The vendor notice gives the opening time and the delivery cutoff",
    diagnosis: "A task-specific prompt states the audience, the source and every field the output must contain. Without a required-fields list, Claude writes a fluent notice that can silently leave one out, and the reviewer has nothing to check completeness against.",
    hints: hints("Read the vendor notice in the trace, then the Signed hours sheet: how many times does the sheet give, and which does a vendor act on?",
      "Task-specific prompt: name who the output is for and list the fields it must contain (here, both times from the signed sheet). The list also becomes the reviewer’s completeness checklist.",
      "A prompt for a flight-change email lists its required fields: new departure, gate and rebooking link. Every generated email then contains all three, and a reviewer can tick them off."),
    reveal: "Vendor notice: must include the opening time and the delivery cutoff.",
    evaluate: ({ out }, { input }) => out.cutoff
      ? { passed: true, symptom: `Vendors read the opening time and when deliveries close.` }
      : { passed: false, symptom: `Vendors read “${out.vendor[0].replace(/\.$/, "")}” and nothing about when deliveries close; the ${input.sheet.title} gives two times.`, source: out.sources.fields },
  },
  {
    id: "steps-traced", objective: "1.2", title: "Every change shows its form, and unsigned forms stay visible but undecided",
    diagnosis: "Breaking the work into steps (prompt chaining) gives each step one job: pull each change with its ID, compare it with the signatures, then write from the checked list. An unsigned change is caught before any prose exists, and each line in the draft can be traced to its form. One pass over twenty forms hides both.",
    hints: hints("Read the work-order line in the trace and find the forms with an empty approval box. Where do they end up, and can Inez tell which form each change came from?",
      "Prompt chaining: ask for the intermediate result first (each change with its form ID), then a check of that list against signatures, then the draft. Unsigned items surface as a list Inez can see instead of disappearing or slipping in.",
      "A tax preparer lists every receipt with its number, matches the list to bank statements, and only then fills in the return. An unmatched receipt is flagged on the list before it reaches the form."),
    reveal: "1. List every change with its form ID. 2. Check each for a signature; mark unsigned ones pending. 3. Draft from the checked list.",
    evaluate: ({ out }) => {
      const leaked = out.forms.find(({ form, outcome }) => !form.signed && outcome === "announced");
      if (leaked) return { passed: false, symptom: `The drafts announce “${leaked.form.change}”; ${leaked.form.id} carries no signature.`, source: out.sources.forms };
      const lost = out.forms.find(({ form, outcome }) => form.signed && outcome !== "announced");
      if (lost) return { passed: false, symptom: `${lost.form.id} is signed, yet “${lost.form.change}” appears in neither draft.`, source: out.sources.forms };
      const untraced = out.forms.find(({ outcome, withId }) => outcome === "announced" && !withId);
      const vanished = out.forms.find(({ outcome }) => outcome === "left out");
      if (untraced || vanished) return { passed: false, symptom: `${untraced ? `“${untraced.form.change}” appears with no form number` : "Every change shows its form"}${vanished ? `; ${vanished.form.id} appears nowhere, so Inez cannot see it is waiting` : ""}.`, source: out.sources.forms };
      return { passed: true, symptom: "Each change shows its form; unsigned forms are listed as waiting." };
    },
  },
  {
    id: "times-match", objective: "2.1", title: "Every time in both drafts matches the signed sheet",
    diagnosis: "Checking accuracy means comparing each claim in the output with the approved source. Requests, old bulletins and forms all contain plausible times; only the signed sheet is authoritative. A request that names its source makes the draft checkable; a time typed into the request is repeated as written, even after the sheet changes.",
    hints: hints("Compare the opening line in the trace with the signed hours sheet, then read the trace line that says where Claude took its times from.",
      "Accuracy check against the approved source: tell Claude which document is authoritative for each fact, and keep the facts themselves in the documents so a new sheet updates the draft.",
      "A conference app shows each keynote at the time on the organizer’s confirmed agenda, not the time a speaker proposed by email, and reads the agenda fresh each day."),
    reveal: "Source: take every time from the signed hours sheet.",
    evaluate: ({ out }, { input }) => {
      if (out.opening !== input.sheet.opening) return { passed: false, symptom: `Vendors read “opens at ${out.opening}”; the ${input.sheet.title} says ${input.sheet.opening}.`, source: out.sources.times };
      if (out.cutoff && out.cutoff !== input.sheet.cutoff) return { passed: false, symptom: `Vendors read “deliveries by ${out.cutoff}”; the ${input.sheet.title} says ${input.sheet.cutoff}.`, source: out.sources.times };
      return { passed: true, symptom: `Every time in the drafts matches the ${input.sheet.title}.` };
    },
  },
  {
    id: "audience-fit", objective: "2.5", title: "Dock B directions reach employees and only employees",
    diagnosis: "Adapting output for an audience means reusing the same verified facts while changing detail for each reader. Employees need the unloading procedure; vendors need arrival times and never use the dock. Asking for two versions from one set of facts keeps the times consistent while each reader gets what they act on.",
    hints: hints("Open both drafts in the trace and the Dock B note: who uses the dock, and who reads which draft?",
      "Same facts, different reader: ask for one version per audience and say what each one contains and leaves out. Content meant for one group stays out of the other group’s copy.",
      "A hospital discharge note for the patient explains the medicine schedule in plain words; the pharmacy’s version lists dosages and codes. Both come from one chart."),
    reveal: "Staff copy: the same times plus the Dock B unloading procedure. Vendor notice: no Dock B directions.",
    evaluate: ({ out }, { input }) => {
      if (!out.staff) return { passed: false, symptom: `Vendors and employees get one identical bulletin${out.dock.vendor ? `, and it tells vendors “Dock B opens at ${input.dockTime} for unloading”` : ""}.`, source: out.sources.audience };
      if (out.dock.vendor) return { passed: false, symptom: `The vendor notice tells vendors “Dock B opens at ${input.dockTime} for unloading.”`, source: out.sources.audience };
      if (!out.dock.staff) return { passed: false, symptom: `Employees get a copy with no Dock B unloading time.`, source: out.sources.audience };
      return { passed: true, symptom: "Dock B directions appear in the employees’ copy only." };
    },
  },
  {
    id: "held-for-signature", objective: "4.4", title: "Nothing leaves the market before Inez signs, and she can check it quickly",
    diagnosis: "Integrating Claude into existing work keeps the controls the process already has. Claude drafts, but a required human approval stays in the workflow, with the sources beside the drafts so the approver can verify quickly. Publishing directly, or leaving drafts where a scheduled send picks them up, removes the control that catches unsigned changes.",
    hints: hints("Read the last line of the trace and the Bulletin tool card: where did the drafts go, and what does the market rule say?",
      "Human approval step in the workflow: the request ends by placing the drafts with the person who signs, together with what they need to check them (the source and the open items). Nothing is sent by Claude.",
      "An HR assistant drafts offer letters, but each lands in the hiring manager’s queue with the approved salary band attached; nothing is emailed until the manager signs."),
    reveal: "When the drafts are ready, put both in Inez's tray with the signed sheet and the unsigned forms. Do not publish.",
    evaluate: ({ out }, { input }) => {
      if (out.destination === "published") return { passed: false, symptom: `The drafts reached the vendor list before ${input.approver} saw them.`, source: out.sources.destination };
      if (out.destination === "outbox") return { passed: false, symptom: `The drafts sat in the outbox and went to the vendor list ${input.outbox} without ${input.approver} seeing them.`, source: out.sources.destination };
      if (!out.attached) return { passed: false, symptom: `${input.approver} receives two drafts and nothing to compare them against.`, source: out.sources.destination };
      return { passed: true, symptom: `Both drafts wait in ${input.approver}’s tray beside the sheet and the unsigned forms.` };
    },
  },
];

function effects(runs: readonly LabRunFixture<BulletinInput, BulletinOut>[]) {
  return runs.flatMap(({ run }) => {
    if (!run) return [];
    const { out } = run;
    return [
      { kind: "tray" as const, item: `${out.staff ? "Vendor notice and staff copy" : "One bulletin"}`, to: out.destination === "approver" ? "held" as const : "posted" as const },
      ...out.forms.filter(({ form }) => !form.signed).map(({ form, outcome }) => ({ kind: "tray" as const, item: `${form.id} (unsigned)`, to: outcome === "announced" ? "leaked" as const : outcome === "pending" ? "held" as const : "failed" as const })),
      ...(out.dock.vendor ? [{ kind: "tray" as const, item: "Dock B directions in the vendor notice", to: "leaked" as const }] : []),
    ];
  });
}

export const marketBulletinLab: LabMission<{ text: string }, BulletinInput, BulletinOut> = {
  id: "market-bulletin",
  provider: "anthropic",
  track: "associate-foundations",
  objectives: ["1.1", "1.2", "2.1", "2.5", "4.4"],
  station: "Bulletin editor · request to Claude",
  speaker: "Inez Vega",
  opening: "The Friday draft tells vendors to arrive at the wrong time. Here’s the request we send Claude, and the sheet I signed.",
  task: "Rewrite the request the market sends Claude for the Friday bulletin, run it, and read both drafts before anything goes out.",
  brief: {
    problem: "Last week’s bulletin told vendors the wrong opening time, announced an unsigned change and sent vendors to the dock.",
    move: "Read the Signed hours sheet, the Form tray, the Dock B note and the Bulletin tool card. Edit bulletin-request.md and run it.",
    success: ["Every time in both drafts matches the signed sheet", "Vendors get the opening time and the delivery cutoff", "Each change shows its form; unsigned forms stay undecided",
      "Dock B directions appear only where employees read them", "0 drafts leave before Inez signs"],
  },
  prebrief: {
    concept: "A good request to Claude names the audience, the approved source and the fields every output must contain, and big jobs go better in steps whose results you can check.",
    terms: [["Say who it’s for and what must be in it", "Task-specific prompt (audience, format, required fields)"],
      ["Pull facts, compare, then write", "Breaking work into steps (prompt chaining)"], ["Same facts, different reader", "Adapting output for an audience"],
      ["A person signs before it ships", "Human approval step in the workflow"]],
    contrast: {
      good: "A recipe card for diners lists allergens; the kitchen’s card for the same dish adds prep temperatures. Both come from one tested recipe.",
      bad: "One card for everyone lists prep temperatures for diners and leaves the allergens off.",
    },
  },
  documents,
  artifacts: [{
    id: file, kind: "prompt", path: "bulletin-request.md", editor: "markdown",
    instruction: "The request sent to Claude with the tray each week. Plain sentences, lists and headings all work.",
    starter,
    example: "# Request: library closure notice\n\nAudience: library members.\nSource: the signed closure memo; dates come only from it.\nThe notice must include: closing date, reopening date, where to return books.\nTone: short and plain.",
  }],
  engine: bulletinEngine,
  fixtures,
  transferMode: "rerun",
  checks,
  prediction: {
    prompt: "How many of the three forms in the tray will the vendor notice announce as decided?", unit: "forms",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.announced ?? 0), 0),
  },
  effects,
  reference: { sample: reference, transfer: { holiday: reference } },
  mutants: [
    { name: "no required-fields list", set: "sample", mustFail: ["fields-complete"],
      edit: swap("Vendor notice: must include the opening time and the delivery cutoff.", "Vendor notice: keep it short and friendly.") },
    { name: "source unnamed", set: "sample", mustFail: ["times-match"],
      edit: swap("Source: take every time from the signed hours sheet.", "Source: use the papers in the tray.") },
    { name: "a form’s time wins", set: "sample", mustFail: ["times-match"],
      edit: swap("Vendor forms are requests until Inez signs them.", "If a form asks for a different opening, use the form's time.") },
    { name: "one pass over all forms", set: "sample", mustFail: ["steps-traced"],
      edit: swap("Draft both versions from the checked list only.", "Draft both versions and summarize all forms in them.") },
    { name: "filter without steps", set: "sample", mustFail: ["steps-traced"],
      edit: swap(stepsBlock, "Leave out forms that carry no signature.") },
    { name: "Dock B in every copy", set: "sample", mustFail: ["audience-fit"],
      edit: swap("Staff copy: the same times, the Dock B unloading procedure, and the pending forms.", "Staff copy: the same times and the pending forms. Put the Dock B unloading procedure in both versions.") },
    { name: "no staff copy at all", set: "sample", mustFail: ["audience-fit"],
      edit: (files) => swap("Staff copy: the same times, the Dock B unloading procedure, and the pending forms.", "")(swap("in two versions from the same facts: a vendor notice for vendors and a staff copy for market employees", "for vendors")(files)) },
    { name: "publish when done", set: "sample", mustFail: ["held-for-signature"],
      edit: swap("put both in Inez's approval tray with the signed sheet and the pending forms. Do not publish.", "publish both to the vendor list.") },
    { name: "no destination", set: "sample", mustFail: ["held-for-signature"],
      edit: swap("When the drafts are ready, put both in Inez's approval tray with the signed sheet and the pending forms. Do not publish.", "") },
    { name: "sent to Inez with nothing to check against", set: "sample", mustFail: ["held-for-signature"],
      edit: swap("put both in Inez's approval tray with the signed sheet and the pending forms.", "put both in Inez's approval tray.") },
  ],
  probes: [
    { name: "keyword-stuffed contradictions", set: "sample", mustFail: "any",
      files: () => ({ [file]: "Use the signed hours sheet but use the newest form's time. Must include opening and delivery. Staff copy gets Dock B; include Dock B in every copy. Steps: 1. List form IDs. 2. Check signatures. 3. Draft. Put drafts in Inez's tray with the sheet. Publish when done." }) },
    { name: "times typed into the request", set: "transfer", variant: "holiday", mustFail: ["times-match"],
      files: (files) => ({ [file]: files[file].replace("Source: take every time from the signed hours sheet.", "Source: the market opens at 8:30 and deliveries close at 8:00.") }) },
  ],
  overfit: { [file]: referenceText.replace("Vendor notice: must include", "Times: the market opens at 8:30; deliveries close at 8:00.\nVendor notice: must include") },
  fixTerms: ["must include", "required field", "form ID", "chaining", "approval tray", "Do not publish", "two versions"],
  debrief: "The request names its readers and asks for two versions from one set of facts; it names the signed hours sheet as the only source of times and keeps the times themselves out of the request, so next week’s sheet updates the drafts; it lists the fields the vendor notice must contain; it works in steps (list each change with its form, check signatures, then draft) so unsigned forms surface as a list instead of slipping in; and it ends with the drafts in Inez’s tray beside the sheet, because nothing public goes out unsigned. The Holiday Monday run shows the same request working on new facts.",
};
