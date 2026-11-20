import * as THREE from "three";
import type { Tree } from "./st-louis-ground";
import { followRoute, makePerson, makeVehicle, rollingHubs } from "./actors";
import { ModelKit, seededRandom } from "./model-kit";
import { landmark } from "./sites";
import { loadOliveCorner } from "./olive-corner";
import type { ModelState } from "./gltf";
import type { Environment } from "./sites";
import { oliveStreetLife } from "./olive-street-life";
import { oliveBakery, oliveTilework } from "./city-vignettes";
import { plazaVisitors } from "./park-visitors";
import { gardenBorder, parkBench, waterRipples } from "./park-details";

import { downtownStreets, followRoad, locustCenter, streetlamp } from "./streets";

type Face = { x: number; z: number; turn: number; length: number; bays: number; rear?: boolean };

function parkPacific(kit: ModelKit, parent: THREE.Group) {
  const x = 51.12, z = -10.25;
  const tower = kit.group(parent, [x, .08, z]);
  const terraCotta = kit.material("#e8e3d4", "stone");
  const trim = kit.material("#f3ece0");
  const warmStone = kit.material("#bdad95");
  const roof = kit.material("#c8c3b2", "pavers");
  const blondBrick = kit.material("#c2a984", "brick");
  const granite = kit.material("#73777c", "stone");
  const dark = kit.material("#37565b");
  const glazing = ["#507579", "#66878b", "#6c9297", "#8d9d93", "#b49160"].map((color) => kit.material(color));
  const rand = seededRandom(13013);
  const story = .705;
  const podium = 1.85;

  function facade(face: Face, first: number, floors: number) {
    const wall = kit.group(tower, [face.x, 0, face.z], face.turn);
    const pitch = face.length / face.bays;
    const foot = podium + first * story;
    const top = foot + floors * story;
    for (let bay = 0; bay <= face.bays; bay++) {
      const u = (bay - face.bays / 2) * pitch;
      kit.box(wall, [u, (foot + top) / 2, .03], [.113, top - foot, .137], face.rear ? blondBrick : trim);
      if (face.rear) continue;
      kit.box(wall, [u, top + .075, .035], [.18, .28, .21], trim);
      kit.box(wall, [u, top + .244, .041], [.116, .15, .139], trim);
      kit.box(wall, [u + pitch * .48, top + .037, .023], [pitch * .66, .13, .11], warmStone);
    }
    for (let floor = 0; floor < floors; floor++) {
      const y = foot + (floor + .51) * story;
      for (let bay = 0; bay < face.bays; bay++) {
        const u = (bay + .5 - face.bays / 2) * pitch;
        const pair = pitch * .72;
        const opening = kit.box(wall, [u, y, .027], [pair, .406, .055], dark);
        opening.castShadow = false;
        for (const offset of [-pair * .25, pair * .25]) {
          const window = kit.box(wall, [u + offset, y + .014, .057], [pair * .407, .344, .028], glazing[Math.floor(rand() * glazing.length * .955)]);
          window.castShadow = false;
        }
        kit.box(wall, [u, y + .005, .076], [.062, .434, .042], face.rear ? blondBrick : terraCotta);
        kit.box(wall, [u, y - .23, .066], [pair + .039, .046, .116], warmStone);
      }
    }
  }

  function tier(first: number, floors: number, outer: [number, number, number, number], notch: [number, number, number], rear: boolean) {
    const [left, right, north, south] = outer;
    const [innerX, innerNorth, innerSouth] = notch;
    const bottom = podium + first * story;
    const height = floors * story;
    for (const [a, b, c, d] of [
      [innerX, right, north, south],
      [left, innerX, north, innerNorth],
      [left, innerX, innerSouth, south],
    ]) {
      kit.box(tower, [(a + b) / 2, bottom + height / 2, (c + d) / 2], [b - a, height, d - c], terraCotta);
      kit.box(tower, [(a + b) / 2, bottom + height + .014, (c + d) / 2], [b - a, .057, d - c], roof);
    }
    const alongX = (a: number, b: number, at: number, sign: number, bays: number) =>
      facade({ x: (a + b) / 2, z: at, turn: sign > 0 ? 0 : Math.PI, length: b - a, bays }, first, floors);
    const alongZ = (a: number, b: number, at: number, sign: number, bays: number, unadorned = false) =>
      facade({ x: at, z: (a + b) / 2, turn: sign * Math.PI / 2, length: b - a, bays, rear: unadorned }, first, floors);
    alongX(left, right, north, -1, rear ? 8 : 6);
    alongX(left, right, south, 1, rear ? 8 : 6);
    alongX(left, innerX, innerNorth, 1, 3);
    alongX(left, innerX, innerSouth, -1, 3);
    kit.box(tower, [right + .003, bottom + height / 2, (north + south) / 2],
      [.012, height, south - north], blondBrick);
    alongZ(north, south, right + .015, 1, 9, true);
    alongZ(north, innerNorth, left, -1, 3);
    alongZ(innerSouth, south, left, -1, 3);
    alongZ(innerNorth, innerSouth, innerX, -1, 4);
  }

  kit.contactShadow(tower, .12, .09, 14.9, 15.4, .027);
  kit.box(tower, [0, .19, 0], [11.8, .36, 13.0], granite);
  kit.box(tower, [0, 1.073, 0], [11.62, 1.53, 12.82], terraCotta);
  kit.box(tower, [0, 1.817, 0], [11.83, .14, 13.03], trim);
  tier(0, 10, [-4.64, 5.79, -6.38, 6.38], [-.93, -2.25, 2.25], true);
  tier(10, 6, [-4.64, 3.59, -5.72, 5.72], [-.93, -2.25, 2.25], false);
  tier(16, 4, [-3.45, 2.98, -4.57, 4.57], [-.39, -2.17, 2.17], false);
  const roofY = podium + 20 * story;
  kit.box(tower, [1.65, roofY + .21, -.89], [1.56, .42, 1.91], warmStone);
  kit.box(tower, [1.65, roofY + .47, -.89], [1.71, .14, 2.06], trim);
  kit.cylinder(tower, [.66, roofY + .39, -3.29], .21, .82, granite);
  kit.box(tower, [3.99, 9.12, 3.66], [1.53, .44, 1.43], roof, true);

  for (const [turn, distance, length, count] of [
    [-Math.PI / 2, 5.82, 12.82, 11],
    [0, 6.43, 11.64, 9],
    [Math.PI, 6.43, 11.64, 9],
  ] as const) {
    const face = kit.group(tower, [Math.sin(turn) * distance, 0, Math.cos(turn) * distance], turn);
    const pitch = length / count;
    for (let bay = 0; bay < count; bay++) {
      const u = (bay + .5 - count / 2) * pitch;
      kit.box(face, [u, .53, .05], [pitch * .78, .77, .13], granite);
      kit.box(face, [u, .58, .126], [pitch * .67, .64, .047], glazing[(bay + 1) % 4]);
      kit.box(face, [u, 1.415, .077], [pitch * .72, .49, .08], dark);
      kit.box(face, [u, 1.43, .126], [pitch * .63, .414, .043], glazing[(bay + 2) % 4]);
      kit.box(face, [u - pitch / 2, 1.02, .06], [.14, 1.6, .176], trim);
    }
  }

  const portal = kit.group(tower, [-5.93, 0, 0], -Math.PI / 2);
  kit.box(portal, [0, .75, .041], [1.48, 1.51, .1], granite);
  kit.box(portal, [0, .546, .11], [1.02, 1.07, .092], dark);
  for (const s of [-1, 1]) {
    kit.box(portal, [s * .655, .7, .146], [.21, 1.38, .29], warmStone, true);
    kit.box(portal, [s * .248, .54, .17], [.39, .925, .036], glazing[1]);
    kit.sphere(portal, [s * .44, 1.63, .2], [.17, .45, .13], warmStone);
  }
  const arch = kit.cylinder(portal, [0, 1.6, .104], 1.25, .12, trim);
  arch.rotation.x = Math.PI / 2;
  kit.box(portal, [0, 1.61, .188], [.42, .34, .16], warmStone, true);
  const relief = kit.cylinder(portal, [0, 1.62, .28], .24, .081, trim);
  relief.rotation.x = Math.PI / 2;
  kit.box(portal, [0, 2.26, .17], [.52, .13, .21], warmStone, true);
  kit.sphere(portal, [0, 2.34, .191], [.73, .17, .24], trim);
  kit.sign(portal, "MISSOURI PACIFIC", [0, 1.175, .206], 1.01, ["#70736e", "#f3d8a5"]);
  const oliveEntry = kit.group(tower, [2.13, 0, 6.51]);
  kit.box(oliveEntry, [0, .62, .05], [1.51, 1.23, .16], granite);
  kit.box(oliveEntry, [0, .58, .149], [1.15, 1.04, .049], dark);
  kit.box(oliveEntry, [0, .66, .185], [.98, .82, .035], glazing[2]);
  kit.sign(oliveEntry, "PARK PACIFIC", [0, 1.293, .177], 1.31, ["#48645d", "#ffebc7"]);

  const annex = kit.group(parent, [60.02, .08, -9.66]);
  kit.box(annex, [0, 2.63, 0], [5.93, 5.25, 11.89], kit.material("#c1bdb0", "stone"));
  kit.box(annex, [0, 5.25, 0], [6.03, .2, 11.97], kit.material("#d9d1be", "stone"));
  kit.box(annex, [0, .62, 5.958], [5.86, 1.24, .09], dark);
  for (let bay = 0; bay < 7; bay++) {
    const localX = (bay - 3) * .8;
    for (let floor = 0; floor < 5; floor++) {
      kit.box(annex, [localX, 1.68 + floor * .7, 5.964], [.38, .27, .067], dark).castShadow = false;
    }
    kit.box(annex, [localX, .66, 6.015], [.67, .94, .07], glazing[(bay + 1) % 4]);
  }

}

type BuildingStyle = "warehouse" | "commercial" | "glass" | "storefront";

type Block = {
  x: number;
  z: number;
  w: number;
  d: number;
  floors: number;
  color: string;
  style: BuildingStyle;
  name?: string;
  accent?: string;
  background?: boolean;
};

function block(kit: ModelKit, parent: THREE.Group, { x, z, w, d, floors, color, style, name, accent, background = false }: Block) {
  const building = kit.group(parent, [x, .08, z]);
  const stone = kit.material(style === "glass" ? "#acc3be" : background ? "#c3ab8c" : "#e4c7a1");
  const ledge = kit.material(style === "glass" ? "#78969b" : background ? "#b9a284" : "#e6c79c");
  const roof = kit.material(style === "glass" ? "#678a8b" : "#a38f7b", "pavers");
  const wall = kit.material(color, style === "glass" ? undefined : style === "commercial" ? "stone" : "brick");
  const windowColors = (background ? ["#506b69", "#6b8380", "#83928b", "#a68b69"]
    : ["#41656e", "#719497", "#9caaa2", "#b78e58"]).map((tint) => kit.material(tint));
  const rand = seededRandom(Math.floor(x * 521 + z * 73));
  const story = style === "glass" ? .99 : .95;
  const base = style === "storefront" ? 1.32 : 1.65;
  const top = base + floors * story;
  kit.contactShadow(building, .14, .16, w + 1.74, d + 1.68, .007);
  kit.box(building, [0, top / 2, 0], [w, top, d], wall);
  kit.box(building, [0, top + .009, 0], [w - .17, .04, d - .17], roof);
  kit.box(building, [0, base - .015, 0], [w + .18, .14, d + .18], ledge);
  for (const side of [-1, 1]) {
    kit.box(building, [0, top + .17, side * d / 2], [w + .25, .33, .17], stone);
    kit.box(building, [side * w / 2, top + .17, 0], [.16, .33, d + .13], stone);
  }
  if (style === "warehouse" || style === "commercial") {
    kit.box(building, [0, top - .03, 0], [w + .36, .14, d + .33], ledge);
    for (let m = -w / 2 + .36; m < w / 2 - .12 && !background; m += .57) {
      kit.box(building, [m, top - .158, d / 2 + .105], [.148, .24, .24], ledge);
    }
  }

  for (const [angle, length, depth] of [
    [0, w, d], [Math.PI, w, d], [Math.PI / 2, d, w], [-Math.PI / 2, d, w],
  ]) {
    const face = kit.group(building, [Math.sin(angle) * depth / 2, 0, Math.cos(angle) * depth / 2], angle);
    const bays = Math.floor(length / (style === "glass" ? .91 : 1.13));
    const pitch = length / bays;
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay - (bays - 1) / 2) * pitch;
      if (style === "glass") {
        kit.box(face, [u + pitch * .5, top / 2, .07], [.053, top, .146], stone);
      }
      for (let floor = 0; floor < floors; floor++) {
        const y = base + (floor + .47) * story;
        const paneWidth = pitch * (style === "glass" ? .89 : .59);
        const paneHeight = story * (style === "glass" ? .81 : .66);
        kit.box(face, [u, y, .018], [paneWidth + .081, paneHeight + .075, .056], windowColors[0]).castShadow = false;
        kit.box(face, [u, y, .058], [paneWidth, paneHeight, .051], windowColors[Math.floor(rand() * 3.4)]).castShadow = false;
        if (!background || style === "glass") {
          kit.box(face, [u, y, .093], [paneWidth, .044, .032], style === "glass" ? stone : windowColors[0]).castShadow = false;
        }
        if (style !== "glass") {
          kit.box(face, [u, y - paneHeight / 2 - .045, .068], [paneWidth + .16, .079, .178], background ? ledge : stone).castShadow = !background;
          if (style === "warehouse") {
            const arch = kit.cylinder(face, [u, y + paneHeight * .39, .024], paneWidth + .14, .087, stone);
            arch.rotation.x = Math.PI / 2;
            arch.scale.z *= .48;
            const lintel = kit.box(face, [u, y + paneHeight * .37, .089], [paneWidth, .097, .048], windowColors[0]);
            lintel.castShadow = false;
          }
        }
      }
      const storefront = angle === 0 || angle === -Math.PI / 2;
      kit.box(face, [u, .66, .05], [pitch * .81, 1.11, .112], stone);
      kit.box(face, [u, .74, .118], [pitch * .69, .89, .057], windowColors[storefront ? 1 + (bay % 3) : 0]);
      if (!storefront) continue;
      kit.box(face, [u, .745, .156], [.047, .9, .059], windowColors[0]);
      kit.box(face, [u, .931, .159], [pitch * .66, .047, .056], windowColors[0]);
    }
  }
  if (name && accent) {
    const fabric = kit.material(accent);
    const shade = kit.group(building, [0, 1.29, d / 2 + .35]);
    shade.rotation.x = -.23;
    const awning = Math.min(w - .48, 4.0);
    kit.box(shade, [0, 0, 0], [awning, .086, .75], fabric, true);
    for (let i = -4; i <= 4; i += 2) {
      kit.box(shade, [i * awning / 9, .044, 0], [awning / 9, .032, .73], kit.material("#eadcba"));
    }
    kit.box(shade, [0, -.071, .35], [awning, .15, .064], fabric, true);
    kit.sign(building, name, [0, 1.76, d / 2 + .14], Math.min(w - .65, 3), [accent, "#fff1c5"]);
  }

  kit.box(building, [w * .22, top + .27, -d * .18], [w * .27, .52, d * .24], ledge, true);
  if (style !== "storefront" && (!background || floors % 2 === 0)) {
    const service = kit.group(building, [-w * .16, top, d * .19], Math.PI / 2);
    const steel = kit.material("#87949a");
    const flashing = kit.material("#566c70");
    kit.box(service, [0, .115, 0], [1.05, .21, .86], flashing, true);
    kit.box(service, [0, .29, 0], [.89, .22, .72], steel, true);
    for (let vent = -2; vent <= 2; vent++) kit.box(service, [vent * .146, .409, 0], [.039, .019, .58], flashing);
    if (floors % 3 === 0) {
      kit.box(building, [w * .16, top + .094, d * .19], [w * .29, .15, .92], flashing, true);
      for (let i = -1; i <= 1; i++) kit.box(building, [w * (.16 + i * .085), top + .184, d * .19],
        [w * .075, .035, .68], windowColors[1], true);
    }
  }
  if (style === "warehouse" && floors > 3 && (!background || floors === 5)) {
    const cx = -w * .24, cz = -d * .19;
    for (const a of [-.28, .28]) for (const b of [-.28, .28]) kit.box(building, [cx + a, top + .27, cz + b], [.069, .54, .069], windowColors[0]);
    kit.cylinder(building, [cx, top + .81, cz], .99, .58, kit.material("#927059", "brick"));
    kit.cylinder(building, [cx, top + 1.15, cz], 1.09, .15, windowColors[0], true);
  }
  return top + .42;
}

function locustOffices(kit: ModelKit, parent: THREE.Group) {
  const building = kit.group(parent, [49.26, .075, -28.72]);
  const limestone = kit.material("#d8c4a0", "stone");
  const trim = kit.material("#e6ce9e");
  const granite = kit.material("#8d8478", "stone");
  const roof = kit.material("#a39a82", "pavers");
  const glazing = kit.material("#567c84");
  const radius = 1.87;
  const cornerX = -1.91, cornerZ = .56;
  const height = 8.07;
  for (const [y, h, mat] of [[.19, .38, granite], [4.205, 7.65, limestone], [8.137, .225, trim]] as const) {
    kit.box(building, [.864, y, .025], [5.55, h, 4.81], mat);
    kit.box(building, [-2.835, y, -.92], [1.85, h, 2.93], mat);
    const arc = kit.geometry(new THREE.CylinderGeometry(radius, radius, h, 24, 1, false, -Math.PI / 2, Math.PI / 2));
    const curvedWall = new THREE.Mesh(arc, mat);
    curvedWall.position.set(cornerX, y, cornerZ);
    curvedWall.castShadow = curvedWall.receiveShadow = true;
    building.add(curvedWall);
  }
  kit.box(building, [.79, height + .21, -.061], [5.4, .12, 4.67], roof);
  const faces = [
    ...Array.from({ length: 6 }, (_, index) => {
      const angle = -Math.PI / 2 + (index + .5) * Math.PI / 12;
      return kit.group(building, [cornerX + Math.sin(angle) * radius, 0, cornerZ + Math.cos(angle) * radius], angle);
    }),
    ...[-1.39, -.7, -.01, .68, 1.37, 2.06, 2.75, 3.44].map((x) => kit.group(building, [x, 0, 2.438])),
    ...[-2.06, -1.44, -.82, -.2, .42].map((z) => kit.group(building, [-3.782, 0, z], -Math.PI / 2)),
  ];
  for (const [index, face] of faces.entries()) {
    const darkGlass = kit.material(index % 3 === 1 ? "#80a5a5" : "#426871");
    kit.box(face, [0, .82, .081], [.397, 1.34, .068], granite, true);
    kit.box(face, [0, .87, .135], [.284, 1.2, .055], glazing, true);
    kit.box(face, [.233, 4.51, .058], [.086, 7.07, .114], trim);
    for (let floor = 0; floor < 9; floor++) {
      const y = 1.854 + floor * .695;
      kit.box(face, [0, y, .046], [.353, .454, .047], darkGlass).castShadow = false;
      kit.box(face, [0, y - .229, .088], [.407, .045, .101], trim);
    }
  }
  kit.box(building, [.55, height + .39, -1.1], [1.7, .57, 1.34], limestone, true);
  kit.box(building, [.55, height + .72, -1.1], [1.87, .13, 1.5], trim, true);
  kit.sign(building, "LOCUST ST OFFICES", [1.04, 1.45, 2.518], 2.4, ["#9a8668", "#f9e5b7"]);
}

function flowerBox(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, width: number, seed: number) {
  kit.box(parent, [x, .23, z], [width, .31, .62], kit.material("#be9a74", "stone"), true);
  kit.box(parent, [x, .411, z], [width + .1, .09, .71], kit.material("#deba90"), true);
  const colors = ["#df655b", "#eab855", "#edb7b4", "#965789"];
  for (let i = 0; i < Math.floor(width / .25); i++) {
    const p = x - width / 2 + .19 + i * .25;
    kit.foliage(parent, [p, .53, z], [.39, .31, .43], i % 2 ? "#689547" : "#487d49");
    kit.sphere(parent, [p, .69, z + .06 * Math.sin(i)], [.15, .13, .15], kit.material(colors[(i + seed) % colors.length]));
  }
}

function streetBench(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, angle: number) {
  const bench = kit.group(parent, [x, .08, z], angle);
  const iron = kit.material("#405e55");
  for (const offset of [-.52, .52]) {
    kit.box(bench, [offset, .195, 0], [.096, .39, .42], iron);
    kit.box(bench, [offset, .43, -.19], [.096, .58, .088], iron);
  }
  const wood = kit.material("#b98150");
  for (let i = 0; i < 3; i++) kit.box(bench, [0, .42, i * .137 - .135], [1.49, .067, .096], wood, true);
  for (let i = 0; i < 2; i++) kit.box(bench, [0, .62 + i * .1, -.187], [1.49, .075, .064], wood, true);
}

function streetPatio(kit: ModelKit, parent: THREE.Group, x: number, z: number) {
  const patio = kit.group(parent, [x, .08, z]);
  const trim = kit.material("#4a654e");
  const teal = kit.material("#4f8e7b");
  const wood = kit.material("#c88f54");
  kit.ground(patio, 0, 0, 5.42, 3.47, kit.material("#d9a77f", "pavers"), .002);
  for (const [tableX, tableZ] of [[-1.53, .15], [1.49, -.27]]) {
    kit.cylinder(patio, [tableX, .33, tableZ], .08, .64, trim);
    kit.cylinder(patio, [tableX, .65, tableZ], .91, .09, wood);
    kit.cylinder(patio, [tableX, .87, tableZ], .047, 1.72, trim);
    kit.cylinder(patio, [tableX, 1.71, tableZ], 1.43, .23, teal, true);
    kit.cylinder(patio, [tableX, 1.86, tableZ], .14, .15, trim, true);
    for (const side of [-1, 1]) {
      const chair = kit.group(patio, [tableX + side * .65, 0, tableZ], side * Math.PI / 2);
      kit.box(chair, [0, .31, 0], [.35, .07, .32], teal, true);
      kit.box(chair, [0, .48, .14], [.33, .28, .064], teal, true);
      for (const cx of [-.13, .13]) for (const cz of [-.1, .1]) {
        kit.box(chair, [cx, .16, cz], [.039, .29, .039], trim);
      }
    }
  }
  flowerBox(kit, patio, 0, 1.4, 3.5, 3);
  streetlamp(kit, patio, -2.3, .96, Math.PI / 2);
}

function library(kit: ModelKit, parent: THREE.Group) {
  const x = 33.37, z = -9.1;
  const building = kit.group(parent, [x, .08, z]);
  const stone = kit.material("#d9c6a6", "stone");
  const trim = kit.material("#f0dbb8");
  const roof = kit.material("#84968c", "pavers");
  const deep = kit.material("#ac9373");
  kit.box(building, [0, .2, 0], [10.44, .4, 6.69], deep, true);
  kit.box(building, [0, 1.81, 0], [9.79, 3.28, 6.14], stone);
  kit.box(building, [0, 3.49, 0], [10.1, .2, 6.42], trim);
  kit.box(building, [0, 3.62, 0], [9.8, .14, 6.12], roof);
  kit.box(building, [0, 4, -.4], [5.24, .72, 4.12], stone);
  kit.box(building, [0, 4.44, -.4], [5.5, .21, 4.41], trim);
  kit.box(building, [0, 4.56, -.4], [5.32, .11, 4.19], roof);
  for (const side of [-1, 1]) {
    for (const localX of [2.79, 3.98]) kit.window(building, [side * localX, 1.84, 3.082], .68, 1.19);
    for (const localZ of [-1.92, -.62, .62, 1.92]) kit.window(building, [side * 4.911, 1.84, localZ], .69, 1.27, side * Math.PI / 2);
    for (const localX of [3.26, 4.3]) kit.box(building, [side * localX, 3.61, 3.145], [.16, .45, .3], deep, true);
  }
  for (let step = 0; step < 5; step++) kit.box(building, [0, .058 + step * .077, 4.26 - step * .18], [5.1, .11, .36], trim);
  kit.box(building, [0, 1.32, 3.13], [3.82, 1.83, .07], deep);
  for (const pos of [-1.24, 0, 1.24]) {
    kit.box(building, [pos, 1.26, 3.18], [.72, 1.49, .063], kit.material("#547675"), true);
    kit.box(building, [pos, 1.92, 3.222], [.71, .087, .049], trim);
  }
  for (const pos of [-2.11, -.73, .73, 2.11]) {
    kit.cylinder(building, [pos, 1.77, 3.68], .31, 2.65, trim, true);
    kit.box(building, [pos, .49, 3.68], [.44, .23, .44], trim, true);
    kit.box(building, [pos, 3.02, 3.68], [.45, .26, .43], trim, true);
  }
  kit.box(building, [0, 3.29, 3.55], [4.91, .38, 1.02], trim, true);
  kit.sign(building, "CENTRAL LIBRARY", [0, 3.3, 4.081], 1.47, ["#ccb291", "#5d4e40"]);
  flowerBox(kit, building, -3.8, 3.93, 1.85, 1);
  flowerBox(kit, building, 3.8, 3.93, 1.85, 2);
}

function olivePlaza(kit: ModelKit, parent: THREE.Group) {
  const x = 51.9, z = 11.0;
  const park = kit.group(parent, [x, .07, z]);
  const paving = kit.material("#d8b08c", "pavers");
  const stone = kit.material("#e4cb9e", "stone");
  const grass = kit.material("#87b348", "grass");
  kit.ground(park, 0, 0, 14.54, 12.93, paving, .006);
  for (const side of [-1, 1]) {
    kit.ground(park, side * 5.39, 0, 3.14, 11.05, grass, .016);
    kit.ground(park, side * 2.69, -4.14, 1.77, 2.96, grass, .016);
    kit.ground(park, side * 2.69, 4.29, 1.77, 2.67, grass, .016);
    for (const [index, localZ] of [-4.13, 0, 4.04].entries()) {
      kit.tree(park, side * (index === 1 ? 5.75 : 5.09), localZ, index === 1 ? 1.28 : 1.03,
        (side > 0 ? 17 : 9) + index * 3);
    }
    flowerBox(kit, park, side * 4.26, 1.7, 2.12, side + 1);
    streetBench(kit, park, side * 3.17, .45, side * Math.PI / 2);
    streetlamp(kit, park, side * 3.48, -5.79, side * Math.PI / 2);
    for (const localZ of [-2.66, 2.55, 4.32]) kit.shrub(park, side * 6.45, localZ, 1.36, true);
  }
  kit.box(park, [0, .155, .22], [4.58, .26, 3.31], stone, true);
  kit.box(park, [0, .288, .22], [4.29, .1, 3.05], kit.material("#527f81"), true);
  kit.box(park, [0, .353, .22], [4.09, .035, 2.84], kit.material("#65afaa"));
  kit.box(park, [0, .42, .22], [.67, .13, .62], stone, true);
  const sculpture = kit.group(park, [0, 0, .22], .38);
  for (const [xOff, y, tilt, shade] of [
    [-.53, .98, .87, "#397c72"],
    [.08, 1.36, -.3, "#53a088"],
    [.64, 1.03, -.83, "#7bab77"],
  ] as const) {
    const blade = kit.box(sculpture, [xOff, y, 0], [.33, 1.36, .18], kit.material(shade), true);
    blade.rotation.z = tilt;
  }
  for (const [dx, dz] of [[-1.35, .83], [.83, .7], [1.55, -.65], [-.62, -.92]]) {
    kit.cylinder(park, [dx, .389, .22 + dz], .34, .029, kit.material("#88c9b8"));
  }
}

export function addDowntown(kit: ModelKit, scene: THREE.Scene, onArtState: (state: ModelState) => void,
  models: Pick<ReturnType<typeof import("./st-louis").stLouisExpansion>, "invalidate" | "upgradeDowntownCar" | "upgradeDowntownVan" | "upgradeDowntownWalker" | "upgradeDowntownTrees">,
): Environment {
  const streets = new THREE.Group();
  const center = new THREE.Group();
  const surrounding = new THREE.Group();
  const actors = new THREE.Group();
  const cornerFallback = new THREE.Group();
  const peopleFallback = { sofia: new THREE.Group(), micah: new THREE.Group() };
  scene.add(streets, center, surrounding, actors, cornerFallback, peopleFallback.sofia, peopleFallback.micah);
  const streetTraffic = downtownStreets(kit, streets, actors);
  const sites = [
    landmark("park-pacific", 50.9, -10.25, 11.8, 13.12, 16.65),
    landmark("olive-library", 33.37, -11.05, 14.56, 16.35, 4.70),
    landmark("olive-plaza", 51.9, 11, 13.8, 12.9, 2.52),
    landmark("olive-cafe", 35.8, 11.95, 8.18, 6.8, 3.64),
  ];
  const placeholders = kit.group(scene, [0, 0, 0]);
  const masonry = kit.material("#d4bba6", "stone");
  const copper = kit.material("#788574");
  kit.box(placeholders, [51.12, 4.5, -10.25], [10.4, 9, 12.8], masonry);
  kit.box(placeholders, [50.72, 11.3, -10.25], [8.7, 4.6, 11.2], masonry);
  kit.box(placeholders, [50.3, 14.75, -10.1], [6.9, 2.9, 9.2], masonry);
  kit.box(placeholders, [33.37, 1.83, -11.05], [14.1, 3.5, 15.8], masonry);
  kit.box(placeholders, [33.37, 3.65, -11.05], [14.25, .22, 15.95], copper);
  kit.box(placeholders, [35.8, 1.58, 11.6], [7.9, 3, 6.1], kit.material("#b4604a", "brick"));
  kit.box(placeholders, [35.8, 3.2, 11.6], [8.05, .24, 6.25], copper);
  kit.ground(placeholders, 51.9, 11, 14.54, 12.93, kit.material("#d8b08c", "pavers"), .076);
  const cornerTrees: [number, number, number, number][] = [];
  const [pacificSite, librarySite, plazaSite, cafeSite] = sites;
  pacificSite.streetAnchor = new THREE.Vector3(51.24, 4.36, -3.7);
  librarySite.streetAnchor = new THREE.Vector3(33.58, 4.45, -6.4);
  plazaSite.streetAnchor = new THREE.Vector3(55.23, 1.7, 13.17);
  cafeSite.streetAnchor = new THREE.Vector3(36.86, 2.39, 15.09);
  pacificSite.entranceFacing = librarySite.entranceFacing = cafeSite.entranceFacing = 1;
  locustOffices(kit, center);
  const printworks = {
    x: 50.55, z: -35.15, w: 10.6, d: 7.7, floors: 5, color: "#ab6351",
    style: "warehouse", name: "PRINTWORKS", accent: "#68785b",
  } as const;
  const printworksHeight = block(kit, center, printworks);
  sites.push(landmark("washington-printworks", printworks.x, printworks.z, printworks.w + .23, printworks.d + .25, printworksHeight + .55));
  oliveBakery(kit, surrounding);
  const towers: Block[] = [
    { x: 31.6, z: -32.6, w: 8.4, d: 8.2, floors: 4, color: "#bf7c63", style: "warehouse", name: "PAPER GOODS", accent: "#568575" },
    { x: 38.5, z: -31.4, w: 4.48, d: 5.6, floors: 3, color: "#d29169", style: "warehouse" },
    { x: 58.5, z: -33.0, w: 4.97, d: 8.3, floors: 3, color: "#b5765d", style: "warehouse", name: "FLORIST", accent: "#795578" },
    { x: 52.9, z: -47.7, w: 13, d: 5.7, floors: 4, color: "#a6604f", style: "warehouse" },
    { x: 32.8, z: -47.4, w: 10.8, d: 5.5, floors: 5, color: "#ac6c59", style: "warehouse" },
    { x: 73.1, z: -31.8, w: 8.2, d: 8.1, floors: 5, color: "#b7795b", style: "warehouse" },
    { x: 81.2, z: -31.5, w: 5.26, d: 7.72, floors: 4, color: "#bb9a75", style: "commercial" },
    { x: 73.7, z: -12.4, w: 10.21, d: 12.27, floors: 8, color: "#bb9d76", style: "commercial", name: "UNION TRUST", accent: "#68705c" },
    { x: 81.3, z: -8.74, w: 4.76, d: 6.45, floors: 3, color: "#c97e5c", style: "storefront", name: "BIKE SHOP", accent: "#4d7970" },
    { x: 96.2, z: -11.31, w: 10.87, d: 11.9, floors: 10, color: "#689297", style: "glass" },
    { x: 95.0, z: -32.31, w: 10.21, d: 9.2, floors: 5, color: "#bd9172", style: "warehouse" },
    { x: 78.6, z: 12.07, w: 8.16, d: 9.5, floors: 6, color: "#659099", style: "glass", name: "MERIDIAN", accent: "#3d6575" },
    { x: 71.0, z: 12.9, w: 4.2, d: 5.63, floors: 3, color: "#b96852", style: "storefront", name: "GROCERY", accent: "#667d4a" },
    { x: 95.9, z: 13.78, w: 10.21, d: 9.26, floors: 6, color: "#cb9e76", style: "commercial" },
    { x: 33.6, z: 33.9, w: 12.8, d: 8.37, floors: 2, color: "#cdab82", style: "commercial", name: "CIVIC HALL", accent: "#7a8166" },
    { x: 74.6, z: 33.8, w: 11.7, d: 9.7, floors: 4, color: "#be7f62", style: "warehouse", name: "PINE STUDIOS", accent: "#96714c" },
    { x: 95.7, z: 33.48, w: 10.25, d: 8.97, floors: 5, color: "#779598", style: "glass" },
  ];
  for (const tower of towers) block(kit, surrounding, { ...tower, background: true });
  const streetGarden = kit.group(center, [33.9, .08, 4.93]);
  kit.ground(streetGarden, 0, 0, 9.6, 2.63, kit.material("#ba9f84", "pavers"), .007);
  for (const [i, x] of [-3.42, -.28, 2.9].entries()) {
    flowerBox(kit, streetGarden, x, .61, 1.53, i + 3);
    if (i < 2) streetBench(kit, streetGarden, x + 1.35, -.39, Math.PI);
  }
  const foodStand = kit.group(center, [28.2, .08, 17.1]);
  kit.box(foodStand, [0, .38, 0], [1.37, .74, .72], kit.material("#aa7051", "brick"), true);
  kit.box(foodStand, [0, .79, 0], [1.51, .1, .82], kit.material("#e2bc83"), true);
  for (const x of [-.66, .66]) {
    kit.box(foodStand, [x, 1.16, -.26], [.07, .9, .069], kit.material("#536858"), true);
  }
  kit.box(foodStand, [0, 1.58, -.09], [1.6, .145, .91], kit.material("#d69d4e"), true);
  for (const x of [-.53, -.18, .18, .53]) {
    kit.box(foodStand, [x, 1.657, -.09], [.176, .027, .86], kit.material("#f3dbaa"));
    kit.cylinder(foodStand, [x, .88, .102], .15, .087, kit.material(x > 0 ? "#bd7448" : "#e2ad60"));
  }
  const parklet = kit.group(center, [54.4, .065, 32.9]);
  kit.ground(parklet, 0, 0, 14.1, 11.5, kit.material("#96b951", "grass"), .008);
  kit.ground(parklet, 0, 0, 14.2, 1.83, kit.material("#c9a983", "pavers"), .016);
  kit.ground(parklet, .65, 0, 1.55, 11.55, kit.material("#c9a983", "pavers"), .016);
  for (const [px, pz, seed] of [[-4.4, -3.42, 33], [5.15, -3.7, 13], [-4.66, 3.18, 14], [4.2, 3.46, 27]]) {
    kit.tree(parklet, px, pz, 1.26, seed);
    streetBench(kit, parklet, px * .74, pz * .65, pz < 0 ? 0 : Math.PI);
  }
  for (const [x, z, length, angle, seed] of [[-5.7, 1.92, 2.8, .57, 43], [5.9, -1.9, 3.1, .69, 77],
    [2.75, 4.76, 4.3, .06, 54], [-2.8, -4.86, 4.1, -.17, 68]] as const) {
    gardenBorder(kit, parklet, x, z, length, 1.34, angle, seed, .027);
  }
  parkBench(kit, parklet, .99, 2.62, Math.PI * .49, .025);
  for (const [x, z, yaw] of [[47.45, 18.65, 0], [60.2, 18.65, 0], [67.95, 8.2, Math.PI / 2],
    [67.98, 15.7, Math.PI / 2], [58.7, 26.52, 0], [49.8, -21.95, 0], [59.8, -22, 0]] as const) {
    const pocket = kit.group(center, [x, 0, z], yaw);
    flowerBox(kit, pocket, 0, 0, 1.82, Math.round(x) % 4);
    streetBench(kit, pocket, 1.92, .08, Math.PI);
  }
  for (const [x, z, angle] of [[29.37, 21.46, 0], [31.64, 21.46, 0], [33.91, 21.46, 0], [36.18, 21.46, 0],
    [67.84, 5.15, Math.PI / 2], [67.84, 6.47, Math.PI / 2]] as const) {
    const planter = kit.group(center, [x, 0, z], angle);
    flowerBox(kit, planter, 0, 0, .90, Math.round(x) % 4);
  }
  const streetTrees: Tree[] = [];
  for (const [x, z, seed] of [
    [29.87, -3.77, 31], [38.25, -3.64, 18], [47.2, -3.21, 8], [56.9, -3.39, 24], [61.75, -3.52, 18], [71.4, -3.54, 33],
    [48.52, 4.14, 32], [58.3, 4.03, 33], [50.0, -20.84, 12], [55.4, -20.76, 16], [40.1, 5.3, 27],
    [26.9, 15.7, 1], [39.15, -17.12, 14], [68.45, 17.2, 25], [84.06, 18.0, 18], [80.23, -3.3, 13],
    [69.1, -19.74, 2], [79.51, -19.87, 16], [95.7, 4.1, 18], [87.9, 19.2, 12],
    [35.54, -38.58, 17], [45.92, -39.29, 32], [53.4, -39.89, 36], [60.0, -38.52, 12],
  ]) {
    const replacesTree = (z > -3.5 && z < -3 && x > 46 && x < 58) || x === 40.1 || x === 39.15;
    const size = .83 + seed % 4 * .075;
    if (replacesTree) cornerTrees.push([x, z, size, seed]);
    else streetTrees.push({ x, z, size: size * .93 });
  }
  kit.batch(models.upgradeDowntownTrees(scene, streetTrees));
  const parked = new THREE.Group();
  scene.add(parked);
  const parking = [
    [46.62, -18.7, 0, "#416a78"], [46.59, -15.6, 0, "#b56147"], [62.73, -8.1, 0, "#d5b77a"],
    [39.69, 6.85, 0, "#7d96a2"], [38.96, -22.41, Math.PI / 2, "#5a8380"],
    [55.7, 22.55, Math.PI / 2, "#a8674f"], [60.8, 22.52, Math.PI / 2, "#78987b"],
  ] as const;
  for (const [index, [x, z, rotation, color]] of parking.entries()) {
    const car = makeVehicle(kit, parked, color);
    car.position.set(x, .065, z);
    car.rotation.y = rotation;
    car.scale.setScalar(.76);
    models.upgradeDowntownCar(car, index % 3 === 0 ? "crossover" : "sedan", color);
  }
  kit.batch(streets);
  kit.batch(center);
  kit.batch(surrounding);
  const streetLife = oliveStreetLife(kit, scene, models.upgradeDowntownVan, models.invalidate);
  const oliveCorner = loadOliveCorner(scene, cornerFallback, peopleFallback, (state) => {
    placeholders.removeFromParent();
    const ready = state === "ready";
    if (!ready) {
      parkPacific(kit, cornerFallback);
      library(kit, cornerFallback);
      olivePlaza(kit, cornerFallback);
      block(kit, cornerFallback, { x: 35.8, z: 11.6, w: 7.9, d: 6.1, floors: 2, color: "#bb6049",
        style: "storefront", name: "OLIVE & RYE", accent: "#a65c41" });
      streetPatio(kit, cornerFallback, 35.8, 17.2);
      cornerTrees.forEach(([x, z, size, seed]) => kit.tree(cornerFallback, x, z, size, seed));
      kit.batch(cornerFallback);
    }
    oliveTilework(kit, scene, ready ? .051 : .079);
    streetLife.setCornerArt(ready);
    onArtState(state);
  }, models.invalidate);
  const plazaLife = plazaVisitors(kit, scene);
  const plazaRipples = waterRipples(kit, scene, [[52.02, .338, 11.12, .92], [52.26, .339, 11.05, 1.13]]);

  const routes: [number, number][][] = [
    [[26.8, 3.26], [40.12, 3.26], [40.12, 19.73], [26.8, 19.73]],
    [[46.08, 3.31], [61.29, 3.31], [61.29, 19.0], [46.08, 19.0]],
    [[46.17, -3.15], [61.63, -3.15], [61.63, -20.91], [46.17, -20.91]],
    [[25.94, -3.19], [41.01, -3.19], [41.01, -20.43], [25.94, -20.43]],
    [[46.2, -27.13], [61.7, -27.13], [61.7, -38.7], [46.2, -38.7]],
    [[68.38, -3.1], [82.95, -3.1], [82.95, -20.33], [68.38, -20.33]],
  ];
  const clothes: [string, string, string][] = [
    ["#b44e43", "#ae7457", "#48322c"], ["#367c79", "#d59d7a", "#63432d"],
    ["#e3a841", "#805440", "#3e312e"], ["#655795", "#cb9573", "#593a2e"],
    ["#7c9a61", "#d8a385", "#48362e"], ["#5a789d", "#a87559", "#524032"],
  ];
  const moving = routes.flatMap((path, row) => [0, 1].map((i) => {
    const colorIndex = (row + i * 3) % clothes.length;
    const citizen = makePerson(kit, actors, clothes[colorIndex], .80 + i * .11, colorIndex, .91 + (row % 3)*.1);
    if (i === 0) models.upgradeDowntownWalker(citizen.person, row);
    const walk = followRoute(path, .85 + i * .23, row * 4.1 + i * 14.2);
    return (time: number) => {
      walk(time, citizen.person);
      citizen.walk(time * 7 + i * 2.4);
    };
  }));
  for (const [i, x, z, parent] of [
    [1, 36.73, 17.55, peopleFallback.micah], [4, 53.84, -3.06, peopleFallback.sofia], [5, 28.2, 16.6, actors],
  ] as const) {
    const citizen = makePerson(kit, parent, clothes[i], .84, i);
    citizen.person.position.set(x, .07, z);
    citizen.person.rotation.y = i * 1.38;
    moving.push((time) => citizen.work(time * 1.9 + i * 1.4));
  }
  const traffic: { path: [number, number][]; color: string; phase: number }[] = [
    { path: [[42.10, .97], [65.98, .97], ...[65.98, 49.5, 46.25, 42.10]
      .map((x): [number, number] => [x, locustCenter(x) - .87])], color: "#cf8848", phase: 9.3 },
    { path: [[43.84, 42.08], [43.84, 24.92], [85.08, 24.92], [85.08, 42.08]], color: "#638b99", phase: 39 },
    { path: [[24.93, -41.08], [42.08, -41.08], [42.08, locustCenter(42.08) - .92],
      ...[39.75, 31.2, 24.93].map((x): [number, number] => [x, locustCenter(x) - .92])], color: "#e9d0a4", phase: 13 },
  ];
  const brakeMaterials: THREE.MeshStandardMaterial[] = [];
  for (const [i, { path, color, phase }] of traffic.entries()) {
    const model = i === 0 ? "crossover" : "sedan";
    const car = makeVehicle(kit, actors, color);
    car.position.y = .084;
    car.scale.setScalar(.81);
    models.upgradeDowntownCar(car, model, color);
    const drive = followRoad(path, 3.4 + i * .25, phase, streetTraffic.intersections);
    const brake = new THREE.MeshStandardMaterial({ color: "#b75345", emissive: "#bd3123", emissiveIntensity: 0 });
    brakeMaterials.push(brake);
    const brakes = new THREE.Group();
    brakes.name = "Vehicle lights";
    car.add(brakes);
    for (const x of [-.43, .43]) {
      kit.box(brakes, [x, .69, model === "crossover" ? -1.52 : -1.44], [.21, .095, .044], brake, true).castShadow = false;
    }
    const roll = rollingHubs(kit, car);
    let yaw = 0;
    moving.push((time) => {
      const { travel, braking } = drive(time, car);
      const difference = Math.atan2(Math.sin(car.rotation.y - yaw), Math.cos(car.rotation.y - yaw));
      roll(travel, THREE.MathUtils.clamp(difference * 5, -.39, .39));
      yaw = car.rotation.y;
      brake.emissiveIntensity = braking ? 1.4 : 0;
    });
  }
  return {
    landmarks: sites,
    conversations: [streetLife.conversation],
    setAssignmentComplete: streetLife.setExhibitOpen,
    update(time) {
      moving.forEach((move) => move(time));
      streetTraffic.update(time);
      oliveCorner.update(time);
      streetLife.update(time);
      plazaLife(time);
      plazaRipples.update(time);
    },
    dispose() {
      brakeMaterials.forEach((material) => material.dispose());
      streetLife.dispose();
      plazaRipples.dispose();
      oliveCorner.dispose();
    },
  };
}
