import { describe, expect, test } from "vitest";
import {
  Catalog,
  CatalogKind,
  datesToInstall,
  degreeProgramOf,
  emptyCatalogCache,
  emptySources,
  parseDegree,
  refreshCache,
  timetableNameOf,
} from "./catalog";
import { fakeCatalog, subject } from "./fixtures.test-util";
import { subjectsHash } from "./subject";

const bei3 = [subject("ELK1"), subject("M1")];

describe("Catalog", () => {
  test("load reads the index, a missing or unknown-version index lists nothing", async () => {
    const { catalog } = fakeCatalog({ "timetables/BEI3.json": bei3 });
    const loaded = await Catalog.load((path) => catalog.json(path === "index.json" ? "x" : path));
    expect(loaded.index).toBeNull();
    expect((await Catalog.load(async () => ({ version: 2, files: [] }))).index).toBeNull();
    const v1 = await Catalog.load(async () => catalog.index);
    expect(v1.timetables).toHaveLength(1);
  });

  test("names a timetable after its file, origin relative to timetables/", () => {
    const { catalog } = fakeCatalog({ "timetables/semester/BEI3.json": bei3 });
    const [entry] = catalog.timetables;
    expect(timetableNameOf(entry)).toBe("BEI3");
    expect(catalog.entryOf({ kind: "catalog", path: "semester/BEI3.json" })).toBe(entry);
    expect(catalog.entryOf({ kind: "local" })).toBeNull();
  });

  test("sources match by hash without downloading, load verifies the content", async () => {
    const hash = subjectsHash(bei3);
    const { catalog, fetched } = fakeCatalog(
      { "timetables/BEI3.json": bei3, "timetables/Stale.json": [subject("X")] },
      { "timetables/Stale.json": hash },
    );
    const sources = catalog.sources(hash);
    expect(sources.map((s) => s.name)).toEqual(["BEI3", "Stale"]);
    expect(fetched).toEqual([]);
    expect(await sources[0].load()).toEqual(bei3);
    // The index claims the hash, the file has other content.
    expect(await sources[1].load()).toBeNull();
  });

  test("subjects rejects broken files", async () => {
    const { catalog } = fakeCatalog({
      "timetables/Broken.json": [{ name: "no kind" }],
      "timetables/Old.json": { name: "Old", semester: {}, subjects: bei3 },
    });
    const [broken, old] = catalog.timetables;
    expect(await catalog.subjects(broken)).toBeNull();
    // The old `{ name, semester, subjects }` shape is no timetable file.
    expect(await catalog.subjects(old)).toBeNull();
  });
});

describe("refreshCache", () => {
  test("downloads small files only, reports changes, drops unlisted paths", async () => {
    const { catalog, fetched } = fakeCatalog({
      "locations.json": { locations: [] },
      "degrees/bei.degree": { subjects: [] },
      "timetables/BEI3.json": bei3,
    });
    const first = await refreshCache(
      { ...emptyCatalogCache, files: { "gone.json": { hash: "x", data: 1 } } },
      catalog,
    );
    expect(Object.keys(first.cache.files).sort()).toEqual(["degrees/bei.degree", "locations.json"]);
    expect(fetched).not.toContain("timetables/BEI3.json");
    expect(first.updated.size).toBe(0);

    const stale = {
      ...first.cache,
      files: { ...first.cache.files, "locations.json": { hash: "old", data: {} } },
    };
    expect([...(await refreshCache(stale, catalog)).updated]).toEqual(["locations"]);
    // Auto-update off: the stale copy stays.
    const kept = await refreshCache(stale, catalog, false);
    expect(kept.cache.files["locations.json"].hash).toBe("old");
  });
});

const info = (code: string, de: string, en: string) => ({
  code,
  name: { de, en },
  sws: { lecture: 2, exercise: 1, laboratory: 0 },
  lp: 5,
  description: { de: "d", en: "d" },
  test: { de: "t", en: "t" },
});

test("parseDegree: one file, codes upper case, broken is null", () => {
  expect(parseDegree({ subjects: [info("m1", "Mathe", "Maths")] })).toEqual({
    M1: info("m1", "Mathe", "Maths"),
  });
  expect(parseDegree("broken")).toBeNull();
});

test("degreeProgramOf: file name in the flat degrees/ without .degree", () => {
  const of = (path: string) => degreeProgramOf({ path, kind: CatalogKind.Degrees, hash: "h" });
  expect(of("degrees/B-EI.degree")).toBe("B-EI");
  expect(of("degrees/ee/B-EI.degree")).toBeNull();
  expect(of("degrees/B-EI.json")).toBeNull();
  expect(of("degrees/.degree")).toBeNull();
  expect(of("other/B-EI.degree")).toBeNull();
});

test("datesToInstall", () => {
  const { catalog } = fakeCatalog({ "dates.json": {} });
  const installed = { path: "dates.json", hash: "h-dates.json" };
  expect(datesToInstall(emptySources, catalog)?.path).toBe("dates.json");
  expect(datesToInstall({ dates: installed, datesManual: false }, catalog)).toBeNull();
  expect(datesToInstall({ dates: null, datesManual: true }, catalog)).toBeNull();
  const old = { dates: { path: "dates.json", hash: "old" }, datesManual: false };
  expect(datesToInstall(old, catalog)?.path).toBe("dates.json");
  expect(datesToInstall(old, catalog, false)).toBeNull();
  expect(datesToInstall(emptySources, Catalog.empty)).toBeNull();
});
