import {
  cached,
  Catalog,
  CatalogKind,
  degreeProgramOf,
  parseDegree,
  parseLocations,
  type CatalogCache,
} from "./catalog";
import type { CatalogLocation, Locations, SubjectInformation } from "./meta";
import type { OwnDegreeFile } from "./storage";
import type { DegreeProgram } from "./subject";

// The catalog's locations.json and degrees/*.degree (or the user's own files
// of that kind, in place of the catalog's) as lookup tables: building code
// (upper case) -> location; per degree file (its name without `.degree`, a
// subject's `degreeProgram`) its own table, never merged across files.
// A plain value handed to every lookup, never module state: the React Compiler
// caches a lookup by its arguments, so a table it cannot see would keep stale
// names on screen.

// Subject code (upper case) -> entry, one degree file.
export type DegreeTable = Record<string, SubjectInformation>;

export type Overrides = {
  locations: Record<string, CatalogLocation>;
  degrees: Record<DegreeProgram, DegreeTable>;
};

export const noOverrides: Overrides = { locations: {}, degrees: {} };

// The tables from the cached catalog files and the user's own. Always the
// newest copy the device has (`cached` allowing stale), even when the index
// now lists another hash: an older copy beats no names and no links. Own
// locations replace the catalog's; an own degree file replaces the catalog
// file of the same name.
export function overridesOf(
  catalog: Catalog,
  cache: CatalogCache,
  own: { locations: Locations | null; degrees: readonly OwnDegreeFile[] },
): Overrides {
  const [locationsEntry] = catalog.entries(CatalogKind.Locations);
  const locations = own.locations
    ? parseLocations(own.locations)
    : locationsEntry
      ? parseLocations(cached(cache, locationsEntry, true))
      : {};
  const degrees: Overrides["degrees"] = {};
  for (const entry of catalog.entries(CatalogKind.Degrees)) {
    const table = parseDegree(cached(cache, entry, true));
    const program = degreeProgramOf(entry);
    if (table && program) degrees[program] = table;
  }
  for (const file of own.degrees) {
    const table = parseDegree(file.data);
    if (table) degrees[file.name] = table;
  }
  return { locations, degrees };
}

// The one table a subject looks into: the file its `degreeProgram` names.
// Without one, or with that file not on the device, it has none and shows its
// code.
export function degreeTableOf(
  degreeProgram: DegreeProgram | undefined,
  tables: Overrides["degrees"],
): DegreeTable | undefined {
  return degreeProgram ? tables[degreeProgram] : undefined;
}

// The entry of exactly this code, any case.
export function infoEntry(code: string, table: DegreeTable): SubjectInformation | undefined {
  return table[code.toUpperCase()];
}

// Some codes carry a variant behind a slash ("TEG/B" -> ["TEG", "B"]). Only a
// fallback: keys like "CSEC1/1" contain a slash themselves, so the whole code
// is looked up first. `null` without a slash, or with nothing on either side.
export function splitVariant(code: string): [head: string, variant: string] | null {
  const cut = code.lastIndexOf("/");
  return cut > 0 && cut < code.length - 1 ? [code.slice(0, cut), code.slice(cut + 1)] : null;
}

// The degree file entry of a subject; a variant falls back to the entry of the
// part in front of it.
export function subjectInfoOf(
  name: string,
  degreeProgram: DegreeProgram | undefined,
  tables: Overrides["degrees"],
): SubjectInformation | undefined {
  const table = degreeTableOf(degreeProgram, tables);
  return table && infoIn(name, table);
}

function infoIn(code: string, table: DegreeTable): SubjectInformation | undefined {
  const entry = infoEntry(code, table);
  if (entry) return entry;
  const split = splitVariant(code);
  return split ? infoIn(split[0], table) : undefined;
}

// The university spells a room as "<building>.<room>" ("WE.105"). The building
// code maps to a street address on Google Maps and to the page of that site on
// the university's web site; the table lives in the catalog (or the user's own
// file), so a new or renamed building is a catalog edit, not a release.
export type BuildingLinks = {
  name?: string;
  mapsUrl?: string;
  siteUrl?: string;
};

// "WE.105" -> the links of building WE; "Hörsaal B", "online" or an unknown
// building -> null.
export function buildingLinks(
  location: string,
  locations: Overrides["locations"],
): BuildingLinks | null {
  const match = /^\s*([A-Za-z]{2})\./.exec(location);
  if (!match) return null;
  const entry = locations[match[1].toUpperCase()];
  if (!entry) return null;
  return { name: entry.name, mapsUrl: entry.mapsUrl, siteUrl: entry.siteUrl };
}
