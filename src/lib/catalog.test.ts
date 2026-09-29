import { expect, test } from "vitest";
import { catalogDatesNews, catalogNews } from "@/lib/catalog";
import { emptyCatalogCache, refreshCache, type CatalogSources } from "@/lib/primitives/catalog";
import { fakeCatalog } from "@/lib/primitives/fixtures.test-util";

const degree = { subjects: [] };
const locations = { locations: [] };
const none = { locations: null, degrees: [] };

test("a changed catalog degree file is news unless an own file replaces it", async () => {
  const { catalog } = fakeCatalog({ "degrees/B-A.degree": degree, "degrees/B-B.degree": degree });
  // B-A is on the device in an older version, B-B not at all.
  const before = {
    ...emptyCatalogCache,
    files: { "degrees/B-A.degree": { hash: "old", data: degree } },
  };
  const { cache: after } = await refreshCache(before, catalog);
  expect(catalogNews(before, after, none).degrees).toBe(true);
  const own = { locations: null, degrees: [{ name: "B-A", data: degree }] };
  expect(catalogNews(before, after, own).degrees).toBe(false);
  // A first download alone is no news.
  expect(catalogNews(emptyCatalogCache, after, none).degrees).toBe(false);
  // Nothing changed.
  expect(catalogNews(after, after, none).degrees).toBe(false);
});

test("a changed locations file is news unless own locations replace it", async () => {
  const { catalog } = fakeCatalog({ "locations.json": locations });
  const before = {
    ...emptyCatalogCache,
    files: { "locations.json": { hash: "old", data: locations } },
  };
  const { cache: after } = await refreshCache(before, catalog);
  expect(catalogNews(before, after, none)).toEqual({ locations: true, degrees: false });
  expect(catalogNews(before, after, { ...none, locations }).locations).toBe(false);
});

test("a failed download keeps the old copy: no news", async () => {
  const { catalog } = fakeCatalog({ "degrees/B-A.degree": undefined });
  const before = {
    ...emptyCatalogCache,
    files: { "degrees/B-A.degree": { hash: "old", data: degree } },
  };
  const { cache: after } = await refreshCache(before, catalog);
  expect(after.files["degrees/B-A.degree"].hash).toBe("old");
  expect(catalogNews(before, after, none).degrees).toBe(false);
});

test("a dropped cache is no news", async () => {
  const { catalog } = fakeCatalog({ "locations.json": locations, "degrees/B-A.degree": degree });
  const { cache: full } = await refreshCache(emptyCatalogCache, catalog);
  expect(catalogNews(full, emptyCatalogCache, none)).toEqual({ locations: false, degrees: false });
});

test("new catalog dates are news only when catalog dates were replaced", () => {
  const at = (hash: string | null, datesManual = false): CatalogSources => ({
    dates: hash === null ? null : { path: "dates.json", hash },
    datesManual,
  });
  expect(catalogDatesNews(at("a"), at("b"))).toBe(true);
  expect(catalogDatesNews(at("a"), at("a"))).toBe(false);
  // A first install and a removal.
  expect(catalogDatesNews(at(null), at("b"))).toBe(false);
  expect(catalogDatesNews(at("a"), at(null))).toBe(false);
  // The user switched from or to their own dates.
  expect(catalogDatesNews(at("a", true), at("b"))).toBe(false);
  expect(catalogDatesNews(at("a"), at("b", true))).toBe(false);
});
