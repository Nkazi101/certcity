-- Exam dates, lessons studied, the daily "today's work" plan and daily shifts now follow a signed-in learner across
-- devices. Before this they lived only in one browser, so a learner who studied at work and at home lost track.
-- Widen the save_key check to the patterns lib/progress-storage.ts (isProgressKey) accepts.
alter table public.learner_progress drop constraint if exists learner_progress_save_key_check;
alter table public.learner_progress
  add constraint learner_progress_save_key_check check (
    save_key in ('simza.city-dispatch.v1', 'simza.ccar-f.task-2.2.v1', 'certcity.city.active-assignment.v1')
    or save_key ~ '^certcity\.(city\.(assignment|check)\.v1|mission\.v1)\.[a-z0-9-]{1,64}$'
    or save_key ~ '^certcity\.practice\.[A-Z-]{1,24}\.[a-z0-9.-]{1,32}$'
    or save_key ~ '^certcity\.(exam-date\.v2|lessons\.v2|today\.v1|shift\.v1)\.[a-z0-9-]{1,64}$'
  );
