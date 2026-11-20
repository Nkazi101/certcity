create table public.mission_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id text not null,
  release_no integer not null,
  mission_id text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  revision bigint not null default 0 check (revision >= 0),
  draft jsonb not null default '{}' check (jsonb_typeof(draft) = 'object'),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (id, user_id, track_id, release_no, mission_id),
  foreign key (track_id, release_no, mission_id) references public.mission_revisions,
  check ((status = 'active' and closed_at is null) or
    (status <> 'active' and closed_at is not null and closed_at >= started_at))
);

create index mission_attempts_by_learner on public.mission_attempts (user_id, started_at desc, id);
create index mission_attempts_by_revision on public.mission_attempts (track_id, release_no, mission_id);
create unique index mission_attempts_one_active
  on public.mission_attempts (user_id, track_id, mission_id) where status = 'active';

create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  user_id uuid not null,
  track_id text not null,
  release_no integer not null,
  mission_id text not null,
  command_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  committed_revision bigint not null check (committed_revision > 0),
  fixture_id text not null,
  fixture_seed bigint,
  policy jsonb not null check (jsonb_typeof(policy) = 'object'),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  passed boolean not null,
  committed_at timestamptz not null default now(),
  unique (attempt_id, command_id),
  unique (attempt_id, committed_revision),
  unique (id, user_id, track_id, release_no, mission_id, passed),
  foreign key (attempt_id, user_id, track_id, release_no, mission_id) references public.mission_attempts (id, user_id, track_id, release_no, mission_id)
    on delete cascade,
  foreign key (track_id, release_no, mission_id, fixture_id) references certcity_private.simulation_fixtures
);

create index simulation_runs_by_learner on public.simulation_runs (user_id, committed_at desc, id);
create index simulation_runs_by_fixture on public.simulation_runs (track_id, release_no, mission_id, fixture_id);

create table certcity_private.simulation_events (
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  sequence_no integer not null check (sequence_no >= 0),
  elapsed_micros bigint not null check (elapsed_micros >= 0),
  event_type text not null,
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  primary key (run_id, sequence_no)
);

create table public.mission_outcomes (
  user_id uuid not null,
  track_id text not null,
  mission_id text not null,
  release_no integer not null,
  run_id uuid not null unique,
  accepted boolean generated always as (true) stored,
  accepted_at timestamptz not null default now(),
  primary key (user_id, track_id, mission_id),
  foreign key (run_id, user_id, track_id, release_no, mission_id, accepted)
    references public.simulation_runs (id, user_id, track_id, release_no, mission_id, passed) on delete cascade
);

-- Record a form instance, the items it actually delivered, and submitted responses independently.
create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track_id text not null,
  release_no integer not null,
  form_id text not null,
  status text not null default 'active' check (status in ('active', 'submitted', 'abandoned')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  closed_at timestamptz,
  unique (id, user_id, track_id, release_no),
  unique (id, user_id, track_id, release_no, form_id),
  foreign key (track_id, release_no, form_id) references certcity_private.assessment_forms,
  check (deadline_at is null or deadline_at > started_at),
  check ((status = 'active' and closed_at is null) or
    (status <> 'active' and closed_at is not null and closed_at >= started_at))
);

create index assessment_attempts_by_learner on public.assessment_attempts (user_id, started_at desc, id);
create index assessment_attempts_by_form on public.assessment_attempts (track_id, release_no, form_id);

create table certcity_private.item_exposures (
  attempt_id uuid not null,
  user_id uuid not null,
  track_id text not null,
  release_no integer not null,
  form_id text not null,
  item_id text not null,
  family_id text not null,
  delivery_position integer not null check (delivery_position > 0),
  option_order text[] not null check (cardinality(option_order) > 0),
  first_shown_at timestamptz not null default now(),
  assisted_at timestamptz check (assisted_at is null or assisted_at >= first_shown_at),
  primary key (attempt_id, item_id),
  unique (attempt_id, delivery_position),
  unique (attempt_id, item_id, user_id, track_id, release_no, family_id),
  foreign key (attempt_id, user_id, track_id, release_no, form_id) references public.assessment_attempts (id, user_id, track_id, release_no, form_id) on delete cascade,
  foreign key (track_id, release_no, form_id, item_id) references certcity_private.assessment_form_items,
  foreign key (track_id, release_no, item_id, family_id) references certcity_private.item_revisions
    (track_id, release_no, item_id, family_id)
);

create index item_exposures_by_form_item on certcity_private.item_exposures (track_id, release_no, form_id, item_id);
create index item_exposures_by_item on certcity_private.item_exposures (track_id, release_no, item_id, family_id);

-- Claim the family before delivering any prompt or hint. The primary key arbitrates concurrent
-- exposures across forms and releases. The winner can earn independent credit if unassisted.
create table certcity_private.first_family_exposures (
  user_id uuid not null,
  track_id text not null,
  family_id text not null,
  release_no integer not null,
  attempt_id uuid not null,
  item_id text not null,
  primary key (user_id, track_id, family_id),
  unique (user_id, track_id, family_id, release_no, attempt_id, item_id),
  foreign key (attempt_id, item_id, user_id, track_id, release_no, family_id)
    references certcity_private.item_exposures (attempt_id, item_id, user_id, track_id, release_no, family_id)
    on delete cascade
);

create index first_family_exposures_by_item on certcity_private.first_family_exposures (attempt_id, item_id);

create table certcity_private.assessment_responses (
  attempt_id uuid not null,
  item_id text not null,
  user_id uuid not null,
  track_id text not null,
  release_no integer not null,
  family_id text not null,
  response jsonb not null,
  correct boolean not null,
  rubric_version text not null,
  submitted_at timestamptz not null default now(),
  primary key (attempt_id, item_id),
  unique (attempt_id, item_id, user_id, track_id, release_no, family_id),
  foreign key (attempt_id, item_id, user_id, track_id, release_no, family_id)
    references certcity_private.item_exposures (attempt_id, item_id, user_id, track_id, release_no, family_id)
    on delete cascade
);

-- Independent evidence references both the submitted response and the family's first exposure.
-- The scoring transaction checks assistance, timing, and form purpose before inserting.
create table public.learning_evidence (
  user_id uuid not null,
  track_id text not null,
  family_id text not null,
  release_no integer not null,
  attempt_id uuid not null,
  item_id text not null,
  blueprint_version text not null,
  domain_no smallint not null,
  objective_no smallint not null,
  eligibility text generated always as ('independent') stored,
  observed_at timestamptz not null default now(),
  primary key (user_id, track_id, family_id),
  foreign key (attempt_id, item_id, user_id, track_id, release_no, family_id)
    references certcity_private.assessment_responses (attempt_id, item_id, user_id, track_id, release_no, family_id) on delete cascade,
  foreign key (user_id, track_id, family_id, release_no, attempt_id, item_id)
    references certcity_private.first_family_exposures (user_id, track_id, family_id, release_no, attempt_id, item_id) on delete cascade,
  foreign key (track_id, family_id, eligibility) references certcity_private.item_families (track_id, family_id, eligibility),
  foreign key (track_id, release_no, item_id, family_id, blueprint_version, domain_no, objective_no)
    references certcity_private.item_revisions (track_id, release_no, item_id, family_id, blueprint_version, domain_no, objective_no)
);

create index learning_evidence_by_objective on public.learning_evidence
  (user_id, track_id, blueprint_version, domain_no, objective_no, observed_at desc);
create index learning_evidence_by_response on public.learning_evidence (attempt_id, item_id);
create index learning_evidence_by_item on public.learning_evidence (track_id, release_no, item_id);
create index learning_evidence_by_family on public.learning_evidence (track_id, family_id);

create table public.study_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  track_id text not null,
  source_attempt_id uuid not null,
  source_release_no integer not null,
  release_no integer not null,
  form_id text not null,
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (source_attempt_id, release_no, form_id),
  foreign key (source_attempt_id, user_id, track_id, source_release_no) references public.assessment_attempts
    (id, user_id, track_id, release_no) on delete cascade,
  foreign key (track_id, release_no, form_id) references certcity_private.assessment_forms,
  check (completed_at is null or completed_at >= due_at)
);

create index study_schedule_by_learner on public.study_schedule (user_id, due_at, id);
create index study_schedule_due on public.study_schedule (due_at, id) where completed_at is null;
create index study_schedule_by_form on public.study_schedule (track_id, release_no, form_id);

-- Browser clients may read their own safe projections. All authoritative writes go through
-- a trusted backend. Scoring inputs and raw responses stay in the private schema.
do $$
declare
  relation regclass;
begin
  foreach relation in array array[
    'public.mission_attempts', 'public.simulation_runs', 'public.mission_outcomes',
    'public.assessment_attempts', 'public.learning_evidence', 'public.study_schedule'
  ]::regclass[] loop
    execute format('alter table %s enable row level security', relation);
    execute format('revoke all on %s from public, anon, authenticated', relation);
    execute format('grant all on %s to service_role', relation);
    execute format('grant select on %s to authenticated', relation);
    execute format('create policy "Learners read their own records" on %s for select to authenticated using ((select auth.uid()) = user_id)', relation);
  end loop;

  foreach relation in array array[
    'certcity_private.simulation_events', 'certcity_private.item_exposures', 'certcity_private.first_family_exposures',
    'certcity_private.assessment_responses'
  ]::regclass[] loop
    execute format('alter table %s enable row level security', relation);
    execute format('revoke all on %s from public, anon, authenticated', relation);
    execute format('grant all on %s to service_role', relation);
  end loop;
end;
$$;
