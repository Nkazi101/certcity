import * as THREE from "three";
import { makePerson, makeVehicle, rollingHubs } from "./actors";
import type { ModelKit } from "./model-kit";
import { followRoad, locustCenter, oliveCrossing, oliveWalkPhase, tuckerOliveCrossing } from "./streets";

const ease = (value: number) => THREE.MathUtils.smoothstep(value, 0, 1);
type Pose = ReturnType<typeof makePerson>;

function lookAt(person: Pose, x: number, z: number) {
  person.person.rotation.y = Math.atan2(x - person.person.position.x, z - person.person.position.z);
}

export function oliveStreetLife(kit: ModelKit, scene: THREE.Scene, upgradeVan: (object: THREE.Object3D) => void, invalidate: () => void) {
  const props = kit.group(scene, [0, 0, 0]);
  const people = kit.group(scene, [0, 0, 0]);
  const shadows = kit.group(scene, [0, 0, 0]);
  const contact: { object: THREE.Object3D; shadow: THREE.Mesh; elevation: number }[] = [];
  function shadowFor(object: THREE.Object3D, width: number, depth: number, elevation: number) {
    const shadow = kit.contactShadow(shadows, 0, 0, width, depth, elevation);
    contact.push({ object, shadow, elevation });
  }

  const nolan = makePerson(kit, people, ["#bf634c", "#a7755c", "#564238"], 1.49, 2, 1.08);
  nolan.person.position.set(33.9, .11, -3.16);
  nolan.person.rotation.y = -.12;
  const cap = kit.material("#527466");
  kit.sphere(nolan.head, [0, .341, .004], [.5, .19, .49], cap);
  kit.box(nolan.head, [0, .313, .16], [.38, .051, .29], cap, true);
  const print = kit.group(nolan.chest, [0, .265, .49]);
  const photoMaterial = new THREE.MeshStandardMaterial({ color: "#a29a83", roughness: .87 });
  let disposed = false;
  const texture = new THREE.TextureLoader().load("/models/olive-corner/central-library-south-1986.webp", (map) => {
    if (disposed) return;
    map.colorSpace = THREE.SRGBColorSpace;
    photoMaterial.color.set("#f6efdf");
    photoMaterial.map = map;
    photoMaterial.needsUpdate = true;
    invalidate();
  }, undefined, () => {});
  function mountedPrint(parent: THREE.Object3D, width: number) {
    kit.box(parent, [0, 0, 0], [width, width * .68, .044], kit.material("#f4e1b5"), true);
    const picture = new THREE.Mesh(kit.geometry(new THREE.PlaneGeometry(width*.87, width*.87*308/525)), photoMaterial);
    picture.position.set(0, width*.029, .027);
    parent.add(picture);
  }
  mountedPrint(print, .67);
  kit.box(nolan.chest, [.232, .179, .158], [.155, .109, .026], kit.material("#efe2ad"), true);
  const nolanShadow = kit.contactShadow(shadows, 33.9, -3.16, .96, .83, .114);
  const conversation = { id: "olive-library", bounds: new THREE.Box3(), anchor: new THREE.Vector3() };

  const cart = kit.group(props, [36.2, .10, -2.83], -.10);
  const iron = kit.material("#36594d");
  const oak = kit.material("#a77750", "pavers");
  for (const x of [-.37, .37]) {
    for (const z of [-.21, .21]) {
      kit.box(cart, [x, .42, z], [.052, .63, .052], iron, true);
      kit.cylinder(cart, [x, .104, z], .207, .078, iron).rotation.z = Math.PI / 2;
      kit.cylinder(cart, [x * 1.11, .104, z], .105, .025, kit.material("#b9a479")).rotation.z = Math.PI / 2;
    }
  }
  for (const y of [.27, .76]) kit.box(cart, [0, y, 0], [.84, .054, .53], oak, true);
  kit.box(cart, [0, .876, -.225], [.84, .038, .045], iron);
  kit.sign(cart, "OLIVE STREET PHOTOS", [0, .735, .294], .78, ["#36594d", "#fff0cd"]);
  for (const [i, color] of ["#a35244", "#627c65", "#c99853", "#457380"].entries()) {
    const x = -.26 + i * .17;
    kit.box(cart, [x, .369, 0], [.13, .148, .37], kit.material(color), true);
    kit.box(cart, [x, .376, .187], [.085, .099, .014], kit.material("#d6c39a"));
  }
  const folio = kit.group(cart, [-.14, .838, .01]);
  folio.rotation.x = .58;
  kit.box(folio, [0, 0, 0], [.54, .041, .42], kit.material("#365950"), true);
  kit.box(folio, [0, .03, 0], [.49, .021, .36], kit.material("#f6dfae"));
  for (const x of [-.136, .136]) {
    kit.box(folio, [x, .044, .002], [.194, .011, .261], kit.material("#ac956f"));
    for (const w of [-.047, .035]) kit.box(folio, [x + w, .052, .014], [.045, .008, .117], kit.material("#6b6f62"));
  }
  kit.contactShadow(cart, 0, 0, .98, .72, .006);
  const exhibit = kit.group(scene, [35.87, .102, -2.87], -.12);
  kit.box(exhibit, [0, .77, -.164], [.108, 1.49, .12], iron, true);
  for (const x of [-.41, .41]) {
    kit.box(exhibit, [x, .73, .06], [.099, 1.46, .105], oak, true);
    kit.box(exhibit, [x, .063, .06], [.23, .1, .42], iron, true);
  }
  const exhibitPrint = kit.group(exhibit, [0, 1.19, .103]);
  mountedPrint(exhibitPrint, 1.34);
  kit.sign(exhibit, "EXHIBIT OPEN", [0, .71, .142], 1.27, ["#30584a", "#ffebbf"]);
  kit.contactShadow(exhibit, 0, 0, 1.38, .74, .004);
  exhibit.visible = false;

  const courier = makePerson(kit, people, ["#357f96", "#985b40", "#372e32"], 1.05, 5, 1.14);
  function deliveryBox(parent: THREE.Object3D, at: [number, number, number]) {
    const parcel = kit.group(parent, at);
    kit.box(parcel, [0, 0, 0], [.48, .30, .35], kit.material("#c68b4c"), true);
    kit.box(parcel, [0, .153, 0], [.115, .016, .34], kit.material("#f1d3a3"));
    kit.box(parcel, [.112,.156,.084], [.097,.016,.109], kit.material("#fff0d0"));
    return parcel;
  }
  const parcel = deliveryBox(courier.chest, [0, -.016, .438]);
  const droppedParcel = deliveryBox(people, [53.65, .245, -3.55]);
  shadowFor(courier.person, .76, .83, .141);

  const crossing = [
    makePerson(kit, people, ["#e26e59", "#e7ad83", "#7e4a32"], 1.07, 3, .95),
    makePerson(kit, people, ["#6d60a2", "#9f684d", "#302722"], .99, 1, 1.10),
  ];
  crossing.forEach(({ person }) => shadowFor(person, .69, .71, .105));

  const guests = [
    makePerson(kit, people, ["#dc9a46", "#a66b4e", "#432d25"], .97, 3, 1.03),
    makePerson(kit, people, ["#4c97a2", "#d29373", "#604134"], 1.05, 2, .92),
  ];
  guests.forEach(({ person }) => shadowFor(person, .72, .65, .073));

  let cafeTable = [37.33, 16.82];
  let tableHeight = .756;
  function setCornerArt(ready: boolean) {
    const y = ready ? .55 : .11;
    nolan.person.position.y = y;
    nolanShadow.position.y = y + .004;
    conversation.bounds.min.set(33.35, y + .02, -3.59);
    conversation.bounds.max.set(34.44, y + 2.19, -2.56);
    conversation.anchor.set(33.9, y + 2.40, -3.09);
    const tables = ready ? [[34.14, 16.51], [37.33, 16.82]] : [[34.27, 17.35], [37.29, 16.93]];
    cafeTable = tables[1];
    tableHeight = ready ? .756 : .67;
    guests.forEach((guest, i) => {
      const [x, z] = tables[i];
      guest.person.position.set(x + .663, ready ? .054 : .086, z + .075);
      guest.person.rotation.y = -Math.PI / 2;
      guest.sit(.35);
    });
  }
  setCornerArt(false);
  const server = makePerson(kit, people, ["#28786d", "#d39364", "#42332a"], 1.36, 6, 1.04);
  kit.box(server.chest, [0, .136, .205], [.355, .387, .055], kit.material("#e6c976"), true);
  kit.box(server.chest, [0, .093, .248], [.173, .113, .021], kit.material("#c39154"), true);
  const tray = kit.group(server.person, [0, .65, .40]);
  kit.cylinder(tray, [0, 0, 0], .65, .04, kit.material("#925733"));
  kit.cylinder(tray, [0, .024, 0], .605, .018, kit.material("#c58a4c"));
  function coffee(parent: THREE.Object3D, x: number) {
    kit.cylinder(parent, [x, .017, 0], .208, .022, kit.material("#fff0cd"));
    kit.cylinder(parent, [x, .097, 0], .151, .145, kit.material("#f3dcad"), true);
    kit.cylinder(parent, [x, .172, 0], .115, .013, kit.material("#8b4f34"));
    kit.box(parent, [x+.095, .110, 0], [.061, .058, .041], kit.material("#f3dcad"), true);
  }
  const carriedCoffee = kit.group(tray, [0, .035, 0]);
  coffee(carriedCoffee, -.148);
  coffee(carriedCoffee, .145);
  const tableCoffee = kit.group(people, [0, 0, 0], 1.06);
  coffee(tableCoffee, -.19);
  coffee(tableCoffee, .19);
  shadowFor(server.person, .78, .75, .073);

  const van = makeVehicle(kit, scene, "#eadcbd", true);
  van.scale.setScalar(.75);
  van.position.y = .075;
  upgradeVan(van);
  const roll = rollingHubs(kit, van, true);
  shadowFor(van, 1.44, 2.79, .081);
  const turn = kit.material("#a86b40");
  const flash = kit.material("#ffb64d").clone();
  flash.emissive.set("#dc6920");
  flash.emissiveIntensity = .8;
  const lights = kit.group(van, [0, 0, 0]);
  lights.name = "Vehicle lights";
  const indicator = kit.box(lights, [-.618, .702, -1.255], [.105, .083, .037], turn, true);
  const driveVan = followRoad([
    [61.7, -.90], [58.4, -.90], [56.7, -1.42], [55.83, -1.42], [54.1, -1.42],
    [52.4, -.90], [43.85, -.90],
    ...[43.85, 46.1, 52, 63.75].map((x): [number, number] => [x, locustCenter(x) + .88]),
    [63.75, -.90],
  ], 3.35, 5.7, [oliveCrossing, tuckerOliveCrossing], { at: [55.83, -1.42], duration: 27 });
  let lastVanYaw = -Math.PI / 2;
  kit.batch(props);

  function update(time: number) {
    const { travel, parkedFor } = driveVan(time, van);
    const reading = (time + 4.8) % 10;
    const showing = ease((reading - 3.65) / .75) - ease((reading - 7.7) / .64);
    print.position.set(0, .174 + .325 * showing, .451 + .063 * showing);
    print.rotation.x = -1.035 + .83 * showing;
    nolan.head.rotation.x = .29 - .43 * showing + .024 * Math.sin(time * 1.1);
    nolan.head.rotation.y = .16 * showing;
    nolan.arms.forEach((arm, i) => {
      arm.rotation.x = -.79 - .51 * showing;
      arm.rotation.z = (i ? 1 : -1) * .035;
      nolan.forearms[i].rotation.x = -.54 - .29 * showing;
    });

    const delivery = parkedFor ?? -1;
    const walkOut = ease((delivery - 5) / 4.25), walkBack = ease((delivery - 21) / 4.5);
    courier.person.visible = delivery >= 4.6 && delivery < 26;
    const approach = walkOut - walkBack;
    const firstLeg = Math.min(1, approach * 2.2);
    const secondLeg = Math.max(0, (approach - .456) / .544);
    courier.person.position.set(54.94 - 1.16 * firstLeg, .106, -2.41 - .26 * firstLeg - .84 * secondLeg);
    const moving = (delivery > 5 && delivery < 9.25) || (delivery > 21 && delivery < 25.5);
    courier.walk(time * 9, moving ? .78 : 0);
    lookAt(courier, courier.person.position.x + (firstLeg < .999 ? -1.2 : 0) * (delivery < 21 ? 1 : -1),
      courier.person.position.z + (delivery < 21 ? -.9 : .9));
    courier.head.rotation.x = .05 + Math.sin(time * 1.6) * .06;
    courier.arms.forEach((arm, i) => { arm.rotation.x = -1.01; arm.rotation.z = i === 0 ? -.10 : .10; });
    courier.forearms.forEach((elbow) => { elbow.rotation.x = -.37; });
    parcel.visible = delivery < 15.3;
    droppedParcel.visible = delivery >= 15.3 && delivery < 26.7;

    const phase = oliveWalkPhase(time);
    crossing.forEach((walker, i) => {
      const reverse = (time + oliveCrossing.offset) % 40 >= 20;
      const direction = reverse ? -1 : 1;
      const crossStart = .62 + i * .46;
      const north = -2.93 - i * .25;
      const south = oliveCrossing.sidewalkZ + i * .30;
      const lane = oliveCrossing.westX + (i === 0 ? -.13 : .28);
      const cross = ease((phase - crossStart) / 5.5);
      const retreat = ease((phase - 6.6) / 3.9) - ease((phase - 13.2) / 4.6);
      walker.person.position.set(lane - retreat * (1.52 + i * .27), .093,
        THREE.MathUtils.lerp(reverse ? north : south, reverse ? south : north, cross) - retreat * .27 * direction);
      const onCrossing = phase >= crossStart && phase < crossStart + 5.5;
      const onSidewalk = phase > 6.6 && phase < 10.5 || phase > 13.2 && phase < 17.8;
      if (onSidewalk) walker.person.rotation.y = phase < 11 ? -Math.PI / 2 : Math.PI / 2;
      else walker.person.rotation.y = (phase > 6.6 ? -direction : direction) > 0 ? Math.PI : 0;
      walker.head.rotation.y = onCrossing || onSidewalk ? .05 : .47 + .27 * Math.sin(time * 2.7 + i);
      walker.walk(time * 8.6 + i, onCrossing || onSidewalk ? 1 : 0);
    });

    guests.forEach((guest, i) => {
      guest.head.rotation.y = .34 * Math.sin(time * (i ? 1.04 : .86) + i * 2);
      guest.arms[1].rotation.x = -.17 - .34 * ease(Math.sin(.92 * time + i * 1.6));
    });
    const service = (time + 7.25) % 18;
    const movement = ease((service - 1.1) / 4.1) - ease((service - 10) / 4.2);
    const serving = ease((service - 5.5) / 1.5) - ease((service - 8.1) / 1.2);
    const [tableX, tableZ] = cafeTable;
    const x = THREE.MathUtils.lerp(35.89, tableX - .82, movement);
    const z = THREE.MathUtils.lerp(15.59, tableZ - .46, movement);
    server.person.position.set(x, .061, z);
    server.person.rotation.y = service < 10 ? 1.06 - .52 * (1 - movement) : -2.6;
    server.walk(time * 9.4, (service > 1.1 && service < 5.2) || (service > 10 && service < 14.2) ? .8 : 0);
    server.chest.rotation.x = .39 * serving;
    server.arms.forEach((arm) => { arm.rotation.x = -.94 + .31 * serving; });
    server.forearms.forEach((elbow) => { elbow.rotation.x = -.45 + .11 * serving; });
    tray.position.set(0, THREE.MathUtils.lerp(.67, (tableHeight - .061) / 1.36, serving), .42 + .13 * serving);
    carriedCoffee.visible = service < 7.05;
    tableCoffee.position.set(tableX - .16, tableHeight, tableZ - .095);
    tableCoffee.visible = service >= 7.05;
    server.head.rotation.x = .10 + .36 * serving;

    const steering = Math.atan2(Math.sin(van.rotation.y - lastVanYaw), Math.cos(van.rotation.y - lastVanYaw));
    roll(travel, THREE.MathUtils.clamp(steering * 5, -.39, .39));
    lastVanYaw = van.rotation.y;
    const merging = van.position.x > 52.3 && van.position.x < 58.5 && van.position.z > -2 && van.rotation.y < -1;
    indicator.material = merging && (delivery < 2 || delivery > 25) && Math.floor(time * 5) % 2 === 0 ? flash : turn;

    for (const { object, shadow, elevation } of contact) {
      shadow.position.set(object.position.x, elevation, object.position.z);
      shadow.rotation.z = object.rotation.y;
      shadow.visible = object.visible;
    }
  }

  return {
    update, conversation, setCornerArt,
    setExhibitOpen(open: boolean) {
      cart.visible = !open;
      exhibit.visible = open;
    },
    dispose() {
      disposed = true;
      flash.dispose();
      photoMaterial.dispose();
      texture.dispose();
    },
  };
}
