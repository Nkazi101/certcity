import * as THREE from "three";
import { ModelKit } from "./model-kit";
import { characterFace, characterOutfit } from "./character-detail";

export function makePerson(kit: ModelKit, parent: THREE.Object3D, colors: [string, string, string], size = 1, look = 0, build = 1) {
  const person = kit.group(parent, [0, 0, 0]);
  person.scale.setScalar(size);
  const [coat, skin, hair] = colors;
  const trousers = kit.material("#354d54");
  const shoes = kit.material("#494036");
  const chest = kit.group(person, [0, .56, 0]);
  const detailed = build !== 1 || look > 0 && size >= .94;
  const head = kit.group(chest, [0, .46, 0]);
  const neck = kit.material(skin);
  kit.box(chest, [0, .412, 0], [.161, .111, .166], neck, true);
  const clothes = detailed ? characterOutfit(kit, chest, coat, look, build) : undefined;
  if (detailed) {
    characterFace(kit, head, skin, hair, look);
    head.scale.setScalar(.98 + (look % 4) * .028);
  } else {
    kit.box(chest, [0, .19, 0], [.49, .55, .3], kit.material(coat), true);
    kit.sphere(head, [0, .15, .015], [.394, .428, .375], neck);
    kit.sphere(head, [0, .278, -.027], [.416, .241, .388], kit.material(hair));
    for (const x of [-.078, .078]) kit.sphere(head, [x, .165, .191], [.034, .037, .019], kit.material("#44302c"));
    if (look === 1 || look === 4) {
      const cap = kit.material(look === 1 ? "#c67d51" : "#476765");
      kit.sphere(head, [0, .314, -.011], [.435, .206, .399], cap);
      kit.box(head, [0, .283, .154], [.371, .047, .28], cap, true);
    }
    if (look === 2) kit.sphere(head, [0, .302, -.202], [.195, .2, .2], kit.material(hair));
    if (look === 3) {
      for (const x of [-.153, .153]) kit.sphere(head, [x, .123, -.044], [.131, .401, .281], kit.material(hair));
    }
    if (look === 5) kit.box(chest, [0, .196, -.201], [.35, .408, .209], kit.material("#b36749"), true);
    if (look === 6) kit.box(chest, [0, .173, .161], [.322, .323, .063], kit.material("#ae7e51"), true);
  }
  const arms: THREE.Group[] = [];
  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const forearms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = kit.group(person, [side * .13, .53, 0]);
    const knee = kit.group(leg, [0, -.237, .008]);
    kit.sphere(leg, [0, -.104, 0], [.18 * build, .29, .178], trousers);
    kit.sphere(knee, [0, -.096, 0], [.153, .26, .156], trousers);
    kit.box(knee, [0, -.225, .054], [.19, .125, .265], shoes, true);
    if (clothes) {
      kit.box(knee, [0, -.274, .057], [.197, .049, .274], kit.material("#c1ad92"), true);
      kit.box(knee, [0, -.167, .112], [.105, .020, .075], clothes.facing, true);
    }
    knees.push(knee);
    legs.push(leg);
    const arm = kit.group(chest, [side * (.245 * build + .032), .355, 0]);
    const elbow = kit.group(arm, [0, -.177, 0]);
    kit.sphere(arm, [0, -.074, 0], [.18, .236, .170], kit.material(coat));
    kit.sphere(elbow, [0, -.071, 0], [.139, .222, .139], kit.material(coat));
    if (clothes) kit.box(elbow, [0, -.159, 0], [.139, .057, .144], clothes.edge, true);
    kit.sphere(elbow, [0, -.205, .017], [.14, .133, .115], neck);
    if (clothes) kit.sphere(elbow, [-side*.052, -.185, .063], [.057, .074, .064], neck);
    forearms.push(elbow);
    arm.rotation.z = side * .09;
    arms.push(arm);
  }

  if (kit.city) {
    kit.actorShadow(person, .98, .63);
    kit.batchActor(person, [person, chest, head, ...arms, ...forearms, ...legs, ...knees]);
  } else if (detailed) kit.batchJoints(person);

  return {
    person,
    chest,
    head,
    arms,
    forearms,
    sit(height: number) {
      chest.position.y = height / size;
      for (const [i, leg] of legs.entries()) {
        leg.position.y = chest.position.y;
        leg.rotation.x = -Math.PI / 2;
        knees[i].rotation.x = Math.PI * .54;
      }
    },
    walk(phase: number, stride = 1) {
      const swing = Math.sin(phase) * .47 * stride;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      arms[0].rotation.x = -swing * .66;
      arms[1].rotation.x = swing * .66;
      knees[0].rotation.x = Math.max(0, -swing) * .64;
      knees[1].rotation.x = Math.max(0, swing) * .64;
      forearms.forEach((elbow, i) => { elbow.rotation.x = -.09 * stride + Math.min(0, arms[i].rotation.x) * .38; });
      chest.position.y = .56 + Math.abs(Math.sin(phase)) * .025 * stride;
    },
    work(phase: number, task: "general" | "type" | "scan" | "pack" = "general") {
      const wave = Math.sin(phase);
      const rhythm = {
        general: [-.55 + wave * .23, -.73 + Math.cos(phase * 1.1) * .20, wave * .065],
        type: [-.87 + wave * .074, -.92 + Math.cos(phase * 1.35) * .083, 0],
        scan: [-.36 + wave * .085, -.68 - Math.max(0, wave) * .61, .075 + wave * .11],
        pack: [-.66 + wave * .27, -.63 + wave * .31, Math.cos(phase * .5) * .14],
      }[task];
      arms[0].rotation.x = rhythm[0];
      arms[1].rotation.x = rhythm[1];
      chest.rotation.y = rhythm[2];
      forearms.forEach((elbow) => { elbow.rotation.x = -.21; });
    },
  };
}

export function makeVehicle(kit: ModelKit, parent: THREE.Object3D, color: string, van = false) {
  const vehicle = kit.group(parent, [0, .025, 0]);
  const painted = kit.material(color);
  const windows = kit.material("#587d85");
  const rubber = kit.material("#343738");
  const trim = kit.material("#e6dcc0");
  const length = van ? 3.43 : 2.72;
  kit.box(vehicle, [0, .53, 0], [1.38, .55, length], painted, true);
  kit.box(vehicle, [0, .81, -.24], [1.3, .29, length * .87], painted, true);
  kit.box(vehicle, [0, 1.02, van ? .34 : -.14], [1.21, .45, 1.24], windows, true);
  kit.box(vehicle, [0, 1.265, van ? .34 : -.14], [1.24, .12, 1.29], painted, true);
  if (van) kit.box(vehicle, [0, 1.075, -.78], [1.38, .87, 1.73], painted, true);
  for (const z of [-length * .31, length * .31]) {
    for (const x of [-.64, .64]) {
      const tire = kit.cylinder(vehicle, [x, .27, z], .48, .21, rubber);
      tire.rotation.z = Math.PI / 2;
      const hub = kit.cylinder(vehicle, [x * 1.16, .27, z], .22, .023, trim);
      hub.rotation.z = Math.PI / 2;
    }
  }
  for (const x of [-.46, .46]) {
    kit.box(vehicle, [x, .56, length / 2 + .014], [.25, .14, .055], kit.material("#f9e8b1"), true);
    kit.box(vehicle, [x, .55, -length / 2 - .012], [.19, .12, .04], kit.material("#b54a3c"), true);
  }
  if (kit.city) {
    kit.batchActor(vehicle);
    kit.actorShadow(vehicle, 1.76, length * 1.05);
  }
  return vehicle;
}

export function rollingHubs(kit: ModelKit, car: THREE.Object3D, van = false) {
  const wheels = kit.group(car, [0, 0, 0]);
  wheels.name = "Animated hubs";
  const steel = kit.material("#aebdc2");
  const dark = kit.material("#434e52");
  const front: THREE.Group[] = [];
  const hubs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    for (const z of van ? [-.60, .90] : [-.70, .76]) {
      const knuckle = kit.group(wheels, [side * (van ? .807 : .829), .255, z]);
      const hub = kit.group(knuckle, [0, 0, 0]);
      const rim = kit.cylinder(hub, [0, 0, 0], .285, .019, dark);
      rim.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const spoke = kit.group(hub, [0, 0, 0]);
        spoke.rotation.x = (i * Math.PI * 2) / 5;
        kit.box(spoke, [side*.017, .071, 0], [.021, .125, .031], steel, true);
      }
      kit.sphere(hub, [side*.027, 0, 0], [.026, .088, .088], steel);
      hubs.push(hub);
      if (z > 0) front.push(knuckle);
    }
  }
  wheels.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = false; });
  let rotation = 0;
  return (travel: number, steering: number) => {
    rotation += travel / (.244 * car.scale.x);
    hubs.forEach((hub) => { hub.rotation.x = rotation; });
    front.forEach((wheel) => { wheel.rotation.y = steering; });
  };
}

export function followRoute(points: [number, number][], speed: number, phase: number) {
  const legs = points.map(([x, z], index) => {
    const [nextX, nextZ] = points[(index + 1) % points.length];
    return { x, z, dx: nextX - x, dz: nextZ - z, length: Math.hypot(nextX - x, nextZ - z) };
  });
  const total = legs.reduce((sum, leg) => sum + leg.length, 0);
  return (time: number, actor: THREE.Object3D) => {
    let distance = (time * speed + phase) % total;
    for (const leg of legs) {
      if (distance <= leg.length) {
        actor.position.x = leg.x + leg.dx * distance / leg.length;
        actor.position.z = leg.z + leg.dz * distance / leg.length;
        actor.rotation.y = Math.atan2(leg.dx, leg.dz);
        return;
      }
      distance -= leg.length;
    }
  };
}
