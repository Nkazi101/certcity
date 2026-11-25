import * as THREE from "three";
import { makePerson } from "./actors";
import type { ModelKit } from "./model-kit";

/**
 * What a room shows about the learner's work: a line of people waiting at a desk, people walking out with a ✓ or going
 * to a callback bench with a "!", and an amber lamp over the bench while anyone is owed a call.
 */
export type RoomReaction = {
  /** People waiting in line; the first one stands at the desk. */
  waiting: number;
  /** People waiting at the callback bench with a "!". */
  callbacks: number;
  /** A new token resolves the person at the desk: ✓ and out, or "!" and to the bench. */
  event: { token: number; correct: boolean } | null;
  /** One person whose case is still open (e.g. Nia's T-17 customer). "resolved" sends them out with a ✓. */
  held?: "waiting" | "resolved" | null;
  /** A panel is driving this room right now: phones frame the camera on the desk and bench. */
  frame?: boolean;
};

/** A result badge over a station (or the person working it). null clears it. */
export type StationOutcome = "passed" | "failed" | null;

type Point = readonly [x: number, z: number];

export type ReactionLayout = {
  /** Floor height in scene space. */
  floor: number;
  /** Line positions; slot 0 is at the desk. People face the slot ahead of them. */
  slots: readonly Point[];
  /** Which way the person at the desk faces (radians, 0 = +z). */
  deskFacing: number;
  /** Where new arrivals appear and the waypoints they walk before stepping into their slot. */
  entrance: Point;
  arrival: readonly Point[];
  /** From the desk to outside the room (the last point is off-room). */
  exit: readonly Point[];
  /** From the desk to the bench area, before the person's bench spot. */
  toBench: readonly Point[];
  /** From the bench to outside the room, for a resolved held person. */
  benchExit: readonly Point[];
  benchSpots: readonly Point[];
  benchFacing: number;
  /** Floor point to centre on phones (defaults to the middle of the desk, the line and the bench). */
  focus?: Point;
  /** A bench to build (omit when the room already has one) and the post that carries the sign and lamp. */
  bench?: { x: number; z: number; rotation: number; width: number };
  post: { x: number; z: number; rotation: number; text: string };
};

type Person = {
  actor: ReturnType<typeof makePerson>;
  mode: "idle" | "queue" | "leaving" | "callback" | "held";
  path: THREE.Vector2[];
  facing: number;
  badge: THREE.Sprite;
};

const coats: [string, string, string][] = [
  ["#c7683f", "#b98063", "#3b2b22"], ["#4f7fa3", "#e0b48f", "#6b4a2f"], ["#8a5a9c", "#8d5a3f", "#1f1a17"],
  ["#d9a441", "#f0c9a6", "#8a5a2b"], ["#5f8f5b", "#c48b68", "#2d2420"], ["#b04a5a", "#e7bf9c", "#4a3326"],
  ["#3f6f73", "#a8714f", "#2a211c"], ["#c98f62", "#7c4f37", "#171311"],
];

let badgeMaterials: { passed: THREE.SpriteMaterial; failed: THREE.SpriteMaterial } | null = null;

function badgeTexture(symbol: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = color;
  context.beginPath();
  context.arc(64, 64, 54, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = "#fffaf0";
  context.stroke();
  context.fillStyle = "#fffaf0";
  context.font = "bold 74px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(symbol, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The ✓ and "!" badge materials, shared by every room. */
export function reactionBadges() {
  badgeMaterials ??= {
    passed: new THREE.SpriteMaterial({ map: badgeTexture("✓", "#2f8a4e"), depthTest: false }),
    failed: new THREE.SpriteMaterial({ map: badgeTexture("!", "#e07b16"), depthTest: false }),
  };
  return badgeMaterials;
}

const vector = ([x, z]: Point) => new THREE.Vector2(x, z);

/** ✓ / "!" badges over stations: on the head of the person working one, or at a fixed point above it. */
export function createStationBadges(scene: THREE.Scene) {
  const badges = reactionBadges();
  const entries = new Map<string, { sprite: THREE.Sprite; base: number }>();
  return {
    add(id: string, anchor: THREE.Object3D | THREE.Vector3) {
      const sprite = new THREE.Sprite(badges.passed);
      sprite.scale.setScalar(.62);
      sprite.renderOrder = 10;
      sprite.visible = false;
      if (anchor instanceof THREE.Vector3) {
        sprite.position.copy(anchor);
        scene.add(sprite);
        entries.set(id, { sprite, base: anchor.y });
      } else {
        sprite.position.set(0, 2.05, 0);
        anchor.add(sprite);
        entries.set(id, { sprite, base: 2.05 });
      }
    },
    /** Returns false for a station this room doesn't have. */
    set(id: string, outcome: StationOutcome) {
      const entry = entries.get(id);
      if (!entry) return false;
      entry.sprite.visible = !!outcome;
      if (outcome) entry.sprite.material = outcome === "passed" ? badges.passed : badges.failed;
      return true;
    },
    update(time: number) {
      for (const [index, { sprite, base }] of [...entries.values()].entries()) {
        if (sprite.visible) sprite.position.y = base + Math.sin(time * 3 + index) * .05;
      }
    },
    /** Whether any badge is showing (rooms that otherwise sit still need frames while one bobs). */
    active() {
      return [...entries.values()].some(({ sprite }) => sprite.visible);
    },
  };
}

/**
 * Builds the bench, sign post and lamp into `room` (call before the room is batched) and returns the controller.
 * Register stations with `addStation(id, personOrPoint)`: the badge rides on a person's head or sits at a fixed point.
 */
export function buildRoomReactions(kit: ModelKit, scene: THREE.Scene, room: THREE.Group, layout: ReactionLayout) {
  const frame = kit.material("#496c66");
  if (layout.bench) {
    const bench = kit.group(room, [layout.bench.x, 0, layout.bench.z], layout.bench.rotation);
    const half = layout.bench.width / 2;
    kit.box(bench, [0, .24, 0], [layout.bench.width, .08, .48], kit.material("#b48c63"), true);
    for (const x of [-half + .15, half - .15]) kit.box(bench, [x, .12, 0], [.1, .24, .42], frame, true);
  }
  const post = kit.group(room, [layout.post.x, 0, layout.post.z], layout.post.rotation);
  kit.box(post, [0, 1.05, 0], [.09, 2.1, .09], frame, true);
  kit.box(post, [0, 2.12, 0], [1.9, .5, .1], frame, true);
  kit.sign(post, layout.post.text, [0, 2.12, .056], 1.72, ["#496c66", "#f6e3af"]);

  // The lamp is dynamic: dark when nobody is owed a call, amber while someone waits on the bench.
  const lampOff = new THREE.MeshStandardMaterial({ color: "#6d6a5c", roughness: .6 });
  const lampOn = new THREE.MeshStandardMaterial({ color: "#ffb347", emissive: "#ff9a1f", emissiveIntensity: 1.6 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), lampOff);
  lamp.position.set(layout.post.x, layout.floor + 2.55, layout.post.z);
  const glow = new THREE.PointLight("#ffa43a", 0, 4.5, 2);
  glow.position.copy(lamp.position).add(new THREE.Vector3(Math.sin(layout.post.rotation) * .3, -.2, Math.cos(layout.post.rotation) * .3));
  scene.add(lamp, glow);

  const crowd = new THREE.Group();
  crowd.visible = false;
  scene.add(crowd);
  const badges = reactionBadges();
  const people: Person[] = [];
  let queue: Person[] = [];
  let owed: Person[] = [];
  let held: Person | null = null;
  let heldState: RoomReaction["held"] = null;
  let lastToken = -1;
  let lastTime = 0;

  const slot = (index: number) => vector(layout.slots[Math.min(index, layout.slots.length - 1)]);
  const benchSpot = (index: number) => vector(layout.benchSpots[index % layout.benchSpots.length]);
  const lineFacing = (index: number) => {
    if (index === 0) return layout.deskFacing;
    const here = slot(index);
    const ahead = slot(index - 1);
    return Math.atan2(ahead.x - here.x, ahead.y - here.y);
  };

  function person(): Person {
    const free = people.find(({ mode }) => mode === "idle");
    if (free) return free;
    const index = people.length;
    const actor = makePerson(kit, crowd, coats[index % coats.length], .96 + (index % 3) * .03, 0);
    const badge = new THREE.Sprite(badges.passed);
    badge.scale.setScalar(.6);
    badge.position.set(0, 1.95, 0);
    badge.visible = false;
    badge.renderOrder = 10;
    actor.person.add(badge);
    actor.person.visible = false;
    const created: Person = { actor, mode: "idle", path: [], facing: 0, badge };
    people.push(created);
    return created;
  }

  function place(entry: Person, at: THREE.Vector2) {
    entry.actor.person.position.set(at.x, layout.floor, at.y);
    entry.actor.person.visible = true;
  }

  function retire(entry: Person) {
    entry.mode = "idle";
    entry.badge.visible = false;
    entry.actor.person.visible = false;
    entry.path = [];
  }

  function lampState() {
    const lit = owed.length > 0 || !!held;
    lamp.material = lit ? lampOn : lampOff;
    glow.intensity = lit ? 6 + Math.min(owed.length + Number(!!held), 4) * 2 : 0;
  }

  function sendOut(entry: Person, from: readonly Point[]) {
    entry.mode = "leaving";
    entry.badge.material = badges.passed;
    entry.badge.visible = true;
    entry.path = from.map(vector);
  }

  const stations = createStationBadges(scene);

  // Frame the desk, the middle of the line and the bench together.
  const framed = [layout.slots[0], layout.slots[Math.floor((layout.slots.length - 1) / 2)], layout.benchSpots[0]].map(vector);
  const center = layout.focus ? vector(layout.focus) : framed.reduce((sum, point) => sum.add(point), new THREE.Vector2()).divideScalar(framed.length);

  return {
    /** Result badges over this room's stations. */
    stations,
    /** Middle of the desk, line and bench, for framing the camera on phones. */
    focus: new THREE.Vector3(center.x, layout.floor + 1.1, center.y),
    set(state: RoomReaction | null, immediate: boolean) {
      if (!state) {
        people.forEach(retire);
        queue = [];
        owed = [];
        held = null;
        heldState = null;
        lastToken = -1;
        crowd.visible = false;
        lampState();
        return;
      }
      crowd.visible = true;
      // The held person: waits on the first bench spot until their case is resolved, then leaves with a ✓.
      const nextHeld = state.held ?? null;
      if (nextHeld === "waiting" && !held) {
        held = person();
        held.mode = "held";
        held.badge.material = badges.failed;
        held.badge.visible = true;
        held.path = [];
        place(held, benchSpot(0));
        held.facing = layout.benchFacing;
      } else if (nextHeld !== "waiting" && held) {
        const leaving = held;
        held = null;
        if (nextHeld === "resolved" && heldState === "waiting" && !immediate) sendOut(leaving, layout.benchExit);
        else retire(leaving);
      }
      heldState = nextHeld;
      const benchOffset = held ? 1 : 0;
      if (state.event && state.event.token !== lastToken) {
        lastToken = state.event.token;
        const front = queue.shift();
        if (front) {
          if (state.event.correct) sendOut(front, layout.exit);
          else {
            front.mode = "callback";
            front.badge.material = badges.failed;
            front.badge.visible = true;
            front.path = [...layout.toBench.map(vector), benchSpot(owed.length + benchOffset)];
            owed.push(front);
          }
        }
      }
      // Reconcile with the panel's counts (for example after reopening it).
      while (owed.length > state.callbacks) retire(owed.pop()!);
      while (owed.length < state.callbacks) {
        const entry = person();
        entry.mode = "callback";
        entry.badge.material = badges.failed;
        entry.badge.visible = true;
        entry.path = [];
        place(entry, benchSpot(owed.length + benchOffset));
        entry.facing = layout.benchFacing;
        owed.push(entry);
      }
      while (queue.length > state.waiting) retire(queue.pop()!);
      while (queue.length < state.waiting) {
        const entry = person();
        entry.mode = "queue";
        entry.badge.visible = false;
        const target = slot(queue.length);
        if (immediate) {
          place(entry, target);
          entry.path = [];
        } else {
          place(entry, vector(layout.entrance));
          entry.path = [...layout.arrival.map(vector), target];
        }
        queue.push(entry);
      }
      // Everyone in line steps forward to their slot.
      queue.forEach((entry, index) => {
        const target = slot(index);
        const last = entry.path.at(-1);
        const current = last ?? new THREE.Vector2(entry.actor.person.position.x, entry.actor.person.position.z);
        if (current.distanceToSquared(target) > .0004) {
          if (last) entry.path[entry.path.length - 1] = target;
          else entry.path = [target];
        }
      });
      if (immediate) people.forEach((entry) => {
        const last = entry.path.at(-1);
        if (!last) return;
        entry.path = [];
        if (entry.mode === "leaving") retire(entry);
        else place(entry, last);
      });
      lampState();
    },
    update(time: number) {
      const delta = Math.min(Math.max(time - lastTime, 0), .1);
      lastTime = time;
      stations.update(time);
      if (!crowd.visible) return;
      for (const [index, entry] of people.entries()) {
        if (entry.mode === "idle") continue;
        const body = entry.actor.person;
        const next = entry.path[0];
        if (next) {
          const dx = next.x - body.position.x;
          const dz = next.y - body.position.z;
          const distance = Math.hypot(dx, dz);
          const step = 1.9 * delta;
          if (distance <= step) {
            body.position.x = next.x;
            body.position.z = next.y;
            entry.path.shift();
            if (!entry.path.length && entry.mode === "leaving") { retire(entry); continue; }
          } else {
            body.position.x += dx / distance * step;
            body.position.z += dz / distance * step;
          }
          if (distance > .001) entry.facing = Math.atan2(dx, dz);
          entry.actor.walk(time * 9 + index, 1);
        } else {
          // At rest: the line faces forward, the front person faces the desk, the bench faces its set direction.
          const position = queue.indexOf(entry);
          entry.facing = entry.mode === "callback" || entry.mode === "held" ? layout.benchFacing : lineFacing(Math.max(0, position));
          entry.actor.walk(0, 0);
        }
        const turn = Math.atan2(Math.sin(entry.facing - body.rotation.y), Math.cos(entry.facing - body.rotation.y));
        body.rotation.y += turn * Math.min(1, delta * 10);
        if (entry.badge.visible) entry.badge.position.y = 1.95 + Math.sin(time * 3 + index) * .05;
      }
    },
  };
}

export type RoomReactions = ReturnType<typeof buildRoomReactions>;
