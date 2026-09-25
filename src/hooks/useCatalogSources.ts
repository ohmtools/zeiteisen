import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import type { CatalogEntry, CatalogSources } from "@/lib/primitives/catalog";
import {
  AUTO_UPDATE_KEY,
  loadAutoUpdate,
  loadSources,
  saveAutoUpdate,
  saveSources,
  SOURCES_KEY,
} from "@/lib/primitives/storage";

// Owns `tt.sources.v1` (where the global dates came from, and whether the user
// picked them by hand) and `tt.autoupdate.v1` (the footer switch). Timetables
// are not in here: every profile records the origin of its own timetables.
export function useCatalogSources() {
  const [sources, setSources] = useState<CatalogSources>(loadSources);
  const [autoUpdate, setAutoUpdateState] = useState<boolean>(loadAutoUpdate);
  // Changed in another tab: this one's next write would undo it otherwise.
  useStorageSync([SOURCES_KEY, AUTO_UPDATE_KEY], () => {
    setSources(loadSources());
    setAutoUpdateState(loadAutoUpdate());
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
    autoUpdate,
    setAutoUpdate: (on: boolean) => {
      setAutoUpdateState(on);
      saveAutoUpdate(on);
    },
    markDates: (entry: CatalogEntry) =>
      write((previous) => ({ ...previous, dates: { path: entry.path, hash: entry.hash } })),
    // A dates file the user picked by hand stops the catalog from installing
    // its own, until they ask for the catalog ones again.
    setDatesManual: (manual: boolean) =>
      write((previous) =>
        previous.datesManual === manual ? previous : { ...previous, datesManual: manual },
      ),
  };
}
