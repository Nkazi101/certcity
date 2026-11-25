# lab-live: "Try it with real Claude"

Optional live runs for labs. After the deterministic checks, a signed-in learner can send their artifact to a real
Claude model and see the reply next to the simulator's. Grading never reads this output.

- `index.ts`: the Edge Function. Verifies the learner's access token, enforces the daily allowance, calls the
  Messages API with the server's key, returns the reply text, any tool calls, `stop_reason` and token usage.
- `labs.ts`: the allowlist. Each lab turns the learner's files plus one of its own fixtures into Messages calls. The
  fixture text is a copy of `lib/labs/claude/*.ts`; update it when a lab's fixtures change.
- `config.ts`: the model (`LIVE_MODEL`, currently `claude-haiku-5-5`), the `max_tokens` ceiling, the timeout and
  the limits. The client never sends a model, a system prompt or a token budget.
- Client: `lib/labs/live.ts` (`liveAvailable`, `liveStatus`, `runLive`) and `components/academy/live-run.tsx`.

## Labs with live runs

| Lab | Sent | What the learner sees |
|---|---|---|
| `permit-agent` | `request.json`: messages, which tools to offer, `tool_choice`, `max_tokens` (capped) | Claude's real next turn, including tool calls (shown, not run), or the API's own 400 when the request is malformed |
| `vendor-batch-api` | `prompt.json` as the system prompt; `max_tokens` from `batch.json` | Real extractions for the night's blank-ID and smudged-ID scans (two calls, one run) |
| `printworks-ci` | `ci/criteria.md` as the reviewer's criteria; `ci/review-schema.json` as the requested reply shape | A real review of the release's proofs and changed code |

Not live: `enrollment-replies` (a checklist people apply), `community-handoff` and `repair-shop-tools` (settings,
hooks and MCP config that the simulator executes). Adding a lab means an entry in `labs.ts` and in
`liveLabArtifacts` in `lib/labs/live.ts`.

## Limits and security

- Signed-in, non-anonymous learners only (access token checked with Supabase Auth in the handler).
- 20 runs per learner per UTC day (`LAB_LIVE_DAILY_LIMIT`), 2,000 per day for the whole site
  (`LAB_LIVE_GLOBAL_DAILY_LIMIT`). A run that fails on the provider's side (429, overloaded, 5xx, timeout) is given
  back; a request the API rejects as invalid counts, because seeing that rejection is the lesson.
- Request body at most 64 KiB; each file has its own character limit in `labs.ts`.
- Only allowlisted lab ids, fixture ids and artifact ids are accepted. Tool definitions come from the server. Text,
  `tool_use` and `tool_result` blocks only.
- `max_tokens` at most 1,024, thinking off, effort `medium`, 25 s timeout with one SDK retry.
- Learner files and replies are never logged or stored. The database keeps one count per learner per day.

## Setup (owner)

1. Apply the migration `supabase/migrations/20261125120000_lab_live_runs.sql` (table
   `certcity_private.lab_live_usage` and three service-role functions):

   ```sh
   supabase db push
   ```

   Local check: `supabase test db` runs `supabase/tests/lab_live_usage.sql`.

2. Set the API key as a function secret (never in the repo or a `NEXT_PUBLIC_` variable). Optional limits:

   ```sh
   supabase secrets set ANTHROPIC_API_KEY=<key>
   supabase secrets set LAB_LIVE_DAILY_LIMIT=20 LAB_LIVE_GLOBAL_DAILY_LIMIT=2000
   ```

   Without `ANTHROPIC_API_KEY` the function reports live runs as off and the panel hides itself.

3. Register the function in `supabase/config.toml` like `dispatch` (the handler verifies the token itself):

   ```toml
   [functions.lab-live]
   # The handler verifies the user's access token with Supabase Auth before any model call.
   verify_jwt = false
   import_map = "./functions/lab-live/deno.json"
   ```

4. Pin the SDK and deploy:

   ```sh
   cd supabase/functions/lab-live && deno install   # writes deno.lock for npm:@anthropic-ai/sdk@^1.0.0
   supabase functions deploy lab-live --no-verify-jwt
   ```

5. Place `<LiveRun lab={lab} files={files} fixtureId={fixtureId} />` in the lab bench. It renders nothing for labs
   without live runs or when Supabase is not configured, and a sign-in prompt for signed-out visitors.
