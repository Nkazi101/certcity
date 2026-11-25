import { column, countWords, findTable, hasTodo } from "./artifacts";
import { verdict, words } from "./model";
import type { CapstoneDefinition, CapstoneDraft, CapstoneStage } from "./model";

type Verdict = "supported" | "incorrect" | "unsupported";
type Claim = { label: string; match: readonly RegExp[]; truth: Verdict; section?: string; fix?: RegExp; why: string };
type Placement = { id: string; item: string; answer: Place; why: string; kind: "placement" | "currency" };
type Step = { step: string; owner: "Claude" | "Human"; signoff: boolean; why: string };

const places = ["Project instructions", "Project knowledge", "Connector", "Memory", "Leave it out"] as const;
type Place = (typeof places)[number];

type AssociateCase = {
  id: string;
  stage: CapstoneStage;
  title: string;
  brief: string;
  office: string;
  audience: string;
  handbook: string;
  handbookText: string;
  contact: string;
  facts: readonly string[];
  request: string;
  draft: string;
  claims: readonly Claim[];
  placements: readonly Placement[];
  email: string;
  policy: string;
  redact: readonly { label: string; pattern: RegExp }[];
  keep: readonly { label: string; pattern: RegExp }[];
  steps: readonly Step[];
  pilot: string;
};

const handlingOptions = [
  "Paste the email as written; the workspace is approved",
  "Remove the restricted details, then paste the question",
  "Don't use Claude for this reply",
] as const;

function classify(cell: string): Verdict | null {
  const value = cell.toLowerCase();
  if (/unsupported|not supported|no source|not in (the )?(source|handbook|guide)|unverified|not found|no evidence/.test(value)) return "unsupported";
  if (/incorrect|wrong|false|contradict|mismatch|error|inaccurate|outdated/.test(value)) return "incorrect";
  if (/supported|correct|accurate|ok\b|verified|matches|confirmed|true/.test(value)) return "supported";
  return null;
}

function instructionProblems(input: AssociateCase, draft: CapstoneDraft) {
  const value = draft.instructions ?? "";
  if (hasTodo(value) || countWords(value) < 60) return [`Write at least 60 words of instructions with no TODO placeholders. Instructions are read before every conversation in the Project, so spell out the job.`];
  const problems: string[] = [];
  if (!/applicant|prospective|student|parent|famil|guardian|resident|member/i.test(value)) problems.push(`Name the audience (${input.audience}). Claude adjusts tone and detail to the reader you describe.`);
  if (!/plain[ ,-]+(and |\w+ )?(language|english|words|wording)|plain,|simple (language|words)|jargon|reading level|grade level|friendly|warm|conversational|\btone\b/i.test(value)) problems.push(`Say how to write for that audience, for example plain language with no jargon.`);
  const format = [
    /\b\d+\s*(words?|sentences?|paragraphs?|bullets?)\b/i,
    /bullet|numbered list|list of/i,
    /sign (off|as|with)|signature|greet|salutation|closing/i,
    /next step/i,
  ].filter((pattern) => pattern.test(value)).length;
  if (format < 2) problems.push(`Specify the output format with at least two concrete features: a length limit (for example "under 150 words"), bullets for steps, the greeting and sign-off, or a "Next steps" line.`);
  return problems;
}

function groundingProblems(input: AssociateCase, draft: CapstoneDraft) {
  const value = draft.instructions ?? "";
  if (hasTodo(value) || countWords(value) < 60) return [`Complete the instructions first; this check reads the same text.`];
  const problems: string[] = [];
  if (!value.toLowerCase().includes(input.handbook.toLowerCase())) problems.push(`Name the source Claude should rely on: the ${input.handbook} in Project knowledge.`);
  if (!/\bonly\b|cite|section|quote|based on/i.test(value)) problems.push(`Tell Claude to answer only from the ${input.handbook} and to cite the section it used, so a reviewer can check each answer.`);
  if (!/not sure|unsure|don'?t know|do not know|can'?t find|cannot find|isn'?t (in|covered)|is not (in|covered)|not (in|covered by)|unclear|uncertain|doesn'?t (say|cover|answer)|does not (say|cover|answer)/i.test(value)) {
    problems.push(`Say what to do when the ${input.handbook} doesn't answer the question: say so plainly instead of guessing.`);
  }
  if (!value.toLowerCase().includes(input.contact.toLowerCase())) problems.push(`Give the escalation route for unanswered or exceptional questions (${input.contact}).`);
  const hardcoded = input.facts.filter((fact) => value.toLowerCase().includes(fact.toLowerCase()));
  if (hardcoded.length) problems.push(`The instructions repeat facts from the handbook (${hardcoded.join(", ")}). Facts belong in Project knowledge, where one file update keeps every answer current; copies in the instructions go stale.`);
  return problems;
}

function placementProblems(input: AssociateCase, draft: CapstoneDraft, kind: Placement["kind"]) {
  return input.placements.filter((item) => item.kind === kind).flatMap(({ id, item, answer, why }) => {
    const chosen = draft[id] ?? "";
    if (!chosen) return [`Choose where "${item}" belongs.`];
    return chosen === answer ? [] : [`"${item}" → ${chosen}. ${why}`];
  });
}

function checklistTable(draft: CapstoneDraft) {
  return findTable(draft.checklist, ["claim", "verdict"]);
}

function checklistProblems(input: AssociateCase, draft: CapstoneDraft) {
  const table = checklistTable(draft);
  if (!table) return [`Write the checklist as a Markdown table with the columns Claim | Source | Verdict | Fix.`];
  const problems: string[] = [];
  for (const claim of input.claims) {
    const row = table.rows.find((entry) => claim.match.every((pattern) => pattern.test(column(entry, "claim"))));
    if (!row) {
      if (claim.truth !== "supported") problems.push(`The checklist has no row for the claim about ${claim.label}. Check every factual statement in the draft, not just the ones that look wrong.`);
      continue;
    }
    const found = classify(column(row, "verdict"));
    if (found !== claim.truth) {
      problems.push(claim.truth === "supported"
        ? `The ${claim.label} claim is marked ${found ?? "unclear"}, but ${claim.section} supports it. ${claim.why}`
        : `The ${claim.label} claim is marked ${found ?? "with no clear verdict"}; it is ${claim.truth}. ${claim.why}`);
      continue;
    }
    if (claim.truth === "incorrect") {
      if (claim.section && !column(row, "source").toUpperCase().includes(claim.section)) problems.push(`Cite ${claim.section} as the source for the ${claim.label} correction so the reviewer can confirm it.`);
      if (claim.fix && !claim.fix.test(column(row, "fix"))) problems.push(`The fix for ${claim.label} should state the correct value from ${claim.section}.`);
    }
    if (claim.truth === "unsupported" && !/remove|delete|cut|drop|verify|confirm|check|ask|escalat/i.test(column(row, "fix"))) {
      problems.push(`For the unsupported ${claim.label} claim, the fix should remove it or route it for confirmation; nothing in the ${input.handbook} backs it.`);
    }
  }
  return problems;
}

function dataProblems(input: AssociateCase, draft: CapstoneDraft) {
  const problems: string[] = [];
  const choice = draft.handling ?? "";
  if (choice !== handlingOptions[1]) {
    problems.push(choice === handlingOptions[0]
      ? `The policy approves this workspace for directory information only. The email also contains restricted details, so pasting it as written breaks policy.`
      : choice === handlingOptions[2]
        ? `The question itself is routine and answerable from the ${input.handbook}. Removing the restricted details keeps Claude useful without exposing them.`
        : `Choose how to handle the email.`);
  }
  const redacted = draft.redacted ?? "";
  if (hasTodo(redacted) || countWords(redacted) < 8) return [...problems, `Write the redacted version of the email that you would paste into Claude.`];
  for (const { label, pattern } of input.redact) if (pattern.test(redacted)) problems.push(`The redacted text still contains the ${label}. Remove it.`);
  for (const { label, pattern } of input.keep) if (!pattern.test(redacted)) problems.push(`The redacted text lost the ${label}. Keep the question Claude needs to answer.`);
  return problems;
}

function delegationTable(draft: CapstoneDraft) {
  return findTable(draft.delegation, ["step", "owner"]);
}

function delegationProblems(input: AssociateCase, draft: CapstoneDraft) {
  const table = delegationTable(draft);
  if (!table) return [`Keep the delegation table with the columns Step | Owner | Human sign-off.`];
  const problems: string[] = [];
  for (const { step, owner, signoff, why } of input.steps) {
    const key = words(step).slice(0, 24);
    const row = table.rows.find((entry) => words(column(entry, "step")).startsWith(key));
    if (!row) {
      problems.push(`Keep the row for "${step}".`);
      continue;
    }
    const chosenOwner = /claude/i.test(column(row, "owner")) ? "Claude" : /human|staff|person|me\b|reviewer|coordinator|officer/i.test(column(row, "owner")) ? "Human" : null;
    const signCell = column(row, "sign");
    const chosenSign = /^\s*(yes|y|required|true)/i.test(signCell) ? true : /^\s*(no|n|not|false|none)/i.test(signCell) ? false : null;
    if (chosenOwner !== owner || chosenSign !== signoff) {
      problems.push(`"${step}": ${owner === "Claude" ? "Claude can do this" : "a person must do this"}${signoff ? ", with human sign-off before it reaches anyone" : ", no separate sign-off needed"}. ${why}`);
    }
  }
  return problems;
}

function preview(input: AssociateCase, draft: CapstoneDraft) {
  const out: string[] = [];
  out.push(`Project: ${input.office}`, "", "Instructions:", (draft.instructions ?? "").trim() || "(empty)", "", "Setup:");
  for (const { item, id } of input.placements) out.push(`  ${draft[id] || "(not chosen)"} ← ${item}`);
  out.push("", "Verification checklist read as:");
  const table = checklistTable(draft);
  if (!table) out.push("  (no Claim | Source | Verdict | Fix table found)");
  else for (const row of table.rows) out.push(`  ${column(row, "claim").slice(0, 60) || "(blank)"} → ${classify(column(row, "verdict")) ?? "no verdict"}`);
  out.push("", `Data handling: ${draft.handling || "(not chosen)"}`, "Text that would reach Claude:", (draft.redacted ?? "").trim() || "(empty)");
  out.push("", "Delegation read as:");
  const steps = delegationTable(draft);
  if (!steps) out.push("  (no Step | Owner | Human sign-off table found)");
  else for (const row of steps.rows) out.push(`  ${column(row, "step").slice(0, 50)} → ${column(row, "owner") || "?"} · sign-off ${column(row, "sign") || "?"}`);
  return out.join("\n");
}

function lab(input: AssociateCase): CapstoneDefinition {
  return {
    id: input.id, stage: input.stage, title: input.title, role: "Claude Projects",
    brief: input.brief,
    deliverable: "Write the Project instructions, decide where each item belongs, verify Claude's draft against the source, handle the sensitive email, and plan who does each step. Every artifact is checked against the records.",
    documents: [
      { id: "REQUEST", title: "Request from your manager", text: input.request },
      { id: "HANDBOOK", title: input.handbook, text: input.handbookText },
      { id: "DRAFT", title: "Claude's draft reply (unreviewed)", text: input.draft },
      { id: "EMAIL", title: "Email waiting in the shared inbox", text: input.email },
      { id: "POLICY", title: "Data and pilot policy", text: `${input.policy}\n\n${input.pilot}` },
    ],
    fields: [
      {
        id: "instructions", label: "Project instructions", editor: "markdown",
        instruction: "Written once, applied to every conversation in the Project. Cover the audience, the source, the format, and what to do when the source has no answer.",
        initial: "# Role\nTODO: who Claude is helping and who reads the replies\n\n# Sources\nTODO\n\n# Format\nTODO\n\n# When you're not sure\nTODO",
        example: "# Role\nYou draft replies for the Westside Clinic front desk. Readers are patients, often reading on a phone.\n\n# Sources\nAnswer only from the Patient Guide in Project knowledge and cite its section (for example PG-4).\n\n# Format\nUnder 120 words. Greeting, the answer, a \"Next steps\" line, sign off as Front Desk.\n\n# When you're not sure\nIf the guide doesn't answer it, say so and refer the patient to help@westside.example. Never guess.",
      },
      ...input.placements.map(({ id, item }) => ({ id, group: "Where does each item belong?", label: item, options: places })),
      {
        id: "checklist", label: "Verification checklist for the draft", editor: "markdown",
        instruction: "One row per factual claim in DRAFT. Verdict is supported, incorrect, or unsupported. Cite the handbook section and give the fix.",
        initial: "| Claim | Source | Verdict | Fix |\n| --- | --- | --- | --- |\n| TODO | TODO | TODO | TODO |",
        example: "| Claim | Source | Verdict | Fix |\n| --- | --- | --- | --- |\n| Clinic opens at 7:00 | PG-1.1 | incorrect | Opens at 8:00 per PG-1.1 |\n| Parking is free | — | unsupported | Remove, or confirm with facilities |\n| Flu shots on Fridays | PG-3.2 | supported | — |",
      },
      { id: "handling", group: "Sensitive email", label: "How will you use the EMAIL with Claude?", options: handlingOptions },
      {
        id: "redacted", group: "Sensitive email", label: "Text you would paste into Claude", editor: "notes",
        instruction: "Write exactly what would reach Claude. Keep the question; remove anything the policy restricts.",
        initial: "TODO",
      },
      {
        id: "delegation", label: "Delegation plan", editor: "markdown",
        instruction: "For each step, set Owner to Claude or Human, and Human sign-off to yes or no.",
        initial: `| Step | Owner | Human sign-off |\n| --- | --- | --- |\n${input.steps.map(({ step }) => `| ${step} | TODO | TODO |`).join("\n")}`,
      },
    ],
    criteria: [
      { id: "voice", title: "Write instructions for the audience and format", objectives: ["1.1", "2.5", "2.6"], revisedObjectives: ["1.1", "2.4"],
        review: "Good Project instructions name the reader, how to write for them, and a concrete output format (length, structure, sign-off). Claude applies them to every conversation." },
      { id: "grounding", title: "Ground answers and handle uncertainty", objectives: ["5.3", "2.4"], revisedObjectives: ["5.3", "2.3"],
        review: "Point Claude at the knowledge source, ask for citations, say what to do when the source has no answer, and name who to escalate to. Keep facts in knowledge files, not in the instructions." },
      { id: "placement", title: "Put each item in the right place", objectives: ["5.1", "5.2", "3.1"], revisedObjectives: ["5.1", "5.2", "3.1"],
        review: "Instructions hold how Claude should behave. Project knowledge holds reference documents. Connectors bring in live data from other systems. Memory carries context about you across conversations." },
      { id: "currency", title: "Keep knowledge and memory current", objectives: ["5.4", "3.4"], revisedObjectives: ["5.4", "3.3"],
        review: "Superseded documents in knowledge produce confident, outdated answers; remove them. Personal working context that should follow you between chats belongs in memory, not in a shared Project." },
      { id: "verification", title: "Verify the draft against the source", objectives: ["2.1", "2.2", "2.3"], revisedObjectives: ["2.1", "2.2"],
        review: "Check every factual claim, not just the suspicious ones. Mark each as supported (with its section), incorrect (with the correct value and section), or unsupported (remove or confirm)." },
      { id: "data", title: "Protect restricted information", objectives: ["6.2", "6.3"], revisedObjectives: ["6.2", "6.3"],
        review: "Follow the organization's data policy. When only part of a message is restricted, remove that part and keep the question so Claude can still help." },
      { id: "delegation", title: "Decide what Claude does and what a person signs off", objectives: ["2.4", "4.4", "6.1"], revisedObjectives: ["2.3", "4.2", "6.1"],
        review: "Claude can draft, summarise, and translate. Decisions about exceptions, money, or a person's circumstances stay with staff, and anything that reaches the public gets the sign-off the pilot policy requires." },
    ],
    preview: (draft) => ({ kind: "console", text: preview(input, draft) }),
    exercise: (draft) => [
      verdict("voice", instructionProblems(input, draft), "The instructions describe the reader, the tone, and a concrete format."),
      verdict("grounding", groundingProblems(input, draft), `Claude answers from the ${input.handbook}, cites it, and escalates what it can't answer.`),
      verdict("placement", placementProblems(input, draft, "placement"), "Instructions, knowledge, and the connector each hold the right item."),
      verdict("currency", placementProblems(input, draft, "currency"), "The superseded guide stays out and your working context goes to memory."),
      verdict("verification", checklistProblems(input, draft), "Every planted error is caught, corrected from its section, and no correct claim is flagged."),
      verdict("data", dataProblems(input, draft), "The restricted details are removed and the question is intact."),
      verdict("delegation", delegationProblems(input, draft), "Each step has the right owner and the sign-off the pilot requires."),
    ],
    reference: { label: "Create and manage Projects (Claude Help Center)", url: "https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects" },
  };
}

const admissions: AssociateCase = {
  id: "associate-admissions-project-lab-v2", stage: "capstone", title: "Set up the admissions reply Project",
  brief: "Northgate Community College's admissions office is piloting Claude to draft replies to prospective students. Your manager wants a shared Project the whole team can use. Before it goes live you need to configure it, check one of Claude's early drafts, handle a sensitive email sitting in the inbox, and agree who does what.",
  office: "Northgate Admissions replies", audience: "prospective students and their families",
  handbook: "Enrollment Handbook", contact: "registrar@northgate.example",
  facts: ["February 15", "Feb 15", "$40", "August 20", "Aug 20"],
  request: "Please set up a Claude Project for drafting replies to prospective students. Replies go out under \"Northgate Admissions Team\" and should be easy to read on a phone. Use the 2026–27 Enrollment Handbook as the source. Anything the handbook doesn't cover goes to registrar@northgate.example. We'll review every reply before it's sent during the pilot.",
  handbookText: "Enrollment Handbook 2026–27 (excerpt)\nH-2.1 The priority application deadline is February 15. Applications after that date are reviewed as space allows.\nH-2.3 Official transcripts must be sent directly by the issuing school. Registration is on hold until they arrive.\nH-3.2 The application fee is $40. Fee waivers are decided by the registrar.\nH-4.1 New student orientation is on August 20.\nH-5.0 Student services: advising, tutoring, and the career center are open to all enrolled students.",
  draft: "Hi Dana,\n\nThanks for your interest in the Nursing Pathway! The priority application deadline is March 1. The application fee is $40. International students are guaranteed on-campus housing. Orientation is on August 20. You can start classes before your transcripts arrive and send them later.\n\nNorthgate Admissions Team",
  claims: [
    { label: "deadline", match: [/deadline|march/i], truth: "incorrect", section: "H-2.1", fix: /feb(ruary)?\.?\s*15|2\/15|15\s*feb/i, why: "H-2.1 sets the priority deadline at February 15." },
    { label: "housing", match: [/housing|residence/i], truth: "unsupported", why: "Nothing in the handbook mentions housing, let alone a guarantee, so it can't be marked correct or corrected from the source." },
    { label: "starting before transcripts arrive", match: [/transcript/i, /start|begin|before|later|class/i], truth: "incorrect", section: "H-2.3", fix: /hold|until|after|cannot|can'?t|must/i, why: "H-2.3 puts registration on hold until transcripts arrive." },
    { label: "application fee", match: [/fee|\$\s*40/i], truth: "supported", section: "H-3.2", why: "Only flag claims the source contradicts or doesn't cover." },
    { label: "orientation date", match: [/orientation|august/i], truth: "supported", section: "H-4.1", why: "Only flag claims the source contradicts or doesn't cover." },
  ],
  placements: [
    { id: "placeHandbook", kind: "placement", item: "2026–27 Enrollment Handbook (PDF, revised each August)", answer: "Project knowledge", why: "A reference document Claude should read and cite belongs in Project knowledge." },
    { id: "placeStatus", kind: "placement", item: "Live application status from the student information system (changes hourly)", answer: "Connector", why: "Data that changes constantly in another system should be read live through a connector, not copied into a file that goes stale." },
    { id: "placeRules", kind: "placement", item: "Reply rules: sign as Northgate Admissions Team and answer in the applicant's language", answer: "Project instructions", why: "Rules about how Claude should behave in every conversation belong in the Project instructions." },
    { id: "placeOld", kind: "currency", item: "2025–26 Enrollment Handbook (superseded)", answer: "Leave it out", why: "A superseded handbook gives Claude conflicting dates; keep it out of knowledge." },
    { id: "placeMemory", kind: "currency", item: "Your own note: you're covering the transfer-credit questions this month", answer: "Memory", why: "Context about your own work that should follow you across conversations belongs in memory, not in the team's shared Project." },
  ],
  email: "From: priya.raman@mail.example\nHi, I'm Priya Raman (student ID 900417263, date of birth 03/14/2007). I have an approved accommodation for ADHD with extended test time. Can I still apply to the Nursing Pathway after the priority deadline, and do I need to retake the placement test?",
  policy: "Data policy: The college's Claude workspace is approved for directory information (name, email, program of interest). Do not enter student ID numbers, dates of birth, or disability or health information.",
  redact: [
    { label: "student ID number", pattern: /900417263/ },
    { label: "date of birth", pattern: /03\/14\/2007|2007-03-14|march 14/i },
    { label: "disability details", pattern: /adhd|extended (test )?time/i },
  ],
  keep: [
    { label: "question about applying after the deadline", pattern: /deadline/i },
    { label: "program name", pattern: /nursing/i },
    { label: "placement test question", pattern: /placement/i },
  ],
  pilot: "Pilot rules: a staff member reviews every reply before it is sent. Fee waivers and late-application exceptions are decided by the registrar. Translated replies are checked by a bilingual staff member before sending.",
  steps: [
    { step: "Draft a reply to a routine question from the handbook", owner: "Claude", signoff: false, why: "Drafting from an approved source is the core use; the review happens before sending." },
    { step: "Send the reply to the applicant", owner: "Human", signoff: true, why: "The pilot requires a staff review of every reply before it goes out." },
    { step: "Decide a fee-waiver request", owner: "Human", signoff: true, why: "Fee waivers are a registrar decision about a person's circumstances." },
    { step: "Group this week's questions into FAQ themes", owner: "Claude", signoff: false, why: "An internal summary with no external effect is a good fit for Claude." },
    { step: "Approve a late application past the deadline", owner: "Human", signoff: true, why: "Exceptions are decided by the registrar, not drafted into policy by Claude." },
    { step: "Translate a reply into Spanish", owner: "Claude", signoff: true, why: "Claude can translate, but the pilot requires a bilingual staff check before sending." },
  ],
};

const camps: AssociateCase = {
  id: "associate-camps-project-retention-v2", stage: "transfer", title: "Set up the summer camp reply Project",
  brief: "Riverside Parks is using Claude to help its small camps team answer parents during registration season. Your coordinator has asked you to set up a shared Project, check one of Claude's drafts before it goes out, deal with a parent email that contains a child's medical details, and plan who handles each step.",
  office: "Riverside Camps replies", audience: "parents and guardians registering children",
  handbook: "Summer Camp Guide", contact: "camps@riverside-parks.example",
  facts: ["March 15", "Mar 15", "$185", "10%", "9:00"],
  request: "Can you set up a Claude Project for replying to parents about summer camp? Replies are signed \"Riverside Parks Camps\" and parents mostly read them on their phones. The 2027 Summer Camp Guide is the source of truth. Anything it doesn't answer goes to camps@riverside-parks.example. We check every reply before it's sent this season.",
  handbookText: "Summer Camp Guide 2027 (excerpt)\nG-1.2 Registration opens March 15 at 9:00.\nG-2.1 Each camp week costs $185.\nG-2.3 Siblings registered together receive a 10% discount on each additional child.\nG-3.1 Camp runs 9:00–15:00, Monday to Friday.\nG-3.4 Children bring a packed lunch each day.",
  draft: "Hi Sam,\n\nThanks for asking about summer camp! Registration opens April 1. Each week costs $185. Siblings get 25% off. Lunch is provided every day. Camp runs from 9:00 to 15:00.\n\nRiverside Parks Camps",
  claims: [
    { label: "registration date", match: [/registration|april|opens/i], truth: "incorrect", section: "G-1.2", fix: /march\s*15|3\/15|15\s*march/i, why: "G-1.2 opens registration on March 15." },
    { label: "sibling discount", match: [/sibling|25/i], truth: "incorrect", section: "G-2.3", fix: /10\s*%|ten percent/i, why: "G-2.3 sets the sibling discount at 10%." },
    { label: "lunch", match: [/lunch/i], truth: "incorrect", section: "G-3.4", fix: /pack|bring|own/i, why: "G-3.4 says children bring a packed lunch." },
    { label: "weekly cost", match: [/cost|\$\s*185|week/i], truth: "supported", section: "G-2.1", why: "Only flag claims the source contradicts or doesn't cover." },
    { label: "daily hours", match: [/runs|hours|15:00|9:00/i], truth: "supported", section: "G-3.1", why: "Only flag claims the source contradicts or doesn't cover." },
  ],
  placements: [
    { id: "placeHandbook", kind: "placement", item: "2027 Summer Camp Guide (PDF)", answer: "Project knowledge", why: "A reference document Claude should read and cite belongs in Project knowledge." },
    { id: "placeStatus", kind: "placement", item: "Live waitlist positions from the registration system", answer: "Connector", why: "Live data from another system should be read through a connector, not pasted into a file that goes stale." },
    { id: "placeRules", kind: "placement", item: "Reply rules: sign as Riverside Parks Camps and use plain language for parents", answer: "Project instructions", why: "Rules about how Claude should behave in every conversation belong in the Project instructions." },
    { id: "placeOld", kind: "currency", item: "2026 Summer Camp Guide (last year's prices and dates)", answer: "Leave it out", why: "Last year's guide gives Claude conflicting dates and prices; keep it out of knowledge." },
    { id: "placeMemory", kind: "currency", item: "Your own note: you're handling the swim-program inbox this month", answer: "Memory", why: "Context about your own work that should follow you across conversations belongs in memory, not in the team's shared Project." },
  ],
  email: "From: j.okafor@mail.example\nHello, my son Theo Okafor (born 07/22/2016) lives with us at 41 Alder Lane. He carries an epinephrine pen for a severe peanut allergy. Is there still space in Week 3, and is lunch included?",
  policy: "Data policy: The Parks Claude workspace may hold parent names, emails, and camp choices. Never enter a child's date of birth, home address, or any health or medical information.",
  redact: [
    { label: "child's date of birth", pattern: /07\/22\/2016|2016-07-22|july 22/i },
    { label: "home address", pattern: /41 alder/i },
    { label: "medical details", pattern: /peanut|allerg|epinephrine|epi-?pen/i },
  ],
  keep: [
    { label: "question about Week 3", pattern: /week\s*3/i },
    { label: "question about lunch", pattern: /lunch/i },
  ],
  pilot: "Season rules: a staff member reviews every reply before it is sent. Financial aid and medical care plans are decided by the camp director. Translated replies are checked by a fluent staff member before sending.",
  steps: [
    { step: "Draft a reply to a routine question from the guide", owner: "Claude", signoff: false, why: "Drafting from an approved source is the core use; the review happens before sending." },
    { step: "Send the reply to the parent", owner: "Human", signoff: true, why: "The season rules require a staff review of every reply before it goes out." },
    { step: "Approve a financial aid request", owner: "Human", signoff: true, why: "Financial aid is a director decision about a family's circumstances." },
    { step: "Summarise this week's parent questions into themes", owner: "Claude", signoff: false, why: "An internal summary with no external effect is a good fit for Claude." },
    { step: "Decide a child's medical care plan", owner: "Human", signoff: true, why: "Medical care plans are decided by the director with the family." },
    { step: "Translate a reply into Vietnamese", owner: "Claude", signoff: true, why: "Claude can translate, but a fluent staff member checks it before sending." },
  ],
};

export const associateDefinitions = { capstone: lab(admissions), transfer: lab(camps) };

// The December guide keeps the same hands-on skills; the criteria carry revised objective IDs.
export const associateRevisedDefinitions = associateDefinitions;
