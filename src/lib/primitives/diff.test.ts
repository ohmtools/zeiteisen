import { expect, test } from "vitest";
import { changedFields, diffSubjects } from "./diff";
import { dated, subject, weekly } from "./fixtures.test-util";

const g = (category: number, index: number) => ({ group: { category, index } });

test("diffSubjects compares every field and pairs duplicates", () => {
  const a = subject("A");
  const b = subject("B");
  const diff = diffSubjects([a, a, b], [a]);
  expect(diff.sameCount).toBe(1);
  expect(diff.added).toEqual([]);
  expect(diff.changed).toEqual([]);
  expect(diff.removed.map((s) => s.name).sort()).toEqual(["A", "B"]);
});

test("a class whose slot changed is one change, not removed and added", () => {
  const before = subject("ELK1", { kind: ["Pr"], ...g(10, 7), repeat: weekly("thursday") });
  const after = subject("ELK1", {
    kind: ["Pr"],
    ...g(10, 7),
    repeat: weekly("thursday", "A", { location: "WE.109" }),
  });
  const diff = diffSubjects([before, subject("MCT")], [after, subject("MCT")]);
  expect(diff).toEqual({
    added: [],
    removed: [],
    changed: [{ before, after, fields: ["location"] }],
    sameCount: 1,
  });
});

test("only unique pairs by SubjectID become changes", () => {
  // BEI3 lists ELK1:SU:2.1 twice: which old entry became which new one is
  // not known, so both stay removed and added.
  const one = subject("ELK1", { ...g(2, 1), repeat: weekly("monday") });
  const two = subject("ELK1", { ...g(2, 1), repeat: weekly("tuesday") });
  const moved = subject("ELK1", { ...g(2, 1), repeat: weekly("friday") });
  const other = subject("ELK1", { ...g(2, 1), repeat: weekly("thursday") });
  const diff = diffSubjects([one, two], [moved, other]);
  expect(diff.changed).toEqual([]);
  expect(diff.added).toEqual([moved, other]);
  expect(diff.removed).toEqual([one, two]);
});

test("another group or kind is another class", () => {
  const before = subject("SDS", g(2, 1));
  const after = subject("SDS", g(2, 3));
  const diff = diffSubjects([before], [after]);
  expect(diff.changed).toEqual([]);
  expect(diff.added).toEqual([after]);
  expect(diff.removed).toEqual([before]);
});

test("changedFields names what differs", () => {
  const base = subject("A", { repeat: weekly("monday") });
  expect(
    changedFields(
      base,
      subject("A", {
        repeat: weekly("tuesday", "G", {
          startTime: { hour: 9, minute: 45 },
          endTime: { hour: 11, minute: 15 },
          professor: "M. Muster",
        }),
        note: "Kittel",
        onDemand: true,
        degreeProgram: "B-EI",
      }),
    ),
  ).toEqual(["repeat", "day", "time", "professor", "note", "onDemand", "degreeProgram"]);
  expect(changedFields(base, subject("A", { repeat: dated("2026-10-24") }))).toEqual(["repeat"]);
  expect(
    changedFields(
      subject("A", { repeat: dated("2026-10-24") }),
      subject("A", { repeat: dated("2026-10-24", "2026-11-07") }),
    ),
  ).toEqual(["dates"]);
});
