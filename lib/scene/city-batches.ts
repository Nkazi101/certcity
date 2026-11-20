import * as THREE from "three";
import { mergeGeometries, toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

const tileSize = 18;
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
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly skeletons = new Set<THREE.Skeleton>();

  merge(group: THREE.Group, spatial: boolean, joints?: readonly THREE.Group[]) {
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
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
      const casts = spatial && mesh.castShadow;
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
      const cell = spatial ? `${Math.floor(mesh.matrixWorld.elements[12] / tileSize)},${Math.floor(mesh.matrixWorld.elements[14] / tileSize)}` : "";
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

    for (const { parts, material, vertexTint, castShadow, receiveShadow } of batches.values()) {
      if (parts.length === 1 && !skeleton) {
        if (!spatial) parts[0].mesh.castShadow = false;
        continue;
      }
      const geometries = parts.map(({ mesh, matrix }) => {
        const geometry = mesh.geometry.clone();
        // Retain indexed vertices on box, cylinder and sphere primitives.
        if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
        if (!geometry.hasAttribute("uv")) geometry.setAttribute("uv",
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
        return geometry.applyMatrix4(matrix);
      });
      const geometry = mergeGeometries(geometries);
      for (const part of geometries) part.dispose();
      if (!geometry) continue;
      for (const { mesh } of parts) mesh.removeFromParent();
      this.geometries.add(geometry);
      const batch = skeleton ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
      if (batch instanceof THREE.SkinnedMesh && skeleton) {
        batch.bind(skeleton, group.matrixWorld);
        batch.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .68, 0), 1.25);
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
    this.materials.forEach((material) => material.dispose());
  }
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
