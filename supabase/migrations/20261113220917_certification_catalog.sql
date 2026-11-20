-- Catalog versions are pinned by learner activity. Publish a new release for content edits.
create table public.certification_tracks (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  credential_code text not null unique,
  title text not null
);

create table public.city_places (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  district_id text not null,
  name text not null
);

create table public.blueprint_versions (
  track_id text not null references public.certification_tracks (id),
  version text not null,
  guide_url text not null check (guide_url like 'https://%'),
  primary key (track_id, version)
);

create table public.blueprint_domains (
  track_id text not null,
  blueprint_version text not null,
  domain_no smallint not null check (domain_no > 0),
  title text not null,
  weight_basis_points smallint not null check (weight_basis_points between 1 and 10000),
  primary key (track_id, blueprint_version, domain_no),
  foreign key (track_id, blueprint_version) references public.blueprint_versions (track_id, version)
);

create table public.blueprint_objectives (
  track_id text not null,
  blueprint_version text not null,
  domain_no smallint not null,
  objective_no smallint not null check (objective_no > 0),
  title text not null,
  primary key (track_id, blueprint_version, domain_no, objective_no),
  foreign key (track_id, blueprint_version, domain_no)
    references public.blueprint_domains (track_id, blueprint_version, domain_no)
);

create table public.content_releases (
  track_id text not null,
  release_no integer not null check (release_no > 0),
  blueprint_version text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz,
  primary key (track_id, release_no),
  unique (track_id, release_no, blueprint_version),
  foreign key (track_id, blueprint_version) references public.blueprint_versions (track_id, version)
);

create index content_releases_by_blueprint on public.content_releases (track_id, blueprint_version);

create table public.current_content_releases (
  track_id text primary key,
  release_no integer not null,
  foreign key (track_id, release_no) references public.content_releases (track_id, release_no)
);

create table public.missions (
  track_id text not null references public.certification_tracks (id),
  mission_id text not null check (mission_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  primary key (track_id, mission_id)
);

create table public.mission_revisions (
  track_id text not null,
  release_no integer not null,
  mission_id text not null,
  place_id text not null references public.city_places (id),
  kind text not null check (kind in ('dispatch', 'original', 'workbench')),
  title text not null,
  brief text not null,
  engine_version text not null,
  primary key (track_id, release_no, mission_id),
  foreign key (track_id, release_no) references public.content_releases (track_id, release_no),
  foreign key (track_id, mission_id) references public.missions (track_id, mission_id)
);

create index mission_revisions_by_mission on public.mission_revisions (track_id, mission_id);
create index mission_revisions_by_place on public.mission_revisions (place_id);

create table public.mission_prerequisites (
  track_id text not null,
  release_no integer not null,
  mission_id text not null,
  prerequisite_id text not null check (prerequisite_id <> mission_id),
  primary key (track_id, release_no, mission_id, prerequisite_id),
  foreign key (track_id, release_no, mission_id) references public.mission_revisions,
  foreign key (track_id, release_no, prerequisite_id) references public.mission_revisions
);

create index mission_prerequisites_reverse on public.mission_prerequisites (track_id, release_no, prerequisite_id);

create table public.mission_objectives (
  track_id text not null,
  release_no integer not null,
  mission_id text not null,
  blueprint_version text not null,
  domain_no smallint not null,
  objective_no smallint not null,
  purpose text not null check (purpose in ('taught', 'required')),
  primary key (track_id, release_no, mission_id, domain_no, objective_no, purpose),
  foreign key (track_id, release_no, mission_id) references public.mission_revisions,
  foreign key (track_id, release_no, blueprint_version) references public.content_releases (track_id, release_no, blueprint_version),
  foreign key (track_id, blueprint_version, domain_no, objective_no) references public.blueprint_objectives
);

create index mission_objectives_by_objective on public.mission_objectives
  (track_id, blueprint_version, domain_no, objective_no);

-- A family spans revisions and related items. Track releases pin exact item versions.
create table certcity_private.item_families (
  track_id text not null references public.certification_tracks (id),
  family_id text not null,
  eligibility text not null check (eligibility in ('study_only', 'independent')),
  primary key (track_id, family_id),
  unique (track_id, family_id, eligibility)
);

create table certcity_private.item_revisions (
  track_id text not null,
  release_no integer not null,
  item_id text not null,
  family_id text not null,
  blueprint_version text not null,
  domain_no smallint not null,
  objective_no smallint not null,
  source_url text not null check (source_url like 'https://%'),
  prompt jsonb not null check (jsonb_typeof(prompt) = 'object'),
  rubric jsonb not null check (jsonb_typeof(rubric) = 'object'),
  primary key (track_id, release_no, item_id),
  unique (track_id, release_no, item_id, family_id),
  unique (track_id, release_no, item_id, family_id, blueprint_version, domain_no, objective_no),
  foreign key (track_id, family_id) references certcity_private.item_families,
  foreign key (track_id, release_no, blueprint_version) references public.content_releases (track_id, release_no, blueprint_version),
  foreign key (track_id, blueprint_version, domain_no, objective_no) references public.blueprint_objectives
);

create index item_revisions_by_family on certcity_private.item_revisions (track_id, family_id);
create index item_revisions_by_objective on certcity_private.item_revisions
  (track_id, blueprint_version, domain_no, objective_no);

create table certcity_private.assessment_forms (
  track_id text not null,
  release_no integer not null,
  form_id text not null,
  mission_id text,
  kind text not null check (kind in ('practice', 'lens', 'mission_check', 'followup')),
  primary key (track_id, release_no, form_id),
  foreign key (track_id, release_no) references public.content_releases,
  foreign key (track_id, release_no, mission_id) references public.mission_revisions
);

create index assessment_forms_by_mission on certcity_private.assessment_forms (track_id, release_no, mission_id);

create table certcity_private.assessment_form_items (
  track_id text not null,
  release_no integer not null,
  form_id text not null,
  item_id text not null,
  position integer not null check (position > 0),
  primary key (track_id, release_no, form_id, item_id),
  unique (track_id, release_no, form_id, position),
  foreign key (track_id, release_no, form_id) references certcity_private.assessment_forms,
  foreign key (track_id, release_no, item_id) references certcity_private.item_revisions
);

create index assessment_form_items_by_item on certcity_private.assessment_form_items (track_id, release_no, item_id);

create table certcity_private.simulation_fixtures (
  track_id text not null,
  release_no integer not null,
  mission_id text not null,
  fixture_id text not null,
  visibility text not null check (visibility in ('preview', 'held_out')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  primary key (track_id, release_no, mission_id, fixture_id),
  foreign key (track_id, release_no, mission_id) references public.mission_revisions
);

-- The initial app ships its own catalog. Database reads of drafts, rubrics and fixtures
-- are backend-only. A later catalog API can expose a deliberately filtered projection.
do $$
declare
  relation regclass;
begin
  foreach relation in array array[
    'public.certification_tracks', 'public.city_places', 'public.blueprint_versions',
    'public.blueprint_domains', 'public.blueprint_objectives', 'public.content_releases',
    'public.current_content_releases', 'public.missions', 'public.mission_revisions',
    'public.mission_prerequisites', 'public.mission_objectives', 'certcity_private.item_families',
    'certcity_private.item_revisions', 'certcity_private.assessment_forms',
    'certcity_private.assessment_form_items', 'certcity_private.simulation_fixtures'
  ]::regclass[] loop
    execute format('alter table %s enable row level security', relation);
    execute format('revoke all on %s from public, anon, authenticated', relation);
    execute format('grant all on %s to service_role', relation);
  end loop;
end;
$$;
