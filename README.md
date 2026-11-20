# CertCity research and design

**Research date · November 12, 2026**

CertCity is a living city where residents, small businesses, schools, and corporations need help with real professional problems. Players explore neighborhoods, meet people, and see how their decisions change the places they visit. The first assignment is a logistics support incident at City Dispatch. A player follows a failed order lookup, changes the tool's response contract and recovery policy, and runs the same workload again to see what changed. The learning test comes later, in a different setting and without the game's visual cues.

**The first prototype began with one mixed-use neighborhood and the City Dispatch assignment.** The city now has four certification jobs on a block where restaurants, homes, a school, shops, offices, and a delivery depot have distinct roles. Let players discover the first job in the city and resume it directly. Use a fixed isometric view for discovery, a clear system view for decisions, and a short technical debrief for the exact API behavior. The first market test should recruit Claude Partner Network cohorts, since Anthropic limits exam access to that network. Keep open access to the skills demo. [Anthropic certification program](https://claude.com/resources/articles/four-role-based-claude-certifications)

## Visual prototype

Run `npm ci` and `npm run dev`, then open [CertCity on localhost](http://localhost:3000). The 3D city opens Downtown at Park Pacific on Olive Street. Use the district menu to visit the Gateway Arch, Enterprise Center, Ballpark Village, Delmar Loop, Forest Park, WashU, UMSL, Maplewood, Market Row and Lucas Gardens. Select a place and choose **Talk to** to meet its contact. City Dispatch opens with Nia’s report before the order lookup workflow. Use the footsteps button in Downtown to get closer to Olive and 13th and Central Library. At City Dispatch, replay T-17, compare your policy, and save a shift to keep its result in this browser. The [matched comparison](research/mockups/olive-corner-comparison.jpg) shows the first Blender asset pass. The [visual build notes](research/visual-build.md) describe the implementation and browser checks. The [FarmVille comparison](research/farmville-visual-audit.md) records the visual changes and St. Louis references.

The [St. Louis Blender source and reference guide](art/st-louis/README.md) covers the six expanded districts, their authored landmark meshes and the shared street assets.

The static build uses `https://certcity.org` for social preview URLs. Set `NEXT_PUBLIC_SITE_URL` before running `npm run build` when deploying to a different origin.

## Certification practice

Choose a credential when you enter the city. **Assignments** lists its starting missions, completed work, and the prerequisites for later assignments. The same places can offer different work across credentials. Read the case file, configure the system, run the workload, and save a successful policy. **Pathway progress** shows city application and first-seen exam checks across domains. **Exam practice and guides** opens optional independent study. The current portfolios contain 34 missions with playable decisions mapped to all 123 published July 2026 objectives. See the [mission-to-exam audit](research/mission-portfolios.md) for the mapping and simulation limits.

Each Academy pathway offers a full-length timed rehearsal. For Associate Foundations, Developer Foundations, and Architect Professional, choose your exam date to load the July or December 7 guide, rehearsal and domain results. The city and short practice sets use the July mappings. [Exam guide comparison](research/claude-certification-integration.md#december-7-guide-revision)

Open the **City Dispatch** card for the existing task 2.2 sequence. It covers the order lookup repair, technical debrief, optional Exam Lens, an exam-style check and a seven-day follow-up. Its saved progress and earlier results stay available in the same browser. Run `npm run check:claude` to check the certification bank and progress logic.

**City impact** shows saved outcomes across locations. The City Dispatch counters report simulated staff time, false replies, and direct spend per week. Workload replays show their own time period and before-and-after results in the same panel.

In **Order lookup**, select **Edit rule for T-17** in the workflow to jump to the relevant recovery setting. Changes update the ticket preview. **Run shift** checks their effect across the full simulated week. The [workflow usability notes](research/workflow-usability.md) record the design evidence and playtest tasks.

## Supabase

Copy `.env.example` to `.env.local` and set the project URL and publishable key. Restart the dev server after editing the file. On a deployment, set both values before building. The game is playable as a guest. Sign in with an email link to sync progress. Use **Account → Copy guest progress** to add saved work from this browser to the signed-in account.

For local development, run `supabase start` and use the local API URL and publishable key shown by `supabase status`. Read the sign-in link in the local Supabase mail catcher. On a hosted project, add the app origin to Auth redirect URLs and configure custom SMTP for learners outside the Supabase project team. The static app uses a Supabase Edge Function for authenticated Dispatch shift saves and study checks. Deploy it with `supabase functions deploy dispatch --use-api` after applying the migrations. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)

The schema notes cover the seeded catalog, access model, replay transaction, and remaining integration work. Run `supabase db query --local --file` with each SQL file in `supabase/tests` to verify access, assessment evidence, and Dispatch study scoring. Each check rolls back its fixtures. [Supabase schema and design decisions](research/supabase-schema.md)

## Research package

| Deliverable | Use it to decide |
|---|---|
| [A · Research findings](research/A-research-findings.md) | What the evidence says about the game, learning, certification, market and legal assumptions |
| [B · Game design and first mission](research/B-game-design.md) | What players do and how the first mission behaves, including original assessment examples and a worked operating model |
| [C · Visual direction](research/C-visual-direction.md) | What to show on each screen, what to take from the reference games, and how to produce and test the art |
| [D · Certification-to-gameplay blueprint](research/D-certification-blueprint.md) | How all 30 published CCAR-F task statements map to proposed gameplay and independent evidence |
| [E · Technical architecture](research/E-technical-architecture.md) | How to implement the browser game, simulation, AI, assessment, and versioned content |
| [F · Development toolchain](research/F-development-toolchain.md) | Which tools to use in the repo and what access they need |
| [G · MVP implementation plan](research/G-mvp-plan.md) | What to build first, how to validate it, and when to expand |
| [H · Risks and open questions](research/H-risks.md) | What could invalidate the design or business, who owns the response, and what evidence would change the decision |
| [Research-to-decision register](research/decision-register.md) | Evidence, alternatives, confidence, and validation for consequential decisions |

The two founder documents were used as inputs. The prototype economics are reproducible synthetic scenarios. The experience still needs renderer benchmarks, content review, learner testing, and buyer validation. The curriculum map is pinned to CCAR-F v1.0 (July 2026) and records mapped, playable, and validated coverage.
