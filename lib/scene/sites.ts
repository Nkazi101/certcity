import * as THREE from "three";

export type Landmark = {
  id: string;
  anchor: THREE.Vector3;
  bounds: THREE.Box3;
  streetAnchor?: THREE.Vector3;
  entranceFacing?: 1 | -1;
  surface?: THREE.Mesh;
};

export type SceneLink = { href: string; surface: THREE.Mesh };
export type SceneConversation = { id: string; bounds: THREE.Box3; anchor: THREE.Vector3 };

type ReplayState = { result: "pass" | "review"; token: number; stage?: "sample" | "new-case" };
export type MissionRoomReplay = ReplayState & (
  | { kind: "bulletin"; destination?: "approval" | "public" | "vendor" }
  | { kind: "receiving"; disposition?: "held" | "posted" | "unresolved" }
  | { kind: "operations"; staffed?: boolean; minutes?: number }
);

export type Environment = {
  landmarks: Landmark[];
  links?: SceneLink[];
  conversations?: SceneConversation[];
  update: (time: number) => void;
  dispose?: () => void;
  focusDistrict?: (id: import("./districts").DistrictId) => void;
  cameraNear?: (x: number, z: number) => void;
  setWorkload?: (staffHours: number) => void;
  /** Rooms with a waiting line and callback bench (lib/scene/room-reactions.ts). */
  setRoomReaction?: (state: import("./room-reactions").RoomReaction | null, immediate: boolean) => void;
  /** Show a ✓ / "!" over a station or the person working it; returns false for an unknown station. */
  setStationOutcome?: (stationId: string, outcome: import("./room-reactions").StationOutcome) => boolean;
  /** Where to point the camera on phones while a room reaction is framed. */
  reactionFocus?: THREE.Vector3;
  setAssignmentComplete?: (complete: boolean) => void;
  setMissionReplay?: (replay: MissionRoomReplay | null, immediate: boolean) => void;
};

export function landmark(id: string, x: number, z: number, width: number, depth: number, height: number): Landmark {
  return {
    id,
    anchor: new THREE.Vector3(x, height + .22, z),
    bounds: new THREE.Box3(
      new THREE.Vector3(x - width / 2, 0, z - depth / 2),
      new THREE.Vector3(x + width / 2, height + .1, z + depth / 2),
    ),
  };
}
