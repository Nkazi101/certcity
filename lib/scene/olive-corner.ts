import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { followRoute } from "./actors";
import { lightModel, modelLoader, releaseModels } from "./gltf";
import type { ModelState } from "./gltf";


export function loadOliveCorner(
  world: THREE.Scene,
  fallback: THREE.Group,
  fallbackActors: { sofia: THREE.Object3D; micah: THREE.Object3D },
  onState: (state: ModelState) => void,
  invalidate: () => void,
) {
  const loader = modelLoader();
  const path = "/models/olive-corner/";
  const walkHome = followRoute([[48.22, -2.79], [56.26, -2.79], [56.21, -3.40], [48.18, -3.40]], .79, 3.94);
  const active: GLTF[] = [];
  const characters: { model: GLTF; mixer: THREE.AnimationMixer; name: "sofia" | "micah" }[] = [];
  let ended = false;
  let time = 0;

  function pose(elapsed: number) {
    for (const { model, mixer, name } of characters) {
      if (name === "sofia") walkHome(elapsed, model.scene);
      mixer.setTime(name === "sofia" ? elapsed * .92 : elapsed + .48);
    }
  }

  for (const name of ["olive-and-13th", "sofia", "micah"] as const) {
    void loader.loadAsync(`${path}${name}.glb`).then((model) => {
      if (ended) {
        releaseModels([model]);
        return;
      }
      const { scene, animations } = model;
      lightModel(scene, name === "olive-and-13th");
      world.add(scene);
      active.push(model);
      if (name === "olive-and-13th") {
        fallback.visible = false;
        onState("ready");
        return;
      }
      if (name === "sofia") scene.position.y = .066;
      else {
        scene.position.set(35.55, .058, 16.86);
        scene.rotation.y = -.56;
      }
      const mixer = new THREE.AnimationMixer(scene);
      if (animations[0]) mixer.clipAction(animations[0]).play();
      characters.push({ model, mixer, name });
      fallbackActors[name].visible = false;
      pose(time);
      invalidate();
    }).catch(() => {
      if (!ended && name === "olive-and-13th") onState("fallback");
    });
  }

  return {
    update(elapsed: number) {
      time = elapsed;
      pose(elapsed);
    },
    dispose() {
      ended = true;
      characters.forEach(({ mixer }) => {
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot());
      });
      releaseModels(active);
      active.length = 0;
    },
  };
}
