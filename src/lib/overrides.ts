import type { CatalogLocation, SubjectInformation } from "@/lib/primitives/meta";

// The catalog's locations.json and degreeinformation/*.json (or the user's own file
// of that kind, in place of the catalog's) only ever extend the
// tables built into `buildings.ts` and `subjects.ts`. They are module state
// instead of props because every lookup happens deep inside render helpers
// (`subjectName`, `buildingLinks`) that are called from many places; the
// catalog hook sets them once and re-renders the app afterwards.

let locations: Record<string, CatalogLocation> = {};
let degreeInformation: Record<string, SubjectInformation> = {};

export function setLocationOverrides(next: Record<string, CatalogLocation>) {
  locations = next;
}

export function locationOverride(code: string): CatalogLocation | undefined {
  return locations[code.toUpperCase()];
}

export function setDegreeInformationOverrides(next: Record<string, SubjectInformation>) {
  degreeInformation = next;
}

// The full entry of a subject shortcut (name, hours, description, exam).
export function subjectInfo(code: string): SubjectInformation | undefined {
  return degreeInformation[code.toUpperCase()];
}

// Every subject shortcut the catalog spells out: the subject editor suggests
// them as names.
export function degreeInformationCodes(): string[] {
  return Object.keys(degreeInformation);
}
