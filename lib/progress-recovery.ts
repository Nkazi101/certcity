import {
  accountSaveKeys, announceCloudProgress, guestSaves, isProgressKey, progressScope, readAccountSave, readProgressItem, writeProgressItem,
} from "./progress-storage";
import { mergeProgressValues } from "./progress-merge";

const schema = "certcity.progress-backup.v1";
const prefix = "certcity.recovery.v1.";
const maxBackupSize = 8 * 1024 * 1024;

type Save = { key: string; value: string };
export type RecoveryCopy = Save & { id: string; capturedAt: number };
type Backup = { schema: typeof schema; exportedAt: number; entries: Save[]; copies: RecoveryCopy[] };

function validEntry(entry: unknown): entry is Save {
  if (!entry || typeof entry !== "object" || !("key" in entry) || !("value" in entry) ||
      typeof entry.key !== "string" || !isProgressKey(entry.key) || typeof entry.value !== "string" || new TextEncoder().encode(entry.value).length > maxBackupSize) return false;
  if (entry.key === "certcity.city.active-assignment.v1") return /^(?:(?:associate|developer|architect)-foundations|architect-professional)$/.test(entry.value);
  try {
    const data = JSON.parse(entry.value);
    return !!data && typeof data === "object" && !Array.isArray(data);
  } catch {
    return false;
  }
}

function historyKey(scope: string) {
  return prefix + scope;
}

export function recoveryCopies(scope = progressScope()): RecoveryCopy[] {
  try {
    const copies: unknown = JSON.parse(window.localStorage.getItem(historyKey(scope)) ?? "[]");
    return Array.isArray(copies) ? copies.filter((copy): copy is RecoveryCopy => validEntry(copy) &&
      typeof (copy as RecoveryCopy).id === "string" && Number.isSafeInteger((copy as RecoveryCopy).capturedAt)) : [];
  } catch {
    return [];
  }
}

export function rememberRecovery(saves: Save[], scope = progressScope()): boolean {
  const copies = recoveryCopies(scope);
  const capturedAt = Date.now();
  for (const save of saves) {
    if (!validEntry(save)) return false;
    if (!copies.some(({ key, value }) => save.key === key && save.value === value)) {
      copies.push({ ...save, capturedAt, id: globalThis.crypto.randomUUID() });
    }
  }
  try {
    window.localStorage.setItem(historyKey(scope), JSON.stringify(copies));
    return true;
  } catch {
    return false;
  }
}

export function makeProgressBackup(extra: Save[] = []): Backup {
  const scope = progressScope();
  const active = scope === "guest" ? guestSaves() : accountSaveKeys(scope).flatMap((key) => {
    const value = readAccountSave(scope, key)?.value;
    return value !== undefined ? [{ key, value }] : [];
  });
  const capturedAt = Date.now();
  return {
    schema, exportedAt: capturedAt, entries: active.filter(validEntry),
    copies: [...recoveryCopies(scope), ...extra.filter(validEntry).map((save) => ({ ...save, capturedAt, id: globalThis.crypto.randomUUID() }))],
  };
}

export function downloadProgressBackup(extra: Save[] = []) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(makeProgressBackup(extra))], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "certcity-progress.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseProgressBackup(text: string): Save[] | null {
  if (new TextEncoder().encode(text).length > maxBackupSize) return null;
  try {
    const value = JSON.parse(text);
    if (value?.schema !== schema || !Array.isArray(value.entries) || !Array.isArray(value.copies)) return null;
    const saves: unknown[] = [...value.entries, ...value.copies];
    if (saves.length > 1000 || !saves.every(validEntry)) return null;
    return saves;
  } catch {
    return null;
  }
}

export async function activateRecovery(copy: RecoveryCopy) {
  const scope = progressScope();
  function restore() {
    if (scope !== progressScope() || !recoveryCopies(scope).some(({ id, value }) => id === copy.id && value === copy.value)) return false;
    const current = readProgressItem(copy.key);
    if (current === copy.value) return true;
    if (current !== null && !rememberRecovery([{ key: copy.key, value: current }], scope)) return false;
    if (!writeProgressItem(copy.key, copy.value)) return false;
    announceCloudProgress(copy.key);
    return true;
  }
  return navigator.locks ? navigator.locks.request(scope + ":" + copy.key, restore) : restore();
}

export async function restoreProgressBackup(saves: Save[]) {
  const scope = progressScope();
  async function restoreOne(save: Save) {
    if (scope !== progressScope()) return "failed";
    const current = readProgressItem(save.key);
    if (current === save.value) return "existing";
    const merged = current === null ? save.value : mergeProgressValues(save.key, null, current, save.value);
    if (merged === null) return rememberRecovery([save], scope) ? "archived" : "failed";
    if (!writeProgressItem(save.key, merged)) return "failed";
    announceCloudProgress(save.key);
    return "restored";
  }

  const counts = { restored: 0, existing: 0, archived: 0, failed: 0 };
  for (const save of saves) {
    if (!validEntry(save)) { counts.failed++; continue; }
    try {
      const result = navigator.locks
        ? await navigator.locks.request(scope + ":" + save.key, () => restoreOne(save))
        : await restoreOne(save);
      counts[result]++;
    } catch {
      counts.failed++;
    }
  }
  return counts;
}
