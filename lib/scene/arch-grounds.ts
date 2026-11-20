import * as THREE from "three";
import { seededRandom } from "./model-kit";
import type { ModelKit } from "./model-kit";

export const archAxis = 46.3;
export const archX = 129.35;
export const archHalfSpan = 11.78;
const meadowY = .055;
const pondX = 121.0;
const pondOffset = 20.8;
const pondWidth = 5.25;
const pondDepth = 4.25;

function shoreRadius(angle: number) {
  return 1 + .085 * Math.sin(3 * angle + .3) + .038 * Math.cos(5 * angle - .7);
}

function pondDistance(x: number, z: number) {
  const u = (x - pondX) / pondWidth;
  const v = (Math.abs(z - archAxis) - pondOffset) / pondDepth;
  return Math.hypot(u, v) / shoreRadius(Math.atan2(v, u));
}

export function parkRelief(x: number, z: number) {
  const approach = THREE.MathUtils.smoothstep(x, 112, 117) * (1 - THREE.MathUtils.smoothstep(x, 132, 134));
  const glade = THREE.MathUtils.smoothstep(Math.abs(z - archAxis), 8, 17);
  const edge = 1 - THREE.MathUtils.smoothstep(Math.abs(z - archAxis), 26, 30);
  const distance = pondDistance(x, z);
  const hill = (.53 + .24 * Math.sin((x - 115) * .36 + z * .071)) * glade * edge;
  const banks = 1 - THREE.MathUtils.smoothstep(distance, .62, 1.28);
  const footing = Math.hypot(x - archX, Math.abs(z - archAxis) - archHalfSpan);
  const atFooting = THREE.MathUtils.smoothstep(footing, 2.6, 5.7);
  return approach * (hill * (1 - banks) * atFooting - .69 * banks);
}

export function parkMeadow(kit: ModelKit, parent: THREE.Group) {
  const width = 27.42;
  const depth = 87;
  const mesh = new THREE.PlaneGeometry(width, depth, 54, 148).rotateX(-Math.PI / 2);
  mesh.translate(123.33, meadowY, archAxis);
  const positions = mesh.getAttribute("position");
  const uv = mesh.getAttribute("uv");
  const colors = new Float32Array(positions.count * 3);
  const green = new THREE.Color("#77965f");
  const moss = new THREE.Color("#537e65");
  const hay = new THREE.Color("#aca25f");
  const silt = new THREE.Color("#756d51");
  const pigment = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const height = parkRelief(x, z);
    // Leave the level verges below the roads at the west and south edges of the park.
    const verge = (1 - THREE.MathUtils.smoothstep(x, 110, 113)) + THREE.MathUtils.smoothstep(z, 71, 80);
    positions.setY(i, meadowY + height - Math.min(.047, verge * .047));
    uv.setXY(i, x / 5.7, z / 5.7);
    const strata = .5 + .28 * Math.sin(x * .56 + z * .237) + .18 * Math.sin(x * 1.37 - z * .59);
    pigment.copy(green).lerp(moss, Math.max(0, 1 - strata) * .74)
      .lerp(hay, Math.max(0, height * .57 + strata * .37))
      .lerp(silt, THREE.MathUtils.smoothstep(-height, .08, .52) * .7);
    pigment.toArray(colors, i * 3);
  }
  mesh.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  mesh.computeVertexNormals();
  const surface = kit.material("#fbfff5", "grass");
  surface.vertexColors = true;
  const turf = new THREE.Mesh(kit.geometry(mesh), surface);
  turf.receiveShadow = true;
  parent.add(turf);
}

export function reflectingPool(kit: ModelKit, parent: THREE.Group, side: number) {
  const waterline = .008;
  const bank = kit.group(parent, [pondX, 0, archAxis + side * pondOffset]);
  const points = Array.from({ length: 68 }, (_, i) => {
    const angle = i / 68 * Math.PI * 2;
    return new THREE.Vector2(pondWidth * Math.cos(angle) * shoreRadius(angle),
      side * pondDepth * Math.sin(angle) * shoreRadius(angle));
  });
  const deep = new THREE.Color("#23575c");
  const shallows = new THREE.Color("#707f5c");
  const reflection = new THREE.Color("#719f9d");
  const pigment = new THREE.Color();
  // A center vertex lets the basin carry a painted depth gradient independently of the shore.
  const colors: number[] = [];
  const positions = [0, waterline, 0];
  pigment.copy(deep).toArray(colors, 0);
  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    positions.push(x, waterline, y);
    pigment.copy(shallows).lerp(reflection, .38 + .29 * Math.sin(x * .75 - y)).toArray(colors, colors.length);
  }
  const fanGeometry = new THREE.BufferGeometry();
  fanGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  fanGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const indices: number[] = [];
  for (let i = 1; i < points.length; i++) indices.push(0, i, i + 1);
  indices.push(0, points.length, 1);
  fanGeometry.setIndex(side < 0 ? indices : indices.reverse());
  fanGeometry.computeVertexNormals();
  const water = kit.material("#f9fef6");
  water.vertexColors = true;
  const pool = new THREE.Mesh(kit.geometry(fanGeometry), water);
  pool.receiveShadow = true;
  bank.add(pool);
  const random = seededRandom(side > 0 ? 83 : 62);
  for (let i = 0; i < 28; i++) {
    const x = (random() - .5) * 8.3;
    const z = (random() - .5) * 7.1;
    if (pondDistance(pondX + x, bank.position.z + z) > .76) continue;
    const ribbon = kit.ground(bank, x, z, .32 + random() * 1.4, .025 + random() * .048,
      kit.material(i % 2 ? "#699883" : "#86a59a"), waterline + .009);
    ribbon.rotation.z = (random() - .5) * .30;
  }
  for (const home of [.32, 1.87, 3.8, 4.83, 5.81]) {
    for (let i = 0; i < 9; i++) {
      const angle = home + (random() - .5) * .42;
      const radius = shoreRadius(angle) * (1.02 + random() * .17);
      const x = Math.cos(angle) * pondWidth * radius;
      const z = Math.sin(angle) * pondDepth * radius * side;
      const y = meadowY + parkRelief(pondX + x, bank.position.z + z);
      const blade = kit.box(bank, [x, y + .17, z], [.042, .28 + random() * .28, .026],
        kit.material(i % 3 ? "#85936a" : "#b8ad70"));
      blade.rotation.z = (random() - .5) * .72;
      blade.castShadow = false;
    }
  }
}

export function baldCypress(kit: ModelKit, parent: THREE.Group, x: number, z: number, size: number, seed: number) {
  const cypress = kit.group(parent, [x, meadowY + parkRelief(x, z), z], seed * .9);
  cypress.scale.setScalar(size);
  const rand = seededRandom(seed);
  const bark = kit.material("#655643");
  kit.cylinder(cypress, [0, 1.06, 0], .24, 2.12, bark, true);
  kit.contactShadow(cypress, 0, 0, 2.08, 1.68, .015);
  const colors = seed % 4 === 0 ? ["#766243", "#b0804d", "#be9557"] : ["#456856", "#5d866a", "#aaa468"];
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const angle = i * 2.4;
    const spread = .54 * (1 - t);
    const radius = 1.22 * (1 - t * .60);
    const crown = kit.foliage(cypress, [Math.cos(angle) * spread, 1.48 + t * 1.86, Math.sin(angle) * spread],
      [radius, 1.04 + rand() * .3, radius * .84], colors[i % 3]);
    crown.rotation.z = (rand() - .5) * .28;
  }
}

export function westEntry(kit: ModelKit, parent: THREE.Group) {
  const entry = kit.group(parent, [121.85, .085, archAxis]);
  const stone = kit.material("#b5a996", "stone");
  const chrome = kit.material("#e1ddd2");
  const glass = ["#354c60", "#506f81", "#708d95", "#887768"].map((tone) => kit.material(tone));
  const arc = (angle: number, scale: number) => new THREE.Vector2(-Math.cos(angle) * 2.54 * scale, Math.sin(angle) * 4.77 * scale);
  const top = new THREE.Shape();
  const sections = 32;
  for (let i = 0; i <= sections; i++) {
    const angle = Math.PI * (i / sections - .5);
    const point = arc(angle, 1.16);
    if (i === 0) top.moveTo(point.x, -point.y);
    else top.lineTo(point.x, -point.y);
  }
  top.closePath();
  const roof = new THREE.Mesh(kit.geometry(new THREE.ShapeGeometry(top).rotateX(-Math.PI / 2)), chrome);
  roof.position.y = .82;
  roof.castShadow = true;
  roof.receiveShadow = true;
  entry.add(roof);

  const canopy = new Float32Array(sections * 18);
  const glaze = new Float32Array(canopy.length);
  const pigments = ["#587785", "#678b91", "#86a3a4", "#b3aaa0"].map((tone) => new THREE.Color(tone));
  for (let i = 0; i < sections; i++) {
    const start = Math.PI * (i / sections - .5);
    const end = Math.PI * ((i + 1) / sections - .5);
    const offset = i * 18;
    const bounds = [arc(start, 1.109), arc(end, 1.109), arc(start, .72), arc(end, .72)];
    for (const [j, k] of [0, 1, 2, 1, 3, 2].entries()) {
      const p = bounds[k];
      canopy.set([p.x, .827, p.y], offset + j * 3);
      pigments[(i + (k >= 2 ? 1 : 0)) % pigments.length].toArray(glaze, offset + j * 3);
    }
  }
  const canopyGeometry = new THREE.BufferGeometry();
  canopyGeometry.setAttribute("position", new THREE.BufferAttribute(canopy, 3));
  canopyGeometry.setAttribute("color", new THREE.BufferAttribute(glaze, 3));
  canopyGeometry.computeVertexNormals();
  const canopyMaterial = kit.material("#f7f5ef");
  canopyMaterial.vertexColors = true;
  // The canopy is a thin glass band with a separate metal frame.
  canopyMaterial.side = THREE.DoubleSide;
  const glazing = new THREE.Mesh(kit.geometry(canopyGeometry), canopyMaterial);
  entry.add(glazing);

  for (let i = 0; i < sections; i++) {
    const a = arc(Math.PI * (i / sections - .5), 1);
    const b = arc(Math.PI * ((i + 1) / sections - .5), 1);
    const x = (a.x + b.x) / 2, z = (a.y + b.y) / 2;
    const direction = -Math.atan2(b.y - a.y, b.x - a.x);
    const frame = kit.group(entry, [x, 0, z], direction);
    const span = a.distanceTo(b);
    kit.box(frame, [0, .064, 0], [span + .018, .13, .13], stone);
    kit.box(frame, [0, .44, 0], [span + .013, .64, .055], glass[(i + Math.floor(i / 6)) % glass.length]).castShadow = false;
    kit.box(frame, [-span / 2, .44, .018], [.037, .68, .08], chrome).castShadow = false;
    kit.box(frame, [0, .793, .012], [span + .03, .057, .075], chrome);
  }
  kit.box(entry, [.035, .4, 0], [.15, .8, 9.52], stone);
}
