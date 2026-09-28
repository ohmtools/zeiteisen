import {
  ACTIVE_KEY,
  CATALOG_KEY,
  CATALOG_MODE_KEY,
  CATALOG_URL_KEY,
  DATES_KEY,
  DEGREES_KEY,
  IOS_HINT_KEY,
  LOCATIONS_KEY,
  PROFILES_KEY,
  SOURCES_KEY,
} from "@/lib/primitives/storage";

// What the Data menu's "Delete data…" can delete: storage parts, each a set
// of keys, and the offline app files. Dates and their sources go together:
// one key holds catalog and own dates alike. The settings take the catalog
// cache along, as a restore does: back on the built-in URL, another catalog's
// timetables, names and links would stay until the catalog answers.
export const STORAGE_PARTS = {
  profiles: [PROFILES_KEY, ACTIVE_KEY],
  files: [DATES_KEY, SOURCES_KEY, LOCATIONS_KEY, DEGREES_KEY],
  catalog: [CATALOG_KEY],
  settings: [CATALOG_MODE_KEY, CATALOG_URL_KEY, IOS_HINT_KEY, CATALOG_KEY],
} as const;

type StoragePart = keyof typeof STORAGE_PARTS;

export type DataPart = StoragePart | "app";

const storageParts = Object.keys(STORAGE_PARTS) as StoragePart[];

export const dataParts: readonly DataPart[] = [...storageParts, "app"];

type RemovableStore = Pick<Storage, "removeItem" | "clear">;

// Removes the keys instead of writing empty values: the way out when storage
// is full or holds something that breaks the app. Every storage part at once
// clears the whole origin, leftovers of older shapes included. `false` when
// the browser refused.
export function deleteData(parts: readonly DataPart[], store?: RemovableStore): boolean {
  try {
    const target = store ?? globalThis.localStorage;
    if (storageParts.every((part) => parts.includes(part))) {
      target.clear();
      return true;
    }
    for (const part of storageParts) {
      if (parts.includes(part)) for (const key of STORAGE_PARTS[part]) target.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}

// The offline app files: unregisters the service worker and empties Cache
// Storage, so the reload after it fetches every file from the server (a
// stale or broken deploy the worker kept serving). The worker registers and
// precaches again on that load. Best effort: whatever the browser refuses
// stays.
export async function deleteAppFiles(): Promise<void> {
  try {
    const registrations = (await globalThis.navigator?.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // No service worker here.
  }
  try {
    if (!globalThis.caches) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // No Cache Storage here.
  }
}

// "Delete data": removes the chosen parts, then starts the app again, as a
// restore does (every hook read its state on the first render). The app files
// go last, so the reload fetches everything from the server. `false`, and
// nothing reloaded, when the browser refused.
export async function resetAndReload(parts: readonly DataPart[]): Promise<boolean> {
  if (!deleteData(parts)) return false;
  if (parts.includes("app")) await deleteAppFiles();
  location.reload();
  return true;
}
