import * as z from "zod/mini";
export type GroupCategory = number;
export type GroupIndex = number;

export type Group = {
  category: GroupCategory;
  index: GroupIndex;
};

// Group name using the official university notation.
export type GroupName = string;

// Group name using the official university notation.
export function groupName(g: Group): GroupName {
  return g.category + "." + g.index;
}

// Get group name type from a string using the official university notation.
// Returns null unless name is "n.i" with 1 <= i <= n.
export function parseGroupName(name: GroupName): Group | null {
  const match = /^(\d+)\.(\d+)$/.exec(name);
  if (!match) return null;

  const category = Number(match[1]);
  const index = Number(match[2]);
  if (index < 1 || index > category) return null;

  return { category, index };
}

// isOverlapping checks if the specified groups overlap accoring to the
// timetable rule.
//
// If a non-overlapping group is found, this returns false along with the name
// of the first non-overlapping group found.
export function isOverlapping(groups: Group[]): [boolean, string] {
  const sorted = [...groups].sort((a, b) => a.category - b.category);

  let spanStart = 0.0;
  let spanEnd = 1.0;

  for (const group of sorted) {
    const { category, index } = group;
    const start = (index - 1) / category;
    if (start >= spanEnd) {
      return [false, groupName(group)];
    }
    if (start > spanStart) {
      spanStart = start;
    }

    const end = index / category;
    if (end <= spanStart) {
      return [false, groupName(group)];
    }
    if (end < spanEnd) {
      spanEnd = end;
    }
  }

  return [true, ""];
}

// Zod mirrors of the types above. Everything read from outside (catalog,
// localStorage, uploaded files) walks through these before it becomes a
// primitive; nothing here throws, callers use `safeParse`.

// Category n has exactly n groups, so the index is 1..n.
export const groupSchema = z
  .object({
    category: z.int().check(z.positive()),
    index: z.int().check(z.positive()),
  })
  .check(z.refine((g) => g.index <= g.category, { message: "group index exceeds its category" }));
