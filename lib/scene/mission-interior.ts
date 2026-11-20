import * as THREE from "three";
import { makePerson } from "./actors";
import { ModelKit } from "./model-kit";
import { landmark } from "./sites";
import type { Environment } from "./sites";
import type { AssignmentWorkId } from "../claude/assignment-work";
import type { WorkLayout } from "../claude/cases/layouts";
import type { RoomKind } from "../claude/mission-experiences";

type Palette = { wall: string; trim: string; floor: string; wood: string; accent: string; metal: string };

const palettes: Record<RoomKind, Palette> = {
  archive: { wall: "#c7b993", trim: "#55796c", floor: "#ded2b4", wood: "#a97d55", accent: "#6b9278", metal: "#60756d" },
  printshop: { wall: "#bd8064", trim: "#4c776a", floor: "#ddd3bb", wood: "#a8865d", accent: "#d4a75f", metal: "#60796f" },
  kitchen: { wall: "#d0bd91", trim: "#58796c", floor: "#ded6c2", wood: "#aa7752", accent: "#b56d4a", metal: "#71847b" },
  community: { wall: "#b2c2a0", trim: "#557969", floor: "#e0d9c3", wood: "#b48a62", accent: "#d5a555", metal: "#63766d" },
  office: { wall: "#c2c9b8", trim: "#54766a", floor: "#ddd8c8", wood: "#a7815d", accent: "#7294a0", metal: "#60756e" },
  workshop: { wall: "#bd9875", trim: "#4e7568", floor: "#d9cfb8", wood: "#9f7651", accent: "#cb9c4f", metal: "#5d716c" },
  market: { wall: "#d1bd8e", trim: "#517564", floor: "#dfd3b8", wood: "#ad8057", accent: "#c78045", metal: "#63766d" },
  school: { wall: "#c4c79f", trim: "#55796d", floor: "#e3dac4", wood: "#b08b64", accent: "#7297a0", metal: "#647a71" },
  courthouse: { wall: "#c4b69d", trim: "#4f7368", floor: "#ded7c7", wood: "#a87f59", accent: "#ba9a5b", metal: "#64756f" },
  dispatch: { wall: "#b97758", trim: "#527b70", floor: "#ded1af", wood: "#bd915e", accent: "#719799", metal: "#617c70" },
};

function desk(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, width: number, depth: number, palette: Palette, height = .91) {
  const legs = palette.metal;
  for (const dx of [-width / 2 + .13, width / 2 - .13]) {
    for (const dz of [-depth / 2 + .12, depth / 2 - .12]) kit.box(parent, [x + dx, height / 2, z + dz], [.12, height, .12], kit.material(legs), true);
  }
  kit.box(parent, [x, height, z], [width, .12, depth], kit.material(palette.wood), true);
  kit.box(parent, [x, .2, z], [width * .78, .09, depth * .72], kit.material(palette.trim));
  kit.box(parent, [x - width * .24, height + .075, z - depth * .1], [.44, .04, .31], kit.material("#f5eddb"), true);
  kit.box(parent, [x - width * .23, height + .11, z - depth * .1], [.17, .025, .09], kit.material(palette.accent));
}

function shelf(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, width: number, palette: Palette, bins = false) {
  for (const dx of [-width / 2, width / 2]) kit.box(parent, [x + dx, 1.2, z], [.1, 2.4, .58], kit.material(palette.metal), true);
  for (const y of [.28, .98, 1.68, 2.37]) {
    kit.box(parent, [x, y, z], [width, .09, .72], kit.material(palette.wood), true);
    if (y > 2) continue;
    const count = Math.max(2, Math.floor(width / .52));
    for (let i = 0; i < count; i++) {
      const dx = x - width / 2 + .27 + i * (width - .4) / Math.max(1, count - 1);
      const height = bins ? .35 : .43 + (i % 3) * .05;
      const material = bins ? (i % 2 ? "#d8c39d" : "#c6aa7b") : (i % 2 ? "#7a9276" : "#b88b5b");
      kit.box(parent, [dx, y + .07 + height / 2, z], [bins ? .35 : .23, height, .42], kit.material(material), true);
    }
  }
}

function monitor(kit: ModelKit, parent: THREE.Object3D, x: number, y: number, z: number, palette: Palette) {
  kit.box(parent, [x, y + .13, z], [.12, .26, .12], kit.material(palette.metal), true);
  kit.box(parent, [x, y + .39, z], [.76, .56, .13], kit.material(palette.metal), true);
  kit.box(parent, [x, y + .4, z + .073], [.65, .42, .027], kit.material("#b9c8a6"), true);
  for (let row = 0; row < 4; row++) kit.box(parent, [x - .12, y + .28 + row * .068, z + .092], [.32 + row % 2 * .14, .018, .009], kit.material(palette.trim));
}

function roomFeatures(kit: ModelKit, room: THREE.Group, palette: Palette, kind: RoomKind) {
  switch (kind) {
    case "archive":
      shelf(kit, room, -4.85, -4.05, 3.6, palette);
      shelf(kit, room, -.75, -4.05, 3.5, palette);
      shelf(kit, room, 4.05, -4.05, 3.25, palette, true);
      desk(kit, room, 3.35, .2, 3.7, 1.35, palette);
      for (const x of [2.6, 3.5, 4.3]) kit.box(room, [x, 1.12, -.05], [.48, .12, .6], kit.material("#d8c69f"), true);
      break;
    case "printshop":
      desk(kit, room, -3.75, 1.5, 3.6, 1.65, palette, .97);
      desk(kit, room, 1.05, 1.5, 4.0, 1.65, palette, .97);
      for (const x of [-5.4, -4.8, 5.1, 5.7]) {
        const roll = kit.cylinder(room, [x, .66, -3.75], .43, 1.28, kit.material("#e3d2b1"));
        roll.rotation.x = Math.PI / 2;
        kit.cylinder(room, [x, .66, -3.75], .11, 1.3, kit.material(palette.accent)).rotation.x = Math.PI / 2;
      }
      monitor(kit, room, -3.6, .98, 1.36, palette);
      monitor(kit, room, 1.15, .98, 1.36, palette);
      shelf(kit, room, 5.45, -2.3, 1.9, palette, true);
      break;
    case "kitchen":
      kit.box(room, [-4.45, .65, -1.75], [4.2, 1.3, 1.0], kit.material(palette.trim), true);
      kit.box(room, [-4.45, 1.35, -1.75], [4.35, .13, 1.18], kit.material(palette.metal), true);
      for (const x of [-5.55, -4.5, -3.45]) {
        kit.box(room, [x, 1.5, -1.69], [.63, .13, .56], kit.material(x === -4.5 ? "#d7b267" : "#f0e7d1"), true);
      }
      desk(kit, room, 2.1, 1.0, 3.8, 1.55, palette);
      for (const x of [4.1, 5.15]) {
        kit.box(room, [x, .39, -3.8], [.78, .78, .68], kit.material(x === 4.1 ? "#c79859" : "#b58d5e"), true);
        kit.box(room, [x, .81, -3.8], [.81, .08, .72], kit.material("#e4c391"), true);
      }
      break;
    case "community":
      desk(kit, room, -3.7, -1.3, 4.1, 1.35, palette);
      for (const x of [-4.8, -3.7, -2.6]) monitor(kit, room, x, .98, -1.45, palette);
      kit.box(room, [3.15, 1.2, -4.03], [4.9, 2.3, .18], kit.material("#e8dfc9"), true);
      for (let i = 0; i < 5; i++) kit.box(room, [1.4 + i * .82, 1.23, -3.91], [.59, 1.45, .045], kit.material(i % 2 ? palette.accent : "#d6b76e"), true);
      for (const x of [1.5, 3.2, 4.9]) kit.box(room, [x, .47, 2.45], [1.2, .12, .5], kit.material(palette.wood), true);
      break;
    case "office":
      for (const [x, z] of [[-4.2, -2.7], [-.1, -2.7], [4, -2.7], [-2, 1.7], [2.2, 1.7]] as const) {
        desk(kit, room, x, z, 2.5, 1.3, palette, .9);
        monitor(kit, room, x, .96, z - .12, palette);
      }
      kit.box(room, [0, 1.68, -4.04], [5.5, 1.9, .16], kit.material("#e9dfca"), true);
      for (let i = 0; i < 5; i++) kit.box(room, [-1.9 + i * .94, 1.7, -3.92], [.67, .92, .045], kit.material(i % 2 ? palette.accent : "#d5ba7e"), true);
      break;
    case "workshop":
      desk(kit, room, 0, .75, 6.1, 1.6, palette, .96);
      for (let i = 0; i < 7; i++) {
        kit.box(room, [-3.45 + i * 1.1, 2.3, -4.02], [.72, .88, .1], kit.material(i % 3 === 0 ? palette.accent : "#d6c6a6"), true);
        kit.box(room, [-3.45 + i * 1.1, 2.3, -3.94], [.2, .48, .11], kit.material(palette.metal), true);
      }
      for (const x of [-2.2, 0, 2.15]) {
        kit.box(room, [x, 1.14, .68], [.56, .12, .54], kit.material("#c8b08b"), true);
        kit.box(room, [x, 1.24, .12], [.18, .1, .25], kit.material(palette.accent), true);
      }
      shelf(kit, room, 5.2, -2.55, 2.3, palette, true);
      break;
    case "market":
      for (const [x, z] of [[-4.3, -1.2], [1.1, -1.2], [4.7, 1.55]] as const) {
        desk(kit, room, x, z, 3.2, 1.35, palette, .94);
        for (let i = 0; i < 3; i++) {
          const color = ["#bd7950", "#d5a84f", "#789457"][i];
          kit.sphere(room, [x - .75 + i * .72, 1.27, z], [.38, .31, .37], kit.material(color));
        }
      }
      shelf(kit, room, -4.9, -4.02, 2.6, palette, true);
      kit.box(room, [3.2, 1.15, -4.02], [4.1, 2.0, .17], kit.material("#e7dcc1"), true);
      break;
    case "school":
      desk(kit, room, -3.55, -1.35, 4.0, 1.35, palette);
      for (const x of [-4.45, -3.35, -2.3]) monitor(kit, room, x, .98, -1.52, palette);
      kit.box(room, [3.05, 1.12, -4.04], [5, 2.05, .17], kit.material("#e8e1cc"), true);
      for (let i = 0; i < 4; i++) kit.box(room, [1.35 + i * 1.15, 1.2, -3.92], [.83, 1.3, .06], kit.material(i % 2 ? "#e5d18e" : palette.accent), true);
      for (const x of [-4.5, -2.7, 2.7, 4.5]) {
        kit.box(room, [x, .57, 2.65], [1.1, .12, .44], kit.material(palette.wood), true);
        kit.box(room, [x, .29, 2.82], [.9, .4, .12], kit.material(palette.accent), true);
      }
      break;
    case "courthouse":
      kit.box(room, [-2.1, .7, -1.2], [7.3, 1.4, 1.15], kit.material(palette.trim), true);
      kit.box(room, [-2.1, 1.44, -1.2], [7.5, .13, 1.29], kit.material(palette.wood), true);
      for (const x of [-4.2, -2.1, 0]) monitor(kit, room, x, 1.48, -1.28, palette);
      shelf(kit, room, 5.15, -3.65, 2.1, palette, true);
      for (const x of [2.2, 3.75, 5.3]) kit.box(room, [x, .68, 2.4], [1.25, .12, .54], kit.material(palette.wood), true);
      kit.box(room, [3.8, 1.62, -4.03], [3.7, 1.9, .16], kit.material("#e6dcc8"), true);
      break;
    case "dispatch":
      for (const [x, z] of [[-4.25, -.7], [0, -2.2], [4.3, -.5]] as const) {
        desk(kit, room, x, z, 3.25, 1.2, palette, .98);
        monitor(kit, room, x, 1.05, z - .05, palette);
      }
      shelf(kit, room, 4.8, -4.05, 2.2, palette, true);
      break;
  }
}

function assignmentEquipment(kit: ModelKit, room: THREE.Group, palette: Palette, workId?: AssignmentWorkId) {
  const dark = kit.material(palette.metal);
  const paper = kit.material("#f7ebcd");
  switch (workId) {
    case "library-desk":
      monitor(kit, room, 4.44, .98, -.24, palette);
      for (const [x, cover] of [[2.13, palette.accent], [2.36, "#b88b5b"], [2.59, palette.trim]] as const) {
        kit.box(room, [x, 1.24, .38], [.16, .54, .46], kit.material(cover), true);
        kit.box(room, [x, 1.32, .615], [.11, .16, .012], paper);
      }
      break;
    case "library-retrieval-architecture":
      monitor(kit, room, 2.45, .98, -.23, palette);
      monitor(kit, room, 4.19, .98, -.23, palette);
      for (const [x, color] of [[3.12, palette.accent], [3.59, "#b88b5b"]] as const) {
        kit.box(room, [x, 1.11, .45], [.37, .19, .39], kit.material(color), true);
        kit.box(room, [x, 1.14, .655], [.19, .05, .015], paper);
      }
      break;
    case "archive-coordination":
      for (const x of [2.05, 4.62]) {
        kit.box(room, [x, 1.08, .48], [.48, .08, .42], dark, true);
        kit.box(room, [x, 1.24, .31], [.48, .23, .13], dark, true);
        kit.box(room, [x, 1.17, .49], [.36, .08, .28], paper, true);
      }
      break;
    case "printworks-stream":
      kit.box(room, [.1, 1.19, 1.27], [.66, .37, .52], dark, true);
      for (const [x, shade] of [[-.07, "#a7bd91"], [.1, "#dfbf78"], [.27, "#bc7b66"]] as const) {
        kit.box(room, [x, 1.29, 1.541], [.085, .075, .035], kit.material(shade), true);
      }
      kit.box(room, [2.4, 1.067, 1.89], [.73, .09, .48], paper, true);
      kit.box(room, [2.4, 1.12, 1.89], [.46, .016, .29], kit.material(palette.accent));
      break;
    case "printworks-rules":
      kit.box(room, [-4.75, 1.13, 1.43], [.86, .22, .72], dark, true);
      kit.box(room, [-4.75, 1.26, 1.52], [.64, .04, .47], paper, true);
      for (const z of [1.38, 1.5, 1.62]) kit.box(room, [-4.75, 1.29, z], [.43, .012, .035], kit.material(palette.accent));
      break;
    case "kitchen-extract":
      kit.box(room, [-5.82, 1.55, -1.74], [.91, .21, .66], dark, true);
      kit.box(room, [-5.82, 1.69, -1.83], [.71, .07, .46], kit.material("#b9c2b5"), true);
      kit.box(room, [-5.82, 1.57, -1.396], [.33, .08, .03], kit.material("#b9c8a6"));
      break;
  }
}

function stationEquipment(kit: ModelKit, room: THREE.Group, palette: Palette, surface: WorkLayout["kind"], x: number, y: number, z: number) {
  const paper = kit.material("#eee1bd");
  const ink = kit.material(palette.metal);
  const accent = kit.material(palette.accent);
  switch (surface) {
    case "inbox":
    case "lanes":
      for (const dx of [-.68, 0, .68]) {
        const bin = surface === "inbox" ? paper : accent;
        kit.box(room, [x + dx, y + .07, z], [.51, .12, .57], ink, true);
        kit.box(room, [x + dx, y + .14, z - .20], [.49, .20, .11], bin, true);
        kit.box(room, [x + dx, y + .15, z + .04], [.35, .06, .28], paper, true);
      }
      break;
    case "desk":
    case "redaction":
    case "ledger": {
      kit.box(room, [x, y + .05, z], [1.22, .07, .62], paper, true);
      kit.box(room, [x, y + .091, z], [.045, .012, .58], ink);
      for (const dz of [-.19, -.06, .07, .20]) {
        kit.box(room, [x - .29, y + .091, z + dz], [.39, .012, .025], ink);
        kit.box(room, [x + .29, y + .091, z + dz], [.39, .012, surface === "redaction" ? .07 : .025], surface === "redaction" ? ink : accent);
      }
      break;
    }
    case "trace":
    case "console":
      monitor(kit, room, x + .49, y, z - .24, palette);
      kit.box(room, [x - .33, y + .14, z], [.78, .25, .38], ink, true);
      for (const dx of [-.55, -.34, -.13]) kit.box(room, [x + dx, y + .17, z + .20], [.10, .06, .025], accent, true);
      break;
    case "matrix":
    case "review":
    case "incident":
      kit.box(room, [x, y + .37, z - .21], [1.49, .70, .16], ink, true);
      kit.box(room, [x, y + .38, z - .115], [1.33, .57, .038], surface === "incident" ? kit.material("#3d584b") : paper, true);
      for (const [index, dx] of [-.42, 0, .42].entries()) {
        const bar = surface === "review" ? .15 + index * .09 : .34;
        kit.box(room, [x + dx, y + .17 + bar / 2, z - .086], [.23, bar, .026], accent, true);
      }
      break;
  }
}

export type MissionRoom = { kind: RoomKind; room: string; workId?: AssignmentWorkId; surface?: WorkLayout["kind"] };

export function buildMissionInterior(kit: ModelKit, scene: THREE.Scene, { kind, room: roomName, workId, surface }: MissionRoom): Environment {
  const palette = palettes[kind];
  scene.background = new THREE.Color("#9eb28a");
  const interior = new THREE.Group();
  scene.add(interior);
  kit.box(interior, [0, .12, 0], [16, .3, 11], kit.material(palette.trim), true);
  kit.ground(interior, 0, 0, 15.72, 10.72, kit.material(palette.floor, "pavers"), .28);
  kit.box(interior, [-.2, .303, 3.74], [13.8, .028, 1.7], kit.material(palette.trim));
  for (const z of [3.02, 4.46]) kit.box(interior, [-.2, .322, z], [13.55, .012, .055], kit.material("#d6c69a"));
  kit.box(interior, [0, 2.14, -5.24], [15.8, 4.25, .3], kit.material(palette.wall, "brick"));
  kit.box(interior, [-7.76, 2.14, -.1], [.3, 4.25, 10.0], kit.material(palette.wall, "brick"));
  kit.box(interior, [0, 4.3, -5.22], [16.05, .22, .43], kit.material(palette.trim), true);
  kit.box(interior, [-7.75, 4.3, -.1], [.43, .22, 10.05], kit.material(palette.trim), true);
  kit.box(interior, [0, .45, -5.06], [15.8, .34, .11], kit.material(palette.trim), true);
  kit.box(interior, [-7.57, .45, -.1], [.11, .34, 10.0], kit.material(palette.trim), true);
  for (const x of [-6.2, -3.55, -.9, 1.75, 4.4, 7.05]) {
    kit.box(interior, [x, 2.2, -5.02], [.14, 3.72, .2], kit.material(palette.trim), true);
  }
  for (const x of [-5.05, -1.72, 1.62, 4.96]) kit.window(interior, [x, 2.75, -5.015], 2.28, 1.68, 0, true);
  kit.sign(interior, roomName.toUpperCase(), [0, 3.91, -5.012], 3.6, [palette.trim, "#f8edcf"]);
  roomFeatures(kit, interior, palette, kind);
  assignmentEquipment(kit, interior, palette, workId);
  const evidenceDesk = { x: -5.7, z: 3.46, width: 2.42 };
  desk(kit, interior, evidenceDesk.x, evidenceDesk.z, evidenceDesk.width, 1.04, palette);
  const paper = kit.material("#fff0d0");
  kit.box(interior, [-6.0, 1.018, 3.55], [.56, .08, .39], paper, true);
  kit.box(interior, [-5.54, 1.035, 3.57], [.45, .1, .53], kit.material(palette.accent), true);
  for (const z of [3.45, 3.51, 3.57, 3.63]) kit.box(interior, [-6.01, 1.065, z], [.35, .008, .012], kit.material(palette.trim));
  kit.sign(interior, "CASE FILE", [-5.72, .72, 4.004], 1.53, [palette.trim, "#f8edcf"]);
  const people = new THREE.Group();
  scene.add(people);
  const residents = [
    makePerson(kit, people, ["#d6a54f", "#b88360", "#5b4131"], .98, 3),
    makePerson(kit, people, ["#6e99a0", "#bf8768", "#4a382d"], 1.02, 4),
  ];
  residents[0].person.position.set(-1.25, .31, 2.25);
  residents[0].person.rotation.y = Math.PI - .12;
  residents[1].person.position.set(3.65, .31, -.1);
  residents[1].person.rotation.y = Math.PI + .18;
  const workstations = {
    "kitchen-extract": [-4.45, -1.75, 4.35, 1.18, 1.5],
    "printworks-rules": [-3.6, 1.36, 3.6, 1.65, 1.65],
    "archive-coordination": [3.35, .2, 3.7, 1.35, 1.25],
    "library-desk": [3.35, .2, 3.7, 1.35, 1.25],
    "printworks-stream": [1.15, 1.36, 3.6, 1.65, 1.65],
    "library-retrieval-architecture": [3.35, .2, 3.7, 1.35, 1.25],
  } as const;
  const roomStations: Record<RoomKind, readonly [number, number, number, number, number]> = {
    archive: [3.35, .2, 3.7, 1.35, 1.25], printshop: [1.15, 1.36, 3.6, 1.65, 1.65],
    kitchen: [2.1, 1, 3.8, 1.55, 1.25], community: [-3.7, -1.3, 4.1, 1.35, 1.54],
    office: [2.2, 1.7, 2.5, 1.3, 1.55], workshop: [0, .75, 6.1, 1.6, 1.25],
    market: [1.1, -1.2, 3.2, 1.35, 1.54], school: [-3.55, -1.35, 4, 1.35, 1.54],
    courthouse: [-2.1, -1.2, 4.3, 1.15, 1.96], dispatch: [0, -2.2, 3.25, 1.2, 1.61],
  };
  const station = workId ? workstations[workId] : roomStations[kind];
  if (surface) stationEquipment(kit, interior, palette, surface, station[0], kind === "courthouse" ? 1.51 : 1.03, station[1]);
  kit.batch(interior);
  residents[1].person.position.set(Math.min(6.15, station[0] + station[2] * .5 + .7), .31, station[1] + 1.1);
  const points = [
    landmark("work", station[0], station[1], station[2], station[3], station[4]),
    landmark("evidence", evidenceDesk.x, evidenceDesk.z, evidenceDesk.width, 1, 1.16),
    ...residents.map(({ person }, index) => landmark(`stakeholder-${index}`, person.position.x, person.position.z, .85, .8, 1.25)),
  ];
  const finished = new THREE.Group();
  const incoming = new THREE.Group();
  {
    scene.add(incoming, finished);
    const [x, z] = station;
    const height = workId === "kitchen-extract" || kind === "courthouse" ? 1.51 : 1.03;
    const offset = workId === "archive-coordination" ? -.92 : .9;
    const green = kit.material("#698c70");
    const px = x + offset;
    const pz = z + .27;
    if (workId === "kitchen-extract") {
      for (const dx of [-.3, 0, .3]) {
        kit.box(incoming, [px + dx, height + .055, pz], [.21, .08, .36], paper, true);
      }
      kit.box(finished, [px, height + .035, pz], [.78, .07, .47], green, true);
      kit.box(finished, [px, height + .09, pz], [.54, .045, .34], paper, true);
    } else if (workId === "printworks-rules") {
      kit.box(incoming, [px, height + .055, pz], [.55, .1, .42], paper, true);
      kit.box(finished, [px, height + .06, pz], [.63, .11, .47], green, true);
      kit.box(finished, [px, height + .122, pz], [.42, .018, .12], paper, true);
    } else if (surface === "inbox" || surface === "desk" || surface === "ledger" || surface === "redaction" || surface === "lanes") {
      for (const dx of [-.33, .31]) {
        kit.box(incoming, [px + dx, height + .04, pz], [.47, .08, .45], kit.material(palette.metal), true);
        kit.box(incoming, [px + dx, height + .09, pz], [.35, .035, .34], paper, true);
      }
      kit.box(finished, [px, height + .05, pz], [.83, .1, .49], green, true);
      kit.box(finished, [px, height + .11, pz], [.65, .03, .34], paper, true);
    } else if (surface) {
      const indicator = (group: THREE.Group, shade: string) => {
        kit.box(group, [px, height + .11, pz], [.6, .22, .39], kit.material(palette.metal), true);
        kit.box(group, [px, height + .15, pz + .21], [.33, .071, .04], kit.material(shade), true);
      };
      indicator(incoming, palette.accent);
      indicator(finished, "#94b383");
    } else {
      for (const dx of [-.24, .26]) kit.box(incoming, [px + dx, height + .045, pz], [.38, .06, .47], paper, true);
      kit.box(finished, [px, height + .057, pz], [.56, .105, .55], kit.material("#b79d6b"), true);
      kit.box(finished, [px, height + .116, pz], [.37, .018, .14], paper, true);
    }
    finished.visible = false;
  }
  return {
    landmarks: points,
    setAssignmentComplete(complete) {
      finished.visible = complete;
      incoming.visible = !complete;
    },
    update(time) {
      residents[0].work(time * 2.3 + .2, kind === "kitchen" || kind === "market" ? "pack" : "general");
      residents[1].work(time * 2.7 + 1.1, kind === "printshop" || kind === "office" ? "type" : "general");
    },
  };
}
