-- Exercise the delivery ledger and preference RLS without contacting Resend.
begin;

insert into auth.users (id, email, email_confirmed_at) values
  ('ce475000-0000-4000-8000-000000000071', 'email-preference-one@example.invalid', now()),
  ('ce475000-0000-4000-8000-000000000072', 'email-preference-two@example.invalid', now()),
  ('ce475000-0000-4000-8000-000000000073', 'email-unconfirmed@example.invalid', null);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000071', true);
insert into public.study_email_preferences (user_id) values (auth.uid()) on conflict do nothing;
insert into public.study_email_preferences (user_id) values (auth.uid()) on conflict do nothing;

do $$
begin
  if not exists (select 1 from public.study_email_preferences where user_id = auth.uid())
    or has_column_privilege('public.study_email_preferences', 'enabled_at', 'INSERT')
    or has_function_privilege('public.claim_notification_emails()', 'execute')
    or has_function_privilege('public.mark_notification_email_sent(uuid,integer,text)', 'execute') then
    raise exception 'Learner permissions are incorrect';
  end if;
  begin
    insert into public.study_email_preferences (user_id) values ('ce475000-0000-4000-8000-000000000072');
    raise exception 'Learner was able to opt another account in';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000072', true);
delete from public.study_email_preferences;
do $$
begin
  if exists (select 1 from public.study_email_preferences) then
    raise exception 'Preference is visible to the wrong account';
  end if;
end;
$$;
reset role;

insert into public.study_email_preferences (user_id, enabled_at)
values ('ce475000-0000-4000-8000-000000000073', now() - interval '2 days');
update public.study_email_preferences set enabled_at = now() - interval '2 days'
where user_id = 'ce475000-0000-4000-8000-000000000071';

insert into public.learner_progress (user_id, save_key, payload)
select u.id, 'certcity.practice.CCAO-F.2026-07.v1', jsonb_build_object('attempts', jsonb_build_array(
  jsonb_build_object('mode', 'mixed', 'submittedAt', floor(extract(epoch from now() - interval '169 hours') * 1000)),
  jsonb_build_object('mode', 'mixed', 'version', 'december-2026', 'submittedAt', floor(extract(epoch from now() - interval '169 hours') * 1000)),
  jsonb_build_object('mode', 'followup', 'version', 'december-2026', 'submittedAt', floor(extract(epoch from now()) * 1000))
))::text
from auth.users u where u.id in ('ce475000-0000-4000-8000-000000000071', 'ce475000-0000-4000-8000-000000000073');

insert into public.learner_progress (user_id, save_key, payload)
values ('ce475000-0000-4000-8000-000000000071', 'certcity.practice.CCDV-F.2026-07.v1', '{"bad":"\u0000"}'),
  ('ce475000-0000-4000-8000-000000000071', 'certcity.practice.CCAO-F.readiness.v1', jsonb_build_object('capstones', jsonb_build_array(
    jsonb_build_object('trackId', 'associate-foundations', 'version', 'december-2026', 'stage', 'capstone',
      'scenarioId', 'associate-admissions-project-lab-v2', 'passed', true,
      'submittedAt', floor(extract(epoch from now() - interval '169 hours') * 1000)),
    jsonb_build_object('trackId', 'associate-foundations', 'version', 'july-2026', 'stage', 'capstone',
      'scenarioId', 'associate-admissions-project-lab-v2', 'passed', false,
      'submittedAt', floor(extract(epoch from now() - interval '169 hours') * 1000))
  ))::text),
  -- A pass of a retired practical no longer unlocks a 7-day review lab in the app, so it must not send a reminder.
  ('ce475000-0000-4000-8000-000000000071', 'certcity.practice.CCDV-F.readiness.v1', jsonb_build_object('capstones', jsonb_build_array(
    jsonb_build_object('trackId', 'developer-foundations', 'version', 'july-2026', 'stage', 'capstone',
      'scenarioId', 'developer-spares-tool-loop-v1', 'passed', true,
      'submittedAt', floor(extract(epoch from now() - interval '169 hours') * 1000))
  ))::text);

insert into public.assessment_attempts (user_id, track_id, release_no, form_id)
values ('ce475000-0000-4000-8000-000000000071', 'architect-foundations', 1, 'bike-share-service.v2');
insert into public.study_schedule (user_id, track_id, source_attempt_id, source_release_no, release_no, form_id, due_at)
select user_id, track_id, id, release_no, release_no, 'arts-center-equipment.v2', now() - interval '1 hour'
from public.assessment_attempts where user_id = 'ce475000-0000-4000-8000-000000000071';

insert into public.practice_item_reports (id, user_id, created_at, track_id, guide, item_id, report_type, details)
select gen_random_uuid(), 'ce475000-0000-4000-8000-000000000071', date_trunc('hour', now()) - interval '5 minutes',
  'associate-foundations', 'july-2026', 'fictional-item', 'accuracy', 'Review the fictional fixture.'
from generate_series(1, 2);

set local role service_role;
do $$
declare
  claimed record;
  next_claim record;
begin
  if (select count(*) from certcity_private.notification_candidates(now())
      where user_id = 'ce475000-0000-4000-8000-000000000071' and recipient is not null) <> 3
    or (select count(*) from certcity_private.notification_candidates(now())
      where kind = 'academy_practical' and track_id = 'associate-foundations' and guide = 'december-2026') <> 1
    or exists (select 1 from certcity_private.notification_candidates(now())
      where kind = 'academy_practical' and track_id = 'developer-foundations')
    or (select count(*) from certcity_private.notification_candidates(now())
      where kind = 'account_signup' and signup_email = 'email-preference-one@example.invalid' and recipient is null) <> 1
    or exists (select 1 from certcity_private.notification_candidates(now())
      where user_id = 'ce475000-0000-4000-8000-000000000073')
    or (select count(*) from certcity_private.notification_candidates(now())
      where kind = 'question_reports' and due_at = date_trunc('hour', now())) <> 1 then
    raise exception 'Eligible study reminders or report digest are incorrect';
  end if;

  select * into claimed from public.claim_notification_emails()
    where kind = 'academy_followup' and recipient = 'email-preference-one@example.invalid';
  if claimed.delivery_id is null or claimed.attempts <> 1 then raise exception 'First delivery claim failed'; end if;
  if exists (select 1 from public.claim_notification_emails() where delivery_id = claimed.delivery_id) then
    raise exception 'Active delivery was claimed twice';
  end if;

  update certcity_private.email_deliveries set retry_at = now() where delivery_id = claimed.delivery_id;
  select * into next_claim from public.claim_notification_emails() where delivery_id = claimed.delivery_id;
  if next_claim.attempts is distinct from 2 then raise exception 'Retry lost its delivery ID'; end if;

  perform public.mark_notification_email_sent(claimed.delivery_id, claimed.attempts, 'stale-attempt');
  if exists (select 1 from certcity_private.email_deliveries where provider_id = 'stale-attempt') then
    raise exception 'A stale claim was able to update a newer attempt';
  end if;
  perform public.mark_notification_email_sent(next_claim.delivery_id, next_claim.attempts, 'accepted-fixture');
  update certcity_private.email_deliveries set retry_at = now() where delivery_id = next_claim.delivery_id;
  if exists (select 1 from public.claim_notification_emails() where delivery_id = next_claim.delivery_id) then
    raise exception 'Accepted delivery was sent again';
  end if;
end;
$$;
reset role;

update auth.users set email_confirmed_at = now()
where id = 'ce475000-0000-4000-8000-000000000073';
update auth.users set email_confirmed_at = now() + interval '1 second'
where id = 'ce475000-0000-4000-8000-000000000073';
do $$
begin
  if (select count(*) from certcity_private.notification_candidates(now())
      where kind = 'account_signup' and signup_email = 'email-unconfirmed@example.invalid') <> 1 then
    raise exception 'Email verification did not create exactly one account alert';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ce475000-0000-4000-8000-000000000071', true);
delete from public.study_email_preferences where user_id = auth.uid();
reset role;
do $$
begin
  if exists (select 1 from certcity_private.notification_candidates(now())
      where user_id = 'ce475000-0000-4000-8000-000000000071' and recipient is not null) then
    raise exception 'Opted-out learner is still eligible';
  end if;
end;
$$;

select 'Email preferences, due activities, account alerts, report digest, retries and deduplication passed' as result;
rollback;
