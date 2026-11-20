import * as THREE from "three";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { followRoute, makePerson, makeVehicle } from "./actors";
import { lightModel, modelLoader, releaseModels } from "./gltf";
import { landmark } from "./sites";
import { buildStLouisGround, delmarStop } from "./st-louis-ground";
import type { StreetActor, Tree } from "./st-louis-ground";
import { buildRegionalStreets } from "./st-louis-streets";
import { stLouisDistricts } from "./st-louis-layout";
import type { StLouisDistrict } from "./st-louis-layout";
import type { DistrictId } from "./districts";
import type { ModelKit } from "./model-kit";
import { waterRipples } from "./park-details";
import { artHillVisitors } from "./park-visitors";
import { followRoad } from "./streets";

const sites: Record<StLouisDistrict["id"], [id: string, x: number, z: number, w: number, d: number, h: number][]> = {
  enterprise: [["enterprise-center", 0, 1.3, 24, 17.4, 8.7], ["stifel-theatre", -1.5, -10.2, 21.6, 5.65, 5.3], ["kiel-garage", -17.2, 1.2, 8.2, 17.8, 4.2]],
  ballpark: [["busch-stadium", 1.8, 10.5, 28, 24, 5.6], ["ballpark-village", 5.18, -11.15, 18, 8, 6.7], ["loews", -16.1, -13.3, 7.8, 7.6, 8.6]],
  delmar: [["tivoli", 11.05, 7.6, 10.3, 6.7, 6.0], ["blueberry-hill", -9.25, 7.2, 6.75, 6.8, 4.4], ["moonrise", 20, -9, 6.8, 8, 10.05], ["pageant", 28.75, -9.65, 9.72, 9.68, 6.2]],
  "forest-park": [["saint-louis-art-museum", 0, 15.5, 25, 10, 8.7], ["grand-basin", 0, -14, 21.6, 18.7, 1.3], ["art-museum-east", 16.65, 16.9, 9.4, 8.3, 6.3]],
  washu: [["washu-brookings", -1.8, 0, 9.8, 30, 8.6], ["sumers", 20.6, 13.4, 10, 6.4, 2.9], ["kemper", 32.6, 11.55, 10.2, 8.2, 5.95]],
  umsl: [["umsl-touhill", 0, -.5, 20.5, 18, 8.9], ["millennium", 6.7, 20, 11.6, 8.5, 7.8], ["thomas-jefferson-library", -14.7, 19.8, 12.6, 8.2, 6.5]],
};

const walkerModels = ["riley", "jules"];
const area = 46;

function shuttleRoute(path: StreetActor["path"], speed: number, phase: number) {
  return followRoute([...path, ...path.slice(1, -1).reverse()], speed, phase);
}

function trolleySchedule(path: StreetActor["path"], speed: number) {
  const [[start, z], [end]] = path;
  const before = (delmarStop.x - start) / speed;
  const after = (end - delmarStop.x) / speed;
  const run = before + delmarStop.wait + after;
  return (time: number) => {
    const phase = (time + before + 1.03) % (2 * run);
    const reverse = phase > run;
    const origin = reverse ? end : start;
    const destination = reverse ? start : end;
    const heading = reverse ? -1 : 1;
    const window = reverse ? after : before;
    const local = reverse ? phase - run : phase;
    const stopped = local >= window && local < window + delmarStop.wait;
    const distance = local < window
      ? Math.abs(delmarStop.x - origin) * THREE.MathUtils.smoothstep(local, 0, window)
      : Math.abs(delmarStop.x - origin) + Math.abs(destination - delmarStop.x)
        * THREE.MathUtils.smoothstep(local, window + delmarStop.wait, run);
    return { x: origin + heading * distance, z, heading, stopped, local: local - window };
  };
}

function placeTrees(source: THREE.Object3D, group: THREE.Group, positions: Tree[]) {
  const dummy = new THREE.Object3D();
  source.updateMatrixWorld(true);
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const trees = new THREE.InstancedMesh(object.geometry, object.material, positions.length);
    const matrix = new THREE.Matrix4();
    positions.forEach(({ x, z, size }, i) => {
      dummy.position.set(x, .048, z);
      dummy.rotation.y = i * 2.4;
      dummy.scale.set(size, size * (.91 + (i % 4) * .055), size);
      dummy.updateMatrix();
      trees.setMatrixAt(i, matrix.multiplyMatrices(dummy.matrix, object.matrixWorld));
    });
    trees.computeBoundingSphere();
    trees.castShadow = true;
    trees.receiveShadow = true;
    group.add(trees);
  });
}

export function stLouisExpansion(kit: ModelKit, scene: THREE.Scene, invalidate: () => void) {
  const loader = modelLoader();
  const cache = new Map<string, Promise<GLTF>>();
  const resolved = new Set<GLTF>();
  const mixers = new Map<THREE.AnimationMixer, { phase: number; district?: DistrictId }>();
  const sharedTreeGroups = new Set<THREE.Group>();
  const owned = new THREE.Group();
  scene.add(owned);
  const mounted = new Map<DistrictId, { root: THREE.Group; motions: ((seconds: number) => void)[] }>();
  const districtArt = new Map<DistrictId, () => void>();
  const districtEffects: (() => void)[] = [];
  const landmarks = [
    landmark("soldiers-memorial", 31, 46.8, 9.2, 3.6, 3.8),
    ...stLouisDistricts.flatMap((district) => sites[district.id].map(([id, x, z, w, d, h]) =>
      landmark(id, district.x + x, district.z + z, w, d, h))),
  ];
  for (const site of landmarks) {
    const { x, z } = site.anchor;
    if (site.id === "tivoli" || site.id === "blueberry-hill") {
      site.streetAnchor = new THREE.Vector3(x, 2.75, -44.22);
      site.entranceFacing = -1;
    }
    if (site.id === "saint-louis-art-museum") {
      site.streetAnchor = new THREE.Vector3(x, 4.75, z - 4.85);
      site.entranceFacing = -1;
    }
  }
  const ground = kit.material("#92ac61", "grass");
  kit.ground(owned, -73, -19, 420, 380, ground, -.067);
  const roads = new THREE.Group();
  owned.add(roads);
  buildRegionalStreets(kit, roads);
  kit.batch(roads);
  let disposed = false;
  let elapsed = 0;
  let viewX = 49.5, viewZ = 0;

  function load(name: string) {
    const cached = cache.get(name);
    if (cached) return cached;
    const pending = loader.loadAsync(`/models/st-louis/${name}.glb`).then((asset) => {
      if (disposed) {
        releaseModels([asset]);
        throw new Error("Scene closed");
      }
      resolved.add(asset);
      return asset;
    }).catch((error: unknown) => {
      cache.delete(name);
      throw error;
    });
    cache.set(name, pending);
    return pending;
  }

  function upgradeCar(root: THREE.Object3D, name: "sedan" | "crossover" | "trolley" | "van", color?: string) {
    void load(name).then(({ scene: model }) => {
      if (disposed) return;
      const car = model.clone();
      const fallback = root.children.filter((child) => child.name !== "Vehicle lights" && child.name !== "Animated hubs" && child.name !== "Actor contact shadow");
      root.add(car);
      fallback.forEach((object) => { object.visible = false; });
      lightModel(car, false);
      if (color) {
        car.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
          if (/^(Car|Utility) paint/.test(object.material.name)) {
            const paint = kit.material(color);
            paint.roughness = .36;
            paint.metalness = .08;
            object.material = paint;
          }
        });
      }
      invalidate();
    }).catch(() => {});
  }

  function upgradeWalker(root: THREE.Object3D, name: string, phase = 0, district?: DistrictId) {
    void load(name).then(({ scene: model, animations }) => {
      if (disposed) return;
      const person = cloneSkeleton(model);
      const fallback = root.children.filter((child) => child.name !== "Actor contact shadow");
      root.add(person);
      fallback.forEach((object) => { object.visible = false; });
      lightModel(person, false);
      const animation = animations[0];
      if (animation) {
        const mixer = new THREE.AnimationMixer(person);
        mixer.clipAction(animation).play();
        mixer.setTime(elapsed + phase);
        mixers.set(mixer, { phase, district });
      }
      invalidate();
    }).catch(() => {});
  }

  function mount(district: StLouisDistrict) {
    if (mounted.has(district.id)) return;
    const root = new THREE.Group();
    root.position.set(district.x, 0, district.z);
    root.name = district.name;
    const base = new THREE.Group();
    root.add(base);
    owned.add(root);
    const { trees, actors } = buildStLouisGround(kit, base, district);
    kit.batch(base);
    const trolley = actors.find((actor) => actor.model === "trolley");
    const timetable = trolley && trolleySchedule(trolley.path, trolley.speed);
    const motions = actors.map((actor, index) => {
      const { model, path, speed, phase, height = .103, shuttle } = actor;
      const walker = model === "riley" || model === "jules";
      const fallback = walker ? makePerson(kit, root, ["#8d624f", "#aa775a", "#48322c"]) : null;
      const object = fallback?.person ?? makeVehicle(kit, root, index % 2 === 0 ? "#ad5b47" : "#64858a", model === "trolley");
      object.position.y = height;
      if (walker) upgradeWalker(object, model, index * .42, district.id);
      else upgradeCar(object, model);
      const move = walker ? (shuttle ? shuttleRoute : followRoute)(path, speed, phase)
        : model === "trolley" ? null : followRoad(path, speed, phase);
      return (seconds: number) => {
        if (model === "trolley" && timetable) {
          const { x, z, heading } = timetable(seconds);
          object.position.x = x;
          object.position.z = z;
          object.rotation.y = heading * Math.PI / 2;
          return;
        }
        move?.(seconds, object);
        fallback?.walk(seconds * 6.6 + index);
      };
    });
    if (district.id === "forest-park") {
      const reflections = waterRipples(kit, root,
        [-4.6,-1.7,1.7,4.6].flatMap((x) => [-15.4,-10.7].map((z): [number, number, number, number] => [x,.157,z,.95])));
      motions.push(reflections.update);
      motions.push(artHillVisitors(kit, root));
      districtEffects.push(reflections.dispose);
    }
    if (timetable) {
      const arriving = kit.group(root, [7.91, .079, 4.02], -Math.PI / 2);
      const casework = kit.material("#a65a45");
      kit.box(arriving, [0, .24, 0], [.39, .41, .27], casework, true);
      kit.box(arriving, [0, .476, 0], [.16, .085, .071], kit.material("#50463a"), true);
      const watcher = makePerson(kit, root, ["#a77345", "#c89066", "#58392c"], 1.17, 4, 1.08);
      watcher.person.position.set(7.88, .08, 3.50);
      watcher.person.rotation.y = Math.PI + .41;
      motions.push((time) => {
        const { x, stopped } = timetable(time);
        const towardTrolley = Math.atan2(x - 7.88, -3.50) - watcher.person.rotation.y;
        watcher.head.rotation.y = THREE.MathUtils.clamp(Math.atan2(Math.sin(towardTrolley), Math.cos(towardTrolley)), -.9, .9);
        watcher.head.rotation.x = stopped ? -.13 : .10;
        watcher.arms[1].rotation.x = stopped ? -1.12 - Math.sin(time * 5) * .12 : -.16;
        watcher.forearms[1].rotation.x = stopped ? -.46 : -.10;
      });
      for (const [i, clothes] of ([
        ["#ca6046", "#dca382", "#483a34"], ["#327d91", "#94604a", "#4d3328"],
      ] as [string, string, string][]).entries()) {
        const rider = makePerson(kit, root, clothes, 1.10 + i * .06, 1 + i, 1.02);
        motions.push((time) => {
          const { stopped, local, heading } = timetable(time);
          const boarding = stopped && heading === 1;
          const progress = boarding ? THREE.MathUtils.smoothstep(local - .87 * i, 0, 2.23) : 0;
          rider.person.position.set(delmarStop.x + .53 + i*.46, .082 + .23 * progress,
            THREE.MathUtils.lerp(delmarStop.z + i * .33, .57, progress));
          rider.person.rotation.y = Math.PI;
          rider.person.visible = heading === 1 ? local < 2.21 + .87 * i : local < -13.2 - i;
          rider.walk(time * 8 + i, progress > 0 && progress < 1 ? .8 : 0);
          rider.head.rotation.y = .21 * Math.sin(time * 1.4 + i);
        });
      }
    }
    motions.forEach((move) => move(elapsed));
    mounted.set(district.id, { root, motions });
    for (const tall of [false, true]) {
      const positions = trees.filter((tree) => Boolean(tree.tall) === tall);
      if (!positions.length) continue;
      void load(tall ? "upright-tree" : "oak").then(({ scene: model }) => {
        if (disposed) return;
        placeTrees(model, root, positions);
        invalidate();
      }).catch(() => {
        if (disposed) return;
        const fallback = new THREE.Group();
        root.add(fallback);
        positions.forEach(({ x, z, size }, i) => kit.tree(fallback, x, z, size, i + 46));
        kit.batch(fallback);
        invalidate();
      });
    }
    let artState: "pending" | "ready" | "missing" = "missing";
    let placeholder: THREE.Group | undefined;
    const loadArt = () => {
      if (artState !== "missing") return;
      artState = "pending";
      void load(district.id).then((asset) => {
        if (disposed) return;
        artState = "ready";
        placeholder?.removeFromParent();
        asset.scene.position.y = .052;
        root.add(asset.scene);
        lightModel(asset.scene);
        if (district.id === "delmar") {
          asset.scene.traverse((object) => {
            if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial &&
              /^(Bulb|Tivoli blade [A-Z])$/.test(object.material.name)) {
              object.material.emissive.set(object.material.name === "Bulb" ? "#df9c46" : "#df633d");
              object.material.emissiveIntensity = .32;
            }
          });
        }
        invalidate();
      }).catch(() => {
        if (disposed) return;
        artState = "missing";
        if (placeholder) return;
        placeholder = new THREE.Group();
        root.add(placeholder);
        for (const [id, x, z, w, d, h] of sites[district.id]) {
          if (id === "grand-basin") {
            const basin = kit.cylinder(placeholder, [x,.111,z], w, .13, kit.material("#7eaaac"));
            basin.scale.z = d / w;
          } else {
            kit.box(placeholder, [x,h*.47,z], [w,h*.94,d], kit.material("#c1a78c", "stone"));
            kit.box(placeholder, [x,h*.94,z], [w+.18,.22,d+.18], kit.material("#777e73","shingles"));
          }
        }
        kit.batch(placeholder);
        invalidate();
      });
    };
    districtArt.set(district.id, loadArt);
    loadArt();
    invalidate();
  }

  void load("civic").then((asset) => {
    asset.scene.position.y = .055;
    lightModel(asset.scene);
    owned.add(asset.scene);
    invalidate();
  }).catch(() => {});

  return {
    invalidate,
    landmarks,
    upgradeDowntownCar(root: THREE.Object3D, model: "sedan" | "crossover", color: string) {
      upgradeCar(root, model, color);
    },
    upgradeDowntownVan(root: THREE.Object3D) {
      upgradeCar(root, "van");
    },
    upgradeDowntownTrees(parent: THREE.Object3D, trees: Tree[]) {
      const fallback = new THREE.Group();
      parent.add(fallback);
      trees.forEach(({ x, z, size }, i) => kit.tree(fallback, x, z, size, 20 + i));
      void load("oak").then(({ scene: model }) => {
        if (disposed) return;
        fallback.visible = false;
        const group = new THREE.Group();
        parent.add(group);
        sharedTreeGroups.add(group);
        placeTrees(model, group, trees);
        invalidate();
      }).catch(() => {});
      return fallback;
    },
    upgradeDowntownWalker(root: THREE.Object3D, index: number) {
      upgradeWalker(root, walkerModels[index % walkerModels.length], index * .29);
    },
    focus(id: DistrictId) {
      const district = stLouisDistricts.find((candidate) => candidate.id === id);
      if (!district) return;
      if (mounted.has(id)) districtArt.get(id)?.();
      else mount(district);
    },
    near(x: number, z: number) {
      viewX = x;
      viewZ = z;
      for (const district of stLouisDistricts) {
        const dx = Math.abs(x - district.x), dz = Math.abs(z - district.z);
        if (dx < area && dz < area) mount(district);
        const districtScene = mounted.get(district.id);
        if (districtScene) districtScene.root.visible = dx < 119 && dz < 119;
      }
    },
    update(seconds: number) {
      elapsed = seconds;
      const nearby = new Set<DistrictId>();
      for (const { id, x, z } of stLouisDistricts) {
        if (Math.abs(x - viewX) < 65 && Math.abs(z - viewZ) < 58) {
          nearby.add(id);
          mounted.get(id)?.motions.forEach((move) => move(seconds));
        }
      }
      mixers.forEach(({ phase, district }, mixer) => {
        if (district ? nearby.has(district) : viewX > 8 && viewZ < 51 && viewZ > -65) mixer.setTime(seconds + phase);
      });
    },
    dispose() {
      disposed = true;
      districtEffects.forEach((dispose) => dispose());
      mixers.forEach((_, mixer) => {
        mixer.stopAllAction();
        const root = mixer.getRoot();
        mixer.uncacheRoot(root);
        if (root instanceof THREE.Object3D) {
          const clonedSkeletons = new Set<THREE.Skeleton>();
          root.traverse((node) => { if (node instanceof THREE.SkinnedMesh) clonedSkeletons.add(node.skeleton); });
          clonedSkeletons.forEach((skeleton) => skeleton.dispose());
        }
      });
      releaseModels([...resolved]);
      for (const group of [owned, ...sharedTreeGroups]) {
        group.traverse((node) => { if (node instanceof THREE.InstancedMesh) node.dispose(); });
        group.removeFromParent();
      }
    },
  };
}
