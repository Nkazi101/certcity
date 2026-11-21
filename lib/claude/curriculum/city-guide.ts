import type { TrackId } from "../blueprints";
import { associateStudy } from "./associate";
import { developerStudy } from "./developer";
import { professionalStudy } from "./professional";
import type { GuideActivity } from "./types";

type Placement = Readonly<Record<string, readonly GuideActivity[0][]>>;

const placements: Partial<Record<TrackId, Placement>> = {
  "associate-foundations": {
    "enrollment-replies": ["2.1", "2.2", "2.3"],
    "market-bulletin": ["1.1", "1.2", "2.4"],
    "school-notice-pilot": ["1.3", "4.1", "4.4"],
    "library-desk": ["3.1", "3.3", "5.1", "5.2"],
    "library-activity-kit": ["4.3", "5.3", "5.4"],
    "kitchen-billing-audit": ["3.2"],
    "community-policy": ["4.2", "6.1", "6.2", "6.3"],
  },
  "developer-foundations": {
    "supplier-invoices": ["6.2", "6.3"],
    "permit-agent": ["1.1", "1.2", "1.3", "8.1"],
    "printworks-stream": ["2.4", "3.1", "4.2"],
    "vendor-batch-api": ["2.1", "5.1", "5.3"],
    "library-workers": ["2.2", "6.1", "6.4", "8.2", "8.3"],
    "repair-desk-safety": ["7.1", "7.2", "7.3"],
    "developer-release": ["2.3", "3.2", "4.1", "5.2"],
  },
  "architect-professional": {
    "support-pilot": ["1.2", "1.5", "2.1", "4.6"],
    "public-permit-discovery": ["1.1", "1.3", "4.1", "4.2", "6.1"],
    "library-retrieval-architecture": ["2.2", "3.3", "3.4", "3.5", "4.5"],
    "professional-eval-gate": ["2.3", "4.3", "4.4", "4.7", "5.6"],
    "market-scale": ["2.4", "2.5", "2.6", "3.6"],
    "tenant-tools": ["1.4", "3.1", "3.2", "3.7"],
    "community-controls": ["1.6", "5.1", "5.2", "5.3", "5.4", "5.5"],
    "regional-operations": ["3.8", "6.2", "6.3", "7.1", "7.2", "7.3"],
  },
};

const activities: Partial<Record<TrackId, readonly GuideActivity[]>> = {
  "associate-foundations": associateStudy,
  "developer-foundations": developerStudy,
  "architect-professional": professionalStudy,
};

export function missionGuideCases(track: TrackId, mission: string) {
  const objectives = new Set(placements[track]?.[mission]);
  return activities[track]?.filter(([id]) => objectives.has(id)) ?? [];
}

export function guideMissionId(track: TrackId, objective: GuideActivity[0]) {
  return Object.entries(placements[track] ?? {}).find(([, objectives]) => objectives.includes(objective))?.[0];
}

export function guideCityHref(track: TrackId, mission: string, objective?: string) {
  const parameters = new URLSearchParams({ pathway: track, mission, guide: "december-2026", ...(objective && { objective }) });
  return "/?" + parameters.toString();
}
