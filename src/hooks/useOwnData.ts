import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { requestPersistence } from "@/lib/persist";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import type { Locations } from "@/lib/primitives/meta";
import {
  ABBREVIATIONS_KEY,
  loadOwnAbbreviations,
  loadOwnLocations,
  LOCATIONS_KEY,
  saveOwnAbbreviations,
  saveOwnLocations,
  type OwnAbbreviationsFile,
} from "@/lib/primitives/storage";

// Owns `tt.locations.v1` and `tt.abbreviations.v1`: the user's own locations
// file, used INSTEAD of the catalog's, and their own abbreviations files,
// merged OVER the catalog's (`useCatalog`). No catalog update ever reaches
// them. The catalog's copies stay cached, so handing back is instant.
export function useOwnData() {
  const [locations, setLocations] = useState<Locations | null>(loadOwnLocations);
  const [abbreviations, setAbbreviations] = useState<OwnAbbreviationsFile[]>(loadOwnAbbreviations);
  // Loaded or handed back in another tab.
  useStorageSync([LOCATIONS_KEY, ABBREVIATIONS_KEY], () => {
    setLocations(loadOwnLocations());
    setAbbreviations(loadOwnAbbreviations());
  });

  // `false` when the browser refused the write: the file still applies until
  // a reload.
  const saved = (ok: boolean): boolean => {
    if (!ok) toast.error(m.upload_error_storage());
    return ok;
  };

  return {
    locations,
    abbreviations,

    // `@/lib/upload` (and zod's locales) load on the first upload only.
    uploadLocations: async (file: File) => {
      const { readLocationsFile, toastUploadError } = await import("@/lib/upload");
      const result = await readLocationsFile(file);
      if ("error" in result) return toastUploadError(result.error);
      setLocations(result.data);
      if (!saved(saveOwnLocations(result.data))) return;
      requestPersistence();
      toast.success(m.upload_locations_loaded(), { description: m.upload_own_no_updates() });
    },
    // Several files at once; each is added under its file name, and one with a
    // name already held replaces it and moves last, so the newest upload wins.
    uploadAbbreviations: async (files: File[]) => {
      const { readAbbreviationsFile, toastUploadError } = await import("@/lib/upload");
      const read: OwnAbbreviationsFile[] = [];
      for (const file of files) {
        const result = await readAbbreviationsFile(file);
        if ("error" in result) toastUploadError(result.error);
        else read.push({ name: file.name, data: result.data });
      }
      if (read.length === 0) return;
      const names = new Set(read.map((file) => file.name));
      const next = [...loadOwnAbbreviations().filter((file) => !names.has(file.name)), ...read];
      setAbbreviations(next);
      if (!saved(saveOwnAbbreviations(next))) return;
      requestPersistence();
      toast.success(m.upload_abbreviations_loaded({ count: read.length }), {
        description: m.upload_abbreviations_precedence(),
      });
    },

    useCatalogLocations: () => {
      setLocations(null);
      if (saved(saveOwnLocations(null))) toast.success(m.toast_catalog_locations_again());
    },
    // By file name; every file gone hands abbreviations back to the catalog
    // alone.
    removeAbbreviations: (names: readonly string[]) => {
      const next = loadOwnAbbreviations().filter((file) => !names.includes(file.name));
      setAbbreviations(next);
      if (!saved(saveOwnAbbreviations(next))) return;
      toast.success(
        next.length === 0
          ? m.toast_own_abbreviations_removed()
          : m.toast_own_abbreviation_file_removed({ file: names.join(", ") }),
      );
    },
  };
}
