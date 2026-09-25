import { m } from "@/i18n";
import { Warn, type Warning } from "@/lib/primitives/warnings";
import { subjectLabel } from "@/lib/subjects";

// The words for the primitives' `Warning` data (`warningsFor`). Everything is
// allowed; the tree only warns.

function categoryLabel(category: number | null): string {
  return category === null ? m.tree_no_group() : String(category);
}

export function warningText(warning: Warning): string {
  switch (warning.code) {
    case Warn.EmptyCategory:
      return m.warn_empty_category({ category: categoryLabel(warning.category) });
    case Warn.MultiGroupForSubject:
      return m.warn_multi_group_for_subject({
        subject: subjectLabel(warning.subject),
        groups: warning.groups.join(", "),
      });
    case Warn.NonOverlap:
      return m.warn_non_overlap({ group: warning.group });
    case Warn.NoClassForSubject:
      return m.warn_no_class_for_subject({ subject: subjectLabel(warning.subject) });
    case Warn.ShRange:
      return m.warn_sh_range();
  }
}

// A React key: one warning per code and category / subject at most.
export function warningKey(warning: Warning): string {
  switch (warning.code) {
    case Warn.EmptyCategory:
      return `${warning.code}:${warning.category ?? ""}`;
    case Warn.NonOverlap:
      return warning.code;
    case Warn.NoClassForSubject:
    case Warn.MultiGroupForSubject:
      return `${warning.code}:${warning.key}`;
    case Warn.ShRange:
      return warning.code;
  }
}
