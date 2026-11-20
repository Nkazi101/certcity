import * as THREE from "three";
import type { ModelKit } from "./model-kit";

export function oliveTilework(kit: ModelKit, scene: THREE.Scene, y: number) {
  const paving = kit.group(scene, [51.9, y, 11]);
  const colors = ["#9c6759", "#c1906a", "#447375", "#d5b88c"];
  const radius = 2.75;
  const count = 40;
  for (const [index, r] of [radius - .24, radius, radius + .13].entries()) {
    const geometry = kit.geometry(new THREE.RingGeometry(r, r + (index === 1 ? .081 : .035), count).rotateX(-Math.PI / 2));
    paving.add(new THREE.Mesh(geometry, kit.material(colors[index])));
  }
  for (const [i, x] of [-6.1, 6.1].entries()) {
    for (const z of [-5.56, 5.56]) {
      for (let tile = 0; tile < 10; tile++) {
        const inlay = kit.ground(paving, x + (i ? -1 : 1) * tile * .21, z, .14, .14, kit.material(colors[tile % colors.length]), .001);
        inlay.rotation.z = Math.PI / 4;
      }
    }
  }
  kit.batch(paving);
}

export function artHillMonument(kit: ModelKit, ground: THREE.Group) {
  const plinth = kit.group(ground, [0, 2.25, 7.6], Math.PI);
  const granite = kit.material("#bd9c8c", "stone");
  const bronze = kit.material("#52695b");
  const dark = kit.material("#394e48");
  kit.box(plinth, [0, .095, 0], [2.28, .19, 2.79], granite, true);
  kit.box(plinth, [0, .28, 0], [1.94, .19, 2.53], granite);
  kit.box(plinth, [0, .89, 0], [1.54, 1.12, 2.16], granite);
  kit.box(plinth, [0, 1.44, 0], [1.73, .20, 2.35], granite, true);
  kit.box(plinth, [0, .99, 1.089], [.65, .30, .022], dark);
  const sculpture = kit.group(plinth, [0, 1.54, 0]);
  kit.sphere(sculpture, [0, .77, -.13], [.65, .66, 1.42], bronze);
  const stroke = (from: [number, number, number], to: [number, number, number], width: number, material = bronze) => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const center = start.lerp(end, .5);
    const piece = kit.cylinder(sculpture, [center.x, center.y, center.z], width, direction.length(), material, true);
    piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  };
  stroke([0,.77,.36], [0,1.26,.63], .42);
  stroke([0,1.29,.53], [0,1.23,.90], .28);
  kit.sphere(sculpture, [0, 1.19, .78], [.24, .25, .40], bronze);
  for (const x of [-.083, .083]) stroke([x,1.32,.61], [x,1.47,.60], .079);
  for (const x of [-.21, .21]) {
    stroke([x,.65,-.61], [x,.31,-.72], .19);
    stroke([x,.31,-.72], [x,.015,-.61], .12, dark);
    const raised = x > 0;
    stroke([x,.67,.36], [x,raised ? .44 : .32,raised ? .62 : .44], .185);
    stroke([x,raised ? .44 : .32,raised ? .62 : .44], [x,raised ? .24 : .013,raised ? .82 : .46], .12);
  }
  stroke([0,.84,-.78], [0,.48,-1.05], .15, dark);
  stroke([0,.48,-1.05], [.05,.27,-1.04], .11, dark);
  kit.sphere(sculpture, [0, 1.26, -.13], [.44, .58, .36], bronze);
  kit.sphere(sculpture, [0, 1.68, -.10], [.23, .29, .23], bronze);
  kit.cylinder(sculpture, [0, 1.815, -.10], .26, .098, dark);
  for (const side of [-1, 1]) {
    stroke([side*.18,1.41,-.12], [side*.32,1.18,.05], .16);
    stroke([side*.20,1.14,-.23], [side*.37,.79,.11], .17, dark);
    stroke([side*.37,.79,.11], [side*.31,.52,-.02], .15);
  }
  stroke([-.32,1.18,.05], [-.18,1.18,.49], .13);
  stroke([.32,1.18,.05], [.36,1.28,.40], .13);
  // The upright, inverted sword gives the monument its distinctive silhouette.
  stroke([.36,.91,.40], [.36,2.04,.40], .057, dark);
  stroke([.23,1.32,.40], [.49,1.32,.40], .06);
}

export function riverTow(kit: ModelKit, scene: THREE.Scene) {
  const tow = kit.group(scene, [165.8, -.78, 21]);
  const hull = kit.material("#473b47");
  const rust = kit.material("#a1543d");
  const cream = kit.material("#e3d2b2");
  const ink = kit.material("#385567");
  for (const x of [-1.08, 1.08]) {
    kit.box(tow, [x, .22, 3.75], [2.10, .57, 7.6], hull, true);
    kit.box(tow, [x, .49, 3.75], [1.94, .18, 7.3], rust, true);
    for (const z of [1.70, 3.77, 5.81]) {
      kit.box(tow, [x, .63, z], [1.69, .21, 1.93], cream, true);
      kit.box(tow, [x, .746, z], [1.66, .04, .053], kit.material("#ad977e"));
    }
  }
  kit.box(tow, [0, .28, -1.79], [1.85, .64, 3.99], hull, true);
  kit.box(tow, [0, .81, -1.51], [1.49, .58, 2.42], cream, true);
  kit.box(tow, [0, 1.22, -.89], [1.13, .51, .93], ink, true);
  kit.box(tow, [0, 1.51, -.89], [1.28, .16, 1.05], cream, true);
  for (const x of [-.58, .58]) kit.cylinder(tow, [x, 1.41, -2.28], .15, .67, hull);
  kit.cylinder(tow, [0, 1.90, -.89], .038, .68, hull);
  kit.box(tow, [.16, 2.19, -.89], [.30, .18, .034], rust);
  for (const side of [-1, 1]) {
    const wash = kit.ground(tow, side * .7, -4.9, .16, 3.1, kit.material("#96b8ad"), -.013);
    wash.rotation.z = side * .23;
  }
  kit.batchActor(tow);
  return (time: number) => { tow.position.z = -26 + (47 + 1.2 * time) % 177; };
}

export function oliveBakery(kit: ModelKit, parent: THREE.Group) {
  const shop = kit.group(parent, [28.96, .08, 11.16]);
  const brick = kit.material("#a8624e", "brick");
  const trim = kit.material("#dbb686", "stone");
  const iron = kit.material("#304c4b");
  const copper = kit.material("#678d80");
  const roof = kit.material("#8b7771", "shingles");
  const amber = kit.material("#c89459");
  const glass = kit.material("#508487");
  const width = 3.68, depth = 5.44;
  kit.contactShadow(shop, 0, 0, width + .84, depth + .89, .012);
  kit.box(shop, [0, 1.05, 0], [width, 2.1, depth], brick);
  kit.box(shop, [0, 2.109, 0], [width - .08, .045, depth - .08], roof);
  kit.box(shop, [0, 2.14, 0], [width + .13, .12, depth + .13], trim);
  kit.box(shop, [0, 2.25, depth / 2 - .06], [width, .21, .17], brick);
  kit.box(shop, [0, 2.38, depth / 2 - .06], [width * .73, .19, .22], brick);
  kit.box(shop, [0, 2.50, depth / 2 - .06], [width * .50, .12, .27], trim);
  kit.box(shop, [-width / 2 + .06, 2.22, 0], [.14, .23, depth], trim);
  for (const [x, z, angle, length, bays] of [[0, depth / 2, 0, width, 3], [-width / 2, 0, -Math.PI / 2, depth, 4]]) {
    const facade = kit.group(shop, [x, 0, z], angle);
    const span = (length - .36) / bays;
    kit.box(facade, [0, .245, .064], [length - .16, .33, .18], iron);
    kit.box(facade, [0, 1.75, .067], [length + .07, .17, .21], iron);
    for (let i = 0; i <= bays; i++) {
      const u = span * (i - bays / 2);
      kit.box(facade, [u, .94, .136], [.085, 1.47, .136], iron);
      kit.box(facade, [u, .28, .155], [.137, .16, .17], copper);
      kit.box(facade, [u, 1.57, .155], [.138, .124, .16], copper);
    }
    for (let i = 0; i < bays; i++) {
      const u = span * (i + .5 - bays / 2);
      const door = angle === 0 && i === 1;
      kit.box(facade, [u, .925, .095], [span - .095, 1.28, .09], door ? iron : glass);
      kit.box(facade, [u, 1.405, .154], [span - .17, .24, .043], amber);
      kit.box(facade, [u, 1.26, .157], [span - .12, .061, .068], iron);
      kit.box(facade, [u, .821, .151], [.052, .88, .049], iron);
      if (door) {
        kit.box(facade, [u, .65, .151], [span - .27, .902, .046], glass);
        kit.box(facade, [u + .22, .68, .188], [.025, .115, .03], trim);
      } else {
        kit.box(facade, [u, .444, .161], [span - .126, .10, .081], trim);
        for (const offset of [-.21, .02, .2]) {
          kit.sphere(facade, [u + offset, .53 + Math.abs(offset) * .11, .167], [.154, .073, .037], amber).castShadow = false;
        }
      }
    }
  }
  const sign = kit.group(shop, [0, 0, depth / 2]);
  kit.sign(sign, "BAKERY", [0, 1.962, .022], 1.45, ["#8d4e3d", "#f4d6a1"]);
  const awning = kit.group(sign, [0, 1.67, .40]);
  awning.rotation.x = .19;
  const canvas = kit.material("#748773");
  const stripe = kit.material("#e7d6a5");
  for (let i = 0; i < 13; i++) {
    const x = (i - 6) * .235;
    const fabric = i % 2 ? stripe : canvas;
    kit.box(awning, [x, 0, 0], [.236, .045, .68], fabric);
    kit.sphere(awning, [x, -.071, .336], [.238, .18, .045], fabric).castShadow = false;
  }
  const skylight = kit.group(shop, [0, 2.17, -.57], Math.PI / 2);
  kit.box(skylight, [0, .135, 0], [1.95, .27, 1.01], copper);
  for (const side of [-1, 1]) {
    const face = kit.group(skylight, [0, .33, side * .25]);
    face.rotation.x = side * .33;
    kit.box(face, [0, 0, 0], [1.91, .055, .53], glass);
    for (const x of [-.92, -.46, 0, .46, .92]) kit.box(face, [x, .044, 0], [.041, .031, .56], copper);
  }
  kit.box(skylight, [0, .431, 0], [1.98, .076, .08], copper);
  kit.box(shop, [.9, 2.59, -1.84], [.46, .95, .53], brick);
  kit.box(shop, [.9, 3.08, -1.84], [.56, .12, .62], trim);
}
