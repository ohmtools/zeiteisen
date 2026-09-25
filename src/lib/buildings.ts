import { locationOverride } from "@/lib/overrides";

// The university spells a room as "<building>.<room>" ("WE.105"). The building
// shortcut maps to a street address on Google Maps and to the page of that site
// on the university's web site.
//
// The table itself lives in the catalog (`locations.json`), not in the app: a
// new or renamed building is a catalog edit, not a release. Without a catalog
// a room simply carries no links, exactly like an unknown shortcut always did.
export type BuildingLinks = {
  name?: string;
  mapsUrl?: string;
  siteUrl?: string;
};

// "WE.105" -> the links of building WE; "Hörsaal B" or "online" -> null.
export function buildingLinks(location: string): BuildingLinks | null {
  const match = /^\s*([A-Za-z]{2})\./.exec(location);
  if (!match) return null;
  const entry = locationOverride(match[1]);
  if (!entry) return null;
  return { name: entry.name, mapsUrl: entry.mapsUrl, siteUrl: entry.siteUrl };
}
