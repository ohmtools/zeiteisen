import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { requestPersistence } from "@/lib/persist";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import { Catalog, parseDates, type CatalogEntry } from "@/lib/primitives/catalog";
import type { SemesterDates } from "@/lib/primitives/meta";
import { DATES_KEY, loadDates, saveDates } from "@/lib/primitives/storage";
import { fetchCatalogJson } from "@/lib/catalog";

type Sources = {
  datesManual: boolean;
  markDates: (entry: CatalogEntry) => void;
  setDatesManual: (manual: boolean) => void;
};

// Owns `tt.dates.v1`. The app holds one dates file at a time: the catalog
// installs its own and keeps it current, unless the user uploaded theirs —
// `useCatalogDates` hands control back.
export function useSemesterDates(sources: Sources) {
  const [dates, setDates] = useState<SemesterDates | null>(loadDates);
  // Dates installed or uploaded in another tab.
  useStorageSync([DATES_KEY], () => setDates(loadDates()));

  // `false` when the browser refused the write: the dates still show until a
  // reload, and the caller records nothing about where they came from.
  // `persist` only for the user's own actions: the catalog installing its
  // dates on a first visit must not trigger Firefox's storage prompt.
  const apply = (next: SemesterDates, persist: boolean): boolean => {
    setDates(next);
    const saved = saveDates(next);
    if (saved && persist) requestPersistence();
    if (!saved) toast.error(m.upload_error_storage());
    return saved;
  };

  return {
    dates,
    manual: sources.datesManual,

    // A file the user picked by hand: theirs from now on. There is no panel
    // for it in the Data menu, so a refused file is a toast with zod's
    // details. `@/lib/upload` (and zod's locales) load on the first upload
    // only.
    upload: async (file: File) => {
      const { readDatesFile } = await import("@/lib/upload");
      const result = await readDatesFile(file);
      if ("error" in result) {
        const { error } = result;
        toast.error(`${error.file}: ${error.message}`, {
          description: error.details?.join(" · "),
        });
        return;
      }
      if (!apply(result.dates, true)) return;
      toast.success(m.upload_dates_loaded());
      sources.setDatesManual(true);
    },

    // What the catalog installs by itself: quiet on the first install, one
    // toast when it replaces dates that came from the catalog before.
    install: (next: SemesterDates, entry: CatalogEntry, options?: { quiet?: boolean }) => {
      if (!apply(next, false)) return;
      if (!options?.quiet) toast.success(m.toast_catalog_dates_updated());
      sources.markDates(entry);
    },

    // The footer's way back: take the catalog's dates again and let it keep
    // them current. It fetches on its own, because it may run long after the
    // catalog refresh of this page load.
    useCatalogDates: async () => {
      const entry = (await Catalog.load(fetchCatalogJson)).dates;
      const next = entry ? parseDates(await fetchCatalogJson(entry.path)) : null;
      if (!entry || !next) {
        toast.error(m.catalog_error_fetch({ file: entry?.path ?? "dates.json" }));
        return;
      }
      if (!apply(next, true)) return;
      toast.success(m.toast_catalog_dates_updated());
      sources.markDates(entry);
      sources.setDatesManual(false);
    },
  };
}
