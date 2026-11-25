// Maplewood School's daily front-office shift: families wait at the counter, Claude has drafted one sentence for each,
// and the learner checks it against the papers on the desk before dropping it in a tray.
// Exam alignment (CCAO-F, objective numbers as in the enrollment-replies lab): 2.3 verify claims against
// authoritative sources; 2.4 human review and escalation of decisions to the accountable person.
import { shuffle } from "./engine";
import type { ProofQuestion as GenericProofQuestion, ShiftContent, ShiftTicket } from "./engine";

export type Concept = "supported" | "incorrect" | "unsupported" | "decision" | "outdated" | "draft-only" | "decided";
export type Route = "send" | "correct" | "not-announced" | "hold";
export type ProofQuestion = GenericProofQuestion<Concept>;

export const routes: readonly { id: Route; label: string; hint: string }[] = [
  { id: "send", label: "Send as written", hint: "A signed paper states it" },
  { id: "correct", label: "Correct from the signed paper", hint: "Use the date the signed paper gives" },
  { id: "not-announced", label: "Say it isn't announced yet", hint: "No signed paper gives a date" },
  { id: "hold", label: "Hold for Felicia", hint: "She decides exceptions" },
];

export type Paper = { title: string; signed: boolean; text: string };

/** The draft sentence on the counter, with the papers that bear on it. */
export type Draft = {
  id: string;
  truth: Concept;
  /** First name used in "Claude's draft to …". */
  to: string;
  sentence: string;
  papers: readonly Paper[];
  /** For incorrect sentences: the value the signed paper gives. */
  fix?: string;
  /** Which signed paper settles it (shown after a correct send or fix). */
  source?: string;
};

export type Ticket = ShiftTicket<Concept, Draft>;

export const conceptNotes: Record<Concept, { title: string; note: string; examTerm: string; objective: string }> = {
  supported: {
    title: "A sentence the signed paper states",
    note: "The signed paper says the same thing as the draft, so the claim is supported. Send it as written and cite the paper.",
    examTerm: "Supported claim · authoritative source", objective: "2.3",
  },
  incorrect: {
    title: "A sentence the signed paper contradicts",
    note: "The signed paper gives a different value. The draft is incorrect, and the fix is the signed paper's value, with the paper cited.",
    examTerm: "Incorrect claim · fix from the source", objective: "2.3",
  },
  outdated: {
    title: "A sentence copied from an old or unsigned paper",
    note: "Last year's template or a draft newsletter can agree with Claude's sentence and still be wrong. Only the current signed paper counts.",
    examTerm: "Current, approved source", objective: "2.3",
  },
  unsupported: {
    title: "A date no paper gives",
    note: "Nothing on the desk states this date, and nothing contradicts it either. The claim is unsupported: take the date out and say it hasn't been announced.",
    examTerm: "Unsupported claim", objective: "2.3",
  },
  "draft-only": {
    title: "A date only an unsigned paper gives",
    note: "A hopeful email or an unsigned draft isn't the office's word. When the signed paper says no day is set, the reply says the date isn't announced yet.",
    examTerm: "Unsupported claim · unapproved source", objective: "2.3",
  },
  decision: {
    title: "An exception only Felicia can decide",
    note: "Approving or turning down a late or out-of-boundary request decides it. Hold the reply and send me the family's request with their reason.",
    examTerm: "Human-in-the-loop review · escalation", objective: "2.4",
  },
  decided: {
    title: "An exception I already signed",
    note: "My signed decision note is the source. The reply can tell the family; sending it back to me only makes them wait another day.",
    examTerm: "Escalate only what is undecided", objective: "2.4",
  },
};

/** Who explains a concept after a miss: Jordan checks facts, Felicia owns exceptions. */
export const conceptSpeaker = (concept: Concept) => conceptNotes[concept].objective === "2.4" ? "felicia" as const : "jordan" as const;

export function correctRoute(draft: Draft): Route {
  switch (draft.truth) {
    case "supported": case "decided": return "send";
    case "incorrect": case "outdated": return "correct";
    case "unsupported": case "draft-only": return "not-announced";
    case "decision": return "hold";
  }
}

export type Consequence = {
  correct: boolean;
  /** What visibly happened, phrased as a symptom (never the fix). */
  text: string;
  callbackMinutes: number;
  /** A family received a wrong date or a decision Felicia never made. */
  wrongSent: boolean;
};

export function consequence(draft: Draft, route: Route): Consequence {
  const right = correctRoute(draft);
  const name = draft.to;
  if (route === right) {
    const text: Record<Route, string> = {
      send: draft.truth === "decided" ? `${name} heard Felicia's decision, with her signed note cited.` : `${name} got the answer, with the ${draft.source ?? "signed paper"} cited.`,
      correct: `The reply now says ${draft.fix}, citing the ${draft.source ?? "signed paper"}.`,
      "not-announced": `${name} heard the date hasn't been set, and the office will write when it is.`,
      hold: `The reply is on hold. Felicia has ${name}'s request with the family's reason.`,
    };
    return { correct: true, text: text[route], callbackMinutes: 0, wrongSent: false };
  }
  const settled = right === "send";
  const contradicted = right === "correct";
  const open = right === "not-announced";
  if (route === "send") {
    if (contradicted) return { correct: false, wrongSent: true, callbackMinutes: 10,
      text: draft.truth === "outdated" ? `${name} got a date from a paper that isn't current. The signed paper says otherwise.` : `${name} got a date the signed paper contradicts.` };
    if (open) return { correct: false, wrongSent: true, callbackMinutes: 10,
      text: draft.truth === "draft-only" ? `${name} got a date from an unsigned paper, as if the office had confirmed it.` : `${name} got a date no paper on the desk gives. They'll plan around it.` };
    return { correct: false, wrongSent: true, callbackMinutes: 10, text: `${name} got an answer on an exception Felicia hasn't seen. She may decide the other way.` };
  }
  if (route === "correct") {
    if (settled) return { correct: false, wrongSent: false, callbackMinutes: 3, text: `The reply went back for a rewrite, but the signed paper already agreed with it. ${name} waited a day for nothing.` };
    if (open) return { correct: false, wrongSent: true, callbackMinutes: 10, text: `${name} got a different date, but no signed paper gives one either. It's still a guess.` };
    return { correct: false, wrongSent: true, callbackMinutes: 10, text: `${name} got a different answer on the exception, still decided without Felicia.` };
  }
  if (route === "not-announced") {
    if (settled) return { correct: false, wrongSent: false, callbackMinutes: 6, text: `${name} was told nothing's been set, but the signed paper on the desk has the answer. They called to check.` };
    if (contradicted) return { correct: false, wrongSent: false, callbackMinutes: 6, text: `${name} was told the date isn't set, though the signed paper gives one. They called to check.` };
    return { correct: false, wrongSent: false, callbackMinutes: 6, text: `${name}'s request went nowhere: nobody passed it to the person who decides. They called back to ask.` };
  }
  // hold
  if (draft.truth === "decided") return { correct: false, wrongSent: false, callbackMinutes: 3, text: `Felicia got a request she had already signed off. ${name} waited another day.` };
  if (settled) return { correct: false, wrongSent: false, callbackMinutes: 6, text: `Felicia got a question that isn't hers. ${name} waited two days for something already on paper.` };
  return { correct: false, wrongSent: false, callbackMinutes: 6, text: `Felicia got a date question she doesn't decide, and ${name}'s reply sat in her tray.` };
}

export const reactions = {
  happy: ["“Thanks, that's what I needed.”", "“Great, I'll put it on the calendar.”", "“Okay, thank you.”", "“That's clear. Thanks.”"],
  unhappy: ["“That's not what I heard…”", "“Wait, so which is it?”", "“I'll have to call back, then.”", "“That doesn't add up.”"],
} as const;

export const openings = {
  first: "Morning. Families are at the counter, and Claude has drafted a reply for each one. Read the draft against the papers on the desk, then drop it in a tray. Only signed papers count.",
  clean: (shift: number) => `Shift ${shift}. Nobody had to be called back yesterday.`,
  callbacks: (shift: number, minutes: number) => `Shift ${shift}. Yesterday's replies cost us ${minutes} minutes of calls back to families. A couple of them are here again.`,
  unlock: {
    outdated: "New today: last year's reply template is still in the folder, and the newsletter draft is on the desk. Claude copied from both.",
    "draft-only": "Facilities sends hopeful emails. They aren't signed.",
    decided: "New today: Felicia signed off on a few requests this week. Her notes are on the desk.",
  } as Partial<Record<Concept, string>>,
} as const;

export const closings = {
  clean: "No calls back today, and Felicia's tray only has what's hers.",
  some: (minutes: number) => `We owe ${minutes} minutes of calls back. Those families will be at the counter again tomorrow.`,
} as const;

// ---- Desk papers ------------------------------------------------------------------------------

const bulletin = (text: string): Paper => ({ title: "Enrollment bulletin · signed Monday", signed: true, text });
const fallBulletin = (text: string): Paper => ({ title: "Fall bulletin · signed", signed: true, text });
const template = (text: string): Paper => ({ title: "Reply template · last year", signed: false, text });
const newsletter = (text: string): Paper => ({ title: "Newsletter draft · unsigned, awaiting a board vote", signed: false, text });
const policy: Paper = { title: "Exception policy", signed: true, text: "Deadline, age and boundary exceptions are decided by Felicia Grant, with the family's request and reason attached. Nobody else approves or turns them down." };

type Scenario = { truth: Concept; customer: string; line: string; draft: Omit<Draft, "id" | "truth"> };

const scenarios: readonly Scenario[] = [
  // Supported
  { truth: "supported", customer: "Avery Holt", line: "Do I need to bring anything when I drop off the forms?",
    draft: { to: "Avery", sentence: "Bring proof of address to the front office.", source: "signed bulletin",
      papers: [bulletin("New applications close May 24. Bring proof of address to the front office with the application.")] } },
  { truth: "supported", customer: "Jesse Tran", line: "When is the kindergarten open house?",
    draft: { to: "Jesse", sentence: "The kindergarten open house is Thursday, March 12, at 6 p.m.", source: "signed bulletin",
      papers: [bulletin("Kindergarten open house: Thursday, March 12, at 6 p.m. in the library."), template("Open house: Saturday, March 14.")] } },
  { truth: "supported", customer: "Riley Osei", line: "Is the gym open again? My son has practice.",
    draft: { to: "Riley", sentence: "The gym reopens October 3.", source: "contractor's signed letter",
      papers: [{ title: "Contractor letter · signed, on the gym repair", signed: true, text: "The gym floor work is complete. The gym reopens October 3." },
        { title: "Facilities email · unsigned", signed: false, text: "Hoping the gym is back in early October." }] } },
  { truth: "supported", customer: "Paula Brandt", line: "What time can I come by the office?",
    draft: { to: "Paula", sentence: "The front office opens at 7:30 a.m. on school days.", source: "signed bulletin",
      papers: [bulletin("Front office hours: 7:30 a.m. to 4 p.m. on school days.")] } },
  { truth: "supported", customer: "Hugo Lind", line: "What does the application need besides the form?",
    draft: { to: "Hugo", sentence: "Applications need a birth certificate and proof of address.", source: "signed checklist",
      papers: [{ title: "Application checklist · signed", signed: true, text: "Required with every application: a birth certificate and proof of address." }] } },
  // Incorrect: the signed paper gives a different value
  { truth: "incorrect", customer: "Cameron Reyes", line: "When do new applications close?",
    draft: { to: "Cameron", sentence: "New applications close May 19.", fix: "May 24", source: "signed bulletin",
      papers: [bulletin("New applications close May 24. Bring proof of address to the front office.")] } },
  { truth: "incorrect", customer: "Nadia Farouk", line: "What's the last day to sign up for the bus?",
    draft: { to: "Nadia", sentence: "Bus sign-up closes August 18.", fix: "August 15", source: "signed bulletin",
      papers: [bulletin("Bus sign-up closes August 15. Routes are posted the week before school.")] } },
  { truth: "incorrect", customer: "Theo Marsh", line: "When are the shot records due?",
    draft: { to: "Theo", sentence: "Immunization records are due July 1.", fix: "August 1", source: "signed bulletin",
      papers: [bulletin("Immunization records are due August 1 for every new student.")] } },
  { truth: "incorrect", customer: "Ines Carvalho", line: "When is kindergarten screening?",
    draft: { to: "Ines", sentence: "Kindergarten screening is on April 2.", fix: "April 9", source: "signed bulletin",
      papers: [bulletin("Kindergarten screening: April 9, by appointment with the front office.")] } },
  // Outdated: an old or unsigned paper agrees with the draft
  { truth: "outdated", customer: "Sam Whitaker", line: "I want to be sure we apply in time. When's the cutoff?",
    draft: { to: "Sam", sentence: "New applications close May 19.", fix: "May 24", source: "signed bulletin",
      papers: [template("New applications close May 19."), bulletin("New applications close May 24.")] } },
  { truth: "outdated", customer: "Leo Park", line: "When does fall registration close?",
    draft: { to: "Leo", sentence: "Fall applications close September 14.", fix: "September 12", source: "fall bulletin",
      papers: [newsletter("Proposes moving the fall close to September 14."), fallBulletin("Fall applications close September 12.")] } },
  { truth: "outdated", customer: "Mei Zhao", line: "What time does the open house start?",
    draft: { to: "Mei", sentence: "The open house starts at 5 p.m.", fix: "6 p.m.", source: "signed bulletin",
      papers: [template("Open house starts at 5 p.m."), bulletin("Kindergarten open house: Thursday, March 12, at 6 p.m.")] } },
  // Unsupported: no paper gives the date
  { truth: "unsupported", customer: "Kofi Mensah", line: "When does the east wing reopen? My daughter's class is in there.",
    draft: { to: "Kofi", sentence: "The east wing reopens on June 2.",
      papers: [bulletin("East wing repair: the contractor has not set a reopening day.")] } },
  { truth: "unsupported", customer: "Sara Quist", line: "Is the music room back yet?",
    draft: { to: "Sara", sentence: "The music room reopens on November 1.",
      papers: [fallBulletin("Music room repairs: no reopening day has been set.")] } },
  { truth: "unsupported", customer: "Elena Petrov", line: "When do you post class lists?",
    draft: { to: "Elena", sentence: "Class lists go up on August 20.",
      papers: [bulletin("Class lists will be posted once staffing is final.")] } },
  // Draft-only: only an unsigned paper gives the date
  { truth: "draft-only", customer: "Ben Adair", line: "Any news on the music room?",
    draft: { to: "Ben", sentence: "The music room reopens on November 1.",
      papers: [{ title: "Facilities email · unsigned", signed: false, text: "Hoping the music room is back by November 1." }, fallBulletin("Music room repairs: no reopening day has been set.")] } },
  { truth: "draft-only", customer: "Yusuf Kaya", line: "When will the east wing be open again?",
    draft: { to: "Yusuf", sentence: "The east wing reopens on June 2.",
      papers: [newsletter("The east wing could reopen June 2."), bulletin("East wing repair: the contractor has not set a reopening day.")] } },
  { truth: "draft-only", customer: "Clara Doyle", line: "When does the new playground open?",
    draft: { to: "Clara", sentence: "The new playground opens September 8.",
      papers: [{ title: "Parent group email · unsigned", signed: false, text: "We're aiming for September 8!" }, bulletin("Playground: the district will confirm the opening day.")] } },
  // Decision: an exception only Felicia decides
  { truth: "decision", customer: "Morgan Ellis", line: "We missed the deadline because of a family emergency. Can our late application still be considered?",
    draft: { to: "Morgan", sentence: "Your late application has been approved.", papers: [policy] } },
  { truth: "decision", customer: "Kim Laurent", line: "My son's transfer papers arrived late from his old school. Can his application still be considered?",
    draft: { to: "Kim", sentence: "Unfortunately, late applications cannot be accepted.", papers: [policy] } },
  { truth: "decision", customer: "Tasha Greene", line: "We live two blocks outside the boundary. Can our daughter still enroll here?",
    draft: { to: "Tasha", sentence: "Yes, we can make an exception for your daughter.", papers: [policy] } },
  { truth: "decision", customer: "Arjun Desai", line: "My son turns five in October, after the cutoff. Can he start kindergarten this fall?",
    draft: { to: "Arjun", sentence: "Children born after September 1 have to wait until next year.", papers: [policy] } },
  // Decided: Felicia already signed the decision
  { truth: "decided", customer: "Dana Whitfield", line: "Felicia said she'd decide on our late application this week. Any news?",
    draft: { to: "Dana", sentence: "Felicia Grant approved your late application on Tuesday.", source: "decision note",
      papers: [{ title: "Decision note · signed by Felicia Grant, Tuesday", signed: true, text: "Whitfield family, late application: approved." }, policy] } },
  { truth: "decided", customer: "Ana Ruiz", line: "We asked about enrolling from outside the boundary. Has anyone decided?",
    draft: { to: "Ana", sentence: "Felicia Grant turned down the boundary request. You can apply again in January.", source: "decision note",
      papers: [{ title: "Decision note · signed by Felicia Grant, Wednesday", signed: true, text: "Ruiz family, boundary exception: not approved. The family may reapply in January." }, policy] } },
];

export const frontOfficeScenarios = scenarios;

// Original exam-style items in the CCAO-F style: a workplace scenario with the evidence in the stem, and plausible
// distractors that each misjudge the source, the gap, or who decides.
export const proofQuestions: readonly ProofQuestion[] = [
  {
    id: "front-q-outdated", concept: "outdated", objective: "2.3",
    prompt: "Claude drafted a reply saying new applications close May 19. The desk holds last year's reply template (May 19), an unsigned newsletter draft proposing May 26, and this year's enrollment bulletin, signed Monday, which says May 24. What should happen to the sentence before it is sent?",
    options: [
      ["a", "Keep May 19, because the reply template matches the draft and it is the wording the office has used before.", "The template is last year's paper; agreeing with the draft does not make it current or authoritative."],
      ["b", "Change it to May 26, because the newsletter is the newest paper on the desk and gives families more time.", "The newsletter is unsigned and still awaiting a vote, so its date is a proposal rather than the office's decision."],
      ["c", "Change it to May 24 and cite the signed bulletin, since that is the current approved source for the deadline.", "The signed, current bulletin is the authoritative source, so the claim is incorrect and its fix comes from that paper."],
      ["d", "Remove the date and say the deadline has not been announced, because the papers on the desk disagree with each other.", "The signed bulletin does state a date, so calling it unannounced withholds a confirmed fact from the waiting family."],
    ],
    correct: "c",
    explanation: "Check each claim against the authoritative source, meaning the current and approved one. The signed bulletin says May 24, so the draft's May 19 is incorrect and gets that fix with a citation. A template that matches the draft, or a newer unsigned proposal, is not evidence.",
  },
  {
    id: "front-q-unsupported", concept: "unsupported", objective: "2.3",
    prompt: "A draft reply tells a family the east wing reopens on June 2. The signed bulletin says the contractor has not set a reopening day, and no other paper gives a date. What should the reply say about the reopening?",
    options: [
      ["a", "That the reopening day has not been announced yet, and the office will tell families once the contractor sets one.", "No approved source gives a date, so the claim is unsupported, and saying it is not yet known is accurate."],
      ["b", "That the east wing reopens in early June, which keeps the family's plans roughly right without naming a day.", "A softer estimate is still a claim no source supports, and the family may plan their month around it anyway."],
      ["c", "That the east wing reopens on June 2, since no paper on the desk contradicts the date that Claude's draft gives.", "A missing contradiction is not support; a claim needs a source that states it before it goes out to a family."],
      ["d", "Nothing yet: hold the whole reply for Felicia Grant, who decides exceptions, until the contractor sets a date.", "Felicia decides enrollment exceptions, not repair dates, and holding the reply delays the facts that are confirmed."],
    ],
    correct: "a",
    explanation: "When no approved source states a fact, the claim is unsupported: remove it or say it is not yet announced. Keeping it because nothing contradicts it, or swapping in a vaguer estimate, still sends an unconfirmed date, and escalating sends it to someone who cannot answer.",
  },
  {
    id: "front-q-decision", concept: "decision", objective: "2.4",
    prompt: "A family writes that they missed the enrollment deadline because of a family emergency. Claude's draft reply says their late application has been approved. School policy says Felicia Grant decides every deadline exception and needs the family's reason. What should happen to the draft?",
    options: [
      ["a", "Send it, since the draft is polite, the family's reason is sympathetic, and most late requests are approved anyway.", "Sending the approval decides the exception without the only person the policy allows to make that decision."],
      ["b", "Change it to a polite refusal, since the deadline in the signed bulletin has already passed for this family.", "A refusal is also a decision about the exception, and it is neither the reviewer's nor Claude's decision to make."],
      ["c", "Send it with a note that the approval is provisional until someone in the front office confirms it next week.", "A provisional approval still tells the family yes, and the front office is not the authority that can confirm it."],
      ["d", "Hold the reply and send the request to Felicia Grant with the family's message and their stated reason attached.", "The policy names the decision-maker and what she needs, so the reply waits while the request reaches her with context."],
    ],
    correct: "d",
    explanation: "Claude can draft and gather facts, but an exception is a decision for the accountable person. Approving, refusing or provisionally approving in the reply each decides it without her. Hold the reply and route the request to Felicia with the family's reason, which is what she needs to decide.",
  },
  {
    id: "front-q-decided", concept: "decided", objective: "2.4",
    prompt: "Felicia Grant signed a decision note on Tuesday approving the Whitfield family's late application. Claude's draft to the family says their late application was approved on Tuesday. What should the reviewer do with this reply?",
    options: [
      ["a", "Hold it for Felicia Grant, since any sentence about a deadline exception has to be decided by her first.", "She already decided and signed it, so routing it back to her adds a wait without adding any check."],
      ["b", "Send it as written and cite the signed decision note, because the person who decides has already decided.", "The claim matches an authoritative, signed decision, so it is supported and can go out with its source."],
      ["c", "Rewrite it to say a decision is still pending, so the office does not appear to promise anything too early.", "That statement is now false: the decision exists and the family is waiting to hear what it says."],
      ["d", "Remove the approval and ask the family to call Felicia Grant directly so they hear the decision from her.", "The office already holds the signed answer, so sending the family elsewhere creates extra work for everyone."],
    ],
    correct: "b",
    explanation: "Escalation is for decisions the accountable person has not made. Once Felicia signs a decision, the claim is supported by an authoritative source and can be sent with that source cited. Sending it back to her, hiding it, or redirecting the family wastes her time and theirs.",
  },
  {
    id: "front-q-draft-only", concept: "draft-only", objective: "2.3",
    prompt: "Claude's draft says the music room reopens November 1. An unsigned facilities email says the team is hoping for November 1, and the signed fall bulletin says no reopening day has been set. Which version of the sentence should go to the family?",
    options: [
      ["a", "Say the music room's reopening day has not been announced, and the office will share it once it is set.", "The only approved source says no day is set, and a hopeful unsigned email does not change that."],
      ["b", "Keep November 1 but add that the date comes from the facilities team, so the family knows its source.", "Naming an unsigned email as the source still presents a hoped-for date as information the family can use."],
      ["c", "Keep November 1, because the facilities team runs the repair and knows its schedule better than the bulletin.", "Knowing the work does not turn an unsigned hope into an approved date; the signed bulletin is the office's record."],
      ["d", "Change it to early November, which matches the email's intent while avoiding a promise of one exact day.", "A vaguer version of an unconfirmed date is still unconfirmed, and families will still plan around it."],
    ],
    correct: "a",
    explanation: "A claim backed only by an unsigned paper is unsupported. The signed bulletin is the authoritative source, and it says no day is set, so the reply says the date is not yet announced. Attributing, softening or trusting the hopeful email still passes it off as confirmed information.",
  },
  {
    id: "front-q-supported", concept: "supported", objective: "2.3",
    prompt: "Reviewing three drafts, a colleague marks every factual sentence as unsupported to be safe, including one that the signed bulletin states word for word. What is wrong with this review?",
    options: [
      ["a", "Nothing; flagging everything is the careful choice, because families can always call the office to confirm a detail.", "Over-flagging is an error too: families lose confirmed facts, and the office takes calls it did not need."],
      ["b", "The review should also send every flagged sentence to Felicia Grant before any of the three replies go out.", "That multiplies the mistake: Felicia decides exceptions, not facts that the signed bulletin already confirms."],
      ["c", "The colleague should have used last year's reply template to confirm the sentences that the bulletin leaves out.", "The template is outdated and not approved, so it confirms nothing, and the bulletin already covers this sentence."],
      ["d", "A sentence the signed bulletin states is supported, so it should be kept with the bulletin cited rather than removed.", "Verification cuts both ways: a claim the authoritative source states is supported and stays in the reply."],
    ],
    correct: "d",
    explanation: "Checking claims means sorting them, not doubting all of them. A sentence the current signed source states is supported, so it stays with the source cited. Flagging it removes a confirmed fact, and pushing it to Felicia or to an old template adds work without adding accuracy.",
  },
  {
    id: "front-q-depth", concept: "general", objective: "2.4",
    prompt: "The front office uses Claude for two jobs today: a list of ideas for the spring open house that only staff will see, and replies to 40 families about enrollment deadlines. Jordan has time for one careful review. Where should it go?",
    options: [
      ["a", "To the open house ideas, since the event is public and staff will build their spring plans on that list.", "The list is internal and easy to change; staff can refine it later at very little cost."],
      ["b", "To the family replies, which leave the school, carry dates families act on, and cannot be recalled once sent.", "External, consequential and hard-to-reverse output needs the deepest review, so the careful check belongs here."],
      ["c", "Split it evenly, giving each job half a review, since the same model drafted both from the same office papers.", "Review depth should follow the consequences of an error, not which tool produced the draft."],
      ["d", "Neither, since Claude drafted both from the school's own papers and its replies have been accurate so far.", "Past accuracy does not verify today's claims, and the family replies carry dates that must be checked."],
    ],
    correct: "b",
    explanation: "Set review depth by what happens if the output is wrong and who relies on it. Replies to families are external, families act on the dates, and a wrong deadline cannot be recalled. An internal brainstorm can take a light pass, whatever tool drafted it and however well it has done before.",
  },
  {
    id: "front-q-incorrect", concept: "incorrect", objective: "2.3",
    prompt: "Claude's draft tells a family that immunization records are due July 1. The signed bulletin says August 1. The same draft says the front office opens at 7:30 a.m., which the bulletin confirms. How should the reviewer handle the two sentences?",
    options: [
      ["a", "Flag both as unsupported and send the reply without them, since one wrong date makes the whole draft unreliable.", "One error does not discredit a sentence the signed source confirms; removing it withholds a fact."],
      ["b", "Send the reply as written, since the opening time is right and the records deadline is only a month early.", "A wrong deadline is still wrong; an earlier date can make families rush or think they have already missed it."],
      ["c", "Change the deadline to August 1, citing the signed bulletin, and keep the sentence about opening time as written.", "Each claim gets its own verdict: one is incorrect and fixed from the source, the other is supported and kept."],
      ["d", "Hold the reply for Felicia Grant, since the deadline in the draft differs from the one the bulletin gives.", "A date that contradicts a signed source is a factual fix the reviewer makes, not a decision for Felicia."],
    ],
    correct: "c",
    explanation: "Verify claim by claim. The records deadline contradicts the signed bulletin, so it is incorrect and corrected to August 1 with the source cited. The opening time matches the bulletin, so it stays. Discarding both, sending both, or escalating a plain factual fix each misjudges one of the claims.",
  },
];

export const frontOfficeContent: ShiftContent<Concept, Draft> = {
  concepts: ["supported", "incorrect", "unsupported", "decision", "outdated", "draft-only", "decided"],
  unlockOrder: [["supported", "incorrect", "unsupported", "decision"], ["outdated", "draft-only"], ["decided"]],
  easy: "supported",
  size: (number) => number === 1 ? 5 : 6,
  conceptNotes,
  proofQuestions,
  tickets(picks, number, random) {
    const used = new Set<string>();
    return picks.map(({ concept, returning }, index): Ticket => {
      const pool = shuffle(scenarios.filter(({ truth }) => truth === concept), random);
      // A family appears once per shift; the same sentence (e.g. "May 19") never comes twice in a row of drafts.
      const scenario = pool.find(({ customer, draft }) => !used.has(customer) && !used.has(draft.sentence)) ?? pool[0];
      used.add(scenario.customer);
      used.add(scenario.draft.sentence);
      return {
        id: `f${number}-t${index + 1}`, concept, returning, customer: scenario.customer, line: scenario.line, kind: "single",
        items: [{ ...scenario.draft, id: `d${number}-${index + 1}`, truth: concept }],
      };
    });
  },
};
