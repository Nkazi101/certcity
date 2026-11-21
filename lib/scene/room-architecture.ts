import * as THREE from "three";
import type { RoomKind } from "../claude/mission-experiences";
import type { ModelKit } from "./model-kit";

export type RoomPalette = { wall: string; trim: string; floor: string; wood: string; accent: string; metal: string };

type RoomFinish = {
  ground: string;
  sky: string;
  glass: string;
  shade: string;
  windows: "tall" | "clerestory" | "partition" | "shopfront";
  floor: "wood" | "tiles" | "concrete";
  threshold: string;
};

const finishes: Record<RoomKind, RoomFinish> = {
  archive: { ground: "#b4ab94", sky: "#f4e3b7", glass: "#8eaeaa", shade: "#644735", windows: "tall", floor: "wood", threshold: "#526557" },
  printshop: { ground: "#a9aba3", sky: "#d8f1ea", glass: "#8ba8aa", shade: "#3c5556", windows: "clerestory", floor: "concrete", threshold: "#537571" },
  kitchen: { ground: "#8caa9d", sky: "#ecf5d8", glass: "#99b8ac", shade: "#3f7167", windows: "clerestory", floor: "tiles", threshold: "#54786b" },
  community: { ground: "#adb99d", sky: "#fcf3ca", glass: "#a2b6a0", shade: "#546b54", windows: "shopfront", floor: "wood", threshold: "#698361" },
  office: { ground: "#849ca3", sky: "#cce0f3", glass: "#6e94ad", shade: "#384c61", windows: "partition", floor: "concrete", threshold: "#3d6374" },
  workshop: { ground: "#a9a094", sky: "#eeedce", glass: "#879d94", shade: "#574b3e", windows: "clerestory", floor: "concrete", threshold: "#597367" },
  market: { ground: "#b9a989", sky: "#fff1ba", glass: "#91ad96", shade: "#814b36", windows: "tall", floor: "tiles", threshold: "#875d43" },
  school: { ground: "#9faeb4", sky: "#ffedbf", glass: "#94bab9", shade: "#526478", windows: "shopfront", floor: "tiles", threshold: "#4d7083" },
  courthouse: { ground: "#a9a3a0", sky: "#f5e8ce", glass: "#92a6a8", shade: "#585460", windows: "tall", floor: "tiles", threshold: "#716674" },
  dispatch: { ground: "#a6a484", sky: "#ffe3bb", glass: "#7faaa2", shade: "#69513c", windows: "clerestory", floor: "concrete", threshold: "#51796c" },
};

export function roomAtmosphere(kind: RoomKind) {
  const { ground, sky, shade } = finishes[kind];
  return { ground, sky, shade };
}

function glazing(kit: ModelKit, room: THREE.Group, x: number, y: number, width: number, height: number, finish: RoomFinish, mullions: number) {
  const oak = kit.material("#efe4c9");
  const frame = kit.material(finish.shade);
  kit.box(room, [x, y, -5.04], [width + .19, height + .18, .15], oak, true);
  kit.box(room, [x, y, -4.95], [width, height, .047], kit.material(finish.glass));
  kit.box(room, [x, y + height * .19, -4.919], [width - .12, height * .54, .012], kit.material(finish.sky));
  kit.box(room, [x, y - height * .48, -4.895], [width + .22, .12, .23], oak, true);
  kit.box(room, [x, y + height * .06, -4.9], [width, .039, .04], frame);
  for (let n = 1; n < mullions; n++) {
    kit.box(room, [x + width * (n / mullions - .5), y, -4.898], [.049, height, .036], frame);
  }
}

function floor(kit: ModelKit, room: THREE.Group, palette: RoomPalette, finish: RoomFinish) {
  const grout = new THREE.Color(palette.floor).lerp(new THREE.Color(finish.threshold), .54);
  kit.ground(room, 0, 0, 15.76, 10.62, kit.material(finish.floor === "tiles" ? "#" + grout.getHexString() : palette.floor, "stone"), .29);
  if (finish.floor === "wood") {
    const planks = ["#aa7f59", "#b48a62", "#c29a6c", "#ba9064", "#a77f5c", "#c29a70"];
    for (let row = 0; row < 19; row++) {
      for (let column = 0; column < 4; column++) {
        const start = Math.max(-7.84, -8.82 + column * 4.25 + (row % 2) * 1.3);
        const end = Math.min(7.84, -4.61 + column * 4.25 + (row % 2) * 1.3);
        kit.ground(room, (start + end) / 2, -5.02 + row * .55, end - start, .516,
          kit.material(planks[(column * 3 + row) % planks.length], "stone"), .296);
      }
    }
  } else if (finish.floor === "tiles") {
    const dark = kit.material(finish.threshold, "stone");
    const pale = kit.material(palette.floor, "stone");
    const shaded = kit.material("#" + new THREE.Color(palette.floor).lerp(grout, .54).getHexString(), "stone");
    for (let row = 0; row < 13; row++) {
      for (let column = 0; column < 19; column++) {
        const border = row === 0 || row === 12 || column === 0 || column === 18;
        kit.ground(room, -7.44 + column * .825, -4.94 + row * .82, .774, .772, border ? dark : (row + column) % 2 ? shaded : pale, .298);
      }
    }
  } else {
    const seam = kit.material(palette.trim);
    for (const z of [-3.45, -.30, 2.72]) kit.ground(room, 0, z, 15.4, .025, seam, .298);
    for (const x of [-4.65, .0, 4.68]) kit.ground(room, x, 0, .028, 10.32, seam, .298);
  }
}

export function roomArchitecture(kit: ModelKit, room: THREE.Group, kind: RoomKind, palette: RoomPalette) {
  const finish = finishes[kind];
  const lower = kit.material(finish.shade);
  const frame = kit.material(finish.threshold);
  const sill = kit.material("#ead5ac");
  kit.box(room, [0, .125, 0], [16, .32, 10.94], lower, true);
  kit.box(room, [0, .236, 0], [16.03, .097, 10.96], frame, true);
  floor(kit, room, palette, finish);
  const wall = kit.material(palette.wall, finish.windows === "partition" || kind === "school" ? "stone" : "brick");
  kit.box(room, [0, 2.16, -5.23], [15.82, 4.24, .31], wall);
  kit.box(room, [-7.76, 2.16, -1.15], [.31, 4.24, 8.05], wall);
  kit.box(room, [0, 4.29, -5.18], [16.04, .19, .44], frame, true);
  kit.box(room, [-7.76, 4.29, -1.15], [.44, .19, 8.06], frame, true);
  kit.box(room, [0, .64, -5.02], [15.85, .70, .12], lower);
  kit.box(room, [-7.56, .64, -1.15], [.12, .70, 8.08], lower);
  kit.box(room, [0, 1.01, -4.94], [15.9, .084, .1], sill, true);
  kit.box(room, [-7.5, 1.01, -1.15], [.12, .084, 8.08], sill, true);
  for (const x of [-7.48, -5.88, -2.88, 2.87, 5.88, 7.48]) {
    kit.box(room, [x, 2.11, -4.98], [.116, 3.76, .13], frame, true);
  }
  if (finish.windows === "tall") {
    for (const x of [-5.08, -3.68, 3.68, 5.08]) glazing(kit, room, x, 2.64, 1.16, 2.14, finish, 2);
  } else if (finish.windows === "clerestory") {
    for (const x of [-5.66, -3.54, -1.18, 1.18, 3.54, 5.66]) glazing(kit, room, x, 3.46, 1.8, .72, finish, 2);
  } else {
    for (const x of [-4.28, 4.28]) glazing(kit, room, x, 2.65, 2.58, finish.windows === "partition" ? 1.72 : 1.95, finish, 4);
  }
  // The platform extends through the entrance. Timber or enamel trim carries the exterior doorway into the cutaway.
  const size = kind === "kitchen" || kind === "dispatch" ? 2.05 : 1.67;
  const doorZ = 3.73;
  kit.box(room, [-7.82, .21, doorZ], [1.15, .19, size + .42], sill, true);
  kit.box(room, [-8.47, .105, doorZ], [.52, .18, size + .46], lower, true);
  for (const side of [-1, 1]) kit.box(room, [-7.62, 1.64, doorZ + side * size / 2], [.22, 2.73, .21], frame, true);
  kit.box(room, [-7.62, 3.05, doorZ], [.23, .22, size + .2], frame, true);
  const door = kit.group(room, [-7.6, .32, doorZ - size / 2], -.36);
  kit.box(door, [.48, 1.27, -.023], [.98, 2.51, .112], frame, true);
  kit.box(door, [.49, 1.74, .045], [.72, .93, .045], kit.material(finish.glass), true);
  kit.box(door, [.89, 1.18, .08], [.056, .26, .055], sill, true);
  kit.ground(room, -6.81, doorZ, 1.24, size - .15, kit.material(finish.shade, "stone"), .308);
}
