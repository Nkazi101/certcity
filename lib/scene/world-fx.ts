import * as THREE from "three";

/**
 * One small shader extension shared by every city material. It adds three things without new draw calls:
 * - window and lamp glow that fades in at dusk (per-vertex weights written by CityBatches, or material names for GLB art)
 * - wind sway on foliage (merged canopies and instanced GLB trees keep their batching/instancing)
 * - per-place progress tinting: locked places desaturate, finished places keep every window lit after dark
 */
export const maxSites = 40;

export type SiteEffect = { bounds: THREE.Box3; desaturate: number; glow: number };

const glowNames = /^(Glass|Glass light|Glass bright|Amber glass|Cafe glass|Cafe window|Lit window|Olive glass (blue|sky))$/;
const lampNames = /^(Bulb|Library lamp)$/;
const leafNames = /^Leaf /;

export type WorldFx = ReturnType<typeof createWorldFx>;

/** Materials whose names or flags select a shader effect; model compaction must not fold them into other materials. */
export function hasNamedEffect(material: THREE.Material) {
  return Boolean(material.userData.fxSway) || leafNames.test(material.name) || lampNames.test(material.name) || glowNames.test(material.name);
}

/** The shader mode a material's name or flags select: 0 none, 1 window glow, 2 lamp, 3 leaf sway, 4 height sway. */
export function namedEffectMode(material: THREE.Material) {
  if (material.userData.fxSway === "height") return 4;
  if (leafNames.test(material.name)) return 3;
  if (lampNames.test(material.name)) return 2;
  if (glowNames.test(material.name)) return 1;
  return 0;
}

export function createWorldFx() {
  const uniforms = {
    fxTime: { value: 0 },
    fxWind: { value: 1 },
    fxNight: { value: 0 },
    fxOccupancy: { value: .35 },
    fxWindowColor: { value: new THREE.Color("#ffb45e") },
    fxSiteCount: { value: 0 },
    fxSiteRects: { value: Array.from({ length: maxSites }, () => new THREE.Vector4()) },
    fxSiteState: { value: Array.from({ length: maxSites }, () => new THREE.Vector2()) },
  };
  const patched = new WeakSet<THREE.Material>();

  const mode = namedEffectMode;

  function patch(material: THREE.MeshStandardMaterial) {
    if (patched.has(material)) return;
    patched.add(material);
    material.defines = { ...material.defines, FX_MODE: mode(material) };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
attribute vec3 fx;
uniform float fxTime;
uniform float fxWind;
uniform float fxNight;
uniform float fxOccupancy;
uniform int fxSiteCount;
uniform vec4 fxSiteRects[${maxSites}];
uniform vec2 fxSiteState[${maxSites}];
varying vec2 vFx;
float fxHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
vec4 fxWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
fxWorld = instanceMatrix * fxWorld;
#endif
fxWorld = modelMatrix * fxWorld;
float fxGlow = fx.x;
float fxRand = fx.y;
float fxSway = fx.z;
#if FX_MODE == 1
fxGlow = 1.0;
fxRand = fxHash(floor(fxWorld.xyz * vec3(1.2, 1.05, 1.2)));
#elif FX_MODE == 2
fxGlow = 1.6;
fxRand = 0.0;
#elif FX_MODE == 3
fxSway = 1.0;
#elif FX_MODE == 4
fxSway = smoothstep(.9, 3.4, fxWorld.y);
#endif
if (fxSway > 0.0 && fxWind > 0.0) {
  float fxPhase = fxTime * 1.55 + fxWorld.x * .29 + fxWorld.z * .23;
  float fxGust = .6 + .4 * sin(fxTime * .41 + fxWorld.x * .043 - fxWorld.z * .031);
  transformed.x += sin(fxPhase + fxWorld.y * .9) * .042 * fxSway * fxWind * fxGust;
  transformed.z += cos(fxPhase * .83 + fxWorld.y * .7) * .03 * fxSway * fxWind * fxGust;
}
float fxDesaturate = 0.0;
float fxBoost = 0.0;
for (int i = 0; i < ${maxSites}; i++) {
  if (i >= fxSiteCount) break;
  vec4 fxRect = fxSiteRects[i];
  if (fxWorld.x >= fxRect.x && fxWorld.x <= fxRect.z && fxWorld.z >= fxRect.y && fxWorld.z <= fxRect.w) {
    fxDesaturate = fxSiteState[i].x;
    fxBoost = fxSiteState[i].y;
    break;
  }
}
float fxLit = fxGlow > 0.0 ? max(step(fxRand, fxOccupancy), step(.5, fxBoost)) : 0.0;
vFx = vec2(fxGlow * fxLit * fxNight * (1.0 + fxBoost * .75), fxDesaturate);`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
uniform vec3 fxWindowColor;
varying vec2 vFx;`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += fxWindowColor * vFx.x;`)
        .replace("#include <opaque_fragment>", `outgoingLight = mix(outgoingLight, vec3(dot(outgoingLight, vec3(.2126, .7152, .0722))) * .94, vFx.y);
#include <opaque_fragment>`);
    };
    material.needsUpdate = true;
  }

  /** Patch every standard material below root. Call again after late GLB art arrives; patched materials are skipped. */
  function patchScene(root: THREE.Object3D) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) patch(material);
      }
    });
  }

  function setSites(sites: readonly SiteEffect[]) {
    const count = Math.min(sites.length, maxSites);
    for (let i = 0; i < count; i++) {
      const { bounds, desaturate, glow } = sites[i];
      uniforms.fxSiteRects.value[i].set(bounds.min.x - .5, bounds.min.z - .5, bounds.max.x + .5, bounds.max.z + .5);
      uniforms.fxSiteState.value[i].set(desaturate, glow);
    }
    uniforms.fxSiteCount.value = count;
  }

  return { uniforms, patchScene, setSites };
}
