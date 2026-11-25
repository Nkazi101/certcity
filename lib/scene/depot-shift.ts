import type * as THREE from "three";
import type { ModelKit } from "./model-kit";
import { buildRoomReactions } from "./room-reactions";
import type { ReactionLayout, RoomReaction } from "./room-reactions";

/** What the daily shift asks the depot to show. Kept as a name for older imports; see RoomReaction. */
export type ShiftScene = RoomReaction;

// Floor positions inside the depot cutaway (room space, y = floor). The support counter spans x -6.2…-2.8 at
// z .66…1.72, and the camera looks from +x/+z, so customers line up in the open aisle beside the counter's east end:
// the front customer stands at that end, the rest queue behind them toward the back wall where nothing hides them.
const aisle = -2.32;
const lane = -1.45;
export const depotReactionLayout: ReactionLayout = {
  floor: .31,
  slots: [[aisle, 1.12], [aisle, .34], [aisle, -.44], [aisle, -1.22], [aisle, -2], [aisle, -2.78], [aisle, -3.36]],
  deskFacing: -Math.PI / 2,
  entrance: [lane, 7.6],
  arrival: [[lane, 2.05]],
  exit: [[lane, 1.75], [lane, 3.2], [lane - .15, 7.9]],
  toBench: [[lane, 1.75], [lane, 3.3]],
  benchExit: [[-2.45, 3.9], [-2.55, 7.9]],
  benchSpots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => [-1.95 + (index % 5) * .6, 3.84 - Math.floor(index / 5) * .55] as const),
  benchFacing: Math.PI,
  bench: { x: -.75, z: 4.36, rotation: 0, width: 2.7 },
  post: { x: .8, z: 4.41, rotation: 0, text: "CALLBACKS" },
  // Phones: the counter's east end and the line, with the bench at the bottom of the strip.
  focus: [-2.1, .6],
};

/** A callback bench, a customer line at the support counter, and badges that make routing outcomes visible. */
export function buildShiftActors(kit: ModelKit, scene: THREE.Scene, room: THREE.Group) {
  return buildRoomReactions(kit, scene, room, depotReactionLayout);
}
