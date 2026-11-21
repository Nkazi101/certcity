import type { Track } from "../blueprints";
import { decemberVersion, rehearsalBlueprint } from "../december-blueprints";
import type { ExamVersion } from "../december-blueprints";
import { missionMappings } from "../missions";
import { missionsFor } from "../pathway";
import type { PracticeItem } from "../items";
import { associateStudy } from "./associate";
import { developerStudy } from "./developer";
import { professionalStudy } from "./professional";
import type { GuideActivity } from "./types";

const revisedStudy: Partial<Record<Track["id"], readonly GuideActivity[]>> = {
  "associate-foundations": associateStudy,
  "developer-foundations": developerStudy,
  "architect-professional": professionalStudy,
};

export function objectiveCoverage(track: Track, version: ExamVersion) {
  const revised = version === decemberVersion;
  const activities = new Map((revised ? revisedStudy[track.id] ?? [] : []).map((activity) => [activity[0], activity]));
  const missions = revised ? [] : missionsFor(track.id).map((mission) => ({ mission, mappings: missionMappings(mission) }));
  return rehearsalBlueprint(track, version).domains.map((domain) => ({
    ...domain,
    skills: domain.objectives.map((title, index) => {
      const id: PracticeItem["objective"] = `${domain.id}.${index + 1}`;
      return { id, title, activity: activities.get(id), missions: missions.filter(({ mappings }) => mappings.some(({ objective }) => objective === id)).map(({ mission }) => mission) };
    }),
  }));
}
