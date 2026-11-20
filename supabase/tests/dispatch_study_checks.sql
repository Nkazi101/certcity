begin;
insert into auth.users (id, email) values
  ('ce475000-0000-4000-8000-000000000031', 'dispatch-study-test@example.invalid'),
  ('ce475000-0000-4000-8000-000000000032', 'dispatch-study-other@example.invalid');

do $$
declare
  actor constant uuid := 'ce475000-0000-4000-8000-000000000031';
  other_actor constant uuid := 'ce475000-0000-4000-8000-000000000032';
  answers constant jsonb := '{"lookup":["contract"],"retry":["handoff","retry"],"validation":["clarify"],"policy":["permission","business"]}';
  later_answers constant jsonb := '{"coverage":["partial"],"execution":["flag","payload"],"permission":["access"],"write":["verify"]}';
  attempt public.mission_attempts;
  first_result jsonb;
  status jsonb;
begin
  if public.dispatch_study_check(actor, 'start', 'first')->>'status' is distinct from 'shift_required' then
    raise exception 'The check opened without a committed successful shift';
  end if;
  attempt := public.start_dispatch_attempt(actor);
  perform public.commit_dispatch_run(actor, attempt.id, gen_random_uuid(), 0, repeat('a', 64), '{}', '{}', true);

  if public.dispatch_study_check(actor, 'submit', 'first', answers)->>'status' is distinct from 'start_required' then
    raise exception 'Answers were accepted before exposures were recorded';
  end if;
  if public.dispatch_study_check(actor, 'start', 'first')->>'status' is distinct from 'open' then
    raise exception 'The first check did not open';
  end if;
  if public.dispatch_study_check(actor, 'submit', 'first', jsonb_set(answers, '{retry}', '["retry","retry"]'))->>'status'
    is distinct from 'invalid' then
    raise exception 'A duplicate answer was accepted';
  end if;

  first_result := public.dispatch_study_check(actor, 'submit', 'first', answers);
  if first_result #>> '{result,score}' is distinct from '4' or
    first_result is distinct from public.dispatch_study_check(actor, 'submit', 'first', '{}') then
    raise exception 'First-check scoring or idempotency failed';
  end if;
  status := public.dispatch_study_check(actor, 'status');
  if (status->>'dueAt')::bigint - (first_result #>> '{result,submittedAt}')::bigint is distinct from 604800000 then
    raise exception 'The follow-up deadline was not exactly seven days later';
  end if;
  if public.dispatch_study_check(actor, 'start', 'followup')->>'status' is distinct from 'not_due' then
    raise exception 'The follow-up opened before the server deadline';
  end if;
  if public.dispatch_study_check(other_actor, 'status')->'first' is distinct from 'null'::jsonb or
    has_function_privilege('authenticated', 'public.dispatch_study_check(uuid,text,text,jsonb)', 'execute') then
    raise exception 'A different account could access study results through the RPC';
  end if;

  update public.study_schedule set due_at = clock_timestamp() - interval '1 second' where user_id = actor;
  if public.dispatch_study_check(actor, 'start', 'followup')->>'status' is distinct from 'open' or
    public.dispatch_study_check(actor, 'submit', 'followup', later_answers) #>> '{result,score}' is distinct from '4' then
    raise exception 'Follow-up delivery or scoring failed';
  end if;
  if not exists (select from public.study_schedule where user_id = actor and completed_at is not null) or
    exists (select from public.learning_evidence where user_id = actor) then
    raise exception 'Schedule or study-only classification failed';
  end if;
end;
$$;

select 'Dispatch prerequisites, scoring, idempotency, schedule, isolation and study-only classification passed' as result;
rollback;
