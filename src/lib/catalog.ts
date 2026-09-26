import { httpFetcher, type FetchJson } from "@/lib/primitives/catalog";

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

// Where `index.html` lives: `/` unless Vite's `base` says otherwise.
export function appRoot(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}
