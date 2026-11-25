import * as THREE from "three";
import { ModelKit, seededRandom } from "./model-kit";

export const downtownWest = 24;
const east = 104;
const north = -51;
const south = 49;

const avenues = [
  { center: 24, name: "14TH ST", width: 4.25 },
  { center: 43, name: "N 13TH ST", width: 3.66 },
  { center: 65, name: "TUCKER BLVD", width: 5.6 },
  { center: 86, name: "11TH ST", width: 3.83 },
];

const streets = [
  { center: -42, name: "WASHINGTON AVE", width: 4.9 },
  { center: -24, name: "LOCUST ST", width: 3.62 },
  { center: 0, name: "OLIVE ST", width: 4.34 },
  { center: 24, name: "PINE ST", width: 3.78 },
  { center: 43, name: "CHESTNUT ST", width: 3.87 },
];

const ease = (edgeA: number, edgeB: number, at: number) => THREE.MathUtils.smoothstep(at, edgeA, edgeB);

export function locustCenter(x: number) {
  // Locust changes alignment as it runs past the library and bends at 13th.
  return -24 - 1.7 * ease(24, 31.2, x) + 2.19 * ease(39.8, 46.1, x);
}

type Road = {
  name: string;
  cross: number;
  start: number;
  end: number;
  horizontal: boolean;
  half: (along: number) => number;
  at: (along: number, offset: number) => [number, number];
};

const eastWest: Road[] = streets.map(({ center, name, width }) => ({
  name, cross: center, start: downtownWest - .14, end: center === 43 ? 86.22 : east, horizontal: true,
  half: (along) => width / 2 + (center === 0 ? .13 * ease(52, 62, along) : center === -42 ? -.21 * ease(65, 86, along) : 0),
  at: (along, offset) => [along, (center === -24 ? locustCenter(along) : center) + offset],
}));

const northSouth: Road[] = avenues.map(({ center, name, width }) => ({
  name, cross: center, start: north, end: south, horizontal: false,
  half: (along) => width / 2 + (center === 65 ? .24 * ease(4, 19, along) : center === 43 ? -.16 * ease(-13, -6, along) : 0),
  at: (along, offset) => [center - offset, along],
}));

type Material = THREE.MeshStandardMaterial;
type Pair = [number, number];

function ribbon(
  kit: ModelKit, group: THREE.Group, road: Road, start: number, end: number,
  offset: (at: number) => Pair, material: Material, y: number,
) {
  if (end - start < .021) return;
  const count = Math.max(1, Math.ceil((end - start) / .38));
  const positions: number[] = [];
  const uv: number[] = [];
  const triangles: number[] = [];
  for (let i = 0; i <= count; i++) {
    const along = start + (end - start) * i / count;
    for (const side of offset(along)) {
      const [x, z] = road.at(along, side);
      positions.push(x, y, z);
      uv.push(x / 4.2, z / 4.2);
    }
    if (i < count) {
      const n = i * 2;
      triangles.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  surfaceMesh(kit, group, positions, uv, triangles, material);
}

function surfaceMesh(
  kit: ModelKit, group: THREE.Group, positions: number[], uv: number[], indices: number[], material: Material,
) {
  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const surface = new THREE.Mesh(geometry, material);
  surface.receiveShadow = true;
  group.add(surface);
}

function pavement(kit: ModelKit, group: THREE.Group, points: Pair[], material: Material, y: number) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = kit.geometry(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2));
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4.2, -uv.getY(i) / 4.2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  group.add(mesh);
}

function curbSegment(kit: ModelKit, parent: THREE.Group, [x1, z1]: Pair, [x2, z2]: Pair, curb: Material, height = .11) {
  const curbPiece = kit.box(parent, [(x1 + x2) / 2, .036 + height / 2, (z1 + z2) / 2],
    [Math.hypot(x2 - x1, z2 - z1) + .035, height, .117], curb);
  curbPiece.rotation.y = Math.atan2(z1 - z2, x2 - x1);
  curbPiece.castShadow = false;
}

function stripMark(kit: ModelKit, group: THREE.Group, road: Road, at: number, side: number, length: number,
  width: number, paint: Material) {
  const [x, z] = road.at(at, side);
  kit.ground(group, x, z, road.horizontal ? length : width, road.horizontal ? width : length, paint, .085);
}

function stormDrain(kit: ModelKit, group: THREE.Group, road: Road, at: number, side: number) {
  const [x, z] = road.at(at, side * (road.half(at) - .16));
  const metal = kit.group(group, [x, .078, z], road.horizontal ? 0 : Math.PI / 2);
  kit.box(metal, [0, 0, 0], [.48, .02, .211], kit.material("#343e3b"), true);
  for (let i = 0; i < 7; i++) {
    kit.box(metal, [i * .054 - .162, .014, 0], [.017, .012, .171], kit.material("#66716a"));
  }
}

function manhole(kit: ModelKit, group: THREE.Group, x: number, z: number, turn: number) {
  const cap = kit.group(group, [x, .075, z], turn);
  const iron = kit.material("#4b5352");
  kit.cylinder(cap, [0, -.004, 0], .35, .022, kit.material("#424b4a"));
  kit.cylinder(cap, [0, .006, 0], .272, .014, iron);
  for (const y of [-.074, -.026, .026, .074]) {
    kit.box(cap, [0, .016, y], [Math.abs(y) > .05 ? .161 : .217, .006, .014], kit.material("#626967"));
  }
}

export function streetlamp(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, turn = 0) {
  const pole = kit.group(parent, [x, .08, z], turn);
  const iron = kit.material("#355951");
  kit.cylinder(pole, [0, .11, 0], .26, .22, iron);
  kit.cylinder(pole, [0, 1.05, 0], .088, 2.02, iron, true);
  kit.box(pole, [.16, 2.01, 0], [.36, .065, .067], iron);
  Object.assign(kit.box(pole, [.3, 1.91, 0], [.19, .19, .2], kit.material("#ffe5aa"), true).userData, { glow: 1.7, lamp: true, pool: 1.99 });
  kit.cylinder(pole, [.3, 2.036, 0], .27, .09, iron, true);
  return pole;
}

function corner(
  kit: ModelKit, group: THREE.Group, x: number, z: number, crossX: number, crossZ: number,
  sx: number, sz: number, radius: number, asphalt: Material, curb: Material,
) {
  const a = x + sx * crossX;
  const b = z + sz * crossZ;
  const arc: Pair[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i * Math.PI / 16;
    arc.push([a + sx * radius * (1 - Math.cos(t)), b + sz * radius * (1 - Math.sin(t))]);
  }
  pavement(kit, group, [[a - sx * .09, b - sz * .09], ...arc], asphalt, .067);
  for (let i = 0; i < arc.length - 1; i++) curbSegment(kit, group, arc[i], arc[i + 1], curb, .097);
}

function crossing(kit: ModelKit, group: THREE.Group, road: Road, at: number, wide: boolean, direction: number, paint: Material) {
  if (at < road.start + .55 || at > road.end - .55) return;
  const width = road.half(at) * 2;
  if (wide) {
    const count = Math.floor(width / .5);
    for (let i = 0; i < count; i++) {
      const side = ((i + .5) / count - .5) * (width - .23);
      stripMark(kit, group, road, at, side, .84, .208, paint);
    }
  } else {
    for (const sign of [-1, 1]) stripMark(kit, group, road, at + sign * .33, 0, .062, width - .29, paint);
  }
  const next = at + direction * 1.04;
  if (next > road.start + .2 && next < road.end - .2) {
    stripMark(kit, group, road, next, direction * width * .224, .085, width * .42, paint);
  }
}

type Axis = "north-south" | "east-west";
type Light = "red" | "amber" | "green";

type Intersection = {
  x: number;
  z: number;
  hx: number;
  hz: number;
  offset: number;
};

export const oliveCrossing = {
  x: 43, z: 0, hx: 1.83, hz: 2.17, offset: 3,
  westX: 40.48,
  sidewalkZ: 2.79,
};
export const tuckerOliveCrossing = { x: 65, z: 0, hx: 2.8, hz: 2.30, offset: 13 };

export function oliveWalkPhase(time: number) {
  return (time + oliveCrossing.offset) % 20;
}

function signalPhase(intersection: Intersection, axis: Axis, time: number): Light {
  const phase = (time + intersection.offset) % 20;
  if (axis === "north-south") return phase < 8 ? "green" : phase < 9.45 ? "amber" : "red";
  return phase < 10 || phase >= 19.45 ? "red" : phase < 18 ? "green" : "amber";
}

type SignalBulb = { matrix: THREE.Matrix4; name: Light; active: (time: number) => Light };

function addSignals(kit: ModelKit, parent: THREE.Group, bulbs: SignalBulb[], intersection: Intersection) {
  const { x, z, hx, hz } = intersection;
  const poles = kit.material("#56615c");
  const casework = kit.material("#383d39");
  const bulb = new THREE.Object3D();
  for (const approach of [
    { axis: "north-south", px: x + hx + .47, pz: z - hz - .46, sx: x + hx * .46, sz: z - hz - .46, yaw: 0 },
    { axis: "north-south", px: x - hx - .47, pz: z + hz + .46, sx: x - hx * .46, sz: z + hz + .46, yaw: Math.PI },
    { axis: "east-west", px: x + hx + .46, pz: z + hz + .48, sx: x + hx + .46, sz: z + hz * .44, yaw: -Math.PI / 2 },
    { axis: "east-west", px: x - hx - .46, pz: z - hz - .48, sx: x - hx - .46, sz: z - hz * .44, yaw: Math.PI / 2 },
  ] as const) {
    const { px, pz, sx, sz, yaw, axis } = approach;
    kit.cylinder(parent, [px, .202, pz], .249, .24, poles, true);
    kit.cylinder(parent, [px, 1.54, pz], .103, 2.99, poles, true);
    const arm = kit.box(parent, [(px + sx) / 2, 2.93, (pz + sz) / 2],
      [Math.hypot(px - sx, pz - sz) + .11, .081, .086], poles, true);
    arm.rotation.y = Math.atan2(pz - sz, sx - px);
    const housing = kit.group(parent, [sx, 2.66, sz], yaw);
    kit.box(housing, [0, 0, 0], [.264, .605, .152], casework, true);
    for (const h of [-.167, 0, .167]) kit.box(housing, [0, h + .075, .111], [.17, .047, .111], casework, true);
    const active = (time: number) => signalPhase(intersection, axis, time);
    (["red", "amber", "green"] as const).forEach((name, index) => {
      // Same placement as a sphere inside a yawed housing group at (sx, 2.66, sz).
      bulb.position.set(sx, 2.66, sz);
      bulb.rotation.set(0, yaw, 0);
      bulb.updateMatrix();
      const local = new THREE.Matrix4().compose(new THREE.Vector3(0, .167 - index * .167, .114), new THREE.Quaternion(),
        new THREE.Vector3(.146, .146, .067));
      bulbs.push({ matrix: bulb.matrix.clone().multiply(local), name, active });
    });
  }
}

/**
 * Every signal bulb in downtown shares four instanced draws (unlit, red, amber, green) instead of one mesh per bulb.
 * A bulb is shown in exactly one of its two candidate sets by zero-scaling the other instance.
 */
function signalLights(kit: ModelKit, dynamic: THREE.Group, bulbs: SignalBulb[]) {
  const dim = kit.material("#62655b");
  const lights = { red: kit.material("#e35b40"), amber: kit.material("#ffc050"), green: kit.material("#4fae71") };
  for (const [name, color] of [["red", "#c94b29"], ["amber", "#cc811a"], ["green", "#278b50"]] as const) {
    lights[name].emissive.set(color);
    lights[name].emissiveIntensity = 1.1;
  }
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const make = (material: THREE.Material, count: number) => {
    const mesh = new THREE.InstancedMesh(kit.ballGeometry, material, Math.max(1, count));
    mesh.count = count;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    dynamic.add(mesh);
    return mesh;
  };
  const tally = (name: Light) => bulbs.filter((bulb) => bulb.name === name).length;
  const unlit = make(dim, bulbs.length);
  const lit = { red: make(lights.red, tally("red")), amber: make(lights.amber, tally("amber")), green: make(lights.green, tally("green")) };
  const used = { red: 0, amber: 0, green: 0 };
  const slots = bulbs.map(({ matrix, name }, index) => {
    const slot = used[name]++;
    lit[name].setMatrixAt(slot, matrix);
    unlit.setMatrixAt(index, matrix);
    return slot;
  });
  for (const mesh of [unlit, ...Object.values(lit)]) mesh.computeBoundingSphere();
  const state: (Light | null)[] = bulbs.map(() => null);
  return (time: number) => {
    let changed = false;
    for (const [index, { matrix, name, active }] of bulbs.entries()) {
      const current = active(time);
      if (state[index] === current) continue;
      const on = current === name;
      if (state[index] !== null && (state[index] === name) === on) {
        state[index] = current;
        continue;
      }
      state[index] = current;
      unlit.setMatrixAt(index, on ? hidden : matrix);
      lit[name].setMatrixAt(slots[index], on ? matrix : hidden);
      changed = true;
    }
    if (changed) for (const mesh of [unlit, ...Object.values(lit)]) mesh.instanceMatrix.needsUpdate = true;
  };
}

function raisedMedian(kit: ModelKit, parent: THREE.Group, road: Road, start: number, end: number, size: number) {
  const curb = kit.material("#d6c5a8", "stone");
  const edge = (at: number, inset = 0) => {
    const width = (size - inset) * Math.min(1, Math.sqrt(Math.max(0, Math.min(at - start, end - at) / 1.12)));
    return [-width, width] as Pair;
  };
  ribbon(kit, parent, road, start, end, (at) => edge(at), curb, .144);
  for (const side of [-1, 1]) {
    const sections = Math.ceil((end - start) / .36);
    for (let i = 0; i < sections; i++) {
      const a = start + i / sections * (end - start), b = start + (i + 1) / sections * (end - start);
      const [x1, z1] = road.at(a, side * edge(a)[1]);
      const [x2, z2] = road.at(b, side * edge(b)[1]);
      curbSegment(kit, parent, [x1, z1], [x2, z2], curb, .108);
    }
  }
  ribbon(kit, parent, road, start + .68, end - .67, (at) => edge(at, .13),
    kit.material("#7b965d", "grass"), .151);
  for (let at = start + 1.39, index = 0; at < end - 1.05; at += .81, index++) {
    const [x, z] = road.at(at, (index % 2 ? -.08 : .08));
    kit.foliage(parent, [x, .226, z], [.36, .15, .32], index % 3 ? "#7d985d" : "#5f855b");
    if (index % 3 === 0) kit.sphere(parent, [x, .322, z], [.107, .08, .104], kit.material("#e4c281"));
  }
}

export function downtownStreets(kit: ModelKit, parent: THREE.Group, dynamic: THREE.Group) {
  const slab = kit.material("#e2d2b2", "pavers");
  const curb = kit.material("#d8c7aa", "stone");
  const asphalt = kit.material("#666969", "road");
  const avenueAsphalt = kit.material("#616468", "road");
  const shoulder = kit.material("#707473", "road");
  const join = kit.material("#6c6f6d", "road");
  const newSeal = kit.material("#5c6062", "road");
  const stripe = kit.material("#e8dfcc");
  const warmStripe = kit.material("#d7b977");
  const rampStone = kit.material("#b1926d", "pavers");
  const intersections: Intersection[] = [];
  const bulbs: SignalBulb[] = [];
  kit.ground(parent, (downtownWest + east) / 2, -1, east - downtownWest, 100, slab, .023);

  for (const road of [...eastWest, ...northSouth]) {
    const main = road.name === "OLIVE ST" || road.name === "TUCKER BLVD";
    const crossRoads = road.horizontal ? northSouth : eastWest;
    ribbon(kit, parent, road, road.start, road.end, (at) => [-road.half(at), road.half(at)],
      road.horizontal ? asphalt : avenueAsphalt, road.horizontal ? .059 : .063);
    const separators = [
      { cross: road.start - 4, half: () => 0, name: "" },
      ...crossRoads.filter((cross) => {
        const z = cross.at(road.cross, 0)[1];
        const along = road.horizontal ? cross.cross : z;
        return along >= road.start - .2 && along <= road.end + .2;
      }),
      { cross: road.end + 4, half: () => 0, name: "" },
    ];
    const crossAt = (cross: (typeof separators)[number]) =>
      road.horizontal || !("at" in cross) ? cross.cross : cross.at(road.cross, 0)[1];
    for (let segment = 0; segment < separators.length - 1; segment++) {
      const a = separators[segment], b = separators[segment + 1];
      const start = Math.max(road.start, crossAt(a) + a.half(road.cross) + (a.name ? 1.04 : 0));
      const end = Math.min(road.end, crossAt(b) - b.half(road.cross) - (b.name ? 1.04 : 0));
      if (end - start < .35) continue;
      for (const side of [-1, 1]) {
        const steps = Math.max(1, Math.ceil((end - start) / (road.name === "LOCUST ST" ? .56 : 2.1)));
        for (let i = 0; i < steps; i++) {
          const p1 = start + (end - start) * i / steps;
          const p2 = start + (end - start) * (i + 1) / steps;
          curbSegment(kit, parent, road.at(p1, side * road.half(p1)), road.at(p2, side * road.half(p2)), curb);
        }
        const parking = road.name === "OLIVE ST" || road.name === "PINE ST" || road.name === "WASHINGTON AVE";
        if (parking && end - start > 5.2) {
          ribbon(kit, parent, road, start + 1.44, end - 1.43, (t) => {
            const half = road.half(t);
            return side > 0 ? [half - .53, half - .065] : [-half + .065, -half + .53];
          }, shoulder, .069);
          for (let at = start + 1.45; at < end - 1.46; at += 2.8) {
            stripMark(kit, parent, road, at, side * (road.half(at) - .29), .034, .42, stripe);
          }
        }
      }
      const centerFrom = start + 1.11;
      const centerTo = end - 1.12;
      if (road.name === "LOCUST ST") continue;
      if (main) {
        for (const side of [-1, 1]) {
          ribbon(kit, parent, road, centerFrom, centerTo, () => [side * .073 - .021, side * .073 + .021], warmStripe, .078);
        }
      } else {
        for (let at = centerFrom + .6; at < centerTo; at += 2.7) {
          stripMark(kit, parent, road, at, 0, road.name === "PINE ST" ? .61 : 1.01, .051, stripe);
        }
      }
    }
  }

  for (const vertical of northSouth) {
    const x = vertical.cross;
    for (const horizontal of eastWest) {
      if (x > horizontal.end - .2 && horizontal.name !== "CHESTNUT ST") continue;
      const z = horizontal.at(x, 0)[1];
      const hx = vertical.half(z), hz = horizontal.half(x);
      const important = (x === 43 || x === 65) && (horizontal.cross === 0 || horizontal.cross === -24 || horizontal.cross === 24);
      for (const side of [-1, 1]) {
        crossing(kit, parent, horizontal, x + side * (hx + .69), important, side, stripe);
        crossing(kit, parent, vertical, z + side * (hz + .68), important, side, stripe);
        for (const flank of [-1, 1]) {
          if (x < downtownWest + .5 && flank < 0) continue;
          const radius = x === 65 ? 1.24 : x === 43 && horizontal.cross === -24 ? 1.38 : .99;
          if (x + flank * (hx + radius) < horizontal.end) {
            corner(kit, parent, x, z, hx, hz, flank, side, radius, join, curb);
          }
          if (important) {
            const tx = x + flank * (hx + .69);
            const tz = z + side * (hz + .33);
            const ramp = kit.box(parent, [tx, .092, tz], [.78, .055, .62], curb);
            ramp.rotation.x = side * -.078;
            const pad = kit.box(parent, [tx, .127, tz + side * .33], [.64, .026, .27], rampStone);
            pad.castShadow = false;
            for (let i = -2; i <= 2; i++) for (const off of [-.06, .06]) {
              kit.sphere(parent, [tx + i * .106, .145, tz + side * .33 + off],
                [.036, .023, .036], kit.material("#e4bb71")).castShadow = false;
            }
          }
        }
      }
      if ((horizontal.cross === 0 && x <= 65) || (horizontal.cross === -42 && x === 43) || (horizontal.cross === 24 && x === 65)) {
        const intersection = horizontal.cross === 0 && x === 43 ? oliveCrossing
          : horizontal.cross === 0 && x === 65 ? tuckerOliveCrossing
            : { x, z, hx, hz, offset: (x + horizontal.cross + 8) % 20 };
        intersections.push(intersection);
        addSignals(kit, parent, bulbs, intersection);
      }
      if (x === 43 && horizontal.cross === 0) continue; // The Blender street set supplies this pole.
      const pole = streetlamp(kit, parent, x + hx + .83, z + hz + .84);
      kit.sign(pole, horizontal.name, [.3, 1.54, .064], horizontal.name === "WASHINGTON AVE" ? 1.25 : 1.01, ["#386050", "#fff2d0"]);
      const perpendicular = kit.group(pole, [0, 0, 0], -Math.PI / 2);
      kit.sign(perpendicular, vertical.name, [-.25, 1.32, .055], 1.08, ["#386050", "#fff2d0"]);
    }
  }

  const random = seededRandom(314);
  for (const road of eastWest) {
    for (let i = 0; i < 13; i++) {
      const at = road.start + 2 + random() * (road.end - road.start - 4);
      const side = (random() - .5) * (road.half(at) * 1.46);
      if (avenues.some((avenue) => Math.abs(avenue.center - at) < 3.9)) continue;
      const [x, z] = road.at(at, side);
      const width = .27 + random() * 1.05;
      const depth = .11 + random() * .32;
      pavement(kit, parent, [[x - width / 2, z - depth / 2], [x + width * .42, z - depth / 2 - .036],
        [x + width / 2, z + depth / 2], [x - width * .44, z + depth * .35]], i % 4 ? join : newSeal, .071);
    }
  }
  for (const [x, z, yaw] of [[39.47, -.69, .34], [49.24, .69, .45], [57.61, -.92, .22],
    [43.61, -12.45, .77], [64.07, 7.9, -.12], [55.43, 24.96, .17], [34.02, -25.4, .22]]) {
    manhole(kit, parent, x, z, yaw);
  }
  for (const [name, at, side] of [["OLIVE ST", 38.4, -1], ["OLIVE ST", 46.92, -1], ["OLIVE ST", 61.29, 1],
    ["N 13TH ST", -4.56, 1], ["N 13TH ST", 5.21, -1], ["LOCUST ST", 48.28, -1], ["PINE ST", 53.52, 1]] as const) {
    const road = [...eastWest, ...northSouth].find((candidate) => candidate.name === name);
    if (road) stormDrain(kit, parent, road, at, side);
  }

  const tucker = northSouth[2];
  raisedMedian(kit, parent, tucker, 6.86, 17.36, .47);
  raisedMedian(kit, parent, tucker, -17.9, -6.25, .47);
  const washington = eastWest[0];
  raisedMedian(kit, parent, washington, 49.6, 59.57, .53);
  raisedMedian(kit, parent, washington, 70.1, 75.34, .44);
  const updateSignals = signalLights(kit, dynamic, bulbs);
  return { intersections, update: updateSignals };
}

export function followRoad(points: Pair[], speed: number, phase: number, intersections: Intersection[] = [],
  parking?: { at: Pair; duration: number }) {
  const route = new THREE.CurvePath<THREE.Vector3>();
  const vertices = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const corners = vertices.map((current, index) => {
    const before = vertices[(index + vertices.length - 1) % vertices.length];
    const after = vertices[(index + 1) % vertices.length];
    const approach = Math.min(.96, before.distanceTo(current) * .29, after.distanceTo(current) * .29);
    return {
      current,
      start: current.clone().lerp(before, approach / before.distanceTo(current)),
      finish: current.clone().lerp(after, approach / after.distanceTo(current)),
    };
  });
  for (const [index, point] of corners.entries()) {
    const previous = corners[(index + corners.length - 1) % corners.length];
    route.add(new THREE.LineCurve3(previous.finish, point.start));
    route.add(new THREE.QuadraticBezierCurve3(point.start, point.current, point.finish));
  }
  const length = route.getLength();
  const stops = Math.ceil(length / .12);
  const samples = intersections.length || parking ? Array.from({ length: stops }, (_, i) => route.getPoint(i / stops)) : [];
  const gates: { distance: number; intersection: Intersection; axis: Axis }[] = [];
  for (const intersection of intersections) {
    const inside = (point: THREE.Vector3) => Math.abs(point.x - intersection.x) < intersection.hx + 2.52
      && Math.abs(point.z - intersection.z) < intersection.hz + 2.52;
    let wasInside = inside(samples[stops - 1]);
    for (const [i, point] of samples.entries()) {
      const enters = inside(point);
      if (enters && !wasInside) {
        const heading = route.getTangent(i / stops);
        const axis = Math.abs(heading.x) > Math.abs(heading.z) ? "east-west" : "north-south";
        gates.push({ distance: (i - .5) / stops * length, intersection, axis });
      }
      wasInside = enters;
    }
  }
  let parkingDistance = 0;
  if (parking) {
    const point = new THREE.Vector3(parking.at[0], 0, parking.at[1]);
    const nearest = samples.reduce((best, candidate, i) =>
      candidate.distanceToSquared(point) < samples[best].distanceToSquared(point) ? i : best, 0);
    parkingDistance = nearest / stops * length;
  }

  let distance = phase % length;
  let lastTime = 0;
  let parkedFor: number | null = null;
  const position = new THREE.Vector3();
  const heading = new THREE.Vector3();
  return (seconds: number, actor: THREE.Object3D) => {
    const elapsed = Math.max(0, seconds - lastTime);
    const delta = Math.min(.11, elapsed);
    lastTime = seconds;
    const controlled = gates.length > 0 || parking;
    let travel = speed * (controlled ? delta : elapsed);
    let braking = false;
    if (parking) {
      const ahead = (parkingDistance - distance + length) % length;
      if (parkedFor !== null && parkedFor + delta < parking.duration) {
        parkedFor += delta;
        travel = 0;
      } else if (parkedFor !== null) {
        parkedFor = null;
      } else if (ahead <= travel) {
        travel = ahead;
        parkedFor = 0;
      } else if (ahead < 3) {
        travel = Math.min(travel, Math.max(.35, Math.sqrt(ahead) * 1.6) * delta);
      }
    }
    for (const gate of gates) {
      const ahead = (gate.distance - distance + length) % length;
      if (ahead > 3.2 || signalPhase(gate.intersection, gate.axis, seconds) === "green") continue;
      braking = true;
      travel = Math.min(travel, Math.max(0, ahead - .001), Math.sqrt(2 * speed * ahead) * delta);
    }
    distance = controlled ? (distance + travel) % length : (phase + seconds * speed) % length;
    const t = distance / length;
    route.getPoint(t, position);
    route.getTangent(t, heading);
    actor.position.x = position.x;
    actor.position.z = position.z;
    actor.rotation.y = Math.atan2(heading.x, heading.z);
    return { travel, braking, parkedFor };
  };
}
