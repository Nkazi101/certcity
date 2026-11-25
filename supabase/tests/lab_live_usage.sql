-- Exercise the live-lab daily allowance without calling the model.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('ce475000-0000-4000-8000-000000000091', 'lab-live-one@example.invalid', now()),
  ('ce475000-0000-4000-8000-000000000092', 'lab-live-two@example.invalid', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000091', true);
do $$
begin
  if has_function_privilege('public.claim_lab_live_run(uuid,integer,integer)', 'execute')
    or has_function_privilege('public.release_lab_live_run(uuid)', 'execute')
    or has_function_privilege('public.lab_live_runs_today(uuid)', 'execute') then
    raise exception 'Learners can call the live-run allowance directly';
  end if;
end;
$$;
reset role;

do $$
declare
  one constant uuid := 'ce475000-0000-4000-8000-000000000091';
  two constant uuid := 'ce475000-0000-4000-8000-000000000092';
  result record;
begin
  for attempt in 1..2 loop
    select * into result from public.claim_lab_live_run(one, 2, 100);
    if result.status <> 'ok' or result.used <> attempt then raise exception 'Claim % returned % / %', attempt, result.status, result.used; end if;
  end loop;
  select * into result from public.claim_lab_live_run(one, 2, 100);
  if result.status <> 'limit' then raise exception 'Third claim was not limited: %', result.status; end if;
  if public.lab_live_runs_today(one) <> 2 then raise exception 'Limited claim changed the count'; end if;

  if public.release_lab_live_run(one) <> 1 then raise exception 'Release did not return the run'; end if;
  select * into result from public.claim_lab_live_run(one, 2, 100);
  if result.status <> 'ok' or result.used <> 2 then raise exception 'Released run could not be used again'; end if;

  select * into result from public.claim_lab_live_run(two, 5, 2);
  if result.status <> 'busy' then raise exception 'Site-wide ceiling was not applied: %', result.status; end if;
  if public.lab_live_runs_today(two) <> 0 then raise exception 'Busy claim was counted'; end if;
  if public.release_lab_live_run(two) is not null then raise exception 'Release went below zero'; end if;
end;
$$;

select 'Live-lab allowance, release and site-wide ceiling passed' as result;
rollback;
