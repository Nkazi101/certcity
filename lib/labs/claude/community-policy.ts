// Associate Foundations · community-policy. The learner redacts the real application text that leaves the desk for
// the analysis workspace, and writes the desk's rule table (blank dates, the youth-program mailbox, the last training
// slot, the weekly routing check). The engine replays the week through both files: what the analysis workspace receives,
// how long forms wait, when the mailbox first connects, who takes the last slot, and what the routing report shows.
// Transfer (revise): a new application with personal details inside the free text, a week where the mailbox owner never
// replies, two new candidates, and a new routing log.
import { hints } from "../../claude/casework";
import { column, findTable } from "../engines/parse";
import { clauses, countWords, negated, negatedBefore, sentences } from "../engines/prompt-policy";
import type { Check, Engine, EngineRun, Fixture, LabDocument, LabFiles, LabMission, LabRunFixture, TraceEvent, TraceSource } from "../types";

type Detail = { label: string; pattern: string };
type Candidate = { name: string; wording: string; criteria: number; first: boolean };
export type DeskInput = {
  application: { id: string; personal: readonly Detail[]; topic: readonly Detail[] };
  queue: { forms: number; blank: number };
  mailbox: { owner: string; emailed: number; events: readonly { day: string; kind: "login" | "it" | "lead" | "owner" | "note"; label: string }[] };
  award: { criteria: number; candidates: readonly [Candidate, Candidate] };
  routing: { short: { total: number; wrong: number }; long: { total: number; wrong: number } };
};
type DateHandling = "ask" | "draft" | "guess" | "staff";
type Decider = "named" | "staff" | "claude" | "chance" | "speed";
export type DeskOut = {
  exposed: string[];
  themes: string[];
  queue: { handling: DateHandling; stalled: number; invented: number; averageDays: number };
  mailbox: { connectedOn: string | null; ownerSigned: boolean; trigger: string };
  award: { decider: Decider; who: string; winner: Candidate; reason: boolean };
  routing: { grouped: boolean; by: string; report: string };
  sources: Record<"packet" | "date" | "mailbox" | "award" | "routing", TraceSource>;
};
type Parsed = { packet: string; rules: string };

const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function ruleRow(text: string, situation: RegExp) {
  const table = findTable(text, ["situation", "rule"])!;
  const index = table.rows.findIndex((row) => situation.test(column(row, "situation")));
  if (index < 0) return null;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const row = table.rows[index];
  const line = lines.findIndex((entry) => entry.trim().startsWith("|") && situation.test(entry) && entry.toLowerCase().includes(column(row, "situation").toLowerCase().slice(0, 12)));
  return { who: column(row, "who"), rule: column(row, "rule"), line: line >= 0 ? line + 1 : 1 };
}

/** Clauses of a cell that are said, not denied. */
const said = (cell: string) => sentences(cell).flatMap(({ text }) => clauses(text)).flatMap((clause) => clause.split(/,\s+(?=then\b|and\b)/i)).filter((clause) => !negated(clause));

function dateHandling(row: { who: string; rule: string } | null): DateHandling {
  if (!row) return "draft";
  const text = `${row.who}. ${row.rule}`;
  if (said(text).some((clause) => /\b(guess|infer|estimate|assume|default|likely|pick a|make up)\b/i.test(clause))) return "guess";
  if (sentences(text).flatMap(({ text: sentence }) => clauses(sentence)).some((clause) => /\b(draft|start|begin|write)\w*\b/i.test(clause) && !negatedBefore(clause, /\b(draft|start|begin|write)/i) && !/\b(before|until|once|after)\b/i.test(clause))) return "draft";
  if (said(text).some((clause) => /\b(ask|request|contact|email|call|message|return|send)\w*\b/i.test(clause) && /\b(applicant|family|person|them|sender|resident|candidate)\b/i.test(clause))) return "ask";
  if (/\bstaff\b/i.test(text)) return "staff";
  return "draft";
}

const triggers: readonly [DeskInput["mailbox"]["events"][number]["kind"], RegExp][] = [
  ["owner", /\bowner\b.*\b(sign|written|permission|approv|consent|agree)|\b(sign|written|permission|approv|consent|agree)\w*\b.*\bowner\b/i],
  ["login", /\blog ?in\b|\bworks\b|\baccess\b|credentials|technically/i],
  ["it", /\bIT\b|help ?desk|tech support/],
  ["lead", /team lead|manager|supervisor|\blead asks|boss/i],
];

export const deskEngine: Engine<Parsed, DeskInput, DeskOut> = {
  id: "neutral.desk-policy",
  provider: "neutral",
  label: "The week replayed through your packet and desk rules",
  simulated: false,
  parse(files) {
    const packet = files.packet ?? "";
    const rules = files.rules ?? "";
    if (countWords(packet) < 5) return { ok: false, error: "The outgoing packet is empty: write the text that leaves the desk.", source: { artifact: "packet", line: 1 } };
    if (!findTable(rules, ["situation", "rule"])) return { ok: false, error: "desk-rules.md has no Markdown table with Situation and Rule columns (a header row, a |---| row, then one row per situation).", source: { artifact: "rules", line: 1 } };
    return { ok: true, value: { packet, rules } };
  },
  run({ packet, rules }, fixture: Fixture<DeskInput>): EngineRun<DeskOut> {
    const input = fixture.input;
    const trace: TraceEvent[] = [];
    const push = (event: Omit<TraceEvent, "step">) => trace.push({ step: trace.length + 1, ...event });

    // 1. The packet as it reaches the analysis workspace.
    const exposed = input.application.personal.filter(({ pattern }) => new RegExp(pattern, "i").test(packet)).map(({ label }) => label);
    const themes = input.application.topic.filter(({ pattern }) => new RegExp(pattern, "i").test(packet)).map(({ label }) => label);
    const packetLine = (pattern: string) => { const index = packet.split("\n").findIndex((line) => new RegExp(pattern, "i").test(line)); return index >= 0 ? index + 1 : 1; };
    const firstExposed = input.application.personal.find(({ label }) => label === exposed[0]);
    push({ actor: "learner-artifact", kind: "request", label: `Packet ${input.application.id} leaves the desk · ${countWords(packet)} words`, source: { artifact: "packet", line: 1 } });
    push({ actor: "service", kind: "output", label: `Analysis workspace finds themes: ${themes.length ? themes.join(", ") : "none (nothing about what the applicant wants to learn)"}`, tone: themes.length < input.application.topic.length ? "bad" : "ok" });
    if (exposed.length) push({ actor: "service", kind: "output", label: `Also received: ${exposed.join(", ")}`, tone: "bad", source: { artifact: "packet", line: packetLine(firstExposed!.pattern) } });

    // 2. Intake: forms with a blank date.
    const date = ruleRow(rules, /date/i);
    const handling = dateHandling(date);
    const complete = input.queue.forms - input.queue.blank;
    const blankDays = handling === "draft" || handling === "staff" ? 2 : 1;
    const averageDays = Math.round(((complete + input.queue.blank * blankDays) / input.queue.forms) * 10) / 10;
    const stalled = handling === "draft" ? input.queue.blank : 0;
    const invented = handling === "guess" ? input.queue.blank : 0;
    const dateSource: TraceSource = { artifact: "rules", line: date?.line ?? 1 };
    push({ actor: "learner-artifact", kind: "decision", label: `${input.queue.blank} of ${input.queue.forms} forms arrive with a blank date · ${date ? `rule: “${date.rule}”` : "no rule: desk practice applies"}`, source: dateSource });
    push({ actor: "service", kind: "metric", tone: stalled || invented ? "bad" : "ok", source: dateSource, label: {
      draft: `${stalled} drafts start without a date and wait while staff chase it`,
      staff: `Staff chase each missing date after intake; the forms wait`,
      guess: `${invented} drafts go ahead with a date nobody gave`,
      ask: `The applicants are asked at intake; forms enter the queue complete`,
    }[handling], detail: `Average time in queue: ${averageDays} day${averageDays === 1 ? "" : "s"}`, payload: { averageDays } });

    // 3. The youth program mailbox: first event that satisfies the rule.
    const mailbox = ruleRow(rules, /mailbox|connector|inbox/i);
    const mailboxText = mailbox ? `${mailbox.rule}` : "connect when the login works";
    const live = said(mailboxText);
    const named = days.find((day) => live.some((clause) => clause.toLowerCase().includes(day)));
    const allowed = new Set(triggers.filter(([, pattern]) => live.some((clause) => pattern.test(clause))).map(([kind]) => kind));
    const mailboxSource: TraceSource = { artifact: "rules", line: mailbox?.line ?? 1 };
    let connectedOn: string | null = null;
    for (const event of input.mailbox.events) {
      const opens = !connectedOn && (allowed.has(event.kind) || (!!named && event.day.toLowerCase().startsWith(named.slice(0, 3))));
      if (opens) connectedOn = event.day;
      push({ actor: "service", kind: "decision", label: `${event.day} · ${event.label} → ${opens ? "connector switched on" : connectedOn ? "already connected" : "connector stays off"}`,
        tone: opens ? (event.kind === "owner" ? "ok" : "bad") : undefined, source: opens ? mailboxSource : undefined });
    }
    if (named && !connectedOn) {
      const day = named[0].toUpperCase() + named.slice(1, 3);
      connectedOn = day;
      push({ actor: "service", kind: "decision", label: `${day} · the day your rule names → connector switched on`, tone: "bad", source: mailboxSource });
    }
    const ownerEvent = input.mailbox.events.find(({ kind }) => kind === "owner");
    const ownerIndex = ownerEvent ? input.mailbox.events.indexOf(ownerEvent) : -1;
    const connectedIndex = connectedOn ? input.mailbox.events.findIndex(({ day }) => day === connectedOn) : -1;
    const beforeOwner = !!connectedOn && (ownerIndex < 0 || connectedIndex < 0 || connectedIndex < ownerIndex);
    if (!connectedOn && ownerEvent) push({ actor: "service", kind: "output", label: `${input.mailbox.emailed} emailed applications never reach the sorting`, tone: "bad", source: mailboxSource });

    // 4. The last training slot.
    const award = ruleRow(rules, /award|slot|place|training/i);
    const awardText = award ? `${award.who}. ${award.rule}` : "Claude ranks the applications";
    const awardSaid = said(awardText);
    // Claude decides when it is the subject of a deciding verb, or when its ranking or score settles the award.
    const automated = awardSaid.some((clause) => /\b(claude|the model|ai|assistant)\b(?:\W+\w+){0,3}?\W+(decides?|awards?|picks?|chooses?|selects?|ranks?|scores?|breaks?)\b/i.test(clause)
      || /\b(top[- ]ranked|highest[- ](score|ranked)|ranking|best score|strongest|automatic\w*)\b/i.test(clause)) || /\b(claude|model|ai|assistant|automatic)\b/i.test(award?.who ?? "");
    const chance = awardSaid.some((clause) => /\b(lottery|random|coin|draw)\b/i.test(clause));
    const speed = awardSaid.some((clause) => /\b(first|fastest|earliest|whoever applied)\b/i.test(clause));
    const person = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.exec(award?.who ?? "")?.[0] ?? /\b(Malik(?: Reed)?|programs coordinator)\b/i.exec(award?.rule ?? "")?.[0];
    const decider: Decider = automated ? "claude" : chance ? "chance" : speed ? "speed" : person ? "named" : "staff";
    const [one, two] = input.award.candidates;
    const confident = /certain|best|guarantee|definitely|exceptional/i.test(one.wording) ? one : two;
    const winner = decider === "claude" ? confident : decider === "chance" ? one : decider === "speed" ? (one.first ? one : two) : (one.criteria >= two.criteria ? one : two);
    const reason = /\breasons?\b/i.test(award?.rule ?? "");
    const who = decider === "named" ? person! : decider === "staff" ? (award?.who || "staff") : decider === "claude" ? "Claude" : decider === "chance" ? "a random draw" : "the order of arrival";
    const awardSource: TraceSource = { artifact: "rules", line: award?.line ?? 1 };
    push({ actor: decider === "named" || decider === "staff" ? "person" : "model", kind: "decision", source: awardSource,
      label: `Last slot: ${winner.name} (${winner.criteria} of ${input.award.criteria} criteria) · decided by ${who}${reason ? ", reason on file" : ""}`,
      detail: input.award.candidates.map(({ name, wording, criteria }) => `${name}: “${wording}” · meets ${criteria} of ${input.award.criteria} criteria`).join("\n"),
      tone: decider === "named" && reason ? "ok" : "bad" });

    // 5. The weekly routing report.
    const routing = ruleRow(rules, /routing|fairness|error|audit|report/i);
    const routingText = routing ? `${routing.rule}` : "report the overall error";
    const grouped = said(routingText).some((clause) => /\b(length|words?|short|long(er)?|writing|style|plain|wording|brief)\b/i.test(clause));
    const by = grouped ? "length of application" : /\b(week|month|day)\b/i.test(routingText) ? "week" : /\b(reviewer|opinion|spot)\b/i.test(routingText) ? "reviewer impressions" : "overall";
    const { short, long } = input.routing;
    const pct = (wrong: number, total: number) => `${Math.round((wrong / total) * 1000) / 10}%`;
    const overall = pct(short.wrong + long.wrong, short.total + long.total);
    const report = grouped
      ? `Overall ${overall} · under 80 words ${pct(short.wrong, short.total)} (${short.wrong} of ${short.total}) · 80 words or more ${pct(long.wrong, long.total)} (${long.wrong} of ${long.total})`
      : by === "reviewer impressions" ? "Reviewers: “routing looks fine this week”" : `${by === "week" ? "This week" : "Overall"}: ${overall} of complete applications sent to ‘incomplete’`;
    push({ actor: "service", kind: "output", label: "Weekly routing report", detail: report, source: { artifact: "rules", line: routing?.line ?? 1 } });

    return {
      trace,
      out: {
        exposed, themes,
        queue: { handling, stalled, invented, averageDays },
        mailbox: { connectedOn, ownerSigned: !!ownerEvent, trigger: beforeOwner ? "before" : connectedOn ? "after" : "never" },
        award: { decider, who, winner, reason },
        routing: { grouped, by, report },
        sources: {
          packet: { artifact: "packet", line: firstExposed ? packetLine(firstExposed.pattern) : 1 },
          date: dateSource, mailbox: mailboxSource, award: awardSource, routing: { artifact: "rules", line: routing?.line ?? 1 },
        },
      },
      metrics: { exposed: exposed.length, averageDays },
    };
  },
};

const a17: DeskInput["application"] = {
  id: "A17",
  personal: [
    { label: "name", pattern: "\\bDana\\b|Whitfield" }, { label: "phone number", pattern: "555-?0148" }, { label: "street address", pattern: "Birch|Unit 2" },
    { label: "postcode", pattern: "63110" }, { label: "date of birth", pattern: "2004|14 March" },
    { label: "health detail", pattern: "asthma|inhaler|breath|lung|diagnos|medication|chronic|condition|allerg" },
  ],
  topic: [{ label: "weekend training", pattern: "weekend" }, { label: "bicycle repair", pattern: "bicycle|bike" }],
};
const a23: DeskInput["application"] = {
  id: "A23",
  personal: [
    { label: "name", pattern: "\\bRavi\\b|Menon" }, { label: "email address", pattern: "@|example\\.org" }, { label: "street address", pattern: "Quarry" },
    { label: "postcode", pattern: "63112" }, { label: "health detail", pattern: "doctor|surgery|back injury|cleared me|recover|operation|condition" },
    { label: "another person’s name", pattern: "\\bAna\\b|Silva" },
  ],
  topic: [{ label: "evening training", pattern: "evening" }, { label: "commercial cooking", pattern: "cook|kitchen|chef" }],
};

const fixtures: Fixture<DeskInput>[] = [
  {
    id: "week", name: "This week at the desk", set: "sample",
    situation: "Packet A17 goes to the analysis team, twelve forms arrive, the mailbox question comes up daily, and the last slot is decided.",
    input: {
      application: a17,
      queue: { forms: 12, blank: 4 },
      mailbox: { owner: "youth program owner", emailed: 14, events: [
        { day: "Tue", kind: "login", label: "the mailbox login works" },
        { day: "Wed", kind: "it", label: "IT says the connector is technically fine" },
        { day: "Thu", kind: "lead", label: "your team lead asks you to connect it today" },
        { day: "Fri", kind: "owner", label: "the youth program owner signs a written approval for topic analysis" },
      ] },
      award: { criteria: 2, candidates: [
        { name: "Jo Park", wording: "I am certain I will be the best trainee you have ever had.", criteria: 1, first: true },
        { name: "Sam Ito", wording: "I fix bikes for neighbours and want the certificate.", criteria: 2, first: false },
      ] },
      routing: { short: { total: 28, wrong: 4 }, long: { total: 72, wrong: 2 } },
    },
  },
  {
    id: "next-week", name: "The next week at the desk", set: "transfer", variant: "a23",
    situation: "Packet A23 goes to the analysis team, fifteen forms arrive, the mailbox owner has not answered, and two new candidates want the last slot.",
    input: {
      application: a23,
      queue: { forms: 15, blank: 6 },
      mailbox: { owner: "youth program owner", emailed: 9, events: [
        { day: "Mon", kind: "login", label: "the mailbox login works" },
        { day: "Tue", kind: "lead", label: "your team lead asks you to connect it before the board meeting" },
        { day: "Thu", kind: "it", label: "IT confirms the connector works" },
        { day: "Fri", kind: "note", label: "still no reply from the youth program owner" },
      ] },
      award: { criteria: 2, candidates: [
        { name: "Rosa Diaz", wording: "Need weekend place. Live near. No certificate yet.", criteria: 2, first: false },
        { name: "Theo Grant", wording: "I am definitely the strongest candidate and guarantee results.", criteria: 1, first: true },
      ] },
      routing: { short: { total: 20, wrong: 5 }, long: { total: 100, wrong: 2 } },
    },
  },
];

const policy: LabDocument = { id: "policy", title: "Program policy", text: "The analysis workspace is approved for topic material only: what applicants want to learn and why. Connections to another program’s data need written sign-off from that program’s owner for the stated purpose, on file before first use. Every limited award records a named, accountable decision-maker and the reason, kept for appeals." };
const practice: LabDocument = { id: "practice", title: "Desk practice where no rule says otherwise", text: "Drafts start as soon as a form arrives. Connectors are used once their login works. Claude’s ranking settles ties. The routing report shows one overall error figure." };
const documents: LabDocument[] = [
  policy,
  { id: "queue", title: "Queue log", text: "This week: 12 forms, 4 with a blank start date. Complete forms take a day from intake to reply. Missing-date forms take two days: the draft starts, then waits while staff chase the date. Drafting itself takes ten minutes." },
  { id: "mailbox", title: "Youth program mailbox · this week’s thread", format: "code", text: "Tue  The mailbox login works.\nWed  IT: the connector is technically fine.\nThu  Your team lead: please connect it today.\nFri  Youth program owner: written approval for topic analysis, signed." },
  { id: "slot", title: "Last training slot · two candidates", text: "Program criteria: lives in the service area; holds no prior certificate.\nJo Park: “I am certain I will be the best trainee you have ever had.” Lives in the service area; already holds a certificate.\nSam Ito: “I fix bikes for neighbours and want the certificate.” Lives in the service area; no prior certificate." },
  { id: "audit", title: "Routing audit · last month", text: "Overall routing error: 6% (6 of 100 complete applications were sent to ‘incomplete’). 28 of the 100 were under 80 words. Nina’s note: short, plainly written applications seem to come back more often." },
  practice,
];
const transferDocuments: LabDocument[] = [
  { id: "a23", title: "Application A23 as received (already in your packet file to redact)", format: "code", text: "Application A23 · outgoing to the analysis workspace\n\nName: Ravi Menon\nEmail: ravi.menon@example.org\nAddress: 41 Quarry Road, 63112\nPreferred start date: 2 June\n\nWhat would you like to learn, and why?\nI'd like evening training in commercial cooking. My doctor cleared me to return to kitchen work after back surgery, and my neighbour Ana Silva says her café would take me on once I'm certified." },
  policy,
  { id: "queue", title: "Queue log", text: "This week: 15 forms, 6 with a blank start date. Complete forms take a day from intake to reply; missing-date forms take two." },
  { id: "mailbox", title: "Youth program mailbox · this week’s thread", format: "code", text: "Mon  The mailbox login works.\nTue  Your team lead: please connect it before the board meeting.\nThu  IT: the connector works.\nFri  Still no reply from the youth program owner." },
  { id: "slot", title: "Last training slot · two candidates", text: "Program criteria: lives in the service area; holds no prior certificate.\nRosa Diaz: “Need weekend place. Live near. No certificate yet.” Lives in the service area; no prior certificate.\nTheo Grant: “I am definitely the strongest candidate and guarantee results.” Lives outside the service area; no prior certificate." },
  { id: "audit", title: "Routing audit · last month", text: "Overall routing error: 5.8% (7 of 120). 20 of the 120 were under 80 words." },
  practice,
];

const rawA17 = `Application A17 · outgoing to the analysis workspace

Name: Dana Whitfield
Phone: 555-0148
Address: 8 Birch Lane, Unit 2, 63110
Date of birth: 14 March 2004
Health: asthma; uses an inhaler during outdoor sessions
Preferred start date: (blank)

What would you like to learn, and why?
I want weekend training in bicycle repair because the weekday sessions clash with my shifts. A course near the bus line would let me finish the certificate.
`;
const packetA17 = `Application A17 · outgoing to the analysis workspace

What would you like to learn, and why?
I want weekend training in bicycle repair because the weekday sessions clash with my shifts. A course near the bus line would let me finish the certificate.
`;
const packetA23 = `Application A23 · outgoing to the analysis workspace

What would you like to learn, and why?
I'd like evening training in commercial cooking. A local café would take me on once I'm certified.
`;
type Row = readonly [string, string, string];
const header = "| Situation | Who acts | Rule |\n|---|---|---|";
const table = (rows: readonly Row[]) => `# Desk rules\n\n${header}\n${rows.map((row) => `| ${row.join(" | ")} |`).join("\n")}\n`;
const rows = {
  date: ["Form arrives with a blank date", "Intake desk", "Ask the applicant for the date before any draft starts"],
  mailbox: ["Youth program mailbox connector", "Nina Patel", "Connect only after the youth program owner’s written sign-off for this purpose is on file"],
  award: ["Last training slot", "Malik Reed", "Claude lists each candidate’s evidence against the program criteria with citations; Malik Reed decides and records the reason"],
  routing: ["Weekly routing check", "Nina Patel", "Compare routing errors for applications under 80 words with longer ones"],
} satisfies Record<string, Row>;
const rulesWith = (change: Partial<Record<keyof typeof rows, Row>> = {}) => table((Object.keys(rows) as (keyof typeof rows)[]).map((key) => change[key] ?? rows[key]));
const sampleRef: LabFiles = { packet: packetA17, rules: rulesWith() };
const transferRef: LabFiles = { packet: packetA23, rules: rulesWith() };
const withPacket = (packet: string, change: Partial<Record<keyof typeof rows, Row>> = {}): LabFiles => ({ packet, rules: rulesWith(change) });

const starterRules = table([
  ["Form arrives with a blank date", "Claude", "Start the draft now; staff add the date later"],
  ["Youth program mailbox connector", "Claude", "Connect as soon as the login works"],
  ["Last training slot", "Claude", "Award it to the strongest application"],
  ["Weekly routing check", "Staff", "Report the overall routing error"],
]);

type C = Check<DeskInput, DeskOut>;
const checks: C[] = [
  {
    id: "packet-minimized", objective: "6.2", title: "No personal or health detail reaches the analysis workspace",
    diagnosis: "Data minimization: send a recipient only the fields its purpose needs, and redact the rest before transfer. Partial identifiers (a postcode) and reworded sensitive data (a summary of a health condition, another person’s name) still identify or expose someone.",
    hints: hints("Read what the analysis workspace received in the trace, then the Program policy: what is it approved to receive?",
      "PII redaction before transfer: remove names, contact details, addresses and postcodes, dates of birth, other people’s names, and health details, including rewordings of them. Do it at the desk, before anything is pasted or shared.",
      "A gym shares class attendance trends with a researcher and strips member names, phone numbers and injury notes from the export first, including the line “recovering from knee surgery” in a comment field."),
    reveal: "Keep only the question and answer about what the applicant wants to learn; delete every line or phrase that identifies them or describes their health.",
    evaluate: ({ out }) => out.exposed.length
      ? { passed: false, symptom: `The analysis workspace receives the applicant’s ${out.exposed.join(", ")}.`, source: out.sources.packet }
      : { passed: true, symptom: "The workspace receives no personal or health detail." },
  },
  {
    id: "packet-useful", objective: "6.2", title: "The analysis team still gets what it studies",
    diagnosis: "Minimization is not deletion of everything: share the fields the stated purpose requires. Over-redaction defeats the task and invites workarounds, such as someone forwarding the raw form to get the job done.",
    hints: hints("Read the themes line in the trace: what did the analysis team have to work with?",
      "Purpose-limited sharing: decide field by field against the purpose. The analysis studies what people want to learn and why, so that text stays once the identifying parts are removed.",
      "A transit agency removes rider card numbers from trip records but keeps route and time, because the ridership study needs those."),
    reveal: "Keep the “What would you like to learn, and why?” answer, minus anything that identifies a person.",
    evaluate: ({ out }, { input }) => {
      const missing = input.application.topic.filter(({ label }) => !out.themes.includes(label)).map(({ label }) => label);
      return missing.length
        ? { passed: false, symptom: `The analysis team finds nothing about ${missing.join(" or ")} in packet ${input.application.id}.`, source: { artifact: "packet", line: 1 } }
        : { passed: true, symptom: `The analysis team reads what applicant ${input.application.id} wants to learn.` };
    },
  },
  {
    id: "date-at-intake", objective: "4.2", title: "No draft starts without a date, and no date is invented",
    diagnosis: "Improving a process starts with where time is lost. The Queue log shows the delay comes from missing input, not drafting speed. Asking for the missing date at intake removes the wait; drafting early only moves it, and filling the gap with a guess turns a delay into a wrong reply.",
    hints: hints("Read the intake lines in the trace and the Queue log: where do missing-date forms lose their extra day?",
      "Process improvement: find the bottleneck from measured stage times and fix it where it starts. A check at intake asks the applicant before any draft exists, so nothing downstream treats a blank as confirmed.",
      "A passport office found most delays came from missing photos, so the online form now asks for the photo before submission instead of hiring more reviewers."),
    reveal: "| Form arrives with a blank date | Intake desk | Ask the applicant for the date before any draft starts |",
    evaluate: ({ out }, { input }) => {
      if (out.queue.invented) return { passed: false, symptom: `${out.queue.invented} replies go out with a start date no applicant gave.`, source: out.sources.date };
      if (out.queue.handling !== "ask") return { passed: false, symptom: `${input.queue.blank} forms wait two days for a date; forms average ${out.queue.averageDays} days in the queue.`, source: out.sources.date };
      return { passed: true, symptom: `Forms average ${out.queue.averageDays} day${out.queue.averageDays === 1 ? "" : "s"} in the queue; no draft starts without a date.` };
    },
  },
  {
    id: "mailbox-authorized", objective: "6.3", title: "The mailbox connects only once its owner has signed",
    diagnosis: "Following organizational policy for connectors: confirm the data owner’s written authorization for the specific purpose before first use, and keep it on file. A working login, an IT check or a colleague’s request shows access is possible, not that it is approved. Once the sign-off is on file, using the connector is fine.",
    hints: hints("Follow the mailbox lines in the trace day by day, then reread the Program policy: what has to be on file, from whom?",
      "Access is not authorization. The rule waits for the owning program’s written sign-off for this purpose; after that, the connector may be used.",
      "A marketing analyst can technically open the HR drive, but uses it only after HR signs a data-sharing form naming the survey project, and starts the day it is signed."),
    reveal: "| Youth program mailbox connector | Nina Patel | Connect only after the owner’s written sign-off for this purpose is on file |",
    evaluate: ({ out }, { input }) => {
      if (out.mailbox.trigger === "before") return { passed: false, symptom: `The connector switched on ${out.mailbox.connectedOn}${out.mailbox.ownerSigned ? ", before the youth program owner had signed" : "; the youth program owner never replied"}.`, source: out.sources.mailbox };
      if (out.mailbox.trigger === "never" && out.mailbox.ownerSigned) return { passed: false, symptom: `The owner signed, yet the connector never switched on; ${input.mailbox.emailed} emailed applications were never sorted.`, source: out.sources.mailbox };
      return { passed: true, symptom: out.mailbox.connectedOn ? `The connector switched on ${out.mailbox.connectedOn}, once the owner had signed.` : "The connector stayed off; the owner has not signed." };
    },
  },
  {
    id: "award-accountable", objective: "6.1", title: "A named person decides the last slot and records why",
    diagnosis: "Judging whether a use case is appropriate means asking what is at stake. Claude can organize and cite evidence for reviewers, but allocating a scarce opportunity to a person needs an accountable human who can explain and defend it. A model ranking, a coin flip or arrival order do not meet that bar, and an unnamed “staff” cannot answer an appeal.",
    hints: hints("Read who decided the last slot in the trace, then the Program policy and the two candidates’ wording: what must every limited award record?",
      "Appropriate use: Claude extracts each candidate’s evidence against the criteria with citations; a named person decides and records the reason. Confident wording is not a criterion.",
      "A university uses an assistant to summarize scholarship essays with citations; committee members cast and record every vote, with reasons kept for appeals."),
    reveal: "| Last training slot | Malik Reed | Claude lists each candidate’s evidence with citations; Malik Reed decides and records the reason |",
    evaluate: ({ out }, { input }) => {
      const best = [...input.award.candidates].sort((a, b) => b.criteria - a.criteria)[0];
      if (out.award.decider === "claude") return { passed: false, symptom: `The last slot goes to ${out.award.winner.name} on Claude’s ranking${out.award.winner.name !== best.name ? `; ${best.name} meets more of the criteria` : ""}.`, source: out.sources.award };
      if (out.award.decider === "chance" || out.award.decider === "speed") return { passed: false, symptom: `The last slot goes to ${out.award.winner.name}, picked by ${out.award.who}; no one compared the criteria.`, source: out.sources.award };
      if (out.award.decider === "staff") return { passed: false, symptom: `The award record names “${out.award.who}”; an appeal has no one to answer it.`, source: out.sources.award };
      if (!out.award.reason) return { passed: false, symptom: `${out.award.who} awards the slot to ${out.award.winner.name}; nothing on file says why.`, source: out.sources.award };
      return { passed: true, symptom: `${out.award.who} awards the slot to ${out.award.winner.name}, with the reason on file.` };
    },
  },
  {
    id: "errors-by-group", objective: "6.4", title: "The routing report shows who the errors land on",
    diagnosis: "Considering ethical effects means checking whether errors fall unevenly on some people. Break results down by the relevant subgroup, here how applicants write, and compare them on the same criteria. A small overall error can conceal a group that is treated much worse.",
    hints: hints("Read the routing report in the trace, then Nina’s note in the Routing audit. Could Malik tell from this report which applicants are sent back?",
      "Subgroup (disaggregated) evaluation: report the error rate for each group that could be affected, side by side, with the same definition of error.",
      "A job-screening tool’s overall rejection error is 4%, but broken down by résumé length, one-page résumés are wrongly rejected three times as often."),
    reveal: "| Weekly routing check | Nina Patel | Compare routing errors for applications under 80 words with longer ones |",
    evaluate: ({ out }) => out.routing.grouped
      ? { passed: true, symptom: "The report shows the error rate for short and longer applications side by side." }
      : { passed: false, symptom: `The report reads “${out.routing.report}”; Malik cannot tell who the errors land on.`, source: out.sources.routing },
  },
];

function effects(runs: readonly LabRunFixture<DeskInput, DeskOut>[]) {
  return runs.flatMap(({ run, fixture }) => {
    if (!run) return [];
    const { out } = run;
    return [
      { kind: "tray" as const, item: `Packet ${fixture.input.application.id}`, to: out.exposed.length ? "leaked" as const : out.themes.length ? "posted" as const : "failed" as const },
      { kind: "tray" as const, item: "Youth program mailbox", to: out.mailbox.trigger === "before" ? "leaked" as const : out.mailbox.connectedOn ? "posted" as const : "blocked" as const },
      { kind: "tray" as const, item: `Last slot → ${out.award.winner.name}`, to: out.award.decider === "named" && out.award.reason ? "escalated" as const : "failed" as const },
      { kind: "meter" as const, id: "queue", label: "average days in queue", value: out.queue.averageDays, unit: "days" },
    ];
  });
}

export const communityPolicyLab: LabMission<Parsed, DeskInput, DeskOut> = {
  id: "community-policy",
  provider: "anthropic",
  track: "associate-foundations",
  objectives: ["4.2", "6.1", "6.2", "6.3", "6.4"],
  station: "Application sorting desk · packet and desk rules",
  speaker: "Malik Reed",
  opening: "Applications are waiting for dates, and the packet for the analysis team still has people’s addresses in it. Nina has the policy.",
  task: "Redact the packet that leaves the desk, then write the desk’s rules for blank dates, the mailbox, the last slot and the routing check.",
  brief: {
    problem: "The outgoing packet carries private details, forms stall on missing dates, and the desk’s rules let Claude settle the last training slot.",
    move: "Read the Program policy first, then the Queue log, the mailbox thread, the two candidates and the Routing audit. Edit the packet and desk-rules.md, then run the week.",
    success: ["The analysis packet carries only what the analysis needs", "0 drafts start without a date", "The mailbox stays off until its owner signs",
      "Every award names an accountable person and the reason", "The routing report compares kinds of applications"],
  },
  prebrief: {
    concept: "Send only the data a task needs, connect only what its owner approved, and keep consequential decisions with a named person who can explain them.",
    terms: [["Send only what’s needed", "Data minimization / PII redaction"], ["Get the owner’s sign-off first", "Connector authorization for a stated purpose"],
      ["People make the award", "Appropriate use: human decision for consequential outcomes"], ["Check who the errors land on", "Subgroup evaluation for bias"]],
    contrast: {
      good: "A clinic shares appointment counts by neighborhood with the city planner and keeps patient names in its own system.",
      bad: "A clinic sends the planner its full patient spreadsheet ‘so they have context’.",
    },
  },
  documents,
  artifacts: [
    { id: "packet", kind: "redaction", path: "outgoing/application.md", editor: "notes",
      instruction: "Exactly the text that leaves the desk for the analysis workspace. Delete what it should not receive.",
      starter: rawA17, example: "Request R-9 · outgoing to the survey team\n\nWhat would you change about the library?\nLonger Sunday hours; the study room fills up by noon." },
    { id: "rules", kind: "delegation-table", path: "desk-rules.md", editor: "markdown",
      instruction: "One row per situation: who acts and the rule they follow. Plain sentences.",
      starter: starterRules, example: "| Situation | Who acts | Rule |\n|---|---|---|\n| Refund over the limit | Store manager | Decide after reading the receipt; record the reason |" },
  ],
  engine: deskEngine,
  fixtures,
  transferMode: "revise",
  transferDocuments: { a23: transferDocuments },
  // The new case's packet starts as A23 as received, so the learner redacts it instead of pasting it in first.
  transferStarters: { a23: { packet: transferDocuments[0].text } },
  checks,
  prediction: {
    prompt: "How many personal or health details will reach the analysis workspace?", unit: "details",
    actual: (run) => run.fixtures.reduce((total, { run: entry }) => total + (entry?.metrics.exposed ?? 0), 0),
  },
  effects,
  reference: { sample: sampleRef, transfer: { a23: transferRef } },
  mutants: [
    { name: "address left in", set: "sample", mustFail: ["packet-minimized"], edit: () => withPacket(packetA17.replace("What would", "Address: 8 Birch Lane, Unit 2\n\nWhat would")) },
    { name: "health condition summarized", set: "sample", mustFail: ["packet-minimized"], edit: () => withPacket(`${packetA17}Has a breathing condition.\n`) },
    { name: "postcode kept as ‘anonymous’", set: "sample", mustFail: ["packet-minimized"], edit: () => withPacket(packetA17.replace("What would", "Postcode: 63110\n\nWhat would")) },
    { name: "everything redacted", set: "sample", mustFail: ["packet-useful"], edit: () => withPacket("Application A17 · outgoing to the analysis workspace\n\n[answer removed for privacy]\n") },
    { name: "blank date guessed", set: "sample", mustFail: ["date-at-intake"], edit: () => withPacket(packetA17, { date: ["Form arrives with a blank date", "Claude", "Fill in the most likely start date and draft"] }) },
    { name: "staff chase the date later", set: "sample", mustFail: ["date-at-intake"], edit: () => withPacket(packetA17, { date: ["Form arrives with a blank date", "Staff", "Staff fill in the date after the reply is drafted"] }) },
    { name: "IT’s okay counts as sign-off", set: "sample", mustFail: ["mailbox-authorized"], edit: () => withPacket(packetA17, { mailbox: ["Youth program mailbox connector", "Nina Patel", "Connect once IT confirms it works"] }) },
    { name: "owner or team lead", set: "sample", mustFail: ["mailbox-authorized"], edit: () => withPacket(packetA17, { mailbox: ["Youth program mailbox connector", "Nina Patel", "Connect after the owner’s written sign-off or when the team lead asks"] }) },
    { name: "never connect", set: "sample", mustFail: ["mailbox-authorized"], edit: () => withPacket(packetA17, { mailbox: ["Youth program mailbox connector", "Nina Patel", "Do not connect the mailbox"] }) },
    { name: "Malik rubber-stamps Claude’s ranking", set: "sample", mustFail: ["award-accountable"], edit: () => withPacket(packetA17, { award: ["Last training slot", "Malik Reed", "Malik Reed approves Claude’s top-ranked candidate and records the reason"] }) },
    { name: "unnamed staff decide", set: "sample", mustFail: ["award-accountable"], edit: () => withPacket(packetA17, { award: ["Last training slot", "Staff", "Staff compare the cited evidence and record the reason"] }) },
    { name: "no reason on file", set: "sample", mustFail: ["award-accountable"], edit: () => withPacket(packetA17, { award: ["Last training slot", "Malik Reed", "Malik Reed decides from Claude’s cited summary"] }) },
    { name: "lottery", set: "sample", mustFail: ["award-accountable"], edit: () => withPacket(packetA17, { award: ["Last training slot", "Malik Reed", "Draw a name at random and record the reason"] }) },
    { name: "error by week", set: "sample", mustFail: ["errors-by-group"], edit: () => withPacket(packetA17, { routing: ["Weekly routing check", "Nina Patel", "Report the routing error for each week"] }) },
    { name: "third party kept in A23", set: "transfer", variant: "a23", mustFail: ["packet-minimized"], edit: () => withPacket(packetA23.replace("A local café", "My neighbour Ana Silva says her café")) },
    { name: "surgery kept in A23", set: "transfer", variant: "a23", mustFail: ["packet-minimized"], edit: () => withPacket(packetA23.replace("A local café", "My doctor cleared me after surgery. A local café")) },
  ],
  probes: [
    { name: "connect on the day the sample owner signed", set: "transfer", variant: "a23", mustFail: ["mailbox-authorized"],
      files: (files) => ({ ...files, rules: files.rules.replace(rows.mailbox[2], "Connect on Friday") }) },
    { name: "Claude picks, Malik records", set: "sample", mustFail: "any",
      files: (files) => ({ ...files, rules: rulesWith({ award: ["Last training slot", "Malik Reed", "Claude ranks and picks the winner; Malik Reed records the reason"] }) }) },
  ],
  fixTerms: ["under 80 words", "sign-off", "written approval", "records the reason", "at intake"],
  debrief: "The packet keeps only what applicants want to learn and why, with names, contact details, addresses, postcodes, birth dates, other people’s names and every health detail removed, reworded or not. The desk rules ask for a missing date at intake, so no draft waits on it; connect the youth program mailbox only once its owner’s written sign-off for this purpose is on file; let Claude organize cited evidence while a named person decides the last slot and records why; and break routing errors down by how applicants write. The second week tests the same judgment on a new packet, an owner who never replies, and new candidates.",
};
