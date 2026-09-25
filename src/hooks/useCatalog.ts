import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import {
  cached,
  Catalog,
  CatalogKind,
  datesToInstall,
  mergeAbbreviations,
  parseDates,
  parseLocations,
  refreshCache,
  type CatalogCache,
  type CatalogEntry,
  type CatalogSources,
} from "@/lib/primitives/catalog";
import type { SemesterDates } from "@/lib/primitives/meta";
import { loadCatalogCache, saveCatalogCache } from "@/lib/primitives/storage";
import { fetchCatalogJson } from "@/lib/catalog";
import { setAbbreviationOverrides, setLocationOverrides } from "@/lib/overrides";

type Options = {
  // The footer switch. Off: the index is still read (the picker lists need
  // it), but nothing already on the device is refreshed.
  autoUpdate: boolean;
  // Where the installed dates came from, and whether the user picked them.
  sources: CatalogSources;
  // Handed the catalog's dates file whenever it should be installed.
  onDates: (dates: SemesterDates, entry: CatalogEntry, options?: { quiet?: boolean }) => void;
};

// Owns `tt.catalog.v1`: the optional read-only catalog of locations, subject
// abbreviations, global dates and ready-made timetables served as static JSON
// next to the app. Starts from the cached copy, then refreshes in the
// background; no catalog, a partial one or no network at all changes nothing
// about how the app works.
//
// Timetables are never pushed anywhere: they are offered in the picker and in
// the update dialog, and only a user's click ever copies one into a profile.
export function useCatalog({ autoUpdate, sources, onDates }: Options): Catalog {
  const [cache, setCache] = useState<CatalogCache>(loadCatalogCache);
  // The refresh runs once per page load and reads these when it gets there.
  const optionsRef = useRef({ autoUpdate, sources, onDates, cache });
  useEffect(() => {
    optionsRef.current = { autoUpdate, sources, onDates, cache };
  });

  const catalog = useMemo(() => new Catalog(cache.index, fetchCatalogJson), [cache.index]);

  // Locations and abbreviations are the tables `buildings.ts` and
  // `subjects.ts` read. Derived from the cache during render, so the very
  // first render after a refresh already spells the new names out. Always the
  // newest copy the device has, even when the index now lists another hash
  // for it: the refresh replaces it once the download works, and until then
  // (a failed or broken download, auto-update off, the moment between the
  // new index and its files) the older copy beats no names and no links.
  const overrides = useMemo(() => {
    const [locationsEntry] = catalog.entries(CatalogKind.Locations);
    const locations = locationsEntry ? parseLocations(cached(cache, locationsEntry, true)) : {};
    const abbreviations = mergeAbbreviations(
      catalog
        .entries(CatalogKind.Abbreviations)
        .map((entry) => cached(cache, entry, true))
        .filter((data) => data !== undefined),
    );
    return { locations, abbreviations };
  }, [cache, catalog]);
  setLocationOverrides(overrides.locations);
  setAbbreviationOverrides(overrides.abbreviations);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const fresh = await Catalog.load(fetchCatalogJson);
      // No index: offline, no catalog served, or an unreadable one. The cached
      // copy stays in use.
      if (!fresh.index || cancelled) return;
      // The picker lists the fresh index right away; the small files follow.
      const index = fresh.index;
      setCache((previous) => ({ ...previous, index }));

      const { autoUpdate: on, cache: before } = optionsRef.current;
      const { cache: next, updated } = await refreshCache(before, fresh, on);
      if (cancelled) return;
      setCache(next);
      saveCatalogCache(next);
      // Only a file the device already had and that really changed is news.
      if (updated.has(CatalogKind.Locations)) toast.success(m.toast_catalog_locations_updated());
      if (updated.has(CatalogKind.Abbreviations)) {
        toast.success(m.toast_catalog_abbreviations_updated());
      }

      await installDates(fresh, next);
    };

    // The catalog's dates file is the one thing it still installs by itself:
    // when the device has none, or when the file changed — unless the user
    // uploaded their own, which they undo in the footer.
    const installDates = async (fresh: Catalog, next: CatalogCache) => {
      const { sources: recorded, onDates: install, autoUpdate: on } = optionsRef.current;
      const entry = datesToInstall(recorded, fresh, on);
      if (!entry) return;
      const dates = parseDates(cached(next, entry) ?? (await fresh.json(entry.path)));
      if (cancelled || !dates) return;
      install(dates, entry, { quiet: recorded.dates === null });
    };

    void refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  return catalog;
}
