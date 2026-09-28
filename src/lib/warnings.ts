import { m } from "@/i18n";
import { parseGroupName, type GroupCategory, type GroupName } from "@/lib/primitives/group";
import { compareNames } from "@/lib/primitives/name";
import { Warn, type Warning } from "@/lib/primitives/warnings";
import { subjectLabel } from "@/lib/subjects";

// The words for the primitives' `Warning` data (`warningsFor`). Everything is
// allowed; the tree only warns.

// One line of a timetable's warnings; `key` is its React key.
export type WarningLine = { key: string; text: string };

function categoryLabel(category: GroupCategory | null): string {
  return category === null ? m.tree_no_group() : String(category);
}

// The category a subject's groups belong to: the university gives each
// subject variation one (a file that spreads one over several: the first).
function categoryOf(groups: readonly GroupName[]): GroupCategory | null {
  return parseGroupName(groups[0])?.category ?? null;
}

// The primitives warn once per subject with more than one group; the tree says
// it once per category (user decision): a timetable arrives with every group
// selected, and a line per subject buried the rest. That line names every
// such subject of the category and the groups they sit in, and stands where
// the category's first one would.
export function warningLines(warnings: readonly Warning[]): WarningLine[] {
  const multi = new Map<GroupCategory | null, { subjects: string[]; groups: Set<GroupName> }>();
  for (const warning of warnings) {
    if (warning.code !== Warn.MultiGroupForSubject) continue;
    const category = categoryOf(warning.groups);
    const seen = multi.get(category) ?? { subjects: [], groups: new Set() };
    seen.subjects.push(subjectLabel(warning.subject));
    for (const group of warning.groups) seen.groups.add(group);
    multi.set(category, seen);
  }

  const lines: WarningLine[] = [];
  for (const warning of warnings) {
    if (warning.code !== Warn.MultiGroupForSubject) {
      lines.push(line(warning));
      continue;
    }
    const category = categoryOf(warning.groups);
    const seen = multi.get(category);
    if (!seen) continue;
    multi.delete(category);
    lines.push({
      key: `${warning.code}:${category ?? ""}`,
      text: m.warn_multi_group_in_category({
        category: categoryLabel(category),
        subjects: seen.subjects.join(", "),
        groups: [...seen.groups].sort(compareNames).join(", "),
      }),
    });
  }
  return lines;
}

// Every other warning is a line of its own: one per code and category /
// subject at most.
function line(warning: Exclude<Warning, { code: typeof Warn.MultiGroupForSubject }>): WarningLine {
  switch (warning.code) {
    case Warn.EmptyCategory:
      return {
        key: `${warning.code}:${warning.category ?? ""}`,
        text: m.warn_empty_category({ category: categoryLabel(warning.category) }),
      };
    case Warn.NonOverlap:
      return { key: warning.code, text: m.warn_non_overlap({ group: warning.group }) };
    case Warn.NoClassForSubject:
      return {
        key: `${warning.code}:${warning.key}`,
        text: m.warn_no_class_for_subject({ subject: subjectLabel(warning.subject) }),
      };
    case Warn.ShRange:
      return { key: warning.code, text: m.warn_sh_range() };
  }
}
