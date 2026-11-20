import * as THREE from "three";
import { ModelKit, seededRandom } from "./model-kit";
import { crosswalk, fineArtsDrive, grandDrive, hasStreetAt, streetRibbon, trafficLane } from "./st-louis-streets";
import type { StLouisDistrict } from "./st-louis-layout";
import { marketAllotments } from "./st-louis-layout";
import { gardenBorder, parkBench } from "./park-details";
import { artHillMonument } from "./city-vignettes";

type Point = [number, number];
export type Tree = { x: number; z: number; size: number; tall?: boolean };
export type StreetActor = { model: "sedan" | "crossover" | "riley" | "jules" | "trolley"; path: Point[]; speed: number; phase: number; height?: number; shuttle?: boolean };
export const delmarStop = { x: 4.7, z: 3.16, wait: 4.25 };
const turf = ["#93ad60", "#96b165", "#91ac5e", "#94ae60"];
const clarkTraffic: Point[] = [[60.4,80],[118,80],[118,102],[73,102],[63,100],[60.4,94]];

function site(kit: ModelKit, group: THREE.Group, x: number, z: number, w: number, d: number, h: number, color: string, type: "flat" | "gable" | "corner" = "flat") {
  const walls = kit.material(color, "brick");
  kit.box(group,[x,h/2+.075,z],[w,h,d],walls);
  kit.box(group,[x,h+.14,z],[w+.20,.24,d+.20],kit.material("#c6a78a"));
  if (type === "gable") {
    const home = kit.group(group, [x, .14, z]);
    kit.roof(home, h, w + .16, d + .20, w * .28, "#696d65", walls);
    kit.box(group, [x-w*.24,h+w*.16,z-.24],[.41,w*.42,.5],walls,true);
  } else {
    kit.box(group,[x,h+.28,z],[w-.12,.085,d-.12],kit.material("#7d7d70","shingles"));
  }
  if (type === "corner") {
    kit.box(group, [x+w*.31,h*.66,z+d*.33], [w*.43,h*.68,d*.42],walls,true);
    kit.box(group, [x+w*.31,h*1.01,z+d*.33], [w*.45,.28,d*.44],kit.material("#d6b791","stone"));
  }
  for(let y=1;y<h-.35;y+=1.11) {
    for(let a=-w/2+.62;a<w/2-.42;a+=1.02) {
      kit.window(group,[x+a,y+.075,z+d/2+.018],.57,.75,0,true);
      kit.window(group,[x+a,y+.075,z-d/2-.018],.57,.75,Math.PI,true);
    }
    for(let a=-d/2+.60;a<d/2-.44;a+=1.06) {
      kit.window(group,[x+w/2+.018,y+.075,z+a],.54,.72,Math.PI/2);
      kit.window(group,[x-w/2-.018,y+.075,z+a],.54,.72,-Math.PI/2);
    }
  }
  if (type !== "gable") kit.box(group,[x-w*.29,h+.46,z+d*.20],[.8,.33,.67],kit.material("#9a8b78"));
  for (const side of [-1, 1]) {
    kit.box(group, [x+w*.08, .67,z+side*(d/2+.024)],[.72,1.27,.09],kit.material("#455752"));
    kit.box(group, [x+w*.08, .155,z+side*(d/2+.15)],[1.03,.14,.35],kit.material("#cbb092"));
  }
}

function lamp(kit: ModelKit, group: THREE.Group, x: number, z: number) {
  const cast = kit.material("#4a5b52");
  kit.cylinder(group,[x,.26,z],.19,.33,cast);
  kit.cylinder(group,[x,1.37,z],.075,2.62,cast);
  kit.box(group,[x,2.7,z],[.30,.075,.18],kit.material("#f2d89c"),true);
}

function plantedBed(kit: ModelKit, group: THREE.Group, x: number, z: number, length: number, seed: number) {
  const rng=seededRandom(seed);
  kit.box(group,[x,.105,z],[length,.16,1.04],kit.material("#c0aa88","stone"));
  kit.ground(group,x,z,length-.14,.89,kit.material("#76694f"),.194);
  for(let i=0;i<length*6;i++) {
    const px=x+(rng()-.5)*(length-.22), pz=z+(rng()-.5)*.76;
    kit.foliage(group,[px,.24,pz],[.29,.23,.26],["#6f8749","#929e56","#b4ac57"][i%3]);
    if(i%2===0) kit.sphere(group,[px,.372,pz],[.086,.073,.084],kit.material(["#cba05d","#b37170","#dbcca5"][i%3]));
  }
}

export function buildStLouisGround(kit: ModelKit, ground: THREE.Group, district: StLouisDistrict) {
  const rng=seededRandom(52+Math.round(district.x));
  const trees: Tree[]=[];
  const actors: StreetActor[]=[];
  const lane = (points: Point[], offset?: Parameters<typeof trafficLane>[3]) =>
    trafficLane(points, district.x, district.z, offset);
  const plant=(x:number,z:number,size:number,tall=false)=>{
    const worldX = district.x + x, worldZ = district.z + z;
    const streetClearance = district.id === "forest-park" ? 1.2 + 1.1 * size : .75;
    if (hasStreetAt(worldX, worldZ, streetClearance)) return;
    if (district.id === "forest-park") {
      const { x: gardenX, z: gardenZ, width, depth } = marketAllotments;
      const canopy = 1.25 * size;
      if (Math.abs(worldX - gardenX) < width / 2 + canopy && Math.abs(worldZ - gardenZ) < depth / 2 + canopy) return;
      if (Math.abs(x - 16.65) < 5.1 + canopy && z > 10.2 - canopy && z < 21.1 + canopy) return;
    }
    trees.push({x,z,size,tall});
  };
  const plaza=(x:number,z:number,w:number,d:number)=>kit.ground(ground,x,z,w,d,kit.material("#d8bf9a","pavers"),.057);
  const path=(points:Point[],width=1.28)=>streetRibbon(kit,ground,points,width,"#ceb391",.067,"pavers");
  const lot=(x:number,z:number,w:number,d:number)=> {
    kit.ground(ground,x,z,w+.28,d+.27,kit.material("#ceb598","pavers"),.056);
    kit.ground(ground,x,z,w,d,kit.material("#727d73","road"),.069);
    for(const side of [-1,1]) {
      for(let i=-w/2+.66;i<w/2-.4;i+=.91) {
        kit.ground(ground,x+i,z+side*d*.38,.034,d*.23,kit.material("#e9dec7"),.071);
      }
    }
  };
  const canBuild=(x:number,z:number,w:number,d:number) =>
    [[0,0],[-w/2,-d/2],[-w/2,d/2],[w/2,-d/2],[w/2,d/2]].every(([a,b]) =>
      !hasStreetAt(district.x+x+a,district.z+z+b,.52));
  const grass=(x:number,z:number,w:number,d:number,tone=0)=>kit.ground(ground,x,z,w,d,kit.material(turf[tone],"grass"),.036+tone*.004);
  

  if (district.id === "delmar") {
    const loop: Point[] = [[-149,-48],[-101,-48],[-101,-76],[-149,-76]];
    const laneWidth = (start: Point, end: Point) => start[1] === -48 && end[1] === -48 ? 1.79 : .98;
    plaza(0,0,63,27);
    for(const x of [-29,0,13.1,22.7]) crosswalk(kit,ground,x,0,5.4,true);
    const shopWalk: Point[] = [[-30,4.24],[2.75,4.24],[3.3,4.5],[6.6,4.5],[7.15,4.24],[31,4.24]];
    path(shopWalk,.58);
    const stop = kit.group(ground, [delmarStop.x, .069, delmarStop.z]);
    const metal = kit.material("#485f59");
    kit.ground(stop, .36, .21, 3.05, 1.09, kit.material("#dbc9a7", "pavers"), .038);
    kit.cylinder(stop, [-1.15, .89, .375], .069, 1.78, metal, true);
    kit.box(stop, [-1.15, 1.58, .375], [.73, .28, .058], metal, true);
    kit.sign(stop, "LOOP TROLLEY", [-1.15, 1.58, .409], .67, ["#953f38", "#fff0c7"]);
    const signBack = kit.group(stop, [-1.15, 1.58, .34], Math.PI);
    kit.sign(signBack, "LOOP TROLLEY", [0, 0, 0], .67, ["#953f38", "#fff0c7"]);
    kit.box(stop, [-1.15, 1.11, .375], [.37, .48, .062], metal, true);
    const timetable = kit.group(stop, [-1.15, 1.13, .339], Math.PI);
    kit.sign(timetable, "DELMAR", [0, 0, 0], .32, ["#d7a367", "#382d28"]);
    for (const x of [-.52, -.31, -.10, .11, .32, .53, .74, .95, 1.16, 1.37]) {
      kit.box(stop, [x,.258,-.245], [.186,.017,.13], kit.material("#bd9060"));
    }
    for (const x of [-.18, .65, 1.46]) {
      kit.box(stop, [x, .447, .423], [.7, .108, .415], kit.material("#ab7750"), true);
      kit.box(stop, [x, .208, .423], [.139, .385, .28], metal, true);
    }
    for (const [x,z] of [[-14,-16.5],[26,-19.6]]) lot(x,z,9.2,4.2);
    for (const [x,z] of [[-10.5,3.66],[.63,-3.82],[24.5,3.65]]) {
      const seat=kit.material("#a17550");
      kit.box(ground,[x,.43,z],[1.07,.074,.36],seat,true);
      kit.box(ground,[x,.61,z+.14],[1.09,.31,.078],seat,true);
      for (const off of [-.4,.4]) kit.box(ground,[x+off,.24,z],[.08,.36,.28],kit.material("#586459"));
    }
    for(const x of [-23,-17,-6,2,17,23,29]) {
      plant(x,x%2===0?-3.55:3.75,.62+rng()*.23,true);
      if (x!==2) plantedBed(kit,ground,x+1.07,3.61,1.03,50+x);
    }
    for(const [i,x] of [-28,-21,-14,-6,2,9,16,23,29].entries()) {
      const z=25+rng()*.7;
      if (canBuild(x,z,5,5)) site(kit,ground,x,z,4.32+rng()*.65,4.78+rng()*.9,2.4+i%3*.53,
        ["#b88160","#b38670","#b69e82"][i%3],i%3===1?"flat":"gable");
      if(i%2===0) plant(x-1.8,30,.84);
    }
    for(const x of [-28,-19,-10,3,13,22,31]) plant(x,-16, .86+rng()*.5);
    for(const [i,x] of [-27,-20,-6,4,20,30].entries()) {
      const z=-22.5+rng();
      if (canBuild(x,z,5.25,5.25)) site(kit,ground,x,z,4.6+rng()*.65,4.9+rng()*.55,2.51+rng()*1.01,
        ["#bd8c68","#ac785f","#c0aa85"][i%3],i%3===0?"flat":"gable");
    }
    actors.push(
      {model:"trolley",path:[[-32,0],[33,0]],speed:2.2,phase:0},
      {model:"sedan",path:lane(loop,laneWidth),speed:2.8,phase:27},
      {model:"crossover",path:lane([...loop].reverse(),laneWidth),speed:2.8,phase:115},
      {model:"riley",path:shopWalk,speed:1.0,phase:22,shuttle:true},
      {model:"jules",path:[[25,-4.21],[-27,-4.21]],speed:.93,phase:19,shuttle:true},
    );
  } else if (district.id === "enterprise" || district.id === "ballpark") {
    const arena=district.id==="enterprise";
    plaza(0,0,arena?37:42,arena?27:56);
    const offset=arena ? 13 : -5;
    crosswalk(kit,ground,arena?11.27:15.45,offset,5.0,true);
    crosswalk(kit,ground,arena?14.4:19,offset+3.7,5.3);
    if (arena) {
      for (let i=0;i<6;i++) {
        const x=-26+i*9.3;
        if (canBuild(x,22.7,7.6,7.6)) site(kit,ground,x,22.1+i%2*1.2,6.45+i%2*1.1,7.4,3.9+(i%4)*1.35,["#b28668","#a77762","#a79577"][i%3],i%3===1?"corner":"flat");
        plant(x-3.98,17.0,.82+i%2*.12,true);
      }
      // Open Memorial Plaza across Market Street from the theatre.
      plaza(-2.1,-26.2,28.5,13.6);
      for(const x of [-13.2,-6.6,1.6,9.1]) {
        plantedBed(kit,ground,x,-24.5,3.4,150+x);
        plant(x,-28,1.06,false);
      }
      for (const x of [-26,21.5,29.2]) {
        if (canBuild(x,-24.3,6.6,7.1)) site(kit,ground,x,-24.3,6.6,7.1,4.6+rng()*2.1,["#aa7c66","#b69577","#a77c60"][Math.abs(Math.round(x))%3],"corner");
      }
      for (const x of [-9.8,-4.1,1.3,7.3,11.2]) {
        lamp(kit,ground,x,11.05);
        if(x<1) plantedBed(kit,ground,x+1.1,10.8,2.0,45+x);
      }
      lot(-28.3,1.5,8.8,12.4);
      path([[-28.3,7],[-28.3,10],[-25.8,12],[11,9.4]],1.11);
    } else {
      for (const [i,[x,z,w,d,h]] of [[-29,-22.2,8.4,6.6,4.9],[-20.6,-23.4,6.7,6.2,6.2],[-7.4,-22.9,8.3,6.9,4.2],[2.3,-24,6.4,7.2,6.3]].entries()) {
        if(canBuild(x,z,w,d)) site(kit,ground,x,z,w,d,h,["#ae8062","#b9a286","#a57566"][i%3],i%2===0?"corner":"flat");
      }
      for (let i=0;i<4;i++) {
        const x=24.5+i%2*1.5,z=-22+i*12.7;
        if(canBuild(x,z,6.5,8.2)) site(kit,ground,x,z,6.5,8.2,3.6+i%3*1.34,"#a17b6b",i%2===0?"corner":"flat");
      }
      for (const x of [-14.2,-9.8,5.5,12.3,15.4]) {
        lamp(kit,ground,x,-8.28);
        plant(x,-8.6,.68,true);
      }
      for (const x of [-11,4,13]) plantedBed(kit,ground,x,-13.0,2.3,51+x);
    }
    actors.push(
      {model:arena?"sedan":"crossover",path:lane(clarkTraffic),speed:2.85,phase:arena?6:47},
      {model:"riley",path:[[-15,offset-3.25],[12,offset-3.25],[12,offset-3.8],[-15,offset-3.8]],speed:1.05,phase:13},
      {model:"jules",path:[[13,offset+3.33],[-17,offset+3.33],[-17,offset+3.91],[13,offset+3.91]],speed:1.03,phase:11},
    );
  } else if (district.id==="forest-park") {
    artHillMonument(kit, ground);
    const clearOfRoad = (x: number, z: number, padding = .75) => !hasStreetAt(district.x+x, district.z+z, padding);
    // Fit the compact cutaway into a larger wooded landscape.
    for (let i=0;i<14;i++) {
      const x=-28+i*4.4;
      plant(x,-30.2-(i%3)*1.32,1.05+rng()*.41,i%4===1);
    }
    for (const x of [-12.6,-11.6,11.6,12.6]) {
      for (let i=0;i<8;i++) {
        const z=-17+i*1.2;
        if (Math.abs(x)<12&&i%3===1 || !clearOfRoad(x, z, .54)) continue;
        kit.foliage(ground,[x,.22,z],[.55,.29,.53],i%2===0?"#81964e":"#687d45");
      }
    }
    streetRibbon(kit,ground,[[-32,-20],[-22,-20],[-14,-24],[-5,-25],[4,-25],[15,-22],[25,-17],[32,-14]],1.25,"#d9c3a2",.083,"pavers");
    streetRibbon(kit,ground,[[-26,15],[-19,8],[-18,1],[-19,-7],[-14,-13],[-9,-14]],1.12,"#d7bd95",.082,"pavers");
    const basinPath: Point[] = Array.from({ length: 48 }, (_, i) => {
      const angle = i * Math.PI / 24;
      const shape = 1 + .095 * Math.sin(angle) - .04 * Math.cos(angle * 2);
      return [11.08 * shape * Math.cos(angle), -14 + 10 * shape * Math.sin(angle)];
    });
    const hillPath: Point[] = [[-18.5,1],[-19,-7],[-14,-13],[-11.45,-14]];
    plaza(0,-23.9,13,2.1);
    for(let i=0;i<38;i++) {
      const side=i%2===0?-1:1;
      const x=side*(17.8+rng()*15.8), z=-29+rng()*50;
      if (Math.abs(z+20)<1.2 || Math.abs(z-13)<1) continue;
      plant(x,z,.86+rng()*.89,i%5===1);
    }
    for (const [x,z] of [[-10,-24],[10,-24],[-13,-16],[13,-16],[-18,14],[18,14],[-19,19],[18,21]]) plant(x,z,1.04);
    for(const x of [-12,-5,5,12]) {
      plantedBed(kit,ground,x,-24.1,2.2,93+x);
      lamp(kit,ground,x,-22.8);
    }
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 1 : 0;
      for (const [i, z] of [-19, -15.2, -11.1, -7.4].entries()) {
        const x = side * (13.7 + (i % 2) * .78 + edge * .7);
        if ([-1.83,0,1.83].every((offset) => clearOfRoad(x, z + offset, .86))) {
          gardenBorder(kit, ground, x, z, 3.6 + (i % 3) * .4, 1.65, Math.PI / 2 + i*.038,
            111 + i * 12 + edge * 31);
        }
        if (i % 2 === 0) {
          if (clearOfRoad(x - side*1.65, z - .30, .8)) parkBench(kit, ground, x - side * 1.65, z - .30, side * -Math.PI / 2);
          plant(x + side * 1.82, z + 1.65, 1.21 + rng()*.25, false);
        }
      }
      for (const [x, z, size, seed] of [[16.9,-21.8,1.7,42],[17.2,-9.1,1.77,62],[17.8,-4.5,1.5,74]] as const) {
        if (!hasStreetAt(district.x+x*side, district.z+z, .8)) {
          gardenBorder(kit, ground, x*side, z, size + 1.4, 1.5, side*.43, seed + edge*5);
          plant((x + 1.67)*side, z-.67, size*.76, seed%3===0);
        }
      }
    }
    actors.push(
      {model:"riley",path:basinPath,speed:.94,phase:18,height:.155},
      {model:"jules",path:hillPath,speed:.93,phase:9,shuttle:true},
      {model:"crossover",path:lane([
        ...fineArtsDrive, ...grandDrive.slice(1,-1).reverse(), [-65.3,-17],[-107,-17],[-108,-9],[-109,2],
      ],.82),speed:2.5,phase:24},
    );
  } else if (district.id === "washu") {
    // A pedestrian axis runs east from Brookings through Tisch Park to Skinker.
    plaza(4.5,0,5.6,11.7);
    grass(23.4,0,29.8,19.1,1);
    path([[4.2,0],[13,0],[22,0],[31,0],[41.6,0]],2.34);
    path([[12,-23],[12,-13],[12,0],[12,12],[12,17.8]],1.42);
    path([[13,0],[17,-4],[20,-9.9]],1.14);
    path([[13,0],[17,4],[20,9.98]],1.14);
    path([[40,0],[37,3.5],[32,6.9]],1.14);
    path([[20.8,9.65],[26,7.12],[31.3,6.4],[35,7.46]],1.34);
    plaza(29,7.32,13,2.56);
    for (const [x,z] of [[7,-7],[7,7],[17,-5.8],[17,5.8],[26,-6.4],[27,5.2],[34,-7],[36,5.6],[8,-19],[8,19],[30,18],[29,-19],[-14,17],[-14,-16]]) {
      plant(x,z,.94+rng()*.44,Math.abs(z)<8);
    }
    for (const [x,z] of [[9,6.4],[9,-6.4],[22,6.54],[22,-6.54],[34,-5.9]]) {
      plantedBed(kit,ground,x,z,1.5,95+x);
      lamp(kit,ground,x+1.65,z);
    }
    for (const [x,z,w,d,h,style] of [[-18,-17,8.6,6.5,4.3,"gable"],[-22,18.5,8.5,7.2,4.9,"gable"],[31,-18,9,7.5,4.4,"flat"],[24,-23,7.6,5.2,4.3,"corner"]] as const) {
      if(canBuild(x,z,w,d)) site(kit,ground,x,z,w,d,h,style==="gable"?"#a77363":"#b19e86",style);
    }
    crosswalk(kit,ground,41.7,0,4.7);
    actors.push(
      {model:"riley",path:[[6.8,.47],[13,.47],[20,.47],[29,.47],[39,.47]],speed:.95,phase:12,shuttle:true},
      {model:"jules",path:[[12.1,-12.4],[12.1,-4.5],[12.1,1.1],[12.1,11.8],[12.1,17.6]],speed:.91,phase:20,shuttle:true},
      {model:"sedan",path:lane([[-136,-17],[-107,-17],[-108,-9],[-109,2],[-109,27.5],[-136,27.5],[-135,21],[-135,-7],[-136,-11]],.80),speed:2.45,phase:30},
    );
  } else {
    // Touhill, Millennium and the library occupy different terraces on North Campus.
    plaza(0,9.65,18.6,4.16);
    plaza(-12.5,11.1,12.5,5.8);
    lot(-17.9,-14.15,11.9,5.7);
    lot(16.1,6.7,7.2,8.3);
    streetRibbon(kit,ground,[[-24.5,-14.45],[-23.0,-14.45],[-21.9,-14.15]],2.55,"#727d73",.079,"road");
    streetRibbon(kit,ground,[[19.4,5.8],[21.3,5.8],[23.4,5.65]],2.45,"#727d73",.079,"road");
    plaza(-9.5,20.15,5.0,3.3);
    path([[23,-5.5],[18,-5.5],[14,-1],[12,3],[9,7],[5,9.5],[-4,10.3],[-10,11.1]],1.38);
    path([[-16.5,10.7],[-12.8,11.1],[-10.1,13.3],[-13.9,15.1]],1.35);
    path([[7.3,11.6],[8.4,13.9],[8,16.0],[6.7,17.15]],1.42);
    path([[-9.5,14.2],[-7.5,16.3],[-5.7,20.1]],1.3);
    path([[-7.8,8],[-14.2,6.6],[-20.5,4.3],[-24.9,4.9]],1.08);
    path([[-14.5,23.8],[-13.5,25.2],[-10.4,27.4],[-8.8,28.15]],1.35);
    for (const [x,z] of [[-21,5],[-24,10],[-20,14],[-19,11],[-8.5,12],[-5.8,12.1],[5.8,12.2],[11.2,10.5],[14,13.9],[14,-11],[16,-14],[-22,-4],[-23,-16],[-8,-14],[6,-13]]) {
      plant(x,z,1.0+rng()*.29,x%2>0);
    }
    for (const [x,z] of [[-9,11.4],[-4.2,9.25],[3.75,9.28],[8.9,11.8],[-18.2,14.2]]) {
      plantedBed(kit,ground,x,z,1.85,82+x);
      lamp(kit,ground,x+1.24,z);
    }
    for (const [x,z,w,d,h] of [[-21,-16.9,7.1,5.0,3.7],[8.7,-11.9,7.7,5.2,3.35],[18,-13,4.9,4.2,2.5]] as const) {
      if(canBuild(x,z,w,d)) site(kit,ground,x,z,w,d,h,"#ac7f69",x<0?"corner":"flat");
    }
    actors.push(
      {model:"riley",path:[[-10.5,11.07],[-4,10.3],[5,9.52],[9,7],[12,3]],speed:.96,phase:12,shuttle:true},
      {model:"jules",path:[[-16.5,10.7],[-12.8,11.1],[-10.1,13.3],[-13.9,15.1]],speed:.92,phase:5,shuttle:true},
      {model:"sedan",path:lane([[-200,-76.8],[-182,-76],[-163,-76],[-162,-80],[-154,-84],[-149,-93],[-149,-101],
        [-150,-112],[-153,-119],[-157,-124],[-164,-127],[-180,-128],[-191,-126],[-198,-119],[-201,-106],[-202,-90]],
      .82),speed:2.4,phase:52},
    );
  }
  return { trees, actors };
}
