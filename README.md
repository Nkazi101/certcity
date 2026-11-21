# CertCity research and design

**Research date · November 12, 2026**

CertCity is a living city where residents, small businesses, schools, and corporations need help with real professional problems. Players explore neighborhoods, meet people, and see how their decisions change the places they visit. The first assignment is a logistics support incident at City Dispatch. A player follows a failed order lookup, changes the tool's response contract and recovery policy, and runs the same workload again to see what changed. The learning test comes later, in a different setting and without the game's visual cues.

**The first prototype began with one mixed-use neighborhood and the City Dispatch assignment.** The city now has four certification jobs on a block where restaurants, homes, a school, shops, offices, and a delivery depot have distinct roles. Let players discover the first job in the city and resume it directly. Use a fixed isometric view for discovery, a clear system view for decisions, and a short technical debrief for the exact API behavior. The first market test should recruit Claude Partner Network cohorts, since Anthropic limits exam access to that network. Keep open access to the skills demo. [Anthropic certification program](https://claude.com/resources/articles/four-role-based-claude-certifications)

## Visual prototype

Run `npm ci` and `npm run dev`, then open [CertCity on localhost](http://localhost:3000). The 3D city opens Downtown at Park Pacific on Olive Street. Use the district menu to visit the Gateway Arch, Enterprise Center, Ballpark Village, Delmar Loop, Forest Park, WashU, UMSL, Maplewood, Market Row and Lucas Gardens. Select a place and choose **Talk to** to meet its contact. City Dispatch opens with Nia’s report before the order lookup workflow. Use the footsteps button in Downtown to get closer to Olive and 13th and Central Library. At City Dispatch, replay T-17, compare your policy, and save a shift to keep its result in this browser. The [matched comparison](research/mockups/olive-corner-comparison.jpg) shows the first Blender asset pass. The [visual build notes](research/visual-build.md) describe the implementation and browser checks. The [FarmVille comparison](research/farmville-visual-audit.md) records the visual changes and St. Louis references.

The [St. Louis Blender source and reference guide](art/st-louis/README.md) covers the six expanded districts, their authored landmark meshes and the shared street assets.

## Certification practice

Choose a credential when you enter the city. **Assignments** lists its starting missions, completed work, and the prerequisites for later assignments. The same places can offer different work across credentials. Read the case file, configure the system, run the workload, and save a successful policy. **Pathway progress** shows city application and first-seen exam checks across domains. **Exam practice and guides** opens the full learning pathway, starting check, and independent practice. The current portfolios contain 34 missions with playable decisions mapped to all 123 published July 2026 objectives. See the [mission-to-exam audit](research/mission-portfolios.md) for the mapping and simulation limits.

Each Academy pathway offers a starting check, an independent practical case, a different case that opens a week after passing, and two standard full-length timed forms per guide. A fresh full-length reserve is available when unseen items meet the guide’s blueprint. After reviewing a rehearsal, learners can practice the exact skill or take a four-question timed domain reassessment when fresh items are available. The reserve is finite. The pathway reports city and guided progress, first-seen timed results, independent case criteria, and retained skills. Its practice benchmark is provisional. [Exam guide comparison](research/claude-certification-integration.md#december-7-guide-revision)

Choose your exam date to load the applicable guide for Associate Foundations, Developer Foundations, and Architect Professional. The December guides have companion decisions inside city missions, short independent practice for all 84 revised objectives, and separate seven-day questions. CertCity labels the original city assignment evidence by guide. Architect Foundations follows its November guide and retains its objective IDs.

Open the **City Dispatch** card for the existing task 2.2 sequence. It covers the order lookup repair, technical debrief, optional Exam Lens, an exam-style check and a seven-day follow-up. Its saved progress and earlier results stay available in the same browser. Run `npm run check:claude` to check the certification bank and progress logic.

**City impact** shows saved outcomes across locations. The City Dispatch counters report simulated staff time, false replies, and direct spend per week. Workload replays show their own time period and before-and-after results in the same panel.

In **Order lookup**, select **Edit rule for T-17** in the workflow to jump to the relevant recovery setting. Changes update the ticket preview. **Run shift** checks their effect across the full simulated week. The [workflow usability notes](research/workflow-usability.md) record the design evidence and playtest tasks.

## Search visibility

The static build uses `https://www.certcity.org`, the destination of the live apex redirect, for canonical URLs, sharing previews, structured data, and the sitemap. Set `NEXT_PUBLIC_SITE_URL` before building if the public origin changes. City and study query parameters share the clean URL of their underlying page. [Google’s canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

Run `npm run build` followed by `npm run check:seo` to verify the exported HTML, sitemap, and crawler rules. After deployment, check `/robots.txt` and `/sitemap.xml` on the public domain and confirm unknown routes return HTTP 404. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools. To verify via HTML tags, set `GOOGLE_SITE_VERIFICATION` for a Search Console URL-prefix property and `BING_SITE_VERIFICATION` for Bing before building. A Search Console Domain property uses DNS verification. [Google Search Console verification](https://support.google.com/webmasters/answer/9008080) · [Google sitemap submission](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) · [Bing sitemap submission](https://www.bing.com/webmasters/help/Sitemaps-3b5cf6ed)

Inspect the catalog and each pathway URL in Search Console after deployment. Use the Performance report to compare impressions and clicks for certification names and exam-practice searches. Use the Core Web Vitals report to track loading, interaction, and layout on real devices. [Search Console Performance report](https://support.google.com/webmasters/answer/7576553) · [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)

The certification landing pages, December exam comparison, City Dispatch walkthrough, and objective map are static HTML. Practice workspaces load on demand at the same canonical pathway URL using `?practice=1`. Existing guide, domain, objective, and study links still open the workspace. The SEO check enforces a 350 KiB gzip budget for the scripts referenced by each initial certification document. Use real-user data to assess mobile LCP, INP, and CLS after release. [Web Vitals targets](https://web.dev/articles/vitals)

To enable measurement, turn on Web Analytics and Speed Insights for the existing Vercel project and set `NEXT_PUBLIC_CERTCITY_WEB_ANALYTICS=1` and `NEXT_PUBLIC_CERTCITY_SPEED_INSIGHTS=1` before a production build. If the project already supports custom events, also set `NEXT_PUBLIC_CERTCITY_PRACTICE_EVENTS=1`. CertCity sends the first Academy or city practice start and completion once per browser tab session. The custom properties contain the canonical landing path, broad traffic source, certification track, and practice surface. URLs sent by the collectors omit query strings and fragments. Collection respects Do Not Track and Global Privacy Control. [Vercel Web Analytics privacy](https://vercel.com/docs/analytics/privacy-policy) · [Custom events and plan availability](https://vercel.com/docs/analytics/custom-events) · [Speed Insights](https://vercel.com/docs/speed-insights)

Review Search Console impressions and clicks by public landing page alongside `First Practice Started` and `First Practice Completed` filtered to `organic-search`. The application classifies known search referrers and separates visible paid-search tags. Use the landing page and time period to compare those reports when deciding which guides to update next.

## Supabase

Copy `.env.example` to `.env.local` and set the project URL and publishable key. Restart the dev server after editing the file. On a deployment, set both values before building. The game is playable as a guest. Sign in with an email link to sync progress. Use **Account → Copy guest progress** to add saved work from this browser to the signed-in account.

For local development, run `supabase start` and use the local API URL and publishable key shown by `supabase status`. Read the sign-in link in the local Supabase mail catcher. On a hosted project, add the app origin to Auth redirect URLs and configure custom SMTP for learners outside the Supabase project team. The static app uses a Supabase Edge Function for authenticated Dispatch shift saves and study checks. Deploy it with `supabase functions deploy dispatch --use-api` after applying the migrations. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)

The schema notes cover the seeded catalog, access model, replay transaction, and remaining integration work. Use `psql` with the local database URL shown by `supabase status` and run each SQL file in `supabase/tests` with `-v ON_ERROR_STOP=1 -f`. The tests verify access, assessment evidence, Dispatch study scoring, and email eligibility. Each check rolls back its fixtures. [Supabase schema and design decisions](research/supabase-schema.md)

Open **Study help** to download or restore a copy of your work. Conflicting drafts are archived so either can be recovered. The release runbook covers question reporting, optional diagnostics, data migration, and the learner validation needed for exam-readiness claims. [CertCity release runbook](research/G-mvp-plan.md)

### Email notifications

Learners can enable reminders under **Account → Study email reminders**. CertCity sends one reminder when an Academy follow-up, delayed practical case, or City Dispatch follow-up opens for a learner. The team receives an alert at `info@certcity.org` when a new account verifies its email address and an hourly digest when practice questions are reported. The public contact address and notification reply address are both `info@certcity.org`.

Deploy the `notifications` Edge Function after applying the migrations. Set `RESEND_API_KEY` to a sending-only key for `notifications.certcity.org` and set `NOTIFICATIONS_WORKER_TOKEN` to a random secret in Supabase Edge Function Secrets. Set `NOTIFICATIONS_SITE_URL` only when email links should open an origin other than `https://certcity.org`. Supabase Auth delivers sign-in links through its configured SMTP integration. [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets) · [Resend with Supabase Auth](https://resend.com/docs/send-with-supabase-smtp)

In Supabase Vault, set `certcity_notifications_worker_url` to `https://<project-ref>.supabase.co/functions/v1/notifications` and `certcity_notifications_worker_token` to the same worker token. The migration installs the `certcity-email-notifications` job, which checks for eligible emails every ten minutes. Review unaccepted sends in the Edge Function logs and delivery attempts in `certcity_private.email_deliveries`. [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)

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

The two founder documents were used as inputs. The prototype economics are reproducible synthetic scenarios. The experience still needs renderer benchmarks, content review, learner testing, and buyer validation. The curriculum maps distinguish published objective coverage, playable practice and success on simulated tasks. The product’s exam-readiness claim still needs independent learner outcomes.
