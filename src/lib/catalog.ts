import {
  CatalogKind,
  degreeProgramOf,
  httpFetcher,
  type Catalog,
  type CatalogCache,
  type FetchJson,
} from "@/lib/primitives/catalog";
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

// Whether a refresh (`before` -> `after`) changed a catalog degree file in
// use: one the device already had (a first download is no news) and no own
// file of its name replaces. `refreshCache`'s `updated` only names kinds.
export function degreesUpdated(
  catalog: Catalog,
  before: CatalogCache,
  after: CatalogCache,
  own: readonly OwnDegreeFile[],
): boolean {
  const replaced = new Set(own.map((file) => file.name));
  return catalog.entries(CatalogKind.Degrees).some((entry) => {
    const program = degreeProgramOf(entry);
    const had = before.files[entry.path];
    return (
      program !== null &&
      !replaced.has(program) &&
      had !== undefined &&
      had.hash !== after.files[entry.path]?.hash
    );
  });
}

// Where `index.html` lives: `/` unless Vite's `base` says otherwise.
export function appRoot(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}
