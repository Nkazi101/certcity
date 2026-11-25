import * as THREE from "three";
import { makePerson, makeVehicle } from "./actors";
import { landmark } from "./sites";
import type { Environment } from "./sites";
import { ModelKit } from "./model-kit";
import { buildShiftActors } from "./depot-shift";
import { compactModel, lightModel, modelLoader, releaseModels } from "./gltf";
import type { ModelState } from "./gltf";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

function parcel(kit: ModelKit, parent: THREE.Object3D, x: number, y: number, z: number, size = 1, tint = "#c69762") {
  const width = .81 * size;
  const height = .55 * size;
  const depth = .63 * size;
  kit.box(parent, [x, y + height / 2, z], [width, height, depth], kit.material(tint), true);
  kit.box(parent, [x, y + height + .006, z], [.135 * size, .026, depth], kit.material("#e5c590"));
  kit.box(parent, [x - width * .22, y + height * .63, z + depth / 2 + .006], [.22 * size, .126 * size, .016], kit.material("#f4e5c2"));
}

function monitor(kit: ModelKit, parent: THREE.Object3D, x: number, y: number, z: number, width = .76) {
  const caseColor = kit.material("#53675d");
  kit.box(parent, [x, y + .13, z], [.12, .26, .12], caseColor, true);
  kit.box(parent, [x, y + .36, z], [width, .48, .115], caseColor, true);
  kit.box(parent, [x, y + .36, z + .064], [width - .085, .386, .026], kit.material("#9bb9a1"));
  for (let row = 0; row < 4; row++) {
    kit.box(parent, [x - width * .14, y + .235 + row * .069, z + .081], [width * (.4 + row * .08), .018, .008], kit.material("#527868"));
  }
  kit.box(parent, [x, y + .027, z + .29], [.49, .044, .184], kit.material("#6b7970"), true);
}

function shelf(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, width: number) {
  const rack = kit.group(parent, [x, 0, z]);
  const metal = kit.material("#637b6d");
  const wood = kit.material("#b48c63");
  for (const cx of [-width / 2, width / 2]) {
    for (const cz of [-.34, .34]) kit.box(rack, [cx, 1.37, cz], [.1, 2.75, .1], metal, true);
  }
  for (const level of [.32, 1.08, 1.84, 2.65]) {
    kit.box(rack, [0, level, 0], [width, .09, .72], wood);
    if (level === 2.65) continue;
    for (let pos = -width / 2 + .36, n = 0; pos < width / 2 - .23; pos += .65, n++) {
      parcel(kit, rack, pos, level + .045, n % 2 ? .03 : -.04, .66 + n % 3 * .094,
        n % 2 ? "#d8b98a" : "#bd8c5b");
    }
  }
}

function planter(kit: ModelKit, parent: THREE.Object3D, x: number, z: number) {
  kit.cylinder(parent, [x, .19, z], .47, .39, kit.material("#b67452"), true);
  kit.foliage(parent, [x, .61, z], [.55, .7, .51], "#648a53");
  kit.foliage(parent, [x + .18, .71, z], [.43, .55, .38], "#7ba75c");
}

function dispatchWayfinding(kit: ModelKit, room: THREE.Group) {
  const frame = kit.material("#496c66");
  const contrast = kit.material("#f1dcad");
  const brass = kit.material("#c69e5c");
  const stripe = kit.material("#99a798");
  const apron = kit.material("#7a8d80", "stone");
  // Floor trails connect the existing authored counter, lookup terminal and packing bench.
  for (const [x, z, width, depth] of [[-4.48, 2.91, 3.52, .86], [4.05, -1.58, 2.69, 1.15], [3.78, 3.61, 3.67, .76]]) {
    kit.ground(room, x, z, width, depth, apron, .015);
    for (const end of [-1, 1]) kit.ground(room, x, z + end * (depth / 2 - .026), width, .031, stripe, .018);
  }
  const labels = [
    { x: -4.57, z: 1.04, text: "SUPPORT", width: 1.52 },
    { x: 4.05, z: -2.71, text: "LOOKUP", width: 1.52 },
    { x: 3.61, z: 2.14, text: "DISPATCH", width: 1.74 },
  ];
  for (const { x, z, text, width } of labels) {
    const sign = kit.group(room, [x, 2.90, z]);
    kit.box(sign, [0, .43, 0], [.057, .84, .061], frame, true);
    kit.box(sign, [0, 0, 0], [width + .11, .45, .118], frame, true);
    kit.sign(sign, text, [0, 0, .067], width, ["#496c66", "#f6e3af"]);
    kit.box(sign, [0, -.22, .064], [width, .031, .018], brass);
  }
  kit.box(room, [3.31, 2.57, -4.73], [3.33, .94, .15], frame, true);
  kit.box(room, [3.31, 2.50, -4.632], [3.18, .73, .078], kit.material("#334f4c"), true);
  kit.sign(room, "SUPPORT QUEUE", [3.31, 2.84, -4.582], 1.42, ["#496c66", "#f6e3af"]);
  for (let slot = 0; slot < 4; slot++) {
    const x = 2.23 + slot * .72;
    kit.box(room, [x, 2.45, -4.573], [.53, .30, .030], frame, true);
    kit.box(room, [x, 2.20, -4.566], [.32, .029, .028], contrast, true);
  }
  for (const x of [-7.05, 7.35]) {
    kit.box(room, [x, .55, 4.63], [.22, 1.08, .25], frame, true);
    for (const y of [.77, .92]) kit.box(room, [x, y, 4.633], [.24, .083, .263], brass, true);
  }
}

export function buildDepot(kit: ModelKit, scene: THREE.Scene, onArtState: (state: ModelState) => void): Environment {
  const depot = new THREE.Group();
  const fixtureFallback = new THREE.Group();
  const fixtures = kit.group(fixtureFallback, [0, .31, 0]);
  scene.add(depot, fixtureFallback);
  const sage = kit.material("#638777");
  const teal = kit.material("#5a8a7c");
  const cream = kit.material("#e7d6ad");
  const brick = kit.material("#bc7757", "brick");
  const wood = kit.material("#c79a65", "pavers");
  kit.ground(depot, 0, 0, 145, 145, kit.material("#97b964", "grass"), -.025);
  kit.ground(depot, -12.3, -.1, 3.8, 11.2, kit.material("#d9c6a2", "pavers"), .012);
  kit.ground(depot, 10.8, -1.8, 3.9, 9.2, kit.material("#d9c6a2", "pavers"), .012);
  kit.ground(depot, 0, -7.72, 18.8, 3.2, kit.material("#d9c6a2", "pavers"), .012);
  kit.ground(depot, 0, 8.2, 140, 5.3, kit.material("#777b71", "road"), .017);
  kit.ground(depot, 0, 5.6, 34, 2.35, kit.material("#e0d2b2", "pavers"), .025);
  for (let x = -44; x <= 44; x += 2.2) {
    kit.ground(depot, x, 8.28, 1.05, .07, kit.material("#eac987"), .028);
  }
  kit.box(depot, [0, .14, 0], [15.8, .32, 10.72], teal, true);
  kit.ground(depot, 0, 0, 15.6, 10.5, kit.material("#ded1af", "pavers"), .307);
  for (const z of [-3.79, 0, 3.82]) {
    kit.ground(depot, 0, z, 15.2, .037, kit.material("#a7ab94"), .313);
  }
  const room = kit.group(depot, [0, .31, 0]);
  kit.box(room, [0, 1.78, -5.13], [15.7, 3.57, .32], brick);
  kit.box(room, [-7.72, 1.76, -.98], [.32, 3.51, 8.38], brick);
  kit.box(room, [0, 3.58, -5.12], [15.8, .24, .39], teal, true);
  kit.box(room, [-7.73, 3.56, -.98], [.4, .24, 8.47], teal, true);
  kit.box(room, [0, .23, -4.927], [15.7, .34, .095], sage);
  kit.box(room, [-7.53, .23, -.98], [.095, .34, 8.4], sage);
  for (const x of [-6.1, -3.6, .1]) kit.window(room, [x, 2.24, -4.94], 1.75, 1.7, 0, true);
  for (const z of [-3.44, -.7, 1.45]) kit.window(room, [-7.54, 2.21, z], 1.64, 1.55, Math.PI / 2, true);
  for (const x of [-7.3, -1.72, 2.28, 5.7, 7.53]) {
    kit.box(room, [x, 1.73, -4.89], [.18, 3.43, .19], teal, true);
  }
  kit.box(room, [6.22, 1.45, -4.9], [2.1, 2.9, .18], kit.material("#4b665e"), true);
  for (let i = 0; i < 10; i++) kit.box(room, [6.22, .24 + i * .258, -4.798], [1.96, .18, .047], kit.material("#789584"));
  kit.sign(room, "CITY DISPATCH", [5.8, 3.2, -4.896], 2.3, ["#4c786e", "#f8e5bc"]);
  shelf(kit, room, -1.92, -4.04, 2.6);
  shelf(kit, room, .99, -4.1, 2.42);
  shelf(kit, room, -5.51, -3.63, 2.45);

  // Support counter with two working terminals.
  kit.ground(fixtures, -4.39, 1.45, 5.18, 3.19, kit.material("#a9b296", "pavers"), .012);
  kit.box(fixtures, [-4.48, .49, 1.19], [3.42, .96, 1.06], sage, true);
  kit.box(fixtures, [-4.48, 1.013, 1.19], [3.6, .13, 1.2], wood, true);
  for (const x of [-5.52, -4.2]) monitor(kit, fixtures, x, 1.09, 1.1, .81);
  kit.box(fixtures, [-3.2, 1.15, 1.27], [.27, .12, .31], kit.material("#d9c5a0"), true);
  kit.box(fixtures, [-5.98, .43, -.25], [.92, .85, 1.0], cream, true);
  planter(kit, room, -6.5, 2.12);
  kit.box(fixtures, [-6.34, .24, .28], [.76, .48, .68], kit.material("#a7ae87"), true);
  kit.box(fixtures, [-6.62, .56, .28], [.23, .61, .73], kit.material("#96a37d"), true);

  // Lookup terminal and its stock scanner.
  kit.box(fixtures, [4.06, .71, -2.81], [1.96, 1.41, .82], teal, true);
  const terminal = kit.box(fixtures, [4.06, 1.53, -2.73], [1.62, .7, .46], sage, true);
  terminal.rotation.x = -.14;
  kit.box(fixtures, [4.06, 1.55, -2.478], [1.22, .41, .061], kit.material("#d8ddb2"), true);
  for (let row = 0; row < 5; row++) {
    kit.box(fixtures, [4.06, 1.43 + row * .063, -2.437], [.69, .019, .025], kit.material("#799a80"));
  }
  kit.box(fixtures, [4.06, 1.17, -2.215], [1.1, .08, .42], kit.material("#4f7164"), true);
  kit.box(fixtures, [5.54, .52, -2.37], [.84, 1.03, .7], kit.material("#adab8d"), true);
  parcel(kit, fixtures, 5.54, 1.05, -2.37, .76);

  // Packing bench, parcels and floor markings.
  for (const x of [2.2, 5.31]) {
    for (const z of [1.81, 2.63]) kit.box(fixtures, [x, .487, z], [.14, .96, .15], teal, true);
  }
  kit.box(fixtures, [3.76, .991, 2.21], [3.44, .14, 1.15], wood, true);
  kit.box(fixtures, [3.75, .255, 2.23], [3.33, .1, 1.0], sage, true);
  kit.box(fixtures, [3.77, 1.072, 2.23], [1.12, .024, .61], teal);
  parcel(kit, fixtures, 2.49, 1.062, 2.17, .89);
  parcel(kit, fixtures, 5.02, 1.062, 2.35, .88, "#d8b484");
  parcel(kit, fixtures, 2.55, .31, 2.16, 1.04);
  parcel(kit, fixtures, 4.84, .31, 2.24, .96);
  parcel(kit, fixtures, 5.98, 0, 2.46, 1.18);
  parcel(kit, fixtures, 5.98, .66, 2.46, .88);
  for (let i = 0; i < 11; i++) {
    kit.ground(fixtures, 1.65 + i * .448, 3.67, .25, .08, kit.material("#d7ac55"), .013);
  }
  const trolley = kit.group(room, [.03, .018, -.43], -.24);
  kit.box(trolley, [0, .23, 0], [1.29, .13, .77], sage, true);
  for (const side of [-1, 1]) {
    const wheel = kit.cylinder(trolley, [side * .44, .094, .29], .19, .091, kit.material("#4f5a50"));
    wheel.rotation.z = Math.PI / 2;
    kit.box(trolley, [side * .51, .553, -.331], [.071, .78, .072], teal, true);
  }
  kit.box(trolley, [0, .935, -.331], [1.04, .071, .07], teal, true);
  parcel(kit, trolley, -.29, .31, -.017, .83);
  parcel(kit, trolley, .345, .31, .022, .73);
  for (const x of [-.12, 1.77, 3.81]) {
    kit.box(room, [x, 3.13, -4.61], [.12, .105, .66], sage, true);
    kit.cylinder(room, [x, 3.013, -4.28], .42, .17, sage, true);
    kit.sphere(room, [x, 2.938, -4.28], [.23, .11, .22], kit.material("#fff2be"));
  }
  for (const [x, z] of [[-12.3, -5.5], [-12.9, 4.4], [9.71, -5.3], [11.34, 4.87]]) {
    kit.box(depot, [x, .123, z], [1.48, .25, 1.18], kit.material("#e1c9a5"), true);
    for (const offset of [-.37, .1, .49]) kit.shrub(depot, x + offset, z + .027, 1.2, true);
  }
  const van = makeVehicle(kit, depot, "#dcb158", true);
  van.position.set(10.0, .03, -.07);
  van.rotation.y = Math.PI;
  planter(kit, room, 7.14, 3.2);
  planter(kit, room, -7.09, -3.94);
  kit.tree(depot, -9, -3.22, 1.16, 38);
  kit.tree(depot, 9.03, 4.62, 1.03, 45);
  kit.tree(depot, 10.0, -6.98, 1.13, 9);
  for (const x of [-6.8, -5.9, -5.2, 6.1, 7.2]) kit.shrub(depot, x, 5.77, 1.2, true);
  dispatchWayfinding(kit, room);
  const shiftActors = buildShiftActors(kit, scene, room);
  const lamp = new THREE.PointLight("#fff0ca", 20, 11, 2);
  lamp.position.set(3.55, 4.25, -1.8);
  scene.add(lamp);
  kit.batch(depot);
  kit.batch(fixtureFallback);
  let model: GLTF | null = null;
  let ended = false;
  void modelLoader().loadAsync("/models/city-dispatch/stations.glb").then((asset) => {
    if (ended) {
      releaseModels([asset]);
      return;
    }
    model = asset;
    lightModel(asset.scene);
    compactModel(asset.scene);
    scene.add(asset.scene);
    fixtureFallback.visible = false;
    onArtState("ready");
  }).catch(() => {
    if (!ended) onArtState("fallback");
  });

  const staff = new THREE.Group();
  scene.add(staff);
  const workers = [
    makePerson(kit, staff, ["#d6a54f", "#b88360", "#5b4131"], .99, 3),
    makePerson(kit, staff, ["#6e99a0", "#bf8768", "#4a382d"], 1.05, 4),
    makePerson(kit, staff, ["#719967", "#a67258", "#493b35"], 1.03, 6),
  ];
  workers[0].person.position.set(-4.82, .31, 2.17);
  workers[1].person.position.set(4.01, .31, -1.81);
  workers[2].person.position.set(3.53, .31, 3.19);
  workers[0].person.rotation.y = Math.PI;
  workers[1].person.rotation.y = Math.PI - .15;
  workers[2].person.rotation.y = Math.PI + .10;
  // Station result badges ride on the person working each station.
  shiftActors.stations.add("support", workers[0].person);
  shiftActors.stations.add("lookup", workers[1].person);
  shiftActors.stations.add("dispatch", workers[2].person);
  const queue = kit.group(scene, [-3.61, 1.409, 1.51]);
  const trays = Array.from({ length: 4 }, (_, index) => {
    const tray = kit.group(queue, [0, index * .085, 0], index % 2 ? -.04 : .053);
    kit.box(tray, [0, .041, 0], [.57, .079, .41], kit.material(index % 2 ? "#f2e2bc" : "#e6d1a9"));
    kit.box(tray, [0, .083, .056], [.34, .01, .021], kit.material("#a58468"));
    return tray;
  });
  const indicator = kit.box(queue, [.403, -.052, .043], [.144, .11, .122], kit.material("#d9a443"), true);
  const normalStatus = kit.material("#66ab84");
  const busyStatus = kit.material("#d9a443");
  const idleStatus = kit.material("#658382");
  const wallQueue = Array.from({ length: 4 }, (_, slot) => kit.box(scene, [2.23 + slot * .72, 2.76, -4.554], [.32, .145, .026], idleStatus, true));

  const landmarks = [
    landmark("support", -4.45, 1.43, 4.0, 1.8, 1.67),
    landmark("lookup", 4.06, -2.52, 2.14, 1.46, 2.05),
    landmark("dispatch", 3.84, 2.43, 3.88, 1.78, 1.5),
  ];
  return {
    landmarks,
    update(time) {
      workers[0].work(time * 6.4, "type");
      workers[1].work(time * 2.75 + .9, "scan");
      workers[2].work(time * 3.42 + 2.3, "pack");
      shiftActors.update(time);
    },
    setRoomReaction(state, immediate) {
      shiftActors.set(state, immediate);
    },
    setStationOutcome: shiftActors.stations.set,
    reactionFocus: shiftActors.focus,
    dispose() {
      ended = true;
      if (model) releaseModels([model]);
    },
    setWorkload(hours) {
      const visibleTrays = Math.max(0, Math.min(trays.length, Math.ceil(hours / 4)));
      trays.forEach((tray, index) => { tray.visible = index < visibleTrays; });
      indicator.material = visibleTrays > 2 ? busyStatus : normalStatus;
      wallQueue.forEach((tile, slot) => { tile.material = slot < visibleTrays ? busyStatus : normalStatus; });
    },
  };
}
