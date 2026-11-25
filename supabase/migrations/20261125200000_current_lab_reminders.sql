-- Hands-on labs (v2) replaced the retired v1 practicals, but the reminder query still matched only the retired
-- scenario IDs, so a learner who passed a current lab never got the "7-day review lab" email.
-- Match the labs the app now scores (lib/claude/capstones getCapstoneDefinition). Passes of retired practicals no longer
-- unlock a 7-day review lab in the app, so they no longer trigger a reminder either.
-- scripts/check-notifications.cjs fails CI if this list drifts from the lab definitions again.
-- create or replace keeps the existing grants (service_role only).
create or replace function certcity_private.notification_candidates(run_at timestamptz)
returns table (event_key text, user_id uuid, recipient text, kind text, track_id text, guide text, due_at timestamptz, signup_email text)
language sql stable security definer set search_path = '' as $$
  with enabled as materialized (
    select p.user_id, p.enabled_at, u.email::text as email
    from public.study_email_preferences p join auth.users u on u.id = p.user_id
    where u.email_confirmed_at is not null and nullif(u.email, '') is not null
      and not coalesce(u.is_anonymous, false) and coalesce(u.banned_until, run_at) <= run_at
  ), guides (track_id, code, guide, capstone_id, transfer_id) as (
    values
      ('associate-foundations', 'CCAO-F', 'july-2026', 'associate-admissions-project-lab-v2', 'associate-camps-project-retention-v2'),
      ('associate-foundations', 'CCAO-F', 'december-2026', 'associate-admissions-project-lab-v2', 'associate-camps-project-retention-v2'),
      ('developer-foundations', 'CCDV-F', 'july-2026', 'developer-invoice-api-lab-v2', 'developer-depot-reorder-retention-v2'),
      ('developer-foundations', 'CCDV-F', 'december-2026', 'developer-invoice-api-lab-v2', 'developer-depot-reorder-retention-v2'),
      ('architect-foundations', 'CCAR-F', 'july-2026', 'architect-dispatch-repo-lab-v2', 'architect-permits-repo-retention-v2'),
      ('architect-professional', 'CCAR-P', 'july-2026', 'professional-support-rollout-lab-v2', 'professional-utility-rollout-retention-v2'),
      ('architect-professional', 'CCAR-P', 'december-2026', 'professional-support-rollout-lab-v2', 'professional-utility-rollout-retention-v2')
  ), academy_saves as materialized (
    select p.user_id, split_part(p.save_key, '.', 3) as code, p.save_key,
      certcity_private.email_progress_json(p.payload) as payload
    from public.learner_progress p join enabled e using (user_id)
    where split_part(p.save_key, '.', 3) in ('CCAO-F', 'CCDV-F', 'CCAR-F', 'CCAR-P')
      and p.save_key like 'certcity.practice.%'
      and (p.save_key like '%.2026-07.v1' or p.save_key like '%.readiness.v1')
  ), study as (
    select p.user_id, 'academy_followup'::text as kind, g.track_id, g.guide, a.due_at
    from academy_saves p join guides g on g.code = p.code
    cross join lateral (
      select min(certcity_private.study_unlock_at(item->'submittedAt')) filter (where item->>'mode' = 'mixed') as due_at,
        bool_or(item->>'mode' = 'followup') as completed
      from jsonb_array_elements(case when jsonb_typeof(p.payload->'attempts') = 'array' then p.payload->'attempts' end) item
      where coalesce(item->>'version', 'july-2026') = g.guide
    ) a
    where p.save_key = 'certcity.practice.' || p.code || '.2026-07.v1' and not a.completed
    union all
    select p.user_id, 'academy_practical', g.track_id, g.guide, a.due_at
    from academy_saves p join guides g on g.code = p.code
    cross join lateral (
      select min(certcity_private.study_unlock_at(item->'submittedAt')) filter (
        where item->>'stage' = 'capstone' and item->>'scenarioId' = g.capstone_id and item->'passed' = 'true'::jsonb
      ) as due_at,
        max(certcity_private.study_unlock_at(item->'submittedAt') - interval '168 hours') filter (
          where item->>'stage' = 'transfer' and item->>'scenarioId' = g.transfer_id
        ) as last_transfer_at
      from jsonb_array_elements(case when jsonb_typeof(p.payload->'capstones') = 'array' then p.payload->'capstones' end) item
      where item->>'trackId' = g.track_id and item->>'version' = g.guide
    ) a
    where p.save_key = 'certcity.practice.' || p.code || '.readiness.v1'
      and (a.last_transfer_at is null or a.last_transfer_at < a.due_at)
    union all
    select s.user_id, 'dispatch_followup', s.track_id, null, s.due_at
    from public.study_schedule s join enabled e using (user_id)
    where s.track_id = 'architect-foundations' and s.release_no = 1 and s.form_id = 'arts-center-equipment.v2'
      and s.completed_at is null and s.due_at between run_at - interval '72 hours' and run_at
  ), report_hours as (
    select distinct date_trunc('hour', r.created_at, 'UTC') + interval '1 hour' as window_end
    from public.practice_item_reports r
    where r.created_at >= run_at - interval '24 hours' and r.created_at < date_trunc('hour', run_at, 'UTC')
  )
  select concat_ws('/', s.kind, s.user_id, s.track_id, s.guide), s.user_id, e.email, s.kind, s.track_id, s.guide, min(s.due_at), null
  from study s join enabled e using (user_id)
  where s.due_at between greatest(e.enabled_at, run_at - interval '72 hours') and run_at
  group by s.user_id, e.email, s.kind, s.track_id, s.guide
  union all
  select 'question_reports/' || extract(epoch from window_end)::bigint, null, null, 'question_reports', null, null, window_end, null
  from report_hours
  union all
  select 'account_signup/' || s.user_id, s.user_id, null, 'account_signup', null, null, s.confirmed_at, u.email::text
  from certcity_private.account_signup_events s join auth.users u on u.id = s.user_id
  where s.confirmed_at between run_at - interval '72 hours' and run_at and nullif(u.email, '') is not null;
$$;
