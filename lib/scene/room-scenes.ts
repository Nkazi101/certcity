import type * as THREE from "three";
import type { RoomKind } from "../claude/mission-experiences";
import type { ModelKit } from "./model-kit";
import type { RoomPalette } from "./room-architecture";

export type RoomStation = readonly [x: number, z: number, width: number, depth: number, height: number];

function paper(kit: ModelKit, parent: THREE.Object3D, x: number, y: number, z: number, angle: number, color: string, line: string) {
  const sheet = kit.group(parent, [x, y, z], angle);
  kit.box(sheet, [0, 0, 0], [.44, .03, .55], kit.material(color), true);
  for (const [index, width] of [.28, .35, .31, .22].entries()) {
    kit.box(sheet, [(-.35 + width) / 2, .019, -.166 + index * .093], [width, .012, index === 0 ? .029 : .014], kit.material(line));
  }
}

function crate(kit: ModelKit, parent: THREE.Object3D, x: number, y: number, z: number, color: string, angle = 0, size = 1) {
  const basket = kit.group(parent, [x, y, z], angle);
  basket.scale.setScalar(size);
  const wood = kit.material("#aa7747");
  const edge = kit.material("#cd9a63");
  kit.box(basket, [0, .08, 0], [.92, .14, .73], wood, true);
  for (const side of [-1, 1]) {
    for (const height of [.158, .265]) {
      kit.box(basket, [side * .44, height, 0], [.077, .082, .73], edge, true);
      kit.box(basket, [0, height, side * .343], [.93, .08, .074], wood, true);
    }
    for (const dz of [-.31, .31]) kit.box(basket, [side * .42, .18, dz], [.09, .31, .09], edge, true);
  }
  for (let item = 0; item < 7; item++) {
    const left = -.24 + item % 3 * .23;
    const depth = -.17 + Math.floor(item / 3) * .17;
    kit.sphere(basket, [left, .296 + item % 2 * .059, depth], [.204, .177, .203], kit.material(color));
  }
}

function pendant(kit: ModelKit, room: THREE.Group, x: number, z: number, y: number, color: string, width = .80) {
  kit.cylinder(room, [x, y + .42, z], .046, .85, kit.material("#53463d"));
  const hood = kit.cylinder(room, [x, y, z], width, .22, kit.material(color), true);
  hood.rotation.z = Math.PI;
  kit.cylinder(room, [x, y - .107, z], width * .89, .043, kit.material("#f1e4b3"));
  kit.sphere(room, [x, y - .13, z], [.22, .14, .22], kit.material("#ffefba"));
}

function stool(kit: ModelKit, room: THREE.Group, x: number, z: number, color: string) {
  const iron = kit.material("#485856");
  kit.cylinder(room, [x, .59, z], .14, .57, iron, true);
  kit.cylinder(room, [x, .34, z], .59, .085, iron, true);
  kit.cylinder(room, [x, .87, z], .79, .12, kit.material(color), true);
}

function tray(kit: ModelKit, room: THREE.Group, x: number, y: number, z: number, color: string, width = .69) {
  const sides = kit.material(color);
  kit.box(room, [x, y + .045, z], [width, .087, .59], sides, true);
  for (const side of [-1, 1]) kit.box(room, [x + side * width / 2, y + .115, z], [.067, .15, .60], sides, true);
  kit.box(room, [x, y + .13, z - .284], [width, .22, .07], sides, true);
}

function consoleScreen(kit: ModelKit, room: THREE.Group, x: number, z: number, y: number, width: number, height: number, color: string) {
  kit.box(room, [x, y + .12, z - .05], [.12, .27, .11], kit.material("#464f52"), true);
  kit.box(room, [x, y + height / 2 + .20, z], [width, height, .14], kit.material("#3e515a"), true);
  kit.box(room, [x, y + height / 2 + .20, z + .08], [width - .12, height - .10, .025], kit.material(color));
}

function market(kit: ModelKit, room: THREE.Group, station: RoomStation, bulletin: boolean) {
  const green = kit.material("#476d56");
  const brass = kit.material("#bc8e54");
  const linen = kit.material("#efe0b4");
  const timber = kit.material("#99613e", "stone");
  for (const x of [-5.85, 6.06]) {
    kit.box(room, [x, 1.87, -2.88], [.14, 3.21, .146], timber, true);
    kit.box(room, [x, 1.87, -.66], [.14, 3.21, .146], timber, true);
    for (let stripe = 0; stripe < 7; stripe++) {
      const z = -2.91 + stripe / 2.7;
      const canvas = kit.box(room, [x, 3.45 - stripe * .037, z], [2.39, .09, .39], stripe % 2 ? linen : green, true);
      canvas.rotation.x = .13;
    }
    kit.box(room, [x, 3.14, -.47], [2.45, .18, .122], green, true);
  }
  for (const [x, y, z, color, angle, scale] of [
    [-5.09, 1.01, -1.19, "#bd6244", -.08, .98], [-4.05, 1.01, -1.32, "#bb9945", .07, .95],
    [-3.14, 1.01, -1.13, "#8ca055", -.18, .82], [4.06, 1.01, 1.37, "#7f9b62", .1, .95],
    [5.09, 1.01, 1.61, "#d39b49", -.08, .98], [5.86, .31, -.13, "#bc7956", .24, .95],
    [4.96, .31, -.39, "#9f9852", .08, 1],
  ] as const) crate(kit, room, x, y, z, color, angle, scale);
  const [x, z] = station;
  for (const offset of [-1.15, 1.15]) pendant(kit, room, x + offset, z - .12, 3.31, "#507355", .59);
  kit.ground(room, x, z + .39, 4.46, 2.24, kit.material("#988151", "stone"), .306);
  kit.ground(room, x, z + .39, 4.20, 2.03, kit.material("#bfac76", "stone"), .308);
  if (bulletin) {
    const bx = 1.20, bz = -3.91;
    kit.box(room, [bx, 2.0, bz], [4.47, 2.64, .23], green, true);
    kit.box(room, [bx, 1.84, bz + .128], [4.11, 1.92, .055], timber, true);
    kit.sign(room, "FRIDAY AT JEFFERSON MARKET", [bx, 2.98, bz + .142], 3.76, ["#476d56", "#fff1c3"]);
    for (let sheet = 0; sheet < 3; sheet++) {
      const px = bx + (sheet - 1) * 1.20;
      const notice = kit.group(room, [px, 1.83, bz + .174]);
      notice.rotation.z = -.055 + sheet * .047;
      const card = kit.material(sheet === 1 ? "#e3ad6d" : "#f3e8be");
      kit.box(notice, [0, 0, 0], [.86, 1.25, .035], card, true);
      kit.sphere(notice, [0, .51, .024], [.087, .086, .071], brass);
      for (let row = 0; row < 5; row++) {
        kit.box(notice, [row % 2 ? -.035 : .024, .284 - row * .145, .023], [row === 0 ? .62 : .55 - row * .034, row === 0 ? .072 : .031, .012], green);
      }
    }
    tray(kit, room, x + .98, 1.02, z + .32, "#657c56");
    kit.cylinder(room, [x - .73, 1.095, z - .16], .27, .14, kit.material("#ab5c44"), true);
    kit.sphere(room, [x - .73, 1.218, z - .16], [.12, .14, .12], brass);
  } else {
    kit.sign(room, "VENDOR SERVICE", [1.2, 2.80, -3.8], 3.36, ["#476d56", "#fff1c3"]);
    for (const offset of [-1.09, .99]) tray(kit, room, x + offset, 1.04, z + .13, offset < 0 ? "#ad7551" : "#637c59");
  }
}

function receiving(kit: ModelKit, room: THREE.Group, station: RoomStation) {
  const slate = kit.material("#537177");
  const iron = kit.material("#668487");
  const enameled = kit.material("#c3c9b8");
  const cream = kit.material("#e4dfc7");
  const [x, z] = station;
  kit.ground(room, -4.11, -.18, 5.7, 2.93, kit.material("#506b60", "stone"), .308);
  for (const line of [-1.51, 1.18]) kit.ground(room, -4.11, line, 5.61, .055, kit.material("#c5a46b"), .312);
  const shelving = kit.group(room, [3.64, .31, -4.10]);
  for (const cx of [-2.66, 0, 2.66]) for (const cz of [-.4, .48]) kit.box(shelving, [cx, 1.19, cz], [.115, 2.4, .125], iron, true);
  for (const level of [.27, .92, 1.59, 2.34]) {
    kit.box(shelving, [0, level, 0], [5.43, .112, .91], slate, true);
    if (level < 2) for (let bin = 0; bin < 7; bin++) {
      const shade = bin % 3 === 0 ? "#a26745" : bin % 3 === 1 ? "#bbb197" : "#728f79";
      const offset = -2.16 + .71 * bin;
      kit.box(shelving, [offset, level + .33, bin % 2 ? -.07 : .03], [.57, .48, .64], kit.material(shade), true);
      kit.box(shelving, [offset, level + .37, .371 - (bin % 2) * .10], [.28, .111, .018], cream);
    }
  }
  const dock = kit.group(room, [-4.40, .31, -4.84]);
  kit.box(dock, [0, 1.35, 0], [3.64, 2.70, .235], slate, true);
  for (let panel = 0; panel < 9; panel++) kit.box(dock, [0, .19 + panel * .29, .134], [3.28, .235, .043], iron, true);
  for (const offset of [-1.79, 1.79]) kit.box(dock, [offset, 1.34, .17], [.11, 2.67, .13], enameled, true);
  kit.box(dock, [0, 1.22, .182], [.62, .090, .13], slate, true);
  kit.sign(room, "RECEIVING", [-4.41, 3.11, -4.59], 2.2, ["#4b6969", "#f9e4b5"]);
  for (const lx of [-5.4, -3.28]) pendant(kit, room, lx, z, 3.24, "#557c78", .67);
  const receivingDesk = x < 0;
  const left = receivingDesk ? x - 1.38 : x - 1.12;
  const surface = receivingDesk ? 1.50 : 1.03;
  kit.box(room, [left, surface + .07, z - .09], [.66, .13, .64], slate, true);
  kit.box(room, [left, surface + .174, z - .09], [.59, .09, .53], enameled, true);
  kit.box(room, [left, surface + .080, z + .238], [.19, .057, .045], kit.material("#91b897"), true);
  tray(kit, room, x + 1.43, surface, z + .25, "#587c71");
  paper(kit, room, x + .45, surface + .021, z + .21, -.21, "#fbefce", "#bb7d5c");
  const cart = kit.group(room, [-2.87, .31, 2.55], -.18);
  kit.box(cart, [0, .41, 0], [1.16, .105, .83], slate, true);
  kit.box(cart, [0, .99, 0], [1.16, .105, .83], iron, true);
  for (const side of [-1, 1]) {
    kit.box(cart, [side * .50, .69, -.37], [.058, 1.04, .058], slate, true);
    for (const end of [-1, 1]) {
      kit.cylinder(cart, [side * .46, .102, end * .34], .185, .078, slate).rotation.z = Math.PI / 2;
    }
  }
  crate(kit, cart, .14, 1.05, -.05, "#bb7957", .10, .78);
  crate(kit, cart, -.12, .46, .03, "#87a274", -.10, .81);
}

function operations(kit: ModelKit, room: THREE.Group, incident: boolean) {
  const bank = kit.material("#486370");
  const edge = kit.material("#66838a");
  const key = kit.material("#afc8b6");
  const camera = kit.material("#a7c1c7");
  const accent = kit.material("#d7a36a");
  kit.ground(room, .42, .27, 10.64, 6.59, kit.material("#819a9b", "stone"), .307);
  kit.ground(room, .42, .27, 10.32, 6.25, kit.material("#617c83", "stone"), .309);
  kit.box(room, [1.17, 2.10, -4.59], [7.04, 2.62, .32], bank, true);
  kit.box(room, [1.17, 1.82, -4.416], [6.77, 1.73, .075], kit.material("#344d5d"), true);
  kit.sign(room, incident ? "REGIONAL OPERATIONS" : "SERVICE REVIEW", [1.17, 3.19, -4.414], 4.31, ["#466475", "#d9e7d5"]);
  for (const [index, px] of [-1.03, 1.16, 3.32].entries()) {
    kit.box(room, [px, 1.93, -4.36], [1.91, 1.32, .056], edge, true);
    kit.box(room, [px, 1.93, -4.321], [1.79, 1.15, .026], kit.material(index === 1 ? "#41636f" : "#3b5965"));
    if (index === 0) {
      for (let row = 0; row < 4; row++) {
        kit.box(room, [px - .65, 1.62 + row * .174, -4.302], [.127, .092, .017], row === 3 && incident ? accent : key);
        kit.box(room, [px - .05 + row * .032, 1.62 + row * .174, -4.304], [.85 + row * .05, .031, .016], camera);
      }
    } else if (index === 1) {
      const path = [.14, .29, .40, .83, .38, .49, .32];
      for (let bar = 0; bar < path.length; bar++) {
        kit.box(room, [px - .64 + bar * .21, 1.51 + path[bar] / 2, -4.3], [.138, path[bar], .038], bar === 3 && incident ? accent : key, true);
      }
    } else {
      for (let lane = 0; lane < 3; lane++) {
        kit.box(room, [px, 1.58 + lane * .302, -4.31], [1.40, .048, .034], edge);
        kit.box(room, [px - .27, 1.67 + lane * .302, -4.299], [.85 - lane * .16, .089, .016], lane === 1 && incident ? accent : key);
      }
    }
  }
  for (const x of [-4.62, 5.72]) {
    kit.box(room, [x, 1.50, -3.55], [1.05, 2.39, .77], bank, true);
    for (let slot = 0; slot < 9; slot++) {
      const y = .52 + slot * .234;
      kit.box(room, [x, y, -3.15], [.89, .155, .075], edge);
      kit.box(room, [x - .28, y + .012, -3.1], [.075, .048, .041], slot % 4 ? key : accent);
      kit.box(room, [x + .13, y, -3.10], [.32, .029, .05], bank);
    }
  }
  for (const x of [-1.77, 1.85, 4.4]) {
    kit.box(room, [x, 3.45, -2.07], [2.48, .12, .37], bank, true);
    kit.box(room, [x, 3.372, -2.07], [2.27, .044, .26], camera, true);
  }
  stool(kit, room, 2.19, 2.87, "#658790");
  stool(kit, room, -.98, -.39, "#887b62");
  consoleScreen(kit, room, 2.76, 1.47, .97, .92, .59, "#7599a6");
  consoleScreen(kit, room, 1.78, 1.43, .97, .80, .50, "#8aa99d");
  for (const x of [1.76, 2.64]) kit.box(room, [x, 1.035, 1.98], [.63, .048, .22], bank, true);
}

function reception(kit: ModelKit, room: THREE.Group, palette: RoomPalette) {
  const navy = kit.material("#4d6a85");
  const brass = kit.material("#ba8e54");
  kit.ground(room, -.81, 1.97, 9.52, 2.25, kit.material("#8c9cb0", "stone"), .308);
  for (const cx of [-6.75, -5.72, -4.7]) {
    kit.box(room, [cx, 1.24, -4.23], [.92, 1.87, .52], kit.material(palette.trim), true);
    for (const shelf of [0, 1, 2, 3]) {
      kit.box(room, [cx, .57 + shelf * .43, -3.955], [.82, .365, .091], navy, true);
      kit.box(room, [cx, .61 + shelf * .43, -3.895], [.23, .055, .042], brass, true);
    }
  }
  kit.box(room, [-3.55, .83, -1.37], [4.2, .58, 1.4], navy, true);
  for (const side of [-1, 1]) kit.box(room, [-3.55 + side * 1.975, .62, -.661], [.19, .99, .094], brass, true);
  kit.sign(room, "FRONT OFFICE", [-3.55, .83, -.637], 1.93, ["#4d6a85", "#f5e1b4"]);
  for (const x of [-4.75, -2.25]) pendant(kit, room, x, -1.37, 3.19, "#78959d", .67);
  for (const x of [1.80, 3.95]) {
    kit.box(room, [x, .62, 2.02], [1.42, .13, .51], kit.material("#8fa1a1"), true);
    kit.box(room, [x, .88, 2.24], [1.44, .54, .13], navy, true);
    for (const side of [-1, 1]) kit.box(room, [x + side * .60, .48, 2.02], [.092, .40, .45], brass, true);
  }
  const leaflets = kit.material("#e1c083");
  for (const [index, x] of [1.57, 2.69, 3.84, 4.99].entries()) {
    kit.box(room, [x, 1.09, -3.855], [.54, .78, .022], index % 2 ? leaflets : kit.material("#e6dcba"), true);
    for (const y of [.83, .96, 1.09]) kit.box(room, [x, y, -3.838], [.36, .025, .013], navy);
  }
}

function readingRoom(kit: ModelKit, room: THREE.Group) {
  const wood = kit.material("#794f42");
  const brass = kit.material("#b89357");
  const green = kit.material("#50785b");
  kit.ground(room, 2.8, .72, 6.72, 4.70, kit.material("#6b816c", "stone"), .308);
  kit.ground(room, 2.8, .72, 6.44, 4.42, kit.material("#99a07a", "stone"), .309);
  kit.box(room, [-5.04, 1.05, .74], [2.73, 1.47, 1.09], wood, true);
  for (let row = 0; row < 3; row++) for (let column = 0; column < 5; column++) {
    const x = -6.10 + column * .53;
    const y = .59 + row * .46;
    kit.box(room, [x, y, 1.32], [.45, .36, .095], kit.material((row + column) % 2 ? "#9c7051" : "#95654e"), true);
    kit.box(room, [x, y, 1.384], [.145, .065, .041], brass, true);
  }
  for (const x of [2.23, 4.68]) {
    kit.cylinder(room, [x, 1.03, .51], .32, .064, brass, true);
    kit.cylinder(room, [x, 1.265, .51], .053, .46, brass, true);
    kit.box(room, [x, 1.49, .51], [.74, .29, .34], green, true).rotation.x = -.29;
    kit.box(room, [x, 1.376, .57], [.61, .052, .27], kit.material("#f5dc9d"), true);
  }
  paper(kit, room, 3.2, 1.02, .42, .19, "#e9debf", "#86654b");
  stool(kit, room, 3.08, 1.42, "#976852");
  const covers = ["#5f7861", "#98694c", "#81949b", "#a27d51", "#755b57"];
  for (const shelf of [-4.85, -.75]) {
    for (let level = 0; level < 3; level++) {
      for (let volume = 0; volume < 8; volume++) {
        const x = shelf - 1.46 + volume * .38;
        const height = .27 + ((volume * 3 + level) % 5) * .061;
        const spine = kit.material(covers[(volume + level * 2) % covers.length]);
        kit.box(room, [x, .326 + level * .70 + height / 2, -3.76], [.235, height, .18], spine, true);
        kit.box(room, [x, .39 + level * .70, -3.656], [.159, .042, .016], brass);
      }
    }
  }
}

function specialistEquipment(kit: ModelKit, room: THREE.Group, kind: RoomKind, palette: RoomPalette) {
  const iron = kit.material(palette.metal);
  const accent = kit.material(palette.accent);
  const parchment = kit.material("#efdfb7");
  if (kind === "printshop") {
    const press = kit.group(room, [-.94, .32, -2.89]);
    kit.box(press, [0, .67, 0], [3.04, 1.29, 1.54], iron, true);
    kit.box(press, [0, 1.42, 0], [3.24, .25, 1.68], accent, true);
    kit.box(press, [0, 1.48, .80], [2.4, .105, 1.1], iron, true);
    for (const rollerZ of [-.39, -.04, .32, .67]) {
      const roller = kit.cylinder(press, [0, 1.62, rollerZ], .24, 2.39, iron);
      roller.rotation.z = Math.PI / 2;
    }
    kit.box(press, [0, 1.685, .77], [1.82, .036, .95], parchment, true);
    kit.box(press, [0, 1.71, .9], [1.22, .012, .35], kit.material("#b87862"));
    kit.box(room, [-.96, 2.56, -4.89], [3.83, .079, .142], iron, true);
    for (let proof = 0; proof < 4; proof++) {
      const x = -2.38 + proof * .89;
      kit.box(room, [x, 2.13, -4.806], [.64, .83, .045], parchment, true);
      kit.box(room, [x, 2.22, -4.772], [.42, .35, .025], proof % 2 ? accent : iron);
    }
  } else if (kind === "community") {
    const slat = kit.material("#75988a");
    for (let unit = 0; unit < 6; unit++) {
      kit.box(room, [2.54 + unit * .17, 1.44, -.46], [.093, 2.23, .15], slat, true);
      kit.box(room, [2.54 + unit * .17, 2.52, -.46], [.098, .16, .18], accent, true);
    }
    kit.box(room, [2.96, .512, -.48], [1.21, .16, .31], iron, true);
    stool(kit, room, -.92, -.32, "#7b9f85");
    stool(kit, room, 1.60, 2.46, "#b0946a");
    kit.box(room, [4.37, 1.41, -3.49], [1.49, .073, .43], iron, true);
    for (const dx of [-.45, .0, .43]) tray(kit, room, 4.37 + dx, 1.46, -3.53, "#788e69", .35);
  } else if (kind === "workshop") {
    kit.box(room, [-.23, .76, -3.24], [4.42, .92, .96], iron, true);
    for (let index = 0; index < 5; index++) {
      const x = -1.97 + index * .87;
      kit.box(room, [x, .74, -2.715], [.72, .70, .122], accent, true);
      kit.box(room, [x, .89, -2.631], [.27, .055, .065], iron, true);
    }
    kit.box(room, [0, 1.036, .96], [3.07, .079, .66], kit.material("#8b9b84"), true);
    for (const x of [-.84, .62]) {
      kit.cylinder(room, [x, 1.17, .89], .37, .23, iron, true);
      kit.cylinder(room, [x, 1.30, .89], .22, .08, accent, true);
    }
    stool(kit, room, -1.54, 1.86, "#b3895e");
  } else if (kind === "courthouse") {
    for (const x of [-5.17, -3.72, -2.27, -.82, .63]) {
      kit.box(room, [x, .98, -.60], [1.28, .69, .110], kit.material(palette.wood), true);
      kit.box(room, [x, .98, -.534], [1.06, .48, .035], kit.material("#ae8960", "stone"), true);
    }
    for (const z of [.38, 1.68, 2.93]) {
      kit.cylinder(room, [-.36, .34, z], .43, .068, iron, true);
      kit.cylinder(room, [-.36, .78, z], .072, .91, iron, true);
      kit.sphere(room, [-.36, 1.24, z], [.17, .16, .17], accent);
    }
    kit.box(room, [-.36, 1.12, 1.65], [.074, .081, 2.58], kit.material("#947461"), true);
  }
}

export function roomSceneArt(kit: ModelKit, room: THREE.Group, kind: RoomKind, palette: RoomPalette, station: RoomStation, mission?: string) {
  switch (kind) {
    case "market": market(kit, room, station, mission === "market-bulletin"); break;
    case "kitchen": receiving(kit, room, station); break;
    case "office": operations(kit, room, mission === "regional-operations"); break;
    case "school": reception(kit, room, palette); break;
    case "archive": readingRoom(kit, room); break;
    default: {
      const [x, z, width] = station;
      const span = kind === "printshop" || kind === "workshop" ? 1.58 : 1.19;
      for (const offset of [-span, span]) pendant(kit, room, x + offset, z + .05, 3.19, palette.trim, .64);
      kit.ground(room, x, z + .33, Math.min(7, width + 1.44), 2.82, kit.material(palette.trim, "stone"), .308);
      kit.ground(room, x, z + .33, Math.min(6.78, width + 1.22), 2.63, kit.material(palette.floor, "stone"), .309);
      for (const side of [-1, 1]) kit.ground(room, x + side * Math.min(3.17, width / 2 + .4), z + .33,
        .070, 2.38, kit.material(palette.accent), .31);
      specialistEquipment(kit, room, kind, palette);
    }
  }
}

export function roomSavedArt(kit: ModelKit, incoming: THREE.Group, finished: THREE.Group, station: RoomStation, mission: string | undefined, height: number) {
  const [x, z] = station;
  if (mission === "market-bulletin") {
    paper(kit, incoming, x - .73, height + .042, z + .32, -.26, "#dcb276", "#a46346");
    paper(kit, incoming, x - .49, height + .068, z + .23, -.55, "#f5e4bd", "#8f7751");
    paper(kit, finished, x + .98, height + .112, z + .31, .035, "#f5e7bb", "#547650");
    paper(kit, finished, x + .98, height + .156, z + .31, -.045, "#ecddb4", "#537654");
    kit.cylinder(finished, [2.39, 2.185, -3.696], .17, .045, kit.material("#8cb38b")).rotation.x = Math.PI / 2;
    return true;
  }
  if (mission === "supplier-invoices" || mission === "kitchen-extract") {
    paper(kit, incoming, x + .68, height + .045, z + .125, -.47, "#eed6ae", "#b96341");
    paper(kit, finished, x + 1.41, height + .103, z + .25, -.034, "#f4d3ac", "#a96745");
    paper(kit, finished, x + 1.41, height + .137, z + .25, .085, "#f4e4c3", "#527061");
    return true;
  }
  if (mission === "regional-operations") {
    const amber = kit.material("#d89a5e");
    const teal = kit.material("#9dd5ae");
    const indicator = (group: THREE.Group, light: THREE.MeshStandardMaterial) => {
      kit.box(group, [3.36, 1.91, -4.278], [.84, .098, .025], light, true);
      kit.sphere(group, [3.93, 1.91, -4.275], [.12, .12, .058], light);
    };
    indicator(incoming, amber);
    indicator(finished, teal);
    for (const offset of [-.27, .18, .48]) paper(kit, incoming, x + offset, 1.04, z + .22, offset, "#e4bd9b", "#a26a4e");
    tray(kit, finished, x + .37, .999, z + .32, "#527e71", 1.06);
    for (const offset of [-.25, .08, .41]) paper(kit, finished, x + offset + .28, 1.10, z + .32, -.065, "#d8ead2", "#507565");
    return true;
  }
  return false;
}
