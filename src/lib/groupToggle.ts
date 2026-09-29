import { groupName } from "@/lib/primitives/group";
import { sameSubject, type Subject, type Subjects } from "@/lib/primitives/subject";
import type { TimetableSubjectExtra } from "@/lib/primitives/timetable";
import { stateOf, type CategoryNode, type GroupNode } from "@/lib/primitives/tree";

// The classes a group had picked when it was switched off while partial, so
// switching it on again brings back that pick instead of every class. Kept
// with the subjects themselves: indexes shift when a subject is added or
// removed, and an entry whose subject no longer sits at its index is dropped.
export type Kept = readonly { index: number; subject: Subject }[];

// What one switch does: set `indexes` to `enabled`, and what each touched
// group (by `groupKey`) remembers afterwards (`null` = forget, a later switch
// on picks all).
export type Toggle = {
  indexes: number[];
  enabled: boolean;
  kept: Map<string, Kept | null>;
};

// A group within its timetable; the tree itself is rebuilt on every render.
export function groupKey(group: GroupNode): string {
  return group.group ? groupName(group.group) : "";
}

type Items = Subjects<TimetableSubjectExtra>;

function keptOf(subjects: Items, indexes: readonly number[]): Kept | null {
  if (stateOf(subjects, indexes) !== "partial") return null;
  return indexes
    .filter((i) => subjects.getExtra(i).enabled)
    .map((index) => ({ index, subject: subjects.getSubject(index) }));
}

// The group's remembered classes still found where they were; all of the
// group when none are.
function restored(subjects: Items, group: GroupNode, kept: Kept | undefined): number[] {
  const still = (kept ?? [])
    .filter(
      ({ index, subject }) =>
        group.indexes.includes(index) && sameSubject(subjects.getSubject(index), subject),
    )
    .map(({ index }) => index);
  return still.length > 0 ? still : group.indexes;
}

// A click on a group cell: anything picked switches off (remembering a
// partial pick), nothing picked switches the remembered pick back on.
export function toggleGroup(subjects: Items, group: GroupNode, kept: Kept | undefined): Toggle {
  if (stateOf(subjects, group.indexes) === "none") {
    return {
      indexes: restored(subjects, group, kept),
      enabled: true,
      kept: new Map([[groupKey(group), null]]),
    };
  }
  return {
    indexes: group.indexes,
    enabled: false,
    kept: new Map([[groupKey(group), keptOf(subjects, group.indexes)]]),
  };
}

// The groups of a category that hold subjects: the ones a switch can touch.
export function usedGroups(category: CategoryNode): GroupNode[] {
  return category.groups.filter((group) => group.indexes.length > 0);
}

// Whether every / some / none of the category's used groups has a pick.
export function categoryState(subjects: Items, category: CategoryNode): "all" | "some" | "none" {
  const on = usedGroups(category).map((group) => stateOf(subjects, group.indexes) !== "none");
  if (on.every(Boolean)) return "all";
  return on.some(Boolean) ? "some" : "none";
}

// The category's "all" button, a tri-state checkbox over its groups: all on
// switches every group off (each remembering a partial pick); otherwise the
// groups that are off switch their remembered pick on and the others stay as
// they are.
export function toggleCategory(
  subjects: Items,
  category: CategoryNode,
  kept: ReadonlyMap<string, Kept>,
): Toggle {
  const groups = usedGroups(category);
  if (categoryState(subjects, category) === "all") {
    return {
      indexes: groups.flatMap((group) => group.indexes),
      enabled: false,
      kept: new Map(groups.map((group) => [groupKey(group), keptOf(subjects, group.indexes)])),
    };
  }
  const off = groups.filter((group) => stateOf(subjects, group.indexes) === "none");
  return {
    indexes: off.flatMap((group) => restored(subjects, group, kept.get(groupKey(group)))),
    enabled: true,
    kept: new Map(off.map((group) => [groupKey(group), null])),
  };
}
