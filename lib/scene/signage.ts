import * as THREE from "three";
import { citySigns } from "../city-signs";
import type { ModelKit } from "./model-kit";
import type { SceneLink } from "./sites";

const billboardWidth = 1040;
const billboardHeight = 400;
const logoHeight = 264;

function billboardArtwork(image: HTMLImageElement, paper: string) {
  const canvas = document.createElement("canvas");
  canvas.width = billboardWidth;
  canvas.height = billboardHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min((billboardWidth - 40) / image.width, (logoHeight - 8) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (canvas.width - width) / 2, (logoHeight - height) / 2, width, height);

  ctx.fillStyle = "#385049";
  ctx.fillRect(0, logoHeight, canvas.width, billboardHeight - logoHeight);
  ctx.fillStyle = "#d6b882";
  ctx.fillRect(0, logoHeight, canvas.width, 8);
  ctx.fillStyle = "#f7e6bc";
  ctx.font = "bold 83px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("click me", canvas.width / 2, (logoHeight + billboardHeight) / 2 + 2);
  return canvas;
}

export function addCitySigns(kit: ModelKit, scene: THREE.Scene, invalidate: () => void) {
  const links: SceneLink[] = [];
  const frame = kit.material("#404743");
  const bronze = kit.material("#746047");
  const edge = kit.material("#c0a171");
  const footing = kit.material("#a59d8d", "stone");
  const panel = kit.geometry(new THREE.PlaneGeometry(1, 1));
  const loader = new THREE.ImageLoader();
  let disposed = false;

  const prints = citySigns.map(({ kind, href, image, paper, placements }) => {
    const billboard = kind === "billboard";
    const print = new THREE.MeshBasicMaterial({ toneMapped: false });

    loader.load(image, (artwork) => {
      if (disposed) return;
      const printImage = billboard ? billboardArtwork(artwork, paper) : artwork;
      const ratio = printImage.width / printImage.height;
      const texture = new THREE.Texture(printImage);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      print.map = texture;

      for (const { position, angle, width, baseY = .06 } of placements) {
        const height = width / ratio;
        const trim = billboard ? .12 : .055;
        const depth = billboard ? .27 : .18;
        const sign = kit.group(scene, position, angle);
        kit.box(sign, [0, 0, 0], [width + trim * 2, height + trim * 2, depth], frame);
        if (!billboard) {
          for (const x of [-width * .34, width * .34]) {
            kit.box(sign, [x, -height / 2 - .026, -.105], [.112, .19, .23], bronze, true);
            kit.box(sign, [x, -height / 2 - .105, -.004], [.15, .035, .31], edge, true);
          }
          for (const y of [-height / 2 - .025, height / 2 + .025]) {
            kit.box(sign, [0, y, depth * .5], [width + .068, .035, .022], edge);
          }
        }
        if (billboard) {
          for (const x of [-width * .44, width * .44]) {
            kit.box(sign, [x, height / 2 + trim * .49, depth / 2 + .02], [.12, .05, .062], edge, true);
            kit.box(sign, [x, -height / 2 - trim * .49, depth / 2 + .02], [.12, .05, .062], edge, true);
          }
        }

        for (const side of billboard ? [1, -1] : [1]) {
          const surface = new THREE.Mesh(panel, print);
          surface.position.z = side * (depth / 2 + .003);
          surface.rotation.y = side === 1 ? 0 : Math.PI;
          surface.scale.set(width, height, 1);
          sign.add(surface);
          links.push({ href, surface });
        }

        if (!billboard) continue;
        const groundY = baseY - position[1];
        const postTop = -height * .2;
        for (const x of [-width * .29, width * .29]) {
          kit.box(sign, [x, groundY + .11, 0], [.58, .22, .58], footing, true);
          kit.box(sign, [x, (groundY + postTop) / 2, 0], [.19, postTop - groundY, .23], frame);
        }
      }
      invalidate();
    });

    return print;
  });

  return {
    links,
    dispose() {
      disposed = true;
      for (const print of prints) {
        print.map?.dispose();
        print.dispose();
      }
    },
  };
}
