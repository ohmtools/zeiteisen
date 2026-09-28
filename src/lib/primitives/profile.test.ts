import { describe, expect, it, test } from "vitest";
import { fakeCatalog, profile, subject, timetable } from "./fixtures.test-util";
import {
  addTimetables,
  duplicateName,
  duplicateProfile,
  editSubjects,
  getProfileFile,
  getSharedTimetables,
  isKnownSharedProfile,
  nameTaken,
  parseProfileFile,
  removeTimetable,
  renameTimetable,
  replaceTimetable,
  resolveSharedProfile,
  setEnabled,
  timetableByName,
  timetablesOutsideCatalog,
} from "./profile";

const a = subject("A");
const b = subject("B");

test("round trip keeps names, origins and the selection, the profile name as given", async () => {
  const one = timetable("One", [a, b], { origin: { kind: "catalog", path: "One.json" } });
  one.subjects = one.subjects.with(1, { enabled: false });
  const sender = profile("Me", [one, timetable("Two", [b])]);

  const { profile: got, unresolved } = await resolveSharedProfile(
    getSharedTimetables(sender),
    "Me",
    [sender],
  );
  expect(unresolved).toEqual([]);
  // Picked by the user, never made unique here.
  expect(got.name).toBe("Me");
  expect(got.timetables.map((t) => [t.name, t.origin.kind])).toEqual([
    ["One", "catalog"],
    ["Two", "local"],
  ]);
  expect(got.timetables[0].subjects.toCanonical().map((s, e) => [s.name, e.enabled])).toEqual(
    one.subjects.toCanonical().map((s, e) => [s.name, e.enabled]),
  );
});

test("same content under two names: always the first source, renamed when taken", async () => {
  const sender = profile("Me", [timetable("X", [a]), timetable("Y", [a])]);

  // Even though this device holds "Y" too, only the first source is used.
  const got = await resolveSharedProfile(getSharedTimetables(sender), "New", [sender]);
  expect(got.profile.timetables.map((t) => t.name)).toEqual(["X", "X 2"]);
});

test("a profile's copy wins over the catalog", async () => {
  const { catalog, fetched } = fakeCatalog({ "timetables/Cat.json": [a] });
  const shared = getSharedTimetables(profile("Me", [timetable("X", [a])]));
  const got = await resolveSharedProfile(
    shared,
    "New",
    [profile("P", [timetable("Mine", [a])])],
    catalog,
  );
  expect(got.profile.timetables.map((t) => t.name)).toEqual(["Mine"]);
  expect(fetched).toEqual([]);
});

test("falls back to the catalog, reports what nothing holds or a cut-off link", async () => {
  const { catalog } = fakeCatalog({ "timetables/Cat.json": [b] });
  const shared = getSharedTimetables(
    profile("Me", [timetable("Local", [b]), timetable("Gone", [a]), timetable("Cut", [a, b])]),
  );
  shared[2] = { ...shared[2], subjects: "" };
  const cutHash = shared[2].hash;

  const { profile: got, unresolved } = await resolveSharedProfile(
    shared,
    "New",
    [profile("Q", [timetable("Cut", [a, b])])],
    catalog,
  );
  expect(got.timetables.map((t) => [t.name, t.origin])).toEqual([
    ["Cat", { kind: "catalog", path: "Cat.json" }],
  ]);
  expect(unresolved.map((t) => t.hash)).toEqual([shared[1].hash, cutHash]);
});

describe("profile file", () => {
  const one = timetable("One", [a, b], {
    origin: { kind: "catalog", path: "One.json" },
    rejected: ["h"],
  });
  one.subjects = one.subjects.with(1, { enabled: false });
  const me = { ...profile("Me", [one, timetable("Two", [b])]), locked: true };

  // What a download writes and an upload reads back.
  const file = () => JSON.parse(JSON.stringify(getProfileFile(me))) as unknown;

  test("holds full timetables, no name, no locked, no rejected", () => {
    expect(file()).toEqual([
      { name: "One", origin: one.origin, subjects: one.subjects.toJSON() },
      { name: "Two", origin: { kind: "local" }, subjects: me.timetables[1].subjects.toJSON() },
    ]);
  });

  test("round trip: named after the file, unlocked, nothing rejected", () => {
    const got = parseProfileFile(file(), "Me.profile", [])!;
    expect(got).toMatchObject({ name: "Me", locked: false });
    expect(got.timetables.map((t) => [t.name, t.origin, t.rejected])).toEqual([
      ["One", one.origin, []],
      ["Two", { kind: "local" }, []],
    ]);
    expect(got.timetables[0].subjects.toJSON()).toEqual(one.subjects.toJSON());
  });

  test("taken names become Name 2, broken files and empty names give null", () => {
    expect(parseProfileFile(file(), "dir/Me.profile", [me])?.name).toBe("Me 2");
    const twice = [...getProfileFile(me), getProfileFile(me)[0]];
    const got = parseProfileFile(JSON.parse(JSON.stringify(twice)), "P.profile", []);
    expect(got?.timetables.map((t) => t.name)).toEqual(["One", "Two", "One 2"]);
    expect(parseProfileFile([{ name: "X" }], "P.profile", [])).toBeNull();
    expect(parseProfileFile({ timetables: file() }, "P.profile", [])).toBeNull();
    // What an empty profile downloads as.
    expect(parseProfileFile([], "P.profile", [])).toMatchObject({ name: "P", timetables: [] });
    expect(parseProfileFile(file(), ".profile", [])).toBeNull();
  });
});

describe("profile ops", () => {
  const bei3 = timetable("BEI3", [subject("M1"), subject("PH")], {
    origin: { kind: "catalog", path: "BEI3.json" },
    rejected: ["old"],
  });
  const simon = profile("Simon", [bei3]);

  test("addTimetables copies content and origin, a taken name becomes Name 2", () => {
    const source = { name: "BEI3", origin: bei3.origin, subjects: bei3.subjects };
    const next = addTimetables(simon, [source, source]);
    expect(next.timetables.map((t) => t.name)).toEqual(["BEI3", "BEI3 2", "BEI3 3"]);
    expect(next.timetables[1].origin).toEqual({ kind: "catalog", path: "BEI3.json" });
    expect(next.timetables[1].rejected).toEqual([]);
    expect(addTimetables(simon, [])).toBe(simon);
  });

  test("renameTimetable keeps origin, refusals and selection", () => {
    const next = renameTimetable(simon, "BEI3", " Mine ");
    const renamed = timetableByName(next, "Mine")!;
    expect(renamed.origin).toEqual(bei3.origin);
    expect(renamed.rejected).toEqual(["old"]);
    expect(renamed.subjects).toBe(bei3.subjects);
  });

  test("renameTimetable refuses an empty, unchanged or taken name", () => {
    const two = profile("Simon", [bei3, timetable("BEI4", [])]);
    expect(renameTimetable(two, "BEI3", " ")).toBe(two);
    expect(renameTimetable(two, "BEI3", "BEI3")).toBe(two);
    expect(renameTimetable(two, "BEI3", "BEI4")).toBe(two);
    expect(renameTimetable(two, "nope", "X")).toBe(two);
  });

  test("renameTimetable: another timetable's name in any case is taken, its own is not", () => {
    const two = profile("Simon", [bei3, timetable("BEI4", [])]);
    expect(renameTimetable(two, "BEI3", "bei4")).toBe(two);
    expect(renameTimetable(two, "BEI3", "bei3").timetables.map((t) => t.name)).toEqual([
      "bei3",
      "BEI4",
    ]);
    expect(renameTimetable(two, "BEI3", "Wahlfa\u0308cher").timetables[0].name).toBe(
      "Wahlf\u00e4cher",
    );
  });

  test("setEnabled switches only the given indexes", () => {
    const off = setEnabled(simon, "BEI3", [1], false);
    expect(off.timetables[0].subjects.map((_, extra) => extra.enabled)).toEqual([true, false]);
    expect(setEnabled(off, "BEI3", [0, 1], true).timetables[0].subjects.toExtra()).toEqual([
      { enabled: true },
      { enabled: true },
    ]);
    expect(setEnabled(simon, "nope", [0], false)).toBe(simon);
  });

  test("replaceTimetable and removeTimetable address by name", () => {
    const next = replaceTimetable(simon, "BEI3", { ...bei3, rejected: ["new"] });
    expect(next.timetables[0].rejected).toEqual(["new"]);
    expect(removeTimetable(simon, "BEI3").timetables).toEqual([]);
    expect(removeTimetable(simon, "nope")).toBe(simon);
  });

  test("nameTaken lets a profile keep its own name", () => {
    const profiles = [simon, profile("Anna", [])];
    expect(nameTaken(profiles, "Anna")).toBe(true);
    expect(nameTaken(profiles, "Simon", "Simon")).toBe(false);
    expect(nameTaken(profiles, "Bob")).toBe(false);
  });

  test("nameTaken ignores case, except for the profile's own name", () => {
    const profiles = [simon, profile("Anna", [])];
    expect(nameTaken(profiles, "anna")).toBe(true);
    expect(nameTaken(profiles, "ANNA", "Simon")).toBe(true);
    expect(nameTaken(profiles, "SIMON", "Simon")).toBe(false);
  });
});

describe("isKnownSharedProfile", () => {
  const first = timetable("BEI1", [a, b]);
  first.subjects = first.subjects.with(1, { enabled: false });
  const simon = profile("Simon", [first, timetable("BEI3", [subject("ET1")])]);
  const shared = getSharedTimetables(simon);

  test("knows a profile sharing the same timetables and selection, in any order", () => {
    const reordered = profile("Other name", [...simon.timetables].reverse());
    expect(isKnownSharedProfile(shared, [reordered])).toBe(true);
  });

  test("does not know another selection or another set of timetables", () => {
    const changed = profile("Simon", [
      { ...first, subjects: first.subjects.withAllExtra({ enabled: true }) },
      simon.timetables[1],
    ]);
    expect(isKnownSharedProfile(shared, [changed])).toBe(false);
    expect(isKnownSharedProfile(shared, [profile("Simon", [first])])).toBe(false);
  });
});

test("timetablesOutsideCatalog lists the timetables whose content the catalog does not carry", () => {
  const listed = [subject("M1")];
  const { catalog } = fakeCatalog({ "timetables/BEI3.json": listed });
  const mixed = profile("Mixed", [
    timetable("BEI3", listed, { origin: { kind: "catalog", path: "BEI3.json" } }),
    // Uploaded, but identical to a catalog file: the receiver gets it.
    timetable("Copy", listed),
    timetable("Mine", [subject("ET1")]),
    // Catalog-born, but the catalog moved on to another version.
    timetable("Old", [subject("PH")], { origin: { kind: "catalog", path: "BEI3.json" } }),
  ]);
  expect(timetablesOutsideCatalog(mixed, catalog).map((one) => one.name)).toEqual(["Mine", "Old"]);
});

test("editSubjects turns a catalog timetable local and forgets its refusals", () => {
  const held = timetable("BEI3", [subject("M1")], {
    origin: { kind: "catalog", path: "BEI3.json" },
    rejected: ["abcdefgh"],
  });
  const anna = profile("Anna", [held]);
  const next = timetableByName(editSubjects(anna, "BEI3", held.subjects.withRemoved(0)), "BEI3");
  expect(next?.origin).toEqual({ kind: "local" });
  expect(next?.rejected).toEqual([]);
  expect(next?.subjects.length).toBe(0);
  expect(editSubjects(anna, "Nope", held.subjects)).toBe(anna);
});

describe("duplicateProfile", () => {
  const bei3 = timetable("BEI3", [subject("M1"), subject("PH")], {
    origin: { kind: "catalog", path: "BEI3.json" },
    rejected: ["abcd1234"],
  });
  bei3.subjects = bei3.subjects.with(1, { enabled: false });
  const source = { ...profile("Plan A", [bei3]), locked: true };

  it("copies timetables, selection, origin and refusals, unlocked", () => {
    const copy = duplicateProfile(source, "Plan A 2");
    expect(copy.name).toBe("Plan A 2");
    expect(copy.locked).toBe(false);
    expect(copy.timetables).toHaveLength(1);
    const [held] = copy.timetables;
    expect(held.origin).toEqual({ kind: "catalog", path: "BEI3.json" });
    expect(held.rejected).toEqual(["abcd1234"]);
    expect(held.subjects.map((_, extra) => extra.enabled)).toEqual([true, false]);
    expect(held.subjects.hash()).toBe(bei3.subjects.hash());
  });

  it("leaves the source as it was", () => {
    duplicateProfile(source, "Copy");
    expect(source).toMatchObject({ name: "Plan A", locked: true });
  });

  it("suggests the next free name", () => {
    expect(duplicateName([source], source)).toBe("Plan A 2");
    expect(duplicateName([source, profile("Plan A 2", [])], source)).toBe("Plan A 3");
  });
});
