import * as THREE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { modelLoader } from "./gltf";

/**
 * Runtime portrait studio. The conversation portraits used to share one mannequin body; here each named person is
 * rendered from the city's character models with their own skin tone, hair, clothing and accessory, once per visit,
 * into a small transparent image.
 */
type Base = "sofia" | "micah" | "riley" | "jules";
type Accessory = "glasses" | "round-glasses" | "headset" | "bun" | "earrings" | "beanie" | "scarf" | "lanyard";
type Look = {
  base: Base;
  skin: string;
  hair: string;
  /** Main garment (coat, shirt or apron, depending on the base model). */
  top: string;
  /** Second garment layer: sleeves, shirt under an apron, or the coat lining. */
  under?: string;
  trousers?: string;
  cap?: string | null;
  accessories: Accessory[];
  /** Gentle head turn in radians so a row of portraits does not look stamped. */
  turn: number;
  /** Clip time to pose from, in seconds. */
  pose?: number;
  clip?: string;
};

export const portraitLooks: Record<string, Look> = {
  arun: { base: "riley", skin: "#9a6646", hair: "#1d1715", top: "#3f7a76", under: "#2f5c5b", trousers: "#2f3b47", accessories: ["round-glasses", "lanyard"], turn: -.22, clip: "Talk", pose: .4 },
  jo: { base: "jules", skin: "#c48b62", hair: "#3a2418", top: "#c9673e", under: "#9d4b2d", trousers: "#34403c", cap: "#2f5a52", accessories: ["headset"], turn: .18, clip: "Talk", pose: 1.1 },
  jordan: { base: "sofia", skin: "#f0c3a0", hair: "#a4532c", top: "#d9a441", under: "#b88430", trousers: "#3d4a5e", accessories: ["scarf"], turn: .2 },
  lina: { base: "micah", skin: "#6e4430", hair: "#120d0b", top: "#7f9a6a", under: "#efe1c6", trousers: "#3b3330", cap: null, accessories: ["bun", "earrings"], turn: -.16 },
  micah: { base: "micah", skin: "#b07850", hair: "#2a1a12", top: "#c88c3c", under: "#d8b06a", trousers: "#2f3a33", accessories: [], turn: .14 },
  nia: { base: "sofia", skin: "#5a3626", hair: "#0f0b0a", top: "#7a4a78", under: "#5e365c", trousers: "#2b2d3a", accessories: ["headset", "earrings"], turn: -.2 },
  nolan: { base: "riley", skin: "#e8c2a4", hair: "#a9a39b", top: "#7b5a3c", under: "#5f4430", trousers: "#3f3a33", accessories: ["glasses"], turn: .22, clip: "Idle", pose: .8 },
  priya: { base: "jules", skin: "#a8714d", hair: "#17100d", top: "#2f4064", under: "#24324f", trousers: "#262b38", cap: null, accessories: ["earrings", "bun"], turn: -.12, clip: "Idle", pose: 1.6 },
};

const basePaths: Record<Base, string> = {
  sofia: "/models/olive-corner/sofia.glb",
  micah: "/models/olive-corner/micah.glb",
  riley: "/models/st-louis/riley.glb",
  jules: "/models/st-louis/jules.glb",
};

// Props that belong to the street scenes, not to a head-and-shoulders portrait.
const hidden = /(Granite base|Coffee cup|Cup sleeve|Smart phone|Phone screen|tote|Tea|Cream ceramic|Trolley cream)/i;

const width = 360;
const height = 416;
let renderer: THREE.WebGLRenderer | null = null;
let releaseTimer = 0;
const models = new Map<Base, Promise<GLTF>>();
const renders = new Map<string, Promise<string>>();

function load(base: Base) {
  let model = models.get(base);
  if (!model) {
    model = modelLoader().loadAsync(basePaths[base]);
    models.set(base, model);
  }
  return model;
}

function studioRenderer() {
  window.clearTimeout(releaseTimer);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
  }
  return renderer;
}

/** The studio context is only needed for a moment; release it so it never competes with the city's context. */
function scheduleRelease() {
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer = null;
  }, 4000);
}

function recolor(root: THREE.Object3D, look: Look) {
  const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (hidden.test(object.name) || hidden.test((object.material as THREE.Material).name)) {
      object.visible = false;
      return;
    }
    const source = object.material as THREE.MeshStandardMaterial;
    let material = materials.get(source);
    if (!material) {
      material = source.clone();
      materials.set(source, material);
      const name = source.name.toLowerCase();
      const tint = (color: string, keepMap = false) => {
        material!.color.set(color);
        if (!keepMap) material!.map = null;
      };
      if (/ skin$/.test(name)) tint(look.skin);
      else if (/ blush$/.test(name)) tint("#" + new THREE.Color(look.skin).lerp(new THREE.Color("#b54f48"), .38).getHexString());
      else if (/ hair$/.test(name)) tint(look.hair);
      else if (/(coat|shirt)$/.test(name)) tint(look.top);
      else if (/(sleeve)$/.test(name)) tint(look.under ?? look.top);
      else if (/apron$/.test(name)) tint(look.top);
      else if (/trousers$/.test(name) && look.trousers) tint(look.trousers);
      else if (/cap$/.test(name)) {
        if (look.cap === null) object.visible = false;
        else if (look.cap) tint(look.cap);
      } else if (/apron piping$/.test(name)) tint(look.under ?? "#e8d9b8");
      material.roughness = Math.max(material.roughness, .55);
    }
    if (look.cap === null && /cap$/i.test(source.name)) object.visible = false;
    object.material = material;
    object.frustumCulled = false;
  });
  return [...materials.values()];
}

function bone(root: THREE.Object3D, name: string) {
  let found: THREE.Object3D | undefined;
  root.traverse((object) => { if (!found && object.name === name) found = object; });
  return found;
}

function accessorize(root: THREE.Object3D, look: Look, head: THREE.Box3) {
  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  const group = new THREE.Group();
  root.add(group);
  const size = head.getSize(new THREE.Vector3());
  const center = head.getCenter(new THREE.Vector3());
  const r = Math.min(size.x, size.z) / 2;
  const make = (geometry: THREE.BufferGeometry, color: string, rough = .5, metal = 0) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    disposables.push(geometry, material);
    return new THREE.Mesh(geometry, material);
  };
  const front = center.z + r * .98;
  const eyeY = center.y + size.y * .02;
  for (const accessory of look.accessories) {
    if (accessory === "glasses" || accessory === "round-glasses") {
      const round = accessory === "round-glasses";
      for (const side of [-1, 1]) {
        const rim = make(new THREE.TorusGeometry(r * (round ? .24 : .22), r * .035, 6, round ? 20 : 4), round ? "#2b2523" : "#6b4a2e", .4, .2);
        if (!round) rim.rotation.z = Math.PI / 4;
        rim.position.set(center.x + side * r * .36, eyeY, front);
        group.add(rim);
      }
      const bridge = make(new THREE.BoxGeometry(r * .25, r * .04, r * .04), "#2b2523");
      bridge.position.set(center.x, eyeY + r * .04, front);
      group.add(bridge);
    }
    if (accessory === "headset") {
      const band = make(new THREE.TorusGeometry(r * 1.06, r * .06, 6, 24, Math.PI), "#2c3236", .45, .3);
      band.position.set(center.x, center.y + size.y * .02, center.z);
      group.add(band);
      for (const side of [-1, 1]) {
        const cup = make(new THREE.CylinderGeometry(r * .24, r * .24, r * .16, 16), "#3a4248", .5);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(center.x + side * r * 1.04, center.y - size.y * .05, center.z);
        group.add(cup);
      }
      const mic = make(new THREE.CylinderGeometry(r * .035, r * .035, r * .8, 6), "#2c3236");
      mic.rotation.set(Math.PI / 2, 0, -.6);
      mic.position.set(center.x + r * .78, center.y - size.y * .2, center.z + r * .42);
      group.add(mic);
      const tip = make(new THREE.SphereGeometry(r * .08, 10, 8), "#5ec7b0", .4);
      tip.position.set(center.x + r * .5, center.y - size.y * .27, center.z + r * .78);
      group.add(tip);
    }
    if (accessory === "bun") {
      const bun = make(new THREE.SphereGeometry(r * .42, 16, 12), look.hair, .7);
      bun.position.set(center.x, center.y + size.y * .42, center.z - r * .55);
      group.add(bun);
    }
    if (accessory === "beanie") {
      const beanie = make(new THREE.SphereGeometry(r * 1.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), "#b8543f", .9);
      beanie.position.set(center.x, center.y + size.y * .14, center.z);
      group.add(beanie);
    }
    if (accessory === "earrings") {
      for (const side of [-1, 1]) {
        const ring = make(new THREE.SphereGeometry(r * .09, 10, 8), "#e4b75a", .3, .6);
        ring.position.set(center.x + side * r * .98, center.y - size.y * .16, center.z + r * .05);
        group.add(ring);
      }
    }
    if (accessory === "scarf") {
      const scarf = make(new THREE.TorusGeometry(r * .78, r * .2, 10, 24), "#3f6f8a", .9);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.set(center.x, head.min.y - r * .05, center.z + r * .05);
      group.add(scarf);
    }
    if (accessory === "lanyard") {
      const badge = make(new THREE.BoxGeometry(r * .5, r * .65, r * .05), "#f3ead4", .6);
      badge.position.set(center.x + r * .25, head.min.y - size.y * .95, center.z + r * 1.05);
      group.add(badge);
    }
  }
  return disposables;
}

async function compose(id: string, look: Look) {
  const gltf = await load(look.base);
  const root = cloneSkeleton(gltf.scene);
  const scene = new THREE.Scene();
  scene.add(root);
  const materials = recolor(root, look);
  const mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations.find(({ name }) => name === look.clip) ?? gltf.animations.find(({ name }) => name === "Idle") ?? gltf.animations[0];
  if (clip) {
    mixer.clipAction(clip).play();
    mixer.setTime(look.pose ?? .3);
  }
  root.updateMatrixWorld(true);
  const headBone = bone(root, "Head");
  // Measure the head from the skin and hair vertices that the head bone drives.
  const headBox = new THREE.Box3();
  const bodyBox = new THREE.Box3();
  const vertex = new THREE.Vector3();
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh) || !object.visible) return;
    const position = object.geometry.getAttribute("position");
    const skinIndex = object.geometry.getAttribute("skinIndex");
    const skinWeight = object.geometry.getAttribute("skinWeight");
    const headSlot = headBone ? object.skeleton.bones.indexOf(headBone as THREE.Bone) : -1;
    const name = (object.material as THREE.Material).name.toLowerCase();
    for (let i = 0; i < position.count; i += 2) {
      object.getVertexPosition(i, vertex);
      vertex.applyMatrix4(object.matrixWorld);
      bodyBox.expandByPoint(vertex);
      if (headSlot < 0 || !/(skin|hair)$/.test(name)) continue;
      for (let k = 0; k < 4; k++) {
        if (skinIndex.getComponent(i, k) === headSlot && skinWeight.getComponent(i, k) > .5) {
          headBox.expandByPoint(vertex);
          break;
        }
      }
    }
  });
  if (headBox.isEmpty()) headBox.setFromCenterAndSize(new THREE.Vector3(0, bodyBox.max.y - .15, 0), new THREE.Vector3(.3, .3, .3));
  const disposables = accessorize(root, look, headBox);
  // Turn the whole figure a little so each portrait has its own three-quarter view.
  const headCenter = headBox.getCenter(new THREE.Vector3());
  const headSize = headBox.getSize(new THREE.Vector3());
  root.rotation.y = look.turn;
  root.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(20, width / height, .05, 50);
  const frameHeight = headSize.y * 2.45;
  const distance = frameHeight / 2 / Math.tan(THREE.MathUtils.degToRad(10));
  const focus = new THREE.Vector3(headCenter.x, headCenter.y - headSize.y * .5, headCenter.z);
  camera.position.set(focus.x, focus.y + headSize.y * .35, focus.z + distance);
  camera.lookAt(focus);

  scene.add(new THREE.HemisphereLight("#fff2dc", "#7d6a7a", 1.5));
  const key = new THREE.DirectionalLight("#ffe2bd", 2.6);
  key.position.set(focus.x - 1.4, focus.y + 1.6, focus.z + 2.2);
  const rim = new THREE.DirectionalLight("#b9d4ff", 1.9);
  rim.position.set(focus.x + 1.8, focus.y + 1.1, focus.z - 1.6);
  const fill = new THREE.DirectionalLight("#ffd7c2", .7);
  fill.position.set(focus.x + 1.6, focus.y - .2, focus.z + 1.4);
  scene.add(key, rim, fill);

  const gl = studioRenderer();
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL("image/png");
  scheduleRelease();
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  materials.forEach((material) => material.dispose());
  disposables.forEach((item) => item.dispose());
  void id;
  return url;
}

/** Resolves to a PNG data URL for a named person, or rejects when WebGL or the model is unavailable. */
export function renderPortrait(id: string) {
  const look = portraitLooks[id];
  if (!look) return Promise.reject(new Error(`No portrait look for ${id}`));
  let render = renders.get(id);
  if (!render) {
    render = compose(id, look);
    render.catch(() => renders.delete(id));
    renders.set(id, render);
  }
  return render;
}
