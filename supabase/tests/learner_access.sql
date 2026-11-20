-- The transaction leaves synthetic learners and results out of the database.
begin;

insert into auth.users (id, email) values
  ('ce475000-0000-4000-8000-000000000001', 'schema-owner@example.invalid'),
  ('ce475000-0000-4000-8000-000000000002', 'schema-other@example.invalid');

insert into public.organizations (id, slug, name) values
  ('ce475000-0000-4000-8000-000000000011', 'schema-test-organization', 'Schema test');
insert into public.organization_members (organization_id, user_id, role) values
  ('ce475000-0000-4000-8000-000000000011', 'ce475000-0000-4000-8000-000000000001', 'learner');
insert into public.cohorts (id, organization_id, name) values
  ('ce475000-0000-4000-8000-000000000012', 'ce475000-0000-4000-8000-000000000011', 'Schema test');
insert into public.cohort_members (cohort_id, organization_id, user_id) values
  ('ce475000-0000-4000-8000-000000000012', 'ce475000-0000-4000-8000-000000000011', 'ce475000-0000-4000-8000-000000000001');

do $$
declare
  attempt public.mission_attempts;
  initial_result jsonb;
  retry_result jsonb;
  stale_result jsonb;
begin
  attempt := public.start_dispatch_attempt('ce475000-0000-4000-8000-000000000001');
  initial_result := public.commit_dispatch_run(
    attempt.user_id, attempt.id, 'ce475000-0000-4000-8000-000000000101',
    0, repeat('a', 64), '{"contract":"typed"}', '{"calls":1130}', true);
  retry_result := public.commit_dispatch_run(
    attempt.user_id, attempt.id, 'ce475000-0000-4000-8000-000000000101',
    0, repeat('a', 64), '{"contract":"typed"}', '{"calls":1130}', true);
  stale_result := public.commit_dispatch_run(
    attempt.user_id, attempt.id, 'ce475000-0000-4000-8000-000000000102',
    0, repeat('b', 64), '{"contract":"baseline"}', '{"calls":1000}', false);
  if initial_result->>'status' <> 'saved' or initial_result is distinct from retry_result
    or stale_result->>'status' <> 'stale' then
    raise exception 'Dispatch command idempotency or revision check failed';
  end if;
  if not exists (select 1 from public.mission_outcomes where user_id = attempt.user_id
    and run_id = (initial_result #>> '{run,id}')::uuid) then
    raise exception 'Accepted Dispatch outcome did not reference its run';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000001', true);
insert into public.learner_progress (user_id, save_key, payload)
values ('ce475000-0000-4000-8000-000000000001', 'certcity.city.active-assignment.v1', '"architect-foundations"');

do $$
begin
  if (select count(*) from public.learner_progress) <> 1 or
     (select count(*) from public.simulation_runs) <> 1 or
     (select count(*) from public.organizations) <> 1 or
     (select count(*) from public.cohorts) <> 1 then
    raise exception 'Owner could not read their progress or cohort';
  end if;
  if has_table_privilege('public.simulation_runs', 'INSERT') or
     has_table_privilege('public.learning_evidence', 'INSERT') or
     has_schema_privilege('certcity_private', 'USAGE') then
    raise exception 'Browser role received authoritative write or private schema access';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists (select 1 from public.learner_progress) or
     exists (select 1 from public.simulation_runs) or
     exists (select 1 from public.organizations) or
     exists (select 1 from public.cohorts) then
    raise exception 'RLS exposed another learner or organization';
  end if;
end;
$$;

reset role;
delete from auth.users where id in ('ce475000-0000-4000-8000-000000000001', 'ce475000-0000-4000-8000-000000000002');
do $$
begin
  if exists (select 1 from public.mission_outcomes where user_id = 'ce475000-0000-4000-8000-000000000001')
    or exists (select 1 from public.learner_progress where user_id = 'ce475000-0000-4000-8000-000000000001') then
    raise exception 'Auth deletion failed to remove owned records';
  end if;
end;
$$;
select 'Learner ownership, tenant isolation, Dispatch transaction, and cascade checks passed' as result;
rollback;
