import { stLouisExpansion } from "./st-louis";
import * as THREE from "three";
import { followRoute, makePerson, makeVehicle } from "./actors";
import { ModelKit, seededRandom } from "./model-kit";

import { landmark } from "./sites";
import type { Environment } from "./sites";
import { addDistrictLandmarks } from "./neighborhoods";
import { addDowntown } from "./downtown";
import type { ModelState } from "./gltf";
import { addRiverfront } from "./riverfront";
import { grandDrive, marketStreetSurface, streetRibbon, trafficLane } from "./st-louis-streets";
import { followRoad } from "./streets";
import { addCitySigns } from "./signage";

function addRoads(kit: ModelKit, city: THREE.Group) {
  const grass = kit.material("#8fb956", "grass");
  const grassColors = ["#98bc60", "#94b95b", "#8db456", "#97ba5d"];
  const { width: streetWidth, sidewalkWidth, asphalt: roadColor, paving, seamX, roadY, sidewalkY } = marketStreetSurface;
  const sidewalk = kit.material(paving, "pavers");
  const curb = kit.material("#eee0c4");
  const asphalt = kit.material(roadColor, "road");
  const line = kit.material("#ece3cd");
  const centerLine = kit.material("#e1ba71");
  const random = seededRandom(57);
  kit.ground(city, 0, 0, 250, 250, grass, -.04);
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      kit.ground(city, col * 14, row * 14, 14, 14, kit.material(grassColors[(row * row + col * col) % 4], "grass"), -.02);
    }
  }

  const roads = [0, -24, 24];
  const roadEdge = streetWidth / 2;
  for (const z of roads) {
    const westApproach: [number, number][] = [[seamX,z],[19.75,z],[24,z]];
    const blend = (x: number, from: number, to: number) =>
      THREE.MathUtils.lerp(from, to, THREE.MathUtils.clamp((x - 19.75) / 4.25, 0, 1));
    streetRibbon(kit, city, westApproach, sidewalkWidth, paving, (x) => blend(x, sidewalkY, .023), "pavers");
    streetRibbon(kit, city, westApproach, streetWidth, roadColor, (x) => blend(x, roadY, .059), "road");
    for (const sign of [-1, 1]) {
      for (const [start, end] of [[seamX, -27.7], [-19.95, -4.05], [4.05, 19.75]]) {
        kit.box(city, [(start + end) / 2, .103, z + sign * (roadEdge + .055)], [end - start, .056, .11], curb);
      }
    }
    for (let x = seamX + 1.2; x <= 21; x += 2.3) {
      if (roads.some((r) => Math.abs(r - x) < 4.7)) continue;
      kit.ground(city, x, z, .98, .068, centerLine, roadY + .006);
    }
  }
  for (const x of [0, -24]) {
    const end = x === -24 ? 50.5 : 66;
    kit.ground(city, x, (-80 + end) / 2, sidewalkWidth, 80 + end, sidewalk, .021);
    kit.ground(city, x, (-80 + end) / 2, streetWidth, 80 + end, asphalt, roadY - .002);
    for (const [z, span] of [[-71,18],[-45,36],[-12,15.9],[12,15.9],[x === -24 ? 36 : 44,x === -24 ? 17 : 34]]) {
      for (const sign of [-1, 1]) {
        kit.box(city, [x + sign * (roadEdge + .07), .063, z], [.17, .12, span], curb);
        kit.ground(city, x + sign * (roadEdge - .24), z, .046, span, line, roadY + .004);
      }
      for (let pos = -span / 2; pos <= span / 2; pos += 2.3) {
        kit.ground(city, x, z + pos, .068, .94, centerLine, roadY + .005);
      }
    }
  }
  for (const x of [-24, 0]) {
    for (const z of roads) {
      for (const sign of [-1, 1]) {
        for (let stripe = -1.71; stripe < 1.83; stripe += .57) {
          kit.ground(city, x + stripe, z + sign * 2.63, .33, .71, line, roadY + .018);
          kit.ground(city, x + sign * 2.63, z + stripe, .71, .33, line, roadY + .018);
        }
      }
    }
  }

  for (let patch = 0; patch < 120; patch++) {
    const x = random() * 96 - 48;
    const z = random() * 93 - 46;
    if (roads.some((r) => Math.abs(x - r) < 4.4 || Math.abs(z - r) < 4.4)) continue;
    kit.ground(city, x, z, .26 + random() * .65, .15 + random() * .39,
      kit.material(random() < .5 ? "#a8c96e" : "#9bbc62"), .007);
  }
}

function lamp(kit: ModelKit, group: THREE.Object3D, x: number, z: number) {
  const cast = kit.material("#52665b");
  kit.cylinder(group, [x, .1, z], .34, .2, cast);
  kit.cylinder(group, [x, 1.05, z], .095, 2.1, cast, true);
  kit.box(group, [x, 2.18, z], [.29, .28, .29], kit.material("#fff1bd"), true);
  kit.cylinder(group, [x, 2.36, z], .37, .1, cast, true);
}

function bench(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, angle = 0) {
  const bench = kit.group(parent, [x, .02, z], angle);
  for (const side of [-1, 1]) kit.box(bench, [side * .51, .22, 0], [.1, .42, .44], kit.material("#53665b"), true);
  for (let n = 0; n < 3; n++) {
    kit.box(bench, [0, .445, .17 - n * .135], [1.47, .075, .103], kit.material("#bd8c57"), true);
    kit.box(bench, [0, .57 + n * .11, -.22], [1.46, .08, .063], kit.material("#b57f4d"), true);
  }
}

function flatBuilding(kit: ModelKit, group: THREE.Group, width: number, depth: number, height: number, walls: string, trim: string) {
  kit.box(group, [0, height / 2, 0], [width, height, depth], kit.material(walls, "brick"));
  kit.box(group, [0, .22, 0], [width + .13, .36, depth + .13], kit.material("#afaa91"));
  kit.box(group, [0, height + .07, 0], [width + .25, .29, depth + .25], kit.material(trim), true);
  kit.box(group, [0, height + .235, 0], [width + .15, .095, depth + .13], kit.material("#e5d6b5", "pavers"));
  kit.box(group, [width * .21, height + .47, -depth * .2], [.83, .37, .77], kit.material("#aaa99d"), true);
  for (let i = -1; i < 2; i++) kit.box(group, [width * .21, height + .67, -depth * .2 + i * .13], [.64, .045, .055], kit.material("#74817c"));
}

function addSchool(kit: ModelKit, parent: THREE.Group) {
  const x = -11.5, z = -10.8;
  const group = kit.group(parent, [x, .015, z]);
  const walls = kit.material("#c37651", "brick");
  const trim = kit.material("#f0d9b3");
  kit.ground(group, 0, 1.1, 11.4, 10.3, kit.material("#dfc9a4", "pavers"), .002);
  kit.box(group, [0, 2.1, 0], [9.1, 4.2, 4.8], walls);
  kit.box(group, [0, 2.36, 0], [9.18, .13, 4.9], trim);
  kit.box(group, [0, .19, 0], [9.28, .34, 4.93], trim);
  kit.roof(group, 4.2, 9.1, 4.8, 1.58, "#5c7773", walls);
  const tower = kit.group(group, [0, 0, 1.82]);
  kit.box(tower, [0, 2.94, 0], [2.08, 5.9, 1.74], walls);
  kit.roof(tower, 5.9, 2.15, 1.88, 1.15, "#607a74", walls);
  kit.box(tower, [0, 3.83, .9], [2.14, .19, .2], trim);
  kit.box(tower, [0, .96, .925], [1.06, 1.92, .17], kit.material("#507571"), true);
  kit.box(tower, [0, .083, 1.2], [1.61, .15, .61], trim, true);
  const clock = kit.cylinder(tower, [0, 4.87, .92], .83, .09, trim);
  clock.rotation.x = Math.PI / 2;
  kit.box(tower, [0, 4.96, .975], [.038, .23, .036], kit.material("#4d5b4d"));
  kit.box(tower, [.086, 4.86, .975], [.193, .037, .036], kit.material("#4d5b4d"));
  kit.sign(tower, "SCHOOL", [0, 2.4, .936], 1.78, ["#f0d9b3", "#6b4d3c"]);
  for (const wing of [-1, 1]) {
    for (const offset of [1.58, 2.63, 3.68]) {
      for (const y of [1.24, 3.14]) kit.window(group, [wing * offset, y, 2.414], .67, .91, 0, offset === 2.63);
    }
    for (const side of [-1.35, -.15, 1.05]) {
      kit.window(group, [wing * 4.558, 1.42, side], .75, 1.08, wing * Math.PI / 2);
      kit.window(group, [wing * 4.558, 3.1, side], .75, 1.03, wing * Math.PI / 2);
    }
  }
  kit.tree(group, -4.7, 3.48, .81, 13);
  kit.tree(group, 4.62, 3.55, .75, 9);
  for (const i of [-4, -3.45, 3.45, 4]) kit.shrub(group, i, 3.18, 1.15, true);
  bench(kit, group, -2.8, 3.54);
  const flag = kit.material("#d39a60");
  kit.cylinder(group, [3.39, 1.52, 4.25], .055, 3, kit.material("#818777"));
  kit.box(group, [3.78, 2.78, 4.25], [.76, .46, .04], flag);
  const playground = kit.group(parent, [-18.15, .024, -11.7]);
  kit.ground(playground, 0, 0, 3.62, 6.15, kit.material("#cab388", "pavers"), .008);
  kit.ground(playground, .08, .44, 2.8, 3.1, kit.material("#d5a06c"), .017);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const support = kit.box(playground, [side * 1.11, .82, end * .61], [.106, 1.74, .11], kit.material("#6c9483"), true);
      support.rotation.x = -end * .35;
    }
  }
  kit.box(playground, [0, 1.61, 0], [2.48, .12, .114], kit.material("#568779"), true);
  for (const seat of [-.55, .55]) {
    for (const cord of [-.16, .16]) kit.box(playground, [seat + cord, 1.05, .02], [.026, 1.12, .026], kit.material("#82735a"));
    kit.box(playground, [seat, .49, .02], [.43, .08, .28], kit.material("#d88961"), true);
  }
  kit.tree(playground, -.95, -2.14, .84, 61);
  for (let i = 0; i < 6; i++) kit.shrub(playground, -1.62, -2.62 + i * .91, .86, i % 2 === 0);
  const site = landmark("school", x, z, 9.5, 5.5, 7.15);
  site.anchor.set(x - 1.28, 5.13, z + 2.51);
  return site;
}

function addOffice(kit: ModelKit, parent: THREE.Group) {
  const x = 10.4, z = -11.9;
  const group = kit.group(parent, [x, .025, z]);
  const facade = kit.material("#a1b6a2");
  const trim = kit.material("#f0dfb9");
  kit.ground(group, 0, 1.5, 10.1, 9.8, kit.material("#d9c9ab", "pavers"), .002);
  kit.box(group, [0, 3.44, 0], [7.7, 6.88, 5.65], facade, true);
  kit.box(group, [0, 6.94, 0], [8.06, .23, 5.98], trim, true);
  kit.box(group, [.95, 7.23, -.91], [2.14, .43, 1.48], kit.material("#99a498"), true);
  kit.box(group, [-2.5, 7.15, 1.01], [1.8, .11, 2.4], kit.material("#a7b987", "grass"), true);
  for (const zOff of [.32, 1.1, 1.83]) {
    kit.box(group, [-2.77, 7.25, zOff], [1.23, .19, .48], kit.material("#b6ac8c"), true);
    kit.foliage(group, [-2.77, 7.48, zOff], [1.09, .44, .38], "#83a662");
  }
  for (const level of [1.06, 2.78, 4.52, 6.09]) {
    kit.box(group, [0, level + .68, 2.88], [7.7, .14, .29], trim, true);
    kit.box(group, [3.89, level + .68, 0], [.24, .14, 5.67], trim, true);
    for (let i = -3; i < 4; i++) kit.window(group, [i * .97, level, 2.87], .72, .98, 0, i === 2 && level === 2.78);
    for (let i = -2; i <= 2; i++) kit.window(group, [3.84, level, i * .95], .69, .98, Math.PI / 2);
  }
  kit.box(group, [0, .95, 2.995], [1.65, 1.9, .19], kit.material("#4b747a"), true);
  kit.box(group, [0, 2.03, 3.34], [2.88, .18, .83], kit.material("#7b9a91"), true);
  kit.sign(group, "NORTHLINE", [0, 2.23, 3.787], 2.32, ["#476a68", "#f3e7c8"]);
  for (const i of [-3.7, -2.8, 2.7, 3.6]) kit.shrub(group, i, 3.44, 1.22, true);
  kit.tree(group, -4.42, .1, .83, 42);
  kit.tree(group, 4.45, 3.53, .83, 27);
  return landmark("office", x, z, 8.1, 6.2, 7.45);
}

function addRestaurant(kit: ModelKit, parent: THREE.Group) {
  const x = -14.3, z = 8.8;
  const group = kit.group(parent, [x, .02, z]);
  const walls = kit.material("#e1b37d", "brick");
  const red = kit.material("#b45d48");
  const cream = kit.material("#f4ddad");
  kit.ground(group, 0, 1.45, 10.2, 9, kit.material("#d9be94", "pavers"), .005);
  kit.box(group, [0, 1.73, 0], [7.05, 3.46, 4.57], walls);
  kit.roof(group, 3.46, 7.05, 4.57, 1.4, "#b7654c", walls);
  kit.box(group, [2.22, 4.3, -.62], [.52, 1.21, .65], kit.material("#a9654d", "brick"));
  kit.box(group, [2.22, 4.96, -.62], [.62, .14, .76], kit.material("#e1b98b"), true);
  kit.box(group, [-.22, .86, 2.324], [.93, 1.7, .12], kit.material("#637969"), true);
  for (const offset of [-2.35, -1.35, .96, 2.35]) kit.window(group, [offset, 1.37, 2.292], .72, 1.15, 0, true);
  for (const offset of [-1.35, .04, 1.33]) kit.window(group, [3.54, 1.46, offset], .72, .93, Math.PI / 2, true);
  for (let i = 0; i < 12; i++) {
    const awning = kit.box(group, [-3.31 + i * .602, 2.35, 2.65], [.61, .11, 1.02], i % 2 ? cream : red);
    awning.rotation.x = .22;
    kit.box(group, [-3.31 + i * .602, 2.19, 3.14], [.6, .21, .065], i % 2 ? cream : red, true);
  }
  kit.sign(group, "JUNIPER", [0, 2.97, 2.32], 2.46, ["#a75443", "#fff1cc"]);
  for (const [tx, tz] of [[-2.55, 4.04], [0, 4.59], [2.53, 4.03]]) {
    kit.cylinder(group, [tx, .39, tz], .12, .78, kit.material("#596b58"));
    kit.cylinder(group, [tx, .8, tz], .94, .12, kit.material("#bd885a"));
    kit.cylinder(group, [tx, 1.54, tz], .065, 1.42, cream);
    kit.cylinder(group, [tx, 2.07, tz], 1.65, .35, red, true);
    for (const direction of [-1, 1]) {
      kit.box(group, [tx + direction * .77, .43, tz], [.39, .13, .39], kit.material("#b28a59"), true);
      kit.box(group, [tx + direction * .93, .65, tz], [.085, .43, .39], kit.material("#846b48"), true);
    }
  }
  kit.tree(group, -4.22, 3.48, .84, 33);
  for (const xPos of [-3.92, 3.74]) {
    kit.box(group, [xPos, .25, 3.98], [.52, .48, 1.48], kit.material("#c08e64"), true);
    for (const zPos of [3.49, 3.92, 4.39]) kit.foliage(group, [xPos, .62, zPos], [.51, .49, .46], "#70934f");
  }
  for (const i of [-3.89, -3.41, 3.28, 3.82]) kit.shrub(group, i, 4.9, .96, true);
  return landmark("restaurant", x, z, 7.6, 5.12, 4.9);
}

function rollup(kit: ModelKit, parent: THREE.Group, x: number, z: number, color: string) {
  kit.box(parent, [x, 1.17, z], [1.87, 2.27, .19], kit.material("#526c61"), true);
  kit.box(parent, [x, 1.16, z + .11], [1.68, 2.12, .09], kit.material(color));
  for (let i = 1; i < 11; i++) kit.box(parent, [x, i * .184 + .12, z + .167], [1.66, .045, .041], kit.material("#ece0ba"));
}

function addService(kit: ModelKit, parent: THREE.Group, id: "shop" | "dispatch", x: number, z: number) {
  const depot = id === "dispatch";
  const width = depot ? 7.6 : 6.05;
  const depth = depot ? 4.85 : 4.0;
  const height = depot ? 3.43 : 3.16;
  const group = kit.group(parent, [x, .02, z]);
  kit.ground(group, 0, 1.2, width + 2.6, depth + 5.3, kit.material("#d4c8a7", "pavers"), .005);
  flatBuilding(kit, group, width, depth, height, depot ? "#e6c990" : "#b9c29a", "#508778");
  rollup(kit, group, -width * .23, depth / 2 + .054, depot ? "#c9b678" : "#9ea99e");
  if (depot) rollup(kit, group, .25, depth / 2 + .052, "#c9b678");
  else kit.window(group, [.36, 1.5, depth / 2 + .07], .93, 1.22);
  kit.box(group, [width * .32, .91, depth / 2 + .097], [.86, 1.81, .18], kit.material("#456c62"), true);
  kit.box(group, [width * .32, 2.11, depth / 2 + .316], [1.18, .15, .64], kit.material("#4c8174"), true);
  kit.sign(group, depot ? "CITY DISPATCH" : "REPAIR SHOP", [-.38, height - .53, depth / 2 + .035], depot ? 4.0 : 3.64, ["#4e7a6c", "#fff1ce"]);
  for (const zOff of [-depth / 3, .1, depth / 3]) kit.window(group, [width / 2 + .015, 1.89, zOff], .54, .68, Math.PI / 2);
  kit.tree(group, width / 2 + .65, -depth / 2, .67, 16);
  for (const xOff of [-width * .4, width * .44]) kit.shrub(group, xOff, depth * .59, 1, true);
  if (depot) {
    const van = makeVehicle(kit, group, "#e6b559", true);
    van.position.set(.7, .04, depth / 2 + 2.1);
    van.rotation.y = Math.PI / 2;
    for (const [i, shift] of [-2.7, -2.02, -2.35].entries()) {
      kit.box(group, [shift, .27, depth / 2 + 1.35 + i * .26], [.53, .54, .58], kit.material("#bf9058"), true);
      kit.box(group, [shift, .545, depth / 2 + 1.35 + i * .26], [.095, .025, .54], kit.material("#ead4a6"));
    }
  }
  return landmark(id, x, z, width + .4, depth + .32, height + .37);
}

type HomeStyle = "gable" | "cottage" | "townhouse" | "terrace";
const homeStyles: HomeStyle[] = ["gable", "cottage", "townhouse", "terrace"];

function house(kit: ModelKit, parent: THREE.Object3D, x: number, z: number, color: string, roof: string,
  scale = 1, style: HomeStyle = "gable") {
  const home = kit.group(parent, [x, .022, z]);
  home.scale.setScalar(scale);
  const walls = kit.material(color, "brick");
  const raised = style === "townhouse" || style === "terrace";
  const threshold = raised ? .49 : 0;
  if (raised) home.scale.x *= style === "townhouse" ? .81 : .89;
  kit.ground(home, 0, .85, 4.42, 5.91, kit.material("#a8c577", "grass"), .001);
  const height = style === "cottage" ? 2.1 : style === "townhouse" ? 4.12 : 3.11;
  kit.contactShadow(home, 0, 0, 4.62, 4.28, .013);
  kit.box(home, [0, height / 2, 0], [3.61, height, 3.52], walls);
  kit.box(home, [0, .19, 0], [3.73, .32, 3.64], kit.material("#d9c5a4"), true);
  if (style === "terrace") {
    kit.box(home, [0, height, 0], [3.91, .24, 3.89], kit.material(roof), true);
    kit.box(home, [-1.73, height + .25, 0], [.2, .34, 3.75], kit.material("#d1be96"), true);
    kit.box(home, [0, height + .26, 1.75], [3.6, .34, .18], kit.material("#d1be96"), true);
    kit.box(home, [.7, height + .2, -.78], [1.15, .26, .75], kit.material("#8fad82"), true);
    kit.foliage(home, [.72, height + .44, -.81], [1.09, .43, .64], "#72945c");
  } else {
    kit.roof(home, height, 3.61, 3.52, style === "cottage" ? .84 : 1.21, roof, walls);
    kit.box(home, [1.01, height + .47, -.44], [.48, .91, .49], kit.material("#aa7359", "brick"));
    kit.box(home, [1.01, height + .95, -.44], [.58, .13, .56], kit.material("#e2c196"), true);
    if (style === "townhouse") {
      const dormer = kit.group(home, [-.59, height + .36, .91]);
      const surround = kit.material("#dac4a1");
      kit.box(dormer, [0, .33, 0], [.77, .65, .66], surround, true);
      kit.roof(dormer, .64, .77, .66, .29, roof, surround);
      kit.window(dormer, [0, .32, .335], .49, .495);
    }
  }
  kit.box(home, [0, .73 + threshold, 1.797], [.7, 1.43, .14], kit.material("#527367"), true);
  for (const side of [-1, 1]) {
    kit.window(home, [side * .96, 1.02, 1.78], .65, .86, 0, side === 1);
    if (style !== "cottage") kit.window(home, [side * .96, 2.35, 1.78], .66, .73);
  }
  if (style === "townhouse") {
    kit.box(home, [0, 2.28, 1.93], [1.06, 1.36, .47], kit.material("#ded0ac"), true);
    kit.window(home, [0, 2.37, 2.177], .75, .94, 0, true);
    kit.window(home, [0, 3.46, 1.78], .72, .79);
    kit.box(home, [0, 3.02, 2.15], [1.27, .16, .68], kit.material(roof), true);
  }
  if (style !== "cottage") kit.window(home, [1.823, 2.31, -.64], .68, .82, Math.PI / 2);
  kit.window(home, [1.823, 1.01, .64], .68, .84, Math.PI / 2);
  const limestone = kit.material("#ddc7a5");
  const risers = raised ? 4 : 1;
  for (let i = 0; i < risers; i++) {
    const height = .148 * (i + 1);
    const reach = .95 - .18 * i;
    kit.box(home, [0, height * .5, 1.79 + reach * .5], [1.19, height, reach], limestone, true);
  }
  if (raised) {
    const iron = kit.material("#48575b");
    for (const side of [-1, 1]) {
      kit.box(home, [side*.56, .31, 2.68], [.046, .52, .046], iron);
      kit.box(home, [side*.56, .69, 1.94], [.046, .55, .046], iron);
      const railing = kit.box(home, [side*.56, .755, 2.31], [.04, .04, .84], iron, true);
      railing.rotation.x = .46;
    }
    kit.box(home, [0, 2.04, 1.85], [1.08, .18, .27], limestone, true);
    kit.box(home, [0, .98, 1.876], [.054, .109, .049], kit.material("#d2a060"));
  } else kit.box(home, [0, 1.58, 1.97], [.97, .13, .43], kit.material(roof), true);
  for (const side of [-1, 1]) {
    kit.box(home, [side * .96, .52, 1.977], [.72, .16, .23], kit.material("#a27b53"), true);
    for (const n of [-.24, 0, .24]) {
      kit.foliage(home, [side * .96 + n, .645, 2.0], [.26, .18, .18], "#739951");
      kit.sphere(home, [side * .96 + n, .744, 2.011], [.106, .094, .09], kit.material(side === 1 ? "#e7aa84" : "#f2cf7b"));
    }
  }
  kit.ground(home, 0, 2.89, .67, 1.26, kit.material("#ddd2b3", "pavers"), .022);
  kit.shrub(home, 1.35, 2.19, 1.12, true);
  kit.shrub(home, -1.39, 2.24, 1.02, true);
}

function addPark(kit: ModelKit, city: THREE.Group) {
  const park = kit.group(city, [10.9, .021, 5.74]);
  const stone = kit.material("#dcccaa", "pavers");
  const trim = kit.material("#e9d8b4");
  kit.ground(park, 0, 0, 11.6, 3.45, stone, .006);
  kit.cylinder(park, [0, .13, 0], 3.05, .26, kit.material("#c5ae88"));
  kit.cylinder(park, [0, .276, 0], 2.9, .13, trim);
  kit.cylinder(park, [0, .351, 0], 2.61, .04, kit.material("#78aea6"));
  kit.cylinder(park, [0, .63, 0], .43, .58, trim);
  kit.cylinder(park, [0, .94, 0], .83, .14, kit.material("#eadab9"), true);
  kit.cylinder(park, [0, 1.07, 0], .105, .28, kit.material("#a4cbc3"));
  for (const x of [-4.36, -3.67, 3.66, 4.31]) kit.shrub(park, x, -.98, 1.09, true);
  bench(kit, park, -2.88, .35);
  bench(kit, park, 2.88, .35);
  for (const x of [-4.71, 4.72]) lamp(kit, park, x, .99);
  for (const x of [-5.06, 5.04]) kit.tree(park, x, -1.1, .73, x > 0 ? 18 : 34);
}

function surroundings(kit: ModelKit, city: THREE.Group) {
  const random = seededRandom(173);
  const homes = ["#bb7057", "#aa604d", "#cb8c6b", "#d0b48b", "#c07858"];
  for (const z of [-29.9, -20.5, 20.6, 30.9]) {
    for (const x of [-43.5, -37.5, -29, -18, -7.3, 7.2, 17.4, 28.8, 34, 41]) {
      if (x > 24) continue;
      if (z === 20.6 && x > -38 && x < 24) continue;
      if (z === -29.9 && x > -18 && x < 24) continue;
      house(kit, city, x + (random() - .5) * .49, z + (random() - .5) * .52, homes[Math.floor(random() * homes.length)],
        ["#788b77", "#a66f58", "#787d83"][Math.floor(random() * 3)], .78 + random() * .28, homeStyles[Math.floor(random() * homeStyles.length)]);
      if (random() > .29) kit.tree(city, x + 2.15, z - 1.8, .65 + random() * .42, Math.floor(random() * 80));
    }
  }
  for (const x of [-44.2]) {
    for (const z of [-15.8, -8.1, 7.4, 15.6]) {
      if (z > 0) continue;
      house(kit, city, x, z, homes[Math.floor(random() * homes.length)], "#768a78",
        .85 + random() * .19, homeStyles[Math.floor(random() * homeStyles.length)]);
      kit.tree(city, x + 1.95, z - 1.83, .67 + random() * .54, Math.floor(random() * 79));
    }
  }
  for (const z of [-48.8, -43.85, 37.55, 43.37]) {
    for (const x of [-38.6, -29.6, -19.45, -12.0, -4.78, 5.6, 14.8, 20.7, 28.1, 37.4]) {
      if (x > 24) continue;
      if (random() > .36) house(kit, city, x, z, homes[Math.floor(random() * homes.length)],
        ["#829b85", "#ba8068", "#6d8d93"][Math.floor(random() * 3)], .77 + random() * .24,
        homeStyles[Math.floor(random() * homeStyles.length)]);
      kit.tree(city, x + 2.58, z + .71, .74 + random() * .61, Math.floor(random() * 70));
    }
  }
  for (const x of [-21, -17.6, -9, -5.5, 5.1, 17.9, 21.3]) {
    kit.tree(city, x, -4.55, .6 + random() * .37, Math.floor(random() * 51));
    if (x < -17 || x > 16) kit.tree(city, x, 4.6, .69 + random() * .42, Math.floor(random() * 81));
  }
  for (const [x, z] of [[-4.29, -15.6], [-4.29, -8.1], [4.3, -6.2], [-4.3, 5.2], [-4.3, 16.4], [4.3, 16.1], [-17.6, -3.42], [20.6, -3.43], [19.7, 3.43]]) {
    lamp(kit, city, x, z);
  }
}

export function buildCity(kit: ModelKit, scene: THREE.Scene, onArtState: (state: ModelState) => void, invalidate: () => void): Environment {
  const city = new THREE.Group();
  scene.add(city);
  addRoads(kit, city);
  const landmarks = [
    addSchool(kit, city),
    addOffice(kit, city),
    addRestaurant(kit, city),
    addService(kit, city, "shop", 12.5, 10.4),
    addService(kit, city, "dispatch", -9.65, 17.25),
  ];
  for (const [x, color, roof, style] of [
    [4.8, "#d6b482", "#647d75", "townhouse"], [9.1, "#a6bd98", "#a06f58", "cottage"],
    [13.42, "#e0bc96", "#607d7c", "gable"], [17.8, "#aebbc0", "#637d77", "terrace"],
  ] as const) {
    house(kit, city, x, 17.48, color, roof, 1.04, style);
  }
  landmarks.push(landmark("homes", 11.4, 17.48, 17.6, 4.0, 4.6));
  addPark(kit, city);
  surroundings(kit, city);
  kit.batch(city);
  const neighborhoods = addDistrictLandmarks(kit, scene);
  landmarks.push(...neighborhoods.landmarks);
  const expansion = stLouisExpansion(kit, scene, invalidate);
  landmarks.push(...expansion.landmarks);
  const downtown = addDowntown(kit, scene, onArtState, expansion);
  landmarks.push(...downtown.landmarks);
  const riverfront = addRiverfront(kit, scene);
  landmarks.push(...riverfront.landmarks);
  const signage = addCitySigns(kit, scene, invalidate);

  const actors = new THREE.Group();
  scene.add(actors);
  const clothes: [string, string, string][] = [
    ["#bd7652", "#be8767", "#654935"],
    ["#498879", "#a77455", "#42352d"],
    ["#9a7793", "#d2a485", "#72513c"],
    ["#d0a248", "#dfb394", "#593f31"],
    ["#638aa6", "#b58162", "#503b2c"],
  ];
  const pedestrians = [
    [[-18, 4.15], [-5.6, 4.15], [-4.3, 5.55], [-4.3, 20.8], [-8.5, 21], [-18, 21], [-19.1, 18.8], [-19.1, 5.3]],
    [[4.05, 3.4], [20.2, 3.4], [20.6, 18.4], [18.8, 20.5], [4.15, 20.5]],
    [[-19.7, -4], [-4.18, -4], [-4.18, -18.8], [-19.9, -18.8]],
    [[4.18, -4.0], [20.7, -4.0], [20.7, -18.7], [4.18, -18.7]],
    [[-41, -4.6], [-28, -4.6], [-27.9, 2.9], [-41, 2.9]],
    [[-40.3, 12.7], [-29.95, 12.7], [-30, 19.8], [-39.4, 19.8]],
    [[-15.1, -31.6], [-3.2, -31.6], [-3.2, -27], [-15.2, -27]],
    [[4.02, -30.8], [21.2, -30.8], [21.2, -42.8], [4.02, -42.8]],
  ] as [number, number][][];
  const animate = pedestrians.flatMap((path, group) => (group < 4 ? [0, 1, 2] : [0, 1]).map((index) => {
    const worker = makePerson(kit, actors, clothes[(group + index) % clothes.length], .74 + index * .085);
    const route = followRoute(path, 1.03 + index * .09, index * 7.5 + group * 3.1);
    return (time: number) => {
      route(time, worker.person);
      worker.walk(time * 8 + index);
    };
  }));
  const westLoop = trafficLane([[-24,-24],[0,-24],[0,0],[-24,0]], 0, 0);
  const traffic = [
    { path: westLoop, color: "#c78d65", phase: 34 },
    { path: trafficLane([[-65.3,0],[-24,0],[-24,24],...grandDrive.slice(1).reverse()], 0, 0), color: "#e2e1c9", phase: 23 },
    { path: trafficLane([[0,0],[24,0],[24,24],[0,24]], 0, 0), color: "#668f94", phase: 40 },
    { path: trafficLane([[-24,-90],[-19,-95],[-8,-95],[-2,-90],[0,-80],[0,-24],[-24,-24]], 0, 0),
      color: "#8eaaa1", phase: 108 },
  ];
  for (const { path, color, phase } of traffic) {
    const vehicle = makeVehicle(kit, actors, color);
    const route = followRoad(path, 3.8, phase);
    animate.push((time) => {
      route(time, vehicle);
      vehicle.position.y = THREE.MathUtils.lerp(marketStreetSurface.roadY, .063,
        THREE.MathUtils.clamp((vehicle.position.x - 19.75) / 3.1, 0, 1)) + .012;
    });
  }
  let viewX = 49.5, viewZ = 0;
  const update = (time: number) => {
    if (viewX > -28 && viewX < 113 && viewZ > -77 && viewZ < 80) downtown.update(time);
    if (viewX > -97 && viewX < 76 && Math.abs(viewZ) < 92) {
      animate.forEach((actor) => actor(time));
      neighborhoods.update(time);
    }
    if (viewX > 72 && viewZ > -37) riverfront.update(time);
    expansion.update(time);
  };
  update(0);
  return {
    landmarks,
    links: signage.links,
    conversations: downtown.conversations,
    setAssignmentComplete: downtown.setAssignmentComplete,
    update,
    focusDistrict: expansion.focus,
    cameraNear(x, z) {
      viewX = x;
      viewZ = z;
      expansion.near(x, z);
    },
    dispose() {
      signage.dispose();
      downtown.dispose?.();
      neighborhoods.dispose();
      riverfront.dispose?.();
      expansion.dispose();
    },
  };
}
