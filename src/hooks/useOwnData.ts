import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { requestPersistence } from "@/lib/persist";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import type { Locations } from "@/lib/primitives/meta";
import {
  DEGREEINFORMATION_KEY,
  loadOwnDegreeInformation,
  loadOwnLocations,
  LOCATIONS_KEY,
  saveOwnDegreeInformation,
  saveOwnLocations,
  type OwnDegreeInformationFile,
} from "@/lib/primitives/storage";

// Owns `tt.locations.v1` and `tt.degreeinformation.v1`: the user's own locations
// file, used INSTEAD of the catalog's, and their own degreeInformation files,
// merged OVER the catalog's (`useCatalog`). No catalog update ever reaches
// them. The catalog's copies stay cached, so handing back is instant.
export function useOwnData() {
  const [locations, setLocations] = useState<Locations | null>(loadOwnLocations);
  const [degreeInformation, setDegreeInformation] =
    useState<OwnDegreeInformationFile[]>(loadOwnDegreeInformation);
  // Loaded or handed back in another tab.
  useStorageSync([LOCATIONS_KEY, DEGREEINFORMATION_KEY], () => {
    setLocations(loadOwnLocations());
    setDegreeInformation(loadOwnDegreeInformation());
  });

  // `false` when the browser refused the write: the file still applies until
  // a reload.
  const saved = (ok: boolean): boolean => {
    if (!ok) toast.error(m.upload_error_storage());
    return ok;
  };

  return {
    locations,
    degreeInformation,

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
    uploadDegreeInformation: async (files: File[]) => {
      const { readDegreeInformationFile, toastUploadError } = await import("@/lib/upload");
      const read: OwnDegreeInformationFile[] = [];
      for (const file of files) {
        const result = await readDegreeInformationFile(file);
        if ("error" in result) toastUploadError(result.error);
        else read.push({ name: file.name, data: result.data });
      }
      if (read.length === 0) return;
      const names = new Set(read.map((file) => file.name));
      const next = [...loadOwnDegreeInformation().filter((file) => !names.has(file.name)), ...read];
      setDegreeInformation(next);
      if (!saved(saveOwnDegreeInformation(next))) return;
      requestPersistence();
      toast.success(m.upload_degreeinformation_loaded({ count: read.length }), {
        description: m.upload_degreeinformation_precedence(),
      });
    },

    useCatalogLocations: () => {
      setLocations(null);
      if (saved(saveOwnLocations(null))) toast.success(m.toast_catalog_locations_again());
    },
    // By file name; every file gone hands degreeInformation back to the catalog
    // alone.
    removeDegreeInformation: (names: readonly string[]) => {
      const next = loadOwnDegreeInformation().filter((file) => !names.includes(file.name));
      setDegreeInformation(next);
      if (!saved(saveOwnDegreeInformation(next))) return;
      toast.success(
        next.length === 0
          ? m.toast_own_degreeinformation_removed()
          : m.toast_own_degreeinformation_file_removed({ file: names.join(", ") }),
      );
    },
  };
}
