import { expect, test } from "vitest";
import { degreesUpdated } from "@/lib/catalog";
import { emptyCatalogCache, refreshCache } from "@/lib/primitives/catalog";
import { fakeCatalog } from "@/lib/primitives/fixtures.test-util";

const degree = { subjects: [] };

test("a changed catalog degree file is news unless an own file replaces it", async () => {
  const { catalog } = fakeCatalog({ "degrees/B-A.degree": degree, "degrees/B-B.degree": degree });
  // B-A is on the device in an older version, B-B not at all.
  const before = {
    ...emptyCatalogCache,
    files: { "degrees/B-A.degree": { hash: "old", data: degree } },
  };
  const { cache: after } = await refreshCache(before, catalog);
  expect(degreesUpdated(catalog, before, after, [])).toBe(true);
  expect(degreesUpdated(catalog, before, after, [{ name: "B-A", data: degree }])).toBe(false);
  // A first download alone is no news.
  expect(degreesUpdated(catalog, emptyCatalogCache, after, [])).toBe(false);
  // Nothing changed.
  expect(degreesUpdated(catalog, after, after, [])).toBe(false);
});

test("a failed download keeps the old copy: no news", async () => {
  const { catalog } = fakeCatalog({ "degrees/B-A.degree": undefined });
  const before = {
    ...emptyCatalogCache,
    files: { "degrees/B-A.degree": { hash: "old", data: degree } },
  };
  const { cache: after } = await refreshCache(before, catalog);
  expect(after.files["degrees/B-A.degree"].hash).toBe("old");
  expect(degreesUpdated(catalog, before, after, [])).toBe(false);
});
