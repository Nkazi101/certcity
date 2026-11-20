const accountPrefix = "certcity.account.v1.";
const progressEvent = "certcity:progress";

export type AccountSave = {
  value: string;
  pending?: { base: string | null };
};

let userId: string | null = null;
const unsaved = new Map<string, AccountSave>();

function accountKey(id: string, key: string) {
  return accountPrefix + id + "." + key;
}

export function setProgressUser(id: string | null) {
  userId = id;
}

export function progressScope() {
  return userId ?? "guest";
}

export function isProgressKey(key: string) {
  return key === "simza.city-dispatch.v1" || key === "simza.ccar-f.task-2.2.v1" ||
    key === "certcity.city.active-assignment.v1" ||
    /^certcity\.(city\.(assignment|check)\.v1|mission\.v1)\.[a-z0-9-]{1,64}$/.test(key) ||
    /^certcity\.practice\.[A-Z-]{1,24}\.[a-z0-9.-]{1,32}$/.test(key);
}

export function readAccountSave(id: string, key: string): AccountSave | null {
  const storageKey = accountKey(id, key);
  const fallback = unsaved.get(storageKey);
  if (fallback) return fallback;
  try {
    const entry = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    return typeof entry?.value === "string" ? entry : null;
  } catch {
    return null;
  }
}

export function storeAccountSave(id: string, key: string, entry: AccountSave) {
  const storageKey = accountKey(id, key);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entry));
    unsaved.delete(storageKey);
    return true;
  } catch {
    unsaved.set(storageKey, entry);
    return false;
  }
}

function browserKeys() {
  try {
    const storage = window.localStorage;
    return Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "");
  } catch {
    return [];
  }
}

export function accountSaveKeys(id: string) {
  const prefix = accountKey(id, "");
  return [...new Set([...browserKeys(), ...unsaved.keys()]
    .filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)))].filter(isProgressKey);
}

export function guestSaves() {
  try {
    return browserKeys().filter(isProgressKey).flatMap((key) => {
      const value = window.localStorage.getItem(key);
      if (value === null) return [];
      if (key !== "certcity.city.active-assignment.v1") {
        try { JSON.parse(value); } catch { return []; }
      }
      return [{ key, value }];
    });
  } catch {
    return [];
  }
}

export function readProgressItem(key: string) {
  if (userId) return readAccountSave(userId, key)?.value ?? null;
  return window.localStorage.getItem(key);
}

export function writeProgressItem(key: string, value: string) {
  if (!userId) {
    window.localStorage.setItem(key, value);
    return true;
  }
  const previous = readAccountSave(userId, key);
  if (previous?.value === value) return !unsaved.has(accountKey(userId, key));
  const saved = storeAccountSave(userId, key, { value, pending: previous?.pending ?? { base: previous?.value ?? null } });
  window.dispatchEvent(new CustomEvent(progressEvent, { detail: { key, local: true } }));
  return saved;
}

export function announceCloudProgress(key: string) {
  window.dispatchEvent(new CustomEvent(progressEvent, { detail: { key, local: false } }));
}

export function subscribeToProgress(listener: (key: string | null, local: boolean) => void) {
  function onChange(event: Event) {
    const { key, local } = (event as CustomEvent<{ key: string; local: boolean }>).detail;
    listener(key, local);
  }
  function onStorage(event: StorageEvent) {
    if (event.key === null) return listener(null, false);
    const prefix = userId ? accountKey(userId, "") : "";
    if (!event.key.startsWith(prefix)) return;
    const key = event.key.slice(prefix.length);
    if (!isProgressKey(key)) return;
    if (userId && event.newValue && event.oldValue) {
      const entry = readAccountSave(userId, key);
      try {
        if (entry?.value === JSON.parse(event.oldValue)?.value) return;
      } catch {
        // Refresh when the previous cache entry could not be decoded.
      }
    }
    listener(key, false);
  }
  window.addEventListener(progressEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(progressEvent, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
