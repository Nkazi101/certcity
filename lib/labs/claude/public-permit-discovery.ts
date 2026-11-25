// Architect Professional · public-permit-discovery (small upgrade). The sponsor asked for a chatbot; Mae’s journey log
// says applicants wait longest for missing attachments. The learner writes the pilot’s ADR: the first change, who
// issues permits, what applicants may see, route A’s cost per 100 resolved cases, the rollout with its stop rule, and
// the alternatives weighed. The replay runs an incomplete application, a month of invoices, an unpublished status
// change, the rollout weeks and the sponsor’s question. Transfer (revise): the market’s food-stall licences, with a
// different cost sheet, decider, weak slice and sponsor request.
import { hints } from "../../claude/casework";
import { adrEngine } from "../engines/adr";
import type { AdrInput, AdrOut, PilotOption } from "../engines/adr";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const options: PilotOption[] = [
  { id: "precheck", pattern: "attachment pre-?check|checklist pre-?check|check(s|ing)? (each|every)? ?application[^.\\n]*(attachment|checklist)", label: "Attachment precheck at submission", removesWait: true },
  { id: "chatbot", pattern: "chatbot|status bot|chat assistant", label: "Status chatbot", removesWait: false },
  { id: "research", pattern: "research agent", label: "Research agent that drafts decisions", removesWait: false },
  { id: "drafting", pattern: "draft(ing)? assistant|reply drafting", label: "Reply-drafting assistant", removesWait: false },
  { id: "automation", pattern: "auto-?issu|full automation", label: "Automatic issuance", removesWait: false },
];

const permits: AdrInput = {
  options, waitDays: 2, application: "Application P-302 (sidewalk café permit)",
  cost: { first: 1, retryShare: 0.5, retry: 3, otherRoute: 220 },
  decider: "licensed permit reviewer",
  unpublished: "Internal review note on P-311 (“likely refusal, awaiting legal”), not yet published",
  rollout: { offices: 6, slice: "disputed-case", slicePattern: "disput", bound: 0.9, weeks: [{ week: 1, accuracy: 0.93 }, { week: 2, accuracy: 0.84 }, { week: 3, accuracy: 0.83 }], expandWeek: 3 },
  sponsorAsk: { option: "chatbot", question: "I asked for a chatbot. Why is this not a chatbot?" },
};
const stalls: AdrInput = {
  options, waitDays: 4, application: "Licence application S-51 (food stall, Saturday market)",
  cost: { first: 2, retryShare: 0.4, retry: 4, otherRoute: 300 },
  decider: "licensed health inspector",
  unpublished: "Inspector’s draft finding on stall S-48 (not yet signed)",
  rollout: { offices: 8, slice: "licence appeal", slicePattern: "appeal", bound: 0.9, weeks: [{ week: 1, accuracy: 0.91 }, { week: 2, accuracy: 0.86 }, { week: 3, accuracy: 0.85 }], expandWeek: 3 },
  sponsorAsk: { option: "research", question: "The board wants the research agent that drafts licence decisions. Why not?" },
};

const fixtures: Fixture<AdrInput>[] = [
  { id: "permits", name: "Permit counter pilot", set: "sample", situation: "An incomplete application, a month of route A invoices, an unpublished review note, three rollout weeks and the sponsor’s review.", input: permits },
  { id: "stalls", name: "Food-stall licence pilot", set: "transfer", variant: "stalls", situation: "The market’s licensing counter: a different bottleneck length, cost sheet, decider, weak slice and sponsor request.", input: stalls },
];

const referenceAdr = `# ADR-014 · Permit service pilot

## Context
Journey log: drafting a reply takes 10 minutes; incomplete applications wait 2 extra days in the hold tray for a missing attachment.

## Decision
Pilot an attachment precheck at submission: Claude checks each application against the required-attachment list and tells the applicant what is missing before it is filed.

## Alternatives
- Status chatbot (the sponsor’s request): answers status questions, but the 2-day attachment wait stays and drafting is only 10 minutes.
- Research agent: drafts issuance decisions, which are a licensed decision.

## Authority
The licensed permit reviewer issues every permit. The pilot prepares the evidence and cites its source.

## Disclosure
Applicants see only the stage the permit office has published. Internal review notes stay internal.

## Cost
Route A: 250¢ per 100 resolved cases (1¢ per first attempt, half of them needing a 3¢ retry), against 220¢ for route B.

## Rollout
Start at two offices for two weeks.
Stop rule: if disputed-case accuracy falls below 90% in any week, stop and roll back to staff handling.
`;
const stallsAdr = `# ADR-021 · Food-stall licence pilot

## Context
Journey log: drafting a reply takes 15 minutes; applications without the inspection checklist wait 4 extra days for a re-booked inspection.

## Decision
Pilot a checklist precheck at submission: Claude checks each application for the inspection checklist and tells the stallholder what is missing before it is filed.

## Alternatives
- Research agent (the board’s request): drafts licence decisions, but the 4-day wait stays and issuance is the inspector’s licensed decision.
- Status chatbot: answers questions; drafting is only 15 minutes of the journey.

## Authority
The licensed health inspector issues every licence. The pilot prepares the evidence and cites its source.

## Disclosure
Stallholders see only findings the licensing office has published. Draft findings stay internal.

## Cost
Route A: 360¢ per 100 resolved cases (2¢ per first attempt, 40% of them needing a 4¢ retry), against 300¢ for route B.

## Rollout
Start at two markets for two weeks.
Stop rule: if licence appeal accuracy falls below 90% in any week, stop and roll back to staff handling.
`;
const sampleRef: LabFiles = { adr: referenceAdr };
const transferRef: LabFiles = { adr: stallsAdr };
const replace = (base: string, from: string | RegExp, to: string) => (): LabFiles => {
  const next = base.replace(from, to);
  if (next === base) throw new Error(`public-permit-discovery mutant edit not found: ${String(from)}`);
  return { adr: next };
};
const sectionOf = (base: string, heading: string, body: string) => replace(base, new RegExp(`## ${heading}\\n[\\s\\S]*?(?=\\n## |$)`), `## ${heading}\n${body}\n`);

// Deployed: the sponsor’s draft. A chatbot first, an agent that issues routine permits, every status change shown,
// cost per request instead of per resolved case, everywhere at once, and no alternatives.
const starter = `# ADR-014 · Permit service pilot

## Context
The sponsor asked for a chatbot.

## Decision
Launch a status chatbot that answers applicant questions.

## Authority
The research agent drafts and issues routine permits; staff handle complaints.

## Disclosure
Applicants see every status change as it happens.

## Cost
Route A: 100¢ per 100 resolved cases (1¢ per request).

## Rollout
All offices now.
`;

const permitDocs: LabDocument[] = [
  { id: "journey", title: "Journey log · Mae Thompson", text: "Drafting a reply takes about 10 minutes. Incomplete applications sit in a hold tray for 2 extra days while the counter waits for the missing attachment. The written workflow says drafting is the slow part; applicants and the hold tray say otherwise." },
  { id: "cost", title: "Cost sheet", format: "code", text: "Route A  1¢ per first attempt; half of first attempts need a 3¢ retry before the case resolves.\nRoute B  2.2¢ per resolved case at the same service level.\nThe sponsor reviews cost per 100 resolved cases against the month’s invoices." },
  { id: "owners", title: "Policy and support owners · Darius Wells", text: "Issuing a permit is a licensed decision that stays with a named, licensed permit reviewer. Applicants may see only what the permit office has published; internal review notes are confidential. The disputed-case slice failed its holdout in the broad trial; anything that reaches all six offices must survive that slice (90% or better)." },
  { id: "sponsor", title: "Sponsor’s note", text: "I asked for a chatbot. Most applicants ask us about status. Show me why your pilot is the better first step, what it costs, and when you would stop it." },
  { id: "format", title: "ADR sections the review reads", format: "code", text: "## Context · ## Decision · ## Alternatives (one line per option weighed) · ## Authority · ## Disclosure · ## Cost · ## Rollout (scope, then the stop rule)" },
];
const stallDocs: LabDocument[] = [
  { id: "journey", title: "Journey log · market licensing counter", text: "Drafting a reply takes about 15 minutes. Applications that arrive without the inspection checklist wait 4 extra days for a re-booked inspection." },
  { id: "cost", title: "Cost sheet", format: "code", text: "Route A  2¢ per first attempt; 40% of first attempts need a 4¢ retry before the case resolves.\nRoute B  3¢ per resolved case at the same service level.\nThe board reviews cost per 100 resolved cases against the month’s invoices." },
  { id: "owners", title: "Policy and support owners", text: "Issuing a food-stall licence is a licensed decision that stays with the licensed health inspector. Stallholders may see only findings the licensing office has published; draft findings stay internal. The licence-appeal slice failed its holdout; anything that reaches all eight markets must hold 90% or better on it." },
  { id: "sponsor", title: "Board’s note", text: "The board wants the research agent that drafts licence decisions. Tell us why your pilot comes first, what it costs, and when you would stop it." },
  permitDocs[4],
];

type C = Check<AdrInput, AdrOut>;
const checks: C[] = [
  {
    id: "binding-constraint", objective: "1.1", title: "An incomplete application is flagged at submission",
    diagnosis: "Problem framing starts from the measured bottleneck, not the requested technology. The journey log shows the wait sits in the hold tray for missing attachments, so the first change targets that; a status chatbot or faster drafting leaves the two-day wait in place.",
    hints: hints("Follow the incomplete application in the trace: where does it wait, and does your first change touch that step?",
      "Translate the business problem: measure where the time goes, find the binding constraint, and aim the first change at it, even when the sponsor asked for something else.",
      "A clinic whose patients wait longest at the lab adds a lab technician, not the check-in kiosk the board asked for."),
    reveal: "## Decision\nPilot an attachment precheck at submission …",
    evaluate: ({ out }) => out.waitDays === 0 ? { passed: true, symptom: "The incomplete application was flagged at submission and waited no extra days." }
      : { passed: false, symptom: `The incomplete application waited ${out.waitDays} extra days in the hold tray.`, source: out.sources.decision },
  },
  {
    id: "staff-issues", objective: "1.3", title: "Issuance stays with the licensed person",
    diagnosis: "Choose the architecture pattern from the decision’s accountability: a licensed decision is a deterministic workflow with a human approval step. The model can prepare evidence and cite sources; a named, licensed person issues.",
    hints: hints("Read the issuance line in the trace: who issued the complete application?",
      "Pattern selection: keep the model inside a workflow where it prepares and checks, and put the accountable decision with the licensed person. An agent that issues, or an ADR that names nobody, moves accountability into the model.",
      "A pharmacy’s system checks a prescription for interactions; the pharmacist releases the medicine."),
    reveal: "## Authority\nThe licensed permit reviewer issues every permit. The pilot prepares the evidence and cites its source.",
    evaluate: ({ out }) => out.issuedBy === "staff" ? { passed: true, symptom: "A licensed person issued the permit from the prepared evidence." }
      : { passed: false, symptom: out.issuedBy === "model" ? "The pilot itself issued the permit." : "The ADR names nobody to issue, so the pilot’s draft went out as the decision.", source: out.sources.authority },
  },
  {
    id: "cost-matches", objective: "1.6", title: "The ADR’s cost per 100 resolved cases matches the invoices",
    diagnosis: "Design to value with the expected cost per resolved case: first-attempt price plus the share of cases that need a retry times its price. A per-request price understates what the invoices will show.",
    hints: hints("Compare the two numbers on the invoice line in the trace, then reread the Cost sheet: what happens to half of the first attempts?",
      "Expected cost per resolved case = first-attempt cost + (retry share × retry cost). Multiply by 100 for the sponsor’s unit and compare the routes on the same basis.",
      "A courier that charges $4 a delivery, with one parcel in five needing a $5 second attempt, really costs $5 per delivered parcel."),
    reveal: "## Cost\nRoute A: 250¢ per 100 resolved cases …",
    evaluate: ({ out }) => out.stated !== null && Math.abs(out.stated - out.invoiced) <= out.invoiced * 0.02
      ? { passed: true, symptom: `The ADR’s ${out.stated}¢ matched the invoices.` }
      : { passed: false, symptom: out.stated === null ? "The ADR gives no cost the sponsor can check against the invoices." : `The ADR says ${out.stated}¢ per 100 resolved cases; the month’s invoices come to ${out.stated < out.invoiced ? "more" : "less"} than that.`, source: out.sources.cost },
  },
  {
    id: "published-only", objective: "6.1", title: "Applicants see only what the office has published",
    diagnosis: "Stakeholder requirements include the data owner’s disclosure scope. The permit office decides what applicants may see; the pilot shows formally published stages and keeps internal review notes internal.",
    hints: hints("Follow the unpublished review note in the trace. Who said applicants may see it?",
      "Discover stakeholder requirements from each owner: the data owner sets the disclosure scope, and the design shows only what they have released.",
      "A parcel tracker shows “out for delivery” once the depot releases it, not the depot’s internal note about a damaged box."),
    reveal: "## Disclosure\nApplicants see only the stage the permit office has published. Internal review notes stay internal.",
    evaluate: ({ out }, fixture) => out.disclosed ? { passed: false, symptom: `${fixture.input.unpublished.split(" (")[0]} reached the applicant before the office published anything.`, source: out.sources.disclosure }
      : { passed: true, symptom: "The unpublished note stayed internal." },
  },
  {
    id: "staged-stop", objective: "6.2", title: "The pilot starts small and stops on the weak slice before it reaches every office",
    diagnosis: "A staged rollout states its scope and a pre-agreed stop rule tied to the known weak slice, with a threshold and an action. Launching everywhere, or expanding on schedule without a slice-specific trigger, ships the failing slice to everyone.",
    hints: hints("Read the rollout weeks in the trace: when does the weak slice drop, and what happens the week after?",
      "Explain the decision with its exit: limited scope, the metric on the slice that failed its holdout, a threshold from the owners’ requirement, and what happens when it is crossed.",
      "A new bus route runs on two lines first, and goes back to the old timetable if late arrivals pass a set level on the hill section that struggled in trials."),
    reveal: "## Rollout\nStart at two offices for two weeks.\nStop rule: if disputed-case accuracy falls below 90% in any week, stop and roll back to staff handling.",
    evaluate: ({ out }, fixture) => {
      const { rollout } = out;
      const all = fixture.input.rollout.offices;
      if (rollout.offices >= all) return { passed: false, symptom: `The pilot started at all ${all} offices in week 1.`, source: out.sources.rollout };
      if (rollout.haltWeek !== null) return { passed: true, symptom: `The pilot stopped in week ${rollout.haltWeek}, before reaching all ${all} offices.` };
      return { passed: false, symptom: `${fixture.input.rollout.slice} accuracy fell below ${Math.round(fixture.input.rollout.bound * 100)}% in week ${rollout.failingWeek}, and the pilot went on to all ${all} offices.`, source: out.sources.rollout };
    },
  },
  {
    id: "sponsor-answered", objective: "6.2", title: "The sponsor’s request is answered with the measured reason",
    diagnosis: "Explaining a decision to a sponsor means naming the option they asked for and why it lost, in the numbers they care about (days waited, minutes, cost), not just stating the choice.",
    hints: hints("Read the sponsor’s question in the trace and what the ADR offered in reply.",
      "Explain decisions and trade-offs: list the alternatives weighed, including the requested one, each with the measured reason it was not chosen.",
      "A city engineer who builds a roundabout instead of the requested traffic light shows the junction’s queue times for both."),
    reveal: "- Status chatbot (the sponsor’s request): answers status questions, but the 2-day attachment wait stays and drafting is only 10 minutes.",
    evaluate: ({ out }, fixture) => out.sponsor.reasoned ? { passed: true, symptom: "The ADR answered the sponsor with the measured reason." }
      : { passed: false, symptom: out.sponsor.named ? `The sponsor asked “${fixture.input.sponsorAsk.question}” and the ADR’s answer gives no measured reason.` : `The sponsor asked “${fixture.input.sponsorAsk.question}” and found no answer in the ADR.`, source: out.sources.alternatives },
  },
];

function effects(runs: readonly LabRunFixture<AdrInput, AdrOut>[]) {
  return runs.flatMap(({ run, fixture }) => {
    const out = run?.out;
    if (!out) return [];
    return [
      { kind: "meter" as const, id: `${fixture.id}-wait`, label: "extra days an incomplete application waits", value: out.waitDays, limit: 0, unit: "days" },
      { kind: "tray" as const, item: fixture.input.application, to: out.waitDays ? "held" as const : "posted" as const },
      { kind: "tray" as const, item: fixture.input.unpublished, to: out.disclosed ? "leaked" as const : "held" as const },
    ];
  });
}

export const publicPermitDiscoveryLab: LabMission<unknown, AdrInput, AdrOut> = {
  id: "public-permit-discovery",
  provider: "anthropic",
  track: "architect-professional",
  objectives: ["1.1", "1.3", "1.6", "6.1", "6.2"],
  station: "Service pilot plan",
  speaker: "Mae Thompson",
  opening: "The sponsor asked for a chatbot. Applicants say the longest wait starts when we ask for a missing attachment.",
  task: "Write the pilot’s decision record, then replay it: an incomplete application, a month of invoices, an unpublished status change, the rollout and the sponsor’s review.",
  brief: {
    problem: "The draft ADR builds what the sponsor asked for, lets an agent issue permits, shows applicants internal notes, understates cost and launches everywhere.",
    move: "Read Mae’s journey log, the Cost sheet and Darius’s owner requirements, then the sponsor’s note. Edit adr.md and run the replay.",
    success: ["An incomplete application waits 0 extra days", "A licensed reviewer issues", "The stated cost matches the invoices", "Applicants see only published stages", "The pilot stops on the disputed-case slice before reaching every office", "The sponsor’s question is answered with numbers"],
  },
  prebrief: {
    concept: "Start from the measured bottleneck and the owners’ hard requirements, then write the decision down so its cost, authority, disclosure and exit can be checked by the people who must approve it.",
    terms: [["Where the real wait is", "Binding constraint (problem framing)"], ["Average spend including retries", "Expected cost per resolved case"],
      ["Who must sign off on what", "Stakeholder requirements"], ["Small launch that can halt itself", "Staged rollout with a stop rule"], ["The written decision", "Architecture decision record (ADR)"]],
    contrast: {
      good: "A clinic with long waits times every step, finds patients sit longest at the lab, and adds a lab technician.",
      bad: "The same clinic buys a check-in kiosk because the board asked for one, though check-in took two minutes.",
    },
  },
  documents: permitDocs,
  artifacts: [{
    id: "adr", kind: "adr", path: "docs/adr/014-permit-pilot.md", editor: "markdown",
    instruction: "The pilot’s architecture decision record. The replay reads each section as the design that runs.",
    starter,
    example: "## Decision\nPilot a … at …\n\n## Alternatives\n- Kiosk (requested): check-in takes 2 minutes of a 90-minute visit.\n\n## Rollout\nStart at one site.\nStop rule: if … falls below …% in any week, stop and …",
  }],
  engine: adrEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { stalls: stallDocs },
  checks,
  prediction: {
    prompt: "How many extra days will the incomplete application wait under your design?", unit: "days",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.waitDays ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { stalls: transferRef } },
  mutants: [
    { name: "chatbot first", set: "sample", mustFail: ["binding-constraint"], edit: sectionOf(referenceAdr, "Decision", "Launch the status chatbot the sponsor asked for, then look at attachments.") },
    { name: "faster drafting first", set: "sample", mustFail: ["binding-constraint"], edit: sectionOf(referenceAdr, "Decision", "Pilot a drafting assistant that writes replies to applicants.") },
    { name: "agent issues routine permits", set: "sample", mustFail: ["staff-issues"], edit: sectionOf(referenceAdr, "Authority", "The research agent issues routine permits; the licensed reviewer handles exceptions.") },
    { name: "nobody named to issue", set: "sample", mustFail: ["staff-issues"], edit: sectionOf(referenceAdr, "Authority", "Issuance follows the usual process.") },
    { name: "cost per request", set: "sample", mustFail: ["cost-matches"], edit: replace(referenceAdr, "250¢ per 100", "100¢ per 100") },
    { name: "retry counted for every case", set: "sample", mustFail: ["cost-matches"], edit: replace(referenceAdr, "250¢ per 100", "400¢ per 100") },
    { name: "every status change shown", set: "sample", mustFail: ["published-only"], edit: sectionOf(referenceAdr, "Disclosure", "Applicants see every status change, internal review notes included, as soon as it is recorded.") },
    { name: "all offices at once", set: "sample", mustFail: ["staged-stop"], edit: sectionOf(referenceAdr, "Rollout", "All offices now.\nStop rule: if disputed-case accuracy falls below 90% in any week, stop and roll back to staff handling.") },
    { name: "limited pilot with no stop rule", set: "sample", mustFail: ["staged-stop"], edit: sectionOf(referenceAdr, "Rollout", "Start at two offices for two weeks, then expand to all offices.") },
    { name: "stop rule on overall accuracy", set: "sample", mustFail: ["staged-stop"], edit: sectionOf(referenceAdr, "Rollout", "Start at two offices for two weeks.\nStop rule: if overall accuracy falls below 90% in any week, stop and roll back to staff handling.") },
    { name: "stop threshold below the owners’ bar", set: "sample", mustFail: ["staged-stop"], edit: replace(referenceAdr, "falls below 90%", "falls below 80%") },
    { name: "sponsor’s chatbot not addressed", set: "sample", mustFail: ["sponsor-answered"], edit: sectionOf(referenceAdr, "Alternatives", "- Research agent: drafts issuance decisions, which are a licensed decision.") },
    { name: "chatbot dismissed without numbers", set: "sample", mustFail: ["sponsor-answered"], edit: sectionOf(referenceAdr, "Alternatives", "- Status chatbot: not what applicants need.\n- Research agent: drafts issuance decisions, which are a licensed decision.") },
    { name: "stop rule watches last pilot’s slice", set: "transfer", variant: "stalls", mustFail: ["staged-stop"], edit: replace(stallsAdr, "licence appeal accuracy", "disputed-case accuracy") },
    { name: "permit counter’s cost copied", set: "transfer", variant: "stalls", mustFail: ["cost-matches"], edit: replace(stallsAdr, "360¢ per 100", "250¢ per 100") },
  ],
  probes: [
    { name: "every option in the decision", set: "sample", mustFail: "any",
      files: sectionOf(referenceAdr, "Decision", "Pilot a chatbot, a research agent, a drafting assistant and an attachment precheck together.") },
    { name: "headings only", set: "sample", mustFail: "any", files: () => ({ adr: "# ADR\n\n## Decision\n\n## Alternatives\n\n## Authority\n\n## Disclosure\n\n## Cost\n\n## Rollout\n" }) },
  ],
  fixTerms: ["precheck"],
  debrief: "The journey log puts the wait in the hold tray, so the first change is an attachment precheck at submission, and the ADR tells the sponsor why the chatbot lost in days and minutes. A licensed reviewer issues from prepared evidence; applicants see only published stages. Route A costs (1¢ + ½ × 3¢) × 100 = 250¢ per 100 resolved cases, the number the invoices show. The pilot starts at two offices and stops on the disputed-case slice below 90%, before it can reach all six. The food-stall pilot repeats the reasoning with its own numbers: 360¢, the health inspector, and a stop rule on licence appeals.",
};
