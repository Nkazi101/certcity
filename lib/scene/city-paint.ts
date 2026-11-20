import * as THREE from "three";

export type Surface = "grass" | "road" | "pavers" | "brick" | "shingles" | "stone";

const pigment = {
  grass: "#91a888",
  road: "#59657a",
  pavers: "#e5ccb0",
  brick: "#c38c76",
  shingles: "#85869a",
  stone: "#ecdbc9",
  leaves: "#b6a898",
} satisfies Record<Surface | "leaves", string>;

export function cityColor(color: string, surface?: Surface | "leaves") {
  const result = new THREE.Color(color);
  if (surface) result.lerp(new THREE.Color(pigment[surface]), surface === "road" ? .55 : .19);
  return result;
}

export function paintedSurface(kind: Surface, random: () => number) {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = canvas.height = size;
  const paint = canvas.getContext("2d")!;
  paint.fillStyle = {
    grass: "#f4f0d6", road: "#d2d2df", pavers: "#d6c5b1",
    brick: "#b29489", shingles: "#a49b97", stone: "#e9ddcc",
  }[kind];
  paint.fillRect(0, 0, size, size);

  if (kind === "brick" || kind === "shingles" || kind === "pavers") {
    const [w, h, hue] = kind === "brick" ? [32, 16, 14] : kind === "shingles" ? [32, 16, 28] : [64, 64, 36];
    for (let y = 0; y < size; y += h) {
      for (let x = 0; x < size; x += w) {
        const left = x - (y / h % 2) * w / 2;
        const light = 76 + random() * 17;
        const stroke = paint.createLinearGradient(0, y, 0, y + h);
        stroke.addColorStop(0, `hsl(${hue} 28% ${light + 4}%)`);
        stroke.addColorStop(.3, `hsl(${hue} 24% ${light}%)`);
        stroke.addColorStop(1, `hsl(${hue} 20% ${light - 5}%)`);
        paint.fillStyle = stroke;
        paint.fillRect(left + 1, y + 1, w - 1.5, h - 1.5);
        if (left < 0) paint.fillRect(left + size + 1, y + 1, w - 1.5, h - 1.5);
      }
    }
  }

  // Layer translucent pigment in irregular dabs. Wrapping the strokes keeps repeats seamless.
  for (let i = 0; i < 255; i++) {
    const x = random() * size;
    const y = random() * size;
    const w = (kind === "grass" ? 10 : 18) + random() * 30;
    const h = 2 + random() * (kind === "grass" ? 9 : 6);
    const angle = -.26 + random() * .09;
    paint.fillStyle = random() > .42 ? "#fff9df0e" : "#5148680c";
    const xOffsets = [0], yOffsets = [0];
    if (x < w) xOffsets.push(size);
    if (x > size - w) xOffsets.push(-size);
    if (y < h + w * .3) yOffsets.push(size);
    if (y > size - h - w * .3) yOffsets.push(-size);
    for (const dx of xOffsets) {
      for (const dy of yOffsets) {
        paint.beginPath();
        paint.ellipse(x + dx, y + dy, w, h, angle, 0, Math.PI * 2);
        paint.fill();
      }
    }
  }
  for (let i = 0; i < 2900; i++) {
    const x = random() * size, y = random() * size;
    paint.fillStyle = i % 2 === 0 ? "#fff9eb35" : "#4d425326";
    paint.fillRect(x, y, 1 + random() * 2.6, 1 + random() * 1.3);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.name = kind;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}

export function lightCity(scene: THREE.Scene, hemisphere: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
  scene.background = new THREE.Color("#b6a6b7");
  scene.fog = new THREE.Fog("#b4a0a9", 88, 155);
  hemisphere.color.set("#c3d1ff");
  hemisphere.groundColor.set("#88738d");
  hemisphere.intensity = 1.57;
  sun.color.set("#ffdcaa");
  sun.intensity = 3.1;
  sun.position.set(-37, 44, 29);
  sun.shadow.intensity = .9;
}
