import * as THREE from "three";
import { seededRandom } from "./model-kit";
import type { ModelKit } from "./model-kit";

export function gardenBorder(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, length: number,
  depth: number, angle: number, seed: number, y = .055) {
  const bed = kit.group(parent, [x, y, z], angle);
  const random = seededRandom(seed);
  const soil = kit.material("#827353");
  const foliage = ["#5c8447", "#78934d", "#6e9e52", "#91a35c"];
  const flowers = ["#d8819b", "#efc157", "#a779ac", "#f1dfad"];
  kit.cylinder(bed, [0, .007, 0], length, .02, soil).scale.z = depth;
  for (let i = 0; i < Math.ceil(length * 3); i++) {
    const px = length * ((i + .45) / Math.ceil(length * 3) - .5) * .94;
    const pz = (random() - .5) * depth * .68 * Math.sqrt(1 - (px * 2 / length) ** 2);
    const crown = .39 + random() * .22;
    kit.foliage(bed, [px, crown * .29, pz], [crown, crown * .54, crown * .78], foliage[i % foliage.length]);
    if (i % 3 === 0) {
      for (let sprig = 0; sprig < 3; sprig++) {
        const offset = (sprig - 1) * .101;
        const height = .23 + random() * .16;
        const stem = kit.box(bed, [px + offset, height * .48, pz - .04], [.022, height, .021],
          kit.material(foliage[(i + sprig) % foliage.length]));
        stem.rotation.z = offset * 1.8;
        const bloom = kit.material(flowers[(seed + Math.floor(i / 4)) % flowers.length]);
        kit.sphere(bed, [px + offset, height, pz - .04], [.135, .067, .131], bloom);
        kit.sphere(bed, [px + offset, height + .034, pz - .04], [.046, .034, .046], kit.material("#af8650"));
      }
    }
  }
}

export function parkBench(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, angle: number, y = .085) {
  const bench = kit.group(parent, [x, y, z], angle);
  const iron = kit.material("#465c54");
  const wood = kit.material("#a87147");
  kit.contactShadow(bench, 0, 0, 1.95, .83, .006);
  for (const side of [-1, 1]) {
    kit.box(bench, [side*.58, .195, 0], [.084, .388, .43], iron, true);
    kit.box(bench, [side*.58, .422, -.187], [.062, .525, .057], iron, true);
    kit.box(bench, [side*.59, .538, -.06], [.08, .048, .352], iron, true);
  }
  for (let i = 0; i < 4; i++) kit.box(bench, [0, .425, .152 - i*.1], [1.57, .049, .085], wood, true);
  for (const h of [.54,.649]) kit.box(bench, [0, h, -.188], [1.58, .078, .058], wood, true);
  kit.box(bench, [0, .653, -.152], [.23, .058, .012], kit.material("#c9a76a"));
}

export function waterRipples(kit: ModelKit, parent: THREE.Object3D,
  spots: readonly [x: number, elevation: number, z: number, maxRadius: number][]) {
  const rippleGeometry = kit.geometry(new THREE.RingGeometry(.94, 1, 26, 1).rotateX(-Math.PI / 2));
  const gleam = new THREE.Color("#e1f5e3");
  const ripples = spots.map(([x, y, z, radius], i) => {
    const material = new THREE.MeshBasicMaterial({ color: gleam, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(rippleGeometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return { mesh, material, radius, offset: i * .27 };
  });
  return {
    update(time: number) {
      for (const { mesh, material, radius, offset } of ripples) {
        const age = (time * .63 + offset) % 1;
        mesh.scale.setScalar(.12 + radius * age);
        material.opacity = Math.sin(Math.PI * age) * .39;
      }
    },
    dispose() {
      for (const { mesh, material } of ripples) {
        material.dispose();
        mesh.removeFromParent();
      }
    },
  };
}
