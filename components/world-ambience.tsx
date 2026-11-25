"use client";

import { Clock, Moon, Sun, Sunrise, Sunset, Volume2, VolumeX } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { TimeMode } from "../lib/scene/sky";
import { soundscape } from "./soundscape";
import styles from "./world-ambience.module.css";

const timeKey = "certcity.time-of-day.v1";
const order: readonly TimeMode[] = ["auto", "dawn", "day", "dusk", "night"];

export function readTimeMode(): TimeMode {
  try {
    const value = window.localStorage.getItem(timeKey);
    return order.includes(value as TimeMode) ? value as TimeMode : "auto";
  } catch {
    return "auto";
  }
}

export function nextTimeMode(mode: TimeMode) {
  const next = order[(order.indexOf(mode) + 1) % order.length];
  try {
    window.localStorage.setItem(timeKey, next);
  } catch {
    // The light still changes for this visit.
  }
  return next;
}

const icons = { Dawn: Sunrise, Day: Sun, Dusk: Sunset, Night: Moon } as const;

/** Time-of-day cycle button. In auto mode the icon follows the current light and a clock badge marks it as automatic. */
export function TimeOfDayButton({ mode, label, onChange }: { mode: TimeMode; label: string; onChange: (mode: TimeMode) => void }) {
  const Icon = icons[label as keyof typeof icons] ?? Sun;
  const description = mode === "auto" ? `${label}, following your local time` : label;
  const following = order[(order.indexOf(mode) + 1) % order.length];
  return (
    <button type="button" className={styles.control} aria-label={`Time of day: ${description}. Switch to ${following === "auto" ? "local time" : following}`}
      title={`Time of day: ${description}`} onClick={() => onChange(nextTimeMode(mode))}>
      <Icon size={17} aria-hidden="true" />
      {mode === "auto" && <Clock className={styles.badge} size={10} strokeWidth={2.6} aria-hidden="true" />}
    </button>
  );
}

function subscribe(listener: () => void) {
  soundscape.init();
  return soundscape.subscribe(listener);
}

export function useSoundOn() {
  return useSyncExternalStore(subscribe, () => soundscape.on, () => false);
}

/** Mute/unmute for the procedural soundscape. Off by default; the choice is remembered. */
export function SoundButton() {
  const on = useSoundOn();
  return (
    <button type="button" className={styles.control} aria-pressed={on} data-on={on || undefined}
      aria-label={on ? "Mute city sounds" : "Play city sounds"} title={on ? "Mute city sounds" : "Play city sounds"}
      onClick={() => soundscape.toggle()}>
      {on ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
    </button>
  );
}
