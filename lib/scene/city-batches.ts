import * as THREE from "three";
import { mergeGeometries, toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

const identity = new THREE.Color(0xffffff);

type Part = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>; matrix: THREE.Matrix4 };
type Batch = {
  parts: Part[];
  material: THREE.Material;
  vertexTint: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
};

export class CityBatches {
  /**
   * Static meshes merge per tile and material, and every tile of one material shares one BatchedMesh, so the tile size
   * only trades culling precision against per-tile overhead inside a single multi-draw.
   */
  constructor(private readonly tileSize = 18) {}

  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly batched = new Set<THREE.BatchedMesh>();
  private readonly skeletons = new Set<THREE.Skeleton>();
  /**
   * Static families shared by every spatial merge in the scene: one BatchedMesh (one draw) per material and shadow
   * behavior for the whole city, instead of one per merged group. Geometry is stored in world space.
   */
  private readonly shared = new Map<string, THREE.BatchedMesh>();
  private readonly drawn = new WeakSet<THREE.Object3D>();
  /** Which shared instances came from which merged group, so hiding or removing that group still hides its parts. */
  private readonly owners: { owner: THREE.Object3D; batch: THREE.BatchedMesh; ids: number[]; shown: boolean }[] = [];
  /** Ground points under street lamps, collected while batching so the night pass can pool light beneath them. */
  readonly lampPools: THREE.Vector3[] = [];

  merge(group: THREE.Group, spatial: boolean, joints?: readonly THREE.Group[]) {
    group.updateWorldMatrix(true, true);
    // Static groups already in the scene join the scene-wide families; anything else merges into itself as before.
    let stage: THREE.Object3D | null = spatial ? group : null;
    while (stage?.parent) stage = stage.parent;
    if (!(stage instanceof THREE.Scene)) stage = null;
    const inverse = stage ? new THREE.Matrix4() : group.matrixWorld.clone().invert();
    const jointSlots = joints && new Map(joints.map((joint, index) => [joint as THREE.Object3D, index]));
    const bones = joints?.map((joint) => {
      const bone = new THREE.Bone();
      joint.add(bone);
      bone.updateWorldMatrix(true, false);
      return bone;
    });
    const skeleton = bones && new THREE.Skeleton(bones);
    if (skeleton) this.skeletons.add(skeleton);
    const batches = new Map<string, Batch>();
    const collect = (object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh) || (skeleton && !object.castShadow) || object instanceof THREE.SkinnedMesh ||
        object instanceof THREE.InstancedMesh || Array.isArray(object.material) ||
        !object.geometry.hasAttribute("normal")) return;
      const mesh = object as Part["mesh"];
      const source = mesh.material;
      if (spatial && mesh.userData.pool) {
        const e = mesh.matrixWorld.elements;
        this.lampPools.push(new THREE.Vector3(e[12], e[13] - Number(mesh.userData.pool), e[14]));
      }
      const casts = spatial && mesh.castShadow;
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
      const cell = spatial ? `${Math.floor(mesh.matrixWorld.elements[12] / this.tileSize)},${Math.floor(mesh.matrixWorld.elements[14] / this.tileSize)}` : "";
      const vertexTint = source instanceof THREE.MeshStandardMaterial &&
        !source.transparent && source.roughness === .91 && source.metalness === 0 &&
        source.emissive.getHex() === 0 && source.side === THREE.FrontSide && !source.alphaTest;
      const surface = vertexTint ? source.map?.uuid ?? "paint" : source.uuid;
      const key = `${cell}/${surface}/${casts}/${mesh.receiveShadow}`;
      let batch = batches.get(key);
      if (!batch) {
        const material = vertexTint ? this.tintMaterial(surface, source) : source;
        batch = { parts: [], material, vertexTint, castShadow: casts, receiveShadow: mesh.receiveShadow };
        batches.set(key, batch);
      }
      batch.parts.push({ mesh, matrix });
    };
    group.traverseVisible(collect);

    // Cells that share a material form a family. A family spread over several cells becomes one BatchedMesh: a single
    // multi-draw that still culls cell by cell, instead of one draw per cell.
    const families = new Map<string, Batch[]>();
    for (const [key, batch] of batches) {
      const family = key.slice(key.indexOf("/") + 1);
      families.set(family, [...families.get(family) ?? [], batch]);
    }
    for (const [family, cells] of families) {
      const { material, vertexTint, castShadow, receiveShadow } = cells[0];
      // A lone part stays a plain mesh, unless it can join a scene-wide family (a tinted surface, or a material the
      // city already batches, such as a shared sign page): then it costs no draw of its own.
      if (!skeleton && cells.length === 1 && cells[0].parts.length === 1 && !(stage && (vertexTint || this.shared.has(family)))) {
        if (!spatial) cells[0].parts[0].mesh.castShadow = false;
        continue;
      }
      const merged = cells.map(({ parts }) => {
        const textured = Object.values(material).some((value) => value instanceof THREE.Texture);
        const slot = (mesh: THREE.Object3D) => {
          let joint = mesh.parent;
          while (joint && !jointSlots?.has(joint)) joint = joint.parent;
          return jointSlots?.get(joint ?? group) ?? 0;
        };
        let geometry = fastMerge(parts, vertexTint, textured, jointSlots ? slot : undefined);
        if (!geometry) {
          const geometries = parts.map(({ mesh, matrix }) => this.partGeometry(mesh, matrix, vertexTint, textured, group, jointSlots));
          geometry = mergeGeometries(geometries);
          for (const part of geometries) part.dispose();
        }
        if (geometry) for (const { mesh } of parts) mesh.removeFromParent();
        return geometry;
      }).filter((geometry): geometry is THREE.BufferGeometry => Boolean(geometry));
      if (!merged.length) continue;
      if (stage) {
        this.share(stage, group, family, cells[0], merged);
        continue;
      }
      let batch: THREE.Mesh;
      if (merged.length > 1) {
        const vertices = merged.reduce((total, geometry) => total + geometry.attributes.position.count, 0);
        const indices = merged.reduce((total, geometry) => total + geometry.index!.count, 0);
        const batched = new THREE.BatchedMesh(merged.length, vertices, indices, material);
        batched.sortObjects = material.transparent;
        for (const geometry of merged) {
          batched.addInstance(batched.addGeometry(geometry));
          geometry.dispose();
        }
        this.batched.add(batched);
        batch = batched;
      } else {
        const geometry = merged[0];
        this.geometries.add(geometry);
        batch = skeleton ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
        if (batch instanceof THREE.SkinnedMesh && skeleton) {
          batch.bind(skeleton, group.matrixWorld);
          batch.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .68, 0), 1.25);
        }
      }
      batch.castShadow = castShadow;
      batch.receiveShadow = receiveShadow;
      batch.updateMatrix();
      batch.matrixAutoUpdate = false;
      group.add(batch);
    }
    const groups: THREE.Group[] = [];
    group.traverse((object) => { if (object instanceof THREE.Group && object !== group) groups.push(object); });
    for (const child of groups.reverse()) {
      if (child.children.length === 0) child.removeFromParent();
    }
  }

  /** Append world-space cell geometries to the scene-wide batch for this family, growing it as needed. */
  private share(stage: THREE.Object3D, owner: THREE.Object3D, family: string, kind: Batch, geometries: THREE.BufferGeometry[]) {
    const vertices = geometries.reduce((total, geometry) => total + geometry.attributes.position.count, 0);
    const indices = geometries.reduce((total, geometry) => total + geometry.index!.count, 0);
    let batch = this.shared.get(family);
    // Growing a batch the GPU already holds re-uploads all of it; content that arrives after the first frames (a district
    // coming into view) starts a fresh batch for the family instead, which costs one more draw but no hitch.
    if (batch && this.drawn.has(batch) && (batch.unusedVertexCount < vertices || batch.unusedIndexCount < indices)) {
      batch = undefined;
    }
    if (!batch) {
      // Buffers grow by a quarter at a time (not doubling): the largest family holds millions of vertices, and unused
      // capacity is still GPU memory on a phone.
      batch = new THREE.BatchedMesh(Math.max(32, geometries.length * 2), Math.max(4096, Math.ceil(vertices * 1.25)),
        Math.max(8192, Math.ceil(indices * 1.25)), kind.material);
      batch.name = "City batch";
      batch.sortObjects = kind.material.transparent;
      batch.castShadow = kind.castShadow;
      batch.receiveShadow = kind.receiveShadow;
      batch.matrixAutoUpdate = false;
      const drawn = this.drawn;
      batch.onAfterRender = batch.onAfterShadow = function () {
        drawn.add(this);
      };
      this.shared.set(family, batch);
      this.batched.add(batch);
    } else {
      if (batch.unusedVertexCount < vertices || batch.unusedIndexCount < indices) {
        const maxVertices = batch.geometry.attributes.position.count;
        const maxIndices = batch.geometry.index!.count;
        const usedVertices = maxVertices - batch.unusedVertexCount, usedIndices = maxIndices - batch.unusedIndexCount;
        batch.setGeometrySize(Math.max(Math.ceil(maxVertices * 1.25), usedVertices + vertices),
          Math.max(Math.ceil(maxIndices * 1.25), usedIndices + indices));
      }
      if (batch.maxInstanceCount - batch.instanceCount < geometries.length) {
        batch.setInstanceCount(Math.max(batch.maxInstanceCount * 2, batch.instanceCount + geometries.length));
      }
    }
    const ids = geometries.map((geometry) => {
      const id = batch.addInstance(batch.addGeometry(geometry));
      geometry.dispose();
      return id;
    });
    batch.boundingBox = null;
    batch.boundingSphere = null;
    this.owners.push({ owner, batch, ids, shown: true });
    // Added after it is filled, so the renderer's pre-compile sees a complete mesh.
    if (!batch.parent) stage.add(batch);
  }

  /** Hide shared parts whose source group is hidden or no longer in the scene. Call once per frame before rendering. */
  syncVisibility(scene: THREE.Object3D) {
    for (const entry of this.owners) {
      let node: THREE.Object3D | null = entry.owner;
      while (node && node !== scene && node.visible) node = node.parent;
      const shown = node === scene;
      if (shown === entry.shown) continue;
      entry.shown = shown;
      for (const id of entry.ids) entry.batch.setVisibleAt(id, shown);
    }
  }

  private partGeometry(mesh: Part["mesh"], matrix: THREE.Matrix4, vertexTint: boolean, textured: boolean, group: THREE.Group,
    jointSlots?: Map<THREE.Object3D, number>) {
    const geometry = mesh.geometry.clone();
    // Retain indexed vertices on box, cylinder and sphere primitives.
    if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
    // Untextured batches skip texture coordinates entirely; textured ones need them on every part.
    if (!textured) geometry.deleteAttribute("uv");
    else if (!geometry.hasAttribute("uv")) geometry.setAttribute("uv",
      new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    if (vertexTint) {
      const paint = mesh.material as THREE.MeshStandardMaterial;
      const tint = paint.color;
      const vertexColors = paint.vertexColors ? mesh.geometry.getAttribute("color") : undefined;
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) {
        const vertex = i / 3;
        colors[i] = tint.r * (vertexColors?.getX(vertex) ?? 1);
        colors[i + 1] = tint.g * (vertexColors?.getY(vertex) ?? 1);
        colors[i + 2] = tint.b * (vertexColors?.getZ(vertex) ?? 1);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("fx", effectAttribute(mesh, geometry.attributes.position.count));
    }
    if (jointSlots) {
      let joint = mesh.parent;
      while (joint && !jointSlots.has(joint)) joint = joint.parent;
      const slot = jointSlots.get(joint ?? group) ?? 0;
      const count = geometry.attributes.position.count;
      const indices = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let i = 0; i < indices.length; i += 4) {
        indices[i] = slot;
        weights[i] = 1;
      }
      geometry.setAttribute("skinIndex", new THREE.BufferAttribute(indices, 4));
      geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
    }
    geometry.applyMatrix4(matrix);
    // Static batches stay resident on the GPU, so keep unit normals and baked tints compact.
    geometry.setAttribute("normal", packed(geometry.getAttribute("normal"), Int8Array));
    if (vertexTint) geometry.setAttribute("color", packed(geometry.getAttribute("color"), Uint16Array));
    return geometry;
  }

  private tintMaterial(key: string, source: THREE.MeshStandardMaterial) {
    let material = this.materials.get(key);
    if (!material) {
      material = source.clone();
      material.color.copy(identity);
      material.vertexColors = true;
      this.materials.set(key, material);
    }
    return material;
  }

  dispose() {
    this.skeletons.forEach((skeleton) => skeleton.dispose());
    this.geometries.forEach((geometry) => geometry.dispose());
    this.batched.forEach((batch) => batch.dispose());
    this.shared.clear();
    this.owners.length = 0;
    this.materials.forEach((material) => material.dispose());
  }
}

/**
 * Per-vertex world effects read by world-fx.ts: x = window/lamp glow weight, y = a stable per-mesh random used
 * to decide which windows are occupied at night, z = wind sway weight. Static meshes opt in through userData.
 */
function effectValues(mesh: THREE.Mesh): [number, number, number] {
  const glow = Number(mesh.userData.glow) || 0;
  const sway = Number(mesh.userData.sway) || 0;
  if (!glow && !sway) return [0, 0, 0];
  const e = mesh.matrixWorld.elements;
  const random = mesh.userData.lamp ? 0 : Math.abs(Math.sin(e[12] * 12.9898 + e[14] * 78.233 + e[13] * 37.719) * 43758.5453) % 1;
  return [glow, random, sway];
}

function effectAttribute(mesh: THREE.Mesh, count: number) {
  const [glow, random, sway] = effectValues(mesh);
  const values = new Float32Array(count * 3);
  if (glow || sway) {
    for (let i = 0; i < values.length; i += 3) {
      values[i] = glow;
      values[i + 1] = random;
      values[i + 2] = sway;
    }
  }
  return new THREE.BufferAttribute(values, 3);
}

const floatAttribute = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined, sizes: number[]) =>
  attribute instanceof THREE.BufferAttribute && attribute.array instanceof Float32Array && sizes.includes(attribute.itemSize);

const normalMatrix = new THREE.Matrix3();

/**
 * Merge a cell's parts straight into preallocated arrays: the same layout partGeometry + mergeGeometries produce
 * (float positions, byte normals, optional uv, 16-bit baked tint and fx weights, joint slots), without cloning every
 * primitive first. Returns null for anything unusual so the general path handles it.
 */
function fastMerge(parts: Part[], vertexTint: boolean, textured: boolean, slot?: (mesh: THREE.Object3D) => number) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const { mesh } of parts) {
    const geometry = mesh.geometry;
    const { position, normal, uv, color } = geometry.attributes;
    if (!floatAttribute(position, [3]) || !floatAttribute(normal, [3]) || geometry.morphAttributes.position) return null;
    for (const name in geometry.attributes) {
      if (name !== "position" && name !== "normal" && name !== "uv" && !(vertexTint && name === "color")) return null;
    }
    if (textured && uv && !floatAttribute(uv, [2])) return null;
    const paint = mesh.material as THREE.MeshStandardMaterial;
    if (vertexTint && paint.vertexColors && color && !floatAttribute(color, [3, 4])) return null;
    vertexCount += position.count;
    indexCount += geometry.index ? geometry.index.count : position.count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Int8Array(vertexCount * 3);
  const uvs = textured ? new Float32Array(vertexCount * 2) : null;
  const colors = vertexTint ? new Uint16Array(vertexCount * 3) : null;
  const effects = vertexTint ? new Float32Array(vertexCount * 3) : null;
  const skinIndex = slot ? new Uint16Array(vertexCount * 4) : null;
  const skinWeight = slot ? new Float32Array(vertexCount * 4) : null;
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let base = 0;
  let cursor = 0;
  for (const { mesh, matrix } of parts) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position.array as Float32Array;
    const normal = geometry.attributes.normal.array as Float32Array;
    const count = geometry.attributes.position.count;
    const m = matrix.elements;
    const n = normalMatrix.getNormalMatrix(matrix).elements;
    for (let i = 0; i < count; i++) {
      const x = position[i * 3], y = position[i * 3 + 1], z = position[i * 3 + 2];
      const o = (base + i) * 3;
      positions[o] = m[0] * x + m[4] * y + m[8] * z + m[12];
      positions[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      positions[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const a = normal[i * 3], b = normal[i * 3 + 1], c = normal[i * 3 + 2];
      let nx = n[0] * a + n[3] * b + n[6] * c;
      let ny = n[1] * a + n[4] * b + n[7] * c;
      let nz = n[2] * a + n[5] * b + n[8] * c;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length; ny /= length; nz /= length;
      normals[o] = Math.round(nx * 127);
      normals[o + 1] = Math.round(ny * 127);
      normals[o + 2] = Math.round(nz * 127);
    }
    const uv = geometry.attributes.uv;
    if (uvs && uv) uvs.set((uv.array as Float32Array).subarray(0, count * 2), base * 2);
    if (colors && effects) {
      const paint = mesh.material as THREE.MeshStandardMaterial;
      const tint = paint.color;
      const source = paint.vertexColors ? geometry.attributes.color : undefined;
      const values = source?.array as Float32Array | undefined;
      const stride = source?.itemSize ?? 3;
      const [glow, random, sway] = effectValues(mesh);
      for (let i = 0; i < count; i++) {
        const o = (base + i) * 3;
        colors[o] = Math.round(Math.min(1, Math.max(0, tint.r * (values ? values[i * stride] : 1))) * 65535);
        colors[o + 1] = Math.round(Math.min(1, Math.max(0, tint.g * (values ? values[i * stride + 1] : 1))) * 65535);
        colors[o + 2] = Math.round(Math.min(1, Math.max(0, tint.b * (values ? values[i * stride + 2] : 1))) * 65535);
        effects[o] = glow;
        effects[o + 1] = random;
        effects[o + 2] = sway;
      }
    }
    if (skinIndex && skinWeight && slot) {
      const joint = slot(mesh);
      for (let i = 0; i < count; i++) {
        skinIndex[(base + i) * 4] = joint;
        skinWeight[(base + i) * 4] = 1;
      }
    }
    const source = geometry.index?.array;
    const total = source ? source.length : count;
    for (let i = 0; i < total; i++) index[cursor + i] = base + (source ? source[i] : i);
    cursor += total;
    base += count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3, true));
  if (uvs) merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  if (colors && effects) {
    merged.setAttribute("color", new THREE.BufferAttribute(colors, 3, true));
    merged.setAttribute("fx", new THREE.BufferAttribute(effects, 3));
  }
  if (skinIndex && skinWeight) {
    merged.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
    merged.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  }
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  return merged;
}

function packed(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, Type: Int8ArrayConstructor | Uint16ArrayConstructor) {
  const signed = Type === Int8Array;
  const scale = signed ? 127 : 65535;
  const size = attribute.itemSize;
  const array = new Type(attribute.count * size);
  const low = signed ? -1 : 0;
  if (attribute instanceof THREE.BufferAttribute && attribute.array instanceof Float32Array) {
    const source = attribute.array;
    for (let i = 0; i < array.length; i++) array[i] = Math.round(Math.min(1, Math.max(low, source[i])) * scale);
  } else {
    for (let i = 0; i < attribute.count; i++) {
      for (let c = 0; c < size; c++) array[i * size + c] = Math.round(Math.min(1, Math.max(low, attribute.getComponent(i, c))) * scale);
    }
  }
  return new THREE.BufferAttribute(array, size, true);
}

export function canopyGeometry(stylized: boolean) {
  const geometry = new THREE.IcosahedronGeometry(.5, stylized ? 1 : 2);
  const positions = geometry.getAttribute("position");
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const wobble = 1 + Math.sin(x * 16 + y * 9) * Math.cos(z * 14 - y * 11) * .105;
    positions.setXYZ(i, x * wobble, y * wobble, z * wobble);
    const light = .87 + y * (stylized ? .31 : .21) + Math.sin(x * 33 - z * 18) * (stylized ? .058 : .042);
    colors.push(light, light, light);
  }
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  if (!stylized) return geometry;
  const sculpted = toCreasedNormals(geometry, Math.PI / 4);
  if (sculpted !== geometry) geometry.dispose();
  return sculpted;
}
