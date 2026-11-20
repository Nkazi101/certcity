create table public.learner_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  save_key text not null check (
    save_key in ('simza.city-dispatch.v1', 'simza.ccar-f.task-2.2.v1', 'certcity.city.active-assignment.v1')
    or save_key ~ '^certcity\.(city\.(assignment|check)\.v1|mission\.v1)\.[a-z0-9-]{1,64}$'
    or save_key ~ '^certcity\.practice\.[A-Z-]{1,24}\.[a-z0-9.-]{1,32}$'
  ),
  payload text not null check (octet_length(payload) <= 524288 and payload is json),
  revision integer not null default 1 check (revision > 0),
  primary key (user_id, save_key)
);

alter table public.learner_progress enable row level security;

revoke all on public.learner_progress from public, anon, authenticated;
grant select on public.learner_progress to authenticated;
grant insert (user_id, save_key, payload) on public.learner_progress to authenticated;
grant update (payload, revision) on public.learner_progress to authenticated;

create policy "Learners read their own progress"
on public.learner_progress for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Learners insert their own progress"
on public.learner_progress for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Learners update their own progress"
on public.learner_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
