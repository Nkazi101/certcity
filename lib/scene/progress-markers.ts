import * as THREE from "three";
import type { Landmark } from "./sites";
import type { SiteEffect, WorldFx } from "./world-fx";

/** Place states as rendered by the city. Mirrors lib/world-progress.ts without importing curriculum code into the scene. */
export type PlaceState = "locked" | "available" | "in-progress" | "completed" | "mastered";
export type SceneProgress = { places: Record<string, PlaceState>; next: string | null; benchmarks: readonly string[] };

/**
 * The single reserved accent. In the world it appears only on pennants and rooftop lights for mastered places and on
 * the skyline beacon for a met readiness benchmark, so it always means "mastered".
 */
export const masteryAccent = "#5ef0d6";
const beaconWarm = "#ffd27c";

export function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const paint = canvas.getContext("2d")!;
  const gradient = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#ffffffff");
  gradient.addColorStop(.25, "#ffffff9a");
  gradient.addColorStop(.6, "#ffffff26");
  gradient.addColorStop(1, "#ffffff00");
  paint.fillStyle = gradient;
  paint.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function beamMaterial(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    // Additive light is order-independent, so the open cylinder needs no separate back-face pass.
    forceSinglePass: true,
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: .5 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 color; uniform float strength; varying vec2 vUv;
void main() {
  float rise = pow(1.0 - vUv.y, 1.6);
  float edge = 1.0 - abs(vUv.x * 2.0 - 1.0);
  gl_FragColor = vec4(color * strength * rise * (.35 + .65 * edge), 1.0);
}`,
  });
}

export function createProgressMarkers(scene: THREE.Scene, landmarks: readonly Landmark[], fx: WorldFx) {
  const group = new THREE.Group();
  group.name = "Progress markers";
  scene.add(group);
  const glow = glowTexture();
  const poleGeometry = new THREE.CylinderGeometry(.035, .045, 1.5, 6).translate(0, .75, 0);
  const flagGeometry = new THREE.PlaneGeometry(.9, .46, 6, 1).translate(.45, 0, 0);
  {
    // Taper the plane into a swallow-tail pennant.
    const position = flagGeometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      position.setY(i, position.getY(i) * (1 - x / .9 * .78));
    }
  }
  const beamGeometry = new THREE.CylinderGeometry(.62, .62, 16, 18, 1, true).translate(0, 8, 0);
  const ringGeometry = new THREE.RingGeometry(.86, 1, 48).rotateX(-Math.PI / 2);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: "#4b544f", roughness: .6 });
  const accentFlag = new THREE.MeshStandardMaterial({ color: masteryAccent, emissive: masteryAccent, emissiveIntensity: .55,
    roughness: .55, side: THREE.DoubleSide });
  const warmLantern = new THREE.SpriteMaterial({ map: glow, color: "#ffc46e", transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: .0 });
  const accentGlow = new THREE.SpriteMaterial({ map: glow, color: masteryAccent, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: .85 });
  const nextBeam = beamMaterial(beaconWarm);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: beaconWarm, transparent: true, depthWrite: false, opacity: .6,
    blending: THREE.AdditiveBlending });
  const archBeam = beamMaterial(masteryAccent);
  archBeam.uniforms.strength.value = .7;

  type Live = { flag?: THREE.Mesh; flagBase?: Float32Array; ring?: THREE.Mesh; beam?: THREE.Mesh; lights: THREE.Sprite[] };
  let live: Live[] = [];
  let arch: { beam: THREE.Mesh; light: THREE.Sprite } | null = null;
  let night = 0;
  let calm = false;
  let lastKey = "";

  function rooftop(site: Landmark) {
    const { bounds } = site;
    return new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y, (bounds.min.z + bounds.max.z) / 2);
  }

  function clear() {
    for (const item of live) {
      item.flag?.geometry.dispose();
    }
    group.clear();
    live = [];
    arch = null;
  }

  function set(progress: SceneProgress) {
    const key = JSON.stringify(progress);
    if (key === lastKey) return false;
    lastKey = key;
    clear();
    const effects: SiteEffect[] = [];
    for (const site of landmarks) {
      const state = progress.places[site.id];
      const isNext = progress.next === site.id;
      if (!state && !isNext) continue;
      const top = rooftop(site);
      const item: Live = { lights: [] };
      if (state === "locked") effects.push({ bounds: site.bounds, desaturate: .5, glow: 0 });
      if (state === "in-progress") effects.push({ bounds: site.bounds, desaturate: 0, glow: .35 });
      if (state === "completed" || state === "mastered") {
        effects.push({ bounds: site.bounds, desaturate: 0, glow: 1 });
        // A warm rooftop lantern: completed work is "lit up" once evening comes.
        const lantern = new THREE.Sprite(warmLantern);
        lantern.position.copy(top).add(new THREE.Vector3(0, .35, 0));
        lantern.scale.setScalar(2.2);
        lantern.renderOrder = 3;
        group.add(lantern);
      }
      if (state === "mastered") {
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.copy(top);
        pole.castShadow = true;
        const flag = new THREE.Mesh(flagGeometry.clone(), accentFlag);
        flag.position.set(.03, 1.22, 0);
        pole.add(flag);
        const light = new THREE.Sprite(accentGlow);
        light.position.set(0, 1.56, 0);
        light.scale.setScalar(1.15);
        light.renderOrder = 3;
        pole.add(light);
        group.add(pole);
        item.flag = flag;
        item.flagBase = Float32Array.from(flag.geometry.getAttribute("position").array as ArrayLike<number>);
        item.lights.push(light);
      }
      if (isNext && state !== "completed" && state !== "mastered") {
        const base = new THREE.Vector3((site.bounds.min.x + site.bounds.max.x) / 2, .09, (site.bounds.min.z + site.bounds.max.z) / 2);
        const beam = new THREE.Mesh(beamGeometry, nextBeam);
        beam.position.copy(base);
        beam.renderOrder = 4;
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        const radius = Math.max(site.bounds.max.x - site.bounds.min.x, site.bounds.max.z - site.bounds.min.z) * .5 + .8;
        ring.position.copy(base);
        ring.userData.radius = Math.min(radius, 9);
        ring.renderOrder = 4;
        group.add(beam, ring);
        item.beam = beam;
        item.ring = ring;
      }
      live.push(item);
    }
    fx.setSites(effects);
    const archSite = landmarks.find(({ id }) => id === "gateway-arch");
    if (archSite && progress.benchmarks.length) {
      const beam = new THREE.Mesh(beamGeometry, archBeam);
      beam.position.copy(archSite.anchor).add(new THREE.Vector3(0, .2, 0));
      beam.scale.set(.55, 1.6, .55);
      beam.renderOrder = 4;
      const light = new THREE.Sprite(accentGlow);
      light.position.copy(archSite.anchor).add(new THREE.Vector3(0, .5, 0));
      light.scale.setScalar(4.2);
      light.renderOrder = 4;
      group.add(beam, light);
      arch = { beam, light };
    }
    return true;
  }

  function update(time: number) {
    const pulse = calm ? .5 : .5 + .5 * Math.sin(time * 1.9);
    warmLantern.opacity = THREE.MathUtils.smoothstep(night, .25, .8) * .75;
    accentFlag.emissiveIntensity = .35 + night * .5;
    nextBeam.uniforms.strength.value = (.28 + pulse * .2) * (1 + night * .5);
    ringMaterial.opacity = calm ? .35 : .55 * (1 - ((time * .45) % 1));
    for (const item of live) {
      if (item.ring) item.ring.scale.setScalar(item.ring.userData.radius * (calm ? .8 : .55 + .45 * ((time * .45) % 1)));
      for (const light of item.lights) light.scale.setScalar(1.05 + pulse * .25 + night * .5);
      if (item.flag && item.flagBase && !calm) {
        const position = item.flag.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < position.count; i++) {
          const x = item.flagBase[i * 3];
          position.setZ(i, Math.sin(time * 5.2 - x * 6) * .07 * (x / .9));
        }
        position.needsUpdate = true;
      }
    }
    if (arch) {
      arch.beam.visible = true;
      archBeam.uniforms.strength.value = (.45 + pulse * .2) * (1 + night * .6);
      arch.light.scale.setScalar(3.6 + pulse * .9 + night * 2);
    }
  }

  return {
    set,
    update,
    setNight(value: number) { night = value; },
    setCalm(value: boolean) { calm = value; },
    get animated() { return live.some(({ flag, ring }) => flag || ring) || !!arch; },
    dispose() {
      clear();
      group.removeFromParent();
      [poleGeometry, flagGeometry, beamGeometry, ringGeometry].forEach((geometry) => geometry.dispose());
      [poleMaterial, accentFlag, warmLantern, accentGlow, nextBeam, ringMaterial, archBeam].forEach((material) => material.dispose());
      glow.dispose();
    },
  };
}
