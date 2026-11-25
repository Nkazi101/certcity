"use client";

import { Camera, Crosshair, MessageCircle, Minus, Plus, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MissionRoomReplay, SceneKind, SceneProgress, TimeMode, WorldAmbience, WorldControls } from "../lib/scene/renderer";
import type { RoomReaction, StationOutcome } from "../lib/scene/room-reactions";
import { defaultDistrict } from "../lib/scene/districts";
import type { DistrictId } from "../lib/scene/districts";
import type { MissionRoom } from "../lib/scene/mission-interior";
import { cityLight, cityLightAttribute } from "../lib/city-light";
import { recordClientHealth } from "../lib/client-health";
import { useAccount } from "./account";
import { readTimeMode, SoundButton, TimeOfDayButton } from "./world-ambience";
import { soundscape } from "./soundscape";

type Marker<T extends string> = {
  id: T;
  name: string;
  icon: LucideIcon;
  color: string;
  assignment?: boolean;
  district?: DistrictId;
};

type SceneProps<T extends string> = {
  kind: SceneKind;
  missionRoom?: MissionRoom;
  district?: DistrictId;
  districtVisit?: number;
  panelOpen?: boolean;
  staffHours?: number;
  /** Depot only: the daily shift's customer line and callbacks. */
  shiftScene?: RoomReaction | null;
  /** Depot and the school: the waiting line, callback bench and held person (see lib/scene/room-reactions.ts). Overrides shiftScene. */
  roomReaction?: RoomReaction | null;
  /** ✓ / "!" over stations by id (depot: support, lookup, dispatch; rooms: work, evidence, stakeholder-0, stakeholder-1). */
  stationOutcomes?: Readonly<Record<string, StationOutcome>>;
  assignmentComplete?: boolean;
  roomReplay?: { replay: MissionRoomReplay; preview: HTMLCanvasElement | null } | null;
  description: string;
  markers: readonly Marker<T>[];
  selected: T | null;
  onSelect: (id: T) => void;
  onTalk?: (id: T) => void;
  conversationMarker?: { id: T; name: string; label: string };
  assignmentStatuses?: Partial<Record<T, string>>;
  /** City only: saved learner progress to show on buildings and the skyline. */
  progress?: SceneProgress;
};

export function WorldScene<T extends string>({
  kind, missionRoom, district = defaultDistrict, districtVisit = 0, panelOpen = false, staffHours = 16, shiftScene = null, roomReaction, stationOutcomes, assignmentComplete = false, roomReplay, description, markers, selected, onSelect, onTalk, conversationMarker, assignmentStatuses, progress,
}: SceneProps<T>) {
  const { user } = useAccount();
  const host = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLButtonElement>());
  const world = useRef<WorldControls>(null);
  const selection = useRef(selected);
  const districtRef = useRef(district);
  const districtVisitRef = useRef(districtVisit);
  const hoursRef = useRef(staffHours);
  const reaction = roomReaction === undefined ? shiftScene : roomReaction;
  const shiftRef = useRef(reaction);
  const outcomesRef = useRef(stationOutcomes);
  const completionRef = useRef(assignmentComplete);
  const replayRef = useRef(roomReplay);
  const selectCallback = useRef(onSelect);
  const talkCallback = useRef(onTalk);
  const healthUser = useRef(user?.id);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const progressRef = useRef(progress);
  const [timeMode, setTimeMode] = useState<TimeMode>("auto");
  const timeModeRef = useRef<TimeMode>("auto");
  const [ambience, setAmbience] = useState<WorldAmbience | null>(null);
  const calmRef = useRef(false);
  const conversationId = conversationMarker?.id;
  const setConversationMarker = useCallback((element: HTMLButtonElement | null) => {
    if (!conversationId) return;
    const key = `talk:${conversationId}`;
    if (element) {
      element.hidden = true;
      elements.current.set(key, element);
    } else elements.current.delete(key);
  }, [conversationId]);

  useEffect(() => {
    const changed = district !== districtRef.current || districtVisit !== districtVisitRef.current;
    districtRef.current = district;
    districtVisitRef.current = districtVisit;
    if (changed) world.current?.focusDistrict(district, Boolean(selected));
    selection.current = selected;
    world.current?.select(selected);
  }, [district, districtVisit, selected]);

  useEffect(() => {
    selectCallback.current = onSelect;
    talkCallback.current = onTalk;
  }, [onSelect, onTalk]);

  useEffect(() => {
    healthUser.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    world.current?.refreshMarkers();
  }, [panelOpen, assignmentStatuses, conversationId, state]);

  useEffect(() => {
    progressRef.current = progress;
    if (progress) world.current?.setProgress(progress);
  }, [progress]);

  // The pre-paint script picks the poster for full page loads; a client-side navigation into the city needs the same
  // choice before its first paint (and dev Strict Mode resets <html> attributes on remount).
  useLayoutEffect(() => {
    if (kind === "city") document.documentElement.setAttribute(cityLightAttribute, cityLight());
  }, [kind]);

  useEffect(() => {
    const stored = readTimeMode();
    timeModeRef.current = stored;
    setTimeMode(stored);
  }, []);

  useEffect(() => {
    timeModeRef.current = timeMode;
    world.current?.setTimeMode(timeMode);
  }, [timeMode]);

  // Calm mode: while a dialog or an assignment station panel is open, the world quiets down behind it.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const calm = !!document.querySelector("dialog[open]") || (kind === "mission" && panelOpen);
      calmRef.current = calm;
      world.current?.setCalm(calm);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(queue);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [kind, panelOpen, state]);

  // Feed the soundscape and the time button from the scene's light.
  useEffect(() => {
    if (state !== "ready") return;
    const poll = () => {
      const current = world.current?.ambience();
      if (!current) return;
      soundscape.setMix({ scene: kind, district: current.district, night: current.night, calm: current.calm });
      setAmbience((previous) => previous && previous.label === current.label && previous.mode === current.mode &&
        Math.abs(previous.night - current.night) < .05 ? previous : current);
    };
    poll();
    const timer = window.setInterval(poll, 1200);
    return () => window.clearInterval(timer);
  }, [state, kind, timeMode, district]);

  useEffect(() => {
    hoursRef.current = staffHours;
    world.current?.setWorkload(staffHours);
  }, [staffHours]);

  useEffect(() => {
    shiftRef.current = reaction;
    world.current?.setRoomReaction(reaction);
  }, [reaction]);

  useEffect(() => {
    const previous = outcomesRef.current;
    outcomesRef.current = stationOutcomes;
    for (const id of Object.keys(previous ?? {})) if (!stationOutcomes || !(id in stationOutcomes)) world.current?.setStationOutcome(id, null);
    for (const [id, outcome] of Object.entries(stationOutcomes ?? {})) world.current?.setStationOutcome(id, outcome);
  }, [stationOutcomes]);

  useEffect(() => {
    completionRef.current = assignmentComplete;
    world.current?.setAssignmentComplete(assignmentComplete);
  }, [assignmentComplete]);

  useEffect(() => {
    replayRef.current = roomReplay;
    world.current?.setMissionReplay(roomReplay?.replay ?? null, roomReplay?.preview);
  }, [roomReplay]);

  useEffect(() => {
    const container = host.current;
    let disposed = false;
    const startedAt = performance.now();
    const surface = kind === "mission" ? "room" : kind === "depot" ? "dispatch" : "city";
    let reportedReady = false;

    function report(available: boolean) {
      if (disposed) return;
      setState(available ? "ready" : "unavailable");
      if (healthUser.current && (!reportedReady || !available)) {
        void recordClientHealth(healthUser.current, available ? "scene-ready" : "scene-fallback", surface,
          reportedReady ? undefined : performance.now() - startedAt);
      }
      if (available) reportedReady = true;
    }

    async function start() {
      try {
        const { mountWorld } = await import("../lib/scene/renderer");
        if (!container || disposed) return;
        world.current = mountWorld(container, kind, districtRef.current, () => elements.current, (id, action) => {
          if (!elements.current.has(id)) return;
          soundscape.tick(action === "talk" ? 1.2 : 1);
          if (action === "talk" && talkCallback.current) talkCallback.current(id as T);
          else selectCallback.current(id as T);
        }, report, missionRoom, () => report(true));
        world.current.select(selection.current);
        world.current.setTimeMode(timeModeRef.current);
        if (progressRef.current) world.current.setProgress(progressRef.current);
        world.current.setCalm(calmRef.current);
        world.current.setWorkload(hoursRef.current);
        world.current.setRoomReaction(shiftRef.current);
        for (const [id, outcome] of Object.entries(outcomesRef.current ?? {})) world.current.setStationOutcome(id, outcome);
        world.current.setAssignmentComplete(completionRef.current);
        if (replayRef.current) world.current.setMissionReplay(replayRef.current.replay, replayRef.current.preview);
        // "ready" waits for the scene's first finished frame (see mountWorld), so the loading poster crossfades into a
        // drawn city instead of cutting to an empty canvas.
      } catch (error) {
        console.error("Unable to start the CertCity 3D scene.", error);
        report(false);
      }
    }

    void start();
    return () => {
      disposed = true;
      world.current?.dispose();
      world.current = null;
    };
  }, [kind, missionRoom?.kind, missionRoom?.room, missionRoom?.missionId, missionRoom?.workId, missionRoom?.surface]);

  return (
    <section className="world-scene" aria-label={description} data-scene={kind} data-world-state={state} data-station-open={kind === "mission" && panelOpen || undefined}>
      <div className="world-renderer" ref={host} />
      {state !== "ready" && (
        <p className="world-message" role="status">
          {state === "loading" ? kind === "mission" ? `Opening ${missionRoom?.room ?? "the assignment"}…` : "Opening the neighborhood…"
            : kind === "mission" ? "Use the buttons below to talk to people, read the mission file or open the work station."
              : "The 3D view is unavailable. Use Places or Stations to continue."}
        </p>
      )}
      <div className="world-markers" data-ready={state === "ready"}>
        {markers.map(({ id, name, icon: Icon, color, assignment, district: home }) => (
          <button
            key={id}
            className="map-marker"
            ref={(element) => {
              if (element) elements.current.set(id, element);
              else elements.current.delete(id);
            }}
            data-color={color}
            data-nearby={!home || home === district}
            data-assignment={assignment || undefined}
            type="button"
            aria-label={assignment && assignmentStatuses?.[id] ? `${name}, ${assignmentStatuses[id]!.toLowerCase()}` : name}
            data-complete={assignmentStatuses?.[id] === "Mission done" || assignmentStatuses?.[id] === "Shift saved" || undefined}
            aria-pressed={selected === id}
            onClick={() => {
              soundscape.tick();
              world.current?.select(id, true);
              onSelect(id);
            }}
          >
            <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
            <span>{name}</span>
          </button>
        ))}
        {conversationMarker && <button
          className="map-marker conversation-marker"
          type="button"
          aria-label={conversationMarker.label}
          ref={setConversationMarker}
          onClick={() => onTalk?.(conversationMarker.id)}
        >
          <MessageCircle size={14} strokeWidth={2.25} aria-hidden="true" />
          <span>{conversationMarker.name}</span>
        </button>}
      </div>
      {state === "ready" && kind !== "mission" && (
        <div className="camera-hud">
          <span className="camera-hint">
            <span className="camera-hint-mouse">Drag to move · Scroll to zoom</span>
            <span className="camera-hint-touch">Drag to move · Pinch to zoom</span>
          </span>
          <div className="zoom-tools" role="group" aria-label="Camera controls">
            <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => world.current?.zoom(1 / 1.24)}>
              <Minus size={17} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => world.current?.zoom(1.24)}>
              <Plus size={17} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Rotate camera" title="Rotate camera" onClick={() => world.current?.rotate()}>
              <RotateCw size={16} aria-hidden="true" />
            </button>
            {kind === "city" && district === "downtown" && (
              <button type="button" aria-label="Focus on Olive Street" title="Olive Street close-up" onClick={() => world.current?.focusOliveStreet()}>
                <Camera size={17} aria-hidden="true" />
              </button>
            )}
            <button type="button" aria-label="Reset camera" title="Reset camera" onClick={() => world.current?.reset()}>
              <Crosshair size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="zoom-tools" role="group" aria-label="Atmosphere">
            {kind === "city" && <TimeOfDayButton mode={timeMode} label={ambience?.label ?? "Day"} onChange={setTimeMode} />}
            <SoundButton />
          </div>
        </div>
      )}
    </section>
  );
}
