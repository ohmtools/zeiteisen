import type { Group, GroupCategory } from "./group";
import { compareNames } from "./name";
import { getSubjectID, type SubjectID, type Subjects } from "./subject";
import type { Timetable, TimetableSubjectExtra } from "./timetable";

// The group tree of a timetable: categories ascending, each listing all of its
// n groups. Subjects are addressed by their index in the `Subjects` the tree
// was built from, so a tree is valid exactly as long as that `Subjects` is.

export type GroupNode = {
  // `null` for the "no group" pseudo group.
  group: Group | null;
  indexes: number[];
};

export type CategoryNode = {
  // `null` is the "no group" category: every subject without a group, one
  // pseudo group, listed first.
  category: GroupCategory | null;
  groups: GroupNode[];
};

export type TimetableNode = {
  timetable: Timetable;
  categories: CategoryNode[];
};

// One node per timetable, sorted by name (`compareNames`: "BEI9" before
// "BEI10").
export function buildTree(timetables: readonly Timetable[]): TimetableNode[] {
  return [...timetables]
    .sort((a, b) => compareNames(a.name, b.name))
    .map((timetable) => ({ timetable, categories: categoriesOf(timetable.subjects) }));
}

// A category shows all its n groups, even ones no subject uses. A group index
// outside its category is rejected by the schema and skipped here.
export function categoriesOf<T extends object>(subjects: Subjects<T>): CategoryNode[] {
  const ungrouped: number[] = [];
  const byCategory = new Map<GroupCategory, number[][]>();
  subjects.forEach((subject, _, i) => {
    if (!subject.group) {
      ungrouped.push(i);
      return;
    }
    const { category, index } = subject.group;
    let groups = byCategory.get(category);
    if (!groups) {
      groups = Array.from({ length: category }, () => []);
      byCategory.set(category, groups);
    }
    groups[index - 1]?.push(i);
  });

  const categories: CategoryNode[] = [];
  if (ungrouped.length > 0) {
    categories.push({ category: null, groups: [{ group: null, indexes: ungrouped }] });
  }
  for (const category of [...byCategory.keys()].sort((a, b) => a - b)) {
    categories.push({
      category,
      groups: byCategory.get(category)!.map((indexes, i) => ({
        group: { category, index: i + 1 },
        indexes,
      })),
    });
  }
  return categories;
}

export type SelectionState = "all" | "none" | "partial";

export function stateOf(
  subjects: Subjects<TimetableSubjectExtra>,
  indexes: readonly number[],
): SelectionState {
  const enabled = indexes.filter((i) => subjects.getExtra(i).enabled).length;
  if (enabled === 0) return "none";
  return enabled === indexes.length ? "all" : "partial";
}

// One class: every subject sharing a `SubjectID`. A file may list a class in
// several slots (RT1:SU:2.1 on Thursday and on Friday); the user picks the
// class, not the slot.
export type ClassNode = {
  id: SubjectID;
  indexes: number[];
};

export function classesOf<T extends object>(
  subjects: Subjects<T>,
  indexes: readonly number[],
): ClassNode[] {
  const classes = new Map<SubjectID, ClassNode>();
  for (const i of indexes) {
    const id = getSubjectID(subjects.getSubject(i));
    const node = classes.get(id);
    if (node) node.indexes.push(i);
    else classes.set(id, { id, indexes: [i] });
  }
  return [...classes.values()];
}
