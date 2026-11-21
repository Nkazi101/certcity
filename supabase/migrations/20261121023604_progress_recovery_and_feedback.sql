create table public.practice_item_reports (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  track_id text not null check (track_id in ('associate-foundations', 'developer-foundations', 'architect-foundations', 'architect-professional')),
  guide text not null check (guide in ('july-2026', 'december-2026')),
  item_id text not null check (item_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$'),
  form text check (form in ('original', 'retest', 'recovery', 'reassessment')),
  content_revision text check (content_revision ~ '^[a-f0-9]{16}$'),
  report_type text not null check (report_type in ('accuracy', 'clarity', 'accessibility', 'other')),
  details text not null check (char_length(trim(details)) between 10 and 1200)
);

create index practice_item_reports_user_id_created_at_idx on public.practice_item_reports (user_id, created_at);
alter table public.practice_item_reports enable row level security;
revoke all on public.practice_item_reports from public, anon, authenticated;
grant insert (id, track_id, guide, item_id, form, content_revision, report_type, details) on public.practice_item_reports to authenticated;
grant select on public.practice_item_reports to authenticated, service_role;
create policy "Learners file their own item reports"
on public.practice_item_reports for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Learners read their own item reports"
on public.practice_item_reports for select to authenticated
using ((select auth.uid()) = user_id);

create table public.client_health_events (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_day date not null default (timezone('UTC', now())::date),
  event_type text not null check (event_type in ('sync-unavailable', 'sync-recovered', 'scene-ready', 'scene-fallback')),
  release text not null check (release ~ '^[a-zA-Z0-9._-]{1,80}$'),
  surface text not null check (surface in ('account', 'city', 'room', 'dispatch')),
  elapsed_ms integer check (elapsed_ms between 0 and 120000),
  primary key (user_id, event_day, event_type, surface)
);
alter table public.client_health_events enable row level security;
revoke all on public.client_health_events from public, anon, authenticated;
grant insert (event_type, release, surface, elapsed_ms) on public.client_health_events to authenticated;
grant select on public.client_health_events to service_role;
create policy "Learners submit their own opted-in health signals"
on public.client_health_events for insert to authenticated
with check ((select auth.uid()) = user_id);
