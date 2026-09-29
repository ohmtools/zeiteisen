import { expect, it } from "vitest";
import { subject } from "@/lib/primitives/fixtures.test-util";
import { Subjects } from "@/lib/primitives/subject";
import { categoriesOf } from "@/lib/primitives/tree";
import { toggleCategory, toggleGroup, type Toggle } from "@/lib/groupToggle";

// Category 2: 2.1 holds A, B, C (indexes 0-2), 2.2 holds D (index 3).
const base = Subjects.fromSubjects(
  [
    subject("A", { group: { category: 2, index: 1 } }),
    subject("B", { group: { category: 2, index: 1 } }),
    subject("C", { group: { category: 2, index: 1 } }),
    subject("D", { group: { category: 2, index: 2 } }),
  ],
  () => ({ enabled: true }),
);
const [category] = categoriesOf(base);
const [g1] = category.groups;

const withEnabled = (subjects: typeof base, indexes: number[], enabled: boolean) =>
  indexes.reduce((all, i) => all.with(i, { enabled }), subjects);
const apply = (subjects: typeof base, toggle: Toggle) =>
  withEnabled(subjects, toggle.indexes, toggle.enabled);
const enabled = (subjects: typeof base) =>
  subjects.toExtra().flatMap((extra, i) => (extra.enabled ? [i] : []));

it("switches a partial group off and brings its pick back", () => {
  const partial = withEnabled(base, [1], false);
  const off = toggleGroup(partial, g1, undefined);
  const afterOff = apply(partial, off);
  expect(enabled(afterOff)).toEqual([3]);
  const kept = off.kept.get("2.1") ?? undefined;
  expect(kept?.map((one) => one.index)).toEqual([0, 2]);

  const on = toggleGroup(afterOff, g1, kept);
  expect(enabled(apply(afterOff, on))).toEqual([0, 2, 3]);
  expect(on.kept.get("2.1")).toBeNull();
});

it("switches a full group off and on as a whole", () => {
  const off = toggleGroup(base, g1, undefined);
  expect(off.kept.get("2.1")).toBeNull();
  const afterOff = apply(base, off);
  expect(enabled(apply(afterOff, toggleGroup(afterOff, g1, undefined)))).toEqual([0, 1, 2, 3]);
});

it("drops a kept class whose subject moved, and picks all when none is left", () => {
  const kept = [{ index: 0, subject: subject("X", { group: { category: 2, index: 1 } }) }];
  const off = withEnabled(base, [0, 1, 2], false);
  expect(toggleGroup(off, g1, kept).indexes).toEqual([0, 1, 2]);
});

it("toggles a whole category like a tri-state checkbox, keeping partial picks", () => {
  const partial = withEnabled(base, [1], false);
  const off = toggleCategory(partial, category, new Map());
  const afterOff = apply(partial, off);
  expect(enabled(afterOff)).toEqual([]);

  const kept = new Map([["2.1", off.kept.get("2.1")!]]);
  const afterOn = apply(afterOff, toggleCategory(afterOff, category, kept));
  expect(enabled(afterOn)).toEqual([0, 2, 3]);

  // Some on: switches the others on, leaves the partial one as it is.
  const some = withEnabled(partial, [3], false);
  expect(enabled(apply(some, toggleCategory(some, category, new Map())))).toEqual([0, 2, 3]);
});
