import { httpFetcher } from "@/lib/primitives/catalog";

// The one fetcher of the optional catalog, shared by every hook that reads it.
// `VITE_CATALOG_URL` overrides the default `catalog/` next to `index.html` at
// build time (an absolute URL needs CORS to permit it).
export const fetchCatalogJson = httpFetcher(
  (import.meta.env.VITE_CATALOG_URL as string | undefined) ?? "catalog/",
);
