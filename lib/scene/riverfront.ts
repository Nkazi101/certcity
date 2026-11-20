import * as THREE from "three";
import { gardenBorder } from "./park-details";
import { followRoute, makePerson } from "./actors";
import { riverTow } from "./city-vignettes";
import { archAxis as axis, archHalfSpan as span, archX, baldCypress, parkMeadow, parkRelief, reflectingPool, westEntry } from "./arch-grounds";
import { ModelKit, seededRandom } from "./model-kit";
import { landmark } from "./sites";
import type { Environment } from "./sites";
import { eadsRoad, hasStreetAt, streetRibbon } from "./st-louis-streets";

const shore = 145;
const eastBank = 196.8;

function arch(kit: ModelKit, scene: THREE.Scene) {
  const rise = 25.63;
  const curve = 3.002;
  const segments = 142;
  const baseY = .19;
  const widthAt = (t: number) => .70 + (2.23 - .70) * (Math.cosh(curve * t) - 1) / (Math.cosh(curve) - 1);
  function section(t: number) {
    const y = rise * (1 - (Math.cosh(curve * t) - 1) / (Math.cosh(curve) - 1));
    const slope = -rise * curve * Math.sinh(curve * t) / (span * (Math.cosh(curve) - 1));
    const normal = new THREE.Vector3(0, 1, -slope).normalize();
    const center = new THREE.Vector3(0, y, t * span);
    const width = widthAt(t);
    const apothem = width / (2 * Math.sqrt(3));
    return [
      center.clone().addScaledVector(normal, 2 * apothem),
      center.clone().addScaledVector(normal, -apothem).add(new THREE.Vector3(width / 2, 0, 0)),
      center.clone().addScaledVector(normal, -apothem).add(new THREE.Vector3(-width / 2, 0, 0)),
    ];
  }

  const positions: number[] = [];
  const colors: number[] = [];
  const faces: number[] = [];
  const rings = Array.from({ length: segments + 1 }, (_, index) => section(2 * index / segments - 1));
  const across = 8;
  const blueShade = new THREE.Color("#8faccf");
  const sunTint = new THREE.Color("#f6d2b0");
  const silver = ["#e5dfd6", "#aebfd7", "#dee8ef"].map((color) => new THREE.Color(color));
  const point = new THREE.Vector3();
  const paint = new THREE.Color();
  for (let face = 0; face < 3; face++) {
    const first = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const t = 2 * i / segments - 1;
      const horizon = .5 + .5 * Math.sin(t * 4.8 + face * .6);
      const joint = i % 4 === 0 ? .91 : 1;
      for (let column = 0; column <= across; column++) {
        const u = column / across;
        point.copy(rings[i][face]).lerp(rings[i][(face + 1) % 3], u);
        positions.push(point.x, point.y, point.z);
        const reflectedLight = .2 + .45 * horizon * (1 - u);
        const satinEdge = Math.pow(Math.abs(2 * u - 1), 5);
        paint.copy(silver[face]).lerp(blueShade, .34 * (1 - horizon) * u)
          .lerp(sunTint, reflectedLight * (face === 1 ? .29 : .61))
          .multiplyScalar((.89 + .17 * satinEdge) * joint);
        colors.push(paint.r, paint.g, paint.b);
        if (i === segments || column === across) continue;
        const a = first + i * (across + 1) + column;
        const b = a + across + 1;
        faces.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  const steel = kit.material("#eff5f6");
  steel.vertexColors = true;
  steel.metalness = .24;
  steel.roughness = .34;
  steel.emissive.set("#93abc2");
  steel.emissiveIntensity = .16;
  steel.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geometry, steel);
  mesh.position.set(archX, baseY, axis);
  mesh.castShadow = true;
  scene.add(mesh);

  const windows = kit.group(scene, [archX, baseY, axis]);
  const glass = kit.material("#4d636f");
  for (let i = 0; i < 16; i++) {
    const t = (i - 7.5) * .125 / span;
    const [top, east, west] = section(t);
    for (const [edge, sign] of [[east, 1], [west, -1]] as const) {
      const center = edge.clone().lerp(top, .27);
      const pane = kit.box(windows, [center.x + .013 * sign, center.y, center.z],
        [.026, .038, .083], glass);
      pane.rotation.z = sign * Math.PI / 6;
      pane.castShadow = false;
    }
  }

  kit.batch(windows);
  mesh.updateMatrixWorld(true);
  const site = landmark("gateway-arch", archX, axis, 2.55, 26.4, 26.3);
  site.anchor.set(archX, 25.91, axis);
  site.surface = mesh;
  return site;
}

function walkway(kit: ModelKit, parent: THREE.Object3D, points: [number, number][], width: number, color: string, elevation: number, followGrade = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, elevation, z)));
  const steps = 36;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const length = curve.getLength();
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    for (const side of [-1, 1]) {
      const x = point.x - tangent.z * side * width / 2;
      const z = point.z + tangent.x * side * width / 2;
      positions.push(x, elevation + (followGrade ? parkRelief(x, z) : 0), z);
      uvs.push(u * length / 2.8, side * width / 5.6 + .5);
    }
    if (i === steps) continue;
    const n = i * 2;
    indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
  }
  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, kit.material(color, "pavers"));
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function courthouse(kit: ModelKit, parent: THREE.Group) {
  const x = 105.7;
  const court = kit.group(parent, [x, .09, axis]);
  const stone = kit.material("#e8d4af", "stone");
  const trim = kit.material("#f2e1ba");
  const shadow = kit.material("#b09873");
  const copper = kit.material("#638f7d");
  const darkCopper = kit.material("#4c7869");
  const roof = kit.material("#81988a", "shingles");
  kit.contactShadow(court, 0, 0, 10.3, 11.8, .013);
  kit.box(court, [0, .19, 0], [7.7, .38, 8.6], shadow, true);
  kit.box(court, [0, 1.57, 0], [6.7, 2.7, 8.4], stone);
  kit.box(court, [0, 1.57, 0], [9.2, 2.7, 5.2], stone);
  kit.box(court, [0, 2.95, 0], [6.91, .18, 8.59], trim, true);
  kit.box(court, [0, 2.96, 0], [9.38, .16, 5.41], trim, true);
  kit.box(court, [0, 3.04, 0], [6.69, .09, 8.27], roof);
  kit.box(court, [0, 3.04, 0], [9.12, .09, 5.18], roof);
  for (const face of [-1, 1]) {
    for (const z of [-3.52, -2.92, 2.92, 3.52]) {
      kit.window(court, [face * 3.36, 1.58, z], .36, 1.04, face * Math.PI / 2, z > 0);
    }
    for (const xOff of [-3.92, 3.92]) kit.window(court, [xOff, 1.58, face * 2.62], .49, 1.08, face < 0 ? Math.PI : 0);
    const entrance = kit.group(court, [face * 4.62, 0, 0], face * Math.PI / 2);
    kit.box(entrance, [0, 1.16, .055], [1.36, 1.84, .16], kit.material("#698879"), true);
    for (let step = 0; step < 5; step++) {
      kit.box(entrance, [0, .046 + step * .078, 1.03 - step * .16], [4.92, .091, .36], trim, true);
    }
    for (const column of [-1.98, -1.29, -.59, .59, 1.29, 1.98]) {
      kit.cylinder(entrance, [column, 1.43, .56], .224, 2.27, trim, true);
      kit.box(entrance, [column, 2.53, .56], [.32, .13, .31], trim);
    }
    kit.box(entrance, [0, 2.74, .49], [4.69, .27, 1.16], trim, true);
    kit.roof(entrance, 2.89, 4.58, 1.45, .57, "#8b9b8a", trim);
  }
  kit.cylinder(court, [0, 3.25, 0], 4.1, .4, trim);
  kit.cylinder(court, [0, 3.87, 0], 3.45, 1.16, stone);
  kit.cylinder(court, [0, 4.47, 0], 3.62, .2, trim);
  for (let i = 0; i < 12; i++) {
    const angle = 2 * Math.PI * i / 12;
    kit.window(court, [1.71 * Math.sin(angle), 3.88, 1.71 * Math.cos(angle)], .26, .53, angle);
  }
  const profile = [[1.73, 0], [1.69, .33], [1.49, .77], [1.25, 1.1], [.95, 1.42],
    [.64, 1.68], [.37, 1.83], [.24, 1.87]].map(([r, y]) => new THREE.Vector2(r, y));
  const dome = new THREE.Mesh(kit.geometry(new THREE.LatheGeometry(profile, 40)), copper);
  dome.position.y = 4.56;
  dome.castShadow = dome.receiveShadow = true;
  court.add(dome);
  kit.cylinder(court, [0, 6.58, 0], .54, .39, darkCopper, true);
  kit.cylinder(court, [0, 6.81, 0], .63, .13, copper, true);
  kit.sphere(court, [0, 7.02, 0], [.13, .28, .13], trim);
  return landmark("old-courthouse", x, axis, 11.37, 8.6, 7.3);
}

function bench(kit: ModelKit, parent: THREE.Group, x: number, z: number, angle: number) {
  const seat = kit.group(parent, [x, .11 + parkRelief(x, z), z], angle);
  const timber = kit.material("#ad7e52");
  const metal = kit.material("#4a6058");
  for (const side of [-1, 1]) {
    kit.box(seat, [side * .52, .37, -.16], [.083, .74, .091], metal, true);
    kit.box(seat, [side * .52, .21, .12], [.085, .39, .086], metal, true);
  }
  kit.box(seat, [0, .39, 0], [1.49, .079, .39], timber, true);
  kit.box(seat, [0, .62, -.18], [1.48, .16, .072], timber, true);
}

function riverSurface(kit: ModelKit, scene: THREE.Scene) {
  const time = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uBank: { value: shore },
      uNear: { value: new THREE.Color("#65887b") },
      uDeep: { value: new THREE.Color("#385772") },
      uTeal: { value: new THREE.Color("#4e8492") },
      uGlint: { value: new THREE.Color("#e4c7a7") },
    },
    vertexShader: `
      varying vec2 vPosition;
      varying float vDepth;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vPosition = world.xz;
        vec4 view = viewMatrix * world;
        vDepth = -view.z;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uBank;
      uniform vec3 uNear;
      uniform vec3 uDeep;
      uniform vec3 uGlint;
      uniform vec3 uTeal;
      varying vec2 vPosition;
      varying float vDepth;
      float grain(vec2 p) {
        vec3 seed = fract(vec3(p.xyx) * .1031);
        seed += dot(seed, seed.yzx + 33.33);
        return fract((seed.x + seed.y) * seed.z);
      }
      float noise2(vec2 p) {
        vec2 a = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(grain(a), grain(a + vec2(1., 0.)), f.x),
          mix(grain(a + vec2(0., 1.)), grain(a + vec2(1.)), f.x), f.y);
      }
      void main() {
        float d = max(0.0, vPosition.x - uBank);
        vec2 p = vec2(d + vPosition.y * .064, vPosition.y - uTime * .63);
        float current = noise2(p * vec2(.11, .043));
        vec2 brush = vec2(p.x + current * 1.9, p.y);
        float streak = noise2(brush * vec2(.68, .16));
        float wash = noise2(brush * vec2(.33, .075) + vec2(6.1, 2.5));
        float washEdge = smoothstep(.57, .86, streak) * smoothstep(.23, .73, wash);
        float ripple = sin(brush.x * 4.8 + brush.y * .31 + streak * 4.8);
        float crest = smoothstep(.86, .995, ripple) * smoothstep(.48, .81, streak);
        float depth = smoothstep(.8, 25.0, d);
        vec3 water = mix(uNear, uDeep, depth * (.61 + current * .37));
        water = mix(water, uTeal, .17 + (.16 + .17 * depth) * wash);
        water = mix(water, uGlint, (.043 + .041 * current) * washEdge + (.074 + .084 * current) * crest);
        float shoreline = 1.0 - smoothstep(.03, .68 + streak * .81, d);
        water = mix(water, uGlint, shoreline * (.12 + streak * .12));
        water = mix(water, vec3(.39, .37, .43), smoothstep(110., 165., vDepth) * .65);
        gl_FragColor = vec4(water, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(kit.geometry(new THREE.PlaneGeometry(96, 240)), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(shore + 48, -.87, axis);
  scene.add(mesh);
  return { update: (seconds: number) => { time.value = seconds; }, dispose: () => material.dispose() };
}

function eadsBridge(kit: ModelKit, parent: THREE.Group) {
  const { z, line, ramp, deckStart, end, exit, eastLanding, width, sidewalkWidth, asphalt, paving, deckY } = eadsRoad;
  const height = (x: number) => eadsRoad.height(x);
  const stone = kit.material("#a28b70", "stone");
  const trim = kit.material("#c4ac8c", "stone");
  const iron = kit.material("#50696e");
  const deckLength = end - deckStart;
  const deckCenter = (end + deckStart) / 2;
  for (const x of [144.5, 161, 178, 194.5]) {
    kit.box(parent, [x, 1.48, z], [1.82, 4.5, 6.02], stone);
    kit.box(parent, [x, 3.77, z], [2.03, .31, 6.3], trim);
    for (const side of [-1, 1]) {
      kit.box(parent,[x,.91,z+side*2.66],[1.4,3.2,.73],stone,true);
    }
  }
  kit.box(parent, [deckCenter, deckY - .187, z], [deckLength, .32, sidewalkWidth], iron);
  // One ribbon carries the same paving, width and grade from 4th Street onto the deck.
  streetRibbon(kit, parent, line, width, asphalt, height, "road");
  const rampIndex = line.indexOf(ramp[0]);
  const deckIndex = rampIndex + ramp.length - 1;
  const wallPoints: number[] = [];
  const wallUV: number[] = [];
  for (const side of [-1, 1]) {
    const sidewalk = streetRibbon(kit, parent, line, (sidewalkWidth - width) / 2, paving, (x) => height(x) - .026,
      "pavers", side * (sidewalkWidth + width) / 4);
    const edges = sidewalk.geometry.getAttribute("position");
    const column = side < 0 ? 0 : 1;
    for (let i = 1; i <= deckIndex; i++) {
      const a = 2 * (i - 1) + column, b = 2 * i + column;
      const stations = side < 0 ? [a,b,a,a,b,b] : [b,a,a,b,a,b];
      stations.forEach((index, vertex) => {
        const x = edges.getX(index), z = edges.getZ(index);
        const surface = edges.getY(index);
        const underside = index < rampIndex * 2 ? .048 : surface - .32;
        const y = vertex === 0 || vertex === 1 || vertex === 5 ? surface : underside;
        wallPoints.push(x,y,z);
        wallUV.push(x / 2.8, y / 2.8);
      });
    }
  }
  const eastGround = kit.material("#95ae66", "grass");
  kit.ground(parent, (eastBank + 290) / 2, axis, 290 - eastBank, 240, eastGround, -.064);
  kit.box(parent, [eastBank - .10, -.445, axis], [.36, .76, 240], stone);
  for (let i = 1; i < eastLanding.length; i++) {
    const [a] = eastLanding[i - 1], [b] = eastLanding[i];
    const y0 = height(a), y1 = height(b);
    const rise = Math.max(.10, (y0 + y1) / 2 + .04);
    const cap = kit.box(parent, [(a + b) / 2, (y0 + y1) / 2 - .14, z],
      [Math.hypot(b - a, y1 - y0) + .026, .19, sidewalkWidth], stone);
    cap.rotation.z = Math.atan2(y1 - y0, b - a);
    if (rise > .24) kit.box(parent, [(a + b) / 2, rise / 2 - .20, z],
      [b-a + .028, rise - .12, sidewalkWidth - .10], stone);
  }
  streetRibbon(kit, parent, [[exit,z],[277,z]], width, asphalt, eadsRoad.roadY, "road");
  for (const side of [-1, 1]) {
    streetRibbon(kit, parent, eastLanding, .12, "#c4ac8c", (x) => height(x) + .031, "pavers", side * (sidewalkWidth / 2 - .1));
    for (const [x] of eastLanding.slice(1,-1)) {
      kit.box(parent, [x,height(x) + .14,z + side * (sidewalkWidth / 2 - .1)],[.043,.32,.043],iron);
    }
  }
  const walls = kit.geometry(new THREE.BufferGeometry());
  walls.setAttribute("position", new THREE.Float32BufferAttribute(wallPoints, 3));
  walls.setAttribute("uv", new THREE.Float32BufferAttribute(wallUV, 2));
  walls.computeVertexNormals();
  const abutment = new THREE.Mesh(walls, stone);
  abutment.castShadow = abutment.receiveShadow = true;
  parent.add(abutment);
  for (const side of [-1, 1]) {
    const edge = side * (sidewalkWidth / 2 - .1);
    streetRibbon(kit, parent, [...ramp, [end, z]], .16, "#c4ac8c", (x) => height(x) + .063, "pavers", edge);
    const railZ = z + edge;
    for (let i = 1; i < ramp.length; i++) {
      const a = ramp[i - 1][0], b = ramp[i][0];
      const yA = height(a), yB = height(b);
      const rail = kit.box(parent, [(a + b) / 2, (yA + yB) / 2 + .275, railZ],
        [Math.hypot(b - a, yB - yA) + .016, .077, .077], iron);
      rail.rotation.z = Math.atan2(yB - yA, b - a);
    }
    kit.box(parent, [deckCenter, deckY + .275, railZ], [deckLength,.077,.077], iron);
    for (let x = ramp[0][0] + .1; x < end; x += .91) {
      kit.box(parent, [x,height(x) + .14,railZ],[.042,.32,.043],iron);
    }
    for (const [a,b] of [[144.5,161],[161,178],[178,194.5]]) {
      for (let n=0;n<22;n++) {
        const x0=a+(b-a)*n/22, x1=a+(b-a)*(n+1)/22;
        const y=(x:number)=>.42+2.91*Math.sin(Math.PI*(x-a)/(b-a));
        const y0=y(x0),y1=y(x1);
        for(const offset of [0,.24]) {
          const rib=kit.box(parent,[(x0+x1)/2,(y0+y1)/2+offset,railZ-side*.39],
            [Math.hypot(x1-x0,y1-y0)+.024,.095,.12],iron);
          rib.rotation.z=Math.atan2(y1-y0,x1-x0);
        }
        if(n%2===0) kit.box(parent,[x0,(y0+4.04)/2,railZ-side*.39],[.08,4.04-y0,.10],iron);
      }
    }
  }
  for (const x of [128.6, 132.3, 136.25, 140.7]) {
    const h = height(x) - .25;
    kit.box(parent, [x, h/2, z], [.62,h,sidewalkWidth - .2], stone);
    kit.box(parent, [x, h - .035, z], [.78,.17,sidewalkWidth - .07], trim);
  }
  for (let x = 128.2; x < 277 - 1; x += 2.85) {
    streetRibbon(kit, parent, [[x,z],[x + .51,z],[x + 1.02,z]], .055, "#d6ac63", (x) => height(x) + .007);
  }
  const ground = line.slice(0, rampIndex + 1);
  for (let i = 1; i < ground.length; i++) {
    const [a,b] = ground[i - 1], [c,d] = ground[i];
    const length = Math.hypot(c-a,d-b);
    if (length < 1.45 || i === 1) continue;
    const x = (a+c)/2, at = (b+d)/2;
    streetRibbon(kit, parent, [[x-.48*(c-a)/length,at-.48*(d-b)/length],[x+.48*(c-a)/length,at+.48*(d-b)/length]],
      .055, "#d6ac63", (x) => height(x) + .007);
  }
  return landmark("eads-bridge", 142.9, z, 19.5, 5.5, 4.56);
}

function kienerPlaza(kit: ModelKit, park: THREE.Group) {
  const x=95.2,z=46.2;
  kit.ground(park,x,z,10.3,9.6,kit.material("#d5b88f","pavers"),.105);
  kit.ground(park,x-2.1,z,4.0,4.2,kit.material("#86a959","grass"),.117);
  const basin=kit.material("#b5a18b","stone");
  kit.cylinder(park,[x+1.8,.16,z],4.1,.22,basin);
  kit.cylinder(park,[x+1.8,.284,z],3.68,.029,kit.material("#709fa1"));
  const bronze=kit.material("#687769");
  kit.cylinder(park,[x+1.8,.43,z],.57,.29,basin);
  kit.box(park,[x+1.8,.83,z],[.21,.54,.18],bronze,true);
  kit.sphere(park,[x+1.86,1.11,z],[.19,.21,.19],bronze);
  for (const side of [-1,1]) {
    const limb=kit.box(park,[x+1.8+side*.18,.7,z+side*.16],[.10,.53,.10],bronze,true);
    limb.rotation.z=side*.67;
    kit.cylinder(park,[x+1.8+side*1.22,.35,z+.31],.061,.25,kit.material("#bdd2bc"));
    for(const off of [-3.5,2.87]) {
      kit.tree(park,x+off,z+side*3.68,.86,off>0?30:62);
      bench(kit,park,x+off-.6,z+side*2.94,side===1?Math.PI:0);
    }
    gardenBorder(kit, park, x - 3.3, z + side * 2.3, 2.6, .93, side * .57, side > 0 ? 73 : 49, .122);
    gardenBorder(kit, park, x + .58, z + side * 3.66, 2.74, 1.05, side * .15, side > 0 ? 58 : 46, .115);
  }
  return landmark("kiener-plaza",x,z,9.9,9.6,1.12);
}

function pathsAndPlantings(kit: ModelKit, park: THREE.Group) {
  const pale = kit.material("#ddcaa7", "pavers");
  const paleStone = kit.material("#e5d6b9", "stone");
  const limestone = kit.material("#ad9d86", "stone");
  const shadowStone = kit.material("#927c62");
  const random = seededRandom(624);
  const tree = (x: number, z: number, size: number, seed: number) => {
    if (hasStreetAt(x, z, 1.24 + size * 1.32)) return;
    const planted = kit.tree(park, x, z, size, seed);
    planted.position.y += parkRelief(x, z);
  };

  // Elevated lawns meet the levee stairs at the east edge.
  parkMeadow(kit, park);
  kit.ground(park, 105.8, axis, 9.32, 13.18, pale, .081);
  kit.ground(park, 113.5, axis, 10.3, 10.46, pale, .083);
  kit.ground(park, 120.3, axis, 9.3, 4.7, pale, .088);
  kit.ground(park, 134.13, axis, 5.75, 7.74, pale, .087);
  kit.ground(park, 135.43, axis, 3.15, 87, kit.material("#d7c6a5", "pavers"), .076);
  kit.ground(park, 141.01, axis, 8.03, 130, kit.material("#b3a890", "pavers"), -.69);
  kit.box(park, [shore - .02, -.773, axis], [.48, .31, 130], limestone);

  walkway(kit, park, [[85.8, 43], [91.5, 43], [97.7, 42.2], [101.3, 43.5]], 2.3, "#d5b997", .078);
  kit.sign(park, "MARKET ST", [107.7, 1.42, 55.68], 1.02, ["#386050", "#fff2d0"]);
  kit.cylinder(park, [107.7, .76, 55.63], .07, 1.5, kit.material("#496256"), true);
  kit.ground(park, 112.6, 58.88, 6.4, 1.26, pale, .084);

  kit.ground(park, 102.3, 61.2, 12.85, 8.57, kit.material("#86a953", "grass"), .036);
  kit.ground(park, 102.3, 61.2, 10.2, 1.16, pale, .064);
  kit.ground(park, 102.3, 61.2, 1.16, 7.94, pale, .064);
  for (const [x, z, seed] of [[98.45, 58.43, 17], [106.66, 59.04, 31], [97.77, 63.18, 9], [105.97, 64.27, 25]]) {
    kit.tree(park, x, z, 1.16, seed);
    bench(kit, park, x + 1.45, z + .56, Math.PI / 2);
  }

  for (const sign of [-1, 1]) {
    const ringX = archX, ringZ = axis + sign * span;
    kit.cylinder(park, [ringX, .091, ringZ], 4.95, .13, paleStone);
    kit.cylinder(park, [ringX, .158, ringZ], 3.29, .02, limestone);
    const direction = (distance: number) => axis + sign * distance;
    walkway(kit, park, [[114.2, direction(4.7)], [117.8, direction(7.85)], [121.8, direction(11.1)],
      [126.8, direction(12.42)], [132.5, direction(10.6)], [135.7, direction(6.9)]], 1.35, "#d8c29d", .10, true);
    walkway(kit, park, [[111.6, direction(4.7)], [112.4, direction(12)], [113.6, direction(19.7)],
      [117.2, direction(25.1)], [124.3, direction(26.2)], [130.0, direction(23.4)], [134.3, direction(17.38)]],
    1.12, "#d8c29d", .103, true);
    reflectingPool(kit, park, sign);
    for (const [i, [x, interval, size]] of [[117.25, 16.7, 1.06], [115.4, 19.3, 1.39], [115.8, 22.4, .99],
      [118.6, 25.8, 1.32], [121.1, 26.85, 1.06], [123.8, 26.1, 1.26], [126.4, 23.95, 1.31]].entries()) {
      baldCypress(kit, park, x, direction(interval), size, i + (sign > 0 ? 15 : 31));
    }
    for (let i = 0; i < 6; i++) {
      tree(133.5 - (i % 2) * .42, direction(14.4 + i * 2.87), 1.16 + random() * .26, i * 11 + (sign > 0 ? 9 : 4));
      if (i % 2 === 0) bench(kit, park, 134.95, direction(15.3 + i * 2.78), -Math.PI / 2);
    }
    for (let i = 0; i < 13; i++) {
      const x = 111.3 + random() * 19.8;
      const z = direction(27 + random() * 12);
      tree(x, z, .75 + random() * .63, Math.floor(random() * 70));
    }
    for (const [x, distance, look] of [[113.0, 7.2, 2], [116.35, 9.5, 14], [119.65, 13.58, 43],
      [125.6, 15.3, 9], [129.4, 16.7, 23], [114.8, 22.8, 33], [126.35, 22.8, 19]]) {
      tree(x, direction(distance), 1.03 + random() * .22, look + sign);
    }
    bench(kit, park, 123.57, direction(13.98), sign * .17);
    bench(kit, park, 114.13, direction(6.49), sign * .22);
  }

  // Follow Kiley's widening descent to the levee with three shallow flights.
  const stairs = 18;
  const rise = .76;
  for (let i = 0; i < stairs; i++) {
    const progress = i / (stairs - 1);
    const x = 137.08 + .192 * i + (i >= 6 ? .25 : 0) + (i >= 12 ? .25 : 0);
    const y = .086 - rise * progress;
    const width = 7.64 + 4.1 * progress * progress;
    const depth = i === 5 || i === 11 ? .452 : .202;
    kit.box(park, [x + (depth - .202) / 2, y - .047, axis], [depth, .094, width], i % 6 === 0 ? paleStone : limestone);
    kit.box(park, [x + depth - .105, y + .003, axis], [.028, .018, width], paleStone);
    for (const side of [-1, 1]) {
      const flank = axis + side * (width / 2 + .19);
      const height = .49 + (1 - progress) * .21;
      kit.box(park, [x + (depth - .202) / 2, y + height / 2 - .24, flank], [depth, height, .55], limestone);
      kit.box(park, [x + (depth - .202) / 2, y + height - .21, flank], [depth + .012, .07, .64], paleStone);
    }
  }
  for (const side of [-1, 1]) {
    kit.box(park, [137.02, -.31, axis + side * 23.75], [.19, .74, 39.37], limestone);
    kit.box(park, [137.06, .081, axis + side * 23.75], [.28, .081, 39.36], paleStone);
    const railZ = axis + side * 2.36;
    const rail = kit.box(park, [138.9, -.066, railZ], [3.87, .053, .047], shadowStone);
    rail.rotation.z = -.195;
    for (let i = 0; i < 5; i++) {
      kit.box(park, [137.19 + i * .86, .11 - i * .17, railZ], [.042, .46, .044], shadowStone);
    }
    for (let i = 0; i < 13; i++) {
      const z = axis + side * (7.5 + i * 3.15);
      const lamp = kit.group(park, [143, -.668, z]);
      const iron = kit.material("#494b51");
      kit.cylinder(lamp, [0, .14, 0], .17, .28, iron);
      kit.cylinder(lamp, [0, .87, 0], .062, 1.49, iron, true);
      kit.sphere(lamp, [0, 1.66, 0], [.18, .22, .18], kit.material("#d6c9a3"));
      kit.cylinder(lamp, [0, 1.81, 0], .21, .075, iron, true);
    }
  }
  kit.ground(park, 142.35, axis, 4.28, 11.94, pale, -.665);
  westEntry(kit, park);
  kit.sign(park, "LUTHER ELY SMITH SQUARE", [110.63, .76, axis - 2.37], 1.66, ["#587456", "#fff0c8"]);
  for (const x of [110.09, 111.17]) {
    kit.box(park, [x, .39, axis - 2.381], [.07, .75, .075], kit.material("#6b765d"), true);
  }
}

export function addRiverfront(kit: ModelKit, scene: THREE.Scene): Environment {
  const grounds = new THREE.Group();
  const visitors = new THREE.Group();
  scene.add(grounds, visitors);
  pathsAndPlantings(kit, grounds);
  const courthouseSite = courthouse(kit, grounds);
  const plazaSite = kienerPlaza(kit, grounds);
  const bridgeSite = eadsBridge(kit, grounds);
  kit.batch(grounds);
  const archSite = arch(kit, scene);
  const river = riverSurface(kit, scene);
  const freighter = riverTow(kit, scene);
  let towDeparture: number | undefined;
  const paths: [number, number][][] = [
    [[111, 43.8], [114.5, 44.4], [117.3, 44.5], [118.2, 45.3], [118.2, 47.7], [115.9, 47.8], [111, 48.5]],
    [[119, 57.5], [123.6, 58.7], [127.5, 58.52], [129.26, 60.7], [125.5, 61.2], [120, 59]],
    [[133.4, 30.9], [135.3, 37], [135.1, 43.5], [134.2, 47], [133.7, 43.4]],
  ];
  const clothes: [string, string, string][] = [
    ["#9d5974", "#c78d6b", "#49342d"],
    ["#cc8a4d", "#986a50", "#42352a"],
    ["#597d8e", "#d6aa88", "#614b37"],
  ];
  const walkers = paths.map((path, i) => {
    const visitor = makePerson(kit, visitors, clothes[i], .83, i + 1);
    const walk = followRoute(path, .89 + i * .1, i * 2.45);
    return (seconds: number) => {
      const position = visitor.person.position;
      walk(seconds, visitor.person);
      position.y = .108 + parkRelief(position.x, position.z);
      visitor.walk(seconds * 6.8);
    };
  });
  for (const walk of walkers) walk(0);
  return {
    landmarks: [archSite, courthouseSite, plazaSite, bridgeSite],
    update(seconds) {
      river.update(seconds);
      towDeparture ??= seconds;
      freighter(seconds - towDeparture);
      for (const walk of walkers) walk(seconds);
    },
    dispose: river.dispose,
  };
}
