import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { m } from "@/i18n";
import { catalogDatesNews } from "@/lib/catalog";
import { toast } from "@/lib/toast";
import type { CatalogEntry, CatalogMode, CatalogSources } from "@/lib/primitives/catalog";
import {
  CATALOG_MODE_KEY,
  CATALOG_URL_KEY,
  loadCatalogMode,
  loadCatalogUrl,
  loadSources,
  saveCatalogMode,
  saveCatalogUrl,
  saveSources,
  SOURCES_KEY,
} from "@/lib/primitives/storage";

// Owns `tt.sources.v1` (where the global dates came from, and whether the user
// picked them by hand), `tt.catalogmode.v1` (the Data menu's "Catalog":
// ignore, auto-update, freeze) and `tt.catalogurl.v1` (the user's catalog
// URL). Timetables are not in here: every profile records the origin of its
// own timetables.
export function useCatalogSources() {
  const [sources, setSources] = useState<CatalogSources>(loadSources);
  const [mode, setModeState] = useState<CatalogMode>(loadCatalogMode);
  const [url, setUrlState] = useState<string | null>(loadCatalogUrl);
  // Changed in another tab: this one's next write would undo it otherwise.
  // New catalog dates installed there are said here too, as they were there
  // (`useSemesterDates` takes the dates themselves over).
  useStorageSync([SOURCES_KEY, CATALOG_MODE_KEY, CATALOG_URL_KEY], () => {
    const next = loadSources();
    if (catalogDatesNews(sources, next)) {
      toast.success(m.toast_catalog_dates_updated(), { id: "catalog-dates" });
    }
    setSources(next);
    setModeState(loadCatalogMode());
    setUrlState(loadCatalogUrl());
  });

  const write = (update: (previous: CatalogSources) => CatalogSources) => {
    setSources((previous) => {
      const next = update(previous);
      if (next !== previous) saveSources(next);
      return next;
    });
  };

  return {
    datesManual: sources.datesManual,
    sources,
    mode,
    setMode: (next: CatalogMode) => {
      setModeState(next);
      saveCatalogMode(next);
    },
    url,
    setUrl: (next: string | null) => {
      setUrlState(next);
      saveCatalogUrl(next);
    },
    markDates: (entry: CatalogEntry) =>
      write((previous) => ({ ...previous, dates: { path: entry.path, hash: entry.hash } })),
    // The catalog's dates were removed: the next catalog read installs its
    // dates as a first install again.
    forgetDates: () =>
      write((previous) => (previous.dates === null ? previous : { ...previous, dates: null })),
    // A dates file the user picked by hand stops the catalog from installing
    // its own, until they ask for the catalog ones again.
    setDatesManual: (manual: boolean) =>
      write((previous) =>
        previous.datesManual === manual ? previous : { ...previous, datesManual: manual },
      ),
  };
}
