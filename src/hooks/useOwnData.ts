import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { requestPersistence } from "@/lib/persist";
import { toast } from "@/lib/toast";
import { loadUpload } from "@/lib/uploader";
import { m } from "@/i18n";
import { DEGREE_EXTENSION } from "@/lib/primitives/catalog";
import type { Locations } from "@/lib/primitives/meta";
import {
  DEGREES_KEY,
  loadOwnDegrees,
  loadOwnLocations,
  LOCATIONS_KEY,
  saveOwnDegrees,
  saveOwnLocations,
  type OwnDegreeFile,
} from "@/lib/primitives/storage";

// Owns `tt.locations.v1` and `tt.degrees.v1`: the user's own locations
// file, used INSTEAD of the catalog's, and their own degree files, each
// replacing the catalog file of the name the user gave it (`useCatalog`). No
// catalog update ever reaches them. The catalog's copies stay cached, so handing back is instant.
export function useOwnData() {
  const [locations, setLocations] = useState<Locations | null>(loadOwnLocations);
  const [degrees, setDegrees] = useState<OwnDegreeFile[]>(loadOwnDegrees);
  // Loaded or handed back in another tab.
  useStorageSync([LOCATIONS_KEY, DEGREES_KEY], () => {
    setLocations(loadOwnLocations());
    setDegrees(loadOwnDegrees());
  });

  // `false` when the browser refused the write: the file still applies until
  // a reload.
  const saved = (ok: boolean): boolean => {
    if (!ok) toast.error(m.upload_error_storage());
    return ok;
  };

  return {
    locations,
    degrees,

    // `@/lib/upload` (and zod's locales) load on the first upload only.
    uploadLocations: async (file: File) => {
      const upload = await loadUpload();
      if (!upload) return;
      const { readLocationsFile, toastUploadError } = upload;
      const result = await readLocationsFile(file);
      if ("error" in result) return toastUploadError(result.error);
      setLocations(result.data);
      if (!saved(saveOwnLocations(result.data))) return;
      requestPersistence();
      toast.success(m.upload_locations_loaded(), { description: m.upload_own_no_updates() });
    },
    // Several files at once, each checked; the broken ones are reported and
    // left out. Nothing is stored yet: the user first gives every file its
    // name (`addDegrees`), filled in here with its file name without
    // `.degree`.
    readDegrees: async (files: File[]): Promise<OwnDegreeFile[]> => {
      const upload = await loadUpload();
      if (!upload) return [];
      const { readDegreeFile, toastUploadError } = upload;
      const read: OwnDegreeFile[] = [];
      for (const file of files) {
        const result = await readDegreeFile(file);
        if ("error" in result) toastUploadError(result.error);
        else read.push({ name: withoutExtension(file.name), data: result.data });
      }
      return read;
    },
    // Each under its name; one with a name already held replaces it and
    // moves last.
    addDegrees: (files: readonly OwnDegreeFile[]) => {
      if (files.length === 0) return;
      const names = new Set(files.map((file) => file.name));
      const next = [...loadOwnDegrees().filter((file) => !names.has(file.name)), ...files];
      setDegrees(next);
      if (!saved(saveOwnDegrees(next))) return;
      requestPersistence();
      toast.success(m.upload_degrees_loaded({ count: files.length }), {
        description: m.upload_degrees_precedence(),
      });
    },

    // Not named `use…`: no hook (see `switchToCatalogDates`).
    switchToCatalogLocations: () => {
      setLocations(null);
      if (saved(saveOwnLocations(null))) toast.success(m.toast_catalog_locations_again());
    },
    // By name; every file gone hands degrees back to the catalog alone.
    removeDegrees: (names: readonly string[]) => {
      const next = loadOwnDegrees().filter((file) => !names.includes(file.name));
      setDegrees(next);
      if (!saved(saveOwnDegrees(next))) return;
      toast.success(
        next.length === 0
          ? m.toast_own_degrees_removed()
          : m.toast_own_degree_removed({ file: names.join(", ") }),
      );
    },
  };
}

// "B-EI.degree" -> "B-EI", the name a subject's `degreeProgram` gives.
function withoutExtension(file: string): string {
  return file.endsWith(DEGREE_EXTENSION) ? file.slice(0, -DEGREE_EXTENSION.length) : file;
}
