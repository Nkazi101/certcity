"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Track } from "../../lib/claude/blueprints";

const workspaceAnchors = new Set(["#assignment", "#entry-bridge", "#guide-skills", "#domain-title", "#track-practicals", "#rehearsal", "#practice-followup", "#practice-controls"]);
const Workspace = dynamic(() => import("./workspace").then(({ TrackWorkspace }) => TrackWorkspace), {
  ssr: false,
  loading: () => <main className="academy-width academy-workspace"><p role="status">Opening practice…</p></main>,
});

export function TrackExperience({ track, breadcrumbs, children }: { track: Track; breadcrumbs: ReactNode; children: ReactNode }) {
  const [practicing, setPracticing] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const guide = url.searchParams.get("guide");
    setPracticing(url.searchParams.get("practice") === "1" || guide === "july-2026" || guide === "december-2026" ||
      url.searchParams.has("domain") || url.searchParams.has("objective") || workspaceAnchors.has(url.hash));
  }, []);

  return practicing ? <Workspace track={track} breadcrumbs={breadcrumbs} /> : children;
}
