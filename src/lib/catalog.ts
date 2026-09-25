import { httpFetcher, type FetchJson } from "@/lib/primitives/catalog";

// The catalog's built-in base URL: `VITE_CATALOG_URL` at build time, else
// `catalog/` next to `index.html` (an absolute URL needs CORS to permit it).
export const DEFAULT_CATALOG_URL =
  (import.meta.env.VITE_CATALOG_URL as string | undefined) ?? "catalog/";

// The fetcher every hook that reads the catalog shares: the user's URL from
// the Data menu (`tt.catalogurl.v1`), `null` = the built-in one.
export function catalogFetcher(url: string | null): FetchJson {
  return httpFetcher(url ?? DEFAULT_CATALOG_URL);
}
