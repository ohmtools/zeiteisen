import { getLocale, m } from "@/i18n";
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

// `„A“, „B“ und „C“`: each name quoted, joined the language's way.
function quotedList(names: readonly string[]): string {
  const list = new Intl.ListFormat(getLocale(), { type: "conjunction" });
  return list.format(names.map((text) => m.warn_quoted({ text })));
}

// ONE line per kind of warning (user decision): the primitives warn once per
// category or subject, and a timetable arriving with every group selected
// buried the other warnings under its lines. A kind's line names everything
// it stands for and sits where its first warning was.
export function warningLines(warnings: readonly Warning[]): WarningLine[] {
  const byCode = new Map<Warn, Warning[]>();
  for (const warning of warnings) {
    byCode.set(warning.code, [...(byCode.get(warning.code) ?? []), warning]);
  }
  return [...byCode].map(([code, all]) => ({ key: code, text: text(all) }));
}

// The line of one kind; `all` holds its warnings, all of the same code.
function text(all: readonly Warning[]): string {
  const of = <C extends Warn>(code: C) =>
    all.filter((w): w is Extract<Warning, { code: C }> => w.code === code);
  switch (all[0].code) {
    case Warn.EmptyCategory: {
      const categories = of(Warn.EmptyCategory).map((w) => categoryLabel(w.category));
      return m.warn_empty_category({
        count: categories.length,
        categories: quotedList(categories),
      });
    }
    case Warn.MultiGroupForSubject: {
      // By category, in the order the categories first show up: the groups
      // of one category are what the student weighs against each other.
      const multi = of(Warn.MultiGroupForSubject);
      const groups = new Map<GroupCategory | null, Set<GroupName>>();
      for (const warning of multi) {
        const category = categoryOf(warning.groups);
        const seen = groups.get(category) ?? new Set();
        for (const group of warning.groups) seen.add(group);
        groups.set(category, seen);
      }
      return m.warn_multi_group({
        subjects: quotedList(multi.map((w) => subjectLabel(w.subject))),
        groups: [...groups.values()]
          .map((set) => [...set].sort(compareNames).join(", "))
          .join("; "),
      });
    }
    // At most one of each.
    case Warn.NonOverlap:
      return m.warn_non_overlap({ group: of(Warn.NonOverlap)[0].group });
    case Warn.NoClassForSubject:
      return m.warn_no_class_for_subject({
        subjects: quotedList(of(Warn.NoClassForSubject).map((w) => subjectLabel(w.subject))),
      });
    case Warn.ShRange:
      return m.warn_sh_range();
  }
}
