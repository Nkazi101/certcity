"use client";

import { Camera, Crosshair, MessageCircle, Minus, Plus, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MissionRoomReplay, SceneKind, WorldControls } from "../lib/scene/renderer";
import { defaultDistrict } from "../lib/scene/districts";
import type { DistrictId } from "../lib/scene/districts";
import type { MissionRoom } from "../lib/scene/mission-interior";
import { recordClientHealth } from "../lib/client-health";
import { useAccount } from "./account";

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
  assignmentComplete?: boolean;
  roomReplay?: { replay: MissionRoomReplay; preview: HTMLCanvasElement | null } | null;
  description: string;
  markers: readonly Marker<T>[];
  selected: T | null;
  onSelect: (id: T) => void;
  onTalk?: (id: T) => void;
  conversationMarker?: { id: T; name: string; label: string };
  assignmentStatuses?: Partial<Record<T, string>>;
};

export function WorldScene<T extends string>({
  kind, missionRoom, district = defaultDistrict, districtVisit = 0, panelOpen = false, staffHours = 16, assignmentComplete = false, roomReplay, description, markers, selected, onSelect, onTalk, conversationMarker, assignmentStatuses,
}: SceneProps<T>) {
  const { user } = useAccount();
  const host = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<string, HTMLButtonElement>());
  const world = useRef<WorldControls>(null);
  const selection = useRef(selected);
  const districtRef = useRef(district);
  const districtVisitRef = useRef(districtVisit);
  const hoursRef = useRef(staffHours);
  const completionRef = useRef(assignmentComplete);
  const replayRef = useRef(roomReplay);
  const selectCallback = useRef(onSelect);
  const talkCallback = useRef(onTalk);
  const healthUser = useRef(user?.id);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
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
    hoursRef.current = staffHours;
    world.current?.setWorkload(staffHours);
  }, [staffHours]);

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
          if (action === "talk" && talkCallback.current) talkCallback.current(id as T);
          else selectCallback.current(id as T);
        }, report, missionRoom);
        world.current.select(selection.current);
        world.current.setWorkload(hoursRef.current);
        world.current.setAssignmentComplete(completionRef.current);
        if (replayRef.current) world.current.setMissionReplay(replayRef.current.replay, replayRef.current.preview);
        report(true);
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
            : kind === "mission" ? "Use the station buttons below to open this assignment."
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
            data-complete={assignmentStatuses?.[id] === "Assignment complete" || assignmentStatuses?.[id] === "Shift saved" || undefined}
            aria-pressed={selected === id}
            onClick={() => {
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
        </div>
      )}
    </section>
  );
}
