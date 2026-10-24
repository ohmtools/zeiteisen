import { useEffect, useMemo, useRef, useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import {
  cached,
  Catalog,
  datesToInstall,
  emptyCatalogCache,
  parseDates,
  refreshCache,
  type CatalogCache,
  type CatalogEntry,
  type CatalogMode,
  type CatalogSources,
  type FetchJson,
} from "@/lib/primitives/catalog";
import type { Locations, SemesterDates } from "@/lib/primitives/meta";
import {
  CATALOG_KEY,
  loadCatalogCache,
  saveCatalogCache,
  type OwnDegreeFile,
} from "@/lib/primitives/storage";
import { catalogFetcher, catalogNews } from "@/lib/catalog";
import {
  dropsCatalog,
  refreshScheduler,
  type CatalogSetting,
  type RefreshStart,
} from "@/lib/refresh";
import { overridesOf, type Overrides } from "@/lib/primitives/overrides";

type Options = {
  // The settings' catalog mode. `freeze`: the index is still read (the picker
  // lists need it), but nothing already on the device is refreshed. `ignore`:
  // nothing is read and none of the catalog's data is used.
  mode: CatalogMode;
  // The user's catalog URL, `null` = the built-in one.
  url: string | null;
  // Where the installed dates came from, and whether the user picked them.
  sources: CatalogSources;
  // Handed the catalog's dates file whenever it should be installed.
  onDates: (dates: SemesterDates, entry: CatalogEntry, options?: { quiet?: boolean }) => void;
  // The catalog is being switched to `next`, `ignore` or another URL: the
  // dates it installed go with it.
  onDropDates: (next: CatalogSetting) => void;
  // The user's own files (`useOwnData`). Own locations are used instead of
  // the catalog's (still cached, never shown or announced); an own degree
  // file replaces the catalog file of the same name.
  own: { locations: Locations | null; degrees: OwnDegreeFile[] };
};

// How often an open page asks the catalog again while it is visible, and how
// long a refresh counts as fresh when the page comes back into view. A tab or
// an installed app stays open for days; reading the index once per page load
// left it offering timetables the catalog had long replaced.
const REFRESH_EVERY = 5 * 60 * 1000;
const FRESH_FOR = 60 * 1000;

// What changed in a catalog file in use (`catalogNews`), said in a toast. Fixed
// ids: a tab that takes over another tab's copy while its own refresh brings
// the same change says it once.
function announce(news: { locations: boolean; degrees: boolean }) {
  if (news.locations) {
    toast.success(m.toast_catalog_locations_updated(), { id: "catalog-locations" });
  }
  if (news.degrees) {
    toast.success(m.toast_catalog_degrees_updated(), { id: "catalog-degrees" });
  }
}

// Owns `tt.catalog.v1`: the optional read-only catalog of locations, subject
// degrees, global dates and ready-made timetables served as static JSON
// next to the app (or at the user's URL). Starts from the cached copy, then
// refreshes in the background: on every page load, every few minutes while
// the page is visible, when it becomes visible again or comes back online,
// when the mode or URL changes, and whenever `refresh` is called (the dialogs
// that offer catalog timetables do on opening). No catalog, a partial one or
// no network at all changes nothing about how the app works. A copy another
// tab wrote is taken over at once and announced here too.
//
// Timetables are never pushed anywhere: they are offered in the picker and in
// the update dialog, and only a user's click ever copies one into a profile.
export function useCatalog({ mode, url, sources, onDates, onDropDates, own }: Options): {
  // `Catalog.empty` while ignored.
  catalog: Catalog;
  refresh: () => void;
  // Reads the current catalog, for the settings' "Use catalog dates".
  fetchJson: FetchJson;
  // Called right before the settings change mode or URL to `next`.
  dropFor: (next: CatalogSetting) => void;
  // The lookup tables of names and building links (`OverridesContext`).
  overrides: Overrides;
} {
  const [cache, setCache] = useState<CatalogCache>(loadCatalogCache);
  const fetchJson = useMemo(() => catalogFetcher(url), [url]);
  // A refresh reads these when it gets there, not when it was started.
  const optionsRef = useRef({ mode, fetchJson, sources, onDates, onDropDates, own, cache });
  useEffect(() => {
    optionsRef.current = { mode, fetchJson, sources, onDates, onDropDates, own, cache };
  });
  // Another tab refreshed (or dropped) the cache: show its copy right away,
  // say what changed as that tab did, and let this tab's next refresh start
  // from it instead of downloading the same files again or writing an older
  // copy back.
  useStorageSync([CATALOG_KEY], () => {
    const next = loadCatalogCache();
    const { cache: before, own: mine } = optionsRef.current;
    setCache(next);
    announce(catalogNews(before, next, mine));
  });
  // Set by the effect below; no-ops until it ran and after unmount.
  const startRef = useRef<RefreshStart>(() => {});
  const cancelRef = useRef(() => {});

  const ignored = mode === "ignore";
  const catalog = useMemo(
    () => (ignored ? Catalog.empty : new Catalog(cache.index, fetchJson)),
    [ignored, cache.index, fetchJson],
  );

  // The lookup tables of names and building links (`overridesOf`), derived
  // from the cache during render, so the very first render after a refresh
  // already spells the new names out.
  const overrides = useMemo(
    () => overridesOf(catalog, cache, { locations: own.locations, degrees: own.degrees }),
    [cache, catalog, own.locations, own.degrees],
  );

  useEffect(() => {
    // `stale()`: unmounted, or the mode or URL changed meanwhile.
    const refresh = async (stale: () => boolean) => {
      const { fetchJson: read } = optionsRef.current;
      const fresh = await Catalog.load(read);
      // No index: offline, no catalog served, or an unreadable one. The cached
      // copy stays in use.
      if (!fresh.index || stale()) return;
      // The picker lists the fresh index right away; the small files follow.
      const index = fresh.index;
      setCache((previous) => ({ ...previous, index }));

      const { mode: current, cache: before } = optionsRef.current;
      const { cache: next } = await refreshCache(before, fresh, current === "auto");
      if (stale()) return;
      setCache(next);
      saveCatalogCache(next);
      announce(catalogNews(before, next, optionsRef.current.own));

      // The catalog's dates file is the one thing it installs by itself: when
      // the device has none, or (auto-update) when the file changed — unless
      // the user uploaded their own, which they undo in the settings.
      const { sources: recorded, onDates: install } = optionsRef.current;
      const entry = datesToInstall(recorded, fresh, current === "auto");
      if (!entry) return;
      const dates = parseDates(cached(next, entry) ?? (await fresh.json(entry.path)));
      if (stale() || !dates) return;
      install(dates, entry, { quiet: recorded.dates === null });
    };

    // One at a time, not again within `FRESH_FOR` unless forced, a restart
    // drops the running one; nothing is read while the catalog is ignored.
    const scheduler = refreshScheduler({
      run: refresh,
      skip: () => optionsRef.current.mode === "ignore",
      freshFor: FRESH_FOR,
    });
    const start = scheduler.start;
    startRef.current = start;
    cancelRef.current = scheduler.cancel;

    const onVisible = () => {
      if (document.visibilityState === "visible") start();
    };
    const onOnline = () => start({ force: true });
    // A hidden page asks nobody; it catches up when it becomes visible.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") start();
    }, REFRESH_EVERY);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      scheduler.stop();
      startRef.current = () => {};
      cancelRef.current = () => {};
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // The first read of the page, and every change of mode or URL, whichever
  // tab made it.
  useEffect(() => {
    startRef.current({ restart: true });
  }, [mode, url]);

  // Switching to `ignore` or to another catalog drops what the device holds
  // of the old one: its cached files and the dates it installed (`freeze` is
  // the mode that keeps them). Own files are the user's and stay. Done once,
  // in the tab where the user switches, before the setting is written: the
  // other tabs take the empty cache and the removed dates over through
  // storage, then the setting, and must not drop what the new catalog has
  // brought meanwhile. The running refresh is dropped first, so the old
  // catalog's result cannot land after the drop.
  const dropFor = (next: CatalogSetting) => {
    if (!dropsCatalog({ mode, url }, next)) return;
    cancelRef.current();
    setCache(emptyCatalogCache);
    saveCatalogCache(emptyCatalogCache);
    onDropDates(next);
  };

  return {
    catalog,
    refresh: () => startRef.current({ force: true }),
    fetchJson,
    dropFor,
    overrides,
  };
}
