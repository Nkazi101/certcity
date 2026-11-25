import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { hasNamedEffect, namedEffectMode } from "./world-fx";

export type ModelState = "ready" | "fallback";

export function modelLoader() {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

export function lightModel(scene: THREE.Object3D, castShadow = true) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = castShadow && !object.name.toLowerCase().includes("glass");
      object.receiveShadow = true;
    }
  });
}

export function releaseModels(models: GLTF[]) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  for (const { scene } of models) {
    scene.removeFromParent();
    scene.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
  }
  const sources = new Set<ImageBitmap>();
  textures.forEach((texture) => {
    if (typeof ImageBitmap !== "undefined" && texture.source.data instanceof ImageBitmap) {
      sources.add(texture.source.data);
    }
    texture.dispose();
  });
  sources.forEach((source) => source.close());
  skeletons.forEach((skeleton) => skeleton.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}


type Compactable = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

const round = (value: number, step = .02) => Math.round(value / step) * step;

function signature(mesh: Compactable, keep: (material: THREE.Material) => boolean) {
  const material = mesh.material;
  const shadow = `${mesh.castShadow}/${mesh.receiveShadow}`;
  const extraMaps = Object.entries(material).some(([name, value]) => value instanceof THREE.Texture && name !== "map");
  // With the default rule, materials kept only for a name-selected shader effect may still share one merged material
  // with others of the same effect: the effect depends on the (kept) name's mode, not on the base colour.
  const effect = keep === keepNamedMaterial && !material.userData.fxSway && !namedMaterials.test(material.name)
    ? namedEffectMode(material) : 0;
  if ((keep(material) && !effect) || extraMaps) return `own:${material.uuid}/${shadow}`;
  return [effect ? `fx${effect}` : "", material.type, material.map?.uuid ?? "", round(material.roughness), round(material.metalness),
    material.emissive.getHexString(), round(material.emissiveIntensity), material.emissiveMap?.uuid ?? "",
    material.transparent, round(material.opacity), material.alphaTest, material.side, material.depthWrite,
    material.flatShading, shadow].join("|");
}

function readComponents(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, count: number) {
  const size = attribute.itemSize;
  const array = new Float32Array(count * size);
  if (attribute instanceof THREE.InterleavedBufferAttribute) {
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < size; c++) array[i * size + c] = attribute.getComponent(i, c);
    }
    return array;
  }
  const source = attribute.array;
  const scale = !attribute.normalized ? 1 : source instanceof Int8Array ? 1 / 127 : source instanceof Uint8Array ? 1 / 255
    : source instanceof Int16Array ? 1 / 32767 : source instanceof Uint16Array ? 1 / 65535 : 1;
  const signed = source instanceof Int8Array || source instanceof Int16Array;
  for (let i = 0; i < count * size; i++) array[i] = attribute.normalized && signed ? Math.max(source[i] * scale, -1) : source[i] * scale;
  return array;
}

function floatAttribute(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, count: number) {
  return new THREE.BufferAttribute(readComponents(attribute, count), attribute.itemSize);
}

/** Store unit vectors and colours as normalised bytes again once transforms are applied, as the source GLBs do. */
function packAttribute(attribute: THREE.BufferAttribute, signed: boolean) {
  const source = attribute.array as Float32Array;
  const array = signed ? new Int8Array(source.length) : new Uint8Array(source.length);
  const scale = signed ? 127 : 255;
  for (let i = 0; i < source.length; i++) array[i] = Math.round(Math.min(1, Math.max(signed ? -1 : 0, source[i])) * scale);
  return new THREE.BufferAttribute(array, attribute.itemSize, true);
}

function indexAttribute(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, count: number) {
  const array = new Uint16Array(count * 4);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 4; c++) array[i * 4 + c] = attribute.getComponent(i, c);
  }
  return new THREE.BufferAttribute(array, 4);
}

/** Normalised float copy of a primitive with its material colour baked into vertex colour. */
function bakedGeometry(mesh: Compactable, transform: THREE.Matrix4, textured: boolean) {
  const source = mesh.geometry;
  const count = source.attributes.position.count;
  const geometry = new THREE.BufferGeometry();
  for (const name of ["position", "normal", ...(textured ? ["uv"] : [])]) {
    const attribute = source.getAttribute(name);
    if (!attribute) return null;
    geometry.setAttribute(name, floatAttribute(attribute, count));
  }
  if (mesh instanceof THREE.SkinnedMesh) {
    const joints = source.getAttribute("skinIndex");
    const weights = source.getAttribute("skinWeight");
    if (!joints || !weights) return null;
    geometry.setAttribute("skinIndex", indexAttribute(joints, count));
    geometry.setAttribute("skinWeight", floatAttribute(weights, count));
  }
  const tint = mesh.material.color;
  const sourceColors = mesh.material.vertexColors ? source.getAttribute("color") : undefined;
  const vertexColors = sourceColors && readComponents(sourceColors, count);
  const stride = sourceColors?.itemSize ?? 3;
  const colors = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = Math.round(Math.min(1, tint.r * (vertexColors ? vertexColors[i * stride] : 1)) * 255);
    colors[i * 3 + 1] = Math.round(Math.min(1, tint.g * (vertexColors ? vertexColors[i * stride + 1] : 1)) * 255);
    colors[i * 3 + 2] = Math.round(Math.min(1, tint.b * (vertexColors ? vertexColors[i * stride + 2] : 1)) * 255);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3, true));
  if (source.index) geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(source.index.array as ArrayLike<number>), 1));
  else geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: count }, (_, i) => i), 1));
  geometry.applyMatrix4(transform);
  geometry.setAttribute("normal", packAttribute(geometry.getAttribute("normal") as THREE.BufferAttribute, true));
  return geometry;
}

/**
 * When b can be re-expressed in a's bind space, return the matrix that does it. glTF exporters (and quantization)
 * give each skinned primitive its own inverse bind matrices; they differ from a's by one constant mesh transform D,
 * so b's vertices become B^-1 * D * B * v under a's skeleton.
 */
function skinTransform(a: THREE.SkinnedMesh, b: THREE.SkinnedMesh) {
  if (a.parent !== b.parent || !a.matrix.equals(b.matrix) || !a.bindMatrix.equals(b.bindMatrix)) return null;
  const bones = a.skeleton.bones, other = b.skeleton.bones;
  if (bones.length !== other.length || !bones.length) return null;
  let difference: THREE.Matrix4 | null = null;
  const candidate = new THREE.Matrix4();
  for (let i = 0; i < bones.length; i++) {
    if (bones[i] !== other[i]) return null;
    candidate.copy(a.skeleton.boneInverses[i]).invert().multiply(b.skeleton.boneInverses[i]);
    if (!difference) difference = candidate.clone();
    else {
      for (let e = 0; e < 16; e++) {
        if (Math.abs(candidate.elements[e] - difference.elements[e]) > 1e-4 * Math.max(1, Math.abs(difference.elements[e]))) return null;
      }
    }
  }
  return new THREE.Matrix4().copy(a.bindMatrixInverse).multiply(difference!).multiply(a.bindMatrix);
}

/**
 * Collapse a loaded model into as few draws as its look allows. Primitives whose materials differ only in base colour
 * are merged into one mesh with the colour baked into vertex colour; materials that `keep` names (effects, paint that
 * is swapped later) only merge with themselves. Skinned primitives merge when they share a skeleton and bind pose.
 * Call after lightModel so shadow flags are part of the grouping.
 */
/** Material names other scene code looks up after loading (paint swaps, Delmar marquee bulbs). */
const namedMaterials = /paint|^Bulb$|^Tivoli blade/i;

export function keepNamedMaterial(material: THREE.Material) {
  return hasNamedEffect(material) || namedMaterials.test(material.name);
}

type Drawable = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

function drawable(texture: THREE.Texture | null): Drawable | null {
  if (!texture || texture.flipY || texture.offset.x || texture.offset.y || texture.repeat.x !== 1 || texture.repeat.y !== 1 ||
    texture.rotation) return null;
  const image = texture.image as unknown;
  const ok = (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) ||
    (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement);
  if (!ok) return null;
  const { width, height } = image as Drawable;
  return width > 0 && height > 0 && width <= 1024 && height <= 1024 ? image as Drawable : null;
}

function unitUvs(geometry: THREE.BufferGeometry) {
  const uv = geometry.getAttribute("uv");
  if (!uv) return false;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (u < -.001 || u > 1.001 || v < -.001 || v > 1.001) return false;
  }
  return true;
}

/**
 * Textures that are only ever sampled inside [0, 1] (signs, plaques, window glazing, printed cloth) are packed into one
 * atlas per otherwise-identical material, so the merge below can fold them into one draw. Repeating textures are left
 * alone. Each slot is padded with its own edge texels so mipmaps do not bleed between neighbours.
 */
function atlasUnitTextures(root: THREE.Object3D, keep: (material: THREE.Material) => boolean) {
  const groups = new Map<string, Compactable[]>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) ||
      !(object.material instanceof THREE.MeshStandardMaterial) || object.geometry.morphAttributes.position ||
      !object.geometry.getAttribute("normal") || !object.visible) return;
    const mesh = object as Compactable;
    const map = mesh.material.map;
    if (!map || !drawable(map) || !unitUvs(mesh.geometry)) return;
    const key = signature(mesh, keep);
    if (key.startsWith("own:")) return;
    const group = `${mesh instanceof THREE.SkinnedMesh}|${map.colorSpace}|${key.replace(map.uuid, "atlas")}`;
    groups.set(group, [...groups.get(group) ?? [], mesh]);
  });
  const gutter = 8;
  for (const members of groups.values()) {
    const maps = [...new Set(members.map((mesh) => mesh.material.map!))];
    if (maps.length < 2) continue;
    const images = new Map(maps.map((map) => [map, drawable(map)!]));
    maps.sort((a, b) => images.get(b)!.height - images.get(a)!.height);
    const area = maps.reduce((total, map) => total + (images.get(map)!.width + gutter * 2) * (images.get(map)!.height + gutter * 2), 0);
    const widest = Math.max(...maps.map((map) => images.get(map)!.width + gutter * 2));
    const width = Math.max(widest, Math.min(2048, Math.ceil(Math.sqrt(area) * 1.25)));
    const slots = new Map<THREE.Texture, { x: number; y: number }>();
    let x = 0, y = 0, row = 0;
    for (const map of maps) {
      const image = images.get(map)!;
      if (x + image.width + gutter * 2 > width) {
        x = 0;
        y += row;
        row = 0;
      }
      slots.set(map, { x, y });
      x += image.width + gutter * 2;
      row = Math.max(row, image.height + gutter * 2);
    }
    const height = y + row;
    if (height > 2048) continue;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (const [map, { x, y }] of slots) {
      const image = images.get(map)!;
      const w = image.width, h = image.height, g = gutter;
      ctx.drawImage(image, x + g, y + g);
      ctx.drawImage(image, 0, 0, w, 1, x + g, y, w, g);
      ctx.drawImage(image, 0, h - 1, w, 1, x + g, y + g + h, w, g);
      ctx.drawImage(image, 0, 0, 1, h, x, y + g, g, h);
      ctx.drawImage(image, w - 1, 0, 1, h, x + g + w, y + g, g, h);
    }
    const atlas = new THREE.CanvasTexture(canvas);
    atlas.name = "Atlas";
    atlas.flipY = false;
    atlas.colorSpace = maps[0].colorSpace;
    atlas.anisotropy = Math.max(...maps.map((map) => map.anisotropy));
    for (const mesh of members) {
      const map = mesh.material.map!;
      const { x, y } = slots.get(map)!;
      const { width: w, height: h } = images.get(map)!;
      const geometry = mesh.geometry.clone();
      const uv = geometry.getAttribute("uv");
      const packed = new Float32Array(uv.count * 2);
      for (let i = 0; i < uv.count; i++) {
        packed[i * 2] = (x + gutter + uv.getX(i) * w) / width;
        packed[i * 2 + 1] = (y + gutter + uv.getY(i) * h) / height;
      }
      geometry.setAttribute("uv", new THREE.BufferAttribute(packed, 2));
      const material = mesh.material.clone();
      material.map = atlas;
      mesh.geometry = geometry;
      mesh.material = material;
    }
  }
}

/** Pass release = false when the merged parts share geometry or materials with objects outside root (model clones). */
export function compactModel(root: THREE.Object3D, keep: (material: THREE.Material) => boolean = keepNamedMaterial, release = true) {
  root.updateWorldMatrix(true, true);
  if (release) atlasUnitTextures(root, keep);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map<string, Compactable[]>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material) ||
      !(object.material instanceof THREE.MeshStandardMaterial) || object.geometry.morphAttributes.position ||
      !object.geometry.getAttribute("normal") || !object.visible) return;
    const mesh = object as Compactable;
    const skinned = mesh instanceof THREE.SkinnedMesh;
    const key = `${skinned ? "skin" : "static"}|${signature(mesh, keep)}`;
    const group = groups.get(key) ?? [];
    group.push(mesh);
    groups.set(key, group);
  });
  const replaced = new Set<Compactable>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const first = members[0];
    const skinned = first instanceof THREE.SkinnedMesh;
    const transforms = new Map<Compactable, THREE.Matrix4>();
    for (const mesh of members) {
      const transform = skinned ? skinTransform(first as unknown as THREE.SkinnedMesh, mesh as unknown as THREE.SkinnedMesh)
        : new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
      if (transform) transforms.set(mesh, transform);
    }
    const parts = members.filter((mesh) => transforms.has(mesh));
    if (parts.length < 2) continue;
    const textured = Object.values(first.material).some((value) => value instanceof THREE.Texture);
    const geometries = parts.map((mesh) => bakedGeometry(mesh, transforms.get(mesh)!, textured));
    if (geometries.some((geometry) => !geometry)) {
      geometries.forEach((geometry) => geometry?.dispose());
      continue;
    }
    const geometry = mergeGeometries(geometries as THREE.BufferGeometry[]);
    geometries.forEach((part) => part!.dispose());
    if (!geometry) continue;
    const material = first.material.clone();
    material.color.setRGB(1, 1, 1);
    material.vertexColors = true;
    if (!keep(first.material)) material.name = `Merged ${first.material.name}`;
    let merged: THREE.Mesh;
    if (skinned) {
      const source = first as unknown as THREE.SkinnedMesh;
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.name = `${source.name} (merged)`;
      mesh.position.copy(source.position);
      mesh.quaternion.copy(source.quaternion);
      mesh.scale.copy(source.scale);
      source.parent!.add(mesh);
      mesh.bind(source.skeleton, source.bindMatrix);
      merged = mesh;
    } else {
      merged = new THREE.Mesh(geometry, material);
      merged.name = `${first.name} (merged)`;
      root.add(merged);
    }
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.frustumCulled = parts.every((mesh) => mesh.frustumCulled);
    parts.forEach((mesh) => replaced.add(mesh));
  }
  if (!replaced.size) return root;
  const live = new Set<THREE.BufferGeometry>();
  const liveMaterials = new Set<THREE.Material>();
  replaced.forEach((mesh) => mesh.removeFromParent());
  if (!release) return root;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    live.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) liveMaterials.add(material);
  });
  replaced.forEach((mesh) => {
    if (!live.has(mesh.geometry)) mesh.geometry.dispose();
    if (!liveMaterials.has(mesh.material)) mesh.material.dispose();
  });
  return root;
}
