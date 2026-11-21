create table public.study_email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled_at timestamptz not null default now()
);

alter table public.study_email_preferences enable row level security;
revoke all on public.study_email_preferences from public, anon, authenticated;
grant select, delete on public.study_email_preferences to authenticated;
grant insert (user_id) on public.study_email_preferences to authenticated;
create policy "Learners read their own email preference"
  on public.study_email_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners enable their own study emails"
  on public.study_email_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Learners disable their own study emails"
  on public.study_email_preferences for delete to authenticated using ((select auth.uid()) = user_id);

create table certcity_private.email_deliveries (
  event_key text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  delivery_id uuid not null unique default gen_random_uuid(),
  recipient_hash text,
  attempts integer not null default 1,
  first_attempt_at timestamptz not null default now(),
  retry_at timestamptz not null,
  provider_id text,
  sent_at timestamptz
);
create index email_deliveries_by_user on certcity_private.email_deliveries (user_id);
alter table certcity_private.email_deliveries enable row level security;
revoke all on certcity_private.email_deliveries from public, anon, authenticated;
grant select, insert, update on certcity_private.email_deliveries to service_role;

create index practice_item_reports_created_at_idx on public.practice_item_reports (created_at);

create table certcity_private.account_signup_events (
  user_id uuid primary key references auth.users (id) on delete cascade,
  confirmed_at timestamptz not null default now()
);
create index account_signup_events_confirmed_at_idx on certcity_private.account_signup_events (confirmed_at);
alter table certcity_private.account_signup_events enable row level security;
revoke all on certcity_private.account_signup_events from public, anon, authenticated;

create function certcity_private.record_account_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and nullif(new.email, '') is not null
    and not coalesce(new.is_anonymous, false)
    and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    insert into certcity_private.account_signup_events (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function certcity_private.record_account_signup() from public, anon, authenticated;
create trigger record_account_signup after insert or update of email_confirmed_at on auth.users
for each row execute function certcity_private.record_account_signup();

-- Older saves and browser-written JSON can contain values that JSONB cannot represent.
create function certcity_private.email_progress_json(payload text) returns jsonb
language plpgsql immutable strict set search_path = '' as $$
begin
  return payload::jsonb;
exception when data_exception then
  return null;
end;
$$;

create function certcity_private.study_unlock_at(submitted_ms jsonb) returns timestamptz
language sql immutable strict set search_path = '' as $$
  select case when submitted_ms::text ~ '^[1-4][0-9]{12}$'
    then to_timestamp(submitted_ms::text::bigint / 1000.0) + interval '168 hours'
  end;
$$;

create function certcity_private.notification_candidates(run_at timestamptz)
returns table (event_key text, user_id uuid, recipient text, kind text, track_id text, guide text, due_at timestamptz, signup_email text)
language sql stable security definer set search_path = '' as $$
  with enabled as materialized (
    select p.user_id, p.enabled_at, u.email::text as email
    from public.study_email_preferences p join auth.users u on u.id = p.user_id
    where u.email_confirmed_at is not null and nullif(u.email, '') is not null
      and not coalesce(u.is_anonymous, false) and coalesce(u.banned_until, run_at) <= run_at
  ), guides (track_id, code, guide, capstone_id, transfer_id) as (
    values
      ('associate-foundations', 'CCAO-F', 'july-2026', 'associate-riverbend-reopening-v1', 'associate-sparrow-lending-transfer-v1'),
      ('associate-foundations', 'CCAO-F', 'december-2026', 'associate-willow-clinic-revised-v1', 'associate-garden-seed-transfer-revised-v1'),
      ('developer-foundations', 'CCDV-F', 'july-2026', 'developer-spares-tool-loop-v1', 'developer-room-readings-transfer-v1'),
      ('developer-foundations', 'CCDV-F', 'december-2026', 'developer-shuttle-status-revised-v1', 'developer-exhibit-ledger-transfer-revised-v1'),
      ('architect-foundations', 'CCAR-F', 'july-2026', 'architect-canal-readiness-v1', 'architect-museum-inventory-transfer-v1'),
      ('architect-professional', 'CCAR-P', 'july-2026', 'professional-maintenance-rollout-v1', 'professional-grants-lab-transfer-v1'),
      ('architect-professional', 'CCAR-P', 'december-2026', 'professional-fleet-rollout-revised-v1', 'professional-archive-handoff-transfer-revised-v1')
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

-- Claim each event atomically. Each retry uses the same Resend idempotency key and
-- stays inside Resend's 24-hour window even if the original response was lost.
create function public.claim_notification_emails()
returns table (delivery_id uuid, attempts integer, recipient text, kind text, track_id text, guide text, due_at timestamptz, signup_email text)
language sql set search_path = '' as $$
  with eligible as materialized (
    select c.* from certcity_private.notification_candidates(now()) c
    left join certcity_private.email_deliveries d using (event_key)
    where d.event_key is null or (
      d.sent_at is null and d.retry_at <= now() and d.attempts < 5
      and d.first_attempt_at > now() - interval '20 hours'
      and d.recipient_hash is not distinct from md5(coalesce(c.recipient, c.signup_email))
    )
    order by c.due_at, c.event_key
    limit 8
  ), claimed as (
    insert into certcity_private.email_deliveries as delivery (event_key, user_id, recipient_hash, retry_at)
    select e.event_key, e.user_id, md5(coalesce(e.recipient, e.signup_email)), now() + interval '5 minutes' from eligible e
    on conflict on constraint email_deliveries_pkey do update
      set attempts = delivery.attempts + 1,
        retry_at = now() + interval '5 minutes' * power(2, delivery.attempts)
      where delivery.sent_at is null and delivery.retry_at <= now() and delivery.attempts < 5
        and delivery.first_attempt_at > now() - interval '20 hours'
        and delivery.recipient_hash is not distinct from excluded.recipient_hash
    returning delivery.event_key, delivery.delivery_id, delivery.attempts
  )
  select c.delivery_id, c.attempts, e.recipient, e.kind, e.track_id, e.guide, e.due_at, e.signup_email
  from claimed c join eligible e using (event_key);
$$;

create function public.mark_notification_email_sent(target_id uuid, claim_attempt integer, resend_id text)
returns void language sql set search_path = '' as $$
  update certcity_private.email_deliveries set sent_at = now(), provider_id = resend_id
  where delivery_id = target_id and attempts = claim_attempt and sent_at is null;
$$;

revoke all on function certcity_private.email_progress_json(text), certcity_private.study_unlock_at(jsonb),
  certcity_private.notification_candidates(timestamptz), public.claim_notification_emails(),
  public.mark_notification_email_sent(uuid, integer, text) from public, anon, authenticated;
grant execute on function certcity_private.notification_candidates(timestamptz), public.claim_notification_emails(),
  public.mark_notification_email_sent(uuid, integer, text) to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

create function certcity_private.request_notification_delivery()
returns bigint language sql set search_path = '' as $$
  select net.http_post(
    url := endpoint.decrypted_secret,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || credential.decrypted_secret),
    timeout_milliseconds := 75000
  )
  from vault.decrypted_secrets endpoint cross join vault.decrypted_secrets credential
  where endpoint.name = 'certcity_notifications_worker_url' and credential.name = 'certcity_notifications_worker_token';
$$;
revoke all on function certcity_private.request_notification_delivery() from public, anon, authenticated, service_role;

select cron.schedule('certcity-email-notifications', '*/10 * * * *', 'select certcity_private.request_notification_delivery()');
