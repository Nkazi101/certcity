import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { canopyGeometry, CityBatches } from "./city-batches";
import { paintedSurface, cityColor } from "./city-paint";
import type { Surface } from "./city-paint";

type Position = readonly [number, number, number];
type Material = THREE.MeshStandardMaterial;

export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function surfaceTexture(kind: Surface) {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const random = seededRandom(1854);
  ctx.fillStyle = { grass: "#ffffff", road: "#e5e7e0", pavers: "#dfd8c3", brick: "#d6b8a0", shingles: "#a4a494", stone: "#f6f0df" }[kind];
  ctx.fillRect(0, 0, size, size);

  if (kind === "brick" || kind === "shingles" || kind === "pavers") {
    const brick = kind === "brick";
    const width = brick ? 43 : kind === "pavers" ? 64 : 32;
    const height = brick ? 23 : kind === "pavers" ? 64 : 17;
    for (let y = 0, row = 0; y < size; y += height, row++) {
      for (let x = -width + (row % 2) * width / 2; x < size; x += width) {
        const light = brick ? 80 + random() * 15 : 83 + random() * 9;
        ctx.fillStyle = `hsl(${brick ? 15 : 44} ${brick ? 39 : 13}% ${light}%)`;
        ctx.fillRect(x, y, width - 1.5, height - 1.5);
        ctx.fillStyle = "#ffffff1e";
        ctx.fillRect(x + 1, y + 1, width - 3, 1);
      }
    }
  }

  if (kind === "stone") {
    for (let i = 0; i < 550; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = 1.4 + random() * 9;
      const glaze = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glaze.addColorStop(0, random() < .54 ? "#99795e2a" : "#fffdf367");
      glaze.addColorStop(1, "#ffffff00");
      ctx.fillStyle = glaze;
      ctx.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
    }
  }

  for (let index = 0; index < 7400; index++) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillStyle = random() < .5 ? "#ffffff16" : kind === "grass" ? "#526b331d" : "#3f4d3920";
    ctx.fillRect(x, y, 1 + random() * 4, 1 + random() * (kind === "grass" ? 5 : 2));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = kind;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export class ModelKit {
  private readonly materials = new Map<string, Material>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly groundTiles = new Map<string, THREE.BufferGeometry>();
  private readonly boxGeometry = this.geometry(new THREE.BoxGeometry(1, 1, 1));
  private readonly beveledBox: THREE.BufferGeometry;
  private readonly ball: THREE.BufferGeometry;
  private readonly leaves: THREE.BufferGeometry;
  private readonly cityBatches?: CityBatches;
  private readonly pole = this.geometry(new THREE.CylinderGeometry(.42, .5, 1, 12));
  private readonly round = this.geometry(new THREE.CylinderGeometry(.5, .5, 1, 20));
  private readonly panel = this.geometry(new THREE.PlaneGeometry(1, 1));
  private readonly gable = this.geometry(this.gableGeometry());

  constructor(readonly city = false) {
    this.cityBatches = city ? new CityBatches() : undefined;
    this.beveledBox = this.geometry(new RoundedBoxGeometry(1, 1, 1, city ? 1 : 2, city ? .065 : .075));
    this.ball = this.geometry(new THREE.SphereGeometry(.5, city ? 8 : 12, city ? 6 : 9));
    this.leaves = this.geometry(canopyGeometry(city));
  }

  material(color: string, texture?: Surface) {
    const key = `${color}|${texture ?? ""}`;
    let material = this.materials.get(key);
    if (!material) {
      let map = texture ? this.textures.get(texture) : undefined;
      if (texture && !map) {
        map = this.city ? paintedSurface(texture, seededRandom(1854)) : surfaceTexture(texture);
        this.textures.set(texture, map);
      }
      material = new THREE.MeshStandardMaterial({ color: this.city ? cityColor(color, texture) : color, map: map ?? null, roughness: .91 });
      this.materials.set(key, material);
    }
    return material;
  }

  geometry<T extends THREE.BufferGeometry>(geometry: T) {
    this.geometries.add(geometry);
    return geometry;
  }

  private gableGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(-.5, 0);
    shape.lineTo(0, 1);
    shape.lineTo(.5, 0);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -.5);
  }

  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: Material, position: Position, size: Position) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...size);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  box(parent: THREE.Object3D, position: Position, size: Position, material: Material, rounded = false) {
    return this.mesh(parent, rounded ? this.beveledBox : this.boxGeometry, material, position, size);
  }

  ground(parent: THREE.Object3D, x: number, z: number, width: number, depth: number, material: Material, y = .015) {
    let surface: THREE.BufferGeometry = this.panel;
    if (material.map) {
      const span = material.map.name === "grass" ? 4.7 : material.map.name === "road" ? 4.2 : 2.8;
      const key = `${width},${depth},${span}`;
      surface = this.groundTiles.get(key) ?? this.geometry(this.panel.clone());
      if (!this.groundTiles.has(key)) {
        const uv = surface.getAttribute("uv");
        for (let index = 0; index < uv.count; index++) {
          uv.setXY(index, uv.getX(index) * width / span, uv.getY(index) * depth / span);
        }
        this.groundTiles.set(key, surface);
      }
    }
    const plane = this.mesh(parent, surface, material, [x, y, z], [width, depth, 1]);
    plane.rotation.x = -Math.PI / 2;
    plane.castShadow = false;
    return plane;
  }

  contactShadow(parent: THREE.Object3D, x: number, z: number, width: number, depth: number, y = .024) {
    let material = this.materials.get("contact-shadow");
    if (!material) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      const gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 32);
      gradient.addColorStop(0, this.city ? "#272844be" : "#2d3d22a3");
      gradient.addColorStop(.56, this.city ? "#34284076" : "#2d3d2270");
      gradient.addColorStop(1, "#2d3d2200");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      this.textures.set("contact-shadow", map);
      material = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1 });
      this.materials.set("contact-shadow", material);
    }
    const shadow = this.mesh(parent, this.panel, material, [x, y, z], [width, depth, 1]);
    shadow.rotation.x = -Math.PI / 2;
    shadow.castShadow = false;
    return shadow;
  }

  sphere(parent: THREE.Object3D, position: Position, size: Position, material: Material) {
    return this.mesh(parent, this.ball, material, position, size);
  }

  foliage(parent: THREE.Object3D, position: Position, size: Position, color: string) {
    const key = `foliage|${color}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color: this.city ? cityColor(color, "leaves") : color, vertexColors: true, roughness: this.city ? .91 : 1 });
      this.materials.set(key, material);
    }
    const foliage = this.mesh(parent, this.leaves, material, position, size);
    foliage.rotation.y = (position[0] * 1.4 + position[2] * 2) % Math.PI;
    return foliage;
  }

  cylinder(parent: THREE.Object3D, position: Position, width: number, height: number, material: Material, tapered = false) {
    return this.mesh(parent, tapered ? this.pole : this.round, material, position, [width, height, width]);
  }

  group(parent: THREE.Object3D, position: Position, angle = 0) {
    const group = new THREE.Group();
    group.position.set(...position);
    group.rotation.y = angle;
    parent.add(group);
    return group;
  }

  roof(parent: THREE.Object3D, y: number, width: number, depth: number, rise: number, color: string, walls: Material) {
    const gable = this.mesh(parent, this.gable, walls, [0, y, 0], [depth, rise, width]);
    gable.rotation.y = Math.PI / 2;
    const roof = this.material(color, "shingles");
    const slope = Math.atan2(rise, depth / 2);
    const length = Math.hypot(rise, depth / 2) + .35;
    for (const side of [-1, 1]) {
      const plate = this.box(parent, [0, y + rise / 2 + .07, side * depth / 4], [width + .52, .16, length], roof);
      plate.rotation.x = side * slope;
      this.box(parent, [0, y - .035, side * (depth / 2 + .14)], [width + .54, .13, .19], this.material("#f3dec0"));
    }
    this.box(parent, [0, y + rise + .11, 0], [width + .53, .13, .2], this.material(color));
  }

  window(parent: THREE.Object3D, position: Position, width: number, height: number, turn = 0, warm = false) {
    const window = this.group(parent, position, turn);
    const trim = this.material("#efdbb7");
    const frame = this.material("#4e6b64");
    this.box(window, [0, 0, .025], [width + .15, height + .14, .105], trim);
    this.box(window, [0, 0, .085], [width, height, .045], this.material(warm ? "#e9b875" : "#69999c"));
    this.box(window, [0, 0, .117], [width, .045, .032], frame);
    this.box(window, [0, 0, .117], [.043, height, .032], frame);
    this.box(window, [0, -height / 2 - .083, .119], [width + .23, .105, .25], trim);
  }

  sign(parent: THREE.Object3D, text: string, position: Position, width: number, palette: [string, string]) {
    const key = `sign|${text}|${palette.join("|")}`;
    let material = this.materials.get(key);
    if (!material) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = palette[0];
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = palette[1];
      ctx.globalAlpha = .47;
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, 492, 108);
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette[1];
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.font = "700 63px system-ui";
      ctx.fillText(text, 256, 62, 458);
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(key, map);
      material = new THREE.MeshStandardMaterial({ map, roughness: .88 });
      this.materials.set(key, material);
    }
    const sign = this.mesh(parent, this.panel, material, position, [width, width / 4, 1]);
    sign.castShadow = false;
  }

  tree(parent: THREE.Object3D, x: number, z: number, size: number, seed: number) {
    const random = seededRandom(seed);
    const tree = this.group(parent, [x, .04, z]);
    tree.scale.setScalar(size);
    this.contactShadow(tree, 0, 0, 2.71, 2.43, .01);
    this.cylinder(tree, [0, .58, 0], .29, 1.18, this.material("#805634"), true);
    const colors = this.city
      ? seed % 9 === 0 ? ["#9f502d", "#d59a4c", "#bd733c"] :
        seed % 3 === 0 ? ["#385d55", "#789568", "#526d50"] : ["#2e645a", "#609778", "#9aa966"]
      : seed % 9 === 0 ? ["#b57c35", "#dfa44c", "#cd8f37"] :
        seed % 3 === 0 ? ["#578544", "#83a949", "#6c9841"] : ["#4e8549", "#71a956", "#8bb65a"];
    for (let i = 0; i < (this.city ? 6 : 9); i++) {
      const angle = i * 2.4;
      const radius = i ? .39 + random() * .35 : 0;
      const width = i === 0 ? 1.28 : .75 + random() * .81;
      this.foliage(tree, [Math.cos(angle) * radius, i ? 1.35 + random() * .83 : 2.13, Math.sin(angle) * radius],
        [width, width * .97, width * .94], colors[i % colors.length]);
    }
    return tree;
  }

  shrub(parent: THREE.Object3D, x: number, z: number, size = 1, flowers = false) {
    this.foliage(parent, [x, .19 * size, z], [.65 * size, .5 * size, .55 * size], "#769748");
    if (flowers) {
      this.sphere(parent, [x + .12 * size, .39 * size, z + .09 * size], [.13 * size, .12 * size, .13 * size], this.material("#eea38d"));
      this.sphere(parent, [x - .1 * size, .4 * size, z - .08 * size], [.12 * size, .1 * size, .12 * size], this.material("#f6ce75"));
    }
  }

  // Batch the static set by material and shadow behavior. Animated actors remain independent meshes.
  batch(group: THREE.Group) {
    if (this.cityBatches) this.cityBatches.merge(group, true);
    else this.mergeMeshes(group, true);
  }

  batchActor(group: THREE.Group, joints?: readonly THREE.Group[]) {
    this.cityBatches?.merge(group, false, joints);
  }

  actorShadow(parent: THREE.Object3D, width: number, depth: number) {
    if (this.city) {
      const shadow = this.contactShadow(parent, 0, 0, width, depth, .008);
      shadow.name = "Actor contact shadow";
    }
  }

  batchJoints(group: THREE.Group) {
    const joints: THREE.Group[] = [];
    group.traverse((object) => { if (object instanceof THREE.Group) joints.push(object); });
    for (const joint of joints) this.mergeMeshes(joint, false);
  }

  private mergeMeshes(group: THREE.Group, recursive: boolean) {
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const transform = new THREE.Matrix4();
    const buckets = new Map<string, { geometries: THREE.BufferGeometry[]; material: Material; casts: boolean }>();
    const meshes: THREE.Mesh[] = [];
    const collect = (object: THREE.Object3D) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      meshes.push(object);
      const material = object.material as Material;
      const key = `${material.id}/${object.castShadow}`;
      const bucket = buckets.get(key) ?? { geometries: [], material, casts: object.castShadow };
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(transform.multiplyMatrices(inverse, object.matrixWorld));
      bucket.geometries.push(geometry);
      buckets.set(key, bucket);
    };
    if (recursive) {
      group.traverse(collect);
      group.clear();
    } else {
      group.children.forEach(collect);
      if (meshes.length < 2) {
        buckets.forEach(({ geometries }) => geometries.forEach((geometry) => geometry.dispose()));
        return;
      }
      meshes.forEach((mesh) => mesh.removeFromParent());
    }
    for (const { geometries, material, casts } of buckets.values()) {
      const geometry = mergeGeometries(geometries);
      geometries.forEach((part) => part.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(this.geometry(geometry), material);
      mesh.castShadow = casts;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  dispose() {
    this.cityBatches?.dispose();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
  }
}
