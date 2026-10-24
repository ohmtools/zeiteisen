import { expect, test } from "vitest";
import { subject, timetable, weekly } from "./fixtures.test-util";
import type { Subject } from "./subject";
import type { Timetable } from "./timetable";
import { buildTree, categoriesOf, classesOf, stateOf } from "./tree";
import { Warn, warningsFor } from "./warnings";

const g = (category: number, index: number) => ({ group: { category, index } });

// Enables exactly the subjects at `on`.
function only(t: Timetable, on: number[]): Timetable {
  return { ...t, subjects: t.subjects.withMappedExtra((_, i) => ({ enabled: on.includes(i) })) };
}

const subjects: Subject[] = [
  subject("Free"),
  subject("A", g(2, 1)),
  subject("A", g(2, 2)),
  subject("B", { ...g(3, 3), kind: ["Pr"] }),
  subject("B", { ...g(3, 3), kind: ["Pr"], repeat: weekly("friday") }),
];

test("tree: no-group first, categories ascending, all n groups listed", () => {
  const categories = categoriesOf(timetable("T", subjects).subjects);
  expect(categories.map((c) => [c.category, c.groups.map((group) => group.indexes)])).toEqual([
    [null, [[0]]],
    [2, [[1], [2]]],
    [3, [[], [], [3, 4]]],
  ]);
  const names = ["BEI10", "b", "BEI9", "a"];
  expect(buildTree(names.map((name) => timetable(name, []))).map((n) => n.timetable.name)).toEqual([
    "a",
    "b",
    "BEI9",
    "BEI10",
  ]);
});

test("classes join the slots of one class, stateOf reads enabled", () => {
  const t = only(timetable("T", subjects), [3]);
  expect(classesOf(t.subjects, [3, 4])).toEqual([{ id: "B:Pr:3.3", indexes: [3, 4] }]);
  expect(stateOf(t.subjects, [3, 4])).toBe("partial");
  expect(stateOf(t.subjects, [3])).toBe("all");
  expect(stateOf(t.subjects, [])).toBe("none");
});

test("a consistent choice warns about nothing", () => {
  // 2.2 = [1/2, 1] and 3.3 = [2/3, 1] overlap.
  expect(warningsFor(only(timetable("T", subjects), [0, 2, 3]))).toEqual([]);
});

test("each rule warns", () => {
  const codes = (on: number[]) => warningsFor(only(timetable("T", subjects), on));
  expect(codes([0, 1, 2, 3])).toContainEqual({
    code: Warn.MultiGroupForSubject,
    key: "A:SU",
    subject: subjects[1],
    groups: ["2.1", "2.2"],
  });
  // 2.1 = [0, 1/2] and 3.3 = [2/3, 1] do not overlap.
  expect(codes([0, 1, 3])).toContainEqual({ code: Warn.NonOverlap, group: "3.3" });
  const none = codes([]);
  expect(none.filter((w) => w.code === Warn.EmptyCategory).map((w) => w.category)).toEqual([
    null,
    2,
    3,
  ]);
  expect(none.filter((w) => w.code === Warn.NoClassForSubject).map((w) => w.key)).toEqual([
    "Free:SU",
    "A:SU",
    "B:Pr",
  ]);
  const sh = only(timetable("T", [subject("S", { repeat: weekly("monday", "SH1") })]), [0]);
  expect(warningsFor(sh)).toEqual([{ code: Warn.ShRange }]);
});

test("different subjects of one category may pick different groups", () => {
  const free = [subject("A", g(2, 1)), subject("C", g(2, 2)), subject("B", g(3, 1))];
  // A in 2.1 and C in 2.2: one group per subject, no warning. Category 2 has
  // no single slice, so only 3.1 takes part in the overlap check.
  expect(warningsFor(only(timetable("T", free), [0, 1, 2]))).toEqual([]);
});
