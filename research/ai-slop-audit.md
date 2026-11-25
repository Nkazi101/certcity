# CertCity "AI slop" audit (2026-11-24)

Scope: app/**/*.tsx, components/**/*.tsx, globals.css, academy.css, components/**/*.module.css, lib/seo.ts, lib/claude/public-guides.ts, lib/city-dialogue.ts, lib/claude/mission-experiences.ts, README. Live text pulled from `http://localhost:3000` (home, /certifications, /certifications/architect-foundations, developer-foundations, methodology, help, december changes, dispatch case). Saved text: `scratchpad/slop/pages/*.txt`.

**Limits.** The screenshots folder (`scratchpad/shots/`) does not exist; no PNG/JPG files were found anywhere in the scratchpad. All visual findings come from CSS and JSX. WebFetch and outbound curl were blocked, so research comes from WebSearch result summaries. The URLs below are the cited pages. Their wording was not checked against the originals.

---

## 1. Research summary

### Sources
- Anthropic, "Improving frontend design through Skills": without guidance, models default to Inter, purple-on-white gradients and minimal motion, and users call that convergence the "AI slop" aesthetic. https://claude.com/blog/improving-frontend-design-through-skills
- Nielsen Norman Group, "AI prototyping": without visual specs, generated UIs share a generic sans-serif, minimal look. NN/g blames training-data patterns plus shadcn/Tailwind defaults, and says the output looks "good from afar, but far from good." https://nngroup.com/articles/ai-prototyping/
- Wikipedia, "Signs of AI writing" (WikiProject AI Cleanup): negative parallelisms ("not X, but Y"; "no…, no…, just…"), rule-of-three padding, formulaic em dashes (now listed as a fading or historical sign), promotional tone, undue emphasis on significance, title-case headings, and inline bold labels. The page warns these are signals, not proof. https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing ; coverage at https://techcrunch.com/2025/11/20/the-best-guide-to-spotting-ai-writing-comes-from-wikipedia/
- uxdesign.cc, "AI design isn't ugly, it's fluent, and that's the problem": Lovable, v0 and Claude Code share defaults (Inter, shadcn, Lucide, Tailwind spacing). https://uxdesign.cc/ai-design-isnt-ugly-it-s-fluent-and-that-s-the-problem-131b2f4eb78c
- Fountain Institute, "7 Signs a UI Has Been Vibe Coded". https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui
- Kosta Canatselis, "Spot the slop: a UI designer's guide to fixing AI defaults": gradients belong as a single accent. https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c
- Impeccable anti-patterns catalog (glows, glass cards, identical card grids, gradient text). https://www.mintlify.com/pbakaus/impeccable/concepts/anti-patterns and https://impeccable.style/gallery
- Laith0003 ux-skill wiki, "Anti AI slop ban list" and "How to detect AI slop": identical icon+heading+text card grids, wide-tracked uppercase eyebrows, unnecessary labels above content, centered everything, filler microcopy, fake dashboards. https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list
- pixelslop "AI Slop Pattern Catalog" (gradient text, metric tiles). https://cdn.jsdelivr.net/npm/pixelslop@0.3.8/dist/skill/resources/ai-slop-patterns.md
- "How to Fix AI Slop in Web Design, Tell by Tell": surface tells vs content tells such as filler microcopy and fake dashboards with no hierarchy. https://capitalandcompute.net/blog/fix-ai-slop-design/
- dev.to, "Why every AI-built website looks the same: blame Tailwind's indigo-500". https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p
- Indie Hackers, "The AI purple problem". https://www.indiehackers.com/post/the-ai-purple-problem-why-every-ai-brand-looks-the-same-6cb0aa2a02
- Decrypt, "The 5 biggest tells something was written by AI": negative parallelism is first on its list. https://decrypt.co/348923/5-biggest-tells-something-written-ai ; tildes thread "It's not just X, it's Y": https://tildes.net/~humanities/1ugu/its_not_just_x_its_y
- Search Engine Land, AI writing tics vs engagement study ("not only… but also" correlated with lower engagement). https://searchengineland.com/ai-writing-tics-engagement-study-470051
- Ragan, "Obvious signs copy is AI generated" (filler adjectives). https://ragan.com/?p=319382
- UXmatters, "Instructional text in the user interface": users skip static instruction text; fix the label rather than adding text. https://uxmatters.com/mt/archives/2007/03/instructional-text-in-the-user-interface-some-counterintuitive-implications-of-user-behaviors.php ; "Designing for intrinsic understanding": https://www.uxmatters.com/mt/archives/2019/03/designing-for-intrinsic-understanding.php
- AIES paper "Design Theater": generative UI tools write design rationales that don't match what they build. https://ojs.aaai.org/index.php/AIES/article/download/43227/50787/47333
- Counterpoint on em dashes (Stanford, May 2026). https://cs.stanford.edu/people/brando9/2026/05/04/em-dash-not-an-ai-fingerprint.html

### What the critics agree on
The loud tells are easy to spot and easy to remove: purple gradients, glass, emoji bullets, "Unlock/Elevate/Seamless", and em dashes. The deeper tell is *fluency without decisions*. Every element gets the same treatment: an icon, an eyebrow label, a pill and a subtitle. Copy explains the system instead of telling the user what to do. Values are nudged locally instead of drawn from a scale. And content looks complete from afar but doesn't hold up up close (fake dashboards, plausible but wrong copy, a rationale that doesn't match the build).

---

## 2. Checklist (detect → better)

### Visual
| # | Tell | How to detect | What good looks like |
|---|---|---|---|
| V1 | Purple/indigo gradients, gradient text | grep `gradient`, `#6366f1`, `#8b5cf6`, `background-clip:text` | One brand hue chosen for the product; gradients only for texture or atmosphere |
| V2 | Glassmorphism | `backdrop-filter: blur` on cards | Solid surfaces; blur only behind true overlays |
| V3 | Inter and rounded cards everywhere | `--sans: Inter`; >5 distinct `border-radius` values | Type chosen for the voice; 2–3 radius tokens |
| V4 | No system, only nudged values | count distinct font-size, font-weight and hex values | A type scale of 6–8 sizes, 3 weights, a palette of about 20 tokens |
| V5 | Icon in a tinted rounded square beside every heading or card | `<Icon size=` count; `.x-icon {background:…; border-radius}` | Icons only where they help scanning or act as controls; no decorative icon tiles |
| V6 | Meaningless repeated icon (same icon on every row) | the same icon component in `.map()` | Drop it, or use an icon that encodes state |
| V7 | Wide-tracked uppercase eyebrow above every title | `text-transform:uppercase; letter-spacing:.07em; font-size:9–10px` | Let the heading carry the meaning; one eyebrow style at most, ≥11px |
| V8 | Colored side-stripe border on cards | `border-left: 3–5px solid accent` | Use stripes for one semantic (for example, warnings) only |
| V9 | Pills and badges for everything | `Pill`, `badge`, `border-radius:99px` count | Plain text status; badges only for state that changes |
| V10 | Sparkles icon for "AI" | `Sparkles` import | Name the thing |
| V11 | Generic stock 3D / hero image cards | hero = dark gradient card + image right | Show the product's own world or a real screen |

### Layout
| # | Tell | Detect | Better |
|---|---|---|---|
| L1 | Hero + 3–4 identical feature cards | `cards` grid of icon+h3+p | One clear path; lists for content that isn't parallel |
| L2 | Numbered "How it works" step list with icons | `studySteps` array of {icon,title,description} | Delete it, or make the steps actual links into the steps |
| L3 | Duplicate CTAs and jump navs to content right below | two links with the same label in one card; an "on this page" nav for three sections | One primary action per card; no jump nav under one screen of content |
| L4 | Stacked status widgets (dashboard sprawl) | several fixed HUD elements all showing progress | One status element; the rest on demand |
| L5 | Stat-tile triads (big number + small label ×3) | `summary` grids of `<strong>n/N</strong><span>label</span>` | One sentence with the number that matters now |
| L6 | Zero-padded step numbers "01 02 03" | `padStart(2,"0")` | Plain numbers, or none |

### Copy
| # | Tell | Detect | Better |
|---|---|---|---|
| C1 | Buzzwords (unlock, elevate, seamless, robust, leverage, journey, hands-on, master) | regex count | Concrete verbs and nouns from the domain |
| C2 | Negative parallelism / aphorism ("X is not Y", "evidence, not authority") | `/, not |is not /` in headings | State the observation; let the learner draw the rule |
| C3 | Tricolons and list templates | "A, B, and C" in every description; the same sentence frame repeated | Vary rhythm; name the one thing that matters |
| C4 | Anaphora across siblings (every card starts with the same verb) | first word of sibling descriptions | Lead with what's distinct |
| C5 | Over-explaining (justifying the UI inside the UI) | sentences that start "This…", "Each…", "Spacing review improves…" | Put the instruction in the label; move rationale to Help |
| C6 | Internal jargon leaking (pathway, module, evidence, first-seen, retention lab, reassessment, Exam Lens, rehearsal) | the same concept under several names | One noun per concept, in the user's words |
| C7 | Separator tics (em dash, or here the " · " middle dot) | count | Sentences, or a single meta line |
| C8 | Title Case headings mixed with sentence case | compare h1s | Pick one (sentence case) |
| C9 | Over-claiming ("hands-on", "real", "full-length", "practical" for picking options) | compare the claim with the interaction | Name the actual interaction |
| C10 | Summary sentences that restate the list ("All three conditions matter") | the last sentence repeats the previous ones | Cut it |

### Interaction / assessment (specific to a study product)
| # | Tell | Detect | Better |
|---|---|---|---|
| I1 | The longest, most hedged option is correct | length rank of the keyed option | Balance lengths; make distractors plausible and specific |
| I2 | Giveaway words in distractors ("Only…", "Declare…", "unapproved", "trust") | regex on options | Distractors that a competent but wrong person would choose |
| I3 | Headings that state the answer before the learner chooses | panel or section titles phrased as rules | Neutral nouns ("Supplier PDF", "Credentials") |
| I4 | Scoring internals exposed as microcopy ("Marks this objective as guided") | — | Show the cost in plain words ("Won't count toward your score") |

---

## 3. Overall verdict

CertCity has **already removed the loud tells**. There is no purple (the palette is green, paper and orange), no glassmorphism except one 12px blur on the workbench dialog, no emoji (one "✓"), one em dash in all of app/components, and almost no buzzwords. The only C1 hits are "hands-on" (16) and "journey" (1). Copy sentences are mostly short, concrete and honest. The methodology page openly says the benchmark is "provisional."

The slop that remains is the **second-order, structural kind** that NN/g and the uxdesign.cc piece describe:

1. **No visual system.** There are 62 distinct font sizes, 28 font weights (500, 520, 550 … 755, 760, 780, 850), 916 distinct hex colors and 15 border-radius values (3–16px). 63 declarations in globals.css set text at 7–10px. This is the CSS fingerprint of many local generations, each nudged by eye.
2. **Decoration on every element.** There are 263 `<Icon size=…>` usages from 61 distinct Lucide icons. The mission lab uses 29 `eyebrow=` labels and 27 `<Pill>`s. Icon tiles sit beside each track. 9px uppercase eyebrows head every panel. "01/02/03" step numbers. 26 accent side-stripe borders.
3. **Progress shown in four overlapping vocabularies at once** (City impact, Module progress, Pathway progress, Learning progress, Exam preparation, Progress by domain, Question practice by domain, Practice history).
4. **Internal jargon as UI** ("first-seen", "applied", "guided", "evidence", "retention lab", "reassessment", "rehearsal", "Exam Lens", "pathway", "module", "short-runway plan").
5. **The middle dot " · " (202 in JSX, 323 in rendered pages) has replaced the em dash** as the house tic.
6. **Assessment slop**: in **8/8 public sample questions the keyed answer is the longest option**. Distractors use giveaway words ("Only the first row…", "Only the overall monthly invoice", "Declare…", "unapproved"). Board panel titles state the answer as an aphorism ("Unavailable is not empty", "Document is evidence, not authority").

---

## 4. Findings by surface (priority order)

Severity: **P0** = first-run or public page, visible to everyone; **P1** = main study loop; **P2** = polish or system.

### 4.1 Homepage / first-run (components/certcity.tsx, city-certifications.tsx, city-impact.tsx)

**F1 (P0) Welcome card is a generic category label, not a promise.** `components/certcity.tsx:958-959`
- Now: h1 "Claude certification practice" / "Do practical assignments in a 3D St. Louis. Choose your certification to see where to start."
- Why: a category noun used as the headline is the default hero. "Practical assignments" is vague, and the card doesn't say what you'll do in the first minute.
- Replace: h1 **"Practice for your Claude exam in a 3D St. Louis"**; p **"Pick your exam and we'll walk you to the first building with a problem to fix."**

**F2 (P0) Icon + label + arrow on every button.** `certcity.tsx:960-965` (GraduationCap … ArrowRight; BookOpen …), the same pattern at 154, 250, 939-948; `city-certifications.tsx:37-39,47`.
- Why: leading icon plus trailing arrow on every control is the Lucide-default look. The two icons say nothing the label doesn't.
- Fix: keep the arrow only on the single primary CTA. Drop leading icons from text buttons (`GraduationCap` at 961, `BookOpen` at 964 and 948, `Wrench` at 939).

**F3 (P0) HUD stacks four status widgets.** `certcity.tsx:925-930` (CityImpact + `moduleProgress` + "Pathway progress" button) plus the quest HUD at `969-981`. CSS `globals.css:854-885`.
- Why: three separate progress concepts at top-left plus "Next assignment" at bottom-left. This is the fake-dashboard pattern. "Module progress" and "Pathway progress" open different dialogs with near-identical names, and a new user can't tell them apart.
- Fix: on the city view show **only the quest HUD**, with a progress fraction folded in: label **"Next · 2 of 9 done"**. Remove the "Pathway progress" button (930): the header's track-code button (`864-867`) already opens it. Render `moduleProgress` only inside the Dispatch workflow header (999), not in the city HUD (927). Collapse CityImpact to a one-line chip (F5) shown only after a save.

**F4 (P0) Certification chooser: the same icon on every row, plus parallel copy.** `city-certifications.tsx:38` (`GraduationCap` on all 4 rows) and `lib/claude/blueprints.ts:54,70,87,101`.
- Now: all four descriptions start with "Practice…" followed by a three-part list ("Give clear instructions, check drafts, and decide when…"; "Design integrations, evaluate rollout evidence, and plan…").
- Why: a repeated meaningless icon (V6), plus anaphora and tricolons (C3/C4). The row doesn't say who each exam is for.
- Replace (who it's for + first job):
  - CCAO-F: **"For people who use Claude at work. First job: answer three families at the Maplewood school."**
  - CCDV-F: **"For developers on the Claude API, Claude Code and MCP. First job: stop a bad invoice reaching the ledger."**
  - CCAR-F: **"For engineers designing agent systems. First job: fix City Dispatch's false 'order not found' replies."**
  - CCAR-P: **"For architects running enterprise rollouts. First job: choose which support assistant to pilot."**
  - Replace the per-row `GraduationCap` with nothing (keep the `Check` for the selected row).

**F5 (P0) City impact HUD shows three SaaS-style metric tiles with icons.** `components/city-impact.tsx:16-20,25-30`
- Now: "City impact · per simulated week" + [Clock] 13 h Staff time saved / [MessageCheck] 160 False replies avoided / [Coins] $… Direct cost saved.
- Why: the icon+number+tiny-label triad (10px labels, `globals.css:883`) is the "fake dashboard" tell, and the dollar figure is simulated. In the HUD it reads as a vanity metric.
- Fix: one line, no icons: **"Dispatch: 160 fewer wrong replies a week"**, with the details in the dialog. Remove `icon` from `metrics` in the HUD rendering.

**F6 (P0) "Next:" provider teaser over-claims a roadmap.** `city-certifications.tsx:46` ("Next: Microsoft Azure AI, AWS AI, Google Cloud AI."), `app/certifications/page.tsx:80` ("Planned next: …").
- Why: announcing three hyperscaler certs in a Claude-only product is the "coming soon" filler that signals ambition rather than substance. It also pulls attention on the first decision screen.
- Fix: delete both lines. If a roadmap is needed, put it on /help.

**F7 (P1) "Exams by Anthropic" sub-heading is filler.** `city-certifications.tsx:33`, `app/certifications/page.tsx:57`. Delete it. "Claude certifications" already says it.

### 4.2 Catalog page (app/certifications/page.tsx, catalog.module.css, catalog-progress.tsx)

**F8 (P0) Title Case H1 and SEO titles.** `lib/seo.ts:9` "CertCity · Hands-On Claude Certification Practice", `:15` "Claude Certification Exam Practice", `:21` "Study Help and Progress Recovery", `:39`; every in-app heading is sentence case.
- Why: Title Case headings are a listed Wikipedia sign, and here they clash with the product's own voice.
- Replace: `seo.ts:9` **"CertCity: Claude certification practice in a 3D city"**; `:15` **"Claude certification exam practice"**; `:21` **"Study help and progress backup"**. (The `<title>` can keep "· CertCity".)

**F9 (P0) Generic SaaS hero card.** `catalog.module.css:7-27` (dark `linear-gradient(115deg,#162420 42%,#2c493e)` card, 18px radius, image on the right, h1 at `letter-spacing:-.056em`); copy at `page.tsx:48-49`.
- Now: "Learn the skills on the exam by doing the work. Start with a city assignment or go straight to exam practice." + "Compare the four tracks ↓".
- Why: gradient hero card + tight-tracked giant h1 + scroll-down link to content 200px below is the template hero. "Learn X by doing the work" is a stock line.
- Fix: drop the gradient (`background:#162420`), set h1 `letter-spacing:-.02em`, and delete the "Compare the four tracks" link (the cards are directly below). Copy: **"Four Claude exams. Each has a lesson per objective, city cases, and timed practice exams."**

**F10 (P0) Redundant jump nav + duplicate "Study guide" link in every card.** `page.tsx:58-60` (trackIndex nav to four cards right below it); `page.tsx:73` ("Study guide" link) **and** `catalog-progress.tsx:58` ("Study guide" again). Rendered text shows "Study guide … Enter city pathway / Study guide / Exam practice".
- Fix: delete `trackIndex` nav (58-60) and the link at `page.tsx:73`. Card actions become: primary **"Start in the city"** (or "Continue practice") + secondary **"Study guide"**, **"Practice exams"**.

**F11 (P0) Icon tile + code pill + icon-prefixed lines on each card.** `page.tsx:66-73`; `academy.css:29-35` (`.academy-track-icon` 43px tinted rounded square in four pastel tints).
- Why: Lucide-in-tinted-square is the canonical AI card. `UsersRound/CodeXml/Layers3/Compass` carry no meaning.
- Fix: remove `.academy-track-icon` from cards and track heroes (`public-track-guide.tsx:20`, `workspace.tsx:343`). Use the code (CCAR-F) as the visual anchor in the mono face at 14px. Remove `ClipboardCheck` and `GraduationCap` icons from lines 72-73.

**F12 (P1) "How to prepare" four-step icon list.** `page.tsx:14-19, 82-90`.
- Why: an icon+title+description list of generic steps ("Learn each objective / Work a city case / Practice your weak domains / Rehearse under a timer") is the "How it works" section. Step 3, "Connect the work to the exam guide, then test the same skill on a new case", is abstract.
- Fix: cut the icons. Make each step a link and cut it to three: **"1. Read the lesson for each objective → 2. Fix a city case that uses it → 3. Take a timed 60-question practice exam."**

**F13 (P1) "Enter city pathway" is jargon.** `catalog-progress.tsx:54`, `public-track-guide.tsx:26`. Users don't know what a "pathway" is. Replace with **"Start in the city"** (or **"Open the first case"**).

### 4.3 Track landing page (components/academy/public-track-guide.tsx, lib/claude/public-guides.ts)

**F14 (P0) Every public sample question is answerable by length.** `lib/claude/public-guides.ts:20-48`. Keyed option is the longest in **8/8** (lengths e.g. [40,71,50], [55,56,100], [38,82,56], [46,31,90]). Distractors carry giveaway words: "Only the first row to minimize tokens." (`:30`), "Only the overall monthly invoice." (`:48`), "Declare the inventory complete because both specialists replied." (`:38`), "Retry until a response arrives." (`:39`).
- Why: "the longest, most qualified answer is right" is the most recognizable LLM-written MCQ tell. These are SEO landing pages, so they're the first thing an expert sees, and they undercut the readiness claim. It matches the earlier audit (word-cue guessing 54–66%).
- Fix example (`:39`, timeout policy): options → **"Return no results and log the timeout."** / **"Retry with backoff until the 30-second client timeout."** / **"Retry once if time remains, otherwise hand off with the timeout code."** (all 50–70 chars, each a policy a real engineer might ship). Add a CI guard: keyed option is not uniquely longest in more than 40% of items per bank.

**F15 (P1) Three equal CTAs with inconsistent icons.** `public-track-guide.tsx:24-26` (icon-left, arrow-right, icon-left). Fix: one primary **"Start the study guide"**. Make "Practice exams" and "Start in the city" text links, with no icons.

**F16 (P1) Repeated tricolon template.** `public-track-guide.tsx:68` "Inspect the evidence, make a decision, and replay the outcome." Almost the same line appears at `page.tsx:16` ("Inspect the evidence, make a decision, and see what happens.") and in methodology. Replace with the concrete case: **"T-17 timed out but the customer was told the order didn't exist. Find out why and change the rule."** (per track: use `introductions[track].greeting` from `city-dialogue.ts`).

**F17 (P2) Redundant "On this page" nav for three sections.** `public-track-guide.tsx:30-34`. Delete it.

### 4.4 Practice workspace (components/academy/workspace.tsx, readiness-panel.tsx, capstone-workspace.tsx)

**F18 (P0) About 15 panels before and around the first question; four separate progress summaries.** Order in `workspace.tsx:341-560`: hero with exam stats → blueprint line → exam date → study-guide card → first-assignment card → 8-link pathway nav (393-402) → EntryBridge → **Learning progress** (409-420) → Mixed practice → Full-length exams → **Exam preparation** (ReadinessPanel) with **Progress by domain** → GuideSkills → December workshop → Hands-on labs → **Question practice by domain** → sidebar (Spaced review, **Practice history**, Official resources, Other paths).
- Fix: put **"What to do next"** first (one card computed from state: "Read lesson 2.3", "Take practice exam A", "Retention lab opens Dec 1"). Merge "Learning progress" (409-420) into ReadinessPanel and delete the former. Cut the pathway nav to four links: **Lessons · City · Practice · Exams**. Move "Other Claude study paths" to the footer.

**F19 (P0) 17-word definition-list labels.** `workspace.tsx:416` "City objectives finished with a revealed answer or worked example (practice again to count them)"; `:417` "… objectives correct on a first-seen city check"; `city-certifications.tsx:146` "Objectives answered correctly on a first-seen exam check".
- Why: the label explains the scoring model. The UI is over-explaining (C5) and leaking jargon (C6: "first-seen", "applied", "guided").
- Replace: `:416` **"Needed a hint (redo to count)"**; `:417` **"Right first time"**; `:415` **"Objectives practiced"**; `city-certifications.tsx:145-146` **"Practiced in the city"** / **"Right first time"**.

**F20 (P1) Readiness panel copy.** `readiness-panel.tsx:33-38`
- Now: h2 "Exam preparation" + badge "Practice benchmark in progress" + "Short-runway plan: meet the target on two unseen practice exams and pass the hands-on lab."
- Why: "benchmark", "short-runway plan" and "unseen" are internal terms. The badge says nothing.
- Replace: h2 **"Are you ready?"**, badge **"Not yet"** / **"Ready by our measure"**; body (normal) **"To be ready: score 70%+ on a practice exam you haven't seen, pass the hands-on lab, then pass the retention lab 7 days later."**; cram **"Exam in under 2 weeks: score 70%+ on two fresh practice exams and pass the hands-on lab."** (use `rehearsalTarget.overall` for the number).

**F21 (P1) Decorative icons beside panel headings.** `workspace.tsx:359` (CalendarDays), `:424` (ClipboardList), `:526` (RotateCcw), `:547` (BookOpen); kicker with icon `:376,:384`. Remove all of them. The `academy-kicker` "Learn before you practice" (376) is an eyebrow restating the h2 below, so delete it.

**F22 (P1) The UI justifies itself.** `workspace.tsx:527` "…Spacing review improves recall on exam day."; `:458-460` three explanatory sentences before the exam buttons; `capstone-workspace.tsx:372` "Write real Claude artifacts (settings files, API requests, instructions, plans) from a set of case files. Each check parses what you wrote, runs it against fixtures, and explains what to fix. Results are saved separately from city progress."
- Replace: `:527` **"New questions on the same skills open 7 days after mixed practice."**; `:458-460` → **"120 minutes · results by domain. Keep one exam unseen for your final check."**; capstone → **"Write the config, request or plan the case asks for. We check it against test cases and tell you what to fix."**

### 4.5 Mission panels (role-mission-board.tsx, mission-lab.tsx, case-workbench.tsx, mission-experiences.ts)

**F23 (P0) Panel titles state the answer as aphorisms.** `role-mission-board.tsx:76` "Document is evidence, not authority", "Validate before execution" (77), "Separate credentials" (78), `:106` "Unavailable is not empty", `:94` "Human review where judgment matters", `:97` "Stable prefix before variable facts", `:102` "Authorized capabilities only", `:104` "Track every retained copy", `:86` "Include retries and service outcome", `:96` "Check all operating limits"; `mission-lab.tsx:109` "Separate lookup from creation", `:118` "Keep unlike counts auditable", `:134` "Protect the booking write".
- Why: this is the negative-parallelism/aphorism tell (C2), and it gives away the decision before the learner makes it (I3).
- Fix: use neutral object names. `:76` → **"Supplier PDF"**, `:77` → **"Cleanup request"**, `:78` → **"Credentials"**, `:106` → **"Search results"**, `:94` → **"Review queue"**, `:97` → **"Context order"**, `:102` → **"Tool list"**, `mission-lab.tsx:109` → **"Catalog tools"**, `:118` → **"Exhibit label"**, `:134` → **"Booking write"**.

**F24 (P1) Icon + 9px uppercase eyebrow + title + pill on every panel.** `role-mission-board.tsx:15` (`Panel`: Icon + `<small>{label}</small>` + title); `mission-lab.tsx:40-55` (`Artifact`: icon + eyebrow + title + Pill), 29 eyebrows and 27 Pills in that file; CSS `globals.css:1434` (9px uppercase .07em), `:1447` (8px uppercase pill), `:1164,1172,1186,1192,1260,1291` (10px uppercase).
- Why: four layers of label for one card (V5/V7/V9), much of it below legible size.
- Fix: drop the Icon from `Panel` and `Artifact`, and drop `eyebrow` where it repeats the title (most of them). Set the floor to 12px for labels with `text-transform:none; letter-spacing:0`. Replace Pills with plain colored text for state.

**F25 (P1) Sparkles icon and zero-padded steps.** `role-mission-board.tsx:47,74` (`Sparkles` for "Program planning" and "Shared procedure"), `:19` (`padStart(2,"0")` → 01 02 03). Use `FileText` or no icon, and plain numbers.

**F26 (P1) Scoring internals as hint microcopy.** `case-workbench.tsx:74-75,99` "Concept · Still counts as applied", "Worked example · Marks this objective as guided", "Show the answer · Marks this objective as guided".
- Replace: **"Hint: a short explanation (still counts)"**, **"Worked example (won't count as right first time)"**, **"Show answer (won't count)"**.

**F27 (P1) Arrival lines follow one inventory template.** `lib/claude/mission-experiences.ts` (34 `arrival:` strings, e.g. `:106` "A draft bulletin, vendor form, approval stamp, and two send lists are waiting at the market manager's desk.", `:113`, `:120`, `:127`, `:141`, `:176`, `:183`, `:197`, `:204`, `:211`, `:218`, `:225`, `:232`).
- Why: "[four nouns] are [open/pinned/waiting] at [place]" repeated 34 times is a list template (C3) and reads like a prop inventory, not a scene.
- Fix: lead with the problem in one beat, e.g. `:106` **"Inez has the new market hours signed. Two vendor forms aren't."**; `:113` **"A new chat quoted a rule that only lives in one librarian's old conversation."**

**F28 (P2) Summary sentence restating a list.** `lib/city-dialogue.ts:19` "Operations set a latency target. Finance set a cost ceiling. Support has the final say on disputes. **All three conditions matter to the pilot.**" Delete the last sentence (C10).

### 4.6 System / CSS

**F29 (P2) No type, weight, color or radius scale.** 62 font sizes, 28 weights, 916 hex colors, 15 radii (counts across globals.css, academy.css and academy modules).
- Fix: add tokens to `globals.css:1-15`: `--fs-1:12px; --fs-2:14px; --fs-3:16px; --fs-4:20px; --fs-5:28px; --fs-6:40px; --fw-regular:450; --fw-strong:650; --fw-heavy:780; --r-sm:6px; --r-md:10px; --r-lg:16px`. Codemod every `font-weight: 5xx|6xx|7xx` to the nearest of the three, and every radius to the nearest of the three. Set a minimum font size of 12px.

**F30 (P2) Side-stripe accent borders (26).** `globals.css:269,288,1171,1638,1759,1802,1808,1838`; `academy.css:87,387`. Keep only `.academy-notice` (warnings) and the case "paper" metaphors. Remove the stripes from `.quest-hud` (269) and `.city-welcome` (288); the cream background already sets them apart.

**F31 (P2) The middle-dot tic.** There are 202 occurrences of " · " in JSX, e.g. `certification-dialog.tsx:187` "Complete · Suggested next · …", `readiness-panel.tsx:40` "x/y correct · Overall target met", `workspace.tsx:428`. Use real sentences or labels: "**Done.** …", "**Next:** …". Keep "·" only in true meta lines (date · count).

**F32 (P2) Inter as the sans.** `globals.css:13`. Inter is the top default-font complaint (Anthropic, uxdesign.cc). The 3D city is illustrative and warm, so a humanist sans with more character (Source Sans 3, Atkinson Hyperlegible, or IBM Plex Sans to pair with the existing Plex Mono) would separate the brand. Low priority, high visibility.

### 4.7 Over-claims

| Where | Claim | Reality | Fix |
|---|---|---|---|
| `lib/seo.ts:9` | "Hands-On Claude Certification Practice" | Most activity is multiple choice plus option pickers. Only the capstone involves writing text | **"Claude certification practice in a 3D city"** |
| `lib/seo.ts:16`, `public-track-guide.tsx:40`, `workspace.tsx:378`, `page.tsx:15` | "with the real configuration, API and workflow details" | Earlier audit: tool_choice, .claude/commands, permission modes, Bedrock/Vertex never taught | Drop "real" until the lessons carry the syntax: **"one lesson per exam objective"** |
| `capstone-workspace.tsx:17,371-372` | "Hands-on lab", "Write real Claude artifacts … runs it against fixtures" | Mixed selects and textareas, checked by a parser, with no Claude call | **"Written lab"**; **"checked against test cases"** |
| `certcity.tsx:959` | "Do practical assignments in a 3D St. Louis" | The work happens in 2D dialogs; the city is the way in | **"…we'll walk you to the first building with a problem to fix."** |
| `city-certifications.tsx:46`, `page.tsx:80` | "Next: Microsoft Azure AI, AWS AI, Google Cloud AI" | Not built | Delete |
| `README.md:5` | "CertCity is a living city where residents … need help with real professional problems" | Fictional simulated cases | **"CertCity is a 3D St. Louis where each building holds a simulated Claude deployment problem."** |
| methodology mapping | "Publish the vendor bulletin" is mapped to 1.1, 1.2, 2.1 and 2.5 | One mission claims four objectives | Show the count honestly, or add missions |

### 4.8 Vocabulary sprawl (one concept, many names)

| Concept | Names in the UI | Pick one |
|---|---|---|
| A city task | assignment, mission, case, work, job | **case** (or **assignment**, consistently; the nav says "Assignments" while the dialog heading says "City missions", `city-certifications.tsx:107`) |
| Overall progress | Pathway progress, Module progress, Learning progress, Exam preparation, City impact | **Progress** (one dialog) |
| Quiz after a case | exam-style check, skill check, exam check, study check, Exam Lens | **Practice questions**; rename "Open Exam Lens" (`system-view.tsx:184`, `certification-dialog.tsx:196`) → **"Try an exam question on this"** |
| Spaced retest | follow-up, seven-day follow-up, retention lab, reassessment, delayed practical case, spaced review | **7-day review** |
| Timed exam | rehearsal, practice exam, form, full-length practice exam | **Practice exam** (help page `app/help/page.tsx:21` says "rehearsal or domain reassessment" → **"practice exam or domain retest"**; `study-email-preferences.tsx:13` "Academy follow-up, delayed practical case, or City Dispatch follow-up" → **"when a 7-day review opens"**) |

---

## 5. Things to keep (not slop)
- The palette (green, paper, orange) and the paper or case-file textures in `capstone-workspace.module.css:52-84`. They're specific to the product.
- City dialogue voice (`city-dialogue.ts`), which is concrete and character-driven.
- System-view step copy (`system-view.tsx:25-29`): imperative, specific and short.
- Honest caveats: methodology "benchmark is provisional", `session.tsx:265` scaled-score note, the dispatch case's "uses more lookup calls and increases simulated direct spend."
- No gradient text, glass, emoji, motion overload or buzzwords.
