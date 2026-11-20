begin;

insert into auth.users (id, email)
  values ('ce475000-0000-4000-8000-000000000021', 'schema-assessment@example.invalid');
insert into certcity_private.item_families (track_id, family_id, eligibility)
  values ('architect-foundations', 'schema-test-independent', 'independent');
insert into certcity_private.item_revisions
  (track_id, release_no, item_id, family_id, blueprint_version, domain_no, objective_no, source_url, prompt, rubric)
  values ('architect-foundations', 1, 'schema-test-item', 'schema-test-independent', '2026-07.v1', 2, 2,
    'https://example.invalid', '{}', '{}');
insert into certcity_private.assessment_form_items (track_id, release_no, form_id, item_id, position)
  values ('architect-foundations', 1, 'dispatch-lookup-check', 'schema-test-item', 9000);

insert into public.assessment_attempts (id, user_id, track_id, release_no, form_id, status, started_at, closed_at)
  values ('ce475000-0000-4000-8000-000000000022', 'ce475000-0000-4000-8000-000000000021',
    'architect-foundations', 1, 'dispatch-lookup-check', 'submitted', now() - interval '5 minutes', now());

insert into certcity_private.item_exposures
  (attempt_id, user_id, track_id, release_no, form_id, item_id, family_id, delivery_position, option_order, first_shown_at)
  values ('ce475000-0000-4000-8000-000000000022', 'ce475000-0000-4000-8000-000000000021',
    'architect-foundations', 1, 'dispatch-lookup-check', 'schema-test-item', 'schema-test-independent', 1,
    array['a', 'b'], now() - interval '4 minutes');

insert into certcity_private.first_family_exposures (user_id, track_id, family_id, release_no, attempt_id, item_id)
  values ('ce475000-0000-4000-8000-000000000021', 'architect-foundations', 'schema-test-independent', 1,
    'ce475000-0000-4000-8000-000000000022', 'schema-test-item');
insert into certcity_private.assessment_responses
  (attempt_id, item_id, user_id, track_id, release_no, family_id, response, correct, rubric_version, submitted_at)
  values ('ce475000-0000-4000-8000-000000000022', 'schema-test-item', 'ce475000-0000-4000-8000-000000000021',
    'architect-foundations', 1, 'schema-test-independent', '["a"]', false, '1', now() - interval '1 minute');
insert into public.learning_evidence
  (user_id, track_id, family_id, release_no, attempt_id, item_id, blueprint_version, domain_no, objective_no)
  values ('ce475000-0000-4000-8000-000000000021', 'architect-foundations', 'schema-test-independent', 1,
    'ce475000-0000-4000-8000-000000000022', 'schema-test-item', '2026-07.v1', 2, 2);

do $$
begin
  if not exists (
    select 1 from public.learning_evidence
    where family_id = 'schema-test-independent' and observed_at = now() - interval '1 minute'
  ) then
    raise exception 'Unassisted evidence did not retain the response timestamp';
  end if;
end;
$$;

update certcity_private.item_exposures set assisted_at = now() - interval '2 minutes'
  where attempt_id = 'ce475000-0000-4000-8000-000000000022';

do $$
begin
  if exists (select 1 from public.learning_evidence where family_id = 'schema-test-independent') then
    raise exception 'Recorded assistance failed to invalidate independent evidence';
  end if;
  begin
    insert into public.learning_evidence
      (user_id, track_id, family_id, release_no, attempt_id, item_id, blueprint_version, domain_no, objective_no)
      values ('ce475000-0000-4000-8000-000000000021', 'architect-foundations', 'schema-test-independent', 1,
        'ce475000-0000-4000-8000-000000000022', 'schema-test-item', '2026-07.v1', 2, 2);
    raise exception 'Assisted evidence was accepted';
  exception when check_violation then
    null;
  end;
end;
$$;
select 'Unassisted evidence and assistance invalidation passed' as result;
rollback;
