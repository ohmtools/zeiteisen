import { describe, expect, it } from "vitest";
import { emptyCatalogCache, type CatalogCache } from "./catalog";
import { fakeCatalog } from "./fixtures.test-util";
import {
  buildingLinks,
  overridesOf,
  splitVariant,
  subjectInfoOf,
  type Overrides,
} from "./overrides";

const info = (code: string, en: string) => ({
  code,
  name: { de: en, en },
  sws: { lecture: 2, exercise: 0, laboratory: 0 },
  description: { de: "d", en: "d" },
  test: { de: "t", en: "t" },
});

// The same code means something else in each file: nothing is merged.
const tables: Overrides["degrees"] = {
  BEI: { M1: info("M1", "Maths 1"), TEG: info("TEG", "Electrical Engineering") },
  XYZ: { M1: info("M1", "Materials 1"), "CSEC1/1": info("CSEC1/1", "Security") },
};

describe("subjectInfoOf", () => {
  it("looks a subject up in the file its degreeProgram names only", () => {
    expect(subjectInfoOf("m1", "XYZ", tables)?.name.en).toBe("Materials 1");
    // Not in that file, even though another file knows it.
    expect(subjectInfoOf("CSEC1/1", "BEI", tables)).toBeUndefined();
    expect(subjectInfoOf("CSEC1/1", "XYZ", tables)?.code).toBe("CSEC1/1");
  });

  it("has nothing without a degreeProgram or its file", () => {
    expect(subjectInfoOf("M1", undefined, tables)).toBeUndefined();
    expect(subjectInfoOf("M1", "gone", tables)).toBeUndefined();
  });

  it("falls back from a variant to the part in front of it", () => {
    expect(subjectInfoOf("TEG/B", "BEI", tables)?.code).toBe("TEG");
    expect(subjectInfoOf("TEG/", "BEI", tables)).toBeUndefined();
  });
});

it("splitVariant needs something on both sides of the last slash", () => {
  expect(splitVariant("A/B/C")).toEqual(["A/B", "C"]);
  expect(splitVariant("TEG")).toBeNull();
  expect(splitVariant("/B")).toBeNull();
  expect(splitVariant("TEG/")).toBeNull();
});

it("buildingLinks reads the building code in front of the dot", () => {
  const locations = { WE: { code: "WE", name: "Wassertorstraße", mapsUrl: "https://maps" } };
  expect(buildingLinks(" we.105", locations)).toEqual({
    name: "Wassertorstraße",
    mapsUrl: "https://maps",
    siteUrl: undefined,
  });
  expect(buildingLinks("KA.001", locations)).toBeNull();
  expect(buildingLinks("online", locations)).toBeNull();
});

describe("overridesOf", () => {
  const { catalog } = fakeCatalog({
    "locations.json": {},
    "degrees/BEI.degree": {},
    "degrees/XYZ.degree": {},
    // Not flat: never a degree program.
    "degrees/ee/ABC.degree": {},
  });
  // Stale copies (other hash than the index) still count.
  const cache: CatalogCache = {
    index: catalog.index,
    files: {
      "locations.json": { hash: "old", data: { locations: [{ code: "we", name: "Catalog" }] } },
      "degrees/BEI.degree": { hash: "old", data: { subjects: [info("M1", "Maths 1")] } },
      "degrees/XYZ.degree": { hash: "h-degrees/XYZ.degree", data: { subjects: "broken" } },
      "degrees/ee/ABC.degree": { hash: "h-degrees/ee/ABC.degree", data: { subjects: [] } },
    },
  };

  it("keys each catalog file by its degreeProgram, drops broken ones", () => {
    const overrides = overridesOf(catalog, cache, { locations: null, degrees: [] });
    expect(overrides.locations.WE?.name).toBe("Catalog");
    expect(Object.keys(overrides.degrees)).toEqual(["BEI"]);
  });

  it("own files replace the catalog's, never merged", () => {
    const overrides = overridesOf(catalog, cache, {
      locations: { locations: [{ code: "KA", name: "Own" }] },
      degrees: [{ name: "BEI", data: { subjects: [info("PH", "Physics")] } }],
    });
    expect(Object.keys(overrides.locations)).toEqual(["KA"]);
    expect(Object.keys(overrides.degrees.BEI)).toEqual(["PH"]);
  });

  it("an empty catalog gives empty tables", () => {
    const { catalog: empty } = fakeCatalog({});
    expect(overridesOf(empty, emptyCatalogCache, { locations: null, degrees: [] })).toEqual({
      locations: {},
      degrees: {},
    });
  });
});
