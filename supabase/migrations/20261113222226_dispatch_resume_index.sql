create index simulation_runs_dispatch_resume
  on public.simulation_runs (user_id, passed desc, committed_at desc, id desc)
  where track_id = 'architect-foundations' and mission_id = 'dispatch-lookup';
