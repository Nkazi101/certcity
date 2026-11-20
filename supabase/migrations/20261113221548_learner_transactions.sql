insert into certcity_private.simulation_fixtures
  (track_id, release_no, mission_id, fixture_id, visibility, definition)
values ('architect-foundations', 1, 'dispatch-lookup', 'weekly-support-v1', 'preview',
  '{"requests":1000,"period":"simulated_week","engine":"prototype-v1"}');

-- Only the trusted command handler can choose the actor or write authoritative results.
create function public.start_dispatch_attempt(actor_id uuid)
returns public.mission_attempts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  attempt public.mission_attempts;
begin
  insert into public.mission_attempts (user_id, track_id, release_no, mission_id)
    values (actor_id, 'architect-foundations', 1, 'dispatch-lookup')
    on conflict (user_id, track_id, mission_id) where status = 'active' do nothing;
  select * into strict attempt from public.mission_attempts
    where user_id = actor_id and track_id = 'architect-foundations' and mission_id = 'dispatch-lookup' and status = 'active';
  return attempt;
end;
$$;

create function public.commit_dispatch_run(
  actor_id uuid,
  target_attempt uuid,
  command uuid,
  expected_revision bigint,
  request_hash text,
  policy_snapshot jsonb,
  result_summary jsonb,
  goal_met boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  attempt public.mission_attempts;
  run public.simulation_runs;
begin
  select * into attempt from public.mission_attempts
    where id = target_attempt and user_id = actor_id
      and track_id = 'architect-foundations' and release_no = 1 and mission_id = 'dispatch-lookup'
    for update;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  select * into run from public.simulation_runs where attempt_id = target_attempt and command_id = command;
  if found then
    if run.request_sha256 <> request_hash then
      return jsonb_build_object('status', 'command_conflict');
    end if;
    return jsonb_build_object('status', 'saved', 'run', to_jsonb(run));
  end if;

  if attempt.status <> 'active' or attempt.revision <> expected_revision then
    return jsonb_build_object('status', 'stale', 'revision', attempt.revision);
  end if;

  update public.mission_attempts set revision = revision + 1, draft = policy_snapshot
    where id = target_attempt returning * into attempt;

  insert into public.simulation_runs (
    attempt_id, user_id, track_id, release_no, mission_id, command_id, request_sha256,
    committed_revision, fixture_id, policy, summary, passed
  ) values (
    target_attempt, actor_id, attempt.track_id, attempt.release_no, attempt.mission_id, command, request_hash,
    attempt.revision, 'weekly-support-v1', policy_snapshot, result_summary, goal_met
  ) returning * into run;

  if goal_met then
    insert into public.mission_outcomes (user_id, track_id, mission_id, release_no, run_id, accepted_at)
      values (actor_id, attempt.track_id, attempt.mission_id, attempt.release_no, run.id, run.committed_at)
      on conflict (user_id, track_id, mission_id) do update
      set release_no = excluded.release_no, run_id = excluded.run_id, accepted_at = excluded.accepted_at;
  end if;

  return jsonb_build_object('status', 'saved', 'run', to_jsonb(run));
end;
$$;

revoke all on function public.start_dispatch_attempt(uuid) from public, anon, authenticated;
revoke all on function public.commit_dispatch_run(uuid, uuid, uuid, bigint, text, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.start_dispatch_attempt(uuid) to service_role;
grant execute on function public.commit_dispatch_run(uuid, uuid, uuid, bigint, text, jsonb, jsonb, boolean)
  to service_role;

-- Supabase's event-trigger helper is only invoked by Postgres DDL.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
