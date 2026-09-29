import {
  CatalogKind,
  degreeProgramOf,
  httpFetcher,
  type CatalogCache,
  type CatalogEntry,
  type CatalogSources,
  type FetchJson,
} from "@/lib/primitives/catalog";
import type { Locations } from "@/lib/primitives/meta";
import type { OwnDegreeFile } from "@/lib/primitives/storage";

// The catalog's built-in base URL: `VITE_CATALOG_URL` at build time, else
// `catalog/` next to `index.html` (an absolute URL needs CORS to permit it).
export const DEFAULT_CATALOG_URL =
  (import.meta.env.VITE_CATALOG_URL as string | undefined) ?? "catalog/";

// The fetcher every hook that reads the catalog shares: the user's URL from
// the Data menu (`tt.catalogurl.v1`), `null` = the built-in one. A relative
// built-in URL is resolved against the app root, not the page: a share link
// opens on `/s/`, where `catalog/` would miss.
export function catalogFetcher(url: string | null): FetchJson {
  return httpFetcher(url ?? new URL(DEFAULT_CATALOG_URL, appRoot()).href);
}

// What a change of the cache (`before` -> `after`) is news about: a catalog
// file in use that the device already had and that really changed. A first
// download is no news, nor is a dropped cache, nor a file an own one replaces
// (own locations; an own degree file of its name). The same for this tab's
// refresh and for a cache another tab wrote, so every open tab says the same.
export function catalogNews(
  before: CatalogCache,
  after: CatalogCache,
  own: { locations: Locations | null; degrees: readonly OwnDegreeFile[] },
): { locations: boolean; degrees: boolean } {
  const entries = (kind: CatalogKind) =>
    (after.index?.files ?? []).filter((entry) => entry.kind === kind);
  const changed = (entry: CatalogEntry) => {
    const had = before.files[entry.path];
    const has = after.files[entry.path];
    return had !== undefined && has !== undefined && had.hash !== has.hash;
  };
  const replaced = new Set(own.degrees.map((file) => file.name));
  return {
    locations: own.locations === null && entries(CatalogKind.Locations).some(changed),
    degrees: entries(CatalogKind.Degrees).some((entry) => {
      const program = degreeProgramOf(entry);
      return program !== null && !replaced.has(program) && changed(entry);
    }),
  };
}

// Whether another tab installed a new version of the catalog's dates: the
// device held catalog dates before and after, and the user picked neither by
// hand. A first install, a removal and the user's own switch are no news.
export function catalogDatesNews(before: CatalogSources, after: CatalogSources): boolean {
  return (
    before.dates !== null &&
    after.dates !== null &&
    !before.datesManual &&
    !after.datesManual &&
    before.dates.hash !== after.dates.hash
  );
}

// Where `index.html` lives: `/` unless Vite's `base` says otherwise.
export function appRoot(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}
