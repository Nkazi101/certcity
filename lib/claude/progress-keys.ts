import { blueprint } from "./blueprints";
import type { Track } from "./blueprints";

export function progressKey(track: Track) {
  return `certcity.practice.${track.code}.${blueprint}`;
}

export function readinessKey(track: Track) {
  return `certcity.practice.${track.code}.readiness.v1`;
}
