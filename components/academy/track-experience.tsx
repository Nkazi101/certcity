"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Track } from "../../lib/claude/blueprints";
import { expectedRestores } from "../../lib/restore-gate";
import { useRestoreGate } from "../restore-gate";

function OpeningPractice() {
  // The workspace chunk is still loading: keep the practice deep link veiled until the workspace itself takes over.
  useRestoreGate("route", false);
  return null;
}

const Workspace = dynamic(() => import("./workspace").then(({ TrackWorkspace }) => TrackWorkspace), {
  ssr: false,
  loading: OpeningPractice,
});

/**
 * The prerendered page is the public guide. A practice deep link (?practice=1, ?guide=, ?domain=, ?objective= or a
 * workspace anchor) swaps in the practice workspace instead. The pre-paint script recognises the same links
 * (lib/restore-gate.ts), so the guide is hidden and "Opening practice…" shows from the first paint until the
 * workspace has restored this learner's progress.
 */
export function TrackExperience({ track, breadcrumbs, children }: { track: Track; breadcrumbs: ReactNode; children: ReactNode }) {
  const [practicing, setPracticing] = useState<boolean | null>(null);
  useRestoreGate("route", practicing !== null);

  useEffect(() => {
    setPracticing(expectedRestores().split(" ").includes("route"));
  }, []);

  return <>
    <div className="academy-width academy-workspace" data-restore-status="route"><p role="status">Opening practice…</p></div>
    <div className="restore-contents" data-restore-replace="route">
      {practicing ? <Workspace track={track} breadcrumbs={breadcrumbs} /> : children}
    </div>
  </>;
}
