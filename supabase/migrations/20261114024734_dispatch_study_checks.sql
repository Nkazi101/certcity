insert into certcity_private.assessment_forms (track_id, release_no, form_id, mission_id, kind) values
  ('architect-foundations', 1, 'bike-share-service.v2', 'dispatch-lookup', 'mission_check');

insert into certcity_private.item_families (track_id, family_id, eligibility) values
  ('architect-foundations', 'bike-share-service.v2.lookup', 'study_only'),
  ('architect-foundations', 'bike-share-service.v2.retry', 'study_only'),
  ('architect-foundations', 'bike-share-service.v2.validation', 'study_only'),
  ('architect-foundations', 'bike-share-service.v2.policy', 'study_only');

insert into certcity_private.item_revisions (track_id, release_no, item_id, family_id, blueprint_version, domain_no, objective_no, source_url, prompt, rubric) values
  ('architect-foundations', 1, 'bike-share-service.v2.lookup', 'bike-share-service.v2.lookup', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"lookup","prompt":"The ticket service sometimes returns an empty array in 90 ms. It also sometimes times out after 400 ms, which the MCP tool currently converts to the same empty array. What is the best first change?","options":[["prompt","Update the agent instructions to qualify empty replies whenever the observed lookup duration is above 300 ms."],["contract","Keep completed empty results as data and return the upstream timeout as a structured tool execution error."],["cache","Return the last known open tickets when the service times out and attach their age to every reply."],["verify","Keep the existing response and have the assistant verify every empty result with a second lookup."]]}', '{"correct":["contract"],"explanation":"The tool already knows whether the service completed. Preserving that outcome fixes the contract for every caller. Timing is a proxy, the cache can serve stale state, and a second call can return the same ambiguous payload."}'),
  ('architect-foundations', 1, 'bike-share-service.v2.retry', 'bike-share-service.v2.retry', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"retry","prompt":"A read-only ticket lookup has timed out once. A retry would take at most 400 ms, 600 ms remain in the request budget, and the dependency permits one local retry. Which two behaviors should the tool implement?","options":[["retry","Retry the read once inside the tool using the remaining deadline."],["queue","Queue a background refresh and return the latest cached ticket status as the current result."],["handoff","If the retry fails, return a transient tool error with the attempts made and preserve the unavailable status."],["worker","Escalate every initial timeout to a second agent that gets a fresh request budget."],["shorten","On a second timeout, shorten the requested date range and return the resulting ticket count."]]}', '{"correct":["retry","handoff"],"explanation":"One local retry fits the budget and is safe for this read. A failed retry still leaves availability unknown. Cached data has different freshness, a new agent cannot reset the original deadline, and a narrower search answers a different question."}'),
  ('architect-foundations', 1, 'bike-share-service.v2.validation', 'bike-share-service.v2.validation', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"validation","prompt":"The booking tool accepts numeric station IDs. The input ‘14B’ could be an old alias for any of several stations, and the service has no alias resolver. Which response lets the assistant recover while avoiding a booking at the wrong station?","options":[["strip","Strip nonnumeric characters at the MCP boundary and return a note when the normalized booking succeeds."],["schema","Make the input schema numeric and use one generic invalid-request message for all booking failures."],["suggest","Infer the closest known station ID and include the original input in the booking confirmation."],["clarify","Return a validation tool error identifying station ID as the field to correct and ask for the numeric ID before resubmitting."]]}', '{"correct":["clarify"],"explanation":"The request needs a corrected value before it can be retried safely. Normalization and guessing can act on the wrong station. A schema helps prevent malformed calls, but one generic error hides the field and blurs other failure categories."}'),
  ('architect-foundations', 1, 'bike-share-service.v2.policy', 'bike-share-service.v2.policy', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"policy","prompt":"A rider requests technician-only notes. On a separate, authorized booking request, the same rider hits a two-visit account limit. Which two handling rules let the assistant offer a useful response within the service policy?","options":[["permission","Return a permission error for the notes with only the approved access route, if available."],["mask","Return an empty notes list to preserve privacy and let the assistant offer to check another station."],["limit-retry","Label the visit limit transient and have the assistant retry once after refreshing the account."],["business","Return a non-retryable business error for the visit limit with the option to manage an existing booking."],["generic","Use the same permission response for both failures and send both requests to an administrator."]]}', '{"correct":["permission","business"],"explanation":"The notes restriction depends on who can view the data. The booking limit applies to an authorized rider until their bookings change. A shared denial, an empty list, or an immediate retry would each hide an actionable distinction."}');

insert into certcity_private.assessment_form_items (track_id, release_no, form_id, item_id, position) values
  ('architect-foundations', 1, 'bike-share-service.v2', 'bike-share-service.v2.lookup', 1),
  ('architect-foundations', 1, 'bike-share-service.v2', 'bike-share-service.v2.retry', 2),
  ('architect-foundations', 1, 'bike-share-service.v2', 'bike-share-service.v2.validation', 3),
  ('architect-foundations', 1, 'bike-share-service.v2', 'bike-share-service.v2.policy', 4);

insert into certcity_private.assessment_forms (track_id, release_no, form_id, mission_id, kind) values
  ('architect-foundations', 1, 'arts-center-equipment.v2', 'dispatch-lookup', 'followup');

insert into certcity_private.item_families (track_id, family_id, eligibility) values
  ('architect-foundations', 'arts-center-equipment.v2.coverage', 'study_only'),
  ('architect-foundations', 'arts-center-equipment.v2.execution', 'study_only'),
  ('architect-foundations', 'arts-center-equipment.v2.permission', 'study_only'),
  ('architect-foundations', 'arts-center-equipment.v2.write', 'study_only');

insert into certcity_private.item_revisions (track_id, release_no, item_id, family_id, blueprint_version, domain_no, objective_no, source_url, prompt, rubric) values
  ('architect-foundations', 1, 'arts-center-equipment.v2.coverage', 'arts-center-equipment.v2.coverage', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"coverage","prompt":"The lighting inventory returns a completed empty search for spotlights. The sound inventory times out twice and the deadline has expired. Which response best serves an event planner who asked about spotlights and microphones?","options":[["all-unknown","Report that availability across the center is unknown until both inventories can be checked again."],["all-empty","Report no available spotlights or microphones and note that the catalog may lag behind actual stock."],["partial","Report zero matches for spotlights, mark microphone availability unconfirmed, and include the sound lookup attempts in the handoff."],["estimate","Report no available spotlights and use last week’s sound inventory as the current microphone count."]]}', '{"correct":["partial"],"explanation":"The lighting result is verified for the requested scope. Sound remains unavailable after its retry. Keeping the verified result and the coverage gap helps staff continue without implying completeness."}'),
  ('architect-foundations', 1, 'arts-center-equipment.v2.execution', 'arts-center-equipment.v2.execution', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"execution","prompt":"An authenticated staff member requests a ten-day loan. The request reaches the reservation tool, which rejects it before any write under the seven-day limit. Which two choices belong in the tool’s response design?","options":[["rpc","Use a JSON-RPC unknown-tool error so the client can distinguish it from reservation success."],["flag","Set isError to true on the MCP tool result."],["success","Return a successful response with an empty reservation ID and place the rejection in the text."],["payload","Include a business-rule category, non-retryable flag, and an explanation of the maximum loan period."],["retryable","Mark the same ten-day request retryable because the assistant could shorten it on another call."]]}', '{"correct":["flag","payload"],"explanation":"The tool ran and returned an actionable policy failure. MCP’s result flag signals the failure. Application fields explain what must change. A shorter loan is a changed request and needs separate approval."}'),
  ('architect-foundations', 1, 'arts-center-equipment.v2.permission', 'arts-center-equipment.v2.permission', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"permission","prompt":"The stockroom inventory requires a staff role. A volunteer’s first call fails with a temporary network issue. After connectivity returns, the server responds with permission denied for the volunteer’s current identity. What should the assistant do next?","options":[["retry","Continue the transient retry policy because the first failure was network-related."],["access","Use the new permission outcome, stop retrying with that identity, and explain the approved access process."],["filter","Retry using a narrower inventory filter to see whether the denial is limited to particular items."],["review","Have a staff worker fetch the inventory and give the volunteer a summarized result."]]}', '{"correct":["access"],"explanation":"The latest call reached the service and established a permission boundary. Prior connectivity trouble does not change that result. A narrower request or a more privileged worker does not grant the volunteer access."}'),
  ('architect-foundations', 1, 'arts-center-equipment.v2.write', 'arts-center-equipment.v2.write', '2026-07.v1', 2, 2, 'https://modelcontextprotocol.io/specification/2026-07-28/server/tools', '{"id":"write","prompt":"A reservation write timed out after the service may have accepted it. The tool has no idempotency key, but a read-only lookup can search for the reservation by request reference. What is the best next action?","options":[["repeat","Apply the same single-retry rule used for read-only requests and repeat the reservation write."],["cancel","Send a cancellation for the asset and retry the write once the cancellation returns."],["unknown","Mark the reservation as failed and ask the requester to start a new reservation."],["verify","Check the reservation by reference first. If the outcome remains uncertain, hand it off with the reference and attempt history."]]}', '{"correct":["verify"],"explanation":"A timeout can leave a write committed. The reference lookup can resolve that uncertainty without changing state. Repeating, cancelling, or inviting a new reservation risks duplicate or unintended changes."}');

insert into certcity_private.assessment_form_items (track_id, release_no, form_id, item_id, position) values
  ('architect-foundations', 1, 'arts-center-equipment.v2', 'arts-center-equipment.v2.coverage', 1),
  ('architect-foundations', 1, 'arts-center-equipment.v2', 'arts-center-equipment.v2.execution', 2),
  ('architect-foundations', 1, 'arts-center-equipment.v2', 'arts-center-equipment.v2.permission', 3),
  ('architect-foundations', 1, 'arts-center-equipment.v2', 'arts-center-equipment.v2.write', 4);

-- The public prototype shipped these questions. This transaction records study results only.
create unique index assessment_attempts_dispatch_study
  on public.assessment_attempts (user_id, track_id, release_no, form_id)
  where track_id = 'architect-foundations' and release_no = 1
    and form_id in ('bike-share-service.v2', 'arts-center-equipment.v2');

create function certcity_private.dispatch_study_result(target_attempt uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'checkId', attempt.form_id,
    'submittedAt', floor(extract(epoch from attempt.closed_at) * 1000)::bigint,
    'answers', jsonb_object_agg(item.prompt->>'id', response.response),
    'score', count(*) filter (where response.correct)
  )
  from public.assessment_attempts attempt
  join certcity_private.assessment_responses response on response.attempt_id = attempt.id
  join certcity_private.item_revisions item
    on (item.track_id, item.release_no, item.item_id) = (response.track_id, response.release_no, response.item_id)
  where attempt.id = target_attempt and attempt.status = 'submitted'
  group by attempt.form_id, attempt.closed_at;
$$;

create function public.dispatch_study_check(actor_id uuid, operation text, stage text default null, answers jsonb default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  first_form constant text := 'bike-share-service.v2';
  followup_form constant text := 'arts-center-equipment.v2';
  form text;
  attempt public.assessment_attempts;
  schedule public.study_schedule;
  item record;
  picks jsonb;
  expected jsonb;
  submitted timestamptz;
begin
  if operation = 'status' then
    return (
      select jsonb_build_object(
        'first', certcity_private.dispatch_study_result(a.id),
        'followup', certcity_private.dispatch_study_result(b.id),
        'dueAt', floor(extract(epoch from s.due_at) * 1000)::bigint,
        'eligible', exists (
          select from public.mission_outcomes outcome
          where outcome.user_id = actor.user_id and outcome.track_id = 'architect-foundations'
            and outcome.mission_id = 'dispatch-lookup'
        )
      )
      from (select actor_id as user_id) actor
      left join public.assessment_attempts a on a.user_id = actor.user_id
        and a.track_id = 'architect-foundations' and a.release_no = 1 and a.form_id = first_form
      left join public.study_schedule s on s.source_attempt_id = a.id and s.release_no = 1 and s.form_id = followup_form
      left join public.assessment_attempts b on b.user_id = actor.user_id
        and b.track_id = 'architect-foundations' and b.release_no = 1 and b.form_id = followup_form
    );
  end if;

  if operation is null or operation not in ('start', 'submit') or stage is null or stage not in ('first', 'followup') then
    return jsonb_build_object('status', 'invalid');
  end if;
  form := case when stage = 'first' then first_form else followup_form end;

  if stage = 'followup' then
    select s.* into schedule from public.study_schedule s
    join public.assessment_attempts a on a.id = s.source_attempt_id
    where s.user_id = actor_id and a.track_id = 'architect-foundations'
      and a.release_no = 1 and a.form_id = first_form and s.release_no = 1 and s.form_id = followup_form;
    if not found or clock_timestamp() < schedule.due_at then
      return jsonb_build_object('status', 'not_due');
    end if;
  elsif not exists (
    select from public.mission_outcomes
    where user_id = actor_id and track_id = 'architect-foundations' and mission_id = 'dispatch-lookup'
  ) then
    return jsonb_build_object('status', 'shift_required');
  end if;

  if operation = 'start' then
    insert into public.assessment_attempts (user_id, track_id, release_no, form_id)
    values (actor_id, 'architect-foundations', 1, form)
    on conflict do nothing;
  end if;
  select * into attempt from public.assessment_attempts
    where user_id = actor_id and track_id = 'architect-foundations' and release_no = 1 and form_id = form
    for update;

  if not found or attempt.status = 'abandoned' then
    return jsonb_build_object('status', 'start_required');
  end if;
  if attempt.status = 'submitted' then
    return jsonb_build_object('status', 'submitted', 'result', certcity_private.dispatch_study_result(attempt.id));
  end if;

  if operation = 'start' then
    insert into certcity_private.item_exposures
      (attempt_id, user_id, track_id, release_no, form_id, item_id, family_id, delivery_position, option_order)
    select attempt.id, actor_id, f.track_id, f.release_no, f.form_id, f.item_id, r.family_id, f.position,
      array(select option->>0 from jsonb_array_elements(r.prompt->'options') with ordinality as choices(option, position)
        order by position)
    from certcity_private.assessment_form_items f
    join certcity_private.item_revisions r using (track_id, release_no, item_id)
    where (f.track_id, f.release_no, f.form_id) = (attempt.track_id, attempt.release_no, attempt.form_id)
    on conflict do nothing;

    insert into certcity_private.first_family_exposures (user_id, track_id, family_id, release_no, attempt_id, item_id)
    select actor_id, exposure.track_id, exposure.family_id, exposure.release_no, exposure.attempt_id, exposure.item_id
    from certcity_private.item_exposures exposure where exposure.attempt_id = attempt.id
    on conflict (user_id, track_id, family_id) do nothing;

    return jsonb_build_object('status', 'open');
  end if;

  if jsonb_typeof(answers) is distinct from 'object' or
     (select count(*) from jsonb_object_keys(answers)) <> (
       select count(*) from certcity_private.item_exposures where attempt_id = attempt.id
     ) or answers = '{}'::jsonb then
    return jsonb_build_object('status', 'invalid');
  end if;

  submitted := clock_timestamp();
  for item in
    select exposure.item_id, exposure.family_id, exposure.option_order,
      revision.prompt->>'id' as question_key, revision.rubric->'correct' as correct
    from certcity_private.item_exposures exposure
    join certcity_private.item_revisions revision using (track_id, release_no, item_id, family_id)
    where exposure.attempt_id = attempt.id order by exposure.delivery_position
  loop
    picks := answers->item.question_key;
    expected := item.correct;
    if jsonb_typeof(picks) is distinct from 'array' then
      return jsonb_build_object('status', 'invalid');
    end if;
    if jsonb_array_length(picks) <> jsonb_array_length(expected)
      or exists (
        select from jsonb_array_elements(picks) as choice(value)
        where jsonb_typeof(value) <> 'string' or not ((value #>> '{}') = any(item.option_order))
      )
      or (select count(distinct value) from jsonb_array_elements(picks) as choice(value)) <> jsonb_array_length(picks)
    then
      return jsonb_build_object('status', 'invalid');
    end if;
  end loop;

  insert into certcity_private.assessment_responses
    (attempt_id, item_id, user_id, track_id, release_no, family_id, response, correct, rubric_version, submitted_at)
  select attempt.id, exposure.item_id, actor_id, exposure.track_id, exposure.release_no, exposure.family_id,
    answers -> (revision.prompt->>'id'),
    (answers -> (revision.prompt->>'id')) @> (revision.rubric->'correct'),
    '1', submitted
  from certcity_private.item_exposures exposure
  join certcity_private.item_revisions revision using (track_id, release_no, item_id, family_id)
  where exposure.attempt_id = attempt.id;

  update public.assessment_attempts set status = 'submitted', closed_at = submitted where id = attempt.id;
  if stage = 'first' then
    insert into public.study_schedule (user_id, track_id, source_attempt_id, source_release_no, release_no, form_id, due_at)
    values (actor_id, attempt.track_id, attempt.id, attempt.release_no, attempt.release_no, followup_form,
      submitted + interval '168 hours');
  else
    update public.study_schedule set completed_at = submitted where id = schedule.id;
  end if;

  return jsonb_build_object('status', 'submitted', 'result', certcity_private.dispatch_study_result(attempt.id));
end;
$$;

revoke all on function certcity_private.dispatch_study_result(uuid) from public, anon, authenticated;
revoke all on function public.dispatch_study_check(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function certcity_private.dispatch_study_result(uuid) to service_role;
grant execute on function public.dispatch_study_check(uuid, text, text, jsonb) to service_role;
