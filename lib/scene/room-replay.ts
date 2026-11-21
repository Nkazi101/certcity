import * as THREE from "three";
import type { ModelKit } from "./model-kit";
import type { RoomStation } from "./room-scenes";
import type { MissionRoomReplay } from "./sites";

type ReplayKind = MissionRoomReplay["kind"];
type Slot = { x: number; label: string };
type Packet = { body: THREE.Group; sheets: THREE.Group[] };

const stations: Record<string, ReplayKind> = {
  "market-bulletin": "bulletin",
  "supplier-invoices": "receiving",
  "regional-operations": "operations",
};

const slots: Record<ReplayKind, Record<string, Slot>> = {
  bulletin: {
    vendor: { x: -1.14, label: "VENDOR" },
    proof: { x: -.38, label: "PROOF" },
    approval: { x: .38, label: "INEZ" },
    public: { x: 1.14, label: "PUBLIC" },
  },
  receiving: {
    unresolved: { x: -.94, label: "SOURCE" },
    held: { x: 0, label: "REVIEW" },
    posted: { x: .94, label: "LEDGER" },
  },
  operations: {
    waiting: { x: -.94, label: "WAITING" },
    staffed: { x: 0, label: "STAFFED" },
    handoff: { x: .94, label: "HANDOFF" },
  },
};

function routeFor(replay: MissionRoomReplay) {
  switch (replay.kind) {
    case "bulletin": return replay.destination ?? "proof";
    case "receiving": return replay.disposition ?? "unresolved";
    case "operations": return replay.stage === "new-case" ? "handoff" : replay.staffed ? "staffed" : "waiting";
  }
}

function sheet(kit: ModelKit, parent: THREE.Group, title: string, fill: string) {
  const group = kit.group(parent, [0, 0, 0]);
  const ink = kit.material("#52706a");
  kit.box(group, [0, .016, 0], [.45, .036, .49], kit.material(fill), true);
  const mark = kit.group(group, [0, .039, -.12]);
  mark.rotation.x = -Math.PI / 2;
  kit.sign(mark, title, [0, 0, 0], .395, ["#b7b69d", "#273f3b"]);
  for (const [line, width] of [.27, .33, .21].entries()) {
    kit.box(group, [(-.33 + width) / 2, .039, -.031 + line * .078], [width, .009, .021], ink, true);
  }
  kit.batch(group);
  return group;
}

function packet(kit: ModelKit, parent: THREE.Group, labels: readonly string[]): Packet {
  const body = kit.group(parent, [0, 0, 0]);
  const sheets = labels.map((name, index) => sheet(kit, body, name, index % 2 ? "#dfbd8e" : "#fff0c9"));
  return { body, sheets };
}

function buildSlots(kit: ModelKit, parent: THREE.Group, kind: ReplayKind) {
  const frame = kit.material(kind === "bulletin" ? "#8b6749" : "#4f6e75");
  const rim = kit.material(kind === "bulletin" ? "#a87e55" : "#6c8c87");
  const top = kit.material(kind === "bulletin" ? "#d1b182" : "#b0b9a3");
  const palette: [string, string] = kind === "bulletin" ? ["#71543b", "#fff0c5"] : ["#3e585c", "#f5edd0"];
  const rack = kit.group(parent, [0, 0, 0]);
  for (const { x, label } of Object.values(slots[kind])) {
    kit.box(rack, [x, .04, -.09], [.705, .084, .66], frame, true);
    kit.box(rack, [x, .083, -.07], [.61, .023, .53], top, true);
    kit.box(rack, [x, .153, -.395], [.71, .204, .076], frame, true);
    for (const side of [-1, 1]) kit.box(rack, [x + side * .32, .13, -.08], [.063, .15, .64], rim, true);
    kit.box(rack, [x, .105, .235], [.705, .139, .057], frame, true);
    kit.sign(rack, label, [x, .117, .269], .585, palette);
  }
  kit.batch(rack);
}

export function buildRoomReplay(kit: ModelKit, scene: THREE.Scene, mission: string | undefined, station: RoomStation, surface: number) {
  const kind = mission ? stations[mission] : undefined;
  if (!kind) return undefined;

  const [x, z] = station;
  const rig = kit.group(scene, [x, surface + .035, z + .055]);
  rig.name = "Mission replay";
  rig.visible = false;
  buildSlots(kit, rig, kind);

  const packets = kind === "bulletin" ? [packet(kit, rig, ["VENDOR"]), packet(kit, rig, ["STAFF"])]
    : kind === "receiving" ? [packet(kit, rig, ["303", "318"])]
      : [packet(kit, rig, ["CALL", "SHIFT"]), packet(kit, rig, ["CALL"]), packet(kit, rig, ["CALL"])];
  const amber = kit.material("#dcb071");
  const sage = kit.material("#b2d5a8");
  const unlit = kit.material("#758d83");
  const signal = kit.group(rig, [0, 0, 0]);
  kit.box(signal, [0, .197, -.419], [.57, .076, .096], kit.material("#385657"), true);
  const lamp = kit.box(signal, [0, .206, -.361], [.49, .053, .033], unlit, true);
  const timed = kind === "operations" ? kit.group(rig, [0, .219, -.398]) : null;
  const minuteTicks = timed ? Array.from({ length: 10 }, (_, index) =>
    kit.box(timed, [-.80 + index * .178, .058, 0], [.149, .101, .083], unlit, true)) : [];

  let replay: MissionRoomReplay | null = null;
  let startedAt = 0;
  let destination = 0;
  let duration = 0;
  let travel = false;
  let count = 0;

  function draw(now: number) {
    if (!replay) return;
    const elapsed = duration ? Math.max(0, now - startedAt) : Infinity;
    for (let index = 0; index < count; index++) {
      const progress = travel ? THREE.MathUtils.clamp((elapsed - index * 109) / 710, 0, 1) : 1;
      const direction = THREE.MathUtils.smoothstep(progress, 0, 1);
      const arc = Math.sin(progress * Math.PI);
      const stack = (index - (count - 1) / 2) * .072;
      const start = (kind === "operations" ? slots.operations.waiting.x : -.47) + stack * 2;
      const packet = packets[index].body;
      packet.position.set(THREE.MathUtils.lerp(start, destination + stack, direction),
        .113 + index * .042 + arc * .58, THREE.MathUtils.lerp(.38 + stack, -.09 + stack, direction));
      packet.rotation.set(-arc * .63, stack * 3.4 - arc * .29, arc * .14);
    }
    if (elapsed >= duration) {
      lamp.material = replay.result === "pass" ? sage : amber;
      duration = 0;
    }
  }

  return {
    set(next: MissionRoomReplay | null, immediate: boolean) {
      if (!next || next.kind !== kind) {
        replay = null;
        duration = 0;
        rig.visible = false;
        return false;
      }
      if (replay?.token === next.token) {
        if (immediate) {
          duration = 0;
          draw(performance.now());
        }
        return true;
      }
      replay = next;
      rig.visible = true;
      count = kind === "bulletin" ? 2 : next.kind === "operations" && next.stage !== "new-case" ? 3 : 1;
      const slot = routeFor(next);
      destination = slots[kind][slot].x;
      travel = !(next.kind === "operations" && slot === "waiting");
      duration = immediate || !travel ? 0 : 710 + (count - 1) * 109;
      startedAt = performance.now();
      signal.position.x = destination;
      lamp.material = unlit;
      for (const [index, { body, sheets }] of packets.entries()) {
        body.visible = index < count;
        sheets.forEach((paper, sheetIndex) => { paper.visible = sheetIndex === (next.stage === "new-case" && sheets.length > 1 ? 1 : 0); });
      }
      if (timed && next.kind === "operations") {
        timed.visible = next.stage !== "new-case" && next.minutes !== undefined;
        minuteTicks.forEach((tick, index) => {
          tick.material = index >= (next.minutes ?? 0) ? unlit : (next.minutes ?? 0) > 10 ? amber : sage;
        });
      }
      draw(startedAt);
      return true;
    },
    update() { if (duration) draw(performance.now()); },
  };
}
