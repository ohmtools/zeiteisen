import * as z from "zod/mini";
import {
  catalogCacheSchema,
  catalogModeSchema,
  catalogSourcesSchema,
  emptyCatalogCache,
  emptySources,
  type CatalogCache,
  type CatalogMode,
  type CatalogSources,
} from "./catalog";
import type { DegreeInformation, Locations, SemesterDates } from "./meta";
import type { Profile, ProfileName } from "./profile";
import { degreeInformationSchema, locationsSchema, semesterDatesSchema } from "./meta";
import { sameName } from "./name";
import { timetableFromJSON, timetableJSONSchema, type Timetable } from "./timetable";

// localStorage is the only persistence: the app never talks to a server.
// Reads never throw: a missing, unparseable or invalid value reads as empty,
// and a refused write (quota, private mode) returns false.
//
// All keys stay `.v1` while the app is in development: no migrations, a
// value that no longer parses reads as empty.

// Profiles, each with its own timetables.
export const PROFILES_KEY = "tt.profiles.v1";
// Name of the profile the app comes back to.
export const ACTIVE_KEY = "tt.active.v1";
// Global semester dates: local-only, never in a link or a profile file.
export const DATES_KEY = "tt.dates.v1";
// The user's own locations file, used instead of the catalog's; `null` (or
// missing) = the catalog's.
export const LOCATIONS_KEY = "tt.locations.v1";
// The user's own degreeInformation files, merged over the catalog's.
export const DEGREEINFORMATION_KEY = "tt.degreeinformation.v1";
// Last catalog index plus the small files downloaded from it.
export const CATALOG_KEY = "tt.catalog.v1";
// Where the installed dates came from.
export const SOURCES_KEY = "tt.sources.v1";
// How the catalog is used, a `CatalogMode`.
export const CATALOG_MODE_KEY = "tt.catalogmode.v1";
// The catalog's base URL the user set, `null` (or missing) = the built-in one.
export const CATALOG_URL_KEY = "tt.catalogurl.v1";

export type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

function defaultStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(key: string, store: KeyValueStore | null): unknown {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown, store: KeyValueStore | null): boolean {
  try {
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function read<T>(
  key: string,
  schema: z.ZodMiniType<T>,
  fallback: T,
  store: KeyValueStore | null,
): T {
  const parsed = schema.safeParse(readJson(key, store));
  return parsed.success ? parsed.data : fallback;
}

// --- profiles ---

const storedProfileSchema = z.object({
  name: z.string().check(z.minLength(1)),
  locked: z._default(z.boolean(), false),
  timetables: z._default(z.array(timetableJSONSchema), []),
});

type StoredProfile = z.infer<typeof storedProfileSchema>;

function toStored(profile: Profile): StoredProfile {
  return {
    name: profile.name,
    locked: profile.locked,
    timetables: profile.timetables.map((timetable) => ({
      name: timetable.name,
      origin: timetable.origin,
      rejected: timetable.rejected,
      subjects: timetable.subjects.toJSON(),
    })),
  };
}

// A duplicate timetable name, in any case (`sameName`), keeps the first one:
// names are unique in a profile.
function fromStored(stored: StoredProfile): Profile {
  const timetables: Timetable[] = [];
  for (const timetable of stored.timetables) {
    if (timetables.some((held) => sameName(held.name, timetable.name))) continue;
    timetables.push(timetableFromJSON(timetable));
  }
  return { name: stored.name, locked: stored.locked, timetables };
}

// Parsed one profile at a time: a broken profile is dropped alone instead of
// taking every other one with it. A duplicate name, in any case, keeps the
// first profile.
export function loadProfiles(store = defaultStore()): Profile[] {
  const raw = readJson(PROFILES_KEY, store);
  if (!Array.isArray(raw)) return [];
  const profiles: Profile[] = [];
  for (const item of raw) {
    const parsed = storedProfileSchema.safeParse(item);
    if (!parsed.success) continue;
    if (profiles.some((profile) => sameName(profile.name, parsed.data.name))) continue;
    profiles.push(fromStored(parsed.data));
  }
  return profiles;
}

export function saveProfiles(profiles: readonly Profile[], store = defaultStore()): boolean {
  return writeJson(PROFILES_KEY, profiles.map(toStored), store);
}

// Profile names are unique, so the name is the address.
export function loadActive(store = defaultStore()): ProfileName | null {
  return read(ACTIVE_KEY, z.nullable(z.string().check(z.minLength(1))), null, store);
}

export function saveActive(name: ProfileName, store = defaultStore()): boolean {
  return writeJson(ACTIVE_KEY, name, store);
}

// --- global dates ---

export function loadDates(store = defaultStore()): SemesterDates | null {
  return read(DATES_KEY, z.nullable(semesterDatesSchema), null, store);
}

// `null` removes the dates.
export function saveDates(dates: SemesterDates | null, store = defaultStore()): boolean {
  return writeJson(DATES_KEY, dates, store);
}

// --- own locations and degreeInformation ---

// Stored as uploaded; `null` hands locations back to the catalog.
export function loadOwnLocations(store = defaultStore()): Locations | null {
  return read(LOCATIONS_KEY, z.nullable(locationsSchema), null, store);
}

export function saveOwnLocations(locations: Locations | null, store = defaultStore()): boolean {
  return writeJson(LOCATIONS_KEY, locations, store);
}

// One uploaded degreeInformation file, named after it. Names are unique: the same
// name again replaces the file. In upload order; later files win on a code.
export type OwnDegreeInformationFile = { name: string; data: DegreeInformation };

const ownDegreeInformationSchema: z.ZodMiniType<OwnDegreeInformationFile[]> = z
  .array(z.object({ name: z.string().check(z.minLength(1)), data: degreeInformationSchema }))
  .check(
    z.refine((files) => new Set(files.map((file) => file.name)).size === files.length, {
      message: "file names are unique",
    }),
  );

// `[]` = none, the catalog's alone.
export function loadOwnDegreeInformation(store = defaultStore()): OwnDegreeInformationFile[] {
  return read(DEGREEINFORMATION_KEY, ownDegreeInformationSchema, [], store);
}

export function saveOwnDegreeInformation(
  files: readonly OwnDegreeInformationFile[],
  store = defaultStore(),
): boolean {
  return writeJson(DEGREEINFORMATION_KEY, files, store);
}

// --- catalog ---

export function loadCatalogCache(store = defaultStore()): CatalogCache {
  return read(CATALOG_KEY, catalogCacheSchema, emptyCatalogCache, store);
}

export function saveCatalogCache(cache: CatalogCache, store = defaultStore()): boolean {
  return writeJson(CATALOG_KEY, cache, store);
}

export function loadSources(store = defaultStore()): CatalogSources {
  return read(SOURCES_KEY, catalogSourcesSchema, emptySources, store);
}

export function saveSources(sources: CatalogSources, store = defaultStore()): boolean {
  return writeJson(SOURCES_KEY, sources, store);
}

// `auto` unless the user picked another mode.
export function loadCatalogMode(store = defaultStore()): CatalogMode {
  return read(CATALOG_MODE_KEY, catalogModeSchema, "auto", store);
}

export function saveCatalogMode(mode: CatalogMode, store = defaultStore()): boolean {
  return writeJson(CATALOG_MODE_KEY, mode, store);
}

// An absolute http(s) URL; anything else reads as the built-in catalog.
const catalogUrlSchema = z.nullable(z.url({ protocol: /^https?$/ }));

export function loadCatalogUrl(store = defaultStore()): string | null {
  return read(CATALOG_URL_KEY, catalogUrlSchema, null, store);
}

// `null` goes back to the built-in catalog.
export function saveCatalogUrl(url: string | null, store = defaultStore()): boolean {
  return writeJson(CATALOG_URL_KEY, url, store);
}

// --- iOS home screen hint ---

// Whether the one-time "add to home screen" hint was shown on this device.
// Device-local: not part of a backup.
export const IOS_HINT_KEY = "tt.ioshint.v1";

export function loadIosHintShown(store = defaultStore()): boolean {
  try {
    return store?.getItem(IOS_HINT_KEY) === "shown";
  } catch {
    return false;
  }
}

export function saveIosHintShown(store = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(IOS_HINT_KEY, "shown");
    return true;
  } catch {
    return false;
  }
}

// --- backup ---

// Everything the user made on this device, to carry it elsewhere or keep it
// safe: every key above except the catalog cache (the catalog hands that out
// again) and the iOS hint (about this device only). The language stays with
// the browser.
export type Backup = {
  profiles: Profile[];
  active: ProfileName | null;
  dates: SemesterDates | null;
  locations: Locations | null;
  degreeInformation: OwnDegreeInformationFile[];
  sources: CatalogSources;
  catalogMode: CatalogMode;
  catalogUrl: string | null;
};

export function loadBackup(store = defaultStore()): Backup {
  return {
    profiles: loadProfiles(store),
    active: loadActive(store),
    dates: loadDates(store),
    locations: loadOwnLocations(store),
    degreeInformation: loadOwnDegreeInformation(store),
    sources: loadSources(store),
    catalogMode: loadCatalogMode(store),
    catalogUrl: loadCatalogUrl(store),
  };
}

// The backup file: profiles in their stored shape, `locked` and `rejected`
// included, unlike the profile file.
export const backupFileSchema = z.object({
  v: z.literal(1),
  profiles: z.array(storedProfileSchema).check(
    z.refine(
      (profiles) =>
        profiles.every(
          (one, i) => profiles.findIndex((other) => sameName(other.name, one.name)) === i,
        ),
      {
        message: "profile names are unique",
      },
    ),
  ),
  active: z.nullable(z.string().check(z.minLength(1))),
  dates: z.nullable(semesterDatesSchema),
  locations: z._default(z.nullable(locationsSchema), null),
  degreeInformation: z._default(ownDegreeInformationSchema, []),
  sources: catalogSourcesSchema,
  catalogMode: z._default(catalogModeSchema, "auto"),
  catalogUrl: z._default(catalogUrlSchema, null),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

export function getBackupFile(backup: Backup): BackupFile {
  return {
    v: 1,
    profiles: backup.profiles.map(toStored),
    active: backup.active,
    dates: backup.dates,
    locations: backup.locations,
    degreeInformation: backup.degreeInformation,
    sources: backup.sources,
    catalogMode: backup.catalogMode,
    catalogUrl: backup.catalogUrl,
  };
}

// Strict, unlike the loaders: a restore replaces everything, so a file with
// anything broken in it (one profile, a repeated profile or timetable name, a
// bad field) is refused whole — `null`, and nothing is touched.
export function parseBackupFile(json: unknown): Backup | null {
  const parsed = backupFileSchema.safeParse(json);
  if (!parsed.success) return null;
  const profiles = parsed.data.profiles.map(fromStored);
  const repeated = profiles.some(
    (profile, i) => profile.timetables.length !== parsed.data.profiles[i].timetables.length,
  );
  if (repeated) return null;
  const { active, dates, locations, degreeInformation, sources, catalogMode, catalogUrl } =
    parsed.data;
  return {
    profiles,
    active,
    dates,
    locations,
    degreeInformation,
    sources,
    catalogMode,
    catalogUrl,
  };
}

// Replaces every key a backup holds; the catalog cache stays. `false` when
// the browser refused a write.
export function saveBackup(backup: Backup, store = defaultStore()): boolean {
  const written = [
    saveProfiles(backup.profiles, store),
    writeJson(ACTIVE_KEY, backup.active, store),
    saveDates(backup.dates, store),
    saveOwnLocations(backup.locations, store),
    saveOwnDegreeInformation(backup.degreeInformation, store),
    saveSources(backup.sources, store),
    saveCatalogMode(backup.catalogMode, store),
    saveCatalogUrl(backup.catalogUrl, store),
  ];
  return written.every(Boolean);
}
