-- Synthetic users and feedback are scoped to this transaction.
begin;

insert into auth.users (id, email) values
  ('ce475000-0000-4000-8000-000000000031', 'feedback-owner@example.invalid'),
  ('ce475000-0000-4000-8000-000000000032', 'feedback-other@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000031', true);

insert into public.practice_item_reports
  (id, track_id, guide, item_id, form, content_revision, report_type, details)
values ('ce475000-0000-4000-8000-000000000033', 'associate-foundations', 'july-2026',
  'fixture-item', 'original', 'abcdef0123456789', 'accuracy', 'Review the fictional fixture.');
insert into public.client_health_events (event_type, release, surface, elapsed_ms)
values ('scene-ready', 'fixture.release-1', 'room', 145);

do $$
begin
  if not exists (select 1 from public.practice_item_reports
    where id = 'ce475000-0000-4000-8000-000000000033' and user_id = auth.uid()) then
    raise exception 'Learner could not read their own report';
  end if;
  if has_table_privilege('public.client_health_events', 'SELECT') or
    has_column_privilege('public.client_health_events', 'user_id', 'INSERT') or
    has_column_privilege('public.practice_item_reports', 'user_id', 'INSERT') then
    raise exception 'Learner can read diagnostics or choose another reporting identity';
  end if;
  begin
    insert into public.client_health_events (event_type, release, surface, elapsed_ms)
    values ('scene-ready', 'fixture.release-2', 'room', 240);
    raise exception 'Diagnostic duplicate exceeded the learner-day limit';
  exception when unique_violation then
    null;
  end;
  begin
    insert into public.client_health_events (event_type, release, surface, elapsed_ms)
    values ('scene-fallback', 'fixture.release-1', 'room', -1);
    raise exception 'Diagnostic accepted an invalid timing value';
  exception when check_violation then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000032', true);
do $$
begin
  if exists (select 1 from public.practice_item_reports where id = 'ce475000-0000-4000-8000-000000000033') then
    raise exception 'Learner could read another learner''s report';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  if has_table_privilege('public.practice_item_reports', 'SELECT') or
    has_any_column_privilege('public.practice_item_reports', 'INSERT') or
    has_any_column_privilege('public.client_health_events', 'INSERT') then
    raise exception 'Guest role has access to private feedback or diagnostics';
  end if;
end;
$$;

reset role;
set local role service_role;
do $$
begin
  if not exists (select 1 from public.practice_item_reports where id = 'ce475000-0000-4000-8000-000000000033') or
    not exists (select 1 from public.client_health_events where user_id = 'ce475000-0000-4000-8000-000000000031') then
    raise exception 'Privileged reviewer could not read the staged feedback and diagnostic records';
  end if;
end;
$$;

reset role;
delete from auth.users where id = 'ce475000-0000-4000-8000-000000000031';
do $$
begin
  if exists (select 1 from public.practice_item_reports where user_id = 'ce475000-0000-4000-8000-000000000031') or
    exists (select 1 from public.client_health_events where user_id = 'ce475000-0000-4000-8000-000000000031') then
    raise exception 'Deleting a learner did not remove their feedback or diagnostic records';
  end if;
end;
$$;

select 'Report ownership, guest isolation, diagnostic bounds, and deletion checks passed' as result;
rollback;
