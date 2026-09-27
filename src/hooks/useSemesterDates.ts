import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { requestPersistence } from "@/lib/persist";
import { toast } from "@/lib/toast";
import { loadUpload } from "@/lib/uploader";
import { m } from "@/i18n";
import { Catalog, parseDates, type CatalogEntry, type FetchJson } from "@/lib/primitives/catalog";
import type { SemesterDates } from "@/lib/primitives/meta";
import { DATES_KEY, loadDates, saveDates } from "@/lib/primitives/storage";

type Sources = {
  datesManual: boolean;
  sources: { dates: unknown };
  markDates: (entry: CatalogEntry) => void;
  forgetDates: () => void;
  setDatesManual: (manual: boolean) => void;
};

// Owns `tt.dates.v1`. The app holds one dates file at a time: the catalog
// installs its own and keeps it current, unless the user uploaded theirs —
// `switchToCatalogDates` hands control back.
export function useSemesterDates(sources: Sources) {
  const [dates, setDates] = useState<SemesterDates | null>(loadDates);
  // Dates installed or uploaded in another tab.
  useStorageSync([DATES_KEY], () => setDates(loadDates()));

  // `false` when the browser refused the write: the dates still show until a
  // reload, and the caller records nothing about where they came from.
  // `persist` only for the user's own actions: the catalog installing its
  // dates on a first visit must not trigger Firefox's storage prompt.
  const apply = (next: SemesterDates | null, persist: boolean): boolean => {
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
      const upload = await loadUpload();
      if (!upload) return;
      const { readDatesFile, toastUploadError } = upload;
      const result = await readDatesFile(file);
      if ("error" in result) return toastUploadError(result.error);
      if (!apply(result.data, true)) return;
      toast.success(m.upload_dates_loaded(), { description: m.upload_own_no_updates() });
      sources.setDatesManual(true);
    },

    // What the catalog installs by itself: quiet on the first install, one
    // toast when it replaces dates that came from the catalog before.
    install: (next: SemesterDates, entry: CatalogEntry, options?: { quiet?: boolean }) => {
      if (!apply(next, false)) return;
      if (!options?.quiet) toast.success(m.toast_catalog_dates_updated());
      sources.markDates(entry);
    },

    // The catalog is ignored or another one was set: dates it installed go
    // with it. The user's own dates stay.
    // `quiet` when another catalog is about to install its own.
    removeCatalogDates: (options?: { quiet?: boolean }) => {
      if (sources.datesManual || sources.sources.dates === null) return;
      if (!apply(null, false)) return;
      sources.forgetDates();
      if (!options?.quiet) toast.success(m.toast_catalog_dates_removed());
    },

    // The Data menu's way back: take the catalog's dates again and let it
    // keep them current. It fetches on its own, because it may run long after
    // the last catalog refresh.
    // Not named `use…`: it is no hook, and the React Compiler would refuse
    // the component calling it from a callback.
    switchToCatalogDates: async (fetchJson: FetchJson) => {
      const entry = (await Catalog.load(fetchJson)).dates;
      const next = entry ? parseDates(await fetchJson(entry.path)) : null;
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
