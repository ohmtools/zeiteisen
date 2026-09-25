import type { CatalogLocation, Localized } from "@/lib/primitives/meta";

// The catalog's locations.json and abbreviations/*.json (or the user's own file
// of that kind, in place of the catalog's) only ever extend the
// tables built into `buildings.ts` and `subjects.ts`. They are module state
// instead of props because every lookup happens deep inside render helpers
// (`subjectName`, `buildingLinks`) that are called from many places; the
// catalog hook sets them once and re-renders the app afterwards.

let locations: Record<string, CatalogLocation> = {};
let abbreviations: Record<string, Localized> = {};

export function setLocationOverrides(next: Record<string, CatalogLocation>) {
  locations = next;
}

export function locationOverride(code: string): CatalogLocation | undefined {
  return locations[code.toUpperCase()];
}

export function setAbbreviationOverrides(next: Record<string, Localized>) {
  abbreviations = next;
}

export function abbreviationOverride(code: string): Localized | undefined {
  return abbreviations[code.toUpperCase()];
}

// Every subject shortcut the catalog spells out: the subject editor suggests
// them as names.
export function abbreviationCodes(): string[] {
  return Object.keys(abbreviations);
}
