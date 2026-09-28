import { describe, expect, test } from "vitest";
import { profile, subject, timetable } from "./fixtures.test-util";
import {
  getBackupFile,
  loadActive,
  loadCatalogMode,
  loadCatalogUrl,
  loadBackup,
  loadCatalogCache,
  loadDates,
  loadOwnDegrees,
  loadOwnLocations,
  loadProfiles,
  loadSources,
  parseBackupFile,
  PROFILES_KEY,
  saveBackup,
  saveCatalogCache,
  saveActive,
  saveCatalogMode,
  saveCatalogUrl,
  saveDates,
  saveOwnDegrees,
  saveOwnLocations,
  saveProfiles,
  type KeyValueStore,
} from "./storage";
import { emptyCatalogCache } from "./catalog";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

test("profiles round trip, Subjects included", () => {
  const store = memory();
  const t = timetable("T", [subject("A"), subject("B", { group: { category: 2, index: 1 } })], {
    origin: { kind: "catalog", path: "T.json" },
    rejected: ["h"],
  });
  t.subjects = t.subjects.with(0, { enabled: false });
  const saved = [profile("P", [t])];

  expect(saveProfiles(saved, store)).toBe(true);
  const [loaded] = loadProfiles(store);
  expect(loaded.timetables[0].subjects.toJSON()).toEqual(t.subjects.toJSON());
  expect(loaded.timetables[0].subjects.hash()).toBe(t.subjects.hash());
  expect(loaded).toMatchObject({ name: "P", timetables: [{ origin: t.origin, rejected: ["h"] }] });
});

test("a broken profile or duplicate name is dropped alone", () => {
  const store = memory();
  saveProfiles([profile("P", [timetable("T", [subject("A")])]), profile("P", [])], store);
  const stored = JSON.parse(store.data.get(PROFILES_KEY)!);
  stored.push({
    name: "Bad",
    timetables: [{ name: "T", subjects: { subjects: [], extra: [{}] } }],
  });
  stored.push({ name: "Q", timetables: [] });
  store.data.set(PROFILES_KEY, JSON.stringify(stored));

  expect(loadProfiles(store).map((p) => [p.name, p.timetables.length])).toEqual([
    ["P", 1],
    ["Q", 0],
  ]);
});

test("names differing only in case count as duplicates on load", () => {
  const store = memory();
  saveProfiles(
    [
      profile("Plan", [timetable("BEI3", []), timetable("bei3", [subject("A")])]),
      profile("PLAN", []),
    ],
    store,
  );
  expect(loadProfiles(store).map((p) => [p.name, p.timetables.map((t) => t.name)])).toEqual([
    ["Plan", ["BEI3"]],
  ]);
});

test("unreadable storage reads as empty", () => {
  const store = memory();
  store.data.set(PROFILES_KEY, "{not json");
  expect(loadProfiles(store)).toEqual([]);
  expect(loadProfiles(null)).toEqual([]);
  expect(loadDates(store)).toBeNull();
  expect(loadCatalogCache(store)).toEqual(emptyCatalogCache);
  const throwing: KeyValueStore = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
  expect(loadProfiles(throwing)).toEqual([]);
  expect(saveActive("P", throwing)).toBe(false);
  expect(loadCatalogMode(throwing)).toBe("auto");
});

test("active profile, catalog mode and URL", () => {
  const store = memory();
  expect(loadActive(store)).toBeNull();
  saveActive("P", store);
  expect(loadActive(store)).toBe("P");
  expect(loadCatalogMode(store)).toBe("auto");
  saveCatalogMode("ignore", store);
  expect(loadCatalogMode(store)).toBe("ignore");
  store.data.set("tt.catalogmode.v1", JSON.stringify("sometimes"));
  expect(loadCatalogMode(store)).toBe("auto");
  expect(loadCatalogUrl(store)).toBeNull();
  saveCatalogUrl("https://example.org/catalog/", store);
  expect(loadCatalogUrl(store)).toBe("https://example.org/catalog/");
  store.data.set("tt.catalogurl.v1", JSON.stringify("javascript:alert(1)"));
  expect(loadCatalogUrl(store)).toBeNull();
  saveCatalogUrl(null, store);
  expect(loadCatalogUrl(store)).toBeNull();
});

test("saving null dates removes them", () => {
  const store = memory();
  saveDates(
    { year: 2025, lectureStart: "2025-10-01", lectureEnd: "2026-01-31", events: [] },
    store,
  );
  saveDates(null, store);
  expect(loadDates(store)).toBeNull();
});

test("own locations and degrees: saved, cleared, broken reads as none", () => {
  const store = memory();
  expect(loadOwnLocations(store)).toBeNull();
  expect(loadOwnDegrees(store)).toEqual([]);
  const locations = { locations: [{ code: "WE", name: "Wassertorstraße" }] };
  const degrees = [
    {
      name: "a",
      data: {
        subjects: [
          {
            code: "M1",
            name: { de: "Mathe 1", en: "Maths 1" },
            sws: { lecture: 2, exercise: 1, laboratory: 0 },
            lp: 5,
            description: { de: "d", en: "d" },
            test: { de: "t", en: "t" },
          },
        ],
      },
    },
    {
      name: "b",
      data: {
        subjects: [
          {
            code: "PH",
            name: { de: "Physik", en: "Physics" },
            sws: { lecture: 2, exercise: 1, laboratory: 0 },
            lp: 5,
            description: { de: "d", en: "d" },
            test: { de: "t", en: "t" },
          },
        ],
      },
    },
  ];
  expect(saveOwnLocations(locations, store)).toBe(true);
  expect(saveOwnDegrees(degrees, store)).toBe(true);
  expect(loadOwnLocations(store)).toEqual(locations);
  expect(loadOwnDegrees(store)).toEqual(degrees);
  saveOwnLocations(null, store);
  expect(loadOwnLocations(store)).toBeNull();
  store.data.set("tt.degrees.v1", JSON.stringify([degrees[0], degrees[0]]));
  expect(loadOwnDegrees(store)).toEqual([]);
  store.data.set("tt.degrees.v1", JSON.stringify([{ name: "a", data: { subjects: [{}] } }]));
  expect(loadOwnDegrees(store)).toEqual([]);
  for (const name of ["", "a/b", "CON", "a:b", "a."]) {
    store.data.set("tt.degrees.v1", JSON.stringify([{ ...degrees[0], name }]));
    expect(loadOwnDegrees(store)).toEqual([]);
  }
});

describe("backup", () => {
  const dates = { year: 2025, lectureStart: "2025-10-01", lectureEnd: "2026-01-31", events: [] };
  const locations = { locations: [{ code: "WE", name: "Wassertorstraße" }] };
  const degrees = [
    {
      name: "a",
      data: {
        subjects: [
          {
            code: "M1",
            name: { de: "Mathe 1", en: "Maths 1" },
            sws: { lecture: 2, exercise: 1, laboratory: 0 },
            lp: 5,
            description: { de: "d", en: "d" },
            test: { de: "t", en: "t" },
          },
        ],
      },
    },
  ];
  const url = "https://example.org/catalog/";

  function filled() {
    const store = memory();
    const t = timetable("T", [subject("A"), subject("B")], {
      origin: { kind: "catalog", path: "T.json" },
      rejected: ["h"],
    });
    t.subjects = t.subjects.with(1, { enabled: false });
    saveProfiles([{ ...profile("P", [t]), locked: true }, profile("Q", [])], store);
    saveActive("Q", store);
    saveDates(dates, store);
    saveOwnLocations(locations, store);
    saveOwnDegrees(degrees, store);
    saveCatalogMode("freeze", store);
    saveCatalogUrl(url, store);
    saveCatalogCache(emptyCatalogCache, store);
    return store;
  }

  test("round trips through JSON, locked, rejected and selection included", () => {
    const file = JSON.parse(JSON.stringify(getBackupFile(loadBackup(filled()))));
    const backup = parseBackupFile(file);
    expect(backup).not.toBeNull();
    const target = memory();
    expect(saveBackup(backup!, target)).toBe(true);
    const [p, q] = loadProfiles(target);
    expect(p).toMatchObject({ name: "P", locked: true, timetables: [{ rejected: ["h"] }] });
    expect(p.timetables[0].subjects.map((_, extra) => extra.enabled)).toEqual([true, false]);
    expect(q.name).toBe("Q");
    expect(loadActive(target)).toBe("Q");
    expect(loadDates(target)).toEqual(dates);
    expect(loadOwnLocations(target)).toEqual(locations);
    expect(loadOwnDegrees(target)).toEqual(degrees);
    expect(loadCatalogMode(target)).toBe("freeze");
    expect(loadCatalogUrl(target)).toBe(url);
    expect(loadSources(target)).toEqual(loadSources(filled()));
  });

  test("leaves the catalog cache out and untouched", () => {
    const file = getBackupFile(loadBackup(filled()));
    expect(Object.keys(file).sort()).toEqual(
      [
        "active",
        "catalogMode",
        "catalogUrl",
        "dates",
        "locations",
        "profiles",
        "sources",
        "degrees",
        "v",
      ].sort(),
    );
    const target = memory();
    target.setItem("tt.catalog.v1", "keep");
    saveBackup(parseBackupFile(file)!, target);
    expect(target.getItem("tt.catalog.v1")).toBe("keep");
  });

  test("restoring no dates clears the dates", () => {
    const target = filled();
    saveBackup({ ...loadBackup(target), dates: null }, target);
    expect(loadDates(target)).toBeNull();
  });

  test("an older backup restores own files, catalog mode and URL as the defaults", () => {
    const target = filled();
    const {
      locations: _,
      degrees: __,
      catalogMode: ___,
      catalogUrl: ____,
      ...older
    } = JSON.parse(JSON.stringify(getBackupFile(loadBackup(filled()))));
    saveBackup(parseBackupFile(older)!, target);
    expect(loadOwnLocations(target)).toBeNull();
    expect(loadOwnDegrees(target)).toEqual([]);
    expect(loadCatalogMode(target)).toBe("auto");
    expect(loadCatalogUrl(target)).toBeNull();
  });

  test("refuses a broken file whole", () => {
    const good = JSON.parse(JSON.stringify(getBackupFile(loadBackup(filled()))));
    expect(parseBackupFile(null)).toBeNull();
    expect(parseBackupFile([])).toBeNull();
    expect(parseBackupFile({ ...good, v: 2 })).toBeNull();
    // One broken profile, not dropped alone as `loadProfiles` would.
    expect(parseBackupFile({ ...good, profiles: [...good.profiles, { name: "" }] })).toBeNull();
    // Repeated profile or timetable names.
    expect(parseBackupFile({ ...good, profiles: [good.profiles[0], good.profiles[0]] })).toBeNull();
    const [p] = good.profiles;
    const twice = { ...p, timetables: [p.timetables[0], p.timetables[0]] };
    expect(parseBackupFile({ ...good, profiles: [twice] })).toBeNull();
    // The same names in another case.
    const lower = { ...p, name: p.name.toLowerCase() };
    expect(parseBackupFile({ ...good, profiles: [p, lower] })).toBeNull();
    const cased = { ...p.timetables[0], name: p.timetables[0].name.toLowerCase() };
    const casedTwice = { ...p, timetables: [p.timetables[0], cased] };
    expect(parseBackupFile({ ...good, profiles: [casedTwice] })).toBeNull();
    expect(parseBackupFile({ ...good, dates: { year: "x" } })).toBeNull();
    expect(parseBackupFile({ ...good, locations: { locations: [{ code: "" }] } })).toBeNull();
  });
});
