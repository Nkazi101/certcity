-- Identity and access. Auth owns credentials. The app owns profiles and enrollment.
create schema certcity_private;
revoke all on schema certcity_private from public, anon, authenticated;
grant usage on schema certcity_private to service_role;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('learner', 'staff', 'admin')),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (organization_id, user_id)
);

create index organization_members_by_user on public.organization_members (user_id, organization_id);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  starts_at timestamptz,
  ends_at timestamptz,
  archived_at timestamptz,
  unique (id, organization_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index cohorts_by_organization on public.cohorts (organization_id);

create table public.cohort_members (
  cohort_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (cohort_id, user_id),
  foreign key (cohort_id, organization_id) references public.cohorts (id, organization_id) on delete cascade,
  foreign key (organization_id, user_id)
    references public.organization_members (organization_id, user_id) on delete cascade
);

create index cohort_members_by_user on public.cohort_members (user_id, organization_id);
create index cohort_members_by_organization_member on public.cohort_members (organization_id, user_id);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_members enable row level security;

revoke all on public.profiles, public.organizations, public.organization_members,
  public.cohorts, public.cohort_members from public, anon, authenticated;
grant all on public.profiles, public.organizations, public.organization_members,
  public.cohorts, public.cohort_members to service_role;
grant select on public.profiles, public.organizations, public.organization_members,
  public.cohorts, public.cohort_members to authenticated;
grant insert (user_id, display_name), update (display_name) on public.profiles to authenticated;

create policy "Learners read their own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Learners create their own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Learners edit their own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Members read their own organization memberships" on public.organization_members for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Active members read their organizations" on public.organizations for select to authenticated
  using (archived_at is null and exists (
    select 1 from public.organization_members membership
    where membership.organization_id = organizations.id
      and membership.user_id = (select auth.uid()) and membership.revoked_at is null
  ));

create policy "Active organization members read their cohort enrollments" on public.cohort_members for select to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.organization_members membership
    where membership.organization_id = cohort_members.organization_id
      and membership.user_id = (select auth.uid()) and membership.revoked_at is null
  ));
create policy "Active learners read their cohorts" on public.cohorts for select to authenticated
  using (archived_at is null and exists (
    select 1 from public.organizations organization where organization.id = cohorts.organization_id
  ) and exists (
    select 1 from public.cohort_members enrollment
    where enrollment.cohort_id = cohorts.id
      and enrollment.user_id = (select auth.uid()) and enrollment.revoked_at is null
  ));
