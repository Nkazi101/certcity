-- Optional "Try it with real Claude" runs for labs (supabase/functions/lab-live). Only a count per learner per UTC day
-- is stored: never the learner's files, the model's reply or token usage. The edge function claims a run before it
-- calls the model and releases it when the provider fails (rate limit, overload, timeout), so learners are not charged
-- for outages. Every function here is service_role only; learners reach them through the edge function.
create table certcity_private.lab_live_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_day date not null,
  runs integer not null default 0 check (runs >= 0),
  primary key (user_id, usage_day)
);
create index lab_live_usage_day_idx on certcity_private.lab_live_usage (usage_day);
alter table certcity_private.lab_live_usage enable row level security;
revoke all on certcity_private.lab_live_usage from public, anon, authenticated;
grant select, insert, update, delete on certcity_private.lab_live_usage to service_role;

-- Atomically takes one run from today's allowance. status: "ok" (claimed), "limit" (the learner used today's runs)
-- or "busy" (every learner together reached the site-wide daily ceiling). used counts runs including this one.
create function public.claim_lab_live_run(actor_id uuid, daily_limit integer, global_limit integer)
returns table (status text, used integer)
language plpgsql set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  claimed integer;
begin
  if (select coalesce(sum(u.runs), 0) from certcity_private.lab_live_usage u where u.usage_day = today) >= global_limit then
    return query select 'busy'::text, coalesce((select u.runs from certcity_private.lab_live_usage u
      where u.user_id = actor_id and u.usage_day = today), 0);
    return;
  end if;
  insert into certcity_private.lab_live_usage as usage (user_id, usage_day, runs)
  values (actor_id, today, 1)
  on conflict (user_id, usage_day) do update set runs = usage.runs + 1
    where usage.runs < daily_limit
  returning usage.runs into claimed;
  if claimed is null then
    return query select 'limit'::text, daily_limit;
    return;
  end if;
  return query select 'ok'::text, claimed;
end;
$$;

-- Gives back a run claimed today when the provider, not the learner's request, made it fail.
create function public.release_lab_live_run(actor_id uuid)
returns integer
language sql set search_path = '' as $$
  update certcity_private.lab_live_usage set runs = runs - 1
  where user_id = actor_id and usage_day = (now() at time zone 'utc')::date and runs > 0
  returning runs;
$$;

create function public.lab_live_runs_today(actor_id uuid)
returns integer
language sql stable set search_path = '' as $$
  select coalesce((select runs from certcity_private.lab_live_usage
    where user_id = actor_id and usage_day = (now() at time zone 'utc')::date), 0);
$$;

revoke all on function public.claim_lab_live_run(uuid, integer, integer), public.release_lab_live_run(uuid),
  public.lab_live_runs_today(uuid) from public, anon, authenticated;
grant execute on function public.claim_lab_live_run(uuid, integer, integer), public.release_lab_live_run(uuid),
  public.lab_live_runs_today(uuid) to service_role;
