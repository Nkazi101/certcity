import * as THREE from "three";
import { makePerson } from "./actors";
import { ModelKit } from "./model-kit";
import { landmark } from "./sites";
import type { Environment } from "./sites";
import type { AssignmentWorkId } from "../claude/assignment-work";
import type { WorkLayout } from "../claude/cases/layouts";
import type { MissionExperience, RoomKind } from "../claude/mission-experiences";
import { roomArchitecture, roomAtmosphere } from "./room-architecture";
import type { RoomPalette as Palette } from "./room-architecture";
import { roomSavedArt, roomSceneArt } from "./room-scenes";
import type { RoomStation } from "./room-scenes";
import { buildRoomReplay } from "./room-replay";

const palettes: Record<RoomKind, Palette> = {
  archive: { wall: "#c7b993", trim: "#55796c", floor: "#b18b60", wood: "#a97854", accent: "#6b9278", metal: "#60756d" },
  printshop: { wall: "#bd8064", trim: "#4c776a", floor: "#ddd3bb", wood: "#a8865d", accent: "#d4a75f", metal: "#60796f" },
  kitchen: { wall: "#b4c4b5", trim: "#58796c", floor: "#c5c7b4", wood: "#aa7752", accent: "#b56d4a", metal: "#71847b" },
  community: { wall: "#b2c2a0", trim: "#557969", floor: "#e0d9c3", wood: "#b48a62", accent: "#d5a555", metal: "#63766d" },
  office: { wall: "#a0b2b7", trim: "#58737f", floor: "#b4bbb6", wood: "#93988d", accent: "#7294a0", metal: "#607885" },
  workshop: { wall: "#bd9875", trim: "#4e7568", floor: "#d9cfb8", wood: "#9f7651", accent: "#cb9c4f", metal: "#5d716c" },
  market: { wall: "#c99f72", trim: "#517564", floor: "#dfc891", wood: "#ad8057", accent: "#c78045", metal: "#63766d" },
  school: { wall: "#bcc8c0", trim: "#607e87", floor: "#d4d5bb", wood: "#b08b64", accent: "#7297a0", metal: "#647a71" },
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
      desk(kit, room, 2.2, 1.7, 3.2, 1.45, palette, .9);
      desk(kit, room, -.98, -.92, 3.3, 1.25, palette, .9);
      monitor(kit, room, -.96, .96, -1.11, palette);
      desk(kit, room, -4.95, .42, 2.0, 1.52, palette, .9);
      shelf(kit, room, 6.62, .68, 1.3, palette, true);
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
      }
      shelf(kit, room, -4.9, -4.02, 2.6, palette, true);
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

export type MissionRoom = {
  kind: RoomKind;
  room: string;
  missionId?: string;
  workId?: AssignmentWorkId;
  surface?: WorkLayout["kind"];
  interviews?: MissionExperience["interviews"];
};

const roomResidents: Record<RoomKind, readonly [number, number, number, number]> = {
  archive: [1.14, 1.34, 4.84, 1.28], printshop: [-3.72, 2.70, 1.60, 2.54],
  kitchen: [-5.43, -.74, -2.93, -.28], community: [-4.66, .15, .42, 1.84],
  office: [-1.08, -.18, 2.23, 2.90], workshop: [-1.6, 1.98, 2.50, 1.80],
  market: [-1.37, -.47, 2.45, .13], school: [-4.16, .12, -1.33, .13],
  courthouse: [-3.20, .13, 1.64, .09], dispatch: [-2.00, -.68, 1.62, -1.21],
};

const peopleColors = [
  ["#bd864c", "#b67957", "#503932"], ["#718b88", "#c69572", "#493830"],
  ["#a76555", "#73513f", "#302d2c"], ["#938593", "#cf9a78", "#6e4a3c"],
  ["#56716e", "#ae7757", "#4e3c35"], ["#655f75", "#97674e", "#362f30"],
] as const;

export function buildMissionInterior(kit: ModelKit, scene: THREE.Scene, { kind, room: roomName, missionId, workId, surface, interviews }: MissionRoom): Environment {
  const palette = palettes[kind];
  const atmosphere = roomAtmosphere(kind);
  scene.background = new THREE.Color(atmosphere.ground);
  const interior = new THREE.Group();
  scene.add(interior);
  kit.contactShadow(interior, -.23, .24, 19.8, 13.28, -.055);
  roomArchitecture(kit, interior, kind, palette);
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
  const residents = [0, 1].map((index) => {
    const identity = interviews?.[index]?.id ?? kind + index;
    const hash = Array.from(identity).reduce((total, letter) => Math.imul(total, 31) + letter.charCodeAt(0), 31) >>> 0;
    const colors = peopleColors[hash % peopleColors.length];
    return makePerson(kit, people, [...colors], .96 + (hash % 5) * .026, 1 + hash % 7, .94 + hash % 4 * .055);
  });
  const workstations = {
    "kitchen-extract": [-4.45, -1.75, 4.35, 1.18, 1.5],
    "printworks-rules": [-3.6, 1.36, 3.6, 1.65, 1.65],
    "archive-coordination": [3.35, .2, 3.7, 1.35, 1.25],
    "library-desk": [3.35, .2, 3.7, 1.35, 1.25],
    "printworks-stream": [1.15, 1.36, 3.6, 1.65, 1.65],
    "library-retrieval-architecture": [3.35, .2, 3.7, 1.35, 1.25],
  } as const;
  const roomStations: Record<RoomKind, RoomStation> = {
    archive: [3.35, .2, 3.7, 1.35, 1.25], printshop: [1.15, 1.36, 3.6, 1.65, 1.65],
    kitchen: [2.1, 1, 3.8, 1.55, 1.25], community: [-3.7, -1.3, 4.1, 1.35, 1.54],
    office: [2.2, 1.7, 3.2, 1.5, 1.55], workshop: [0, .75, 6.1, 1.6, 1.25],
    market: [1.1, -1.2, 3.2, 1.35, 1.54], school: [-3.55, -1.35, 4, 1.35, 1.54],
    courthouse: [-2.1, -1.2, 4.3, 1.15, 1.96], dispatch: [0, -2.2, 3.25, 1.2, 1.61],
  };
  const station = workId ? workstations[workId] : missionId === "supplier-invoices" ? workstations["kitchen-extract"] : roomStations[kind];
  const stationHeight = missionId === "supplier-invoices" || workId === "kitchen-extract" || kind === "courthouse" ? 1.51 : 1.03;
  if (surface && surface !== "incident") stationEquipment(kit, interior, palette, surface, station[0], stationHeight, station[1]);
  roomSceneArt(kit, interior, kind, palette, station, missionId);
  const focusLight = new THREE.PointLight(atmosphere.sky, kind === "office" ? 13 : 17, 10, 2);
  focusLight.position.set(station[0] + .37, 4.35, station[1] + 1.29);
  scene.add(focusLight);
  const positions = roomResidents[kind];
  for (const [index, resident] of residents.entries()) {
    const x = positions[index * 2], z = positions[index * 2 + 1];
    resident.person.position.set(x, .31, z);
    resident.person.rotation.y = Math.atan2(station[0] - x, station[1] - z);
  }
  if (kind === "office") residents[1].sit(.67);
  kit.batch(interior);
  const replayArt = buildRoomReplay(kit, scene, missionId, station, stationHeight);
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
    const height = stationHeight;
    const offset = workId === "archive-coordination" ? -.92 : .9;
    const green = kit.material("#698c70");
    const px = x + offset;
    const pz = z + .27;
    if (roomSavedArt(kit, incoming, finished, station, missionId, height)) {
      // The marked draft, invoice, or handoff is stored at its own station.
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
    kit.batch(incoming);
    kit.batch(finished);
    finished.visible = false;
  }
  let assignmentComplete = false;
  let liveReplay = false;
  function showWork() {
    finished.visible = assignmentComplete && !liveReplay;
    incoming.visible = !assignmentComplete && !liveReplay;
  }
  return {
    landmarks: points,
    setAssignmentComplete(complete) {
      assignmentComplete = complete;
      showWork();
    },
    setMissionReplay: replayArt ? (replay, immediate) => {
      liveReplay = replayArt.set(replay, immediate);
      showWork();
    } : undefined,
    update(time) {
      replayArt?.update();
      residents[0].work(time * 2.3 + .2, kind === "market" || kind === "kitchen" ? "pack" : kind === "school" ? "type" : "general");
      residents[1].work(time * 2.7 + 1.1, kind === "kitchen" ? "scan" : kind === "office" || kind === "printshop" || kind === "archive" ? "type" : "general");
    },
  };
}
