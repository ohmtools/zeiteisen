import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import {
  cached,
  Catalog,
  CatalogKind,
  datesToInstall,
  emptyCatalogCache,
  mergeAbbreviations,
  parseDates,
  parseLocations,
  refreshCache,
  type CatalogCache,
  type CatalogEntry,
  type CatalogMode,
  type CatalogSources,
  type FetchJson,
} from "@/lib/primitives/catalog";
import type { Locations, SemesterDates } from "@/lib/primitives/meta";
import {
  loadCatalogCache,
  saveCatalogCache,
  type OwnAbbreviationsFile,
} from "@/lib/primitives/storage";
import { catalogFetcher } from "@/lib/catalog";
import { setAbbreviationOverrides, setLocationOverrides } from "@/lib/overrides";

type Options = {
  // The Data menu's "Catalog". `freeze`: the index is still read (the picker
  // lists need it), but nothing already on the device is refreshed. `ignore`:
  // nothing is read and none of the catalog's data is used.
  mode: CatalogMode;
  // The user's catalog URL, `null` = the built-in one.
  url: string | null;
  // Where the installed dates came from, and whether the user picked them.
  sources: CatalogSources;
  // Handed the catalog's dates file whenever it should be installed.
  onDates: (dates: SemesterDates, entry: CatalogEntry, options?: { quiet?: boolean }) => void;
  // The catalog was switched to `ignore` or another URL: the dates it
  // installed go with it.
  onDropDates: () => void;
  // The user's own files (`useOwnData`). Own locations are used instead of
  // the catalog's (still cached, never shown or announced); own abbreviations
  // are merged over the catalog's.
  own: { locations: Locations | null; abbreviations: OwnAbbreviationsFile[] };
};

// How often an open page asks the catalog again while it is visible, and how
// long a refresh counts as fresh when the page comes back into view. A tab or
// an installed app stays open for days; reading the index once per page load
// left it offering timetables the catalog had long replaced.
const REFRESH_EVERY = 5 * 60 * 1000;
const FRESH_FOR = 60 * 1000;

// Owns `tt.catalog.v1`: the optional read-only catalog of locations, subject
// abbreviations, global dates and ready-made timetables served as static JSON
// next to the app (or at the user's URL). Starts from the cached copy, then
// refreshes in the background: on every page load, every few minutes while
// the page is visible, when it becomes visible again or comes back online,
// when the mode or URL changes, and whenever `refresh` is called (the dialogs
// that offer catalog timetables do on opening). No catalog, a partial one or
// no network at all changes nothing about how the app works.
//
// Timetables are never pushed anywhere: they are offered in the picker and in
// the update dialog, and only a user's click ever copies one into a profile.
export function useCatalog({ mode, url, sources, onDates, onDropDates, own }: Options): {
  // `Catalog.empty` while ignored.
  catalog: Catalog;
  refresh: () => void;
  // Reads the current catalog, for the Data menu's "Use catalog dates".
  fetchJson: FetchJson;
} {
  const [cache, setCache] = useState<CatalogCache>(loadCatalogCache);
  const fetchJson = useMemo(() => catalogFetcher(url), [url]);
  // A refresh reads these when it gets there, not when it was started.
  const optionsRef = useRef({ mode, fetchJson, sources, onDates, onDropDates, own, cache });
  useEffect(() => {
    optionsRef.current = { mode, fetchJson, sources, onDates, onDropDates, own, cache };
  });
  // Set by the effect below; a no-op until it ran and after unmount.
  const startRef = useRef<(options?: { force?: boolean; restart?: boolean }) => void>(() => {});

  const ignored = mode === "ignore";
  const catalog = useMemo(
    () => (ignored ? Catalog.empty : new Catalog(cache.index, fetchJson)),
    [ignored, cache.index, fetchJson],
  );

  // Locations and abbreviations are the tables `buildings.ts` and
  // `subjects.ts` read. Derived from the cache during render, so the very
  // first render after a refresh already spells the new names out. Always the
  // newest copy the device has, even when the index now lists another hash
  // for it: the refresh replaces it once the download works, and until then
  // (a failed or broken download, freeze, the moment between the new index
  // and its files) the older copy beats no names and no links.
  // Own locations replace the catalog's; own abbreviations go over them,
  // later files winning.
  const overrides = useMemo(() => {
    const [locationsEntry] = catalog.entries(CatalogKind.Locations);
    const locations = own.locations
      ? parseLocations(own.locations)
      : locationsEntry
        ? parseLocations(cached(cache, locationsEntry, true))
        : {};
    const abbreviations = mergeAbbreviations([
      ...catalog
        .entries(CatalogKind.Abbreviations)
        .map((entry) => cached(cache, entry, true))
        .filter((data) => data !== undefined),
      ...own.abbreviations.map((file) => file.data),
    ]);
    return { locations, abbreviations };
  }, [cache, catalog, own.locations, own.abbreviations]);
  setLocationOverrides(overrides.locations);
  setAbbreviationOverrides(overrides.abbreviations);

  useEffect(() => {
    let cancelled = false;
    // One refresh at a time: a second one asked for meanwhile would only
    // download the same index again. A restart (mode or URL changed) drops
    // the running one instead: its result belongs to the old setting.
    let running = false;
    let generation = 0;
    let last = 0;

    const refresh = async (run: number) => {
      const stale = () => cancelled || run !== generation;
      const { fetchJson: read } = optionsRef.current;
      const fresh = await Catalog.load(read);
      // No index: offline, no catalog served, or an unreadable one. The cached
      // copy stays in use.
      if (!fresh.index || stale()) return;
      // The picker lists the fresh index right away; the small files follow.
      const index = fresh.index;
      setCache((previous) => ({ ...previous, index }));

      const { mode: current, cache: before } = optionsRef.current;
      const { cache: next, updated } = await refreshCache(before, fresh, current === "auto");
      if (stale()) return;
      setCache(next);
      saveCatalogCache(next);
      // Only a file the device already had and that really changed is news,
      // and only while it is in use: own locations hide the catalog's.
      const { own: mine } = optionsRef.current;
      if (updated.has(CatalogKind.Locations) && !mine.locations) {
        toast.success(m.toast_catalog_locations_updated());
      }
      if (updated.has(CatalogKind.Abbreviations)) {
        toast.success(m.toast_catalog_abbreviations_updated());
      }

      // The catalog's dates file is the one thing it installs by itself: when
      // the device has none, or (auto-update) when the file changed — unless
      // the user uploaded their own, which they undo in the Data menu.
      const { sources: recorded, onDates: install } = optionsRef.current;
      const entry = datesToInstall(recorded, fresh, current === "auto");
      if (!entry) return;
      const dates = parseDates(cached(next, entry) ?? (await fresh.json(entry.path)));
      if (stale() || !dates) return;
      install(dates, entry, { quiet: recorded.dates === null });
    };

    // `force` skips the "just refreshed" check, `restart` also the
    // one-at-a-time one. Nothing is read while the catalog is ignored. A
    // restart drops the running refresh even when switching to `ignore`:
    // its result would bring back the cache and the dates just dropped.
    const start = ({ force = false, restart = false } = {}) => {
      if (cancelled) return;
      if (restart) {
        generation++;
        running = false;
      }
      if (optionsRef.current.mode === "ignore" || running) return;
      if (!force && !restart && Date.now() - last < FRESH_FOR) return;
      running = true;
      last = Date.now();
      const run = generation;
      void refresh(run).finally(() => {
        if (run === generation) running = false;
      });
    };
    startRef.current = start;

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
      cancelled = true;
      startRef.current = () => {};
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // The first read of the page, and every change of mode or URL. Switching to
  // `ignore` or to another catalog drops what the device holds of the old
  // one: its cached files and the dates it installed (`freeze` is the mode
  // that keeps them). Own files are the user's and stay.
  const previous = useRef({ mode, url });
  useEffect(() => {
    const before = previous.current;
    previous.current = { mode, url };
    const ignoredNow = mode === "ignore" && before.mode !== "ignore";
    if (before.url !== url || ignoredNow) {
      setCache(emptyCatalogCache);
      saveCatalogCache(emptyCatalogCache);
      optionsRef.current.onDropDates();
    }
    startRef.current({ restart: true });
  }, [mode, url]);

  return { catalog, refresh: () => startRef.current({ force: true }), fetchJson };
}
