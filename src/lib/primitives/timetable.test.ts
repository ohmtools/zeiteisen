import { expect, test } from "vitest";
import { fakeCatalog, profile, subject, timetable } from "./fixtures.test-util";
import { subjectsHash } from "./subject";
import {
  catalogUpdate,
  enabledSubjects,
  findTimetable,
  getSharedTimetable,
  getTimetableFile,
  parseSharedTimetable,
  parseTimetableFile,
  rejectUpdate,
  setSubjectsEnabled,
  timetableHasUpdate,
  update,
} from "./timetable";

const a = subject("A");
const b = subject("B");
const c = subject("C");
const origin = { kind: "catalog", path: "BEI3.json" } as const;

test("withNewSubjects keeps extras of subjects that stay, pairs duplicates one to one", () => {
  const before = timetable("T", [a, b, a]).subjects.with(0, { enabled: false });
  const after = before.withNewSubjects([a, a, c], () => ({ enabled: true }));
  expect(after.map((s, e) => [s.name, e.enabled])).toEqual([
    ["A", false],
    ["A", true],
    ["C", true],
  ]);
});

test("a catalog timetable has an update until it is taken or dismissed", async () => {
  const { catalog } = fakeCatalog({ "timetables/BEI3.json": [a, c] });
  const held = timetable("BEI3", [a, b], { origin });
  held.subjects = held.subjects.with(0, { enabled: false });

  expect(timetableHasUpdate(held, catalog)).toBe(true);
  expect(timetableHasUpdate({ ...held, origin: { kind: "local" } }, catalog)).toBe(false);

  const updated = await update(held, catalog);
  expect(updated?.subjects.map((s, e) => [s.name, e.enabled])).toEqual([
    ["A", false],
    ["C", true],
  ]);
  expect(timetableHasUpdate(updated!, catalog)).toBe(false);

  const dismissed = rejectUpdate(held, catalog);
  expect(dismissed.rejected).toEqual([subjectsHash([a, c])]);
  expect(catalogUpdate(dismissed, catalog)).toBeNull();
  expect(await update(dismissed, catalog)).toBeNull();
});

test("update gives null when the download fails", async () => {
  const { catalog } = fakeCatalog({ "timetables/BEI3.json": [a, c] });
  const failing = new (catalog.constructor as typeof import("./catalog").Catalog)(
    catalog.index,
    async () => undefined,
  );
  expect(await update(timetable("BEI3", [a], { origin }), failing)).toBeNull();
});

test("findTimetable prefers a profile's copy, else names it after the catalog file", async () => {
  const hash = subjectsHash([a, b]);
  const { catalog, fetched } = fakeCatalog({ "timetables/Cat.json": [b, a] });
  const held = timetable("Mine", [a, b], { origin });

  const local = await findTimetable(hash, [profile("P", [held])], catalog);
  expect(local).toMatchObject({ name: "Mine", origin });
  expect(fetched).toEqual([]);

  const remote = await findTimetable(hash, [], catalog);
  expect(remote).toMatchObject({ name: "Cat", origin: { kind: "catalog", path: "Cat.json" } });
  expect(await findTimetable("nope", [], catalog)).toBeNull();
});

test("a fully enabled timetable is shared without bits and comes back fully enabled", () => {
  const full = timetable("X", [a, subject("B")]);
  const shared = getSharedTimetable(full);
  expect(shared).toEqual({ hash: full.subjects.hash() });
  expect("subjects" in shared).toBe(false);
  const back = parseSharedTimetable(shared, full);
  expect(back.subjects.every((_, e) => e.enabled)).toBe(true);
});

test("a partial selection keeps its bits and round-trips", () => {
  const full = timetable("X", [a, subject("B")]);
  const partial = { ...full, subjects: full.subjects.with(0, { enabled: false }) };
  const shared = getSharedTimetable(partial);
  expect(shared.subjects).toBeTypeOf("string");
  const back = parseSharedTimetable(shared, full);
  expect(back.subjects.map((_, e) => e.enabled)).toEqual(
    partial.subjects.toCanonical().map((_, e) => e.enabled),
  );
});

test("setSubjectsEnabled switches the given indexes, enabledSubjects keeps their index", () => {
  const t = setSubjectsEnabled(timetable("T", [a, b, c]), [0, 2], false);
  expect(enabledSubjects(t)).toEqual([{ index: 1, subject: b }]);
  expect(setSubjectsEnabled(t, [], true)).toBe(t);
});

test("a timetable file reads back named after the file, local, all enabled", () => {
  const t = setSubjectsEnabled(timetable("T", [a, b], { origin }), [1], false);
  const file = JSON.parse(JSON.stringify(getTimetableFile(t))) as unknown;
  const parsed = parseTimetableFile(file, "dir/BEI3.timetable");
  if ("error" in parsed) throw new Error(parsed.error);
  expect(parsed.source.name).toBe("BEI3");
  expect(parsed.source.origin).toEqual({ kind: "local" });
  expect(parsed.source.subjects.toExtra()).toEqual([{ enabled: true }, { enabled: true }]);
  expect(parsed.source.subjects.hash()).toBe(t.subjects.hash());
  expect(parseTimetableFile({ subjects: [] }, "X.timetable")).toMatchObject({ error: "content" });
  expect(parseTimetableFile([], ".timetable")).toEqual({ error: "name" });
});
