import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

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

