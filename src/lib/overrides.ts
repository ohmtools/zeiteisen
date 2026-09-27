import type { CatalogLocation, SubjectInformation } from "@/lib/primitives/meta";

// The catalog's locations.json and degreeinformation/*.json (or the user's own
// file of that kind, in place of / over the catalog's), as lookup tables:
// building code (upper case) -> location, subject code (upper case) -> entry.
// A plain value handed to every lookup (`subjectName`, `buildingLinks`), never
// module state: the React Compiler caches a lookup by its arguments, so a
// table it cannot see would keep stale names on screen.
export type Overrides = {
  locations: Record<string, CatalogLocation>;
  degreeInformation: Record<string, SubjectInformation>;
};

export const noOverrides: Overrides = { locations: {}, degreeInformation: {} };
