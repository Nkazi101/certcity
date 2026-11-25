import * as THREE from "three";

export type TimeMode = "auto" | "dawn" | "day" | "dusk" | "night";
export const timeModes: readonly TimeMode[] = ["auto", "dawn", "day", "dusk", "night"];
export const presetHours: Record<Exclude<TimeMode, "auto">, number> = { dawn: 6.7, day: 12.5, dusk: 18.35, night: 22.5 };

/** One world hour passes every three real minutes, so a visit sees the light move without it ever feeling fast. */
export const realSecondsPerWorldHour = 180;

type Key = {
  hour: number;
  background: string;
  fog: string;
  sky: string;
  ground: string;
  ambient: number;
  sun: string;
  sunIntensity: number;
  /** Elevation of the key light in degrees. At night the key light is the moon. */
  elevation: number;
  /** Swing around the district's composed light direction, in radians. */
  swing: number;
  exposure: number;
  /** 0 = windows dark, 1 = full evening glow. */
  night: number;
  /** Share of ordinary windows that are lit. */
  occupancy: number;
  shadow: number;
};

// The "day" key reproduces the art-directed light that shipped before the cycle existed.
const day: Omit<Key, "hour" | "swing"> = {
  background: "#b6a6b7", fog: "#b4a0a9", sky: "#c3d1ff", ground: "#88738d", ambient: 1.57,
  sun: "#ffdcaa", sunIntensity: 3.1, elevation: 43, exposure: 1.04, night: 0, occupancy: 0, shadow: .9,
};
const night: Omit<Key, "hour" | "swing"> = {
  background: "#434a66", fog: "#474e6a", sky: "#9ca6cc", ground: "#4b4560", ambient: 1.22,
  sun: "#bfc9ee", sunIntensity: 1.15, elevation: 40, exposure: 1.16, night: 1, occupancy: .5, shadow: .55,
};
const keys: Key[] = [
  { hour: 0, swing: .35, ...night, occupancy: .3 },
  { hour: 5.1, swing: .35, ...night, occupancy: .18 },
  { hour: 6.7, swing: -.75, background: "#d2b3bd", fog: "#cfadb6", sky: "#dccbf4", ground: "#7f6d8b", ambient: 1.42,
    sun: "#ffbe92", sunIntensity: 2.5, elevation: 21, exposure: 1.04, night: .32, occupancy: .2, shadow: .82 },
  { hour: 9, swing: -.45, ...day, sun: "#ffe0b8", elevation: 36 },
  { hour: 12.5, swing: 0, ...day },
  { hour: 16, swing: .4, ...day, sun: "#ffd39c", elevation: 37 },
  { hour: 18.35, swing: .75, background: "#c99189", fog: "#c48c89", sky: "#f2c4b2", ground: "#715a7d", ambient: 1.36,
    sun: "#ff9c5e", sunIntensity: 2.55, elevation: 21, exposure: 1.03, night: .62, occupancy: .38, shadow: .84 },
  { hour: 19.9, swing: .5, background: "#655f86", fog: "#66607f", sky: "#b2aed6", ground: "#54496a", ambient: 1.25,
    sun: "#c8c1ee", sunIntensity: 1.2, elevation: 34, exposure: 1.12, night: .92, occupancy: .55, shadow: .6 },
  { hour: 22.5, swing: .35, ...night },
  { hour: 24, swing: .35, ...night, occupancy: .3 },
];

export type SkyState = {
  background: THREE.Color;
  fog: THREE.Color;
  sky: THREE.Color;
  ground: THREE.Color;
  sun: THREE.Color;
  ambient: number;
  sunIntensity: number;
  elevation: number;
  swing: number;
  exposure: number;
  night: number;
  occupancy: number;
  shadow: number;
};

export function createSkyState(): SkyState {
  return {
    background: new THREE.Color(), fog: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(),
    ambient: 0, sunIntensity: 0, elevation: 0, swing: 0, exposure: 1, night: 0, occupancy: 0, shadow: 1,
  };
}

const left = new THREE.Color();
const right = new THREE.Color();
function mixColor(target: THREE.Color, a: string, b: string, t: number) {
  return target.copy(left.set(a)).lerp(right.set(b), t);
}

/** Sample the single day curve at a local hour in [0, 24). */
export function sampleSky(hour: number, out: SkyState) {
  const h = ((hour % 24) + 24) % 24;
  let index = keys.findIndex((key) => key.hour > h) - 1;
  if (index < 0) index = keys.length - 2;
  const a = keys[index], b = keys[index + 1];
  const linear = (h - a.hour) / Math.max(1e-6, b.hour - a.hour);
  const t = linear * linear * (3 - 2 * linear);
  mixColor(out.background, a.background, b.background, t);
  mixColor(out.fog, a.fog, b.fog, t);
  mixColor(out.sky, a.sky, b.sky, t);
  mixColor(out.ground, a.ground, b.ground, t);
  mixColor(out.sun, a.sun, b.sun, t);
  const mix = (x: number, y: number) => x + (y - x) * t;
  out.ambient = mix(a.ambient, b.ambient);
  out.sunIntensity = mix(a.sunIntensity, b.sunIntensity);
  out.elevation = mix(a.elevation, b.elevation);
  out.swing = mix(a.swing, b.swing);
  out.exposure = mix(a.exposure, b.exposure);
  out.night = mix(a.night, b.night);
  out.occupancy = mix(a.occupancy, b.occupancy);
  out.shadow = mix(a.shadow, b.shadow);
  return out;
}

export function localHour(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/** Rotate the district's composed light offset by the curve's swing and re-pitch it to the curve's elevation. */
export function orientSun(base: THREE.Vector3, sky: SkyState, out: THREE.Vector3) {
  const azimuth = Math.atan2(base.z, base.x) + sky.swing;
  const length = base.length();
  const elevation = THREE.MathUtils.degToRad(sky.elevation);
  return out.set(Math.cos(azimuth) * Math.cos(elevation) * length, Math.sin(elevation) * length,
    Math.sin(azimuth) * Math.cos(elevation) * length);
}

export function timeLabel(mode: TimeMode, hour: number) {
  if (mode !== "auto") return mode[0].toUpperCase() + mode.slice(1);
  const h = ((hour % 24) + 24) % 24;
  return h < 5.5 || h >= 20.5 ? "Night" : h < 8.5 ? "Dawn" : h < 17.2 ? "Day" : "Dusk";
}
