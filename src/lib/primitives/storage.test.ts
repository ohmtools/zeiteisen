import { describe, expect, test } from "vitest";
import { profile, subject, timetable } from "./fixtures.test-util";
import {
  getBackupFile,
  loadActive,
  loadAutoUpdate,
  loadBackup,
  loadCatalogCache,
  loadDates,
  loadProfiles,
  loadSources,
  parseBackupFile,
  PROFILES_KEY,
  saveBackup,
  saveCatalogCache,
  saveActive,
  saveAutoUpdate,
  saveDates,
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
  expect(loadAutoUpdate(throwing)).toBe(true);
});

test("active profile and auto-update", () => {
  const store = memory();
  expect(loadActive(store)).toBeNull();
  saveActive("P", store);
  expect(loadActive(store)).toBe("P");
  expect(loadAutoUpdate(store)).toBe(true);
  saveAutoUpdate(false, store);
  expect(loadAutoUpdate(store)).toBe(false);
});

describe("backup", () => {
  const dates = { year: 2025, lectureStart: "2025-10-01", lectureEnd: "2026-01-31", events: [] };

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
    saveAutoUpdate(false, store);
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
    expect(loadAutoUpdate(target)).toBe(false);
    expect(loadSources(target)).toEqual(loadSources(filled()));
  });

  test("leaves the catalog cache out and untouched", () => {
    const file = getBackupFile(loadBackup(filled()));
    expect(Object.keys(file).sort()).toEqual(
      ["active", "autoUpdate", "dates", "profiles", "sources", "v"].sort(),
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
    expect(parseBackupFile({ ...good, dates: { year: "x" } })).toBeNull();
  });
});
