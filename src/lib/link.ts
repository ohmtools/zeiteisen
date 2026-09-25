import type { TimetableName } from "@/lib/primitives/timetable";

// Tree ↔ grid linking. A group cell knows the subjects it stands for (its
// `GroupNode.indexes` into its timetable), a grid block knows its timetable
// and subject index; these two meet here.

// The group cell hovered or focused on desktop: its blocks stay, every other
// block is dimmed.
export type Highlight = { timetableName: TimetableName; indexes: readonly number[] };

// One subject, as a block's details popup hands it to the tree ("jump to its
// group").
export type SubjectRef = { timetableName: TimetableName; index: number };

export function isHighlighted(entry: SubjectRef, highlight: Highlight): boolean {
  return entry.timetableName === highlight.timetableName && highlight.indexes.includes(entry.index);
}

// Pointer moves across one cell report it again and again; the same cell is
// no change.
export function sameHighlight(a: Highlight | null, b: Highlight | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.timetableName === b.timetableName &&
    a.indexes.length === b.indexes.length &&
    a.indexes.every((index, i) => b.indexes[i] === index)
  );
}
