import * as THREE from "three";
import type { ModelKit } from "./model-kit";

export type StreetPoint = [number, number];

export function streetRibbon(kit: ModelKit, parent: THREE.Group, points: readonly StreetPoint[], width: number,
  color: string, height: number | ((x: number) => number), texture?: "road" | "pavers", offset = 0) {
  const direction = (a: StreetPoint, b: StreetPoint) => new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const repeat = texture === "road" ? 4.2 : 2.8;
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const before = direction(points[Math.max(0, i - 1)], points[Math.max(1, i)]);
    const after = direction(points[Math.min(points.length - 2, i)], points[Math.min(points.length - 1, i + 1)]);
    const tangent = before.clone().add(after).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const miter = 1 / Math.max(.72, before.dot(tangent));
    for (const side of [-1, 1]) {
      const lateral = (offset + side * width / 2) * miter;
      const px = x + normal.x * lateral, pz = z + normal.y * lateral;
      positions.push(px, typeof height === "number" ? height : height(x), pz);
      uv.push(px / repeat, -pz / repeat);
    }
    if (i > 0) {
      const j = 2 * (i - 1);
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const geometry = kit.geometry(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, kit.material(color, texture));
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export const marketStreetSurface = {
  width: 4.3, sidewalkWidth: 6.7, asphalt: "#6b7471", paving: "#e9dabc", roadY: .088, sidewalkY: .061, seamX: -48,
};
export const grandDrive: StreetPoint[] = [
  [-65.3,-24], [-65.3,14.2], [-65,16.6], [-64.4,18.2], [-63.4,19.4],
  [-61.9,20.2], [-60.1,20.57], [-58.4,20.86], [-56.8,21.65], [-55.8,22.65], [-54.7,23.65], [-53,24],
];
const marketStreetEnds: StreetPoint[] = [[-65.3,-24], [-65.3,0], [-53,24]];
export const fineArtsDrive: StreetPoint[] = [
  [-109,44], [-106,41], [-102.5,38.2], [-98.4,36.7], [-94.4,36.3],
  [-73,36.3], [-61,36.3], [-57.4,35.8], [-54.9,34.35], [-53.35,31.7], [-53,29], [-53,24],
];

const bridgeGround: StreetPoint[] = [
  [110,16], [114.5,16], [116.5,15.67], [118.3,14.76], [120,13.4],
  [122.35,11.36], [123.9,10.45], [125.3,10.1], [126.6,10],
];
const bridgeRampStart = bridgeGround.at(-1)!;
const bridgeDeckStart = 136.6, bridgeRiseStart = 120.8, bridgeEnd = 195.2, bridgeExit = 219.7;
const bridgeZ = bridgeRampStart[1];
const bridgeRamp: StreetPoint[] = Array.from({ length: 21 }, (_, i) =>
  [THREE.MathUtils.lerp(bridgeRampStart[0], bridgeDeckStart, i / 20), bridgeZ]);
const eastLanding: StreetPoint[] = Array.from({ length: 13 }, (_, i) =>
  [THREE.MathUtils.lerp(bridgeEnd, bridgeExit, i / 12), bridgeZ]);
export const eadsRoad = {
  line: [...bridgeGround.slice(0, -1), ...bridgeRamp, ...eastLanding],
  ramp: bridgeRamp, eastLanding, z: bridgeZ, deckStart: bridgeDeckStart, end: bridgeEnd, exit: bridgeExit,
  width: 3.85, sidewalkWidth: 5.48, asphalt: "#626d69", paving: "#d1bea3", roadY: .088, deckY: 4.115,
  height(x: number) {
    if (x > bridgeEnd) return THREE.MathUtils.lerp(this.deckY, this.roadY, THREE.MathUtils.smoothstep(x, bridgeEnd, bridgeExit));
    const t = THREE.MathUtils.clamp((x - bridgeRiseStart) / (bridgeDeckStart - bridgeRiseStart), 0, 1);
    return THREE.MathUtils.lerp(this.roadY, this.deckY, t * t * (3 - 2 * t));
  },
};

type Street = { name: string; width: number; line: StreetPoint[]; kind: "city" | "campus" | "park" | "market" | "bridge" };
const streets: Street[] = [
  { name: "Delmar Boulevard", width: 5.6, line: [[-256,-48],[-162,-48],[-149,-48],[-101,-48],[-75,-48],[-49,-48],[-24,-48]], kind:"city" },
  { name: "Enright Avenue", width: 3.9, line: [[-149,-76],[-114,-76],[-101,-76],[-88,-76],[-83,-73],[-78,-61],[-75,-48]], kind:"city" },
  { name: "Trinity Avenue", width: 4.05, line: [[-149,-76],[-149,-48],[-149,-30]], kind:"city" },
  { name: "Loop south streets", width: 4.0, line: [[-149,-30],[-120,-30],[-111,-30],[-101,-30]], kind:"city" },
  { name: "Skinker Boulevard", width: 4.7, line: [[-101,-76],[-101,-48],[-101,-30],[-107,-17],[-108,-9],[-109,2],[-109,27.5],[-109,44],[-105,61],[-101,169]], kind:"city" },
  { name: "Forest Park Parkway", width: 5.4, line: [[-254,-17],[-171,-17],[-143,-17],[-136,-17],[-107,-17],[-65.3,-17]], kind:"market" },
  { name: "Forsyth Boulevard", width: 4.8, line: [[-254,31],[-164,31],[-147,30],[-136,27.5],[-109,27.5]], kind:"city" },
  { name: "Wrighton Way", width: 3.2, line: [[-136,-17],[-136,-11],[-135,-7],[-135,21],[-136,27.5]], kind:"campus" },
  { name: "Fine Arts Drive", width: 3.8, line: fineArtsDrive, kind:"market" },
  { name: "Grand Drive", width: marketStreetSurface.width, line: grandDrive, kind:"market" },
  ...marketStreetEnds.map(([x,z]): Street => ({
    name: "Market Row cross street", width: marketStreetSurface.width, line: [[x,z],[marketStreetSurface.seamX,z]], kind: "market",
  })),
  { name: "University Boulevard", width: 4.85, line: [[-143,-193],[-143,-122],[-142,-110],[-140,-94],[-137,-81],[-132,-70],[-130,-48]], kind:"city" },
  { name: "Natural Bridge Road", width: 5.25, line: [[-254,-75],[-205,-77],[-182,-76],[-163,-76],[-145,-75],[-132,-70],[-122,-81],[-111,-83],[-101,-76]], kind:"city" },
  { name: "West Drive", width: 3.65, line: [[-200,-77],[-202,-90],[-201,-106],[-198,-119],[-191,-126],[-180,-128],[-164,-127],[-157,-124],[-153,-119]], kind:"campus" },
  { name: "Grobman Drive", width: 3.45, line: [[-153,-119],[-150,-112],[-149,-101],[-149,-93],[-154,-84],[-162,-80],[-163,-76]], kind:"campus" },
  { name: "Performance Drive", width: 3.35, line: [[-142,-110],[-148,-110],[-153,-114],[-157,-117],[-160,-116],[-166,-116]], kind:"campus" },
  { name: "Clark Avenue", width: 5.25, line: [[-24,80],[13,80],[35,80],[60.4,80],[79,80],[101,80],[118,80],[126,80],[133,76],[137.5,76]], kind:"city" },
  { name: "Market Street", width: 4.95, line: [[-24,50.5],[13,50.5],[35,50.5],[60.4,50.5],[72,50.5],[81,53.49],[86,53.49],[95,53.49],[110,53.49]], kind:"city" },
  { name: "14th Street south", width: 4.25, line: [[24,49],[24,50.5],[30,54],[44,54],[56,55],[60.4,60],[60.4,80],[60.4,94],[63,100],[73,102],[118,102],[118,110],[113,122],[106,161]], kind:"city" },
  { name: "Stadium east", width: 4.75, line: [[118,80],[118,93],[118,102],[126,102],[134,94],[138,82],[137.5,76]], kind:"city" },
  { name: "Stadium south", width: 4.2, line: [[61.7,108.5],[76,108.5],[99,110.4],[118,110]], kind:"city" },
  { name: "Riverfront 4th Street", width: 4.15, line: [[110,16],[110,34],[110,41],[110,50],[110,53.49],[110,63],[111,71],[116,76],[126,80]], kind:"city" },
  { name: "Downtown east approach", width: 4.05, line: [[104,24],[107,25],[110,29],[110,34]], kind:"city" },
  { name: "Riverfront north approach", width: 4.05, line: [[86,-51],[86,-58],[95,-57],[106,-53],[110,-47],[110,16]], kind:"city" },
  { name: "Laclede’s Landing approach", width: eadsRoad.width, line: eadsRoad.line, kind:"bridge" },
  { name: "Clark and Market connector", width: 4.3, line: [[-24,50.5],[-24,66],[-24,80]], kind:"city" },
  { name: "Neighborhood south links", width: 4.3, line: [[-24,80],[-24,87],[-19,92],[-7,92],[-2,87],[0,80],[0,66]], kind:"city" },
  { name: "Neighborhood north links", width: 4.3, line: [[-24,-48],[-24,-80],[-24,-90],[-19,-95],[-8,-95],[-2,-90],[0,-80]], kind:"city" },
];

function pathSegments(line: StreetPoint[]) {
  return line.slice(1).map((end, i) => {
    const start = line[i];
    return { start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) };
  });
}

function distanceToSegment([x,z]: StreetPoint, [a,b]: StreetPoint, [c,d]: StreetPoint) {
  const t = THREE.MathUtils.clamp(((x-a)*(c-a)+(z-b)*(d-b))/((c-a)**2+(d-b)**2), 0, 1);
  return Math.hypot(x-a-t*(c-a), z-b-t*(d-b));
}

const mappedStreets = streets.map((street) => ({ ...street, segments: pathSegments(street.line) }));

// Intersect the offset lane centerlines at each junction before rounding the turn.
export function trafficLane(points: StreetPoint[], x: number, z: number,
  offset: number | ((start: StreetPoint, end: StreetPoint) => number) = 1.02): StreetPoint[] {
  const directions = points.map(([a, b], i) => {
    const [c, d] = points[(i + 1) % points.length];
    return new THREE.Vector2(c - a, d - b).normalize();
  });
  const offsets = points.map((start, i) => typeof offset === "number" ? offset : offset(start, points[(i + 1) % points.length]));
  return points.map(([a, b], i) => {
    const previous = (i + points.length - 1) % points.length;
    const before = directions[previous], after = directions[i];
    const normal = new THREE.Vector2(-before.y, before.x);
    const nextNormal = new THREE.Vector2(-after.y, after.x);
    const across = offsets[previous];
    const turn = before.dot(nextNormal);
    const along = Math.abs(turn) < .0001 ? 0 : (offsets[i] - across * normal.dot(nextNormal)) / turn;
    return [a - x + normal.x * across + before.x * along, b - z + normal.y * across + before.y * along];
  });
}

export function hasStreetAt(x: number, z: number, margin = 0) {
  return mappedStreets.some(({ width, segments }) =>
    segments.some(({ start, end }) => distanceToSegment([x,z], start, end) < width / 2 + margin));
}

export function buildRegionalStreets(kit: ModelKit, group: THREE.Group) {
  for (const street of mappedStreets) {
    const { line, width, kind, segments } = street;
    if (kind === "bridge") continue; // The riverfront draws the entire road on its elevation profile.
    const market = kind === "market";
    const asphalt = market ? marketStreetSurface.asphalt : kind === "park" ? "#70786a" : kind === "campus" ? "#68746f" : eadsRoad.asphalt;
    const paving = market ? marketStreetSurface.paving : kind === "park" ? "#c8b395" : eadsRoad.paving;
    const layer = kind === "campus" ? -.003 : market ? 0 : .003;
    streetRibbon(kit, group, line, width + (market ? 2.4 : kind === "city" ? 2.48 : 1.36), paving, marketStreetSurface.sidewalkY + layer, "pavers");
    streetRibbon(kit, group, line, width, asphalt, marketStreetSurface.roadY + layer, "road");
    if (kind !== "city" && !market) continue;
    for (const { start: [a,b], end: [c,d], length } of segments) {
      const dx = (c-a)/length, dz = (d-b)/length;
      for (let along = 1; along < length - .9; along += 1.15) {
        for (const side of [-1,1]) {
          const edge=side*(width/2+.055);
          const x=a+dx*along-dz*edge,z=b+dz*along+dx*edge;
          if (mappedStreets.some((other) => other !== street && other.segments.some(({start,end}) =>
            distanceToSegment([x,z],start,end)<other.width/2+.67))) continue;
          const curb=kit.box(group,[x,.103,z],[1.12,.056,.11],kit.material("#d6c8ac"));
          curb.rotation.y=-Math.atan2(dz,dx);
        }
      }
    }
    for (const { start, end, length } of segments) {
      const [a,b] = start, [c,d] = end;
      const dx = (c-a)/length, dz = (d-b)/length;
      for (let along = 1.5; along < length - 1; along += 2.85) {
        const x = a + dx * along, z = b + dz * along;
        if (mappedStreets.some((other) => other !== street && other.segments.some(({ start, end }) =>
          distanceToSegment([x,z],start,end) < other.width / 2 + 1.1))) continue;
        const dash = kit.ground(group, x,z,1.22,.055,kit.material("#d6ac63"),.093);
        dash.rotation.set(-Math.PI/2,0,-Math.atan2(dz,dx));
      }
    }
  }
  // Delmar rails continue through the district in the same paved corridor.
  for (const [x,z,name] of [
    [-145,-44.45,"DELMAR BLVD"],[-97.7,-43.5,"SKINKER BLVD"],
    [57.03,76.5,"CLARK AVE"],[63.65,53.8,"MARKET ST"],[114.7,76.28,"CLARK AVE"],
    [-145.4,-115.7,"UNIVERSITY BLVD"],[-165.6,-72.3,"NATURAL BRIDGE RD"],
  ] as const) {
    kit.cylinder(group,[x,.91,z],.065,1.72,kit.material("#51635a"));
    kit.box(group,[x,1.71,z],[1.47,.24,.075],kit.material("#426356"),true);
    kit.sign(group,name,[x,1.71,z+.042],1.38,["#426356","#f7e9c8"]);
  }
  for (const z of [-48.57, -47.43]) {
    streetRibbon(kit, group, [[-254,z],[-30,z]], .071, "#afa998", .097);
  }
}

export function crosswalk(kit: ModelKit, group: THREE.Group, x: number, z: number, width: number, acrossEastWestStreet = false) {
  const paint = kit.material("#ece4ce");
  for (let d = -width / 2 + .35; d < width / 2; d += .57) {
    kit.ground(group, x + (acrossEastWestStreet ? 0 : d), z + (acrossEastWestStreet ? d : 0),
      acrossEastWestStreet ? 1.03 : .30, acrossEastWestStreet ? .3 : 1.03, paint, .107);
  }
}
