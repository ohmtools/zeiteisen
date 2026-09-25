import { describe, expect, it } from "vitest";
import { fakeCatalog, profile, subject, timetable } from "@/lib/primitives/fixtures.test-util";
import { blockedRows, finalNames, libraryRows, loadRow, type LibraryRow } from "@/lib/library";

// One row per source, never merged. Identical content is found by hash:
// picking one row blocks its twins, and picked rows that would share a name
// in the profile become "Name 2".

const bei3 = [subject("M1"), subject("PH")];
const other = [subject("ET1")];

const keysOf = (rows: LibraryRow[]) => rows.map((row) => row.key);

describe("libraryRows", () => {
  it("keeps a catalog entry and the copy installed from it as two rows", () => {
    const { catalog } = fakeCatalog({ "timetables/BEI3.json": bei3 });
    const anna = profile("Anna", [
      timetable("BEI3", bei3, { origin: { kind: "catalog", path: "BEI3.json" } }),
    ]);
    const rows = libraryRows({ profiles: [anna], catalog, uploaded: [] });
    expect(keysOf(rows)).toEqual(["c:timetables/BEI3.json", "p:Anna/BEI3"]);
    expect(rows[0].hash).toBe(rows[1].hash);
    expect(rows[0].source.origin).toEqual({ kind: "catalog", path: "BEI3.json" });
  });

  it("sorts by name numerically, then catalog, profiles, uploads", () => {
    const { catalog } = fakeCatalog({ "timetables/BEI10.json": other });
    const upload = timetable("BEI9", bei3);
    const rows = libraryRows({
      profiles: [
        profile("Zoe", [timetable("BEI9", bei3)]),
        profile("Anna", [timetable("BEI9", bei3)]),
      ],
      catalog,
      uploaded: [upload],
    });
    expect(keysOf(rows)).toEqual(["p:Anna/BEI9", "p:Zoe/BEI9", "u:0", "c:timetables/BEI10.json"]);
  });

  it("marks the target's own copies as held", () => {
    const simon = profile("Simon", [timetable("BEI3", bei3)]);
    const rows = libraryRows({
      profiles: [simon, profile("Anna", [timetable("BEI3", other)])],
      catalog: fakeCatalog({}).catalog,
      uploaded: [],
      target: simon,
    });
    expect(rows.filter((row) => row.held).map((row) => row.key)).toEqual(["p:Simon/BEI3"]);
  });

  it("loads a catalog row by downloading and re-checking it", async () => {
    const { catalog, fetched } = fakeCatalog({ "timetables/BEI3.json": bei3 });
    const [row] = libraryRows({ profiles: [], catalog, uploaded: [] });
    expect(fetched).toEqual([]);
    expect(await row.source.load()).toEqual(bei3);
  });
});

describe("loadRow", () => {
  const enabledOf = (source: { subjects: { toExtra(): { enabled: boolean }[] } } | null) =>
    source?.subjects.toExtra().map((extra) => extra.enabled);

  it("copies a profile row with its selection and origin", async () => {
    const copy = timetable("BEI3", bei3, { origin: { kind: "catalog", path: "BEI3.json" } });
    copy.subjects = copy.subjects.with(0, { enabled: false });
    const { catalog } = fakeCatalog({ "timetables/BEI3.json": bei3 });
    const rows = libraryRows({ profiles: [profile("Anna", [copy])], catalog, uploaded: [] });
    const row = rows.find((one) => one.kind === "profile")!;
    expect(row.selection).toEqual({ enabled: 1, total: 2 });
    const loaded = await loadRow(row);
    expect(enabledOf(loaded)).toEqual([false, true]);
    expect(loaded?.origin).toEqual({ kind: "catalog", path: "BEI3.json" });
  });

  it("loads catalog rows and uploads all enabled", async () => {
    const { catalog } = fakeCatalog({ "timetables/BEI3.json": bei3 });
    const upload = timetable("Mine", other);
    upload.subjects = upload.subjects.withAllExtra({ enabled: false });
    const rows = libraryRows({ profiles: [], catalog, uploaded: [upload] });
    expect(rows.every((row) => row.selection === undefined)).toBe(true);
    for (const row of rows) {
      expect(enabledOf(await loadRow(row))?.every(Boolean)).toBe(true);
    }
  });
});

describe("empty timetables", () => {
  const empty = (name: string) => timetable(name, []);

  it("lead the list and never block each other or a held empty timetable", () => {
    const simon = profile("Simon", [empty("Leer")]);
    const rows = libraryRows({
      profiles: [simon],
      catalog: fakeCatalog({}).catalog,
      uploaded: [],
      empties: [empty("New"), empty("New")],
      target: simon,
    });
    expect(keysOf(rows)).toEqual(["e:0", "e:1", "p:Simon/Leer"]);
    expect(blockedRows(rows, new Set(["e:0", "e:1"]))).toEqual(new Set());
    expect(finalNames(rows, new Set(["e:0", "e:1"]), ["Leer"])).toEqual(
      new Map([
        ["e:0", "New"],
        ["e:1", "New 2"],
      ]),
    );
  });
});

describe("blockedRows", () => {
  const { catalog } = fakeCatalog({ "timetables/BEI3.json": bei3 });
  const rows = libraryRows({
    profiles: [profile("Anna", [timetable("Renamed", bei3)])],
    catalog,
    uploaded: [timetable("Other", other)],
  });

  it("blocks every row with the same hash as a picked one, whatever its name", () => {
    expect([...blockedRows(rows, new Set(["c:timetables/BEI3.json"]))]).toEqual(["p:Anna/Renamed"]);
    expect(blockedRows(rows, new Set(["u:0"])).size).toBe(0);
  });

  it("of two identical picks blocks only the later one", () => {
    const picked = new Set(["p:Anna/Renamed", "c:timetables/BEI3.json"]);
    expect([...blockedRows(rows, picked)]).toEqual(["p:Anna/Renamed"]);
  });

  it("lets a held row claim its content first", () => {
    const simon = profile("Simon", [timetable("BEI3", bei3)]);
    const held = libraryRows({ profiles: [simon], catalog, uploaded: [], target: simon });
    expect([...blockedRows(held, new Set(["c:timetables/BEI3.json"]))]).toEqual([
      "c:timetables/BEI3.json",
    ]);
  });
});

it("finalNames: held names first, then Name 2 in list order", () => {
  const { catalog } = fakeCatalog({ "timetables/BEI3.json": bei3 });
  const rows = libraryRows({
    profiles: [profile("Anna", [timetable("BEI3", other)])],
    catalog,
    uploaded: [timetable("BEI3", [subject("X")])],
  });
  const names = finalNames(rows, new Set(keysOf(rows)), ["BEI3"]);
  expect(Object.fromEntries(names)).toEqual({
    "c:timetables/BEI3.json": "BEI3 2",
    "p:Anna/BEI3": "BEI3 3",
    "u:0": "BEI3 4",
  });
  expect(finalNames(rows, new Set(["u:0"]), []).get("u:0")).toBe("BEI3");
});
