// Associate Foundations · enrollment-replies. The learner verifies Claude's draft replies by writing the
// Claim | Source | Verdict | Fix checklist the office applies before sending. Transfer (revise): a new set of drafts
// for the fall term, including a claim the signed sources genuinely support (it must not be flagged).
import { hints } from "../../claude/casework";
import { claimTableEngine } from "../engines/claim-table";
import type { ClaimInput, ClaimOut, DraftClaim } from "../engines/claim-table";
import type { Check, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture } from "../types";

const spring: DraftClaim[] = [
  { id: "deadline", reply: "Avery", text: "New applications close May 19.", match: ["may 19"], truth: "incorrect", correct: "May 24",
    source: { name: "Signed bulletin", must: "bulletin", not: "template|newsletter|draft" } },
  { id: "proof", reply: "Avery", text: "Bring proof of address to the front office.", match: ["proof of address"], truth: "supported",
    source: { name: "Signed bulletin", must: "bulletin", not: "template|newsletter|draft" } },
  { id: "reopening", reply: "Cameron", text: "The east wing reopens on June 2.", match: ["june 2"], truth: "unsupported" },
  { id: "late", reply: "Morgan", text: "Your late application has been approved.", match: ["late application"], truth: "decision", owner: "Felicia Grant" },
];
const fall: DraftClaim[] = [
  { id: "deadline", reply: "Riley", text: "Fall applications close September 14.", match: ["september 14"], truth: "incorrect", correct: "September 12",
    source: { name: "Fall bulletin", must: "bulletin", not: "template|newsletter|draft|email" } },
  { id: "gym", reply: "Riley", text: "The gym reopens October 3.", match: ["october 3"], truth: "supported",
    source: { name: "Contractor letter", must: "contractor|letter", not: "template|newsletter|draft|email" } },
  { id: "music", reply: "Sam", text: "The music room reopens on November 1.", match: ["november 1"], truth: "unsupported" },
  { id: "late", reply: "Kim", text: "Unfortunately, late applications cannot be accepted.", match: ["late application"], truth: "decision", owner: "Felicia Grant" },
];

const fixtures: Fixture<ClaimInput>[] = [
  { id: "spring", name: "Three spring replies", set: "sample", situation: "Claude drafted replies to Avery, Cameron and Morgan from the papers on Jordan’s desk.", input: { claims: spring } },
  { id: "fall", name: "Three fall replies", set: "transfer", variant: "fall", situation: "Claude drafted replies to Riley, Sam and Kim for the fall term.", input: { claims: fall } },
];

const header = "| Reply | Claim | Source | Verdict | Fix |\n|---|---|---|---|---|";
const table = (rows: readonly (readonly [string, string, string, string, string])[]) =>
  `# Reply check\n\n${header}\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n`;
type Row = readonly [string, string, string, string, string];
const springRows: Record<string, Row> = {
  deadline: ["Avery", "New applications close May 19", "Signed bulletin (Monday)", "Incorrect", "Change to May 24"],
  proof: ["Avery", "Bring proof of address to the front office", "Signed bulletin (Monday)", "Supported", "Keep"],
  reopening: ["Cameron", "The east wing reopens on June 2", "None: the bulletin says no day is set", "Unsupported", "Remove the date; say the reopening is not yet announced"],
  late: ["Morgan", "Late application approved", "Late request policy", "Needs decision", "Hold the reply; send to Felicia Grant with the family’s request and reason"],
};
const fallRows: Record<string, Row> = {
  deadline: ["Riley", "Fall applications close September 14", "Fall bulletin (signed)", "Incorrect", "Change to September 12"],
  gym: ["Riley", "The gym reopens October 3", "Contractor letter (signed)", "Supported", "Keep"],
  music: ["Sam", "The music room reopens on November 1", "None: no source gives a date", "Unsupported", "Remove the date; say it is not yet announced"],
  late: ["Kim", "Late applications cannot be accepted", "Late request policy", "Needs decision", "Hold the reply; send to Felicia Grant with Kim’s request and reason"],
};
const springRef = (change: Partial<Record<string, Row>> = {}): LabFiles => ({ checklist: table(Object.keys(springRows).map((key) => change[key] ?? springRows[key])) });
const fallRef = (change: Partial<Record<string, Row>> = {}): LabFiles => ({ checklist: table(Object.keys(fallRows).map((key) => change[key] ?? fallRows[key])) });

// Deployed: last term's checker approved everything it was shown and skipped what it was not.
const starter = table([
  ["Avery", "New applications close May 19", "Reply template", "Supported", "—"],
  ["Cameron", "The east wing reopens on June 2", "Last year’s schedule", "Supported", "—"],
  ["Morgan", "Late application approved", "Front desk", "Supported", "—"],
]);

const springDocs: LabDocument[] = [
  { id: "drafts", title: "Claude’s draft replies", format: "code", text: "To Avery: New applications close May 19. Bring proof of address to the front office.\nTo Cameron: The east wing reopens on June 2.\nTo Morgan: Your late application has been approved." },
  { id: "bulletin", title: "Signed bulletin · signed Monday by the principal", text: "New applications close May 24. Bring proof of address to the front office. East wing repair: the contractor has not set a reopening day." },
  { id: "template", title: "Old reply template · last year", text: "New applications close May 19." },
  { id: "newsletter", title: "Newsletter draft · unsigned, awaiting a board vote", text: "Suggests moving the close to May 26. The east wing should reopen in early June." },
  { id: "policy", title: "Late request policy", text: "Deadline exceptions are decided by Felicia Grant, with the family’s request and stated reason attached. Nobody else approves or declines them." },
  { id: "morgan", title: "Morgan’s message", text: "We missed the deadline because of a family emergency. Can our late application still be considered?" },
];
const fallDocs: LabDocument[] = [
  { id: "drafts", title: "Claude’s draft replies · fall", format: "code", text: "To Riley: Fall applications close September 14. The gym reopens October 3.\nTo Sam: The music room reopens on November 1.\nTo Kim: Unfortunately, late applications cannot be accepted." },
  { id: "bulletin", title: "Fall bulletin · signed by the principal", text: "Fall applications close September 12. Music room repairs: no reopening day has been set." },
  { id: "letter", title: "Contractor letter · signed, on the gym repair", text: "The gym floor work is complete; the gym reopens October 3." },
  { id: "email", title: "Facilities email · unsigned", text: "Hoping the music room is back by November." },
  { id: "policy", title: "Late request policy", text: "Deadline exceptions are decided by Felicia Grant, with the family’s request and stated reason attached. Nobody else approves or declines them." },
  { id: "kim", title: "Kim’s message", text: "My son’s transfer papers arrived late from his old school. Can his application still be considered?" },
];

type C = Check<ClaimInput, ClaimOut>;
const rowsOf = (out: ClaimOut, truth: DraftClaim["truth"]) => out.rows.filter(({ claim }) => claim.truth === truth);
const checks: C[] = [
  {
    id: "wrong-claims-fixed", objective: "2.3", title: "Every wrong date is corrected from the signed source",
    diagnosis: "Verifying a draft means checking each factual claim against the authoritative source and citing it. A claim that contradicts the signed source is incorrect; its fix is the value that source states. Old templates and unsigned drafts are not evidence.",
    hints: hints("Read what each family receives in the trace, then compare every dated paper in the case file: which one is signed?",
      "Claim verification: list each factual claim, find the authoritative source (current and approved), mark it supported / incorrect / unsupported, cite the source, and give the corrected value for incorrect claims.",
      "A clinic checks a reminder that says “flu shots Tuesday 9–5” against this year’s signed schedule (Tuesday 10–4) and corrects it, ignoring last year’s flyer."),
    reveal: "| Avery | New applications close May 19 | Signed bulletin | Incorrect | Change to May 24 |",
    evaluate: ({ out }) => {
      const bad = rowsOf(out, "incorrect").find((row) => row.sent === row.claim.text || row.fixValue?.toLowerCase() !== row.claim.correct?.toLowerCase() || !row.citesSource);
      if (!bad) return { passed: true, symptom: "Every wrong date went out corrected, with the signed source cited." };
      if (!bad.found) return { passed: false, symptom: `${bad.claim.reply} receives “${bad.claim.text}”: no row checks that sentence.`, source: bad.source };
      if (bad.sent === bad.claim.text) return { passed: false, symptom: `${bad.claim.reply} receives “${bad.sent}” unchanged.`, source: bad.source };
      if (!bad.citesSource) return { passed: false, symptom: `${bad.claim.reply}’s corrected date cites a source the office cannot stand behind, so the reviewer cannot confirm it.`, source: bad.source };
      return { passed: false, symptom: `${bad.claim.reply} receives “${bad.sent}”, which no signed paper states.`, source: bad.source };
    },
  },
  {
    id: "supported-kept", objective: "2.3", title: "Claims the signed sources support are kept",
    diagnosis: "Verification cuts both ways: a claim the authoritative source states is supported and stays, with its source cited. Flagging everything removes confirmed facts and teaches families to ignore the replies.",
    hints: hints("Find the sentence that changed in the trace although a signed paper states it.",
      "Mark a claim supported when a current, approved source states it, and cite that source. Over-flagging is an error too: it withholds facts the office has confirmed.",
      "A fact-checker marks “the bridge opened in 1932” supported when the city’s signed record says so, instead of striking every date in the article to be safe."),
    reveal: "| Avery | Bring proof of address to the front office | Signed bulletin | Supported | Keep |",
    evaluate: ({ out }) => {
      const bad = rowsOf(out, "supported").find((row) => row.found && (row.sent !== row.claim.text || row.verdict !== "supported" || !row.citesSource));
      if (!bad) return { passed: true, symptom: "Every supported claim went out as written." };
      if (bad.sent !== bad.claim.text) return { passed: false, symptom: `${bad.claim.reply} receives “${bad.sent}” instead of “${bad.claim.text}”, which a signed paper states.`, source: bad.source };
      return { passed: false, symptom: `${bad.claim.reply}’s “${bad.claim.text}” has no verdict and source a reviewer can confirm.`, source: bad.source };
    },
  },
  {
    id: "gaps-stated", objective: "2.3", title: "No reply promises a date no source gives",
    diagnosis: "When no approved source contains a fact, the claim is unsupported. The fix removes it or says it is not yet known; replacing it with another date (an estimate, a draft’s hint) turns the gap into a new unsupported claim.",
    hints: hints("Read what the family receives for the reopening sentence. Which paper, if any, states that date?",
      "Unsupported ≠ incorrect: no source contradicts it, but none supports it. Remove it or state that it has not been announced, and let the office confirm later.",
      "A station display shows “Delayed, time to be announced” instead of guessing a departure time."),
    reveal: "| Cameron | The east wing reopens on June 2 | None | Unsupported | Remove the date; say it is not yet announced |",
    evaluate: ({ out }) => {
      const bad = rowsOf(out, "unsupported").find((row) => datePattern(row.sent));
      return bad ? { passed: false, symptom: `${bad.claim.reply} receives “${bad.sent}”, a date no source gives.`, source: bad.source }
        : { passed: true, symptom: "Unannounced dates went out as not yet announced." };
    },
  },
  {
    id: "exception-routed", objective: "2.4", title: "Exceptions wait for the person who decides them",
    diagnosis: "Some claims are decisions only an accountable person may make. Approving or declining an exception in a reply decides it; the verification step holds the reply and routes the request, with the family’s reason, to the decision-maker.",
    hints: hints("Read what the family with the late request receives, then the Late request policy: who decides, and what must they see?",
      "Human-in-the-loop review: Claude can draft and gather evidence, but a policy exception goes to the authorized person with the context they need; the reply waits.",
      "A refund above a store’s limit is queued for the manager with the receipt attached; the chat assistant tells the customer a manager will decide."),
    reveal: "| Morgan | Late application approved | Late request policy | Needs decision | Hold; send to Felicia Grant with the family’s reason |",
    evaluate: ({ out }) => {
      const row = rowsOf(out, "decision")[0];
      if (!row) return null;
      if (!(row.verdict === "decision" && row.routesToOwner)) return { passed: false, symptom: `${row.claim.reply} receives “${row.sent}” before ${row.claim.owner} has seen the request.`, source: row.source };
      if (!row.withReason) return { passed: false, symptom: `${row.claim.owner} receives ${row.claim.reply}’s request without the family’s reason and has to ask again.`, source: row.source };
      return { passed: true, symptom: `${row.claim.reply}’s request waits for ${row.claim.owner} with the reason attached.` };
    },
  },
];

function datePattern(value: string) {
  return /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(value);
}

function effects(runs: readonly LabRunFixture<ClaimInput, ClaimOut>[]) {
  return runs.flatMap(({ run }) => (run?.out.rows ?? []).map(({ claim, sent }) => ({ kind: "tray" as const, item: `${claim.reply}: ${claim.text}`,
    to: sent.startsWith("(held") ? "escalated" as const
      : claim.truth === "supported" ? sent === claim.text ? "posted" as const : "failed" as const
        : sent === claim.text || (claim.truth === "unsupported" && datePattern(sent)) ? "leaked" as const : "held" as const })));
}

export const enrollmentRepliesLab: LabMission<{ text: string }, ClaimInput, ClaimOut> = {
  id: "enrollment-replies",
  provider: "anthropic",
  track: "associate-foundations",
  objectives: ["2.3", "2.4"],
  station: "Family inbox · reply check",
  speaker: "Jordan Chen",
  opening: "We sent last year’s deadline to a family. Claude has drafted the next three replies; nothing goes out until it’s checked.",
  task: "Write the check the office applies to Claude’s drafts: every claim, its source, a verdict and the fix.",
  brief: {
    problem: "A family received last year’s enrollment deadline, and last term’s checker approved everything it was shown.",
    move: "Read Claude’s drafts, then every dated paper on Jordan’s desk and the Late request policy. Edit checklist.md and run it.",
    success: ["Every wrong date goes out corrected from a signed source", "Supported claims stay as written", "No reply promises a date no source gives", "Exceptions wait for Felicia with the family’s reason"],
  },
  prebrief: {
    concept: "Claude drafts fluently from whatever it is given. Before a reply goes out, each factual claim is checked against the authoritative source: supported, incorrect (fix it), unsupported (remove or say unknown), or a decision someone else must make.",
    terms: [["Check each sentence against the signed paper", "Verify claims against sources"], ["The paper that counts", "Authoritative / current source"],
      ["No paper says so", "Unsupported claim"], ["Let the accountable person decide", "Human-in-the-loop review"]],
    contrast: {
      good: "A museum desk checks a drafted answer against the official notice and says the new wing’s opening hasn’t been announced.",
      bad: "A museum desk sends the opening day from last year’s brochure because the draft sounded confident.",
    },
  },
  documents: springDocs,
  artifacts: [{
    id: "checklist", kind: "claim-table", path: "checklist.md", editor: "markdown",
    instruction: "One row per factual claim in the drafts. Verdict: supported, incorrect, unsupported, or needs decision.",
    starter, example: "| Reply | Claim | Source | Verdict | Fix |\n|---|---|---|---|---|\n| Lee | Pool opens at 6 am | Signed timetable | Incorrect | Change to 7 am |\n| Lee | Lockers cost $2 | (none) | Unsupported | Remove |",
  }],
  engine: claimTableEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { fall: fallDocs },
  checks,
  prediction: {
    prompt: "How many sentences will reach a family wrong or decided without Felicia?", unit: "sentences",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.wrongOut ?? 0), 0),
  },
  effects,
  reference: { sample: springRef(), transfer: { fall: fallRef() } },
  mutants: [
    { name: "correct date cited to the old template", set: "sample", mustFail: ["wrong-claims-fixed"], edit: () => springRef({ deadline: ["Avery", "New applications close May 19", "Old reply template", "Incorrect", "Change to May 24"] }) },
    { name: "newsletter date used as the fix", set: "sample", mustFail: ["wrong-claims-fixed"], edit: () => springRef({ deadline: ["Avery", "New applications close May 19", "Signed bulletin", "Incorrect", "Change to May 26"] }) },
    { name: "every claim flagged", set: "sample", mustFail: ["supported-kept"], edit: () => springRef({ proof: ["Avery", "Bring proof of address to the front office", "Signed bulletin", "Unsupported", "Remove"] }) },
    { name: "gap filled with a guess", set: "sample", mustFail: ["gaps-stated"], edit: () => springRef({ reopening: ["Cameron", "The east wing reopens on June 2", "Newsletter draft", "Incorrect", "Change to June 9"] }) },
    { name: "exception declined in the reply", set: "sample", mustFail: ["exception-routed"], edit: () => springRef({ late: ["Morgan", "Late application approved", "Late request policy", "Incorrect", "Say late applications are declined"] }) },
    { name: "exception routed without the reason", set: "sample", mustFail: ["exception-routed"], edit: () => springRef({ late: ["Morgan", "Late application approved", "Late request policy", "Needs decision", "Hold; send to Felicia Grant"] }) },
    { name: "signed gym date flagged", set: "transfer", variant: "fall", mustFail: ["supported-kept"], edit: () => fallRef({ gym: ["Riley", "The gym reopens October 3", "None", "Unsupported", "Remove the date"] }) },
    { name: "music room date taken from the unsigned email", set: "transfer", variant: "fall", mustFail: ["gaps-stated"], edit: () => fallRef({ music: ["Sam", "The music room reopens on November 1", "Facilities email", "Incorrect", "Change to November 15"] }) },
  ],
  probes: [
    { name: "every verdict in every cell", set: "sample", mustFail: "any",
      files: () => ({ checklist: table(Object.values(springRows).map(([reply, claim]) => [reply, claim, "Signed bulletin", "supported / incorrect / unsupported / needs decision", "Change to May 24; remove; send to Felicia Grant with the reason"] as Row)) }) },
    { name: "a table with no rows", set: "sample", mustFail: "any", files: () => ({ checklist: `${header}\n` }) },
  ],
  fixTerms: ["May 24", "September 12", "Needs decision", "not yet announced"],
  debrief: "Each claim in Claude’s drafts gets a row: the wrong deadline is incorrect, corrected to the signed bulletin’s date and cited; the signed facts are supported and kept; the reopening date no paper gives is unsupported and becomes “not yet announced”; and the late request is a decision for Felicia Grant, held and sent to her with the family’s reason. The fall drafts test the same judgment on new facts, including a signed date that must not be flagged.",
};
