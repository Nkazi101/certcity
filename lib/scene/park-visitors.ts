import * as THREE from "three";
import { makePerson } from "./actors";
import { gardenBorder, parkBench } from "./park-details";
import type { ModelKit } from "./model-kit";

function artHillHeight(z: number) {
  return .117 + 2.36 * THREE.MathUtils.smoothstep(z, -5, 9);
}

export function artHillVisitors(kit: ModelKit, park: THREE.Group) {
  const mat = kit.material("#be664b");
  const linen = kit.material("#edd9ae");
  const grass = kit.group(park, [-5.1, artHillHeight(2.95), 2.95]);
  grass.rotation.x = -.25;
  kit.box(grass, [0, .019, 0], [2.38, .029, 1.71], mat, true);
  for (const x of [-.86,.86]) kit.box(grass, [x, .038, 0], [.073, .009, 1.69], linen);
  for (const z of [-.66,.66]) kit.box(grass, [0, .039, z], [2.34, .009, .066], linen);
  const basket = kit.material("#b98755");
  kit.box(grass, [-.21, .154, -.24], [.43, .24, .28], basket, true);
  kit.box(grass, [-.21, .277, -.24], [.46, .062, .303], kit.material("#cda371"), true);
  for (const x of [-.342,-.081]) kit.box(grass, [x, .327, -.24], [.035,.093,.047], basket, true);
  kit.box(grass, [-.21, .372, -.24], [.285,.031,.043], basket, true);

  kit.cylinder(grass, [.31, .065, -.16], .29, .04, linen);
  for (const x of [.23, .35, .41]) kit.sphere(grass, [x,.107,-.16], [.12,.078,.106], kit.material("#cb8344"));
  const visitors = [
    makePerson(kit, park, ["#498c78", "#996344", "#573c31"], 1.05, 3, 1.08),
    makePerson(kit, park, ["#c38b42", "#d69a75", "#543b2d"], 1.0, 1, .95),
  ];
  for (const [i, { person, sit }] of visitors.entries()) {
    const side = i ? -1 : 1;
    person.position.set(-5.1 + side * .88, artHillHeight(2.83), 2.83);
    person.rotation.y = -side * 1.43;
    sit(.24);
  }
  parkBench(kit, park, -7.7, -23.7, 0, .072);
  const onBench = makePerson(kit, park, ["#725880", "#ad7556", "#46342b"], 1.03, 2, .97);
  onBench.person.position.set(-7.93, .078, -23.68);
  onBench.sit(.43);
  const walker = makePerson(kit, park, ["#be783f", "#d6a07a", "#584031"], 1.08, 1, .98);
  return (time: number) => {
    for (const [i, visitor] of visitors.entries()) {
      visitor.head.rotation.y = Math.sin(time * .77 + i * 1.5) * .32;
      visitor.work(time * 1.46 + i * 1.5);
    }
    onBench.head.rotation.y = .33 * Math.sin(time * .71);
    onBench.work(time * .61);
    const progress = (time * .038 + .21) % 2;
    const forward = progress < 1;
    const t = forward ? progress : 2 - progress;
    const z = -.82 + t * 3.76;
    walker.person.position.set(6.58 - t * 1.74, artHillHeight(z), z);
    walker.person.rotation.y = forward ? -.43 : Math.PI - .43;
    walker.walk(time * 7.2);
  };
}

export function plazaVisitors(kit: ModelKit, parent: THREE.Object3D) {
  const tableX = 52.67, tableZ = 15.58, tableAngle = -.21;
  const furniture = kit.group(parent, [tableX, .079, tableZ], tableAngle);
  const game = kit.group(parent, [tableX, .079, tableZ], tableAngle);
  const legs = kit.material("#426156");
  const wood = kit.material("#a7744c", "pavers");
  const canvas = kit.material("#e3c9a1");
  kit.ground(furniture, 0, 0, 3.08, 2.18, kit.material("#b99673", "pavers"), .002);
  kit.cylinder(furniture, [0, .34, 0], .14, .67, legs);
  kit.cylinder(furniture, [0, .69, 0], 1.16, .075, wood, true);
  const board = kit.group(furniture, [0, .741, 0]);
  kit.box(board, [0, 0, 0], [.59, .032, .59], wood);
  for (const x of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    kit.box(board, [x * .18, .021, z * .18], [.177, .018, .177], (x + z) % 2 ? canvas : legs);
  }
  const clay = kit.material("#ac4c39");
  const ivory = kit.material("#fff1cd");
  for (const x of [-.18, .18]) {
    kit.cylinder(board, [x, .05, -.17], .13, .045, ivory, true);
    kit.cylinder(board, [x, .05, .17], .13, .045, clay, true);
  }
  const pieces = [
    kit.cylinder(game, [-.179, .79, 0], .135, .045, ivory, true),
    kit.cylinder(game, [.179, .79, 0], .135, .045, clay, true),
  ];
  const players = [
    makePerson(kit, game, ["#b76048", "#956246", "#44342e"], 1.24, 3, .95),
    makePerson(kit, game, ["#4d668f", "#d8a080", "#48372d"], 1.21, 4, 1.08),
  ];
  for (const [i, player] of players.entries()) {
    const side = i ? -1 : 1;
    const offset = side * .83;
    const chair = kit.group(furniture, [offset, 0, .03], -side * Math.PI / 2);
    kit.box(chair, [0, .325, 0], [.43, .065, .41], wood, true);
    kit.box(chair, [0, .55, -.185], [.41, .23, .066], wood, true);
    for (const x of [-.17, .17]) for (const z of [-.14, .14]) {
      kit.box(chair, [x,.161,z], [.042,.32,.043], legs);
    }
    player.person.position.set(offset, 0, .03);
    player.person.rotation.y = -side * Math.PI / 2;
    player.sit(.36);
  }
  const nook = kit.group(parent, [0, 0, 0]);
  gardenBorder(kit, nook, 56.92, 15.97, 2.69, 1.10, -.22, 25, .083);
  gardenBorder(kit, nook, 57.97, 6.01, 2.83, 1.18, Math.PI * .30, 61, .083);
  gardenBorder(kit, nook, 58.20, 7.41, 1.41, 1.04, -.58, 72, .083);
  gardenBorder(kit, nook, 55.67, 5.81, 1.78, .91, -.12, 45, .083);
  kit.tree(nook, 58.18, 6.03, 1, 32);
  parkBench(kit, nook, 57.04, 7.05, -Math.PI / 2, .085);
  const visitor = makePerson(kit, parent, ["#b77638", "#bd8264", "#4a392d"], 1.05, 2, 1.0);
  visitor.person.position.set(57.03, .088, 7.11);
  visitor.person.rotation.y = -Math.PI / 2;
  visitor.sit(.43);
  kit.batch(furniture);
  kit.batch(nook);
  return (time: number) => {
    // Alternate a deliberate reach with a pause so the gesture reads from above.
    const turn = (time + 2.95) % 12;
    const second = turn >= 6;
    const local = turn % 6;
    const move = THREE.MathUtils.smoothstep(local, 2.1, 3.3);
    const reset = THREE.MathUtils.smoothstep(turn, 10.7, 12);
    for (const [i, piece] of pieces.entries()) {
      const direction = i ? 1 : -1;
      const progress = (i === Number(second) ? move : Number(second)) * (1 - reset);
      piece.position.x = direction * (.18 - progress * .126);
      piece.position.z = direction * .082;
      piece.position.y = .804 + (i === Number(second) ? Math.sin(Math.PI * move) * .112 : 0);
    }
    for (const [i, player] of players.entries()) {
      const active = i === Number(second);
      const reach = active ? THREE.MathUtils.smoothstep(local, 1.1, 2.2) - THREE.MathUtils.smoothstep(local, 3.35, 4.2) : 0;
      player.chest.rotation.x = .32 * reach;
      player.head.rotation.x = .15 + .28 * reach;
      player.head.rotation.y = .18 * Math.sin(time * .88 + i);
      player.arms[i].rotation.x = -.50 - reach * 1.03;
      player.forearms[i].rotation.x = -.42 + reach * .30;
    }
    visitor.head.rotation.y = .28 * Math.sin(time * .81);
    visitor.arms[1].rotation.x = -.37 + Math.sin(time * .77) * .11;
  };
}
