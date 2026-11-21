import * as THREE from "three";
import { buildCity } from "./city";
import { buildDepot } from "./depot";
import { buildMissionInterior } from "./mission-interior";
import type { MissionRoom } from "./mission-interior";
import { ModelKit } from "./model-kit";
import { lightCity } from "./city-paint";
import { districtCamera } from "./districts";
import type { DistrictId } from "./districts";
import type { Landmark, MissionRoomReplay } from "./sites";
import { roomAtmosphere } from "./room-architecture";

export type { MissionRoomReplay } from "./sites";
export type SceneKind = "city" | "depot" | "mission";
export type WorldControls = {
  zoom: (factor: number) => void;
  reset: () => void;
  rotate: () => void;
  focusDistrict: (id: DistrictId, keepView?: boolean) => void;
  focusOliveStreet: () => void;
  setWorkload: (hours: number) => void;
  setAssignmentComplete: (complete: boolean) => void;
  setMissionReplay: (replay: MissionRoomReplay | null, preview?: HTMLCanvasElement | null) => void;
  refreshMarkers: () => void;
  select: (id: string | null, fromMarker?: boolean) => void;
  dispose: () => void;
};

export function mountWorld(
  host: HTMLElement,
  kind: SceneKind,
  initialDistrict: DistrictId,
  getMarkers: () => Map<string, HTMLButtonElement>,
  onSelect: (id: string, action?: "talk") => void,
  onContextState: (available: boolean) => void,
  missionRoom?: MissionRoom,
): WorldControls {
  const city = kind === "city";
  const depot = kind === "depot";
  const atmosphere = kind === "mission" ? roomAtmosphere(missionRoom?.kind ?? "office") : undefined;
  const canvasRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const canvas = canvasRenderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "world-canvas";
  canvasRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  canvasRenderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  canvasRenderer.toneMappingExposure = city ? 1.04 : atmosphere ? 1.03 : 1.07;
  canvasRenderer.shadowMap.enabled = true;
  canvasRenderer.shadowMap.autoUpdate = !city;
  canvasRenderer.shadowMap.type = THREE.PCFShadowMap;
  host.append(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#a4bd70");
  const ambient = new THREE.HemisphereLight(atmosphere?.sky ?? "#fff4de", atmosphere?.shade ?? "#90a28a", atmosphere ? 1.50 : 1.62);
  const sun = new THREE.DirectionalLight(atmosphere?.sky ?? "#ffe9c7", atmosphere ? 1.94 : 2.48);
  const bounce = new THREE.DirectionalLight("#c4e3ff", atmosphere ? .67 : .54);
  sun.position.set(-28, 42, 19);
  bounce.position.set(24, 16, -25);
  if (city) lightCity(scene, ambient, sun);
  const sunOffset = sun.position.clone();
  function setDistrictLight(district: DistrictId) {
    const northFacing = district === "delmar" || district === "forest-park";
    if (district === "riverfront") {
      sunOffset.set(-42, 36, -22);
      sun.color.set("#ffd2a5");
    } else {
      sunOffset.set(-37, 44, northFacing ? -36 : 29);
      sun.color.set(northFacing ? "#ffdeb3" : "#ffdcaa");
    }
    shadowsDirty = true;
  }
  sun.castShadow = true;
  const shadowSize = city ? 38 : 16;
  sun.shadow.camera.left = -shadowSize;
  sun.shadow.camera.right = shadowSize;
  sun.shadow.camera.top = shadowSize;
  sun.shadow.camera.bottom = -shadowSize;
  sun.shadow.camera.far = 115;
  sun.shadow.mapSize.setScalar(window.innerWidth < 670 ? 1024 : 2048);
  sun.shadow.normalBias = .026;
  sun.shadow.bias = -.00031;
  sun.shadow.radius = city ? 2.7 : 2.1;
  scene.add(ambient, sun, sun.target);
  if (!city) scene.add(bounce);

  const kit = new ModelKit(city);
  let dirty = true;
  let shadowsDirty = true;
  if (city) setDistrictLight(initialDistrict);
  let ready = false;
  let frameId = 0;
  let contextLost = false;
  function schedule() {
    if (ready && !frameId && !contextLost && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function invalidate(shadow = false) {
    dirty = true;
    shadowsDirty ||= shadow;
    schedule();
  }
  const artKey = city ? "oliveArt" : "depotArt";
  if (kind !== "mission") host.dataset[artKey] = "loading";
  const onArtState = (state: "ready" | "fallback") => {
    host.dataset[artKey] = state;
    invalidate(true);
  };
  const environment = city ? buildCity(kit, scene, onArtState, () => invalidate(true))
    : depot ? buildDepot(kit, scene, onArtState)
      : buildMissionInterior(kit, scene, missionRoom ?? { kind: "office", room: "Assignment room" });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, city ? 10 : .05, city ? 166 : 240);
  const ray = new THREE.Raycaster();
  const worldHit = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const occluderBounds = new THREE.Box3();
  const occluderHit = new THREE.Vector3();
  let portrait = host.clientWidth / Math.max(1, host.clientHeight) < .72;
  const startDistrict = districtCamera(initialDistrict, portrait);
  let district = initialDistrict;
  const target = new THREE.Vector3(city ? startDistrict.x : 0, city ? startDistrict.y : kind === "mission" ? .72 : .43, city ? startDistrict.z : .25);
  const cameraTarget = target.clone();
  const pointerPosition = new THREE.Vector2();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let widthMinimum = city ? startDistrict.width : kind === "mission" ? 19.5 : 21.5;
  const heightMinimum = city ? 35.5 : kind === "mission" ? 16.85 : 16.2;
  let pitch = city ? startDistrict.pitch : .695;
  let desiredPitch = pitch;
  const radius = 78;
  let desiredAngle = city ? startDistrict.angle : .78;
  let angle = desiredAngle;
  let desiredZoom = city ? startDistrict.zoom : 1;
  let zoom = desiredZoom;
  let framing: "district" | "olive" | "free" = "district";
  let width = 1;
  let height = 1;
  let verticalSpan = heightMinimum;
  let selected: string | null = null;
  let missionReplay: MissionRoomReplay | null = null;
  let replayPreview: HTMLCanvasElement | null = null;
  let replayPreviewUntil = 0;
  let lastReplayPreview = 0;
  let capturedSettledReplay = false;
  let lastFrame = 0;
  let startTime: number | null = null;
  let lastActorTick = 0;
  const shadowCenter = new THREE.Vector2(Infinity, Infinity);
  let scale = 1;
  let frameCost = 0;
  let slowFrames = 0;
  let quickFrames = 0;
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  let pointer: { id: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null = null;
  const touches = new Map<number, THREE.Vector2>();
  const markerOrigins = new Map<string, { x: number; y: number; visible: boolean }>();
  let clickedLandmark: string | undefined;

  const outlineGeometry = new THREE.RingGeometry(.95, 1, 64).rotateX(-Math.PI / 2);
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: "#ffdf83", transparent: true, opacity: .78, depthWrite: false });
  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outline.visible = false;
  outline.renderOrder = 2;
  scene.add(outline);

  function fitCamera() {
    const ratio = width / height;
    verticalSpan = Math.max(heightMinimum, widthMinimum / ratio);
    const halfHeight = verticalSpan / 2;
    camera.left = -halfHeight * ratio;
    camera.right = halfHeight * ratio;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    invalidate();
  }

  function sizeBuffer() {
    const density = Math.min(window.devicePixelRatio || 1, coarsePointer.matches ? 1.35 : 1.65);
    const ratio = Math.min(density, Math.sqrt(2600000 / (width * height))) * scale;
    canvasRenderer.setDrawingBufferSize(width, height, ratio);
  }

  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    sizeBuffer();
    const nextPortrait = width / height < .72;
    if (portrait !== nextPortrait) {
      portrait = nextPortrait;
      if (city && framing === "district") frameDistrict();
      if (city && framing === "olive") frameOliveStreet();
    }
    if (kind === "mission") widthMinimum = portrait ? 17.35 : 19.5;
    fitCamera();
    if (kind === "mission" && (selected || framing === "district")) frameMissionStation();
  }

  function frameMissionStation() {
    if (kind !== "mission") return;
    const open = host.parentElement?.dataset.stationOpen === "true";
    const point = open ? environment.landmarks.find(({ id }) => id === selected) : undefined;
    if (!point) {
      const station = environment.landmarks.find(({ id }) => id === "work");
      const focalX = portrait && station ? station.anchor.x * .37 : 0;
      const focalZ = portrait && station ? station.anchor.z * .28 : 0;
      target.set(focalX, portrait ? -.38 : .84, .28 + focalZ);
      desiredZoom = 1;
    } else {
      const mobile = width <= 800;
      const panelWidth = mobile ? width : Math.min(width * .7, 1200);
      const units = verticalSpan / height;
      desiredZoom = mobile ? 1.55 : 1.35;
      const horizontal = mobile ? 0 : (panelWidth / 2 + 6) * units / desiredZoom;
      const vertical = mobile ? Math.max(56, height * .36) * units / desiredZoom : 0;
      target.copy(point.anchor);
      target.x += Math.cos(angle) * horizontal + Math.sin(angle) * Math.sin(pitch) * vertical;
      target.y -= Math.cos(pitch) * vertical;
      target.z += -Math.sin(angle) * horizontal + Math.cos(angle) * Math.sin(pitch) * vertical;
    }
    invalidate();
  }

  function frameDistrict() {
    const view = districtCamera(district, portrait);
    framing = "district";
    target.set(view.x, view.y, view.z);
    widthMinimum = view.width;
    desiredAngle = view.angle + Math.round((angle - view.angle) / (Math.PI * 2)) * Math.PI * 2;
    desiredZoom = view.zoom;
    desiredPitch = view.pitch;
    fitCamera();
  }

  function frameOliveStreet() {
    framing = "olive";
    const view = districtCamera("downtown", portrait);
    target.set(portrait ? 42 : 43.6, portrait ? 2.1 : 2.65, portrait ? 1.3 : 2.6);
    desiredAngle = view.angle + Math.round((angle - view.angle) / (Math.PI * 2)) * Math.PI * 2;
    desiredZoom = portrait ? 1.12 : 1.37;
    desiredPitch = portrait ? .46 : .38;
    widthMinimum = portrait ? 30 : 36;
    fitCamera();
  }

  function pointCamera() {
    camera.position.set(
      cameraTarget.x + Math.sin(angle) * Math.cos(pitch) * radius,
      cameraTarget.y + Math.sin(pitch) * radius,
      cameraTarget.z + Math.cos(angle) * Math.cos(pitch) * radius,
    );
    camera.lookAt(cameraTarget);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function captureReplay(cameraChanged: boolean, now: number) {
    if (!missionReplay || !replayPreview?.isConnected || !canvas.width || !canvas.height) return;
    const settled = reducedMotion.matches || now >= replayPreviewUntil - 530;
    const finalCapture = settled && !capturedSettledReplay;
    if (!cameraChanged && replayPreview.dataset.live === "true" &&
      !finalCapture && (now > replayPreviewUntil || now - lastReplayPreview < 43)) return;
    const station = environment.landmarks.find(({ id }) => id === "work");
    const context = replayPreview.getContext("2d");
    if (!station || !context || !replayPreview.width || !replayPreview.height) return;
    projected.copy(station.anchor);
    projected.y -= .36;
    projected.project(camera);
    const ratio = replayPreview.width / replayPreview.height;
    const pixelRatio = canvasRenderer.getPixelRatio();
    const previewRatio = Math.min(2.15, Math.sqrt(1800000 / (width * height)));
    const sharpen = finalCapture && width <= 800 && previewRatio > pixelRatio;
    const updateShadows = canvasRenderer.shadowMap.autoUpdate;
    if (sharpen) {
      // The settled picture can be sharper than the moving view without raising ongoing phone GPU work.
      canvasRenderer.shadowMap.autoUpdate = false;
      canvasRenderer.setDrawingBufferSize(width, height, previewRatio);
      canvasRenderer.render(scene, camera);
    }
    try {
      const cropWidth = Math.min(canvas.width, canvas.height * ratio, canvas.height / verticalSpan * zoom * 5.35);
      const cropHeight = cropWidth / ratio;
      const x = THREE.MathUtils.clamp((projected.x + 1) * canvas.width * .5 - cropWidth / 2, 0, canvas.width - cropWidth);
      const y = THREE.MathUtils.clamp((1 - projected.y) * canvas.height * .5 - cropHeight * .51, 0, canvas.height - cropHeight);
      context.drawImage(canvas, x, y, cropWidth, cropHeight, 0, 0, replayPreview.width, replayPreview.height);
    } finally {
      if (sharpen) {
        canvasRenderer.setDrawingBufferSize(width, height, pixelRatio);
        canvasRenderer.render(scene, camera);
        canvasRenderer.shadowMap.autoUpdate = updateShadows;
      }
    }
    replayPreview.dataset.live = "true";
    lastReplayPreview = now;
    if (finalCapture) {
      capturedSettledReplay = true;
      replayPreviewUntil = now;
    }
  }

  function markerArea(origin: DOMRect) {
    const shell = host.closest(".game-world")?.parentElement;
    const hud = ".world-hud .wordmark, .world-hud .main-nav, .district-switcher, .quest-hud, .camera-hud, .inspection-panel";
    const openStation = kind === "mission" && host.parentElement?.dataset.stationOpen === "true";
    return [...(shell?.querySelectorAll(openStation ? hud : hud + ", .city-status-hud button, .building-work-dock") ?? [])]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left - origin.left, top: rect.top - origin.top,
          right: rect.right - origin.left, bottom: rect.bottom - origin.top };
      }).filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
  }

  function visibleAnchor({ anchor, streetAnchor, entranceFacing }: Landmark) {
    const facingStreet = !entranceFacing || Math.cos(angle) * entranceFacing > .13;
    return facingStreet && zoom >= .83 && streetAnchor ? streetAnchor : anchor;
  }

  function positionMarkers() {
    const elements = getMarkers();
    const compact = city && (width <= 700 || (height <= 500 && coarsePointer.matches));
    const origin = host.getBoundingClientRect();
    const obstructions = markerArea(origin);
    const candidates = [];
    for (const site of environment.landmarks) {
      const { id, anchor, bounds, streetAnchor } = site;
      const marker = elements.get(id);
      if (!marker) continue;
      const activeAnchor = visibleAnchor(site);
      projected.copy(activeAnchor).project(camera);
      const y = (1 - projected.y) * .5 * height;
      if (activeAnchor === anchor && compact && y < Math.min(122, height * .29) && bounds.max.y - bounds.min.y > 7) {
        projected.copy(anchor).setY(bounds.min.y + 4.5).project(camera);
      }
      const x = (projected.x + 1) * .5 * width;
      const labelY = (1 - projected.y) * .5 * height;
      markerOrigins.set(id, { x, y: labelY, visible: false });
      marker.style.setProperty("--marker-x", `${x}px`);
      marker.style.setProperty("--marker-y", `${labelY}px`);
      if (x < 12 || x > width - 12 || labelY < 12 || labelY > height + 35) {
        marker.hidden = true;
        continue;
      }
      const local = Math.hypot(activeAnchor.x - cameraTarget.x, activeAnchor.z - cameraTarget.z);
      const comfortablyInFrame = x > 70 && x < width - 70;
      const nearby = marker.dataset.nearby === "true";
      const label = id === selected || (nearby && (activeAnchor === streetAnchor ? comfortablyInFrame || !compact
        : !compact || (comfortablyInFrame && local < 16)));
      if (city && marker.dataset.label !== String(label)) marker.dataset.label = String(label);
      if (marker.hidden) marker.hidden = false;
      candidates.push({ id, marker, x, y: labelY, priority: id === selected ? -100
        : local - (marker.dataset.assignment === "true" ? 10 : activeAnchor === streetAnchor ? 8 : 0) });
    }
    for (const { id, anchor } of environment.conversations ?? []) {
      const marker = elements.get(`talk:${id}`);
      if (!marker) continue;
      marker.hidden = true;
      if (zoom < .86) continue;
      projected.copy(anchor).project(camera);
      const x = (projected.x + 1) * .5 * width;
      const y = (1 - projected.y) * .5 * height;
      if (x < 34 || x > width - 34 || y < 60 || y > height) continue;
      pointerPosition.set(projected.x, projected.y);
      ray.setFromCamera(pointerPosition, camera);
      // Test the space just above the character so the marker respects facades and trees.
      if (occluded(ray.ray.origin.distanceTo(anchor))) continue;
      marker.style.setProperty("--marker-x", `${x}px`);
      marker.style.setProperty("--marker-y", `${y}px`);
      marker.hidden = false;
      candidates.push({ id: `talk:${id}`, marker, x, y, priority: -32 });
    }
    const shown = [...obstructions];
    const bounds = candidates.map((candidate) => ({
      ...candidate, w: candidate.marker.offsetWidth, h: candidate.marker.offsetHeight,
    }));
    for (const candidate of bounds.sort((a, b) => a.priority - b.priority)) {
      const { id, marker, x, y, w, h } = candidate;
      const offsets = compact && id === "olive-library" ? [0, -47, -66]
        : city && (id === selected || id === "park-pacific" || (compact && (id === "gateway-arch" || y < 135))) ? [0, 46, 72] : [0];
      const rect = offsets.map((offset) => ({
        y: y + offset, left: x - w / 2, right: x + w / 2, top: y + offset - 1.18 * h, bottom: y + offset - .18 * h + 5,
      })).find(({ left, right, top, bottom }) => left >= 4 && right <= width - 4 && top >= 4 && bottom <= height - 4 &&
        !shown.some((other) => right + 4 > other.left && left - 4 < other.right &&
          bottom + 3 > other.top && top - 3 < other.bottom));
      marker.hidden = !rect;
      if (rect) {
        if (rect.y !== y) marker.style.setProperty("--marker-y", `${rect.y}px`);
        shown.push(rect);
        markerOrigins.set(id, { x, y: rect.y, visible: true });
      }
    }
  }

  function frame(now: number) {
    frameId = 0;
    if (startTime === null) startTime = now;
    const sinceFrame = now - lastFrame;
    const delta = lastFrame ? Math.min(sinceFrame / 1000, .06) : 1 / 60;
    lastFrame = now;
    const elapsed = (now - startTime) / 1000;
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 15);
    const moving = Math.abs(zoom - desiredZoom) > .0003 || Math.abs(angle - desiredAngle) > .0003
      || Math.abs(pitch - desiredPitch) > .0003 || cameraTarget.distanceToSquared(target) > .00002;
    if (moving) {
      cameraTarget.lerp(target, ease);
      zoom = THREE.MathUtils.lerp(zoom, desiredZoom, ease);
      angle = THREE.MathUtils.lerp(angle, desiredAngle, ease);
      pitch = THREE.MathUtils.lerp(pitch, desiredPitch, ease);
    }
    const animate = !reducedMotion.matches && now - lastActorTick >= (!city && coarsePointer.matches ? 44 : 31);
    if (moving) environment.cameraNear?.(cameraTarget.x, cameraTarget.z);
    if (animate) {
      environment.update(elapsed);
      lastActorTick = now;
    }
    if (dirty || moving || animate) {
      if (city && (shadowsDirty || (shadowCenter.x - cameraTarget.x) ** 2 + (shadowCenter.y - cameraTarget.z) ** 2 > 49)) {
        shadowCenter.set(Math.round(cameraTarget.x), Math.round(cameraTarget.z));
        sun.target.position.set(shadowCenter.x, 0, shadowCenter.y);
        sun.position.copy(sun.target.position).add(sunOffset);
        canvasRenderer.shadowMap.needsUpdate = true;
        shadowsDirty = false;
      }
      const cameraChanged = dirty || moving;
      if (cameraChanged) {
        pointCamera();
        positionMarkers();
      }
      dirty = false;
      canvasRenderer.render(scene, camera);
      captureReplay(cameraChanged, now);
    }
    if (city && moving && sinceFrame < 95 && !reducedMotion.matches) adaptResolution(sinceFrame);
    if (moving || !reducedMotion.matches || dirty) schedule();
  }

  function adaptResolution(milliseconds: number) {
    frameCost = frameCost ? frameCost * .88 + milliseconds * .12 : milliseconds;
    slowFrames = frameCost > 24 ? slowFrames + 1 : 0;
    quickFrames = frameCost < 19 ? quickFrames + 1 : 0;
    const next = slowFrames >= 16 ? Math.max(.64, scale - .12)
      : quickFrames >= 55 ? Math.min(1, scale + .08) : scale;
    if (next !== scale) {
      scale = next;
      slowFrames = quickFrames = 0;
      sizeBuffer();
      invalidate();
    }
  }

  function hitTest(x: number, y: number): { href: string } | { id: string; action?: "talk" } | undefined {
    const bounds = canvas.getBoundingClientRect();
    pointerPosition.set((x - bounds.left) / bounds.width * 2 - 1, 1 - (y - bounds.top) / bounds.height * 2);
    ray.setFromCamera(pointerPosition, camera);
    const href = hitLink();
    if (href) return { href };
    for (const conversation of environment.conversations ?? []) {
      const hit = ray.ray.intersectBox(conversation.bounds, worldHit);
      if (hit && !occluded(hit.distanceTo(ray.ray.origin))) return { id: conversation.id, action: "talk" };
    }
    let match: string | undefined;
    let distance = Infinity;
    for (const site of environment.landmarks) {
      if (!ray.ray.intersectBox(site.bounds, worldHit)) continue;
      const hit = site.surface ? ray.intersectObject(site.surface, false)[0] : null;
      if (site.surface && !hit) continue;
      const to = (hit?.point ?? worldHit).distanceToSquared(ray.ray.origin);
      if (to < distance) {
        match = site.id;
        distance = to;
      }
    }
    if (match) return { id: match };
  }

  function hitLink() {
    let href: string | undefined;
    let distance = Infinity;
    for (const link of environment.links ?? []) {
      const hit = ray.intersectObject(link.surface, false)[0];
      if (hit && hit.distance < distance) {
        href = link.href;
        distance = hit.distance;
      }
    }
    if (!href) return;

    if (!occluded(distance)) return href;
  }

  function occluded(distance: number) {
    ray.far = distance - .001;
    let blocked = false;
    scene.traverseVisible((object) => {
      if (blocked || !(object instanceof THREE.Mesh)) return;
      const material = object.material;
      const opaque = (part: THREE.Material) => part.visible && part.depthWrite;
      if (Array.isArray(material) ? !material.some(opaque) : !opaque(material)) return;
      if (!(object instanceof THREE.SkinnedMesh)) {
        const geometry = object instanceof THREE.InstancedMesh ? object : object.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        occluderBounds.copy(geometry.boundingBox!).applyMatrix4(object.matrixWorld);
        if (!occluderBounds.containsPoint(ray.ray.origin)) {
          const entry = ray.ray.intersectBox(occluderBounds, occluderHit);
          if (!entry || entry.distanceToSquared(ray.ray.origin) > ray.far * ray.far) return;
        }
      }
      blocked = ray.intersectObject(object, false).length > 0;
    });
    ray.far = Infinity;
    return blocked;
  }

  function setZoom(factor: number) {
    framing = "free";
    desiredZoom = THREE.MathUtils.clamp(desiredZoom * factor, city ? .68 : .74, city ? 2.85 : 2.8);
    invalidate();
  }

  function onDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if (city && event.pointerType === "touch") {
      touches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
      canvas.setPointerCapture(event.pointerId);
      if (pointer) {
        pointer.moved = true;
        return;
      }
    } else if (pointer) return;
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }

  function onMove(event: PointerEvent) {
    const touch = touches.get(event.pointerId);
    if (touch && touches.size > 1) {
      const other = [...touches].find(([id]) => id !== event.pointerId)![1];
      const previous = touch.distanceTo(other);
      touch.set(event.clientX, event.clientY);
      if (previous > 5) setZoom(THREE.MathUtils.clamp(touch.distanceTo(other) / previous, .81, 1.23));
      return;
    }
    touch?.set(event.clientX, event.clientY);
    if (!pointer) {
      if (event.pointerType === "mouse") canvas.style.cursor = hitTest(event.clientX, event.clientY) ? "pointer" : "grab";
      return;
    }
    if (pointer.id !== event.pointerId) return;
    if (!pointer.moved && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 4) return;
    pointer.moved = true;
    framing = "free";
    canvas.style.cursor = "grabbing";
    const units = verticalSpan / (zoom * height);
    const dx = (event.clientX - pointer.x) * units;
    const dz = (event.clientY - pointer.y) * units / Math.sin(pitch);
    target.x = THREE.MathUtils.clamp(target.x - dx * Math.cos(angle) - dz * Math.sin(angle), city ? -202 : -12, city ? 153 : 12);
    target.z = THREE.MathUtils.clamp(target.z + dx * Math.sin(angle) - dz * Math.cos(angle), city ? -130 : -12, city ? 106 : 12);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    schedule();
  }

  function onUp(event: PointerEvent) {
    if (touches.delete(event.pointerId) && pointer?.moved) {
      const next = touches.entries().next().value;
      pointer = next ? { id: next[0], startX: next[1].x, startY: next[1].y, x: next[1].x, y: next[1].y, moved: true } : null;
      if (!pointer) canvas.style.cursor = "grab";
      return;
    }
    if (pointer?.id !== event.pointerId) return;
    if (!pointer.moved && event.type === "pointerup") {
      const hit = hitTest(event.clientX, event.clientY);
      if (hit) {
        if ("href" in hit) window.open(hit.href, "_blank", "noopener,noreferrer");
        else {
          if (!hit.action) clickedLandmark = hit.id;
          onSelect(hit.id, hit.action);
        }
      }
    }
    pointer = null;
    canvas.style.cursor = "grab";
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault();
    setZoom(Math.exp(-THREE.MathUtils.clamp(event.deltaY, -90, 90) * .0021));
  }

  function onLost(event: Event) {
    event.preventDefault();
    cancelAnimationFrame(frameId);
    frameId = 0;
    contextLost = true;
    if (replayPreview) delete replayPreview.dataset.live;
    onContextState(false);
  }

  function onRestored() {
    if (!contextLost) return;
    contextLost = false;
    onContextState(true);
    invalidate(true);
  }

  function onVisibility() {
    if (reducedMotion.matches && missionReplay) environment.setMissionReplay?.(missionReplay, true);
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrame = 0;
    } else invalidate();
  }

  const observer = new ResizeObserver(resize);
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onVisibility);
  observer.observe(host);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("lostpointercapture", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  resize();
  pitch = desiredPitch;
  if (kind === "mission" && !reducedMotion.matches) {
    // Approach from the side door before settling on the work area.
    cameraTarget.copy(target).add(new THREE.Vector3(-2.8, -.26, 1.92));
    angle -= .15;
    zoom = 1.28;
  }
  environment.focusDistrict?.(initialDistrict);
  environment.cameraNear?.(target.x, target.z);
  environment.update(0);
  ready = true;
  schedule();

  return {
    zoom: setZoom,
    reset() {
      if (city) frameDistrict();
      else {
        desiredAngle = .78 + Math.round((angle - .78) / (Math.PI * 2)) * Math.PI * 2;
        if (kind === "mission") frameMissionStation();
        else {
          target.set(0, .43, .25);
          desiredZoom = 1;
        }
      }
      invalidate();
    },
    rotate() {
      framing = "free";
      desiredAngle += Math.PI / 2;
      invalidate();
    },
    focusDistrict(id, keepView = false) {
      if (!city) return;
      if (district !== id) setDistrictLight(id);
      district = id;
      environment.focusDistrict?.(id);
      if (keepView) {
        framing = "free";
      }
      else frameDistrict();
      invalidate();
    },
    focusOliveStreet() {
      if (!city) return;
      frameOliveStreet();
    },
    setWorkload(hours) {
      environment.setWorkload?.(hours);
      invalidate();
    },
    setAssignmentComplete(complete) {
      environment.setAssignmentComplete?.(complete);
      invalidate();
    },
    setMissionReplay(replay, preview = null) {
      if (!environment.setMissionReplay) return;
      if (replayPreview && (replayPreview !== preview || !replay)) delete replayPreview.dataset.live;
      if (replayPreview !== preview) capturedSettledReplay = false;
      replayPreview = preview;
      if (missionReplay?.kind !== replay?.kind || missionReplay?.token !== replay?.token) {
        missionReplay = replay;
        replayPreviewUntil = performance.now() + 1550;
        lastReplayPreview = 0;
        capturedSettledReplay = false;
        environment.setMissionReplay(replay, reducedMotion.matches);
      }
      invalidate();
    },
    refreshMarkers() {
      if (kind === "mission" && (selected || framing === "district")) frameMissionStation();
      invalidate();
    },
    select(id, fromMarker = false) {
      const clickedScene = fromMarker || clickedLandmark === id;
      clickedLandmark = undefined;
      if (selected === id) return;
      selected = id;
      const site = environment.landmarks.find((landmark) => landmark.id === id);
      outline.visible = Boolean(site && !site.surface);
      if (kind === "mission") frameMissionStation();
      if (site) {
        outline.position.set(site.anchor.x, city ? .074 : .345, site.anchor.z);
        outline.scale.set((site.bounds.max.x - site.bounds.min.x) * .64, 1, (site.bounds.max.z - site.bounds.min.z) * .74);
        if (city && !clickedScene) {
          const focus = visibleAnchor(site);
          projected.copy(focus).project(camera);
          const marker = markerOrigins.get(site.id);
          const x = marker?.x ?? (projected.x + 1) * .5 * width;
          const y = marker?.y ?? (1 - projected.y) * .5 * height;
          const inspector = width <= 700 ? null : host.closest(".game-world")?.querySelector(".inspection-panel");
          const inspectorStart = inspector ? inspector.getBoundingClientRect().left - host.getBoundingClientRect().left : width;
          if (!marker?.visible || x > inspectorStart - 45 || y > height - 65) {
            framing = "free";
            const inspectorShift = inspector ? (width - inspectorStart) * verticalSpan / height / desiredZoom / 2 : 0;
            target.set(focus.x + Math.cos(angle) * inspectorShift, Math.max(.6, focus.y - 1.25),
              focus.z - Math.sin(angle) * inspectorShift);
            fitCamera();
          }
        }
      }
      invalidate();
    },
    dispose() {
      ready = false;
      if (replayPreview) delete replayPreview.dataset.live;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("lostpointercapture", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      environment.dispose?.();
      kit.dispose();
      sun.shadow.dispose();
      outlineGeometry.dispose();
      outlineMaterial.dispose();
      canvasRenderer.dispose();
      canvasRenderer.forceContextLoss();
      canvas.remove();
    },
  };
}
