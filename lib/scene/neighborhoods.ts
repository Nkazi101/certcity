import * as THREE from "three";
import { ModelKit, seededRandom } from "./model-kit";
import { landmark } from "./sites";
import { makePerson } from "./actors";
import { marketAllotments } from "./st-louis-layout";
import { gardenBorder, parkBench, waterRipples } from "./park-details";

function flowerbed(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, width: number, seed: number) {
  const bed = kit.group(parent, [x, .015, z]);
  kit.box(bed, [0, .115, 0], [width, .215, .75], kit.material("#c5a980"), true);
  kit.box(bed, [0, .225, 0], [width - .14, .038, .57], kit.material("#7d633f"));
  const random = seededRandom(seed);
  const flowers = ["#f7b073", "#c97671", "#efd487", "#bc92b0", "#f4e4bd"];
  for (let dx = -width / 2 + .25; dx < width / 2 - .15; dx += .31) {
    const dz = (random() - .5) * .39;
    kit.foliage(bed, [dx, .33, dz], [.34, .28, .35], random() < .5 ? "#639348" : "#8cad5c");
    kit.sphere(bed, [dx + .025, .475, dz], [.161, .105, .15], kit.material(flowers[Math.floor(random() * flowers.length)]));
    kit.sphere(bed, [dx + .025, .533, dz], [.059, .045, .051], kit.material("#ebba55"));
  }
}

function streetStall(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, color: string, food: string, angle = 0) {
  const stall = kit.group(parent, [x, .015, z], angle);
  const wood = kit.material("#ad7953");
  const linen = kit.material("#f0d9a3");
  kit.box(stall, [0, .423, 0], [1.82, .76, .75], wood, true);
  kit.box(stall, [0, .846, 0], [2.01, .13, .9], kit.material("#d4a978"), true);
  for (const px of [-.88, .88]) {
    for (const pz of [-.35, .35]) kit.box(stall, [px, 1.01, pz], [.075, 2.02, .075], wood, true);
  }
  const stripe = kit.material(color);
  for (let i = 0; i < 8; i++) {
    const part = kit.box(stall, [-.875 + .25 * i, 2.0, -.05], [.252, .08, 1.25], i % 2 ? linen : stripe, true);
    part.rotation.x = .21;
    kit.box(stall, [-.875 + .25 * i, 1.84, .57], [.25, .18, .055], i % 2 ? linen : stripe, true);
  }
  const produce = kit.material(food);
  const leaves = kit.material("#639253");
  const crate = kit.material("#bc8853");
  for (const [i, bin] of [-.58, 0, .58].entries()) {
    kit.box(stall, [bin, .952, .087], [.49, .056, .48], wood);
    for (const side of [-1, 1]) {
      kit.box(stall, [bin + side * .223, 1.015, .087], [.042, .105, .48], crate);
      kit.box(stall, [bin, 1.015, .087 + side * .217], [.42, .105, .04], crate);
    }
    for (const col of [-.142, 0, .142]) {
      for (const row of [-.11, .056]) {
        const px = bin + col, pz = .089 + row;
        kit.sphere(stall, [px, 1.055, pz], i === 1 ? [.126, .126, .147] : [.141, .106, .141], produce);
        if (i === 1) kit.foliage(stall, [px + .026, 1.122, pz], [.085, .033, .068], "#64904c");
        if (i === 2) kit.box(stall, [px, 1.109, pz], [.029, .041, .026], leaves, true);
      }
    }
  }
}

function shutteredWindow(kit: ModelKit, group: THREE.Object3D, x: number, y: number, z: number, trim: string) {
  kit.window(group, [x, y, z], .63, .89, 0, true);
  for (const side of [-1, 1]) {
    kit.box(group, [x + side * .506, y, z + .08], [.22, .96, .09], kit.material(trim), true);
    for (const louver of [-.29, -.1, .09, .27]) {
      kit.box(group, [x + side * .506, y + louver, z + .132], [.179, .028, .014], kit.material("#87a18c"));
    }
  }
}

function marketHall(kit: ModelKit, city: THREE.Group) {
  const x = -34.65, z = -9.45;
  const market = kit.group(city, [x, .025, z]);
  const terracotta = kit.material("#bd7657", "brick");
  const limestone = kit.material("#eddbb2");
  const frame = kit.material("#5b8071");
  kit.ground(market, 0, 1.47, 15.9, 10.6, kit.material("#e2c49a", "pavers"), .004);
  kit.contactShadow(market, 0, -.79, 13.1, 6.1, .023);
  kit.box(market, [0, 2.51, -.79], [10.6, 5.02, 4.65], terracotta);
  const mainRoof = kit.group(market, [0, 0, -.79]);
  kit.roof(mainRoof, 5.02, 10.6, 4.65, 1.28, "#a85544", terracotta);
  for (const y of [2.7, 4.98]) kit.box(market, [0, y, -.77], [10.73, .14, 4.78], limestone, true);
  for (const w of [-4.14, -2.68, -1.28, 1.29, 2.72, 4.14]) shutteredWindow(kit, market, w, 3.97, 1.551, "#648b77");
  for (const w of [-4.28, -2.51, -.8, .89, 2.64, 4.36]) {
    kit.box(market, [w, 1.13, 1.635], [1.3, 2.2, .21], limestone, true);
    kit.box(market, [w, 1.02, 1.751], [1.09, 1.96, .1], frame, true);
    kit.box(market, [w, 1.23, 1.813], [.9, 1.26, .026], kit.material("#abaf82"));
    kit.box(market, [w, 1.17, 1.837], [.075, 1.89, .035], frame);
  }
  for (const zOff of [-2.16, -.66, .69]) {
    kit.window(market, [5.31, 3.93, zOff], .77, 1.02, Math.PI / 2);
    kit.window(market, [5.31, 1.38, zOff], .75, .93, Math.PI / 2, true);
  }
  kit.box(market, [0, 2.48, 2.16], [10.62, .2, 1.48], frame, true);
  for (const px of [-4.91, -3.28, -1.63, 0, 1.67, 3.3, 4.9]) {
    kit.cylinder(market, [px, 1.18, 2.74], .22, 2.41, limestone);
    kit.cylinder(market, [px, .17, 2.74], .35, .29, limestone);
  }
  kit.sign(market, "JEFFERSON MARKET", [0, 3.04, 1.589], 4.15, ["#526e58", "#fff0c7"]);
  streetStall(kit, market, -4.1, 4.68, "#c98264", "#d29850", .07);
  streetStall(kit, market, -1.35, 4.58, "#799985", "#aeb657", 0);
  streetStall(kit, market, 1.35, 4.65, "#caab63", "#c57158", -.04);
  streetStall(kit, market, 4.04, 4.67, "#8aa4a1", "#e5b76c", -.09);
  const cart = kit.group(market, [5.58, .016, .94], Math.PI * .27);
  const iron = kit.material("#505a55");
  for (const side of [-1, 1]) {
    const wheel = kit.cylinder(cart, [side * .21, .11, 0], .20, .075, iron, true);
    wheel.rotation.z = Math.PI / 2;
    const rail = kit.box(cart, [side * .15, .46, -.075], [.045, .78, .054], iron, true);
    rail.rotation.x = -.17;
  }
  kit.box(cart, [0, .85, -.137], [.39, .052, .061], iron, true);
  kit.box(cart, [0, .14, .095], [.38, .055, .29], iron, true);
  kit.box(cart, [0, .28, .11], [.34, .25, .27], kit.material("#c49162"), true);
  flowerbed(kit, market, -6.22, 3.4, 1.41, 133);
  flowerbed(kit, market, 6.27, 3.25, 1.47, 25);
  kit.tree(market, -6.8, -2.39, 1.03, 33);
  kit.tree(market, 6.57, -1.32, .86, 14);
  const site = landmark("market-hall", x, z + .9, 11.9, 6.42, 6.35);
  site.anchor.set(x, 5.59, z + 1.51);
  return site;
}

function bookshop(kit: ModelKit, city: THREE.Group) {
  const x = -33.0, z = 7.62;
  const shop = kit.group(city, [x, .023, z]);
  const walls = kit.material("#d3ae83", "brick");
  const side = kit.material("#a98d6c");
  const timber = kit.material("#527768");
  const cream = kit.material("#f2deaf");
  kit.ground(shop, 0, .89, 8.21, 7.22, kit.material("#e2caa1", "pavers"), .004);
  kit.box(shop, [0, 2.21, 0], [5.55, 4.42, 4.1], walls);
  kit.box(shop, [0, 4.43, 0], [5.72, .21, 4.34], cream, true);
  kit.roof(shop, 4.52, 5.4, 4.1, 1.57, "#678f7d", side);
  for (const ox of [-1.57, .05, 1.56]) shutteredWindow(kit, shop, ox, 3.32, 2.075, "#5f8979");
  for (const dx of [-1.85, 1.4]) {
    kit.box(shop, [dx, 1.33, 2.28], [1.31, 1.96, .27], timber, true);
    kit.box(shop, [dx, 1.44, 2.432], [1.16, 1.64, .04], kit.material("#bfbe8b"));
    for (const dy of [.91, 1.53, 2.04]) kit.box(shop, [dx, dy, 2.457], [1.11, .056, .03], timber);
  }
  kit.box(shop, [-.25, 1.02, 2.12], [.79, 2.03, .14], timber, true);
  kit.box(shop, [-.25, .13, 2.38], [1.3, .23, .76], cream, true);
  kit.box(shop, [0, 2.53, 2.43], [5.57, .24, .76], timber, true);
  kit.sign(shop, "BOOKS", [0, 2.87, 2.125], 1.56, ["#496e60", "#fff1cb"]);
  for (const py of [.34, .67]) kit.box(shop, [2.46, py, 3.25], [1.06, .08, .55], kit.material("#9b754e"), true);
  for (let i = 0; i < 7; i++) {
    kit.box(shop, [2.01 + i * .149, .833, 3.26], [.112, .245, .28], kit.material(["#b97360", "#78a59b", "#ddb574", "#8b8a67"][i % 4]), true);
  }
  flowerbed(kit, shop, -2.17, 3.65, 1.89, 59);
  kit.tree(shop, -3.44, -1.24, .86, 41);
  return landmark("bookshop", x, z, 5.75, 4.88, 6.11);
}

function greenhouse(kit: ModelKit, city: THREE.Group) {
  const x = -34.45, z = 16.91;
  const group = kit.group(city, [x, .02, z]);
  const glass = kit.material("#b7d9cd");
  glass.transparent = true;
  glass.opacity = .5;
  glass.depthWrite = false;
  glass.roughness = .45;
  const metal = kit.material("#5e9184");
  const base = kit.material("#c7a678", "brick");
  kit.ground(group, 0, .4, 12.7, 8.65, kit.material("#b5bc7a", "grass"), .009);
  kit.ground(group, 0, 2.9, 11.95, 1.08, kit.material("#d8c6a1", "pavers"), .014);
  kit.box(group, [0, .266, -.53], [5.48, .53, 4.48], base, true);
  for (const side of [-1, 1]) {
    kit.box(group, [0, 1.4, -.52 + side * 2.17], [5.31, 1.82, .027], glass).castShadow = false;
    kit.box(group, [side * 2.66, 1.4, -.52], [.026, 1.82, 4.34], glass).castShadow = false;
    const roof = kit.box(group, [0, 2.94, -.52 + side * 1.12], [5.47, .047, 2.62], glass);
    roof.rotation.x = side * .54;
    roof.castShadow = false;
    for (let i = -3; i <= 3; i++) {
      const frame = kit.box(group, [i * .78, 2.96, -.52 + side * 1.12], [.077, .071, 2.66], metal, true);
      frame.rotation.x = side * .54;
    }
    kit.box(group, [0, 2.26, -.52 + side * 2.18], [5.49, .086, .092], metal, true);
    kit.box(group, [side * 2.66, 2.23, -.52], [.073, .083, 4.38], metal);
    for (const benchZ of [-1.63, .16]) {
      kit.box(group, [side * 1.47, .65, benchZ], [1.43, .27, 1.2], base, true);
      for (const offset of [-.44, 0, .44]) {
        kit.foliage(group, [side * 1.47 + offset, .91, benchZ], [.49, .44, .69], "#789855");
      }
    }
  }
  kit.box(group, [0, 3.62, -.52], [5.62, .087, .099], metal, true);
  for (let i = -3; i <= 3; i++) {
    kit.box(group, [i * .77, 1.45, 1.66], [.073, 1.73, .081], metal);
    for (const y of [.9, 1.91]) kit.box(group, [i * .77, y, 1.704], [.67, .041, .043], metal);
  }
  for (let side = -1; side <= 1; side += 2) {
    for (let section = -2; section <= 2; section++) {
      kit.box(group, [side * 2.68, 1.41, -.5 + section * .8], [.08, 1.82, .08], metal);
    }
  }
  kit.box(group, [0, 1.12, 1.77], [.79, 2.17, .114], metal, true);
  kit.box(group, [0, 1.4, 1.838], [.63, 1.38, .029], kit.material("#99b6a2"));
  kit.sign(group, "GROW HOUSE", [0, 2.15, 1.839], 1.98, ["#608a74", "#fff2c6"]);
  for (const side of [-1, 1]) {
    for (const offset of [-1.67, -.44, .84]) {
      const bed = kit.group(group, [side * 4.16, 0, offset], Math.PI / 2);
      flowerbed(kit, bed, 0, 0, 1.78, Math.floor(offset * 113 + 247));
    }
  }
  for (const dx of [-2.77, 2.8]) flowerbed(kit, group, dx, 2.92, 1.86, 57);
  kit.tree(group, -5.8, -1.74, .96, 21);
  return landmark("greenhouse", x, z, 6.05, 4.72, 3.79);
}

function library(kit: ModelKit, city: THREE.Group) {
  const x = 7.78, z = -36.3;
  const group = kit.group(city, [x, .023, z]);
  const walls = kit.material("#d4bf97", "brick");
  const stone = kit.material("#f3dfb7");
  kit.ground(group, 0, .9, 10.78, 9.3, kit.material("#dcc9a7", "pavers"), .006);
  kit.contactShadow(group, 0, .45, 8.7, 6.98, .023);
  kit.box(group, [0, 1.86, 0], [7.37, 3.69, 5.24], walls);
  kit.box(group, [0, .24, 0], [7.55, .43, 5.44], stone, true);
  kit.roof(group, 3.7, 7.37, 5.24, 1.34, "#708c80", walls);
  const portico = kit.group(group, [0, 0, 2.92], Math.PI / 2);
  kit.roof(portico, 3.43, 2.65, 3.69, 1.1, "#638479", stone);
  kit.box(group, [0, 3.363, 2.99], [3.76, .23, 2.55], stone, true);
  for (const px of [-1.63, -.68, .68, 1.63]) {
    kit.cylinder(group, [px, 1.8, 3.77], .3, 2.9, stone, true);
    kit.cylinder(group, [px, .35, 3.77], .43, .19, stone);
    kit.cylinder(group, [px, 3.22, 3.77], .41, .16, stone);
  }
  for (let level = 0; level < 3; level++) kit.box(group, [0, .062 + level * .105, 4.3 - level * .17], [4.21 - level * .19, .126, .79], stone, true);
  kit.box(group, [0, 1.38, 2.646], [1.08, 2.36, .16], kit.material("#6a8f7d"), true);
  kit.sign(group, "LUCAS LIBRARY", [0, 3.319, 4.28], 1.98, ["#e2cca5", "#526750"]);
  for (const px of [-2.61, 2.61]) kit.window(group, [px, 1.87, 2.637], .89, 1.6, 0, true);
  for (const pz of [-1.4, -.1, 1.32]) kit.window(group, [3.7, 1.89, pz], .91, 1.42, Math.PI / 2);
  flowerbed(kit, group, -3.53, 3.72, 2.38, 21);
  flowerbed(kit, group, 3.35, 3.74, 2.32, 13);
  kit.tree(group, -4.55, -1.14, .82, 14);
  return landmark("library", x, z + .34, 7.75, 6.2, 5.14);
}

function pavilion(kit: ModelKit, city: THREE.Group) {
  const x = -9.73, z = -35.45;
  const pavilion = kit.group(city, [x, .026, z]);
  const sage = kit.material("#7d9a82");
  const clay = kit.material("#d2a878", "brick");
  kit.ground(pavilion, 0, 1.18, 14.3, 8.4, kit.material("#d7c6a1", "pavers"), .005);
  kit.box(pavilion, [0, 1.48, -1.05], [9.12, 2.96, 4.83], clay, true);
  for (const w of [-3.45, -2.32, -1.16, 1.16, 2.32, 3.45]) kit.window(pavilion, [w, 1.44, 1.38], .84, 1.57, 0, true);
  kit.box(pavilion, [0, 1.14, 1.419], [1.22, 2.28, .16], sage, true);
  kit.box(pavilion, [0, 3.125, -.84], [9.39, .32, 5.28], sage, true);
  const skylight = kit.group(pavilion, [-1.76, 0, -.95], Math.PI / 2);
  kit.box(skylight, [0, 3.38, 0], [2.87, .25, 4.2], kit.material("#b3cbb3"), true);
  kit.roof(skylight, 3.45, 2.8, 4.22, .69, "#79a395", kit.material("#a4baaa"));
  for (const w of [-3.55, -.73, 2.15, 4.12]) kit.cylinder(pavilion, [w, 1.5, 2.3], .18, 2.99, sage, true);
  kit.box(pavilion, [0, 3.04, 2.01], [9.17, .21, 1.31], sage, true);
  kit.sign(pavilion, "LUCAS COMMUNITY CENTER", [0, 2.83, 2.68], 4.08, ["#648674", "#fff0c6"]);
  const court = kit.group(pavilion, [-5.51, .005, 3.16], Math.PI / 2);
  kit.ground(court, 0, 0, 4.6, 2.65, kit.material("#bc886c"), .012);
  for (const sign of [-1, 1]) kit.ground(court, 0, sign * 1.16, 4.27, .044, kit.material("#f3d1a5"), .019);
  kit.ground(court, 0, 0, .042, 2.34, kit.material("#f3d1a5"), .019);
  flowerbed(kit, pavilion, 3.53, 3.15, 2.7, 97);
  kit.tree(pavilion, 5.52, .02, .98, 57);
  kit.tree(pavilion, -5.94, -1.84, .93, 39);
  return landmark("community", x, z - .4, 9.45, 5.5, 4.18);
}

function garden(kit: ModelKit, city: THREE.Group) {
  const x = 17.7, z = -36.84;
  const garden = kit.group(city, [x, .026, z]);
  const gravel = kit.material("#e5cc9f", "pavers");
  const stone = kit.material("#ddc79c");
  const green = kit.material("#a2c06d", "grass");
  kit.ground(garden, .5, 0, 8.4, 13.9, green, .009);
  kit.ground(garden, .5, 0, 1.15, 13.35, gravel, .013);
  kit.ground(garden, .5, .25, 7.83, 1.06, gravel, .014);
  kit.cylinder(garden, [.45, .135, 2.21], 3.05, .23, stone);
  const gazebo = kit.group(garden, [.45, .25, 2.21]);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    kit.cylinder(gazebo, [Math.cos(angle) * 1.22, 1.12, Math.sin(angle) * 1.22], .143, 2.25, kit.material("#f3dbb1"));
  }
  const roof = kit.geometry(new THREE.CylinderGeometry(.14, 1.66, .9, 8));
  const canopy = new THREE.Mesh(roof, kit.material("#668c81"));
  canopy.position.set(0, 2.59, 0);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  gazebo.add(canopy);
  kit.cylinder(gazebo, [0, 3.11, 0], .18, .28, stone, true);
  kit.cylinder(garden, [.46, .088, -2.69], 3.42, .14, stone);
  kit.cylinder(garden, [.46, .165, -2.69], 3.13, .044, kit.material("#78a6aa"));
  kit.cylinder(garden, [.46, .39, -2.69], .5, .52, stone);
  kit.cylinder(garden, [.46, .698, -2.69], .91, .14, stone, true);
  for (const side of [-1, 1]) {
    for (const offset of [-5.78, -3.93, 1.44, 4.73]) {
      const bed = kit.group(garden, [side * 2.3 + .45, 0, offset], Math.PI / 2);
      flowerbed(kit, bed, 0, 0, 1.65, Math.floor(147 + side * offset * 27));
    }
    kit.tree(garden, side * 3.35 + .5, -4.94, .91, side < 0 ? 9 : 57);
    kit.tree(garden, side * 3.49 + .48, 4.48, .82, side < 0 ? 47 : 63);
    gardenBorder(kit, garden, side * 3.4 + .45, -.61, 2.7, 1.12, Math.PI / 2, side < 0 ? 47 : 62);
    gardenBorder(kit, garden, side * 2.85 + .45, 5.93, 2.5, 1.28, side * -.11, side < 0 ? 73 : 89);
    parkBench(kit, garden, side * 1.74 + .45, -.92, side * .74, .032);
  }
  const site = landmark("gardens", x + .45, z + 1.08, 7.92, 11.8, 3.47);
  site.anchor.z = z + 2.23;
  return site;
}

function allotments(kit: ModelKit, district: THREE.Group) {
  const { x, z, width, depth } = marketAllotments;
  const garden = kit.group(district, [x, .015, z]);
  const dirt = kit.material("#a37750", "brick");
  const path = kit.material("#d6b888", "pavers");
  const timber = kit.material("#aa7d52");
  const fence = kit.material("#e3c69a");
  kit.ground(garden, 0, 0, width, depth, kit.material("#83a953", "grass"), .033);
  kit.ground(garden, 0, -.15, 1.12, 17.15, path, .039);
  kit.ground(garden, 0, -.17, 15.94, 1.18, path, .04);
  const crops = [
    ["#5b8e42", "#d99c39"], ["#669547", "#b84c3e"], ["#6b9a50", "#815883"], ["#77a353", "#cfbb62"],
  ];
  for (const sign of [-1, 1]) {
    for (const along of [-3.81, 3.7]) {
      const bed = kit.group(garden, [sign * 3.65, 0, along]);
      kit.box(bed, [0, .106, 0], [5.1, .19, 4.91], dirt, true);
      for (const edge of [-1, 1]) {
        kit.box(bed, [edge * 2.49, .19, 0], [.14, .245, 4.95], timber, true);
        kit.box(bed, [0, .19, edge * 2.43], [5.1, .245, .153], timber, true);
      }
      for (let row = 0; row < 4; row++) {
        const [leaves, fruit] = crops[(row + (sign > 0 ? 1 : 0) + (along > 0 ? 1 : 0)) % crops.length];
        kit.box(bed, [0, .215, (row - 1.5) * .95], [4.68, .072, .48], kit.material("#966d46"), true);
        for (let cell = 0; cell < 8; cell++) {
          const x = (cell - 3.5) * .536;
          const z = (row - 1.5) * .95 + Math.sin(cell * 1.28) * .059;
          const tall = row === 1 || row === 3;
          const size = .28 + cell % 3 * .051;
          if (tall) kit.box(bed, [x + .16, .46, z], [.044, .57, .043], fence, true);
          kit.foliage(bed, [x, tall ? .53 : .344, z], [size, tall ? .43 : .25, size * .94], leaves);
          kit.sphere(bed, [x + .055, tall ? .55 : .463, z + .126], [.14, .128, .13], kit.material(fruit));
        }
      }
    }
    for (const z of [-6.92, 6.9]) {
      for (const x of [sign * 7.95, sign * 5.89, sign * 3.88]) {
        kit.box(garden, [x, .37, z], [.152, .73, .16], fence, true);
      }
      kit.box(garden, [sign * 5.87, .37, z], [4.12, .072, .087], fence, true);
    }
    kit.box(garden, [sign * 7.95, .38, 0], [.084, .074, 14.13], fence, true);
    for (const z of [-4.69, -2.3, 0, 2.3, 4.69]) {
      kit.box(garden, [sign * 7.95, .37, z], [.15, .73, .156], fence, true);
    }
  }
  const shed = kit.group(garden, [-9.16, .02, -2.7], Math.PI / 2);
  const siding = kit.material("#8f654d", "brick");
  kit.box(shed, [0, .91, 0], [2.6, 1.82, 2.34], siding);
  kit.roof(shed, 1.82, 2.59, 2.34, .76, "#567c65", siding);
  kit.box(shed, [0, .68, 1.2], [.92, 1.36, .11], kit.material("#739185"), true);
  kit.sign(shed, "TOOL SHED", [0, 1.64, 1.197], 1.29, ["#735942", "#f4dfaf"]);
  for (const [x, z, seed] of [[-8.9, 4.3, 11], [-8.72, 6.7, 22], [8.76, -5.24, 27], [9.45, 2.78, 33], [8.53, 5.58, 15]]) {
    kit.tree(garden, x, z, 1.01, seed);
  }
  kit.sign(garden, "ALLOTMENTS", [0, 1.05, 6.91], 1.36, ["#6b8156", "#fff2c3"]);
  for (const x of [-.48, .48]) kit.box(garden, [x, .49, 6.9], [.086, .98, .085], timber, true);
}

function greenbelt(kit: ModelKit, district: THREE.Group) {
  const random = seededRandom(391);
  const gravel = kit.material("#c5b28a", "pavers");
  kit.ground(district, 11.85, -54.8, 17.44, 9.32, kit.material("#93b867", "grass"), -.009);
  kit.ground(district, 11.3, -53.7, 18.3, 1.09, gravel, .008);
  for (let i = 0; i < 16; i++) {
    const x = 2.7 + (i % 8) * 2.5 + random();
    const z = i < 8 ? -57.1 - random() * 1.9 : -50.85 + random() * .37;
    kit.tree(district, x, z, .77 + random() * .43, 15 + i * 2);
  }
  for (const x of [6.7, 12.3, 17.2]) flowerbed(kit, district, x, -55.2, 2.01, Math.round(x * 43));
}

export function addDistrictLandmarks(kit: ModelKit, scene: THREE.Scene) {
  const market = new THREE.Group();
  const civic = new THREE.Group();
  const neighbors = new THREE.Group();
  scene.add(market, civic, neighbors);
  const landmarks = [
    marketHall(kit, market),
    bookshop(kit, market),
    greenhouse(kit, market),
    library(kit, civic),
    pavilion(kit, civic),
    garden(kit, civic),
  ];
  allotments(kit, market);
  greenbelt(kit, civic);
  const gardenWater = waterRipples(kit, scene, [[18.16, .217, -39.53, 1.18], [18.05, .218, -39.62, .83]]);
  kit.batch(market);
  kit.batch(civic);
  const activities = [
    [-38.8, -5.8, Math.PI, "#71937a"],
    [-35.9, -3.93, Math.PI * .88, "#c48851"],
    [-30.64, -4.78, Math.PI / 2, "#b67b87"],
    [marketAllotments.x + .9, marketAllotments.z + 3.59, -Math.PI / 2, "#638e82"],
    [marketAllotments.x - 1.16, marketAllotments.z - 2.06, -Math.PI / 2, "#d9a04e"],
    [18.68, -37.29, Math.PI, "#cf876a"],
  ] as const;
  const residents = activities.map(([x, z, angle, coat], index) => {
    const resident = makePerson(kit, neighbors, [coat, index % 2 ? "#99694d" : "#d4a282", "#4e3930"], .79, index);
    resident.person.position.set(x, .022, z);
    resident.person.rotation.y = angle;
    return resident;
  });
  return {
    landmarks,
    update(time: number) {
      residents.forEach((resident, index) => resident.work(time * 2.3 + index));
      gardenWater.update(time);
    },
    dispose: gardenWater.dispose,
  };
}
