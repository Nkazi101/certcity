-- Exam-realistic practice items (longer stems, a rationale for every option) roughly triple the size of
-- archived rehearsal snapshots. A learner who sits every form on a track can exceed 512 KiB per save.
-- Raise the per-row bound to 2 MiB; the client enforces the same limit in lib/progress-merge.ts.
alter table public.learner_progress drop constraint if exists learner_progress_payload_check;
alter table public.learner_progress
  add constraint learner_progress_payload_check check (octet_length(payload) <= 2097152 and payload is json);
