import type { RehearsalForm } from "./assessment/forms";
import { examMinutes } from "./blueprints";
import type { Domain, Track } from "./blueprints";
import { examGuideLabel, rehearsalBlueprint } from "./december-blueprints";
import type { ExamVersion } from "./december-blueprints";
import { evidenceFingerprint, evidenceKeys, evidenceLink, evidenceRecord, evidenceText } from "./evidence-snapshot";
import { sources } from "./items";
import type { PracticeItem } from "./items";

export type ArchivedRehearsalItem = PracticeItem & { reference: readonly [label: string, url: string] };

export type RehearsalSnapshot = {
  schema: 1;
  id: string;
  trackId: Track["id"];
  version: ExamVersion;
  form: RehearsalForm | null;
  domain: number | null;
  label: string;
  guide: string;
  guideCount: number;
  minutes: number;
  scoring: "exact-set-v1";
  domains: readonly Domain[];
  items: readonly ArchivedRehearsalItem[];
};

export function createRehearsalSnapshot(track: Track, version: ExamVersion | undefined, form: RehearsalForm | undefined,
  items: readonly PracticeItem[], domain: number | null = null, minutes = examMinutes): RehearsalSnapshot {
  const { domains, guide, count } = rehearsalBlueprint(track, version);
  const payload = {
    schema: 1, trackId: track.id, version: version ?? "july-2026", form: form ?? null, domain,
    label: examGuideLabel(track, version), guide, guideCount: count, minutes, scoring: "exact-set-v1",
    domains: domains.map((entry) => ({ ...entry, objectives: [...entry.objectives] })),
    items: items.map((entry): ArchivedRehearsalItem => ({
      ...entry, options: entry.options.map(([key, label]) => [key, label]), correct: [...entry.correct],
      rationales: { ...entry.rationales }, reference: [...sources[entry.source]],
    })),
  } as const;
  return { ...payload, id: evidenceFingerprint(payload) };
}

function validDomain(value: unknown): value is Domain {
  return evidenceRecord(value) && evidenceKeys(value, ["id", "title", "weight", "objectives"]) &&
    typeof value.id === "number" && Number.isInteger(value.id) && value.id > 0 && value.id <= 20 &&
    evidenceText(value.title, 240) && typeof value.weight === "number" && value.weight > 0 && value.weight <= 100 &&
    Array.isArray(value.objectives) && value.objectives.length > 0 && value.objectives.length <= 30 &&
    value.objectives.every((title) => evidenceText(title, 400));
}

function validItem(value: unknown, objectives: ReadonlySet<string>, domain: number | null): value is ArchivedRehearsalItem {
  if (!evidenceRecord(value) || !evidenceKeys(value,
    ["id", "objective", "skill", "source", "reference", "scenario", "context", "pilot", "prompt", "options", "correct", "explanation", "rationales"])) return false;
  const { id, objective, skill, source, reference, scenario, context, pilot, prompt, options, correct, explanation, rationales } = value;
  if (!evidenceText(id, 160) || !evidenceText(objective, 12) || !objectives.has(objective) ||
      (domain !== null && !objective.startsWith(`${domain}.`)) || skill !== objective || !evidenceText(source, 80) ||
      !Array.isArray(reference) || reference.length !== 2 || !evidenceText(reference[0], 240) || !evidenceLink(reference[1]) ||
      !evidenceText(scenario, 300) || (context !== undefined && !evidenceText(context, 3200)) ||
      (pilot !== undefined && typeof pilot !== "boolean") || !evidenceText(prompt, 2000) || !evidenceText(explanation, 2400) ||
      !Array.isArray(options) || options.length < 3 || options.length > 8 ||
      !options.every((row) => Array.isArray(row) && row.length === 2 && evidenceText(row[0], 4) && evidenceText(row[1], 1600)) ||
      !Array.isArray(correct) || correct.length < 1 || correct.length > 2 || !evidenceRecord(rationales)) return false;
  const keys = options.map(([key]) => key);
  return new Set(keys).size === keys.length && new Set(correct).size === correct.length &&
    correct.every((key) => keys.includes(key)) && Object.keys(rationales).length === keys.length &&
    keys.every((key) => Object.hasOwn(rationales, key) && evidenceText(rationales[key], 1800, true));
}

export function validRehearsalSnapshot(value: unknown, track: Track, version?: ExamVersion, form?: RehearsalForm,
  domain: number | null = null): value is RehearsalSnapshot {
  if (!evidenceRecord(value) || !evidenceKeys(value,
    ["schema", "id", "trackId", "version", "form", "domain", "label", "guide", "guideCount", "minutes", "scoring", "domains", "items"])) return false;
  const { id, ...payload } = value;
  const { domains, items, guideCount, minutes } = payload;
  if (payload.schema !== 1 || !evidenceText(id, 16) || !/^[a-f0-9]{16}$/.test(id) || payload.trackId !== track.id ||
      payload.version !== (version ?? "july-2026") || payload.form !== (form ?? null) || payload.domain !== domain ||
      !evidenceText(payload.label, 240) || !evidenceLink(payload.guide) || payload.scoring !== "exact-set-v1" ||
      typeof guideCount !== "number" || !Number.isInteger(guideCount) || guideCount < 1 || guideCount > 160 ||
      typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > 360 ||
      !Array.isArray(domains) || !domains.length || domains.length > 20 || !domains.every(validDomain) ||
      new Set(domains.map(({ id }) => id)).size !== domains.length ||
      (domain !== null && !domains.some(({ id }) => id === domain)) ||
      !Array.isArray(items) || !items.length || items.length > guideCount || (domain === null && items.length !== guideCount)) return false;
  const objectives = new Set(domains.flatMap(({ id: domainId, objectives }) => objectives.map((_, index) => `${domainId}.${index + 1}`)));
  return items.every((item) => validItem(item, objectives, domain)) && new Set(items.map(({ id: itemId }) => itemId)).size === items.length &&
    items.some(({ pilot }) => !pilot) && evidenceFingerprint(payload) === id;
}

type PackedValue = null | boolean | number | PackedValue[];

export type PackedRehearsalSnapshot = { encoding: 1; text: string[]; data: PackedValue };

export function packRehearsalSnapshot(snapshot: RehearsalSnapshot): PackedRehearsalSnapshot {
  const text: string[] = [];
  const byText = new Map<string, number>();
  function intern(value: string) {
    const existing = byText.get(value);
    if (existing !== undefined) return existing;
    const index = text.length;
    text.push(value);
    byText.set(value, index);
    return index;
  }
  function pack(value: unknown): PackedValue {
    if (typeof value === "string") return -1 - intern(value);
    if (typeof value === "number") return value >= 0 ? value : [2, value];
    if (typeof value === "boolean" || value === null) return value;
    if (Array.isArray(value)) return [1, ...value.map(pack)];
    if (!evidenceRecord(value)) return null;
    const entries: PackedValue[] = [0];
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) entries.push(intern(key), pack(entry));
    }
    return entries;
  }
  return { encoding: 1, text, data: pack(snapshot) };
}

export function unpackRehearsalSnapshot(value: unknown): unknown {
  // Rows written before compaction stored the snapshot directly.
  if (!evidenceRecord(value) || value.encoding === undefined) return value;
  if (value.encoding !== 1 || !evidenceKeys(value, ["encoding", "text", "data"]) ||
      !Array.isArray(value.text) || value.text.length > 10_000 ||
      !value.text.every((entry) => evidenceText(entry, 4800, true))) return null;
  const text: string[] = value.text;
  if (text.reduce((sum, entry) => sum + entry.length, 0) > 300_000) return null;
  let remaining = 50_000;
  function malformed(): never { throw new Error("Invalid rehearsal archive"); }
  function readText(index: unknown) {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= text.length) return malformed();
    return text[index];
  }
  function unpack(node: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 12) return malformed();
    if (node === null || typeof node === "boolean") return node;
    if (typeof node === "number" && Number.isFinite(node)) return node < 0 ? readText(-1 - node) : node;
    if (!Array.isArray(node) || node.length === 0 || node.length > remaining) return malformed();
    if (node[0] === 1) return node.slice(1).map((entry) => unpack(entry, depth + 1));
    if (node[0] === 2 && node.length === 2 && typeof node[1] === "number" && node[1] < 0 && Number.isFinite(node[1])) return node[1];
    if (node[0] !== 0 || node.length % 2 !== 1) return malformed();
    const entries = new Map<string, unknown>();
    for (let index = 1; index < node.length; index += 2) {
      const key = readText(node[index]);
      if (entries.has(key)) return malformed();
      entries.set(key, unpack(node[index + 1], depth + 1));
    }
    return Object.fromEntries(entries);
  }
  try {
    return unpack(value.data, 0);
  } catch {
    return null;
  }
}
