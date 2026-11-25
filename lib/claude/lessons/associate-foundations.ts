import type { LessonBlock, LessonSet } from "./types";

// Claude Certified Associate – Foundations (CCAO-F), exam guide v1.1 effective December 7, 2026.
// Product behavior was checked against the official pages listed in each lesson's `sources`.

const text = (value: string): LessonBlock => ({ kind: "text", text: value });
const code = (language: "markdown" | "text", caption: string, value: string): LessonBlock => ({ kind: "code", language, caption, code: value });
const list = (...items: string[]): LessonBlock => ({ kind: "list", items });
const table = (headers: string[], rows: string[][]): LessonBlock => ({ kind: "table", headers, rows });
const exam = (title: string, value: string): LessonBlock => ({ kind: "callout", tone: "exam", title, text: value });
const pitfall = (title: string, value: string): LessonBlock => ({ kind: "callout", tone: "pitfall", title, text: value });
const tip = (title: string, value: string): LessonBlock => ({ kind: "callout", tone: "tip", title, text: value });

const guide = ["CCAO-F exam guide v1.1 (December 7, 2026)", "https://cc.sj-cdn.net/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1794946609/Claude_Certified_Associate_-_Foundations_Exam_Guide_Updated_Dec_7.pdf"] as const;
const fluency = ["The AI Fluency Framework (Anthropic, Dakan and Feller)", "https://www-cdn.anthropic.com/334975cdec18f744b4fa511dc8518bd8d119d29d.pdf"] as const;
const prompting = ["Prompting best practices", "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices"] as const;
const projects = ["What are projects?", "https://support.claude.com/en/articles/9517075"] as const;
const manageProjects = ["How can I create and manage projects?", "https://support.claude.com/en/articles/9519177"] as const;
const memory = ["Use Claude's chat search and memory", "https://support.claude.com/en/articles/11817273"] as const;
const incognito = ["Use incognito chats", "https://support.claude.com/en/articles/12260368"] as const;
const skills = ["Use Skills in Claude", "https://support.claude.com/en/articles/12512180"] as const;
const files = ["Create and edit files with Claude", "https://support.claude.com/en/articles/12111783"] as const;
const research = ["Use research on Claude", "https://support.claude.com/en/articles/11088861"] as const;
const workspace = ["Use Google Workspace connectors", "https://support.claude.com/en/articles/10166901"] as const;
const customConnectors = ["Get started with custom connectors using remote MCP", "https://support.claude.com/en/articles/11175166"] as const;
const models = ["Change the model, effort and thinking settings", "https://support.claude.com/en/articles/8664678"] as const;
const choosing = ["Choosing the right model", "https://platform.claude.com/docs/en/about-claude/models/choosing-a-model"] as const;
const personalization = ["Understanding Claude's personalization features", "https://support.claude.com/en/articles/10185728"] as const;
const artifacts = ["What are artifacts and how do I use them?", "https://support.claude.com/en/articles/9487310"] as const;
const contextWindow = ["Context window and automatic context management", "https://support.claude.com/en/articles/8606394"] as const;
const aup = ["Anthropic Usage Policy", "https://www.anthropic.com/legal/aup"] as const;
const consumerTraining = ["Model improvement privacy settings (consumer plans)", "https://privacy.claude.com/en/articles/12109829"] as const;
const commercialTraining = ["Is my data used for model training? (commercial)", "https://privacy.claude.com/en/articles/7996868"] as const;

export const associateFoundationsLessons: LessonSet = {
  overview: "CCAO-F tests whether you can use Claude as a dependable work tool, not whether you remember menus or numbers. Expect 70 scenario-based multiple-choice items in 120 minutes: 60 are scored and 10 are unscored pilot items you cannot identify, so treat every item as if it counts. Each item states how many responses to select; read that first. The pass mark is a scaled 720 on a 100–1,000 scale. Items reward judgment over recall — which revision fixes the real prompt gap, what to verify before a brief goes out, which Project layer caused a regression — and never ask for prices, context-window sizes or rate limits. All six domains rest on Anthropic's AI Fluency framework and its 4D competencies: Delegation, Description, Discernment and Diligence.",
  lessons: [
    {
      objective: "1.1",
      title: "Construct a task prompt that is fit for purpose on the first try",
      takeaway: "A strong first prompt hands Claude the things it cannot know on its own — who the output is for, why it exists, what it must respect, what source to use, and what shape to return — in clearly separated sections.",
      minutes: 4,
      blocks: [
        text("Prompt construction is the Description competency of the AI Fluency framework in action. Anthropic's framework defines Description as effectively describing goals to prompt useful AI behaviors and outputs. On the exam, a task prompt is judged by one test: would the first response be usable for the stated purpose, or would it need a round of guesswork to repair? Fluent-sounding but generic output is almost always a description problem, not a model problem."),
        text("Start from the gap between what you know and what Claude knows. Claude does not see your organization, your audience, last quarter's decision, your house terminology, or the document sitting on your desktop unless you supply it. Anthropic's prompting guidance offers a useful check: show the prompt to a colleague with minimal context on the task; if they would be confused, Claude will be too."),
        table(["Element", "What it supplies", "Symptom when it is missing"], [
          ["Role", "The perspective and expertise to adopt", "Advice pitched at the wrong level"],
          ["Context and purpose", "Why the work exists and what decision it supports", "Accurate but beside the point"],
          ["Audience", "Who reads it and what they already know", "Jargon for executives, or basics for experts"],
          ["Task", "The specific action: draft, compare, extract, critique", "Claude picks its own interpretation"],
          ["Constraints", "Length, tone, must-include, must-avoid, deadline facts", "Output that breaks a rule you never stated"],
          ["Source material", "The documents or data Claude should rely on", "Plausible content invented from general knowledge"],
          ["Output format", "Sections, table, bullet limit, file type", "Reformatting work after every response"],
        ]),
        code("markdown", "Before: a request that leaves Claude guessing", `Write an update about the office move for staff.`),
        code("markdown", "After: the same request with role, context, audience, constraints, source and format", `You are an internal communications lead at a 180-person nonprofit.

<context>
We move from the Elm Street office to the Harbor Building on March 2.
Staff are anxious about parking and the longer commute for the south team.
Leadership has approved a transit subsidy (details in the FAQ below).
</context>

<source>
[paste the facilities FAQ here]
</source>

<task>
Draft the all-staff email announcing the move date and what changes for staff.
Use only facts from the <source> section. If something staff will ask about
is not covered there, list it under "Open questions" instead of answering it.
</task>

<format>
- Subject line under 60 characters
- 3 short paragraphs, plain and warm, no corporate filler
- A bulleted "What you need to do" list with dates
- Then a separate "Open questions" list for me (not part of the email)
</format>`),
        text("Notice the techniques in the revision, all drawn from Anthropic's prompting best practices. XML-style tags separate instructions from context and source text, which reduces the chance that Claude treats pasted material as instructions. Long source material goes near the top, with the task after it. The prompt explains why (anxious staff), which helps Claude choose emphasis. It tells Claude what to do instead of only what not to do. And it gives an explicit route for missing information, so the draft does not fill gaps with invented specifics."),
        text("Examples are the other powerful lever. If tone or structure matters, paste one or two past emails you liked inside example tags and say what to copy from them (structure, voice) and what not to copy (dates, names). Anthropic's guidance notes that well-chosen examples are one of the most reliable ways to steer format and tone."),
        exam("How the exam frames prompt construction", "When a scenario shows a generic or off-target first response, the best answer adds the specific missing information — audience, purpose, source, constraint, or format. Distractors usually ask Claude to 'be more detailed', switch to a bigger model, or add a role while leaving the real gap open. A role alone does not tell Claude who the reader is or which facts are authoritative."),
        pitfall("Padding is not specification", "Long prompts are not automatically good prompts. Three paragraphs of persona and enthusiasm with no audience, source or format still produce generic work. Every sentence in a prompt should change what a good answer looks like; if deleting it would not change the output, it is noise."),
        tip("Name the deliverable's destination", "Saying where the output will be used — pasted into an email, read aloud in a meeting, imported into a spreadsheet — quietly settles many format questions at once."),
      ],
      terms: ["AI Fluency framework", "Description", "XML tags", "examples", "role", "output format", "source material"],
      sources: [guide, fluency, prompting],
    },
    {
      objective: "1.2",
      title: "Decompose and sequence work that is too big for one request",
      takeaway: "Break large or mixed deliverables into stages that each have one job and a checkpoint, and match the prompting strategy to the kind of work in each stage.",
      minutes: 4,
      blocks: [
        text("Some deliverables are too large or too mixed for a single request: a quarterly business review, a training curriculum, a vendor comparison with a recommendation. One giant prompt produces a response that is shallow everywhere, hides errors in the middle, and is hard to correct without regenerating everything. Decomposition splits the work into staged prompts where each stage has a clear input, a clear output, and a moment for you to check it before the next stage depends on it."),
        text("Anthropic's prompting guidance calls this prompt chaining: the output of one step becomes the input of the next. For a knowledge worker in claude.ai, the chain can live in one conversation with follow-ups, across several chats inside a Project that shares knowledge and instructions, or as a mix of chat, Research, and code-executed analysis. The design question is always the same: where would an early mistake silently spread into everything after it? Put a validation checkpoint there."),
        code("text", "A staged plan for a vendor-comparison deliverable", `Stage 1  Requirements      Chat: turn stakeholder notes into a criteria list with weights.
         CHECKPOINT        Sponsor confirms criteria before any research starts.
Stage 2  Evidence          Research: gather vendor facts with cited sources.
         CHECKPOINT        I open every cited source used for a scored criterion.
Stage 3  Scoring           Code-executed analysis on a scoring sheet I upload.
         CHECKPOINT        Spot-check two vendors' totals against the sheet.
Stage 4  Recommendation    Chat: draft a 1-page memo from the verified scores only.
         CHECKPOINT        Procurement lead reviews before it goes to the committee.`),
        text("Each kind of work wants a different prompting strategy, and mixing them in one request is a common reason output disappoints. The exam guide calls this prompting-strategy differences by task type."),
        table(["Task type", "Strategy that works", "Checkpoint to add"], [
          ["Generative (drafts, ideas, messaging)", "Give audience, purpose, tone examples; ask for options to choose from", "You pick a direction before Claude polishes"],
          ["Analytical (compare, critique, prioritize)", "State criteria and weights explicitly; ask for reasoning per criterion", "Confirm criteria first; challenge the weakest rating"],
          ["Extraction and summarization", "Point to the exact source; ask for quotes before conclusions", "Compare a sample of extracted items with the source"],
          ["Research across sources", "Use Research with a scoped question; ask for citations", "Open the sources behind any claim you will rely on"],
          ["Computation on data", "Use code execution so numbers are calculated, not estimated", "Reconcile one total against a figure you already trust"],
        ]),
        text("Sequencing also means knowing when a step belongs to you. Agreeing criteria with a sponsor, choosing between two creative directions, or deciding which risk the organization accepts are human decisions; Claude can prepare options for them but should not quietly make them inside a longer chain."),
        text("Projects make multi-step work easier to resume. Uploading the agreed criteria or the verified evidence table to Project knowledge means later chats start from the checked version rather than from a long, drifting thread. That is also how you hand a half-finished deliverable to a colleague without losing context."),
        exam("Spot the missing checkpoint", "Scenarios often describe a chain that went wrong late (a recommendation built on a misread requirement or an unverified statistic). The best answer usually inserts a validation step at the point where the error entered, not a better final prompt or a full regeneration. Ask: which step's output did every later step trust without checking?"),
        pitfall("The mega-prompt", "Asking for research, analysis, recommendations, and a formatted slide outline in one message feels efficient but makes every part shallow and leaves no place to catch errors. If a deliverable has more than one kind of thinking in it, it has more than one stage."),
        pitfall("Chaining without verifying", "Splitting work into steps only helps if you inspect the hand-offs. A chain that passes unchecked output from step to step simply moves the error further from where it can be found."),
      ],
      terms: ["Delegation", "Description", "prompt chaining", "Projects", "Research", "code execution", "validation checkpoint"],
      sources: [guide, prompting, research, manageProjects],
    },
    {
      objective: "1.3",
      title: "Diagnose an underperforming prompt and decide whether to iterate, restart, or change approach",
      takeaway: "Attribute a weak output to the specific gap in the prompt — missing context, ambiguous instruction, absent constraint, or wrong strategy — and fix that gap; restart with a consolidated prompt when the thread itself has become the problem.",
      minutes: 3,
      blocks: [
        text("When an output disappoints, the reflex is to type 'make it better' or try another model. Fluent users diagnose first. The exam guide names four specification gaps, and almost every weak response traces to one of them. Diagnosis is where Discernment (judging the output) feeds back into Description (improving the request) — the AI Fluency framework treats these competencies as interconnected, and this loop is where that shows."),
        table(["Gap", "Typical symptom", "Targeted fix"], [
          ["Missing context", "Generic, could apply to any company or reader", "Add audience, purpose, organization facts, or the source document"],
          ["Ambiguous instruction", "Claude did something reasonable but not what you meant", "Replace vague verbs ('review', 'improve') with the concrete action and criteria"],
          ["Absent constraint", "Too long, wrong tone, includes forbidden content, misses a must-have", "State the limit or requirement explicitly, ideally with the reason"],
          ["Wrong strategy for the task type", "Numbers that do not add up, research without sources, one draft where options were needed", "Change approach: code execution for math, Research for sourced facts, staged prompts for big work"],
        ]),
        code("markdown", "Worked diagnosis: a training outline that came back generic", `Prompt used:   "Create a training outline on our new expense policy."
Output:        A tidy outline on expense policies in general — receipts,
               approvals, per diems — none of it specific to us.

Diagnosis:     Missing context. Claude never saw the new policy and does
               not know what changed or who attends.

Revised prompt:
<policy>[paste the new expense policy]</policy>
<changes>The three changes from the old policy are: ... </changes>
<audience>Field sales reps who submit expenses from a phone.</audience>
<task>
Build a 30-minute training outline focused only on what changed.
For each section, cite the policy clause it is based on.
</task>
<format>Table: section | minutes | key message | policy clause</format>`),
        text("After diagnosing the gap, decide how to act on it. There are three moves, and the right one depends on the state of the conversation as well as the prompt."),
        list(
          "Iterate in the same chat when the response is mostly right and the fix is local: one constraint, one section, one tone adjustment. Say exactly what to keep and what to change.",
          "Restart in a new chat with a consolidated prompt when the thread has accumulated contradictory corrections, an early misunderstanding keeps resurfacing, or you have changed your mind about the goal. Carry over the decisions, not the debris.",
          "Change approach when the gap is strategic: the task needs exact calculation, cited research, a reusable Project, or a human decision that no prompt can make.",
        ),
        code("markdown", "A restart prompt that consolidates what a messy thread learned", `I'm restarting a task from another chat. Here is everything that was settled:

<goal>One-page FAQ for parents about the new school-bus routes.</goal>
<decisions>
- Reading level: grade 6. No transport jargon.
- Lead with the three routes whose stop times changed.
- Do not mention the contract dispute.
</decisions>
<source>[paste route table]</source>
<task>Write the FAQ. Use only the route table for times.</task>`),
        exam("Attribute, then act", "Items typically show a prompt and its output and ask which revision would most improve the result. Eliminate options that do not touch the identified gap: a more capable model will not invent your audience, and repeating 'be specific' does not add a constraint. Pick the option that supplies the missing element or switches to the right strategy."),
        pitfall("Correcting in circles", "Five rounds of 'no, shorter', 'no, more formal', 'no, add the budget' inside one long thread can leave Claude balancing conflicting signals. When you notice you are re-stating corrections, stop and write one clean prompt that includes all the decisions so far."),
        tip("Ask Claude to diagnose with you", "Pasting the prompt and the output and asking Claude what information it was missing is a fast way to surface gaps — but you still decide which gap matters for the purpose."),
      ],
      terms: ["Discernment", "Description", "specification gap", "iterate", "restart", "consolidated prompt"],
      sources: [guide, fluency, prompting],
    },
    {
      objective: "2.1",
      title: "Evaluate whether an output is fit for its purpose",
      takeaway: "Judge an output against its requirements, its source material and the professional standard for its use — not against how polished it reads — and classify it as ready to use, needs revision, or needs human correction.",
      minutes: 4,
      blocks: [
        text("Discernment, in Anthropic's AI Fluency framework, is accurately assessing the usefulness of AI outputs and behaviors. Domain 2 is the largest on the exam because this is where accountability lives: Claude drafts, but you decide whether the draft can be used. The guide frames the evaluation around four qualities — accuracy, completeness, relevance and fitness for purpose — and ends with a classification decision."),
        table(["Quality", "Question to ask", "Compare against"], [
          ["Accuracy", "Is every fact, figure, name and date correct?", "The source material or an authoritative reference"],
          ["Completeness", "Did it cover every required element and the obvious follow-up questions?", "The original request and the requirements list"],
          ["Relevance", "Is everything here useful to this reader, or is some of it filler?", "The audience and purpose you specified"],
          ["Fitness for purpose", "Could this be used, as is, for its intended job and channel?", "The professional standard for that deliverable"],
        ]),
        text("Fitness for purpose is the quality that ties the others together. A meeting summary can be accurate and complete yet unfit because it buries the three decisions under a narrative recap. A policy explainer can be relevant and well written yet unfit because it paraphrases a legal clause in a way the policy owner would not sign off on. The standard comes from the use: what would a careful professional in your role expect before this goes out?"),
        code("text", "A reusable fitness checklist to run before using any output", `REQUIREMENTS   [ ] Every item in my original request is addressed
               [ ] Constraints respected (length, tone, exclusions)
SOURCE         [ ] Facts, figures and names match the source documents
               [ ] Nothing important from the source is missing or distorted
AUDIENCE       [ ] Reading level and terminology fit the reader
               [ ] Nothing here would confuse, mislead or offend them
STANDARD       [ ] A competent colleague in my role would accept this
               [ ] I could explain and defend every claim if asked
DECISION       Ready to use / Needs revision / Needs human correction`),
        text("The classification matters because each outcome leads to a different next step."),
        table(["Classification", "What it means", "Next step"], [
          ["Ready to use", "Meets requirements, matches sources, fits the standard", "Use it; you remain accountable for it"],
          ["Requires revision", "Sound foundation with fixable gaps in content, tone or format", "Iterate with Claude using a targeted follow-up"],
          ["Requires human correction", "Errors in judgment, specialist content, or facts Claude cannot verify", "A person with the right expertise or access fixes it directly"],
        ]),
        text("'Requires human correction' is not a failure of the tool; it is the correct call when the fix depends on knowledge Claude does not have — an internal decision that was never written down, a legal interpretation, a number only finance holds — or when the risk of the deliverable means a person must own the wording. Iterating with Claude on such gaps tends to produce more confident text, not more correct text."),
        exam("Requirements first, polish last", "Answer options that praise structure, fluency or confidence are usually distractors. The best answer compares the output with the stated requirements or source and makes a classification that matches the evidence. If an option says the output is ready because it 'reads professionally', look for the one that checks it against something."),
        pitfall("Fluency bias", "Well-formatted, confident prose triggers trust. The output's polish tells you that Claude writes well; it tells you nothing about whether a specific figure came from your spreadsheet or whether a required section is missing. Check the substance before you admire the form."),
        tip("Keep the brief beside the draft", "Evaluate with your original prompt open. It is far easier to spot a missing requirement when the list of requirements is in front of you."),
      ],
      terms: ["Discernment", "fitness for purpose", "ready to use", "requires revision", "requires human correction"],
      sources: [guide, fluency],
    },
    {
      objective: "2.2",
      title: "Detect and verify unsupported content before you use it",
      takeaway: "Treat precise specifics, citations, quotations and one-sided framing as claims to check, and verify them independently against the source or an authoritative reference — never by asking Claude to vouch for its own output.",
      minutes: 3,
      blocks: [
        text("Large language models can produce content that sounds authoritative but is not supported by any source: a statistic with a plausible decimal place, a citation to a report that does not exist, a quotation a real person never said. The exam guide groups unsupported content into four patterns — fabricated citations, confident invented specifics, inconsistencies, and bias — and expects you to know the verification technique that fits each."),
        table(["Red flag", "What it looks like", "Verification technique"], [
          ["Fabricated or mismatched citation", "A named analyst firm, report title or URL attached to a figure", "Open the cited source; confirm it exists and says what is claimed"],
          ["Confident invented specifics", "Exact percentages, dates, dollar amounts, quotes, names not in your inputs", "Trace each specific to your uploaded source or an authoritative reference"],
          ["Inconsistency", "A number in the summary differs from the table; a date conflicts with another section", "Reconcile within the document, then against the source"],
          ["Bias", "One-sided framing, stereotyped examples, missing perspectives, loaded language", "Ask who is missing or misrepresented; compare with balanced sources; get a second human reader"],
        ]),
        text("The guide's own sample question shows the core pattern. A competitive brief contains market-share percentages with named analyst citations and a CEO quotation, and the manager has not opened the source PDFs. The right action is to check each figure and the quotation against the PDFs or an authoritative source and remove or flag anything that cannot be confirmed. Asking Claude to confirm its own figures is not independent confirmation; deleting every number throws away real value without separating supported claims from unsupported ones."),
        code("markdown", "A grounding prompt that makes verification easier", `<documents>
[paste or attach the two research reports]
</documents>

<task>
Before writing the brief, extract every statistic and quotation you plan
to use into a table with: claim | exact quote from the documents | document
name | page or section. If a claim is not in the documents, do not use it.
Then write the brief using only claims from that table.
</task>`),
        text("Anthropic's prompting guidance recommends this approach for long-document work: ask Claude to pull the relevant quotes first and then base its answer on them. It does not replace your check, but it turns verification into a quick comparison between a quote and the page it came from, instead of a hunt."),
        code("text", "A verification log for an external-facing brief", `Claim                              Source checked            Result
---------------------------------  ------------------------  ------------------
Vendor A holds 31% share           Report 2, p.14            Confirmed
"We will exit the SMB market"      Not in either PDF         Removed
Market grew 12% YoY                Report 1 says 9%          Corrected to 9%
Client launched 4 products in 2026 Client's own site          Confirmed`),
        text("Citations deserve special care because they look like evidence. A citation proves only that Claude produced a reference; you still need to confirm the source exists, is current and credible, and actually supports the specific claim. When Research returns cited findings, the citations make verification faster — they do not make it unnecessary."),
        exam("Independent means outside the output", "Correct answers verify against something Claude did not just write: the uploaded document, the original dataset, an authoritative publication, or a subject-matter colleague. Options that ask Claude to 're-check', 'confirm accuracy' or 'add a verified note' are classic distractors."),
        pitfall("Verifying only what looks wrong", "Fabricated specifics are dangerous precisely because they look right. Verify the claims that matter to the decision or the reader — especially numbers, names, quotes and citations — not just the ones that feel suspicious."),
      ],
      terms: ["Discernment", "hallucination", "fabricated citation", "independent confirmation", "source checking", "bias"],
      sources: [guide, prompting, research],
    },
    {
      objective: "2.3",
      title: "Choose review depth and know when to escalate",
      takeaway: "Scale review to the consequence of error and the audience: internal drafts can tolerate light review, while external, regulated, irreversible or high-stakes work needs independent verification and, where expertise or authority is required, escalation to a qualified person.",
      minutes: 3,
      blocks: [
        text("Not every output needs the same scrutiny. Reviewing a brainstorm list like a regulatory filing wastes time; reviewing a regulatory filing like a brainstorm list creates real risk. The exam guide asks you to evaluate the risk and accountability profile of a work product and its intended use, and decide what must be independently verified, corrected, or escalated. This is the Diligence competency — taking responsibility for what we do with AI and how we do it — applied to quality control."),
        text("Three questions set the depth. What happens if this is wrong, and can it be undone? Who will see it — you, your team, or people outside the organization who will rely on it? And does any part of it require expertise or authority you do not hold?"),
        table(["Profile", "Examples", "Review depth"], [
          ["Low stakes, internal, easily reversed", "Brainstorm, first-draft agenda, personal notes", "Skim for obvious errors; use and refine"],
          ["Moderate, internal decision support", "Team summary, internal analysis, process draft", "Check key facts and figures against sources; flag assumptions"],
          ["External delivery", "Client brief, press material, customer email", "Verify every specific; review tone and commitments; owner signs off"],
          ["High stakes or regulated", "Legal, medical, financial, HR decisions about individuals", "Qualified human review with authority to change it; document the review"],
        ]),
        text("Escalation is the right move when the gap is not something more prompting can close: a contract clause whose interpretation has legal consequences, a benefits calculation that affects someone's pay, a statement that commits the organization publicly, or any output where you cannot personally assess correctness. Escalating means sending it to a person with the expertise or authority to decide, with enough context for them to review efficiently."),
        code("text", "A review plan written before the work starts", `Deliverable:     Customer notice about a billing-system change
Audience:        ~4,000 external customers
Reversibility:   Low — once sent, it cannot be recalled
Claude's role:   Draft from the approved change summary; produce FAQ

Verify myself:   Dates, plan names, links, every number vs change summary
Escalate:        Refund wording -> Legal; fee amounts -> Billing lead
Sign-off:        Customer Comms manager before scheduling the send
Record:          Keep the verified version and reviewers' approvals`),
        text("Anthropic's Usage Policy reinforces this thinking for certain decisions. When Claude's output is used to give high-risk recommendations — for example in legal, medical, financial, employment, housing, insurance or education decisions about people — the policy calls for a qualified human in the loop who meaningfully reviews the recommendation and can change it before it is acted on, and for disclosing to affected people that AI was used. Associate candidates are not expected to recite the policy, but they are expected to recognize when a use is in this territory and raise review depth accordingly."),
        exam("Internal draft versus external delivery", "A recurring item pattern contrasts the same content used two ways. A summary circulated to your own team for discussion needs less review than the same summary sent to a client or regulator. When an option applies external-delivery rigor to an internal brainstorm, or brainstorm rigor to an external commitment, it is miscalibrated."),
        pitfall("Escalating everything, or nothing", "Over-escalation clogs experts' queues and signals that you cannot judge risk; under-escalation leaves the organization exposed. The skill is proportion: escalate the specific parts that need expertise or authority, and verify the rest yourself."),
      ],
      terms: ["Diligence", "review depth", "escalation", "consequence of error", "human-in-the-loop", "Usage Policy"],
      sources: [guide, fluency, aup],
    },
    {
      objective: "2.4",
      title: "Adapt raw output and pick the right format for the channel",
      takeaway: "Shape the output for its reader and channel, and pick the format that fits: inline text for quick answers, an artifact for something you will reuse or share, structured data for import, code-executed results when numbers must be exact, and Skill-produced files when the deliverable is a document, sheet, deck or PDF.",
      minutes: 3,
      blocks: [
        text("A raw Claude response is rarely the final form of a deliverable. The same analysis may need to become a three-line Slack update for an executive, a detailed table for an analyst, and a downloadable deck for a steering committee. Adaptation covers both the content (length, reading level, emphasis) and the container (format and file type)."),
        table(["Format", "Use it when", "Watch out for"], [
          ["Inline response", "Quick answers, short text you will paste elsewhere", "Long content becomes hard to revise in place"],
          ["Artifact", "Substantial, self-contained content you will edit, reuse or share: a document, a dashboard, a small interactive tool", "Artifacts start private; sharing follows your plan and admin settings"],
          ["Structured data (table, CSV, JSON)", "Output will be imported, filtered or compared", "Specify columns and allowed values, then spot-check rows"],
          ["Code-executed results", "Calculations must be exact: totals, percentages, statistics, reconciliations", "Requires the code execution and file creation capability to be enabled"],
          ["Skill-produced documents", "The deliverable is a Word document, Excel sheet, PowerPoint deck or PDF", "Review the file itself, not just the chat summary of it"],
        ]),
        text("Two facts from Anthropic's help center shape these choices. First, Claude creates artifacts for content that is significant and self-contained — the kind you would likely edit or reuse outside the conversation — and artifacts open beside the chat where you can revise them. Second, with code execution and file creation enabled, Claude can write and run code to analyze uploaded CSV or spreadsheet files and create Excel, PowerPoint, Word and PDF files; Anthropic's built-in Skills cover those document types, and Claude selects them based on your request."),
        text("The exam leans hard on one distinction: computation that must be exact belongs in code-executed analysis, not in prose. When Claude writes and runs code to compute a total, the arithmetic is performed by the program over your actual data. When a total is simply written in a sentence, nothing guarantees it was calculated. For budgets, survey percentages, pay figures and reconciliations, ask Claude to compute with code and show the result table — then reconcile one figure you already trust."),
        code("markdown", "Adapting one analysis for two audiences", `<analysis>[paste Claude's full churn analysis]</analysis>

<task>
Produce two versions:
1. For the COO, to paste into Slack: 3 bullets, plain language,
   lead with the decision needed, no methodology.
2. For the retention analyst: a table of segment | churn rate | change
   vs last quarter | driver, followed by the assumptions behind each driver.
Do not add any figure that is not in <analysis>.
</task>`),
        code("markdown", "Requesting exact computation and a file deliverable", `Use code execution on the attached survey_export.csv.
1. Calculate response counts and percentages for Q3 and Q5 by region.
2. Show the calculation table in the chat so I can check it.
3. Then create a 4-slide PowerPoint: one title slide, one chart per
   question, one slide of caveats (sample sizes under 30 flagged).`),
        tip("Try it in Claude", "Available on every plan. 1) In Settings > Capabilities, check that 'Code execution and file creation' is on (labeled 'Create and edit files' in the updated layout; on Team and Enterprise an Owner can turn it off). 2) Upload a small CSV you already know the totals for and ask Claude to compute them with code and show the calculation table. 3) Ask for the same result as a two-slide PowerPoint. 4) Open the downloaded file and reconcile one number against the figure you trust — that check, not the chat summary, is what makes the output usable."),
        exam("Exact numbers mean executed code", "If a scenario says figures must be precise — payroll, budget variance, compliance counts — the strongest option routes the calculation through code-executed analysis and checks a result, rather than asking Claude to 'double-check the math' in prose."),
        pitfall("Shipping the raw response", "Pasting a chat answer straight into an executive email usually carries the wrong length, hedges meant for you, and markdown that renders as stray symbols. Adapt for the reader and the channel before it leaves your hands."),
        pitfall("Trusting the file without opening it", "A generated deck or spreadsheet can differ from the chat description of it. Open the file, check the numbers and labels, and only then distribute it."),
      ],
      terms: ["Artifacts", "code execution and file creation", "Skills", "structured data", "inline response", "Discernment"],
      sources: [guide, artifacts, files, skills],
    },
    {
      objective: "3.1",
      title: "Choose the right combination of Claude capabilities",
      takeaway: "Match each part of a task to the capability built for it — chat, Projects, Artifacts, Research, code-executed analysis, Skills, connectors, memory — and combine them, rather than forcing one feature to do everything.",
      minutes: 4,
      blocks: [
        text("Capability selection is Delegation at the platform level: once you have decided Claude should help, you decide how. The intended CCAO-F candidate works in claude.ai on web, desktop or mobile and is expected to know what each capability is for and, just as important, what it is not for."),
        table(["Capability", "Choose it when", "Not the best fit when"], [
          ["Chat", "A one-off question, draft or analysis that needs no saved setup", "You will repeat the task weekly with the same context"],
          ["Projects", "Recurring work that shares instructions and reference files across many chats", "A single quick task with no reusable context"],
          ["Artifacts", "Substantial, self-contained output you will edit, reuse or share", "A short answer you will paste elsewhere"],
          ["Research", "A question needing many searches across the web and connected tools, with cited findings", "Analyzing a spreadsheet you already have, or a quick fact"],
          ["Code-executed analysis", "Calculations, data cleaning, charts, or creating xlsx, docx, pptx and PDF files", "Opinion, tone, or judgment questions"],
          ["Skills", "A packaged, repeatable procedure or document standard Claude should apply when relevant", "Background facts (those belong in knowledge)"],
          ["Connectors", "Claude needs live access to a work system such as Google Drive, Gmail or Calendar", "A single static file you can simply upload"],
          ["Memory", "Context about you and your work that should carry across chats", "Sensitive or client-specific details that must stay contained"],
        ]),
        text("A few verified behaviors sharpen these choices. Research, per Anthropic's help center, investigates a question in depth by running a sequence of searches, choosing next steps from earlier results, and drawing on the web and connected tools such as Gmail, Google Calendar and Google Docs; it requires web search to be turned on and is available on paid plans. Code execution and file creation lets Claude write and run code in a sandbox to analyze uploaded CSV and other files and to produce downloadable Office files and PDFs. Skills are packages of instructions and resources that Claude uses when a request calls for them; Anthropic's built-in Skills handle spreadsheets, documents, presentations and PDFs, and Skills require code execution to be enabled. Google Workspace connectors let Claude search and read Drive files and email, work with calendar events, and draft or change content in those systems — and by default Claude asks for your approval before actions such as sending email or sharing, moving or trashing a file."),
        code("text", "Capability plan for a real request", `Request: "Prepare a briefing on how three peer universities run
         their mentoring programs, compare with our survey results,
         and give leadership a 5-slide deck."

Research        Peer programs, with citations             (web)
Upload + code   Our survey_results.xlsx -> exact stats    (code execution)
Chat            Compare peers vs our results; draft story (augmentation)
Skill           Build the PowerPoint deck                 (built-in pptx Skill)
Project         Keep survey, verified research table and
                leadership style notes for follow-up asks
Human           Verify citations; choose the recommendation`),
        text("Most exam scenarios are combinations. A recurring client report might use a Project for shared instructions, a Drive connector for the live source documents, code execution for the numbers, and a Skill for the house document format. The right answer is often the smallest combination that meets every requirement in the stem; adding capabilities the task does not need adds setup, cost and risk without benefit."),
        exam("Read for the decisive requirement", "Each scenario hides one requirement that settles the choice: 'must be exact' points to code execution; 'needs current sources with citations' points to Research; 'every week, same format, for the whole team' points to a Project or Skill; 'from the shared drive, which changes daily' points to a connector. Underline that phrase before you look at the options."),
        pitfall("Research is not data analysis", "Research gathers and synthesizes sources. If the evidence is already in a file you have, upload it and analyze it with code execution. Using Research to 'look into' your own spreadsheet uses more of your usage and does not compute anything."),
        pitfall("Connecting what you could upload", "A connector earns its place when content changes or lives across many files. For a single, stable document, uploading it is simpler and keeps access narrower."),
      ],
      terms: ["Delegation", "Projects", "Artifacts", "Research", "code execution and file creation", "Skills", "connectors", "memory"],
      sources: [guide, research, files, skills],
    },
    {
      objective: "3.2",
      title: "Select a model tier and effort level you can defend",
      takeaway: "Match the model tier and effort to the task's complexity and stakes: faster, lower-cost settings for routine, high-volume or easily checked work, and more capable models or higher effort for complex reasoning where errors are costly — and be able to say why the alternatives are worse.",
      minutes: 4,
      blocks: [
        text("Claude.ai lets you choose which Claude model to chat with and how much effort it applies. Anthropic offers model families at different points on the speed, cost and capability curve: Haiku is the fastest and lowest-cost tier, Sonnet balances speed and capability for everyday work, Opus is built for complex, demanding knowledge work, and Fable is Anthropic's most capable family for the most demanding reasoning and long-running work; which ones appear in your list depends on your plan and, on Enterprise, your administrator. You switch models from the model name next to the send button, and you can change model, effort, or thinking at any point in a conversation — the change applies from the next response."),
        text("Effort controls how much thinking Claude applies to a response. Anthropic's help center lists Low, Medium, High, Extra high and Max (not every model offers every level). It describes Low and Medium as suited to routine tasks and stretching your usage further, High as the best overall balance of quality and speed, Extra high as aimed at long-running coding and agentic tasks, and Max as the most thorough option for the deepest reasoning. Each model marks a recommended level as Default. Thinking is a separate setting that controls whether Claude reasons in an expandable section before answering; on some models thinking is always on, and you lower effort to make Claude think less. Anthropic's model-selection guidance adds a useful principle: tuning effort is often a better lever than switching models."),
        table(["Task profile", "Reasonable starting choice", "Why not the alternative"], [
          ["Reformat a list, fix grammar, classify 200 short comments", "Fast tier, low or default effort", "A top model adds wait time and usage with no quality gain on easily checked work"],
          ["Draft a team update from clear notes", "Balanced tier at default effort", "Routine writing does not need maximum reasoning"],
          ["Untangle a contract comparison with conflicting clauses", "Capable tier, higher effort", "A fast setting may miss subtle conflicts where errors are costly"],
          ["Multi-step strategic analysis feeding a board decision", "Most capable available model, high or max effort", "Under-powering a high-stakes task creates review burden and risk"],
        ]),
        code("text", "Defending a selection in one paragraph", `Task:      Tag 1,200 open-ended survey comments into 8 agreed themes.
Choice:    Faster tier, default effort.
Because:   Categories are defined, each item is short, and I will
           spot-check a 50-comment sample against my own tagging.
Not Opus:  Higher capability would cost more usage and time without a
           measurable gain on a well-specified, easily verified task.
Escalate:  If the sample shows > 10% disagreement, retry on a more
           capable model or refine the theme definitions first.`),
        tip("Try it in Claude", "1) Paste twenty short, clearly worded customer comments and ask Claude to tag each one with one of four themes you define. 2) Open the model menu next to the send button, note which effort level is marked Default, and switch to a lower effort (or a faster model if your plan lists one); the change applies from the next response. 3) Ask for the same tagging again and compare the two runs against your own tags. If they agree, you have just defended the faster setting with evidence rather than habit."),
        text("The exam guide stresses recognizing when the faster, lower-cost option is the right choice. That is not a compromise; on clear, well-specified, verifiable work it is the professionally correct decision. Conversely, if output quality is poor because the prompt lacks context, no model upgrade will fix it — a lesson you will meet again in configuration troubleshooting."),
        exam("Defend against the alternatives", "Items may ask which selection is most appropriate and why. The best answer ties the choice to stated requirements — complexity, stakes, volume, speed — and names the trade-off. Options that pick the most powerful model 'to be safe' for a trivial, high-volume task, or the cheapest model for a nuanced, high-stakes one, are wrong for the same reason: they ignore the task."),
        pitfall("Upgrading to fix a description problem", "When output is generic, off-target, or cites stale information, the cause is usually the prompt, the knowledge source, or memory. Raising the model tier or effort makes the answer more elaborate, not more grounded."),
        tip("Admins may shape your choices", "On Enterprise plans an administrator can restrict which models or effort levels are available to a role and set the default for new chats. If an option is missing, that is a policy decision, not a fault."),
      ],
      terms: ["model selector", "Haiku", "Sonnet", "Opus", "effort", "thinking", "Default effort"],
      sources: [guide, models, choosing],
    },
    {
      objective: "3.3",
      title: "Manage context and memory across long and multi-session work",
      takeaway: "Keep what must persist in the right place — a Project for shared reference material, memory for durable personal context, a fresh chat with a summary when a thread has drifted — and keep memory accurate by reviewing, editing and deleting it, using incognito chats when nothing should be remembered.",
      minutes: 4,
      blocks: [
        text("Long work raises two questions: what does Claude currently have in view, and what should carry over to the next session? The exam guide expects you to know when to restart, summarize, persist to a Project, or rely on memory, and how to maintain memory quality through review, edits, deletions and incognito chats."),
        table(["Option", "What it does", "Use it when"], [
          ["Continue the chat", "Claude keeps working with the conversation so far", "The thread is on track and focused on one task"],
          ["Summarize and restart", "You carry decisions into a fresh chat and drop the noise", "The thread has drifted, collected contradictory corrections, or changed goal"],
          ["Persist to a Project", "Files in Project knowledge are available to every chat in that Project", "Reference material and decisions that several chats or people need"],
          ["Rely on memory", "Claude saves topics from your chats and uses them in future conversations", "Stable context about you and your work that helps across chats"],
          ["Incognito chat", "Not saved to chat history or memory, and not searched later", "Sensitive or one-off work that should not shape future chats"],
        ]),
        text("Some product facts matter here. On paid plans with code execution enabled, Claude automatically manages long conversations by summarizing earlier messages as the context fills, while the full chat history is preserved. That keeps a chat going, but it does not make a meandering thread focused again; a deliberate summary and fresh start is still the cleaner move when direction has changed. Within a Project, context is not shared between chats unless it is added to Project knowledge — so the verified version of a decision belongs there, not buried in one conversation."),
        text("Memory, per Anthropic's help center, saves individual topics as you chat, and you can also say 'remember this'. You can browse topics in settings, edit or delete them, or ask Claude in chat to remember, change, or forget something. Each Project has its own memory: in a Project, Claude uses that Project's memory plus your non-project memory, but not other Projects' memory, and you can turn off 'Use account memory' on a Project to keep it fully separate. You can pause memory (stop using and saving it) or reset it (permanently delete all memories). Deleting a conversation does not remove memory entries generated from it — those must be deleted separately. You can also turn memory off for a single chat from the '+' menu before the first message; that chat still appears in your history."),
        code("markdown", "A hand-off summary that lets you restart cleanly", `Summarize this conversation so I can continue in a new chat.
Include only:
<decisions> what we agreed, with the reason </decisions>
<facts> figures and sources we verified </facts>
<open> unresolved questions and who owns them </open>
<next> the very next step </next>
Leave out abandoned drafts and superseded ideas.`),
        code("text", "A monthly memory review routine", `1. Open memory settings and scan the topic list.
2. Delete anything outdated (old role, finished projects, former clients).
3. Edit anything that is nearly right instead of letting it mislead.
4. Delete topics that came from a chat you have since deleted.
5. Check client Projects have 'Use account memory' set as intended.
6. Note which kinds of work should use incognito from now on.`),
        tip("Try it in Claude", "Memory is on by default on Free, Pro, Max and Ultra; on Team and Enterprise your Owner decides whether it is available. 1) In a normal chat, tell Claude a harmless work preference and say 'remember this'. 2) Open your memory settings and find it in the Topics list; edit its wording, then delete it. 3) Start an incognito chat with the ghost icon (outside any Project) and ask what Claude knows about your preferences — it neither uses nor adds memory there. 4) Inside a Project, open the '+' menu before your first message and switch Memory off: incognito is not offered in Projects, and that chat still appears in your history."),
        exam("Incognito controls retention, not disclosure", "Incognito chats are excluded from history and memory and are not used for training, but they are still retained for a period (30 days by default, or longer under an Enterprise organization's custom retention setting) and, on Team and Enterprise, are included in owner data exports. If a scenario's real problem is sharing data that should not be shared at all, incognito is not the fix."),
        pitfall("Memory as a filing cabinet", "Relying on memory for client facts, figures, or reference documents invites cross-contamination and drift. Reference material belongs in the right Project's knowledge; memory is for durable context about you and how you work."),
      ],
      terms: ["memory", "Project memory", "Use account memory", "incognito chat", "chat search", "Project knowledge", "automatic context management"],
      sources: [guide, memory, incognito, contextWindow],
    },
    {
      objective: "4.1",
      title: "Carry a research, analysis or planning deliverable from brief to plan",
      takeaway: "Run an end-to-end deliverable as a lifecycle — pin down requirements, research with cited sources, analyze data with code execution, then synthesize an actionable plan — with a human check at every hand-off.",
      minutes: 3,
      blocks: [
        text("Domain 4 moves from single interactions to whole pieces of work. The exam guide describes the lifecycle of a research, analysis or planning deliverable in four phases: requirements analysis, research with cited sources, data analysis through code execution, and synthesis into an actionable plan. Each phase uses a different capability, and each produces something the next phase depends on."),
        table(["Phase", "Claude's contribution", "Your checkpoint"], [
          ["Requirements analysis", "Turns a vague ask into questions, scope, success criteria and assumptions", "Confirm scope and criteria with the requester"],
          ["Research with cited sources", "Research mode searches the web and connected tools and reports findings with sources", "Open the sources behind every claim the plan will rest on"],
          ["Data analysis via code execution", "Writes and runs code on your uploaded data for exact figures and charts", "Reconcile at least one figure against a trusted number"],
          ["Synthesis into an actionable plan", "Drafts options, a recommendation, owners, timeline and risks", "Decide the recommendation; check feasibility with owners"],
        ]),
        code("markdown", "Phase 1 prompt: requirements before research", `<request>
Our COO asked: "Should we move the support team to a 4-day week?"
</request>

<task>
Before any research, help me scope this.
1. List the questions we must answer to make the decision.
2. Propose measurable success criteria (e.g., response times, CSAT, attrition).
3. List the data we need and where it likely lives.
4. State assumptions you are making that I should confirm.
</task>`),
        code("markdown", "Phase 3 prompt: exact analysis on your own data", `Use code execution on the attached tickets_2026.csv.
- Weekly ticket volume and median first-response time, by weekday.
- Model coverage gaps if Fridays are covered by half the team.
- Show the calculation tables, then one chart of volume by weekday.
State any rows you excluded and why.`),
        text("Requirements analysis is where many deliverables succeed or fail quietly. A clear scope prevents Research from wandering into adjacent questions and gives you criteria to judge the final plan against. The Research phase brings breadth and citations; per Anthropic's help center, Research runs a series of searches that build on each other and can include connected sources such as Gmail, Google Calendar and Google Docs when started on web or desktop. The analysis phase should run on your actual data through code execution, so totals and rates are computed rather than estimated."),
        text("Synthesis is augmentation, not automation. Claude is excellent at turning verified findings into options with trade-offs, a draft timeline, and a risk register. The recommendation itself — which option, what risk the organization accepts — remains a human decision that you can defend to the person who asked. An actionable plan names owners, dates, measures and the conditions that would trigger a rethink."),
        code("text", "What 'actionable' looks like at the end", `Recommendation:  Pilot 4-day week with one region for 8 weeks
Evidence:        Verified volume analysis (tables attached); 3 cited studies
Owners:          Support director (pilot), HR partner (policy), Analyst (metrics)
Success measure: Median first response within 10% of baseline; CSAT steady
Stop condition:  Two consecutive weeks outside thresholds
Open risks:      Holiday weeks not in sample; contract terms for 2 clients`),
        tip("Try it in Claude", "Research is on paid plans (Pro, Max, Ultra, Team, Enterprise) and needs web search turned on. 1) Ask Claude in a normal chat to turn a vague question you face at work into three scoped research questions and success criteria. 2) Click '+', choose Research, and run only the first scoped question. 3) Open two of the cited sources behind the claims you would rely on and check they say what the report says. Research uses your limits faster than a normal chat, so a scoped question is also the economical one."),
        exam("Where the lifecycle breaks", "Scenarios often describe a plan that went wrong and ask what should have been done. Look for the phase that was skipped or unchecked: research cited but never opened, numbers written in prose rather than computed, or a recommendation adopted without the requester agreeing the criteria. The best answer restores that phase."),
        pitfall("Jumping straight to the plan", "Asking Claude for 'a plan to improve onboarding' without requirements, research, or data produces a generic best-practice list. It may read well, but it is not grounded in your situation and cannot be defended."),
        tip("Save verified outputs between phases", "Put the confirmed scope, the verified research table and the analysis results into a Project's knowledge as you finish each phase. Later chats and colleagues then build on checked material rather than on a long, partly superseded thread."),
      ],
      terms: ["Research", "code execution", "requirements analysis", "cited sources", "augmentation", "actionable plan"],
      sources: [guide, research, files, fluency],
    },
    {
      objective: "4.2",
      title: "Redesign a workflow by deciding who does each step",
      takeaway: "Assign each workflow step as AI-executed, human-reviewed, or human-retained by weighing reversibility, stakes, the need for human judgment or empathy, and accountability — and treat any irreversible or high-stakes step running without human review as over-delegation.",
      minutes: 4,
      blocks: [
        text("Delegation, in the AI Fluency framework, is setting goals and deciding whether, when and how to engage with AI. Applied to an existing business process, it becomes a step-by-step design exercise. The exam guide names four criteria to weigh for each step: how reversible it is, how high the stakes are, whether it requires human judgment or empathy, and who is accountable for the outcome."),
        text("The framework also describes three modes of human–AI interaction that map neatly onto workflow design: automation, where AI executes specific tasks based on human instructions; augmentation, where humans and AI collaborate as thinking partners; and agency, where humans configure AI to perform future tasks independently on their behalf. Most redesigned workflows mix all three, with human checkpoints placed where the criteria demand them."),
        table(["Assignment", "Fits steps that are", "Examples"], [
          ["AI-executed", "Reversible, low stakes, rule-based, easy to spot-check", "Formatting, first-pass categorization, drafting from a template"],
          ["Human-reviewed", "Moderate stakes, AI does the work but a person approves", "Customer replies, report drafts, summaries that inform decisions"],
          ["Human-retained", "Irreversible, high stakes, needs empathy or authority, carries personal accountability", "Hiring or disciplinary decisions, delivering bad news, approving spend, legal commitments"],
        ]),
        code("text", "Delegation map: employee-feedback workflow", `Step                                    Assignment       Reason
--------------------------------------  ---------------  ---------------------------------
1 Remove names from survey comments     Human-retained   Policy requires de-identification
                                                         BEFORE any AI use
2 Group comments into themes            AI-executed      Reversible; spot-check 10%
3 Draft theme summary with quotes       Human-reviewed   Quotes could re-identify people
4 Decide which issues to act on         Human-retained   Accountability sits with leaders
5 Draft all-staff message on actions    Human-reviewed   External-to-team, tone matters
6 Talk with teams flagged as struggling Human-retained   Requires empathy and trust`),
        text("Over-delegation is the failure mode the exam most wants you to recognize. Signs include: AI output going directly to customers or employees with no review on consequential matters; AI effectively making decisions about individuals; sensitive conversations being replaced by generated messages; and nobody being able to say who owns an outcome. The fix is not to remove AI from the workflow but to move a checkpoint or reassign a step."),
        text("Under-delegation is the opposite and is also a judgment error: a person spending hours reformatting data or drafting routine first versions that Claude could produce in minutes and the person could check quickly. Good redesign frees people for the steps where their judgment actually matters."),
        text("Claude can help with the redesign itself. Paste a description of the current process and ask it to list every step, the inputs and outputs of each, and a proposed assignment with reasons. Treat that as a draft for discussion: the people who own the process know which steps carry hidden stakes — a customer with a history, a regulatory deadline, a manager who must deliver certain news personally — and the final assignments are theirs to make and defend. The closer a workflow moves toward the agency mode, where Claude acts on future tasks without you prompting each one, the more carefully the review points must be designed in advance, because nobody will be watching each run."),
        exam("Classify each step, not the whole workflow", "Items often present a workflow and ask which change is most appropriate or which step is over-delegated. Evaluate steps individually against the four criteria. The irreversible, high-stakes, empathy-dependent or accountable step is almost always the one that must stay with a person or gain review."),
        pitfall("Review in name only", "A 'human-reviewed' step where the reviewer approves dozens of items without reading them is automation with a signature. Effective review needs time, the source material, and the authority to change the output."),
      ],
      terms: ["Delegation", "automation", "augmentation", "agency", "AI-executed", "human-reviewed", "human-retained", "over-delegation"],
      sources: [guide, fluency],
    },
    {
      objective: "4.3",
      title: "Design a repeatable workflow that others can run and own",
      takeaway: "Turn a recurring manual or ad-hoc task into a configured workflow — a Project for shared context, a Skill for the repeatable procedure or format, connectors for live sources, code execution for exact steps — documented well enough that a colleague can run it and own it.",
      minutes: 3,
      blocks: [
        text("Unstructured prompting works for one person on one day. It fails when the task repeats weekly, when several people run it, or when its owner moves on. Repeatable-workflow design aims for consistency across runs and across users, and for a clean hand-off to a colleague who will own the workflow afterward."),
        table(["Building block", "What it makes repeatable", "Verified behavior to rely on"], [
          ["Project", "Shared instructions and reference files across every chat", "Project instructions apply to every chat in the Project; on Team and Enterprise, Projects can be shared with view or edit permission"],
          ["Skill", "A procedure, checklist or document format applied the same way each time", "Claude uses a Skill when the request calls for it, guided by its description; custom Skills are uploaded as a ZIP and stay private until shared"],
          ["Connector", "Fresh inputs from systems such as Google Drive or Gmail without manual uploads", "Users authenticate individually, so Claude reaches only what that user can access"],
          ["Code-executed step", "Calculations and file outputs that come out identical given the same data", "Runs in a sandbox on uploaded files; requires code execution to be enabled"],
        ]),
        text("Start by writing down how the task is done today, including the judgment calls the current owner makes without noticing. Those unwritten rules — 'always exclude test accounts', 'executives want the risk section first' — are exactly what makes outputs drift between users. Put stable rules in Project instructions or a Skill, put reference material in Project knowledge, and leave only the run-specific details for each request."),
        code("markdown", "Runbook for a weekly marketing-performance summary", `WORKFLOW: Weekly campaign summary         OWNER: J. Ortiz (from May 1)
WHERE:    Project "Campaign Reporting" (shared: marketing team, can view;
          owner, can edit)

INPUTS    Export campaign_weekly.csv from the ad platform each Monday.
          Brand terms and KPI definitions live in Project knowledge.

RUN       1. New chat in the Project. Attach the CSV.
          2. Prompt: "Run the weekly summary for week of <date>."
          3. Claude computes KPIs with code execution and applies the
             'weekly-summary' Skill for the house layout.

CHECK     Totals match the platform dashboard for spend and clicks.
          Any KPI moving > 20% has a stated reason or is flagged.

OWNERSHIP Update KPI definitions in knowledge when Finance changes them.
          Review the Skill each quarter; note version and date here.
          Escalate data-access issues to Marketing Ops.`),
        tip("Try it in Claude", "Skills are on every plan but need code execution enabled (Settings > Capabilities; on Team and Enterprise, Owners control both settings). 1) Open Customize > Skills and look at Anthropic's built-in document Skills. 2) Ask Claude for a one-page Word memo from three bullet points and watch it pick the Word Skill without being told to. 3) Optional: package a short SKILL.md with your team's memo rules as a ZIP, upload it, and run the same request again — it stays private until you share it. Compare the two memos: the difference is what the Skill makes repeatable."),
        text("Consistency across users is mostly about removing hidden variation. If each analyst writes their own prompt, outputs will differ even with the same data. A shared Project with clear instructions, a Skill that encodes the layout and procedure, and a short standard request make runs comparable. Testing the workflow on two or three past weeks, run by someone other than the designer, reveals the assumptions still living in one person's head."),
        exam("Hand-off is part of the design", "When a scenario says a colleague will take over the workflow, the best answer includes documentation, ownership of the Project and Skill, and the checks the new owner should run — not just a well-crafted prompt saved in someone's notes."),
        pitfall("A shared prompt is not a workflow", "Circulating a clever prompt in a chat channel feels like standardization, but every user adds their own context, uses different files and skips checks. Configuration, not copy-paste, creates consistency."),
        tip("Only trusted Skills in shared workflows", "Anthropic advises installing Skills only from trusted sources and reviewing a less-trusted Skill's files before enabling it. A Skill that many people run multiplies any problem it contains."),
      ],
      terms: ["Projects", "Skills", "connectors", "code execution", "Project sharing", "runbook", "custom Skills"],
      sources: [guide, skills, projects, workspace],
    },
    {
      objective: "4.4",
      title: "Communicate what Claude can and cannot do for a use case",
      takeaway: "Give stakeholders a calibrated picture: what Claude reliably does for this use case, where it is unreliable, what human oversight stays in place, and what results to expect — without hype and without dismissiveness.",
      minutes: 3,
      blocks: [
        text("Associates are often the people a manager, client or colleague asks: 'Can Claude do this for us?' The exam guide calls this capability communication, aimed at stakeholders with limited AI familiarity. The skill is calibration: neither overstating (which sets up disappointment or unsafe reliance) nor understating (which wastes real value and breeds unfounded fear). It is part of Diligence too — being honest about AI's role is part of taking responsibility for how it is used."),
        table(["Framing", "Sounds like", "Consequence"], [
          ["Overstated", "'Claude will handle all our contract reviews; no lawyer needed.'", "Unsafe reliance; errors reach customers; trust collapses after the first miss"],
          ["Understated", "'AI just makes things up; it is not useful for real work.'", "Team ignores large time savings on drafting, summarizing and analysis"],
          ["Calibrated", "'Claude can draft a first-pass clause comparison in minutes; counsel reviews every flagged clause before anything is signed.'", "Realistic adoption with oversight people understand"],
        ]),
        text("A calibrated briefing covers four things for the specific use case. What Claude can reliably do: draft, summarize, restructure, compare against criteria, compute on supplied data with code execution, and search and synthesize sources with Research. Where it is less reliable: unsupported specifics, citations that must be checked, organization-specific facts it has not been given, and judgments that depend on context nobody wrote down. What human oversight remains: who checks what, and who makes the final decision. And what outcomes to expect: realistic time savings, the review effort that remains, and how quality will be monitored."),
        code("markdown", "Before: a pitch that overstates", `Claude can fully automate our grant applications. It writes them,
finds the right funders and makes sure everything is accurate, so
the team can focus on other work.`),
        code("markdown", "After: a calibrated briefing for the same proposal", `What Claude will do
- Draft narrative sections from our program data and past applications
  kept in a shared Project.
- Research candidate funders and summarize eligibility, with links.
- Check drafts against each funder's stated criteria.

What stays with people
- Choosing which funders to apply to.
- Verifying every figure, eligibility rule and citation.
- Final edit and submission by the grants lead.

What to expect
- First drafts in hours instead of days; review still takes time.
- Some research leads will be out of date or wrong; we check each one.
- We will compare time spent and success rate after 3 cycles.`),
        text("Stakeholders also ask where their data goes. Answer from your organization's policy and plan, not from memory or assumption. Anthropic's privacy center states that, by default, it does not use inputs or outputs from commercial products such as Claude for Work plans to train its models, while consumer plans have their own model-improvement setting. If you are unsure how your workspace is configured — retention, memory, which connectors are enabled — say so and route the question to the people who administer it. A confident wrong answer about data handling does more damage than 'I will confirm with our admin.'"),
        text("Notice that the calibrated version is more persuasive, not less. Stakeholders with limited AI familiarity trust specific commitments with named safeguards more than sweeping promises. It also sets up a fair evaluation later, because everyone agreed in advance what success would look like."),
        exam("Choose the honest, specific statement", "When asked how to describe a proposed use to a stakeholder, prefer the option that names concrete capabilities, a concrete limitation, the oversight retained, and a realistic expectation. Absolute words — 'always', 'fully', 'never', 'eliminates' — are red flags in either direction."),
        pitfall("Promising on behalf of the product", "Avoid committing to accuracy rates, turnaround guarantees or feature availability you have not verified for your plan and organization. Say what you have tested and what you will measure."),
      ],
      terms: ["capability communication", "Diligence", "human oversight", "calibration", "Research", "Projects"],
      sources: [guide, fluency, research, commercialTraining],
    },
    {
      objective: "5.1",
      title: "Configure a Project for a recurring use case",
      takeaway: "For each requirement of a recurring use case, choose the right layer — Project instructions for how Claude should behave, Project knowledge for what it should know, a Skill for a repeatable procedure or format, and scoped memory for context that should accumulate — and give unrelated work streams their own Projects.",
      minutes: 3,
      blocks: [
        text("A Project is a workspace with its own chats, instructions, knowledge and memory. Anthropic's help center describes Project knowledge as files you upload — documents, text, code — that are used across all chats in the Project, and Project instructions as the way to tailor Claude's responses for every chat in it. Each Project also has its own memory. Projects are available on all plans, including free accounts (limited to five Projects), and on Team and Enterprise plans they can be shared with colleagues at 'Can view' or 'Can edit' permission."),
        text("The configuration skill the exam tests is placement: given a list of requirements, which layer should hold each one? Putting a requirement in the wrong layer is a common cause of inconsistent output."),
        table(["Layer", "Holds", "Example requirement"], [
          ["Project instructions", "Behavior: role, audience, tone, structure, rules, what to do when information is missing", "'Write for hospital procurement buyers; never quote prices; flag missing specs'"],
          ["Project knowledge", "Facts and reference material Claude should draw on", "Current product catalog, approved case studies, style guide"],
          ["Skill", "A repeatable procedure or document standard, applied when the task calls for it", "Build the proposal in the house Word template with the standard sections"],
          ["Project memory", "Context that accumulates from this Project's chats", "Preferences learned while working on this client's proposals"],
          ["Per-request prompt", "What is specific to this run", "This buyer, this deadline, these three products"],
        ]),
        code("markdown", "Project setup spec for a recurring RFP-response use case", `PROJECT:   "RFP Responses – Healthcare"
SHARED:    Bid team (Can view); bid manager (Can edit)

INSTRUCTIONS (behavior)
  You help the bid team answer healthcare RFP questions.
  Audience: hospital procurement and clinical engineering reviewers.
  Use only Project knowledge for product claims; if a requirement is not
  covered, write "NEEDS SME INPUT" and say what is missing.
  Never state prices, delivery dates or discounts.
  Answer format: requirement restated, response (<= 150 words), evidence source.

KNOWLEDGE (facts)
  product-specs-2026.pdf, compliance-certifications.pdf,
  approved-case-studies.docx, healthcare-glossary.docx

SKILL (procedure/format)
  'rfp-answer-pack' – assembles answers into the bid Word template.

MEMORY
  Keep this Project's memory separate from account memory.`),
        tip("Try it in Claude", "Projects are on every plan (Free is limited to five). 1) Click '+ New Project' and use 'Set project instructions' to add three behavior rules, including what to do when information is missing. 2) Add two reference files to Project knowledge. 3) Start two separate chats in the Project and ask a question only the files can answer, then one they cannot — the rule for missing information should fire in both. 4) On the Project's page, find 'Use account memory' under Memory. On Team and Enterprise, open Share to see the 'Can view' and 'Can edit' levels."),
        text("Isolation is the other half of good configuration. Unrelated work streams — two clients, HR casework and marketing, a confidential reorganization and routine planning — belong in separate Projects. Context is not shared across Projects: Claude uses the current Project's memory plus your non-project memory, but never another Project's memory, and you can switch off 'Use account memory' on a Project to make it fully self-contained. Mixing streams in one Project invites the kind of cross-contamination the exam's sample question describes, where one client's terminology appears in another client's draft."),
        exam("Instruction, knowledge, or Skill?", "Expect items that list requirements and ask where each belongs. Rules of thumb: if it describes how to behave, it is an instruction; if it is a fact or document Claude should consult, it is knowledge; if it is a multi-step procedure or standard output format reused across tasks, it is a Skill. Run-specific details stay in the request."),
        pitfall("Pasting reference documents into instructions", "Copying a whole style guide or price list into Project instructions buries the behavioral rules and is harder to update. Keep instructions concise and let knowledge carry the reference material; Anthropic's own context guidance recommends concise Project instructions."),
        pitfall("One Project for everything", "A single 'Work' Project with every client's files and a mixed memory guarantees eventual leakage between engagements. Scope Projects to a use case and an audience."),
      ],
      terms: ["Projects", "Project instructions", "Project knowledge", "Project memory", "Use account memory", "Skills", "Can view", "Can edit"],
      sources: [guide, projects, manageProjects, contextWindow],
    },
    {
      objective: "5.2",
      title: "Manage connected sources and Project knowledge",
      takeaway: "Connect live sources such as Google Drive and Gmail when content changes or spans many files, upload when a small stable set of documents is enough, and curate both so Claude works from current, relevant material without noise.",
      minutes: 3,
      blocks: [
        text("A workflow is only as good as the sources behind it. The exam guide covers connecting sources like Google Drive and Gmail, upload-versus-connector trade-offs, curating uploads, and keeping connected knowledge current, relevant and free of noise."),
        text("Anthropic's Google Workspace connectors let Claude search and read Gmail and draft replies, view and manage Google Calendar events, and search and read Google Drive files — and, with your approval, take actions such as sending email or sharing and moving files. A few behaviors matter for workflow design. By default, Claude asks for your approval before taking actions on your behalf. Google Docs added to chats and Projects sync from Drive, so you work with the latest version. When Claude reads a Drive file it extracts text only, so images embedded in documents are not processed. On Team and Enterprise plans an Owner must enable these connectors for the organization before individuals can authenticate, and each person connects their own account, so Claude can reach only what that person can access."),
        table(["Consideration", "Upload a file", "Use a connector"], [
          ["Freshness", "A snapshot; you must replace it when it changes", "Reads the current version from the source system"],
          ["Scope", "Exactly the files you choose", "Whatever the connected account can reach, so phrase requests narrowly"],
          ["Best for", "A small, stable reference set: policy, template, final report", "Living documents, inboxes, calendars, large shared folders"],
          ["Setup and governance", "None beyond your plan", "Admin enablement on Team/Enterprise; individual authentication"],
          ["Risk to manage", "Stale copies left in knowledge", "Over-broad access and unexpected content entering the conversation"],
        ]),
        text("Curation is the discipline that keeps answers sharp. Project knowledge is used across every chat in the Project, so every superseded draft, duplicate and loosely related file is a chance for Claude to ground an answer in the wrong document. On paid plans, Projects can expand capacity for large knowledge sets, but more material is not better material; the question is always whether each source is the authoritative, current one for this use case."),
        code("text", "A quarterly knowledge inventory for a shared Project", `File / source                     Owner      Status        Action
--------------------------------  ---------  ------------  --------------------------
pricing-2025.pdf                  Finance    Retired Q3    Remove; add pricing-2026.pdf
brand-guide-v4.pdf                Marketing  Current       Keep
client-faq (Google Doc, Drive)    CS lead    Live, synced  Keep; confirm still shared
old-proposal-drafts/ (12 files)   Unknown    Superseded    Remove - noise, mixed clients
competitor-notes.docx             Sales      14 months old Ask owner: refresh or remove`),
        tip("Try it in Claude", "Google Workspace connectors are available to all users on claude.ai and Claude Desktop; on Team and Enterprise an Owner must enable them first. 1) Click '+', hover Connectors, switch on Google Drive and sign in with your Google account. 2) Ask a narrowly scoped question that names one folder or document. 3) Ask Claude to do something that changes Drive, such as moving a file, and notice the approval prompt before it acts. 4) Compare with uploading the same document directly: if the file never changes, the upload was the simpler, narrower choice."),
        text("Connectors also widen what can enter a conversation, so trust matters. Anthropic notes that custom connectors are not verified by Anthropic, advises connecting only to trusted servers, and warns that a malicious server could include hidden instructions that try to make Claude take unintended actions. Review the permissions a connector requests, limit scope where you can, and choose 'Allow always' only for tools you trust to run unsupervised. Note that during Research, Claude can call connector tools without asking each time, so Anthropic suggests disabling tools that can make changes before you start one."),
        exam("Stale knowledge has a signature", "If outputs cite a retired document, an old price, or a former policy, the cause is the knowledge layer: replace or remove the outdated source. Switching models or rewriting instructions will not stop Claude from using a document that is still sitting in knowledge."),
        pitfall("Connecting everything 'just in case'", "Broad connections increase noise and exposure. Connect the systems a workflow actually needs, and ask Claude to search specific folders, labels or date ranges rather than the whole account."),
      ],
      terms: ["connectors", "Google Drive", "Gmail", "Google Calendar", "Project knowledge", "custom connectors", "Allow always"],
      sources: [guide, workspace, customConnectors, projects],
    },
    {
      objective: "5.3",
      title: "Design persistent instructions that keep outputs uniform",
      takeaway: "Put the stable rules every request needs into persistent instructions — anticipating the use cases, edge cases and constraints the work will meet — and leave only run-specific details for each prompt.",
      minutes: 3,
      blocks: [
        text("Persistent instructions are written once and applied to many interactions. In claude.ai the main ones are Project instructions, which apply to every chat inside a Project, and account-level instructions ('Instructions for Claude', shown as 'Instructions' under Settings > Your Claude in the current layout), which apply to all your conversations. Skills add another persistent layer for specific procedures or formats. The design question is the division of labor: what belongs in the persistent layer, and what belongs in each request?"),
        table(["Put it in persistent instructions", "Put it in the per-request prompt"], [
          ["Audience and role that never change for this use case", "The specific recipient, case or dataset for this run"],
          ["Tone, structure and length standards", "One-off exceptions ('make this one longer')"],
          ["Rules and prohibitions ('never quote prices')", "This run's deadline, figures and attachments"],
          ["How to handle missing or conflicting information", "Answers to questions raised in this conversation"],
          ["Which knowledge sources are authoritative", "Which document matters most for this particular request"],
        ]),
        code("markdown", "Project instructions for an HR policy-question helper", `<role>
You help HR coordinators answer employee questions about company policy.
</role>

<audience>
Replies go to employees in all functions. Plain language, reading level
around grade 8, warm and neutral. No legal advice.
</audience>

<rules>
- Answer only from the policy documents in Project knowledge. Name the
  policy and section you used.
- If the policy does not cover the question, or it involves a specific
  person's pay, leave, discipline, health or immigration status, reply:
  "This needs an HR partner" and say why. Do not draft an answer.
- Never include another employee's information.
</rules>

<format>
1. Short answer (2-3 sentences)
2. What the policy says (quote, with section)
3. Next step for the employee
</format>`),
        text("Good persistent instructions anticipate. Before writing them, list the kinds of request the Project will see and the awkward cases within each: the question the policy does not answer, the request that drifts into individual casework, the input in another language, the user who pastes a document that contradicts knowledge. Then write a rule for each. The exam guide frames this as anticipating the use cases and constraints that keep outputs uniform."),
        text("Explain the reason behind important rules. Anthropic's prompting guidance notes that giving the motivation behind an instruction helps Claude apply it sensibly in situations the rule did not spell out. 'Never include another employee's information, because replies may be forwarded' generalizes better than the bare prohibition."),
        text("Watch for conflicts between layers. Account-level instructions follow you everywhere, so a personal preference such as 'always answer in bullet points' can fight a Project's required format. Keep account-level instructions to genuinely universal preferences and let each Project define its own output standards."),
        tip("Try it in Claude", "1) In Settings > Your Claude, note what your account-level Instructions currently say. 2) In a test Project, set project instructions that require a specific format, such as a three-row table, plus one rule for out-of-scope questions. 3) Ask two different questions in new chats in that Project and check both follow the same format. 4) Ask one out-of-scope question and see whether the edge-case rule fires. If any reply drifts, decide whether the fix belongs in the persistent instructions or only in that request."),
        exam("Persistent versus per-request", "Items may describe a team whose outputs vary from person to person. If each person is re-typing the same audience, tone and rules into every prompt, the fix is to move those into Project instructions so every run starts from the same standard. Conversely, putting one week's figures into persistent instructions is a design error that will contaminate later runs."),
        pitfall("Instructions that only cover the happy path", "Instructions written for the typical request leave Claude to improvise on the unusual one — usually by producing a confident answer. Tell Claude what to do when information is missing, out of scope or sensitive."),
      ],
      terms: ["Project instructions", "Instructions for Claude", "persistent instructions", "per-request prompt", "Skills"],
      sources: [guide, personalization, prompting, manageProjects],
    },
    {
      objective: "5.4",
      title: "Diagnose why an established configuration has degraded",
      takeaway: "When a working setup's quality shifts, trace the symptom to the layer that changed — instructions, knowledge freshness, Skill version, or accumulated memory — fix that layer first, and rule out unchanged layers as causes.",
      minutes: 3,
      blocks: [
        text("A configuration that worked well for months can drift. The exam guide asks you to evaluate a configuration whose output quality has shifted and attribute the degradation to the responsible layer: instructions, knowledge freshness, Skill versions, or accumulated memory. The core reasoning is simple but powerful: a change in output must come from something that changed. A layer that has not been edited cannot by itself explain a new problem."),
        table(["Symptom", "Most likely layer", "First fix"], [
          ["Cites a retired price list, old policy or superseded product", "Knowledge freshness", "Replace or remove the outdated file; check synced sources are current"],
          ["Uses another client's names or terminology", "Accumulated memory (or mixed knowledge)", "Delete the cross-client memories; separate the work streams; consider turning off account memory for the Project"],
          ["Document layout or procedure changed overnight", "Skill version", "Compare with the previous version; restore or correct it"],
          ["Tone, rules or structure changed after an edit", "Instructions", "Review the recent instruction change and its conflicts"],
          ["Broad drop in reasoning on hard cases, no config changes", "Model or effort selection", "Check the model and effort in use; compare on a known case"],
        ]),
        text("The guide's sample item models this exactly. A proposals Project begins citing a pricing schedule retired last quarter and occasionally uses another client's terminology, while the instructions and the formatting Skill are unchanged. Two symptoms point to two layers: stale knowledge and memory accumulated across work streams. Replacing the retired document and deleting the cross-client memories addresses both. Rewriting instructions or upgrading the model targets layers that did not change."),
        code("text", "Degradation diagnosis log", `Project:        Client Proposals            Reported by: bid manager
Symptom 1:      Drafts quote 2025 pricing       First seen: 3 weeks ago
Symptom 2:      Mentions "Northwind" terms in Contoso draft

Layer           Changed recently?   Evidence
Instructions    No (last edit Feb)  Team change log shows no edits
Knowledge       Yes                 pricing-2025.pdf never removed when
                                    pricing-2026.pdf was added
Skill           No                  Same version since March
Memory          Yes                 Topics include Northwind engagement terms

Action:         Remove pricing-2025.pdf; delete Northwind-related memories;
                set Project to not use account memory.
Verify:         Regenerate two recent drafts; compare with approved versions.`),
        text("Memory deserves particular attention because it changes without anyone editing a setting. It grows as people work, and Anthropic's help center notes that deleting a chat does not remove memories generated from it — they must be deleted separately. Reviewing a shared workflow's memory is part of routine maintenance, alongside a knowledge inventory and a check on the Skill versions in use."),
        code("text", "A maintenance rhythm that prevents silent drift", `Monthly    Review Project memory; delete stale or cross-stream topics
Quarterly  Knowledge inventory: remove superseded files, confirm owners
On change  When a source document or Skill is updated, regenerate a
           saved reference output and compare before announcing it
Always     Keep a small set of 'golden' past outputs to test against`),
        exam("Eliminate unchanged layers", "When a stem states that a layer is unchanged — 'the instructions have not been edited', 'the Skill is the same version' — options that modify that layer are almost certainly wrong. Look for the option that addresses each symptom at the layer that did change."),
        pitfall("Reaching for a bigger model", "A more capable model or higher effort improves reasoning, not grounding. It will still use the outdated document in knowledge and the cross-client memory, only more eloquently."),
        pitfall("Changing several layers at once", "Rewriting instructions, swapping files and clearing memory in one sweep may fix the symptom, but nobody will know which change mattered, and the next regression will be just as mysterious. Fix the most likely layer, test against a saved reference output, then move on."),
      ],
      terms: ["configuration degradation", "knowledge freshness", "Skill version", "accumulated memory", "Project instructions", "Use account memory"],
      sources: [guide, memory, manageProjects, skills],
    },
    {
      objective: "6.1",
      title: "Judge whether a proposed use case is appropriate",
      takeaway: "Classify a proposed use as appropriate, appropriate with safeguards, or inappropriate — weighing task suitability, delegation limits, trust in third-party Skills and connectors, and the Anthropic Usage Policy — and write down the reasoning.",
      minutes: 4,
      blocks: [
        text("Before asking how to do something with Claude, a Diligent user asks whether it should be done with Claude at all, and under what conditions. The exam guide expects a three-way classification with a documented rationale: appropriate, appropriate with safeguards, or inappropriate. Four lenses inform it."),
        list(
          "Task suitability: does the task play to what Claude does well (drafting, summarizing, analyzing supplied material, structuring), and can its output be checked?",
          "Delegation limits: does the use hand Claude a decision that needs human judgment, empathy, authority or accountability?",
          "Trust in third-party Skills and connectors: where do the Skill or connector come from, what can they access, and has anyone reviewed them?",
          "The Anthropic Usage Policy: does the use fall under a prohibition, or into a high-risk area that carries extra requirements?",
        ),
        text("Anthropic's Usage Policy has universal standards that apply to everyone — for example, prohibitions on compromising privacy or identity rights, creating or spreading disinformation, engaging in fraudulent, abusive or predatory practices, and using it for surveillance, censorship or prohibited law-enforcement purposes. It also sets requirements for high-risk uses, where Claude's output informs recommendations in areas such as legal, medical, financial, credit, insurance, housing, employment, education and public-benefits decisions about people. For those, the policy requires a qualified human in the loop who meaningfully reviews the recommendation and has authority to change it before it is acted on, plus disclosure to the people affected that AI was involved. Separately, chatbots and AI agents that talk directly with external users must tell them they are interacting with AI rather than a human."),
        table(["Proposed use", "Classification", "Rationale"], [
          ["Draft first versions of internal newsletters from team updates", "Appropriate", "Suitable task, low stakes, reviewed by the editor as normal"],
          ["Summarize job applications to help recruiters prioritize", "Appropriate with safeguards", "Employment decisions are high-risk: recruiters review every application, criteria are documented, candidates informed of AI use per policy, output monitored for bias"],
          ["Automatically reject loan applicants based on Claude's assessment", "Inappropriate as proposed", "Consequential decision about individuals with no qualified human review"],
          ["Generate fake customer reviews for a product launch", "Inappropriate", "Deceptive activity prohibited by the Usage Policy"],
        ]),
        text("Third-party extensions get their own scrutiny. Anthropic's help center advises installing Skills only from trusted sources, names prompt injection and data exfiltration as the main risks, and recommends reviewing a less-trusted Skill's files and any instructions to connect to external networks before enabling it. Custom connectors are not verified by Anthropic, can carry hidden instructions if the server is malicious, and should be connected only when you trust the provider and have reviewed the permissions requested. On Team and Enterprise plans, many of these decisions sit with administrators; an associate's job is to recognize the risk and route it, not to bypass the controls."),
        code("text", "A documented appropriateness decision", `Use case:       Draft personalized follow-up emails to event attendees
                using a third-party CRM connector found online
Task fit:       Good - drafting from attendee notes; marketing reviews
Delegation:     Emails sent only after a person approves each batch
Third party:    Connector is unverified, requests read/write on all
                contacts -> NOT approved; ask IT for the sanctioned
                CRM integration or export a filtered list instead
Usage Policy:   No prohibited or high-risk category
Classification: Appropriate with safeguards (approved data path,
                human approval before send)
Recorded by:    Events lead, reviewed with IT, 12 Nov`),
        exam("Safeguards are specific", "'Appropriate with safeguards' answers must name real safeguards: a qualified reviewer with authority, de-identified data, an approved connector, disclosure to affected people. Vague options such as 'use carefully' or 'add a disclaimer' rarely satisfy a high-risk scenario."),
        pitfall("Treating availability as approval", "That a Skill can be uploaded or a connector added does not mean it is sanctioned for work data. Popularity, a polished listing or a colleague's recommendation is not a trust review."),
      ],
      terms: ["Diligence", "Usage Policy", "high-risk use case", "human-in-the-loop", "disclosure", "Skills", "custom connectors", "prompt injection"],
      sources: [guide, aup, skills, customConnectors],
    },
    {
      objective: "6.2",
      title: "Protect sensitive data before, during and after Claude work",
      takeaway: "Classify the data first, transform it to what policy allows before it reaches Claude — removing or coding identifiers and screening free text — and use memory, incognito and Project controls for what they actually do, not as substitutes for de-identification.",
      minutes: 4,
      blocks: [
        text("Data protection questions on the exam turn on order and on knowing what each control really does. The sequence is: classify the data under your organization's policy, decide what may be shared, transform it before upload (redact, anonymize, pseudonymize, aggregate), then choose the conversation settings that match the work's sensitivity. Once data has been uploaded, any protection applied afterward is too late for that disclosure."),
        text("The guide's sample item makes this concrete. An HR partner wants to analyze attrition with code execution on an export containing names, home addresses, salaries, performance ratings and free-text exit comments, and policy permits AI analysis only on de-identified data. The compliant approach de-identifies before uploading — removing names and addresses, replacing identifiers with codes, and screening the comments — and sets memory controls to fit the work. Incognito alone, a restricted Project, or asking Claude to anonymize after upload all leave identifiable data disclosed."),
        code("text", "Redaction example: an exit-interview row before and after", `BEFORE
emp_id, name,          address,            salary, rating, comment
10442,  Dana Whitfield, 18 Alder Rd, Leeds, 41200,  3,      "After Priya
        took over the Leeds warehouse team I was passed over twice..."

AFTER
code,  band, region, rating, comment
E-071, B3,   North,  3,      "After [MANAGER] took over the [SITE] team
                              I was passed over twice..."

Changes: name/address removed; ID replaced by key held only by HR;
salary converted to band; city generalized; names and site in free
text replaced; the code-to-person key never leaves the HR system.`),
        text("Free text is the trap. Comments, notes and email bodies carry names, roles, locations and incidents that can re-identify someone even after the obvious columns are gone. Small groups are another: a 'department of one' is identifiable by its row alone. Screen these before upload, aggregate where possible, and upload only the columns the analysis needs."),
        table(["Control", "What it does", "What it does not do"], [
          ["Incognito chat", "Not saved to history or memory; not used for training; not surfaced in chat search", "Does not prevent disclosure; still retained for a period, and on Team/Enterprise included in owner exports"],
          ["Memory off for one chat (from the '+' menu)", "That chat does not use or add memory; it stays in your history", "Does not remove data from the conversation"],
          ["Project scoping and 'Use account memory' off", "Keeps context and memory inside one work stream; limits who sees it via sharing", "Does not de-identify anything uploaded"],
          ["Deleting a memory topic", "Stops Claude using that remembered detail in future chats", "Deleting a chat alone does not delete memories made from it"],
          ["Plan-level data terms", "Commercial plans are not used for training by default; consumer plans have a model-improvement setting", "Neither replaces your organization's rules on what may be shared"],
        ]),
        text("A few memory facts help here. Anthropic's help center states that, by default, Claude does not store topics about personal or sensitive subject matter in memory unless you turn on 'Include sensitive topics in memory', and that certain items, such as government ID numbers, criminal history and financial account numbers, are never saved even if you ask. That is a safety net, not a policy: it governs what memory keeps, not what you disclosed in the conversation."),
        tip("Try it in Claude", "Use made-up data only. 1) Write a five-row sample with names, cities, salaries and one free-text comment that mentions a colleague. 2) De-identify it yourself before any upload: drop the names, band the salaries, generalize the cities and replace names in the comment. 3) Upload only the transformed version and ask Claude to summarize the comments by theme. 4) Then look at which memory or incognito setting would fit this work, and notice that none of them would have changed what the original file disclosed."),
        exam("Transform before you transmit", "In any option set, look for the answer that changes the data before it reaches Claude, in line with the stated policy. Options that rely on who can see the results, on chat retention settings, or on Claude cleaning the data after upload fail the same test: the sensitive data has already been shared."),
        pitfall("Uploading the whole export for convenience", "Analysis rarely needs every column. Dropping unneeded fields is the simplest, most effective protection, and it also makes Claude's work faster and cleaner."),
      ],
      terms: ["Diligence", "de-identification", "redaction", "anonymization", "incognito chat", "memory", "Use account memory", "code execution"],
      sources: [guide, incognito, memory, commercialTraining],
    },
    {
      objective: "6.3",
      title: "Close policy, ethics and diligence gaps you observe",
      takeaway: "When usage drifts from policy, name the gap precisely — compliance, bias, transparency, or Diligence — and decide whether it is a policy gap (the rules do not cover it) or a training gap (the rules exist but people do not follow or understand them), because each needs a different corrective action.",
      minutes: 3,
      blocks: [
        text("The final skill asks you to look at how a team actually uses Claude and compare it with the organization's AI policy. Diligence, the fourth competency of the AI Fluency framework, is taking responsibility for what we do with AI and how we do it. At team level, that means noticing patterns: drafts sent without review, sensitive data pasted into personal accounts, AI-written content presented as personal work, analyses that consistently disadvantage one group."),
        table(["Gap type", "What you observe", "Example"], [
          ["Compliance gap", "Practice violates an existing rule", "Client data pasted into a personal, non-company Claude account"],
          ["Ethical risk: bias", "Outputs systematically favor or disadvantage a group", "Candidate summaries describe women's leadership as 'supportive' and men's as 'decisive'"],
          ["Ethical risk: transparency", "People affected are not told AI was involved where they should be", "AI-drafted performance feedback presented as wholly the manager's own words"],
          ["Diligence lapse", "Responsibility skipped: no verification, no review, no ownership", "Research citations pasted into a published report without being opened"],
        ]),
        text("Then classify the root cause. A policy gap exists when the organization's rules are silent, unclear or out of date for the situation — for instance, the policy never mentions connectors, so nobody knows whether connecting a personal Gmail is allowed. A training gap exists when a clear rule exists but people do not know it, misunderstand it, or lack the skill to follow it — the policy requires de-identification, but staff do not know how to screen free-text fields."),
        table(["Root cause", "Corrective action", "What does not work"], [
          ["Policy gap", "Update or clarify the policy; assign an owner; communicate the change", "Retraining people on a rule that does not exist"],
          ["Training gap", "Targeted training, job aids, examples, checklists; reinforce in workflows", "Rewriting a policy that is already clear"],
          ["Both", "Clarify the rule, then train on the clarified version", "Disciplinary action as the first response to unclear guidance"],
        ]),
        code("text", "Gap analysis for an observed pattern", `Observation:    3 of 5 analysts send Claude-drafted client summaries
                without opening cited sources.
Policy says:    "AI-assisted external content must be verified by the
                author before release." (Section 4.2)
Gap type:       Diligence lapse -> compliance gap
Root cause:     Training gap. Rule is clear; analysts say they did not
                know citations could be wrong when they look specific.
Corrective:     30-min session on verification with real examples;
                add a verification checklist to the team's Project
                instructions; manager spot-checks 2 summaries a week
                for a month.
Not chosen:     Rewriting the policy (it is clear); banning Research
                (removes value, does not build the skill).`),
        text("Bias and transparency deserve explicit checks because they are easy to miss in individual outputs. Compare outputs across groups, read for loaded language and stereotyped examples, and ask whether the people affected would reasonably expect to know AI was involved. Where Claude informs decisions about people, the Usage Policy's high-risk requirements — qualified human review and disclosure — apply."),
        exam("Policy gap or training gap?", "Items often hinge on this distinction. If the stem quotes a clear rule that people are not following, the answer is training or reinforcement, not a new policy. If the stem shows that nobody could have known the right behavior because the policy is silent, the answer is to close the policy gap first."),
        pitfall("Fixing the instance, not the pattern", "Correcting one unreviewed report addresses today's error. The corrective action the exam rewards changes the conditions that produced it — the rule, the training, or the workflow checkpoint."),
      ],
      terms: ["Diligence", "policy gap", "training gap", "compliance gap", "bias", "transparency", "Usage Policy"],
      sources: [guide, fluency, aup],
    },
  ],
};
