import * as z from "zod/mini";
import {
  degreeInformationSchema,
  locationsSchema,
  semesterDatesSchema,
  type CatalogLocation,
  type SubjectInformation,
  type SemesterDates,
} from "./meta";
import {
  subjectsFileSchema,
  subjectsHash,
  type Subject,
  type SubjectsHash,
  type SubjectsOrigin,
  type SubjectsSource,
} from "./subject";
import { nameFromFile } from "./name";
import type { TimetableName } from "./timetable";

// The optional catalog: a read-only directory of static JSON served next to the
// app. It is never written to and nothing is ever sent to it. Everything is
// optional: a missing catalog, a missing or broken file and being offline all
// read as "not there", nothing here throws.
//
//   catalog/
//     index.json            generated, lists every file below
//     locations.json
//     dates.json
//     degreeinformation/*.json
//     timetables/**/*.{json,timetable}  plain Subject[], named after the file

export const CatalogKind = {
  Locations: "locations",
  DegreeInformation: "degreeinformation",
  Dates: "dates",
  Timetables: "timetables",
} as const;

export type CatalogKind = (typeof CatalogKind)[keyof typeof CatalogKind];

// A catalog origin's path is relative to this directory.
export const TIMETABLES_DIR = "timetables/";

export type CatalogEntry = {
  // Relative to the catalog root.
  path: string;
  kind: CatalogKind;
  // For a timetable: `Subjects.hash()` of its subjects, so a timetable can be
  // matched by hash without downloading it. For every other kind: any hash of
  // the file content, it only decides whether a cached copy is stale.
  hash: string;
  // File mtime, ISO datetime.
  modified?: string;
};

export type CatalogIndex = {
  version: 1;
  generated?: string;
  files: CatalogEntry[];
};

const entrySchema = z.object({
  path: z.string().check(z.minLength(1)),
  kind: z.enum(Object.values(CatalogKind) as [CatalogKind, ...CatalogKind[]]),
  hash: z.string().check(z.minLength(1)),
  modified: z.optional(z.iso.datetime()),
});

export const catalogIndexSchema: z.ZodMiniType<CatalogIndex> = z.object({
  version: z.literal(1),
  generated: z.optional(z.string()),
  files: z._default(z.array(entrySchema), []),
});

// Reads one catalog file by its path, `undefined` when it is not there.
export type FetchJson = (path: string) => Promise<unknown>;

// A `FetchJson` over HTTP. `baseUrl` is resolved against the page, so the
// default finds a `catalog/` directory next to `index.html`.
export function httpFetcher(baseUrl = "catalog/"): FetchJson {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  return async (path) => {
    try {
      const url = new URL(path, new URL(base, globalThis.location?.href));
      // `no-cache` revalidates instead of serving a stale HTTP-cache copy; the
      // service worker still answers when offline.
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) return undefined;
      return (await response.json()) as unknown;
    } catch {
      return undefined;
    }
  };
}

const noFetch: FetchJson = async () => undefined;

// The timetable a catalog entry holds is named after its file.
export function timetableNameOf(entry: CatalogEntry): TimetableName {
  return nameFromFile(entry.path);
}

export function originOf(entry: CatalogEntry): SubjectsOrigin {
  return { kind: "catalog", path: entry.path.slice(TIMETABLES_DIR.length) };
}

// One catalog index plus the way to read the files it lists.
export class Catalog {
  readonly index: CatalogIndex | null;
  readonly #fetchJson: FetchJson;

  constructor(index: CatalogIndex | null, fetchJson: FetchJson = noFetch) {
    this.index = index;
    this.#fetchJson = fetchJson;
  }

  static readonly empty = new Catalog(null);

  // Reads `index.json`. No index (offline, no catalog, unreadable) gives a
  // catalog that lists nothing.
  static async load(fetchJson: FetchJson): Promise<Catalog> {
    const parsed = catalogIndexSchema.safeParse(await fetchJson("index.json"));
    return new Catalog(parsed.success ? parsed.data : null, fetchJson);
  }

  entries(kind: CatalogKind): CatalogEntry[] {
    return (this.index?.files ?? []).filter((entry) => entry.kind === kind);
  }

  // Timetable entries outside `timetables/` have no origin path and are left out.
  get timetables(): CatalogEntry[] {
    return this.entries(CatalogKind.Timetables).filter(
      (entry) => entry.path.startsWith(TIMETABLES_DIR) && entry.path.length > TIMETABLES_DIR.length,
    );
  }

  // The ONE dates file, `null` when the catalog carries none.
  get dates(): CatalogEntry | null {
    return this.entries(CatalogKind.Dates)[0] ?? null;
  }

  // The entry a timetable was installed from, if the catalog still lists it.
  entryOf(origin: SubjectsOrigin): CatalogEntry | null {
    if (origin.kind !== "catalog") return null;
    const path = TIMETABLES_DIR + origin.path;
    return this.timetables.find((entry) => entry.path === path) ?? null;
  }

  json(path: string): Promise<unknown> {
    return this.#fetchJson(path);
  }

  // The validated subjects of a timetable entry, `null` when missing or broken.
  async subjects(entry: CatalogEntry): Promise<Subject[] | null> {
    const parsed = subjectsFileSchema.safeParse(await this.json(entry.path));
    return parsed.success ? parsed.data : null;
  }

  // Every timetable file listing this hash. Loading one checks the content
  // really has it: an index older than its files would otherwise hand out other
  // subjects than asked for.
  sources(hash: SubjectsHash): SubjectsSource[] {
    return this.timetables
      .filter((entry) => entry.hash === hash)
      .map((entry) => ({
        name: timetableNameOf(entry),
        origin: originOf(entry),
        load: async () => {
          const subjects = await this.subjects(entry);
          return subjects && subjectsHash(subjects) === hash ? subjects : null;
        },
      }));
  }
}

// --- offline cache of the small files (locations, degreeInformation, dates) ---

// The last index plus the payload of every small file downloaded, keyed by path
// with the hash it had. Timetables are not cached: a picked one is copied into
// its profile, where it persists anyway.
export type CatalogCache = {
  index: CatalogIndex | null;
  files: Record<string, { hash: string; data: unknown }>;
};

export const catalogCacheSchema: z.ZodMiniType<CatalogCache> = z.object({
  index: z._default(z.nullable(catalogIndexSchema), null),
  files: z._default(z.record(z.string(), z.object({ hash: z.string(), data: z.unknown() })), {}),
});

export const emptyCatalogCache: CatalogCache = { index: null, files: {} };

// A cached payload is usable while the index still lists the same hash for it.
// `allowStale` (auto-update off) keeps whatever copy the device has.
export function cached(cache: CatalogCache, entry: CatalogEntry, allowStale = false): unknown {
  const hit = cache.files[entry.path];
  if (!hit) return undefined;
  return allowStale || hit.hash === entry.hash ? hit.data : undefined;
}

// Brings the cache up to the catalog's index: downloads every small file the
// cache has no current copy of and drops files the index no longer lists. With
// `refresh` false (auto-update off) only files with no copy at all are
// downloaded. `updated` names the kinds whose content really changed — a first
// download is not an update.
export async function refreshCache(
  cache: CatalogCache,
  catalog: Catalog,
  refresh = true,
): Promise<{ cache: CatalogCache; updated: Set<CatalogKind> }> {
  const updated = new Set<CatalogKind>();
  if (!catalog.index) return { cache, updated };

  const files: CatalogCache["files"] = {};
  for (const entry of catalog.index.files) {
    if (entry.kind === CatalogKind.Timetables) continue;
    const before = cache.files[entry.path];
    if (cached(cache, entry, !refresh) !== undefined) {
      files[entry.path] = before;
      continue;
    }
    const data = await catalog.json(entry.path);
    if (data === undefined) {
      // A failed download keeps the previous copy, if any.
      if (before) files[entry.path] = before;
      continue;
    }
    files[entry.path] = { hash: entry.hash, data };
    if (before && before.hash !== entry.hash) updated.add(entry.kind);
  }

  return { cache: { index: catalog.index, files }, updated };
}

// --- payloads ---

// Building code (upper case) -> location.
export function parseLocations(payload: unknown): Record<string, CatalogLocation> {
  const parsed = locationsSchema.safeParse(payload);
  if (!parsed.success) return {};
  return Object.fromEntries(
    parsed.data.locations.map((location) => [location.code.toUpperCase(), location]),
  );
}

// Every degreeInformation file merged into one table, subject code (upper case) ->
// its whole entry. Later files win, so a program-specific file can override a
// general one. Broken files are skipped.
export function mergeDegreeInformation(payloads: unknown[]): Record<string, SubjectInformation> {
  const table: Record<string, SubjectInformation> = {};
  for (const payload of payloads) {
    const parsed = degreeInformationSchema.safeParse(payload);
    if (!parsed.success) continue;
    for (const info of parsed.data.subjects) table[info.code.toUpperCase()] = info;
  }
  return table;
}

export function parseDates(payload: unknown): SemesterDates | null {
  const parsed = semesterDatesSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

// --- how the app uses the catalog ---

// `auto` reads the catalog and keeps dates, locations and degreeInformation
// current; `freeze` still reads the index (the picker lists it) but keeps what
// the device has, downloading only what it has no copy of; `ignore` reads
// nothing at all and uses none of the catalog's data.
export type CatalogMode = "ignore" | "auto" | "freeze";

export const catalogModeSchema: z.ZodMiniType<CatalogMode> = z.enum(["ignore", "auto", "freeze"]);

// --- where the installed dates came from ---

// The catalog installs the dates by itself — unless the user uploaded their
// own (`datesManual`), until they ask for the catalog ones again.
export type DatesSource = { path: string; hash: string };

export type CatalogSources = {
  dates: DatesSource | null;
  datesManual: boolean;
};

export const catalogSourcesSchema: z.ZodMiniType<CatalogSources> = z.object({
  dates: z._default(
    z.nullable(
      z.object({ path: z.string().check(z.minLength(1)), hash: z.string().check(z.minLength(1)) }),
    ),
    null,
  ),
  datesManual: z._default(z.boolean(), false),
});

export const emptySources: CatalogSources = { dates: null, datesManual: false };

// The catalog dates file to install now, or `null`: none served, the user
// picked their own, or the installed one is current. With auto-update off only
// a device without any dates gets them.
export function datesToInstall(
  sources: CatalogSources,
  catalog: Catalog,
  autoUpdate = true,
): CatalogEntry | null {
  const entry = catalog.dates;
  if (!entry || sources.datesManual) return null;
  if (sources.dates && !autoUpdate) return null;
  const current = sources.dates?.path === entry.path && sources.dates.hash === entry.hash;
  return current ? null : entry;
}
