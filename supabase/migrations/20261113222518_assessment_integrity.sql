-- Evidence requires an unassisted response on a first-seen independent family.
-- The exposure row lock serializes evidence insertion with recording assistance.
create function certcity_private.check_independent_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  exposure certcity_private.item_exposures;
  submitted timestamptz;
  kind text;
begin
  select * into strict exposure from certcity_private.item_exposures
    where attempt_id = new.attempt_id and item_id = new.item_id for update;

  select response.submitted_at, form.kind into strict submitted, kind
    from certcity_private.assessment_responses response
    join public.assessment_attempts attempt on attempt.id = response.attempt_id
    join certcity_private.assessment_forms form on (form.track_id, form.release_no, form.form_id) =
      (attempt.track_id, attempt.release_no, attempt.form_id)
    where response.attempt_id = new.attempt_id and response.item_id = new.item_id
      and attempt.status = 'submitted' and response.submitted_at <= attempt.closed_at;

  if kind not in ('mission_check', 'followup') or submitted < exposure.first_shown_at
    or exposure.assisted_at <= submitted then
    raise exception 'The response is ineligible for independent evidence' using errcode = '23514';
  end if;

  new.observed_at := submitted;
  return new;
end;
$$;

create trigger check_independent_evidence
  before insert or update on public.learning_evidence
  for each row execute function certcity_private.check_independent_evidence();

create function certcity_private.invalidate_assisted_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.learning_evidence
    where attempt_id = new.attempt_id and item_id = new.item_id and observed_at >= new.assisted_at;
  return new;
end;
$$;

create trigger invalidate_assisted_evidence
  after update of assisted_at on certcity_private.item_exposures
  for each row when (new.assisted_at is not null and new.assisted_at is distinct from old.assisted_at)
  execute function certcity_private.invalidate_assisted_evidence();

revoke all on function certcity_private.check_independent_evidence() from public, anon, authenticated;
revoke all on function certcity_private.invalidate_assisted_evidence() from public, anon, authenticated;
