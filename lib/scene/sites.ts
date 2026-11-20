import * as THREE from "three";

export type Landmark = {
  id: string;
  anchor: THREE.Vector3;
  bounds: THREE.Box3;
  streetAnchor?: THREE.Vector3;
  entranceFacing?: 1 | -1;
  surface?: THREE.Mesh;
};

export type SceneLink = { href: string; surface: THREE.Mesh };
export type SceneConversation = { id: string; bounds: THREE.Box3; anchor: THREE.Vector3 };

export type Environment = {
  landmarks: Landmark[];
  links?: SceneLink[];
  conversations?: SceneConversation[];
  update: (time: number) => void;
  dispose?: () => void;
  focusDistrict?: (id: import("./districts").DistrictId) => void;
  cameraNear?: (x: number, z: number) => void;
  setWorkload?: (staffHours: number) => void;
  setAssignmentComplete?: (complete: boolean) => void;
};

export function landmark(id: string, x: number, z: number, width: number, depth: number, height: number): Landmark {
  return {
    id,
    anchor: new THREE.Vector3(x, height + .22, z),
    bounds: new THREE.Box3(
      new THREE.Vector3(x - width / 2, 0, z - depth / 2),
      new THREE.Vector3(x + width / 2, height + .1, z + depth / 2),
    ),
  };
}
