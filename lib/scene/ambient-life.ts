import * as THREE from "three";

/** Cheap ambient motion: one instanced flock over the nearest park and a handful of drifting autumn leaves. */
export function createAmbientLife(scene: THREE.Scene, options: { birds: number; leaves: number }) {
  const group = new THREE.Group();
  group.name = "Ambient life";
  scene.add(group);
  const dummy = new THREE.Object3D();

  // A bird is a body sliver plus two wings; wing tips carry weight 1 and flap in the vertex shader per instance.
  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, .22, -.07, 0, -.16, .07, 0, -.16,
    0, 0, .06, -.5, .02, -.08, 0, 0, -.12,
    0, 0, .06, 0, 0, -.12, .5, .02, -.08,
  ], 3));
  birdGeometry.setAttribute("wing", new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1], 1));
  birdGeometry.computeVertexNormals();
  // Transparent double-sided materials normally draw twice (back faces, then front); these are flat slivers, so one
  // pass looks the same at half the draws.
  const birdMaterial = new THREE.MeshBasicMaterial({ color: "#4a4153", side: THREE.DoubleSide, transparent: true, opacity: .92, depthWrite: false,
    forceSinglePass: true });
  const flap = { value: 0 };
  birdMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.flapTime = flap;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float wing;\nuniform float flapTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
float seed = float(gl_InstanceID) * 1.731;
transformed.y += sin(flapTime * 11.0 + seed) * .28 * wing;`);
  };
  const birds = options.birds ? new THREE.InstancedMesh(birdGeometry, birdMaterial, options.birds) : null;
  if (birds) {
    birds.frustumCulled = false;
    group.add(birds);
  }

  const leafGeometry = new THREE.PlaneGeometry(.17, .12);
  const leafMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: .95, depthWrite: false,
    forceSinglePass: true });
  const leaves = options.leaves ? new THREE.InstancedMesh(leafGeometry, leafMaterial, options.leaves) : null;
  const leafSeeds = Array.from({ length: options.leaves }, (_, i) => ({
    x: (Math.sin(i * 91.7) * .5 + .5) * 34 - 17, z: (Math.sin(i * 37.3) * .5 + .5) * 34 - 17,
    speed: .32 + (Math.sin(i * 13.1) * .5 + .5) * .3, offset: i * 1.37, spin: .8 + (i % 5) * .3,
  }));
  if (leaves) {
    const palette = ["#d98a3d", "#c8642f", "#e7b24c", "#a9532e", "#8fa04f"].map((color) => new THREE.Color(color));
    for (let i = 0; i < options.leaves; i++) leaves.setColorAt(i, palette[i % palette.length]);
    leaves.frustumCulled = false;
    group.add(leaves);
  }

  const flock = new THREE.Vector3(0, 0, 0);
  const flockTarget = new THREE.Vector3(0, 0, 0);
  const center = new THREE.Vector3();
  let visibleBirds = 1;

  function update(time: number, focus: THREE.Vector3, night: number) {
    center.copy(focus);
    flock.lerp(flockTarget, .02);
    visibleBirds = THREE.MathUtils.clamp(1 - (night - .55) * 3, 0, 1);
    if (birds) {
      birds.visible = visibleBirds > .02;
      birdMaterial.opacity = .92 * visibleBirds;
      flap.value = time;
      const count = birds.count;
      for (let i = 0; i < count; i++) {
        const lane = i % 3;
        const speed = .28 + lane * .035;
        const angle = time * speed + i * (Math.PI * 2 / count) + Math.sin(time * .3 + i) * .12;
        const radius = 7.5 + lane * 1.6 + Math.sin(time * .5 + i * 1.3) * .8;
        const x = flock.x + Math.cos(angle) * radius;
        const z = flock.z + Math.sin(angle) * radius * .72;
        const y = 12.5 + lane * .7 + Math.sin(time * .8 + i * 2.1) * .45;
        dummy.position.set(x, y, z);
        dummy.lookAt(x - Math.sin(angle) * radius, y, z + Math.cos(angle) * radius * .72);
        dummy.scale.setScalar(.9 + (i % 4) * .08);
        dummy.updateMatrix();
        birds.setMatrixAt(i, dummy.matrix);
      }
      birds.instanceMatrix.needsUpdate = true;
    }
    if (leaves) {
      for (let i = 0; i < leafSeeds.length; i++) {
        const seed = leafSeeds[i];
        const cycle = 7.5 / seed.speed;
        const t = ((time + seed.offset) % cycle) / cycle;
        const y = 6.2 * (1 - t) + .05;
        const sway = Math.sin(time * 1.6 + seed.offset) * .9;
        dummy.position.set(center.x + seed.x + sway + t * 2.2, y, center.z + seed.z + Math.cos(time * 1.1 + seed.offset) * .5);
        dummy.rotation.set(time * seed.spin, time * seed.spin * .7, Math.sin(time * 2 + seed.offset));
        dummy.scale.setScalar(t > .97 ? 0 : 1);
        dummy.updateMatrix();
        leaves.setMatrixAt(i, dummy.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    update,
    /** Re-home the flock over a new district's park. */
    setFlockCenter(x: number, z: number, immediate = false) {
      flockTarget.set(x, 0, z);
      if (immediate) flock.copy(flockTarget);
    },
    setVisible(visible: boolean) { group.visible = visible; },
    dispose() {
      group.removeFromParent();
      birds?.dispose();
      leaves?.dispose();
      birdGeometry.dispose();
      birdMaterial.dispose();
      leafGeometry.dispose();
      leafMaterial.dispose();
    },
  };
}
