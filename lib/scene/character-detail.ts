import * as THREE from "three";
import type { ModelKit } from "./model-kit";

export function characterFace(kit: ModelKit, head: THREE.Group, skin: string, hair: string, look: number) {
  const complexion = new THREE.Color(skin);
  const shadow = "#" + complexion.clone().lerp(new THREE.Color("#a95e5a"), .27).getHexString();
  const light = "#" + complexion.clone().lerp(new THREE.Color("#ffd5a4"), .21).getHexString();
  const hairLight = "#" + new THREE.Color(hair).lerp(new THREE.Color("#c3875b"), .19).getHexString();
  const skinMat = kit.material(skin);
  const hairMat = kit.material(hair);
  const iris = kit.material(look % 2 ? "#493630" : "#386265");
  const whites = kit.material("#fff1dc");

  kit.sphere(head, [0, .180, .001], [.427, .428, .381], skinMat);
  kit.sphere(head, [0, .078, .086], [.316, .239, .286], skinMat);
  kit.sphere(head, [0, .063, .160], [.139, .088, .095], kit.material(light));
  for (const side of [-1, 1]) {
    const x = side * .087;
    kit.sphere(head, [side*.192, .13, .006], [.078, .112, .084], skinMat);
    kit.sphere(head, [side*.209, .13, .057], [.028, .061, .024], kit.material(shadow));
    kit.sphere(head, [side*.131, .112, .163], [.102, .059, .067], kit.material(shadow));
    const eye = kit.group(head, [x, .185, .181]);
    eye.rotation.y = side*.23;
    kit.sphere(eye, [0, 0, .012], [.069, .046, .024], whites);
    kit.sphere(eye, [-.004, -.001, .024], [.040, .042, .013], iris);
    kit.sphere(eye, [-.005, -.002, .030], [.021, .029, .012], kit.material("#352923"));
    kit.sphere(eye, [-.010, .009, .037], [.012, .014, .006], whites);
    const brow = kit.box(eye, [0, .046, .009], [.076, .024, .024], hairMat, true);
    brow.rotation.z = side * -.12;
  }
  kit.sphere(head, [0, .138, .208], [.061, .093, .063], skinMat);
  kit.sphere(head, [0, .117, .237], [.070, .048, .049], kit.material(light));
  kit.sphere(head, [0, .067, .204], [.104, .025, .033], kit.material("#805750"));
  kit.sphere(head, [0, .055, .203], [.072, .017, .025], kit.material(shadow));

  if (look === 1 || look === 4) {
    const cap = kit.material(look === 1 ? "#ce784b" : "#45706b");
    const stitching = kit.material(look === 1 ? "#e2a070" : "#84a699");
    kit.sphere(head, [0, .294, -.035], [.425, .25, .396], hairMat);
    kit.sphere(head, [0, .329, .002], [.462, .224, .424], cap);
    kit.box(head, [0, .31, .176], [.35, .043, .267], cap, true).rotation.x = .14;
    kit.box(head, [0, .355, .199], [.083, .052, .022], stitching, true);
    kit.sphere(head, [0, .443, 0], [.051, .028, .045], cap);
  } else {
    kit.sphere(head, [0, .288, -.057], [.454, .265, .413], hairMat);
    const bangs = look === 3 ? 5 : look === 2 ? 7 : 4;
    for (let i = 0; i < bangs; i++) {
      const x = (i - (bangs - 1)/2) * (.34 / bangs);
      const lock = kit.sphere(head, [x, .305 + i*.004, .122 - Math.abs(x)*.21],
        [.107 + (i%2)*.034, .15 + (i%3)*.022, .155], kit.material(i % 3 ? hair : hairLight));
      lock.rotation.z = look === 2 ? -.21 : -.46;
    }
    if (look === 2) {
      kit.sphere(head, [0, .294, -.204], [.188, .239, .213], hairMat);
      kit.sphere(head, [0, .288, -.288], [.133, .154, .133], kit.material(hairLight));
    }
    if (look === 3) for (const side of [-1, 1]) {
      kit.sphere(head, [side*.163, .117, -.060], [.136, .356, .25], hairMat);
      kit.sphere(head, [side*.178, .087, -.105], [.087, .282, .18], kit.material(hairLight));
      kit.sphere(head, [side*.209, .103, .025], [.034, .048, .031], kit.material("#edbe64"));
    }
  }
  if (look === 2) {
    const acetate = kit.material("#594343");
    for (const x of [-.087, .087]) {
      const rim = kit.group(head, [x, .18, .218]);
      for (const side of [-1, 1]) {
        kit.box(rim, [0, side * .036, 0], [.101, .012, .013], acetate, true);
        kit.box(rim, [side * .048, 0, 0], [.014, .069, .013], acetate, true);
      }
    }
    kit.box(head, [0, .186, .223], [.078, .014, .016], acetate, true);
  }
  if (look === 5) {
    kit.sphere(head, [0, .061, .177], [.22, .123, .113], hairMat);
    kit.sphere(head, [0, .074, .234], [.068, .021, .017], kit.material(shadow));
  }
}

export function characterOutfit(kit: ModelKit, chest: THREE.Group, color: string, look: number, width: number) {
  const shade = "#" + new THREE.Color(color).lerp(new THREE.Color("#353e49"), .22).getHexString();
  const trim = "#" + new THREE.Color(color).lerp(new THREE.Color("#f7dec1"), .25).getHexString();
  const fabric = kit.material(color);
  const edge = kit.material(shade);
  const facing = kit.material(trim);
  kit.sphere(chest, [0, .205, 0], [.52 * width, .53, .363 * width], fabric);
  kit.box(chest, [0, .003, 0], [.384*width, .075, .287*width], edge, true);
  for (const side of [-1, 1]) {
    const collar = kit.box(chest, [side*.082, .372, .154*width], [.105,.134,.055], facing, true);
    collar.rotation.z = side * .53;
  }
  if (look === 6) {
    const apron = kit.material("#d2a167");
    kit.box(chest, [0, .157, .17*width], [.345, .327, .070], apron, true);
    for (const side of [-1, 1]) kit.box(chest, [side*.09, .345, .166*width], [.048,.134,.053], apron, true);
    kit.box(chest, [0, .086, .212*width], [.224,.126,.047], kit.material("#ae724d"), true);
    kit.box(chest, [0, .142, .238*width], [.209,.021,.025], kit.material("#edc990"), true);
  } else if (look === 5) {
    const pack = kit.material("#bb7443");
    kit.box(chest, [0,.182,-.213], [.35,.359,.223], pack, true);
    kit.box(chest, [0,.160,-.34], [.271,.145,.078], kit.material("#d49156"), true);
    kit.box(chest, [0,.213,-.383], [.232,.023,.029], kit.material("#704e43"), true);
    for (const side of [-1, 1]) {
      kit.box(chest, [side*.167,.227,.14*width], [.065,.349,.077], edge, true);
      kit.box(chest, [side*.168,.23,.184*width], [.064,.043,.026], kit.material("#e8c18a"), true);
    }
  } else {
    kit.box(chest, [0,.185,.177*width], [.027,.316,.030], edge, true);
    for (const y of [.082,.172,.264]) kit.sphere(chest, [.039,y,.201*width], [.028,.029,.019], facing);
    kit.box(chest, [.122,.227,.177*width], [.118,.087,.044], edge, true);
    kit.box(chest, [.122,.269,.20*width], [.107,.024,.030], facing, true);
  }
  return { edge, facing };
}
